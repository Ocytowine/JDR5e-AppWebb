# Action Pipeline Helper (Notice de migration)

Ce document explique le nouveau systeme de pipeline d'actions et comment migrer progressivement les JSON existants.

## Objectif

Le pipeline est stable et ne doit pas etre modifie par les JSON. Les contenus declarent:
- le ciblage et la resolution (attaque / save / check / none),
- les conditions et branches d'issue (onHit/onMiss/onSaveFail/onSaveSuccess/onCrit),
- les hooks (features, items, status),
- des operations atomiques (DealDamage, ApplyCondition, CreateZone, etc.).

## Principes cle

1. Le pipeline est immutable (phases fixes).
2. Les JSON de contenu decrivent des intentions, pas des etapes.
3. Les operations sont atomiques et composees par des conditions/branches.
4. Les hooks s'appliquent via un moteur de regles commun.

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

## Modeles (concepts)

### ActionSpec
- Identite et economie (action/bonus/reaction/free)
- Ciblage (target + range + maxTargets + requiresLos)
- Resolution (attack/save/check/none)
- Effects conditionnels (branches selon l'outcome)
- Reaction windows

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

### 1) Actions legacy -> ActionSpec
Mappe l'ancien schema sans changer la logique:
- action.attack -> resolution.kind = attack
- action.damage -> Operation(DealDamage) default onHit
- effects[] -> Operation[] (adapter legacy)

### 2) Conditions legacy
- conditions[] reste supporte via adapter, mais deplacer vers if/when quand possible.

### 3) Effets conditionnels
Utiliser des branches declarees:
- onHit: operations
- onMiss: operations
- onCrit: operations
- onSaveFail / onSaveSuccess: operations

### 4) Hooks
- Features/items/status doivent ajouter des hooks declaratifs, pas modifier le pipeline.
- Exemple: "onHit spend resource to add rider damage" devient un hook conditionnel.

## Patterns de conversion

### A) Attaque classique (melee)
Legacy:
- attack + damage + effects

Nouveau:
- resolution: { kind: "attack", bonus, critRange }
- effects:
  - onHit: [ DealDamage{formula, type} ]
  - onMiss: [ LogEvent{...} ]

### B) Sort de sauvegarde
- resolution: { kind: "save", ability: "DEX", dc: 14 }
- onSaveFail: [ DealDamage{formula} ]
- onSaveSuccess: [ DealDamage{formula, scale: "half"} ]

### C) Deplacement force
- resolution: { kind: "none" }
- effects:
  - onResolve: [ MoveForced{distance, direction} ]

### D) Action avec option "rider"
- Base action: onHit -> DealDamage
- Hook feature:
  - when: "afterOutcome"
  - if: [ OUTCOME_IS: "hit", HAS_RESOURCE: "mana", ACTOR_HAS_TAG: "rogue" ]
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
  "economy": { "actionType": "action" },
  "targeting": { "target": "hostile", "range": { "min": 0, "max": 1, "shape": "single" } },
  "resolution": { "kind": "attack", "bonus": 5, "critRange": 20 },
  "effects": {
    "onHit": [ { "op": "DealDamage", "formula": "1d4 + modFOR", "type": "slashing" } ],
    "onMiss": [ { "op": "LogEvent", "message": "Attaque ratee." } ]
  },
  "reactionWindows": ["pre", "post"]
}
```

