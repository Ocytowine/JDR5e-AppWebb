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
  const allowedActions = new Set(["ask_possibility", "ask", "open", "force", "observe", "act"]);
  const allowedSemanticKinds = new Set(["address_visible_actor", "manipulate_visible_object", "observe_environment", "nonverbal_signal", "hypothetical_action", "context_question", "meta_request", "unclear_intent"]);
  const allowedRuntimeStatuses = new Set(["SUPPORTED_BY_CURRENT_RUNTIME", "UNSUPPORTED_DOMAIN", "NEEDS_CLARIFICATION", "AI_INTERPRETATION_FAILED"]);
  const allowedRuntimeDomains = new Set(["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world"]);

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
      "referentResolution",
      "requiresClarification",
      "runtimeHandling",
      "riskFlags",
      "semanticIntent",
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
    if (!(intent.action === null || allowedActions.has(intent.action))) issues.push(issue(`${path}.action`, "expected canonical action or null"));
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
    issues.push(...validateSemanticIntent(intent.semanticIntent, path, allowedTargetKinds, allowedCommitments, allowedConfidence, allowedSemanticKinds));
    issues.push(...validateRuntimeHandling(intent.runtimeHandling, path, allowedActions, allowedRuntimeStatuses, allowedRuntimeDomains));
    issues.push(...validateReferentResolution(intent.referentResolution, path, allowedTargetKinds, allowedConfidence));

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
    if (isObject(intent.semanticIntent) && intent.semanticIntent.commitment !== intent.commitment) {
      issues.push(issue(`${path}.semanticIntent.commitment`, "must match top-level commitment"));
    }
    if (isObject(intent.runtimeHandling) && intent.runtimeHandling.status === "NEEDS_CLARIFICATION" && intent.requiresClarification !== true) {
      issues.push(issue(`${path}.runtimeHandling.status`, "NEEDS_CLARIFICATION requires requiresClarification=true"));
    }
    if (isObject(intent.runtimeHandling) && intent.runtimeHandling.status === "AI_INTERPRETATION_FAILED") {
      issues.push(issue(`${path}.runtimeHandling.status`, "failed interpretation must not be accepted as OK output"));
    }
    if (isObject(intent.runtimeHandling) && typeof intent.runtimeHandling.canonicalActionHint === "string" && intent.action !== null && intent.runtimeHandling.canonicalActionHint !== intent.action) {
      issues.push(issue(`${path}.runtimeHandling.canonicalActionHint`, "must match action when both are provided"));
    }
    if (/succ[eè]s|r[eé]ussit|[eé]chec|secret r[eé]v[eé]l[eé]|combat gagn[eé]|inventaire/iu.test(intent.coreMeaning)) {
      issues.push(issue(`${path}.coreMeaning`, "must not contain outcome, secret, combat or inventory authority"));
    }
  });
  return issues;
}

