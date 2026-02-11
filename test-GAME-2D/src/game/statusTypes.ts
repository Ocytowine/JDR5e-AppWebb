export interface StatusDefinition {
  id: string;
  label: string;
  durationTurns: number;
  damagePerTurnFormula?: string;
  persistUntilDeath?: boolean;
  [key: string]: unknown;
}

export interface StatusInstance {
  id: string;
  remainingTurns: number;
  sourceId?: string;
  durationTick?: "start" | "end" | "round";
  concentrationSourceId?: string;
}
