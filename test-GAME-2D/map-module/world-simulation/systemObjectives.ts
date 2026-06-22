import type {
  EntityId,
  EntityRef,
  ObjectiveCategory,
  ObjectivePhaseRuntime,
  SpecialObjective,
  WorldActionId,
  WorldCity,
  WorldDistrict,
  WorldFaction,
  WorldRoute,
  WorldState,
  WorldTension
} from "./types";

type SystemObjectiveBlueprint = {
  id: EntityId;
  ownerFactionId: EntityId;
  category: ObjectiveCategory;
  target: EntityRef;
  priority: number;
  zoneIds: EntityId[];
  compatibleActionIds: WorldActionId[];
  tags: string[];
  phaseLabel: string;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function getPressure(state: WorldState, ref: EntityRef, pressure: "criminal" | "social" | "commercial" | "military") {
  return state.pressures[ref.kind]?.[ref.id]?.[pressure] ?? 0;
}

function getActiveTensionIds(state: WorldState, ref: EntityRef): EntityId[] {
  switch (ref.kind) {
    case "city":
      return state.cities[ref.id]?.activeTensionIds ?? [];
    case "district":
      return state.districts[ref.id]?.activeTensionIds ?? [];
    case "route":
      return state.routes[ref.id]?.activeTensionIds ?? [];
    case "region":
      return state.regions[ref.id]?.activeTensionIds ?? [];
    default:
      return [];
  }
}

function getTensionSeverity(state: WorldState, ref: EntityRef, types: WorldTension["type"][]): number {
  return Math.max(
    0,
    ...getActiveTensionIds(state, ref)
      .map(tensionId => state.tensions[tensionId])
      .filter((tension): tension is WorldTension => Boolean(tension) && types.includes(tension.type))
      .map(tension => tension.severity)
  );
}

function isSystemFaction(faction: WorldFaction): boolean {
  return faction.tags.includes("system");
}

function hasSystemObjectiveTag(objective: SpecialObjective): boolean {
  return objective.tags.includes("system_generated");
}

function buildPhase(blueprint: SystemObjectiveBlueprint): ObjectivePhaseRuntime {
  return {
    id: `${blueprint.id}:phase:0`,
    label: blueprint.phaseLabel,
    state: "active",
    localTarget: blueprint.target,
    zoneIds: blueprint.zoneIds,
    compatibleActionIds: blueprint.compatibleActionIds,
    progress: 0,
    progressWeight: 1,
    completionMode: "progress_threshold",
    completionThreshold: 100,
    failureScore: 0,
    maxFailureScore: 100,
    failureMode: "score_threshold",
    fatalFailureConditions: [],
    notes: ["system_generated"]
  };
}

function buildObjectiveFromBlueprint(blueprint: SystemObjectiveBlueprint): SpecialObjective {
  return {
    id: blueprint.id,
    category: blueprint.category,
    owner: { kind: "faction", id: blueprint.ownerFactionId },
    target: blueprint.target,
    priority: blueprint.priority,
    state: "active",
    progress: 0,
    zoneIds: blueprint.zoneIds,
    phases: [buildPhase(blueprint)],
    currentPhaseIndex: 0,
    phaseHistory: [],
    obstacles: [],
    compatibleActionIds: blueprint.compatibleActionIds,
    failureScore: 0,
    maxFailureScore: 100,
    fatalFailureConditions: [],
    onSuccess: [],
    onFailure: [],
    successConsequencesApplied: false,
    failureConsequencesApplied: false,
    tags: blueprint.tags
  };
}

function ensureFactionGoal(faction: WorldFaction | undefined, objectiveId: EntityId, priority: number) {
  if (!faction) return;
  const existing = faction.objectives.find(goal => goal.objectiveId === objectiveId);
  if (existing) {
    existing.priority = priority;
  } else {
    faction.objectives.unshift({ objectiveId, priority });
  }
  faction.objectives = faction.objectives
    .slice()
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 8);
}

function removeObjectiveReferences(state: WorldState, objectiveId: EntityId) {
  Object.values(state.factions).forEach(faction => {
    faction.objectives = faction.objectives.filter(goal => goal.objectiveId !== objectiveId);
  });
  Object.values(state.mobileActors).forEach(actor => {
    actor.objectives = actor.objectives.filter(goal => goal.objectiveId !== objectiveId);
  });
}

function getCityByFactionId(state: WorldState, factionId: EntityId): WorldCity | undefined {
  const parts = factionId.split(":");
  const cityId = parts[parts.length - 1];
  return state.cities[cityId];
}

function getRegionIdByFactionId(factionId: EntityId): EntityId | undefined {
  const parts = factionId.split(":");
  return parts[parts.length - 1];
}

