import { PRESSURE_DEFINITIONS, WORLD_ACTION_DEFINITIONS } from "./definitions";
import type {
  CandidateProposal,
  CandidateValidationResult,
  DeltaTemplate,
  EntityId,
  EntityRef,
  MobileActor,
  ObjectiveCategory,
  PerceptibleSignal,
  PressureDefinition,
  PressureMap,
  ScalarStat,
  SpecialObjective,
  StateDelta,
  TickContext,
  TickOutput,
  TickScale,
  WorldActionDefinition,
  WorldClock,
  WorldEntityKind,
  WorldEvent,
  WorldFaction,
  WorldRoute,
  WorldState,
  WorldTension
} from "./types";

type ActorCandidate =
  | { ref: EntityRef; actor: WorldFaction; objective?: SpecialObjective }
  | { ref: EntityRef; actor: MobileActor; objective?: SpecialObjective };

type ActionCandidate = {
  actorRef: EntityRef;
  targetRef: EntityRef;
  objectiveId?: EntityId;
  action: WorldActionDefinition;
  score: number;
};

const ENTITY_PRESSURE_KINDS: Array<Extract<WorldEntityKind, "city" | "district" | "route" | "region">> = [
  "city",
  "district",
  "route",
  "region"
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function compare(left: number, op: string, right: number): boolean {
  if (op === "gte") return left >= right;
  if (op === "lte") return left <= right;
  return left === right;
}

function makeId(prefix: string, tick: number, suffix: string): string {
  return `${prefix}:${tick}:${suffix}`;
}

function getEntityState(state: WorldState, ref: EntityRef): Record<string, unknown> | undefined {
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

function getStateStat(state: WorldState, ref: EntityRef, key: ScalarStat): number {
  const entity = getEntityState(state, ref) as { state?: Record<string, number> } | undefined;
  return entity?.state?.[key] ?? 0;
}

function setStateStat(state: WorldState, deltas: StateDelta[], ref: EntityRef, key: ScalarStat, amount: number) {
  const entity = getEntityState(state, ref) as { state?: Record<string, number> } | undefined;
  if (!entity?.state) return;
  const before = entity.state[key] ?? 0;
  const after = clamp(before + amount);
  entity.state[key] = after;
  deltas.push({ target: ref, key, before, after, amount });
}

function updateObjectiveProgress(state: WorldState, deltas: StateDelta[], objectiveId: EntityId | undefined, amount: number) {
  if (!objectiveId) return;
  const objective = state.specialObjectives[objectiveId];
  if (!objective) return;
  const before = objective.progress;
  const after = clamp(before + amount);
  objective.progress = after;
  if (after >= 100) {
    objective.state = "completed";
  } else if (objective.state === "planned") {
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

function getCooldown(actor: WorldFaction | MobileActor, actionId: string): number {
  return actor.cooldowns[actionId as keyof typeof actor.cooldowns] ?? 0;
}

function setCooldown(state: WorldState, deltas: StateDelta[], actorRef: EntityRef, actionId: string, ticks: number) {
  if (actorRef.kind === "faction") {
    state.factions[actorRef.id].cooldowns[actionId as keyof typeof state.factions[typeof actorRef.id]["cooldowns"]] = ticks;
  } else if (actorRef.kind === "mobileActor") {
    state.mobileActors[actorRef.id].cooldowns[actionId as keyof typeof state.mobileActors[typeof actorRef.id]["cooldowns"]] = ticks;
  } else {
    return;
  }
  deltas.push({
    target: actorRef,
    key: "cooldown",
    amount: ticks,
    meta: { actionId }
  });
}

function decrementCooldowns(state: WorldState) {
  [...Object.values(state.factions), ...Object.values(state.mobileActors)].forEach(actor => {
    Object.keys(actor.cooldowns).forEach(actionId => {
      const current = actor.cooldowns[actionId as keyof typeof actor.cooldowns] ?? 0;
      if (current > 0) {
        actor.cooldowns[actionId as keyof typeof actor.cooldowns] = current - 1;
      }
    });
  });
}

function routeLoadScore(route: WorldRoute): number {
  const traffic = route.state.traffic ?? 0;
  const security = route.state.security ?? 0;
  return clamp((traffic * 0.55) + (security * 0.25));
}

function mobilePresenceOnRoute(route: WorldRoute): number {
  return clamp(route.mobileActorIds.length * 20);
}

function getFactionInfluenceByTag(state: WorldState, factionInfluence: Record<string, number>, factionTag: string): number {
  let total = 0;
  Object.entries(factionInfluence).forEach(([factionId, value]) => {
    const faction = state.factions[factionId];
    if (faction?.tags.includes(factionTag)) {
      total += value;
    }
  });
  return clamp(total);
}

function computePressureValue(state: WorldState, definition: PressureDefinition, entityId: EntityId): number {
  let entity: {
    state?: Partial<Record<ScalarStat, number>>;
    factionInfluence?: Record<string, number>;
    mobileActorIds?: string[];
  } | null = null;

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

  if (!entity) return 0;

  let weightedValue = 0;
  let weightTotal = 0;
  definition.terms.forEach(term => {
    let rawValue = 0;
    if (term.source.kind === "state") {
      rawValue = entity.state?.[term.source.key] ?? 0;
    } else if (term.source.kind === "factionInfluence") {
      rawValue = getFactionInfluenceByTag(state, entity.factionInfluence ?? {}, term.source.factionTag);
    } else if (term.source.kind === "routeLoad" && definition.entityKind === "city") {
      const city = state.cities[entityId];
      rawValue = clamp(
        city.routeIds
          .map(routeId => routeLoadScore(state.routes[routeId]))
          .reduce((sum, value) => sum + value, 0) / Math.max(city.routeIds.length, 1)
      );
    } else if (term.source.kind === "mobilePresence" && definition.entityKind === "route") {
      rawValue = mobilePresenceOnRoute(state.routes[entityId]);
    }
    const adjusted = term.invert ? 100 - rawValue : rawValue;
    weightedValue += adjusted * term.weight;
    weightTotal += term.weight;
  });

  const normalized = weightTotal > 0 ? weightedValue / weightTotal : 0;
  const [min, max] = definition.clamp ?? [0, 100];
  return clamp(normalized, min, max);
}

export function recomputePressures(state: WorldState): WorldState["pressures"] {
  const next: WorldState["pressures"] = {};
  ENTITY_PRESSURE_KINDS.forEach(kind => {
    next[kind] = {};
    const records =
      kind === "city"
        ? state.cities
        : kind === "district"
          ? state.districts
          : kind === "route"
            ? state.routes
            : state.regions;
    Object.keys(records).forEach(entityId => {
      const map: PressureMap = {};
      PRESSURE_DEFINITIONS.filter(definition => definition.entityKind === kind).forEach(definition => {
        map[definition.pressureType] = computePressureValue(state, definition, entityId);
      });
      next[kind]![entityId] = map;
    });
  });
  return next;
}

function getPressure(state: WorldState, ref: EntityRef, pressureType: string): number {
  const map = state.pressures[ref.kind]?.[ref.id];
  return (map && map[pressureType as keyof typeof map]) ?? 0;
}

function getObjective(state: WorldState, objectiveId: EntityId | undefined): SpecialObjective | undefined {
  return objectiveId ? state.specialObjectives[objectiveId] : undefined;
}

function getObjectivePriorityBonus(category: ObjectiveCategory | undefined, action: WorldActionDefinition): number {
  if (!category) return 0;
  return action.compatibleObjectives.includes(category) ? 18 : -12;
}

function findActorCandidates(state: WorldState, scale: TickScale): ActorCandidate[] {
  const factionCandidates: ActorCandidate[] = Object.values(state.factions).map(faction => ({
    ref: { kind: "faction", id: faction.id },
    actor: faction,
    objective: faction.objectives
      .map(goal => state.specialObjectives[goal.objectiveId])
      .filter((objective): objective is SpecialObjective => Boolean(objective) && objective.state !== "completed" && objective.state !== "failed")
      .sort((left, right) => right.priority - left.priority)[0]
  }));

  const mobileCandidates: ActorCandidate[] =
    scale === "micro"
      ? Object.values(state.mobileActors).map(actor => ({
          ref: { kind: "mobileActor", id: actor.id },
          actor,
          objective: actor.objectives
            .map(goal => state.specialObjectives[goal.objectiveId])
            .filter((objective): objective is SpecialObjective => Boolean(objective) && objective.state !== "completed" && objective.state !== "failed")
            .sort((left, right) => right.priority - left.priority)[0]
        }))
      : [];

  return [...factionCandidates, ...mobileCandidates];
}

function conditionMatches(
  state: WorldState,
  actorRef: EntityRef,
  targetRef: EntityRef,
  objective: SpecialObjective | undefined,
  condition: WorldActionDefinition["preconditions"][number]
): boolean {
  if (condition.type === "self_state") {
    return compare(getStateStat(state, actorRef, condition.key), condition.op, condition.value);
  }
  if (condition.type === "target_pressure") {
    return compare(getPressure(state, targetRef, condition.pressure), condition.op, condition.value);
  }
  if (condition.type === "objective_category") {
    return objective?.category === condition.category;
  }
  const target = getEntityState(state, targetRef) as { tags?: string[] } | undefined;
  return target?.tags?.includes(condition.tag) ?? false;
}

function getTargetRefsForAction(state: WorldState, action: WorldActionDefinition, actor: ActorCandidate): EntityRef[] {
  const objectiveTarget = actor.objective?.target;
  if (objectiveTarget && action.targetKinds.includes(objectiveTarget.kind as never)) {
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

function getActionCandidates(state: WorldState, actors: ActorCandidate[]): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];
  actors.forEach(actorCandidate => {
    WORLD_ACTION_DEFINITIONS
      .filter(definition => definition.actorKinds.includes(actorCandidate.ref.kind as never))
      .forEach(action => {
        if (getCooldown(actorCandidate.actor, action.id) > 0) return;
        getTargetRefsForAction(state, action, actorCandidate).forEach(targetRef => {
          const valid = action.preconditions.every(condition =>
            conditionMatches(state, actorCandidate.ref, targetRef, actorCandidate.objective, condition)
          );
          if (!valid) return;
          const targetPressure = action.preconditions
            .filter(condition => condition.type === "target_pressure")
            .reduce((sum, condition) => sum + getPressure(state, targetRef, condition.pressure), 0);
          const score =
            action.basePriority +
            targetPressure * 0.35 +
            getObjectivePriorityBonus(actorCandidate.objective?.category, action) +
            (actorCandidate.objective?.priority ?? 0) * 0.25;
          candidates.push({
            actorRef: actorCandidate.ref,
            targetRef,
            objectiveId: actorCandidate.objective?.id,
            action,
            score
          });
        });
      });
  });
  return candidates.sort((left, right) => right.score - left.score);
}

function applyDeltaTemplate(
  state: WorldState,
  deltas: StateDelta[],
  actorRef: EntityRef,
  targetRef: EntityRef,
  objectiveId: EntityId | undefined,
  template: DeltaTemplate
) {
  const ref: EntityRef =
    template.selector === "actor"
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

function resolveActionSuccess(state: WorldState, candidate: ActionCandidate): boolean {
  const objectivePriority = getObjective(state, candidate.objectiveId)?.priority ?? 40;
  const pressureScore = getPressure(state, candidate.targetRef, "criminal") + getPressure(state, candidate.targetRef, "military");
  const actorDiscipline = getStateStat(state, candidate.actorRef, "cohesion") + getStateStat(state, candidate.actorRef, "security");
  const successScore = actorDiscipline + objectivePriority - pressureScore * 0.35 + candidate.score * 0.2;
  return successScore >= 45;
}

function createSignal(candidate: ActionCandidate, tick: number): PerceptibleSignal {
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

function createRumor(candidate: ActionCandidate, event: WorldEvent, tick: number) {
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

function applyConsequencesFromObjective(state: WorldState, ctx: TickContext, objective: SpecialObjective | undefined, targetRef: EntityRef) {
  if (!objective || objective.progress < 100) return;
  objective.onSuccess.forEach((template, index) => {
    if (template.type === "create_tension") {
      const tension: WorldTension = {
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

function resolveSelectedActions(state: WorldState, scale: TickScale): TickContext {
  const ctx: TickContext = {
    state,
    scale,
    generatedEvents: [],
    generatedDeltas: [],
    generatedSignals: [],
    generatedRumors: [],
    generatedOpportunities: []
  };

  const candidates = getActionCandidates(state, findActorCandidates(state, scale));
  const resolvedActors = new Set<string>();

  candidates.forEach(candidate => {
    if (resolvedActors.has(candidate.actorRef.id)) return;
    resolvedActors.add(candidate.actorRef.id);
    const deltaStart = ctx.generatedDeltas.length;

    candidate.action.costs.forEach(template =>
      applyDeltaTemplate(state, ctx.generatedDeltas, candidate.actorRef, candidate.targetRef, candidate.objectiveId, template)
    );
    const success = resolveActionSuccess(state, candidate);
    const templates = success ? candidate.action.successEffects : candidate.action.failureEffects;
    templates.forEach(template =>
      applyDeltaTemplate(state, ctx.generatedDeltas, candidate.actorRef, candidate.targetRef, candidate.objectiveId, template)
    );

    const event: WorldEvent = {
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
    ctx.generatedSignals.push(createSignal(candidate, state.clock.tick));
    ctx.generatedRumors.push(createRumor(candidate, event, state.clock.tick));
    applyConsequencesFromObjective(state, ctx, getObjective(state, candidate.objectiveId), candidate.targetRef);
  });

  return ctx;
}

function advanceMobileActors(state: WorldState, ctx: TickContext) {
  if (ctx.scale !== "micro") return;

  Object.values(state.mobileActors).forEach(actor => {
    if (actor.itinerary.length === 0 || !actor.destination) return;
    const nextRouteId = actor.itinerary[0];
    const route = state.routes[nextRouteId];
    if (!route) return;

    actor.routeProgress = clamp(actor.routeProgress + actor.speed, 0, route.length);
    if (actor.routeProgress < route.length) {
      const risk = getPressure(state, { kind: "route", id: route.id }, "military");
      if (risk >= 60) {
        setStateStat(state, ctx.generatedDeltas, { kind: "mobileActor", id: actor.id }, "fatigue", 4);
        ctx.generatedEvents.push({
          id: makeId("event", state.clock.tick, `${actor.id}-delay`),
          type: "mobile_actor_delayed",
          tick: state.clock.tick,
          actor: { kind: "mobileActor", id: actor.id },
          target: { kind: "route", id: route.id },
          success: false,
          deltas: ctx.generatedDeltas.filter(delta => delta.target.id === actor.id),
          tags: ["travel", "delay"],
          payload: { routeId: route.id, risk }
        });
      }
      return;
    }

    actor.routeProgress = 0;
    actor.itinerary = actor.itinerary.slice(1);
    actor.position = actor.destination;
    route.mobileActorIds = route.mobileActorIds.filter(id => id !== actor.id);
    ctx.generatedEvents.push({
      id: makeId("event", state.clock.tick, `${actor.id}-arrive`),
      type: "mobile_actor_arrived",
      tick: state.clock.tick,
      actor: { kind: "mobileActor", id: actor.id },
      target: actor.position,
      success: true,
      deltas: [],
      tags: ["travel", "arrival"],
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
  });
}

function diffuse(ctx: TickContext): TickOutput {
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
    opportunities: ctx.generatedOpportunities
  };
}

function advanceClock(clock: WorldClock, scale: TickScale): WorldClock {
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

export function runWorldTick(state: WorldState, scale: TickScale): TickOutput {
  state.clock = advanceClock(state.clock, scale);
  decrementCooldowns(state);
  state.pressures = recomputePressures(state);
  const ctx = resolveSelectedActions(state, scale);
  advanceMobileActors(state, ctx);
  state.pressures = recomputePressures(state);
  return diffuse(ctx);
}

export function validateCandidateProposal(state: WorldState, candidate: CandidateProposal): CandidateValidationResult {
  const reasons: string[] = [];
  if (candidate.kind === "specialObjective") {
    if (state.specialObjectives[candidate.payload.id]) reasons.push("Objective id already exists.");
    if (candidate.payload.compatibleActionIds.length === 0) reasons.push("Objective must reference at least one compatible action.");
  }
  if (candidate.kind === "mobileActor") {
    if (!getEntityState(state, candidate.payload.position)) reasons.push("Mobile actor position is unknown.");
  }
  if (candidate.kind === "tension" && state.tensions[candidate.payload.id]) {
    reasons.push("Tension id already exists.");
  }
  if (reasons.length > 0) {
    return { accepted: false, reasons };
  }
  return { accepted: true, normalized: candidate };
}

export function injectCandidateProposal(state: WorldState, candidate: CandidateProposal): CandidateValidationResult {
  const validation = validateCandidateProposal(state, candidate);
  if (!validation.accepted) return validation;
  if (candidate.kind === "specialObjective") {
    state.specialObjectives[candidate.payload.id] = candidate.payload;
  } else if (candidate.kind === "mobileActor") {
    state.mobileActors[candidate.payload.id] = candidate.payload;
  } else {
    state.tensions[candidate.payload.id] = candidate.payload;
  }
  return validation;
}
