import { cloneJson, computeRequestFingerprint } from "../canonical-json/canonicalJson";
import type {
  AcceptedCommandRecord,
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
  EventId,
  EventRecord,
  IdempotencyKey,
  JsonObject,
  OperationId,
  OperationPhase,
  OperationRecord,
  OperationTransitionPatch,
  OutboxTaskRecord,
  RepositoryClock,
  Result,
  TaskId,
  WorkerId,
  WriterId,
  WriterLease
} from "../contracts/types";
import { coreError, err, ok } from "../errors";
import {
  CORE_LIMITS,
  validateAcceptedCommandRecord,
  validateAggregateRecord,
  validateCampaignRecord,
  validateClockPayload,
  validateCommitRecord,
  validateCommitRequest,
  validateCoreError,
  validateEventRecord,
  validateOperationRecord,
  validateOutboxTaskRecord,
  validateWriterLease,
  type ValidationResult
} from "../validation/validate";
import type { CampaignRepository } from "./CampaignRepository";

const MAX_LEASE_MS = 5 * 60 * 1000;

export type CommitFailurePoint =
  | "AFTER_AGGREGATES"
  | "AFTER_COMMANDS"
  | "AFTER_EVENTS"
  | "AFTER_OUTBOX"
  | "BEFORE_PUBLISH";

export interface MemoryCampaignRepositoryOptions {
  clock?: RepositoryClock;
  maximumPageSize?: number;
  failureInjector?: (point: CommitFailurePoint) => void;
}

interface MemoryState {
  campaigns: Map<string, CampaignRecord>;
  aggregates: Map<string, AggregateRecord>;
  operations: Map<string, OperationRecord>;
  operationByIdempotency: Map<string, string>;
  activeOperationByCampaign: Map<string, string>;
  commands: Map<string, AcceptedCommandRecord>;
  events: Map<string, EventRecord>;
  eventOrderByCampaign: Map<string, string[]>;
  commits: Map<string, CommitRecord>;
  commitByIdempotency: Map<string, string>;
  outbox: Map<string, OutboxTaskRecord>;
  claimableOutboxByCampaign: Map<string, Set<string>>;
  activeLeases: Map<string, WriterLease>;
  fencingTokens: Map<string, number>;
}

const systemClock: RepositoryClock = { now: () => new Date() };

function emptyState(): MemoryState {
  return {
    campaigns: new Map(),
    aggregates: new Map(),
    operations: new Map(),
    operationByIdempotency: new Map(),
    activeOperationByCampaign: new Map(),
    commands: new Map(),
    events: new Map(),
    eventOrderByCampaign: new Map(),
    commits: new Map(),
    commitByIdempotency: new Map(),
    outbox: new Map(),
    claimableOutboxByCampaign: new Map(),
    activeLeases: new Map(),
    fencingTokens: new Map()
  };
}

function copyState(state: MemoryState): MemoryState {
  return {
    campaigns: new Map(state.campaigns),
    aggregates: new Map(state.aggregates),
    operations: new Map(state.operations),
    operationByIdempotency: new Map(state.operationByIdempotency),
    activeOperationByCampaign: new Map(state.activeOperationByCampaign),
    commands: new Map(state.commands),
    events: new Map(state.events),
    eventOrderByCampaign: new Map(
      [...state.eventOrderByCampaign].map(([campaignId, eventIds]) => [campaignId, eventIds.slice()])
    ),
    commits: new Map(state.commits),
    commitByIdempotency: new Map(state.commitByIdempotency),
    outbox: new Map(state.outbox),
    claimableOutboxByCampaign: new Map(
      [...state.claimableOutboxByCampaign].map(([campaignId, taskIds]) => [campaignId, new Set(taskIds)])
    ),
    activeLeases: new Map(state.activeLeases),
    fencingTokens: new Map(state.fencingTokens)
  };
}

function aggregateKey(campaignId: string, aggregateType: string, aggregateId: string): string {
  return `${campaignId}\u0000${aggregateType}\u0000${aggregateId}`;
}

function idempotencyKey(campaignId: string, key: string): string {
  return `${campaignId}\u0000${key}`;
}

function validationFailure<T>(result: ValidationResult): Result<T> {
  const issues = result.valid ? [] : result.issues;
  return err(coreError("VALIDATION_FAILED", "core.validation.failed", { issues }));
}

