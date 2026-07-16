import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock
} from "../../src/core";
import type { ContractAiProviderV1 } from "../../src/ai";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
  NarrativeTurnControllerV1,
  createDefaultAiIntentInterpreterConfigV1,
  interpretNarrativeInputWithAiV1,
  type AiIntentInterpreterConfigV1
} from "../../src/application";

class FixedClock implements RepositoryClock {
  constructor(private readonly instant = new Date("2026-07-08T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.instant);
  }
}

const speechInputs = [
  "Je demande au garde ce qu’il a vu.",
  "Je lui demande ce qu’il a vu.",
  "Je m’approche du garde et je lui demande ce qu’il a vu.",
  "Je vais vers le garde pour lui demander ce qu’il a vu.",
  "Je questionne le garde sur ce qu’il a vu.",
  "Je demande au garde s’il a remarqué quelque chose.",
  "Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange.",
  "j'aimerais parler à un garde"
];

const socialPossibilities = [
  "Est-ce que je peux parler au garde ?",
  "Puis-je interroger le garde ?",
  "Ai-je le droit de poser une question au garde ?",
  "Ce serait possible de discuter avec lui ?"
];

const riskyPossibilities = [
  "Est-ce que je peux voler la bourse du garde ?",
  "Puis-je ouvrir la porte sans attirer l'attention ?",
  "Est-ce possible d'entrer dans l'arrière-salle discrètement ?"
];

const explicitActions = [
  "J'ouvre la porte.",
  "Je tente d'ouvrir la porte.",
  "Je m'avance vers l'arrière-salle."
];

const metaQuestions = [
  "Comment fonctionne cette scène côté règles ?",
  "Pause, quel jet faudrait-il normalement ?",
  "Est-ce que l'interface sauvegarde automatiquement ?"
];

const contextQuestions = [
  "Peux-tu me décrire l'auberge ?",
  "Tu peux me dire où je me situe ?",
  "Pourrais-tu me rappeler ce que je vois ?"
];

const ambiguousInputs = [
  "Lui voler quelque chose ?",
  "Et si j'entrais ?",
  "Le garde ?",
  "Je pourrais peut-être..."
];

async function main(): Promise<void> {
  const config = createDefaultAiIntentInterpreterConfigV1();

  for (const rawInput of speechInputs) {
    const result = await interpret(rawInput, config);
    assert.equal(result.usedAiInterpretation, true, `${rawInput}: IA structurée attendue`);
    assert.equal(result.interpretation.intentType, "speech", `${rawInput}: speech attendu`);
    assert.equal(result.interpretation.commitment, "committed", `${rawInput}: engagement attendu`);
    assert.equal(result.interpretation.requiresClarification, false, `${rawInput}: pas de clarification`);
    assert.match(result.interpretation.coreMeaning, /garde/u, `${rawInput}: cible garde conservée`);
  }

  for (const rawInput of socialPossibilities) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "possibility_query", `${rawInput}: possibilité sociale`);
    assert.equal(result.interpretation.commitment, "hypothetical", `${rawInput}: hypothétique`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
    assert.equal(result.interpretation.requiresClarification, false, `${rawInput}: pas de parole exécutée`);
  }

