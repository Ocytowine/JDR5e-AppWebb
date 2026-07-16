import { computeJsonFingerprint, type JsonObject } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiCallRequestV1,
  AiIncidentRecordV1,
  AiIntentInterpretationPayloadV1,
  AiIntentRuntimeHandlingV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1,
  AiStructuredPlayerIntentV1,
  AiStructuredSemanticIntentV1
} from "../ai/types";
import {
  createSuspendedIntentRecordV1,
  interpretNarrativeInputV1,
  type NarrativeIntentInterpretationV1,
  type NarrativeIntentTargetV1
} from "./intentClarification";
import { REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, findPlayableSceneNpcTargetV1 } from "./playableScene";

export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1 = "ai-intent-interpretation/1" as const;

export interface AiIntentInterpreterConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1;
  retryPolicy: AiRetryPolicyV1;
}

export interface AiIntentInterpretationResultV1 {
  schemaVersion: 1;
  contractVersion: typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1;
  usedAiInterpretation: boolean;
  usedFallback: boolean;
  interpretation: NarrativeIntentInterpretationV1;
  acceptedOutput: AiRoleOutputEnvelopeV1<AiIntentInterpretationPayloadV1> | null;
  interpretationFailure: AiIntentInterpretationFailureV1 | null;
  incidents: AiIncidentRecordV1[];
  safetyNotes: string[];
}

export interface AiIntentInterpretationFailureV1 {
  schemaVersion: 1;
  stage: "PLAYER_INTENT_INTERPRETATION";
  role: "player_intent_interpreter";
  status: "FAILED";
  category: "AI_OUTPUT_INVALID" | "AI_OUTPUT_REJECTED" | "AI_UNAVAILABLE";
  rawInput: string;
  issues: string[];
  noCommit: true;
  noGameTime: true;
  developerSummary: string;
}

export interface LocalReferentHintV1 {
  schemaVersion: 1;
  target: NarrativeIntentTargetV1;
  sourceOperationId: string;
  sourceText: string;
  confidence: "low" | "medium" | "high";
}

export class LocalPlayerIntentInterpreterProviderV1 implements ContractAiProviderV1 {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const task = request.input.task as { rawInput?: unknown; localReferentHints?: unknown };
    const rawInput = typeof task.rawInput === "string" ? task.rawInput : "";
    const localReferentHints = normalizeLocalReferentHints(task.localReferentHints);
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: buildLocalIntentPayload(rawInput, localReferentHints),
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiIntentInterpretationPayloadV1>;
  }
}

export function createDefaultAiIntentInterpreterConfigV1(): AiIntentInterpreterConfigV1 {
  return {
    provider: new LocalPlayerIntentInterpreterProviderV1(),
    route: {
      schemaVersion: 1,
      routeId: "i06x-local-player-intent-interpreter",
      role: "player_intent_interpreter",
      providerKind: "FAKE_CONTRACT",
      providerId: "local-i06x",
      modelId: "local-i06x-intent-fixture",
      modelConfigVersion: "i06x",
      certified: true,
      allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1],
      inputTokenLimit: 2_000,
      outputTokenLimit: 1_000,
      timeoutMs: 1_000,
      fallbackRouteIds: []
    },
    retryPolicy: {
      schemaVersion: 1,
      role: "player_intent_interpreter",
      maxTechnicalRetries: 0,
      maxTargetedCorrections: 0,
      maxFullRegenerations: 0,
      allowFallback: true
    }
  };
}