function validateSemanticIntent(
  value: unknown,
  path: string,
  allowedTargetKinds: Set<string>,
  allowedCommitments: Set<string>,
  allowedConfidence: Set<string>,
  allowedSemanticKinds: Set<string>
): string[] {
  const semanticPath = `${path}.semanticIntent`;
  if (!isObject(value)) return [issue(semanticPath, "expected object")];
  const issues: string[] = [];
  issues.push(...exactKeys(value, [
    "commitment",
    "confidence",
    "evidenceFromInput",
    "forbiddenInterpretations",
    "kind",
    "playerGoal",
    "schemaVersion",
    "target",
    "uncertainties"
  ], semanticPath));
  if (value.schemaVersion !== 1) issues.push(issue(`${semanticPath}.schemaVersion`, "expected 1"));
  if (typeof value.kind !== "string" || !allowedSemanticKinds.has(value.kind)) issues.push(issue(`${semanticPath}.kind`, "invalid semantic kind"));
  issues.push(...validateNonEmptyString(value.playerGoal, `${semanticPath}.playerGoal`));
  if (typeof value.commitment !== "string" || !allowedCommitments.has(value.commitment)) issues.push(issue(`${semanticPath}.commitment`, "invalid commitment"));
  if (!isStringArray(value.evidenceFromInput) || value.evidenceFromInput.length === 0) issues.push(issue(`${semanticPath}.evidenceFromInput`, "expected non-empty string array"));
  if (!isStringArray(value.uncertainties)) issues.push(issue(`${semanticPath}.uncertainties`, "expected string array"));
  if (!isStringArray(value.forbiddenInterpretations)) issues.push(issue(`${semanticPath}.forbiddenInterpretations`, "expected string array"));
  if (typeof value.confidence !== "string" || !allowedConfidence.has(value.confidence)) issues.push(issue(`${semanticPath}.confidence`, "invalid confidence"));
  if (value.target !== null) {
    if (!isObject(value.target)) {
      issues.push(issue(`${semanticPath}.target`, "expected object or null"));
    } else {
      issues.push(...exactKeys(value.target, ["kind", "label", "ref"], `${semanticPath}.target`));
      if (typeof value.target.kind !== "string" || !allowedTargetKinds.has(value.target.kind)) issues.push(issue(`${semanticPath}.target.kind`, "invalid target kind"));
      if (value.target.ref !== null && typeof value.target.ref !== "string") issues.push(issue(`${semanticPath}.target.ref`, "expected string or null"));
      if (value.target.label !== null && typeof value.target.label !== "string") issues.push(issue(`${semanticPath}.target.label`, "expected string or null"));
    }
  }
  return issues;
}

function validateRuntimeHandling(
  value: unknown,
  path: string,
  allowedActions: Set<string>,
  allowedRuntimeStatuses: Set<string>,
  allowedRuntimeDomains: Set<string>
): string[] {
  const runtimePath = `${path}.runtimeHandling`;
  if (!isObject(value)) return [issue(runtimePath, "expected object")];
  const issues: string[] = [];
  issues.push(...exactKeys(value, [
    "canonicalActionHint",
    "noCommit",
    "noGameTime",
    "reason",
    "requiredDomain",
    "schemaVersion",
    "status"
  ], runtimePath));
  if (value.schemaVersion !== 1) issues.push(issue(`${runtimePath}.schemaVersion`, "expected 1"));
  if (typeof value.status !== "string" || !allowedRuntimeStatuses.has(value.status)) issues.push(issue(`${runtimePath}.status`, "invalid status"));
  issues.push(...validateNonEmptyString(value.reason, `${runtimePath}.reason`));
  if (!(value.requiredDomain === null || (typeof value.requiredDomain === "string" && allowedRuntimeDomains.has(value.requiredDomain)))) {
    issues.push(issue(`${runtimePath}.requiredDomain`, "invalid domain or null"));
  }
  if (!(value.canonicalActionHint === null || (typeof value.canonicalActionHint === "string" && allowedActions.has(value.canonicalActionHint)))) {
    issues.push(issue(`${runtimePath}.canonicalActionHint`, "expected canonical action or null"));
  }
  if (typeof value.noCommit !== "boolean") issues.push(issue(`${runtimePath}.noCommit`, "expected boolean"));
  if (typeof value.noGameTime !== "boolean") issues.push(issue(`${runtimePath}.noGameTime`, "expected boolean"));
  return issues;
}

