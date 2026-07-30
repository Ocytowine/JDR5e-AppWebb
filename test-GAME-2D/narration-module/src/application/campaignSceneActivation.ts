import {
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  validateCampaignRuntimeBindingsV1,
  type CampaignRuntimeBindingsV1
} from "./campaignRuntimeBindings";

export interface CampaignInitialSceneActivationResultV1 extends JsonObject {
  schemaVersion: 1;
  sceneId: string;
  locationRef: string;
  lifecycleAggregateId: string;
  commitId: string;
  replayed: boolean;
}

export async function activateCampaignInitialSceneV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  runtimeBindings: CampaignRuntimeBindingsV1;
  sceneId: string;
  locationRef: string;
  technicalTimestamp: string;
}): Promise<Result<CampaignInitialSceneActivationResultV1>> {
  const issues = validateCampaignRuntimeBindingsV1(input.runtimeBindings);
  if (!input.sceneId.trim()) issues.push("sceneId is required");
  if (!input.locationRef.trim()) issues.push("locationRef is required");
  if (!Number.isFinite(Date.parse(input.technicalTimestamp))) {
    issues.push("technicalTimestamp must be an instant");
  }
  if (issues.length > 0) {
    return {
      ok: false,
      error: coreError(
        "VALIDATION_FAILED",
        "campaign.scene-activation.invalid",
        { issues }
      )
    };
  }
  const payload = {
    campaignId: input.campaignId,
    sceneId: input.sceneId,
    locationRef: input.locationRef,
    runtimeBindings: input.runtimeBindings
  };
  const requestFingerprint = await computeRequestFingerprint(
    "campaign.activate-initial-scene",
    1,
    payload
  );
  const token = requestFingerprint.replace(/^sha256:/, "").slice(0, 40);
  const operationId =
    opaqueId<OperationId>(`campaign-scene-activation:${token}`);
  const existingOperation = await input.repository.getOperation(operationId);
  if (existingOperation.ok) {
    if (
      existingOperation.value.phase === "COMPLETED"
      && existingOperation.value.requestFingerprint === requestFingerprint
    ) {
      const result =
        existingOperation.value.resultPayload as
        CampaignInitialSceneActivationResultV1 | null;
      return result === null
        ? {
            ok: false,
            error: coreError(
              "CAMPAIGN_INTEGRITY_FAILURE",
              "campaign.scene-activation.result-missing"
            )
          }
        : { ok: true, value: { ...result, replayed: true } };
    }
    return {
      ok: false,
      error: coreError(
        "IDEMPOTENCY_CONFLICT",
        "campaign.scene-activation.conflict"
      )
    };
  }
  if (existingOperation.error.code !== "NOT_FOUND") {
    return existingOperation;
  }
  const [campaign, position, clock, existingLifecycle] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getAggregate(
      input.campaignId,
      "world.position",
      input.runtimeBindings.positionAggregateId
    ),
    input.repository.getCampaign(input.campaignId).then(result =>
      result.ok
        ? input.repository.getAggregate(
            input.campaignId,
            "world.clock",
            result.value.clockAggregateId
          )
        : result
    ),
    input.repository.getAggregate(
      input.campaignId,
      "scene.lifecycle",
      input.runtimeBindings.sceneLifecycleAggregateId
    )
  ]);
  if (!campaign.ok) return campaign;
  if (!position.ok) return position;
  if (!clock.ok) return clock;
  if (existingLifecycle.ok) {
    return {
      ok: false,
      error: coreError(
        "IDEMPOTENCY_CONFLICT",
        "campaign.scene-activation.lifecycle-already-exists"
      )
    };
  }
  if (existingLifecycle.error.code !== "NOT_FOUND") return existingLifecycle;
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(`campaign-scene:${token}`),
    idempotencyKey:
      opaqueId<IdempotencyKey>(`campaign-scene-activation:${token}`),
    requestFingerprint,
    operationKind: "campaign.activate-initial-scene",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: input.technicalTimestamp,
    updatedAt: input.technicalTimestamp
  };
  const received = await input.repository.receiveOperation(operation);
  if (!received.ok) return received;
  const preparing = await input.repository.transitionOperation(
    operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(
    operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`writer:campaign-scene:${token}`),
    30_000
  );
  if (!lease.ok) return lease;
  try {
    const gameSecond = Number(clock.value.payload.elapsedGameSeconds);
    const commandId =
      opaqueId<CommandId>(`command:campaign-scene:${token}`);
    const commitId = opaqueId<CommitId>(`commit:campaign-scene:${token}`);
    const lifecyclePayload = {
      schemaVersion: 1,
      contractVersion: "scene-lifecycle/1",
      activeSceneId: input.sceneId,
      activeLocationRef: input.locationRef,
      previousSceneId: null,
      enteredAtGameSecond: gameSecond,
      lastTransitionRequestId: null,
      version: 1
    };
    const committed = await input.repository.commit({
      campaignId: input.campaignId,
      operationId,
      commitId,
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: lease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "campaign-runtime-bindings",
        contractVersion: 1,
        commandId,
        campaignId: input.campaignId,
        operationId,
        commandType: "campaign.activate_initial_scene",
        target: {
          aggregateType: "scene.lifecycle",
          aggregateId: input.runtimeBindings.sceneLifecycleAggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload,
        acceptedAtGameSecond: gameSecond
      }],
      aggregateWrites: [{
        aggregateType: "world.position",
        aggregateId: input.runtimeBindings.positionAggregateId,
        expectedAggregateRevision: position.value.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: {
          ...position.value.payload,
          canonicalLocationRef: input.locationRef
        }
      }, {
        aggregateType: "scene.lifecycle",
        aggregateId: input.runtimeBindings.sceneLifecycleAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: lifecyclePayload
      }],
      events: [{
        schemaVersion: 1,
        eventId: opaqueId<EventId>(`event:campaign-scene:${token}`),
        campaignId: input.campaignId,
        operationId,
        eventType: "campaign.initial-scene.activated",
        origin: "SYSTEM",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{
          aggregateType: "world.position",
          aggregateId: input.runtimeBindings.positionAggregateId,
          aggregateRevision: position.value.aggregateRevision + 1
        }, {
          aggregateType: "scene.lifecycle",
          aggregateId: input.runtimeBindings.sceneLifecycleAggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: gameSecond,
        payloadSchemaVersion: 1,
        payload: {
          sceneId: input.sceneId,
          locationRef: input.locationRef
        }
      }],
      outboxTasks: []
    });
    if (!committed.ok) return committed;
    const result: CampaignInitialSceneActivationResultV1 = {
      schemaVersion: 1,
      sceneId: input.sceneId,
      locationRef: input.locationRef,
      lifecycleAggregateId:
        input.runtimeBindings.sceneLifecycleAggregateId,
      commitId,
      replayed: false
    };
    const completed = await input.repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      result
    );
    return completed.ok ? { ok: true, value: result } : completed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}
