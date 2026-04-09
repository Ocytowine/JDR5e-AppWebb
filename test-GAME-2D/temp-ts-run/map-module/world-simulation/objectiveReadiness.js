function resolveExecutionTarget(state, target) {
    if (!target)
        return undefined;
    if (target.kind === "district") {
        const district = state.districts[target.id];
        return district ? { kind: "city", id: district.cityId } : undefined;
    }
    if (target.kind === "route") {
        const route = state.routes[target.id];
        if (!route)
            return undefined;
        return state.cities[route.originId]
            ? { kind: "city", id: route.originId }
            : state.regions[route.originId]
                ? { kind: "region", id: route.originId }
                : undefined;
    }
    if (target.kind === "city" || target.kind === "region") {
        return target;
    }
    return undefined;
}
function findMatchingAnchor(faction, objective) {
    const anchors = faction?.localAnchors ?? [];
    const byId = objective.requiredAnchorId
        ? anchors.find(anchor => anchor.id === objective.requiredAnchorId)
        : undefined;
    if (byId)
        return byId;
    return objective.requiredAnchorType
        ? anchors.find(anchor => anchor.type === objective.requiredAnchorType)
        : undefined;
}
export function evaluateObjectiveReadiness(state, objective) {
    const faction = objective.owner.kind === "faction" ? state.factions[objective.owner.id] : undefined;
    const matchingAnchor = findMatchingAnchor(faction, objective);
    const executionTargetRef = resolveExecutionTarget(state, objective.target);
    const reasons = [];
    if (objective.requiredAnchorId && !matchingAnchor) {
        reasons.push("missing_required_anchor");
    }
    if (objective.requiredAnchorType && !matchingAnchor) {
        reasons.push("missing_required_anchor_type");
    }
    if (objective.target && !executionTargetRef) {
        reasons.push("missing_execution_target");
    }
    if (objective.state === "failed" || objective.state === "completed") {
        reasons.push(`objective_${objective.state}`);
    }
    const ready = reasons.length === 0;
    return {
        objectiveId: objective.id,
        factionId: faction?.id,
        ready,
        objectiveStateBefore: objective.state,
        objectiveStateAfter: objective.state,
        requiredAnchorId: objective.requiredAnchorId,
        requiredAnchorType: objective.requiredAnchorType,
        matchedAnchorId: matchingAnchor?.id,
        matchedAnchorType: matchingAnchor?.type,
        executionTargetRef,
        reasons
    };
}
export function synchronizeObjectiveReadiness(state) {
    return Object.values(state.specialObjectives).map(objective => {
        const trace = evaluateObjectiveReadiness(state, objective);
        if (objective.state === "completed" || objective.state === "failed") {
            return trace;
        }
        if (!trace.ready) {
            objective.state = "blocked";
            trace.objectiveStateAfter = objective.state;
            return trace;
        }
        if (objective.state === "blocked") {
            objective.state = objective.progress > 0 ? "active" : "planned";
        }
        trace.objectiveStateAfter = objective.state;
        return trace;
    });
}
