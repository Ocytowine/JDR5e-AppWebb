import type { WallTypeDefinition } from "../wallTypes";
import { pickWeighted } from "./random";

export function findWallType(
  wallTypes: WallTypeDefinition[],
  typeId: string
): WallTypeDefinition | null {
  return wallTypes.find(t => t.id === typeId) ?? null;
}

export function weightedWallTypesForContext(
  wallTypes: WallTypeDefinition[],
  filter: (t: WallTypeDefinition) => boolean
): { item: WallTypeDefinition; weight: number }[] {
  return wallTypes
    .filter(filter)
    .map(t => ({ item: t, weight: Math.max(0, Number((t as any).spawnRules?.weight ?? 1)) }))
    .filter(x => x.weight > 0);
}

export function pickWallVariantIdForPlacement(
  type: WallTypeDefinition,
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

export function wallRotationForLine(
  type: WallTypeDefinition,
  variantId: string,
  direction: "horizontal" | "vertical"
): 0 | 90 | 180 | 270 {
  const variant = (type.variants ?? []).find(v => v.id === variantId) ?? null;
  if (!variant?.rotatable) return 0;
  return direction === "vertical" ? 90 : 0;
}
