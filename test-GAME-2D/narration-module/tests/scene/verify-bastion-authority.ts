import assert from "node:assert/strict";
import {
  BASTION_ESTABLISHMENT_CONTRACT_V1,
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  BASTION_WORK_CATALOG_CONTRACT_V1,
  BASTION_WORK_ORDER_CONTRACT_V1,
  BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1,
  BASTION_OCCUPANT_ASSIGNMENT_CONTRACT_V1,
  BASTION_OCCUPANT_CATALOG_CONTRACT_V1,
  BASTION_INCIDENT_CATALOG_CONTRACT_V1,
  BASTION_INCIDENT_CONTRACT_V1,
  CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
  CAMPAIGN_NPC_REGISTRY_CONTRACT_VERSION_V1,
  NarrativeTurnControllerV1,
  assignBastionOccupantV1,
  bastionRegistryAggregateIdV1,
  bastionTacticalHandoffAggregateIdV1,
  bastionTacticalSeedAggregateIdV1,
  bastionWorkScheduleAggregateIdV1,
  campaignNpcRegistryAggregateIdV1,
  completeBastionWorkV1,
  establishBastionV1,
  handleBastionIncidentV1,
  loadBastionRegistryV1,
  resolveBastionOccupantActivityBoundaryV1,
  restoreActiveBastionTacticalSessionV1,
  startBastionWorkV1,
  type BastionAcquisitionPolicyV1,
  type BastionPlaceResolverV1,
  type BastionWorkCatalogV1,
  type BastionOccupantCatalogV1,
  type BastionIncidentCatalogV1,
  type BastionIncidentDefinitionV1,
  type BastionIncidentPolicyV1,
  type BastionRecordV1,
  type EstablishBastionCommandV1
} from "../../src/application";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type CommandId,
  type CommitId,
  type EventId,
  type EventRecord,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result,
  type WriterId
} from "../../src/core";
import {
  HANDOFF_CONTRACT_VERSION,
  type TacticalEncounterSeedV1
} from "../../src/handoff";

class FixedClock implements RepositoryClock {
  now(): Date {
    return new Date("2026-07-29T18:00:00.000Z");
  }
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function ok<T>(result: Result<T>): T {
  if (!result.ok) {
    assert.fail(
      `${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`
    );
  }
  return result.value;
}

interface FailureControl {
  enabled: boolean;
  point: string;
}

async function setup(failureControl?: FailureControl) {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({
    clock,
    failureInjector: point => {
      if (failureControl?.enabled && failureControl.point === point) {
        throw new Error(`injected failure at ${point}`);
      }
    }
  });
  const campaignId = id<CampaignId>("cmp-bastion-6f-b");
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: id<AggregateId>("agg-bastion-clock"),
    dependencies: {
      contentPackageId: "content.jdr5e",
      contentPackageVersion: 1,
      rulesetId: "rules.jdr5e",
      rulesetVersion: 2,
      calendarId: "calendar.jdr5e",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: clock.now().toISOString(),
    updatedAt: clock.now().toISOString()
  };
  ok(await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.jdr5e",
    calendarVersion: 1
  }));
  const sourceOperationId = id<OperationId>("property-acquisition:old-bridge-inn");
  const sourceEventId = id<EventId>("event:property-acquired:old-bridge-inn");
  const sourcePayload = {
    placeRef: "place:old-bridge-inn",
    ownerRef: "character:pc-aryn",
    privatePrice: 850,
    formerOwnerDebt: "debt:private-red-ledger"
  };
  const fingerprint = await computeRequestFingerprint(
    "property.acquire",
    1,
    sourcePayload
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: sourceOperationId,
    campaignId,
    clientRequestId: id<RequestId>("req-property-old-bridge-inn"),
    idempotencyKey: id<IdempotencyKey>("idem-property-old-bridge-inn"),
    requestFingerprint: fingerprint,
    operationKind: "property.acquire",
    requestPayloadSchemaVersion: 1,
    requestPayload: sourcePayload,
    phase: "RECEIVED",
    observedCampaignRevision: 0,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: clock.now().toISOString(),
    updatedAt: clock.now().toISOString()
  };
  ok(await repository.receiveOperation(operation));
  ok(await repository.transitionOperation(sourceOperationId, "RECEIVED", "PREPARING"));
  ok(await repository.transitionOperation(
    sourceOperationId,
    "PREPARING",
    "READY_TO_COMMIT"
  ));
  const lease = ok(await repository.acquireWriterLease(
    campaignId,
    id<WriterId>("writer-property-old-bridge-inn"),
    120_000
  ));
  try {
    ok(await repository.commit({
      campaignId,
      operationId: sourceOperationId,
      commitId: id<CommitId>("commit-property-old-bridge-inn"),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: fingerprint,
      expectedCampaignRevision: 0,
      writerLease: lease,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "property-authority-fixture",
        contractVersion: 1,
        commandId: opaqueId(`${sourceOperationId}:command`),
        campaignId,
        operationId: sourceOperationId,
        commandType: "property.acquire",
        target: {
          aggregateType: "property.fixture",
          aggregateId: id<AggregateId>("property:old-bridge-inn"),
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload: sourcePayload,
        acceptedAtGameSecond: 0
      }],
      aggregateWrites: [{
        aggregateType: "property.fixture",
        aggregateId: id<AggregateId>("property:old-bridge-inn"),
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: sourcePayload
      }],
      events: [{
        schemaVersion: 1,
        eventId: sourceEventId,
        campaignId,
        operationId: sourceOperationId,
        eventType: "property.acquisition.confirmed",
        origin: "SYSTEM",
        causation: {
          kind: "COMMAND",
          id: `${sourceOperationId}:command`
        },
        aggregateRefs: [{
          aggregateType: "property.fixture",
          aggregateId: id<AggregateId>("property:old-bridge-inn"),
          aggregateRevision: 0
        }],
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: 0,
        payloadSchemaVersion: 1,
        payload: sourcePayload
      }],
      outboxTasks: []
    }));
    ok(await repository.completePresentation(
      sourceOperationId,
      "COMMITTED_RENDERED",
      1,
      { schemaVersion: 1, status: "ACQUIRED" }
    ));
  } finally {
    ok(await repository.releaseWriterLease(lease));
  }
  return {
    repository,
    campaignId,
    clock,
    sourceOperationId,
    sourceEventId
  };
}

