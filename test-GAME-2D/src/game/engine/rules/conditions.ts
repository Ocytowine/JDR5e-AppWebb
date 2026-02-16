export type EnginePhase =
  | "BUILD_INTENT"
  | "GATHER_OPTIONS"
  | "VALIDATE_LEGALITY"
  | "TARGETING"
  | "PRE_RESOLUTION_WINDOW"
  | "RESOLVE_CHECK"
  | "ON_OUTCOME"
  | "APPLY_TARGET_EFFECTS"
  | "APPLY_WORLD_EFFECTS"
  | "POST_RESOLUTION_WINDOW"
  | "COMMIT";

export type OutcomeFlag =
  | "HIT"
  | "MISS"
  | "CRIT"
  | "SAVE_SUCCESS"
  | "SAVE_FAIL"
  | "AUTO_SUCCESS"
  | "AUTO_FAIL"
  | "PARTIAL"
  | string;

export type Comparator = "EQ" | "NE" | "LT" | "LTE" | "GT" | "GTE" | "IN" | "NIN";

export type ConditionExpr =
  | { type: "ACTOR_CREATURE_TYPE_IS"; value: string }
  | { type: "TARGET_CREATURE_TYPE_IS"; value: string }
  | { type: "ACTOR_HAS_TAG"; tag: string }
  | { type: "TARGET_HAS_TAG"; tag: string }
  | { type: "ACTOR_CREATURE_HAS_TAG"; tag: string }
  | { type: "TARGET_CREATURE_HAS_TAG"; tag: string }
  | { type: "ACTOR_HAS_CONDITION"; condition: string }
  | { type: "TARGET_HAS_CONDITION"; condition: string }
  | { type: "ACTOR_CONDITION_STACKS"; condition: string; cmp: Comparator; value: number }
  | { type: "TARGET_CONDITION_STACKS"; condition: string; cmp: Comparator; value: number }
  | { type: "ACTOR_DAMAGE_IMMUNE"; damageType: string }
  | { type: "TARGET_DAMAGE_IMMUNE"; damageType: string }
  | { type: "ACTOR_DAMAGE_RESIST"; damageType: string }
  | { type: "TARGET_DAMAGE_RESIST"; damageType: string }
  | { type: "ACTOR_DAMAGE_VULNERABLE"; damageType: string }
  | { type: "TARGET_DAMAGE_VULNERABLE"; damageType: string }
  | { type: "ACTOR_HAS_RESOURCE"; key: string; cmp: Comparator; value: number }
  | { type: "TARGET_HAS_RESOURCE"; key: string; cmp: Comparator; value: number }
  | { type: "RESOURCE_AT_LEAST"; resource: string; pool?: string | null; value: number }
  | { type: "RESOURCE_AT_MOST"; resource: string; pool?: string | null; value: number }
  | { type: "HAS_RESOURCE"; who: "actor" | "target"; key: string; cmp: Comparator; value: number }
  | { type: "SLOT_AVAILABLE"; slot: string; level?: number; min?: number }
  | { type: "ACTOR_SIZE_IS"; value: string }
  | { type: "TARGET_SIZE_IS"; value: string }
  | { type: "ACTOR_CAN_MOVE"; move: string }
  | { type: "TARGET_CAN_MOVE"; move: string }
  | { type: "OUTCOME_IS"; value: OutcomeFlag }
  | { type: "OUTCOME_IN"; values: OutcomeFlag[] }
  | { type: "ROLL_AT_LEAST"; value: number }
  | { type: "ROLL_AT_MOST"; value: number }
  | { type: "OUTCOME_HAS"; flag: OutcomeFlag }
  | { type: "PHASE_IS"; value?: string; mustBe?: string }
  | { type: "DISTANCE_WITHIN"; min?: number; max?: number; target?: "primary" | "self" | string }
  | { type: "HAS_LINE_OF_SIGHT"; value?: boolean }
  | { type: "SAME_LEVEL"; value?: boolean }
  | { type: "TARGET_IN_AREA"; value?: boolean }
  | { type: "ONCE_PER_TURN"; key: string }
  | { type: "ONCE_PER_ROUND"; key: string }
  | { type: "ONCE_PER_COMBAT"; key: string }
  | { type: "NOT_USED_THIS_TURN"; key: string }
  | { type: "IS_REACTION_AVAILABLE"; value?: boolean }
  | { type: "IS_CONCENTRATING"; value?: boolean }
  | { type: "IS_SURPRISED"; value?: boolean }
  | { type: "IS_IN_LIGHT"; value?: boolean }
  | { type: "TARGET_HP_BELOW"; value: number; mode?: "percent" | "absolute" }
  | { type: "ACTOR_HP_BELOW"; value: number; mode?: "percent" | "absolute" }
  | { type: "TARGET_ALIVE"; target?: "primary" | "self" | string }
  | { type: "DISTANCE_MAX"; max: number; target?: "primary" | "self" | string }
  | { type: "DISTANCE_BETWEEN"; min?: number; max?: number; target?: "primary" | "self" | string }
  | { type: "STAT_BELOW_PERCENT"; who: "self" | "actor" | "target"; stat: string; percentMax: number }
  | { type: "ACTOR_VALUE"; key: string; cmp: Comparator; value: number }
  | { type: "TARGET_VALUE"; key: string; cmp: Comparator; value: number }
  | { type: "AND"; all: ConditionExpr[] }
  | { type: "OR"; any: ConditionExpr[] }
  | { type: "NOT"; expr: ConditionExpr };
