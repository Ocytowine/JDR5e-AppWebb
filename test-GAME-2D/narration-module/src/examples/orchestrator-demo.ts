import { NarrativeOrchestrator } from '../NarrativeOrchestrator';
import { GameNarrationAPI } from '../GameNarrationAPI';
import type { RuntimeTransitionCommand } from '../types';

const api = GameNarrationAPI.createDefault();
const state = api.getState();

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
  },
  {
    entityType: 'trama',
    entityId: 'trama.region.valombre',
    trigger: 'Temps écoulé sans intervention'
  }
];

const orchestrator = new NarrativeOrchestrator(1);
const decision = orchestrator.decideNext({ state, availableCommands });

console.log('[ORCHESTRATOR DEMO] reason ->', decision.reason);
console.log('[ORCHESTRATOR DEMO] priorityScore ->', decision.priorityScore ?? 'n/a');
console.log('[ORCHESTRATOR DEMO] selected ->', decision.selectedCommand);
