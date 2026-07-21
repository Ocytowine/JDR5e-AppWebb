import type { AiIntentRuntimeHandlingV1, AiStructuredSemanticIntentV1 } from "../ai/types";
import { routeNarrativeSemanticIntentV1 } from "./runtimeCapabilityRouting";

export const INTENT_CLARIFICATION_CONTRACT_VERSION_V1 = "intent-clarification/1" as const;

export type NarrativeIntentTypeV1 =
  | "meta_question"
  | "possibility_query"
  | "memory_recall"
  | "speech"
  | "action"
  | "mixed"
  | "unclear_commitment";

export type NarrativeIntentCommitmentV1 = "none" | "hypothetical" | "conditional" | "committed" | "unclear";

export interface NarrativeIntentTargetV1 {
  kind: "npc" | "place" | "object" | "self" | "unknown";
  ref: string | null;
  label: string | null;
}

export interface NarrativeIntentReferentResolutionV1 {
  schemaVersion: 1;
  usedPreviousContext: boolean;
  source: "current_input" | "recent_visible_focus" | "visible_scene" | "none";
  resolvedTarget: NarrativeIntentTargetV1 | null;
  evidence: string[];
  ambiguity: "none" | "multiple_candidates" | "incompatible_action" | "insufficient_context" | "unknown";
  confidence: "low" | "medium" | "high";
}

export interface NarrativeRuntimeDecisionV1 {
  schemaVersion: 1;
  source: "LOCAL_CAPABILITY_REGISTRY";
  status: AiIntentRuntimeHandlingV1["status"];
  requiredDomain: AiIntentRuntimeHandlingV1["requiredDomain"];
  reason: string;
  noCommit: boolean;
  noGameTime: boolean;
  aiSuggestionMatched: boolean;
}

export interface NarrativeIntentInterpretationV1 {
  schemaVersion: 1;
  contractVersion: typeof INTENT_CLARIFICATION_CONTRACT_VERSION_V1;
  intentId: string;
  intentType: NarrativeIntentTypeV1;
  commitment: NarrativeIntentCommitmentV1;
  target?: NarrativeIntentTargetV1 | null;
  action?: string | null;
  semanticIntent: AiStructuredSemanticIntentV1;
  runtimeHandling?: AiIntentRuntimeHandlingV1 | null;
  runtimeDecision: NarrativeRuntimeDecisionV1;
  referentResolution?: NarrativeIntentReferentResolutionV1 | null;
  coreMeaning: string;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  expectedTimeEffect: "NO_GAME_TIME" | "DOMAIN_TO_DECIDE";
  safetyNotes: string[];
}

export interface SuspendedIntentRecordV1 {
  schemaVersion: 1;
  contractVersion: typeof INTENT_CLARIFICATION_CONTRACT_VERSION_V1;
  suspendedIntentId: string;
  operationId: string;
  rawInput: string;
  knownInterpretation: NarrativeIntentInterpretationV1;
  missingField: "commitment" | "target" | "meaning";
  question: string;
  noGameTime: true;
  createdAt: string;
}

export interface ClarificationResumeV1 {
  schemaVersion: 1;
  contractVersion: typeof INTENT_CLARIFICATION_CONTRACT_VERSION_V1;
  suspendedIntentId: string;
  answerRawInput: string;
  resumedCommitment: "hypothetical" | "committed" | "unclear";
  noGameTime: true;
}

