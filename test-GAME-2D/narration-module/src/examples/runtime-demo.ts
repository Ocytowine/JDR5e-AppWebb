import { NarrativeRuntime } from '../NarrativeRuntime';
import { TransitionRepository } from '../TransitionRepository';

const transitionEngine = TransitionRepository.createEngine();
const runtime = new NarrativeRuntime(transitionEngine);

let state = NarrativeRuntime.createInitialState();
state.quests['quest.main.contract-roland'] = 'Détectée';

const outcome = runtime.applyTransition(state, {
  entityType: 'quest',
  entityId: 'quest.main.contract-roland',
  trigger: 'Le joueur accepte explicitement'
});

state = outcome.state;

console.log('[RUNTIME DEMO] Result ->', outcome.result);
console.log('[RUNTIME DEMO] Quest state ->', state.quests['quest.main.contract-roland']);
console.log('[RUNTIME DEMO] Clock ->', state.clock);
console.log('[RUNTIME DEMO] History size ->', state.history.length);
