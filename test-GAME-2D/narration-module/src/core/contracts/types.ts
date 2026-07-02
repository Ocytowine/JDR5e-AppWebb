export type JsonScalar = null | boolean | string | number;
export type JsonValue = JsonScalar | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

type Brand<Name extends string> = string & { readonly __brand: Name };

export type CampaignId = Brand<"CampaignId">;
export type OperationId = Brand<"OperationId">;
export type CommandId = Brand<"CommandId">;
export type EventId = Brand<"EventId">;
export type CommitId = Brand<"CommitId">;
export type AggregateId = Brand<"AggregateId">;
export type TaskId = Brand<"TaskId">;
export type RequestId = Brand<"RequestId">;
export type IdempotencyKey = Brand<"IdempotencyKey">;
export type WriterId = Brand<"WriterId">;
export type WorkerId = Brand<"WorkerId">;
export type IncidentId = Brand<"IncidentId">;

export type Revision = number;
export type GameSecond = number;
export type UtcInstant = string;

export const OPERATION_PHASES = [
  "RECEIVED",
  "PREPARING",
  "READY_TO_COMMIT",
  "COMMITTED_PENDING_RENDER",
  "COMPLETED",
  "SUSPENDED",
  "FAILED",
  "STALE",
  "CANCELLED"
] as const;
export type OperationPhase = (typeof OPERATION_PHASES)[number];

export const COMPLETION_MODES = [
  "COMMITTED_RENDERED",
  "COMMITTED_DEGRADED",
  "NO_COMMIT_RESPONSE"
] as const;
export type CompletionMode = (typeof COMPLETION_MODES)[number];

export const CORE_ERROR_CODES = [
  "NOT_FOUND",
  "ALREADY_EXISTS",
  "VALIDATION_FAILED",
  "INVALID_TRANSITION",
  "CAMPAIGN_BUSY",
  "CAMPAIGN_READ_ONLY",
  "STALE_VERSION",
  "STALE_FENCING_TOKEN",
  "IDEMPOTENCY_CONFLICT",
  "PERSISTENCE_FAILURE",
  "CAMPAIGN_INTEGRITY_FAILURE"
] as const;
export type CoreErrorCode = (typeof CORE_ERROR_CODES)[number];

export const CORE_ERROR_CATEGORIES = [
  "VALIDATION",
  "CONCURRENCY",
  "PERSISTENCE",
  "INTEGRITY"
] as const;
export type CoreErrorCategory = (typeof CORE_ERROR_CATEGORIES)[number];

export const RETRY_POLICIES = ["NEVER", "SAME_REQUEST", "AFTER_REFRESH"] as const;
export type RetryPolicy = (typeof RETRY_POLICIES)[number];

export interface CoreError {
  code: CoreErrorCode;
  category: CoreErrorCategory;
  retry: RetryPolicy;
  messageKey: string;
  details: JsonObject;
  incidentId: IncidentId | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: CoreError };

export interface CampaignDependencies {
  contentPackageId: string;
  contentPackageVersion: number;
  rulesetId: string;
  rulesetVersion: number;
  calendarId: string;
  calendarVersion: number;
}

export interface CampaignWriteBlock {
  code: "CAMPAIGN_INTEGRITY_FAILURE" | "MANUAL_LOCK";
  incidentId: IncidentId | null;
}

