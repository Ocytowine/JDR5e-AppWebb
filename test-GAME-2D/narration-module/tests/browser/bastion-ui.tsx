import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  BASTION_ESTABLISHMENT_CONTRACT_V1,
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1,
  BASTION_OCCUPANT_ASSIGNMENT_CONTRACT_V1,
  BASTION_OCCUPANT_CATALOG_CONTRACT_V1,
  BASTION_INCIDENT_CATALOG_CONTRACT_V1,
  BASTION_INCIDENT_CONTRACT_V1,
  BASTION_WORK_CATALOG_CONTRACT_V1,
  BASTION_WORK_ORDER_CONTRACT_V1,
  CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
  CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  assignBastionOccupantV1,
  bastionRegistryAggregateIdV1,
  campaignNpcRegistryAggregateIdV1,
  completeBastionWorkV1,
  createBrowserPersistentNarrativeTurnControllerV1,
  handleBastionIncidentV1,
  resolveBastionOccupantActivityBoundaryV1,
  startBastionWorkV1,
  type BastionEstablishmentResultV1,
  type BastionPublicSummaryV1,
  type BastionWorkCatalogV1,
  type BastionOccupantCatalogV1
} from "../../src/application";
import {
  computeRequestFingerprint,
  opaqueId,
  type CampaignId,
  type CampaignRepository,
  type CommitId,
  type CommandId,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type WriterId
} from "../../src/core";
import {
  HANDOFF_CONTRACT_VERSION,
  type TacticalEncounterSeedV1
} from "../../src/handoff";

const operationId =
  opaqueId<OperationId>("bastion-establishment:browser-6f-b");
const commitId =
  opaqueId<CommitId>("bastion-establishment:browser-6f-b:commit");
const summary: BastionPublicSummaryV1 = {
  schemaVersion: 1,
  bastionId: "bastion:place:old-bridge-inn",
  placeRef: "place:old-bridge-inn",
  placeDisplayName: "L’Auberge du Vieux Pont",
  ownerRef: "character:pc-aryn",
  ownerDisplayName: "Aryn",
  status: "ACTIVE",
  establishedAtGameSecond: 0
};

