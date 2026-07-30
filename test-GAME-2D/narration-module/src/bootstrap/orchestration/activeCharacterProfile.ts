import {
  cloneJson,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type JsonObject,
  type Result
} from "../../core";

export const ACTIVE_CAMPAIGN_CHARACTER_PROFILE_CONTRACT_V1 =
  "active-campaign-character-profile/1" as const;
export const ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1 =
  "campaign.active-character-profile" as const;

export interface ActiveCampaignCharacterProfileV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion:
    typeof ACTIVE_CAMPAIGN_CHARACTER_PROFILE_CONTRACT_V1;
  campaignId: CampaignId;
  actorId: string;
  characterId: string;
  characterStateAggregateId: AggregateId;
  tacticalProjectionAggregateId: AggregateId;
  narrativeProjectionAggregateId: AggregateId;
  positionAggregateId: AggregateId;
  contentPackageId: string;
  contentPackageVersion: number;
  rulesetId: string;
  rulesetVersion: number;
  sourceFingerprint: string;
  version: 1;
}

export function activeCampaignCharacterProfileAggregateIdV1(
  campaignId: CampaignId
): AggregateId {
  return opaqueId<AggregateId>(campaignId);
}

export function createActiveCampaignCharacterProfileV1(input: {
  campaignId: CampaignId;
  characterId: string;
  characterStateAggregateId: AggregateId;
  tacticalProjectionAggregateId: AggregateId;
  narrativeProjectionAggregateId: AggregateId;
  positionAggregateId: AggregateId;
  contentPackageId: string;
  contentPackageVersion: number;
  rulesetId: string;
  rulesetVersion: number;
  sourceFingerprint: string;
}): ActiveCampaignCharacterProfileV1 {
  return {
    schemaVersion: 1,
    contractVersion: ACTIVE_CAMPAIGN_CHARACTER_PROFILE_CONTRACT_V1,
    campaignId: input.campaignId,
    actorId: input.characterId,
    characterId: input.characterId,
    characterStateAggregateId: input.characterStateAggregateId,
    tacticalProjectionAggregateId: input.tacticalProjectionAggregateId,
    narrativeProjectionAggregateId: input.narrativeProjectionAggregateId,
    positionAggregateId: input.positionAggregateId,
    contentPackageId: input.contentPackageId,
    contentPackageVersion: input.contentPackageVersion,
    rulesetId: input.rulesetId,
    rulesetVersion: input.rulesetVersion,
    sourceFingerprint: input.sourceFingerprint,
    version: 1
  };
}

export async function loadActiveCampaignCharacterProfileV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
}): Promise<Result<ActiveCampaignCharacterProfileV1>> {
  const [campaign, aggregate] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getAggregate(
      input.campaignId,
      ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
      activeCampaignCharacterProfileAggregateIdV1(input.campaignId)
    )
  ]);
  if (!campaign.ok) return campaign;
  if (!aggregate.ok) return aggregate;
  const profile =
    aggregate.value.payload as unknown as ActiveCampaignCharacterProfileV1;
  const issues = validateActiveCampaignCharacterProfileV1(profile);
  if (
    profile.campaignId !== input.campaignId
    || profile.contentPackageId !== campaign.value.dependencies.contentPackageId
    || profile.contentPackageVersion
      !== campaign.value.dependencies.contentPackageVersion
    || profile.rulesetId !== campaign.value.dependencies.rulesetId
    || profile.rulesetVersion !== campaign.value.dependencies.rulesetVersion
  ) issues.push("profile dependencies do not match the pinned campaign");
  if (issues.length > 0) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "campaign.active-character-profile.invalid",
        { issues }
      )
    };
  }
  return { ok: true, value: cloneJson(profile) };
}

export function validateActiveCampaignCharacterProfileV1(
  value: unknown
): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return ["profile must be an object"];
  }
  const profile = value as Partial<ActiveCampaignCharacterProfileV1>;
  const issues: string[] = [];
  if (
    profile.schemaVersion !== 1
    || profile.contractVersion
      !== ACTIVE_CAMPAIGN_CHARACTER_PROFILE_CONTRACT_V1
    || profile.version !== 1
  ) issues.push("profile contract is invalid");
  for (const key of [
    "campaignId",
    "actorId",
    "characterId",
    "characterStateAggregateId",
    "tacticalProjectionAggregateId",
    "narrativeProjectionAggregateId",
    "positionAggregateId",
    "contentPackageId",
    "rulesetId",
    "sourceFingerprint"
  ] as const) {
    if (!nonEmpty(profile[key])) issues.push(`${key} is required`);
  }
  if (
    !Number.isInteger(profile.contentPackageVersion)
    || Number(profile.contentPackageVersion) < 1
    || !Number.isInteger(profile.rulesetVersion)
    || Number(profile.rulesetVersion) < 1
  ) issues.push("profile dependency versions must be positive integers");
  return issues;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0;
}
