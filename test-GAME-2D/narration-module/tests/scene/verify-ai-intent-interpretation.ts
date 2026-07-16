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
  assert.equal(invalid.usedFallback, true, "fallback conservateur utilisé");
  assert.equal(invalid.interpretation.intentType, "possibility_query", "fallback ne transforme pas l'hypothèse en action");

  const invalidSocialSpeech = await interpret("j'aimerais parler a un garde", invalidUnusableConfig());
  assert.equal(invalidSocialSpeech.usedAiInterpretation, false, "sortie IA vide rejetee");
  assert.equal(invalidSocialSpeech.usedFallback, true, "fallback conservateur utilise");
  assert.equal(invalidSocialSpeech.interpretation.intentType, "speech", "fallback conserve la demande sociale comme parole");
  assert.equal(invalidSocialSpeech.interpretation.commitment, "committed", "parole engagee attendue");

  const invalidImplicitPossibility = await interpret("quel temps fait il ?", invalidImplicitPossibilityConfig());
  assert.equal(invalidImplicitPossibility.usedAiInterpretation, false, "possibility_query sans demande explicite rejetee");
  assert.equal(invalidImplicitPossibility.usedFallback, true, "fallback conservateur utilise");
  assert.equal(invalidImplicitPossibility.interpretation.intentType, "meta_question", "question de contexte attendue");
  assert.equal(invalidImplicitPossibility.interpretation.commitment, "none", "aucun engagement attendu");

  const controllerResult = await runControllerSpeechCase();
  assert.equal(controllerResult.output.interpretation.intentType, "speech");
  assert.equal(controllerResult.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(controllerResult.output.suspendedIntent, null);
  assert.equal(controllerResult.output.noCommit, false);
  assert.equal(controllerResult.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /porte du fond/u.test(block.text)
  ), true, "la parole claire doit produire une réponse PNJ");

  const localReferentResult = await runControllerLocalReferentCase();
  assert.equal(localReferentResult.focus.output.interpretation.target?.ref, "poi:back-room-door", "le focus initial doit porter la porte visible");
  assert.equal(localReferentResult.open.output.interpretation.intentType, "action", "l'ellipse doit rester une action");
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
  assert.equal(nonCanonicalAction.usedFallback, true, "une action IA non canonique doit degrader vers fallback");

  const noContextOpen = await interpret("je l'ouvre", config);
  assert.equal(noContextOpen.interpretation.intentType, "unclear_commitment", "sans contexte, le pronom local doit clarifier");
  assert.equal(noContextOpen.interpretation.requiresClarification, true, "sans referent fiable, clarification obligatoire");

  const incompatibleReferent = await runControllerIncompatibleReferentCase();
  assert.equal(incompatibleReferent.open.output.interpretation.intentType, "unclear_commitment", "ouvrir une personne doit clarifier");
  assert.equal(incompatibleReferent.open.output.resolution.resultKind, "CLARIFICATION_REQUIRED", "referent incompatible: pas de commit");
  assert.equal(incompatibleReferent.open.output.noCommit, true, "referent incompatible: aucun commit");

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
              confidence: "high"
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
              confidence: "high"
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
              confidence: "high"
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
              confidence: "high"
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

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
