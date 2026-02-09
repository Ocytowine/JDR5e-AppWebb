import type { ActionAvailability, ActionDefinition } from "./actionTypes";
import type { TokenState } from "../types";
import { isTargetVisible } from "../vision";
import { clamp, distanceBetweenTokens } from "./combatUtils";
import { computePathTowards } from "../pathfinding";
import { GRID_COLS, GRID_ROWS, isCellInsideGrid } from "../boardConfig";
import { type AdvantageMode } from "../dice/roller";
import { compileActionPlan } from "./engine/actionCompile";
import { executePlan } from "./engine/actionExecute";
import { actionDefinitionToActionSpec } from "./engine/actionAdapter";
import { hasLineOfEffect } from "../lineOfSight";
import type { WallSegment } from "./map/walls/types";
import { getHeightAtGrid, type TerrainCell } from "./map/draft";
import { getClosestFootprintCellToPoint } from "./footprint";
import { metersToCells } from "./units";
import { evaluateAllConditions } from "./engine/conditionEval";
import type { ConditionExpr } from "./conditions";

export interface ActionEngineContext {
  round: number;
  phase: "player" | "enemies";
  actor: TokenState;
  player: TokenState;
  enemies: TokenState[];
  blockedMovementCells?: Set<string> | null;
  blockedMovementEdges?: Set<string> | null;
  blockedVisionCells?: Set<string> | null;
  blockedAttackCells?: Set<string> | null;
  wallVisionEdges?: Map<string, WallSegment> | null;
  lightLevels?: number[] | null;
  /**
   * Masque de cases jouables (limites de la battlemap).
   * Si fourni, certaines validations (mouvement/vision) l'utiliseront.
   */
  playableCells?: Set<string> | null;
  /**
   * Grille logique (cols/rows) de la map courante.
   * Si absent, fallback sur `GRID_COLS/GRID_ROWS`.
   */
  grid?: { cols: number; rows: number } | null;
  heightMap?: number[] | null;
  floorIds?: TerrainCell[] | null;
  activeLevel?: number | null;
  /**
   * Optional hook to emit structured combat events (narration buffer, analytics, etc.).
   * The engine stays UI-agnostic and does not import narrationClient directly.
   */
  emitEvent?: (evt: {
    kind: "player_attack" | "enemy_attack" | "move" | "damage";
    actorId: string;
    actorKind: "player" | "enemy";
    targetId?: string | null;
    targetKind?: "player" | "enemy" | null;
    summary: string;
    data?: Record<string, unknown>;
  }) => void;
  /**
   * Player sheet used to resolve modFOR/modDEX/modCON/niveau.
   * Optional because enemies also use the engine.
   */
  sampleCharacter?: {
    niveauGlobal?: number;
    caracs?: {
      force?: { FOR?: number; modFOR?: number };
      dexterite?: { DEX?: number; modDEX?: number };
      constitution?: { CON?: number; modCON?: number };
      intelligence?: { INT?: number; modINT?: number };
      sagesse?: { SAG?: number; modSAG?: number };
      charisme?: { CHA?: number; modCHA?: number };
    };
  };
  /**
   * Resource lookup/spend hooks (optional for now).
   */
  getResourceAmount?: (name: string, pool?: string | null) => number;
  spendResource?: (name: string, pool: string | null, amount: number) => void;
  onLog?: (message: string) => void;
  onModifyPathLimit?: (delta: number) => void;
  onToggleTorch?: () => void;
  onSetKillerInstinctTarget?: (targetId: string) => void;
  onGrantTempHp?: (params: { targetId: string; amount: number; durationTurns?: number | string }) => void;
  onPlayVisualEffect?: (params: {
    effectId: string;
    anchor?: "target" | "self" | "actor";
    offset?: { x: number; y: number };
    orientation?: "to_target" | "to_actor" | "none";
    rotationOffsetDeg?: number;
    durationMs?: number;
  }) => void;
}

export type ActionTarget =
  | { kind: "token"; token: TokenState }
  | { kind: "cell"; x: number; y: number }
  | { kind: "none" };

