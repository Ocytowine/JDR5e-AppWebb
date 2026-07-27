import {
  opaqueId,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRepository,
  type JsonObject,
  type Result
} from "../core";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import type {
  PlayableSceneAmbientPresenceV1,
  PlayableSceneNpcV1,
  PlayableSceneStateV1
} from "./playableScene";
import { narrativeDesignationOfV1 } from "./narrativeDesignation";

export const SCENE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1 = "scene.actor-registry" as const;
export const SCENE_ACTOR_REGISTRY_CONTRACT_VERSION_V1 = "scene-actor-registry/1" as const;

export interface SceneActorRecordV1 extends JsonObject {
  schemaVersion: 1;
  sceneId: string;
  actorId: string;
  displayName: string;
  publicRole: string;
  visibleActivity: string;
  visibleAppearance: string;
  demeanor: string;
  immediateGoal: string;
  currentPressure: string;
  speechStyle: string[];
  conversationalHooks: string[];
  boundaries: string[];
  knowledgeRefs: string[];
  keywords: string[];
  promotedByOperationId: string;
  version: 1;
}

export interface SceneActorRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_ACTOR_REGISTRY_CONTRACT_VERSION_V1;
  sceneId: string;
  actors: SceneActorRecordV1[];
  version: 1;
}

export interface LoadedSceneActorRegistryV1 {
  aggregateType: typeof SCENE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1;
  aggregateId: AggregateId;
  aggregateRevision: number | null;
  state: SceneActorRegistryV1;
}

export function sceneActorRegistryAggregateIdV1(sceneId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-scene-actors:${sceneId}`);
}

export async function loadSceneActorRegistryV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sceneId: string;
}): Promise<Result<LoadedSceneActorRegistryV1>> {
  const aggregateId = sceneActorRegistryAggregateIdV1(input.sceneId);
  const aggregate = await input.repository.getAggregate(
    input.campaignId,
    SCENE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
    aggregateId
  );
  if (!aggregate.ok) {
    if (aggregate.error.code !== "NOT_FOUND") return aggregate;
    return {
      ok: true,
      value: {
        aggregateType: SCENE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        aggregateRevision: null,
        state: createEmptyRegistry(input.sceneId)
      }
    };
  }
  return {
    ok: true,
    value: {
      aggregateType: SCENE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId,
      aggregateRevision: aggregate.value.aggregateRevision,
      state: normalizeRegistry(aggregate.value, input.sceneId)
    }
  };
}

export async function applyPersistedSceneActorsV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  scene: PlayableSceneStateV1;
}): Promise<Result<PlayableSceneStateV1>> {
  const loaded = await loadSceneActorRegistryV1({
    repository: input.repository,
    campaignId: input.campaignId,
    sceneId: input.scene.sceneId
  });
  if (!loaded.ok) return loaded;
  return { ok: true, value: applySceneActorRegistryV1(input.scene, loaded.value.state) };
}

export function buildSceneActorPromotionV1(input: {
  scene: PlayableSceneStateV1;
  registry: SceneActorRegistryV1;
  interpretation: NarrativeIntentInterpretationV1;
  operationId: string;
}): SceneActorRecordV1 | null {
  if (input.interpretation.semanticIntent.kind !== "address_visible_actor") return null;
  const target = input.interpretation.referentResolution?.resolvedTarget ?? input.interpretation.semanticIntent.target ?? null;
  const actorId = target?.ref?.replace(/^npc:/u, "") ?? null;
  if (actorId === null || input.registry.actors.some(actor => actor.actorId === actorId)) return null;
  const presence = input.scene.ambientPopulation.find(candidate => candidate.actorId === actorId);
  return presence === undefined ? null : actorFromAmbient(presence, input.scene.sceneId, input.operationId);
}

export function appendSceneActorV1(registry: SceneActorRegistryV1, actor: SceneActorRecordV1): SceneActorRegistryV1 {
  if (registry.actors.some(candidate => candidate.actorId === actor.actorId)) return registry;
  return { ...registry, actors: [...registry.actors, actor] };
}

export function applySceneActorRegistryV1(
  scene: PlayableSceneStateV1,
  registry: SceneActorRegistryV1
): PlayableSceneStateV1 {
  if (registry.sceneId !== scene.sceneId || registry.actors.length === 0) return scene;
  const promotedIds = new Set(registry.actors.map(actor => actor.actorId));
  const existingIds = new Set(scene.presentNpc.map(actor => actor.actorId));
  return {
    ...scene,
    presentNpc: [
      ...scene.presentNpc,
      ...registry.actors.filter(actor => !existingIds.has(actor.actorId)).map(actor => {
        const currentAmbientSeed = scene.ambientPopulation.find(presence => presence.actorId === actor.actorId);
        return toPlayableNpc({
          ...actor,
          visibleAppearance: actor.visibleAppearance?.trim()
            ? actor.visibleAppearance
            : currentAmbientSeed?.visibleAppearance ?? "tenue de travail visible sans autre trait individualisé"
        });
      })
    ],
    ambientPopulation: scene.ambientPopulation.filter(presence => !promotedIds.has(presence.actorId))
  };
}

function createEmptyRegistry(sceneId: string): SceneActorRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: SCENE_ACTOR_REGISTRY_CONTRACT_VERSION_V1,
    sceneId,
    actors: [],
    version: 1
  };
}

function actorFromAmbient(
  presence: PlayableSceneAmbientPresenceV1,
  sceneId: string,
  operationId: string
): SceneActorRecordV1 {
  return {
    ...presence,
    sceneId,
    promotedByOperationId: operationId
  };
}

function toPlayableNpc(actor: SceneActorRecordV1): PlayableSceneNpcV1 {
  const designation = narrativeDesignationOfV1(actor);
  return {
    schemaVersion: 1,
    actorId: actor.actorId,
    displayName: actor.displayName,
    narrativeLabel: designation?.subsequentMention ?? actor.displayName,
    ...(designation ? { designation } : {}),
    publicRole: actor.publicRole,
    visibleState: `${actor.visibleActivity}; ${actor.visibleAppearance}; ${actor.demeanor}`,
    keywords: [...actor.keywords],
    defaultReply: `${designation?.subsequentMention ?? actor.displayName} suspend son geste et prête attention.`,
    repeatedReply: `${designation?.subsequentMention ?? actor.displayName} reste attentif à la suite de l'échange.`,
    demeanor: actor.demeanor,
    immediateGoal: actor.immediateGoal,
    currentPressure: actor.currentPressure,
    speechStyle: [...actor.speechStyle],
    conversationalHooks: [...actor.conversationalHooks],
    boundaries: [...actor.boundaries],
    knowledgeRefs: [...actor.knowledgeRefs],
    version: 1
  };
}

function normalizeRegistry(aggregate: AggregateRecord, sceneId: string): SceneActorRegistryV1 {
  const payload = aggregate.payload as Partial<SceneActorRegistryV1>;
  const actors = Array.isArray(payload.actors)
    ? payload.actors.filter((actor): actor is SceneActorRecordV1 =>
      actor !== null &&
      typeof actor === "object" &&
      (actor as Partial<SceneActorRecordV1>).schemaVersion === 1 &&
      (actor as Partial<SceneActorRecordV1>).sceneId === sceneId &&
      typeof (actor as Partial<SceneActorRecordV1>).actorId === "string"
    )
    : [];
  return {
    ...createEmptyRegistry(sceneId),
    actors: actors.map(actor => ({
      ...actor,
      visibleAppearance: typeof actor.visibleAppearance === "string" ? actor.visibleAppearance : ""
    }))
  };
}
