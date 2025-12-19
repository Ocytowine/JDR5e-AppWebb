import { useEffect } from "react";
import { Container, Graphics, Sprite } from "pixi.js";
import type { RefObject } from "react";
import type { TokenState } from "../types";
import { TILE_SIZE, gridToScreenForGrid } from "../boardConfig";
import { ENEMY_TOKEN_ID, PLAYER_TOKEN_ID } from "../svgTokenHelper";
import { isTokenDead } from "../game/combatUtils";

export function usePixiTokens(options: {
  tokenLayerRef: RefObject<Container | null>;
  player: TokenState;
  enemies: TokenState[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
}): void {
  useEffect(() => {
    const tokenLayer = options.tokenLayerRef.current;
    if (!tokenLayer) return;

    tokenLayer.removeChildren();

    const allTokens: TokenState[] = [options.player, ...options.enemies];
    for (const token of allTokens) {
      const tokenContainer = new Container();

      if (!isTokenDead(token)) {
        const shadow = new Graphics();
        shadow.beginFill(0x000000, 0.4);
        shadow.drawEllipse(0, 0, TILE_SIZE * 0.4, TILE_SIZE * 0.15);
        shadow.endFill();
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
      tokenContainer.y = screenPos.y;

      tokenLayer.addChild(tokenContainer);
    }
  }, [options.tokenLayerRef, options.player, options.enemies, options.pixiReadyTick, options.grid]);
}

