import type {
  MapPatternAnchor,
  MapPatternDefinition,
  MapPatternElement,
  MapPatternRotation
} from "../mapPatternCatalog";
import type { ObstacleTypeDefinition } from "../obstacleTypes";
import type { WallTypeDefinition } from "../wallTypes";
import { getObstacleOccupiedCells } from "../obstacleRuntime";
import { getWallOccupiedCells } from "../wallRuntime";
import type { MapDraft } from "./draft";
import { isInside, key, tryPlaceDecor, tryPlaceObstacle, tryPlaceWall } from "./draft";

export interface PatternTransform {
  rotation?: MapPatternRotation;
  mirrorX?: boolean;
  mirrorY?: boolean;
}

function normalizePrompt(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function anchorOffsetForSize(
  anchor: MapPatternAnchor,
  w: number,
  h: number
): { x: number; y: number } {
  switch (anchor) {
    case "topRight":
      return { x: w - 1, y: 0 };
    case "bottomLeft":
      return { x: 0, y: h - 1 };
    case "bottomRight":
      return { x: w - 1, y: h - 1 };
    case "center":
      return { x: Math.floor((w - 1) / 2), y: Math.floor((h - 1) / 2) };
    default:
      return { x: 0, y: 0 };
  }
}

function anchorOffset(
  pattern: MapPatternDefinition,
  override?: MapPatternAnchor,
  sizeOverride?: { w: number; h: number }
): { x: number; y: number } {
  const anchor = override ?? pattern.anchor;
  const w = Math.max(1, Math.floor(sizeOverride?.w ?? pattern.footprint.w));
  const h = Math.max(1, Math.floor(sizeOverride?.h ?? pattern.footprint.h));

  return anchorOffsetForSize(anchor, w, h);
}

function pickElements(pattern: MapPatternDefinition, rand?: () => number): MapPatternElement[] {
  const variants = pattern.variants ?? [];
  if (variants.length > 0) {
    if (rand) {
      const idx = Math.floor(rand() * variants.length);
      return (variants[idx] ?? variants[0]).elements;
    }
    return variants[0].elements;
  }
  return pattern.elements;
}

function transformPoint(params: {
  x: number;
  y: number;
  w: number;
  h: number;
  transform: PatternTransform;
}): { x: number; y: number } {
  const { w, h } = params;
  let x = params.x;
  let y = params.y;

  if (params.transform.mirrorX) x = (w - 1) - x;
  if (params.transform.mirrorY) y = (h - 1) - y;

  const rot = params.transform.rotation ?? 0;
  switch (rot) {
    case 90:
      return { x: (h - 1) - y, y: x };
    case 180:
      return { x: (w - 1) - x, y: (h - 1) - y };
    case 270:
      return { x: y, y: (w - 1) - x };
    default:
      return { x, y };
  }
}

function transformedSize(
  w: number,
  h: number,
  rotation: MapPatternRotation | undefined
): { w: number; h: number } {
  const rot = rotation ?? 0;
  if (rot === 90 || rot === 270) return { w: h, h: w };
  return { w, h };
}

export function getPatternSize(
  pattern: MapPatternDefinition,
  transform?: PatternTransform
): { w: number; h: number } {
  return transformedSize(
    Math.max(1, Math.floor(pattern.footprint.w)),
    Math.max(1, Math.floor(pattern.footprint.h)),
    transform?.rotation
  );
}

function applyTransformToElements(params: {
  pattern: MapPatternDefinition;
  elements: MapPatternElement[];
  transform: PatternTransform;
}): { elements: MapPatternElement[]; size: { w: number; h: number } } {
  const w = Math.max(1, Math.floor(params.pattern.footprint.w));
  const h = Math.max(1, Math.floor(params.pattern.footprint.h));
  const size = transformedSize(w, h, params.transform.rotation);

  const elements = params.elements.map(element => {
    const p = transformPoint({
      x: element.x,
      y: element.y,
      w,
      h,
      transform: params.transform
    });
    return { ...element, x: p.x, y: p.y };
  });

  return { elements, size };
}

function fitsBounds(params: {
  draft: MapDraft;
  pattern: MapPatternDefinition;
  originX: number;
  originY: number;
  size?: { w: number; h: number };
}): boolean {
  const { draft, pattern, originX, originY } = params;
  const w = Math.max(1, Math.floor(params.size?.w ?? pattern.footprint.w));
  const h = Math.max(1, Math.floor(params.size?.h ?? pattern.footprint.h));

  if (originX < 0 || originY < 0) return false;
  if (originX + w - 1 >= draft.cols) return false;
  if (originY + h - 1 >= draft.rows) return false;

  const avoid = pattern.constraints?.avoidBorder;
  if (avoid) {
    const left = Math.max(0, Math.floor(avoid.left ?? 0));
    const right = Math.max(0, Math.floor(avoid.right ?? 0));
    const top = Math.max(0, Math.floor(avoid.top ?? 0));
    const bottom = Math.max(0, Math.floor(avoid.bottom ?? 0));

    if (originX < left) return false;
    if (originY < top) return false;
    if (originX + w - 1 > draft.cols - 1 - right) return false;
    if (originY + h - 1 > draft.rows - 1 - bottom) return false;
  }

  return true;
}

function isPlayable(draft: MapDraft, x: number, y: number): boolean {
  if (draft.playable.size === 0) return true;
  return draft.playable.has(key(x, y));
}

function isClearArea(params: {
  draft: MapDraft;
  pattern: MapPatternDefinition;
  originX: number;
  originY: number;
  size?: { w: number; h: number };
}): boolean {
  const { draft, pattern, originX, originY } = params;
  if (!pattern.constraints?.needsClearArea) return true;

  const w = Math.max(1, Math.floor(params.size?.w ?? pattern.footprint.w));
  const h = Math.max(1, Math.floor(params.size?.h ?? pattern.footprint.h));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = originX + x;
      const gy = originY + y;
      if (!isInside(draft, gx, gy)) return false;
      if (!isPlayable(draft, gx, gy)) return false;
      const k = key(gx, gy);
      if (draft.occupied.has(k)) return false;
      if (draft.decorOccupied.has(k)) return false;
      if (draft.reserved.has(k)) return false;
    }
  }

  return true;
}

