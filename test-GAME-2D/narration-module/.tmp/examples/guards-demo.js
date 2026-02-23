"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NarrativeRuntimeService_1 = require("../NarrativeRuntimeService");
const service = NarrativeRuntimeService_1.NarrativeRuntimeService.createDefault();
const state = service.loadState();
const questId = 'quest.main.guard-check';
if (!state.quests[questId]) {
    state.quests[questId] = 'Détectée';
    service.saveState(state);
}
const guarded = service.applyTransitionAndSaveWithGuards({
    entityType: 'quest',
    entityId: questId,
    trigger: 'Le joueur accepte explicitement',
    strictTrigger: true
}, { blockOnFailure: true });
console.log('[GUARDS DEMO] applied ->', guarded.applied);
console.log('[GUARDS DEMO] blockedByGuards ->', guarded.blockedByGuards);
console.log('[GUARDS DEMO] checks.ok ->', guarded.checks.ok);
console.log('[GUARDS DEMO] violations ->', guarded.checks.violations);
console.log('[GUARDS DEMO] transition ->', guarded.outcome?.result.transitionId ?? 'none');