async function ensureCommittedBastion(
  repository: CampaignRepository,
  campaignId: CampaignId,
  clock: RepositoryClock
): Promise<void> {
  const existing = await repository.getOperation(operationId);
  if (existing.ok) return;
  if (existing.error.code !== "NOT_FOUND") {
    throw new Error(`${existing.error.code}: ${existing.error.messageKey}`);
  }
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) throw new Error(`${campaign.error.code}: ${campaign.error.messageKey}`);
  const requestPayload = {
    schemaVersion: 1,
    contractVersion: BASTION_ESTABLISHMENT_CONTRACT_V1,
    sourceOperationId: "property-acquisition:browser-6f-b",
    sourceEventId: "property-acquisition:browser-6f-b:event"
  };
  const requestFingerprint = await computeRequestFingerprint(
    "bastion.establish",
    1,
    requestPayload
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("browser-6f-b"),
    idempotencyKey: opaqueId<IdempotencyKey>("browser-6f-b"),
    requestFingerprint,
    operationKind: "bastion.establish",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: clock.now().toISOString(),
    updatedAt: clock.now().toISOString()
  };
  const received = await repository.receiveOperation(operation);
  if (!received.ok) throw new Error(`${received.error.code}: ${received.error.messageKey}`);
  const preparing = await repository.transitionOperation(
    operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) throw new Error(`${preparing.error.code}: ${preparing.error.messageKey}`);
  const ready = await repository.transitionOperation(
    operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) throw new Error(`${ready.error.code}: ${ready.error.messageKey}`);
  const lease = await repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>("writer-browser-6f-b"),
    120_000
  );
  if (!lease.ok) throw new Error(`${lease.error.code}: ${lease.error.messageKey}`);
  try {
    const registryAggregateId = bastionRegistryAggregateIdV1(campaignId);
    const commandId = opaqueId(`${operationId}:command`);
    const committed = await repository.commit({
      campaignId,
      operationId,
      commitId,
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: lease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "bastion-authority",
        contractVersion: 1,
        commandId,
        campaignId,
        operationId,
        commandType: "bastion.establish",
        target: {
          aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: registryAggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload: {
          bastionId: summary.bastionId,
          placeRef: summary.placeRef,
          ownerRef: summary.ownerRef
        },
        acceptedAtGameSecond: 0
      }],
      aggregateWrites: [{
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: registryAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: {
          schemaVersion: 1,
          contractVersion: "bastion-registry/1",
          campaignId,
          bastions: [{
            ...summary,
            sourceOperationId: "property-acquisition:browser-6f-b",
            sourceEventId: "property-acquisition:browser-6f-b:event",
            acquisitionPolicyRef: "bastion-policy:browser-6f-b",
            placeSourceRefs: ["place:old-bridge-inn"],
            installations: [],
            workOrders: [],
            occupantAssignments: [],
            occupantActivities: [],
            incidents: [],
            version: 1
          }],
          version: 2
        }
      }],
      events: [{
        schemaVersion: 1,
        eventId: opaqueId<EventId>(`${operationId}:bastion-established`),
        campaignId,
        operationId,
        eventType: "bastion_established",
        origin: "RULE",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{
          aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: registryAggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
        occurredAtGameSecond: 0,
        payloadSchemaVersion: 1,
        payload: summary
      }],
      outboxTasks: []
    });
    if (!committed.ok) {
      throw new Error(`${committed.error.code}: ${committed.error.messageKey}`);
    }
    const result: BastionEstablishmentResultV1 = {
      schemaVersion: 1,
      status: "ESTABLISHED",
      reasonCode: "PROPERTY_ACQUISITION_CONFIRMED",
      bastion: {
        ...summary,
        sourceOperationId: "property-acquisition:browser-6f-b",
        sourceEventId: "property-acquisition:browser-6f-b:event",
        acquisitionPolicyRef: "bastion-policy:browser-6f-b",
        placeSourceRefs: ["place:old-bridge-inn"],
        installations: [],
        workOrders: [],
        occupantAssignments: [],
        occupantActivities: [],
        incidents: [],
        version: 1
      },
      publicSummary: summary,
      commitId,
      replayed: false
    };
    const completed = await repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      result
    );
    if (!completed.ok) throw new Error(`${completed.error.code}: ${completed.error.messageKey}`);
  } finally {
    await repository.releaseWriterLease(lease.value);
  }
}

const browserWorkCatalog: BastionWorkCatalogV1 = {
  catalogRef: "bastion-work-catalog:browser-6f-c",
  resolve(workDefinitionRef) {
    return workDefinitionRef === "work:clear-east-room"
      ? {
          schemaVersion: 1,
          contractVersion: BASTION_WORK_CATALOG_CONTRACT_V1,
          workDefinitionRef,
          displayName: "Déblayer l’ancienne salle commune",
          durationSeconds: 1_800,
          prerequisites: [],
          effect: {
            schemaVersion: 1,
            kind: "ADD_INSTALLATION",
            installationDefinitionRef: "installation:east-room-cleared",
            installationDisplayName: "Ancienne salle commune déblayée"
          },
          completionNarrative:
            "Après une demi-heure à dégager les planches brisées et la poussière, "
            + "l’ancienne salle commune respire de nouveau. Son sol est libre "
            + "et l’espace peut désormais être aménagé."
        }
      : null;
  }
};

const browserOccupantCatalog: BastionOccupantCatalogV1 = {
  catalogRef: "bastion-occupant-catalog:browser-6f-d",
  resolveRole(roleDefinitionRef) {
    return roleDefinitionRef === "role:steward"
      ? {
          schemaVersion: 1,
          contractVersion: BASTION_OCCUPANT_CATALOG_CONTRACT_V1,
          roleDefinitionRef,
          displayName: "intendante",
          allowedActivityRefs: ["activity:inspect-shutters"]
        }
      : null;
  },
  resolveActivity(activityDefinitionRef) {
    return activityDefinitionRef === "activity:inspect-shutters"
      ? {
          schemaVersion: 1,
          contractVersion: BASTION_OCCUPANT_CATALOG_CONTRACT_V1,
          activityDefinitionRef,
          displayName: "Inspection des volets",
          minimumIntervalSeconds: 900,
          publicNarrative:
            "Sans attendre Aryn, Mira fait le tour de l’auberge. Elle replace "
            + "un gond descellé et referme les volets exposés au vent du pont."
        }
      : null;
  }
};

