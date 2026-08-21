import assert from "node:assert/strict";
import {
  answerPlayerPublicContextQueryV1,
  buildPlayerPublicContextV1,
  classifyInterpretedPublicContextQuestionV1,
  createDefaultAiIntentInterpreterConfigV1,
  createPrototypeNarrativeTurnControllerV1,
  interpretNarrativeInputWithAiV1,
  loadPlayerPublicContextV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type InterpreterCharacterContextV1,
  type PlayerPublicContextV1
} from "../../src/application";
import {
  coreError,
  type CampaignId,
  type CampaignRepository
} from "../../src/core";

const campaignId = "campaign:j1-public-context" as CampaignId;
const characterContext: InterpreterCharacterContextV1 = {
  schemaVersion: 1,
  contractVersion: "interpreter-character-context/1",
  character: {
    ref: "player-character:aryn",
    label: "Aryn"
  },
  references: [{
    schemaVersion: 1,
    ref: "character-equipped-item:sword-aube",
    kind: "EQUIPPED_ITEM",
    label: "Épée de l'aube",
    aliases: ["épée de l'aube"],
    availability: "REFERENCE_ONLY",
    inventoryState: "EQUIPPED",
    quantity: 1,
    containerRef: null
  }],
  ambiguities: [],
  authority: "INTERPRETATION_ONLY",
  ownerValidationRequired: true,
  deliberatelyExcluded: ["PRIVATE_CHARACTER_SENTINEL"]
};

function publicContext(): PlayerPublicContextV1 {
  const scene = structuredClone(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1);
  scene.playerKnownFacts = ["Le passage du fond est visible."];
  scene.ambientPopulation = [{
    schemaVersion: 1,
    actorId: "npc-voyageuse",
    displayName: "Voyageuse",
    publicRole: "Voyageuse de passage",
    visibleActivity: "elle observe la pluie",
    visibleAppearance: "un manteau sombre détrempé",
    demeanor: "AMBIENT_PRIVATE_DEMEANOR",
    immediateGoal: "AMBIENT_PRIVATE_GOAL",
    currentPressure: "AMBIENT_PRIVATE_PRESSURE",
    speechStyle: ["AMBIENT_PRIVATE_SPEECH_STYLE"],
    conversationalHooks: ["AMBIENT_PRIVATE_HOOK"],
    boundaries: ["AMBIENT_PRIVATE_BOUNDARY"],
    knowledgeRefs: ["AMBIENT_PRIVATE_KNOWLEDGE"],
    keywords: ["voyageuse"],
    version: 1
  }];
  return buildPlayerPublicContextV1({
    activeScene: scene,
    characterContext,
    actorRef: "actor:aryn",
    acquiredKnowledge: [{
      schemaVersion: 1,
      claimRef: "claim:archives-close-at-dusk",
      subjectRef: "location:archives",
      subjectKind: "location",
      subjectLabel: "Archives",
      proposition: "Les Archives ferment au crépuscule.",
      status: "HEARD",
      attributedSpeakerRefs: ["actor:clerc"],
      channelRefs: ["testimony:clerc-hours"],
      assertsObjectiveTruth: false,
      privateSentinel: "ACQUIRED_PRIVATE_SENTINEL"
    } as never],
    testimonyRegistryRevision: 4,
    actorKnowledgeRegistryRevision: 2
  });
}

