import {
  createCatalogCampaignTravelRuntimeV1,
  companionTravelPartySnapshotV1,
  loadCompanionPartyRegistryV1,
  moveCompanionPartyV1,
  type CampaignRuntimeBindingsV1
} from "../../narration-module/src/application";
import type { WorldTravelRouteCatalogV1 } from
  "../../narration-module/src/time";
import { computeJsonFingerprint } from "../../narration-module/src/core";

export const INSTALLED_PLAYABLE_TRAVEL_CATALOG_V1:
WorldTravelRouteCatalogV1 = {
  schemaVersion: 1,
  catalogId: "world-travel:lysenthe-playable",
  catalogVersion: 1,
  anchors: [{
    schemaVersion: 1,
    locationId: "archives_de_lysenthe",
    status: "AVAILABLE",
    sourceRefs: ["wiki-location:archives_de_lysenthe"]
  }, {
    schemaVersion: 1,
    locationId: "halles_des_commerces",
    status: "AVAILABLE",
    sourceRefs: ["wiki-location:halles_des_commerces"]
  }],
  routes: [{
    schemaVersion: 1,
    routeId: "route:lysenthe:archives-halles",
    fromLocationId: "archives_de_lysenthe",
    toLocationId: "halles_des_commerces",
    direction: "BIDIRECTIONAL",
    status: "OPEN",
    distanceUnits: 2,
    estimatedSecondsByMode: { WALK: 1_800 },
    dangerLevel: 0,
    environmentTags: ["ville", "voie_publique"],
    sourceRefs: [
      "wiki-location:archives_de_lysenthe",
      "wiki-location:halles_des_commerces",
      "travel-policy:lysenthe-urban-walk-v1"
    ]
  }]
};

export function createInstalledPlayableTravelRuntimeV1(
  runtimeBindings: CampaignRuntimeBindingsV1,
  options: { narrativeInterruption?: boolean } = {}
) {
  return createCatalogCampaignTravelRuntimeV1({
    catalog: INSTALLED_PLAYABLE_TRAVEL_CATALOG_V1,
    runtimeBindings,
    locationLabels: {
      archives_de_lysenthe: "les Archives de Lysenthe",
      halles_des_commerces: "les Halles des commerces"
    },
    interruptions: options.narrativeInterruption === false ? [] : [{
      checkpointRevision: 0,
      afterSeconds: 900,
      reasonRef: "world-signal:lysenthe-street-procession",
      perceptibleSign:
        "Au dÃ©tour d'une rue, un cortÃ¨ge compact dÃ©bouche entre les faÃ§ades et coupe votre chemin. Les voix et les pas se rapprochent ; il faut d'abord comprendre la situation ou choisir comment la traverser.",
      sourceRefs: [
        "wiki-location:archives_de_lysenthe",
        "wiki-location:halles_des_commerces",
        "world-signal:lysenthe-street-procession"
      ]
    }],
    async resolveParty(request) {
      const party = await loadCompanionPartyRegistryV1({
        repository: request.repository,
        campaignId: request.campaignId
      });
      if (!party.ok) return party;
      return { ok: true, value: party.value.state === null
        ? {
            schemaVersion: 1,
            partyId: `party:${request.campaignId}:${request.characterId}`,
            partyRevision: 0,
            leaderActorId: request.characterId,
            memberActorIds: [request.characterId],
            sourceRefs: [
              `campaign-character:${request.characterId}`
            ]
          }
        : companionTravelPartySnapshotV1(party.value.state) };
    },
    resolveArrival(destinationLocationId) {
      return INSTALLED_PLAYABLE_TRAVEL_CATALOG_V1.anchors.some(
        anchor => anchor.locationId === destinationLocationId
          && anchor.status === "AVAILABLE"
      ) ? {
          sceneId: `wiki-location:${destinationLocationId}`,
          locationRef: `location:${destinationLocationId}`
        } : null;
    },
    async onArrival(request) {
      const party = await loadCompanionPartyRegistryV1({
        repository: request.repository,
        campaignId: request.campaignId
      });
      if (!party.ok) return party;
      if (party.value.state === null) return { ok: true, value: null };
      if (party.value.state.currentSceneId === request.destinationSceneId) {
        return { ok: true, value: null };
      }
      const arrivalFingerprint = await computeJsonFingerprint({
        schemaVersion: 1,
        processId: request.process.processId,
        destinationSceneId: request.destinationSceneId
      });
      return moveCompanionPartyV1({
        repository: request.repository,
        campaignId: request.campaignId,
        command: {
          schemaVersion: 1,
          clientRequestId: `travel-arrival:${arrivalFingerprint
            .replace(/^sha256:/u, "")
            .slice(0, 40)}`,
          fromSceneId: party.value.state.currentSceneId,
          toSceneId: request.destinationSceneId,
          sourceWorldEventRef: `commit:${request.commitId}`,
          occurredAtGameSecond: request.occurredAtGameSecond
        }
      });
    }
  });
}
