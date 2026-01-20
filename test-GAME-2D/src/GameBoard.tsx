import React, { useEffect, useMemo, useRef, useState } from "react";
import { sampleCharacter } from "./sampleCharacter";
import type { MovementProfile, TokenState, VisionProfile } from "./types";
import type {
  ActionAvailability,
  ActionDefinition,
  Condition,
  Effect,
  TargetingSpec,
  UsageSpec
} from "./game/actionTypes";
import type { EnemyTypeDefinition } from "./game/enemyTypes";
import type {
  EffectSpec,
  EnemyActionType,
  EnemyAiStateSummary,
  EnemyActionIntent,
  EnemyDecision,
  EnemySummary,
  PlayerSummary,
  SpeechBubbleEntry,
  TurnEntry,
  TurnPhase
} from "./game/turnTypes";
import {
  clamp,
  computeFacingTowards,
  distanceBetweenTokens,
  distanceFromPointToToken,
  getAttackRangeForToken,
  getMaxAttacksForToken,
  isTokenDead,
  canEnemySeePlayer
} from "./game/combatUtils";
import enemyTypesIndex from "../enemy-types/index.json";
import bruteType from "../enemy-types/brute.json";
import archerType from "../enemy-types/archer.json";
import assassinType from "../enemy-types/assassin.json";
import ghostType from "../enemy-types/ghost.json";
import { loadObstacleTypesFromIndex } from "./game/obstacleCatalog";
import { loadWallTypesFromIndex } from "./game/wallCatalog";
import type { ObstacleInstance, ObstacleTypeDefinition } from "./game/obstacleTypes";
import type { WallTypeDefinition } from "./game/wallTypes";
import { generateBattleMap } from "./game/mapEngine";
import { getHeightAtGrid, type TerrainCell } from "./game/map/draft";
import { getFloorMaterial } from "./game/map/floors/catalog";
import type { DecorInstance } from "./game/decorTypes";
import type { MapTheme } from "./game/map/types";
import { buildObstacleBlockingSets, getObstacleOccupiedCells } from "./game/obstacleRuntime";
import {
  distanceBetweenCells,
  getClosestFootprintCellToPoint,
  orientationFromRotationDeg,
  getTokenOccupiedCells
} from "./game/footprint";
import actionsIndex from "../action-game/actions/index.json";
import meleeStrike from "../action-game/actions/melee-strike.json";
import dashAction from "../action-game/actions/dash.json";
import secondWind from "../action-game/actions/second-wind.json";
import throwDagger from "../action-game/actions/throw-dagger.json";
import torchToggle from "../action-game/actions/torch-toggle.json";
import enemyMove from "../action-game/actions/enemy-move.json";
import enemyMeleeStrike from "../action-game/actions/enemy-melee-strike.json";
import enemyBowShot from "../action-game/actions/enemy-bow-shot.json";
import {
  rollAttack,
  rollDamage,
  type AttackRollResult,
  type DamageRollResult,
  type AdvantageMode
} from "./dice/roller";
import { resolveAction, type ActionTarget } from "./game/actionEngine";
import {
  GRID_COLS,
  GRID_ROWS,
  getBoardHeight,
  getBoardWidth,
  isCellInsideGrid,
  screenToGridForGrid
} from "./boardConfig";
import { computePathTowards } from "./pathfinding";
import { getTokenAt } from "./gridUtils";
import {
  computeVisibilityLevelsForToken,
  getEntitiesInVision,
  isCellVisible,
  isTargetVisible,
  type VisibilityLevel
} from "./vision";
import { hasLineOfEffect } from "./lineOfSight";
import {
  computeLightLevels,
  computeLightTints,
  isLightVisible,
  resolveLightVisionMode,
  LIGHT_LEVEL_SHADOW_MIN,
  type LightVisionMode
} from "./lighting";
import {
  beginRoundNarrationBuffer,
  buildRoundNarrationRequest,
  clearRoundNarrationBuffer,
  getLastSpeechForEnemy,
  getPriorEnemySpeechesThisRound,
  getRecentCombatEvents,
  recordCombatEvent,
  recordEnemySpeech,
  requestEnemySpeech,
  requestRoundNarration
} from "./narrationClient";
import type {
  CombatStateSummary,
  CombatSide,
  EnemySpeech,
  EnemySpeechRequest
} from "./narrationTypes";
import type { WallSegment } from "./game/map/walls/types";
import {
  buildWallEdgeSets,
  computeClosedCells
} from "./game/map/walls/runtime";
import { getAdjacentCellsForEdge } from "./game/map/walls/grid";
import { isWallDestructible } from "./game/map/walls/durability";
import {
  usePixiBoard,
  usePixiDecorations,
  usePixiGridLabels,
  usePixiObstacles,
  usePixiOverlays,
  usePixiSpeechBubbles,
  usePixiTokens,
  usePixiWalls,
  type LightSource
} from "./render2d";
import { CombatSetupScreen } from "./ui/CombatSetupScreen";
import { CombatStatusPanel } from "./ui/CombatStatusPanel";
import { EnemiesPanel } from "./ui/EnemiesPanel";
import { GameOverOverlay } from "./ui/GameOverOverlay";
import { InitiativePanel } from "./ui/InitiativePanel";
import { NarrationPanel } from "./ui/NarrationPanel";
import { ActionsPanel } from "./ui/ActionsPanel";
import { DicePanel } from "./ui/DicePanel";
import { EffectsPanel } from "./ui/EffectsPanel";
import { LogPanel } from "./ui/LogPanel";
import { ActionWheelMenu } from "./ui/ActionWheelMenu";
import type { WheelMenuItem } from "./ui/RadialWheelMenu";
import { ActionContextWindow } from "./ui/ActionContextWindow";
import { InteractionContextWindow } from "./ui/InteractionContextWindow";
import { BottomDock } from "./ui/BottomDock";
import { boardThemeColor, colorToCssHex } from "./boardTheme";
import type { InteractionCost, InteractionSpec } from "./game/interactions";
import {
  buildMovementProfileFromMode,
  getDefaultMovementMode,
  getMovementModesForCharacter,
  type MovementModeDefinition
} from "./game/movementModes";
import { preloadObstaclePngTextures } from "./obstacleTextureHelper";
import { preloadTokenPngTextures } from "./tokenTextureHelper";

const ACTION_MODULES: Record<string, ActionDefinition> = {
  "./melee-strike.json": meleeStrike as ActionDefinition,
  "./dash.json": dashAction as ActionDefinition,
  "./second-wind.json": secondWind as ActionDefinition,
  "./throw-dagger.json": throwDagger as ActionDefinition,
  "./torch-toggle.json": torchToggle as ActionDefinition,
  "./enemy-move.json": enemyMove as ActionDefinition,
  "./enemy-melee-strike.json": enemyMeleeStrike as ActionDefinition,
  "./enemy-bow-shot.json": enemyBowShot as ActionDefinition
};

const ENEMY_TYPE_MODULES: Record<string, EnemyTypeDefinition> = {
  "./brute.json": bruteType as EnemyTypeDefinition,
  "./archer.json": archerType as EnemyTypeDefinition,
  "./assassin.json": assassinType as EnemyTypeDefinition,
  "./ghost.json": ghostType as EnemyTypeDefinition
};

function buildCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

