import type { GridPosition } from "../../../types";
import type { MapBuildContext, MapSpec } from "../types";
import { createDraft, clamp, setLight, setTerrain, tryPlaceObstacle } from "../draft";
import { findObstacleType, pickVariantIdForPlacement, weightedTypesForContext } from "../obstacleSelector";
import { pickWeighted } from "../random";

export function generateGenericScatter(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): { draft: ReturnType<typeof createDraft>; playerStart: GridPosition } {
  const { spec, ctx, rand } = params;
  const cols = Math.max(1, spec.grid.cols);
  const rows = Math.max(1, spec.grid.rows);

  const playerStart: GridPosition = { x: 1, y: Math.floor(rows / 2) };
  const draft = createDraft({ cols, rows, reserved: new Set(), seedPrefix: "obs" });

  draft.log.push("Layout: basique (scatter).");

  // Terrain par défaut
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      setTerrain(draft, x, y, "floor");
      setLight(draft, x, y, 0.75);
    }
  }

  const barrelType =
    findObstacleType(ctx.obstacleTypes, "barrel-wood") ??
    ctx.obstacleTypes.find(t => (t.tags ?? []).includes("barrel")) ??
    null;

  const props = weightedTypesForContext(ctx.obstacleTypes, t => t.category !== "wall");
  const count = clamp(Math.floor((cols * rows) / 18), 1, 8);

  let placed = 0;
  for (let i = 0; i < count; i++) {
    const chosen = pickWeighted(props, rand) ?? barrelType;
    if (!chosen) break;
    const x = Math.floor(rand() * cols);
    const y = Math.floor(rand() * rows);
    const variantId = pickVariantIdForPlacement(chosen, "scatter", rand);
    const ok = tryPlaceObstacle({ draft, type: chosen, x, y, variantId, rotation: 0 });
    if (ok) placed++;
  }

  draft.log.push(`Props: ${placed}.`);
  return { draft, playerStart };
}
