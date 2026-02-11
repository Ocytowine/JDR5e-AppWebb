import { rollDamage } from "../../dice/roller";
import { resolveFormula } from "./formulas";
import type { EngineState, ExecuteOptions, Operation, TargetSelector } from "./types";
import type { Transaction } from "./transaction";
import { logTransaction } from "./transaction";
import { distanceBetweenTokens } from "../combatUtils";

function pickTarget(
  state: EngineState,
  selector: TargetSelector,
  explicitTarget: { kind: "token"; token: { id: string } } | null
) {
  if (selector === "self") return state.actor;
  if (explicitTarget && explicitTarget.kind === "token") {
    const targetId = explicitTarget.token.id;
    if (state.player.id === targetId) return state.player;
    return state.enemies.find(enemy => enemy.id === targetId) ?? null;
  }
  return null;
}

function ensureDefenseArray(
  token: any,
  mode: "resistance" | "vulnerability" | "immunity"
): string[] {
  token.defenses = token.defenses ?? {};
  token.defenses.damage = token.defenses.damage ?? {};
  const key = mode === "resistance" ? "resist" : mode === "vulnerability" ? "vulnerable" : "immune";
  token.defenses.damage[key] = token.defenses.damage[key] ?? [];
  return token.defenses.damage[key];
}

function moveTokenByDelta(token: any, dx: number, dy: number) {
  token.x = (token.x ?? 0) + dx;
  token.y = (token.y ?? 0) + dy;
}

function resolveTokenById(state: EngineState, token: { id?: string } | null): any | null {
  if (!token?.id) return null;
  if (state.actor.id === token.id) return state.actor;
  if (state.player.id === token.id) return state.player;
  return state.enemies.find(enemy => enemy.id === token.id) ?? null;
}

function getConcentrationSourceId(token: any): string | null {
  if (!token?.concentration) return null;
  if (typeof token.concentration === "object") {
    return token.concentration.sourceId ?? token.id ?? null;
  }
  return token.id ?? null;
}

function linkStatusToConcentration(
  state: EngineState,
  status: { id: string; remainingTurns: number; sourceId?: string; durationTick?: "start" | "end" | "round"; concentrationSourceId?: string }
) {
  const sourceId = state.concentrationLink?.sourceId;
  if (!sourceId) return status;
  return { ...status, concentrationSourceId: sourceId };
}

function shouldLinkEffectToConcentration(state: EngineState, effectTypeId: string): boolean {
  const link = state.concentrationLink;
  if (!link) return false;
  if (!link.effectId) return true;
  return link.effectId === effectTypeId;
}

function linkEffectToConcentration(state: EngineState, effect: any): any {
  const sourceId = state.concentrationLink?.sourceId;
  if (!sourceId) return effect;
  if (!shouldLinkEffectToConcentration(state, effect.typeId)) return effect;
  return { ...effect, concentrationSourceId: sourceId };
}

function removeConcentrationLinkedStatuses(state: EngineState, sourceId: string): number {
  let removed = 0;
  const tokens = [state.player, ...state.enemies];
  for (const token of tokens) {
    if (!Array.isArray(token.statuses) || token.statuses.length === 0) continue;
    const before = token.statuses.length;
    token.statuses = token.statuses.filter(status => status.concentrationSourceId !== sourceId);
    removed += Math.max(0, before - token.statuses.length);
  }
  return removed;
}

function removeConcentrationLinkedEffects(state: EngineState, sourceId: string): number {
  if (!Array.isArray(state.effects) || state.effects.length === 0) return 0;
  const before = state.effects.length;
  state.effects = state.effects.filter(effect => effect.concentrationSourceId !== sourceId);
  return Math.max(0, before - state.effects.length);
}

