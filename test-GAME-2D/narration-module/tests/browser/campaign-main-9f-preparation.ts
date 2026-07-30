import {
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  BASTION_REGISTRY_CONTRACT_V1,
  CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
  CHARACTER_PROGRESSION_REGISTRY_CONTRACT_V1,
  bastionRegistryAggregateIdV1,
  characterProgressionRegistryAggregateIdV1
} from "../../src/application";
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
  PLAYABLE_CAMPAIGN_DATABASE_NAME_V1,
  createPlayableCampaignControllerV1
} from "../../../src/narration-ui/playableCampaignBootstrap";
import {
  readActiveCharacterSheetV1
} from "../../../src/narration-ui/activeCharacterSheetAdapter";
import {
  INSTALLED_BASTION_DEFENSE_INCIDENT_REF_V1
} from "../../../src/narration-ui/playableCampaignBastionTactical";

const BASTION_ID = "bastion:certification-archives-9f";
const PLACE_REF = "location:archives_de_lysenthe";
const SOURCE_OPERATION_ID =
  opaqueId<OperationId>("world-simulation:certification-raid-9f");
const SOURCE_EVENT_ID =
  opaqueId<EventId>("event-world-simulation-certification-raid-9f");

export async function prepareCampaignMain9fVerticals(): Promise<{
  routingStatus: string;
  incidentStatus: string | null;
}> {
  const campaignId = readCampaignId();
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    await ensureAggregateOperation({
      repository,
      campaignId,
      operationId: opaqueId("certification-9f-bastion-setup"),
      operationKind: "certification.bastion.setup",
      aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: bastionRegistryAggregateIdV1(campaignId),
      aggregatePayload: {
        schemaVersion: 1,
        contractVersion: BASTION_REGISTRY_CONTRACT_V1,
        campaignId,
        bastions: [{
          schemaVersion: 1,
          bastionId: BASTION_ID,
          placeRef: PLACE_REF,
          placeDisplayName: "Maison forte des Archives",
          ownerRef: "pc-aryn",
          ownerDisplayName: "Aryn",
          status: "ACTIVE",
          sourceOperationId: "certification-9f-bastion-setup",
          sourceEventId: "certification-9f-bastion-setup:event",
          acquisitionPolicyRef: "certification-only/9f",
          placeSourceRefs: [PLACE_REF],
          establishedAtGameSecond: 0,
          installations: [],
          workOrders: [],
          occupantAssignments: [],
          occupantActivities: [],
          incidents: [],
          version: 1
        }],
        version: 1
      },
      eventId: opaqueId("certification-9f-bastion-setup:event"),
      eventType: "certification.bastion-established",
      eventOrigin: "SYSTEM",
      eventPayload: { bastionId: BASTION_ID, placeRef: PLACE_REF }
    });
    await ensureAggregateOperation({
      repository,
      campaignId,
      operationId: opaqueId("certification-9f-progression-setup"),
      operationKind: "certification.progression.setup",
      aggregateType: CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: characterProgressionRegistryAggregateIdV1(campaignId),
      aggregatePayload: {
        schemaVersion: 1,
        contractVersion: CHARACTER_PROGRESSION_REGISTRY_CONTRACT_V1,
        campaignId,
        awards: [{
          schemaVersion: 1,
          awardId: "award-certification-9f",
          characterId: "pc-aryn",
          awardKind: "CLASS_LEVEL",
          status: "CHOICE_REQUIRED",
          sourceOperationId: "certification-9f-progression-source",
          sourceEventId: "certification-9f-progression-source:event",
          policyRef: "certification-only/9f",
          availableAtGameSecond: 0,
          appliedAtGameSecond: null,
          requiredChoices: ["CLASS"],
          version: 1
        }],
        version: 1
      },
      eventId: opaqueId("certification-9f-progression-setup:event"),
      eventType: "certification.progression-available",
      eventOrigin: "SYSTEM",
      eventPayload: { awardId: "award-certification-9f" }
    });
    await ensureAggregateOperation({
      repository,
      campaignId,
      operationId: SOURCE_OPERATION_ID,
      operationKind: "world.simulation.certification-cause",
      aggregateType: "world.certification-cause",
      aggregateId: opaqueId("aggregate-world-certification-cause-9f"),
      aggregatePayload: {
        schemaVersion: 1,
        source: "CERTIFICATION_ONLY"
      },
      eventId: SOURCE_EVENT_ID,
      eventType: "world.simulation-boundary.resolved",
      eventOrigin: "WORLD_SIMULATION",
      eventPayload: {
        schemaVersion: 1,
        tickOutput: {
          tick: 1,
          events: [{
            id: "world-event-certification-raid-9f",
            payload: {
              causeKind: "BASTION_TACTICAL_DEFENSE",
              incidentDefinitionRef:
                INSTALLED_BASTION_DEFENSE_INCIDENT_REF_V1,
              targetPlaceRef: PLACE_REF,
              privateApproachRoute: "certification-hidden-route"
            }
          }]
        }
      }
    });
  } finally {
    repository.close();
  }
  const sheet = await readActiveCharacterSheetV1();
  if (!sheet.ok) throw new Error(sheet.diagnostics.map(value => value.code).join("|"));
  const bootstrap = await createPlayableCampaignControllerV1(
    sheet.value,
    "local"
  );
  const processed =
    await bootstrap.controller.processCommittedBastionCauseBoundary({
      sourceOperationId: SOURCE_OPERATION_ID,
      sourceEventId: SOURCE_EVENT_ID
    });
  if (!processed.ok) {
    throw new Error(`${processed.error.code}:${processed.error.messageKey}`);
  }
  return {
    routingStatus: processed.value.routing.status,
    incidentStatus: processed.value.incidentResult?.status ?? null
  };
}

