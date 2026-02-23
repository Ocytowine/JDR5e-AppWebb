"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NarrativeRuntime_1 = require("../NarrativeRuntime");
const NarrativeRuntimeService_1 = require("../NarrativeRuntimeService");
const TransitionEngine_1 = require("../TransitionEngine");
const tempStatePath = 'runtime/NarrativeGameState.guards-block-demo.json';
const questId = 'quest.main.guard-block-case';
const invalidQuestTransition = {
    id: 'quest.detectee.to.acceptee.no-reason',
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
const initial = service.loadState();
initial.quests[questId] = 'Détectée';
service.saveState(initial);
const strictResult = service.applyTransitionAndSaveWithGuards({
    entityType: 'quest',
    entityId: questId,
    trigger: 'Le joueur accepte explicitement',
    strictTrigger: true
}, { blockOnFailure: true });
console.log('[GUARDS BLOCK DEMO][STRICT] applied ->', strictResult.applied);
console.log('[GUARDS BLOCK DEMO][STRICT] blockedByGuards ->', strictResult.blockedByGuards);
console.log('[GUARDS BLOCK DEMO][STRICT] violations ->', strictResult.checks.violations);
const nonStrictResult = service.applyTransitionAndSaveWithGuards({
    entityType: 'quest',
    entityId: questId,
    trigger: 'Le joueur accepte explicitement',
    strictTrigger: true
}, { blockOnFailure: false });
console.log('[GUARDS BLOCK DEMO][NON-STRICT] applied ->', nonStrictResult.applied);
console.log('[GUARDS BLOCK DEMO][NON-STRICT] blockedByGuards ->', nonStrictResult.blockedByGuards);
console.log('[GUARDS BLOCK DEMO][NON-STRICT] violations ->', nonStrictResult.checks.violations);
console.log('[GUARDS BLOCK DEMO][NON-STRICT] transition ->', nonStrictResult.outcome?.result.transitionId ?? 'none');
