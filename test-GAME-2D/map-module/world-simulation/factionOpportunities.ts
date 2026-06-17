import type {
  EntityId,
  EntityRef,
  ObjectiveCategory,
  ObjectivePhaseRuntime,
  SpecialObjective,
  WorldActionId,
  WorldDistrict,
  WorldFaction,
  WorldRoute,
  WorldState,
  WorldTension
} from "./types";

type FactionOpportunityBlueprint = {
  id: EntityId;
  ownerFactionId: EntityId;
  category: ObjectiveCategory;
  target: EntityRef;
  priority: number;
  zoneIds: EntityId[];
  compatibleActionIds: WorldActionId[];
  tags: string[];
  phaseLabel: string;
  sourceNote: string;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function isSystemFaction(faction: WorldFaction): boolean {
  return faction.tags.includes("system");
}

function hasFactionGeneratedTag(objective: SpecialObjective): boolean {
  return objective.tags.includes("faction_generated");
}

function getDistrictForRef(state: WorldState, ref: EntityRef): WorldDistrict | undefined {
  if (ref.kind === "district") return state.districts[ref.id];
  if (ref.kind === "city") {
    const city = state.cities[ref.id];
    return city?.districtIds
      .map(districtId => state.districts[districtId])
      .filter((district): district is WorldDistrict => Boolean(district))
      .sort((left, right) => {
        const leftCommerce = left.state.commerce ?? 0;
        const rightCommerce = right.state.commerce ?? 0;
        return rightCommerce - leftCommerce;
      })[0];
  }
  return undefined;
}

function getTargetDistrict(state: WorldState, tension: WorldTension): WorldDistrict | undefined {
  return tension.targetRefs
    .map(ref => getDistrictForRef(state, ref))
    .find((district): district is WorldDistrict => Boolean(district));
}

function getRouteForRef(state: WorldState, ref: EntityRef): WorldRoute | undefined {
  if (ref.kind === "route") return state.routes[ref.id];
  return undefined;
}

function getTargetRoute(state: WorldState, tension: WorldTension): WorldRoute | undefined {
  return tension.targetRefs
    .map(ref => getRouteForRef(state, ref))
    .find((route): route is WorldRoute => Boolean(route));
}

function getFactionLocalInfluence(faction: WorldFaction, district: WorldDistrict): number {
  return district.factionInfluence[faction.id] ?? 0;
}

function isFactionRelevantToDistrict(faction: WorldFaction, district: WorldDistrict): boolean {
  return (
    faction.influenceZoneIds.includes(district.id) ||
    faction.influenceZoneIds.includes(district.cityId) ||
    getFactionLocalInfluence(faction, district) > 0
  );
}

function isFactionRelevantToRoute(faction: WorldFaction, route: WorldRoute): boolean {
  return (
    faction.influenceZoneIds.includes(route.id) ||
    faction.influenceZoneIds.includes(route.originId) ||
    faction.influenceZoneIds.includes(route.destinationId)
  );
}

function hasAnyTag(faction: WorldFaction, tags: string[]): boolean {
  return tags.some(tag => faction.tags.includes(tag));
}

function getRelationConflictStatus(hostility: number): "rival" | "war" | undefined {
  if (hostility >= 82) return "war";
  if (hostility >= 55) return "rival";
  return undefined;
}

function isSupportRelation(trust: number, hostility: number): boolean {
  return trust >= 68 && hostility <= 28;
}

function appendFactionOpportunityHistory(
  state: WorldState,
  faction: WorldFaction,
  type: string,
  summary: string,
  refs: EntityRef[]
) {
  faction.recentHistory.unshift({
    tick: state.clock.tick,
    type,
    summary,
    refs
  });
  faction.recentHistory = faction.recentHistory.slice(0, 64);
}

function getRelationDistrictTarget(
  state: WorldState,
  faction: WorldFaction,
  rival: WorldFaction
): WorldDistrict | undefined {
  return Object.values(state.districts)
    .filter(district => isFactionRelevantToDistrict(faction, district))
    .sort((left, right) => {
      const leftRivalInfluence = getFactionLocalInfluence(rival, left);
      const rightRivalInfluence = getFactionLocalInfluence(rival, right);
      const leftConflictPressure = Math.max(
        state.pressures.district?.[left.id]?.criminal ?? 0,
        state.pressures.district?.[left.id]?.social ?? 0,
        state.pressures.district?.[left.id]?.religious ?? 0
      );
      const rightConflictPressure = Math.max(
        state.pressures.district?.[right.id]?.criminal ?? 0,
        state.pressures.district?.[right.id]?.social ?? 0,
        state.pressures.district?.[right.id]?.religious ?? 0
      );
      return rightRivalInfluence + rightConflictPressure - (leftRivalInfluence + leftConflictPressure);
    })[0];
}

function buildRelationConflictBlueprint(
  state: WorldState,
  faction: WorldFaction,
  rival: WorldFaction,
  hostility: number
): FactionOpportunityBlueprint | undefined {
  const conflictStatus = getRelationConflictStatus(hostility);
  if (!conflictStatus) return undefined;
  const district = getRelationDistrictTarget(state, faction, rival);
  if (!district) return undefined;
  const localInfluence = getFactionLocalInfluence(faction, district);
  const rivalInfluence = getFactionLocalInfluence(rival, district);
  const pressure = Math.max(
    state.pressures.district?.[district.id]?.criminal ?? 0,
    state.pressures.district?.[district.id]?.social ?? 0,
    state.pressures.district?.[district.id]?.religious ?? 0
  );
  const priority = clamp(Math.round(54 + hostility * 0.34 + rivalInfluence * 0.16 + pressure * 0.12 + localInfluence * 0.08));
  const base = {
    id: `objective:faction:relation:${conflictStatus}:${faction.id}:${rival.id}:${district.id}`,
    ownerFactionId: faction.id,
    target: { kind: "district", id: district.id } as EntityRef,
    priority,
    zoneIds: [district.cityId, district.id],
    sourceNote: `relation:${conflictStatus}:${rival.id}`
  };

  if (faction.tags.includes("criminal")) {
    return {
      ...base,
      category: "acquire_resource",
      compatibleActionIds: ["extort"],
      tags: ["faction_generated", "relation_generated", "opportunistic", "criminal", conflictStatus, `rival:${rival.id}`],
      phaseLabel: conflictStatus === "war" ? "Financer la guerre de rue" : "Affaiblir un rival local"
    };
  }

  if (hasAnyTag(faction, ["military", "militaire"])) {
    return {
      ...base,
      category: "eliminate_threat",
      compatibleActionIds: ["patrol"],
      tags: ["faction_generated", "relation_generated", "opportunistic", "military", conflictStatus, `rival:${rival.id}`],
      phaseLabel: conflictStatus === "war" ? "Neutraliser une faction ennemie" : "Contenir une faction rivale"
    };
  }

  if (faction.tags.includes("religious")) {
    return {
      ...base,
      category: "extend_influence",
      compatibleActionIds: ["sanctify_site"],
      tags: ["faction_generated", "relation_generated", "opportunistic", "religious", conflictStatus, `rival:${rival.id}`],
      phaseLabel: conflictStatus === "war" ? "Sanctifier contre l'ennemi" : "Gagner du terrain sur un rival"
    };
  }

  if (hasAnyTag(faction, ["commerce", "trade"])) {
    return {
      ...base,
      category: "reopen_market",
      compatibleActionIds: ["inspect_customs", "reopen_market"],
      tags: ["faction_generated", "relation_generated", "opportunistic", "merchant", conflictStatus, `rival:${rival.id}`],
      phaseLabel: conflictStatus === "war" ? "Couper l'influence commerciale ennemie" : "Reprendre le terrain commercial"
    };
  }

  return {
    ...base,
    category: "protect_secret",
    compatibleActionIds: ["patrol", "sanctify_site"],
    tags: ["faction_generated", "relation_generated", "opportunistic", "political", conflictStatus, `rival:${rival.id}`],
    phaseLabel: conflictStatus === "war" ? "Se proteger d'une faction ennemie" : "Limiter une faction rivale"
  };
}

function getSharedRelationRouteTarget(
  state: WorldState,
  faction: WorldFaction,
  ally: WorldFaction
): WorldRoute | undefined {
  return Object.values(state.routes)
    .filter(route => isFactionRelevantToRoute(faction, route) && isFactionRelevantToRoute(ally, route))
    .sort((left, right) => {
      const leftStress = Math.max(100 - (left.state.security ?? 100), 100 - (left.state.materialState ?? 100), left.state.ambushRisk ?? 0);
      const rightStress = Math.max(100 - (right.state.security ?? 100), 100 - (right.state.materialState ?? 100), right.state.ambushRisk ?? 0);
      return rightStress - leftStress;
    })[0];
}

function buildRelationSupportBlueprint(
  state: WorldState,
  faction: WorldFaction,
  ally: WorldFaction,
  trust: number,
  hostility: number
): FactionOpportunityBlueprint | undefined {
  if (!isSupportRelation(trust, hostility)) return undefined;
  const route = getSharedRelationRouteTarget(state, faction, ally);
  if (!route) return undefined;
  const routeStress = Math.max(100 - (route.state.security ?? 100), 100 - (route.state.materialState ?? 100), route.state.ambushRisk ?? 0);
  const priority = clamp(Math.round(58 + trust * 0.24 + routeStress * 0.22));
  return {
    id: `objective:faction:relation:ally:${faction.id}:${ally.id}:${route.id}`,
    ownerFactionId: faction.id,
    category: "stabilize_supply",
    target: { kind: "route", id: route.id },
    priority,
    zoneIds: [route.originId, route.destinationId, route.id],
    compatibleActionIds: ["repair_route", "secure_route"],
    tags: ["faction_generated", "relation_generated", "cooperation_generated", "opportunistic", "ally", `ally:${ally.id}`],
    phaseLabel: "Soutenir un corridor partage",
    sourceNote: `relation:ally:${ally.id}`
  };
}

function buildPhase(blueprint: FactionOpportunityBlueprint): ObjectivePhaseRuntime {
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
    notes: ["faction_generated", blueprint.sourceNote]
  };
}

