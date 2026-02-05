import { isCoinId } from "../game/currency";

export type ItemSpec = {
  type: "weapon" | "armor" | "tool" | "object";
  id: string;
  qty: number;
};

export const isCurrencySpec = (type: string | null, id: string) =>
  type === "object" && isCoinId(id);

export const updateEquipmentListQty = (
  list: string[],
  resolveItemType: (rawId: string) => ItemSpec,
  buildItemSpec: (type: ItemSpec["type"], id: string, qty: number) => string,
  type: ItemSpec["type"],
  id: string,
  delta: number
) => {
  let updated = false;
  const next = list
    .map(entry => {
      if (updated) return entry;
      const resolved = resolveItemType(entry);
      if (resolved.type !== type || resolved.id !== id) return entry;
      updated = true;
      const nextQty = (resolved.qty ?? 1) + delta;
      if (nextQty <= 0) return null;
      return buildItemSpec(type, id, nextQty);
    })
    .filter(Boolean) as string[];
  if (!updated && delta > 0) {
    next.push(buildItemSpec(type, id, delta));
  }
  return next;
};

export const formatMoneyValue = (money: {
  pp?: number;
  po?: number;
  pa?: number;
  pc?: number;
}) => {
  const parts: string[] = [];
  const pp = Number(money.pp ?? 0) || 0;
  const po = Number(money.po ?? 0) || 0;
  const pa = Number(money.pa ?? 0) || 0;
  const pc = Number(money.pc ?? 0) || 0;
  if (pp) parts.push(`${pp} pp`);
  if (po) parts.push(`${po} po`);
  if (pa) parts.push(`${pa} pa`);
  if (pc) parts.push(`${pc} pc`);
  return parts.length > 0 ? parts.join(" ") : "0";
};

export const buildInventoryEntries = (
  specs: ItemSpec[],
  source: "auto" | "manual" | "loot",
  origin: { kind: string; id?: string } | undefined,
  createInstanceId: (prefix: string) => string
) => {
  const entries: Array<any> = [];
  specs.forEach(spec => {
    const qty = Math.max(1, Math.floor(Number(spec.qty || 1)));
    if (isCurrencySpec(spec.type, spec.id)) {
      entries.push({
        type: spec.type,
        id: spec.id,
        qty,
        source,
        equippedSlot: null,
        storedIn: null,
        isPrimaryWeapon: false
      });
      return;
    }
    for (let i = 0; i < qty; i += 1) {
      entries.push({
        type: spec.type,
        id: spec.id,
        qty: 1,
        source,
        origin,
        instanceId: createInstanceId("item"),
        equippedSlot: null,
        storedIn: null,
        isPrimaryWeapon: false
      });
    }
  });
  return entries;
};

export const appendInventoryEntries = (base: Array<any>, entries: Array<any>) => {
  let next = [...base];
  entries.forEach(entry => {
    if (isCurrencySpec(entry.type, entry.id)) {
      const existingIndex = next.findIndex(
        item =>
          item?.type === "object" &&
          item?.id === entry.id &&
          (item?.storedIn ?? null) === (entry?.storedIn ?? null)
      );
      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          qty: (existing?.qty ?? 1) + (entry?.qty ?? 1)
        };
        return;
      }
    }
    next = [...next, entry];
  });
  return next;
};
