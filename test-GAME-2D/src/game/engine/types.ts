import type { TargetingSpec } from "../actionTypes";
import type { TokenState } from "../../types";
import type { EffectInstance } from "../effectTypes";
import type { AttackRollResult, DamageRollResult } from "../../dice/roller";
import type { ConditionExpr } from "../conditions";

export type OutcomeKey = "hit" | "miss" | "crit" | "saveSuccess" | "saveFail";

export interface ResolutionSpec {
  kind: "attack" | "save" | "check" | "none";
  bonus?: number;
  critRange?: number;
  critRule?: "double-dice" | "double-total";
  save?: {
    ability: "str" | "dex" | "con" | "int" | "wis" | "cha";
    dc: number;
  };
  check?: {
    ability: "str" | "dex" | "con" | "int" | "wis" | "cha";
    dc: number;
  };
}

export interface Outcome {
  kind: OutcomeKey;
  roll: number;
  total: number;
  isCrit?: boolean;
}

interface PromptSpec {
  message: string;
  defaultDecision?: "accept" | "reject";
}

export interface Hook {
  when: "pre_resolution" | "post_resolution" | "on_outcome" | "on_apply";
  if?: ConditionExpr[];
  prompt?: PromptSpec;
  apply: Operation[];
}

export type TargetSelector = "primary" | "self";

export type Operation =
  | {
      op: "DealDamage";
      target: TargetSelector;
      formula: string;
      damageType?: string;
      scale?: "half";
    }
  | { op: "Heal"; target: TargetSelector; formula: string }
  | { op: "ApplyCondition"; target: TargetSelector; statusId: string; durationTurns: number }
  | { op: "CreateZone"; effectTypeId: string; target: "cell" | "self" }
  | { op: "SpendResource"; name: string; pool?: string | null; amount: number }
  | { op: "MoveForced"; target: TargetSelector; to?: { x: number; y: number } }
  | { op: "MoveTo"; target: TargetSelector; maxSteps?: number }
  | { op: "GrantTempHp"; target: TargetSelector; amount: number; durationTurns?: number | string }
  | { op: "ModifyPathLimit"; delta: number }
  | { op: "ToggleTorch" }
  | { op: "SetKillerInstinctTarget"; target: TargetSelector }
  | {
      op: "PlayVisualEffect";
      effectId: string;
      anchor?: "target" | "self" | "actor";
      offset?: { x: number; y: number };
      orientation?: "to_target" | "to_actor" | "none";
      rotationOffsetDeg?: number;
      durationMs?: number;
    }
  | { op: "LogEvent"; message: string };

export interface ConditionalEffects {
  onResolve?: Operation[];
  onHit?: Operation[];
  onMiss?: Operation[];
  onCrit?: Operation[];
  onSaveSuccess?: Operation[];
  onSaveFail?: Operation[];
}

export interface ActionSpec {
  id: string;
  name: string;
  summary?: string;
  targeting?: TargetingSpec;
  resolution?: ResolutionSpec;
  effects?: ConditionalEffects;
  reactionWindows?: Array<"pre" | "post">;
  hooks?: Hook[];
  tags?: string[];
}

export interface ActionPlan {
  action: ActionSpec;
  actor: TokenState;
  target?: TokenState | { x: number; y: number } | null;
  hooks: Hook[];
  reactionWindows: Array<"pre" | "post">;
}

export interface EngineState {
  round: number;
  phase: "player" | "enemies";
  actor: TokenState;
  player: TokenState;
  enemies: TokenState[];
  effects: EffectInstance[];
}

export interface ExecuteOptions {
  getResourceAmount?: (name: string, pool?: string | null) => number;
  spendResource?: (name: string, pool: string | null, amount: number) => void;
  promptHandler?: (prompt: PromptSpec) => "accept" | "reject";
  onReactionWindow?: (phase: "pre" | "post") => "continue" | "interrupt";
  onLog?: (message: string) => void;
  rollOverrides?: {
    attack?: AttackRollResult | null;
    consumeDamageRoll?: () => DamageRollResult | null;
  };
  onMoveTo?: (params: {
    state: EngineState;
    targetCell: { x: number; y: number };
    maxSteps?: number | null;
  }) => void;
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
