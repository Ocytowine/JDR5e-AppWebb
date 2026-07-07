import {
  buildRoleContextV1,
  buildTurnSnapshotV1,
  evaluateContextStalenessV1,
  type BuildRoleContextInputV1,
  type ContextBlockV1,
  type CreativeScopeV1,
  type SnapshotSectionV1
} from "../../src/context";
import type { JsonObject } from "../../src/core";
import type { MemoryCapsuleV1, MemorySourceRefV1 } from "../../src/memory";
import { assert } from "../contracts/assertions";

const campaignId = "campaign-context-001";

function source(sourceId: string): MemorySourceRefV1 {
  return {
    schemaVersion: 1,
    sourceKind: "AGGREGATE",
    sourceId,
    campaignId,
    ownerDomain: "narration.context.fixture",
    version: 1,
    path: "/payload",
    fingerprint: null
  };
}

function section(sectionId: string, sourceId: string, payload: JsonObject): SnapshotSectionV1 {
  return {
    schemaVersion: 1,
    sectionId,
    sourceRefs: [source(sourceId)],
    payload,
    payloadFingerprint: "sha256:" as `sha256:${string}`
  };
}

function block(blockId: string, tokenEstimate: number, overrides: Partial<ContextBlockV1> = {}): ContextBlockV1 {
  return {
    blockId,
    blockKind: "CONSTRAINT",
    sourceRefs: [source(`source-${blockId}`)],
    visibility: "PLAYER_CHARACTER",
    actorScope: [],
    text: `Bloc ${blockId}`,
    payload: {},
    tokenEstimate,
    ...overrides
  };
}

const creativeScope: CreativeScopeV1 = {
  mayCreate: [],
  mayReference: ["facts", "visible-memory"],
  mayProposeCommands: [],
  mayReveal: { reveal: [], hint: [], withhold: ["secret:conservateur"] },
  mustPreserve: ["sources", "campaign revision"],
  mustNotCreate: ["new npc", "new plot"],
  mustNotModify: ["campaign state"],
  noveltyConstraints: []
};

async function baseInput(): Promise<BuildRoleContextInputV1> {
  const snapshot = await buildTurnSnapshotV1({
    schemaVersion: 1,
    snapshotId: "snapshot-001",
    campaignId,
    turnId: "turn-001",
    operationId: "operation-001",
    baseCampaignRevision: 12,
    capturedAt: "2026-07-07T10:00:00.000Z",
    gameTimeSecond: 36_000,
    contentPackage: {
      packageId: "jdr5e.base-content",
      packageVersion: 1,
      rootFingerprint: "sha256:1111111111111111111111111111111111111111111111111111111111111111"
    },
    ruleset: {
      rulesetId: "jdr5e.rules",
      rulesetVersion: 1,
      rootFingerprint: "sha256:2222222222222222222222222222222222222222222222222222222222222222"
    },
    sections: {
      turnInput: section("turn-input", "aggregate-turn", { input: "Je retourne aux Archives." }),
      sceneContinuity: null,
      worldFrame: section("world-frame", "aggregate-world", { place: "archives_de_lysenthe" }),
      playerFrame: section("player-frame", "aggregate-player", { actorId: "pc-aryn" }),
      actorRefs: section("actor-refs", "aggregate-actors", { present: ["pc-aryn"] }),
      activeProcess: null,
      mandatoryConstraints: section("constraints", "aggregate-constraints", { noSecretReveal: true }),
      retrievalSeeds: section("retrieval", "aggregate-retrieval", { locationId: "archives_de_lysenthe" })
    }
  });

  const memoryCapsule: MemoryCapsuleV1 = {
    schemaVersion: 1,
    capsuleId: "capsule-archives-current",
    memoryIds: ["memory-archives-current"],
    sourceRefs: [source("memory-source-archives")],
    perspective: { kind: "PLAYER_CHARACTER", actorId: "pc-aryn" },
    inclusionLevel: "STRUCTURED_DIRECT",
    reason: "return to known place",
    validity: "CURRENT_TRUE",
    certainty: "CONFIRMED",
    text: "Archives de Lysenthe : aile nord condamnée après éboulement récent.",
    tokenEstimate: 16
  };

  return {
    schemaVersion: 1,
    packId: "pack-001",
    traceId: "trace-001",
    snapshot,
    role: "scene_writer",
    task: "write visible return to archives",
    perspective: { kind: "PLAYER_CHARACTER", actorId: "pc-aryn" },
    creativeScope,
    outputContractId: "role-context-pack/1",
    policyVersion: "memory-context/1",
    budgetMaximum: 120,
    reservedForInstructionsAndSchema: 20,
    reservedForOutput: 20,
    mandatoryBlocks: [
      block("turn", 10, { blockKind: "TURN_INPUT", sourceRefs: snapshot.sections.turnInput?.sourceRefs ?? [] }),
      block("constraints", 12, { blockKind: "CONSTRAINT", sourceRefs: snapshot.sections.mandatoryConstraints.sourceRefs })
    ],
    optionalBlocks: [
      block("style-example", 80, { blockKind: "SCENE", text: "Ornement long non obligatoire." }),
      block("weak-suggestion", 60, { blockKind: "MEMORY_CAPSULE", payload: { inclusionLevel: "WEAK_SUGGESTION" } })
    ],
    memoryCapsules: [memoryCapsule],
    channelsUsed: ["STRUCTURED", "TEXT"]
  };
}

