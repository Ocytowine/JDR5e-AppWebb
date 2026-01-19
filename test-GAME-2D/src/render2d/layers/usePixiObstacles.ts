import { useEffect } from "react";
import { Container, Graphics, Sprite } from "pixi.js";
import type { RefObject } from "react";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../../game/obstacleTypes";
import { getObstacleOccupiedCells } from "../../game/obstacleRuntime";
import { TILE_SIZE, gridToScreenForGrid } from "../../boardConfig";
import { getObstaclePngUrl } from "../../obstacleTextureHelper";
import { getTokenOccupiedCells, orientationToRotationDeg } from "../../game/footprint";

export function usePixiObstacles(options: {
  depthLayerRef: RefObject<Container | null>;
  obstacles: ObstacleInstance[];
  obstacleTypes: ObstacleTypeDefinition[];
  tokens?: Array<{ id: string; type: "player" | "enemy"; x: number; y: number; hp: number }>;
  pixiReadyTick?: number;
  grid: { cols: number; rows: number };
  heightMap: number[];
  activeLevel: number;
  visibleCells?: Set<string> | null;
  showAllLevels?: boolean;
  paletteId?: string | null;
}): void {
  const hashString01 = (input: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 0xffffffff;
  };

  const lerpColor = (a: number, b: number, t: number): number => {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);
    return (rr << 16) | (rg << 8) | rb;
  };

  const resolvePaletteLayer = (
    def: ObstacleTypeDefinition | null,
    layerKey: string,
    paletteId: string | null | undefined
  ): { tint?: number; tintRange?: { dark: number; light: number }; alpha?: number; visible?: boolean } | null => {
    const appearance = def?.appearance;
    if (!appearance?.palettes) return null;
    const resolvedId = paletteId ?? appearance.paletteId ?? "default";
    const palette = appearance.palettes[resolvedId] ?? appearance.palettes[appearance.paletteId ?? "default"] ?? null;
    if (!palette?.layers) return null;
    return palette.layers[layerKey] ?? null;
  };

  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    for (const child of [...depthLayer.children]) {
      if (child.label === "obstacle") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    const typeById = new Map<string, ObstacleTypeDefinition>();
    for (const t of options.obstacleTypes) typeById.set(t.id, t);

    const visibleCells = options.visibleCells ?? null;
    const showAll = Boolean(options.showAllLevels);
    const cellKey = (x: number, y: number) => `${x},${y}`;
    const tokens = Array.isArray(options.tokens) ? options.tokens : [];
    const tokenOccupied = new Set<string>();
    for (const token of tokens) {
      if (token.hp <= 0) continue;
      for (const cell of getTokenOccupiedCells(token)) {
        tokenOccupied.add(cellKey(cell.x, cell.y));
      }
    }

    for (const obs of options.obstacles) {
      if (obs.hp <= 0) continue;
      const def = typeById.get(obs.typeId) ?? null;
      const occupied = getObstacleOccupiedCells(obs, def);
      const tint = Number.isFinite(def?.appearance?.tint as number)
        ? (def?.appearance?.tint as number)
        : 0x8e5a2b;
      const container = new Container();

      const isAnyTokenBelow = occupied.some(cell => tokenOccupied.has(cellKey(cell.x, cell.y)));
      const layers =
        def?.appearance?.layers && def.appearance.layers.length > 0
          ? def.appearance.layers
          : def?.appearance?.spriteKey
            ? [{ spriteKey: def.appearance.spriteKey }]
            : [];

      if (layers.length > 0) {
        const sorted = [...layers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
        for (const layer of sorted) {
          const visibleRule = layer.visible ?? "always";
          if (visibleRule === "hideWhenTokenBelow" && isAnyTokenBelow) {
            continue;
          }
          const layerKey = layer.id ?? layer.spriteKey;
          const paletteLayer = resolvePaletteLayer(def, layerKey, options.paletteId);
          if (paletteLayer?.visible === false) {
            continue;
          }
          const spriteUrl = getObstaclePngUrl(layer.spriteKey);
          if (!spriteUrl) continue;
          const center = gridToScreenForGrid(obs.x, obs.y, options.grid.cols, options.grid.rows);
          const sprite = Sprite.from(spriteUrl);
          sprite.anchor.set(0.5, 0.5);
          const orientation = obs.orientation ?? "right";
          sprite.rotation = (orientationToRotationDeg(orientation) * Math.PI) / 180;
          const scaleBase = typeof obs.tokenScale === "number" ? obs.tokenScale / 100 : 1;
          const scaleLayer = typeof layer.scale === "number" ? layer.scale : 1;
          const scaleAppearance = typeof def?.appearance?.scale === "number" ? def.appearance.scale : 1;
          const gridSpec = layer.spriteGrid ?? def?.appearance?.spriteGrid ?? null;
          if (gridSpec && sprite.texture.width > 0 && sprite.texture.height > 0) {
            const targetW = gridSpec.tilesX * TILE_SIZE;
            const targetH = gridSpec.tilesY * TILE_SIZE;
            const scaleX = targetW / sprite.texture.width;
            const scaleY = targetH / sprite.texture.height;
            sprite.scale.set(scaleX * scaleBase * scaleLayer * scaleAppearance, scaleY * scaleBase * scaleLayer * scaleAppearance);
          } else {
            sprite.scale.set(scaleBase * scaleLayer * scaleAppearance);
          }
          const alpha =
            typeof paletteLayer?.alpha === "number"
              ? paletteLayer.alpha
              : typeof layer.alpha === "number"
                ? layer.alpha
                : 1;
          sprite.alpha = alpha;
          let tint: number | null = null;
          if (Number.isFinite(paletteLayer?.tint as number)) {
            tint = paletteLayer?.tint as number;
          } else if (paletteLayer?.tintRange) {
            const seed = `${obs.id}:${layerKey}:${options.paletteId ?? def?.appearance?.paletteId ?? "default"}`;
            const t = hashString01(seed);
            tint = lerpColor(paletteLayer.tintRange.dark, paletteLayer.tintRange.light, t);
          } else if (Number.isFinite(layer.tint as number)) {
            tint = layer.tint as number;
          } else if (Number.isFinite(def?.appearance?.tint as number)) {
            tint = def?.appearance?.tint as number;
          }
          sprite.tint = tint ?? 0xffffff;
          sprite.x = center.x;
          sprite.y = center.y;
          container.addChild(sprite);
        }
      }

      if (container.children.length === 0) {
        for (const cell of occupied) {
          const key = cellKey(cell.x, cell.y);
          const isVisible = showAll || (visibleCells?.has(key) ?? true);
          if (!isVisible) continue;
          const center = gridToScreenForGrid(cell.x, cell.y, options.grid.cols, options.grid.rows);
          const size = TILE_SIZE * 0.9;
          const x = center.x - size / 2;
          const y = center.y - size / 2;
          const g = new Graphics();
          g.rect(x, y, size, size).fill({
            color: tint,
            alpha: 0.85
          });
          container.addChild(g);
        }
      }

      if (container.children.length > 0) {
        container.label = "obstacle";
        depthLayer.addChild(container);
      }
    }
  }, [
    options.depthLayerRef,
    options.obstacles,
    options.obstacleTypes,
    options.tokens,
    options.pixiReadyTick,
    options.grid,
    options.heightMap,
    options.activeLevel,
    options.visibleCells,
    options.showAllLevels
  ]);
}
