import type { CampaignClockPayload, CampaignRepository, CampaignId, OperationRecord, Result } from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import {
  MISSION_RELATION_PROPOSAL_COMMAND_V1,
  proposeMissionRelationEngagementV1,
  resolveMissionRelationEngagementV1,
  type MissionRelationDispositionV1,
  type MissionRelationEngagementResultV1
} from "./missionRelationAuthority";

export interface NarrativeMissionRelationRuntimeV1 {
  proposeFromDialogue(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<MissionRelationEngagementResultV1 | null>>;
}

export interface MissionRelationDialogueDecisionV1 {
  disposition: MissionRelationDispositionV1;
  conditions: string[];
  publicSourceRefs: string[];
}

export interface MissionRelationDialogueDecisionPolicyV1 {
  decide(input: {
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    actor: PlayableSceneStateV1["presentNpc"][number] | PlayableSceneStateV1["ambientPopulation"][number];
    scene: PlayableSceneStateV1;
  }): MissionRelationDialogueDecisionV1 | null;
}

export function createCatalogMissionRelationRuntimeV1(options: {
  decisionPolicy?: MissionRelationDialogueDecisionPolicyV1 | null;
} = {}): NarrativeMissionRelationRuntimeV1 {
  return {
    async proposeFromDialogue(input) {
      const dialogue = input.interpretation.semanticIntent.dialogueAct;
      const target = input.interpretation.referentResolution?.resolvedTarget
        ?? input.interpretation.semanticIntent.target
        ?? input.interpretation.target;
      if (
        input.interpretation.semanticIntent.kind !== "address_visible_actor"
        || input.interpretation.semanticIntent.commitment !== "committed"
        || input.interpretation.requiresClarification
        || dialogue?.act !== "REQUEST_ACTION"
        || target?.kind !== "npc"
        || target.ref === null
      ) return { ok: true, value: null };

      const actor = [...input.activeScene.presentNpc, ...input.activeScene.ambientPopulation]
        .find(candidate => target.ref === candidate.actorId || target.ref === `npc:${candidate.actorId}`);
      if (actor === undefined) return { ok: true, value: null };
      const campaign = await input.repository.getCampaign(input.campaignId);
      if (!campaign.ok) return campaign;
      const clock = await input.repository.getAggregate(
        input.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      );
      if (!clock.ok) return clock;
      const stableRef = `${input.operation.operationId}:${actor.actorId}`;
      const proposed = await proposeMissionRelationEngagementV1({
        repository: input.repository,
        campaignId: input.campaignId,
        occurredAtGameSecond: Number((clock.value.payload as CampaignClockPayload).elapsedGameSeconds),
        command: {
          schemaVersion: 1,
          contractVersion: MISSION_RELATION_PROPOSAL_COMMAND_V1,
          clientRequestId: `${input.operation.clientRequestId}:mission-proposal`,
          engagementId: `engagement:${stableRef}`,
          engagementKind: "MISSION",
          sceneId: input.activeScene.sceneId,
          sceneActorId: actor.actorId,
          durableRef: `mission:${stableRef}`,
          summary: dialogue.contentGoal,
          proposedBy: "PLAYER",
          publicSourceRefs: [
            `scene:${input.activeScene.sceneId}`,
            `actor:${actor.actorId}`,
            `narrative-operation:${input.operation.operationId}`
          ]
        }
      });
      if (!proposed.ok || proposed.value === null) return proposed;
      const decision = options.decisionPolicy?.decide({
        rawInput: input.rawInput,
        interpretation: input.interpretation,
        actor,
        scene: input.activeScene
      }) ?? null;
      if (decision === null) return proposed;
      return resolveMissionRelationEngagementV1({
        repository: input.repository,
        campaignId: input.campaignId,
        occurredAtGameSecond: Number((clock.value.payload as CampaignClockPayload).elapsedGameSeconds),
        command: {
          schemaVersion: 1,
          contractVersion: "mission-relation-resolution-command/1",
          clientRequestId: `${input.operation.clientRequestId}:mission-decision`,
          engagementId: proposed.value.engagement.engagementId,
          resolution: {
            schemaVersion: 1,
            disposition: decision.disposition,
            authority: "QUEST",
            evidenceKind: "QUEST_RESOLUTION",
            authorityOperationId: `mission-dialogue-policy:${input.operation.operationId}`,
            publicSourceRefs: [...new Set([
              ...decision.publicSourceRefs,
              `actor:${actor.actorId}`,
              `scene:${input.activeScene.sceneId}`
            ])],
            conditions: [...decision.conditions],
            version: 1
          }
        }
      });
    }
  };
}
