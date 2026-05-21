import layout from "../map-module/data/layouts/simulation_sandbox.json";
import { createWorldStateFromMapLayout } from "../map-module/world-simulation/mapAdapter";
import { runWorldHours } from "../map-module/world-simulation/engine";

function topEntries<T>(values: T[], score: (value: T) => number, limit = 3) {
  return values.slice().sort((left, right) => score(right) - score(left)).slice(0, limit);
}

const state = createWorldStateFromMapLayout(layout);
const snapshots = [];

for (let index = 0; index < 20; index += 1) {
  const output = runWorldHours(state, state.clock.microPerMacro);
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

  snapshots.push({
    tick: state.clock.tick,
    eventCount: output.events.length,
    topSocial: topEntries(districtPressures, entry => entry.social),
    topCriminal: topEntries(districtPressures, entry => entry.criminal),
    topMilitary: topEntries(routePressures, entry => entry.military),
    topCommercial: topEntries(cityPressures, entry => entry.commercial),
    systemObjectives: activeSystemObjectives.slice(0, 12),
    systemFactions: activeSystemFactions.slice(0, 12)
  });
}

console.log(JSON.stringify(snapshots, null, 2));
