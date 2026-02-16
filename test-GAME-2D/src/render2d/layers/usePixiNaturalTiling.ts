import { useEffect, useMemo, useState } from "react";
import { Assets, Container, Filter, GlProgram, Sprite, TilingSprite, Texture, UniformGroup } from "pixi.js";
import type { RefObject } from "react";
import { TILE_SIZE, getBoardHeight, getBoardWidth } from "../../boardConfig";
import type { TerrainCell } from "../../game/map/generation/draft";
import type { TerrainMixCell } from "../../game/map/generation/terrainMix";
import type { FloorMaterial } from "../../game/map/floors/types";
import {
  getFloorBumpTexture,
  getFloorBumpUrl,
  getFloorTilingTextureFromUrl,
  getFloorTilingUrl,
  getFloorTilingVariantUrls,
  preloadFloorTilingTexturesFor
} from "../../floorTilingHelper";

type Edge = "N" | "S" | "W" | "E";
type Point = { x: number; y: number };
type Segment = { a: Point; b: Point };

const DEFAULT_FILTER_VERT = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

function hash01(x: number, y: number, seed: number): number {
  const n = x * 374761393 + y * 668265263 + seed * 1442695041;
  let h = (n ^ (n >> 13)) * 1274126177;
  h = (h ^ (h >> 16)) >>> 0;
  return (h % 1000) / 1000;
}

function hasNaturalTag(tags?: string[]): boolean {
  if (!tags || tags.length === 0) return false;
  return tags.includes("nature") || tags.includes("natural");
}

function parseHexColor(hex: string | null | undefined): number | null {
  if (!hex) return null;
  const cleaned = hex.trim().replace("#", "");
  if (!cleaned) return null;
  const value = Number.parseInt(cleaned, 16);
  return Number.isFinite(value) ? value : null;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isSamePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

function smoothClosedLoop(points: Point[], iterations: number): Point[] {
  if (points.length < 3 || iterations <= 0) return points;
  let result = points;
  for (let i = 0; i < iterations; i++) {
    const next: Point[] = [];
    for (let j = 0; j < result.length; j++) {
      const p0 = result[j];
      const p1 = result[(j + 1) % result.length];
      next.push({ x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 });
      next.push({ x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 });
    }
    result = next;
  }
  return result;
}

function displaceLoop(points: Point[], iterations: number, amplitude: number, seed: number): Point[] {
  if (points.length < 3 || iterations <= 0 || amplitude <= 0) return points;
  let result = points;
  for (let i = 0; i < iterations; i++) {
    const next: Point[] = [];
    for (let j = 0; j < result.length; j++) {
      const p0 = result[j];
      const p1 = result[(j + 1) % result.length];
      const mx = (p0.x + p1.x) * 0.5;
      const my = (p0.y + p1.y) * 0.5;
      const jitterX = (hash01(Math.round(mx * 100), Math.round(my * 100), seed) - 0.5) * 2 * amplitude;
      const jitterY = (hash01(Math.round(mx * 100), Math.round(my * 100), seed + 17) - 0.5) * 2 * amplitude;
      next.push(p0);
      next.push({ x: mx + jitterX, y: my + jitterY });
    }
    result = next;
  }
  return result;
}

function buildLoopsFromSegments(segments: Segment[]): Point[][] {
  const loops: Point[][] = [];
  const used = new Array<boolean>(segments.length).fill(false);
  const byPoint = new Map<string, number[]>();

  segments.forEach((seg, index) => {
    const aKey = pointKey(seg.a);
    const bKey = pointKey(seg.b);
    const listA = byPoint.get(aKey);
    if (listA) listA.push(index);
    else byPoint.set(aKey, [index]);
    const listB = byPoint.get(bKey);
    if (listB) listB.push(index);
    else byPoint.set(bKey, [index]);
  });

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const seg = segments[i];
    const points: Point[] = [seg.a, seg.b];
    let current = seg.b;
    let previous = seg.a;

    while (true) {
      const candidates = byPoint.get(pointKey(current)) ?? [];
      const nextIndex = candidates.find(index => !used[index]);
      if (nextIndex === undefined) break;
      used[nextIndex] = true;
      const nextSeg = segments[nextIndex];
      const nextPoint = isSamePoint(nextSeg.a, current) ? nextSeg.b : nextSeg.a;
      if (isSamePoint(nextPoint, previous)) break;
      points.push(nextPoint);
      previous = current;
      current = nextPoint;
      if (isSamePoint(current, points[0])) break;
    }

    if (points.length >= 3) {
      if (!isSamePoint(points[0], points[points.length - 1])) {
        points.push(points[0]);
      }
      loops.push(points.slice(0, points.length - 1));
    }
  }

  return loops;
}