function breakConcentration(params: {
  state: EngineState;
  tx: Transaction;
  token: any;
  opts: ExecuteOptions;
  reason: string;
}) {
  const { state, tx, token, opts, reason } = params;
  const sourceId = getConcentrationSourceId(token);
  token.concentration = null;
  if (sourceId) {
    const removed = removeConcentrationLinkedStatuses(state, sourceId);
    const removedEffects = removeConcentrationLinkedEffects(state, sourceId);
    logTransaction(
      tx,
      `${reason}${
        removed > 0 || removedEffects > 0
          ? ` (${removed + removedEffects} effets lies retires)`
          : ""
      }`,
      opts.onLog
    );
  } else {
    logTransaction(tx, reason, opts.onLog);
  }
}

function maybeCheckConcentrationOnDamage(params: {
  state: EngineState;
  tx: Transaction;
  targetToken: any;
  damage: number;
  opts: ExecuteOptions;
}) {
  const { state, tx, targetToken, damage, opts } = params;
  if (!targetToken?.concentration) return;
  if (damage <= 0) return;
  const dc = Math.max(10, Math.floor(damage / 2));
  const mod = targetToken?.combatStats?.mods?.modCON ?? 0;
  const roll = rollDamage("1d20", { isCrit: false, critRule: "double-dice" });
  const total = roll.total + mod;
  logTransaction(
    tx,
    `Concentration: d20 ${roll.total} + ${mod} = ${total} (DD ${dc})`,
    opts.onLog
  );
  if (total < dc) {
    breakConcentration({
      state,
      tx,
      token: targetToken,
      opts,
      reason: "Concentration brisee par degats."
    });
  }
}

function ensureTargetingState(
  state: EngineState,
  explicitTarget: { kind: "token"; token: { id: string } } | null
): { targets: any[]; locked: boolean } {
  if (state.targeting) {
    state.targeting.targets = state.targeting.targets ?? [];
    state.targeting.locked = state.targeting.locked ?? false;
    return {
      targets: state.targeting.targets,
      locked: state.targeting.locked
    };
  }

  const targets: any[] = [];
  if (explicitTarget?.kind === "token") {
    const resolved = resolveTokenById(state, explicitTarget.token);
    if (resolved) targets.push(resolved);
  } else if (state.targetingConfig?.target === "self") {
    targets.push(state.actor);
  }

  state.targeting = { targets, locked: false };
  return { targets, locked: false };
}

function getTokenTags(token: any): string[] {
  const tags: string[] = [];
  if (Array.isArray(token?.tags)) tags.push(...token.tags);
  if (Array.isArray(token?.combatStats?.tags)) tags.push(...token.combatStats.tags);
  return tags;
}

function getPotentialTargets(state: EngineState): any[] {
  const target = state.targetingConfig?.target ?? null;
  if (target === "self") return [state.actor];
  if (target === "player") return [state.player];
  if (target === "enemy") return state.enemies;
  if (target === "hostile") {
    return state.actor.type === "player" ? state.enemies : [state.player];
  }
  if (target === "ally") {
    return state.actor.type === "player" ? [state.player] : state.enemies;
  }
  return [];
}

function directionFromTo(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: 0, y: 0 };
  const mag = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / mag, y: dy / mag };
}

