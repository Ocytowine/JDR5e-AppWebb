import { computeJsonFingerprint, type JsonObject } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiCallRequestV1,
  AiCallTelemetryV1,
  AiIncidentRecordV1,
  AiIntentInterpretationPayloadV1,
  AiSemanticIntentPayloadV2,
  AiSemanticIntentPayloadV3,
  AiSemanticIntentPayloadV4,
  AiSemanticIntentPayloadV5,
  AiSemanticIntentPayloadV6,
  AiSemanticIntentPayloadV7,
  AiSemanticIntentPayloadV8,
  AiIntentRuntimeHandlingV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1,
  AiStructuredPlayerIntentV1,
  AiStructuredSemanticIntentV1
} from "../ai/types";
import {
  createSuspendedIntentRecordV1,
  evaluateNarrativeRuntimeDecisionV1,
  interpretNarrativeInputV1,
  validateCanonicalIntentAuthorityV1,
  type NarrativeIntentInterpretationV1,
  type NarrativeIntentTargetV1
} from "./intentClarification";
import { REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, type PlayableSceneStateV1 } from "./playableScene";
import {
  buildSceneReferentRegistryV1,
  findSceneReferentByRefV1,
  resolveSceneReferentDescriptionV1,
  resolveSceneReferentTextV1,
  toNarrativeIntentTargetV1,
  toSceneReferentRoleViewV1,
  type SceneReferentRegistryV1
} from "./sceneReferentRegistry";
import type { InterpreterRuntimeContextV1 } from "./runtimeCapabilityRouting";
import {
  findUnresolvedCharacterReferenceAmbiguityV1,
  type InterpreterCharacterAmbiguityV1,
  type InterpreterCharacterContextV1
} from "./interpreterCharacterContext";
import type { PlayerPublicContextV1 } from "./playerPublicContext";
import { buildInterpreterEmbodiedPublicContextV1 } from "./interpreterEmbodiedContext";
import { buildOpenSemanticExecutionPlanV1 } from "./openSemanticExecution";
import type { LocalInteractionFocusV1 } from "./localInteractionFocus";
import type { LoreInformationSemanticCatalogV1 } from "./loreInformationSemanticCatalog";

export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1 = "ai-intent-interpretation/1" as const;
export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2 = "ai-intent-semantic/2" as const;
export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3 = "ai-intent-semantic/3" as const;
export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4 = "ai-intent-semantic/4" as const;
export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5 = "ai-intent-semantic/5" as const;
export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6 = "ai-intent-semantic/6" as const;
export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7 = "ai-intent-semantic/7" as const;
export const AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8 = "ai-intent-semantic/8" as const;
type AiIntentInterpretationContractVersion =
  | typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1
  | typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2
  | typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3
  | typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4
  | typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5
  | typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6
  | typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7
  | typeof AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8;
const REFERENCE_SCENE_REFERENT_REGISTRY_V1 = buildSceneReferentRegistryV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1);

export interface AiIntentInterpreterConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1;
  retryPolicy: AiRetryPolicyV1;
  contractVersion?: AiIntentInterpretationContractVersion;
  informationCatalogForScene?: (scene: PlayableSceneStateV1) => LoreInformationSemanticCatalogV1 | null;
}

export interface AiIntentInterpretationResultV1 {
  schemaVersion: 1;
  contractVersion: AiIntentInterpretationContractVersion;
  usedAiInterpretation: boolean;
  usedFallback: boolean;
  interpretation: NarrativeIntentInterpretationV1;
  acceptedOutput: AiRoleOutputEnvelopeV1<AiIntentInterpretationPayloadV1 | AiSemanticIntentPayloadV2 | AiSemanticIntentPayloadV3 | AiSemanticIntentPayloadV4 | AiSemanticIntentPayloadV5 | AiSemanticIntentPayloadV6 | AiSemanticIntentPayloadV7 | AiSemanticIntentPayloadV8> | null;
  interpretationFailure: AiIntentInterpretationFailureV1 | null;
  incidents: AiIncidentRecordV1[];
  telemetry: AiCallTelemetryV1[];
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
  sceneId: string;
  sceneVersion: number;
  target: NarrativeIntentTargetV1;
  sourceOperationId: string;
  sourceText: string;
  confidence: "low" | "medium" | "high";
}

export interface RecentSemanticTurnV1 {
  schemaVersion: 1;
  operationId: string;
  semanticKind: NarrativeIntentInterpretationV1["semanticIntent"]["kind"];
  playerGoal: string;
  primaryTarget: NarrativeIntentTargetV1 | null;
  topic: string | null;
  commitment:
    | NarrativeIntentInterpretationV1["semanticIntent"]["commitment"]
    | AiSemanticIntentPayloadV8["semanticFrame"]["overallCommitment"];
  understandingStatus?: AiSemanticIntentPayloadV8["semanticFrame"]["understandingStatus"];
  focusDisposition?: "RETAIN" | "RELEASE";
}

export interface ActiveDialogueTargetV1 extends JsonObject {
  schemaVersion: 1;
  target: JsonObject & {
    kind: "npc";
    ref: string;
    label: string | null;
  };
  sourceOperationId: string;
  sourcePlayerGoal: string;
}

export function semanticIntentReleasesFocusV1(
  semanticIntent: NarrativeIntentInterpretationV1["semanticIntent"]
): boolean {
  return semanticIntent.composition?.orderedComponents
    .some(component => component.kind === "REPOSITION_AWAY") ?? false;
}

export class LocalPlayerIntentInterpreterProviderV1 implements ContractAiProviderV1 {
  async generate(request: AiCallRequestV1): Promise<unknown> {
    const task = request.input.task as { rawInput?: unknown; localReferentHints?: unknown };
    const rawInput = typeof task.rawInput === "string" ? task.rawInput : "";
    const context = request.input.roleContextPack as { referentRegistry?: SceneReferentRegistryV1 };
    const registry = context.referentRegistry ?? REFERENCE_SCENE_REFERENT_REGISTRY_V1;
    const localReferentHints = normalizeLocalReferentHints(task.localReferentHints, registry);
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
      payload: buildLocalIntentPayload(rawInput, localReferentHints, registry),
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiIntentInterpretationPayloadV1>;
  }
}

/** Fixture lexicale déterministe réservée aux tests locaux. */
export function createLocalAiIntentInterpreterFixtureConfigV1(): AiIntentInterpreterConfigV1 {
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
      outputTokenLimit: 1_600,
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
  recentSemanticTurns?: RecentSemanticTurnV1[];
  localInteractionFocus?: LocalInteractionFocusV1 | null;
  runtimeContext?: InterpreterRuntimeContextV1;
  characterContext?: InterpreterCharacterContextV1 | null;
  playerPublicContext?: PlayerPublicContextV1 | null;
  playableScene?: PlayableSceneStateV1;
  activeCompanionRefs?: string[];
}): Promise<AiIntentInterpretationResultV1> {
  const playableScene = input.playableScene ?? REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1;
  const informationCatalog = input.config.informationCatalogForScene?.(playableScene) ?? null;
  const referentRegistry = buildSceneReferentRegistryV1(playableScene);
  const request = await buildIntentInterpreterRequestV1(input);
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    request
  });
  const acceptedOutput = run.acceptedOutput as AiRoleOutputEnvelopeV1<AiIntentInterpretationPayloadV1 | AiSemanticIntentPayloadV2 | AiSemanticIntentPayloadV3 | AiSemanticIntentPayloadV4 | AiSemanticIntentPayloadV5 | AiSemanticIntentPayloadV6 | AiSemanticIntentPayloadV7 | AiSemanticIntentPayloadV8> | null;
  let mappingIssues: string[] = [];
  if (acceptedOutput !== null) {
    const mapped = request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8
      ? mapOpenSemanticFrameV8ToNarrativeInterpretation({
        intentId: input.intentId,
        rawInput: input.rawInput,
        payload: acceptedOutput.payload as AiSemanticIntentPayloadV8,
        referentRegistry,
        publicReferenceRefs: new Set([
          ...(input.characterContext === null || input.characterContext === undefined
            ? []
            : [
                input.characterContext.character.ref,
                ...input.characterContext.references.map(reference => reference.ref)
              ]),
          ...(input.playerPublicContext?.knownFacts.map(fact => fact.factRef) ?? []),
          ...(input.playerPublicContext?.presentActors.map(actor => actor.actorRef) ?? []),
          ...(informationCatalog?.subjects.map(subject => subject.ref) ?? [])
        ]),
        informationCatalog,
        runtimeContext: input.runtimeContext ?? {
          schemaVersion: 1,
          contractVersion: "interpreter-runtime-context/1",
          capabilities: [],
          activeTravel: null
        }
      })
      : request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2 ||
      request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3 ||
      request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4 ||
      request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5 ||
      request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6 ||
      request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7
      ? mapSemanticIntentV2ToNarrativeInterpretation({
        intentId: input.intentId,
        rawInput: input.rawInput,
        payload: request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7
          ? canonicalizeSemanticIntentV7(acceptedOutput.payload as AiSemanticIntentPayloadV7)
          : request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6
          ? canonicalizeSemanticIntentV6(acceptedOutput.payload as AiSemanticIntentPayloadV6)
          : request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5
          ? canonicalizeSemanticIntentV5(acceptedOutput.payload as AiSemanticIntentPayloadV5)
          : request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4
            ? canonicalizeSemanticIntentV4(acceptedOutput.payload as AiSemanticIntentPayloadV4)
          : request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3
            ? canonicalizeSemanticCompositionV3(acceptedOutput.payload as AiSemanticIntentPayloadV3)
          : acceptedOutput.payload as AiSemanticIntentPayloadV2,
        localReferentHints: input.localReferentHints ?? [],
        referentRegistry,
        characterContext: input.characterContext ?? null
      })
      : mapAiIntentToNarrativeInterpretationV1({
      intentId: input.intentId,
      rawInput: input.rawInput,
      payload: acceptedOutput.payload as AiIntentInterpretationPayloadV1
    });
    if (mapped.ok) {
      const characterAmbiguity = request.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8
        ? null
        :
        findUnresolvedCharacterReferenceAmbiguityV1({
          rawInput: input.rawInput,
          context: input.characterContext
        });
      const guardedInterpretation =
        characterAmbiguity !== null
        && !mapped.interpretation.requiresClarification
          ? requireCharacterReferenceClarificationV1(
              mapped.interpretation,
              characterAmbiguity,
              input.rawInput
            )
          : mapped.interpretation;
      return {
        schemaVersion: 1,
        contractVersion: request.contractVersion as AiIntentInterpretationContractVersion,
        usedAiInterpretation: true,
        usedFallback: false,
        interpretation: guardedInterpretation,
        acceptedOutput,
        interpretationFailure: null,
        incidents: run.incidents,
        telemetry: run.telemetry,
        safetyNotes: [
          "Interprétation IA structurée acceptée sans autorité de commit.",
          ...(characterAmbiguity !== null
            ? ["Une ambiguïté de référence personnage non levée impose une clarification locale."]
            : [])
        ]
      };
    }
    mappingIssues = mapped.issues ?? [];
  }

  const failure = buildInterpretationFailure(input.rawInput, [
    ...(run.validation?.issues ?? []),
    ...mappingIssues.map(issue => `Semantic mapping rejected: ${issue}`),
    acceptedOutput === null
      ? "No accepted player_intent_interpreter output."
      : "Accepted output could not be mapped to a safe narrative interpretation."
  ]);
  return {
    schemaVersion: 1,
    contractVersion: input.config.contractVersion ?? AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
    usedAiInterpretation: false,
    usedFallback: false,
    interpretation: buildDiagnosticInterpretation(input.intentId, failure),
    acceptedOutput: null,
    interpretationFailure: failure,
    incidents: run.incidents,
    telemetry: run.telemetry,
    safetyNotes: ["Diagnostic d'échec d'interprétation IA produit sans fallback narratif."]
  };
}

