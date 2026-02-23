"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateRepository = void 0;
const fs = require('fs');
const path = require('path');
const NarrativeRuntime_1 = require("./NarrativeRuntime");
function normalizeState(value) {
    const empty = NarrativeRuntime_1.NarrativeRuntime.createInitialState();
    if (!value || typeof value !== 'object')
        return empty;
    const partial = value;
    return {
        quests: partial.quests && typeof partial.quests === 'object' ? partial.quests : empty.quests,
        tramas: partial.tramas && typeof partial.tramas === 'object' ? partial.tramas : empty.tramas,
        companions: partial.companions && typeof partial.companions === 'object' ? partial.companions : empty.companions,
        trades: partial.trades && typeof partial.trades === 'object' ? partial.trades : empty.trades,
        clock: partial.clock && typeof partial.clock === 'object'
            ? {
                hour: Number(partial.clock.hour ?? 0),
                day: Number(partial.clock.day ?? 0),
                special: Number(partial.clock.special ?? 0)
            }
            : empty.clock,
        history: Array.isArray(partial.history) ? partial.history : empty.history
    };
}
class StateRepository {
    static load(filePath = StateRepository.DEFAULT_STATE_PATH) {
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
            return NarrativeRuntime_1.NarrativeRuntime.createInitialState();
        }
        const raw = fs.readFileSync(resolvedPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return normalizeState(parsed);
    }
    static save(state, filePath = StateRepository.DEFAULT_STATE_PATH) {
        const resolvedPath = path.resolve(filePath);
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolvedPath, JSON.stringify(state, null, 2), 'utf-8');
    }
}
exports.StateRepository = StateRepository;
StateRepository.DEFAULT_STATE_PATH = path.resolve(__dirname, '..', 'runtime', 'NarrativeGameState.v1.json');