function canPlaceElements(params: {
  draft: MapDraft;
  pattern: MapPatternDefinition;
  originX: number;
  originY: number;
  elements: MapPatternElement[];
  obstacleTypes: ObstacleTypeDefinition[];
  wallTypes: WallTypeDefinition[];
}): boolean {
  const { draft, originX, originY, elements, obstacleTypes, wallTypes } = params;
  const typeById = new Map(obstacleTypes.map(t => [t.id, t]));
  const wallById = new Map(wallTypes.map(t => [t.id, t]));

  for (const element of elements) {
    const gx = originX + element.x;
    const gy = originY + element.y;

    if (element.type === "decor") {
      if (!isInside(draft, gx, gy)) return false;
      if (!isPlayable(draft, gx, gy)) return false;
      const k = key(gx, gy);
      if (draft.occupied.has(k)) return false;
      if (draft.decorOccupied.has(k)) return false;
      if (draft.reserved.has(k)) return false;
      continue;
    }

    if (element.type === "wall") {
      const typeId = element.typeId ?? "";
      const typeDef = wallById.get(typeId) ?? null;
      if (!typeDef) return false;
      const variantId = element.variant ?? typeDef.variants?.[0]?.id ?? "base";
      const rotation = element.rotation ?? 0;
      const temp = {
        id: "pattern-wall",
        typeId,
        variantId,
        x: gx,
        y: gy,
        rotation,
        state: "closed" as const
      };
      const cells = getWallOccupiedCells(temp, typeDef);
      if (!cells.length) return false;
      for (const c of cells) {
        if (!isInside(draft, c.x, c.y)) return false;
        if (!isPlayable(draft, c.x, c.y)) return false;
        const k = key(c.x, c.y);
        if (draft.occupied.has(k)) return false;
        if (draft.decorOccupied.has(k)) return false;
        if (draft.reserved.has(k)) return false;
      }
      continue;
    }

    const typeId = element.typeId ?? "";
    const typeDef = typeById.get(typeId) ?? null;
    if (!typeDef) return false;

    const variantId = element.variant ?? typeDef.variants?.[0]?.id ?? "base";
    const rotation = element.rotation ?? 0;

    const temp = {
      id: "pattern",
      typeId,
      variantId,
      x: gx,
      y: gy,
      rotation,
      hp: 1,
      maxHp: 1
    };

    const cells = getObstacleOccupiedCells(temp, typeDef);
    if (!cells.length) return false;

    for (const c of cells) {
      if (!isInside(draft, c.x, c.y)) return false;
      if (!isPlayable(draft, c.x, c.y)) return false;
      const k = key(c.x, c.y);
      if (draft.occupied.has(k)) return false;
      if (draft.decorOccupied.has(k)) return false;
      if (draft.reserved.has(k)) return false;
    }
  }

  return true;
}