async function ensureOccupantAuthorityProof(
  repository: CampaignRepository,
  campaignId: CampaignId,
  clock: RepositoryClock
): Promise<{ operationId: OperationId; assignmentEventId: EventId; activityEventId: EventId }> {
  const proofOperationId = opaqueId<OperationId>(
    "social-authority:browser-bastion-steward-mira"
  );
  const assignmentEventId = opaqueId<EventId>(
    "event:browser-bastion-assignment-accepted"
  );
  const activityEventId = opaqueId<EventId>(
    "event:browser-bastion-activity-authorized"
  );
  const existing = await repository.getOperation(proofOperationId);
  if (existing.ok) {
    return { operationId: proofOperationId, assignmentEventId, activityEventId };
  }
  if (existing.error.code !== "NOT_FOUND") {
    throw new Error(`${existing.error.code}: ${existing.error.messageKey}`);
  }
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) throw new Error(`${campaign.error.code}: ${campaign.error.messageKey}`);
  const payload = {
    disposition: "ACCEPTED",
    privateObjective: "Conserver son indépendance tout en observant la route."
  };
  const fingerprint = await computeRequestFingerprint(
    "social.bastion-occupant-authority-fixture",
    1,
    payload
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: proofOperationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("browser-6f-d-social-proof"),
    idempotencyKey: opaqueId<IdempotencyKey>("browser-6f-d-social-proof"),
    requestFingerprint: fingerprint,
    operationKind: "social.bastion-occupant-authority-fixture",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: clock.now().toISOString(),
    updatedAt: clock.now().toISOString()
  };
  const received = await repository.receiveOperation(operation);
  if (!received.ok) throw new Error(`${received.error.code}: ${received.error.messageKey}`);
  const preparing = await repository.transitionOperation(proofOperationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) throw new Error(`${preparing.error.code}: ${preparing.error.messageKey}`);
  const ready = await repository.transitionOperation(proofOperationId, "PREPARING", "READY_TO_COMMIT");
  if (!ready.ok) throw new Error(`${ready.error.code}: ${ready.error.messageKey}`);
  const lease = await repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>("writer-browser-6f-d-social-proof"),
    120_000
  );
  if (!lease.ok) throw new Error(`${lease.error.code}: ${lease.error.messageKey}`);
  try {
    const registryAggregateId = campaignNpcRegistryAggregateIdV1(campaignId);
    const commandId = opaqueId<CommandId>(`${proofOperationId}:command`);
    const committed = await repository.commit({
      campaignId,
      operationId: proofOperationId,
      commitId: opaqueId<CommitId>(`${proofOperationId}:commit`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: fingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: lease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "social-authority-fixture",
        contractVersion: 1,
        commandId,
        campaignId,
        operationId: proofOperationId,
        commandType: "social.confirm-bastion-role",
        target: {
          aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: registryAggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload: { campaignNpcId: "campaign-npc:mira", disposition: "ACCEPTED" },
        acceptedAtGameSecond: 1_800
      }],
      aggregateWrites: [{
        aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: registryAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: {
          schemaVersion: 1,
          contractVersion: CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1,
          campaignId,
          npcs: [{
            schemaVersion: 1,
            campaignNpcId: "campaign-npc:mira",
            actorId: "npc-mira",
            originSceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId,
            displayName: "Mira",
            publicRole: "Voyageuse devenue intendante",
            visibleAppearance: "Une femme attentive au manteau bleu sombre.",
            cause: {
              schemaVersion: 1,
              causeKind: "RELATION_CONFIRMED",
              authority: "SOCIAL",
              durableRef: "relation:mira-aryn",
              publicSourceRefs: ["event:mira-accepted-stewardship"],
              version: 1
            },
            promotedByOperationId: proofOperationId,
            sourceRefs: ["scene-actor:npc-mira"],
            version: 1
          }],
          version: 1
        }
      }],
      events: [assignmentEventId, activityEventId].map((eventId, index) => ({
        schemaVersion: 1 as const,
        eventId,
        campaignId,
        operationId: proofOperationId,
        eventType: index === 0
          ? "social.bastion-assignment.accepted"
          : "social.bastion-activity.authorized",
        origin: "RULE" as const,
        causation: { kind: "COMMAND" as const, id: commandId },
        aggregateRefs: [{
          aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: registryAggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: "ACTOR_SCOPED" as const, actorIds: ["npc-mira"] },
        occurredAtGameSecond: 1_800,
        payloadSchemaVersion: 1,
        payload: index === 0
          ? { campaignNpcId: "campaign-npc:mira", disposition: "ACCEPTED" }
          : {
              campaignNpcId: "campaign-npc:mira",
              activityDefinitionRef: "activity:inspect-shutters"
            }
      })),
      outboxTasks: []
    });
    if (!committed.ok) throw new Error(`${committed.error.code}: ${committed.error.messageKey}`);
    const completed = await repository.completePresentation(
      proofOperationId,
      "COMMITTED_RENDERED",
      1,
      { schemaVersion: 1, status: "AUTHORIZED" }
    );
    if (!completed.ok) throw new Error(`${completed.error.code}: ${completed.error.messageKey}`);
  } finally {
    await repository.releaseWriterLease(lease.value);
  }
  return { operationId: proofOperationId, assignmentEventId, activityEventId };
}

