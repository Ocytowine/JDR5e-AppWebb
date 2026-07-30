import {
  computeJsonFingerprint,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  MapModuleWorldSimulationAdapterV1,
  planNextTemporalBatchV1,
  prepareTemporalSegmentCommitV1,
  validateWorldSchedulePayloadV1,
  validateWorldSimulationCursorPayloadV1,
  type TemporalTaskV1,
  type WorldSimulationCursorPayloadV1
} from "../time";
import type { CampaignRuntimeBindingsV1 } from
  "./campaignRuntimeBindings";
import { readOptionalPrototypeAggregateV1 } from
  "./prototypeSceneTransitionRuntime";

export interface CampaignWorldSimulationSnapshotV1 extends JsonObject {
  schemaVersion: 1;
  elapsedGameSeconds: number;
  worldSimulatedThrough: number;
  worldState: JsonObject;
  lastTickOutput: JsonObject | null;
}

export interface CampaignWorldSimulationAdvanceResultV1 extends JsonObject {
  schemaVersion: 1;
  snapshot: CampaignWorldSimulationSnapshotV1;
  sourceOperationId: string;
  sourceEventId: string;
  replayed: boolean;
}

export interface CampaignWorldSimulationRuntimeV1 {
  ensureInitialized(): Promise<Result<CampaignWorldSimulationSnapshotV1>>;
  restore(): Promise<Result<CampaignWorldSimulationSnapshotV1>>;
  advance(input: {
    clientRequestId: string;
    hours: number;
  }): Promise<Result<CampaignWorldSimulationAdvanceResultV1>>;
}

