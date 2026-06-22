import type { EntityId, EntityRef, MobileActor, WorldCity, WorldRegion, WorldRoute, WorldState } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const HUMAN_REFERENCE_SPEED = 40;
export const HUMAN_REFERENCE_HEXES_PER_HOUR = 0.5;

function getRouteTerrainDifficulty(route: WorldRoute): number {
  return clamp(route.state.terrainDifficulty ?? route.travelCost * 2, 1, 12);
}

function getTravelModeHoursMultiplier(modeTransport: MobileActor["modeTransport"]): number {
  if (modeTransport === "cheval") return 0.85;
  if (modeTransport === "bateau") return 0.7;
  return 1;
}

function getBaseHoursPerHex(travelCost: number): number {
  if (travelCost <= 2) return 1.35;
  if (travelCost >= 4) return 2.2;
  return 1.7;
}

export function estimateTraversalHours(parameters: {
  length: number;
  travelCost: number;
  terrainDifficulty: number;
  cargo: number;
  headcount: number;
  modeTransport?: MobileActor["modeTransport"];
}): number {
  const terrainFactor = 0.65 + clamp(parameters.terrainDifficulty, 1, 12) / 10;
  const modeMultiplier = getTravelModeHoursMultiplier(parameters.modeTransport);
  const cargoPenaltyHours = Math.max(0, parameters.cargo) * 0.02;
  const headcountPenaltyHours = Math.max(0, parameters.headcount) * 0.01;
  return Math.max(
    1,
    Math.max(1, parameters.length) * getBaseHoursPerHex(parameters.travelCost) * terrainFactor * modeMultiplier + cargoPenaltyHours + headcountPenaltyHours
  );
}

export function getRouteTraversalCost(route: WorldRoute, actor: MobileActor): number {
  const modeTransport =
    actor.modeTransport ??
    (actor.travelMode === "river" || actor.travelMode === "sea"
      ? "bateau"
      : actor.travelMode === "foot"
        ? "pied"
        : "cheval");
  return estimateTraversalHours({
    length: route.length,
    travelCost: route.travelCost,
    terrainDifficulty: getRouteTerrainDifficulty(route),
    cargo: actor.state.cargo ?? 0,
    headcount: actor.state.headcount ?? 0,
    modeTransport
  });
}

function isWaterRoute(route: WorldRoute | undefined): boolean {
  return Boolean(route?.tags.some(tag => ["river", "waterway", "fluvial", "sea", "maritime"].includes(tag)));
}

function isWaterMode(actor: MobileActor): boolean {
  return actor.modeTransport === "bateau" || actor.travelMode === "river" || actor.travelMode === "sea";
}

export function isRouteCompatibleWithActor(route: WorldRoute | undefined, actor: MobileActor): boolean {
  if (!route) return false;
  return isWaterMode(actor) ? isWaterRoute(route) : !isWaterRoute(route);
}

function getEntityTravelTags(state: WorldState, ref: EntityRef | undefined): string[] {
  if (!ref) return [];
  if (ref.kind === "city") return state.cities[ref.id]?.tags ?? [];
  if (ref.kind === "region") return state.regions[ref.id]?.tags ?? [];
  if (ref.kind === "route") return state.routes[ref.id]?.tags ?? [];
  if (ref.kind === "district") return state.districts[ref.id]?.tags ?? [];
  return [];
}

function hasWaterAccess(state: WorldState, ref: EntityRef | undefined): boolean {
  const tags = getEntityTravelTags(state, ref);
  return tags.some(tag => ["maritime", "harbor", "river", "fluvial", "port"].includes(tag));
}

function getEntityTerrainDifficulty(entity: WorldCity | WorldRegion | undefined): number {
  if (!entity) return 6;
  const danger = entity.state.danger ?? entity.state.externalThreat ?? 0;
  const circulation = entity.state.circulation ?? 50;
  const production = entity.state.production ?? 50;
  return clamp(5 + danger / 20 + Math.max(0, 50 - circulation) / 18 + Math.max(0, 50 - production) / 30, 3, 12);
}

