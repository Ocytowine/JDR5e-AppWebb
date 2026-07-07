import {
  InMemoryMemoryRepositoryV1,
  validateMemoryCapsuleV1,
  validateMemoryIndexEntryV1,
  type MemoryRecallQueryV1,
  type MemorySourceRefV1,
  type MemoryUnitV1
} from "../../src/memory";
import { assert } from "../contracts/assertions";

const campaignId = "campaign-memory-001";
const playerId = "pc-aryn";

function source(sourceId: string, path: string | null = null): MemorySourceRefV1 {
  return {
    schemaVersion: 1,
    sourceKind: "EVENT",
    sourceId,
    campaignId,
    ownerDomain: "narration.memory.fixture",
    version: 1,
    path,
    fingerprint: null
  };
}

function memory(overrides: Partial<MemoryUnitV1>): MemoryUnitV1 {
  return {
    schemaVersion: 1,
    memoryId: "memory-base",
    campaignId,
    sourceRefs: [source("event-base")],
    unitType: "FACT",
    validity: "CURRENT_TRUE",
    recallCycle: "ACTIVE",
    visibility: "PLAYER_CHARACTER",
    actorScope: [],
    anchors: [],
    importance: { systemic: 50, narrative: 50 },
    gameTimeRange: { from: 0, to: null },
    text: "Base memory.",
    summary: null,
    supersedesMemoryIds: [],
    supersededByMemoryId: null,
    createdByEventId: null,
    ...overrides
  };
}

function query(overrides: Partial<MemoryRecallQueryV1>): MemoryRecallQueryV1 {
  return {
    schemaVersion: 1,
    queryId: "query-base",
    campaignId,
    baseCampaignRevision: 7,
    perspective: { kind: "PLAYER_CHARACTER", actorId: playerId },
    purpose: "PLAYER_MENTION",
    strongTriggers: [],
    secondaryTriggers: [],
    requiredSourceRefs: [],
    candidateBudget: { structured: 2, graph: 2, text: 2, semantic: 0 },
    outputBudgetUnits: 120,
    ...overrides
  };
}

async function run(): Promise<void> {
  const repository = new InMemoryMemoryRepositoryV1();
  await repository.upsertMemoryUnits([
    memory({
      memoryId: "memory-archives-current",
      sourceRefs: [source("event-archives-visit", "/payload/locationState")],
      unitType: "LOCATION_STATE",
      anchors: [
        { kind: "LOCATION", id: "archives_de_lysenthe", strength: "PRIMARY" },
        { kind: "TOPIC", id: "odeur_de_cire", strength: "SECONDARY" }
      ],
      importance: { systemic: 80, narrative: 75 },
      text: "Les Archives de Lysenthe ont maintenant une aile nord condamnée par un éboulement récent.",
      summary: "Archives de Lysenthe : aile nord condamnée après éboulement récent."
    }),
    memory({
      memoryId: "memory-archives-past",
      sourceRefs: [source("event-archives-first-visit")],
      unitType: "EVENT_SUMMARY",
      validity: "PAST_TRUE",
      recallCycle: "RELEVANT",
      anchors: [{ kind: "LOCATION", id: "archives_de_lysenthe", strength: "PRIMARY" }],
      importance: { systemic: 30, narrative: 60 },
      text: "Lors de la première visite, le grand hall des Archives sentait la cire froide.",
      summary: "Premier passage aux Archives : odeur de cire froide dans le grand hall."
    }),
    memory({
      memoryId: "memory-secret-betrayal",
      sourceRefs: [source("event-secret-betrayal")],
      unitType: "PLOT_COMMITMENT",
      visibility: "SYSTEM_ONLY",
      anchors: [
        { kind: "PLOT", id: "plot_conservateur_traitre", strength: "PRIMARY" },
        { kind: "LOCATION", id: "archives_de_lysenthe", strength: "SECONDARY" }
      ],
      importance: { systemic: 100, narrative: 100 },
      text: "Le conservateur a livré l'accès secret des Archives à la faction ennemie.",
      summary: "Secret MJ : le conservateur a trahi."
    }),
    memory({
      memoryId: "memory-unrelated-market",
      sourceRefs: [source("event-market")],
      unitType: "EVENT_SUMMARY",
      anchors: [{ kind: "LOCATION", id: "marche_du_quai", strength: "PRIMARY" }],
      text: "Le marché du quai manque de sel depuis trois jours.",
      summary: "Marché du quai : pénurie de sel."
    })
  ]);

  const report = await repository.rebuildIndexes(campaignId, "memory-context/1");
  assert.equal(report.rebuiltMemoryCount, 4);
  assert.equal(report.rebuiltIndexCount, 12);
  const indexes = await repository.listIndexEntries(campaignId);
  assert.equal(indexes.every(entry => validateMemoryIndexEntryV1(entry).ok), true);
  console.log("PASS [memory] index rebuild is deterministic cache, not source of truth");

  const recall = await repository.queryMemory(query({
    queryId: "query-paraphrase-archives",
    purpose: "RETURN_TO_PLACE",
    strongTriggers: [{ kind: "LOCATION", id: "archives_de_lysenthe", text: "je retourne aux archives vues il y a longtemps", strength: "STRONG" }],
    secondaryTriggers: [{ kind: "TEXT", id: null, text: "odeur cire", strength: "SECONDARY" }],
    outputBudgetUnits: 80
  }));
  assert.equal(recall.ok, true);
  if (recall.ok) {
    assert.deepEqual(recall.capsules.map(capsule => capsule.memoryIds[0]), ["memory-archives-current", "memory-archives-past"]);
    assert.equal(recall.capsules.every(capsule => validateMemoryCapsuleV1(capsule).ok), true);
    assert.equal(recall.capsules.some(capsule => capsule.memoryIds.includes("memory-unrelated-market")), false);
    assert.equal(recall.capsules.some(capsule => capsule.memoryIds.includes("memory-secret-betrayal")), false);
    assert.equal(recall.capsules[0].sourceRefs.length > 0, true);
  }
  console.log("PASS [memory] NAR-ACC-004/005 recall returns sourced relevant memories without useless neighbors or player secrets");

  const systemRecall = await repository.queryMemory(query({
    queryId: "query-system-secret",
    perspective: { kind: "SYSTEM_MJ" },
    strongTriggers: [{ kind: "PLOT", id: "plot_conservateur_traitre", text: "trahison conservateur", strength: "STRONG" }],
    outputBudgetUnits: 80
  }));
  assert.equal(systemRecall.ok, true);
  if (systemRecall.ok) {
    assert.equal(systemRecall.capsules.some(capsule => capsule.memoryIds.includes("memory-secret-betrayal")), true);
  }
  console.log("PASS [memory] NAR-ACC-006 perspective exposes hidden truth only to system MJ");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
