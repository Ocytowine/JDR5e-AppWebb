import { canonicalizeJson, cloneJson, computeJsonFingerprint } from "../core/canonical-json/canonicalJson";
import type { JsonObject } from "../core/contracts/types";
import type {
  TemporalBatchV1,
  TemporalBoundaryPolicyV1,
  TemporalDiagnosticCodeV1,
  TemporalDiagnosticV1,
  TemporalResultV1,
  TemporalTaskV1,
  ScheduledEffectV1,
  TimeAdvanceProposalV1,
  ValidatedTimeAdvanceV1
} from "./types";

const BOUNDARY_PRIORITY: Record<TemporalBoundaryPolicyV1, number> = {
  BEFORE_ACTIVITY_COMPLETION: 0,
  SIMULTANEOUS: 1,
  AFTER_ACTIVITY_COMPLETION: 2
};
const PROPOSAL_KEYS = [
  "schemaVersion", "proposalId", "campaignId", "requesterDomain", "category", "observedAtGameSecond",
  "duration", "source", "cause", "processId", "interruptible", "dependencies"
].sort();
const TASK_KEYS = [
  "schemaVersion", "taskId", "taskKind", "dueAtGameSecond", "boundaryPolicy", "dependsOnTaskIds", "payload"
].sort();
const TIME_CATEGORIES = new Set(["FIXED_RULE", "DETERMINISTIC_CALCULATION", "OPEN_ESTIMATE", "PROCESS_SEGMENT", "NO_GAME_TIME"]);
const TASK_KINDS = new Set(["SCHEDULED_EFFECT", "WORLD_SIMULATION_BOUNDARY", "PROCESS_BOUNDARY", "ACTIVITY_COMPLETION"]);
const EFFECT_KEYS = [
  "schemaVersion", "effectId", "campaignId", "ownerDomain", "effectType", "dueAtGameSecond", "boundaryPolicy",
  "dependsOnEffectIds", "causedByEventIds", "status", "payloadSchemaVersion", "payload"
].sort();

function diagnostic(
  diagnostics: TemporalDiagnosticV1[],
  code: TemporalDiagnosticCodeV1,
  path: string,
  details: JsonObject = {}
): void {
  diagnostics.push({ code, path, details });
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function exactKeys(value: object, expected: string[]): boolean {
  return Object.keys(value).sort().join("|") === expected.join("|");
}

export function validateTimeAdvanceProposalV1(
  proposal: TimeAdvanceProposalV1,
  currentGameSecond: number
): TemporalResultV1<ValidatedTimeAdvanceV1> {
  const diagnostics: TemporalDiagnosticV1[] = [];
  try {
    canonicalizeJson(proposal);
  } catch (error) {
    diagnostic(diagnostics, "TIME_PROPOSAL_INVALID", "/", {
      issue: error instanceof Error ? error.message : "invalid JSON"
    });
    return { ok: false, diagnostics };
  }
  if (
    proposal.schemaVersion !== 1 || !exactKeys(proposal, PROPOSAL_KEYS) || !TIME_CATEGORIES.has(proposal.category) ||
    !nonEmpty(proposal.proposalId) || !nonEmpty(proposal.campaignId) ||
    !nonEmpty(proposal.requesterDomain) || !nonEmpty(proposal.cause?.id) ||
    !nonNegativeInteger(proposal.observedAtGameSecond) || !nonNegativeInteger(currentGameSecond)
  ) diagnostic(diagnostics, "TIME_PROPOSAL_INVALID", "/", { issue: "invalid proposal envelope" });
  if (proposal.observedAtGameSecond !== currentGameSecond) {
    diagnostic(diagnostics, "TIME_PROPOSAL_STALE", "/observedAtGameSecond", {
      observed: proposal.observedAtGameSecond,
      current: currentGameSecond
    });
  }
  const { recommendedSeconds, minimumSeconds, maximumSeconds } = proposal.duration;
  const integerDurations = [recommendedSeconds, minimumSeconds, maximumSeconds].every(nonNegativeInteger);
  const exact = recommendedSeconds === minimumSeconds && minimumSeconds === maximumSeconds;
  if (!integerDurations) {
    diagnostic(diagnostics, "TIME_PROPOSAL_INVALID", "/duration", { issue: "durations must be non-negative integers" });
  } else if (proposal.category === "NO_GAME_TIME") {
    if (!exact || recommendedSeconds !== 0 || proposal.source.kind !== "NONE") {
      diagnostic(diagnostics, "TIME_PROPOSAL_INVALID", "/duration", { issue: "NO_GAME_TIME requires zero duration and NONE source" });
    }
  } else if (proposal.category === "OPEN_ESTIMATE") {
    if (!positiveInteger(minimumSeconds) || minimumSeconds > recommendedSeconds || recommendedSeconds > maximumSeconds) {
      diagnostic(diagnostics, "TIME_PROPOSAL_INVALID", "/duration", { issue: "estimate must satisfy 0 < minimum <= recommended <= maximum" });
    }
  } else if (!exact || !positiveInteger(recommendedSeconds)) {
    diagnostic(diagnostics, "TIME_PROPOSAL_INVALID", "/duration", { issue: "category requires an exact positive duration" });
  }
  if (proposal.category !== "NO_GAME_TIME" && (
    proposal.source.kind === "NONE" || !nonEmpty(proposal.source.id) || !positiveInteger(proposal.source.version ?? 0)
  )) diagnostic(diagnostics, "TIME_PROPOSAL_INVALID", "/source", { issue: "timed proposal requires a versioned source" });
  const dependencyKeys = proposal.dependencies.map(value => `${value.aggregateType}\u0000${value.aggregateId}`);
  if (new Set(dependencyKeys).size !== dependencyKeys.length || proposal.dependencies.some(value =>
    !nonEmpty(value.aggregateType) || !nonEmpty(value.aggregateId) || !nonNegativeInteger(value.aggregateRevision))) {
    diagnostic(diagnostics, "TIME_PROPOSAL_INVALID", "/dependencies", { issue: "dependencies must be valid and unique" });
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      proposalId: proposal.proposalId,
      campaignId: proposal.campaignId,
      currentGameSecond,
      durationSeconds: recommendedSeconds,
      targetGameSecond: currentGameSecond + recommendedSeconds,
      category: proposal.category,
      interruptible: proposal.interruptible,
      processId: proposal.processId
    }
  };
}

