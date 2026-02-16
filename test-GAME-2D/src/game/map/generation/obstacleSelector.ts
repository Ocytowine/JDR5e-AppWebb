import type { ObstacleTypeDefinition } from "../obstacleTypes";
import { pickWeighted } from "./random";

export function findObstacleType(
  obstacleTypes: ObstacleTypeDefinition[],
  typeId: string
): ObstacleTypeDefinition | null {
  return obstacleTypes.find(t => t.id === typeId) ?? null;
}

export function weightedTypesForContext(
  obstacleTypes: ObstacleTypeDefinition[],
  filter: (t: ObstacleTypeDefinition) => boolean
): { item: ObstacleTypeDefinition; weight: number }[] {
  return obstacleTypes
    .filter(filter)
    .map(t => ({ item: t, weight: Math.max(0, Number(t.spawnRules?.weight ?? 1)) }))
    .filter(x => x.weight > 0);
}

export function pickVariantIdForPlacement(
  type: ObstacleTypeDefinition,
  desiredShape: "line" | "scatter" | "room" | null,
  rand: () => number
): string {
  const variants = Array.isArray(type.variants) ? type.variants : [];
  if (variants.length === 0) return "base";

  const candidates = variants.map(v => {
    const size = Array.isArray(v.footprint) ? v.footprint.length : 1;
    const weightBase = Math.max(1, size);
    const weight = desiredShape === "line" ? weightBase * 2 : weightBase;
    return { item: v.id, weight };
  });

  return pickWeighted(candidates, rand) ?? variants[0].id;
}

export function rotationForLine(
  type: ObstacleTypeDefinition,
  variantId: string,
  direction: "horizontal" | "vertical"
): 0 | 90 | 180 | 270 {
  const variant = (type.variants ?? []).find(v => v.id === variantId) ?? null;
  if (!variant?.rotatable) return 0;
  return direction === "vertical" ? 90 : 0;
}

export function randomRotationForPlacement(
  type: ObstacleTypeDefinition,
  variantId: string,
  rand: () => number
): number {
  const variant = (type.variants ?? []).find(v => v.id === variantId) ?? null;
  if (!variant?.rotatable) return 0;
  if (!type.appearance?.randomRotation) return 0;
  const rotations = [0, 45, 90, 135, 180, 225, 270, 315];
  return rotations[Math.floor(rand() * rotations.length)] ?? 0;
}

