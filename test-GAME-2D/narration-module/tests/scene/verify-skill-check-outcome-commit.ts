import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type CommandId,
  type CommitId,
  type CommitRequest,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type WriterId
} from "../../src/core";
import {
  augmentTemporalCommitWithSkillCheckOutcomeV1,
  type PreparedSkillCheckOutcomeV1,
  type SkillCheckOwnerResultV1
} from "../../src/application";

async function run(): Promise<void> {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>("campaign:skill-outcome-commit");
  const clockAggregateId = opaqueId<AggregateId>("campaign:skill-outcome-commit:clock");
  const now = "2026-07-27T12:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "content.jdr5e",
      contentPackageVersion: 1,
      rulesetId: "rules.jdr5e",
      rulesetVersion: 2,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  });
  assert.equal(created.ok, true);

  const operationId = opaqueId<OperationId>("operation:skill-outcome-commit");
  const idempotencyKey = opaqueId<IdempotencyKey>("idempotency:skill-outcome-commit");
  const requestPayload = { checkId: "check:wet-wall", rollId: "roll:failure" };
  const requestFingerprint = await computeRequestFingerprint("rules.skill-check.commit-outcome", 1, requestPayload);
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("request:skill-outcome-commit"),
    idempotencyKey,
    requestFingerprint,
    operationKind: "rules.skill-check.commit-outcome",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "READY_TO_COMMIT",
    observedCampaignRevision: 0,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  const received = await repository.receiveOperation({ ...operation, phase: "RECEIVED" });
  assert.equal(received.ok, true);
  const preparing = await repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  assert.equal(preparing.ok, true);
  const ready = await repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
  assert.equal(ready.ok, true);

  const lease = await repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>("writer:skill-outcome-commit"),
    120_000
  );
  assert.equal(lease.ok, true);
  if (!lease.ok) throw new Error("writer lease unavailable");

  const ownerCommandId = opaqueId<CommandId>("command:apply-skill-outcome");
  const prepared: PreparedSkillCheckOutcomeV1 = {
    schemaVersion: 1,
    contractVersion: "skill-check-outcome-preparation/1",
    preparationId: "preparation:wet-wall",
    checkId: "check:wet-wall",
    rollId: "roll:failure",
    outcome: "FAILURE",
    consequence: {
      status: "PREPARED_NOT_COMMITTED",
      ownerDomain: "exploration",
      effectType: "position.unchanged",
      effectPayload: { positionRef: "scene:wet-wall:ground" },
      retryDisposition: "RETRY_ALLOWED_WITH_ADDITIONAL_TIME",
      publicSourceRefs: ["scene:wet-wall"],
      privateSourceRefs: ["scene:wet-wall:hidden-fragility"],
      ruleRefs: ["rule.exploration.climb-duration@1"]
    },
    timeAdvanceProposal: {
      schemaVersion: 1,
      proposalId: "roll:failure:time",
      campaignId,
      requesterDomain: "exploration",
      category: "FIXED_RULE",
      observedAtGameSecond: 0,
      duration: { recommendedSeconds: 18, minimumSeconds: 18, maximumSeconds: 18 },
      source: { kind: "RULE", id: "rule.exploration.climb-duration@1", version: 1 },
      cause: { kind: "EVENT", id: "event:dice-roll" },
      processId: null,
      interruptible: false,
      dependencies: []
    },
    narrativeResume: {
      publicSummary: "La prise cède et vous restez au sol.",
      durationSeconds: 18,
      outcome: "FAILURE",
      allowedSourceRefs: ["scene:wet-wall"],
      forbiddenChanges: ["OUTCOME", "DURATION", "EFFECT", "RETRY_DISPOSITION"],
      commitAuthority: false
    },
    commitAuthority: false
  };
  const ownerResult: SkillCheckOwnerResultV1 = {
    schemaVersion: 1,
    contractVersion: "skill-check-outcome-commit/1",
    commandId: ownerCommandId,
    checkId: prepared.checkId,
    rollId: prepared.rollId,
    ownerDomain: "exploration",
    effectType: "position.unchanged",
    target: {
      aggregateType: "exploration.position",
      aggregateId: "position:player",
      expectedAggregateRevision: null
    },
    nextPayload: {
      schemaVersion: 1,
      characterId: "character:test",
      positionRef: "scene:wet-wall:ground",
      lastCheckId: prepared.checkId
    },
    additionalTargets: [],
    publicSourceRefs: ["scene:wet-wall"],
    ownerAuthority: true
  };
  const temporalCommit: CommitRequest = {
    campaignId,
    operationId,
    commitId: opaqueId<CommitId>("commit:skill-outcome"),
    idempotencyKey,
    requestFingerprint,
    expectedCampaignRevision: 0,
    writerLease: lease.value,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "temporal-kernel",
      contractVersion: 1,
      commandId: opaqueId<CommandId>("command:time-skill-outcome"),
      campaignId,
      operationId,
      commandType: "time.resolve-segment",
      target: { aggregateType: "world.clock", aggregateId: clockAggregateId, expectedAggregateRevision: 0 },
      payloadSchemaVersion: 1,
      payload: {
        batchFingerprint: "sha256:test",
        taskIds: ["task:skill-outcome"],
        operationBindingMode: "COMPOSITE_DOMAIN_COMMIT",
        domainCommandId: ownerCommandId
      },
      acceptedAtGameSecond: 0
    }],
    aggregateWrites: [{
      aggregateType: "world.clock",
      aggregateId: clockAggregateId,
      expectedAggregateRevision: 0,
      payloadSchemaVersion: 1,
      payload: {
        elapsedGameSeconds: 18,
        calendarId: "calendar.test",
        calendarVersion: 1
      }
    }],
    events: [{
      schemaVersion: 1,
      eventId: opaqueId<EventId>("event:skill-outcome-time"),
      campaignId,
      operationId,
      eventType: "time.activity.resolved",
      origin: "PLAYER_INTENT",
      causation: { kind: "COMMAND", id: "command:time-skill-outcome" },
      aggregateRefs: [{ aggregateType: "world.clock", aggregateId: clockAggregateId, aggregateRevision: 1 }],
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: 18,
      payloadSchemaVersion: 1,
      payload: { durationSeconds: 18 }
    }],
    outboxTasks: []
  };

  const atomic = augmentTemporalCommitWithSkillCheckOutcomeV1({
    temporalCommit,
    prepared,
    ownerResult,
    currentTargetAggregate: null
  });
  assert.equal(atomic.ok, true);
  if (!atomic.ok) throw new Error("atomic preparation failed");
  assert.equal(atomic.value.aggregateWrites.length, 2);
  assert.equal(atomic.value.acceptedCommands.length, 2);
  assert.equal(JSON.stringify(atomic.value.events).includes("hidden-fragility"), false);

  const committed = await repository.commit(atomic.value);
  if (!committed.ok) {
    throw new Error(`${committed.error.code}: ${committed.error.messageKey} ${JSON.stringify(committed.error.details)}`);
  }
  const replayed = await repository.commit(atomic.value);
  if (!replayed.ok) {
    throw new Error(`${replayed.error.code}: ${replayed.error.messageKey} ${JSON.stringify(replayed.error.details)}`);
  }
  assert.equal(replayed.value.commitId, committed.value.commitId);

  const storedClock = await repository.getAggregate(campaignId, "world.clock", clockAggregateId);
  assert.equal(storedClock.ok, true);
  if (storedClock.ok) assert.equal(storedClock.value.payload.elapsedGameSeconds, 18);
  const storedPosition = await repository.getAggregate(
    campaignId,
    ownerResult.target.aggregateType,
    opaqueId<AggregateId>(ownerResult.target.aggregateId)
  );
  assert.equal(storedPosition.ok, true);
  if (storedPosition.ok) assert.equal(storedPosition.value.payload.lastCheckId, prepared.checkId);
  const events = await repository.listEvents(campaignId, null, 20);
  assert.equal(events.ok, true);
  if (events.ok) {
    assert.equal(events.value.filter(event => event.eventType === "rules.skill-check.outcome-committed").length, 1);
  }
  await repository.releaseWriterLease(lease.value);

  const alteredDuration = {
    ...prepared,
    narrativeResume: { ...prepared.narrativeResume, durationSeconds: 19 }
  };
  const rejected = augmentTemporalCommitWithSkillCheckOutcomeV1({
    temporalCommit,
    prepared: alteredDuration,
    ownerResult,
    currentTargetAggregate: null
  });
  assert.equal(rejected.ok, false);

  console.log("skill-check-outcome-commit/1: consequence and clock commit atomically with stable replay");
}

void run();
