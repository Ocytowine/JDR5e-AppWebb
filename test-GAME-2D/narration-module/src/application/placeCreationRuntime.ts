import {
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type CommitId,
  type OperationRecord,
  type OperationId,
  type Result,
  type RepositoryClock,
  type RequestId,
  type IdempotencyKey,
  type CommandId,
  type EventId,
  type WriterId
} from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";
import {
  buildDynamicPlaceSceneAfterCommitV1,
  buildPlaceCreationCommitV1,
  preparePlaceCreationCommandV1
} from "./placeCreationCommit";
import type { PlaceCreationValidationResultV1 } from "./placeCreationValidation";
import type { SceneTransitionTopologyV1 } from "./sceneTransition";

export const DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1 = opaqueId<AggregateId>("agg-dynamic-place-registry");
export const DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1 = opaqueId<AggregateId>("agg-dynamic-place-topology");
export const DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1 = opaqueId<AggregateId>("agg-dynamic-place-facts");

export async function ensureDynamicPlaceCreationStateV1(input: { repository: CampaignRepository; campaignId: CampaignId; clock: RepositoryClock; topology: SceneTransitionTopologyV1 }): Promise<void> {
  const ids = [
    ["world.place-registry", DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1],
    ["world.scene-topology", DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1],
    ["campaign.place-facts", DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1]
  ] as const;
  const current = await Promise.all(ids.map(([type, id]) => input.repository.getAggregate(input.campaignId, type, id)));
  if (current.every(result => result.ok)) return;
  if (current.some(result => !result.ok && result.error.code !== "NOT_FOUND") || current.some(result => result.ok)) throw new Error("Dynamic place bootstrap state is inconsistent");
  const campaign = await input.repository.getCampaign(input.campaignId); if (!campaign.ok) throw new Error(campaign.error.messageKey);
  const operationId = opaqueId<OperationId>("dynamic-place-bootstrap");
  const payload = { kind: "dynamic.place.bootstrap", topologyId: input.topology.topologyId };
  const fingerprint = await computeRequestFingerprint("dynamic.place.bootstrap", 1, payload);
  const now = input.clock.now().toISOString();
  const operation: OperationRecord = { schemaVersion: 1, operationId, campaignId: input.campaignId, clientRequestId: opaqueId<RequestId>("dynamic-place-bootstrap"), idempotencyKey: opaqueId<IdempotencyKey>("dynamic-place-bootstrap"), requestFingerprint: fingerprint, operationKind: "dynamic.place.bootstrap", requestPayloadSchemaVersion: 1, requestPayload: payload, phase: "RECEIVED", observedCampaignRevision: campaign.value.campaignRevision, commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null, receivedAt: now, updatedAt: now };
  const received = await input.repository.receiveOperation(operation); if (!received.ok) throw new Error(received.error.messageKey);
  if (received.value.phase === "COMPLETED") return;
  const preparing = await input.repository.transitionOperation(operationId, "RECEIVED", "PREPARING"); if (!preparing.ok) throw new Error(preparing.error.messageKey);
  const ready = await input.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT"); if (!ready.ok) throw new Error(ready.error.messageKey);
  const lease = await input.repository.acquireWriterLease(input.campaignId, opaqueId<WriterId>("dynamic-place-bootstrap-writer"), 120_000); if (!lease.ok) throw new Error(lease.error.messageKey);
  const commandId = opaqueId<CommandId>("dynamic-place-bootstrap-command");
  let commit;
  try {
    commit = await input.repository.commit({ campaignId: input.campaignId, operationId, commitId: opaqueId<CommitId>("dynamic-place-bootstrap-commit"), idempotencyKey: operation.idempotencyKey, requestFingerprint: fingerprint, expectedCampaignRevision: campaign.value.campaignRevision, writerLease: lease.value,
    acceptedCommands: [{ schemaVersion: 1, contractId: "dynamic-place-bootstrap", contractVersion: 1, commandId, campaignId: input.campaignId, operationId, commandType: "dynamic.place.bootstrap", target: { aggregateType: "world.place-registry", aggregateId: DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1, expectedAggregateRevision: null }, payloadSchemaVersion: 1, payload, acceptedAtGameSecond: 0 }],
    aggregateWrites: [
      { aggregateType: "world.place-registry", aggregateId: DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "world-place-registry/1", places: [], version: 1 } },
      { aggregateType: "world.scene-topology", aggregateId: DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "world-scene-topology/1", topology: input.topology, version: 1 } },
      { aggregateType: "campaign.place-facts", aggregateId: DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "campaign-place-facts/1", facts: [], version: 1 } }
    ], events: [{ schemaVersion: 1, eventId: opaqueId<EventId>("dynamic-place-bootstrap-event"), campaignId: input.campaignId, operationId, eventType: "dynamic.place.initialized", origin: "SYSTEM", causation: { kind: "COMMAND", id: commandId }, aggregateRefs: ids.map(([aggregateType, aggregateId]) => ({ aggregateType, aggregateId, aggregateRevision: 0 })), visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0, payloadSchemaVersion: 1, payload }], outboxTasks: [] });
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
  if (!commit.ok) throw new Error(commit.error.messageKey);
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, { initialized: true }); if (!completed.ok) throw new Error(completed.error.messageKey);
}

