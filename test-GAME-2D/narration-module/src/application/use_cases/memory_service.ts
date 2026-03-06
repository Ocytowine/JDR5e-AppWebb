import { JsonMemoryStore } from "../../adapters/db/memory_store";
import {
  addFragment,
  createNarrationEvent,
  transitionEventState,
  transitionFragmentState,
  updateEvolutiveFragmentPayload,
} from "../../domain/events/event_engine";
import { LifecycleState, NarrationEvent } from "../../domain/events/event_types";
import { projectMemory, ProjectedMemory } from "../../domain/memory/memory_projection";
import {
  CampaignMemory,
  PlayerKnowledgeRecord,
  RuntimeEntityMemoryState,
  RuntimeEntityRecord,
  RuntimeEntityScope,
  RuntimeEntityStatus,
  RuntimeEntityType,
} from "../../domain/memory/memory_types";
import { EffectiveTruthSnapshot, resolveEffectiveTruth } from "../../domain/memory/truth_resolution";

export class MemoryService {
  private store: JsonMemoryStore;

  constructor(store: JsonMemoryStore) {
    this.store = store;
  }

  setWikiWorldState(worldState: Record<string, unknown>): void {
    this.store.setWikiWorldState(worldState);
  }

  getCampaign(campaignId: string): CampaignMemory {
    return this.store.loadCampaign(campaignId);
  }

  getCurrentTurnIndex(campaignId: string): number {
    const campaign = this.store.loadCampaign(campaignId);
    return Number(campaign.clock?.turn_index ?? 0);
  }

  advanceCampaignTurn(campaignId: string, turnId: string): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const currentTurnIndex = Number(campaign.clock?.turn_index ?? 0);
    campaign.clock = {
      turn_index: Number.isFinite(currentTurnIndex) ? currentTurnIndex + 1 : 1,
    };
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  getEntity(campaignId: string, entityId: string): RuntimeEntityRecord | null {
    const campaign = this.store.loadCampaign(campaignId);
    return this.findEntityInCampaign(campaign, entityId);
  }

  getVisibleActorIdsAtLocation(campaignId: string, locationId: string): string[] {
    const locationEntity = this.getEntity(campaignId, locationId);
    if (!locationEntity || locationEntity.entity_type !== "location") return [];
    const payload = locationEntity.payload && typeof locationEntity.payload === "object"
      ? locationEntity.payload as Record<string, unknown>
      : {};
    const visibleActors = Array.isArray(payload.visible_actors)
      ? (payload.visible_actors as unknown[])
      : [];
    return visibleActors
      .map((item: unknown) => String(item ?? "").trim())
      .filter(Boolean);
  }

