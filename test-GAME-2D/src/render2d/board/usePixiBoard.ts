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
import type { TerrainCell } from "../../game/map/generation/draft";
import type { TerrainMixCell } from "../../game/map/generation/terrainMix";
import { getFloorMaterial } from "../../game/map/floors/catalog";

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

function parseHexColor(hex: string | null | undefined): number | null {
  if (!hex) return null;
  const cleaned = hex.trim().replace("#", "");
  if (!cleaned) return null;
  const value = Number.parseInt(cleaned, 16);
  return Number.isFinite(value) ? value : null;
}

function resolveFloorColors(floorId: string): { base: number; alt: number; textureId?: string } {
  const material = getFloorMaterial(floorId) ?? getFloorMaterial("unknown");
  const baseColor = parseHexColor(material?.fallbackColor) ?? 0x1d1d30;
  const altColor = scaleColor(baseColor, 1.08);
  return { base: baseColor, alt: altColor, textureId: material?.textureId };
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

export function usePixiBoard(options: {
  enabled: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  zoom?: number;
  panX?: number;
  panY?: number;
  backgroundColor?: number;
  playableCells?: Set<string> | null;
  terrain?: TerrainCell[] | null;
  terrainMix?: Array<TerrainMixCell | null> | null;
  grid: { cols: number; rows: number };
  animate?: boolean;
  maxFps?: number;
  renderTick?: number;
}): {
  appRef: RefObject<Application | null>;
  staticDepthLayerRef: RefObject<Container | null>;
  dynamicDepthLayerRef: RefObject<Container | null>;
  pathLayerRef: RefObject<Graphics | null>;
  terrainNaturalLayerRef: RefObject<Container | null>;
  terrainFxLayerRef: RefObject<Graphics | null>;
  terrainLabelLayerRef: RefObject<Container | null>;
  speechLayerRef: RefObject<Container | null>;
  labelLayerRef: RefObject<Container | null>;
  viewportRef: RefObject<{ scale: number; offsetX: number; offsetY: number } | null>;
  pixiReadyTick: number;
} {
  const appRef = useRef<Application | null>(null);
  const staticDepthLayerRef = useRef<Container | null>(null);
  const dynamicDepthLayerRef = useRef<Container | null>(null);
  const pathLayerRef = useRef<Graphics | null>(null);
  const terrainNaturalLayerRef = useRef<Container | null>(null);
  const terrainFxLayerRef = useRef<Graphics | null>(null);
  const terrainLabelLayerRef = useRef<Container | null>(null);
  const speechLayerRef = useRef<Container | null>(null);
  const labelLayerRef = useRef<Container | null>(null);
  const viewportRef = useRef<{ scale: number; offsetX: number; offsetY: number } | null>(null);
  const [pixiReadyTick, setPixiReadyTick] = useState(0);
  const resizeRef = useRef<(() => void) | null>(null);
  const drawGridRef = useRef<(() => void) | null>(null);
  const animateRef = useRef<boolean>(options.animate ?? true);
  const appReadyRef = useRef<boolean>(false);
  const playableCellsRef = useRef<Set<string> | null>(null);
  const terrainRef = useRef<TerrainCell[] | null>(null);
  const terrainMixRef = useRef<Array<TerrainMixCell | null> | null>(null);
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
  animateRef.current = options.animate ?? true;
  playableCellsRef.current = options.playableCells ?? null;
  terrainRef.current = Array.isArray(options.terrain) ? options.terrain : null;
  terrainMixRef.current = Array.isArray(options.terrainMix) ? options.terrainMix : null;
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
  }, [
    options.playableCells,
    options.terrain,
    options.terrainMix,
    options.grid.cols,
    options.grid.rows,
    pixiReadyTick
  ]);

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
        preference: "webgl",
        resolution: window.devicePixelRatio,
        autoDensity: true
      });

      initialized = true;
      appReadyRef.current = true;

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
        gridLayer.cacheAsTexture = false;
        gridLayer.clear();

        const { cols, rows } = gridRef.current;
        const terrain = terrainRef.current;
        const terrainMix = terrainMixRef.current;
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
            const floorColors = resolveFloorColors(cellTerrain);
            const tileColor = floorColors.base;

            const center = gridToScreenForGrid(gx, gy, cols, rows);
            const x = center.x - TILE_SIZE / 2;
            const y = center.y - TILE_SIZE / 2;
            gridLayer.rect(x, y, TILE_SIZE, TILE_SIZE).fill({
              color: tileColor,
              alpha: 1
            });
            const mix = terrainMix ? terrainMix[terrainIndex] ?? null : null;
            if (mix) {
              const blendColor = resolveFloorColors(mix.blend).base;
              const left = x;
              const top = y;
              const right = x + TILE_SIZE;
              const bottom = y + TILE_SIZE;
              if (mix.corner === "NE") {
                gridLayer.moveTo(left, top);
                gridLayer.lineTo(right, top);
                gridLayer.lineTo(right, bottom);
              } else if (mix.corner === "SW") {
                gridLayer.moveTo(left, top);
                gridLayer.lineTo(right, bottom);
                gridLayer.lineTo(left, bottom);
              } else if (mix.corner === "NW") {
                gridLayer.moveTo(left, top);
                gridLayer.lineTo(right, top);
                gridLayer.lineTo(left, bottom);
              } else {
                gridLayer.moveTo(right, top);
                gridLayer.lineTo(right, bottom);
                gridLayer.lineTo(left, bottom);
              }
              gridLayer.closePath();
              gridLayer.fill({ color: blendColor, alpha: 1 });
            }
          }
        }
        gridLayer.cacheAsTexture = true;
      };

      drawGridRef.current = drawGrid;
      drawGrid();

      const terrainNaturalLayer = new Container();
      terrainNaturalLayer.label = "terrainNaturalLayer";
      root.addChild(terrainNaturalLayer);
      terrainNaturalLayerRef.current = terrainNaturalLayer;

      const terrainFxLayer = new Graphics();
      terrainFxLayer.label = "terrainFxLayer";
      root.addChild(terrainFxLayer);
      terrainFxLayerRef.current = terrainFxLayer;

      const terrainLabelLayer = new Container();
      terrainLabelLayer.label = "terrainLabelLayer";
      root.addChild(terrainLabelLayer);
      terrainLabelLayerRef.current = terrainLabelLayer;

      const pathLayer = new Graphics();
      pathLayer.label = "pathLayer";
      root.addChild(pathLayer);
      pathLayerRef.current = pathLayer;

      const labelLayer = new Container();
      labelLayer.label = "labelLayer";
      root.addChild(labelLayer);
      labelLayerRef.current = labelLayer;

      const staticDepthLayer = new Container();
      staticDepthLayer.label = "staticDepthLayer";
      staticDepthLayer.sortableChildren = true;
      root.addChild(staticDepthLayer);
      staticDepthLayerRef.current = staticDepthLayer;

      const dynamicDepthLayer = new Container();
      dynamicDepthLayer.label = "dynamicDepthLayer";
      dynamicDepthLayer.sortableChildren = true;
      root.addChild(dynamicDepthLayer);
      dynamicDepthLayerRef.current = dynamicDepthLayer;

      const speechLayer = new Container();
      speechLayer.name = "speechLayer";
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
        if (!animateRef.current) {
          app.render();
        }
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
      appReadyRef.current = false;
      if (resizeObserver) resizeObserver.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      if (initialized && appRef.current) {
        appRef.current.destroy(true);
      }
      appRef.current = null;
      staticDepthLayerRef.current = null;
      dynamicDepthLayerRef.current = null;
      pathLayerRef.current = null;
      terrainNaturalLayerRef.current = null;
      terrainFxLayerRef.current = null;
      terrainLabelLayerRef.current = null;
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

  useEffect(() => {
    const app = appRef.current;
    if (!app || !app.ticker || !appReadyRef.current) return;
    const animate = options.animate ?? true;
    const maxFps = typeof options.maxFps === "number" ? options.maxFps : 0;
    app.ticker.maxFPS = maxFps > 0 ? maxFps : 0;
    if (animate) {
      if (!app.ticker.started) app.ticker.start();
    } else {
      if (app.ticker.started) app.ticker.stop();
      app.render();
    }
  }, [options.animate, options.maxFps, pixiReadyTick]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !appReadyRef.current) return;
    if (options.animate ?? true) return;
    if (typeof options.renderTick !== "number") return;
    app.render();
  }, [options.renderTick, options.animate]);

  return {
    appRef,
    staticDepthLayerRef,
    dynamicDepthLayerRef,
    pathLayerRef,
    terrainNaturalLayerRef,
    terrainFxLayerRef,
    terrainLabelLayerRef,
    speechLayerRef,
    labelLayerRef,
    viewportRef,
    pixiReadyTick
  };
}