async function commitOccupantAuthorityFixture(
  fixture: Awaited<ReturnType<typeof setup>>
): Promise<{
  operationId: OperationId;
  assignmentEventId: EventId;
  activityEventId: EventId;
  campaignNpcId: string;
}> {
  const campaign = ok(await fixture.repository.getCampaign(fixture.campaignId));
  const operationId = id<OperationId>("social-authority:bastion-steward-mira");
  const assignmentEventId = id<EventId>(
    "event:social-authority:bastion-assignment-accepted"
  );
  const activityEventId = id<EventId>(
    "event:social-authority:bastion-activity-selected"
  );
  const campaignNpcId = "campaign-npc:mira";
  const payload = {
    assignmentDecision: "ACCEPTED",
    privateObjective: "Préserver sa liberté et observer les voyageurs du pont."
  };
  const fingerprint = await computeRequestFingerprint(
    "social.bastion-occupant-authority-fixture",
    1,
    payload
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId: fixture.campaignId,
    clientRequestId: id<RequestId>("req-social-bastion-steward-mira"),
    idempotencyKey: id<IdempotencyKey>("idem-social-bastion-steward-mira"),
    requestFingerprint: fingerprint,
    operationKind: "social.bastion-occupant-authority-fixture",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: fixture.clock.now().toISOString(),
    updatedAt: fixture.clock.now().toISOString()
  };
  ok(await fixture.repository.receiveOperation(operation));
  ok(await fixture.repository.transitionOperation(operationId, "RECEIVED", "PREPARING"));
  ok(await fixture.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT"));
  const lease = ok(await fixture.repository.acquireWriterLease(
    fixture.campaignId,
    id<WriterId>("writer-social-bastion-steward-mira"),
    120_000
  ));
  try {
    const registryAggregateId = campaignNpcRegistryAggregateIdV1(fixture.campaignId);
    const commandId = opaqueId<CommandId>(`${operationId}:command`);
    ok(await fixture.repository.commit({
      campaignId: fixture.campaignId,
      operationId,
      commitId: id<CommitId>(`${operationId}:commit`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: fingerprint,
      expectedCampaignRevision: campaign.campaignRevision,
      writerLease: lease,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "social-authority-fixture",
        contractVersion: 1,
        commandId,
        campaignId: fixture.campaignId,
        operationId,
        commandType: "social.confirm-bastion-role",
        target: {
          aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: registryAggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload: { campaignNpcId, disposition: "ACCEPTED" },
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
          campaignId: fixture.campaignId,
          npcs: [{
            schemaVersion: 1,
            campaignNpcId,
            actorId: "npc-mira",
            originSceneId: "scene:old-bridge-inn",
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
            promotedByOperationId: operationId,
            sourceRefs: ["scene-actor:npc-mira"],
            version: 1
          }],
          version: 1
        }
      }],
      events: [{
        schemaVersion: 1,
        eventId: assignmentEventId,
        campaignId: fixture.campaignId,
        operationId,
        eventType: "social.bastion-assignment.accepted",
        origin: "RULE",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{
          aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: registryAggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: "ACTOR_SCOPED", actorIds: ["npc-mira"] },
        occurredAtGameSecond: 1_800,
        payloadSchemaVersion: 1,
        payload: { campaignNpcId, disposition: "ACCEPTED" }
      }, {
        schemaVersion: 1,
        eventId: activityEventId,
        campaignId: fixture.campaignId,
        operationId,
        eventType: "social.bastion-activity.authorized",
        origin: "RULE",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{
          aggregateType: CAMPAIGN_NPC_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: registryAggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: "ACTOR_SCOPED", actorIds: ["npc-mira"] },
        occurredAtGameSecond: 1_800,
        payloadSchemaVersion: 1,
        payload: {
          campaignNpcId,
          activityDefinitionRef: "activity:inspect-shutters"
        }
      }],
      outboxTasks: []
    }));
    ok(await fixture.repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      { schemaVersion: 1, status: "AUTHORIZED" }
    ));
  } finally {
    ok(await fixture.repository.releaseWriterLease(lease));
  }
  return { operationId, assignmentEventId, activityEventId, campaignNpcId };
}

async function commitBastionIncidentSourceFixture(
  fixture: Awaited<ReturnType<typeof setup>>
): Promise<{
  operationId: OperationId;
  opportunityEventId: EventId;
  consequenceEventId: EventId;
  defenseEventId: EventId;
  plotEventId: EventId;
}> {
  const campaign = ok(await fixture.repository.getCampaign(fixture.campaignId));
  const operationId = id<OperationId>("world:bastion-incidents:old-bridge-inn");
  const opportunityEventId = id<EventId>("event:bastion:merchant-arrival");
  const consequenceEventId = id<EventId>("event:bastion:storm-damage");
  const defenseEventId = id<EventId>("event:bastion:night-raid");
  const plotEventId = id<EventId>("event:bastion:plot-pressure");
  const payload = {
    placeRef: "place:old-bridge-inn",
    privateAttackerPlan: "attack through the eastern cellar"
  };
  const fingerprint = await computeRequestFingerprint(
    "world.bastion-incidents-fixture",
    1,
    payload
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId: fixture.campaignId,
    clientRequestId: id<RequestId>("req-world-bastion-incidents"),
    idempotencyKey: id<IdempotencyKey>("idem-world-bastion-incidents"),
    requestFingerprint: fingerprint,
    operationKind: "world.bastion-incidents-fixture",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: fixture.clock.now().toISOString(),
    updatedAt: fixture.clock.now().toISOString()
  };
  ok(await fixture.repository.receiveOperation(operation));
  ok(await fixture.repository.transitionOperation(operationId, "RECEIVED", "PREPARING"));
  ok(await fixture.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT"));
  const lease = ok(await fixture.repository.acquireWriterLease(
    fixture.campaignId,
    id<WriterId>("writer-world-bastion-incidents"),
    120_000
  ));
  try {
    const aggregateId = id<AggregateId>("world:bastion-incidents:fixture");
    const commandId = id<CommandId>(`${operationId}:command`);
    const aggregateRefs = [{
      aggregateType: "world.fixture",
      aggregateId,
      aggregateRevision: 0
    }];
    ok(await fixture.repository.commit({
      campaignId: fixture.campaignId,
      operationId,
      commitId: id<CommitId>(`${operationId}:commit`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: fingerprint,
      expectedCampaignRevision: campaign.campaignRevision,
      writerLease: lease,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "world-bastion-incident-fixture",
        contractVersion: 1,
        commandId,
        campaignId: fixture.campaignId,
        operationId,
        commandType: "world.emit-bastion-incidents",
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
        eventId: opportunityEventId,
        campaignId: fixture.campaignId,
        operationId,
        eventType: "world.bastion-opportunity",
        origin: "WORLD_SIMULATION",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs,
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: 1_800,
        payloadSchemaVersion: 1,
        payload
      }, {
        schemaVersion: 1,
        eventId: consequenceEventId,
        campaignId: fixture.campaignId,
        operationId,
        eventType: "world.bastion-weather-damage",
        origin: "WORLD_SIMULATION",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs,
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: 1_800,
        payloadSchemaVersion: 1,
        payload
      }, {
        schemaVersion: 1,
        eventId: defenseEventId,
        campaignId: fixture.campaignId,
        operationId,
        eventType: "world.bastion-attack",
        origin: "WORLD_SIMULATION",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs,
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: 1_800,
        payloadSchemaVersion: 1,
        payload
      }, {
        schemaVersion: 1,
        eventId: plotEventId,
        campaignId: fixture.campaignId,
        operationId,
        eventType: "plot.bastion-pressure.resolved",
        origin: "SCHEDULED_EFFECT",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs,
        visibility: { scope: "MJ_PRIVATE", actorIds: [] },
        occurredAtGameSecond: 1_800,
        payloadSchemaVersion: 1,
        payload
      }],
      outboxTasks: []
    }));
    ok(await fixture.repository.completePresentation(
      operationId,
      "COMMITTED_RENDERED",
      1,
      { schemaVersion: 1, status: "EMITTED" }
    ));
  } finally {
    ok(await fixture.repository.releaseWriterLease(lease));
  }
  return {
    operationId,
    opportunityEventId,
    consequenceEventId,
    defenseEventId,
    plotEventId
  };
}

