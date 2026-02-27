export type NarrativeEntityType = "quest" | "trama" | "companion" | "trade";
export type ImpactScope = "local" | "regional" | "global" | "none";

export interface NarrativeHistoryEntry {
  at: string;
  transitionId: string;
  entityType: NarrativeEntityType;
  entityId: string;
  fromState: string;
  toState: string;
  trigger: string;
  consequence: string;
  impactScope: ImpactScope;
  ruleRef: string;
}

export interface NarrativeRuntimeState {
  quests: Record<string, string>;
  tramas: Record<string, string>;
  companions: Record<string, string>;
  trades: Record<string, string>;
  clock: { hour: number; day: number; special: number };
  history: NarrativeHistoryEntry[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRuntimeState(value: unknown): NarrativeRuntimeState | null {
  if (!isObject(value)) return null;
  const quests = isObject(value.quests) ? (value.quests as Record<string, string>) : {};
  const tramas = isObject(value.tramas) ? (value.tramas as Record<string, string>) : {};
  const companions = isObject(value.companions) ? (value.companions as Record<string, string>) : {};
  const trades = isObject(value.trades) ? (value.trades as Record<string, string>) : {};
  const clock = isObject(value.clock)
    ? {
        hour: Number((value.clock as Record<string, unknown>).hour ?? 0),
        day: Number((value.clock as Record<string, unknown>).day ?? 0),
        special: Number((value.clock as Record<string, unknown>).special ?? 0)
      }
    : { hour: 0, day: 0, special: 0 };
  const history = Array.isArray(value.history) ? (value.history as NarrativeHistoryEntry[]) : [];

  return { quests, tramas, companions, trades, clock, history };
}

export async function loadNarrativeRuntimeState(): Promise<NarrativeRuntimeState | null> {
  const candidates = ["/api/narration-runtime-state"];

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const raw = (await response.json()) as unknown;
      const normalized = normalizeRuntimeState(raw);
      if (normalized) return normalized;
    } catch {
      // Ignore source failure and continue fallbacks.
    }
  }

  return null;
}
