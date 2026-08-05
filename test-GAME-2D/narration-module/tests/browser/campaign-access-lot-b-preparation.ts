import {
  IndexedDbCampaignRepository,
  cloneJson,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type WriterId
} from "../../src/core";
import {
  loadAccessControlRegistryV1,
  loadRulesAccessAttemptRegistryV1
} from "../../src/application";
import {
  PLAYABLE_CAMPAIGN_DATABASE_NAME_V1,
  createPlayableCampaignControllerV1
} from "../../../src/narration-ui/playableCampaignBootstrap";
import { readActiveCharacterSheetV1 } from
  "../../../src/narration-ui/activeCharacterSheetAdapter";
import {
  ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1,
  THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1,
  THARQUAL_PASSAGE_ORDER_ITEM_ID_V1
} from "../../../src/narration-ui/playableCampaignAccessCatalog";

export async function prepareCampaignAtTharqualBarracksThresholdV1():
Promise<void> {
  return prepareCampaignAtAccessThresholdV1({
    certificationId: "access-lot-b",
    sceneId: "wiki-location:caserne_centrale",
    locationRef: "location:caserne_centrale"
  });
}

export async function prepareCampaignAtArdherneRockfallThresholdV1():
Promise<void> {
  return prepareCampaignAtAccessThresholdV1({
    certificationId: "access-lot-f",
    sceneId: "wiki-location:passage_eboule_du_torrent",
    locationRef: "location:passage_eboule_du_torrent"
  });
}

