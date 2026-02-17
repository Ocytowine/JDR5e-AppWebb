# Action Pipeline Helper (Notice de migration)

Ce document explique le nouveau systeme de pipeline d'actions et comment migrer progressivement les JSON existants.

## Objectif

Le pipeline est stable et ne doit pas etre modifie par les JSON. Les contenus declarent:
- le ciblage et la resolution (attaque / save / check / none),
- les conditions et branches d'issue (onHit/onMiss/onSaveFail/onSaveSuccess/onCrit),
- les hooks (features, items, status),
- des operations atomiques (DealDamage, ApplyCondition, CreateZone, etc.).

## Notice de creation d'action

Voir `docs/ActionEngine/action-creation-notice.md` pour le template complet, les explications champ par champ, et la fiche de test standard.

## Principes cle

1. Le pipeline est immutable (phases fixes).
2. Les JSON de contenu decrivent des intentions, pas des etapes.
3. Les operations sont atomiques et composees par des conditions/branches.
4. Les hooks s'appliquent via un moteur de regles commun.
5. Support des hooks runtime documentes ci-dessous.

## Phases du pipeline (rappel)

1. Build Intent
2. Gather/Resolve Options
3. Validate legality
4. Targeting
5. Pre-resolution reaction window(s)
6. Resolve check (attack/save/check/none)
7. Outcome branching (onHit/onMiss/onSaveFail/onSaveSuccess/onCrit)
8. Apply effects to targets
9. Apply effects to world/context
10. Post-resolution reaction window(s)
11. Commit transaction + event log

## Hooks supportes (moteur)

Le moteur supporte les hooks suivants (forme recommandee):

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

Alias aussi supportes par normalisation:
- `pre_resolution`, `PRE_RESOLUTION_WINDOW` -> `preResolution`
- `on_outcome`, `ON_OUTCOME` -> `onOutcome`
- `on_apply`, `APPLY_TARGET_EFFECTS`, `APPLY_WORLD_EFFECTS` -> `afterApply`
- `post_resolution`, `POST_RESOLUTION_WINDOW` -> `postResolution`
- `COMMIT` -> `beforeCommit`

## Bridge features runtime (GameBoard)

En plus du pipeline d'actions pur, le runtime applique des regles declaratives issues de `feature.rules.modifiers`.
Ces regles sont evaluees dans `src/GameBoard.tsx` pour ajuster les couts/bonus d'actions sans branchement par classe.

