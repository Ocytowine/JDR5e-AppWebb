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
  buildCompatibleSemanticIntentV1,
  buildSceneReferentRegistryV1,
  evaluateNarrativeRuntimeDecisionV1,
  findSceneReferentByRefV1,
  resolveSceneReferentTextV1,
  toSceneReferentRoleViewV1,
  validateSceneReferentRegistryV1,
  type PlayableSceneStateV1,
  type NarrativeIntentInterpretationV1,
  type NarrativeResolutionResultV1
} from "../../src/application";

const MARKET_NIGHT_PLAYABLE_SCENE_V1: PlayableSceneStateV1 = {
  ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1,
  sceneId: "market-night-001",
  locationName: "Marché nocturne",
  perceptibleSituation: ["Des lanternes éclairent les étals fermés."],
  visibleElements: [],
  presentNpc: [{
    ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1.presentNpc[0]!,
    actorId: "npc-cartographe-ambre",
    displayName: "Cartographe à l'écharpe ambre",
    publicRole: "Guide du marché",
    visibleState: "écharpe ambre, cartes roulées sous le bras",
    keywords: ["cartographe", "écharpe ambre", "guide"]
  }],
  pointsOfInterest: [{
    ...WATCHTOWER_DAWN_PLAYABLE_SCENE_V1.pointsOfInterest[0]!,
    pointId: "stall-blue-lantern",
    label: "Étal à la lanterne bleue",
    visibleDescription: "Un étal fermé reste marqué par une lanterne bleue.",
    keywords: ["étal", "lanterne bleue"]
  }]
};

function main(): void {
  for (const scene of [REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, WATCHTOWER_DAWN_PLAYABLE_SCENE_V1, MARKET_NIGHT_PLAYABLE_SCENE_V1]) {
    const validation = validatePlayableSceneV1(scene);
    assert.equal(validation.ok, true, `${scene.sceneId}: scène jouable valide`);
    assert.equal(scene.contractVersion, PLAYABLE_SCENE_CONTRACT_VERSION_V1);
    assert.equal(scene.aiSceneWriterPolicy.mayCreate.length, 0, `${scene.sceneId}: pas de création IA en I-06S`);
    assert.ok(scene.localMemoryPolicy.maxShortTermNpcMemory <= 5, `${scene.sceneId}: mémoire courte bornée`);
  }

  const registries = [REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, WATCHTOWER_DAWN_PLAYABLE_SCENE_V1, MARKET_NIGHT_PLAYABLE_SCENE_V1]
    .map(buildSceneReferentRegistryV1);
  for (const registry of registries) assert.equal(validateSceneReferentRegistryV1(registry).ok, true, `${registry.sceneId}: registre valide`);
  const marketRegistry = registries[2]!;
  assert.equal(resolveSceneReferentTextV1(marketRegistry, "Je salue le cartographe", "speech").status, "RESOLVED");
  assert.equal(findSceneReferentByRefV1(marketRegistry, "npc-cartographe-ambre")?.canonicalRef, "npc:npc-cartographe-ambre", "canonicalisation sans table d'identifiants");
  assert.equal(toSceneReferentRoleViewV1(marketRegistry, "npc_performer").referents.every(entry => entry.kind === "npc"), true, "vue performer limitée aux PNJ");
  const ambiguousScene: PlayableSceneStateV1 = {
    ...MARKET_NIGHT_PLAYABLE_SCENE_V1,
    sceneId: "market-night-ambiguous",
    presentNpc: [
      MARKET_NIGHT_PLAYABLE_SCENE_V1.presentNpc[0]!,
      { ...MARKET_NIGHT_PLAYABLE_SCENE_V1.presentNpc[0]!, actorId: "npc-guide-azur", displayName: "Guide à l'écharpe azur", keywords: ["guide"] }
    ]
  };
  assert.equal(resolveSceneReferentTextV1(buildSceneReferentRegistryV1(ambiguousScene), "Je parle au guide", "speech").status, "AMBIGUOUS", "alias public ambigu: clarification requise");

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
    findPlayableSceneNpcTargetV1(WATCHTOWER_DAWN_PLAYABLE_SCENE_V1, "Je parle à la vigie.")?.actorId,
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
    semanticIntent: buildCompatibleSemanticIntentV1({
      intentType,
      commitment: intentType === "meta_question" || intentType === "possibility_query" ? "none" : "committed",
      coreMeaning,
      requiresClarification: false
    }),
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({
      semanticIntent: buildCompatibleSemanticIntentV1({ intentType, commitment: intentType === "meta_question" || intentType === "possibility_query" ? "none" : "committed", coreMeaning, requiresClarification: false }),
      runtimeSuggestion: null,
      requiresClarification: false
    }),
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
    domainCommand: null,
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: null,
    noGameTime: true,
    safetyNotes: []
  };
}

main();
