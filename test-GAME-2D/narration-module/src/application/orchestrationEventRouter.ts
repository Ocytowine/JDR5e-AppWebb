import {
  cloneJson,
  coreError,
  type CampaignRepository,
  type CoreError,
  type JsonObject,
  type OutboxTaskRecord,
  type Result,
  type WorkerId
} from "../core";
import {
  ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1,
  ORCHESTRATION_EVENT_TASK_TYPE_V1,
  REST_LIFECYCLE_SIGNAL_HOOK_ID_V1,
  type OrchestrationEventEnvelopeV1,
  type OrchestrationRoutableEventTypeV1
} from "../orchestration";

export {
  ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1,
  ORCHESTRATION_EVENT_TASK_TYPE_V1,
  REST_LIFECYCLE_SIGNAL_HOOK_ID_V1
} from "../orchestration";
export type {
  OrchestrationEventEnvelopeV1,
  OrchestrationRoutableEventTypeV1
} from "../orchestration";

export interface OrchestrationHookSignalV1 extends JsonObject {
  schemaVersion: 1;
  hookId: string;
  signalType: string;
  sourceEventId: string;
  processId: string;
  disposition: "OBSERVED" | "IGNORED";
  payload: JsonObject;
}

export interface OrchestrationEventHookV1 {
  hookId: string;
  acceptedEventTypes: readonly OrchestrationRoutableEventTypeV1[];
  handle(envelope: OrchestrationEventEnvelopeV1): Promise<Result<OrchestrationHookSignalV1>>;
}

export interface OrchestrationDispatchReceiptV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1;
  taskId: string;
  sourceEventId: string;
  eventType: OrchestrationRoutableEventTypeV1;
  status: "DELIVERED" | "NO_SUBSCRIBER";
  deliveries: OrchestrationHookSignalV1[];
}

export interface OrchestrationWorkerResultV1 {
  status: "COMPLETED" | "FAILED_RETRYABLE" | "FAILED_FINAL";
  task: OutboxTaskRecord;
  receipt: OrchestrationDispatchReceiptV1 | null;
}

export async function dispatchOrchestrationTaskV1(input: {
  task: OutboxTaskRecord;
  hooks: readonly OrchestrationEventHookV1[];
}): Promise<Result<OrchestrationDispatchReceiptV1>> {
  if (input.task.taskType !== ORCHESTRATION_EVENT_TASK_TYPE_V1 || input.task.status !== "RUNNING") {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "orchestration.router.invalid-task", {
        taskId: input.task.taskId,
        taskType: input.task.taskType,
        status: input.task.status
      })
    };
  }
  const envelope = validateEnvelope(input.task);
  if (!envelope.ok) return envelope;
  const subscribers = [...input.hooks]
    .filter(hook => hook.acceptedEventTypes.includes(envelope.value.eventType))
    .sort((left, right) => left.hookId.localeCompare(right.hookId));
  const deliveries: OrchestrationHookSignalV1[] = [];
  for (const hook of subscribers) {
    const delivered = await hook.handle(cloneJson(envelope.value) as OrchestrationEventEnvelopeV1);
    if (!delivered.ok) return delivered;
    if (delivered.value.hookId !== hook.hookId ||
        delivered.value.sourceEventId !== envelope.value.sourceEventId ||
        delivered.value.processId !== envelope.value.processId) {
      return {
        ok: false,
        error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "orchestration.router.invalid-hook-signal", {
          hookId: hook.hookId,
          sourceEventId: envelope.value.sourceEventId
        })
      };
    }
    deliveries.push(cloneJson(delivered.value) as OrchestrationHookSignalV1);
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1,
      taskId: input.task.taskId,
      sourceEventId: envelope.value.sourceEventId,
      eventType: envelope.value.eventType,
      status: deliveries.length === 0 ? "NO_SUBSCRIBER" : "DELIVERED",
      deliveries
    }
  };
}

