import { runWorldTick } from "./engine";
import { createWorldStateFromCurrentMap } from "./mapAdapter";
import type { TickOutput, WorldState } from "./types";

export function createCurrentMapDemoState(): WorldState {
  const base = createWorldStateFromCurrentMap();
  const firstCity = Object.values(base.cities)[0];
  const firstDistrict = firstCity ? base.districts[firstCity.districtIds[0]] : undefined;
  const firstRoute = Object.values(base.routes)[0];

  if (!firstCity || !firstDistrict || !firstRoute) {
    return base;
  }

  base.factions = {
    "faction:auto:watch": {
      id: "faction:auto:watch",
      name: "Local Watch",
      type: "militia",
      tags: ["civic", "military"],
      influenceZoneIds: [firstDistrict.id, firstRoute.id],
      state: {
        resources: 52,
        power: 48,
        influence: 46,
        cohesion: 57,
        aggressiveness: 32,
        discretion: 35,
        security: 54
      },
      objectives: [{ objectiveId: "objective:auto:secure-route", priority: 72 }],
      relations: [],
      recentHistory: [],
      cooldowns: {}
    },
    "faction:auto:smugglers": {
      id: "faction:auto:smugglers",
      name: "Smugglers Ring",
      type: "criminal_network",
      tags: ["criminal", "trade"],
      influenceZoneIds: [firstDistrict.id],
      state: {
        resources: 49,
        power: 41,
        influence: 55,
        cohesion: 44,
        aggressiveness: 52,
        discretion: 63,
        security: 28
      },
      objectives: [{ objectiveId: "objective:auto:find-cache", priority: 76 }],
      relations: [],
      recentHistory: [],
      cooldowns: {}
    }
  };

  base.specialObjectives = {
    "objective:auto:secure-route": {
      id: "objective:auto:secure-route",
      category: "open_route",
      owner: { kind: "faction", id: "faction:auto:watch" },
      target: { kind: "route", id: firstRoute.id },
      priority: 72,
      state: "active",
      progress: 25,
      zoneIds: [firstRoute.id],
      phases: [],
      currentPhaseIndex: 0,
      phaseHistory: [],
      obstacles: ["low_patrol_density"],
      compatibleActionIds: ["secure_route", "escort_convoy", "patrol"],
      failureScore: 0,
      maxFailureScore: 100,
      fatalFailureConditions: [],
      onSuccess: [{ type: "open_opportunity", kind: "scarcity_trade", score: 58, tags: ["route", "trade"] }],
      onFailure: [{ type: "create_tension", tensionType: "mobility_risk", severity: 44, tags: ["route", "unsafe"] }],
      successConsequencesApplied: false,
      failureConsequencesApplied: false,
      tags: ["route", "security"]
    },
    "objective:auto:find-cache": {
      id: "objective:auto:find-cache",
      category: "search_object",
      owner: { kind: "faction", id: "faction:auto:smugglers" },
      target: { kind: "district", id: firstDistrict.id },
      priority: 76,
      state: "active",
      progress: 18,
      zoneIds: [firstDistrict.id],
      phases: [],
      currentPhaseIndex: 0,
      phaseHistory: [],
      obstacles: ["watch_presence"],
      compatibleActionIds: ["investigate", "infiltrate", "question_source"],
      failureScore: 0,
      maxFailureScore: 100,
      fatalFailureConditions: [],
      onSuccess: [{ type: "open_opportunity", kind: "investigation_lead", score: 61, tags: ["cache", "smuggling"] }],
      onFailure: [{ type: "create_tension", tensionType: "control_conflict", severity: 51, tags: ["watch", "smugglers"] }],
      successConsequencesApplied: false,
      failureConsequencesApplied: false,
      tags: ["cache", "contraband"]
    }
  };

  base.mobileActors = {
    "mobile:auto:convoy": {
      id: "mobile:auto:convoy",
      typeEntity: "caravan",
      mobile: true,
      owner: { kind: "faction", id: "faction:auto:watch" },
      position: { kind: "route", id: firstRoute.id },
      destination: { kind: "city", id: firstCity.id },
      itinerary: [firstRoute.id],
      travelMode: "road",
      speed: 4,
      routeProgress: 0,
      state: {
        security: 42,
        fatigue: 14,
        cargo: 38,
        headcount: 18,
        resources: 12
      },
      objectives: [{ objectiveId: "objective:auto:secure-route", priority: 48 }],
      possibleInteractionTags: ["trade", "escort"],
      recentHistory: [],
      simulationLevel: "active",
      cooldowns: {}
    }
  };

  firstDistrict.factionInfluence = {
    "faction:auto:watch": 32,
    "faction:auto:smugglers": 46
  };
  firstCity.factionInfluence = {
    "faction:auto:watch": 38,
    "faction:auto:smugglers": 27
  };
  firstRoute.mobileActorIds = ["mobile:auto:convoy"];
  return base;
}

export function runCurrentMapDemoTicks(): { outputs: TickOutput[]; finalState: WorldState } {
  const state = createCurrentMapDemoState();
  const outputs = [runWorldTick(state, "macro"), runWorldTick(state, "micro"), runWorldTick(state, "macro")];
  return { outputs, finalState: state };
}
