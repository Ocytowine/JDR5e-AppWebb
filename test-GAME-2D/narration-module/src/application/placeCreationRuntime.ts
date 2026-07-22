import {
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type CommitId,
  type OperationRecord,
  type Result,
  type WriterId
} from "../core";
import type { PlayableSceneStateV1 } from "./playableScene";
import {
  buildDynamicPlaceSceneAfterCommitV1,
  buildPlaceCreationCommitV1,
  preparePlaceCreationCommandV1
} from "./placeCreationCommit";
import type { PlaceCreationValidationResultV1 } from "./placeCreationValidation";

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
