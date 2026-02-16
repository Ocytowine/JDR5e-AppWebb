import type { WheelMenuItem } from "./RadialWheelMenu";

type InventoryMutation = (params: { inventory: Array<any>; slots: Record<string, any> }) => void;

function findFreeCarrySlot(inventory: Array<any>, carrySlots: Set<string>): string | null {
  const used = new Set(
    inventory
      .map(entry => (entry?.storedIn ? null : String(entry?.equippedSlot ?? "")))
      .filter((id): id is string => Boolean(id))
  );
  return Array.from(carrySlots).find(id => !used.has(id)) ?? null;
}

export function buildEquipmentWheelItems(params: {
  inventory: Array<any>;
  secondaryItem: any | null;
  itemLabelMap: Record<string, string>;
  weaponCarrySlots: Set<string>;
  allowWeaponSwapWithoutInteraction: boolean;
  drawWeaponFromPackAsInteraction: boolean;
  canConsumeInteraction: (count: number) => { ok: boolean; reason?: string };
  consumeInteraction: (count: number) => void;
  consumeAction: () => { ok: boolean };
  isTwoHandedWeaponId: (weaponId: string) => boolean;
  applyCharacterInventoryMutation: (mutator: InventoryMutation) => void;
  pushLog: (message: string) => void;
}): WheelMenuItem[] {
  const {
    inventory,
    secondaryItem,
    itemLabelMap,
    weaponCarrySlots,
    allowWeaponSwapWithoutInteraction,
    drawWeaponFromPackAsInteraction,
    canConsumeInteraction,
    consumeInteraction,
    consumeAction,
    isTwoHandedWeaponId,
    applyCharacterInventoryMutation,
    pushLog
  } = params;
  const items: WheelMenuItem[] = [];
  const primaryItem =
    inventory.find(item => item?.type === "weapon" && item?.isPrimaryWeapon && item?.equippedSlot && !item?.storedIn) ??
    null;
  const carriedWeapons = inventory.filter(
    item =>
      item?.type === "weapon" &&
      item?.equippedSlot &&
      !item?.storedIn &&
      weaponCarrySlots.has(String(item.equippedSlot))
  );
  const packedWeapons = inventory.filter(item => item?.type === "weapon" && Boolean(item?.storedIn));

  carriedWeapons
    .filter(item => !item?.isPrimaryWeapon)
    .forEach(item => {
      const label = itemLabelMap[String(item.id ?? "")] ?? String(item.id ?? "arme");
      items.push({
        id: `equip-draw-${item.instanceId ?? item.id}`,
        label: `Degainer ${label}`,
        color: "#f39c12",
        onSelect: () => {
          const interactionCost = allowWeaponSwapWithoutInteraction ? 0 : 1;
          const can = canConsumeInteraction(interactionCost);
          if (!can.ok) {
            pushLog(can.reason ?? "Interaction d'equipement impossible.");
            return;
          }
          applyCharacterInventoryMutation(({ inventory }) => {
            inventory.forEach(entry => {
              if (entry?.type !== "weapon") return;
              entry.isPrimaryWeapon = String(entry.instanceId ?? "") === String(item.instanceId ?? "");
              if (entry.isPrimaryWeapon && isTwoHandedWeaponId(String(entry.id ?? ""))) {
                inventory.forEach(e => {
                  e.isSecondaryHand = false;
                });
              }
            });
          });
          consumeInteraction(interactionCost);
          pushLog(`Equipement: ${label} en main principale.`);
        }
      });
    });

  packedWeapons.forEach(item => {
    const label = itemLabelMap[String(item.id ?? "")] ?? String(item.id ?? "arme");
    items.push({
      id: `equip-pack-${item.instanceId ?? item.id}`,
      label: `Sortir ${label} du sac`,
      color: "#d35400",
      onSelect: () => {
        const freeSlot = findFreeCarrySlot(inventory, weaponCarrySlots);
        if (!freeSlot) {
          pushLog("Equipement: aucun slot de port libre pour degainer cette arme.");
          return;
        }
        const asInteraction = Boolean(drawWeaponFromPackAsInteraction);
        if (asInteraction) {
          const can = canConsumeInteraction(1);
          if (!can.ok) {
            pushLog(can.reason ?? "Interaction d'equipement impossible.");
            return;
          }
        } else {
          const actionOk = consumeAction();
          if (!actionOk.ok) return;
        }
        applyCharacterInventoryMutation(({ inventory, slots }) => {
          const target = inventory.find(entry => String(entry.instanceId ?? "") === String(item.instanceId ?? "")) ?? null;
          if (!target) return;
          target.storedIn = null;
          target.equippedSlot = freeSlot;
          target.isPrimaryWeapon = true;
          slots[freeSlot] = target.id ?? null;
          inventory.forEach(entry => {
            if (entry === target) return;
            if (entry?.type === "weapon") entry.isPrimaryWeapon = false;
          });
        });
        if (asInteraction) consumeInteraction(1);
        pushLog(`Equipement: ${label} sorti du sac et degaine.`);
      }
    });
  });

  if (primaryItem) {
    items.push({
      id: "equip-sheathe-primary",
      label: "Rengainer principale",
      color: "#f1c40f",
      onSelect: () => {
        const can = canConsumeInteraction(1);
        if (!can.ok) {
          pushLog(can.reason ?? "Interaction d'equipement impossible.");
          return;
        }
        applyCharacterInventoryMutation(({ inventory }) => {
          inventory.forEach(entry => {
            if (entry?.isPrimaryWeapon) entry.isPrimaryWeapon = false;
          });
        });
        consumeInteraction(1);
        pushLog("Equipement: main principale rengainee.");
      }
    });
    items.push({
      id: "equip-drop-primary",
      label: "Faire tomber principale",
      color: "#c0392b",
      onSelect: () => {
        applyCharacterInventoryMutation(({ inventory, slots }) => {
          const target = inventory.find(entry => entry?.isPrimaryWeapon) ?? null;
          if (!target) return;
          const slotId = String(target.equippedSlot ?? "");
          if (slotId) slots[slotId] = null;
          target.isPrimaryWeapon = false;
          target.equippedSlot = null;
          target.storedIn = null;
        });
        pushLog("Equipement: objet principal lache.");
      }
    });
  }

  if (secondaryItem) {
    items.push({
      id: "equip-sheathe-secondary",
      label: "Rengainer secondaire",
      color: "#f1c40f",
      onSelect: () => {
        const can = canConsumeInteraction(1);
        if (!can.ok) {
          pushLog(can.reason ?? "Interaction d'equipement impossible.");
          return;
        }
        applyCharacterInventoryMutation(({ inventory }) => {
          inventory.forEach(entry => {
            if (entry?.isSecondaryHand) entry.isSecondaryHand = false;
          });
        });
        consumeInteraction(1);
        pushLog("Equipement: main secondaire rengainee.");
      }
    });
    items.push({
      id: "equip-drop-secondary",
      label: "Faire tomber secondaire",
      color: "#c0392b",
      onSelect: () => {
        applyCharacterInventoryMutation(({ inventory, slots }) => {
          const target = inventory.find(entry => entry?.isSecondaryHand) ?? null;
          if (!target) return;
          const slotId = String(target.equippedSlot ?? "");
          if (slotId) slots[slotId] = null;
          target.isSecondaryHand = false;
          target.equippedSlot = null;
          target.storedIn = null;
        });
        pushLog("Equipement: objet secondaire lache.");
      }
    });
  }

  return items;
}