function areOnSameBaseLevel(
  ctx: ActionEngineContext,
  a: TokenState,
  b: TokenState
): boolean {
  if (!ctx.heightMap || ctx.heightMap.length === 0) return true;
  const cols = ctx.grid?.cols ?? GRID_COLS;
  const rows = ctx.grid?.rows ?? GRID_ROWS;
  const ha = getHeightAtGrid(ctx.heightMap, cols, rows, a.x, a.y);
  const hb = getHeightAtGrid(ctx.heightMap, cols, rows, b.x, b.y);
  return ha === hb;
}


function isHostileTarget(actor: TokenState, targetToken: TokenState): boolean {
  return actor.type !== targetToken.type;
}

function isAllyTarget(actor: TokenState, targetToken: TokenState): boolean {
  return actor.type === targetToken.type;
}

function validateTokenTarget(
  action: ActionDefinition,
  ctx: ActionEngineContext,
  targetToken: TokenState
): { ok: boolean; reason?: string } {
  const actor = ctx.actor;
  const allTokens: TokenState[] = [ctx.player, ...ctx.enemies];

  if (targetToken.hp <= 0) {
    return { ok: false, reason: "La cible est deja a terre." };
  }

  if (!areOnSameBaseLevel(ctx, actor, targetToken)) {
    return { ok: false, reason: "Cible sur un autre niveau." };
  }

  const dist = distanceBetweenTokens(actor, targetToken);
  const range = action.targeting?.range;

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

  if (Array.isArray(action.conditions) && action.conditions.length > 0) {
    const ok = evaluateAllConditions(action.conditions as ConditionExpr[], {
      actor,
      target: targetToken,
      distance: dist,
      phase: ctx.phase,
      getResourceAmount: ctx.getResourceAmount
    });
    if (!ok) {
      const firstReason = action.conditions.find(cond => cond.reason)?.reason;
      return { ok: false, reason: firstReason || "Conditions non remplies." };
    }
  }

  if (action.targeting?.requiresLos) {
    const visible = isTargetVisible(
      actor,
      targetToken,
      allTokens,
      ctx.blockedVisionCells ?? null,
      ctx.playableCells ?? null,
      ctx.wallVisionEdges ?? null,
      ctx.lightLevels ?? null,
      ctx.grid ?? null
    );
    if (!visible) {
      return { ok: false, reason: "Cible hors vision (ligne de vue requise)." };
    }
    const targetCell =
      getClosestFootprintCellToPoint({ x: actor.x, y: actor.y }, targetToken) ??
      { x: targetToken.x, y: targetToken.y };
    const canHit = hasLineOfEffect(
      { x: actor.x, y: actor.y },
      targetCell,
      ctx.blockedAttackCells ?? null,
      ctx.wallVisionEdges ?? null
    );
    if (!canHit) {
      return { ok: false, reason: "Trajectoire bloquee (obstacle entre l'attaquant et la cible)." };
    }
  }

  return { ok: true };
}

export function validateActionTarget(
  action: ActionDefinition,
  ctx: ActionEngineContext,
  target: ActionTarget
): { ok: boolean; reason?: string } {
  const actor = ctx.actor;

  const targeting = action.targeting;
  if (!targeting) return { ok: false, reason: "Action sans ciblage." };

  if (targeting.target === "self") {
    return { ok: true };
  }

  if (targeting.target === "enemy") {
    if (target.kind !== "token" || target.token.type !== "enemy") {
      return { ok: false, reason: "Cible ennemi manquante." };
    }
    return validateTokenTarget(action, ctx, target.token);
  }

  if (targeting.target === "player") {
    const playerToken = target.kind === "token" ? target.token : ctx.player;
    if (!playerToken || playerToken.type !== "player") {
      return { ok: false, reason: "Cible joueur manquante." };
    }
    return validateTokenTarget(action, ctx, playerToken);
  }

  if (targeting.target === "hostile") {
    let targetToken: TokenState | null = null;
    if (target.kind === "token") {
      targetToken = target.token;
    } else if (actor.type === "enemy") {
      targetToken = ctx.player;
    }

    if (!targetToken || !isHostileTarget(actor, targetToken)) {
      return { ok: false, reason: "Cible hostile manquante." };
    }

    return validateTokenTarget(action, ctx, targetToken);
  }

  if (targeting.target === "ally") {
    if (target.kind !== "token") {
      return { ok: false, reason: "Cible allie manquante." };
    }
    if (!isAllyTarget(actor, target.token)) {
      return { ok: false, reason: "Cible allie invalide." };
    }
    return validateTokenTarget(action, ctx, target.token);
  }

  if (targeting.target === "emptyCell" || targeting.target === "cell") {
    if (target.kind !== "cell") {
      return { ok: false, reason: "Cible de case manquante." };
    }
    const cols = ctx.grid?.cols ?? GRID_COLS;
    const rows = ctx.grid?.rows ?? GRID_ROWS;
    if (!isCellInsideGrid(target.x, target.y, cols, rows)) {
      return { ok: false, reason: "Case hors plateau." };
    }
    if (ctx.playableCells && ctx.playableCells.size > 0) {
      const k = `${target.x},${target.y}`;
      if (!ctx.playableCells.has(k)) {
        return { ok: false, reason: "Case hors zone jouable." };
      }
    }
    return { ok: true };
  }

  return { ok: false, reason: "Type de ciblage non supporte." };
}

