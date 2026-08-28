import type { NarrativeLoreBuildCatalogV1 } from "../context";
import type { CampaignId, CampaignRepository } from "../core";
import { createCampaignFactInformationReaderV1 } from "./campaignFactRuntime";
import { createCampaignLoreProjectionReaderV1 } from "./campaignLoreProjectionRuntime";
import {
  createTargetedLoreInformationReaderV1,
  type TargetedLoreInformationReaderV1
} from "./targetedLoreInformationLookup";

/**
 * Canonical production composition for factual lookup. Callers must not wire
 * lore-only lookup when a campaign repository is available, otherwise durable
 * free facts become invisible after reload.
 */
export function createCampaignBackedTargetedInformationReaderV1(input: {
  catalog: NarrativeLoreBuildCatalogV1;
  repository: CampaignRepository;
  campaignId: CampaignId;
}): TargetedLoreInformationReaderV1 {
  return createTargetedLoreInformationReaderV1({
    catalog: input.catalog,
    projectionReader: createCampaignLoreProjectionReaderV1({ repository: input.repository, campaignId: input.campaignId }),
    campaignFactReader: createCampaignFactInformationReaderV1({ repository: input.repository, campaignId: input.campaignId })
  });
}
