import { useEffect } from "react";
import { Container, Graphics } from "pixi.js";
import type { RefObject } from "react";
import type { TokenState } from "../../types";
import { TILE_SIZE, gridToScreenForGrid } from "../../boardConfig";
import { isTokenDead } from "../../game/combatUtils";
import { getTokenOccupiedCells } from "../../game/footprint";

export function usePixiTokens(options: {
  depthLayerRef: RefObject<Container | null>;
  player: TokenState;
  enemies: TokenState[];
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
      if (child.label === "token") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    const allTokens: TokenState[] = [options.player, ...options.enemies];
    const cellKey = (x: number, y: number) => `${x},${y}`;
    const showAll = Boolean(options.showAllLevels);
    const visibleCells = options.visibleCells ?? null;

    for (const token of allTokens) {
      const occupied = getTokenOccupiedCells(token);
      const isVisible =
        showAll ||
        token.type === "player" ||
        occupied.some(c => visibleCells?.has(cellKey(c.x, c.y)) ?? true);
      if (!isVisible) continue;

      const center = gridToScreenForGrid(token.x, token.y, options.grid.cols, options.grid.rows);
      const container = new Container();
      const color = token.type === "player" ? 0x2ecc71 : 0xe74c3c;
      const radius = TILE_SIZE * 0.3;

      const disc = new Graphics();
      disc.circle(0, 0, radius).fill({
        color: isTokenDead(token) ? 0x666666 : color,
        alpha: isTokenDead(token) ? 0.6 : 0.95
      });
      container.addChild(disc);

      container.x = center.x;
      container.y = center.y;
      container.label = "token";

      depthLayer.addChild(container);
    }
  }, [
    options.depthLayerRef,
    options.player,
    options.enemies,
    options.pixiReadyTick,
    options.grid,
    options.heightMap,
    options.activeLevel,
    options.visibleCells,
    options.showAllLevels
  ]);
}
