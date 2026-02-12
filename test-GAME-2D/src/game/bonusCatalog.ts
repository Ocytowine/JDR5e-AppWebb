import type { BonusDefinition } from "./bonusTypes";
import bonusesIndex from "../data/bonuses/index.json";

const BONUS_MODULES: Record<string, BonusDefinition> = {};

export function loadBonusTypesFromIndex(): BonusDefinition[] {
  const indexed = Array.isArray((bonusesIndex as any).bonuses)
    ? ((bonusesIndex as any).bonuses as string[])
    : [];
  if (indexed.length === 0) return [];

  const loaded: BonusDefinition[] = [];
  for (const path of indexed) {
    const mod = BONUS_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[bonus-types] Bonus path missing in bundle:", path);
    }
  }

  if (loaded.length === 0 && indexed.length > 0) {
    console.warn("[bonus-types] No bonuses loaded from index.json");
  }

  return loaded;
}