export function interpretNarrativeInputV1(input: {
  intentId: string;
  rawInput: string;
}): NarrativeIntentInterpretationV1 {
  const text = normalize(input.rawInput);
  const hasQuestion = /[?？]/u.test(input.rawInput) || /^(est[- ]ce|peux|puis|peut|comment|pourquoi|combien|où|quand|quelle|quel|quels|quelles)\b/u.test(text);
  const asksPossibility = /\b(peux|puis|possible|possibilité|est[- ]ce que je peux|ai[- ]je le droit)\b/u.test(text);
  const mentionsRules = /\b(règle|regle|mécanique|mecanique|jet|bonus|action bonus|mj|interface|comment ça marche|comment ca marche)\b/u.test(text);
  const riskyAction = /\b(voler|attaque|attaquer|frapper|forcer|crocheter|menacer|mentir|fouiller|prendre|ouvrir|entrer)\b/u.test(text);
  const socialPossibility = /\b(parler|discuter|questionner|interroger|adresser|demander)\b/u.test(text);
  const explicitAttempt = /\b(je tente|j'essaie|j essaie|je fais|je vole|j'attaque|j attaque|je frappe|je force|je crochete|je prends|j'ouvre|j ouvre)\b/u.test(text);
  const socialSpeechStatement = /\b(j'aimerais|j aimerais|j'aimerai|j aimerai|je voudrais|je souhaite)\b.*\b(parler|discuter|questionner|interroger|demander)\b/u.test(text);
  const speechLike = /["«»]/u.test(input.rawInput) || /\b(je dis|je réponds|je reponds|je lui dis|je demande à|je demande a|je demande au|je demande aux)\b/u.test(text);
  const actionLike = explicitAttempt || /\b(je vais|je me dirige|j'avance|j avance|je regarde|j'observe|j observe)\b/u.test(text);

  if (hasQuestion && mentionsRules && !riskyAction) {
    return intent(input, "meta_question", "none", "NO_GAME_TIME", false, null, [
      "Question méta protégée: aucune action de jeu déclenchée."
    ]);
  }

  if (hasQuestion && asksPossibility && riskyAction && !explicitAttempt) {
    return intent(input, "possibility_query", "hypothetical", "NO_GAME_TIME", false, null, [
      "Question de possibilité: l'action évoquée ne doit pas être exécutée."
    ]);
  }

  if (hasQuestion && asksPossibility && socialPossibility && !explicitAttempt) {
    return intent(input, "possibility_query", "hypothetical", "NO_GAME_TIME", false, null, [
      "Question de possibilité sociale: aucune parole ou action n'est exécutée."
    ]);
  }

  if (hasQuestion && riskyAction && !explicitAttempt) {
    return intent(input, "unclear_commitment", "unclear", "NO_GAME_TIME", true, buildCommitmentQuestion(input.rawInput), [
      "Engagement ambigu: clarification obligatoire avant toute résolution."
    ]);
  }

  if (speechLike && actionLike) {
    return intent(input, "mixed", "committed", "DOMAIN_TO_DECIDE", false, null, [
      "Entrée mixte détectée mais non résolue en I-06E."
    ]);
  }

  if (socialSpeechStatement) {
    return intent(input, "speech", "committed", "DOMAIN_TO_DECIDE", false, null, [
      "Intention sociale de parole detectee sans resultat social accorde."
    ]);
  }

  if (speechLike) {
    return intent(input, "speech", "committed", "DOMAIN_TO_DECIDE", false, null, [
      "Parole détectée mais non reformulée en I-06E."
    ]);
  }

  if (actionLike || explicitAttempt) {
    return intent(input, "action", "committed", "DOMAIN_TO_DECIDE", false, null, [
      "Action détectée mais non résolue en I-06E."
    ]);
  }

  if (hasQuestion) {
    return intent(input, "meta_question", "none", "NO_GAME_TIME", false, null, [
      "Question sans engagement fictionnel détectée."
    ]);
  }

  return intent(input, "unclear_commitment", "unclear", "NO_GAME_TIME", true, buildCommitmentQuestion(input.rawInput), [
    "Entrée insuffisamment explicite: clarification requise."
  ]);
}

export function createSuspendedIntentRecordV1(input: {
  suspendedIntentId: string;
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  createdAt: string;
}): SuspendedIntentRecordV1 {
  return {
    schemaVersion: 1,
    contractVersion: INTENT_CLARIFICATION_CONTRACT_VERSION_V1,
    suspendedIntentId: input.suspendedIntentId,
    operationId: input.operationId,
    rawInput: input.rawInput,
    knownInterpretation: input.interpretation,
    missingField: "commitment",
    question: input.interpretation.clarificationQuestion ?? buildCommitmentQuestion(input.rawInput),
    noGameTime: true,
    createdAt: input.createdAt
  };
}

export function resumeSuspendedIntentV1(input: {
  suspendedIntentId: string;
  answerRawInput: string;
}): ClarificationResumeV1 {
  const text = normalize(input.answerRawInput);
  const committed = /\b(oui|je tente|j'essaie|j essaie|je le fais|je veux le faire|vas-y|effectivement)\b/u.test(text);
  const hypothetical = /\b(non|je demande|juste savoir|seulement savoir|c'était une question|c etait une question|hypothèse|hypothese)\b/u.test(text);
  return {
    schemaVersion: 1,
    contractVersion: INTENT_CLARIFICATION_CONTRACT_VERSION_V1,
    suspendedIntentId: input.suspendedIntentId,
    answerRawInput: input.answerRawInput,
    resumedCommitment: committed ? "committed" : hypothetical ? "hypothetical" : "unclear",
    noGameTime: true
  };
}

function intent(
  input: { intentId: string; rawInput: string },
  intentType: NarrativeIntentTypeV1,
  commitment: NarrativeIntentCommitmentV1,
  expectedTimeEffect: "NO_GAME_TIME" | "DOMAIN_TO_DECIDE",
  requiresClarification: boolean,
  clarificationQuestion: string | null,
  safetyNotes: string[]
): NarrativeIntentInterpretationV1 {
  const coreMeaning = input.rawInput.trim();
  const semanticIntent = buildCompatibleSemanticIntentV1({
    intentType,
    commitment,
    target: null,
    coreMeaning,
    requiresClarification,
    safetyNotes
  });
  return {
    schemaVersion: 1,
    contractVersion: INTENT_CLARIFICATION_CONTRACT_VERSION_V1,
    intentId: input.intentId,
    intentType,
    commitment,
    semanticIntent,
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
      semanticIntent,
      runtimeSuggestion: null,
      requiresClarification
    }),
    coreMeaning,
    requiresClarification,
    clarificationQuestion,
    expectedTimeEffect,
    safetyNotes
  };
}

export function validateCanonicalIntentAuthorityV1(
  interpretation: NarrativeIntentInterpretationV1
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const semantic = interpretation.semanticIntent;
  const isFailureDiagnostic = interpretation.runtimeHandling?.status === "AI_INTERPRETATION_FAILED";
  if (interpretation.commitment !== semantic.commitment) issues.push("legacy commitment contradicts semanticIntent.commitment");
  const expectedIntentTypes: Record<AiStructuredSemanticIntentV1["kind"], NarrativeIntentTypeV1[]> = {
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
  if (!isFailureDiagnostic && !expectedIntentTypes[semantic.kind].includes(interpretation.intentType)) issues.push("legacy intentType contradicts semanticIntent.kind");
  if (semantic.kind === "address_visible_actor" && interpretation.action !== null && interpretation.action !== undefined && interpretation.action !== "ask" && interpretation.action !== "act") {
    issues.push("legacy action contradicts address_visible_actor");
  }
  const semanticRef = semantic.target?.ref ?? null;
  const legacyRef = interpretation.target?.ref ?? null;
  const resolvedRef = interpretation.referentResolution?.resolvedTarget?.ref ?? null;
  if (semanticRef !== legacyRef) issues.push("legacy target contradicts semanticIntent.target");
  if (resolvedRef !== null && resolvedRef !== semanticRef) issues.push("resolved target contradicts semanticIntent.target");
  const semanticNeedsClarification = semantic.kind === "unclear_intent" || semantic.commitment === "unclear" || semantic.confidence === "low";
  if (!isFailureDiagnostic && semanticNeedsClarification && !interpretation.requiresClarification) issues.push("requiresClarification contradicts semanticIntent");
  const expectedRuntime = evaluateNarrativeRuntimeDecisionV1({
    semanticIntent: semantic,
    runtimeSuggestion: interpretation.runtimeHandling ?? null,
    requiresClarification: interpretation.requiresClarification
  });
  if (
    interpretation.runtimeDecision.status !== expectedRuntime.status ||
    interpretation.runtimeDecision.requiredDomain !== expectedRuntime.requiredDomain ||
    interpretation.runtimeDecision.noCommit !== expectedRuntime.noCommit ||
    interpretation.runtimeDecision.noGameTime !== expectedRuntime.noGameTime
  ) issues.push("runtimeDecision contradicts local evaluation of semanticIntent");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function isAiInterpretationFailureDiagnosticV1(
  interpretation: NarrativeIntentInterpretationV1
): boolean {
  return interpretation.runtimeHandling?.status === "AI_INTERPRETATION_FAILED" ||
    interpretation.runtimeDecision.status === "AI_INTERPRETATION_FAILED";
}

export function buildCompatibleSemanticIntentV1(input: {
  intentType: NarrativeIntentTypeV1;
  commitment: NarrativeIntentCommitmentV1;
  target?: NarrativeIntentTargetV1 | null;
  coreMeaning: string;
  requiresClarification: boolean;
  safetyNotes?: string[];
}): AiStructuredSemanticIntentV1 {
  return {
    schemaVersion: 1,
    kind: legacySemanticKind(input.intentType),
    playerGoal: input.coreMeaning,
    target: input.target ?? null,
    commitment: input.commitment,
    evidenceFromInput: [input.coreMeaning].filter(Boolean),
    uncertainties: input.requiresClarification ? ["intention à clarifier"] : [],
    forbiddenInterpretations: input.commitment === "hypothetical" || input.commitment === "unclear"
      ? ["execute_without_confirmed_commitment"]
      : [],
    confidence: input.requiresClarification ? "medium" : "high",
    perception: null
  };
}

export function evaluateNarrativeRuntimeDecisionV1(input: {
  semanticIntent: AiStructuredSemanticIntentV1;
  runtimeSuggestion: AiIntentRuntimeHandlingV1 | null;
  requiresClarification: boolean;
}): NarrativeRuntimeDecisionV1 {
  const suggestion = input.runtimeSuggestion;
  if (suggestion?.status === "AI_INTERPRETATION_FAILED") {
    return decision("AI_INTERPRETATION_FAILED", null, "Interprétation IA indisponible ou rejetée: aucune exploitation runtime locale.", true, true);
  }
  if (input.requiresClarification || input.semanticIntent.commitment === "unclear" || input.semanticIntent.confidence === "low") {
    return decision("NEEDS_CLARIFICATION", null, "Le registre local refuse toute progression tant que l'intention reste incertaine.", true, suggestion?.status === "NEEDS_CLARIFICATION");
  }
  const route = routeNarrativeSemanticIntentV1({ semanticIntent: input.semanticIntent, runtimeSuggestion: suggestion });
  const supported = route.disposition === "HANDLE";
  const status = route.disposition === "CLARIFY"
    ? "NEEDS_CLARIFICATION"
    : supported
      ? "SUPPORTED_BY_CURRENT_RUNTIME"
      : "UNSUPPORTED_DOMAIN";
  return decision(
    status,
    route.requiredDomain,
    route.reason,
    route.commitPolicy === "FORBIDDEN",
    suggestion?.status === status && suggestion.requiredDomain === route.requiredDomain
  );
}

function decision(
  status: NarrativeRuntimeDecisionV1["status"],
  requiredDomain: NarrativeRuntimeDecisionV1["requiredDomain"],
  reason: string,
  noCommit: boolean,
  aiSuggestionMatched: boolean
): NarrativeRuntimeDecisionV1 {
  return {
    schemaVersion: 1,
    source: "LOCAL_CAPABILITY_REGISTRY",
    status,
    requiredDomain,
    reason,
    noCommit,
    noGameTime: true,
    aiSuggestionMatched
  };
}

export function upgradeLegacyNarrativeIntentInterpretationV1(value: unknown): NarrativeIntentInterpretationV1 | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || candidate.contractVersion !== INTENT_CLARIFICATION_CONTRACT_VERSION_V1) return null;
  if (typeof candidate.intentId !== "string" || typeof candidate.intentType !== "string") return null;
  if (typeof candidate.commitment !== "string" || typeof candidate.coreMeaning !== "string") return null;
  if (typeof candidate.requiresClarification !== "boolean" || !Array.isArray(candidate.safetyNotes)) return null;
  if (isNarrativeSemanticIntentV1(candidate.semanticIntent) && isNarrativeRuntimeDecisionV1(candidate.runtimeDecision)) {
    return value as NarrativeIntentInterpretationV1;
  }
  const legacy = value as Omit<NarrativeIntentInterpretationV1, "semanticIntent" | "runtimeDecision">;
  const semanticIntent = isNarrativeSemanticIntentV1(candidate.semanticIntent)
    ? candidate.semanticIntent
    : buildCompatibleSemanticIntentV1({
      intentType: legacy.intentType,
      commitment: legacy.commitment,
      target: legacy.target,
      coreMeaning: legacy.coreMeaning,
      requiresClarification: legacy.requiresClarification,
      safetyNotes: legacy.safetyNotes
    });
  return {
    ...legacy,
    semanticIntent,
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
      semanticIntent,
      runtimeSuggestion: legacy.runtimeHandling ?? null,
      requiresClarification: legacy.requiresClarification
    })
  };
}

