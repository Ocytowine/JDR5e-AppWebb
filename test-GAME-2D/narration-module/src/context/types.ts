import type { JsonObject } from "../core";
import type { ContextPerspectiveV1, MemoryCapsuleV1, MemorySourceRefV1, MemoryVisibilityV1 } from "../memory";

export interface SnapshotSourceManifestEntryV1 {
  sourceRef: MemorySourceRefV1;
  mode: "EMBEDDED" | "REFERENCED";
  maxVisibility: MemoryVisibilityV1;
}

export interface SnapshotSectionV1 {
  schemaVersion: 1;
  sectionId: string;
  sourceRefs: MemorySourceRefV1[];
  payload: JsonObject;
  payloadFingerprint: `sha256:${string}`;
}

export interface TurnSnapshotV1 {
  schemaVersion: 1;
  snapshotId: string;
  campaignId: string;
  turnId: string;
  operationId: string;
  baseCampaignRevision: number;
  capturedAt: string;
  gameTimeSecond: number;
  contentPackage: {
    packageId: string;
    packageVersion: number;
    rootFingerprint: `sha256:${string}`;
  };
  ruleset: {
    rulesetId: string;
    rulesetVersion: number;
    rootFingerprint: `sha256:${string}`;
  };
  sourceManifest: SnapshotSourceManifestEntryV1[];
  sections: {
    turnInput: SnapshotSectionV1 | null;
    sceneContinuity: SnapshotSectionV1 | null;
    worldFrame: SnapshotSectionV1;
    playerFrame: SnapshotSectionV1;
    actorRefs: SnapshotSectionV1;
    activeProcess: SnapshotSectionV1 | null;
    mandatoryConstraints: SnapshotSectionV1;
    retrievalSeeds: SnapshotSectionV1;
  };
  snapshotFingerprint: `sha256:${string}`;
}

export type ContextRoleV1 =
  | "intent_interpreter"
  | "mj_planner"
  | "player_expression_adapter"
  | "npc_performer"
  | "rules_adjudicator"
  | "coherence_critic"
  | "scene_writer"
  | "clarification_writer";

export interface ContextDependencyV1 {
  sourceRef: MemorySourceRefV1;
  properties: string[];
}

export interface ContextBlockV1 {
  blockId: string;
  blockKind:
    | "TURN_INPUT"
    | "SCENE"
    | "WORLD"
    | "PLAYER"
    | "ACTOR"
    | "PROCESS"
    | "CONSTRAINT"
    | "MEMORY_CAPSULE"
    | "COMMITTED_RESULT"
    | "REVEAL_ENVELOPE";
  sourceRefs: MemorySourceRefV1[];
  visibility: MemoryVisibilityV1;
  actorScope: string[];
  text: string;
  payload: JsonObject;
  tokenEstimate: number;
}

export interface CreativeScopeV1 {
  mayCreate: string[];
  mayReference: string[];
  mayProposeCommands: string[];
  mayReveal: {
    reveal: string[];
    hint: string[];
    withhold: string[];
  };
  mustPreserve: string[];
  mustNotCreate: string[];
  mustNotModify: string[];
  noveltyConstraints: string[];
}

export interface ContextBudgetV1 {
  unit: "MODEL_TOKENS_ESTIMATE";
  maximum: number;
  reservedForInstructionsAndSchema: number;
  reservedForOutput: number;
  reservedForInput: number;
  reservedForMandatory: number;
  consumedByBlocks: number;
  remainingMargin: number;
  reductionStepsApplied: string[];
}

export interface RoleContextPackV1 {
  schemaVersion: 1;
  packId: string;
  snapshotId: string;
  campaignId: string;
  role: ContextRoleV1;
  task: string;
  perspective: ContextPerspectiveV1;
  baseCampaignRevision: number;
  dependencyVersions: ContextDependencyV1[];
  creativeScope: CreativeScopeV1;
  budget: ContextBudgetV1;
  blocks: ContextBlockV1[];
  outputContractId: string;
  packFingerprint: `sha256:${string}`;
}

export interface TraceEntryV1 {
  sourceRefs: MemorySourceRefV1[];
  reason: string;
  visibility: MemoryVisibilityV1;
  actorScope: string[];
  tokenEstimate: number;
}

export interface ContextBuildTraceV1 {
  schemaVersion: 1;
  traceId: string;
  packId: string;
  snapshotId: string;
  policyVersion: string;
  channelsUsed: Array<"STRUCTURED" | "GRAPH" | "TEXT" | "SEMANTIC">;
  included: TraceEntryV1[];
  excluded: TraceEntryV1[];
  condensed: TraceEntryV1[];
  budget: ContextBudgetV1;
  warnings: string[];
  traceFingerprint: `sha256:${string}`;
}

export type ContextStalenessStatusV1 =
  | "CURRENT"
  | "REPROJECT_REQUIRED"
  | "REVALIDATE_REQUIRED"
  | "STALE";

export interface BuildTurnSnapshotInputV1 {
  schemaVersion: 1;
  snapshotId: string;
  campaignId: string;
  turnId: string;
  operationId: string;
  baseCampaignRevision: number;
  capturedAt: string;
  gameTimeSecond: number;
  contentPackage: TurnSnapshotV1["contentPackage"];
  ruleset: TurnSnapshotV1["ruleset"];
  sections: Omit<TurnSnapshotV1["sections"], never>;
}

export interface BuildRoleContextInputV1 {
  schemaVersion: 1;
  packId: string;
  traceId: string;
  snapshot: TurnSnapshotV1;
  role: ContextRoleV1;
  task: string;
  perspective: ContextPerspectiveV1;
  creativeScope: CreativeScopeV1;
  outputContractId: string;
  policyVersion: string;
  budgetMaximum: number;
  reservedForInstructionsAndSchema: number;
  reservedForOutput: number;
  mandatoryBlocks: ContextBlockV1[];
  optionalBlocks: ContextBlockV1[];
  memoryCapsules: MemoryCapsuleV1[];
  channelsUsed: Array<"STRUCTURED" | "GRAPH" | "TEXT" | "SEMANTIC">;
}

export type ContextBuildResultV1 =
  | { ok: true; pack: RoleContextPackV1; trace: ContextBuildTraceV1 }
  | { ok: false; code: "CONTEXT_BUDGET_EXCEEDED" | "CONTEXT_VISIBILITY_DENIED" | "CONTEXT_VALIDATION_FAILED"; issues: string[] };

export interface StalenessCheckInputV1 {
  pack: RoleContextPackV1;
  currentCampaignRevision: number;
  changedSourceRefs: MemorySourceRefV1[];
  sceneChanged: boolean;
  criticalAuthorityChanged: boolean;
}
