import type { JsonObject } from "../core";

export const ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1 = "orchestration-event-router/1" as const;
export const ORCHESTRATION_EVENT_TASK_TYPE_V1 = "orchestration.event.route" as const;
export const REST_LIFECYCLE_SIGNAL_HOOK_ID_V1 = "rest.lifecycle-signal/1" as const;

export type OrchestrationRoutableEventTypeV1 =
  | "rest_interrupted"
  | "rest_completed_pending_benefits";

export interface OrchestrationRestInterruptionV1 extends JsonObject {
  interrupted: boolean;
  reason: string | null;
  segmentIndex: number | null;
}

export interface OrchestrationEventEnvelopeV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof ORCHESTRATION_EVENT_ROUTER_CONTRACT_VERSION_V1;
  sourceEventId: string;
  eventType: OrchestrationRoutableEventTypeV1;
  sourceDomain: "REST";
  processId: string;
  processStatus: "INTERRUPTED" | "COMPLETED_PENDING_BENEFITS";
  elapsedRestSeconds: number;
  checkpointFingerprint: string;
  pendingBenefitCount: number;
  interruption: OrchestrationRestInterruptionV1;
}