  for (const rawInput of riskyPossibilities) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "possibility_query", `${rawInput}: possibilité risquée`);
    assert.equal(result.interpretation.commitment, "hypothetical", `${rawInput}: pas de commit`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
  }

  for (const rawInput of explicitActions) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "action", `${rawInput}: action attendue`);
    assert.equal(result.interpretation.commitment, "committed", `${rawInput}: action engagée`);
  }

  const implicitDoorOpening = await interpret("Je mets la main sur la poignée et pivote le mécanisme.", config);
  assert.equal(implicitDoorOpening.usedAiInterpretation, true, "manipulation implicite: IA structurée attendue");
  assert.equal(implicitDoorOpening.usedFallback, false, "manipulation implicite: aucun fallback");
  assert.equal(implicitDoorOpening.interpretation.intentType, "action", "manipulation implicite: action attendue");
  assert.equal(implicitDoorOpening.interpretation.action, "open", "manipulation implicite: ouverture canonique attendue");
  assert.equal(implicitDoorOpening.interpretation.target?.ref, "poi:back-room-door", "manipulation implicite: porte visible attendue");
  assert.equal(implicitDoorOpening.acceptedOutput?.payload.intents[0]?.semanticIntent.kind, "manipulate_visible_object");
  assert.equal(implicitDoorOpening.acceptedOutput?.payload.intents[0]?.runtimeHandling.status, "SUPPORTED_BY_CURRENT_RUNTIME");

  const forceUnknownLock = await interpret("Je force la serrure.", config);
  assert.equal(forceUnknownLock.interpretation.intentType, "unclear_commitment", "serrure non visible: clarification attendue");
  assert.equal(forceUnknownLock.interpretation.requiresClarification, true, "serrure non visible: pas de resolution directe");

  for (const rawInput of metaQuestions) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "meta_question", `${rawInput}: méta attendue`);
    assert.equal(result.interpretation.commitment, "none", `${rawInput}: aucun engagement`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
  }

  for (const rawInput of contextQuestions) {
    const result = await interpret(rawInput, config);
    assert.equal(result.usedAiInterpretation, true, `${rawInput}: IA structurée attendue`);
    assert.equal(result.interpretation.intentType, "meta_question", `${rawInput}: question de contexte attendue`);
    assert.equal(result.interpretation.commitment, "none", `${rawInput}: aucun engagement`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
    assert.equal(result.interpretation.requiresClarification, false, `${rawInput}: pas de clarification`);
  }

  for (const rawInput of ambiguousInputs) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "unclear_commitment", `${rawInput}: ambiguïté attendue`);
    assert.equal(result.interpretation.requiresClarification, true, `${rawInput}: clarification attendue`);
  }

  const invalidConfig = invalidCommittedPossibilityConfig();
  const invalid = await interpret("Est-ce que je peux voler la bourse du garde ?", invalidConfig);
  assert.equal(invalid.usedAiInterpretation, false, "sortie IA invalide rejetée");
  assert.equal(invalid.usedFallback, false, "aucun fallback narratif sur sortie invalide");
  assert.equal(invalid.interpretation.intentType, "meta_question", "diagnostic technique attendu");
  assert.equal(invalid.interpretationFailure?.category, "AI_OUTPUT_INVALID");

  const invalidSocialSpeech = await interpret("j'aimerais parler a un garde", invalidUnusableConfig());
  assert.equal(invalidSocialSpeech.usedAiInterpretation, false, "sortie IA vide rejetee");
  assert.equal(invalidSocialSpeech.usedFallback, false, "aucun fallback narratif sur sortie vide");
  assert.equal(invalidSocialSpeech.interpretation.intentType, "meta_question", "diagnostic technique attendu");
  assert.equal(invalidSocialSpeech.interpretation.commitment, "none", "aucun engagement sur diagnostic");
  assert.equal(invalidSocialSpeech.interpretationFailure?.category, "AI_OUTPUT_INVALID");

  const invalidImplicitPossibility = await interpret("quel temps fait il ?", invalidImplicitPossibilityConfig());
  assert.equal(invalidImplicitPossibility.usedAiInterpretation, false, "possibility_query sans demande explicite rejetee");
  assert.equal(invalidImplicitPossibility.usedFallback, false, "aucun fallback narratif sur sortie invalide");
  assert.equal(invalidImplicitPossibility.interpretation.intentType, "meta_question", "diagnostic technique attendu");
  assert.equal(invalidImplicitPossibility.interpretation.commitment, "none", "aucun engagement attendu");
  assert.equal(invalidImplicitPossibility.interpretationFailure?.category, "AI_OUTPUT_INVALID");

  const controllerResult = await runControllerSpeechCase();
  assert.equal(controllerResult.output.interpretation.intentType, "speech");
  assert.equal(controllerResult.output.mjPlan?.planningBasis.intentId, controllerResult.output.interpretation.intentId, "mj_planner doit planifier depuis l'intention structurée");
  assert.equal(controllerResult.output.mjPlan?.sceneBeats[0]?.kind, "ACTOR_REACTION_EXPECTED", "parole: réaction PNJ attendue au niveau plan");
  assert.equal(controllerResult.output.mjPlan?.commandProposals.every(proposal => proposal.commitAuthority === false), true, "mj_planner sans autorité de commit");
  assert.equal(controllerResult.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(controllerResult.output.suspendedIntent, null);
  assert.equal(controllerResult.output.noCommit, false);
  assert.equal(controllerResult.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /porte du fond/u.test(block.text)
  ), true, "la parole claire doit produire une réponse PNJ");

  const localReferentResult = await runControllerLocalReferentCase();
  assert.equal(localReferentResult.focus.output.interpretation.target?.ref, "poi:back-room-door", "le focus initial doit porter la porte visible");
  assert.equal(localReferentResult.open.output.interpretation.intentType, "action", "l'ellipse doit rester une action");
  assert.equal(localReferentResult.open.output.mjPlan?.sceneBeats[0]?.kind, "LOCAL_ACTION_ATTEMPT", "action locale: beat de tentative attendu");
  assert.equal(localReferentResult.open.output.mjPlan?.forbiddenOutcomes.includes("narrate_unvalidated_success"), true, "planner interdit le succès narré non validé");
  assert.equal(localReferentResult.open.output.interpretation.target?.ref, "poi:back-room-door", "le pronom doit être résolu vers le référent récent");
  assert.equal(localReferentResult.open.output.interpretation.referentResolution?.source, "recent_visible_focus", "la source du référent doit être le focus récent");
  assert.equal(localReferentResult.open.output.resolution.resultKind, "COMMIT_APPLIED", "l'action locale bornée doit être enregistrée");
  assert.equal(localReferentResult.open.output.noCommit, false, "le commit local borné doit être visible côté contrôleur");
  assert.equal(localReferentResult.open.output.resolution.preparedEffects[0]?.effectType, "LOCAL_SCENE_ACTION_RECORDED");
  assert.equal(localReferentResult.open.output.displayPacket.displayBlocks.some(block =>
    /référent visible/u.test(block.text)
  ), true, "le rendu doit expliquer que seul le référent visible est validé");

  const nonCanonicalAction = await interpret("J'ouvre la porte du fond", nonCanonicalActionConfig());
  assert.equal(nonCanonicalAction.usedAiInterpretation, false, "une action IA non canonique doit etre rejetee");
  assert.equal(nonCanonicalAction.usedFallback, false, "une action IA non canonique ne doit pas degrader vers fallback");
  assert.equal(nonCanonicalAction.interpretationFailure?.category, "AI_OUTPUT_INVALID");

  const noContextOpen = await interpret("je l'ouvre", config);
  assert.equal(noContextOpen.interpretation.intentType, "unclear_commitment", "sans contexte, le pronom local doit clarifier");
  assert.equal(noContextOpen.interpretation.requiresClarification, true, "sans referent fiable, clarification obligatoire");

  const incompatibleReferent = await runControllerIncompatibleReferentCase();
  assert.equal(incompatibleReferent.open.output.interpretation.intentType, "unclear_commitment", "ouvrir une personne doit clarifier");
  assert.equal(incompatibleReferent.open.output.resolution.resultKind, "CLARIFICATION_REQUIRED", "referent incompatible: pas de commit");
  assert.equal(incompatibleReferent.open.output.noCommit, true, "referent incompatible: aucun commit");

  const unsupportedRuntime = await runControllerUnsupportedRuntimeCase();
  assert.equal(unsupportedRuntime.output.interpretation.runtimeHandling?.status, "UNSUPPORTED_DOMAIN", "domaine runtime non ouvert attendu");
  assert.equal(unsupportedRuntime.output.mjPlan?.sceneBeats[0]?.kind, "DOMAIN_BLOCKED", "planner doit arrêter le domaine fermé");
  assert.equal(unsupportedRuntime.output.mjPlan?.planningBasis.requiredDomain, "inventory", "planner doit conserver le domaine requis");
  assert.equal(unsupportedRuntime.output.mjPlan?.creationProposals.length, 0, "planner minimal ne crée rien");
  assert.equal(unsupportedRuntime.output.resolution.resultKind, "HANDOFF_REQUIRED", "domaine runtime non ouvert: handoff requis");
  assert.equal(unsupportedRuntime.output.resolution.handoff?.target, "INVENTORY", "domaine inventory attendu depuis runtimeHandling");
  assert.equal(unsupportedRuntime.output.noCommit, true, "domaine non ouvert: aucun commit");
  assert.equal(unsupportedRuntime.output.resolution.preparedEffects[0]?.effectType, "BLOCKED_UNOPENED_DOMAIN");

  const ambiguousReferent = await interpret("je l'ouvre", ambiguousReferentConfig());
  assert.equal(ambiguousReferent.interpretation.intentType, "unclear_commitment", "referent ambigu: clarification attendue");
  assert.equal(ambiguousReferent.interpretation.requiresClarification, true, "referent ambigu: pas de resolution directe");

  console.log("ai-intent-interpretation/1: OK");
}

