# Taxonomie officielle (taxonomy.json)

Ce document decrit la taxonomie officielle telle que definie dans `src/data/models/taxonomy.json`.
Objectif: fournir la reference exacte des champs et enums actuellement acceptes par les JSON de gameplay.

## Principes

1. Pipeline stable: les JSON ne modifient pas les phases.
2. JSON declaratifs: ils decrivent intentions, conditions, hooks, operations.
3. Operations atomiques: petites briques composees par conditions et branches d'issue.
4. Hooks standardises: timings fixes et previsible.

## Phases du pipeline (reference)

1. Build Intent
2. Gather/Resolve Options
3. Validate legality
4. Targeting
5. Pre-resolution reaction window(s)
6. Resolve check (attack/save/check/contested/none)
7. Outcome branching (onHit/onMiss/onSaveFail/onSaveSuccess/onCrit)
8. Apply effects to targets
9. Apply effects to world/context
10. Post-resolution reaction window(s)
11. Commit transaction + event log

## Etat d'implementation (engine)

Le moteur d'execution supporte:
- La sequence complete des phases via hooks (onIntentBuild -> afterCommit).
- Les hooks sont evaluates via `conditions` et peuvent appliquer des `operations`.

## Champs globaux (taxonomy.json)

- id
- version
- description
- units
- unitsFields
- sources
- creatureTypes
- sizeCategories
- movementTypes
- damageTypes (lowercase)
- damageTags
- conditionTypes
- senses
- abilities
- resolutionTypes
- attackKinds
- outcomeFlags
- targetingConstraints
- areaShapes
- enginePhases
- action
- moveType
- enemy
- character
- weapon
- reaction
- visualEffectType
- map
- race
- passif
- currency
- restTypes
- commonFlags
- formulaTokens
- runtimeSupport
- tags

## Concepts

### ActionSpec (section `action`)
- model: "./action-model.json"
- category:
  - attack
  - movement
  - support
  - control
  - defense
  - item
  - reaction
- actionCost:
  - actionType: action | bonus | reaction | free
  - movementCost: number
- targeting:
  - target: enemy | player | hostile | ally | self | cell | emptyCell
  - range.shape: SPHERE | CONE | LINE | CUBE | CYLINDER
  - range.min: number
  - range.max: number
  - maxTargets: number
  - requiresLos: boolean
- usage:
  - perTurn: number|null
  - perEncounter: number|null
  - resource:
    - name: string
    - pool: string|null
    - min: number|null
- resolution:
  - kind: ATTACK_ROLL | SAVING_THROW | ABILITY_CHECK | CONTESTED_CHECK | NO_ROLL
  - critRule: double-dice | double-total
  - contested (si kind = CONTESTED_CHECK):
    - actorAbility: FOR|DEX|CON|INT|SAG|CHA
    - targetAbility: FOR|DEX|CON|INT|SAG|CHA
    - actorBonus?: number
    - targetBonus?: number
    - tieWinner?: actor | target
- attack:
  - bonus: number
  - critRange: number (default 20)
- damage:
  - formula: string
  - critRule: double-dice | double-total
  - damageType: damageTypeId (lowercase)
