import {
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type RequestId,
  type RepositoryClock,
  type Result,
  type TaskId,
  type WorkerId
} from "../../src/core/index";
import {
  MemoryCampaignBootstrapRepository,
  type BootstrapFailurePoint,
  type CampaignBootstrapRepository,
  type CampaignBootstrapPersistenceRequestV1
} from "../../src/bootstrap/index";
import { assert } from "./assertions";

type AsyncTest = () => Promise<void>;
const tests: Array<{ name: string; run: AsyncTest }> = [];

export interface CampaignBootstrapContractHarness {
  name: string;
  create(options: {
    suffix: string;
    clock: RepositoryClock;
    failureInjector?: (point: string) => void;
  }): Promise<CampaignRepository & CampaignBootstrapRepository>;
  dispose?(): Promise<void>;
}

const memoryHarness: CampaignBootstrapContractHarness = {
  name: "memory-bootstrap",
  async create(options) {
    return new MemoryCampaignBootstrapRepository({
      clock: options.clock,
      failureInjector: options.failureInjector
    });
  }
};

let activeHarness = memoryHarness;

class MutableClock implements RepositoryClock {
  constructor(private epochMs = Date.parse("2026-07-06T12:00:00.000Z")) {}

  now(): Date {
    return new Date(this.epochMs);
  }

  advance(ms: number): void {
    this.epochMs += ms;
  }
}

function test(name: string, run: AsyncTest): void {
  tests.push({ name, run });
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`Expected success, got ${result.error.code}: ${result.error.messageKey}`);
  return result.value;
}

function expectError<T>(result: Result<T>, code: string): void {
  assert.equal(result.ok, false, "Expected an error result.");
  if (!result.ok) assert.equal(result.error.code, code);
}

export async function campaignBootstrapFixture(
  clock: RepositoryClock,
  suffix: string
): Promise<CampaignBootstrapPersistenceRequestV1> {
  const instant = clock.now().toISOString();
  const campaignId = id<CampaignId>(`cmp_bootstrap_${suffix}`);
  const operationId = id<OperationId>(`op_bootstrap_${suffix}`);
  const commitId = id<CommitId>(`cmt_bootstrap_${suffix}`);
  const idempotencyKey = id<IdempotencyKey>(`idem_bootstrap_${suffix}`);
  const clockAggregateId = id<AggregateId>(`agg_clock_${suffix}`);
  const actorAggregateId = id<AggregateId>(`agg_actor_${suffix}`);
  const commandId = id<CommandId>(`cmd_bootstrap_${suffix}`);
  const eventId = id<EventId>(`evt_bootstrap_${suffix}`);
  const taskId = id<TaskId>(`task_bootstrap_${suffix}`);
  const requestPayload = {
    contentPackage: "content.test@1",
    ruleset: "rules.test@1",
    characterSourceFingerprint: `sha256:${"1".repeat(64)}`
  };
  const requestFingerprint = await computeRequestFingerprint("campaign.bootstrap", 1, requestPayload);

  const initialAggregates: AggregateRecord[] = [{
    schemaVersion: 1 as const,
    campaignId,
    aggregateType: "world.clock",
    aggregateId: clockAggregateId,
    aggregateRevision: 0,
    payloadSchemaVersion: 1,
    payload: { elapsedGameSeconds: 0, calendarId: "calendar.test", calendarVersion: 1 },
    updatedByCommitId: commitId
  }, {
    schemaVersion: 1 as const,
    campaignId,
    aggregateType: "actor.state",
    aggregateId: actorAggregateId,
    aggregateRevision: 0,
    payloadSchemaVersion: 1,
    payload: { actorId: "actor.player", hitPoints: 12 },
    updatedByCommitId: commitId
  }];

  return {
    schemaVersion: 1,
    campaign: {
      schemaVersion: 1,
      campaignId,
      campaignRevision: 1,
      status: "ACTIVE",
      clockAggregateId,
      dependencies: {
        contentPackageId: "content.test",
        contentPackageVersion: 1,
        rulesetId: "rules.test",
        rulesetVersion: 1,
        calendarId: "calendar.test",
        calendarVersion: 1
      },
      writeBlock: null,
      lastCommitId: commitId,
      createdAt: instant,
      updatedAt: instant
    },
    operation: {
      schemaVersion: 1,
      operationId,
      campaignId,
      clientRequestId: id<RequestId>(`req_bootstrap_${suffix}`),
      idempotencyKey,
      requestFingerprint,
      operationKind: "campaign.bootstrap",
      requestPayloadSchemaVersion: 1,
      requestPayload,
      phase: "COMMITTED_PENDING_RENDER",
      observedCampaignRevision: 0,
      commitId,
      completionMode: null,
      resultPayloadSchemaVersion: null,
      resultPayload: null,
      failure: null,
      receivedAt: instant,
      updatedAt: instant
    },
    initialAggregates,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "campaign.bootstrap",
      contractVersion: 2,
      commandId,
      campaignId,
      operationId,
      commandType: "campaign.initialize-actor",
      target: {
        aggregateType: "actor.state",
        aggregateId: actorAggregateId,
        expectedAggregateRevision: null
      },
      payloadSchemaVersion: 1,
      payload: { actorId: "actor.player" },
      acceptedAtGameSecond: 0,
      commitId
    }],
    events: [{
      schemaVersion: 1,
      eventId,
      campaignId,
      operationId,
      eventType: "campaign.bootstrapped",
      origin: "SYSTEM",
      causation: { kind: "OPERATION", id: operationId },
      aggregateRefs: initialAggregates.map(aggregate => ({
        aggregateType: aggregate.aggregateType,
        aggregateId: aggregate.aggregateId,
        aggregateRevision: 0
      })),
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: 0,
      payloadSchemaVersion: 1,
      payload: { contentPackageId: "content.test", contentPackageVersion: 1 },
      commitId,
      recordedAt: instant,
      commitSequence: 1,
      eventSequence: 0
    }],
    outboxTasks: [{
      schemaVersion: 1,
      taskId,
      taskType: "projection.refresh",
      sourceEventIds: [eventId],
      payloadSchemaVersion: 1,
      payload: { projection: "campaign-summary" },
      campaignId,
      commitId,
      status: "PENDING",
      attemptCount: 0,
      lockedBy: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      lastError: null,
      createdAt: instant,
      updatedAt: instant
    }],
    commit: {
      schemaVersion: 1,
      commitId,
      campaignId,
      operationId,
      idempotencyKey,
      requestFingerprint,
      previousCampaignRevision: 0,
      campaignRevision: 1,
      commitSequence: 1,
      commandIds: [commandId],
      eventIds: [eventId],
      aggregateWrites: initialAggregates.map(aggregate => ({
        aggregateType: aggregate.aggregateType,
        aggregateId: aggregate.aggregateId,
        previousRevision: null,
        aggregateRevision: 0
      })),
      outboxTaskIds: [taskId],
      committedAt: instant
    }
  };
}