export function scheduledEffectToTaskV1(
  effect: ScheduledEffectV1,
  currentGameSecond: number
): TemporalResultV1<TemporalTaskV1> {
  const diagnostics: TemporalDiagnosticV1[] = [];
  try {
    canonicalizeJson(effect);
  } catch (error) {
    diagnostic(diagnostics, "TEMPORAL_TASK_INVALID", "/effect", {
      issue: error instanceof Error ? error.message : "invalid JSON"
    });
    return { ok: false, diagnostics };
  }
  if (
    effect.schemaVersion !== 1 || !exactKeys(effect, EFFECT_KEYS) || !nonEmpty(effect.effectId) ||
    !nonEmpty(effect.campaignId) || !nonEmpty(effect.ownerDomain) || !nonEmpty(effect.effectType) ||
    !nonNegativeInteger(effect.dueAtGameSecond) || !(effect.boundaryPolicy in BOUNDARY_PRIORITY) ||
    effect.status !== "SCHEDULED" || !positiveInteger(effect.payloadSchemaVersion) ||
    new Set(effect.dependsOnEffectIds).size !== effect.dependsOnEffectIds.length ||
    new Set(effect.causedByEventIds).size !== effect.causedByEventIds.length ||
    effect.dependsOnEffectIds.some(id => !nonEmpty(id)) || effect.causedByEventIds.some(id => !nonEmpty(id))
  ) diagnostic(diagnostics, "TEMPORAL_TASK_INVALID", "/effect", { effectId: effect.effectId });
  if (effect.dueAtGameSecond < currentGameSecond) {
    diagnostic(diagnostics, "TEMPORAL_TASK_PAST", "/effect/dueAtGameSecond", {
      effectId: effect.effectId,
      dueAtGameSecond: effect.dueAtGameSecond,
      currentGameSecond
    });
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      taskId: effect.effectId,
      taskKind: "SCHEDULED_EFFECT",
      dueAtGameSecond: effect.dueAtGameSecond,
      boundaryPolicy: effect.boundaryPolicy,
      dependsOnTaskIds: [...effect.dependsOnEffectIds].sort(),
      payload: {
        effectId: effect.effectId,
        ownerDomain: effect.ownerDomain,
        effectType: effect.effectType,
        causedByEventIds: [...effect.causedByEventIds].sort(),
        payloadSchemaVersion: effect.payloadSchemaVersion,
        payload: cloneJson(effect.payload)
      }
    }
  };
}

function taskOrder(left: TemporalTaskV1, right: TemporalTaskV1): number {
  return BOUNDARY_PRIORITY[left.boundaryPolicy] - BOUNDARY_PRIORITY[right.boundaryPolicy] || left.taskId.localeCompare(right.taskId);
}

