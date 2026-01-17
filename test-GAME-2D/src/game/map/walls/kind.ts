import type { WallTypeDefinition } from "../../wallTypes";
import type { WallKind } from "./types";

export function resolveWallKindFromType(typeDef: WallTypeDefinition | null | undefined): WallKind {
  if (!typeDef) return "wall";
  const kind = typeDef.behavior?.kind ?? "solid";
  if (kind === "door") return "door";
  const heightClass = typeDef.appearance?.heightClass ?? "";
  if (String(heightClass).toLowerCase() === "low") return "low";
  const tags = typeDef.tags ?? [];
  if (tags.some(t => String(t).toLowerCase() === "low")) return "low";
  return "wall";
}
