"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NarrativeRuntimeService = void 0;
const NarrativeRuntime_1 = require("./NarrativeRuntime");
const StateRepository_1 = require("./StateRepository");
const TransitionRepository_1 = require("./TransitionRepository");
const CoherenceGates_1 = require("./CoherenceGates");
class NarrativeRuntimeService {
    constructor(runtime, stateFilePath) {
        this.runtime = runtime;
        this.gates = new CoherenceGates_1.CoherenceGates();
        this.stateFilePath = stateFilePath;
    }
    static createDefault(stateFilePath) {
        const transitionEngine = TransitionRepository_1.TransitionRepository.createEngine();
        const runtime = new NarrativeRuntime_1.NarrativeRuntime(transitionEngine);
        return new NarrativeRuntimeService(runtime, stateFilePath);
    }
    loadState() {
        return StateRepository_1.StateRepository.load(this.stateFilePath);
    }
    saveState(state) {
        StateRepository_1.StateRepository.save(state, this.stateFilePath);
    }
    applyTransitionAndSave(command) {
        const state = this.loadState();
        const outcome = this.runtime.applyTransition(state, command);
        this.saveState(outcome.state);
        return outcome;
    }
    applyTransitionAndSaveWithGuards(command, options) {
        const blockOnFailure = options?.blockOnFailure ?? true;
        const state = this.loadState();
        const outcome = this.runtime.applyTransition(state, command);
        const checks = this.gates.evaluate(outcome);
        if (!checks.ok && blockOnFailure) {
            return {
                applied: false,
                blockedByGuards: true,
                checks,
                outcome: null
            };
        }
        this.saveState(outcome.state);
        return {
            applied: true,
            blockedByGuards: false,
            checks,
            outcome
        };
    }
}
exports.NarrativeRuntimeService = NarrativeRuntimeService;
