function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function getRouteTerrainDifficulty(route) {
    return clamp(route.state.terrainDifficulty ?? route.travelCost * 2, 1, 12);
}
export function getRouteTraversalCost(route, actor) {
    const terrainDifficulty = getRouteTerrainDifficulty(route);
    const modeTransport = actor.modeTransport ??
        (actor.travelMode === "river" || actor.travelMode === "sea"
            ? "bateau"
            : actor.travelMode === "foot"
                ? "pied"
                : "cheval");
    const travelModeMultiplier = modeTransport === "pied"
        ? 1.15
        : modeTransport === "bateau"
            ? 0.75
            : 1;
    const cargoLoad = (actor.state.cargo ?? 0) * 0.025;
    const headcountLoad = (actor.state.headcount ?? 0) * 0.01;
    return Math.max(1, route.length * ((route.travelCost * 0.9) + (terrainDifficulty * 0.55)) * travelModeMultiplier + cargoLoad + headcountLoad);
}
export function getProgressPerTick(actor, state) {
    const tickFactor = state.clock.minutesPerMicroTick / 15;
    const modeBonus = actor.modeTransport === "cheval"
        ? 1.2
        : actor.modeTransport === "bateau"
            ? 1.1
            : 1;
    return Math.max(0.5, actor.speed * tickFactor * modeBonus);
}
function getPositionNodeId(position) {
    return position.kind === "city" || position.kind === "region" ? position.id : undefined;
}
export function getAbsoluteRouteProgress(route, actor) {
    const totalCost = getRouteTraversalCost(route, actor);
    const clampedProgress = clamp(actor.routeProgress, 0, totalCost);
    if (actor.currentRouteTargetId === route.originId) {
        return totalCost - clampedProgress;
    }
    return clampedProgress;
}
export function getRouteProgressTowardTarget(route, targetId, absoluteProgress, actor) {
    const totalCost = getRouteTraversalCost(route, actor);
    const clampedAbsolute = clamp(absoluteProgress, 0, totalCost);
    return targetId === route.originId ? totalCost - clampedAbsolute : clampedAbsolute;
}
function getRouteEndpointCandidates(state, actor) {
    if (actor.position.kind !== "route") {
        const nodeId = getPositionNodeId(actor.position);
        return nodeId ? [{ nodeId, initialCost: 0 }] : [];
    }
    const route = state.routes[actor.position.id];
    if (!route)
        return [];
    const totalCost = getRouteTraversalCost(route, actor);
    const clampedProgress = clamp(actor.routeProgress, 0, totalCost);
    const targetId = actor.currentRouteTargetId === route.originId || actor.currentRouteTargetId === route.destinationId
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
function computeShortestItineraryFromNode(state, actor, startNodeId, destinationNodeId) {
    if (startNodeId === destinationNodeId) {
        return [];
    }
    const distances = new Map([[startNodeId, 0]]);
    const previousNode = new Map();
    const previousRoute = new Map();
    const queue = new Set([startNodeId]);
    while (queue.size > 0) {
        const currentNodeId = [...queue].sort((left, right) => (distances.get(left) ?? Number.POSITIVE_INFINITY) - (distances.get(right) ?? Number.POSITIVE_INFINITY))[0];
        queue.delete(currentNodeId);
        const currentDistance = distances.get(currentNodeId) ?? Number.POSITIVE_INFINITY;
        if (currentNodeId === destinationNodeId)
            break;
        Object.values(state.routes).forEach(route => {
            if (route.originId !== currentNodeId && route.destinationId !== currentNodeId)
                return;
            const neighborId = route.originId === currentNodeId ? route.destinationId : route.originId;
            const candidateDistance = currentDistance + getRouteTraversalCost(route, actor);
            if (candidateDistance >= (distances.get(neighborId) ?? Number.POSITIVE_INFINITY))
                return;
            distances.set(neighborId, candidateDistance);
            previousNode.set(neighborId, currentNodeId);
            previousRoute.set(neighborId, route.id);
            queue.add(neighborId);
        });
    }
    if (!previousRoute.has(destinationNodeId)) {
        return [];
    }
    const itinerary = [];
    let currentNodeId = destinationNodeId;
    while (currentNodeId !== startNodeId) {
        const routeId = previousRoute.get(currentNodeId);
        const priorNodeId = previousNode.get(currentNodeId);
        if (!routeId || !priorNodeId)
            break;
        itinerary.unshift(routeId);
        currentNodeId = priorNodeId;
    }
    return itinerary;
}
export function getRouteTargetId(route, currentPosition, finalDestination) {
    if (currentPosition.id === route.originId)
        return route.destinationId;
    if (currentPosition.id === route.destinationId)
        return route.originId;
    if (finalDestination?.id === route.originId)
        return route.originId;
    if (finalDestination?.id === route.destinationId)
        return route.destinationId;
    return route.destinationId;
}
export function findShortestRouteItinerary(state, actor) {
    if (!actor.destination)
        return actor.itinerary;
    if (actor.destination.kind === "route") {
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
        .filter((entry) => Boolean(entry))
        .sort((left, right) => left.totalCost - right.totalCost)[0];
    if (!best) {
        return actor.itinerary;
    }
    return actor.position.kind === "route"
        ? [actor.position.id, ...best.itinerary.filter(routeId => routeId !== actor.position.id)]
        : best.itinerary;
}
