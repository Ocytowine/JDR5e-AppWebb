import { createRequire } from "node:module";
import type { TickOutput } from "../map-module/world-simulation/types";

const require = createRequire(import.meta.url);
require.extensions[".png"] = (module, filename) => {
  module.exports = filename;
};

const layout = require("../map-module/data/layouts/simulation_sandbox.json");

function topEntries<T>(values: T[], score: (value: T) => number, limit = 3) {
  return values.slice().sort((left, right) => score(right) - score(left)).slice(0, limit);
}

async function main() {
  const [{ createWorldStateFromMapLayout }, { runWorldHours }] = await Promise.all([
    import("../map-module/world-simulation/mapAdapter"),
    import("../map-module/world-simulation/engine")
  ]);

  const state = createWorldStateFromMapLayout(layout);
  const snapshots = [];
  const outputs: TickOutput[] = [];

  for (let index = 0; index < 20; index += 1) {
    const output = runWorldHours(state, state.clock.microPerMacro);
    outputs.push(output);
    const districtPressures = Object.entries(state.pressures.district ?? {}).map(([id, pressure]) => ({
      id,
      social: pressure.social ?? 0,
      criminal: pressure.criminal ?? 0,
      religious: pressure.religious ?? 0
    }));
    const routePressures = Object.entries(state.pressures.route ?? {}).map(([id, pressure]) => ({
      id,
      military: pressure.military ?? 0
    }));
    const cityPressures = Object.entries(state.pressures.city ?? {}).map(([id, pressure]) => ({
      id,
      commercial: pressure.commercial ?? 0
    }));
    const activeSystemObjectives = Object.values(state.specialObjectives)
      .filter(objective => objective.tags.includes("system_generated"))
      .map(objective => ({
        id: objective.id,
        owner: objective.owner.id,
        category: objective.category,
        state: objective.state,
        priority: objective.priority,
        target: objective.target?.id
      }));
    const activeSystemFactions = Object.values(state.factions)
      .filter(faction => faction.tags.includes("system"))
      .map(faction => ({
        id: faction.id,
        resources: faction.state.resources ?? 0,
        topObjectives: faction.objectives.slice(0, 3).map(goal => goal.objectiveId)
      }));
    const activeTensions = Object.values(state.tensions).map(tension => ({
      id: tension.id,
      type: tension.type,
      severity: Math.round(tension.severity),
      target: tension.targetRefs.map(ref => `${ref.kind}:${ref.id}`).join(",")
    }));

    snapshots.push({
      tick: state.clock.tick,
      macroTick: state.clock.macroTick,
      eventCount: output.events.length,
      deltaCount: output.deltas.length,
      selectedActionCount: output.trace?.selectedActions.length ?? 0,
      activeTensionCount: activeTensions.length,
      topTensions: topEntries(activeTensions, entry => entry.severity),
      topSocial: topEntries(districtPressures, entry => entry.social),
      topCriminal: topEntries(districtPressures, entry => entry.criminal),
      topMilitary: topEntries(routePressures, entry => entry.military),
      topCommercial: topEntries(cityPressures, entry => entry.commercial),
      systemObjectives: activeSystemObjectives.slice(0, 12),
      systemFactions: activeSystemFactions.slice(0, 12)
    });
  }

  const summary = {
    macroCycles: snapshots.length,
    totalEvents: outputs.reduce((sum, output) => sum + output.events.length, 0),
    totalDeltas: outputs.reduce((sum, output) => sum + output.deltas.length, 0),
    totalSelectedActions: outputs.reduce((sum, output) => sum + (output.trace?.selectedActions.length ?? 0), 0),
    finalTensionCount: Object.keys(state.tensions).length,
    finalSystemObjectiveCount: Object.values(state.specialObjectives).filter(objective => objective.tags.includes("system_generated")).length
  };

  console.log(JSON.stringify({ summary, snapshots }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