export function isNarrativeRuntimeDecisionV1(value: unknown): value is NarrativeRuntimeDecisionV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === 1 &&
    candidate.source === "LOCAL_CAPABILITY_REGISTRY" &&
    typeof candidate.status === "string" &&
    typeof candidate.reason === "string" &&
    typeof candidate.noCommit === "boolean" &&
    typeof candidate.noGameTime === "boolean" &&
    typeof candidate.aiSuggestionMatched === "boolean";
}

export function isNarrativeSemanticIntentV1(value: unknown): value is AiStructuredSemanticIntentV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === 1 &&
    typeof candidate.kind === "string" &&
    typeof candidate.playerGoal === "string" &&
    typeof candidate.commitment === "string" &&
    Array.isArray(candidate.evidenceFromInput) &&
    candidate.evidenceFromInput.every(entry => typeof entry === "string") &&
    Array.isArray(candidate.uncertainties) &&
    candidate.uncertainties.every(entry => typeof entry === "string") &&
    Array.isArray(candidate.forbiddenInterpretations) &&
    candidate.forbiddenInterpretations.every(entry => typeof entry === "string") &&
    typeof candidate.confidence === "string" &&
    (candidate.perception === null || isNarrativePerceptionRequestV1(candidate.perception)) &&
    (candidate.dialogueAct === undefined || candidate.dialogueAct === null || isNarrativeDialogueActV1(candidate.dialogueAct));
}

