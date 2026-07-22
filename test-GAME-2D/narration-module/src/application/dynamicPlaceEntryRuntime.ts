import {
  coreError,
  opaqueId,
  type AggregateId,
  type AggregateRecord,
  type CampaignRecord,
  type CommitId,
  type CommitRequest,
  type JsonObject,
  type OperationRecord,
  type Result,
  type WriterId,
  type WriterLease
} from "../core";
import type { DisplayPacketV1 } from "../scene";
import type { NarrativeDynamicPlaceRuntimeV1 } from "./NarrativeTurnController";
import { buildSceneArrivalAfterCommitV1, type SceneArrivalStateV1 } from "./sceneArrival";
import { buildSceneArrivalDisplayPacketV1 } from "./sceneArrivalRender";
import {
  buildDynamicPlaceSceneAfterCommitV1,
  buildPlaceCreationCommitV1,
  preparePlaceCreationCommandV1
} from "./placeCreationCommit";
import type { PlaceCreationValidationResultV1 } from "./placeCreationValidation";
import type { PlayableSceneStateV1 } from "./playableScene";
import {
  augmentTemporalCommitWithSceneTransitionV1,
  type WorldPreparedSceneTransitionV1
} from "./sceneTransitionCommit";
import type { SceneTransitionWorldCommandV1 } from "./sceneTransitionAdapter";

export interface DynamicPlaceEntryPreparationV1 {
  placeRegistryAggregateId: AggregateId;
  topologyAggregateId: AggregateId;
  factRegistryAggregateId: AggregateId;
  positionAggregate: AggregateRecord;
  sceneLifecycleAggregate: AggregateRecord;
  temporalCommit: CommitRequest;
  transitionCommand: SceneTransitionWorldCommandV1;
  worldResult: WorldPreparedSceneTransitionV1;
  placeCommandId: string;
  commitId: CommitId;
  currentGameSecond: number;
  characterExpression: string;
  authoritySourceRefs: string[];
}

export interface DynamicPlaceEntryCreativePreparationV1 {
  validation: Extract<PlaceCreationValidationResultV1, { ok: true }>;
}

