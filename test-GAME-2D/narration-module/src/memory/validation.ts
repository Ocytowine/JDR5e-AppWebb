import type {
  ContextPerspectiveV1,
  MemoryAnchorV1,
  MemoryCapsuleV1,
  MemoryIndexEntryV1,
  MemoryRecallQueryV1,
  MemorySourceRefV1,
  MemoryUnitV1,
  MemoryVisibilityV1
} from "./types";

export type MemoryValidationResult = { ok: true } | { ok: false; issues: string[] };

function issue(path: string, message: string): string {
  return `${path}: ${message}`;
}

function isSha(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === "string" && entry.length > 0);
}

export function canExposeMemoryToPerspective(
  visibility: MemoryVisibilityV1,
  actorScope: string[],
  perspective: ContextPerspectiveV1
): boolean {
  if (perspective.kind === "SYSTEM_MJ" || perspective.kind === "DIAGNOSTIC") return true;
  if (visibility === "SYSTEM_ONLY" || visibility === "DIAGNOSTIC") return false;
  if (visibility === "PLAYER_META") return perspective.kind === "PLAYER_META";
  if (visibility === "PLAYER_CHARACTER") return perspective.kind === "PLAYER_CHARACTER";
  if (visibility === "ACTOR_SCOPED") {
    if (perspective.kind !== "PLAYER_CHARACTER" && perspective.kind !== "NPC") return false;
    return actorScope.includes(perspective.actorId);
  }
  return false;
}

export function sameSourceRef(left: MemorySourceRefV1, right: MemorySourceRefV1): boolean {
  return left.sourceKind === right.sourceKind &&
    left.sourceId === right.sourceId &&
    left.campaignId === right.campaignId &&
    left.ownerDomain === right.ownerDomain &&
    left.version === right.version &&
    left.path === right.path;
}

