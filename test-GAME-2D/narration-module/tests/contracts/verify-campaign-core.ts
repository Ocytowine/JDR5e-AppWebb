import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type CommandId,
  type CommitFailurePoint,
  type CommitRequest,
  type EventDraft,
  type IdempotencyKey,
  type IncidentId,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type Result,
  type WorkerId,
  type WriterId
} from "../../src/core/index";

type AsyncTest = () => Promise<void>;
const tests: Array<{ name: string; run: AsyncTest }> = [];

function test(name: string, run: AsyncTest): void {
  tests.push({ name, run });
}

class MutableClock implements RepositoryClock {
  constructor(private epochMs = Date.parse("2026-07-02T12:00:00.000Z")) {}

  now(): Date {
    return new Date(this.epochMs);
  }

  advance(ms: number): void {
    this.epochMs += ms;
  }
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`Expected success, got ${result.error.code}: ${result.error.messageKey}`);
  return result.value;
}

function expectError<T>(result: Result<T>, code: string): void {
  assert.equal(result.ok, false, "Expected an error result.");
  if (!result.ok) assert.equal(result.error.code, code);
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function campaignFixture(clock: MutableClock, suffix = "base"): CampaignRecord {
  const instant = clock.now().toISOString();
  return {
    schemaVersion: 1,
    campaignId: id<CampaignId>(`cmp_${suffix}`),
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: id<AggregateId>(`agg_clock_${suffix}`),
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
    createdAt: instant,
    updatedAt: instant
  };
}

const initialClock: CampaignClockPayload = {
  elapsedGameSeconds: 0,
  calendarId: "calendar.test",
  calendarVersion: 1
};

async function setup(options: {
  suffix?: string;
  failureInjector?: (point: CommitFailurePoint) => void;
} = {}) {
  const clock = new MutableClock();
  const repository = new MemoryCampaignRepository({
    clock,
    failureInjector: options.failureInjector
  });
  const campaign = campaignFixture(clock, options.suffix ?? "base");
  expectOk(await repository.createCampaign(campaign, initialClock));
  return { repository, clock, campaign };
}

async function operationFixture(
  campaign: CampaignRecord,
  clock: MutableClock,
  suffix: string,
  payload: JsonObject = { text: `request-${suffix}` }
): Promise<OperationRecord> {
  const operationKind = "narration.turn";
  const requestPayloadSchemaVersion = 1;
  const instant = clock.now().toISOString();
  return {
    schemaVersion: 1,
    operationId: id<OperationId>(`op_${suffix}`),
    campaignId: campaign.campaignId,
    clientRequestId: id(`req_${suffix}`),
    idempotencyKey: id<IdempotencyKey>(`idem_${suffix}`),
    requestFingerprint: await computeRequestFingerprint(operationKind, requestPayloadSchemaVersion, payload),
    operationKind,
    requestPayloadSchemaVersion,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: instant,
    updatedAt: instant
  };
}

async function readyOperation(
  repository: MemoryCampaignRepository,
  campaign: CampaignRecord,
  clock: MutableClock,
  suffix: string,
  payload?: JsonObject
): Promise<OperationRecord> {
  const operation = await operationFixture(campaign, clock, suffix, payload);
  expectOk(await repository.receiveOperation(operation));
  expectOk(await repository.transitionOperation(operation.operationId, "RECEIVED", "PREPARING"));
  return expectOk(await repository.transitionOperation(operation.operationId, "PREPARING", "READY_TO_COMMIT"));
}

async function lease(repository: MemoryCampaignRepository, campaignId: CampaignId, suffix: string) {
  return expectOk(await repository.acquireWriterLease(campaignId, id<WriterId>(`writer_${suffix}`), 120_000));
}

function commitRequest(input: {
  campaign: CampaignRecord;
  operation: OperationRecord;
  writerLease: Awaited<ReturnType<typeof lease>>;
  suffix: string;
  expectedCampaignRevision?: number;
  aggregateType?: string;
  aggregateId?: AggregateId;
  expectedAggregateRevision?: number | null;
  aggregatePayload?: JsonObject;
  eventCount?: number;
  withOutbox?: boolean;
}): CommitRequest {
  const aggregateType = input.aggregateType ?? "scene.state";
  const aggregateId = input.aggregateId ?? id<AggregateId>("agg_scene_main");
  const expectedAggregateRevision = input.expectedAggregateRevision ?? null;
  const resultingAggregateRevision = expectedAggregateRevision === null ? 0 : expectedAggregateRevision + 1;
  const commandId = id<CommandId>(`cmd_${input.suffix}`);
  const eventCount = input.eventCount ?? 1;
  const events: EventDraft[] = Array.from({ length: eventCount }, (_, index) => ({
    schemaVersion: 1,
    eventId: id(`evt_${input.suffix}_${index}`),
    campaignId: input.campaign.campaignId,
    operationId: input.operation.operationId,
    eventType: "scene.changed",
    origin: "PLAYER_INTENT",
    causation: { kind: "COMMAND", id: commandId },
    aggregateRefs: [{ aggregateType, aggregateId, aggregateRevision: resultingAggregateRevision }],
    visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
    occurredAtGameSecond: Number(input.aggregatePayload?.elapsedGameSeconds ?? 0),
    payloadSchemaVersion: 1,
    payload: { index }
  }));

  return {
    campaignId: input.campaign.campaignId,
    operationId: input.operation.operationId,
    commitId: id(`cmt_${input.suffix}`),
    idempotencyKey: input.operation.idempotencyKey,
    requestFingerprint: input.operation.requestFingerprint,
    expectedCampaignRevision: input.expectedCampaignRevision ?? input.campaign.campaignRevision,
    writerLease: input.writerLease,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "scene.command",
      contractVersion: 1,
      commandId,
      campaignId: input.campaign.campaignId,
      operationId: input.operation.operationId,
      commandType: "scene.change",
      target: { aggregateType, aggregateId, expectedAggregateRevision },
      payloadSchemaVersion: 1,
      payload: { requested: true },
      acceptedAtGameSecond: 0
    }],
    aggregateWrites: [{
      aggregateType,
      aggregateId,
      expectedAggregateRevision,
      payloadSchemaVersion: 1,
      payload: input.aggregatePayload ?? { state: input.suffix }
    }],
    events,
    outboxTasks: input.withOutbox === false ? [] : [{
      schemaVersion: 1,
      taskId: id(`task_${input.suffix}`),
      taskType: "projection.refresh",
      sourceEventIds: [events[0].eventId],
      payloadSchemaVersion: 1,
      payload: { projection: "interaction-log" }
    }]
  };
}

