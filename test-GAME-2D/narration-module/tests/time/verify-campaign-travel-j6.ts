import { strict as assert } from "node:assert";
import {
  campaignTravelProcessAggregateIdV1,
  prepareCampaignTravelSegmentV1,
  prepareCampaignTravelStartCommitV1
} from "../../src/application";
import {
  computeJsonFingerprint,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type RequestId,
  type WriterId
} from "../../src/core";
import { createTravelProcessStatePayloadV1, type TravelProcessStateV1 } from "../../src/time";

async function run(): Promise<void> {
  const boundedAggregateId = campaignTravelProcessAggregateIdV1(
    `TRAVEL-PROCESS:${"A".repeat(180)}`
  );
  assert.equal(boundedAggregateId.length, 128);
  assert.match(boundedAggregateId, /^[a-z][a-z0-9._:-]{2,127}$/);

  const campaignId = opaqueId<CampaignId>("campaign-j6-runtime");
  const party = {
    schemaVersion: 1 as const,
    partyId: "party:j6:runtime",
    partyRevision: 2,
    leaderActorId: "actor:player",
    memberActorIds: ["actor:player", "actor:travel-ally"],
    sourceRefs: ["party-owner:party:j6:runtime:2"]
  };
  const process: TravelProcessStateV1 = {
    schemaVersion: 1,
    processId: "travel-process:j6-runtime",
    campaignId,
    status: "PLANNED",
    plan: {
      schemaVersion: 1,
      planId: "travel-plan:j6-runtime",
      campaignId,
      characterId: "actor:player",
      originLocationId: "porte_nord",
      destinationLocationId: "hameau_du_torrent_froid",
      mode: "WALK",
      route: [{
        stepId: "travel-step:j6-runtime",
        fromLocationId: "porte_nord",
        toLocationId: "hameau_du_torrent_froid",
        distanceUnits: 4,
        estimatedSeconds: 3_600,
        dangerLevel: 0,
        environmentTags: ["route_surveillee"],
        resourceRates: [{
          schemaVersion: 1,
          itemId: "item:ration",
          unitsPerPersonPerDay: 24,
          sourceRefs: ["rules:travel-rations"]
        }]
      }],
      totalEstimatedSeconds: 3_600,
      createdAtGameSecond: 0,
      source: { kind: "PLAYER_INTENT", id: "intent:j6-runtime", version: 1 },
      party
    },
    checkpoint: {
      schemaVersion: 1,
      checkpointId: "travel-checkpoint:j6-runtime:0",
      processId: "travel-process:j6-runtime",
      checkpointRevision: 0,
      status: "PLANNED",
      currentLocationId: "porte_nord",
      nextLocationId: "hameau_du_torrent_froid",
      elapsedTravelSeconds: 0,
      remainingTravelSeconds: 3_600,
      completedStepIds: [],
      activeSegment: null,
      lastEncounterDecision: null
    }
  };
  const operationId = opaqueId<OperationId>("operation:j6:travel-segment:1");
  const task = {
    schemaVersion: 1 as const,
    taskId: `${operationId}:travel-boundary`,
    taskKind: "PROCESS_BOUNDARY" as const,
    dueAtGameSecond: 1_800,
    boundaryPolicy: "SIMULTANEOUS" as const,
    dependsOnTaskIds: [],
    payload: { processId: process.processId, segmentId: `travel.segment.${process.processId}.1` }
  };
  const batchBase = {
    schemaVersion: 1 as const,
    batchId: `${operationId}:travel-batch`,
    currentGameSecond: 0,
    requestedTargetGameSecond: 1_800,
    effectiveAtGameSecond: 1_800,
    orderedTasks: [task]
  };
  const batchFingerprint = await computeJsonFingerprint(batchBase);
  const campaign = {
    schemaVersion: 1 as const,
    campaignId,
    campaignRevision: 5,
    status: "ACTIVE" as const,
    clockAggregateId: opaqueId<AggregateId>("agg-clock-j6"),
    dependencies: { contentPackageId: "content", contentPackageVersion: 1, rulesetId: "rules", rulesetVersion: 1, calendarId: "calendar", calendarVersion: 1 },
    writeBlock: null,
    lastCommitId: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z"
  };
  const requestPayload = { batchFingerprint };
  const operation = {
    schemaVersion: 1 as const,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("request:j6:travel-segment:1"),
    idempotencyKey: opaqueId<IdempotencyKey>("idempotency:j6:travel-segment:1"),
    requestFingerprint: await computeRequestFingerprint("time.segment", 1, requestPayload),
    operationKind: "time.segment",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "READY_TO_COMMIT" as const,
    observedCampaignRevision: 5,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z"
  };
  const initialProcess = await createTravelProcessStatePayloadV1({ process, pendingDecision: null, lastAppliedEventId: null, expectedCampaignRevision: 5 });
  if (!initialProcess.ok) throw new Error("initial travel process fixture invalid");
  const aggregate = (aggregateType: string, aggregateId: string, payload: unknown) => ({
    schemaVersion: 1 as const,
    campaignId,
    aggregateType,
    aggregateId: opaqueId<AggregateId>(aggregateId),
    aggregateRevision: 1,
    payloadSchemaVersion: 1,
    payload: payload as never,
    updatedByCommitId: null
  });
  const clock = aggregate("world.clock", campaign.clockAggregateId, { elapsedGameSeconds: 0, calendarId: "calendar", calendarVersion: 1 });
  const schedule = aggregate("world.schedule", "agg-schedule-j6", { schemaVersion: 1, effects: [] });
  const cursor = aggregate("world.simulation-cursor", "agg-cursor-j6", { schemaVersion: 1, worldSimulatedThrough: 0, tick: 0, microTick: 0, macroTick: 0, secondsPerMicroTick: 3_600, microPerMacro: 6 });
  const processAggregate = aggregate("process.state", "agg-process-j6", initialProcess.value);
  const position = aggregate("world.position", "agg-position-j6", { characterId: "actor:player", locationId: "porte_nord", nextLocationId: null, elapsedTravelSeconds: 0, travelProcessId: process.processId });
  const supplies = aggregate("character.state", "agg-character-j6", { actorId: "actor:player", inventory: [{ itemId: "item:ration", quantity: 4 }] });
  const startPayload = { processId: process.processId, destinationLocationId: process.plan.destinationLocationId };
  const startOperation = {
    ...operation,
    operationId: opaqueId<OperationId>("operation:j6:travel-start"),
    clientRequestId: opaqueId<RequestId>("request:j6:travel-start"),
    idempotencyKey: opaqueId<IdempotencyKey>("idempotency:j6:travel-start"),
    requestFingerprint: await computeRequestFingerprint("travel.start", 1, startPayload),
    operationKind: "travel.start",
    requestPayload: startPayload
  };
  const started = await prepareCampaignTravelStartCommitV1({
    campaign,
    operation: startOperation,
    writerLease: { campaignId, writerId: opaqueId<WriterId>("writer:j6:start"), fencingToken: 1, acquiredAt: "2026-08-20T00:00:00.000Z", expiresAt: "2026-08-20T01:00:00.000Z" },
    processAggregateId: processAggregate.aggregateId,
    positionAggregate: position,
    process,
    eventId: opaqueId<EventId>("event:j6:travel-start"),
    commitId: opaqueId<CommitId>("commit:j6:travel-start"),
    commandId: opaqueId<CommandId>("command:j6:travel-start")
  });
  assert.equal(started.ok, true);
  if (started.ok) {
    assert.equal(started.value.aggregateWrites[0]?.aggregateType, "process.state");
    assert.equal(started.value.events[0]?.eventType, "travel.started");
  }
  const prepared = await prepareCampaignTravelSegmentV1({
    campaign,
    operation,
    writerLease: { campaignId, writerId: opaqueId<WriterId>("writer:j6"), fencingToken: 1, acquiredAt: "2026-08-20T00:00:00.000Z", expiresAt: "2026-08-20T01:00:00.000Z" },
    clockAggregate: clock,
    scheduleAggregate: schedule,
    scheduleAggregateId: schedule.aggregateId,
    simulationCursorAggregate: cursor,
    simulationCursorAggregateId: cursor.aggregateId,
    processAggregate,
    processAggregateId: processAggregate.aggregateId,
    positionAggregate: position,
    travel: {
      process,
      secondsPerWorldBoundary: 3_600,
      maxSegmentSeconds: 1_800,
      contentPackageId: "content",
      contentPackageVersion: 1,
      rulesetId: "rules",
      rulesetVersion: 1,
      encounterCandidates: [],
      worldPressure: 0,
      partySnapshot: party,
      availableResources: [{ itemId: "item:ration", quantity: 4 }]
    },
    resourceReservation: {
      schemaVersion: 1,
      contractVersion: "travel-resource-reservation/1",
      consumption: [{ itemId: "item:ration", quantity: 1 }],
      inventoryWrite: { aggregateType: supplies.aggregateType, aggregateId: supplies.aggregateId, expectedAggregateRevision: supplies.aggregateRevision, payloadSchemaVersion: 1, payload: { actorId: "actor:player", inventory: [{ itemId: "item:ration", quantity: 3 }] } },
      sourceRefs: ["character.state:agg-character-j6:1"]
    },
    eventId: opaqueId<EventId>("event:j6:travel-segment:1"),
    commitId: opaqueId<CommitId>("commit:j6:travel-segment:1"),
    commandId: opaqueId<CommandId>("command:j6:travel-segment:1")
  });
  if (!prepared.ok) throw new Error(prepared.diagnostics.map(value => value.details.issue).join(", "));
  assert.equal(prepared.value.segment.resourceConsumption[0]?.quantity, 1);
  assert.equal(prepared.value.segment.stopReason, "SEGMENT_LIMIT");
  assert.equal(prepared.value.commit.aggregateWrites.some(write => write.aggregateType === "world.clock"), true);
  assert.equal(prepared.value.commit.aggregateWrites.some(write => write.aggregateType === "process.state"), true);
  assert.equal(prepared.value.commit.aggregateWrites.some(write => write.aggregateType === "world.position"), true);
  assert.equal(prepared.value.commit.aggregateWrites.some(write => write.aggregateType === "character.state"), true);
  assert.equal(prepared.value.segment.pendingDecision, null);
  console.log("PASS [campaign-travel/J6] start is persistable; clock, checkpoint, position and inventory resources share one commit; party is owner-backed");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