async function interpret(rawInput: string, config: AiIntentInterpreterConfigV1) {
  return interpretNarrativeInputWithAiV1({
    campaignId: "cmp-ai-intent-test",
    operationId: `op-${Math.abs(hash(rawInput))}`,
    intentId: `intent-${Math.abs(hash(rawInput))}`,
    rawInput,
    config
  });
}

function invalidCommittedPossibilityConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-invalid-possibility",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "Est-ce que je peux voler la bourse du garde ?",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "possibility_query",
              commitment: "committed",
              target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
              action: "steal",
              topic: "voler la bourse du garde",
              coreMeaning: "Le personnage tente de voler la bourse du garde.",
              playerImposedDetails: [],
              openDetails: [],
              forbiddenInterpretations: [],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "NO_GAME_TIME",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "hypothetical_action",
                playerGoal: "Demander si voler la bourse du garde serait possible.",
                target: { kind: "npc", ref: "npc:npc-garde-blesse", label: "garde" },
                commitment: "hypothetical",
                evidenceFromInput: ["Est-ce que je peux", "voler la bourse du garde"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Question hypothétique sans commit.",
                requiredDomain: null,
                canonicalActionHint: "ask_possibility",
                noCommit: true,
                noGameTime: true
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function invalidUnusableConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-invalid-empty",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "",
            intents: []
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function invalidImplicitPossibilityConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-invalid-implicit-possibility",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "quel temps fait il ?",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "possibility_query",
              commitment: "hypothetical",
              target: null,
              action: "ask_possibility",
              topic: "temps actuel",
              coreMeaning: "Demander s'il est possible qu'il fasse beau.",
              playerImposedDetails: [],
              openDetails: [],
              forbiddenInterpretations: [],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "NO_GAME_TIME",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "context_question",
                playerGoal: "Demander le temps actuel.",
                target: null,
                commitment: "none",
                evidenceFromInput: ["quel temps fait il"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Question de contexte sans commit.",
                requiredDomain: null,
                canonicalActionHint: "ask",
                noCommit: true,
                noGameTime: true
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function ambiguousReferentConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-ambiguous-referent",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "je l'ouvre",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
              action: "open",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: true,
                source: "recent_visible_focus",
                resolvedTarget: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
                evidence: ["porte du fond", "autre objet visible possible"],
                ambiguity: "multiple_candidates",
                confidence: "medium"
              },
              topic: "ouvrir le referent local",
              coreMeaning: "Le personnage veut ouvrir un referent local ambigu.",
              playerImposedDetails: ["je l'ouvre"],
              openDetails: [],
              forbiddenInterpretations: ["choisir un referent ambigu sans clarification"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "manipulate_visible_object",
                playerGoal: "Ouvrir un référent local ambigu.",
                target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
                commitment: "committed",
                evidenceFromInput: ["je l'ouvre"],
                forbiddenInterpretations: ["choisir un referent ambigu sans clarification"],
                confidence: "medium"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Action locale possible si le référent est fiable.",
                requiredDomain: "scene_resolution",
                canonicalActionHint: "open",
                noCommit: false,
                noGameTime: false
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function nonCanonicalActionConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-non-canonical-action",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "J'ouvre la porte du fond",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
              action: "ouvrir",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: false,
                source: "current_input",
                resolvedTarget: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
                evidence: ["J'ouvre la porte du fond", "porte du fond"],
                ambiguity: "none",
                confidence: "high"
              },
              topic: "ouvrir la porte du fond",
              coreMeaning: "Le personnage tente d'ouvrir la porte du fond.",
              playerImposedDetails: ["J'ouvre la porte du fond"],
              openDetails: [],
              forbiddenInterpretations: ["reveler l'arriere-salle", "faire avancer le temps"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: [],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "manipulate_visible_object",
                playerGoal: "Ouvrir la porte du fond.",
                target: { kind: "object", ref: "poi:back-room-door", label: "porte du fond" },
                commitment: "committed",
                evidenceFromInput: ["J'ouvre la porte du fond"],
                forbiddenInterpretations: ["reveler l'arriere-salle", "faire avancer le temps"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "SUPPORTED_BY_CURRENT_RUNTIME",
                reason: "Action locale visible.",
                requiredDomain: "scene_resolution",
                canonicalActionHint: "open",
                noCommit: false,
                noGameTime: false
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

function unsupportedInventoryRuntimeConfig(): AiIntentInterpreterConfigV1 {
  const config = createDefaultAiIntentInterpreterConfigV1();
  return {
    ...config,
    provider: {
      async generate(request) {
        return {
          schemaVersion: 1,
          contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V1,
          outputId: "output-runtime-unsupported-inventory",
          callId: request.callId,
          attemptId: request.attemptId,
          packId: request.packId,
          snapshotId: request.snapshotId,
          role: request.role,
          status: "OK",
          payload: {
            rawInputEcho: "Je glisse deux doigts vers la bourse accrochée à sa ceinture.",
            intents: [{
              intentId: "intent:1",
              order: 1,
              intentType: "action",
              commitment: "committed",
              target: { kind: "object", ref: null, label: "bourse du garde" },
              action: "act",
              referentResolution: {
                schemaVersion: 1,
                usedPreviousContext: false,
                source: "current_input",
                resolvedTarget: { kind: "object", ref: null, label: "bourse du garde" },
                evidence: ["bourse accrochée à sa ceinture"],
                ambiguity: "none",
                confidence: "medium"
              },
              topic: "atteindre la bourse du garde",
              coreMeaning: "Le personnage tente d'interagir avec la bourse portée par le garde.",
              playerImposedDetails: ["Je glisse deux doigts vers la bourse accrochée à sa ceinture."],
              openDetails: ["issue de l'action", "réaction du garde"],
              forbiddenInterpretations: ["accorder l'objet", "résoudre le vol", "modifier l'inventaire"],
              requiresClarification: false,
              clarificationQuestion: null,
              riskFlags: ["inventory_mutation"],
              expectedTimeEffect: "DOMAIN_TO_DECIDE",
              confidence: "high",
              semanticIntent: semanticIntent({
                kind: "manipulate_visible_object",
                playerGoal: "Interagir avec la bourse portée par le garde.",
                target: { kind: "object", ref: null, label: "bourse du garde" },
                commitment: "committed",
                evidenceFromInput: ["glisse deux doigts", "bourse accrochée à sa ceinture"],
                forbiddenInterpretations: ["accorder l'objet", "résoudre le vol", "modifier l'inventaire"],
                confidence: "high"
              }),
              runtimeHandling: runtimeHandling({
                status: "UNSUPPORTED_DOMAIN",
                reason: "L'intention implique une possession ou mutation d'inventaire; le runtime d'inventaire n'est pas ouvert.",
                requiredDomain: "inventory",
                canonicalActionHint: "act",
                noCommit: true,
                noGameTime: true
              })
            }]
          },
          diagnostics: [],
          supersedesOutputId: null
        };
      }
    } satisfies ContractAiProviderV1
  };
}

async function runControllerSpeechCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-controller");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06x"
  });
  const submitted = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06x-guard-pronoun",
    rawInput: "Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange."
  });
  if (!submitted.ok) throw new Error(submitted.error.messageKey);
  return submitted.value;
}