export async function planNextTemporalBatchV1(input: {
  batchId: string;
  currentGameSecond: number;
  requestedTargetGameSecond: number;
  tasks: TemporalTaskV1[];
  resolvedTaskIds?: ReadonlySet<string>;
}): Promise<TemporalResultV1<TemporalBatchV1 | null>> {
  const diagnostics: TemporalDiagnosticV1[] = [];
  if (!nonEmpty(input.batchId) || !nonNegativeInteger(input.currentGameSecond) ||
      !nonNegativeInteger(input.requestedTargetGameSecond) || input.requestedTargetGameSecond < input.currentGameSecond) {
    diagnostic(diagnostics, "TEMPORAL_WINDOW_INVALID", "/", { issue: "invalid temporal window" });
    return { ok: false, diagnostics };
  }
  const byId = new Map<string, TemporalTaskV1>();
  input.tasks.forEach((task, index) => {
    try {
      canonicalizeJson(task);
    } catch (error) {
      diagnostic(diagnostics, "TEMPORAL_TASK_INVALID", `/tasks/${index}`, {
        issue: error instanceof Error ? error.message : "invalid JSON"
      });
      return;
    }
    if (task.schemaVersion !== 1 || !exactKeys(task, TASK_KEYS) || !nonEmpty(task.taskId) ||
        !TASK_KINDS.has(task.taskKind) || !nonNegativeInteger(task.dueAtGameSecond) ||
        !(task.boundaryPolicy in BOUNDARY_PRIORITY) || byId.has(task.taskId) ||
        new Set(task.dependsOnTaskIds).size !== task.dependsOnTaskIds.length || task.dependsOnTaskIds.some(id => !nonEmpty(id))) {
      diagnostic(diagnostics, "TEMPORAL_TASK_INVALID", `/tasks/${index}`, { taskId: task.taskId });
      return;
    }
    if (task.dueAtGameSecond < input.currentGameSecond) {
      diagnostic(diagnostics, "TEMPORAL_TASK_PAST", `/tasks/${index}/dueAtGameSecond`, { taskId: task.taskId });
    }
    const normalized = cloneJson(task);
    normalized.dependsOnTaskIds.sort();
    byId.set(task.taskId, normalized);
  });
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  const eligible = [...byId.values()].filter(task => task.dueAtGameSecond <= input.requestedTargetGameSecond);
  if (eligible.length === 0) return { ok: true, value: null };
  const effectiveAt = Math.min(...eligible.map(task => task.dueAtGameSecond));
  const selected = eligible.filter(task => task.dueAtGameSecond === effectiveAt);
  const selectedIds = new Set(selected.map(task => task.taskId));
  const resolved = input.resolvedTaskIds ?? new Set<string>();
  selected.forEach((task, index) => task.dependsOnTaskIds.forEach(dependencyId => {
    if (!selectedIds.has(dependencyId) && !resolved.has(dependencyId)) {
      diagnostic(diagnostics, "TEMPORAL_DEPENDENCY_MISSING", `/tasks/${index}/dependsOnTaskIds`, {
        taskId: task.taskId, dependencyId
      });
    }
  }));
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const indegree = new Map(selected.map(task => [task.taskId, 0]));
  const dependents = new Map(selected.map(task => [task.taskId, [] as string[]]));
  selected.forEach(task => task.dependsOnTaskIds.filter(id => selectedIds.has(id)).forEach(dependencyId => {
    indegree.set(task.taskId, indegree.get(task.taskId)! + 1);
    dependents.get(dependencyId)!.push(task.taskId);
  }));
  const ready = selected.filter(task => indegree.get(task.taskId) === 0).sort(taskOrder);
  const ordered: TemporalTaskV1[] = [];
  while (ready.length > 0) {
    const task = ready.shift()!;
    ordered.push(task);
    dependents.get(task.taskId)!.sort().forEach(id => {
      indegree.set(id, indegree.get(id)! - 1);
      if (indegree.get(id) === 0) {
        ready.push(byId.get(id)!);
        ready.sort(taskOrder);
      }
    });
  }
  if (ordered.length !== selected.length) {
    diagnostic(diagnostics, "TEMPORAL_DEPENDENCY_CYCLE", "/tasks", {
      taskIds: selected.filter(task => !ordered.some(value => value.taskId === task.taskId)).map(task => task.taskId).sort()
    });
    return { ok: false, diagnostics };
  }
  const fingerprintPayload = {
    schemaVersion: 1 as const,
    batchId: input.batchId,
    currentGameSecond: input.currentGameSecond,
    requestedTargetGameSecond: input.requestedTargetGameSecond,
    effectiveAtGameSecond: effectiveAt,
    orderedTasks: ordered
  };
  return {
    ok: true,
    value: {
      ...fingerprintPayload,
      batchFingerprint: await computeJsonFingerprint(fingerprintPayload) as `sha256:${string}`
    }
  };
}

export function nextWorldSimulationBoundaryV1(input: {
  worldSimulatedThrough: number;
  requestedTargetGameSecond: number;
  secondsPerMicroTick?: number;
}): TemporalResultV1<number | null> {
  const secondsPerMicroTick = input.secondsPerMicroTick ?? 3_600;
  const diagnostics: TemporalDiagnosticV1[] = [];
  if (!nonNegativeInteger(input.worldSimulatedThrough) || !nonNegativeInteger(input.requestedTargetGameSecond) ||
      !positiveInteger(secondsPerMicroTick) || input.worldSimulatedThrough % secondsPerMicroTick !== 0) {
    diagnostic(diagnostics, "TEMPORAL_WINDOW_INVALID", "/simulation", { issue: "invalid simulation cursor or step" });
    return { ok: false, diagnostics };
  }
  const next = input.worldSimulatedThrough + secondsPerMicroTick;
  return { ok: true, value: next <= input.requestedTargetGameSecond ? next : null };
}
