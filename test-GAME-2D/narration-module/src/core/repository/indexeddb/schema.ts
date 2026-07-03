import type {
  AcceptedCommandRecord,
  AggregateRecord,
  CampaignId,
  CampaignRecord,
  CommitRecord,
  OperationId,
  OperationRecord,
  OutboxTaskRecord,
  WriterId,
  WriterLease,
  EventRecord
} from "../../contracts/types";

export const STORAGE_SCHEMA_VERSION = 1;
export const DEFAULT_DATABASE_NAME = "jdr5e-narration";

export const STORES = {
  repositoryMeta: "repository_meta",
  campaignHeads: "campaign_heads",
  campaignGenerations: "campaign_generations",
  campaignControls: "campaign_controls",
  idDirectory: "id_directory",
  campaigns: "campaigns",
  aggregates: "aggregates",
  operations: "operations",
  commands: "commands",
  events: "events",
  commits: "commits",
  outbox: "outbox"
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];
export type GenerationStatus = "STAGING" | "ACTIVE" | "BACKUP" | "DISCARDED";
export type MigrationState = "IDLE" | "COPYING" | "VALIDATING" | "READY_TO_ACTIVATE" | "FAILED";
export type DirectoryEntityKind = "operation" | "commit" | "task" | "command" | "event" | "aggregate";