Champs utilises actuellement pour les overrides de cout:
- `applyTo: "actionCost"`
- `stat: "actionCostOverride"` (ou `dualWieldBonusAttackWithoutBonusAction` pour le cas legacy)
- `fromCostType`, `toCostType`
- `usageKey`
- `maxPerTurn`
- `maxPerTurnPerActionUsed` (ex: Extra Attack scale selon le nombre d'actions principales deja prises)
- `priority` (selection de la regle la plus specifique)
- `limitMessage`

Conditions `when` etendues supportees cote runtime:
- `actionTagsNone`
- `requiresTurnActionUsed`
- `requiresTurnAttackActionUsed`
- `requiresTurnSpellCast`
- `requiresTurnCantripCast`

Important:
- ces champs sont runtime-stables pour le projet, mais ne sont pas encore formalises dans `taxonomy.json`.
- quand une regle de feature depend d'un hook non expose (ex: echec de check puis choix reactif), prevoir un hook moteur dedie avant de forcer une approximation data.

## Weapon Mastery (data-driven)

Les bottes d'arme sont declarees comme **actions** `wm-*` dans:
- `src/data/actions/weapon-mastery/`

Le moteur applique un **hook generique** si:
- l'action courante porte `wm-active:<id>` (arme equipee),
- l'acteur a `wm:<id>` (maitrise debloquee),
- le trigger runtime `wm-trigger:<id>:on_hit/on_miss/on_intent` correspond
  (derive des tags `wm-trigger:on_*` des JSON WM).

Le moteur utilise ces tags pour declencher les effets, mais **les effets sont integres cote engine**
(pas d'injection dynamique d'ops).

Tags runtime utilises par l'engine:
- `wm-ouverture:adv:<sourceId>` (devient `:expiring` au debut du tour suivant de la source, purge a la fin de ce tour).
- `wm-sape:next:<sourceId>` + `wm-ralentissement:<sourceId>` (purges au debut du tour suivant de la source).
- `rtm:<payload>` pour les marqueurs runtime generiques (payload JSON encode URI), avec cycle temporel gere moteur (`active -> expiring -> purge`) selon `lifecycle`.

## Runtime markers (generic)

Les features peuvent declarer `rules.runtimeMarkers[]` pour poser un marqueur temporel sur une cible, sans cas special par feature.

Structure minimale supportee:
- `id`
- `applyOn: "on_outcome"`
- `target: "primary"`
- `when` (meme logique que les `modifiers.when`, + `outcomeAny/outcomeNone`)
- `effect`:
  - `resolutionKind` (`SAVING_THROW` | `ATTACK_ROLL` | `ABILITY_CHECK`)
  - `actionTagsAny/actionTagsAll/actionTagsNone`
  - `actorMustMatchSource`
  - `rollMode` (`advantage` | `disadvantage`)
  - `consumeOnTrigger`
- `duration.type: "until_end_of_source_next_turn"`

## Runtime effects (generic)

Les features peuvent declarer `rules.runtimeEffects[]` pour appliquer des effets runtime apres resolution d'action, sans branche par feature.

Structure actuelle supportee:
- `applyOn: "after_action_resolve"`
- `when` (conditions runtime, incluant `actionId/actionIdsAny` et `outcomeAny/outcomeNone`)
- `effects[]`:
  - `grantMainAction`
  - `grantMovementBySpeedFraction`
  - `addStatus`
  - `teleportNearPrimaryTarget`

## Modeles (concepts)

### ActionSpec
- Identite (id/name/summary)
- Ciblage (target + range + maxTargets + requiresLos)
- Resolution (attack/save/check/none)
- Effects conditionnels (branches selon l'outcome, issus de `ops` source)
- Reaction windows
Note: `actionCost` reste dans `ActionDefinition` (JSON source/runtime) et n'est pas porte par `ActionSpec` interne.

### FeatureSpec
- Hooks declaratifs:
  - when: phase
  - if: conditions
  - prompt: optionnel
  - apply: operations

### Outcome
Resultat de la resolution (ex: attaque ou save):
- isHit, isCrit
- saveResult: success/fail
- roll/total
Note: dans les outcomes taxo, les flags officiels sont `HIT`, `MISS`, `CRIT`, `SAVE_SUCCESS`, `SAVE_FAIL`, etc.

### Operation (atomique)
Exemples:
- DealDamage
- Heal
- ApplyCondition
- CreateZone
- MoveForced
- SpendResource
- StartConcentration
- LogEvent

## Conventions de migration

### 1) Actions existantes -> ActionSpec
Mappe l'ancien schema sans changer la logique:
- action.attack -> resolution.kind = attack
- action.damage -> Operation(DealDamage) default onHit
- action.ops -> ConditionalEffects (adapter de compatibilite)

### 2) Conditions existantes
- conditions[] reste supporte par le moteur de validation, mais deplacer vers if/when quand possible.

### 3) Effets conditionnels
Utiliser des branches declarees:
- onHit: operations
- onMiss: operations
- onCrit: operations
- onSaveFail / onSaveSuccess: operations

### 4) Hooks
- Features/items/status doivent ajouter des hooks declaratifs, pas modifier le pipeline.
- Exemple: "onHit spend resource to add rider damage" devient un hook conditionnel.
- Utiliser les phases runtime recommandees (liste ci-dessus) pour eviter les hooks ignores.

## Patterns de conversion

### A) Attaque classique (melee)
Avant:
- attack + damage + effects

Nouveau:
- resolution: { kind: "ATTACK_ROLL", bonus, critRange }
- ops:
  - onHit: [ DealDamage{formula, type} ]
  - onMiss: [ LogEvent{...} ]

### B) Sort de sauvegarde
- resolution: { kind: "SAVING_THROW", ability: "DEX", dc: 14 }
- onSaveFail: [ DealDamage{formula} ]
- onSaveSuccess: [ DealDamage{formula, scale: "half"} ]

### E) Contested check
- resolution: { kind: "CONTESTED_CHECK", contested: { actorAbility: "FOR", targetAbility: "FOR", tieWinner: "actor" } }
- onHit: [ ApplyCondition{...} ] (interprete "contested win")

Exemple JSON (grapple):
```json
{
  "id": "grapple",
  "name": "Agripper",
  "actionCost": { "actionType": "action", "movementCost": 0 },
  "targeting": { "target": "hostile", "range": { "min": 0, "max": 1.5, "shape": "SPHERE" } },
  "resolution": {
    "kind": "CONTESTED_CHECK",
    "contested": { "actorAbility": "FOR", "targetAbility": "FOR", "tieWinner": "actor" }
  },
  "ops": {
    "onHit": [ { "op": "ApplyCondition", "target": "primary", "statusId": "grappled", "durationTurns": 1 } ],
    "onMiss": [ { "op": "LogEvent", "message": "Echec de l'agrippement." } ]
  }
}
```

### C) Deplacement force
- resolution: { kind: "NO_ROLL" }
- ops:
  - onResolve: [ MoveForced{distance, direction} ]

### D) Action avec option "rider"
- Base action: onHit -> DealDamage
- Hook feature:
  - when: "onOutcome"
  - if: [ OUTCOME_HAS: "HIT", ACTOR_HAS_RESOURCE: "mana", ACTOR_HAS_TAG: "rogue" ]
  - prompt: "Depenser 1 mana pour +1d6 ?"
  - apply: [ SpendResource{...}, DealDamage{formula:"1d6"} ]

## Heuristiques de migration

1. Migrer d'abord les actions simples (melee, projectile, move).
2. Ensuite les reactions (opportunity attack).
3. Puis les sorts avec save et demi-degats.
4. Enfin les capacites a choix multiples ou effets complexes.

## Validation minimale

Pour chaque action migree:
- Hit / miss / crit
- Save success / fail
- Hooks optionnels
- Zone creation (si applicable)

## Glossaire rapide

- ActionSpec: description declarative d'une action.
- ActionPlan: resultat compile (ciblage + resolution + ops + hooks).
- Hook: regle conditionnelle appliquee a une phase.
- Operation: effet atomique applique dans la transaction.
- Transaction: preview -> commit.

## Exemple JSON (pseudo)

```json
  {
    "id": "melee-strike",
    "name": "Frappe basique",
    "actionCost": { "actionType": "action", "movementCost": 0 },
    "targeting": { "target": "hostile", "range": { "min": 0, "max": 1.5, "shape": "SPHERE" }, "requiresLos": true },
    "resolution": { "kind": "ATTACK_ROLL", "bonus": 5, "critRange": 20 },
    "ops": {
      "onHit": [ { "op": "DealDamage", "target": "primary", "formula": "1d4 + modFOR", "damageType": "slashing" } ],
      "onMiss": [ { "op": "LogEvent", "message": "Attaque ratee." } ]
    },
    "reactionWindows": ["pre", "post"]
  }
```

