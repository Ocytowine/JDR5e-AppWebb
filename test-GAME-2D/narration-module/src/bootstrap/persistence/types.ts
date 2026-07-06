import type {
  AcceptedCommandRecord,
  AggregateRecord,
  CampaignRecord,
  CommitRecord,
  EventRecord,
  OperationRecord,
  OutboxTaskRecord
} from "../../core/contracts/types";

export interface CampaignBootstrapPersistenceRequestV1 {
  schemaVersion: 1;
  campaign: CampaignRecord;
  operation: OperationRecord;
  initialAggregates: AggregateRecord[];
  acceptedCommands: AcceptedCommandRecord[];
  events: EventRecord[];
  outboxTasks: OutboxTaskRecord[];
  commit: CommitRecord;
}

export interface CampaignBootstrapPersistenceResultV1 {
  campaign: CampaignRecord;
  operation: OperationRecord;
  commit: CommitRecord;
}

export type BootstrapFailurePoint =
  | "BOOTSTRAP_AFTER_CAMPAIGN"
  | "BOOTSTRAP_AFTER_OPERATION"
  | "BOOTSTRAP_AFTER_AGGREGATES"
  | "BOOTSTRAP_AFTER_COMMANDS"
  | "BOOTSTRAP_AFTER_EVENTS"
  | "BOOTSTRAP_AFTER_OUTBOX"
  | "BOOTSTRAP_AFTER_COMMIT"
  | "BOOTSTRAP_BEFORE_PUBLISH";