function selectDistrictByScore(city: WorldCity, state: WorldState, scorer: (district: WorldDistrict) => number): WorldDistrict | undefined {
  return city.districtIds
    .map(districtId => state.districts[districtId])
    .filter((district): district is WorldDistrict => Boolean(district))
    .sort((left, right) => scorer(right) - scorer(left))[0];
}

function selectRouteByScore(routeIds: EntityId[], state: WorldState, scorer: (route: WorldRoute) => number): WorldRoute | undefined {
  return routeIds
    .map(routeId => state.routes[routeId])
    .filter((route): route is WorldRoute => Boolean(route))
    .sort((left, right) => scorer(right) - scorer(left))[0];
}

function createGuardObjectives(state: WorldState, faction: WorldFaction): SystemObjectiveBlueprint[] {
  const city = getCityByFactionId(state, faction.id);
  if (!city) return [];
  const district = selectDistrictByScore(
    city,
    state,
    candidate => {
      const ref: EntityRef = { kind: "district", id: candidate.id };
      return (
        getPressure(state, ref, "criminal") * 0.55 +
        (candidate.state.danger ?? 0) * 0.25 +
        getTensionSeverity(state, ref, ["criminal", "control_conflict"]) * 0.2
      );
    }
  );
  if (!district) return [];
  const districtRef: EntityRef = { kind: "district", id: district.id };
  const criminalPressure = getPressure(state, districtRef, "criminal");
  const socialPressure = getPressure(state, districtRef, "social");
  const orderTension = getTensionSeverity(state, districtRef, ["criminal", "control_conflict"]);
  const unrestTension = getTensionSeverity(state, districtRef, ["social", "control_conflict"]);
  const results: SystemObjectiveBlueprint[] = [];

  if (criminalPressure >= 45 || orderTension >= 58) {
    results.push({
      id: `objective:system:restore_order:${faction.id}:${district.id}`,
      ownerFactionId: faction.id,
      category: "restore_order",
      target: { kind: "district", id: district.id },
      priority: clamp(Math.round(44 + criminalPressure * 0.46 + socialPressure * 0.1 + orderTension * 0.2)),
      zoneIds: [city.id, district.id],
      compatibleActionIds: district.tags.includes("commerce") ? ["patrol", "inspect_customs"] : ["patrol"],
      tags: ["system_generated", "maintenance", "public_guard", "restore_order"],
      phaseLabel: "Restauration de l'ordre"
    });
  }

  if ((socialPressure >= 58 || unrestTension >= 62) && ((district.state.danger ?? 0) >= 34 || criminalPressure >= 40 || orderTension >= 55)) {
    results.push({
      id: `objective:system:contain_unrest:${faction.id}:${district.id}`,
      ownerFactionId: faction.id,
      category: "contain_unrest",
      target: { kind: "district", id: district.id },
      priority: clamp(Math.round(40 + socialPressure * 0.38 + criminalPressure * 0.12 + unrestTension * 0.18)),
      zoneIds: [city.id, district.id],
      compatibleActionIds: district.tags.includes("commerce") ? ["public_reassurance", "patrol", "inspect_customs"] : ["public_reassurance", "patrol"],
      tags: ["system_generated", "maintenance", "public_guard", "contain_unrest"],
      phaseLabel: "Contenir les troubles"
    });
  }

  return results;
}

function createCivicObjectives(state: WorldState, faction: WorldFaction): SystemObjectiveBlueprint[] {
  const city = getCityByFactionId(state, faction.id);
  if (!city) return [];
  const candidate = city.districtIds
    .map(districtId => state.districts[districtId])
    .filter((district): district is WorldDistrict => Boolean(district))
    .map(district => {
      const ref: EntityRef = { kind: "district", id: district.id };
      const socialPressure = getPressure(state, ref, "social");
      const criminalPressure = getPressure(state, ref, "criminal");
      const civicTension = getTensionSeverity(state, ref, ["social", "religious", "political", "control_conflict"]);
      const score =
        socialPressure * 0.55 +
        (district.state.fear ?? 0) * 0.12 +
        (district.state.agitation ?? 0) * 0.13 +
        civicTension * 0.2;
      return { district, socialPressure, criminalPressure, civicTension, score };
    })
    .filter(entry => entry.socialPressure >= 50 || entry.criminalPressure >= 42 || entry.civicTension >= 55)
    .sort((left, right) => right.score - left.score)[0];
  if (!candidate) return [];
  const { district, socialPressure, criminalPressure, civicTension } = candidate;
  if (socialPressure < 50 && criminalPressure < 42 && civicTension < 55) return [];
  return [
    {
      id: `objective:system:reduce_fear:${faction.id}:${district.id}`,
      ownerFactionId: faction.id,
      category: "reduce_fear",
      target: { kind: "district", id: district.id },
      priority: clamp(Math.round(42 + socialPressure * 0.4 + criminalPressure * 0.07 + civicTension * 0.18)),
      zoneIds: [city.id, district.id],
      compatibleActionIds: ["public_reassurance", "relief_distribution"],
      tags: ["system_generated", "maintenance", "civic_authority", "reduce_fear"],
      phaseLabel: "Rassurer et stabiliser"
    }
  ];
}

