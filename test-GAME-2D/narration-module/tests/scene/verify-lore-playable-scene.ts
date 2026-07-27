import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPlayableSceneFromLoreLocationV1,
  buildSceneTransitionTopologyFromLoreLocationV1,
  buildPlayableSceneLocationAnswerV1,
  buildPlayableSceneObservationV1,
  buildVisiblePopulationNarrationV1,
  resolvePerceptionV1,
  toPlayableScenePublicContextV1,
  validatePlayableSceneV1
} from "../../src/application";
import { compileLoreSourceV1, type LoreFragmentV1 } from "../../src/bootstrap/lore";

async function main(): Promise<void> {
  const sourcePath = "wiki/lore/territoire/region/Ylsséa/Lysenthe/batiments/archives_de_lysenthe";
  const sourceText = await readFile(resolve("..", sourcePath), "utf8");
  const compiled = await compileLoreSourceV1({
    sourcePath,
    sourceText
  }, {
    packageId: "i06t.lore.scene",
    packageVersion: 1
  });
  if (!compiled.ok) {
    throw new Error(`Lore compilation failed: ${compiled.diagnostics.map(diagnostic => diagnostic.messageKey).join(", ")}`);
  }

  const secretFragment = makeSecretFragment(compiled.value.fragments[0]!, compiled.value.entity.entityId);
  const result = buildPlayableSceneFromLoreLocationV1({
    entity: compiled.value.entity,
    fragments: [...compiled.value.fragments, secretFragment],
    sceneId: "wiki-location:archives-de-lysenthe"
  });

  assert.equal(result.adapterVersion, "lore-playable-scene-adapter/1");
  assert.equal(result.sourceEntityId, "archives_de_lysenthe");
  assert.equal(result.scene.sceneId, "wiki-location:archives-de-lysenthe");
  assert.equal(result.scene.locationName, "Archives de Lysenthe");
  assert.equal(validatePlayableSceneV1(result.scene).ok, true);

  const publicContext = toPlayableScenePublicContextV1(result.scene);
  assert.equal(publicContext.locationName, "Archives de Lysenthe");
  assert.match(publicContext.perceptibleSituation.join(" "), /Centre de conservation|conservation des actes/u);
  assert.equal(publicContext.perceptibleSituation.join(" ").includes("Salle interdite sous le troisième dépôt"), false);

  assert.ok(result.includedFragmentIds.length > 0, "au moins un fragment public/local doit alimenter la scène");
  assert.equal(result.withheldFragmentIds.includes(secretFragment.fragmentId), true, "le secret doit être retenu hors contexte");
  assert.equal(result.scene.aiSceneWriterPolicy.mayReference.includes(`lore-fragment:${secretFragment.fragmentId}`), false);
  assert.equal(result.scene.aiSceneWriterPolicy.mayCreate.length, 0);

  const joinedSceneText = [
    ...result.scene.perceptibleSituation,
    ...result.scene.visibleElements.map(element => element.description),
    ...result.scene.pointsOfInterest.map(point => point.visibleDescription),
    ...result.scene.playerKnownFacts,
    buildPlayableSceneLocationAnswerV1(result.scene),
    buildPlayableSceneObservationV1(result.scene, "J'observe les archives.")
  ].join("\n");
  assert.equal(joinedSceneText.includes("Salle interdite sous le troisième dépôt"), false);
  assert.match(joinedSceneText, /Archives de Lysenthe|conservation des actes/u);

  assert.equal(result.scene.presentNpc.length, 0, "un profil de présence probable ne crée pas artificiellement un PNJ individualisé");
  assert.deepEqual(
    result.scene.ambientPopulation.map(presence => presence.publicRole),
    ["archiviste", "clerc", "garde"],
    "les rôles probables les plus pondérés deviennent des présences éphémères distinctes"
  );
  assert.equal(new Set(result.scene.ambientPopulation.map(presence => presence.actorId)).size, 3);
  assert.equal(result.scene.ambientPopulation.every(presence =>
    presence.knowledgeRefs.every(ref => ref.startsWith("lore-fragment:"))
  ), true, "les amorces locales restent bornées aux fragments publics sélectionnés");
  const populationNarration = buildVisiblePopulationNarrationV1(result.scene);
  assert.match(populationNarration, /lieu est habité.*archiviste.*clerc.*garde/iu);
  assert.match(populationNarration, /D'autres silhouettes entretiennent le mouvement du lieu/u, "les présences matérialisées ne prétendent pas recenser toute la population");
  assert.doesNotMatch(populationNarration, /Présences visibles|roles_probables|profil_presence/u);
  const nearbyPeople = resolvePerceptionV1({
    semanticIntent: {
      schemaVersion: 1,
      kind: "observe_environment",
      playerGoal: "voir les gens présents à proximité",
      target: null,
      commitment: "committed",
      evidenceFromInput: ["est ce que je vois des gens pas loin de moi ?"],
      uncertainties: [],
      forbiddenInterpretations: ["révéler un fait caché"],
      confidence: "high",
      perception: {
        schemaVersion: 1,
        depth: "GLANCE",
        focus: "personnes présentes à proximité",
        soughtInformation: "présences humaines perceptibles alentour"
      }
    },
    targetRef: null,
    scene: result.scene
  });
  assert.equal(nearbyPeople?.status, "AUTOMATIC_RESULT");
  assert.match(nearbyPeople?.revealedTexts.join(" ") ?? "", /proximité.*silhouette.*archiviste/iu);
  assert.doesNotMatch(nearbyPeople?.revealedTexts.join(" ") ?? "", /fonction_principale|rumeurs/iu);

  const topology = buildSceneTransitionTopologyFromLoreLocationV1({
    entity: compiled.value.entity,
    scene: result.scene,
    topologyVersion: 1
  });
  assert.equal(topology.topologyId, "lore-location:archives_de_lysenthe:topology");
  for (const connection of topology.connections) {
    assert.equal(connection.sourceSceneId, result.scene.sceneId);
    assert.match(connection.boundaryRef, /^poi:/u);
    assert.equal(connection.state, "UNKNOWN", "le lore ne doit pas inventer l'état runtime du passage");
    assert.ok(connection.sourceRefs.some(ref => ref.startsWith("lore-attribute:")));
  }

  console.log("lore-playable-scene-adapter/1: OK");
}

function makeSecretFragment(base: LoreFragmentV1, entityId: string): LoreFragmentV1 {
  return {
    ...base,
    fragmentId: "fragment.i06t.secret.archives",
    entityId,
    fieldPath: "/informations/secret_i06t",
    text: "Salle interdite sous le troisième dépôt.",
    knowledgeLevel: "MJ_SECRET",
    topics: ["secret"],
    tags: ["secret"],
    relatedEntityIds: []
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