export function computeAvailabilityForActor(
  action: ActionDefinition,
  ctx: ActionEngineContext
): ActionAvailability {
  const reasons: string[] = [];
  const details: string[] = [];

  // Conditions sans cible (evite d'exiger une cible pour la disponibilite).
  const availabilityConditions = (action.conditions || []).filter(cond => {
    return !["TARGET_ALIVE", "DISTANCE_MAX", "DISTANCE_BETWEEN"].includes(cond.type);
  }) as ConditionExpr[];
  if (availabilityConditions.length > 0) {
    const ok = evaluateAllConditions(availabilityConditions, {
      actor: ctx.actor,
      target: ctx.player,
      phase: ctx.phase,
      getResourceAmount: ctx.getResourceAmount,
      valueLookup: {
        actor: {
          hp: ctx.actor.hp,
          maxHp: ctx.actor.maxHp
        }
      }
    });
    if (!ok) {
      const firstReason = availabilityConditions.find(cond => (cond as any).reason)?.reason;
      reasons.push(firstReason || "Conditions non remplies.");
    }
  }

  // Resource gating (optional).
  const usageResource = action.usage?.resource;
  if (
    ctx.getResourceAmount &&
    usageResource?.name &&
    typeof usageResource.min === "number"
  ) {
    const amount = ctx.getResourceAmount(usageResource.name, usageResource.pool ?? null);
    if (amount < usageResource.min) {
      const poolSuffix = usageResource.pool ? ` (${usageResource.pool})` : "";
      reasons.push(
        `Ressource insuffisante: ${usageResource.name}${poolSuffix} (${amount}/${usageResource.min}).`
      );
    }
  }

  return { enabled: reasons.length === 0, reasons, details };
}

export interface ActionResolutionResult {
  ok: boolean;
  reason?: string;
  logs: string[];
  actorAfter?: TokenState;
  playerAfter?: TokenState;
  enemiesAfter?: TokenState[];
  outcomeKind?: "hit" | "miss" | "crit" | "saveSuccess" | "saveFail";
}

