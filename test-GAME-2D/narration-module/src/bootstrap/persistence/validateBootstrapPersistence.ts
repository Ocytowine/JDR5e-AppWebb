import { canonicalizeJson, jsonByteLength } from "../../core/canonical-json/canonicalJson";
import type { CampaignClockPayload } from "../../core/contracts/types";
import {
  CORE_LIMITS,
  validateAcceptedCommandRecord,
  validateAggregateRecord,
  validateCampaignRecord,
  validateClockPayload,
  validateCommitRecord,
  validateEventRecord,
  validateOperationRecord,
  validateOutboxTaskRecord,
  type ValidationResult
} from "../../core/validation/validate";
import type { CampaignBootstrapPersistenceRequestV1 } from "./types";

const REQUEST_KEYS = [
  "schemaVersion",
  "campaign",
  "operation",
  "initialAggregates",
  "acceptedCommands",
  "events",
  "outboxTasks",
  "commit"
] as const;

function addValidation(issues: string[], label: string, result: ValidationResult): void {
  if (!result.valid) issues.push(...result.issues.map(issue => `${label}: ${issue}`));
}

function sameOrderedValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateCampaignBootstrapPersistenceRequestV1(
  value: unknown
): ValidationResult {
  try {
    canonicalizeJson(value);
  } catch (error) {
    return { valid: false, issues: [error instanceof Error ? error.message : "Invalid JSON value."] };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, issues: ["Bootstrap request must be an object."] };
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = [...REQUEST_KEYS].sort();
  if (!sameOrderedValues(keys, expectedKeys)) {
    return { valid: false, issues: ["Bootstrap request has missing or unknown properties."] };
  }
  if (
    record.schemaVersion !== 1 ||
    !Array.isArray(record.initialAggregates) ||
    !Array.isArray(record.acceptedCommands) ||
    !Array.isArray(record.events) ||
    !Array.isArray(record.outboxTasks)
  ) return { valid: false, issues: ["Bootstrap request envelope is invalid."] };

  const request = value as CampaignBootstrapPersistenceRequestV1;
  const issues: string[] = [];
  if (jsonByteLength(request) > CORE_LIMITS.commitRequestBytes) {
    issues.push(`Bootstrap request exceeds ${CORE_LIMITS.commitRequestBytes} bytes.`);
  }
  for (const [label, values] of [
    ["initialAggregates", request.initialAggregates],
    ["acceptedCommands", request.acceptedCommands],
    ["events", request.events],
    ["outboxTasks", request.outboxTasks]
  ] as const) {
    if (values.length > CORE_LIMITS.collectionItems) issues.push(`${label} exceeds the collection limit.`);
  }

  addValidation(issues, "campaign", validateCampaignRecord(request.campaign));
  addValidation(issues, "operation", validateOperationRecord(request.operation));
  addValidation(issues, "commit", validateCommitRecord(request.commit));
  request.initialAggregates.forEach((entry, index) =>
    addValidation(issues, `initialAggregates[${index}]`, validateAggregateRecord(entry)));
  request.acceptedCommands.forEach((entry, index) =>
    addValidation(issues, `acceptedCommands[${index}]`, validateAcceptedCommandRecord(entry)));
  request.events.forEach((entry, index) =>
    addValidation(issues, `events[${index}]`, validateEventRecord(entry)));
  request.outboxTasks.forEach((entry, index) =>
    addValidation(issues, `outboxTasks[${index}]`, validateOutboxTaskRecord(entry)));
  if (issues.length > 0) return { valid: false, issues };

  const { campaign, operation, commit } = request;
  if (
    campaign.campaignRevision !== 1 || campaign.status !== "ACTIVE" || campaign.writeBlock !== null ||
    campaign.lastCommitId !== commit.commitId
  ) issues.push("Campaign must be ACTIVE at revision 1 and reference the initial commit.");
  if (
    operation.operationKind !== "campaign.bootstrap" || operation.phase !== "COMMITTED_PENDING_RENDER" ||
    operation.observedCampaignRevision !== 0 || operation.commitId !== commit.commitId ||
    operation.completionMode !== null || operation.failure !== null
  ) issues.push("Bootstrap operation must be committed pending render from observed revision 0.");
  if (
    commit.previousCampaignRevision !== 0 || commit.campaignRevision !== 1 || commit.commitSequence !== 1
  ) issues.push("Initial commit must transition campaign revision 0 to revision 1.");
  if (
    operation.campaignId !== campaign.campaignId || commit.campaignId !== campaign.campaignId ||
    commit.operationId !== operation.operationId || commit.idempotencyKey !== operation.idempotencyKey ||
    commit.requestFingerprint !== operation.requestFingerprint
  ) issues.push("Campaign, operation and commit identities do not match.");

  const aggregateKeys = request.initialAggregates.map(entry => `${entry.aggregateType}\u0000${entry.aggregateId}`);
  const commandIds = request.acceptedCommands.map(entry => entry.commandId);
  const eventIds = request.events.map(entry => entry.eventId);
  const taskIds = request.outboxTasks.map(entry => entry.taskId);
  if (!unique(aggregateKeys) || !unique(commandIds) || !unique(eventIds) || !unique(taskIds)) {
    issues.push("Bootstrap record identities must be unique within each collection.");
  }

  const aggregateByKey = new Map(request.initialAggregates.map(entry => [
    `${entry.aggregateType}\u0000${entry.aggregateId}`,
    entry
  ]));
  const clock = aggregateByKey.get(`world.clock\u0000${campaign.clockAggregateId}`);
  if (!clock) issues.push("Bootstrap must contain the campaign clock aggregate.");
  else {
    addValidation(issues, "clock payload", validateClockPayload(clock.payload));
    const payload = clock.payload as CampaignClockPayload;
    if (
      payload.elapsedGameSeconds !== 0 || payload.calendarId !== campaign.dependencies.calendarId ||
      payload.calendarVersion !== campaign.dependencies.calendarVersion
    ) issues.push("Initial clock must be zero and use the pinned calendar.");
  }

  for (const aggregate of request.initialAggregates) {
    if (
      aggregate.campaignId !== campaign.campaignId || aggregate.aggregateRevision !== 0 ||
      aggregate.updatedByCommitId !== commit.commitId
    ) issues.push(`Initial aggregate ${aggregate.aggregateId} has invalid scope or revision.`);
  }
  for (const command of request.acceptedCommands) {
    const target = aggregateByKey.get(`${command.target.aggregateType}\u0000${command.target.aggregateId}`);
    if (
      command.campaignId !== campaign.campaignId || command.operationId !== operation.operationId ||
      command.commitId !== commit.commitId || command.target.expectedAggregateRevision !== null || !target ||
      command.acceptedAtGameSecond !== 0
    ) issues.push(`Accepted command ${command.commandId} is not tied to an initial aggregate.`);
  }

  if (request.events.length !== 1) issues.push("Bootstrap requires exactly one campaign.bootstrapped event.");
  request.events.forEach((event, index) => {
    const refsValid = event.aggregateRefs.every(ref => {
      const target = aggregateByKey.get(`${ref.aggregateType}\u0000${ref.aggregateId}`);
      return target?.aggregateRevision === ref.aggregateRevision;
    });
    if (
      event.campaignId !== campaign.campaignId || event.operationId !== operation.operationId ||
      event.commitId !== commit.commitId || event.eventType !== "campaign.bootstrapped" ||
      event.origin !== "SYSTEM" || event.causation.kind !== "OPERATION" ||
      event.causation.id !== operation.operationId || event.occurredAtGameSecond !== 0 ||
      event.commitSequence !== 1 || event.eventSequence !== index || !refsValid
    ) issues.push(`Bootstrap event ${event.eventId} is invalid.`);
  });

  const eventIdSet = new Set(eventIds);
  for (const task of request.outboxTasks) {
    if (
      task.campaignId !== campaign.campaignId || task.commitId !== commit.commitId ||
      task.status !== "PENDING" || task.attemptCount !== 0 || task.lockedBy !== null ||
      task.leaseExpiresAt !== null || task.nextAttemptAt !== null || task.lastError !== null ||
      task.sourceEventIds.some(eventId => !eventIdSet.has(eventId))
    ) issues.push(`Bootstrap outbox task ${task.taskId} is not in its initial state.`);
  }

  const expectedWrites = request.initialAggregates.map(entry => ({
    aggregateType: entry.aggregateType,
    aggregateId: entry.aggregateId,
    previousRevision: null,
    aggregateRevision: 0
  }));
  if (canonicalizeJson(commit.aggregateWrites) !== canonicalizeJson(expectedWrites)) {
    issues.push("Commit aggregate writes do not match initial aggregates.");
  }
  if (!sameOrderedValues(commit.commandIds, commandIds) || !sameOrderedValues(commit.eventIds, eventIds) ||
      !sameOrderedValues(commit.outboxTaskIds, taskIds)) {
    issues.push("Commit record ids do not match bootstrap collections.");
  }

  return issues.length === 0 ? { valid: true } : { valid: false, issues };
}
