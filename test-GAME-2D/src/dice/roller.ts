// Minimal dice roller utilities for the mini-game.
// Pure functions: no UI or side-effects.

export type AdvantageMode = "normal" | "advantage" | "disadvantage";

export interface DieRoll {
  rolls: number[];
  total: number;
}

export interface AttackRollResult {
  d20: DieRoll;
  bonus: number;
  total: number;
  mode: AdvantageMode;
  isCrit: boolean;
}

export interface DamageRollResult {
  dice: DieRoll[];
  flatModifier: number;
  total: number;
  formula: string;
  isCrit: boolean;
}

export function rollDie(sides: number, count = 1): DieRoll {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(1 + Math.floor(Math.random() * sides));
  }
  const total = rolls.reduce((acc, n) => acc + n, 0);
  return { rolls, total };
}

export function rollAttack(
  bonus: number,
  mode: AdvantageMode = "normal",
  critRange = 20
): AttackRollResult {
  if (mode === "advantage") {
    const a = rollDie(20);
    const b = rollDie(20);
    const chosen = Math.max(a.total, b.total);
    return {
      d20: { rolls: [a.total, b.total], total: chosen },
      bonus,
      total: chosen + bonus,
      mode,
      isCrit: chosen >= critRange
    };
  }

  if (mode === "disadvantage") {
    const a = rollDie(20);
    const b = rollDie(20);
    const chosen = Math.min(a.total, b.total);
    return {
      d20: { rolls: [a.total, b.total], total: chosen },
      bonus,
      total: chosen + bonus,
      mode,
      isCrit: chosen >= critRange
    };
  }

  const single = rollDie(20);
  return {
    d20: single,
    bonus,
    total: single.total + bonus,
    mode,
    isCrit: single.total >= critRange
  };
}

interface ParsedTerm {
  diceCount: number;
  diceSides: number;
  modifier: number;
}

function parseFormula(formula: string): ParsedTerm[] {
  const terms: ParsedTerm[] = [];
  const cleaned = formula.replace(/\s+/g, "");
  const tokens = cleaned.split(/(?=[+-])/);

  for (const raw of tokens) {
    if (!raw) continue;
    const sign = raw.startsWith("-") ? -1 : 1;
    const token = raw.replace(/^[+-]/, "");
    const diceMatch = token.match(/^(\d*)d(\d+)$/i);
    if (diceMatch) {
      const count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
      const sides = parseInt(diceMatch[2], 10);
      terms.push({ diceCount: sign * count, diceSides: sides, modifier: 0 });
      continue;
    }
    const flat = parseInt(token, 10);
    if (!Number.isNaN(flat)) {
      terms.push({ diceCount: 0, diceSides: 0, modifier: sign * flat });
    }
  }

  return terms;
}

export function rollDamage(
  formula: string,
  opts?: { isCrit?: boolean; critRule?: "double-dice" | "double-total" }
): DamageRollResult {
  const isCrit = Boolean(opts?.isCrit);
  const critRule = opts?.critRule ?? "double-dice";

  const terms = parseFormula(formula);
  const dice: DieRoll[] = [];
  let flatModifier = 0;

  for (const term of terms) {
    if (term.diceCount !== 0 && term.diceSides > 0) {
      const count = Math.abs(term.diceCount);
      const totalDice = isCrit && critRule === "double-dice" ? count * 2 : count;
      const roll = rollDie(term.diceSides, totalDice);
      dice.push(term.diceCount < 0 ? { rolls: roll.rolls, total: -roll.total } : roll);
    } else {
      flatModifier += term.modifier;
    }
  }

  let diceSum = dice.reduce((acc, r) => acc + r.total, 0);
  let total = diceSum + flatModifier;
  if (isCrit && critRule === "double-total") {
    total *= 2;
  }

  return {
    dice,
    flatModifier,
    total,
    formula,
    isCrit
  };
}