async function run(): Promise<void> {
  const input = await baseInput();
  const first = await buildRoleContextV1(input);
  const replay = await buildRoleContextV1(input);
  assert.equal(first.ok, true);
  assert.deepEqual(first, replay);
  if (first.ok) {
    assert.equal(first.pack.blocks.some(entry => entry.blockId === "memory-block:capsule-archives-current"), true);
    assert.equal(first.pack.blocks.some(entry => entry.blockId === "style-example"), false);
    assert.equal(first.pack.packFingerprint.startsWith("sha256:"), true);
    assert.equal(first.trace.excluded.length >= 1, true);
    assert.equal(first.pack.creativeScope.mayReveal.withhold.includes("secret:conservateur"), true);
  }
  console.log("PASS [context] role context is deterministic, budgeted and keeps reveal envelope opaque");

  const overBudget = await buildRoleContextV1({
    ...input,
    packId: "pack-over-budget",
    traceId: "trace-over-budget",
    budgetMaximum: 50,
    reservedForInstructionsAndSchema: 20,
    reservedForOutput: 20,
    mandatoryBlocks: [block("mandatory-too-large", 20)]
  });
  assert.equal(overBudget.ok, false);
  if (!overBudget.ok) assert.equal(overBudget.code, "CONTEXT_BUDGET_EXCEEDED");
  console.log("PASS [context] NAR-ACC-015 mandatory budget overflow fails explicitly");

  const hiddenMandatory = await buildRoleContextV1({
    ...input,
    packId: "pack-secret",
    traceId: "trace-secret",
    mandatoryBlocks: [block("secret", 5, { visibility: "SYSTEM_ONLY", text: "Secret brut interdit joueur." })]
  });
  assert.equal(hiddenMandatory.ok, false);
  if (!hiddenMandatory.ok) assert.equal(hiddenMandatory.code, "CONTEXT_VISIBILITY_DENIED");
  console.log("PASS [context] player pack rejects unknown secret");

  if (first.ok) {
    assert.equal(evaluateContextStalenessV1({
      pack: first.pack,
      currentCampaignRevision: 12,
      changedSourceRefs: [],
      sceneChanged: false,
      criticalAuthorityChanged: false
    }), "CURRENT");
    assert.equal(evaluateContextStalenessV1({
      pack: first.pack,
      currentCampaignRevision: 13,
      changedSourceRefs: [],
      sceneChanged: false,
      criticalAuthorityChanged: false
    }), "REPROJECT_REQUIRED");
    assert.equal(evaluateContextStalenessV1({
      pack: first.pack,
      currentCampaignRevision: 13,
      changedSourceRefs: [first.pack.dependencyVersions[0].sourceRef],
      sceneChanged: false,
      criticalAuthorityChanged: false
    }), "REVALIDATE_REQUIRED");
    assert.equal(evaluateContextStalenessV1({
      pack: first.pack,
      currentCampaignRevision: 13,
      changedSourceRefs: [],
      sceneChanged: true,
      criticalAuthorityChanged: false
    }), "STALE");
  }
  console.log("PASS [context] staleness statuses CURRENT/REPROJECT/REVALIDATE/STALE are covered");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
