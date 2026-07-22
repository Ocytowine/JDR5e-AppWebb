import type { DynamicCreationProposalV1, CreationPersistenceDepthV1 } from "../ai";
import type {
  LoreInfluenceDimensionV1,
  LoreInfluencePacketV1,
  LoreInfluenceRefV1
} from "../context";

export const LORE_GUIDED_SCENE_CREATION_BRIEF_VERSION_V1 = "lore-guided-scene-creation-brief/1" as const;

export interface CampaignLoreProjectionV1 {
  schemaVersion: 1;
  projectionId: string;
  entityId: string;
  fieldPath: string;
  disposition: "REPLACE" | "WITHHOLD";
  replacementText: string | null;
  sourceRefs: string[];
  campaignRevision: number;
  version: 1;
}

export interface CampaignLoreProjectionReadRequestV1 {
  schemaVersion: 1;
  campaignId: string;
  campaignRevision: number;
  targets: Array<{ entityId: string; fieldPath: string }>;
}

export interface CampaignLoreProjectionReadResultV1 {
  schemaVersion: 1;
  authority: "CampaignFactDomain";
  campaignId: string;
  campaignRevision: number;
  projections: CampaignLoreProjectionV1[];
  sourceRefs: string[];
  version: 1;
}

export interface CampaignLoreProjectionReaderV1 {
  listEffectiveProjections(request: CampaignLoreProjectionReadRequestV1): Promise<CampaignLoreProjectionReadResultV1>;
}

export interface EffectiveLoreInfluenceV1 extends LoreInfluenceRefV1 {
  initialText: string;
  effectiveText: string;
  authority: "LORE_INITIAL" | "CAMPAIGN_PROJECTION";
  campaignProjectionId: string | null;
  effectiveSourceRefs: string[];
}

export interface LoreGuidedSceneCreationBriefV1 {
  schemaVersion: 1;
  contractVersion: typeof LORE_GUIDED_SCENE_CREATION_BRIEF_VERSION_V1;
  briefId: string;
  creationType: "SCENE" | "PLACE";
  anchorEntityId: string;
  geographicChain: string[];
  strictConstraints: EffectiveLoreInfluenceV1[];
  localGuidance: EffectiveLoreInfluenceV1[];
  regionalGuidance: EffectiveLoreInfluenceV1[];
  unresolvedDimensions: LoreInfluenceDimensionV1[];
  sourceRefs: string[];
  appliedCampaignProjectionIds: string[];
  nonCommittable: true;
  version: 1;
}

export type LoreGuidedSceneBriefResultV1 =
  | { ok: true; brief: LoreGuidedSceneCreationBriefV1 }
  | { ok: false; code: "SCENE_BRIEF_INVALID" | "CAMPAIGN_PROJECTION_INVALID"; issues: string[] };

export interface LoreGuidedPlaceCandidateV1 {
  proposalId: string;
  requestedDepth: Extract<CreationPersistenceDepthV1, "SCENE_EPHEMERAL" | "LIGHT_REFERENCE" | "FULL_ENTITY">;
  displayName: string;
  summary: string;
  initialTension: string;
  perceptibleFeatures: string[];
  populationRoles: string[];
  localNorms: string[];
  proposedPlaceRef: string;
  arrivalSceneId: string;
  parentLocationRef: string;
  connectionIntents: Array<{
    sourceSceneId: string;
    boundaryRef: string;
    destinationRef: string;
    scale: "LOCAL" | "TRAVEL";
    sourceRefs: string[];
  }>;
  reason: string;
  expectedEffects: string[];
  narrativeCommitments: string[];
  duplicatePolicy: DynamicCreationProposalV1["duplicatePolicy"];
}

export type DynamicPlaceProposalBuildResultV1 =
  | { ok: true; proposal: DynamicCreationProposalV1 }
  | { ok: false; code: "PLACE_CANDIDATE_INVALID"; issues: string[] };

