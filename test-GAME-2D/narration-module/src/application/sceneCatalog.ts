import { coreError, type AggregateId, type CampaignId, type CampaignRepository, type Result } from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";
import {
  buildDynamicPlaceSceneAfterCommitV1,
  type PlaceRegistryStateV1
} from "./placeCreationCommit";

export interface SceneSourceV1 {
  sourceKind: "PREPARED" | "WIKI";
  resolve(sceneId: string): Promise<PlayableSceneStateV1 | null> | PlayableSceneStateV1 | null;
}

export interface DynamicSceneCatalogV1 {
  repository: CampaignRepository;
  campaignId: CampaignId;
  placeRegistryAggregateId: AggregateId;
  topologyAggregateId: AggregateId;
  factRegistryAggregateId: AggregateId;
}

export type SceneResolutionV1 = {
  scene: PlayableSceneStateV1;
  sourceKind: "PREPARED" | "WIKI" | "DYNAMIC_CAMPAIGN";
};

/** One read facade over authored scenes and campaign-created scenes; it owns no storage. */
export async function resolveSceneV1(input: {
  sceneId: string;
  sources: readonly SceneSourceV1[];
  dynamicCatalog: DynamicSceneCatalogV1;
}): Promise<Result<SceneResolutionV1>> {
  for (const source of input.sources) {
    const scene = await source.resolve(input.sceneId);
    if (scene) return { ok: true, value: { scene, sourceKind: source.sourceKind } };
  }
  const dynamic = await resolveDynamicScene(input.sceneId, input.dynamicCatalog);
  if (dynamic.ok) return { ok: true, value: { scene: dynamic.value, sourceKind: "DYNAMIC_CAMPAIGN" } };
  if (dynamic.error.code !== "NOT_FOUND") return dynamic;
  return {
    ok: false,
    error: coreError("NOT_FOUND", "narrative.scene-catalog.scene-not-found", { sceneId: input.sceneId })
  };
}

async function resolveDynamicScene(sceneId: string, catalog: DynamicSceneCatalogV1): Promise<Result<PlayableSceneStateV1>> {
  const placeRegistry = await catalog.repository.getAggregate(catalog.campaignId, "world.place-registry", catalog.placeRegistryAggregateId);
  if (!placeRegistry.ok) return placeRegistry;
  const state = placeRegistry.value.payload as PlaceRegistryStateV1;
  const place = state.places.find(candidate => candidate.arrivalSceneId === sceneId);
  if (!place) return { ok: false, error: coreError("NOT_FOUND", "narrative.scene-catalog.dynamic-scene-not-found", { sceneId }) };
  const [topology, facts] = await Promise.all([
    catalog.repository.getAggregate(catalog.campaignId, "world.scene-topology", catalog.topologyAggregateId),
    catalog.repository.getAggregate(catalog.campaignId, "campaign.place-facts", catalog.factRegistryAggregateId)
  ]);
  if (!topology.ok) return topology;
  if (!facts.ok) return facts;
  if (!placeRegistry.value.updatedByCommitId) {
    return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.scene-catalog.unconfirmed-place-registry") };
  }
  const commit = await catalog.repository.getCommit(placeRegistry.value.updatedByCommitId);
  if (!commit.ok) return commit;
  const scene = buildDynamicPlaceSceneAfterCommitV1({
    commit: commit.value,
    placeRef: place.placeRef,
    placeRegistryAggregate: placeRegistry.value,
    topologyAggregate: topology.value,
    factRegistryAggregate: facts.value
  });
  return scene.ok
    ? { ok: true, value: scene.scene }
    : { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.scene-catalog.dynamic-scene-invalid", { issues: scene.issues }) };
}
