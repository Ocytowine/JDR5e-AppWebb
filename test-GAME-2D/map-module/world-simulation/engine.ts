import { PRESSURE_DEFINITIONS, WORLD_ACTION_DEFINITIONS } from "./definitions";
import { applyFactionLogisticsPlans, buildFactionLogisticsPlans, reinitialiserRessourcesTransport } from "./logisticsPlanner";
import { synchronizeObjectiveReadiness } from "./objectiveReadiness";
import { reconcileFactionOpportunities } from "./factionOpportunities";
import { reconcileSystemObjectives } from "./systemObjectives";
import { reconcileAutonomousMobiles } from "./mobileGeneration";
import { canUseAbstractWaterTravel, findShortestRouteItinerary, getAbsoluteRouteProgress, getOffRouteTraversalCost, getProgressPerTick, getRouteProgressTowardTarget, getRouteTargetId, getRouteTraversalCost, isRouteCompatibleWithActor } from "./travel";
import type {
  ActionCandidateTrace,
  ActionCauseTrace,
  ActorCandidateTrace,
  CandidateProposal,
  CandidateValidationResult,
  DeltaTemplate,
  EntityId,
  EntityRef,
  LogisticsPlanTrace,
  MobileActor,
  ObjectiveCategory,
  PerceptibleSignal,
  PhaseTransitionTrace,
  PressureDefinition,
  PressureEvaluationTrace,
  PressureMap,
  PressureTraceSnapshot,
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
  WorldHistoryEntry,
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
  actionCause: ActionCauseTrace;
  score: number;
};

const ENTITY_PRESSURE_KINDS: Array<Extract<WorldEntityKind, "city" | "district" | "route" | "region">> = [
  "city",
  "district",
  "route",
  "region"
];
const RECENT_HISTORY_LIMIT = 64;

function getActiveObjectivePhase(objective: SpecialObjective | undefined) {
  if (!objective || objective.phases.length === 0) return undefined;
  if (objective.currentPhaseIndex < 0 || objective.currentPhaseIndex >= objective.phases.length) return undefined;
  return objective.phases[objective.currentPhaseIndex];
}

function getObjectiveActionTarget(objective: SpecialObjective | undefined): EntityRef | undefined {
  const activePhase = getActiveObjectivePhase(objective);
  return activePhase?.localTarget ?? objective?.target;
}

function getObjectiveCompatibleActions(objective: SpecialObjective | undefined) {
  const activePhase = getActiveObjectivePhase(objective);
  if (activePhase && activePhase.compatibleActionIds.length > 0) {
    return activePhase.compatibleActionIds;
  }
  return objective?.compatibleActionIds ?? [];
}

function ensureActivePhaseHistory(objective: SpecialObjective, tick: number, phase = getActiveObjectivePhase(objective)) {
  if (!phase) return;
  const existingOpenEntry = objective.phaseHistory.find(entry => entry.phaseId === phase.id && typeof entry.exitedAtTick !== "number");
  if (existingOpenEntry) return;
  objective.phaseHistory.push({
    phaseId: phase.id,
    enteredAtTick: tick
  });
}

function closePhaseHistoryEntry(
  objective: SpecialObjective,
  phaseId: EntityId,
  tick: number,
  outcome: "advanced" | "blocked" | "failed",
  reasons: string[] = []
) {
  const openEntry =
    [...objective.phaseHistory]
      .reverse()
      .find(entry => entry.phaseId === phaseId && typeof entry.exitedAtTick !== "number");
  if (!openEntry) return;
  openEntry.exitedAtTick = tick;
  openEntry.outcome = outcome;
  if (reasons.length > 0) {
    openEntry.reasons = reasons;
  }
}

function isPhaseCompletionReached(state: WorldState, objective: SpecialObjective, phase = getActiveObjectivePhase(objective)): boolean {
  if (!phase) return false;
  if (phase.completionMode === "progress_threshold") {
    return phase.progress >= phase.completionThreshold;
  }
  if (phase.completionMode === "action_count") {
    const total = Object.values(phase.actionCountById ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
    return total >= phase.completionThreshold;
  }
  if (phase.completionMode === "presence") {
    const ref = phase.requiredPresenceRef;
    if (!ref) return false;
    return Boolean(getEntityState(state, ref));
  }
  const faction = objective.owner.kind === "faction" ? state.factions[objective.owner.id] : undefined;
  if (!faction) return false;
  if (phase.requiredAnchorId) {
    return (faction.localAnchors ?? []).some(anchor => anchor.id === phase.requiredAnchorId);
  }
  if (phase.requiredAnchorType) {
    return (faction.localAnchors ?? []).some(anchor => anchor.type === phase.requiredAnchorType);
  }
  return false;
}

function advanceObjectivePhase(
  state: WorldState,
  deltas: StateDelta[],
  objectiveId: EntityId,
  phase: NonNullable<ReturnType<typeof getActiveObjectivePhase>>
) {
  phase.state = "completed";
  deltas.push({
    target: { kind: "specialObjective", id: objectiveId },
    key: "phase_progress",
    before: phase.progress,
    after: phase.progress,
    amount: 0,
    meta: { phaseId: phase.id, transition: "completed" }
  });
  const objective = state.specialObjectives[objectiveId];
  if (!objective) return;
  closePhaseHistoryEntry(objective, phase.id, state.clock.tick, "advanced", ["phase_completion"]);
  const nextIndex = objective.currentPhaseIndex + 1;
  if (nextIndex >= objective.phases.length) {
    objective.state = "completed";
    objective.currentPhaseIndex = Math.max(0, objective.phases.length - 1);
    objective.progress = 100;
    return;
  }
  objective.currentPhaseIndex = nextIndex;
  const nextPhase = objective.phases[nextIndex];
  nextPhase.state = "active";
  ensureActivePhaseHistory(objective, state.clock.tick, nextPhase);
  deltas.push({
    target: { kind: "specialObjective", id: objectiveId },
    key: "phase_progress",
    before: 0,
    after: nextPhase.progress,
    amount: 0,
    meta: { phaseId: nextPhase.id, transition: "activated" }
  });
}

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

function applyWearDelta(state: WorldState, deltas: StateDelta[], ref: EntityRef, key: ScalarStat, amount: number, source: string) {
  const entity = getEntityState(state, ref) as { state?: Record<string, number> } | undefined;
  if (!entity?.state) return;
  const before = entity.state[key] ?? 0;
  const after = clamp(before + amount);
  if (before === after) return;
  entity.state[key] = after;
  deltas.push({
    target: ref,
    key,
    before,
    after,
    amount,
    meta: { source, kind: "territorial_wear" }
  });
}

function applySystemShiftDelta(state: WorldState, deltas: StateDelta[], ref: EntityRef, key: ScalarStat, amount: number, source: string) {
  const entity = getEntityState(state, ref) as { state?: Record<string, number> } | undefined;
  if (!entity?.state) return;
  const before = entity.state[key] ?? 0;
  const after = clamp(before + amount);
  if (before === after) return;
  entity.state[key] = after;
  deltas.push({
    target: ref,
    key,
    before,
    after,
    amount,
    meta: { source, kind: "tension_conversion" }
  });
}

function applyMobileImpactDelta(
  state: WorldState,
  deltas: StateDelta[],
  ref: EntityRef,
  key: ScalarStat,
  amount: number,
  source: string,
  kind: "mobile_arrival" | "mobile_setback" = "mobile_arrival"
) {
  const entity = getEntityState(state, ref) as { state?: Record<string, number> } | undefined;
  if (!entity?.state) return;
  const before = entity.state[key] ?? 0;
  const after = clamp(before + amount);
  if (before === after) return;
  entity.state[key] = after;
  deltas.push({
    target: ref,
    key,
    before,
    after,
    amount,
    meta: { source, kind }
  });
}

function getHistoryContainer(state: WorldState, ref: EntityRef): { recentHistory?: WorldHistoryEntry[] } | undefined {
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
    case "mobileActor":
      return state.mobileActors[ref.id];
    default:
      return undefined;
  }
}

function getTensionContainer(state: WorldState, ref: EntityRef): { activeTensionIds?: EntityId[] } | undefined {
  switch (ref.kind) {
    case "city":
      return state.cities[ref.id];
    case "district":
      return state.districts[ref.id];
    case "route":
      return state.routes[ref.id];
    case "region":
      return state.regions[ref.id];
    default:
      return undefined;
  }
}

function appendHistory(state: WorldState, refs: EntityRef[], entry: WorldHistoryEntry) {
  const seen = new Set<string>();
  refs.forEach(ref => {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const container = getHistoryContainer(state, ref);
    if (!container?.recentHistory) return;
    container.recentHistory.unshift(entry);
    container.recentHistory = container.recentHistory.slice(0, RECENT_HISTORY_LIMIT);
  });
}

function getFactionRelationStatus(trust: number, hostility: number): "ally" | "neutral" | "rival" | "war" {
  if (hostility >= 82) return "war";
  if (hostility >= 55) return "rival";
  if (trust >= 68 && hostility <= 28) return "ally";
  return "neutral";
}

function ensureFactionRelation(faction: WorldFaction, otherFactionId: EntityId) {
  let relation = faction.relations.find(entry => entry.otherFactionId === otherFactionId);
  if (!relation) {
    relation = {
      otherFactionId,
      status: "neutral",
      trust: 35,
      hostility: 20
    };
    faction.relations.push(relation);
  }
  return relation;
}

function applyFactionRelationShift(
  state: WorldState,
  leftFactionId: EntityId,
  rightFactionId: EntityId,
  trustDelta: number,
  hostilityDelta: number,
  reason: string,
  refs: EntityRef[]
) {
  if (leftFactionId === rightFactionId) return;
  const left = state.factions[leftFactionId];
  const right = state.factions[rightFactionId];
  if (!left || !right) return;

  [
    [left, rightFactionId],
    [right, leftFactionId]
  ].forEach(([faction, otherId]) => {
    const relation = ensureFactionRelation(faction as WorldFaction, otherId as EntityId);
    const trustBefore = relation.trust;
    const hostilityBefore = relation.hostility;
    relation.trust = clamp(relation.trust + trustDelta);
    relation.hostility = clamp(relation.hostility + hostilityDelta);
    relation.status = getFactionRelationStatus(relation.trust, relation.hostility);
    appendHistory(state, [{ kind: "faction", id: (faction as WorldFaction).id }, ...refs], {
      tick: state.clock.tick,
      type: "relation_shift",
      summary: `${reason}: ${otherId} trust ${Math.round(trustBefore)} -> ${Math.round(relation.trust)}, hostility ${Math.round(hostilityBefore)} -> ${Math.round(relation.hostility)}`,
      refs: [{ kind: "faction", id: (faction as WorldFaction).id }, { kind: "faction", id: otherId as EntityId }, ...refs]
    });
  });
}

function getDistrictRefForTarget(state: WorldState, ref: EntityRef): EntityRef | undefined {
  if (ref.kind === "district" && state.districts[ref.id]) return ref;
  if (ref.kind !== "city") return undefined;
  const city = state.cities[ref.id];
  const districtId = city?.districtIds[0];
  return districtId ? { kind: "district", id: districtId } : undefined;
}

function getFactionsRelevantToTarget(state: WorldState, ref: EntityRef, tags: string[]): WorldFaction[] {
  const districtRef = getDistrictRefForTarget(state, ref);
  const district = districtRef ? state.districts[districtRef.id] : undefined;
  const route = ref.kind === "route" ? state.routes[ref.id] : undefined;
  return Object.values(state.factions).filter(faction => {
    if (!tags.some(tag => faction.tags.includes(tag))) return false;
    if (district) {
      return (
        faction.influenceZoneIds.includes(district.id) ||
        faction.influenceZoneIds.includes(district.cityId) ||
        (district.factionInfluence[faction.id] ?? 0) > 0
      );
    }
    if (route) {
      return (
        faction.influenceZoneIds.includes(route.id) ||
        faction.influenceZoneIds.includes(route.originId) ||
        faction.influenceZoneIds.includes(route.destinationId)
      );
    }
    return faction.influenceZoneIds.includes(ref.id);
  });
}

