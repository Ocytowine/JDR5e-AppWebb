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
  WorldState
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
    candidate => getPressure(state, { kind: "district", id: candidate.id }, "criminal") * 0.7 + (candidate.state.danger ?? 0) * 0.3
  );
  if (!district) return [];
  const criminalPressure = getPressure(state, { kind: "district", id: district.id }, "criminal");
  const socialPressure = getPressure(state, { kind: "district", id: district.id }, "social");
  const results: SystemObjectiveBlueprint[] = [];

  if (criminalPressure >= 45) {
    results.push({
      id: `objective:system:restore_order:${faction.id}:${district.id}`,
      ownerFactionId: faction.id,
      category: "restore_order",
      target: { kind: "district", id: district.id },
      priority: clamp(Math.round(44 + criminalPressure * 0.52 + socialPressure * 0.12)),
      zoneIds: [city.id, district.id],
      compatibleActionIds: district.tags.includes("commerce") ? ["patrol", "inspect_customs"] : ["patrol"],
      tags: ["system_generated", "maintenance", "public_guard", "restore_order"],
      phaseLabel: "Restauration de l'ordre"
    });
  }

  if (socialPressure >= 58 && ((district.state.danger ?? 0) >= 34 || criminalPressure >= 40)) {
    results.push({
      id: `objective:system:contain_unrest:${faction.id}:${district.id}`,
      ownerFactionId: faction.id,
      category: "contain_unrest",
      target: { kind: "district", id: district.id },
      priority: clamp(Math.round(40 + socialPressure * 0.44 + criminalPressure * 0.14)),
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
  const district = selectDistrictByScore(
    city,
    state,
    candidate => getPressure(state, { kind: "district", id: candidate.id }, "social") * 0.7 + (candidate.state.fear ?? 0) * 0.15 + (candidate.state.agitation ?? 0) * 0.15
  );
  if (!district) return [];
  const socialPressure = getPressure(state, { kind: "district", id: district.id }, "social");
  const criminalPressure = getPressure(state, { kind: "district", id: district.id }, "criminal");
  if (socialPressure < 50 && criminalPressure < 42) return [];
  return [
    {
      id: `objective:system:reduce_fear:${faction.id}:${district.id}`,
      ownerFactionId: faction.id,
      category: "reduce_fear",
      target: { kind: "district", id: district.id },
      priority: clamp(Math.round(42 + socialPressure * 0.46 + criminalPressure * 0.08)),
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
    candidate => getPressure(state, { kind: "route", id: candidate.id }, "military") * 0.45 + (100 - (candidate.state.security ?? 100)) * 0.35 + (100 - (candidate.state.materialState ?? 100)) * 0.2
  );
  const district = selectDistrictByScore(
    city,
    state,
    candidate => getPressure(state, { kind: "district", id: candidate.id }, "social") * 0.4 + (100 - (candidate.state.commerce ?? 100)) * 0.6
  );
  const results: SystemObjectiveBlueprint[] = [];
  const commercialPressure = getPressure(state, { kind: "city", id: city.id }, "commercial");
  const districtSocialPressure = district ? getPressure(state, { kind: "district", id: district.id }, "social") : 0;
  const districtCriminalPressure = district ? getPressure(state, { kind: "district", id: district.id }, "criminal") : 0;
  const routeMilitaryPressure = route ? getPressure(state, { kind: "route", id: route.id }, "military") : 0;
  const routeStructuralRisk = route ? Math.max(0, 100 - (route.state.materialState ?? 100)) : 0;

  if (
    district &&
    (commercialPressure >= 64 || (district.state.commerce ?? 100) <= 38 || (city.state.supply ?? 100) <= 40) &&
    !(districtSocialPressure >= 62 && districtCriminalPressure >= 48)
  ) {
    results.push({
      id: `objective:system:reopen_market:${faction.id}:${district.id}`,
      ownerFactionId: faction.id,
      category: "reopen_market",
      target: { kind: "district", id: district.id },
      priority: clamp(Math.round(34 + commercialPressure * 0.34 + (100 - (district.state.commerce ?? 100)) * 0.2)),
      zoneIds: [city.id, district.id],
      compatibleActionIds: district.tags.includes("commerce") ? ["reopen_market", "inspect_customs", "relief_distribution"] : ["reopen_market", "relief_distribution"],
      tags: ["system_generated", "maintenance", "logistics_office", "reopen_market"],
      phaseLabel: "Relancer les echanges"
    });
  }

  if (
    route &&
    (routeMilitaryPressure >= 58 || (route.state.security ?? 100) <= 40 || (route.state.materialState ?? 100) <= 38)
  ) {
    results.push({
      id: `objective:system:stabilize_supply:${faction.id}:${route.id}`,
      ownerFactionId: faction.id,
      category: "stabilize_supply",
      target: { kind: "route", id: route.id },
      priority: clamp(Math.round(38 + routeMilitaryPressure * 0.24 + routeStructuralRisk * 0.22 + commercialPressure * 0.1)),
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
    candidate => getPressure(state, { kind: "route", id: candidate.id }, "military") * 0.55 + (candidate.state.ambushRisk ?? 0) * 0.45
  );
  if (!route) return [];
  const militaryPressure = getPressure(state, { kind: "route", id: route.id }, "military");
  if (militaryPressure < 52 && (route.state.ambushRisk ?? 0) < 50) return [];
  return [
    {
      id: `objective:system:secure_corridor:${faction.id}:${route.id}`,
      ownerFactionId: faction.id,
      category: "secure_corridor",
      target: { kind: "route", id: route.id },
      priority: clamp(Math.round(48 + militaryPressure * 0.55)),
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