test("01 bootstrap creates campaign and zero clock", async () => {
  const { repository, campaign } = await setup({ suffix: "bootstrap" });
  const stored = expectOk(await repository.getCampaign(campaign.campaignId));
  assert.equal(stored.campaignRevision, 0);
  const clock = expectOk(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal((clock.payload as CampaignClockPayload).elapsedGameSeconds, 0);
  assert.equal(clock.updatedByCommitId, null);
});

test("02 strict validation rejects unknown fields and oversized input", async () => {
  const clock = new MutableClock();
  const repository = new MemoryCampaignRepository({ clock });
  const invalid = { ...campaignFixture(clock, "invalid"), unexpected: true } as unknown as CampaignRecord;
  expectError(await repository.createCampaign(invalid, initialClock), "VALIDATION_FAILED");

  const campaign = campaignFixture(clock, "valid");
  expectOk(await repository.createCampaign(campaign, initialClock));
  const oversized = { text: "x".repeat(256 * 1024 + 1) };
  const operation = await operationFixture(campaign, clock, "oversized", oversized);
  expectError(await repository.receiveOperation(operation), "VALIDATION_FAILED");
});

test("03 receiving the same operation is idempotent", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "receive" });
  const first = await operationFixture(campaign, clock, "receive");
  const stored = expectOk(await repository.receiveOperation(first));
  const retransmission = { ...first, operationId: id<OperationId>("op_receive_retry") };
  const replay = expectOk(await repository.receiveOperation(retransmission));
  assert.equal(replay.operationId, stored.operationId);
  const concurrent = await operationFixture(campaign, clock, "receive_concurrent");
  expectError(await repository.receiveOperation(concurrent), "CAMPAIGN_BUSY");
});

test("04 same idempotency key with different fingerprint conflicts", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "idem" });
  const first = await operationFixture(campaign, clock, "idem", { text: "first" });
  expectOk(await repository.receiveOperation(first));
  const second = await operationFixture(campaign, clock, "idem", { text: "second" });
  expectError(await repository.receiveOperation(second), "IDEMPOTENCY_CONFLICT");
});

test("05 forbidden operation transition is rejected", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "transition" });
  const operation = await operationFixture(campaign, clock, "transition");
  expectOk(await repository.receiveOperation(operation));
  expectError(
    await repository.transitionOperation(operation.operationId, "RECEIVED", "READY_TO_COMMIT"),
    "INVALID_TRANSITION"
  );
});