export function buildLoreGuidedSceneCreationBriefV1(input: {
  briefId: string;
  packet: LoreInfluencePacketV1;
  campaignProjections: CampaignLoreProjectionV1[];
}): LoreGuidedSceneBriefResultV1 {
  const issues: string[] = [];
  if (!input.briefId.trim()) issues.push("briefId is required.");
  if (input.packet.contractVersion !== "lore-influence-packet/1") issues.push("lore-influence-packet/1 is required.");
  const projectionIds = new Set<string>();
  const projectionTargets = new Set<string>();
  const influenceKeys = new Set(input.packet.influences.map(influence => influenceKey(influence.entityId, influence.fieldPath)));
  for (const projection of input.campaignProjections) {
    if (!projection.projectionId.trim() || projectionIds.has(projection.projectionId)) issues.push("campaign projection ids must be unique and non-empty.");
    projectionIds.add(projection.projectionId);
    const targetKey = influenceKey(projection.entityId, projection.fieldPath);
    if (projectionTargets.has(targetKey)) issues.push(`campaign projection target ${projection.entityId}${projection.fieldPath} is duplicated.`);
    projectionTargets.add(targetKey);
    if (!influenceKeys.has(targetKey)) {
      issues.push(`campaign projection ${projection.projectionId} does not target a selected lore influence.`);
    }
    if (projection.sourceRefs.length === 0) issues.push(`campaign projection ${projection.projectionId} requires sourceRefs.`);
    if (projection.disposition === "REPLACE" && !projection.replacementText?.trim()) {
      issues.push(`campaign projection ${projection.projectionId} requires replacementText.`);
    }
    if (projection.disposition === "WITHHOLD" && projection.replacementText !== null) {
      issues.push(`campaign projection ${projection.projectionId} must not carry replacementText when withheld.`);
    }
    if (!Number.isInteger(projection.campaignRevision) || projection.campaignRevision < 0) {
      issues.push(`campaign projection ${projection.projectionId} has an invalid revision.`);
    }
  }
  if (issues.length > 0) {
    return {
      ok: false,
      code: issues.some(issue => issue.startsWith("campaign projection")) ? "CAMPAIGN_PROJECTION_INVALID" : "SCENE_BRIEF_INVALID",
      issues
    };
  }

  const projectionsByTarget = new Map(input.campaignProjections.map(projection => [
    influenceKey(projection.entityId, projection.fieldPath),
    projection
  ]));
  const effective = input.packet.influences.flatMap(influence => {
    const projection = projectionsByTarget.get(influenceKey(influence.entityId, influence.fieldPath));
    if (projection?.disposition === "WITHHOLD") return [];
    return [{
      ...influence,
      initialText: influence.text,
      effectiveText: projection?.replacementText ?? influence.text,
      authority: projection ? "CAMPAIGN_PROJECTION" as const : "LORE_INITIAL" as const,
      campaignProjectionId: projection?.projectionId ?? null,
      effectiveSourceRefs: unique([influence.sourceRef, ...(projection?.sourceRefs ?? [])])
    }];
  });
  const appliedCampaignProjectionIds = effective
    .map(influence => influence.campaignProjectionId)
    .filter((value): value is string => value !== null);
  const withheldProjectionIds = input.campaignProjections
    .filter(projection => projection.disposition === "WITHHOLD")
    .map(projection => projection.projectionId);
  return {
    ok: true,
    brief: {
      schemaVersion: 1,
      contractVersion: LORE_GUIDED_SCENE_CREATION_BRIEF_VERSION_V1,
      briefId: input.briefId,
      creationType: input.packet.creationType === "PLACE" ? "PLACE" : "SCENE",
      anchorEntityId: input.packet.anchorEntityId,
      geographicChain: [...input.packet.geographicChain],
      strictConstraints: effective.filter(influence => influence.degree === "STRICT_CANON"),
      localGuidance: effective.filter(influence => influence.degree === "LOCAL_GUIDANCE"),
      regionalGuidance: effective.filter(influence => influence.degree === "REGIONAL_GUIDANCE"),
      unresolvedDimensions: [...input.packet.unresolvedDimensions],
      sourceRefs: unique([
        ...effective.flatMap(influence => influence.effectiveSourceRefs),
        ...input.campaignProjections.flatMap(projection => projection.sourceRefs)
      ]),
      appliedCampaignProjectionIds: unique([...appliedCampaignProjectionIds, ...withheldProjectionIds]),
      nonCommittable: true,
      version: 1
    }
  };
}

export async function buildLoreGuidedSceneCreationBriefFromCampaignV1(input: {
  briefId: string;
  campaignId: string;
  campaignRevision: number;
  packet: LoreInfluencePacketV1;
  projectionReader: CampaignLoreProjectionReaderV1;
}): Promise<LoreGuidedSceneBriefResultV1> {
  const read = await input.projectionReader.listEffectiveProjections({
    schemaVersion: 1,
    campaignId: input.campaignId,
    campaignRevision: input.campaignRevision,
    targets: input.packet.influences.map(influence => ({ entityId: influence.entityId, fieldPath: influence.fieldPath }))
  });
  if (
    read.authority !== "CampaignFactDomain" ||
    read.campaignId !== input.campaignId ||
    read.campaignRevision !== input.campaignRevision ||
    read.projections.some(projection => projection.campaignRevision > input.campaignRevision) ||
    read.projections.some(projection => projection.sourceRefs.some(sourceRef => !read.sourceRefs.includes(sourceRef)))
  ) {
    return { ok: false, code: "CAMPAIGN_PROJECTION_INVALID", issues: ["campaign projection read is stale or lacks CampaignFactDomain authority."] };
  }
  return buildLoreGuidedSceneCreationBriefV1({
    briefId: input.briefId,
    packet: input.packet,
    campaignProjections: read.projections
  });
}

