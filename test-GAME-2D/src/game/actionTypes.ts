export type ActionCategory =
  | "attack"
  | "movement"
  | "support"
  | "defense"
  | "item"
  | "reaction"
  | string;

export type ActionCostType = "action" | "bonus" | "reaction" | "free" | string;

export interface ActionCost {
  actionType: ActionCostType;
  movementCost: number;
}

export type TargetingKind =
  | "enemy"
  | "player"
  | "hostile"
  | "ally"
  | "self"
  | "cell"
  | "emptyCell"
  | string;

export type RangeShape =
  | "single"
  | "line"
  | "cone"
  | "circle"
  | "rectangle"
  | "self"
  | "SPHERE"
  | "CONE"
  | "LINE"
  | "CUBE"
  | "CYLINDER"
  | string;

export interface RangeSpec {
  min: number;
  max: number;
  shape: RangeShape;
}

export interface TargetingSpec {
  target: TargetingKind;
  range: RangeSpec;
  maxTargets: number;
  requiresLos: boolean;
}

export interface ResourceUsage {
  name: string;
  pool?: string | null;
  min?: number | null;
}

export interface UsageSpec {
  perTurn: number | null;
  perEncounter: number | null;
  resource?: ResourceUsage | null;
}

export type Condition = import("./conditions").ConditionExpr & {
  reason?: string;
};

export interface ActionOp {
  op: string;
  [key: string]: any;
}

export interface ConditionalOps {
  onResolve?: ActionOp[];
  onHit?: ActionOp[];
  onMiss?: ActionOp[];
  onCrit?: ActionOp[];
  onSaveSuccess?: ActionOp[];
  onSaveFail?: ActionOp[];
}

export interface AiHints {
  priority?: string;
  successLog?: string;
  failureLog?: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  summary?: string;
  uiMessageHit?: string;
  uiMessageMiss?: string;
  category: ActionCategory;
  actionCost: ActionCost;
  targeting: TargetingSpec;
  usage: UsageSpec;
  conditions: Condition[];
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
  resolution?: {
    kind:
      | "ATTACK_ROLL"
      | "SAVING_THROW"
      | "ABILITY_CHECK"
      | "CONTESTED_CHECK"
      | "NO_ROLL";
    bonus?: number;
    critRange?: number;
    critRule?: "double-dice" | "double-total";
    save?: {
      ability: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA";
      dc: number;
    };
    check?: {
      ability: "FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA";
      dc: number;
    };
  };
  ops?: ConditionalOps;
  reactionWindows?: Array<"pre" | "post">;
  aiHints?: AiHints;
  tags?: string[];
}

export interface ActionAvailability {
  enabled: boolean;
  reasons: string[];
  details: string[];
}
