/// <reference types="vite/client" />

import { compileLoreCorpusV1 } from "../../narration-module/src/bootstrap/lore";
import { buildPlayableSceneFromLoreLocationV1, buildSceneTransitionTopologyFromLoreLocationV1 } from "../../narration-module/src/application";
import { selectLoreInfluencesV1 } from "../../narration-module/src/context";
import type { SceneTransitionTopologyV1 } from "../../narration-module/src/application";

const RAW_SOURCES = (typeof import.meta.glob === "function" ? import.meta.glob([
    "../../../wiki/lore/territoire/astryade",
    "../../../wiki/lore/territoire/region/Ylsséa/index",
    "../../../wiki/lore/territoire/region/Ylsséa/Lysenthe/index",
    "../../../wiki/lore/territoire/region/Ylsséa/Lysenthe/quartiers/quartier_des_archives",
    "../../../wiki/lore/territoire/region/Ylsséa/Lysenthe/batiments/archives_de_lysenthe",
    "../../../wiki/lore/factions/archivistes_de_lysenthe",
    "../../../wiki/lore/populations/especes/humains.md",
    "../../../wiki/lore/populations/especes/elfes.md",
    "../../../wiki/lore/populations/cultures/culture_cotiere_ylssea.md"
  ], { query: "?raw", import: "default", eager: true }) : {}) as Record<string, string>;
const SOURCE_PATHS = [
  "wiki/lore/territoire/astryade",
  "wiki/lore/territoire/region/Ylsséa/index",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/index",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/quartiers/quartier_des_archives",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/batiments/archives_de_lysenthe",
  "wiki/lore/factions/archivistes_de_lysenthe",
  "wiki/lore/populations/especes/humains.md",
  "wiki/lore/populations/especes/elfes.md",
  "wiki/lore/populations/cultures/culture_cotiere_ylssea.md"
] as const;

export async function buildArchiveLorePilotV1() {
  const compiled = await compileLoreCorpusV1(
    SOURCE_PATHS.map(sourcePath => {
      const moduleKey = `../../../${sourcePath}`;
      const sourceText = RAW_SOURCES[moduleKey];
      if (typeof sourceText !== "string") throw new Error(`Missing bundled lore source: ${sourcePath}`);
      return { sourcePath, sourceText };
    }),
    { packageId: "jdr5e.archive-lore-pilot", packageVersion: 1 }
  );
  if (!compiled.ok) throw new Error(`Archive lore compilation failed: ${compiled.diagnostics.map(value => value.messageKey).join(" | ")}`);
  const archive = compiled.value.entities.find(entity => entity.entityId === "archives_de_lysenthe");
  if (!archive) throw new Error("Archives de Lysenthe are absent from the compiled lore corpus");
  const playable = buildPlayableSceneFromLoreLocationV1({ entity: archive, fragments: compiled.value.fragments });
  const playableScenes = compiled.value.entities
    .filter(entity => ["batiment", "quartier", "ville"].includes(entity.entityType))
    .map(entity => ({ entity, scene: buildPlayableSceneFromLoreLocationV1({ entity, fragments: compiled.value.fragments }).scene }));
  const sceneByEntityId = new Map(playableScenes.map(entry => [entry.entity.entityId, entry.scene]));
  const authoredConnections = playableScenes.flatMap(({ entity, scene }) =>
    buildSceneTransitionTopologyFromLoreLocationV1({ entity, scene, topologyVersion: 1 }).connections
  );
  const influences = selectLoreInfluencesV1({
    creationType: "PLACE",
    anchorEntityId: archive.entityId,
    entities: compiled.value.entities,
    fragments: compiled.value.fragments,
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"],
    maximumInfluences: 100
  });
  if (!influences.ok) throw new Error(`Archive lore influence selection failed: ${influences.issues.join(" | ")}`);
  const lorePacketBySceneId = new Map(playableScenes.map(entry => {
    const selected = selectLoreInfluencesV1({ creationType: "PLACE", anchorEntityId: entry.entity.entityId, entities: compiled.value.entities, fragments: compiled.value.fragments, allowedKnowledgeLevels: ["COMMUN", "LOCAL"], maximumInfluences: 100 });
    if (!selected.ok) throw new Error(`Lore influence selection failed for ${entry.entity.entityId}: ${selected.issues.join(" | ")}`);
    return [entry.scene.sceneId, selected.packet] as const;
  }));
  return {
    scene: playable.scene,
    scenes: playableScenes.map(entry => entry.scene),
    locationRef: "location:archives_de_lysenthe",
    entities: compiled.value.entities,
    fragments: compiled.value.fragments,
    influencePacket: influences.packet,
    lorePacketBySceneId,
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
