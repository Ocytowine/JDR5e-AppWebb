"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameNarrationAPI_1 = require("../GameNarrationAPI");
const api = GameNarrationAPI_1.GameNarrationAPI.createDefault();
const questId = 'quest.main.contract-roland';
const current = api.getState();
const currentQuestState = current.quests[questId] ?? 'Détectée';
if (currentQuestState === 'Détectée' || !current.quests[questId]) {
    const outcome = api.acceptQuest(questId);
    console.log('[API DEMO] transition ->', outcome.result.transitionId);
    console.log('[API DEMO] quest state ->', outcome.state.quests[questId]);
    console.log('[API DEMO] history size ->', outcome.state.history.length);
}
else {
    console.log('[API DEMO] skip acceptQuest, état actuel ->', currentQuestState);
    console.log('[API DEMO] history size ->', current.history.length);
}
