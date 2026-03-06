import { CampaignMemory } from "./memory_types";

export type TruthResolutionInput = {
  wikiWorldState: Record<string, unknown>;
  campaignMemory: CampaignMemory;
  localContext: Record<string, unknown>;
};

export type EffectiveTruthSnapshot = {
  wiki_base: Record<string, unknown>;
  campaign_truth: Record<string, unknown>;
  local_truth: Record<string, unknown>;
  effective_world_state: Record<string, unknown>;
};

export function resolveEffectiveTruth(input: TruthResolutionInput): EffectiveTruthSnapshot {
  const wikiBase =
    input.wikiWorldState && typeof input.wikiWorldState === "object"
      ? input.wikiWorldState
      : {};
  const campaignTruth =
    input.campaignMemory?.world_overrides && typeof input.campaignMemory.world_overrides === "object"
      ? input.campaignMemory.world_overrides
      : {};
  const localTruth =
    input.localContext && typeof input.localContext === "object"
      ? input.localContext
      : {};

  return {
    wiki_base: wikiBase,
    campaign_truth: campaignTruth,
    local_truth: localTruth,
    effective_world_state: {
      ...wikiBase,
      ...campaignTruth,
      ...localTruth,
    },
  };
}
