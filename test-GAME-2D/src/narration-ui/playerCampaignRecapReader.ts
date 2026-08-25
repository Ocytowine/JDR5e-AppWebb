import {
  composePlayerCampaignRecapV1,
  loadPlayerCampaignClockSecondV1,
  loadPlayerCompanionSummaryProjectionV1,
  loadPlayerEngagementSummaryProjectionV1,
  loadPlayerInventorySummaryProjectionV1,
  loadPlayerPlotSummaryProjectionV1,
  loadPlayerPublicContextV1,
  projectPlayerChronicleSummaryV1,
  projectPlayerTravelSummaryV1,
  type InterpreterCharacterContextResolverV1,
  type NarrativeTurnControllerV1,
  type PlayerCampaignRecapV1
} from "../../narration-module/src/application";
import { coreError, type CampaignId, type CampaignRepository, type Result } from "../../narration-module/src/core";
import type { InventoryTransactionCatalogEntryV1 } from "../../narration-module/src/application";

export function createPlayerCampaignRecapReaderV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  controller: NarrativeTurnControllerV1;
  characterContextResolver: InterpreterCharacterContextResolverV1;
  inventoryCatalog: readonly InventoryTransactionCatalogEntryV1[];
}): () => Promise<Result<PlayerCampaignRecapV1>> {
  return async () => {
    const [activeScene, characterContext, activeTravel, renderedThread] = await Promise.all([
      input.controller.resolveActiveScene(),
      input.characterContextResolver.resolve({ repository: input.repository, campaignId: input.campaignId }),
      input.controller.restoreActiveTravel(),
      input.controller.restoreRenderedThread(40)
    ]);
    if (!activeScene.ok) return activeScene;
    if (!characterContext.ok) return characterContext;
    if (characterContext.value === null) return {
      ok: false,
      error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "player-recap.character-context-missing")
    };
    if (!activeTravel.ok) return activeTravel;
    if (!renderedThread.ok) return renderedThread;

    const context = await loadPlayerPublicContextV1({
      repository: input.repository,
      campaignId: input.campaignId,
      activeScene: activeScene.value,
      characterContext: characterContext.value
    });
    if (!context.ok) return context;

    const actorLabels = new Map(activeScene.value.presentNpc.map(actor => [actor.actorId, actor.displayName]));
    const sceneLabels = new Map([[activeScene.value.sceneId, activeScene.value.locationName]]);
    const itemLabels = new Map(input.inventoryCatalog.map(item => [item.itemId, item.label]));
    const [clock, companions, engagements, plots, inventory] = await Promise.all([
      loadPlayerCampaignClockSecondV1(input),
      loadPlayerCompanionSummaryProjectionV1({ ...input, actorLabels, sceneLabels }),
      loadPlayerEngagementSummaryProjectionV1(input),
      loadPlayerPlotSummaryProjectionV1(input),
      loadPlayerInventorySummaryProjectionV1({ ...input, itemLabels })
    ]);
    if (!clock.ok) return clock;
    if (!companions.ok) return companions;
    if (!engagements.ok) return engagements;
    if (!plots.ok) return plots;
    if (!inventory.ok) return inventory;

    return { ok: true, value: composePlayerCampaignRecapV1({
      context: context.value,
      elapsedGameSeconds: clock.value,
      travel: projectPlayerTravelSummaryV1({ context: context.value, activeTravel: activeTravel.value }),
      companions: companions.value,
      engagements: engagements.value,
      plots: plots.value,
      inventory: inventory.value,
      chronicle: projectPlayerChronicleSummaryV1(renderedThread.value.displayPackets)
    }) };
  };
}
