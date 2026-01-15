import type { GridPosition } from "../types";
import type { WallBlocking, WallInstance, WallRotationDeg, WallTypeDefinition, WallVariant } from "./wallTypes";

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function rotateCell(cell: GridPosition, rotation: WallRotationDeg): GridPosition {
  switch (rotation) {
    case 90:
      return { x: -cell.y, y: cell.x };
    case 180:
      return { x: -cell.x, y: -cell.y };
    case 270:
      return { x: cell.y, y: -cell.x };
    default:
      return { x: cell.x, y: cell.y };
  }
}

export function getWallVariant(
  typeDef: WallTypeDefinition | null | undefined,
  variantId: string
): WallVariant | null {
  if (!typeDef) return null;
  const v = (typeDef.variants || []).find(x => x.id === variantId);
  return v ?? (typeDef.variants?.[0] ?? null);
}

export function getWallOccupiedCells(
  instance: WallInstance,
  typeDef: WallTypeDefinition | null | undefined
): GridPosition[] {
  const variant = getWallVariant(typeDef, instance.variantId);
  const footprint = Array.isArray(variant?.footprint) && variant.footprint.length
    ? variant.footprint
    : [{ x: 0, y: 0 }];

  const rotation: WallRotationDeg = instance.rotation ?? 0;
  return footprint.map(rel => {
    const rotated = rotateCell(rel, rotation);
    return { x: instance.x + rotated.x, y: instance.y + rotated.y };
  });
}

function resolveBlocking(typeDef: WallTypeDefinition | null | undefined, instance: WallInstance): WallBlocking {
  const fallback: WallBlocking = { movement: true, vision: true, attacks: true };
  if (!typeDef) return fallback;
  const kind = typeDef.behavior?.kind ?? "solid";
  const isOpen = (kind === "door" || kind === "arch") && instance.state === "open";
  if (isOpen) {
    return { movement: false, vision: false, attacks: false };
  }
  return typeDef.blocking ?? fallback;
}

export function buildWallBlockingSets(
  wallTypes: WallTypeDefinition[],
  walls: WallInstance[]
): {
  movement: Set<string>;
  vision: Set<string>;
  attacks: Set<string>;
  occupied: Set<string>;
} {
  const typeById = new Map<string, WallTypeDefinition>();
  for (const t of wallTypes) typeById.set(t.id, t);

  const movement = new Set<string>();
  const vision = new Set<string>();
  const attacks = new Set<string>();
  const occupied = new Set<string>();

  for (const wall of walls) {
    if (typeof wall.hp === "number" && wall.hp <= 0) continue;
    const def = typeById.get(wall.typeId);
    const cells = getWallOccupiedCells(wall, def);
    const blocking = resolveBlocking(def ?? null, wall);

    for (const c of cells) {
      const k = key(c.x, c.y);
      occupied.add(k);
      if (blocking.movement) movement.add(k);
      if (blocking.vision) vision.add(k);
      if (blocking.attacks) attacks.add(k);
    }
  }

  return { movement, vision, attacks, occupied };
}
