import type {
  CampaignId,
  CampaignRepository,
  OperationId,
  OperationRecord,
  Result
} from "../core";
import { opaqueId } from "../core";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import {
  promoteSceneActorToCampaignNpcV1
} from "./campaignNpcPromotionRuntime";
import type {
  MissionRelationEngagementResultV1
} from "./missionRelationAuthority";
import {
  recruitCompanionV1,
  type CompanionAutonomyPolicyV1,
  type CompanionPartyMutationResultV1
} from "./companionPartyAuthority";
import type { PlayableSceneStateV1 } from "./playableScene";

export interface CompanionRecruitmentPolicyV1 {
  resolve(input: {
    actor: PlayableSceneStateV1["presentNpc"][number]
      | PlayableSceneStateV1["ambientPopulation"][number];
    scene: PlayableSceneStateV1;
    engagement: MissionRelationEngagementResultV1["engagement"];
  }): CompanionAutonomyPolicyV1 | null;
}

export interface NarrativeCompanionRecruitmentRuntimeV1 {
  maybeRecruit(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    interpretation: NarrativeIntentInterpretationV1;
    activeScene: PlayableSceneStateV1;
    playerActorRef: string;
    missionResult: MissionRelationEngagementResultV1 | null;
  }): Promise<Result<CompanionPartyMutationResultV1 | null>>;
}

/**
 * Compose J4 et J7 sans donner d'autorite au texte ni au controleur : la
 * mission doit avoir accepte la demande et le catalogue doit fournir une
 * politique d'autonomie explicite pour ce PNJ.
 */
export function createNarrativeCompanionRecruitmentRuntimeV1(input: {
  policy: CompanionRecruitmentPolicyV1;
}): NarrativeCompanionRecruitmentRuntimeV1 {
  return {
    async maybeRecruit(request) {
      const directive = request.interpretation.semanticIntent.companionDirective;
      const mission = request.missionResult;
      if (
        directive?.category !== "FOLLOW"
        || mission?.engagement.status !== "ACCEPTED"
        || mission.ownerConfirmation === null
      ) return { ok: true, value: null };

      const recruitmentClientRequestId =
        `${request.operation.clientRequestId}:companion-recruitment`;
      const existingRecruitment = await request.repository.getOperation(
        opaqueId<OperationId>(`companion.recruit:${recruitmentClientRequestId}`)
      );
      if (
        existingRecruitment.ok
        && existingRecruitment.value.phase === "COMPLETED"
        && existingRecruitment.value.resultPayload !== null
      ) return {
        ok: true,
        value: {
          ...(existingRecruitment.value.resultPayload as unknown as
            CompanionPartyMutationResultV1),
          replayed: true
        }
      };
      if (!existingRecruitment.ok && existingRecruitment.error.code !== "NOT_FOUND") {
        return existingRecruitment;
      }

      const actor = [
        ...request.activeScene.presentNpc,
        ...request.activeScene.ambientPopulation
      ].find(candidate => candidate.actorId === mission.engagement.sceneActorId);
      if (actor === undefined) return { ok: true, value: null };
      const autonomyPolicy = input.policy.resolve({
        actor,
        scene: request.activeScene,
        engagement: mission.engagement
      });
      if (autonomyPolicy === null) return { ok: true, value: null };
      const campaign = await request.repository.getCampaign(request.campaignId);
      if (!campaign.ok) return campaign;
      const clock = await request.repository.getAggregate(
        request.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      );
      if (!clock.ok) return clock;
      const occurredAtGameSecond = Number(clock.value.payload.elapsedGameSeconds);

      const promoted = await promoteSceneActorToCampaignNpcV1({
        repository: request.repository,
        campaignId: request.campaignId,
        occurredAtGameSecond,
        command: {
          schemaVersion: 1,
          clientRequestId: `${request.operation.clientRequestId}:companion-promotion`,
          sceneId: request.activeScene.sceneId,
          sceneActorId: actor.actorId,
          ownerConfirmation: mission.ownerConfirmation
        }
      });
      if (!promoted.ok) return promoted;

      return recruitCompanionV1({
        repository: request.repository,
        campaignId: request.campaignId,
        command: {
          schemaVersion: 1,
          clientRequestId: recruitmentClientRequestId,
          campaignNpcId: promoted.value.campaignNpc.campaignNpcId,
          actorId: actor.actorId,
          engagementId: mission.engagement.engagementId,
          activeSceneId: request.activeScene.sceneId,
          leaderActorId: request.playerActorRef,
          occurredAtGameSecond,
          autonomyPolicy
        }
      });
    }
  };
}
