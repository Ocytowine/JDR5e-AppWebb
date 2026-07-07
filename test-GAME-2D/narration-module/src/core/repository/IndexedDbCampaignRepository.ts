import { cloneJson, computeJsonFingerprint, computeRequestFingerprint } from "../canonical-json/canonicalJson";
import type { CampaignBootstrapRepository } from "../../bootstrap/persistence/CampaignBootstrapRepository";
import type {
  BootstrapFailurePoint,
  CampaignBootstrapPersistenceRequestV1,
  CampaignBootstrapPersistenceResultV1
} from "../../bootstrap/persistence/types";
import { validateCampaignBootstrapPersistenceRequestV1 } from "../../bootstrap/persistence/validateBootstrapPersistence";
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
import { cursorPage, cursorValues, deleteDatabase, openDatabase, requestResult, runTransaction } from "./indexeddb/idb";
import {
  DEFAULT_DATABASE_NAME,
  STORAGE_SCHEMA_VERSION,
  STORES,
  claimableAtFor,
  upgradeDatabase,
  type CampaignControlRecord,
  type CampaignGenerationRecord,
  type CampaignHeadRecord,
  type DirectoryEntityKind,
  type IdDirectoryRecord,
  type RepositoryMetaRecord,
  type StoredAggregate,
  type StoredCampaign,
  type StoredCommand,
  type StoredCommit,
  type StoredEvent,
  type StoredOperation,
  type StoredOutboxTask
} from "./indexeddb/schema";

const MAX_LEASE_MS = 5 * 60 * 1000;
const TERMINAL_PHASES: readonly OperationPhase[] = ["COMPLETED", "FAILED", "STALE", "CANCELLED"];
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

export type IndexedDbFailurePoint = BootstrapFailurePoint
  | "AFTER_AGGREGATES"
  | "AFTER_COMMANDS"
  | "AFTER_EVENTS"
  | "AFTER_OUTBOX"
  | "BEFORE_COMMIT_COMPLETE"
  | "AFTER_MIGRATION_STORE"
  | "BEFORE_MIGRATION_ACTIVATION"
  | "AFTER_MIGRATION_ACTIVATION";

export type MigrationDataStore =
  | "campaigns"
  | "aggregates"
  | "operations"
  | "commands"
  | "events"
  | "commits"
  | "outbox";

export interface CampaignStorageMigrationOptions {
  campaignId: CampaignId;
  ownerId: WriterId;
  leaseMs?: number;
  batchSize?: number;
  requiredFreeBytes?: number;
  transform?: (store: MigrationDataStore, record: unknown) => unknown | Promise<unknown>;
}

export interface CampaignStorageMigrationReport {
  campaignId: CampaignId;
  sourceGenerationId: string;
  targetGenerationId: string;
  copiedRecords: Record<MigrationDataStore, number>;
  activatedAt: string;
}

export interface CampaignStorageState {
  head: CampaignHeadRecord;
  generations: CampaignGenerationRecord[];
}

export interface BrowserStorageEstimate {
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
  ratio: number | null;
  warning: boolean;
}

export interface IndexedDbCampaignRepositoryOptions {
  databaseName?: string;
  indexedDB?: IDBFactory;
  clock?: RepositoryClock;
  maximumPageSize?: number;
  failureInjector?: (point: IndexedDbFailurePoint) => void;
  onBlocked?: () => void;
}

interface ActiveCampaignContext {
  head: CampaignHeadRecord;
  campaign: CampaignRecord;
  control: CampaignControlRecord;
}

const systemClock: RepositoryClock = { now: () => new Date() };

function validationFailure<T>(result: ValidationResult): Result<T> {
  return err(coreError("VALIDATION_FAILED", "core.validation.failed", {
    issues: result.valid ? [] : result.issues
  }));
}

