import { useEffect } from "react";
import { Container, Graphics } from "pixi.js";
import type { RefObject } from "react";
import type { WallSegment } from "../../game/map/walls/types";
import { TILE_SIZE } from "../../boardConfig";
import { getAdjacentCellsForEdge } from "../../game/map/walls/grid";
import { DEPTH_Z } from "./depthOrdering";

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

    depthLayer.cacheAsBitmap = false;
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
    const doorLength = thickness * 1.6;
    const doorWidth = thickness * 0.9;

    const isVisibleSegment = (segment: WallSegment): boolean => {
      if (showAll || !visibleCells || visibleCells.size === 0) return true;
      const cells = getAdjacentCellsForEdge(segment);
      const aKey = `${cells.a.x},${cells.a.y}`;
      const bKey = `${cells.b.x},${cells.b.y}`;
      return visibleCells.has(aKey) || visibleCells.has(bKey);
    };

    const visibleSegments = options.walls.filter(seg => isVisibleSegment(seg));

    const vertexMap = new Map<string, {
      hasHorizontal: boolean;
      hasVertical: boolean;
      hasDoor: boolean;
      color: number;
    }>();

    const preferColor = (a: number, b: number): number => {
      const priority = (c: number) =>
        c === WALL_COLORS.wall ? 3 : c === WALL_COLORS.low ? 2 : c === WALL_COLORS.door ? 1 : 0;
      return priority(a) >= priority(b) ? a : b;
    };

    const addVertex = (vx: number, vy: number, seg: WallSegment, isHorizontal: boolean) => {
      const key = `${vx},${vy}`;
      const existing = vertexMap.get(key);
      const color = WALL_COLORS[seg.kind] ?? WALL_COLORS.wall;
      const hasDoor = seg.kind === "door";
      if (!existing) {
        vertexMap.set(key, {
          hasHorizontal: isHorizontal,
          hasVertical: !isHorizontal,
          hasDoor,
          color
        });
        return;
      }
      existing.hasHorizontal = existing.hasHorizontal || isHorizontal;
      existing.hasVertical = existing.hasVertical || !isHorizontal;
      existing.hasDoor = existing.hasDoor || hasDoor;
      existing.color = preferColor(existing.color, color);
    };

    for (const seg of visibleSegments) {
      const isHorizontal = seg.dir === "N" || seg.dir === "S";
      if (isHorizontal) {
        const yLine = seg.dir === "N" ? seg.y : seg.y + 1;
        addVertex(seg.x, yLine, seg, true);
        addVertex(seg.x + 1, yLine, seg, true);
      } else {
        const xLine = seg.dir === "W" ? seg.x : seg.x + 1;
        addVertex(xLine, seg.y, seg, false);
        addVertex(xLine, seg.y + 1, seg, false);
      }
    }

    const drawRotatedRect = (cx: number, cy: number, w: number, h: number, angle: number, color: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const hw = w / 2;
      const hh = h / 2;
      const p1x = cx + (-hw * cos - -hh * sin);
      const p1y = cy + (-hw * sin + -hh * cos);
      const p2x = cx + (hw * cos - -hh * sin);
      const p2y = cy + (hw * sin + -hh * cos);
      const p3x = cx + (hw * cos - hh * sin);
      const p3y = cy + (hw * sin + hh * cos);
      const p4x = cx + (-hw * cos - hh * sin);
      const p4y = cy + (-hw * sin + hh * cos);
      g.poly([p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y]).fill({ color, alpha: 1 });
      g.poly([p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y]).stroke({ width: 1, color: 0x000000, alpha: 1 });
    };

    const drawHingedRect = (hx: number, hy: number, w: number, h: number, angle: number, color: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const hh = h / 2;
      const p1x = hx + (0 * cos - -hh * sin);
      const p1y = hy + (0 * sin + -hh * cos);
      const p2x = hx + (w * cos - -hh * sin);
      const p2y = hy + (w * sin + -hh * cos);
      const p3x = hx + (w * cos - hh * sin);
      const p3y = hy + (w * sin + hh * cos);
      const p4x = hx + (0 * cos - hh * sin);
      const p4y = hy + (0 * sin + hh * cos);
      g.poly([p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y]).fill({ color, alpha: 1 });
      g.poly([p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y]).stroke({ width: 1, color: 0x000000, alpha: 1 });
    };

    for (const seg of visibleSegments) {
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

      if (seg.kind === "door") {
        const isHorizontal = seg.dir === "N" || seg.dir === "S";
        const closedAngle = isHorizontal ? 0 : Math.PI / 2;
        let swing = 0;
        if (seg.state === "open") {
          if (seg.dir === "N") swing = Math.PI / 2;
          if (seg.dir === "S") swing = -Math.PI / 2;
          if (seg.dir === "W") swing = -Math.PI / 2;
          if (seg.dir === "E") swing = Math.PI / 2;
        }
        const angle = closedAngle + swing;

        let hx = baseX;
        let hy = baseY;
        if (seg.dir === "N") hy = baseY - half + thickness / 2;
        if (seg.dir === "S") hy = baseY + TILE_SIZE - half + thickness / 2;
        if (seg.dir === "W") hx = baseX - half + thickness / 2;
        if (seg.dir === "E") hx = baseX + TILE_SIZE - half + thickness / 2;

        drawHingedRect(hx, hy, doorLength, doorWidth, angle, WALL_COLORS.door);
      }
    }

    for (const [key, info] of vertexMap) {
      if (!info.hasHorizontal || !info.hasVertical) continue;
      if (info.hasDoor) continue;
      const [vxStr, vyStr] = key.split(",");
      const vx = Number(vxStr);
      const vy = Number(vyStr);
      if (!Number.isFinite(vx) || !Number.isFinite(vy)) continue;
      const px = vx * TILE_SIZE - half;
      const py = vy * TILE_SIZE - half;
      g.rect(px, py, thickness, thickness).fill({ color: info.color, alpha: 1 });
      g.rect(px, py, thickness, thickness).stroke({ width: 1, color: 0x000000, alpha: 1 });
    }

    g.label = "wall";
    g.zIndex = DEPTH_Z.walls;
    depthLayer.addChild(g);
    depthLayer.cacheAsBitmap = true;
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
