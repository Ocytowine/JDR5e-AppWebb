import type { GridPosition } from "../../types";
import type { MapBuildContext, MapBuildResult, ManualMapConfig, MapSpec } from "./types";
import type { MapDraft } from "./draft";
import { getHeightAtGrid, key } from "./draft";
import { parsePromptToSpec } from "./promptParser";
import { hashStringToSeed, mulberry32 } from "./random";
import { spawnEnemies } from "./spawn";
import { recommendGridFromSpec } from "./recommendGrid";
import { convertLegacyWallsToSegments } from "./walls/legacy";
import { wallEdgeKeyForSegment } from "./walls/grid";

import { generateDungeonCircularRoom } from "./modules/dungeonCircularRoom";
import { generateDungeonSquareRoom } from "./modules/dungeonSquareRoom";
import { generateDungeonRoomPlan } from "./modules/dungeonRoomPlan";
import { generateForestClearing } from "./modules/forestClearing";
import { generateCityStreet } from "./modules/cityStreet";
import { generateTieredBuilding } from "./modules/tieredBuilding";
import { generateGenericScatter } from "./modules/genericScatter";
import { generateManualArena } from "./modules/manualArena";

export function buildMapFromPrompt(params: {
  prompt: string;
  grid: { cols: number; rows: number };
  ctx: MapBuildContext;
}): { spec: MapSpec; notes: string[]; rand: () => number } {
  const { spec, notes } = parsePromptToSpec({
    prompt: params.prompt,
    cols: params.grid.cols,
    rows: params.grid.rows
  });

  // RNG déterministe par prompt
  const seed = hashStringToSeed(params.prompt || "default");
  const rand = mulberry32(seed);

  return { spec, notes, rand };
}

export function generateFromSpec(params: {
  spec: MapSpec;
  ctx: MapBuildContext;
  rand: () => number;
}): {
  draft: MapDraft;
  playerStart: GridPosition;
  roomMasks?: Record<string, Set<string>>;
  playerRoomId?: string;
  enemyRoomId?: string;
} {
  const { spec, ctx, rand } = params;

  switch (spec.layoutId) {
    case "dungeon_circular_room":
      return generateDungeonCircularRoom({ spec, ctx, rand });
    case "dungeon_square_room":
      return generateDungeonSquareRoom({ spec, ctx, rand });
    case "dungeon_split_rooms":
    case "dungeon_corridor_rooms":
      return generateDungeonRoomPlan({ spec, ctx, rand });
    case "forest_clearing":
      return generateForestClearing({ spec, ctx, rand });
    case "city_street":
      return generateCityStreet({ spec, ctx, rand });
    case "building_tiered":
      return generateTieredBuilding({ spec, ctx, rand });
    default:
      return generateGenericScatter({ spec, ctx, rand });
  }
}

function isPlayableCell(draft: MapDraft, x: number, y: number): boolean {
  if (draft.playable.size === 0) return true;
  return draft.playable.has(key(x, y));
}

function hasClearance(
  draft: MapDraft,
  center: GridPosition,
  radius: number
): boolean {
  if (radius <= 0) return !draft.occupied.has(key(center.x, center.y));
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > radius) continue;
      const x = center.x + dx;
      const y = center.y + dy;
      if (x < 0 || y < 0 || x >= draft.cols || y >= draft.rows) continue;
      if (draft.occupied.has(key(x, y))) return false;
    }
  }
  return true;
}

function resolvePlayerStart(draft: MapDraft, hint: GridPosition): GridPosition {
  const fallback: GridPosition = { x: 0, y: 0 };
  const safeHint =
    Number.isFinite(hint?.x) && Number.isFinite(hint?.y) ? hint : fallback;
  const hintHeight = getHeightAtGrid(
    draft.layers.height,
    draft.cols,
    draft.rows,
    safeHint.x,
    safeHint.y
  );

  const clearanceOptions = [2, 1, 0];
  for (const radius of clearanceOptions) {
    let best: GridPosition | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let y = 0; y < draft.rows; y++) {
      for (let x = 0; x < draft.cols; x++) {
        if (!isPlayableCell(draft, x, y)) continue;
        const candidate = { x, y };
        if (!hasClearance(draft, candidate, radius)) continue;

        const dist = Math.abs(x - safeHint.x) + Math.abs(y - safeHint.y);
        const height = getHeightAtGrid(draft.layers.height, draft.cols, draft.rows, x, y);
        const heightPenalty = height === hintHeight ? 0 : 10000;
        const score = heightPenalty + dist * 1000 + x * 2 + Math.abs(y - safeHint.y);
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }

    if (best) return best;
  }

  for (let y = 0; y < draft.rows; y++) {
    for (let x = 0; x < draft.cols; x++) {
      if (!isPlayableCell(draft, x, y)) continue;
      if (!draft.occupied.has(key(x, y))) return { x, y };
    }
  }

  return fallback;
}

