export type PlayerKnowledgeKind =
  | "fact_seen"
  | "fact_heard"
  | "fact_learned"
  | "visited_location"
  | "met_actor"
  | "notable_element"
  | "summary"
  | "lead"
  | "player_note"
  | "player_hypothesis";

export type PlayerKnowledgeCertainty = "solid" | "partial" | "tentative";
export type PlayerKnowledgeSource = "auto_narration" | "player_manual" | "runtime";

export type PlayerKnowledgeRecord = {
  turn_id: string | null;
  text: string;
  knowledge_kind: PlayerKnowledgeKind;
  certainty: PlayerKnowledgeCertainty;
  source: PlayerKnowledgeSource;
  location_id?: string | null;
  linked_entity_ids?: string[];
  tags?: string[];
  [key: string]: unknown;
};

export type TruthKnowledgeRecord = Record<string, unknown>;

export type KnowledgeView = {
  player_view: PlayerKnowledgeRecord[];
  truth_view: TruthKnowledgeRecord[];
};

export type RuntimeEntityType = "actor" | "location" | "object";
export type RuntimeEntityMemoryState = "active" | "relevant" | "dormant" | "archived";
export type RuntimeEntityStatus = "active" | "dormant" | "archived" | "expired";
export type RuntimeEntityScope = "ephemeral" | "situational" | "persistent";

export type RuntimeEntityRecord = {
  entity_id: string;
  entity_type: RuntimeEntityType;
  subtype: string;
  display_name: string;
  memory_state?: RuntimeEntityMemoryState;
  status: RuntimeEntityStatus;
  scope: RuntimeEntityScope;
  created_at_turn: string | null;
  updated_at_turn: string | null;
  last_seen_turn: string | null;
  first_seen_turn_index?: number | null;
  last_seen_turn_index?: number | null;
  location_id?: string | null;
  source: Record<string, unknown>;
  visibility: Record<string, unknown>;
  links: {
    event_ids: string[];
    related_entity_ids: string[];
    faction_ids: string[];
    [key: string]: unknown;
  };
  payload: Record<string, unknown>;
  lifecycle_policy: {
    ttl_turns?: number | null;
    promote_if_linked_to_event?: boolean;
    archive_when_inactive?: boolean;
    [key: string]: unknown;
  };
  lifecycle_history?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type EntityRegistryIndexes = {
  by_type: Record<string, string[]>;
  by_memory_state: Record<string, string[]>;
  by_location_id: Record<string, string[]>;
  by_event_id: Record<string, string[]>;
  by_scope: Record<string, string[]>;
  by_status: Record<string, string[]>;
};

export type EntityRegistry = {
  actors: Record<string, RuntimeEntityRecord>;
  locations: Record<string, RuntimeEntityRecord>;
  objects: Record<string, RuntimeEntityRecord>;
  indexes: EntityRegistryIndexes;
};

export type CampaignClock = {
  turn_index: number;
};

export type CampaignMemory = {
  campaign_id: string;
  clock: CampaignClock;
  events: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
  knowledge: KnowledgeView;
  world_overrides: Record<string, unknown>;
  entity_registry: EntityRegistry;
  updated_at_turn: string | null;
};

export type MemoryStoreData = {
  schema_version: "1.0.0";
  wiki: {
    world_state: Record<string, unknown>;
  };
  campaigns: Record<string, CampaignMemory>;
};
