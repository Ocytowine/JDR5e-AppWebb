import type { ActionAvailability, ActionDefinition } from "./actionTypes";
import type { TokenState, TokenType } from "../types";
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
import { isEdgeBlockedForMovement } from "./map/walls/runtime";
import { getClosestFootprintCellToPoint } from "./footprint";
import { metersToCells } from "./units";
import { evaluateAllConditions } from "./engine/conditionEval";
import type { ConditionExpr, EnginePhase } from "./conditions";
import { getWeaponLoadingUsageKey } from "./weaponRules";

export interface ActionEngineContext {
  round: number;
  phase: "player" | "enemies";
  enginePhase?: EnginePhase;
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
  getSlotAmount?: (slot: string, level?: number) => number;
  usage?: {
    turn?: Record<string, number>;
    round?: Record<string, number>;
    combat?: Record<string, number>;
  };
  reactionAvailable?: boolean;
  concentrating?: boolean;
  surprised?: boolean;
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
  spawnEntity?: (params: {
    entityTypeId: string;
    x: number;
    y: number;
    ownerId: string;
    ownerType: TokenType;
  }) => TokenState | null;
  despawnEntity?: (entityId: string) => void;
  controlSummon?: (params: { entityId: string; ownerId: string }) => void;
}

export type ActionTarget =
  | { kind: "token"; token: TokenState }
  | { kind: "tokens"; tokens: TokenState[] }
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

function getLightAtToken(ctx: ActionEngineContext, token: TokenState): number | null {
  if (!ctx.lightLevels || ctx.lightLevels.length === 0) return null;
  const cols = ctx.grid?.cols ?? GRID_COLS;
  const idx = token.y * cols + token.x;
  const value = ctx.lightLevels[idx];
  return Number.isFinite(value) ? value : null;
}

function isInLight(ctx: ActionEngineContext, token: TokenState): boolean | null {
  const value = getLightAtToken(ctx, token);
  if (value === null) return null;
  return value > 0;
}

function isCellAllowed(params: {
  ctx: ActionEngineContext;
  state: { player: TokenState; enemies: TokenState[] };
  x: number;
  y: number;
  excludeIds?: string[];
}): boolean {
  const { ctx, state, x, y, excludeIds } = params;
  const cols = ctx.grid?.cols ?? GRID_COLS;
  const rows = ctx.grid?.rows ?? GRID_ROWS;
  if (!isCellInsideGrid(x, y, cols, rows)) return false;
  if (ctx.playableCells && ctx.playableCells.size > 0) {
    const key = `${x},${y}`;
    if (!ctx.playableCells.has(key)) return false;
  }
  if (ctx.blockedMovementCells && ctx.blockedMovementCells.size > 0) {
    const key = `${x},${y}`;
    if (ctx.blockedMovementCells.has(key)) return false;
  }
  if (ctx.heightMap && typeof ctx.activeLevel === "number") {
    const h = getHeightAtGrid(ctx.heightMap, cols, rows, x, y);
    if (h !== ctx.activeLevel) return false;
  }
  const occupied = [state.player, ...state.enemies].some(
    token => !excludeIds?.includes(token.id) && token.x === x && token.y === y
  );
  if (occupied) return false;
  return true;
}

function updateTokenPosition(params: {
  state: { player: TokenState; enemies: TokenState[] };
  token: TokenState;
  x: number;
  y: number;
}) {
  const { state, token, x, y } = params;
  token.x = x;
  token.y = y;
  if (token.id === state.player.id) {
    state.player = token;
    return;
  }
  const idx = state.enemies.findIndex(e => e.id === token.id);
  if (idx >= 0) state.enemies[idx] = token;
}

function getTokensForPath(ctx: ActionEngineContext, state: { player: TokenState; enemies: TokenState[] }) {
  if (!ctx.heightMap || typeof ctx.activeLevel !== "number") {
    return [state.player, ...state.enemies];
  }
  const cols = ctx.grid?.cols ?? GRID_COLS;
  const rows = ctx.grid?.rows ?? GRID_ROWS;
  return [state.player, ...state.enemies].filter(token => {
    const baseHeight = getHeightAtGrid(ctx.heightMap as number[], cols, rows, token.x, token.y);
    return baseHeight === ctx.activeLevel;
  });
}

