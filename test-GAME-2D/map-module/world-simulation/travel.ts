import type { EntityId, EntityRef, MobileActor, WorldRoute, WorldState } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getRouteTerrainDifficulty(route: WorldRoute): number {
  return clamp(route.state.terrainDifficulty ?? route.travelCost * 2, 1, 12);
}

export function getRouteTraversalCost(route: WorldRoute, actor: MobileActor): number {
  const terrainDifficulty = getRouteTerrainDifficulty(route);
  const modeTransport =
    actor.modeTransport ??
    (actor.travelMode === "river" || actor.travelMode === "sea"
      ? "bateau"
      : actor.travelMode === "foot"
        ? "pied"
        : "cheval");
  const travelModeMultiplier =
    modeTransport === "pied"
      ? 1.15
      : modeTransport === "bateau"
        ? 0.75
        : 1;
  const cargoLoad = (actor.state.cargo ?? 0) * 0.025;
  const headcountLoad = (actor.state.headcount ?? 0) * 0.01;
  return Math.max(
    1,
    route.length * ((route.travelCost * 0.9) + (terrainDifficulty * 0.55)) * travelModeMultiplier + cargoLoad + headcountLoad
  );
}

export function getProgressPerTick(actor: MobileActor, state: WorldState): number {
  const tickFactor = state.clock.minutesPerMicroTick / 15;
  const modeBonus =
    actor.modeTransport === "cheval"
      ? 1.2
      : actor.modeTransport === "bateau"
        ? 1.1
        : 1;
  return Math.max(0.5, actor.speed * tickFactor * modeBonus);
}

function getPositionNodeId(position: EntityRef): EntityId | undefined {
  return position.kind === "city" || position.kind === "region" ? position.id : undefined;
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
  if (actor.destination.kind === "route") return [actor.destination.id];

  const startNodeId = getPositionNodeId(actor.position);
  const destinationNodeId = actor.destination.kind === "city" || actor.destination.kind === "region"
    ? actor.destination.id
    : undefined;
  if (!startNodeId || !destinationNodeId || startNodeId === destinationNodeId) {
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
    return actor.itinerary;
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
