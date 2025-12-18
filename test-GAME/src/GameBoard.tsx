import React, { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite, Assets, Text } from "pixi.js";
import { sampleCharacter } from "./sampleCharacter";
import type { MovementProfile, TokenState, VisionProfile } from "./types";
import {
  buildTokenSvgDataUrl,
  preloadTokenTextures,
  PLAYER_TOKEN_ID,
  ENEMY_TOKEN_ID
} from "./svgTokenHelper";
import enemyTypesIndex from "../enemy-types/index.json";
import bruteType from "../enemy-types/brute.json";
import archerType from "../enemy-types/archer.json";
import assassinType from "../enemy-types/assassin.json";
import ghostType from "../enemy-types/ghost.json";
import actionsIndex from "../action-game/actions/index.json";
import meleeStrike from "../action-game/actions/melee-strike.json";
import dashAction from "../action-game/actions/dash.json";
import secondWind from "../action-game/actions/second-wind.json";
import throwDagger from "../action-game/actions/throw-dagger.json";
import {
  type BoardEffect,
  generateCircleEffect,
  generateRectangleEffect,
  generateConeEffect
} from "./boardEffects";
import {
  rollAttack,
  rollDamage,
  type AttackRollResult,
  type DamageRollResult,
  type AdvantageMode
} from "./dice/roller";
import {
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  BOARD_BACKGROUND_COLOR,
  BOARD_BACKGROUND_IMAGE_URL,
  gridToScreen,
  screenToGrid,
  isCellInsideBoard
} from "./boardConfig";
import { computePathTowards } from "./pathfinding";
import { getTokenAt } from "./gridUtils";
import {
  computeVisionEffectForToken,
  getEntitiesInVision,
  isTargetVisible
} from "./vision";
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

// -------------------------------------------------------------
// Types for enemy AI and turn system
// -------------------------------------------------------------

type TurnPhase = "player" | "enemies";

type EnemyActionType = "move" | "attack" | "wait";

type TurnKind = "player" | "enemy";

interface TurnEntry {
  id: string;
  kind: TurnKind;
  initiative: number;
}

interface EnemyDecision {
  enemyId: string;
  action: EnemyActionType;
  targetX?: number;
  targetY?: number;
}

interface EnemySummary {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  type?: string;
  aiRole?: string | null;
  moveRange?: number | null;
  attackDamage?: number | null;
}

interface PlayerSummary {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

interface EnemyAiStateSummary {
  round: number;
  phase: TurnPhase;
  grid: { cols: number; rows: number };
  player: PlayerSummary;
  enemies: EnemySummary[];
}

interface SpeechBubbleEntry {
  tokenId: string;
  text: string;
  updatedAtRound: number;
}

type EffectSpecKind = "circle" | "rectangle" | "cone";
interface EffectSpec {
  id: string;
  kind: EffectSpecKind;
  radius?: number;
  width?: number;
  height?: number;
  range?: number;
  direction?: "up" | "down" | "left" | "right";
}

// -------------------------------------------------------------
// Types for player actions loaded from JSON
// -------------------------------------------------------------

type ActionCategory =
  | "attack"
  | "movement"
  | "support"
  | "defense"
  | "item"
  | "reaction"
  | string;
type ActionCostType = "action" | "bonus" | "reaction" | "free" | string;

interface ActionCost {
  actionType: ActionCostType;
  movementCost: number;
}

type TargetingKind = "enemy" | "ally" | "self" | "cell" | "emptyCell" | string;
type RangeShape = "single" | "line" | "cone" | "circle" | "rectangle" | "self" | string;

interface RangeSpec {
  min: number;
  max: number;
  shape: RangeShape;
}

interface TargetingSpec {
  target: TargetingKind;
  range: RangeSpec;
  maxTargets: number;
  requiresLos: boolean;
}

interface ResourceUsage {
  name: string;
  pool?: string | null;
  min?: number | null;
}

interface UsageSpec {
  perTurn: number | null;
  perEncounter: number | null;
  resource?: ResourceUsage | null;
}

interface Condition {
  type: string;
  [key: string]: any;
  reason?: string;
}

interface Effect {
  type: string;
  [key: string]: any;
}

interface AiHints {
  priority?: string;
  successLog?: string;
  failureLog?: string;
}

interface EnemyTypeDefinition {
  id: string;
  label: string;
  description: string;
  aiRole: string;
  speechProfile?: import("./narrationTypes").EnemySpeechProfile;
  baseStats: {
    hp: number;
    moveRange: number;
    attackDamage: number;
    armorClass: number;
    attackRange?: number;
    maxAttacksPerTurn?: number;
  };
  movement?: MovementProfile;
  vision?: VisionProfile;
}

interface ActionDefinition {
  id: string;
  name: string;
  summary?: string;
  category: ActionCategory;
  actionCost: ActionCost;
  targeting: TargetingSpec;
  usage: UsageSpec;
  conditions: Condition[];
  effects: Effect[];
  attack?: {
    bonus: number;
    critRange?: number;
  };
  damage?: {
    formula: string;
    critRule?: "double-dice" | "double-total";
    damageType?: string;
  };
  skillCheck?: {
    formula: string;
  };
  aiHints?: AiHints;
  tags?: string[];
}

interface ActionAvailability {
  enabled: boolean;
  reasons: string[];
  details: string[];
}

const ACTION_MODULES: Record<string, ActionDefinition> = {
  "./melee-strike.json": meleeStrike as ActionDefinition,
  "./dash.json": dashAction as ActionDefinition,
  "./second-wind.json": secondWind as ActionDefinition,
  "./throw-dagger.json": throwDagger as ActionDefinition
};

const ENEMY_TYPE_MODULES: Record<string, EnemyTypeDefinition> = {
  "./brute.json": bruteType as EnemyTypeDefinition,
  "./archer.json": archerType as EnemyTypeDefinition,
  "./assassin.json": assassinType as EnemyTypeDefinition,
  "./ghost.json": ghostType as EnemyTypeDefinition
};

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
          range: 5
        },
    x,
    y,
    hp: base.hp,
    maxHp: base.hp
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isTokenDead(token: TokenState): boolean {
  return token.hp <= 0;
}

function getAttackRangeForToken(token: TokenState): number {
  if (typeof token.attackRange === "number" && token.attackRange > 0) {
    return token.attackRange;
  }
  return 1;
}

function getMaxAttacksForToken(token: TokenState): number {
  if (typeof token.maxAttacksPerTurn === "number" && token.maxAttacksPerTurn > 0) {
    return token.maxAttacksPerTurn;
  }
  return 1;
}

function canEnemySeePlayer(
  enemy: TokenState,
  playerToken: TokenState,
  allTokens: TokenState[]
): boolean {
  if (isTokenDead(enemy) || isTokenDead(playerToken)) return false;
  return isTargetVisible(enemy, playerToken, allTokens);
}

function canEnemyMeleeAttack(
  enemy: { x: number; y: number },
  playerToken: { x: number; y: number }
): boolean {
  return manhattan(enemy, playerToken) <= 1;
}

function canEnemyAttackPlayer(enemy: TokenState, playerToken: TokenState): boolean {
  const range = getAttackRangeForToken(enemy);
  return manhattan(enemy, playerToken) <= range;
}

