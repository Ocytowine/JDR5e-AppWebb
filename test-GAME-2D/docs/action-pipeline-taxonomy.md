# Taxonomie complete du pipeline (D&D 2024)

Ce document decrit la taxonomie complete pour le pipeline d'actions. Il sert de reference pour migrer les JSON et garantir la compatibilite avec les mecanismes D&D 2024.

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

## Concepts

### ActionSpec
- Identite, economie, couts
- Ciblage (target + range + maxTargets + requiresLos)
- Resolution (attack/save/check/contested/none)
- Effects conditionnels par issue
- Reaction windows
- Hooks additionnels

### FeatureSpec
- Hooks declaratifs
- Conditions et prompts optionnels
- Operations appliquees si conditions valides

### ActionPlan
- Ciblage resolu
- Resolution schema resolu
- Hooks collectes
- Operations ordonnees
- Windows de reaction (pre/post)

### Outcome
Resultat d'une resolution:
- kind: hit/miss/crit/saveSuccess/saveFail/checkSuccess/checkFail
- roll/total
- isCrit

### Operation
Effet atomique applique a l'etat transactionnel.

### Hook
Regle declarative appliquee a une phase.

## Taxonomie des operations

### Degats/Soins
- DealDamage
- DealDamageScaled (half/quarter)
- Heal
- GrantTempHP
- ApplyDamageTypeMod (resistance/vulnerability/immunity)

### Conditions/Status
- ApplyCondition
- RemoveCondition
- ExtendCondition
- SetConditionStack
- StartConcentration
- BreakConcentration

### Deplacements/Positions
- MoveForced
- Teleport
- SwapPositions
- Knockback
- Pull
- Push

### Zone/Aura/Surface
- CreateZone
- RemoveZone
- ModifyZone
- CreateSurface
- RemoveSurface
- ApplyAura

### Ressources
- SpendResource
- RestoreResource
- ConsumeSlot
- RestoreSlot
- SetResource

### Jets/Dices
- AddDice
- ReplaceRoll
- Reroll
- SetMinimumRoll
- SetMaximumRoll
- ModifyBonus
- ModifyDC

### Ciblage/Selection
- LockTarget
- ExpandTargets
- FilterTargets
- Retarget

### Summons/Entities
- SpawnEntity
- DespawnEntity
- ControlSummon

### Flags/Tags
- AddTag
- RemoveTag
- SetFlag

### Logs/Events
- LogEvent
- EmitEvent

## Taxonomie des conditions (if)

### Resultat
- OUTCOME_IS
- OUTCOME_IN
- ROLL_AT_LEAST
- ROLL_AT_MOST

### Cible/acteur
- ACTOR_HAS_TAG
- TARGET_HAS_TAG
- ACTOR_HAS_CONDITION
- TARGET_HAS_CONDITION
- TARGET_HP_BELOW
- ACTOR_HP_BELOW

### Ressources
- HAS_RESOURCE
- RESOURCE_AT_LEAST
- RESOURCE_AT_MOST
- SLOT_AVAILABLE

### Position/Ligne de vue
- DISTANCE_WITHIN
- HAS_LINE_OF_SIGHT
- SAME_LEVEL
- TARGET_IN_AREA

### Usage/Timing
- ONCE_PER_TURN
- ONCE_PER_ROUND
- ONCE_PER_COMBAT
- NOT_USED_THIS_TURN

### Etat du jeu
- IS_REACTION_AVAILABLE
- IS_CONCENTRATING
- IS_SURPRISED
- IS_IN_LIGHT

## Taxonomie des hooks (when)

### Core phases
- onIntentBuild
- onOptionsResolve
- onValidate
- onTargeting
- preResolution
- onResolve
- onOutcome
- beforeApply
- afterApply
- postResolution
- beforeCommit
- afterCommit

### Turn/round
- onTurnStart
- onTurnEnd
- onRoundStart
- onRoundEnd

### Interrupts
- onInterrupt
- onCounter

## Outcomes (standardises)

- hit
- miss
- crit
- saveSuccess
- saveFail
- checkSuccess
- checkFail

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
  "economy": { "actionType": "action" },
  "targeting": {
    "target": "hostile",
    "range": { "min": 0, "max": 1, "shape": "single" },
    "maxTargets": 1,
    "requiresLos": true
  },
  "resolution": { "kind": "attack", "bonus": 5, "critRange": 20 },
  "effects": {
    "onHit": [
      { "op": "DealDamage", "target": "primary", "formula": "1d8+modSTR", "damageType": "slashing" }
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
