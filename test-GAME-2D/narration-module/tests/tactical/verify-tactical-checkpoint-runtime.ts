import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type WriterId
} from "../../src/core";
import {
  HANDOFF_CONTRACT_VERSION,
  type ProcessHandoffV1,
  type TacticalOutcomeV1
} from "../../src/handoff";
import {
  TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1,
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  bastionRegistryAggregateIdV1,
  createBastionTacticalConsequenceAuthorityV1,
  createCharacterTacticalConsequenceAuthorityV1,
  integratePendingTacticalOutcomeV1,
  projectAndRecordTacticalOutcomeIntegrationV1,
  restoreTacticalCheckpointV1,
  saveTacticalCheckpointV1,
  recordPendingTacticalOutcomeV1,
  restorePendingTacticalOutcomeV1
} from "../../src/application";
import { bastionTacticalHandoffAggregateIdV1 } from "../../src/application";

const campaignId = opaqueId<CampaignId>("cmp_tactical_checkpoint_7c_a");
const processId = "process_tactical_checkpoint_7c_a";
const now = "2026-07-30T08:00:00.000Z";

async function main() {
  const repository = new MemoryCampaignRepository();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("agg_clock_tactical_checkpoint"),
    dependencies: {
      contentPackageId: "content.test",
      contentPackageVersion: 1,
      rulesetId: "rules.test",
      rulesetVersion: 1,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const clock: CampaignClockPayload = {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  };
  const created = await repository.createCampaign(campaign, clock);
  assert.equal(
    created.ok,
    true,
    created.ok ? undefined : `${created.error.code}:${created.error.messageKey}`
  );
  await commitActiveProcess(repository, campaign);

  const firstState = ownerState("round-1:player:player", 1, 10);
  const first = await saveTacticalCheckpointV1({
    repository,
    campaignId,
    processId,
    clientRequestId: "request:checkpoint:round-1",
    lastAppliedTurnId: "round-1:player:player",
    ownerState: firstState,
    technicalTimestamp: now
  });
  assert.equal(
    first.ok,
    true,
    first.ok ? undefined : `${first.error.code}:${first.error.messageKey}`
  );
  if (!first.ok) return;
  assert.notEqual(first.value.stateFingerprint, "");

  const restoredFirst = await restoreTacticalCheckpointV1({
    repository,
    campaignId,
    processId
  });
  assert.equal(restoredFirst.ok, true);
  if (!restoredFirst.ok) return;
  assert.equal(
    restoredFirst.value?.lastAppliedEventOrTurnId,
    "round-1:player:player"
  );
  assert.equal(restoredFirst.value?.ownerState.playerHp, 10);

  const replay = await saveTacticalCheckpointV1({
    repository,
    campaignId,
    processId,
    clientRequestId: "request:checkpoint:round-1",
    lastAppliedTurnId: "round-1:player:player",
    ownerState: firstState,
    technicalTimestamp: now
  });
  assert.equal(replay.ok, true, "same checkpoint must replay idempotently");

  const second = await saveTacticalCheckpointV1({
    repository,
    campaignId,
    processId,
    clientRequestId: "request:checkpoint:round-1-enemy",
    lastAppliedTurnId: "round-1:enemy-1:enemies",
    ownerState: ownerState("round-1:enemy-1:enemies", 1, 7),
    technicalTimestamp: "2026-07-30T08:00:01.000Z"
  });
  assert.equal(second.ok, true);
  const restoredSecond = await restoreTacticalCheckpointV1({
    repository,
    campaignId,
    processId
  });
  assert.equal(restoredSecond.ok, true);
  if (!restoredSecond.ok) return;
  assert.equal(
    restoredSecond.value?.lastAppliedEventOrTurnId,
    "round-1:enemy-1:enemies"
  );
  assert.equal(restoredSecond.value?.ownerState.playerHp, 7);

  const outcome = tacticalOutcome(
    second.ok ? second.value.checkpointId : "missing"
  );
  const pending = await recordPendingTacticalOutcomeV1({
    repository,
    campaignId,
    clientRequestId: "request:tactical-outcome",
    outcome,
    technicalTimestamp: "2026-07-30T08:00:02.000Z"
  });
  assert.equal(
    pending.ok,
    true,
    pending.ok ? undefined : `${pending.error.code}:${pending.error.messageKey}`
  );
  const restoredOutcome = await restorePendingTacticalOutcomeV1({
    repository,
    campaignId,
    processId
  });
  assert.equal(restoredOutcome.ok, true);
  if (!restoredOutcome.ok) return;
  assert.equal(restoredOutcome.value?.outcomeId, outcome.outcomeId);
  const processAggregate = await repository.getAggregate(
    campaignId,
    "process.handoff",
    bastionTacticalHandoffAggregateIdV1(processId)
  );
  assert.equal(processAggregate.ok, true);
  if (!processAggregate.ok) return;
  assert.equal(
    (processAggregate.value.payload as ProcessHandoffV1).status,
    "COMPLETED_PENDING_INTEGRATION"
  );
  const replayedOutcome = await recordPendingTacticalOutcomeV1({
    repository,
    campaignId,
    clientRequestId: "request:tactical-outcome",
    outcome,
    technicalTimestamp: "2026-07-30T08:00:02.000Z"
  });
  assert.equal(replayedOutcome.ok, true);

  const missingAuthority = await integratePendingTacticalOutcomeV1({
    repository,
    campaignId,
    processId,
    clientRequestId: "request:tactical-integration-missing-authority",
    technicalTimestamp: "2026-07-30T08:00:03.000Z",
    authorities: []
  });
  assert.equal(missingAuthority.ok, false);
  if (!missingAuthority.ok) {
    assert.equal(
      missingAuthority.error.messageKey,
      "tactical.integration.authority-missing"
    );
  }
  const characterAuthority = createCharacterTacticalConsequenceAuthorityV1();
  const unsupportedResource = await characterAuthority.validate({
    repository,
    campaignId,
    process: processAggregate.value.payload as ProcessHandoffV1,
    outcome,
    candidate: {
      ...(outcome.consequenceCandidates[0] ?? {}),
      resourcesAfter: { rage: 0 }
    },
    integratedAtGameSecond: 12
  });
  assert.equal(unsupportedResource.ok, false);
  if (!unsupportedResource.ok) {
    assert.equal(
      unsupportedResource.error.messageKey,
      "tactical.character-resources.unsupported"
    );
  }
  const integrated = await integratePendingTacticalOutcomeV1({
    repository,
    campaignId,
    processId,
    clientRequestId: "request:tactical-integration",
    technicalTimestamp: "2026-07-30T08:00:03.000Z",
    authorities: [
      characterAuthority,
      createBastionTacticalConsequenceAuthorityV1({
        policyRef: "fixture:bastion-defense-resolution",
        resolve(input) {
          assert.equal(input.endCondition, "all_hostiles_neutralized");
          return {
            ok: true,
            value: {
              schemaVersion: 1,
              resolutionCode: "BASTION_DEFENDED",
              bastionStatus: "ACTIVE",
              publicNarrative:
                "Les assaillants refluent ; le bastion tient encore debout."
            }
          };
        }
      })
    ]
  });
  assert.equal(
    integrated.ok,
    true,
    integrated.ok
      ? undefined
      : `${integrated.error.code}:${integrated.error.messageKey}`
  );
  if (!integrated.ok) return;
  assert.equal(integrated.value.integratedAtGameSecond, 12);
  assert.equal(integrated.value.appliedDeltaIds.length, 3);
  const storedClock = await repository.getAggregate(
    campaignId,
    "world.clock",
    campaign.clockAggregateId
  );
  assert.equal(storedClock.ok, true);
  if (!storedClock.ok) return;
  assert.equal(storedClock.value.payload.elapsedGameSeconds, 12);
  const character = await repository.getAggregate(
    campaignId,
    "character.state",
    opaqueId<AggregateId>("agg_character_test")
  );
  assert.equal(character.ok, true);
  if (!character.ok) return;
  assert.equal(character.value.payload.currentHitPoints, 7);
  const integratedProcess = await repository.getAggregate(
    campaignId,
    "process.handoff",
    bastionTacticalHandoffAggregateIdV1(processId)
  );
  assert.equal(integratedProcess.ok, true);
  if (!integratedProcess.ok) return;
  assert.equal(
    (integratedProcess.value.payload as ProcessHandoffV1).status,
    "INTEGRATED"
  );
  const bastion = await repository.getAggregate(
    campaignId,
    BASTION_REGISTRY_AGGREGATE_TYPE_V1,
    bastionRegistryAggregateIdV1(campaignId)
  );
  assert.equal(bastion.ok, true);
  if (!bastion.ok) return;
  assert.equal(
    (bastion.value.payload.bastions as Array<{
      incidents: Array<{ status: string }>;
    }>)[0].incidents[0].status,
    "APPLIED"
  );
  const storedOutcome = await restorePendingTacticalOutcomeV1({
    repository,
    campaignId,
    processId
  });
  assert.equal(storedOutcome.ok, true);
  if (!storedOutcome.ok) return;
  assert.equal(storedOutcome.value?.domainDeltas.length, 3);
  const integrationEvents = await repository.listEvents(
    campaignId,
    null,
    100
  );
  assert.equal(integrationEvents.ok, true);
  if (!integrationEvents.ok) return;
  assert.equal(
    integrationEvents.value.some(
      event => event.eventType === "bastion_defense_resolved"
    ),
    true,
    integrationEvents.value.map(event => event.eventType).join(",")
  );
  const projection = await projectAndRecordTacticalOutcomeIntegrationV1({
    repository,
    campaignId,
    clock: { now: () => new Date("2026-07-30T08:00:04.000Z") },
    idPrefix: "test-7c-c",
    processId,
    sceneId: "scene:test"
  });
  assert.equal(
    projection.ok,
    true,
    projection.ok
      ? undefined
      : `${projection.error.code}:${projection.error.messageKey}`
  );
  if (!projection.ok) return;
  assert.equal(
    projection.value.displayPacket.displayBlocks[0]?.text,
    "Les assaillants refluent ; le bastion tient encore debout."
  );
  const replayedIntegration = await integratePendingTacticalOutcomeV1({
    repository,
    campaignId,
    processId,
    clientRequestId: "request:tactical-integration",
    technicalTimestamp: "2026-07-30T08:00:03.000Z",
    authorities: [
      createCharacterTacticalConsequenceAuthorityV1(),
      createBastionTacticalConsequenceAuthorityV1({
        policyRef: "fixture:bastion-defense-resolution",
        resolve() {
          throw new Error("integration replay must not invoke authorities");
        }
      })
    ]
  });
  assert.equal(replayedIntegration.ok, true);
  if (!replayedIntegration.ok) return;
  assert.equal(replayedIntegration.value.replayed, true);

  console.log("tactical checkpoint and outcome integration runtime 7C-A/B/C: OK");
}

function tacticalOutcome(checkpointId: string): TacticalOutcomeV1 {
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processKind: "TACTICAL_ENCOUNTER",
    outcomeId: `outcome:${processId}`,
    processId,
    campaignId,
    sourceOperationId: opaqueId<OperationId>(
      "operation:tactical-process-start"
    ),
    status: "COMPLETED",
    elapsedGameSeconds: 12,
    domainDeltas: [],
    eventDrafts: [{
      eventType: "tactical_outcome_recorded_pending_integration",
      origin: "PROCESS",
      visibility: "PLAYER_VISIBLE",
      occurredAtGameSecond: 12,
      payloadSchemaVersion: 1,
      payload: {
        processId,
        endCondition: "all_hostiles_neutralized"
      }
    }],
    narrativeProjection: {
      messageKey: "tactical.outcome-pending-integration"
    },
    uiNotifications: [],
    memoryCandidates: [],
    sourceRefs: [{ kind: "process.handoff", id: processId }],
    finalStateFingerprint: "fixture:terminal-state",
    integrationIdempotencyKey: `integrate:${processId}`,
    version: 1,
    turnJournal: [{ turn: 1, actorId: "character:test" }],
    finalParticipantStates: [{
      actorId: "character:test",
      hp: 7,
      maxHp: 10
    }],
    casualtiesAndConditions: [],
    resourceChanges: [{
      actorId: "character:test",
      resourceKind: "hit-points",
      before: 10,
      after: 7,
      delta: -3
    }],
    finalPositions: [{ actorId: "character:test", x: 2, y: 2 }],
    endCondition: "all_hostiles_neutralized",
    placeDamage: [],
    engagedSpeechAndKnowledge: [],
    availableLoot: [],
    consequenceCandidates: [{
      candidateId: "candidate:character:test",
      ownerDomain: "character",
      actorId: "character:test",
      characterId: "character:test",
      characterAggregateId: "agg_character_test",
      tacticalProjectionAggregateId: "agg_character_tactical_test",
      hpBefore: 10,
      hpAfter: 7,
      resourcesAfter: {}
    }, {
      candidateId: "candidate:bastion:test",
      ownerDomain: "bastion",
      bastionId: "bastion:test",
      incidentId: "incident:test",
      incidentDefinitionRef: "incident-definition:test",
      processId,
      endCondition: "all_hostiles_neutralized"
    }],
    checkpointRefs: [{ kind: "process.checkpoint", id: checkpointId }]
  };
}