export interface DynamicPlaceEntryPreparationPortV1<TCreative extends DynamicPlaceEntryCreativePreparationV1 = DynamicPlaceEntryCreativePreparationV1> {
  canHandle(input: Parameters<NarrativeDynamicPlaceRuntimeV1["canHandle"]>[0]): Promise<boolean> | boolean;
  prepareCreative(input: {
    repository: Parameters<NarrativeDynamicPlaceRuntimeV1["execute"]>[0]["repository"];
    campaign: CampaignRecord;
    operation: OperationRecord;
    rawInput: string;
    interpretation: Parameters<NarrativeDynamicPlaceRuntimeV1["execute"]>[0]["interpretation"];
    domainCommand: Parameters<NarrativeDynamicPlaceRuntimeV1["execute"]>[0]["domainCommand"];
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<TCreative>>;
  prepareWorldCommit(input: {
    repository: Parameters<NarrativeDynamicPlaceRuntimeV1["execute"]>[0]["repository"];
    campaign: CampaignRecord;
    operation: OperationRecord;
    rawInput: string;
    interpretation: Parameters<NarrativeDynamicPlaceRuntimeV1["execute"]>[0]["interpretation"];
    domainCommand: Parameters<NarrativeDynamicPlaceRuntimeV1["execute"]>[0]["domainCommand"];
    activeScene: PlayableSceneStateV1;
    creative: TCreative;
    writerLease: WriterLease;
  }): Promise<Result<DynamicPlaceEntryPreparationV1>>;
}

/** Composes creative preparation with the existing world/time authorities in one atomic commit. */
export function createDynamicPlaceEntryRuntimeV1<TCreative extends DynamicPlaceEntryCreativePreparationV1>(
  preparationPort: DynamicPlaceEntryPreparationPortV1<TCreative>
): NarrativeDynamicPlaceRuntimeV1 {
  return {
    canHandle: input => preparationPort.canHandle(input),
    async execute(input) {
      const campaign = await input.repository.getCampaign(input.campaignId);
      if (!campaign.ok) return campaign;
      const creative = await preparationPort.prepareCreative({ ...input, campaign: campaign.value });
      if (!creative.ok) return creative;
      const preparing = await input.repository.transitionOperation(input.operation.operationId, "RECEIVED", "PREPARING");
      if (!preparing.ok) return preparing;
      const ready = await input.repository.transitionOperation(input.operation.operationId, "PREPARING", "READY_TO_COMMIT");
      if (!ready.ok) return ready;
      const lease = await input.repository.acquireWriterLease(
        input.campaignId,
        opaqueId<WriterId>(`${input.operation.operationId}:dynamic-place-entry:writer`),
        120_000
      );
      if (!lease.ok) return lease;
      try {
        const prepared = await preparationPort.prepareWorldCommit({
          ...input,
          campaign: campaign.value,
          operation: ready.value,
          creative: creative.value,
          writerLease: lease.value
        });
        if (!prepared.ok) return prepared;
        const registries = await readRegistries(input.repository, input.campaignId, prepared.value);
        if (!registries.ok) return registries;
        const placeCommand = preparePlaceCreationCommandV1({
          campaignId: input.campaignId,
          operationId: input.operation.operationId,
          commandId: prepared.value.placeCommandId,
          idempotencyKey: input.operation.idempotencyKey,
          validation: creative.value.validation,
          ...registries.value
        });
        if (!placeCommand.ok) return invalid("narrative.dynamic-place-entry.place-command-invalid", placeCommand.issues);
        const placeCommit = buildPlaceCreationCommitV1({
          command: placeCommand.command,
          campaignId: input.campaignId,
          operationId: input.operation.operationId,
          commitId: prepared.value.commitId,
          expectedCampaignRevision: campaign.value.campaignRevision,
          requestFingerprint: input.operation.requestFingerprint,
          writerLease: lease.value,
          acceptedAtGameSecond: prepared.value.worldResult.effectiveAtGameSecond,
          ...registries.value
        });
        if (!placeCommit.ok) return invalid("narrative.dynamic-place-entry.place-commit-invalid", placeCommit.issues);
        const merged = mergePlaceCreationWithTemporalCommitV1({
          temporalCommit: prepared.value.temporalCommit,
          placeCommit: placeCommit.commit,
          writerLease: lease.value
        });
        if (!merged.ok) return invalid("narrative.dynamic-place-entry.composite-commit-invalid", merged.issues);
        const atomic = augmentTemporalCommitWithSceneTransitionV1({
          temporalCommit: merged.commit,
          command: prepared.value.transitionCommand,
          result: prepared.value.worldResult,
          currentGameSecond: prepared.value.currentGameSecond,
          currentPositionAggregate: prepared.value.positionAggregate,
          sceneLifecycleAggregate: prepared.value.sceneLifecycleAggregate
        });
        if (!atomic.ok) return invalid("narrative.dynamic-place-entry.transition-invalid", atomic.issues);
        let committed = await input.repository.commit(atomic.value);
        if (!committed.ok && committed.error.code === "PERSISTENCE_FAILURE") {
          const recovered = await input.repository.getCommitByIdempotencyKey(input.campaignId, atomic.value.idempotencyKey);
          if (recovered.ok && recovered.value.requestFingerprint === atomic.value.requestFingerprint) committed = recovered;
        }
        if (!committed.ok) return committed;

        const [confirmedRegistries, position, lifecycle] = await Promise.all([
          readRegistries(input.repository, input.campaignId, prepared.value),
          input.repository.getAggregate(input.campaignId, "world.position", prepared.value.positionAggregate.aggregateId),
          input.repository.getAggregate(input.campaignId, "scene.lifecycle", prepared.value.sceneLifecycleAggregate.aggregateId)
        ]);
        if (!confirmedRegistries.ok) return confirmedRegistries;
        if (!position.ok) return position;
        if (!lifecycle.ok) return lifecycle;
        const scene = buildDynamicPlaceSceneAfterCommitV1({
          commit: committed.value,
          placeRef: placeCommand.command.place.placeRef,
          ...confirmedRegistries.value
        });
        if (!scene.ok) return integrity("narrative.dynamic-place-entry.scene-reconstruction-failed", committed.value.commitId, scene.issues);
        const arrival = buildSceneArrivalAfterCommitV1({
          commit: committed.value,
          positionAggregate: position.value,
          sceneLifecycleAggregate: lifecycle.value,
          destinationScene: scene.scene,
          authoritySourceRefs: prepared.value.authoritySourceRefs
        });
        if (!arrival.ok) return integrity("narrative.dynamic-place-entry.arrival-reconstruction-failed", committed.value.commitId, arrival.issues);
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
            }) as DisplayPacketV1 & JsonObject,
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

export function mergePlaceCreationWithTemporalCommitV1(input: {
  temporalCommit: CommitRequest;
  placeCommit: CommitRequest;
  writerLease: WriterLease;
}): { ok: true; commit: CommitRequest } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  for (const key of ["campaignId", "operationId", "commitId", "idempotencyKey", "requestFingerprint", "expectedCampaignRevision"] as const) {
    if (input.temporalCommit[key] !== input.placeCommit[key]) issues.push(`${key} mismatch`);
  }
  for (const commit of [input.temporalCommit, input.placeCommit]) {
    if (commit.writerLease.writerId !== input.writerLease.writerId || commit.writerLease.fencingToken !== input.writerLease.fencingToken) issues.push("writer lease mismatch");
  }
  const writeKeys = [...input.temporalCommit.aggregateWrites, ...input.placeCommit.aggregateWrites].map(write => `${write.aggregateType}:${write.aggregateId}`);
  if (new Set(writeKeys).size !== writeKeys.length) issues.push("duplicate aggregate write across place and temporal commits");
  const commandIds = [...input.temporalCommit.acceptedCommands, ...input.placeCommit.acceptedCommands].map(command => command.commandId);
  if (new Set(commandIds).size !== commandIds.length) issues.push("duplicate command id across place and temporal commits");
  const eventIds = [...input.temporalCommit.events, ...input.placeCommit.events].map(event => event.eventId);
  if (new Set(eventIds).size !== eventIds.length) issues.push("duplicate event id across place and temporal commits");
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    commit: {
      ...input.temporalCommit,
      acceptedCommands: [...input.temporalCommit.acceptedCommands, ...input.placeCommit.acceptedCommands],
      aggregateWrites: [...input.temporalCommit.aggregateWrites, ...input.placeCommit.aggregateWrites],
      events: [...input.temporalCommit.events, ...input.placeCommit.events],
      outboxTasks: [...input.temporalCommit.outboxTasks, ...input.placeCommit.outboxTasks]
    }
  };
}

async function readRegistries(repository: Parameters<NarrativeDynamicPlaceRuntimeV1["execute"]>[0]["repository"], campaignId: Parameters<NarrativeDynamicPlaceRuntimeV1["execute"]>[0]["campaignId"], ids: Pick<DynamicPlaceEntryPreparationV1, "placeRegistryAggregateId" | "topologyAggregateId" | "factRegistryAggregateId">) {
  const [places, topology, facts] = await Promise.all([
    repository.getAggregate(campaignId, "world.place-registry", ids.placeRegistryAggregateId),
    repository.getAggregate(campaignId, "world.scene-topology", ids.topologyAggregateId),
    repository.getAggregate(campaignId, "campaign.place-facts", ids.factRegistryAggregateId)
  ]);
  if (!places.ok) return places;
  if (!topology.ok) return topology;
  if (!facts.ok) return facts;
  return { ok: true as const, value: { placeRegistryAggregate: places.value, topologyAggregate: topology.value, factRegistryAggregate: facts.value } };
}

function invalid(messageKey: string, issues: string[]): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}

function integrity(messageKey: string, commitId: string, issues: string[]): Result<never> {
  return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", messageKey, { commitId, issues }) };
}