async function prepareCampaignAtAccessThresholdV1(input: {
  certificationId: string;
  sceneId: string;
  locationRef: string;
}): Promise<void> {
  const campaignId = readCampaignId();
  const token = campaignId.replace(/^cmp-player-/, "");
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const operationId = opaqueId<OperationId>(
      `certification:${input.certificationId}:place-at-threshold`
    );
    const existing = await repository.getOperation(operationId);
    if (existing.ok) return;
    if (existing.error.code !== "NOT_FOUND") throw new Error(existing.error.messageKey);
    const campaign = await repository.getCampaign(campaignId);
    if (!campaign.ok) throw new Error(campaign.error.messageKey);
    const lifecycleId = opaqueId<AggregateId>(`agg-scene-lifecycle-${token}`);
    const positionId = opaqueId<AggregateId>(`agg-position-${token}`);
    const [lifecycle, position] = await Promise.all([
      repository.getAggregate(campaignId, "scene.lifecycle", lifecycleId),
      repository.getAggregate(campaignId, "world.position", positionId)
    ]);
    if (!lifecycle.ok) throw new Error(lifecycle.error.messageKey);
    if (!position.ok) throw new Error(position.error.messageKey);
    const requestPayload = {
      schemaVersion: 1,
      sceneId: input.sceneId,
      locationRef: input.locationRef
    };
    const requestFingerprint = await computeRequestFingerprint(
      `certification.${input.certificationId}.place-at-threshold`,
      1,
      requestPayload
    );
    const now = new Date().toISOString();
    const operation: OperationRecord = {
      schemaVersion: 1,
      operationId,
      campaignId,
      clientRequestId: opaqueId<RequestId>(`${operationId}:request`),
      idempotencyKey: opaqueId<IdempotencyKey>(`${operationId}:key`),
      requestFingerprint,
      operationKind: `certification.${input.certificationId}.place-at-threshold`,
      requestPayloadSchemaVersion: 1,
      requestPayload,
      phase: "RECEIVED",
      observedCampaignRevision: campaign.value.campaignRevision,
      commitId: null,
      completionMode: null,
      resultPayloadSchemaVersion: null,
      resultPayload: null,
      failure: null,
      receivedAt: now,
      updatedAt: now
    };
    const received = await repository.receiveOperation(operation);
    if (!received.ok) throw new Error(received.error.messageKey);
    const preparing = await repository.transitionOperation(
      operationId,
      "RECEIVED",
      "PREPARING"
    );
    if (!preparing.ok) throw new Error(preparing.error.messageKey);
    const ready = await repository.transitionOperation(
      operationId,
      "PREPARING",
      "READY_TO_COMMIT"
    );
    if (!ready.ok) throw new Error(ready.error.messageKey);
    const lease = await repository.acquireWriterLease(
      campaignId,
      opaqueId<WriterId>(`${operationId}:writer`),
      120_000
    );
    if (!lease.ok) throw new Error(lease.error.messageKey);
    try {
      const commandId = opaqueId<CommandId>(`${operationId}:command`);
      const lifecyclePayload = cloneJson(lifecycle.value.payload);
      lifecyclePayload.previousSceneId = lifecyclePayload.activeSceneId;
      lifecyclePayload.activeSceneId = requestPayload.sceneId;
      lifecyclePayload.activeLocationRef = requestPayload.locationRef;
      lifecyclePayload.lastTransitionRequestId = `${operationId}:setup`;
      lifecyclePayload.version = Number(lifecyclePayload.version) + 1;
      const committed = await repository.commit({
        campaignId,
        operationId,
        commitId: opaqueId<CommitId>(`${operationId}:commit`),
        idempotencyKey: operation.idempotencyKey,
        requestFingerprint,
        expectedCampaignRevision: campaign.value.campaignRevision,
        writerLease: lease.value,
        acceptedCommands: [{
          schemaVersion: 1,
          contractId: "certification-access-lot-b",
          contractVersion: 1,
          commandId,
          campaignId,
          operationId,
          commandType: operation.operationKind,
          target: {
            aggregateType: "scene.lifecycle",
            aggregateId: lifecycleId,
            expectedAggregateRevision: lifecycle.value.aggregateRevision
          },
          payloadSchemaVersion: 1,
          payload: requestPayload,
          acceptedAtGameSecond: 0
        }],
        aggregateWrites: [{
          aggregateType: "scene.lifecycle",
          aggregateId: lifecycleId,
          expectedAggregateRevision: lifecycle.value.aggregateRevision,
          payloadSchemaVersion: 1,
          payload: lifecyclePayload
        }, {
          aggregateType: "world.position",
          aggregateId: positionId,
          expectedAggregateRevision: position.value.aggregateRevision,
          payloadSchemaVersion: 1,
          payload: {
            ...cloneJson(position.value.payload),
            canonicalLocationRef: requestPayload.locationRef
          }
        }],
        events: [{
          schemaVersion: 1,
          eventId: opaqueId<EventId>(`${operationId}:event`),
          campaignId,
          operationId,
          eventType: "certification.access-threshold-reached",
          origin: "SYSTEM",
          causation: { kind: "COMMAND", id: commandId },
          aggregateRefs: [{
            aggregateType: "scene.lifecycle",
            aggregateId: lifecycleId,
            aggregateRevision: lifecycle.value.aggregateRevision + 1
          }, {
            aggregateType: "world.position",
            aggregateId: positionId,
            aggregateRevision: position.value.aggregateRevision + 1
          }],
          visibility: { scope: "SYSTEM", actorIds: [] },
          occurredAtGameSecond: 0,
          payloadSchemaVersion: 1,
          payload: requestPayload
        }],
        outboxTasks: []
      });
      if (!committed.ok) throw new Error(committed.error.messageKey);
      const completed = await repository.completePresentation(
        operationId,
        "COMMITTED_RENDERED",
        1,
        { schemaVersion: 1, status: "AT_THRESHOLD" }
      );
      if (!completed.ok) throw new Error(completed.error.messageKey);
    } finally {
      await repository.releaseWriterLease(lease.value);
    }
  } finally {
    repository.close();
  }
}

export async function inspectTharqualRulesAccessLotDV1(): Promise<{
  state: string;
  attemptCount: number;
  outcome: string | null;
  noise: string | null;
  elapsedGameSeconds: number;
}> {
  const campaignId = readCampaignId();
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const campaign = await repository.getCampaign(campaignId);
    if (!campaign.ok) throw new Error(campaign.error.messageKey);
    const [access, attempts, clock] = await Promise.all([
      loadAccessControlRegistryV1(repository, campaignId),
      loadRulesAccessAttemptRegistryV1(repository, campaignId),
      repository.getAggregate(campaignId, "world.clock", campaign.value.clockAggregateId)
    ]);
    if (!access.ok) throw new Error(access.error.messageKey);
    if (!attempts.ok) throw new Error(attempts.error.messageKey);
    if (!clock.ok) throw new Error(clock.error.messageKey);
    const latest = attempts.value.state.attempts.at(-1) ?? null;
    return {
      state: access.value.state.controls.find(control =>
        control.accessControlRef === THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1
      )?.state ?? "MISSING",
      attemptCount: attempts.value.state.attempts.length,
      outcome: latest?.checkResolution?.outcome ?? null,
      noise: latest?.checkResolution?.noise ?? null,
      elapsedGameSeconds: Number(clock.value.payload.elapsedGameSeconds)
    };
  } finally {
    repository.close();
  }
}