export async function interpretNarrativeInputWithAiV1(input: {
  campaignId: string;
  operationId: string;
  intentId: string;
  rawInput: string;
  config: AiIntentInterpreterConfigV1;
  localReferentHints?: LocalReferentHintV1[];
}): Promise<AiIntentInterpretationResultV1> {
  const request = await buildIntentInterpreterRequestV1(input);
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    request
  });
  const acceptedOutput = run.acceptedOutput as AiRoleOutputEnvelopeV1<AiIntentInterpretationPayloadV1> | null;
  if (acceptedOutput !== null) {
    const mapped = mapAiIntentToNarrativeInterpretationV1({
      intentId: input.intentId,
      rawInput: input.rawInput,
      payload: acceptedOutput.payload
    });
    if (mapped.ok) {
      return {
        schemaVersion: 1,
        contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
        usedAiInterpretation: true,
        usedFallback: false,
        interpretation: mapped.interpretation,
        acceptedOutput,
        interpretationFailure: null,
        incidents: run.incidents,
        safetyNotes: ["Interprétation IA structurée acceptée sans autorité de commit."]
      };
    }
  }

  const failure = buildInterpretationFailure(input.rawInput, [
    ...(run.validation?.issues ?? []),
    acceptedOutput === null
      ? "No accepted player_intent_interpreter output."
      : "Accepted output could not be mapped to a safe narrative interpretation."
  ]);
  return {
    schemaVersion: 1,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
    usedAiInterpretation: false,
    usedFallback: false,
    interpretation: buildDiagnosticInterpretation(input.intentId, failure),
    acceptedOutput: null,
    interpretationFailure: failure,
    incidents: run.incidents,
    safetyNotes: ["Diagnostic d'échec d'interprétation IA produit sans fallback narratif."]
  };
}

