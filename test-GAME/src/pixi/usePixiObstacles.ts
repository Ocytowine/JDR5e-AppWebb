import { useEffect } from "react";
import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { RefObject } from "react";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../game/obstacleTypes";
import { getObstacleOccupiedCells } from "../game/obstacleRuntime";
import { LEVEL_HEIGHT_PX, TILE_SIZE, gridToScreenBaseForGrid, gridToScreenForGrid } from "../boardConfig";
import { getHeightAtGrid } from "../game/map/draft";

function colorForObstacle(def: ObstacleTypeDefinition | null): number {
  const category = String(def?.category ?? "").toLowerCase();
  if (category === "wall") return 0x95a5a6;
  if (category === "vegetation") return 0x2ecc71;
  if (category === "structure") return 0xbdc3c7;
  return 0xe67e22; // prop / default
}

function spriteHeightScale(def: ObstacleTypeDefinition | null): number {
  const heightClass = String(def?.appearance?.heightClass ?? "").toLowerCase();
  if (heightClass === "low") return 0.9;
  if (heightClass === "medium") return 1.35;
  if (heightClass === "tall") return 2.1;
  return 1.2;
}

function tokenScaleFactor(
  def: ObstacleTypeDefinition | null,
  obs: ObstacleInstance
): number {
  const spec = def?.appearance?.tokenScale;
  const hasValue = typeof obs.tokenScale === "number" && Number.isFinite(obs.tokenScale);
  const fallback = spec && Number.isFinite(spec.default) ? spec.default : 100;
  let value = hasValue ? obs.tokenScale : fallback;
  const min = spec && Number.isFinite(spec.min) ? spec.min : null;
  const max = spec && Number.isFinite(spec.max) ? spec.max : null;
  if (min !== null || max !== null) {
    const lo = min ?? value;
    const hi = max ?? value;
    value = Math.min(Math.max(value, Math.min(lo, hi)), Math.max(lo, hi));
  }
  return value / 100;
}

function spriteDepthBias(def: ObstacleTypeDefinition | null): number {
  const heightClass = String(def?.appearance?.heightClass ?? "").toLowerCase();
  if (heightClass === "low") return -TILE_SIZE * 0.18;
  if (heightClass === "medium") return 0;
  if (heightClass === "tall") return TILE_SIZE * 0.45;
  return 0;
}

export function usePixiObstacles(options: {
  depthLayerRef: RefObject<Container | null>;
  obstacleTypes: ObstacleTypeDefinition[];
  obstacles: ObstacleInstance[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
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

    for (const obs of options.obstacles) {
      const def = typeById.get(obs.typeId) ?? null;
      const occupiedCells = def ? getObstacleOccupiedCells(obs, def) : [{ x: obs.x, y: obs.y }];
      let baseHeight = occupiedCells.reduce((acc, cell) => {
        const h = getHeightAtGrid(
          options.heightMap,
          options.grid.cols,
          options.grid.rows,
          cell.x,
          cell.y
        );
        return Math.max(acc, h);
      }, Number.NEGATIVE_INFINITY);
      if (!Number.isFinite(baseHeight)) baseHeight = 0;
      const connects = def?.connects;
      const isConnector =
        connects &&
        (options.activeLevel === connects.from || options.activeLevel === connects.to);
      if (baseHeight !== options.activeLevel && !isConnector) continue;
      const heightOffset =
        isConnector && baseHeight !== options.activeLevel
          ? options.activeLevel * LEVEL_HEIGHT_PX
          : baseHeight * LEVEL_HEIGHT_PX;
      const spriteKey = def?.appearance?.spriteKey;
      const canUseSprite = typeof spriteKey === "string" && occupiedCells.length === 1;

      if (canUseSprite) {
        const texture = Assets.get(spriteKey);
        if (texture && texture instanceof Texture) {
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5, 1);

          const heightScale = spriteHeightScale(def);
          const scaleFactor = tokenScaleFactor(def, obs);
          const targetHeight = TILE_SIZE * heightScale * scaleFactor;
          const aspect = texture.height > 0 ? texture.width / texture.height : 1;
          sprite.height = targetHeight;
          sprite.width = targetHeight * aspect;

          const base = gridToScreenBaseForGrid(occupiedCells[0].x, occupiedCells[0].y, options.grid.cols, options.grid.rows);
          sprite.x = base.x;
          sprite.y = base.y - heightOffset;

          if (typeof def?.appearance?.tint === "number") {
            sprite.tint = def.appearance.tint;
          }

          if (obs.rotation) {
            sprite.rotation = (obs.rotation * Math.PI) / 180;
          }

          sprite.zIndex = base.y - heightOffset + spriteDepthBias(def);
          sprite.label = "obstacle";
          depthLayer.addChild(sprite);
          continue;
        }
      }

      const g = new Graphics();
      const w = TILE_SIZE;
      const h = TILE_SIZE * 0.5;
      const color = colorForObstacle(def);
      let depthY = Number.NEGATIVE_INFINITY;

      for (const cell of occupiedCells) {
        const center = gridToScreenForGrid(cell.x, cell.y, options.grid.cols, options.grid.rows);
        depthY = Math.max(depthY, center.y - heightOffset);
        const points = [
          center.x,
          center.y - heightOffset - h / 2,
          center.x + w / 2,
          center.y - heightOffset,
          center.x,
          center.y - heightOffset + h / 2,
          center.x - w / 2,
          center.y - heightOffset
        ];

        g.poly(points).fill({
          color,
          alpha: 0.9
        });
        g.poly(points).stroke({
          color: 0x0b0b12,
          width: 2,
          alpha: 0.8
        });
      }

      g.zIndex = (Number.isFinite(depthY) ? depthY : 0) + spriteDepthBias(def);
      g.label = "obstacle";
      depthLayer.addChild(g);
    }
  }, [
    options.depthLayerRef,
    options.obstacleTypes,
    options.obstacles,
    options.pixiReadyTick,
    options.grid,
    options.heightMap,
    options.activeLevel
  ]);
}
