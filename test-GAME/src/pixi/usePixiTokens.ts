import { useEffect } from "react";
import { Container, Graphics, Sprite } from "pixi.js";
import type { RefObject } from "react";
import type { TokenState } from "../types";
import { LEVEL_HEIGHT_PX, TILE_SIZE, gridToScreenForGrid } from "../boardConfig";
import { getHeightAtGrid } from "../game/map/draft";
import { ENEMY_TOKEN_ID, PLAYER_TOKEN_ID } from "../svgTokenHelper";
import { isTokenDead } from "../game/combatUtils";

export function usePixiTokens(options: {
  depthLayerRef: RefObject<Container | null>;
  player: TokenState;
  enemies: TokenState[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
}): void {
  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.label === "token") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    const allTokens: TokenState[] = [options.player, ...options.enemies];
    for (const token of allTokens) {
      const baseHeight = getHeightAtGrid(
        options.heightMap,
        options.grid.cols,
        options.grid.rows,
        token.x,
        token.y
      );
      if (baseHeight !== options.activeLevel) continue;
      const elevation = Number.isFinite(token.elevation) ? token.elevation ?? 0 : 0;
      const heightOffset = (baseHeight + elevation) * LEVEL_HEIGHT_PX;

      const tokenContainer = new Container();

      if (!isTokenDead(token)) {
        const shadow = new Graphics();
        shadow.ellipse(0, 0, TILE_SIZE * 0.4, TILE_SIZE * 0.15).fill({
          color: 0x000000,
          alpha: 0.4
        });
        tokenContainer.addChild(shadow);
      }

      const textureId =
        token.type === "player" ? PLAYER_TOKEN_ID : ENEMY_TOKEN_ID;
      const sprite = Sprite.from(textureId);
      sprite.anchor.set(0.5, 1);
      sprite.width = TILE_SIZE * 0.9;
      sprite.height = TILE_SIZE * 0.9;

      if (isTokenDead(token)) {
        sprite.rotation = Math.PI / 2;
        sprite.alpha = 0.7;
      } else {
        sprite.rotation = 0;
        sprite.alpha = 1;
      }

      tokenContainer.addChild(sprite);

      const screenPos = gridToScreenForGrid(token.x, token.y, options.grid.cols, options.grid.rows);
      tokenContainer.x = screenPos.x + TILE_SIZE * 0.05;
      tokenContainer.y = screenPos.y - heightOffset;
      tokenContainer.zIndex = screenPos.y - heightOffset + TILE_SIZE * 0.05;
      tokenContainer.label = "token";

      depthLayer.addChild(tokenContainer);
    }
  }, [
    options.depthLayerRef,
    options.player,
    options.enemies,
    options.pixiReadyTick,
    options.grid,
    options.heightMap,
    options.activeLevel
  ]);
}