function applyForcedMove(params: {
  ctx: ActionEngineContext;
  state: { player: TokenState; enemies: TokenState[] };
  token: TokenState;
  to: { x: number; y: number };
}) {
  const { ctx, state, token, to } = params;
  const dx = to.x - token.x;
  const dy = to.y - token.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return;

  const tokensForPath = getTokensForPath(ctx, state);
  const path = computePathTowards(token, { x: to.x, y: to.y }, tokensForPath, {
    maxDistance: Math.max(0, steps),
    allowTargetOccupied: false,
    blockedCells: ctx.blockedMovementCells ?? null,
    wallEdges: ctx.blockedMovementEdges ?? null,
    playableCells: ctx.playableCells ?? null,
    grid: ctx.grid ?? null,
    heightMap: ctx.heightMap ?? null,
    floorIds: ctx.floorIds ?? null,
    activeLevel: ctx.activeLevel ?? null
  });
  if (path.length === 0) return;
  const destination = path[path.length - 1];
  updateTokenPosition({ state, token, x: destination.x, y: destination.y });
}

function applyTeleport(params: {
  ctx: ActionEngineContext;
  state: { player: TokenState; enemies: TokenState[] };
  token: TokenState;
  to: { x: number; y: number };
}) {
  const { ctx, state, token, to } = params;
  if (!isCellAllowed({ ctx, state, x: to.x, y: to.y, excludeIds: [token.id] })) {
    return;
  }
  updateTokenPosition({ state, token, x: to.x, y: to.y });
}

function applyDisplace(params: {
  ctx: ActionEngineContext;
  state: { player: TokenState; enemies: TokenState[] };
  token: TokenState;
  direction: { x: number; y: number };
  distance: number;
}) {
  const { ctx, state, token, direction, distance } = params;
  const steps = Math.max(0, Math.round(distance));
  if (steps <= 0) return;
  const stepX = direction.x === 0 ? 0 : direction.x > 0 ? 1 : -1;
  const stepY = direction.y === 0 ? 0 : direction.y > 0 ? 1 : -1;
  const targetX = token.x + stepX * steps;
  const targetY = token.y + stepY * steps;

  const tokensForPath = getTokensForPath(ctx, state);
  const path = computePathTowards(token, { x: targetX, y: targetY }, tokensForPath, {
    maxDistance: steps,
    allowTargetOccupied: false,
    blockedCells: ctx.blockedMovementCells ?? null,
    wallEdges: ctx.blockedMovementEdges ?? null,
    playableCells: ctx.playableCells ?? null,
    grid: ctx.grid ?? null,
    heightMap: ctx.heightMap ?? null,
    floorIds: ctx.floorIds ?? null,
    activeLevel: ctx.activeLevel ?? null
  });
  if (path.length === 0) return;
  const destination = path[path.length - 1];
  updateTokenPosition({ state, token, x: destination.x, y: destination.y });
}

function applySwapPositions(params: {
  ctx: ActionEngineContext;
  state: { player: TokenState; enemies: TokenState[] };
  a: TokenState;
  b: TokenState;
}) {
  const { ctx, state, a, b } = params;
  if (
    !isCellAllowed({ ctx, state, x: b.x, y: b.y, excludeIds: [a.id, b.id] }) ||
    !isCellAllowed({ ctx, state, x: a.x, y: a.y, excludeIds: [a.id, b.id] })
  ) {
    return;
  }
  const ax = a.x;
  const ay = a.y;
  updateTokenPosition({ state, token: a, x: b.x, y: b.y });
  updateTokenPosition({ state, token: b, x: ax, y: ay });
}

function resolveTokenInState(state: { player: TokenState; enemies: TokenState[] }, id: string) {
  if (state.player.id === id) return state.player;
  return state.enemies.find(e => e.id === id) ?? null;
}


function getTokenSide(token: TokenState): TokenType {
  return token.summonOwnerType ?? token.type;
}

function isHostileTarget(actor: TokenState, targetToken: TokenState): boolean {
  return getTokenSide(actor) !== getTokenSide(targetToken);
}

