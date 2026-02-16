import type { TokenState } from "../../types";

interface FormulaContext {
  actor: TokenState;
  sampleCharacter?: {
    niveauGlobal?: number;
    caracs?: {
      force?: { FOR?: number; modFOR?: number };
      dexterite?: { DEX?: number; modDEX?: number };
      constitution?: { CON?: number; modCON?: number };
      intelligence?: { INT?: number; modINT?: number };
      sagesse?: { SAG?: number; modSAG?: number };
      charisme?: { CHA?: number; modCHA?: number };
    };
  };
}

function getLevelFromContext(ctx: FormulaContext): number {
  const level = Number(ctx.actor.combatStats?.level ?? ctx.sampleCharacter?.niveauGlobal ?? 1);
  return Number.isFinite(level) ? level : 1;
}

function getProficiencyBonus(level: number): number {
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

function resolveNumberVar(varName: string, ctx: FormulaContext): number | null {
  const actor = ctx.actor;
  const stats = actor.combatStats;
  const token = varName.toLowerCase();
  const computeModFromScore = (score?: number) => {
    if (!Number.isFinite(score)) return 0;
    return Math.floor((Number(score) - 10) / 2);
  };
  const pickNumber = (...values: Array<number | undefined | null>) => {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return 0;
  };

  if (token === "attackbonus") {
    return typeof stats?.attackBonus === "number" ? stats.attackBonus : 0;
  }
  if (token === "moverange") {
    return typeof stats?.moveRange === "number"
      ? stats.moveRange
      : typeof actor.moveRange === "number"
      ? actor.moveRange
      : typeof actor.movementProfile?.speed === "number"
      ? actor.movementProfile.speed
      : 0;
  }
  if (token === "level" || token === "niveau") {
    return getLevelFromContext(ctx);
  }
  if (token === "proficiencybonus" || token === "maitrisebonus") {
    return getProficiencyBonus(getLevelFromContext(ctx));
  }
  if (token === "modfor") {
    const mod = pickNumber(
      stats?.mods?.modFOR,
      ctx.sampleCharacter?.caracs?.force?.modFOR,
      computeModFromScore(ctx.sampleCharacter?.caracs?.force?.FOR)
    );
    return Number.isFinite(mod) ? mod : 0;
  }
  if (token === "moddex") {
    const mod = pickNumber(
      stats?.mods?.modDEX,
      ctx.sampleCharacter?.caracs?.dexterite?.modDEX,
      computeModFromScore(ctx.sampleCharacter?.caracs?.dexterite?.DEX)
    );
    return Number.isFinite(mod) ? mod : 0;
  }
  if (token === "modcon") {
    const mod = pickNumber(
      stats?.mods?.modCON,
      ctx.sampleCharacter?.caracs?.constitution?.modCON,
      computeModFromScore(ctx.sampleCharacter?.caracs?.constitution?.CON)
    );
    return Number.isFinite(mod) ? mod : 0;
  }
  if (token === "modint") {
    const mod = pickNumber(
      stats?.mods?.modINT,
      ctx.sampleCharacter?.caracs?.intelligence?.modINT,
      computeModFromScore(ctx.sampleCharacter?.caracs?.intelligence?.INT)
    );
    return Number.isFinite(mod) ? mod : 0;
  }
  if (token === "modsag") {
    const mod = pickNumber(
      stats?.mods?.modSAG,
      ctx.sampleCharacter?.caracs?.sagesse?.modSAG,
      computeModFromScore(ctx.sampleCharacter?.caracs?.sagesse?.SAG)
    );
    return Number.isFinite(mod) ? mod : 0;
  }
  if (token === "modcha") {
    const mod = pickNumber(
      stats?.mods?.modCHA,
      ctx.sampleCharacter?.caracs?.charisme?.modCHA,
      computeModFromScore(ctx.sampleCharacter?.caracs?.charisme?.CHA)
    );
    return Number.isFinite(mod) ? mod : 0;
  }

  return null;
}

export function resolveFormula(formula: string, ctx: FormulaContext): string {
  const raw = String(formula ?? "");
  if (!raw.trim()) return "0";

  return raw.replace(/[A-Za-z_][A-Za-z0-9_]*/g, token => {
    const value = resolveNumberVar(token, ctx);
    return value === null ? token : String(value);
  });
}