export function placePattern(params: {
  draft: MapDraft;
  pattern: MapPatternDefinition;
  anchorX: number;
  anchorY: number;
  obstacleTypes: ObstacleTypeDefinition[];
  wallTypes: WallTypeDefinition[];
  rand?: () => number;
  anchorOverride?: MapPatternAnchor;
  transform?: PatternTransform;
}): boolean {
  const { draft, pattern, anchorX, anchorY, obstacleTypes, wallTypes, rand, anchorOverride, transform } = params;
  const baseElements = pickElements(pattern, rand);
  const { elements, size } = applyTransformToElements({
    pattern,
    elements: baseElements,
    transform: transform ?? {}
  });
  const offset = anchorOffset(pattern, anchorOverride, size);
  const originX = anchorX - offset.x;
  const originY = anchorY - offset.y;

  if (!fitsBounds({ draft, pattern, originX, originY, size })) return false;
  if (!isClearArea({ draft, pattern, originX, originY, size })) return false;

  if (!canPlaceElements({ draft, pattern, originX, originY, elements, obstacleTypes, wallTypes })) return false;

  for (const element of elements) {
    const gx = originX + element.x;
    const gy = originY + element.y;

    if (element.type === "decor") {
      const ok = tryPlaceDecor({
        draft,
        spriteKey: element.spriteKey ?? "",
        x: gx,
        y: gy,
        rotation: element.rotation,
        scale: element.scale
      });
      if (!ok) return false;
      continue;
    }

    if (element.type === "wall") {
      const typeId = element.typeId ?? "";
      const typeDef = wallTypes.find(t => t.id === typeId) ?? null;
      if (!typeDef) return false;
      const variantId = element.variant ?? typeDef.variants?.[0]?.id ?? "base";
      const ok = tryPlaceWall({
        draft,
        type: typeDef,
        x: gx,
        y: gy,
        variantId,
        rotation: element.rotation ?? 0
      });
      if (!ok) return false;
      continue;
    }

    const typeId = element.typeId ?? "";
    const typeDef = obstacleTypes.find(t => t.id === typeId) ?? null;
    if (!typeDef) return false;

    const variantId = element.variant ?? typeDef.variants?.[0]?.id ?? "base";
    const ok = tryPlaceObstacle({
      draft,
      type: typeDef,
      x: gx,
      y: gy,
      variantId,
      rotation: element.rotation ?? 0
    });
    if (!ok) return false;
  }

  return true;
}

export function placePatternAtOrigin(params: {
  draft: MapDraft;
  pattern: MapPatternDefinition;
  originX: number;
  originY: number;
  obstacleTypes: ObstacleTypeDefinition[];
  wallTypes: WallTypeDefinition[];
  rand?: () => number;
  anchorOverride?: MapPatternAnchor;
  transform?: PatternTransform;
}): boolean {
  const { draft, pattern, originX, originY, obstacleTypes, wallTypes, rand, anchorOverride, transform } = params;
  const size = transformedSize(
    Math.max(1, Math.floor(pattern.footprint.w)),
    Math.max(1, Math.floor(pattern.footprint.h)),
    transform?.rotation
  );
  const offset = anchorOffset(pattern, anchorOverride, size);
  return placePattern({
    draft,
    pattern,
    obstacleTypes,
    wallTypes,
    rand,
    anchorOverride,
    transform,
    anchorX: originX + offset.x,
    anchorY: originY + offset.y
  });
}

export function pickPatternTransform(params: {
  rand: () => number;
  allowedRotations?: MapPatternRotation[];
  allowMirrorX?: boolean;
  allowMirrorY?: boolean;
}): PatternTransform {
  const rotations = params.allowedRotations?.length
    ? params.allowedRotations
    : [0];
  const rotation = rotations[Math.floor(params.rand() * rotations.length)] as MapPatternRotation;
  const mirrorX = params.allowMirrorX ? params.rand() < 0.5 : false;
  const mirrorY = params.allowMirrorY ? params.rand() < 0.5 : false;
  return { rotation, mirrorX, mirrorY };
}

export function choosePatternsByPrompt(params: {
  patterns: MapPatternDefinition[];
  prompt: string;
  rand: () => number;
  count: number;
}): MapPatternDefinition[] {
  const normalized = normalizePrompt(params.prompt);
  if (!normalized) {
    const picks: MapPatternDefinition[] = [];
    for (let i = 0; i < params.count; i++) {
      const p = params.patterns[Math.floor(params.rand() * params.patterns.length)];
      if (p) picks.push(p);
    }
    return picks;
  }

  const scored = params.patterns.map(p => {
    const tags = p.tags ?? [];
    let score = 1;
    for (const t of tags) {
      if (!t) continue;
      if (normalized.includes(normalizePrompt(t))) score += 4;
    }
    if (normalized.includes(normalizePrompt(p.label))) score += 2;
    return { item: p, weight: score };
  });

  const picks: MapPatternDefinition[] = [];
  const pool = [...scored];
  for (let i = 0; i < params.count && pool.length; i++) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = params.rand() * total;
    let chosenIdx = 0;
    for (let idx = 0; idx < pool.length; idx++) {
      roll -= pool[idx].weight;
      if (roll <= 0) {
        chosenIdx = idx;
        break;
      }
    }
    const picked = pool.splice(chosenIdx, 1)[0];
    if (picked) picks.push(picked.item);
  }
  return picks;
}