export function resolveActionUnified(
  action: ActionDefinition,
  ctx: ActionEngineContext,
  target: ActionTarget,
  opts?: {
    advantageMode?: AdvantageMode;
    rollOverrides?: {
      attack?: import("../dice/roller").AttackRollResult | null;
      consumeDamageRoll?: () => import("../dice/roller").DamageRollResult | null;
    };
  }
): ActionResolutionResult {
  const logs: string[] = [];
  const log = (m: string) => {
    logs.push(m);
    ctx.onLog?.(m);
  };

  const availability = computeAvailabilityForActor(action, ctx);
  if (!availability.enabled) {
    return { ok: false, reason: availability.reasons.join(" | "), logs };
  }

  const validation = validateActionTarget(action, ctx, target);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason, logs };
  }

  const actor = { ...ctx.actor };
  let player = { ...ctx.player };
  const enemies = ctx.enemies.map(e => ({ ...e }));

  const actionSpec = actionDefinitionToActionSpec(action);
  const plan = compileActionPlan({
    action: actionSpec,
    actor,
    target:
      target.kind === "token"
        ? target.token
        : target.kind === "cell"
        ? { x: target.x, y: target.y }
        : null
  });

  const applyMoveTo = (params: {
    state: { actor: TokenState; player: TokenState; enemies: TokenState[] };
    targetCell: { x: number; y: number };
    maxSteps?: number | null;
  }) => {
    const { state, targetCell } = params;
    const targetX = targetCell.x;
    const targetY = targetCell.y;
    let maxSteps = params.maxSteps ?? null;
    if (typeof maxSteps === "number") {
      maxSteps = metersToCells(maxSteps);
    }
    if (maxSteps === null) {
      maxSteps =
        typeof state.actor.moveRange === "number"
          ? metersToCells(state.actor.moveRange)
          : typeof state.actor.movementProfile?.speed === "number"
          ? metersToCells(state.actor.movementProfile.speed)
          : 3;
    }

    const cols = ctx.grid?.cols ?? GRID_COLS;
    const rows = ctx.grid?.rows ?? GRID_ROWS;
    const clampedX = clamp(targetX, 0, cols - 1);
    const clampedY = clamp(targetY, 0, rows - 1);
    if (!isCellInsideGrid(clampedX, clampedY, cols, rows)) return;
    if (ctx.playableCells && ctx.playableCells.size > 0) {
      const k = `${clampedX},${clampedY}`;
      if (!ctx.playableCells.has(k)) return;
    }

    const tokensForPath: TokenState[] = (() => {
      if (!ctx.heightMap || typeof ctx.activeLevel !== "number") {
        return [state.player as TokenState, ...state.enemies];
      }
      const cols = ctx.grid?.cols ?? GRID_COLS;
      const rows = ctx.grid?.rows ?? GRID_ROWS;
      return [state.player as TokenState, ...state.enemies].filter(t => {
        const baseHeight = getHeightAtGrid(ctx.heightMap as number[], cols, rows, t.x, t.y);
        return baseHeight === ctx.activeLevel;
      });
    })();
    const path = computePathTowards(state.actor, { x: clampedX, y: clampedY }, tokensForPath, {
      maxDistance: Math.max(0, maxSteps),
      allowTargetOccupied: false,
      blockedCells: ctx.blockedMovementCells ?? null,
      wallEdges: ctx.blockedMovementEdges ?? null,
      playableCells: ctx.playableCells ?? null,
      grid: ctx.grid ?? null,
      heightMap: ctx.heightMap ?? null,
      floorIds: ctx.floorIds ?? null,
      activeLevel: ctx.activeLevel ?? null
    });
    state.actor.plannedPath = path;
    if (path.length === 0) return;
    const destination = path[path.length - 1];
    state.actor.x = destination.x;
    state.actor.y = destination.y;
    if (state.actor.type === "enemy") {
      const idx = state.enemies.findIndex(e => e.id === state.actor.id);
      if (idx >= 0) state.enemies[idx] = state.actor;
    } else {
      state.player = state.actor;
    }
  };

  const exec = executePlan({
    plan,
    state: {
      round: ctx.round,
      phase: ctx.phase,
      actor,
      player,
      enemies,
      effects: []
    },
    opts: {
      getResourceAmount: ctx.getResourceAmount,
      spendResource: ctx.spendResource,
      rollOverrides: opts?.rollOverrides,
      onLog: log,
      onMoveTo: applyMoveTo,
      onModifyPathLimit: ctx.onModifyPathLimit,
      onToggleTorch: ctx.onToggleTorch,
      onSetKillerInstinctTarget: ctx.onSetKillerInstinctTarget,
      onGrantTempHp: ctx.onGrantTempHp,
      onPlayVisualEffect: ctx.onPlayVisualEffect
    },
    advantageMode: opts?.advantageMode
  });

  if (!exec.ok) {
    return {
      ok: false,
      reason: exec.interrupted ? "Interruption par reaction." : "Echec de resolution.",
      logs: exec.logs.length ? exec.logs : logs
    };
  }

  player = exec.state.player;
  for (let i = 0; i < enemies.length; i++) {
    enemies[i] = exec.state.enemies[i] ?? enemies[i];
  }

  const actorAfter =
    actor.type === "player"
      ? exec.state.player
      : exec.state.enemies.find(e => e.id === actor.id) ?? actor;

  return {
    ok: true,
    logs: exec.logs.length ? exec.logs : logs,
    actorAfter,
    playerAfter: player,
    enemiesAfter: enemies,
    outcomeKind: exec.outcome?.kind
  };
}
