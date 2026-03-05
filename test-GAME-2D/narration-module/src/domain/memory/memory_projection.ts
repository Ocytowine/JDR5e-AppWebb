import { CampaignMemory } from "./memory_types";

export type ProjectionInput = {
  wikiWorldState: Record<string, unknown>;
  campaignMemory: CampaignMemory;
  localContext: Record<string, unknown>;
};

export type ProjectedMemory = {
  effective_world_state: Record<string, unknown>;
  projected_units: {
    events: Array<Record<string, unknown>>;
    relations: Array<Record<string, unknown>>;
    knowledge_player_view: Array<Record<string, unknown>>;
    knowledge_truth_view: Array<Record<string, unknown>>;
  };
};

export function projectMemory(input: ProjectionInput): ProjectedMemory {
  const effectiveWorldState = {
    ...input.wikiWorldState,
    ...input.campaignMemory.world_overrides,
    ...input.localContext,
  };

  return {
    effective_world_state: effectiveWorldState,
    projected_units: {
      events: input.campaignMemory.events,
      relations: input.campaignMemory.relations,
      knowledge_player_view: input.campaignMemory.knowledge.player_view,
      knowledge_truth_view: input.campaignMemory.knowledge.truth_view,
    },
  };
}

