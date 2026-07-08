import assert from "node:assert/strict";
import {
  buildPlayableSceneLocationAnswerV1,
  buildPlayableSceneObservationV1,
  buildPlayableSceneSocialPossibilityAnswerV1,
  buildReferenceSceneBlocksV1,
  findPlayableSceneNpcTargetV1,
  PLAYABLE_SCENE_CONTRACT_VERSION_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  REFERENCE_PLAYABLE_SCENE_ID_V1,
  REFERENCE_SCENE_CONTEXT_V1,
  toPlayableScenePublicContextV1,
  validatePlayableSceneV1,
  WATCHTOWER_DAWN_PLAYABLE_SCENE_V1,
  type NarrativeIntentInterpretationV1,
  type NarrativeResolutionResultV1
} from "../../src/application";

function main(): void {
  for (const scene of [REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, WATCHTOWER_DAWN_PLAYABLE_SCENE_V1]) {
    const validation = validatePlayableSceneV1(scene);
    assert.equal(validation.ok, true, `${scene.sceneId}: scène jouable valide`);
    assert.equal(scene.contractVersion, PLAYABLE_SCENE_CONTRACT_VERSION_V1);
    assert.equal(scene.aiSceneWriterPolicy.mayCreate.length, 0, `${scene.sceneId}: pas de création IA en I-06S`);
    assert.ok(scene.localMemoryPolicy.maxShortTermNpcMemory <= 5, `${scene.sceneId}: mémoire courte bornée`);
  }

  const publicReference = toPlayableScenePublicContextV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1);
  assert.equal(publicReference.sceneId, REFERENCE_PLAYABLE_SCENE_ID_V1);
  assert.equal(publicReference.locationName, REFERENCE_SCENE_CONTEXT_V1.locationName);
  assert.deepEqual(
    publicReference.presentNpc.map(npc => npc.actorId),
    REFERENCE_SCENE_CONTEXT_V1.presentNpc.map(npc => npc.actorId),
    "la scène de référence reste projetable depuis le contrat générique"
  );

  const referenceLocationBlocks = buildReferenceSceneBlocksV1({
    operationId: "op-i06s-location",
    rawInput: "Où sommes-nous exactement ?",
    interpretation: interpretation("meta_question", "Où sommes-nous exactement ?") as NarrativeResolutionResultV1["interpretation"],
    resolution: resolution("op-i06s-location", "NO_COMMIT_RESPONSE"),
    sceneState: undefined
  });
  assert.equal(referenceLocationBlocks.length, 1);
  assert.equal(referenceLocationBlocks[0]?.text, buildPlayableSceneLocationAnswerV1(REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1));

  const watchtowerContext = toPlayableScenePublicContextV1(WATCHTOWER_DAWN_PLAYABLE_SCENE_V1);
  assert.equal(watchtowerContext.locationName, "Tour de guet de Brumeval");
  assert.equal(watchtowerContext.presentNpc[0]?.actorId, "npc-vigie-fatiguee");
  assert.match(buildPlayableSceneLocationAnswerV1(WATCHTOWER_DAWN_PLAYABLE_SCENE_V1), /Tour de guet de Brumeval/u);
  assert.match(buildPlayableSceneObservationV1(WATCHTOWER_DAWN_PLAYABLE_SCENE_V1, "J'observe la route au sud."), /Route basse|route basse/u);
  assert.equal(
    findPlayableSceneNpcTargetV1(WATCHTOWER_DAWN_PLAYABLE_SCENE_V1, "Je parle à la vigie.").actorId,
    "npc-vigie-fatiguee"
  );
  assert.match(
    buildPlayableSceneSocialPossibilityAnswerV1(WATCHTOWER_DAWN_PLAYABLE_SCENE_V1, "Puis-je parler à la vigie ?"),
    /Vigie fatiguée/u
  );

  const invalid = validatePlayableSceneV1({
    ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1,
    aiSceneWriterPolicy: {
      ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1.aiSceneWriterPolicy,
      mayCreate: ["client anonyme"]
    }
  });
  assert.equal(invalid.ok, false, "I-06S refuse encore les créations IA de scène");

  console.log("playable-scene-state/1: OK");
}

function interpretation(
  intentType: NarrativeIntentInterpretationV1["intentType"],
  coreMeaning: string
): NarrativeIntentInterpretationV1 {
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: "intent-i06s",
    intentType,
    commitment: intentType === "meta_question" || intentType === "possibility_query" ? "none" : "committed",
    coreMeaning,
    requiresClarification: false,
    clarificationQuestion: null,
    expectedTimeEffect: intentType === "meta_question" || intentType === "possibility_query" ? "NO_GAME_TIME" : "DOMAIN_TO_DECIDE",
    safetyNotes: []
  };
}

function resolution(
  operationId: string,
  resultKind: NarrativeResolutionResultV1["resultKind"]
): NarrativeResolutionResultV1 {
  return {
    schemaVersion: 1,
    contractVersion: "narrative-resolution/1",
    resolutionId: `${operationId}:resolution:1`,
    operationId,
    resultKind,
    interpretation: interpretation("meta_question", "Où sommes-nous exactement ?") as NarrativeResolutionResultV1["interpretation"],
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: null,
    noGameTime: true,
    safetyNotes: []
  };
}

main();
