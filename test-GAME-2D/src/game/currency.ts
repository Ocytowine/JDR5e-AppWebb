export type MoneyValue = {
  pp?: number;
  po?: number;
  pa?: number;
  pc?: number;
};

export type CoinDenom = "pp" | "po" | "pa" | "pc";

export const COIN_IDS: Record<CoinDenom, string> = {
  pp: "obj_piece_platine",
  po: "obj_piece_or",
  pa: "obj_piece_argent",
  pc: "obj_piece_cuivre"
};

export const COIN_VALUES_CP: Record<CoinDenom, number> = {
  pp: 1000,
  po: 100,
  pa: 10,
  pc: 1
};

export const COIN_WEIGHT_KG = 0.01;

export function isCoinId(id: string): boolean {
  return Object.values(COIN_IDS).includes(id);
}

export function coinIdToDenom(id: string): CoinDenom | null {
  const entry = (Object.entries(COIN_IDS) as Array<[CoinDenom, string]>).find(
    ([, coinId]) => coinId === id
  );
  return entry ? entry[0] : null;
}

export function moneyToCopper(value?: MoneyValue | null): number {
  if (!value) return 0;
  const pp = Number(value.pp ?? 0) || 0;
  const po = Number(value.po ?? 0) || 0;
  const pa = Number(value.pa ?? 0) || 0;
  const pc = Number(value.pc ?? 0) || 0;
  return pp * COIN_VALUES_CP.pp + po * COIN_VALUES_CP.po + pa * COIN_VALUES_CP.pa + pc;
}

export function copperToMoney(total: number): MoneyValue {
  let remaining = Math.max(0, Math.floor(total || 0));
  const pp = Math.floor(remaining / COIN_VALUES_CP.pp);
  remaining -= pp * COIN_VALUES_CP.pp;
  const po = Math.floor(remaining / COIN_VALUES_CP.po);
  remaining -= po * COIN_VALUES_CP.po;
  const pa = Math.floor(remaining / COIN_VALUES_CP.pa);
  remaining -= pa * COIN_VALUES_CP.pa;
  const pc = remaining;
  return { pp, po, pa, pc };
}

export function normalizeMoney(value?: MoneyValue | null): MoneyValue {
  return copperToMoney(moneyToCopper(value));
}

export function addMoney(left?: MoneyValue | null, right?: MoneyValue | null): MoneyValue {
  return copperToMoney(moneyToCopper(left) + moneyToCopper(right));
}

export function scaleMoney(value: MoneyValue, factor: number): MoneyValue {
  return copperToMoney(moneyToCopper(value) * Math.max(0, Math.floor(factor || 0)));
}

export function moneyToCoinStacks(value?: MoneyValue | null): Array<{ id: string; qty: number }> {
  const normalized = normalizeMoney(value);
  return (Object.keys(COIN_IDS) as CoinDenom[])
    .map(denom => ({
      id: COIN_IDS[denom],
      qty: Number(normalized[denom] ?? 0) || 0
    }))
    .filter(entry => entry.qty > 0);
}