test("06 commit atomically writes multiple aggregates events and tasks", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "atomic" });
  const operation = await readyOperation(repository, campaign, clock, "atomic");
  const writerLease = await lease(repository, campaign.campaignId, "atomic");
  const request = commitRequest({ campaign, operation, writerLease, suffix: "atomic", eventCount: 2 });
  request.aggregateWrites.push({
    aggregateType: "actor.state",
    aggregateId: id("agg_actor_atomic"),
    expectedAggregateRevision: null,
    payloadSchemaVersion: 1,
    payload: { hp: 12 }
  });
  request.events[1].aggregateRefs.push({
    aggregateType: "actor.state",
    aggregateId: id("agg_actor_atomic"),
    aggregateRevision: 0
  });
  const commit = expectOk(await repository.commit(request));
  assert.equal(commit.aggregateWrites.length, 2);
  assert.equal(commit.eventIds.length, 2);
  assert.equal(commit.outboxTaskIds.length, 1);
  assert.equal(expectOk(await repository.getCampaign(campaign.campaignId)).campaignRevision, 1);
});

test("07 revisions and sequences increment exactly", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "revision" });
  const firstOperation = await readyOperation(repository, campaign, clock, "revision_1");
  const firstLease = await lease(repository, campaign.campaignId, "revision_1");
  const first = expectOk(await repository.commit(commitRequest({
    campaign,
    operation: firstOperation,
    writerLease: firstLease,
    suffix: "revision_1"
  })));
  assert.equal(first.campaignRevision, 1);
  assert.equal(first.commitSequence, 1);
  expectOk(await repository.completePresentation(firstOperation.operationId, "COMMITTED_RENDERED", 1, { text: "first" }));
  expectOk(await repository.releaseWriterLease(firstLease));

  const campaignV1 = expectOk(await repository.getCampaign(campaign.campaignId));
  const secondOperation = await readyOperation(repository, campaignV1, clock, "revision_2");
  const secondLease = await lease(repository, campaign.campaignId, "revision_2");
  const second = expectOk(await repository.commit(commitRequest({
    campaign: campaignV1,
    operation: secondOperation,
    writerLease: secondLease,
    suffix: "revision_2",
    expectedAggregateRevision: 0
  })));
  assert.equal(second.campaignRevision, 2);
  assert.equal(second.commitSequence, 2);
  assert.equal(second.aggregateWrites[0].aggregateRevision, 1);
});

test("08 stale campaign and aggregate revisions are rejected", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "stale" });
  const operation = await readyOperation(repository, campaign, clock, "stale_campaign");
  const writerLease = await lease(repository, campaign.campaignId, "stale_campaign");
  const staleCampaign = commitRequest({ campaign, operation, writerLease, suffix: "stale_campaign", expectedCampaignRevision: 9 });
  expectError(await repository.commit(staleCampaign), "STALE_VERSION");

  const staleAggregate = commitRequest({ campaign, operation, writerLease, suffix: "stale_aggregate", expectedAggregateRevision: 4 });
  staleAggregate.idempotencyKey = operation.idempotencyKey;
  staleAggregate.requestFingerprint = operation.requestFingerprint;
  expectError(await repository.commit(staleAggregate), "STALE_VERSION");
});

test("09 stale fencing token is rejected", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "fencing" });
  const operation = await readyOperation(repository, campaign, clock, "fencing");
  const staleLease = await lease(repository, campaign.campaignId, "fencing");
  await lease(repository, campaign.campaignId, "fencing");
  const request = commitRequest({ campaign, operation, writerLease: staleLease, suffix: "fencing" });
  expectError(await repository.commit(request), "STALE_FENCING_TOKEN");
});

test("10 identical commit replay returns existing record after lease expiry", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "replay" });
  const operation = await readyOperation(repository, campaign, clock, "replay");
  const writerLease = await lease(repository, campaign.campaignId, "replay");
  const request = commitRequest({ campaign, operation, writerLease, suffix: "replay" });
  const first = expectOk(await repository.commit(request));
  clock.advance(121_000);
  const replay = expectOk(await repository.commit(request));
  assert.deepEqual(replay, first);
  assert.equal(expectOk(await repository.getCampaign(campaign.campaignId)).campaignRevision, 1);
});