function getFactionsPresentAtRef(state: WorldState, ref: EntityRef): WorldFaction[] {
  const districtRef = getDistrictRefForTarget(state, ref);
  const district = districtRef ? state.districts[districtRef.id] : undefined;
  const route = ref.kind === "route" ? state.routes[ref.id] : undefined;
  return Object.values(state.factions)
    .filter(faction => {
      if (district) {
        return (
          faction.influenceZoneIds.includes(district.id) ||
          faction.influenceZoneIds.includes(district.cityId) ||
          (district.factionInfluence[faction.id] ?? 0) > 0
        );
      }
      if (route) {
        return (
          faction.influenceZoneIds.includes(route.id) ||
          faction.influenceZoneIds.includes(route.originId) ||
          faction.influenceZoneIds.includes(route.destinationId)
        );
      }
      return faction.influenceZoneIds.includes(ref.id);
    })
    .sort((left, right) => {
      const leftInfluence = district?.factionInfluence[left.id] ?? left.state.influence ?? 0;
      const rightInfluence = district?.factionInfluence[right.id] ?? right.state.influence ?? 0;
      return rightInfluence - leftInfluence;
    });
}

function getMobileOwnerFaction(state: WorldState, actor: MobileActor): WorldFaction | undefined {
  return actor.owner?.kind === "faction" ? state.factions[actor.owner.id] : undefined;
}

function getRelationBetween(left: WorldFaction | undefined, rightId: EntityId): "ally" | "neutral" | "rival" | "war" {
  return left?.relations.find(relation => relation.otherFactionId === rightId)?.status ?? "neutral";
}

function recentlyLoggedInteraction(actor: MobileActor, type: string, targetId: EntityId, minAgeTicks: number, currentTick: number): boolean {
  return actor.recentHistory.some(entry =>
    entry.type === type &&
    currentTick - entry.tick <= minAgeTicks &&
    (entry.refs ?? []).some(ref => ref.id === targetId)
  );
}

function hasMobileTravelAssignment(actor: MobileActor): boolean {
  return actor.itinerary.length > 0 || Boolean(actor.destination && !isSameEntityRef(actor.position, actor.destination));
}

function applyFactionRelationConsequences(state: WorldState, candidate: ActionCandidate, success: boolean) {
  if (!success || candidate.actorRef.kind !== "faction") return;
  const actor = state.factions[candidate.actorRef.id];
  if (!actor) return;
  const objective = candidate.objectiveId ? state.specialObjectives[candidate.objectiveId] : undefined;
  if (objective?.tags.includes("relation_generated")) {
    const rivalId = objective.tags
      .find(tag => tag.startsWith("rival:"))
      ?.slice("rival:".length);
    const allyId = objective.tags
      .find(tag => tag.startsWith("ally:"))
      ?.slice("ally:".length);
    if (rivalId && rivalId !== actor.id && state.factions[rivalId]) {
      const warIntensity = objective.tags.includes("war");
      const trustDelta = warIntensity ? -7 : -4;
      const hostilityDelta = warIntensity ? 12 : 7;
      applyFactionRelationShift(state, actor.id, rivalId, trustDelta, hostilityDelta, "anti_rival_success", [
        candidate.targetRef,
        { kind: "specialObjective", id: objective.id }
      ]);
    }
    if (allyId && allyId !== actor.id && state.factions[allyId]) {
      applyFactionRelationShift(state, actor.id, allyId, 6, -4, "alliance_support_success", [
        candidate.targetRef,
        { kind: "specialObjective", id: objective.id }
      ]);
    }
  }
  if (candidate.action.id === "extort") {
    const affected = getFactionsRelevantToTarget(state, candidate.targetRef, ["military", "militaire", "civic", "commerce", "trade"])
      .filter(faction => faction.id !== actor.id);
    affected.forEach(faction => {
      applyFactionRelationShift(state, actor.id, faction.id, -4, 9, "extortion_crisis", [candidate.targetRef]);
    });
    return;
  }
  if (candidate.action.id === "secure_route" || candidate.action.id === "repair_route") {
    const beneficiaries = getFactionsRelevantToTarget(state, candidate.targetRef, ["commerce", "trade", "military", "militaire"])
      .filter(faction => faction.id !== actor.id);
    beneficiaries.forEach(faction => {
      applyFactionRelationShift(state, actor.id, faction.id, 5, -3, "corridor_support", [candidate.targetRef]);
    });
  }
}

function getEntityRefKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

function mergeEntityRefs(left: EntityRef[], right: EntityRef[]): EntityRef[] {
  const refs = [...left];
  const seen = new Set(left.map(getEntityRefKey));
  right.forEach(ref => {
    const key = getEntityRefKey(ref);
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  });
  return refs;
}

function normalizeEntityRefs(refs: EntityRef[]): string {
  return [...new Set(refs.map(getEntityRefKey))].sort().join("|");
}

function normalizeTags(tags: string[]): string {
  return [...new Set(tags)].sort().join("|");
}

function getTensionSignature(tension: WorldTension): string {
  return [
    tension.type,
    normalizeEntityRefs(tension.targetRefs),
    normalizeTags(tension.tags)
  ].join("::");
}

function findEquivalentTension(state: WorldState, tension: WorldTension): WorldTension | undefined {
  const signature = getTensionSignature(tension);
  return Object.values(state.tensions).find(existing => existing.id !== tension.id && getTensionSignature(existing) === signature);
}

function linkTensionToTargets(state: WorldState, tensionId: EntityId, targetRefs: EntityRef[]) {
  targetRefs.forEach(ref => {
    const container = getTensionContainer(state, ref);
    if (!container?.activeTensionIds) return;
    if (!container.activeTensionIds.includes(tensionId)) {
      container.activeTensionIds.unshift(tensionId);
      container.activeTensionIds = container.activeTensionIds.slice(0, 24);
    }
  });
}

function getTensionIdsForRef(state: WorldState, ref: EntityRef): EntityId[] {
  return getTensionContainer(state, ref)?.activeTensionIds ?? [];
}

function relieveActiveTensions(
  state: WorldState,
  refs: EntityRef[],
  types: WorldTension["type"][],
  amount: number,
  causeRefs: EntityRef[],
  reason: string
) {
  const seen = new Set<EntityId>();
  refs
    .flatMap(ref => getTensionIdsForRef(state, ref))
    .forEach(tensionId => {
      if (seen.has(tensionId)) return;
      seen.add(tensionId);
      const tension = state.tensions[tensionId];
      if (!tension || !types.includes(tension.type)) return;
      const before = tension.severity;
      tension.severity = clamp(tension.severity - amount);
      const historyRefs = mergeEntityRefs(mergeEntityRefs(tension.sourceRefs, tension.targetRefs), causeRefs);

      if (tension.severity <= 7) {
        delete state.tensions[tension.id];
        removeTensionReferences(state, tension.id);
        appendHistory(state, historyRefs, {
          tick: state.clock.tick,
          type: "tension_resolved",
          summary: `${tension.type} tension resolved by ${reason} from ${Math.round(before)} to ${Math.round(tension.severity)}`,
          refs: historyRefs
        });
        return;
      }

      if (tension.severity !== before) {
        appendHistory(state, historyRefs, {
          tick: state.clock.tick,
          type: "tension_relieved",
          summary: `${tension.type} tension relieved by ${reason} ${Math.round(before)} -> ${Math.round(tension.severity)}`,
          refs: historyRefs
        });
      }
    });
}

function registerTension(state: WorldState, tension: WorldTension) {
  const existing = findEquivalentTension(state, tension);
  if (existing) {
    const before = existing.severity;
    existing.severity = clamp(Math.max(existing.severity, tension.severity) + Math.round(Math.min(existing.severity, tension.severity) * 0.12));
    existing.sourceRefs = mergeEntityRefs(existing.sourceRefs, tension.sourceRefs);
    existing.targetRefs = mergeEntityRefs(existing.targetRefs, tension.targetRefs);
    existing.tags = [...new Set([...existing.tags, ...tension.tags])].sort();
    linkTensionToTargets(state, existing.id, existing.targetRefs);
    appendHistory(state, [...existing.sourceRefs, ...existing.targetRefs], {
      tick: state.clock.tick,
      type: "tension_reinforced",
      summary: `${existing.type} tension reinforced ${Math.round(before)} -> ${Math.round(existing.severity)} (${existing.tags.join(", ") || "no tags"})`,
      refs: [...existing.sourceRefs, ...existing.targetRefs]
    });
    return;
  }

  state.tensions[tension.id] = tension;
  linkTensionToTargets(state, tension.id, tension.targetRefs);
  appendHistory(state, [...tension.sourceRefs, ...tension.targetRefs], {
    tick: state.clock.tick,
    type: "tension_created",
    summary: `${tension.type} tension ${Math.round(tension.severity)} (${tension.tags.join(", ") || "no tags"})`,
    refs: [...tension.sourceRefs, ...tension.targetRefs]
  });
}

function removeTensionReferences(state: WorldState, tensionId: EntityId) {
  Object.values(state.cities).forEach(city => {
    city.activeTensionIds = city.activeTensionIds.filter(id => id !== tensionId);
  });
  Object.values(state.districts).forEach(district => {
    district.activeTensionIds = district.activeTensionIds.filter(id => id !== tensionId);
  });
  Object.values(state.routes).forEach(route => {
    route.activeTensionIds = route.activeTensionIds.filter(id => id !== tensionId);
  });
  Object.values(state.regions).forEach(region => {
    region.activeTensionIds = region.activeTensionIds.filter(id => id !== tensionId);
  });
}

function getTensionPressureScore(state: WorldState, tension: WorldTension, ref: EntityRef): number {
  switch (tension.type) {
    case "criminal":
    case "social":
    case "commercial":
    case "military":
    case "religious":
    case "political":
      return getPressure(state, ref, tension.type);
    case "scarcity":
      return Math.max(getPressure(state, ref, "commercial"), 100 - getStateStat(state, ref, "supply"));
    case "control_conflict":
      return Math.max(getPressure(state, ref, "political"), getPressure(state, ref, "social"), 100 - getStateStat(state, ref, "politicalControl"));
    case "mobility_risk":
      return Math.max(getPressure(state, ref, "military"), getStateStat(state, ref, "ambushRisk"), 100 - getStateStat(state, ref, "security"));
    default:
      return 0;
  }
}

function getDominantTensionPressure(state: WorldState, tension: WorldTension): number {
  return Math.max(0, ...tension.targetRefs.map(ref => getTensionPressureScore(state, tension, ref)));
}

function getTensionDrift(pressure: number, severity: number, age: number): number {
  if (pressure >= 72) return 6;
  if (pressure >= 58) return 4;
  if (pressure <= 22) return -8;
  if (pressure <= 34) return -5;
  if (severity >= 70 && age > 0) return -2;
  return -1;
}

function getPrimaryTensionTarget(tension: WorldTension): EntityRef | undefined {
  return tension.targetRefs[0];
}

function applyTensionSideEffects(state: WorldState, ctx: TickContext, tension: WorldTension) {
  if (tension.severity < 55) return;
  const target = getPrimaryTensionTarget(tension);
  if (!target) return;
  const source = `tension:${tension.id}`;
  switch (tension.type) {
    case "criminal":
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "danger", 2, source);
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "order", -1, source);
      return;
    case "social":
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "agitation", 2, source);
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "fear", 1, source);
      return;
    case "commercial":
    case "scarcity":
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "supply", -2, source);
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "commerce", -1, source);
      return;
    case "military":
    case "mobility_risk":
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "security", -1, source);
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "ambushRisk", 2, source);
      return;
    case "political":
    case "control_conflict":
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "politicalControl", -2, source);
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "stability", -1, source);
      return;
    case "religious":
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "cohesion", -1, source);
      applySystemShiftDelta(state, ctx.generatedDeltas, target, "agitation", 1, source);
      return;
    default:
      return;
  }
}

