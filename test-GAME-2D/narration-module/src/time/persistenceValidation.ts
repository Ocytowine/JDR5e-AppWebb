import { canonicalizeJson, cloneJson, computeJsonFingerprint } from "../core/canonical-json/canonicalJson";
import type { JsonObject } from "../core/contracts/types";
import type {
  CreateProcessStateInputV1,
  ProcessStatePayloadV1,
  WorldSchedulePayloadV1,
  WorldSimulationCursorPayloadV1
} from "./persistenceTypes";
import type { ScheduledEffectV1, TemporalDiagnosticV1, TemporalResultV1 } from "./types";

const PROCESS_STATUSES = new Set([
  "ACTIVE", "SUSPENDED", "COMPLETED_PENDING_INTEGRATION", "COMPLETED", "CANCELLED", "FAILED_WITHOUT_COMMIT"
]);
const EFFECT_STATUSES = new Set(["SCHEDULED", "RESOLVED", "CANCELLED", "EXPIRED"]);
const BOUNDARIES = new Set(["BEFORE_ACTIVITY_COMPLETION", "SIMULTANEOUS", "AFTER_ACTIVITY_COMPLETION"]);

function add(diagnostics: TemporalDiagnosticV1[], path: string, issue: string, details: JsonObject = {}): void {
  diagnostics.push({ code: "TEMPORAL_PERSISTENCE_INVALID", path, details: { issue, ...details } });
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function json(value: unknown, diagnostics: TemporalDiagnosticV1[], path: string): boolean {
  try {
    canonicalizeJson(value);
    return true;
  } catch (error) {
    add(diagnostics, path, error instanceof Error ? error.message : "invalid JSON");
    return false;
  }
}

function validateEffect(effect: ScheduledEffectV1, index: number, diagnostics: TemporalDiagnosticV1[]): void {
  const path = `/effects/${index}`;
  if (!json(effect, diagnostics, path)) return;
  if (
    effect.schemaVersion !== 1 || !nonEmpty(effect.effectId) || !nonEmpty(effect.campaignId) ||
    !nonEmpty(effect.ownerDomain) || !nonEmpty(effect.effectType) || !nonNegativeInteger(effect.dueAtGameSecond) ||
    !BOUNDARIES.has(effect.boundaryPolicy) || !EFFECT_STATUSES.has(effect.status) ||
    !positiveInteger(effect.payloadSchemaVersion)
  ) add(diagnostics, path, "invalid scheduled effect envelope", { effectId: effect.effectId });
  if (new Set(effect.dependsOnEffectIds).size !== effect.dependsOnEffectIds.length ||
      new Set(effect.causedByEventIds).size !== effect.causedByEventIds.length ||
      effect.dependsOnEffectIds.some(id => !nonEmpty(id)) || effect.causedByEventIds.some(id => !nonEmpty(id))) {
    add(diagnostics, `${path}/dependencies`, "effect dependencies and causes must be unique non-empty ids");
  }
}

export function validateWorldSchedulePayloadV1(value: unknown): TemporalResultV1<WorldSchedulePayloadV1> {
  const diagnostics: TemporalDiagnosticV1[] = [];
  if (!json(value, diagnostics, "/")) return { ok: false, diagnostics };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    add(diagnostics, "/", "schedule must be an object");
    return { ok: false, diagnostics };
  }
  const candidate = value as Partial<WorldSchedulePayloadV1>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.effects) ||
      Object.keys(value).sort().join("|") !== "effects|schemaVersion") {
    add(diagnostics, "/", "invalid schedule envelope");
    return { ok: false, diagnostics };
  }
  candidate.effects.forEach((effect, index) => validateEffect(effect, index, diagnostics));
  const ids = candidate.effects.map(effect => effect.effectId);
  if (new Set(ids).size !== ids.length) add(diagnostics, "/effects", "effect ids must be unique");
  const byId = new Map(candidate.effects.map(effect => [effect.effectId, effect]));
  candidate.effects.forEach((effect, index) => effect.dependsOnEffectIds.forEach(dependencyId => {
    if (!byId.has(dependencyId)) add(diagnostics, `/effects/${index}/dependsOnEffectIds`, "dependency is absent", { dependencyId });
  }));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const cyclic = (byId.get(id)?.dependsOnEffectIds ?? []).some(visit);
    visiting.delete(id);
    visited.add(id);
    return cyclic;
  };
  if (ids.some(visit)) add(diagnostics, "/effects", "effect dependency graph contains a cycle");
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  const effects = cloneJson(candidate.effects).sort((left, right) => left.effectId.localeCompare(right.effectId));
  effects.forEach(effect => {
    effect.dependsOnEffectIds.sort();
    effect.causedByEventIds.sort();
  });
  return { ok: true, value: { schemaVersion: 1, effects } };
}