export function buildLocalIntentPayload(rawInput: string, localReferentHints: LocalReferentHintV1[] = [], registry: SceneReferentRegistryV1 = REFERENCE_SCENE_REFERENT_REGISTRY_V1): AiIntentInterpretationPayloadV1 {
  const normalized = normalize(rawInput);
  const localAction = actionLabel(normalized);
  const travelRequest = isLocalTravelText(rawInput);
  const hasQuestion = /[?？]/u.test(rawInput) || /^(est[- ]ce|peux|puis|peut|comment|pourquoi|combien|ou|où|quand|quelle|quel|quels|quelles)\b/u.test(normalized);
  const asksPossibility = /\b(peux|puis|possible|possibilite|est[- ]ce que je peux|ai[- ]je le droit|ce serait possible)\b/u.test(normalized);
  const politeContextRequest = isPoliteContextQuestionText(rawInput);
  const meta = /\b(regle|mecanique|jet|bonus|interface|sauvegarde|comment fonctionne|comment marche|cote regles)\b/u.test(normalized);
  const risky = /\b(voler|vole|ouvrir|entrer|forcer|crocheter|attaquer|attaque|frapper|prendre)\b/u.test(normalized);
  const speech = /\b(je demande|je lui demande|lui demander|je questionne|j'interroge|j interroge|je lui dis|je dis|je reponds|je réponds|parler|discuter|interroger|veux-tu|souhaites-tu|rejoins|rejoindre|accompagne|reste ici|reviens avec|va seul)\b/u.test(normalized);
  const target = travelRequest
    ? localTravelDestinationTarget(rawInput)
    : findTarget(rawInput, localReferentHints, speech ? "ask" : localAction, registry);
  const explicitCommittedAction = /\b(je vole|j'attaque|j attaque|je frappe|je prends|je ramasse|je recupere|je depose|je pose|je place|je laisse|je donne|j'offre|j offre|je recois|j'accepte|j accepte|j'achete|j achete|je vends|je range|je mets|je sors|je retire|j'equipe|je equipe|j equipe|j'desequipe|je desequipe|j desequipe|je tente|j'essaie|j essaie|j'ouvre|j ouvre|je l'ouvre|je le force|je la force|je force|je crochete|je cherche|je fouille|j'inspecte|j inspecte|j'examine|j examine)\b/u.test(normalized);
  const action = explicitCommittedAction || travelRequest || /\b(je m'avance|je m avance|je vais|je me dirige|je m'approche|je m approche|je retourne|je reviens|je rentre|je regarde|j'observe|j observe)\b/u.test(normalized);
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
    if (target === null) return payload(rawInput, unclear(rawInput, "Quel mécanisme visible veux-tu manipuler exactement ?"));
    const doorTarget = target;
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
  const semanticIntent = buildSemanticIntent({
    rawInput,
    intentType,
    commitment,
    target,
    action,
    coreMeaning,
    forbiddenInterpretations,
    topicValue,
    requiresClarification,
    confidence
  });
  const referentResolution = semanticIntent.kind === "observe_environment"
    && target === null
    ? {
        schemaVersion: 1 as const,
        usedPreviousContext: false,
        source: "none" as const,
        resolvedTarget: null,
        evidence: [rawInput.trim()].filter(Boolean),
        ambiguity: "none" as const,
        confidence: "high" as const
      }
    : buildReferentResolution(target, rawInput);
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
  const clarificationQuestion = "Je n'ai pas réussi à interpréter ta dernière intention. Peux-tu la reformuler ?";
  const semanticIntent: AiStructuredSemanticIntentV1 = {
    schemaVersion: 1,
    kind: "unclear_intent",
    playerGoal: "Demander au joueur de reformuler après une indisponibilité de l'interpréteur.",
    target: null,
    commitment: "none",
    evidenceFromInput: [failure.rawInput].filter(Boolean),
    uncertainties: ["Interprétation distante indisponible ou refusée."],
    forbiddenInterpretations: ["execute_action", "invent_narrative_fallback"],
    confidence: "low",
    perception: null,
    dialogueAct: null
  };
  const runtimeHandling: AiIntentRuntimeHandlingV1 = {
    schemaVersion: 1,
    status: "AI_INTERPRETATION_FAILED",
    reason: failure.developerSummary,
    requiredDomain: null,
    canonicalActionHint: null,
    noCommit: true,
    noGameTime: true
  };
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId,
    intentType: "meta_question",
    commitment: "none",
    target: null,
    action: null,
    semanticIntent,
    runtimeHandling,
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({ semanticIntent, runtimeSuggestion: runtimeHandling, requiresClarification: true }),
    referentResolution: null,
    coreMeaning: clarificationQuestion,
    requiresClarification: true,
    clarificationQuestion,
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
  topicValue: string | null;
  requiresClarification: boolean;
  confidence: AiStructuredPlayerIntentV1["confidence"];
}): AiStructuredSemanticIntentV1 {
  const kind = semanticKind(
    input.intentType,
    input.action,
    input.rawInput,
    input.target
  );
  return {
    schemaVersion: 1,
    kind,
    playerGoal: input.coreMeaning,
    target: input.target,
    commitment: input.commitment,
    evidenceFromInput: [input.rawInput.trim()].filter(Boolean),
    uncertainties: input.requiresClarification ? ["engagement, cible ou portée à clarifier"] : [],
    forbiddenInterpretations: [...input.forbiddenInterpretations],
    confidence: input.confidence,
    perception: kind === "observe_environment"
      ? {
          schemaVersion: 1,
          depth: localPerceptionDepth(input.rawInput),
          focus: input.coreMeaning,
          soughtInformation: localPerceptionDepth(input.rawInput) === "SEARCH"
            ? input.topicValue ?? input.coreMeaning
            : null
        }
      : null,
    dialogueAct: kind === "address_visible_actor"
      ? {
        schemaVersion: 1,
        act: localDialogueAct(input.rawInput),
        contentGoal: input.coreMeaning,
        addresseeRef: input.target?.ref ?? null
      }
      : null
  };
}

/** @deprecated Fixture de compatibilité ; ne jamais utiliser dans le chemin de jeu. */
export const createDefaultAiIntentInterpreterConfigV1 =
  createLocalAiIntentInterpreterFixtureConfigV1;

export function buildUnavailableAiIntentInterpretationV1(input: {
  intentId: string;
  rawInput: string;
  issues?: string[];
}): AiIntentInterpretationResultV1 {
  const failure = buildInterpretationFailure(input.rawInput, input.issues ?? [
    "No OpenAI player_intent_interpreter configuration is available."
  ]);
  return {
    schemaVersion: 1,
    contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7,
    usedAiInterpretation: false,
    usedFallback: false,
    interpretation: buildDiagnosticInterpretation(input.intentId, failure),
    acceptedOutput: null,
    interpretationFailure: failure,
    incidents: [],
    telemetry: [],
    safetyNotes: ["Diagnostic d'échec d'interprétation IA produit sans fallback narratif."]
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
  if (
    input.intentType === "action"
    && ((input.target?.ref?.startsWith("poi:") === true
      && /\b(je vais|je me dirige|j avance|j'avance|j entre|j'entre|je franchis)\b/u.test(normalize(input.rawInput)))
      || (input.target?.kind === "place" && isLocalTravelText(input.rawInput)))
  ) {
    return {
      schemaVersion: 1,
      status: "UNSUPPORTED_DOMAIN",
      reason: "Le franchissement explicite d'une limite visible doit être validé par le domaine monde injecté.",
      requiredDomain: "world",
      canonicalActionHint: input.action,
      noCommit: true,
      noGameTime: true
    };
  }
  if (input.intentType === "action" && input.action === "act" && isApproachOnlyText(input.rawInput)) {
    return {
      schemaVersion: 1,
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "Déplacement ou approche locale sans parole explicite, traité sans réaction PNJ automatique.",
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
  const manipulationTarget = input.target?.ref === null || input.target?.ref === undefined
    ? null
    : findSceneReferentByRefV1(REFERENCE_SCENE_REFERENT_REGISTRY_V1, input.target.ref);
  if (
    input.intentType === "action" &&
    (input.action === "open" || input.action === "force") &&
    manipulationTarget?.interactionCapabilities.includes("manipulate")
  ) {
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
  if (/\b(force|forcer|crochete|crocheter|enfonce|enfoncer)\b/u.test(normalized)) return "rules";
  if (/\b(voler|vole|prendre|prends|ramasser|ramasse|recuperer|recupere|deposer|depose|poser|pose|placer|place|laisser|laisse|ranger|range|mets|mettre|sortir|sors|retirer|retire|acheter|achete|vendre|vends|donner|donne|offrir|offre|recevoir|recois|accepter|accepte|equiper|equipe|desequiper|desequipe|presente|montre|utilise|mandat|ordre de passage)\b/u.test(normalized)) return "inventory";
  return "world";
}

function semanticKind(
  intentType: AiStructuredPlayerIntentV1["intentType"],
  action: string | null,
  rawInput: string,
  target: AiStructuredPlayerIntentV1["target"] = null
): AiStructuredSemanticIntentV1["kind"] {
  const normalized = normalize(rawInput);
  if (intentType === "meta_question") return "context_question";
  if (intentType === "possibility_query") return "hypothetical_action";
  if (intentType === "speech") return "address_visible_actor";
  if (intentType === "unclear_commitment") return "unclear_intent";
  if (
    intentType === "action"
    && ((target?.ref?.startsWith("poi:") === true
      && /\b(je vais|je me dirige|je retourne|je reviens|je rentre|j avance|j'avance|j entre|j'entre|je franchis)\b/u.test(normalized))
      || (target?.kind === "place" && isLocalTravelText(rawInput)))
  ) return "traverse_visible_boundary";
  if (intentType === "action" && isApproachOnlyText(rawInput)) return "nonverbal_signal";
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
  recentSemanticTurns?: RecentSemanticTurnV1[];
  localInteractionFocus?: LocalInteractionFocusV1 | null;
  runtimeContext?: InterpreterRuntimeContextV1;
  characterContext?: InterpreterCharacterContextV1 | null;
  playerPublicContext?: PlayerPublicContextV1 | null;
  playableScene?: PlayableSceneStateV1;
  activeCompanionRefs?: string[];
}): Promise<AiCallRequestV1> {
  const snapshotId = `${input.operationId}:snapshot:intent`;
  const packId = `${input.operationId}:pack:intent`;
  const playableScene = input.playableScene ?? REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1;
  const informationCatalog = input.config.informationCatalogForScene?.(playableScene) ?? null;
  const referentView = toSceneReferentRoleViewV1(buildSceneReferentRegistryV1(playableScene), "player_intent_interpreter");
  const usesSemanticContract = input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2 ||
    input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3 ||
    input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4 ||
    input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5 ||
    input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6 ||
    input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7 ||
    input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8;
  const usesOpenSemanticContract = input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8;
  const context = usesSemanticContract
    ? {
      schemaVersion: 1,
      sceneId: playableScene.sceneId,
      visibleReferents: referentView.referents.map(referent => ({
        ref: referent.canonicalRef,
        kind: referent.kind,
        name: referent.displayName,
        aliases: referent.publicAliases,
        publicProperties: referent.publicProperties,
        destinations: referent.publicDestinationAliases
      })),
      authority: "SEMANTIC_INTERPRETATION_ONLY"
    } satisfies JsonObject
    : {
      schemaVersion: 1,
      sceneId: playableScene.sceneId,
      locationName: playableScene.locationName,
      referentRegistry: referentView,
      authority: "INTERPRETATION_ONLY"
    } satisfies JsonObject;
  const localReferentHints = usesSemanticContract
    ? (input.localReferentHints ?? []).slice(0, 3).map(hint => ({ target: hint.target, confidence: hint.confidence }))
    : input.localReferentHints ?? [];
  const recentSemanticTurns = (input.recentSemanticTurns ?? []).slice(0, usesOpenSemanticContract ? 4 : usesSemanticContract ? 3 : 5);
  const activeDialogueTarget = usesSemanticContract
    ? resolveActiveDialogueTargetV1(input.localInteractionFocus, recentSemanticTurns)
    : null;
  const runtimeContext = input.runtimeContext ?? {
    schemaVersion: 1,
    contractVersion: "interpreter-runtime-context/1",
    capabilities: [],
    activeTravel: null
  };
  const embodiedContext = usesOpenSemanticContract
    ? buildInterpreterEmbodiedPublicContextV1({
        characterContext: input.characterContext ?? null,
        playerPublicContext: input.playerPublicContext ?? null,
        recentSemanticTurns,
        recentFocus: input.localReferentHints ?? [],
        activeInterlocutor: activeDialogueTarget,
        activeInteraction: input.localInteractionFocus ?? null,
        activeCompanionRefs: input.activeCompanionRefs ?? [],
        runtimeContext,
        informationCatalog
      })
    : null;
  const contextFingerprintMaterial = usesOpenSemanticContract
    ? { roleContextPack: context, embodiedContext }
    : {
        roleContextPack: context,
        localReferentHints,
        recentSemanticTurns,
        activeDialogueTarget,
        runtimeContext,
        characterContext: input.characterContext ?? null,
        playerPublicContext: input.playerPublicContext ?? null,
        activeCompanionRefs: input.activeCompanionRefs ?? []
      } as unknown as JsonObject;
  const task = usesOpenSemanticContract
    ? {
        rawInput: input.rawInput,
        embodiedContext,
        outputContract: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8,
        forbiddenAuthority: ["commit", "time", "inventory", "tactical", "durable_lore", "social_success", "private_knowledge"]
      }
    : {
        rawInput: input.rawInput,
        localReferentHints,
        recentSemanticTurns,
        activeDialogueTarget,
        runtimeContext,
        characterContext: input.characterContext ?? null,
        playerPublicContext: input.playerPublicContext ?? null,
        activeCompanionRefs: input.activeCompanionRefs ?? [],
        outputContract: input.config.contractVersion ?? AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
        forbiddenAuthority: ["commit", "time", "inventory", "tactical", "durable_lore", "social_success"]
      };
  return {
    schemaVersion: 1,
    callId: `${input.operationId}:ai:intent:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:intent:attempt:1`,
    campaignId: input.campaignId,
    snapshotId,
    packId,
    role: input.config.route.role,
    contractVersion: input.config.contractVersion ?? AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint(contextFingerprintMaterial) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:ai:intent`,
    input: {
      instructionsRef: input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V8
        ? "ai-intent-interpretation/player-intent-semantic/v8"
        : input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7
        ? "ai-intent-interpretation/player-intent-semantic/v7"
        : input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6
        ? "ai-intent-interpretation/player-intent-semantic/v6"
        : input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V5
        ? "ai-intent-interpretation/player-intent-semantic/v5"
        : input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V4
          ? "ai-intent-interpretation/player-intent-semantic/v4"
        : input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V3
        ? "ai-intent-interpretation/player-intent-semantic/v3"
        : input.config.contractVersion === AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2
          ? "ai-intent-interpretation/player-intent-semantic/v2"
        : "ai-intent-interpretation/player-intent-interpreter/v1",
      roleContextPack: context,
      task
    },
    limits: {
      inputTokenBudget: Math.min(
        usesOpenSemanticContract ? 4_000 : 2_000,
        input.config.route.inputTokenLimit
      ),
      outputTokenBudget: Math.min(1_600, input.config.route.outputTokenLimit),
      timeoutMs: input.config.route.timeoutMs
    }
  };
}

function requireCharacterReferenceClarificationV1(
  interpretation: NarrativeIntentInterpretationV1,
  ambiguity: InterpreterCharacterAmbiguityV1,
  rawInput: string
): NarrativeIntentInterpretationV1 {
  const labels = [...new Set(ambiguity.candidateLabels)];
  const question = labels.length === 2
    ? `Tu parles de ${labels[0]} ou de ${labels[1]} ?`
    : `Quelle référence veux-tu utiliser parmi : ${labels.join(", ")} ?`;
  const semanticIntent = {
    ...interpretation.semanticIntent,
    kind: "unclear_intent" as const,
    target: null,
    commitment: "unclear" as const,
    evidenceFromInput: [rawInput.trim()].filter(Boolean),
    uncertainties: [
      ...new Set([
        ...interpretation.semanticIntent.uncertainties,
        `La mention « ${ambiguity.alias} » correspond à plusieurs références du personnage.`
      ])
    ],
    forbiddenInterpretations: [
      ...new Set([
        ...interpretation.semanticIntent.forbiddenInterpretations,
        "select_ambiguous_character_reference",
        "execute_without_clarification"
      ])
    ],
    confidence: "medium" as const,
    perception: null,
    dialogueAct: null,
    restPlan: null,
    composition: undefined
  };
  const runtimeHandling: AiIntentRuntimeHandlingV1 = {
    schemaVersion: 1,
    status: "NEEDS_CLARIFICATION",
    reason: "Plusieurs références publiques du personnage correspondent à la formulation.",
    requiredDomain: null,
    canonicalActionHint: null,
    noCommit: true,
    noGameTime: true
  };
  return {
    ...interpretation,
    intentType: "unclear_commitment",
    commitment: "unclear",
    target: null,
    action: null,
    semanticIntent,
    runtimeHandling,
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
      semanticIntent,
      runtimeSuggestion: runtimeHandling,
      requiresClarification: true
    }),
    referentResolution: {
      schemaVersion: 1,
      usedPreviousContext: false,
      source: "current_input",
      resolvedTarget: null,
      evidence: [rawInput.trim()].filter(Boolean),
      ambiguity: "multiple_candidates",
      confidence: "medium"
    },
    requiresClarification: true,
    clarificationQuestion: question,
    expectedTimeEffect: "NO_GAME_TIME",
    safetyNotes: [
      ...interpretation.safetyNotes,
      "La garde locale interdit de choisir arbitrairement entre plusieurs références du personnage."
    ]
  };
}

export function resolveActiveDialogueTargetV1(
  focus: LocalInteractionFocusV1 | null | undefined,
  recentSemanticTurns: RecentSemanticTurnV1[]
): ActiveDialogueTargetV1 | null {
  if (focus?.status === "ACTIVE" && focus.mode === "DIALOGUE") {
    return {
      schemaVersion: 1,
      target: {
        kind: "npc",
        ref: focus.targetRef,
        label: focus.targetDisplayName
      },
      sourceOperationId: focus.lastConfirmedOperationId,
      sourcePlayerGoal: focus.publicSummary
    };
  }
  return focus === undefined ? findActiveDialogueTargetV1(recentSemanticTurns) : null;
}

function findActiveDialogueTargetV1(
  recentSemanticTurns: RecentSemanticTurnV1[]
): ActiveDialogueTargetV1 | null {
  const releasedTargetRefs = new Set<string>();
  for (const turn of recentSemanticTurns) {
    if (
      turn.focusDisposition === "RELEASE" &&
      turn.primaryTarget?.ref !== null &&
      turn.primaryTarget?.ref !== undefined
    ) {
      releasedTargetRefs.add(turn.primaryTarget.ref);
      continue;
    }
    if (
      turn.semanticKind === "address_visible_actor" &&
      turn.primaryTarget?.kind === "npc" &&
      turn.primaryTarget.ref !== null &&
      !releasedTargetRefs.has(turn.primaryTarget.ref)
    ) {
      return {
        schemaVersion: 1,
        target: {
          kind: "npc",
          ref: turn.primaryTarget.ref,
          label: turn.primaryTarget.label
        },
        sourceOperationId: turn.operationId,
        sourcePlayerGoal: turn.playerGoal
      };
    }
  }
  return null;
}

function mapAiIntentToNarrativeInterpretationV1(input: {
  intentId: string;
  rawInput: string;
  payload: AiIntentInterpretationPayloadV1;
}): { ok: true; interpretation: NarrativeIntentInterpretationV1 } | { ok: false; issues?: string[] } {
  const first = input.payload.intents[0];
  if (!first) return { ok: false, issues: ["payload.intents must contain at least one intention."] };
  if (first.confidence === "low") return { ok: false, issues: ["Top-level interpretation confidence is low."] };
  if (first.semanticIntent.confidence === "low") return { ok: false, issues: ["semanticIntent confidence is low."] };
  if (first.semanticIntent.commitment !== first.commitment) return { ok: false, issues: ["semanticIntent.commitment contradicts the legacy commitment projection."] };
  if (first.runtimeHandling.status === "AI_INTERPRETATION_FAILED") return { ok: false, issues: ["runtimeHandling reports AI_INTERPRETATION_FAILED in an accepted envelope."] };
  if (first.runtimeHandling.status === "NEEDS_CLARIFICATION" && first.requiresClarification !== true) return { ok: false, issues: ["runtimeHandling requires clarification but requiresClarification is false."] };
  if (first.intentType === "possibility_query" && first.commitment !== "hypothetical") return { ok: false, issues: ["possibility_query must remain hypothetical."] };
  if (first.intentType === "meta_question" && first.commitment !== "none") return { ok: false, issues: ["meta_question must not carry player commitment."] };
  if (first.intentType === "speech" && first.commitment !== "committed") return { ok: false, issues: ["speech must carry committed player intent."] };
  if (first.intentType === "action" && first.commitment !== "committed") return { ok: false, issues: ["action must carry committed player intent."] };
  if (first.riskFlags.includes("secret_reveal") || first.riskFlags.includes("social_success_granted")) return { ok: false, issues: ["Interpretation contains a forbidden authority risk flag."] };
  const canonicalFirst = stabilizeLocalPerceptionIntent(
    stabilizeCanonicalDialogueAct(
      stabilizeCanonicalRuntimeSuggestion(
        canonicalizeVisibleTargetRefs(first, REFERENCE_SCENE_REFERENT_REGISTRY_V1)
      ),
      input.rawInput
    ),
    input.rawInput
  );
  const runtimeConsistencyIssues = intentRuntimeConsistencyIssues(canonicalFirst);
  if (runtimeConsistencyIssues.length > 0) {
    return {
      ok: false,
      issues: [
        `runtimeHandling is inconsistent with the canonical semantic intention. Proposed values: ${formatProposedIntentRuntime(canonicalFirst)}.`,
        ...runtimeConsistencyIssues
      ]
    };
  }
  const mappedFirst = normalizeMappedIntentTarget(canonicalFirst);
  const referentClarification = committedActionReferentClarification(mappedFirst, input.rawInput);
  if (referentClarification !== null) {
    return acceptMappedInterpretation({
        schemaVersion: 1,
        contractVersion: "intent-clarification/1",
        intentId: input.intentId,
        intentType: mappedFirst.intentType,
        commitment: mappedFirst.semanticIntent.commitment,
        target: mappedFirst.target,
        action: mappedFirst.action,
        semanticIntent: mappedFirst.semanticIntent,
        runtimeHandling: mappedFirst.runtimeHandling,
        runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
          semanticIntent: mappedFirst.semanticIntent,
          runtimeSuggestion: mappedFirst.runtimeHandling,
          requiresClarification: true
        }),
        referentResolution: mappedFirst.referentResolution ?? buildReferentResolution(mappedFirst.target, input.rawInput),
        coreMeaning: mappedFirst.coreMeaning,
        requiresClarification: true,
        clarificationQuestion: referentClarification,
        expectedTimeEffect: "NO_GAME_TIME",
        safetyNotes: [
          "Référent d'action locale non validé: clarification obligatoire avant résolution.",
          ...first.forbiddenInterpretations.map(entry => `Interprétation interdite: ${entry}`)
        ]
    });
  }

  return acceptMappedInterpretation({
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: input.intentId,
    intentType: mappedFirst.intentType,
    commitment: mappedFirst.commitment,
    target: mappedFirst.target,
    action: mappedFirst.action,
    semanticIntent: mappedFirst.semanticIntent,
    runtimeHandling: mappedFirst.runtimeHandling,
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
      semanticIntent: mappedFirst.semanticIntent,
      runtimeSuggestion: mappedFirst.runtimeHandling,
      requiresClarification: mappedFirst.requiresClarification
    }),
    referentResolution: mappedFirst.referentResolution ?? buildReferentResolution(mappedFirst.target, input.rawInput),
    coreMeaning: mappedFirst.coreMeaning,
    requiresClarification: mappedFirst.requiresClarification,
    clarificationQuestion: mappedFirst.clarificationQuestion,
    expectedTimeEffect: mappedFirst.expectedTimeEffect,
    safetyNotes: [
      "Interprétation proposée par player_intent_interpreter et validée localement.",
      ...first.forbiddenInterpretations.map(entry => `Interprétation interdite: ${entry}`)
    ]
  });
}

function normalizeMappedIntentTarget(intentValue: AiStructuredPlayerIntentV1): AiStructuredPlayerIntentV1 {
  const proposedTarget = intentValue.referentResolution?.resolvedTarget ?? intentValue.semanticIntent.target ?? intentValue.target;
  if (intentValue.semanticIntent.kind === "observe_environment" && proposedTarget?.kind === "unknown" && proposedTarget.ref === null) {
    const referentResolution = intentValue.referentResolution;
    return {
      ...intentValue,
      target: null,
      referentResolution: referentResolution == null ? null : { ...referentResolution, resolvedTarget: null },
      semanticIntent: { ...intentValue.semanticIntent, target: null }
    };
  }
  if (intentValue.semanticIntent.kind !== "nonverbal_signal") return intentValue;
  const target = proposedTarget;
  if (target === null || target.kind !== "npc") return intentValue;
  return {
    ...intentValue,
    target,
    semanticIntent: {
      ...intentValue.semanticIntent,
      target
    }
  };
}

function acceptMappedInterpretation(
  interpretation: NarrativeIntentInterpretationV1
): { ok: true; interpretation: NarrativeIntentInterpretationV1 } | { ok: false; issues: string[] } {
  const validation = validateCanonicalIntentAuthorityV1(interpretation);
  return validation.ok
    ? { ok: true, interpretation }
    : { ok: false, issues: validation.issues };
}

function intentRuntimeConsistencyIssues(intentValue: AiStructuredPlayerIntentV1): string[] {
  const issues: string[] = [];
  if (intentValue.semanticIntent.kind === "address_visible_actor") {
    if (intentValue.runtimeHandling.noCommit !== false) issues.push("address_visible_actor requires runtimeHandling.noCommit=false.");
  }
  const target = intentValue.referentResolution?.resolvedTarget ?? intentValue.target ?? null;
  if (
    target?.kind === "npc" &&
    intentValue.semanticIntent.kind === "nonverbal_signal"
  ) {
    if (intentValue.runtimeHandling.requiredDomain !== "scene_resolution") issues.push("nonverbal_signal targeting an NPC requires requiredDomain=scene_resolution.");
    if (intentValue.runtimeHandling.noCommit !== false) issues.push("nonverbal_signal targeting an NPC requires noCommit=false.");
    if (intentValue.runtimeHandling.noGameTime !== true) issues.push("nonverbal_signal targeting an NPC requires noGameTime=true.");
  }
  return issues;
}

function mapOpenSemanticFrameV8ToNarrativeInterpretation(input: {
  intentId: string;
  rawInput: string;
  payload: AiSemanticIntentPayloadV8;
  referentRegistry: SceneReferentRegistryV1;
  publicReferenceRefs: ReadonlySet<string>;
  informationCatalog: LoreInformationSemanticCatalogV1 | null;
  runtimeContext: InterpreterRuntimeContextV1;
}): { ok: true; interpretation: NarrativeIntentInterpretationV1 } | { ok: false; issues: string[] } {
  const rawInputEchoMatches = input.payload.rawInputEcho === input.rawInput;
  const frame = input.payload.semanticFrame;
  const invalidRefs = [...new Set(frame.components.flatMap(component =>
    [
      ...component.mentionedTargets.map(target => target.proposedRef),
      component.informationNeed?.proposedSubjectRef ?? null,
      ...(component.informationNeed?.contractVersion === "information-need/2"
        ? component.informationNeed.proposedScopeRefs
        : [])
    ]
      .filter((ref): ref is string => ref !== null)
      .filter(ref =>
        findSceneReferentByRefV1(input.referentRegistry, ref) === null
        && !input.publicReferenceRefs.has(ref)
      )
  ))];
  if (invalidRefs.length > 0) {
    return {
      ok: false,
      issues: invalidRefs.map(ref => `V8 proposedRef is not present in the public scene context: ${ref}.`)
    };
  }
  const allowedPropertyRefs = new Set(input.informationCatalog?.properties.map(property => property.ref) ?? []);
  const allowedRelationRefs = new Set(input.informationCatalog?.relations.map(relation => relation.ref) ?? []);
  const invalidSelectorRefs = [...new Set(frame.components.flatMap(component =>
    component.informationNeed?.contractVersion === "information-need/2"
      ? [
          ...component.informationNeed.proposedPropertyRefs.filter(ref => !allowedPropertyRefs.has(ref)),
          ...component.informationNeed.completionPropertyRefs.filter(ref => !allowedPropertyRefs.has(ref)),
          ...component.informationNeed.proposedRelationRefs.filter(ref => !allowedRelationRefs.has(ref))
        ]
      : []
  ))];
  if (invalidSelectorRefs.length > 0) {
    return {
      ok: false,
      issues: invalidSelectorRefs.map(ref => `V8 information selector is not present in the public lore catalogue: ${ref}.`)
    };
  }
  const incompleteUnderstoodNeeds = frame.understandingStatus === "UNDERSTOOD"
    ? frame.components.flatMap(component => {
        const need = component.informationNeed;
        if (need?.contractVersion !== "information-need/2") return [];
        return (
          (need.proposedSubjectRef === null && need.proposedScopeRefs.length === 0)
          || need.proposedPropertyRefs.length === 0
          || need.completionPropertyRefs.length === 0
        ) ? [component.componentId] : [];
      })
    : [];
  if (incompleteUnderstoodNeeds.length > 0) {
    return {
      ok: false,
      issues: incompleteUnderstoodNeeds.map(componentId =>
        `V8 understood factual component has incomplete public lore selectors: ${componentId}.`
      )
    };
  }

  const needsClarification = frame.understandingStatus === "NEEDS_CLARIFICATION";
  const executionPlan = buildOpenSemanticExecutionPlanV1({
    frame,
    runtimeContext: input.runtimeContext
  });
  const compatibilityCommitment = frame.overallCommitment === "mixed"
    ? "unclear" as const
    : frame.overallCommitment;
  const runtimeHandling: AiIntentRuntimeHandlingV1 = {
    schemaVersion: 1,
    status: needsClarification ? "NEEDS_CLARIFICATION" : "UNSUPPORTED_DOMAIN",
    reason: needsClarification
      ? "OpenAI demande une clarification sémantique avant tout handoff."
      : "Cadre V8 compris; le plan G5 route uniquement les identifiants exacts de capacités publiques vers leurs propriétaires.",
    requiredDomain: null,
    canonicalActionHint: null,
    noCommit: true,
    noGameTime: true
  };
  const semanticIntent: AiStructuredSemanticIntentV1 = {
    schemaVersion: 1,
    kind: "unclear_intent",
    playerGoal: frame.overallMeaning,
    target: null,
    commitment: compatibilityCommitment,
    preconditions: [...frame.globalConditions],
    evidenceFromInput: [],
    uncertainties: frame.ambiguities.map(ambiguity => ambiguity.summary),
    forbiddenInterpretations: [
      "reinterpret_open_semantic_frame",
      "execute_before_owner_preflight",
      "infer_domain_from_raw_input"
    ],
    confidence: frame.confidence,
    perception: null,
    dialogueAct: null,
    restPlan: null
  };
  return {
    ok: true,
    interpretation: {
      schemaVersion: 1,
      contractVersion: "intent-clarification/1",
      intentId: input.intentId,
      intentType: "unclear_commitment",
      commitment: compatibilityCommitment,
      target: null,
      action: null,
      semanticIntent,
      runtimeHandling,
      runtimeDecision: {
        schemaVersion: 1,
        source: "LOCAL_CAPABILITY_REGISTRY",
        status: needsClarification ? "NEEDS_CLARIFICATION" : "UNSUPPORTED_DOMAIN",
        requiredDomain: null,
        reason: runtimeHandling.reason,
        noCommit: true,
        noGameTime: true,
        aiSuggestionMatched: true
      },
      referentResolution: null,
      coreMeaning: frame.overallMeaning,
      requiresClarification: needsClarification,
      clarificationQuestion: frame.clarificationQuestion,
      expectedTimeEffect: "NO_GAME_TIME",
      safetyNotes: [
        "Le cadre sémantique V8 est la source de vérité; la projection canonique historique est non autoritaire et non exécutable.",
        rawInputEchoMatches
          ? "rawInputEcho correspond exactement à la saisie locale."
          : "rawInputEcho diffère de la saisie locale et reste ignoré; l'enveloppe d'appel corrèle la réponse et le texte original local demeure autoritaire.",
        needsClarification
          ? "La clarification déclarée par OpenAI est transmise sans domaine, commit ni temps."
          : "Le plan G5 conserve l'ordre et ne route que les capacités publiques exactes; chaque propriétaire garde ses préconditions et son commit."
      ],
      semanticSource: "OPEN_SEMANTIC_FRAME_V8",
      openSemanticFrame: frame,
      openSemanticRuntime: {
        schemaVersion: 1,
        understandingStatus: frame.understandingStatus,
        executionPlan,
        components: executionPlan.steps.map(step => ({
          componentId: step.componentId,
          status: step.disposition,
          capabilityId: step.capabilityId,
          requiredDomain: step.requiredDomain,
          noCommit: true,
          noGameTime: true
        }))
      }
    }
  };
}

function mapSemanticIntentV2ToNarrativeInterpretation(input: {
  intentId: string;
  rawInput: string;
  payload: AiSemanticIntentPayloadV2 | AiSemanticIntentPayloadV3 | AiSemanticIntentPayloadV4 | AiSemanticIntentPayloadV5 | AiSemanticIntentPayloadV6 | AiSemanticIntentPayloadV7;
  localReferentHints: LocalReferentHintV1[];
  referentRegistry: SceneReferentRegistryV1;
  characterContext: InterpreterCharacterContextV1 | null;
}): { ok: true; interpretation: NarrativeIntentInterpretationV1 } | { ok: false; issues?: string[] } {
  const providerProposal = input.payload.intent;
  const providerProposalWithCanonicalCommitment = {
    ...providerProposal,
    commitment: providerProposal.preconditions.length > 0 && providerProposal.commitment === "committed"
      ? "conditional" as const
      : providerProposal.commitment
  };
  const initiallyResolvedTarget = resolveSemanticTargetMentionV2(
    providerProposalWithCanonicalCommitment.targetMention,
    input.localReferentHints,
    providerProposalWithCanonicalCommitment.kind,
    input.referentRegistry,
    input.characterContext
  );
  const proposed = canonicalizeResolvedDestinationIntentV2(
    providerProposalWithCanonicalCommitment,
    initiallyResolvedTarget,
    input.referentRegistry
  );
  if ((proposed.kind === "hypothetical_action") !== (proposed.commitment === "hypothetical")) {
    return { ok: false, issues: ["V2 hypothetical kind and commitment are inconsistent."] };
  }
  const target = proposed.kind === providerProposalWithCanonicalCommitment.kind
    ? initiallyResolvedTarget
    : resolveSemanticTargetMentionV2(
      proposed.targetMention,
      input.localReferentHints,
      proposed.kind,
      input.referentRegistry,
      input.characterContext
    ) ?? initiallyResolvedTarget;
  const needsTarget = ["address_visible_actor", "move_near_visible_actor", "manipulate_visible_object", "nonverbal_signal"].includes(proposed.kind);
  const requiresClarification = proposed.kind === "unclear_intent" ||
    proposed.commitment === "unclear" ||
    proposed.confidence === "low" ||
    (needsTarget && target === null);
  const intentType = semanticKindToLegacyIntentType(proposed.kind);
  const legacyAction = legacyActionFromSemanticV2(proposed);
  const forbiddenInterpretations = ["automatic_success", "hidden_reveal", "durable_state_mutation"];
  if (proposed.kind === "manipulate_visible_object" && proposed.scope !== "SCENE_TRANSITION") forbiddenInterpretations.push("scene_transition");
  const semanticIntent: AiStructuredSemanticIntentV1 = {
    schemaVersion: 1,
    kind: proposed.kind,
    playerGoal: proposed.playerGoal,
    target,
    commitment: proposed.commitment,
    preconditions: [...proposed.preconditions],
    evidenceFromInput: [input.rawInput.trim()].filter(Boolean),
    uncertainties: [...proposed.uncertainties],
    forbiddenInterpretations,
    confidence: proposed.confidence,
    perception: proposed.kind === "observe_environment" ? proposed.perception : null,
    dialogueAct: proposed.kind === "address_visible_actor" && proposed.dialogueAct !== null
      ? {
        schemaVersion: 1,
        act: proposed.dialogueAct.act,
        contentGoal: proposed.dialogueAct.contentGoal,
        addresseeRef: target?.ref ?? null
      }
      : null,
    ...("companionDirective" in proposed ? {
      companionDirective: proposed.companionDirective === null
        ? null
        : { ...proposed.companionDirective }
    } : {}),
    ...("composition" in proposed ? {
      composition: {
        schemaVersion: 1 as const,
        orderedComponents: [
          ...("orientation" in proposed.composition && proposed.composition.orientation !== null ? [{
            order: proposed.composition.orientation.order,
            kind: "LOCATE_VISIBLE_TARGET" as const,
            playerGoal: proposed.composition.orientation.playerGoal
          }] : []),
          ...(proposed.composition.spatialLeadIn === null ? [] : [{
            order: proposed.composition.spatialLeadIn.order,
            kind: "APPROACH_TARGET" as const,
            playerGoal: proposed.composition.spatialLeadIn.playerGoal
          }]),
          ...(proposed.composition.communication === null ? [] : [{
            order: proposed.composition.communication.order,
            kind: proposed.composition.communication.mode === "SPEECH" ? "SPEECH" as const : "NONVERBAL_SIGNAL" as const,
            playerGoal: proposed.composition.communication.contentGoal
          }]),
          ...("spatialFollowUp" in proposed.composition && proposed.composition.spatialFollowUp !== null ? [{
            order: proposed.composition.spatialFollowUp.order,
            kind: "REPOSITION_AWAY" as const,
            playerGoal: proposed.composition.spatialFollowUp.playerGoal
          }] : [])
        ].sort((left, right) => left.order - right.order)
      }
    } : {})
  };
  const mappedIntent: AiStructuredPlayerIntentV1 = {
    intentId: "intent:1",
    order: 1,
    intentType,
    commitment: proposed.commitment,
    target,
    action: legacyAction,
    semanticIntent,
    runtimeHandling: semanticRuntimeSuggestionV2(proposed, requiresClarification, legacyAction),
    referentResolution: buildSemanticReferentResolutionV2(proposed.targetMention, target, proposed.kind, input.rawInput),
    topic: null,
    coreMeaning: proposed.playerGoal,
    playerImposedDetails: [input.rawInput.trim()].filter(Boolean),
    openDetails: [],
    forbiddenInterpretations,
    requiresClarification,
    clarificationQuestion: requiresClarification ? proposed.clarificationPrompt ?? "Que veux-tu cibler ou accomplir exactement ?" : null,
    riskFlags: [],
    expectedTimeEffect: proposed.commitment === "committed" || proposed.commitment === "conditional" ? "DOMAIN_TO_DECIDE" : "NO_GAME_TIME",
    confidence: proposed.confidence
  };
  const stabilizedSemantic = "composition" in proposed
    ? mappedIntent
    : stabilizeCanonicalDialogueAct(mappedIntent, input.rawInput);
  return acceptMappedInterpretation({
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: input.intentId,
    intentType,
    commitment: stabilizedSemantic.commitment,
    target,
    action: stabilizedSemantic.action,
    semanticIntent: stabilizedSemantic.semanticIntent,
    runtimeHandling: stabilizedSemantic.runtimeHandling,
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
      semanticIntent: stabilizedSemantic.semanticIntent,
      runtimeSuggestion: stabilizedSemantic.runtimeHandling,
      requiresClarification
    }),
    referentResolution: stabilizedSemantic.referentResolution ?? null,
    coreMeaning: proposed.playerGoal,
    requiresClarification,
    clarificationQuestion: stabilizedSemantic.clarificationQuestion,
    expectedTimeEffect: stabilizedSemantic.expectedTimeEffect,
    safetyNotes: [
      "composition" in proposed
        ? "Intention composée V3 proposée par l'IA; intention principale, référent, autorité et routage reconstruits localement."
        : "Intention sémantique V2 proposée par l'IA; référent, autorité et routage reconstruits localement."
    ]
  });
}

function canonicalizeSemanticCompositionV3(payload: AiSemanticIntentPayloadV3): AiSemanticIntentPayloadV3 {
  const composition = payload.intent.composition;
  const communication = composition.communication;
  const spatialLeadIn = composition.spatialLeadIn;
  let kind = payload.intent.kind;
  let dialogueAct = payload.intent.dialogueAct;
  let domainHint = payload.intent.domainHint;
  let scope = payload.intent.scope;
  if (communication?.mode === "SPEECH") {
    kind = "address_visible_actor";
    dialogueAct = {
      act: communication.act ?? "OTHER",
      contentGoal: communication.contentGoal
    };
    domainHint = "social";
    scope = "SOCIAL_EXCHANGE";
  } else if (communication?.mode === "NONVERBAL") {
    kind = "nonverbal_signal";
    dialogueAct = null;
    domainHint = "scene_resolution";
    scope = "LOCAL_INTERACTION";
  } else if (
    spatialLeadIn !== null
    && payload.intent.kind !== "traverse_visible_boundary"
    && payload.intent.scope !== "SCENE_TRANSITION"
  ) {
    kind = "move_near_visible_actor";
    dialogueAct = null;
    domainHint = "scene_resolution";
    scope = "LOCAL_INTERACTION";
  }
  return {
    ...payload,
    intent: {
      ...payload.intent,
      kind,
      dialogueAct,
      domainHint,
      scope
    }
  };
}

function canonicalizeSemanticIntentV4(payload: AiSemanticIntentPayloadV4): AiSemanticIntentPayloadV4 {
  const composition = payload.intent.composition;
  if (composition.communication !== null || composition.spatialLeadIn !== null) {
    return canonicalizeSemanticCompositionV3(payload) as AiSemanticIntentPayloadV4;
  }
  if (composition.orientation === null) return payload;
  return {
    ...payload,
    intent: {
      ...payload.intent,
      kind: "observe_environment",
      domainHint: "perception",
      scope: "PERCEPTION",
      perception: {
        schemaVersion: 1,
        depth: "GLANCE",
        focus: composition.orientation.playerGoal,
        soughtInformation: composition.orientation.playerGoal,
        informationKind: "PRESENCE"
      },
      dialogueAct: null
    }
  };
}

function canonicalizeSemanticIntentV5(payload: AiSemanticIntentPayloadV5): AiSemanticIntentPayloadV5 {
  return canonicalizeSemanticIntentV4(payload) as AiSemanticIntentPayloadV5;
}

function canonicalizeSemanticIntentV6(payload: AiSemanticIntentPayloadV6): AiSemanticIntentPayloadV6 {
  return canonicalizeSemanticIntentV5(payload) as AiSemanticIntentPayloadV6;
}

function canonicalizeSemanticIntentV7(payload: AiSemanticIntentPayloadV7): AiSemanticIntentPayloadV7 {
  return canonicalizeSemanticIntentV5(payload) as AiSemanticIntentPayloadV7;
}

function canonicalizeResolvedDestinationIntentV2<
  TIntent extends AiSemanticIntentPayloadV2["intent"]
>(
  intent: TIntent,
  target: AiStructuredPlayerIntentV1["target"],
  referentRegistry: SceneReferentRegistryV1
): TIntent {
  if (intent.kind !== "move_near_visible_actor" || target?.ref === null || target?.ref === undefined) {
    return intent;
  }
  const referent = findSceneReferentByRefV1(referentRegistry, target.ref);
  const destinationIsExplicitInStructuredOutput =
    intent.scope === "SCENE_TRANSITION"
    || intent.domainHint === "world"
    || intent.targetMention?.candidateKind === "place";
  if (
    referent === null
    || referent.publicDestinationAliases.length === 0
    || !destinationIsExplicitInStructuredOutput
  ) {
    return intent;
  }
  return {
    ...intent,
    kind: "traverse_visible_boundary",
    domainHint: "world",
    scope: "SCENE_TRANSITION"
  } as TIntent;
}

function resolveSemanticTargetMentionV2(
  mention: AiSemanticIntentPayloadV2["intent"]["targetMention"],
  hints: LocalReferentHintV1[],
  semanticKind: AiSemanticIntentPayloadV2["intent"]["kind"],
  referentRegistry: SceneReferentRegistryV1,
  characterContext: InterpreterCharacterContextV1 | null
): AiStructuredPlayerIntentV1["target"] {
  if (mention === null) return null;
  if (mention.contextLink === "RECENT_FOCUS") {
    const recent = hints.find(hint =>
      (mention.candidateKind === "unknown" || hint.target.kind === mention.candidateKind) &&
      (mention.proposedRef === null || hint.target.ref === mention.proposedRef)
    );
    return recent?.target ?? null;
  }
  if (mention.proposedRef !== null) {
    const referent = findSceneReferentByRefV1(referentRegistry, mention.proposedRef);
    if (referent !== null) return toNarrativeIntentTargetV1(referent);
    const characterTarget = resolveCharacterTargetV1(
      mention.proposedRef,
      mention.candidateKind,
      characterContext
    );
    if (characterTarget !== null) return characterTarget;
  }
  if (mention.contextLink === "SCENE_DESCRIPTION" || semanticKind === "traverse_visible_boundary") {
    const candidateKind = mention.candidateKind === "npc" || mention.candidateKind === "object" || mention.candidateKind === "place"
      ? mention.candidateKind
      : undefined;
    const described = resolveSceneReferentDescriptionV1(referentRegistry, mention.surface, candidateKind);
    if (described.status === "RESOLVED") return toNarrativeIntentTargetV1(described.referent);
    if (semanticKind === "traverse_visible_boundary" && mention.candidateKind === "place" && mention.surface.trim()) {
      return { kind: "place", ref: null, label: mention.surface.trim() };
    }
  }
  return null;
}

function resolveCharacterTargetV1(
  proposedRef: string,
  candidateKind: "npc" | "place" | "object" | "self" | "unknown",
  context: InterpreterCharacterContextV1 | null
): AiStructuredPlayerIntentV1["target"] {
  if (context === null) return null;
  if (
    candidateKind === "self"
    && proposedRef === context.character.ref
  ) return {
    kind: "self",
    ref: context.character.ref,
    label: context.character.label
  };
  if (candidateKind !== "object") return null;
  const reference = context.references.find(candidate =>
    candidate.ref === proposedRef
    && (candidate.kind === "INVENTORY_ITEM" || candidate.kind === "EQUIPPED_ITEM")
  );
  return reference === undefined ? null : {
    kind: "object",
    ref: reference.ref,
    label: reference.label
  };
}

function semanticKindToLegacyIntentType(kind: AiStructuredSemanticIntentV1["kind"]): AiStructuredPlayerIntentV1["intentType"] {
  if (kind === "address_visible_actor") return "speech";
  if (["move_near_visible_actor", "manipulate_visible_object", "traverse_visible_boundary", "observe_environment", "nonverbal_signal"].includes(kind)) return "action";
  if (kind === "hypothetical_action") return "possibility_query";
  if (kind === "context_question" || kind === "meta_request") return "meta_question";
  return "unclear_commitment";
}

function legacyActionFromSemanticV2(proposed: AiSemanticIntentPayloadV2["intent"]): string | null {
  if (proposed.kind === "address_visible_actor") return proposed.dialogueAct?.act === "ASK_QUESTION" ? "ask" : "act";
  if (proposed.kind === "observe_environment") return "observe";
  if (proposed.kind === "move_near_visible_actor") return "act";
  if (proposed.kind === "traverse_visible_boundary") return proposed.actionHint ?? "act";
  if (proposed.kind === "nonverbal_signal") return "act";
  if (proposed.kind === "hypothetical_action") return "ask_possibility";
  return proposed.actionHint;
}

function semanticRuntimeSuggestionV2(
  proposed: AiSemanticIntentPayloadV2["intent"],
  requiresClarification: boolean,
  legacyAction: string | null
): AiIntentRuntimeHandlingV1 {
  const noCommit = requiresClarification || proposed.commitment !== "committed" || proposed.kind === "observe_environment";
  return {
    schemaVersion: 1,
    status: requiresClarification ? "NEEDS_CLARIFICATION" : ["inventory", "rules", "tactical", "rest", "world"].includes(proposed.domainHint ?? "") ? "UNSUPPORTED_DOMAIN" : "SUPPORTED_BY_CURRENT_RUNTIME",
    reason: requiresClarification ? "Le sens ou le référent doit être précisé." : "Suggestion de domaine issue du sens V2; décision finale réservée au registre runtime local.",
    requiredDomain: proposed.scope === "SCENE_TRANSITION" ? "world" : proposed.domainHint,
    canonicalActionHint: legacyAction,
    noCommit,
    noGameTime: true
  };
}

function buildSemanticReferentResolutionV2(
  mention: AiSemanticIntentPayloadV2["intent"]["targetMention"],
  target: AiStructuredPlayerIntentV1["target"],
  semanticKind: AiSemanticIntentPayloadV2["intent"]["kind"],
  rawInput: string
): NonNullable<AiStructuredPlayerIntentV1["referentResolution"]> {
  const unresolvedMentionRequiresTarget = [
    "address_visible_actor",
    "move_near_visible_actor",
    "manipulate_visible_object",
    "nonverbal_signal"
  ].includes(semanticKind);
  return {
    schemaVersion: 1,
    usedPreviousContext: mention?.contextLink === "RECENT_FOCUS",
    source: mention?.contextLink === "RECENT_FOCUS" ? "recent_visible_focus" : target === null ? "none" : "current_input",
    resolvedTarget: target,
    evidence: [mention?.surface ?? rawInput].filter(Boolean),
    ambiguity: target === null && mention !== null && unresolvedMentionRequiresTarget ? "insufficient_context" : "none",
    confidence: target === null ? "medium" : "high"
  };
}

function localDialogueAct(rawInput: string): NonNullable<AiStructuredSemanticIntentV1["dialogueAct"]>["act"] {
  const normalized = normalize(rawInput);
  if (/\b(veux-tu|souhaites-tu|rejoins|rejoindre|accompagne|reste ici|reviens avec|va seul)\b/u.test(normalized)) return "REQUEST_ACTION";
  if (/\b(je demande|je lui demande|je questionne|j'interroge|j interroge)\s+(?:de|d')\b/u.test(normalized)) return "REQUEST_ACTION";
  if (/\b(je demande|je lui demande|je questionne|j'interroge|j interroge)\b/u.test(normalized) || /[?？]/u.test(rawInput)) return "ASK_QUESTION";
  if (/\b(bonjour|bonsoir|salut|salue|saluer)\b/u.test(normalized) || /^je (?:m'adresse|parle)\b/u.test(normalized)) return "INITIATE_CONVERSATION";
  if (/\b(je lui dis|je dis|je reponds|je réponds)\b/u.test(normalized)) return "MAKE_STATEMENT";
  return "OTHER";
}

function localCompanionDirective(rawInput: string): NonNullable<AiStructuredSemanticIntentV1["companionDirective"]> | null {
  const normalized = normalize(rawInput);
  const presenceIntent = /\b(reste ici|attends ici|separe)\b/u.test(normalized)
    ? "SEPARATE" as const
    : /\b(reviens avec|rejoins[- ]moi|retrouve[- ]moi)\b/u.test(normalized)
      ? "REJOIN" as const
      : /\b(quitte le groupe|pars sans nous|prends conge)\b/u.test(normalized)
        ? "LEAVE" as const
        : "UNCHANGED" as const;
  const category = /\b(danger|affronte|va seul|risque)\b/u.test(normalized)
    ? "PERSONAL_RISK" as const
    : /\b(eclaire|reconnais|va voir|observe en avant)\b/u.test(normalized)
      ? "SCOUT" as const
      : /\b(aide|assiste)\b/u.test(normalized)
        ? "ASSIST" as const
        : /\b(garde (?:ici|la|le|les|ce)|protege|veille sur)\b/u.test(normalized)
          ? "GUARD" as const
          : /\b(parle (?:a|au|aux)|negocie avec|convaincs)\b/u.test(normalized)
            ? "SOCIAL" as const
            : "FOLLOW" as const;
  const companionRequest = presenceIntent !== "UNCHANGED"
    || category !== "FOLLOW"
    || /\b(rejoins|rejoindre|accompagne|avec moi|mon groupe)\b/u.test(normalized);
  return companionRequest ? {
    schemaVersion: 1,
    category,
    requestSummary: rawInput.trim(),
    presenceIntent
  } : null;
}

function stabilizeCanonicalDialogueAct(intentValue: AiStructuredPlayerIntentV1, rawInput: string): AiStructuredPlayerIntentV1 {
  const dialogueAct = intentValue.semanticIntent.dialogueAct;
  if (intentValue.semanticIntent.kind !== "address_visible_actor" || dialogueAct == null) return intentValue;
  const companionDirective = localCompanionDirective(rawInput);
  return {
    ...intentValue,
    semanticIntent: {
      ...intentValue.semanticIntent,
      dialogueAct: {
        ...dialogueAct,
        act: localDialogueAct(rawInput)
      },
      ...(companionDirective === null ? {} : { companionDirective })
    }
  };
}

function stabilizeCanonicalRuntimeSuggestion(intentValue: AiStructuredPlayerIntentV1): AiStructuredPlayerIntentV1 {
  const target = intentValue.referentResolution?.resolvedTarget ?? intentValue.semanticIntent.target ?? intentValue.target ?? null;
  if (intentValue.semanticIntent.kind !== "nonverbal_signal" || target?.kind !== "npc") return intentValue;
  return {
    ...intentValue,
    runtimeHandling: {
      ...intentValue.runtimeHandling,
      status: "SUPPORTED_BY_CURRENT_RUNTIME",
      reason: "Registre local: positionnement non verbal vers un PNJ visible traité comme action de scène bornée.",
      requiredDomain: "scene_resolution",
      canonicalActionHint: "act",
      noCommit: false,
      noGameTime: true
    }
  };
}

function stabilizeLocalPerceptionIntent(
  intentValue: AiStructuredPlayerIntentV1,
  rawInput: string
): AiStructuredPlayerIntentV1 {
  const informationKind = localPerceptionInformationKind(rawInput);
  if (
    intentValue.semanticIntent.kind !== "observe_environment"
    || intentValue.semanticIntent.perception === null
    || informationKind === null
  ) return intentValue;
  return {
    ...intentValue,
    semanticIntent: {
      ...intentValue.semanticIntent,
      perception: {
        ...intentValue.semanticIntent.perception,
        informationKind
      }
    }
  };
}

function formatProposedIntentRuntime(intentValue: AiStructuredPlayerIntentV1): string {
  const target = intentValue.referentResolution?.resolvedTarget ?? intentValue.semanticIntent.target ?? intentValue.target ?? null;
  return [
    `semanticKind=${intentValue.semanticIntent.kind}`,
    `targetKind=${target?.kind ?? "none"}`,
    `targetRef=${target?.ref ?? "none"}`,
    `runtimeStatus=${intentValue.runtimeHandling.status}`,
    `requiredDomain=${intentValue.runtimeHandling.requiredDomain ?? "none"}`,
    `canonicalActionHint=${intentValue.runtimeHandling.canonicalActionHint ?? "none"}`,
    `noCommit=${String(intentValue.runtimeHandling.noCommit)}`,
    `noGameTime=${String(intentValue.runtimeHandling.noGameTime)}`
  ].join(", ");
}

function canonicalizeVisibleTargetRefs(intentValue: AiStructuredPlayerIntentV1, registry: SceneReferentRegistryV1): AiStructuredPlayerIntentV1 {
  const target = canonicalizeVisibleTargetRef(intentValue.target, registry);
  const resolvedTarget = canonicalizeVisibleTargetRef(intentValue.referentResolution?.resolvedTarget ?? null, registry);
  const semanticTarget = canonicalizeVisibleTargetRef(intentValue.semanticIntent.target ?? null, registry);
  return {
    ...intentValue,
    target,
    referentResolution: intentValue.referentResolution == null
      ? null
      : {
        ...intentValue.referentResolution,
        resolvedTarget
      },
    semanticIntent: {
      ...intentValue.semanticIntent,
      target: semanticTarget
    }
  };
}

function canonicalizeVisibleTargetRef<T extends AiStructuredPlayerIntentV1["target"]>(target: T, registry: SceneReferentRegistryV1): T {
  if (target === null || target.ref === null) return target;
  const referent = findSceneReferentByRefV1(registry, target.ref);
  return referent === null ? target : { ...target, kind: referent.kind, ref: referent.canonicalRef, label: referent.displayName } as T;
}

function findTarget(rawInput: string, localReferentHints: LocalReferentHintV1[] = [], action: string | null = null, registry: SceneReferentRegistryV1 = REFERENCE_SCENE_REFERENT_REGISTRY_V1): AiStructuredPlayerIntentV1["target"] {
  const normalized = normalize(rawInput);
  const capability = action === "ask" ? "speech" : action === "open" || action === "force" ? "manipulate" : undefined;
  const movement = /\b(je vais|je me dirige|je retourne|je reviens|je rentre|j avance|j'avance|j entre|j'entre|je franchis)\b/u.test(normalized);
  const publicMatch = resolveSceneReferentTextV1(registry, rawInput, capability);
  const explicit = movement && publicMatch.status === "NOT_FOUND"
    ? resolveSceneReferentDescriptionV1(registry, rawInput)
    : publicMatch;
  if (explicit.status === "RESOLVED") return toNarrativeIntentTargetV1(explicit.referent);
  if (/\b(moi|me)\b/u.test(normalized) && explicit.status === "NOT_FOUND") {
    return { kind: "self", ref: "player-character:prototype", label: "personnage joueur" };
  }
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
  return findSceneReferentByRefV1(REFERENCE_SCENE_REFERENT_REGISTRY_V1, ref) !== null;
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

function normalizeLocalReferentHints(value: unknown, registry: SceneReferentRegistryV1 = REFERENCE_SCENE_REFERENT_REGISTRY_V1): LocalReferentHintV1[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is LocalReferentHintV1 => {
    if (entry === null || typeof entry !== "object") return false;
    const candidate = entry as Partial<LocalReferentHintV1>;
    return candidate.schemaVersion === 1 &&
      candidate.sceneId === registry.sceneId &&
      candidate.sceneVersion === registry.sceneVersion &&
      candidate.target !== null &&
      typeof candidate.target === "object" &&
      typeof candidate.sourceOperationId === "string" &&
      typeof candidate.sourceText === "string" &&
      ["low", "medium", "high"].includes(candidate.confidence ?? "") &&
      findSceneReferentByRefV1(registry, candidate.target.ref ?? "") !== null;
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
  if (/\b(regarde|observe|cherche|fouille|inspecte|examine)\b/u.test(normalized)) return "observe";
  return "act";
}

function isLocalTravelText(rawInput: string): boolean {
  const normalized = normalize(rawInput);
  return /\b(?:je|nous|on)\s+(?:pars|partons|part|reprends|reprenons|reprend|poursuis|poursuivons|poursuit|vais|allons|va)\b[^.!?]*\b(?:vers|jusqu(?:'| )a|jusqu(?:'| )au|jusqu(?:'| )aux)\b/u.test(normalized);
}

function localTravelDestinationTarget(rawInput: string): AiStructuredPlayerIntentV1["target"] {
  const match = rawInput.trim().match(/\b(?:vers|jusqu['â€™ ]?(?:à|a|au|aux))\s+(.+?)[.!?]*$/iu);
  const label = match?.[1]?.trim().replace(/[.!?]+$/u, "") ?? "";
  return label.length === 0 ? null : { kind: "place", ref: null, label };
}

function localPerceptionDepth(rawInput: string): "GLANCE" | "FOCUSED" | "SEARCH" {
  const normalized = normalize(rawInput);
  if (/\b(cherche|fouille|minutieusement|en detail|autre entree|autre passage)\b/u.test(normalized)) {
    return "SEARCH";
  }
  if (/\b(inspecte|examine|attentivement|de pres)\b/u.test(normalized)) return "FOCUSED";
  return "GLANCE";
}

function localPerceptionInformationKind(rawInput: string):
"PRESENCE" | "VISIBLE_TRAIT" | null {
  const normalized = normalize(rawInput);
  if (/\b(personne|personnes|gens|quelqu un|silhouette|foule|present|presents|presence)\b/u.test(normalized)) {
    return "PRESENCE";
  }
  if (/\b(apparence|allure|aspect|etat visible|signe visible|detail visible)\b/u.test(normalized)) {
    return "VISIBLE_TRAIT";
  }
  return null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/gu, "'");
}

function isApproachOnlyText(value: string): boolean {
  const normalized = normalize(value);
  const hasApproach = /\b(je m'approche|je m approche|je m'avance|je m avance|je vais vers|je me dirige vers)\b/u.test(normalized);
  const hasSpeech = /\b(je lui demande|je demande a|je demande au|je demande aux|je lui dis|je dis a|je dis au|je parle a|je parle au|je questionne|j'interroge|j interroge|parler|discuter|questionner|interroger|demander)\b/u.test(normalized);
  return hasApproach && !hasSpeech;
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
