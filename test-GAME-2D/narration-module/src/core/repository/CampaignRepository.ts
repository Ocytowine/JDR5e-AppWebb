import type {
  AggregateId,
  AggregateRecord,
  CampaignClockPayload,
  CampaignId,
  CampaignRecord,
  CampaignWriteBlock,
  CommitId,
  CommitRecord,
  CommitRequest,
  CompletionMode,
  CoreError,
  EventCursor,
  EventRecord,
  IdempotencyKey,
  JsonObject,
  OperationId,
  OperationPhase,
  OperationRecord,
  OperationTransitionPatch,
  OutboxTaskRecord,
  Result,
  TaskId,
  WorkerId,
  WriterId,
  WriterLease
} from "../contracts/types";

export interface CampaignRepository {
  createCampaign(record: CampaignRecord, initialClockPayload: CampaignClockPayload): Promise<Result<CampaignRecord>>;
  getCampaign(campaignId: CampaignId): Promise<Result<CampaignRecord>>;
  setCampaignReadOnly(campaignId: CampaignId, writeBlock: CampaignWriteBlock): Promise<Result<CampaignRecord>>;

  acquireWriterLease(campaignId: CampaignId, writerId: WriterId, ttlMs: number): Promise<Result<WriterLease>>;
  releaseWriterLease(lease: WriterLease): Promise<Result<void>>;

  receiveOperation(record: OperationRecord): Promise<Result<OperationRecord>>;
  getOperation(operationId: OperationId): Promise<Result<OperationRecord>>;
  getOperationByIdempotencyKey(campaignId: CampaignId, idempotencyKey: IdempotencyKey): Promise<Result<OperationRecord>>;
  listOperations(campaignId: CampaignId, operationKind: string | null, limit: number): Promise<Result<OperationRecord[]>>;
  transitionOperation(
    operationId: OperationId,
    expectedPhase: OperationPhase,
    nextPhase: OperationPhase,
    patch?: OperationTransitionPatch
  ): Promise<Result<OperationRecord>>;
  completeWithoutCommit(
    operationId: OperationId,
    resultSchemaVersion: number,
    resultPayload: JsonObject
  ): Promise<Result<OperationRecord>>;
  completePresentation(
    operationId: OperationId,
    completionMode: Extract<CompletionMode, "COMMITTED_RENDERED" | "COMMITTED_DEGRADED">,
    resultSchemaVersion: number,
    resultPayload: JsonObject
  ): Promise<Result<OperationRecord>>;

  getAggregate(campaignId: CampaignId, aggregateType: string, aggregateId: AggregateId): Promise<Result<AggregateRecord>>;
  commit(request: CommitRequest): Promise<Result<CommitRecord>>;
  getCommit(commitId: CommitId): Promise<Result<CommitRecord>>;
  getCommitByIdempotencyKey(campaignId: CampaignId, idempotencyKey: IdempotencyKey): Promise<Result<CommitRecord>>;
  listEvents(campaignId: CampaignId, after: EventCursor | null, limit: number): Promise<Result<EventRecord[]>>;

  claimOutboxTasks(
    campaignId: CampaignId,
    workerId: WorkerId,
    limit: number,
    leaseMs: number
  ): Promise<Result<OutboxTaskRecord[]>>;
  completeOutboxTask(taskId: TaskId, workerId: WorkerId): Promise<Result<OutboxTaskRecord>>;
  failOutboxTask(
    taskId: TaskId,
    workerId: WorkerId,
    error: CoreError,
    retryAt: string | null
  ): Promise<Result<OutboxTaskRecord>>;
}
