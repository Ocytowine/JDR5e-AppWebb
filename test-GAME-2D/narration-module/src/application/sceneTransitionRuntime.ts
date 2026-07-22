import { coreError, opaqueId, type AggregateRecord, type CampaignRecord, type CommitRequest, type JsonObject, type Result, type WriterId, type WriterLease } from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";
import type { NarrativeSceneTransitionRuntimeV1 } from "./NarrativeTurnController";
import { buildSceneArrivalAfterCommitV1 } from "./sceneArrival";
import { buildSceneArrivalDisplayPacketV1 } from "./sceneArrivalRender";
import { augmentTemporalCommitWithSceneTransitionV1, type WorldPreparedSceneTransitionV1 } from "./sceneTransitionCommit";
import type { SceneTransitionWorldCommandV1 } from "./sceneTransitionAdapter";

export interface SceneTransitionRuntimePreparationV1 {
  command: SceneTransitionWorldCommandV1;
  temporalCommit: CommitRequest;
  worldResult: WorldPreparedSceneTransitionV1;
  currentPositionAggregate: AggregateRecord;
  currentSceneLifecycleAggregate: AggregateRecord;
  destinationScene: PlayableSceneStateV1;
  authoritySourceRefs: string[];
  currentGameSecond: number;
  characterExpression: string;
}

export interface SceneTransitionRuntimePreparationPortV1 {
  prepare(input: {
    repository: Parameters<NarrativeSceneTransitionRuntimeV1["execute"]>[0]["repository"];
    campaign: CampaignRecord;
    operation: Parameters<NarrativeSceneTransitionRuntimeV1["execute"]>[0]["operation"];
    rawInput: string;
    interpretation: Parameters<NarrativeSceneTransitionRuntimeV1["execute"]>[0]["interpretation"];
    domainCommand: Parameters<NarrativeSceneTransitionRuntimeV1["execute"]>[0]["domainCommand"];
    writerLease: WriterLease;
  }): Promise<Result<SceneTransitionRuntimePreparationV1>>;
}

export function createNarrativeSceneTransitionRuntimeV1(
  preparationPort: SceneTransitionRuntimePreparationPortV1
): NarrativeSceneTransitionRuntimeV1 {
  return {
    async execute(input) {
      const preparing = await input.repository.transitionOperation(input.operation.operationId, "RECEIVED", "PREPARING");
      if (!preparing.ok) return preparing;
      const ready = await input.repository.transitionOperation(input.operation.operationId, "PREPARING", "READY_TO_COMMIT");
      if (!ready.ok) return ready;
      const campaign = await input.repository.getCampaign(input.campaignId);
      if (!campaign.ok) return campaign;
      const lease = await input.repository.acquireWriterLease(
        input.campaignId,
        opaqueId<WriterId>(`${input.operation.operationId}:scene-transition:writer`),
        120_000
      );
      if (!lease.ok) return lease;
      try {
        const prepared = await preparationPort.prepare({
          repository: input.repository,
          campaign: campaign.value,
          operation: ready.value,
          rawInput: input.rawInput,
          interpretation: input.interpretation,
          domainCommand: input.domainCommand,
          writerLease: lease.value
        });
        if (!prepared.ok) return prepared;
        const atomic = augmentTemporalCommitWithSceneTransitionV1({
          temporalCommit: prepared.value.temporalCommit,
          command: prepared.value.command,
          result: prepared.value.worldResult,
          currentGameSecond: prepared.value.currentGameSecond,
          currentPositionAggregate: prepared.value.currentPositionAggregate,
          sceneLifecycleAggregate: prepared.value.currentSceneLifecycleAggregate
        });
        if (!atomic.ok) {
          return { ok: false, error: coreError("VALIDATION_FAILED", "narrative.scene-transition.atomic-preparation-invalid", { issues: atomic.issues }) };
        }
        if (atomic.value.writerLease.fencingToken !== lease.value.fencingToken || atomic.value.writerLease.writerId !== lease.value.writerId) {
          return { ok: false, error: coreError("VALIDATION_FAILED", "narrative.scene-transition.writer-lease-mismatch") };
        }
        const committed = await input.repository.commit(atomic.value);
        if (!committed.ok) return committed;
        const [position, lifecycle] = await Promise.all([
          input.repository.getAggregate(input.campaignId, "world.position", prepared.value.currentPositionAggregate.aggregateId),
          input.repository.getAggregate(input.campaignId, "scene.lifecycle", prepared.value.currentSceneLifecycleAggregate.aggregateId)
        ]);
        if (!position.ok) return position;
        if (!lifecycle.ok) return lifecycle;
        const arrival = buildSceneArrivalAfterCommitV1({
          commit: committed.value,
          positionAggregate: position.value,
          sceneLifecycleAggregate: lifecycle.value,
          destinationScene: prepared.value.destinationScene,
          authoritySourceRefs: prepared.value.authoritySourceRefs
        });
        if (!arrival.ok) {
          return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.scene-transition.post-commit-reconstruction-failed", { issues: arrival.issues, commitId: committed.value.commitId }) };
        }
        return {
          ok: true,
          value: {
            commit: committed.value,
            arrival: arrival.value,
            displayPacket: buildSceneArrivalDisplayPacketV1({
              operationId: input.operation.operationId,
              rawInput: input.rawInput,
              characterExpression: prepared.value.characterExpression,
              arrival: arrival.value,
              durationSeconds: prepared.value.worldResult.durationSeconds
            }) as ReturnType<typeof buildSceneArrivalDisplayPacketV1> & JsonObject,
            characterExpression: prepared.value.characterExpression,
            durationSeconds: prepared.value.worldResult.durationSeconds
          }
        };
      } finally {
        await input.repository.releaseWriterLease(lease.value);
      }
    }
  };
}
