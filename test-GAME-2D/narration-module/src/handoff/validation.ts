import type {
  ProcessHandoffV1,
  ProcessOutcomeV1,
  RestOutcomeV1,
  RestSeedV1,
  TacticalEncounterSeedV1,
  TacticalOutcomeV1
} from "./types";
import { HANDOFF_CONTRACT_VERSION } from "./types";

export interface HandoffValidationResult {
  valid: boolean;
  issues: string[];
}

function ok(issues: string[]): HandoffValidationResult {
  return { valid: issues.length === 0, issues };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function array(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function commonProcessIssues(value: unknown): string[] {
  if (!isObject(value)) return ["Process handoff must be an object."];
  const issues: string[] = [];
  if (value.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (value.contractVersion !== HANDOFF_CONTRACT_VERSION) issues.push("contractVersion must be tactical-rest-handoff/1.");
  for (const field of ["processId", "campaignId", "sourceOperationId", "sourceSceneId", "idempotencyKey"]) {
    if (!nonEmptyString(value[field])) issues.push(`${field} must be a non-empty string.`);
  }
  if (value.processKind !== "TACTICAL_ENCOUNTER" && value.processKind !== "REST") {
    issues.push("processKind must be TACTICAL_ENCOUNTER or REST.");
  }
  if (!["PROPOSED", "ACTIVE", "SUSPENDED", "COMPLETED_PENDING_INTEGRATION", "INTEGRATED", "FAILED"].includes(String(value.status))) {
    issues.push("status is not a valid process handoff status.");
  }
  if (!nonNegativeNumber(value.createdAtGameSecond)) issues.push("createdAtGameSecond must be a non-negative number.");
  if (!array(value.sourceRefs)) issues.push("sourceRefs must be an array.");
  if (value.version !== 1) issues.push("version must be 1.");
  return issues;
}

export function validateProcessHandoffV1(value: unknown): HandoffValidationResult {
  return ok(commonProcessIssues(value));
}

function seedCommonIssues(value: unknown, kind: "tactical" | "rest"): string[] {
  if (!isObject(value)) return [`${kind} seed must be an object.`];
  const issues: string[] = [];
  if (value.schemaVersion !== 1) issues.push("seed.schemaVersion must be 1.");
  if (value.contractVersion !== HANDOFF_CONTRACT_VERSION) issues.push("seed.contractVersion must be tactical-rest-handoff/1.");
  for (const field of ["seedId", "processId", "campaignId", "sceneId", "seedFingerprint"]) {
    if (!nonEmptyString(value[field])) issues.push(`seed.${field} must be a non-empty string.`);
  }
  if (!nonNegativeNumber(value.startedAtGameSecond)) issues.push("seed.startedAtGameSecond must be a non-negative number.");
  if (!isObject(value.locationRef)) issues.push("seed.locationRef must be an object.");
  if (!isObject(value.rulesetRef)) issues.push("seed.rulesetRef must be an object.");
  if (!array(value.sourceAggregateRefs)) issues.push("seed.sourceAggregateRefs must be an array.");
  if (value.version !== 1) issues.push("seed.version must be 1.");
  return issues;
}

export function validateTacticalEncounterSeedV1(value: unknown): HandoffValidationResult {
  const issues = seedCommonIssues(value, "tactical");
  if (!isObject(value)) return ok(issues);
  for (const field of ["cause", "stakes", "lightingAndVisibility", "surpriseState"]) {
    if (!isObject(value[field])) issues.push(`seed.${field} must be an object.`);
  }
  for (const field of [
    "objectives",
    "participants",
    "teams",
    "entryZones",
    "exitZones",
    "knownTerrain",
    "weatherAndHazards",
    "initialPositions",
    "allowedEndConditions"
  ]) {
    if (!array(value[field])) issues.push(`seed.${field} must be an array.`);
  }
  if (!isObject(value.tacticalMapRef) && !isObject(value.mapGenerationRequest)) {
    issues.push("seed must provide tacticalMapRef or mapGenerationRequest.");
  }
  return ok(issues);
}

export function validateRestSeedV1(value: unknown): HandoffValidationResult {
  const issues = seedCommonIssues(value, "rest");
  if (!isObject(value)) return ok(issues);
  if (!nonEmptyString(value.restKind)) issues.push("seed.restKind must be explicit.");
  if (!nonNegativeNumber(value.targetDurationSeconds) || value.targetDurationSeconds <= 0) {
    issues.push("seed.targetDurationSeconds must be a positive number.");
  }
  for (const field of [
    "participants",
    "availableSupplies",
    "availableActivities",
    "riskSources",
    "nearbyWorldEvents",
    "requiredQuestions"
  ]) {
    if (!array(value[field])) issues.push(`seed.${field} must be an array.`);
  }
  if (!isObject(value.safetyProfile)) issues.push("seed.safetyProfile must be an object.");
  if (!isObject(value.watchPlan)) issues.push("seed.watchPlan must be an object.");
  return ok(issues);
}

function outcomeCommonIssues(value: unknown): string[] {
  if (!isObject(value)) return ["Outcome must be an object."];
  const issues: string[] = [];
  if (value.schemaVersion !== 1) issues.push("outcome.schemaVersion must be 1.");
  if (value.contractVersion !== HANDOFF_CONTRACT_VERSION) issues.push("outcome.contractVersion must be tactical-rest-handoff/1.");
  for (const field of ["outcomeId", "processId", "campaignId", "sourceOperationId", "finalStateFingerprint", "integrationIdempotencyKey"]) {
    if (!nonEmptyString(value[field])) issues.push(`outcome.${field} must be a non-empty string.`);
  }
  if (!nonNegativeNumber(value.elapsedGameSeconds)) issues.push("outcome.elapsedGameSeconds must be a non-negative number.");
  for (const field of ["domainDeltas", "eventDrafts", "uiNotifications", "memoryCandidates", "sourceRefs"]) {
    if (!array(value[field])) issues.push(`outcome.${field} must be an array.`);
  }
  if (!isObject(value.narrativeProjection)) issues.push("outcome.narrativeProjection must be an object.");
  if (value.version !== 1) issues.push("outcome.version must be 1.");
  if (array(value.domainDeltas)) {
    for (const [index, delta] of value.domainDeltas.entries()) {
      if (!isObject(delta)) {
        issues.push(`outcome.domainDeltas[${index}] must be an object.`);
        continue;
      }
      for (const field of ["deltaId", "aggregateType", "aggregateId", "summary"]) {
        if (!nonEmptyString(delta[field])) issues.push(`outcome.domainDeltas[${index}].${field} must be a non-empty string.`);
      }
      if (delta.expectedAggregateRevision !== null && !nonNegativeNumber(delta.expectedAggregateRevision)) {
        issues.push(`outcome.domainDeltas[${index}].expectedAggregateRevision must be null or a non-negative number.`);
      }
      if (!nonNegativeNumber(delta.payloadSchemaVersion)) issues.push(`outcome.domainDeltas[${index}].payloadSchemaVersion must be a number.`);
      if (!isObject(delta.payload)) issues.push(`outcome.domainDeltas[${index}].payload must be an object.`);
    }
  }
  return issues;
}

export function validateProcessOutcomeV1(value: unknown): HandoffValidationResult {
  const issues = outcomeCommonIssues(value);
  if (isObject(value) && !["COMPLETED", "ABORTED", "INTERRUPTED", "FAILED", "PARTIAL"].includes(String(value.status))) {
    issues.push("outcome.status is not valid.");
  }
  return ok(issues);
}

export function validateTacticalOutcomeV1(value: unknown): HandoffValidationResult {
  const issues = validateProcessOutcomeV1(value).issues;
  if (!isObject(value)) return ok(issues);
  if (value.processKind !== "TACTICAL_ENCOUNTER") issues.push("tactical outcome processKind must be TACTICAL_ENCOUNTER.");
  for (const field of [
    "turnJournal",
    "finalParticipantStates",
    "casualtiesAndConditions",
    "resourceChanges",
    "finalPositions",
    "placeDamage",
    "engagedSpeechAndKnowledge",
    "availableLoot",
    "consequenceCandidates",
    "checkpointRefs"
  ]) {
    if (!array(value[field])) issues.push(`tactical outcome.${field} must be an array.`);
  }
  if (!nonEmptyString(value.endCondition)) issues.push("tactical outcome.endCondition must be a non-empty string.");
  return ok(issues);
}

export function validateRestOutcomeV1(value: unknown): HandoffValidationResult {
  const issues = outcomeCommonIssues(value);
  if (!isObject(value)) return ok(issues);
  if (value.processKind !== "REST") issues.push("rest outcome processKind must be REST.");
  if (!["COMPLETED", "PARTIAL", "INTERRUPTED", "FAILED"].includes(String(value.status))) {
    issues.push("rest outcome.status is not valid.");
  }
  for (const field of [
    "acquiredBenefits",
    "refusedBenefits",
    "remainingPossibleBenefits",
    "healthFatigueConditionChanges",
    "resourceChanges",
    "consumptions",
    "completedActivities",
    "hygieneAndPresentationChanges",
    "livedEventsAndConversations",
    "worldConsequences",
    "appliedRuleRefs"
  ]) {
    if (!array(value[field])) issues.push(`rest outcome.${field} must be an array.`);
  }
  if (value.interruptionReason !== null && !nonEmptyString(value.interruptionReason)) {
    issues.push("rest outcome.interruptionReason must be null or a non-empty string.");
  }
  return ok(issues);
}

export function assertValidHandoff<T>(result: HandoffValidationResult, value: T): T {
  if (!result.valid) throw new Error(`Invalid tactical-rest-handoff/1 payload: ${result.issues.join(" | ")}`);
  return value;
}

export function isRestOutcomeV1(value: ProcessOutcomeV1): value is RestOutcomeV1 {
  return (value as RestOutcomeV1).processKind === "REST";
}

export function isTacticalOutcomeV1(value: ProcessOutcomeV1): value is TacticalOutcomeV1 {
  return (value as TacticalOutcomeV1).processKind === "TACTICAL_ENCOUNTER";
}
