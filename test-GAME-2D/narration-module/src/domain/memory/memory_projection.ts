import { CampaignMemory, RuntimeEntityRecord } from "./memory_types";
import { EffectiveTruthSnapshot, resolveEffectiveTruth } from "./truth_resolution";

export type ProjectionInput = {
  wikiWorldState: Record<string, unknown>;
  campaignMemory: CampaignMemory;
  localContext: Record<string, unknown>;
};

export type ProjectedMemory = {
  truth_snapshot?: EffectiveTruthSnapshot;
  effective_world_state: Record<string, unknown>;
  projected_units: {
    events: Array<Record<string, unknown>>;
    relations: Array<Record<string, unknown>>;
    knowledge_player_view: Array<Record<string, unknown>>;
    knowledge_truth_view: Array<Record<string, unknown>>;
    entity_registry: {
      actors: Array<Record<string, unknown>>;
      locations: Array<Record<string, unknown>>;
      objects: Array<Record<string, unknown>>;
    };
  };
};

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function memoryStateWeight(entity: RuntimeEntityRecord): number {
  const memoryState = safeString(entity.memory_state).toLowerCase();
  if (memoryState === "active") return 40;
  if (memoryState === "relevant") return 25;
  if (memoryState === "dormant") return 10;
  return 0;
}

function intentWeight(intentType: string, defaultValue: number, overrides: Record<string, number>): number {
  return overrides[intentType] ?? defaultValue;
}

function entityProjectionScore(
  entity: RuntimeEntityRecord,
  locationId: string,
  intentType: string,
  targetActorId: string,
): number {
  const status = safeString(entity.status).toLowerCase();
  const memoryState = safeString(entity.memory_state).toLowerCase();
  if (status === "expired" || status === "archived" || memoryState === "archived") return -1;

  let score = memoryStateWeight(entity);
  const entityLocationId = safeString(entity.location_id);
  const payload = entity.payload as Record<string, unknown>;
  const world = (payload?.world as Record<string, unknown> | undefined) ?? {};
  if (locationId && entityLocationId === locationId) score += 50;
  if (locationId && safeString(world.location_precision) === locationId) score += 10;
  if (Array.isArray(entity.links?.event_ids) && entity.links.event_ids.length > 0) score += 5;
  const lastSeenTurnIndex = Number(entity.last_seen_turn_index ?? -1);
  if (Number.isFinite(lastSeenTurnIndex)) score += Math.max(0, Math.min(lastSeenTurnIndex, 20));
  if (targetActorId && safeString(entity.entity_id) === targetActorId) score += 80;
  score += intentWeight(intentType, 0, {
    talk: entity.entity_type === "actor" ? 20 : 0,
    ask_info: entity.entity_type === "actor" ? 10 : 0,
    observe: 0,
    move_local: entity.entity_type === "location" ? 15 : 0,
  });
  return score;
}

function selectProjectedEntities(
  entities: RuntimeEntityRecord[],
  locationId: string,
  intentType: string,
  targetActorId: string,
  limit: number,
): Array<Record<string, unknown>> {
  return entities
    .map((entity) => ({ entity, score: entityProjectionScore(entity, locationId, intentType, targetActorId) }))
    .filter((item) => item.score >= 20)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.entity);
}

function eventProjectionScore(eventRecord: Record<string, unknown>, locationId: string, intentType: string): number {
  const status = safeString(eventRecord.status).toLowerCase();
  if (status === "archive" || status === "archived") return -1;
  let score = 0;
  if (status === "actif" || status === "active") score += 40;
  if (status === "pertinent" || status === "relevant") score += 25;
  const eventLocationId =
    safeString(eventRecord.location_id) ||
    safeString((eventRecord.final as Record<string, unknown> | undefined)?.location_id);
  if (locationId && eventLocationId === locationId) score += 35;
  score += intentWeight(intentType, 0, {
    attempt_forbidden: 20,
    ask_info: 10,
    talk: 5,
  });
  return score;
}

