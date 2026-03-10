import fs from "node:fs";
import path from "node:path";

import {
  CampaignMemory,
  EntityRegistry,
  MemoryStoreData,
  PlayerKnowledgeRecord,
  RuntimeEntityRecord,
} from "../../domain/memory/memory_types";

function defaultEntityRegistry(): EntityRegistry {
  return {
    actors: {},
    locations: {},
    objects: {},
    indexes: {
      by_type: {},
      by_memory_state: {},
      by_location_id: {},
      by_event_id: {},
      by_scope: {},
      by_status: {},
    },
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function collectRegistryRecords(registry: EntityRegistry): RuntimeEntityRecord[] {
  return [
    ...Object.values(registry.actors),
    ...Object.values(registry.locations),
    ...Object.values(registry.objects),
  ];
}

function rebuildEntityRegistryIndexes(registry: EntityRegistry): EntityRegistry {
  const nextRegistry: EntityRegistry = {
    actors: registry.actors ?? {},
    locations: registry.locations ?? {},
    objects: registry.objects ?? {},
    indexes: {
      by_type: {},
      by_memory_state: {},
      by_location_id: {},
      by_event_id: {},
      by_scope: {},
      by_status: {},
    },
  };

  for (const entity of collectRegistryRecords(nextRegistry)) {
    const entityId = String(entity?.entity_id ?? "").trim();
    if (!entityId) continue;
    const entityType = String(entity?.entity_type ?? "").trim();
    const memoryState = String(entity?.memory_state ?? "").trim();
    const scope = String(entity?.scope ?? "").trim();
    const status = String(entity?.status ?? "").trim();
    const locationId = String(entity?.location_id ?? "").trim();
    const eventIds = Array.isArray(entity?.links?.event_ids)
      ? entity.links.event_ids.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];

    if (entityType) {
      nextRegistry.indexes.by_type[entityType] = uniqueSorted([
        ...(nextRegistry.indexes.by_type[entityType] ?? []),
        entityId,
      ]);
    }
    if (memoryState) {
      nextRegistry.indexes.by_memory_state[memoryState] = uniqueSorted([
        ...(nextRegistry.indexes.by_memory_state[memoryState] ?? []),
        entityId,
      ]);
    }
    if (scope) {
      nextRegistry.indexes.by_scope[scope] = uniqueSorted([
        ...(nextRegistry.indexes.by_scope[scope] ?? []),
        entityId,
      ]);
    }
    if (status) {
      nextRegistry.indexes.by_status[status] = uniqueSorted([
        ...(nextRegistry.indexes.by_status[status] ?? []),
        entityId,
      ]);
    }
    if (locationId) {
      nextRegistry.indexes.by_location_id[locationId] = uniqueSorted([
        ...(nextRegistry.indexes.by_location_id[locationId] ?? []),
        entityId,
      ]);
    }
    for (const eventId of eventIds) {
      nextRegistry.indexes.by_event_id[eventId] = uniqueSorted([
        ...(nextRegistry.indexes.by_event_id[eventId] ?? []),
        entityId,
      ]);
    }
  }

  return nextRegistry;
}

function normalizeCampaignMemory(campaign: CampaignMemory): CampaignMemory {
  return {
    ...campaign,
    clock: {
      turn_index: Number.isFinite(Number(campaign?.clock?.turn_index))
        ? Number(campaign.clock.turn_index)
        : 0,
    },
    events: Array.isArray(campaign?.events) ? campaign.events : [],
    relations: Array.isArray(campaign?.relations) ? campaign.relations : [],
    knowledge: {
      player_view: normalizePlayerKnowledgeView(campaign?.knowledge?.player_view),
      truth_view: Array.isArray(campaign?.knowledge?.truth_view) ? campaign.knowledge.truth_view : [],
    },
    world_overrides:
      campaign?.world_overrides && typeof campaign.world_overrides === "object"
        ? campaign.world_overrides
        : {},
    entity_registry: rebuildEntityRegistryIndexes(
      campaign?.entity_registry && typeof campaign.entity_registry === "object"
        ? {
            actors: campaign.entity_registry.actors ?? {},
            locations: campaign.entity_registry.locations ?? {},
            objects: campaign.entity_registry.objects ?? {},
            indexes: campaign.entity_registry.indexes ?? defaultEntityRegistry().indexes,
          }
        : defaultEntityRegistry()
    ),
    updated_at_turn: campaign?.updated_at_turn ?? null,
  };
}

function normalizeLooseString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeLooseString(item))
    .filter(Boolean);
}

function normalizePlayerKnowledgeRecord(value: unknown): PlayerKnowledgeRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const text = normalizeLooseString(raw.text ?? raw.summary ?? raw.fact ?? raw.note);
  if (!text) return null;

  const kindRaw = normalizeLooseString(raw.knowledge_kind || raw.kind).toLowerCase();
  const certaintyRaw = normalizeLooseString(raw.certainty).toLowerCase();
  const sourceRaw = normalizeLooseString(raw.source).toLowerCase();
  const allowedKinds = new Set([
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
  ]);
  const allowedCertainties = new Set(["solid", "partial", "tentative"]);
  const allowedSources = new Set(["auto_narration", "player_manual", "runtime"]);

  const knowledgeKind = allowedKinds.has(kindRaw) ? kindRaw : "summary";
  const certainty = allowedCertainties.has(certaintyRaw) ? certaintyRaw : "partial";
  const source = allowedSources.has(sourceRaw) ? sourceRaw : "auto_narration";

  return {
    ...raw,
    turn_id: normalizeLooseString(raw.turn_id) || null,
    text,
    knowledge_kind: knowledgeKind as PlayerKnowledgeRecord["knowledge_kind"],
    certainty: certainty as PlayerKnowledgeRecord["certainty"],
    source: source as PlayerKnowledgeRecord["source"],
    location_id: normalizeLooseString(raw.location_id) || null,
    linked_entity_ids: normalizeStringArray(raw.linked_entity_ids),
    tags: normalizeStringArray(raw.tags),
  };
}

