import { createRequire } from "node:module";
import type { TickOutput, WorldHistoryEntry, WorldState } from "../map-module/world-simulation/types";

const require = createRequire(import.meta.url);
require.extensions[".png"] = (module, filename) => {
  module.exports = filename;
};

const layout = require("../map-module/data/layouts/simulation_sandbox.json");

type LongRunSnapshot = {
  macroTick: number;
  eventCount: number;
  deltaCount: number;
  selectedActionCount: number;
  activeTensionCount: number;
  maxTensionSeverity: number;
  systemObjectiveCount: number;
  factionGeneratedObjectiveCount: number;
  systemFactionCount: number;
  systemFactionsWithObjectives: number;
  systemFactionsOutOfResources: number;
  objectiveCategories: string[];
  tensionIdsOver80: string[];
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function getEntityHistories(state: WorldState): WorldHistoryEntry[] {
  return [
    ...Object.values(state.cities).flatMap(entity => entity.recentHistory),
    ...Object.values(state.districts).flatMap(entity => entity.recentHistory),
    ...Object.values(state.routes).flatMap(entity => entity.recentHistory),
    ...Object.values(state.regions).flatMap(entity => entity.recentHistory),
    ...Object.values(state.factions).flatMap(entity => entity.recentHistory),
    ...Object.values(state.mobileActors).flatMap(entity => entity.recentHistory)
  ];
}

function countHistoryType(entries: WorldHistoryEntry[], type: string): number {
  return entries.filter(entry => entry.type === type).length;
}

function countHistorySummary(entries: WorldHistoryEntry[], type: string, pattern: string): number {
  return entries.filter(entry => entry.type === type && entry.summary.includes(pattern)).length;
}

function buildSnapshot(state: WorldState, output: TickOutput): LongRunSnapshot {
  const tensions = Object.values(state.tensions);
  const systemObjectives = Object.values(state.specialObjectives).filter(objective => objective.tags.includes("system_generated"));
  const factionGeneratedObjectives = Object.values(state.specialObjectives).filter(objective => objective.tags.includes("faction_generated"));
  const systemFactions = Object.values(state.factions).filter(faction => faction.tags.includes("system"));
  return {
    macroTick: state.clock.macroTick,
    eventCount: output.events.length,
    deltaCount: output.deltas.length,
    selectedActionCount: output.trace?.selectedActions.length ?? 0,
    activeTensionCount: tensions.length,
    maxTensionSeverity: Math.max(0, ...tensions.map(tension => tension.severity)),
    systemObjectiveCount: systemObjectives.length,
    factionGeneratedObjectiveCount: factionGeneratedObjectives.length,
    systemFactionCount: systemFactions.length,
    systemFactionsWithObjectives: systemFactions.filter(faction => faction.objectives.length > 0).length,
    systemFactionsOutOfResources: systemFactions.filter(faction => (faction.state.resources ?? 0) <= 0).length,
    objectiveCategories: unique(systemObjectives.map(objective => objective.category)).sort(),
    tensionIdsOver80: tensions
      .filter(tension => tension.severity >= 80)
      .map(tension => tension.id)
      .sort()
  };
}

function getLongestHighSeverityStreak(snapshots: LongRunSnapshot[]): { tensionId: string; streak: number } {
  const current = new Map<string, number>();
  let longest = { tensionId: "none", streak: 0 };

  snapshots.forEach(snapshot => {
    const active = new Set(snapshot.tensionIdsOver80);
    [...current.keys()].forEach(tensionId => {
      if (!active.has(tensionId)) current.delete(tensionId);
    });
    active.forEach(tensionId => {
      const next = (current.get(tensionId) ?? 0) + 1;
      current.set(tensionId, next);
      if (next > longest.streak) {
        longest = { tensionId, streak: next };
      }
    });
  });

  return longest;
}

async function main() {
  const [{ createWorldStateFromMapLayout }, { runWorldHours }] = await Promise.all([
    import("../map-module/world-simulation/mapAdapter"),
    import("../map-module/world-simulation/engine")
  ]);

  const macroCycles = 30;
  const state = createWorldStateFromMapLayout(layout);
  const outputs: TickOutput[] = [];
  const snapshots: LongRunSnapshot[] = [];
  const observedObjectiveCategories = new Set<string>();
  const observedFactionGeneratedObjectiveIds = new Set<string>();
  const observedFactionGeneratedKinds = new Set<string>();
  const observedRelationGeneratedObjectiveIds = new Set<string>();
  const observedHistoryTypes = new Set<string>();
  let opportunisticActionCount = 0;

  for (let index = 0; index < macroCycles; index += 1) {
    const output = runWorldHours(state, state.clock.microPerMacro);
    outputs.push(output);
    const snapshot = buildSnapshot(state, output);
    snapshots.push(snapshot);
    snapshot.objectiveCategories.forEach(category => observedObjectiveCategories.add(category));
    getEntityHistories(state).forEach(entry => observedHistoryTypes.add(entry.type));
    Object.values(state.specialObjectives)
      .filter(objective => objective.tags.includes("faction_generated"))
      .forEach(objective => {
        observedFactionGeneratedObjectiveIds.add(objective.id);
        if (objective.tags.includes("relation_generated")) {
          observedRelationGeneratedObjectiveIds.add(objective.id);
        }
        objective.tags
          .filter(tag => ["criminal", "religious", "merchant", "military", "rival", "war", "ally", "cooperation_generated"].includes(tag))
          .forEach(tag => observedFactionGeneratedKinds.add(tag));
      });
    output.trace?.selectedActions.forEach(action => {
      if (action.actorRef.kind !== "faction") return;
      const faction = state.factions[action.actorRef.id];
      if (!faction || faction.tags.includes("system")) return;
      const objective = action.objectiveId ? state.specialObjectives[action.objectiveId] : undefined;
      if (objective?.tags.includes("faction_generated")) {
        opportunisticActionCount += 1;
      }
    });
  }

  const lastFive = snapshots.slice(-5);
  const allHistory = getEntityHistories(state);
  const totalEvents = outputs.reduce((sum, output) => sum + output.events.length, 0);
  const totalDeltas = outputs.reduce((sum, output) => sum + output.deltas.length, 0);
  const totalSelectedActions = outputs.reduce((sum, output) => sum + (output.trace?.selectedActions.length ?? 0), 0);
  const maxActiveTensionCount = Math.max(0, ...snapshots.map(snapshot => snapshot.activeTensionCount));
  const longestHighSeverity = getLongestHighSeverityStreak(snapshots);
  const finalSnapshot = snapshots[snapshots.length - 1];

  assert(finalSnapshot.macroTick >= macroCycles, `Le long-run devrait atteindre ${macroCycles} macro ticks, actuel=${finalSnapshot.macroTick}`);
  assert(totalEvents >= macroCycles * 8, `Le monde devrait produire des evenements sur la duree, actuel=${totalEvents}`);
  assert(totalDeltas >= macroCycles * 20, `Le monde devrait produire des deltas sur la duree, actuel=${totalDeltas}`);
  assert(totalSelectedActions >= macroCycles * 5, `Des acteurs devraient continuer a agir, actuel=${totalSelectedActions}`);
  assert(lastFive.every(snapshot => snapshot.eventCount > 0), "Les 5 derniers macro-cycles devraient encore produire des evenements");
  assert(lastFive.every(snapshot => snapshot.selectedActionCount > 0), "Les 5 derniers macro-cycles devraient encore selectionner des actions");
  assert(maxActiveTensionCount <= 32, `Les tensions actives ne devraient pas exploser, max=${maxActiveTensionCount}`);
  assert(longestHighSeverity.streak <= 5, `La tension ${longestHighSeverity.tensionId} reste >=80 trop longtemps (${longestHighSeverity.streak} cycles)`);
  assert(observedObjectiveCategories.size >= 3, `Le long-run devrait mobiliser plusieurs categories d'objectifs, actuel=${[...observedObjectiveCategories].join(", ")}`);
  assert(opportunisticActionCount >= 3, `Des factions non-systeme devraient exploiter des crises, actuel=${opportunisticActionCount}`);
  assert(observedFactionGeneratedObjectiveIds.size >= 2, `Le long-run devrait observer plusieurs objectifs faction_generated, actuel=${observedFactionGeneratedObjectiveIds.size}`);
  assert(observedFactionGeneratedKinds.size >= 2, `Le long-run devrait observer plusieurs familles opportunistes, actuel=${[...observedFactionGeneratedKinds].join(", ")}`);
  assert(observedFactionGeneratedKinds.has("criminal"), "Le long-run devrait observer des opportunites criminelles");
  assert(observedFactionGeneratedKinds.has("merchant"), "Le long-run devrait observer des opportunites marchandes");
  assert(observedFactionGeneratedKinds.has("military"), "Le long-run devrait observer des opportunites militaires");
  assert(observedRelationGeneratedObjectiveIds.size >= 1, "Le long-run devrait observer au moins un objectif genere par relation hostile");
  assert(finalSnapshot.systemObjectiveCount > 0, "Le monde devrait conserver ou regenerer des objectifs systeme en fin de long-run");
  assert(finalSnapshot.systemFactionsOutOfResources < finalSnapshot.systemFactionCount, "Toutes les factions systeme ne devraient pas etre a court de ressources en fin de long-run");
  assert(countHistoryType(allHistory, "tension_relieved") > 0, "Le long-run devrait conserver des traces de tensions soulagees");
  assert(countHistoryType(allHistory, "relation_shift") >= 3, "Le long-run devrait produire des changements de relations inter-factions");
  assert(countHistoryType(allHistory, "mobile_generated") >= 1, "Le long-run devrait generer au moins un mobile runtime autonome");
  assert(
    observedHistoryTypes.has("tension_created") || observedHistoryTypes.has("tension_reinforced"),
    "Le long-run devrait observer des tensions creees ou renforcees"
  );

  const report = {
    macroCycles,
    totalEvents,
    totalDeltas,
    totalSelectedActions,
    totalOpportunisticActions: opportunisticActionCount,
    observedFactionGeneratedObjectiveCount: observedFactionGeneratedObjectiveIds.size,
    observedRelationGeneratedObjectiveCount: observedRelationGeneratedObjectiveIds.size,
    observedFactionGeneratedKinds: [...observedFactionGeneratedKinds].sort(),
    maxActiveTensionCount,
    longestHighSeverity,
    final: finalSnapshot,
    observedObjectiveCategories: [...observedObjectiveCategories].sort(),
    finalHistoryCounters: {
      tensionCreated: countHistoryType(allHistory, "tension_created"),
      tensionReinforced: countHistoryType(allHistory, "tension_reinforced"),
      tensionRelieved: countHistoryType(allHistory, "tension_relieved"),
      tensionResolved: countHistoryType(allHistory, "tension_resolved"),
      relationShift: countHistoryType(allHistory, "relation_shift"),
      antiRivalRelationShift: countHistorySummary(allHistory, "relation_shift", "anti_rival_success"),
      allianceSupportRelationShift: countHistorySummary(allHistory, "relation_shift", "alliance_support_success"),
      mobileGenerated: countHistoryType(allHistory, "mobile_generated"),
      mobileArrivalEffect: countHistoryType(allHistory, "mobile_arrival_effect"),
      mobileDelayEffect: countHistoryType(allHistory, "mobile_delay_effect"),
      mobileAmbushEffect: countHistoryType(allHistory, "mobile_ambush_effect"),
      mobileLocalReaction: countHistoryType(allHistory, "mobile_local_reaction"),
      mobileEncounter: countHistoryType(allHistory, "mobile_encounter")
    }
  };

  console.log("[OK] long-run sandbox -> anti-stagnation checks passed");
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
