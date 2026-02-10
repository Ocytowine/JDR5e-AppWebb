import { rollDamage } from "../../dice/roller";
import { resolveFormula } from "./formulas";
import type { EngineState, ExecuteOptions, Operation, TargetSelector } from "./types";
import type { Transaction } from "./transaction";
import { logTransaction } from "./transaction";

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
    tx.state.effects.push({
      id,
      typeId: op.effectTypeId,
      x: targetCell.x,
      y: targetCell.y,
      active: true
    });
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
    tx.state.effects.push({
      id,
      typeId: op.effectTypeId,
      x: targetCell.x,
      y: targetCell.y,
      active: true,
      kind: "surface"
    } as any);
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
    const tempHp = typeof targetToken.tempHp === "number" ? targetToken.tempHp : 0;
    if (tempHp > 0) {
      const remaining = Math.max(0, total - tempHp);
      targetToken.tempHp = Math.max(0, tempHp - total);
      targetToken.hp = Math.max(0, targetToken.hp - remaining);
    } else {
      targetToken.hp = Math.max(0, targetToken.hp - total);
    }
    logTransaction(tx, `Degats: ${total} (${formula})`, opts.onLog);
    return;
  }

  if (op.op === "DealDamageScaled") {
    const formula = resolveFormula(op.formula, { actor: state.actor, sampleCharacter: undefined });
    const roll = rollDamage(formula, { isCrit: false, critRule: "double-dice" });
    const total = op.scale === "quarter" ? Math.floor(roll.total / 4) : Math.floor(roll.total / 2);
    const tempHp = typeof targetToken.tempHp === "number" ? targetToken.tempHp : 0;
    if (tempHp > 0) {
      const remaining = Math.max(0, total - tempHp);
      targetToken.tempHp = Math.max(0, tempHp - total);
      targetToken.hp = Math.max(0, targetToken.hp - remaining);
    } else {
      targetToken.hp = Math.max(0, targetToken.hp - total);
    }
    logTransaction(tx, `Degats reduits: ${total} (${formula})`, opts.onLog);
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
    targetToken.hp = Math.min(targetToken.maxHp, targetToken.hp + total);
    logTransaction(tx, `Soin: +${total} (${formula})`, opts.onLog);
    return;
  }

  if (op.op === "ApplyCondition") {
    const statuses = targetToken.statuses ? [...targetToken.statuses] : [];
    statuses.push({ id: op.statusId, remainingTurns: op.durationTurns, sourceId: state.actor.id });
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
    (targetToken as any).concentration = {
      sourceId: op.sourceId ?? state.actor.id,
      effectId: op.effectId ?? null
    };
    logTransaction(tx, `Concentration demarree`, opts.onLog);
    return;
  }

  if (op.op === "BreakConcentration") {
    (targetToken as any).concentration = null;
    logTransaction(tx, `Concentration interrompue`, opts.onLog);
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
    targetToken.x = op.to.x;
    targetToken.y = op.to.y;
    logTransaction(tx, `Deplacement force vers (${op.to.x}, ${op.to.y})`, opts.onLog);
    return;
  }

  if (op.op === "Teleport") {
    targetToken.x = op.to.x;
    targetToken.y = op.to.y;
    logTransaction(tx, `Teleportation vers (${op.to.x}, ${op.to.y})`, opts.onLog);
    return;
  }

  if (op.op === "SwapPositions") {
    const ax = state.actor.x;
    const ay = state.actor.y;
    state.actor.x = targetToken.x;
    state.actor.y = targetToken.y;
    targetToken.x = ax;
    targetToken.y = ay;
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
    const dx = Math.round(dir.x * distance);
    const dy = Math.round(dir.y * distance);
    moveTokenByDelta(targetToken as any, dx, dy);
    logTransaction(tx, `${op.op} ${distance} vers (${dx}, ${dy})`, opts.onLog);
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

  if (op.op === "LockTarget" || op.op === "ExpandTargets" || op.op === "FilterTargets" || op.op === "Retarget") {
    logTransaction(tx, `Ciblage modifie (${op.op})`, opts.onLog);
    return;
  }

  if (op.op === "SpawnEntity") {
    logTransaction(tx, `Entite invoquee: ${op.entityTypeId}`, opts.onLog);
    return;
  }

  if (op.op === "DespawnEntity") {
    logTransaction(tx, `Entite retiree: ${op.entityId}`, opts.onLog);
    return;
  }

  if (op.op === "ControlSummon") {
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
