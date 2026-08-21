import {
  IndexedDbCampaignRepository,
  opaqueId,
  type CampaignId
} from "../../src/core";
import { loadActiveCampaignCharacterProfileV1 } from "../../src/bootstrap";
import {
  loadAccessControlRegistryV1,
  loadSocialAccessAttemptRegistryV1,
  EXTERNAL_INVENTORY_AGGREGATE_ID_V1,
  EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1
} from "../../src/application";
import { PLAYABLE_CAMPAIGN_DATABASE_NAME_V1 } from
  "../../../src/narration-ui/playableCampaignBootstrap";
import { ARCHIVES_RESTRICTED_HOLDINGS_ACCESS_CONTROL_REF_V1 } from
  "../../../src/narration-ui/playableCampaignAccessCatalog";

export async function inspectArchivesSocialAccessJ2V1() {
  const campaignId = readCampaignId();
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const [controls, attempts, campaign] = await Promise.all([
      loadAccessControlRegistryV1(repository, campaignId),
      loadSocialAccessAttemptRegistryV1(repository, campaignId),
      repository.getCampaign(campaignId)
    ]);
    if (!controls.ok) throw new Error(controls.error.messageKey);
    if (!attempts.ok) throw new Error(attempts.error.messageKey);
    if (!campaign.ok) throw new Error(campaign.error.messageKey);
    const clock = await repository.getAggregate(
      campaignId,
      "world.clock",
      campaign.value.clockAggregateId
    );
    if (!clock.ok) throw new Error(clock.error.messageKey);
    const matchingAttempts = attempts.value.state.attempts.filter(attempt =>
      attempt.accessControlRef ===
        ARCHIVES_RESTRICTED_HOLDINGS_ACCESS_CONTROL_REF_V1
    );
    const latest = matchingAttempts.at(-1) ?? null;
    return {
      state: controls.value.state.controls.find(control =>
        control.accessControlRef ===
          ARCHIVES_RESTRICTED_HOLDINGS_ACCESS_CONTROL_REF_V1
      )?.state ?? "MISSING",
      attemptCount: matchingAttempts.length,
      outcome: latest?.outcome ?? null,
      conditionRef: latest?.conditionRef ?? null,
      speechText: latest?.speechText ?? null,
      elapsedGameSeconds: Number(clock.value.payload.elapsedGameSeconds)
    };
  } finally {
    repository.close();
  }
}