export function validateMemorySourceRefV1(value: unknown, path = "sourceRef"): MemoryValidationResult {
  if (!isObject(value)) return { ok: false, issues: [issue(path, "expected object")] };
  const ref = value as Partial<MemorySourceRefV1>;
  const issues: string[] = [];
  if (ref.schemaVersion !== 1) issues.push(issue(`${path}.schemaVersion`, "expected 1"));
  if (typeof ref.sourceKind !== "string") issues.push(issue(`${path}.sourceKind`, "expected string"));
  if (typeof ref.sourceId !== "string" || ref.sourceId.length === 0) issues.push(issue(`${path}.sourceId`, "required"));
  if (ref.campaignId !== null && typeof ref.campaignId !== "string") issues.push(issue(`${path}.campaignId`, "expected string or null"));
  if (typeof ref.ownerDomain !== "string" || ref.ownerDomain.length === 0) issues.push(issue(`${path}.ownerDomain`, "required"));
  if (typeof ref.version !== "string" && typeof ref.version !== "number") issues.push(issue(`${path}.version`, "expected string or number"));
  if (ref.path !== null && typeof ref.path !== "string") issues.push(issue(`${path}.path`, "expected string or null"));
  if (ref.fingerprint !== null && !isSha(ref.fingerprint)) issues.push(issue(`${path}.fingerprint`, "expected sha256 fingerprint or null"));
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function validateAnchor(anchor: unknown, path: string): string[] {
  if (!isObject(anchor)) return [issue(path, "expected object")];
  const value = anchor as Partial<MemoryAnchorV1>;
  const issues: string[] = [];
  if (typeof value.kind !== "string") issues.push(issue(`${path}.kind`, "expected string"));
  if (typeof value.id !== "string" || value.id.length === 0) issues.push(issue(`${path}.id`, "required"));
  if (value.strength !== "PRIMARY" && value.strength !== "SECONDARY") issues.push(issue(`${path}.strength`, "invalid"));
  return issues;
}

export function validateMemoryUnitV1(value: unknown): MemoryValidationResult {
  if (!isObject(value)) return { ok: false, issues: ["memory: expected object"] };
  const unit = value as Partial<MemoryUnitV1>;
  const issues: string[] = [];
  if (unit.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (typeof unit.memoryId !== "string" || unit.memoryId.length === 0) issues.push(issue("memoryId", "required"));
  if (typeof unit.campaignId !== "string" || unit.campaignId.length === 0) issues.push(issue("campaignId", "required"));
  if (!Array.isArray(unit.sourceRefs) || unit.sourceRefs.length === 0) {
    issues.push(issue("sourceRefs", "at least one source is required"));
  } else {
    unit.sourceRefs.forEach((sourceRef, index) => {
      const result = validateMemorySourceRefV1(sourceRef, `sourceRefs[${index}]`);
      if (!result.ok) issues.push(...result.issues);
    });
  }
  if (typeof unit.unitType !== "string") issues.push(issue("unitType", "required"));
  if (typeof unit.validity !== "string") issues.push(issue("validity", "required"));
  if (typeof unit.recallCycle !== "string") issues.push(issue("recallCycle", "required"));
  if (typeof unit.visibility !== "string") issues.push(issue("visibility", "required"));
  if (!isStringArray(unit.actorScope)) issues.push(issue("actorScope", "expected string array"));
  if (unit.visibility === "ACTOR_SCOPED" && (!Array.isArray(unit.actorScope) || unit.actorScope.length === 0)) {
    issues.push(issue("actorScope", "ACTOR_SCOPED requires at least one actor"));
  }
  if (unit.visibility !== "ACTOR_SCOPED" && Array.isArray(unit.actorScope) && unit.actorScope.length > 0) {
    issues.push(issue("actorScope", "only ACTOR_SCOPED may carry actor scope"));
  }
  if (!Array.isArray(unit.anchors)) {
    issues.push(issue("anchors", "expected array"));
  } else {
    unit.anchors.forEach((anchor, index) => issues.push(...validateAnchor(anchor, `anchors[${index}]`)));
  }
  if (!isObject(unit.importance) ||
    !Number.isInteger(unit.importance.systemic) ||
    !Number.isInteger(unit.importance.narrative) ||
    unit.importance.systemic < 0 ||
    unit.importance.systemic > 100 ||
    unit.importance.narrative < 0 ||
    unit.importance.narrative > 100) {
    issues.push(issue("importance", "systemic and narrative must be integers from 0 to 100"));
  }
  if (!isObject(unit.gameTimeRange)) issues.push(issue("gameTimeRange", "expected object"));
  if (typeof unit.text !== "string" || unit.text.trim().length === 0) issues.push(issue("text", "required"));
  if (unit.summary !== null && typeof unit.summary !== "string") issues.push(issue("summary", "expected string or null"));
  if (!isStringArray(unit.supersedesMemoryIds)) issues.push(issue("supersedesMemoryIds", "expected string array"));
  if (unit.supersededByMemoryId !== null && typeof unit.supersededByMemoryId !== "string") {
    issues.push(issue("supersededByMemoryId", "expected string or null"));
  }
  if (unit.createdByEventId !== null && typeof unit.createdByEventId !== "string") issues.push(issue("createdByEventId", "expected string or null"));
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function validateMemoryIndexEntryV1(value: unknown): MemoryValidationResult {
  if (!isObject(value)) return { ok: false, issues: ["index: expected object"] };
  const entry = value as Partial<MemoryIndexEntryV1>;
  const issues: string[] = [];
  if (entry.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (typeof entry.indexId !== "string" || entry.indexId.length === 0) issues.push(issue("indexId", "required"));
  if (typeof entry.campaignId !== "string" || entry.campaignId.length === 0) issues.push(issue("campaignId", "required"));
  if (typeof entry.memoryId !== "string" || entry.memoryId.length === 0) issues.push(issue("memoryId", "required"));
  if (!Array.isArray(entry.sourceRefs) || entry.sourceRefs.length === 0) issues.push(issue("sourceRefs", "required"));
  if (typeof entry.channel !== "string") issues.push(issue("channel", "required"));
  if (!isStringArray(entry.keys)) issues.push(issue("keys", "expected string array"));
  if (typeof entry.visibility !== "string") issues.push(issue("visibility", "required"));
  if (!isStringArray(entry.actorScope)) issues.push(issue("actorScope", "expected string array"));
  if (typeof entry.recallCycle !== "string") issues.push(issue("recallCycle", "required"));
  if (!isSha(entry.rootFingerprint)) issues.push(issue("rootFingerprint", "expected sha256 fingerprint"));
  if (typeof entry.policyVersion !== "string" || entry.policyVersion.length === 0) issues.push(issue("policyVersion", "required"));
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function validateMemoryRecallQueryV1(value: unknown): MemoryValidationResult {
  if (!isObject(value)) return { ok: false, issues: ["query: expected object"] };
  const query = value as Partial<MemoryRecallQueryV1>;
  const issues: string[] = [];
  if (query.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (typeof query.queryId !== "string" || query.queryId.length === 0) issues.push(issue("queryId", "required"));
  if (typeof query.campaignId !== "string" || query.campaignId.length === 0) issues.push(issue("campaignId", "required"));
  const baseCampaignRevision = query.baseCampaignRevision;
  if (!Number.isInteger(baseCampaignRevision) || (baseCampaignRevision ?? -1) < 0) issues.push(issue("baseCampaignRevision", "expected positive integer"));
  if (!isObject(query.perspective) || typeof query.perspective.kind !== "string") issues.push(issue("perspective", "required"));
  if (!Array.isArray(query.strongTriggers)) issues.push(issue("strongTriggers", "expected array"));
  if (!Array.isArray(query.secondaryTriggers)) issues.push(issue("secondaryTriggers", "expected array"));
  if (!Array.isArray(query.requiredSourceRefs)) issues.push(issue("requiredSourceRefs", "expected array"));
  if (!isObject(query.candidateBudget)) issues.push(issue("candidateBudget", "required"));
  const outputBudgetUnits = query.outputBudgetUnits;
  if (!Number.isInteger(outputBudgetUnits) || (outputBudgetUnits ?? -1) < 0) issues.push(issue("outputBudgetUnits", "expected positive integer"));
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function validateMemoryCapsuleV1(value: unknown): MemoryValidationResult {
  if (!isObject(value)) return { ok: false, issues: ["capsule: expected object"] };
  const capsule = value as Partial<MemoryCapsuleV1>;
  const issues: string[] = [];
  if (capsule.schemaVersion !== 1) issues.push(issue("schemaVersion", "expected 1"));
  if (typeof capsule.capsuleId !== "string" || capsule.capsuleId.length === 0) issues.push(issue("capsuleId", "required"));
  if (!isStringArray(capsule.memoryIds)) issues.push(issue("memoryIds", "expected string array"));
  if (!Array.isArray(capsule.sourceRefs) || capsule.sourceRefs.length === 0) issues.push(issue("sourceRefs", "required"));
  if (!isObject(capsule.perspective) || typeof capsule.perspective.kind !== "string") issues.push(issue("perspective", "required"));
  if (typeof capsule.text !== "string" || capsule.text.trim().length === 0) issues.push(issue("text", "required"));
  const tokenEstimate = capsule.tokenEstimate;
  if (!Number.isInteger(tokenEstimate) || (tokenEstimate ?? -1) < 0) issues.push(issue("tokenEstimate", "expected positive integer"));
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
