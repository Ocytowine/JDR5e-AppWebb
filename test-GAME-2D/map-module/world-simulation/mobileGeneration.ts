import { findShortestRouteItinerary } from "./travel";
import type { EntityId, EntityRef, MobileActor, ObjectiveCategory, SpecialObjective, WorldFaction, WorldState } from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

function getActiveObjectiveForFaction(state: WorldState, faction: WorldFaction): SpecialObjective | undefined {
  return faction.objectives
    .map(goal => state.specialObjectives[goal.objectiveId])
    .filter(isObjectiveActive)
    .sort((left, right) => right.priority - left.priority)[0];
}

function isObjectiveActive(objective: SpecialObjective | undefined): objective is SpecialObjective {
  if (!objective) return false;
  return objective.state !== "completed" && objective.state !== "failed" && objective.state !== "blocked";
}

function getObjectiveTargetCity(state: WorldState, objective: SpecialObjective): EntityRef | undefined {
  const target = objective.phases[objective.currentPhaseIndex]?.localTarget ?? objective.target;
  if (!target) return undefined;
  if (target.kind === "city" || target.kind === "region" || target.kind === "route") return target;
  if (target.kind === "district") {
    const district = state.districts[target.id];
    return district ? { kind: "city", id: district.cityId } : undefined;
  }
  return undefined;
}

function isSameEntityRef(left: EntityRef | undefined, right: EntityRef | undefined): boolean {
  return Boolean(left && right && left.kind === right.kind && left.id === right.id);
}

export function syncMobileMissionAssignment(state: WorldState, actor: MobileActor): void {
  const objective = actor.objectives
    .map(goal => state.specialObjectives[goal.objectiveId])
    .filter(isObjectiveActive)
    .sort((left, right) => right.priority - left.priority)[0];
  if (!objective) {
    actor.missionAssignment = undefined;
    return;
  }

  const phase = objective.phases[objective.currentPhaseIndex];
  const executionTarget = phase?.localTarget ?? objective.target;
  const previous = actor.missionAssignment;
  const assignmentChanged =
    previous?.objectiveId !== objective.id ||
    previous?.phaseId !== phase?.id ||
    !isSameEntityRef(previous?.executionTarget, executionTarget);

  actor.missionAssignment = {
    objectiveId: objective.id,
    phaseId: phase?.id,
    executionTarget,
    intent: phase?.label ?? objective.category,
    assignedAtTick: assignmentChanged ? state.clock.tick : previous?.assignedAtTick ?? state.clock.tick
  };

  // The first runtime assignment documents an existing mission. Only a later
  // phase change is allowed to redirect an automatically planned journey.
  if (!previous || !assignmentChanged || actor.itineraryMode === "locked" || !executionTarget) return;
  if (isSameEntityRef(actor.position, executionTarget)) {
    actor.destination = undefined;
    actor.itinerary = [];
    actor.currentRouteTargetId = undefined;
    actor.destinationRouteProgress = undefined;
    actor.routeProgress = 0;
    return;
  }

  actor.destination = executionTarget;
  actor.itinerary = findShortestRouteItinerary(state, actor);
  actor.currentRouteTargetId = undefined;
  actor.destinationRouteProgress = undefined;
  if (actor.position.kind !== "route") actor.routeProgress = 0;
}

function getFactionStartRef(state: WorldState, faction: WorldFaction, fallback?: EntityRef): EntityRef | undefined {
  const zoneIds = [
    ...(faction.controlledZoneIds ?? []),
    ...faction.influenceZoneIds,
    ...(faction.influencedZoneIds ?? []),
    ...(faction.interestZoneIds ?? [])
  ];
  const cityId = zoneIds.find(zoneId => state.cities[zoneId]);
  if (cityId) return { kind: "city", id: cityId };
  const regionId = zoneIds.find(zoneId => state.regions[zoneId]);
  if (regionId) return { kind: "region", id: regionId };
  const routeId = zoneIds.find(zoneId => state.routes[zoneId]);
  if (routeId) {
    const route = state.routes[routeId];
    return state.cities[route.originId]
      ? { kind: "city", id: route.originId }
      : state.regions[route.originId]
        ? { kind: "region", id: route.originId }
        : { kind: "route", id: routeId };
  }
  return fallback;
}

function getMobileProfile(category: ObjectiveCategory, faction: WorldFaction) {
  const isTrade = faction.tags.some(tag => ["trade", "merchant", "commerce", "logistics"].includes(tag));
  const isMilitary = faction.tags.some(tag => ["military", "guard", "public", "system"].includes(tag));
  const isReligious = faction.tags.some(tag => ["religious", "faith", "cult"].includes(tag));

  if (category === "acquire_resource" || category === "reopen_market" || category === "stabilize_supply" || isTrade) {
    return {
      typeEntity: "runtime_supply_convoy",
      speed: 4,
      security: isMilitary ? 48 : 34,
      cargo: 52,
      headcount: 18,
      resources: 18,
      tags: ["commerce", "approvisionnement", "convoi"]
    };
  }
  if (category === "secure_corridor" || category === "restore_order" || category === "eliminate_threat" || isMilitary) {
    return {
      typeEntity: "runtime_patrol_column",
      speed: 5,
      security: 62,
      cargo: 18,
      headcount: 28,
      resources: 18,
      tags: ["militaire", "escorte", "patrouille", "securite"]
    };
  }
  if (category === "extend_influence" || category === "reduce_fear" || isReligious) {
    return {
      typeEntity: "runtime_civic_column",
      speed: 4,
      security: 38,
      cargo: 20,
      headcount: 20,
      resources: 14,
      tags: ["civique", "religion", "rumeur"]
    };
  }
  return {
    typeEntity: "runtime_agent_group",
    speed: 5,
    security: 42,
    cargo: 12,
    headcount: 8,
    resources: 12,
    tags: ["agents", "mission"]
  };
}

