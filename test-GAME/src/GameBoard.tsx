import React, { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite, Assets } from "pixi.js";
import { sampleCharacter } from "./sampleCharacter";
import type { TokenState } from "./types";
import gentilSvg from "../model/gentil.svg";
import mechantSvg from "../model/mechant.svg";
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

// -------------------------------------------------------------
// Types for enemy AI and turn system
// -------------------------------------------------------------

type TurnPhase = "player" | "enemies";

type EnemyActionType = "move" | "attack" | "wait";

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

// -------------------------------------------------------------
// Helpers
// -------------------------------------------------------------

function createEnemy(id: number): TokenState {
  const x = GRID_COLS - 1;
  const y = id;
  return {
    id: `enemy-${id}`,
    type: "enemy",
    x,
    y,
    hp: 6,
    maxHp: 6
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// -------------------------------------------------------------
// Main component
// -------------------------------------------------------------

export const GameBoard: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const tokenLayerRef = useRef<Container | null>(null);
  const pathLayerRef = useRef<Graphics | null>(null);

  const [log, setLog] = useState<string[]>([]);

  const [player, setPlayer] = useState<TokenState>({
    id: "player-1",
    type: "player",
    x: 0,
    y: Math.floor(GRID_ROWS / 2),
    hp: sampleCharacter.pvActuels,
    maxHp: sampleCharacter.pvMax
  });

  const [enemies, setEnemies] = useState<TokenState[]>([
    createEnemy(1),
    createEnemy(3),
    createEnemy(5)
  ]);

  const [phase, setPhase] = useState<TurnPhase>("player");
  const [round, setRound] = useState<number>(1);
  const [isResolvingEnemies, setIsResolvingEnemies] = useState<boolean>(false);

  // Player actions loaded from JSON
  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [validatedActionId, setValidatedActionId] = useState<string | null>(null);
  const [advantageMode, setAdvantageMode] =
    useState<AdvantageMode>("normal");
  const [attackRoll, setAttackRoll] = useState<AttackRollResult | null>(null);
  const [damageRoll, setDamageRoll] = useState<DamageRollResult | null>(null);
  const [diceLogs, setDiceLogs] = useState<string[]>([]);

  // Player movement path (limited to 5 cells)
  const [selectedPath, setSelectedPath] = useState<{ x: number; y: number }[]>(
    []
  );

  // Area-of-effect specs attached to the player
  const [effectSpecs, setEffectSpecs] = useState<EffectSpec[]>([]);

  // Debug IA ennemie : dernier état envoyé / décisions / erreur
  const [aiLastState, setAiLastState] =
    useState<EnemyAiStateSummary | null>(null);
  const [aiLastDecisions, setAiLastDecisions] =
    useState<EnemyDecision[] | null>(null);
  const [aiLastError, setAiLastError] = useState<string | null>(null);
  const [aiUsedFallback, setAiUsedFallback] = useState<boolean>(false);

  function pushLog(message: string) {
    setLog(prev => [message, ...prev].slice(0, 12));
  }

  function pushDiceLog(message: string) {
    setDiceLogs(prev => [message, ...prev].slice(0, 6));
    pushLog(message);
  }

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
    const hint = action.aiHints?.successLog || "Action validee. Prets pour les jets.";
    pushLog(`${action.name}: ${hint}`);
  }

  function getValidatedAction(): ActionDefinition | null {
    if (!validatedActionId) return null;
    return actions.find(a => a.id === validatedActionId) || null;
  }

  function handleRollAttack() {
    const action = getValidatedAction();
    if (!action) {
      pushLog("Aucune action validee pour lancer un jet.");
      return;
    }
    if (!action.attack) {
      pushLog("Cette action ne requiert pas de jet de touche.");
      return;
    }
    const result = rollAttack(
      action.attack.bonus,
      advantageMode,
      action.attack.critRange ?? 20
    );
    setAttackRoll(result);
    setDamageRoll(null);
    const rollsText =
      result.mode === "normal"
        ? `${result.d20.total}`
        : `${result.d20.rolls.join(" / ")} -> ${result.d20.total}`;
    pushDiceLog(
      `Jet de touche (${action.name}) : ${rollsText} + ${result.bonus} = ${result.total}${
        result.isCrit ? " (critique!)" : ""
      }`
    );
  }

  function handleRollDamage() {
    const action = getValidatedAction();
    if (!action) {
      pushLog("Aucune action validee pour lancer un jet.");
      return;
    }
    if (!action.damage) {
      pushLog("Cette action ne requiert pas de jet de degats.");
      return;
    }
    const isCrit = Boolean(attackRoll?.isCrit);
    const result = rollDamage(action.damage.formula, {
      isCrit,
      critRule: action.damage.critRule
    });
    setDamageRoll(result);
    const diceText = result.dice
      .map(d => d.rolls.join("+"))
      .join(" | ");
    pushDiceLog(
      `Degats (${action.name}) : ${diceText || "0"} + ${
        result.flatModifier
      } = ${result.total}${isCrit ? " (critique)" : ""}`
    );
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
        cx += Math.sign(targetX - cx);
        path.push({ x: cx, y: cy });
        stepsRemaining--;
      }
      while (cy !== targetY && stepsRemaining > 0) {
        cy += Math.sign(targetY - cy);
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
    if (selectedPath.length === 0) return;

    const last = selectedPath[selectedPath.length - 1];

    setPlayer(prev => ({
      ...prev,
      x: last.x,
      y: last.y
    }));

    pushLog(
      `Deplacement valide vers (${last.x}, ${last.y}) via ${selectedPath.length} etape(s).`
    );

    setSelectedPath([]);
  }

  function handleResetPath() {
    if (phase !== "player") return;
    setSelectedPath([]);
    pushLog("Trajectoire reinitialisee.");
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
      maxHp: e.maxHp
    }));

    return {
      round,
      phase,
      grid: { cols: GRID_COLS, rows: GRID_ROWS },
      player: playerSummary,
      enemies: enemiesSummary
    };
  }

  async function requestEnemyAi(
    state: EnemyAiStateSummary
  ): Promise<EnemyDecision[]> {
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

      setAiLastDecisions(data.decisions);
      return data.decisions;
    } catch (error) {
      console.warn("[enemy-ai] Erreur lors de la requete IA:", error);
      setAiLastError(
        error instanceof Error ? error.message : String(error ?? "unknown")
      );
      setAiLastDecisions(null);
      setAiUsedFallback(true);
      return [];
    }
  }

  function applyEnemyDecisions(decisions: EnemyDecision[]) {
    if (!decisions.length) {
      // Fallback simple: une "IA locale" pour que ça bouge quand même
      setAiUsedFallback(true);
      setAiLastDecisions([]);
      setEnemies(prev => {
        return prev.map(enemy => {
          const dx = player.x > enemy.x ? 1 : player.x < enemy.x ? -1 : 0;
          const dy = player.y > enemy.y ? 1 : player.y < enemy.y ? -1 : 0;

          const newX = clamp(enemy.x + dx, 0, GRID_COLS - 1);
          const newY = clamp(enemy.y + dy, 0, GRID_ROWS - 1);

          if (newX === player.x && newY === player.y) {
            setPlayer(prevPlayer => ({
              ...prevPlayer,
              hp: Math.max(0, prevPlayer.hp - 2)
            }));
            pushLog(`${enemy.id} attaque le joueur pour 2 degats (fallback).`);
          } else {
            pushLog(`${enemy.id} avance vers (${newX}, ${newY}).`);
          }

          return { ...enemy, x: newX, y: newY };
        });
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

        const action = (rawDecision.action || "wait").toLowerCase() as EnemyActionType;

        if (action === "wait") {
          pushLog(`${enemy.id} attend.`);
          continue;
        }

        if (action === "move") {
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

          let targetX = clamp(tx, 0, GRID_COLS - 1);
          let targetY = clamp(ty, 0, GRID_ROWS - 1);

          const dist = manhattan(enemy, { x: targetX, y: targetY });
          if (dist > 3) {
            const dx = clamp(targetX - enemy.x, -3, 3);
            const dy = clamp(targetY - enemy.y, -3, 3);
            targetX = clamp(
              enemy.x + Math.sign(dx) * Math.min(Math.abs(dx), 3),
              0,
              GRID_COLS - 1
            );
            targetY = clamp(
              enemy.y + Math.sign(dy) * Math.min(Math.abs(dy), 3),
              0,
              GRID_ROWS - 1
            );
          }

          enemy.x = targetX;
          enemy.y = targetY;
          pushLog(`${enemy.id} se deplace vers (${targetX}, ${targetY}).`);
          continue;
        }

        if (action === "attack") {
          const distToPlayer = manhattan(enemy, playerCopy);
          if (distToPlayer <= 1) {
            const damage = 2;
            playerCopy = {
              ...playerCopy,
              hp: Math.max(0, playerCopy.hp - damage)
            };
            pushLog(`${enemy.id} attaque le joueur pour ${damage} degats.`);
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

  async function runEnemyTurn() {
    setIsResolvingEnemies(true);

    setSelectedPath([]);
    setEffectSpecs([]);

    const summary = buildEnemyAiSummary();
    const decisions = await requestEnemyAi(summary);
    applyEnemyDecisions(decisions);

    setIsResolvingEnemies(false);
    setPhase("player");
    setRound(prev => prev + 1);
  }

  function handleEndPlayerTurn() {
    if (phase !== "player") return;
    setPhase("enemies");
    pushLog(`Fin du tour joueur (round ${round}). Tour des ennemis...`);
    void runEnemyTurn();
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

      await Assets.load([gentilSvg, mechantSvg]);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------
  // Layer 4: redraw tokens when state changes
  // -----------------------------------------------------------

  useEffect(() => {
    const tokenLayer = tokenLayerRef.current;
    if (!tokenLayer) return;

    tokenLayer.removeChildren();

    const allTokens: TokenState[] = [player, ...enemies];
    for (const token of allTokens) {
      const textureUrl = token.type === "player" ? gentilSvg : mechantSvg;

      const tokenContainer = new Container();

      const sprite = Sprite.from(textureUrl);
      sprite.anchor.set(0.5);
      sprite.width = TILE_SIZE * 0.9;
      sprite.height = TILE_SIZE * 0.9;
      sprite.tint = 0xffffff;
      tokenContainer.addChild(sprite);

      const screenPos = gridToScreen(token.x, token.y);
      // Légers offsets pour compenser le viewBox des SVG et mieux coller à la case
      tokenContainer.x = screenPos.x + TILE_SIZE * 0.05;
      tokenContainer.y = screenPos.y - TILE_SIZE * 0.1;

      tokenLayer.addChild(tokenContainer);
    }
  }, [player, enemies]);

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

    // 2) Highlight last clicked cell with a yellow aura
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

    // 3) Draw path polyline
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
  }, [player, selectedPath, effectSpecs]);

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------

  const selectedAction =
    actions.find(action => action.id === selectedActionId) || actions[0] || null;
  const selectedAvailability = selectedAction
    ? computeActionAvailability(selectedAction)
    : null;
  const validatedAction = getValidatedAction();

  const isPlayerTurn = phase === "player";

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
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "center"
        }}
      >
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
            Choisir une action, la valider, puis lancer le jet de touche et/ou de degats. Mode auto: enchaine touche + degats.
          </p>
          <div style={{ fontSize: 12 }}>
            Action validee :{" "}
            {validatedAction
              ? `${validatedAction.name} (${validatedAction.id})`
              : "aucune (valider une action d'abord)"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["normal", "advantage", "disadvantage"] as AdvantageMode[]).map(mode => (
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
            ))}
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
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
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