export function buildLocalIntentPayload(rawInput: string, localReferentHints: LocalReferentHintV1[] = []): AiIntentInterpretationPayloadV1 {
  const normalized = normalize(rawInput);
  const localAction = actionLabel(normalized);
  const target = findTarget(rawInput, localReferentHints, localAction);
  const hasQuestion = /[?？]/u.test(rawInput) || /^(est[- ]ce|peux|puis|peut|comment|pourquoi|combien|ou|où|quand|quelle|quel|quels|quelles)\b/u.test(normalized);
  const asksPossibility = /\b(peux|puis|possible|possibilite|est[- ]ce que je peux|ai[- ]je le droit|ce serait possible)\b/u.test(normalized);
  const politeContextRequest = isPoliteContextQuestionText(rawInput);
  const meta = /\b(regle|mecanique|jet|bonus|interface|sauvegarde|comment fonctionne|comment marche|cote regles)\b/u.test(normalized);
  const risky = /\b(voler|vole|ouvrir|entrer|forcer|crocheter|attaquer|attaque|frapper|prendre)\b/u.test(normalized);
  const speech = /\b(je demande|je lui demande|lui demander|je questionne|j'interroge|j interroge|je lui dis|je dis|je reponds|je réponds|parler|discuter|interroger)\b/u.test(normalized);
  const explicitCommittedAction = /\b(je vole|j'attaque|j attaque|je frappe|je prends|je tente|j'essaie|j essaie|j'ouvre|j ouvre|je l'ouvre|je le force|je la force|je force|je crochete)\b/u.test(normalized);
  const action = explicitCommittedAction || /\b(je m'avance|je m avance|je vais|je me dirige|je m'approche|je m approche|je regarde|j'observe|j observe)\b/u.test(normalized);
  const implicitDoorManipulation = /\b(poignee|mecanisme|loquet|battant)\b/u.test(normalized) &&
    /\b(main|pivote|tourne|actionne|abaisse|pousse|tire)\b/u.test(normalized);
  const elliptical = normalized.length < 22 || /^(lui |le garde\s*\??$|et si|je pourrais peut-etre|je pourrais peut etre)/u.test(normalized);

  if (!explicitCommittedAction && elliptical && (risky || /^(et si|je pourrais peut-etre|je pourrais peut etre|le garde\s*\??$)/u.test(normalized))) {
    return payload(rawInput, unclear(rawInput, "Tu veux vraiment tenter cette action, ou seulement savoir si elle est possible ?"));
  }
  if (hasQuestion && meta && !risky) {
    return payload(rawInput, intent(rawInput, "meta_question", "none", null, null, null, "Question méta ou interface.", [], ["fictional_reaction"], false, null, [], "NO_GAME_TIME", "high"));
  }
  if (hasQuestion && politeContextRequest) {
    return payload(rawInput, intent(rawInput, "meta_question", "none", target, null, topic(rawInput), rawInput.trim(), [], ["execute_action"], false, null, [], "NO_GAME_TIME", "high"));
  }
  if (hasQuestion && asksPossibility) {
    return payload(rawInput, intent(rawInput, "possibility_query", "hypothetical", target, "ask_possibility", topic(rawInput), `Demander si ${topic(rawInput) ?? "l'action évoquée"} est possible.`, [], ["execute_action"], false, null, risky ? ["risky_action_hypothetical"] : [], "NO_GAME_TIME", "high"));
  }
  if (speech && target !== null) {
    return payload(rawInput, intent(rawInput, "speech", "committed", target, "ask", topic(rawInput), speechCoreMeaning(rawInput, target.label ?? "la personne ciblée"), imposedDetails(rawInput, target.label), ["reaction_npc", "social_outcome"], false, null, [], "DOMAIN_TO_DECIDE", "high"));
  }
  if (implicitDoorManipulation) {
    const doorTarget = target ?? { kind: "object" as const, ref: "poi:back-room-door", label: "porte du fond" };
    return payload(rawInput, intent(rawInput, "action", "committed", doorTarget, "open", topic(rawInput), "Le personnage manipule le mécanisme du passage visible, probablement pour tenter de l'ouvrir.", [rawInput.trim()], ["automatic_success", "hidden_reveal", "scene_transition"], false, null, ["domain_handoff_possible"], "DOMAIN_TO_DECIDE", "high"));
  }
  if (action) {
    return payload(rawInput, intent(rawInput, "action", "committed", target, localAction, topic(rawInput), `Le personnage tente l'action décrite : ${rawInput.trim()}`, [rawInput.trim()], ["success", "failure", "mechanical_effect"], false, null, risky ? ["domain_handoff_possible"] : [], "DOMAIN_TO_DECIDE", "medium"));
  }
  if (hasQuestion) {
    return payload(rawInput, intent(rawInput, "meta_question", "none", target, null, topic(rawInput), rawInput.trim(), [], ["fictional_reaction"], false, null, [], "NO_GAME_TIME", "medium"));
  }
  return payload(rawInput, unclear(rawInput, `Tu demandes si c'est possible, ou tu veux réellement tenter cette action : « ${rawInput.trim()} » ?`));
}

function payload(rawInput: string, structuredIntent: AiStructuredPlayerIntentV1): AiIntentInterpretationPayloadV1 {
  return { rawInputEcho: rawInput, intents: [structuredIntent] };
}

function intent(
  rawInput: string,
  intentType: AiStructuredPlayerIntentV1["intentType"],
  commitment: AiStructuredPlayerIntentV1["commitment"],
  target: AiStructuredPlayerIntentV1["target"],
  action: string | null,
  topicValue: string | null,
  coreMeaning: string,
  playerImposedDetails: string[],
  forbiddenInterpretations: string[],
  requiresClarification: boolean,
  clarificationQuestion: string | null,
  riskFlags: string[],
  expectedTimeEffect: AiStructuredPlayerIntentV1["expectedTimeEffect"],
  confidence: AiStructuredPlayerIntentV1["confidence"]
): AiStructuredPlayerIntentV1 {
  const referentResolution = buildReferentResolution(target, rawInput);
  const semanticIntent = buildSemanticIntent({
    rawInput,
    intentType,
    commitment,
    target,
    action,
    coreMeaning,
    forbiddenInterpretations,
    requiresClarification,
    confidence
  });
  const runtimeHandling = buildRuntimeHandling({
    rawInput,
    intentType,
    commitment,
    target,
    action,
    requiresClarification,
    confidence
  });
  return {
    intentId: "intent:1",
    order: 1,
    intentType,
    commitment,
    target,
    action,
    semanticIntent,
    runtimeHandling,
    referentResolution,
    topic: topicValue,
    coreMeaning,
    playerImposedDetails,
    openDetails: [],
    forbiddenInterpretations,
    requiresClarification,
    clarificationQuestion,
    riskFlags,
    expectedTimeEffect,
    confidence
  };
}

function unclear(rawInput: string, question: string): AiStructuredPlayerIntentV1 {
  return intent(rawInput, "unclear_commitment", "unclear", findTarget(rawInput), null, topic(rawInput), rawInput.trim(), [], ["execute_without_confirmation"], true, question, ["ambiguous_commitment"], "NO_GAME_TIME", "medium");
}

function buildInterpretationFailure(rawInput: string, issues: string[]): AiIntentInterpretationFailureV1 {
  const normalizedIssues = issues.filter(entry => entry.trim().length > 0);
  const providerUnavailable = normalizedIssues.some(entry => /transport|provider/iu.test(entry));
  const rejectedByMapper = normalizedIssues.some(entry => /could not be mapped/iu.test(entry));
  return {
    schemaVersion: 1,
    stage: "PLAYER_INTENT_INTERPRETATION",
    role: "player_intent_interpreter",
    status: "FAILED",
    category: providerUnavailable ? "AI_UNAVAILABLE" : rejectedByMapper ? "AI_OUTPUT_REJECTED" : "AI_OUTPUT_INVALID",
    rawInput,
    issues: normalizedIssues,
    noCommit: true,
    noGameTime: true,
    developerSummary: "L'interprétation IA a échoué ou a été rejetée; aucune résolution narrative n'a été tentée."
  };
}

function buildDiagnosticInterpretation(intentId: string, failure: AiIntentInterpretationFailureV1): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId,
    intentType: "meta_question",
    commitment: "none",
    target: null,
    action: null,
    runtimeHandling: {
      schemaVersion: 1,
      status: "AI_INTERPRETATION_FAILED",
      reason: failure.developerSummary,
      requiredDomain: null,
      canonicalActionHint: null,
      noCommit: true,
      noGameTime: true
    },
    referentResolution: null,
    coreMeaning: failure.developerSummary,
    requiresClarification: false,
    clarificationQuestion: null,
    expectedTimeEffect: "NO_GAME_TIME",
    safetyNotes: [
      "Diagnostic technique sans fallback narratif.",
      ...failure.issues.map(entry => `Issue: ${entry}`)
    ]
  };
}