function factionHasUsableMobile(state: WorldState, factionId: EntityId): boolean {
  return Object.values(state.mobileActors).some(actor => {
    if (actor.owner?.kind !== "faction" || actor.owner.id !== factionId || actor.simulationLevel === "abstract") return false;
    if ((actor.state.fatigue ?? 0) >= 85) return false;
    if ((actor.state.resources ?? 0) <= 0) return false;
    const hasActiveObjective = actor.objectives.some(goal => isObjectiveActive(state.specialObjectives[goal.objectiveId]));
    return hasActiveObjective || Boolean(actor.destination) || actor.itinerary.length > 0;
  });
}

function retireObsoleteRuntimeMobiles(state: WorldState) {
  Object.values(state.mobileActors)
    .filter(actor => actor.id.startsWith("mobile:runtime:"))
    .filter(actor => actor.objectives.every(goal => !isObjectiveActive(state.specialObjectives[goal.objectiveId])))
    .filter(actor => !actor.destination && actor.itinerary.length === 0)
    .forEach(actor => {
      const owner = actor.owner?.kind === "faction" ? state.factions[actor.owner.id] : undefined;
      if (owner) {
        owner.recentHistory.unshift({
          tick: state.clock.tick,
          type: "mobile_retired",
          summary: `${actor.id} retired after completing or losing its mission`,
          refs: [{ kind: "mobileActor", id: actor.id }, { kind: "faction", id: owner.id }]
        });
        owner.recentHistory = owner.recentHistory.slice(0, 64);
      }
      delete state.mobileActors[actor.id];
    });
}

function shouldGenerateMobileForObjective(faction: WorldFaction, objective: SpecialObjective): boolean {
  if (objective.tags.includes("opportunistic") && !objective.tags.includes("cooperation_generated")) return false;
  if (faction.tags.includes("system") || faction.tags.includes("logistics") || faction.type === "logistics_office") return true;
  return ["open_route", "stabilize_supply", "secure_corridor", "reopen_market", "restore_order", "reduce_fear"].includes(objective.category);
}

function countRuntimeMobiles(state: WorldState): number {
  return Object.values(state.mobileActors).filter(actor => actor.id.startsWith("mobile:runtime:")).length;
}

export function reconcileAutonomousMobiles(state: WorldState): MobileActor[] {
  const generated: MobileActor[] = [];
  retireObsoleteRuntimeMobiles(state);
  if (countRuntimeMobiles(state) >= 16) return generated;

  Object.values(state.factions)
    .filter(faction => !factionHasUsableMobile(state, faction.id))
    .forEach(faction => {
      if (countRuntimeMobiles(state) >= 16) return;
      const objective = getActiveObjectiveForFaction(state, faction);
      if (!objective) return;
      if (!shouldGenerateMobileForObjective(faction, objective)) return;
      const destination = getObjectiveTargetCity(state, objective);
      const position = getFactionStartRef(state, faction, destination);
      if (!position || !destination) return;

      const id = `mobile:runtime:${sanitizeId(faction.id)}:${sanitizeId(objective.id)}`;
      if (state.mobileActors[id]) return;
      const profile = getMobileProfile(objective.category, faction);
      const actor: MobileActor = {
        id,
        typeEntity: profile.typeEntity,
        mobile: true,
        owner: { kind: "faction", id: faction.id },
        populationProfile: faction.populationProfile,
        position,
        destination,
        itineraryMode: "auto",
        itinerary: [],
        travelMode: "road",
        modeTransport: profile.speed >= 5 && profile.headcount <= 28 ? "cheval" : "pied",
        speed: profile.speed,
        routeProgress: 0,
        state: {
          security: clamp(profile.security + Math.round((faction.state.security ?? 0) * 0.12)),
          fatigue: 0,
          cargo: profile.cargo,
          headcount: profile.headcount,
          resources: profile.resources
        },
        objectives: [{ objectiveId: objective.id, priority: objective.priority }],
        possibleInteractionTags: ["runtime_generated", ...profile.tags],
        recentHistory: [
          {
            tick: state.clock.tick,
            type: "mobile_generated",
            summary: `${id} generated for ${objective.id}`,
            refs: [{ kind: "mobileActor", id }, { kind: "faction", id: faction.id }, { kind: "specialObjective", id: objective.id }]
          }
        ],
        simulationLevel: "active",
        cooldowns: {}
      };
      syncMobileMissionAssignment(state, actor);
      actor.itinerary = findShortestRouteItinerary(state, actor);
      state.mobileActors[id] = actor;
      faction.recentHistory.unshift({
        tick: state.clock.tick,
        type: "mobile_generated",
        summary: `${id} generated for ${objective.id}`,
        refs: [{ kind: "mobileActor", id }, { kind: "faction", id: faction.id }, { kind: "specialObjective", id: objective.id }]
      });
      faction.recentHistory = faction.recentHistory.slice(0, 64);
      generated.push(actor);
    });

  return generated;
}