function processTensionLifecycle(state: WorldState, ctx: TickContext) {
  Object.values({ ...state.tensions }).forEach(tension => {
    const pressure = getDominantTensionPressure(state, tension);
    const before = tension.severity;
    const age = Math.max(0, state.clock.tick - tension.sinceTick);
    const after = clamp(before + getTensionDrift(pressure, before, age));
    tension.severity = after;

    const refs = [...tension.sourceRefs, ...tension.targetRefs];
    if (after <= 7) {
      delete state.tensions[tension.id];
      removeTensionReferences(state, tension.id);
      appendHistory(state, refs, {
        tick: state.clock.tick,
        type: "tension_resolved",
        summary: `${tension.type} tension resolved from ${Math.round(before)} to ${Math.round(after)}`,
        refs
      });
      return;
    }

    if (after !== before) {
      appendHistory(state, refs, {
        tick: state.clock.tick,
        type: after > before ? "tension_escalated" : "tension_eased",
        summary: `${tension.type} tension ${Math.round(before)} -> ${Math.round(after)} under pressure ${Math.round(pressure)}`,
        refs
      });
    }

    applyTensionSideEffects(state, ctx, tension);
  });
}

function getDistrictCityRef(state: WorldState, ref: EntityRef): EntityRef | undefined {
  if (ref.kind !== "district") return undefined;
  const district = state.districts[ref.id];
  return district ? { kind: "city", id: district.cityId } : undefined;
}

function getRegionRefForTarget(state: WorldState, ref: EntityRef): EntityRef | undefined {
  if (ref.kind === "region") return ref;
  if (ref.kind === "city") {
    const city = state.cities[ref.id];
    return city?.regionId ? { kind: "region", id: city.regionId } : undefined;
  }
  if (ref.kind === "district") {
    const cityRef = getDistrictCityRef(state, ref);
    return cityRef ? getRegionRefForTarget(state, cityRef) : undefined;
  }
  if (ref.kind === "route") {
    const route = state.routes[ref.id];
    if (!route) return undefined;
    const originCity = state.cities[route.originId];
    if (originCity?.regionId) return { kind: "region", id: originCity.regionId };
    const destinationCity = state.cities[route.destinationId];
    return destinationCity?.regionId ? { kind: "region", id: destinationCity.regionId } : undefined;
  }
  return undefined;
}

function getSystemFactionSupportDelta(state: WorldState, faction: WorldFaction): number {
  const parts = faction.id.split(":");
  const anchorId = parts[parts.length - 1];
  if (faction.type === "regional_patrol") {
    const region = state.regions[anchorId];
    if (!region) return 0;
    const production = region.state.production ?? 0;
    const stability = region.state.stability ?? 0;
    return Math.max(1, Math.round((production * 0.04) + (stability * 0.02)));
  }

  const city = state.cities[anchorId];
  if (!city) return 0;
  if (faction.type === "public_guard") {
    return Math.max(1, Math.round(((city.state.order ?? 0) * 0.04) + ((city.state.supply ?? 0) * 0.015)));
  }
  if (faction.type === "civic_authority") {
    return Math.max(1, Math.round(((city.state.attractiveness ?? 0) * 0.025) + ((city.state.order ?? 0) * 0.02) + ((city.state.supply ?? 0) * 0.015)));
  }
  if (faction.type === "logistics_office") {
    return Math.max(1, Math.round(((city.state.commerce ?? 0) * 0.03) + ((city.state.supply ?? 0) * 0.03)));
  }
  return 0;
}

function createSystemTension(
  state: WorldState,
  type: WorldTension["type"],
  severity: number,
  sourceRefs: EntityRef[],
  targetRefs: EntityRef[],
  tags: string[]
) {
  const targetSuffix = targetRefs.map(ref => ref.id).join("-");
  const tension: WorldTension = {
    id: makeId("tension", state.clock.tick, `${type}-${targetSuffix}-${tags.join("-")}`),
    type,
    severity,
    sourceRefs,
    targetRefs,
    sinceTick: state.clock.tick,
    tags
  };
  registerTension(state, tension);
}

function applySystemicTensionConversion(
  state: WorldState,
  ctx: TickContext,
  candidate: ActionCandidate,
  success: boolean
) {
  const source = `systemic_cycle:${candidate.action.id}:${success ? "success" : "failure"}`;
  const targetRef = candidate.targetRef;
  const cityRef = getDistrictCityRef(state, targetRef) ?? (targetRef.kind === "city" ? targetRef : undefined);
  const regionRef = getRegionRefForTarget(state, targetRef);
  const localRefs = cityRef ? [targetRef, cityRef] : [targetRef];

  if (candidate.action.id === "patrol" && success && targetRef.kind === "district") {
    relieveActiveTensions(state, [targetRef], ["criminal", "control_conflict"], 10, [candidate.actorRef], candidate.action.id);
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "fear", 4, source);
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "agitation", 2, source);
    if (cityRef) {
      applySystemShiftDelta(state, ctx.generatedDeltas, cityRef, "order", 2, source);
    }
    createSystemTension(state, "social", 14, [candidate.actorRef], [targetRef], ["patrol_backlash"]);
    return;
  }

  if (candidate.action.id === "extort" && success && targetRef.kind === "district") {
    createSystemTension(state, "criminal", 14, [candidate.actorRef], [targetRef], ["extortion_spree"]);
    if (cityRef) {
      applySystemShiftDelta(state, ctx.generatedDeltas, cityRef, "commerce", -1, source);
    }
    return;
  }

  if (candidate.action.id === "recruit" && success && targetRef.kind === "district") {
    createSystemTension(state, "social", 10, [candidate.actorRef], [targetRef], ["recruitment_rumors"]);
    return;
  }

  if (candidate.action.id === "inspect_customs" && success && targetRef.kind === "district") {
    relieveActiveTensions(state, localRefs, ["commercial", "criminal", "control_conflict"], 8, [candidate.actorRef], candidate.action.id);
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "agitation", 5, source);
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "fear", 2, source);
    if (regionRef) {
      applySystemShiftDelta(state, ctx.generatedDeltas, regionRef, "politicalControl", 2, source);
    }
    createSystemTension(state, "political", 16, [candidate.actorRef], [targetRef], ["customs_pushback"]);
    return;
  }

  if (candidate.action.id === "public_reassurance" && success && targetRef.kind === "district") {
    relieveActiveTensions(state, [targetRef], ["social", "religious", "political", "control_conflict"], 8, [candidate.actorRef], candidate.action.id);
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "surveillance", -2, source);
    if (cityRef) {
      applySystemShiftDelta(state, ctx.generatedDeltas, cityRef, "order", 1, source);
    }
    return;
  }

  if (candidate.action.id === "relief_distribution" && success && targetRef.kind === "district") {
    relieveActiveTensions(state, localRefs, ["scarcity", "social"], 4, [candidate.actorRef], candidate.action.id);
    if (cityRef) {
      applySystemShiftDelta(state, ctx.generatedDeltas, cityRef, "supply", -3, source);
      applySystemShiftDelta(state, ctx.generatedDeltas, cityRef, "commerce", 1, source);
    }
    ctx.generatedOpportunities.push({
      id: makeId("opportunity", state.clock.tick, `${candidate.action.id}-${targetRef.id}`),
      kind: "scarcity_trade",
      location: targetRef,
      score: 44,
      sourceRefs: [candidate.actorRef, targetRef],
      tags: ["aid_flow", "redistribution"]
    });
    return;
  }

  if (candidate.action.id === "reopen_market" && success && targetRef.kind === "district") {
    relieveActiveTensions(state, localRefs, ["scarcity", "commercial"], 3, [candidate.actorRef], candidate.action.id);
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "danger", 4, source);
    if (cityRef) {
      applySystemShiftDelta(state, ctx.generatedDeltas, cityRef, "commerce", 2, source);
    }
    createSystemTension(state, "criminal", 18, [candidate.actorRef], [targetRef], ["market_visibility"]);
    return;
  }

  if ((candidate.action.id === "secure_route" || candidate.action.id === "repair_route") && success && targetRef.kind === "route") {
    relieveActiveTensions(state, [targetRef], ["military", "mobility_risk"], 10, [candidate.actorRef], candidate.action.id);
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "traffic", 3, source);
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "ambushRisk", 2, source);
    const route = state.routes[targetRef.id];
    if (route) {
      const originCityRef = state.cities[route.originId] ? { kind: "city", id: route.originId } as const : undefined;
      const destinationCityRef = state.cities[route.destinationId] ? { kind: "city", id: route.destinationId } as const : undefined;
      if (originCityRef) {
        applySystemShiftDelta(state, ctx.generatedDeltas, originCityRef, "commerce", 2, source);
      }
      if (destinationCityRef) {
        applySystemShiftDelta(state, ctx.generatedDeltas, destinationCityRef, "commerce", 2, source);
      }
    }
    createSystemTension(state, "criminal", 12, [candidate.actorRef], [targetRef], ["corridor_exposure"]);
    return;
  }

  if (!success && candidate.action.id === "reopen_market" && targetRef.kind === "district") {
    applySystemShiftDelta(state, ctx.generatedDeltas, targetRef, "agitation", 3, source);
    if (regionRef) {
      applySystemShiftDelta(state, ctx.generatedDeltas, regionRef, "politicalControl", -1, source);
    }
    createSystemTension(state, "scarcity", 14, [candidate.actorRef], localRefs, ["market_failure"]);
  }
}

function applyTerritorialWear(state: WorldState, scale: TickScale): StateDelta[] {
  if (scale !== "macro") return [];
  const deltas: StateDelta[] = [];

  Object.values(state.routes).forEach(route => {
    const militaryPressure = getPressure(state, { kind: "route", id: route.id }, "military");
    const traffic = route.state.traffic ?? 0;
    const ambushRisk = route.state.ambushRisk ?? 0;
    const materialWear = -Math.max(1, Math.round((traffic + militaryPressure + ambushRisk * 0.5) / 85));
    applyWearDelta(state, deltas, { kind: "route", id: route.id }, "materialState", materialWear, "macro_route_material_wear");
    if (militaryPressure >= 52 || ambushRisk >= 48) {
      applyWearDelta(state, deltas, { kind: "route", id: route.id }, "security", -1, "macro_route_security_wear");
    }
  });

  Object.values(state.districts).forEach(district => {
    const socialPressure = getPressure(state, { kind: "district", id: district.id }, "social");
    const criminalPressure = getPressure(state, { kind: "district", id: district.id }, "criminal");
    const commerce = district.state.commerce ?? 0;
    applyWearDelta(state, deltas, { kind: "district", id: district.id }, "fear", 1, "macro_district_fear_drift");
    if (socialPressure >= 55) {
      applyWearDelta(state, deltas, { kind: "district", id: district.id }, "agitation", 1, "macro_district_agitation_drift");
    }
    if (socialPressure >= 60 || criminalPressure >= 55) {
      applyWearDelta(state, deltas, { kind: "district", id: district.id }, "commerce", -1, "macro_district_commerce_wear");
    } else if (commerce >= 55) {
      applyWearDelta(state, deltas, { kind: "district", id: district.id }, "commerce", -1, "macro_district_commerce_friction");
    }
  });

  Object.values(state.cities).forEach(city => {
    const commercialPressure = getPressure(state, { kind: "city", id: city.id }, "commercial");
    applyWearDelta(state, deltas, { kind: "city", id: city.id }, "supply", -1, "macro_city_supply_wear");
    if (commercialPressure >= 55) {
      applyWearDelta(state, deltas, { kind: "city", id: city.id }, "commerce", -1, "macro_city_commerce_wear");
    }
    if ((city.state.order ?? 0) >= 35) {
      applyWearDelta(state, deltas, { kind: "city", id: city.id }, "order", -1, "macro_city_order_wear");
    }
  });

  Object.values(state.regions).forEach(region => {
    const politicalPressure = getPressure(state, { kind: "region", id: region.id }, "political");
    applyWearDelta(state, deltas, { kind: "region", id: region.id }, "circulation", -1, "macro_region_circulation_wear");
    if (politicalPressure >= 55 || (region.state.externalThreat ?? 0) >= 48) {
      applyWearDelta(state, deltas, { kind: "region", id: region.id }, "stability", -1, "macro_region_stability_wear");
      applyWearDelta(state, deltas, { kind: "region", id: region.id }, "politicalControl", -1, "macro_region_control_wear");
    }
  });

  Object.values(state.factions).forEach(faction => {
    if (!faction.tags.includes("system")) return;
    const supportDelta = getSystemFactionSupportDelta(state, faction);
    if (supportDelta > 0) {
      applyWearDelta(state, deltas, { kind: "faction", id: faction.id }, "resources", supportDelta, "macro_system_faction_support");
    }
    applyWearDelta(state, deltas, { kind: "faction", id: faction.id }, "resources", -1, "macro_system_faction_upkeep");
  });

  return deltas;
}

