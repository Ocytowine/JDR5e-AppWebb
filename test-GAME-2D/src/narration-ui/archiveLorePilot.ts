/// <reference types="vite/client" />

import { compileLoreCorpusV1 } from "../../narration-module/src/bootstrap/lore";
import { buildPlayableSceneFromLoreLocationV1, buildSceneTransitionTopologyFromLoreLocationV1 } from "../../narration-module/src/application";
import { selectLoreInfluencesV1 } from "../../narration-module/src/context";
import type { SceneTransitionTopologyV1 } from "../../narration-module/src/application";

const RAW_LORE = import.meta.glob("../../../wiki/lore/**/*", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const CATALOG_MODULES = import.meta.glob(["../data/characters/races/**/*.json", "../data/characters/languages/**/*.json"], { import: "default", eager: true }) as Record<string, { id?: unknown }>;

const SOURCES = Object.entries(RAW_LORE)
  .filter(([, sourceText]) => sourceText.startsWith("---\n") || sourceText.startsWith("---\r\n"))
  .map(([modulePath, sourceText]) => ({ sourcePath: modulePath.replace(/^\.\.\/\.\.\/\.\.\//u, ""), sourceText }))
  .sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

const CATALOG_ENTRIES = new Set(Object.entries(CATALOG_MODULES).flatMap(([modulePath, value]) => {
  if (typeof value.id !== "string") return [];
  return [modulePath.includes("/races/") ? `race:${value.id}` : `language:${value.id}`];
}));

export async function buildArchiveLorePilotV1() {
  const compiled = await compileLoreCorpusV1(
    SOURCES.map(source => ({ ...source })),
    { packageId: "jdr5e.archive-lore-pilot", packageVersion: 1, catalogEntries: CATALOG_ENTRIES }
  );
  if (!compiled.ok) throw new Error(`Archive lore compilation failed: ${compiled.diagnostics.map(value => value.messageKey).join(" | ")}`);
  const archive = compiled.value.entities.find(entity => entity.entityId === "archives_de_lysenthe");
  if (!archive) throw new Error("Archives de Lysenthe are absent from the compiled lore corpus");
  const playable = buildPlayableSceneFromLoreLocationV1({ entity: archive, fragments: compiled.value.fragments });
  const playableScenes = compiled.value.entities
    .filter(entity => ["batiment", "quartier", "ville"].includes(entity.entityType))
    .map(entity => ({ entity, scene: buildPlayableSceneFromLoreLocationV1({ entity, fragments: compiled.value.fragments }).scene }));
  const sceneByEntityId = new Map(playableScenes.map(entry => [entry.entity.entityId, entry.scene]));
  const locationRefBySceneId = new Map(playableScenes.map(entry => [entry.scene.sceneId, `location:${entry.entity.entityId}`] as const));
  const authoredConnections = playableScenes.flatMap(({ entity, scene }) =>
    buildSceneTransitionTopologyFromLoreLocationV1({ entity, scene, topologyVersion: 1 }).connections
  );
  const influences = selectLoreInfluencesV1({
    creationType: "PLACE",
    anchorEntityId: archive.entityId,
    entities: compiled.value.entities,
    fragments: compiled.value.fragments,
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"],
    maximumInfluences: 16
  });
  if (!influences.ok) throw new Error(`Archive lore influence selection failed: ${influences.issues.join(" | ")}`);
  const lorePacketBySceneId = new Map(playableScenes.map(entry => {
    const selected = selectLoreInfluencesV1({ creationType: "PLACE", anchorEntityId: entry.entity.entityId, entities: compiled.value.entities, fragments: compiled.value.fragments, allowedKnowledgeLevels: ["COMMUN", "LOCAL"], maximumInfluences: 16 });
    if (!selected.ok) throw new Error(`Lore influence selection failed for ${entry.entity.entityId}: ${selected.issues.join(" | ")}`);
    return [entry.scene.sceneId, selected.packet] as const;
  }));
  const authoredPlaces = playableScenes.map(entry => {
    const packet = lorePacketBySceneId.get(entry.scene.sceneId)!;
    return {
      placeRef: locationRefBySceneId.get(entry.scene.sceneId)!,
      displayName: entry.scene.locationName,
      aliases: [],
      parentLocationRef: `location:${packet.geographicChain[1] ?? packet.anchorEntityId}`,
      sourceRefs: [...packet.sourceRefs]
    };
  });
  return {
    scene: playable.scene,
    scenes: playableScenes.map(entry => entry.scene),
    locationRef: "location:archives_de_lysenthe",
    entities: compiled.value.entities,
    fragments: compiled.value.fragments,
    influencePacket: influences.packet,
    lorePacketBySceneId,
    authoredPlaces,
    locationRefBySceneId,
    topology: {
      schemaVersion: 1,
      contractVersion: "scene-transition/1",
      topologyId: "topology-archives-lysenthe-campaign",
      topologyVersion: 1,
      connections: authoredConnections.flatMap(connection => {
        const rawDestination = connection.destinationRef.replace(/^lore-location:/u, "");
        const destination = sceneByEntityId.get(rawDestination);
        return destination === undefined ? [] : [{ ...connection, destinationRef: `location:${rawDestination}`, state: "OPEN" as const }];
      })
    } satisfies SceneTransitionTopologyV1
  };
}
