import { opaqueId, type CampaignId } from "../../src/core/index";
import {
  nextWorldSimulationBoundaryV1,
  planNextTemporalBatchV1,
  scheduledEffectToTaskV1,
  validateTimeAdvanceProposalV1,
  type TemporalTaskV1,
  type TimeAdvanceProposalV1
} from "../../src/time";
import { assert } from "../contracts/assertions";

const campaignId = opaqueId<CampaignId>("campaign-temporal-test");

function proposal(overrides: Partial<TimeAdvanceProposalV1> = {}): TimeAdvanceProposalV1 {
  return {
    schemaVersion: 1,
    proposalId: "time-proposal-001",
    campaignId,
    requesterDomain: "travel",
    category: "FIXED_RULE",
    observedAtGameSecond: 120,
    duration: { recommendedSeconds: 60, minimumSeconds: 60, maximumSeconds: 60 },
    source: { kind: "RULE", id: "rule.travel.segment", version: 1 },
    cause: { kind: "OPERATION", id: "operation-travel-001" },
    processId: "process-travel-001",
    interruptible: true,
    dependencies: [{ aggregateType: "world.position", aggregateId: "position-player", aggregateRevision: 2 }],
    ...overrides
  };
}

function task(
  taskId: string,
  boundaryPolicy: TemporalTaskV1["boundaryPolicy"],
  dependsOnTaskIds: string[] = [],
  dueAtGameSecond = 3_600
): TemporalTaskV1 {
  return {
    schemaVersion: 1,
    taskId,
    taskKind: "SCHEDULED_EFFECT",
    dueAtGameSecond,
    boundaryPolicy,
    dependsOnTaskIds,
    payload: { taskId }
  };
}

function expectCode(result: { ok: boolean; diagnostics?: Array<{ code: string }> }, code: string): void {
  assert.equal(result.ok, false, `Expected ${code}.`);
  assert.ok(result.diagnostics?.some(value => value.code === code), `Missing ${code}.`);
}

