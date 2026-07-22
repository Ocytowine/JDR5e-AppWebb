import { cloneJson, type AggregateRecord, type CommitRecord, type JsonObject } from "../core";
import { validatePlayableSceneV1, type PlayableSceneStateV1 } from "./playableScene";
import { SCENE_LIFECYCLE_CONTRACT_VERSION_V1, type SceneLifecycleStateV1 } from "./sceneTransitionCommit";

export const SCENE_ARRIVAL_CONTRACT_VERSION_V1 = "scene-arrival/1" as const;

export interface SceneArrivalStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_ARRIVAL_CONTRACT_VERSION_V1;
  commitId: string;
  transitionRequestId: string;
  destinationRef: string;
  previousSceneId: string;
  enteredAtGameSecond: number;
  scene: PlayableSceneStateV1;
  authoritySourceRefs: string[];
  reconstructionRefs: string[];
  narrationStatus: "READY_AFTER_COMMIT";
  version: 1;
}

export function buildSceneArrivalAfterCommitV1(input: {
  commit: CommitRecord;
  positionAggregate: AggregateRecord;
  sceneLifecycleAggregate: AggregateRecord;
  destinationScene: PlayableSceneStateV1;
  authoritySourceRefs: string[];
}): { ok: true; value: SceneArrivalStateV1 } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const lifecycle = input.sceneLifecycleAggregate.payload as Partial<SceneLifecycleStateV1>;
  const positionLocationRef = input.positionAggregate.payload.canonicalLocationRef;
  if (input.positionAggregate.campaignId !== input.commit.campaignId || input.sceneLifecycleAggregate.campaignId !== input.commit.campaignId) issues.push("campaign mismatch");
  if (input.positionAggregate.aggregateType !== "world.position") issues.push("world.position aggregate required");
  if (input.sceneLifecycleAggregate.aggregateType !== "scene.lifecycle") issues.push("scene.lifecycle aggregate required");
  if (input.positionAggregate.updatedByCommitId !== input.commit.commitId || input.sceneLifecycleAggregate.updatedByCommitId !== input.commit.commitId) issues.push("arrival aggregates must come from the confirmed commit");
  if (!commitContainsAggregate(input.commit, input.positionAggregate) || !commitContainsAggregate(input.commit, input.sceneLifecycleAggregate)) issues.push("commit does not contain arrival aggregate revisions");
  if (lifecycle.contractVersion !== SCENE_LIFECYCLE_CONTRACT_VERSION_V1) issues.push("scene lifecycle contract mismatch");
  if (typeof lifecycle.activeLocationRef !== "string" || lifecycle.activeLocationRef !== positionLocationRef) issues.push("position and scene destination mismatch");
  if (lifecycle.activeSceneId !== input.destinationScene.sceneId) issues.push("destination scene identity mismatch");
  if (typeof lifecycle.previousSceneId !== "string" || lifecycle.previousSceneId === lifecycle.activeSceneId) issues.push("a distinct previous scene is required");
  if (!Number.isInteger(lifecycle.enteredAtGameSecond) || lifecycle.enteredAtGameSecond! < 0) issues.push("enteredAtGameSecond must be a non-negative integer");
  if (typeof lifecycle.lastTransitionRequestId !== "string" || !lifecycle.lastTransitionRequestId.trim()) issues.push("transition request is required");
  const sceneValidation = validatePlayableSceneV1(input.destinationScene);
  if (!sceneValidation.ok) issues.push(...sceneValidation.issues.map(issue => `destinationScene: ${issue}`));
  if (input.authoritySourceRefs.length === 0 || input.authoritySourceRefs.some(ref => !ref.trim())) issues.push("authoritySourceRefs are required");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: SCENE_ARRIVAL_CONTRACT_VERSION_V1,
      commitId: input.commit.commitId,
      transitionRequestId: lifecycle.lastTransitionRequestId!,
      destinationRef: lifecycle.activeLocationRef!,
      previousSceneId: lifecycle.previousSceneId!,
      enteredAtGameSecond: lifecycle.enteredAtGameSecond!,
      scene: cloneJson(input.destinationScene),
      authoritySourceRefs: [...input.authoritySourceRefs],
      reconstructionRefs: [
        `commit:${input.commit.commitId}`,
        `aggregate:world.position:${input.positionAggregate.aggregateId}:${input.positionAggregate.aggregateRevision}`,
        `aggregate:scene.lifecycle:${input.sceneLifecycleAggregate.aggregateId}:${input.sceneLifecycleAggregate.aggregateRevision}`
      ],
      narrationStatus: "READY_AFTER_COMMIT",
      version: 1
    }
  };
}

function commitContainsAggregate(commit: CommitRecord, aggregate: AggregateRecord): boolean {
  return commit.aggregateWrites.some(write =>
    write.aggregateType === aggregate.aggregateType &&
    write.aggregateId === aggregate.aggregateId &&
    write.aggregateRevision === aggregate.aggregateRevision
  );
}
