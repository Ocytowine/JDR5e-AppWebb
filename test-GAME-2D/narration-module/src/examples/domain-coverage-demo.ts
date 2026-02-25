import { GameNarrationAPI } from '../GameNarrationAPI';
import { NarrativeRuntime } from '../NarrativeRuntime';
import { NarrativeRuntimeService } from '../NarrativeRuntimeService';
import { TransitionRepository } from '../TransitionRepository';

const tempStatePath = 'runtime/NarrativeGameState.domain-coverage-demo.json';
const runtime = new NarrativeRuntime(TransitionRepository.createEngine());
const service = new NarrativeRuntimeService(runtime, tempStatePath);
service.saveState(NarrativeRuntime.createInitialState());
const api = new GameNarrationAPI(service);

const logs: string[] = [];

function run(label: string, fn: () => unknown): void {
  try {
    const result = fn() as { result?: { transitionId?: string } };
    logs.push(`${label} -> ${result?.result?.transitionId ?? 'ok'}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`${label} -> ERROR: ${message}`);
  }
}

run('quest.accept', () => api.acceptQuest('quest.main.coverage-1'));
run('quest.complete', () => api.completeQuest('quest.main.coverage-1'));
run('quest.accept.fail-branch', () => api.acceptQuest('quest.main.coverage-2'));
run('quest.fail-branch', () => api.failQuestWithBranch('quest.main.coverage-2'));
run('quest.ignored-escalation', () => api.escalateIgnoredQuest('quest.main.coverage-3'));
run('quest.context-shift', () => api.applyQuestContextShift('quest.main.coverage-4'));

run('trama.activate', () => api.activateTrama('trama.main.coverage-1'));
run('trama.escalate', () => api.escalateTrama('trama.main.coverage-1'));
run('trama.non-intervention', () => api.worsenTramaWithoutIntervention('trama.main.coverage-1'));
run('trama.close.player-path', () => api.resolveTramaByPlayer('trama.main.coverage-1'));
run('trama.player-intervention.success', () =>
  api.advanceTrama('trama.main.coverage-2', 'Intervention joueur réussie')
);

run('companion.meet', () => api.meetCompanion('companion.main.coverage-1'));
run('companion.open-negotiation', () => api.openCompanionNegotiation('companion.main.coverage-1'));
run('companion.recruit', () =>
  api.recruitCompanion('companion.main.coverage-1', 'Accord social validé + coût d\'engagement accepté')
);
run('companion.leave-durable', () => api.makeCompanionLeaveDurably('companion.main.coverage-1'));
run('companion.meet.2', () => api.meetCompanion('companion.main.coverage-2'));
run('companion.open-negotiation.2', () => api.openCompanionNegotiation('companion.main.coverage-2'));
run('companion.refuse', () => api.refuseCompanion('companion.main.coverage-2'));

run('trade.open', () => api.openTradeNegotiation('trade.main.coverage-1'));
run('trade.haggle.success', () =>
  api.haggleTrade('trade.main.coverage-1', 'Argumentaire réussi dans les bornes système')
);
run('trade.close', () => api.closeTradeTransaction('trade.main.coverage-1'));
run('trade.open.2', () => api.openTradeNegotiation('trade.main.coverage-2'));
run('trade.fail', () => api.failTradeNegotiation('trade.main.coverage-2'));
run('trade.open.3', () => api.openTradeNegotiation('trade.main.coverage-3'));
run('trade.break', () => api.breakTradeNegotiation('trade.main.coverage-3'));

const state = api.getState();
console.log('[DOMAIN COVERAGE DEMO] log count ->', logs.length);
console.log('[DOMAIN COVERAGE DEMO] logs ->');
logs.forEach((entry) => console.log(' -', entry));
console.log('[DOMAIN COVERAGE DEMO] final quests ->', state.quests);
console.log('[DOMAIN COVERAGE DEMO] final tramas ->', state.tramas);
console.log('[DOMAIN COVERAGE DEMO] final companions ->', state.companions);
console.log('[DOMAIN COVERAGE DEMO] final trades ->', state.trades);
console.log('[DOMAIN COVERAGE DEMO] history size ->', state.history.length);
