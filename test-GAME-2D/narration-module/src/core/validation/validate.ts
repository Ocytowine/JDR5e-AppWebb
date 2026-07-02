import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import type {
  AcceptedCommandDraft,
  AcceptedCommandRecord,
  AggregateRecord,
  CampaignClockPayload,
  CampaignRecord,
  CommitRecord,
  CommitRequest,
  CoreError,
  EventDraft,
  EventRecord,
  OperationRecord,
  OutboxTaskDraft,
  OutboxTaskRecord,
  WriterLease
} from "../contracts/types";
import { canonicalizeJson, jsonByteLength } from "../canonical-json/canonicalJson";
import {
  acceptedCommandDraftSchema,
  acceptedCommandRecordSchema,
  aggregateRecordSchema,
  campaignRecordSchema,
  clockPayloadSchema,
  commitRecordSchema,
  commitRequestSchema,
  coreErrorSchema,
  eventDraftSchema,
  eventRecordSchema,
  operationRecordSchema,
  outboxTaskDraftSchema,
  outboxTaskRecordSchema,
  writerLeaseSchema
} from "./schemas";

export const CORE_LIMITS = {
  requestPayloadBytes: 256 * 1024,
  resultPayloadBytes: 1024 * 1024,
  errorDetailsBytes: 64 * 1024,
  commandEventTaskPayloadBytes: 256 * 1024,
  aggregatePayloadBytes: 2 * 1024 * 1024,
  commitRequestBytes: 8 * 1024 * 1024,
  collectionItems: 1024,
  pageItems: 1024
} as const;

export type ValidationResult = { valid: true } | { valid: false; issues: string[] };

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: true });

function compile<T>(schema: object): ValidateFunction<T> {
  return ajv.compile<T>(schema);
}

const validators = {
  campaign: compile<CampaignRecord>(campaignRecordSchema),
  clock: compile<CampaignClockPayload>(clockPayloadSchema),
  aggregate: compile<AggregateRecord>(aggregateRecordSchema),
  operation: compile<OperationRecord>(operationRecordSchema),
  commandDraft: compile<AcceptedCommandDraft>(acceptedCommandDraftSchema),
  commandRecord: compile<AcceptedCommandRecord>(acceptedCommandRecordSchema),
  eventDraft: compile<EventDraft>(eventDraftSchema),
  eventRecord: compile<EventRecord>(eventRecordSchema),
  outboxDraft: compile<OutboxTaskDraft>(outboxTaskDraftSchema),
  outboxRecord: compile<OutboxTaskRecord>(outboxTaskRecordSchema),
  commitRequest: compile<CommitRequest>(commitRequestSchema),
  commitRecord: compile<CommitRecord>(commitRecordSchema),
  lease: compile<WriterLease>(writerLeaseSchema),
  error: compile<CoreError>(coreErrorSchema)
};

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(error => `${error.instancePath || "/"} ${error.message ?? "invalid"}`);
}