async function ensureCommittedOccupant(
  repository: CampaignRepository,
  campaignId: CampaignId,
  clock: RepositoryClock
): Promise<void> {
  const activityOperationId = opaqueId<OperationId>(
    "bastion-occupant-activity:browser-6f-d-activity"
  );
  const existingActivity = await repository.getOperation(activityOperationId);
  if (existingActivity.ok) return;
  if (existingActivity.error.code !== "NOT_FOUND") {
    throw new Error(`${existingActivity.error.code}: ${existingActivity.error.messageKey}`);
  }
  const proof = await ensureOccupantAuthorityProof(repository, campaignId, clock);
  const assigned = await assignBastionOccupantV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_OCCUPANT_ASSIGNMENT_CONTRACT_V1,
      clientRequestId: "browser-6f-d-assignment",
      bastionId: summary.bastionId,
      campaignNpcId: "campaign-npc:mira",
      roleDefinitionRef: "role:steward"
    },
    catalog: browserOccupantCatalog,
    authority: {
      authorityRef: "social-actor-authority:browser-6f-d",
      authorize: () => ({
        schemaVersion: 1,
        authorized: true,
        reasonCode: "NPC_ACCEPTED_ASSIGNMENT",
        sourceOperationId: proof.operationId,
        sourceEventId: proof.assignmentEventId,
        proofRefs: ["social-decision:mira-stewardship"]
      })
    }
  });
  if (!assigned.ok || assigned.value.assignment === null) {
    throw new Error(
      assigned.ok
        ? `unexpected assignment status: ${assigned.value.status}`
        : `${assigned.error.code}: ${assigned.error.messageKey}`
    );
  }
  const activity = await resolveBastionOccupantActivityBoundaryV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1,
      clientRequestId: "browser-6f-d-activity",
      bastionId: summary.bastionId,
      assignmentId: assigned.value.assignment.assignmentId,
      boundaryKind: "LOCAL_TIME_BOUNDARY",
      occurredAtGameSecond: 1_800
    },
    catalog: browserOccupantCatalog,
    authority: {
      authorityRef: "social-actor-initiative:browser-6f-d",
      select: () => ({
        schemaVersion: 1,
        authorized: true,
        reasonCode: "ACTIVE_CONCERN_SELECTED",
        sourceOperationId: proof.operationId,
        sourceEventId: proof.activityEventId,
        proofRefs: ["social-concern:mira-protect-building"],
        activityDefinitionRef: "activity:inspect-shutters"
      })
    }
  });
  if (!activity.ok || activity.value.status !== "ACTIVITY_COMMITTED") {
    throw new Error(
      activity.ok
        ? `unexpected activity status: ${activity.value.status}`
        : `${activity.error.code}: ${activity.error.messageKey}`
    );
  }
}