function notFound<T>(kind: string, id: string): Result<T> {
  return err(coreError("NOT_FOUND", "core.record.not-found", { kind, id }));
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function randomId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "") ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random.toLowerCase()}`;
}

function directoryKey(kind: DirectoryEntityKind, id: string): [DirectoryEntityKind, string] {
  return [kind, id];
}

function storedOutbox(generationId: string, record: OutboxTaskRecord): StoredOutboxTask {
  const claimableAt = claimableAtFor(record);
  return claimableAt
    ? { generationId, campaignId: record.campaignId, claimableAt, record: cloneJson(record) }
    : { generationId, campaignId: record.campaignId, record: cloneJson(record) };
}

export class IndexedDbCampaignRepository implements CampaignRepository, CampaignBootstrapRepository {
  private closed = false;

  private constructor(
    private readonly database: IDBDatabase,
    private readonly factory: IDBFactory,
    readonly databaseName: string,
    private readonly clock: RepositoryClock,
    private readonly maximumPageSize: number,
    private readonly failureInjector?: (point: IndexedDbFailurePoint) => void
  ) {
    database.onversionchange = () => this.close();
  }

  static async open(options: IndexedDbCampaignRepositoryOptions = {}): Promise<IndexedDbCampaignRepository> {
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory) throw new Error("IndexedDB is not available in this environment.");
    const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
    const database = await openDatabase(
      factory,
      databaseName,
      STORAGE_SCHEMA_VERSION,
      upgradeDatabase,
      options.onBlocked
    );
    const repository = new IndexedDbCampaignRepository(
      database,
      factory,
      databaseName,
      options.clock ?? systemClock,
      Math.min(options.maximumPageSize ?? CORE_LIMITS.pageItems, CORE_LIMITS.pageItems),
      options.failureInjector
    );
    await repository.ensureRepositoryMeta();
    return repository;
  }

  static async deleteDatabase(name = DEFAULT_DATABASE_NAME, factory: IDBFactory = globalThis.indexedDB): Promise<void> {
    if (!factory) throw new Error("IndexedDB is not available in this environment.");
    await deleteDatabase(factory, name);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }

  private assertOpen(): void {
    if (this.closed) throw new Error("IndexedDB repository is closed.");
  }

  private now(): Date {
    return this.clock.now();
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private inject(point: IndexedDbFailurePoint): void {
    this.failureInjector?.(point);
  }

  private async ensureRepositoryMeta(): Promise<void> {
    this.assertOpen();
    await runTransaction(this.database, [STORES.repositoryMeta], "readwrite", async transaction => {
      const store = transaction.objectStore(STORES.repositoryMeta);
      const existing = await requestResult<RepositoryMetaRecord | undefined>(store.get("repository"));
      if (existing) {
        if (existing.storageSchemaVersion !== STORAGE_SCHEMA_VERSION) {
          throw new Error("Unsupported IndexedDB storage schema version.");
        }
        return;
      }
      const now = this.nowIso();
      const record: RepositoryMetaRecord = {
        key: "repository",
        storageSchemaVersion: 1,
        installationId: randomId("install"),
        createdAt: now,
        updatedAt: now
      };
      await requestResult(store.add(record));
    });
  }

  private persistenceFailure<T>(): Result<T> {
    return err(coreError("PERSISTENCE_FAILURE", "core.persistence.indexeddb-failure"));
  }

  private async safely<T>(work: () => Promise<Result<T>>): Promise<Result<T>> {
    try {
      this.assertOpen();
      return await work();
    } catch {
      return this.persistenceFailure<T>();
    }
  }

  private async loadActiveContext(
    transaction: IDBTransaction,
    campaignId: CampaignId
  ): Promise<ActiveCampaignContext | null> {
    const head = await requestResult<CampaignHeadRecord | undefined>(
      transaction.objectStore(STORES.campaignHeads).get(campaignId)
    );
    if (!head) return null;
    const storedCampaign = await requestResult<StoredCampaign | undefined>(
      transaction.objectStore(STORES.campaigns).get([head.activeGenerationId, campaignId])
    );
    const control = await requestResult<CampaignControlRecord | undefined>(
      transaction.objectStore(STORES.campaignControls).get(campaignId)
    );
    if (!storedCampaign || !control) throw new Error("Campaign storage is incomplete.");
    return { head, campaign: storedCampaign.record, control };
  }

  private migrationBusy(head: CampaignHeadRecord): CoreError | null {
    return head.migration.state === "IDLE"
      ? null
      : coreError("CAMPAIGN_BUSY", "core.campaign.migration-busy");
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
    ) return err(coreError("VALIDATION_FAILED", "core.campaign.invalid-bootstrap"));

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
    const integrityFingerprint = await computeJsonFingerprint({
      storageSchemaVersion: 1,
      campaigns: [record],
      aggregates: [clockRecord]
    });

    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaignGenerations,
      STORES.campaignControls,
      STORES.idDirectory,
      STORES.campaigns,
      STORES.aggregates
    ], "readwrite", async transaction => {
      const existing = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(record.campaignId)
      );
      if (existing) return err(coreError("ALREADY_EXISTS", "core.campaign.already-exists", {
        campaignId: record.campaignId
      }));

      const now = this.nowIso();
      const generationId = randomId("gen");
      const head: CampaignHeadRecord = {
        campaignId: record.campaignId,
        activeGenerationId: generationId,
        storageSchemaVersion: 1,
        migration: {
          state: "IDLE",
          sourceGenerationId: null,
          targetGenerationId: null,
          ownerId: null,
          leaseExpiresAt: null,
          lastErrorCode: null
        }
      };
      const generation: CampaignGenerationRecord = {
        campaignId: record.campaignId,
        generationId,
        status: "ACTIVE",
        storageSchemaVersion: 1,
        sourceGenerationId: null,
        createdAt: now,
        activatedAt: now,
        verifiedAt: now,
        confirmedAt: now,
        recordCounts: { campaigns: 1, aggregates: 1 },
        integrityFingerprint
      };
      const control: CampaignControlRecord = {
        campaignId: record.campaignId,
        activeOperationId: null,
        writerLease: null,
        fencingToken: 0
      };
      await requestResult(transaction.objectStore(STORES.campaignHeads).add(head));
      await requestResult(transaction.objectStore(STORES.campaignGenerations).add(generation));
      await requestResult(transaction.objectStore(STORES.campaignControls).add(control));
      await requestResult(transaction.objectStore(STORES.campaigns).add({ generationId, record: cloneJson(record) }));
      await requestResult(transaction.objectStore(STORES.aggregates).add({ generationId, record: clockRecord }));
      await requestResult(transaction.objectStore(STORES.idDirectory).add({
        entityKind: "aggregate",
        entityId: clockRecord.aggregateId,
        campaignId: record.campaignId
      } satisfies IdDirectoryRecord));
      return ok(cloneJson(record));
    }));
  }

  async bootstrapCampaign(
    request: CampaignBootstrapPersistenceRequestV1
  ): Promise<Result<CampaignBootstrapPersistenceResultV1>> {
    const validation = validateCampaignBootstrapPersistenceRequestV1(request);
    if (!validation.valid) {
      return err(coreError("VALIDATION_FAILED", "bootstrap.persistence.validation-failed", {
        issues: validation.issues
      }));
    }
    const { campaign, operation, commit } = request;
    const integrityFingerprint = await computeJsonFingerprint({
      storageSchemaVersion: 1,
      campaigns: [campaign],
      aggregates: request.initialAggregates,
      operations: [operation],
      commands: request.acceptedCommands,
      events: request.events,
      commits: [commit],
      outbox: request.outboxTasks
    });
    const stores = [
      STORES.campaignHeads,
      STORES.campaignGenerations,
      STORES.campaignControls,
      STORES.idDirectory,
      STORES.campaigns,
      STORES.aggregates,
      STORES.operations,
      STORES.commands,
      STORES.events,
      STORES.commits,
      STORES.outbox
    ] as const;

    return this.safely(async () => runTransaction(this.database, stores, "readwrite", async transaction => {
      const headStore = transaction.objectStore(STORES.campaignHeads);
      const existingHead = await requestResult<CampaignHeadRecord | undefined>(headStore.get(campaign.campaignId));
      if (existingHead) {
        const generationId = existingHead.activeGenerationId;
        const storedCommit = await requestResult<StoredCommit | undefined>(
          transaction.objectStore(STORES.commits)
            .index("by_campaign_idempotency")
            .get([generationId, campaign.campaignId, operation.idempotencyKey])
        );
        if (storedCommit) {
          const storedCampaign = await requestResult<StoredCampaign | undefined>(
            transaction.objectStore(STORES.campaigns).get([generationId, campaign.campaignId])
          );
          const storedOperation = await requestResult<StoredOperation | undefined>(
            transaction.objectStore(STORES.operations).get([generationId, storedCommit.record.operationId])
          );
          if (
            storedCampaign && storedOperation &&
            storedCommit.record.commitId === commit.commitId &&
            storedCommit.record.operationId === operation.operationId &&
            storedCommit.record.requestFingerprint === operation.requestFingerprint
          ) return ok(cloneJson({
            campaign: storedCampaign.record,
            operation: storedOperation.record,
            commit: storedCommit.record
          }));
        }
        return err(coreError("IDEMPOTENCY_CONFLICT", "bootstrap.persistence.campaign-conflict", {
          campaignId: campaign.campaignId
        }));
      }

      const now = this.nowIso();
      const generationId = randomId("gen");
      const head: CampaignHeadRecord = {
        campaignId: campaign.campaignId,
        activeGenerationId: generationId,
        storageSchemaVersion: 1,
        migration: {
          state: "IDLE",
          sourceGenerationId: null,
          targetGenerationId: null,
          ownerId: null,
          leaseExpiresAt: null,
          lastErrorCode: null
        }
      };
      const generation: CampaignGenerationRecord = {
        campaignId: campaign.campaignId,
        generationId,
        status: "ACTIVE",
        storageSchemaVersion: 1,
        sourceGenerationId: null,
        createdAt: now,
        activatedAt: now,
        verifiedAt: now,
        confirmedAt: now,
        recordCounts: {
          campaigns: 1,
          aggregates: request.initialAggregates.length,
          operations: 1,
          commands: request.acceptedCommands.length,
          events: request.events.length,
          commits: 1,
          outbox: request.outboxTasks.length
        },
        integrityFingerprint
      };
      const control: CampaignControlRecord = {
        campaignId: campaign.campaignId,
        activeOperationId: operation.operationId,
        writerLease: null,
        fencingToken: 0
      };
      await requestResult(headStore.add(head));
      await requestResult(transaction.objectStore(STORES.campaignGenerations).add(generation));
      await requestResult(transaction.objectStore(STORES.campaignControls).add(control));
      await requestResult(transaction.objectStore(STORES.campaigns).add({
        generationId,
        record: cloneJson(campaign)
      } satisfies StoredCampaign));
      this.inject("BOOTSTRAP_AFTER_CAMPAIGN");

      const directoryStore = transaction.objectStore(STORES.idDirectory);
      await requestResult(transaction.objectStore(STORES.operations).add({
        generationId,
        record: cloneJson(operation)
      } satisfies StoredOperation));
      await requestResult(directoryStore.add({
        entityKind: "operation",
        entityId: operation.operationId,
        campaignId: campaign.campaignId
      } satisfies IdDirectoryRecord));
      this.inject("BOOTSTRAP_AFTER_OPERATION");

      const aggregateStore = transaction.objectStore(STORES.aggregates);
      for (const aggregate of request.initialAggregates) {
        await requestResult(aggregateStore.add({ generationId, record: cloneJson(aggregate) } satisfies StoredAggregate));
        await requestResult(directoryStore.add({
          entityKind: "aggregate",
          entityId: aggregate.aggregateId,
          campaignId: campaign.campaignId
        } satisfies IdDirectoryRecord));
      }
      this.inject("BOOTSTRAP_AFTER_AGGREGATES");

      const commandStore = transaction.objectStore(STORES.commands);
      for (const command of request.acceptedCommands) {
        await requestResult(commandStore.add({ generationId, record: cloneJson(command) } satisfies StoredCommand));
        await requestResult(directoryStore.add({
          entityKind: "command",
          entityId: command.commandId,
          campaignId: campaign.campaignId
        } satisfies IdDirectoryRecord));
      }
      this.inject("BOOTSTRAP_AFTER_COMMANDS");

      const eventStore = transaction.objectStore(STORES.events);
      for (const event of request.events) {
        await requestResult(eventStore.add({ generationId, record: cloneJson(event) } satisfies StoredEvent));
        await requestResult(directoryStore.add({
          entityKind: "event",
          entityId: event.eventId,
          campaignId: campaign.campaignId
        } satisfies IdDirectoryRecord));
      }
      this.inject("BOOTSTRAP_AFTER_EVENTS");

      const outboxStore = transaction.objectStore(STORES.outbox);
      for (const task of request.outboxTasks) {
        await requestResult(outboxStore.add(storedOutbox(generationId, task)));
        await requestResult(directoryStore.add({
          entityKind: "task",
          entityId: task.taskId,
          campaignId: campaign.campaignId
        } satisfies IdDirectoryRecord));
      }
      this.inject("BOOTSTRAP_AFTER_OUTBOX");

      await requestResult(transaction.objectStore(STORES.commits).add({
        generationId,
        record: cloneJson(commit)
      } satisfies StoredCommit));
      await requestResult(directoryStore.add({
        entityKind: "commit",
        entityId: commit.commitId,
        campaignId: campaign.campaignId
      } satisfies IdDirectoryRecord));
      this.inject("BOOTSTRAP_AFTER_COMMIT");
      this.inject("BOOTSTRAP_BEFORE_PUBLISH");

      return ok(cloneJson({ campaign, operation, commit }));
    }));
  }

  async getCampaign(campaignId: CampaignId): Promise<Result<CampaignRecord>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaigns,
      STORES.campaignControls
    ], "readonly", async transaction => {
      const context = await this.loadActiveContext(transaction, campaignId);
      return context ? ok(cloneJson(context.campaign)) : notFound("campaign", campaignId);
    }));
  }

  async setCampaignReadOnly(campaignId: CampaignId, writeBlock: CampaignWriteBlock): Promise<Result<CampaignRecord>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaigns,
      STORES.campaignControls
    ], "readwrite", async transaction => {
      const context = await this.loadActiveContext(transaction, campaignId);
      if (!context) return notFound("campaign", campaignId);
      if (context.campaign.status === "READ_ONLY") return ok(cloneJson(context.campaign));
      const busy = this.migrationBusy(context.head);
      if (busy) return err(busy);
      const updated: CampaignRecord = {
        ...context.campaign,
        status: "READ_ONLY",
        writeBlock: cloneJson(writeBlock),
        updatedAt: this.nowIso()
      };
      const validation = validateCampaignRecord(updated);
      if (!validation.valid) return validationFailure(validation);
      await requestResult(transaction.objectStore(STORES.campaigns).put({
        generationId: context.head.activeGenerationId,
        record: updated
      } satisfies StoredCampaign));
      return ok(cloneJson(updated));
    }));
  }

  async acquireWriterLease(campaignId: CampaignId, writerId: WriterId, ttlMs: number): Promise<Result<WriterLease>> {
    if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_LEASE_MS) {
      return err(coreError("VALIDATION_FAILED", "core.lease.invalid-ttl", { ttlMs }));
    }
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaigns,
      STORES.campaignControls
    ], "readwrite", async transaction => {
      const context = await this.loadActiveContext(transaction, campaignId);
      if (!context) return notFound("campaign", campaignId);
      if (context.campaign.status === "READ_ONLY") return err(coreError("CAMPAIGN_READ_ONLY", "core.campaign.read-only"));
      const busy = this.migrationBusy(context.head);
      if (busy) return err(busy);
      const now = this.now();
      const active = context.control.writerLease;
      if (active && Date.parse(active.expiresAt) > now.getTime() && active.writerId !== writerId) {
        return err(coreError("CAMPAIGN_BUSY", "core.campaign.writer-busy"));
      }
      const lease: WriterLease = {
        campaignId,
        writerId,
        fencingToken: context.control.fencingToken + 1,
        acquiredAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + ttlMs).toISOString()
      };
      const validation = validateWriterLease(lease);
      if (!validation.valid) return validationFailure(validation);
      await requestResult(transaction.objectStore(STORES.campaignControls).put({
        ...context.control,
        writerLease: lease,
        fencingToken: lease.fencingToken
      } satisfies CampaignControlRecord));
      return ok(cloneJson(lease));
    }));
  }

  async releaseWriterLease(lease: WriterLease): Promise<Result<void>> {
    return this.safely(async () => runTransaction(this.database, [STORES.campaignControls], "readwrite", async transaction => {
      const store = transaction.objectStore(STORES.campaignControls);
      const control = await requestResult<CampaignControlRecord | undefined>(store.get(lease.campaignId));
      if (!control?.writerLease) return ok(undefined);
      if (
        control.writerLease.writerId !== lease.writerId ||
        control.writerLease.fencingToken !== lease.fencingToken
      ) return err(coreError("STALE_FENCING_TOKEN", "core.lease.stale"));
      await requestResult(store.put({ ...control, writerLease: null } satisfies CampaignControlRecord));
      return ok(undefined);
    }));
  }

  async receiveOperation(record: OperationRecord): Promise<Result<OperationRecord>> {
    const validation = validateOperationRecord(record);
    if (!validation.valid) return validationFailure(validation);
    let expectedFingerprint: string;
    try {
      expectedFingerprint = await computeRequestFingerprint(
        record.operationKind,
        record.requestPayloadSchemaVersion,
        record.requestPayload
      );
    } catch {
      return err(coreError("VALIDATION_FAILED", "core.operation.fingerprint-invalid"));
    }
    if (expectedFingerprint !== record.requestFingerprint) {
      return err(coreError("VALIDATION_FAILED", "core.operation.fingerprint-mismatch"));
    }

    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaigns,
      STORES.campaignControls,
      STORES.idDirectory,
      STORES.operations
    ], "readwrite", async transaction => {
      const context = await this.loadActiveContext(transaction, record.campaignId);
      if (!context) return notFound("campaign", record.campaignId);
      const operations = transaction.objectStore(STORES.operations);
      const existing = await requestResult<StoredOperation | undefined>(
        operations.index("by_campaign_idempotency").get([
          context.head.activeGenerationId,
          record.campaignId,
          record.idempotencyKey
        ])
      );
      if (existing) {
        return existing.record.requestFingerprint === record.requestFingerprint
          ? ok(cloneJson(existing.record))
          : err(coreError("IDEMPOTENCY_CONFLICT", "core.operation.idempotency-conflict"));
      }
      if (context.campaign.status === "READ_ONLY") return err(coreError("CAMPAIGN_READ_ONLY", "core.campaign.read-only"));
      const busy = this.migrationBusy(context.head);
      if (busy) return err(busy);
      const directory = transaction.objectStore(STORES.idDirectory);
      if (await requestResult(directory.get(directoryKey("operation", record.operationId)))) {
        return err(coreError("ALREADY_EXISTS", "core.operation.already-exists", { operationId: record.operationId }));
      }
      if (context.control.activeOperationId) {
        return err(coreError("CAMPAIGN_BUSY", "core.operation.campaign-busy", {
          activeOperationId: context.control.activeOperationId
        }));
      }
      if (record.phase !== "RECEIVED" || record.observedCampaignRevision !== context.campaign.campaignRevision) {
        return err(coreError("STALE_VERSION", "core.operation.invalid-initial-version"));
      }
      await requestResult(operations.add({
        generationId: context.head.activeGenerationId,
        record: cloneJson(record)
      } satisfies StoredOperation));
      await requestResult(directory.add({
        entityKind: "operation",
        entityId: record.operationId,
        campaignId: record.campaignId
      } satisfies IdDirectoryRecord));
      await requestResult(transaction.objectStore(STORES.campaignControls).put({
        ...context.control,
        activeOperationId: record.operationId
      } satisfies CampaignControlRecord));
      return ok(cloneJson(record));
    }));
  }

  async getOperation(operationId: OperationId): Promise<Result<OperationRecord>> {
    return this.getRecordByDirectory<OperationRecord, StoredOperation>("operation", operationId, STORES.operations, "operation");
  }

  async getOperationByIdempotencyKey(
    campaignId: CampaignId,
    idempotencyKey: IdempotencyKey
  ): Promise<Result<OperationRecord>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.operations
    ], "readonly", async transaction => {
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(campaignId)
      );
      if (!head) return notFound("operation", idempotencyKey);
      const stored = await requestResult<StoredOperation | undefined>(
        transaction.objectStore(STORES.operations).index("by_campaign_idempotency").get([
          head.activeGenerationId,
          campaignId,
          idempotencyKey
        ])
      );
      return stored ? ok(cloneJson(stored.record)) : notFound("operation", idempotencyKey);
    }));
  }

  async listOperations(campaignId: CampaignId, operationKind: string | null, limit: number): Promise<Result<OperationRecord[]>> {
    if (!Number.isInteger(limit) || limit <= 0 || limit > this.maximumPageSize) {
      return err(coreError("VALIDATION_FAILED", "core.pagination.invalid-limit", { limit }));
    }
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.operations
    ], "readonly", async transaction => {
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(campaignId)
      );
      if (!head) return notFound("campaign", campaignId);
      const range = IDBKeyRange.bound(
        [head.activeGenerationId, campaignId, ""],
        [head.activeGenerationId, campaignId, "\uffff"]
      );
      const stored = await cursorValues<StoredOperation>(
        transaction.objectStore(STORES.operations).index("by_campaign_operation").openCursor(range, "next"),
        this.maximumPageSize
      );
      const operations = stored
        .map(value => value.record)
        .filter(record => operationKind === null || record.operationKind === operationKind)
        .sort((left, right) => {
          const byReceivedAt = left.receivedAt.localeCompare(right.receivedAt);
          return byReceivedAt !== 0 ? byReceivedAt : left.operationId.localeCompare(right.operationId);
        })
        .slice(0, limit)
        .map(record => cloneJson(record));
      return ok(operations);
    }));
  }

  private async getRecordByDirectory<RecordType, StoredType extends { record: RecordType }>(
    kind: DirectoryEntityKind,
    id: string,
    storeName: string,
    notFoundKind: string
  ): Promise<Result<RecordType>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.idDirectory,
      STORES.campaignHeads,
      storeName
    ], "readonly", async transaction => {
      const directory = await requestResult<IdDirectoryRecord | undefined>(
        transaction.objectStore(STORES.idDirectory).get(directoryKey(kind, id))
      );
      if (!directory) return notFound(notFoundKind, id);
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(directory.campaignId)
      );
      if (!head) return notFound(notFoundKind, id);
      const stored = await requestResult<StoredType | undefined>(
        transaction.objectStore(storeName).get([head.activeGenerationId, id])
      );
      return stored ? ok(cloneJson(stored.record)) : notFound(notFoundKind, id);
    }));
  }

  async transitionOperation(
    operationId: OperationId,
    expectedPhase: OperationPhase,
    nextPhase: OperationPhase,
    patch: OperationTransitionPatch = {}
  ): Promise<Result<OperationRecord>> {
    return this.updateOperation(operationId, current => {
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
      return ok({
        ...current,
        phase: nextPhase,
        failure: nextPhase === "FAILED" ? patch.failure ?? null : null,
        updatedAt: this.nowIso()
      });
    });
  }

  async completeWithoutCommit(
    operationId: OperationId,
    resultSchemaVersion: number,
    resultPayload: JsonObject
  ): Promise<Result<OperationRecord>> {
    return this.updateOperation(operationId, current => {
      if (current.phase !== "RECEIVED" && current.phase !== "PREPARING") {
        return err(coreError("INVALID_TRANSITION", "core.operation.cannot-complete-without-commit"));
      }
      return ok({
        ...current,
        phase: "COMPLETED",
        completionMode: "NO_COMMIT_RESPONSE",
        resultPayloadSchemaVersion: resultSchemaVersion,
        resultPayload,
        updatedAt: this.nowIso()
      });
    });
  }

  async completePresentation(
    operationId: OperationId,
    completionMode: Extract<CompletionMode, "COMMITTED_RENDERED" | "COMMITTED_DEGRADED">,
    resultSchemaVersion: number,
    resultPayload: JsonObject
  ): Promise<Result<OperationRecord>> {
    return this.updateOperation(operationId, current => {
      if (current.phase !== "COMMITTED_PENDING_RENDER") {
        return err(coreError("INVALID_TRANSITION", "core.operation.cannot-complete-presentation"));
      }
      return ok({
        ...current,
        phase: "COMPLETED",
        completionMode,
        resultPayloadSchemaVersion: resultSchemaVersion,
        resultPayload,
        updatedAt: this.nowIso()
      });
    });
  }

  private async updateOperation(
    operationId: OperationId,
    update: (current: OperationRecord) => Result<OperationRecord>
  ): Promise<Result<OperationRecord>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.idDirectory,
      STORES.campaignHeads,
      STORES.campaignControls,
      STORES.operations
    ], "readwrite", async transaction => {
      const directory = await requestResult<IdDirectoryRecord | undefined>(
        transaction.objectStore(STORES.idDirectory).get(directoryKey("operation", operationId))
      );
      if (!directory) return notFound("operation", operationId);
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(directory.campaignId)
      );
      if (!head) return notFound("operation", operationId);
      const busy = this.migrationBusy(head);
      if (busy) return err(busy);
      const operations = transaction.objectStore(STORES.operations);
      const stored = await requestResult<StoredOperation | undefined>(
        operations.get([head.activeGenerationId, operationId])
      );
      if (!stored) return notFound("operation", operationId);
      const outcome = update(cloneJson(stored.record));
      if (!outcome.ok) return outcome;
      const validation = validateOperationRecord(outcome.value);
      if (!validation.valid) return validationFailure(validation);
      await requestResult(operations.put({ generationId: head.activeGenerationId, record: cloneJson(outcome.value) }));
      if (TERMINAL_PHASES.includes(outcome.value.phase)) {
        const controlStore = transaction.objectStore(STORES.campaignControls);
        const control = await requestResult<CampaignControlRecord | undefined>(controlStore.get(directory.campaignId));
        if (!control) throw new Error("Campaign control is missing.");
        if (control.activeOperationId === operationId) {
          await requestResult(controlStore.put({ ...control, activeOperationId: null }));
        }
      }
      return ok(cloneJson(outcome.value));
    }));
  }

  async getAggregate(
    campaignId: CampaignId,
    aggregateType: string,
    aggregateId: string
  ): Promise<Result<AggregateRecord>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.aggregates
    ], "readonly", async transaction => {
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(campaignId)
      );
      if (!head) return notFound("aggregate", aggregateId);
      const stored = await requestResult<StoredAggregate | undefined>(
        transaction.objectStore(STORES.aggregates).get([
          head.activeGenerationId,
          campaignId,
          aggregateType,
          aggregateId
        ])
      );
      return stored ? ok(cloneJson(stored.record)) : notFound("aggregate", aggregateId);
    }));
  }

  async commit(request: CommitRequest): Promise<Result<CommitRecord>> {
    const validation = validateCommitRequest(request);
    if (!validation.valid) return validationFailure(validation);

    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaignControls,
      STORES.idDirectory,
      STORES.campaigns,
      STORES.operations,
      STORES.aggregates,
      STORES.commands,
      STORES.events,
      STORES.commits,
      STORES.outbox
    ], "readwrite", async transaction => this.commitInTransaction(transaction, request)));
  }

  private async commitInTransaction(transaction: IDBTransaction, request: CommitRequest): Promise<Result<CommitRecord>> {
    const context = await this.loadActiveContext(transaction, request.campaignId);
    if (!context) return notFound("campaign", request.campaignId);
    const generationId = context.head.activeGenerationId;
    const operations = transaction.objectStore(STORES.operations);
    const storedOperation = await requestResult<StoredOperation | undefined>(
      operations.get([generationId, request.operationId])
    );
    if (!storedOperation) return notFound("operation", request.operationId);
    const operation = storedOperation.record;
    if (
      operation.campaignId !== request.campaignId ||
      operation.idempotencyKey !== request.idempotencyKey ||
      operation.requestFingerprint !== request.requestFingerprint
    ) return err(coreError("IDEMPOTENCY_CONFLICT", "core.commit.operation-mismatch"));

    const commits = transaction.objectStore(STORES.commits);
    const existing = await requestResult<StoredCommit | undefined>(
      commits.index("by_campaign_idempotency").get([generationId, request.campaignId, request.idempotencyKey])
    );
    if (existing) {
      return existing.record.requestFingerprint === request.requestFingerprint
        ? ok(cloneJson(existing.record))
        : err(coreError("IDEMPOTENCY_CONFLICT", "core.commit.idempotency-conflict"));
    }

    if (context.campaign.status === "READ_ONLY") return err(coreError("CAMPAIGN_READ_ONLY", "core.campaign.read-only"));
    const busy = this.migrationBusy(context.head);
    if (busy) return err(busy);
    if (operation.phase !== "READY_TO_COMMIT") {
      return err(coreError("INVALID_TRANSITION", "core.commit.operation-not-ready", { phase: operation.phase }));
    }
    const leaseError = this.validateActiveLease(context.control, request.writerLease);
    if (leaseError) return err(leaseError);
    if (request.expectedCampaignRevision !== context.campaign.campaignRevision) {
      return err(coreError("STALE_VERSION", "core.commit.campaign-revision-stale", {
        expected: request.expectedCampaignRevision,
        actual: context.campaign.campaignRevision
      }));
    }

    const commandIds = request.acceptedCommands.map(command => command.commandId);
    const eventIds = request.events.map(event => event.eventId);
    const taskIds = request.outboxTasks.map(task => task.taskId);
    if (!unique(commandIds) || !unique(eventIds) || !unique(taskIds)) {
      return err(coreError("VALIDATION_FAILED", "core.commit.duplicate-id"));
    }
    const directoryStore = transaction.objectStore(STORES.idDirectory);
    const identities: Array<[DirectoryEntityKind, string]> = [
      ["commit", request.commitId],
      ...commandIds.map(id => ["command", id] as [DirectoryEntityKind, string]),
      ...eventIds.map(id => ["event", id] as [DirectoryEntityKind, string]),
      ...taskIds.map(id => ["task", id] as [DirectoryEntityKind, string])
    ];
    for (const [kind, id] of identities) {
      if (await requestResult(directoryStore.get(directoryKey(kind, id)))) {
        return err(coreError("ALREADY_EXISTS", "core.commit.record-id-already-exists"));
      }
    }

    const nextRevision = context.campaign.campaignRevision + 1;
    const aggregateStore = transaction.objectStore(STORES.aggregates);
    const aggregateRecords = new Map<string, { previous: AggregateRecord | undefined; next: AggregateRecord }>();
    const aggregateWrites: CommitRecord["aggregateWrites"] = [];
    for (const write of request.aggregateWrites) {
      const key = `${write.aggregateType}\u0000${write.aggregateId}`;
      if (aggregateRecords.has(key)) {
        return err(coreError("VALIDATION_FAILED", "core.commit.duplicate-aggregate-write", {
          aggregateId: write.aggregateId
        }));
      }
      const stored = await requestResult<StoredAggregate | undefined>(aggregateStore.get([
        generationId,
        request.campaignId,
        write.aggregateType,
        write.aggregateId
      ]));
      const previous = stored?.record;
      const actualRevision = previous?.aggregateRevision ?? null;
      if (actualRevision !== write.expectedAggregateRevision) {
        return err(coreError("STALE_VERSION", "core.commit.aggregate-revision-stale", {
          aggregateId: write.aggregateId,
          expected: write.expectedAggregateRevision,
          actual: actualRevision
        }));
      }
      const next: AggregateRecord = {
        schemaVersion: 1,
        campaignId: request.campaignId,
        aggregateType: write.aggregateType,
        aggregateId: write.aggregateId,
        aggregateRevision: previous ? previous.aggregateRevision + 1 : 0,
        payloadSchemaVersion: write.payloadSchemaVersion,
        payload: cloneJson(write.payload),
        updatedByCommitId: request.commitId
      };
      const aggregateValidation = validateAggregateRecord(next);
      if (!aggregateValidation.valid) return validationFailure(aggregateValidation);
      const clockError = this.validateClockWrite(context.campaign, previous, next);
      if (clockError) return err(clockError);
      aggregateRecords.set(key, { previous, next });
      aggregateWrites.push({
        aggregateType: next.aggregateType,
        aggregateId: next.aggregateId,
        previousRevision: actualRevision,
        aggregateRevision: next.aggregateRevision
      });
    }

    const clockKey = `world.clock\u0000${context.campaign.clockAggregateId}`;
    let resultingClock = aggregateRecords.get(clockKey)?.next;
    if (!resultingClock) {
      resultingClock = (await requestResult<StoredAggregate | undefined>(aggregateStore.get([
        generationId,
        request.campaignId,
        "world.clock",
        context.campaign.clockAggregateId
      ])))?.record;
    }
    if (!resultingClock) throw new Error("Campaign clock is missing.");
    const resultingGameSecond = (resultingClock.payload as CampaignClockPayload).elapsedGameSeconds;

    const commandRecords: AcceptedCommandRecord[] = [];
    for (const draft of request.acceptedCommands) {
      if (draft.campaignId !== request.campaignId || draft.operationId !== request.operationId) {
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
      const command: AcceptedCommandRecord = { ...cloneJson(draft), commitId: request.commitId };
      const commandValidation = validateAcceptedCommandRecord(command);
      if (!commandValidation.valid) return validationFailure(commandValidation);
      commandRecords.push(command);
    }

    const eventRecords: EventRecord[] = [];
    const processedEventIds = new Set<EventId>();
    const commandIdsInCommit = new Set(commandIds);
    const commandStore = transaction.objectStore(STORES.commands);
    const eventStore = transaction.objectStore(STORES.events);
    for (let eventSequence = 0; eventSequence < request.events.length; eventSequence += 1) {
      const draft = request.events[eventSequence];
      if (draft.campaignId !== request.campaignId || draft.operationId !== request.operationId) {
        return err(coreError("VALIDATION_FAILED", "core.event.scope-mismatch", { eventId: draft.eventId }));
      }
      if (draft.occurredAtGameSecond > resultingGameSecond) {
        return err(coreError("VALIDATION_FAILED", "core.event.future-occurrence", { eventId: draft.eventId }));
      }
      for (const ref of draft.aggregateRefs) {
        const next = aggregateRecords.get(`${ref.aggregateType}\u0000${ref.aggregateId}`)?.next ??
          (await requestResult<StoredAggregate | undefined>(aggregateStore.get([
            generationId,
            request.campaignId,
            ref.aggregateType,
            ref.aggregateId
          ])))?.record;
        if (!next || next.aggregateRevision !== ref.aggregateRevision) {
          return err(coreError("VALIDATION_FAILED", "core.event.aggregate-ref-invalid", {
            eventId: draft.eventId,
            aggregateId: ref.aggregateId
          }));
        }
      }
      let causationExists = draft.causation.kind === "OPERATION" && draft.causation.id === request.operationId;
      if (draft.causation.kind === "COMMAND") {
        causationExists = commandIdsInCommit.has(draft.causation.id as never) || Boolean(
          await requestResult(commandStore.get([generationId, draft.causation.id]))
        );
      }
      if (draft.causation.kind === "EVENT") {
        causationExists = processedEventIds.has(draft.causation.id as EventId) || Boolean(
          await requestResult(eventStore.get([generationId, draft.causation.id]))
        );
      }
      if (!causationExists) {
        return err(coreError("VALIDATION_FAILED", "core.event.causation-invalid", { eventId: draft.eventId }));
      }
      const event: EventRecord = {
        ...cloneJson(draft),
        commitId: request.commitId,
        recordedAt: this.nowIso(),
        commitSequence: nextRevision,
        eventSequence
      };
      const eventValidation = validateEventRecord(event);
      if (!eventValidation.valid) return validationFailure(eventValidation);
      eventRecords.push(event);
      processedEventIds.add(event.eventId);
    }

    const outboxRecords: OutboxTaskRecord[] = [];
    const eventIdsInCommit = new Set(eventIds);
    for (const draft of request.outboxTasks) {
      if (draft.sourceEventIds.some(eventId => !eventIdsInCommit.has(eventId))) {
        return err(coreError("VALIDATION_FAILED", "core.outbox.source-event-invalid", { taskId: draft.taskId }));
      }
      const now = this.nowIso();
      const task: OutboxTaskRecord = {
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
      const taskValidation = validateOutboxTaskRecord(task);
      if (!taskValidation.valid) return validationFailure(taskValidation);
      outboxRecords.push(task);
    }

    const committedAt = this.nowIso();
    const commit: CommitRecord = {
      schemaVersion: 1,
      commitId: request.commitId,
      campaignId: request.campaignId,
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey,
      requestFingerprint: request.requestFingerprint,
      previousCampaignRevision: context.campaign.campaignRevision,
      campaignRevision: nextRevision,
      commitSequence: nextRevision,
      commandIds,
      eventIds,
      aggregateWrites,
      outboxTaskIds: taskIds,
      committedAt
    };
    const commitValidation = validateCommitRecord(commit);
    if (!commitValidation.valid) return validationFailure(commitValidation);

    for (const { previous, next } of aggregateRecords.values()) {
      await requestResult(aggregateStore.put({ generationId, record: next } satisfies StoredAggregate));
      if (!previous) {
        await requestResult(directoryStore.add({
          entityKind: "aggregate",
          entityId: next.aggregateId,
          campaignId: request.campaignId
        } satisfies IdDirectoryRecord));
      }
    }
    this.inject("AFTER_AGGREGATES");

    for (const command of commandRecords) {
      await requestResult(commandStore.add({ generationId, record: command } satisfies StoredCommand));
      await requestResult(directoryStore.add({ entityKind: "command", entityId: command.commandId, campaignId: request.campaignId }));
    }
    this.inject("AFTER_COMMANDS");

    for (const event of eventRecords) {
      await requestResult(eventStore.add({ generationId, record: event } satisfies StoredEvent));
      await requestResult(directoryStore.add({ entityKind: "event", entityId: event.eventId, campaignId: request.campaignId }));
    }
    this.inject("AFTER_EVENTS");

    const outboxStore = transaction.objectStore(STORES.outbox);
    for (const task of outboxRecords) {
      await requestResult(outboxStore.add(storedOutbox(generationId, task)));
      await requestResult(directoryStore.add({ entityKind: "task", entityId: task.taskId, campaignId: request.campaignId }));
    }
    this.inject("AFTER_OUTBOX");

    await requestResult(commits.add({ generationId, record: commit } satisfies StoredCommit));
    await requestResult(directoryStore.add({ entityKind: "commit", entityId: commit.commitId, campaignId: request.campaignId }));
    await requestResult(transaction.objectStore(STORES.campaigns).put({
      generationId,
      record: {
        ...context.campaign,
        campaignRevision: nextRevision,
        lastCommitId: commit.commitId,
        updatedAt: committedAt
      }
    } satisfies StoredCampaign));
    await requestResult(operations.put({
      generationId,
      record: {
        ...operation,
        phase: "COMMITTED_PENDING_RENDER",
        commitId: commit.commitId,
        updatedAt: committedAt
      }
    } satisfies StoredOperation));
    this.inject("BEFORE_COMMIT_COMPLETE");
    return ok(cloneJson(commit));
  }

  private validateActiveLease(control: CampaignControlRecord, lease: WriterLease): CoreError | null {
    const validation = validateWriterLease(lease);
    if (!validation.valid) return coreError("VALIDATION_FAILED", "core.lease.invalid", { issues: validation.issues });
    const active = control.writerLease;
    if (
      !active ||
      active.writerId !== lease.writerId ||
      active.fencingToken !== lease.fencingToken ||
      Date.parse(active.expiresAt) <= this.now().getTime()
    ) return coreError("STALE_FENCING_TOKEN", "core.lease.stale");
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
    return this.getRecordByDirectory<CommitRecord, StoredCommit>("commit", commitId, STORES.commits, "commit");
  }

  async getCommitByIdempotencyKey(campaignId: CampaignId, key: IdempotencyKey): Promise<Result<CommitRecord>> {
    return this.safely(async () => runTransaction(this.database, [STORES.campaignHeads, STORES.commits], "readonly", async transaction => {
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(campaignId)
      );
      if (!head) return notFound("commit", key);
      const stored = await requestResult<StoredCommit | undefined>(
        transaction.objectStore(STORES.commits).index("by_campaign_idempotency").get([
          head.activeGenerationId,
          campaignId,
          key
        ])
      );
      return stored ? ok(cloneJson(stored.record)) : notFound("commit", key);
    }));
  }

  async listEvents(campaignId: CampaignId, after: EventCursor | null, limit: number): Promise<Result<EventRecord[]>> {
    if (!Number.isInteger(limit) || limit <= 0 || limit > this.maximumPageSize) {
      return err(coreError("VALIDATION_FAILED", "core.pagination.invalid-limit", { limit }));
    }
    return this.safely(async () => runTransaction(this.database, [STORES.campaignHeads, STORES.events], "readonly", async transaction => {
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(campaignId)
      );
      if (!head) return notFound("campaign", campaignId);
      const lower = after
        ? [head.activeGenerationId, campaignId, after.commitSequence, after.eventSequence]
        : [head.activeGenerationId, campaignId, 0, 0];
      const upper = [head.activeGenerationId, campaignId, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
      const range = IDBKeyRange.bound(lower, upper, Boolean(after), false);
      const stored = await cursorValues<StoredEvent>(
        transaction.objectStore(STORES.events).index("by_campaign_order").openCursor(range, "next"),
        limit
      );
      return ok(stored.map(value => cloneJson(value.record)));
    }));
  }

  async claimOutboxTasks(
    campaignId: CampaignId,
    workerId: WorkerId,
    limit: number,
    leaseMs: number
  ): Promise<Result<OutboxTaskRecord[]>> {
    if (
      !Number.isInteger(limit) || limit <= 0 || limit > this.maximumPageSize ||
      !Number.isInteger(leaseMs) || leaseMs <= 0 || leaseMs > MAX_LEASE_MS
    ) return err(coreError("VALIDATION_FAILED", "core.outbox.invalid-claim"));

    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.outbox
    ], "readwrite", async transaction => {
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(campaignId)
      );
      if (!head) return notFound("campaign", campaignId);
      const busy = this.migrationBusy(head);
      if (busy) return err(busy);
      const now = this.now();
      const range = IDBKeyRange.bound(
        [head.activeGenerationId, campaignId, "", ""],
        [head.activeGenerationId, campaignId, now.toISOString(), "\uffff"]
      );
      const store = transaction.objectStore(STORES.outbox);
      const candidates = await cursorValues<StoredOutboxTask>(store.index("by_claimable").openCursor(range, "next"), limit);
      const claimed: OutboxTaskRecord[] = [];
      for (const candidate of candidates) {
        const task = candidate.record;
        if (candidate.claimableAt !== claimableAtFor(task)) {
          throw new Error("Outbox claim projection is inconsistent.");
        }
        const eligible = task.status === "PENDING" ||
          (task.status === "FAILED_RETRYABLE" && task.nextAttemptAt !== null && Date.parse(task.nextAttemptAt) <= now.getTime()) ||
          (task.status === "RUNNING" && task.leaseExpiresAt !== null && Date.parse(task.leaseExpiresAt) <= now.getTime());
        if (!eligible) continue;
        const updated: OutboxTaskRecord = {
          ...task,
          status: "RUNNING",
          attemptCount: task.attemptCount + 1,
          lockedBy: workerId,
          leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
          nextAttemptAt: null,
          updatedAt: now.toISOString()
        };
        await requestResult(store.put(storedOutbox(head.activeGenerationId, updated)));
        claimed.push(cloneJson(updated));
      }
      return ok(claimed);
    }));
  }

  async completeOutboxTask(taskId: TaskId, workerId: WorkerId): Promise<Result<OutboxTaskRecord>> {
    return this.updateOutboxTask(taskId, task => {
      if (task.status === "COMPLETED") return ok(task);
      const leaseError = this.validateTaskWorker(task, workerId);
      if (leaseError) return err(leaseError);
      return ok({
        ...task,
        status: "COMPLETED",
        lockedBy: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        lastError: null,
        updatedAt: this.nowIso()
      });
    });
  }

  async failOutboxTask(
    taskId: TaskId,
    workerId: WorkerId,
    error: CoreError,
    retryAt: string | null
  ): Promise<Result<OutboxTaskRecord>> {
    const errorValidation = validateCoreError(error);
    if (!errorValidation.valid) return validationFailure(errorValidation);
    const retryable = error.retry !== "NEVER";
    if (retryable && (!retryAt || !Number.isFinite(Date.parse(retryAt)))) {
      return err(coreError("VALIDATION_FAILED", "core.outbox.retry-at-required"));
    }
    if (!retryable && retryAt !== null) {
      return err(coreError("VALIDATION_FAILED", "core.outbox.retry-at-forbidden"));
    }
    return this.updateOutboxTask(taskId, task => {
      const leaseError = this.validateTaskWorker(task, workerId);
      if (leaseError) return err(leaseError);
      return ok({
        ...task,
        status: retryable ? "FAILED_RETRYABLE" : "FAILED_FINAL",
        lockedBy: null,
        leaseExpiresAt: null,
        nextAttemptAt: retryable ? new Date(retryAt!).toISOString() : null,
        lastError: cloneJson(error),
        updatedAt: this.nowIso()
      });
    });
  }

  private async updateOutboxTask(
    taskId: TaskId,
    update: (task: OutboxTaskRecord) => Result<OutboxTaskRecord>
  ): Promise<Result<OutboxTaskRecord>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.idDirectory,
      STORES.campaignHeads,
      STORES.outbox
    ], "readwrite", async transaction => {
      const directory = await requestResult<IdDirectoryRecord | undefined>(
        transaction.objectStore(STORES.idDirectory).get(directoryKey("task", taskId))
      );
      if (!directory) return notFound("outbox-task", taskId);
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(directory.campaignId)
      );
      if (!head) return notFound("outbox-task", taskId);
      const busy = this.migrationBusy(head);
      if (busy) return err(busy);
      const store = transaction.objectStore(STORES.outbox);
      const stored = await requestResult<StoredOutboxTask | undefined>(store.get([head.activeGenerationId, taskId]));
      if (!stored) return notFound("outbox-task", taskId);
      const outcome = update(cloneJson(stored.record));
      if (!outcome.ok) return outcome;
      const validation = validateOutboxTaskRecord(outcome.value);
      if (!validation.valid) return validationFailure(validation);
      await requestResult(store.put(storedOutbox(head.activeGenerationId, outcome.value)));
      return ok(cloneJson(outcome.value));
    }));
  }

  async getBrowserStorageEstimate(requestPersistence = false): Promise<Result<BrowserStorageEstimate>> {
    return this.safely(async () => {
      const storage = globalThis.navigator?.storage;
      if (!storage) {
        return ok({ persisted: null, usage: null, quota: null, ratio: null, warning: false });
      }
      let persisted = typeof storage.persisted === "function" ? await storage.persisted() : null;
      if (requestPersistence && persisted === false && typeof storage.persist === "function") {
        persisted = await storage.persist();
      }
      const estimate = typeof storage.estimate === "function" ? await storage.estimate() : {};
      const usage = typeof estimate.usage === "number" ? estimate.usage : null;
      const quota = typeof estimate.quota === "number" ? estimate.quota : null;
      const ratio = usage !== null && quota !== null && quota > 0 ? usage / quota : null;
      return ok({ persisted, usage, quota, ratio, warning: ratio !== null && ratio >= 0.7 });
    });
  }

  async getCampaignStorageState(campaignId: CampaignId): Promise<Result<CampaignStorageState>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaignGenerations
    ], "readonly", async transaction => {
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(campaignId)
      );
      if (!head) return notFound("campaign", campaignId);
      const range = IDBKeyRange.bound([campaignId, ""], [campaignId, "\uffff"]);
      const generations = await cursorValues<CampaignGenerationRecord>(
        transaction.objectStore(STORES.campaignGenerations).index("by_campaign_status").openCursor(range),
        1024
      );
      return ok({ head: cloneJson(head), generations: cloneJson(generations) });
    }));
  }

  async migrateCampaignStorage(
    options: CampaignStorageMigrationOptions
  ): Promise<Result<CampaignStorageMigrationReport>> {
    const leaseMs = options.leaseMs ?? MAX_LEASE_MS;
    const batchSize = options.batchSize ?? 128;
    if (
      !Number.isInteger(leaseMs) || leaseMs <= 0 || leaseMs > MAX_LEASE_MS ||
      !Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 1024 ||
      !Number.isFinite(options.requiredFreeBytes ?? 0) || (options.requiredFreeBytes ?? 0) < 0
    ) return err(coreError("VALIDATION_FAILED", "core.migration.invalid-options"));

    const estimate = await this.getBrowserStorageEstimate(false);
    if (!estimate.ok) return estimate;
    if (
      options.requiredFreeBytes &&
      estimate.value.quota !== null &&
      estimate.value.usage !== null &&
      estimate.value.quota - estimate.value.usage < options.requiredFreeBytes
    ) return err(coreError("PERSISTENCE_FAILURE", "core.migration.insufficient-storage"));

    const started = await this.beginMigration(options.campaignId, options.ownerId, leaseMs);
    if (!started.ok) return started;
    const { sourceGenerationId, targetGenerationId } = started.value;
    const copiedRecords: Record<MigrationDataStore, number> = {
      campaigns: 0,
      aggregates: 0,
      operations: 0,
      commands: 0,
      events: 0,
      commits: 0,
      outbox: 0
    };

    try {
      const campaign = await this.readStoredCampaign(sourceGenerationId, options.campaignId);
      if (!campaign) throw new Error("Migration source campaign is missing.");
      const transformedCampaign = await this.transformMigrationRecord(
        "campaigns",
        campaign.record,
        options.transform
      );
      await this.writeMigratedRecord("campaigns", targetGenerationId, transformedCampaign);
      copiedRecords.campaigns = 1;
      await this.renewMigrationLease(options.campaignId, options.ownerId, targetGenerationId, leaseMs);
      this.inject("AFTER_MIGRATION_STORE");

      const stores: Exclude<MigrationDataStore, "campaigns">[] = [
        "aggregates",
        "operations",
        "commands",
        "events",
        "commits",
        "outbox"
      ];
      for (const store of stores) {
        copiedRecords[store] = await this.copyMigrationStore(
          store,
          options.campaignId,
          sourceGenerationId,
          targetGenerationId,
          batchSize,
          options.ownerId,
          leaseMs,
          options.transform
        );
        this.inject("AFTER_MIGRATION_STORE");
      }

      await this.setMigrationState(options.campaignId, options.ownerId, targetGenerationId, "VALIDATING");
      await this.validateMigratedGeneration(options.campaignId, targetGenerationId, copiedRecords);
      const integrityFingerprint = await this.computeGenerationFingerprint(
        options.campaignId,
        targetGenerationId,
        128
      );
      await this.setMigrationState(options.campaignId, options.ownerId, targetGenerationId, "READY_TO_ACTIVATE");
      this.inject("BEFORE_MIGRATION_ACTIVATION");
      const activatedAt = this.nowIso();
      await this.activateMigration(
        options.campaignId,
        options.ownerId,
        sourceGenerationId,
        targetGenerationId,
        copiedRecords,
        integrityFingerprint,
        activatedAt
      );
      this.inject("AFTER_MIGRATION_ACTIVATION");
      const postActivationFingerprint = await this.computeGenerationFingerprint(
        options.campaignId,
        targetGenerationId,
        128
      );
      if (postActivationFingerprint !== integrityFingerprint) {
        throw new Error("Post-activation fingerprint mismatch.");
      }
      await this.finalizeMigration(
        options.campaignId,
        options.ownerId,
        sourceGenerationId,
        targetGenerationId,
        integrityFingerprint
      );
      return ok({
        campaignId: options.campaignId,
        sourceGenerationId,
        targetGenerationId,
        copiedRecords,
        activatedAt
      });
    } catch {
      await this.markMigrationFailed(options.campaignId, options.ownerId, targetGenerationId);
      return err(coreError("PERSISTENCE_FAILURE", "core.migration.failed"));
    }
  }

  async abortCampaignStorageMigration(campaignId: CampaignId, ownerId: WriterId): Promise<Result<void>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaignGenerations
    ], "readwrite", async transaction => {
      const heads = transaction.objectStore(STORES.campaignHeads);
      const head = await requestResult<CampaignHeadRecord | undefined>(heads.get(campaignId));
      if (!head) return notFound("campaign", campaignId);
      if (head.migration.state === "IDLE") return ok(undefined);
      const leaseExpired = head.migration.leaseExpiresAt === null ||
        Date.parse(head.migration.leaseExpiresAt) <= this.now().getTime();
      if (head.migration.ownerId !== ownerId && !leaseExpired) {
        return err(coreError("STALE_FENCING_TOKEN", "core.migration.owner-stale"));
      }
      const targetGenerationId = head.migration.targetGenerationId;
      let activeGenerationId = head.activeGenerationId;
      if (targetGenerationId) {
        const generations = transaction.objectStore(STORES.campaignGenerations);
        const target = await requestResult<CampaignGenerationRecord | undefined>(
          generations.get([campaignId, targetGenerationId])
        );
        if (target) await requestResult(generations.put({ ...target, status: "DISCARDED" }));
        if (head.activeGenerationId === targetGenerationId && head.migration.sourceGenerationId) {
          const source = await requestResult<CampaignGenerationRecord | undefined>(
            generations.get([campaignId, head.migration.sourceGenerationId])
          );
          if (!source) return err(coreError("CAMPAIGN_INTEGRITY_FAILURE", "core.migration.source-missing"));
          await requestResult(generations.put({ ...source, status: "ACTIVE" }));
          activeGenerationId = source.generationId;
        }
      }
      await requestResult(heads.put({
        ...head,
        activeGenerationId,
        migration: {
          state: "IDLE",
          sourceGenerationId: null,
          targetGenerationId: null,
          ownerId: null,
          leaseExpiresAt: null,
          lastErrorCode: null
        }
      } satisfies CampaignHeadRecord));
      return ok(undefined);
    }));
  }

  async confirmCampaignStorageMigration(
    campaignId: CampaignId,
    backupGenerationId: string
  ): Promise<Result<CampaignGenerationRecord>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaignGenerations,
      STORES.campaigns
    ], "readwrite", async transaction => {
      const head = await requestResult<CampaignHeadRecord | undefined>(
        transaction.objectStore(STORES.campaignHeads).get(campaignId)
      );
      if (!head) return notFound("campaign", campaignId);
      const active = await requestResult<StoredCampaign | undefined>(
        transaction.objectStore(STORES.campaigns).get([head.activeGenerationId, campaignId])
      );
      if (!active || !validateCampaignRecord(active.record).valid) {
        return err(coreError("CAMPAIGN_INTEGRITY_FAILURE", "core.migration.active-invalid"));
      }
      const generations = transaction.objectStore(STORES.campaignGenerations);
      const activeGeneration = await requestResult<CampaignGenerationRecord | undefined>(
        generations.get([campaignId, head.activeGenerationId])
      );
      if (!activeGeneration || activeGeneration.verifiedAt === null) {
        return err(coreError("CAMPAIGN_INTEGRITY_FAILURE", "core.migration.fingerprint-mismatch"));
      }
      const backup = await requestResult<CampaignGenerationRecord | undefined>(
        generations.get([campaignId, backupGenerationId])
      );
      if (!backup || backup.status !== "BACKUP") return notFound("backup-generation", backupGenerationId);
      const confirmed = { ...backup, confirmedAt: this.nowIso() };
      await requestResult(generations.put(confirmed));
      return ok(cloneJson(confirmed));
    }));
  }

  private async beginMigration(
    campaignId: CampaignId,
    ownerId: WriterId,
    leaseMs: number
  ): Promise<Result<{ sourceGenerationId: string; targetGenerationId: string }>> {
    return this.safely(async () => runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaignGenerations,
      STORES.campaignControls
    ], "readwrite", async transaction => {
      const heads = transaction.objectStore(STORES.campaignHeads);
      const head = await requestResult<CampaignHeadRecord | undefined>(heads.get(campaignId));
      if (!head) return notFound("campaign", campaignId);
      if (head.migration.state !== "IDLE") return err(coreError("CAMPAIGN_BUSY", "core.campaign.migration-busy"));
      const controls = transaction.objectStore(STORES.campaignControls);
      const control = await requestResult<CampaignControlRecord | undefined>(controls.get(campaignId));
      if (!control) throw new Error("Campaign control is missing.");
      const now = this.now();
      const writerLeaseActive = control.writerLease && Date.parse(control.writerLease.expiresAt) > now.getTime();
      if (control.activeOperationId || writerLeaseActive) {
        return err(coreError("CAMPAIGN_BUSY", "core.migration.campaign-busy"));
      }
      if (control.writerLease) await requestResult(controls.put({ ...control, writerLease: null }));
      const targetGenerationId = randomId("gen");
      const generation: CampaignGenerationRecord = {
        campaignId,
        generationId: targetGenerationId,
        status: "STAGING",
        storageSchemaVersion: 1,
        sourceGenerationId: head.activeGenerationId,
        createdAt: now.toISOString(),
        activatedAt: null,
        verifiedAt: null,
        confirmedAt: null,
        recordCounts: {},
        integrityFingerprint: "sha256:pending"
      };
      await requestResult(transaction.objectStore(STORES.campaignGenerations).add(generation));
      await requestResult(heads.put({
        ...head,
        migration: {
          state: "COPYING",
          sourceGenerationId: head.activeGenerationId,
          targetGenerationId,
          ownerId,
          leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
          lastErrorCode: null
        }
      } satisfies CampaignHeadRecord));
      return ok({ sourceGenerationId: head.activeGenerationId, targetGenerationId });
    }));
  }

  private async readStoredCampaign(generationId: string, campaignId: CampaignId): Promise<StoredCampaign | undefined> {
    return runTransaction(this.database, [STORES.campaigns], "readonly", transaction =>
      requestResult<StoredCampaign | undefined>(
        transaction.objectStore(STORES.campaigns).get([generationId, campaignId])
      )
    );
  }

  private migrationIndex(store: Exclude<MigrationDataStore, "campaigns">): {
    storeName: string;
    indexName: string;
    lower: (generationId: string, campaignId: CampaignId) => IDBValidKey[];
    upper: (generationId: string, campaignId: CampaignId) => IDBValidKey[];
  } {
    const textBounds = (generationId: string, campaignId: CampaignId, parts: number) => ({
      lower: [generationId, campaignId, ...Array.from({ length: parts }, () => "")],
      upper: [generationId, campaignId, ...Array.from({ length: parts }, () => "\uffff")]
    });
    if (store === "aggregates") {
      return {
        storeName: STORES.aggregates,
        indexName: "by_campaign_aggregate",
        lower: (generationId, campaignId) => textBounds(generationId, campaignId, 2).lower,
        upper: (generationId, campaignId) => textBounds(generationId, campaignId, 2).upper
      };
    }
    const names: Record<Exclude<MigrationDataStore, "campaigns" | "aggregates">, [string, string]> = {
      operations: [STORES.operations, "by_campaign_operation"],
      commands: [STORES.commands, "by_campaign_command"],
      events: [STORES.events, "by_campaign_event"],
      commits: [STORES.commits, "by_campaign_commit"],
      outbox: [STORES.outbox, "by_campaign_task"]
    };
    const [storeName, indexName] = names[store];
    return {
      storeName,
      indexName,
      lower: (generationId, campaignId) => textBounds(generationId, campaignId, 1).lower,
      upper: (generationId, campaignId) => textBounds(generationId, campaignId, 1).upper
    };
  }

  private async copyMigrationStore(
    store: Exclude<MigrationDataStore, "campaigns">,
    campaignId: CampaignId,
    sourceGenerationId: string,
    targetGenerationId: string,
    batchSize: number,
    ownerId: WriterId,
    leaseMs: number,
    transform?: CampaignStorageMigrationOptions["transform"]
  ): Promise<number> {
    const config = this.migrationIndex(store);
    let lastKey: IDBValidKey | null = null;
    let copied = 0;
    while (true) {
      const page = await runTransaction(this.database, [config.storeName], "readonly", transaction => {
        const lower = lastKey ?? config.lower(sourceGenerationId, campaignId);
        const range = IDBKeyRange.bound(
          lower,
          config.upper(sourceGenerationId, campaignId),
          lastKey !== null,
          false
        );
        return cursorPage<{ record: unknown }>(
          transaction.objectStore(config.storeName).index(config.indexName).openCursor(range),
          batchSize
        );
      });
      if (page.values.length === 0) break;
      const transformed: unknown[] = [];
      for (const value of page.values) {
        transformed.push(await this.transformMigrationRecord(store, value.record, transform));
      }
      await runTransaction(this.database, [config.storeName], "readwrite", async transaction => {
        const targetStore = transaction.objectStore(config.storeName);
        for (const record of transformed) {
          await requestResult(targetStore.add(this.wrapMigratedRecord(store, targetGenerationId, campaignId, record)));
        }
      });
      copied += transformed.length;
      await this.renewMigrationLease(campaignId, ownerId, targetGenerationId, leaseMs);
      lastKey = page.lastKey;
      if (page.values.length < batchSize || lastKey === null) break;
    }
    return copied;
  }

  private async transformMigrationRecord(
    store: MigrationDataStore,
    source: unknown,
    transform?: CampaignStorageMigrationOptions["transform"]
  ): Promise<unknown> {
    const original = cloneJson(source);
    const transformed = transform ? await transform(store, original) : original;
    const validation = this.validateMigrationRecord(store, transformed);
    if (!validation.valid) throw new Error(`Invalid migrated ${store}: ${validation.issues.join(", ")}`);
    if (this.migrationIdentity(store, original) !== this.migrationIdentity(store, transformed)) {
      throw new Error(`Migration changed the identity of a ${store} record.`);
    }
    return cloneJson(transformed);
  }

  private validateMigrationRecord(store: MigrationDataStore, value: unknown): ValidationResult {
    if (store === "campaigns") return validateCampaignRecord(value);
    if (store === "aggregates") return validateAggregateRecord(value);
    if (store === "operations") return validateOperationRecord(value);
    if (store === "commands") return validateAcceptedCommandRecord(value);
    if (store === "events") return validateEventRecord(value);
    if (store === "commits") return validateCommitRecord(value);
    return validateOutboxTaskRecord(value);
  }

  private migrationIdentity(store: MigrationDataStore, value: unknown): string {
    if (!value || typeof value !== "object") return "invalid";
    const record = value as Record<string, unknown>;
    if (store === "campaigns") return String(record.campaignId);
    if (store === "aggregates") return `${record.campaignId}\u0000${record.aggregateType}\u0000${record.aggregateId}`;
    if (store === "operations") return `${record.campaignId}\u0000${record.operationId}`;
    if (store === "commands") return `${record.campaignId}\u0000${record.commandId}`;
    if (store === "events") return `${record.campaignId}\u0000${record.eventId}`;
    if (store === "commits") return `${record.campaignId}\u0000${record.commitId}`;
    return `${record.campaignId}\u0000${record.taskId}`;
  }

  private wrapMigratedRecord(
    store: MigrationDataStore,
    generationId: string,
    campaignId: CampaignId,
    record: unknown
  ): unknown {
    if (store === "outbox") return storedOutbox(generationId, record as OutboxTaskRecord);
    return { generationId, record };
  }

  private async writeMigratedRecord(
    store: "campaigns",
    generationId: string,
    record: unknown
  ): Promise<void> {
    await runTransaction(this.database, [STORES.campaigns], "readwrite", async transaction => {
      await requestResult(transaction.objectStore(STORES.campaigns).add({ generationId, record }));
    });
  }

  private async setMigrationState(
    campaignId: CampaignId,
    ownerId: WriterId,
    targetGenerationId: string,
    state: "VALIDATING" | "READY_TO_ACTIVATE"
  ): Promise<void> {
    await runTransaction(this.database, [STORES.campaignHeads], "readwrite", async transaction => {
      const store = transaction.objectStore(STORES.campaignHeads);
      const head = await requestResult<CampaignHeadRecord | undefined>(store.get(campaignId));
      if (
        !head ||
        head.migration.ownerId !== ownerId ||
        head.migration.targetGenerationId !== targetGenerationId ||
        head.migration.leaseExpiresAt === null ||
        Date.parse(head.migration.leaseExpiresAt) <= this.now().getTime()
      ) {
        throw new Error("Migration lease is stale.");
      }
      await requestResult(store.put({ ...head, migration: { ...head.migration, state } }));
    });
  }

  private async renewMigrationLease(
    campaignId: CampaignId,
    ownerId: WriterId,
    targetGenerationId: string,
    leaseMs: number
  ): Promise<void> {
    await runTransaction(this.database, [STORES.campaignHeads], "readwrite", async transaction => {
      const store = transaction.objectStore(STORES.campaignHeads);
      const head = await requestResult<CampaignHeadRecord | undefined>(store.get(campaignId));
      const now = this.now();
      if (
        !head ||
        head.migration.state === "IDLE" ||
        head.migration.ownerId !== ownerId ||
        head.migration.targetGenerationId !== targetGenerationId ||
        head.migration.leaseExpiresAt === null ||
        Date.parse(head.migration.leaseExpiresAt) <= now.getTime()
      ) throw new Error("Migration lease is stale.");
      await requestResult(store.put({
        ...head,
        migration: {
          ...head.migration,
          leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString()
        }
      }));
    });
  }

  private async validateMigratedGeneration(
    campaignId: CampaignId,
    generationId: string,
    counts: Record<MigrationDataStore, number>
  ): Promise<void> {
    if (counts.campaigns !== 1 || counts.aggregates < 1) throw new Error("Migrated generation is incomplete.");
    const campaign = await this.readStoredCampaign(generationId, campaignId);
    if (!campaign || !validateCampaignRecord(campaign.record).valid) throw new Error("Migrated campaign is invalid.");
    const clock = await runTransaction(this.database, [STORES.aggregates], "readonly", transaction =>
      requestResult<StoredAggregate | undefined>(transaction.objectStore(STORES.aggregates).get([
        generationId,
        campaignId,
        "world.clock",
        campaign.record.clockAggregateId
      ]))
    );
    if (!clock || !validateClockPayload(clock.record.payload).valid) throw new Error("Migrated clock is invalid.");
  }

  private async computeGenerationFingerprint(
    campaignId: CampaignId,
    generationId: string,
    batchSize: number
  ): Promise<string> {
    const campaign = await this.readStoredCampaign(generationId, campaignId);
    if (!campaign) throw new Error("Generation campaign is missing.");
    let fingerprint = await computeJsonFingerprint({
      previous: null,
      storageSchemaVersion: 1,
      store: "campaigns",
      records: [campaign.record]
    });
    const stores: Exclude<MigrationDataStore, "campaigns">[] = [
      "aggregates",
      "operations",
      "commands",
      "events",
      "commits",
      "outbox"
    ];
    for (const store of stores) {
      const config = this.migrationIndex(store);
      let lastKey: IDBValidKey | null = null;
      while (true) {
        const page = await runTransaction(this.database, [config.storeName], "readonly", transaction => {
          const lower = lastKey ?? config.lower(generationId, campaignId);
          const range = IDBKeyRange.bound(
            lower,
            config.upper(generationId, campaignId),
            lastKey !== null,
            false
          );
          return cursorPage<{ record: unknown }>(
            transaction.objectStore(config.storeName).index(config.indexName).openCursor(range),
            batchSize
          );
        });
        if (page.values.length === 0) break;
        fingerprint = await computeJsonFingerprint({
          previous: fingerprint,
          store,
          records: page.values.map(value => value.record)
        });
        lastKey = page.lastKey;
        if (page.values.length < batchSize || lastKey === null) break;
      }
    }
    return fingerprint;
  }

  private async activateMigration(
    campaignId: CampaignId,
    ownerId: WriterId,
    sourceGenerationId: string,
    targetGenerationId: string,
    counts: Record<MigrationDataStore, number>,
    integrityFingerprint: string,
    activatedAt: string
  ): Promise<void> {
    await runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaignGenerations,
      STORES.campaignControls
    ], "readwrite", async transaction => {
      const heads = transaction.objectStore(STORES.campaignHeads);
      const head = await requestResult<CampaignHeadRecord | undefined>(heads.get(campaignId));
      const controls = transaction.objectStore(STORES.campaignControls);
      const control = await requestResult<CampaignControlRecord | undefined>(controls.get(campaignId));
      if (
        !head || !control ||
        head.activeGenerationId !== sourceGenerationId ||
        head.migration.state !== "READY_TO_ACTIVATE" ||
        head.migration.ownerId !== ownerId ||
        head.migration.targetGenerationId !== targetGenerationId ||
        head.migration.leaseExpiresAt === null ||
        Date.parse(head.migration.leaseExpiresAt) <= this.now().getTime() ||
        control.activeOperationId || control.writerLease
      ) throw new Error("Migration activation preconditions failed.");
      const generations = transaction.objectStore(STORES.campaignGenerations);
      const source = await requestResult<CampaignGenerationRecord | undefined>(
        generations.get([campaignId, sourceGenerationId])
      );
      const target = await requestResult<CampaignGenerationRecord | undefined>(
        generations.get([campaignId, targetGenerationId])
      );
      if (!source || !target || source.status !== "ACTIVE" || target.status !== "STAGING") {
        throw new Error("Migration generations are invalid.");
      }
      await requestResult(generations.put({ ...source, status: "BACKUP", confirmedAt: null }));
      await requestResult(generations.put({
        ...target,
        status: "ACTIVE",
        activatedAt,
        verifiedAt: null,
        recordCounts: cloneJson(counts),
        integrityFingerprint
      }));
      await requestResult(heads.put({
        ...head,
        activeGenerationId: targetGenerationId,
        migration: { ...head.migration, state: "VALIDATING" }
      } satisfies CampaignHeadRecord));
    });
  }

  private async finalizeMigration(
    campaignId: CampaignId,
    ownerId: WriterId,
    sourceGenerationId: string,
    targetGenerationId: string,
    integrityFingerprint: string
  ): Promise<void> {
    await runTransaction(this.database, [
      STORES.campaignHeads,
      STORES.campaignGenerations
    ], "readwrite", async transaction => {
      const heads = transaction.objectStore(STORES.campaignHeads);
      const head = await requestResult<CampaignHeadRecord | undefined>(heads.get(campaignId));
      if (
        !head ||
        head.activeGenerationId !== targetGenerationId ||
        head.migration.state !== "VALIDATING" ||
        head.migration.ownerId !== ownerId ||
        head.migration.sourceGenerationId !== sourceGenerationId ||
        head.migration.targetGenerationId !== targetGenerationId
      ) throw new Error("Migration finalization preconditions failed.");
      const generations = transaction.objectStore(STORES.campaignGenerations);
      const target = await requestResult<CampaignGenerationRecord | undefined>(
        generations.get([campaignId, targetGenerationId])
      );
      if (!target || target.status !== "ACTIVE" || target.integrityFingerprint !== integrityFingerprint) {
        throw new Error("Activated generation is invalid.");
      }
      await requestResult(generations.put({ ...target, verifiedAt: this.nowIso() }));
      await requestResult(heads.put({
        ...head,
        migration: {
          state: "IDLE",
          sourceGenerationId: null,
          targetGenerationId: null,
          ownerId: null,
          leaseExpiresAt: null,
          lastErrorCode: null
        }
      } satisfies CampaignHeadRecord));
    });
  }

  private async markMigrationFailed(
    campaignId: CampaignId,
    ownerId: WriterId,
    targetGenerationId: string
  ): Promise<void> {
    try {
      await runTransaction(this.database, [
        STORES.campaignHeads,
        STORES.campaignGenerations
      ], "readwrite", async transaction => {
        const store = transaction.objectStore(STORES.campaignHeads);
        const head = await requestResult<CampaignHeadRecord | undefined>(store.get(campaignId));
        if (!head || head.migration.ownerId !== ownerId || head.migration.targetGenerationId !== targetGenerationId) return;
        let activeGenerationId = head.activeGenerationId;
        const generations = transaction.objectStore(STORES.campaignGenerations);
        if (head.activeGenerationId === targetGenerationId && head.migration.sourceGenerationId) {
          const source = await requestResult<CampaignGenerationRecord | undefined>(
            generations.get([campaignId, head.migration.sourceGenerationId])
          );
          const target = await requestResult<CampaignGenerationRecord | undefined>(
            generations.get([campaignId, targetGenerationId])
          );
          if (source && target) {
            await requestResult(generations.put({ ...source, status: "ACTIVE" }));
            await requestResult(generations.put({ ...target, status: "DISCARDED" }));
            activeGenerationId = source.generationId;
          }
        }
        await requestResult(store.put({
          ...head,
          activeGenerationId,
          migration: { ...head.migration, state: "FAILED", lastErrorCode: "PERSISTENCE_FAILURE" }
        }));
      });
    } catch {
      // The active pointer was never changed; a later recovery can inspect the staging generation.
    }
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