export function runGenerationPipeline(params: {
  prompt: string;
  grid: { cols: number; rows: number };
  ctx: MapBuildContext;
}): MapBuildResult {
  const { spec, notes, rand } = buildMapFromPrompt(params);
  const rawPrompt = String(params.prompt ?? "");
  const disableEnemies = rawPrompt.trimStart().toLowerCase().startsWith("test");

  const recommendedGrid = recommendGridFromSpec({
    spec,
    enemyCount: disableEnemies ? 0 : params.ctx.enemyCount
  });

  const { draft, playerStart, roomMasks, enemyRoomId } = generateFromSpec({ spec, ctx: params.ctx, rand });
  const resolvedPlayerStart = resolvePlayerStart(draft, playerStart);

  const enemyCountOverride = spec.dungeonPlan?.enemyCountOverride;
  const resolvedEnemyCount = enemyCountOverride ?? params.ctx.enemyCount;
  const effectiveEnemyCount = disableEnemies ? 0 : resolvedEnemyCount;
  const enemyRoomMask =
    enemyRoomId && roomMasks
      ? roomMasks[enemyRoomId] ?? null
      : null;

  const { enemySpawns, log: spawnLog } = spawnEnemies({
    draft,
    playerStart: resolvedPlayerStart,
    enemyCount: effectiveEnemyCount,
    enemyTypes: params.ctx.enemyTypes,
    rand,
    spawnMask: enemyRoomMask ?? undefined
  });

  const summaryParts: string[] = [];
  const generationLog: string[] = [];

  if (spec.prompt.trim()) summaryParts.push(`Prompt: ${spec.prompt.trim()}`);
  summaryParts.push(
    spec.layoutId === "dungeon_circular_room"
      ? "Layout: donjon (salle circulaire)."
      : spec.layoutId === "dungeon_square_room"
        ? "Layout: donjon (salle carree)."
        : spec.layoutId === "dungeon_split_rooms"
          ? "Layout: donjon (salles separees)."
          : spec.layoutId === "dungeon_corridor_rooms"
            ? "Layout: donjon (salles avec couloir)."
            : spec.layoutId === "forest_clearing"
              ? "Layout: foret (clairiere)."
              : spec.layoutId === "city_street"
                ? "Layout: ville (rue)."
                : "Layout: basique."
  );
  summaryParts.push(`Obstacles: ${draft.obstacles.length}. Murs: ${draft.walls.length}. Ennemis: ${enemySpawns.length}.`);

  generationLog.push(...notes.map(n => `[spec] ${n}`));
  generationLog.push(`[spec] timeOfDay=${spec.timeOfDay}`);
  generationLog.push(`[gen] module=${spec.layoutId}`);
  if (disableEnemies) {
    generationLog.push("[spec] testPrompt=true (ennemis desactive)");
  }
  if (recommendedGrid) {
    generationLog.push(
      `[spec] recommendedGrid=${recommendedGrid.cols}x${recommendedGrid.rows} (${recommendedGrid.reason})`
    );
  }
  generationLog.push(...draft.log.map(l => `[gen] ${l}`));
  generationLog.push(...spawnLog.map(l => `[spawn] ${l}`));

  const legacySegments = convertLegacyWallsToSegments({
    walls: draft.walls,
    wallTypes: params.ctx.wallTypes
  });
  const wallSegmentMap = new Map<string, import("./walls/types").WallSegment>();
  for (const seg of [...legacySegments, ...draft.wallSegments]) {
    wallSegmentMap.set(wallEdgeKeyForSegment(seg), seg);
  }

  return {
    summaryParts,
    generationLog,
    grid: { cols: draft.cols, rows: draft.rows },
    theme: spec.theme,
    playerStart: resolvedPlayerStart,
    enemySpawns,
    playableCells: Array.from(draft.playable),
    obstacles: draft.obstacles,
    walls: draft.walls,
    wallSegments: Array.from(wallSegmentMap.values()),
    terrain: draft.layers.terrain,
    height: draft.layers.height,
    light: draft.layers.light,
    decorations: draft.decorations,
    recommendedGrid: recommendedGrid ?? undefined
  };
}

export function runManualGenerationPipeline(params: {
  manualConfig: ManualMapConfig;
  ctx: MapBuildContext;
}): MapBuildResult {
  const { manualConfig, ctx } = params;

  const seed = hashStringToSeed(JSON.stringify(manualConfig));
  const rand = mulberry32(seed);

  const { draft, playerStart } = generateManualArena({ manualConfig, ctx, rand });
  const resolvedPlayerStart = resolvePlayerStart(draft, playerStart);

  const { enemySpawns, log: spawnLog } = spawnEnemies({
    draft,
    playerStart: resolvedPlayerStart,
    enemyCount: ctx.enemyCount,
    enemyTypes: ctx.enemyTypes,
    rand
  });

  const summaryParts: string[] = [];
  const generationLog: string[] = [];

  summaryParts.push(`Manual preset: ${manualConfig.presetId}.`);
  summaryParts.push(`Obstacles: ${draft.obstacles.length}. Murs: ${draft.walls.length}. Ennemis: ${enemySpawns.length}.`);

  generationLog.push(
    `[manual] preset=${manualConfig.presetId} grid=${manualConfig.grid.cols}x${manualConfig.grid.rows}`
  );
  generationLog.push(...draft.log.map(l => `[gen] ${l}`));
  generationLog.push(...spawnLog.map(l => `[spawn] ${l}`));

  const legacySegments = convertLegacyWallsToSegments({
    walls: draft.walls,
    wallTypes: ctx.wallTypes
  });
  const wallSegmentMap = new Map<string, import("./walls/types").WallSegment>();
  for (const seg of [...legacySegments, ...draft.wallSegments]) {
    wallSegmentMap.set(wallEdgeKeyForSegment(seg), seg);
  }

  return {
    summaryParts,
    generationLog,
    grid: { cols: draft.cols, rows: draft.rows },
    theme: manualConfig.options.theme,
    playerStart: resolvedPlayerStart,
    enemySpawns,
    playableCells: Array.from(draft.playable),
    obstacles: draft.obstacles,
    walls: draft.walls,
    wallSegments: Array.from(wallSegmentMap.values()),
    terrain: draft.layers.terrain,
    height: draft.layers.height,
    light: draft.layers.light,
    decorations: draft.decorations,
    recommendedGrid: undefined
  };
}