test("01 bootstrap publishes only the complete revision 1 state", async () => {
  const clock = new MutableClock();
  const repository = await activeHarness.create({ suffix: "complete", clock });
  const request = await campaignBootstrapFixture(clock, "complete");
  const result = expectOk(await repository.bootstrapCampaign(request));
  assert.equal(result.campaign.campaignRevision, 1);
  assert.equal(result.operation.phase, "COMMITTED_PENDING_RENDER");
  assert.equal(result.commit.previousCampaignRevision, 0);
  assert.equal(result.commit.campaignRevision, 1);

  const storedCampaign = expectOk(await repository.getCampaign(request.campaign.campaignId));
  assert.equal(storedCampaign.campaignRevision, 1);
  assert.equal(storedCampaign.lastCommitId, request.commit.commitId);
  for (const aggregate of request.initialAggregates) {
    const stored = expectOk(await repository.getAggregate(
      request.campaign.campaignId,
      aggregate.aggregateType,
      aggregate.aggregateId
    ));
    assert.equal(stored.aggregateRevision, 0);
    assert.equal(stored.updatedByCommitId, request.commit.commitId);
  }
  const events = expectOk(await repository.listEvents(request.campaign.campaignId, null, 10));
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "campaign.bootstrapped");
  const claimed = expectOk(await repository.claimOutboxTasks(
    request.campaign.campaignId,
    id<WorkerId>("worker.bootstrap"),
    10,
    30_000
  ));
  assert.equal(claimed.length, 1);
});

test("02 identical replay returns the original commit", async () => {
  const clock = new MutableClock();
  const repository = await activeHarness.create({ suffix: "replay", clock });
  const request = await campaignBootstrapFixture(clock, "replay");
  const first = expectOk(await repository.bootstrapCampaign(request));
  clock.advance(180_000);
  const replay = expectOk(await repository.bootstrapCampaign(request));
  assert.equal(replay.commit.commitId, first.commit.commitId);
  assert.equal(expectOk(await repository.listEvents(request.campaign.campaignId, null, 10)).length, 1);
});

test("03 changed fingerprint conflicts with the existing campaign", async () => {
  const clock = new MutableClock();
  const repository = await activeHarness.create({ suffix: "conflict", clock });
  const request = await campaignBootstrapFixture(clock, "conflict");
  expectOk(await repository.bootstrapCampaign(request));
  const changed = structuredClone(request);
  const fingerprint = await computeRequestFingerprint("campaign.bootstrap", 1, { changed: true });
  changed.operation.requestFingerprint = fingerprint;
  changed.commit.requestFingerprint = fingerprint;
  expectError(await repository.bootstrapCampaign(changed), "IDEMPOTENCY_CONFLICT");
});

