import { useEffect } from "react";
import { Container, Graphics, Text } from "pixi.js";
import type { RefObject } from "react";
import type { TokenState } from "../types";
import type { SpeechBubbleEntry } from "../game/turnTypes";
import { TILE_SIZE, gridToScreenForGrid } from "../boardConfig";
import { isTokenDead } from "../game/combatUtils";

export function usePixiSpeechBubbles(options: {
  speechLayerRef: RefObject<Container | null>;
  player: TokenState;
  enemies: TokenState[];
  speechBubbles: SpeechBubbleEntry[];
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
}): void {
  useEffect(() => {
    const speechLayer = options.speechLayerRef.current;
    if (!speechLayer) return;

    speechLayer.removeChildren();

    const allTokens: TokenState[] = [options.player, ...options.enemies];
    const bubbleByTokenId = new Map(
      options.speechBubbles.map(b => [b.tokenId, b] as const)
    );

    type BubbleItem = {
      x: number;
      y: number;
      width: number;
      height: number;
      view: Container;
    };

    const padding = 6;
    const maxWidth = 140;
    const baseOffsetY = TILE_SIZE * 1;

    const items: BubbleItem[] = [];

    for (const token of allTokens) {
      if (isTokenDead(token)) continue;
      const bubble = bubbleByTokenId.get(token.id);
      if (!bubble) continue;
      if (!bubble.text.trim()) continue;

      const screenPos = gridToScreenForGrid(token.x, token.y, options.grid.cols, options.grid.rows);

      const bubbleContainer = new Container();
      const bubbleBg = new Graphics();
      bubbleBg.beginFill(0xffffff, 0.92);

      const textObj = new Text(bubble.text, {
        fontFamily: "Arial",
        fontSize: 11,
        fill: 0x000000,
        align: "center",
        wordWrap: true,
        wordWrapWidth: maxWidth - 10
      });

      const width = Math.min(maxWidth, textObj.width + 10);
      const height = textObj.height + 8;

      bubbleBg.drawRoundedRect(-width / 2, -height, width, height, 7);
      bubbleBg.endFill();

      textObj.x = -textObj.width / 2;
      textObj.y = -height + 4;

      bubbleContainer.addChild(bubbleBg);
      bubbleContainer.addChild(textObj);

      const x = screenPos.x + TILE_SIZE * 0.05;
      const y = screenPos.y - baseOffsetY;

      bubbleContainer.x = x;
      bubbleContainer.y = y;

      speechLayer.addChild(bubbleContainer);

      items.push({
        x: x - width / 2,
        y: y - height,
        width,
        height,
        view: bubbleContainer
      });
    }

    items.sort((a, b) => a.y - b.y);
    const placed: BubbleItem[] = [];

    for (const item of items) {
      let currentY = item.y;
      let tries = 0;

      const overlaps = (a: BubbleItem, bx: number, by: number) => {
        const ax1 = a.x;
        const ay1 = a.y;
        const ax2 = a.x + a.width;
        const ay2 = a.y + a.height;

        const bx1 = bx;
        const by1 = by;
        const bx2 = bx + item.width;
        const by2 = by + item.height;

        return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
      };

      while (tries < 20) {
        const colliding = placed.find(p => overlaps(p, item.x, currentY));
        if (!colliding) break;
        currentY = colliding.y - item.height - padding;
        tries += 1;
      }

      const dy = currentY - item.y;
      if (dy !== 0) {
        item.view.y += dy;
        item.y = currentY;
      }

      placed.push(item);
    }
  }, [
    options.speechLayerRef,
    options.player,
    options.enemies,
    options.speechBubbles,
    options.pixiReadyTick,
    options.grid
  ]);
}
