import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sampleCharacter } from "./sampleCharacter";
import type {
  CombatStats,
  EnemyCombatProfile,
  EnemyCombatStyle,
  MovementProfile,
  Personnage,
  TokenState,
  VisionProfile
} from "./types";
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
import { loadEffectTypesFromIndex } from "./game/effectCatalog";
import { loadStatusTypesFromIndex } from "./game/statusCatalog";
import { loadFeatureTypesFromIndex } from "./game/featureCatalog";
import { loadWallTypesFromIndex } from "./game/wallCatalog";
import { loadReactionTypesFromIndex } from "./game/reactionCatalog";
import { loadWeaponTypesFromIndex } from "./PlayerCharacterCreator/catalogs/weaponCatalog";
import { loadRaceTypesFromIndex } from "./PlayerCharacterCreator/catalogs/raceCatalog";
import {
  loadClassTypesFromIndex,
  loadSubclassTypesFromIndex
} from "./PlayerCharacterCreator/catalogs/classCatalog";
import { loadBackgroundTypesFromIndex } from "./PlayerCharacterCreator/catalogs/backgroundCatalog";
import { loadLanguageTypesFromIndex } from "./PlayerCharacterCreator/catalogs/languageCatalog";
import { loadToolItemsFromIndex } from "./PlayerCharacterCreator/catalogs/toolCatalog";
import { loadObjectItemsFromIndex } from "./PlayerCharacterCreator/catalogs/objectCatalog";
import { loadArmorItemsFromIndex } from "./PlayerCharacterCreator/catalogs/armorCatalog";
import type { ObstacleInstance, ObstacleTypeDefinition } from "./game/obstacleTypes";
import type { EffectInstance, EffectTypeDefinition } from "./game/effectTypes";
import type { StatusDefinition } from "./game/statusTypes";
import type { FeatureDefinition } from "./game/featureTypes";
import type { WallTypeDefinition } from "./game/wallTypes";
import type { ReactionDefinition } from "./game/reactionTypes";
import type { WeaponTypeDefinition } from "./game/weaponTypes";
import type { RaceDefinition } from "./game/raceTypes";
import type { ClassDefinition, SubclassDefinition } from "./game/classTypes";
import type { BackgroundDefinition } from "./game/backgroundTypes";
import type { LanguageDefinition } from "./game/languageTypes";
import type { ToolItemDefinition } from "./game/toolTypes";
import type { ObjectItemDefinition } from "./game/objectTypes";
import type { ArmorItemDefinition } from "./game/armorTypes";
import { generateBattleMap } from "./game/mapEngine";
import { getHeightAtGrid, type TerrainCell } from "./game/map/draft";
import { buildTerrainMixLayer } from "./game/map/terrainMix";
import { FLOOR_MATERIALS, getFloorMaterial } from "./game/map/floors/catalog";
import type { FloorMaterial } from "./game/map/floors/types";
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
import meleeStrike from "../action-game/actions/catalog/combat/melee-strike.json";
import throwDagger from "../action-game/actions/catalog/combat/throw-dagger.json";
import bowShot from "../action-game/actions/catalog/combat/bow-shot.json";
import dashAction from "../action-game/actions/catalog/movement/dash.json";
import moveAction from "../action-game/actions/catalog/movement/move.json";
import secondWind from "../action-game/actions/catalog/support/second-wind.json";
import torchToggle from "../action-game/actions/catalog/items/torch-toggle.json";
import moveTypesIndex from "../action-game/move-types/index.json";
import walkMoveType from "../action-game/move-types/catalog/movement/walk.json";
import sprintMoveType from "../action-game/move-types/catalog/movement/sprint.json";
import {
  rollAttack,
  rollDamage,
  rollDie,
  type AttackRollResult,
  type DamageRollResult,
  type AdvantageMode
} from "./dice/roller";
import {
  computeAvailabilityForActor,
  resolveAction,
  validateActionTarget,
  type ActionTarget
} from "./game/actionEngine";
import { buildActionPlan, type ActionPlan } from "./game/actionPlan";
import {
  GRID_COLS,
  GRID_ROWS,
  getBoardHeight,
  getBoardWidth,
  gridToScreenForGrid,
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
import {
  applyInteraction,
  getInteractionAvailability,
  type InteractionTarget
} from "./game/interactionHandlers";
import {
  usePixiBoard,
  usePixiDecorations,
  usePixiEffects,
  usePixiGridLabels,
  usePixiNaturalTiling,
  usePixiObstacles,
  usePixiOverlays,
  usePixiSpeechBubbles,
  usePixiTerrainFx,
  usePixiTokens,
  usePixiWalls,
  type LightSource
} from "./render2d";
import { CombatSetupScreen } from "./PlayerCharacterCreator/CombatSetupScreen";
import { GameOverOverlay } from "./ui/GameOverOverlay";
import { InitiativePanel } from "./ui/InitiativePanel";
import { EffectsPanel } from "./ui/EffectsPanel";
import { LogPanel } from "./ui/LogPanel";
import { NarrationPanel, type NarrationEntry } from "./ui/NarrationPanel";
import { ActionWheelMenu } from "./ui/ActionWheelMenu";
import type { WheelMenuItem } from "./ui/RadialWheelMenu";
import { ActionContextWindow } from "./ui/ActionContextWindow";
import { CharacterSheetWindow } from "./ui/CharacterSheetWindow";
import { InteractionContextWindow } from "./ui/InteractionContextWindow";
import { boardThemeColor, colorToCssHex } from "./boardTheme";
import type { InteractionCost, InteractionSpec } from "./game/interactions";
import {
  buildMovementProfileFromMode,
  getDefaultMovementMode,
  getMovementModesForCharacter,
  type MovementModeDefinition
} from "./game/movementModes";
import { type MoveTypeDefinition, isMoveTypeAction } from "./game/moveTypes";
import {
  getEffectAnimationKeys,
  getObstacleAnimationFrames,
  preloadObstaclePngTexturesFor
} from "./obstacleTextureHelper";
import { preloadTokenPngTexturesFor, type TokenSpriteRequest } from "./tokenTextureHelper";
import { preloadDecorTexturesFor } from "./svgDecorHelper";

const ACTION_MODULES: Record<string, ActionDefinition> = {
  "./catalog/combat/melee-strike.json": meleeStrike as ActionDefinition,
  "./catalog/combat/throw-dagger.json": throwDagger as ActionDefinition,
  "./catalog/combat/bow-shot.json": bowShot as ActionDefinition,
  "./catalog/movement/dash.json": dashAction as ActionDefinition,
  "./catalog/movement/move.json": moveAction as ActionDefinition,
  "./catalog/support/second-wind.json": secondWind as ActionDefinition,
  "./catalog/items/torch-toggle.json": torchToggle as ActionDefinition
};

const MOVE_TYPE_MODULES: Record<string, MoveTypeDefinition> = {
  "./catalog/movement/walk.json": walkMoveType as MoveTypeDefinition,
  "./catalog/movement/sprint.json": sprintMoveType as MoveTypeDefinition
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

function getEquippedWeaponIds(character: Personnage | null | undefined): string[] {
  const inventory = Array.isArray((character as any)?.inventoryItems)
    ? ((character as any).inventoryItems as Array<any>)
    : [];
  const carriedSlots = new Set(["ceinture_gauche", "ceinture_droite", "dos_gauche", "dos_droit"]);
  const equippedWeaponIds = inventory
    .filter(
      item =>
        item?.type === "weapon" &&
        item?.equippedSlot &&
        carriedSlots.has(item.equippedSlot)
    )
    .map(item => item.id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const primary = inventory.find(
    item =>
      item?.type === "weapon" &&
      item?.isPrimaryWeapon &&
      item?.equippedSlot &&
      carriedSlots.has(item.equippedSlot)
  );
  if (primary?.id) {
    return Array.from(new Set([primary.id, ...equippedWeaponIds]));
  }
  if (equippedWeaponIds.length > 0) {
    return Array.from(new Set(equippedWeaponIds));
  }
  const slots = character?.armesDefaut as
    | { main_droite?: string | null; main_gauche?: string | null; mains?: string | null }
    | null
    | undefined;
  if (!slots) return [];
  const ids = [slots.main_droite, slots.main_gauche, slots.mains].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  return Array.from(new Set(ids));
}

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

const ABILITY_CARAC_KEY: Record<AbilityKey, keyof Personnage["caracs"]> = {
  str: "force",
  dex: "dexterite",
  con: "constitution",
  int: "intelligence",
  wis: "sagesse",
  cha: "charisme"
};

const ABILITY_SCORE_KEY: Record<AbilityKey, string> = {
  str: "FOR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "SAG",
  cha: "CHA"
};

function computeAbilityModFromScore(score?: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.floor((Number(score) - 10) / 2);
}

function getCharacterAbilityMod(character: Personnage, ability: AbilityKey): number {
  const statMod = character.combatStats?.mods?.[ability];
  if (typeof statMod === "number" && Number.isFinite(statMod)) {
    return statMod;
  }
  const caracKey = ABILITY_CARAC_KEY[ability];
  const scoreKey = ABILITY_SCORE_KEY[ability];
  const score = (character.caracs?.[caracKey] as any)?.[scoreKey];
  return computeAbilityModFromScore(score);
}

function buildCombatStatsFromCharacter(
  character: Personnage,
  armorItemsById: Map<string, ArmorItemDefinition>
): CombatStats {
  const movementModes = getMovementModesForCharacter(character);
  const defaultSpeed = movementModes[0]?.speed ?? 3;
  const level = Number(character.combatStats?.level ?? character.niveauGlobal ?? 1) || 1;
  const mods = {
    str: getCharacterAbilityMod(character, "str"),
    dex: getCharacterAbilityMod(character, "dex"),
    con: getCharacterAbilityMod(character, "con"),
    int: getCharacterAbilityMod(character, "int"),
    wis: getCharacterAbilityMod(character, "wis"),
    cha: getCharacterAbilityMod(character, "cha")
  };
  const maxHp = Number(character.combatStats?.maxHp ?? character.pvActuels ?? 1) || 1;
  const armorClass = computeArmorClassFromEquipment(character, armorItemsById, mods.dex);

  return {
    level,
    mods,
    maxHp,
    armorClass,
    attackBonus: mods.str + 2,
    attackDamage: Math.max(1, mods.str + 3),
    attackRange: 1,
    moveRange: defaultSpeed,
    maxAttacksPerTurn: 1,
    resources: {}
  };
}

function computeArmorClassFromEquipment(
  character: Personnage,
  armorItemsById: Map<string, ArmorItemDefinition>,
  dexMod: number
): number {
  const inventory = Array.isArray((character as any)?.inventoryItems)
    ? ((character as any).inventoryItems as Array<any>)
    : [];
  const equippedArmor = inventory.filter(
    item => item?.type === "armor" && item?.equippedSlot
  );
  const base = 10 + dexMod;
  let armorBase = base;
  let shieldBonus = 0;

  for (const item of equippedArmor) {
    const def = armorItemsById.get(item.id);
    if (!def) continue;
    if (def.armorCategory === "shield") {
      shieldBonus = Math.max(shieldBonus, def.baseAC ?? 2);
      continue;
    }
    const baseAC = typeof def.baseAC === "number" ? def.baseAC : 10;
    const dexCap =
      def.dexCap === null || typeof def.dexCap === "undefined"
        ? dexMod
        : Math.max(0, Math.min(dexMod, def.dexCap));
    armorBase = Math.max(armorBase, baseAC + dexCap);
  }

  return Math.max(1, armorBase + shieldBonus);
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

function scaleDiceFormula(formula: string, multiplier: number): string | null {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
  const cleaned = formula.replace(/\s+/g, "");
  const tokens = cleaned.split(/(?=[+-])/);
  const out: string[] = [];
  for (const raw of tokens) {
    if (!raw) continue;
    const sign = raw.startsWith("-") ? "-" : "";
    const token = raw.replace(/^[+-]/, "");
    const diceMatch = token.match(/^(\d*)d(\d+)$/i);
    if (diceMatch) {
      const count = diceMatch[1] ? Number.parseInt(diceMatch[1], 10) : 1;
      if (!Number.isFinite(count)) return null;
      out.push(`${sign}${count * multiplier}d${diceMatch[2]}`);
      continue;
    }
    if (!Number.isNaN(Number.parseInt(token, 10))) {
      out.push(`${sign}${token}`);
      continue;
    }
    return null;
  }
  return out.join("");
}

function resolveEnemyMovementSpeed(enemyType: EnemyTypeDefinition): number {
  const modes = enemyType.movementModes;
  if (modes && typeof modes === "object") {
    if (typeof modes.walk === "number" && Number.isFinite(modes.walk)) {
      return Math.max(1, modes.walk);
    }
    const first = Object.values(modes).find(value => Number.isFinite(value));
    if (typeof first === "number") return Math.max(1, first);
  }
  if (typeof enemyType.movement?.speed === "number") {
    return Math.max(1, enemyType.movement.speed);
  }
  if (typeof enemyType.combatStats?.moveRange === "number") {
    return Math.max(1, enemyType.combatStats.moveRange);
  }
  return 3;
}

function resolveEnemyMovementProfile(
  enemyType: EnemyTypeDefinition,
  speed: number
): MovementProfile {
  if (enemyType.movement) {
    return { ...enemyType.movement, speed };
  }
  return {
    type: "ground",
    speed,
    canPassThroughWalls: false,
    canPassThroughEntities: false,
    canStopOnOccupiedTile: false
  };
}

  function createEnemy(
    index: number,
    enemyType: EnemyTypeDefinition,
    position: { x: number; y: number }
  ): TokenState {
  const { x, y } = position;
  const speed = resolveEnemyMovementSpeed(enemyType);
  const base: CombatStats = {
    ...enemyType.combatStats,
    moveRange: speed
  };
  const movementProfile = resolveEnemyMovementProfile(enemyType, speed);
  return {
    id: `enemy-${index + 1}`,
    type: "enemy",
    enemyTypeId: enemyType.id,
    enemyTypeLabel: enemyType.label,
    aiRole: enemyType.aiRole,
      actionIds: Array.isArray((enemyType as any).actions)
        ? ((enemyType as any).actions as string[])
        : null,
      reactionIds: Array.isArray((enemyType as any).reactionIds)
        ? ((enemyType as any).reactionIds as string[])
        : null,
      appearance: enemyType.appearance,
      speechProfile: enemyType.speechProfile ?? null,
    combatStats: base,
      moveRange: base.moveRange,
    attackDamage: base.attackDamage,
    attackRange: typeof base.attackRange === "number" ? base.attackRange : 1,
    maxAttacksPerTurn:
      typeof base.maxAttacksPerTurn === "number" ? base.maxAttacksPerTurn : 1,
    armorClass: base.armorClass,
    movementProfile,
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
    hp: base.maxHp,
    maxHp: base.maxHp
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
  const narrationOpenRef = useRef<boolean>(false);
  const narrationIdRef = useRef<number>(1);
  const playerBubbleTimeoutRef = useRef<number | null>(null);
  const playerThoughtRef = useRef<string | null>(null);
  const playerBubbleOverrideRef = useRef<boolean>(false);
  const [characterConfig, setCharacterConfig] = useState<Personnage>(() =>
    JSON.parse(JSON.stringify(sampleCharacter))
  );
  const movementModes = useMemo(
    () => getMovementModesForCharacter(characterConfig),
    [characterConfig]
  );
  const defaultMovementMode = movementModes[0] ?? getDefaultMovementMode();
  const defaultMovementProfile = useMemo(
    () => buildMovementProfileFromMode(defaultMovementMode),
    [defaultMovementMode]
  );
  const [armorItems, setArmorItems] = useState<ArmorItemDefinition[]>([]);
  const armorItemsById = useMemo(() => {
    const map = new Map<string, ArmorItemDefinition>();
    for (const item of armorItems) {
      if (!item?.id) continue;
      map.set(item.id, item);
    }
    return map;
  }, [armorItems]);
  const baseCombatStats: CombatStats = useMemo(
    () => {
      const built = buildCombatStatsFromCharacter(characterConfig, armorItemsById);
      if (!characterConfig.combatStats) return built;
      return {
        ...built,
        ...characterConfig.combatStats,
        armorClass: built.armorClass
      };
    },
    [characterConfig, armorItemsById]
  );
  const playerCombatStats: CombatStats = useMemo(
    () => ({
      ...baseCombatStats,
      moveRange: defaultMovementProfile.speed,
      maxHp: baseCombatStats.maxHp,
      actionsPerTurn: baseCombatStats.actionsPerTurn ?? 1,
      bonusActionsPerTurn: baseCombatStats.bonusActionsPerTurn ?? 1,
      actionRules: baseCombatStats.actionRules ?? { forbidSecondAttack: true }
    }),
    [baseCombatStats, defaultMovementProfile.speed]
  );
  const defaultPlayerVisionProfile: VisionProfile = useMemo(
    () =>
      characterConfig.visionProfile ?? {
        shape: "cone",
        range: 100,
        apertureDeg: 180,
        lightVision: "normal"
      },
    [characterConfig]
  );

  const [log, setLog] = useState<string[]>([]);
  const [narrationEntries, setNarrationEntries] = useState<NarrationEntry[]>([]);
  const [narrationUnread, setNarrationUnread] = useState<number>(0);
  const [isNarrationOpen, setIsNarrationOpen] = useState<boolean>(false);
  const [speechBubbles, setSpeechBubbles] = useState<SpeechBubbleEntry[]>([]);

  const [player, setPlayer] = useState<TokenState>({
    id: "player-1",
    type: "player",
    appearance: characterConfig.appearance,
    actionIds: Array.isArray(characterConfig.actionIds)
      ? characterConfig.actionIds
      : [],
    reactionIds: Array.isArray(characterConfig.reactionIds)
      ? characterConfig.reactionIds
      : [],
    x: 0,
    y: Math.floor(GRID_ROWS / 2),
    facing: "right",
    movementProfile: defaultMovementProfile,
    moveRange: playerCombatStats.moveRange,
    visionProfile: defaultPlayerVisionProfile,
    combatStats: playerCombatStats,
    attackDamage: playerCombatStats.attackDamage,
    attackRange: playerCombatStats.attackRange,
    maxAttacksPerTurn: playerCombatStats.maxAttacksPerTurn,
    hp: characterConfig.pvActuels,
    maxHp: playerCombatStats.maxHp
  });

  const [enemyTypes, setEnemyTypes] = useState<EnemyTypeDefinition[]>([]);
  const [enemies, setEnemies] = useState<TokenState[]>([]);
  const [obstacleTypes, setObstacleTypes] = useState<ObstacleTypeDefinition[]>([]);
  const [obstacles, setObstacles] = useState<ObstacleInstance[]>([]);
  const [effectTypes, setEffectTypes] = useState<EffectTypeDefinition[]>([]);
  const [effects, setEffects] = useState<EffectInstance[]>([]);
  const [actionEffects, setActionEffects] = useState<Array<EffectInstance & { expiresAt: number }>>([]);
  const [statusTypes, setStatusTypes] = useState<StatusDefinition[]>([]);
  const [featureTypes, setFeatureTypes] = useState<FeatureDefinition[]>([]);
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
  const [turnTick, setTurnTick] = useState<number>(0);
  const [isCombatConfigured, setIsCombatConfigured] = useState<boolean>(false);
  const [configEnemyCount, setConfigEnemyCount] = useState<number>(3);
  const [mapPrompt, setMapPrompt] = useState<string>("");

  useEffect(() => {
    if (isCombatConfigured) return;
    setPlayer(prev => ({
      ...prev,
      appearance: characterConfig.appearance,
      actionIds: Array.isArray(characterConfig.actionIds)
        ? characterConfig.actionIds
        : [],
      reactionIds: Array.isArray(characterConfig.reactionIds)
        ? characterConfig.reactionIds
        : [],
      movementProfile: defaultMovementProfile,
      moveRange: playerCombatStats.moveRange,
      visionProfile: defaultPlayerVisionProfile,
      combatStats: playerCombatStats,
      attackDamage: playerCombatStats.attackDamage,
      attackRange: playerCombatStats.attackRange,
      maxAttacksPerTurn: playerCombatStats.maxAttacksPerTurn,
      hp: characterConfig.pvActuels,
      maxHp: playerCombatStats.maxHp
    }));
  }, [
    characterConfig,
    defaultMovementProfile,
    defaultPlayerVisionProfile,
    playerCombatStats,
    isCombatConfigured
  ]);

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 0.1;
  const DEFAULT_ZOOM = 1.5;
  const [boardZoom, setBoardZoom] = useState<number>(DEFAULT_ZOOM);
  const [boardPan, setBoardPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningBoard, setIsPanningBoard] = useState<boolean>(false);
  const panDragRef = useRef<{ x: number; y: number } | null>(null);
  const BOARD_FPS_IDLE = 8;
  const BOARD_FPS_ACTIVE = 20;
  const [renderTick, setRenderTick] = useState<number>(0);

  const boardBackgroundColor = boardThemeColor(mapTheme);

  // Actions loaded from JSON
  const [actionsCatalog, setActionsCatalog] = useState<ActionDefinition[]>([]);
  // Player actions loaded from JSON (filtered by actionIds)
  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [moveTypes, setMoveTypes] = useState<MoveTypeDefinition[]>([]);
  const [weaponTypes, setWeaponTypes] = useState<WeaponTypeDefinition[]>([]);
  const [raceTypes, setRaceTypes] = useState<RaceDefinition[]>([]);
  const [classTypes, setClassTypes] = useState<ClassDefinition[]>([]);
  const [subclassTypes, setSubclassTypes] = useState<SubclassDefinition[]>([]);
  const [backgroundTypes, setBackgroundTypes] = useState<BackgroundDefinition[]>([]);
  const [languageTypes, setLanguageTypes] = useState<LanguageDefinition[]>([]);
  const [toolItems, setToolItems] = useState<ToolItemDefinition[]>([]);
  const [objectItems, setObjectItems] = useState<ObjectItemDefinition[]>([]);
  const [reactionCatalog, setReactionCatalog] = useState<ReactionDefinition[]>([]);
  const [reactionQueue, setReactionQueue] = useState<ReactionInstance[]>([]);
  const [reactionUsage, setReactionUsage] = useState<Record<string, number>>({});
  const [reactionCombatUsage, setReactionCombatUsage] = useState<Record<string, number>>({});
  const [killerInstinctTargetId, setKillerInstinctTargetId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [validatedActionId, setValidatedActionId] = useState<string | null>(null);
  const [advantageMode, setAdvantageMode] =
    useState<AdvantageMode>("normal");
  const [attackRoll, setAttackRoll] = useState<AttackRollResult | null>(null);
  const [damageRoll, setDamageRoll] = useState<DamageRollResult | null>(null);
  const [attackOutcome, setAttackOutcome] =
    useState<"hit" | "miss" | null>(null);
  const [diceLogs, setDiceLogs] = useState<string[]>([]);
  const [pendingHazardRoll, setPendingHazardRoll] = useState<PendingHazardRoll | null>(null);
  const [hazardResolution, setHazardResolution] = useState<{
    damageTotal: number;
    diceText: string;
    statusId: string | null;
    statusTriggered: boolean;
  } | null>(null);
  const [hasRolledAttackForCurrentAction, setHasRolledAttackForCurrentAction] =
    useState<boolean>(false);
  const [turnActionUsage, setTurnActionUsage] = useState<{
    usedActionCount: number;
    usedBonusCount: number;
  }>({ usedActionCount: 0, usedBonusCount: 0 });
  const [actionUsageCounts, setActionUsageCounts] = useState<{
    turn: Record<string, number>;
    encounter: Record<string, number>;
  }>({ turn: {}, encounter: {} });
  const [actionContextOpen, setActionContextOpen] = useState<boolean>(false);
  const suppressBoardClickUntilRef = useRef<number>(0);
  const [playerResources, setPlayerResources] = useState<Record<string, number>>({
    "bandolier:dagger": 3,
    "gear:torch": 1
  });
  const [pathLimit, setPathLimit] = useState<number>(defaultMovementProfile.speed);
  const [basePathLimit, setBasePathLimit] = useState<number>(defaultMovementProfile.speed);
  const [movementSpent, setMovementSpent] = useState<number>(0);
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
  type PendingHazardRoll = {
    id: string;
    label: string;
    formula: string;
    cells: number;
    statusRoll?: { die: number; trigger: number; statusId?: string };
  };
  type ReactionInstance = {
    reactionId: string;
    reactorId: string;
    targetId: string | null;
    actionId: string;
    anchorX: number;
    anchorY: number;
  };
  type EnemyMemory = {
    lastSeenPos?: { x: number; y: number };
    lastSeenRound?: number;
    lastFailedReason?: string;
    lastFailedActionId?: string;
    lastEffectiveActionId?: string;
    lastOpportunityRound?: number;
  };
  type TeamAlert = {
    sourceId: string;
    position: { x: number; y: number };
    createdRound: number;
    expiresRound: number;
    confidence: number;
  };
  const [interactionMode, setInteractionMode] =
    useState<BoardInteractionMode>("idle");
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
    cell: { x: number; y: number } | null;
    token: TokenState | null;
  }>({
    cell: null,
    token: null
  });
  const [actionContext, setActionContext] = useState<{
    anchorX: number;
    anchorY: number;
    actionId: string;
    stage: "draft" | "active";
    source?: "action" | "reaction";
    reactionId?: string | null;
    cycleId?: number;
  } | null>(null);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [hazardAnchor, setHazardAnchor] = useState<{ anchorX: number; anchorY: number } | null>(
    null
  );

  // Area-of-effect specs attached to the player
  const [effectSpecs, setEffectSpecs] = useState<EffectSpec[]>([]);
  const [showVisionDebug, setShowVisionDebug] = useState<boolean>(false);
  const [showLightOverlay, setShowLightOverlay] = useState<boolean>(true);
  const [showFogSegments, setShowFogSegments] = useState<boolean>(false);
  const [showAllLevels, setShowAllLevels] = useState<boolean>(false);
  const [playerTorchOn, setPlayerTorchOn] = useState<boolean>(false);
  const [showCellIds, setShowCellIds] = useState<boolean>(false);
  const [showTerrainIds, setShowTerrainIds] = useState<boolean>(false);
  const [showTerrainContours, setShowTerrainContours] = useState<boolean>(false);
  const [shadowLightAngleDeg, setShadowLightAngleDeg] = useState<number>(90);
  const [bumpIntensity, setBumpIntensity] = useState<number>(0.45);
  const [windSpeed, setWindSpeed] = useState<number>(0.06);
  const [windStrength, setWindStrength] = useState<number>(1.0);
  const [bumpDebug, setBumpDebug] = useState<boolean>(false);
  const [floatingPanel, setFloatingPanel] = useState<"effects" | "logs" | null>(null);
  const textureLoadingCounterRef = useRef<number>(0);
  const [isTextureLoading, setIsTextureLoading] = useState<boolean>(false);
  const [textureLoadingHint, setTextureLoadingHint] = useState<string | null>(null);
  const actionEffectTimersRef = useRef<Map<string, number>>(new Map());
  const lastActionVfxKeyRef = useRef<string | null>(null);
  const actionCycleIdRef = useRef<number>(0);
  const contextCompleteRef = useRef<boolean>(false);
  const seenTargetsByActorRef = useRef<Map<string, Set<string>>>(new Map());
  const enemyTurnPauseRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const [hpPopups, setHpPopups] = useState<
    Array<{ id: string; x: number; y: number; text: string; color: string }>
  >([]);
  const prevPlayerHpRef = useRef<number | null>(null);
  const prevEnemyHpRef = useRef<Map<string, number>>(new Map());
  const [reactionToast, setReactionToast] = useState<{
    id: string;
    text: string;
    kind: "hit" | "miss" | "info";
  } | null>(null);
  const reactionToastTimerRef = useRef<number | null>(null);
  const enemyMemoryRef = useRef<Map<string, EnemyMemory>>(new Map());
  const teamAlertRef = useRef<TeamAlert | null>(null);
  const [combatToast, setCombatToast] = useState<{
    id: string;
    text: string;
    kind: "hit" | "heal" | "info";
  } | null>(null);
  const combatToastTimerRef = useRef<number | null>(null);
  const suppressCombatToastUntilRef = useRef<number>(0);

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

  useEffect(() => {
    return () => {
      for (const timer of actionEffectTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      actionEffectTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    narrationOpenRef.current = isNarrationOpen;
    if (isNarrationOpen) setNarrationUnread(0);
  }, [isNarrationOpen]);

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

  const reactionById = useMemo(
    () => new Map(reactionCatalog.map(reaction => [reaction.id, reaction])),
    [reactionCatalog]
  );
  const reactionActionById = useMemo(
    () => new Map(reactionCatalog.map(reaction => [reaction.action.id, reaction.action])),
    [reactionCatalog]
  );
  const actionCatalogById = useMemo(() => {
    const map = new Map<string, ActionDefinition>();
    for (const action of actionsCatalog) map.set(action.id, action);
    return map;
  }, [actionsCatalog]);
  const enemyTypeById = useMemo(() => {
    const map = new Map<string, EnemyTypeDefinition>();
    for (const t of enemyTypes) map.set(t.id, t);
    return map;
  }, [enemyTypes]);
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
  const effectTypeById = useMemo(() => {
    const map = new Map<string, EffectTypeDefinition>();
    for (const t of effectTypes) map.set(t.id, t);
    return map;
  }, [effectTypes]);
  const weaponTypeById = useMemo(() => {
    const map = new Map<string, WeaponTypeDefinition>();
    for (const t of weaponTypes) map.set(t.id, t);
    return map;
  }, [weaponTypes]);
  const weaponActionById = useMemo(() => {
    const map = new Map<string, ActionDefinition>();
    for (const weapon of weaponTypes) {
      const actionId = weapon.links?.actionId;
      if (!actionId) continue;
      const action = actionCatalogById.get(actionId);
      if (action) map.set(weapon.id, action);
    }
    return map;
  }, [weaponTypes, actionCatalogById]);
  const statusTypeById = useMemo(() => {
    const map = new Map<string, StatusDefinition>();
    for (const t of statusTypes) map.set(t.id, t);
    return map;
  }, [statusTypes]);
  const wallTypeById = useMemo(() => {
    const map = new Map<string, WallTypeDefinition>();
    for (const t of wallTypes) map.set(t.id, t);
    return map;
  }, [wallTypes]);
  const equippedWeaponIds = useMemo(() => getEquippedWeaponIds(characterConfig), [
    characterConfig
  ]);
  const equippedWeapons = useMemo(
    () =>
      equippedWeaponIds
        .map(id => weaponTypeById.get(id) ?? null)
        .filter((weapon): weapon is WeaponTypeDefinition => Boolean(weapon)),
    [equippedWeaponIds, weaponTypeById]
  );
  const floorMaterialById = useMemo(() => {
    const map = new Map<string, FloorMaterial>();
    for (const t of FLOOR_MATERIALS) map.set(t.id, t);
    return map;
  }, []);
  const hasAnimatedSprites = useMemo(() => {
    if (!isCombatConfigured) return false;
    for (const effect of effects) {
      const def = effectTypeById.get(effect.typeId);
      const key = def?.appearance?.spriteKey;
      if (key && key.startsWith("effect:")) return true;
    }
    for (const obstacle of obstacles) {
      const def = obstacleTypeById.get(obstacle.typeId) ?? null;
      const appearance = def?.appearance ?? null;
      if (appearance?.spriteKey && appearance.spriteKey.startsWith("effect:")) return true;
      for (const layer of appearance?.layers ?? []) {
        if (layer?.spriteKey && layer.spriteKey.startsWith("effect:")) return true;
      }
    }
    return false;
  }, [effectTypeById, isCombatConfigured, obstacles, obstacleTypeById, effects]);
  const isBoardIdle = useMemo(() => {
    if (!isCombatConfigured) return true;
    if (isResolvingEnemies) return false;
    if (isPanningBoard) return false;
    if (interactionMode !== "idle") return false;
    if (selectedPath.length > 0) return false;
    if (actionContext) return false;
    if (interactionContext) return false;
    if (pendingHazardRoll) return false;
    if (radialMenu.cell || radialMenu.token) return false;
    return true;
  }, [
    isCombatConfigured,
    isResolvingEnemies,
    isPanningBoard,
    interactionMode,
    selectedPath.length,
    actionContext,
    interactionContext,
    pendingHazardRoll,
    radialMenu.cell,
    radialMenu.token
  ]);
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

  const isEffectAllowedOnFloor = (
    effectDef: EffectTypeDefinition,
    floorId: string | null | undefined
  ): boolean => {
    const placement = effectDef.placement;
    if (!placement) return true;
    const material = getFloorMaterial(floorId);
    const tags = material?.tags ?? [];
    if (placement.avoidLiquid && material?.liquid) return false;
    if (placement.allowedFloors && placement.allowedFloors.length > 0) {
      if (!floorId || !placement.allowedFloors.includes(floorId)) return false;
    }
    if (placement.blockedFloors && placement.blockedFloors.length > 0) {
      if (floorId && placement.blockedFloors.includes(floorId)) return false;
    }
    if (placement.allowedFloorTags && placement.allowedFloorTags.length > 0) {
      if (!tags.some(tag => placement.allowedFloorTags?.includes(tag))) return false;
    }
    if (placement.blockedFloorTags && placement.blockedFloorTags.length > 0) {
      if (tags.some(tag => placement.blockedFloorTags?.includes(tag))) return false;
    }
    return true;
  };

  const buildEffectsFromObstacles = (params: {
    obstacles: ObstacleInstance[];
    terrain: TerrainCell[];
    grid: { cols: number; rows: number };
  }): EffectInstance[] => {
    const results: EffectInstance[] = [];
    const { obstacles, terrain, grid } = params;

    for (const obstacle of obstacles) {
      const def = obstacleTypeById.get(obstacle.typeId) ?? null;
      if (!def) continue;

        const effectEntries =
          def.effects && def.effects.length > 0
            ? def.effects
            : def.tags?.includes("fire")
              ? [{ id: "fire", enabled: true }]
              : [];
        if (obstacle.state?.lit === false) continue;

      if (!effectEntries.length) continue;

      for (const entry of effectEntries) {
        if (entry.enabled === false) continue;
        const effectDef = effectTypeById.get(entry.id);
        if (!effectDef) continue;
        const idx = obstacle.y * grid.cols + obstacle.x;
        const floorId = idx >= 0 && idx < terrain.length ? terrain[idx] : null;
        if (!isEffectAllowedOnFloor(effectDef, floorId)) continue;
        results.push({
          id: `effect-${obstacle.id}-${entry.id}`,
          typeId: entry.id,
          x: obstacle.x,
          y: obstacle.y,
          active: true,
          sourceObstacleId: obstacle.id
        });
      }
    }

    return results;
  };

  useEffect(() => {
    if (effectTypes.length === 0) return;
    if (!Array.isArray(obstacles) || obstacles.length === 0) return;
    if (!Array.isArray(mapTerrain) || mapTerrain.length === 0) return;
    const desired = buildEffectsFromObstacles({
      obstacles,
      terrain: mapTerrain,
      grid: mapGrid
    });
    const currentById = new Map<string, EffectInstance>();
    for (const effect of effects) currentById.set(effect.id, effect);
    const merged = desired.map(effect => {
      const existing = currentById.get(effect.id);
      if (!existing) return effect;
      return { ...effect, active: existing.active };
    });
    const currentKey = effects.map(e => `${e.id}:${e.typeId}:${e.x}:${e.y}:${e.active}`).join("|");
    const mergedKey = merged.map(e => `${e.id}:${e.typeId}:${e.x}:${e.y}:${e.active}`).join("|");
    if (currentKey !== mergedKey) {
      setEffects(merged);
    }
  }, [effectTypes.length, obstacles, mapTerrain, mapGrid.cols, mapGrid.rows, effects]);
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
  const terrainLegend = useMemo(() => {
    const entries: Array<{ id: string; label: string; index: number }> = [];
    const idMap = new Map<string, number>();
    const terrain = Array.isArray(mapTerrain) ? mapTerrain : null;
    if (!terrain || terrain.length === 0) {
      return { entries, idMap };
    }

    const { cols, rows } = mapGrid;
    const playable = playableCells;
    const unique = new Set<string>();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (playable && playable.size > 0 && !playable.has(`${x},${y}`)) continue;
        const index = y * cols + x;
        const cellTerrain = terrain[index] ?? "unknown";
        unique.add(cellTerrain);
      }
    }

    const ordered: string[] = [];
    const pending = new Set(unique);
    for (const material of FLOOR_MATERIALS) {
      if (pending.has(material.id)) {
        ordered.push(material.id);
        pending.delete(material.id);
      }
    }
    const leftovers = Array.from(pending);
    leftovers.sort();
    ordered.push(...leftovers);

    let nextId = 1;
    for (const id of ordered) {
      const label = getFloorMaterial(id)?.label ?? id;
      idMap.set(id, nextId);
      entries.push({ id, label, index: nextId });
      nextId += 1;
    }

    return { entries, idMap };
  }, [mapTerrain, mapGrid, playableCells]);
  const terrainMixLayer = useMemo(() => {
    if (!Array.isArray(mapTerrain) || mapTerrain.length === 0) return [];
    return buildTerrainMixLayer({
      terrain: mapTerrain,
      cols: mapGrid.cols,
      rows: mapGrid.rows,
      playableCells
    });
  }, [mapTerrain, mapGrid.cols, mapGrid.rows, playableCells]);
  const lightSources = useMemo(() => {
    const sources: LightSource[] = [];
    for (const effect of effects) {
      if (effect.active === false) continue;
      const def = effectTypeById.get(effect.typeId);
      const radiusRaw = def?.light?.radius;
      const radius = Number.isFinite(radiusRaw) ? Math.floor(radiusRaw as number) : 0;
      if (radius <= 0) continue;
      sources.push({ x: effect.x, y: effect.y, radius, color: def?.light?.color });
    }
    return sources;
  }, [effects, effectTypeById]);
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

  const shouldAnimateBoard = hasAnimatedSprites && !isTextureLoading;
  const boardMaxFps = shouldAnimateBoard
    ? (isBoardIdle ? BOARD_FPS_IDLE : BOARD_FPS_ACTIVE)
    : 0;
  const invalidateBoard = useCallback(() => {
    if (!shouldAnimateBoard) {
      setRenderTick(t => t + 1);
    }
  }, [shouldAnimateBoard]);
  const {
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
  } = usePixiBoard({
    enabled: isCombatConfigured,
    containerRef: pixiContainerRef,
    zoom: boardZoom,
    panX: boardPan.x,
    panY: boardPan.y,
    backgroundColor: boardBackgroundColor,
    playableCells,
    terrain: mapTerrain,
    terrainMix: terrainMixLayer,
    grid: mapGrid,
    animate: shouldAnimateBoard,
    maxFps: boardMaxFps,
    renderTick
  });

  usePixiNaturalTiling({
    layerRef: terrainNaturalLayerRef,
    terrain: mapTerrain,
    terrainMix: terrainMixLayer,
    playableCells,
    grid: mapGrid,
    materials: floorMaterialById,
    lightLevels,
    lightMap: mapLight,
    bumpIntensity,
    windSpeed,
    windStrength,
    bumpDebug,
    pixiReadyTick,
    onInvalidate: invalidateBoard
  });

  usePixiTerrainFx({
    terrainFxLayerRef,
    terrainLabelLayerRef,
    showTerrainIds,
    showTerrainContours,
    playableCells,
    grid: mapGrid,
    terrain: mapTerrain,
    terrainMix: terrainMixLayer,
    terrainIdMap: terrainLegend.idMap,
    pixiReadyTick
  });

  useEffect(() => {
    if (shouldAnimateBoard) return;
    setRenderTick(t => t + 1);
  }, [
    shouldAnimateBoard,
    mapGrid,
    mapTerrain,
    terrainMixLayer,
    playableCells,
    mapHeight,
    mapLight,
    obstacles,
    wallSegments,
    decorations,
    effects,
    player,
    enemies,
    selectedPath,
    selectedTargetId,
    selectedObstacleTarget,
    selectedWallTarget,
    visibilityLevels,
    showAllLevels,
    showLightOverlay,
    showVisionDebug,
    showTerrainIds,
    showTerrainContours,
    activeLevel,
    speechBubbles,
    isTextureLoading,
    boardZoom,
    boardPan.x,
    boardPan.y
  ]);

  usePixiWalls({
    depthLayerRef: staticDepthLayerRef,
    walls: wallSegments,
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels
  });
  usePixiObstacles({
    depthLayerRef: staticDepthLayerRef,
    obstacleTypes,
    obstacles,
    tokens: [player, ...enemies],
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels,
    paletteId: mapPaletteId,
    lightAngleDeg: shadowLightAngleDeg,
    suspendRendering: isTextureLoading
  });
  usePixiDecorations({
    depthLayerRef: staticDepthLayerRef,
    decorations,
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels
  });
  const renderEffects = useMemo(
    () => [...effects, ...actionEffects],
    [effects, actionEffects]
  );
  const fxAnimations = useMemo(() => {
    return getEffectAnimationKeys()
      .map(key => ({ key, frames: getObstacleAnimationFrames(key) ?? [] }))
      .filter(entry => entry.frames.length > 0);
  }, []);
  usePixiEffects({
    depthLayerRef: dynamicDepthLayerRef,
    effects: renderEffects,
    effectTypes,
    pixiReadyTick,
    grid: mapGrid,
    visibleCells: visibleCellsFull,
    showAllLevels,
    suspendRendering: isTextureLoading
  });
  usePixiTokens({
    depthLayerRef: dynamicDepthLayerRef,
    player,
    enemies,
    pixiReadyTick,
    grid: mapGrid,
    heightMap: mapHeight,
    activeLevel,
    visibleCells: visibleCellsFull,
    showAllLevels,
    lightAngleDeg: shadowLightAngleDeg,
    suspendRendering: isTextureLoading
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
    showFogSegments,
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
    setRadialMenu({ cell: null, token: null });
    if (interactionMode === "interact-select") {
      setInteractionMode("idle");
    }
    setInteractionMenuItems([]);
    closeInteractionContext();
  }

  function resolveWheelAnchor(): { x: number; y: number } {
    const container = pixiContainerRef.current;
    const margin = 110;
    if (!container) return { x: margin, y: margin };
    const rect = container.getBoundingClientRect();
    const clampedX = Math.max(margin, Math.min(rect.width - margin, margin));
    const clampedY = Math.max(margin, rect.height - margin);
    return { x: clampedX, y: clampedY };
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
    if (cost === "action" && turnActionUsage.usedActionCount >= (player.combatStats?.actionsPerTurn ?? 1)) {
      return { ok: false, reason: "Action principale deja utilisee." };
    }
    if (cost === "bonus" && turnActionUsage.usedBonusCount >= (player.combatStats?.bonusActionsPerTurn ?? 1)) {
      return { ok: false, reason: "Action bonus deja utilisee." };
    }
    return { ok: true };
  }

  function applyInteractionCost(cost?: InteractionCost) {
    const isStandardAction = cost === "action";
    const isBonusAction = cost === "bonus";
    if (!isStandardAction && !isBonusAction) return;
    setTurnActionUsage(prev => ({
      usedActionCount: prev.usedActionCount + (isStandardAction ? 1 : 0),
      usedBonusCount: prev.usedBonusCount + (isBonusAction ? 1 : 0)
    }));
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
      moveRange: profile.speed,
      combatStats: prev.combatStats
        ? { ...prev.combatStats, moveRange: profile.speed }
        : prev.combatStats
    }));
    setBasePathLimit(profile.speed);
    setPathLimit(Math.max(0, profile.speed - movementSpent));
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

  function handleSelectPathFromContext() {
    if (!canInteractWithBoard) return;
    suppressBoardClickUntilRef.current = Date.now() + 220;
    window.setTimeout(() => {
      setInteractionMode("moving");
    }, 120);
  }

  function resourceKey(name: string, pool?: string | null): string {
    return `${pool ?? "default"}:${name}`;
  }

  function getSeenTargetsForActor(actorId: string): Set<string> {
    const existing = seenTargetsByActorRef.current.get(actorId);
    if (existing) return existing;
    const next = new Set<string>();
    seenTargetsByActorRef.current.set(actorId, next);
    return next;
  }

  function requestEnemyTurnPause() {
    if (enemyTurnPauseRef.current) return;
    let resolve: () => void = () => {};
    const promise = new Promise<void>(res => {
      resolve = res;
    });
    enemyTurnPauseRef.current = { promise, resolve };
  }

  async function waitForEnemyTurnResume(): Promise<void> {
    const pause = enemyTurnPauseRef.current;
    if (pause) {
      await pause.promise;
    }
  }

  function markTargetsSeen(actorId: string, targets: TokenState[]) {
    const seen = getSeenTargetsForActor(actorId);
    for (const target of targets) {
      seen.add(target.id);
    }
  }

  function pushHpPopup(token: TokenState, delta: number) {
    if (!Number.isFinite(delta) || delta === 0) return;
    const anchor = resolveAnchorForCell({ x: token.x, y: token.y });
    if (!anchor) return;
    const id = `hp-${token.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const text = delta > 0 ? `+${delta}` : `${delta}`;
    const color = delta > 0 ? "#2ecc71" : "#e74c3c";
    const x = anchor.anchorX;
    const y = anchor.anchorY - 24;
    setHpPopups(prev => [...prev, { id, x, y, text, color }]);
    window.setTimeout(() => {
      setHpPopups(prev => prev.filter(popup => popup.id !== id));
    }, 2600);
  }

  function showReactionToast(text: string, kind: "hit" | "miss" | "info" = "info") {
    if (!text) return;
    if (reactionToastTimerRef.current) {
      window.clearTimeout(reactionToastTimerRef.current);
    }
    const id = `reaction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setReactionToast({ id, text, kind });
    reactionToastTimerRef.current = window.setTimeout(() => {
      setReactionToast(current => (current?.id === id ? null : current));
      reactionToastTimerRef.current = null;
    }, 3200);
  }

  function showCombatToast(text: string, kind: "hit" | "heal" | "info" = "info") {
    if (!text) return;
    if (combatToastTimerRef.current) {
      window.clearTimeout(combatToastTimerRef.current);
    }
    const id = `combat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCombatToast({ id, text, kind });
    combatToastTimerRef.current = window.setTimeout(() => {
      setCombatToast(current => (current?.id === id ? null : current));
      combatToastTimerRef.current = null;
    }, 3200);
  }

  function reactionCombatKey(actorId: string, reactionId: string): string {
    return `${actorId}:${reactionId}`;
  }

  function getResourceAmount(name: string, pool?: string | null): number {
    const key = resourceKey(name, pool);
    return typeof playerResources[key] === "number" ? playerResources[key] : 0;
  }

  function canUseReaction(actorId: string): boolean {
    return (reactionUsage[actorId] ?? 0) < 1;
  }

  function resetReactionUsageForActor(actorId: string) {
    setReactionUsage(prev => ({ ...prev, [actorId]: 0 }));
  }

  function markReactionUsed(actorId: string) {
    setReactionUsage(prev => ({ ...prev, [actorId]: (prev[actorId] ?? 0) + 1 }));
  }

  function hasReactionUsedInCombat(actorId: string, reactionId: string): boolean {
    const key = reactionCombatKey(actorId, reactionId);
    return (reactionCombatUsage[key] ?? 0) > 0;
  }

  function markReactionUsedInCombat(actorId: string, reactionId: string) {
    const key = reactionCombatKey(actorId, reactionId);
    setReactionCombatUsage(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }

  function getTokensOnActiveLevel(tokens: TokenState[]): TokenState[] {
    return tokens.filter(t => getBaseHeightAt(t.x, t.y) === activeLevel);
  }

  function areTokensOnSameLevel(a: TokenState, b: TokenState): boolean {
    return getBaseHeightAt(a.x, a.y) === getBaseHeightAt(b.x, b.y);
  }

  function getEnemyTypeForToken(token: TokenState): EnemyTypeDefinition | null {
    if (token.type !== "enemy") return null;
    const id = token.enemyTypeId ?? "";
    return enemyTypeById.get(id) ?? null;
  }

  function resolveCombatProfile(token: TokenState): EnemyCombatProfile & {
    primaryStyle: EnemyCombatStyle;
    allowedStyles: EnemyCombatStyle[];
    preferredAbilities: Array<"str" | "dex" | "con" | "int" | "wis" | "cha">;
    preferredRangeMin: number;
    preferredRangeMax: number;
    intelligence: 0 | 1 | 2;
    awareness: 0 | 1 | 2;
    tactics: string[];
  } {
    const enemyType = getEnemyTypeForToken(token);
    const raw = enemyType?.combatProfile ?? {};
    const fallbackPrimary: EnemyCombatStyle =
      token.aiRole === "archer" ? "ranged" : "melee";
    const primaryStyle = raw.primaryStyle ?? fallbackPrimary;
    const allowedStyles =
      raw.allowedStyles && raw.allowedStyles.length > 0
        ? raw.allowedStyles
        : [primaryStyle];
    const preferredAbilities =
      raw.preferredAbilities && raw.preferredAbilities.length > 0
        ? raw.preferredAbilities
        : [primaryStyle === "ranged" ? "dex" : "str"];
    const preferredRangeMin =
      raw.preferredRangeMin ??
      enemyType?.behavior?.preferredRangeMin ??
      (primaryStyle === "ranged" ? 2 : 1);
    const preferredRangeMax =
      raw.preferredRangeMax ??
      enemyType?.behavior?.preferredRangeMax ??
      (primaryStyle === "ranged" ? 6 : 1);
    const intelligence = (raw.intelligence ?? 0) as 0 | 1 | 2;
    const awareness = (raw.awareness ?? 0) as 0 | 1 | 2;
    const tactics = Array.isArray(raw.tactics) ? raw.tactics : [];
    return {
      ...raw,
      primaryStyle,
      allowedStyles,
      preferredAbilities,
      preferredRangeMin,
      preferredRangeMax,
      intelligence,
      awareness,
      tactics
    };
  }

  function getEnemyMemory(enemyId: string): EnemyMemory {
    const existing = enemyMemoryRef.current.get(enemyId);
    if (existing) return existing;
    const next: EnemyMemory = {};
    enemyMemoryRef.current.set(enemyId, next);
    return next;
  }

  function updateEnemyMemory(enemyId: string, patch: Partial<EnemyMemory>) {
    const current = getEnemyMemory(enemyId);
    enemyMemoryRef.current.set(enemyId, { ...current, ...patch });
  }

  function classifyFailureReason(reason?: string | null): string {
    const text = (reason ?? "").toLowerCase();
    if (!text) return "unknown";
    if (text.includes("portee") || text.includes("distance")) return "out_of_range";
    if (text.includes("vision") || text.includes("ligne")) return "no_los";
    if (text.includes("cible")) return "no_target";
    return "other";
  }

  function getActiveTeamAlert(): TeamAlert | null {
    const alert = teamAlertRef.current;
    if (!alert) return null;
    if (round > alert.expiresRound) {
      teamAlertRef.current = null;
      return null;
    }
    return alert;
  }

  function fuzzAlertPosition(pos: { x: number; y: number }): { x: number; y: number } {
    const dx = Math.round((Math.random() * 2) - 1);
    const dy = Math.round((Math.random() * 2) - 1);
    const x = clamp(pos.x + dx, 0, mapGrid.cols - 1);
    const y = clamp(pos.y + dy, 0, mapGrid.rows - 1);
    if (isCellPlayable(x, y)) return { x, y };
    return { x: pos.x, y: pos.y };
  }

  function broadcastTeamAlert(
    source: TokenState,
    position: { x: number; y: number },
    confidence: number
  ) {
    const payload: TeamAlert = {
      sourceId: source.id,
      position,
      createdRound: round,
      expiresRound: round + 2,
      confidence
    };
    teamAlertRef.current = payload;
    setEnemyBubble(source.id, "Je l'ai repere, par la !");
  }

  function getActionStyle(action: ActionDefinition): EnemyCombatStyle | "move" | "other" {
    if (action.category === "movement" || action.tags?.includes("movement")) {
      return "move";
    }
    if (action.category === "support") return "support";
    const rangeMax = action.targeting?.range?.max ?? 1;
    if (action.tags?.includes("melee") || rangeMax <= 1) return "melee";
    if (action.tags?.includes("distance") || rangeMax > 1) return "ranged";
    return "other";
  }

  function scoreActionForEnemy(params: {
    action: ActionDefinition;
    profile: ReturnType<typeof resolveCombatProfile>;
    distanceToPlayer: number;
    memory: EnemyMemory;
  }): number {
    const { action, profile, distanceToPlayer, memory } = params;
    const style = getActionStyle(action);
    if (style === "move" || style === "other") return -100;
    if (!profile.allowedStyles.includes(style as EnemyCombatStyle)) return -100;
    let score = 0;
    if (style === profile.primaryStyle) score += 30;
    if (profile.preferredAbilities.includes("str") && style === "melee") score += 10;
    if (profile.preferredAbilities.includes("dex") && style === "ranged") score += 10;
    const range = action.targeting?.range;
    const min = range?.min ?? 0;
    const max = range?.max ?? 1;
    const inRange = distanceToPlayer >= min && distanceToPlayer <= max;
    score += inRange ? 15 : -25;
    const preferredMin = profile.preferredRangeMin;
    const preferredMax = profile.preferredRangeMax;
    if (distanceToPlayer >= preferredMin && distanceToPlayer <= preferredMax) {
      score += 8;
    } else {
      score -= 8;
    }
    if (memory.lastFailedReason === "out_of_range" && !inRange) {
      score -= 20;
    }
    if (memory.lastEffectiveActionId === action.id) {
      score += 4;
    }
    return score;
  }

  function buildEnemyActionContext(params: {
    actor: TokenState;
    playerSnapshot: TokenState;
    enemiesSnapshot: TokenState[];
  }) {
    return {
      round,
      phase: "enemies" as const,
      actor: params.actor,
      player: params.playerSnapshot,
      enemies: params.enemiesSnapshot,
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
      sampleCharacter: characterConfig,
      onLog: pushLog
    };
  }

  const computePathCost = (path: { x: number; y: number }[]): number => {
    if (!path.length) return 0;
    const cols = mapGrid.cols;
    const rows = mapGrid.rows;
    let total = 0;
    for (const cell of path) {
      if (!isCellInsideGrid(cell.x, cell.y, cols, rows)) continue;
      const idx = cell.y * cols + cell.x;
      if (idx < 0 || idx >= mapTerrain.length) continue;
      const mat = getFloorMaterial(mapTerrain[idx]);
      const cost = Number(mat?.moveCost ?? 1);
      if (!Number.isFinite(cost) || cost <= 0) continue;
      total += cost;
    }
    return Math.round(total * 10) / 10;
  };

  const selectedPathCost = useMemo(
    () => computePathCost(selectedPath),
    [mapGrid, mapTerrain, selectedPath]
  );

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

  async function queueMapTexturePreload(params: {
    player: TokenState;
    enemies: TokenState[];
    obstacles: ObstacleInstance[];
    effects: EffectInstance[];
    decorations: DecorInstance[];
  }) {
    const tokenRequests: TokenSpriteRequest[] = [];
    const addToken = (token: TokenState | null | undefined) => {
      const spriteKey = token?.appearance?.spriteKey;
      if (!spriteKey) return;
      tokenRequests.push({
        spriteKey,
        variants: token?.appearance?.spriteVariants ?? null
      });
    };

    addToken(params.player);
    for (const enemy of params.enemies) addToken(enemy);

    const obstacleSpriteKeys = new Set<string>();
    for (const obstacle of params.obstacles) {
      const def = obstacleTypeById.get(obstacle.typeId) ?? null;
      const appearance = def?.appearance ?? null;
      if (appearance?.spriteKey) obstacleSpriteKeys.add(appearance.spriteKey);
      if (appearance?.shadowSpriteLeafy) obstacleSpriteKeys.add(appearance.shadowSpriteLeafy);
      if (appearance?.shadowSpriteLeafless) obstacleSpriteKeys.add(appearance.shadowSpriteLeafless);
      for (const layer of appearance?.layers ?? []) {
        if (layer?.spriteKey) obstacleSpriteKeys.add(layer.spriteKey);
      }
    }

    const effectSpriteKeys = new Set<string>();
    for (const effect of params.effects) {
      const def = effectTypeById.get(effect.typeId);
      const spriteKey = def?.appearance?.spriteKey;
      if (spriteKey) effectSpriteKeys.add(spriteKey);
    }

    const decorSpriteKeys = new Set<string>();
    for (const decor of params.decorations) {
      if (decor?.spriteKey) decorSpriteKeys.add(decor.spriteKey);
    }

    const obstacleKeys = new Set<string>([...obstacleSpriteKeys, ...effectSpriteKeys]);
    const totalCount =
      tokenRequests.length + obstacleKeys.size + decorSpriteKeys.size;
    if (totalCount === 0) return;

    const hint = `textures: ${tokenRequests.length} tokens, ${obstacleKeys.size} obstacles/effects, ${decorSpriteKeys.size} decors`;
    textureLoadingCounterRef.current += 1;
    if (textureLoadingCounterRef.current === 1) {
      setIsTextureLoading(true);
    }
    setTextureLoadingHint(hint);

    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    const minDurationMs = 350;
    try {
      const tasks: Promise<void>[] = [];
      if (tokenRequests.length > 0) {
        tasks.push(preloadTokenPngTexturesFor(tokenRequests));
      }
      if (obstacleKeys.size > 0) {
        tasks.push(preloadObstaclePngTexturesFor([...obstacleKeys]));
      }
      if (decorSpriteKeys.size > 0) {
        tasks.push(preloadDecorTexturesFor([...decorSpriteKeys]));
      }
      await Promise.all(tasks);
    } catch (error) {
      console.warn("[textures] preload failed:", error);
    } finally {
      const end = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = end - start;
      if (elapsed < minDurationMs) {
        await new Promise(resolve => setTimeout(resolve, minDurationMs - elapsed));
      }
      textureLoadingCounterRef.current = Math.max(0, textureLoadingCounterRef.current - 1);
      if (textureLoadingCounterRef.current === 0) {
        setIsTextureLoading(false);
        setTextureLoadingHint(null);
      }
    }
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
    const nextDecorations = Array.isArray(map.decorations) ? map.decorations : [];
    setDecorations(nextDecorations);
    const nextEffects = buildEffectsFromObstacles({
      obstacles: map.obstacles ?? [],
      terrain: Array.isArray(map.terrain) ? map.terrain : [],
      grid
    });
    setEffects(nextEffects);
    setPendingHazardRoll(null);
    setHazardAnchor(null);

    const newEnemies: TokenState[] = map.enemySpawns.map((spawn, i) =>
      createEnemy(i, spawn.enemyType, spawn.position)
    );
    setEnemies(newEnemies);
    setRevealedEnemyIds(new Set());
    setRevealedCells(new Set());
    void queueMapTexturePreload({
      player,
      enemies: newEnemies,
      obstacles: map.obstacles ?? [],
      effects: nextEffects,
      decorations: nextDecorations
    });

    setRound(1);
    setHasRolledInitiative(false);
    setTurnOrder([]);
    setCurrentTurnIndex(0);
    setIsCombatConfigured(true);
    setActionUsageCounts({ turn: {}, encounter: {} });
    setTurnActionUsage({ usedActionCount: 0, usedBonusCount: 0 });
    setReactionUsage({});
    setReactionQueue([]);
    setReactionCombatUsage({});
    setKillerInstinctTargetId(null);
    seenTargetsByActorRef.current.clear();
    enemyTurnPauseRef.current = null;
    setPlayerResources({ "bandolier:dagger": 3, "gear:torch": 1 });
    setPathLimit(defaultMovementProfile.speed);
    setBasePathLimit(defaultMovementProfile.speed);
    setMovementSpent(0);

    if (newEnemies.length === 0) {
      rollSoloInitiative();
    }
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
    setTurnTick(tick => tick + 1);
  }

  function rollInitialInitiativeIfNeeded() {
    if (hasRolledInitiative) return;

    const playerMod = getCharacterAbilityMod(characterConfig, "dex");
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
    const text = (message ?? "").trim();
    if (!text) return;
    const entry: NarrationEntry = {
      id: `narr-${narrationIdRef.current++}`,
      round,
      text
    };
    setNarrationEntries(prev => [entry, ...prev].slice(0, 40));
    if (!narrationOpenRef.current) {
      setNarrationUnread(prev => Math.min(prev + 1, 99));
    }
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

  function applyPlayerBubble(text: string | null, updatedAtRound = round) {
    setSpeechBubbles(prev => {
      const filtered = prev.filter(b => b.tokenId !== player.id);
      return text ? [...filtered, { tokenId: player.id, text, updatedAtRound }] : filtered;
    });
  }

  function setPlayerBubble(textInput: string) {
    const text = (textInput ?? "").trim();
    if (!text) return;

    if (playerBubbleTimeoutRef.current !== null) {
      window.clearTimeout(playerBubbleTimeoutRef.current);
      playerBubbleTimeoutRef.current = null;
    }

    playerBubbleOverrideRef.current = true;
    applyPlayerBubble(text, round);

    playerBubbleTimeoutRef.current = window.setTimeout(() => {
      playerBubbleOverrideRef.current = false;
      applyPlayerBubble(playerThoughtRef.current, round);
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
    const loadedTypes = loadEffectTypesFromIndex();
    setEffectTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadStatusTypesFromIndex();
    setStatusTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadWallTypesFromIndex();
    setWallTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadWeaponTypesFromIndex();
    setWeaponTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadRaceTypesFromIndex();
    setRaceTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadClassTypesFromIndex();
    setClassTypes(loadedTypes);
    const loadedSubclasses = loadSubclassTypesFromIndex();
    setSubclassTypes(loadedSubclasses);
  }, []);

  useEffect(() => {
    const loadedTypes = loadBackgroundTypesFromIndex();
    setBackgroundTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadLanguageTypesFromIndex();
    setLanguageTypes(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadToolItemsFromIndex();
    setToolItems(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadObjectItemsFromIndex();
    setObjectItems(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadArmorItemsFromIndex();
    setArmorItems(loadedTypes);
  }, []);

  useEffect(() => {
    const loadedTypes = loadFeatureTypesFromIndex();
    setFeatureTypes(loadedTypes);
  }, []);


  useEffect(() => {
    if (!isCombatConfigured) return;
    if (hasRolledInitiative) return;
    if (configEnemyCount > 0 && enemies.length === 0) return;
    rollInitialInitiativeIfNeeded();
  }, [isCombatConfigured, hasRolledInitiative, enemies.length, configEnemyCount]);

  useEffect(() => {
    setSpeechBubbles(prev =>
      prev.filter(
        b =>
          b.tokenId === player.id ||
          enemies.some(e => e.id === b.tokenId && e.hp > 0)
      )
    );
  }, [enemies, player.id]);

  useEffect(() => {
    if (!pixiContainerRef.current) return;
    const prevPlayerHp = prevPlayerHpRef.current;
    if (prevPlayerHp !== null && player.hp !== prevPlayerHp) {
      const delta = player.hp - prevPlayerHp;
      const now = Date.now();
      pushHpPopup(player, delta);
      if (now >= suppressCombatToastUntilRef.current) {
        if (delta < 0) {
          showCombatToast(`Vous avez subi ${Math.abs(delta)} degats.`, "hit");
        } else if (delta > 0) {
          showCombatToast(`Vous recuperez ${delta} PV.`, "heal");
        }
      }
    }
    prevPlayerHpRef.current = player.hp;

    const prevEnemies = prevEnemyHpRef.current;
    const nextEnemies = new Map<string, number>();
    for (const enemy of enemies) {
      const prevHp = prevEnemies.get(enemy.id);
      if (prevHp !== undefined && enemy.hp !== prevHp) {
        pushHpPopup(enemy, enemy.hp - prevHp);
      }
      nextEnemies.set(enemy.id, enemy.hp);
    }
    prevEnemyHpRef.current = nextEnemies;
  }, [player, enemies]);

  useEffect(() => {
    if (!enemyTurnPauseRef.current) return;
    if (phase !== "enemies") {
      enemyTurnPauseRef.current.resolve();
      enemyTurnPauseRef.current = null;
      return;
    }
    if (!actionContext && reactionQueue.length === 0) {
      enemyTurnPauseRef.current.resolve();
      enemyTurnPauseRef.current = null;
    }
  }, [phase, actionContext, reactionQueue.length]);

  useEffect(() => {
    if (!killerInstinctTargetId) return;
    const target = enemies.find(e => e.id === killerInstinctTargetId);
    if (!target || target.hp <= 0) {
      pushLog("Instinct de tueur: cible tombee, avantage termine.");
      setKillerInstinctTargetId(null);
    }
  }, [enemies, killerInstinctTargetId]);

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
  }, []);

  useEffect(() => {
    if (actionsCatalog.length === 0) return;
    const playerActionIds = Array.isArray(player.actionIds) ? player.actionIds : [];
    const weaponActionIds = equippedWeaponIds
      .map(id => weaponActionById.get(id)?.id ?? null)
      .filter((id): id is string => Boolean(id));
    const visibleIds = new Set<string>([...playerActionIds, ...weaponActionIds]);
    const playerVisible =
      visibleIds.size > 0
        ? actionsCatalog.filter(a => visibleIds.has(a.id))
        : actionsCatalog.filter(a => !(a.tags || []).includes("enemy"));
    const filtered = playerVisible.filter(a => a.category !== "movement");
    setActions(filtered);
    setSelectedActionId(filtered.length ? filtered[0].id : null);
  }, [actionsCatalog, equippedWeaponIds, weaponActionById, player.actionIds]);

  useEffect(() => {
    const indexed = Array.isArray((moveTypesIndex as any).moveTypes)
      ? ((moveTypesIndex as any).moveTypes as string[])
      : [];

    const loaded: MoveTypeDefinition[] = [];
    for (const path of indexed) {
      const mod = MOVE_TYPE_MODULES[path];
      if (mod) {
        loaded.push(mod);
      } else {
        console.warn("[move-types] Move type path missing in bundle:", path);
      }
    }

    if (loaded.length === 0) {
      console.warn("[move-types] No move types loaded from index.json");
    }

    setMoveTypes(loaded);
  }, []);

  useEffect(() => {
    if (weaponTypes.length === 0) return;
    for (const weapon of weaponTypes) {
      const actionId = weapon.links?.actionId;
      const linkedAction = actionId ? weaponActionById.get(weapon.id) ?? null : null;
      if (actionId && !linkedAction) {
        console.warn(
          "[weapon-types] Linked action missing for weapon:",
          weapon.id,
          "->",
          actionId
        );
      }
      const effectId = weapon.links?.effectId;
      if (effectId && !effectTypeById.has(effectId)) {
        console.warn(
          "[weapon-types] Linked effect missing for weapon:",
          weapon.id,
          "->",
          effectId
        );
      }
    }
  }, [weaponTypes, actionCatalogById, effectTypeById]);

  useEffect(() => {
    const loadedTypes = loadReactionTypesFromIndex();
    setReactionCatalog(loadedTypes);
  }, []);

  useEffect(() => {
    if (!isCombatConfigured) return;
    if (isGameOver) return;
    if (reactionCatalog.length === 0) return;

    const allTokens = getTokensOnActiveLevel([player, ...enemies]);
    const reactors = [player, ...enemies].filter(token => !isTokenDead(token));

    for (const reactor of reactors) {
      const reactionIds = Array.isArray(reactor.reactionIds) ? reactor.reactionIds : [];
      if (reactionIds.length === 0) continue;

      const visibilityReactions = reactionIds
        .map(id => reactionById.get(id) ?? null)
        .filter(reaction => reaction && reaction.trigger?.event === "visibility.first_seen") as ReactionDefinition[];
      if (visibilityReactions.length === 0) continue;

      const visibleTargets = getEntitiesInVision(
        reactor,
        allTokens,
        visionBlockersActive,
        playableCells,
        wallEdges.vision,
        lightLevels,
        mapGrid
      ).filter(target => target.id !== reactor.id && !isTokenDead(target));

      const seenTargets = getSeenTargetsForActor(reactor.id);
      const newlyVisible = visibleTargets.filter(target => !seenTargets.has(target.id));
      if (newlyVisible.length === 0) continue;

      if (reactor.id === player.id) {
        setRevealedEnemyIds(prev => {
          const next = new Set(prev);
          for (const enemy of newlyVisible.filter(t => t.type === "enemy")) {
            next.add(enemy.id);
          }
          return next;
        });
      }

      for (const reaction of visibilityReactions) {
        const candidates = newlyVisible.filter(target =>
          reactionSourceMatches(reaction.trigger?.source, target, reactor)
        );
        if (candidates.length === 0) continue;

        const closest = candidates
          .map(target => ({ target, dist: distanceBetweenTokens(reactor, target) }))
          .sort((a, b) => a.dist - b.dist)[0]?.target;

        for (const target of candidates) {
          const conditionCheck = checkReactionConditions({
            reaction,
            reactor,
            target,
            distance: distanceBetweenTokens(reactor, target),
            isFirstSeen: true,
            isClosestVisible: target.id === (closest?.id ?? null),
            allTokens
          });
          if (!conditionCheck.ok) continue;
          const actionCheck = checkReactionActionEligibility({
            reaction,
            reactor,
            target,
            playerSnapshot: player,
            enemiesSnapshot: enemies
          });
          if (!actionCheck.ok) continue;

          const handled = applyInstantReactionEffects({
            reaction,
            reactor,
            target
          });

          if (!handled) {
            const anchor = resolveAnchorForCell({ x: target.x, y: target.y });
            const anchorX = anchor?.anchorX ?? 0;
            const anchorY = anchor?.anchorY ?? 0;
            const instance = {
              reactionId: reaction.id,
              reactorId: reactor.id,
              targetId: target.id,
              actionId: reaction.action.id,
              anchorX,
              anchorY
            };

            if (reactor.type === "player") {
              tryStartReaction(instance);
            } else {
              autoResolveReaction({
                reaction,
                reactor,
                target,
                playerSnapshot: player,
                enemiesSnapshot: enemies
              });
            }
          }
        }
      }

      markTargetsSeen(reactor.id, newlyVisible);
    }
  }, [
    isCombatConfigured,
    isGameOver,
    player,
    enemies,
    reactionCatalog,
    visionBlockersActive,
    playableCells,
    wallEdges.vision,
    lightLevels,
    mapGrid
  ]);

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
      resetReactionUsageForActor(player.id);
      setTurnActionUsage({ usedActionCount: 0, usedBonusCount: 0 });
      setActionUsageCounts(prev => ({ ...prev, turn: {} }));
      const speed = player.movementProfile?.speed ?? defaultMovementProfile.speed;
      setBasePathLimit(speed);
      setMovementSpent(0);
      setPathLimit(speed);
      setHasRolledAttackForCurrentAction(false);
      setAttackRoll(null);
        setDamageRoll(null);

        narrationPendingRef.current = false;
        beginRoundNarrationBuffer(round, buildCombatStateSummary("player"));
        setPlayer(prev => applyStartOfTurnStatuses({ token: prev, side: "player" }));
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
    resetReactionUsageForActor(entry.id);
    void runSingleEnemyTurnV2(entry.id);
  }, [
    isCombatConfigured,
    hasRolledInitiative,
    turnOrder,
    currentTurnIndex,
    turnTick,
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

  function rollSoloInitiative() {
    const playerMod = getCharacterAbilityMod(characterConfig, "dex");
    const rollD20 = () => Math.floor(Math.random() * 20) + 1;
    const pjRoll = rollD20();
    const pjTotal = pjRoll + playerMod;
    const entries: TurnEntry[] = [
      {
        id: player.id,
        kind: "player",
        initiative: pjTotal
      }
    ];

    setPlayerInitiative(pjTotal);
    setTurnOrder(entries);
    setCurrentTurnIndex(0);
    setHasRolledInitiative(true);
    pushLog(
      `Initiative: Joueur ${pjTotal} (d20=${pjRoll}, mod=${playerMod}) ??? le joueur commence.`
    );
  }

  function minDistanceToAnyObstacle(): number | null {
    if (obstacles.length === 0) return null;
    let best: number | null = null;
    for (const obstacle of obstacles) {
      if (obstacle.hp <= 0) continue;
      if (getBaseHeightAt(obstacle.x, obstacle.y) !== activeLevel) continue;
      const def = obstacleTypeById.get(obstacle.typeId) ?? null;
      const dist = getObstacleDistance(player, obstacle, def, {
        x: obstacle.x,
        y: obstacle.y
      });
      if (best === null || dist < best) {
        best = dist;
      }
    }
    return best;
  }

  function minDistanceToAnyWall(): number | null {
    if (wallSegments.length === 0) return null;
    let best: number | null = null;
    for (const seg of wallSegments) {
      if (typeof seg.hp === "number" && seg.hp <= 0) continue;
      const def = seg.typeId ? wallTypeById.get(seg.typeId) ?? null : null;
      if (!isWallDestructible(def)) continue;
      const cells = getAdjacentCellsForEdge(seg);
      const levelA = getBaseHeightAt(cells.a.x, cells.a.y);
      const levelB = getBaseHeightAt(cells.b.x, cells.b.y);
      if (levelA !== activeLevel && levelB !== activeLevel) continue;
      const dist = getWallSegmentDistance(player, seg);
      if (best === null || dist < best) {
        best = dist;
      }
    }
    return best;
  }

  function minDistanceToAnyHostileTarget(): number | null {
    const enemyDist = minDistanceToAnyEnemy();
    const obstacleDist = minDistanceToAnyObstacle();
    const wallDist = minDistanceToAnyWall();
    const distances = [enemyDist, obstacleDist, wallDist].filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value)
    );
    if (distances.length === 0) return null;
    return Math.min(...distances);
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
    const isHostileTargeting = targeting?.target === "enemy" || targeting?.target === "hostile";
    if (!targeting || !isHostileTargeting) {
      return {
        ok: false,
        reason: "Cette action ne cible pas une cible hostile."
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
    const isHostileTargeting = targeting?.target === "enemy" || targeting?.target === "hostile";
    if (!targeting || !isHostileTargeting) {
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
      let attackBlockers = obstacleBlocking.attacks;
      if (attackBlockers.size > 0) {
        const cells = def ? getObstacleOccupiedCells(obstacle, def) : [targetCell];
        if (cells.length > 0) {
          const trimmed = new Set(attackBlockers);
          for (const cell of cells) {
            trimmed.delete(cellKey(cell.x, cell.y));
          }
          attackBlockers = trimmed;
        }
      }
      const canHit = hasLineOfEffect(
        { x: actor.x, y: actor.y },
        { x: targetCell.x, y: targetCell.y },
        attackBlockers,
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
    const isHostileTargeting = targeting?.target === "enemy" || targeting?.target === "hostile";
    if (!targeting || !isHostileTargeting) {
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

    const costType = action.actionCost?.actionType;
    const isActiveAction =
      actionContext?.stage === "active" && validatedActionId === action.id;
    if (phase !== "player" && costType !== "reaction") {
      reasons.push("Action bloquee pendant le tour des ennemis.");
    }
    if (costType === "action" && turnActionUsage.usedActionCount >= (player.combatStats?.actionsPerTurn ?? 1)) {
      if (!isActiveAction) {
        reasons.push("Action principale deja utilisee ce tour.");
      }
    }
    if (costType === "bonus" && turnActionUsage.usedBonusCount >= (player.combatStats?.bonusActionsPerTurn ?? 1)) {
      if (!isActiveAction) {
        reasons.push("Action bonus deja utilisee ce tour.");
      }
    }
    if (costType === "reaction" && !canUseReaction(player.id) && !isActiveAction) {
      reasons.push("Reaction deja utilisee ce tour.");
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
    const isHostileTargeting = targeting === "enemy" || targeting === "hostile";
    if (isHostileTargeting && costType !== "reaction") {
      const dist = minDistanceToAnyHostileTarget();
      if (dist === null) {
        reasons.push("Aucune cible hostile presente.");
      } else {
        details.push(`Distance mini cible hostile: ${dist}`);
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
      if (cond.type === "distance_max" && isHostileTargeting) {
        const dist = minDistanceToAnyHostileTarget();
        if (dist !== null && typeof cond.max === "number" && dist > cond.max) {
          reasons.push(cond.reason || `Distance > ${cond.max}.`);
        }
      }
      if (cond.type === "distance_between" && isHostileTargeting) {
        const dist = minDistanceToAnyHostileTarget();
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
    const stats = player.combatStats;
    const fallbackStats = characterConfig.combatStats ?? null;
    const level = Number(stats?.level ?? fallbackStats?.level ?? 1) || 1;
    const modSTR = Number(stats?.mods?.str ?? getCharacterAbilityMod(characterConfig, "str"));
    const modDEX = Number(stats?.mods?.dex ?? getCharacterAbilityMod(characterConfig, "dex"));
    const modCON = Number(stats?.mods?.con ?? getCharacterAbilityMod(characterConfig, "con"));
    const modINT = Number(stats?.mods?.int ?? getCharacterAbilityMod(characterConfig, "int"));
    const modWIS = Number(stats?.mods?.wis ?? getCharacterAbilityMod(characterConfig, "wis"));
    const modCHA = Number(stats?.mods?.cha ?? getCharacterAbilityMod(characterConfig, "cha"));
    const attackDamage = Number(stats?.attackDamage ?? player.attackDamage ?? 0);
    const attackBonus = Number(stats?.attackBonus ?? 0);
    const moveRange = Number(stats?.moveRange ?? player.moveRange ?? 0);
    const attackRange = Number(stats?.attackRange ?? player.attackRange ?? 0);
    return formula
      .replace(/\s+/g, "")
      .replace(/attackDamage/gi, String(attackDamage))
      .replace(/attackBonus/gi, String(attackBonus))
      .replace(/moveRange/gi, String(moveRange))
      .replace(/attackRange/gi, String(attackRange))
      .replace(/level/gi, String(level))
      .replace(/modSTR/gi, String(modSTR))
      .replace(/modDEX/gi, String(modDEX))
      .replace(/modCON/gi, String(modCON))
      .replace(/modINT/gi, String(modINT))
      .replace(/modWIS/gi, String(modWIS))
      .replace(/modCHA/gi, String(modCHA));
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

  function handleUseAction(action: ActionDefinition): boolean {
    const costType = action.actionCost?.actionType;
    const isStandardAction = costType === "action";
    const isBonusAction = costType === "bonus";
    const isReaction = costType === "reaction";

    if (isStandardAction && turnActionUsage.usedActionCount >= (player.combatStats?.actionsPerTurn ?? 1)) {
      pushLog(
        `Action ${action.name} refusee: action principale deja utilisee ce tour.`
      );
      return false;
    }
    if (isBonusAction && turnActionUsage.usedBonusCount >= (player.combatStats?.bonusActionsPerTurn ?? 1)) {
      pushLog(
        `Action ${action.name} refusee: action bonus deja utilisee ce tour.`
      );
      return false;
    }
    if (isReaction && !canUseReaction(player.id)) {
      pushLog(`Reaction ${action.name} refusee: reaction deja utilisee ce tour.`);
      return false;
    }

    const availability = computeActionAvailability(action);
    if (!availability.enabled) {
      pushLog(
        `Action ${action.name} bloque: ${availability.reasons.join(" | ")}`
      );
      return false;
    }

    setActionUsageCounts(prev => ({
      turn: { ...prev.turn, [action.id]: (prev.turn[action.id] ?? 0) + 1 },
      encounter: { ...prev.encounter, [action.id]: (prev.encounter[action.id] ?? 0) + 1 }
    }));

    for (const effect of action.effects || []) {
      if (effect.type === "modify_path_limit" && typeof effect.delta === "number") {
        setBasePathLimit(prev => Math.max(0, prev + effect.delta));
        setPathLimit(prev => Math.max(0, prev + effect.delta));
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

    setAttackRoll(null);
    setDamageRoll(null);
    setAttackOutcome(null);
    setHasRolledAttackForCurrentAction(false);
    setValidatedActionId(action.id);
    setTurnActionUsage(prev => ({
      usedActionCount: prev.usedActionCount + (isStandardAction ? 1 : 0),
      usedBonusCount: prev.usedBonusCount + (isBonusAction ? 1 : 0)
    }));
    if (isReaction) {
      markReactionUsed(player.id);
      if (actionContext?.reactionId) {
        markReactionUsedInCombat(player.id, actionContext.reactionId);
      }
    }

    if (actionTargetsHostile(action)) {
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

    return true;
  }

  function getActionById(id: string | null): ActionDefinition | null {
    if (!id) return null;
    const reactionAction = reactionActionById.get(id);
    if (reactionAction) return reactionAction;
    return actions.find(a => a.id === id) || moveTypes.find(a => a.id === id) || null;
  }

  function getValidatedAction(): ActionDefinition | null {
    return getActionById(validatedActionId);
  }

  function actionNeedsDiceUI(action: ActionDefinition | null): boolean {
    if (pendingHazardRoll) return true;
    if (!action) return false;
    return Boolean(action.attack || action.damage || action.skillCheck);
  }

  function actionTargetsHostile(action: ActionDefinition | null): boolean {
    const target = action?.targeting?.target;
    return target === "enemy" || target === "hostile";
  }

  type ActionVisualEffectSpec = {
    effectId: string;
    anchor?: "target" | "self" | "actor";
    offset?: { x: number; y: number };
    orientation?: "to_target" | "to_actor" | "none";
    rotationOffsetDeg?: number;
    onlyOnHit?: boolean;
    onlyOnMiss?: boolean;
    durationMs?: number;
  };

  function getActionVisualEffects(action: ActionDefinition | null): ActionVisualEffectSpec[] {
    if (!action || !Array.isArray(action.effects)) return [];
    return action.effects
      .filter(effect => effect?.type === "visual_effect" && typeof effect.effectId === "string")
      .map(effect => ({
        effectId: String(effect.effectId),
        anchor: effect.anchor,
        offset: effect.offset,
        orientation: effect.orientation,
        rotationOffsetDeg: effect.rotationOffsetDeg,
        onlyOnHit: Boolean(effect.onlyOnHit),
        onlyOnMiss: Boolean(effect.onlyOnMiss),
        durationMs: typeof effect.durationMs === "number" ? effect.durationMs : undefined
      }));
  }

  function resolveActionEffectOrientation(
    action: ActionDefinition,
    spec: ActionVisualEffectSpec
  ): number | null {
    const orientation =
      spec.orientation ??
      (actionTargetsHostile(action) ? "to_target" : "none");
    if (orientation === "none") return null;

    const actorPos = { x: player.x, y: player.y };
    let targetPos: { x: number; y: number } | null = null;

    if (selectedTargetId) {
      const target = enemies.find(e => e.id === selectedTargetId) ?? null;
      if (target) targetPos = { x: target.x, y: target.y };
    } else if (selectedObstacleTarget) {
      targetPos = { x: selectedObstacleTarget.x, y: selectedObstacleTarget.y };
    } else if (selectedWallTarget) {
      targetPos = { x: selectedWallTarget.x, y: selectedWallTarget.y };
    }

    if (!targetPos) return null;

    const from = orientation === "to_target" ? actorPos : targetPos;
    const to = orientation === "to_target" ? targetPos : actorPos;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 && dy === 0) return null;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const offset = typeof spec.rotationOffsetDeg === "number" ? spec.rotationOffsetDeg : 0;
    return angleDeg + offset;
  }

  function resolveActionEffectAnchor(
    action: ActionDefinition,
    spec: ActionVisualEffectSpec
  ): { x: number; y: number } | null {
    const anchor =
      spec.anchor ??
      (actionTargetsHostile(action) ? "target" : "self");

    if (anchor === "target") {
      if (selectedTargetId) {
        const target = enemies.find(e => e.id === selectedTargetId) ?? null;
        if (target) return { x: target.x, y: target.y };
      }
      if (selectedObstacleTarget) {
        return { x: selectedObstacleTarget.x, y: selectedObstacleTarget.y };
      }
      if (selectedWallTarget) {
        return { x: selectedWallTarget.x, y: selectedWallTarget.y };
      }
      return { x: player.x, y: player.y };
    }

    return { x: player.x, y: player.y };
  }

  function computeActionEffectDurationMs(params: {
    spec: ActionVisualEffectSpec;
    def: EffectTypeDefinition | null;
    appearance: EffectTypeDefinition["appearance"] | null;
  }): number {
    if (typeof params.spec.durationMs === "number") {
      return Math.max(120, params.spec.durationMs);
    }
    const defDuration = params.def?.durationMs;
    if (typeof defDuration === "number") {
      return Math.max(120, defDuration);
    }
    const spriteKey = params.appearance?.spriteKey;
    const frames = spriteKey ? getObstacleAnimationFrames(spriteKey) : null;
    if (frames && frames.length > 0) {
      const speed = typeof params.appearance?.animationSpeed === "number"
        ? params.appearance.animationSpeed
        : 0.15;
      const framesPerSecond = Math.max(1, speed * 60);
      return Math.max(160, Math.round((frames.length / framesPerSecond) * 1000));
    }
    return 450;
  }

  function scheduleActionEffectRemoval(effectId: string, durationMs: number) {
    const timer = window.setTimeout(() => {
      setActionEffects(prev => prev.filter(effect => effect.id !== effectId));
      actionEffectTimersRef.current.delete(effectId);
    }, durationMs);
    actionEffectTimersRef.current.set(effectId, timer);
  }

  async function spawnActionVisualEffects(action: ActionDefinition): Promise<boolean> {
    const specs = getActionVisualEffects(action);
    if (specs.length === 0) return false;

    const entries: Array<{
      spec: ActionVisualEffectSpec;
      def: EffectTypeDefinition | null;
      appearance: EffectTypeDefinition["appearance"] | null;
    }> = [];
    const spriteKeys = new Set<string>();

    specs.forEach(spec => {
      if (spec.onlyOnHit && attackOutcome !== "hit") return;
      if (spec.onlyOnMiss && attackOutcome !== "miss") return;
      const def = effectTypeById.get(spec.effectId) ?? null;
      const appearance = def?.appearance ?? null;
      if (!appearance?.spriteKey) return;
      entries.push({ spec, def, appearance });
      spriteKeys.add(appearance.spriteKey);
    });

    if (entries.length === 0) return false;

    try {
      await preloadObstaclePngTexturesFor([...spriteKeys]);
    } catch (error) {
      console.warn("[actions] VFX preload failed:", error);
      return false;
    }

    const created: Array<EffectInstance & { expiresAt: number }> = [];
    entries.forEach((entry, index) => {
      const { spec, def, appearance } = entry;
      const anchor = resolveActionEffectAnchor(action, spec);
      if (!anchor) return;
      const offset = spec.offset ?? { x: 0, y: 0 };
      const x = Math.max(0, Math.min(mapGrid.cols - 1, anchor.x + offset.x));
      const y = Math.max(0, Math.min(mapGrid.rows - 1, anchor.y + offset.y));
      const rotationDeg = resolveActionEffectOrientation(action, spec);
      const id = `action-effect-${action.id}-${Date.now()}-${index}`;
      const durationMs = computeActionEffectDurationMs({ spec, def, appearance });
      created.push({
        id,
        typeId: spec.effectId,
        x,
        y,
        active: true,
        rotationDeg: typeof rotationDeg === "number" ? rotationDeg : undefined,
        expiresAt: Date.now() + durationMs
      });
      scheduleActionEffectRemoval(id, durationMs);
    });

    if (created.length === 0) return false;
    setActionEffects(prev => [...prev, ...created]);
    return true;
  }

  function resolvePlayerAdvantageMode(action: ActionDefinition | null): AdvantageMode {
    if (!action || !actionTargetsHostile(action)) return advantageMode;
    if (!selectedTargetId) return advantageMode;
    if (selectedTargetId !== killerInstinctTargetId) return advantageMode;
    const target = enemies.find(e => e.id === selectedTargetId) ?? null;
    if (!target || isTokenDead(target)) return advantageMode;
    return "advantage";
  }

  function getActionResourceInfo(
    action: ActionDefinition | null
  ): { label: string; current: number; min: number } | null {
    if (!action?.usage?.resource?.name || typeof action.usage.resource.min !== "number") {
      return null;
    }
    const resource = action.usage.resource;
    const pool = typeof resource.pool === "string" ? resource.pool : null;
    const current = getResourceAmount(resource.name, pool);
    const label = pool ? `${pool}:${resource.name}` : resource.name;
    return { label, current, min: resource.min };
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
    if (actionTargetsHostile(action)) {
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

    const effectiveAdvantage = resolvePlayerAdvantageMode(action);
    const result = rollAttack(
      action.attack.bonus,
      effectiveAdvantage,
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
      actionTargetsHostile(action) && targetLabel
        ? ` sur ${targetLabel}`
        : "";

    const baseLine = `Jet de touche (${action.name})${targetSuffix} : ${rollsText} + ${result.bonus} = ${result.total}`;

    if (targetArmorClass !== null) {
      const isHit = result.total >= targetArmorClass || result.isCrit;
      const outcome = isHit
        ? `TOUCHE (CA ${targetArmorClass})${result.isCrit ? " (critique!)" : ""}`
        : `RATE (CA ${targetArmorClass})`;
      pushDiceLog(`${baseLine} -> ${outcome}`);
      setAttackOutcome(isHit ? "hit" : "miss");
      if (!isHit) {
        pushLog(`Action ${action.name}: attaque ratee.`);
      }
    } else {
      pushDiceLog(
        `${baseLine}${result.isCrit ? " (critique!)" : ""}`
      );
      setAttackOutcome("hit");
    }
  }

  function applyHazardRoll(hazard: PendingHazardRoll) {
    const result = rollDamage(hazard.formula);
    setDamageRoll(result);
    const diceText = result.dice.map(d => d.rolls.join("+")).join(" | ");
    const totalDamage = result.total;

    pushDiceLog(
      `Degats (${hazard.label}) : ${diceText || "0"} + ${
        result.flatModifier
      } = ${totalDamage}`
    );

    setPlayer(prev => {
      const beforeHp = prev.hp;
      const afterHp = Math.max(0, beforeHp - totalDamage);
      recordCombatEvent({
        round,
        phase,
        kind: "damage",
        actorId: prev.id,
        actorKind: "player",
        targetId: prev.id,
        targetKind: "player",
        summary: `Le heros subit ${totalDamage} degats (${hazard.label}) (PV ${beforeHp} -> ${afterHp}).`,
        data: {
          hazardId: hazard.id,
          damage: totalDamage,
          formula: hazard.formula,
          targetHpBefore: beforeHp,
          targetHpAfter: afterHp
        }
      });
      return { ...prev, hp: afterHp };
    });

    let statusId: string | null = null;
    let statusTriggered = false;
    if (hazard.statusRoll) {
      const roll = rollDie(hazard.statusRoll.die);
      const trigger = hazard.statusRoll.trigger;
      statusId = hazard.statusRoll.statusId ?? "status";
      pushDiceLog(
        `Jet d'etat (${statusId}) : d${hazard.statusRoll.die} = ${roll.total}`
      );
      if (roll.total === trigger) {
        setPlayer(prev => addStatusToToken(prev, statusId));
        pushLog(`Etat ${statusId} declenche.`);
        statusTriggered = true;
        recordCombatEvent({
          round,
          phase,
          kind: "status",
          actorId: player.id,
          actorKind: "player",
          targetId: player.id,
          targetKind: "player",
          summary: `Le heros prend l'etat ${statusId}.`,
          data: { statusId }
        });
      }
    }

    setHazardResolution({
      damageTotal: totalDamage,
      diceText,
      statusId,
      statusTriggered
    });
    setActionContextOpen(true);
  }

  function handleRollHazardDamage() {
    if (isGameOver) return;
    if (isTokenDead(player)) return;
    if (!pendingHazardRoll) {
      pushLog("Aucun danger en attente.");
      return;
    }
    applyHazardRoll(pendingHazardRoll);
  }

  function resolveHazardRoll(hazard: PendingHazardRoll, anchorCell: { x: number; y: number }) {
    setPendingHazardRoll(hazard);
    setHazardResolution(null);
    const anchor = resolveAnchorForCell(anchorCell);
    setHazardAnchor(anchor);
    applyHazardRoll(hazard);
  }

  function handleFinishHazard() {
    setPendingHazardRoll(null);
    setHazardAnchor(null);
    setHazardResolution(null);
    handleFinishAction();
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
    if (actionTargetsHostile(action)) {
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
          actionTargetsHostile(action) && targetLabel
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
        setAttackOutcome("miss");
        return;
      }
    }
    const resolvedDamageFormula = resolvePlayerFormula(action.damage.formula);
    const result = rollDamage(resolvedDamageFormula, {
      isCrit,
      critRule: action.damage.critRule
    });
    setDamageRoll(result);
    const diceText = result.dice
      .map(d => d.rolls.join("+"))
      .join(" | ");

    const totalDamage = result.total;

    const targetSuffix =
      actionTargetsHostile(action) && targetLabel
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

    setValidatedActionId(action.id);
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
    if (Date.now() < suppressBoardClickUntilRef.current) return;

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
          const check = getInteractionAvailability({
            interaction,
            target: { kind: "wall", segmentId: wallHit.segment.id, cell: wallHit.cell },
            player,
            wallSegments,
            obstacles,
            wallTypeById,
            obstacleTypeById,
            canPayCost: canPayInteractionCost,
            getWallDistance: getWallSegmentChebyshevDistance,
            getObstacleDistance: getObstacleChebyshevDistance
          });
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
          const check = getInteractionAvailability({
            interaction,
            target: { kind: "obstacle", obstacleId: obstacleHit.instance.id, cell: obstacleHit.cell },
            player,
            wallSegments,
            obstacles,
            wallTypeById,
            obstacleTypeById,
            canPayCost: canPayInteractionCost,
            getWallDistance: getWallSegmentChebyshevDistance,
            getObstacleDistance: getObstacleChebyshevDistance
          });
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

      setRadialMenu({
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

    if (pathLimit <= 0) {
      pushLog("Deplacement impossible: budget de mouvement epuise.");
      return;
    }

    setSelectedPath(prev => {
      const maxSteps = Math.max(0, pathLimit);
      const path = [...prev];
      const currentCost = computePathCost(path);

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
      const appendedCost = computePathCost(appended);
      if (currentCost + appendedCost > pathLimit) {
        pushLog("Budget de mouvement insuffisant pour ce trajet.");
        return path;
      }
      pushLog(`Trajectoire: +${appended.length} case(s) vers (${targetX}, ${targetY}).`);
      return path.concat(appended);
    });
  }

  // -----------------------------------------------------------
  // Player actions: validate / reset movement
  // -----------------------------------------------------------

  function resolveAnchorForCell(cell: { x: number; y: number }): { anchorX: number; anchorY: number } | null {
    const container = pixiContainerRef.current;
    if (!container) return null;
    const viewport = viewportRef.current;
    if (!viewport) {
      const rect = container.getBoundingClientRect();
      return { anchorX: rect.width / 2, anchorY: rect.height / 2 };
    }
    const center = gridToScreenForGrid(cell.x, cell.y, mapGrid.cols, mapGrid.rows);
    return {
      anchorX: viewport.offsetX + center.x * viewport.scale,
      anchorY: viewport.offsetY + center.y * viewport.scale
    };
  }

  function reactionSourceMatches(
    source: ReactionDefinition["trigger"]["source"] | undefined,
    mover: TokenState,
    reactor: TokenState
  ): boolean {
    if (!source || source === "any") return true;
    if (source === "self") return mover.id === reactor.id;
    if (source === "player") return mover.type === "player";
    if (source === "enemy") return mover.type === "enemy";
    if (source === "hostile") return mover.type !== reactor.type;
    if (source === "ally") return mover.type === reactor.type;
    return true;
  }

  function checkReactionConditions(params: {
    reaction: ReactionDefinition;
    reactor: TokenState;
    target: TokenState;
    distance: number;
    isFirstSeen: boolean;
    isClosestVisible: boolean;
    allTokens: TokenState[];
  }): { ok: boolean; reason?: string } {
    // Add new condition types here and document them in action-game/reactions/README.md.
    const conditions = params.reaction.conditions ?? [];
    for (const cond of conditions) {
      if (cond.type === "actor_alive" && isTokenDead(params.reactor)) {
        return { ok: false, reason: cond.reason || "Reactor is dead." };
      }
      if (cond.type === "target_alive" && isTokenDead(params.target)) {
        return { ok: false, reason: cond.reason || "Target is dead." };
      }
      if (cond.type === "reaction_available" && !canUseReaction(params.reactor.id)) {
        return { ok: false, reason: cond.reason || "Reaction already used." };
      }
      if (cond.type === "reaction_unused_combat") {
        if (hasReactionUsedInCombat(params.reactor.id, params.reaction.id)) {
          return { ok: false, reason: cond.reason || "Reaction already used this combat." };
        }
      }
      if (cond.type === "target_first_seen" && !params.isFirstSeen) {
        return { ok: false, reason: cond.reason || "Target already seen." };
      }
      if (cond.type === "target_is_closest_visible" && !params.isClosestVisible) {
        return { ok: false, reason: cond.reason || "Target not closest." };
      }
      if (cond.type === "target_visible") {
        const visible = isTargetVisible(
          params.reactor,
          params.target,
          params.allTokens,
          visionBlockersActive,
          playableCells,
          wallEdges.vision,
          lightLevels,
          mapGrid
        );
        if (!visible) {
          return { ok: false, reason: cond.reason || "Target not visible." };
        }
      }
      if (cond.type === "distance_max" && typeof cond.max === "number") {
        if (params.distance > cond.max) {
          return { ok: false, reason: cond.reason || "Target too far." };
        }
      }
    }
    return { ok: true };
  }

  function openReactionContext(instance: ReactionInstance) {
    setSelectedTargetId(instance.targetId);
    setSelectedObstacleTarget(null);
    setSelectedWallTarget(null);
    setTargetMode("none");
    setActionContext({
      anchorX: instance.anchorX,
      anchorY: instance.anchorY,
      actionId: instance.actionId,
      stage: "draft",
      source: "reaction",
      reactionId: instance.reactionId
    });
    setActionContextOpen(true);
  }

  function enqueueReaction(instance: ReactionInstance) {
    setReactionQueue(prev => [...prev, instance]);
  }

  function startNextReactionFromQueue(force?: boolean) {
    setReactionQueue(prev => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      if (!force && (actionContext || interactionContext || pendingHazardRoll || validatedActionId)) {
        return prev;
      }
      openReactionContext(next);
      return rest;
    });
  }

  function tryStartReaction(instance: ReactionInstance) {
    if (phase === "enemies" && instance.reactorId === player.id) {
      requestEnemyTurnPause();
    }
    if (actionContext || interactionContext || pendingHazardRoll || validatedActionId) {
      enqueueReaction(instance);
      return;
    }
    openReactionContext(instance);
  }

  function autoResolveReaction(params: {
    reaction: ReactionDefinition;
    reactor: TokenState;
    target: TokenState;
    playerSnapshot: TokenState;
    enemiesSnapshot: TokenState[];
    ignoreRange?: boolean;
  }) {
    if (!canUseReaction(params.reactor.id)) return;
    const baseAction = params.reaction.action;
    let action = baseAction;
    if (params.ignoreRange && baseAction.targeting?.range) {
      const afterDistance = distanceBetweenTokens(params.reactor, params.target);
      const nextRangeMax = Math.max(
        baseAction.targeting.range.max,
        afterDistance
      );
      action = {
        ...baseAction,
        targeting: {
          ...baseAction.targeting,
          range: { ...baseAction.targeting.range, max: nextRangeMax }
        }
      };
    }
    const context = buildReactionActionContext({
      reactor: params.reactor,
      playerSnapshot: params.playerSnapshot,
      enemiesSnapshot: params.enemiesSnapshot
    });

    const result = resolveAction(
      action,
      context,
      { kind: "token", token: params.target }
    );

    if (!result.ok || !result.playerAfter || !result.enemiesAfter) {
      pushLog(
        `[IA] Reaction ${action.name} echec: ${result.reason || "inconnu"}.`
      );
      return;
    }

    setPlayer(result.playerAfter);
    setEnemies(result.enemiesAfter);
    markReactionUsed(params.reactor.id);
    markReactionUsedInCombat(params.reactor.id, params.reaction.id);
    pushLog(`[IA] Reaction resolue: ${action.name}.`);

    const isEnemyReactionAgainstPlayer =
      params.reactor.type === "enemy" && params.target.type === "player";
    if (isEnemyReactionAgainstPlayer) {
      const missed = result.logs.some(line => line.includes("rate sa cible"));
      const hit = !missed;
      const defaultHitMessage = `Vous avez subi une attaque de reaction: ${params.reaction.name}.`;
      const defaultMissMessage = `Vous avez evite une attaque de reaction: ${params.reaction.name}.`;
      const message = missed
        ? params.reaction.uiMessageMiss || defaultMissMessage
        : params.reaction.uiMessage || defaultHitMessage;
      showReactionToast(message, hit ? "hit" : "miss");
      suppressCombatToastUntilRef.current = Date.now() + 500;
    }
  }

  function buildReactionActionContext(params: {
    reactor: TokenState;
    playerSnapshot: TokenState;
    enemiesSnapshot: TokenState[];
  }) {
    return {
      round,
      phase,
      actor: params.reactor,
      player: params.playerSnapshot,
      enemies: params.enemiesSnapshot,
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
      sampleCharacter: characterConfig,
      onLog: pushLog,
      emitEvent: evt => {
        recordCombatEvent({
          round,
          phase,
          kind: evt.kind,
          actorId: evt.actorId,
          actorKind: evt.actorKind,
          targetId: evt.targetId ?? null,
          targetKind: evt.targetKind ?? null,
          summary: evt.summary,
          data: evt.data ?? {}
        });
      }
    };
  }

  function checkReactionActionEligibility(params: {
    reaction: ReactionDefinition;
    reactor: TokenState;
    target: TokenState;
    playerSnapshot: TokenState;
    enemiesSnapshot: TokenState[];
    ignoreRange?: boolean;
  }): { ok: boolean; reason?: string } {
    const baseAction = params.reaction.action;
    let action = baseAction;
    if (params.ignoreRange && baseAction.targeting?.range) {
      const afterDistance = distanceBetweenTokens(params.reactor, params.target);
      const nextRangeMax = Math.max(
        baseAction.targeting.range.max,
        afterDistance
      );
      action = {
        ...baseAction,
        targeting: {
          ...baseAction.targeting,
          range: { ...baseAction.targeting.range, max: nextRangeMax }
        }
      };
    }

    const context = buildReactionActionContext({
      reactor: params.reactor,
      playerSnapshot: params.playerSnapshot,
      enemiesSnapshot: params.enemiesSnapshot
    });

    const availability = computeAvailabilityForActor(action, context);
    if (!availability.enabled) {
      return { ok: false, reason: availability.reasons.join(" | ") };
    }

    const validation = validateActionTarget(action, context, {
      kind: "token",
      token: params.target
    });
    if (!validation.ok) {
      return { ok: false, reason: validation.reason };
    }

    return { ok: true };
  }

  function applyInstantReactionEffects(params: {
    reaction: ReactionDefinition;
    reactor: TokenState;
    target: TokenState;
  }): boolean {
    const effects = params.reaction.action.effects ?? [];
    let handled = false;

    for (const effect of effects) {
      if (effect.type === "set_killer_instinct_target") {
        if (params.reactor.id !== player.id) continue;
        if (killerInstinctTargetId) return true;
        setKillerInstinctTargetId(params.target.id);
        setSelectedTargetId(params.target.id);
        setEnemies(prev =>
          prev.map(enemy =>
            enemy.id === params.target.id
              ? addStatusToToken(enemy, "killer-mark", params.reactor.id)
              : enemy
          )
        );
        pushLog(
          `Instinct de tueur: cible marquee -> ${params.target.id} (avantage jusqu'a sa mort).`
        );
        markReactionUsedInCombat(params.reactor.id, params.reaction.id);
        handled = true;
      }
      if (effect.type === "log" && typeof effect.message === "string") {
        pushLog(effect.message);
      }
    }

    return handled;
  }

  function triggerMovementReactions(params: {
    mover: TokenState;
    from: { x: number; y: number };
    to: { x: number; y: number };
    playerSnapshot: TokenState;
    enemiesSnapshot: TokenState[];
  }) {
    if (reactionById.size === 0) return;
    const moverFrom = { ...params.mover, x: params.from.x, y: params.from.y };
    const moverTo = { ...params.mover, x: params.to.x, y: params.to.y };
    const allTokens = getTokensOnActiveLevel([
      params.playerSnapshot,
      ...params.enemiesSnapshot
    ]);
    const reactors = [params.playerSnapshot, ...params.enemiesSnapshot].filter(
      token => token.id !== params.mover.id
    );

    for (const reactor of reactors) {
      if (isTokenDead(reactor)) continue;
      const reactionIds = Array.isArray(reactor.reactionIds) ? reactor.reactionIds : [];
      if (reactionIds.length === 0) continue;
      for (const reactionId of reactionIds) {
        const reaction = reactionById.get(reactionId);
        if (!reaction) continue;
        const event = reaction.trigger?.event ?? "";
        if (!event.startsWith("movement.")) continue;
        if (!reactionSourceMatches(reaction.trigger?.source, moverTo, reactor)) {
          continue;
        }

        const reactionRangeMax = reaction.action?.targeting?.range?.max;
        const reach =
          typeof reactionRangeMax === "number" && Number.isFinite(reactionRangeMax)
            ? reactionRangeMax
            : getAttackRangeForToken(reactor);
        const before = distanceBetweenTokens(reactor, moverFrom);
        const after = distanceBetweenTokens(reactor, moverTo);
        const isLeave = event === "movement.leave_reach";
        const isEnter = event === "movement.enter_reach";
        const matched =
          (isLeave && before <= reach && after > reach) ||
          (isEnter && before > reach && after <= reach);
        if (matched) {
          pushLog(
            `[REACTION DEBUG] ${reaction.id} event=${event} reactor=${reactor.id} target=${params.mover.id} from=(${moverFrom.x},${moverFrom.y}) to=(${moverTo.x},${moverTo.y}) reach=${reach} distBefore=${before} distAfter=${after}`
          );
        }
        if (!matched) continue;

        const distanceForConditions = isLeave ? before : after;
        const conditionCheck = checkReactionConditions({
          reaction,
          reactor,
          target: moverTo,
          distance: distanceForConditions,
          isFirstSeen: true,
          isClosestVisible: true,
          allTokens
        });
        if (!conditionCheck.ok) {
          pushLog(
            `[REACTION DEBUG] ${reaction.id} conditions reject reactor=${reactor.id} target=${params.mover.id} reason=${conditionCheck.reason || "unknown"}`
          );
          continue;
        }
        const actionCheck = checkReactionActionEligibility({
          reaction,
          reactor,
          target: moverTo,
          playerSnapshot: params.playerSnapshot,
          enemiesSnapshot: params.enemiesSnapshot,
          ignoreRange: isLeave
        });
        if (!actionCheck.ok) {
          pushLog(
            `[REACTION DEBUG] ${reaction.id} action reject reactor=${reactor.id} target=${params.mover.id} reason=${actionCheck.reason || "unknown"}`
          );
          continue;
        }

        const anchor = resolveAnchorForCell(params.to) ?? { anchorX: 0, anchorY: 0 };
        const instance: ReactionInstance = {
          reactionId: reaction.id,
          reactorId: reactor.id,
          targetId: params.mover.id,
          actionId: reaction.action.id,
          anchorX: anchor.anchorX,
          anchorY: anchor.anchorY
        };

        if (reactor.type === "player") {
          if (isGameOver || isTokenDead(reactor)) continue;
          pushLog(`Reaction disponible: ${reaction.name} (cible ${params.mover.id}).`);
          tryStartReaction(instance);
        } else {
          pushLog(`[IA] Reaction: ${reaction.name} sur ${params.mover.id}.`);
          autoResolveReaction({
            reaction,
            reactor,
            target: moverTo,
            playerSnapshot: params.playerSnapshot,
            enemiesSnapshot: params.enemiesSnapshot,
            ignoreRange: event === "movement.leave_reach"
          });
        }
      }
    }
  }

  function handleValidatePath() {
    if (phase !== "player") return;
    if (isGameOver) return;
    if (isTokenDead(player)) return;
    if (pathLimit <= 0) {
      pushLog("Deplacement impossible: budget de mouvement epuise.");
      return;
    }
    suppressBoardClickUntilRef.current = Date.now() + 220;
    if (selectedPath.length === 0) {
      const hazardRoll = buildHazardRollFromPath([], { x: player.x, y: player.y });
      if (hazardRoll) {
        resolveHazardRoll(hazardRoll, { x: player.x, y: player.y });
        pushLog(
          `Danger: ${hazardRoll.label} traverse (${hazardRoll.cells} case${
            hazardRoll.cells > 1 ? "s" : ""
          }). Jet de degats ${hazardRoll.formula} requis.`
        );
      }
      return;
    }

    const last = selectedPath[selectedPath.length - 1];
    const from = { x: player.x, y: player.y };
    const facingFrom =
      selectedPath.length > 1
        ? selectedPath[selectedPath.length - 2]
        : { x: player.x, y: player.y };
    const nextFacing = computeFacingTowards(facingFrom, last);
    const playerAfterMove = { ...player, x: last.x, y: last.y, facing: nextFacing };

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

    triggerMovementReactions({
      mover: playerAfterMove,
      from,
      to: { x: last.x, y: last.y },
      playerSnapshot: playerAfterMove,
      enemiesSnapshot: enemies
    });

    const hazardRoll = buildHazardRollFromPath(selectedPath, { x: player.x, y: player.y });
    const moveCost = selectedPathCost;
    setSelectedPath([]);
    setInteractionMode("idle");
    setMovementSpent(prev => Math.max(0, prev + moveCost));
    setPathLimit(prev => Math.max(0, prev - moveCost));
    if (hazardRoll) {
      resolveHazardRoll(hazardRoll, last);
      pushLog(
        `Danger: ${hazardRoll.label} traverse (${hazardRoll.cells} case${
          hazardRoll.cells > 1 ? "s" : ""
        }). Jet de degats ${hazardRoll.formula} requis.`
      );
      return;
    }
    if (isMoveTypeAction(getValidatedAction())) {
      handleFinishAction();
    } else {
      setActionContextOpen(false);
    }
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

    const addStatusToToken = (
      token: TokenState,
      statusId: string,
      sourceId?: string
    ): TokenState => {
      const def = statusTypeById.get(statusId);
      if (!def) return token;
      const duration = Math.max(1, Math.floor(def.durationTurns || 1));
      const current = Array.isArray(token.statuses) ? token.statuses : [];
      const existingIndex = current.findIndex(s => s.id === statusId);
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = {
          ...next[existingIndex],
          remainingTurns: duration,
          sourceId: sourceId ?? next[existingIndex].sourceId
        };
      } else {
        next.push({ id: statusId, remainingTurns: duration, sourceId });
      }
      return { ...token, statuses: next };
    };

    const applyStartOfTurnStatuses = (params: {
      token: TokenState;
      side: "player" | "enemies";
    }): TokenState => {
      const { token, side } = params;
      if (!token.statuses || token.statuses.length === 0) return token;
      let nextToken = { ...token, statuses: [...token.statuses] };
      const remaining: typeof nextToken.statuses = [];

      for (const status of nextToken.statuses) {
        const def = statusTypeById.get(status.id);
        if (def?.damagePerTurnFormula && nextToken.hp > 0) {
          const result = rollDamage(def.damagePerTurnFormula);
          const diceText = result.dice.map(d => d.rolls.join("+")).join(" | ");
          pushDiceLog(
            `Degats (${def.label}) : ${diceText || "0"} + ${result.flatModifier} = ${result.total}`
          );
          const beforeHp = nextToken.hp;
          nextToken.hp = Math.max(0, nextToken.hp - result.total);
          pushLog(`${nextToken.id} subit ${result.total} degats (${def.label}).`);
          recordCombatEvent({
            round,
            phase: side,
            kind: "damage",
            actorId: nextToken.id,
            actorKind: side === "player" ? "player" : "enemy",
            targetId: nextToken.id,
            targetKind: side === "player" ? "player" : "enemy",
            summary: `${nextToken.id} subit ${result.total} degats (${def.label}) (PV ${beforeHp} -> ${nextToken.hp}).`,
            data: {
              statusId: status.id,
              damage: result.total,
              formula: def.damagePerTurnFormula
            }
          });
        }

        if (def?.persistUntilDeath) {
          remaining.push({ ...status });
          continue;
        }
        const nextRemaining = status.remainingTurns - 1;
        if (nextRemaining > 0) {
          remaining.push({ ...status, remainingTurns: nextRemaining });
        } else if (def) {
          pushLog(`${nextToken.id}: etat termine (${def.label}).`);
        }
      }

      nextToken.statuses = remaining;
      return nextToken;
    };

  const collectHazardsFromPath = (params: {
    path: { x: number; y: number }[];
    start?: { x: number; y: number } | null;
  }): { counts: Map<string, number>; defs: Map<string, EffectTypeDefinition> } => {
    const { path, start } = params;
    const counts = new Map<string, number>();
    const defs = new Map<string, EffectTypeDefinition>();
    const effectByCell = new Map<string, EffectInstance[]>();
    const cellKey = (x: number, y: number) => `${x},${y}`;
    const sourceByKey = new Map<string, EffectInstance>();

    for (const effect of effects) {
      const key = `${effect.typeId}:${cellKey(effect.x, effect.y)}`;
      sourceByKey.set(key, effect);
    }

    if (effectTypes.length > 0 && obstacles.length > 0 && mapTerrain.length > 0) {
      const derived = buildEffectsFromObstacles({
        obstacles,
        terrain: mapTerrain,
        grid: mapGrid
      });
      for (const effect of derived) {
        const key = `${effect.typeId}:${cellKey(effect.x, effect.y)}`;
        if (!sourceByKey.has(key)) {
          sourceByKey.set(key, effect);
        }
      }
    }

    for (const effect of sourceByKey.values()) {
      if (effect.active === false) continue;
      const def = effectTypeById.get(effect.typeId);
      if (!def?.hazard?.onTraverse) continue;
      defs.set(effect.typeId, def);
      const key = cellKey(effect.x, effect.y);
      const list = effectByCell.get(key) ?? [];
      list.push(effect);
      effectByCell.set(key, list);
    }

    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      if (i === 0 && start && cell.x === start.x && cell.y === start.y) {
        continue;
      }
      const key = cellKey(cell.x, cell.y);
      const list = effectByCell.get(key);
      if (!list || list.length === 0) continue;
      for (const effect of list) {
        const count = counts.get(effect.typeId) ?? 0;
        counts.set(effect.typeId, count + 1);
      }
    }

    return { counts, defs };
  };

  const buildHazardRollFromPath = (
    path: { x: number; y: number }[],
    start?: { x: number; y: number } | null
  ): PendingHazardRoll | null => {
    if (!path.length && !start) return null;
    const pathCells = path.length > 0 ? path : start ? [start] : [];
    const { counts, defs } = collectHazardsFromPath({ path: pathCells, start });

      let chosenType: string | null = null;
      let chosenCount = 0;
      for (const [typeId, count] of counts.entries()) {
        if (count > chosenCount) {
          chosenType = typeId;
          chosenCount = count;
        }
      }

      if (!chosenType || chosenCount <= 0) return null;
      const def = defs.get(chosenType);
    if (!def?.hazard) return null;
    const formula = scaleDiceFormula(def.hazard.damageFormula, chosenCount);
    if (!formula) return null;
      return {
        id: `hazard-${chosenType}-${Date.now()}`,
        label: def.label,
        formula,
        cells: chosenCount,
        statusRoll: def.hazard.statusRoll
      };
    };

    const applyHazardsToTokenFromPath = (params: {
      token: TokenState;
      path: { x: number; y: number }[];
      start?: { x: number; y: number } | null;
      side: "player" | "enemies";
    }): TokenState => {
      const { token, path, start, side } = params;
      if (!path.length) return token;
      const pathCells = path.length > 0 ? path : start ? [start] : [];
      const { counts, defs } = collectHazardsFromPath({ path: pathCells, start });
      let nextToken = { ...token };

      for (const [typeId, count] of counts.entries()) {
        const def = defs.get(typeId);
        if (!def?.hazard) continue;
        const formula = scaleDiceFormula(def.hazard.damageFormula, count);
        if (!formula) continue;
        const result = rollDamage(formula);
        const diceText = result.dice.map(d => d.rolls.join("+")).join(" | ");
        pushDiceLog(
          `Degats (${def.label}) : ${diceText || "0"} + ${result.flatModifier} = ${result.total}`
        );
        const beforeHp = nextToken.hp;
        nextToken.hp = Math.max(0, nextToken.hp - result.total);
        pushLog(`${nextToken.id} traverse ${def.label}: ${result.total} degats.`);
        recordCombatEvent({
          round,
          phase: side,
          kind: "damage",
          actorId: nextToken.id,
          actorKind: side === "player" ? "player" : "enemy",
          targetId: nextToken.id,
          targetKind: side === "player" ? "player" : "enemy",
          summary: `${nextToken.id} subit ${result.total} degats (${def.label}) (PV ${beforeHp} -> ${nextToken.hp}).`,
          data: {
            hazardId: typeId,
            damage: result.total,
            formula
          }
        });

        if (def.hazard.statusRoll) {
          const roll = rollDie(def.hazard.statusRoll.die);
          const trigger = def.hazard.statusRoll.trigger;
          const statusId = def.hazard.statusRoll.statusId ?? "status";
          pushDiceLog(`Jet d'etat (${statusId}) : d${def.hazard.statusRoll.die} = ${roll.total}`);
          if (roll.total === trigger) {
            nextToken = addStatusToToken(nextToken, statusId);
            pushLog(`${nextToken.id}: etat ${statusId} declenche.`);
            recordCombatEvent({
              round,
              phase: side,
              kind: "status",
              actorId: nextToken.id,
              actorKind: side === "player" ? "player" : "enemy",
              targetId: nextToken.id,
              targetKind: side === "player" ? "player" : "enemy",
              summary: `${nextToken.id} prend l'etat ${statusId}.`,
              data: { statusId }
            });
          }
        }
      }

      return nextToken;
    };

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

            const from = { x: enemy.x, y: enemy.y };
            const destination = path[path.length - 1];
  
            enemy.x = destination.x;
            enemy.y = destination.y;
            enemy.facing = computeFacingTowards(enemy, playerCopy);

            triggerMovementReactions({
              mover: enemy,
              from,
              to: destination,
              playerSnapshot: playerCopy as TokenState,
              enemiesSnapshot: enemiesCopy
            });
  
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
    const aiTurnLogs: string[] = [];
      const refreshedEnemy = applyStartOfTurnStatuses({ token: activeEnemy, side: "enemies" });
      const enemyIndex = enemiesCopy.findIndex(e => e.id === activeEnemyId);
      if (enemyIndex >= 0) {
        enemiesCopy[enemyIndex] = refreshedEnemy;
      }
      if (isTokenDead(refreshedEnemy)) {
        pushLog(`${refreshedEnemy.id} succombe a ses blessures.`);
        recordCombatEvent({
          round,
          phase: "enemies",
          kind: "death",
          actorId: refreshedEnemy.id,
          actorKind: "enemy",
          summary: `${refreshedEnemy.id} s'effondre, hors de combat.`
        });
        setEnemies(enemiesCopy);
        setIsResolvingEnemies(false);
        advanceTurn();
        return;
      }
      const activeEnemyStart = { x: refreshedEnemy.x, y: refreshedEnemy.y };

    const summary = buildEnemyAiSummary();
    const intents = await requestEnemyAiIntents(summary);
    const filtered = intents.filter(i => i.enemyId === activeEnemyId);

    const allTokens: TokenState[] = getTokensOnActiveLevel([
      playerCopy as TokenState,
      ...enemiesCopy
    ]);
    const combatProfile = resolveCombatProfile(refreshedEnemy);
    const memory = getEnemyMemory(refreshedEnemy.id);
    const canSeePlayer =
      areTokensOnSameLevel(refreshedEnemy, playerCopy as TokenState) &&
      canEnemySeePlayer(
        refreshedEnemy,
        playerCopy as TokenState,
        allTokens,
        visionBlockersActive,
        playableCells,
        wallEdges.vision,
        lightLevels,
        mapGrid
      );
    if (canSeePlayer) {
      updateEnemyMemory(refreshedEnemy.id, {
        lastSeenPos: { x: playerCopy.x, y: playerCopy.y },
        lastSeenRound: round
      });
      if (combatProfile.awareness > 0) {
        const approximate = fuzzAlertPosition({ x: playerCopy.x, y: playerCopy.y });
        const existingAlert = getActiveTeamAlert();
        if (!existingAlert || existingAlert.sourceId !== refreshedEnemy.id) {
          broadcastTeamAlert(refreshedEnemy, approximate, 0.7);
        }
      }
    }
    const enemyActionIds =
      Array.isArray(activeEnemy.actionIds) && activeEnemy.actionIds.length
        ? activeEnemy.actionIds
        : ["move", "melee-strike"];

    const getActionById = (id: string) => actionsCatalog.find(a => a.id === id) ?? null;

    const describeActionTarget = (target: ActionTarget): string => {
      if (target.kind === "token") return target.token.id;
      if (target.kind === "cell") return `cell(${target.x},${target.y})`;
      return "aucune cible";
    };

    const tryResolve = async (
      actionId: string,
      target: ActionTarget,
      advantageMode?: AdvantageMode
    ) => {
      const action = getActionById(actionId);
      if (!action) {
        await waitForEnemyTurnResume();
        return { ok: false as const, reason: `Action inconnue: ${actionId}` };
      }
      if (!enemyActionIds.includes(actionId)) {
        await waitForEnemyTurnResume();
        return { ok: false as const, reason: `Action non autorisee pour ${activeEnemy.id}: ${actionId}` };
      }

      const beforePlayerHp = playerCopy.hp;
      const beforeEnemyHp = new Map(enemiesCopy.map(e => [e.id, e.hp]));
      const beforeActorPos = { x: activeEnemy.x, y: activeEnemy.y };

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
          sampleCharacter: characterConfig,
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
        const msg = `[IA] ${activeEnemy.id}: ${action.name} sur ${describeActionTarget(target)} -> echec (${result.reason || "inconnu"}).`;
        pushLog(msg);
        aiTurnLogs.push(msg);
        updateEnemyMemory(activeEnemy.id, {
          lastFailedReason: classifyFailureReason(result.reason),
          lastFailedActionId: action.id
        });
        await waitForEnemyTurnResume();
        return { ok: false as const, reason: result.reason || "Echec de resolution." };
      }

      playerCopy = result.playerAfter;
      for (let i = 0; i < enemiesCopy.length; i++) {
        enemiesCopy[i] = result.enemiesAfter[i] ?? enemiesCopy[i];
      }
      setPlayer(playerCopy);
      setEnemies(enemiesCopy);
      const afterActor = enemiesCopy.find(e => e.id === activeEnemy.id) ?? null;
      if (
        afterActor &&
        action.category === "movement" &&
        (afterActor.x !== beforeActorPos.x || afterActor.y !== beforeActorPos.y)
      ) {
        triggerMovementReactions({
          mover: afterActor,
          from: beforeActorPos,
          to: { x: afterActor.x, y: afterActor.y },
          playerSnapshot: playerCopy as TokenState,
          enemiesSnapshot: enemiesCopy
        });
      }
      const targetDesc = describeActionTarget(target);
      const damageToPlayer = beforePlayerHp - playerCopy.hp;
      let damageToEnemy: number | null = null;
      if (target.kind === "token" && target.token.type === "enemy") {
        const afterHp = enemiesCopy.find(e => e.id === target.token.id)?.hp ?? null;
        const beforeHp = beforeEnemyHp.get(target.token.id) ?? null;
        if (beforeHp !== null && afterHp !== null) {
          damageToEnemy = beforeHp - afterHp;
        }
      }
      const moved =
        activeEnemy.x !== beforeActorPos.x || activeEnemy.y !== beforeActorPos.y;
      const details: string[] = [];
      if (damageToPlayer > 0) details.push(`degats joueur: ${damageToPlayer}`);
      if (damageToEnemy && damageToEnemy > 0) {
        details.push(`degats ${targetDesc}: ${damageToEnemy}`);
      }
      if (moved) details.push(`deplacement -> (${activeEnemy.x},${activeEnemy.y})`);
      const detailText = details.length > 0 ? ` (${details.join(", ")})` : "";
      const okMsg = `[IA] ${activeEnemy.id}: ${action.name} sur ${targetDesc} -> ok${detailText}.`;
      pushLog(okMsg);
      aiTurnLogs.push(okMsg);
      updateEnemyMemory(activeEnemy.id, {
        lastFailedReason: undefined,
        lastFailedActionId: undefined,
        lastEffectiveActionId: action.id
      });
      if (result.logs.length > 0) {
        for (const line of result.logs) {
          aiTurnLogs.push(`[IA] ${activeEnemy.id}: ${line}`);
        }
      }
      if (target.kind === "token" && target.token.type === "player") {
        const didHit = damageToPlayer > 0;
        const message = didHit
          ? action.uiMessageHit || `Vous avez ete touche par ${action.name}.`
          : action.uiMessageMiss || null;
        if (message) {
          showCombatToast(message, didHit ? "hit" : "info");
          suppressCombatToastUntilRef.current = Date.now() + 500;
        }
      }
      await waitForEnemyTurnResume();
      return { ok: true as const, action };
    };

    let usedFallback = false;

    if (filtered.length > 0) {
      const context = buildEnemyActionContext({
        actor: activeEnemy,
        playerSnapshot: playerCopy,
        enemiesSnapshot: enemiesCopy
      });
      let resolvedIntent = false;
      for (const intent of filtered) {
        const action = getActionById(intent.actionId);
        if (!action) continue;
        const style = getActionStyle(action);
        if (style !== "move" && style !== "other") {
          if (!combatProfile.allowedStyles.includes(style as EnemyCombatStyle)) {
            continue;
          }
        }
        const targetSpec = intent.target;
        let target: ActionTarget = { kind: "none" };
        if (targetSpec.kind === "token") {
          const token = allTokens.find(t => t.id === targetSpec.tokenId) ?? null;
          if (token) target = { kind: "token", token };
        } else if (targetSpec.kind === "cell") {
          target = { kind: "cell", x: targetSpec.x, y: targetSpec.y };
        }
        const availability = computeAvailabilityForActor(action, context);
        if (!availability.enabled) continue;
        const validation = validateActionTarget(action, context, target);
        if (!validation.ok) continue;
        const resolved = await tryResolve(
          intent.actionId,
          target,
          intent.advantageMode as AdvantageMode
        );
        if (!resolved.ok) {
          usedFallback = true;
          pushLog(`${activeEnemy.id}: intent IA invalide (${resolved.reason}).`);
          break;
        }
        setAiUsedFallback(false);
        resolvedIntent = true;
        break;
      }
      if (!resolvedIntent) usedFallback = true;
    } else {
      usedFallback = true;
    }

    if (usedFallback) {
      setAiUsedFallback(true);
      const alert = combatProfile.intelligence > 0 ? getActiveTeamAlert() : null;
      const lastSeen = combatProfile.intelligence > 0 ? memory.lastSeenPos ?? null : null;
      const targetPos = canSeePlayer
        ? { x: playerCopy.x, y: playerCopy.y }
        : alert?.position ?? lastSeen;

      if (!canSeePlayer && !targetPos) {
        pushLog(`${activeEnemy.id} ne voit pas le joueur et reste en alerte.`);
      } else {
        const distToPlayer = distanceBetweenTokens(activeEnemy, playerCopy);
        const canMove = enemyActionIds.includes("move");
        const moveRange = typeof activeEnemy.moveRange === "number" ? activeEnemy.moveRange : 3;
        let acted = false;

        const pickBestRetreatCell = (from: { x: number; y: number }) => {
          let best: { x: number; y: number } | null = null;
          let bestDist = -1;
          for (let dx = -moveRange; dx <= moveRange; dx++) {
            for (let dy = -moveRange; dy <= moveRange; dy++) {
              const steps = Math.abs(dx) + Math.abs(dy);
              if (steps === 0 || steps > moveRange) continue;
              const x = from.x + dx;
              const y = from.y + dy;
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

        const shouldMoveFirst =
          combatProfile.intelligence > 0 && memory.lastFailedReason === "out_of_range";

        if (!acted && canSeePlayer && !shouldMoveFirst) {
          const context = buildEnemyActionContext({
            actor: activeEnemy,
            playerSnapshot: playerCopy,
            enemiesSnapshot: enemiesCopy
          });
          let bestAttack: { action: ActionDefinition; score: number } | null = null;
          for (const actionId of enemyActionIds) {
            const action = getActionById(actionId);
            if (!action || action.category !== "attack") continue;
            const style = getActionStyle(action);
            if (style !== "melee" && style !== "ranged" && style !== "support") continue;
            if (!combatProfile.allowedStyles.includes(style as EnemyCombatStyle)) continue;
            const availability = computeAvailabilityForActor(action, context);
            if (!availability.enabled) continue;
            const validation = validateActionTarget(action, context, {
              kind: "token",
              token: playerCopy
            });
            if (!validation.ok) continue;
            const score = scoreActionForEnemy({
              action,
              profile: combatProfile,
              distanceToPlayer: distToPlayer,
              memory
            });
            if (!bestAttack || score > bestAttack.score) {
              bestAttack = { action, score };
            }
          }
          if (bestAttack) {
            const attack = await tryResolve(bestAttack.action.id, {
              kind: "token",
              token: playerCopy
            });
            if (attack.ok) {
              recordCombatEvent({
                round,
                phase: "enemies",
                kind: "enemy_attack",
                actorId: activeEnemy.id,
                actorKind: "enemy",
                targetId: playerCopy.id,
                targetKind: "player",
                summary: `${activeEnemy.id} attaque (${bestAttack.action.name}).`,
                data: { actionId: bestAttack.action.id, fallback: true }
              });
              acted = true;
            }
          }
        }

        if (!acted && canMove && targetPos) {
          const desiredMin = combatProfile.preferredRangeMin;
          const desiredMax = combatProfile.preferredRangeMax;
          const shouldRetreat =
            distToPlayer < desiredMin ||
            (combatProfile.avoidRangeMax !== undefined && distToPlayer <= combatProfile.avoidRangeMax);
          const shouldApproach =
            distToPlayer > desiredMax || memory.lastFailedReason === "out_of_range";
          let destination: { x: number; y: number } | null = null;

          if (shouldRetreat) {
            destination = pickBestRetreatCell({ x: activeEnemy.x, y: activeEnemy.y });
          } else if (shouldApproach) {
            const tokensForPath = getTokensOnActiveLevel(allTokens);
            const path = computePathTowards(
              activeEnemy,
              { x: targetPos.x, y: targetPos.y },
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
            const moved = await tryResolve("move", {
              kind: "cell",
              x: destination.x,
              y: destination.y
            });
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
      }
    }

      const finalEnemy = enemiesCopy.find(e => e.id === activeEnemyId) ?? null;
      if (finalEnemy) {
        const planned = Array.isArray(finalEnemy.plannedPath) ? finalEnemy.plannedPath : [];
        const moved =
          finalEnemy.x !== activeEnemyStart.x || finalEnemy.y !== activeEnemyStart.y;
        const fallbackPath = moved
          ? [activeEnemyStart, { x: finalEnemy.x, y: finalEnemy.y }]
          : [];
        const hazardPath = planned.length > 0 ? planned : fallbackPath;
        if (hazardPath.length > 0) {
          const updatedEnemy = applyHazardsToTokenFromPath({
            token: finalEnemy,
            path: hazardPath,
            start: activeEnemyStart,
            side: "enemies"
          });
          const idx = enemiesCopy.findIndex(e => e.id === activeEnemyId);
          if (idx >= 0) enemiesCopy[idx] = updatedEnemy;
        }
      }

      setPlayer(playerCopy);
      setEnemies(enemiesCopy);

    if (aiTurnLogs.length > 0) {
      pushLog(`[IA] ${activeEnemyId} recap:`);
      for (const line of aiTurnLogs) {
        pushLog(`- ${line}`);
      }
    }

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
  const contextAction = actionContext ? getActionById(actionContext.actionId) : null;
  const contextAvailabilityRaw = contextAction
    ? computeActionAvailability(contextAction)
    : null;
  const contextAvailability =
    actionContext?.stage === "active" &&
    contextAction &&
    validatedActionId === contextAction.id
      ? { enabled: true, reasons: [], details: contextAvailabilityRaw?.details ?? [] }
      : contextAvailabilityRaw;
  const selectedTargetLabel = getSelectedTargetLabel();
  const contextResource = getActionResourceInfo(contextAction);
  const contextNeedsTarget = actionTargetsHostile(contextAction);
  const contextPlan: ActionPlan | null = contextAction
    ? buildActionPlan({
        action: contextAction,
        availability: contextAvailability ?? null,
        stage: actionContext?.stage ?? "draft",
        needsTarget: contextNeedsTarget,
        targetSelected: Boolean(selectedTargetLabel),
        hasAttack: Boolean(contextAction.attack),
        hasDamage: Boolean(contextAction.damage),
        attackRoll,
        damageRoll,
        attackOutcome,
        resource: contextResource
      })
    : null;
  const contextSteps = contextPlan?.steps ?? [];
  const contextComplete =
    actionContext?.stage === "active" &&
    Boolean(contextAction) &&
    (attackOutcome === "miss" ||
      (contextSteps.length === 0
        ? true
        : contextSteps.every(step => step.status === "done")));
  useEffect(() => {
    contextCompleteRef.current = contextComplete;
  }, [contextComplete]);
  const selectedTargetStatuses = useMemo(() => {
    if (!selectedTargetId) return [];
    const target = enemies.find(enemy => enemy.id === selectedTargetId);
    if (!target || !Array.isArray(target.statuses) || target.statuses.length === 0) {
      return [];
    }
    return target.statuses.map(status => {
      const def = statusTypeById.get(status.id);
      return {
        id: status.id,
        label: def?.label ?? status.id,
        remainingTurns: status.remainingTurns,
        sourceId: status.sourceId ?? null,
        isPersistent: Boolean(def?.persistUntilDeath)
      };
    });
  }, [enemies, selectedTargetId, statusTypeById]);

  const isActionInProgress =
    (actionContext?.stage === "active" && Boolean(validatedActionId)) ||
    Boolean(pendingHazardRoll);
  const canInteractWithBoard =
    phase === "player" && !isGameOver && !isTokenDead(player);
  const showResumeAction = isActionInProgress && !actionContextOpen;
  const contextMovement =
    contextAction && isMoveTypeAction(contextAction)
      ? {
          costUsed: selectedPathCost,
          costMax: pathLimit,
          hasPath: selectedPath.length > 0,
          isMoving: interactionMode === "moving",
          canInteract: canInteractWithBoard,
          onSelectPath: handleSelectPathFromContext,
          onValidateMove: handleValidatePath,
          onCancelMove: handleCancelMoveFromWheel
        }
      : null;
  const effectiveAdvantageMode = resolvePlayerAdvantageMode(contextAction);
  const isPlayerTurn = phase === "player";
  const phaseLabel = isPlayerTurn ? "Tour du joueur" : "Tour ennemi";
  const showReactionBanner =
    actionContext?.source === "reaction" || reactionQueue.length > 0;
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
          character={characterConfig}
          weaponTypes={weaponTypes}
          raceTypes={raceTypes}
          classTypes={classTypes}
          subclassTypes={subclassTypes}
          backgroundTypes={backgroundTypes}
          languageTypes={languageTypes}
          toolItems={toolItems}
          objectItems={objectItems}
          armorItems={armorItems}
          onChangeCharacter={setCharacterConfig}
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

  function openActionContextFromWheel(action: ActionDefinition) {
    const anchor = resolveWheelAnchor();
    const anchorX = anchor.x;
    const anchorY = anchor.y;
    if (actions.some(a => a.id === action.id)) {
      setSelectedActionId(action.id);
    }
    setActionContext({ anchorX, anchorY, actionId: action.id, stage: "draft", source: "action" });
    setActionContextOpen(true);
  }

  function resetActionContext() {
    setActionContext(null);
    setActionContextOpen(false);
    setTargetMode("none");
    setAttackOutcome(null);
    setPendingHazardRoll(null);
    setHazardAnchor(null);
    setHazardResolution(null);
  }

  function maybeTriggerActionVisuals(reason: "close" | "finish") {
    if (!actionContext || actionContext.stage !== "active") return;
    const action = getActionById(actionContext.actionId);
    if (!action) return;
    if (!contextCompleteRef.current) return;
    const key = actionContext.cycleId
      ? `cycle:${actionContext.cycleId}`
      : `${action.id}:${round}:${validatedActionId ?? "none"}:${attackOutcome ?? "none"}`;
    if (lastActionVfxKeyRef.current === key) return;
    lastActionVfxKeyRef.current = key;
    void spawnActionVisualEffects(action).then(spawned => {
      if (!spawned && reason === "finish") {
        return;
      }
    });
  }

  function closeActionContext() {
    if ((actionContext?.stage === "active" && validatedActionId) || pendingHazardRoll) {
      if (!pendingHazardRoll) {
        maybeTriggerActionVisuals("close");
      }
      setActionContextOpen(false);
      return;
    }
    resetActionContext();
    startNextReactionFromQueue();
  }

  function openSheetFromWheel() {
    if (!canInteractWithBoard) return;
    setSheetOpen(true);
  }

  function handleFinishAction() {
    maybeTriggerActionVisuals("finish");
    setValidatedActionId(null);
    setAttackRoll(null);
    setDamageRoll(null);
    setAttackOutcome(null);
    setHasRolledAttackForCurrentAction(false);
    resetActionContext();
    startNextReactionFromQueue(true);
  }

  function handleCancelAction() {
    const action = getValidatedAction();
    if (action && isMoveTypeAction(action)) {
      setSelectedPath([]);
      setInteractionMode("idle");
    }
    if (action) {
      const costType = action.actionCost?.actionType;
      const isStandardAction = costType === "action";
      const isBonusAction = costType === "bonus";
      const isReaction = costType === "reaction";
      setTurnActionUsage(prev => ({
        usedActionCount: Math.max(0, prev.usedActionCount - (isStandardAction ? 1 : 0)),
        usedBonusCount: Math.max(0, prev.usedBonusCount - (isBonusAction ? 1 : 0))
      }));
      if (isReaction) {
        setReactionUsage(prev => ({
          ...prev,
          [player.id]: Math.max(0, (prev[player.id] ?? 0) - 1)
        }));
      }
      setActionUsageCounts(prev => ({
        turn: { ...prev.turn, [action.id]: Math.max(0, (prev.turn[action.id] ?? 0) - 1) },
        encounter: {
          ...prev.encounter,
          [action.id]: Math.max(0, (prev.encounter[action.id] ?? 0) - 1)
        }
      }));
    }
    setValidatedActionId(null);
    setAttackRoll(null);
    setDamageRoll(null);
    setAttackOutcome(null);
    setHasRolledAttackForCurrentAction(false);
    setSelectedTargetId(null);
    setSelectedObstacleTarget(null);
    setSelectedWallTarget(null);
    resetActionContext();
    startNextReactionFromQueue(true);
    pushLog("Action annulee.");
  }

  function handleValidateActionFromContext(action: ActionDefinition) {
    if (isMoveTypeAction(action)) {
      const multiplier = action.movement?.pathLimitMultiplier ?? 1;
      let baseLimit = basePathLimit;
      if (action.movement?.modeId) {
        const mode = getMovementModeById(action.movement.modeId) ?? defaultMovementMode;
        const profile = buildMovementProfileFromMode(mode);
        baseLimit = profile.speed;
      }
      const nextBase = Math.max(0, Math.round(baseLimit * multiplier));
      const available = Math.max(0, nextBase - movementSpent);
      if (available <= 0) {
        pushLog("Deplacement impossible: budget de mouvement epuise.");
        return;
      }
    }
    const accepted = handleUseAction(action);
    if (!accepted) return;

    if (isMoveTypeAction(action)) {
      const multiplier = action.movement?.pathLimitMultiplier ?? 1;
      let baseLimit = basePathLimit;
      if (action.movement?.modeId) {
        const mode = getMovementModeById(action.movement.modeId) ?? defaultMovementMode;
        const profile = buildMovementProfileFromMode(mode);
        baseLimit = profile.speed;
        setActiveMovementModeId(mode.id);
        setPlayer(prev => ({
          ...prev,
          movementProfile: profile,
          moveRange: profile.speed,
          combatStats: prev.combatStats
            ? { ...prev.combatStats, moveRange: profile.speed }
            : prev.combatStats
        }));
        setBasePathLimit(profile.speed);
        baseLimit = profile.speed;
      }
      setSelectedPath([]);
      const nextBase = Math.max(0, Math.round(baseLimit * multiplier));
      setBasePathLimit(nextBase);
      setPathLimit(Math.max(0, nextBase - movementSpent));
      setInteractionMode("moving");
    }

    const nextCycleId = actionCycleIdRef.current + 1;
    actionCycleIdRef.current = nextCycleId;
    setActionContext(current =>
      current
        ? { ...current, actionId: action.id, stage: "active", cycleId: nextCycleId }
        : current
    );
    setActionContextOpen(true);
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
    const availability = getInteractionAvailability({
      interaction,
      target,
      player,
      wallSegments,
      obstacles,
      wallTypeById,
      obstacleTypeById,
      canPayCost: canPayInteractionCost,
      getWallDistance: getWallSegmentChebyshevDistance,
      getObstacleDistance: getObstacleChebyshevDistance
    });
    if (!availability.ok) {
      pushLog(`Interaction ${interaction.label}: ${availability.reason ?? "indisponible"}.`);
      return;
    }

    const modForce = getCharacterAbilityMod(characterConfig, "str");
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

    applyInteraction({
      interaction,
      target,
      wallTypeById,
      setWallSegments,
      setObstacles
    });

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

  // Hide action removed; replaced by character sheet.

  const interactionAvailability = interactionContext
    ? getInteractionAvailability({
        interaction: interactionContext.interaction,
        target: interactionContext.target,
        player,
        wallSegments,
        obstacles,
        wallTypeById,
        obstacleTypeById,
        canPayCost: canPayInteractionCost,
        getWallDistance: getWallSegmentChebyshevDistance,
        getObstacleDistance: getObstacleChebyshevDistance
      })
    : null;
  const forceMod = getCharacterAbilityMod(characterConfig, "str");
  const interactionState =
    interactionMode === "interact-select"
      ? interactionMenuItems.length > 0
        ? "menu"
        : "select"
      : "idle";
  const wheelAnchor = resolveWheelAnchor();

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
        <style>{`
          @keyframes texturePulse {
            0% { opacity: 0.55; transform: translateY(0) scale(0.98); }
            50% { opacity: 1; transform: translateY(-2px) scale(1); }
            100% { opacity: 0.55; transform: translateY(0) scale(0.98); }
          }
          @keyframes textureDot {
            0% { transform: translateY(0); opacity: 0.45; }
            50% { transform: translateY(-4px); opacity: 1; }
            100% { transform: translateY(0); opacity: 0.45; }
          }
          @keyframes hpPopupFloat {
            0% { opacity: 0; transform: translate(-50%, -10%) scale(0.9); }
            20% { opacity: 1; transform: translate(-50%, -30%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -110%) scale(1.05); }
          }
          @keyframes reactionToastSlide {
            0% { opacity: 0; transform: translate(-50%, -8px) scale(0.98); }
            15% { opacity: 1; transform: translate(-50%, 0) scale(1); }
            85% { opacity: 1; transform: translate(-50%, 0) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -8px) scale(0.98); }
          }
        `}</style>
        {isTextureLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at 30% 20%, rgba(120,90,30,0.25), transparent 55%), rgba(6,6,10,0.75)",
              backdropFilter: "blur(6px)",
              pointerEvents: "auto"
            }}
          >
            <div
              style={{
                padding: "18px 22px",
                borderRadius: 16,
                background: "rgba(12,12,18,0.94)",
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
                minWidth: 220,
                textAlign: "center",
                animation: "texturePulse 1.6s ease-in-out infinite"
              }}
            >
              <div style={{ fontSize: 12, letterSpacing: 1, fontWeight: 700, opacity: 0.9 }}>
                CHARGEMENT TEXTURES
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 10,
                  marginBottom: 6,
                  fontSize: 20
                }}
              >
                <span style={{ animation: "textureDot 1s ease-in-out infinite" }}>•</span>
                <span style={{ animation: "textureDot 1s ease-in-out infinite", animationDelay: "0.15s" }}>•</span>
                <span style={{ animation: "textureDot 1s ease-in-out infinite", animationDelay: "0.3s" }}>•</span>
              </div>
              {textureLoadingHint && (
                <div style={{ fontSize: 11, opacity: 0.7 }}>{textureLoadingHint}</div>
              )}
            </div>
          </div>
        )}
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
        {showTerrainIds && terrainLegend.entries.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
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
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Legende sols</div>
            {terrainLegend.entries.map(item => (
              <div key={item.id}>
                {item.index} - {item.label} ({item.id})
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
                Clic gauche: roue d&apos;actions ??? Deplacer: clics successifs (max {basePathLimit})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.85)",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontWeight: 700,
                  letterSpacing: 0.2
                }}
              >
                {phaseLabel}
              </span>
              {showReactionBanner && (
                <span
                  style={{
                    fontSize: 12,
                    color: "#0b0b12",
                    background: "#f1c40f",
                    border: "1px solid rgba(255,255,255,0.18)",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontWeight: 900,
                    letterSpacing: 0.6,
                    textTransform: "uppercase"
                  }}
                >
                  Reaction !
                </span>
              )}
            </div>
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
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  zIndex: 35
                }}
              >
                {reactionToast && (
                  <div
                    key={reactionToast.id}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 16,
                      transform: "translateX(-50%)",
                      padding: "10px 18px",
                      borderRadius: 14,
                      fontSize: 18,
                      fontWeight: 900,
                      letterSpacing: 0.4,
                      background:
                        reactionToast.kind === "miss"
                          ? "rgba(46, 204, 113, 0.92)"
                          : reactionToast.kind === "hit"
                            ? "rgba(231, 76, 60, 0.92)"
                            : "rgba(241, 196, 15, 0.92)",
                      color: "#0b0b12",
                      border: "1px solid rgba(255,255,255,0.35)",
                      textShadow: "0 1px 6px rgba(0,0,0,0.35)",
                      boxShadow: "0 12px 35px rgba(0,0,0,0.45)",
                      animation: "reactionToastSlide 3.2s ease-out forwards"
                    }}
                  >
                    {reactionToast.text}
                  </div>
                )}
                {combatToast && (
                  <div
                    key={combatToast.id}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: reactionToast ? 60 : 16,
                      transform: "translateX(-50%)",
                      padding: "10px 18px",
                      borderRadius: 14,
                      fontSize: 18,
                      fontWeight: 900,
                      letterSpacing: 0.4,
                      background:
                        combatToast.kind === "heal"
                          ? "rgba(46, 204, 113, 0.92)"
                          : combatToast.kind === "hit"
                            ? "rgba(231, 76, 60, 0.92)"
                            : "rgba(241, 196, 15, 0.92)",
                      color: "#0b0b12",
                      border: "1px solid rgba(255,255,255,0.35)",
                      textShadow: "0 1px 6px rgba(0,0,0,0.35)",
                      boxShadow: "0 12px 35px rgba(0,0,0,0.45)",
                      animation: "reactionToastSlide 3.2s ease-out forwards"
                    }}
                  >
                    {combatToast.text}
                  </div>
                )}
                {hpPopups.map(popup => (
                  <div
                    key={popup.id}
                    style={{
                      position: "absolute",
                      left: popup.x,
                      top: popup.y,
                      color: popup.color,
                      fontSize: 18,
                      fontWeight: 900,
                      padding: "4px 10px",
                      borderRadius: 10,
                      background: "rgba(8,8,12,0.82)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      textShadow: "0 2px 6px rgba(0,0,0,0.6)",
                      animation: "hpPopupFloat 2.6s ease-out forwards",
                      willChange: "transform, opacity"
                    }}
                  >
                    {popup.text}
                  </div>
                ))}
              </div>
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
                <div
                  style={{
                    width: "100%",
                    height: 1,
                    background: "rgba(255,255,255,0.12)",
                    margin: "2px 0"
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsNarrationOpen(false);
                    setFloatingPanel(current => (current === "effects" ? null : "effects"));
                  }}
                  style={{
                    width: 34,
                    height: 28,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background:
                      floatingPanel === "effects" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.85)",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.4
                  }}
                  title="Effets"
                >
                  FX
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNarrationOpen(false);
                    setFloatingPanel(current => (current === "logs" ? null : "logs"));
                  }}
                  style={{
                    width: 34,
                    height: 28,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background:
                      floatingPanel === "logs" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.85)",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.4
                  }}
                  title="Logs"
                >
                  LOG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFloatingPanel(null);
                    setIsNarrationOpen(prev => !prev);
                  }}
                  style={{
                    position: "relative",
                    width: 34,
                    height: 28,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: isNarrationOpen ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.85)",
                    cursor: "pointer",
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: 0.3
                  }}
                  title="Narration"
                >
                  NAR
                  {narrationUnread > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        minWidth: 16,
                        height: 16,
                        padding: "0 4px",
                        borderRadius: 10,
                        background: "#e74c3c",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 900,
                        lineHeight: "16px",
                        border: "1px solid rgba(255,255,255,0.4)",
                        boxShadow: "0 6px 12px rgba(0,0,0,0.35)"
                      }}
                    >
                      {narrationUnread > 9 ? "9+" : narrationUnread}
                    </span>
                  )}
                </button>
              </div>
              {floatingPanel && (
                <div
                  onMouseDown={event => event.stopPropagation()}
                  style={{
                    position: "absolute",
                    right: 60,
                    top: 12,
                    zIndex: 45,
                    width: 360,
                    maxWidth: "70vw",
                    maxHeight: "60vh",
                    height: "60vh",
                    overflow: "hidden",
                    padding: 10,
                    borderRadius: 12,
                    background: "rgba(10,10,16,0.92)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
                    display: "flex",
                    flexDirection: "column"
                  }}
                >
                  {floatingPanel === "effects" && (
                    <EffectsPanel
                      showVisionDebug={showVisionDebug}
                      showLightOverlay={showLightOverlay}
                      showFogSegments={showFogSegments}
                      showCellIds={showCellIds}
                      showAllLevels={showAllLevels}
                      showTerrainIds={showTerrainIds}
                      showTerrainContours={showTerrainContours}
                      shadowLightAngleDeg={shadowLightAngleDeg}
                      bumpIntensity={bumpIntensity}
                      windSpeed={windSpeed}
                      windStrength={windStrength}
                      bumpDebug={bumpDebug}
                      visionLegend={visionLegend}
                      onShowCircle={handleShowCircleEffect}
                      onShowRectangle={handleShowRectangleEffect}
                      onShowCone={handleShowConeEffect}
                      onToggleVisionDebug={() => setShowVisionDebug(prev => !prev)}
                      onToggleLightOverlay={() => setShowLightOverlay(prev => !prev)}
                      onToggleFogSegments={() => setShowFogSegments(prev => !prev)}
                      onToggleCellIds={() => setShowCellIds(prev => !prev)}
                      onToggleShowAllLevels={() => setShowAllLevels(prev => !prev)}
                      onToggleTerrainIds={() => setShowTerrainIds(prev => !prev)}
                      onToggleTerrainContours={() => setShowTerrainContours(prev => !prev)}
                      onChangeShadowLightAngleDeg={value => setShadowLightAngleDeg(value)}
                      onChangeBumpIntensity={value => setBumpIntensity(value)}
                      onChangeWindSpeed={value => setWindSpeed(value)}
                      onChangeWindStrength={value => setWindStrength(value)}
                      onToggleBumpDebug={() => setBumpDebug(prev => !prev)}
                      onClear={handleClearEffects}
                      fxAnimations={fxAnimations}
                    />
                  )}
                  {floatingPanel === "logs" && <LogPanel log={log} />}
                </div>
              )}
              {isNarrationOpen && (
                <div
                  onMouseDown={event => event.stopPropagation()}
                  style={{
                    position: "absolute",
                    right: 60,
                    top: 12,
                    zIndex: 45,
                    width: 380,
                    maxWidth: "72vw",
                    maxHeight: "70vh",
                    overflow: "hidden"
                  }}
                >
                  <NarrationPanel entries={narrationEntries} />
                </div>
              )}

              {showResumeAction && (
                <div
                  onMouseDown={event => event.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 55,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "rgba(10,10,16,0.92)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.35)"
                  }}
                >
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                    Action en cours
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionContextOpen(true)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.9)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 900
                    }}
                  >
                    Reprendre l&apos;action
                  </button>
                </div>
              )}

              <ActionWheelMenu
                open={isCombatConfigured}
                anchorX={wheelAnchor.x}
                anchorY={wheelAnchor.y}
                size={240}
                canInteractWithBoard={canInteractWithBoard}
                hasCell={Boolean(radialMenu.cell)}
                isResolvingEnemies={isResolvingEnemies}
                blockWheel={isActionInProgress}
                blockEndTurn={showResumeAction}
                actions={actions}
                moveTypes={moveTypes}
                isMoving={interactionMode === "moving"}
                interactionState={interactionState}
                interactionItems={interactionMenuItems}
                interactionPrompt="Selectionner la cible de l'interaction"
                onCancelInteract={handleCancelInteractFromWheel}
                computeActionAvailability={computeActionAvailability}
                onClose={closeRadialMenu}
                onCancelMove={handleCancelMoveFromWheel}
                onNoMoveTypes={() => pushLog("Deplacement: aucun type disponible.")}
                onNoActions={() => pushLog("Action: aucune action disponible.")}
                onInspectCell={handleEnterInspectModeFromWheel}
                onLook={handleEnterLookModeFromWheel}
                onInteract={handleInteractFromWheel}
                onOpenSheet={openSheetFromWheel}
                onEndTurn={() => {
                  handleEndPlayerTurn();
                }}
                onPickAction={openActionContextFromWheel}
              />
              <CharacterSheetWindow
                open={sheetOpen}
                anchorX={0}
                anchorY={0}
                character={characterConfig}
                player={player}
                equippedWeapons={equippedWeapons}
                actionsRemaining={Math.max(
                  0,
                  (player.combatStats?.actionsPerTurn ?? 1) - turnActionUsage.usedActionCount
                )}
                bonusRemaining={Math.max(
                  0,
                  (player.combatStats?.bonusActionsPerTurn ?? 1) - turnActionUsage.usedBonusCount
                )}
                resources={playerResources}
                onClose={() => setSheetOpen(false)}
              />
              <ActionContextWindow
                open={actionContextOpen && (Boolean(actionContext) || Boolean(pendingHazardRoll))}
                anchorX={actionContext?.anchorX ?? hazardAnchor?.anchorX ?? 0}
                anchorY={actionContext?.anchorY ?? hazardAnchor?.anchorY ?? 0}
                stage={actionContext?.stage ?? "active"}
                action={contextAction}
                availability={contextAvailability}
                pendingHazard={pendingHazardRoll}
                hazardResolution={hazardResolution}
                player={player}
                enemies={enemies}
                validatedAction={validatedAction}
                targetMode={targetMode}
                selectedTargetId={selectedTargetId}
                selectedTargetLabel={selectedTargetLabel}
                targetStatuses={selectedTargetStatuses}
                effectiveAdvantageMode={effectiveAdvantageMode}
                plan={contextPlan}
                isComplete={contextComplete}
                movement={contextMovement}
                onFinishHazard={handleFinishHazard}
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
                onFinishAction={handleFinishAction}
                onCancelAction={handleCancelAction}
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

        </div>

    </div>
  );
};