async function ensureCommittedBastionOpportunity(
  repository: CampaignRepository,
  campaignId: CampaignId,
  clock: RepositoryClock
): Promise<void> {
  const defenseIncidentOperationId = opaqueId<OperationId>(
    "bastion-incident:browser-6f-e-defense"
  );
  const existingIncident = await repository.getOperation(defenseIncidentOperationId);
  if (existingIncident.ok) return;
  if (existingIncident.error.code !== "NOT_FOUND") {
    throw new Error(
      `${existingIncident.error.code}: ${existingIncident.error.messageKey}`
    );
  }

  const sourceOperationId = opaqueId<OperationId>(
    "world:browser-6f-e-bastion-opportunity"
  );
  const sourceEventId = opaqueId<EventId>(
    "event:browser-6f-e-merchant-opportunity"
  );
  const defenseEventId = opaqueId<EventId>(
    "event:browser-6f-e-night-raid"
  );
  const existingSource = await repository.getOperation(sourceOperationId);
  if (!existingSource.ok) {
    if (existingSource.error.code !== "NOT_FOUND") {
      throw new Error(`${existingSource.error.code}: ${existingSource.error.messageKey}`);
    }
    const campaign = await repository.getCampaign(campaignId);
    if (!campaign.ok) throw new Error(`${campaign.error.code}: ${campaign.error.messageKey}`);
    const payload = {
      placeRef: summary.placeRef,
      privateSupplierMargin: 42
    };
    const requestFingerprint = await computeRequestFingerprint(
      "world.bastion-opportunity-fixture",
      1,
      payload
    );
    const operation: OperationRecord = {
      schemaVersion: 1,
      operationId: sourceOperationId,
      campaignId,
      clientRequestId: opaqueId<RequestId>("browser-6f-e-source"),
      idempotencyKey: opaqueId<IdempotencyKey>("browser-6f-e-source"),
      requestFingerprint,
      operationKind: "world.bastion-opportunity-fixture",
      requestPayloadSchemaVersion: 1,
      requestPayload: payload,
      phase: "RECEIVED",
      observedCampaignRevision: campaign.value.campaignRevision,
      commitId: null,
      completionMode: null,
      resultPayloadSchemaVersion: null,
      resultPayload: null,
      failure: null,
      receivedAt: clock.now().toISOString(),
      updatedAt: clock.now().toISOString()
    };
    const received = await repository.receiveOperation(operation);
    if (!received.ok) throw new Error(`${received.error.code}: ${received.error.messageKey}`);
    const preparing = await repository.transitionOperation(
      sourceOperationId,
      "RECEIVED",
      "PREPARING"
    );
    if (!preparing.ok) throw new Error(`${preparing.error.code}: ${preparing.error.messageKey}`);
    const ready = await repository.transitionOperation(
      sourceOperationId,
      "PREPARING",
      "READY_TO_COMMIT"
    );
    if (!ready.ok) throw new Error(`${ready.error.code}: ${ready.error.messageKey}`);
    const lease = await repository.acquireWriterLease(
      campaignId,
      opaqueId<WriterId>("writer-browser-6f-e-source"),
      120_000
    );
    if (!lease.ok) throw new Error(`${lease.error.code}: ${lease.error.messageKey}`);
    try {
      const aggregateId = opaqueId("world:browser-6f-e-opportunity");
      const commandId = opaqueId<CommandId>(`${sourceOperationId}:command`);
      const committed = await repository.commit({
        campaignId,
        operationId: sourceOperationId,
        commitId: opaqueId<CommitId>(`${sourceOperationId}:commit`),
        idempotencyKey: operation.idempotencyKey,
        requestFingerprint,
        expectedCampaignRevision: campaign.value.campaignRevision,
        writerLease: lease.value,
        acceptedCommands: [{
          schemaVersion: 1,
          contractId: "world-bastion-opportunity-fixture",
          contractVersion: 1,
          commandId,
          campaignId,
          operationId: sourceOperationId,
          commandType: "world.emit-bastion-opportunity",
          target: {
            aggregateType: "world.fixture",
            aggregateId,
            expectedAggregateRevision: null
          },
          payloadSchemaVersion: 1,
          payload,
          acceptedAtGameSecond: 1_800
        }],
        aggregateWrites: [{
          aggregateType: "world.fixture",
          aggregateId,
          expectedAggregateRevision: null,
          payloadSchemaVersion: 1,
          payload
        }],
        events: [{
          schemaVersion: 1,
          eventId: sourceEventId,
          campaignId,
          operationId: sourceOperationId,
          eventType: "world.bastion-opportunity",
          origin: "SYSTEM",
          causation: { kind: "COMMAND", id: commandId },
          aggregateRefs: [{
            aggregateType: "world.fixture",
            aggregateId,
            aggregateRevision: 0
          }],
          visibility: { scope: "SYSTEM", actorIds: [] },
          occurredAtGameSecond: 1_800,
          payloadSchemaVersion: 1,
          payload
        }, {
          schemaVersion: 1,
          eventId: defenseEventId,
          campaignId,
          operationId: sourceOperationId,
          eventType: "world.bastion-attack",
          origin: "SYSTEM",
          causation: { kind: "COMMAND", id: commandId },
          aggregateRefs: [{
            aggregateType: "world.fixture",
            aggregateId,
            aggregateRevision: 0
          }],
          visibility: { scope: "SYSTEM", actorIds: [] },
          occurredAtGameSecond: 1_800,
          payloadSchemaVersion: 1,
          payload
        }],
        outboxTasks: []
      });
      if (!committed.ok) {
        throw new Error(`${committed.error.code}: ${committed.error.messageKey}`);
      }
      const completed = await repository.completePresentation(
        sourceOperationId,
        "COMMITTED_RENDERED",
        1,
        { schemaVersion: 1, status: "EMITTED" }
      );
      if (!completed.ok) {
        throw new Error(`${completed.error.code}: ${completed.error.messageKey}`);
      }
    } finally {
      await repository.releaseWriterLease(lease.value);
    }
  }

  const handled = await handleBastionIncidentV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_INCIDENT_CONTRACT_V1,
      clientRequestId: "browser-6f-e-opportunity",
      bastionId: summary.bastionId,
      sourceOperationId,
      sourceEventId
    },
    catalog: {
      catalogRef: "bastion-incident-catalog:browser-6f-e",
      resolve: () => ({
        schemaVersion: 1,
        contractVersion: BASTION_INCIDENT_CATALOG_CONTRACT_V1,
        incidentDefinitionRef: "incident:merchant-offer",
        displayName: "Offre d’un marchand de passage",
        kind: "OPPORTUNITY",
        publicNarrative:
          "Un marchand de passage s’arrête à l’auberge et propose du bois sec "
          + "à prix réduit. L’offre reste ouverte : Aryn peut l’examiner ou la laisser passer.",
        effect: { schemaVersion: 1, kind: "RECORD_ONLY" }
      })
    },
    policy: {
      policyRef: "bastion-incident-policy:browser-6f-e",
      evaluate: () => ({
        schemaVersion: 1,
        eligible: true,
        reasonCode: "WORLD_OPPORTUNITY_MAPPED",
        incidentDefinitionRef: "incident:merchant-offer"
      })
    },
    defenseAuthority: null
  });
  if (!handled.ok || handled.value.status !== "RECORDED") {
    throw new Error(
      handled.ok
        ? `unexpected incident status: ${handled.value.status}`
        : `${handled.error.code}: ${handled.error.messageKey}`
    );
  }
  const defenseSeed: TacticalEncounterSeedV1 = {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    seedId: "seed:browser-6f-e-defense",
    processId: "process:browser-6f-e-defense",
    campaignId,
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId,
    locationRef: { kind: "place", id: summary.placeRef },
    startedAtGameSecond: 1_800,
    rulesetRef: { kind: "ruleset", id: "rules.jdr5e:2" },
    cause: { sourceEventId: defenseEventId, narrativeCanResolve: false },
    stakes: { defendedPlace: summary.placeRef, outcomePending: true },
    objectives: [{ teamId: "defenders", objective: "protect_the_bastion" }],
    participants: [
      { actorId: "character:pc-aryn", tacticalProjectionRef: "character:pc-aryn" },
      { actorId: "attacker:raiders", tacticalProjectionRef: "attacker:raiders" }
    ],
    teams: [
      { teamId: "defenders", actors: ["character:pc-aryn"] },
      { teamId: "attackers", actors: ["attacker:raiders"] }
    ],
    tacticalMapRef: { kind: "map", id: "map:old-bridge-inn-defense" },
    mapGenerationRequest: null,
    entryZones: [{ zoneId: "courtyard" }],
    exitZones: [{ zoneId: "bridge-road" }],
    knownTerrain: [{ terrainId: "inn-walls", effect: "cover" }],
    lightingAndVisibility: { light: "night", visibility: "dim" },
    weatherAndHazards: [{ hazardId: "rain", severity: "low" }],
    initialPositions: [
      { actorId: "character:pc-aryn", zoneId: "common-room" },
      { actorId: "attacker:raiders", zoneId: "courtyard" }
    ],
    surpriseState: { surprisedActors: [] },
    allowedEndConditions: ["attackers_retreat", "bastion_taken", "surrender"],
    sourceAggregateRefs: [
      { kind: "bastion", id: summary.bastionId },
      { kind: "event", id: defenseEventId }
    ],
    seedFingerprint: "fixture:browser-6f-e-defense",
    version: 1
  };
  const defense = await handleBastionIncidentV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_INCIDENT_CONTRACT_V1,
      clientRequestId: "browser-6f-e-defense",
      bastionId: summary.bastionId,
      sourceOperationId,
      sourceEventId: defenseEventId
    },
    catalog: {
      catalogRef: "bastion-incident-catalog:browser-6f-e",
      resolve: () => ({
        schemaVersion: 1,
        contractVersion: BASTION_INCIDENT_CATALOG_CONTRACT_V1,
        incidentDefinitionRef: "incident:night-raid",
        displayName: "Raid nocturne",
        kind: "TACTICAL_DEFENSE",
        publicNarrative:
          "Des silhouettes armées franchissent la cour sous la pluie. La "
          + "défense de l’auberge commence ; son issue reste indécise.",
        effect: { schemaVersion: 1, kind: "TACTICAL_HANDOFF" }
      })
    },
    policy: {
      policyRef: "bastion-incident-policy:browser-6f-e",
      evaluate: () => ({
        schemaVersion: 1,
        eligible: true,
        reasonCode: "WORLD_ATTACK_MAPPED",
        incidentDefinitionRef: "incident:night-raid"
      })
    },
    defenseAuthority: {
      authorityRef: "tactical-owner:browser-6f-e",
      prepare: () => ({
        schemaVersion: 1,
        authorized: true,
        reasonCode: "TACTICAL_SEED_READY",
        seed: defenseSeed
      })
    }
  });
  if (!defense.ok || defense.value.status !== "HANDOFF_CREATED") {
    throw new Error(
      defense.ok
        ? `unexpected defense status: ${defense.value.status}`
        : `${defense.error.code}: ${defense.error.messageKey}`
    );
  }
}