function isAllyTarget(actor: TokenState, targetToken: TokenState): boolean {
  return getTokenSide(actor) === getTokenSide(targetToken);
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
      phase: ctx.enginePhase ?? ctx.phase,
      sameLevel: areOnSameBaseLevel(ctx, actor, targetToken),
      targetInArea:
        action.targeting?.range?.shape && typeof action.targeting.range.max === "number"
          ? dist <= action.targeting.range.max
          : null,
      inLight: isInLight(ctx, targetToken),
      lineOfSight: action.targeting?.requiresLos
        ? isTargetVisible(
            actor,
            targetToken,
            allTokens,
            ctx.blockedVisionCells ?? null,
            ctx.playableCells ?? null,
            ctx.wallVisionEdges ?? null,
            ctx.lightLevels ?? null,
            ctx.grid ?? null
          )
        : null,
      getResourceAmount: ctx.getResourceAmount,
      getSlotAmount: ctx.getSlotAmount,
      usage: ctx.usage ?? null,
      reactionAvailable: ctx.reactionAvailable ?? null,
      concentrating: ctx.concentrating ?? null,
      surprised: ctx.surprised ?? null
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
    if (target.kind === "tokens") {
      const tokens = target.tokens.filter(t => t.type === "enemy");
      if (tokens.length === 0) return { ok: false, reason: "Cible ennemi manquante." };
      if (typeof targeting.maxTargets === "number" && tokens.length > targeting.maxTargets) {
        return { ok: false, reason: "Trop de cibles." };
      }
      for (const token of tokens) {
        const res = validateTokenTarget(action, ctx, token);
        if (!res.ok) return res;
      }
      return { ok: true };
    }
    if (target.kind !== "token" || target.token.type !== "enemy") {
      return { ok: false, reason: "Cible ennemi manquante." };
    }
    return validateTokenTarget(action, ctx, target.token);
  }

  if (targeting.target === "player") {
    const playerToken = target.kind === "token" ? target.token : ctx.player;
    if (!playerToken || playerToken.id !== ctx.player.id) {
      return { ok: false, reason: "Cible joueur manquante." };
    }
    return validateTokenTarget(action, ctx, playerToken);
  }

  if (targeting.target === "hostile") {
    let targetToken: TokenState | null = null;
    if (target.kind === "tokens") {
      const tokens = target.tokens.filter(t => isHostileTarget(actor, t));
      if (tokens.length === 0) return { ok: false, reason: "Cible hostile manquante." };
      if (typeof targeting.maxTargets === "number" && tokens.length > targeting.maxTargets) {
        return { ok: false, reason: "Trop de cibles." };
      }
      for (const token of tokens) {
        const res = validateTokenTarget(action, ctx, token);
        if (!res.ok) return res;
      }
      return { ok: true };
    }
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
    if (target.kind === "tokens") {
      const tokens = target.tokens.filter(t => isAllyTarget(actor, t));
      if (tokens.length === 0) return { ok: false, reason: "Cible allie manquante." };
      if (typeof targeting.maxTargets === "number" && tokens.length > targeting.maxTargets) {
        return { ok: false, reason: "Trop de cibles." };
      }
      for (const token of tokens) {
        const res = validateTokenTarget(action, ctx, token);
        if (!res.ok) return res;
      }
      return { ok: true };
    }
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
      phase: ctx.enginePhase ?? ctx.phase,
      getResourceAmount: ctx.getResourceAmount,
      getSlotAmount: ctx.getSlotAmount,
      usage: ctx.usage ?? null,
      reactionAvailable: ctx.reactionAvailable ?? null,
      concentrating: ctx.concentrating ?? null,
      surprised: ctx.surprised ?? null,
      inLight: isInLight(ctx, ctx.actor),
      sameLevel: true,
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

  const loadingUsageKey = getWeaponLoadingUsageKey(action);
  if (loadingUsageKey) {
    const count = Number(ctx.usage?.turn?.[loadingUsageKey] ?? 0);
    if (count >= 1) {
      reasons.push("Arme a chargement: deja utilisee pour ce type d'action ce tour.");
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

function parseWeaponTagNumber(tags: string[] | undefined, prefix: string): number | null {
  if (!Array.isArray(tags)) return null;
  const token = tags.find(tag => typeof tag === "string" && tag.startsWith(prefix));
  if (!token) return null;
  const raw = token.slice(prefix.length);
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getAbilityScoreForActor(params: {
  actor: TokenState;
  ability: "FOR" | "DEX";
  sampleCharacter?: ActionEngineContext["sampleCharacter"];
}): number {
  const { actor, ability, sampleCharacter } = params;
  if (actor.type === "player") {
    const score =
      ability === "FOR"
        ? sampleCharacter?.caracs?.force?.FOR
        : sampleCharacter?.caracs?.dexterite?.DEX;
    if (typeof score === "number" && Number.isFinite(score)) return score;
  }
  const mod =
    ability === "FOR" ? actor.combatStats?.mods?.modFOR : actor.combatStats?.mods?.modDEX;
  if (typeof mod === "number" && Number.isFinite(mod)) return Math.floor(mod * 2 + 10);
  return 10;
}

function mergeAdvantageMode(base: AdvantageMode | undefined, scoreDelta: number): AdvantageMode {
  const baseScore = base === "advantage" ? 1 : base === "disadvantage" ? -1 : 0;
  const score = baseScore + scoreDelta;
  if (score > 0) return "advantage";
  if (score < 0) return "disadvantage";
  return "normal";
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
    weaponMasteryActions?: ActionDefinition[];
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

  const actor = {
    ...ctx.actor,
    tags: Array.isArray((ctx.actor as any).tags) ? [...((ctx.actor as any).tags as string[])] : [],
    combatStats: ctx.actor.combatStats
      ? {
          ...ctx.actor.combatStats,
          tags: Array.isArray(ctx.actor.combatStats.tags)
            ? [...ctx.actor.combatStats.tags]
            : []
        }
      : ctx.actor.combatStats
  };
  let player = { ...ctx.player };
  const enemies = ctx.enemies.map(e => ({ ...e }));

  const actionSpec = actionDefinitionToActionSpec(action);
  const activeMasteryIds = (actionSpec.tags ?? [])
    .filter(tag => typeof tag === "string" && tag.startsWith("wm-active:"))
    .map(tag => tag.replace(/^wm-active:/, ""))
    .filter(Boolean);
  if (activeMasteryIds.length > 0) {
    const tagSet = new Set<string>(actor.tags ?? []);
    activeMasteryIds.forEach(id => tagSet.add(`wm-active:${id}`));
    actor.tags = Array.from(tagSet);
  }
  if (
    Array.isArray(actor.tags) &&
    actor.tags.some(tag => tag === "wm-ralentissement" || tag.startsWith("wm-ralentissement:"))
  ) {
    const baseRange = typeof actor.moveRange === "number" ? actor.moveRange : actor.combatStats?.moveRange;
    if (typeof baseRange === "number") {
      actor.moveRange = Math.max(0, baseRange - 3);
    }
  }
  const masteryTriggerTags = buildWeaponMasteryTriggerTags({
    activeMasteryIds,
    masteryActions: opts?.weaponMasteryActions ?? []
  });
  if (masteryTriggerTags.length > 0) {
    const currentTags = actionSpec.tags ?? [];
    actionSpec.tags = Array.from(new Set([...currentTags, ...masteryTriggerTags]));
  }
  const plan = compileActionPlan({
    action: actionSpec,
    actor,
    target:
      target.kind === "token"
        ? target.token
        : target.kind === "tokens"
        ? { kind: "tokens", tokens: target.tokens }
        : target.kind === "cell"
        ? { x: target.x, y: target.y }
        : null
  });

  let computedAdvantageMode = opts?.advantageMode;
  if (action.category === "attack" && target.kind === "token") {
    const tags = actionSpec.tags ?? [];
    let penaltyScore = 0;
    const normalRange = parseWeaponTagNumber(tags, "weapon:range-normal:");
    if (typeof normalRange === "number" && normalRange > 0) {
      const dist = distanceBetweenTokens(actor, target.token);
      if (dist > normalRange) penaltyScore -= 1;
    }
    if (tags.includes("weapon:heavy")) {
      const modeIsRanged = tags.includes("weapon:mode:ranged");
      if (modeIsRanged) {
        const dexScore = getAbilityScoreForActor({
          actor,
          ability: "DEX",
          sampleCharacter: ctx.sampleCharacter
        });
        if (dexScore < 13) penaltyScore -= 1;
      } else {
        const strScore = getAbilityScoreForActor({
          actor,
          ability: "FOR",
          sampleCharacter: ctx.sampleCharacter
        });
        if (strScore < 13) penaltyScore -= 1;
      }
    }
    computedAdvantageMode = mergeAdvantageMode(opts?.advantageMode, penaltyScore);
  }

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
      isTargetAllowed: token => validateActionTarget(action, ctx, { kind: "token", token }).ok,
      getResourceAmount: ctx.getResourceAmount,
      spendResource: ctx.spendResource,
      spawnEntity: ctx.spawnEntity,
      despawnEntity: ctx.despawnEntity,
      controlSummon: ctx.controlSummon,
      rollOverrides: opts?.rollOverrides,
      onLog: log,
      onEmitEvent: ctx.emitEvent,
      onMoveTo: applyMoveTo,
      onMoveForced: params => {
        const token = resolveTokenInState(params.state, params.targetId);
        if (!token) return;
        applyForcedMove({
          ctx,
          state: params.state,
          token,
          to: params.to
        });
      },
      onTeleport: params => {
        const token = resolveTokenInState(params.state, params.targetId);
        if (!token) return;
        applyTeleport({
          ctx,
          state: params.state,
          token,
          to: params.to
        });
      },
      onSwapPositions: params => {
        const a = resolveTokenInState(params.state, params.aId);
        const b = resolveTokenInState(params.state, params.bId);
        if (!a || !b) return;
        applySwapPositions({ ctx, state: params.state, a, b });
      },
      onDisplace: params => {
        const token = resolveTokenInState(params.state, params.targetId);
        if (!token) return;
        applyDisplace({
          ctx,
          state: params.state,
          token,
          direction: params.direction,
          distance: params.distance
        });
      },
      onModifyPathLimit: ctx.onModifyPathLimit,
      onToggleTorch: ctx.onToggleTorch,
      onSetKillerInstinctTarget: ctx.onSetKillerInstinctTarget,
      onGrantTempHp: ctx.onGrantTempHp,
      onPlayVisualEffect: ctx.onPlayVisualEffect
    },
    advantageMode: computedAdvantageMode
  });

  if (!exec.ok) {
    return {
      ok: false,
      reason: exec.interrupted ? "Interruption par reaction." : "Echec de resolution.",
      logs: exec.logs.length ? exec.logs : logs
    };
  }

  player = exec.state.player;
  const enemiesAfter = exec.state.enemies.map(enemy => ({ ...enemy }));

  const actorAfter =
    actor.type === "player"
      ? exec.state.player
      : enemiesAfter.find(e => e.id === actor.id) ?? actor;

  return {
    ok: true,
    logs: exec.logs.length ? exec.logs : logs,
    actorAfter,
    playerAfter: player,
    enemiesAfter,
    outcomeKind: exec.outcome?.kind
  };
}

function extractMasteryId(action: ActionDefinition): string | null {
  if (typeof action.id === "string" && action.id.startsWith("wm-")) {
    const id = action.id.slice("wm-".length);
    return id || null;
  }
  const tags = Array.isArray(action.tags) ? action.tags : [];
  const candidate = tags.find(tag => {
    if (tag === "weaponMastery") return false;
    if (tag.startsWith("wm-trigger:")) return false;
    return true;
  });
  return candidate ?? null;
}

function getMasteryTrigger(action: ActionDefinition): "on_hit" | "on_miss" | "on_intent" {
  const tags = Array.isArray(action.tags) ? action.tags : [];
  const triggerTag = tags.find(tag => tag.startsWith("wm-trigger:"));
  if (triggerTag === "wm-trigger:on_miss") return "on_miss";
  if (triggerTag === "wm-trigger:on_intent") return "on_intent";
  return "on_hit";
}

function buildWeaponMasteryTriggerTags(params: {
  activeMasteryIds: string[];
  masteryActions: ActionDefinition[];
}): string[] {
  const { activeMasteryIds, masteryActions } = params;
  if (!activeMasteryIds.length || !masteryActions.length) return [];
  const activeSet = new Set(activeMasteryIds);
  const tags: string[] = [];
  for (const mastery of masteryActions) {
    const masteryId = extractMasteryId(mastery);
    if (!masteryId || !activeSet.has(masteryId)) continue;
    const trigger = getMasteryTrigger(mastery);
    tags.push(`wm-trigger:${masteryId}:${trigger}`);
  }
  return tags;
}
