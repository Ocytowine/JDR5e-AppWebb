import { createRequire } from "node:module";
import type { TickOutput, WorldHistoryEntry, WorldState } from "../map-module/world-simulation/types";

const require = createRequire(import.meta.url);
require.extensions[".png"] = (module, filename) => {
  module.exports = filename;
};

const layout = require("../map-module/data/layouts/simulation_sandbox.json");

type MobilityWindow = {
  fromTick: number;
  toTick: number;
  progress: number;
  arrived: number;
  delayed: number;
  blocked: number;
  rerouted: number;
  idle: number;
  generated: number;
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
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

function countGeneratedSince(state: WorldState, fromTick: number): number {
  return getEntityHistories(state).filter(entry => entry.type === "mobile_generated" && entry.tick >= fromTick).length;
}

function isSameRef(left: { kind: string; id: string } | undefined, right: { kind: string; id: string } | undefined): boolean {
  return Boolean(left && right && left.kind === right.kind && left.id === right.id);
}

function hasTravelAssignment(actor: WorldState["mobileActors"][string]): boolean {
  return actor.itinerary.length > 0 || Boolean(actor.destination && !isSameRef(actor.position, actor.destination));
}

function hasActiveObjective(state: WorldState, actor: WorldState["mobileActors"][string]): boolean {
  return actor.objectives.some(goal => {
    const objective = state.specialObjectives[goal.objectiveId];
    return Boolean(objective) && objective.state !== "completed" && objective.state !== "failed" && objective.state !== "blocked";
  });
}

function buildWindow(outputs: TickOutput[], state: WorldState, windowSize: number): MobilityWindow {
  const selected = outputs.slice(-windowSize);
  const fromTick = selected[0]?.tick ?? state.clock.tick;
  const toTick = selected[selected.length - 1]?.tick ?? state.clock.tick;
  const mobility = selected.flatMap(output => output.trace?.mobility ?? []);
  return {
    fromTick,
    toTick,
    progress: mobility.filter(entry => entry.outcome === "progress").length,
    arrived: mobility.filter(entry => entry.outcome === "arrived").length,
    delayed: mobility.filter(entry => entry.outcome === "delayed").length,
    blocked: mobility.filter(entry => entry.outcome === "blocked").length,
    rerouted: mobility.filter(entry => entry.outcome === "rerouted").length,
    idle: mobility.filter(entry => entry.outcome === "idle").length,
    generated: countGeneratedSince(state, fromTick)
  };
}

async function main() {
  const [{ createWorldStateFromMapLayout }, { runWorldHours }] = await Promise.all([
    import("../map-module/world-simulation/mapAdapter"),
    import("../map-module/world-simulation/engine")
  ]);

  const totalTicks = 120;
  const windowSize = 30;
  const state = createWorldStateFromMapLayout(layout);
  const outputs: TickOutput[] = [];

  for (let index = 0; index < totalTicks; index += 1) {
    outputs.push(runWorldHours(state, 1));
  }

  const finalWindow = buildWindow(outputs, state, windowSize);
  const totalGenerated = countGeneratedSince(state, 0);
  const runtimeMobiles = Object.values(state.mobileActors).filter(actor => actor.id.startsWith("mobile:runtime:"));
  const assignedMobiles = Object.values(state.mobileActors).filter(hasTravelAssignment);
  const strandedRuntimeMobiles = runtimeMobiles.filter(actor => !hasTravelAssignment(actor) && !hasActiveObjective(state, actor));
  const strandedRuntimeMobilesOnRoute = strandedRuntimeMobiles.filter(actor => actor.position.kind === "route");
  const highFatigueAssigned = assignedMobiles.filter(actor => (actor.state.fatigue ?? 0) >= 82);
  const mobileActorsInActions = outputs
    .slice(-windowSize)
    .flatMap(output => output.trace?.selectedActions ?? [])
    .filter(action => action.actorRef.kind === "mobileActor").length;
  const meaningfulMovement = finalWindow.progress + finalWindow.arrived + finalWindow.rerouted;

  assert(totalGenerated >= 1, `La simulation longue devrait generer au moins un mobile runtime, actuel=${totalGenerated}`);
  assert(
    assignedMobiles.length === 0 || meaningfulMovement > 0 || finalWindow.generated > 0,
    `La derniere fenetre ne doit pas stagner si des mobiles restent assignes: ${JSON.stringify(finalWindow)}`
  );
  assert(
    highFatigueAssigned.length <= Math.max(2, Math.floor(assignedMobiles.length * 0.35)),
    `Trop de mobiles assignes restent coinces en fatigue haute: ${highFatigueAssigned.map(actor => actor.id).join(", ")}`
  );
  assert(
    mobileActorsInActions <= windowSize * 4,
    `Les mobiles ne devraient pas saturer les actions systemiques sans mission claire, actuel=${mobileActorsInActions}`
  );
  assert(
    strandedRuntimeMobilesOnRoute.length === 0,
    `Des mobiles runtime obsoletes restent bloques sur route: ${strandedRuntimeMobilesOnRoute.map(actor => actor.id).join(", ")}`
  );

  const report = {
    totalTicks,
    windowSize,
    totalGenerated,
    runtimeMobileCount: runtimeMobiles.length,
    assignedMobileCount: assignedMobiles.length,
    strandedRuntimeMobileCount: strandedRuntimeMobiles.length,
    strandedRuntimeMobilesOnRouteCount: strandedRuntimeMobilesOnRoute.length,
    highFatigueAssignedCount: highFatigueAssigned.length,
    mobileActorsInActions,
    finalWindow
  };

  console.log("[OK] mobility long-run sandbox -> mobile activity remains unstuck");
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
