import { useEffect } from "react";
import { Container, Graphics } from "pixi.js";
import type { RefObject } from "react";
import type { WallSegment } from "../../game/map/walls/types";
import { TILE_SIZE } from "../../boardConfig";
import { getAdjacentCellsForEdge } from "../../game/map/walls/grid";

const WALL_COLORS: Record<WallSegment["kind"], number> = {
  wall: 0xded7c8,
  low: 0xc9b59a,
  door: 0x9b7a4a
};

export function usePixiWalls(options: {
  depthLayerRef: RefObject<Container | null>;
  walls: WallSegment[];
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
      if (child.label === "wall") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    if (!options.walls.length) return;

    const visibleCells = options.visibleCells ?? null;
    const showAll = Boolean(options.showAllLevels);

    const g = new Graphics();
    const thickness = TILE_SIZE / 3;
    const half = thickness / 2;

    const isVisibleSegment = (segment: WallSegment): boolean => {
      if (showAll || !visibleCells || visibleCells.size === 0) return true;
      const cells = getAdjacentCellsForEdge(segment);
      const aKey = `${cells.a.x},${cells.a.y}`;
      const bKey = `${cells.b.x},${cells.b.y}`;
      return visibleCells.has(aKey) || visibleCells.has(bKey);
    };

    for (const seg of options.walls) {
      if (!isVisibleSegment(seg)) continue;

      const baseX = seg.x * TILE_SIZE;
      const baseY = seg.y * TILE_SIZE;

      let x = baseX;
      let y = baseY;
      let w = TILE_SIZE;
      let h = TILE_SIZE;

      switch (seg.dir) {
        case "N":
          x = baseX;
          y = baseY - half;
          w = TILE_SIZE;
          h = thickness;
          break;
        case "S":
          x = baseX;
          y = baseY + TILE_SIZE - half;
          w = TILE_SIZE;
          h = thickness;
          break;
        case "W":
          x = baseX - half;
          y = baseY;
          w = thickness;
          h = TILE_SIZE;
          break;
        case "E":
          x = baseX + TILE_SIZE - half;
          y = baseY;
          w = thickness;
          h = TILE_SIZE;
          break;
      }

      const color = WALL_COLORS[seg.kind] ?? WALL_COLORS.wall;
      g.rect(x, y, w, h).fill({ color, alpha: 1 });
      g.rect(x, y, w, h).stroke({ width: 2, color: 0x000000, alpha: 1 });
    }

    g.label = "wall";
    depthLayer.addChild(g);
  }, [
    options.depthLayerRef,
    options.walls,
    options.pixiReadyTick,
    options.grid,
    options.heightMap,
    options.activeLevel,
    options.visibleCells,
    options.showAllLevels
  ]);
}