export async function prepareTharqualTacticalAccessTerminalV1():
Promise<string> {
  const sheet = await readActiveCharacterSheetV1();
  if (!sheet.ok) {
    throw new Error(sheet.diagnostics.map(value => value.code).join("|"));
  }
  const bootstrap = await createPlayableCampaignControllerV1(
    sheet.value,
    "local"
  );
  const restored =
    await bootstrap.controller.restoreActiveBastionTacticalSession();
  if (!restored.ok) throw new Error(restored.error.messageKey);
  if (restored.value === null || restored.value.checkpoint === null) {
    throw new Error("lot E tactical checkpoint unavailable");
  }
  const ownerState = cloneJson(
    restored.value.checkpoint.ownerState
  ) as JsonObject;
  if (!Array.isArray(ownerState.enemies)) {
    throw new Error("lot E tactical enemies unavailable");
  }
  ownerState.enemies = ownerState.enemies.map(value => ({
    ...(value as JsonObject),
    hp: 0
  }));
  if (
    ownerState.player !== null
    && typeof ownerState.player === "object"
    && !Array.isArray(ownerState.player)
  ) {
    ownerState.player = {
      ...(ownerState.player as JsonObject),
      hp: Math.max(1, Number((ownerState.player as JsonObject).hp ?? 1))
    };
  }
  ownerState.turnBoundaryId = "terminal-preparation-access-lot-e";
  const saved = await bootstrap.controller.saveTacticalCheckpoint({
    schemaVersion: 1,
    processId: restored.value.process.processId,
    clientRequestId: `access-lot-e-terminal:${restored.value.process.processId}`,
    lastAppliedTurnId: "terminal-preparation-access-lot-e",
    ownerState
  });
  if (!saved.ok) throw new Error(saved.error.messageKey);
  return saved.value.checkpointId;
}

export async function inspectTharqualTacticalAccessLotEV1(): Promise<{
  state: string;
  elapsedGameSeconds: number;
  handoffStartedCount: number;
  resolvedCount: number;
  activeProcessId: string | null;
}> {
  const campaignId = readCampaignId();
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const campaign = await repository.getCampaign(campaignId);
    if (!campaign.ok) throw new Error(campaign.error.messageKey);
    const [access, clock, events] = await Promise.all([
      loadAccessControlRegistryV1(repository, campaignId),
      repository.getAggregate(
        campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      ),
      repository.listEvents(campaignId, null, 500)
    ]);
    if (!access.ok) throw new Error(access.error.messageKey);
    if (!clock.ok) throw new Error(clock.error.messageKey);
    if (!events.ok) throw new Error(events.error.messageKey);
    const started = events.value.filter(event =>
      event.eventType === "access_tactical_handoff_started"
    );
    const resolved = events.value.filter(event =>
      event.eventType === "access_tactical_resolved"
    );
    const latest = started.at(-1);
    return {
      state: access.value.state.controls.find(control =>
        control.accessControlRef === THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1
      )?.state ?? "MISSING",
      elapsedGameSeconds: Number(clock.value.payload.elapsedGameSeconds),
      handoffStartedCount: started.length,
      resolvedCount: resolved.length,
      activeProcessId: latest === undefined
        ? null
        : String(latest.payload.tacticalProcessId ?? "") || null
    };
  } finally {
    repository.close();
  }
}