function updateObjectiveProgress(
  state: WorldState,
  deltas: StateDelta[],
  objectiveId: EntityId | undefined,
  amount: number,
  actionId?: WorldActionDefinition["id"]
) {
  if (!objectiveId) return;
  const objective = state.specialObjectives[objectiveId];
  if (!objective) return;
  const activePhase = getActiveObjectivePhase(objective);
  const before = objective.progress;
  const globalAmount = activePhase ? amount * Math.max(0, activePhase.progressWeight || 1) : amount;
  const after = clamp(before + globalAmount);
  objective.progress = after;
  if (!activePhase && after >= 100) {
    objective.state = "completed";
  } else if (objective.state === "planned") {
    objective.state = "active";
  }
  deltas.push({
    target: { kind: "specialObjective", id: objectiveId },
    key: "objective_progress",
    before,
    after,
    amount: globalAmount
  });
  if (activePhase) {
    const phaseBefore = activePhase.progress;
    const phaseAfter = clamp(phaseBefore + amount);
    activePhase.progress = phaseAfter;
    if (actionId) {
      activePhase.actionCountById = {
        ...(activePhase.actionCountById ?? {}),
        [actionId]: (activePhase.actionCountById?.[actionId] ?? 0) + 1
      };
    }
    deltas.push({
      target: { kind: "specialObjective", id: objectiveId },
      key: "phase_progress",
      before: phaseBefore,
      after: phaseAfter,
      amount,
      meta: { phaseId: activePhase.id }
    });
    if (isPhaseCompletionReached(state, objective, activePhase)) {
      advanceObjectivePhase(state, deltas, objectiveId, activePhase);
    }
  }
}

function getFailureSeverity(candidate: ActionCandidate): number {
  const maxRiskSeverity = candidate.action.risks.reduce((max, risk) => Math.max(max, risk.severity), 0);
  const scoreFactor = clamp(candidate.score, 0, 100) * 0.08;
  return Math.max(10, Math.round(12 + maxRiskSeverity * 0.75 + scoreFactor));
}

function hasFatalFailureCondition(conditions: string[] | undefined, causes: string[]): boolean {
  if (!conditions || conditions.length === 0) return false;
  return conditions.some(condition => {
    const normalized = condition.trim().toLowerCase();
    return causes.some(cause => cause === normalized);
  });
}

function applyObjectiveFailureConsequences(
  state: WorldState,
  ctx: TickContext,
  objective: SpecialObjective | undefined,
  targetRef: EntityRef
) {
  if (!objective || objective.state !== "failed" || objective.failureConsequencesApplied) return;
  objective.failureConsequencesApplied = true;
  objective.onFailure.forEach((template, index) => {
    if (template.type === "create_tension") {
      const tension: WorldTension = {
        id: makeId("tension", state.clock.tick, `${objective.id}-failure-${index}`),
        type: template.tensionType,
        severity: template.severity,
        sourceRefs: [objective.owner],
        targetRefs: [targetRef],
        sinceTick: state.clock.tick,
        tags: template.tags
      };
      registerTension(state, tension);
      return;
    }
    if (template.type === "open_opportunity") {
      ctx.generatedOpportunities.push({
        id: makeId("opportunity", state.clock.tick, `${objective.id}-failure-${index}`),
        kind: template.kind,
        location: targetRef,
        score: template.score,
        sourceRefs: [objective.owner, targetRef],
        tags: template.tags
      });
      return;
    }
    ctx.generatedSignals.push({
      id: makeId("signal", state.clock.tick, `${objective.id}-failure-${index}`),
      kind: template.signalKind,
      location: targetRef,
      intensity: template.intensity,
      tags: template.tags,
      payload: { objectiveId: objective.id, outcome: "failed" }
    });
  });
}

function applyObjectiveFailure(
  state: WorldState,
  ctx: TickContext,
  deltas: StateDelta[],
  objective: SpecialObjective,
  causes: string[],
  fallbackTargetRef: EntityRef
) {
  const activePhase = getActiveObjectivePhase(objective);
  if (activePhase && activePhase.state !== "completed") {
    closePhaseHistoryEntry(objective, activePhase.id, state.clock.tick, "failed", causes);
    activePhase.state = "failed";
  }
  objective.state = "failed";
  deltas.push({
    target: { kind: "specialObjective", id: objective.id },
    key: "objective_failure",
    before: objective.failureScore,
    after: objective.failureScore,
    amount: 0,
    meta: {
      phaseId: activePhase?.id ?? null,
      transition: "failed",
      causes: causes.join("|")
    }
  });
  applyObjectiveFailureConsequences(state, ctx, objective, getObjectiveActionTarget(objective) ?? fallbackTargetRef);
}

function updateObjectiveFailure(
  state: WorldState,
  ctx: TickContext,
  deltas: StateDelta[],
  objectiveId: EntityId | undefined,
  amount: number,
  fallbackTargetRef: EntityRef
): number {
  if (!objectiveId) return 0;
  const objective = state.specialObjectives[objectiveId];
  if (!objective || objective.state === "completed" || objective.state === "failed") return 0;
  const activePhase = getActiveObjectivePhase(objective);
  const appliedAmount = Math.max(0, amount);
  if (activePhase) {
    const phaseBefore = activePhase.failureScore;
    const phaseAfter = clamp(phaseBefore + appliedAmount);
    activePhase.failureScore = phaseAfter;
    deltas.push({
      target: { kind: "specialObjective", id: objectiveId },
      key: "phase_failure",
      before: phaseBefore,
      after: phaseAfter,
      amount: appliedAmount,
      meta: { phaseId: activePhase.id }
    });
    if (phaseAfter >= activePhase.maxFailureScore) {
      const phaseCauses = ["phase_failure_threshold"];
      const fatalPhaseFailure =
        activePhase.failureMode === "fatal_condition" ||
        hasFatalFailureCondition(activePhase.fatalFailureConditions, phaseCauses) ||
        hasFatalFailureCondition(objective.fatalFailureConditions, [...phaseCauses, "phase_failed"]);
      activePhase.state = fatalPhaseFailure ? "failed" : "blocked";
      if (fatalPhaseFailure) {
        applyObjectiveFailure(state, ctx, deltas, objective, [...phaseCauses, "phase_failed"], fallbackTargetRef);
        return appliedAmount;
      }
      closePhaseHistoryEntry(objective, activePhase.id, state.clock.tick, "blocked", phaseCauses);
      objective.state = "blocked";
    }
  }
  const objectiveBefore = objective.failureScore;
  const objectiveAmount = Math.max(1, Math.round(appliedAmount * 0.6));
  const objectiveAfter = clamp(objectiveBefore + objectiveAmount);
  objective.failureScore = objectiveAfter;
  deltas.push({
    target: { kind: "specialObjective", id: objectiveId },
    key: "objective_failure",
    before: objectiveBefore,
    after: objectiveAfter,
    amount: objectiveAmount,
    meta: { phaseId: activePhase?.id ?? null }
  });
  if (
    objectiveAfter >= objective.maxFailureScore ||
    hasFatalFailureCondition(objective.fatalFailureConditions, ["objective_failure_threshold"])
  ) {
    applyObjectiveFailure(state, ctx, deltas, objective, ["objective_failure_threshold"], fallbackTargetRef);
  }
  return appliedAmount;
}