async function run(): Promise<void> {
  const fixed = validateTimeAdvanceProposalV1(proposal(), 120);
  assert.equal(fixed.ok, true);
  if (fixed.ok) {
    assert.equal(fixed.value.durationSeconds, 60);
    assert.equal(fixed.value.targetGameSecond, 180);
  }
  const noTime = validateTimeAdvanceProposalV1(proposal({
    category: "NO_GAME_TIME",
    duration: { recommendedSeconds: 0, minimumSeconds: 0, maximumSeconds: 0 },
    source: { kind: "NONE", id: null, version: null },
    processId: null,
    interruptible: false
  }), 120);
  assert.equal(noTime.ok, true);
  if (noTime.ok) assert.equal(noTime.value.targetGameSecond, 120);
  expectCode(validateTimeAdvanceProposalV1(proposal(), 121), "TIME_PROPOSAL_STALE");
  expectCode(validateTimeAdvanceProposalV1(proposal({
    category: "OPEN_ESTIMATE",
    duration: { minimumSeconds: 90, recommendedSeconds: 60, maximumSeconds: 120 },
    source: { kind: "ADJUDICATION", id: "adj-duration-001", version: 1 }
  }), 120), "TIME_PROPOSAL_INVALID");
  console.log("PASS [temporal-kernel] exact, no-time, stale and invalid proposals are distinguished");

  const scheduled = scheduledEffectToTaskV1({
    schemaVersion: 1,
    effectId: "effect-weather-warning",
    campaignId,
    ownerDomain: "world",
    effectType: "weather.warning",
    dueAtGameSecond: 3_600,
    boundaryPolicy: "BEFORE_ACTIVITY_COMPLETION",
    dependsOnEffectIds: [],
    causedByEventIds: ["event-weather-formed"],
    status: "SCHEDULED",
    payloadSchemaVersion: 1,
    payload: { intensity: 2 }
  }, 0);
  assert.equal(scheduled.ok, true);
  if (scheduled.ok) {
    assert.equal(scheduled.value.taskId, "effect-weather-warning");
    assert.equal(scheduled.value.taskKind, "SCHEDULED_EFFECT");
  }
  expectCode(scheduledEffectToTaskV1({
    schemaVersion: 1,
    effectId: "effect-past",
    campaignId,
    ownerDomain: "world",
    effectType: "weather.past",
    dueAtGameSecond: 119,
    boundaryPolicy: "SIMULTANEOUS",
    dependsOnEffectIds: [],
    causedByEventIds: [],
    status: "SCHEDULED",
    payloadSchemaVersion: 1,
    payload: {}
  }, 120), "TEMPORAL_TASK_PAST");
  console.log("PASS [temporal-kernel] scheduled effects become validated tasks without retroactive insertion");

  const tasks = [
    task("task-after", "AFTER_ACTIVITY_COMPLETION"),
    task("task-simultaneous", "SIMULTANEOUS", ["task-before"]),
    task("task-before", "BEFORE_ACTIVITY_COMPLETION"),
    task("task-later", "BEFORE_ACTIVITY_COMPLETION", [], 7_200)
  ];
  const first = await planNextTemporalBatchV1({
    batchId: "batch-001",
    currentGameSecond: 0,
    requestedTargetGameSecond: 7_200,
    tasks
  });
  const reversed = await planNextTemporalBatchV1({
    batchId: "batch-001",
    currentGameSecond: 0,
    requestedTargetGameSecond: 7_200,
    tasks: [...tasks].reverse()
  });
  assert.equal(first.ok, true);
  assert.deepEqual(first, reversed);
  if (first.ok && first.value) {
    assert.equal(first.value.effectiveAtGameSecond, 3_600);
    assert.deepEqual(first.value.orderedTasks.map(value => value.taskId), [
      "task-before", "task-simultaneous", "task-after"
    ]);
    assert.ok(/^sha256:[0-9a-f]{64}$/.test(first.value.batchFingerprint));
  }
  console.log("PASS [temporal-kernel] NAR-ACC-020 ordering is causal, stable and enumeration-independent");

  const causalPriority = await planNextTemporalBatchV1({
    batchId: "batch-causal-priority",
    currentGameSecond: 0,
    requestedTargetGameSecond: 3_600,
    tasks: [
      task("task-parent-after", "AFTER_ACTIVITY_COMPLETION"),
      task("task-child-before", "BEFORE_ACTIVITY_COMPLETION", ["task-parent-after"])
    ]
  });
  assert.equal(causalPriority.ok, true);
  if (causalPriority.ok && causalPriority.value) {
    assert.deepEqual(causalPriority.value.orderedTasks.map(value => value.taskId), ["task-parent-after", "task-child-before"]);
  }

  expectCode(await planNextTemporalBatchV1({
    batchId: "batch-cycle",
    currentGameSecond: 0,
    requestedTargetGameSecond: 3_600,
    tasks: [task("task-a", "SIMULTANEOUS", ["task-b"]), task("task-b", "SIMULTANEOUS", ["task-a"])]
  }), "TEMPORAL_DEPENDENCY_CYCLE");
  expectCode(await planNextTemporalBatchV1({
    batchId: "batch-missing",
    currentGameSecond: 0,
    requestedTargetGameSecond: 3_600,
    tasks: [task("task-a", "SIMULTANEOUS", ["missing-task"])]
  }), "TEMPORAL_DEPENDENCY_MISSING");
  expectCode(await planNextTemporalBatchV1({
    batchId: "batch-past",
    currentGameSecond: 10,
    requestedTargetGameSecond: 3_600,
    tasks: [task("task-past", "SIMULTANEOUS", [], 9)]
  }), "TEMPORAL_TASK_PAST");
  console.log("PASS [temporal-kernel] cycles, missing dependencies and retroactive tasks are rejected");

  assert.deepEqual(nextWorldSimulationBoundaryV1({ worldSimulatedThrough: 0, requestedTargetGameSecond: 3_599 }), { ok: true, value: null });
  assert.deepEqual(nextWorldSimulationBoundaryV1({ worldSimulatedThrough: 0, requestedTargetGameSecond: 3_600 }), { ok: true, value: 3_600 });
  assert.deepEqual(nextWorldSimulationBoundaryV1({ worldSimulatedThrough: 18_000, requestedTargetGameSecond: 21_600 }), { ok: true, value: 21_600 });
  expectCode(nextWorldSimulationBoundaryV1({ worldSimulatedThrough: 1, requestedTargetGameSecond: 3_600 }), "TEMPORAL_WINDOW_INVALID");
  console.log("PASS [temporal-kernel] map simulation boundaries derive from CampaignClock in exact hours");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