async function verifyInterpreterFingerprint(context: PlayerPublicContextV1): Promise<void> {
  const baseConfig = createDefaultAiIntentInterpreterConfigV1();
  let capturedTask: unknown = null;
  let capturedFingerprint: string | null = null;
  const config = {
    ...baseConfig,
    provider: {
      async generate(request: Parameters<typeof baseConfig.provider.generate>[0]) {
        capturedTask = request.input.task;
        capturedFingerprint = request.contextFingerprint;
        return baseConfig.provider.generate(request);
      }
    }
  };
  await interpretNarrativeInputWithAiV1({
    campaignId,
    operationId: "operation:j1-public-context",
    intentId: "intent:j1-public-context",
    rawInput: "Où suis-je ?",
    config,
    characterContext,
    playerPublicContext: context,
    playableScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.deepEqual(
    (capturedTask as { playerPublicContext?: unknown }).playerPublicContext,
    context
  );
  const firstFingerprint = capturedFingerprint;
  await interpretNarrativeInputWithAiV1({
    campaignId,
    operationId: "operation:j1-public-context",
    intentId: "intent:j1-public-context",
    rawInput: "Où suis-je ?",
    config,
    characterContext,
    playerPublicContext: {
      ...context,
      location: { ...context.location, label: "Place des Archives" }
    },
    playableScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.notEqual(capturedFingerprint, firstFingerprint);
}

async function verifyControllerAnswers(): Promise<void> {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    interpreterCharacterContextResolver: {
      async resolve() {
        return { ok: true, value: characterContext };
      }
    }
  });
  const present = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "request:j1-who-is-present",
    rawInput: "Qui est présent ?"
  });
  assert.equal(present.ok, true);
  if (!present.ok) throw new Error("present actors query should be answered");
  assert.equal(present.value.output.resolution.noGameTime, true);
  assert.match(
    present.value.output.displayPacket.displayBlocks
      .find(block => block.kind === "GM_NARRATION")?.text ?? "",
    /Tu vois actuellement.*Garde blessé/u
  );
  const known = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "request:j1-what-do-i-know",
    rawInput: "Qu'est-ce que je sais ?"
  });
  assert.equal(known.ok, true);
  if (!known.ok) throw new Error("known facts query should be answered");
  assert.match(
    known.value.output.displayPacket.displayBlocks
      .find(block => block.kind === "GM_NARRATION")?.text ?? "",
    /Voici ce que tu sais/u
  );
}

async function run(): Promise<void> {
  const context = publicContext();
  assert.equal(context.character.actorRef, "actor:aryn");
  assert.equal(context.location.label, "Auberge du Seuil");
  assert.equal(context.presentActors.some(actor => actor.label === "Voyageuse"), true);
  assert.deepEqual(context.visibleEquipmentRefs, ["character-equipped-item:sword-aube"]);
  assert.equal(context.knownFacts.some(fact => fact.status === "HEARD"), true);
  assert.equal(
    context.knownFacts.find(fact => fact.status === "HEARD")
      ?.attributedSpeakerRefs[0],
    "actor:clerc"
  );
  const serialized = JSON.stringify(context);
  for (const forbidden of [
    "PRIVATE_CHARACTER_SENTINEL",
    "AMBIENT_PRIVATE_DEMEANOR",
    "AMBIENT_PRIVATE_GOAL",
    "AMBIENT_PRIVATE_PRESSURE",
    "AMBIENT_PRIVATE_SPEECH_STYLE",
    "AMBIENT_PRIVATE_HOOK",
    "AMBIENT_PRIVATE_BOUNDARY",
    "AMBIENT_PRIVATE_KNOWLEDGE",
    "ACQUIRED_PRIVATE_SENTINEL"
  ]) assert.equal(serialized.includes(forbidden), false, `${forbidden} must stay private`);

  assert.match(
    answerPlayerPublicContextQueryV1({ context, query: "LOCATION" }),
    /Tu es à Auberge du Seuil/u
  );
  assert.match(
    answerPlayerPublicContextQueryV1({ context, query: "PRESENT_ACTORS" }),
    /Garde blessé/u
  );
  assert.match(
    answerPlayerPublicContextQueryV1({ context, query: "KNOWN_FACTS" }),
    /Entendu : Les Archives ferment au crépuscule/u
  );
  assert.equal(
    classifyInterpretedPublicContextQuestionV1({ rawInput: "Qui est présent ?" }),
    "PRESENT_ACTORS"
  );
  assert.equal(
    classifyInterpretedPublicContextQuestionV1({ rawInput: "Qu'est-ce que je sais ?" }),
    "KNOWN_FACTS"
  );
  assert.deepEqual(publicContext(), context, "rebuilding the same sources must be stable");

  const missingRegistryRepository = {
    async getAggregate() {
      return {
        ok: false as const,
        error: coreError("NOT_FOUND", "test.aggregate-not-found", {})
      };
    }
  } as unknown as CampaignRepository;
  const reloaded = await loadPlayerPublicContextV1({
    repository: missingRegistryRepository,
    campaignId,
    activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    characterContext
  });
  assert.equal(reloaded.ok, true);
  if (!reloaded.ok) throw new Error("public context should reload with empty registries");
  assert.equal(reloaded.value.character.actorRef, "actor:aryn");
  assert.deepEqual(
    reloaded.value.knownFacts.map(fact => fact.status),
    REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.playerKnownFacts.map(() => "SCENE_PUBLIC")
  );

  await verifyInterpreterFingerprint(context);
  await verifyControllerAnswers();
  console.log("player-public-context: public sources, privacy, stable answers, reload and fingerprint verified");
}

void run();
