import type { GridPosition } from "../types";
import type { ObstacleInstance, ObstacleTypeDefinition, ObstacleVariant } from "./obstacleTypes";
import {
  getFootprintCellsAt,
  orientationFromRotationDeg,
  type Orientation8
} from "./footprint";

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function resolveOrientation(instance: ObstacleInstance): Orientation8 {
  if (instance.orientation) return instance.orientation;
  return orientationFromRotationDeg(instance.rotation ?? 0);
}

function resolveRectSpec(
  footprint: GridPosition[]
): { width: number; height: number } | null {
  if (!footprint.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const set = new Set<string>();
  for (const cell of footprint) {
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minY = Math.min(minY, cell.y);
    maxY = Math.max(maxY, cell.y);
    set.add(`${cell.x},${cell.y}`);
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width <= 0 || height <= 0) return null;
  if (set.size !== width * height) return null;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!set.has(`${x},${y}`)) return null;
    }
  }
  return { width, height };
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

  const orientation = resolveOrientation(instance);
  const rect = resolveRectSpec(footprint);
  if (rect) {
    return getFootprintCellsAt(
      { x: instance.x, y: instance.y },
      { kind: "rect", width: rect.width, height: rect.height },
      orientation
    );
  }
  return getFootprintCellsAt(
    { x: instance.x, y: instance.y },
    { kind: "cells", cells: footprint },
    orientation
  );
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

