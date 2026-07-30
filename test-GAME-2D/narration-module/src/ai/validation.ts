import { cloneJson } from "../core";
import type {
  AiCallRequestV1,
  AiFailureCategoryV1,
  AiIncidentRecordV1,
  AiIntentInterpretationPayloadV1,
  AiSemanticIntentPayloadV2,
  AiSemanticIntentPayloadV3,
  AiSemanticIntentPayloadV4,
  AiSemanticIntentPayloadV5,
  AiModelRouteV1,
  AiOutputValidationResultV1,
  AiRoleOutputEnvelopeV1,
  DynamicCreationProposalV1,
  DynamicCreationValidationPolicyV1,
  DynamicCreationValidationResultV1,
  IntentInterpreterPayloadV1,
  MjPlannerPayloadV1,
  NpcPerformerPayloadV1,
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
  const allowedSemanticKinds = new Set(["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "traverse_visible_boundary", "observe_environment", "nonverbal_signal", "hypothetical_action", "context_question", "meta_request", "unclear_intent"]);
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
    if (isObject(intent.semanticIntent)) {
      const allowedIntentTypesBySemanticKind: Record<string, string[]> = {
        address_visible_actor: ["speech"],
        move_near_visible_actor: ["action"],
        manipulate_visible_object: ["action"],
        traverse_visible_boundary: ["action"],
        observe_environment: ["action"],
        nonverbal_signal: ["action"],
        hypothetical_action: ["possibility_query"],
        context_question: ["meta_question", "memory_recall"],
        meta_request: ["meta_question"],
        unclear_intent: ["unclear_commitment"]
      };
      const allowedForKind = typeof intent.semanticIntent.kind === "string" ? allowedIntentTypesBySemanticKind[intent.semanticIntent.kind] : undefined;
      if (allowedForKind !== undefined && !allowedForKind.includes(String(intent.intentType))) {
        issues.push(issue(`${path}.intentType`, "must match semanticIntent.kind"));
      }
      const semanticTargetRef = isObject(intent.semanticIntent.target) && typeof intent.semanticIntent.target.ref === "string" ? intent.semanticIntent.target.ref : null;
      const legacyTargetRef = isObject(intent.target) && typeof intent.target.ref === "string" ? intent.target.ref : null;
      if (semanticTargetRef !== legacyTargetRef) issues.push(issue(`${path}.target`, "must match semanticIntent.target"));
      if (intent.semanticIntent.kind === "address_visible_actor" && intent.action !== null && intent.action !== "ask" && intent.action !== "act") {
        issues.push(issue(`${path}.action`, "must not contradict address_visible_actor"));
      }
    }
    if (isObject(intent.runtimeHandling) && intent.runtimeHandling.status === "NEEDS_CLARIFICATION" && intent.requiresClarification !== true) {
      issues.push(issue(`${path}.runtimeHandling.status`, "NEEDS_CLARIFICATION requires requiresClarification=true"));
    }
    if (isObject(intent.runtimeHandling) && intent.runtimeHandling.status === "AI_INTERPRETATION_FAILED") {
      issues.push(issue(`${path}.runtimeHandling.status`, "failed interpretation must not be accepted as OK output"));
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
  const semanticKeys = [
    "commitment",
    "confidence",
    "dialogueAct",
    "evidenceFromInput",
    "forbiddenInterpretations",
    "kind",
    "perception",
    "playerGoal",
    "schemaVersion",
    "target",
    "uncertainties"
  ];
  if (value.restPlan !== undefined) semanticKeys.push("restPlan");
  issues.push(...exactKeys(value, semanticKeys, semanticPath));
  if (value.schemaVersion !== 1) issues.push(issue(`${semanticPath}.schemaVersion`, "expected 1"));
  if (typeof value.kind !== "string" || !allowedSemanticKinds.has(value.kind)) issues.push(issue(`${semanticPath}.kind`, "invalid semantic kind"));
  issues.push(...validateNonEmptyString(value.playerGoal, `${semanticPath}.playerGoal`));
  if (typeof value.commitment !== "string" || !allowedCommitments.has(value.commitment)) issues.push(issue(`${semanticPath}.commitment`, "invalid commitment"));
  if (!isStringArray(value.evidenceFromInput) || value.evidenceFromInput.length === 0) issues.push(issue(`${semanticPath}.evidenceFromInput`, "expected non-empty string array"));
  if (!isStringArray(value.uncertainties)) issues.push(issue(`${semanticPath}.uncertainties`, "expected string array"));
  if (!isStringArray(value.forbiddenInterpretations)) issues.push(issue(`${semanticPath}.forbiddenInterpretations`, "expected string array"));
  if (typeof value.confidence !== "string" || !allowedConfidence.has(value.confidence)) issues.push(issue(`${semanticPath}.confidence`, "invalid confidence"));
  if (value.kind === "observe_environment" && !isObject(value.perception)) {
    issues.push(issue(`${semanticPath}.perception`, "observation requires a structured perception request"));
  } else if (value.kind !== "observe_environment" && value.perception !== null) {
    issues.push(issue(`${semanticPath}.perception`, "must be null outside observe_environment"));
  }
  if (isObject(value.perception)) {
    issues.push(...exactKeys(value.perception, ["depth", "focus", "schemaVersion", "soughtInformation"], `${semanticPath}.perception`));
    if (value.perception.schemaVersion !== 1) issues.push(issue(`${semanticPath}.perception.schemaVersion`, "expected 1"));
    if (!["GLANCE", "FOCUSED", "SEARCH"].includes(String(value.perception.depth))) issues.push(issue(`${semanticPath}.perception.depth`, "invalid perception depth"));
    issues.push(...validateNonEmptyString(value.perception.focus, `${semanticPath}.perception.focus`));
    if (value.perception.soughtInformation !== null && typeof value.perception.soughtInformation !== "string") issues.push(issue(`${semanticPath}.perception.soughtInformation`, "expected string or null"));
  }
  if (value.dialogueAct !== undefined && value.dialogueAct !== null) {
    if (!isObject(value.dialogueAct)) {
      issues.push(issue(`${semanticPath}.dialogueAct`, "expected object or null"));
    } else {
      issues.push(...exactKeys(value.dialogueAct, ["act", "addresseeRef", "contentGoal", "schemaVersion"], `${semanticPath}.dialogueAct`));
      if (value.dialogueAct.schemaVersion !== 1) issues.push(issue(`${semanticPath}.dialogueAct.schemaVersion`, "expected 1"));
      if (!["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"].includes(String(value.dialogueAct.act))) issues.push(issue(`${semanticPath}.dialogueAct.act`, "invalid dialogue act"));
      issues.push(...validateNonEmptyString(value.dialogueAct.contentGoal, `${semanticPath}.dialogueAct.contentGoal`));
      if (value.dialogueAct.addresseeRef !== null && typeof value.dialogueAct.addresseeRef !== "string") issues.push(issue(`${semanticPath}.dialogueAct.addresseeRef`, "expected string or null"));
    }
  }
  if (value.restPlan !== undefined && value.restPlan !== null) {
    if (!isObject(value.restPlan)) {
      issues.push(issue(`${semanticPath}.restPlan`, "expected object or null"));
    } else {
      issues.push(...exactKeys(value.restPlan, ["restKind", "schemaVersion"], `${semanticPath}.restPlan`));
      if (value.restPlan.schemaVersion !== 1) issues.push(issue(`${semanticPath}.restPlan.schemaVersion`, "expected 1"));
      if (![null, "SHORT_REST", "LONG_REST"].includes(value.restPlan.restKind as null | string)) {
        issues.push(issue(`${semanticPath}.restPlan.restKind`, "invalid rest kind or null"));
      }
    }
  }
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
      if (!["intent_interpreter", "player_intent_interpreter", "mj_planner", "player_expression_adapter", "npc_performer", "rules_adjudicator", "coherence_critic", "scene_writer", "scene_creator", "clarification_writer"].includes(String(assignment.role))) issues.push(`${path}.role: invalid role`);
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

function validateNpcPerformerPayload(payload: unknown, request: AiCallRequestV1): string[] {
  if (!isObject(payload)) return ["payload: expected object"];
  const typed = payload as Partial<NpcPerformerPayloadV1>;
  const issues: string[] = [];
  issues.push(...exactKeys(payload, [
    "actorId",
    "durableCommitments",
    "knowledgeUsed",
    "nonVerbalReactions",
    "performanceId",
    "reactionFrame",
    "revealedRefs",
    "safetyConstraints",
    "schemaVersion",
    "utterances"
  ], "payload"));
  if (typed.schemaVersion !== 1) issues.push("payload.schemaVersion: expected 1");
  issues.push(...validateNonEmptyString(typed.performanceId, "payload.performanceId"));
  issues.push(...validateNonEmptyString(typed.actorId, "payload.actorId"));
  if (!isObject(typed.reactionFrame)) {
    issues.push("payload.reactionFrame: expected object");
  } else {
    issues.push(...exactKeys(typed.reactionFrame, ["addressedContentGoal", "responseMode", "schemaVersion", "sourceDialogueAct"], "payload.reactionFrame"));
    if (typed.reactionFrame.schemaVersion !== 1) issues.push("payload.reactionFrame.schemaVersion: expected 1");
    if (!["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"].includes(String(typed.reactionFrame.sourceDialogueAct))) issues.push("payload.reactionFrame.sourceDialogueAct: invalid dialogue act");
    if (!["ACKNOWLEDGE_CONTACT", "ANSWER_QUESTION", "ACKNOWLEDGE_STATEMENT", "RESPOND_TO_REQUEST", "CAUTIOUS_RESPONSE"].includes(String(typed.reactionFrame.responseMode))) issues.push("payload.reactionFrame.responseMode: invalid response mode");
    issues.push(...validateNonEmptyString(typed.reactionFrame.addressedContentGoal, "payload.reactionFrame.addressedContentGoal"));
  }
  if (!isStringArray(typed.nonVerbalReactions)) issues.push("payload.nonVerbalReactions: expected string array");
  if (!isStringArray(typed.durableCommitments) || typed.durableCommitments.length > 0) issues.push("payload.durableCommitments: must be empty");
  if (!isStringArray(typed.revealedRefs) || typed.revealedRefs.length > 0) issues.push("payload.revealedRefs: must be empty");
  if (!isStringArray(typed.knowledgeUsed)) issues.push("payload.knowledgeUsed: expected string array");
  if (!isObject(typed.safetyConstraints)) {
    issues.push("payload.safetyConstraints: expected object");
  } else {
    if (typed.safetyConstraints.noMechanicalSuccess !== true) issues.push("payload.safetyConstraints.noMechanicalSuccess: expected true");
    if (typed.safetyConstraints.noSecretReveal !== true) issues.push("payload.safetyConstraints.noSecretReveal: expected true");
    if (typed.safetyConstraints.noDurableCommitment !== true) issues.push("payload.safetyConstraints.noDurableCommitment: expected true");
    if (typed.safetyConstraints.noStateMutation !== true) issues.push("payload.safetyConstraints.noStateMutation: expected true");
  }
  if (!Array.isArray(typed.utterances) || typed.utterances.length === 0 || typed.utterances.length > 2) {
    issues.push("payload.utterances: expected 1 to 2 utterances");
  } else {
    typed.utterances.forEach((utterance, index) => {
      const path = `payload.utterances[${index}]`;
      if (!isObject(utterance)) {
        issues.push(`${path}: expected object`);
        return;
      }
      issues.push(...validateNonEmptyString(utterance.utteranceId, `${path}.utteranceId`));
      issues.push(...validateNonEmptyString(utterance.text, `${path}.text`));
      if (!isStringArray(utterance.audience)) issues.push(`${path}.audience: expected string array`);
      if (!Array.isArray(utterance.speechActs) || utterance.speechActs.length === 0) {
        issues.push(`${path}.speechActs: expected non-empty array`);
      } else {
        utterance.speechActs.forEach((speechAct, actIndex) => {
          const actPath = `${path}.speechActs[${actIndex}]`;
          if (!isObject(speechAct)) {
            issues.push(`${actPath}: expected object`);
            return;
          }
          if (!["assertion", "question", "refusal"].includes(String(speechAct.type))) issues.push(`${actPath}.type: only assertion, question or refusal allowed in mini npc_performer`);
          issues.push(...validateNonEmptyString(speechAct.content, `${actPath}.content`));
          if (!["known", "believed", "uncertain"].includes(String(speechAct.epistemicBasis))) issues.push(`${actPath}.epistemicBasis: invalid basis for mini npc_performer`);
          if (!isStringArray(speechAct.sourceRefs)) issues.push(`${actPath}.sourceRefs: expected string array`);
        });
      }
    });
  }
  const allowedKnowledgeRefs = npcPerformerAllowedKnowledgeRefs(request);
  if (allowedKnowledgeRefs !== null) {
    for (const ref of typed.knowledgeUsed ?? []) {
      if (!allowedKnowledgeRefs.has(ref)) issues.push(`payload.knowledgeUsed: unsupported knowledge ref ${ref}`);
    }
    for (const [utteranceIndex, utterance] of (typed.utterances ?? []).entries()) {
      for (const [actIndex, speechAct] of (utterance.speechActs ?? []).entries()) {
        for (const ref of speechAct.sourceRefs ?? []) {
          if (!allowedKnowledgeRefs.has(ref)) issues.push(`payload.utterances[${utteranceIndex}].speechActs[${actIndex}].sourceRefs: unsupported knowledge ref ${ref}`);
        }
      }
    }
  }
  return issues;
}

function validateSemanticIntentPayloadV2(payload: unknown, composed = false): string[] {
  if (!isObject(payload)) return ["payload: expected object"];
  const issues = exactKeys(payload, ["intent", "rawInputEcho"], "payload");
  const typed = payload as Partial<AiSemanticIntentPayloadV2>;
  issues.push(...validateNonEmptyString(typed.rawInputEcho, "payload.rawInputEcho"));
  if (!isObject(typed.intent)) return [...issues, "payload.intent: expected object"];
  const intent = typed.intent;
  const path = "payload.intent";
  const intentKeys = ["actionHint", "clarificationPrompt", "commitment", "confidence", "dialogueAct", "domainHint", "kind", "perception", "playerGoal", "preconditions", "scope", "targetMention", "uncertainties"];
  if (composed) intentKeys.push("composition");
  issues.push(...exactKeys(intent, intentKeys, path));
  const kinds = new Set(["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "traverse_visible_boundary", "observe_environment", "nonverbal_signal", "hypothetical_action", "context_question", "meta_request", "unclear_intent"]);
  const commitments = new Set(["none", "hypothetical", "conditional", "committed", "unclear"]);
  const domains = new Set(["scene_resolution", "social", "perception", "inventory", "tactical", "rest", "world"]);
  if (typeof intent.kind !== "string" || !kinds.has(intent.kind)) issues.push(issue(`${path}.kind`, "invalid semantic kind"));
  if (typeof intent.commitment !== "string" || !commitments.has(intent.commitment)) issues.push(issue(`${path}.commitment`, "invalid commitment"));
  if (!isStringArray(intent.preconditions) || intent.preconditions.length > 4 || intent.preconditions.some(entry => entry.trim().length === 0)) issues.push(issue(`${path}.preconditions`, "expected at most four non-empty strings"));
  issues.push(...validateNonEmptyString(intent.playerGoal, `${path}.playerGoal`));
  if (intent.actionHint !== null && typeof intent.actionHint !== "string") issues.push(issue(`${path}.actionHint`, "expected string or null"));
  if (intent.domainHint !== null && (typeof intent.domainHint !== "string" || !domains.has(intent.domainHint))) issues.push(issue(`${path}.domainHint`, "invalid domain or null"));
  if (!["LOCAL_INTERACTION", "SCENE_TRANSITION", "SOCIAL_EXCHANGE", "PERCEPTION", "META", "UNKNOWN"].includes(String(intent.scope))) issues.push(issue(`${path}.scope`, "invalid semantic scope"));
  if (!isStringArray(intent.uncertainties) || intent.uncertainties.length > 4) issues.push(issue(`${path}.uncertainties`, "expected at most four strings"));
  if (intent.clarificationPrompt !== null && typeof intent.clarificationPrompt !== "string") issues.push(issue(`${path}.clarificationPrompt`, "expected string or null"));
  if (!["low", "medium", "high"].includes(String(intent.confidence))) issues.push(issue(`${path}.confidence`, "invalid confidence"));
  if (intent.kind === "hypothetical_action" && intent.commitment !== "hypothetical") issues.push(issue(`${path}.commitment`, "hypothetical_action requires hypothetical commitment"));
  if (intent.commitment === "hypothetical" && intent.kind !== "hypothetical_action") issues.push(issue(`${path}.kind`, "hypothetical commitment requires hypothetical_action"));
  if (intent.targetMention !== null) {
    if (!isObject(intent.targetMention)) issues.push(issue(`${path}.targetMention`, "expected object or null"));
    else {
      issues.push(...exactKeys(intent.targetMention, ["candidateKind", "contextLink", "proposedRef", "surface"], `${path}.targetMention`));
      issues.push(...validateNonEmptyString(intent.targetMention.surface, `${path}.targetMention.surface`));
      if (!["npc", "place", "object", "self", "unknown"].includes(String(intent.targetMention.candidateKind))) issues.push(issue(`${path}.targetMention.candidateKind`, "invalid candidate kind"));
      if (intent.targetMention.proposedRef !== null && typeof intent.targetMention.proposedRef !== "string") issues.push(issue(`${path}.targetMention.proposedRef`, "expected string or null"));
      if (!["EXPLICIT", "RECENT_FOCUS", "SCENE_DESCRIPTION", "NONE"].includes(String(intent.targetMention.contextLink))) issues.push(issue(`${path}.targetMention.contextLink`, "invalid context link"));
    }
  }
  if (intent.kind === "observe_environment" && !isObject(intent.perception)) issues.push(issue(`${path}.perception`, "required for observation"));
  if (intent.kind !== "observe_environment" && intent.perception !== null) issues.push(issue(`${path}.perception`, "must be null outside observation"));
  if (intent.kind === "address_visible_actor" && !isObject(intent.dialogueAct)) issues.push(issue(`${path}.dialogueAct`, "required for speech"));
  if (intent.kind !== "address_visible_actor" && intent.dialogueAct !== null) issues.push(issue(`${path}.dialogueAct`, "must be null outside speech"));
  if ((intent.kind === "unclear_intent" || intent.commitment === "unclear") && (typeof intent.clarificationPrompt !== "string" || intent.clarificationPrompt.trim().length === 0)) issues.push(issue(`${path}.clarificationPrompt`, "required for unclear intention"));
  return issues;
}

function validateSemanticIntentPayloadV3(
  payload: unknown,
  oriented = false,
  maxComponentOrder = oriented ? 3 : 2,
  withSpatialFollowUp = false
): string[] {
  const issues = validateSemanticIntentPayloadV2(payload, true);
  if (!isObject(payload) || !isObject(payload.intent)) return issues;
  const typed = payload as unknown as AiSemanticIntentPayloadV3;
  const composition = typed.intent.composition;
  if (!isObject(composition)) return [...issues, "payload.intent.composition: expected object"];
  const compositionKeys = ["communication", "spatialLeadIn"];
  if (oriented) compositionKeys.push("orientation");
  if (withSpatialFollowUp) compositionKeys.push("spatialFollowUp");
  issues.push(...exactKeys(composition, compositionKeys, "payload.intent.composition"));
  if (composition.spatialLeadIn !== null) {
    const spatial = composition.spatialLeadIn;
    if (!isObject(spatial)) issues.push("payload.intent.composition.spatialLeadIn: expected object or null");
    else {
      issues.push(...exactKeys(spatial, ["kind", "order", "playerGoal"], "payload.intent.composition.spatialLeadIn"));
      if (spatial.kind !== "APPROACH_TARGET") issues.push("payload.intent.composition.spatialLeadIn.kind: invalid kind");
      issues.push(...validateNonEmptyString(spatial.playerGoal, "payload.intent.composition.spatialLeadIn.playerGoal"));
      if (!Number.isInteger(spatial.order) || spatial.order < 1 || spatial.order > maxComponentOrder) issues.push(`payload.intent.composition.spatialLeadIn.order: expected between 1 and ${maxComponentOrder}`);
    }
  }
  if (composition.communication !== null) {
    const communication = composition.communication;
    if (!isObject(communication)) issues.push("payload.intent.composition.communication: expected object or null");
    else {
      issues.push(...exactKeys(communication, ["act", "contentGoal", "mode", "order"], "payload.intent.composition.communication"));
      if (!["SPEECH", "NONVERBAL"].includes(communication.mode)) issues.push("payload.intent.composition.communication.mode: invalid mode");
      issues.push(...validateNonEmptyString(communication.contentGoal, "payload.intent.composition.communication.contentGoal"));
      if (!Number.isInteger(communication.order) || communication.order < 1 || communication.order > maxComponentOrder) issues.push(`payload.intent.composition.communication.order: expected between 1 and ${maxComponentOrder}`);
      if (communication.mode === "SPEECH" && !["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"].includes(String(communication.act))) issues.push("payload.intent.composition.communication.act: required for speech");
      if (communication.mode === "NONVERBAL" && communication.act !== null) issues.push("payload.intent.composition.communication.act: must be null for nonverbal");
    }
  }
  if (composition.spatialLeadIn !== null && composition.communication !== null &&
      composition.spatialLeadIn.order === composition.communication.order) {
    issues.push("payload.intent.composition: component orders must be distinct");
  }
  return issues;
}

function validateSemanticIntentPayloadV4(payload: unknown, extended = false): string[] {
  const issues = validateSemanticIntentPayloadV3(payload, true, extended ? 4 : 3, extended);
  if (!isObject(payload) || !isObject(payload.intent)) return issues;
  const typed = payload as unknown as AiSemanticIntentPayloadV4;
  const composition = typed.intent.composition;
  if (!isObject(composition)) return issues;
  const orientation = composition.orientation;
  if (orientation !== null) {
    if (!isObject(orientation)) issues.push("payload.intent.composition.orientation: expected object or null");
    else {
      issues.push(...exactKeys(orientation, ["kind", "order", "playerGoal"], "payload.intent.composition.orientation"));
      if (orientation.kind !== "LOCATE_VISIBLE_TARGET") issues.push("payload.intent.composition.orientation.kind: invalid kind");
      issues.push(...validateNonEmptyString(orientation.playerGoal, "payload.intent.composition.orientation.playerGoal"));
      if (!Number.isInteger(orientation.order) || orientation.order < 1 || orientation.order > (extended ? 4 : 3)) issues.push(`payload.intent.composition.orientation.order: expected between 1 and ${extended ? 4 : 3}`);
    }
  }
  const perception = typed.intent.perception;
  if (typed.intent.kind === "observe_environment") {
    if (!isObject(perception) || !["PRESENCE", "VISIBLE_TRAIT", "UNCERTAIN_CLUE"].includes(String(perception.informationKind))) {
      issues.push("payload.intent.perception.informationKind: required for V4 observation");
    }
  }
  const orders = [
    orientation?.order,
    composition.spatialLeadIn?.order,
    composition.communication?.order
  ].filter((order): order is number => Number.isInteger(order));
  if (new Set(orders).size !== orders.length) issues.push("payload.intent.composition: component orders must be distinct");
  return issues;
}

function validateSemanticIntentPayloadV5(payload: unknown): string[] {
  const issues = validateSemanticIntentPayloadV4(payload, true);
  if (!isObject(payload) || !isObject(payload.intent)) return issues;
  const typed = payload as unknown as AiSemanticIntentPayloadV5;
  const composition = typed.intent.composition;
  if (!isObject(composition)) return issues;
  const followUp = composition.spatialFollowUp;
  if (followUp !== null) {
    if (!isObject(followUp)) issues.push("payload.intent.composition.spatialFollowUp: expected object or null");
    else {
      issues.push(...exactKeys(followUp, ["kind", "order", "playerGoal"], "payload.intent.composition.spatialFollowUp"));
      if (followUp.kind !== "REPOSITION_AWAY") issues.push("payload.intent.composition.spatialFollowUp.kind: invalid kind");
      issues.push(...validateNonEmptyString(followUp.playerGoal, "payload.intent.composition.spatialFollowUp.playerGoal"));
      if (!Number.isInteger(followUp.order) || followUp.order < 1 || followUp.order > 4) issues.push("payload.intent.composition.spatialFollowUp.order: expected between 1 and 4");
    }
  }
  if (followUp !== null && composition.communication === null) {
    issues.push("payload.intent.composition.spatialFollowUp: requires communication in V5");
  }
  const orders = [
    composition.orientation?.order,
    composition.spatialLeadIn?.order,
    composition.communication?.order,
    followUp?.order
  ].filter((order): order is number => Number.isInteger(order));
  if (new Set(orders).size !== orders.length) issues.push("payload.intent.composition: component orders must be distinct");
  return issues;
}

function npcPerformerAllowedKnowledgeRefs(request: AiCallRequestV1): Set<string> | null {
  if (!isObject(request.input.task) || !isObject(request.input.task.knowledgeEnvelope)) return null;
  const envelope = request.input.task.knowledgeEnvelope;
  const refs = new Set<string>();
  if (isStringArray(envelope.allowedSourceRefs)) envelope.allowedSourceRefs.forEach(ref => refs.add(ref));
  if (isObject(request.input.task.interpretation) && typeof request.input.task.interpretation.intentId === "string") {
    refs.add(`intent:${request.input.task.interpretation.intentId}`);
  }
  if (isStringArray(envelope.publicFactRefs)) envelope.publicFactRefs.forEach(ref => refs.add(ref));
  if (Array.isArray(envelope.priorNpcUtterances)) {
    envelope.priorNpcUtterances.forEach(value => {
      if (!isObject(value)) return;
      if (typeof value.sourceOperationId === "string") refs.add(`operation:${value.sourceOperationId}`);
      if (typeof value.renderOperationId === "string") refs.add(`render-projection:${value.renderOperationId}`);
    });
  }
  return refs;
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
  if (envelope.status !== "OK") {
    issues.push(issue("status", "only OK outputs are usable by the pipeline"));
    if (Array.isArray(envelope.diagnostics)) {
      for (const diagnostic of envelope.diagnostics) {
        if (!isObject(diagnostic)) continue;
        const code = typeof diagnostic.code === "string" ? diagnostic.code : "UNKNOWN_PROVIDER_DIAGNOSTIC";
        const message = typeof diagnostic.message === "string"
          ? diagnostic.message.replace(/\s+/gu, " ").slice(0, 500)
          : "No diagnostic message supplied.";
        issues.push(issue(`providerDiagnostic.${code}`, message));
      }
    }
  }
  if (!Array.isArray(envelope.diagnostics)) issues.push(issue("diagnostics", "expected array"));
  if (envelope.supersedesOutputId !== null && typeof envelope.supersedesOutputId !== "string") issues.push(issue("supersedesOutputId", "expected string or null"));

  if (issues.length === 0) {
    if (request.role === "intent_interpreter") issues.push(...validateIntentPayload(envelope.payload));
    if (request.role === "player_intent_interpreter") issues.push(...(
      request.contractVersion === "ai-intent-semantic/5"
        ? validateSemanticIntentPayloadV5(envelope.payload)
        : request.contractVersion === "ai-intent-semantic/4"
          ? validateSemanticIntentPayloadV4(envelope.payload)
        : request.contractVersion === "ai-intent-semantic/3"
          ? validateSemanticIntentPayloadV3(envelope.payload)
        : request.contractVersion === "ai-intent-semantic/2"
          ? validateSemanticIntentPayloadV2(envelope.payload)
        : validateAiIntentInterpretationPayload(envelope.payload)
    ));
    if (request.role === "mj_planner") issues.push(...validatePlannerPayload(envelope.payload));
    if (request.role === "npc_performer") issues.push(...validateNpcPerformerPayload(envelope.payload, request));
    if (request.role === "player_expression_adapter") issues.push(...validatePlayerExpressionPayload(envelope.payload));
    if (request.role === "coherence_critic") issues.push(...validateCoherenceCriticPayload(envelope.payload));
    if (request.role === "scene_writer") issues.push(...validateSceneWriterPayload(envelope.payload));
    if (request.role === "scene_creator") issues.push(...validateSceneCreatorPayload(envelope.payload, request));
  }

  return {
    schemaVersion: 1,
    outputId: typeof envelope.outputId === "string" ? envelope.outputId : null,
    accepted: issues.length === 0,
    failureCategory: issues.length === 0 ? null : "SCHEMA_VIOLATION",
    issues
  };
}

function validateSceneCreatorPayload(payload: unknown, request: AiCallRequestV1): string[] {
  if (!isObject(payload)) return ["payload: expected object"];
  const v2 = request.contractVersion === "lore-guided-place-candidate/2";
  const expectedKeys = [
    "arrivalSceneId", "displayName", "duplicatePolicy", "expectedEffects",
    "initialTension", "localNorms", "narrativeCommitments", "parentLocationRef", "perceptibleFeatures",
    "populationRoles", "proposalId", "proposedPlaceRef", "reason", "requestedDepth", "summary"
  ];
  if (!v2) expectedKeys.push("connectionIntents");
  const issues = exactKeys(payload, expectedKeys, "payload");
  for (const key of ["proposalId", "displayName", "summary", "initialTension", "proposedPlaceRef", "arrivalSceneId", "parentLocationRef", "reason"] as const) {
    issues.push(...validateNonEmptyString(payload[key], `payload.${key}`));
  }
  if (!["SCENE_EPHEMERAL", "LIGHT_REFERENCE", "FULL_ENTITY"].includes(String(payload.requestedDepth))) issues.push("payload.requestedDepth: invalid depth");
  for (const key of ["perceptibleFeatures", "populationRoles", "localNorms", "expectedEffects", "narrativeCommitments"] as const) {
    if (!isStringArray(payload[key])) issues.push(`payload.${key}: expected string array`);
  }
  if (!["REUSE", "ENRICH", "CREATE_DISTINCT", "POSSIBLE_SAME_AS", "REJECT_IF_SIMILAR"].includes(String(payload.duplicatePolicy))) issues.push("payload.duplicatePolicy: invalid policy");
  const roleContextPack = isObject(request.input.roleContextPack) ? request.input.roleContextPack : null;
  const allowedParentLocationRefs = roleContextPack && isStringArray(roleContextPack.allowedParentLocationRefs)
    ? roleContextPack.allowedParentLocationRefs
    : [];
  if (allowedParentLocationRefs.length > 0 && !allowedParentLocationRefs.includes(String(payload.parentLocationRef))) issues.push("payload.parentLocationRef: not allowed by scene creator context");
  const connectionIntents = payload.connectionIntents;
  if (!v2 && (!Array.isArray(connectionIntents) || connectionIntents.length === 0 || connectionIntents.length > 4)) {
    issues.push("payload.connectionIntents: expected 1 to 4 connections");
  } else if (!v2 && Array.isArray(connectionIntents)) {
    connectionIntents.forEach((connection: unknown, index: number) => {
      const path = `payload.connectionIntents[${index}]`;
      if (!isObject(connection)) {
        issues.push(`${path}: expected object`);
        return;
      }
      issues.push(...exactKeys(connection, ["boundaryRef", "destinationRef", "scale", "sourceRefs", "sourceSceneId"], path));
      for (const key of ["sourceSceneId", "boundaryRef", "destinationRef"] as const) issues.push(...validateNonEmptyString(connection[key], `${path}.${key}`));
      if (!["LOCAL", "TRAVEL"].includes(String(connection.scale))) issues.push(`${path}.scale: invalid scale`);
      if (!isStringArray(connection.sourceRefs) || connection.sourceRefs.length === 0 || connection.sourceRefs.some(ref => ref.trim().length === 0)) issues.push(`${path}.sourceRefs: expected non-empty string array`);
    });
  }
  return issues;
}

function validateCoherenceCriticPayload(payload: unknown): string[] {
  if (!isObject(payload)) return ["payload: expected object"];
  const issues = exactKeys(payload, ["verdict", "findings", "correctionConstraints"], "payload");
  if (!["PASS", "REVISE", "REJECT"].includes(String(payload.verdict))) issues.push("payload.verdict: invalid verdict");
  if (!Array.isArray(payload.findings)) {
    issues.push("payload.findings: expected array");
  } else {
    payload.findings.forEach((finding, index) => {
      const path = `payload.findings[${index}]`;
      if (!isObject(finding)) {
        issues.push(`${path}: expected object`);
        return;
      }
      issues.push(...exactKeys(finding, ["findingId", "severity", "category", "affectedRefs", "explanation"], path));
      issues.push(...validateNonEmptyString(finding.findingId, `${path}.findingId`));
      if (!["INFO", "WARNING", "BLOCKING"].includes(String(finding.severity))) issues.push(`${path}.severity: invalid severity`);
      if (!["AUTHORITY", "PLAYER_AGENCY", "SECRET_LEAK", "PERSPECTIVE", "PLOT_COHERENCE", "RULE_CONFLICT", "DUPLICATE", "UNSUPPORTED_CREATION"].includes(String(finding.category))) issues.push(`${path}.category: invalid category`);
      if (!isStringArray(finding.affectedRefs)) issues.push(`${path}.affectedRefs: expected string array`);
      issues.push(...validateNonEmptyString(finding.explanation, `${path}.explanation`));
    });
  }
  if (!isStringArray(payload.correctionConstraints)) issues.push("payload.correctionConstraints: expected string array");
  if (payload.verdict === "PASS" && ((payload.findings as unknown[])?.length > 0 || (payload.correctionConstraints as unknown[])?.length > 0)) {
    issues.push("payload: PASS must not contain findings or correction constraints");
  }
  if (payload.verdict === "REJECT" && !(payload.findings as unknown[])?.some(finding => isObject(finding) && finding.severity === "BLOCKING")) {
    issues.push("payload.findings: REJECT requires a BLOCKING finding");
  }
  return issues;
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
