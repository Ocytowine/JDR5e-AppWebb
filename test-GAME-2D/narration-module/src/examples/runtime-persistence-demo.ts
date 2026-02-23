import { NarrativeRuntime } from '../NarrativeRuntime';
import { StateRepository } from '../StateRepository';
import { TransitionRepository } from '../TransitionRepository';

const transitionEngine = TransitionRepository.createEngine();
const runtime = new NarrativeRuntime(transitionEngine);

const statePath = StateRepository.DEFAULT_STATE_PATH;
let state = StateRepository.load(statePath);

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
} else {
  console.log('[PERSIST DEMO] Transition skipped (already progressed).');
}

StateRepository.save(state, statePath);

console.log('[PERSIST DEMO] After state ->', state.quests[entityId]);
console.log('[PERSIST DEMO] History size ->', state.history.length);
