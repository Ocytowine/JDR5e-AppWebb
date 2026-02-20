import { useEffect } from "react";
import { Graphics, Text } from "pixi.js";
import type { Container } from "pixi.js";
import type { RefObject } from "react";
import {
  TILE_SIZE,
  getBoardGridProjectionKind,
  getGridCellPolygonForGrid,
  getGridNeighborsForGrid,
  gridToScreenForGrid
} from "../../boardConfig";
import type { TerrainCell } from "../../game/map/generation/draft";
import type { TerrainMixCell } from "../../game/map/generation/terrainMix";

export function usePixiTerrainFx(options: {
  terrainFxLayerRef: RefObject<Graphics | null>;
  terrainLabelLayerRef: RefObject<Container | null>;
  showTerrainIds: boolean;
  showTerrainContours: boolean;
  playableCells?: Set<string> | null;
  grid: { cols: number; rows: number };
  terrain?: TerrainCell[] | null;
  terrainMix?: Array<TerrainMixCell | null> | null;
  terrainIdMap: Map<string, number>;
  pixiReadyTick?: number;
}): void {
  useEffect(() => {
    const fxLayer = options.terrainFxLayerRef.current;
    const labelLayer = options.terrainLabelLayerRef.current;
    if (!fxLayer || !labelLayer) return;

    fxLayer.clear();
    const removed = labelLayer.removeChildren();
    for (const child of removed) {
      child.destroy();
    }

    if (!options.showTerrainIds && !options.showTerrainContours) return;

    const terrain = Array.isArray(options.terrain) ? options.terrain : null;
    if (!terrain || terrain.length === 0) return;

    const { cols, rows } = options.grid;
    const isHexGrid = getBoardGridProjectionKind() === "hex";
    const playable = options.playableCells;
    const terrainMix = Array.isArray(options.terrainMix) ? options.terrainMix : null;
    const isPlayable = (x: number, y: number): boolean => {
      if (!playable || playable.size === 0) return true;
      return playable.has(`${x},${y}`);
    };
    const getTerrainAt = (x: number, y: number): TerrainCell => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return "unknown";
      const index = y * cols + x;
      return terrain[index] ?? "unknown";
    };
    const getMixAt = (x: number, y: number): TerrainMixCell | null => {
      if (!terrainMix) return null;
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
      return terrainMix[y * cols + x] ?? null;
    };
    const getEdgeTerrain = (x: number, y: number, edge: "N" | "S" | "W" | "E"): TerrainCell | null => {
      if (!isPlayable(x, y)) return null;
      const base = getTerrainAt(x, y);
      const mix = getMixAt(x, y);
      if (!mix) return base;
      const blend = mix.blend;
      if (mix.corner === "NE") {
        return edge === "N" || edge === "E" ? blend : base;
      }
      if (mix.corner === "NW") {
        return edge === "N" || edge === "W" ? blend : base;
      }
      if (mix.corner === "SE") {
        return edge === "S" || edge === "E" ? blend : base;
      }
      return edge === "S" || edge === "W" ? blend : base;
    };

    if (options.showTerrainContours) {
      fxLayer.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.65 });
      if (isHexGrid) {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (!isPlayable(x, y)) continue;
            const baseTerrain = getTerrainAt(x, y);
            const center = gridToScreenForGrid(x, y, cols, rows);
            const polygon = getGridCellPolygonForGrid(x, y, cols, rows);
            if (polygon.length < 3) continue;

            const neighbors = getGridNeighborsForGrid({ x, y }, cols, rows, false).map(cell => {
              const p = gridToScreenForGrid(cell.x, cell.y, cols, rows);
              return { cell, dx: p.x - center.x, dy: p.y - center.y };
            });

            for (let i = 0; i < polygon.length; i++) {
              const a = polygon[i];
              const b = polygon[(i + 1) % polygon.length];
              const mx = (a.x + b.x) * 0.5;
              const my = (a.y + b.y) * 0.5;
              const ex = mx - center.x;
              const ey = my - center.y;
              const eLen = Math.hypot(ex, ey) || 1;

              let bestNeighbor: { x: number; y: number } | null = null;
              let bestScore = Number.NEGATIVE_INFINITY;
              for (const candidate of neighbors) {
                const cLen = Math.hypot(candidate.dx, candidate.dy) || 1;
                const score = (ex * candidate.dx + ey * candidate.dy) / (eLen * cLen);
                if (score > bestScore) {
                  bestScore = score;
                  bestNeighbor = candidate.cell;
                }
              }

              const neighborTerrain =
                bestNeighbor && bestScore > 0 && isPlayable(bestNeighbor.x, bestNeighbor.y)
                  ? getTerrainAt(bestNeighbor.x, bestNeighbor.y)
                  : null;

              if (neighborTerrain !== baseTerrain) {
                fxLayer.moveTo(a.x, a.y);
                fxLayer.lineTo(b.x, b.y);
                fxLayer.stroke();
              }
            }
          }
        }
      } else {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!isPlayable(x, y)) continue;
          const baseTerrain = getTerrainAt(x, y);
          const center = gridToScreenForGrid(x, y, cols, rows);
          const left = center.x - TILE_SIZE / 2;
          const top = center.y - TILE_SIZE / 2;
          const right = left + TILE_SIZE;
          const bottom = top + TILE_SIZE;
          const mix = getMixAt(x, y);

          const northEdge = getEdgeTerrain(x, y, "N");
          const southEdge = getEdgeTerrain(x, y, "S");
          const westEdge = getEdgeTerrain(x, y, "W");
          const eastEdge = getEdgeTerrain(x, y, "E");

          const northNeighbor = getEdgeTerrain(x, y - 1, "S");
          const southNeighbor = getEdgeTerrain(x, y + 1, "N");
          const westNeighbor = getEdgeTerrain(x - 1, y, "E");
          const eastNeighbor = getEdgeTerrain(x + 1, y, "W");

          const northDiff = !northNeighbor || northNeighbor !== northEdge;
          const southDiff = !southNeighbor || southNeighbor !== southEdge;
          const westDiff = !westNeighbor || westNeighbor !== westEdge;
          const eastDiff = !eastNeighbor || eastNeighbor !== eastEdge;

          if (northDiff) {
            fxLayer.moveTo(left, top);
            fxLayer.lineTo(right, top);
            fxLayer.stroke();
          }
          if (southDiff) {
            fxLayer.moveTo(left, bottom);
            fxLayer.lineTo(right, bottom);
            fxLayer.stroke();
          }
          if (westDiff) {
            fxLayer.moveTo(left, top);
            fxLayer.lineTo(left, bottom);
            fxLayer.stroke();
          }
          if (eastDiff) {
            fxLayer.moveTo(right, top);
            fxLayer.lineTo(right, bottom);
            fxLayer.stroke();
          }

          if (mix && mix.blend !== baseTerrain) {
            if (mix.corner === "NE" || mix.corner === "SW") {
              fxLayer.moveTo(left, top);
              fxLayer.lineTo(right, bottom);
              fxLayer.stroke();
            } else {
              fxLayer.moveTo(right, top);
              fxLayer.lineTo(left, bottom);
              fxLayer.stroke();
            }
          }
        }
      }
      }
    }

    if (options.showTerrainIds) {
      const fontSize = Math.max(10, Math.round(TILE_SIZE * 0.2));
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!isPlayable(x, y)) continue;
          const cellTerrain = getTerrainAt(x, y);
          const idValue = options.terrainIdMap.get(cellTerrain) ?? 0;
          const center = gridToScreenForGrid(x, y, cols, rows);
          const label = new Text({
            text: String(idValue),
            style: {
              fontFamily: "Arial",
              fontSize,
              fill: 0xffffff,
              stroke: { color: 0x000000, width: 3 },
              align: "center"
            }
          });
          label.anchor.set(0.5, 0.5);
          label.alpha = 0.9;
          label.x = center.x;
          label.y = center.y;
          labelLayer.addChild(label);
        }
      }
    }
  }, [
    options.terrainFxLayerRef,
    options.terrainLabelLayerRef,
    options.showTerrainIds,
    options.showTerrainContours,
    options.playableCells,
    options.grid,
    options.terrain,
    options.terrainMix,
    options.terrainIdMap,
    options.pixiReadyTick
  ]);
}