- conditions.types:
  - ACTOR_CREATURE_TYPE_IS
  - TARGET_CREATURE_TYPE_IS
  - ACTOR_HAS_TAG
  - TARGET_HAS_TAG
  - ACTOR_CREATURE_HAS_TAG
  - TARGET_CREATURE_HAS_TAG
  - ACTOR_HAS_CONDITION
  - TARGET_HAS_CONDITION
  - ACTOR_CONDITION_STACKS
  - TARGET_CONDITION_STACKS
  - ACTOR_DAMAGE_IMMUNE
  - TARGET_DAMAGE_IMMUNE
  - ACTOR_DAMAGE_RESIST
  - TARGET_DAMAGE_RESIST
  - ACTOR_DAMAGE_VULNERABLE
  - TARGET_DAMAGE_VULNERABLE
  - ACTOR_HAS_RESOURCE
  - TARGET_HAS_RESOURCE
  - ACTOR_SIZE_IS
  - TARGET_SIZE_IS
  - ACTOR_CAN_MOVE
  - TARGET_CAN_MOVE
  - ACTOR_ALIVE
  - TARGET_ALIVE
  - REACTION_AVAILABLE
  - REACTION_UNUSED_COMBAT
  - DISTANCE_MAX
  - DISTANCE_BETWEEN
  - RESOURCE_AT_LEAST
  - STAT_BELOW_PERCENT
  - OUTCOME_HAS
  - PHASE_IS
  - ACTOR_VALUE
  - TARGET_VALUE
  - TARGET_FIRST_SEEN
  - TARGET_IS_CLOSEST_VISIBLE
  - TARGET_IN_AREA
  - SAME_LEVEL
  - HAS_LINE_OF_SIGHT
  - IS_IN_LIGHT
  - IS_REACTION_AVAILABLE
  - IS_CONCENTRATING
  - IS_SURPRISED
  - ONCE_PER_TURN
  - ONCE_PER_ROUND
  - ONCE_PER_COMBAT
  - OUTCOME_IS
  - OUTCOME_IN
  - ROLL_IS
  - ROLL_AT_LEAST
  - ROLL_AT_MOST
  - ROLL_BETWEEN
  - ROLL_IN
  - ROLL_NOT_IN
  - HP_BELOW
  - HAS_RESOURCE
  - SLOT_AVAILABLE
  - ACTOR_SENSES
  - AND
  - OR
  - NOT
- ops:
  - DealDamage
  - DealDamageScaled
  - Heal
  - ApplyCondition
  - RemoveCondition
  - ExtendCondition
  - SetConditionStack
  - StartConcentration
  - BreakConcentration
  - CreateZone
  - RemoveZone
  - ModifyZone
  - CreateSurface
  - RemoveSurface
  - ApplyAura
  - SpendResource
  - RestoreResource
  - SetResource
  - ConsumeSlot
  - RestoreSlot
  - MoveForced
  - Teleport
  - SwapPositions
  - Knockback
  - Pull
  - Push
  - MoveTo
  - GrantTempHp
  - ModifyPathLimit
  - ToggleTorch
  - SetKillerInstinctTarget
  - AddDice
  - ReplaceRoll
  - Reroll
  - SetMinimumRoll
  - SetMaximumRoll
  - ModifyBonus
  - ModifyDC
  - AddTag
  - RemoveTag
  - SetFlag
  - LogEvent
  - EmitEvent
  - LockTarget
  - ExpandTargets
  - FilterTargets
  - Retarget
  - SpawnEntity
  - DespawnEntity
  - ControlSummon
- hooks.phases:
  - BUILD_INTENT
  - GATHER_OPTIONS
  - VALIDATE_LEGALITY
  - TARGETING
  - PRE_RESOLUTION_WINDOW
  - RESOLVE_CHECK
  - ON_OUTCOME
  - APPLY_TARGET_EFFECTS
  - APPLY_WORLD_EFFECTS
  - POST_RESOLUTION_WINDOW
  - COMMIT
- outcomes:
  - HIT
  - MISS
  - CRIT
  - SAVE_SUCCESS
  - SAVE_FAIL
  - AUTO_SUCCESS
  - AUTO_FAIL
  - PARTIAL
- tags.reserved:
  - move-type

