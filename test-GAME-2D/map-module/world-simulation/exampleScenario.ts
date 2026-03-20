import { runWorldTick } from "./engine";
import type { TickOutput, WorldState } from "./types";

export function createExampleWorldState(): WorldState {
  return {
    clock: {
      tick: 0,
      microTick: 0,
      macroTick: 0,
      minutesPerMicroTick: 15,
      microPerMacro: 4
    },
    cities: {
      valecroft: {
        id: "valecroft",
        name: "Valecroft",
        regionId: "greenmarch",
        districtIds: ["valecroft-docks", "valecroft-heights"],
        routeIds: ["amber-road"],
        tags: ["trade_city"],
        state: {
          order: 46,
          commerce: 58,
          fear: 24,
          corruption: 36,
          supply: 43,
          attractiveness: 54
        },
        factionInfluence: {
          "faction-militia": 42,
          "faction-guild": 35
        },
        structuralPlaces: ["old-harbor", "grain-exchange"],
        recentHistory: [],
        activeTensionIds: []
      }
    },
    districts: {
      "valecroft-docks": {
        id: "valecroft-docks",
        name: "Docks",
        cityId: "valecroft",
        connectionIds: ["valecroft-heights", "amber-road"],
        tags: ["port", "market"],
        state: {
          danger: 68,
          wealth: 44,
          surveillance: 26,
          agitation: 57,
          commerce: 61,
          populationDensity: 72,
          fear: 42
        },
        factionInfluence: {
          "faction-militia": 24,
          "faction-guild": 48
        },
        importantPlaces: ["fish-market", "river-gate"],
        dominantActivities: ["trade", "smuggling"],
        activeTensionIds: [],
        recentHistory: [],
        ambientSignals: []
      },
      "valecroft-heights": {
        id: "valecroft-heights",
        name: "Heights",
        cityId: "valecroft",
        connectionIds: ["valecroft-docks"],
        tags: ["residential", "administrative"],
        state: {
          danger: 24,
          wealth: 67,
          surveillance: 58,
          agitation: 21,
          commerce: 42,
          populationDensity: 39,
          fear: 14
        },
        factionInfluence: {
          "faction-militia": 51,
          "faction-guild": 18
        },
        importantPlaces: ["watch-hall", "manor-step"],
        dominantActivities: ["administration", "craft"],
        activeTensionIds: [],
        recentHistory: [],
        ambientSignals: []
      }
    },
    routes: {
      "amber-road": {
        id: "amber-road",
        originId: "valecroft",
        destinationId: "stonewatch",
        travelCost: 3,
        length: 10,
        tags: ["road", "trade"],
        state: {
          security: 33,
          traffic: 52,
          materialState: 49,
          control: 37,
          ambushRisk: 63
        },
        recentHistory: [],
        mobileActorIds: ["mobile-convoy"]
      }
    },
    regions: {
      greenmarch: {
        id: "greenmarch",
        name: "Greenmarch",
        cityIds: ["valecroft"],
        mainRouteIds: ["amber-road"],
        state: {
          stability: 48,
          politicalControl: 46,
          production: 59,
          circulation: 51,
          externalThreat: 29
        },
        dominantWeather: "rainy",
        activeTensionIds: [],
        tags: ["borderland"]
      }
    },
    factions: {
      "faction-militia": {
        id: "faction-militia",
        name: "City Militia",
        type: "militia",
        tags: ["civic", "military"],
        influenceZoneIds: ["valecroft-heights", "amber-road"],
        state: {
          resources: 58,
          power: 54,
          influence: 46,
          cohesion: 62,
          aggressiveness: 38,
          discretion: 41,
          security: 58
        },
        objectives: [{ objectiveId: "obj-secure-road", priority: 74 }],
        relations: [{ otherFactionId: "faction-guild", status: "neutral", trust: 42, hostility: 28 }],
        recentHistory: [],
        cooldowns: {}
      },
      "faction-guild": {
        id: "faction-guild",
        name: "Ashen Ledger",
        type: "criminal_guild",
        tags: ["criminal", "trade"],
        influenceZoneIds: ["valecroft-docks"],
        state: {
          resources: 62,
          power: 47,
          influence: 52,
          cohesion: 49,
          aggressiveness: 56,
          discretion: 61,
          security: 34
        },
        objectives: [{ objectiveId: "obj-sacred-ledger", priority: 78 }],
        relations: [{ otherFactionId: "faction-militia", status: "rival", trust: 14, hostility: 66 }],
        recentHistory: [],
        cooldowns: {}
      }
    },
    specialObjectives: {
      "obj-sacred-ledger": {
        id: "obj-sacred-ledger",
        category: "search_object",
        owner: { kind: "faction", id: "faction-guild" },
        target: { kind: "district", id: "valecroft-docks" },
        priority: 78,
        state: "active",
        progress: 20,
        zoneIds: ["valecroft-docks"],
        obstacles: ["militia_presence", "competing_informants"],
        compatibleActionIds: ["investigate", "question_source", "infiltrate"],
        onSuccess: [
          { type: "open_opportunity", kind: "investigation_lead", score: 72, tags: ["artifact", "guild"] },
          { type: "spawn_signal", signalKind: "religious", intensity: 58, tags: ["artifact", "ritual-trace"] }
        ],
        onFailure: [{ type: "create_tension", tensionType: "control_conflict", severity: 55, tags: ["guild", "failure"] }],
        tags: ["artifact", "secret"]
      },
      "obj-secure-road": {
        id: "obj-secure-road",
        category: "open_route",
        owner: { kind: "faction", id: "faction-militia" },
        target: { kind: "route", id: "amber-road" },
        priority: 74,
        state: "active",
        progress: 34,
        zoneIds: ["amber-road", "greenmarch"],
        obstacles: ["bandit_cells", "low_patrol_density"],
        compatibleActionIds: ["secure_route", "escort_convoy", "patrol"],
        onSuccess: [{ type: "open_opportunity", kind: "scarcity_trade", score: 64, tags: ["route", "trade"] }],
        onFailure: [{ type: "create_tension", tensionType: "mobility_risk", severity: 48, tags: ["route", "unsafe"] }],
        tags: ["trade", "security"]
      }
    },
    mobileActors: {
      "mobile-convoy": {
        id: "mobile-convoy",
        typeEntity: "caravan",
        mobile: true,
        owner: { kind: "faction", id: "faction-militia" },
        position: { kind: "route", id: "amber-road" },
        destination: { kind: "city", id: "valecroft" },
        itinerary: ["amber-road"],
        travelMode: "road",
        speed: 5,
        routeProgress: 0,
        state: {
          security: 44,
          fatigue: 18,
          cargo: 61,
          headcount: 26,
          resources: 18
        },
        objectives: [{ objectiveId: "obj-secure-road", priority: 52 }],
        possibleInteractionTags: ["trade", "escort", "bandits"],
        recentHistory: [],
        simulationLevel: "active",
        cooldowns: {}
      }
    },
    tensions: {},
    pressures: {},
    pendingSignals: [],
    pendingRumors: [],
    pendingOpportunities: []
  };
}

export function runExampleScenario(): { outputs: TickOutput[]; finalState: WorldState } {
  const state = createExampleWorldState();
  const outputs = [runWorldTick(state, "macro"), runWorldTick(state, "micro"), runWorldTick(state, "macro")];
  return { outputs, finalState: state };
}
