import { readFileSync } from 'node:fs';
import { createRuntimeWorldMapLayout } from './map-module/data/worldMapLayout';
import { createWorldStateFromMapLayout, runWorldTick, evaluateObjectiveReadiness } from './map-module/world-simulation';
const raw = JSON.parse(readFileSync('./map-module/data/layouts/simulation_sandbox.json', 'utf8'));
const layout = createRuntimeWorldMapLayout(raw);
const state = createWorldStateFromMapLayout(layout);
const objectiveIds = Object.keys(state.specialObjectives).sort();
const snapshot = objectiveIds.map(id => {
    const objective = state.specialObjectives[id];
    const readiness = evaluateObjectiveReadiness(state, objective);
    return {
        id,
        category: objective.category,
        state: objective.state,
        progress: objective.progress,
        phases: objective.phases ?? [],
        currentPhaseIndex: objective.currentPhaseIndex,
        compatibleActionIds: objective.compatibleActionIds,
        executionTargetRef: readiness.executionTargetRef,
        matchedAnchorId: readiness.matchedAnchorId,
        reasons: readiness.reasons
    };
});
const tick = runWorldTick(state, 'micro');
const selected = tick.trace.selectedActions.map(action => ({
    actor: action.actorRef.id,
    objectiveId: action.objectiveId,
    actionId: action.actionId,
    success: action.success,
    score: Math.round(action.score)
}));
const after = objectiveIds.map(id => {
    const objective = state.specialObjectives[id];
    return {
        id,
        state: objective.state,
        progress: objective.progress,
        currentPhaseIndex: objective.currentPhaseIndex
    };
});
console.log(JSON.stringify({ snapshot, selected, after }, null, 2));