function computeFacingTowards(
  from: { x: number; y: number },
  to: { x: number; y: number }
): "up" | "down" | "left" | "right" {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

function computeEnemySpawnPosition(index: number): { x: number; y: number } {
  // On remplit colonne par colonne, en partant de la droite,
  // en descendant de haut en bas, sans chevauchement.
  const rows = GRID_ROWS;
  const cols = GRID_COLS;

  const colIndex = Math.floor(index / rows);
  const rowIndex = index % rows;

  const x = Math.max(0, cols - 1 - colIndex);
  const y = rowIndex;

  return { x, y };
}

const ENEMY_CAPABILITIES: { action: EnemyActionType; label: string; color: string }[] = [
  {
    action: "move",
    label: "Se deplacer jusqu'a 3 cases (Manhattan)",
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


// -------------------------------------------------------------
// Main component
// -------------------------------------------------------------

export const GameBoard: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const tokenLayerRef = useRef<Container | null>(null);
  const pathLayerRef = useRef<Graphics | null>(null);
  const speechLayerRef = useRef<Container | null>(null);
  const narrationPendingRef = useRef<boolean>(false);

  const [log, setLog] = useState<string[]>([]);
  const [narrativeLog, setNarrativeLog] = useState<string[]>([]);
  const [speechBubbles, setSpeechBubbles] = useState<SpeechBubbleEntry[]>([]);

  const [player, setPlayer] = useState<TokenState>({
    id: "player-1",
    type: "player",
    x: 0,
    y: Math.floor(GRID_ROWS / 2),
    facing: "right",
    visionProfile: {
      shape: "cone",
      range: 5
    },
    hp: sampleCharacter.pvActuels,
    maxHp: sampleCharacter.pvMax
  });

  const [enemyTypes, setEnemyTypes] = useState<EnemyTypeDefinition[]>([]);
  const [enemies, setEnemies] = useState<TokenState[]>([]);

  const [phase, setPhase] = useState<TurnPhase>("player");
  const [round, setRound] = useState<number>(1);
  const [isResolvingEnemies, setIsResolvingEnemies] = useState<boolean>(false);
  const [hasRolledInitiative, setHasRolledInitiative] = useState<boolean>(false);
  const [playerInitiative, setPlayerInitiative] = useState<number | null>(null);
  const [turnOrder, setTurnOrder] = useState<TurnEntry[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [isCombatConfigured, setIsCombatConfigured] = useState<boolean>(false);
  const [configEnemyCount, setConfigEnemyCount] = useState<number>(3);

  // Player actions loaded from JSON
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

  // Player movement path (limited to 5 cells)
  const [selectedPath, setSelectedPath] = useState<{ x: number; y: number }[]>(
    []
  );
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<"none" | "selecting">("none");

  // Area-of-effect specs attached to the player
  const [effectSpecs, setEffectSpecs] = useState<EffectSpec[]>([]);
  const [showVisionDebug, setShowVisionDebug] = useState<boolean>(false);

  // Debug IA ennemie : dernier état envoyé / décisions / erreur
  const [aiLastState, setAiLastState] =
    useState<EnemyAiStateSummary | null>(null);
  const [aiLastDecisions, setAiLastDecisions] =
      useState<EnemyDecision[] | null>(null);
  const [aiLastError, setAiLastError] = useState<string | null>(null);
  const [aiUsedFallback, setAiUsedFallback] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  function describeEnemyLastDecision(enemyId: string): string {
    if (aiUsedFallback) {
      return "Fallback local : poursuite/attaque basique du joueur";
    }
    if (aiLastDecisions === null) {
      return "IA non appelée pour l'instant";
    }
    const decision = aiLastDecisions.find(d => d.enemyId === enemyId);
    if (!decision) {
      return "Aucune décision reçue pour cet ennemi";
    }
    if (decision.action === "move") {
      const tx = typeof decision.targetX === "number" ? decision.targetX : "?";
      const ty = typeof decision.targetY === "number" ? decision.targetY : "?";
      return `Déplacement vers (${tx}, ${ty})`;
    }
    if (decision.action === "attack") {
      return "Attaque le joueur (distance 1)";
    }
    return "Attend ce tour";
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
        `Initiative: Joueur ${pjTotal} (d20=${pjRoll}, mod=${playerMod}) – le joueur commence.`
      );
    } else {
      pushLog(
        `Initiative: Joueur ${pjTotal} (d20=${pjRoll}, mod=${playerMod}) – ${first.id} commence (initiative ${first.initiative}).`
      );
    }
  }

  function pushLog(message: string) {
    setLog(prev => [message, ...prev].slice(0, 12));
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
      grid: { cols: GRID_COLS, rows: GRID_ROWS },
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
    if (!isCombatConfigured) return;
    if (!hasRolledInitiative && enemies.length > 0) {
      rollInitialInitiativeIfNeeded();
    }
  }, [isCombatConfigured, hasRolledInitiative, enemies.length]);

  useEffect(() => {
    setSpeechBubbles(prev =>
      prev.filter(b => enemies.some(e => e.id === b.tokenId && e.hp > 0))
    );
  }, [enemies]);

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

    setActions(loaded);
    setSelectedActionId(loaded.length ? loaded[0].id : null);
  }, []);

  // -----------------------------------------------------------
  // Tour par tour : entité active (joueur / ennemi)
  // -----------------------------------------------------------

  useEffect(() => {
    if (!isCombatConfigured) return;
    if (!hasRolledInitiative) return;

    const entry = getActiveTurnEntry();
    if (!entry) return;

    if (entry.kind === "player") {
      setPhase("player");
      setTurnActionUsage({ usedAction: false, usedBonus: false });
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
      const dist = manhattan(player, enemy);
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

    const targeting = action.targeting;
    if (!targeting || targeting.target !== "enemy") {
      return {
        ok: false,
        reason: "Cette action ne cible pas un ennemi."
      };
    }

    const dist = manhattan(actor, enemy);
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
      const visible = isTargetVisible(actor, enemy, allTokens);
      if (!visible) {
        return {
          ok: false,
          reason:
            "Cible hors du champ de vision ou derriere un obstacle (ligne de vue requise)."
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
    }

    return {
      enabled: reasons.length === 0,
      reasons,
      details
    };
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
    setValidatedActionId(action.id);
    setAttackRoll(null);
    setDamageRoll(null);
    setHasRolledAttackForCurrentAction(false);
    setTurnActionUsage(prev => ({
      usedAction: prev.usedAction || isStandardAction,
      usedBonus: prev.usedBonus || isBonusAction
    }));
    const hint = action.aiHints?.successLog || "Action validee. Prets pour les jets.";
    pushLog(`${action.name}: ${hint}`);

    if (action.targeting?.target === "enemy") {
      setTargetMode("selecting");
      setSelectedTargetId(null);
      pushLog(
        `Selection de cible: cliquez sur un ennemi sur la grille ou dans la liste.`
      );
    } else {
      setTargetMode("none");
      setSelectedTargetId(null);
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
    if (action.targeting?.target === "enemy") {
      if (!selectedTargetId) {
        pushLog(
          "Aucune cible ennemie selectionnee pour cette action. Selectionnez une cible avant le jet."
        );
        return;
      }
      const target = enemies.find(e => e.id === selectedTargetId);
      if (!target) {
        pushLog("Cible ennemie introuvable ou deja vaincue.");
        return;
      }
      targetArmorClass =
        typeof target.armorClass === "number" ? target.armorClass : null;
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
      action.targeting?.target === "enemy" && selectedTargetId
        ? ` sur ${selectedTargetId}`
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
    if (action.targeting?.target === "enemy") {
      if (!selectedTargetId) {
        pushLog(
          "Aucune cible ennemie selectionnee pour cette action. Selectionnez une cible avant le jet de degats."
        );
        return;
      }
      targetIndex = enemies.findIndex(e => e.id === selectedTargetId);
      if (targetIndex === -1) {
        pushLog("Cible ennemie introuvable ou deja vaincue.");
        return;
      }
      const target = enemies[targetIndex];
      targetArmorClass =
        typeof target.armorClass === "number" ? target.armorClass : null;
    }

    const isCrit = Boolean(attackRoll?.isCrit);

    if (targetArmorClass !== null && action.attack && attackRoll) {
      const totalAttack = attackRoll.total;
      const isHit = totalAttack >= targetArmorClass || attackRoll.isCrit;
      if (!isHit) {
        const targetSuffix =
          action.targeting?.target === "enemy" && selectedTargetId
            ? ` sur ${selectedTargetId}`
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
      action.targeting?.target === "enemy" && selectedTargetId
        ? ` sur ${selectedTargetId}`
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

    const stageX = (localX / bounds.width) * BOARD_WIDTH;
    const stageY = (localY / bounds.height) * BOARD_HEIGHT;

    const { x: gx, y: gy } = screenToGrid(stageX, stageY);
    const targetX = gx;
    const targetY = gy;

    if (!isCellInsideBoard(targetX, targetY)) return;

    // Mode selection de cible pour une action ciblant un ennemi
    if (targetMode === "selecting") {
      const tokens = [player, ...enemies];
      const target = getTokenAt({ x: targetX, y: targetY }, tokens);
      if (!target || target.type !== "enemy") {
        pushLog(`Pas d'ennemi sur (${targetX}, ${targetY}).`);
        return;
      }

      const action = getValidatedAction();
      if (!action) {
        pushLog("Aucune action validee pour selectionner une cible.");
        return;
      }

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
      setTargetMode("none");
      pushLog(`Cible selectionnee: ${target.id}.`);
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

    setSelectedPath(prev => {
      const maxSteps = 5;
      const path = [...prev];

      if (path.length >= maxSteps) {
        pushLog("Limite de 5 cases atteinte pour ce tour.");
        return path;
      }

      let current =
        path.length > 0 ? path[path.length - 1] : { x: player.x, y: player.y };

      if (current.x === targetX && current.y === targetY) return path;

      let cx = current.x;
      let cy = current.y;
      let stepsRemaining = maxSteps - path.length;

      while (cx !== targetX && stepsRemaining > 0) {
        const stepX = Math.sign(targetX - cx);
        const nextX = cx + stepX;
        if (isEnemyAt(nextX, cy)) {
          pushLog(
            `Trajectoire bloquee par un ennemi en (${nextX}, ${cy}).`
          );
          break;
        }
        cx = nextX;
        path.push({ x: cx, y: cy });
        stepsRemaining--;
      }
      while (cy !== targetY && stepsRemaining > 0) {
        const stepY = Math.sign(targetY - cy);
        const nextY = cy + stepY;
        if (isEnemyAt(cx, nextY)) {
          pushLog(
            `Trajectoire bloquee par un ennemi en (${cx}, ${nextY}).`
          );
          break;
        }
        cy = nextY;
        path.push({ x: cx, y: cy });
        stepsRemaining--;
      }

      if (stepsRemaining === 0 && (cx !== targetX || cy !== targetY)) {
        pushLog("Trajectoire tronquee: limite de 5 cases atteinte.");
      } else {
        pushLog(`Trajectoire: ajout de la case (${targetX}, ${targetY}).`);
      }

      return path;
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

    setPlayer(prev => ({
      ...prev,
      x: last.x,
      y: last.y
    }));

    pushLog(
      `Deplacement valide vers (${last.x}, ${last.y}) via ${selectedPath.length} etape(s).`
    );

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
  }

    function handleResetPath() {
      if (phase !== "player") return;
      if (isGameOver) return;
    setSelectedPath([]);
    pushLog("Trajectoire reinitialisee.");
  }

    function handleSetPlayerFacing(direction: "up" | "down" | "left" | "right") {
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
      attackDamage: e.attackDamage ?? null
    }));

    return {
      round,
      phase,
      grid: { cols: GRID_COLS, rows: GRID_ROWS },
      player: playerSummary,
      enemies: enemiesSummary
    };
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
    console.log("[enemy-ai] Envoi état au backend:", state);
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
        throw new Error("Réponse backend invalide (decisions manquant).");
      }

      const sanitized = sanitizeEnemyDecisions(data.decisions);
      console.log("[enemy-ai] Décisions reçues (filtrées):", sanitized);
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
      console.warn("[enemy-ai] Décisions manquantes, utilisation du fallback local.");
      return [];
    }
  }

  function applyEnemyDecisions(decisions: EnemyDecision[]) {
      if (!decisions.length) {
        // Fallback simple: une "IA locale" pour que ça bouge quand même
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

            if (!canEnemySeePlayer(enemy, playerCopy as TokenState, allTokens)) {
              pushLog(
                `${enemy.id} ne voit pas le joueur et reste en alerte (fallback).`
              );
              continue;
            }

            const maxRange =
              typeof enemy.moveRange === "number" ? enemy.moveRange : 3;

          const tokensForPath: TokenState[] = [
            playerCopy as TokenState,
            ...enemiesCopy
          ];

            const path = computePathTowards(
              enemy,
              { x: playerCopy.x, y: playerCopy.y },
              tokensForPath,
              {
                maxDistance: maxRange,
                allowTargetOccupied: true
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
  
            const distToPlayer = manhattan(enemy, playerCopy);
            const attackRange = getAttackRangeForToken(enemy);
  
              if (distToPlayer <= attackRange) {
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
            if (!canEnemySeePlayer(enemy, playerCopy as TokenState, allTokens)) {
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

            const targetX = clamp(tx, 0, GRID_COLS - 1);
            const targetY = clamp(ty, 0, GRID_ROWS - 1);

            const tokensForPath: TokenState[] = [
              playerCopy as TokenState,
              ...enemiesCopy
            ];

            const path = computePathTowards(
              enemy,
              { x: targetX, y: targetY },
              tokensForPath,
              {
                maxDistance: maxRange,
                allowTargetOccupied: true
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

            if (!canEnemySeePlayer(enemy, playerCopy as TokenState, allTokens)) {
              pushLog(
                `${enemy.id} voulait attaquer mais ne voit pas le joueur.`
              );
              continue;
            }

            const distToPlayer = manhattan(enemy, playerCopy);
            const attackRange = getAttackRangeForToken(enemy);

            if (distToPlayer <= attackRange) {
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

        if (!canEnemySeePlayer(enemy, playerCopy as TokenState, allTokens)) {
          pushLog(
            `${enemy.id} ne voit pas le joueur et reste en alerte (fallback).`
          );
          return enemiesCopy;
        }

      const maxRange =
        typeof enemy.moveRange === "number" ? enemy.moveRange : 3;

      const tokensForPath: TokenState[] = [
        playerCopy as TokenState,
        ...enemiesCopy
      ];

      const path = computePathTowards(
        enemy,
        { x: playerCopy.x, y: playerCopy.y },
        tokensForPath,
        {
          maxDistance: maxRange,
          allowTargetOccupied: true
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
  
          const distToPlayer = manhattan(enemy, playerCopy);
          const attackRange = getAttackRangeForToken(enemy);
  
            if (distToPlayer <= attackRange) {
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
  } else {
    // Application des décisions backend pour cet ennemi uniquement
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
            if (!canEnemySeePlayer(enemy, playerCopy as TokenState, allTokens)) {
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

          const targetX = clamp(tx, 0, GRID_COLS - 1);
          const targetY = clamp(ty, 0, GRID_ROWS - 1);

          const tokensForPath: TokenState[] = [
            playerCopy as TokenState,
            ...enemiesCopy
          ];

          const path = computePathTowards(
            enemy,
            { x: targetX, y: targetY },
            tokensForPath,
            {
              maxDistance: maxRange,
              allowTargetOccupied: true
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

            if (!canEnemySeePlayer(enemy, playerCopy as TokenState, allTokens)) {
              pushLog(
                `${enemy.id} voulait attaquer mais ne voit pas le joueur.`
              );
              continue;
            }

            const distToPlayer = manhattan(enemy, playerCopy);
            const attackRange = getAttackRangeForToken(enemy);

            if (distToPlayer <= attackRange) {
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

    const allTokens: TokenState[] = [playerState, ...enemiesState];
    const visible = getEntitiesInVision(enemy, allTokens);

    const alliesVisible = visible
      .filter(t => t.type === "enemy" && t.id !== enemyId && !isTokenDead(t))
      .map(t => t.id);

    const enemiesVisible = visible
      .filter(t => t.type === "player" && !isTokenDead(t))
      .map(t => t.id);

    const canSeePlayerNow = canEnemySeePlayer(enemy, playerState, allTokens);
    const distToPlayer = manhattan(enemy, playerState);
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
    const decisions = await requestEnemyAi(summary);
    const filtered = decisions.filter(d => d.enemyId === activeEnemyId);

    const tokensForVision: TokenState[] = [playerCopy as TokenState, ...enemiesCopy];

    if (filtered.length === 0) {
      setAiUsedFallback(true);
      setAiLastDecisions([]);

      const canSee = canEnemySeePlayer(
        activeEnemy,
        playerCopy as TokenState,
        tokensForVision
      );
      if (!canSee) {
        pushLog(`${activeEnemy.id} ne voit pas le joueur et reste en alerte.`);
      } else {
        const maxRange =
          typeof activeEnemy.moveRange === "number" ? activeEnemy.moveRange : 3;

        const path = computePathTowards(
          activeEnemy,
          { x: playerCopy.x, y: playerCopy.y },
          tokensForVision,
          { maxDistance: maxRange, allowTargetOccupied: true }
        );

        activeEnemy.plannedPath = path;

        if (path.length === 0) {
          pushLog(
            `${activeEnemy.id} ne trouve pas de chemin valide vers le joueur (reste en place).`
          );
        } else {
          const from = { x: activeEnemy.x, y: activeEnemy.y };
          const destination = path[path.length - 1];
          activeEnemy.x = destination.x;
          activeEnemy.y = destination.y;
          activeEnemy.facing = computeFacingTowards(activeEnemy, playerCopy);

          pushLog(
            `${activeEnemy.id} suit un chemin vers (${destination.x}, ${destination.y}).`
          );
          recordCombatEvent({
            round,
            phase: "enemies",
            kind: "move",
            actorId: activeEnemy.id,
            actorKind: "enemy",
            summary: `${activeEnemy.id} se deplace de (${from.x}, ${from.y}) vers (${destination.x}, ${destination.y}).`,
            data: { from, to: destination, fallback: true }
          });

          const distToPlayer = manhattan(activeEnemy, playerCopy);
          const attackRange = getAttackRangeForToken(activeEnemy);

          if (distToPlayer <= attackRange) {
            const baseDamage =
              typeof activeEnemy.attackDamage === "number"
                ? activeEnemy.attackDamage
                : 2;
            const attacks = getMaxAttacksForToken(activeEnemy);
            const totalDamage = baseDamage * attacks;
            const beforeHp = playerCopy.hp;

            playerCopy = {
              ...playerCopy,
              hp: Math.max(0, playerCopy.hp - totalDamage)
            };

            pushLog(
              attacks > 1
                ? `${activeEnemy.id} attaque ${attacks} fois pour ${totalDamage} degats.`
                : `${activeEnemy.id} attaque le joueur pour ${totalDamage} degats.`
            );

            recordCombatEvent({
              round,
              phase: "enemies",
              kind: "enemy_attack",
              actorId: activeEnemy.id,
              actorKind: "enemy",
              targetId: playerCopy.id,
              targetKind: "player",
              summary: `${activeEnemy.id} frappe le heros et inflige ${totalDamage} degats (PV ${beforeHp} -> ${playerCopy.hp}).`,
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
                phase: "enemies",
                kind: "death",
                actorId: playerCopy.id,
                actorKind: "player",
                summary: "Le heros s'effondre sous les coups ennemis.",
                targetId: playerCopy.id,
                targetKind: "player",
                data: { killedBy: activeEnemy.id }
              });
            }
          }
        }
      }
    } else {
      setAiUsedFallback(false);
      setAiLastDecisions(filtered);

      const decision = filtered[0];
      const action = (decision.action || "wait").toLowerCase() as EnemyActionType;

      if (action === "wait") {
        pushLog(`${activeEnemy.id} attend.`);
      } else if (action === "move") {
        const canSee = canEnemySeePlayer(
          activeEnemy,
          playerCopy as TokenState,
          tokensForVision
        );
        if (!canSee) {
          pushLog(`${activeEnemy.id} ne voit pas le joueur et reste en alerte.`);
        } else {
          let tx: number | undefined = decision.targetX;
          let ty: number | undefined = decision.targetY;
          const anyDecision = decision as any;
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
            pushLog(`${activeEnemy.id}: move ignore (cible invalide).`);
          } else {
            const maxRange =
              typeof activeEnemy.moveRange === "number"
                ? activeEnemy.moveRange
                : 3;

            const targetX = clamp(tx, 0, GRID_COLS - 1);
            const targetY = clamp(ty, 0, GRID_ROWS - 1);

            const path = computePathTowards(
              activeEnemy,
              { x: targetX, y: targetY },
              tokensForVision,
              { maxDistance: maxRange, allowTargetOccupied: true }
            );

            activeEnemy.plannedPath = path;
            if (path.length === 0) {
              pushLog(
                `${activeEnemy.id}: aucun trajet valide vers (${targetX}, ${targetY}), reste en place.`
              );
            } else {
              const from = { x: activeEnemy.x, y: activeEnemy.y };
              const destination = path[path.length - 1];
              activeEnemy.x = destination.x;
              activeEnemy.y = destination.y;
              activeEnemy.facing = computeFacingTowards(activeEnemy, playerCopy);
              pushLog(
                `${activeEnemy.id} suit un chemin vers (${destination.x}, ${destination.y}).`
              );
              recordCombatEvent({
                round,
                phase: "enemies",
                kind: "move",
                actorId: activeEnemy.id,
                actorKind: "enemy",
                summary: `${activeEnemy.id} se deplace de (${from.x}, ${from.y}) vers (${destination.x}, ${destination.y}).`,
                data: { from, to: destination }
              });
            }
          }
        }
      } else if (action === "attack") {
        activeEnemy.facing = computeFacingTowards(activeEnemy, playerCopy);

        const canSee = canEnemySeePlayer(
          activeEnemy,
          playerCopy as TokenState,
          tokensForVision
        );
        if (!canSee) {
          pushLog(`${activeEnemy.id} voulait attaquer mais ne voit pas le joueur.`);
        } else {
          const distToPlayer = manhattan(activeEnemy, playerCopy);
          const attackRange = getAttackRangeForToken(activeEnemy);

          if (distToPlayer <= attackRange) {
            const baseDamage =
              typeof activeEnemy.attackDamage === "number"
                ? activeEnemy.attackDamage
                : 2;
            const attacks = getMaxAttacksForToken(activeEnemy);
            const totalDamage = baseDamage * attacks;
            const beforeHp = playerCopy.hp;

            playerCopy = {
              ...playerCopy,
              hp: Math.max(0, playerCopy.hp - totalDamage)
            };

            pushLog(
              attacks > 1
                ? `${activeEnemy.id} effectue ${attacks} attaques et inflige ${totalDamage} degats au joueur.`
                : `${activeEnemy.id} attaque le joueur pour ${totalDamage} degats.`
            );

            recordCombatEvent({
              round,
              phase: "enemies",
              kind: "enemy_attack",
              actorId: activeEnemy.id,
              actorKind: "enemy",
              targetId: playerCopy.id,
              targetKind: "player",
              summary: `${activeEnemy.id} attaque le heros et inflige ${totalDamage} degats (PV ${beforeHp} -> ${playerCopy.hp}).`,
              data: {
                damage: totalDamage,
                attacks,
                playerHpBefore: beforeHp,
                playerHpAfter: playerCopy.hp
              }
            });

            if (playerCopy.hp <= 0 && beforeHp > 0) {
              recordCombatEvent({
                round,
                phase: "enemies",
                kind: "death",
                actorId: playerCopy.id,
                actorKind: "player",
                summary: "Le heros s'effondre sous les coups ennemis.",
                targetId: playerCopy.id,
                targetKind: "player",
                data: { killedBy: activeEnemy.id }
              });
            }
          } else {
            pushLog(`${activeEnemy.id} voulait attaquer mais est trop loin (ignore).`);
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

  // -----------------------------------------------------------
  // Pixi initialisation
  // -----------------------------------------------------------

  useEffect(() => {
    if (!isCombatConfigured) return;
    if (!pixiContainerRef.current || appRef.current) return;

    const app = new Application();
    appRef.current = app;

    let destroyed = false;
    let resizeHandler: (() => void) | null = null;
    let initialized = false;

    const initPixi = async () => {
      await app.init({
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        background: BOARD_BACKGROUND_COLOR,
        antialias: true
      });

      initialized = true;

      await preloadTokenTextures();

      if (destroyed) return;

      const container = pixiContainerRef.current;
      if (!container) return;

      container.appendChild(app.canvas);

      const root = new Container();
      app.stage.addChild(root);

      // Layer 1: background image (optional)
      if (BOARD_BACKGROUND_IMAGE_URL) {
        try {
          const bgTexture = await Assets.load(BOARD_BACKGROUND_IMAGE_URL);
          const bgSprite = new Sprite(bgTexture);
          bgSprite.x = 0;
          bgSprite.y = 0;
          bgSprite.width = BOARD_WIDTH;
          bgSprite.height = BOARD_HEIGHT;
          root.addChild(bgSprite);
        } catch (error) {
          console.warn("Cannot load board background image:", error);
        }
      }

      // Layer 2: isometric grid
      const gridLayer = new Graphics();
      root.addChild(gridLayer);

      const drawGrid = () => {
        gridLayer.clear();

        for (let gy = 0; gy < GRID_ROWS; gy++) {
          for (let gx = 0; gx < GRID_COLS; gx++) {
            if (!isCellInsideBoard(gx, gy)) continue;

            const center = gridToScreen(gx, gy);
            const w = TILE_SIZE;
            const h = TILE_SIZE * 0.5;

            const points = [
              center.x,
              center.y - h / 2,
              center.x + w / 2,
              center.y,
              center.x,
              center.y + h / 2,
              center.x - w / 2,
              center.y
            ];

            const isDark = (gx + gy) % 2 === 0;
            gridLayer
              .poly(points)
              .fill({
                color: isDark ? 0x151522 : 0x1d1d30,
                alpha: 1
              });
          }
        }
      };

      drawGrid();

      // Layer 3: paths and area effects
      const pathLayer = new Graphics();
      root.addChild(pathLayer);
      pathLayerRef.current = pathLayer;

      // Layer 4: tokens
      const tokenLayer = new Container();
      root.addChild(tokenLayer);
      tokenLayerRef.current = tokenLayer;

      // Layer 5: speech bubbles (above tokens)
      const speechLayer = new Container();
      root.addChild(speechLayer);
      speechLayerRef.current = speechLayer;

      const resize = () => {
        const canvas = app.canvas;
        const parent = canvas.parentElement;
        if (!parent) return;
        const scale = Math.min(
          parent.clientWidth / BOARD_WIDTH,
          parent.clientHeight / BOARD_HEIGHT
        );
        canvas.style.transformOrigin = "top left";
        canvas.style.transform = `scale(${scale})`;
      };

      resizeHandler = resize;
      resize();
      window.addEventListener("resize", resize);
    };

    void initPixi();

      return () => {
      destroyed = true;
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      if (initialized && appRef.current) {
        appRef.current.destroy(true);
      }
      appRef.current = null;
      tokenLayerRef.current = null;
        pathLayerRef.current = null;
      speechLayerRef.current = null;
      };
    }, [isCombatConfigured]);

    // Game over si le joueur n'a plus de PV et aucun allié vivant
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

  // -----------------------------------------------------------
  // Layer 4: redraw tokens when state changes
  // -----------------------------------------------------------

  useEffect(() => {
    const tokenLayer = tokenLayerRef.current;
    if (!tokenLayer) return;

    tokenLayer.removeChildren();

    const allTokens: TokenState[] = [player, ...enemies];
    for (const token of allTokens) {
      const tokenContainer = new Container();

      const textureId =
        token.type === "player" ? PLAYER_TOKEN_ID : ENEMY_TOKEN_ID;
        const sprite = Sprite.from(textureId);
        sprite.anchor.set(0.5, 1);
      sprite.width = TILE_SIZE * 0.9;
      sprite.height = TILE_SIZE * 0.9;
      tokenContainer.addChild(sprite);

      const screenPos = gridToScreen(token.x, token.y);
      // Légers offsets pour compenser le viewBox des SVG et mieux coller à la case
        tokenContainer.x = screenPos.x + TILE_SIZE * 0.05;
        tokenContainer.y = screenPos.y;

      tokenLayer.addChild(tokenContainer);
    }
    }, [player, enemies]);
  
    // Apply visual effects on tokens (shadow, death orientation, speech bubbles)
    useEffect(() => {
      const tokenLayer = tokenLayerRef.current;
      if (!tokenLayer) return;

      const allTokens: TokenState[] = [player, ...enemies];

      tokenLayer.children.forEach((child, index) => {
        const token = allTokens[index];
        if (!token) return;
        if (!(child instanceof Container)) return;
        const container = child as Container;

        let sprite: Sprite | null = null;
        for (const c of container.children) {
          if (c instanceof Sprite) {
            sprite = c as Sprite;
            break;
          }
        }
        if (!sprite) return;

        // Remove existing non-sprite children (anciens halos / bulles)
        const toRemove = container.children.filter(c => !(c instanceof Sprite));
        for (const c of toRemove) {
          container.removeChild(c);
        }

          // Halo d'ombre sous le pion
          // Le centre du halo doit toujours coincider avec le centre
          // de la case isometrique (origine du container), sauf si
          // l'entite est morte (pas de halo dans ce cas).
          if (!isTokenDead(token)) {
            const shadow = new Graphics();
            shadow.beginFill(0x000000, 0.4);
            shadow.drawEllipse(0, 0, TILE_SIZE * 0.4, TILE_SIZE * 0.15);
            shadow.endFill();
            container.addChildAt(shadow, 0);
          }

        // Orientation / transparence en fonction de l'etat
        if (isTokenDead(token)) {
          sprite.rotation = Math.PI / 2;
          sprite.alpha = 0.7;
        } else {
          sprite.rotation = 0;
          sprite.alpha = 1;
        }

      });
    }, [player, enemies, speechBubbles]);

    // Draw speech bubbles in a dedicated layer and resolve overlaps.
    useEffect(() => {
      const speechLayer = speechLayerRef.current;
      if (!speechLayer) return;

      speechLayer.removeChildren();

      const allTokens: TokenState[] = [player, ...enemies];
      const bubbleByTokenId = new Map(
        speechBubbles.map(b => [b.tokenId, b] as const)
      );

      type BubbleItem = {
        tokenId: string;
        x: number;
        y: number;
        width: number;
        height: number;
        view: Container;
      };

      const padding = 6;
      const maxWidth = 140;
      const baseOffsetY = TILE_SIZE * 1;

      const items: BubbleItem[] = [];

      for (const token of allTokens) {
        if (token.type !== "enemy") continue;
        if (isTokenDead(token)) continue;
        const bubble = bubbleByTokenId.get(token.id);
        if (!bubble) continue;
        if (!bubble.text.trim()) continue;

        const screenPos = gridToScreen(token.x, token.y);

        const bubbleContainer = new Container();
        const bubbleBg = new Graphics();
        bubbleBg.beginFill(0xffffff, 0.92);

        const textObj = new Text(bubble.text, {
          fontFamily: "Arial",
          fontSize: 11,
          fill: 0x000000,
          align: "center",
          wordWrap: true,
          wordWrapWidth: maxWidth - 10
        });

        const width = Math.min(maxWidth, textObj.width + 10);
        const height = textObj.height + 8;

        bubbleBg.drawRoundedRect(-width / 2, -height, width, height, 7);
        bubbleBg.endFill();

        textObj.x = -textObj.width / 2;
        textObj.y = -height + 4;

        bubbleContainer.addChild(bubbleBg);
        bubbleContainer.addChild(textObj);

        const x = screenPos.x + TILE_SIZE * 0.05;
        const y = screenPos.y - baseOffsetY;

        bubbleContainer.x = x;
        bubbleContainer.y = y;

        speechLayer.addChild(bubbleContainer);

        items.push({
          tokenId: token.id,
          x: x - width / 2,
          y: y - height,
          width,
          height,
          view: bubbleContainer
        });
      }

      // Resolve overlaps by pushing bubbles upward.
      items.sort((a, b) => a.y - b.y);
      const placed: BubbleItem[] = [];

      for (const item of items) {
        let currentY = item.y;
        let tries = 0;

        const overlaps = (a: BubbleItem, bx: number, by: number) => {
          const ax1 = a.x;
          const ay1 = a.y;
          const ax2 = a.x + a.width;
          const ay2 = a.y + a.height;

          const bx1 = bx;
          const by1 = by;
          const bx2 = bx + item.width;
          const by2 = by + item.height;

          return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
        };

        while (tries < 20) {
          const colliding = placed.find(p => overlaps(p, item.x, currentY));
          if (!colliding) break;
          currentY = colliding.y - item.height - padding;
          tries += 1;
        }

        const dy = currentY - item.y;
        if (dy !== 0) {
          item.view.y += dy;
          item.y = currentY;
        }

        placed.push(item);
      }
    }, [player, enemies, speechBubbles]);
  
    // -----------------------------------------------------------
    // Layer 3: draw path and AoE (attached to player)
  // -----------------------------------------------------------

  useEffect(() => {
    const pathLayer = pathLayerRef.current;
    if (!pathLayer) return;

    pathLayer.clear();

    // 1) Compute AoE from specs and draw filled diamonds
    const activeEffects: BoardEffect[] = effectSpecs.map(spec => {
      switch (spec.kind) {
        case "circle":
          return generateCircleEffect(
            spec.id,
            player.x,
            player.y,
            spec.radius ?? 1
          );
        case "rectangle":
          return generateRectangleEffect(
            spec.id,
            player.x,
            player.y,
            spec.width ?? 1,
            spec.height ?? 1
          );
        case "cone":
          return generateConeEffect(
            spec.id,
            player.x,
            player.y,
            spec.range ?? 1,
            spec.direction ?? "right"
          );
        default:
          return { id: spec.id, type: "circle", cells: [] };
      }
    });

    for (const effect of activeEffects) {
      for (const cell of effect.cells) {
        const center = gridToScreen(cell.x, cell.y);
        const w = TILE_SIZE;
        const h = TILE_SIZE * 0.5;

        const points = [
          center.x,
          center.y - h / 2,
          center.x + w / 2,
          center.y,
          center.x,
          center.y + h / 2,
          center.x - w / 2,
          center.y
        ];

        const color =
          effect.type === "circle"
            ? 0x3498db
            : effect.type === "rectangle"
            ? 0x2ecc71
            : 0xe74c3c;

        pathLayer
          .poly(points)
          .fill({
            color,
            alpha: 0.45
          });
      }
    }

    // 2) Debug: champs de vision de chaque entite
    if (showVisionDebug) {
      const allTokens: TokenState[] = [player, ...enemies];
      for (const token of allTokens) {
        const visionEffect = computeVisionEffectForToken(token);
        for (const cell of visionEffect.cells) {
          const center = gridToScreen(cell.x, cell.y);
          const w = TILE_SIZE;
          const h = TILE_SIZE * 0.5;

          const points = [
            center.x,
            center.y - h / 2,
            center.x + w / 2,
            center.y,
            center.x,
            center.y + h / 2,
            center.x - w / 2,
            center.y
          ];

          const color =
            token.type === "player"
              ? 0x2980b9
              : 0xc0392b;

          pathLayer
            .poly(points)
            .fill({
              color,
              alpha: token.type === "player" ? 0.25 : 0.2
            });
        }
      }
    }

    // 3) Highlight occupied cells (player + ennemis)
    const occupiedTokens: TokenState[] = [player, ...enemies];
    for (const token of occupiedTokens) {
      const center = gridToScreen(token.x, token.y);
      const w = TILE_SIZE;
      const h = TILE_SIZE * 0.5;

      const points = [
        center.x,
        center.y - h / 2,
        center.x + w / 2,
        center.y,
        center.x,
        center.y + h / 2,
        center.x - w / 2,
        center.y
      ];

      const color =
        token.type === "player"
          ? 0x2ecc71
          : 0xe74c3c;

      pathLayer
        .poly(points)
        .fill({
          color,
          alpha: 0.2
        });
    }

    // 4) Highlight selected enemy target cell in blue
    if (selectedTargetId) {
      const target = enemies.find(e => e.id === selectedTargetId);
      if (target) {
        const center = gridToScreen(target.x, target.y);
        const w = TILE_SIZE;
        const h = TILE_SIZE * 0.5;

        const points = [
          center.x,
          center.y - h / 2,
          center.x + w / 2,
          center.y,
          center.x,
          center.y + h / 2,
          center.x - w / 2,
          center.y
        ];

        pathLayer
          .poly(points)
          .fill({
            color: 0x3498db,
            alpha: 0.6
          });
      }
    }

    // 5) Highlight last clicked cell with a yellow aura
    if (selectedPath.length > 0) {
      const last = selectedPath[selectedPath.length - 1];
      const center = gridToScreen(last.x, last.y);
      const w = TILE_SIZE;
      const h = TILE_SIZE * 0.5;

      const auraPoints = [
        center.x,
        center.y - h / 2,
        center.x + w / 2,
        center.y,
        center.x,
        center.y + h / 2,
        center.x - w / 2,
        center.y
      ];

      pathLayer
        .poly(auraPoints)
        .fill({
          color: 0xf1c40f,
          alpha: 0.2
        });
    }

    // 6) Draw enemy planned paths
    for (const enemy of enemies) {
      if (!enemy.plannedPath || enemy.plannedPath.length === 0) continue;

      const pathNodes = enemy.plannedPath;
      const first = pathNodes[0];
      const start = gridToScreen(first.x, first.y);

      pathLayer.setStrokeStyle({
        width: 3,
        color: 0xe74c3c,
        alpha: 0.9
      });

      pathLayer.moveTo(start.x, start.y);
      for (const node of pathNodes.slice(1)) {
        const p = gridToScreen(node.x, node.y);
        pathLayer.lineTo(p.x, p.y);
      }
      pathLayer.stroke();
    }

    // 7) Draw player path polyline
    if (selectedPath.length === 0) return;

    pathLayer.setStrokeStyle({
      width: 6,
      color: 0xf1c40f,
      alpha: 1
    });

    const start = gridToScreen(player.x, player.y);
    pathLayer.moveTo(start.x, start.y);

    for (const node of selectedPath) {
      const p = gridToScreen(node.x, node.y);
      pathLayer.lineTo(p.x, p.y);
    }

    pathLayer.stroke();
  }, [player, enemies, selectedPath, effectSpecs, selectedTargetId, showVisionDebug]);

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

  const isPlayerTurn = phase === "player";
  const activeEntry = getActiveTurnEntry();
  const timelineEntries = turnOrder;

    if (!isCombatConfigured) {
      return (
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
        <h1 style={{ marginBottom: 8 }}>Préparation du combat</h1>
        <p style={{ marginBottom: 16, fontSize: 13, maxWidth: 480, textAlign: "center" }}>
          Configurez le combat avant de lancer la grille : nombre d&apos;ennemis,
          puis démarrez pour effectuer les jets d&apos;initiative et entrer en
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
            Taille de la carte : actuellement fixe ({GRID_COLS} x {GRID_ROWS}).
            Un redimensionnement dynamique demandera une refonte de boardConfig.ts.
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
                  createEnemy(i, pick(i), computeEnemySpawnPosition(i))
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
    );
  }

  return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "16px",
          height: "100vh",
          background: "#0b0b12",
          color: "#f5f5f5",
          fontFamily: "system-ui, sans-serif",
          padding: "16px",
          boxSizing: "border-box",
          position: "relative"
        }}
      >
        {isGameOver && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000
            }}
          >
            <div
              style={{
                background: "#141421",
                borderRadius: 12,
                border: "1px solid #f1c40f",
                padding: "24px 32px",
                maxWidth: 360,
                textAlign: "center",
                boxShadow: "0 0 24px rgba(0,0,0,0.6)"
              }}
            >
              <h2 style={{ margin: "0 0 8px" }}>Game Over</h2>
              <p style={{ fontSize: 13, margin: "0 0 16px" }}>
                Le heros est tombe et aucun allie n&apos;est en mesure de continuer.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: "6px 12px",
                  background: "#e67e22",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                Recommencer le combat
              </button>
            </div>
          </div>
        )}
        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              marginBottom: 8,
              padding: "6px 10px",
              background: "#111322",
              borderRadius: 8,
              border: "1px solid #333",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxWidth: "100%"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4
              }}
            >
              <span style={{ fontSize: 12, color: "#b0b8c4" }}>
                Narration du tour
              </span>
              <span style={{ fontSize: 11, color: "#9aa0b5" }}>
                Round {round}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxHeight: 80,
                overflowY: "auto"
              }}
            >
              {narrativeLog.length === 0 && (
                <span style={{ fontSize: 11, color: "#7f8694" }}>
                  En attente d&apos;actions pour raconter le tour...
                </span>
              )}
              {narrativeLog.slice(0, 6).map((line, idx) => (
                <span key={idx} style={{ fontSize: 11, color: "#e0e4ff" }}>
                  - {line}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              marginBottom: 8,
              padding: "6px 10px",
            background: "#111322",
            borderRadius: 8,
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            maxWidth: "100%"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4
            }}
          >
            <span style={{ fontSize: 12, color: "#b0b8c4" }}>
              Ordre d&apos;initiative (round {round})
            </span>
            {activeEntry && (
              <span style={{ fontSize: 11, color: "#f1c40f" }}>
                Tour actuel :{" "}
                {activeEntry.kind === "player" ? "Joueur" : activeEntry.id}
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              overflowX: "auto",
              paddingBottom: 2
            }}
          >
            {timelineEntries.map(entry => {
                const isActive =
                  activeEntry &&
                  entry.id === activeEntry.id &&
                  entry.kind === activeEntry.kind;
                const isPlayer = entry.kind === "player";
                const tokenSvg = buildTokenSvgDataUrl(
                  isPlayer ? "player" : "enemy"
                );
                const tokenState =
                  entry.kind === "player"
                    ? player
                    : enemies.find(e => e.id === entry.id) || null;
                const isDead = tokenState ? isTokenDead(tokenState) : false;
                const token = isPlayer
                  ? { svg: tokenSvg, label: "PJ" }
                  : { svg: tokenSvg, label: entry.id };
                return (
                  <div
                    key={`${entry.kind}-${entry.id}`}
                    style={{
                      display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: 4,
                    borderRadius: 6,
                      border: isActive ? "2px solid #f1c40f" : "1px solid #333",
                      background: isDead ? "#111118" : isActive ? "#1b1b30" : "#101020",
                      minWidth: 48
                    }}
                  >
                  <img
                    src={token.svg}
                    alt={token.label}
                      style={{
                        width: 32,
                        height: 32,
                        objectFit: "contain",
                        filter: isDead
                          ? "grayscale(1)"
                          : isPlayer
                          ? "none"
                          : "grayscale(0.2)"
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        color: isDead ? "#777a8a" : "#d0d6e0",
                        whiteSpace: "nowrap",
                        textDecoration: isDead ? "line-through" : "none"
                      }}
                    >
                    {token.label}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: "#9aa0b5"
                    }}
                  >
                    Init {entry.initiative}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
          <h1 style={{ marginBottom: 8 }}>Mini Donjon (test-GAME)</h1>
        <p style={{ marginBottom: 8 }}>
          Tour par tour simple. Cliquez sur la grille pour definir une
          trajectoire (max 5 cases), validez le déplacement, puis terminez le
          tour pour laisser l&apos;IA des ennemis jouer.
        </p>
          <div
            ref={pixiContainerRef}
            onClick={handleBoardClick}
          style={{
            flex: "1 1 auto",
            border: "1px solid #333",
            overflow: "hidden",
            maxHeight: "min(80vh, 640px)",
            maxWidth: "min(100%, 1024px)"
          }}
        />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleValidatePath}
            style={{
              padding: "4px 8px",
              background:
                isPlayerTurn && selectedPath.length ? "#2ecc71" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor:
                isPlayerTurn && selectedPath.length ? "pointer" : "default"
            }}
            disabled={!isPlayerTurn || selectedPath.length === 0}
          >
            Valider le deplacement
          </button>
          <button
            type="button"
            onClick={handleResetPath}
            style={{
              padding: "4px 8px",
              background: isPlayerTurn ? "#e67e22" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: isPlayerTurn ? "pointer" : "default"
            }}
            disabled={!isPlayerTurn}
          >
            Reinitialiser trajet
          </button>
          <button
            type="button"
            onClick={handleEndPlayerTurn}
            style={{
              padding: "4px 8px",
              background: isPlayerTurn ? "#9b59b6" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: isPlayerTurn ? "pointer" : "default"
            }}
            disabled={!isPlayerTurn || isResolvingEnemies}
          >
            Fin du tour joueur
          </button>
          <button
            type="button"
            onClick={() => handleSetPlayerFacing("up")}
            style={{
              padding: "4px 8px",
              background: isPlayerTurn ? "#34495e" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: isPlayerTurn ? "pointer" : "default",
              fontSize: 11
            }}
            disabled={!isPlayerTurn}
          >
            Regarder haut
          </button>
          <button
            type="button"
            onClick={() => handleSetPlayerFacing("down")}
            style={{
              padding: "4px 8px",
              background: isPlayerTurn ? "#34495e" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: isPlayerTurn ? "pointer" : "default",
              fontSize: 11
            }}
            disabled={!isPlayerTurn}
          >
            Regarder bas
          </button>
          <button
            type="button"
            onClick={() => handleSetPlayerFacing("left")}
            style={{
              padding: "4px 8px",
              background: isPlayerTurn ? "#34495e" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: isPlayerTurn ? "pointer" : "default",
              fontSize: 11
            }}
            disabled={!isPlayerTurn}
          >
            Regarder gauche
          </button>
          <button
            type="button"
            onClick={() => handleSetPlayerFacing("right")}
            style={{
              padding: "4px 8px",
              background: isPlayerTurn ? "#34495e" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: isPlayerTurn ? "pointer" : "default",
              fontSize: 11
            }}
            disabled={!isPlayerTurn}
          >
            Regarder droite
          </button>
          {!isPlayerTurn && (
            <span style={{ fontSize: 12, alignSelf: "center" }}>
              Tour des ennemis en cours...
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          width: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <section
          style={{
            padding: "8px 12px",
            background: "#141421",
            borderRadius: 8,
            border: "1px solid #333"
          }}
        >
          <h2 style={{ margin: "0 0 8px" }}>Etat du combat</h2>
          <div>
            <strong>Round :</strong> {round} |{" "}
            <strong>Phase :</strong> {phase === "player" ? "Joueur" : "Ennemis"}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            <strong>Initiative PJ :</strong>{" "}
            {playerInitiative ?? "en cours..."}{" "}
          </div>
          <div>
            <strong>Nom :</strong> {sampleCharacter.nom.nomcomplet}
          </div>
          <div>
            <strong>Niveau :</strong> {sampleCharacter.niveauGlobal} |{" "}
            <strong>Classe :</strong> {sampleCharacter.classe[1].classeId}
          </div>
          <div>
            <strong>PV :</strong> {player.hp} / {player.maxHp}
          </div>
          <div>
            <strong>CA :</strong> {sampleCharacter.CA}
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>Caracs :</strong>{" "}
            FOR {sampleCharacter.caracs.force.FOR} | DEX{" "}
            {sampleCharacter.caracs.dexterite.DEX} | CON{" "}
            {sampleCharacter.caracs.constitution.CON}
          </div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <strong>Trajectoire :</strong>{" "}
            {selectedPath.length === 0
              ? "aucune"
              : `(${player.x}, ${player.y}) -> ` +
                selectedPath
                  .map(node => `(${node.x}, ${node.y})`)
                  .join(" -> ")}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.85 }}>
            <strong>IA ennemis (debug) :</strong>
            <div>
              Dernier appel :{" "}
              {aiLastState
                ? `round ${aiLastState.round}, phase ${aiLastState.phase}`
                : "aucun"}
            </div>
            <div>
              Décisions reçues :{" "}
              {aiLastDecisions === null
                ? "n/a"
                : `${aiLastDecisions.length} (fallback: ${
                    aiUsedFallback ? "oui" : "non"
                  })`}
            </div>
            {aiLastError && <div>Erreur : {aiLastError}</div>}
          </div>
        </section>

        <section
          style={{
            padding: "8px 12px",
            background: "#151524",
            borderRadius: 8,
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <h2 style={{ margin: "0 0 4px" }}>Ennemis</h2>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
            Chaque ennemi est une entité propre. Capacités IA : déplacement, attaque
            au contact, attente si aucune option.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: "180px",
              overflowY: "auto",
              paddingRight: 4
            }}
          >
            {enemies.map(enemy => (
              <div
                key={enemy.id}
                style={{
                  background: "#0f0f19",
                  border: "1px solid #2a2a3a",
                  borderRadius: 8,
                  padding: "8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8
                  }}
                >
                  <strong style={{ color: "#f5f5f5" }}>{enemy.id}</strong>
                  <span style={{ fontSize: 12, color: "#b0b8c4" }}>
                    PV {enemy.hp} / {enemy.maxHp}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                  Position : ({enemy.x}, {enemy.y})
                </div>
                <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                  Initiative :{" "}
                  {typeof enemy.initiative === "number"
                    ? enemy.initiative
                    : "non definie"}
                </div>
                <div style={{ fontSize: 12, color: "#b0b8c4" }}>
                  Type : {enemy.enemyTypeLabel || enemy.enemyTypeId || "inconnu"}{" "}
                  {enemy.aiRole ? `(role: ${enemy.aiRole})` : ""}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6
                  }}
                >
                  {ENEMY_CAPABILITIES.map(cap => (
                    <span
                      key={`${enemy.id}-${cap.action}`}
                      style={{
                        background: cap.color,
                        color: "#0b0b12",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: 11,
                        fontWeight: 700
                      }}
                    >
                      {cap.action.toUpperCase()}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "#d0d6e0" }}>
                  Ce qu'il peut faire :{" "}
                  {ENEMY_CAPABILITIES.map(cap => cap.label).join(" | ")}
                </div>
                {validatedAction && validatedAction.targeting?.target === "enemy" && (
                  (() => {
                    const validation = validateEnemyTargetForAction(
                      validatedAction,
                      enemy,
                      player,
                      [player, ...enemies]
                    );
                    const canTarget = validation.ok;
                    const isCurrent = selectedTargetId === enemy.id;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (!canTarget) {
                            pushLog(
                              validation.reason ||
                                `Cible ${enemy.id} invalide pour ${validatedAction.name}.`
                            );
                            return;
                          }
                          setSelectedTargetId(enemy.id);
                          setTargetMode("none");
                          pushLog(`Cible selectionnee: ${enemy.id}.`);
                        }}
                        disabled={!canTarget}
                        style={{
                          marginTop: 6,
                          alignSelf: "flex-start",
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: 4,
                          border: "none",
                          cursor: canTarget ? "pointer" : "default",
                          background: canTarget ? "#3498db" : "#555",
                          color: "#fff",
                          opacity: isCurrent ? 1 : 0.9
                        }}
                      >
                        {isCurrent ? "Cible actuelle" : "Cibler avec l'action validee"}
                      </button>
                    );
                  })()
                )}
                <div style={{ fontSize: 12, color: "#9cb2ff" }}>
                  Dernière décision IA : {describeEnemyLastDecision(enemy.id)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
            style={{
              padding: "8px 12px",
              background: "#141421",
              borderRadius: 8,
              border: "1px solid #333",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
          <h2 style={{ margin: "0 0 4px" }}>Actions detaillees</h2>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
            Source: <code>action-game/actions/index.json</code>. Liste chargee et verifiee
            localement (phase, distance).
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: "180px",
                overflowY: "auto",
                paddingRight: 4
              }}
            >
              {actions.map(action => {
                const availability = computeActionAvailability(action);
                const isSelected = selectedAction?.id === action.id;
                const badgeColor =
                  action.actionCost.actionType === "action"
                    ? "#8e44ad"
                    : action.actionCost.actionType === "bonus"
                    ? "#27ae60"
                    : action.actionCost.actionType === "reaction"
                    ? "#e67e22"
                    : "#2980b9";
                const borderColor = isSelected ? "#6c5ce7" : "#2a2a3a";
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => setSelectedActionId(action.id)}
                    style={{
                      textAlign: "left",
                      background: isSelected ? "#1e1e2f" : "#0f0f19",
                      color: "#f5f5f5",
                      border: `1px solid ${borderColor}`,
                      borderRadius: 6,
                      padding: "8px 10px",
                      cursor: "pointer"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: 4,
                        alignItems: "center"
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{action.name}</span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: badgeColor,
                          color: "#fff"
                        }}
                      >
                        {action.actionCost.actionType}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                      {action.summary || action.category}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 4,
                        fontSize: 11,
                        alignItems: "center"
                      }}
                    >
                      <span
                        style={{
                          color: availability.enabled ? "#2ecc71" : "#e74c3c"
                        }}
                      >
                        {availability.enabled
                          ? "Disponible"
                          : availability.reasons[0] || "Bloquee"}
                      </span>
                      <span style={{ color: "#9aa0b5" }}>
                        {describeRange(action.targeting)}
                      </span>
                      <span style={{ color: "#9aa0b5" }}>
                        {describeUsage(action.usage)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {actions.length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Aucune action chargee pour le moment.
                </div>
              )}
            </div>

            {selectedAction && (
              <div
                style={{
                  borderTop: "1px solid #2a2a3a",
                  paddingTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    fontSize: 11
                  }}
                >
                  <span
                    style={{
                      background: "#2d2d40",
                      color: "#d0d4f7",
                      padding: "2px 6px",
                      borderRadius: 4
                    }}
                  >
                    {selectedAction.category}
                  </span>
                  {selectedAction.tags?.slice(0, 4).map(tag => (
                    <span
                      key={tag}
                      style={{
                        background: "#1f2a38",
                        color: "#9bb0d6",
                        padding: "2px 6px",
                        borderRadius: 4
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12 }}>
                  {selectedAction.summary || "Pas de resume."}
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>Cout:</strong> {selectedAction.actionCost.actionType}{" "}
                  | Mouvement {selectedAction.actionCost.movementCost}
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>Portee:</strong> {describeRange(selectedAction.targeting)}
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>Usage:</strong> {describeUsage(selectedAction.usage)}
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>Conditions:</strong>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginTop: 4
                    }}
                  >
                    {selectedAction.conditions.length === 0 && (
                      <span style={{ color: "#9aa0b5" }}>Aucune condition.</span>
                    )}
                    {selectedAction.conditions.map((cond, idx) => (
                      <div key={`${cond.type}-${idx}`} style={{ color: "#cfd3ec" }}>
                        {conditionLabel(cond)}
                        {cond.reason ? ` — ${cond.reason}` : ""}
                      </div>
                    ))}
                    {selectedAvailability && (
                      <div
                        style={{
                          color: selectedAvailability.enabled ? "#2ecc71" : "#e74c3c"
                        }}
                      >
                        Etat:{" "}
                        {selectedAvailability.enabled
                          ? "OK pour ce tour"
                          : selectedAvailability.reasons.join(" | ") || "Bloque"}
                        {selectedAvailability.details.length > 0 && (
                          <div style={{ color: "#9aa0b5", marginTop: 2 }}>
                            {selectedAvailability.details.join(" / ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>Effets:</strong>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginTop: 4
                    }}
                  >
                    {selectedAction.effects.map((effect, idx) => (
                      <div key={`${effect.type}-${idx}`} style={{ color: "#cfd3ec" }}>
                        {effectLabel(effect)}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12 }}>
                  <strong>Hints IA:</strong>{" "}
                  {selectedAction.aiHints?.priority || "n/a"}
                  <div style={{ color: "#9aa0b5" }}>
                    Success: {selectedAction.aiHints?.successLog || "n/a"}
                  </div>
                  <div style={{ color: "#9aa0b5" }}>
                    Failure: {selectedAction.aiHints?.failureLog || "n/a"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => previewActionArea(selectedAction)}
                    style={{
                      padding: "4px 8px",
                      background: "#2980b9",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12
                    }}
                  >
                    Previsualiser
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUseAction(selectedAction)}
                    disabled={!selectedAvailability?.enabled}
                    style={{
                      padding: "4px 8px",
                      background: selectedAvailability?.enabled ? "#2ecc71" : "#555",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: selectedAvailability?.enabled ? "pointer" : "default",
                      fontSize: 12
                    }}
                  >
                    Valider l'action
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {showDicePanel && (
          <section
            style={{
              padding: "8px 12px",
              background: "#141421",
              borderRadius: 8,
              border: "1px solid #333",
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            <h2 style={{ margin: "0 0 4px" }}>Jets de des</h2>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
              Choisir une action, la valider, puis lancer le jet de touche et/ou de
              degats. Mode auto: enchaine touche + degats.
            </p>
            <div style={{ fontSize: 12 }}>
              Action validee :{" "}
              {validatedAction
                ? `${validatedAction.name} (${validatedAction.id})`
                : "aucune (valider une action d'abord)"}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["normal", "advantage", "disadvantage"] as AdvantageMode[]).map(
                mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAdvantageMode(mode)}
                    style={{
                      padding: "4px 8px",
                      background: advantageMode === mode ? "#8e44ad" : "#2c2c3a",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12
                    }}
                  >
                    {mode}
                  </button>
                )
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleRollAttack}
                disabled={!validatedAction?.attack}
                style={{
                  padding: "4px 8px",
                  background: validatedAction?.attack ? "#2980b9" : "#555",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: validatedAction?.attack ? "pointer" : "default",
                  fontSize: 12
                }}
              >
                Lancer jet de touche
              </button>
              <button
                type="button"
                onClick={handleRollDamage}
                disabled={!validatedAction?.damage}
                style={{
                  padding: "4px 8px",
                  background: validatedAction?.damage ? "#27ae60" : "#555",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: validatedAction?.damage ? "pointer" : "default",
                  fontSize: 12
                }}
              >
                Lancer degats
              </button>
              <button
                type="button"
                onClick={handleAutoResolveRolls}
                style={{
                  padding: "4px 8px",
                  background: "#9b59b6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                Mode auto (touche + degats)
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8
              }}
            >
            <div
              style={{
                background: "#101020",
                borderRadius: 6,
                padding: 8,
                border: "1px solid #26263a"
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>
                Jet de touche
              </div>
              {attackRoll ? (
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  d20: {attackRoll.d20.rolls.join(" / ")} → {attackRoll.d20.total}{" "}
                  | bonus {attackRoll.bonus} | total {attackRoll.total}{" "}
                  {attackRoll.isCrit ? "(critique)" : ""}
                </div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Pas encore lance.</div>
              )}
            </div>
            <div
              style={{
                background: "#101020",
                borderRadius: 6,
                padding: 8,
                border: "1px solid #26263a"
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>
                Jet de degats
              </div>
              {damageRoll ? (
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  Des:{" "}
                  {damageRoll.dice.length
                    ? damageRoll.dice.map(d => d.rolls.join("+")).join(" | ")
                    : "—"}{" "}
                  | mod {damageRoll.flatModifier} | total {damageRoll.total}{" "}
                  {damageRoll.isCrit ? "(critique)" : ""}
                </div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Pas encore lance.</div>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12 }}>
            <strong>Logs des jets:</strong>
            <div
              style={{
                marginTop: 4,
                display: "flex",
                flexDirection: "column",
                gap: 2
              }}
            >
              {diceLogs.map((entry, idx) => (
                <div key={idx} style={{ color: "#dfe6ff" }}>
                  - {entry}
                </div>
              ))}
              {diceLogs.length === 0 && (
                <div style={{ color: "#9aa0b5" }}>Aucun jet enregistre.</div>
              )}
            </div>
          </div>
        </section>
        )}

        <section
          style={{
            padding: "8px 12px",
            background: "#141421",
            borderRadius: 8,
            border: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <h2 style={{ margin: "0 0 4px" }}>Zones d&apos;effet (demo)</h2>
          <p style={{ margin: 0, fontSize: 12 }}>
            Ces boutons utilisent les helpers de <code>boardEffects.ts</code>{" "}
            pour dessiner des zones en coordonnees de grille autour du joueur.
          </p>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
          >
            <button
              type="button"
              onClick={handleShowCircleEffect}
              style={{
                padding: "4px 8px",
                background: "#2980b9",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Cercle R=2
            </button>
            <button
              type="button"
              onClick={handleShowRectangleEffect}
              style={{
                padding: "4px 8px",
                background: "#27ae60",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Rectangle 3x3
            </button>
            <button
              type="button"
              onClick={handleShowConeEffect}
              style={{
                padding: "4px 8px",
                background: "#c0392b",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Cone portee 4
            </button>
            <button
              type="button"
              onClick={() => setShowVisionDebug(prev => !prev)}
              style={{
                padding: "4px 8px",
                background: showVisionDebug ? "#f1c40f" : "#555",
                color: "#0b0b12",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              {showVisionDebug ? "Masquer vision" : "Afficher vision"}
            </button>
            <button
              type="button"
              onClick={handleClearEffects}
              style={{
                padding: "4px 8px",
                background: "#7f8c8d",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Effacer zones
            </button>
          </div>
        </section>

        <section
          style={{
            padding: "8px 12px",
            background: "#141421",
            borderRadius: 8,
            border: "1px solid #333",
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <h2 style={{ margin: "0 0 8px" }}>Log</h2>
          <div
            style={{
              flex: "1 1 auto",
              overflowY: "auto",
              fontSize: 12,
              lineHeight: 1.4
            }}
          >
            {log.map((line, idx) => (
              <div key={idx}>- {line}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