function jsonIssue(value: unknown): string | null {
  try {
    canonicalizeJson(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON value.";
  }
}

function validateSchema<T>(validator: ValidateFunction<T>, value: unknown): ValidationResult {
  const issue = jsonIssue(value);
  if (issue) return { valid: false, issues: [issue] };
  return validator(value)
    ? { valid: true }
    : { valid: false, issues: formatErrors(validator.errors) };
}

function merge(base: ValidationResult, issues: string[]): ValidationResult {
  if (!base.valid) issues.unshift(...base.issues);
  return issues.length === 0 ? { valid: true } : { valid: false, issues };
}

function payloadWithin(value: unknown, maximum: number, label: string): string[] {
  try {
    const size = jsonByteLength(value);
    return size <= maximum ? [] : [`${label} exceeds ${maximum} bytes (${size}).`];
  } catch (error) {
    return [error instanceof Error ? error.message : `${label} is invalid.`];
  }
}

function validUtc(value: string): boolean {
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function validateCampaignRecord(value: unknown): ValidationResult {
  const result = validateSchema(validators.campaign, value);
  if (!result.valid) return result;
  const campaign = value as CampaignRecord;
  const issues: string[] = [];
  if (!validUtc(campaign.createdAt) || !validUtc(campaign.updatedAt)) issues.push("Campaign timestamps must be canonical UTC instants.");
  if (campaign.status === "ACTIVE" && campaign.writeBlock !== null) issues.push("An ACTIVE campaign cannot have a writeBlock.");
  if (campaign.status === "READ_ONLY" && campaign.writeBlock === null) issues.push("A READ_ONLY campaign requires a writeBlock.");
  return merge(result, issues);
}

export function validateClockPayload(value: unknown): ValidationResult {
  return validateSchema(validators.clock, value);
}

export function validateAggregateRecord(value: unknown): ValidationResult {
  const result = validateSchema(validators.aggregate, value);
  if (!result.valid) return result;
  return merge(result, payloadWithin((value as AggregateRecord).payload, CORE_LIMITS.aggregatePayloadBytes, "Aggregate payload"));
}

export function validateOperationRecord(value: unknown): ValidationResult {
  const result = validateSchema(validators.operation, value);
  if (!result.valid) return result;
  const operation = value as OperationRecord;
  const issues = [
    ...payloadWithin(operation.requestPayload, CORE_LIMITS.requestPayloadBytes, "Request payload")
  ];
  if (!validUtc(operation.receivedAt) || !validUtc(operation.updatedAt)) issues.push("Operation timestamps must be canonical UTC instants.");

  const resultPair = operation.resultPayloadSchemaVersion !== null && operation.resultPayload !== null;
  if ((operation.resultPayloadSchemaVersion === null) !== (operation.resultPayload === null)) {
    issues.push("Result payload and schema version must both be null or both be present.");
  }
  if (resultPair) issues.push(...payloadWithin(operation.resultPayload, CORE_LIMITS.resultPayloadBytes, "Result payload"));
  if (operation.phase === "COMPLETED" && !resultPair) issues.push("A COMPLETED operation requires a result payload.");
  if (operation.phase !== "COMPLETED" && (resultPair || operation.completionMode !== null)) issues.push("Only COMPLETED operations may carry completion data.");
  if (operation.phase === "FAILED" && operation.failure === null) issues.push("A FAILED operation requires a failure.");
  if (operation.phase !== "FAILED" && operation.failure !== null) issues.push("Only FAILED operations may carry a failure.");
  if (operation.failure) issues.push(...payloadWithin(operation.failure.details, CORE_LIMITS.errorDetailsBytes, "Error details"));

  const committed = operation.phase === "COMMITTED_PENDING_RENDER" || (
    operation.phase === "COMPLETED" &&
    (operation.completionMode === "COMMITTED_RENDERED" || operation.completionMode === "COMMITTED_DEGRADED")
  );
  if (committed !== (operation.commitId !== null)) issues.push("commitId does not match the committed operation state.");
  if (operation.phase === "COMPLETED" && operation.completionMode === null) issues.push("A COMPLETED operation requires a completionMode.");
  return merge(result, issues);
}

export function validateAcceptedCommandDraft(value: unknown): ValidationResult {
  const result = validateSchema(validators.commandDraft, value);
  if (!result.valid) return result;
  return merge(result, payloadWithin((value as AcceptedCommandDraft).payload, CORE_LIMITS.commandEventTaskPayloadBytes, "Command payload"));
}

export function validateAcceptedCommandRecord(value: unknown): ValidationResult {
  const result = validateSchema(validators.commandRecord, value);
  if (!result.valid) return result;
  return merge(result, payloadWithin((value as AcceptedCommandRecord).payload, CORE_LIMITS.commandEventTaskPayloadBytes, "Command payload"));
}

function validateVisibility(event: EventDraft): string[] {
  const actorScoped = event.visibility.scope === "ACTOR_SCOPED";
  if (actorScoped && event.visibility.actorIds.length === 0) return ["ACTOR_SCOPED visibility requires actorIds."];
  if (!actorScoped && event.visibility.actorIds.length !== 0) return ["Only ACTOR_SCOPED visibility may carry actorIds."];
  return [];
}

export function validateEventDraft(value: unknown): ValidationResult {
  const result = validateSchema(validators.eventDraft, value);
  if (!result.valid) return result;
  const event = value as EventDraft;
  return merge(result, [
    ...validateVisibility(event),
    ...payloadWithin(event.payload, CORE_LIMITS.commandEventTaskPayloadBytes, "Event payload")
  ]);
}

export function validateEventRecord(value: unknown): ValidationResult {
  const result = validateSchema(validators.eventRecord, value);
  if (!result.valid) return result;
  const event = value as EventRecord;
  const issues = [
    ...validateVisibility(event),
    ...payloadWithin(event.payload, CORE_LIMITS.commandEventTaskPayloadBytes, "Event payload")
  ];
  if (!validUtc(event.recordedAt)) issues.push("Event recordedAt must be a canonical UTC instant.");
  return merge(result, issues);
}

export function validateOutboxTaskDraft(value: unknown): ValidationResult {
  const result = validateSchema(validators.outboxDraft, value);
  if (!result.valid) return result;
  return merge(result, payloadWithin((value as OutboxTaskDraft).payload, CORE_LIMITS.commandEventTaskPayloadBytes, "Outbox payload"));
}

export function validateOutboxTaskRecord(value: unknown): ValidationResult {
  const result = validateSchema(validators.outboxRecord, value);
  if (!result.valid) return result;
  const task = value as OutboxTaskRecord;
  const issues = payloadWithin(task.payload, CORE_LIMITS.commandEventTaskPayloadBytes, "Outbox payload");
  if (!validUtc(task.createdAt) || !validUtc(task.updatedAt)) issues.push("Outbox timestamps must be canonical UTC instants.");
  if (task.leaseExpiresAt !== null && !validUtc(task.leaseExpiresAt)) issues.push("Invalid outbox lease expiration.");
  if (task.nextAttemptAt !== null && !validUtc(task.nextAttemptAt)) issues.push("Invalid outbox retry instant.");
  if (task.status === "RUNNING" && (task.lockedBy === null || task.leaseExpiresAt === null)) issues.push("RUNNING tasks require a worker lease.");
  if (task.status !== "RUNNING" && (task.lockedBy !== null || task.leaseExpiresAt !== null)) issues.push("Only RUNNING tasks may carry a worker lease.");
  if (task.status === "FAILED_RETRYABLE" && task.nextAttemptAt === null) issues.push("FAILED_RETRYABLE tasks require nextAttemptAt.");
  if (task.status !== "FAILED_RETRYABLE" && task.nextAttemptAt !== null) issues.push("Only FAILED_RETRYABLE tasks may carry nextAttemptAt.");
  if (task.lastError) issues.push(...payloadWithin(task.lastError.details, CORE_LIMITS.errorDetailsBytes, "Error details"));
  return merge(result, issues);
}

export function validateWriterLease(value: unknown): ValidationResult {
  const result = validateSchema(validators.lease, value);
  if (!result.valid) return result;
  const lease = value as WriterLease;
  const issues: string[] = [];
  if (!validUtc(lease.acquiredAt) || !validUtc(lease.expiresAt)) issues.push("Lease timestamps must be canonical UTC instants.");
  if (Date.parse(lease.expiresAt) <= Date.parse(lease.acquiredAt)) issues.push("Lease expiration must be after acquisition.");
  return merge(result, issues);
}

export function validateCommitRequest(value: unknown): ValidationResult {
  const result = validateSchema(validators.commitRequest, value);
  if (!result.valid) return result;
  const request = value as CommitRequest;
  const issues = payloadWithin(request, CORE_LIMITS.commitRequestBytes, "Commit request");
  for (const command of request.acceptedCommands) {
    const child = validateAcceptedCommandDraft(command);
    if (!child.valid) issues.push(...child.issues.map(issue => `command ${command.commandId}: ${issue}`));
  }
  for (const write of request.aggregateWrites) {
    issues.push(...payloadWithin(write.payload, CORE_LIMITS.aggregatePayloadBytes, `aggregate ${write.aggregateId}`));
  }
  for (const event of request.events) {
    const child = validateEventDraft(event);
    if (!child.valid) issues.push(...child.issues.map(issue => `event ${event.eventId}: ${issue}`));
  }
  for (const task of request.outboxTasks) {
    const child = validateOutboxTaskDraft(task);
    if (!child.valid) issues.push(...child.issues.map(issue => `task ${task.taskId}: ${issue}`));
  }
  return merge(result, issues);
}

export function validateCommitRecord(value: unknown): ValidationResult {
  const result = validateSchema(validators.commitRecord, value);
  if (!result.valid) return result;
  const commit = value as CommitRecord;
  const issues: string[] = [];
  if (!validUtc(commit.committedAt)) issues.push("Commit timestamp must be a canonical UTC instant.");
  if (commit.campaignRevision !== commit.previousCampaignRevision + 1) issues.push("Campaign revision must increment by one.");
  if (commit.commitSequence !== commit.campaignRevision) issues.push("Commit sequence must equal campaign revision.");
  return merge(result, issues);
}

export function validateCoreError(value: unknown): ValidationResult {
  const result = validateSchema(validators.error, value);
  if (!result.valid) return result;
  return merge(result, payloadWithin((value as CoreError).details, CORE_LIMITS.errorDetailsBytes, "Error details"));
}