export interface PlaceCreationRuntimeRequestV1 {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  validation: Extract<PlaceCreationValidationResultV1, { ok: true }>;
  placeRegistryAggregateId: AggregateId;
  topologyAggregateId: AggregateId;
  factRegistryAggregateId: AggregateId;
  commandId: string;
  commitId: CommitId;
  acceptedAtGameSecond: number;
}

export interface PlaceCreationRuntimeResultV1 {
  commitId: CommitId;
  placeRef: string;
  scene: PlayableSceneStateV1;
}

/** Executes the already validated PLACE proposal. It owns persistence, never creation prose. */
export async function executePlaceCreationRuntimeV1(
  input: PlaceCreationRuntimeRequestV1
): Promise<Result<PlaceCreationRuntimeResultV1>> {
  if (input.operation.campaignId !== input.campaignId || input.operation.phase !== "RECEIVED") {
    return { ok: false, error: coreError("VALIDATION_FAILED", "narrative.place-creation.operation-invalid") };
  }
  const preparing = await input.repository.transitionOperation(input.operation.operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(input.operation.operationId, "PREPARING", "READY_TO_COMMIT");
  if (!ready.ok) return ready;
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:place-creation:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const current = await readPlaceCreationAggregates(input.repository, input.campaignId, input);
    if (!current.ok) return current;
    const command = preparePlaceCreationCommandV1({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandId: input.commandId,
      idempotencyKey: input.operation.idempotencyKey,
      validation: input.validation,
      ...current.value
    });
    if (!command.ok) return invalid("narrative.place-creation.command-invalid", command.issues);
    const commit = buildPlaceCreationCommitV1({
      command: command.command,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: input.commitId,
      expectedCampaignRevision: campaign.value.campaignRevision,
      requestFingerprint: input.operation.requestFingerprint,
      writerLease: lease.value,
      acceptedAtGameSecond: input.acceptedAtGameSecond,
      ...current.value
    });
    if (!commit.ok) return invalid("narrative.place-creation.commit-invalid", commit.issues);
    let committed = await input.repository.commit(commit.commit);
    if (!committed.ok && committed.error.code === "PERSISTENCE_FAILURE") {
      const recovered = await input.repository.getCommitByIdempotencyKey(input.campaignId, commit.commit.idempotencyKey);
      if (recovered.ok && recovered.value.requestFingerprint === commit.commit.requestFingerprint) committed = recovered;
    }
    if (!committed.ok) return committed;

    const confirmed = await readPlaceCreationAggregates(input.repository, input.campaignId, input);
    if (!confirmed.ok) return confirmed;
    const reconstructed = buildDynamicPlaceSceneAfterCommitV1({
      commit: committed.value,
      placeRef: command.command.place.placeRef,
      ...confirmed.value
    });
    if (!reconstructed.ok) {
      return {
        ok: false,
        error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.place-creation.post-commit-reconstruction-failed", {
          commitId: committed.value.commitId,
          issues: reconstructed.issues
        })
      };
    }
    return {
      ok: true,
      value: {
        commitId: committed.value.commitId,
        placeRef: command.command.place.placeRef,
        scene: reconstructed.scene
      }
    };
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function readPlaceCreationAggregates(
  repository: CampaignRepository,
  campaignId: CampaignId,
  ids: Pick<PlaceCreationRuntimeRequestV1, "placeRegistryAggregateId" | "topologyAggregateId" | "factRegistryAggregateId">
) {
  const [placeRegistry, topology, facts] = await Promise.all([
    repository.getAggregate(campaignId, "world.place-registry", ids.placeRegistryAggregateId),
    repository.getAggregate(campaignId, "world.scene-topology", ids.topologyAggregateId),
    repository.getAggregate(campaignId, "campaign.place-facts", ids.factRegistryAggregateId)
  ]);
  if (!placeRegistry.ok) return placeRegistry;
  if (!topology.ok) return topology;
  if (!facts.ok) return facts;
  return {
    ok: true as const,
    value: {
      placeRegistryAggregate: placeRegistry.value,
      topologyAggregate: topology.value,
      factRegistryAggregate: facts.value
    }
  };
}

function invalid(messageKey: string, issues: string[]): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