function isNarrativeDialogueActV1(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === 1 &&
    ["INITIATE_CONVERSATION", "ASK_QUESTION", "MAKE_STATEMENT", "REQUEST_ACTION", "OTHER"].includes(String(candidate.act)) &&
    typeof candidate.contentGoal === "string" && candidate.contentGoal.trim().length > 0 &&
    (candidate.addresseeRef === null || typeof candidate.addresseeRef === "string");
}

function isNarrativePerceptionRequestV1(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.schemaVersion === 1 &&
    (candidate.depth === "GLANCE" || candidate.depth === "FOCUSED" || candidate.depth === "SEARCH") &&
    typeof candidate.focus === "string" && candidate.focus.trim().length > 0 &&
    (candidate.soughtInformation === null || typeof candidate.soughtInformation === "string");
}

function legacySemanticKind(intentType: NarrativeIntentTypeV1): AiStructuredSemanticIntentV1["kind"] {
  if (intentType === "meta_question") return "meta_request";
  if (intentType === "possibility_query") return "hypothetical_action";
  if (intentType === "memory_recall") return "context_question";
  if (intentType === "speech") return "address_visible_actor";
  if (intentType === "action") return "manipulate_visible_object";
  if (intentType === "mixed") return "unclear_intent";
  return "unclear_intent";
}

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function buildCommitmentQuestion(rawInput: string): string {
  return `Tu demandes si c'est possible, ou tu veux réellement tenter cette action : « ${rawInput.trim()} » ?`;
}
