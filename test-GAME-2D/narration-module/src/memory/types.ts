import type { JsonObject } from "../core";

export type MemorySourceKindV1 =
  | "AGGREGATE"
  | "EVENT"
  | "COMMIT"
  | "OPERATION"
  | "CONTENT_ENTRY"
  | "LORE_FRAGMENT"
  | "RULE"
  | "ADJUDICATION"
  | "INTERACTION";

export interface MemorySourceRefV1 {
  schemaVersion: 1;
  sourceKind: MemorySourceKindV1;
  sourceId: string;
  campaignId: string | null;
  ownerDomain: string;
  version: number | string;
  path: string | null;
  fingerprint: `sha256:${string}` | null;
}

export type MemoryValidityV1 =
  | "CURRENT_TRUE"
  | "PAST_TRUE"
  | "SUPERSEDED"
  | "INVALIDATED"
  | "SUBJECTIVE_BELIEF"
  | "HYPOTHESIS"
  | "UNKNOWN";

export type MemoryRecallCycleV1 = "ACTIVE" | "RELEVANT" | "DORMANT" | "ARCHIVED";

export type MemoryVisibilityV1 =
  | "SYSTEM_ONLY"
  | "PLAYER_CHARACTER"
  | "PLAYER_META"
  | "ACTOR_SCOPED"
  | "DIAGNOSTIC";

export interface MemoryAnchorV1 {
  kind: "ACTOR" | "LOCATION" | "ITEM" | "FACTION" | "PLOT" | "RULE" | "TOPIC" | "TIME" | "PROCESS";
  id: string;
  strength: "PRIMARY" | "SECONDARY";
}

export interface MemoryUnitV1 {
  schemaVersion: 1;
  memoryId: string;
  campaignId: string;
  sourceRefs: MemorySourceRefV1[];
  unitType:
    | "FACT"
    | "EVENT_SUMMARY"
    | "ACTOR_MEMORY"
    | "RELATION"
    | "PLOT_COMMITMENT"
    | "LOCATION_STATE"
    | "ITEM_HISTORY"
    | "TRANSCRIPT_EXCERPT";
  validity: MemoryValidityV1;
  recallCycle: MemoryRecallCycleV1;
  visibility: MemoryVisibilityV1;
  actorScope: string[];
  anchors: MemoryAnchorV1[];
  importance: {
    systemic: number;
    narrative: number;
  };
  gameTimeRange: {
    from: number | null;
    to: number | null;
  };
  text: string;
  summary: string | null;
  supersedesMemoryIds: string[];
  supersededByMemoryId: string | null;
  createdByEventId: string | null;
}

export interface MemoryIndexEntryV1 {
  schemaVersion: 1;
  indexId: string;
  campaignId: string;
  memoryId: string;
  sourceRefs: MemorySourceRefV1[];
  channel: "STRUCTURED" | "GRAPH" | "TEXT" | "SEMANTIC";
  keys: string[];
  visibility: MemoryVisibilityV1;
  actorScope: string[];
  recallCycle: MemoryRecallCycleV1;
  rootFingerprint: `sha256:${string}`;
  policyVersion: string;
}

export type ContextPerspectiveV1 =
  | { kind: "SYSTEM_MJ" }
  | { kind: "PLAYER_CHARACTER"; actorId: string }
  | { kind: "PLAYER_META" }
  | { kind: "NPC"; actorId: string }
  | { kind: "DIAGNOSTIC" };

export interface MemoryTriggerV1 {
  kind: "ACTOR" | "LOCATION" | "ITEM" | "FACTION" | "PLOT" | "TEXT" | "TOPIC" | "TIME" | "PROCESS";
  id: string | null;
  text: string | null;
  strength: "STRONG" | "SECONDARY";
}

export interface MemoryRecallQueryV1 {
  schemaVersion: 1;
  queryId: string;
  campaignId: string;
  baseCampaignRevision: number;
  perspective: ContextPerspectiveV1;
  purpose:
    | "RETURN_TO_PLACE"
    | "PLAYER_MENTION"
    | "ACTIVE_SCENE"
    | "PLOT_CONTINUITY"
    | "RULE_CONTEXT"
    | "DIAGNOSTIC";
  strongTriggers: MemoryTriggerV1[];
  secondaryTriggers: MemoryTriggerV1[];
  requiredSourceRefs: MemorySourceRefV1[];
  candidateBudget: {
    structured: number;
    graph: number;
    text: number;
    semantic: number;
  };
  outputBudgetUnits: number;
}

export interface MemoryCapsuleV1 {
  schemaVersion: 1;
  capsuleId: string;
  memoryIds: string[];
  sourceRefs: MemorySourceRefV1[];
  perspective: ContextPerspectiveV1;
  inclusionLevel:
    | "MANDATORY"
    | "STRUCTURED_DIRECT"
    | "CAUSAL_STRONG"
    | "TEXTUAL_ALIAS"
    | "SEMANTIC_VALIDATED"
    | "WEAK_SUGGESTION";
  reason: string;
  validity: MemoryValidityV1;
  certainty: "CONFIRMED" | "LIKELY" | "UNCERTAIN" | "FALSE_BELIEF" | "UNKNOWN";
  text: string;
  tokenEstimate: number;
}

export interface MemoryIndexRebuildReportV1 {
  schemaVersion: 1;
  campaignId: string;
  policyVersion: string;
  rebuiltMemoryCount: number;
  rebuiltIndexCount: number;
  channels: Array<MemoryIndexEntryV1["channel"]>;
}

export type MemoryDiagnosticCodeV1 =
  | "MEMORY_VALIDATION_FAILED"
  | "MEMORY_SOURCE_REQUIRED"
  | "MEMORY_VISIBILITY_DENIED"
  | "MEMORY_NOT_FOUND";

export interface MemoryDiagnosticV1 {
  code: MemoryDiagnosticCodeV1;
  message: string;
  details: JsonObject;
}

export type MemoryQueryResultV1 =
  | { ok: true; capsules: MemoryCapsuleV1[] }
  | { ok: false; diagnostics: MemoryDiagnosticV1[] };

export interface MemoryRepositoryV1 {
  upsertMemoryUnits(units: MemoryUnitV1[]): Promise<void>;
  queryMemory(query: MemoryRecallQueryV1): Promise<MemoryQueryResultV1>;
  rebuildIndexes(campaignId: string, policyVersion: string): Promise<MemoryIndexRebuildReportV1>;
  listIndexEntries(campaignId: string): Promise<MemoryIndexEntryV1[]>;
}