async function runControllerLocalReferentCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-referent");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-referent-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06ze"
  });
  const focus = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06ze-focus-door",
    rawInput: "Je me dirige vers la porte du fond"
  });
  if (!focus.ok) throw new Error(focus.error.messageKey);
  const open = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06ze-open-it",
    rawInput: "je l'ouvre"
  });
  if (!open.ok) throw new Error(open.error.messageKey);
  return { focus: focus.value, open: open.value };
}

async function runControllerUnsupportedRuntimeCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-runtime-unsupported");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-runtime-unsupported-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06zg",
    intentInterpreterConfig: unsupportedInventoryRuntimeConfig()
  });
  const submitted = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06zg-runtime-inventory",
    rawInput: "Je glisse deux doigts vers la bourse accrochée à sa ceinture."
  });
  if (!submitted.ok) throw new Error(submitted.error.messageKey);
  return submitted.value;
}

async function runControllerIncompatibleReferentCase() {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-ai-intent-incompatible-referent");
  const clockAggregateId = opaqueId<AggregateId>("agg-ai-intent-incompatible-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "i06ze-neg"
  });
  const focus = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06ze-focus-waitress",
    rawInput: "Je regarde la serveuse"
  });
  if (!focus.ok) throw new Error(focus.error.messageKey);
  const open = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-i06ze-open-waitress",
    rawInput: "je l'ouvre"
  });
  if (!open.ok) throw new Error(open.error.messageKey);
  return { focus: focus.value, open: open.value };
}