function bastionDefenseSeed(
  campaignId: CampaignId,
  sourceEventId: EventId
): TacticalEncounterSeedV1 {
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    seedId: "seed:bastion-defense:night-raid",
    processId: "process:bastion-defense:night-raid",
    campaignId,
    sceneId: "scene:old-bridge-inn",
    locationRef: { kind: "place", id: "place:old-bridge-inn" },
    startedAtGameSecond: 1_800,
    rulesetRef: { kind: "ruleset", id: "rules.jdr5e:2" },
    cause: { sourceEventId, narrativeCanResolve: false },
    stakes: { defendedPlace: "place:old-bridge-inn", outcomePending: true },
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
      { kind: "bastion", id: "bastion:place:old-bridge-inn" },
      { kind: "event", id: sourceEventId }
    ],
    seedFingerprint: "fixture:bastion-defense:night-raid",
    version: 1
  };
}

function command(
  fixture: Awaited<ReturnType<typeof setup>>,
  clientRequestId: string
): EstablishBastionCommandV1 {
  return {
    schemaVersion: 1,
    contractVersion: BASTION_ESTABLISHMENT_CONTRACT_V1,
    clientRequestId,
    sourceOperationId: fixture.sourceOperationId,
    sourceEventId: fixture.sourceEventId
  };
}

const eligiblePolicy: BastionAcquisitionPolicyV1 = {
  policyRef: "bastion-acquisition-policy:property-event-v1",
  evaluate({ sourceEvent }) {
    return sourceEvent.eventType === "property.acquisition.confirmed"
      ? {
          schemaVersion: 1,
          eligible: true,
          reasonCode: "PROPERTY_ACQUISITION_CONFIRMED",
          placeRef: "place:old-bridge-inn",
          ownerRef: "character:pc-aryn",
          ownerDisplayName: "Aryn"
        }
      : {
          schemaVersion: 1,
          eligible: false,
          reasonCode: "EVENT_NOT_AN_ACQUISITION",
          placeRef: null,
          ownerRef: null,
          ownerDisplayName: null
        };
  }
};

const placeResolver: BastionPlaceResolverV1 = {
  resolverRef: "place-catalog:fixture-v1",
  resolve({ placeRef }) {
    return placeRef === "place:old-bridge-inn"
      ? {
          schemaVersion: 1,
          exists: true,
          placeRef,
          placeDisplayName: "L’Auberge du Vieux Pont",
          publicSourceRefs: ["place:old-bridge-inn", "district:merchant-quarter"]
        }
      : {
          schemaVersion: 1,
          exists: false,
          placeRef,
          placeDisplayName: null,
          publicSourceRefs: []
        };
  }
};

