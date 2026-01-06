import { useEffect } from "react";
import { Assets, Container, Sprite, Texture } from "pixi.js";
import type { RefObject } from "react";
import type { DecorInstance } from "../game/decorTypes";
import { TILE_SIZE, gridToScreenBaseForGrid, gridToScreenForGrid } from "../boardConfig";

export function usePixiDecorations(options: {
  depthLayerRef: RefObject<Container | null>;
  decorations: DecorInstance[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
}): void {
  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.name === "decor") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    for (const decor of options.decorations) {
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

      const screenPos = gridToScreenForGrid(decor.x, decor.y, options.grid.cols, options.grid.rows);
      const basePos = gridToScreenBaseForGrid(decor.x, decor.y, options.grid.cols, options.grid.rows);
      sprite.x = basePos.x;
      sprite.y = basePos.y;

      if (typeof decor.rotation === "number") {
        sprite.rotation = (decor.rotation * Math.PI) / 180;
      }

      sprite.zIndex = basePos.y - TILE_SIZE * 0.2;
      sprite.name = "decor";
      depthLayer.addChild(sprite);
    }
  }, [options.depthLayerRef, options.decorations, options.pixiReadyTick, options.grid]);
}
