import type { ActionAvailability, ActionDefinition } from "./actionTypes";
import type { TokenState } from "../types";
import { isTargetVisible } from "../vision";
import { clamp, distanceBetweenTokens } from "./combatUtils";
import { computePathTowards } from "../pathfinding";
import { GRID_COLS, GRID_ROWS, isCellInsideGrid } from "../boardConfig";
import { rollAttack, rollDamage, type AdvantageMode } from "../dice/roller";
import { hasLineOfEffect } from "../lineOfSight";
import type { WallSegment } from "./map/walls/types";
import { getHeightAtGrid, type TerrainCell } from "./map/draft";
import { getClosestFootprintCellToPoint } from "./footprint";

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
      force?: { modFOR?: number };
      dexterite?: { modDEX?: number };
      constitution?: { modCON?: number };
    };
  };
  /**
   * Resource lookup/spend hooks (optional for now).
   */
  getResourceAmount?: (name: string, pool?: string | null) => number;
  spendResource?: (name: string, pool: string | null, amount: number) => void;
  onLog?: (message: string) => void;
}

export type ActionTarget =
  | { kind: "token"; token: TokenState }
  | { kind: "cell"; x: number; y: number }
  | { kind: "none" };

function resolveNumberVar(
  varName: string,
  ctx: ActionEngineContext
): number | null {
  const actor = ctx.actor;

  if (varName.toLowerCase() === "attackdamage") {
    return typeof actor.attackDamage === "number" ? actor.attackDamage : 0;
  }
  if (varName.toLowerCase() === "moverange") {
    return typeof actor.moveRange === "number" ? actor.moveRange : 0;
  }
  if (varName.toLowerCase() === "attackrange") {
    return typeof actor.attackRange === "number" ? actor.attackRange : 1;
  }
  if (varName.toLowerCase() === "niveau") {
    const level = Number(ctx.sampleCharacter?.niveauGlobal ?? 1);
    return Number.isFinite(level) ? level : 1;
  }
  if (varName.toLowerCase() === "modfor") {
    const mod = Number(ctx.sampleCharacter?.caracs?.force?.modFOR ?? 0);
    return Number.isFinite(mod) ? mod : 0;
  }
  if (varName.toLowerCase() === "moddex") {
    const mod = Number(ctx.sampleCharacter?.caracs?.dexterite?.modDEX ?? 0);
    return Number.isFinite(mod) ? mod : 0;
  }
  if (varName.toLowerCase() === "modcon") {
    const mod = Number(ctx.sampleCharacter?.caracs?.constitution?.modCON ?? 0);
    return Number.isFinite(mod) ? mod : 0;
  }

  return null;
}

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

export function resolveFormula(formula: string, ctx: ActionEngineContext): string {
  const raw = String(formula ?? "");
  if (!raw.trim()) return "0";

  // Replace tokens like "attackDamage" or "modDEX".
  return raw.replace(/[A-Za-z_][A-Za-z0-9_]*/g, token => {
    const value = resolveNumberVar(token, ctx);
    return value === null ? token : String(value);
  });
}

export function getPrimaryTargetToken(
  action: ActionDefinition,
  ctx: ActionEngineContext,
  target: ActionTarget
): TokenState | null {
  if (target.kind === "token") return target.token;

  if (action.targeting?.target === "player") {
    return ctx.player;
  }
  if (action.targeting?.target === "enemy") {
    return null;
  }

  return null;
}