function buildSemanticIntent(input: {
  rawInput: string;
  intentType: AiStructuredPlayerIntentV1["intentType"];
  commitment: AiStructuredPlayerIntentV1["commitment"];
  target: AiStructuredPlayerIntentV1["target"];
  action: string | null;
  coreMeaning: string;
  forbiddenInterpretations: string[];
  requiresClarification: boolean;
  confidence: AiStructuredPlayerIntentV1["confidence"];
}): AiStructuredSemanticIntentV1 {
  return {
    schemaVersion: 1,
    kind: semanticKind(input.intentType, input.action, input.rawInput),
    playerGoal: input.coreMeaning,
    target: input.target,
    commitment: input.commitment,
    evidenceFromInput: [input.rawInput.trim()].filter(Boolean),
    uncertainties: input.requiresClarification ? ["engagement, cible ou portée à clarifier"] : [],
    forbiddenInterpretations: [...input.forbiddenInterpretations],
    confidence: input.confidence
  };
}

function buildRuntimeHandling(input: {
  rawInput: string;
  intentType: AiStructuredPlayerIntentV1["intentType"];
  commitment: AiStructuredPlayerIntentV1["commitment"];
  target: AiStructuredPlayerIntentV1["target"];
  action: string | null;
  requiresClarification: boolean;
  confidence: AiStructuredPlayerIntentV1["confidence"];
}): AiIntentRuntimeHandlingV1 {
  if (input.requiresClarification || input.confidence === "low") {
    return {
      schemaVersion: 1,
      status: "NEEDS_CLARIFICATION",
      reason: "L'intention n'est pas exploitable sans précision joueur.",
      requiredDomain: null,
      canonicalActionHint: input.action,
      noCommit: true,
      noGameTime: true
    };
  }
  if (input.intentType === "meta_question" || input.intentType === "possibility_query") {
    return {
      schemaVersion: 1,
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "Intention sans commit métier traitable par le runtime courant.",
      requiredDomain: "scene_resolution",
      canonicalActionHint: input.action,
      noCommit: true,
      noGameTime: true
    };
  }
  if (input.intentType === "speech") {
    return {
      schemaVersion: 1,
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "Parole joueur bornée vers une cible visible, sans résultat social automatique.",
      requiredDomain: "scene_resolution",
      canonicalActionHint: input.action,
      noCommit: false,
      noGameTime: true
    };
  }
  if (input.intentType === "action" && input.action === "observe") {
    return {
      schemaVersion: 1,
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "Observation locale traitable sans commit métier durable.",
      requiredDomain: "perception",
      canonicalActionHint: input.action,
      noCommit: true,
      noGameTime: true
    };
  }
  if (input.intentType === "action" && (input.action === "open" || input.action === "force") && input.target?.ref === "poi:back-room-door") {
    return {
      schemaVersion: 1,
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "Action locale bornée sur un référent visible, sans résultat caché ni changement de scène.",
      requiredDomain: "scene_resolution",
      canonicalActionHint: input.action,
      noCommit: false,
      noGameTime: true
    };
  }
  const unsupportedDomain = classifyLocalUnsupportedRuntimeDomain(input.rawInput);
  return {
    schemaVersion: 1,
    status: input.commitment === "committed" ? "UNSUPPORTED_DOMAIN" : "SUPPORTED_BY_CURRENT_RUNTIME",
    reason: input.commitment === "committed"
      ? localUnsupportedRuntimeReason(unsupportedDomain)
      : "Intention exploitable sans domaine propriétaire supplémentaire.",
    requiredDomain: input.commitment === "committed" ? unsupportedDomain : "scene_resolution",
    canonicalActionHint: input.action,
    noCommit: input.commitment === "committed",
    noGameTime: true
  };
}