test("11 injected persistence failure leaves no partial write", async () => {
  let fail = true;
  const { repository, clock, campaign } = await setup({
    suffix: "failure",
    failureInjector: point => {
      if (fail && point === "AFTER_EVENTS") throw new Error("injected");
    }
  });
  const operation = await readyOperation(repository, campaign, clock, "failure");
  const writerLease = await lease(repository, campaign.campaignId, "failure");
  const request = commitRequest({ campaign, operation, writerLease, suffix: "failure" });
  expectError(await repository.commit(request), "PERSISTENCE_FAILURE");
  assert.equal(expectOk(await repository.getCampaign(campaign.campaignId)).campaignRevision, 0);
  expectError(await repository.getAggregate(campaign.campaignId, "scene.state", id("agg_scene_main")), "NOT_FOUND");
  assert.equal(expectOk(await repository.listEvents(campaign.campaignId, null, 10)).length, 0);
  assert.equal(expectOk(await repository.getOperation(operation.operationId)).phase, "READY_TO_COMMIT");
  fail = false;
  expectOk(await repository.commit(request));
});

test("12 unknown outcome is resolved by idempotency lookup", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "unknown" });
  const operation = await readyOperation(repository, campaign, clock, "unknown");
  const writerLease = await lease(repository, campaign.campaignId, "unknown");
  const committed = expectOk(await repository.commit(commitRequest({ campaign, operation, writerLease, suffix: "unknown" })));
  const recovered = expectOk(await repository.getCommitByIdempotencyKey(campaign.campaignId, operation.idempotencyKey));
  assert.deepEqual(recovered, committed);
});

test("13 clock is monotonic and no-commit completion consumes no game time", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "clock" });
  const operation = await readyOperation(repository, campaign, clock, "clock_advance");
  const writerLease = await lease(repository, campaign.campaignId, "clock_advance");
  const advance = commitRequest({
    campaign,
    operation,
    writerLease,
    suffix: "clock_advance",
    aggregateType: "world.clock",
    aggregateId: campaign.clockAggregateId,
    expectedAggregateRevision: 0,
    aggregatePayload: { elapsedGameSeconds: 10, calendarId: "calendar.test", calendarVersion: 1 }
  });
  advance.acceptedCommands[0].acceptedAtGameSecond = 0;
  expectOk(await repository.commit(advance));
  expectOk(await repository.completePresentation(operation.operationId, "COMMITTED_RENDERED", 1, { text: "time advanced" }));
  expectOk(await repository.releaseWriterLease(writerLease));

  const campaignV1 = expectOk(await repository.getCampaign(campaign.campaignId));
  const backwardsOperation = await readyOperation(repository, campaignV1, clock, "clock_backwards");
  const backwardsLease = await lease(repository, campaign.campaignId, "clock_backwards");
  const backwards = commitRequest({
    campaign: campaignV1,
    operation: backwardsOperation,
    writerLease: backwardsLease,
    suffix: "clock_backwards",
    aggregateType: "world.clock",
    aggregateId: campaign.clockAggregateId,
    expectedAggregateRevision: 1,
    aggregatePayload: { elapsedGameSeconds: 5, calendarId: "calendar.test", calendarVersion: 1 }
  });
  expectError(await repository.commit(backwards), "VALIDATION_FAILED");
  expectOk(await repository.transitionOperation(backwardsOperation.operationId, "READY_TO_COMMIT", "CANCELLED"));

  const meta = await operationFixture(campaignV1, clock, "clock_meta", { question: "meta" });
  expectOk(await repository.receiveOperation(meta));
  expectOk(await repository.completeWithoutCommit(meta.operationId, 1, { answer: "ok" }));
  const storedClock = expectOk(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal((storedClock.payload as CampaignClockPayload).elapsedGameSeconds, 10);
});

test("14 simultaneous events keep deterministic sequence", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "order" });
  const operation = await readyOperation(repository, campaign, clock, "order");
  const writerLease = await lease(repository, campaign.campaignId, "order");
  const request = commitRequest({ campaign, operation, writerLease, suffix: "order", eventCount: 3 });
  const commit = expectOk(await repository.commit(request));
  const events = expectOk(await repository.listEvents(campaign.campaignId, null, 10));
  assert.deepEqual(events.map(event => event.eventSequence), [0, 1, 2]);
  assert.ok(events.every(event => event.commitSequence === commit.commitSequence));
});

test("15 read-only campaign rejects writes but remains readable", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "readonly" });
  const existing = await operationFixture(campaign, clock, "readonly_existing");
  expectOk(await repository.receiveOperation(existing));
  expectOk(await repository.setCampaignReadOnly(campaign.campaignId, {
    code: "CAMPAIGN_INTEGRITY_FAILURE",
    incidentId: id<IncidentId>("incident_readonly")
  }));
  assert.equal(expectOk(await repository.receiveOperation(existing)).operationId, existing.operationId);
  const newOperation = await operationFixture(campaign, clock, "readonly_new");
  expectError(await repository.receiveOperation(newOperation), "CAMPAIGN_READ_ONLY");
  assert.equal(expectOk(await repository.getCampaign(campaign.campaignId)).status, "READ_ONLY");
});