function selectProjectedEvents(
  events: Array<Record<string, unknown>>,
  locationId: string,
  intentType: string,
): Array<Record<string, unknown>> {
  return events
    .map((eventRecord) => ({ eventRecord, score: eventProjectionScore(eventRecord, locationId, intentType) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, intentType === "observe" ? 6 : 8)
    .map((item) => item.eventRecord);
}

function knowledgeProjectionScore(entry: Record<string, unknown>, locationId: string, intentType: string): number {
  const haystack = safeString(entry.text || entry.fact || entry.summary).toLowerCase();
  const knowledgeKind = safeString(entry.knowledge_kind).toLowerCase();
  const certainty = safeString(entry.certainty).toLowerCase();
  const source = safeString(entry.source).toLowerCase();
  let score = 1;
  if (locationId && haystack.includes(locationId.toLowerCase())) score += 10;
  if (locationId && safeString(entry.location_id) === locationId) score += 15;
  if (certainty === "solid") score += 8;
  if (certainty === "partial") score += 4;
  if (certainty === "tentative") score += 1;
  if (source === "runtime") score += 3;
  if (source === "auto_narration") score += 2;
  if (knowledgeKind === "lead") {
    score += intentType === "ask_info" ? 9 : 3;
  } else if (
    knowledgeKind === "fact_seen" ||
    knowledgeKind === "fact_heard" ||
    knowledgeKind === "fact_learned" ||
    knowledgeKind === "visited_location" ||
    knowledgeKind === "met_actor" ||
    knowledgeKind === "notable_element"
  ) {
    score += 8;
  } else if (knowledgeKind === "summary") {
    score += 5;
  } else if (knowledgeKind === "player_hypothesis") {
    score -= 6;
  } else if (knowledgeKind === "player_note") {
    score -= 2;
  }
  score += intentWeight(intentType, 0, {
    ask_info: 8,
    observe: 4,
    talk: 6,
  });
  return score;
}

function selectProjectedKnowledge(
  entries: Array<Record<string, unknown>>,
  locationId: string,
  intentType: string,
  limit: number,
): Array<Record<string, unknown>> {
  return entries
    .map((entry) => ({ entry, score: knowledgeProjectionScore(entry, locationId, intentType) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

function relationProjectionScore(relation: Record<string, unknown>, locationId: string, targetActorId: string, intentType: string): number {
  let score = 1;
  const relationLocationId = safeString(relation.location_id);
  if (locationId && relationLocationId === locationId) score += 20;
  const entities = Array.isArray(relation.entity_ids) ? relation.entity_ids.map((item) => safeString(item)) : [];
  if (targetActorId && entities.includes(targetActorId)) score += 40;
  score += intentWeight(intentType, 0, {
    talk: 12,
    ask_info: 8,
  });
  return score;
}

function selectProjectedRelations(
  relations: Array<Record<string, unknown>>,
  locationId: string,
  targetActorId: string,
  intentType: string,
): Array<Record<string, unknown>> {
  return relations
    .map((relation) => ({
      relation,
      score: relationProjectionScore(relation, locationId, targetActorId, intentType),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, intentType === "talk" ? 10 : 6)
    .map((item) => item.relation);
}

export function projectMemory(input: ProjectionInput): ProjectedMemory {
  const locationId = safeString(input.localContext.location_id);
  const intentType = safeString(input.localContext.intent_type || input.localContext.intent_hint).toLowerCase();
  const targetActorId = safeString(input.localContext.target_actor_id);
  const truthSnapshot = resolveEffectiveTruth(input);
  const effectiveWorldState = truthSnapshot.effective_world_state;

  const actorEntities = Object.values(input.campaignMemory.entity_registry.actors ?? {});
  const locationEntities = Object.values(input.campaignMemory.entity_registry.locations ?? {});
  const objectEntities = Object.values(input.campaignMemory.entity_registry.objects ?? {});

  return {
    truth_snapshot: truthSnapshot,
    effective_world_state: effectiveWorldState,
    projected_units: {
      events: selectProjectedEvents(toRecordArray(input.campaignMemory.events), locationId, intentType),
      relations: selectProjectedRelations(
        toRecordArray(input.campaignMemory.relations),
        locationId,
        targetActorId,
        intentType,
      ),
      knowledge_player_view: selectProjectedKnowledge(
        toRecordArray(input.campaignMemory.knowledge.player_view),
        locationId,
        intentType,
        10,
      ),
      knowledge_truth_view: selectProjectedKnowledge(
        toRecordArray(input.campaignMemory.knowledge.truth_view),
        locationId,
        intentType,
        10,
      ),
      entity_registry: {
        actors: selectProjectedEntities(actorEntities, locationId, intentType, targetActorId, intentType === "talk" ? 10 : 8),
        locations: selectProjectedEntities(locationEntities, locationId, intentType, targetActorId, intentType === "move_local" ? 6 : 4),
        objects: selectProjectedEntities(objectEntities, locationId, intentType, targetActorId, intentType === "observe" ? 10 : 8),
      },
    },
  };
}