  ensureVisibleActorAtLocation(
    campaignId: string,
    locationId: string,
    actorId: string,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const normalizedLocationId = String(locationId ?? "").trim();
    const normalizedActorId = String(actorId ?? "").trim();
    if (!normalizedLocationId || !normalizedActorId) return campaign;

    const existingLocation =
      campaign.entity_registry.locations[normalizedLocationId] ??
      null;

    const locationEntity = existingLocation
      ? this.normalizeEntity(existingLocation, turnId, Number(campaign.clock?.turn_index ?? 0))
      : this.normalizeEntity(
          {
            entity_id: normalizedLocationId,
            entity_type: "location",
            subtype: "scene_anchor",
            display_name: normalizedLocationId,
            memory_state: "active",
            status: "active",
            scope: "situational",
            created_at_turn: turnId,
            updated_at_turn: turnId,
            last_seen_turn: turnId,
            location_id: normalizedLocationId,
            source: {
              created_by: "runtime",
              reason: "location_visible_actors_tracking",
            },
            visibility: {
              player_known: true,
              truth_known: true,
            },
            links: {
              event_ids: [],
              related_entity_ids: [],
              faction_ids: [],
            },
            payload: {
              visible_actors: [],
              active_points_of_interest: [],
              connected_locations: [],
              scene_payload: {
                ambient_markers: [],
                visible_exits: [],
                visible_actors: [],
                active_points_of_interest: [],
              },
            },
            lifecycle_policy: {
              archive_when_inactive: true,
            },
            lifecycle_history: [],
          } as RuntimeEntityRecord,
          turnId,
          Number(campaign.clock?.turn_index ?? 0),
        );

    const payload = locationEntity.payload && typeof locationEntity.payload === "object"
      ? locationEntity.payload as Record<string, unknown>
      : {};
    const scenePayload =
      payload.scene_payload && typeof payload.scene_payload === "object"
        ? payload.scene_payload as Record<string, unknown>
        : {};
    const visibleActors = Array.isArray(payload.visible_actors)
      ? (payload.visible_actors as unknown[])
          .map((item: unknown) => String(item ?? "").trim())
          .filter(Boolean)
      : [];
    if (!visibleActors.includes(normalizedActorId)) {
      visibleActors.push(normalizedActorId);
    }
    locationEntity.payload = {
      ...payload,
      visible_actors: visibleActors,
      scene_payload: {
        ...scenePayload,
        visible_actors: visibleActors,
        active_points_of_interest: Array.isArray(scenePayload.active_points_of_interest)
          ? scenePayload.active_points_of_interest
          : [],
        ambient_markers: Array.isArray(scenePayload.ambient_markers)
          ? scenePayload.ambient_markers
          : [],
        visible_exits: Array.isArray(scenePayload.visible_exits)
          ? scenePayload.visible_exits
          : [],
      },
    };
    locationEntity.memory_state = "active";
    locationEntity.updated_at_turn = turnId;
    locationEntity.last_seen_turn = turnId;
    locationEntity.last_seen_turn_index = Number(campaign.clock?.turn_index ?? 0);
    campaign.entity_registry.locations[normalizedLocationId] = locationEntity;
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  ensureLocationRuntimeState(
    campaignId: string,
    locationId: string,
    seed: {
      display_name?: string | null;
      subtype?: string | null;
      connected_locations?: string[] | null;
      active_points_of_interest?: string[] | null;
      ambient_markers?: string[] | null;
      visible_exits?: Array<Record<string, unknown>> | null;
    },
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const normalizedLocationId = String(locationId ?? "").trim();
    if (!normalizedLocationId) return campaign;
    const currentTurnIndex = Number(campaign.clock?.turn_index ?? 0);

    const existingLocation =
      campaign.entity_registry.locations[normalizedLocationId] ??
      null;
    const locationEntity = existingLocation
      ? this.normalizeEntity(existingLocation, turnId, currentTurnIndex)
      : this.normalizeEntity(
          {
            entity_id: normalizedLocationId,
            entity_type: "location",
            subtype: String(seed.subtype ?? "scene_anchor").trim() || "scene_anchor",
            display_name: String(seed.display_name ?? normalizedLocationId).trim() || normalizedLocationId,
            memory_state: "active",
            status: "active",
            scope: "situational",
            created_at_turn: turnId,
            updated_at_turn: turnId,
            last_seen_turn: turnId,
            location_id: normalizedLocationId,
            source: {
              created_by: "runtime",
              reason: "location_runtime_state",
            },
            visibility: {
              player_known: true,
              truth_known: true,
            },
            links: {
              event_ids: [],
              related_entity_ids: [],
              faction_ids: [],
            },
            payload: {
              visible_actors: [],
              active_points_of_interest: [],
              connected_locations: [],
              scene_payload: {
                ambient_markers: [],
                visible_exits: [],
                visible_actors: [],
                active_points_of_interest: [],
              },
            },
            lifecycle_policy: {
              archive_when_inactive: true,
            },
            lifecycle_history: [],
          } as RuntimeEntityRecord,
          turnId,
          currentTurnIndex,
        );

    const payload = locationEntity.payload && typeof locationEntity.payload === "object"
      ? locationEntity.payload as Record<string, unknown>
      : {};
    const scenePayload =
      payload.scene_payload && typeof payload.scene_payload === "object"
        ? payload.scene_payload as Record<string, unknown>
        : {};
    const currentVisibleActors = Array.isArray(payload.visible_actors)
      ? (payload.visible_actors as unknown[]).map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
      : [];
    const connectedLocations = Array.isArray(seed.connected_locations)
      ? seed.connected_locations.map((item) => String(item ?? "").trim()).filter(Boolean)
      : (Array.isArray(payload.connected_locations)
        ? (payload.connected_locations as unknown[]).map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
        : []);
    const activePointsOfInterest = Array.isArray(seed.active_points_of_interest)
      ? seed.active_points_of_interest.map((item) => String(item ?? "").trim()).filter(Boolean)
      : (Array.isArray(payload.active_points_of_interest)
        ? (payload.active_points_of_interest as unknown[]).map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
        : []);
    const ambientMarkers = Array.isArray(seed.ambient_markers)
      ? seed.ambient_markers.map((item) => String(item ?? "").trim()).filter(Boolean)
      : (Array.isArray(scenePayload.ambient_markers)
        ? (scenePayload.ambient_markers as unknown[]).map((item: unknown) => String(item ?? "").trim()).filter(Boolean)
        : []);
    const visibleExits = Array.isArray(seed.visible_exits)
      ? seed.visible_exits
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
          .map((item) => ({
            exit_id: String(item.exit_id ?? "").trim(),
            label_visible: String(item.label_visible ?? "").trim(),
            destination_id: String(item.destination_id ?? "").trim(),
            access_state: String(item.access_state ?? "").trim() || "open",
            guarded: Boolean(item.guarded),
          }))
          .filter((item) => item.exit_id && item.destination_id)
      : (Array.isArray(scenePayload.visible_exits)
        ? scenePayload.visible_exits
        : []);

    locationEntity.display_name =
      String(seed.display_name ?? locationEntity.display_name ?? normalizedLocationId).trim() || normalizedLocationId;
    locationEntity.subtype =
      String(seed.subtype ?? locationEntity.subtype ?? "scene_anchor").trim() || "scene_anchor";
    locationEntity.memory_state = "active";
    locationEntity.updated_at_turn = turnId;
    locationEntity.last_seen_turn = turnId;
    locationEntity.last_seen_turn_index = currentTurnIndex;
    locationEntity.payload = {
      ...payload,
      visible_actors: currentVisibleActors,
      connected_locations: connectedLocations,
      active_points_of_interest: activePointsOfInterest,
      scene_payload: {
        ...scenePayload,
        ambient_markers: ambientMarkers,
        visible_exits: visibleExits,
        visible_actors: currentVisibleActors,
        active_points_of_interest: activePointsOfInterest,
      },
    };
    campaign.entity_registry.locations[normalizedLocationId] = locationEntity;
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  findEntitiesByType(campaignId: string, entityType: RuntimeEntityType): RuntimeEntityRecord[] {
    const campaign = this.store.loadCampaign(campaignId);
    const ids = campaign.entity_registry.indexes.by_type[entityType] ?? [];
    return ids
      .map((entityId) => this.findEntityInCampaign(campaign, entityId))
      .filter((entity): entity is RuntimeEntityRecord => Boolean(entity));
  }

  findEntitiesByLocation(campaignId: string, locationId: string): RuntimeEntityRecord[] {
    const campaign = this.store.loadCampaign(campaignId);
    const ids = campaign.entity_registry.indexes.by_location_id[locationId] ?? [];
    return ids
      .map((entityId) => this.findEntityInCampaign(campaign, entityId))
      .filter((entity): entity is RuntimeEntityRecord => Boolean(entity));
  }

  findEntitiesLinkedToEvent(campaignId: string, eventId: string): RuntimeEntityRecord[] {
    const campaign = this.store.loadCampaign(campaignId);
    const ids = campaign.entity_registry.indexes.by_event_id[eventId] ?? [];
    return ids
      .map((entityId) => this.findEntityInCampaign(campaign, entityId))
      .filter((entity): entity is RuntimeEntityRecord => Boolean(entity));
  }

  upsertEntity(
    campaignId: string,
    entity: RuntimeEntityRecord,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const normalized = this.normalizeEntity(entity, turnId, Number(campaign.clock?.turn_index ?? 0));
    const bucket = this.getRegistryBucket(campaign, normalized.entity_type);
    bucket[normalized.entity_id] = normalized;
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  markEntitySeen(campaignId: string, entityId: string, turnId: string): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const entity = this.requireEntity(campaign, entityId);
    entity.last_seen_turn = turnId;
    entity.last_seen_turn_index = Number(campaign.clock?.turn_index ?? 0);
    if (entity.memory_state !== "archived") {
      entity.memory_state = "active";
    }
    entity.updated_at_turn = turnId;
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  setEntityMemoryState(
    campaignId: string,
    entityId: string,
    nextMemoryState: RuntimeEntityMemoryState,
    turnId: string,
    reason: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const entity = this.requireEntity(campaign, entityId);
    const previous = entity.memory_state ?? this.deriveMemoryStateFromStatus(entity.status);
    entity.memory_state = nextMemoryState;
    entity.updated_at_turn = turnId;
    entity.lifecycle_history = Array.isArray(entity.lifecycle_history) ? entity.lifecycle_history : [];
    entity.lifecycle_history.push({
      transition_kind: "memory_state",
      from: previous,
      to: nextMemoryState,
      turn_id: turnId,
      reason,
    });
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  promoteEntityScope(
    campaignId: string,
    entityId: string,
    nextScope: RuntimeEntityScope,
    turnId: string,
    reason: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const entity = this.requireEntity(campaign, entityId);
    const previous = entity.scope;
    entity.scope = nextScope;
    entity.updated_at_turn = turnId;
    entity.lifecycle_history = Array.isArray(entity.lifecycle_history) ? entity.lifecycle_history : [];
    entity.lifecycle_history.push({
      from: previous,
      to: nextScope,
      turn_id: turnId,
      reason,
    });
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  archiveEntity(campaignId: string, entityId: string, turnId: string, reason: string): CampaignMemory {
    return this.transitionEntityStatus(campaignId, entityId, "archived", turnId, reason);
  }

  expireEntity(campaignId: string, entityId: string, turnId: string, reason: string): CampaignMemory {
    return this.transitionEntityStatus(campaignId, entityId, "expired", turnId, reason);
  }

  cleanupExpiredEntities(campaignId: string, currentTurnNumber: number, turnId: string): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const entities = this.collectEntities(campaign);
    let touched = false;
    for (const entity of entities) {
      if (entity.status === "archived" || entity.status === "expired") continue;
      const ttlTurns = Number(entity.lifecycle_policy?.ttl_turns ?? 0);
      if (!Number.isFinite(ttlTurns) || ttlTurns <= 0) continue;
      const lastSeenTurnNumber = Number(entity.last_seen_turn_index);
      if (!Number.isFinite(lastSeenTurnNumber)) continue;
      if (currentTurnNumber - lastSeenTurnNumber < ttlTurns) continue;
      const linkedEventIds = Array.isArray(entity.links?.event_ids) ? entity.links.event_ids : [];
      const hasBlockingEvent = linkedEventIds.some((eventId) => this.isEventActive(campaign, eventId));
      if (hasBlockingEvent) continue;
      entity.status = "expired";
      entity.memory_state = "archived";
      entity.updated_at_turn = turnId;
      entity.lifecycle_history = Array.isArray(entity.lifecycle_history) ? entity.lifecycle_history : [];
      entity.lifecycle_history.push({
        transition_kind: "status",
        from: "active",
        to: "expired",
        turn_id: turnId,
        reason: "ttl_elapsed",
      });
      touched = true;
    }
    if (touched) {
      campaign.updated_at_turn = turnId;
      this.store.saveCampaign(campaign);
    }
    return campaign;
  }

  setWorldOverride(
    campaignId: string,
    key: string,
    value: unknown,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    campaign.world_overrides[key] = value;
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  appendEvent(
    campaignId: string,
    eventPayload: Record<string, unknown>,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    campaign.events.push(eventPayload);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  createNarrationEvent(
    campaignId: string,
    payload: {
      event_id: string;
      origin_trigger_id: string;
      created_at_turn: string;
      final: Record<string, unknown>;
    },
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = createNarrationEvent(payload);
    campaign.events.push(event as unknown as Record<string, unknown>);
    campaign.updated_at_turn = payload.created_at_turn;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  transitionNarrationEventState(
    campaignId: string,
    eventId: string,
    nextState: LifecycleState,
    turnId: string,
    reason: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = this.findEvent(campaign, eventId);
    transitionEventState(event, nextState, turnId, reason);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  addNarrationEventFragment(
    campaignId: string,
    eventId: string,
    fragment: {
      fragment_id: string;
      kind: "ponctuel" | "persistant" | "evolutif";
      payload: Record<string, unknown>;
      final_refs: string[];
    },
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = this.findEvent(campaign, eventId);
    addFragment(event, fragment, turnId);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  transitionNarrationFragmentState(
    campaignId: string,
    eventId: string,
    fragmentId: string,
    nextState: LifecycleState,
    turnId: string,
    reason: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = this.findEvent(campaign, eventId);
    transitionFragmentState(event, fragmentId, nextState, turnId, reason);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  patchEvolutiveFragment(
    campaignId: string,
    eventId: string,
    fragmentId: string,
    patch: Record<string, unknown>,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const event = this.findEvent(campaign, eventId);
    updateEvolutiveFragmentPayload(event, fragmentId, patch, turnId);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  appendKnowledgePlayerView(
    campaignId: string,
    item: Record<string, unknown>,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const normalized = this.normalizePlayerKnowledgeRecord(item, turnId);
    if (normalized) {
      campaign.knowledge.player_view.push(normalized);
    }
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  appendAutoPlayerSummary(
    campaignId: string,
    params: {
      turn_id?: string | null;
      text: string;
      location_id?: string | null;
      linked_entity_ids?: string[];
      tags?: string[];
    },
    turnId: string,
  ): CampaignMemory {
    return this.appendKnowledgePlayerView(
      campaignId,
      {
        turn_id: params.turn_id ?? turnId,
        text: params.text,
        knowledge_kind: "summary",
        certainty: "partial",
        source: "auto_narration",
        location_id: params.location_id ?? null,
        linked_entity_ids: params.linked_entity_ids ?? [],
        tags: params.tags ?? [],
      },
      turnId,
    );
  }

  appendAutoPlayerLead(
    campaignId: string,
    params: {
      turn_id?: string | null;
      text: string;
      location_id?: string | null;
      linked_entity_ids?: string[];
      tags?: string[];
    },
    turnId: string,
  ): CampaignMemory {
    return this.appendKnowledgePlayerView(
      campaignId,
      {
        turn_id: params.turn_id ?? turnId,
        text: params.text,
        knowledge_kind: "lead",
        certainty: "tentative",
        source: "auto_narration",
        location_id: params.location_id ?? null,
        linked_entity_ids: params.linked_entity_ids ?? [],
        tags: params.tags ?? [],
      },
      turnId,
    );
  }

  appendKnowledgeTruthView(
    campaignId: string,
    item: Record<string, unknown>,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    campaign.knowledge.truth_view.push(item);
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  project(campaignId: string, localContext: Record<string, unknown>): ProjectedMemory {
    const wikiWorldState = this.store.getWikiWorldState();
    const campaignMemory = this.store.loadCampaign(campaignId);
    return projectMemory({
      wikiWorldState,
      campaignMemory,
      localContext,
    });
  }

  buildRuntimeStateBefore(campaignId: string, localContext: Record<string, unknown>): Record<string, unknown> {
    const campaign = this.store.loadCampaign(campaignId);
    const truth = this.resolveEffectiveTruth(campaignId, localContext);
    return {
      ...truth.effective_world_state,
      location_id: localContext.location_id ?? truth.effective_world_state.location_id ?? null,
      world_flags: Array.isArray(campaign.world_overrides?.world_flags)
        ? campaign.world_overrides.world_flags
        : [],
      journal: Array.isArray(campaign.knowledge?.player_view)
        ? campaign.knowledge.player_view
        : [],
      events: Array.isArray(campaign.events) ? campaign.events : [],
    };
  }

  syncCampaignFromRuntimeState(
    campaignId: string,
    stateAfter: Record<string, unknown> | null | undefined,
    turnId: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    campaign.events = Array.isArray(stateAfter?.events)
      ? (stateAfter.events as Array<Record<string, unknown>>)
      : campaign.events;
    campaign.world_overrides = {
      ...campaign.world_overrides,
      location_id: stateAfter?.location_id ?? campaign.world_overrides.location_id ?? null,
    };
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  resolveEffectiveTruth(campaignId: string, localContext: Record<string, unknown>): EffectiveTruthSnapshot {
    const wikiWorldState = this.store.getWikiWorldState();
    const campaignMemory = this.store.loadCampaign(campaignId);
    return resolveEffectiveTruth({
      wikiWorldState,
      campaignMemory,
      localContext,
    });
  }

  private findEvent(campaign: CampaignMemory, eventId: string): NarrationEvent {
    const event = campaign.events.find((e) => (e as Record<string, unknown>).event_id === eventId);
    if (!event) {
      throw new Error(`event not found: ${eventId}`);
    }
    return event as unknown as NarrationEvent;
  }

  private transitionEntityStatus(
    campaignId: string,
    entityId: string,
    nextStatus: RuntimeEntityStatus,
    turnId: string,
    reason: string,
  ): CampaignMemory {
    const campaign = this.store.loadCampaign(campaignId);
    const entity = this.requireEntity(campaign, entityId);
    const previous = entity.status;
    entity.status = nextStatus;
    if (nextStatus === "archived" || nextStatus === "expired") {
      entity.memory_state = "archived";
    } else if (!entity.memory_state || entity.memory_state === "archived") {
      entity.memory_state = "active";
    }
    entity.updated_at_turn = turnId;
    entity.lifecycle_history = Array.isArray(entity.lifecycle_history) ? entity.lifecycle_history : [];
    entity.lifecycle_history.push({
      transition_kind: "status",
      from: previous,
      to: nextStatus,
      turn_id: turnId,
      reason,
    });
    campaign.updated_at_turn = turnId;
    this.store.saveCampaign(campaign);
    return campaign;
  }

  private normalizeEntity(entity: RuntimeEntityRecord, turnId: string, currentTurnIndex: number): RuntimeEntityRecord {
    const normalizedTurnIndex = Number.isFinite(currentTurnIndex) ? currentTurnIndex : 0;
    const normalizedStatus = entity.status ?? "active";
    return {
      ...entity,
      entity_id: String(entity.entity_id ?? "").trim(),
      entity_type: entity.entity_type,
      subtype: String(entity.subtype ?? "").trim(),
      display_name: String(entity.display_name ?? "").trim() || String(entity.entity_id ?? "").trim(),
      memory_state:
        entity.memory_state ?? this.deriveMemoryStateFromStatus(normalizedStatus),
      status: normalizedStatus,
      scope: entity.scope ?? "ephemeral",
      created_at_turn: entity.created_at_turn ?? turnId,
      updated_at_turn: turnId,
      last_seen_turn: entity.last_seen_turn ?? turnId,
      first_seen_turn_index:
        Number.isFinite(Number(entity.first_seen_turn_index))
          ? Number(entity.first_seen_turn_index)
          : normalizedTurnIndex,
      last_seen_turn_index:
        Number.isFinite(Number(entity.last_seen_turn_index))
          ? Number(entity.last_seen_turn_index)
          : normalizedTurnIndex,
      location_id: entity.location_id ?? null,
      source: entity.source && typeof entity.source === "object" ? entity.source : {},
      visibility: entity.visibility && typeof entity.visibility === "object" ? entity.visibility : {},
      links: {
        event_ids: Array.isArray(entity.links?.event_ids) ? entity.links.event_ids : [],
        related_entity_ids: Array.isArray(entity.links?.related_entity_ids) ? entity.links.related_entity_ids : [],
        faction_ids: Array.isArray(entity.links?.faction_ids) ? entity.links.faction_ids : [],
      },
      payload: entity.payload && typeof entity.payload === "object" ? entity.payload : {},
      lifecycle_policy:
        entity.lifecycle_policy && typeof entity.lifecycle_policy === "object"
          ? entity.lifecycle_policy
          : {},
      lifecycle_history: Array.isArray(entity.lifecycle_history) ? entity.lifecycle_history : [],
    };
  }

  private deriveMemoryStateFromStatus(status: RuntimeEntityStatus): RuntimeEntityMemoryState {
    if (status === "archived" || status === "expired") return "archived";
    if (status === "dormant") return "dormant";
    return "active";
  }

  private getRegistryBucket(
    campaign: CampaignMemory,
    entityType: RuntimeEntityType,
  ): Record<string, RuntimeEntityRecord> {
    if (entityType === "actor") return campaign.entity_registry.actors;
    if (entityType === "location") return campaign.entity_registry.locations;
    return campaign.entity_registry.objects;
  }

  private findEntityInCampaign(campaign: CampaignMemory, entityId: string): RuntimeEntityRecord | null {
    const normalizedId = String(entityId ?? "").trim();
    if (!normalizedId) return null;
    return (
      campaign.entity_registry.actors[normalizedId] ??
      campaign.entity_registry.locations[normalizedId] ??
      campaign.entity_registry.objects[normalizedId] ??
      null
    );
  }

  private requireEntity(campaign: CampaignMemory, entityId: string): RuntimeEntityRecord {
    const entity = this.findEntityInCampaign(campaign, entityId);
    if (!entity) {
      throw new Error(`entity not found: ${entityId}`);
    }
    return entity;
  }

  private collectEntities(campaign: CampaignMemory): RuntimeEntityRecord[] {
    return [
      ...Object.values(campaign.entity_registry.actors),
      ...Object.values(campaign.entity_registry.locations),
      ...Object.values(campaign.entity_registry.objects),
    ];
  }

  private isEventActive(campaign: CampaignMemory, eventId: string): boolean {
    const event = campaign.events.find((item) => String((item as Record<string, unknown>)?.event_id ?? "") === eventId);
    if (!event) return false;
    const status = String((event as Record<string, unknown>)?.status ?? "actif").toLowerCase();
    return status !== "archive" && status !== "archived";
  }

  private normalizePlayerKnowledgeRecord(
    item: Record<string, unknown>,
    turnId: string,
  ): PlayerKnowledgeRecord | null {
    const text = String(item?.text ?? item?.summary ?? item?.fact ?? item?.note ?? "").trim();
    if (!text) return null;

    const knowledgeKind = this.normalizePlayerKnowledgeKind(item?.knowledge_kind ?? item?.kind);
    const certainty = this.normalizePlayerKnowledgeCertainty(item?.certainty);
    const source = this.normalizePlayerKnowledgeSource(item?.source);
    const turnIdValue = String(item?.turn_id ?? turnId).trim() || turnId;
    const locationId = String(item?.location_id ?? "").trim() || null;
    const linkedEntityIds = Array.isArray(item?.linked_entity_ids)
      ? item.linked_entity_ids.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : [];
    const tags = Array.isArray(item?.tags)
      ? item.tags.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : [];

    return {
      ...item,
      turn_id: turnIdValue,
      text,
      knowledge_kind: knowledgeKind,
      certainty,
      source,
      location_id: locationId,
      linked_entity_ids: linkedEntityIds,
      tags,
    };
  }

  private normalizePlayerKnowledgeKind(value: unknown): PlayerKnowledgeRecord["knowledge_kind"] {
    const normalized = String(value ?? "").trim().toLowerCase();
    const allowed: PlayerKnowledgeRecord["knowledge_kind"][] = [
      "fact_seen",
      "fact_heard",
      "fact_learned",
      "visited_location",
      "met_actor",
      "notable_element",
      "summary",
      "lead",
      "player_note",
      "player_hypothesis",
    ];
    return allowed.includes(normalized as PlayerKnowledgeRecord["knowledge_kind"])
      ? (normalized as PlayerKnowledgeRecord["knowledge_kind"])
      : "summary";
  }

  private normalizePlayerKnowledgeCertainty(value: unknown): PlayerKnowledgeRecord["certainty"] {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "solid" || normalized === "tentative") return normalized;
    return "partial";
  }

  private normalizePlayerKnowledgeSource(value: unknown): PlayerKnowledgeRecord["source"] {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "player_manual" || normalized === "runtime") return normalized;
    return "auto_narration";
  }
}