function createLogisticsObjectives(state: WorldState, faction: WorldFaction): SystemObjectiveBlueprint[] {
  const city = getCityByFactionId(state, faction.id);
  if (!city) return [];
  const route = selectRouteByScore(
    city.routeIds,
    state,
    candidate => {
      const ref: EntityRef = { kind: "route", id: candidate.id };
      return (
        getPressure(state, ref, "military") * 0.38 +
        (100 - (candidate.state.security ?? 100)) * 0.28 +
        (100 - (candidate.state.materialState ?? 100)) * 0.17 +
        getTensionSeverity(state, ref, ["military", "mobility_risk"]) * 0.17
      );
    }
  );
  const district = selectDistrictByScore(
    city,
    state,
    candidate => {
      const ref: EntityRef = { kind: "district", id: candidate.id };
      return (
        getPressure(state, ref, "social") * 0.3 +
        (100 - (candidate.state.commerce ?? 100)) * 0.48 +
        getTensionSeverity(state, ref, ["commercial", "scarcity", "social"]) * 0.22
      );
    }
  );
  const results: SystemObjectiveBlueprint[] = [];
  const cityRef: EntityRef = { kind: "city", id: city.id };
  const commercialPressure = getPressure(state, cityRef, "commercial");
  const cityMarketTension = getTensionSeverity(state, cityRef, ["commercial", "scarcity"]);
  const districtRef: EntityRef | undefined = district ? { kind: "district", id: district.id } : undefined;
  const routeRef: EntityRef | undefined = route ? { kind: "route", id: route.id } : undefined;
  const districtSocialPressure = districtRef ? getPressure(state, districtRef, "social") : 0;
  const districtCriminalPressure = districtRef ? getPressure(state, districtRef, "criminal") : 0;
  const districtMarketTension = districtRef ? getTensionSeverity(state, districtRef, ["commercial", "scarcity", "social"]) : 0;
  const routeMilitaryPressure = routeRef ? getPressure(state, routeRef, "military") : 0;
  const routeMobilityTension = routeRef ? getTensionSeverity(state, routeRef, ["military", "mobility_risk"]) : 0;
  const routeStructuralRisk = route ? Math.max(0, 100 - (route.state.materialState ?? 100)) : 0;

  if (
    district &&
    (commercialPressure >= 64 || cityMarketTension >= 55 || districtMarketTension >= 55 || (district.state.commerce ?? 100) <= 38 || (city.state.supply ?? 100) <= 40) &&
    !(districtSocialPressure >= 62 && districtCriminalPressure >= 48)
  ) {
    results.push({
      id: `objective:system:reopen_market:${faction.id}:${district.id}`,
      ownerFactionId: faction.id,
      category: "reopen_market",
      target: { kind: "district", id: district.id },
      priority: clamp(Math.round(34 + commercialPressure * 0.28 + (100 - (district.state.commerce ?? 100)) * 0.18 + Math.max(cityMarketTension, districtMarketTension) * 0.18)),
      zoneIds: [city.id, district.id],
      compatibleActionIds: district.tags.includes("commerce") ? ["reopen_market", "inspect_customs", "relief_distribution"] : ["reopen_market", "relief_distribution"],
      tags: ["system_generated", "maintenance", "logistics_office", "reopen_market"],
      phaseLabel: "Relancer les echanges"
    });
  }

  if (
    route &&
    (routeMilitaryPressure >= 58 || routeMobilityTension >= 55 || (route.state.security ?? 100) <= 40 || (route.state.materialState ?? 100) <= 38)
  ) {
    results.push({
      id: `objective:system:stabilize_supply:${faction.id}:${route.id}`,
      ownerFactionId: faction.id,
      category: "stabilize_supply",
      target: { kind: "route", id: route.id },
      priority: clamp(Math.round(38 + routeMilitaryPressure * 0.22 + routeStructuralRisk * 0.2 + commercialPressure * 0.08 + routeMobilityTension * 0.18)),
      zoneIds: [city.id, route.id],
      compatibleActionIds: (route.state.materialState ?? 100) <= 42 ? ["repair_route", "secure_route"] : ["secure_route", "repair_route"],
      tags: ["system_generated", "maintenance", "logistics_office", "stabilize_supply"],
      phaseLabel: "Retablir le corridor logistique"
    });
  }

  return results
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 1);
}

