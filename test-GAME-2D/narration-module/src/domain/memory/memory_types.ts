export type KnowledgeView = {
  player_view: Array<Record<string, unknown>>;
  truth_view: Array<Record<string, unknown>>;
};

export type CampaignMemory = {
  campaign_id: string;
  events: Array<Record<string, unknown>>;
  relations: Array<Record<string, unknown>>;
  knowledge: KnowledgeView;
  world_overrides: Record<string, unknown>;
  updated_at_turn: string | null;
};

export type MemoryStoreData = {
  schema_version: "1.0.0";
  wiki: {
    world_state: Record<string, unknown>;
  };
  campaigns: Record<string, CampaignMemory>;
};