function normalizePlayerKnowledgeView(value: unknown): PlayerKnowledgeRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizePlayerKnowledgeRecord(entry))
    .filter((entry): entry is PlayerKnowledgeRecord => Boolean(entry));
}

function defaultCampaignMemory(campaignId: string): CampaignMemory {
  return {
    campaign_id: campaignId,
    clock: {
      turn_index: 0,
    },
    events: [],
    relations: [],
    knowledge: {
      player_view: [],
      truth_view: [],
    },
    world_overrides: {},
    entity_registry: defaultEntityRegistry(),
    updated_at_turn: null,
  };
}

function defaultStore(): MemoryStoreData {
  return {
    schema_version: "1.0.0",
    wiki: {
      world_state: {},
    },
    campaigns: {},
  };
}

export class JsonMemoryStore {
  private filePath: string;
  private campaignSessions: Map<string, { campaign: CampaignMemory; dirty: boolean }>;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.campaignSessions = new Map();
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.write(defaultStore());
    }
  }

  read(): MemoryStoreData {
    const raw = fs.readFileSync(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as MemoryStoreData;
    if (parsed.schema_version !== "1.0.0") {
      throw new Error("unsupported memory store schema_version");
    }
    return parsed;
  }

  write(data: MemoryStoreData): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  setWikiWorldState(worldState: Record<string, unknown>): void {
    const data = this.read();
    data.wiki.world_state = worldState;
    this.write(data);
  }

  getWikiWorldState(): Record<string, unknown> {
    return this.read().wiki.world_state;
  }

  beginCampaignSession(campaignId: string): CampaignMemory {
    const normalizedCampaignId = normalizeLooseString(campaignId);
    if (!normalizedCampaignId) {
      throw new Error("campaign_id required for campaign session");
    }
    if (this.campaignSessions.has(normalizedCampaignId)) {
      throw new Error(`campaign session already active: ${normalizedCampaignId}`);
    }
    const campaign = this.loadCampaignFromDisk(normalizedCampaignId);
    this.campaignSessions.set(normalizedCampaignId, {
      campaign,
      dirty: false,
    });
    return campaign;
  }

  flushCampaignSession(campaignId: string): CampaignMemory {
    const normalizedCampaignId = normalizeLooseString(campaignId);
    const session = this.campaignSessions.get(normalizedCampaignId);
    if (!session) {
      throw new Error(`campaign session not found: ${normalizedCampaignId}`);
    }
    if (session.dirty) {
      const data = this.read();
      data.campaigns[normalizedCampaignId] = normalizeCampaignMemory(session.campaign);
      this.write(data);
      session.campaign = data.campaigns[normalizedCampaignId];
      session.dirty = false;
    }
    this.campaignSessions.delete(normalizedCampaignId);
    return session.campaign;
  }

  discardCampaignSession(campaignId: string): void {
    const normalizedCampaignId = normalizeLooseString(campaignId);
    if (!normalizedCampaignId) return;
    this.campaignSessions.delete(normalizedCampaignId);
  }

  loadCampaign(campaignId: string): CampaignMemory {
    const normalizedCampaignId = normalizeLooseString(campaignId);
    const activeSession = this.campaignSessions.get(normalizedCampaignId);
    if (activeSession) {
      return activeSession.campaign;
    }
    return this.loadCampaignFromDisk(normalizedCampaignId);
  }

  private loadCampaignFromDisk(campaignId: string): CampaignMemory {
    const data = this.read();
    const existing = data.campaigns[campaignId];
    if (existing) {
      const normalized = normalizeCampaignMemory(existing);
      data.campaigns[campaignId] = normalized;
      this.write(data);
      return normalized;
    }
    const created = defaultCampaignMemory(campaignId);
    data.campaigns[campaignId] = created;
    this.write(data);
    return created;
  }

  saveCampaign(campaign: CampaignMemory): void {
    const normalizedCampaignId = normalizeLooseString(campaign.campaign_id);
    const activeSession = this.campaignSessions.get(normalizedCampaignId);
    if (activeSession) {
      activeSession.campaign = normalizeCampaignMemory(campaign);
      activeSession.dirty = true;
      return;
    }
    const data = this.read();
    data.campaigns[campaign.campaign_id] = normalizeCampaignMemory(campaign);
    this.write(data);
  }

  deleteCampaign(campaignId: string): boolean {
    const normalizedCampaignId = String(campaignId ?? "").trim();
    if (!normalizedCampaignId) return false;
    this.campaignSessions.delete(normalizedCampaignId);
    const data = this.read();
    if (!data.campaigns[normalizedCampaignId]) return false;
    delete data.campaigns[normalizedCampaignId];
    this.write(data);
    return true;
  }
}