export function applyOperation(params: {
  op: Operation;
  tx: Transaction;
  state: EngineState;
  explicitTarget: { kind: "token"; token: { id: string } } | { kind: "cell"; x: number; y: number } | null;
  opts: ExecuteOptions;
}) {
  const { op, tx, state, explicitTarget, opts } = params;

  if (op.op === "LogEvent") {
    logTransaction(tx, op.message, opts.onLog);
    return;
  }

  if (op.op === "EmitEvent") {
    opts.onEmitEvent?.({ kind: op.kind, data: op.data });
    return;
  }

  if (op.op === "SpendResource") {
    opts.spendResource?.(op.name, op.pool ?? null, op.amount);
    logTransaction(tx, `Ressource depensee: ${op.name} -${op.amount}`, opts.onLog);
    return;
  }

  if (op.op === "RestoreResource") {
    if (opts.restoreResource) {
      opts.restoreResource(op.name, op.pool ?? null, op.amount);
    } else if (opts.spendResource) {
      opts.spendResource(op.name, op.pool ?? null, -op.amount);
    }
    logTransaction(tx, `Ressource restauree: ${op.name} +${op.amount}`, opts.onLog);
    return;
  }

  if (op.op === "SetResource") {
    opts.setResource?.(op.name, op.pool ?? null, op.amount);
    logTransaction(tx, `Ressource fixee: ${op.name} = ${op.amount}`, opts.onLog);
    return;
  }

  if (op.op === "ConsumeSlot") {
    opts.consumeSlot?.(op.slot, op.level, op.amount);
    logTransaction(tx, `Slot consomme: ${op.slot}${op.level ? ` (lvl ${op.level})` : ""}`, opts.onLog);
    return;
  }

  if (op.op === "RestoreSlot") {
    opts.restoreSlot?.(op.slot, op.level, op.amount);
    logTransaction(tx, `Slot restaure: ${op.slot}${op.level ? ` (lvl ${op.level})` : ""}`, opts.onLog);
    return;
  }

  if (op.op === "CreateZone") {
    const targetCell =
      op.target === "self"
        ? { x: state.actor.x, y: state.actor.y }
        : explicitTarget?.kind === "token"
        ? (() => {
            const targetId = explicitTarget.token.id;
            if (state.player.id === targetId) return { x: state.player.x, y: state.player.y };
            const enemy = state.enemies.find(e => e.id === targetId);
            return enemy ? { x: enemy.x, y: enemy.y } : null;
          })()
        : null;
    if (!targetCell) return;
    const id = `zone-${op.effectTypeId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    tx.state.effects = tx.state.effects.filter(
      effect =>
        !(
          effect.kind === "zone" &&
          effect.typeId === op.effectTypeId &&
          effect.sourceId === state.actor.id
        )
    );
    const effect = linkEffectToConcentration(state, {
      id,
      typeId: op.effectTypeId,
      x: targetCell.x,
      y: targetCell.y,
      active: true,
      kind: "zone",
      sourceId: state.actor.id
    });
    tx.state.effects.push(effect);
    logTransaction(tx, `Zone creee: ${op.effectTypeId}`, opts.onLog);
    return;
  }

  if (op.op === "RemoveZone") {
    tx.state.effects = tx.state.effects.filter(effect => {
      if (op.zoneId && effect.id === op.zoneId) return false;
      if (op.effectTypeId && effect.typeId === op.effectTypeId) return false;
      return true;
    });
    logTransaction(tx, `Zone retiree`, opts.onLog);
    return;
  }

  if (op.op === "ModifyZone") {
    const effect = tx.state.effects.find(e => e.id === op.zoneId);
    if (effect) {
      if (typeof op.active === "boolean") (effect as any).active = op.active;
      if (typeof op.x === "number") (effect as any).x = op.x;
      if (typeof op.y === "number") (effect as any).y = op.y;
      logTransaction(tx, `Zone modifiee: ${op.zoneId}`, opts.onLog);
    }
    return;
  }

  if (op.op === "CreateSurface") {
    const targetCell =
      op.target === "self"
        ? { x: state.actor.x, y: state.actor.y }
        : explicitTarget?.kind === "token"
        ? (() => {
            const targetId = explicitTarget.token.id;
            if (state.player.id === targetId) return { x: state.player.x, y: state.player.y };
            const enemy = state.enemies.find(e => e.id === targetId);
            return enemy ? { x: enemy.x, y: enemy.y } : null;
          })()
        : null;
    if (!targetCell) return;
    const id = `surface-${op.effectTypeId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    tx.state.effects = tx.state.effects.filter(
      effect =>
        !(
          effect.kind === "surface" &&
          effect.typeId === op.effectTypeId &&
          effect.sourceId === state.actor.id
        )
    );
    const effect = linkEffectToConcentration(state, {
      id,
      typeId: op.effectTypeId,
      x: targetCell.x,
      y: targetCell.y,
      active: true,
      kind: "surface",
      sourceId: state.actor.id
    });
    tx.state.effects.push(effect);
    logTransaction(tx, `Surface creee: ${op.effectTypeId}`, opts.onLog);
    return;
  }

  if (op.op === "RemoveSurface") {
    tx.state.effects = tx.state.effects.filter(effect => {
      if (op.surfaceId && effect.id === op.surfaceId) return false;
      if (op.effectTypeId && effect.typeId === op.effectTypeId) return false;
      return true;
    });
    logTransaction(tx, `Surface retiree`, opts.onLog);
    return;
  }

  if (op.op === "ApplyAura") {
    const targetToken = pickTarget(state, op.target, explicitTarget);
    if (!targetToken) return;
    const id = `aura-${op.effectTypeId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    tx.state.effects = tx.state.effects.filter(
      effect =>
        !(
          effect.kind === "aura" &&
          effect.typeId === op.effectTypeId &&
          effect.sourceId === state.actor.id &&
          effect.anchorTokenId === targetToken.id
        )
    );
    const effect = linkEffectToConcentration(state, {
      id,
      typeId: op.effectTypeId,
      x: targetToken.x,
      y: targetToken.y,
      active: true,
      kind: "aura",
      sourceId: state.actor.id,
      anchorTokenId: targetToken.id
    });
    tx.state.effects.push(effect);
    logTransaction(tx, `Aura appliquee: ${op.effectTypeId}`, opts.onLog);
    return;
  }

  const targetToken = pickTarget(state, op.target, explicitTarget);
  if (!targetToken) return;

    if (op.op === "DealDamage") {
      const formula = resolveFormula(op.formula, { actor: state.actor, sampleCharacter: undefined });
      const override = opts.rollOverrides?.consumeDamageRoll?.() ?? null;
      const roll = override ?? rollDamage(formula, { isCrit: false, critRule: "double-dice" });
      const total = op.scale === "half" ? Math.floor(roll.total / 2) : roll.total;
      const diceText = roll.dice.map(d => d.rolls.join("+")).join(" | ");
      const detail = diceText || roll.flatModifier ? ` [${diceText}${roll.flatModifier ? ` + ${roll.flatModifier}` : ""}]` : "";
    const tempHp = typeof targetToken.tempHp === "number" ? targetToken.tempHp : 0;
    if (tempHp > 0) {
      const remaining = Math.max(0, total - tempHp);
      targetToken.tempHp = Math.max(0, tempHp - total);
      targetToken.hp = Math.max(0, targetToken.hp - remaining);
      } else {
        targetToken.hp = Math.max(0, targetToken.hp - total);
      }
      logTransaction(tx, `Degats: ${total} (${formula})${detail}`, opts.onLog);
      maybeCheckConcentrationOnDamage({ state, tx, targetToken, damage: total, opts });
      return;
    }

    if (op.op === "DealDamageScaled") {
      const formula = resolveFormula(op.formula, { actor: state.actor, sampleCharacter: undefined });
      const roll = rollDamage(formula, { isCrit: false, critRule: "double-dice" });
      const total = op.scale === "quarter" ? Math.floor(roll.total / 4) : Math.floor(roll.total / 2);
      const diceText = roll.dice.map(d => d.rolls.join("+")).join(" | ");
      const detail = diceText || roll.flatModifier ? ` [${diceText}${roll.flatModifier ? ` + ${roll.flatModifier}` : ""}]` : "";
    const tempHp = typeof targetToken.tempHp === "number" ? targetToken.tempHp : 0;
    if (tempHp > 0) {
      const remaining = Math.max(0, total - tempHp);
      targetToken.tempHp = Math.max(0, tempHp - total);
      targetToken.hp = Math.max(0, targetToken.hp - remaining);
      } else {
        targetToken.hp = Math.max(0, targetToken.hp - total);
      }
      logTransaction(tx, `Degats reduits: ${total} (${formula})${detail}`, opts.onLog);
      maybeCheckConcentrationOnDamage({ state, tx, targetToken, damage: total, opts });
      return;
    }

  if (op.op === "ApplyDamageTypeMod") {
    const list = ensureDefenseArray(targetToken as any, op.mode);
    if (!list.includes(op.damageType)) list.push(op.damageType);
    logTransaction(tx, `Defense ${op.mode}: ${op.damageType}`, opts.onLog);
    return;
  }

  if (op.op === "Heal") {
    const formula = resolveFormula(op.formula, { actor: state.actor, sampleCharacter: undefined });
    const roll = rollDamage(formula, { isCrit: false, critRule: "double-dice" });
    const total = roll.total;
    const diceText = roll.dice.map(d => d.rolls.join("+")).join(" | ");
    const detail = diceText || roll.flatModifier ? ` [${diceText}${roll.flatModifier ? ` + ${roll.flatModifier}` : ""}]` : "";
    targetToken.hp = Math.min(targetToken.maxHp, targetToken.hp + total);
    logTransaction(tx, `Soin: +${total} (${formula})${detail}`, opts.onLog);
    return;
  }

  if (op.op === "ApplyCondition") {
    const statuses = targetToken.statuses ? [...targetToken.statuses] : [];
    const status = linkStatusToConcentration(state, {
      id: op.statusId,
      remainingTurns: op.durationTurns,
      sourceId: state.actor.id,
      durationTick: "start"
    });
    statuses.push(status);
    targetToken.statuses = statuses;
    logTransaction(tx, `Etat applique: ${op.statusId} (${op.durationTurns} tours)`, opts.onLog);
    return;
  }

  if (op.op === "RemoveCondition") {
    const statuses = targetToken.statuses ? [...targetToken.statuses] : [];
    targetToken.statuses = statuses.filter(status => status.id !== op.statusId);
    logTransaction(tx, `Etat retire: ${op.statusId}`, opts.onLog);
    return;
  }

  if (op.op === "ExtendCondition") {
    const statuses = targetToken.statuses ? [...targetToken.statuses] : [];
    for (const status of statuses) {
      if (status.id === op.statusId) {
        status.remainingTurns = Math.max(0, status.remainingTurns + op.durationTurns);
      }
    }
    targetToken.statuses = statuses;
    logTransaction(tx, `Etat prolonge: ${op.statusId} (+${op.durationTurns})`, opts.onLog);
    return;
  }

  if (op.op === "SetConditionStack") {
    const statuses = targetToken.statuses ? [...targetToken.statuses] : [];
    const kept = statuses.filter(status => status.id !== op.statusId);
    for (let i = 0; i < op.stacks; i++) {
      kept.push({ id: op.statusId, remainingTurns: 1, sourceId: state.actor.id });
    }
    targetToken.statuses = kept;
    logTransaction(tx, `Stacks etat: ${op.statusId} = ${op.stacks}`, opts.onLog);
    return;
  }

  if (op.op === "StartConcentration") {
    if ((targetToken as any).concentration) {
      breakConcentration({
        state,
        tx,
        token: targetToken,
        opts,
        reason: "Concentration remplacee."
      });
    }
    const sourceId = op.sourceId ?? state.actor.id;
    const effectId = op.effectId ?? null;
    (targetToken as any).concentration = {
      sourceId,
      effectId
    };
    state.concentrationLink = { sourceId, effectId };
    if (effectId) {
      for (const effect of state.effects) {
        if (!effect.concentrationSourceId && effect.typeId === effectId) {
          effect.concentrationSourceId = sourceId;
        }
      }
    }
    logTransaction(tx, `Concentration demarree`, opts.onLog);
    return;
  }

  if (op.op === "BreakConcentration") {
    breakConcentration({
      state,
      tx,
      token: targetToken,
      opts,
      reason: "Concentration interrompue."
    });
    return;
  }

  if (op.op === "GrantTempHp") {
    const amount = typeof op.amount === "number" ? op.amount : 0;
    if (amount <= 0) return;
    targetToken.tempHp = Math.max(targetToken.tempHp ?? 0, amount);
    opts.onGrantTempHp?.({ targetId: targetToken.id, amount, durationTurns: op.durationTurns });
    logTransaction(tx, `PV temporaires: +${amount}`, opts.onLog);
    return;
  }

  if (op.op === "MoveForced") {
    if (!op.to) return;
    if (opts.onMoveForced) {
      opts.onMoveForced({ state, targetId: targetToken.id, to: op.to });
    } else {
      targetToken.x = op.to.x;
      targetToken.y = op.to.y;
    }
    logTransaction(tx, `Deplacement force vers (${op.to.x}, ${op.to.y})`, opts.onLog);
    return;
  }

  if (op.op === "Teleport") {
    if (opts.onTeleport) {
      opts.onTeleport({ state, targetId: targetToken.id, to: op.to });
    } else {
      targetToken.x = op.to.x;
      targetToken.y = op.to.y;
    }
    logTransaction(tx, `Teleportation vers (${op.to.x}, ${op.to.y})`, opts.onLog);
    return;
  }

  if (op.op === "SwapPositions") {
    if (opts.onSwapPositions) {
      opts.onSwapPositions({ state, aId: state.actor.id, bId: targetToken.id });
    } else {
      const ax = state.actor.x;
      const ay = state.actor.y;
      state.actor.x = targetToken.x;
      state.actor.y = targetToken.y;
      targetToken.x = ax;
      targetToken.y = ay;
    }
    logTransaction(tx, `Positions echangees`, opts.onLog);
    return;
  }

  if (op.op === "Knockback" || op.op === "Push" || op.op === "Pull") {
    const distance = op.distance ?? 0;
    let dir = op.direction ?? null;
    if (!dir) {
      const from = op.op === "Pull" ? { x: targetToken.x, y: targetToken.y } : { x: state.actor.x, y: state.actor.y };
      const to = op.op === "Pull" ? { x: state.actor.x, y: state.actor.y } : { x: targetToken.x, y: targetToken.y };
      dir = directionFromTo(from, to);
    }
    if (opts.onDisplace) {
      opts.onDisplace({ state, targetId: targetToken.id, direction: dir, distance });
      logTransaction(tx, `${op.op} ${distance} (deplacement force)`, opts.onLog);
    } else {
      const dx = Math.round(dir.x * distance);
      const dy = Math.round(dir.y * distance);
      moveTokenByDelta(targetToken as any, dx, dy);
      logTransaction(tx, `${op.op} ${distance} vers (${dx}, ${dy})`, opts.onLog);
    }
    return;
  }

  if (op.op === "MoveTo") {
    if (explicitTarget?.kind !== "cell") return;
    let maxSteps: number | null = null;
    if (typeof op.maxSteps === "number") {
      maxSteps = op.maxSteps;
    } else if (typeof op.maxSteps === "string") {
      const resolved = resolveFormula(op.maxSteps, { actor: state.actor, sampleCharacter: undefined });
      const parsed = Number.parseFloat(resolved);
      if (Number.isFinite(parsed)) maxSteps = parsed;
    }
    opts.onMoveTo?.({
      state: tx.state,
      targetCell: { x: explicitTarget.x, y: explicitTarget.y },
      maxSteps
    });
    return;
  }

  if (op.op === "AddDice") {
    const roll = rollDamage(op.formula, { isCrit: false, critRule: "double-dice" });
    tx.state.rollContext = tx.state.rollContext ?? {};
    tx.state.rollContext.bonusDelta = (tx.state.rollContext.bonusDelta ?? 0) + roll.total;
    logTransaction(tx, `Bonus de jet: +${roll.total} (${op.formula})`, opts.onLog);
    return;
  }

  if (op.op === "ReplaceRoll") {
    tx.state.rollContext = tx.state.rollContext ?? {};
    tx.state.rollContext.replaceRoll = op.value;
    logTransaction(tx, `Jet remplace: ${op.value}`, opts.onLog);
    return;
  }

  if (op.op === "Reroll") {
    tx.state.rollContext = tx.state.rollContext ?? {};
    tx.state.rollContext.reroll = op.mode ?? "max";
    logTransaction(tx, `Relance jet (${op.mode ?? "max"})`, opts.onLog);
    return;
  }

  if (op.op === "SetMinimumRoll") {
    tx.state.rollContext = tx.state.rollContext ?? {};
    tx.state.rollContext.minRoll = op.value;
    logTransaction(tx, `Jet min: ${op.value}`, opts.onLog);
    return;
  }

  if (op.op === "SetMaximumRoll") {
    tx.state.rollContext = tx.state.rollContext ?? {};
    tx.state.rollContext.maxRoll = op.value;
    logTransaction(tx, `Jet max: ${op.value}`, opts.onLog);
    return;
  }

  if (op.op === "ModifyBonus") {
    tx.state.rollContext = tx.state.rollContext ?? {};
    tx.state.rollContext.bonusDelta = (tx.state.rollContext.bonusDelta ?? 0) + op.delta;
    logTransaction(tx, `Bonus modifie: ${op.delta >= 0 ? "+" : ""}${op.delta}`, opts.onLog);
    return;
  }

  if (op.op === "ModifyDC") {
    tx.state.rollContext = tx.state.rollContext ?? {};
    tx.state.rollContext.dcDelta = (tx.state.rollContext.dcDelta ?? 0) + op.delta;
    logTransaction(tx, `DC modifie: ${op.delta >= 0 ? "+" : ""}${op.delta}`, opts.onLog);
    return;
  }

  if (op.op === "LockTarget") {
    const targeting = ensureTargetingState(state, explicitTarget);
    state.targeting = { targets: targeting.targets, locked: true };
    logTransaction(tx, "Ciblage verrouille", opts.onLog);
    return;
  }

  if (op.op === "ExpandTargets") {
    const targeting = ensureTargetingState(state, explicitTarget);
    if (targeting.locked) {
      logTransaction(tx, "Ciblage verrouille (ExpandTargets ignore)", opts.onLog);
      return;
    }
    const currentIds = new Set(targeting.targets.map(t => t.id));
    const candidates = getPotentialTargets(state)
      .filter(t => t && t.hp > 0 && !currentIds.has(t.id))
      .filter(t => (opts.isTargetAllowed ? opts.isTargetAllowed(t) : true))
      .sort((a, b) => distanceBetweenTokens(state.actor, a) - distanceBetweenTokens(state.actor, b));
    const maxTargets =
      typeof state.targetingConfig?.maxTargets === "number"
        ? state.targetingConfig.maxTargets
        : null;
    const desired = Math.max(0, op.count ?? 0);
    const remaining =
      maxTargets === null ? desired : Math.max(0, maxTargets - targeting.targets.length);
    const toAdd = candidates.slice(0, Math.min(desired, remaining));
    if (toAdd.length > 0) {
      targeting.targets.push(...toAdd);
    }
    state.targeting = { targets: targeting.targets, locked: false };
    logTransaction(tx, `Ciblage etendu (+${toAdd.length})`, opts.onLog);
    return;
  }

  if (op.op === "FilterTargets") {
    const targeting = ensureTargetingState(state, explicitTarget);
    if (targeting.locked) {
      logTransaction(tx, "Ciblage verrouille (FilterTargets ignore)", opts.onLog);
      return;
    }
    if (op.tag) {
      targeting.targets = targeting.targets.filter(t => getTokenTags(t).includes(op.tag));
      state.targeting = { targets: targeting.targets, locked: false };
      logTransaction(tx, `Ciblage filtre (${op.tag})`, opts.onLog);
      return;
    }
    logTransaction(tx, "Ciblage filtre (tag manquant)", opts.onLog);
    return;
  }

  if (op.op === "Retarget") {
    const targeting = ensureTargetingState(state, explicitTarget);
    if (targeting.locked) {
      logTransaction(tx, "Ciblage verrouille (Retarget ignore)", opts.onLog);
      return;
    }
    if (op.target === "self") {
      targeting.targets = [state.actor];
      state.targeting = { targets: targeting.targets, locked: false };
      logTransaction(tx, "Ciblage retarget: self", opts.onLog);
      return;
    }
    if (op.target === "primary") {
      const primary = explicitTarget?.kind === "token" ? resolveTokenById(state, explicitTarget.token) : null;
      targeting.targets = primary ? [primary] : targeting.targets.slice(0, 1);
      state.targeting = { targets: targeting.targets, locked: false };
      logTransaction(tx, "Ciblage retarget: primary", opts.onLog);
      return;
    }
    logTransaction(tx, "Ciblage retarget: noop", opts.onLog);
    return;
  }

  if (op.op === "SpawnEntity") {
    const explicitToken =
      explicitTarget?.kind === "token"
        ? resolveTokenById(state, explicitTarget.token)
        : null;
    const targetCell =
      explicitTarget?.kind === "cell"
        ? { x: explicitTarget.x, y: explicitTarget.y }
        : explicitToken
        ? { x: explicitToken.x ?? state.actor.x, y: explicitToken.y ?? state.actor.y }
        : { x: state.actor.x, y: state.actor.y };
    const ownerId = state.actor.id;
    const ownerType = state.actor.type;
    const spawned = opts.spawnEntity
      ? opts.spawnEntity({
          entityTypeId: op.entityTypeId,
          x: targetCell.x,
          y: targetCell.y,
          ownerId,
          ownerType
        })
      : null;
    if (spawned) {
      state.enemies.push(spawned);
      logTransaction(tx, `Entite invoquee: ${op.entityTypeId}`, opts.onLog);
    } else {
      logTransaction(tx, `Invocation echouee: ${op.entityTypeId}`, opts.onLog);
    }
    return;
  }

  if (op.op === "DespawnEntity") {
    state.enemies = state.enemies.filter(enemy => enemy.id !== op.entityId);
    opts.despawnEntity?.(op.entityId);
    logTransaction(tx, `Entite retiree: ${op.entityId}`, opts.onLog);
    return;
  }

  if (op.op === "ControlSummon") {
    const ownerId = op.ownerId ?? state.actor.id;
    const ownerType = resolveTokenById(state, { id: ownerId })?.type ?? state.actor.type;
    const token = resolveTokenById(state, { id: op.entityId });
    if (token) {
      token.summonOwnerId = ownerId;
      token.summonOwnerType = ownerType;
    }
    opts.controlSummon?.({ entityId: op.entityId, ownerId });
    logTransaction(tx, `Controle invocation: ${op.entityId}`, opts.onLog);
    return;
  }

  if (op.op === "AddTag") {
    const anyToken = targetToken as any;
    anyToken.tags = Array.isArray(anyToken.tags) ? anyToken.tags : [];
    if (!anyToken.tags.includes(op.tag)) anyToken.tags.push(op.tag);
    logTransaction(tx, `Tag ajoute: ${op.tag}`, opts.onLog);
    return;
  }

  if (op.op === "RemoveTag") {
    const anyToken = targetToken as any;
    anyToken.tags = Array.isArray(anyToken.tags) ? anyToken.tags : [];
    anyToken.tags = anyToken.tags.filter((tag: string) => tag !== op.tag);
    logTransaction(tx, `Tag retire: ${op.tag}`, opts.onLog);
    return;
  }

  if (op.op === "SetFlag") {
    const anyToken = targetToken as any;
    anyToken.flags = anyToken.flags ?? {};
    anyToken.flags[op.flag] = op.value;
    logTransaction(tx, `Flag ${op.flag} = ${op.value}`, opts.onLog);
    return;
  }

  if (op.op === "ModifyPathLimit") {
    if (typeof op.delta === "number") {
      opts.onModifyPathLimit?.(op.delta);
      logTransaction(tx, `Limite de trajet modifiee (${op.delta >= 0 ? "+" : ""}${op.delta})`, opts.onLog);
    }
    return;
  }

  if (op.op === "ToggleTorch") {
    opts.onToggleTorch?.();
    return;
  }

  if (op.op === "SetKillerInstinctTarget") {
    opts.onSetKillerInstinctTarget?.(targetToken.id);
    logTransaction(tx, `Instinct de tueur: cible ${targetToken.id}`, opts.onLog);
    return;
  }

  if (op.op === "PlayVisualEffect") {
    if (op.effectId) {
      opts.onPlayVisualEffect?.({
        effectId: op.effectId,
        anchor: op.anchor,
        offset: op.offset,
        orientation: op.orientation,
        rotationOffsetDeg: op.rotationOffsetDeg,
        durationMs: op.durationMs
      });
    }
    return;
  }
}
