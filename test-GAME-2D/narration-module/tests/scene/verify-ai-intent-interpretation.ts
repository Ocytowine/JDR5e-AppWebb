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
  "Je force la serrure.",
  "Je m'avance vers l'arrière-salle."
];

const metaQuestions = [
  "Comment fonctionne cette scène côté règles ?",
  "Pause, quel jet faudrait-il normalement ?",
  "Est-ce que l'interface sauvegarde automatiquement ?"
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

  for (const rawInput of metaQuestions) {
    const result = await interpret(rawInput, config);
    assert.equal(result.interpretation.intentType, "meta_question", `${rawInput}: méta attendue`);
    assert.equal(result.interpretation.commitment, "none", `${rawInput}: aucun engagement`);
    assert.equal(result.interpretation.expectedTimeEffect, "NO_GAME_TIME", `${rawInput}: aucun temps`);
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

  const controllerResult = await runControllerSpeechCase();
  assert.equal(controllerResult.output.interpretation.intentType, "speech");
  assert.equal(controllerResult.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(controllerResult.output.suspendedIntent, null);
  assert.equal(controllerResult.output.noCommit, false);
  assert.equal(controllerResult.output.displayPacket.displayBlocks.some(block =>
    block.kind === "NPC_SPEECH" && /porte du fond/u.test(block.text)
  ), true, "la parole claire doit produire une réponse PNJ");

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

function hash(value: string): number {
  let output = 0;
  for (const char of value) output = ((output << 5) - output + char.charCodeAt(0)) | 0;
  return output;
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