export function createCampaignWorldSimulationRuntimeV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  runtimeBindings: CampaignRuntimeBindingsV1;
  initialWorldState: JsonObject;
  clock?: RepositoryClock;
}): CampaignWorldSimulationRuntimeV1 {
  const clock = input.clock ?? { now: () => new Date() };
  const worldStateAggregateId = opaqueId<AggregateId>(
    `agg-world-state-${input.campaignId.replace(/^cmp-player-/, "")}`
  );
  const adapter = new MapModuleWorldSimulationAdapterV1();

  return {
    async ensureInitialized() {
      const restored = await restoreSnapshot({
        ...input,
        worldStateAggregateId
      });
      if (restored.ok || restored.error.code !== "NOT_FOUND") {
        return restored;
      }
      const campaign = await input.repository.getCampaign(input.campaignId);
      if (!campaign.ok) return campaign;
      const clockAggregate = await input.repository.getAggregate(
        input.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      );
      if (!clockAggregate.ok) return clockAggregate;
      if (Number(clockAggregate.value.payload.elapsedGameSeconds) !== 0) {
        return {
          ok: false,
          error: coreError(
            "VALIDATION_FAILED",
            "campaign.world-simulation.initialization-requires-zero-clock"
          )
        };
      }
      const batchBase = {
        schemaVersion: 1 as const,
        batchId: `world-simulation:init:${input.campaignId}`,
        currentGameSecond: 0,
        requestedTargetGameSecond: 0,
        effectiveAtGameSecond: 0,
        orderedTasks: [{
          schemaVersion: 1 as const,
          taskId: `world-simulation:init-task:${input.campaignId}`,
          taskKind: "PROCESS_BOUNDARY" as const,
          dueAtGameSecond: 0,
          boundaryPolicy: "SIMULTANEOUS" as const,
          dependsOnTaskIds: [],
          payload: { action: "INITIALIZE_CAMPAIGN_WORLD_SIMULATION" }
        }]
      };
      const batch = {
        ...batchBase,
        batchFingerprint:
          await computeJsonFingerprint(batchBase) as `sha256:${string}`
      };
      const operationId =
        opaqueId<OperationId>(`world-simulation:init:${input.campaignId}`);
      const existing = await input.repository.getOperation(operationId);
      if (existing.ok && existing.value.phase === "COMPLETED") {
        return restoreSnapshot({ ...input, worldStateAggregateId });
      }
      if (!existing.ok && existing.error.code !== "NOT_FOUND") return existing;
      if (existing.ok) {
        return {
          ok: false,
          error: coreError(
            "CAMPAIGN_BUSY",
            "campaign.world-simulation.initialization-incomplete"
          )
        };
      }
      const operation = await createOperation({
        campaignId: input.campaignId,
        campaignRevision: campaign.value.campaignRevision,
        operationId,
        clientRequestId: `world-simulation:init:${input.campaignId}`,
        batchFingerprint: batch.batchFingerprint,
        createdAt: clock.now().toISOString()
      });
      const received = await input.repository.receiveOperation(operation);
      if (!received.ok) return received;
      const preparing = await input.repository.transitionOperation(
        operationId,
        "RECEIVED",
        "PREPARING"
      );
      if (!preparing.ok) return preparing;
      const ready = await input.repository.transitionOperation(
        operationId,
        "PREPARING",
        "READY_TO_COMMIT"
      );
      if (!ready.ok) return ready;
      const lease = await input.repository.acquireWriterLease(
        input.campaignId,
        opaqueId<WriterId>(`${operationId}:writer`),
        120_000
      );
      if (!lease.ok) return lease;
      try {
        const prepared = await prepareTemporalSegmentCommitV1({
          campaign: campaign.value,
          operation: ready.value,
          writerLease: lease.value,
          clockAggregate: clockAggregate.value,
          scheduleAggregate: null,
          scheduleAggregateId: input.runtimeBindings.scheduleAggregateId,
          simulationCursorAggregate: null,
          simulationCursorAggregateId:
            input.runtimeBindings.simulationCursorAggregateId,
          worldStateAggregate: null,
          worldStateAggregateId,
          initialWorldState: input.initialWorldState,
          processAggregate: null,
          processAggregateId: input.runtimeBindings.processAggregateId,
          nextProcess: null,
          batch,
          resolutions: [{
            taskId: batch.orderedTasks[0]!.taskId,
            outcome: "RESOLVED",
            eventId: opaqueId<EventId>(`${operationId}:event`),
            eventType: "world.simulation-initialized",
            origin: "SYSTEM",
            visibility: { scope: "SYSTEM", actorIds: [] },
            payload: { initialized: true }
          }],
          newEffects: [],
          commitId: opaqueId<CommitId>(`${operationId}:commit`),
          commandId: opaqueId<CommandId>(`${operationId}:command`)
        });
        if (!prepared.ok) return temporalFailure(
          "campaign.world-simulation.initialization-invalid",
          prepared.diagnostics
        );
        const committed = await input.repository.commit(prepared.value);
        if (!committed.ok) return committed;
        const completed = await input.repository.completePresentation(
          operationId,
          "COMMITTED_RENDERED",
          1,
          { schemaVersion: 1, status: "WORLD_SIMULATION_INITIALIZED" }
        );
        if (!completed.ok) return completed;
      } finally {
        await input.repository.releaseWriterLease(lease.value);
      }
      return restoreSnapshot({ ...input, worldStateAggregateId });
    },

    restore() {
      return restoreSnapshot({ ...input, worldStateAggregateId });
    },

    async advance(command) {
      if (
        !command.clientRequestId.trim()
        || !Number.isInteger(command.hours)
        || command.hours < 1
        || command.hours > 24
      ) {
        return {
          ok: false,
          error: coreError(
            "VALIDATION_FAILED",
            "campaign.world-simulation.advance-invalid"
          )
        };
      }
      const operationId = opaqueId<OperationId>(
        `world-simulation:advance:${normalize(command.clientRequestId)}`
      );
      const existing = await input.repository.getOperation(operationId);
      if (
        existing.ok
        && existing.value.phase === "COMPLETED"
        && existing.value.resultPayload !== null
      ) {
        const result = existing.value.resultPayload as unknown as
          CampaignWorldSimulationAdvanceResultV1;
        return {
          ok: true,
          value: { ...result, replayed: true }
        };
      }
      if (!existing.ok && existing.error.code !== "NOT_FOUND") return existing;
      if (existing.ok) {
        return {
          ok: false,
          error: coreError(
            "CAMPAIGN_BUSY",
            "campaign.world-simulation.advance-incomplete"
          )
        };
      }
      const initialized = await this.ensureInitialized();
      if (!initialized.ok) return initialized;
      const campaign = await input.repository.getCampaign(input.campaignId);
      if (!campaign.ok) return campaign;
      const [
        clockAggregate,
        schedule,
        cursor,
        worldState
      ] = await Promise.all([
        input.repository.getAggregate(
          input.campaignId,
          "world.clock",
          campaign.value.clockAggregateId
        ),
        readOptionalPrototypeAggregateV1(
          input.repository,
          input.campaignId,
          "world.schedule",
          input.runtimeBindings.scheduleAggregateId
        ),
        input.repository.getAggregate(
          input.campaignId,
          "world.simulation-cursor",
          input.runtimeBindings.simulationCursorAggregateId
        ),
        input.repository.getAggregate(
          input.campaignId,
          "world.state",
          worldStateAggregateId
        )
      ]);
      if (!clockAggregate.ok) return clockAggregate;
      if (!schedule.ok) return schedule;
      if (!cursor.ok) return cursor;
      if (!worldState.ok) return worldState;
      const currentGameSecond =
        Number(clockAggregate.value.payload.elapsedGameSeconds);
      const requestedTargetGameSecond =
        currentGameSecond + command.hours * 3_600;
      const simulationTarget =
        Math.floor(requestedTargetGameSecond / 3_600) * 3_600;
      const cursorValue =
        validateWorldSimulationCursorPayloadV1(cursor.value.payload);
      if (!cursorValue.ok) {
        return temporalFailure(
          "campaign.world-simulation.cursor-invalid",
          cursorValue.diagnostics
        );
      }
      const hoursToProcess =
        (simulationTarget - cursorValue.value.worldSimulatedThrough) / 3_600;
      if (!Number.isInteger(hoursToProcess) || hoursToProcess < 1) {
        return {
          ok: false,
          error: coreError(
            "VALIDATION_FAILED",
            "campaign.world-simulation.cursor-ahead-or-unaligned"
          )
        };
      }
      if (schedule.value !== null) {
        const validatedSchedule =
          validateWorldSchedulePayloadV1(schedule.value.payload);
        if (!validatedSchedule.ok) {
          return temporalFailure(
            "campaign.world-simulation.schedule-invalid",
            validatedSchedule.diagnostics
          );
        }
        if (validatedSchedule.value.effects.some(effect =>
          effect.status === "SCHEDULED"
          && effect.dueAtGameSecond <= requestedTargetGameSecond
        )) {
          return {
            ok: false,
            error: coreError(
              "VALIDATION_FAILED",
              "campaign.world-simulation.owner-boundary-due"
            )
          };
        }
      }
      const task: TemporalTaskV1 = {
        schemaVersion: 1,
        taskId: `${operationId}:world-boundary`,
        taskKind: "WORLD_SIMULATION_BOUNDARY",
        dueAtGameSecond: requestedTargetGameSecond,
        boundaryPolicy: "BEFORE_ACTIVITY_COMPLETION",
        dependsOnTaskIds: [],
        payload: { worldSimulatedThrough: simulationTarget }
      };
      const planned = await planNextTemporalBatchV1({
        batchId: `${operationId}:batch`,
        currentGameSecond,
        requestedTargetGameSecond,
        tasks: [task]
      });
      if (!planned.ok || planned.value === null) {
        return temporalFailure(
          "campaign.world-simulation.temporal-plan-invalid",
          planned.ok ? [] : planned.diagnostics
        );
      }
      const simulation = await adapter.simulate({
        schemaVersion: 1,
        simulationId: `${operationId}:simulation`,
        currentGameSecond: cursorValue.value.worldSimulatedThrough,
        targetGameSecond: simulationTarget,
        hoursToProcess,
        cursor: cursorValue.value,
        worldStateFingerprint:
          await computeJsonFingerprint(
            worldState.value.payload
          ) as `sha256:${string}`,
        worldState: worldState.value.payload
      });
      if (!simulation.ok) {
        return temporalFailure(
          "campaign.world-simulation.adapter-failed",
          simulation.diagnostics
        );
      }
      const operation = await createOperation({
        campaignId: input.campaignId,
        campaignRevision: campaign.value.campaignRevision,
        operationId,
        clientRequestId: command.clientRequestId,
        batchFingerprint: planned.value.batchFingerprint,
        createdAt: clock.now().toISOString()
      });
      const received = await input.repository.receiveOperation(operation);
      if (!received.ok) return received;
      const preparing = await input.repository.transitionOperation(
        operationId,
        "RECEIVED",
        "PREPARING"
      );
      if (!preparing.ok) return preparing;
      const ready = await input.repository.transitionOperation(
        operationId,
        "PREPARING",
        "READY_TO_COMMIT"
      );
      if (!ready.ok) return ready;
      const lease = await input.repository.acquireWriterLease(
        input.campaignId,
        opaqueId<WriterId>(`${operationId}:writer`),
        120_000
      );
      if (!lease.ok) return lease;
      const sourceEventId =
        opaqueId<EventId>(`${operationId}:event`);
      try {
        const prepared = await prepareTemporalSegmentCommitV1({
          campaign: campaign.value,
          operation: ready.value,
          writerLease: lease.value,
          clockAggregate: clockAggregate.value,
          scheduleAggregate: schedule.value,
          scheduleAggregateId: input.runtimeBindings.scheduleAggregateId,
          simulationCursorAggregate: cursor.value,
          simulationCursorAggregateId:
            input.runtimeBindings.simulationCursorAggregateId,
          worldStateAggregate: worldState.value,
          worldStateAggregateId,
          simulationResult: simulation.value,
          processAggregate: null,
          processAggregateId: input.runtimeBindings.processAggregateId,
          nextProcess: null,
          batch: planned.value,
          resolutions: [{
            taskId: task.taskId,
            outcome: "RESOLVED",
            eventId: sourceEventId,
            eventType: "world.simulation-boundary.resolved",
            origin: "WORLD_SIMULATION",
            visibility: { scope: "SYSTEM", actorIds: [] },
            payload: {
              requestedHours: command.hours,
              processedHours: hoursToProcess
            }
          }],
          newEffects: [],
          commitId: opaqueId<CommitId>(`${operationId}:commit`),
          commandId: opaqueId<CommandId>(`${operationId}:command`)
        });
        if (!prepared.ok) return temporalFailure(
          "campaign.world-simulation.commit-invalid",
          prepared.diagnostics
        );
        const committed = await input.repository.commit(prepared.value);
        if (!committed.ok) return committed;
        const snapshot: CampaignWorldSimulationSnapshotV1 = {
          schemaVersion: 1,
          elapsedGameSeconds: requestedTargetGameSecond,
          worldSimulatedThrough: simulationTarget,
          worldState: simulation.value.worldState,
          lastTickOutput: simulation.value.tickOutput
        };
        const result: CampaignWorldSimulationAdvanceResultV1 = {
          schemaVersion: 1,
          snapshot,
          sourceOperationId: operationId,
          sourceEventId,
          replayed: false
        };
        const completed = await input.repository.completePresentation(
          operationId,
          "COMMITTED_RENDERED",
          1,
          result
        );
        if (!completed.ok) return completed;
        return { ok: true, value: result };
      } finally {
        await input.repository.releaseWriterLease(lease.value);
      }
    }
  };
}

