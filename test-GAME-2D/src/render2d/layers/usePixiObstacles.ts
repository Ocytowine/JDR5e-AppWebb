import { useEffect } from "react";
import { Container, Graphics } from "pixi.js";
import type { RefObject } from "react";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../../game/obstacleTypes";
import { getObstacleOccupiedCells } from "../../game/obstacleRuntime";
import { TILE_SIZE, gridToScreenForGrid } from "../../boardConfig";

export function usePixiObstacles(options: {
  depthLayerRef: RefObject<Container | null>;
  obstacles: ObstacleInstance[];
  obstacleTypes: ObstacleTypeDefinition[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
  visibleCells?: Set<string> | null;
  showAllLevels?: boolean;
}): void {
  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.label === "obstacle") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    const typeById = new Map<string, ObstacleTypeDefinition>();
    for (const t of options.obstacleTypes) typeById.set(t.id, t);

    const visibleCells = options.visibleCells ?? null;
    const showAll = Boolean(options.showAllLevels);
    const cellKey = (x: number, y: number) => `${x},${y}`;

    for (const obs of options.obstacles) {
      if (obs.hp <= 0) continue;
      const def = typeById.get(obs.typeId) ?? null;
      const occupied = getObstacleOccupiedCells(obs, def);
      const tint = Number.isFinite(def?.appearance?.tint as number)
        ? (def?.appearance?.tint as number)
        : 0x8e5a2b;

      const container = new Container();

      for (const cell of occupied) {
        const key = cellKey(cell.x, cell.y);
        const isVisible = showAll || (visibleCells?.has(key) ?? true);
        if (!isVisible) continue;

        const center = gridToScreenForGrid(cell.x, cell.y, options.grid.cols, options.grid.rows);
        const size = TILE_SIZE * 0.9;
        const x = center.x - size / 2;
        const y = center.y - size / 2;

        const g = new Graphics();
        g.rect(x, y, size, size).fill({
          color: tint,
          alpha: 0.85
        });
        container.addChild(g);
      }

      container.label = "obstacle";
      depthLayer.addChild(container);
    }
  }, [
    options.depthLayerRef,
    options.obstacles,
    options.obstacleTypes,
    options.pixiReadyTick,
    options.grid,
    options.heightMap,
    options.activeLevel,
    options.visibleCells,
    options.showAllLevels
  ]);
}