export function validateActionTarget(
  action: ActionDefinition,
  ctx: ActionEngineContext,
  target: ActionTarget
): { ok: boolean; reason?: string } {
  const actor = ctx.actor;
  const allTokens: TokenState[] = [ctx.player, ...ctx.enemies];

  const targeting = action.targeting;
  if (!targeting) return { ok: false, reason: "Action sans ciblage." };

  if (targeting.target === "self") {
    return { ok: true };
  }

  if (targeting.target === "enemy") {
    if (target.kind !== "token" || target.token.type !== "enemy") {
      return { ok: false, reason: "Cible ennemi manquante." };
    }

    const enemyToken = target.token;
    if (enemyToken.hp <= 0) {
      return { ok: false, reason: "La cible est deja a terre." };
    }

    if (!areOnSameBaseLevel(ctx, actor, enemyToken)) {
      return { ok: false, reason: "Cible sur un autre niveau." };
    }

    const dist = distanceBetweenTokens(actor, enemyToken);
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
      if (cond.type === "target_alive" && enemyToken.hp <= 0) {
        return {
          ok: false,
          reason: cond.reason || "La cible doit avoir des PV restants."
        };
      }
      if (cond.type === "distance_max") {
        if (typeof cond.max === "number" && dist > cond.max) {
          return { ok: false, reason: cond.reason || `Distance cible > ${cond.max}.` };
        }
      }
      if (cond.type === "distance_between") {
        const min = typeof cond.min === "number" ? cond.min : range?.min ?? null;
        const max = typeof cond.max === "number" ? cond.max : range?.max ?? null;
        if (min !== null && dist < min) {
          return { ok: false, reason: cond.reason || `Distance cible < ${min}.` };
        }
        if (max !== null && dist > max) {
          return { ok: false, reason: cond.reason || `Distance cible > ${max}.` };
        }
      }
    }

    if (targeting.requiresLos) {
      const visible = isTargetVisible(
        actor,
        enemyToken,
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
        getClosestFootprintCellToPoint({ x: actor.x, y: actor.y }, enemyToken) ??
        { x: enemyToken.x, y: enemyToken.y };
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

  if (targeting.target === "player") {
    const playerToken = ctx.player;
    if (playerToken.hp <= 0) {
      return { ok: false, reason: "Le joueur est deja a terre." };
    }

    if (!areOnSameBaseLevel(ctx, actor, playerToken)) {
      return { ok: false, reason: "Cible sur un autre niveau." };
    }

    const dist = distanceBetweenTokens(actor, playerToken);
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
      if (cond.type === "target_alive" && playerToken.hp <= 0) {
        return {
          ok: false,
          reason: cond.reason || "La cible doit avoir des PV restants."
        };
      }
      if (cond.type === "distance_max") {
        if (typeof cond.max === "number" && dist > cond.max) {
          return { ok: false, reason: cond.reason || `Distance cible > ${cond.max}.` };
        }
      }
      if (cond.type === "distance_between") {
        const min = typeof cond.min === "number" ? cond.min : range?.min ?? null;
        const max = typeof cond.max === "number" ? cond.max : range?.max ?? null;
        if (min !== null && dist < min) {
          return { ok: false, reason: cond.reason || `Distance cible < ${min}.` };
        }
        if (max !== null && dist > max) {
          return { ok: false, reason: cond.reason || `Distance cible > ${max}.` };
        }
      }
    }

    if (targeting.requiresLos) {
      const visible = isTargetVisible(
        actor,
        playerToken,
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
        getClosestFootprintCellToPoint({ x: actor.x, y: actor.y }, playerToken) ??
        { x: playerToken.x, y: playerToken.y };
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

  // Phase condition is supported only if present; enemy actions should generally omit it.
  for (const cond of action.conditions || []) {
    if (cond.type === "phase" && cond.mustBe && cond.mustBe !== ctx.phase) {
      reasons.push(cond.reason || "Phase incorrecte.");
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
}

export function resolveAction(
  action: ActionDefinition,
  ctx: ActionEngineContext,
  target: ActionTarget,
  opts?: { advantageMode?: AdvantageMode }
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

  const emit = (evt: Parameters<NonNullable<ActionEngineContext["emitEvent"]>>[0]) => {
    ctx.emitEvent?.(evt);
  };

  // Helper: update enemy in list if actor is enemy.
  const replaceActorInEnemies = () => {
    if (actor.type !== "enemy") return;
    const idx = enemies.findIndex(e => e.id === actor.id);
    if (idx >= 0) enemies[idx] = actor;
  };

  for (const effect of action.effects || []) {
    if (effect.type === "log" && typeof effect.message === "string") {
      log(effect.message);
      continue;
    }

    if (effect.type === "resource_spend" && effect.resource && ctx.spendResource) {
      const pool = typeof effect.pool === "string" ? effect.pool : null;
      const amount = typeof effect.amount === "number" ? effect.amount : 1;
      ctx.spendResource(String(effect.resource), pool, amount);
      continue;
    }

    if (effect.type === "damage" && effect.target === "primary") {
      const targetToken = getPrimaryTargetToken(action, ctx, target);
      if (!targetToken) continue;

      const advantageMode = (opts?.advantageMode ?? "normal") as AdvantageMode;
      const critRule = action.damage?.critRule ?? "double-dice";
      const resolvedDamageFormula = resolveFormula(effect.formula ?? action.damage?.formula ?? "0", ctx);

      let isHit = true;
      let isCrit = false;
      let attackRollTotal: number | null = null;
      let targetAC: number | null = null;

      const targetArmorClass =
        typeof targetToken.armorClass === "number" ? targetToken.armorClass : null;
      targetAC = targetArmorClass;

      if (action.attack) {
        const attackRoll = rollAttack(action.attack.bonus, advantageMode, action.attack.critRange ?? 20);
        isCrit = attackRoll.isCrit;
        attackRollTotal = attackRoll.total;
        if (targetArmorClass !== null) {
          isHit = attackRoll.total >= targetArmorClass || attackRoll.isCrit;
        }
        const rollsText =
          attackRoll.mode === "normal"
            ? `${attackRoll.d20.total}`
            : `${attackRoll.d20.rolls.join(" / ")} -> ${attackRoll.d20.total}`;
        log(
          `Jet de touche (${action.name}) : ${rollsText} + ${attackRoll.bonus} = ${attackRoll.total}` +
            (targetArmorClass !== null ? ` vs CA ${targetArmorClass}` : "") +
            (attackRoll.isCrit ? " (critique!)" : "")
        );
      }

      if (!isHit) {
        log(`L'attaque (${action.name}) rate sa cible. Pas de degats.`);
        const attackKind =
          actor.type === "enemy" ? "enemy_attack" : "player_attack";
        emit({
          kind: attackKind,
          actorId: actor.id,
          actorKind: actor.type,
          targetId: targetToken.id,
          targetKind: targetToken.type,
          summary: `${actor.id} rate ${targetToken.id} avec ${action.name}.`,
          data: {
            actionId: action.id,
            actionName: action.name,
            isHit: false,
            isCrit: false,
            damage: 0,
            attackRollTotal,
            targetArmorClass: targetAC
          }
        });
        continue;
      }

      const dmg = rollDamage(resolvedDamageFormula, { isCrit, critRule });
      const before = targetToken.hp;
      const afterHp = Math.max(0, before - dmg.total);

      if (targetToken.type === "player") {
        player = { ...player, hp: afterHp };
        log(`${action.name} inflige ${dmg.total} degats au joueur (PV ${before} -> ${afterHp}).`);
      } else {
        const idx = enemies.findIndex(e => e.id === targetToken.id);
        if (idx >= 0) {
          enemies[idx] = { ...enemies[idx], hp: afterHp };
          log(`${action.name} inflige ${dmg.total} degats a ${targetToken.id} (PV ${before} -> ${afterHp}).`);
        }
      }

      const attackKind =
        actor.type === "enemy" ? "enemy_attack" : "player_attack";
      emit({
        kind: attackKind,
        actorId: actor.id,
        actorKind: actor.type,
        targetId: targetToken.id,
        targetKind: targetToken.type,
        summary:
          dmg.total > 0
            ? `${actor.id} touche ${targetToken.id} avec ${action.name} et inflige ${dmg.total} degats (PV ${before} -> ${afterHp}).`
            : `${actor.id} touche ${targetToken.id} avec ${action.name} (pas de degats).`,
        data: {
          actionId: action.id,
          actionName: action.name,
          isHit: true,
          isCrit,
          damage: dmg.total,
          damageFormula: dmg.formula,
          attackRollTotal,
          targetArmorClass: targetAC,
          targetHpBefore: before,
          targetHpAfter: afterHp
        }
      });

      emit({
        kind: "damage",
        actorId: actor.id,
        actorKind: actor.type,
        targetId: targetToken.id,
        targetKind: targetToken.type,
        summary: `${targetToken.id} subit ${dmg.total} degats (${action.name}).`,
        data: {
          sourceActionId: action.id,
          sourceActionName: action.name,
          damage: dmg.total,
          isCrit,
          targetHpBefore: before,
          targetHpAfter: afterHp
        }
      });
      continue;
    }

    if (effect.type === "move_to" && effect.target === "self") {
      if (target.kind !== "cell") {
        return { ok: false, reason: "Move: cible de case manquante.", logs };
      }

      const maxStepsRaw = effect.maxSteps;
      let maxSteps: number | null = null;
      if (typeof maxStepsRaw === "number") {
        maxSteps = maxStepsRaw;
      } else if (typeof maxStepsRaw === "string") {
        const resolved = resolveFormula(maxStepsRaw, ctx);
        const parsed = Number.parseInt(resolved, 10);
        maxSteps = Number.isFinite(parsed) ? parsed : null;
      }
      if (maxSteps === null) {
        maxSteps = typeof actor.moveRange === "number" ? actor.moveRange : 3;
      }

      const cols = ctx.grid?.cols ?? GRID_COLS;
      const rows = ctx.grid?.rows ?? GRID_ROWS;
      const clampedX = clamp(target.x, 0, cols - 1);
      const clampedY = clamp(target.y, 0, rows - 1);
      if (!isCellInsideGrid(clampedX, clampedY, cols, rows)) {
        return { ok: false, reason: "Move: case hors plateau.", logs };
      }
      if (ctx.playableCells && ctx.playableCells.size > 0) {
        const k = `${clampedX},${clampedY}`;
        if (!ctx.playableCells.has(k)) {
          return { ok: false, reason: "Move: case hors zone jouable.", logs };
        }
      }

      const tokensForPath: TokenState[] = (() => {
        if (!ctx.heightMap || typeof ctx.activeLevel !== "number") {
          return [player as TokenState, ...enemies];
        }
        const cols = ctx.grid?.cols ?? GRID_COLS;
        const rows = ctx.grid?.rows ?? GRID_ROWS;
        return [player as TokenState, ...enemies].filter(t => {
          const baseHeight = getHeightAtGrid(ctx.heightMap as number[], cols, rows, t.x, t.y);
          return baseHeight === ctx.activeLevel;
        });
      })();
      const path = computePathTowards(actor, { x: clampedX, y: clampedY }, tokensForPath, {
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

      actor.plannedPath = path;
      if (path.length === 0) {
        return { ok: false, reason: "Move: aucun chemin valide.", logs };
      }

      const from = { x: actor.x, y: actor.y };
      const destination = path[path.length - 1];
      actor.x = destination.x;
      actor.y = destination.y;
      replaceActorInEnemies();
      if (actor.type === "player") {
        log(`${actor.id} se deplace vers (${destination.x}, ${destination.y}).`);
      }
      emit({
        kind: "move",
        actorId: actor.id,
        actorKind: actor.type,
        summary: `${actor.id} se deplace de (${from.x}, ${from.y}) vers (${destination.x}, ${destination.y}).`,
        data: {
          actionId: action.id,
          actionName: action.name,
          from,
          to: destination,
          path
        }
      });
      continue;
    }
  }

  replaceActorInEnemies();

  return {
    ok: true,
    logs,
    actorAfter: actor,
    playerAfter: player,
    enemiesAfter: enemies
  };
}