function ownerState(
  turnBoundaryId: string,
  round: number,
  playerHp: number
) {
  return {
    schemaVersion: 1,
    contractVersion: TACTICAL_CHECKPOINT_OWNER_CONTRACT_V1,
    processId,
    seedId: "seed:tactical-checkpoint-7c-a",
    seedFingerprint: "fixture:tactical-checkpoint-7c-a",
    turnBoundaryId,
    round,
    phase: turnBoundaryId.endsWith("enemies") ? "enemies" : "player",
    playerHp
  };
}

async function commitActiveProcess(
  repository: MemoryCampaignRepository,
  campaign: CampaignRecord
) {
  const operationId = opaqueId<OperationId>("operation:tactical-process-start");
  const payload = { processId };
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("request:tactical-process-start"),
    idempotencyKey: opaqueId<IdempotencyKey>("idem:tactical-process-start"),
    requestFingerprint: await computeRequestFingerprint(
      "tactical.process-start",
      1,
      payload
    ),
    operationKind: "tactical.process-start",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  assert.equal((await repository.receiveOperation(operation)).ok, true);
  assert.equal((
    await repository.transitionOperation(operationId, "RECEIVED", "PREPARING")
  ).ok, true);
  assert.equal((
    await repository.transitionOperation(
      operationId,
      "PREPARING",
      "READY_TO_COMMIT"
    )
  ).ok, true);
  const lease = await repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>("writer:tactical-process-start"),
    30_000
  );
  assert.equal(lease.ok, true);
  if (!lease.ok) return;
  const process: ProcessHandoffV1 = {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId,
    campaignId,
    sourceOperationId: operationId,
    sourceSceneId: "scene:test",
    processKind: "TACTICAL_ENCOUNTER",
    status: "ACTIVE",
    createdAtGameSecond: 0,
    sourceRefs: [{ kind: "bastion", id: "bastion:test" }],
    idempotencyKey: "tactical-process-start",
    version: 1,
    integratedOutcomeId: null,
    updatedAtGameSecond: null
  };
  const commit = await repository.commit({
    campaignId,
    operationId,
    commitId: opaqueId<CommitId>("commit:tactical-process-start"),
    idempotencyKey: operation.idempotencyKey,
    requestFingerprint: operation.requestFingerprint,
    expectedCampaignRevision: 0,
    writerLease: lease.value,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "tactical-rest-handoff",
      contractVersion: 1,
      commandId: opaqueId<CommandId>("command:tactical-process-start"),
      campaignId,
      operationId,
      commandType: "tactical.start",
      target: {
        aggregateType: "process.handoff",
        aggregateId: bastionTacticalHandoffAggregateIdV1(processId),
        expectedAggregateRevision: null
      },
      payloadSchemaVersion: 1,
      payload,
      acceptedAtGameSecond: 0
    }],
    aggregateWrites: [{
      aggregateType: "process.handoff",
      aggregateId: bastionTacticalHandoffAggregateIdV1(processId),
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: process
    }, {
      aggregateType: "character.state",
      aggregateId: opaqueId<AggregateId>("agg_character_test"),
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        characterId: "character:test",
        currentHitPoints: 10
      }
    }, {
      aggregateType: "character.tactical-projection",
      aggregateId: opaqueId<AggregateId>("agg_character_tactical_test"),
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        characterId: "character:test",
        currentHitPoints: 10,
        maximumHitPoints: 10
      }
    }, {
      aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: bastionRegistryAggregateIdV1(campaignId),
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        contractVersion: "bastion-registry/1",
        campaignId,
        bastions: [{
          schemaVersion: 1,
          bastionId: "bastion:test",
          status: "ACTIVE",
          installations: [],
          workOrders: [],
          occupantAssignments: [],
          occupantActivities: [],
          incidents: [{
            schemaVersion: 1,
            incidentId: "incident:test",
            incidentDefinitionRef: "incident-definition:test",
            incidentDisplayName: "Assaut de test",
            kind: "TACTICAL_DEFENSE",
            status: "HANDOFF_ACTIVE",
            sourceOperationId: operationId,
            sourceEventId: "event:tactical-process-start",
            policyRef: "fixture:incident-policy",
            catalogRef: "fixture:incident-catalog",
            affectedInstallationId: null,
            tacticalProcessId: processId,
            occurredAtGameSecond: 0,
            publicNarrative: "Le bastion est attaqué.",
            version: 1
          }],
          version: 1
        }],
        version: 1
      }
    }],
    events: [{
      schemaVersion: 1,
      eventId: opaqueId<EventId>("event:tactical-process-start"),
      campaignId,
      operationId,
      eventType: "tactical_process_started",
      origin: "PROCESS",
      causation: {
        kind: "COMMAND",
        id: "command:tactical-process-start"
      },
      aggregateRefs: [{
        aggregateType: "process.handoff",
        aggregateId: bastionTacticalHandoffAggregateIdV1(processId),
        aggregateRevision: 0
      }],
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: 0,
      payloadSchemaVersion: 1,
      payload
    }],
    outboxTasks: []
  });
  assert.equal(
    commit.ok,
    true,
    commit.ok ? undefined : `${commit.error.code}:${commit.error.messageKey}`
  );
  if (commit.ok) {
    assert.equal((
      await repository.completePresentation(
        operationId,
        "COMMITTED_RENDERED",
        1,
        { processId }
      )
    ).ok, true);
  }
  assert.equal((await repository.releaseWriterLease(lease.value)).ok, true);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