function extractPhaseTransitionsFromDeltas(deltas: StateDelta[]): PhaseTransitionTrace[] {
  return deltas
    .filter(delta => delta.target.kind === "specialObjective")
    .map((delta): PhaseTransitionTrace | null => {
      const phaseId = typeof delta.meta?.phaseId === "string" ? delta.meta.phaseId : undefined;
      const transition = typeof delta.meta?.transition === "string" ? delta.meta.transition : undefined;
      const reasons = typeof delta.meta?.causes === "string" ? delta.meta.causes.split("|").filter(Boolean) : [];
      if (delta.key === "phase_progress" && transition === "completed") {
        return {
          objectiveId: delta.target.id,
          phaseId,
          transition: "completed" as const,
          progressBefore: delta.before,
          progressAfter: delta.after,
          reasons: ["phase_completion"]
        };
      }
      if (delta.key === "phase_progress" && transition === "activated") {
        return {
          objectiveId: delta.target.id,
          phaseId,
          transition: "activated" as const,
          progressBefore: delta.before,
          progressAfter: delta.after,
          reasons: []
        };
      }
      if (delta.key === "phase_progress") {
        return {
          objectiveId: delta.target.id,
          phaseId,
          transition: "progressed" as const,
          progressBefore: delta.before,
          progressAfter: delta.after,
          reasons: []
        };
      }
      if (delta.key === "phase_failure") {
        return {
          objectiveId: delta.target.id,
          phaseId,
          transition: "blocked" as const,
          failureBefore: delta.before,
          failureAfter: delta.after,
          reasons
        };
      }
      if (delta.key === "objective_failure" && transition === "failed") {
        return {
          objectiveId: delta.target.id,
          phaseId,
          transition: "objective_failed" as const,
          failureBefore: delta.before,
          failureAfter: delta.after,
          reasons
        };
      }
      return null;
    })
    .filter((entry): entry is PhaseTransitionTrace => Boolean(entry));
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

function decrementCooldowns(state: WorldState, scale: TickScale) {
  const step = scale === "macro" ? Math.max(1, state.clock.microPerMacro) : 1;
  [...Object.values(state.factions), ...Object.values(state.mobileActors)].forEach(actor => {
    Object.keys(actor.cooldowns).forEach(actionId => {
      const current = actor.cooldowns[actionId as keyof typeof actor.cooldowns] ?? 0;
      if (current > 0) {
        actor.cooldowns[actionId as keyof typeof actor.cooldowns] = Math.max(0, current - step);
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

function syncRouteMobilePresence(state: WorldState) {
  Object.values(state.routes).forEach(route => {
    route.mobileActorIds = [];
  });

  Object.values(state.mobileActors).forEach(actor => {
    const routeId =
      actor.position.kind === "route"
        ? actor.position.id
        : actor.itinerary[0];
    if (!routeId) return;
    const route = state.routes[routeId];
    if (!route) return;
    if (!route.mobileActorIds.includes(actor.id)) {
      route.mobileActorIds.push(actor.id);
    }
  });
}

function getLeadingRouteForActor(state: WorldState, actor: MobileActor): WorldRoute | undefined {
  const routeId =
    actor.position.kind === "route"
      ? actor.position.id
      : actor.itinerary[0];
  return routeId ? state.routes[routeId] : undefined;
}

function findAlternateRoute(state: WorldState, route: WorldRoute): WorldRoute | undefined {
  return Object.values(state.routes)
    .filter(candidate =>
      candidate.id !== route.id &&
      ((candidate.originId === route.originId && candidate.destinationId === route.destinationId) ||
        (candidate.originId === route.destinationId && candidate.destinationId === route.originId))
    )
    .sort((left, right) => {
      const leftScore = (left.state.security ?? 0) - (left.state.ambushRisk ?? 0) + (left.state.materialState ?? 0) * 0.35;
      const rightScore = (right.state.security ?? 0) - (right.state.ambushRisk ?? 0) + (right.state.materialState ?? 0) * 0.35;
      return rightScore - leftScore;
    })[0];
}

function getRouteEndpointRef(state: WorldState, endpointId: EntityId): EntityRef {
  if (state.cities[endpointId]) {
    return { kind: "city", id: endpointId };
  }
  if (state.regions[endpointId]) {
    return { kind: "region", id: endpointId };
  }
  return { kind: "route", id: endpointId };
}

function resolveArrivalPosition(state: WorldState, actor: MobileActor, route: WorldRoute): EntityRef {
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

function getRouteDestinationStopProgress(route: WorldRoute, actor: MobileActor): number | undefined {
  if (actor.destination?.kind !== "route" || actor.destination.id !== route.id) return undefined;
  if (typeof actor.destinationRouteProgress !== "number" || !Number.isFinite(actor.destinationRouteProgress)) return undefined;
  return clamp(actor.destinationRouteProgress, 0, getRouteTraversalCost(route, actor));
}

function createMobileTravelEvent(
  state: WorldState,
  ctx: TickContext,
  actor: MobileActor,
  route: WorldRoute,
  reason: string,
  payload: Record<string, number | string | boolean | null>
): WorldEvent {
  const actorRef: EntityRef = { kind: "mobileActor", id: actor.id };
  const event: WorldEvent = {
    id: makeId("event", state.clock.tick, `${actor.id}-${reason}`),
    type: "mobile_actor_delayed",
    tick: state.clock.tick,
    actor: actorRef,
    target: { kind: "route", id: route.id },
    success: false,
    deltas: ctx.generatedDeltas.filter(delta => delta.target.kind === "mobileActor" && delta.target.id === actor.id),
    tags: ["deplacement", reason],
    payload: { routeId: route.id, ...payload }
  };
  ctx.generatedEvents.push(event);
  return event;
}

function mobileHasTag(actor: MobileActor, patterns: string[]): boolean {
  const values = [
    actor.typeEntity,
    actor.travelMode,
    actor.modeTransport ?? "",
    ...actor.possibleInteractionTags
  ].map(value => value.toLowerCase());
  return values.some(value => patterns.some(pattern => value.includes(pattern)));
}

function getMobilePrimaryObjectiveId(actor: MobileActor): EntityId | undefined {
  return [...actor.objectives].sort((left, right) => right.priority - left.priority)[0]?.objectiveId;
}

function applyMobileLocalReactions(state: WorldState, ctx: TickContext, actor: MobileActor, target: EntityRef): StateDelta[] {
  const deltaStart = ctx.generatedDeltas.length;
  const owner = getMobileOwnerFaction(state, actor);
  if (!owner) return [];
  if (recentlyLoggedInteraction(actor, "mobile_local_reaction", target.id, 8, state.clock.tick)) return [];

  const isSupply = (actor.state.cargo ?? 0) >= 18 || mobileHasTag(actor, ["commerce", "trade", "approvisionnement", "supply", "grain", "convoi"]);
  const isSecurity = (actor.state.security ?? 0) >= 48 || mobileHasTag(actor, ["militaire", "escort", "escorte", "patrol", "patrouille", "secur", "inspection"]);
  const isCriminal = mobileHasTag(actor, ["crimin", "smuggl", "contreband", "embuscade"]);
  const isReligious = mobileHasTag(actor, ["relig", "rituel", "pelerin", "pilgrim"]);
  const localFactions = getFactionsPresentAtRef(state, target)
    .filter(faction => faction.id !== owner.id)
    .slice(0, 3);

  localFactions.forEach(faction => {
    const relation = getRelationBetween(owner, faction.id);
    const refs = [{ kind: "mobileActor" as const, id: actor.id }, target];
    if (isCriminal || relation === "war") {
      applyFactionRelationShift(state, owner.id, faction.id, -3, relation === "war" ? 6 : 4, "mobile_local_friction", refs);
      return;
    }
    if (isSupply || isSecurity) {
      applyFactionRelationShift(state, owner.id, faction.id, 3, -2, "mobile_local_support", refs);
      return;
    }
    if (isReligious) {
      applyFactionRelationShift(state, owner.id, faction.id, faction.tags.includes("religious") ? 4 : 1, faction.tags.includes("criminal") ? 2 : -1, "mobile_local_influence", refs);
    }
  });

  if (target.kind === "city") {
    if (isSupply) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "commerce", 1, `mobile_reaction:${actor.id}`);
    if (isSecurity) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "order", 1, `mobile_reaction:${actor.id}`);
    if (isCriminal) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "corruption", 2, `mobile_reaction:${actor.id}`);
    if (isReligious) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "cohesion", 1, `mobile_reaction:${actor.id}`);
  }
  if (target.kind === "route") {
    if (isSecurity) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "security", 1, `mobile_reaction:${actor.id}`);
    if (isCriminal) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "ambushRisk", 2, `mobile_reaction:${actor.id}`);
  }

  const reactionDeltas = ctx.generatedDeltas.slice(deltaStart);
  const refs = [{ kind: "mobileActor" as const, id: actor.id }, { kind: "faction" as const, id: owner.id }, target];
  appendHistory(state, refs, {
    tick: state.clock.tick,
    type: "mobile_local_reaction",
    summary: `${actor.id} provoque une reaction locale sur ${target.kind}:${target.id}`,
    refs
  });
  return reactionDeltas;
}

function applyMobileArrivalConsequences(state: WorldState, ctx: TickContext, actor: MobileActor, target: EntityRef): StateDelta[] {
  const deltaStart = ctx.generatedDeltas.length;
  const actorRef: EntityRef = { kind: "mobileActor", id: actor.id };
  const source = `mobile_arrival:${actor.id}`;
  const cargo = actor.state.cargo ?? 0;
  const security = actor.state.security ?? 0;
  const headcount = actor.state.headcount ?? 0;
  const isSupply = cargo >= 18 || mobileHasTag(actor, ["commerce", "trade", "approvisionnement", "supply", "grain", "convoi"]);
  const isSecurity = security >= 48 || mobileHasTag(actor, ["militaire", "escort", "escorte", "patrol", "patrouille", "secur", "inspection"]);
  const isCriminal = mobileHasTag(actor, ["crimin", "smuggl", "contreband", "embuscade"]);
  const isReligious = mobileHasTag(actor, ["relig", "rituel", "pelerin", "pilgrim"]);

  if (target.kind === "city") {
    if (isSupply) {
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "supply", Math.min(8, 2 + Math.round(cargo / 18)), source);
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "commerce", 2, source);
      if (cargo > 0) applyMobileImpactDelta(state, ctx.generatedDeltas, actorRef, "cargo", -Math.min(12, Math.max(4, Math.round(cargo * 0.2))), source);
    }
    if (isSecurity) {
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "order", Math.min(5, 1 + Math.round(security / 28)), source);
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "fear", -1, source);
    }
    if (isCriminal) {
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "corruption", 3, source);
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "commerce", 1, source);
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "order", -1, source);
    }
    if (isReligious) {
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "cohesion", 2, source);
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "agitation", 1, source);
    }
  } else if (target.kind === "region") {
    if (isSupply) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "circulation", 3, source);
    if (isSecurity) {
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "stability", 2, source);
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "politicalControl", 1, source);
    }
    if (isCriminal) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "politicalControl", -2, source);
    if (isReligious) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "cohesion", 2, source);
  } else if (target.kind === "route") {
    if (isSupply) applyMobileImpactDelta(state, ctx.generatedDeltas, target, "traffic", 3, source);
    if (isSecurity) {
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "security", Math.min(5, 2 + Math.round(headcount / 18)), source);
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "ambushRisk", -3, source);
    }
    if (isCriminal) {
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "ambushRisk", 4, source);
      applyMobileImpactDelta(state, ctx.generatedDeltas, target, "traffic", -2, source);
    }
  }

  applyMobileImpactDelta(state, ctx.generatedDeltas, actorRef, "fatigue", -4, source);
  updateObjectiveProgress(state, ctx.generatedDeltas, getMobilePrimaryObjectiveId(actor), 8, "move_resources");
  applyMobileLocalReactions(state, ctx, actor, target);

  const arrivalDeltas = ctx.generatedDeltas.slice(deltaStart);
  if (arrivalDeltas.length > 0) {
    appendHistory(state, [actorRef, target], {
      tick: state.clock.tick,
      type: "mobile_arrival_effect",
      summary: `${actor.id} applique ${arrivalDeltas.length} effet(s) a l'arrivee sur ${target.kind}:${target.id}`,
      refs: [actorRef, target]
    });
  }
  return arrivalDeltas;
}