export async function processClaimedOrchestrationTaskV1(input: {
  repository: CampaignRepository;
  task: OutboxTaskRecord;
  workerId: WorkerId;
  hooks: readonly OrchestrationEventHookV1[];
  retryAt: string;
}): Promise<Result<OrchestrationWorkerResultV1>> {
  if (input.task.status !== "RUNNING" || input.task.lockedBy !== input.workerId) {
    return {
      ok: false,
      error: coreError("CAMPAIGN_BUSY", "orchestration.router.task-not-owned", {
        taskId: input.task.taskId,
        status: input.task.status,
        lockedBy: input.task.lockedBy,
        workerId: input.workerId
      })
    };
  }
  const dispatched = await dispatchOrchestrationTaskV1({ task: input.task, hooks: input.hooks });
  if (dispatched.ok) {
    const completed = await input.repository.completeOutboxTask(input.task.taskId, input.workerId);
    if (!completed.ok) return completed;
    return {
      ok: true,
      value: {
        status: "COMPLETED",
        task: completed.value,
        receipt: dispatched.value
      }
    };
  }
  const failed = await input.repository.failOutboxTask(
    input.task.taskId,
    input.workerId,
    dispatched.error,
    dispatched.error.retry === "NEVER" ? null : input.retryAt
  );
  if (!failed.ok) return failed;
  return {
    ok: true,
    value: {
      status: failed.value.status === "FAILED_FINAL" ? "FAILED_FINAL" : "FAILED_RETRYABLE",
      task: failed.value,
      receipt: null
    }
  };
}

export function createRestLifecycleSignalHookV1(): OrchestrationEventHookV1 {
  return {
    hookId: REST_LIFECYCLE_SIGNAL_HOOK_ID_V1,
    acceptedEventTypes: ["rest_interrupted", "rest_completed_pending_benefits"],
    async handle(envelope) {
      return {
        ok: true,
        value: {
          schemaVersion: 1,
          hookId: REST_LIFECYCLE_SIGNAL_HOOK_ID_V1,
          signalType: envelope.processStatus === "INTERRUPTED"
            ? "REST_INTERRUPTED"
            : "REST_COMPLETED_PENDING_BENEFITS",
          sourceEventId: envelope.sourceEventId,
          processId: envelope.processId,
          disposition: "OBSERVED",
          payload: {
            processStatus: envelope.processStatus,
            elapsedRestSeconds: envelope.elapsedRestSeconds,
            pendingBenefitCount: envelope.pendingBenefitCount
          }
        }
      };
    }
  };
}

function validateEnvelope(task: OutboxTaskRecord): Result<OrchestrationEventEnvelopeV1> {
  if (task.sourceEventIds.length !== 1) {
    return { ok: false, error: invalidEnvelope(task, "exactly one source event is required") };
  }
  const value = task.payload as Partial<OrchestrationEventEnvelopeV1>;
  const eventType = value.eventType;
  const validEventType = eventType === "rest_interrupted" ||
    eventType === "rest_completed_pending_benefits";
  const validStatus = value.processStatus === "INTERRUPTED" ||
    value.processStatus === "COMPLETED_PENDING_BENEFITS";
  if (
    value.schemaVersion !== 1 ||
    value.contractVersion !== ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1 ||
    value.sourceDomain !== "REST" ||
    value.sourceEventId !== task.sourceEventIds[0] ||
    !validEventType ||
    !validStatus ||
    typeof value.processId !== "string" ||
    !value.processId.trim() ||
    !Number.isInteger(value.elapsedRestSeconds) ||
    Number(value.elapsedRestSeconds) < 0 ||
    typeof value.checkpointFingerprint !== "string" ||
    !Number.isInteger(value.pendingBenefitCount) ||
    Number(value.pendingBenefitCount) < 0 ||
    value.interruption === null ||
    typeof value.interruption !== "object" ||
    Array.isArray(value.interruption) ||
    typeof value.interruption.interrupted !== "boolean" ||
    (value.interruption.reason !== null && typeof value.interruption.reason !== "string") ||
    (value.interruption.segmentIndex !== null && !Number.isInteger(value.interruption.segmentIndex))
  ) {
    return { ok: false, error: invalidEnvelope(task, "payload does not satisfy orchestration-event-router/1") };
  }
  if (
    (eventType === "rest_interrupted" && value.processStatus !== "INTERRUPTED") ||
    (eventType === "rest_completed_pending_benefits" && value.processStatus !== "COMPLETED_PENDING_BENEFITS")
  ) {
    return { ok: false, error: invalidEnvelope(task, "event type and process status disagree") };
  }
  return { ok: true, value: cloneJson(value) as OrchestrationEventEnvelopeV1 };
}

function invalidEnvelope(task: OutboxTaskRecord, issue: string): CoreError {
  return coreError("VALIDATION_FAILED", "orchestration.router.invalid-envelope", {
    taskId: task.taskId,
    issue
  });
}