function localUnsupportedRuntimeReason(domain: AiIntentRuntimeHandlingV1["requiredDomain"]): string {
  if (domain === "tactical") return "Conflit violent potentiel: handoff tactique requis.";
  if (domain === "rest") return "Début de repos: moteur de repos requis.";
  if (domain === "inventory") return "Mutation d'inventaire ou possession: domaine inventaire requis.";
  return "Intention comprise mais domaine propriétaire non ouvert dans le runtime courant.";
}

function classifyLocalUnsupportedRuntimeDomain(rawInput: string): AiIntentRuntimeHandlingV1["requiredDomain"] {
  const normalized = normalize(rawInput);
  if (/\b(attaque|attaquer|frappe|frapper|combat|tuer|poignarder)\b/u.test(normalized)) return "tactical";
  if (/\b(repos|dormir|campement|se reposer)\b/u.test(normalized)) return "rest";
  if (/\b(voler|vole|prendre|prends|ramasser|ramasse|acheter|achete|vendre|vends|donner|donne|equiper|equipe)\b/u.test(normalized)) return "inventory";
  return "world";
}

function semanticKind(
  intentType: AiStructuredPlayerIntentV1["intentType"],
  action: string | null,
  rawInput: string
): AiStructuredSemanticIntentV1["kind"] {
  const normalized = normalize(rawInput);
  if (intentType === "meta_question") return "context_question";
  if (intentType === "possibility_query") return "hypothetical_action";
  if (intentType === "speech") return "address_visible_actor";
  if (intentType === "unclear_commitment") return "unclear_intent";
  if (action === "observe") return "observe_environment";
  if (intentType === "action") return "manipulate_visible_object";
  if (/\b(signe|main|levre|levres|hoche|tends)\b/u.test(normalized)) return "nonverbal_signal";
  return "unclear_intent";
}

