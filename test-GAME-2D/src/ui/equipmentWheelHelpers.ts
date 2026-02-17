import type { WheelMenuItem } from "./RadialWheelMenu";

export type EquipmentWheelActionId = "draw" | "sheathe" | "drop" | "inventory";

export function buildEquipmentWheelItems(params: {
  inventory: Array<any>;
  hasDrawCandidates?: boolean;
  primaryItem: any | null;
  secondaryItem: any | null;
  hasFreeHand: boolean;
  onOpenAction: (id: EquipmentWheelActionId) => void;
}): WheelMenuItem[] {
  const {
    inventory,
    hasDrawCandidates,
    primaryItem,
    secondaryItem,
    hasFreeHand,
    onOpenAction
  } = params;
  const items: WheelMenuItem[] = [];
  const hasHandItem = Boolean(primaryItem) || Boolean(secondaryItem);
  const drawAvailable = Boolean(hasDrawCandidates);

  if (hasFreeHand && drawAvailable) {
    items.push({
      id: "equip-open-draw",
      label: "Degainer",
      color: "#f39c12",
      onSelect: () => onOpenAction("draw")
    });
  }

  if (hasHandItem) {
    items.push({
      id: "equip-open-sheathe",
      label: "Rengainer",
      color: "#f1c40f",
      onSelect: () => onOpenAction("sheathe")
    });

    items.push({
      id: "equip-open-drop",
      label: "Lacher",
      color: "#c0392b",
      onSelect: () => onOpenAction("drop")
    });
  }

  if (inventory.length > 0) {
    items.push({
      id: "equip-open-inventory",
      label: "Inventaire",
      color: "#34495e",
      onSelect: () => onOpenAction("inventory")
    });
  }

  return items;
}

