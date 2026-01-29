import { useEffect } from "react";
import { AnimatedSprite, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { RefObject } from "react";
import type { ObstacleInstance, ObstacleTypeDefinition } from "../../game/obstacleTypes";
import { getObstacleOccupiedCells } from "../../game/obstacleRuntime";
import { TILE_SIZE, gridToScreenForGrid } from "../../boardConfig";
import { getObstacleAnimationFrames, getObstaclePngUrl } from "../../obstacleTextureHelper";
import { getTokenOccupiedCells, orientationToRotationDeg } from "../../game/footprint";
import { DEPTH_Z } from "./depthOrdering";

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
  lightAngleDeg?: number;
  suspendRendering?: boolean;
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

  const resolveShadowSpec = (
    def: ObstacleTypeDefinition | null
  ): { alpha: number; lengthPx: number } => {
    const heightClass = String(def?.appearance?.heightClass ?? "medium").toLowerCase();
    const stretchRaw = Number.isFinite(def?.appearance?.shadowStretch)
      ? (def?.appearance?.shadowStretch as number)
      : 1;
    const stretchClamped = Math.min(12, Math.max(0, stretchRaw));
    const lengthPx = Math.max(2, Math.round(stretchClamped * TILE_SIZE));
    if (heightClass === "low") {
      return {
        alpha: 0.22,
        lengthPx
      };
    }
    if (heightClass === "tall") {
      return {
        alpha: 0.36,
        lengthPx
      };
    }
    return {
      alpha: 0.3,
      lengthPx
    };
  };

  const resolveShadowOffset = (heightClass: string, lengthPx: number): number => {
    const base = Math.max(2, Math.round(lengthPx * 0.18));
    if (heightClass === "low") return Math.max(2, Math.round(base * 0.85));
    if (heightClass === "tall") return Math.max(3, Math.round(base * 1.35));
    return base;
  };

  const shadowAnchorCache = new WeakMap<Texture, { x: number; y: number }>();
  const resolveShadowAnchor = (texture: Texture): { x: number; y: number } => {
    const cached = shadowAnchorCache.get(texture);
    if (cached) return cached;

    const fallback = { x: 0.5, y: 1 };
    const source = (texture as any).source?.resource ?? (texture as any).resource ?? null;
    const image =
      source?.source ??
      (source && typeof source.width === "number" && typeof source.height === "number" ? source : null);
    if (!image) {
      shadowAnchorCache.set(texture, fallback);
      return fallback;
    }

    const width = image.width ?? 0;
    const height = image.height ?? 0;
    if (width <= 0 || height <= 0) {
      shadowAnchorCache.set(texture, fallback);
      return fallback;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      shadowAnchorCache.set(texture, fallback);
      return fallback;
    }

    try {
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, width, height).data;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let found = false;
      for (let y = 0; y < height; y++) {
        const row = y * width * 4;
        for (let x = 0; x < width; x++) {
          const alpha = data[row + x * 4 + 3];
          if (alpha > 8) {
            found = true;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!found) {
        shadowAnchorCache.set(texture, fallback);
        return fallback;
      }
      const centerX = (minX + maxX) / 2;
      const bottomY = maxY;
      const anchor = {
        x: width > 1 ? centerX / (width - 1) : 0.5,
        y: height > 1 ? bottomY / (height - 1) : 1
      };
      shadowAnchorCache.set(texture, anchor);
      return anchor;
    } catch {
      shadowAnchorCache.set(texture, fallback);
      return fallback;
    }
  };

  const isCanopyLayer = (layer: { id?: string; spriteKey: string } | null): boolean => {
    if (!layer?.spriteKey) return false;
    const id = String(layer.id ?? "").toLowerCase();
    const key = layer.spriteKey.toLowerCase();
    return id.includes("canopy") || key.includes("canopy");
  };

  const shouldRenderShadowForLayer = (layer: { id?: string; spriteKey: string; renderLayer?: string } | null): boolean => {
    if (!layer?.spriteKey) return false;
    if (layer.renderLayer === "overhead" && !isCanopyLayer(layer)) return false;
    return layer.spriteKey.startsWith("obstacle:");
  };

  const getFootprintGrid = (def: ObstacleTypeDefinition | null): { tilesX: number; tilesY: number } | null => {
    if (!def?.variants?.length) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const variant of def.variants) {
      for (const cell of variant.footprint ?? []) {
        if (cell.x < minX) minX = cell.x;
        if (cell.y < minY) minY = cell.y;
        if (cell.x > maxX) maxX = cell.x;
        if (cell.y > maxY) maxY = cell.y;
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }
    return { tilesX: Math.max(1, Math.round(maxX - minX + 1)), tilesY: Math.max(1, Math.round(maxY - minY + 1)) };
  };

  useEffect(() => {
    const depthLayer = options.depthLayerRef.current;
    if (!depthLayer) return;

    depthLayer.cacheAsTexture = false;
    for (const child of [...depthLayer.children]) {
      if (child.label === "obstacle" || child.label === "obstacle-layer" || child.label === "obstacle-shadow") {
        depthLayer.removeChild(child);
        child.destroy?.();
      }
    }

    if (options.suspendRendering) return;

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

    let hasAnyAnimatedLayer = false;
    for (const obs of options.obstacles) {
      if (obs.hp <= 0) continue;
      const def = typeById.get(obs.typeId) ?? null;
      const isTree = def?.id === "tree-oak";
      const occupied = getObstacleOccupiedCells(obs, def);
      const tint = Number.isFinite(def?.appearance?.tint as number)
        ? (def?.appearance?.tint as number)
        : 0x8e5a2b;
      const center =
        occupied.length > 0
          ? occupied
              .map(cell => gridToScreenForGrid(cell.x, cell.y, options.grid.cols, options.grid.rows))
              .reduce(
                (acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }),
                { x: 0, y: 0 }
              )
          : gridToScreenForGrid(obs.x, obs.y, options.grid.cols, options.grid.rows);
      if (occupied.length > 0) {
        center.x /= occupied.length;
        center.y /= occupied.length;
      }

      const isAnyTokenBelow = occupied.some(cell => tokenOccupied.has(cellKey(cell.x, cell.y)));
      const layers =
        def?.appearance?.layers && def.appearance.layers.length > 0
          ? def.appearance.layers
          : def?.appearance?.spriteKey
            ? [{ spriteKey: def.appearance.spriteKey }]
            : [];
      let treeCanopyVisible = false;
      const paletteKey = String(options.paletteId ?? def?.appearance?.paletteId ?? "default").toLowerCase();
      const forceLeaflessShadow = isTree && (paletteKey === "winter" || paletteKey === "dead" || paletteKey === "leafless");
      if (isTree && layers.length > 0) {
        for (const layer of layers) {
          if (!isCanopyLayer(layer)) continue;
          const visibleRule = layer.visible ?? "always";
          if (visibleRule === "hideWhenTokenBelow" && isAnyTokenBelow) continue;
          const layerKey = layer.id ?? layer.spriteKey;
          const paletteLayer = resolvePaletteLayer(def, layerKey, options.paletteId);
          if (paletteLayer?.visible === false) continue;
          treeCanopyVisible = true;
          break;
        }
      }
      const treeUseLeaflessShadow = forceLeaflessShadow || !treeCanopyVisible;

      let renderedLayers = 0;
      let hasAnimatedLayer = false;
      if (layers.length > 0) {
        const footprintGrid = getFootprintGrid(def);
        const sorted = [...layers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
        for (const layer of sorted) {
          const visibleRule = layer.visible ?? "always";
          if (visibleRule === "hideWhenTokenBelow" && isAnyTokenBelow) {
            continue;
          }
          const isLit = obs.state?.lit !== false;
          const layerId = String(layer.id ?? "").toLowerCase();
          if (
            !isLit &&
            (layerId.includes("flame") ||
              layerId.includes("fire") ||
              layer.spriteKey.toLowerCase().startsWith("effect:"))
          ) {
            continue;
          }
          const layerKey = layer.id ?? layer.spriteKey;
          const paletteLayer = resolvePaletteLayer(def, layerKey, options.paletteId);
          if (paletteLayer?.visible === false) {
            continue;
          }
          const spriteUrl = getObstaclePngUrl(layer.spriteKey);
          const animationFrames = spriteUrl ? null : getObstacleAnimationFrames(layer.spriteKey);
          if (!spriteUrl && (!animationFrames || animationFrames.length === 0)) continue;
          let sprite: Sprite | AnimatedSprite;
          if (animationFrames && animationFrames.length > 0) {
            hasAnimatedLayer = true;
            hasAnyAnimatedLayer = true;
            const textures = animationFrames.map(frame => Texture.from(frame));
            const anim = new AnimatedSprite(textures);
            const speed =
              typeof layer.animationSpeed === "number"
                ? layer.animationSpeed
                : typeof def?.appearance?.animationSpeed === "number"
                  ? def.appearance.animationSpeed
                  : 0.15;
            const loop =
              typeof layer.animationLoop === "boolean"
                ? layer.animationLoop
                : typeof def?.appearance?.animationLoop === "boolean"
                  ? def.appearance.animationLoop
                  : true;
            anim.animationSpeed = speed;
            anim.loop = loop;
            anim.play();
            sprite = anim;
          } else {
            sprite = Sprite.from(spriteUrl as string);
          }
          sprite.anchor.set(0.5, 0.5);
          const orientation = obs.orientation ?? "right";
          sprite.rotation = (orientationToRotationDeg(orientation) * Math.PI) / 180;
          const scaleBase = typeof obs.tokenScale === "number" ? obs.tokenScale / 100 : 1;
          const scaleLayer = typeof layer.scale === "number" ? layer.scale : 1;
          const scaleAppearance = typeof def?.appearance?.scale === "number" ? def.appearance.scale : 1;
          const gridSpec = layer.spriteGrid ?? def?.appearance?.spriteGrid ?? footprintGrid ?? null;
          const preserveAspect =
            typeof layer.preserveAspect === "boolean"
              ? layer.preserveAspect
              : Boolean(def?.appearance?.preserveAspect);
          const tileSize =
            gridSpec && typeof gridSpec.tileSize === "number" && gridSpec.tileSize > 0
              ? gridSpec.tileSize
              : TILE_SIZE;
          if (gridSpec && sprite.texture.width > 0 && sprite.texture.height > 0) {
            const targetW = gridSpec.tilesX * tileSize;
            const targetH = gridSpec.tilesY * tileSize;
            const scaleX = targetW / sprite.texture.width;
            const scaleY = targetH / sprite.texture.height;
            const scale = preserveAspect ? Math.min(scaleX, scaleY) : null;
            if (scale) {
              sprite.scale.set(scale * scaleBase * scaleLayer * scaleAppearance);
            } else {
              sprite.scale.set(
                scaleX * scaleBase * scaleLayer * scaleAppearance,
                scaleY * scaleBase * scaleLayer * scaleAppearance
              );
            }
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
          sprite.label = "obstacle-layer";
          const baseLayer = layer.renderLayer === "overhead" ? DEPTH_Z.overhead : DEPTH_Z.obstacleBase;
          sprite.zIndex = center.y + baseLayer + (layer.z ?? 0);

          if (!hasAnimatedLayer && shouldRenderShadowForLayer(layer)) {
            if (def?.id === "brazier" && isLit) {
              depthLayer.addChild(sprite);
              renderedLayers += 1;
              continue;
            }
            const shadowSpec = resolveShadowSpec(def);
            const shadowMode = def?.appearance?.shadowMode ?? "default";
            const useTreeShadow =
              isTree && (isCanopyLayer(layer) || String(layer.id ?? "").toLowerCase().includes("trunk"));
            let shadowTexture = sprite.texture;
            if (useTreeShadow) {
              const key = treeUseLeaflessShadow
                ? def?.appearance?.shadowSpriteLeafless ?? "obstacle:tree-oak-trunk-shadow"
                : def?.appearance?.shadowSpriteLeafy ?? "obstacle:tree-oak-canopy-shadow";
              const url = getObstaclePngUrl(key);
              if (url) shadowTexture = Texture.from(url);
            }
            if (useTreeShadow) {
              if (!treeUseLeaflessShadow && !isCanopyLayer(layer)) {
                // Only render one shadow for leafy trees (use canopy layer).
                depthLayer.addChild(sprite);
                renderedLayers += 1;
                continue;
              }
              if (treeUseLeaflessShadow && isCanopyLayer(layer)) {
                // Leafless trees use trunk shadow only.
                depthLayer.addChild(sprite);
                renderedLayers += 1;
                continue;
              }
            }
            const shadow = new Sprite(shadowTexture);
            const shadowGroup = new Container();
            const lightAngleDeg = typeof options.lightAngleDeg === "number" ? options.lightAngleDeg : 90;
            const lightAngle = (lightAngleDeg * Math.PI) / 180;
            const shadowAngle = shadowMode === "tall" ? lightAngle + Math.PI : lightAngle;
            shadowGroup.x = center.x;
            shadowGroup.y = center.y;
            shadowGroup.rotation = shadowAngle;
            shadow.anchor.set(0.5, 0.5);
            // In tall mode, ignore obstacle orientation so all shadows project uniformly.
            shadow.rotation = shadowMode === "tall" ? 0 : sprite.rotation - lightAngle;
            const gridBaseWidth =
              gridSpec && Number.isFinite(gridSpec.tilesX)
                ? gridSpec.tilesX * tileSize * scaleBase * scaleLayer * scaleAppearance
                : 0;
            const gridBaseHeight =
              gridSpec && Number.isFinite(gridSpec.tilesY)
                ? gridSpec.tilesY * tileSize * scaleBase * scaleLayer * scaleAppearance
                : 0;
            const baseWidth =
              gridBaseWidth > 0
                ? gridBaseWidth
                : sprite.width > 0
                  ? sprite.width
                  : shadow.texture.width > 0
                    ? shadow.texture.width * sprite.scale.x
                    : 0;
            const baseHeight =
              gridBaseHeight > 0
                ? gridBaseHeight
                : sprite.height > 0
                  ? sprite.height
                  : shadow.texture.height > 0
                    ? shadow.texture.height * sprite.scale.y
                    : 0;
            const heightClass = String(def?.appearance?.heightClass ?? "medium").toLowerCase();
            if (shadowMode === "tall") {
              const anchor = resolveShadowAnchor(shadowTexture);
              shadow.anchor.set(anchor.x, anchor.y);
            }
            if (baseWidth > 0 && baseHeight > 0) {
              shadow.width = baseWidth;
              shadow.height = baseHeight;
              const sizeFactor = Math.max(1, baseHeight / TILE_SIZE);
              const desiredLength = shadowSpec.lengthPx * sizeFactor;
              shadowGroup.scale.y = desiredLength / baseHeight;
            } else {
              shadow.scale.set(sprite.scale.x, sprite.scale.y);
              shadowGroup.scale.y = 1;
            }
            const offsetPx = shadowMode === "tall" ? 0 : resolveShadowOffset(heightClass, shadowSpec.lengthPx);
            shadow.x = 0;
            shadow.y = offsetPx;
            const alphaScale = isCanopyLayer(layer) ? 1 : Number.isFinite(alpha) ? alpha : 1;
            shadow.alpha = Math.max(0.05, Math.min(0.55, shadowSpec.alpha * alphaScale));
            shadow.tint = 0x000000;
            shadow.label = "obstacle-shadow";
            shadowGroup.label = "obstacle-shadow";
            shadowGroup.zIndex = center.y + baseLayer + (layer.z ?? 0) - 2;
            shadowGroup.addChild(shadow);
            depthLayer.addChild(shadowGroup);
          }

          depthLayer.addChild(sprite);
          renderedLayers += 1;
        }
      }

      if (renderedLayers === 0) {
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
          g.label = "obstacle-layer";
          g.zIndex = center.y + DEPTH_Z.obstacleBase;
          depthLayer.addChild(g);
        }
      }
    }
    if (!hasAnyAnimatedLayer) {
      depthLayer.cacheAsTexture = true;
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
    options.showAllLevels,
    options.lightAngleDeg
  ]);
}