export async function inspectCampaignInventoryJ3V1() {
  const campaignId = readCampaignId();
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const profile = await loadActiveCampaignCharacterProfileV1({ repository, campaignId });
    if (!profile.ok) throw new Error(profile.error.messageKey);
    const [character, tactical, narrative, external, campaign] = await Promise.all([
      repository.getAggregate(campaignId, "character.state", profile.value.characterStateAggregateId),
      repository.getAggregate(campaignId, "character.tactical-projection", profile.value.tacticalProjectionAggregateId),
      repository.getAggregate(campaignId, "character.narrative-projection", profile.value.narrativeProjectionAggregateId),
      repository.getAggregate(campaignId, EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, EXTERNAL_INVENTORY_AGGREGATE_ID_V1),
      repository.getCampaign(campaignId)
    ]);
    if (!character.ok) throw new Error(character.error.messageKey);
    if (!tactical.ok) throw new Error(tactical.error.messageKey);
    if (!narrative.ok) throw new Error(narrative.error.messageKey);
    if (!external.ok) throw new Error(external.error.messageKey);
    if (!campaign.ok) throw new Error(campaign.error.messageKey);
    const clock = await repository.getAggregate(campaignId, "world.clock", campaign.value.clockAggregateId);
    if (!clock.ok) throw new Error(clock.error.messageKey);
    const inventory = character.value.payload.inventory as Array<{
      instanceId: string;
      storedInInstanceId: string | null;
      equippedSlot: string | null;
    }>;
    const sword = inventory.find(item => item.instanceId === "item-epee");
    const gold = inventory.find(item => item.instanceId === "item-or");
    const merchant = (external.value.payload.owners as Array<{
      ownerRef: string;
      inventory: Array<{ instanceId: string; itemId: string; quantity: number }>;
      offers: Array<{ offerRef: string; status: string }>;
    }>).find(owner => owner.ownerRef === "npc:wiki-location:halles_des_commerces:ambient:1");
    return {
      swordSlot: sword?.equippedSlot ?? null,
      goldContainer: gold?.storedInInstanceId ?? null,
      goldQuantity: (gold as { quantity?: number } | undefined)?.quantity ?? 0,
      playerPlumeCount: inventory.filter(item => (item as { itemId?: string }).itemId === "obj_plume_encre").length,
      rightHand: (character.value.payload.equipmentSlots as Record<string, unknown>).main_droite ?? null,
      tacticalEquipped: [...(tactical.value.payload.equippedItemInstanceIds as string[])].sort(),
      narrativeVisibleEquipment: [...(narrative.value.payload.observable as { visibleEquipment: Array<{ instanceId: string }> }).visibleEquipment]
        .map(item => item.instanceId)
        .sort(),
      characterRevision: character.value.aggregateRevision,
      tacticalRevision: tactical.value.aggregateRevision,
      narrativeRevision: narrative.value.aggregateRevision,
      externalRevision: external.value.aggregateRevision,
      sceneInventory: ((external.value.payload.owners as Array<{ ownerKind: string; sceneId: string; inventory: Array<{ instanceId: string }> }>).find(owner =>
        owner.ownerKind === "SCENE" && owner.sceneId === "wiki-location:archives_de_lysenthe"
      )?.inventory ?? []).map(item => item.instanceId).sort(),
      archivistInventory: ((external.value.payload.owners as Array<{ ownerRef: string; inventory: Array<{ instanceId: string }> }>).find(owner =>
        owner.ownerRef === "npc:wiki-location:archives_de_lysenthe:ambient:1"
      )?.inventory ?? []).map(item => item.instanceId).sort(),
      merchantPlumeCount: merchant?.inventory.filter(item => item.itemId === "obj_plume_encre").length ?? 0,
      merchantGoldQuantity: merchant?.inventory.filter(item => item.itemId === "obj_piece_or").reduce((sum, item) => sum + item.quantity, 0) ?? 0,
      merchantOfferStatuses: merchant?.offers.map(offer => `${offer.offerRef}:${offer.status}`).sort() ?? [],
      elapsedGameSeconds: Number(clock.value.payload.elapsedGameSeconds)
    };
  } finally {
    repository.close();
  }
}

export async function inspectCampaignSceneAndTimeJ2V1() {
  const campaignId = readCampaignId();
  const token = campaignId.replace(/^cmp-player-/u, "");
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const campaign = await repository.getCampaign(campaignId);
    if (!campaign.ok) throw new Error(campaign.error.messageKey);
    const [lifecycle, clock] = await Promise.all([
      repository.getAggregate(
        campaignId,
        "scene.lifecycle",
        opaqueId(`agg-scene-lifecycle-${token}`)
      ),
      repository.getAggregate(
        campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      )
    ]);
    if (!lifecycle.ok) throw new Error(lifecycle.error.messageKey);
    if (!clock.ok) throw new Error(clock.error.messageKey);
    return {
      activeSceneId: String(lifecycle.value.payload.activeSceneId),
      elapsedGameSeconds: Number(clock.value.payload.elapsedGameSeconds)
    };
  } finally {
    repository.close();
  }
}

function readCampaignId(): CampaignId {
  const raw = localStorage.getItem(
    "jdr5e_narration_bootstrap_envelopes_v1"
  );
  if (raw === null) throw new Error("bootstrap envelope missing");
  const records = JSON.parse(raw) as Record<string, { campaignId?: unknown }>;
  const campaignId = Object.values(records)[0]?.campaignId;
  if (typeof campaignId !== "string") throw new Error("campaign id missing");
  return opaqueId<CampaignId>(campaignId);
}
