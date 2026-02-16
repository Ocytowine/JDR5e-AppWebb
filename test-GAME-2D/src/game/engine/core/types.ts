import type { TargetingSpec } from "../rules/actionTypes";
import type { TokenState, TokenType } from "../../../types";
import type { EffectInstance } from "../../effectTypes";
import type { AttackRollResult, DamageRollResult } from "../../../dice/roller";
import type { ConditionExpr } from "../rules/conditions";

export type OutcomeKey =
  | "hit"
  | "miss"
  | "crit"
  | "saveSuccess"
  | "saveFail"
  | "checkSuccess"
  | "checkFail"
  | "contestedWin"
  | "contestedLose";

export interface ResolutionSpec {
  kind: "ATTACK_ROLL" | "SAVING_THROW" | "ABILITY_CHECK" | "NO_ROLL" | "CONTESTED_CHECK";
  bonus?: number;
  critRange?: number;
  critRule?: "double-dice" | "double-total";
  save?: {
    ability: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA";
    dc: number;
    dcFormula?: string;
  };
  check?: {
    ability: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA";
    dc: number;
  };
  contested?: {
    actorAbility: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA";
    targetAbility: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA";
    actorBonus?: number;
    targetBonus?: number;
    tieWinner?: "actor" | "target";
  };
}

export interface Outcome {
  kind: OutcomeKey;
  roll: number;
  total: number;
  isCrit?: boolean;
  contested?: {
    actorRoll: number;
    actorTotal: number;
    targetRoll: number;
    targetTotal: number;
  };
}

interface PromptSpec {
  message: string;
  defaultDecision?: "accept" | "reject";
}

export interface Hook {
  when:
    | "pre_resolution"
    | "post_resolution"
    | "on_outcome"
    | "on_apply"
    | "PRE_RESOLUTION_WINDOW"
    | "POST_RESOLUTION_WINDOW"
    | "ON_OUTCOME"
    | "APPLY_TARGET_EFFECTS"
    | "APPLY_WORLD_EFFECTS"
    | "COMMIT"
    | "onIntentBuild"
    | "onOptionsResolve"
    | "onValidate"
    | "onTargeting"
    | "preResolution"
    | "onResolve"
    | "onOutcome"
    | "beforeApply"
    | "afterApply"
    | "postResolution"
    | "beforeCommit"
    | "afterCommit"
    | "onTurnStart"
    | "onTurnEnd"
    | "onRoundStart"
    | "onRoundEnd"
    | "onInterrupt"
    | "onCounter";
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
  | {
      op: "DealDamageScaled";
      target: TargetSelector;
      formula: string;
      damageType?: string;
      scale: "half" | "quarter";
    }
  | {
      op: "ApplyDamageTypeMod";
      target: TargetSelector;
      mode: "resistance" | "vulnerability" | "immunity";
      damageType: string;
    }
  | { op: "Heal"; target: TargetSelector; formula: string }
  | { op: "ApplyCondition"; target: TargetSelector; statusId: string; durationTurns: number }
  | { op: "RemoveCondition"; target: TargetSelector; statusId: string }
  | { op: "ExtendCondition"; target: TargetSelector; statusId: string; durationTurns: number }
  | { op: "SetConditionStack"; target: TargetSelector; statusId: string; stacks: number }
  | { op: "StartConcentration"; target: TargetSelector; sourceId?: string; effectId?: string }
  | { op: "BreakConcentration"; target: TargetSelector }
  | { op: "CreateZone"; effectTypeId: string; target: "cell" | "self" }
  | { op: "RemoveZone"; zoneId?: string; effectTypeId?: string }
  | { op: "ModifyZone"; zoneId: string; active?: boolean; x?: number; y?: number }
  | { op: "CreateSurface"; effectTypeId: string; target: "cell" | "self" }
  | { op: "RemoveSurface"; surfaceId?: string; effectTypeId?: string }
  | { op: "ApplyAura"; effectTypeId: string; target: TargetSelector }
  | { op: "SpendResource"; name: string; pool?: string | null; amount: number }
  | { op: "RestoreResource"; name: string; pool?: string | null; amount: number }
  | { op: "ConsumeSlot"; slot: string; level?: number; amount?: number }
  | { op: "RestoreSlot"; slot: string; level?: number; amount?: number }
  | { op: "SetResource"; name: string; pool?: string | null; amount: number }
  | { op: "MoveForced"; target: TargetSelector; to?: { x: number; y: number } }
  | { op: "Teleport"; target: TargetSelector; to: { x: number; y: number } }
  | { op: "SwapPositions"; target: TargetSelector }
  | { op: "Knockback"; target: TargetSelector; distance: number; direction?: { x: number; y: number } }
  | { op: "Pull"; target: TargetSelector; distance: number; direction?: { x: number; y: number } }
  | { op: "Push"; target: TargetSelector; distance: number; direction?: { x: number; y: number } }
  | { op: "MoveTo"; target: TargetSelector; maxSteps?: number }
  | { op: "GrantTempHp"; target: TargetSelector; amount: number; durationTurns?: number | string }
  | { op: "ModifyPathLimit"; delta: number }
  | { op: "ToggleTorch" }
  | { op: "SetKillerInstinctTarget"; target: TargetSelector }
  | { op: "AddDice"; formula: string }
  | { op: "ReplaceRoll"; value: number }
  | { op: "Reroll"; mode?: "max" | "min" }
  | { op: "SetMinimumRoll"; value: number }
  | { op: "SetMaximumRoll"; value: number }
  | { op: "ModifyBonus"; delta: number }
  | { op: "ModifyDC"; delta: number }
  | { op: "LockTarget"; target: TargetSelector }
  | { op: "ExpandTargets"; count: number }
  | { op: "FilterTargets"; tag?: string }
  | { op: "Retarget"; target: TargetSelector }
  | { op: "SpawnEntity"; entityTypeId: string; target?: TargetSelector }
  | { op: "DespawnEntity"; entityId: string }
  | { op: "ControlSummon"; entityId: string; ownerId?: string }
  | { op: "AddTag"; target: TargetSelector; tag: string }
  | { op: "RemoveTag"; target: TargetSelector; tag: string }
  | { op: "SetFlag"; target: TargetSelector; flag: string; value: boolean }
  | {
      op: "PlayVisualEffect";
      effectId: string;
      anchor?: "target" | "self" | "actor";
      offset?: { x: number; y: number };
      orientation?: "to_target" | "to_actor" | "none";
      rotationOffsetDeg?: number;
      durationMs?: number;
    }
  | { op: "LogEvent"; message: string }
  | { op: "EmitEvent"; kind: string; data?: Record<string, unknown> };

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
  target?: TokenState | { x: number; y: number } | { kind: "tokens"; tokens: TokenState[] } | null;
  hooks: Hook[];
  reactionWindows: Array<"pre" | "post">;
}

