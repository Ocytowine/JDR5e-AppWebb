import { buildPlayableSceneFromLoreLocationV1, buildSceneTransitionTopologyFromLoreLocationV1 } from "../../narration-module/src/application";
import {
  assertNarrativeLoreBuildCatalogV1,
  type NarrativeLoreBuildCatalogV1
} from "../../narration-module/src/context";
import type { SceneTransitionTopologyV1 } from "../../narration-module/src/application";
import generatedNarrativeLoreCatalog from "./generated/narrativeLoreCatalog.generated.json";

export async function buildArchiveLorePilotV1() {
  assertNarrativeLoreBuildCatalogV1(generatedNarrativeLoreCatalog);
  const catalog: NarrativeLoreBuildCatalogV1 = generatedNarrativeLoreCatalog;
  const archive = catalog.entities.find(entity => entity.entityId === "archives_de_lysenthe");
  if (!archive) throw new Error("Archives de Lysenthe are absent from the compiled lore corpus");
  const playable = buildPlayableSceneFromLoreLocationV1({ entity: archive, fragments: catalog.fragments });
  const playableScenes = catalog.entities
    .filter(entity => ["batiment", "quartier", "ville"].includes(entity.entityType))
    .map(entity => ({ entity, scene: buildPlayableSceneFromLoreLocationV1({ entity, fragments: catalog.fragments }).scene }));
  const sceneByEntityId = new Map(playableScenes.map(entry => [entry.entity.entityId, entry.scene]));
  const locationRefBySceneId = new Map(playableScenes.map(entry => [entry.scene.sceneId, `location:${entry.entity.entityId}`] as const));
  const authoredConnections = playableScenes.flatMap(({ entity, scene }) =>
    buildSceneTransitionTopologyFromLoreLocationV1({ entity, scene, topologyVersion: 1 }).connections
  );
  const packetByEntityId = new Map(catalog.scenes.map(entry => [entry.entityId, entry.influencePacket] as const));
  const influencePacket = packetByEntityId.get(archive.entityId);
  if (!influencePacket) throw new Error("Archive lore influence packet is absent from the build catalog");
  const lorePacketBySceneId = new Map(playableScenes.map(entry => {
    const packet = packetByEntityId.get(entry.entity.entityId);
    if (!packet) throw new Error(`Lore influence packet is absent for ${entry.entity.entityId}`);
    return [entry.scene.sceneId, packet] as const;
  }));
  const authoredSceneSourceBySceneId = new Map(playableScenes.map(entry => [
    entry.scene.sceneId,
    {
      entity: entry.entity,
      packet: lorePacketBySceneId.get(entry.scene.sceneId)!,
      fragments: catalog.fragments
    }
  ] as const));
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
    entities: catalog.entities,
    fragments: catalog.fragments,
    influencePacket,
    lorePacketBySceneId,
    packetByEntityId,
    authoredSceneSourceBySceneId,
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