function notFound<T>(kind: string, id: string): Result<T> {
  return err(coreError("NOT_FOUND", "core.record.not-found", { kind, id }));
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function compareEventPosition(event: EventRecord, cursor: EventCursor): number {
  if (event.commitSequence !== cursor.commitSequence) return event.commitSequence - cursor.commitSequence;
  return event.eventSequence - cursor.eventSequence;
}

const OPERATION_TRANSITIONS: Readonly<Record<OperationPhase, readonly OperationPhase[]>> = {
  RECEIVED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_TO_COMMIT", "SUSPENDED", "FAILED", "STALE", "CANCELLED"],
  SUSPENDED: ["PREPARING", "CANCELLED"],
  READY_TO_COMMIT: ["COMMITTED_PENDING_RENDER", "FAILED", "STALE", "CANCELLED"],
  COMMITTED_PENDING_RENDER: ["COMPLETED"],
  COMPLETED: [],
  FAILED: [],
  STALE: [],
  CANCELLED: []
};

export class MemoryCampaignRepository implements CampaignRepository {
  private state = emptyState();
  private readonly clock: RepositoryClock;
  private readonly maximumPageSize: number;
  private readonly failureInjector?: (point: CommitFailurePoint) => void;

  constructor(options: MemoryCampaignRepositoryOptions = {}) {
    this.clock = options.clock ?? systemClock;
    this.maximumPageSize = Math.min(options.maximumPageSize ?? CORE_LIMITS.pageItems, CORE_LIMITS.pageItems);
    this.failureInjector = options.failureInjector;
  }

  private now(): Date {
    return this.clock.now();
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private inject(point: CommitFailurePoint): void {
    this.failureInjector?.(point);
  }

  async createCampaign(record: CampaignRecord, initialClockPayload: CampaignClockPayload): Promise<Result<CampaignRecord>> {
    const recordValidation = validateCampaignRecord(record);
    if (!recordValidation.valid) return validationFailure(recordValidation);
    const clockValidation = validateClockPayload(initialClockPayload);
    if (!clockValidation.valid) return validationFailure(clockValidation);
    if (
      record.campaignRevision !== 0 ||
      record.status !== "ACTIVE" ||
      record.writeBlock !== null ||
      record.lastCommitId !== null ||
      initialClockPayload.elapsedGameSeconds !== 0 ||
      initialClockPayload.calendarId !== record.dependencies.calendarId ||
      initialClockPayload.calendarVersion !== record.dependencies.calendarVersion
    ) {
      return err(coreError("VALIDATION_FAILED", "core.campaign.invalid-bootstrap"));
    }
    if (this.state.campaigns.has(record.campaignId)) {
      return err(coreError("ALREADY_EXISTS", "core.campaign.already-exists", { campaignId: record.campaignId }));
    }

    const clockRecord: AggregateRecord = {
      schemaVersion: 1,
      campaignId: record.campaignId,
      aggregateType: "world.clock",
      aggregateId: record.clockAggregateId,
      aggregateRevision: 0,
      payloadSchemaVersion: 1,
      payload: cloneJson(initialClockPayload),
      updatedByCommitId: null
    };
    const aggregateValidation = validateAggregateRecord(clockRecord);
    if (!aggregateValidation.valid) return validationFailure(aggregateValidation);

    const next = copyState(this.state);
    next.campaigns.set(record.campaignId, cloneJson(record));
    next.aggregates.set(
      aggregateKey(record.campaignId, "world.clock", record.clockAggregateId),
      cloneJson(clockRecord)
    );
    this.state = next;
    return ok(cloneJson(record));
  }

  async getCampaign(campaignId: CampaignId): Promise<Result<CampaignRecord>> {
    const record = this.state.campaigns.get(campaignId);
    return record ? ok(cloneJson(record)) : notFound("campaign", campaignId);
  }

  async setCampaignReadOnly(campaignId: CampaignId, writeBlock: CampaignWriteBlock): Promise<Result<CampaignRecord>> {
    const current = this.state.campaigns.get(campaignId);
    if (!current) return notFound("campaign", campaignId);
    if (current.status === "READ_ONLY") return ok(cloneJson(current));
    const updated: CampaignRecord = {
      ...current,
      status: "READ_ONLY",
      writeBlock,
      updatedAt: this.nowIso()
    };
    const validation = validateCampaignRecord(updated);
    if (!validation.valid) return validationFailure(validation);
    const stored = cloneJson(updated);
    this.state.campaigns.set(campaignId, stored);
    return ok(cloneJson(stored));
  }

  async acquireWriterLease(campaignId: CampaignId, writerId: WriterId, ttlMs: number): Promise<Result<WriterLease>> {
    const campaign = this.state.campaigns.get(campaignId);
    if (!campaign) return notFound("campaign", campaignId);
    if (campaign.status === "READ_ONLY") return err(coreError("CAMPAIGN_READ_ONLY", "core.campaign.read-only"));
    if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_LEASE_MS) {
      return err(coreError("VALIDATION_FAILED", "core.lease.invalid-ttl", { ttlMs }));
    }

    const now = this.now();
    const active = this.state.activeLeases.get(campaignId);
    if (active && Date.parse(active.expiresAt) > now.getTime() && active.writerId !== writerId) {
      return err(coreError("CAMPAIGN_BUSY", "core.campaign.writer-busy"));
    }

    const fencingToken = (this.state.fencingTokens.get(campaignId) ?? 0) + 1;
    const lease: WriterLease = {
      campaignId,
      writerId,
      fencingToken,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString()
    };
    const validation = validateWriterLease(lease);
    if (!validation.valid) return validationFailure(validation);
    this.state.fencingTokens.set(campaignId, fencingToken);
    this.state.activeLeases.set(campaignId, lease);
    return ok(cloneJson(lease));
  }

  async releaseWriterLease(lease: WriterLease): Promise<Result<void>> {
    const active = this.state.activeLeases.get(lease.campaignId);
    if (!active) return ok(undefined);
    if (active.writerId !== lease.writerId || active.fencingToken !== lease.fencingToken) {
      return err(coreError("STALE_FENCING_TOKEN", "core.lease.stale"));
    }
    this.state.activeLeases.delete(lease.campaignId);
    return ok(undefined);
  }

  async receiveOperation(record: OperationRecord): Promise<Result<OperationRecord>> {
    const validation = validateOperationRecord(record);
    if (!validation.valid) return validationFailure(validation);
    const expectedFingerprint = await computeRequestFingerprint(
      record.operationKind,
      record.requestPayloadSchemaVersion,
      record.requestPayload
    );
    if (expectedFingerprint !== record.requestFingerprint) {
      return err(coreError("VALIDATION_FAILED", "core.operation.fingerprint-mismatch"));
    }
    const campaign = this.state.campaigns.get(record.campaignId);
    if (!campaign) return notFound("campaign", record.campaignId);

    const lookupKey = idempotencyKey(record.campaignId, record.idempotencyKey);
    const existingId = this.state.operationByIdempotency.get(lookupKey);
    if (existingId) {
      const existing = this.state.operations.get(existingId)!;
      if (existing.requestFingerprint !== record.requestFingerprint) {
        return err(coreError("IDEMPOTENCY_CONFLICT", "core.operation.idempotency-conflict"));
      }
      return ok(cloneJson(existing));
    }
    if (campaign.status === "READ_ONLY") return err(coreError("CAMPAIGN_READ_ONLY", "core.campaign.read-only"));
    if (this.state.operations.has(record.operationId)) {
      return err(coreError("ALREADY_EXISTS", "core.operation.already-exists", { operationId: record.operationId }));
    }
    const activeOperationId = this.state.activeOperationByCampaign.get(record.campaignId);
    if (activeOperationId) {
      return err(coreError("CAMPAIGN_BUSY", "core.operation.campaign-busy", {
        activeOperationId
      }));
    }
    if (record.phase !== "RECEIVED" || record.observedCampaignRevision !== campaign.campaignRevision) {
      return err(coreError("STALE_VERSION", "core.operation.invalid-initial-version"));
    }
    this.state.operations.set(record.operationId, cloneJson(record));
    this.state.operationByIdempotency.set(lookupKey, record.operationId);
    this.state.activeOperationByCampaign.set(record.campaignId, record.operationId);
    return ok(cloneJson(record));
  }

  async getOperation(operationId: OperationId): Promise<Result<OperationRecord>> {
    const record = this.state.operations.get(operationId);
    return record ? ok(cloneJson(record)) : notFound("operation", operationId);
  }

  async getOperationByIdempotencyKey(
    campaignId: CampaignId,
    key: IdempotencyKey
  ): Promise<Result<OperationRecord>> {
    const operationId = this.state.operationByIdempotency.get(idempotencyKey(campaignId, key));
    return operationId ? this.getOperation(operationId as OperationId) : notFound("operation", key);
  }

  async transitionOperation(
    operationId: OperationId,
    expectedPhase: OperationPhase,
    nextPhase: OperationPhase,
    patch: OperationTransitionPatch = {}
  ): Promise<Result<OperationRecord>> {
    const current = this.state.operations.get(operationId);
    if (!current) return notFound("operation", operationId);
    if (current.phase !== expectedPhase || !OPERATION_TRANSITIONS[current.phase].includes(nextPhase)) {
      return err(coreError("INVALID_TRANSITION", "core.operation.invalid-transition", {
        actualPhase: current.phase,
        expectedPhase,
        nextPhase
      }));
    }
    if (nextPhase === "COMMITTED_PENDING_RENDER" || nextPhase === "COMPLETED") {
      return err(coreError("INVALID_TRANSITION", "core.operation.reserved-transition"));
    }
    if (nextPhase === "FAILED" && !patch.failure) {
      return err(coreError("VALIDATION_FAILED", "core.operation.failure-required"));
    }
    if (nextPhase !== "FAILED" && patch.failure) {
      return err(coreError("VALIDATION_FAILED", "core.operation.failure-forbidden"));
    }
    const updated: OperationRecord = {
      ...current,
      phase: nextPhase,
      failure: nextPhase === "FAILED" ? patch.failure ?? null : null,
      updatedAt: this.nowIso()
    };
    const validation = validateOperationRecord(updated);
    if (!validation.valid) return validationFailure(validation);
    const stored = cloneJson(updated);
    this.state.operations.set(operationId, stored);
    if (nextPhase === "FAILED" || nextPhase === "STALE" || nextPhase === "CANCELLED") {
      this.state.activeOperationByCampaign.delete(current.campaignId);
    }
    return ok(cloneJson(stored));
  }

  async completeWithoutCommit(
    operationId: OperationId,
    resultSchemaVersion: number,
    resultPayload: JsonObject
  ): Promise<Result<OperationRecord>> {
    const current = this.state.operations.get(operationId);
    if (!current) return notFound("operation", operationId);
    if (current.phase !== "RECEIVED" && current.phase !== "PREPARING") {
      return err(coreError("INVALID_TRANSITION", "core.operation.cannot-complete-without-commit"));
    }
    const updated: OperationRecord = {
      ...current,
      phase: "COMPLETED",
      completionMode: "NO_COMMIT_RESPONSE",
      resultPayloadSchemaVersion: resultSchemaVersion,
      resultPayload,
      updatedAt: this.nowIso()
    };
    const validation = validateOperationRecord(updated);
    if (!validation.valid) return validationFailure(validation);
    const stored = cloneJson(updated);
    this.state.operations.set(operationId, stored);
    this.state.activeOperationByCampaign.delete(current.campaignId);
    return ok(cloneJson(stored));
  }

  async completePresentation(
    operationId: OperationId,
    completionMode: Extract<CompletionMode, "COMMITTED_RENDERED" | "COMMITTED_DEGRADED">,
    resultSchemaVersion: number,
    resultPayload: JsonObject
  ): Promise<Result<OperationRecord>> {
    const current = this.state.operations.get(operationId);
    if (!current) return notFound("operation", operationId);
    if (current.phase !== "COMMITTED_PENDING_RENDER") {
      return err(coreError("INVALID_TRANSITION", "core.operation.cannot-complete-presentation"));
    }
    const updated: OperationRecord = {
      ...current,
      phase: "COMPLETED",
      completionMode,
      resultPayloadSchemaVersion: resultSchemaVersion,
      resultPayload,
      updatedAt: this.nowIso()
    };
    const validation = validateOperationRecord(updated);
    if (!validation.valid) return validationFailure(validation);
    const stored = cloneJson(updated);
    this.state.operations.set(operationId, stored);
    this.state.activeOperationByCampaign.delete(current.campaignId);
    return ok(cloneJson(stored));
  }

  async getAggregate(campaignId: CampaignId, aggregateType: string, aggregateId: string): Promise<Result<AggregateRecord>> {
    const record = this.state.aggregates.get(aggregateKey(campaignId, aggregateType, aggregateId));
    return record ? ok(cloneJson(record)) : notFound("aggregate", aggregateId);
  }

  async commit(request: CommitRequest): Promise<Result<CommitRecord>> {
    const validation = validateCommitRequest(request);
    if (!validation.valid) return validationFailure(validation);

    const campaign = this.state.campaigns.get(request.campaignId);
    if (!campaign) return notFound("campaign", request.campaignId);
    const operation = this.state.operations.get(request.operationId);
    if (!operation) return notFound("operation", request.operationId);
    if (
      operation.campaignId !== request.campaignId ||
      operation.idempotencyKey !== request.idempotencyKey ||
      operation.requestFingerprint !== request.requestFingerprint
    ) {
      return err(coreError("IDEMPOTENCY_CONFLICT", "core.commit.operation-mismatch"));
    }

    const lookupKey = idempotencyKey(request.campaignId, request.idempotencyKey);
    const existingCommitId = this.state.commitByIdempotency.get(lookupKey);
    if (existingCommitId) {
      const existing = this.state.commits.get(existingCommitId)!;
      return existing.requestFingerprint === request.requestFingerprint
        ? ok(cloneJson(existing))
        : err(coreError("IDEMPOTENCY_CONFLICT", "core.commit.idempotency-conflict"));
    }

    if (campaign.status === "READ_ONLY") return err(coreError("CAMPAIGN_READ_ONLY", "core.campaign.read-only"));
    if (operation.phase !== "READY_TO_COMMIT") {
      return err(coreError("INVALID_TRANSITION", "core.commit.operation-not-ready", { phase: operation.phase }));
    }
    const leaseError = this.validateActiveLease(request.writerLease);
    if (leaseError) return err(leaseError);
    if (request.expectedCampaignRevision !== campaign.campaignRevision) {
      return err(coreError("STALE_VERSION", "core.commit.campaign-revision-stale", {
        expected: request.expectedCampaignRevision,
        actual: campaign.campaignRevision
      }));
    }
    if (this.state.commits.has(request.commitId)) {
      return err(coreError("ALREADY_EXISTS", "core.commit.id-already-exists", { commitId: request.commitId }));
    }

    const duplicateError = this.validateUniqueRequestIds(request);
    if (duplicateError) return err(duplicateError);

    try {
      const next = copyState(this.state);
      const nextRevision = campaign.campaignRevision + 1;
      const aggregateWrites = [] as CommitRecord["aggregateWrites"];
      const writtenAggregateKeys = new Set<string>();

      for (const write of request.aggregateWrites) {
        const key = aggregateKey(request.campaignId, write.aggregateType, write.aggregateId);
        if (writtenAggregateKeys.has(key)) {
          return err(coreError("VALIDATION_FAILED", "core.commit.duplicate-aggregate-write", { aggregateId: write.aggregateId }));
        }
        writtenAggregateKeys.add(key);
        const current = this.state.aggregates.get(key);
        const actualRevision = current?.aggregateRevision ?? null;
        if (actualRevision !== write.expectedAggregateRevision) {
          return err(coreError("STALE_VERSION", "core.commit.aggregate-revision-stale", {
            aggregateId: write.aggregateId,
            expected: write.expectedAggregateRevision,
            actual: actualRevision
          }));
        }
        const aggregateRevision = current ? current.aggregateRevision + 1 : 0;
        const record: AggregateRecord = {
          schemaVersion: 1,
          campaignId: request.campaignId,
          aggregateType: write.aggregateType,
          aggregateId: write.aggregateId,
          aggregateRevision,
          payloadSchemaVersion: write.payloadSchemaVersion,
          payload: cloneJson(write.payload),
          updatedByCommitId: request.commitId
        };
        const aggregateValidation = validateAggregateRecord(record);
        if (!aggregateValidation.valid) return validationFailure(aggregateValidation);
        const clockError = this.validateClockWrite(campaign, current, record);
        if (clockError) return err(clockError);
        next.aggregates.set(key, record);
        aggregateWrites.push({
          aggregateType: write.aggregateType,
          aggregateId: write.aggregateId,
          previousRevision: actualRevision,
          aggregateRevision
        });
      }
      this.inject("AFTER_AGGREGATES");

      const resultingClock = next.aggregates.get(aggregateKey(
        request.campaignId,
        "world.clock",
        campaign.clockAggregateId
      ))!;
      const resultingGameSecond = (resultingClock.payload as CampaignClockPayload).elapsedGameSeconds;

      for (const draft of request.acceptedCommands) {
        if (
          draft.campaignId !== request.campaignId ||
          draft.operationId !== request.operationId
        ) {
          return err(coreError("VALIDATION_FAILED", "core.command.scope-mismatch", { commandId: draft.commandId }));
        }
        const matchingWrite = request.aggregateWrites.find(write =>
          write.aggregateType === draft.target.aggregateType &&
          write.aggregateId === draft.target.aggregateId &&
          write.expectedAggregateRevision === draft.target.expectedAggregateRevision
        );
        if (!matchingWrite) {
          return err(coreError("VALIDATION_FAILED", "core.command.target-not-written", { commandId: draft.commandId }));
        }
        if (draft.acceptedAtGameSecond > resultingGameSecond) {
          return err(coreError("VALIDATION_FAILED", "core.command.future-acceptance", { commandId: draft.commandId }));
        }
        const record: AcceptedCommandRecord = { ...cloneJson(draft), commitId: request.commitId };
        const commandValidation = validateAcceptedCommandRecord(record);
        if (!commandValidation.valid) return validationFailure(commandValidation);
        next.commands.set(record.commandId, record);
      }
      this.inject("AFTER_COMMANDS");

      const eventIdsInCommit = new Set(request.events.map(event => event.eventId));
      const processedEventIds = new Set<EventId>();
      const commandIdsInCommit = new Set(request.acceptedCommands.map(command => command.commandId));
      request.events.forEach((draft, eventSequence) => {
        if (draft.campaignId !== request.campaignId || draft.operationId !== request.operationId) {
          throw new CommitValidationError("core.event.scope-mismatch", { eventId: draft.eventId });
        }
        if (draft.occurredAtGameSecond > resultingGameSecond) {
          throw new CommitValidationError("core.event.future-occurrence", { eventId: draft.eventId });
        }
        for (const ref of draft.aggregateRefs) {
          const aggregate = next.aggregates.get(aggregateKey(request.campaignId, ref.aggregateType, ref.aggregateId));
          if (!aggregate || aggregate.aggregateRevision !== ref.aggregateRevision) {
            throw new CommitValidationError("core.event.aggregate-ref-invalid", { eventId: draft.eventId, aggregateId: ref.aggregateId });
          }
        }
        const causationExists =
          (draft.causation.kind === "COMMAND" && (commandIdsInCommit.has(draft.causation.id as never) || this.state.commands.has(draft.causation.id))) ||
          (draft.causation.kind === "EVENT" && (processedEventIds.has(draft.causation.id as EventId) || this.state.events.has(draft.causation.id))) ||
          (draft.causation.kind === "OPERATION" && draft.causation.id === request.operationId);
        if (!causationExists) {
          throw new CommitValidationError("core.event.causation-invalid", { eventId: draft.eventId });
        }
        const record: EventRecord = {
          ...cloneJson(draft),
          commitId: request.commitId,
          recordedAt: this.nowIso(),
          commitSequence: nextRevision,
          eventSequence
        };
        const eventValidation = validateEventRecord(record);
        if (!eventValidation.valid) throw new CommitValidationError("core.event.invalid", { issues: eventValidation.issues });
        next.events.set(record.eventId, record);
        const campaignEvents = next.eventOrderByCampaign.get(request.campaignId) ?? [];
        campaignEvents.push(record.eventId);
        next.eventOrderByCampaign.set(request.campaignId, campaignEvents);
        processedEventIds.add(record.eventId);
      });
      this.inject("AFTER_EVENTS");

      for (const draft of request.outboxTasks) {
        if (draft.sourceEventIds.some(eventId => !eventIdsInCommit.has(eventId))) {
          return err(coreError("VALIDATION_FAILED", "core.outbox.source-event-invalid", { taskId: draft.taskId }));
        }
        const now = this.nowIso();
        const record: OutboxTaskRecord = {
          ...cloneJson(draft),
          campaignId: request.campaignId,
          commitId: request.commitId,
          status: "PENDING",
          attemptCount: 0,
          lockedBy: null,
          leaseExpiresAt: null,
          nextAttemptAt: null,
          lastError: null,
          createdAt: now,
          updatedAt: now
        };
        const taskValidation = validateOutboxTaskRecord(record);
        if (!taskValidation.valid) return validationFailure(taskValidation);
        next.outbox.set(record.taskId, record);
        const claimable = next.claimableOutboxByCampaign.get(request.campaignId) ?? new Set<string>();
        claimable.add(record.taskId);
        next.claimableOutboxByCampaign.set(request.campaignId, claimable);
      }
      this.inject("AFTER_OUTBOX");

      const committedAt = this.nowIso();
      const commit: CommitRecord = {
        schemaVersion: 1,
        commitId: request.commitId,
        campaignId: request.campaignId,
        operationId: request.operationId,
        idempotencyKey: request.idempotencyKey,
        requestFingerprint: request.requestFingerprint,
        previousCampaignRevision: campaign.campaignRevision,
        campaignRevision: nextRevision,
        commitSequence: nextRevision,
        commandIds: request.acceptedCommands.map(command => command.commandId),
        eventIds: request.events.map(event => event.eventId),
        aggregateWrites,
        outboxTaskIds: request.outboxTasks.map(task => task.taskId),
        committedAt
      };
      const commitValidation = validateCommitRecord(commit);
      if (!commitValidation.valid) return validationFailure(commitValidation);

      next.commits.set(commit.commitId, commit);
      next.commitByIdempotency.set(lookupKey, commit.commitId);
      next.campaigns.set(campaign.campaignId, {
        ...campaign,
        campaignRevision: nextRevision,
        lastCommitId: commit.commitId,
        updatedAt: committedAt
      });
      next.operations.set(operation.operationId, {
        ...operation,
        phase: "COMMITTED_PENDING_RENDER",
        commitId: commit.commitId,
        updatedAt: committedAt
      });

      this.inject("BEFORE_PUBLISH");
      this.state = next;
      return ok(cloneJson(commit));
    } catch (error) {
      if (error instanceof CommitValidationError) {
        return err(coreError("VALIDATION_FAILED", error.messageKey, error.details));
      }
      return err(coreError("PERSISTENCE_FAILURE", "core.commit.persistence-failure"));
    }
  }

  private validateActiveLease(lease: WriterLease): CoreError | null {
    const validation = validateWriterLease(lease);
    if (!validation.valid) return coreError("VALIDATION_FAILED", "core.lease.invalid", { issues: validation.issues });
    const active = this.state.activeLeases.get(lease.campaignId);
    if (
      !active ||
      active.writerId !== lease.writerId ||
      active.fencingToken !== lease.fencingToken ||
      Date.parse(active.expiresAt) <= this.now().getTime()
    ) {
      return coreError("STALE_FENCING_TOKEN", "core.lease.stale");
    }
    return null;
  }

  private validateUniqueRequestIds(request: CommitRequest): CoreError | null {
    const commandIds = request.acceptedCommands.map(command => command.commandId);
    const eventIds = request.events.map(event => event.eventId);
    const taskIds = request.outboxTasks.map(task => task.taskId);
    if (!unique(commandIds) || !unique(eventIds) || !unique(taskIds)) {
      return coreError("VALIDATION_FAILED", "core.commit.duplicate-id");
    }
    if (commandIds.some(id => this.state.commands.has(id)) || eventIds.some(id => this.state.events.has(id)) || taskIds.some(id => this.state.outbox.has(id))) {
      return coreError("ALREADY_EXISTS", "core.commit.record-id-already-exists");
    }
    return null;
  }

  private validateClockWrite(
    campaign: CampaignRecord,
    previous: AggregateRecord | undefined,
    next: AggregateRecord
  ): CoreError | null {
    const isClockId = next.aggregateId === campaign.clockAggregateId;
    const isClockType = next.aggregateType === "world.clock";
    if (isClockId !== isClockType) return coreError("VALIDATION_FAILED", "core.clock.identity-mismatch");
    if (!isClockType) return null;
    if (next.payloadSchemaVersion !== 1) return coreError("VALIDATION_FAILED", "core.clock.schema-version-invalid");
    const validation = validateClockPayload(next.payload);
    if (!validation.valid) return coreError("VALIDATION_FAILED", "core.clock.payload-invalid", { issues: validation.issues });
    const payload = next.payload as CampaignClockPayload;
    const previousSecond = previous ? (previous.payload as CampaignClockPayload).elapsedGameSeconds : 0;
    if (payload.elapsedGameSeconds < previousSecond) return coreError("VALIDATION_FAILED", "core.clock.not-monotonic");
    if (
      payload.calendarId !== campaign.dependencies.calendarId ||
      payload.calendarVersion !== campaign.dependencies.calendarVersion
    ) return coreError("VALIDATION_FAILED", "core.clock.calendar-mismatch");
    return null;
  }

  async getCommit(commitId: CommitId): Promise<Result<CommitRecord>> {
    const commit = this.state.commits.get(commitId);
    return commit ? ok(cloneJson(commit)) : notFound("commit", commitId);
  }

  async getCommitByIdempotencyKey(
    campaignId: CampaignId,
    key: IdempotencyKey
  ): Promise<Result<CommitRecord>> {
    const commitId = this.state.commitByIdempotency.get(idempotencyKey(campaignId, key));
    return commitId ? this.getCommit(commitId as CommitId) : notFound("commit", key);
  }

  async listEvents(campaignId: CampaignId, after: EventCursor | null, limit: number): Promise<Result<EventRecord[]>> {
    if (!Number.isInteger(limit) || limit <= 0 || limit > this.maximumPageSize) {
      return err(coreError("VALIDATION_FAILED", "core.pagination.invalid-limit", { limit }));
    }
    if (!this.state.campaigns.has(campaignId)) return notFound("campaign", campaignId);
    const eventIds = this.state.eventOrderByCampaign.get(campaignId) ?? [];
    let start = 0;
    if (after) {
      let low = 0;
      let high = eventIds.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const event = this.state.events.get(eventIds[middle])!;
        if (compareEventPosition(event, after) <= 0) low = middle + 1;
        else high = middle;
      }
      start = low;
    }
    const records = eventIds
      .slice(start, start + limit)
      .map(eventId => cloneJson(this.state.events.get(eventId)!));
    return ok(records);
  }

  async claimOutboxTasks(
    campaignId: CampaignId,
    workerId: WorkerId,
    limit: number,
    leaseMs: number
  ): Promise<Result<OutboxTaskRecord[]>> {
    if (!Number.isInteger(limit) || limit <= 0 || limit > this.maximumPageSize || !Number.isInteger(leaseMs) || leaseMs <= 0 || leaseMs > MAX_LEASE_MS) {
      return err(coreError("VALIDATION_FAILED", "core.outbox.invalid-claim"));
    }
    if (!this.state.campaigns.has(campaignId)) return notFound("campaign", campaignId);
    const now = this.now();
    const claimableIds = this.state.claimableOutboxByCampaign.get(campaignId) ?? new Set<string>();
    const eligible = [...claimableIds]
      .map(taskId => this.state.outbox.get(taskId)!)
      .filter(task => (
        task.status === "PENDING" ||
        (task.status === "FAILED_RETRYABLE" && Date.parse(task.nextAttemptAt!) <= now.getTime()) ||
        (task.status === "RUNNING" && Date.parse(task.leaseExpiresAt!) <= now.getTime())
      ))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.taskId.localeCompare(b.taskId))
      .slice(0, limit);

    const claimed = eligible.map(task => {
      const updated: OutboxTaskRecord = {
        ...task,
        status: "RUNNING",
        attemptCount: task.attemptCount + 1,
        lockedBy: workerId,
        leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
        nextAttemptAt: null,
        updatedAt: now.toISOString()
      };
      this.state.outbox.set(task.taskId, updated);
      return cloneJson(updated);
    });
    return ok(claimed);
  }

  async completeOutboxTask(taskId: TaskId, workerId: WorkerId): Promise<Result<OutboxTaskRecord>> {
    const task = this.state.outbox.get(taskId);
    if (!task) return notFound("outbox-task", taskId);
    if (task.status === "COMPLETED") return ok(cloneJson(task));
    const leaseError = this.validateTaskWorker(task, workerId);
    if (leaseError) return err(leaseError);
    const updated: OutboxTaskRecord = {
      ...task,
      status: "COMPLETED",
      lockedBy: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      lastError: null,
      updatedAt: this.nowIso()
    };
    const stored = cloneJson(updated);
    this.state.outbox.set(taskId, stored);
    this.state.claimableOutboxByCampaign.get(task.campaignId)?.delete(taskId);
    return ok(cloneJson(stored));
  }

  async failOutboxTask(
    taskId: TaskId,
    workerId: WorkerId,
    error: CoreError,
    retryAt: string | null
  ): Promise<Result<OutboxTaskRecord>> {
    const task = this.state.outbox.get(taskId);
    if (!task) return notFound("outbox-task", taskId);
    const leaseError = this.validateTaskWorker(task, workerId);
    if (leaseError) return err(leaseError);
    const errorValidation = validateCoreError(error);
    if (!errorValidation.valid) return validationFailure(errorValidation);
    const retryable = error.retry !== "NEVER";
    if (retryable && (!retryAt || !Number.isFinite(Date.parse(retryAt)))) {
      return err(coreError("VALIDATION_FAILED", "core.outbox.retry-at-required"));
    }
    if (!retryable && retryAt !== null) {
      return err(coreError("VALIDATION_FAILED", "core.outbox.retry-at-forbidden"));
    }
    const updated: OutboxTaskRecord = {
      ...task,
      status: retryable ? "FAILED_RETRYABLE" : "FAILED_FINAL",
      lockedBy: null,
      leaseExpiresAt: null,
      nextAttemptAt: retryable ? new Date(retryAt!).toISOString() : null,
      lastError: cloneJson(error),
      updatedAt: this.nowIso()
    };
    const validation = validateOutboxTaskRecord(updated);
    if (!validation.valid) return validationFailure(validation);
    const stored = cloneJson(updated);
    this.state.outbox.set(taskId, stored);
    if (updated.status === "FAILED_FINAL") {
      this.state.claimableOutboxByCampaign.get(task.campaignId)?.delete(taskId);
    }
    return ok(cloneJson(stored));
  }

  private validateTaskWorker(task: OutboxTaskRecord, workerId: WorkerId): CoreError | null {
    if (
      task.status !== "RUNNING" ||
      task.lockedBy !== workerId ||
      task.leaseExpiresAt === null ||
      Date.parse(task.leaseExpiresAt) <= this.now().getTime()
    ) return coreError("STALE_FENCING_TOKEN", "core.outbox.worker-lease-stale");
    return null;
  }
}

class CommitValidationError extends Error {
  constructor(
    readonly messageKey: string,
    readonly details: JsonObject = {}
  ) {
    super(messageKey);
  }
}
