"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NarrativeRuntime_1 = require("../NarrativeRuntime");
const StateRepository_1 = require("../StateRepository");
const TransitionRepository_1 = require("../TransitionRepository");
const transitionEngine = TransitionRepository_1.TransitionRepository.createEngine();
const runtime = new NarrativeRuntime_1.NarrativeRuntime(transitionEngine);
const statePath = StateRepository_1.StateRepository.DEFAULT_STATE_PATH;
let state = StateRepository_1.StateRepository.load(statePath);
const entityId = 'quest.main.contract-roland';
if (!state.quests[entityId]) {
    state.quests[entityId] = 'Détectée';
}
console.log('[PERSIST DEMO] State file ->', statePath);
console.log('[PERSIST DEMO] Before state ->', state.quests[entityId]);
if (state.quests[entityId] === 'Détectée') {
    const outcome = runtime.applyTransition(state, {
        entityType: 'quest',
        entityId,
        trigger: 'Le joueur accepte explicitement'
    });
    state = outcome.state;
    console.log('[PERSIST DEMO] Applied transition ->', outcome.result.transitionId);
}
else {
    console.log('[PERSIST DEMO] Transition skipped (already progressed).');
}
StateRepository_1.StateRepository.save(state, statePath);
console.log('[PERSIST DEMO] After state ->', state.quests[entityId]);
console.log('[PERSIST DEMO] History size ->', state.history.length);