async function main(): Promise<void> {
  const fixture = await setup();
  const campaignBefore = ok(await fixture.repository.getCampaign(fixture.campaignId));

  const withoutPolicy = await establishBastionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-bastion-without-policy"),
    acquisitionPolicy: null,
    placeResolver
  });
  assert.equal(withoutPolicy.ok, false);

  let ineligibleCalls = 0;
  const ineligible = ok(await establishBastionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-bastion-ineligible"),
    acquisitionPolicy: {
      policyRef: "bastion-acquisition-policy:reject-v1",
      evaluate: () => {
        ineligibleCalls += 1;
        return {
          schemaVersion: 1,
          eligible: false,
          reasonCode: "SOURCE_NOT_AUTHORIZED",
          placeRef: null,
          ownerRef: null,
          ownerDisplayName: null
        };
      }
    },
    placeResolver
  }));
  assert.equal(ineligible.status, "INELIGIBLE");
  assert.equal(ineligible.commitId, null);
  assert.equal(ineligibleCalls, 1);
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    campaignBefore.campaignRevision
  );

  const invalidPlaceResolution = await establishBastionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-bastion-invalid-place-resolution"),
    acquisitionPolicy: eligiblePolicy,
    placeResolver: {
      resolverRef: "place-catalog:invalid-v1",
      resolve: ({ placeRef }) => ({
        schemaVersion: 1,
        exists: true,
        placeRef,
        placeDisplayName: null,
        publicSourceRefs: []
      })
    }
  });
  assert.equal(invalidPlaceResolution.ok, false);
  const invalidPlaceOperation = await fixture.repository.getOperation(
    id<OperationId>(
      "bastion-establishment:req-bastion-invalid-place-resolution"
    )
  );
  assert.equal(invalidPlaceOperation.ok, false);
  if (!invalidPlaceOperation.ok) {
    assert.equal(invalidPlaceOperation.error.code, "NOT_FOUND");
  }

  const missingPlace = ok(await establishBastionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-bastion-missing-place"),
    acquisitionPolicy: eligiblePolicy,
    placeResolver: {
      resolverRef: "place-catalog:missing-v1",
      resolve: ({ placeRef }) => ({
        schemaVersion: 1,
        exists: false,
        placeRef,
        placeDisplayName: null,
        publicSourceRefs: []
      })
    }
  }));
  assert.equal(missingPlace.status, "INELIGIBLE");
  assert.equal(missingPlace.reasonCode, "PLACE_NOT_FOUND");
  assert.equal(missingPlace.commitId, null);

  let eligibleCalls = 0;
  const countedPolicy: BastionAcquisitionPolicyV1 = {
    ...eligiblePolicy,
    evaluate: input => {
      eligibleCalls += 1;
      return eligiblePolicy.evaluate(input);
    }
  };
  const establishmentInput = command(fixture, "req-bastion-establish");
  const established = ok(await establishBastionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: establishmentInput,
    acquisitionPolicy: countedPolicy,
    placeResolver
  }));
  assert.equal(established.status, "ESTABLISHED");
  assert.equal(established.bastion?.status, "ACTIVE");
  assert.equal(established.bastion?.placeRef, "place:old-bridge-inn");
  assert.equal(established.bastion?.establishedAtGameSecond, 0);
  assert.equal(established.publicSummary?.placeDisplayName, "L’Auberge du Vieux Pont");
  assert.equal(eligibleCalls, 1);

  const replayed = ok(await establishBastionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: establishmentInput,
    acquisitionPolicy: countedPolicy,
    placeResolver
  }));
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.commitId, established.commitId);
  assert.equal(eligibleCalls, 1, "replay must not call the acquisition policy again");

  const registry = ok(await loadBastionRegistryV1(
    fixture.repository,
    fixture.campaignId
  ));
  assert.equal(registry.state.bastions.length, 1);
  assert.equal(registry.aggregate?.aggregateType, BASTION_REGISTRY_AGGREGATE_TYPE_V1);
  assert.equal(
    registry.aggregate?.aggregateId,
    bastionRegistryAggregateIdV1(fixture.campaignId)
  );
  const serializedRegistry = JSON.stringify(registry.state);
  assert.equal(serializedRegistry.includes("rooms"), false);
  assert.equal(serializedRegistry.includes("occupants"), false);
  assert.equal(serializedRegistry.includes("privatePrice"), false);
  assert.equal(serializedRegistry.includes("private-red-ledger"), false);

  const duplicate = ok(await establishBastionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: command(fixture, "req-bastion-establish-again"),
    acquisitionPolicy: eligiblePolicy,
    placeResolver
  }));
  assert.equal(duplicate.status, "ALREADY_ESTABLISHED");
  assert.equal(duplicate.commitId, null);
  assert.equal(
    ok(await loadBastionRegistryV1(fixture.repository, fixture.campaignId))
      .state.bastions.length,
    1
  );

  const conflict = await establishBastionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      ...establishmentInput,
      sourceEventId: "event:different-source"
    },
    acquisitionPolicy: eligiblePolicy,
    placeResolver
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const publicEvents = ok(await fixture.repository.listEvents(
    fixture.campaignId,
    null,
    100
  )).filter(event => event.eventType === "bastion_established");
  assert.equal(publicEvents.length, 1);
  assert.equal(publicEvents[0]?.visibility.scope, "PLAYER_VISIBLE");
  const serializedPublicEvent = JSON.stringify(publicEvents[0]);
  assert.equal(serializedPublicEvent.includes("privatePrice"), false);
  assert.equal(serializedPublicEvent.includes("private-red-ledger"), false);

  const controller = new NarrativeTurnControllerV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    clock: fixture.clock,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null
  });
  const projected = ok(await controller.projectBastionEstablishment({
    schemaVersion: 1,
    establishmentOperationId: "bastion-establishment:req-bastion-establish",
    sceneId: "scene:old-bridge-inn"
  }));
  assert.equal(projected.displayPacket.displayBlocks.length, 1);
  assert.equal(
    projected.displayPacket.displayBlocks[0]?.text,
    "L’Auberge du Vieux Pont appartient désormais à Aryn et devient son point "
      + "d’ancrage. Le lieu reste pour l’instant tel qu’il est : aucun "
      + "aménagement ni occupant supplémentaire n’est encore établi."
  );
  assert.equal(JSON.stringify(projected.displayPacket).includes("privatePrice"), false);

  const projectedReplay = ok(await controller.projectBastionEstablishment({
    schemaVersion: 1,
    establishmentOperationId: "bastion-establishment:req-bastion-establish",
    sceneId: "scene:old-bridge-inn"
  }));
  assert.equal(
    projectedReplay.projection.operation.operationId,
    projected.projection.operation.operationId
  );
  const restored = ok(await controller.restoreRenderedThread());
  assert.equal(restored.displayPackets.length, 1);
  assert.deepEqual(restored.displayPackets[0], projected.displayPacket);

  const paidCatalog: BastionWorkCatalogV1 = {
    catalogRef: "bastion-work-catalog:fixture-v1",
    resolve(workDefinitionRef) {
      return workDefinitionRef === "work:repair-roof"
        ? {
            schemaVersion: 1,
            contractVersion: BASTION_WORK_CATALOG_CONTRACT_V1,
            workDefinitionRef,
            displayName: "Réparer la toiture",
            durationSeconds: 7_200,
            prerequisites: [{
              schemaVersion: 1,
              prerequisiteRef: "currency:gold-piece",
              quantity: 100,
              unit: "piece"
            }],
            effect: {
              schemaVersion: 1,
              kind: "ADD_INSTALLATION",
              installationDefinitionRef: "installation:roof-repaired",
              installationDisplayName: "Toiture réparée"
            },
            completionNarrative:
              "Les dernières tuiles sont remises en place. L’auberge est désormais "
              + "protégée de la pluie par une toiture entièrement réparée."
          }
        : null;
    }
  };
  const blockedCampaignRevision = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  ).campaignRevision;
  const unknownWork = await startBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
      clientRequestId: "req-bastion-unknown-work",
      bastionId: established.bastion!.bastionId,
      workDefinitionRef: "work:not-in-catalog"
    },
    catalog: paidCatalog,
    prerequisiteAuthority: null
  });
  assert.equal(unknownWork.ok, false);
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    blockedCampaignRevision
  );
  const blockedPaidWork = ok(await startBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
      clientRequestId: "req-bastion-paid-work-without-authority",
      bastionId: established.bastion!.bastionId,
      workDefinitionRef: "work:repair-roof"
    },
    catalog: paidCatalog,
    prerequisiteAuthority: null
  }));
  assert.equal(blockedPaidWork.status, "BLOCKED_BY_PREREQUISITE");
  assert.equal(
    blockedPaidWork.reasonCode,
    "PREREQUISITE_AUTHORITY_UNAVAILABLE"
  );
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    blockedCampaignRevision,
    "missing payment authority must never turn a priced work into a free commit"
  );

  const freeCatalog: BastionWorkCatalogV1 = {
    catalogRef: "bastion-work-catalog:fixture-v1",
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
  const startCommand = {
    schemaVersion: 1 as const,
    contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
    clientRequestId: "req-bastion-clear-east-room",
    bastionId: established.bastion!.bastionId,
    workDefinitionRef: "work:clear-east-room"
  };
  const scheduled = ok(await startBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: startCommand,
    catalog: freeCatalog,
    prerequisiteAuthority: null
  }));
  assert.equal(scheduled.status, "SCHEDULED");
  assert.equal(scheduled.workOrder?.startedAtGameSecond, 0);
  assert.equal(scheduled.workOrder?.dueAtGameSecond, 1_800);
  assert.deepEqual(scheduled.workOrder?.prerequisiteProofRefs, []);
  const scheduledReplay = ok(await startBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: startCommand,
    catalog: freeCatalog,
    prerequisiteAuthority: null
  }));
  assert.equal(scheduledReplay.replayed, true);
  assert.equal(scheduledReplay.commitId, scheduled.commitId);
  const schedule = ok(await fixture.repository.getAggregate(
    fixture.campaignId,
    "world.schedule",
    bastionWorkScheduleAggregateIdV1(
      fixture.campaignId,
      established.bastion!.bastionId
    )
  ));
  assert.equal((schedule.payload.effects as unknown[]).length, 1);

  const notDue = ok(await completeBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
      clientRequestId: "req-bastion-clear-east-room-too-early",
      bastionId: established.bastion!.bastionId,
      workOrderId: scheduled.workOrder!.workOrderId,
      requestedThroughGameSecond: 1_799
    },
    simulationCursorAggregateId: id<AggregateId>(
      "agg-bastion-world-simulation-cursor"
    )
  }));
  assert.equal(notDue.status, "NOT_DUE");
  assert.equal(notDue.commitId, null);

  const completionCommand = {
    schemaVersion: 1 as const,
    contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
    clientRequestId: "req-bastion-clear-east-room-complete",
    bastionId: established.bastion!.bastionId,
    workOrderId: scheduled.workOrder!.workOrderId,
    requestedThroughGameSecond: 1_800
  };
  const completedWork = ok(await completeBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: completionCommand,
    simulationCursorAggregateId: id<AggregateId>(
      "agg-bastion-world-simulation-cursor"
    )
  }));
  assert.equal(completedWork.status, "COMPLETED");
  assert.equal(completedWork.installation?.displayName, "Ancienne salle commune déblayée");
  assert.equal(completedWork.publicSummary?.completedAtGameSecond, 1_800);
  const completedReplay = ok(await completeBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: completionCommand,
    simulationCursorAggregateId: id<AggregateId>(
      "agg-bastion-world-simulation-cursor"
    )
  }));
  assert.equal(completedReplay.replayed, true);
  assert.equal(completedReplay.commitId, completedWork.commitId);
  const completedRegistry = ok(await loadBastionRegistryV1(
    fixture.repository,
    fixture.campaignId
  ));
  assert.equal(completedRegistry.state.bastions[0]?.installations.length, 1);
  assert.equal(completedRegistry.state.bastions[0]?.workOrders[0]?.status, "COMPLETED");
  const campaignClock = ok(await fixture.repository.getAggregate(
    fixture.campaignId,
    "world.clock",
    id<AggregateId>("agg-bastion-clock")
  ));
  assert.equal(campaignClock.payload.elapsedGameSeconds, 1_800);

  const projectedWork = ok(await controller.projectBastionWorkCompletion({
    schemaVersion: 1,
    completionOperationId:
      "bastion-work-completion:req-bastion-clear-east-room-complete",
    sceneId: "scene:old-bridge-inn"
  }));
  assert.equal(
    projectedWork.displayPacket.displayBlocks[0]?.text,
    "Après une demi-heure à dégager les planches brisées et la poussière, "
      + "l’ancienne salle commune respire de nouveau. Son sol est libre "
      + "et l’espace peut désormais être aménagé."
  );
  const restoredWithWork = ok(await controller.restoreRenderedThread());
  assert.equal(restoredWithWork.displayPackets.length, 2);
  assert.deepEqual(restoredWithWork.displayPackets[1], projectedWork.displayPacket);

  const authorizedPaidWork = ok(await startBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
      clientRequestId: "req-bastion-paid-work-authorized",
      bastionId: established.bastion!.bastionId,
      workDefinitionRef: "work:repair-roof"
    },
    catalog: paidCatalog,
    prerequisiteAuthority: {
      authorityRef: "campaign-economy:fixture-v1",
      authorize: () => ({
        schemaVersion: 1,
        authorized: true,
        reasonCode: "PAYMENT_RESERVED",
        proofRefs: ["economy-reservation:roof-repair-100-gp"]
      })
    }
  }));
  assert.equal(authorizedPaidWork.status, "SCHEDULED");
  assert.deepEqual(
    authorizedPaidWork.workOrder?.prerequisiteProofRefs,
    ["economy-reservation:roof-repair-100-gp"]
  );
  const revisionBeforeWorldBoundary = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  ).campaignRevision;
  const blockedByWorldBoundary = await completeBastionWorkV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_WORK_ORDER_CONTRACT_V1,
      clientRequestId: "req-bastion-paid-work-before-world-boundary",
      bastionId: established.bastion!.bastionId,
      workOrderId: authorizedPaidWork.workOrder!.workOrderId,
      requestedThroughGameSecond: authorizedPaidWork.workOrder!.dueAtGameSecond
    },
    simulationCursorAggregateId: id<AggregateId>(
      "agg-bastion-world-simulation-cursor"
    )
  });
  assert.equal(blockedByWorldBoundary.ok, false);
  if (!blockedByWorldBoundary.ok) {
    assert.equal(
      blockedByWorldBoundary.error.messageKey,
      "bastion.world-simulation-boundary-required"
    );
  }
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    revisionBeforeWorldBoundary,
    "bastion work must not skip a due world simulation boundary"
  );

  const occupantAuthorityFixture = await commitOccupantAuthorityFixture(fixture);
  const occupantCatalog: BastionOccupantCatalogV1 = {
    catalogRef: "bastion-occupant-catalog:fixture-v1",
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
      if (activityDefinitionRef === "activity:inspect-shutters") {
        return {
            schemaVersion: 1,
            contractVersion: BASTION_OCCUPANT_CATALOG_CONTRACT_V1,
            activityDefinitionRef,
            displayName: "Inspection des volets",
            minimumIntervalSeconds: 900,
            publicNarrative:
              "Sans attendre Aryn, Mira fait le tour de l’auberge. Elle replace "
              + "un gond descellé et referme les volets exposés au vent du pont."
          };
      }
      return activityDefinitionRef === "activity:unrelated-performance"
        ? {
            schemaVersion: 1,
            contractVersion: BASTION_OCCUPANT_CATALOG_CONTRACT_V1,
            activityDefinitionRef,
            displayName: "Représentation sans rapport",
            minimumIntervalSeconds: 0,
            publicNarrative: "Mira improvise une représentation."
          }
        : null;
    }
  };
  const assignmentCommand = {
    schemaVersion: 1 as const,
    contractVersion: BASTION_OCCUPANT_ASSIGNMENT_CONTRACT_V1,
    clientRequestId: "req-bastion-assign-mira",
    bastionId: established.bastion!.bastionId,
    campaignNpcId: occupantAuthorityFixture.campaignNpcId,
    roleDefinitionRef: "role:steward"
  };
  const revisionBeforeMissingOwner = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  ).campaignRevision;
  const blockedAssignment = ok(await assignBastionOccupantV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: { ...assignmentCommand, clientRequestId: "req-bastion-assign-mira-no-owner" },
    catalog: occupantCatalog,
    authority: null
  }));
  assert.equal(blockedAssignment.status, "BLOCKED_BY_OWNER");
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    revisionBeforeMissingOwner
  );
  const assigned = ok(await assignBastionOccupantV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: assignmentCommand,
    catalog: occupantCatalog,
    authority: {
      authorityRef: "social-actor-authority:fixture-v1",
      authorize: () => ({
        schemaVersion: 1,
        authorized: true,
        reasonCode: "NPC_ACCEPTED_ASSIGNMENT",
        sourceOperationId: occupantAuthorityFixture.operationId,
        sourceEventId: occupantAuthorityFixture.assignmentEventId,
        proofRefs: ["social-decision:mira-stewardship"]
      })
    }
  }));
  assert.equal(assigned.status, "ASSIGNED");
  assert.equal(assigned.assignment?.actorDisplayName, "Mira");
  const assignedReplay = ok(await assignBastionOccupantV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: assignmentCommand,
    catalog: occupantCatalog,
    authority: {
      authorityRef: "must-not-be-called-on-replay",
      authorize: () => {
        assert.fail("assignment authority must not run during replay");
      }
    }
  }));
  assert.equal(assignedReplay.replayed, true);

  const disallowedActivity = await resolveBastionOccupantActivityBoundaryV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1,
      clientRequestId: "req-bastion-occupant-disallowed-activity",
      bastionId: established.bastion!.bastionId,
      assignmentId: assigned.assignment!.assignmentId,
      boundaryKind: "LOCAL_TIME_BOUNDARY",
      occurredAtGameSecond: 1_800
    },
    catalog: occupantCatalog,
    authority: {
      authorityRef: "social-actor-initiative:fixture-v1",
      select: () => ({
        schemaVersion: 1,
        authorized: true,
        reasonCode: "ACTIVITY_SELECTED",
        sourceOperationId: occupantAuthorityFixture.operationId,
        sourceEventId: occupantAuthorityFixture.activityEventId,
        proofRefs: ["social-concern:mira-unrelated"],
        activityDefinitionRef: "activity:unrelated-performance"
      })
    }
  });
  assert.equal(disallowedActivity.ok, false);
  if (!disallowedActivity.ok) {
    assert.equal(
      disallowedActivity.error.messageKey,
      "bastion.occupant-activity-not-allowed"
    );
  }

  const calmRevision = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  ).campaignRevision;
  const calmBoundary = ok(await controller.processBastionOccupantBoundary({
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1,
      clientRequestId: "req-bastion-occupant-calm",
      bastionId: established.bastion!.bastionId,
      assignmentId: assigned.assignment!.assignmentId,
      boundaryKind: "LOCAL_TIME_BOUNDARY",
      occurredAtGameSecond: 1_800
    },
    catalog: occupantCatalog,
    authority: null
  }));
  assert.equal(calmBoundary.activityResult.status, "CALM");
  assert.equal(calmBoundary.projection, null);
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    calmRevision
  );
  const activityCommand = {
    schemaVersion: 1 as const,
    contractVersion: BASTION_OCCUPANT_ACTIVITY_CONTRACT_V1,
    clientRequestId: "req-bastion-occupant-mira-inspects",
    bastionId: established.bastion!.bastionId,
    assignmentId: assigned.assignment!.assignmentId,
    boundaryKind: "LOCAL_TIME_BOUNDARY" as const,
    occurredAtGameSecond: 1_800
  };
  const activityAuthority = {
    authorityRef: "social-actor-initiative:fixture-v1",
    select: () => ({
      schemaVersion: 1 as const,
      authorized: true,
      reasonCode: "ACTIVE_CONCERN_SELECTED",
      sourceOperationId: occupantAuthorityFixture.operationId,
      sourceEventId: occupantAuthorityFixture.activityEventId,
      proofRefs: ["social-concern:mira-protect-building"],
      activityDefinitionRef: "activity:inspect-shutters"
    })
  };
  const activity = ok(await resolveBastionOccupantActivityBoundaryV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: activityCommand,
    catalog: occupantCatalog,
    authority: activityAuthority
  }));
  assert.equal(activity.status, "ACTIVITY_COMMITTED");
  assert.equal(activity.activity?.campaignNpcId, occupantAuthorityFixture.campaignNpcId);
  const activityReplay = ok(await resolveBastionOccupantActivityBoundaryV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: activityCommand,
    catalog: occupantCatalog,
    authority: activityAuthority
  }));
  assert.equal(activityReplay.replayed, true);
  const occupiedRegistry = ok(await loadBastionRegistryV1(
    fixture.repository,
    fixture.campaignId
  ));
  assert.equal(occupiedRegistry.state.bastions[0]?.occupantAssignments.length, 1);
  assert.equal(occupiedRegistry.state.bastions[0]?.occupantActivities.length, 1);
  assert.equal(
    occupiedRegistry.state.bastions[0]?.occupantAssignments[0]?.activityCount,
    1
  );

  const projectedAssignment = ok(await controller.projectBastionOccupantAssignment({
    schemaVersion: 1,
    assignmentOperationId: "bastion-occupant-assignment:req-bastion-assign-mira",
    sceneId: "scene:old-bridge-inn"
  }));
  assert.equal(
    projectedAssignment.displayPacket.displayBlocks[0]?.text,
    "Mira exerce désormais le rôle « intendante » à L’Auberge du Vieux Pont. "
      + "L’affectation est établie ; ses décisions et ses initiatives restent les siennes."
  );
  const projectedActivity = ok(await controller.projectBastionOccupantActivity({
    schemaVersion: 1,
    activityOperationId:
      "bastion-occupant-activity:req-bastion-occupant-mira-inspects",
    sceneId: "scene:old-bridge-inn"
  }));
  assert.equal(
    projectedActivity.displayPacket.displayBlocks[0]?.text,
    "Sans attendre Aryn, Mira fait le tour de l’auberge. Elle replace un gond "
      + "descellé et referme les volets exposés au vent du pont."
  );
  const restoredWithOccupant = ok(await controller.restoreRenderedThread());
  assert.equal(restoredWithOccupant.displayPackets.length, 4);
  assert.deepEqual(
    restoredWithOccupant.displayPackets.find(packet =>
      packet.operationId
        === "bastion-occupant-activity:req-bastion-occupant-mira-inspects"
    ),
    projectedActivity.displayPacket
  );
  const occupantPublicEvents = ok(await fixture.repository.listEvents(
    fixture.campaignId,
    null,
    200
  )).filter(event =>
    event.eventType === "bastion_occupant_assigned"
    || event.eventType === "bastion_occupant_activity_completed"
  );
  assert.equal(occupantPublicEvents.length, 2);
  assert.equal(
    JSON.stringify(occupantPublicEvents).includes("Préserver sa liberté"),
    false
  );

  const incidentSource = await commitBastionIncidentSourceFixture(fixture);
  const incidentCatalog: BastionIncidentCatalogV1 = {
    catalogRef: "bastion-incident-catalog:fixture-v1",
    resolve(incidentDefinitionRef): BastionIncidentDefinitionV1 | null {
      if (incidentDefinitionRef === "incident:merchant-offer") {
        return {
          schemaVersion: 1,
          contractVersion: BASTION_INCIDENT_CATALOG_CONTRACT_V1,
          incidentDefinitionRef,
          displayName: "Offre d’un marchand de passage",
          kind: "OPPORTUNITY",
          publicNarrative:
            "Un marchand de passage s’arrête à l’auberge et propose de fournir "
            + "du bois sec à prix réduit. L’offre reste ouverte : Aryn peut "
            + "l’examiner ou la laisser passer.",
          effect: { schemaVersion: 1, kind: "RECORD_ONLY" }
        };
      }
      if (incidentDefinitionRef === "incident:storm-damaged-east-room") {
        return {
          schemaVersion: 1,
          contractVersion: BASTION_INCIDENT_CATALOG_CONTRACT_V1,
          incidentDefinitionRef,
          displayName: "Dégâts de la tempête",
          kind: "INSTALLATION_CONSEQUENCE",
          publicNarrative:
            "Une rafale arrache les protections provisoires de l’ancienne salle "
            + "commune. La pièce déblayée est désormais endommagée.",
          effect: {
            schemaVersion: 1,
            kind: "SET_INSTALLATION_STATUS",
            targetInstallationDefinitionRef: "installation:east-room-cleared",
            nextStatus: "DAMAGED"
          }
        };
      }
      return incidentDefinitionRef === "incident:night-raid"
        ? {
            schemaVersion: 1,
            contractVersion: BASTION_INCIDENT_CATALOG_CONTRACT_V1,
            incidentDefinitionRef,
            displayName: "Raid nocturne",
            kind: "TACTICAL_DEFENSE",
            publicNarrative:
              "Des silhouettes armées franchissent la cour sous la pluie. La "
              + "défense de l’auberge commence ; son issue reste indécise.",
            effect: { schemaVersion: 1, kind: "TACTICAL_HANDOFF" }
          }
        : null;
    }
  };
  const incidentPolicy: BastionIncidentPolicyV1 = {
    policyRef: "bastion-incident-policy:fixture-v1",
    evaluate({ sourceEvent }) {
      const definitionRef = sourceEvent.eventType === "world.bastion-opportunity"
        ? "incident:merchant-offer"
        : sourceEvent.eventType === "world.bastion-weather-damage"
          ? "incident:storm-damaged-east-room"
          : sourceEvent.eventType === "world.bastion-attack"
            ? "incident:night-raid"
            : null;
      return {
        schemaVersion: 1,
        eligible: definitionRef !== null,
        reasonCode: definitionRef === null ? "EVENT_OUTSIDE_POLICY" : "EVENT_MAPPED",
        incidentDefinitionRef: definitionRef
      };
    }
  };
  const causeRoutingPolicy = {
    policyRef: "bastion-cause-routing:place-ref-v1",
    evaluate({ sourceEvent, activeBastions }: {
      sourceEvent: EventRecord;
      activeBastions: BastionRecordV1[];
    }) {
      const placeRef = typeof sourceEvent.payload.placeRef === "string"
        ? sourceEvent.payload.placeRef
        : null;
      const target = activeBastions.find(value =>
        value.placeRef === placeRef
      );
      return {
        schemaVersion: 1 as const,
        sourceKind: "WORLD_SIMULATION" as const,
        disposition: target === undefined
          ? "IGNORE" as const
          : "TARGET" as const,
        reasonCode: target === undefined
          ? "NO_BASTION_AT_CAUSE_PLACE"
          : "BASTION_AT_CAUSE_PLACE",
        bastionId: target?.bastionId ?? null
      };
    }
  };
  const ignoredRevision = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  ).campaignRevision;
  const ignoredIncident = ok(await handleBastionIncidentV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_INCIDENT_CONTRACT_V1,
      clientRequestId: "req-bastion-incident-ignored",
      bastionId: established.bastion!.bastionId,
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.opportunityEventId
    },
    catalog: incidentCatalog,
    policy: {
      policyRef: "bastion-incident-policy:ignore-fixture",
      evaluate: () => ({
        schemaVersion: 1,
        eligible: false,
        reasonCode: "NO_INCIDENT_DUE",
        incidentDefinitionRef: null
      })
    },
    defenseAuthority: null
  }));
  assert.equal(ignoredIncident.status, "IGNORED");
  assert.equal(ignoredIncident.commitId, null);
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    ignoredRevision,
    "an ignored source must not mutate the campaign"
  );

  const calmRoutingRevision = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  ).campaignRevision;
  const calmPlotCause = ok(
    await controller.processCommittedBastionCauseBoundary({
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.plotEventId,
      causeRoutingPolicy: {
        policyRef: "bastion-cause-routing:calm-plot-v1",
        evaluate: () => ({
          schemaVersion: 1,
          sourceKind: "PLOT",
          disposition: "IGNORE",
          reasonCode: "PLOT_DOES_NOT_TARGET_A_BASTION",
          bastionId: null
        })
      }
    })
  );
  assert.equal(calmPlotCause.routing.status, "IGNORED");
  assert.equal(calmPlotCause.incidentResult, null);
  assert.equal(calmPlotCause.projection, null);
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId))
      .campaignRevision,
    calmRoutingRevision,
    "an unrelated committed plot cause must remain mutation-free"
  );
  const unavailableTarget =
    await controller.processCommittedBastionCauseBoundary({
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.opportunityEventId,
      causeRoutingPolicy: {
        policyRef: "bastion-cause-routing:invalid-target-v1",
        evaluate: () => ({
          schemaVersion: 1,
          sourceKind: "WORLD_SIMULATION",
          disposition: "TARGET",
          reasonCode: "INVALID_TEST_TARGET",
          bastionId: "bastion:absent"
        })
      }
    });
  assert.equal(unavailableTarget.ok, false);
  if (!unavailableTarget.ok) {
    assert.equal(
      unavailableTarget.error.messageKey,
      "bastion.cause-router.target-unavailable"
    );
  }

  const opportunity = ok(
    await controller.processCommittedBastionCauseBoundary({
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.opportunityEventId,
      causeRoutingPolicy,
      catalog: incidentCatalog,
      incidentPolicy,
      defenseAuthority: null,
      sceneId: "scene:old-bridge-inn"
    })
  );
  assert.equal(opportunity.routing.status, "TARGETED");
  assert.equal(
    opportunity.routing.bastionId,
    established.bastion!.bastionId
  );
  assert.equal(
    JSON.stringify(opportunity.routing).includes("privateAttackerPlan"),
    false
  );
  assert.equal(opportunity.incidentResult?.status, "RECORDED");
  assert.equal(opportunity.incidentResult?.incident?.status, "OPEN");
  assert.equal(
    opportunity.projection?.displayPacket.displayBlocks[0]?.text,
    "Un marchand de passage s’arrête à l’auberge et propose de fournir du bois "
      + "sec à prix réduit. L’offre reste ouverte : Aryn peut l’examiner ou la laisser passer."
  );
  const routedReplay = ok(
    await controller.processCommittedBastionCauseBoundary({
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.opportunityEventId,
      causeRoutingPolicy,
      catalog: incidentCatalog,
      incidentPolicy,
      defenseAuthority: null,
      sceneId: "scene:old-bridge-inn"
    })
  );
  assert.equal(
    routedReplay.routing.command?.clientRequestId,
    opportunity.routing.command?.clientRequestId
  );
  assert.equal(routedReplay.incidentResult?.replayed, true);

  const consequence = ok(await controller.processBastionIncidentBoundary({
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_INCIDENT_CONTRACT_V1,
      clientRequestId: "req-bastion-storm-consequence",
      bastionId: established.bastion!.bastionId,
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.consequenceEventId
    },
    catalog: incidentCatalog,
    policy: incidentPolicy,
    defenseAuthority: null,
    sceneId: "scene:old-bridge-inn"
  }));
  assert.equal(consequence.incidentResult.status, "CONSEQUENCE_APPLIED");
  assert.equal(
    consequence.incidentResult.publicSummary?.affectedInstallationDisplayName,
    "Ancienne salle commune déblayée"
  );
  const afterConsequence = ok(await loadBastionRegistryV1(
    fixture.repository,
    fixture.campaignId
  ));
  assert.equal(
    afterConsequence.state.bastions[0]?.installations.find(value =>
      value.installationDefinitionRef === "installation:east-room-cleared"
    )?.status,
    "DAMAGED"
  );

  const revisionBeforeMissingTacticalOwner = ok(
    await fixture.repository.getCampaign(fixture.campaignId)
  ).campaignRevision;
  const missingTacticalOwner = await handleBastionIncidentV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_INCIDENT_CONTRACT_V1,
      clientRequestId: "req-bastion-defense-without-owner",
      bastionId: established.bastion!.bastionId,
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.defenseEventId
    },
    catalog: incidentCatalog,
    policy: incidentPolicy,
    defenseAuthority: null
  });
  assert.equal(missingTacticalOwner.ok, false);
  if (!missingTacticalOwner.ok) {
    assert.equal(
      missingTacticalOwner.error.messageKey,
      "bastion.defense-authority-required"
    );
  }
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    revisionBeforeMissingTacticalOwner,
    "narration must not resolve or commit a defense without the tactical owner"
  );
  const mismatchedSeed = await handleBastionIncidentV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: BASTION_INCIDENT_CONTRACT_V1,
      clientRequestId: "req-bastion-defense-mismatched-seed",
      bastionId: established.bastion!.bastionId,
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.defenseEventId
    },
    catalog: incidentCatalog,
    policy: incidentPolicy,
    defenseAuthority: {
      authorityRef: "tactical-encounter-owner:mismatched-fixture",
      prepare: ({ sourceEvent }) => ({
        schemaVersion: 1,
        authorized: true,
        reasonCode: "TACTICAL_SEED_READY",
        seed: {
          ...bastionDefenseSeed(fixture.campaignId, sourceEvent.eventId),
          locationRef: { kind: "place", id: "place:somewhere-else" }
        }
      })
    }
  });
  assert.equal(mismatchedSeed.ok, false);
  if (!mismatchedSeed.ok) {
    assert.equal(mismatchedSeed.error.messageKey, "bastion.defense-seed-mismatch");
  }
  assert.equal(
    ok(await fixture.repository.getCampaign(fixture.campaignId)).campaignRevision,
    revisionBeforeMissingTacticalOwner,
    "a mismatched tactical seed must not mutate the bastion"
  );

  const routedDefense = ok(
    await controller.processCommittedBastionCauseBoundary({
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.defenseEventId,
      causeRoutingPolicy,
      catalog: incidentCatalog,
      incidentPolicy,
      defenseAuthority: {
        authorityRef: "tactical-encounter-owner:fixture-v1",
        prepare: ({ sourceEvent }) => ({
          schemaVersion: 1,
          authorized: true,
          reasonCode: "TACTICAL_SEED_READY",
          seed: bastionDefenseSeed(
            fixture.campaignId,
            sourceEvent.eventId
          )
        })
      },
      sceneId: "scene:old-bridge-inn"
    })
  );
  assert.equal(routedDefense.routing.status, "TARGETED");
  assert.notEqual(routedDefense.incidentResult, null);
  const defense = {
    incidentResult: routedDefense.incidentResult!,
    projection: routedDefense.projection
  };
  assert.equal(defense.incidentResult.status, "HANDOFF_CREATED");
  assert.equal(defense.incidentResult.incident?.status, "HANDOFF_ACTIVE");
  assert.equal(
    defense.projection?.displayPacket.displayBlocks[0]?.text,
    "Des silhouettes armées franchissent la cour sous la pluie. La défense de "
      + "l’auberge commence ; son issue reste indécise."
  );
  const defenseProcessId = defense.incidentResult.incident!.tacticalProcessId!;
  const handoff = ok(await fixture.repository.getAggregate(
    fixture.campaignId,
    "process.handoff",
    bastionTacticalHandoffAggregateIdV1(defenseProcessId)
  ));
  const seed = ok(await fixture.repository.getAggregate(
    fixture.campaignId,
    "tactical.encounter-seed",
    bastionTacticalSeedAggregateIdV1(defenseProcessId)
  ));
  assert.equal(handoff.payload.status, "ACTIVE");
  assert.equal(seed.payload.processId, defenseProcessId);
  assert.equal("placeDamage" in seed.payload, false);
  const restoredTacticalSession = ok(await restoreActiveBastionTacticalSessionV1({
    repository: fixture.repository,
    campaignId: fixture.campaignId
  }));
  assert.equal(restoredTacticalSession?.status, "READY_FOR_TACTICAL");
  assert.equal(restoredTacticalSession?.process.processId, defenseProcessId);
  assert.equal(restoredTacticalSession?.seed.seedId, seed.payload.seedId);
  assert.equal(
    JSON.stringify(restoredTacticalSession?.summary).includes("privateAttackerPlan"),
    false
  );
  const defenseReplay = ok(
    await controller.processCommittedBastionCauseBoundary({
      sourceOperationId: incidentSource.operationId,
      sourceEventId: incidentSource.defenseEventId,
      causeRoutingPolicy,
      catalog: incidentCatalog,
      incidentPolicy,
      defenseAuthority: {
        authorityRef: "must-not-run-on-replay",
        prepare: () => {
          assert.fail(
            "tactical authority must not run during an idempotent replay"
          );
        }
      },
      sceneId: "scene:old-bridge-inn"
    })
  );
  assert.equal(defenseReplay.incidentResult?.replayed, true);
  const incidentEvents = ok(await fixture.repository.listEvents(
    fixture.campaignId,
    null,
    300
  )).filter(event =>
    event.eventType === "bastion_incident_handled"
    || event.eventType === "bastion_defense_handoff_started"
  );
  assert.equal(incidentEvents.length, 3);
  assert.equal(
    JSON.stringify(incidentEvents).includes("privateAttackerPlan"),
    false
  );
  assert.equal(
    incidentEvents.some(event => event.eventType === "tactical_encounter_resolved"),
    false
  );
  const restoredWithIncidents = ok(await controller.restoreRenderedThread());
  assert.equal(restoredWithIncidents.displayPackets.length, 7);
  assert.equal(
    restoredWithIncidents.displayPackets.filter(packet =>
      packet.operationId
        === `bastion-incident:${routedDefense.routing.command!.clientRequestId}`
    ).length,
    1
  );

  const failureControl: FailureControl = {
    enabled: false,
    point: "AFTER_EVENTS"
  };
  const rollbackFixture = await setup(failureControl);
  const rollbackCampaignBefore = ok(await rollbackFixture.repository.getCampaign(
    rollbackFixture.campaignId
  ));
  failureControl.enabled = true;
  const failed = await establishBastionV1({
    repository: rollbackFixture.repository,
    campaignId: rollbackFixture.campaignId,
    command: command(rollbackFixture, "req-bastion-rollback"),
    acquisitionPolicy: eligiblePolicy,
    placeResolver
  });
  assert.equal(failed.ok, false);
  failureControl.enabled = false;
  assert.equal(
    ok(await rollbackFixture.repository.getCampaign(rollbackFixture.campaignId))
      .campaignRevision,
    rollbackCampaignBefore.campaignRevision
  );
  assert.equal(
    ok(await loadBastionRegistryV1(
      rollbackFixture.repository,
      rollbackFixture.campaignId
    )).state.bastions.length,
    0
  );

  console.log(
    "bastion establishment + work + occupants + incidents + tactical defense handoff: OK"
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