function getRefTerrainDifficulty(state: WorldState, ref: EntityRef | undefined): number {
  if (!ref) return 6;
  if (ref.kind === "city") return getEntityTerrainDifficulty(state.cities[ref.id]);
  if (ref.kind === "region") return getEntityTerrainDifficulty(state.regions[ref.id]);
  if (ref.kind === "district") {
    const district = state.districts[ref.id];
    return district ? getEntityTerrainDifficulty(state.cities[district.cityId]) : 6;
  }
  if (ref.kind === "route") return getRouteTerrainDifficulty(state.routes[ref.id]);
  return 6;
}

export function canUseAbstractWaterTravel(state: WorldState, actor: MobileActor): boolean {
  if (actor.modeTransport !== "bateau" && actor.travelMode !== "river" && actor.travelMode !== "sea") return false;
  return hasWaterAccess(state, actor.position) || hasWaterAccess(state, actor.destination);
}

export function getOffRouteTraversalCost(state: WorldState, actor: MobileActor): number {
  const terrainDifficulty = Math.max(
    getRefTerrainDifficulty(state, actor.position),
    getRefTerrainDifficulty(state, actor.destination)
  );
  const modeTransport =
    actor.modeTransport ??
    (actor.travelMode === "river" || actor.travelMode === "sea"
      ? "bateau"
      : actor.travelMode === "foot"
        ? "pied"
        : "cheval");
  const length = actor.position.kind === actor.destination?.kind && actor.position.id === actor.destination.id ? 0 : 4;
  const travelCost = modeTransport === "bateau" ? 3 : modeTransport === "cheval" ? 5 : 6;
  const routeEquivalent = estimateTraversalHours({
    length,
    travelCost,
    terrainDifficulty,
    cargo: actor.state.cargo ?? 0,
    headcount: actor.state.headcount ?? 0,
    modeTransport
  });
  const offRoutePenalty = modeTransport === "bateau" ? 1.15 : modeTransport === "cheval" ? 1.35 : 1.55;
  return Math.max(1, routeEquivalent * offRoutePenalty);
}

export function getProgressPerTick(actor: MobileActor, state: WorldState): number {
  const hoursPerTick = state.clock.minutesPerMicroTick / 60;
  const speedFactor = Math.max(0.25, actor.speed / HUMAN_REFERENCE_SPEED);
  return Math.max(0.25, hoursPerTick * speedFactor);
}

function getPositionNodeId(position: EntityRef): EntityId | undefined {
  return position.kind === "city" || position.kind === "region" ? position.id : undefined;
}

export function getAbsoluteRouteProgress(route: WorldRoute, actor: MobileActor): number {
  const totalCost = getRouteTraversalCost(route, actor);
  const clampedProgress = clamp(actor.routeProgress, 0, totalCost);
  if (actor.currentRouteTargetId === route.originId) {
    return totalCost - clampedProgress;
  }
  return clampedProgress;
}

export function getRouteProgressTowardTarget(route: WorldRoute, targetId: EntityId, absoluteProgress: number, actor: MobileActor): number {
  const totalCost = getRouteTraversalCost(route, actor);
  const clampedAbsolute = clamp(absoluteProgress, 0, totalCost);
  return targetId === route.originId ? totalCost - clampedAbsolute : clampedAbsolute;
}

function getRouteEndpointCandidates(state: WorldState, actor: MobileActor): Array<{ nodeId: EntityId; initialCost: number }> {
  if (actor.position.kind !== "route") {
    const nodeId = getPositionNodeId(actor.position);
    return nodeId ? [{ nodeId, initialCost: 0 }] : [];
  }

  const route = state.routes[actor.position.id];
  if (!route) return [];
  if (!isRouteCompatibleWithActor(route, actor)) return [];
  const totalCost = getRouteTraversalCost(route, actor);
  const clampedProgress = clamp(actor.routeProgress, 0, totalCost);
  const targetId =
    actor.currentRouteTargetId === route.originId || actor.currentRouteTargetId === route.destinationId
      ? actor.currentRouteTargetId
      : getRouteTargetId(route, actor.position, actor.destination);

  if (targetId === route.originId) {
    return [
      { nodeId: route.originId, initialCost: totalCost - clampedProgress },
      { nodeId: route.destinationId, initialCost: clampedProgress }
    ];
  }

  return [
    { nodeId: route.originId, initialCost: clampedProgress },
    { nodeId: route.destinationId, initialCost: totalCost - clampedProgress }
  ];
}

