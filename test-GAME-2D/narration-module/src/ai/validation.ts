import { cloneJson } from "../core";
import type {
  AiCallRequestV1,
  AiFailureCategoryV1,
  AiIncidentRecordV1,
  AiIntentInterpretationPayloadV1,
  AiModelRouteV1,
  AiOutputValidationResultV1,
  AiRoleOutputEnvelopeV1,
  DynamicCreationProposalV1,
  DynamicCreationValidationPolicyV1,
  DynamicCreationValidationResultV1,
  IntentInterpreterPayloadV1,
  MjPlannerPayloadV1,
  PlayerExpressionPayloadV1,
  SceneWriterPayloadV1
} from "./types";

type ValidationResult = { ok: true } | { ok: false; issues: string[]; category: AiFailureCategoryV1 };

const ENVELOPE_KEYS = [
  "schemaVersion",
  "contractVersion",
  "outputId",
  "callId",
  "attemptId",
  "packId",
  "snapshotId",
  "role",
  "status",
  "payload",
  "diagnostics",
  "supersedesOutputId"
].sort();

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === "string");
}

function issue(path: string, message: string): string {
  return `${path}: ${message}`;
}

function exactKeys(value: Record<string, unknown>, expected: string[], path: string): string[] {
  const actual = Object.keys(value).sort();
  return actual.join("|") === expected.sort().join("|")
    ? []
    : [issue(path, `expected keys ${expected.join(", ")}, received ${actual.join(", ")}`)];
}

function validateNonEmptyString(value: unknown, path: string): string[] {
  return typeof value === "string" && value.length > 0 ? [] : [issue(path, "expected non-empty string")];
}

