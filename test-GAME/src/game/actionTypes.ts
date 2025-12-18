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

export interface Condition {
  type: string;
  [key: string]: any;
  reason?: string;
}

export interface Effect {
  type: string;
  [key: string]: any;
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
  category: ActionCategory;
  actionCost: ActionCost;
  targeting: TargetingSpec;
  usage: UsageSpec;
  conditions: Condition[];
  effects: Effect[];
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
  aiHints?: AiHints;
  tags?: string[];
}

export interface ActionAvailability {
  enabled: boolean;
  reasons: string[];
  details: string[];
}