function computeShortestItineraryFromNode(
  state: WorldState,
  actor: MobileActor,
  startNodeId: EntityId,
  destinationNodeId: EntityId
): EntityId[] {
  if (startNodeId === destinationNodeId) {
    return [];
  }

  const distances = new Map<EntityId, number>([[startNodeId, 0]]);
  const previousNode = new Map<EntityId, EntityId>();
  const previousRoute = new Map<EntityId, EntityId>();
  const queue = new Set<EntityId>([startNodeId]);

  while (queue.size > 0) {
    const currentNodeId = [...queue].sort((left, right) => (distances.get(left) ?? Number.POSITIVE_INFINITY) - (distances.get(right) ?? Number.POSITIVE_INFINITY))[0];
    queue.delete(currentNodeId);
    const currentDistance = distances.get(currentNodeId) ?? Number.POSITIVE_INFINITY;
    if (currentNodeId === destinationNodeId) break;

    Object.values(state.routes).forEach(route => {
      if (!isRouteCompatibleWithActor(route, actor)) return;
      if (route.originId !== currentNodeId && route.destinationId !== currentNodeId) return;
      const neighborId = route.originId === currentNodeId ? route.destinationId : route.originId;
      const candidateDistance = currentDistance + getRouteTraversalCost(route, actor);
      if (candidateDistance >= (distances.get(neighborId) ?? Number.POSITIVE_INFINITY)) return;
      distances.set(neighborId, candidateDistance);
      previousNode.set(neighborId, currentNodeId);
      previousRoute.set(neighborId, route.id);
      queue.add(neighborId);
    });
  }

  if (!previousRoute.has(destinationNodeId)) {
    return [];
  }

  const itinerary: EntityId[] = [];
  let currentNodeId = destinationNodeId;
  while (currentNodeId !== startNodeId) {
    const routeId = previousRoute.get(currentNodeId);
    const priorNodeId = previousNode.get(currentNodeId);
    if (!routeId || !priorNodeId) break;
    itinerary.unshift(routeId);
    currentNodeId = priorNodeId;
  }
  return itinerary;
}

export function getRouteTargetId(route: WorldRoute, currentPosition: EntityRef, finalDestination?: EntityRef): EntityId {
  if (currentPosition.id === route.originId) return route.destinationId;
  if (currentPosition.id === route.destinationId) return route.originId;
  if (finalDestination?.id === route.originId) return route.originId;
  if (finalDestination?.id === route.destinationId) return route.destinationId;
  return route.destinationId;
}

export function findShortestRouteItinerary(state: WorldState, actor: MobileActor): EntityId[] {
  if (!actor.destination) return actor.itinerary;
  if (actor.destination.kind === "route") {
    if (!isRouteCompatibleWithActor(state.routes[actor.destination.id], actor)) return [];
    if (actor.position.kind === "route" && actor.position.id === actor.destination.id) {
      return [actor.destination.id];
    }
    return [actor.destination.id];
  }

  const destinationNodeId = actor.destination.kind === "city" || actor.destination.kind === "region"
    ? actor.destination.id
    : undefined;
  if (!destinationNodeId) {
    return [];
  }
  if (actor.position.kind === "route" && !isRouteCompatibleWithActor(state.routes[actor.position.id], actor)) {
    return [];
  }
  const startCandidates = getRouteEndpointCandidates(state, actor);
  if (startCandidates.length === 0) {
    return actor.itinerary;
  }

  const best = startCandidates
    .map(candidate => {
      const itinerary = computeShortestItineraryFromNode(state, actor, candidate.nodeId, destinationNodeId);
      if (itinerary.length === 0 && candidate.nodeId !== destinationNodeId) {
        return null;
      }
      const routeCost = itinerary.reduce((sum, routeId) => {
        const route = state.routes[routeId];
        return route ? sum + getRouteTraversalCost(route, actor) : sum;
      }, 0);
      return {
        itinerary,
        totalCost: candidate.initialCost + routeCost
      };
    })
    .filter((entry): entry is { itinerary: EntityId[]; totalCost: number } => Boolean(entry))
    .sort((left, right) => left.totalCost - right.totalCost)[0];

  if (!best) {
    return actor.itinerary;
  }

  return actor.position.kind === "route"
    ? [actor.position.id, ...best.itinerary.filter(routeId => routeId !== actor.position.id)]
    : best.itinerary;
}