export interface CampaignRecord {
  schemaVersion: 1;
  campaignId: CampaignId;
  campaignRevision: Revision;
  status: "ACTIVE" | "READ_ONLY";
  clockAggregateId: AggregateId;
  dependencies: CampaignDependencies;
  writeBlock: CampaignWriteBlock | null;
  lastCommitId: CommitId | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface AggregateRecord {
  schemaVersion: 1;
  campaignId: CampaignId;
  aggregateType: string;
  aggregateId: AggregateId;
  aggregateRevision: Revision;
  payloadSchemaVersion: number;
  payload: JsonObject;
  updatedByCommitId: CommitId | null;
}

export interface CampaignClockPayload extends JsonObject {
  elapsedGameSeconds: GameSecond;
  calendarId: string;
  calendarVersion: number;
}

export interface OperationRecord {
  schemaVersion: 1;
  operationId: OperationId;
  campaignId: CampaignId;
  clientRequestId: RequestId;
  idempotencyKey: IdempotencyKey;
  requestFingerprint: string;
  operationKind: string;
  requestPayloadSchemaVersion: number;
  requestPayload: JsonObject;
  phase: OperationPhase;
  observedCampaignRevision: Revision;
  commitId: CommitId | null;
  completionMode: CompletionMode | null;
  resultPayloadSchemaVersion: number | null;
  resultPayload: JsonObject | null;
  failure: CoreError | null;
  receivedAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface CommandTarget {
  aggregateType: string;
  aggregateId: AggregateId;
  expectedAggregateRevision: Revision | null;
}

export interface AcceptedCommandDraft {
  schemaVersion: 1;
  contractId: string;
  contractVersion: number;
  commandId: CommandId;
  campaignId: CampaignId;
  operationId: OperationId;
  commandType: string;
  target: CommandTarget;
  payloadSchemaVersion: number;
  payload: JsonObject;
  acceptedAtGameSecond: GameSecond;
}

export interface AcceptedCommandRecord extends AcceptedCommandDraft {
  commitId: CommitId;
}

export const EVENT_ORIGINS = [
  "PLAYER_INTENT",
  "RULE",
  "WORLD_SIMULATION",
  "AI_PROPOSAL",
  "PROCESS",
  "SCHEDULED_EFFECT",
  "SYSTEM"
] as const;
export type EventOrigin = (typeof EVENT_ORIGINS)[number];

export type CausationKind = "COMMAND" | "EVENT" | "OPERATION";

export interface EventAggregateRef {
  aggregateType: string;
  aggregateId: AggregateId;
  aggregateRevision: Revision;
}

export interface EventVisibility {
  scope: "SYSTEM" | "MJ_PRIVATE" | "PLAYER_VISIBLE" | "ACTOR_SCOPED";
  actorIds: string[];
}

export interface EventCausation {
  kind: CausationKind;
  id: string;
}

export interface EventDraft {
  schemaVersion: 1;
  eventId: EventId;
  campaignId: CampaignId;
  operationId: OperationId;
  eventType: string;
  origin: EventOrigin;
  causation: EventCausation;
  aggregateRefs: EventAggregateRef[];
  visibility: EventVisibility;
  occurredAtGameSecond: GameSecond;
  payloadSchemaVersion: number;
  payload: JsonObject;
}

export interface EventRecord extends EventDraft {
  commitId: CommitId;
  recordedAt: UtcInstant;
  commitSequence: number;
  eventSequence: number;
}

export const OUTBOX_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED_RETRYABLE",
  "FAILED_FINAL"
] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export interface OutboxTaskDraft {
  schemaVersion: 1;
  taskId: TaskId;
  taskType: string;
  sourceEventIds: EventId[];
  payloadSchemaVersion: number;
  payload: JsonObject;
}

export interface OutboxTaskRecord extends OutboxTaskDraft {
  campaignId: CampaignId;
  commitId: CommitId;
  status: OutboxStatus;
  attemptCount: number;
  lockedBy: WorkerId | null;
  leaseExpiresAt: UtcInstant | null;
  nextAttemptAt: UtcInstant | null;
  lastError: CoreError | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
}

export interface AggregateWrite {
  aggregateType: string;
  aggregateId: AggregateId;
  expectedAggregateRevision: Revision | null;
  payloadSchemaVersion: number;
  payload: JsonObject;
}

export interface CommitAggregateWrite {
  aggregateType: string;
  aggregateId: AggregateId;
  previousRevision: Revision | null;
  aggregateRevision: Revision;
}

export interface CommitRecord {
  schemaVersion: 1;
  commitId: CommitId;
  campaignId: CampaignId;
  operationId: OperationId;
  idempotencyKey: IdempotencyKey;
  requestFingerprint: string;
  previousCampaignRevision: Revision;
  campaignRevision: Revision;
  commitSequence: number;
  commandIds: CommandId[];
  eventIds: EventId[];
  aggregateWrites: CommitAggregateWrite[];
  outboxTaskIds: TaskId[];
  committedAt: UtcInstant;
}

export interface WriterLease {
  campaignId: CampaignId;
  writerId: WriterId;
  fencingToken: number;
  acquiredAt: UtcInstant;
  expiresAt: UtcInstant;
}

export interface CommitRequest {
  campaignId: CampaignId;
  operationId: OperationId;
  commitId: CommitId;
  idempotencyKey: IdempotencyKey;
  requestFingerprint: string;
  expectedCampaignRevision: Revision;
  writerLease: WriterLease;
  acceptedCommands: AcceptedCommandDraft[];
  aggregateWrites: AggregateWrite[];
  events: EventDraft[];
  outboxTasks: OutboxTaskDraft[];
}

export interface EventCursor {
  commitSequence: number;
  eventSequence: number;
}

export interface OperationTransitionPatch {
  failure?: CoreError | null;
}

export interface RepositoryClock {
  now(): Date;
}

export interface IdGenerator {
  next(prefix: string): string;
}

export function opaqueId<T extends string>(value: string): T {
  return value as T;
}