async function buildIntentInterpreterRequestV1(input: {
  campaignId: string;
  operationId: string;
  rawInput: string;
  config: AiIntentInterpreterConfigV1;
  localReferentHints?: LocalReferentHintV1[];
}): Promise<AiCallRequestV1> {
  const snapshotId = `${input.operationId}:snapshot:intent`;
  const packId = `${input.operationId}:pack:intent`;
  const context = {
    schemaVersion: 1,
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId,
    locationName: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.locationName,
    presentNpc: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.presentNpc.map(npc => ({
      actorId: npc.actorId,
      displayName: npc.displayName,
      keywords: npc.keywords
    })),
    visiblePoints: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.pointsOfInterest.map(point => ({
      pointId: point.pointId,
      label: point.label,
      keywords: point.keywords
    })),
    authority: "INTERPRETATION_ONLY"
  } satisfies JsonObject;
  return {
    schemaVersion: 1,
    callId: `${input.operationId}:ai:intent:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:intent:attempt:1`,
    campaignId: input.campaignId,
    snapshotId,
    packId,
    role: input.config.route.role,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint(context) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:ai:intent`,
    input: {
      instructionsRef: "ai-intent-interpretation/player-intent-interpreter/v1",
      roleContextPack: context,
      task: {
        rawInput: input.rawInput,
        localReferentHints: input.localReferentHints ?? [],
        allowedIntentTypes: ["meta_question", "possibility_query", "memory_recall", "speech", "action", "mixed", "unclear_commitment"],
        requiredSemanticFields: ["semanticIntent", "runtimeHandling"],
        forbiddenAuthority: ["commit", "time", "inventory", "tactical", "durable_lore", "social_success"]
      }
    },
    limits: {
      inputTokenBudget: 1_000,
      outputTokenBudget: 700,
      timeoutMs: input.config.route.timeoutMs
    }
  };
}

function mapAiIntentToNarrativeInterpretationV1(input: {
  intentId: string;
  rawInput: string;
  payload: AiIntentInterpretationPayloadV1;
}): { ok: true; interpretation: NarrativeIntentInterpretationV1 } | { ok: false } {
  const first = input.payload.intents[0];
  if (!first) return { ok: false };
  if (first.confidence === "low") return { ok: false };
  if (first.semanticIntent.confidence === "low") return { ok: false };
  if (first.semanticIntent.commitment !== first.commitment) return { ok: false };
  if (first.runtimeHandling.status === "AI_INTERPRETATION_FAILED") return { ok: false };
  if (first.runtimeHandling.status === "NEEDS_CLARIFICATION" && first.requiresClarification !== true) return { ok: false };
  if (first.runtimeHandling.canonicalActionHint !== null && first.action !== null && first.runtimeHandling.canonicalActionHint !== first.action) return { ok: false };
  if (first.intentType === "possibility_query" && first.commitment !== "hypothetical") return { ok: false };
  if (first.intentType === "possibility_query" && !isExplicitPossibilityQuestionText(input.rawInput)) return { ok: false };
  if (first.intentType === "meta_question" && first.commitment !== "none") return { ok: false };
  if (first.intentType === "speech" && first.commitment !== "committed") return { ok: false };
  if (first.intentType === "action" && first.commitment !== "committed") return { ok: false };
  if (first.riskFlags.includes("secret_reveal") || first.riskFlags.includes("social_success_granted")) return { ok: false };
  const referentClarification = committedActionReferentClarification(first, input.rawInput);
  if (referentClarification !== null) {
    return {
      ok: true,
      interpretation: {
        schemaVersion: 1,
        contractVersion: "intent-clarification/1",
        intentId: input.intentId,
        intentType: "unclear_commitment",
        commitment: "unclear",
        target: first.target,
        action: first.action,
        runtimeHandling: first.runtimeHandling,
        referentResolution: first.referentResolution ?? buildReferentResolution(first.target, input.rawInput),
        coreMeaning: first.semanticIntent.playerGoal || first.coreMeaning,
        requiresClarification: true,
        clarificationQuestion: referentClarification,
        expectedTimeEffect: "NO_GAME_TIME",
        safetyNotes: [
          "Référent d'action locale non validé: clarification obligatoire avant résolution.",
          ...first.forbiddenInterpretations.map(entry => `Interprétation interdite: ${entry}`)
        ]
      }
    };
  }

  return {
    ok: true,
    interpretation: {
      schemaVersion: 1,
      contractVersion: "intent-clarification/1",
      intentId: input.intentId,
      intentType: first.intentType,
      commitment: first.commitment,
      target: first.target,
      action: first.action,
      runtimeHandling: first.runtimeHandling,
      referentResolution: first.referentResolution ?? buildReferentResolution(first.target, input.rawInput),
      coreMeaning: first.semanticIntent.playerGoal || first.coreMeaning,
      requiresClarification: first.requiresClarification,
      clarificationQuestion: first.clarificationQuestion,
      expectedTimeEffect: first.expectedTimeEffect,
      safetyNotes: [
        "Interprétation proposée par player_intent_interpreter et validée localement.",
        ...first.forbiddenInterpretations.map(entry => `Interprétation interdite: ${entry}`)
      ]
    }
  };
}

function findTarget(rawInput: string, localReferentHints: LocalReferentHintV1[] = [], action: string | null = null): AiStructuredPlayerIntentV1["target"] {
  const normalized = normalize(rawInput);
  if (/\b(moi|me)\b/u.test(normalized) && !/\b(garde|serveuse|aubergiste|porte)\b/u.test(normalized)) {
    return { kind: "self", ref: "player-character:prototype", label: "personnage joueur" };
  }
  const npc = findPlayableSceneNpcTargetV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, rawInput);
  if (npc.keywords.some(keyword => normalized.includes(normalize(keyword))) || /\b(lui|il|elle)\b/u.test(normalized)) {
    return { kind: "npc", ref: `npc:${npc.actorId}`, label: normalize(npc.displayName).includes("serveuse") ? "serveuse" : "garde" };
  }
  if (/\b(porte|arriere|arriere-salle|fond)\b/u.test(normalized)) return { kind: "object", ref: "poi:back-room-door", label: "porte du fond" };
  const pronounOnly = /\b(l'|le|la|lui|cela|ca|ça)\b/u.test(normalized);
  const recentCompatible = localReferentHints.find(hint =>
    hint.confidence !== "low" &&
    hint.target.ref !== null &&
    isTargetCompatibleWithAction(hint.target, action)
  );
  if (pronounOnly && recentCompatible) return recentCompatible.target;
  return null;
}

function committedActionReferentClarification(
  intentValue: AiStructuredPlayerIntentV1,
  rawInput: string
): string | null {
  if (intentValue.intentType !== "action") return null;
  if (intentValue.action !== "open" && intentValue.action !== "force") return null;
  const referentResolution = intentValue.referentResolution ?? buildReferentResolution(intentValue.target, rawInput);
  const target = referentResolution.resolvedTarget ?? intentValue.target;
  if (referentResolution.ambiguity !== "none") {
    return "Je dois savoir précisément quel élément tu veux ouvrir ou forcer avant d'exécuter l'action.";
  }
  if (target === null || target.ref === null) {
    return "Que veux-tu ouvrir ou forcer exactement ?";
  }
  if (!isTargetCompatibleWithAction(target, intentValue.action)) {
    return "Le référent récent ne correspond pas à quelque chose qu'on peut ouvrir ou forcer. Que veux-tu cibler exactement ?";
  }
  if (!isVisibleSceneTargetRef(target.ref)) {
    return "Ce référent n'est pas validé comme élément visible de la scène. Que veux-tu cibler exactement ?";
  }
  return null;
}

function isVisibleSceneTargetRef(ref: string): boolean {
  return ref === "poi:back-room-door" ||
    ref === "npc:npc-garde-blesse" ||
    ref === "npc:npc-serveuse-nerveuse";
}

function buildReferentResolution(
  target: AiStructuredPlayerIntentV1["target"],
  rawInput: string
): NonNullable<AiStructuredPlayerIntentV1["referentResolution"]> {
  if (target === null) {
    return {
      schemaVersion: 1,
      usedPreviousContext: false,
      source: "none",
      resolvedTarget: null,
      evidence: [rawInput.trim()].filter(Boolean),
      ambiguity: "insufficient_context",
      confidence: "medium"
    };
  }
  const normalized = normalize(rawInput);
  const targetToken = target.label === null ? null : normalize(target.label).split(" ")[0] ?? null;
  const explicit = targetToken !== null && normalized.includes(targetToken);
  return {
    schemaVersion: 1,
    usedPreviousContext: !explicit,
    source: explicit ? "current_input" : "recent_visible_focus",
    resolvedTarget: target,
    evidence: [rawInput.trim(), target.label ?? target.ref ?? "referent"].filter(Boolean),
    ambiguity: "none",
    confidence: explicit ? "high" : "medium"
  };
}

function isTargetCompatibleWithAction(target: NarrativeIntentTargetV1, action: string | null): boolean {
  if (action === null) return true;
  if (action === "open" || action === "force") return target.kind === "object" || target.kind === "place";
  if (action === "ask") return target.kind === "npc";
  return true;
}

function normalizeLocalReferentHints(value: unknown): LocalReferentHintV1[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is LocalReferentHintV1 => {
    if (entry === null || typeof entry !== "object") return false;
    const candidate = entry as Partial<LocalReferentHintV1>;
    return candidate.schemaVersion === 1 &&
      candidate.target !== null &&
      typeof candidate.target === "object" &&
      typeof candidate.sourceOperationId === "string" &&
      typeof candidate.sourceText === "string" &&
      ["low", "medium", "high"].includes(candidate.confidence ?? "");
  }).slice(0, 5);
}

function topic(rawInput: string): string | null {
  const trimmed = rawInput.trim().replace(/[?؟]+$/u, "");
  const match = trimmed.match(/\b(?:ce qu['’]il|s['’]il|pourquoi|comment|sur)\s+(.+)$/iu);
  if (match?.[0]) return match[0].trim();
  if (trimmed.length > 0) return trimmed;
  return null;
}

function speechCoreMeaning(rawInput: string, targetLabel: string): string {
  return `Le personnage s'adresse à ${targetLabel} : ${rawInput.trim()}`;
}

function imposedDetails(rawInput: string, targetLabel: string | null): string[] {
  const details = [rawInput.trim()];
  if (targetLabel) details.push(`cible: ${targetLabel}`);
  if (/\b(approche|avance|dirige|vais vers)\b/iu.test(rawInput)) details.push("approche de la cible");
  return details;
}

function actionLabel(normalized: string): string {
  if (/\b(ouvrir|ouvre)\b/u.test(normalized)) return "open";
  if (/\b(force|forcer|crochete|crocheter)\b/u.test(normalized)) return "force";
  if (/\b(regarde|observe)\b/u.test(normalized)) return "observe";
  return "act";
}

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/gu, "'");
}

function isExplicitPossibilityQuestionText(value: string): boolean {
  const normalized = normalize(value);
  if (isPoliteContextQuestionText(value)) return false;
  return /[?？]/u.test(value)
    && /\b(est[- ]ce que|peux|puis|possible|possibilite|ai[- ]je le droit|ce serait possible)\b/u.test(normalized);
}

function isPoliteContextQuestionText(value: string): boolean {
  const normalized = normalize(value);
  return /[?？]/u.test(value)
    && /\b(peux[- ]tu|peut[- ]tu|pourrais[- ]tu|tu peux|tu pourrais)\b/u.test(normalized)
    && /\b(decrire|decris|dire|rappeler|expliquer|montrer|resumer|situer|localiser)\b/u.test(normalized);
}

export function createAiSuspendedIntentRecordV1(input: {
  suspendedIntentId: string;
  operationId: string;
  rawInput: string;
  interpretation: NarrativeIntentInterpretationV1;
  createdAt: string;
}) {
  return createSuspendedIntentRecordV1(input);
}