test("04 malformed final records are rejected before publication", async () => {
  const clock = new MutableClock();
  const repository = await activeHarness.create({ suffix: "invalid", clock });
  const request = await campaignBootstrapFixture(clock, "invalid");
  request.initialAggregates[0].updatedByCommitId = null;
  expectError(await repository.bootstrapCampaign(request), "VALIDATION_FAILED");
  expectError(await repository.getCampaign(request.campaign.campaignId), "NOT_FOUND");
});

const failurePoints: BootstrapFailurePoint[] = [
  "BOOTSTRAP_AFTER_CAMPAIGN",
  "BOOTSTRAP_AFTER_OPERATION",
  "BOOTSTRAP_AFTER_AGGREGATES",
  "BOOTSTRAP_AFTER_COMMANDS",
  "BOOTSTRAP_AFTER_EVENTS",
  "BOOTSTRAP_AFTER_OUTBOX",
  "BOOTSTRAP_AFTER_COMMIT",
  "BOOTSTRAP_BEFORE_PUBLISH"
];

test("05 every injected write failure rolls back the whole bootstrap", async () => {
  for (const [index, failurePoint] of failurePoints.entries()) {
    const clock = new MutableClock();
    let fail = true;
    const repository = await activeHarness.create({
      suffix: `failure_${index}`,
      clock,
      failureInjector(point) {
        if (fail && point === failurePoint) throw new Error(`Injected at ${point}`);
      }
    });
    const request = await campaignBootstrapFixture(clock, `failure_${index}`);
    expectError(await repository.bootstrapCampaign(request), "PERSISTENCE_FAILURE");
    expectError(await repository.getCampaign(request.campaign.campaignId), "NOT_FOUND");
    expectError(await repository.getOperation(request.operation.operationId), "NOT_FOUND");
    expectError(await repository.getCommit(request.commit.commitId), "NOT_FOUND");
    expectError(await repository.getAggregate(
      request.campaign.campaignId,
      request.initialAggregates[0].aggregateType,
      request.initialAggregates[0].aggregateId
    ), "NOT_FOUND");
    fail = false;
    expectOk(await repository.bootstrapCampaign(request));
  }
});

test("06 unknown outcome resolves through original identities", async () => {
  const clock = new MutableClock();
  const repository = await activeHarness.create({ suffix: "unknown", clock });
  const request = await campaignBootstrapFixture(clock, "unknown");
  const committed = expectOk(await repository.bootstrapCampaign(request));
  const recovered = expectOk(await repository.getCommitByIdempotencyKey(
    request.campaign.campaignId,
    request.operation.idempotencyKey
  ));
  assert.deepEqual(recovered, committed.commit);
  const operation = expectOk(await repository.getOperationByIdempotencyKey(
    request.campaign.campaignId,
    request.operation.idempotencyKey
  ));
  assert.equal(operation.operationId, request.operation.operationId);
});

test("07 presentation completion does not alter the committed campaign", async () => {
  const clock = new MutableClock();
  const repository = await activeHarness.create({ suffix: "presentation", clock });
  const request = await campaignBootstrapFixture(clock, "presentation");
  expectOk(await repository.bootstrapCampaign(request));
  const completed = expectOk(await repository.completePresentation(
    request.operation.operationId,
    "COMMITTED_DEGRADED",
    1,
    { redirect: "campaign", degraded: true }
  ));
  assert.equal(completed.phase, "COMPLETED");
  assert.equal(completed.commitId, request.commit.commitId);
  assert.equal(expectOk(await repository.getCampaign(request.campaign.campaignId)).campaignRevision, 1);
});

export interface CampaignBootstrapContractRun {
  harness: string;
  passed: number;
  failed: number;
  failures: Array<{ name: string; message: string }>;
}

export async function runCampaignBootstrapContractTests(
  harness: CampaignBootstrapContractHarness = memoryHarness
): Promise<CampaignBootstrapContractRun> {
  activeHarness = harness;
  const failures: Array<{ name: string; message: string }> = [];
  for (const entry of tests) {
    try {
      await entry.run();
      console.log(`PASS [${harness.name}] ${entry.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      failures.push({ name: entry.name, message });
      console.error(`FAIL [${harness.name}] ${entry.name}`);
      console.error(error);
    }
  }
  await harness.dispose?.();
  const passed = tests.length - failures.length;
  console.log(`${failures.length === 0 ? "PASS" : "FAIL"} [${harness.name}] ${passed}/${tests.length} campaign-bootstrap contract tests.`);
  return { harness: harness.name, passed, failed: failures.length, failures };
}

const executedDirectly = typeof process !== "undefined" &&
  process.argv.some(argument => argument.replaceAll("\\", "/").endsWith("tests/contracts/verify-campaign-bootstrap.ts"));

if (executedDirectly) {
  void runCampaignBootstrapContractTests().then(result => {
    if (result.failed > 0) process.exitCode = 1;
  });
}
