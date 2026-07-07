import { cloneJson, computeJsonFingerprint } from "../core";
import { canExposeMemoryToPerspective, sameSourceRef, type MemoryCapsuleV1, type MemorySourceRefV1 } from "../memory";
import type {
  BuildRoleContextInputV1,
  BuildTurnSnapshotInputV1,
  ContextBlockV1,
  ContextBuildResultV1,
  ContextBuildTraceV1,
  ContextBudgetV1,
  ContextDependencyV1,
  ContextStalenessStatusV1,
  RoleContextPackV1,
  SnapshotSectionV1,
  SnapshotSourceManifestEntryV1,
  StalenessCheckInputV1,
  TraceEntryV1,
  TurnSnapshotV1
} from "./types";

const REDUCTION_STEPS = [
  "drop-style-examples-and-ornaments",
  "drop-redundant-derived-summaries",
  "drop-secondary-lore-without-dependency",
  "drop-weak-suggestions",
  "drop-dormant-then-archived-non-mandatory-capsules",
  "replace-resolvable-blocks-by-references"
] as const;

function estimate(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function uniqueSources(sourceRefs: MemorySourceRefV1[]): MemorySourceRefV1[] {
  const result: MemorySourceRefV1[] = [];
  for (const sourceRef of sourceRefs) {
    if (!result.some(existing => sameSourceRef(existing, sourceRef))) result.push(sourceRef);
  }
  return result;
}

function traceEntry(block: ContextBlockV1, reason: string): TraceEntryV1 {
  return {
    sourceRefs: cloneJson(block.sourceRefs),
    reason,
    visibility: block.visibility,
    actorScope: [...block.actorScope],
    tokenEstimate: block.tokenEstimate
  };
}

function mandatoryBudget(
  maximum: number,
  reservedForInstructionsAndSchema: number,
  reservedForOutput: number,
  mandatoryBlocks: ContextBlockV1[]
): ContextBudgetV1 {
  const reservedForInput = Math.max(0, maximum - reservedForInstructionsAndSchema - reservedForOutput);
  const reservedForMandatory = mandatoryBlocks.reduce((total, block) => total + block.tokenEstimate, 0);
  return {
    unit: "MODEL_TOKENS_ESTIMATE",
    maximum,
    reservedForInstructionsAndSchema,
    reservedForOutput,
    reservedForInput,
    reservedForMandatory,
    consumedByBlocks: reservedForMandatory,
    remainingMargin: reservedForInput - reservedForMandatory,
    reductionStepsApplied: []
  };
}

function withBudget(base: ContextBudgetV1, consumedByBlocks: number, reductionStepsApplied: string[]): ContextBudgetV1 {
  return {
    ...base,
    consumedByBlocks,
    remainingMargin: base.reservedForInput - consumedByBlocks,
    reductionStepsApplied
  };
}

async function materializeSection(section: SnapshotSectionV1 | null): Promise<SnapshotSectionV1 | null> {
  if (section === null) return null;
  const payloadFingerprint = await computeJsonFingerprint(section.payload) as `sha256:${string}`;
  return {
    ...cloneJson(section),
    payloadFingerprint
  };
}

function collectManifest(sections: TurnSnapshotV1["sections"]): SnapshotSourceManifestEntryV1[] {
  const sourceRefs = uniqueSources(Object.values(sections).flatMap(section => section?.sourceRefs ?? []));
  return sourceRefs.map(sourceRef => ({
    sourceRef,
    mode: "REFERENCED",
    maxVisibility: "SYSTEM_ONLY"
  }));
}

export async function buildTurnSnapshotV1(input: BuildTurnSnapshotInputV1): Promise<TurnSnapshotV1> {
  const sections: TurnSnapshotV1["sections"] = {
    turnInput: await materializeSection(input.sections.turnInput),
    sceneContinuity: await materializeSection(input.sections.sceneContinuity),
    worldFrame: (await materializeSection(input.sections.worldFrame))!,
    playerFrame: (await materializeSection(input.sections.playerFrame))!,
    actorRefs: (await materializeSection(input.sections.actorRefs))!,
    activeProcess: await materializeSection(input.sections.activeProcess),
    mandatoryConstraints: (await materializeSection(input.sections.mandatoryConstraints))!,
    retrievalSeeds: (await materializeSection(input.sections.retrievalSeeds))!
  };
  const draft: TurnSnapshotV1 = {
    schemaVersion: 1,
    snapshotId: input.snapshotId,
    campaignId: input.campaignId,
    turnId: input.turnId,
    operationId: input.operationId,
    baseCampaignRevision: input.baseCampaignRevision,
    capturedAt: input.capturedAt,
    gameTimeSecond: input.gameTimeSecond,
    contentPackage: cloneJson(input.contentPackage),
    ruleset: cloneJson(input.ruleset),
    sourceManifest: collectManifest(sections),
    sections,
    snapshotFingerprint: "sha256:" as `sha256:${string}`
  };
  return {
    ...draft,
    snapshotFingerprint: await computeJsonFingerprint({ ...draft, snapshotFingerprint: null }) as `sha256:${string}`
  };
}

function capsuleToBlock(capsule: MemoryCapsuleV1): ContextBlockV1 {
  return {
    blockId: `memory-block:${capsule.capsuleId}`,
    blockKind: "MEMORY_CAPSULE",
    sourceRefs: cloneJson(capsule.sourceRefs),
    visibility: capsule.perspective.kind === "SYSTEM_MJ" || capsule.perspective.kind === "DIAGNOSTIC"
      ? "SYSTEM_ONLY"
      : capsule.perspective.kind === "PLAYER_META"
        ? "PLAYER_META"
        : "PLAYER_CHARACTER",
    actorScope: capsule.perspective.kind === "PLAYER_CHARACTER" || capsule.perspective.kind === "NPC" ? [capsule.perspective.actorId] : [],
    text: capsule.text,
    payload: {
      capsuleId: capsule.capsuleId,
      memoryIds: capsule.memoryIds,
      inclusionLevel: capsule.inclusionLevel,
      validity: capsule.validity,
      certainty: capsule.certainty
    },
    tokenEstimate: capsule.tokenEstimate || estimate(capsule.text)
  };
}

function blockAllowed(input: BuildRoleContextInputV1, block: ContextBlockV1): boolean {
  return canExposeMemoryToPerspective(block.visibility, block.actorScope, input.perspective);
}

function sourceDependencies(blocks: ContextBlockV1[]): ContextDependencyV1[] {
  return uniqueSources(blocks.flatMap(block => block.sourceRefs)).map(sourceRef => ({
    sourceRef,
    properties: ["existence", "version", "visibility"]
  }));
}

function optionalPriority(block: ContextBlockV1): number {
  if (block.blockKind === "MEMORY_CAPSULE") {
    if (block.payload.inclusionLevel === "WEAK_SUGGESTION") return 10;
    if (block.payload.validity === "PAST_TRUE") return 30;
    return 80;
  }
  if (block.blockKind === "REVEAL_ENVELOPE") return 70;
  return 50;
}

export async function buildRoleContextV1(input: BuildRoleContextInputV1): Promise<ContextBuildResultV1> {
  if (input.schemaVersion !== 1) return { ok: false, code: "CONTEXT_VALIDATION_FAILED", issues: ["schemaVersion must be 1."] };
  const memoryBlocks = input.memoryCapsules.map(capsuleToBlock);
  const mandatoryBlocks = input.mandatoryBlocks.map(block => ({
    ...cloneJson(block),
    tokenEstimate: block.tokenEstimate || estimate(block.text)
  }));
  const optionalBlocks = [...input.optionalBlocks, ...memoryBlocks].map(block => ({
    ...cloneJson(block),
    tokenEstimate: block.tokenEstimate || estimate(block.text)
  }));

  const deniedMandatory = mandatoryBlocks.filter(block => !blockAllowed(input, block));
  if (deniedMandatory.length > 0) {
    return {
      ok: false,
      code: "CONTEXT_VISIBILITY_DENIED",
      issues: deniedMandatory.map(block => `Mandatory block ${block.blockId} is not visible to ${input.perspective.kind}.`)
    };
  }

  const budgetBase = mandatoryBudget(
    input.budgetMaximum,
    input.reservedForInstructionsAndSchema,
    input.reservedForOutput,
    mandatoryBlocks
  );
  if (budgetBase.remainingMargin < 0) {
    return {
      ok: false,
      code: "CONTEXT_BUDGET_EXCEEDED",
      issues: [`Mandatory context requires ${budgetBase.reservedForMandatory}, available input budget is ${budgetBase.reservedForInput}.`]
    };
  }

  const included = [...mandatoryBlocks];
  const excluded: TraceEntryV1[] = [];
  const reductionSteps = new Set<string>();
  let consumed = mandatoryBlocks.reduce((total, block) => total + block.tokenEstimate, 0);
  const visibleOptional = optionalBlocks
    .filter(block => {
      const allowed = blockAllowed(input, block);
      if (!allowed) excluded.push(traceEntry(block, "visibility denied"));
      return allowed;
    })
    .sort((left, right) => optionalPriority(right) - optionalPriority(left) || left.blockId.localeCompare(right.blockId));

  for (const block of visibleOptional) {
    if (consumed + block.tokenEstimate <= budgetBase.reservedForInput) {
      included.push(block);
      consumed += block.tokenEstimate;
    } else {
      reductionSteps.add(REDUCTION_STEPS[Math.min(REDUCTION_STEPS.length - 1, Math.floor(optionalPriority(block) / 20))]);
      excluded.push(traceEntry(block, "budget reduction"));
    }
  }

  const budget = withBudget(budgetBase, consumed, [...reductionSteps]);
  const packDraft: RoleContextPackV1 = {
    schemaVersion: 1,
    packId: input.packId,
    snapshotId: input.snapshot.snapshotId,
    campaignId: input.snapshot.campaignId,
    role: input.role,
    task: input.task,
    perspective: cloneJson(input.perspective),
    baseCampaignRevision: input.snapshot.baseCampaignRevision,
    dependencyVersions: sourceDependencies(included),
    creativeScope: cloneJson(input.creativeScope),
    budget,
    blocks: included,
    outputContractId: input.outputContractId,
    packFingerprint: "sha256:" as `sha256:${string}`
  };
  const pack = {
    ...packDraft,
    packFingerprint: await computeJsonFingerprint({ ...packDraft, packFingerprint: null }) as `sha256:${string}`
  };
  const traceDraft: ContextBuildTraceV1 = {
    schemaVersion: 1,
    traceId: input.traceId,
    packId: input.packId,
    snapshotId: input.snapshot.snapshotId,
    policyVersion: input.policyVersion,
    channelsUsed: [...input.channelsUsed],
    included: included.map(block => traceEntry(block, "included")),
    excluded,
    condensed: [],
    budget,
    warnings: [],
    traceFingerprint: "sha256:" as `sha256:${string}`
  };
  const trace = {
    ...traceDraft,
    traceFingerprint: await computeJsonFingerprint({ ...traceDraft, traceFingerprint: null }) as `sha256:${string}`
  };
  return { ok: true, pack, trace };
}

export function evaluateContextStalenessV1(input: StalenessCheckInputV1): ContextStalenessStatusV1 {
  if (input.currentCampaignRevision === input.pack.baseCampaignRevision && input.changedSourceRefs.length === 0) return "CURRENT";
  if (input.sceneChanged || input.criticalAuthorityChanged) return "STALE";
  const changedDependency = input.pack.dependencyVersions.some(dependency =>
    input.changedSourceRefs.some(changed => sameSourceRef(changed, dependency.sourceRef))
  );
  if (changedDependency) return "REVALIDATE_REQUIRED";
  return "REPROJECT_REQUIRED";
}
