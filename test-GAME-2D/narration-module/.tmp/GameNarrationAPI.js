"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameNarrationAPI = void 0;
const NarrativeRuntimeService_1 = require("./NarrativeRuntimeService");
const NarrativeOrchestrator_1 = require("./NarrativeOrchestrator");
const TransitionRepository_1 = require("./TransitionRepository");
function normalize(value) {
    return value.trim().toLowerCase();
}
function ensureDefaultState(state, bucket, entityId, defaultState) {
    if (!state[bucket][entityId]) {
        state[bucket][entityId] = defaultState;
    }
    return state;
}
function defaultStateForEntityType(entityType) {
    switch (entityType) {
        case 'quest':
            return 'Détectée';
        case 'trama':
            return 'Active';
        case 'companion':
            return 'Négociation';
        case 'trade':
            return 'Négociation de prix';
        default:
            return 'Unknown';
    }
}
function bucketForEntityType(entityType) {
    switch (entityType) {
        case 'quest':
            return 'quests';
        case 'trama':
            return 'tramas';
        case 'companion':
            return 'companions';
        case 'trade':
            return 'trades';
        default:
            return 'quests';
    }
}
class GameNarrationAPI {
    constructor(service) {
        this.service = service;
    }
    static createDefault(stateFilePath) {
        return new GameNarrationAPI(NarrativeRuntimeService_1.NarrativeRuntimeService.createDefault(stateFilePath));
    }
    getState() {
        return this.service.loadState();
    }
    acceptQuest(questId, trigger = 'Le joueur accepte explicitement') {
        const state = this.service.loadState();
        ensureDefaultState(state, 'quests', questId, 'Détectée');
        this.service.saveState(state);
        return this.service.applyTransitionAndSave({
            entityType: 'quest',
            entityId: questId,
            trigger,
            strictTrigger: true
        });
    }
    advanceTrama(tramaId, trigger) {
        const state = this.service.loadState();
        ensureDefaultState(state, 'tramas', tramaId, 'Active');
        this.service.saveState(state);
        return this.service.applyTransitionAndSave({
            entityType: 'trama',
            entityId: tramaId,
            trigger,
            strictTrigger: true
        });
    }
    recruitCompanion(companionId, trigger) {
        const state = this.service.loadState();
        ensureDefaultState(state, 'companions', companionId, 'Négociation');
        this.service.saveState(state);
        return this.service.applyTransitionAndSave({
            entityType: 'companion',
            entityId: companionId,
            trigger,
            strictTrigger: true
        });
    }
    haggleTrade(tradeId, trigger) {
        const state = this.service.loadState();
        ensureDefaultState(state, 'trades', tradeId, 'Négociation de prix');
        this.service.saveState(state);
        return this.service.applyTransitionAndSave({
            entityType: 'trade',
            entityId: tradeId,
            trigger,
            strictTrigger: true
        });
    }
    tickNarration(availableCommands, minHoursBetweenMajorEvents = 1, options) {
        const state = this.service.loadState();
        const transitions = TransitionRepository_1.TransitionRepository.loadTransitions();
        const orchestrator = new NarrativeOrchestrator_1.NarrativeOrchestrator(minHoursBetweenMajorEvents);
        const decision = orchestrator.decideNext({ state, availableCommands });
        if (!decision.selectedCommand) {
            return {
                decisionReason: decision.reason,
                decisionScore: decision.priorityScore,
                selectedCommand: null,
                appliedOutcome: null,
                state
            };
        }
        const selected = decision.selectedCommand;
        const applicability = this.checkCommandApplicability(state, selected, transitions);
        if (!applicability.applicable) {
            return {
                decisionReason: `${decision.reason} (commande non applicable: ${applicability.code})`,
                decisionScore: decision.priorityScore,
                selectedCommand: selected,
                appliedOutcome: null,
                state,
                guardBlocked: false,
                guardViolations: [],
                filteredCommands: [
                    {
                        command: selected,
                        code: applicability.code,
                        reason: applicability.reason
                    }
                ]
            };
        }
        const bucket = bucketForEntityType(selected.entityType);
        ensureDefaultState(state, bucket, selected.entityId, defaultStateForEntityType(selected.entityType));
        this.service.saveState(state);
        const guarded = this.service.applyTransitionAndSaveWithGuards({
            entityType: selected.entityType,
            entityId: selected.entityId,
            trigger: selected.trigger,
            strictTrigger: selected.strictTrigger ?? true
        }, { blockOnFailure: options?.blockOnGuardFailure ?? true });
        if (!guarded.applied || !guarded.outcome) {
            return {
                decisionReason: `${decision.reason} (bloqué par guards)`,
                decisionScore: decision.priorityScore,
                selectedCommand: selected,
                appliedOutcome: null,
                state,
                guardBlocked: true,
                guardViolations: guarded.checks.violations
            };
        }
        const appliedOutcome = guarded.outcome;
        return {
            decisionReason: decision.reason,
            decisionScore: decision.priorityScore,
            selectedCommand: selected,
            appliedOutcome,
            state: appliedOutcome.state,
            guardBlocked: false,
            guardViolations: guarded.checks.violations
        };
    }
    tickNarrationSafe(availableCommands, minHoursBetweenMajorEvents = 1, options) {
        const state = this.service.loadState();
        const transitions = TransitionRepository_1.TransitionRepository.loadTransitions();
        const acceptedCommands = [];
        const rejectedCommands = [];
        for (const command of availableCommands) {
            const check = this.checkCommandApplicability(state, command, transitions);
            if (check.applicable) {
                acceptedCommands.push(command);
            }
            else {
                rejectedCommands.push({
                    command,
                    code: check.code,
                    reason: check.reason
                });
            }
        }
        if (!acceptedCommands.length) {
            return {
                decisionReason: 'Aucune commande applicable (déjà consommées, état incompatible ou transition introuvable)',
                selectedCommand: null,
                appliedOutcome: null,
                state,
                filteredCommands: rejectedCommands
            };
        }
        const outcome = this.tickNarration(acceptedCommands, minHoursBetweenMajorEvents, options);
        return {
            ...outcome,
            filteredCommands: rejectedCommands
        };
    }
    checkCommandApplicability(state, command, transitions) {
        const transition = transitions.find((item) => item.entityType === command.entityType &&
            normalize(item.trigger) === normalize(command.trigger));
        if (!transition) {
            return {
                applicable: false,
                code: 'transition-not-found',
                reason: 'transition introuvable pour ce trigger'
            };
        }
        const bucket = bucketForEntityType(command.entityType);
        const currentState = state[bucket][command.entityId] ?? defaultStateForEntityType(command.entityType);
        if (normalize(currentState) === normalize(transition.toState)) {
            return {
                applicable: false,
                code: 'already-progressed',
                reason: `transition déjà consommée (state=${currentState})`
            };
        }
        if (normalize(currentState) !== normalize(transition.fromState)) {
            return {
                applicable: false,
                code: 'state-mismatch',
                reason: `état incompatible (current=${currentState}, attendu=${transition.fromState})`
            };
        }
        return {
            applicable: true,
            code: 'cooldown-blocked',
            reason: 'ok'
        };
    }
}
exports.GameNarrationAPI = GameNarrationAPI;
