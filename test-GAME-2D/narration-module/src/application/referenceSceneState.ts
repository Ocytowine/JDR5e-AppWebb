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
import type { NarrativeResolutionResultV1 } from "./narrativeResolution";
import { REFERENCE_PLAYABLE_SCENE_ID_V1 } from "./referenceScene";

export const REFERENCE_SCENE_STATE_CONTRACT_VERSION_V1 = "reference-scene-state/1" as const;
export const REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1 = "scene.state" as const;
export const REFERENCE_SCENE_STATE_AGGREGATE_ID_V1 = opaqueId<AggregateId>("agg-scene-reference-inn-rain-001");

export interface ReferenceSceneStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof REFERENCE_SCENE_STATE_CONTRACT_VERSION_V1;
  sceneId: typeof REFERENCE_PLAYABLE_SCENE_ID_V1;
  interactionCount: number;
  guardAddressed: boolean;
  backRoomDoorHighlighted: boolean;
  playerLookedAround: boolean;
  visibleFocus: string[];
  lastPlayerSpeechSummary: string | null;
  shortTermNpcMemory: ReferenceSceneShortTermNpcMemoryEntryV1[];
  lastMutationOperationId: string | null;
  version: 1;
}

export interface ReferenceSceneShortTermNpcMemoryEntryV1 extends JsonObject {
  schemaVersion: 1;
  memoryId: string;
  actorId: "npc-garde-blesse" | "npc-serveuse-nerveuse";
  actorDisplayName: string;
  operationId: string;
  playerIntentSummary: string;
  npcContinuitySummary: string;
  visibleToPlayer: true;
  order: number;
  version: 1;
}

export interface LoadedReferenceSceneStateV1 {
  aggregateType: typeof REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1;
  aggregateId: AggregateId;
  aggregateRevision: number | null;
  state: ReferenceSceneStateV1;
}

export function createInitialReferenceSceneStateV1(): ReferenceSceneStateV1 {
  return {
    schemaVersion: 1,
    contractVersion: REFERENCE_SCENE_STATE_CONTRACT_VERSION_V1,
    sceneId: REFERENCE_PLAYABLE_SCENE_ID_V1,
    interactionCount: 0,
    guardAddressed: false,
    backRoomDoorHighlighted: false,
    playerLookedAround: false,
    visibleFocus: ["pluie", "garde-blesse", "serveuse-nerveuse", "porte-du-fond"],
    lastPlayerSpeechSummary: null,
    shortTermNpcMemory: [],
    lastMutationOperationId: null,
    version: 1
  };
}

export async function loadReferenceSceneStateV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<LoadedReferenceSceneStateV1>> {
  const aggregate = await input.repository.getAggregate(
    input.campaignId,
    REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
    REFERENCE_SCENE_STATE_AGGREGATE_ID_V1
  );
  if (!aggregate.ok) {
    if (aggregate.error.code !== "NOT_FOUND") return aggregate;
    return {
      ok: true,
      value: {
        aggregateType: REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
        aggregateId: REFERENCE_SCENE_STATE_AGGREGATE_ID_V1,
        aggregateRevision: null,
        state: createInitialReferenceSceneStateV1()
      }
    };
  }
  return {
    ok: true,
    value: {
      aggregateType: REFERENCE_SCENE_STATE_AGGREGATE_TYPE_V1,
      aggregateId: REFERENCE_SCENE_STATE_AGGREGATE_ID_V1,
      aggregateRevision: aggregate.value.aggregateRevision,
      state: normalizeReferenceSceneStateV1(aggregate.value)
    }
  };
}

export function applyReferenceSceneMutationV1(input: {
  current: ReferenceSceneStateV1;
  operationId: string;
  interpretation: NarrativeIntentInterpretationV1;
  resolution: NarrativeResolutionResultV1;
}): ReferenceSceneStateV1 {
  const next: ReferenceSceneStateV1 = {
    ...input.current,
    visibleFocus: [...input.current.visibleFocus],
    lastMutationOperationId: input.operationId
  };
  if (input.interpretation.semanticIntent.kind === "address_visible_actor" && input.resolution.commitId === null) {
    const actor = speechTarget(input.interpretation);
    next.interactionCount += 1;
    next.guardAddressed = actor.actorId === "npc-garde-blesse" ? true : next.guardAddressed;
    next.backRoomDoorHighlighted = true;
    next.lastPlayerSpeechSummary = input.interpretation.semanticIntent.playerGoal;
    next.shortTermNpcMemory = appendNpcShortTermMemoryV1({
      current: input.current.shortTermNpcMemory,
      operationId: input.operationId,
      playerIntentSummary: input.interpretation.semanticIntent.playerGoal,
      nextOrder: input.current.shortTermNpcMemory.length + 1,
      actor
    });
    if (actor.actorId === "npc-garde-blesse" && !next.visibleFocus.includes("garde-blesse-interpelle")) next.visibleFocus.push("garde-blesse-interpelle");
    if (actor.actorId === "npc-serveuse-nerveuse" && !next.visibleFocus.includes("serveuse-nerveuse-interpellee")) next.visibleFocus.push("serveuse-nerveuse-interpellee");
    if (!next.visibleFocus.includes("porte-du-fond-signalee")) next.visibleFocus.push("porte-du-fond-signalee");
  }
  if (input.interpretation.semanticIntent.kind === "observe_environment") {
    next.playerLookedAround = true;
  }
  const actionTarget = input.interpretation.referentResolution?.resolvedTarget ?? input.interpretation.semanticIntent.target ?? null;
  if (
    input.interpretation.semanticIntent.kind === "manipulate_visible_object" &&
    input.resolution.resultKind === "COMMIT_PREPARED" &&
    actionTarget?.ref === "poi:back-room-door"
  ) {
    next.backRoomDoorHighlighted = true;
    if (!next.visibleFocus.includes("porte-du-fond-signalee")) next.visibleFocus.push("porte-du-fond-signalee");
  }
  return next;
}