export function validateWorldSimulationCursorPayloadV1(value: unknown): TemporalResultV1<WorldSimulationCursorPayloadV1> {
  const diagnostics: TemporalDiagnosticV1[] = [];
  if (!json(value, diagnostics, "/")) return { ok: false, diagnostics };
  const candidate = value as Partial<WorldSimulationCursorPayloadV1>;
  const expectedKeys = "macroTick|microPerMacro|microTick|schemaVersion|secondsPerMicroTick|tick|worldSimulatedThrough";
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== expectedKeys ||
      candidate.schemaVersion !== 1 || !nonNegativeInteger(candidate.worldSimulatedThrough) ||
      !nonNegativeInteger(candidate.tick) || !nonNegativeInteger(candidate.microTick) ||
      !nonNegativeInteger(candidate.macroTick) || !positiveInteger(candidate.secondsPerMicroTick) ||
      !positiveInteger(candidate.microPerMacro) || candidate.microTick >= candidate.microPerMacro ||
      candidate.worldSimulatedThrough !== candidate.tick * candidate.secondsPerMicroTick ||
      candidate.macroTick !== Math.floor(candidate.tick / candidate.microPerMacro) ||
      candidate.microTick !== candidate.tick % candidate.microPerMacro) {
    add(diagnostics, "/", "simulation cursor is internally inconsistent");
  }
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, value: cloneJson(candidate as WorldSimulationCursorPayloadV1) };
}

export async function createProcessStatePayloadV1(input: CreateProcessStateInputV1): Promise<TemporalResultV1<ProcessStatePayloadV1>> {
  const diagnostics: TemporalDiagnosticV1[] = [];
  if (!json(input, diagnostics, "/")) return { ok: false, diagnostics };
  if (!nonEmpty(input.processId) || !nonEmpty(input.processType) || !nonEmpty(input.ownerDomain) ||
      !PROCESS_STATUSES.has(input.status) || !nonNegativeInteger(input.checkpointRevision) ||
      !nonNegativeInteger(input.expectedCampaignRevision) || !positiveInteger(input.stateSchemaVersion) ||
      (input.lastAppliedEventId !== null && !nonEmpty(input.lastAppliedEventId))) {
    add(diagnostics, "/", "invalid process checkpoint envelope");
    return { ok: false, diagnostics };
  }
  const checkpoint = {
    schemaVersion: 1 as const,
    processId: input.processId,
    processType: input.processType,
    ownerDomain: input.ownerDomain,
    status: input.status,
    checkpointRevision: input.checkpointRevision,
    lastAppliedEventId: input.lastAppliedEventId,
    expectedCampaignRevision: input.expectedCampaignRevision,
    stateSchemaVersion: input.stateSchemaVersion,
    state: cloneJson(input.state),
    pendingDecision: input.pendingDecision === null ? null : cloneJson(input.pendingDecision)
  };
  return {
    ok: true,
    value: {
      ...checkpoint,
      checkpointFingerprint: await computeJsonFingerprint(checkpoint) as `sha256:${string}`
    }
  };
}

export async function validateProcessStatePayloadV1(value: unknown): Promise<TemporalResultV1<ProcessStatePayloadV1>> {
  const diagnostics: TemporalDiagnosticV1[] = [];
  if (!json(value, diagnostics, "/")) return { ok: false, diagnostics };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    add(diagnostics, "/", "process state must be an object");
    return { ok: false, diagnostics };
  }
  const candidate = value as ProcessStatePayloadV1;
  const expectedKeys = [
    "schemaVersion", "processId", "processType", "ownerDomain", "status", "checkpointRevision",
    "checkpointFingerprint", "lastAppliedEventId", "expectedCampaignRevision", "stateSchemaVersion", "state", "pendingDecision"
  ].sort().join("|");
  if (Object.keys(value).sort().join("|") !== expectedKeys || candidate.schemaVersion !== 1) {
    add(diagnostics, "/", "invalid process state envelope");
    return { ok: false, diagnostics };
  }
  const rebuilt = await createProcessStatePayloadV1(candidate);
  if (!rebuilt.ok) return rebuilt;
  if (rebuilt.value.checkpointFingerprint !== candidate.checkpointFingerprint) {
    add(diagnostics, "/checkpointFingerprint", "checkpoint fingerprint mismatch");
    return { ok: false, diagnostics };
  }
  return { ok: true, value: cloneJson(candidate) };
}
