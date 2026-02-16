import type {
  MapPatternAnchor,
  MapPatternDefinition,
  MapPatternElement,
  MapPatternRotation
} from "./mapPatternCatalog";
import type { ObstacleTypeDefinition } from "../obstacleTypes";
import type { WallTypeDefinition } from "../wallTypes";
import { getObstacleOccupiedCells } from "../runtime/obstacleRuntime";
import type { MapDraft } from "./draft";
import {
  getTerrainAt,
  isInside,
  key,
  setHeight,
  setTerrain,
  tryPlaceDecor,
  tryPlaceObstacle
} from "./draft";
import {
  buildInteriorCellsFromAscii,
  buildSegmentsFromAscii,
  buildWallCellsFromAscii,
  getAsciiFootprint
} from "../walls/ascii";
import { wallEdgeKeyForSegment } from "../walls/grid";
import { resolveWallMaxHp } from "../walls/durability";
import { getSpriteGridCells, hasTreeOverlap, isTreeType } from "./placement";

export interface PatternTransform {
  rotation?: MapPatternRotation;
  mirrorX?: boolean;
  mirrorY?: boolean;
}

function pickWallTypeForKind(kind: "wall" | "low" | "door", wallTypes?: WallTypeDefinition[]): WallTypeDefinition | null {
  if (!wallTypes || wallTypes.length === 0) return null;
  if (kind === "door") {
    return (
      wallTypes.find(t => (t.tags ?? []).some(tag => String(tag).toLowerCase() === "door")) ??
      wallTypes.find(t => t.behavior?.kind === "door") ??
      wallTypes[0] ??
      null
    );
  }
  if (kind === "low") {
    return (
      wallTypes.find(t => (t.tags ?? []).some(tag => String(tag).toLowerCase() === "low")) ??
      wallTypes.find(t => String(t.appearance?.heightClass ?? "").toLowerCase() === "low") ??
      wallTypes[0] ??
      null
    );
  }
  return wallTypes.find(t => t.category === "wall") ?? wallTypes[0] ?? null;
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

function hasPatternTag(pattern: MapPatternDefinition, tag: string): boolean {
  const tags = pattern.tags ?? [];
  const target = String(tag).toLowerCase();
  return tags.some(t => String(t).toLowerCase() === target);
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
  size?: { w: number; h: number };
}): boolean {
  const { draft, originX, originY, elements, obstacleTypes } = params;
  const w = Math.max(1, Math.floor(params.size?.w ?? params.pattern.footprint.w));
  const h = Math.max(1, Math.floor(params.size?.h ?? params.pattern.footprint.h));
  const maxX = originX + w - 1;
  const maxY = originY + h - 1;
  const typeById = new Map(obstacleTypes.map(t => [t.id, t]));

  for (const element of elements) {
    if (element.x < 0 || element.y < 0 || element.x >= w || element.y >= h) return false;
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

    if (element.type === "tile") {
      if (!isInside(draft, gx, gy)) return false;
      if (!isPlayable(draft, gx, gy)) return false;
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

    if (isTreeType(typeDef)) {
      const grid = typeDef.appearance?.spriteGrid;
      const candidateCells =
        grid && Number.isFinite(grid.tilesX) && Number.isFinite(grid.tilesY)
          ? getSpriteGridCells({
              x: gx,
              y: gy,
              tilesX: grid.tilesX,
              tilesY: grid.tilesY,
              cols: draft.cols,
              rows: draft.rows
            })
          : cells;
      if (hasTreeOverlap({
        candidate: candidateCells,
        draftObstacles: draft.obstacles,
        typeById,
        cols: draft.cols,
        rows: draft.rows
      })) {
        return false;
      }
    }

    for (const c of cells) {
      if (!isInside(draft, c.x, c.y)) return false;
      if (c.x < originX || c.x > maxX || c.y < originY || c.y > maxY) return false;
      if (!isPlayable(draft, c.x, c.y)) return false;
      const k = key(c.x, c.y);
      if (draft.occupied.has(k)) return false;
      if (draft.decorOccupied.has(k)) return false;
      if (draft.reserved.has(k)) return false;
    }
  }

  return true;
}

function respectsAllowedTerrains(params: {
  draft: MapDraft;
  pattern: MapPatternDefinition;
  originX: number;
  originY: number;
  size?: { w: number; h: number };
}): boolean {
  const { draft, pattern, originX, originY } = params;
  const allowed = pattern.allowedTerrains;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  const allowedSet = new Set(allowed.map(t => String(t)));
  const w = Math.max(1, Math.floor(params.size?.w ?? pattern.footprint.w));
  const h = Math.max(1, Math.floor(params.size?.h ?? pattern.footprint.h));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = originX + x;
      const gy = originY + y;
      if (!isInside(draft, gx, gy)) return false;
      const terrain = getTerrainAt(draft, gx, gy);
      if (!terrain || !allowedSet.has(String(terrain))) return false;
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
  wallTypes?: WallTypeDefinition[];
  rand?: () => number;
  anchorOverride?: MapPatternAnchor;
  transform?: PatternTransform;
}): boolean {
  const { draft, pattern, anchorX, anchorY, obstacleTypes, rand, anchorOverride, transform, wallTypes } = params;
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
  if (!respectsAllowedTerrains({ draft, pattern, originX, originY, size })) return false;

  const asciiFootprint = Array.isArray(pattern.wallAscii) && pattern.wallAscii.length > 0
    ? getAsciiFootprint(pattern.wallAscii)
    : null;
  if (asciiFootprint) {
    const fpW = Math.max(1, Math.floor(pattern.footprint.w));
    const fpH = Math.max(1, Math.floor(pattern.footprint.h));
    if (asciiFootprint.w > fpW || asciiFootprint.h > fpH) return false;
  }

  if (!canPlaceElements({ draft, pattern, originX, originY, elements, obstacleTypes, size })) return false;

  if (pattern.floorPaint?.mode === "interior" && Array.isArray(pattern.wallAscii)) {
    const interiorCells = buildInteriorCellsFromAscii({
      ascii: pattern.wallAscii,
      originX,
      originY,
      rotation: transform?.rotation ?? 0
    });
    const wallCells = buildWallCellsFromAscii({
      ascii: pattern.wallAscii,
      originX,
      originY,
      rotation: transform?.rotation ?? 0
    });
    const paintKeys = new Set<string>();
    const paintTargets: { x: number; y: number }[] = [];
    for (const cell of interiorCells) {
      const k = key(cell.x, cell.y);
      if (paintKeys.has(k)) continue;
      paintKeys.add(k);
      paintTargets.push(cell);
    }
    for (const cell of wallCells) {
      const k = key(cell.x, cell.y);
      if (paintKeys.has(k)) continue;
      paintKeys.add(k);
      paintTargets.push(cell);
    }
    for (const cell of paintTargets) {
      setTerrain(draft, cell.x, cell.y, pattern.floorPaint.terrain as any);
      if (typeof pattern.floorPaint.height === "number") {
        setHeight(draft, cell.x, cell.y, pattern.floorPaint.height);
      }
    }
    if (hasPatternTag(pattern, "roof-open")) {
      for (const cell of interiorCells) {
        draft.roofOpenCells.add(key(cell.x, cell.y));
      }
    }
  }

  for (const element of elements) {
    const gx = originX + element.x;
    const gy = originY + element.y;

    if (element.type === "tile") {
      if (typeof element.height === "number") {
        setHeight(draft, gx, gy, element.height);
      }
      if (typeof element.terrain === "string") {
        setTerrain(draft, gx, gy, element.terrain as any);
      }
      continue;
    }

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

  if (Array.isArray(pattern.wallAscii) && pattern.wallAscii.length > 0) {
    const segments = buildSegmentsFromAscii({
      ascii: pattern.wallAscii,
      originX,
      originY,
      rotation: transform?.rotation ?? 0,
      doors: pattern.wallDoors ?? [],
      nextId: draft.nextWallId
    });
      for (const seg of segments) {
        const type = pickWallTypeForKind(seg.kind, wallTypes);
        const maxHp = resolveWallMaxHp(type);
        if (type) seg.typeId = type.id;
        if (maxHp !== null) {
          seg.maxHp = maxHp;
          seg.hp = maxHp;
        }
        draft.wallSegments.push(seg);
        draft.wallSegmentKeys.add(wallEdgeKeyForSegment(seg));
      }

    const wallCells = buildWallCellsFromAscii({
      ascii: pattern.wallAscii,
      originX,
      originY,
      rotation: transform?.rotation ?? 0
    });
    for (const cell of wallCells) {
      const k = key(cell.x, cell.y);
      draft.occupied.add(k);
      draft.movementBlocked.add(k);
    }
  }

  return true;
}

export function placePatternAtOrigin(params: {
  draft: MapDraft;
  pattern: MapPatternDefinition;
  originX: number;
  originY: number;
  obstacleTypes: ObstacleTypeDefinition[];
  wallTypes?: WallTypeDefinition[];
  rand?: () => number;
  anchorOverride?: MapPatternAnchor;
  transform?: PatternTransform;
}): boolean {
  const { draft, pattern, originX, originY, obstacleTypes, rand, anchorOverride, transform } = params;
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
    wallTypes: params.wallTypes,
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



