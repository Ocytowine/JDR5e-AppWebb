import { useEffect } from "react";
import { Assets, Container, Sprite, Texture } from "pixi.js";
import type { RefObject } from "react";
import type { DecorInstance } from "../game/decorTypes";
import { LEVEL_HEIGHT_PX, TILE_SIZE, gridToScreenBaseForGrid } from "../boardConfig";
import { getHeightAtGrid } from "../game/map/draft";

export function usePixiDecorations(options: {
  depthLayerRef: RefObject<Container | null>;
  decorations: DecorInstance[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
}): void {
  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.label === "decor") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    for (const decor of options.decorations) {
      const cellHeight = getHeightAtGrid(
        options.heightMap,
        options.grid.cols,
        options.grid.rows,
        decor.x,
        decor.y
      );
      if (cellHeight !== options.activeLevel) continue;
      const heightOffset = cellHeight * LEVEL_HEIGHT_PX;
      const texture = Assets.get(decor.spriteKey);
      if (!texture || !(texture instanceof Texture)) continue;

      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1);

      const scale = typeof decor.scale === "number" ? decor.scale : 1;
      const baseHeight = TILE_SIZE * 0.55;
      const targetHeight = baseHeight * scale;
      const aspect = texture.height > 0 ? texture.width / texture.height : 1;
      sprite.height = targetHeight;
      sprite.width = targetHeight * aspect;

      const basePos = gridToScreenBaseForGrid(decor.x, decor.y, options.grid.cols, options.grid.rows);
      sprite.x = basePos.x;
      sprite.y = basePos.y - heightOffset;

      if (typeof decor.rotation === "number") {
        sprite.rotation = (decor.rotation * Math.PI) / 180;
      }

      sprite.zIndex = basePos.y - heightOffset - TILE_SIZE * 0.2;
      sprite.label = "decor";
      depthLayer.addChild(sprite);
    }
  }, [
    options.depthLayerRef,
    options.decorations,
    options.pixiReadyTick,
    options.grid,
    options.heightMap,
    options.activeLevel
  ]);
}