export interface TargetingState {
  targets?: TokenState[];
  locked?: boolean;
}

export interface TargetingConfig {
  target?: TargetingSpec["target"] | null;
  maxTargets?: number | null;
}

export interface EngineState {
  round: number;
  phase: "player" | "enemies";
  actor: TokenState;
  player: TokenState;
  enemies: TokenState[];
  effects: EffectInstance[];
  targeting?: TargetingState;
  targetingConfig?: TargetingConfig;
  concentrationLink?: { sourceId: string; effectId?: string | null };
  rollContext?: {
    bonusDelta?: number;
    dcDelta?: number;
    replaceRoll?: number;
    reroll?: "max" | "min";
    minRoll?: number;
    maxRoll?: number;
  };
}

export interface ExecuteOptions {
  getResourceAmount?: (name: string, pool?: string | null) => number;
  spendResource?: (name: string, pool: string | null, amount: number) => void;
  restoreResource?: (name: string, pool: string | null, amount: number) => void;
  setResource?: (name: string, pool: string | null, amount: number) => void;
  consumeSlot?: (slot: string, level?: number, amount?: number) => void;
  restoreSlot?: (slot: string, level?: number, amount?: number) => void;
  getSlotAmount?: (slot: string, level?: number) => number;
  isTargetAllowed?: (token: TokenState) => boolean;
  spawnEntity?: (params: {
    entityTypeId: string;
    x: number;
    y: number;
    ownerId: string;
    ownerType: TokenType;
  }) => TokenState | null;
  despawnEntity?: (entityId: string) => void;
  controlSummon?: (params: { entityId: string; ownerId: string }) => void;
  promptHandler?: (prompt: PromptSpec) => "accept" | "reject";
  onReactionWindow?: (phase: "pre" | "post") => "continue" | "interrupt";
  onLog?: (message: string) => void;
  onEmitEvent?: (evt: { kind: string; data?: Record<string, unknown> }) => void;
  rollOverrides?: {
    attack?: AttackRollResult | null;
    consumeDamageRoll?: () => DamageRollResult | null;
  };
  damageContext?: {
    isCrit?: boolean;
    critRule?: "double-dice" | "double-total";
  };
  onMoveTo?: (params: {
    state: EngineState;
    targetCell: { x: number; y: number };
    maxSteps?: number | null;
  }) => void;
  onMoveForced?: (params: {
    state: EngineState;
    targetId: string;
    to: { x: number; y: number };
  }) => void;
  onTeleport?: (params: { state: EngineState; targetId: string; to: { x: number; y: number } }) => void;
  onSwapPositions?: (params: { state: EngineState; aId: string; bId: string }) => void;
  onDisplace?: (params: {
    state: EngineState;
    targetId: string;
    direction: { x: number; y: number };
    distance: number;
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


