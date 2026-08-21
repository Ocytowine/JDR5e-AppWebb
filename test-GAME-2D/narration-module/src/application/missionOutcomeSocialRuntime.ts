import type { CampaignId, CampaignRepository, Result } from "../core";
import {
  recordMissionOutcomeV1,
  type MissionRelationEngagementResultV1,
  type RecordMissionOutcomeCommandV1
} from "./missionRelationAuthority";
import {
  SOCIAL_ACTOR_MUTATION_COMMAND_V1,
  mutateSocialActorStateV1,
  type SocialActorMutationResultV1
} from "./socialActorAuthority";

export async function recordMissionOutcomeWithSocialEffectV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: RecordMissionOutcomeCommandV1;
  playerActorId: string;
  occurredAtGameSecond: number;
}): Promise<Result<{
  mission: MissionRelationEngagementResultV1;
  social: SocialActorMutationResultV1 | null;
}>> {
  const mission = await recordMissionOutcomeV1({
    repository: input.repository,
    campaignId: input.campaignId,
    command: input.command,
    occurredAtGameSecond: input.occurredAtGameSecond
  });
  if (!mission.ok) return mission;
  if (input.command.relationshipEffects.length === 0) {
    return { ok: true, value: { mission: mission.value, social: null } };
  }
  const deltas = { trust: 0, affinity: 0, fear: 0, debt: 0 };
  for (const effect of input.command.relationshipEffects) deltas[effect.axis] += effect.delta;
  const sourceRef = `mission-outcome:${mission.value.engagement.engagementId}:${input.command.outcome}`;
  const social = await mutateSocialActorStateV1({
    repository: input.repository,
    campaignId: input.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: SOCIAL_ACTOR_MUTATION_COMMAND_V1,
      clientRequestId: `${input.command.clientRequestId}:social-effect`,
      actorId: mission.value.engagement.sceneActorId,
      reason: input.command.publicSummary,
      sourceEventRefs: [sourceRef],
      occurredAtGameSecond: input.occurredAtGameSecond,
      changes: {
        knownFactRefsAdded: [],
        beliefsUpserted: [],
        relationshipDeltas: [{
          targetActorId: input.playerActorId,
          ...deltas,
          sourceRefs: [sourceRef, ...input.command.publicSourceRefs]
        }],
        reputationMarkersUpserted: [],
        debtsAndPromisesUpserted: [],
        concernsUpserted: [],
        visibilityConstraintsAdded: []
      }
    }
  });
  return social.ok
    ? { ok: true, value: { mission: mission.value, social: social.value } }
    : social;
}
