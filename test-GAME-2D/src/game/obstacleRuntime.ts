import type { GridPosition } from "../types";
import type {
  ObstacleInstance,
  ObstacleRotationDeg,
  ObstacleTypeDefinition,
  ObstacleVariant
} from "./obstacleTypes";

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function rotateCell(
  cell: GridPosition,
  rotation: ObstacleRotationDeg
): GridPosition {
  // Rotation around (0,0) on a square grid footprint.
  // 0: (x,y)
  // 90: (-y, x)
  // 180: (-x, -y)
  // 270: (y, -x)
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

export function getObstacleVariant(
  typeDef: ObstacleTypeDefinition | null | undefined,
  variantId: string
): ObstacleVariant | null {
  if (!typeDef) return null;
  const v = (typeDef.variants || []).find(x => x.id === variantId);
  return v ?? (typeDef.variants?.[0] ?? null);
}

export function getObstacleOccupiedCells(
  instance: ObstacleInstance,
  typeDef: ObstacleTypeDefinition | null | undefined
): GridPosition[] {
  const variant = getObstacleVariant(typeDef, instance.variantId);
  const footprint = Array.isArray(variant?.footprint) && variant.footprint.length
    ? variant.footprint
    : [{ x: 0, y: 0 }];

  const rotation: ObstacleRotationDeg = instance.rotation ?? 0;
  return footprint.map(rel => {
    const rotated = rotateCell(rel, rotation);
    return { x: instance.x + rotated.x, y: instance.y + rotated.y };
  });
}

export function buildObstacleBlockingSets(
  obstacleTypes: ObstacleTypeDefinition[],
  obstacles: ObstacleInstance[]
): {
  movement: Set<string>;
  vision: Set<string>;
  attacks: Set<string>;
  occupied: Set<string>;
} {
  const typeById = new Map<string, ObstacleTypeDefinition>();
  for (const t of obstacleTypes) typeById.set(t.id, t);

  const movement = new Set<string>();
  const vision = new Set<string>();
  const attacks = new Set<string>();
  const occupied = new Set<string>();

  for (const obs of obstacles) {
    if (obs.hp <= 0) continue;
    const def = typeById.get(obs.typeId);
    const cells = getObstacleOccupiedCells(obs, def);

    for (const c of cells) {
      const k = key(c.x, c.y);
      occupied.add(k);
      if (def?.blocking?.movement) movement.add(k);
      if (def?.blocking?.vision) vision.add(k);
      if (def?.blocking?.attacks) attacks.add(k);
    }
  }

  return { movement, vision, attacks, occupied };
}