export interface RepositoryMetaRecord {
  key: "repository";
  storageSchemaVersion: 1;
  installationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignMigrationRecord {
  state: MigrationState;
  sourceGenerationId: string | null;
  targetGenerationId: string | null;
  ownerId: WriterId | null;
  leaseExpiresAt: string | null;
  lastErrorCode: string | null;
}

export interface CampaignHeadRecord {
  campaignId: CampaignId;
  activeGenerationId: string;
  storageSchemaVersion: 1;
  migration: CampaignMigrationRecord;
}

export interface CampaignGenerationRecord {
  campaignId: CampaignId;
  generationId: string;
  status: GenerationStatus;
  storageSchemaVersion: 1;
  sourceGenerationId: string | null;
  createdAt: string;
  activatedAt: string | null;
  verifiedAt: string | null;
  confirmedAt: string | null;
  recordCounts: Record<string, number>;
  integrityFingerprint: string;
}

export interface CampaignControlRecord {
  campaignId: CampaignId;
  activeOperationId: OperationId | null;
  writerLease: WriterLease | null;
  fencingToken: number;
}

export interface IdDirectoryRecord {
  entityKind: DirectoryEntityKind;
  entityId: string;
  campaignId: CampaignId;
}

export interface StoredRecord<T> {
  generationId: string;
  record: T;
}

export interface StoredOutboxTask {
  generationId: string;
  campaignId: CampaignId;
  claimableAt?: string;
  record: OutboxTaskRecord;
}

export type StoredCampaign = StoredRecord<CampaignRecord>;
export type StoredAggregate = StoredRecord<AggregateRecord>;
export type StoredOperation = StoredRecord<OperationRecord>;
export type StoredCommand = StoredRecord<AcceptedCommandRecord>;
export type StoredEvent = StoredRecord<EventRecord>;
export type StoredCommit = StoredRecord<CommitRecord>;

export function claimableAtFor(record: OutboxTaskRecord): string | undefined {
  if (record.status === "PENDING") return record.createdAt;
  if (record.status === "RUNNING") return record.leaseExpiresAt ?? undefined;
  if (record.status === "FAILED_RETRYABLE") return record.nextAttemptAt ?? undefined;
  return undefined;
}

function createStore(database: IDBDatabase, name: StoreName, keyPath: string | string[]): IDBObjectStore {
  return database.createObjectStore(name, { keyPath });
}

export function upgradeDatabase(database: IDBDatabase, transaction: IDBTransaction | null): void {
  if (!transaction) throw new Error("IndexedDB versionchange transaction is missing.");

  if (!database.objectStoreNames.contains(STORES.repositoryMeta)) {
    createStore(database, STORES.repositoryMeta, "key");
  }
  if (!database.objectStoreNames.contains(STORES.campaignHeads)) {
    createStore(database, STORES.campaignHeads, "campaignId");
  }
  if (!database.objectStoreNames.contains(STORES.campaignGenerations)) {
    const store = createStore(database, STORES.campaignGenerations, ["campaignId", "generationId"]);
    store.createIndex("by_campaign_status", ["campaignId", "status"]);
  }
  if (!database.objectStoreNames.contains(STORES.campaignControls)) {
    createStore(database, STORES.campaignControls, "campaignId");
  }
  if (!database.objectStoreNames.contains(STORES.idDirectory)) {
    const store = createStore(database, STORES.idDirectory, ["entityKind", "entityId"]);
    store.createIndex("by_campaign", "campaignId");
  }
  if (!database.objectStoreNames.contains(STORES.campaigns)) {
    createStore(database, STORES.campaigns, ["generationId", "record.campaignId"]);
  }
  if (!database.objectStoreNames.contains(STORES.aggregates)) {
    const store = createStore(database, STORES.aggregates, [
      "generationId",
      "record.campaignId",
      "record.aggregateType",
      "record.aggregateId"
    ]);
    store.createIndex("by_campaign", ["generationId", "record.campaignId"]);
    store.createIndex("by_campaign_aggregate", [
      "generationId",
      "record.campaignId",
      "record.aggregateType",
      "record.aggregateId"
    ], { unique: true });
  }
  if (!database.objectStoreNames.contains(STORES.operations)) {
    const store = createStore(database, STORES.operations, ["generationId", "record.operationId"]);
    store.createIndex(
      "by_campaign_idempotency",
      ["generationId", "record.campaignId", "record.idempotencyKey"],
      { unique: true }
    );
    store.createIndex("by_campaign_operation", [
      "generationId",
      "record.campaignId",
      "record.operationId"
    ], { unique: true });
  }
  if (!database.objectStoreNames.contains(STORES.commands)) {
    const store = createStore(database, STORES.commands, ["generationId", "record.commandId"]);
    store.createIndex("by_campaign", ["generationId", "record.campaignId"]);
    store.createIndex("by_campaign_command", [
      "generationId",
      "record.campaignId",
      "record.commandId"
    ], { unique: true });
    store.createIndex("by_commit", ["generationId", "record.commitId"]);
  }
  if (!database.objectStoreNames.contains(STORES.events)) {
    const store = createStore(database, STORES.events, ["generationId", "record.eventId"]);
    store.createIndex(
      "by_campaign_order",
      ["generationId", "record.campaignId", "record.commitSequence", "record.eventSequence"],
      { unique: true }
    );
    store.createIndex("by_campaign_event", [
      "generationId",
      "record.campaignId",
      "record.eventId"
    ], { unique: true });
    store.createIndex("by_commit", ["generationId", "record.commitId"]);
  }
  if (!database.objectStoreNames.contains(STORES.commits)) {
    const store = createStore(database, STORES.commits, ["generationId", "record.commitId"]);
    store.createIndex(
      "by_campaign_idempotency",
      ["generationId", "record.campaignId", "record.idempotencyKey"],
      { unique: true }
    );
    store.createIndex(
      "by_campaign_sequence",
      ["generationId", "record.campaignId", "record.commitSequence"],
      { unique: true }
    );
    store.createIndex("by_campaign_commit", [
      "generationId",
      "record.campaignId",
      "record.commitId"
    ], { unique: true });
  }
  if (!database.objectStoreNames.contains(STORES.outbox)) {
    const store = createStore(database, STORES.outbox, ["generationId", "record.taskId"]);
    store.createIndex(
      "by_claimable",
      ["generationId", "campaignId", "claimableAt", "record.taskId"]
    );
    store.createIndex("by_campaign_task", [
      "generationId",
      "campaignId",
      "record.taskId"
    ], { unique: true });
    store.createIndex("by_commit", ["generationId", "record.commitId"]);
  }
}