export async function inspectTharqualAccessLotBV1(): Promise<{
  state: string;
  activeSceneId: string;
  passageOrderPresent: boolean;
}> {
  const campaignId = readCampaignId();
  const token = campaignId.replace(/^cmp-player-/, "");
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const [registry, lifecycle, events] = await Promise.all([
      loadAccessControlRegistryV1(repository, campaignId),
      repository.getAggregate(
        campaignId,
        "scene.lifecycle",
        opaqueId(`agg-scene-lifecycle-${token}`)
      ),
      repository.listEvents(campaignId, null, 100)
    ]);
    if (!registry.ok) throw new Error(registry.error.messageKey);
    if (!lifecycle.ok) throw new Error(lifecycle.error.messageKey);
    if (!events.ok) throw new Error(events.error.messageKey);
    const bootstrap = events.value.find(event =>
      event.eventType === "campaign.bootstrapped"
    );
    const characterRef = bootstrap?.aggregateRefs.find(ref =>
      ref.aggregateType === "character.state"
    );
    if (characterRef === undefined) throw new Error("character ref missing");
    const character = await repository.getAggregate(
      campaignId,
      characterRef.aggregateType,
      characterRef.aggregateId
    );
    if (!character.ok) throw new Error(character.error.messageKey);
    const inventory = character.value.payload.inventory;
    return {
      state: registry.value.state.controls.find(control =>
        control.accessControlRef === THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1
      )?.state ?? "MISSING",
      activeSceneId: String(lifecycle.value.payload.activeSceneId),
      passageOrderPresent: Array.isArray(inventory) && inventory.some(item =>
        item !== null && typeof item === "object" && !Array.isArray(item)
        && item.itemId === THARQUAL_PASSAGE_ORDER_ITEM_ID_V1
      )
    };
  } finally {
    repository.close();
  }
}

export async function inspectMultiRegionAccessLotFV1(): Promise<{
  ardherneState: string;
  tharqualState: string;
  installedControlCount: number;
  activeSceneId: string;
  attemptCount: number;
  outcome: string | null;
  noise: string | null;
  elapsedGameSeconds: number;
  swordPresent: boolean;
}> {
  const campaignId = readCampaignId();
  const token = campaignId.replace(/^cmp-player-/, "");
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const campaign = await repository.getCampaign(campaignId);
    if (!campaign.ok) throw new Error(campaign.error.messageKey);
    const [access, attempts, lifecycle, clock, events] = await Promise.all([
      loadAccessControlRegistryV1(repository, campaignId),
      loadRulesAccessAttemptRegistryV1(repository, campaignId),
      repository.getAggregate(
        campaignId,
        "scene.lifecycle",
        opaqueId(`agg-scene-lifecycle-${token}`)
      ),
      repository.getAggregate(
        campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      ),
      repository.listEvents(campaignId, null, 100)
    ]);
    if (!access.ok) throw new Error(access.error.messageKey);
    if (!attempts.ok) throw new Error(attempts.error.messageKey);
    if (!lifecycle.ok) throw new Error(lifecycle.error.messageKey);
    if (!clock.ok) throw new Error(clock.error.messageKey);
    if (!events.ok) throw new Error(events.error.messageKey);
    const bootstrap = events.value.find(event => event.eventType === "campaign.bootstrapped");
    const characterRef = bootstrap?.aggregateRefs.find(ref =>
      ref.aggregateType === "character.state"
    );
    if (characterRef === undefined) throw new Error("character ref missing");
    const character = await repository.getAggregate(
      campaignId,
      characterRef.aggregateType,
      characterRef.aggregateId
    );
    if (!character.ok) throw new Error(character.error.messageKey);
    const latest = attempts.value.state.attempts.filter(attempt =>
      attempt.accessControlRef === ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1
    ).at(-1) ?? null;
    const inventory = character.value.payload.inventory;
    return {
      ardherneState: access.value.state.controls.find(control =>
        control.accessControlRef === ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1
      )?.state ?? "MISSING",
      tharqualState: access.value.state.controls.find(control =>
        control.accessControlRef === THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1
      )?.state ?? "MISSING",
      installedControlCount: access.value.state.controls.length,
      activeSceneId: String(lifecycle.value.payload.activeSceneId),
      attemptCount: attempts.value.state.attempts.filter(attempt =>
        attempt.accessControlRef === ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1
      ).length,
      outcome: latest?.checkResolution?.outcome ?? null,
      noise: latest?.checkResolution?.noise ?? null,
      elapsedGameSeconds: Number(clock.value.payload.elapsedGameSeconds),
      swordPresent: Array.isArray(inventory) && inventory.some(item =>
        item !== null && typeof item === "object" && !Array.isArray(item)
        && item.itemId === "epee-longue"
      )
    };
  } finally {
    repository.close();
  }
}

function readCampaignId(): CampaignId {
  const raw = localStorage.getItem("jdr5e_narration_bootstrap_envelopes_v1");
  if (raw === null) throw new Error("bootstrap envelope missing");
  const records = JSON.parse(raw) as Record<string, { campaignId?: unknown }>;
  const campaignId = Object.values(records)[0]?.campaignId;
  if (typeof campaignId !== "string") throw new Error("campaign id missing");
  return opaqueId<CampaignId>(campaignId);
}
