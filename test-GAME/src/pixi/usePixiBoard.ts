import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { Application, Container, Graphics, Sprite, Assets } from "pixi.js";
import {
  BOARD_BACKGROUND_COLOR,
  BOARD_BACKGROUND_IMAGE_URL,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  gridToScreen,
  isCellInsideBoard
} from "../boardConfig";
import { preloadTokenTextures } from "../svgTokenHelper";

export function usePixiBoard(options: {
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
}): {
  appRef: RefObject<Application | null>;
  tokenLayerRef: RefObject<Container | null>;
  pathLayerRef: RefObject<Graphics | null>;
  speechLayerRef: RefObject<Container | null>;
} {
  const appRef = useRef<Application | null>(null);
  const tokenLayerRef = useRef<Container | null>(null);
  const pathLayerRef = useRef<Graphics | null>(null);
  const speechLayerRef = useRef<Container | null>(null);

  useEffect(() => {
    if (!options.enabled) return;
    if (!options.containerRef.current || appRef.current) return;

    const app = new Application();
    appRef.current = app;

    let destroyed = false;
    let resizeHandler: (() => void) | null = null;
    let initialized = false;

    const initPixi = async () => {
      await app.init({
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        background: BOARD_BACKGROUND_COLOR,
        antialias: true
      });

      initialized = true;

      await preloadTokenTextures();

      if (destroyed) return;

      const container = options.containerRef.current;
      if (!container) return;

      container.appendChild(app.canvas);

      const root = new Container();
      app.stage.addChild(root);

      if (BOARD_BACKGROUND_IMAGE_URL) {
        try {
          const bgTexture = await Assets.load(BOARD_BACKGROUND_IMAGE_URL);
          const bgSprite = new Sprite(bgTexture);
          bgSprite.x = 0;
          bgSprite.y = 0;
          bgSprite.width = BOARD_WIDTH;
          bgSprite.height = BOARD_HEIGHT;
          root.addChild(bgSprite);
        } catch (error) {
          console.warn("Cannot load board background image:", error);
        }
      }

      const gridLayer = new Graphics();
      root.addChild(gridLayer);

      const drawGrid = () => {
        gridLayer.clear();

        for (let gy = 0; gy < GRID_ROWS; gy++) {
          for (let gx = 0; gx < GRID_COLS; gx++) {
            if (!isCellInsideBoard(gx, gy)) continue;

            const center = gridToScreen(gx, gy);
            const w = TILE_SIZE;
            const h = TILE_SIZE * 0.5;

            const points = [
              center.x,
              center.y - h / 2,
              center.x + w / 2,
              center.y,
              center.x,
              center.y + h / 2,
              center.x - w / 2,
              center.y
            ];

            const isDark = (gx + gy) % 2 === 0;
            gridLayer.poly(points).fill({
              color: isDark ? 0x151522 : 0x1d1d30,
              alpha: 1
            });
          }
        }
      };

      drawGrid();

      const pathLayer = new Graphics();
      root.addChild(pathLayer);
      pathLayerRef.current = pathLayer;

      const tokenLayer = new Container();
      root.addChild(tokenLayer);
      tokenLayerRef.current = tokenLayer;

      const speechLayer = new Container();
      root.addChild(speechLayer);
      speechLayerRef.current = speechLayer;

      const resize = () => {
        const canvas = app.canvas;
        const parent = canvas.parentElement;
        if (!parent) return;
        const scale = Math.min(
          parent.clientWidth / BOARD_WIDTH,
          parent.clientHeight / BOARD_HEIGHT
        );
        canvas.style.transformOrigin = "top left";
        canvas.style.transform = `scale(${scale})`;
      };

      resizeHandler = resize;
      resize();
      window.addEventListener("resize", resize);
    };

    void initPixi();

    return () => {
      destroyed = true;
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (initialized && appRef.current) {
        appRef.current.destroy(true);
      }
      appRef.current = null;
      tokenLayerRef.current = null;
      pathLayerRef.current = null;
      speechLayerRef.current = null;
    };
  }, [options.enabled, options.containerRef]);

  return { appRef, tokenLayerRef, pathLayerRef, speechLayerRef };
}
