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
} from "../../boardConfig";
import type { TerrainCell } from "../../game/map/draft";

function hash01(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = (h ^ (h >> 16)) >>> 0;
  return (h % 1000) / 1000;
}

function scaleColor(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

function drawWoodPlankTile(params: {
  g: Graphics;
  x: number;
  y: number;
  baseColor: number;
  seedX: number;
  seedY: number;
}): void {
  const { g, x, y, baseColor, seedX, seedY } = params;
  const lineColor = scaleColor(baseColor, 0.72);
  const highlightColor = scaleColor(baseColor, 1.08);
  const horizontal = hash01(seedX, seedY) > 0.5;
  const lines = 3;
  const spacing = TILE_SIZE / (lines + 1);
  for (let i = 1; i <= lines; i++) {
    const jitter = (hash01(seedX + i * 11, seedY + i * 7) - 0.5) * 2;
    const offset = Math.round(spacing * i + jitter * 1.2);
    if (horizontal) {
      const yPos = y + offset;
      g.moveTo(x + 1, yPos);
      g.lineTo(x + TILE_SIZE - 1, yPos);
      g.stroke({ color: lineColor, alpha: 0.35, width: 1 });
    } else {
      const xPos = x + offset;
      g.moveTo(xPos, y + 1);
      g.lineTo(xPos, y + TILE_SIZE - 1);
      g.stroke({ color: lineColor, alpha: 0.35, width: 1 });
    }
  }
  const knotX = x + Math.round(TILE_SIZE * (0.25 + hash01(seedX + 3, seedY + 9) * 0.5));
  const knotY = y + Math.round(TILE_SIZE * (0.25 + hash01(seedX + 5, seedY + 1) * 0.5));
  g.circle(knotX, knotY, 1.3).fill({ color: highlightColor, alpha: 0.25 });
}

const TERRAIN_COLORS: Record<TerrainCell, { base: number; alt: number }> = {
  grass: { base: 0x2f6b2f, alt: 0x3a7a3a },
  dirt: { base: 0x6a4b2a, alt: 0x7a5a35 },
  stone: { base: 0x666666, alt: 0x585858 },
  water: { base: 0x2b4f8c, alt: 0x315b9c },
  road: { base: 0x5a4e3b, alt: 0x6a5a45 },
  floor: { base: 0x3a3a3a, alt: 0x454545 },
  unknown: { base: 0x1d1d30, alt: 0x151522 }
};

export function usePixiBoard(options: {
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  zoom?: number;
  panX?: number;
  panY?: number;
  backgroundColor?: number;
  playableCells?: Set<string> | null;
  terrain?: TerrainCell[] | null;
  grid: { cols: number; rows: number };
}): {
  appRef: RefObject<Application | null>;
  depthLayerRef: RefObject<Container | null>;
  pathLayerRef: RefObject<Graphics | null>;
  speechLayerRef: RefObject<Container | null>;
  labelLayerRef: RefObject<Container | null>;
  viewportRef: RefObject<{ scale: number; offsetX: number; offsetY: number } | null>;
  pixiReadyTick: number;
} {
  const appRef = useRef<Application | null>(null);
  const depthLayerRef = useRef<Container | null>(null);
  const pathLayerRef = useRef<Graphics | null>(null);
  const speechLayerRef = useRef<Container | null>(null);
  const labelLayerRef = useRef<Container | null>(null);
  const viewportRef = useRef<{ scale: number; offsetX: number; offsetY: number } | null>(null);
  const [pixiReadyTick, setPixiReadyTick] = useState(0);
  const resizeRef = useRef<(() => void) | null>(null);
  const drawGridRef = useRef<(() => void) | null>(null);
  const playableCellsRef = useRef<Set<string> | null>(null);
  const terrainRef = useRef<TerrainCell[] | null>(null);
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
  terrainRef.current = Array.isArray(options.terrain) ? options.terrain : null;
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
  }, [options.playableCells, options.terrain, options.grid.cols, options.grid.rows, pixiReadyTick]);

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
      const backgroundColor =
        typeof options.backgroundColor === "number"
          ? options.backgroundColor
          : BOARD_BACKGROUND_COLOR;

      await app.init({
        width: getBoardWidth(gridRef.current.cols),
        height: getBoardHeight(gridRef.current.rows),
        background: backgroundColor,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true
      });

      initialized = true;

      if (destroyed) return;

      const container = options.containerRef.current;
      if (!container) return;

      container.prepend(app.canvas);

      const root = new Container();
      root.sortableChildren = true;
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
        const terrain = terrainRef.current;
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const playable = playableCellsRef.current;
            if (playable && playable.size > 0 && !playable.has(`${gx},${gy}`)) {
              continue;
            }

            const terrainIndex = gy * cols + gx;
            const cellTerrain =
              terrain && terrainIndex >= 0 && terrainIndex < terrain.length
                ? (terrain[terrainIndex] as TerrainCell)
                : "unknown";
            const colors = TERRAIN_COLORS[cellTerrain] ?? TERRAIN_COLORS.unknown;
            const noise = hash01(gx, gy);
            const baseColor = noise > 0.5 ? colors.base : colors.alt;
            const variance = 1 + (noise - 0.5) * 0.18;
            const tileColor = scaleColor(baseColor, variance);

            const center = gridToScreenForGrid(gx, gy, cols, rows);
            const x = center.x - TILE_SIZE / 2;
            const y = center.y - TILE_SIZE / 2;
            gridLayer.rect(x, y, TILE_SIZE, TILE_SIZE).fill({
              color: tileColor,
              alpha: 1
            });
            if (cellTerrain === "floor") {
              drawWoodPlankTile({
                g: gridLayer,
                x,
                y,
                baseColor: tileColor,
                seedX: gx,
                seedY: gy
              });
            }
          }
        }
      };

      drawGridRef.current = drawGrid;
      drawGrid();

      const pathLayer = new Graphics();
      root.addChild(pathLayer);
      pathLayerRef.current = pathLayer;

      const labelLayer = new Container();
      root.addChild(labelLayer);
      labelLayerRef.current = labelLayer;

      const depthLayer = new Container();
      root.addChild(depthLayer);
      depthLayerRef.current = depthLayer;

      const speechLayer = new Container();
      root.addChild(speechLayer);
      speechLayerRef.current = speechLayer;

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
      labelLayerRef.current = null;
      viewportRef.current = null;
      resizeRef.current = null;
      drawGridRef.current = null;
    };
  }, [options.enabled, options.containerRef]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !app.renderer || !app.renderer.background) return;
    app.renderer.background.color =
      typeof options.backgroundColor === "number"
        ? options.backgroundColor
        : BOARD_BACKGROUND_COLOR;
  }, [options.backgroundColor]);

  return {
    appRef,
    depthLayerRef,
    pathLayerRef,
    speechLayerRef,
    labelLayerRef,
    viewportRef,
    pixiReadyTick
  };
}
