import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Application, Container, Graphics, Sprite, Assets } from "pixi.js";
import {
  BOARD_BACKGROUND_COLOR,
  BOARD_BACKGROUND_IMAGE_URL,
  TILE_SIZE,
  getBoardHeight,
  getBoardWidth,
  gridToScreenForGrid
} from "../boardConfig";
import { preloadTokenTextures } from "../svgTokenHelper";
import { preloadObstacleTextures } from "../svgObstacleHelper";

export function usePixiBoard(options: {
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  zoom?: number;
  panX?: number;
  panY?: number;
  playableCells?: Set<string> | null;
  grid: { cols: number; rows: number };
}): {
  appRef: RefObject<Application | null>;
  depthLayerRef: RefObject<Container | null>;
  pathLayerRef: RefObject<Graphics | null>;
  speechLayerRef: RefObject<Container | null>;
  viewportRef: RefObject<{ scale: number; offsetX: number; offsetY: number } | null>;
  pixiReadyTick: number;
} {
  const appRef = useRef<Application | null>(null);
  const depthLayerRef = useRef<Container | null>(null);
  const pathLayerRef = useRef<Graphics | null>(null);
  const speechLayerRef = useRef<Container | null>(null);
  const viewportRef = useRef<{ scale: number; offsetX: number; offsetY: number } | null>(null);
  const [pixiReadyTick, setPixiReadyTick] = useState(0);
  const resizeRef = useRef<(() => void) | null>(null);
  const drawGridRef = useRef<(() => void) | null>(null);
  const playableCellsRef = useRef<Set<string> | null>(null);
  const gridRef = useRef<{ cols: number; rows: number }>({
    cols: options.grid.cols,
    rows: options.grid.rows
  });
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
  playableCellsRef.current = options.playableCells ?? null;
  gridRef.current = {
    cols: Math.max(1, Math.floor(options.grid.cols)),
    rows: Math.max(1, Math.floor(options.grid.rows))
  };

  useEffect(() => {
    resizeRef.current?.();
  }, [options.zoom, options.panX, options.panY]);

  useEffect(() => {
    drawGridRef.current?.();
    resizeRef.current?.();
  }, [options.playableCells, options.grid.cols, options.grid.rows, pixiReadyTick]);

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
        width: getBoardWidth(gridRef.current.cols),
        height: getBoardHeight(gridRef.current.rows),
        background: BOARD_BACKGROUND_COLOR,
        antialias: true
      });

      initialized = true;

      await preloadTokenTextures();
      await preloadObstacleTextures();

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
          bgSprite.width = getBoardWidth(gridRef.current.cols);
          bgSprite.height = getBoardHeight(gridRef.current.rows);
          root.addChild(bgSprite);
        } catch (error) {
          console.warn("Cannot load board background image:", error);
        }
      }

      const gridLayer = new Graphics();
      root.addChild(gridLayer);

      const drawGrid = () => {
        gridLayer.clear();

        const { cols, rows } = gridRef.current;
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const playable = playableCellsRef.current;
            if (playable && playable.size > 0 && !playable.has(`${gx},${gy}`)) {
              continue;
            }

            const center = gridToScreenForGrid(gx, gy, cols, rows);
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

      drawGridRef.current = drawGrid;
      drawGrid();

      const pathLayer = new Graphics();
      root.addChild(pathLayer);
      pathLayerRef.current = pathLayer;

      const depthLayer = new Container();
      depthLayer.sortableChildren = true;
      root.addChild(depthLayer);
      depthLayerRef.current = depthLayer;

      const speechLayer = new Container();
      root.addChild(speechLayer);
      speechLayerRef.current = speechLayer;

      // Ensure React re-renders once the Pixi layers are ready.
      setPixiReadyTick(tick => tick + 1);

      const resize = () => {
        const parent = options.containerRef.current;
        if (!parent) return;

        const width = Math.max(1, parent.clientWidth);
        const height = Math.max(1, parent.clientHeight);

        app.renderer.resize(width, height);

        const { cols, rows } = gridRef.current;
        const boardW = getBoardWidth(cols);
        const boardH = getBoardHeight(rows);
        const baseScale = Math.min(width / boardW, height / boardH);
        const zoom = zoomRef.current;
        const scale = baseScale * zoom;
        const offsetX = (width - boardW * scale) / 2 + panRef.current.x;
        const offsetY = (height - boardH * scale) / 2 + panRef.current.y;

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
      depthLayerRef.current = null;
      pathLayerRef.current = null;
      speechLayerRef.current = null;
      viewportRef.current = null;
      resizeRef.current = null;
      drawGridRef.current = null;
    };
  }, [options.enabled, options.containerRef]);

  return {
    appRef,
    depthLayerRef,
    pathLayerRef,
    speechLayerRef,
    viewportRef,
    pixiReadyTick
  };
}
