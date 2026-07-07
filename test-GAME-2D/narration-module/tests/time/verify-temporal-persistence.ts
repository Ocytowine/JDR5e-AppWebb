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
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result,
  type WriterId
} from "../../src/core/index";
import {
  MemoryCampaignBootstrapRepository,
  type CampaignBootstrapRepository
} from "../../src/bootstrap/index";
import {
  MapModuleWorldSimulationAdapterV1,
  createProcessStatePayloadV1,
  planNextTemporalBatchV1,
  prepareTemporalSegmentCommitV1,
  scheduledEffectToTaskV1,
  validateProcessStatePayloadV1,
  validateWorldSchedulePayloadV1,
  validateWorldSimulationCursorPayloadV1,
  type ProcessStatePayloadV1,
  type ScheduledEffectV1,
  type TemporalBatchV1
} from "../../src/time";
import { createExampleWorldState } from "../../../map-module/world-simulation/exampleScenario";
import type { CampaignRepository, CampaignRecord, CommitRecord, JsonObject } from "../../src/core/index";
import { campaignBootstrapFixture } from "../contracts/verify-campaign-bootstrap";
import { assert } from "../contracts/assertions";

class FixedClock implements RepositoryClock {
  now(): Date { return new Date("2026-07-06T14:00:00.000Z"); }
}

type TemporalRepository = CampaignRepository & CampaignBootstrapRepository;

export interface TemporalPersistenceHarness {
  name: string;
  create(options: { suffix: string; clock: RepositoryClock; failureInjector?: (point: string) => void }): Promise<TemporalRepository>;
  reopen?(repository: TemporalRepository, clock: RepositoryClock): Promise<TemporalRepository>;
  dispose?(): Promise<void>;
}

const memoryHarness: TemporalPersistenceHarness = {
  name: "memory-temporal",
  async create(options) {
    return new MemoryCampaignBootstrapRepository({ clock: options.clock, failureInjector: options.failureInjector });
  }
};

function id<T extends string>(value: string): T { return opaqueId<T>(value); }

function ok<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  return result.value;
}

async function operation(
  repository: TemporalRepository,
  campaign: CampaignRecord,
  suffix: string,
  batchFingerprint: string
): Promise<OperationRecord> {
  const payload = { batchFingerprint };
  const record: OperationRecord = {
    schemaVersion: 1,
    operationId: id<OperationId>(`op_time_${suffix}`),
    campaignId: campaign.campaignId,
    clientRequestId: id<RequestId>(`req_time_${suffix}`),
    idempotencyKey: id<IdempotencyKey>(`idem_time_${suffix}`),
    requestFingerprint: await computeRequestFingerprint("time.segment", 1, payload),
    operationKind: "time.segment",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: "2026-07-06T14:00:00.000Z",
    updatedAt: "2026-07-06T14:00:00.000Z"
  };
  ok(await repository.receiveOperation(record));
  ok(await repository.transitionOperation(record.operationId, "RECEIVED", "PREPARING"));
  return ok(await repository.transitionOperation(record.operationId, "PREPARING", "READY_TO_COMMIT"));
}

async function initializationBatch(batchId: string, taskId: string): Promise<TemporalBatchV1> {
  const base = {
    schemaVersion: 1 as const,
    batchId,
    currentGameSecond: 0,
    requestedTargetGameSecond: 0,
    effectiveAtGameSecond: 0,
    orderedTasks: [{
      schemaVersion: 1 as const,
      taskId,
      taskKind: "PROCESS_BOUNDARY" as const,
      dueAtGameSecond: 0,
      boundaryPolicy: "SIMULTANEOUS" as const,
      dependsOnTaskIds: [],
      payload: { action: "INITIALIZE_TEMPORAL_STATE" }
    }]
  };
  return { ...base, batchFingerprint: await computeJsonFingerprint(base) as `sha256:${string}` };
}

