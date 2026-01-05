import type { GridPosition } from "../../types";
import type { MapBuildContext, MapBuildResult, ManualMapConfig, MapSpec } from "./types";
import type { MapDraft } from "./draft";
import { parsePromptToSpec } from "./promptParser";
import { hashStringToSeed, mulberry32 } from "./random";
import { spawnEnemies } from "./spawn";
import { recommendGridFromSpec } from "./recommendGrid";

import { generateDungeonCircularRoom } from "./modules/dungeonCircularRoom";
import { generateDungeonSquareRoom } from "./modules/dungeonSquareRoom";
import { generateForestClearing } from "./modules/forestClearing";
import { generateCityStreet } from "./modules/cityStreet";
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
}): { draft: MapDraft; playerStart: GridPosition } {
  const { spec, ctx, rand } = params;

  switch (spec.layoutId) {
    case "dungeon_circular_room":
      return generateDungeonCircularRoom({ spec, ctx, rand });
    case "dungeon_square_room":
      return generateDungeonSquareRoom({ spec, ctx, rand });
    case "forest_clearing":
      return generateForestClearing({ spec, ctx, rand });
    case "city_street":
      return generateCityStreet({ spec, ctx, rand });
    default:
      return generateGenericScatter({ spec, ctx, rand });
  }
}

export function runGenerationPipeline(params: {
  prompt: string;
  grid: { cols: number; rows: number };
  ctx: MapBuildContext;
}): MapBuildResult {
  const { spec, notes, rand } = buildMapFromPrompt(params);

  const recommendedGrid = recommendGridFromSpec({
    spec,
    enemyCount: params.ctx.enemyCount
  });

  const { draft, playerStart } = generateFromSpec({ spec, ctx: params.ctx, rand });

  const { enemySpawns, log: spawnLog } = spawnEnemies({
    draft,
    playerStart,
    enemyCount: params.ctx.enemyCount,
    enemyTypes: params.ctx.enemyTypes,
    rand
  });

  const summaryParts: string[] = [];
  const generationLog: string[] = [];

  if (spec.prompt.trim()) summaryParts.push(`Prompt: ${spec.prompt.trim()}`);
  summaryParts.push(
    spec.layoutId === "dungeon_circular_room"
      ? "Layout: donjon (salle circulaire)."
      : spec.layoutId === "dungeon_square_room"
        ? "Layout: donjon (salle carrée)."
        : spec.layoutId === "forest_clearing"
          ? "Layout: foret (clairiere)."
          : spec.layoutId === "city_street"
            ? "Layout: ville (rue)."
            : "Layout: basique."
  );
  summaryParts.push(`Obstacles: ${draft.obstacles.length}. Ennemis: ${enemySpawns.length}.`);

  generationLog.push(...notes.map(n => `[spec] ${n}`));
  if (recommendedGrid) {
    generationLog.push(
      `[spec] recommendedGrid=${recommendedGrid.cols}x${recommendedGrid.rows} (${recommendedGrid.reason})`
    );
  }
  generationLog.push(...draft.log.map(l => `[gen] ${l}`));
  generationLog.push(...spawnLog.map(l => `[spawn] ${l}`));

  return {
    summaryParts,
    generationLog,
    playerStart,
    enemySpawns,
    playableCells: Array.from(draft.playable),
    obstacles: draft.obstacles,
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

  const { enemySpawns, log: spawnLog } = spawnEnemies({
    draft,
    playerStart,
    enemyCount: ctx.enemyCount,
    enemyTypes: ctx.enemyTypes,
    rand
  });

  const summaryParts: string[] = [];
  const generationLog: string[] = [];

  summaryParts.push(`Manual preset: ${manualConfig.presetId}.`);
  summaryParts.push(`Obstacles: ${draft.obstacles.length}. Ennemis: ${enemySpawns.length}.`);

  generationLog.push(
    `[manual] preset=${manualConfig.presetId} grid=${manualConfig.grid.cols}x${manualConfig.grid.rows}`
  );
  generationLog.push(...draft.log.map(l => `[gen] ${l}`));
  generationLog.push(...spawnLog.map(l => `[spawn] ${l}`));

  return {
    summaryParts,
    generationLog,
    playerStart,
    enemySpawns,
    playableCells: Array.from(draft.playable),
    obstacles: draft.obstacles,
    recommendedGrid: undefined
  };
}