function validateReferentResolution(
  value: unknown,
  path: string,
  allowedTargetKinds: Set<string>,
  allowedConfidence: Set<string>
): string[] {
  if (value === null) return [];
  const referentPath = `${path}.referentResolution`;
  if (!isObject(value)) return [issue(referentPath, "expected object or null")];
  const issues: string[] = [];
  issues.push(...exactKeys(value, [
    "ambiguity",
    "confidence",
    "evidence",
    "resolvedTarget",
    "schemaVersion",
    "source",
    "usedPreviousContext"
  ], referentPath));
  if (value.schemaVersion !== 1) issues.push(issue(`${referentPath}.schemaVersion`, "expected 1"));
  if (typeof value.usedPreviousContext !== "boolean") issues.push(issue(`${referentPath}.usedPreviousContext`, "expected boolean"));
  if (typeof value.source !== "string" || !["current_input", "recent_visible_focus", "visible_scene", "none"].includes(value.source)) {
    issues.push(issue(`${referentPath}.source`, "invalid source"));
  }
  if (!isStringArray(value.evidence)) issues.push(issue(`${referentPath}.evidence`, "expected string array"));
  if (typeof value.ambiguity !== "string" || !["none", "multiple_candidates", "incompatible_action", "insufficient_context", "unknown"].includes(value.ambiguity)) {
    issues.push(issue(`${referentPath}.ambiguity`, "invalid ambiguity"));
  }
  if (typeof value.confidence !== "string" || !allowedConfidence.has(value.confidence)) issues.push(issue(`${referentPath}.confidence`, "invalid confidence"));
  if (value.resolvedTarget !== null) {
    if (!isObject(value.resolvedTarget)) {
      issues.push(issue(`${referentPath}.resolvedTarget`, "expected object or null"));
    } else {
      issues.push(...exactKeys(value.resolvedTarget, ["kind", "label", "ref"], `${referentPath}.resolvedTarget`));
      if (typeof value.resolvedTarget.kind !== "string" || !allowedTargetKinds.has(value.resolvedTarget.kind)) issues.push(issue(`${referentPath}.resolvedTarget.kind`, "invalid target kind"));
      if (value.resolvedTarget.ref !== null && typeof value.resolvedTarget.ref !== "string") issues.push(issue(`${referentPath}.resolvedTarget.ref`, "expected string or null"));
      if (value.resolvedTarget.label !== null && typeof value.resolvedTarget.label !== "string") issues.push(issue(`${referentPath}.resolvedTarget.label`, "expected string or null"));
    }
  }
  return issues;
}