export function buildDynamicPlaceCreationProposalV1(input: {
  brief: LoreGuidedSceneCreationBriefV1;
  candidate: LoreGuidedPlaceCandidateV1;
}): DynamicPlaceProposalBuildResultV1 {
  const issues: string[] = [];
  if (input.brief.contractVersion !== LORE_GUIDED_SCENE_CREATION_BRIEF_VERSION_V1 || input.brief.nonCommittable !== true) {
    issues.push("a non-committable lore-guided-scene-creation-brief/1 is required.");
  }
  for (const [field, value] of [
    ["proposalId", input.candidate.proposalId],
    ["displayName", input.candidate.displayName],
    ["summary", input.candidate.summary],
    ["initialTension", input.candidate.initialTension],
    ["reason", input.candidate.reason]
  ]) {
    if (!value.trim()) issues.push(`${field} is required.`);
  }
  for (const [field, values] of [
    ["perceptibleFeatures", input.candidate.perceptibleFeatures],
    ["populationRoles", input.candidate.populationRoles],
    ["localNorms", input.candidate.localNorms],
    ["connectionIntents", input.candidate.connectionIntents]
  ] as const) {
    if (field === "connectionIntents") {
      if (values.length === 0) issues.push("connectionIntents must not be empty.");
    } else if ((values as string[]).length === 0 || (values as string[]).some(value => !value.trim())) {
      issues.push(`${field} must contain non-empty values.`);
    }
  }
  if (!isCanonicalRef(input.candidate.proposedPlaceRef)) issues.push("proposedPlaceRef must be canonical.");
  if (!input.candidate.arrivalSceneId.trim()) issues.push("arrivalSceneId is required.");
  if (!isCanonicalRef(input.candidate.parentLocationRef)) issues.push("parentLocationRef must be canonical.");
  for (const connection of input.candidate.connectionIntents) {
    if (!connection.sourceSceneId.trim()) issues.push("connection sourceSceneId is required.");
    if (!isCanonicalRef(connection.boundaryRef)) issues.push("connection boundaryRef must be canonical.");
    if (!isCanonicalRef(connection.destinationRef)) issues.push("connection destinationRef must be canonical.");
    if (connection.sourceRefs.length === 0 || connection.sourceRefs.some(ref => !ref.trim())) issues.push("connection sourceRefs are required.");
  }
  if (input.candidate.requestedDepth !== "SCENE_EPHEMERAL" && input.candidate.narrativeCommitments.length === 0) {
    issues.push("a persistent place candidate requires at least one narrative commitment.");
  }
  if (input.brief.sourceRefs.length === 0) issues.push("the source brief must retain grounding refs.");
  if (issues.length > 0) return { ok: false, code: "PLACE_CANDIDATE_INVALID", issues };

  const proposal: DynamicCreationProposalV1 = {
    schemaVersion: 1,
    proposalId: input.candidate.proposalId,
    proposalType: "PLACE",
    requestedDepth: input.candidate.requestedDepth,
    reason: input.candidate.reason,
    anchors: [{ kind: "LOCATION", id: input.brief.anchorEntityId, required: true }],
    proposedProperties: {
      displayName: input.candidate.displayName,
      summary: input.candidate.summary,
      initialTension: input.candidate.initialTension,
      perceptibleFeatures: [...input.candidate.perceptibleFeatures],
      populationRoles: [...input.candidate.populationRoles],
      localNorms: [...input.candidate.localNorms],
      proposedPlaceRef: input.candidate.proposedPlaceRef,
      arrivalSceneId: input.candidate.arrivalSceneId,
      parentLocationRef: input.candidate.parentLocationRef,
      connectionIntents: input.candidate.connectionIntents.map(connection => ({ ...connection, sourceRefs: [...connection.sourceRefs] })),
      influenceSourceRefs: [...input.brief.sourceRefs],
      unresolvedDimensions: [...input.brief.unresolvedDimensions],
      sourceBriefId: input.brief.briefId,
      nonCommittableSourceBrief: input.brief.nonCommittable
    },
    existingFactRefsUsed: [...input.brief.sourceRefs],
    relationsToExisting: [
      `located_near:${input.brief.anchorEntityId}`,
      `parent_location:${input.candidate.parentLocationRef}`
    ],
    expectedEffects: [...input.candidate.expectedEffects],
    visibility: "PLAYER_VISIBLE",
    narrativeCommitments: [...input.candidate.narrativeCommitments],
    validatingDomains: input.candidate.requestedDepth === "SCENE_EPHEMERAL"
      ? ["SceneDomain", "WorldDomain"]
      : ["SceneDomain", "WorldDomain", "CampaignFactDomain"],
    duplicatePolicy: input.candidate.duplicatePolicy
  };
  return { ok: true, proposal };
}

function influenceKey(entityId: string, fieldPath: string): string {
  return `${entityId}\u0000${fieldPath}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "fr"));
}

function isCanonicalRef(value: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(value);
}
