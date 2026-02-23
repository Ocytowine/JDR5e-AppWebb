"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransitionEngine = void 0;
const DEFAULT_IMPACT_SCOPE = 'local';
function normalize(value) {
    return value.trim().toLowerCase();
}
class TransitionEngine {
    constructor(transitions) {
        this.transitions = [...transitions];
    }
    apply(request) {
        const transition = this.findMatchingTransition(request);
        if (!transition) {
            throw new Error(`Aucune transition trouvée pour entityType=${request.entityType}, fromState=${request.fromState}, trigger=${request.trigger}`);
        }
        return {
            transitionId: transition.id,
            entityType: transition.entityType,
            fromState: transition.fromState,
            toState: transition.toState,
            consequence: transition.consequence,
            impactScope: transition.impactScope ?? DEFAULT_IMPACT_SCOPE,
            ruleRef: transition.ruleRef,
            timeBlock: transition.timeBlock,
            playerFacingReason: transition.playerFacingReason
        };
    }
    listByEntityType(entityType) {
        return this.transitions.filter((transition) => transition.entityType === entityType);
    }
    validateTransitionSet() {
        const errors = [];
        const ids = new Set();
        this.transitions.forEach((transition) => {
            if (ids.has(transition.id)) {
                errors.push(`id dupliqué: ${transition.id}`);
            }
            ids.add(transition.id);
            if (!transition.loreAnchors || transition.loreAnchors.length < 2) {
                errors.push(`transition ${transition.id}: loreAnchors doit contenir au moins 2 ancres`);
            }
            if (!transition.ruleRef || !transition.ruleRef.trim()) {
                errors.push(`transition ${transition.id}: ruleRef manquant`);
            }
        });
        return errors;
    }
    findMatchingTransition(request) {
        const entityType = request.entityType;
        const fromState = normalize(request.fromState);
        const trigger = normalize(request.trigger);
        const strictTrigger = request.strictTrigger ?? true;
        return this.transitions.find((transition) => {
            if (transition.entityType !== entityType)
                return false;
            if (normalize(transition.fromState) !== fromState)
                return false;
            const transitionTrigger = normalize(transition.trigger);
            if (strictTrigger)
                return transitionTrigger === trigger;
            return transitionTrigger.includes(trigger) || trigger.includes(transitionTrigger);
        });
    }
}
exports.TransitionEngine = TransitionEngine;
