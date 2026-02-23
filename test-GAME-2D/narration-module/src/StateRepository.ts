declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

import type { NarrativeGameState } from './types';
import { NarrativeRuntime } from './NarrativeRuntime';

function normalizeState(value: unknown): NarrativeGameState {
  const empty = NarrativeRuntime.createInitialState();

  if (!value || typeof value !== 'object') return empty;

  const partial = value as Partial<NarrativeGameState>;
  return {
    quests: partial.quests && typeof partial.quests === 'object' ? partial.quests : empty.quests,
    tramas: partial.tramas && typeof partial.tramas === 'object' ? partial.tramas : empty.tramas,
    companions:
      partial.companions && typeof partial.companions === 'object' ? partial.companions : empty.companions,
    trades: partial.trades && typeof partial.trades === 'object' ? partial.trades : empty.trades,
    clock:
      partial.clock && typeof partial.clock === 'object'
        ? {
            hour: Number((partial.clock as any).hour ?? 0),
            day: Number((partial.clock as any).day ?? 0),
            special: Number((partial.clock as any).special ?? 0)
          }
        : empty.clock,
    history: Array.isArray(partial.history) ? partial.history : empty.history
  };
}

export class StateRepository {
  public static readonly DEFAULT_STATE_PATH = path.resolve(
    __dirname,
    '..',
    'runtime',
    'NarrativeGameState.v1.json'
  );

  public static load(filePath = StateRepository.DEFAULT_STATE_PATH): NarrativeGameState {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return NarrativeRuntime.createInitialState();
    }

    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  }

  public static save(state: NarrativeGameState, filePath = StateRepository.DEFAULT_STATE_PATH): void {
    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, JSON.stringify(state, null, 2), 'utf-8');
  }
}
