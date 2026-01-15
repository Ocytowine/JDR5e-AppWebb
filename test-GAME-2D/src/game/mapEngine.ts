import type { EnemyTypeDefinition } from "./enemyTypes";
import type { GridPosition } from "../types";
import type { ObstacleInstance, ObstacleTypeDefinition } from "./obstacleTypes";
import type { WallInstance, WallTypeDefinition } from "./wallTypes";
import type { ManualMapConfig, MapTheme } from "./map/types";
import type { DecorInstance } from "./decorTypes";
import type { TerrainCell } from "./map/draft";
import { runGenerationPipeline, runManualGenerationPipeline } from "./map/pipeline";
import type { WallSegment } from "./map/walls/types";

export interface MapDesignRequest {
  mode?: "prompt" | "manual";
  prompt: string;
  grid: { cols: number; rows: number };
  enemyCount: number;
  enemyTypes: EnemyTypeDefinition[];
  obstacleTypes: ObstacleTypeDefinition[];
  wallTypes: WallTypeDefinition[];
  manualConfig?: ManualMapConfig;
}

export interface MapDesignResult {
  summary: string;
  grid: { cols: number; rows: number };
  theme: MapTheme;
  playerStart: GridPosition;
  enemySpawns: { enemyType: EnemyTypeDefinition; position: GridPosition }[];
  /**
   * Masque de cases jouables (limites de la battlemap).
   * Encodé en "x,y" (même format que les sets de blocage).
   */
  playableCells: string[];
  obstacles: ObstacleInstance[];
  walls: WallInstance[];
  wallSegments: WallSegment[];
  terrain: TerrainCell[];
  height: number[];
  light: number[];
  decorations: DecorInstance[];
  recommendedGrid?: { cols: number; rows: number; reason: string };
  /**
   * Détails de génération (utile pour debug/itération prompt).
   * Optionnel: l'UI peut choisir de l'afficher ou non.
   */
  generationLog?: string[];
}

export function generateBattleMap(request: MapDesignRequest): MapDesignResult {
  const cols = Math.max(1, request.grid.cols);
  const rows = Math.max(1, request.grid.rows);

  const mode =
    request.mode ?? (request.manualConfig ? "manual" : "prompt");
  if (mode === "manual" && request.manualConfig) {
    const manualGrid = request.manualConfig.grid ?? { cols, rows };
    const manualConfig: ManualMapConfig = {
      ...request.manualConfig,
      grid: {
        cols: Math.max(1, manualGrid.cols),
        rows: Math.max(1, manualGrid.rows)
      }
    };

    const result = runManualGenerationPipeline({
      manualConfig,
      ctx: {
        enemyCount: request.enemyCount,
        enemyTypes: request.enemyTypes,
        obstacleTypes: request.obstacleTypes,
        wallTypes: request.wallTypes
      }
    });

    return {
      summary: result.summaryParts.join(" "),
      grid: result.grid,
      theme: result.theme,
      playerStart: result.playerStart,
      enemySpawns: result.enemySpawns,
      playableCells: result.playableCells,
      obstacles: result.obstacles,
      walls: result.walls,
      wallSegments: result.wallSegments,
      terrain: result.terrain,
      height: result.height,
      light: result.light,
      decorations: result.decorations,
      recommendedGrid: result.recommendedGrid,
      generationLog: result.generationLog
    };
  }

  const result = runGenerationPipeline({
    prompt: String(request.prompt ?? ""),
    grid: { cols, rows },
    ctx: {
      enemyCount: request.enemyCount,
      enemyTypes: request.enemyTypes,
      obstacleTypes: request.obstacleTypes,
      wallTypes: request.wallTypes
    }
  });

  return {
    summary: result.summaryParts.join(" "),
      grid: result.grid,
      theme: result.theme,
    playerStart: result.playerStart,
    enemySpawns: result.enemySpawns,
    playableCells: result.playableCells,
    obstacles: result.obstacles,
    walls: result.walls,
    wallSegments: result.wallSegments,
    terrain: result.terrain,
    height: result.height,
    light: result.light,
    decorations: result.decorations,
    recommendedGrid: result.recommendedGrid,
    generationLog: result.generationLog
  };
}


