export type RuntimeMarkerResolutionKind = "SAVING_THROW" | "ATTACK_ROLL" | "ABILITY_CHECK";
export type RuntimeMarkerRollMode = "advantage" | "disadvantage";
export type RuntimeMarkerLifecycle = "until_end_of_source_next_turn";
export type RuntimeMarkerPhase = "active" | "expiring";

export interface RuntimeMarkerEffectSpec {
  resolutionKind: RuntimeMarkerResolutionKind;
  actionTagsAny?: string[];
  actionTagsAll?: string[];
  actionTagsNone?: string[];
  actorMustMatchSource?: boolean;
  rollMode?: RuntimeMarkerRollMode;
  consumeOnTrigger?: boolean;
}

export interface RuntimeMarkerPayload {
  version: 1;
  markerId: string;
  sourceId: string;
  lifecycle: RuntimeMarkerLifecycle;
  phase: RuntimeMarkerPhase;
  effect: RuntimeMarkerEffectSpec;
}

const RUNTIME_MARKER_PREFIX = "rtm:";

function normalizeTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(tag => String(tag).trim().toLowerCase()).filter(Boolean);
}

function normalizePayload(input: unknown): RuntimeMarkerPayload | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const markerId = String(raw.markerId ?? "").trim();
  const sourceId = String(raw.sourceId ?? "").trim();
  const lifecycleRaw = String(raw.lifecycle ?? "").trim().toLowerCase();
  const phaseRaw = String(raw.phase ?? "active").trim().toLowerCase();
  const effectRaw = raw.effect && typeof raw.effect === "object" ? (raw.effect as Record<string, unknown>) : null;
  if (!markerId || !sourceId || !effectRaw) return null;
  const resolutionKindRaw = String(effectRaw.resolutionKind ?? "").trim().toUpperCase();
  if (!["SAVING_THROW", "ATTACK_ROLL", "ABILITY_CHECK"].includes(resolutionKindRaw)) return null;
  if (lifecycleRaw !== "until_end_of_source_next_turn") return null;
  const phase: RuntimeMarkerPhase = phaseRaw === "expiring" ? "expiring" : "active";
  const rollModeRaw = String(effectRaw.rollMode ?? "").trim().toLowerCase();
  const rollMode: RuntimeMarkerRollMode | undefined =
    rollModeRaw === "advantage" || rollModeRaw === "disadvantage" ? (rollModeRaw as RuntimeMarkerRollMode) : undefined;
  return {
    version: 1,
    markerId,
    sourceId,
    lifecycle: "until_end_of_source_next_turn",
    phase,
    effect: {
      resolutionKind: resolutionKindRaw as RuntimeMarkerResolutionKind,
      actionTagsAny: normalizeTagList(effectRaw.actionTagsAny),
      actionTagsAll: normalizeTagList(effectRaw.actionTagsAll),
      actionTagsNone: normalizeTagList(effectRaw.actionTagsNone),
      actorMustMatchSource: Boolean(effectRaw.actorMustMatchSource),
      rollMode,
      consumeOnTrigger: Boolean(effectRaw.consumeOnTrigger)
    }
  };
}

export function buildRuntimeMarkerTag(payload: RuntimeMarkerPayload): string {
  return `${RUNTIME_MARKER_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
}

export function parseRuntimeMarkerTag(tag: string): RuntimeMarkerPayload | null {
  const value = String(tag ?? "");
  if (!value.startsWith(RUNTIME_MARKER_PREFIX)) return null;
  const encoded = value.slice(RUNTIME_MARKER_PREFIX.length);
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(encoded);
    return normalizePayload(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function upsertRuntimeMarkerTag(tags: string[], payload: RuntimeMarkerPayload): string[] {
  const normalized = normalizePayload(payload);
  if (!normalized) return tags;
  const next = tags.filter(tag => {
    const parsed = parseRuntimeMarkerTag(tag);
    if (!parsed) return true;
    return !(parsed.markerId === normalized.markerId && parsed.sourceId === normalized.sourceId);
  });
  next.push(buildRuntimeMarkerTag(normalized));
  return next;
}

export function advanceRuntimeMarkersForSourceTurnStart(tags: string[], sourceId: string): string[] {
  let changed = false;
  const next = tags.map(tag => {
    const parsed = parseRuntimeMarkerTag(tag);
    if (!parsed) return tag;
    if (parsed.sourceId !== sourceId) return tag;
    if (parsed.lifecycle !== "until_end_of_source_next_turn") return tag;
    if (parsed.phase !== "active") return tag;
    changed = true;
    return buildRuntimeMarkerTag({ ...parsed, phase: "expiring" });
  });
  return changed ? next : tags;
}

export function expireRuntimeMarkersForSourceTurnEnd(tags: string[], sourceId: string): string[] {
  let changed = false;
  const next = tags.filter(tag => {
    const parsed = parseRuntimeMarkerTag(tag);
    if (!parsed) return true;
    if (parsed.sourceId !== sourceId) return true;
    if (parsed.lifecycle !== "until_end_of_source_next_turn") return true;
    if (parsed.phase !== "expiring") return true;
    changed = true;
    return false;
  });
  return changed ? next : tags;
}

export function runtimeMarkerAppliesToResolution(
  marker: RuntimeMarkerPayload,
  params: { resolutionKind: RuntimeMarkerResolutionKind; actionTags?: string[]; actorId?: string | null }
): boolean {
  if (marker.effect.resolutionKind !== params.resolutionKind) return false;
  if (marker.effect.actorMustMatchSource && marker.sourceId !== String(params.actorId ?? "")) return false;
  const actionTags = normalizeTagList(params.actionTags ?? []);
  const any = normalizeTagList(marker.effect.actionTagsAny);
  if (any.length > 0 && !any.some(tag => actionTags.includes(tag))) return false;
  const all = normalizeTagList(marker.effect.actionTagsAll);
  if (all.length > 0 && !all.every(tag => actionTags.includes(tag))) return false;
  const none = normalizeTagList(marker.effect.actionTagsNone);
  if (none.length > 0 && none.some(tag => actionTags.includes(tag))) return false;
  return true;
}
