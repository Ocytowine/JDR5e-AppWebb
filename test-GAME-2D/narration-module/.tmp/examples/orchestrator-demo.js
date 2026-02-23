"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NarrativeOrchestrator_1 = require("../NarrativeOrchestrator");
const GameNarrationAPI_1 = require("../GameNarrationAPI");
const api = GameNarrationAPI_1.GameNarrationAPI.createDefault();
const state = api.getState();
const availableCommands = [
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
const orchestrator = new NarrativeOrchestrator_1.NarrativeOrchestrator(1);
const decision = orchestrator.decideNext({ state, availableCommands });
console.log('[ORCHESTRATOR DEMO] reason ->', decision.reason);
console.log('[ORCHESTRATOR DEMO] priorityScore ->', decision.priorityScore ?? 'n/a');
console.log('[ORCHESTRATOR DEMO] selected ->', decision.selectedCommand);
