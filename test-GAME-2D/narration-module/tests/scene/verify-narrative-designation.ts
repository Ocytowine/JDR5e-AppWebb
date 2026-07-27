import assert from "node:assert/strict";
import {
  buildAmbientScenePresenceV1,
  buildKnownNarrativeDesignationV1,
  buildNarrativeDesignationV1,
  buildSceneReferentRegistryV1,
  narrativeDesignationOfV1,
  resolveNpcSpeakerV1,
  revealNarrativeNameV1,
  validateNarrativeDesignationV1,
  type PlayableSceneStateV1
} from "../../src/application";

function main(): void {
  const unknown = buildNarrativeDesignationV1({
    subjectRef: "npc:forme-1",
    subjectKind: "ACTOR",
    knowledgeStatus: "UNKNOWN",
    playerFacingLabel: "Silhouette encapuchonnée",
    firstMention: "une silhouette encapuchonnée",
    subsequentMention: "la silhouette encapuchonnée",
    sourceRefs: ["scene:test:visible-sign"]
  });
  assert.equal(unknown.canonicalName, null);
  assert.equal(validateNarrativeDesignationV1(unknown).ok, true);

  const designated = buildNarrativeDesignationV1({
    subjectRef: "npc:garde-1",
    subjectKind: "ACTOR",
    knowledgeStatus: "DESIGNATION",
    publicRole: "garde",
    playerFacingLabel: "Garde au manteau roux",
    firstMention: "une garde au manteau roux",
    subsequentMention: "la garde au manteau roux",
    sourceRefs: ["scene:test:visible-sign"]
  });
  assert.equal(designated.canonicalName, null, "une profession reconnue ne révèle aucun nom propre");

  const revealed = revealNarrativeNameV1({
    current: designated,
    canonicalName: "Ilyne Varec",
    sourceRef: "social:name-reveal:ilyne"
  });
  assert.equal(revealed.knowledgeStatus, "KNOWN");
  assert.equal(revealed.playerFacingLabel, "Ilyne Varec");
  assert.equal(revealed.canonicalName, "Ilyne Varec");
  assert.ok(revealed.sourceRefs.includes("social:name-reveal:ilyne"));

  const knownPlace = buildKnownNarrativeDesignationV1({
    subjectRef: "place:archives",
    subjectKind: "PLACE",
    canonicalName: "Archives de Lysenthe",
    sourceRefs: ["lore-entity:archives_de_lysenthe"]
  });
  assert.equal(knownPlace.knowledgeStatus, "KNOWN");

  const ambient = buildAmbientScenePresenceV1({
    sceneId: "scene:test",
    role: "garde",
    index: 0,
    currentPressure: "surveiller sans interrompre le travail",
    contextLabel: "Archives de Lysenthe",
    knowledgeRefs: ["lore-fragment:archives:public"]
  });
  const ambientDesignation = narrativeDesignationOfV1(ambient);
  assert.equal(ambientDesignation?.knowledgeStatus, "DESIGNATION");
  assert.equal(ambientDesignation?.canonicalName, null);
  assert.notEqual(ambient.displayName.toLocaleLowerCase("fr-FR"), "garde");
  assert.match(ambientDesignation?.subsequentMention ?? "", /garde.*gestes soigneux/iu);

  const scene = minimalScene(ambient, knownPlace);
  const referent = buildSceneReferentRegistryV1(scene).referents.find(entry => entry.canonicalRef === `npc:${ambient.actorId}`);
  assert.equal(referent?.displayName, ambientDesignation?.playerFacingLabel);
  assert.ok(referent?.publicAliases.includes(ambientDesignation?.subsequentMention ?? ""));
  assert.equal(referent?.publicAliases.includes("Ilyne Varec"), false, "un nom non révélé ne devient jamais un alias public");

  const speaker = resolveNpcSpeakerV1(ambient.actorId, scene);
  assert.equal(speaker.displayName, ambientDesignation?.playerFacingLabel);
  assert.equal(speaker.knownNameStatus, "DESIGNATION");

  console.log("narrative-designation/1: OK");
}

function minimalScene(
  ambient: ReturnType<typeof buildAmbientScenePresenceV1>,
  placeDesignation: ReturnType<typeof buildKnownNarrativeDesignationV1>
): PlayableSceneStateV1 {
  return {
    schemaVersion: 1,
    contractVersion: "playable-scene-state/1",
    sceneId: "scene:test",
    locationName: "Archives de Lysenthe",
    locationDesignation: placeDesignation,
    perceptibleSituation: ["Une salle de consultation animée."],
    visibleElements: [],
    presentNpc: [],
    ambientPopulation: [ambient],
    pointsOfInterest: [],
    perceptionClues: [],
    currentTension: "Le travail se poursuit.",
    playerKnownFacts: [],
    localMemoryPolicy: { schemaVersion: 1, maxShortTermNpcMemory: 5, version: 1 },
    aiSceneWriterPolicy: {
      schemaVersion: 1,
      mayCreate: [],
      mayReference: [],
      mustNotCreate: [],
      noveltyConstraints: [],
      version: 1
    },
    version: 1
  };
}

main();