function createRegionalObjectives(state: WorldState, faction: WorldFaction): SystemObjectiveBlueprint[] {
  const regionId = getRegionIdByFactionId(faction.id);
  const region = regionId ? state.regions[regionId] : undefined;
  if (!region) return [];
  const route = selectRouteByScore(
    region.mainRouteIds,
    state,
    candidate => {
      const ref: EntityRef = { kind: "route", id: candidate.id };
      return (
        getPressure(state, ref, "military") * 0.45 +
        (candidate.state.ambushRisk ?? 0) * 0.35 +
        getTensionSeverity(state, ref, ["military", "mobility_risk"]) * 0.2
      );
    }
  );
  if (!route) return [];
  const routeRef: EntityRef = { kind: "route", id: route.id };
  const militaryPressure = getPressure(state, routeRef, "military");
  const mobilityTension = getTensionSeverity(state, routeRef, ["military", "mobility_risk"]);
  if (militaryPressure < 52 && (route.state.ambushRisk ?? 0) < 50 && mobilityTension < 55) return [];
  return [
    {
      id: `objective:system:secure_corridor:${faction.id}:${route.id}`,
      ownerFactionId: faction.id,
      category: "secure_corridor",
      target: { kind: "route", id: route.id },
      priority: clamp(Math.round(48 + militaryPressure * 0.45 + mobilityTension * 0.2)),
      zoneIds: [region.id, route.id],
      compatibleActionIds: (route.state.materialState ?? 100) <= 48 ? ["repair_route", "secure_route"] : ["secure_route", "repair_route"],
      tags: ["system_generated", "maintenance", "regional_patrol", "secure_corridor"],
      phaseLabel: "Securiser le corridor"
    }
  ];
}

function deriveBlueprintsForFaction(state: WorldState, faction: WorldFaction): SystemObjectiveBlueprint[] {
  if (!isSystemFaction(faction)) return [];
  switch (faction.type) {
    case "public_guard":
      return createGuardObjectives(state, faction);
    case "civic_authority":
      return createCivicObjectives(state, faction);
    case "logistics_office":
      return createLogisticsObjectives(state, faction);
    case "regional_patrol":
      return createRegionalObjectives(state, faction);
    default:
      return [];
  }
}

function reconcileExistingObjective(existing: SpecialObjective, blueprint: SystemObjectiveBlueprint) {
  existing.category = blueprint.category;
  existing.owner = { kind: "faction", id: blueprint.ownerFactionId };
  existing.target = blueprint.target;
  existing.priority = blueprint.priority;
  existing.zoneIds = blueprint.zoneIds;
  existing.compatibleActionIds = blueprint.compatibleActionIds;
  existing.tags = blueprint.tags;
  if (existing.phases.length === 0) {
    existing.phases = [buildPhase(blueprint)];
    existing.currentPhaseIndex = 0;
  } else {
    const activePhase = existing.phases[Math.min(existing.currentPhaseIndex, existing.phases.length - 1)];
    if (activePhase) {
      activePhase.label = blueprint.phaseLabel;
      activePhase.localTarget = blueprint.target;
      activePhase.zoneIds = blueprint.zoneIds;
      activePhase.compatibleActionIds = blueprint.compatibleActionIds;
    }
  }
  if (existing.state === "completed" || existing.state === "failed") {
    existing.state = "active";
    existing.progress = 0;
    existing.failureScore = 0;
    existing.successConsequencesApplied = false;
    existing.failureConsequencesApplied = false;
    existing.currentPhaseIndex = 0;
    existing.phaseHistory = [];
    existing.phases = [buildPhase(blueprint)];
  }
}

export function reconcileSystemObjectives(state: WorldState) {
  const desiredBlueprints = Object.values(state.factions).flatMap(faction => deriveBlueprintsForFaction(state, faction));
  const desiredById = new Map(desiredBlueprints.map(blueprint => [blueprint.id, blueprint]));
  const existingSystemObjectiveIds = Object.values(state.specialObjectives)
    .filter(hasSystemObjectiveTag)
    .map(objective => objective.id);

  desiredBlueprints.forEach(blueprint => {
    const existing = state.specialObjectives[blueprint.id];
    if (existing) {
      reconcileExistingObjective(existing, blueprint);
    } else {
      state.specialObjectives[blueprint.id] = buildObjectiveFromBlueprint(blueprint);
    }
    ensureFactionGoal(state.factions[blueprint.ownerFactionId], blueprint.id, blueprint.priority);
  });

  existingSystemObjectiveIds
    .filter(objectiveId => !desiredById.has(objectiveId))
    .forEach(objectiveId => {
      delete state.specialObjectives[objectiveId];
      removeObjectiveReferences(state, objectiveId);
    });
}