export async function prepareCampaignMain9fTerminalCheckpoint():
Promise<string> {
  const sheet = await readActiveCharacterSheetV1();
  if (!sheet.ok) throw new Error(sheet.diagnostics.map(value => value.code).join("|"));
  const bootstrap = await createPlayableCampaignControllerV1(
    sheet.value,
    "local"
  );
  const session =
    await bootstrap.controller.restoreActiveBastionTacticalSession();
  if (!session.ok) {
    throw new Error(`${session.error.code}:${session.error.messageKey}`);
  }
  const activeSession = session.value;
  if (activeSession === null || activeSession.checkpoint === null) {
    throw new Error("9f active tactical checkpoint unavailable");
  }
  const ownerState = cloneJson(
    activeSession.checkpoint.ownerState
  ) as JsonObject;
  if (!Array.isArray(ownerState.enemies)) {
    throw new Error("9f tactical enemies unavailable");
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
      hp: Math.max(
        1,
        Number((ownerState.player as JsonObject).hp ?? 1)
      )
    };
  }
  ownerState.turnBoundaryId = "terminal-preparation-9f";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const saved = await bootstrap.controller.saveTacticalCheckpoint({
      schemaVersion: 1,
      processId: activeSession.process.processId,
      clientRequestId:
        `gate9f-terminal:${activeSession.process.processId}`,
      lastAppliedTurnId: "terminal-preparation-9f",
      ownerState
    });
    if (saved.ok) return saved.value.checkpointId;
    if (saved.error.code !== "CAMPAIGN_BUSY") {
      throw new Error(`${saved.error.code}:${saved.error.messageKey}`);
    }
    await new Promise(resolve => window.setTimeout(resolve, 25));
  }
  throw new Error("9f checkpoint queue did not become available");
}

function readCampaignId(): CampaignId {
  const raw = localStorage.getItem(
    "jdr5e_narration_bootstrap_envelopes_v1"
  );
  if (raw === null) throw new Error("9f bootstrap envelope missing");
  const records = JSON.parse(raw) as Record<string, { campaignId?: unknown }>;
  const campaignId = Object.values(records)[0]?.campaignId;
  if (typeof campaignId !== "string" || !campaignId.trim()) {
    throw new Error("9f campaign id missing");
  }
  return opaqueId<CampaignId>(campaignId);
}

async function ensureAggregateOperation(input: {
  repository: IndexedDbCampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  operationKind: string;
  aggregateType: string;
  aggregateId: AggregateId;
  aggregatePayload: JsonObject;
  eventId: EventId;
  eventType: string;
  eventOrigin: "SYSTEM" | "WORLD_SIMULATION";
  eventPayload: JsonObject;
}): Promise<void> {
  const existing = await input.repository.getOperation(input.operationId);
  if (existing.ok) return;
  if (existing.error.code !== "NOT_FOUND") {
    throw new Error(`${existing.error.code}:${existing.error.messageKey}`);
  }
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) {
    throw new Error(`${campaign.error.code}:${campaign.error.messageKey}`);
  }
  const requestPayload = {
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventId: input.eventId
  };
  const requestFingerprint = await computeRequestFingerprint(
    input.operationKind,
    1,
    requestPayload
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId:
      opaqueId<RequestId>(`${input.operationId}:request`),
    idempotencyKey:
      opaqueId<IdempotencyKey>(`${input.operationId}:idempotency`),
    requestFingerprint,
    operationKind: input.operationKind,
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const received = await input.repository.receiveOperation(operation);
  if (!received.ok) throw new Error(received.error.messageKey);
  const preparing = await input.repository.transitionOperation(
    input.operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) throw new Error(preparing.error.messageKey);
  const ready = await input.repository.transitionOperation(
    input.operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) throw new Error(ready.error.messageKey);
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operationId}:writer`),
    120_000
  );
  if (!lease.ok) throw new Error(lease.error.messageKey);
  try {
    const commandId =
      opaqueId<CommandId>(`${input.operationId}:command`);
    const committed = await input.repository.commit({
      campaignId: input.campaignId,
      operationId: input.operationId,
      commitId: opaqueId<CommitId>(`${input.operationId}:commit`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: lease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "campaign-main-certification-9f",
        contractVersion: 1,
        commandId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        commandType: input.operationKind,
        target: {
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload: requestPayload,
        acceptedAtGameSecond: 0
      }],
      aggregateWrites: [{
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: input.aggregatePayload
      }],
      events: [{
        schemaVersion: 1,
        eventId: input.eventId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        eventType: input.eventType,
        origin: input.eventOrigin,
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: 0,
        payloadSchemaVersion: 1,
        payload: input.eventPayload
      }],
      outboxTasks: []
    });
    if (!committed.ok) {
      throw new Error(`${committed.error.code}:${committed.error.messageKey}`);
    }
    const completed = await input.repository.completePresentation(
      input.operationId,
      "COMMITTED_RENDERED",
      1,
      { schemaVersion: 1, status: "CERTIFICATION_PREPARED" }
    );
    if (!completed.ok) throw new Error(completed.error.messageKey);
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}
