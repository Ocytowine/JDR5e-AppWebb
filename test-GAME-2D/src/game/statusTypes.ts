export interface StatusDefinition {
  id: string;
  label: string;
  durationTurns: number;
  damagePerTurnFormula?: string;
  [key: string]: unknown;
}

export interface StatusInstance {
  id: string;
  remainingTurns: number;
}