function buildObjectiveFromBlueprint(blueprint: FactionOpportunityBlueprint): SpecialObjective {
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

function reconcileExistingObjective(existing: SpecialObjective, blueprint: FactionOpportunityBlueprint) {
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

function buildCriminalOpportunity(
  faction: WorldFaction,
  tension: WorldTension,
  district: WorldDistrict
): FactionOpportunityBlueprint | undefined {
  if (!faction.tags.includes("criminal")) return undefined;
  if (!["scarcity", "commercial", "criminal"].includes(tension.type)) return undefined;
  if (!isFactionRelevantToDistrict(faction, district)) return undefined;
  const localInfluence = getFactionLocalInfluence(faction, district);
  const severity = tension.severity;
  const commerceStress = Math.max(0, 100 - (district.state.commerce ?? 100));
  const priority = clamp(Math.round(78 + severity * 0.65 + commerceStress * 0.12 + localInfluence * 0.15));
  return {
    id: `objective:faction:opportunity:criminal:${faction.id}:${tension.id}:${district.id}`,
    ownerFactionId: faction.id,
    category: "acquire_resource",
    target: { kind: "district", id: district.id },
    priority,
    zoneIds: [district.cityId, district.id],
    compatibleActionIds: ["extort"],
    tags: ["faction_generated", "opportunistic", "criminal", "exploit_crisis", `tension:${tension.id}`],
    phaseLabel: "Exploiter la crise locale",
    sourceNote: `tension:${tension.id}`
  };
}

function buildReligiousOpportunity(
  faction: WorldFaction,
  tension: WorldTension,
  district: WorldDistrict
): FactionOpportunityBlueprint | undefined {
  if (!faction.tags.includes("religious")) return undefined;
  if (!["social", "religious", "political"].includes(tension.type)) return undefined;
  if (!isFactionRelevantToDistrict(faction, district)) return undefined;
  const localInfluence = getFactionLocalInfluence(faction, district);
  const severity = tension.severity;
  const unrest = Math.max(district.state.fear ?? 0, district.state.agitation ?? 0);
  const priority = clamp(Math.round(72 + severity * 0.6 + unrest * 0.14 + localInfluence * 0.15));
  return {
    id: `objective:faction:opportunity:religious:${faction.id}:${tension.id}:${district.id}`,
    ownerFactionId: faction.id,
    category: "extend_influence",
    target: { kind: "district", id: district.id },
    priority,
    zoneIds: [district.cityId, district.id],
    compatibleActionIds: ["sanctify_site", "recruit"],
    tags: ["faction_generated", "opportunistic", "religious", "exploit_unrest", `tension:${tension.id}`],
    phaseLabel: "Convertir l'agitation en influence",
    sourceNote: `tension:${tension.id}`
  };
}

function buildMerchantDistrictOpportunity(
  faction: WorldFaction,
  tension: WorldTension,
  district: WorldDistrict
): FactionOpportunityBlueprint | undefined {
  if (!hasAnyTag(faction, ["commerce", "trade"])) return undefined;
  if (!["scarcity", "commercial"].includes(tension.type)) return undefined;
  if (!isFactionRelevantToDistrict(faction, district)) return undefined;
  const localInfluence = getFactionLocalInfluence(faction, district);
  const severity = tension.severity;
  const commerceStress = Math.max(0, 100 - (district.state.commerce ?? 100));
  const priority = clamp(Math.round(70 + severity * 0.55 + commerceStress * 0.18 + localInfluence * 0.12));
  return {
    id: `objective:faction:opportunity:merchant:${faction.id}:${tension.id}:${district.id}`,
    ownerFactionId: faction.id,
    category: "reopen_market",
    target: { kind: "district", id: district.id },
    priority,
    zoneIds: [district.cityId, district.id],
    compatibleActionIds: ["reopen_market", "relief_distribution"],
    tags: ["faction_generated", "opportunistic", "merchant", "market_recovery", `tension:${tension.id}`],
    phaseLabel: "Reprendre l'initiative commerciale",
    sourceNote: `tension:${tension.id}`
  };
}

function buildMerchantRouteOpportunity(
  faction: WorldFaction,
  tension: WorldTension,
  route: WorldRoute
): FactionOpportunityBlueprint | undefined {
  if (!hasAnyTag(faction, ["commerce", "trade"])) return undefined;
  if (!["mobility_risk", "military", "commercial", "scarcity", "criminal"].includes(tension.type)) return undefined;
  if (!isFactionRelevantToRoute(faction, route)) return undefined;
  const routeStress = Math.max(0, 100 - (route.state.security ?? 100), 100 - (route.state.materialState ?? 100));
  const priority = clamp(Math.round(66 + tension.severity * 0.5 + routeStress * 0.16));
  return {
    id: `objective:faction:opportunity:merchant_route:${faction.id}:${tension.id}:${route.id}`,
    ownerFactionId: faction.id,
    category: "stabilize_supply",
    target: { kind: "route", id: route.id },
    priority,
    zoneIds: [route.originId, route.destinationId, route.id],
    compatibleActionIds: ["repair_route", "secure_route"],
    tags: ["faction_generated", "opportunistic", "merchant", "route_recovery", `tension:${tension.id}`],
    phaseLabel: "Rouvrir un flux commercial",
    sourceNote: `tension:${tension.id}`
  };
}

function buildMilitaryRouteOpportunity(
  faction: WorldFaction,
  tension: WorldTension,
  route: WorldRoute
): FactionOpportunityBlueprint | undefined {
  if (!hasAnyTag(faction, ["military", "militaire"])) return undefined;
  if (!["mobility_risk", "military", "criminal"].includes(tension.type)) return undefined;
  if (!isFactionRelevantToRoute(faction, route)) return undefined;
  const routeRisk = Math.max(route.state.ambushRisk ?? 0, 100 - (route.state.security ?? 100));
  const priority = clamp(Math.round(68 + tension.severity * 0.55 + routeRisk * 0.16));
  return {
    id: `objective:faction:opportunity:military_route:${faction.id}:${tension.id}:${route.id}`,
    ownerFactionId: faction.id,
    category: "secure_corridor",
    target: { kind: "route", id: route.id },
    priority,
    zoneIds: [route.originId, route.destinationId, route.id],
    compatibleActionIds: ["secure_route", "repair_route"],
    tags: ["faction_generated", "opportunistic", "military", "route_security", `tension:${tension.id}`],
    phaseLabel: "Projeter de la force sur le corridor",
    sourceNote: `tension:${tension.id}`
  };
}

function deriveBlueprintsForTension(state: WorldState, tension: WorldTension): FactionOpportunityBlueprint[] {
  if (tension.severity < 15) return [];
  const district = getTargetDistrict(state, tension);
  const route = getTargetRoute(state, tension);
  if (!district && !route) return [];
  return Object.values(state.factions)
    .filter(faction => !isSystemFaction(faction))
    .flatMap(faction => [
      district ? buildCriminalOpportunity(faction, tension, district) : undefined,
      district ? buildReligiousOpportunity(faction, tension, district) : undefined,
      district ? buildMerchantDistrictOpportunity(faction, tension, district) : undefined,
      route ? buildMerchantRouteOpportunity(faction, tension, route) : undefined,
      route ? buildMilitaryRouteOpportunity(faction, tension, route) : undefined
    ])
    .filter((blueprint): blueprint is FactionOpportunityBlueprint => Boolean(blueprint));
}

function deriveBlueprintsForRelations(state: WorldState): FactionOpportunityBlueprint[] {
  return Object.values(state.factions)
    .filter(faction => !isSystemFaction(faction))
    .flatMap(faction =>
      faction.relations.flatMap(relation => {
        const otherFaction = state.factions[relation.otherFactionId];
        if (!otherFaction || isSystemFaction(otherFaction)) return [];
        const conflictBlueprint = buildRelationConflictBlueprint(state, faction, otherFaction, relation.hostility);
        const supportBlueprint = buildRelationSupportBlueprint(state, faction, otherFaction, relation.trust, relation.hostility);
        return [conflictBlueprint, supportBlueprint].filter((blueprint): blueprint is FactionOpportunityBlueprint => Boolean(blueprint));
      })
    );
}

export function reconcileFactionOpportunities(state: WorldState) {
  const desiredBlueprints = [
    ...Object.values(state.tensions).flatMap(tension => deriveBlueprintsForTension(state, tension)),
    ...deriveBlueprintsForRelations(state)
  ];
  const desiredById = new Map(desiredBlueprints.map(blueprint => [blueprint.id, blueprint]));
  const existingGeneratedObjectiveIds = Object.values(state.specialObjectives)
    .filter(hasFactionGeneratedTag)
    .map(objective => objective.id);

  desiredBlueprints.forEach(blueprint => {
    const existing = state.specialObjectives[blueprint.id];
    if (existing) {
      reconcileExistingObjective(existing, blueprint);
    } else {
      state.specialObjectives[blueprint.id] = buildObjectiveFromBlueprint(blueprint);
      appendFactionOpportunityHistory(
        state,
        state.factions[blueprint.ownerFactionId],
        "faction_objective_created",
        `${blueprint.sourceNote}: ${blueprint.category} sur ${blueprint.target.kind}:${blueprint.target.id}`,
        [{ kind: "faction", id: blueprint.ownerFactionId }, blueprint.target]
      );
    }
    ensureFactionGoal(state.factions[blueprint.ownerFactionId], blueprint.id, blueprint.priority);
  });

  existingGeneratedObjectiveIds
    .filter(objectiveId => !desiredById.has(objectiveId))
    .forEach(objectiveId => {
      delete state.specialObjectives[objectiveId];
      removeObjectiveReferences(state, objectiveId);
    });
}
