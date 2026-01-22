import type { ActionAvailability, ActionDefinition } from "./actionTypes";
import type { AttackRollResult, DamageRollResult } from "../dice/roller";

export type ActionStepType =
  | "validate"
  | "resource"
  | "target"
  | "attack-roll"
  | "damage-roll";

export type ActionStepStatus = "locked" | "available" | "done" | "blocked";

export interface ActionStep {
  id: string;
  type: ActionStepType;
  title: string;
  status: ActionStepStatus;
  detail?: string;
}

export interface ActionPlan {
  steps: ActionStep[];
}

export function buildActionPlan(params: {
  action: ActionDefinition | null;
  availability: ActionAvailability | null;
  stage: "draft" | "active";
  needsTarget: boolean;
  targetSelected: boolean;
  hasAttack: boolean;
  hasDamage: boolean;
  attackRoll: AttackRollResult | null;
  damageRoll: DamageRollResult | null;
  attackOutcome: "hit" | "miss" | null;
  resource?: { label: string; current: number; min: number } | null;
}): ActionPlan {
  const steps: ActionStep[] = [];

  if (!params.action) return { steps };

  if (params.stage === "draft") {
    const blocked = params.availability ? !params.availability.enabled : false;
    steps.push({
      id: "validate",
      type: "validate",
      title: "Valider l'action",
      status: blocked ? "blocked" : "available",
      detail: blocked ? "Action indisponible." : undefined
    });
  }

  if (params.resource) {
    const hasEnough = params.resource.current >= params.resource.min;
    steps.push({
      id: "resource",
      type: "resource",
      title: `${params.resource.label}: ${params.resource.current}/${params.resource.min}`,
      status: hasEnough ? "done" : "blocked",
      detail: hasEnough ? undefined : "Ressource insuffisante."
    });
  }

  if (params.needsTarget) {
    let status: ActionStepStatus = "locked";
    if (params.stage === "active") {
      status = params.targetSelected ? "done" : "available";
    }
    steps.push({
      id: "target",
      type: "target",
      title: "Selectionner une cible",
      status
    });
  }

  if (params.hasAttack) {
    let status: ActionStepStatus = "locked";
    if (params.stage === "active" && (!params.needsTarget || params.targetSelected)) {
      status = params.attackRoll ? "done" : "available";
    }
    steps.push({
      id: "attack-roll",
      type: "attack-roll",
      title: "Jet de touche",
      status
    });
  }

  if (params.hasDamage) {
    let status: ActionStepStatus = "locked";
    let detail: string | undefined;
    if (params.hasAttack) {
      if (params.attackOutcome === "miss") {
        status = "blocked";
        detail = "Attaque ratee.";
      } else if (params.attackOutcome === "hit") {
        status = params.damageRoll ? "done" : "available";
      } else {
        status = params.attackRoll ? "available" : "locked";
      }
    } else if (params.stage === "active") {
      status = params.damageRoll ? "done" : "available";
    }
    steps.push({
      id: "damage-roll",
      type: "damage-roll",
      title: "Jet de degats",
      status,
      detail
    });
  }

  return { steps };
}
