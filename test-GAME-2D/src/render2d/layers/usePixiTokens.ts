import { useEffect } from "react";
import { Container, Graphics, Sprite } from "pixi.js";
import type { RefObject } from "react";
import type { TokenState } from "../../types";
import { TILE_SIZE, gridToScreenForGrid } from "../../boardConfig";
import { isTokenDead } from "../../game/combatUtils";
import {
  getDefaultOrientationForToken,
  getTokenOccupiedCells,
  orientationToRotationDeg
} from "../../game/footprint";
import { getTokenSpriteUrl } from "../../tokenTextureHelper";
import { DEPTH_Z } from "./depthOrdering";

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
  suspendRendering?: boolean;
}): void {
  const resolveTokenShadowSpec = (token: TokenState): { offsetX: number; offsetY: number; alpha: number } => {
    const footprint = token.footprint;
    const sizeFactor =
      footprint?.kind === "rect"
        ? Math.max(1, Math.max(footprint.width, footprint.height))
        : footprint?.kind === "cells"
          ? Math.max(1, footprint.cells.length)
          : 1;
    const scale = Math.min(2.2, Math.max(1, sizeFactor));
    return {
      offsetX: Math.max(4, Math.round(TILE_SIZE * 0.12 * scale)),
      offsetY: Math.max(6, Math.round(TILE_SIZE * 0.16 * scale)),
      alpha: 0.28
    };
  };

  const getTokenGridSpec = (token: TokenState): { tilesX: number; tilesY: number } => {
    const spec = token.footprint;
    if (spec?.kind === "rect") {
      return {
        tilesX: Math.max(1, Math.floor(spec.width)),
        tilesY: Math.max(1, Math.floor(spec.height))
      };
    }
    if (spec?.kind === "cells" && spec.cells.length > 0) {
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const cell of spec.cells) {
        minX = Math.min(minX, cell.x);
        minY = Math.min(minY, cell.y);
        maxX = Math.max(maxX, cell.x);
        maxY = Math.max(maxY, cell.y);
      }
      if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
        return {
          tilesX: Math.max(1, Math.round(maxX - minX + 1)),
          tilesY: Math.max(1, Math.round(maxY - minY + 1))
        };
      }
    }
    return { tilesX: 1, tilesY: 1 };
  };

  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.label === "token") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    if (options.suspendRendering) return;

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
      const spriteKey = token.appearance?.spriteKey;
      const spriteUrl = getTokenSpriteUrl(spriteKey, token.id, token.appearance?.spriteVariants);
      const dead = isTokenDead(token);
      const shadowSpec = resolveTokenShadowSpec(token);
      const shadowAlpha = dead ? shadowSpec.alpha * 0.6 : shadowSpec.alpha;

      if (spriteUrl) {
        const sprite = Sprite.from(spriteUrl);
        sprite.anchor.set(0.5, 0.5);
        const orientation = getDefaultOrientationForToken(token);
        const orientationDeg = orientationToRotationDeg(orientation);
        const screenDeg = (360 - orientationDeg) % 360;
        const spriteFacingScreenDeg = (360 - orientationToRotationDeg("up")) % 360;
        const rotationDeg = screenDeg - spriteFacingScreenDeg;
        sprite.rotation = (rotationDeg * Math.PI) / 180;
        const gridSpec = getTokenGridSpec(token);
        const scaleBase = typeof token.appearance?.tokenScale === "number"
          ? token.appearance.tokenScale / 100
          : 1;
        if (sprite.texture.width > 0 && sprite.texture.height > 0) {
          const targetW = gridSpec.tilesX * TILE_SIZE;
          const targetH = gridSpec.tilesY * TILE_SIZE;
          const scaleX = targetW / sprite.texture.width;
          const scaleY = targetH / sprite.texture.height;
          sprite.scale.set(scaleX * scaleBase, scaleY * scaleBase);
        } else {
          sprite.scale.set(scaleBase);
        }
        sprite.alpha = dead ? 0.6 : 0.95;
        sprite.tint = dead ? 0x666666 : 0xffffff;
        sprite.x = 0;
        sprite.y = 0;
        const shadow = Sprite.from(sprite.texture);
        shadow.anchor.set(0.5, 0.5);
        shadow.rotation = sprite.rotation;
        shadow.scale.set(sprite.scale.x, sprite.scale.y);
        shadow.alpha = Math.max(0.05, Math.min(0.5, shadowAlpha));
        shadow.tint = 0x000000;
        shadow.x = shadowSpec.offsetX;
        shadow.y = shadowSpec.offsetY;
        container.addChild(shadow);
        container.addChild(sprite);
      } else {
        const color = token.type === "player" ? 0x2ecc71 : 0xe74c3c;
        const radius = TILE_SIZE * 0.3;
        const disc = new Graphics();
        const shadow = new Graphics();
        shadow.circle(shadowSpec.offsetX, shadowSpec.offsetY, radius * 0.95).fill({
          color: 0x000000,
          alpha: Math.max(0.05, Math.min(0.5, shadowAlpha))
        });
        container.addChild(shadow);
        disc.circle(0, 0, radius).fill({
          color: dead ? 0x666666 : color,
          alpha: dead ? 0.6 : 0.95
        });
        container.addChild(disc);
      }

      container.x = center.x;
      container.y = center.y;
      container.label = "token";
      container.zIndex = center.y + DEPTH_Z.tokens;

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
