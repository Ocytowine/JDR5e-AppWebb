import type { CampaignId, GameSecond, JsonObject, Revision } from "../core/contracts/types";

export type TimeAdvanceCategoryV1 =
  | "FIXED_RULE"
  | "DETERMINISTIC_CALCULATION"
  | "OPEN_ESTIMATE"
  | "PROCESS_SEGMENT"
  | "NO_GAME_TIME";

export type TemporalBoundaryPolicyV1 =
  | "BEFORE_ACTIVITY_COMPLETION"
  | "SIMULTANEOUS"
  | "AFTER_ACTIVITY_COMPLETION";

export interface TimeAdvanceProposalV1 {
  schemaVersion: 1;
  proposalId: string;
  campaignId: CampaignId;
  requesterDomain: string;
  category: TimeAdvanceCategoryV1;
  observedAtGameSecond: GameSecond;
  duration: {
    recommendedSeconds: number;
    minimumSeconds: number;
    maximumSeconds: number;
  };
  source: {
    kind: "RULE" | "CALCULATION" | "ADJUDICATION" | "PROCESS" | "NONE";
    id: string | null;
    version: number | null;
  };
  cause: { kind: "OPERATION" | "EVENT" | "PROCESS"; id: string };
  processId: string | null;
  interruptible: boolean;
  dependencies: Array<{
    aggregateType: string;
    aggregateId: string;
    aggregateRevision: Revision;
  }>;
}

export interface ValidatedTimeAdvanceV1 {
  schemaVersion: 1;
  proposalId: string;
  campaignId: CampaignId;
  currentGameSecond: GameSecond;
  durationSeconds: number;
  targetGameSecond: GameSecond;
  category: TimeAdvanceCategoryV1;
  interruptible: boolean;
  processId: string | null;
}

export interface ScheduledEffectV1 {
  schemaVersion: 1;
  effectId: string;
  campaignId: CampaignId;
  ownerDomain: string;
  effectType: string;
  dueAtGameSecond: GameSecond;
  boundaryPolicy: TemporalBoundaryPolicyV1;
  dependsOnEffectIds: string[];
  causedByEventIds: string[];
  status: "SCHEDULED" | "RESOLVED" | "CANCELLED" | "EXPIRED";
  payloadSchemaVersion: number;
  payload: JsonObject;
}

export interface TemporalTaskV1 {
  schemaVersion: 1;
  taskId: string;
  taskKind: "SCHEDULED_EFFECT" | "WORLD_SIMULATION_BOUNDARY" | "PROCESS_BOUNDARY" | "ACTIVITY_COMPLETION";
  dueAtGameSecond: GameSecond;
  boundaryPolicy: TemporalBoundaryPolicyV1;
  dependsOnTaskIds: string[];
  payload: JsonObject;
}

export interface TemporalBatchV1 {
  schemaVersion: 1;
  batchId: string;
  currentGameSecond: GameSecond;
  requestedTargetGameSecond: GameSecond;
  effectiveAtGameSecond: GameSecond;
  orderedTasks: TemporalTaskV1[];
  batchFingerprint: `sha256:${string}`;
}

export type TemporalDiagnosticCodeV1 =
  | "TIME_PROPOSAL_INVALID"
  | "TIME_PROPOSAL_STALE"
  | "TEMPORAL_WINDOW_INVALID"
  | "TEMPORAL_TASK_INVALID"
  | "TEMPORAL_TASK_PAST"
  | "TEMPORAL_DEPENDENCY_MISSING"
  | "TEMPORAL_DEPENDENCY_CYCLE"
  | "TEMPORAL_PERSISTENCE_INVALID"
  | "TEMPORAL_SEGMENT_INVALID"
  | "TEMPORAL_SIMULATION_ADAPTER_REQUIRED"
  | "WORLD_SIMULATION_INVALID"
  | "WORLD_SIMULATION_FAILED";

export interface TemporalDiagnosticV1 {
  code: TemporalDiagnosticCodeV1;
  path: string;
  details: JsonObject;
}

export type TemporalResultV1<T> =
  | { ok: true; value: T }
  | { ok: false; diagnostics: TemporalDiagnosticV1[] };
