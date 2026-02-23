"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NarrativeRuntime_1 = require("../NarrativeRuntime");
const NarrativeRuntimeService_1 = require("../NarrativeRuntimeService");
const GameNarrationAPI_1 = require("../GameNarrationAPI");
const TransitionEngine_1 = require("../TransitionEngine");
const tempStatePath = 'runtime/NarrativeGameState.tick-safe-guard-block.json';
const questId = 'quest.main.tick-guard-block';
const invalidQuestTransition = {
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
const engine = new TransitionEngine_1.TransitionEngine([invalidQuestTransition]);
const runtime = new NarrativeRuntime_1.NarrativeRuntime(engine);
const service = new NarrativeRuntimeService_1.NarrativeRuntimeService(runtime, tempStatePath);
const api = new GameNarrationAPI_1.GameNarrationAPI(service);
const initial = service.loadState();
initial.quests[questId] = 'Détectée';
service.saveState(initial);
const commands = [
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