test("16 expired outbox worker can be reclaimed without source duplication", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "outbox" });
  const operation = await readyOperation(repository, campaign, clock, "outbox");
  const writerLease = await lease(repository, campaign.campaignId, "outbox");
  expectOk(await repository.commit(commitRequest({ campaign, operation, writerLease, suffix: "outbox" })));
  const workerA = id<WorkerId>("worker_outbox_a");
  const workerB = id<WorkerId>("worker_outbox_b");
  const firstClaim = expectOk(await repository.claimOutboxTasks(campaign.campaignId, workerA, 1, 1_000));
  assert.equal(firstClaim[0].attemptCount, 1);
  clock.advance(1_001);
  const secondClaim = expectOk(await repository.claimOutboxTasks(campaign.campaignId, workerB, 1, 1_000));
  assert.equal(secondClaim[0].attemptCount, 2);
  const completed = expectOk(await repository.completeOutboxTask(secondClaim[0].taskId, workerB));
  assert.equal(completed.status, "COMPLETED");
  expectOk(await repository.completeOutboxTask(secondClaim[0].taskId, workerA));
  assert.equal(expectOk(await repository.listEvents(campaign.campaignId, null, 10)).length, 1);
});

test("17 degraded post-commit presentation does not alter commit", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "degraded" });
  const operation = await readyOperation(repository, campaign, clock, "degraded");
  const writerLease = await lease(repository, campaign.campaignId, "degraded");
  const commit = expectOk(await repository.commit(commitRequest({ campaign, operation, writerLease, suffix: "degraded" })));
  const completed = expectOk(await repository.completePresentation(
    operation.operationId,
    "COMMITTED_DEGRADED",
    1,
    { blocks: [{ kind: "system", text: "Résultat enregistré." }] }
  ));
  assert.equal(completed.completionMode, "COMMITTED_DEGRADED");
  assert.deepEqual(expectOk(await repository.getCommit(commit.commitId)), commit);
  assert.equal(expectOk(await repository.getCampaign(campaign.campaignId)).campaignRevision, 1);
});

test("18 durable request resumes and returns the same no-commit result", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "resume" });
  const operation = await operationFixture(campaign, clock, "resume", { question: "Puis-je essayer ?" });
  expectOk(await repository.receiveOperation(operation));
  assert.deepEqual(expectOk(await repository.getOperation(operation.operationId)).requestPayload, operation.requestPayload);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expectError(
    await repository.completeWithoutCommit(operation.operationId, 1, cyclic as JsonObject),
    "VALIDATION_FAILED"
  );
  const completed = expectOk(await repository.completeWithoutCommit(operation.operationId, 1, { answer: "Oui, sans agir." }));
  const replay = expectOk(await repository.receiveOperation({
    ...operation,
    operationId: id("op_resume_retry")
  }));
  assert.equal(replay.operationId, completed.operationId);
  assert.deepEqual(replay.resultPayload, completed.resultPayload);
});

test("19 event cursor paginates inside one commit without loss", async () => {
  const { repository, clock, campaign } = await setup({ suffix: "pagination" });
  const operation = await readyOperation(repository, campaign, clock, "pagination");
  const writerLease = await lease(repository, campaign.campaignId, "pagination");
  expectOk(await repository.commit(commitRequest({ campaign, operation, writerLease, suffix: "pagination", eventCount: 3 })));
  const firstPage = expectOk(await repository.listEvents(campaign.campaignId, null, 2));
  assert.equal(firstPage.length, 2);
  const last = firstPage[1];
  const secondPage = expectOk(await repository.listEvents(campaign.campaignId, {
    commitSequence: last.commitSequence,
    eventSequence: last.eventSequence
  }, 2));
  assert.equal(secondPage.length, 1);
  assert.deepEqual([...firstPage, ...secondPage].map(event => event.eventSequence), [0, 1, 2]);
});

async function main(): Promise<void> {
  let failures = 0;
  for (const entry of tests) {
    try {
      await entry.run();
      console.log(`PASS ${entry.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${entry.name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    console.error(`${failures}/${tests.length} contract tests failed.`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${tests.length}/${tests.length} campaign-core contract tests.`);
  }
}

void main();