export function validateAiModelRouteV1(route: unknown, options: { allowRemoteProvider: boolean } = { allowRemoteProvider: false }): ValidationResult {
  if (!isObject(route)) return { ok: false, category: "SCHEMA_VIOLATION", issues: ["route: expected object"] };
  const value = route as Partial<AiModelRouteV1>;
  const issues: string[] = [];
  if (value.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  for (const key of ["routeId", "role", "providerKind", "providerId", "modelId", "modelConfigVersion"] as const) {
    issues.push(...validateNonEmptyString(value[key], key));
  }
  if (value.providerKind === "REMOTE_PROVIDER" && !options.allowRemoteProvider) {
    issues.push(issue("providerKind", "REMOTE_PROVIDER is forbidden in I-05A"));
  }
  if (value.providerKind !== "FAKE_CONTRACT" && value.providerKind !== "REMOTE_PROVIDER") issues.push(issue("providerKind", "invalid provider kind"));
  if (value.certified !== true) issues.push(issue("certified", "route must be certified"));
  if (!isStringArray(value.allowedContractVersions) || value.allowedContractVersions.length === 0) issues.push(issue("allowedContractVersions", "required"));
  for (const key of ["inputTokenLimit", "outputTokenLimit", "timeoutMs"] as const) {
    if (!Number.isInteger(value[key]) || (value[key] ?? 0) <= 0) issues.push(issue(key, "expected positive integer"));
  }
  if (!isStringArray(value.fallbackRouteIds)) issues.push(issue("fallbackRouteIds", "expected string array"));
  return issues.length === 0 ? { ok: true } : { ok: false, category: "AUTHORITY_VIOLATION", issues };
}

export function validateAiCallRequestV1(request: unknown, route: AiModelRouteV1): ValidationResult {
  if (!isObject(request)) return { ok: false, category: "SCHEMA_VIOLATION", issues: ["request: expected object"] };
  const value = request as Partial<AiCallRequestV1>;
  const issues: string[] = [];
  if (value.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  for (const key of ["callId", "operationId", "attemptId", "campaignId", "snapshotId", "packId", "role", "contractVersion", "modelRouteId", "contextFingerprint", "idempotencyKey"] as const) {
    issues.push(...validateNonEmptyString(value[key], key));
  }
  if (value.role !== route.role) issues.push(issue("role", "request role does not match route"));
  if (value.modelRouteId !== route.routeId) issues.push(issue("modelRouteId", "request route does not match"));
  if (typeof value.contractVersion === "string" && !route.allowedContractVersions.includes(value.contractVersion)) {
    issues.push(issue("contractVersion", "contract version is not allowed by route"));
  }
  if (!isObject(value.input)) {
    issues.push(issue("input", "expected object"));
  } else {
    issues.push(...validateNonEmptyString(value.input.instructionsRef, "input.instructionsRef"));
  }
  if (!isObject(value.limits)) {
    issues.push(issue("limits", "expected object"));
  } else {
    if ((value.limits.inputTokenBudget ?? 0) > route.inputTokenLimit) issues.push(issue("limits.inputTokenBudget", "exceeds route input limit"));
    if ((value.limits.outputTokenBudget ?? 0) > route.outputTokenLimit) issues.push(issue("limits.outputTokenBudget", "exceeds route output limit"));
    if ((value.limits.timeoutMs ?? 0) > route.timeoutMs) issues.push(issue("limits.timeoutMs", "exceeds route timeout"));
  }
  return issues.length === 0 ? { ok: true } : { ok: false, category: "SCHEMA_VIOLATION", issues };
}

function validateIntentPayload(payload: unknown): string[] {
  if (!isObject(payload) || !Array.isArray(payload.intents)) return ["payload.intents: expected array"];
  const issues: string[] = [];
  const typed = payload as Partial<IntentInterpreterPayloadV1>;
  typed.intents?.forEach((intent, index) => {
    if (!isObject(intent)) {
      issues.push(issue(`payload.intents[${index}]`, "expected object"));
      return;
    }
    if (intent.intentType === "possibility_query" || intent.intentType === "meta_question") {
      if (intent.commitment !== "none") issues.push(issue(`payload.intents[${index}].commitment`, "meta and possibility queries must not be committed"));
      if (intent.expectedTimeEffect !== "NO_GAME_TIME") issues.push(issue(`payload.intents[${index}].expectedTimeEffect`, "must be NO_GAME_TIME"));
    }
  });
  return issues;
}

function validateAiIntentInterpretationPayload(payload: unknown): string[] {
  if (!isObject(payload)) return ["payload: expected object"];
  const issues: string[] = [];
  const typed = payload as Partial<AiIntentInterpretationPayloadV1>;
  issues.push(...exactKeys(payload, ["rawInputEcho", "intents"], "payload"));
  issues.push(...validateNonEmptyString(typed.rawInputEcho, "payload.rawInputEcho"));
  if (!Array.isArray(typed.intents) || typed.intents.length === 0) {
    issues.push("payload.intents: expected non-empty array");
    return issues;
  }

  const allowedTypes = new Set(["meta_question", "possibility_query", "memory_recall", "speech", "action", "mixed", "unclear_commitment"]);
  const allowedCommitments = new Set(["none", "hypothetical", "conditional", "committed", "unclear"]);
  const allowedTimeEffects = new Set(["NO_GAME_TIME", "DOMAIN_TO_DECIDE"]);
  const allowedConfidence = new Set(["low", "medium", "high"]);
  const allowedTargetKinds = new Set(["npc", "place", "object", "self", "unknown"]);

  typed.intents.forEach((intent, index) => {
    const path = `payload.intents[${index}]`;
    if (!isObject(intent)) {
      issues.push(issue(path, "expected object"));
      return;
    }
    issues.push(...exactKeys(intent, [
      "action",
      "clarificationQuestion",
      "commitment",
      "confidence",
      "coreMeaning",
      "expectedTimeEffect",
      "forbiddenInterpretations",
      "intentId",
      "intentType",
      "openDetails",
      "order",
      "playerImposedDetails",
      "requiresClarification",
      "riskFlags",
      "target",
      "topic"
    ], path));
    issues.push(...validateNonEmptyString(intent.intentId, `${path}.intentId`));
    if (!Number.isInteger(intent.order) || intent.order < 1) issues.push(issue(`${path}.order`, "expected positive integer"));
    if (typeof intent.intentType !== "string" || !allowedTypes.has(intent.intentType)) issues.push(issue(`${path}.intentType`, "invalid intent type"));
    if (typeof intent.commitment !== "string" || !allowedCommitments.has(intent.commitment)) issues.push(issue(`${path}.commitment`, "invalid commitment"));
    issues.push(...validateNonEmptyString(intent.coreMeaning, `${path}.coreMeaning`));
    if (!isStringArray(intent.playerImposedDetails)) issues.push(issue(`${path}.playerImposedDetails`, "expected string array"));
    if (!isStringArray(intent.openDetails)) issues.push(issue(`${path}.openDetails`, "expected string array"));
    if (!isStringArray(intent.forbiddenInterpretations)) issues.push(issue(`${path}.forbiddenInterpretations`, "expected string array"));
    if (typeof intent.requiresClarification !== "boolean") issues.push(issue(`${path}.requiresClarification`, "expected boolean"));
    if (intent.clarificationQuestion !== null && typeof intent.clarificationQuestion !== "string") issues.push(issue(`${path}.clarificationQuestion`, "expected string or null"));
    if (!isStringArray(intent.riskFlags)) issues.push(issue(`${path}.riskFlags`, "expected string array"));
    if (typeof intent.expectedTimeEffect !== "string" || !allowedTimeEffects.has(intent.expectedTimeEffect)) issues.push(issue(`${path}.expectedTimeEffect`, "invalid time effect"));
    if (typeof intent.confidence !== "string" || !allowedConfidence.has(intent.confidence)) issues.push(issue(`${path}.confidence`, "invalid confidence"));
    if (intent.action !== null && typeof intent.action !== "string") issues.push(issue(`${path}.action`, "expected string or null"));
    if (intent.topic !== null && typeof intent.topic !== "string") issues.push(issue(`${path}.topic`, "expected string or null"));
    if (intent.target !== null) {
      if (!isObject(intent.target)) {
        issues.push(issue(`${path}.target`, "expected object or null"));
      } else {
        issues.push(...exactKeys(intent.target, ["kind", "label", "ref"], `${path}.target`));
        if (typeof intent.target.kind !== "string" || !allowedTargetKinds.has(intent.target.kind)) issues.push(issue(`${path}.target.kind`, "invalid target kind"));
        if (intent.target.ref !== null && typeof intent.target.ref !== "string") issues.push(issue(`${path}.target.ref`, "expected string or null"));
        if (intent.target.label !== null && typeof intent.target.label !== "string") issues.push(issue(`${path}.target.label`, "expected string or null"));
      }
    }

    if (intent.intentType === "meta_question" && intent.commitment !== "none") {
      issues.push(issue(`${path}.commitment`, "meta_question must use none"));
    }
    if (intent.intentType === "possibility_query" && intent.commitment !== "hypothetical") {
      issues.push(issue(`${path}.commitment`, "possibility_query must use hypothetical"));
    }
    if ((intent.intentType === "meta_question" || intent.intentType === "possibility_query" || intent.intentType === "unclear_commitment") && intent.expectedTimeEffect !== "NO_GAME_TIME") {
      issues.push(issue(`${path}.expectedTimeEffect`, "non-committed interpretation must not advance game time"));
    }
    if (intent.requiresClarification && (typeof intent.clarificationQuestion !== "string" || intent.clarificationQuestion.trim().length === 0)) {
      issues.push(issue(`${path}.clarificationQuestion`, "required when clarification is needed"));
    }
    if (/succ[eè]s|r[eé]ussit|[eé]chec|secret r[eé]v[eé]l[eé]|combat gagn[eé]|inventaire/iu.test(intent.coreMeaning)) {
      issues.push(issue(`${path}.coreMeaning`, "must not contain outcome, secret, combat or inventory authority"));
    }
  });
  return issues;
}

function validatePlannerPayload(payload: unknown): string[] {
  if (!isObject(payload)) return ["payload: expected object"];
  const typed = payload as Partial<MjPlannerPayloadV1>;
  const issues: string[] = [];
  if (!Array.isArray(typed.sceneBeats)) issues.push("payload.sceneBeats: expected array");
  if (!Array.isArray(typed.commandProposals)) issues.push("payload.commandProposals: expected array");
  if (!Array.isArray(typed.creationProposals)) issues.push("payload.creationProposals: expected array");
  if (!isObject(typed.revealPlan) || !isStringArray(typed.revealPlan.reveal) || !isStringArray(typed.revealPlan.hint) || !isStringArray(typed.revealPlan.withhold)) {
    issues.push("payload.revealPlan: expected reveal/hint/withhold arrays");
  }
  return issues;
}

function validatePlayerExpressionPayload(payload: unknown): string[] {
  if (!isObject(payload)) return ["payload: expected object"];
  const typed = payload as Partial<PlayerExpressionPayloadV1>;
  const issues: string[] = [];
  if (typed.safeToUse !== true) issues.push("payload.safeToUse: expected true");
  if (!isStringArray(typed.addedMeaning) || typed.addedMeaning.length > 0) issues.push("payload.addedMeaning: must be empty");
  if (!isStringArray(typed.omittedMeaning)) issues.push("payload.omittedMeaning: expected array");
  return issues;
}

function validateSceneWriterPayload(payload: unknown): string[] {
  if (!isObject(payload) || !Array.isArray(payload.narrationBlocks)) return ["payload.narrationBlocks: expected array"];
  const typed = payload as unknown as SceneWriterPayloadV1;
  const issues: string[] = [];
  typed.narrationBlocks.forEach((block, index) => {
    if (!isStringArray(block.groundedIn) || block.groundedIn.length === 0) issues.push(issue(`payload.narrationBlocks[${index}].groundedIn`, "required"));
  });
  return issues;
}

export function validateAiRoleOutputEnvelopeV1(output: unknown, request: AiCallRequestV1): AiOutputValidationResultV1 {
  if (!isObject(output)) {
    return { schemaVersion: 1, outputId: null, accepted: false, failureCategory: "INVALID_ENVELOPE", issues: ["output: expected object"] };
  }
  const keyIssues = exactKeys(output, ENVELOPE_KEYS, "output");
  const envelope = output as Partial<AiRoleOutputEnvelopeV1>;
  const issues: string[] = [...keyIssues];
  if (envelope.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (envelope.callId !== request.callId) issues.push(issue("callId", "correlation mismatch"));
  if (envelope.attemptId !== request.attemptId) issues.push(issue("attemptId", "correlation mismatch"));
  if (envelope.packId !== request.packId) issues.push(issue("packId", "correlation mismatch"));
  if (envelope.snapshotId !== request.snapshotId) issues.push(issue("snapshotId", "correlation mismatch"));
  if (envelope.role !== request.role) issues.push(issue("role", "correlation mismatch"));
  if (envelope.contractVersion !== request.contractVersion) issues.push(issue("contractVersion", "correlation mismatch"));
  if (envelope.status !== "OK") issues.push(issue("status", "only OK outputs are usable by the pipeline"));
  if (!Array.isArray(envelope.diagnostics)) issues.push(issue("diagnostics", "expected array"));
  if (envelope.supersedesOutputId !== null && typeof envelope.supersedesOutputId !== "string") issues.push(issue("supersedesOutputId", "expected string or null"));

  if (issues.length === 0) {
    if (request.role === "intent_interpreter") issues.push(...validateIntentPayload(envelope.payload));
    if (request.role === "player_intent_interpreter") issues.push(...validateAiIntentInterpretationPayload(envelope.payload));
    if (request.role === "mj_planner") issues.push(...validatePlannerPayload(envelope.payload));
    if (request.role === "player_expression_adapter") issues.push(...validatePlayerExpressionPayload(envelope.payload));
    if (request.role === "scene_writer") issues.push(...validateSceneWriterPayload(envelope.payload));
  }

  return {
    schemaVersion: 1,
    outputId: typeof envelope.outputId === "string" ? envelope.outputId : null,
    accepted: issues.length === 0,
    failureCategory: issues.length === 0 ? null : "SCHEMA_VIOLATION",
    issues
  };
}

export function intentAllowsMutationV1(payload: IntentInterpreterPayloadV1): boolean {
  return payload.intents.some(intent => intent.commitment === "committed" && intent.intentType !== "meta_question" && intent.intentType !== "possibility_query");
}

function containsSecretRisk(value: unknown): boolean {
  if (typeof value === "string") return /secret|prompt|api[_-]?key|system:/iu.test(value);
  if (Array.isArray(value)) return value.some(containsSecretRisk);
  if (isObject(value)) return Object.entries(value).some(([key, entry]) => /secret|prompt|api[_-]?key|constructor|prototype|__proto__/iu.test(key) || containsSecretRisk(entry));
  return false;
}

export function validateDynamicCreationProposalV1(
  proposal: DynamicCreationProposalV1,
  policy: DynamicCreationValidationPolicyV1
): DynamicCreationValidationResultV1 {
  const issues: string[] = [];
  if (proposal.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (!policy.creativeScope.mayCreate.includes(proposal.proposalType)) issues.push(`Creation type ${proposal.proposalType} is not allowed by CreativeScope.`);
  for (const anchor of proposal.anchors.filter(anchor => anchor.required)) {
    if (!policy.knownAnchorIds.includes(anchor.id)) issues.push(`Required anchor ${anchor.id} is unknown.`);
  }
  if (proposal.visibility === "ACTOR_SCOPED" && !policy.allowActorScopedVisibility) issues.push("ACTOR_SCOPED visibility is not allowed by policy.");
  if (containsSecretRisk(proposal.proposedProperties)) issues.push("Proposed properties contain secret, prompt or prototype-pollution risk.");
  if (policy.duplicateCandidateIds.length > 0 && proposal.duplicatePolicy === "CREATE_DISTINCT") {
    return { ok: false, code: "CREATION_DUPLICATE_REJECTED", issues: [`Duplicate candidates exist: ${policy.duplicateCandidateIds.join(", ")}`] };
  }
  if (issues.some(entry => entry.includes("CreativeScope"))) return { ok: false, code: "CREATION_PERMISSION_DENIED", issues };
  if (issues.some(entry => entry.includes("anchor"))) return { ok: false, code: "CREATION_ANCHOR_MISSING", issues };
  if (issues.some(entry => entry.includes("secret") || entry.includes("prototype"))) return { ok: false, code: "CREATION_SECRET_RISK", issues };
  if (issues.length > 0) return { ok: false, code: "CREATION_VALIDATION_FAILED", issues };

  const decision = proposal.requestedDepth === "SCENE_EPHEMERAL"
    ? "ACCEPT_EPHEMERAL"
    : proposal.requestedDepth === "LIGHT_REFERENCE"
      ? "PROMOTE_LIGHT_REFERENCE"
      : proposal.requestedDepth === "FULL_ENTITY"
        ? "PROMOTE_FULL_ENTITY"
        : "ARCHIVE";
  return { ok: true, decision, proposal: cloneJson(proposal) };
}

function sanitize(value: unknown, redactedFields: string[], path = "details"): unknown {
  if (Array.isArray(value)) return value.map((entry, index) => sanitize(entry, redactedFields, `${path}[${index}]`));
  if (isObject(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (/secret|prompt|api[_-]?key|raw|provider|stack|constructor|prototype|__proto__/iu.test(key)) {
        redactedFields.push(childPath);
        output[key] = "[REDACTED]";
      } else {
        output[key] = sanitize(entry, redactedFields, childPath);
      }
    }
    return output;
  }
  if (typeof value === "string" && /sk-|system:|secret/iu.test(value)) {
    redactedFields.push(path);
    return "[REDACTED]";
  }
  return value;
}

export function createAiIncidentRecordV1(input: Omit<AiIncidentRecordV1, "schemaVersion" | "redacted" | "redactedFields" | "safeDetails"> & {
  unsafeDetails: Record<string, unknown>;
}): AiIncidentRecordV1 {
  const redactedFields: string[] = [];
  const safeDetails = sanitize(input.unsafeDetails, redactedFields) as Record<string, unknown>;
  return {
    schemaVersion: 1,
    incidentId: input.incidentId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    callId: input.callId,
    attemptIds: [...input.attemptIds],
    role: input.role,
    category: input.category,
    severity: input.severity,
    stage: input.stage,
    commitState: input.commitState,
    redacted: redactedFields.length > 0,
    redactedFields,
    safeDetails,
    outcome: input.outcome
  };
}
