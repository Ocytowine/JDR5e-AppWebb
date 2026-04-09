import type {
  EntityRef,
  ObjectiveReadinessTrace,
  ObjectivePhaseHistoryEntry,
  ObjectivePhaseRuntime,
  SpecialObjective,
  WorldFaction,
  WorldState
} from "./types";

function resolveExecutionTarget(state: WorldState, target?: EntityRef): EntityRef | undefined {
  if (!target) return undefined;
  if (target.kind === "district") {
    const district = state.districts[target.id];
    return district ? { kind: "city", id: district.cityId } : undefined;
  }
  if (target.kind === "route") {
    const route = state.routes[target.id];
    if (!route) return undefined;
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

function getActivePhase(objective: SpecialObjective): ObjectivePhaseRuntime | undefined {
  if (!objective.phases.length) return undefined;
  if (objective.currentPhaseIndex < 0 || objective.currentPhaseIndex >= objective.phases.length) return undefined;
  return objective.phases[objective.currentPhaseIndex];
}

function findMatchingAnchor(
  faction: WorldFaction | undefined,
  objective: SpecialObjective,
  phase: ObjectivePhaseRuntime | undefined
) {
  const anchors = faction?.localAnchors ?? [];
  const requiredAnchorId = phase?.requiredAnchorId ?? objective.requiredAnchorId;
  const requiredAnchorType = phase?.requiredAnchorType ?? objective.requiredAnchorType;
  const byId = requiredAnchorId
    ? anchors.find(anchor => anchor.id === requiredAnchorId)
    : undefined;
  if (byId) return byId;
  return requiredAnchorType
    ? anchors.find(anchor => anchor.type === requiredAnchorType)
    : undefined;
}

function evaluatePresenceRequirement(state: WorldState, requiredPresenceRef: EntityRef | undefined): boolean {
  if (!requiredPresenceRef) return true;
  if (requiredPresenceRef.kind === "city") return Boolean(state.cities[requiredPresenceRef.id]);
  if (requiredPresenceRef.kind === "district") return Boolean(state.districts[requiredPresenceRef.id]);
  if (requiredPresenceRef.kind === "route") return Boolean(state.routes[requiredPresenceRef.id]);
  if (requiredPresenceRef.kind === "region") return Boolean(state.regions[requiredPresenceRef.id]);
  return false;
}

function hasFatalFailureCondition(conditions: string[] | undefined, reasons: string[]): boolean {
  if (!conditions || conditions.length === 0) return false;
  return conditions.some(condition => {
    const normalized = condition.trim().toLowerCase();
    return reasons.some(reason => reason === normalized);
  });
}

function closePhaseHistoryEntry(
  objective: SpecialObjective,
  phaseId: string | undefined,
  tick: number,
  outcome: ObjectivePhaseHistoryEntry["outcome"],
  reasons: string[]
) {
  if (!phaseId || !outcome) return;
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

export function evaluateObjectiveReadiness(state: WorldState, objective: SpecialObjective): ObjectiveReadinessTrace {
  const faction = objective.owner.kind === "faction" ? state.factions[objective.owner.id] : undefined;
  const activePhase = getActivePhase(objective);
  const localTargetRef = activePhase?.localTarget;
  const executionTargetRef = resolveExecutionTarget(state, localTargetRef ?? objective.target);
  const matchingAnchor = findMatchingAnchor(faction, objective, activePhase);
  const reasons: string[] = [];
  const requiredAnchorId = activePhase?.requiredAnchorId ?? objective.requiredAnchorId;
  const requiredAnchorType = activePhase?.requiredAnchorType ?? objective.requiredAnchorType;

  if (objective.phases.length > 0 && !activePhase) {
    reasons.push("missing_active_phase");
  }
  if (requiredAnchorId && !matchingAnchor) {
    reasons.push("missing_required_anchor");
  }
  if (requiredAnchorType && !matchingAnchor) {
    reasons.push("missing_required_anchor_type");
  }
  if ((localTargetRef ?? objective.target) && !executionTargetRef) {
    reasons.push(localTargetRef ? "missing_phase_execution_target" : "missing_execution_target");
  }
  if (activePhase?.requiredPresenceRef && !evaluatePresenceRequirement(state, activePhase.requiredPresenceRef)) {
    reasons.push("missing_required_presence");
  }
  if (
    activePhase?.state === "blocked" &&
    activePhase.failureMode === "score_threshold" &&
    activePhase.failureScore >= activePhase.maxFailureScore
  ) {
    reasons.push("phase_failure_threshold_blocked");
  }
  if (activePhase?.state === "failed" || activePhase?.state === "completed") {
    reasons.push(`phase_${activePhase.state}`);
  }
  if (objective.state === "failed" || objective.state === "completed") {
    reasons.push(`objective_${objective.state}`);
  }

  const ready = reasons.length === 0;
  return {
    objectiveId: objective.id,
    factionId: faction?.id,
    phaseId: activePhase?.id,
    phaseLabel: activePhase?.label,
    ready,
    objectiveStateBefore: objective.state,
    objectiveStateAfter: objective.state,
    phaseStateBefore: activePhase?.state,
    phaseStateAfter: activePhase?.state,
    requiredAnchorId,
    requiredAnchorType,
    matchedAnchorId: matchingAnchor?.id,
    matchedAnchorType: matchingAnchor?.type,
    localTargetRef,
    executionTargetRef,
    reasons
  };
}

export function synchronizeObjectiveReadiness(state: WorldState): ObjectiveReadinessTrace[] {
  return Object.values(state.specialObjectives).map(objective => {
    const activePhase = getActivePhase(objective);
    const trace = evaluateObjectiveReadiness(state, objective);
    if (objective.state === "completed" || objective.state === "failed") {
      return trace;
    }
    if (!trace.ready) {
      const fatalFailure =
        hasFatalFailureCondition(activePhase?.fatalFailureConditions, trace.reasons) ||
        hasFatalFailureCondition(objective.fatalFailureConditions, trace.reasons);
      if (fatalFailure) {
        if (activePhase) {
          closePhaseHistoryEntry(objective, activePhase.id, state.clock.tick, "failed", trace.reasons);
          activePhase.state = "failed";
          trace.phaseStateAfter = activePhase.state;
        }
        objective.state = "failed";
        trace.objectiveStateAfter = objective.state;
        return trace;
      }
      if (activePhase) {
        closePhaseHistoryEntry(objective, activePhase.id, state.clock.tick, "blocked", trace.reasons);
        activePhase.state = "blocked";
        trace.phaseStateAfter = activePhase.state;
      }
      objective.state = "blocked";
      trace.objectiveStateAfter = objective.state;
      return trace;
    }
    if (activePhase && activePhase.state === "blocked") {
      activePhase.state = "active";
    }
    if (objective.state === "blocked") {
      objective.state = objective.progress > 0 ? "active" : "planned";
    }
    trace.phaseStateAfter = activePhase?.state;
    trace.objectiveStateAfter = objective.state;
    return trace;
  });
}