function loadEnemyTypesFromIndex(): EnemyTypeDefinition[] {
  const indexed = Array.isArray((enemyTypesIndex as any).types)
    ? ((enemyTypesIndex as any).types as string[])
    : [];

  const loaded: EnemyTypeDefinition[] = [];
  for (const path of indexed) {
    const mod = ENEMY_TYPE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[enemy-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[enemy-types] No enemy types loaded from index.json");
  }

  return loaded;
}

  function createEnemy(
    index: number,
    enemyType: EnemyTypeDefinition,
    position: { x: number; y: number }
  ): TokenState {
  const { x, y } = position;
  const base = enemyType.baseStats;
  return {
    id: `enemy-${index + 1}`,
    type: "enemy",
    enemyTypeId: enemyType.id,
    enemyTypeLabel: enemyType.label,
    aiRole: enemyType.aiRole,
      actionIds: Array.isArray((enemyType as any).actions)
        ? ((enemyType as any).actions as string[])
        : null,
      appearance: enemyType.appearance,
      speechProfile: enemyType.speechProfile ?? null,
      moveRange: base.moveRange,
    attackDamage: base.attackDamage,
    attackRange: typeof base.attackRange === "number" ? base.attackRange : 1,
    maxAttacksPerTurn:
      typeof base.maxAttacksPerTurn === "number" ? base.maxAttacksPerTurn : 1,
    armorClass: base.armorClass,
    movementProfile: enemyType.movement
      ? (enemyType.movement as MovementProfile)
      : {
          type: "ground",
          speed: enemyType.baseStats.moveRange,
          canPassThroughWalls: false,
          canPassThroughEntities: false,
          canStopOnOccupiedTile: false
        },
    facing: "left",
    visionProfile: enemyType.vision
      ? (enemyType.vision as VisionProfile)
      : {
          shape: "cone",
          range: 100,
          apertureDeg: 180
        },
    footprint: enemyType.footprint,
    x,
    y,
    hp: base.hp,
    maxHp: base.hp
  };
}

function computeEnemySpawnPosition(
  index: number,
  cols: number,
  rows: number
): { x: number; y: number } {
  // On remplit colonne par colonne, en partant de la droite,
  // en descendant de haut en bas, sans chevauchement.
  const colIndex = Math.floor(index / rows);
  const rowIndex = index % rows;

  const x = Math.max(0, cols - 1 - colIndex);
  const y = rowIndex;

  return { x, y };
}

const ENEMY_CAPABILITIES: { action: EnemyActionType; label: string; color: string }[] = [
  {
    action: "move",
    label: "Se deplacer jusqu'a 3 cases (diagonales ok)",
    color: "#2ecc71"
  },
  {
    action: "attack",
    label: "Attaque le joueur a distance 1 (2 degats)",
    color: "#e74c3c"
  },
  {
    action: "wait",
    label: "Attend si aucune action viable",
    color: "#7f8c8d"
  }
];

const PLAYER_TORCH_RADIUS = 4;


// -------------------------------------------------------------
// Main component
// -------------------------------------------------------------

export const GameBoard: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement | null>(null);
  const narrationPendingRef = useRef<boolean>(false);
  const playerBubbleTimeoutRef = useRef<number | null>(null);
  const movementModes = useMemo(
    () => getMovementModesForCharacter(sampleCharacter),
    []
  );
  const defaultMovementMode = movementModes[0] ?? getDefaultMovementMode();
  const defaultMovementProfile = buildMovementProfileFromMode(defaultMovementMode);
  const defaultPlayerVisionProfile: VisionProfile =
    sampleCharacter.visionProfile ?? {
      shape: "cone",
      range: 100,
      apertureDeg: 180,
      lightVision: "normal"
    };

  const [log, setLog] = useState<string[]>([]);
  const [narrativeLog, setNarrativeLog] = useState<string[]>([]);
  const [speechBubbles, setSpeechBubbles] = useState<SpeechBubbleEntry[]>([]);

    const [player, setPlayer] = useState<TokenState>({
      id: "player-1",
      type: "player",
      appearance: sampleCharacter.appearance,
      x: 0,
      y: Math.floor(GRID_ROWS / 2),
    facing: "right",
    movementProfile: defaultMovementProfile,
    moveRange: defaultMovementProfile.speed,
    visionProfile: defaultPlayerVisionProfile,
    hp: sampleCharacter.pvActuels,
    maxHp: sampleCharacter.pvMax
  });

  const [enemyTypes, setEnemyTypes] = useState<EnemyTypeDefinition[]>([]);
  const [enemies, setEnemies] = useState<TokenState[]>([]);
  const [obstacleTypes, setObstacleTypes] = useState<ObstacleTypeDefinition[]>([]);
  const [obstacles, setObstacles] = useState<ObstacleInstance[]>([]);
  const [wallTypes, setWallTypes] = useState<WallTypeDefinition[]>([]);
  const [wallSegments, setWallSegments] = useState<WallSegment[]>([]);
  const [decorations, setDecorations] = useState<DecorInstance[]>([]);
  const [playableCells, setPlayableCells] = useState<Set<string> | null>(null);
  const [mapTerrain, setMapTerrain] = useState<TerrainCell[]>([]);
  const [mapHeight, setMapHeight] = useState<number[]>([]);
  const [mapLight, setMapLight] = useState<number[]>([]);
  const [roofOpenCells, setRoofOpenCells] = useState<Set<string> | null>(null);
  const [mapGrid, setMapGrid] = useState<{ cols: number; rows: number }>({
    cols: GRID_COLS,
    rows: GRID_ROWS
  });
  const [mapTheme, setMapTheme] = useState<MapTheme>("generic");
  const [mapPaletteId, setMapPaletteId] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<number>(0);

  const [phase, setPhase] = useState<TurnPhase>("player");
  const [round, setRound] = useState<number>(1);
  const [isResolvingEnemies, setIsResolvingEnemies] = useState<boolean>(false);
  const [hasRolledInitiative, setHasRolledInitiative] = useState<boolean>(false);
  const [playerInitiative, setPlayerInitiative] = useState<number | null>(null);
  const [turnOrder, setTurnOrder] = useState<TurnEntry[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [isCombatConfigured, setIsCombatConfigured] = useState<boolean>(false);
  const [configEnemyCount, setConfigEnemyCount] = useState<number>(3);
  const [mapPrompt, setMapPrompt] = useState<string>("");

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 0.1;
  const DEFAULT_ZOOM = 1.5;
  const [boardZoom, setBoardZoom] = useState<number>(DEFAULT_ZOOM);
  const [boardPan, setBoardPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningBoard, setIsPanningBoard] = useState<boolean>(false);
  const panDragRef = useRef<{ x: number; y: number } | null>(null);

  const boardBackgroundColor = boardThemeColor(mapTheme);

  const {
    depthLayerRef,
    pathLayerRef,
    speechLayerRef,
    labelLayerRef,
    viewportRef,
    pixiReadyTick
  } = usePixiBoard({
    enabled: isCombatConfigured,
    containerRef: pixiContainerRef,
    zoom: boardZoom,
    panX: boardPan.x,
    panY: boardPan.y,
    backgroundColor: boardBackgroundColor,
    playableCells,
    terrain: mapTerrain,
    grid: mapGrid
  });

  // Actions loaded from JSON
  const [actionsCatalog, setActionsCatalog] = useState<ActionDefinition[]>([]);
  // Player actions loaded from JSON (exclude enemy-tagged actions)
  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [validatedActionId, setValidatedActionId] = useState<string | null>(null);
  const [advantageMode, setAdvantageMode] =
    useState<AdvantageMode>("normal");
  const [attackRoll, setAttackRoll] = useState<AttackRollResult | null>(null);
  const [damageRoll, setDamageRoll] = useState<DamageRollResult | null>(null);
  const [diceLogs, setDiceLogs] = useState<string[]>([]);
  const [hasRolledAttackForCurrentAction, setHasRolledAttackForCurrentAction] =
    useState<boolean>(false);
  const [turnActionUsage, setTurnActionUsage] = useState<{
    usedAction: boolean;
    usedBonus: boolean;
  }>({ usedAction: false, usedBonus: false });
  const [actionUsageCounts, setActionUsageCounts] = useState<{
    turn: Record<string, number>;
    encounter: Record<string, number>;
  }>({ turn: {}, encounter: {} });
  const [playerResources, setPlayerResources] = useState<Record<string, number>>({
    "bandolier:dagger": 3,
    "gear:torch": 1
  });
  const [pathLimit, setPathLimit] = useState<number>(defaultMovementProfile.speed);
  const [activeMovementModeId, setActiveMovementModeId] = useState<string>(
    defaultMovementMode.id
  );

  // Player movement path (limited to 5 cells)
  const [selectedPath, setSelectedPath] = useState<{ x: number; y: number }[]>(
    []
  );
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedObstacleTarget, setSelectedObstacleTarget] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedWallTarget, setSelectedWallTarget] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [targetMode, setTargetMode] = useState<"none" | "selecting">("none");
  type BoardInteractionMode =
    | "idle"
    | "moving"
    | "inspect-select"
    | "look-select"
    | "interact-select";
  const [interactionMode, setInteractionMode] =
    useState<BoardInteractionMode>("idle");
  type InteractionTarget =
    | { kind: "wall"; segmentId: string; cell: { x: number; y: number } }
    | { kind: "obstacle"; obstacleId: string; cell: { x: number; y: number } };
  const [interactionContext, setInteractionContext] = useState<{
    anchorX: number;
    anchorY: number;
    interaction: InteractionSpec;
    target: InteractionTarget;
  } | null>(null);
  const [interactionMenuItems, setInteractionMenuItems] = useState<WheelMenuItem[]>([]);
  const [revealedEnemyIds, setRevealedEnemyIds] = useState<Set<string>>(
    () => new Set()
  );
  const [revealedCells, setRevealedCells] = useState<Set<string>>(
    () => new Set()
  );
  const [radialMenu, setRadialMenu] = useState<{
    open: boolean;
    anchorX: number;
    anchorY: number;
    cell: { x: number; y: number };
    token: TokenState | null;
  } | null>(null);
  const [actionContext, setActionContext] = useState<{
    anchorX: number;
    anchorY: number;
    actionId: string;
    stage: "draft" | "active";
  } | null>(null);

  // Area-of-effect specs attached to the player
  const [effectSpecs, setEffectSpecs] = useState<EffectSpec[]>([]);
  const [showVisionDebug, setShowVisionDebug] = useState<boolean>(false);
  const [showLightOverlay, setShowLightOverlay] = useState<boolean>(true);
  const [showAllLevels, setShowAllLevels] = useState<boolean>(false);
  const [playerTorchOn, setPlayerTorchOn] = useState<boolean>(false);
  const [showCellIds, setShowCellIds] = useState<boolean>(false);

  // Debug IA ennemie : dernier ??tat envoy?? / d??cisions / erreur
  const [aiLastState, setAiLastState] =
    useState<EnemyAiStateSummary | null>(null);
  const [aiLastDecisions, setAiLastDecisions] =
    useState<EnemyDecision[] | null>(null);
  const [aiLastIntents, setAiLastIntents] =
    useState<EnemyActionIntent[] | null>(null);
  const [aiLastError, setAiLastError] = useState<string | null>(null);
  const [aiUsedFallback, setAiUsedFallback] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  const obstacleBlocking = useMemo(() => {
    const obstacleSets = buildObstacleBlockingSets(obstacleTypes, obstacles);
    return {
      movement: new Set([...obstacleSets.movement]),
      vision: new Set([...obstacleSets.vision]),
      attacks: new Set([...obstacleSets.attacks]),
      occupied: new Set([...obstacleSets.occupied])
    };
  }, [obstacleTypes, obstacles]);

  const wallEdges = useMemo(
    () => buildWallEdgeSets(wallSegments),
    [wallSegments]
  );
  const closedCells = useMemo(() => {
    if (!wallSegments.length) return null;
    return computeClosedCells({
      cols: mapGrid.cols,
      rows: mapGrid.rows,
      playableCells: playableCells ?? null,
      walls: wallSegments
    });
  }, [mapGrid, playableCells, wallSegments]);
  const obstacleTypeById = useMemo(() => {
    const map = new Map<string, ObstacleTypeDefinition>();
    for (const t of obstacleTypes) map.set(t.id, t);
    return map;
  }, [obstacleTypes]);
  const wallTypeById = useMemo(() => {
    const map = new Map<string, WallTypeDefinition>();
    for (const t of wallTypes) map.set(t.id, t);
    return map;
  }, [wallTypes]);
  const hasAnyInteractionSource = useMemo(() => {
    const wallHas = wallSegments.some(seg => {
      const def = seg.typeId ? wallTypeById.get(seg.typeId) ?? null : null;
      return (def?.behavior?.interactions ?? []).length > 0;
    });
    if (wallHas) return true;
    return obstacles.some(obs => {
      const def = obstacleTypeById.get(obs.typeId) ?? null;
      return (def?.interactions ?? []).length > 0;
    });
  }, [obstacleTypeById, obstacles, wallSegments, wallTypeById]);
  const obstacleLegend = useMemo(() => {
    return obstacles
      .filter(o => o.hp > 0)
      .map(o => {
        const def = obstacleTypeById.get(o.typeId) ?? null;
        const orientation = o.orientation ?? orientationFromRotationDeg(o.rotation ?? 0);
        return {
          id: o.id,
          label: def?.label ?? o.typeId,
          orientation
        };
      });
  }, [obstacleTypeById, obstacles]);
  const lightSources = useMemo(() => {
    const sources: LightSource[] = [];
    for (const obs of obstacles) {
      if (obs.hp <= 0) continue;
      const def = obstacleTypeById.get(obs.typeId);
      const radiusRaw = def?.light?.radius;
      const radius = Number.isFinite(radiusRaw) ? Math.floor(radiusRaw as number) : 0;
      if (radius <= 0) continue;
      sources.push({ x: obs.x, y: obs.y, radius, color: def?.light?.color });
    }
    return sources;
  }, [obstacles, obstacleTypeById]);
  const activeLightSources = useMemo(() => {
    const sources = [...lightSources];
    if (playerTorchOn) {
      sources.push({
        x: player.x,
        y: player.y,
        radius: Math.max(1, Math.floor(PLAYER_TORCH_RADIUS)),
        color: 0xffb36b
      });
    }
    return sources;
  }, [lightSources, player.x, player.y, playerTorchOn]);
  const isNight = useMemo(() => {
    if (!Array.isArray(mapLight) || mapLight.length === 0) return false;
    const total = mapLight.reduce((acc, value) => acc + (Number(value) || 0), 0);
    const avg = total / mapLight.length;
    return avg < LIGHT_LEVEL_SHADOW_MIN;
  }, [mapLight]);

  const levelRange = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const value of mapHeight) {
      if (!Number.isFinite(value)) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    for (const obs of obstacles) {
      const def = obstacleTypeById.get(obs.typeId);
      const connects = def?.connects;
      if (!connects) continue;
      min = Math.min(min, connects.from, connects.to);
      max = Math.max(max, connects.from, connects.to);
    }
    return { min, max };
  }, [mapHeight, obstacles, obstacleTypeById]);

  const floorVisionBlockersByLevel = useMemo(() => {
    const blockers = new Map<number, Set<string>>();
    const cols = mapGrid.cols;
    const rows = mapGrid.rows;
    if (!Array.isArray(mapTerrain) || mapTerrain.length === 0) return blockers;

    const addBlocker = (level: number, x: number, y: number) => {
      let set = blockers.get(level);
      if (!set) {
        set = new Set<string>();
        blockers.set(level, set);
      }
      set.add(buildCellKey(x, y));
    };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        if (idx < 0 || idx >= mapTerrain.length) continue;
        const floorId = mapTerrain[idx];
        const mat = getFloorMaterial(floorId);
        if (!mat?.blocksVision) continue;
        const level = getHeightAtGrid(mapHeight, cols, rows, x, y);
        addBlocker(level, x, y);
      }
    }

    return blockers;
  }, [mapGrid, mapHeight, mapTerrain]);

  const visionBlockersByLevel = useMemo(() => {
    const blockers = new Map<number, Set<string>>();
    const addBlocker = (level: number, x: number, y: number) => {
      let set = blockers.get(level);
      if (!set) {
        set = new Set<string>();
        blockers.set(level, set);
      }
      set.add(buildCellKey(x, y));
    };
    const heightAt = (x: number, y: number) =>
      getHeightAtGrid(mapHeight, mapGrid.cols, mapGrid.rows, x, y);

    for (const obs of obstacles) {
      if (obs.hp <= 0) continue;
      const def = obstacleTypeById.get(obs.typeId) ?? null;
      if (!def?.blocking?.vision) continue;
      const cells = getObstacleOccupiedCells(obs, def);
      for (const cell of cells) {
        const level = heightAt(cell.x, cell.y);
        addBlocker(level, cell.x, cell.y);
      }
    }

    for (const [level, cells] of floorVisionBlockersByLevel.entries()) {
      let set = blockers.get(level);
      if (!set) {
        set = new Set<string>();
        blockers.set(level, set);
      }
      for (const cell of cells) {
        set.add(cell);
      }
    }

    return blockers;
  }, [mapGrid, mapHeight, obstacles, obstacleTypeById, floorVisionBlockersByLevel]);

  const visionBlockersActive = useMemo(() => {
    const floorBlockers = floorVisionBlockersByLevel.get(activeLevel) ?? new Set<string>();
    if (floorBlockers.size === 0) return new Set([...obstacleBlocking.vision]);
    return new Set([...obstacleBlocking.vision, ...floorBlockers]);
  }, [activeLevel, floorVisionBlockersByLevel, obstacleBlocking.vision]);
  const lightLevels = useMemo(() => {
    if (mapGrid.cols <= 0 || mapGrid.rows <= 0) return [];
    return computeLightLevels({
      grid: mapGrid,
      mapLight,
      lightSources: activeLightSources,
      obstacleVisionCells: visionBlockersActive,
      wallVisionEdges: wallEdges.vision,
      closedCells,
      roofOpenCells: roofOpenCells ?? null
    });
  }, [
    activeLightSources,
    closedCells,
    mapGrid,
    mapLight,
    roofOpenCells,
    visionBlockersActive,
    wallEdges.vision
  ]);
  const lightTints = useMemo(() => {
    if (mapGrid.cols <= 0 || mapGrid.rows <= 0) return null;
    return computeLightTints({
      grid: mapGrid,
      lightSources: activeLightSources,
      obstacleVisionCells: visionBlockersActive,
      wallVisionEdges: wallEdges.vision
    });
  }, [activeLightSources, mapGrid, visionBlockersActive, wallEdges.vision]);
  const playerLightMode = useMemo<LightVisionMode>(() => {
    const profile = player.visionProfile;
    const raw =
      profile?.lightVision ??
      (profile?.canSeeInDark ? "darkvision" : "normal");
    return resolveLightVisionMode(raw);
  }, [player.visionProfile]);

  const visionBlockersForVisibility = useMemo(() => {
    const combined = new Map<number, Set<string>>();
    const activeBlockers = visionBlockersByLevel.get(activeLevel) ?? new Set<string>();

    for (let level = levelRange.min; level <= levelRange.max; level++) {
      const levelBlockers = visionBlockersByLevel.get(level) ?? new Set<string>();
      if (level === activeLevel || activeBlockers.size === 0) {
        combined.set(level, levelBlockers);
        continue;
      }
      if (levelBlockers.size === 0) {
        combined.set(level, activeBlockers);
        continue;
      }
      combined.set(level, new Set([...activeBlockers, ...levelBlockers]));
    }

    return combined;
  }, [activeLevel, levelRange.min, levelRange.max, visionBlockersByLevel]);

  const visibilityByLevel = useMemo(() => {
    if (showAllLevels) return null;
    const perLevel = new Map<number, Map<string, VisibilityLevel>>();
    const hasLight = lightLevels.length > 0;

    for (let level = levelRange.min; level <= levelRange.max; level++) {
      const blockers = visionBlockersForVisibility.get(level) ?? new Set<string>();
      const baseVisibility = computeVisibilityLevelsForToken({
        token: player,
        playableCells: playableCells ?? null,
        grid: mapGrid,
        opaqueCells: blockers,
        wallVisionEdges: wallEdges.vision
      });
      const filtered = new Map<string, VisibilityLevel>();
      for (const [key, vis] of baseVisibility.entries()) {
        const [xs, ys] = key.split(",");
        const x = Number(xs);
        const y = Number(ys);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (hasLight) {
          const idx = y * mapGrid.cols + x;
          const light = lightLevels[idx] ?? 0;
          if (!isLightVisible(light, playerLightMode)) continue;
        }
        const cellLevel = getHeightAtGrid(mapHeight, mapGrid.cols, mapGrid.rows, x, y);
        if (cellLevel !== level) continue;
        filtered.set(key, vis);
      }
      const playerLevel = getHeightAtGrid(
        mapHeight,
        mapGrid.cols,
        mapGrid.rows,
        player.x,
        player.y
      );
      if (playerLevel === level) {
        filtered.set(buildCellKey(player.x, player.y), 2);
      }
      perLevel.set(level, filtered);
    }

    return perLevel;
  }, [
    activeLevel,
    levelRange.min,
    levelRange.max,
    lightLevels,
    mapGrid,
    mapHeight,
    player,
    playerLightMode,
    playableCells,
    showAllLevels,
    visionBlockersForVisibility,
    wallEdges
  ]);
  const visionByLevel = useMemo(() => {
    if (showAllLevels) return null;
    const perLevel = new Map<number, Map<string, VisibilityLevel>>();

    for (let level = levelRange.min; level <= levelRange.max; level++) {
      const blockers = visionBlockersForVisibility.get(level) ?? new Set<string>();
      const baseVisibility = computeVisibilityLevelsForToken({
        token: player,
        playableCells: playableCells ?? null,
        grid: mapGrid,
        opaqueCells: blockers,
        wallVisionEdges: wallEdges.vision
      });
      const filtered = new Map<string, VisibilityLevel>();
      for (const [key, vis] of baseVisibility.entries()) {
        const [xs, ys] = key.split(",");
        const x = Number(xs);
        const y = Number(ys);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const cellLevel = getHeightAtGrid(mapHeight, mapGrid.cols, mapGrid.rows, x, y);
        if (cellLevel !== level) continue;
        filtered.set(key, vis);
      }
      const playerLevel = getHeightAtGrid(
        mapHeight,
        mapGrid.cols,
        mapGrid.rows,
        player.x,
        player.y
      );
      if (playerLevel === level) {
        filtered.set(buildCellKey(player.x, player.y), 2);
      }
      perLevel.set(level, filtered);
    }

    return perLevel;
  }, [
    activeLevel,
    levelRange.min,
    levelRange.max,
    mapGrid,
    mapHeight,
    player,
    playableCells,
    showAllLevels,
    visionBlockersForVisibility,
    wallEdges
  ]);

  const visibilityLevels = useMemo<Map<string, VisibilityLevel> | null>(() => {
    if (showAllLevels) return null;
    const union = new Map<string, VisibilityLevel>();
    if (!visibilityByLevel) return union;
    for (const levelMap of visibilityByLevel.values()) {
      for (const [key, vis] of levelMap.entries()) {
        const prev = union.get(key) ?? 0;
        if (vis > prev) union.set(key, vis);
      }
    }
    return union;
  }, [showAllLevels, visibilityByLevel]);

  const visibleCellsFull = useMemo<Set<string> | null>(() => {
    if (showAllLevels) return null;
    const full = new Set<string>();
    if (!visibilityLevels) return full;
    for (const [key, vis] of visibilityLevels.entries()) {
      if (vis >= 2) full.add(key);
    }
    return full;
  }, [showAllLevels, visibilityLevels]);
  const visionCellsFull = useMemo<Set<string> | null>(() => {
    if (showAllLevels) return null;
    const full = new Set<string>();
    if (!visionByLevel) return full;
    for (const levelMap of visionByLevel.values()) {
      for (const [key, vis] of levelMap.entries()) {
        if (vis >= 2) full.add(key);
      }
    }
    return full;
  }, [showAllLevels, visionByLevel]);

  const visionLegend = useMemo(() => {
    const modeFor = (profile?: VisionProfile | null) => {
      const raw =
        profile?.lightVision ?? (profile?.canSeeInDark ? "darkvision" : "normal");
      return resolveLightVisionMode(raw);
    };
    const playerMode = modeFor(player.visionProfile);
    const enemyModes = enemyTypes
      .map(t => `${t.label ?? t.id}: ${modeFor(t.vision as VisionProfile | undefined)}`)
      .join(", ");
    return enemyModes.length > 0
      ? `Vision: joueur=${playerMode} | ennemis: ${enemyModes}`
      : `Vision: joueur=${playerMode}`;
  }, [enemyTypes, player.visionProfile]);

  function clampActiveLevel(value: number): number {
    return Math.max(levelRange.min, Math.min(levelRange.max, value));
  }

  function getBaseHeightAt(x: number, y: number): number {
    return getHeightAtGrid(mapHeight, mapGrid.cols, mapGrid.rows, x, y);
  }

  function isCellVisibleForPlayer(x: number, y: number): boolean {
    if (showAllLevels) return true;
    if (!visibilityLevels) return false;
    const level = visibilityLevels.get(buildCellKey(x, y)) ?? 0;
    return level > 0;
  }

  useEffect(() => {
    setActiveLevel(prev => clampActiveLevel(prev));
  }, [levelRange.min, levelRange.max]);

  useEffect(() => {
    void preloadObstaclePngTextures();
    void preloadTokenPngTextures();
  }, []);

  usePixiWalls({
    depthLayerRef,
    walls: wallSegments,
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels
  });
  usePixiObstacles({
    depthLayerRef,
    obstacleTypes,
    obstacles,
    tokens: [player, ...enemies],
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels,
    paletteId: mapPaletteId
  });
  usePixiDecorations({
    depthLayerRef,
    decorations,
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels
  });
  usePixiTokens({
    depthLayerRef,
    player,
    enemies,
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels
  });
  usePixiSpeechBubbles({
    speechLayerRef,
    player,
    enemies,
    speechBubbles,
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels
  });
  const selectedStructureCell = selectedObstacleTarget ?? selectedWallTarget;
  usePixiOverlays({
    pathLayerRef,
    player,
    enemies,
    selectedPath,
    effectSpecs,
    selectedTargetId,
    selectedObstacleCell: selectedStructureCell
      ? { x: selectedStructureCell.x, y: selectedStructureCell.y }
      : null,
    obstacleVisionCells: visionBlockersActive,
    wallVisionEdges: wallEdges.vision,
    closedCells,
    showVisionDebug,
    visibleCells: visibleCellsFull,
    visionCells: visionCellsFull,
    visibilityLevels,
    showAllLevels,
    lightMap: mapLight,
    lightSources,
    showLightOverlay,
    lightLevels,
    lightTints,
    isNight,
    playerTorchOn,
    playerTorchRadius: PLAYER_TORCH_RADIUS,
    pixiReadyTick,
    playableCells,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel
  });
  usePixiGridLabels({
    labelLayerRef,
    showLabels: showCellIds,
    playableCells,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    obstacles,
    obstacleTypes,
    pixiReadyTick
  });

  const INSPECT_RANGE = 10;

  function closeRadialMenu() {
    setRadialMenu(current => (current ? { ...current, open: false } : null));
    if (interactionMode === "interact-select") {
      setInteractionMode("idle");
    }
    setInteractionMenuItems([]);
    closeInteractionContext();
  }

  function closeInteractionContext() {
    setInteractionContext(null);
  }

  function cellKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  function isCellPlayable(x: number, y: number): boolean {
    if (!isCellInsideGrid(x, y, mapGrid.cols, mapGrid.rows)) return false;
    if (!playableCells || playableCells.size === 0) return true;
    return playableCells.has(cellKey(x, y));
  }

  function findObstacleAtCell(
    x: number,
    y: number
  ): { instance: ObstacleInstance; def: ObstacleTypeDefinition | null } | null {
    if (getBaseHeightAt(x, y) !== activeLevel) return null;
    for (const obs of obstacles) {
      if (obs.hp <= 0) continue;
      const def = obstacleTypeById.get(obs.typeId) ?? null;
      const cells = getObstacleOccupiedCells(obs, def);
      if (cells.some(c => c.x === x && c.y === y)) {
        return { instance: obs, def };
      }
    }
    return null;
  }

  function findObstacleAtCellAnyLevel(
    x: number,
    y: number
  ): { instance: ObstacleInstance; def: ObstacleTypeDefinition | null } | null {
    for (const obs of obstacles) {
      if (obs.hp <= 0) continue;
      const def = obstacleTypeById.get(obs.typeId) ?? null;
      const cells = getObstacleOccupiedCells(obs, def);
      if (cells.some(c => c.x === x && c.y === y)) {
        return { instance: obs, def };
      }
    }
    return null;
  }

  function findWallSegmentAtCell(
    x: number,
    y: number
  ): { segment: WallSegment; def: WallTypeDefinition | null } | null {
    if (getBaseHeightAt(x, y) !== activeLevel) return null;
    for (const seg of wallSegments) {
      if (typeof seg.hp === "number" && seg.hp <= 0) continue;
      const cells = getAdjacentCellsForEdge(seg);
      if ((cells.a.x === x && cells.a.y === y) || (cells.b.x === x && cells.b.y === y)) {
        const def = seg.typeId ? wallTypeById.get(seg.typeId) ?? null : null;
        return { segment: seg, def };
      }
    }
    return null;
  }

  function findWallSegmentAtCellAnyLevel(
    x: number,
    y: number
  ): { segment: WallSegment; def: WallTypeDefinition | null } | null {
    for (const seg of wallSegments) {
      if (typeof seg.hp === "number" && seg.hp <= 0) continue;
      const cells = getAdjacentCellsForEdge(seg);
      if ((cells.a.x === x && cells.a.y === y) || (cells.b.x === x && cells.b.y === y)) {
        const def = seg.typeId ? wallTypeById.get(seg.typeId) ?? null : null;
        return { segment: seg, def };
      }
    }
    return null;
  }

  function getObstacleDistance(
    from: { x: number; y: number },
    obstacle: ObstacleInstance,
    def: ObstacleTypeDefinition | null,
    targetCell: { x: number; y: number }
  ): number {
    const cells = def ? getObstacleOccupiedCells(obstacle, def) : [targetCell];
    const fromCells = "id" in from ? getTokenOccupiedCells(from) : [from];
    let best = Number.POSITIVE_INFINITY;
    for (const src of fromCells) {
      for (const cell of cells) {
        const dist = Math.abs(src.x - cell.x) + Math.abs(src.y - cell.y);
        if (dist < best) best = dist;
      }
    }
    if (Number.isFinite(best)) return best;
    const fallback = Math.abs(from.x - targetCell.x) + Math.abs(from.y - targetCell.y);
    return fallback;
  }

  function getWallSegmentDistance(from: { x: number; y: number }, segment: WallSegment): number {
    const cells = getAdjacentCellsForEdge(segment);
    const distA = Math.abs(from.x - cells.a.x) + Math.abs(from.y - cells.a.y);
    const distB = Math.abs(from.x - cells.b.x) + Math.abs(from.y - cells.b.y);
    return Math.min(distA, distB);
  }

  function getChebyshevDistanceFromEntity(
    from: { x: number; y: number } | TokenState,
    cells: { x: number; y: number }[]
  ): number {
    const fromCells = "id" in from ? getTokenOccupiedCells(from) : [from];
    return distanceBetweenCells(fromCells, cells);
  }

  function getWallSegmentChebyshevDistance(
    from: { x: number; y: number },
    segment: WallSegment
  ): number {
    const cells = getAdjacentCellsForEdge(segment);
    return getChebyshevDistanceFromEntity(from, [cells.a, cells.b]);
  }

  function getObstacleChebyshevDistance(
    from: { x: number; y: number },
    obstacle: ObstacleInstance,
    def: ObstacleTypeDefinition | null,
    targetCell: { x: number; y: number }
  ): number {
    const cells = def ? getObstacleOccupiedCells(obstacle, def) : [targetCell];
    return getChebyshevDistanceFromEntity(from, cells);
  }

  function canPayInteractionCost(cost?: InteractionCost): { ok: boolean; reason?: string } {
    if (!canInteractWithBoard) {
      return { ok: false, reason: "Tour joueur requis." };
    }
    if (cost === "action" && turnActionUsage.usedAction) {
      return { ok: false, reason: "Action principale deja utilisee." };
    }
    if (cost === "bonus" && turnActionUsage.usedBonus) {
      return { ok: false, reason: "Action bonus deja utilisee." };
    }
    return { ok: true };
  }

  function applyInteractionCost(cost?: InteractionCost) {
    const isStandardAction = cost === "action";
    const isBonusAction = cost === "bonus";
    if (!isStandardAction && !isBonusAction) return;
    setTurnActionUsage(prev => ({
      usedAction: prev.usedAction || isStandardAction,
      usedBonus: prev.usedBonus || isBonusAction
    }));
  }

  function resolveInteractionAvailabilityForWall(
    interaction: InteractionSpec,
    segment: WallSegment,
    def: WallTypeDefinition | null
  ): { ok: boolean; reason?: string } {
    const costCheck = canPayInteractionCost(interaction.cost);
    if (!costCheck.ok) return costCheck;

    if (interaction.kind === "open") {
      if (segment.kind !== "door") {
        return { ok: false, reason: "Interaction reservee aux portes." };
      }
      if (segment.state === "open") {
        return { ok: false, reason: "La porte est deja ouverte." };
      }
      return { ok: true };
    }

    if (interaction.kind === "break") {
      if (segment.kind !== "door") {
        return { ok: false, reason: "Interaction reservee aux portes." };
      }
      if (segment.state === "open") {
        return { ok: false, reason: "La porte est deja ouverte." };
      }
      if (!isWallDestructible(def)) {
        return { ok: false, reason: "Porte indestructible." };
      }
      if (typeof interaction.forceDc !== "number") {
        return { ok: false, reason: "DD de force manquant." };
      }
      return { ok: true };
    }

    return { ok: true };
  }

  function resolveInteractionAvailabilityForObstacle(
    interaction: InteractionSpec,
    obstacle: ObstacleInstance,
    def: ObstacleTypeDefinition | null
  ): { ok: boolean; reason?: string } {
    const costCheck = canPayInteractionCost(interaction.cost);
    if (!costCheck.ok) return costCheck;

    if (interaction.kind === "open") {
      return { ok: false, reason: "Interaction reservee aux portes." };
    }

    if (interaction.kind === "break") {
      if (def?.durability?.destructible === false) {
        return { ok: false, reason: "Obstacle indestructible." };
      }
      if (obstacle.hp <= 0) {
        return { ok: false, reason: "Obstacle deja detruit." };
      }
      if (typeof interaction.forceDc !== "number") {
        return { ok: false, reason: "DD de force manquant." };
      }
    }

    return { ok: true };
  }

  function getInteractionAvailability(
    interaction: InteractionSpec,
    target: InteractionTarget
  ): { ok: boolean; reason?: string } {
    if (target.kind === "wall") {
      const wall = wallSegments.find(w => w.id === target.segmentId) ?? null;
      if (!wall) return { ok: false, reason: "Mur introuvable." };
      const def = wall.typeId ? wallTypeById.get(wall.typeId) ?? null : null;
      const dist = getWallSegmentChebyshevDistance(player, wall);
      if (dist > 1) return { ok: false, reason: "Trop loin." };
      return resolveInteractionAvailabilityForWall(interaction, wall, def);
    }
    const obstacle = obstacles.find(o => o.id === target.obstacleId) ?? null;
    if (!obstacle) return { ok: false, reason: "Obstacle introuvable." };
    const def = obstacleTypeById.get(obstacle.typeId) ?? null;
    const dist = getObstacleChebyshevDistance(player, obstacle, def, target.cell);
    if (dist > 1) return { ok: false, reason: "Trop loin." };
    return resolveInteractionAvailabilityForObstacle(interaction, obstacle, def);
  }

  function getSelectedTargetLabel(): string | null {
    if (selectedTargetId) return selectedTargetId;
    if (selectedObstacleTarget) {
      const obstacle = obstacles.find(o => o.id === selectedObstacleTarget.id) ?? null;
      if (!obstacle) return "obstacle";
      const def = obstacleTypeById.get(obstacle.typeId) ?? null;
      return def?.label ?? obstacle.typeId ?? "obstacle";
    }
    if (selectedWallTarget) {
      const wall = wallSegments.find(w => w.id === selectedWallTarget.id) ?? null;
      if (!wall) return "mur";
      const def = wall.typeId ? wallTypeById.get(wall.typeId) ?? null : null;
      return def?.label ?? wall.typeId ?? "mur";
    }
    return null;
  }

  function getMovementModeById(id: string): MovementModeDefinition | null {
    return movementModes.find(mode => mode.id === id) ?? null;
  }

  function handleSelectMovementMode(modeId: string) {
    const mode = getMovementModeById(modeId) ?? defaultMovementMode;
    const profile = buildMovementProfileFromMode(mode);
    setActiveMovementModeId(mode.id);
    setPlayer(prev => ({
      ...prev,
      movementProfile: profile,
      moveRange: profile.speed
    }));
    setPathLimit(profile.speed);
    setInteractionMode("moving");
  }

  function handleCancelMoveFromWheel() {
    handleResetPath();
    setInteractionMode("idle");
  }

  function handleCancelInteractFromWheel() {
    setInteractionMode("idle");
    setInteractionMenuItems([]);
    closeInteractionContext();
  }

  function resourceKey(name: string, pool?: string | null): string {
    return `${pool ?? "default"}:${name}`;
  }

  function getResourceAmount(name: string, pool?: string | null): number {
    const key = resourceKey(name, pool);
    return typeof playerResources[key] === "number" ? playerResources[key] : 0;
  }

  function getTokensOnActiveLevel(tokens: TokenState[]): TokenState[] {
    return tokens.filter(t => getBaseHeightAt(t.x, t.y) === activeLevel);
  }

  function areTokensOnSameLevel(a: TokenState, b: TokenState): boolean {
    return getBaseHeightAt(a.x, a.y) === getBaseHeightAt(b.x, b.y);
  }

  const selectedPathCost = useMemo(() => {
    if (!selectedPath.length) return 0;
    const cols = mapGrid.cols;
    const rows = mapGrid.rows;
    let total = 0;
    for (const cell of selectedPath) {
      if (!isCellInsideGrid(cell.x, cell.y, cols, rows)) continue;
      const idx = cell.y * cols + cell.x;
      if (idx < 0 || idx >= mapTerrain.length) continue;
      const mat = getFloorMaterial(mapTerrain[idx]);
      const cost = Number(mat?.moveCost ?? 1);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      total += cost;
    }
    return Math.round(total * 10) / 10;
  }, [mapGrid, mapTerrain, selectedPath]);

  useEffect(() => {
    if (phase !== "player" || isGameOver) {
      setInteractionMode("idle");
      closeRadialMenu();
      closeInteractionContext();
    }
  }, [phase, isGameOver]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (targetMode === "selecting") {
        setTargetMode("none");
        return;
      }
      if (interactionMode !== "idle") {
        setInteractionMode("idle");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [interactionMode, targetMode]);

  function handleBoardWheel(event: WheelEvent) {
    if (event.deltaY === 0) return;
    event.preventDefault();

    const direction = event.deltaY < 0 ? 1 : -1;
    const nextZoom = clamp(
      Math.round((boardZoom + direction * ZOOM_STEP) * 10) / 10,
      ZOOM_MIN,
      ZOOM_MAX
    );
    if (Math.abs(nextZoom - boardZoom) < 1e-6) return;

    const viewport = viewportRef.current;
    if (!viewport) {
      setBoardZoom(nextZoom);
      return;
    }

    const target = event.currentTarget;
    if (!(target instanceof HTMLDivElement)) return;
    const rect = target.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    const { scale, offsetX, offsetY } = viewport;
    const boardX = (localX - offsetX) / scale;
    const boardY = (localY - offsetY) / scale;

    const boardW = getBoardWidth(mapGrid.cols);
    const boardH = getBoardHeight(mapGrid.rows);
    const baseScale = scale / boardZoom;
    const nextScale = baseScale * nextZoom;

    const nextOffsetX = localX - boardX * nextScale;
    const nextOffsetY = localY - boardY * nextScale;
    const width = Math.max(1, target.clientWidth);
    const height = Math.max(1, target.clientHeight);

    const nextPanX = nextOffsetX - (width - boardW * nextScale) / 2;
    const nextPanY = nextOffsetY - (height - boardH * nextScale) / 2;

    setBoardZoom(nextZoom);
    setBoardPan({ x: nextPanX, y: nextPanY });
  }

  useEffect(() => {
    const container = pixiContainerRef.current;
    if (!container) return;
    const handler = (event: WheelEvent) => {
      handleBoardWheel(event);
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => {
      container.removeEventListener("wheel", handler);
    };
  }, [boardZoom, mapGrid.cols, mapGrid.rows, viewportRef]);

  function describeEnemyLastDecisionLegacy(enemyId: string): string {
    if (aiUsedFallback) {
      return "Fallback local : poursuite/attaque basique du joueur";
    }
    if (aiLastDecisions === null) {
      return "IA non appel??e pour l'instant";
    }
    const decision = aiLastDecisions.find(d => d.enemyId === enemyId);
    if (!decision) {
      return "Aucune d??cision re??ue pour cet ennemi";
    }
    if (decision.action === "move") {
      const tx = typeof decision.targetX === "number" ? decision.targetX : "?";
      const ty = typeof decision.targetY === "number" ? decision.targetY : "?";
      return `D??placement vers (${tx}, ${ty})`;
    }
    if (decision.action === "attack") {
      return "Attaque le joueur (distance 1)";
    }
    return "Attend ce tour";
  }

  function describeEnemyLastDecision(enemyId: string): string {
    if (aiUsedFallback) {
      return "Fallback local : action engine";
    }
    if (aiLastIntents === null) {
      return "IA non appelee pour l'instant";
    }
    const intent = aiLastIntents.find(i => i.enemyId === enemyId);
    if (!intent) {
      return "Aucun intent recu pour cet ennemi";
    }
    if (intent.target?.kind === "cell") {
      return `${intent.actionId} -> (${intent.target.x}, ${intent.target.y})`;
    }
    if (intent.target?.kind === "token") {
      return `${intent.actionId} -> ${intent.target.tokenId}`;
    }
    return intent.actionId;
  }

  function handleStartCombat() {
    if (enemyTypes.length === 0) {
      pushLog(
        "Aucun type d'ennemi charge (enemyTypes). Impossible de generer le combat."
      );
      return;
    }

    let grid = { ...mapGrid };
    let map = generateBattleMap({
      prompt: mapPrompt,
      grid,
      enemyCount: configEnemyCount,
      enemyTypes,
      obstacleTypes,
      wallTypes
    });

    let safety = 0;
    while (safety < 3) {
      const rec = map.recommendedGrid;
      if (!rec || (rec.cols <= grid.cols && rec.rows <= grid.rows)) break;
      pushLog(`[map] Redimensionnement automatique: ${grid.cols}x${grid.rows} -> ${rec.cols}x${rec.rows} (${rec.reason}).`);
      grid = { cols: rec.cols, rows: rec.rows };
      map = generateBattleMap({
        prompt: mapPrompt,
        grid,
        enemyCount: configEnemyCount,
        enemyTypes,
        obstacleTypes,
        wallTypes
      });
      safety++;
    }

    const generationLines = Array.isArray(map.generationLog)
      ? map.generationLog.map(line => `[map] ${line}`)
      : [];
    pushLogBatch([map.summary, ...generationLines]);
    setMapTheme(map.theme ?? "generic");
    setMapPaletteId(map.paletteId ?? null);
    grid = map.grid ?? grid;
    setMapGrid(grid);

    setPlayer(prev => ({
      ...prev,
      x: map.playerStart.x,
      y: map.playerStart.y
    }));

    setObstacles(map.obstacles);
    setWallSegments(Array.isArray(map.wallSegments) ? map.wallSegments : []);
    setPlayableCells(new Set(map.playableCells ?? []));
    setMapTerrain(Array.isArray(map.terrain) ? map.terrain : []);
    const flatHeight = Array(grid.cols * grid.rows).fill(0);
    setMapHeight(flatHeight);
    setMapLight(Array.isArray(map.light) ? map.light : []);
    setRoofOpenCells(new Set(map.roofOpenCells ?? []));
    setActiveLevel(0);
    setDecorations(Array.isArray(map.decorations) ? map.decorations : []);

    const newEnemies: TokenState[] = map.enemySpawns.map((spawn, i) =>
      createEnemy(i, spawn.enemyType, spawn.position)
    );
    setEnemies(newEnemies);
    setRevealedEnemyIds(new Set());
    setRevealedCells(new Set());

    setRound(1);
    setHasRolledInitiative(false);
    setTurnOrder([]);
    setCurrentTurnIndex(0);
    setIsCombatConfigured(true);
    setActionUsageCounts({ turn: {}, encounter: {} });
    setTurnActionUsage({ usedAction: false, usedBonus: false });
    setPlayerResources({ "bandolier:dagger": 3, "gear:torch": 1 });
    setPathLimit(5);
  }

  function getActiveTurnEntry(): TurnEntry | null {
    if (!hasRolledInitiative || turnOrder.length === 0) return null;
    const clampedIndex =
      currentTurnIndex >= 0 && currentTurnIndex < turnOrder.length
        ? currentTurnIndex
        : 0;
    return turnOrder[clampedIndex] ?? null;
  }

  function peekNextTurnEntry(): { entry: TurnEntry | null; willWrap: boolean } {
    if (!hasRolledInitiative || turnOrder.length === 0) {
      return { entry: null, willWrap: false };
    }
    const nextIndex = (currentTurnIndex + 1) % turnOrder.length;
    return { entry: turnOrder[nextIndex] ?? null, willWrap: nextIndex === 0 };
  }

  function advanceTurn() {
    if (turnOrder.length === 0) return;
    setCurrentTurnIndex(prev => {
      const next = (prev + 1) % turnOrder.length;
      if (next === 0) {
        setRound(r => r + 1);
      }
      return next;
    });
  }

  function rollInitialInitiativeIfNeeded() {
    if (hasRolledInitiative) return;

    const playerMod = sampleCharacter.caracs.dexterite.modDEX ?? 0;
    const rollD20 = () => Math.floor(Math.random() * 20) + 1;

    const pjRoll = rollD20();
    const pjTotal = pjRoll + playerMod;

    const entries: TurnEntry[] = [];

    entries.push({
      id: player.id,
      kind: "player",
      initiative: pjTotal
    });

    const enemiesWithInit = enemies.map(enemy => {
      const initRoll = rollD20();
      const totalInit = initRoll;

      entries.push({
        id: enemy.id,
        kind: "enemy",
        initiative: totalInit
      });

      return {
        ...enemy,
        initiative: totalInit
      };
    });

    setPlayerInitiative(pjTotal);
    setEnemies(enemiesWithInit);

    entries.sort((a, b) => b.initiative - a.initiative);

    setTurnOrder(entries);
    setCurrentTurnIndex(0);
    setHasRolledInitiative(true);

    const first = entries[0];
    if (!first) return;

    if (first.kind === "player") {
      pushLog(
        `Initiative: Joueur ${pjTotal} (d20=${pjRoll}, mod=${playerMod}) ??? le joueur commence.`
      );
    } else {
      pushLog(
        `Initiative: Joueur ${pjTotal} (d20=${pjRoll}, mod=${playerMod}) ??? ${first.id} commence (initiative ${first.initiative}).`
      );
    }
  }

  function pushLog(message: string) {
    setLog(prev => [message, ...prev]);
  }

  function pushLogBatch(messages: string[]) {
    const trimmed = messages.filter(Boolean);
    if (!trimmed.length) return;
    setLog(prev => [...trimmed, ...prev]);
  }

  function pushNarrative(message: string) {
    setNarrativeLog(prev => [message, ...prev].slice(0, 20));
  }

  function pushDiceLog(message: string) {
    setDiceLogs(prev => [message, ...prev].slice(0, 6));
    pushLog(message);
  }

  function setEnemyBubble(enemyId: string, line: string) {
    const text = (line ?? "").trim();
    if (!text) return;
    setSpeechBubbles(prev => {
      const filtered = prev.filter(b => b.tokenId !== enemyId);
      return [
        ...filtered,
        { tokenId: enemyId, text, updatedAtRound: round }
      ];
    });
  }

  function clearEnemyBubble(enemyId: string) {
    setSpeechBubbles(prev => prev.filter(b => b.tokenId !== enemyId));
  }

  function setPlayerBubble(textInput: string) {
    const text = (textInput ?? "").trim();
    if (!text) return;

    if (playerBubbleTimeoutRef.current !== null) {
      window.clearTimeout(playerBubbleTimeoutRef.current);
      playerBubbleTimeoutRef.current = null;
    }

    setSpeechBubbles(prev => {
      const filtered = prev.filter(b => b.tokenId !== player.id);
      return [...filtered, { tokenId: player.id, text, updatedAtRound: round }];
    });

    playerBubbleTimeoutRef.current = window.setTimeout(() => {
      setSpeechBubbles(prev => prev.filter(b => b.tokenId !== player.id));
    }, 2600);
  }

  function buildCombatStateSummaryFrom(
    focusSide: CombatSide,
    playerState: TokenState,
    enemiesState: TokenState[]
  ): CombatStateSummary {
    const actors = [
      {
        id: playerState.id,
        kind: "player" as const,
        label: "Heros",
        aiRole: null,
        enemyTypeId: null,
        x: playerState.x,
        y: playerState.y,
        hp: playerState.hp,
        maxHp: playerState.maxHp
      },
      ...enemiesState.map(e => ({
        id: e.id,
        kind: "enemy" as const,
        label: e.enemyTypeLabel || e.enemyTypeId || e.id,
        aiRole: e.aiRole ?? null,
        enemyTypeId: e.enemyTypeId ?? null,
        x: e.x,
        y: e.y,
        hp: e.hp,
        maxHp: e.maxHp
      }))
    ];

    return {
      round,
      phase: focusSide,
      grid: { cols: mapGrid.cols, rows: mapGrid.rows },
      actors
    };
  }

  function buildCombatStateSummary(focusSide: CombatSide): CombatStateSummary {
    return buildCombatStateSummaryFrom(focusSide, player, enemies);
  }

  // -----------------------------------------------------------
  // Load enemy types and instantiate initial enemies
  // -----------------------------------------------------------

  useEffect(() => {
    const loadedTypes = loadEnemyTypesFromIndex();
    setEnemyTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadObstacleTypesFromIndex();
    setObstacleTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadWallTypesFromIndex();
    setWallTypes(loadedTypes);
  }, []);


  useEffect(() => {
    if (!isCombatConfigured) return;
    if (!hasRolledInitiative && enemies.length > 0) {
      rollInitialInitiativeIfNeeded();
    }
  }, [isCombatConfigured, hasRolledInitiative, enemies.length]);

  useEffect(() => {
    setSpeechBubbles(prev =>
      prev.filter(
        b =>
          b.tokenId === player.id ||
          enemies.some(e => e.id === b.tokenId && e.hp > 0)
      )
    );
  }, [enemies, player.id]);

  // -----------------------------------------------------------
  // Load player actions from JSON modules
  // -----------------------------------------------------------

  useEffect(() => {
    const indexed = Array.isArray((actionsIndex as any).actions)
      ? ((actionsIndex as any).actions as string[])
      : [];

    const loaded: ActionDefinition[] = [];
    for (const path of indexed) {
      const mod = ACTION_MODULES[path];
      if (mod) {
        loaded.push(mod);
      } else {
        console.warn("[actions] Action path missing in bundle:", path);
      }
    }

    if (loaded.length === 0) {
      console.warn("[actions] No actions loaded from index.json");
    }

    setActionsCatalog(loaded);

    const playerVisible = loaded.filter(a => !(a.tags || []).includes("enemy"));
    setActions(playerVisible);
    setSelectedActionId(playerVisible.length ? playerVisible[0].id : null);
  }, []);

  // -----------------------------------------------------------
  // Tour par tour : entit?? active (joueur / ennemi)
  // -----------------------------------------------------------

  useEffect(() => {
    if (!isCombatConfigured) return;
    if (!hasRolledInitiative) return;

    const entry = getActiveTurnEntry();
    if (!entry) return;

    if (entry.kind === "player") {
      setPhase("player");
      setTurnActionUsage({ usedAction: false, usedBonus: false });
      setActionUsageCounts(prev => ({ ...prev, turn: {} }));
      setPathLimit(5);
      setHasRolledAttackForCurrentAction(false);
      setAttackRoll(null);
      setDamageRoll(null);

      narrationPendingRef.current = false;
      beginRoundNarrationBuffer(round, buildCombatStateSummary("player"));
      recordCombatEvent({
        round,
        phase: "player",
        kind: "turn_start",
        actorId: player.id,
        actorKind: "player",
        summary: `Debut du tour du heros (round ${round}).`
      });
      return;
    }

    // Tour d'un ennemi
    if (isResolvingEnemies) return;
    setPhase("enemies");
    void runSingleEnemyTurnV2(entry.id);
  }, [
    isCombatConfigured,
    hasRolledInitiative,
    turnOrder,
    currentTurnIndex,
    isResolvingEnemies
  ]);

  function minDistanceToAnyEnemy(): number | null {
    if (enemies.length === 0) return null;
    let best: number | null = null;
    for (const enemy of enemies) {
      const dist = distanceBetweenTokens(player, enemy);
      if (best === null || dist < best) {
        best = dist;
      }
    }
    return best;
  }

  function validateEnemyTargetForAction(
    action: ActionDefinition,
    enemy: TokenState,
    actor: TokenState,
    allTokens: TokenState[]
  ): { ok: boolean; reason?: string } {
    if (enemy.type !== "enemy") {
      return { ok: false, reason: "La cible selectionnee n'est pas un ennemi." };
    }
    if (enemy.hp <= 0) {
      return { ok: false, reason: "La cible est deja a terre." };
    }
    if (!areTokensOnSameLevel(actor, enemy)) {
      return { ok: false, reason: "Cible sur un autre niveau." };
    }

    const targeting = action.targeting;
    if (!targeting || targeting.target !== "enemy") {
      return {
        ok: false,
        reason: "Cette action ne cible pas un ennemi."
      };
    }

    const dist = distanceBetweenTokens(actor, enemy);
    const range = targeting.range;

    if (range) {
      if (typeof range.min === "number" && dist < range.min) {
        return {
          ok: false,
          reason: `Cible trop proche pour ${action.name} (distance ${dist}, min ${range.min}).`
        };
      }
      if (typeof range.max === "number" && dist > range.max) {
        return {
          ok: false,
          reason: `Cible hors portee pour ${action.name} (distance ${dist}, max ${range.max}).`
        };
      }
    }

    for (const cond of action.conditions || []) {
      if (cond.type === "distance_max") {
        if (typeof cond.max === "number" && dist > cond.max) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible > ${cond.max}.`
          };
        }
      }
      if (cond.type === "distance_between") {
        const min =
          typeof cond.min === "number"
            ? cond.min
            : typeof range?.min === "number"
            ? range.min
            : null;
        const max =
          typeof cond.max === "number"
            ? cond.max
            : typeof range?.max === "number"
            ? range.max
            : null;

        if (min !== null && dist < min) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible < ${min}.`
          };
        }
        if (max !== null && dist > max) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible > ${max}.`
          };
        }
      }
      if (cond.type === "target_alive" && enemy.hp <= 0) {
        return {
          ok: false,
          reason: cond.reason || "La cible doit avoir des PV restants."
        };
      }
    }

    if (targeting.requiresLos) {
      const visible = isTargetVisible(
        actor,
        enemy,
        allTokens,
        visionBlockersActive,
        playableCells,
        wallEdges.vision,
        lightLevels,
        mapGrid
      );
      if (!visible) {
        return {
          ok: false,
          reason:
            "Cible hors du champ de vision ou derriere un obstacle (ligne de vue requise)."
        };
      }
      const targetCell =
        getClosestFootprintCellToPoint({ x: actor.x, y: actor.y }, enemy) ??
        { x: enemy.x, y: enemy.y };
      const canHit = hasLineOfEffect(
        { x: actor.x, y: actor.y },
        targetCell,
        obstacleBlocking.attacks,
        wallEdges.vision
      );
      if (!canHit) {
        return {
          ok: false,
          reason: "Trajectoire bloquee (obstacle entre l'attaquant et la cible)."
        };
      }
    }

    return { ok: true };
  }

  function validateObstacleTargetForAction(
    action: ActionDefinition,
    obstacle: ObstacleInstance,
    targetCell: { x: number; y: number },
    actor: TokenState,
    allTokens: TokenState[]
  ): { ok: boolean; reason?: string } {
    if (obstacle.hp <= 0) {
      return { ok: false, reason: "L'obstacle est deja detruit." };
    }

    const targeting = action.targeting;
    if (!targeting || targeting.target !== "enemy") {
      return {
        ok: false,
        reason: "Cette action ne cible pas un ennemi/obstacle."
      };
    }

    const def = obstacleTypeById.get(obstacle.typeId) ?? null;
    const dist = getObstacleDistance(actor, obstacle, def, targetCell);
    const range = targeting.range;

    if (range) {
      if (typeof range.min === "number" && dist < range.min) {
        return {
          ok: false,
          reason: `Cible trop proche pour ${action.name} (distance ${dist}, min ${range.min}).`
        };
      }
      if (typeof range.max === "number" && dist > range.max) {
        return {
          ok: false,
          reason: `Cible hors portee pour ${action.name} (distance ${dist}, max ${range.max}).`
        };
      }
    }

    for (const cond of action.conditions || []) {
      if (cond.type === "distance_max") {
        if (typeof cond.max === "number" && dist > cond.max) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible > ${cond.max}.`
          };
        }
      }
      if (cond.type === "distance_between") {
        const min =
          typeof cond.min === "number"
            ? cond.min
            : typeof range?.min === "number"
              ? range.min
              : null;
        const max =
          typeof cond.max === "number"
            ? cond.max
            : typeof range?.max === "number"
              ? range.max
              : null;

        if (min !== null && dist < min) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible < ${min}.`
          };
        }
        if (max !== null && dist > max) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible > ${max}.`
          };
        }
      }
      if (cond.type === "target_alive" && obstacle.hp <= 0) {
        return {
          ok: false,
          reason: cond.reason || "La cible doit avoir des PV restants."
        };
      }
    }

    if (targeting.requiresLos) {
      const visible = isCellVisible(
        actor,
        targetCell,
        visionBlockersActive,
        playableCells,
        wallEdges.vision,
        lightLevels,
        mapGrid
      );
      if (!visible) {
        return {
          ok: false,
          reason:
            "Cible hors du champ de vision ou derriere un obstacle (ligne de vue requise)."
        };
      }
      const canHit = hasLineOfEffect(
        { x: actor.x, y: actor.y },
        { x: targetCell.x, y: targetCell.y },
        obstacleBlocking.attacks,
        wallEdges.vision
      );
      if (!canHit) {
        return {
          ok: false,
          reason: "Trajectoire bloquee (obstacle entre l'attaquant et la cible)."
        };
      }
    }

    return { ok: true };
  }

  function validateWallSegmentTargetForAction(
    action: ActionDefinition,
    segment: WallSegment,
    targetCell: { x: number; y: number },
    actor: TokenState
  ): { ok: boolean; reason?: string } {
    if (typeof segment.hp === "number" && segment.hp <= 0) {
      return { ok: false, reason: "Le mur est deja detruit." };
    }

    const targeting = action.targeting;
    if (!targeting || targeting.target !== "enemy") {
      return {
        ok: false,
        reason: "Cette action ne cible pas un ennemi/obstacle."
      };
    }

    const def = segment.typeId ? wallTypeById.get(segment.typeId) ?? null : null;
    if (!isWallDestructible(def)) {
      return { ok: false, reason: "Ce mur est indestructible." };
    }

    const dist = getWallSegmentDistance(actor, segment);
    const range = targeting.range;

    if (range) {
      if (typeof range.min === "number" && dist < range.min) {
        return {
          ok: false,
          reason: `Cible trop proche pour ${action.name} (distance ${dist}, min ${range.min}).`
        };
      }
      if (typeof range.max === "number" && dist > range.max) {
        return {
          ok: false,
          reason: `Cible hors portee pour ${action.name} (distance ${dist}, max ${range.max}).`
        };
      }
    }

    for (const cond of action.conditions || []) {
      if (cond.type === "distance_max") {
        if (typeof cond.max === "number" && dist > cond.max) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible > ${cond.max}.`
          };
        }
      }
      if (cond.type === "distance_between") {
        const min =
          typeof cond.min === "number"
            ? cond.min
            : typeof range?.min === "number"
              ? range.min
              : null;
        const max =
          typeof cond.max === "number"
            ? cond.max
            : typeof range?.max === "number"
              ? range.max
              : null;

        if (min !== null && dist < min) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible < ${min}.`
          };
        }
        if (max !== null && dist > max) {
          return {
            ok: false,
            reason: cond.reason || `Distance cible > ${max}.`
          };
        }
      }
      if (cond.type === "target_alive" && typeof segment.hp === "number" && segment.hp <= 0) {
        return {
          ok: false,
          reason: cond.reason || "La cible doit avoir des PV restants."
        };
      }
    }

    if (targeting.requiresLos) {
      const visible = isCellVisible(
        actor,
        targetCell,
        visionBlockersActive,
        playableCells,
        wallEdges.vision,
        lightLevels,
        mapGrid
      );
      if (!visible) {
        return {
          ok: false,
          reason:
            "Cible hors du champ de vision ou derriere un obstacle (ligne de vue requise)."
        };
      }
      const canHit = hasLineOfEffect(
        { x: actor.x, y: actor.y },
        { x: targetCell.x, y: targetCell.y },
        obstacleBlocking.attacks,
        wallEdges.vision
      );
      if (!canHit) {
        return {
          ok: false,
          reason: "Trajectoire bloquee (obstacle entre l'attaquant et la cible)."
        };
      }
    }

    return { ok: true };
  }

    function computeActionAvailability(action: ActionDefinition): ActionAvailability {
    const reasons: string[] = [];
    const details: string[] = [];

    if (phase !== "player") {
      reasons.push("Action bloquee pendant le tour des ennemis.");
    }

    const costType = action.actionCost?.actionType;
    if (costType === "action" && turnActionUsage.usedAction) {
      reasons.push("Action principale deja utilisee ce tour.");
    }
    if (costType === "bonus" && turnActionUsage.usedBonus) {
      reasons.push("Action bonus deja utilisee ce tour.");
    }

    const turnUses = typeof actionUsageCounts.turn[action.id] === "number" ? actionUsageCounts.turn[action.id] : 0;
    const encounterUses =
      typeof actionUsageCounts.encounter[action.id] === "number" ? actionUsageCounts.encounter[action.id] : 0;
    if (typeof action.usage?.perTurn === "number") {
      details.push(`Usages/tour: ${turnUses}/${action.usage.perTurn}`);
      if (turnUses >= action.usage.perTurn) {
        reasons.push("Limite d'usage atteinte pour ce tour.");
      }
    }
    if (typeof action.usage?.perEncounter === "number") {
      details.push(`Usages/rencontre: ${encounterUses}/${action.usage.perEncounter}`);
      if (encounterUses >= action.usage.perEncounter) {
        reasons.push("Limite d'usage atteinte pour la rencontre.");
      }
    }

    const usageResource = action.usage?.resource;
    if (usageResource?.name && typeof usageResource.min === "number") {
      const amount = getResourceAmount(usageResource.name, usageResource.pool);
      if (amount < usageResource.min) {
        const poolSuffix = usageResource.pool ? ` (${usageResource.pool})` : "";
        reasons.push(`Ressource insuffisante: ${usageResource.name}${poolSuffix} (${amount}/${usageResource.min}).`);
      }
    }

    const targeting = action.targeting?.target;
    const range = action.targeting?.range;
    if (targeting === "enemy") {
      const dist = minDistanceToAnyEnemy();
      if (dist === null) {
        reasons.push("Aucune cible ennemie presente.");
      } else {
        details.push(`Distance mini ennemie: ${dist}`);
        if (typeof range?.min === "number" && dist < range.min) {
          reasons.push(`Trop proche (< ${range.min}).`);
        }
        if (typeof range?.max === "number" && dist > range.max) {
          reasons.push(`Hors portee (> ${range.max}).`);
        }
      }
    }

    for (const cond of action.conditions || []) {
      if (cond.type === "phase" && cond.mustBe && cond.mustBe !== phase) {
        reasons.push(cond.reason || "Phase incorrecte.");
      }
      if (cond.type === "stat_below_percent" && cond.who === "self" && cond.stat === "hp") {
        const max = Math.max(1, player.maxHp || 1);
        const ratio = player.hp / max;
        if (typeof cond.percentMax === "number" && ratio >= cond.percentMax) {
          reasons.push(cond.reason || `PV trop hauts (>= ${Math.round(cond.percentMax * 100)}%).`);
        }
      }
      if (cond.type === "distance_max" && targeting === "enemy") {
        const dist = minDistanceToAnyEnemy();
        if (dist !== null && typeof cond.max === "number" && dist > cond.max) {
          reasons.push(cond.reason || `Distance > ${cond.max}.`);
        }
      }
      if (cond.type === "distance_between" && targeting === "enemy") {
        const dist = minDistanceToAnyEnemy();
        if (dist !== null) {
          if (typeof cond.min === "number" && dist < cond.min) {
            reasons.push(cond.reason || `Distance < ${cond.min}.`);
          }
          if (typeof cond.max === "number" && dist > cond.max) {
            reasons.push(cond.reason || `Distance > ${cond.max}.`);
          }
        }
      }
      if (cond.type === "resource_at_least" && cond.resource) {
        const pool = typeof cond.pool === "string" ? cond.pool : undefined;
        const amount = getResourceAmount(String(cond.resource), pool);
        const needed = typeof cond.value === "number" ? cond.value : 1;
        if (amount < needed) {
          const poolSuffix = pool ? ` (${pool})` : "";
          reasons.push(cond.reason || `Ressource insuffisante: ${cond.resource}${poolSuffix} (${amount}/${needed}).`);
        }
      }
    }

    return {
      enabled: reasons.length === 0,
      reasons,
      details
    };
  }

  function resolvePlayerFormula(formula: string): string {
    const level = Number(sampleCharacter.niveauGlobal || 1);
    const modFOR = Number(sampleCharacter.caracs?.force?.modFOR || 0);
    const modDEX = Number(sampleCharacter.caracs?.dexterite?.modDEX || 0);
    const modCON = Number(sampleCharacter.caracs?.constitution?.modCON || 0);
    return formula
      .replace(/\s+/g, "")
      .replace(/niveau/gi, String(level))
      .replace(/modFOR/gi, String(modFOR))
      .replace(/modDEX/gi, String(modDEX))
      .replace(/modCON/gi, String(modCON));
  }

  function describeUsage(usage: UsageSpec): string {
    const chunks: string[] = [];
    if (usage.perTurn) chunks.push(`${usage.perTurn}/tour`);
    if (usage.perEncounter) chunks.push(`${usage.perEncounter}/rencontre`);
    if (usage.resource?.name) {
      const pool = usage.resource.pool ? ` (${usage.resource.pool})` : "";
      chunks.push(`Ressource: ${usage.resource.name}${pool}`);
    }
    return chunks.length ? chunks.join(" | ") : "Libre";
  }

  function describeRange(targeting: TargetingSpec): string {
    const { range, target } = targeting;
    if (range.shape === "self") return "Portee: soi-meme";
    if (range.min === range.max) {
      return `Portee: ${range.max} (${target})`;
    }
    return `Portee: ${range.min}-${range.max} (${target})`;
  }

  function conditionLabel(cond: Condition): string {
    switch (cond.type) {
      case "phase":
        return `Phase requise: ${cond.mustBe ?? "?"}`;
      case "distance_max":
        return `Distance <= ${cond.max ?? "?"}`;
      case "distance_between":
        return `Distance ${cond.min ?? 0}-${cond.max ?? "?"}`;
      case "stat_below_percent":
        return `Stat ${cond.stat} < ${Math.round((cond.percentMax ?? 0) * 100)}%`;
      case "target_alive":
        return "Cible doit etre vivante";
      case "resource_at_least":
        return `Ressource ${cond.resource ?? "?"} >= ${cond.value ?? "?"}`;
      default:
        return cond.reason || cond.type;
    }
  }

  function effectLabel(effect: Effect): string {
    switch (effect.type) {
      case "damage":
        return `Degats ${effect.damageType ?? ""} (${effect.formula ?? "?"})`;
      case "heal":
        return `Soin (${effect.formula ?? "?"})`;
      case "status":
        return `Etat: ${effect.status ?? "?"} (${effect.duration ?? "?"} tour)`;
      case "temp_hp":
        return `PV temporaires: ${effect.amount ?? "?"}`;
      case "move":
        return `Deplacement +${effect.maxSteps ?? "?"} (${effect.direction ?? "direction libre"})`;
      case "resource_spend":
        return `Consomme ${effect.amount ?? 1} ${effect.resource ?? "ressource"}`;
      case "modify_path_limit":
        return `+${effect.delta ?? "?"} cases de mouvement ce tour`;
      default:
        return effect.type;
    }
  }

  function previewActionArea(action: ActionDefinition) {
    const range = action.targeting?.range;
    if (!range) return;

    const id = `preview-${action.id}`;
    if (range.shape === "rectangle") {
      setEffectSpecs([
        {
          id,
          kind: "rectangle",
          width: Math.max(1, range.max),
          height: Math.max(1, range.max)
        }
      ]);
      pushLog(`Previsualisation rectangle pour ${action.name}.`);
      return;
    }

    if (range.shape === "cone") {
      setEffectSpecs([
        { id, kind: "cone", range: Math.max(1, range.max), direction: "right" }
      ]);
      pushLog(`Previsualisation cone (direction droite) pour ${action.name}.`);
      return;
    }

    setEffectSpecs([{ id, kind: "circle", radius: Math.max(1, range.max) }]);
    pushLog(`Previsualisation de portee pour ${action.name}.`);
  }

  function handleUseAction(action: ActionDefinition) {
    const costType = action.actionCost?.actionType;
    const isStandardAction = costType === "action";
    const isBonusAction = costType === "bonus";

    if (isStandardAction && turnActionUsage.usedAction) {
      pushLog(
        `Action ${action.name} refusee: action principale deja utilisee ce tour.`
      );
      return;
    }
    if (isBonusAction && turnActionUsage.usedBonus) {
      pushLog(
        `Action ${action.name} refusee: action bonus deja utilisee ce tour.`
      );
      return;
    }

    const availability = computeActionAvailability(action);
    if (!availability.enabled) {
      pushLog(
        `Action ${action.name} bloque: ${availability.reasons.join(" | ")}`
      );
      return;
    }

    setActionUsageCounts(prev => ({
      turn: { ...prev.turn, [action.id]: (prev.turn[action.id] ?? 0) + 1 },
      encounter: { ...prev.encounter, [action.id]: (prev.encounter[action.id] ?? 0) + 1 }
    }));

    for (const effect of action.effects || []) {
      if (effect.type === "modify_path_limit" && typeof effect.delta === "number") {
        setPathLimit(prev => Math.max(1, prev + effect.delta));
        if (typeof effect.delta === "number") {
          pushLog(`Mouvement: limite de trajet modifiee (${effect.delta >= 0 ? "+" : ""}${effect.delta}).`);
        }
      }
      if (effect.type === "resource_spend" && effect.resource) {
        const pool = typeof effect.pool === "string" ? effect.pool : null;
        const amount = typeof effect.amount === "number" ? effect.amount : 1;
        const key = resourceKey(String(effect.resource), pool);
        setPlayerResources(prev => ({
          ...prev,
          [key]: Math.max(0, (prev[key] ?? 0) - amount)
        }));
      }
      if (effect.type === "toggle_torch") {
        setPlayerTorchOn(prev => {
          const next = !prev;
          pushLog(`Torche: ${next ? "allumee" : "eteinte"}.`);
          return next;
        });
      }
      if (effect.type === "heal" && typeof effect.formula === "string") {
        const resolved = resolvePlayerFormula(effect.formula);
        const result = rollDamage(resolved, { isCrit: false, critRule: "double-dice" });
        const minHeal = typeof effect.min === "number" ? effect.min : null;
        const healAmount = minHeal !== null ? Math.max(minHeal, result.total) : result.total;
        setPlayer(prev => ({
          ...prev,
          hp: Math.min(prev.maxHp, prev.hp + healAmount)
        }));
        pushDiceLog(`Soin (${action.name}) : ${resolved} -> +${healAmount} PV`);
      }
      if (effect.type === "log" && typeof effect.message === "string") {
        pushLog(effect.message);
      }
    }

    setValidatedActionId(action.id);
    setAttackRoll(null);
    setDamageRoll(null);
    setHasRolledAttackForCurrentAction(false);
    setTurnActionUsage(prev => ({
      usedAction: prev.usedAction || isStandardAction,
      usedBonus: prev.usedBonus || isBonusAction
    }));

    if (action.targeting?.target === "enemy") {
      setTargetMode("selecting");
      setSelectedTargetId(null);
      setSelectedObstacleTarget(null);
      setSelectedWallTarget(null);
    } else {
      setTargetMode("none");
      setSelectedTargetId(null);
      setSelectedObstacleTarget(null);
      setSelectedWallTarget(null);
    }
  }

  function getValidatedAction(): ActionDefinition | null {
    if (!validatedActionId) return null;
    return actions.find(a => a.id === validatedActionId) || null;
  }

  function actionNeedsDiceUI(action: ActionDefinition | null): boolean {
    if (!action) return false;
    if (action.attack || action.damage || action.skillCheck) return true;

    const hasFormulaEffect = (action.effects || []).some(effect => {
      return typeof effect.formula === "string" && effect.formula.trim().length > 0;
    });

    return hasFormulaEffect;
  }

  function handleRollAttack() {
    if (isGameOver) return;
    if (isTokenDead(player)) return;
    const action = getValidatedAction();
    if (!action) {
      pushLog("Aucune action validee pour lancer un jet.");
      return;
    }
    if (!action.attack) {
      pushLog("Cette action ne requiert pas de jet de touche.");
      return;
    }
    if (hasRolledAttackForCurrentAction) {
      pushLog(
        "Jet de touche deja effectue pour cette action ce tour. Validez une nouvelle action ou terminez le tour."
      );
      return;
    }

    let targetArmorClass: number | null = null;
    let targetLabel: string | null = null;
    if (action.targeting?.target === "enemy") {
      if (selectedTargetId) {
        const target = enemies.find(e => e.id === selectedTargetId);
        if (!target) {
          pushLog("Cible ennemie introuvable ou deja vaincue.");
          return;
        }
        targetArmorClass =
          typeof target.armorClass === "number" ? target.armorClass : null;
        targetLabel = target.id;
      } else if (selectedObstacleTarget) {
        const obstacle = obstacles.find(o => o.id === selectedObstacleTarget.id) ?? null;
        if (!obstacle || obstacle.hp <= 0) {
          pushLog("Obstacle introuvable ou deja detruit.");
          return;
        }
        const def = obstacleTypeById.get(obstacle.typeId) ?? null;
        targetArmorClass =
          typeof def?.durability?.ac === "number" ? def.durability.ac : null;
        targetLabel = def?.label ?? obstacle.typeId ?? "obstacle";
      } else if (selectedWallTarget) {
        const wall = wallSegments.find(w => w.id === selectedWallTarget.id) ?? null;
        if (!wall || (typeof wall.hp === "number" && wall.hp <= 0)) {
          pushLog("Mur introuvable ou deja detruit.");
          return;
        }
        const def = wall.typeId ? wallTypeById.get(wall.typeId) ?? null : null;
        if (!isWallDestructible(def)) {
          pushLog("Ce mur est indestructible.");
          return;
        }
        targetArmorClass =
          typeof def?.durability?.ac === "number" ? def.durability.ac : null;
        targetLabel = def?.label ?? wall.typeId ?? "mur";
      } else {
        pushLog(
          "Aucune cible selectionnee pour cette action. Selectionnez une cible avant le jet."
        );
        return;
      }
    }

    const result = rollAttack(
      action.attack.bonus,
      advantageMode,
      action.attack.critRange ?? 20
    );
    setAttackRoll(result);
    setHasRolledAttackForCurrentAction(true);
    setDamageRoll(null);
    const rollsText =
      result.mode === "normal"
        ? `${result.d20.total}`
        : `${result.d20.rolls.join(" / ")} -> ${result.d20.total}`;

    const targetSuffix =
      action.targeting?.target === "enemy" && targetLabel
        ? ` sur ${targetLabel}`
        : "";

    const baseLine = `Jet de touche (${action.name})${targetSuffix} : ${rollsText} + ${result.bonus} = ${result.total}`;

    if (targetArmorClass !== null) {
      const isHit = result.total >= targetArmorClass || result.isCrit;
      const outcome = isHit
        ? `TOUCHE (CA ${targetArmorClass})${result.isCrit ? " (critique!)" : ""}`
        : `RATE (CA ${targetArmorClass})`;
      pushDiceLog(`${baseLine} -> ${outcome}`);
    } else {
      pushDiceLog(
        `${baseLine}${result.isCrit ? " (critique!)" : ""}`
      );
    }
  }

  function handleRollDamage() {
    if (isGameOver) return;
    if (isTokenDead(player)) return;
    const action = getValidatedAction();
    if (!action) {
      pushLog("Aucune action validee pour lancer un jet.");
      return;
    }
    if (!action.damage) {
      pushLog("Cette action ne requiert pas de jet de degats.");
      return;
    }

    if (action.attack && !attackRoll) {
      pushLog(
        "Un jet de touche est requis avant les degats pour cette action."
      );
      return;
    }

    let targetIndex: number | null = null;
    let targetArmorClass: number | null = null;
    let targetLabel: string | null = null;
    let obstacleTarget: ObstacleInstance | null = null;
    if (action.targeting?.target === "enemy") {
      if (selectedTargetId) {
        targetIndex = enemies.findIndex(e => e.id === selectedTargetId);
        if (targetIndex === -1) {
          pushLog("Cible ennemie introuvable ou deja vaincue.");
          return;
        }
        const target = enemies[targetIndex];
        targetArmorClass =
          typeof target.armorClass === "number" ? target.armorClass : null;
        targetLabel = target.id;
      } else if (selectedObstacleTarget) {
        obstacleTarget =
          obstacles.find(o => o.id === selectedObstacleTarget.id) ?? null;
        if (!obstacleTarget || obstacleTarget.hp <= 0) {
          pushLog("Obstacle introuvable ou deja detruit.");
          return;
        }
        const def = obstacleTypeById.get(obstacleTarget.typeId) ?? null;
        targetArmorClass =
          typeof def?.durability?.ac === "number" ? def.durability.ac : null;
        targetLabel = def?.label ?? obstacleTarget.typeId ?? "obstacle";
      } else if (selectedWallTarget) {
        const wall = wallSegments.find(w => w.id === selectedWallTarget.id) ?? null;
        if (!wall || (typeof wall.hp === "number" && wall.hp <= 0)) {
          pushLog("Mur introuvable ou deja detruit.");
          return;
        }
        const def = wall.typeId ? wallTypeById.get(wall.typeId) ?? null : null;
        if (!isWallDestructible(def)) {
          pushLog("Ce mur est indestructible.");
          return;
        }
        targetArmorClass =
          typeof def?.durability?.ac === "number" ? def.durability.ac : null;
        targetLabel = def?.label ?? wall.typeId ?? "mur";
      } else {
        pushLog(
          "Aucune cible selectionnee pour cette action. Selectionnez une cible avant le jet de degats."
        );
        return;
      }
    }

    const isCrit = Boolean(attackRoll?.isCrit);

    if (targetArmorClass !== null && action.attack && attackRoll) {
      const totalAttack = attackRoll.total;
      const isHit = totalAttack >= targetArmorClass || attackRoll.isCrit;
      if (!isHit) {
        const targetSuffix =
          action.targeting?.target === "enemy" && targetLabel
            ? ` sur ${targetLabel}`
            : "";
        pushLog(
          `L'attaque (${action.name})${targetSuffix} a manque la cible (CA ${targetArmorClass}). Pas de degats.`
        );
        if (selectedTargetId) {
          recordCombatEvent({
            round,
            phase,
            kind: "player_attack",
            actorId: player.id,
            actorKind: "player",
            targetId: selectedTargetId,
            targetKind: "enemy",
            summary: `Le heros attaque ${selectedTargetId} (${action.name}) mais manque (CA ${targetArmorClass}).`,
            data: {
              actionId: action.id,
              attackTotal: totalAttack,
              targetArmorClass,
              hit: false
            }
          });
        }
        return;
      }
    }
    const result = rollDamage(action.damage.formula, {
      isCrit,
      critRule: action.damage.critRule
    });
    setDamageRoll(result);
    const diceText = result.dice
      .map(d => d.rolls.join("+"))
      .join(" | ");

    const totalDamage = result.total;

    const targetSuffix =
      action.targeting?.target === "enemy" && targetLabel
        ? ` sur ${targetLabel}`
        : "";

    pushDiceLog(
      `Degats (${action.name})${targetSuffix} : ${diceText || "0"} + ${
        result.flatModifier
      } = ${totalDamage}${isCrit ? " (critique)" : ""}`
    );

      if (typeof targetIndex === "number" && targetIndex >= 0) {
        setEnemies(prev => {
          if (targetIndex === null || targetIndex < 0 || targetIndex >= prev.length) {
            return prev;
          }
          const copy = [...prev];
          const target = { ...copy[targetIndex] };
          const beforeHp = target.hp;
          target.hp = Math.max(0, target.hp - totalDamage);
          copy[targetIndex] = target;

          recordCombatEvent({
            round,
            phase,
            kind: "player_attack",
            actorId: player.id,
            actorKind: "player",
            targetId: target.id,
            targetKind: "enemy",
            summary: `Le heros frappe ${target.id} et inflige ${totalDamage} degats (PV ${beforeHp} -> ${target.hp}).`,
            data: {
              actionId: action.id,
              damage: totalDamage,
              isCrit,
              targetHpBefore: beforeHp,
              targetHpAfter: target.hp
            }
          });

          if (target.hp <= 0 && beforeHp > 0) {
            recordCombatEvent({
              round,
              phase,
              kind: "death",
              actorId: target.id,
              actorKind: "enemy",
              summary: `${target.id} s'effondre, hors de combat.`,
              targetId: target.id,
              targetKind: "enemy",
              data: {
                killedBy: player.id
              }
            });
          }

          return copy;
        });

      } else if (obstacleTarget && selectedObstacleTarget) {
        const targetId = obstacleTarget.id;
        const def = obstacleTypeById.get(obstacleTarget.typeId) ?? null;
        const label = def?.label ?? obstacleTarget.typeId ?? "obstacle";
        setObstacles(prev => {
          const idx = prev.findIndex(o => o.id === targetId);
          if (idx === -1) return prev;
          const copy = [...prev];
          const target = { ...copy[idx] };
          const beforeHp = target.hp;
          target.hp = Math.max(0, target.hp - totalDamage);
          copy[idx] = target;

          recordCombatEvent({
            round,
            phase,
            kind: "player_attack",
            actorId: player.id,
            actorKind: "player",
            summary: `Le heros frappe ${label} et inflige ${totalDamage} degats (PV ${beforeHp} -> ${target.hp}).`,
            data: {
              actionId: action.id,
              damage: totalDamage,
              isCrit,
              targetHpBefore: beforeHp,
              targetHpAfter: target.hp,
              obstacleId: targetId,
              obstacleTypeId: target.typeId
            }
          });

          if (target.hp <= 0 && beforeHp > 0) {
            recordCombatEvent({
              round,
              phase,
              kind: "death",
              actorId: targetId,
              actorKind: "player",
              summary: `${label} est detruit.`,
              data: {
                destroyedBy: player.id,
                obstacleId: targetId,
                obstacleTypeId: target.typeId
              }
            });
          }

          return copy;
        });
      } else if (selectedWallTarget) {
        const wall = wallSegments.find(w => w.id === selectedWallTarget.id) ?? null;
        if (!wall) return;
        const def = wall.typeId ? wallTypeById.get(wall.typeId) ?? null : null;
        if (!isWallDestructible(def)) {
          pushLog("Ce mur est indestructible.");
          return;
        }
        const label = def?.label ?? wall.typeId ?? "mur";
        setWallSegments(prev => {
          const idx = prev.findIndex(w => w.id === wall.id);
          if (idx === -1) return prev;
          const copy = [...prev];
          const target = { ...copy[idx] };
          const beforeHp = typeof target.hp === "number" ? target.hp : 0;
          const maxHp = typeof target.maxHp === "number" ? target.maxHp : beforeHp;
          const nextHp = Math.max(0, beforeHp - totalDamage);
          target.hp = nextHp;
          target.maxHp = maxHp;
          copy[idx] = target;

          recordCombatEvent({
            round,
            phase,
            kind: "player_attack",
            actorId: player.id,
            actorKind: "player",
            summary: `Le heros frappe ${label} et inflige ${totalDamage} degats (PV ${beforeHp} -> ${nextHp}).`,
            data: {
              actionId: action.id,
              damage: totalDamage,
              isCrit,
              targetHpBefore: beforeHp,
              targetHpAfter: nextHp,
              wallId: target.id,
              wallTypeId: target.typeId ?? null
            }
          });

          if (nextHp <= 0 && beforeHp > 0) {
            recordCombatEvent({
              round,
              phase,
              kind: "death",
              actorId: target.id,
              actorKind: "player",
              summary: `${label} est detruit.`,
              data: {
                destroyedBy: player.id,
                wallId: target.id,
                wallTypeId: target.typeId ?? null
              }
            });
          }

          return copy.filter(w => w.hp === undefined || w.hp > 0);
        });
      }
    }

  function handleAutoResolveRolls() {
    const action = getValidatedAction();
    if (!action) {
      pushLog("Aucune action validee pour lancer un jet.");
      return;
    }
    if (!action.attack) {
      pushLog("Mode auto: pas de jet de touche necessaire.");
      if (action.damage) {
        handleRollDamage();
      }
      return;
    }
    handleRollAttack();
    setTimeout(() => {
      if (action.damage) {
        handleRollDamage();
      }
    }, 50);
  }

  // -----------------------------------------------------------
  // Interaction: click on the board to extend the player path
  // -----------------------------------------------------------

  function handleBoardClick(event: React.MouseEvent<HTMLDivElement>) {
    if (phase !== "player") return;
    if (isGameOver) return;
    if (isTokenDead(player)) return;

    const container = pixiContainerRef.current;
    if (!container) return;
    const canvas = container.querySelector("canvas");
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;

    const viewport = viewportRef.current;
    if (!viewport) return;

    const stageX = (localX - viewport.offsetX) / viewport.scale;
    const stageY = (localY - viewport.offsetY) / viewport.scale;

    const boardWidth = getBoardWidth(mapGrid.cols);
    const boardHeight = getBoardHeight(mapGrid.rows);
    if (stageX < 0 || stageY < 0 || stageX > boardWidth || stageY > boardHeight) {
      return;
    }

    const { x: gx, y: gy } = screenToGridForGrid(stageX, stageY, mapGrid.cols, mapGrid.rows);
    const targetX = gx;
    const targetY = gy;

    if (!isCellPlayable(targetX, targetY)) return;

    // Mode selection de cible pour une action ciblant un ennemi
    if (targetMode === "selecting") {
      const action = getValidatedAction();
      if (!action) {
        pushLog("Aucune action validee pour selectionner une cible.");
        return;
      }

      const tokens = getTokensOnActiveLevel([player, ...enemies]);
      const target = getTokenAt({ x: targetX, y: targetY }, tokens);

      if (target && target.type === "enemy") {
        const validation = validateEnemyTargetForAction(
          action,
          target,
          player,
          [player, ...enemies]
        );
        if (!validation.ok) {
          pushLog(validation.reason || "Cette cible n'est pas valide pour cette action.");
          return;
        }

        setSelectedTargetId(target.id);
        setSelectedObstacleTarget(null);
        setSelectedWallTarget(null);
        setTargetMode("none");
        pushLog(`Cible selectionnee: ${target.id}.`);
        return;
      }

      const obstacleHit = findObstacleAtCell(targetX, targetY);
      if (obstacleHit) {
        const validation = validateObstacleTargetForAction(
          action,
          obstacleHit.instance,
          { x: targetX, y: targetY },
          player,
          [player, ...enemies]
        );
        if (!validation.ok) {
          pushLog(validation.reason || "Cette cible n'est pas valide pour cette action.");
          return;
        }

        const label = obstacleHit.def?.label ?? obstacleHit.instance.typeId ?? "obstacle";
        setSelectedTargetId(null);
        setSelectedObstacleTarget({ id: obstacleHit.instance.id, x: targetX, y: targetY });
        setSelectedWallTarget(null);
        setTargetMode("none");
        pushLog(`Cible selectionnee: ${label}.`);
        return;
      }

      const wallHit = findWallSegmentAtCell(targetX, targetY);
      if (wallHit) {
        const validation = validateWallSegmentTargetForAction(
          action,
          wallHit.segment,
          { x: targetX, y: targetY },
          player
        );
        if (!validation.ok) {
          pushLog(validation.reason || "Cette cible n'est pas valide pour cette action.");
          return;
        }

        const label = wallHit.def?.label ?? wallHit.segment.typeId ?? "mur";
        setSelectedTargetId(null);
        setSelectedObstacleTarget(null);
        setSelectedWallTarget({ id: wallHit.segment.id, x: targetX, y: targetY });
        setTargetMode("none");
        pushLog(`Cible selectionnee: ${label}.`);
        return;
      }

      return;
    }

    if (interactionMode === "inspect-select") {
      const dist = distanceFromPointToToken({ x: targetX, y: targetY }, player);
      if (dist > INSPECT_RANGE) {
        pushLog(
          `Inspection: case hors portee (${dist} > ${INSPECT_RANGE}).`
        );
        return;
      }
      if (!isCellVisibleForPlayer(targetX, targetY)) {
        pushLog("Inspection: la case n'est pas dans votre champ de vision.");
        return;
      }

      setRevealedCells(prev => {
        const next = new Set(prev);
        next.add(cellKey(targetX, targetY));
        return next;
      });

      const tokens = [player, ...enemies];
      const token = getTokenAt({ x: targetX, y: targetY }, tokens);
      if (!token) {
        const obstacleHit = findObstacleAtCellAnyLevel(targetX, targetY);
        if (obstacleHit) {
          const name =
            obstacleHit.def?.label ?? obstacleHit.instance.typeId ?? "obstacle";
          const text = `Inspection (${targetX},${targetY}) : ${name}\nEtat: PV ${obstacleHit.instance.hp}/${obstacleHit.instance.maxHp}`;
          pushLog(
            `Inspection: obstacle (${name}) -> etat: PV ${obstacleHit.instance.hp}/${obstacleHit.instance.maxHp}.`
          );
          setPlayerBubble(text);
          setInteractionMode("idle");
          return;
        }
        const wallHit = findWallSegmentAtCellAnyLevel(targetX, targetY);
        if (wallHit) {
          const name = wallHit.def?.label ?? wallHit.segment.typeId ?? "mur";
          const hp = typeof wallHit.segment.hp === "number" ? wallHit.segment.hp : null;
          const maxHp = typeof wallHit.segment.maxHp === "number" ? wallHit.segment.maxHp : null;
          const status = hp !== null && maxHp !== null ? `PV ${hp}/${maxHp}` : "indestructible";
          const text = `Inspection (${targetX},${targetY}) : ${name}\nEtat: ${status}`;
          pushLog(
            `Inspection: mur (${name}) -> etat: ${status}.`
          );
          setPlayerBubble(text);
          setInteractionMode("idle");
          return;
        }
        pushLog(`Inspection: case (${targetX}, ${targetY}) -> sol.`);
        setPlayerBubble(`Inspection (${targetX},${targetY}) : sol.`);
        setInteractionMode("idle");
        return;
      }

      if (token.type === "enemy") {
        setRevealedEnemyIds(prev => {
          const next = new Set(prev);
          next.add(token.id);
          return next;
        });

        const nature = token.enemyTypeLabel ?? token.enemyTypeId ?? "inconnu";
        const role = token.aiRole ?? "inconnu";
        const text = `Inspection (${targetX},${targetY}) : ${nature}\nEtat: PV ${token.hp}/${token.maxHp}\nRole: ${role}`;
        pushLog(`Inspection: ennemi (${token.id}) -> nature: ${nature}, etat: PV ${token.hp}/${token.maxHp}, role: ${role}.`);
        setPlayerBubble(text);
      } else {
        const text = `Inspection (${targetX},${targetY}) : joueur\nEtat: PV ${token.hp}/${token.maxHp}`;
        pushLog(`Inspection: joueur (${token.id}) -> etat: PV ${token.hp}/${token.maxHp}.`);
        setPlayerBubble(text);
      }

      setInteractionMode("idle");
      return;
    }

    if (interactionMode === "interact-select") {
      const wallHit = findWallSegmentAtCell(targetX, targetY);
      const obstacleHit = findObstacleAtCell(targetX, targetY);

      if (!wallHit && !obstacleHit) {
        pushLog("Interagir: aucun element interactif ici.");
        setInteractionMenuItems([]);
        return;
      }

      if (wallHit) {
        const interactions = wallHit.def?.behavior?.interactions ?? [];
        if (interactions.length === 0) {
          pushLog("Interagir: aucune interaction disponible pour ce mur.");
          setInteractionMenuItems([]);
          return;
        }

        const dist = getWallSegmentChebyshevDistance(player, wallHit.segment);
        if (dist > 1) {
          pushLog("Interagir: placez-vous a une case de la porte.");
          setInteractionMenuItems([]);
          return;
        }

        const available: InteractionSpec[] = [];
        const reasons: string[] = [];
        for (const interaction of interactions) {
          const check = resolveInteractionAvailabilityForWall(
            interaction,
            wallHit.segment,
            wallHit.def
          );
          if (check.ok) {
            available.push(interaction);
          } else if (check.reason) {
            reasons.push(check.reason);
          }
        }

        if (available.length === 0) {
          const detail = reasons.length ? ` (${reasons[0]})` : "";
          pushLog(`Interagir: aucune interaction possible${detail}.`);
          setInteractionMenuItems([]);
          return;
        }

        openInteractionWheel(localX, localY, {
          kind: "wall",
          segmentId: wallHit.segment.id,
          cell: { x: targetX, y: targetY }
        }, available);
        return;
      }

      if (obstacleHit) {
        const interactions = obstacleHit.def?.interactions ?? [];
        if (interactions.length === 0) {
          pushLog("Interagir: aucune interaction disponible pour cet obstacle.");
          setInteractionMenuItems([]);
          return;
        }

        const dist = getObstacleChebyshevDistance(
          player,
          obstacleHit.instance,
          obstacleHit.def,
          { x: targetX, y: targetY }
        );
        if (dist > 1) {
          pushLog("Interagir: placez-vous a une case de l'obstacle.");
          setInteractionMenuItems([]);
          return;
        }

        const available: InteractionSpec[] = [];
        const reasons: string[] = [];
        for (const interaction of interactions) {
          const check = resolveInteractionAvailabilityForObstacle(
            interaction,
            obstacleHit.instance,
            obstacleHit.def
          );
          if (check.ok) {
            available.push(interaction);
          } else if (check.reason) {
            reasons.push(check.reason);
          }
        }

        if (available.length === 0) {
          const detail = reasons.length ? ` (${reasons[0]})` : "";
          pushLog(`Interagir: aucune interaction possible${detail}.`);
          setInteractionMenuItems([]);
          return;
        }

        openInteractionWheel(localX, localY, {
          kind: "obstacle",
          obstacleId: obstacleHit.instance.id,
          cell: { x: targetX, y: targetY }
        }, available);
        return;
      }
    }

    if (interactionMode === "look-select") {
      const direction = computeFacingTowards(player, { x: targetX, y: targetY });
      handleSetPlayerFacing(direction);
      setInteractionMode("idle");
      return;
    }

    // Clic standard: ouvrir la roue d'action (le mouvement se fait uniquement en mode "moving").
    if (interactionMode !== "moving") {
      const tokens = getTokensOnActiveLevel([player, ...enemies]);
      const token = getTokenAt({ x: targetX, y: targetY }, tokens) ?? null;

      // Fixed-size wheel; allow it to overflow (no clamping).
      const anchorX = localX;
      const anchorY = localY;

      setRadialMenu({
        open: true,
        anchorX,
        anchorY,
        cell: { x: targetX, y: targetY },
        token
      });
      return;
    }

    const cellLevel = getBaseHeightAt(targetX, targetY);
    if (cellLevel !== activeLevel) {
      pushLog(`Case (${targetX}, ${targetY}) au niveau ${cellLevel} (actif ${activeLevel}).`);
      return;
    }

    const isEnemyAt = (x: number, y: number) =>
      enemies.some(e => e.hp > 0 && e.x === x && e.y === y);

    if (isEnemyAt(targetX, targetY)) {
      pushLog(
        `Case (${targetX}, ${targetY}) occupee par un ennemi : impossible de s'y deplacer.`
      );
      return;
    }
    if (!isCellPlayable(targetX, targetY)) {
      pushLog(`Case (${targetX}, ${targetY}) hors zone jouable.`);
      return;
    }
    if (obstacleBlocking.movement.has(cellKey(targetX, targetY))) {
      pushLog(`Case (${targetX}, ${targetY}) bloquee par un obstacle.`);
      return;
    }

    setSelectedPath(prev => {
      const maxSteps = Math.max(1, pathLimit);
      const path = [...prev];

      if (path.length >= maxSteps) {
        pushLog(`Limite de ${maxSteps} cases atteinte pour ce tour.`);
        return path;
      }

      const start =
        path.length > 0 ? path[path.length - 1] : { x: player.x, y: player.y };

      if (start.x === targetX && start.y === targetY) return path;

      const stepsRemaining = maxSteps - path.length;
      const tempPlayer = { ...player, x: start.x, y: start.y };
      const tokensForPath: TokenState[] = getTokensOnActiveLevel([
        tempPlayer as TokenState,
        ...enemies
      ]);

      const computed = computePathTowards(
        tempPlayer as TokenState,
        { x: targetX, y: targetY },
        tokensForPath,
        {
          maxDistance: Math.max(0, stepsRemaining),
          allowTargetOccupied: false,
          blockedCells: obstacleBlocking.movement,
          wallEdges: wallEdges.movement,
          playableCells,
          grid: mapGrid,
          heightMap: mapHeight,
          floorIds: mapTerrain,
          activeLevel
        }
      );

      if (computed.length <= 1) {
        pushLog("Aucun chemin valide vers cette case (bloque par obstacle ou entites).");
        return path;
      }

      const appended = computed.slice(1);
      pushLog(`Trajectoire: +${appended.length} case(s) vers (${targetX}, ${targetY}).`);
      return path.concat(appended);
    });
  }

  // -----------------------------------------------------------
  // Player actions: validate / reset movement
  // -----------------------------------------------------------

    function handleValidatePath() {
      if (phase !== "player") return;
      if (isGameOver) return;
      if (isTokenDead(player)) return;
    if (selectedPath.length === 0) return;

    const last = selectedPath[selectedPath.length - 1];
    const from = { x: player.x, y: player.y };
    const facingFrom =
      selectedPath.length > 1
        ? selectedPath[selectedPath.length - 2]
        : { x: player.x, y: player.y };
    const nextFacing = computeFacingTowards(facingFrom, last);

    setPlayer(prev => ({
      ...prev,
      x: last.x,
      y: last.y,
      facing: nextFacing
    }));

    recordCombatEvent({
      round,
      phase: "player",
      kind: "move",
      actorId: player.id,
      actorKind: "player",
      summary: `Le heros se deplace de (${from.x}, ${from.y}) vers (${last.x}, ${last.y}).`,
      data: { from, to: { x: last.x, y: last.y }, steps: selectedPath.length }
    });

    setSelectedPath([]);
    setInteractionMode("idle");
  }

  function handleResetPath() {
    if (phase !== "player") return;
    if (isGameOver) return;
    setSelectedPath([]);
    pushLog("Trajectoire reinitialisee.");
  }

  function handleSetPlayerFacing(
    direction:
      | "up"
      | "down"
      | "left"
      | "right"
      | "up-left"
      | "up-right"
      | "down-left"
      | "down-right"
  ) {
    if (phase !== "player") return;
    if (isGameOver) return;
    setPlayer(prev => ({
      ...prev,
      facing: direction
    }));
    pushLog(`Orientation du joueur mise a jour: ${direction}.`);
  }

  // -----------------------------------------------------------
  // Enemy turn: call backend AI or fallback to local logic
  // -----------------------------------------------------------

  function buildEnemyAiSummary(): EnemyAiStateSummary {
    const playerSummary: PlayerSummary = {
      id: player.id,
      x: player.x,
      y: player.y,
      hp: player.hp,
      maxHp: player.maxHp
    };

    const enemiesSummary: EnemySummary[] = enemies.map(e => ({
      id: e.id,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      type: e.enemyTypeId,
      aiRole: e.aiRole ?? null,
      moveRange: e.moveRange ?? null,
      attackDamage: e.attackDamage ?? null,
      attackRange: e.attackRange ?? null,
      maxAttacksPerTurn: e.maxAttacksPerTurn ?? null,
      actionIds: e.actionIds ?? null
    }));

    return {
      round,
      phase,
      grid: { cols: mapGrid.cols, rows: mapGrid.rows },
      player: playerSummary,
      enemies: enemiesSummary,
      actionsCatalog: actionsCatalog.map(a => ({
        id: a.id,
        name: a.name,
        category: String(a.category ?? ""),
        targeting: {
          target: String(a.targeting?.target ?? ""),
          range: {
            min: Number(a.targeting?.range?.min ?? 0),
            max: Number(a.targeting?.range?.max ?? 0),
            shape: String(a.targeting?.range?.shape ?? "")
          },
          requiresLos: Boolean(a.targeting?.requiresLos)
        }
      }))
    };
  }

  function sanitizeEnemyIntents(intents: EnemyActionIntent[]): EnemyActionIntent[] {
    const enemyIds = new Set(enemies.map(e => e.id));
    const sanitized: EnemyActionIntent[] = [];

    for (const raw of intents) {
      if (!raw || typeof raw !== "object") continue;
      if (typeof raw.enemyId !== "string" || !enemyIds.has(raw.enemyId)) continue;
      if (typeof raw.actionId !== "string" || !raw.actionId.trim()) continue;

      const t = (raw as any).target;
      let target: EnemyActionIntent["target"] = { kind: "none" };
      if (t && typeof t === "object") {
        if (t.kind === "token" && typeof t.tokenId === "string") {
          target = { kind: "token", tokenId: t.tokenId };
        } else if (t.kind === "cell" && typeof t.x === "number" && typeof t.y === "number") {
          target = { kind: "cell", x: t.x, y: t.y };
        }
      }

      const modeRaw = (raw as any).advantageMode;
      const advantageMode =
        modeRaw === "advantage" || modeRaw === "disadvantage" ? modeRaw : "normal";

      sanitized.push({
        enemyId: raw.enemyId,
        actionId: raw.actionId.trim(),
        target,
        advantageMode
      });
    }

    return sanitized;
  }

  async function requestEnemyAiIntents(state: EnemyAiStateSummary): Promise<EnemyActionIntent[]> {
    console.log("[enemy-ai] Envoi etat au backend:", state);
    setAiLastState(state);
    setAiLastError(null);
    setAiUsedFallback(false);

    try {
      const response = await fetch("/api/enemy-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as { intents?: EnemyActionIntent[] };
      if (!data.intents || !Array.isArray(data.intents)) {
        throw new Error("Reponse backend invalide (intents manquant).");
      }

      const sanitized = sanitizeEnemyIntents(data.intents);
      setAiLastIntents(sanitized);
      if (sanitized.length === 0) setAiUsedFallback(true);
      return sanitized;
    } catch (error) {
      setAiLastError(error instanceof Error ? error.message : String(error ?? "unknown"));
      setAiLastIntents(null);
      setAiUsedFallback(true);
      return [];
    }
  }

  function sanitizeEnemyDecisions(decisions: EnemyDecision[]): EnemyDecision[] {
    const enemyIds = new Set(enemies.map(e => e.id));
    const validActions = new Set<EnemyActionType>(["move", "attack", "wait"]);
    const sanitized: EnemyDecision[] = [];
    for (const d of decisions) {
      if (!d || typeof d !== "object") continue;
      if (!enemyIds.has(d.enemyId)) {
        console.warn("[enemy-ai] Decision ignoree (enemyId inconnu):", d);
        continue;
      }
      const action = (d.action || "wait").toLowerCase() as EnemyActionType;
      if (!validActions.has(action)) {
        console.warn("[enemy-ai] Decision ignoree (action invalide):", d);
        continue;
      }
      if (action === "move") {
        if (typeof d.targetX !== "number" || typeof d.targetY !== "number") {
          console.warn("[enemy-ai] Decision move ignoree (cible manquante):", d);
          continue;
        }
      }
      sanitized.push({ ...d, action });
    }
    return sanitized;
  }

  async function requestEnemyAi(
    state: EnemyAiStateSummary
  ): Promise<EnemyDecision[]> {
    console.log("[enemy-ai] Envoi ??tat au backend:", state);
    setAiLastState(state);
    setAiLastError(null);
    setAiUsedFallback(false);

    try {
      const response = await fetch("/api/enemy-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(state)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as { decisions?: EnemyDecision[] };
      if (!data.decisions || !Array.isArray(data.decisions)) {
        throw new Error("R??ponse backend invalide (decisions manquant).");
      }

      const sanitized = sanitizeEnemyDecisions(data.decisions);
      console.log("[enemy-ai] D??cisions re??ues (filtr??es):", sanitized);
      setAiLastDecisions(sanitized);
      if (sanitized.length === 0) {
        setAiUsedFallback(true);
      }
      return sanitized;
    } catch (error) {
      console.warn("[enemy-ai] Erreur lors de la requete IA:", error);
      setAiLastError(
        error instanceof Error ? error.message : String(error ?? "unknown")
      );
      setAiLastDecisions(null);
      setAiUsedFallback(true);
      console.warn("[enemy-ai] D??cisions manquantes, utilisation du fallback local.");
      return [];
    }
  }

  function applyEnemyDecisions(decisions: EnemyDecision[]) {
      if (!decisions.length) {
        // Fallback simple: une "IA locale" pour que ??a bouge quand m??me
        setAiUsedFallback(true);
        setAiLastDecisions([]);
        setEnemies(prevEnemies => {
          const enemiesCopy = prevEnemies.map(e => ({ ...e }));
          let playerCopy = { ...player };
  
          for (const enemy of enemiesCopy) {
            if (isTokenDead(enemy)) {
              continue;
            }

            const allTokens: TokenState[] = [
              playerCopy as TokenState,
              ...enemiesCopy
            ];

            if (
              !areTokensOnSameLevel(enemy, playerCopy as TokenState) ||
              !canEnemySeePlayer(
                enemy,
                playerCopy as TokenState,
                allTokens,
                visionBlockersActive,
                playableCells,
                wallEdges.vision,
                lightLevels,
                mapGrid
              )
            ) {
              pushLog(
                `${enemy.id} ne voit pas le joueur et reste en alerte (fallback).`
              );
              continue;
            }

            const maxRange =
              typeof enemy.moveRange === "number" ? enemy.moveRange : 3;

          const tokensForPath: TokenState[] = getTokensOnActiveLevel([
            playerCopy as TokenState,
            ...enemiesCopy
          ]);

              const path = computePathTowards(
                enemy,
                { x: playerCopy.x, y: playerCopy.y },
                tokensForPath,
                {
                  maxDistance: maxRange,
                  allowTargetOccupied: true,
                  targetCells: getTokenOccupiedCells(playerCopy),
                  blockedCells: obstacleBlocking.movement,
                  wallEdges: wallEdges.movement,
                  playableCells,
                  grid: mapGrid,
                  heightMap: mapHeight,
                  floorIds: mapTerrain,
                  activeLevel
                }
              );

          enemy.plannedPath = path;

          if (path.length === 0) {
            pushLog(
              `${enemy.id} ne trouve pas de chemin valide vers le joueur (fallback, reste en place).`
            );
            continue;
          }

            const destination = path[path.length - 1];
  
            enemy.x = destination.x;
            enemy.y = destination.y;
            enemy.facing = computeFacingTowards(enemy, playerCopy);
  
            const distToPlayer = distanceBetweenTokens(enemy, playerCopy);
            const attackRange = getAttackRangeForToken(enemy);
  
              if (distToPlayer <= attackRange) {
                const targetCell =
                  getClosestFootprintCellToPoint({ x: enemy.x, y: enemy.y }, playerCopy) ??
                  { x: playerCopy.x, y: playerCopy.y };
                const canHit = hasLineOfEffect(
                  { x: enemy.x, y: enemy.y },
                  targetCell,
                  obstacleBlocking.attacks, wallEdges.vision);
                if (!canHit) {
                  pushLog(`${enemy.id} ne peut pas attaquer: obstacle sur la trajectoire.`);
                  continue;
                }
                const baseDamage =
                  typeof enemy.attackDamage === "number" ? enemy.attackDamage : 2;
                const attacks = getMaxAttacksForToken(enemy);
                const totalDamage = baseDamage * attacks;
                const beforeHp = playerCopy.hp;
                playerCopy = {
                  ...playerCopy,
                  hp: Math.max(0, playerCopy.hp - totalDamage)
                };
                pushLog(
                  attacks > 1
                    ? `${enemy.id} suit un chemin et effectue ${attacks} attaques pour un total de ${totalDamage} degats (fallback).`
                    : `${enemy.id} suit un chemin et attaque le joueur pour ${totalDamage} degats (fallback).`
                );
                recordCombatEvent({
                  round,
                  phase,
                  kind: "enemy_attack",
                  actorId: enemy.id,
                  actorKind: "enemy",
                  targetId: playerCopy.id,
                  targetKind: "player",
                  summary: `${enemy.id} atteint le heros pour ${totalDamage} degats (PV ${beforeHp} -> ${playerCopy.hp}).`,
                  data: {
                    damage: totalDamage,
                    attacks,
                    playerHpBefore: beforeHp,
                    playerHpAfter: playerCopy.hp,
                    fallback: true
                  }
                });
                if (playerCopy.hp <= 0 && beforeHp > 0) {
                  recordCombatEvent({
                    round,
                    phase,
                    kind: "death",
                    actorId: playerCopy.id,
                    actorKind: "player",
                    summary: "Le heros s'effondre sous les coups ennemis.",
                    targetId: playerCopy.id,
                    targetKind: "player",
                    data: {
                      killedBy: enemy.id
                    }
                  });
                }
              } else {
                pushLog(
                `${enemy.id} suit un chemin vers (${destination.x}, ${destination.y}) (fallback).`
              );
            }
          }

        setPlayer(playerCopy);
        return enemiesCopy;
      });
      return;
    }

    setAiUsedFallback(false);

      // Apply remote decisions in a single pass
      setEnemies(prevEnemies => {
        const enemiesCopy = prevEnemies.map(e => ({ ...e }));
        let playerCopy = { ...player };
  
        for (const rawDecision of decisions) {
          const enemy = enemiesCopy.find(e => e.id === rawDecision.enemyId);
          if (!enemy) continue;
          if (isTokenDead(enemy)) continue;

          const allTokens: TokenState[] = [
            playerCopy as TokenState,
            ...enemiesCopy
          ];

          const action = (rawDecision.action || "wait").toLowerCase() as EnemyActionType;
          console.log("[enemy-ai] Application action", {
            enemyId: enemy.id,
            action,
            targetX: rawDecision.targetX,
            targetY: rawDecision.targetY
          });

          if (action === "wait") {
            pushLog(`${enemy.id} attend.`);
            continue;
          }

          if (action === "move") {
            if (
              !areTokensOnSameLevel(enemy, playerCopy as TokenState) ||
              !canEnemySeePlayer(
                enemy,
                playerCopy as TokenState,
                allTokens,
                visionBlockersActive,
                playableCells,
                wallEdges.vision,
                lightLevels,
                mapGrid
              )
            ) {
              pushLog(
                `${enemy.id} ne voit pas le joueur et reste en alerte.`
              );
              continue;
            }

            // Accepte soit targetX/targetY, soit target: { x, y }
            let tx: number | undefined = rawDecision.targetX;
            let ty: number | undefined = rawDecision.targetY;
            const anyDecision = rawDecision as any;
            if (
              (typeof tx !== "number" || typeof ty !== "number") &&
              anyDecision.target &&
              typeof anyDecision.target.x === "number" &&
              typeof anyDecision.target.y === "number"
            ) {
              tx = anyDecision.target.x;
              ty = anyDecision.target.y;
            }

            if (typeof tx !== "number" || typeof ty !== "number") {
              pushLog(
                `${enemy.id}: decision MOVE ignoree (pas de cible valide).`
              );
              continue;
            }

            const maxRange =
              typeof enemy.moveRange === "number" ? enemy.moveRange : 3;

            const targetX = clamp(tx, 0, mapGrid.cols - 1);
            const targetY = clamp(ty, 0, mapGrid.rows - 1);

            const tokensForPath: TokenState[] = getTokensOnActiveLevel([
              playerCopy as TokenState,
              ...enemiesCopy
            ]);

              const path = computePathTowards(
                enemy,
                { x: targetX, y: targetY },
                tokensForPath,
                {
                  maxDistance: maxRange,
                  allowTargetOccupied: true,
                  blockedCells: obstacleBlocking.movement,
                  wallEdges: wallEdges.movement,
                  playableCells,
                  grid: mapGrid,
                  heightMap: mapHeight,
                  floorIds: mapTerrain,
                  activeLevel
                }
              );

            enemy.plannedPath = path;

            if (path.length === 0) {
              pushLog(
                `${enemy.id}: aucun trajet valide vers (${targetX}, ${targetY}), reste en place.`
              );
              continue;
            }

            const destination = path[path.length - 1];
            enemy.x = destination.x;
            enemy.y = destination.y;
            enemy.facing = computeFacingTowards(enemy, playerCopy);
            pushLog(
              `${enemy.id} suit un chemin vers (${destination.x}, ${destination.y}).`
            );
            continue;
          }

          if (action === "attack") {
            enemy.facing = computeFacingTowards(enemy, playerCopy);

            if (
              !areTokensOnSameLevel(enemy, playerCopy as TokenState) ||
              !canEnemySeePlayer(
                enemy,
                playerCopy as TokenState,
                allTokens,
                visionBlockersActive,
                playableCells,
                wallEdges.vision,
                lightLevels,
                mapGrid
              )
            ) {
              pushLog(
                `${enemy.id} voulait attaquer mais ne voit pas le joueur.`
              );
              continue;
            }

            const distToPlayer = distanceBetweenTokens(enemy, playerCopy);
            const attackRange = getAttackRangeForToken(enemy);

            if (distToPlayer <= attackRange) {
              const targetCell =
                getClosestFootprintCellToPoint({ x: enemy.x, y: enemy.y }, playerCopy) ??
                { x: playerCopy.x, y: playerCopy.y };
              const canHit = hasLineOfEffect(
                { x: enemy.x, y: enemy.y },
                targetCell,
                obstacleBlocking.attacks, wallEdges.vision);
              if (!canHit) {
                pushLog(`${enemy.id} ne peut pas attaquer: obstacle sur la trajectoire.`);
                continue;
              }
              const baseDamage =
                typeof enemy.attackDamage === "number" ? enemy.attackDamage : 2;
              const attacks = getMaxAttacksForToken(enemy);
              const totalDamage = baseDamage * attacks;
              playerCopy = {
                ...playerCopy,
                hp: Math.max(0, playerCopy.hp - totalDamage)
              };
              pushLog(
                attacks > 1
                  ? `${enemy.id} effectue ${attacks} attaques et inflige ${totalDamage} degats au joueur.`
                  : `${enemy.id} attaque le joueur pour ${totalDamage} degats.`
              );
            } else {
              pushLog(
                `${enemy.id} voulait attaquer mais est trop loin (ignore).`
              );
            }
          }
        }

      setPlayer(playerCopy);
      return enemiesCopy;
    });
  }

  async function runSingleEnemyTurn(activeEnemyId: string) {
  setIsResolvingEnemies(true);

  setSelectedPath([]);
  setEffectSpecs([]);

  const summary = buildEnemyAiSummary();
  const decisions = await requestEnemyAi(summary);
  const filtered = decisions.filter(d => d.enemyId === activeEnemyId);

  if (filtered.length === 0) {
    // Fallback local pour cet ennemi uniquement
    setAiUsedFallback(true);
    setAiLastDecisions([]);
    setEnemies(prevEnemies => {
      const enemiesCopy = prevEnemies.map(e => ({ ...e }));
      let playerCopy = { ...player };

        const enemy = enemiesCopy.find(e => e.id === activeEnemyId);
        if (!enemy) return prevEnemies;
        if (isTokenDead(enemy)) return prevEnemies;

        const allTokens: TokenState[] = [
          playerCopy as TokenState,
          ...enemiesCopy
        ];

        if (
          !areTokensOnSameLevel(enemy, playerCopy as TokenState) ||
          !canEnemySeePlayer(
            enemy,
            playerCopy as TokenState,
            allTokens,
            visionBlockersActive,
            playableCells,
            wallEdges.vision,
            lightLevels,
            mapGrid
          )
        ) {
          pushLog(
            `${enemy.id} ne voit pas le joueur et reste en alerte (fallback).`
          );
          return enemiesCopy;
        }

      const maxRange =
        typeof enemy.moveRange === "number" ? enemy.moveRange : 3;

      const tokensForPath: TokenState[] = getTokensOnActiveLevel([
        playerCopy as TokenState,
        ...enemiesCopy
      ]);

      const path = computePathTowards(
        enemy,
        { x: playerCopy.x, y: playerCopy.y },
        tokensForPath,
        {
          maxDistance: maxRange,
          allowTargetOccupied: true,
          targetCells: getTokenOccupiedCells(playerCopy),
          blockedCells: obstacleBlocking.movement,
          wallEdges: wallEdges.movement,
          playableCells,
          grid: mapGrid,
          heightMap: mapHeight,
          floorIds: mapTerrain,
          activeLevel
        }
      );

      enemy.plannedPath = path;

        if (path.length === 0) {
          pushLog(
            `${enemy.id} ne trouve pas de chemin valide vers le joueur (fallback, reste en place).`
          );
        } else {
          const destination = path[path.length - 1];
          enemy.x = destination.x;
          enemy.y = destination.y;
          enemy.facing = computeFacingTowards(enemy, playerCopy);
  
          const distToPlayer = distanceBetweenTokens(enemy, playerCopy);
          const attackRange = getAttackRangeForToken(enemy);
  
            if (distToPlayer <= attackRange) {
              const targetCell =
                getClosestFootprintCellToPoint({ x: enemy.x, y: enemy.y }, playerCopy) ??
                { x: playerCopy.x, y: playerCopy.y };
              const canHit = hasLineOfEffect(
                { x: enemy.x, y: enemy.y },
                targetCell,
                obstacleBlocking.attacks, wallEdges.vision);
              if (!canHit) {
                pushLog(`${enemy.id} ne peut pas attaquer: obstacle sur la trajectoire.`);
              } else {
              const baseDamage =
                typeof enemy.attackDamage === "number" ? enemy.attackDamage : 2;
              const attacks = getMaxAttacksForToken(enemy);
              const totalDamage = baseDamage * attacks;
              const beforeHp = playerCopy.hp;
              playerCopy = {
                ...playerCopy,
                hp: Math.max(0, playerCopy.hp - totalDamage)
              };
              pushLog(
                attacks > 1
                  ? `${enemy.id} suit un chemin et effectue ${attacks} attaques pour un total de ${totalDamage} degats (fallback).`
                  : `${enemy.id} suit un chemin et attaque le joueur pour ${totalDamage} degats (fallback).`
              );
              recordCombatEvent({
                round,
                phase,
                kind: "enemy_attack",
                actorId: enemy.id,
                actorKind: "enemy",
                targetId: playerCopy.id,
                targetKind: "player",
                summary: `${enemy.id} atteint le heros pour ${totalDamage} degats (PV ${beforeHp} -> ${playerCopy.hp}).`,
                data: {
                  damage: totalDamage,
                  attacks,
                  playerHpBefore: beforeHp,
                  playerHpAfter: playerCopy.hp,
                  fallback: true
                }
              });
                if (playerCopy.hp <= 0 && beforeHp > 0) {
                  recordCombatEvent({
                    round,
                    phase,
                    kind: "death",
                    actorId: playerCopy.id,
                    actorKind: "player",
                    summary: "Le heros s'effondre sous les coups ennemis.",
                    targetId: playerCopy.id,
                    targetKind: "player",
                    data: {
                      killedBy: enemy.id
                    }
                  });
                }
              }
            } else {
              pushLog(
                `${enemy.id} suit un chemin vers (${destination.x}, ${destination.y}) (fallback).`
              );
            }
          }

      setPlayer(playerCopy);
      return enemiesCopy;
    });
  } else {
    // Application des d??cisions backend pour cet ennemi uniquement
    setAiUsedFallback(false);
    setAiLastDecisions(filtered);
    setEnemies(prevEnemies => {
      const enemiesCopy = prevEnemies.map(e => ({ ...e }));
      let playerCopy = { ...player };

        for (const rawDecision of filtered) {
          const enemy = enemiesCopy.find(e => e.id === rawDecision.enemyId);
          if (!enemy) continue;

          const allTokens: TokenState[] = [
            playerCopy as TokenState,
            ...enemiesCopy
          ];
  
          const action = (rawDecision.action || "wait").toLowerCase() as EnemyActionType;

        if (action === "wait") {
          pushLog(`${enemy.id} attend.`);
          continue;
        }

          if (action === "move") {
            if (
              !areTokensOnSameLevel(enemy, playerCopy as TokenState) ||
              !canEnemySeePlayer(
                enemy,
                playerCopy as TokenState,
                allTokens,
                visionBlockersActive,
                playableCells,
                wallEdges.vision,
                lightLevels,
                mapGrid
              )
            ) {
              pushLog(
                `${enemy.id} ne voit pas le joueur et reste en alerte.`
              );
              continue;
            }

            let tx: number | undefined = rawDecision.targetX;
            let ty: number | undefined = rawDecision.targetY;
          const anyDecision = rawDecision as any;
          if (
            (typeof tx !== "number" || typeof ty !== "number") &&
            anyDecision.target &&
            typeof anyDecision.target.x === "number" &&
            typeof anyDecision.target.y === "number"
          ) {
            tx = anyDecision.target.x;
            ty = anyDecision.target.y;
          }

          if (typeof tx !== "number" || typeof ty !== "number") {
            pushLog(
              `${enemy.id}: decision MOVE ignoree (pas de cible valide).`
            );
            continue;
          }

          const maxRange =
            typeof enemy.moveRange === "number" ? enemy.moveRange : 3;

          const targetX = clamp(tx, 0, mapGrid.cols - 1);
          const targetY = clamp(ty, 0, mapGrid.rows - 1);

          const tokensForPath: TokenState[] = getTokensOnActiveLevel([
            playerCopy as TokenState,
            ...enemiesCopy
          ]);

          const path = computePathTowards(
            enemy,
            { x: targetX, y: targetY },
            tokensForPath,
            {
              maxDistance: maxRange,
              allowTargetOccupied: true,
              blockedCells: obstacleBlocking.movement,
              wallEdges: wallEdges.movement,
              playableCells,
              grid: mapGrid,
              heightMap: mapHeight,
              floorIds: mapTerrain,
              activeLevel
            }
          );

          enemy.plannedPath = path;

          if (path.length === 0) {
            pushLog(
              `${enemy.id}: aucun trajet valide vers (${targetX}, ${targetY}), reste en place.`
            );
            continue;
          }

          const destination = path[path.length - 1];
          enemy.x = destination.x;
          enemy.y = destination.y;
          enemy.facing = computeFacingTowards(enemy, playerCopy);
          pushLog(
            `${enemy.id} suit un chemin vers (${destination.x}, ${destination.y}).`
          );
          continue;
        }

          if (action === "attack") {
            enemy.facing = computeFacingTowards(enemy, playerCopy);

            if (
              !areTokensOnSameLevel(enemy, playerCopy as TokenState) ||
              !canEnemySeePlayer(
                enemy,
                playerCopy as TokenState,
                allTokens,
                visionBlockersActive,
                playableCells,
                wallEdges.vision,
                lightLevels,
                mapGrid
              )
            ) {
              pushLog(
                `${enemy.id} voulait attaquer mais ne voit pas le joueur.`
              );
              continue;
            }

            const distToPlayer = distanceBetweenTokens(enemy, playerCopy);
            const attackRange = getAttackRangeForToken(enemy);

            if (distToPlayer <= attackRange) {
              const targetCell =
                getClosestFootprintCellToPoint({ x: enemy.x, y: enemy.y }, playerCopy) ??
                { x: playerCopy.x, y: playerCopy.y };
              const canHit = hasLineOfEffect(
                { x: enemy.x, y: enemy.y },
                targetCell,
                obstacleBlocking.attacks, wallEdges.vision);
              if (!canHit) {
                pushLog(`${enemy.id} ne peut pas attaquer: obstacle sur la trajectoire.`);
                continue;
              }
              const baseDamage =
                typeof enemy.attackDamage === "number" ? enemy.attackDamage : 2;
              const attacks = getMaxAttacksForToken(enemy);
              const totalDamage = baseDamage * attacks;
              playerCopy = {
                ...playerCopy,
                hp: Math.max(0, playerCopy.hp - totalDamage)
              };
              pushLog(
                attacks > 1
                  ? `${enemy.id} effectue ${attacks} attaques et inflige ${totalDamage} degats au joueur.`
                  : `${enemy.id} attaque le joueur pour ${totalDamage} degats.`
              );
            } else {
              pushLog(
                `${enemy.id} voulait attaquer mais est trop loin (ignore).`
            );
          }
        }
      }

      setPlayer(playerCopy);
      return enemiesCopy;
    });
  }

  setIsResolvingEnemies(false);
  advanceTurn();
}

  async function updateEnemySpeechAfterTurn(
    enemyId: string,
    playerState: TokenState,
    enemiesState: TokenState[]
  ): Promise<void> {
    const enemy = enemiesState.find(e => e.id === enemyId);
    if (!enemy) return;
    if (isTokenDead(enemy)) return;

    const allTokens: TokenState[] = getTokensOnActiveLevel([playerState, ...enemiesState]);
    const visible = getEntitiesInVision(
      enemy,
      allTokens,
      visionBlockersActive,
      playableCells,
      wallEdges.vision,
      lightLevels,
      mapGrid
    );

    const alliesVisible = visible
      .filter(t => t.type === "enemy" && t.id !== enemyId && !isTokenDead(t))
      .map(t => t.id);

    const enemiesVisible = visible
      .filter(t => t.type === "player" && !isTokenDead(t))
      .map(t => t.id);

    const canSeePlayerNow =
      areTokensOnSameLevel(enemy, playerState) &&
      canEnemySeePlayer(
        enemy,
        playerState,
        allTokens,
        visionBlockersActive,
        playableCells,
        wallEdges.vision,
        lightLevels,
        mapGrid
      );
    const distToPlayer = distanceBetweenTokens(enemy, playerState);
    const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;

    const payload: EnemySpeechRequest = {
      language: "fr",
      maxLines: 2,
      enemyId,
      enemyTypeId: enemy.enemyTypeId ?? null,
      aiRole: enemy.aiRole ?? null,
      speechProfile: enemy.speechProfile ?? null,
      perception: {
        canSeePlayer: canSeePlayerNow,
        distanceToPlayer: Number.isFinite(distToPlayer) ? distToPlayer : null,
        hpRatio: Number.isFinite(hpRatio) ? hpRatio : 0,
        alliesVisible,
        enemiesVisible,
        lastKnownPlayerPos: canSeePlayerNow
          ? { x: playerState.x, y: playerState.y }
          : null
      },
      priorSpeechesThisRound: getPriorEnemySpeechesThisRound(),
      selfLastSpeech: getLastSpeechForEnemy(enemyId),
      recentEvents: getRecentCombatEvents(16)
    };

    const response = await requestEnemySpeech(payload);
    const line = (response.line ?? "").trim();
    if (!line) {
      clearEnemyBubble(enemyId);
      return;
    }

    setEnemyBubble(enemyId, line);
    recordEnemySpeech(enemyId, line);
  }

  async function runSingleEnemyTurnV2(activeEnemyId: string) {
    setIsResolvingEnemies(true);

    setSelectedPath([]);
    setEffectSpecs([]);

    const enemiesCopy = enemies.map(e => ({ ...e }));
    let playerCopy = { ...player };

    const activeEnemy = enemiesCopy.find(e => e.id === activeEnemyId);
    if (!activeEnemy || isTokenDead(activeEnemy)) {
      setIsResolvingEnemies(false);
      advanceTurn();
      return;
    }

    const summary = buildEnemyAiSummary();
    const intents = await requestEnemyAiIntents(summary);
    const filtered = intents.filter(i => i.enemyId === activeEnemyId);

    const allTokens: TokenState[] = getTokensOnActiveLevel([
      playerCopy as TokenState,
      ...enemiesCopy
    ]);
    const enemyActionIds =
      Array.isArray(activeEnemy.actionIds) && activeEnemy.actionIds.length
        ? activeEnemy.actionIds
        : ["enemy-move", "enemy-melee-strike"];

    const getActionById = (id: string) => actionsCatalog.find(a => a.id === id) ?? null;

    const tryResolve = (actionId: string, target: ActionTarget, advantageMode?: AdvantageMode) => {
      const action = getActionById(actionId);
      if (!action) return { ok: false as const, reason: `Action inconnue: ${actionId}` };
      if (!enemyActionIds.includes(actionId)) {
        return { ok: false as const, reason: `Action non autorisee pour ${activeEnemy.id}: ${actionId}` };
      }

      const result = resolveAction(
        action,
        {
          round,
          phase: "enemies",
          actor: activeEnemy,
          player: playerCopy,
          enemies: enemiesCopy,
          blockedMovementCells: obstacleBlocking.movement,
          blockedMovementEdges: wallEdges.movement,
          blockedVisionCells: visionBlockersActive,
          blockedAttackCells: obstacleBlocking.attacks,
          wallVisionEdges: wallEdges.vision,
          lightLevels,
          playableCells,
          grid: mapGrid,
          heightMap: mapHeight,
          floorIds: mapTerrain,
          activeLevel,
          sampleCharacter,
          onLog: pushLog,
          emitEvent: evt => {
            recordCombatEvent({
              round,
              phase: "enemies",
              kind: evt.kind,
              actorId: evt.actorId,
              actorKind: evt.actorKind,
              targetId: evt.targetId ?? null,
              targetKind: evt.targetKind ?? null,
              summary: evt.summary,
              data: evt.data ?? {}
            });
          }
        },
        target,
        { advantageMode }
      );

      if (!result.ok || !result.playerAfter || !result.enemiesAfter) {
        return { ok: false as const, reason: result.reason || "Echec de resolution." };
      }

      playerCopy = result.playerAfter;
      for (let i = 0; i < enemiesCopy.length; i++) {
        enemiesCopy[i] = result.enemiesAfter[i] ?? enemiesCopy[i];
      }
      return { ok: true as const, action };
    };

    let usedFallback = false;

    if (filtered.length > 0) {
      const intent = filtered[0];
      const targetSpec = intent.target;
      let target: ActionTarget = { kind: "none" };
      if (targetSpec.kind === "token") {
        const token = allTokens.find(t => t.id === targetSpec.tokenId) ?? null;
        if (token) target = { kind: "token", token };
      } else if (targetSpec.kind === "cell") {
        target = { kind: "cell", x: targetSpec.x, y: targetSpec.y };
      }

      const resolved = tryResolve(intent.actionId, target, intent.advantageMode as AdvantageMode);
      if (!resolved.ok) {
        usedFallback = true;
        pushLog(`${activeEnemy.id}: intent IA invalide (${resolved.reason}).`);
      } else {
        setAiUsedFallback(false);
      }
    } else {
      usedFallback = true;
    }

    if (usedFallback) {
      setAiUsedFallback(true);

      const canSee =
        areTokensOnSameLevel(activeEnemy, playerCopy as TokenState) &&
          canEnemySeePlayer(
            activeEnemy,
            playerCopy as TokenState,
            allTokens,
            visionBlockersActive,
            playableCells,
            wallEdges.vision,
            lightLevels,
            mapGrid
          );
      if (!canSee) {
        pushLog(`${activeEnemy.id} ne voit pas le joueur et reste en alerte.`);
      } else {
        const distToPlayer = distanceBetweenTokens(activeEnemy, playerCopy);

        const hasBow = enemyActionIds.includes("enemy-bow-shot");
        const hasMelee = enemyActionIds.includes("enemy-melee-strike");
        const canMove = enemyActionIds.includes("enemy-move");

        const moveRange = typeof activeEnemy.moveRange === "number" ? activeEnemy.moveRange : 3;
        const isArcher = activeEnemy.aiRole === "archer";
        const preferredMin = isArcher ? 3 : 1;
        const panicRange = isArcher ? 2 : 0;
        let acted = false;

        const pickBestRetreatCell = () => {
          let best: { x: number; y: number } | null = null;
          let bestDist = -1;
          for (let dx = -moveRange; dx <= moveRange; dx++) {
            for (let dy = -moveRange; dy <= moveRange; dy++) {
              const steps = Math.abs(dx) + Math.abs(dy);
              if (steps === 0 || steps > moveRange) continue;
              const x = activeEnemy.x + dx;
              const y = activeEnemy.y + dy;
              if (!isCellPlayable(x, y)) continue;
              if (getTokenAt({ x, y }, allTokens)) continue;
              const d = distanceFromPointToToken({ x, y }, playerCopy);
              if (d > bestDist) {
                bestDist = d;
                best = { x, y };
              }
            }
          }
          return best;
        };

        // 1) Archer: tire si possible.
        if (!acted && playerCopy.hp > 0 && isArcher && hasBow) {
          const bow = getActionById("enemy-bow-shot");
          const min = bow?.targeting?.range?.min ?? 2;
          const max = bow?.targeting?.range?.max ?? 6;
          if (distToPlayer >= min && distToPlayer <= max) {
            const shot = tryResolve("enemy-bow-shot", { kind: "token", token: playerCopy });
            if (shot.ok) {
              recordCombatEvent({
                round,
                phase: "enemies",
                kind: "enemy_attack",
                actorId: activeEnemy.id,
                actorKind: "enemy",
                targetId: playerCopy.id,
                targetKind: "player",
                summary: `${activeEnemy.id} tire a distance (${shot.action.name}).`,
                data: { actionId: shot.action.id, fallback: true }
              });
              acted = true;
            }
          }
        }

        // 2) Archer trop proche: recule.
        if (!acted && playerCopy.hp > 0 && isArcher && canMove && distToPlayer <= panicRange) {
          const destination = pickBestRetreatCell();
          if (destination) {
            const from = { x: activeEnemy.x, y: activeEnemy.y };
            const moved = tryResolve("enemy-move", { kind: "cell", x: destination.x, y: destination.y });
            if (moved.ok) {
              recordCombatEvent({
                round,
                phase: "enemies",
                kind: "move",
                actorId: activeEnemy.id,
                actorKind: "enemy",
                summary: `${activeEnemy.id} recule de (${from.x}, ${from.y}) vers (${destination.x}, ${destination.y}).`,
                data: { from, to: destination, fallback: true, actionId: moved.action.id }
              });
              acted = true;
            }
          }
        }

        // 3) Non-archer: melee si au contact.
        if (!acted && playerCopy.hp > 0 && !isArcher && hasMelee && distToPlayer <= 1) {
          const melee = tryResolve("enemy-melee-strike", { kind: "token", token: playerCopy });
          if (melee.ok) {
            recordCombatEvent({
              round,
              phase: "enemies",
              kind: "enemy_attack",
              actorId: activeEnemy.id,
              actorKind: "enemy",
              targetId: playerCopy.id,
              targetKind: "player",
              summary: `${activeEnemy.id} attaque au contact (${melee.action.name}).`,
              data: { actionId: melee.action.id, fallback: true }
            });
            acted = true;
          }
        }

        // 4) Sinon: deplacement (archer: vers une distance preferee, sinon: vers le joueur).
        if (!acted && playerCopy.hp > 0 && canMove) {
          let destination: { x: number; y: number } | null = null;

          if (isArcher) {
            // Simple: si trop loin, s'approche; si trop proche (mais > panicRange), cherche une case >= preferredMin.
            if (distToPlayer > preferredMin) {
              const tokensForPath = getTokensOnActiveLevel(allTokens);
              const path = computePathTowards(
                activeEnemy,
                { x: playerCopy.x, y: playerCopy.y },
                tokensForPath,
                {
                  maxDistance: moveRange,
                  allowTargetOccupied: false,
                  blockedCells: obstacleBlocking.movement,
                  wallEdges: wallEdges.movement,
                  playableCells,
                  grid: mapGrid,
                  heightMap: mapHeight,
                  floorIds: mapTerrain,
                  activeLevel
                }
              );
              if (path.length) destination = path[path.length - 1];
            } else {
              destination = pickBestRetreatCell();
            }
          } else {
            const tokensForPath = getTokensOnActiveLevel(allTokens);
            const path = computePathTowards(
              activeEnemy,
              { x: playerCopy.x, y: playerCopy.y },
              tokensForPath,
              {
                maxDistance: moveRange,
                allowTargetOccupied: false,
                blockedCells: obstacleBlocking.movement,
                wallEdges: wallEdges.movement,
                playableCells,
                grid: mapGrid,
                heightMap: mapHeight,
                floorIds: mapTerrain,
                activeLevel
              }
            );
            if (path.length) destination = path[path.length - 1];
          }

          if (destination) {
            const from = { x: activeEnemy.x, y: activeEnemy.y };
            const moved = tryResolve("enemy-move", { kind: "cell", x: destination.x, y: destination.y });
            if (moved.ok) {
              recordCombatEvent({
                round,
                phase: "enemies",
                kind: "move",
                actorId: activeEnemy.id,
                actorKind: "enemy",
                summary: `${activeEnemy.id} se deplace de (${from.x}, ${from.y}) vers (${destination.x}, ${destination.y}).`,
                data: { from, to: destination, fallback: true, actionId: moved.action.id }
              });
              acted = true;
            }
          }
        }

        // 5) Derniere option: si archer au contact, tente melee.
        if (!acted && playerCopy.hp > 0 && isArcher && hasMelee && distToPlayer <= 1) {
          const melee = tryResolve("enemy-melee-strike", { kind: "token", token: playerCopy });
          if (melee.ok) {
            recordCombatEvent({
              round,
              phase: "enemies",
              kind: "enemy_attack",
              actorId: activeEnemy.id,
              actorKind: "enemy",
              targetId: playerCopy.id,
              targetKind: "player",
              summary: `${activeEnemy.id} attaque au contact (${melee.action.name}).`,
              data: { actionId: melee.action.id, fallback: true }
            });
            acted = true;
          }
        }
      }
    }

    setPlayer(playerCopy);
    setEnemies(enemiesCopy);

    try {
      await updateEnemySpeechAfterTurn(activeEnemyId, playerCopy, enemiesCopy);
    } catch {
      // ignore speech failures
    }

    const next = peekNextTurnEntry();
    if (narrationPendingRef.current && next.entry?.kind === "player") {
      try {
        const stateEnd = buildCombatStateSummaryFrom("player", playerCopy, enemiesCopy);
        const payload = buildRoundNarrationRequest({
          focusActorId: playerCopy.id ?? null,
          stateEnd
        });
        if (payload) {
          const narration = await requestRoundNarration(payload);
          const text = (narration.error || narration.summary || "").trim();
          if (text) pushNarrative(text);
        }
      } catch {
        pushNarrative("IA non fonctionnel.");
      } finally {
        clearRoundNarrationBuffer();
        narrationPendingRef.current = false;
      }
    }

    setIsResolvingEnemies(false);
    advanceTurn();
  }

function handleEndPlayerTurn() {
    if (isGameOver) return;
    const entry = getActiveTurnEntry();
    if (!entry || entry.kind !== "player") return;
    pushLog(`Fin du tour joueur (round ${round}).`);

    narrationPendingRef.current = true;
    recordCombatEvent({
      round,
      phase: "player",
      kind: "turn_end",
      actorId: player.id,
      actorKind: "player",
      summary: `Fin du tour du heros (round ${round}).`
    });
    advanceTurn();
  }

  // -----------------------------------------------------------
  // Demo AoE controls (attach effects to player)
  // -----------------------------------------------------------

  function handleShowCircleEffect() {
    setEffectSpecs([
      {
        id: "demo-circle",
        kind: "circle",
        radius: 2
      }
    ]);
    pushLog("Zone d'effet: cercle (rayon 2) autour du joueur.");
  }

  function handleShowRectangleEffect() {
    setEffectSpecs([
      {
        id: "demo-rect",
        kind: "rectangle",
        width: 3,
        height: 3
      }
    ]);
    pushLog("Zone d'effet: rectangle 3x3 centre sur le joueur.");
  }

  function handleShowConeEffect() {
    setEffectSpecs([
      {
        id: "demo-cone",
        kind: "cone",
        range: 4,
        direction: "right"
      }
    ]);
    pushLog("Zone d'effet: cone vers la droite (portee 4).");
  }

  function handleClearEffects() {
    setEffectSpecs([]);
    pushLog("Zones d'effet effacees.");
  }

  // Pixi is initialized via `usePixiBoard`.

    // Game over si le joueur n'a plus de PV et aucun alli?? vivant
    useEffect(() => {
      if (isGameOver) return;

      if (player.hp <= 0) {
        const alliesAlive = [player, ...enemies].some(
          t => t.type === "player" && !isTokenDead(t)
        );
        if (!alliesAlive) {
          setIsGameOver(true);
        }
      }
    }, [player, enemies, isGameOver]);

  // Pixi rendering is handled via hooks (tokens, bubbles, overlays).
  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------

  const selectedAction =
    actions.find(action => action.id === selectedActionId) || actions[0] || null;
  const selectedAvailability = selectedAction
    ? computeActionAvailability(selectedAction)
    : null;
  const validatedAction = getValidatedAction();
  const showDicePanel = actionNeedsDiceUI(validatedAction);
  const contextAction = actionContext
    ? actions.find(a => a.id === actionContext.actionId) || null
    : null;
  const contextAvailabilityRaw = contextAction
    ? computeActionAvailability(contextAction)
    : null;
  const contextAvailability =
    actionContext?.stage === "active" &&
    contextAction &&
    validatedActionId === contextAction.id
      ? { enabled: true, reasons: [], details: contextAvailabilityRaw?.details ?? [] }
      : contextAvailabilityRaw;

  const isPlayerTurn = phase === "player";
  const activeEntry = getActiveTurnEntry();
  const timelineEntries = turnOrder;

    if (!isCombatConfigured) {
      return (
        <CombatSetupScreen
          configEnemyCount={configEnemyCount}
          enemyTypeCount={enemyTypes.length}
          gridCols={mapGrid.cols}
          gridRows={mapGrid.rows}
          mapPrompt={mapPrompt}
          onChangeMapPrompt={setMapPrompt}
          onChangeEnemyCount={setConfigEnemyCount}
          onNoEnemyTypes={() =>
            pushLog(
              "Aucun type d'ennemi charge (enemyTypes). Impossible de generer le combat."
            )
          }
          onStartCombat={handleStartCombat}
        />
      );
/*
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0b0b12",
          color: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
          padding: 16,
          boxSizing: "border-box"
        }}
      >
        <h1 style={{ marginBottom: 8 }}>Pr??paration du combat</h1>
        <p style={{ marginBottom: 16, fontSize: 13, maxWidth: 480, textAlign: "center" }}>
          Configurez le combat avant de lancer la grille : nombre d&apos;ennemis,
          puis d??marrez pour effectuer les jets d&apos;initiative et entrer en
          mode tour par tour.
        </p>
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "#141421",
            border: "1px solid #333",
            minWidth: 260,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          <label style={{ fontSize: 13 }}>
            Nombre d&apos;ennemis :
            <input
              type="number"
              min={1}
              max={8}
              value={configEnemyCount}
              onChange={e =>
                setConfigEnemyCount(
                  Math.max(1, Math.min(8, Number(e.target.value) || 1))
                )
              }
              style={{
                marginLeft: 8,
                width: 60,
                background: "#0f0f19",
                color: "#f5f5f5",
                border: "1px solid #333",
                borderRadius: 4,
                padding: "2px 4px"
              }}
            />
          </label>
          <p style={{ fontSize: 11, color: "#b0b8c4", margin: 0 }}>
            Taille de la carte : {mapGrid.cols} x {mapGrid.rows} (peut ??tre ajust??e automatiquement par le g??n??rateur).
          </p>
          <button
            type="button"
            onClick={() => {
              if (enemyTypes.length === 0) {
                pushLog(
                  "Aucun type d'ennemi charge (enemyTypes). Impossible de generer le combat."
                );
                return;
              }
              const newEnemies: TokenState[] = [];
              const pick = (index: number) =>
                enemyTypes[index % enemyTypes.length];
              for (let i = 0; i < configEnemyCount; i++) {
                newEnemies.push(
                  createEnemy(i, pick(i), computeEnemySpawnPosition(i, mapGrid.cols, mapGrid.rows))
                );
              }
              setEnemies(newEnemies);
              setRound(1);
              setHasRolledInitiative(false);
              setTurnOrder([]);
              setCurrentTurnIndex(0);
              setIsCombatConfigured(true);
            }}
            style={{
              marginTop: 8,
              padding: "6px 12px",
              background: "#2ecc71",
              color: "#0b0b12",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13
            }}
          >
            Lancer le combat
          </button>
            </div>
          </div>

      </div>
    );
*/
  }

  const canInteractWithBoard =
    phase === "player" && !isGameOver && !isTokenDead(player);

  function openActionContextFromWheel(action: ActionDefinition) {
    const anchorX = radialMenu?.anchorX ?? 0;
    const anchorY = radialMenu?.anchorY ?? 0;
    setSelectedActionId(action.id);
    setActionContext({ anchorX, anchorY, actionId: action.id, stage: "draft" });
  }

  function closeActionContext() {
    setActionContext(null);
    setTargetMode("none");
  }

  function handleValidateActionFromContext(action: ActionDefinition) {
    handleUseAction(action);
    setActionContext(current => (current ? { ...current, actionId: action.id, stage: "active" } : current));
  }

  function handleEnterInspectModeFromWheel() {
    if (!canInteractWithBoard) return;
    setTargetMode("none");
    setInteractionMode("inspect-select");
    pushLog(
      `Inspection: cliquez sur une case VISIBLE (portee ${INSPECT_RANGE}) pour reveler nature / etat / role.`
    );
  }

  function handleEnterLookModeFromWheel() {
    if (!canInteractWithBoard) return;
    setTargetMode("none");
    setInteractionMode("look-select");
    pushLog("Tourner le regard: cliquez sur une case pour orienter le champ de vision.");
  }

  function openInteractionWheel(
    anchorX: number,
    anchorY: number,
    target: InteractionTarget,
    interactions: InteractionSpec[]
  ) {
    setInteractionContext(null);
    const items: WheelMenuItem[] = interactions.map(interaction => ({
      id: `interaction-${interaction.id}`,
      label: interaction.label,
      color: "#9b59b6",
      onSelect: () => {
        setInteractionContext({ anchorX, anchorY, interaction, target });
      }
    }));
    setInteractionMenuItems(items);
  }

  function handleExecuteInteraction(
    interaction: InteractionSpec,
    target: InteractionTarget
  ) {
    const availability = getInteractionAvailability(interaction, target);
    if (!availability.ok) {
      pushLog(`Interaction ${interaction.label}: ${availability.reason ?? "indisponible"}.`);
      return;
    }

    const modForce = Number(sampleCharacter.caracs?.force?.modFOR ?? 0);
    const forceDc =
      typeof interaction.forceDc === "number" ? interaction.forceDc : null;
    const needsCheck = interaction.kind === "break" && forceDc !== null;

    if (needsCheck) {
      const result = rollAttack(modForce, "normal");
      const total = result.total;
      const base = result.d20.total;
      const outcome = total >= forceDc ? "reussi" : "rate";
      pushLog(
        `Test de force (${interaction.label}) : ${base} + ${modForce} = ${total} vs DD ${forceDc} -> ${outcome}.`
      );
      if (total < forceDc) {
        applyInteractionCost(interaction.cost);
        return;
      }
    }

    if (target.kind === "wall") {
      setWallSegments(prev => {
        const idx = prev.findIndex(w => w.id === target.segmentId);
        if (idx === -1) return prev;
        const copy = [...prev];
        const segment = { ...copy[idx] };
        const def = segment.typeId ? wallTypeById.get(segment.typeId) ?? null : null;

        if (interaction.kind === "open") {
          if (segment.kind === "door" && segment.state !== "open") {
            segment.state = "open";
            copy[idx] = segment;
          }
        } else if (interaction.kind === "break") {
          if (segment.kind === "door" && segment.state !== "open" && isWallDestructible(def)) {
            const maxHp =
              typeof segment.maxHp === "number"
                ? segment.maxHp
                : typeof segment.hp === "number"
                  ? segment.hp
                  : null;
            if (maxHp !== null) {
              const fraction =
                typeof interaction.damageFraction === "number"
                  ? interaction.damageFraction
                  : 0.5;
              const damage = Math.max(0, Math.round(maxHp * fraction));
              const beforeHp = typeof segment.hp === "number" ? segment.hp : maxHp;
              segment.hp = Math.max(0, beforeHp - damage);
              segment.maxHp = maxHp;
            }
            segment.state = "open";
            copy[idx] = segment;
          }
        }

        return copy.filter(w => w.hp === undefined || w.hp > 0);
      });
    } else if (target.kind === "obstacle") {
      setObstacles(prev => {
        const idx = prev.findIndex(o => o.id === target.obstacleId);
        if (idx === -1) return prev;
        const copy = [...prev];
        const obstacle = { ...copy[idx] };
        if (interaction.kind === "break" && obstacle.hp > 0) {
          const fraction =
            typeof interaction.damageFraction === "number"
              ? interaction.damageFraction
              : 0.5;
          const maxHp =
            typeof obstacle.maxHp === "number" ? obstacle.maxHp : obstacle.hp;
          const damage = Math.max(0, Math.round(maxHp * fraction));
          obstacle.hp = Math.max(0, obstacle.hp - damage);
          copy[idx] = obstacle;
        }
        return copy.filter(o => o.hp > 0);
      });
    }

    applyInteractionCost(interaction.cost);
    pushLog(`Interaction ${interaction.label} executee.`);
  }

  function handleInteractFromWheel() {
    if (!canInteractWithBoard) return;
    if (!hasAnyInteractionSource) {
      pushLog("Interagir: aucune interaction possible.");
      return;
    }
    setTargetMode("none");
    setInteractionMode("interact-select");
    setInteractionMenuItems([]);
    pushLog("Interagir: cliquez sur un element pour afficher ses interactions.");
  }

  function handleHideFromWheel() {
    pushLog("Se cacher: (a integrer).");
  }

  const dockTabs = [
    {
      id: "combat",
      label: "Combat",
      content: (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 340px", minWidth: 340 }}>
            <CombatStatusPanel
              round={round}
              phase={phase}
              playerInitiative={playerInitiative}
              player={player}
              selectedPath={selectedPath}
              sampleCharacter={sampleCharacter}
              aiLastState={aiLastState}
              aiLastIntents={aiLastIntents}
              aiUsedFallback={aiUsedFallback}
              aiLastError={aiLastError}
            />
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 340 }}>
            <EnemiesPanel
              enemies={enemies}
              player={player}
              revealedEnemyIds={revealedEnemyIds}
              capabilities={ENEMY_CAPABILITIES}
              validatedAction={validatedAction}
              selectedTargetId={selectedTargetId}
              describeEnemyLastDecision={describeEnemyLastDecision}
              validateEnemyTargetForAction={validateEnemyTargetForAction}
              onSelectTargetId={enemyId => {
                setSelectedTargetId(enemyId);
                setSelectedObstacleTarget(null);
                setSelectedWallTarget(null);
              }}
              onSetTargetMode={setTargetMode}
              onLog={pushLog}
            />
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 340 }}>
            <ActionsPanel
              actions={actions}
              selectedAction={selectedAction}
              selectedAvailability={selectedAvailability}
              computeActionAvailability={computeActionAvailability}
              onSelectActionId={setSelectedActionId}
              describeRange={describeRange}
              describeUsage={describeUsage}
              conditionLabel={conditionLabel}
              effectLabel={effectLabel}
              onPreviewActionArea={previewActionArea}
              onValidateAction={handleUseAction}
            />
          </div>
          {showDicePanel && (
            <div style={{ flex: "1 1 340px", minWidth: 340 }}>
              <DicePanel
                validatedAction={validatedAction}
                advantageMode={advantageMode}
                onSetAdvantageMode={setAdvantageMode}
                onRollAttack={handleRollAttack}
                onRollDamage={handleRollDamage}
                onAutoResolve={handleAutoResolveRolls}
                attackRoll={attackRoll}
                damageRoll={damageRoll}
                diceLogs={diceLogs}
              />
            </div>
          )}
        </div>
      )
    },
    {
      id: "effects",
      label: "Effets",
      content: (
        <div style={{ maxWidth: 520 }}>
          <EffectsPanel
            showVisionDebug={showVisionDebug}
            showLightOverlay={showLightOverlay}
            showCellIds={showCellIds}
            showAllLevels={showAllLevels}
            visionLegend={visionLegend}
            onShowCircle={handleShowCircleEffect}
            onShowRectangle={handleShowRectangleEffect}
            onShowCone={handleShowConeEffect}
            onToggleVisionDebug={() => setShowVisionDebug(prev => !prev)}
            onToggleLightOverlay={() => setShowLightOverlay(prev => !prev)}
            onToggleCellIds={() => setShowCellIds(prev => !prev)}
            onToggleShowAllLevels={() => setShowAllLevels(prev => !prev)}
            onClear={handleClearEffects}
          />
        </div>
      )
    },
    { id: "logs", label: "Logs", content: <LogPanel log={log} /> }
  ];

  const interactionAvailability = interactionContext
    ? getInteractionAvailability(interactionContext.interaction, interactionContext.target)
    : null;
  const forceMod = Number(sampleCharacter.caracs?.force?.modFOR ?? 0);
  const interactionState =
    interactionMode === "interact-select"
      ? interactionMenuItems.length > 0
        ? "menu"
        : "select"
      : "idle";

  return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          height: "100vh",
          overflow: "hidden",
          background: "#0b0b12",
          color: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
          padding: "16px",
          boxSizing: "border-box",
          position: "relative"
        }}
      >
        {isGameOver && (
          <GameOverOverlay onRestart={() => window.location.reload()} />
        )}
        {showCellIds && obstacleLegend.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 50,
              background: "rgba(10,10,16,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              padding: "10px 12px",
              maxWidth: 260,
              maxHeight: "40vh",
              overflowY: "auto",
              fontSize: 12,
              lineHeight: 1.4
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Legende obstacles</div>
            {obstacleLegend.map(item => (
              <div key={item.id}>
                {item.label} ({item.id}) [{item.orientation}]
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "flex-start",
            gap: 10,
            minHeight: 0,
            overflow: "hidden"
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              padding: "10px 12px",
              borderRadius: 14,
              background: "rgba(12,12,18,0.88)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 18px 60px rgba(0,0,0,0.35)"
            }}
          >
            <InitiativePanel
              round={round}
              timelineEntries={timelineEntries}
              activeEntry={activeEntry}
              player={player}
              enemies={enemies}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "0 4px"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.4 }}>
                Mini Donjon
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
                Clic gauche: roue d&apos;actions ??? Deplacer: clics successifs (max 5)
              </span>
            </div>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              {phase === "player" ? "Tour joueur" : "Tour ennemis"}
            </span>
          </div>
          <div
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              borderRadius: 18,
              padding: 10,
              background:
                "radial-gradient(1200px 500px at 40% 0%, rgba(120,90,40,0.20), rgba(12,12,18,0.92))",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 25px 90px rgba(0,0,0,0.55)",
              overflow: "visible"
            }}
          >
            <div
              ref={pixiContainerRef}
              onClick={handleBoardClick}
              onContextMenu={event => {
                event.preventDefault();
              }}
              onMouseDown={event => {
                if (event.button !== 2) return; // right click
                event.preventDefault();
                event.stopPropagation();
                setIsPanningBoard(true);
                panDragRef.current = { x: event.clientX, y: event.clientY };
              }}
              onMouseMove={event => {
                if (!isPanningBoard) return;
                const start = panDragRef.current;
                if (!start) return;
                const dx = event.clientX - start.x;
                const dy = event.clientY - start.y;
                if (dx === 0 && dy === 0) return;
                panDragRef.current = { x: event.clientX, y: event.clientY };
                setBoardPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
              }}
              onMouseUp={event => {
                if (event.button !== 2) return;
                setIsPanningBoard(false);
                panDragRef.current = null;
              }}
              onMouseLeave={() => {
                setIsPanningBoard(false);
                panDragRef.current = null;
              }}
              style={{
                width: "100%",
                height: "100%",
                minHeight: 0,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: colorToCssHex(boardBackgroundColor),
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "visible"
                ,
                cursor: isPanningBoard ? "grabbing" : "default"
              }}
            >
              <div
                onMouseDown={event => event.stopPropagation()}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  zIndex: 45,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: 8,
                  borderRadius: 12,
                  background: "rgba(10, 10, 16, 0.72)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  backdropFilter: "blur(6px)",
                  boxShadow: "0 14px 40px rgba(0,0,0,0.35)"
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setBoardZoom(z => clamp(Math.round((z + ZOOM_STEP) * 10) / 10, ZOOM_MIN, ZOOM_MAX))
                  }
                  disabled={boardZoom >= ZOOM_MAX - 1e-6}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: boardZoom >= ZOOM_MAX - 1e-6 ? "rgba(80,80,90,0.55)" : "rgba(255,255,255,0.08)",
                    color: "#fff",
                    cursor: boardZoom >= ZOOM_MAX - 1e-6 ? "default" : "pointer",
                    fontSize: 18,
                    fontWeight: 800,
                    lineHeight: 1
                  }}
                  title="Zoom +"
                >
                  +
                </button>
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.75)",
                    fontWeight: 700
                  }}
                  title="Niveau de zoom"
                >
                  {Math.round(boardZoom * 100)}%
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBoardZoom(z => clamp(Math.round((z - ZOOM_STEP) * 10) / 10, ZOOM_MIN, ZOOM_MAX))
                  }
                  disabled={boardZoom <= ZOOM_MIN + 1e-6}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: boardZoom <= ZOOM_MIN + 1e-6 ? "rgba(80,80,90,0.55)" : "rgba(255,255,255,0.08)",
                    color: "#fff",
                    cursor: boardZoom <= ZOOM_MIN + 1e-6 ? "default" : "pointer",
                    fontSize: 22,
                    fontWeight: 800,
                    lineHeight: 1
                  }}
                  title="Zoom -"
                >
                  ???
                </button>
                <button
                  type="button"
                  onClick={() => setBoardZoom(DEFAULT_ZOOM)}
                  disabled={Math.abs(boardZoom - DEFAULT_ZOOM) < 1e-6}
                  style={{
                    marginTop: 4,
                    width: 34,
                    height: 28,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: Math.abs(boardZoom - DEFAULT_ZOOM) < 1e-6 ? "rgba(80,80,90,0.55)" : "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.85)",
                    cursor: Math.abs(boardZoom - DEFAULT_ZOOM) < 1e-6 ? "default" : "pointer",
                    fontSize: 11,
                    fontWeight: 800
                  }}
                  title="Reset zoom"
                >
                  1??
                </button>
              </div>

              <ActionWheelMenu
                open={Boolean(radialMenu?.open)}
                anchorX={radialMenu?.anchorX ?? 0}
                anchorY={radialMenu?.anchorY ?? 0}
                size={240}
                canInteractWithBoard={canInteractWithBoard}
                hasCell={Boolean(radialMenu?.cell)}
                selectedPathLength={selectedPath.length}
                isResolvingEnemies={isResolvingEnemies}
                actions={actions}
                movementModes={movementModes}
                activeMovementModeId={activeMovementModeId}
                isMoving={interactionMode === "moving"}
                interactionState={interactionState}
                interactionItems={interactionMenuItems}
                movementCostUsed={selectedPathCost}
                movementCostMax={pathLimit}
                interactionPrompt="Selectionner la cible de l'interaction"
                onCancelInteract={handleCancelInteractFromWheel}
                computeActionAvailability={computeActionAvailability}
                onClose={closeRadialMenu}
                onSelectMoveMode={handleSelectMovementMode}
                onCancelMove={handleCancelMoveFromWheel}
                onNoMovementModes={() => pushLog("Deplacement: aucun mode disponible.")}
                onNoActions={() => pushLog("Action: aucune action disponible.")}
                onValidateMove={handleValidatePath}
                onInspectCell={handleEnterInspectModeFromWheel}
                onLook={handleEnterLookModeFromWheel}
                onInteract={handleInteractFromWheel}
                onHide={handleHideFromWheel}
                onEndTurn={() => {
                  handleEndPlayerTurn();
                }}
                onPickAction={openActionContextFromWheel}
              />
              <ActionContextWindow
                open={Boolean(actionContext)}
                anchorX={actionContext?.anchorX ?? 0}
                anchorY={actionContext?.anchorY ?? 0}
                stage={actionContext?.stage ?? "draft"}
                action={contextAction}
                availability={contextAvailability}
                player={player}
                enemies={enemies}
                validatedAction={validatedAction}
                targetMode={targetMode}
                selectedTargetId={selectedTargetId}
                selectedTargetLabel={getSelectedTargetLabel()}
                onSelectTargetId={enemyId => {
                  setSelectedTargetId(enemyId);
                  setSelectedObstacleTarget(null);
                  setSelectedWallTarget(null);
                }}
                onSetTargetMode={setTargetMode}
                advantageMode={advantageMode}
                onSetAdvantageMode={setAdvantageMode}
                onRollAttack={handleRollAttack}
                onRollDamage={handleRollDamage}
                onAutoResolve={handleAutoResolveRolls}
                attackRoll={attackRoll}
                damageRoll={damageRoll}
                diceLogs={diceLogs}
                onValidateAction={handleValidateActionFromContext}
                onClose={closeActionContext}
              />
              <InteractionContextWindow
                open={Boolean(interactionContext)}
                anchorX={interactionContext?.anchorX ?? 0}
                anchorY={interactionContext?.anchorY ?? 0}
                interaction={interactionContext?.interaction ?? null}
                availability={interactionAvailability}
                forceMod={forceMod}
                onExecute={() => {
                  if (!interactionContext) return;
                  handleExecuteInteraction(
                    interactionContext.interaction,
                    interactionContext.target
                  );
                }}
                onClose={closeInteractionContext}
              />

            </div>
          </div>

          <NarrationPanel round={round} narrativeLog={narrativeLog} />
        </div>

      <BottomDock
        tabs={dockTabs}
        defaultTabId="combat"
        collapsible={true}
        collapsedByDefault={true}
        collapsedHeight={52}
        expandedHeight={320}
      />
    </div>
  );
};












