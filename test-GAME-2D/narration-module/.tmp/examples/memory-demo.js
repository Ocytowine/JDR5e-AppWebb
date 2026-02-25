"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NarrativeRuntime_1 = require("../NarrativeRuntime");
const NarrativeRuntimeService_1 = require("../NarrativeRuntimeService");
const TransitionRepository_1 = require("../TransitionRepository");
const tempStatePath = 'runtime/NarrativeGameState.memory-demo.json';
const runtime = new NarrativeRuntime_1.NarrativeRuntime(TransitionRepository_1.TransitionRepository.createEngine());
const service = new NarrativeRuntimeService_1.NarrativeRuntimeService(runtime, tempStatePath);
const initial = NarrativeRuntime_1.NarrativeRuntime.createInitialState();
initial.quests['quest.main.memory'] = 'Détectée';
initial.tramas['trama.region.valombre'] = 'Active';
initial.trades['trade.port.nyra.memory'] = 'Négociation de prix';
service.saveState(initial);
const questId = 'quest.main.memory';
const tramaId = 'trama.region.valombre';
const tradeId = 'trade.port.nyra.memory';
service.applyTransitionAndSave({
    entityType: 'quest',
    entityId: questId,
    trigger: 'Le joueur accepte explicitement',
    strictTrigger: true
});
service.applyTransitionAndSave({
    entityType: 'trade',
    entityId: tradeId,
    trigger: 'Argumentaire réussi dans les bornes système',
    strictTrigger: true
});
service.applyTransitionAndSave({
    entityType: 'trama',
    entityId: tramaId,
    trigger: 'Temps écoulé sans intervention',
    strictTrigger: true
});
service.applyTransitionAndSave({
    entityType: 'trama',
    entityId: tramaId,
    trigger: 'Non-intervention prolongée',
    strictTrigger: true
});
const state = service.loadState();
console.log('[MEMORY DEMO] history ->', state.history.length);
console.log('[MEMORY DEMO] shortTerm ->', state.memory.shortTerm.length);
console.log('[MEMORY DEMO] longTerm ->', state.memory.longTerm.length);
console.log('[MEMORY DEMO] shortTop ->', state.memory.shortTerm.slice(0, 3).map((entry) => ({
    transitionId: entry.transitionId,
    importance: Number(entry.importance.toFixed(2)),
    ageHours: entry.ageHours
})));
console.log('[MEMORY DEMO] longTop ->', state.memory.longTerm.slice(0, 3).map((entry) => ({
    transitionId: entry.transitionId,
    importance: Number(entry.importance.toFixed(2)),
    ageHours: entry.ageHours
})));
