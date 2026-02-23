import { GameNarrationAPI } from '../GameNarrationAPI';
import type { RuntimeTransitionCommand } from '../types';

const api = GameNarrationAPI.createDefault();

const availableCommands: RuntimeTransitionCommand[] = [
  {
    entityType: 'trade',
    entityId: 'trade.port.nyra',
    trigger: 'Argumentaire réussi dans les bornes système'
  },
  {
    entityType: 'companion',
    entityId: 'compagnon.elya',
    trigger: "Accord social validé + coût d'engagement accepté"
  }
];

const tick = api.tickNarration(availableCommands, 1);

console.log('[TICK DEMO] reason ->', tick.decisionReason);
console.log('[TICK DEMO] score ->', tick.decisionScore ?? 'n/a');
console.log('[TICK DEMO] selected ->', tick.selectedCommand);
console.log('[TICK DEMO] applied ->', tick.appliedOutcome?.result.transitionId ?? 'none');
console.log('[TICK DEMO] guardBlocked ->', tick.guardBlocked ?? false);
console.log('[TICK DEMO] guardViolations ->', tick.guardViolations ?? []);
console.log('[TICK DEMO] history size ->', tick.state.history.length);