function validatePlannerPayload(payload: unknown): string[] {
  if (!isObject(payload)) return ["payload: expected object"];
  const typed = payload as Partial<MjPlannerPayloadV1>;
  const issues: string[] = [];
  issues.push(...exactKeys(payload, [
    "actorAssignments",
    "commandProposals",
    "creationProposals",
    "forbiddenOutcomes",
    "planId",
    "planningBasis",
    "playerHandoff",
    "respectedCommitmentRefs",
    "revealPlan",
    "riskFlags",
    "sceneBeats",
    "schemaVersion",
    "timeAdvanceProposal"
  ], "payload"));
  if (typed.schemaVersion !== 1) issues.push("payload.schemaVersion: expected 1");
  issues.push(...validateNonEmptyString(typed.planId, "payload.planId"));
  if (!isObject(typed.planningBasis)) {
    issues.push("payload.planningBasis: expected object");
  } else {
    issues.push(...exactKeys(typed.planningBasis, ["intentId", "requiredDomain", "runtimeStatus", "semanticGoal"], "payload.planningBasis"));
    issues.push(...validateNonEmptyString(typed.planningBasis.intentId, "payload.planningBasis.intentId"));
    issues.push(...validateNonEmptyString(typed.planningBasis.semanticGoal, "payload.planningBasis.semanticGoal"));
    if (!["SUPPORTED_BY_CURRENT_RUNTIME", "UNSUPPORTED_DOMAIN", "NEEDS_CLARIFICATION", "AI_INTERPRETATION_FAILED"].includes(String(typed.planningBasis.runtimeStatus))) {
      issues.push("payload.planningBasis.runtimeStatus: invalid status");
    }
    if (!(typed.planningBasis.requiredDomain === null || ["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world"].includes(String(typed.planningBasis.requiredDomain)))) {
      issues.push("payload.planningBasis.requiredDomain: invalid domain or null");
    }
  }
  if (!Array.isArray(typed.sceneBeats)) {
    issues.push("payload.sceneBeats: expected array");
  } else {
    typed.sceneBeats.forEach((beat, index) => {
      const path = `payload.sceneBeats[${index}]`;
      if (!isObject(beat)) {
        issues.push(`${path}: expected object`);
        return;
      }
      issues.push(...validateNonEmptyString(beat.beatId, `${path}.beatId`));
      if (!["CONTEXT_RESPONSE", "LOCAL_ACTION_ATTEMPT", "ACTOR_REACTION_EXPECTED", "DOMAIN_BLOCKED", "CLARIFICATION"].includes(String(beat.kind))) issues.push(`${path}.kind: invalid beat kind`);
      if (!isStringArray(beat.actorIds)) issues.push(`${path}.actorIds: expected string array`);
      issues.push(...validateNonEmptyString(beat.stopCondition, `${path}.stopCondition`));
    });
  }
  const allowedDomains = ["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world"];
  if (!Array.isArray(typed.commandProposals)) {
    issues.push("payload.commandProposals: expected array");
  } else {
    typed.commandProposals.forEach((proposal, index) => {
      const path = `payload.commandProposals[${index}]`;
      if (!isObject(proposal)) {
        issues.push(`${path}: expected object`);
        return;
      }
      issues.push(...validateNonEmptyString(proposal.proposalId, `${path}.proposalId`));
      if (!allowedDomains.includes(String(proposal.domain))) issues.push(`${path}.domain: invalid domain`);
      issues.push(...validateNonEmptyString(proposal.commandType, `${path}.commandType`));
      if (!isStringArray(proposal.targetRefs)) issues.push(`${path}.targetRefs: expected string array`);
      if (!isObject(proposal.payload)) issues.push(`${path}.payload: expected object`);
      if (proposal.commitAuthority !== false) issues.push(`${path}.commitAuthority: expected false`);
    });
  }
  if (!Array.isArray(typed.creationProposals)) issues.push("payload.creationProposals: expected array");
  if (!Array.isArray(typed.actorAssignments)) {
    issues.push("payload.actorAssignments: expected array");
  } else {
    typed.actorAssignments.forEach((assignment, index) => {
      const path = `payload.actorAssignments[${index}]`;
      if (!isObject(assignment)) {
        issues.push(`${path}: expected object`);
        return;
      }
      if (!["intent_interpreter", "player_intent_interpreter", "mj_planner", "player_expression_adapter", "npc_performer", "rules_adjudicator", "coherence_critic", "scene_writer", "clarification_writer"].includes(String(assignment.role))) issues.push(`${path}.role: invalid role`);
      if (!(assignment.actorId === null || typeof assignment.actorId === "string")) issues.push(`${path}.actorId: expected string or null`);
      issues.push(...validateNonEmptyString(assignment.reason, `${path}.reason`));
    });
  }
  if (!isObject(typed.revealPlan) || !isStringArray(typed.revealPlan.reveal) || !isStringArray(typed.revealPlan.hint) || !isStringArray(typed.revealPlan.withhold)) {
    issues.push("payload.revealPlan: expected reveal/hint/withhold arrays");
  }
  if (!isObject(typed.playerHandoff)) {
    issues.push("payload.playerHandoff: expected object");
  } else {
    if (!["ASK_PLAYER", "CONTINUE_AUTOMATICALLY", "CLARIFY", "END_TURN"].includes(String(typed.playerHandoff.handoffKind))) issues.push("payload.playerHandoff.handoffKind: invalid handoff");
    issues.push(...validateNonEmptyString(typed.playerHandoff.reason, "payload.playerHandoff.reason"));
  }
  if (typed.timeAdvanceProposal !== null) issues.push("payload.timeAdvanceProposal: mini mj_planner must not propose time yet");
  if (!isStringArray(typed.riskFlags)) issues.push("payload.riskFlags: expected string array");
  if (!isStringArray(typed.respectedCommitmentRefs)) issues.push("payload.respectedCommitmentRefs: expected string array");
  if (!isStringArray(typed.forbiddenOutcomes)) issues.push("payload.forbiddenOutcomes: expected string array");
  if (isObject(typed.revealPlan) && Array.isArray(typed.revealPlan.reveal) && typed.revealPlan.reveal.length > 0) {
    issues.push("payload.revealPlan.reveal: mini mj_planner must not reveal facts");
  }
  if (Array.isArray(typed.creationProposals) && typed.creationProposals.length > 0) {
    issues.push("payload.creationProposals: mini mj_planner must not create persistent candidates");
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
