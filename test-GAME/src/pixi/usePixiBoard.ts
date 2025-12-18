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
  zoom?: number;
  panX?: number;
  panY?: number;
}): {
  appRef: RefObject<Application | null>;
  tokenLayerRef: RefObject<Container | null>;
  pathLayerRef: RefObject<Graphics | null>;
  speechLayerRef: RefObject<Container | null>;
  viewportRef: RefObject<{ scale: number; offsetX: number; offsetY: number } | null>;
} {
  const appRef = useRef<Application | null>(null);
  const tokenLayerRef = useRef<Container | null>(null);
  const pathLayerRef = useRef<Graphics | null>(null);
  const speechLayerRef = useRef<Container | null>(null);
  const viewportRef = useRef<{ scale: number; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<(() => void) | null>(null);
  const zoomRef = useRef<number>(typeof options.zoom === "number" ? options.zoom : 1);
  const panRef = useRef<{ x: number; y: number }>({
    x: typeof options.panX === "number" ? options.panX : 0,
    y: typeof options.panY === "number" ? options.panY : 0
  });

  zoomRef.current = typeof options.zoom === "number" ? options.zoom : 1;
  panRef.current = {
    x: typeof options.panX === "number" ? options.panX : 0,
    y: typeof options.panY === "number" ? options.panY : 0
  };

  useEffect(() => {
    resizeRef.current?.();
  }, [options.zoom, options.panX, options.panY]);

  useEffect(() => {
    if (!options.enabled) return;
    if (!options.containerRef.current || appRef.current) return;

    const app = new Application();
    appRef.current = app;

    let destroyed = false;
    let resizeHandler: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
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

      // Keep the canvas behind React-rendered overlays inside the same container.
      container.prepend(app.canvas);

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
        const parent = options.containerRef.current;
        if (!parent) return;

        const width = Math.max(1, parent.clientWidth);
        const height = Math.max(1, parent.clientHeight);

        app.renderer.resize(width, height);

        const baseScale = Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT);
        const zoom = zoomRef.current;
        const scale = baseScale * zoom;
        const offsetX = (width - BOARD_WIDTH * scale) / 2 + panRef.current.x;
        const offsetY = (height - BOARD_HEIGHT * scale) / 2 + panRef.current.y;

        root.scale.set(scale);
        root.position.set(offsetX, offsetY);

        viewportRef.current = { scale, offsetX, offsetY };

        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
      };

      resizeHandler = resize;
      resizeRef.current = resize;
      resize();

      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(container);
      window.addEventListener("resize", resize);
    };

    void initPixi();

    return () => {
      destroyed = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (initialized && appRef.current) {
        appRef.current.destroy(true);
      }
      appRef.current = null;
      tokenLayerRef.current = null;
      pathLayerRef.current = null;
      speechLayerRef.current = null;
      viewportRef.current = null;
      resizeRef.current = null;
    };
  }, [options.enabled, options.containerRef]);

  return { appRef, tokenLayerRef, pathLayerRef, speechLayerRef, viewportRef };
}
