import { NarrativeRuntime } from '../NarrativeRuntime';
import { NarrativeRuntimeService } from '../NarrativeRuntimeService';
import { GameNarrationAPI } from '../GameNarrationAPI';
import { TransitionEngine } from '../TransitionEngine';
import type { NarrativeTransition, RuntimeTransitionCommand } from '../types';

const tempStatePath = 'runtime/NarrativeGameState.tick-safe-guard-block.json';
const questId = 'quest.main.tick-guard-block';

const invalidQuestTransition: NarrativeTransition = {
  id: 'quest.detectee.to.acceptee.no-reason.tick',
  entityType: 'quest',
  fromState: 'Détectée',
  trigger: 'Le joueur accepte explicitement',
  toState: 'Acceptée',
  consequence: 'Ajout au journal et suivi activable',
  impactScope: 'local',
  ruleRef: 'local.narration.quest.accept',
  loreAnchors: [
    { type: 'lieu', id: 'ville.capitale.marche', label: 'Marché de la place' },
    { type: 'acteur', id: 'pnj.roland', label: 'Roland' }
  ],
  timeBlock: { unit: 'hour', value: 0 }
};

const engine = new TransitionEngine([invalidQuestTransition]);
const runtime = new NarrativeRuntime(engine);
const service = new NarrativeRuntimeService(runtime, tempStatePath);
const api = new GameNarrationAPI(service);

const initial = service.loadState();
initial.quests[questId] = 'Détectée';
service.saveState(initial);

const commands: RuntimeTransitionCommand[] = [
  {
    entityType: 'quest',
    entityId: questId,
    trigger: 'Le joueur accepte explicitement',
    strictTrigger: true
  }
];

const tick = api.tickNarrationSafe(commands, 1, { blockOnGuardFailure: true });

console.log('[TICK SAFE GUARD BLOCK DEMO] decisionReason ->', tick.decisionReason);
console.log('[TICK SAFE GUARD BLOCK DEMO] selected ->', tick.selectedCommand);
console.log('[TICK SAFE GUARD BLOCK DEMO] applied ->', tick.appliedOutcome?.result.transitionId ?? 'none');
console.log('[TICK SAFE GUARD BLOCK DEMO] guardBlocked ->', tick.guardBlocked ?? false);
console.log('[TICK SAFE GUARD BLOCK DEMO] guardViolations ->', tick.guardViolations ?? []);
console.log('[TICK SAFE GUARD BLOCK DEMO] filtered ->', tick.filteredCommands ?? []);