function hash(value: string): number {
  let output = 0;
  for (const char of value) output = ((output << 5) - output + char.charCodeAt(0)) | 0;
  return output;
}

function semanticIntent(input: {
  kind: string;
  playerGoal: string;
  target: { kind: string; ref: string | null; label: string | null } | null;
  commitment: string;
  evidenceFromInput: string[];
  uncertainties?: string[];
  forbiddenInterpretations?: string[];
  confidence: string;
}) {
  return {
    schemaVersion: 1,
    kind: input.kind,
    playerGoal: input.playerGoal,
    target: input.target,
    commitment: input.commitment,
    evidenceFromInput: input.evidenceFromInput,
    uncertainties: input.uncertainties ?? [],
    forbiddenInterpretations: input.forbiddenInterpretations ?? [],
    confidence: input.confidence
  };
}

function runtimeHandling(input: {
  status: string;
  reason: string;
  requiredDomain: string | null;
  canonicalActionHint: string | null;
  noCommit: boolean;
  noGameTime: boolean;
}) {
  return {
    schemaVersion: 1,
    status: input.status,
    reason: input.reason,
    requiredDomain: input.requiredDomain,
    canonicalActionHint: input.canonicalActionHint,
    noCommit: input.noCommit,
    noGameTime: input.noGameTime
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
