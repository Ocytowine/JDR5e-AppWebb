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

  if (op.op === "SpendResource") {
    opts.spendResource?.(op.name, op.pool ?? null, op.amount);
    logTransaction(tx, `Ressource depensee: ${op.name} -${op.amount}`, opts.onLog);
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