function canvasBlendTriangle(
  ctx: CanvasRenderingContext2D,
  corner: TerrainMixCell["corner"],
  left: number,
  top: number,
  right: number,
  bottom: number
): void {
  ctx.beginPath();
  if (corner === "NE") {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, bottom);
  } else if (corner === "NW") {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(left, bottom);
  } else if (corner === "SE") {
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
  } else {
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
  }
  ctx.closePath();
  ctx.fill();
}

function canvasBaseTriangle(
  ctx: CanvasRenderingContext2D,
  corner: TerrainMixCell["corner"],
  left: number,
  top: number,
  right: number,
  bottom: number
): void {
  ctx.beginPath();
  if (corner === "NE") {
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
  } else if (corner === "NW") {
    ctx.moveTo(right, top);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
  } else if (corner === "SE") {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(left, bottom);
  } else {
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.lineTo(right, bottom);
  }
  ctx.closePath();
  ctx.fill();
}

export function usePixiNaturalTiling(options: {
  layerRef: RefObject<Container | null>;
  terrain?: TerrainCell[] | null;
  terrainMix?: Array<TerrainMixCell | null> | null;
  playableCells?: Set<string> | null;
  grid: { cols: number; rows: number };
  materials: Map<string, FloorMaterial>;
  lightLevels?: number[] | null;
  lightMap?: number[] | null;
  bumpIntensity?: number;
  windSpeed?: number;
  windStrength?: number;
  bumpDebug?: boolean;
  pixiReadyTick?: number;
  onInvalidate?: () => void;
}): void {
  const [readyTick, setReadyTick] = useState(0);
  const texturedIds = useMemo(() => {
    const list: string[] = [];
    for (const mat of options.materials.values()) {
      if (getFloorTilingUrl(mat.id) || getFloorBumpUrl(mat.id)) list.push(mat.id);
    }
    list.sort();
    return list;
  }, [options.materials]);
  const naturalIds = useMemo(() => {
    const list: string[] = [];
    for (const mat of options.materials.values()) {
      if (hasNaturalTag(mat.tags)) list.push(mat.id);
    }
    list.sort();
    return list;
  }, [options.materials]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await preloadFloorTilingTexturesFor(texturedIds, 256);
        if (!cancelled) setReadyTick(t => t + 1);
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to preload floor tiling textures:", error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [texturedIds.join("|")]);

  useEffect(() => {
    const layer = options.layerRef.current;
    if (!layer) return;

    const removed = layer.removeChildren();
    for (const child of removed) {
      child.destroy();
    }

    const terrain = Array.isArray(options.terrain) ? options.terrain : null;
    if (!terrain || terrain.length === 0) return;

    const terrainMix = Array.isArray(options.terrainMix) ? options.terrainMix : null;
    const playable = options.playableCells ?? null;
    const { cols, rows } = options.grid;
    const boardW = getBoardWidth(cols);
    const boardH = getBoardHeight(rows);

    const isPlayable = (x: number, y: number): boolean => {
      if (!playable || playable.size === 0) return true;
      return playable.has(`${x},${y}`);
    };
    const getTerrainAt = (x: number, y: number): TerrainCell => {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return "unknown";
      const index = y * cols + x;
      return terrain[index] ?? "unknown";
    };
    const getMixAt = (x: number, y: number): TerrainMixCell | null => {
      if (!terrainMix) return null;
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
      return terrainMix[y * cols + x] ?? null;
    };
    const getEdgeTerrain = (x: number, y: number, edge: Edge): TerrainCell | null => {
      if (!isPlayable(x, y)) return null;
      const base = getTerrainAt(x, y);
      const mix = getMixAt(x, y);
      if (!mix) return base;
      const blend = mix.blend;
      if (mix.corner === "NE") {
        return edge === "N" || edge === "E" ? blend : base;
      }
      if (mix.corner === "NW") {
        return edge === "N" || edge === "W" ? blend : base;
      }
      if (mix.corner === "SE") {
        return edge === "S" || edge === "E" ? blend : base;
      }
      return edge === "S" || edge === "W" ? blend : base;
    };
    const collectBoundarySegments = (id: string): Segment[] => {
      const segments: Segment[] = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!isPlayable(x, y)) continue;
          const mix = getMixAt(x, y);
          const left = x;
          const top = y;
          const right = x + 1;
          const bottom = y + 1;

          const northEdge = getEdgeTerrain(x, y, "N");
          const southEdge = getEdgeTerrain(x, y, "S");
          const westEdge = getEdgeTerrain(x, y, "W");
          const eastEdge = getEdgeTerrain(x, y, "E");

          if (northEdge === id) {
            const neighbor = getEdgeTerrain(x, y - 1, "S");
            if (!neighbor || neighbor !== id) {
              segments.push({ a: { x: left, y: top }, b: { x: right, y: top } });
            }
          }
          if (southEdge === id) {
            const neighbor = getEdgeTerrain(x, y + 1, "N");
            if (!neighbor || neighbor !== id) {
              segments.push({ a: { x: left, y: bottom }, b: { x: right, y: bottom } });
            }
          }
          if (westEdge === id) {
            const neighbor = getEdgeTerrain(x - 1, y, "E");
            if (!neighbor || neighbor !== id) {
              segments.push({ a: { x: left, y: top }, b: { x: left, y: bottom } });
            }
          }
          if (eastEdge === id) {
            const neighbor = getEdgeTerrain(x + 1, y, "W");
            if (!neighbor || neighbor !== id) {
              segments.push({ a: { x: right, y: top }, b: { x: right, y: bottom } });
            }
          }

          if (mix && (mix.base === id || mix.blend === id) && mix.base !== mix.blend) {
            if (mix.corner === "NE" || mix.corner === "SW") {
              segments.push({ a: { x: left, y: top }, b: { x: right, y: bottom } });
            } else {
              segments.push({ a: { x: right, y: top }, b: { x: left, y: bottom } });
            }
          }
        }
      }
      return segments;
    };
    const animatedFilters: Array<{ uniforms: UniformGroup; startAt: number }> = [];

    const resolveLightValue = (x: number, y: number): number => {
      const idx = y * cols + x;
      if (Array.isArray(options.lightLevels) && options.lightLevels.length > 0) {
        const value = options.lightLevels[idx];
        return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
      }
      if (Array.isArray(options.lightMap) && options.lightMap.length > 0) {
        const value = options.lightMap[idx];
        return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
      }
      return 1;
    };

    const buildLightTexture = (): Texture | null => {
      if (
        (!Array.isArray(options.lightLevels) || options.lightLevels.length === 0) &&
        (!Array.isArray(options.lightMap) || options.lightMap.length === 0)
      ) {
        return null;
      }
      const canvas = document.createElement("canvas");
      canvas.width = cols;
      canvas.height = rows;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const image = ctx.createImageData(cols, rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const light = resolveLightValue(x, y);
          const value = Math.round(light * 255);
          const idx = (y * cols + x) * 4;
          image.data[idx] = value;
          image.data[idx + 1] = value;
          image.data[idx + 2] = value;
          image.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
      const texture = Texture.from(canvas);
      if (texture.source) {
        texture.source.scaleMode = "nearest";
        texture.source.addressMode = "clamp-to-edge";
      }
      return texture;
    };

    const lightTexture = buildLightTexture();

    for (const id of texturedIds) {
      const variantUrls = getFloorTilingVariantUrls(id);
      const fallbackUrl = getFloorTilingUrl(id);
      const resolvedVariants =
        variantUrls.length > 0 ? variantUrls : fallbackUrl ? [fallbackUrl] : [null];
      const variantCount = resolvedVariants.length;
      const variantSeed = hashString(id);
      const hasVariants = variantCount > 1;
      const variantIndices = [...Array(variantCount).keys()];

      const bumpUrl = getFloorBumpUrl(id);
      const resizedBump = getFloorBumpTexture(id, 256);
      const bumpTexture = resizedBump ?? (bumpUrl ? (Assets.get(bumpUrl) as Texture) ?? Texture.from(bumpUrl) : null);
      const material = options.materials.get(id);
      const fallbackColor = parseHexColor(material?.fallbackColor) ?? 0x3f6b3a;
      const solidColor = parseHexColor(material?.solidColor ?? null);

      if (bumpTexture?.source) {
        bumpTexture.source.scaleMode = "linear";
        bumpTexture.source.mipmapFilter = "linear";
        bumpTexture.source.autoGenerateMipmaps = true;
        bumpTexture.source.maxAnisotropy = 4;
        bumpTexture.source.addressMode = "repeat";
        console.log(
          "[floor-tiling] bump",
          id,
          "size",
          bumpTexture.width,
          "x",
          bumpTexture.height,
          "grid",
          cols,
          "x",
          rows
        );
      }
      if (!bumpTexture && bumpUrl) {
        console.warn("[floor-tiling] bump texture missing for", id, "url", bumpUrl);
      }

      const pickVariantIndex = (x: number, y: number): number => {
        if (!hasVariants) return 0;
        const t = hash01(x, y, variantSeed);
        return Math.min(variantCount - 1, Math.floor(t * variantCount));
      };

      const baseMaskCanvas = document.createElement("canvas");
      baseMaskCanvas.width = boardW;
      baseMaskCanvas.height = boardH;
      const baseCtx = baseMaskCanvas.getContext("2d");
      if (!baseCtx) continue;
      baseCtx.fillStyle = "#ffffff";
      baseCtx.imageSmoothingEnabled = true;

      if (naturalIds.includes(id)) {
        const segments = collectBoundarySegments(id);
        const loops = buildLoopsFromSegments(segments);
        const seed = 1337;
        const displacedLoops = loops.map(loop => displaceLoop(loop, 2, 0.22, seed));
        const smoothLoops = displacedLoops.map(loop => smoothClosedLoop(loop, 1));
        baseCtx.beginPath();
        for (const loop of smoothLoops) {
          if (loop.length < 3) continue;
          baseCtx.moveTo(loop[0].x * TILE_SIZE, loop[0].y * TILE_SIZE);
          for (let i = 1; i < loop.length; i++) {
            baseCtx.lineTo(loop[i].x * TILE_SIZE, loop[i].y * TILE_SIZE);
          }
          baseCtx.closePath();
        }
        baseCtx.save();
        baseCtx.lineJoin = "round";
        baseCtx.lineCap = "round";
        baseCtx.lineWidth = TILE_SIZE * 0.6;
        baseCtx.strokeStyle = "#ffffff";
        baseCtx.stroke();
        baseCtx.restore();
        try {
          baseCtx.fill("evenodd");
        } catch {
          baseCtx.fill();
        }
      } else {
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (!isPlayable(x, y)) continue;
            const cell = getTerrainAt(x, y);
            const mix = getMixAt(x, y);
            const left = x * TILE_SIZE;
            const top = y * TILE_SIZE;
            const right = left + TILE_SIZE;
            const bottom = top + TILE_SIZE;

            if (!mix) {
              if (cell === id) {
                baseCtx.fillRect(left, top, TILE_SIZE, TILE_SIZE);
              }
            } else {
              if (mix.blend === id) {
                canvasBlendTriangle(baseCtx, mix.corner, left, top, right, bottom);
              }
              if (mix.base === id) {
                canvasBaseTriangle(baseCtx, mix.corner, left, top, right, bottom);
              }
            }
          }
        }
      }

      const baseMaskTexture = Texture.from(baseMaskCanvas);
      const baseMaskSprite = new Sprite(baseMaskTexture);
      baseMaskSprite.x = 0;
      baseMaskSprite.y = 0;
      baseMaskSprite.alpha = 0.001;
      baseMaskSprite.label = `natural-mask:${id}:base`;

      const materialContainer = new Container();
      materialContainer.mask = baseMaskSprite;

      layer.addChild(baseMaskSprite);
      layer.addChild(materialContainer);

      const hasAnyTexture = resolvedVariants.some(url => Boolean(url));
      const backgroundTint = solidColor ?? fallbackColor;
      if (solidColor !== null || (!bumpTexture && hasAnyTexture)) {
        const backgroundSprite = new TilingSprite({ texture: Texture.WHITE, width: boardW, height: boardH });
        backgroundSprite.tint = backgroundTint;
        backgroundSprite.x = 0;
        backgroundSprite.y = 0;
        backgroundSprite.tileScale.set(1, 1);
        materialContainer.addChild(backgroundSprite);
      }

      if (!hasAnyTexture) {
        const solidSprite = new TilingSprite({ texture: Texture.WHITE, width: boardW, height: boardH });
        solidSprite.tint = fallbackColor;
        solidSprite.x = 0;
        solidSprite.y = 0;
        solidSprite.tileScale.set(1, 1);
        materialContainer.addChild(solidSprite);
        continue;
      }

      for (const variantIndex of variantIndices) {
        const variantUrl = resolvedVariants[variantIndex] ?? null;
        if (!variantUrl) continue;
        const resizedTexture = getFloorTilingTextureFromUrl(variantUrl, 256);
        const baseTexture = resizedTexture ?? (Assets.get(variantUrl) as Texture) ?? Texture.from(variantUrl);
        if (baseTexture.source) {
          baseTexture.source.scaleMode = "linear";
          baseTexture.source.mipmapFilter = "linear";
          baseTexture.source.autoGenerateMipmaps = true;
          baseTexture.source.maxAnisotropy = 4;
          baseTexture.source.addressMode = "repeat";
        }

        const sprite = new TilingSprite({ texture: baseTexture, width: boardW, height: boardH });
        sprite.x = 0;
        sprite.y = 0;

        if (bumpTexture) {
          const fragment = `
            precision highp float;
            in vec2 vTextureCoord;
            out vec4 finalColor;
            uniform sampler2D uTexture;
            uniform sampler2D uBump;
            uniform sampler2D uLightMap;
            uniform vec2 uBumpScale;
            uniform vec2 uLightMapSize;
            uniform float uIntensity;
            uniform float uTime;
            uniform float uWindSpeed;
            uniform float uWindStrength;
            uniform float uLightEnabled;
            uniform float uDebug;
            void main(void){
              vec4 base = texture(uTexture, vTextureCoord);
              vec2 wind = vec2(uTime * uWindSpeed, uTime * uWindSpeed * 0.7);
              vec2 bumpUV = vTextureCoord * uBumpScale + wind;
              vec3 bump = texture(uBump, bumpUV).rgb;
              float h = dot(bump, vec3(0.3333));
              vec3 n = normalize(vec3(bump.r * 2.0 - 1.0, bump.g * 2.0 - 1.0, bump.b * 2.0 - 1.0));
              vec3 lightDir = normalize(vec3(0.35, 0.6, 0.8));
              float ndl = max(dot(n, lightDir), 0.0);
              float light = mix(h, ndl, 0.65);
              vec2 lightCoord = (floor(vTextureCoord * uLightMapSize) + 0.5) / uLightMapSize;
              float lightSample = texture(uLightMap, lightCoord).r;
              float lightFactor = mix(1.0, mix(0.35, 1.0, lightSample), step(0.5, uLightEnabled));
              float signedLight = (light - 0.5) * (uIntensity * 2.0) * uWindStrength * lightFactor;
              vec3 lit = base.rgb * (1.0 + signedLight);
              vec3 debugColor = vec3(h);
              vec3 outColor = mix(lit, debugColor, step(0.5, uDebug));
              finalColor = vec4(outColor, base.a);
            }
          `;
          const intensity = typeof options.bumpIntensity === "number" ? options.bumpIntensity : 0.45;
          const windSpeed = typeof options.windSpeed === "number" ? options.windSpeed : 0.06;
          const windStrength = typeof options.windStrength === "number" ? options.windStrength : 1.0;
          const uniforms = new UniformGroup({
            uBumpScale: { value: [cols, rows], type: "vec2<f32>" },
            uLightMapSize: { value: [cols, rows], type: "vec2<f32>" },
            uIntensity: { value: intensity, type: "f32" },
            uTime: { value: 0, type: "f32" },
            uWindSpeed: { value: windSpeed, type: "f32" },
            uWindStrength: { value: windStrength, type: "f32" },
            uLightEnabled: { value: lightTexture ? 1 : 0, type: "f32" },
            uDebug: { value: options.bumpDebug ? 1 : 0, type: "f32" }
          });
          const glProgram = GlProgram.from({
            vertex: DEFAULT_FILTER_VERT,
            fragment
          });
          const filter = new Filter({
            glProgram,
            resources: {
              uBump: bumpTexture,
              uLightMap: lightTexture ?? Texture.WHITE,
              bumpUniforms: uniforms
            }
          });
          sprite.filters = [filter];
          animatedFilters.push({ uniforms, startAt: performance.now() });
        }

        const texW = baseTexture.width || TILE_SIZE;
        const texH = baseTexture.height || TILE_SIZE;
        sprite.tileScale.set(TILE_SIZE / texW, TILE_SIZE / texH);

        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = boardW;
        maskCanvas.height = boardH;
        const ctx = maskCanvas.getContext("2d");
        if (!ctx) continue;
        ctx.fillStyle = "#ffffff";
        ctx.imageSmoothingEnabled = true;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            if (!isPlayable(x, y)) continue;
            const cell = getTerrainAt(x, y);
            const mix = getMixAt(x, y);
            const hasId = !mix ? cell === id : mix.base === id || mix.blend === id;
            if (!hasId) continue;
            if (hasVariants && pickVariantIndex(x, y) !== variantIndex) continue;
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }

        const maskTexture = Texture.from(maskCanvas);
        const maskSprite = new Sprite(maskTexture);
        maskSprite.x = 0;
        maskSprite.y = 0;
        maskSprite.alpha = 0.001;
        maskSprite.label = `natural-mask:${id}:v${variantIndex}`;

        sprite.mask = maskSprite;
        materialContainer.addChild(sprite);
        materialContainer.addChild(maskSprite);
      }
    }

    let rafId: number | null = null;
    if (animatedFilters.length > 0) {
      const tick = () => {
        const now = performance.now();
        for (const entry of animatedFilters) {
          const t = (now - entry.startAt) / 1000;
          entry.uniforms.uniforms.uTime = t;
        }
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    }

    options.onInvalidate?.();
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [
    options.layerRef,
    options.terrain,
    options.terrainMix,
    options.playableCells,
    options.grid,
    options.materials,
    options.lightLevels,
    options.lightMap,
    options.bumpIntensity,
    options.windSpeed,
    options.windStrength,
    options.bumpDebug,
    options.pixiReadyTick,
    options.onInvalidate,
    texturedIds,
    naturalIds,
    readyTick
  ]);
}