async function processState(input: {
  revision: number;
  expectedCampaignRevision: number;
  lastEventId: string | null;
  phase: string;
}): Promise<ProcessStatePayloadV1> {
  const result = await createProcessStatePayloadV1({
    processId: "process-travel-lysenthe",
    processType: "TRAVEL",
    ownerDomain: "travel",
    status: "ACTIVE",
    checkpointRevision: input.revision,
    lastAppliedEventId: input.lastEventId,
    expectedCampaignRevision: input.expectedCampaignRevision,
    stateSchemaVersion: 1,
    state: { phase: input.phase, segmentIndex: input.revision },
    pendingDecision: null
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("process fixture invalid");
  return result.value;
}

const aggregateIds = {
  schedule: id<AggregateId>("agg-world-schedule"),
  cursor: id<AggregateId>("agg-world-simulation-cursor"),
  process: id<AggregateId>("agg-process-travel-lysenthe"),
  world: id<AggregateId>("agg-world-state")
};

function effect(campaignId: CampaignId): ScheduledEffectV1 {
  return {
    schemaVersion: 1,
    effectId: "effect-travel-first-segment",
    campaignId,
    ownerDomain: "travel",
    effectType: "travel.segment-complete",
    dueAtGameSecond: 600,
    boundaryPolicy: "BEFORE_ACTIVITY_COMPLETION",
    dependsOnEffectIds: [],
    causedByEventIds: [],
    status: "SCHEDULED",
    payloadSchemaVersion: 1,
    payload: { segmentIndex: 0 }
  };
}

async function bootstrap(repository: TemporalRepository, suffix: string): Promise<CampaignRecord> {
  const request = await campaignBootstrapFixture(new FixedClock(), `temporal_${suffix}`);
  const result = ok(await repository.bootstrapCampaign(request));
  ok(await repository.completePresentation(result.operation.operationId, "COMMITTED_RENDERED", 1, { ready: true }));
  return ok(await repository.getCampaign(result.campaign.campaignId));
}

async function initialize(
  repository: TemporalRepository,
  campaign: CampaignRecord,
  suffix: string,
  withEffect = true,
  initialWorldState: JsonObject = {
    clock: { tick: 0, microTick: 0, macroTick: 0, minutesPerMicroTick: 60, microPerMacro: 6 },
    marker: "INITIAL"
  }
): Promise<CommitRecord> {
  const taskId = `task-time-init-${suffix}`;
  const eventId = id<EventId>(`event-time-init-${suffix}`);
  const batch = await initializationBatch(`batch-init-${suffix}`, taskId);
  const op = await operation(repository, campaign, `init_${suffix}`, batch.batchFingerprint);
  const writerLease = ok(await repository.acquireWriterLease(campaign.campaignId, id<WriterId>(`writer-init-${suffix}`), 120_000));
  const clock = ok(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  const prepared = await prepareTemporalSegmentCommitV1({
    campaign,
    operation: op,
    writerLease,
    clockAggregate: clock,
    scheduleAggregate: null,
    scheduleAggregateId: aggregateIds.schedule,
    simulationCursorAggregate: null,
    simulationCursorAggregateId: aggregateIds.cursor,
    worldStateAggregate: null,
    worldStateAggregateId: aggregateIds.world,
    initialWorldState,
    processAggregate: null,
    processAggregateId: aggregateIds.process,
    nextProcess: await processState({ revision: 0, expectedCampaignRevision: campaign.campaignRevision + 1, lastEventId: eventId, phase: "PLANNED" }),
    batch,
    resolutions: [{
      taskId,
      outcome: "RESOLVED",
      eventId,
      eventType: "temporal.state-initialized",
      origin: "SYSTEM",
      visibility: { scope: "SYSTEM", actorIds: [] },
      payload: { initialized: true }
    }],
    newEffects: withEffect ? [effect(campaign.campaignId)] : [],
    commitId: id<CommitId>(`commit-time-init-${suffix}`),
    commandId: id<CommandId>(`command-time-init-${suffix}`)
  });
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.diagnostics.map(value => value.code).join(","));
  if (!prepared.ok) throw new Error("initial temporal commit invalid");
  const commit = ok(await repository.commit(prepared.value));
  ok(await repository.completePresentation(op.operationId, "COMMITTED_RENDERED", 1, { initialized: true }));
  ok(await repository.releaseWriterLease(writerLease));
  return commit;
}

async function prepareResolution(repository: TemporalRepository, campaign: CampaignRecord, suffix: string) {
  const scheduleAggregate = ok(await repository.getAggregate(campaign.campaignId, "world.schedule", aggregateIds.schedule));
  const cursorAggregate = ok(await repository.getAggregate(campaign.campaignId, "world.simulation-cursor", aggregateIds.cursor));
  const processAggregate = ok(await repository.getAggregate(campaign.campaignId, "process.state", aggregateIds.process));
  const clockAggregate = ok(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  const schedule = validateWorldSchedulePayloadV1(scheduleAggregate.payload);
  assert.equal(schedule.ok, true);
  if (!schedule.ok) throw new Error("stored schedule invalid");
  const scheduledTask = scheduledEffectToTaskV1(schedule.value.effects[0], 0);
  assert.equal(scheduledTask.ok, true);
  if (!scheduledTask.ok) throw new Error("stored effect invalid");
  const planned = await planNextTemporalBatchV1({
    batchId: `batch-resolve-${suffix}`,
    currentGameSecond: 0,
    requestedTargetGameSecond: 600,
    tasks: [scheduledTask.value]
  });
  assert.equal(planned.ok, true);
  if (!planned.ok || !planned.value) throw new Error("batch planning failed");
  const op = await operation(repository, campaign, `resolve_${suffix}`, planned.value.batchFingerprint);
  const writerLease = ok(await repository.acquireWriterLease(campaign.campaignId, id<WriterId>(`writer-resolve-${suffix}`), 120_000));
  const eventId = id<EventId>(`event-time-resolved-${suffix}`);
  const prepared = await prepareTemporalSegmentCommitV1({
    campaign,
    operation: op,
    writerLease,
    clockAggregate,
    scheduleAggregate,
    scheduleAggregateId: aggregateIds.schedule,
    simulationCursorAggregate: cursorAggregate,
    simulationCursorAggregateId: aggregateIds.cursor,
    processAggregate,
    processAggregateId: aggregateIds.process,
    nextProcess: await processState({
      revision: 1,
      expectedCampaignRevision: campaign.campaignRevision + 1,
      lastEventId: eventId,
      phase: "SEGMENT_COMPLETED"
    }),
    batch: planned.value,
    resolutions: [{
      taskId: scheduledTask.value.taskId,
      outcome: "RESOLVED",
      eventId,
      eventType: "travel.segment-completed",
      origin: "PROCESS",
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      payload: { distance: 1 }
    }],
    newEffects: [],
    commitId: id<CommitId>(`commit-time-resolve-${suffix}`),
    commandId: id<CommandId>(`command-time-resolve-${suffix}`)
  });
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.diagnostics.map(value => value.code).join(","));
  if (!prepared.ok) throw new Error("resolution commit invalid");
  return { request: prepared.value, op, writerLease };
}

async function verifyStoredState(repository: TemporalRepository, campaignId: CampaignId): Promise<void> {
  const campaign = ok(await repository.getCampaign(campaignId));
  const clock = ok(await repository.getAggregate(campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal(clock.payload.elapsedGameSeconds, 600);
  const schedule = validateWorldSchedulePayloadV1(ok(await repository.getAggregate(campaignId, "world.schedule", aggregateIds.schedule)).payload);
  assert.equal(schedule.ok, true);
  if (schedule.ok) assert.equal(schedule.value.effects[0].status, "RESOLVED");
  const cursor = validateWorldSimulationCursorPayloadV1(ok(await repository.getAggregate(campaignId, "world.simulation-cursor", aggregateIds.cursor)).payload);
  assert.equal(cursor.ok, true);
  if (cursor.ok) assert.equal(cursor.value.worldSimulatedThrough, 0);
  const process = await validateProcessStatePayloadV1(ok(await repository.getAggregate(campaignId, "process.state", aggregateIds.process)).payload);
  assert.equal(process.ok, true);
  if (process.ok) {
    assert.equal(process.value.checkpointRevision, 1);
    assert.equal(process.value.state.phase, "SEGMENT_COMPLETED");
  }
}

async function successfulScenario(harness: TemporalPersistenceHarness): Promise<void> {
  let repository = await harness.create({ suffix: "success", clock: new FixedClock() });
  const initialCampaign = await bootstrap(repository, "success");
  await initialize(repository, initialCampaign, "success");
  const campaign = ok(await repository.getCampaign(initialCampaign.campaignId));
  const prepared = await prepareResolution(repository, campaign, "success");
  const first = ok(await repository.commit(prepared.request));
  const replay = ok(await repository.commit(prepared.request));
  assert.equal(replay.commitId, first.commitId);
  if (harness.reopen) repository = await harness.reopen(repository, new FixedClock());
  await verifyStoredState(repository, campaign.campaignId);
  const events = ok(await repository.listEvents(campaign.campaignId, null, 20));
  assert.equal(events.filter(value => value.eventType === "travel.segment-completed").length, 1);
  console.log(`PASS [${harness.name}] clock, schedule and process checkpoint commit atomically and replay once`);
}

async function failureScenario(harness: TemporalPersistenceHarness): Promise<void> {
  let injectFailure = false;
  const repository = await harness.create({
    suffix: "failure",
    clock: new FixedClock(),
    failureInjector: point => {
      if (injectFailure && point === "AFTER_EVENTS") throw new Error("injected temporal failure");
    }
  });
  const initialCampaign = await bootstrap(repository, "failure");
  await initialize(repository, initialCampaign, "failure");
  const campaign = ok(await repository.getCampaign(initialCampaign.campaignId));
  const beforeClock = ok(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  const beforeSchedule = ok(await repository.getAggregate(campaign.campaignId, "world.schedule", aggregateIds.schedule));
  const beforeProcess = ok(await repository.getAggregate(campaign.campaignId, "process.state", aggregateIds.process));
  const prepared = await prepareResolution(repository, campaign, "failure");
  injectFailure = true;
  const failed = await repository.commit(prepared.request);
  assert.equal(failed.ok, false);
  assert.deepEqual(ok(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId)), beforeClock);
  assert.deepEqual(ok(await repository.getAggregate(campaign.campaignId, "world.schedule", aggregateIds.schedule)), beforeSchedule);
  assert.deepEqual(ok(await repository.getAggregate(campaign.campaignId, "process.state", aggregateIds.process)), beforeProcess);
  injectFailure = false;
  ok(await repository.commit(prepared.request));
  await verifyStoredState(repository, campaign.campaignId);
  console.log(`PASS [${harness.name}] injected failure publishes no partial clock, schedule or checkpoint`);
}

async function payloadValidationScenario(harness: TemporalPersistenceHarness): Promise<void> {
  const validProcess = await processState({ revision: 0, expectedCampaignRevision: 2, lastEventId: null, phase: "PLANNED" });
  const tamperedProcess = structuredClone(validProcess);
  tamperedProcess.state.phase = "TAMPERED";
  assert.equal((await validateProcessStatePayloadV1(tamperedProcess)).ok, false);
  assert.equal(validateWorldSimulationCursorPayloadV1({
    schemaVersion: 1,
    worldSimulatedThrough: 3_600,
    tick: 0,
    microTick: 0,
    macroTick: 0,
    secondsPerMicroTick: 3_600,
    microPerMacro: 6
  }).ok, false);
  const first = effect(id<CampaignId>("campaign-cycle"));
  first.effectId = "effect-a";
  first.dependsOnEffectIds = ["effect-b"];
  const second = structuredClone(first);
  second.effectId = "effect-b";
  second.dependsOnEffectIds = ["effect-a"];
  assert.equal(validateWorldSchedulePayloadV1({ schemaVersion: 1, effects: [first, second] }).ok, false);
  console.log(`PASS [${harness.name}] fingerprints, cursor arithmetic and schedule cycles reject invalid persisted payloads`);
}

async function simulationGuardScenario(harness: TemporalPersistenceHarness): Promise<void> {
  const repository = await harness.create({ suffix: "simulation_guard", clock: new FixedClock() });
  const initialCampaign = await bootstrap(repository, "simulation_guard");
  await initialize(repository, initialCampaign, "simulation_guard", false);
  const campaign = ok(await repository.getCampaign(initialCampaign.campaignId));
  const task = {
    schemaVersion: 1 as const,
    taskId: "world-boundary-3600",
    taskKind: "WORLD_SIMULATION_BOUNDARY" as const,
    dueAtGameSecond: 3_600,
    boundaryPolicy: "SIMULTANEOUS" as const,
    dependsOnTaskIds: [],
    payload: { hours: 1 }
  };
  const base = {
    schemaVersion: 1 as const,
    batchId: "batch-world-boundary",
    currentGameSecond: 0,
    requestedTargetGameSecond: 3_600,
    effectiveAtGameSecond: 3_600,
    orderedTasks: [task]
  };
  const batch: TemporalBatchV1 = {
    ...base,
    batchFingerprint: await computeJsonFingerprint(base) as `sha256:${string}`
  };
  const op = await operation(repository, campaign, "simulation_guard", batch.batchFingerprint);
  const writerLease = ok(await repository.acquireWriterLease(campaign.campaignId, id<WriterId>("writer-simulation-guard"), 120_000));
  const result = await prepareTemporalSegmentCommitV1({
    campaign,
    operation: op,
    writerLease,
    clockAggregate: ok(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId)),
    scheduleAggregate: ok(await repository.getAggregate(campaign.campaignId, "world.schedule", aggregateIds.schedule)),
    scheduleAggregateId: aggregateIds.schedule,
    simulationCursorAggregate: ok(await repository.getAggregate(campaign.campaignId, "world.simulation-cursor", aggregateIds.cursor)),
    simulationCursorAggregateId: aggregateIds.cursor,
    processAggregate: ok(await repository.getAggregate(campaign.campaignId, "process.state", aggregateIds.process)),
    processAggregateId: aggregateIds.process,
    nextProcess: null,
    batch,
    resolutions: [{
      taskId: task.taskId,
      outcome: "RESOLVED",
      eventId: id<EventId>("event-forbidden-world-boundary"),
      eventType: "world.simulated",
      origin: "WORLD_SIMULATION",
      visibility: { scope: "SYSTEM", actorIds: [] },
      payload: {}
    }],
    newEffects: [],
    commitId: id<CommitId>("commit-forbidden-world-boundary"),
    commandId: id<CommandId>("command-forbidden-world-boundary")
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.diagnostics.some(value => value.code === "TEMPORAL_SIMULATION_ADAPTER_REQUIRED"));
  const clock = ok(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal(clock.payload.elapsedGameSeconds, 0);
  console.log(`PASS [${harness.name}] world simulation cannot advance before the I-03C adapter`);
}

async function simulationCommitScenario(harness: TemporalPersistenceHarness): Promise<void> {
  const repository = await harness.create({ suffix: "simulation_commit", clock: new FixedClock() });
  const initialCampaign = await bootstrap(repository, "simulation_commit");
  const initialWorldState = JSON.parse(JSON.stringify(createExampleWorldState())) as JsonObject;
  await initialize(repository, initialCampaign, "simulation_commit", false, initialWorldState);
  const campaign = ok(await repository.getCampaign(initialCampaign.campaignId));
  const worldStateAggregate = ok(await repository.getAggregate(campaign.campaignId, "world.state", aggregateIds.world));
  const cursorAggregate = ok(await repository.getAggregate(campaign.campaignId, "world.simulation-cursor", aggregateIds.cursor));
  const scheduleAggregate = ok(await repository.getAggregate(campaign.campaignId, "world.schedule", aggregateIds.schedule));
  const processAggregate = ok(await repository.getAggregate(campaign.campaignId, "process.state", aggregateIds.process));
  const clockAggregate = ok(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  const task = {
    schemaVersion: 1 as const,
    taskId: "world-boundary-3600-valid",
    taskKind: "WORLD_SIMULATION_BOUNDARY" as const,
    dueAtGameSecond: 3_600,
    boundaryPolicy: "SIMULTANEOUS" as const,
    dependsOnTaskIds: [],
    payload: { hours: 1 }
  };
  const batchBase = {
    schemaVersion: 1 as const,
    batchId: "batch-world-boundary-valid",
    currentGameSecond: 0,
    requestedTargetGameSecond: 3_600,
    effectiveAtGameSecond: 3_600,
    orderedTasks: [task]
  };
  const batch: TemporalBatchV1 = {
    ...batchBase,
    batchFingerprint: await computeJsonFingerprint(batchBase) as `sha256:${string}`
  };
  const adapterResult = await new MapModuleWorldSimulationAdapterV1().simulate({
    schemaVersion: 1,
    simulationId: "simulation-commit-1h",
    currentGameSecond: 0,
    targetGameSecond: 3_600,
    hoursToProcess: 1,
    cursor: {
      schemaVersion: 1,
      worldSimulatedThrough: 0,
      tick: 0,
      microTick: 0,
      macroTick: 0,
      secondsPerMicroTick: 3_600,
      microPerMacro: 6
    },
    worldStateFingerprint: await computeJsonFingerprint(worldStateAggregate.payload) as `sha256:${string}`,
    worldState: worldStateAggregate.payload
  });
  assert.equal(adapterResult.ok, true);
  if (!adapterResult.ok) throw new Error("real map adapter rejected example state");
  const simulationResult = adapterResult.value;
  const op = await operation(repository, campaign, "simulation_commit", batch.batchFingerprint);
  const writerLease = ok(await repository.acquireWriterLease(campaign.campaignId, id<WriterId>("writer-simulation-commit"), 120_000));
  const eventId = id<EventId>("event-world-simulated-3600");
  const prepared = await prepareTemporalSegmentCommitV1({
    campaign,
    operation: op,
    writerLease,
    clockAggregate,
    scheduleAggregate,
    scheduleAggregateId: aggregateIds.schedule,
    simulationCursorAggregate: cursorAggregate,
    simulationCursorAggregateId: aggregateIds.cursor,
    worldStateAggregate,
    worldStateAggregateId: aggregateIds.world,
    simulationResult,
    processAggregate,
    processAggregateId: aggregateIds.process,
    nextProcess: await processState({
      revision: 1,
      expectedCampaignRevision: campaign.campaignRevision + 1,
      lastEventId: eventId,
      phase: "WORLD_CAUGHT_UP"
    }),
    batch,
    resolutions: [{
      taskId: task.taskId,
      outcome: "RESOLVED",
      eventId,
      eventType: "world.simulation-advanced",
      origin: "WORLD_SIMULATION",
      visibility: { scope: "SYSTEM", actorIds: [] },
      payload: { hoursProcessed: 1 }
    }],
    newEffects: [],
    commitId: id<CommitId>("commit-world-simulated-3600"),
    commandId: id<CommandId>("command-world-simulated-3600")
  });
  assert.equal(prepared.ok, true, prepared.ok ? undefined : prepared.diagnostics.map(value => value.code).join(","));
  if (!prepared.ok) throw new Error("valid simulation result rejected");
  ok(await repository.commit(prepared.value));
  const storedClock = ok(await repository.getAggregate(campaign.campaignId, "world.clock", campaign.clockAggregateId));
  assert.equal(storedClock.payload.elapsedGameSeconds, 3_600);
  const storedCursor = validateWorldSimulationCursorPayloadV1(ok(await repository.getAggregate(campaign.campaignId, "world.simulation-cursor", aggregateIds.cursor)).payload);
  assert.equal(storedCursor.ok, true);
  if (storedCursor.ok) assert.equal(storedCursor.value.tick, 1);
  const storedWorld = ok(await repository.getAggregate(campaign.campaignId, "world.state", aggregateIds.world));
  assert.deepEqual(storedWorld.payload, simulationResult.worldState);
  console.log(`PASS [${harness.name}] validated map output, cursor and CampaignClock publish in one commit`);
}

export interface TemporalPersistenceRun {
  harness: string;
  passed: number;
  failed: number;
  failures: Array<{ name: string; message: string }>;
}

export async function runTemporalPersistenceTests(
  harness: TemporalPersistenceHarness = memoryHarness
): Promise<TemporalPersistenceRun> {
  const cases = [
    { name: "01 atomic temporal segment and replay", run: () => successfulScenario(harness) },
    { name: "02 injected failure rollback", run: () => failureScenario(harness) },
    { name: "03 persisted payload validation", run: () => payloadValidationScenario(harness) },
    { name: "04 simulation adapter guard", run: () => simulationGuardScenario(harness) },
    { name: "05 atomic simulation publication", run: () => simulationCommitScenario(harness) }
  ];
  const failures: TemporalPersistenceRun["failures"] = [];
  for (const entry of cases) {
    try {
      await entry.run();
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      failures.push({ name: entry.name, message });
      console.error(`FAIL [${harness.name}] ${entry.name}`);
      console.error(error);
    }
  }
  await harness.dispose?.();
  return { harness: harness.name, passed: cases.length - failures.length, failed: failures.length, failures };
}

const executedDirectly = typeof process !== "undefined" &&
  process.argv.some(argument => argument.replaceAll("\\", "/").endsWith("tests/time/verify-temporal-persistence.ts"));

if (executedDirectly) {
  void runTemporalPersistenceTests().then(result => {
    if (result.failed > 0) process.exitCode = 1;
  });
}