function applyMobileTravelSetback(
  state: WorldState,
  ctx: TickContext,
  actor: MobileActor,
  route: WorldRoute,
  reason: "hold" | "delay" | "ambush" | "reroute",
  severity: number
): StateDelta[] {
  const deltaStart = ctx.generatedDeltas.length;
  const actorRef: EntityRef = { kind: "mobileActor", id: actor.id };
  const routeRef: EntityRef = { kind: "route", id: route.id };
  const objectiveId = getMobilePrimaryObjectiveId(actor);
  const normalizedSeverity = Math.max(1, Math.round(severity));
  const source = `mobile_${reason}:${actor.id}`;

  if (objectiveId) {
    updateObjectiveFailure(state, ctx, ctx.generatedDeltas, objectiveId, Math.min(18, 4 + Math.round(normalizedSeverity / 9)), routeRef);
  }

  if (reason === "ambush") {
    applyMobileImpactDelta(state, ctx.generatedDeltas, routeRef, "ambushRisk", 5, source, "mobile_setback");
    applyMobileImpactDelta(state, ctx.generatedDeltas, routeRef, "security", -4, source, "mobile_setback");
    applyMobileImpactDelta(state, ctx.generatedDeltas, actorRef, "resources", -3, source, "mobile_setback");
  } else if (reason === "reroute") {
    applyMobileImpactDelta(state, ctx.generatedDeltas, routeRef, "traffic", -2, source, "mobile_setback");
    applyMobileImpactDelta(state, ctx.generatedDeltas, actorRef, "fatigue", 3, source, "mobile_setback");
  } else {
    applyMobileImpactDelta(state, ctx.generatedDeltas, routeRef, "traffic", -1, source, "mobile_setback");
  }

  if (actor.destination?.kind === "city") {
    const destinationRef: EntityRef = { kind: "city", id: actor.destination.id };
    if ((actor.state.cargo ?? 0) >= 18 || mobileHasTag(actor, ["commerce", "trade", "approvisionnement", "supply", "grain", "convoi"])) {
      applyMobileImpactDelta(state, ctx.generatedDeltas, destinationRef, "supply", reason === "ambush" ? -3 : -1, source, "mobile_setback");
      if (reason === "ambush") applyMobileImpactDelta(state, ctx.generatedDeltas, destinationRef, "commerce", -1, source, "mobile_setback");
    }
  }

  const tensionType = reason === "ambush" ? "criminal" : "mobility_risk";
  const tensionSeverity = Math.min(reason === "ambush" ? 78 : 72, 24 + normalizedSeverity);
  const tensionTags = ["mobile", reason, actor.id];
  const existingMobileTension = Object.values(state.tensions).find(
    tension =>
      tension.type === tensionType &&
      tension.tags.includes("mobile") &&
      tension.tags.includes(reason) &&
      tension.tags.includes(actor.id) &&
      tension.targetRefs.some(ref => ref.kind === "route" && ref.id === route.id)
  );
  if (existingMobileTension) {
    existingMobileTension.severity = Math.max(existingMobileTension.severity, tensionSeverity);
    existingMobileTension.sourceRefs = mergeEntityRefs(existingMobileTension.sourceRefs, [actorRef]);
    existingMobileTension.targetRefs = mergeEntityRefs(existingMobileTension.targetRefs, [routeRef]);
    linkTensionToTargets(state, existingMobileTension.id, existingMobileTension.targetRefs);
  } else {
    registerTension(state, {
      id: makeId("tension", state.clock.tick, `${actor.id}-${reason}`),
      type: tensionType,
      severity: tensionSeverity,
      sourceRefs: [actorRef],
      targetRefs: [routeRef],
      sinceTick: state.clock.tick,
      tags: tensionTags
    });
  }

  const deltas = ctx.generatedDeltas.slice(deltaStart);
  appendHistory(state, [actorRef, routeRef], {
    tick: state.clock.tick,
    type: reason === "ambush" ? "mobile_ambush_effect" : "mobile_delay_effect",
    summary: `${actor.id} subit ${reason} sur ${route.id}: ${deltas.length} effet(s), severite ${normalizedSeverity}`,
    refs: [actorRef, routeRef]
  });
  return deltas;
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

function describePressureTerm(definition: PressureDefinition, term: PressureDefinition["terms"][number]): string {
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

function evaluatePressureDefinition(
  state: WorldState,
  definition: PressureDefinition,
  entityId: EntityId
): PressureEvaluationTrace | null {
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

  if (!entity) return null;

  let weightedValue = 0;
  let weightTotal = 0;
  const terms: PressureEvaluationTrace["terms"] = [];
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

export function recomputePressures(state: WorldState): WorldState["pressures"] {
  return recomputePressuresDetailed(state).pressures;
}

export function recomputePressuresDetailed(state: WorldState): {
  pressures: WorldState["pressures"];
  trace: PressureTraceSnapshot;
} {
  const next: WorldState["pressures"] = {};
  const trace: PressureTraceSnapshot = {};
  ENTITY_PRESSURE_KINDS.forEach(kind => {
    next[kind] = {};
    trace[kind] = {};
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
      const entityTrace: PressureEvaluationTrace[] = [];
      PRESSURE_DEFINITIONS.filter(definition => definition.entityKind === kind).forEach(definition => {
        const evaluation = evaluatePressureDefinition(state, definition, entityId);
        if (!evaluation) return;
        map[definition.pressureType] = evaluation.clampedValue;
        entityTrace.push(evaluation);
      });
      next[kind]![entityId] = map;
      trace[kind]![entityId] = entityTrace;
    });
  });
  return { pressures: next, trace };
}

function getPressure(state: WorldState, ref: EntityRef, pressureType: string): number {
  const map = state.pressures[ref.kind]?.[ref.id];
  return (map && map[pressureType as keyof typeof map]) ?? 0;
}

function getObjective(state: WorldState, objectiveId: EntityId | undefined): SpecialObjective | undefined {
  return objectiveId ? state.specialObjectives[objectiveId] : undefined;
}

function isObjectiveActive(objective: SpecialObjective | undefined): objective is SpecialObjective {
  if (!objective) return false;
  return objective.state !== "completed" && objective.state !== "failed" && objective.state !== "blocked";
}

function getActiveMobileObjective(state: WorldState, actor: MobileActor): SpecialObjective | undefined {
  return actor.objectives
    .map(goal => state.specialObjectives[goal.objectiveId])
    .filter(isObjectiveActive)
    .sort((left, right) => right.priority - left.priority)[0];
}

function clearMobileAssignment(actor: MobileActor) {
  actor.destination = undefined;
  actor.itinerary = [];
  actor.currentRouteTargetId = undefined;
  actor.destinationRouteProgress = undefined;
  actor.routeProgress = 0;
}

function isSameEntityRef(left: EntityRef | undefined, right: EntityRef | undefined): boolean {
  return Boolean(left && right && left.kind === right.kind && left.id === right.id);
}

function pruneMobileStaleObjectives(state: WorldState, actor: MobileActor): number {
  const beforeCount = actor.objectives.length;
  actor.objectives = actor.objectives.filter(goal => isObjectiveActive(state.specialObjectives[goal.objectiveId]));
  const removedCount = beforeCount - actor.objectives.length;
  if (removedCount > 0 && actor.objectives.length === 0) {
    clearMobileAssignment(actor);
  }
  return removedCount;
}

function prepareMobileActorsForTick(state: WorldState) {
  Object.values(state.mobileActors).forEach(actor => {
    pruneMobileStaleObjectives(state, actor);
  });
}

function getLogisticsPlanBonus(logisticsPlans: LogisticsPlanTrace[], objectiveId: EntityId | undefined, actorRef: EntityRef): number {
  if (!objectiveId) return 0;
  const plan = logisticsPlans.find(entry => entry.objectifId === objectiveId);
  if (!plan) return 0;
  if (!plan.faisable) return actorRef.kind === "mobileActor" ? -16 : -8;
  if (actorRef.kind === "mobileActor" && plan.acteurAssigneId === actorRef.id) return 14;
  return 6;
}

function getObjectivePriorityBonus(category: ObjectiveCategory | undefined, action: WorldActionDefinition): number {
  if (!category) return 0;
  return action.compatibleObjectives.includes(category) ? 18 : -12;
}

function getObjectiveTensionId(objective: SpecialObjective | undefined): EntityId | undefined {
  return objective?.tags.find(tag => tag.startsWith("tension:"))?.slice("tension:".length);
}

function describeActionCause(parameters: {
  actorRef: EntityRef;
  objective?: SpecialObjective;
  targetPressure: number;
  logisticsPlanBonus: number;
}): ActionCauseTrace {
  const { actorRef, objective, targetPressure, logisticsPlanBonus } = parameters;
  const sourceObjectiveId = objective?.id;
  const sourceTensionId = getObjectiveTensionId(objective);
  if (objective?.tags.includes("cooperation_generated")) {
    return {
      kind: "cooperation",
      label: "Cooperation",
      detail: "objectif genere par une relation de confiance",
      sourceObjectiveId
    };
  }
  if (objective?.tags.includes("relation_generated")) {
    return {
      kind: "rivalite",
      label: "Rivalite",
      detail: "objectif genere par une relation hostile",
      sourceObjectiveId
    };
  }
  if (objective?.tags.includes("faction_generated") && sourceTensionId) {
    return {
      kind: "opportunite_crise",
      label: "Opportunite de crise",
      detail: "objectif opportuniste issu d'une tension active",
      sourceObjectiveId,
      sourceTensionId
    };
  }
  if (logisticsPlanBonus > 0 || objective?.category === "stabilize_supply" || objective?.category === "secure_corridor" || objective?.category === "reopen_market") {
    return {
      kind: "besoin_logistique",
      label: "Besoin logistique",
      detail: logisticsPlanBonus > 0 ? "plan logistique actif dans le scoring" : "objectif de flux, ravitaillement ou corridor",
      sourceObjectiveId
    };
  }
  if (objective?.tags.includes("system_generated")) {
    return {
      kind: "maintenance_systeme",
      label: "Maintenance systeme",
      detail: "objectif public genere par l'etat du monde",
      sourceObjectiveId
    };
  }
  if (actorRef.kind === "mobileActor") {
    return {
      kind: "reaction_mobile",
      label: "Acteur mobile",
      detail: "action portee par un mobile assigne a un objectif",
      sourceObjectiveId
    };
  }
  if (targetPressure > 0) {
    return {
      kind: "tension_locale",
      label: "Tension locale",
      detail: `pression cible ${Math.round(targetPressure)}`,
      sourceObjectiveId
    };
  }
  if (objective) {
    return {
      kind: "objective_active",
      label: "Objectif actif",
      detail: "objectif editorial ou runtime actif",
      sourceObjectiveId
    };
  }
  return {
    kind: "action_directe",
    label: "Action directe",
    detail: "action sans objectif explicite"
  };
}

function traceActorCandidates(actors: ActorCandidate[]): ActorCandidateTrace[] {
  return actors.map(candidate => ({
    actorRef: candidate.ref,
    objectiveId: candidate.objective?.id,
    objectiveCategory: candidate.objective?.category,
    priority: candidate.objective?.priority
  }));
}

function findActorCandidates(state: WorldState, scale: TickScale): ActorCandidate[] {
  const factionCandidates: ActorCandidate[] = Object.values(state.factions)
    .map(faction => {
      const objective = faction.objectives
        .map(goal => state.specialObjectives[goal.objectiveId])
        .filter(isObjectiveActive)
        .sort((left, right) => right.priority - left.priority)[0];
      return {
        ref: { kind: "faction" as const, id: faction.id },
        actor: faction,
        objective
      };
    })
    .filter(candidate => !candidate.actor.tags.includes("system") || Boolean(candidate.objective));

  const mobileCandidates: ActorCandidate[] = Object.values(state.mobileActors)
    .filter(actor => scale === "micro"
      ? actor.simulationLevel !== "abstract"
      : actor.simulationLevel === "active" || actor.simulationLevel === "summary")
      .map(actor => ({
        ref: { kind: "mobileActor" as const, id: actor.id },
        actor,
        objective: getActiveMobileObjective(state, actor)
      }))
      .filter(candidate => Boolean(candidate.objective));

  return [...factionCandidates, ...mobileCandidates];
}

function describeCondition(
  state: WorldState,
  actorRef: EntityRef,
  targetRef: EntityRef,
  objective: SpecialObjective | undefined,
  condition: WorldActionDefinition["preconditions"][number]
): { passed: boolean; label: string } {
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
  const target = getEntityState(state, targetRef) as { tags?: string[] } | undefined;
  return {
    passed: target?.tags?.includes(condition.tag) ?? false,
    label: `${targetRef.id}.tags contains ${condition.tag}`
  };
}

function getTargetRefsForAction(state: WorldState, action: WorldActionDefinition, actor: ActorCandidate): EntityRef[] {
  const objectiveTarget = getObjectiveActionTarget(actor.objective);
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

function getActionCandidates(state: WorldState, actors: ActorCandidate[], logisticsPlans: LogisticsPlanTrace[]): {
  candidates: ActionCandidate[];
  trace: ActionCandidateTrace[];
} {
  const candidates: ActionCandidate[] = [];
  const trace: ActionCandidateTrace[] = [];
  actors.forEach(actorCandidate => {
    WORLD_ACTION_DEFINITIONS
      .filter(definition => {
        if (!definition.actorKinds.includes(actorCandidate.ref.kind as never)) return false;
        if (!actorCandidate.objective) return true;
        if (!getObjectiveCompatibleActions(actorCandidate.objective).includes(definition.id)) return false;
        return definition.compatibleObjectives.includes(actorCandidate.objective.category);
      })
      .forEach(action => {
        const cooldown = getCooldown(actorCandidate.actor, action.id);
        if (cooldown > 0) {
          trace.push({
            actorRef: actorCandidate.ref,
            targetRef: getObjectiveActionTarget(actorCandidate.objective) ?? actorCandidate.ref,
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
          const actionCause = describeActionCause({
            actorRef: actorCandidate.ref,
            objective: actorCandidate.objective,
            targetPressure,
            logisticsPlanBonus
          });
          const score =
            action.basePriority +
            targetPressure * 0.35 +
            objectivePriorityBonus +
            objectivePriorityContribution +
            logisticsPlanBonus;
          candidates.push({
            actorRef: actorCandidate.ref,
            targetRef,
            objectiveId: actorCandidate.objective?.id,
            action,
            actionCause,
            score
          });
          trace.push({
            actorRef: actorCandidate.ref,
            targetRef,
            objectiveId: actorCandidate.objective?.id,
            actionId: action.id,
            actionCause,
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

function applyDeltaTemplate(
  state: WorldState,
  deltas: StateDelta[],
  actorRef: EntityRef,
  targetRef: EntityRef,
  objectiveId: EntityId | undefined,
  template: DeltaTemplate,
  actionId?: WorldActionDefinition["id"]
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
    updateObjectiveProgress(state, deltas, objectiveId, template.amount, actionId);
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
  if (!objective || objective.progress < 100 || objective.successConsequencesApplied) return;
  objective.successConsequencesApplied = true;
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
      registerTension(state, tension);
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

function resolveSelectedActions(state: WorldState, scale: TickScale, initialDeltas: StateDelta[] = []): TickContext {
  const objectiveReadiness = synchronizeObjectiveReadiness(state);
  reinitialiserRessourcesTransport(state);
  const logisticsPlans = buildFactionLogisticsPlans(state);
  applyFactionLogisticsPlans(state, logisticsPlans);
  const actors = findActorCandidates(state, scale);
  const ctx: TickContext = {
    state,
    scale,
    generatedEvents: [],
    generatedDeltas: [...initialDeltas],
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
      phaseTransitions: [],
        pressureSnapshots: {
          before: {},
          after: {}
        },
        objectiveReadiness
      }
    };

  Object.values(state.specialObjectives).forEach(objective => {
    ensureActivePhaseHistory(objective, state.clock.tick);
    if (objective.state !== "failed") return;
    applyObjectiveFailureConsequences(state, ctx, objective, getObjectiveActionTarget(objective) ?? objective.owner);
  });

  const { candidates, trace } = getActionCandidates(state, actors, logisticsPlans);
  ctx.trace.actionCandidates = trace;
  const resolvedActors = new Set<string>();

  candidates.forEach(candidate => {
    if (resolvedActors.has(candidate.actorRef.id)) return;
    const objectiveAtStart = getObjective(state, candidate.objectiveId);
    if (objectiveAtStart && (objectiveAtStart.state === "failed" || objectiveAtStart.state === "completed")) {
      return;
    }
    resolvedActors.add(candidate.actorRef.id);
    const deltaStart = ctx.generatedDeltas.length;
    const objectiveBeforeResolution = objectiveAtStart;
    const phaseIdBeforeResolution = getActiveObjectivePhase(objectiveBeforeResolution)?.id;

    candidate.action.costs.forEach(template =>
      applyDeltaTemplate(state, ctx.generatedDeltas, candidate.actorRef, candidate.targetRef, candidate.objectiveId, template, candidate.action.id)
    );
    const success = resolveActionSuccess(state, candidate);
    const templates = success ? candidate.action.successEffects : candidate.action.failureEffects;
    templates.forEach(template =>
      applyDeltaTemplate(state, ctx.generatedDeltas, candidate.actorRef, candidate.targetRef, candidate.objectiveId, template, candidate.action.id)
    );
    const failureScoreApplied = success
      ? 0
      : updateObjectiveFailure(state, ctx, ctx.generatedDeltas, candidate.objectiveId, getFailureSeverity(candidate), candidate.targetRef);

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
    ctx.trace.selectedActions.push({
      actorRef: candidate.actorRef,
      targetRef: candidate.targetRef,
      objectiveId: candidate.objectiveId,
      phaseId: phaseIdBeforeResolution,
      actionId: candidate.action.id,
      actionCause: candidate.actionCause,
      score: candidate.score,
      success,
      eventId: event.id,
      deltaCount: event.deltas.length,
      failureScoreApplied: failureScoreApplied > 0 ? failureScoreApplied : undefined
    });
    ctx.generatedSignals.push(createSignal(candidate, state.clock.tick));
    ctx.generatedRumors.push(createRumor(candidate, event, state.clock.tick));
    applySystemicTensionConversion(state, ctx, candidate, success);
    applyFactionRelationConsequences(state, candidate, success);
    const objectiveAfterResolution = getObjective(state, candidate.objectiveId);
    applyConsequencesFromObjective(state, ctx, objectiveAfterResolution, candidate.targetRef);
    applyObjectiveFailureConsequences(state, ctx, objectiveAfterResolution, candidate.targetRef);
  });

  return ctx;
}

function advanceMobileActors(state: WorldState, ctx: TickContext) {
  Object.values(state.mobileActors).forEach(actor => {
    pruneMobileStaleObjectives(state, actor);

    if (actor.itineraryMode !== "locked" && actor.destination && actor.position.kind !== "route") {
      const shortestItinerary = findShortestRouteItinerary(state, actor);
      if (shortestItinerary.length > 0) {
        actor.itinerary = shortestItinerary;
      }
    }

    if (actor.destination && actor.itinerary.length === 0 && isSameEntityRef(actor.position, actor.destination)) {
      clearMobileAssignment(actor);
    }

    if (actor.destination && actor.itinerary.length === 0) {
      const beforeProgress = actor.routeProgress;
      const actorRef: EntityRef = { kind: "mobileActor", id: actor.id };
      const waterMode = actor.modeTransport === "bateau" || actor.travelMode === "river" || actor.travelMode === "sea";
      if (waterMode && !canUseAbstractWaterTravel(state, actor)) {
        updateObjectiveFailure(state, ctx, ctx.generatedDeltas, getMobilePrimaryObjectiveId(actor), 6, actor.destination);
        ctx.trace.mobility.push({
          actorId: actor.id,
          outcome: "blocked",
          beforeProgress,
          afterProgress: actor.routeProgress,
          notes: ["navigation impossible sans acces eau"]
        });
        return;
      }

      const offRouteCost = getOffRouteTraversalCost(state, actor);
      const fatigue = actor.state.fatigue ?? 0;
      if (fatigue >= 88) {
        setStateStat(state, ctx.generatedDeltas, actorRef, "fatigue", -6);
        ctx.trace.mobility.push({
          actorId: actor.id,
          outcome: "delayed",
          beforeProgress,
          afterProgress: actor.routeProgress,
          notes: ["halte hors-route", `fatigue ${Math.round(fatigue)}`]
        });
        return;
      }

      const terrainPenalty = waterMode ? 0 : 1;
      const cargoPenalty = (actor.state.cargo ?? 0) >= 55 ? 1 : 0;
      const effectiveSpeed = Math.max(0.5, getProgressPerTick(actor, state) - terrainPenalty - cargoPenalty);
      actor.routeProgress = clamp(actor.routeProgress + effectiveSpeed, 0, offRouteCost);
      setStateStat(state, ctx.generatedDeltas, actorRef, "fatigue", waterMode ? 1 : 2);

      if (actor.routeProgress >= offRouteCost) {
        const destination = actor.destination;
        actor.position = destination;
        actor.destination = undefined;
        actor.destinationRouteProgress = undefined;
        actor.currentRouteTargetId = undefined;
        actor.routeProgress = 0;
        const arrivalDeltas = applyMobileArrivalConsequences(state, ctx, actor, destination);
        ctx.generatedEvents.push({
          id: makeId("event", state.clock.tick, `${actor.id}-arrive-offroute`),
          type: "mobile_actor_arrived",
          tick: state.clock.tick,
          actor: actorRef,
          target: destination,
          success: true,
          deltas: arrivalDeltas,
          tags: ["deplacement", "arrivee", waterMode ? "navigation_abstraite" : "hors_route"],
          payload: { mode: waterMode ? "navigation_abstraite" : "hors_route" }
        });
        ctx.trace.mobility.push({
          actorId: actor.id,
          outcome: "arrived",
          beforeProgress,
          afterProgress: actor.routeProgress,
          notes: [waterMode ? "arrivee navigation abstraite" : "arrivee hors-route", destination.id]
        });
        return;
      }

      ctx.trace.mobility.push({
        actorId: actor.id,
        outcome: "progress",
        beforeProgress,
        afterProgress: actor.routeProgress,
        notes: [
          waterMode ? "navigation abstraite" : "progression hors-route",
          `vitesse ${Math.round(effectiveSpeed * 10) / 10}`,
          `cout ${Math.round(offRouteCost * 10) / 10}`
        ]
      });
      return;
    }

    if (actor.itinerary.length === 0 || !actor.destination) {
      if ((actor.state.fatigue ?? 0) > 0) {
        setStateStat(state, ctx.generatedDeltas, { kind: "mobileActor", id: actor.id }, "fatigue", -4);
      }
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
    if (!isRouteCompatibleWithActor(route, actor)) {
      updateObjectiveFailure(state, ctx, ctx.generatedDeltas, getMobilePrimaryObjectiveId(actor), 5, { kind: "route", id: route.id });
      ctx.trace.mobility.push({
        actorId: actor.id,
        routeId: route.id,
        outcome: "blocked",
        beforeProgress: actor.routeProgress,
        afterProgress: actor.routeProgress,
        notes: ["mode incompatible avec le corridor"]
      });
      return;
    }

    const beforeProgress = actor.routeProgress;
    const actorRef: EntityRef = { kind: "mobileActor", id: actor.id };
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
    const hazardScore =
      militaryRisk * 0.35 +
      criminalRisk * 0.3 +
      materialRisk * 0.2 +
      fatigue * 0.15 +
      securityGap * 0.2 +
      cargo * 0.08;

    if (fatigue >= 82) {
      setStateStat(state, ctx.generatedDeltas, actorRef, "fatigue", -8);
      const event = createMobileTravelEvent(state, ctx, actor, route, "hold", {
        fatigue: Math.round(fatigue),
        raison: "maintien_position"
      });
      event.deltas = [...event.deltas, ...applyMobileTravelSetback(state, ctx, actor, route, "hold", Math.round(fatigue * 0.45))];
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
      const event = createMobileTravelEvent(state, ctx, actor, route, "reroute", {
        routePrecedenteId: route.id,
        routeAlternativeId: alternateRoute.id,
        scoreDanger: Math.round(hazardScore)
      });
      event.deltas = [...event.deltas, ...applyMobileTravelSetback(state, ctx, actor, route, "reroute", Math.round(hazardScore * 0.55))];
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
      const event = createMobileTravelEvent(state, ctx, actor, route, "ambush", {
        risqueCriminel: Math.round(criminalRisk),
        charge: Math.round(cargo),
        raison: "pression_embuscade"
      });
      event.deltas = [...event.deltas, ...applyMobileTravelSetback(state, ctx, actor, route, "ambush", Math.round(criminalRisk))];
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
      const event = createMobileTravelEvent(state, ctx, actor, route, "delay", {
        risqueMilitaire: Math.round(militaryRisk),
        risqueMateriel: Math.round(materialRisk),
        scoreDanger: Math.round(hazardScore)
      });
      event.deltas = [...event.deltas, ...applyMobileTravelSetback(state, ctx, actor, route, "delay", Math.round(hazardScore))];
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

    const speedPenalty =
      (fatigue >= 60 ? 1 : 0) +
      (materialRisk >= 45 ? 1 : 0) +
      (cargo >= 60 ? 1 : 0);
    const effectiveSpeed = Math.max(1, getProgressPerTick(actor, state) - speedPenalty);
    const routeTraversalCost = getRouteTraversalCost(route, actor);
    const stopProgress = getRouteDestinationStopProgress(route, actor);
    const absoluteBefore = getAbsoluteRouteProgress(route, actor);
    const movingTowardOrigin = actor.currentRouteTargetId === route.originId;
    const absoluteAfter = clamp(
      absoluteBefore + (movingTowardOrigin ? -effectiveSpeed : effectiveSpeed),
      0,
      routeTraversalCost
    );
    const reachedRouteStop =
      typeof stopProgress === "number" &&
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
      const arrivalDeltas = applyMobileArrivalConsequences(state, ctx, actor, { kind: "route", id: route.id });
      ctx.generatedEvents.push({
        id: makeId("event", state.clock.tick, `${actor.id}-arrive-route-stop`),
        type: "mobile_actor_arrived",
        tick: state.clock.tick,
        actor: { kind: "mobileActor", id: actor.id },
        target: { kind: "route", id: route.id },
        success: true,
        deltas: arrivalDeltas,
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
    const finalArrival = actor.itinerary.length === 0;
    if (actor.itinerary.length === 0) {
      actor.destination = undefined;
      actor.destinationRouteProgress = undefined;
    }
    const arrivalDeltas = finalArrival ? applyMobileArrivalConsequences(state, ctx, actor, actor.position) : [];
    ctx.generatedEvents.push({
      id: makeId("event", state.clock.tick, `${actor.id}-arrive`),
      type: "mobile_actor_arrived",
      tick: state.clock.tick,
      actor: { kind: "mobileActor", id: actor.id },
      target: actor.position,
      success: true,
      deltas: arrivalDeltas,
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

function getMobileEncounterTone(state: WorldState, left: MobileActor, right: MobileActor): "support" | "friction" | "incident" | undefined {
  const leftOwner = getMobileOwnerFaction(state, left);
  const rightOwner = getMobileOwnerFaction(state, right);
  if (!leftOwner || !rightOwner || leftOwner.id === rightOwner.id) return undefined;
  const relation = getRelationBetween(leftOwner, rightOwner.id);
  const leftCriminal = mobileHasTag(left, ["crimin", "smuggl", "contreband", "embuscade"]);
  const rightCriminal = mobileHasTag(right, ["crimin", "smuggl", "contreband", "embuscade"]);
  const leftSecurity = (left.state.security ?? 0) >= 48 || mobileHasTag(left, ["militaire", "escort", "patrouille", "secur"]);
  const rightSecurity = (right.state.security ?? 0) >= 48 || mobileHasTag(right, ["militaire", "escort", "patrouille", "secur"]);
  if (relation === "war" || (leftCriminal && rightSecurity) || (rightCriminal && leftSecurity)) return "incident";
  if (relation === "rival" || leftCriminal || rightCriminal) return "friction";
  if (relation === "ally" || (leftSecurity && rightSecurity)) return "support";
  return undefined;
}

function processMobileEncounters(state: WorldState, ctx: TickContext) {
  let encounterCount = 0;
  Object.values(state.routes).forEach(route => {
    if (encounterCount >= 4) return;
    const actors = route.mobileActorIds
      .map(actorId => state.mobileActors[actorId])
      .filter((actor): actor is MobileActor => Boolean(actor))
      .filter(hasMobileTravelAssignment)
      .filter(actor => !recentlyLoggedInteraction(actor, "mobile_encounter", route.id, 12, state.clock.tick));
    if (actors.length < 2) return;

    for (let leftIndex = 0; leftIndex < actors.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < actors.length; rightIndex += 1) {
        if (encounterCount >= 4) return;
        const left = actors[leftIndex];
        const right = actors[rightIndex];
        const tone = getMobileEncounterTone(state, left, right);
        if (!tone) continue;
        const leftOwner = getMobileOwnerFaction(state, left);
        const rightOwner = getMobileOwnerFaction(state, right);
        if (!leftOwner || !rightOwner) continue;
        const routeRef: EntityRef = { kind: "route", id: route.id };
        const leftRef: EntityRef = { kind: "mobileActor", id: left.id };
        const rightRef: EntityRef = { kind: "mobileActor", id: right.id };
        const refs = [leftRef, rightRef, routeRef, { kind: "faction" as const, id: leftOwner.id }, { kind: "faction" as const, id: rightOwner.id }];

        if (tone === "support") {
          applyMobileImpactDelta(state, ctx.generatedDeltas, routeRef, "security", 2, `mobile_encounter:${left.id}:${right.id}`);
          applyMobileImpactDelta(state, ctx.generatedDeltas, leftRef, "fatigue", -2, `mobile_encounter:${right.id}`);
          applyMobileImpactDelta(state, ctx.generatedDeltas, rightRef, "fatigue", -2, `mobile_encounter:${left.id}`);
          applyFactionRelationShift(state, leftOwner.id, rightOwner.id, 2, -1, "mobile_route_support", refs);
        } else {
          const incident = tone === "incident";
          applyMobileImpactDelta(state, ctx.generatedDeltas, routeRef, "traffic", incident ? -3 : -1, `mobile_encounter:${left.id}:${right.id}`, "mobile_setback");
          applyMobileImpactDelta(state, ctx.generatedDeltas, routeRef, "ambushRisk", incident ? 3 : 1, `mobile_encounter:${left.id}:${right.id}`, "mobile_setback");
          applyMobileImpactDelta(state, ctx.generatedDeltas, leftRef, "fatigue", incident ? 3 : 1, `mobile_encounter:${right.id}`, "mobile_setback");
          applyMobileImpactDelta(state, ctx.generatedDeltas, rightRef, "fatigue", incident ? 3 : 1, `mobile_encounter:${left.id}`, "mobile_setback");
          applyFactionRelationShift(state, leftOwner.id, rightOwner.id, incident ? -3 : -1, incident ? 5 : 2, incident ? "mobile_route_incident" : "mobile_route_friction", refs);
          if (incident) {
            registerTension(state, {
              id: makeId("tension", state.clock.tick, `${left.id}-${right.id}-encounter`),
              type: "mobility_risk",
              severity: 36,
              sourceRefs: [leftRef, rightRef],
              targetRefs: [routeRef],
              sinceTick: state.clock.tick,
              tags: ["mobile", "encounter", "route"]
            });
          }
        }

        ctx.generatedEvents.push({
          id: makeId("event", state.clock.tick, `${left.id}-${right.id}-encounter`),
          type: "mobile_actor_encounter",
          tick: state.clock.tick,
          actor: leftRef,
          target: routeRef,
          success: tone === "support",
          deltas: ctx.generatedDeltas.filter(delta =>
            (delta.target.kind === "mobileActor" && (delta.target.id === left.id || delta.target.id === right.id)) ||
            (delta.target.kind === "route" && delta.target.id === route.id)
          ).slice(-8),
          tags: ["deplacement", "rencontre", tone],
          payload: { routeId: route.id, otherActorId: right.id, tone }
        });
        appendHistory(state, refs, {
          tick: state.clock.tick,
          type: "mobile_encounter",
          summary: `${left.id} rencontre ${right.id} sur ${route.id}: ${tone}`,
          refs
        });
        encounterCount += 1;
      }
    }
  });
}

function formatEntityRef(ref: EntityRef | undefined): string {
  return ref ? `${ref.kind}:${ref.id}` : "none";
}

function eventHistoryRefs(event: WorldEvent): EntityRef[] {
  return [
    event.actor,
    event.target,
    event.objectiveId ? { kind: "specialObjective", id: event.objectiveId } : undefined
  ].filter((ref): ref is EntityRef => Boolean(ref));
}

function commitWorldHistory(ctx: TickContext) {
  ctx.generatedEvents.forEach(event => {
    const refs = eventHistoryRefs(event);
    appendHistory(ctx.state, refs, {
      tick: event.tick,
      type: event.type,
      summary: `${event.success ? "success" : "failure"} ${event.type} by ${formatEntityRef(event.actor)} on ${formatEntityRef(event.target)}`,
      refs
    });
  });

  ctx.generatedDeltas.forEach(delta => {
    if (delta.key === "cooldown" || delta.key === "objective_progress" || delta.key === "phase_progress") return;
    appendHistory(ctx.state, [delta.target], {
      tick: ctx.state.clock.tick,
      type: "state_delta",
      summary: `${String(delta.key)} ${delta.amount && delta.amount > 0 ? "+" : ""}${delta.amount ?? 0}`,
      refs: [delta.target]
    });
  });
}

function diffuse(ctx: TickContext): TickOutput {
  commitWorldHistory(ctx);
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

function advanceClockOneHour(clock: WorldClock, scale: TickScale): WorldClock {
  const nextTick = clock.tick + 1;
  const nextMicro = clock.microTick + 1;
  const macroIncrement = scale === "macro" || nextMicro >= clock.microPerMacro ? 1 : 0;
  return {
    ...clock,
    tick: nextTick,
    microTick: nextMicro >= clock.microPerMacro ? 0 : nextMicro,
    macroTick: clock.macroTick + macroIncrement
  };
}

function runWorldStep(state: WorldState, scale: TickScale): TickOutput {
  const clockBefore = { ...state.clock };
  state.clock = advanceClockOneHour(state.clock, scale);
  decrementCooldowns(state, "micro");
  prepareMobileActorsForTick(state);
  syncRouteMobilePresence(state);
  const wearDeltas = applyTerritorialWear(state, scale);
  const beforePressures = recomputePressuresDetailed(state);
  state.pressures = beforePressures.pressures;
  if (scale === "macro") {
    reconcileSystemObjectives(state);
    reconcileFactionOpportunities(state);
    reconcileAutonomousMobiles(state);
  }
  const ctx = resolveSelectedActions(state, scale, wearDeltas);
  ctx.trace.clockBefore = clockBefore;
  ctx.trace.clockAfter = { ...state.clock };
  ctx.trace.pressureSnapshots.before = beforePressures.trace;
  advanceMobileActors(state, ctx);
  syncRouteMobilePresence(state);
  if (scale === "macro") {
    processMobileEncounters(state, ctx);
  }
  if (scale === "macro") {
    processTensionLifecycle(state, ctx);
  }
  syncRouteMobilePresence(state);
  const afterPressures = recomputePressuresDetailed(state);
  state.pressures = afterPressures.pressures;
  ctx.trace.pressureSnapshots.after = afterPressures.trace;
  ctx.trace.phaseTransitions = extractPhaseTransitionsFromDeltas(ctx.generatedDeltas);
  return diffuse(ctx);
}

function mergeTickOutputs(outputs: TickOutput[]): TickOutput {
  const latest = outputs[outputs.length - 1];
  if (!latest) {
    throw new Error("runWorldHours requires at least one hourly step.");
  }
  const events = outputs.flatMap(output => output.events);
  const deltas = outputs.flatMap(output => output.deltas);
  const signals = outputs.flatMap(output => output.signals);
  const rumors = outputs.flatMap(output => output.rumors);
  const opportunities = outputs.flatMap(output => output.opportunities);
  const trace = latest.trace
    ? {
        ...latest.trace,
        clockBefore: outputs[0]?.trace?.clockBefore ?? latest.trace.clockBefore,
        clockAfter: latest.trace.clockAfter,
        logisticsPlans: outputs.flatMap(output => output.trace?.logisticsPlans ?? []),
        objectiveReadiness: outputs.flatMap(output => output.trace?.objectiveReadiness ?? []),
        actorCandidates: outputs.flatMap(output => output.trace?.actorCandidates ?? []),
        actionCandidates: outputs.flatMap(output => output.trace?.actionCandidates ?? []),
        selectedActions: outputs.flatMap(output => output.trace?.selectedActions ?? []),
        mobility: outputs.flatMap(output => output.trace?.mobility ?? []),
        phaseTransitions: outputs.flatMap(output => output.trace?.phaseTransitions ?? [])
      }
    : undefined;

  return {
    tick: latest.tick,
    scale: latest.scale,
    events,
    deltas,
    signals,
    rumors,
    opportunities,
    trace
  };
}

export function runWorldHours(state: WorldState, hours: number): TickOutput {
  const stepCount = Math.max(1, Math.floor(hours));
  const outputs: TickOutput[] = [];

  for (let index = 0; index < stepCount; index += 1) {
    const nextMicro = state.clock.microTick + 1;
    const isMacroBoundary = nextMicro >= state.clock.microPerMacro;
    outputs.push(runWorldStep(state, isMacroBoundary ? "macro" : "micro"));
  }

  return mergeTickOutputs(outputs);
}

export function runWorldTick(state: WorldState, scale: TickScale): TickOutput {
  return runWorldHours(state, scale === "macro" ? Math.max(1, state.clock.microPerMacro) : 1);
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
    registerTension(state, candidate.payload);
  }
  return validation;
}
