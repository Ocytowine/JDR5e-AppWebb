# Action Pipeline Helper (Notice de migration)

Ce document explique le nouveau systeme de pipeline d'actions et comment migrer progressivement les JSON existants.

## Objectif

Le pipeline est stable et ne doit pas etre modifie par les JSON. Les contenus declarent:
- le ciblage et la resolution (attaque / save / check / none),
- les conditions et branches d'issue (onHit/onMiss/onSaveFail/onSaveSuccess/onCrit),
- les hooks (features, items, status),
- des operations atomiques (DealDamage, ApplyCondition, CreateZone, etc.).

## Notice de creation d'action

Voir `docs/action-creation-notice.md` pour le template complet, les explications champ par champ, et la fiche de test standard.

## Principes cle

1. Le pipeline est immutable (phases fixes).
2. Les JSON de contenu decrivent des intentions, pas des etapes.
3. Les operations sont atomiques et composees par des conditions/branches.
4. Les hooks s'appliquent via un moteur de regles commun.
5. Support complet des hooks taxo.

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

Le moteur supporte les hooks suivants (taxo complete):

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

Note: utiliser les noms de phases officiels (voir taxo).

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
- effects[] -> Operation[] (adapter de compatibilite)

### 2) Conditions existantes
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
- Tous les hooks de la taxo sont acceptes dans `when`.

## Patterns de conversion

### A) Attaque classique (melee)
Avant:
- attack + damage + effects

Nouveau:
- resolution: { kind: "ATTACK_ROLL", bonus, critRange }
- effects:
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
  "actionCost": { "actionType": "action" },
  "targeting": { "target": "hostile", "range": { "min": 0, "max": 1, "shape": "SPHERE" } },
  "resolution": {
    "kind": "CONTESTED_CHECK",
    "contested": { "actorAbility": "FOR", "targetAbility": "FOR", "tieWinner": "actor" }
  },
  "effects": {
    "onHit": [ { "op": "ApplyCondition", "target": "primary", "statusId": "grappled", "durationTurns": 1 } ],
    "onMiss": [ { "op": "LogEvent", "message": "Echec de l'agrippement." } ]
  }
}
```

### C) Deplacement force
- resolution: { kind: "NO_ROLL" }
- effects:
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
    "actionCost": { "actionType": "action" },
    "targeting": { "target": "hostile", "range": { "min": 0, "max": 1, "shape": "SPHERE" } },
    "resolution": { "kind": "ATTACK_ROLL", "bonus": 5, "critRange": 20 },
    "effects": {
      "onHit": [ { "op": "DealDamage", "target": "primary", "formula": "1d4 + modFOR", "damageType": "slashing" } ],
      "onMiss": [ { "op": "LogEvent", "message": "Attaque ratee." } ]
    },
    "reactionWindows": ["pre", "post"]
  }
```

