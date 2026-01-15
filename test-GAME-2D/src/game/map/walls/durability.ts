import type { WallTypeDefinition } from "../../wallTypes";

export function resolveWallMaxHp(typeDef: WallTypeDefinition | null | undefined): number | null {
  if (!typeDef) return null;
  if (typeDef.durability?.destructible === false) return null;
  const hp = Number(typeDef.durability?.maxHp ?? 1);
  if (!Number.isFinite(hp)) return 1;
  return Math.max(1, hp);
}

export function isWallDestructible(typeDef: WallTypeDefinition | null | undefined): boolean {
  if (!typeDef) return false;
  return typeDef.durability?.destructible !== false;
}
