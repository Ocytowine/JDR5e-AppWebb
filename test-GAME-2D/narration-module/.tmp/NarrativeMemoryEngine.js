"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NarrativeMemoryEngine = void 0;
const SHORT_TERM_MAX = 20;
const LONG_TERM_MAX = 80;
function impactWeight(scope) {
    switch (scope) {
        case 'global':
            return 6;
        case 'regional':
            return 4;
        case 'local':
            return 2;
        case 'none':
            return 0;
        default:
            return 0;
    }
}
function timeToHours(block) {
    switch (block.unit) {
        case 'hour':
            return block.value;
        case 'day':
            return block.value * 24;
        case 'special':
            return block.value * 6;
        default:
            return block.value;
    }
}
function isMajor(outcome) {
    const { entityType, toState, impactScope } = outcome.result;
    if (impactScope === 'regional' || impactScope === 'global')
        return true;
    if (entityType === 'quest' && (toState === 'Terminée' || toState === 'Acceptée'))
        return true;
    if (entityType === 'trama')
        return true;
    return false;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function decayEntry(entry, elapsedHours) {
    if (elapsedHours <= 0)
        return entry;
    const nextImportance = clamp(entry.importance - entry.decayPerHour * elapsedHours, 0, 20);
    return {
        ...entry,
        importance: nextImportance,
        ageHours: entry.ageHours + elapsedHours
    };
}
function makeEntry(outcome) {
    const major = isMajor(outcome);
    const baseImportance = clamp(2 + impactWeight(outcome.result.impactScope) + (major ? 4 : 0), 1, 20);
    const decayPerHour = major ? 0.02 : 0.18;
    const history = outcome.historyEntry;
    return {
        id: `${history.transitionId}:${history.entityId}:${history.at}`,
        at: history.at,
        transitionId: history.transitionId,
        entityType: history.entityType,
        entityId: history.entityId,
        fromState: history.fromState,
        toState: history.toState,
        consequence: history.consequence,
        impactScope: history.impactScope,
        ruleRef: history.ruleRef,
        importance: baseImportance,
        ageHours: 0,
        decayPerHour
    };
}
function toLongTerm(entry) {
    return {
        ...entry,
        importance: clamp(Math.max(entry.importance, 8), 1, 20),
        decayPerHour: 0.005
    };
}
class NarrativeMemoryEngine {
    apply(state, outcome) {
        const elapsedHours = timeToHours(outcome.result.timeBlock);
        const shortTerm = state.memory.shortTerm
            .map((entry) => decayEntry(entry, elapsedHours))
            .filter((entry) => entry.importance >= 0.5);
        const longTerm = state.memory.longTerm.map((entry) => decayEntry(entry, elapsedHours));
        const entry = makeEntry(outcome);
        shortTerm.push(entry);
        shortTerm.sort((a, b) => b.importance - a.importance || b.at.localeCompare(a.at));
        if (isMajor(outcome)) {
            const already = longTerm.find((item) => item.transitionId === entry.transitionId &&
                item.entityId === entry.entityId &&
                item.toState === entry.toState);
            if (!already) {
                longTerm.push(toLongTerm(entry));
            }
            longTerm.sort((a, b) => b.importance - a.importance || b.at.localeCompare(a.at));
        }
        return {
            ...state,
            memory: {
                shortTerm: shortTerm.slice(0, SHORT_TERM_MAX),
                longTerm: longTerm.slice(0, LONG_TERM_MAX)
            }
        };
    }
}
exports.NarrativeMemoryEngine = NarrativeMemoryEngine;
