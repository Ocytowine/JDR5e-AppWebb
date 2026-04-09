import { PRESSURE_DEFINITIONS, WORLD_ACTION_DEFINITIONS } from "./definitions";
import { applyFactionLogisticsPlans, buildFactionLogisticsPlans, reinitialiserRessourcesTransport } from "./logisticsPlanner";
import { synchronizeObjectiveReadiness } from "./objectiveReadiness";
import { findShortestRouteItinerary, getAbsoluteRouteProgress, getProgressPerTick, getRouteProgressTowardTarget, getRouteTargetId, getRouteTraversalCost } from "./travel";
const ENTITY_PRESSURE_KINDS = [
    "city",
    "district",
    "route",
    "region"
];
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}
function compare(left, op, right) {
    if (op === "gte")
        return left >= right;
    if (op === "lte")
        return left <= right;
    return left === right;
}
function makeId(prefix, tick, suffix) {
    return `${prefix}:${tick}:${suffix}`;
}
function getEntityState(state, ref) {
    switch (ref.kind) {
        case "city":
            return state.cities[ref.id];
        case "district":
            return state.districts[ref.id];
        case "route":
            return state.routes[ref.id];
        case "region":
            return state.regions[ref.id];
        case "faction":
            return state.factions[ref.id];
        case "specialObjective":
            return state.specialObjectives[ref.id];
        case "mobileActor":
            return state.mobileActors[ref.id];
        default:
            return undefined;
    }
}
function getStateStat(state, ref, key) {
    const entity = getEntityState(state, ref);
    return entity?.state?.[key] ?? 0;
}
function setStateStat(state, deltas, ref, key, amount) {
    const entity = getEntityState(state, ref);
    if (!entity?.state)
        return;
    const before = entity.state[key] ?? 0;
    const after = clamp(before + amount);
    entity.state[key] = after;
    deltas.push({ target: ref, key, before, after, amount });
}
function updateObjectiveProgress(state, deltas, objectiveId, amount) {
    if (!objectiveId)
        return;
    const objective = state.specialObjectives[objectiveId];
    if (!objective)
        return;
    const before = objective.progress;
    const after = clamp(before + amount);
    objective.progress = after;
    if (after >= 100) {
        objective.state = "completed";
    }
    else if (objective.state === "planned") {
        objective.state = "active";
    }
    deltas.push({
        target: { kind: "specialObjective", id: objectiveId },
        key: "objective_progress",
        before,
        after,
        amount
    });
}
function getCooldown(actor, actionId) {
    return actor.cooldowns[actionId] ?? 0;
}
function setCooldown(state, deltas, actorRef, actionId, ticks) {
    if (actorRef.kind === "faction") {
        state.factions[actorRef.id].cooldowns[actionId] = ticks;
    }
    else if (actorRef.kind === "mobileActor") {
        state.mobileActors[actorRef.id].cooldowns[actionId] = ticks;
    }
    else {
        return;
    }
    deltas.push({
        target: actorRef,
        key: "cooldown",
        amount: ticks,
        meta: { actionId }
    });
}
function decrementCooldowns(state) {
    [...Object.values(state.factions), ...Object.values(state.mobileActors)].forEach(actor => {
        Object.keys(actor.cooldowns).forEach(actionId => {
            const current = actor.cooldowns[actionId] ?? 0;
            if (current > 0) {
                actor.cooldowns[actionId] = current - 1;
            }
        });
    });
}
function routeLoadScore(route) {
    const traffic = route.state.traffic ?? 0;
    const security = route.state.security ?? 0;
    return clamp((traffic * 0.55) + (security * 0.25));
}
function mobilePresenceOnRoute(route) {
    return clamp(route.mobileActorIds.length * 20);
}
function syncRouteMobilePresence(state) {
    Object.values(state.routes).forEach(route => {
        route.mobileActorIds = [];
    });
    Object.values(state.mobileActors).forEach(actor => {
        const routeId = actor.position.kind === "route"
            ? actor.position.id
            : actor.itinerary[0];
        if (!routeId)
            return;
        const route = state.routes[routeId];
        if (!route)
            return;
        if (!route.mobileActorIds.includes(actor.id)) {
            route.mobileActorIds.push(actor.id);
        }
    });
}
function getLeadingRouteForActor(state, actor) {
    const routeId = actor.position.kind === "route"
        ? actor.position.id
        : actor.itinerary[0];
    return routeId ? state.routes[routeId] : undefined;
}
function findAlternateRoute(state, route) {
    return Object.values(state.routes)
        .filter(candidate => candidate.id !== route.id &&
        ((candidate.originId === route.originId && candidate.destinationId === route.destinationId) ||
            (candidate.originId === route.destinationId && candidate.destinationId === route.originId)))
        .sort((left, right) => {
        const leftScore = (left.state.security ?? 0) - (left.state.ambushRisk ?? 0) + (left.state.materialState ?? 0) * 0.35;
        const rightScore = (right.state.security ?? 0) - (right.state.ambushRisk ?? 0) + (right.state.materialState ?? 0) * 0.35;
        return rightScore - leftScore;
    })[0];
}
function getRouteEndpointRef(state, endpointId) {
    if (state.cities[endpointId]) {
        return { kind: "city", id: endpointId };
    }
    if (state.regions[endpointId]) {
        return { kind: "region", id: endpointId };
    }
    return { kind: "route", id: endpointId };
}
function resolveArrivalPosition(state, actor, route) {
    if (actor.currentRouteTargetId) {
        return getRouteEndpointRef(state, actor.currentRouteTargetId);
    }
    if (actor.destination && actor.destination.kind !== "route" && actor.destination.id === route.destinationId) {
        return actor.destination;
    }
    if (actor.destination && actor.destination.kind !== "route" && actor.destination.id === route.originId) {
        return actor.destination;
    }
    const nextRouteId = actor.itinerary[1];
    const nextRoute = nextRouteId ? state.routes[nextRouteId] : undefined;
    if (nextRoute) {
        if (nextRoute.originId === route.destinationId || nextRoute.destinationId === route.destinationId) {
            return getRouteEndpointRef(state, route.destinationId);
        }
        if (nextRoute.originId === route.originId || nextRoute.destinationId === route.originId) {
            return getRouteEndpointRef(state, route.originId);
        }
    }
    return getRouteEndpointRef(state, route.destinationId);
}
function getRouteDestinationStopProgress(route, actor) {
    if (actor.destination?.kind !== "route" || actor.destination.id !== route.id)
        return undefined;
    if (typeof actor.destinationRouteProgress !== "number" || !Number.isFinite(actor.destinationRouteProgress))
        return undefined;
    return clamp(actor.destinationRouteProgress, 0, getRouteTraversalCost(route, actor));
}
function createMobileTravelEvent(state, ctx, actor, route, reason, payload) {
    const actorRef = { kind: "mobileActor", id: actor.id };
    ctx.generatedEvents.push({
        id: makeId("event", state.clock.tick, `${actor.id}-${reason}`),
        type: "mobile_actor_delayed",
        tick: state.clock.tick,
        actor: actorRef,
        target: { kind: "route", id: route.id },
        success: false,
        deltas: ctx.generatedDeltas.filter(delta => delta.target.kind === "mobileActor" && delta.target.id === actor.id),
        tags: ["deplacement", reason],
        payload: { routeId: route.id, ...payload }
    });
}
function getFactionInfluenceByTag(state, factionInfluence, factionTag) {
    let total = 0;
    Object.entries(factionInfluence).forEach(([factionId, value]) => {
        const faction = state.factions[factionId];
        if (faction?.tags.includes(factionTag)) {
            total += value;
        }
    });
    return clamp(total);
}
function describePressureTerm(definition, term) {
    if (term.source.kind === "state") {
        return `${definition.entityKind}.state.${term.source.key}`;
    }
    if (term.source.kind === "factionInfluence") {
        return `${definition.entityKind}.factionInfluence.${term.source.factionTag}`;
    }
    if (term.source.kind === "routeLoad") {
        return `${definition.entityKind}.routeLoad`;
    }
    return `${definition.entityKind}.mobilePresence`;
}
function evaluatePressureDefinition(state, definition, entityId) {
    let entity = null;
    switch (definition.entityKind) {
        case "city":
            entity = state.cities[entityId] ?? null;
            break;
        case "district":
            entity = state.districts[entityId] ?? null;
            break;
        case "route":
            entity = state.routes[entityId] ?? null;
            break;
        case "region":
            entity = state.regions[entityId] ?? null;
            break;
    }
    if (!entity)
        return null;
    let weightedValue = 0;
    let weightTotal = 0;
    const terms = [];
    definition.terms.forEach(term => {
        let rawValue = 0;
        if (term.source.kind === "state") {
            rawValue = entity.state?.[term.source.key] ?? 0;
        }
        else if (term.source.kind === "factionInfluence") {
            rawValue = getFactionInfluenceByTag(state, entity.factionInfluence ?? {}, term.source.factionTag);
        }
        else if (term.source.kind === "routeLoad" && definition.entityKind === "city") {
            const city = state.cities[entityId];
            rawValue = clamp(city.routeIds
                .map(routeId => routeLoadScore(state.routes[routeId]))
                .reduce((sum, value) => sum + value, 0) / Math.max(city.routeIds.length, 1));
        }
        else if (term.source.kind === "mobilePresence" && definition.entityKind === "route") {
            rawValue = mobilePresenceOnRoute(state.routes[entityId]);
        }
        const adjusted = term.invert ? 100 - rawValue : rawValue;
        const contribution = adjusted * term.weight;
        weightedValue += contribution;
        weightTotal += term.weight;
        terms.push({
            source: describePressureTerm(definition, term),
            rawValue,
            adjustedValue: adjusted,
            weight: term.weight,
            contribution,
            inverted: Boolean(term.invert)
        });
    });
    const normalized = weightTotal > 0 ? weightedValue / weightTotal : 0;
    const [min, max] = definition.clamp ?? [0, 100];
    return {
        definitionId: definition.id,
        entityKind: definition.entityKind,
        entityId,
        pressureType: definition.pressureType,
        terms,
        weightedValue,
        weightTotal,
        normalizedValue: normalized,
        clampedValue: clamp(normalized, min, max)
    };
}
export function recomputePressures(state) {
    return recomputePressuresDetailed(state).pressures;
}
export function recomputePressuresDetailed(state) {
    const next = {};
    const trace = {};
    ENTITY_PRESSURE_KINDS.forEach(kind => {
        next[kind] = {};
        trace[kind] = {};
        const records = kind === "city"
            ? state.cities
            : kind === "district"
                ? state.districts
                : kind === "route"
                    ? state.routes
                    : state.regions;
        Object.keys(records).forEach(entityId => {
            const map = {};
            const entityTrace = [];
            PRESSURE_DEFINITIONS.filter(definition => definition.entityKind === kind).forEach(definition => {
                const evaluation = evaluatePressureDefinition(state, definition, entityId);
                if (!evaluation)
                    return;
                map[definition.pressureType] = evaluation.clampedValue;
                entityTrace.push(evaluation);
            });
            next[kind][entityId] = map;
            trace[kind][entityId] = entityTrace;
        });
    });
    return { pressures: next, trace };
}
function getPressure(state, ref, pressureType) {
    const map = state.pressures[ref.kind]?.[ref.id];
    return (map && map[pressureType]) ?? 0;
}
function getObjective(state, objectiveId) {
    return objectiveId ? state.specialObjectives[objectiveId] : undefined;
}
function getLogisticsPlanBonus(logisticsPlans, objectiveId, actorRef) {
    if (!objectiveId)
        return 0;
    const plan = logisticsPlans.find(entry => entry.objectifId === objectiveId);
    if (!plan)
        return 0;
    if (!plan.faisable)
        return actorRef.kind === "mobileActor" ? -16 : -8;
    if (actorRef.kind === "mobileActor" && plan.acteurAssigneId === actorRef.id)
        return 14;
    return 6;
}
function getObjectivePriorityBonus(category, action) {
    if (!category)
        return 0;
    return action.compatibleObjectives.includes(category) ? 18 : -12;
}
function traceActorCandidates(actors) {
    return actors.map(candidate => ({
        actorRef: candidate.ref,
        objectiveId: candidate.objective?.id,
        objectiveCategory: candidate.objective?.category,
        priority: candidate.objective?.priority
    }));
}
function findActorCandidates(state, scale) {
    const factionCandidates = Object.values(state.factions).map(faction => ({
        ref: { kind: "faction", id: faction.id },
        actor: faction,
        objective: faction.objectives
            .map(goal => state.specialObjectives[goal.objectiveId])
            .filter((objective) => Boolean(objective) && objective.state !== "completed" && objective.state !== "failed" && objective.state !== "blocked")
            .sort((left, right) => right.priority - left.priority)[0]
    }));
    const mobileCandidates = Object.values(state.mobileActors)
        .filter(actor => scale === "micro"
        ? actor.simulationLevel !== "abstract"
        : actor.simulationLevel === "active" || actor.simulationLevel === "summary")
        .map(actor => ({
        ref: { kind: "mobileActor", id: actor.id },
        actor,
        objective: actor.objectives
            .map(goal => state.specialObjectives[goal.objectiveId])
            .filter((objective) => Boolean(objective) && objective.state !== "completed" && objective.state !== "failed" && objective.state !== "blocked")
            .sort((left, right) => right.priority - left.priority)[0]
    }));
    return [...factionCandidates, ...mobileCandidates];
}
function describeCondition(state, actorRef, targetRef, objective, condition) {
    if (condition.type === "self_state") {
        const actual = getStateStat(state, actorRef, condition.key);
        return {
            passed: compare(actual, condition.op, condition.value),
            label: `${actorRef.id}.${condition.key} ${condition.op} ${condition.value} (actual ${Math.round(actual)})`
        };
    }
    if (condition.type === "target_pressure") {
        const actual = getPressure(state, targetRef, condition.pressure);
        return {
            passed: compare(actual, condition.op, condition.value),
            label: `${targetRef.id}.pressure.${condition.pressure} ${condition.op} ${condition.value} (actual ${Math.round(actual)})`
        };
    }
    if (condition.type === "objective_category") {
        return {
            passed: objective?.category === condition.category,
            label: `objective.category == ${condition.category} (actual ${objective?.category ?? "none"})`
        };
    }
    const target = getEntityState(state, targetRef);
    return {
        passed: target?.tags?.includes(condition.tag) ?? false,
        label: `${targetRef.id}.tags contains ${condition.tag}`
    };
}
function getTargetRefsForAction(state, action, actor) {
    const objectiveTarget = actor.objective?.target;
    if (objectiveTarget && action.targetKinds.includes(objectiveTarget.kind)) {
        return [objectiveTarget];
    }
    if (action.targetKinds.includes("district")) {
        return Object.keys(state.districts).map(id => ({ kind: "district", id }));
    }
    if (action.targetKinds.includes("route")) {
        return Object.keys(state.routes).map(id => ({ kind: "route", id }));
    }
    if (action.targetKinds.includes("city")) {
        return Object.keys(state.cities).map(id => ({ kind: "city", id }));
    }
    return Object.keys(state.regions).map(id => ({ kind: "region", id }));
}
function getActionCandidates(state, actors, logisticsPlans) {
    const candidates = [];
    const trace = [];
    actors.forEach(actorCandidate => {
        WORLD_ACTION_DEFINITIONS
            .filter(definition => {
            if (!definition.actorKinds.includes(actorCandidate.ref.kind))
                return false;
            if (!actorCandidate.objective)
                return true;
            if (!actorCandidate.objective.compatibleActionIds.includes(definition.id))
                return false;
            return definition.compatibleObjectives.includes(actorCandidate.objective.category);
        })
            .forEach(action => {
            const cooldown = getCooldown(actorCandidate.actor, action.id);
            if (cooldown > 0) {
                trace.push({
                    actorRef: actorCandidate.ref,
                    targetRef: actorCandidate.objective?.target ?? actorCandidate.ref,
                    objectiveId: actorCandidate.objective?.id,
                    actionId: action.id,
                    passed: false,
                    rejectionReasons: [`cooldown:${cooldown}`],
                    conditions: []
                });
                return;
            }
            getTargetRefsForAction(state, action, actorCandidate).forEach(targetRef => {
                const conditions = action.preconditions.map(condition => {
                    const described = describeCondition(state, actorCandidate.ref, targetRef, actorCandidate.objective, condition);
                    return {
                        type: condition.type,
                        label: described.label,
                        passed: described.passed
                    };
                });
                const valid = conditions.every(condition => condition.passed);
                if (!valid) {
                    trace.push({
                        actorRef: actorCandidate.ref,
                        targetRef,
                        objectiveId: actorCandidate.objective?.id,
                        actionId: action.id,
                        passed: false,
                        rejectionReasons: conditions.filter(condition => !condition.passed).map(condition => condition.label),
                        conditions
                    });
                    return;
                }
                const targetPressure = action.preconditions
                    .filter(condition => condition.type === "target_pressure")
                    .reduce((sum, condition) => sum + getPressure(state, targetRef, condition.pressure), 0);
                const objectivePriorityBonus = getObjectivePriorityBonus(actorCandidate.objective?.category, action);
                const objectivePriorityContribution = (actorCandidate.objective?.priority ?? 0) * 0.25;
                const logisticsPlanBonus = getLogisticsPlanBonus(logisticsPlans, actorCandidate.objective?.id, actorCandidate.ref);
                const score = action.basePriority +
                    targetPressure * 0.35 +
                    objectivePriorityBonus +
                    objectivePriorityContribution +
                    logisticsPlanBonus;
                candidates.push({
                    actorRef: actorCandidate.ref,
                    targetRef,
                    objectiveId: actorCandidate.objective?.id,
                    action,
                    score
                });
                trace.push({
                    actorRef: actorCandidate.ref,
                    targetRef,
                    objectiveId: actorCandidate.objective?.id,
                    actionId: action.id,
                    passed: true,
                    score,
                    scoreBreakdown: {
                        basePriority: action.basePriority,
                        targetPressure,
                        objectivePriorityBonus,
                        objectivePriorityContribution,
                        logisticsPlanBonus
                    },
                    rejectionReasons: [],
                    conditions
                });
            });
        });
    });
    return {
        candidates: candidates.sort((left, right) => right.score - left.score),
        trace
    };
}
function applyDeltaTemplate(state, deltas, actorRef, targetRef, objectiveId, template) {
    const ref = template.selector === "actor"
        ? actorRef
        : template.selector === "target"
            ? targetRef
            : { kind: "specialObjective", id: objectiveId ?? "" };
    if (template.type === "state") {
        setStateStat(state, deltas, ref, template.key, template.amount);
        return;
    }
    if (template.type === "objective_progress") {
        updateObjectiveProgress(state, deltas, objectiveId, template.amount);
        return;
    }
    if (template.selector === "actor") {
        setCooldown(state, deltas, actorRef, template.actionId, template.ticks);
    }
}
function resolveActionSuccess(state, candidate) {
    const objectivePriority = getObjective(state, candidate.objectiveId)?.priority ?? 40;
    const pressureScore = getPressure(state, candidate.targetRef, "criminal") + getPressure(state, candidate.targetRef, "military");
    const actorDiscipline = getStateStat(state, candidate.actorRef, "cohesion") + getStateStat(state, candidate.actorRef, "security");
    const successScore = actorDiscipline + objectivePriority - pressureScore * 0.35 + candidate.score * 0.2;
    return successScore >= 45;
}
function createSignal(candidate, tick) {
    return {
        id: makeId("signal", tick, `${candidate.action.id}-${candidate.targetRef.id}`),
        kind: candidate.action.diffusion.signalKind,
        location: candidate.targetRef,
        intensity: candidate.action.diffusion.signalIntensity,
        tags: [candidate.action.id, ...candidate.action.diffusion.rumorTags],
        payload: {
            actorId: candidate.actorRef.id,
            actionId: candidate.action.id
        }
    };
}
function createRumor(candidate, event, tick) {
    return {
        id: makeId("rumor", tick, event.id),
        sourceEventId: event.id,
        origin: candidate.targetRef,
        spreadTo: [candidate.targetRef],
        credibility: event.success ? 62 : 48,
        tags: candidate.action.diffusion.rumorTags,
        payload: {
            actorId: candidate.actorRef.id,
            actionId: candidate.action.id,
            success: event.success
        }
    };
}
function applyConsequencesFromObjective(state, ctx, objective, targetRef) {
    if (!objective || objective.progress < 100)
        return;
    objective.onSuccess.forEach((template, index) => {
        if (template.type === "create_tension") {
            const tension = {
                id: makeId("tension", state.clock.tick, `${objective.id}-${index}`),
                type: template.tensionType,
                severity: template.severity,
                sourceRefs: [objective.owner],
                targetRefs: [targetRef],
                sinceTick: state.clock.tick,
                tags: template.tags
            };
            state.tensions[tension.id] = tension;
            return;
        }
        if (template.type === "open_opportunity") {
            ctx.generatedOpportunities.push({
                id: makeId("opportunity", state.clock.tick, `${objective.id}-${index}`),
                kind: template.kind,
                location: targetRef,
                score: template.score,
                sourceRefs: [objective.owner, targetRef],
                tags: template.tags
            });
            return;
        }
        ctx.generatedSignals.push({
            id: makeId("signal", state.clock.tick, `${objective.id}-${index}`),
            kind: template.signalKind,
            location: targetRef,
            intensity: template.intensity,
            tags: template.tags,
            payload: { objectiveId: objective.id }
        });
    });
}
function resolveSelectedActions(state, scale) {
    const objectiveReadiness = synchronizeObjectiveReadiness(state);
    reinitialiserRessourcesTransport(state);
    const logisticsPlans = buildFactionLogisticsPlans(state);
    applyFactionLogisticsPlans(state, logisticsPlans);
    const actors = findActorCandidates(state, scale);
    const ctx = {
        state,
        scale,
        generatedEvents: [],
        generatedDeltas: [],
        generatedSignals: [],
        generatedRumors: [],
        generatedOpportunities: [],
        trace: {
            clockBefore: { ...state.clock },
            clockAfter: { ...state.clock },
            logisticsPlans,
            actorCandidates: traceActorCandidates(actors),
            actionCandidates: [],
            selectedActions: [],
            mobility: [],
            pressureSnapshots: {
                before: {},
                after: {}
            },
            objectiveReadiness
        }
    };
    const { candidates, trace } = getActionCandidates(state, actors, logisticsPlans);
    ctx.trace.actionCandidates = trace;
    const resolvedActors = new Set();
    candidates.forEach(candidate => {
        if (resolvedActors.has(candidate.actorRef.id))
            return;
        resolvedActors.add(candidate.actorRef.id);
        const deltaStart = ctx.generatedDeltas.length;
        candidate.action.costs.forEach(template => applyDeltaTemplate(state, ctx.generatedDeltas, candidate.actorRef, candidate.targetRef, candidate.objectiveId, template));
        const success = resolveActionSuccess(state, candidate);
        const templates = success ? candidate.action.successEffects : candidate.action.failureEffects;
        templates.forEach(template => applyDeltaTemplate(state, ctx.generatedDeltas, candidate.actorRef, candidate.targetRef, candidate.objectiveId, template));
        const event = {
            id: makeId("event", state.clock.tick, `${candidate.actorRef.id}-${candidate.action.id}`),
            type: candidate.action.eventType,
            tick: state.clock.tick,
            actor: candidate.actorRef,
            target: candidate.targetRef,
            objectiveId: candidate.objectiveId,
            success,
            deltas: ctx.generatedDeltas.slice(deltaStart),
            tags: [candidate.action.id],
            payload: {
                score: Math.round(candidate.score),
                success
            }
        };
        ctx.generatedEvents.push(event);
        ctx.trace.selectedActions.push({
            actorRef: candidate.actorRef,
            targetRef: candidate.targetRef,
            objectiveId: candidate.objectiveId,
            actionId: candidate.action.id,
            score: candidate.score,
            success,
            eventId: event.id,
            deltaCount: event.deltas.length
        });
        ctx.generatedSignals.push(createSignal(candidate, state.clock.tick));
        ctx.generatedRumors.push(createRumor(candidate, event, state.clock.tick));
        applyConsequencesFromObjective(state, ctx, getObjective(state, candidate.objectiveId), candidate.targetRef);
    });
    return ctx;
}
function advanceMobileActors(state, ctx) {
    if (ctx.scale !== "micro")
        return;
    Object.values(state.mobileActors).forEach(actor => {
        if (actor.itineraryMode !== "locked" && actor.destination && actor.position.kind !== "route") {
            const shortestItinerary = findShortestRouteItinerary(state, actor);
            if (shortestItinerary.length > 0) {
                actor.itinerary = shortestItinerary;
            }
        }
        if (actor.itinerary.length === 0 || !actor.destination) {
            ctx.trace.mobility.push({
                actorId: actor.id,
                outcome: "idle",
                beforeProgress: actor.routeProgress,
                afterProgress: actor.routeProgress,
                notes: ["aucun itineraire ou destination"]
            });
            return;
        }
        const route = getLeadingRouteForActor(state, actor);
        const nextRouteId = actor.position.kind === "route" ? actor.position.id : actor.itinerary[0];
        if (!route) {
            ctx.trace.mobility.push({
                actorId: actor.id,
                routeId: nextRouteId,
                outcome: "blocked",
                beforeProgress: actor.routeProgress,
                afterProgress: actor.routeProgress,
                notes: ["route absente de l'etat runtime"]
            });
            return;
        }
        const beforeProgress = actor.routeProgress;
        const actorRef = { kind: "mobileActor", id: actor.id };
        if (actor.position.kind !== "route") {
            actor.currentRouteTargetId = getRouteTargetId(route, actor.position, actor.destination);
        }
        const militaryRisk = getPressure(state, { kind: "route", id: route.id }, "military");
        const criminalRisk = route.state.ambushRisk ?? 0;
        const materialRisk = 100 - (route.state.materialState ?? 100);
        const fatigue = actor.state.fatigue ?? 0;
        const security = actor.state.security ?? 0;
        const cargo = actor.state.cargo ?? 0;
        const securityGap = Math.max(0, 50 - security);
        const hazardScore = militaryRisk * 0.35 +
            criminalRisk * 0.3 +
            materialRisk * 0.2 +
            fatigue * 0.15 +
            securityGap * 0.2 +
            cargo * 0.08;
        if (fatigue >= 82) {
            setStateStat(state, ctx.generatedDeltas, actorRef, "fatigue", -8);
            createMobileTravelEvent(state, ctx, actor, route, "hold", {
                fatigue: Math.round(fatigue),
                raison: "maintien_position"
            });
            ctx.trace.mobility.push({
                actorId: actor.id,
                routeId: route.id,
                outcome: "delayed",
                beforeProgress,
                afterProgress: actor.routeProgress,
                notes: [`fatigue ${Math.round(fatigue)}`, "maintien sur place pour recuperer"]
            });
            return;
        }
        const alternateRoute = (hazardScore >= 78 || (criminalRisk >= 70 && cargo >= 35)) &&
            actor.position.kind !== "route" &&
            !(actor.destination?.kind === "route" && actor.destination.id === route.id)
            ? findAlternateRoute(state, route)
            : undefined;
        if (alternateRoute) {
            actor.position =
                alternateRoute.originId === route.originId || alternateRoute.originId === route.destinationId
                    ? getRouteEndpointRef(state, alternateRoute.originId)
                    : getRouteEndpointRef(state, route.originId);
            actor.itinerary = [alternateRoute.id, ...actor.itinerary.slice(1)];
            actor.routeProgress = 0;
            actor.currentRouteTargetId = undefined;
            actor.destinationRouteProgress = undefined;
            createMobileTravelEvent(state, ctx, actor, route, "reroute", {
                routePrecedenteId: route.id,
                routeAlternativeId: alternateRoute.id,
                scoreDanger: Math.round(hazardScore)
            });
            ctx.trace.mobility.push({
                actorId: actor.id,
                routeId: route.id,
                outcome: "rerouted",
                beforeProgress,
                afterProgress: actor.routeProgress,
                notes: [`deroute vers ${alternateRoute.id}`, `danger ${Math.round(hazardScore)}`]
            });
            return;
        }
        if (criminalRisk >= 68 && cargo >= 30) {
            setStateStat(state, ctx.generatedDeltas, actorRef, "fatigue", 6);
            setStateStat(state, ctx.generatedDeltas, actorRef, "cargo", -6);
            setStateStat(state, ctx.generatedDeltas, { kind: "route", id: route.id }, "security", -4);
            createMobileTravelEvent(state, ctx, actor, route, "ambush", {
                risqueCriminel: Math.round(criminalRisk),
                charge: Math.round(cargo),
                raison: "pression_embuscade"
            });
            ctx.trace.mobility.push({
                actorId: actor.id,
                routeId: route.id,
                outcome: "delayed",
                beforeProgress,
                afterProgress: actor.routeProgress,
                notes: [`pression embuscade ${Math.round(criminalRisk)}`, "perte de charge sur la route"]
            });
            return;
        }
        if (militaryRisk >= 62 || materialRisk >= 58 || hazardScore >= 68) {
            setStateStat(state, ctx.generatedDeltas, actorRef, "fatigue", materialRisk >= 58 ? 5 : 4);
            if (militaryRisk >= 62) {
                setStateStat(state, ctx.generatedDeltas, actorRef, "security", -3);
            }
            createMobileTravelEvent(state, ctx, actor, route, "delay", {
                risqueMilitaire: Math.round(militaryRisk),
                risqueMateriel: Math.round(materialRisk),
                scoreDanger: Math.round(hazardScore)
            });
            ctx.trace.mobility.push({
                actorId: actor.id,
                routeId: route.id,
                outcome: "delayed",
                beforeProgress,
                afterProgress: actor.routeProgress,
                notes: [`militaire ${Math.round(militaryRisk)}`, `materiel ${Math.round(materialRisk)}`]
            });
            return;
        }
        const speedPenalty = (fatigue >= 60 ? 1 : 0) +
            (materialRisk >= 45 ? 1 : 0) +
            (cargo >= 60 ? 1 : 0);
        const effectiveSpeed = Math.max(1, getProgressPerTick(actor, state) - speedPenalty);
        const routeTraversalCost = getRouteTraversalCost(route, actor);
        const stopProgress = getRouteDestinationStopProgress(route, actor);
        const absoluteBefore = getAbsoluteRouteProgress(route, actor);
        const movingTowardOrigin = actor.currentRouteTargetId === route.originId;
        const absoluteAfter = clamp(absoluteBefore + (movingTowardOrigin ? -effectiveSpeed : effectiveSpeed), 0, routeTraversalCost);
        const reachedRouteStop = typeof stopProgress === "number" &&
            ((movingTowardOrigin && absoluteAfter <= stopProgress) || (!movingTowardOrigin && absoluteAfter >= stopProgress));
        actor.routeProgress = reachedRouteStop
            ? getRouteProgressTowardTarget(route, actor.currentRouteTargetId ?? route.destinationId, stopProgress, actor)
            : clamp(actor.routeProgress + effectiveSpeed, 0, routeTraversalCost);
        if (reachedRouteStop) {
            if (actor.position.kind !== "route" || actor.position.id !== route.id) {
                actor.position = { kind: "route", id: route.id };
            }
            actor.destination = undefined;
            actor.destinationRouteProgress = undefined;
            actor.itinerary = actor.itinerary.slice(1).filter(routeId => routeId !== route.id);
            ctx.generatedEvents.push({
                id: makeId("event", state.clock.tick, `${actor.id}-arrive-route-stop`),
                type: "mobile_actor_arrived",
                tick: state.clock.tick,
                actor: { kind: "mobileActor", id: actor.id },
                target: { kind: "route", id: route.id },
                success: true,
                deltas: [],
                tags: ["deplacement", "arrivee", "route_stop"],
                payload: { routeId: route.id, routeProgress: Math.round(stopProgress * 100) / 100 }
            });
            ctx.trace.mobility.push({
                actorId: actor.id,
                routeId: route.id,
                outcome: "arrived",
                beforeProgress,
                afterProgress: actor.routeProgress,
                notes: [`arrive sur ${route.id}`, `progression ${Math.round(stopProgress * 10) / 10}`]
            });
            return;
        }
        if (actor.routeProgress < routeTraversalCost) {
            if (actor.position.kind !== "route" || actor.position.id !== route.id) {
                actor.position = { kind: "route", id: route.id };
            }
            ctx.trace.mobility.push({
                actorId: actor.id,
                routeId: route.id,
                outcome: "progress",
                beforeProgress,
                afterProgress: actor.routeProgress,
                notes: [`vitesse ${Math.round(effectiveSpeed * 10) / 10}`, `cout trajet ${Math.round(routeTraversalCost * 10) / 10}`, `danger ${Math.round(hazardScore)}`]
            });
            return;
        }
        actor.routeProgress = 0;
        actor.itinerary = actor.itinerary.slice(1);
        actor.position = resolveArrivalPosition(state, actor, route);
        actor.currentRouteTargetId = undefined;
        if (actor.itinerary.length === 0) {
            actor.destination = undefined;
            actor.destinationRouteProgress = undefined;
        }
        ctx.generatedEvents.push({
            id: makeId("event", state.clock.tick, `${actor.id}-arrive`),
            type: "mobile_actor_arrived",
            tick: state.clock.tick,
            actor: { kind: "mobileActor", id: actor.id },
            target: actor.position,
            success: true,
            deltas: [],
            tags: ["deplacement", "arrivee"],
            payload: { positionId: actor.position.id }
        });
        ctx.generatedOpportunities.push({
            id: makeId("opportunity", state.clock.tick, `${actor.id}-arrival`),
            kind: "escort_needed",
            location: actor.position,
            score: 45,
            sourceRefs: [{ kind: "mobileActor", id: actor.id }],
            tags: actor.possibleInteractionTags
        });
        ctx.trace.mobility.push({
            actorId: actor.id,
            routeId: route.id,
            outcome: "arrived",
            beforeProgress,
            afterProgress: actor.routeProgress,
            notes: [`arrive a ${actor.position.id}`]
        });
    });
}
function diffuse(ctx) {
    ctx.state.pendingSignals.push(...ctx.generatedSignals);
    ctx.state.pendingRumors.push(...ctx.generatedRumors);
    ctx.state.pendingOpportunities.push(...ctx.generatedOpportunities);
    return {
        tick: ctx.state.clock.tick,
        scale: ctx.scale,
        events: ctx.generatedEvents,
        deltas: ctx.generatedDeltas,
        signals: ctx.generatedSignals,
        rumors: ctx.generatedRumors,
        opportunities: ctx.generatedOpportunities,
        trace: ctx.trace
    };
}
function advanceClock(clock, scale) {
    const nextTick = clock.tick + 1;
    const nextMicro = scale === "micro" ? clock.microTick + 1 : clock.microTick;
    const macroIncrement = scale === "macro" ? 1 : nextMicro >= clock.microPerMacro ? 1 : 0;
    return {
        ...clock,
        tick: nextTick,
        microTick: scale === "micro" && nextMicro >= clock.microPerMacro ? 0 : nextMicro,
        macroTick: clock.macroTick + macroIncrement
    };
}
export function runWorldTick(state, scale) {
    const clockBefore = { ...state.clock };
    state.clock = advanceClock(state.clock, scale);
    decrementCooldowns(state);
    syncRouteMobilePresence(state);
    const beforePressures = recomputePressuresDetailed(state);
    state.pressures = beforePressures.pressures;
    const ctx = resolveSelectedActions(state, scale);
    ctx.trace.clockBefore = clockBefore;
    ctx.trace.clockAfter = { ...state.clock };
    ctx.trace.pressureSnapshots.before = beforePressures.trace;
    advanceMobileActors(state, ctx);
    syncRouteMobilePresence(state);
    const afterPressures = recomputePressuresDetailed(state);
    state.pressures = afterPressures.pressures;
    ctx.trace.pressureSnapshots.after = afterPressures.trace;
    return diffuse(ctx);
}
export function validateCandidateProposal(state, candidate) {
    const reasons = [];
    if (candidate.kind === "specialObjective") {
        if (state.specialObjectives[candidate.payload.id])
            reasons.push("Objective id already exists.");
        if (candidate.payload.compatibleActionIds.length === 0)
            reasons.push("Objective must reference at least one compatible action.");
    }
    if (candidate.kind === "mobileActor") {
        if (!getEntityState(state, candidate.payload.position))
            reasons.push("Mobile actor position is unknown.");
    }
    if (candidate.kind === "tension" && state.tensions[candidate.payload.id]) {
        reasons.push("Tension id already exists.");
    }
    if (reasons.length > 0) {
        return { accepted: false, reasons };
    }
    return { accepted: true, normalized: candidate };
}
export function injectCandidateProposal(state, candidate) {
    const validation = validateCandidateProposal(state, candidate);
    if (!validation.accepted)
        return validation;
    if (candidate.kind === "specialObjective") {
        state.specialObjectives[candidate.payload.id] = candidate.payload;
    }
    else if (candidate.kind === "mobileActor") {
        state.mobileActors[candidate.payload.id] = candidate.payload;
    }
    else {
        state.tensions[candidate.payload.id] = candidate.payload;
    }
    return validation;
}
