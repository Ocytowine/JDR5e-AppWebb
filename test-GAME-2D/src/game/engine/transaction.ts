import type { EngineState } from "./types";

export interface Transaction {
  state: EngineState;
  logs: string[];
}

export function beginTransaction(state: EngineState): Transaction {
  return {
    state: {
      ...state,
      actor: { ...state.actor },
      player: { ...state.player },
      enemies: state.enemies.map(enemy => ({ ...enemy })),
      effects: state.effects.map(effect => ({ ...effect }))
    },
    logs: []
  };
}

export function logTransaction(
  tx: Transaction,
  message: string,
  onLog?: (m: string) => void
) {
  tx.logs.push(message);
  onLog?.(message);
}
