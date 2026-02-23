"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameNarrationAPI_1 = require("../GameNarrationAPI");
const api = GameNarrationAPI_1.GameNarrationAPI.createDefault();
const availableCommands = [
    {
        entityType: 'quest',
        entityId: 'quest.main.contract-roland',
        trigger: 'Le joueur accepte explicitement'
    },
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
const tick = api.tickNarrationSafe(availableCommands, 1);
console.log('[TICK SAFE DEMO] reason ->', tick.decisionReason);
console.log('[TICK SAFE DEMO] score ->', tick.decisionScore ?? 'n/a');
console.log('[TICK SAFE DEMO] selected ->', tick.selectedCommand);
console.log('[TICK SAFE DEMO] applied ->', tick.appliedOutcome?.result.transitionId ?? 'none');
console.log('[TICK SAFE DEMO] guardBlocked ->', tick.guardBlocked ?? false);
console.log('[TICK SAFE DEMO] guardViolations ->', tick.guardViolations ?? []);
console.log('[TICK SAFE DEMO] filtered ->', (tick.filteredCommands ?? []).map((item) => ({
    code: item.code,
    reason: item.reason,
    command: item.command
})));
console.log('[TICK SAFE DEMO] history size ->', tick.state.history.length);
