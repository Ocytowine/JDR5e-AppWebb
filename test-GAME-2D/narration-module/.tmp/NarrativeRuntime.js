"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NarrativeRuntime = void 0;
function cloneBucket(bucket) {
    return { ...bucket };
}
function cloneState(state) {
    return {
        quests: cloneBucket(state.quests),
        tramas: cloneBucket(state.tramas),
        companions: cloneBucket(state.companions),
        trades: cloneBucket(state.trades),
        clock: { ...state.clock },
        history: [...state.history]
    };
}
function bucketForEntityType(state, entityType) {
    switch (entityType) {
        case 'quest':
            return state.quests;
        case 'trama':
            return state.tramas;
        case 'companion':
            return state.companions;
        case 'trade':
            return state.trades;
        default:
            throw new Error(`entityType non supporté: ${entityType}`);
    }
}
class NarrativeRuntime {
    constructor(transitionEngine) {
        this.transitionEngine = transitionEngine;
    }
    static createInitialState() {
        return {
            quests: {},
            tramas: {},
            companions: {},
            trades: {},
            clock: { hour: 0, day: 0, special: 0 },
            history: []
        };
    }
    applyTransition(state, command) {
        const nextState = cloneState(state);
        const bucket = bucketForEntityType(nextState, command.entityType);
        const currentState = bucket[command.entityId] ?? 'Unknown';
        const result = this.transitionEngine.apply({
            entityType: command.entityType,
            fromState: currentState,
            trigger: command.trigger,
            strictTrigger: command.strictTrigger
        });
        bucket[command.entityId] = result.toState;
        const timeUnit = result.timeBlock.unit;
        nextState.clock[timeUnit] += result.timeBlock.value;
        const historyEntry = {
            at: new Date().toISOString(),
            transitionId: result.transitionId,
            entityType: result.entityType,
            entityId: command.entityId,
            fromState: result.fromState,
            toState: result.toState,
            trigger: command.trigger,
            consequence: result.consequence,
            impactScope: result.impactScope,
            ruleRef: result.ruleRef
        };
        nextState.history.push(historyEntry);
        return {
            state: nextState,
            result,
            historyEntry
        };
    }
}
exports.NarrativeRuntime = NarrativeRuntime;