function normalizeReferenceSceneStateV1(aggregate: AggregateRecord): ReferenceSceneStateV1 {
  const payload = aggregate.payload as Partial<ReferenceSceneStateV1>;
  return {
    ...createInitialReferenceSceneStateV1(),
    ...payload,
    schemaVersion: 1,
    contractVersion: REFERENCE_SCENE_STATE_CONTRACT_VERSION_V1,
    sceneId: REFERENCE_PLAYABLE_SCENE_ID_V1,
    visibleFocus: Array.isArray(payload.visibleFocus)
      ? payload.visibleFocus.filter((entry): entry is string => typeof entry === "string")
      : createInitialReferenceSceneStateV1().visibleFocus,
    shortTermNpcMemory: normalizeShortTermNpcMemory(payload.shortTermNpcMemory),
    version: 1
  };
}

function appendNpcShortTermMemoryV1(input: {
  current: ReferenceSceneShortTermNpcMemoryEntryV1[];
  operationId: string;
  playerIntentSummary: string;
  nextOrder: number;
  actor: {
    actorId: "npc-garde-blesse" | "npc-serveuse-nerveuse";
    actorDisplayName: string;
  };
}): ReferenceSceneShortTermNpcMemoryEntryV1[] {
  const isWaitress = input.actor.actorId === "npc-serveuse-nerveuse";
  const entry: ReferenceSceneShortTermNpcMemoryEntryV1 = {
    schemaVersion: 1,
    memoryId: `${input.operationId}:memory:${input.actor.actorId}`,
    actorId: input.actor.actorId,
    actorDisplayName: input.actor.actorDisplayName,
    operationId: input.operationId,
    playerIntentSummary: input.playerIntentSummary,
    npcContinuitySummary: isWaitress
      ? "Le joueur s'est adressé à la serveuse; aucune ancienne réplique PNJ n'est déduite de cette entrée."
      : "Le joueur s'est adressé au garde; aucune ancienne réplique PNJ n'est déduite de cette entrée.",
    visibleToPlayer: true,
    order: input.nextOrder,
    version: 1
  };
  const boundedPerActor = boundNpcMemoryPerActor([...input.current, entry]);
  return boundedPerActor.map((memory, index) => ({
    ...memory,
    order: index + 1
  }));
}

function speechTarget(interpretation: NarrativeIntentInterpretationV1): {
  actorId: "npc-garde-blesse" | "npc-serveuse-nerveuse";
  actorDisplayName: string;
} {
  const structuredRef = interpretation.referentResolution?.resolvedTarget?.ref ?? interpretation.semanticIntent.target?.ref ?? null;
  if (structuredRef === "npc:npc-serveuse-nerveuse" || structuredRef === "npc-serveuse-nerveuse") {
    return { actorId: "npc-serveuse-nerveuse", actorDisplayName: "Serveuse nerveuse" };
  }
  if (structuredRef === "npc:npc-garde-blesse" || structuredRef === "npc-garde-blesse") {
    return { actorId: "npc-garde-blesse", actorDisplayName: "Garde blessé" };
  }
  return { actorId: "npc-garde-blesse", actorDisplayName: "Garde blessé" };
}

function normalizeShortTermNpcMemory(value: unknown): ReferenceSceneShortTermNpcMemoryEntryV1[] {
  if (!Array.isArray(value)) return [];
  const normalized: ReferenceSceneShortTermNpcMemoryEntryV1[] = value.filter((entry): entry is ReferenceSceneShortTermNpcMemoryEntryV1 => {
    return entry !== null &&
      typeof entry === "object" &&
      (entry as { schemaVersion?: unknown }).schemaVersion === 1 &&
      typeof (entry as { memoryId?: unknown }).memoryId === "string" &&
      typeof (entry as { operationId?: unknown }).operationId === "string" &&
      typeof (entry as { playerIntentSummary?: unknown }).playerIntentSummary === "string" &&
      typeof (entry as { npcContinuitySummary?: unknown }).npcContinuitySummary === "string";
  }).map(entry => ({
    ...entry,
    actorId: entry.actorId === "npc-serveuse-nerveuse" ? "npc-serveuse-nerveuse" as const : "npc-garde-blesse" as const,
    actorDisplayName: typeof entry.actorDisplayName === "string" ? entry.actorDisplayName : "Garde blessé",
    visibleToPlayer: true as const,
    version: 1 as const
  }));
  return boundNpcMemoryPerActor(normalized).map((entry, index) => ({ ...entry, order: index + 1 }));
}

function boundNpcMemoryPerActor(entries: ReferenceSceneShortTermNpcMemoryEntryV1[]): ReferenceSceneShortTermNpcMemoryEntryV1[] {
  return entries.filter((memory, index, all) =>
    all.slice(index).filter(candidate => candidate.actorId === memory.actorId).length <= 5
  ).slice(-10);
}
