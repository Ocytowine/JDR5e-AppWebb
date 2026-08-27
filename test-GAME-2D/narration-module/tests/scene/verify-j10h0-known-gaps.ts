import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock
} from "../../src/core";
import {
  NarrativeTurnControllerV1,
  type InterpreterCharacterContextV1
} from "../../src/application";
import {
  ConversationSemanticProviderH0,
  createConversationSemanticConfigH0,
  dialogueFixtureH0
} from "../fixtures/conversation-semantic-fixtures-h0";

class FixedClock implements RepositoryClock {
  now(): Date {
    return new Date("2026-08-26T08:00:00.000Z");
  }
}

async function main(): Promise<void> {
  verifyPlannerLimitsFollowConfiguredRoute();
  await verifyReloadedV8DialogueFocusGapIsReproduced();
  console.log("j10-h0-known-gaps/1: OK (0 écart produit historique restant après H4, sans appel OpenAI)");
}

function verifyPlannerLimitsFollowConfiguredRoute(): void {
  const planner = readFileSync(resolve("narration-module/src/application/mjPlanning.ts"), "utf8");
  const productConfig = readFileSync(resolve("src/narration-ui/openAiNarrativeRuntimeConfig.ts"), "utf8");
  assert.match(planner, /outputTokenBudget: input\.config\.route\.outputTokenLimit,\s*timeoutMs: input\.config\.route\.timeoutMs/u, "la requête planner doit suivre la politique de sa route");
  assert.doesNotMatch(planner, /outputTokenBudget: 1_000,\s*timeoutMs: 1_000/u, "la limite fautive d'une seconde ne doit plus être codée dans la requête");
  assert.match(productConfig, /routeId: "campaign-ui-openai-mj-planner"[\s\S]*?timeoutMs: 30_000/u, "la route produit annonce bien trente secondes");
}

async function verifyReloadedV8DialogueFocusGapIsReproduced(): Promise<void> {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-j10-h0-focus-gap");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("agg-j10-h0-focus-gap-clock"),
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

  const firstInput = "Je salue le garde.";
  const followUpInput = "Je lui demande si tout va bien.";
  const characterContext = {
    schemaVersion: 1,
    contractVersion: "interpreter-character-context/2",
    character: { ref: "player-character:h0", label: "Personnage H0" },
    references: [],
    ambiguities: [],
    embodiedProfile: {
      schemaVersion: 1,
      identity: {
        characterRef: "player-character:h0",
        label: "Personnage H0",
        raceRef: null,
        backgroundRef: null
      },
      selfNarrative: {
        biography: null,
        personality: null,
        objectives: null,
        flaws: null,
        physicalDescription: null
      },
      classification: "PLAYER_AUTHORED_PUBLIC_SELF_CONTEXT"
    },
    authority: "INTERPRETATION_ONLY",
    ownerValidationRequired: true,
    deliberatelyExcluded: []
  } as unknown as InterpreterCharacterContextV1;
  const interpreterCharacterContextResolver = {
    async resolve() {
      return { ok: true as const, value: characterContext };
    }
  };
  const intentInterpreterConfig = createConversationSemanticConfigH0([
    dialogueFixtureH0({
      fixtureId: "focus-open",
      rawInput: firstInput,
      meaning: "Le personnage salue le garde blessé.",
      targetRef: "npc:npc-garde-blesse",
      targetSurface: "le garde",
      dialogueAct: "INITIATE_CONVERSATION"
    }),
    dialogueFixtureH0({
      fixtureId: "focus-follow-up",
      rawInput: followUpInput,
      meaning: "Le personnage demande au garde blessé si tout va bien.",
      targetRef: "npc:npc-garde-blesse",
      targetSurface: "lui",
      dialogueAct: "ASK_QUESTION"
    })
  ]);

  const firstController = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "j10-h0-first",
    intentInterpreterConfig,
    interpreterCharacterContextResolver
  });
  const first = await firstController.submit({
    schemaVersion: 1,
    clientRequestId: "j10-h0-focus-open",
    rawInput: firstInput
  });
  if (!first.ok) throw new Error(first.error.messageKey);
  assert.equal(first.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(first.value.output.interpretation.semanticIntent.kind, "unclear_intent", "la projection canonique historique contredit encore le propriétaire V8 exécuté");
  assert.equal(first.value.output.resolution.characterExpression?.rawPlayerText, firstInput, "H3 rattache la saisie originale au bloc personnage après la décision du propriétaire");
  assert.equal(first.value.output.resolution.preparedEffects[0]?.targetRef, "npc:npc-garde-blesse", "H3 conserve la cible validée dans l'effet de parole");
  assert.equal(first.value.output.resolution.interpretation.semanticIntent.dialogueAct?.act, "INITIATE_CONVERSATION", "H3 expose l'acte sémantique effectivement transmis au propriétaire");

  const restoredController = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "j10-h0-restored",
    intentInterpreterConfig,
    interpreterCharacterContextResolver
  });
  const restored = await restoredController.restoreRenderedThread();
  if (!restored.ok) throw new Error(restored.error.messageKey);
  const followUp = await restoredController.submit({
    schemaVersion: 1,
    clientRequestId: "j10-h0-focus-follow-up",
    rawInput: followUpInput
  });
  if (!followUp.ok) throw new Error(followUp.error.messageKey);

  const provider = intentInterpreterConfig.provider as ConversationSemanticProviderH0;
  const request = provider.requests.find(candidate =>
    (candidate.input.task as { rawInput?: unknown }).rawInput === followUpInput
  );
  assert.ok(request, "la requête V8 de reprise doit être capturée");
  const embodiedContext = (request.input.task as {
    embodiedContext?: {
      activeInterlocutor?: { actorRef?: string } | null;
      activeInteraction?: { contractVersion?: string; mode?: string; status?: string } | null;
      recentFocus?: Array<{ actorRef?: string; targetRef?: string }>;
    };
  }).embodiedContext;
  assert.equal(embodiedContext?.activeInterlocutor?.actorRef, "npc:npc-garde-blesse", "H2 restaure l'interlocuteur explicite après reload");
  assert.deepEqual(
    embodiedContext?.activeInteraction,
    {
      schemaVersion: 1,
      contractVersion: "local-interaction-focus/1",
      sceneId: "reference-inn-rain-001",
      sceneVersion: 1,
      targetRef: "npc:npc-garde-blesse",
      targetDisplayName: "Garde blessé",
      mode: "DIALOGUE",
      publicSummary: "Le personnage salue le garde blessé.",
      openedByOperationId: "j10-h0-first-op-j10-h0-focus-open",
      lastConfirmedOperationId: "j10-h0-first-op-j10-h0-focus-open",
      status: "ACTIVE",
      closureReason: null
    },
    "H2 projette le focus public versionné dans le contexte V8"
  );
  assert.equal(
    embodiedContext?.recentFocus?.some(focus =>
      focus.actorRef === "npc:npc-garde-blesse" || focus.targetRef === "npc:npc-garde-blesse"
    ),
    true,
    "le référent récent est bien restauré : le défaut porte sur l'état conversationnel, pas sur toute persistance"
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