### FeatureSpec
Non formalise dans `taxonomy.json` (a documenter lors de l'extension).

### ActionPlan
Non formalise dans `taxonomy.json` (a documenter lors de l'extension).

### Outcome
Les flags officiels sont listes dans `outcomeFlags` (voir `action.outcomes`).

### Operation
Liste officielle dans `action.ops`.

### Hook
Phases officielles dans `action.hooks.phases` (voir `enginePhases`).

## Taxonomie des operations (officielle)

- DealDamage
- DealDamageScaled
- Heal
- ApplyCondition
- RemoveCondition
- ExtendCondition
- SetConditionStack
- StartConcentration
- BreakConcentration
- CreateZone
- RemoveZone
- ModifyZone
- CreateSurface
- RemoveSurface
- ApplyAura
- SpendResource
- RestoreResource
- SetResource
- ConsumeSlot
- RestoreSlot
- MoveForced
- Teleport
- SwapPositions
- Knockback
- Pull
- Push
- MoveTo
- GrantTempHp
- ModifyPathLimit
- ToggleTorch
- SetKillerInstinctTarget
- AddDice
- ReplaceRoll
- Reroll
- SetMinimumRoll
- SetMaximumRoll
- ModifyBonus
- ModifyDC
- AddTag
- RemoveTag
- SetFlag
- LogEvent
- EmitEvent
- LockTarget
- ExpandTargets
- FilterTargets
- Retarget
- SpawnEntity
- DespawnEntity
- ControlSummon

## Taxonomie des conditions (if) officielle

- ACTOR_CREATURE_TYPE_IS
- TARGET_CREATURE_TYPE_IS
- ACTOR_HAS_TAG
- TARGET_HAS_TAG
- ACTOR_CREATURE_HAS_TAG
- TARGET_CREATURE_HAS_TAG
- ACTOR_HAS_CONDITION
- TARGET_HAS_CONDITION
- ACTOR_CONDITION_STACKS
- TARGET_CONDITION_STACKS
- ACTOR_DAMAGE_IMMUNE
- TARGET_DAMAGE_IMMUNE
- ACTOR_DAMAGE_RESIST
- TARGET_DAMAGE_RESIST
- ACTOR_DAMAGE_VULNERABLE
- TARGET_DAMAGE_VULNERABLE
- ACTOR_HAS_RESOURCE
- TARGET_HAS_RESOURCE
- ACTOR_SIZE_IS
- TARGET_SIZE_IS
- ACTOR_CAN_MOVE
- TARGET_CAN_MOVE
- ACTOR_ALIVE
- TARGET_ALIVE
- REACTION_AVAILABLE
- REACTION_UNUSED_COMBAT
- DISTANCE_MAX
- DISTANCE_BETWEEN
- RESOURCE_AT_LEAST
- STAT_BELOW_PERCENT
- OUTCOME_HAS
- PHASE_IS
- ACTOR_VALUE
- TARGET_VALUE
- TARGET_FIRST_SEEN
- TARGET_IS_CLOSEST_VISIBLE
- TARGET_IN_AREA
- SAME_LEVEL
- HAS_LINE_OF_SIGHT
- IS_IN_LIGHT
- IS_REACTION_AVAILABLE
- IS_CONCENTRATING
- IS_SURPRISED
- ONCE_PER_TURN
- ONCE_PER_ROUND
- ONCE_PER_COMBAT
- OUTCOME_IS
- OUTCOME_IN
- ROLL_IS
- ROLL_AT_LEAST
- ROLL_AT_MOST
- ROLL_BETWEEN
- ROLL_IN
- ROLL_NOT_IN
- HP_BELOW
- HAS_RESOURCE
- SLOT_AVAILABLE
- ACTOR_SENSES
- AND
- OR
- NOT

## Taxonomie des hooks (when) officielle

Les hooks utilisent les phases `enginePhases`:
- BUILD_INTENT
- GATHER_OPTIONS
- VALIDATE_LEGALITY
- TARGETING
- PRE_RESOLUTION_WINDOW
- RESOLVE_CHECK
- ON_OUTCOME
- APPLY_TARGET_EFFECTS
- APPLY_WORLD_EFFECTS
- POST_RESOLUTION_WINDOW
- COMMIT

## Outcomes (officiels)

- HIT
- MISS
- CRIT
- SAVE_SUCCESS
- SAVE_FAIL
- AUTO_SUCCESS
- AUTO_FAIL
- PARTIAL
- CHECK_SUCCESS
- CHECK_FAIL
- CONTESTED_WIN
- CONTESTED_LOSE

## Ressources (examples)

- action/bonus/reaction/free
- spellSlots (levelled)
- ki, rage, superiorityDice, channelDivinity
- itemCharges

## Tags/Flags (examples)

- weapon:melee, weapon:ranged
- spell:evocation
- damage:fire
- concentration
- magical
- aura
- summon

## Exemple JSON (pattern)

```json
{
  "id": "melee-strike",
  "name": "Frappe basique",
  "actionCost": { "actionType": "action" },
  "targeting": {
    "target": "hostile",
    "range": { "min": 0, "max": 1, "shape": "SPHERE" },
    "maxTargets": 1,
    "requiresLos": true
  },
  "resolution": { "kind": "ATTACK_ROLL", "bonus": 5, "critRange": 20 },
  "effects": {
    "onHit": [
      { "op": "DealDamage", "target": "primary", "formula": "1d8+modFOR", "damageType": "slashing" }
    ],
    "onCrit": [
      { "op": "DealDamage", "target": "primary", "formula": "1d8", "damageType": "slashing" }
    ]
  },
  "reactionWindows": ["pre", "post"]
}
```

## Annexe A - Taxonomie DND2024 (TypeScript)

```ts
/* ============================================================================ 
 * dnd2024.taxonomy.ts
 * Single-file taxonomy for a D&D 2024-ish rules engine (data-driven).
 * - No examples included.
* - Focus: creature typing, damage typing, conditions, tags, expressions, durations.
 * ========================================================================== */

export type ID = string;

/* --------------------------------- Creature -------------------------------- */

export type CreatureType =
  | "ABERRATION"
  | "BEAST"
  | "CELESTIAL"
  | "CONSTRUCT"
  | "DRAGON"
  | "ELEMENTAL"
  | "FEY"
  | "FIEND"
  | "GIANT"
  | "HUMANOID"
  | "MONSTROSITY"
  | "OOZE"
  | "PLANT"
  | "UNDEAD";

/**
 * Flexible subtypes / descriptors.
 * Keep as string to avoid recompile when you add new tags (e.g., "VAMPIRE", "DEVIL", "GOBLINOID").
 */
export type CreatureTag = string;

/** Size categories commonly used by D&D rules. */
export type SizeCategory =
  | "TINY"
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "HUGE"
  | "GARGANTUAN";

/** Movement types for rules & targeting constraints. */
export type MovementType =
  | "WALK"
  | "CLIMB"
  | "SWIM"
  | "FLY"
  | "BURROW";

/* --------------------------------- Damage ---------------------------------- */

export type DamageType =
  | "ACID"
  | "BLUDGEONING"
  | "COLD"
  | "FIRE"
  | "FORCE"
  | "LIGHTNING"
  | "NECROTIC"
  | "PIERCING"
  | "POISON"
  | "PSYCHIC"
  | "RADIANT"
  | "SLASHING"
  | "THUNDER";

/**
 * Extra qualifiers that often matter for resist/immunity logic and special rules.
 * Keep this open-ended; your content can add tags without code changes.
 */
export type DamageTag =
  | "MAGICAL"
  | "NON_MAGICAL"
  | "SILVERED"
  | "ADAMANTINE"
  | "SPELL"
  | "WEAPON"
  | "MELEE"
  | "RANGED"
  | "AREA"
  | string;

export type DamageProfile = {
  type: DamageType;
  tags?: DamageTag[];
};

/** Defensive traits by damage type (base layer; you can add conditional defenses via effects/hooks). */
export type DamageDefenses = {
  resist?: DamageType[];
  immune?: DamageType[];
  vulnerable?: DamageType[];
};

/* -------------------------------- Conditions -------------------------------- */

export type ConditionType =
  | "BLINDED"
  | "CHARMED"
  | "DEAFENED"
  | "FRIGHTENED"
  | "GRAPPLED"
  | "INCAPACITATED"
  | "INVISIBLE"
  | "PARALYZED"
  | "PETRIFIED"
  | "POISONED"
  | "PRONE"
  | "RESTRAINED"
  | "STUNNED"
  | "UNCONSCIOUS"
  | "EXHAUSTION";

/**
 * Duration model (generic).
 * - You can keep it purely declarative and interpret it in the engine.
 */
export type DurationUnit =
  | "INSTANT"
  | "ROUND"
  | "MINUTE"
  | "HOUR"
  | "DAY"
  | "UNTIL_DISPELLED"
  | "SPECIAL";

export type DurationSpec =
  | { kind: "INSTANT" }
  | { kind: "TIME"; unit: Exclude<DurationUnit, "INSTANT">; value: number }
  | { kind: "UNTIL"; event: DurationEndEvent }
  | { kind: "SPECIAL"; note?: string };

export type DurationEndEvent =
  | "END_OF_TURN"
  | "START_OF_TURN"
  | "END_OF_SOURCE_TURN"
  | "START_OF_SOURCE_TURN"
  | "SAVE_ENDS"
  | "CONCENTRATION_ENDS"
  | "DISPELLED"
  | "TRIGGERED"
  | "SPECIAL";

export type ConditionInstance = {
  type: ConditionType;
  duration?: DurationSpec;
  sourceId?: ID;
  stacks?: number;
  tags?: string[];
};

/* --------------------------------- Senses ---------------------------------- */

export type SenseType =
  | "BLINDSIGHT"
  | "DARKVISION"
  | "TREMORSENSE"
  | "TRUESIGHT"
  | "SCENT"
  | string;

export type SenseSpec = {
  type: SenseType;
  range?: number; // feet
  tags?: string[];
};

/* --------------------------------- Keywords --------------------------------- */
/**
 * Rule tags are a universal vocabulary for "what this thing is".
 * Keep them as string for maximum extensibility.
 */
export type RuleTag = string;

/* --------------------------------- Targeting -------------------------------- */

export type TargetingType = "SELF" | "SINGLE" | "MULTI" | "AREA";

export type RangeType = "MELEE" | "RANGED" | "DISTANCE";

export type TargetingConstraint =
  | "LINE_OF_SIGHT"
  | "LINE_OF_EFFECT"
  | "HOSTILE_ONLY"
  | "ALLY_ONLY"
  | "NOT_SELF"
  | "NOT_UNCONSCIOUS"
  | "WITHIN_REACH"
  | "WITHIN_RANGE"
  | "REQUIRES_FREE_HAND"
  | "REQUIRES_SPEECH"
  | "REQUIRES_COMPONENTS"
  | string;

export type AreaShape = "SPHERE" | "CONE" | "LINE" | "CUBE" | "CYLINDER";

/* --------------------------------- Resolution -------------------------------- */

export type Ability =
  | "STR"
  | "DEX"
  | "CON"
  | "INT"
  | "WIS"
  | "CHA";

export type ResolutionType =
  | "ATTACK_ROLL"
  | "SAVING_THROW"
  | "ABILITY_CHECK"
  | "NO_ROLL";

export type AttackKind =
  | "MELEE_WEAPON"
  | "RANGED_WEAPON"
  | "MELEE_SPELL"
  | "RANGED_SPELL"
  | "SPECIAL"
  | string;

/* ------------------------------ Outcome taxonomy ----------------------------- */

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

/* ------------------------------ Expression language --------------------------- */
/**
 * Minimal expression types for conditions (IF clauses) and formulas.
 * - Keep formulas as strings (e.g., "PROF+STR", "WEAPON_DICE+STR") and evaluate in your engine.
 * - Conditions are structured for safety and easy evaluation.
 */

export type Formula = string;

export type Comparator = "EQ" | "NE" | "LT" | "LTE" | "GT" | "GTE" | "IN" | "NIN";

export type ConditionExpr =
  // Actor/Target identity & typing
  | { type: "ACTOR_CREATURE_TYPE_IS"; value: CreatureType }
  | { type: "TARGET_CREATURE_TYPE_IS"; value: CreatureType }
  | { type: "ACTOR_HAS_TAG"; tag: RuleTag }
  | { type: "TARGET_HAS_TAG"; tag: RuleTag }
  | { type: "ACTOR_CREATURE_HAS_TAG"; tag: CreatureTag }
  | { type: "TARGET_CREATURE_HAS_TAG"; tag: CreatureTag }

  // Conditions (status effects)
  | { type: "ACTOR_HAS_CONDITION"; condition: ConditionType }
  | { type: "TARGET_HAS_CONDITION"; condition: ConditionType }
  | { type: "ACTOR_CONDITION_STACKS"; condition: ConditionType; cmp: Comparator; value: number }
  | { type: "TARGET_CONDITION_STACKS"; condition: ConditionType; cmp: Comparator; value: number }

  // Damage defenses
  | { type: "ACTOR_DAMAGE_IMMUNE"; damageType: DamageType }
  | { type: "TARGET_DAMAGE_IMMUNE"; damageType: DamageType }
  | { type: "ACTOR_DAMAGE_RESIST"; damageType: DamageType }
  | { type: "TARGET_DAMAGE_RESIST"; damageType: DamageType }
  | { type: "ACTOR_DAMAGE_VULNERABLE"; damageType: DamageType }
  | { type: "TARGET_DAMAGE_VULNERABLE"; damageType: DamageType }

  // Resources
  | { type: "ACTOR_HAS_RESOURCE"; key: string; cmp: Comparator; value: number }
  | { type: "TARGET_HAS_RESOURCE"; key: string; cmp: Comparator; value: number }

  // Sizes & movement
  | { type: "ACTOR_SIZE_IS"; value: SizeCategory }
  | { type: "TARGET_SIZE_IS"; value: SizeCategory }
  | { type: "ACTOR_CAN_MOVE"; move: MovementType }
  | { type: "TARGET_CAN_MOVE"; move: MovementType }

  // Outcome / phase checks
  | { type: "OUTCOME_HAS"; flag: OutcomeFlag }
  | { type: "PHASE_IS"; value: EnginePhase }

  // Generic comparisons against resolved numeric values (engine-defined keys)
  | { type: "ACTOR_VALUE"; key: string; cmp: Comparator; value: number }
  | { type: "TARGET_VALUE"; key: string; cmp: Comparator; value: number }

  // Boolean composition
  | { type: "AND"; all: ConditionExpr[] }
  | { type: "OR"; any: ConditionExpr[] }
  | { type: "NOT"; expr: ConditionExpr };

/* ------------------------------ Engine phases -------------------------------- */

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

/* ----------------------------- Common state slices --------------------------- */
/**
 * Suggested minimal slices your engine can reference.
 * Keep your actual state elsewhere; this is the taxonomy contract.
 */

export type CreatureIdentity = {
  type: CreatureType;
  tags?: CreatureTag[];
  size?: SizeCategory;
};

export type ActorDefenses = {
  damage?: DamageDefenses;
};

export type ActorResources = Record<string, number>;

export type ActorTaxonomy = {
  id: ID;
  creature: CreatureIdentity;
  tags?: RuleTag[]; // generic rule tags on the actor (e.g., "FLYING", "INCORPOREAL")
  defenses?: ActorDefenses;
  conditions?: ConditionInstance[];
  resources?: ActorResources;
  senses?: SenseSpec[];
  movement?: Partial<Record<MovementType, number>>; // feet by type
};

/* ----------------------------- Optional helper consts ------------------------ */

export const CREATURE_TYPES: readonly CreatureType[] = [
  "ABERRATION",
  "BEAST",
  "CELESTIAL",
  "CONSTRUCT",
  "DRAGON",
  "ELEMENTAL",
  "FEY",
  "FIEND",
  "GIANT",
  "HUMANOID",
  "MONSTROSITY",
  "OOZE",
  "PLANT",
  "UNDEAD",
] as const;

export const DAMAGE_TYPES: readonly DamageType[] = [
  "ACID",
  "BLUDGEONING",
  "COLD",
  "FIRE",
  "FORCE",
  "LIGHTNING",
  "NECROTIC",
  "PIERCING",
  "POISON",
  "PSYCHIC",
  "RADIANT",
  "SLASHING",
  "THUNDER",
] as const;

export const CONDITIONS: readonly ConditionType[] = [
  "BLINDED",
  "CHARMED",
  "DEAFENED",
  "FRIGHTENED",
  "GRAPPLED",
  "INCAPACITATED",
  "INVISIBLE",
  "PARALYZED",
  "PETRIFIED",
  "POISONED",
  "PRONE",
  "RESTRAINED",
  "STUNNED",
  "UNCONSCIOUS",
  "EXHAUSTION",
] as const;

export const SIZES: readonly SizeCategory[] = [
  "TINY",
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
] as const;

export const MOVEMENT_TYPES: readonly MovementType[] = [
  "WALK",
  "CLIMB",
  "SWIM",
  "FLY",
  "BURROW",
] as const;
```