async function ensureCommittedBastionAndWork(
  repository: CampaignRepository,
  campaignId: CampaignId,
  clock: RepositoryClock
): Promise<void> {
  await ensureCommittedBastion(repository, campaignId, clock);
  const completionOperationId = opaqueId<OperationId>(
    "bastion-work-completion:browser-6f-c-complete"
  );
  const existingCompletion = await repository.getOperation(completionOperationId);
  if (existingCompletion.ok) {
    await ensureCommittedOccupant(repository, campaignId, clock);
    await ensureCommittedBastionOpportunity(repository, campaignId, clock);
    return;
  }
  if (existingCompletion.error.code !== "NOT_FOUND") {
    throw new Error(
      `${existingCompletion.error.code}: ${existingCompletion.error.messageKey}`
    );
  }
  const scheduled = await startBastionWorkV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
      clientRequestId: "browser-6f-c-start",
      bastionId: summary.bastionId,
      workDefinitionRef: "work:clear-east-room"
    },
    catalog: browserWorkCatalog,
    prerequisiteAuthority: null
  });
  if (!scheduled.ok || scheduled.value.workOrder === null) {
    throw new Error(
      scheduled.ok
        ? `unexpected work status: ${scheduled.value.status}`
        : `${scheduled.error.code}: ${scheduled.error.messageKey}`
    );
  }
  const completed = await completeBastionWorkV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
      clientRequestId: "browser-6f-c-complete",
      bastionId: summary.bastionId,
      workOrderId: scheduled.value.workOrder.workOrderId,
      requestedThroughGameSecond: 1_800
    },
    simulationCursorAggregateId: opaqueId(
      "agg-browser-bastion-world-simulation-cursor"
    )
  });
  if (!completed.ok || completed.value.status !== "COMPLETED") {
    throw new Error(
      completed.ok
        ? `unexpected completion status: ${completed.value.status}`
        : `${completed.error.code}: ${completed.error.messageKey}`
    );
  }
  await ensureCommittedOccupant(repository, campaignId, clock);
  await ensureCommittedBastionOpportunity(repository, campaignId, clock);
}