async function restoreSnapshot(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  runtimeBindings: CampaignRuntimeBindingsV1;
  worldStateAggregateId: AggregateId;
}): Promise<Result<CampaignWorldSimulationSnapshotV1>> {
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const [clock, cursor, worldState] = await Promise.all([
    input.repository.getAggregate(
      input.campaignId,
      "world.clock",
      campaign.value.clockAggregateId
    ),
    input.repository.getAggregate(
      input.campaignId,
      "world.simulation-cursor",
      input.runtimeBindings.simulationCursorAggregateId
    ),
    input.repository.getAggregate(
      input.campaignId,
      "world.state",
      input.worldStateAggregateId
    )
  ]);
  if (!clock.ok) return clock;
  if (!cursor.ok) return cursor;
  if (!worldState.ok) return worldState;
  const validated =
    validateWorldSimulationCursorPayloadV1(cursor.value.payload);
  if (!validated.ok) {
    return temporalFailure(
      "campaign.world-simulation.cursor-invalid",
      validated.diagnostics
    );
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      elapsedGameSeconds:
        Number(clock.value.payload.elapsedGameSeconds),
      worldSimulatedThrough: validated.value.worldSimulatedThrough,
      worldState: worldState.value.payload,
      lastTickOutput: null
    }
  };
}

async function createOperation(input: {
  campaignId: CampaignId;
  campaignRevision: number;
  operationId: OperationId;
  clientRequestId: string;
  batchFingerprint: string;
  createdAt: string;
}): Promise<OperationRecord> {
  const requestPayload = {
    batchFingerprint: input.batchFingerprint
  };
  return {
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(
      `${input.operationId}:idempotency`
    ),
    requestFingerprint:
      await computeRequestFingerprint("time.segment", 1, requestPayload),
    operationKind: "time.segment",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: input.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

function temporalFailure(
  messageKey: string,
  diagnostics: Array<{
    code: string;
    path: string;
    details: JsonObject;
  }>
): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, {
      diagnostics: diagnostics.map(value => ({
        code: value.code,
        path: value.path,
        details: value.details
      }))
    })
  };
}

function normalize(value: string): string {
  return value.normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}
