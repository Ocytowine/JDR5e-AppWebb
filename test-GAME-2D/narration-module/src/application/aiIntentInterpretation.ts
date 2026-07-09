import { computeJsonFingerprint, type JsonObject } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiCallRequestV1,
  AiIncidentRecordV1,
  AiIntentInterpretationPayloadV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1,
  AiStructuredPlayerIntentV1
} from "../ai/types";
import {
  createSuspendedIntentRecordV1,
  interpretNarrativeInputV1,
  type NarrativeIntentInterpretationV1
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
  incidents: AiIncidentRecordV1[];
  safetyNotes: string[];
}

export class LocalPlayerIntentInterpreterProviderV1 implements ContractAiProviderV1 {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const task = request.input.task as { rawInput?: unknown };
    const rawInput = typeof task.rawInput === "string" ? task.rawInput : "";
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
      payload: buildLocalIntentPayload(rawInput),
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
        incidents: run.incidents,
        safetyNotes: ["Interprétation IA structurée acceptée sans autorité de commit."]
      };
    }
  }

  return {
    schemaVersion: 1,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
    usedAiInterpretation: false,
    usedFallback: true,
    interpretation: interpretNarrativeInputV1({ intentId: input.intentId, rawInput: input.rawInput }),
    acceptedOutput: null,
    incidents: run.incidents,
    safetyNotes: ["Fallback conservateur intent-clarification/1 utilisé."]
  };
}

export function buildLocalIntentPayload(rawInput: string): AiIntentInterpretationPayloadV1 {
  const normalized = normalize(rawInput);
  const target = findTarget(rawInput);
  const hasQuestion = /[?？]/u.test(rawInput) || /^(est[- ]ce|peux|puis|peut|comment|pourquoi|combien|ou|où|quand|quelle|quel|quels|quelles)\b/u.test(normalized);
  const asksPossibility = /\b(peux|puis|possible|possibilite|est[- ]ce que je peux|ai[- ]je le droit|ce serait possible)\b/u.test(normalized);
  const politeContextRequest = isPoliteContextQuestionText(rawInput);
  const meta = /\b(regle|mecanique|jet|bonus|interface|sauvegarde|comment fonctionne|comment marche|cote regles)\b/u.test(normalized);
  const risky = /\b(voler|vole|ouvrir|entrer|forcer|crocheter|attaquer|attaque|frapper|prendre)\b/u.test(normalized);
  const speech = /\b(je demande|je lui demande|lui demander|je questionne|j'interroge|j interroge|je lui dis|je dis|je reponds|je réponds|parler|discuter|interroger)\b/u.test(normalized);
  const explicitCommittedAction = /\b(je vole|j'attaque|j attaque|je frappe|je prends|je tente|j'essaie|j essaie|j'ouvre|j ouvre|je force|je crochete)\b/u.test(normalized);
  const action = explicitCommittedAction || /\b(je m'avance|je m avance|je vais|je me dirige|je m'approche|je m approche|je regarde|j'observe|j observe)\b/u.test(normalized);
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
  if (action) {
    return payload(rawInput, intent(rawInput, "action", "committed", target, actionLabel(normalized), topic(rawInput), `Le personnage tente l'action décrite : ${rawInput.trim()}`, [rawInput.trim()], ["success", "failure", "mechanical_effect"], false, null, risky ? ["domain_handoff_possible"] : [], "DOMAIN_TO_DECIDE", "medium"));
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
  return {
    intentId: "intent:1",
    order: 1,
    intentType,
    commitment,
    target,
    action,
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

async function buildIntentInterpreterRequestV1(input: {
  campaignId: string;
  operationId: string;
  rawInput: string;
  config: AiIntentInterpreterConfigV1;
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
        allowedIntentTypes: ["meta_question", "possibility_query", "memory_recall", "speech", "action", "mixed", "unclear_commitment"],
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
  if (first.intentType === "possibility_query" && first.commitment !== "hypothetical") return { ok: false };
  if (first.intentType === "possibility_query" && !isExplicitPossibilityQuestionText(input.rawInput)) return { ok: false };
  if (first.intentType === "meta_question" && first.commitment !== "none") return { ok: false };
  if (first.intentType === "speech" && first.commitment !== "committed") return { ok: false };
  if (first.intentType === "action" && first.commitment !== "committed") return { ok: false };
  if (first.riskFlags.includes("secret_reveal") || first.riskFlags.includes("social_success_granted")) return { ok: false };

  return {
    ok: true,
    interpretation: {
      schemaVersion: 1,
      contractVersion: "intent-clarification/1",
      intentId: input.intentId,
      intentType: first.intentType,
      commitment: first.commitment,
      coreMeaning: first.coreMeaning,
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

function findTarget(rawInput: string): AiStructuredPlayerIntentV1["target"] {
  const normalized = normalize(rawInput);
  if (/\b(moi|me)\b/u.test(normalized) && !/\b(garde|serveuse|aubergiste|porte)\b/u.test(normalized)) {
    return { kind: "self", ref: "player-character:prototype", label: "personnage joueur" };
  }
  const npc = findPlayableSceneNpcTargetV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, rawInput);
  if (npc.keywords.some(keyword => normalized.includes(normalize(keyword))) || /\b(lui|il|elle)\b/u.test(normalized)) {
    return { kind: "npc", ref: `npc:${npc.actorId}`, label: normalize(npc.displayName).includes("serveuse") ? "serveuse" : "garde" };
  }
  if (/\b(porte|arriere|arriere-salle|fond)\b/u.test(normalized)) return { kind: "object", ref: "poi:back-room-door", label: "porte du fond" };
  return null;
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