async function bootstrap() {
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: "jdr5e-bastion-ui-6f-e",
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    initializeRepository: ensureCommittedBastionAndWork
  });
  const projected = await controller.projectBastionEstablishment({
    schemaVersion: 1,
    establishmentOperationId: operationId,
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId
  });
  if (!projected.ok) {
    throw new Error(`${projected.error.code}: ${projected.error.messageKey}`);
  }
  const projectedWork = await controller.projectBastionWorkCompletion({
    schemaVersion: 1,
    completionOperationId:
      "bastion-work-completion:browser-6f-c-complete",
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId
  });
  if (!projectedWork.ok) {
    throw new Error(`${projectedWork.error.code}: ${projectedWork.error.messageKey}`);
  }
  const projectedAssignment = await controller.projectBastionOccupantAssignment({
    schemaVersion: 1,
    assignmentOperationId:
      "bastion-occupant-assignment:browser-6f-d-assignment",
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId
  });
  if (!projectedAssignment.ok) {
    throw new Error(
      `${projectedAssignment.error.code}: ${projectedAssignment.error.messageKey}`
    );
  }
  const projectedActivity = await controller.projectBastionOccupantActivity({
    schemaVersion: 1,
    activityOperationId:
      "bastion-occupant-activity:browser-6f-d-activity",
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId
  });
  if (!projectedActivity.ok) {
    throw new Error(
      `${projectedActivity.error.code}: ${projectedActivity.error.messageKey}`
    );
  }
  const projectedIncident = await controller.projectBastionIncident({
    schemaVersion: 1,
    incidentOperationId: "bastion-incident:browser-6f-e-opportunity",
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId
  });
  if (!projectedIncident.ok) {
    throw new Error(
      `${projectedIncident.error.code}: ${projectedIncident.error.messageKey}`
    );
  }
  const projectedDefense = await controller.projectBastionIncident({
    schemaVersion: 1,
    incidentOperationId: "bastion-incident:browser-6f-e-defense",
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId
  });
  if (!projectedDefense.ok) {
    throw new Error(
      `${projectedDefense.error.code}: ${projectedDefense.error.messageKey}`
    );
  }
  return {
    controller,
    openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
