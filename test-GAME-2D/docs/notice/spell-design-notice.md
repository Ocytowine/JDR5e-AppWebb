# Notice de conception - Sorts (spells)

Ce document sert de reference pour concevoir un sort au format pipeline (ActionSpec + hooks) en se basant sur la taxonomie et le moteur d'actions. Il explique les champs, propose un template JSON, et fournit une fiche de test standard.

## Objectif

- Standardiser la structure des sorts (data + comportement) selon la taxo.
- Eviter les doublons entre description et logique.
- Garantir un minimum de tests reproductibles.

## Structure recommandeee (vue d'ensemble)

Un sort est compose de:
- Identite (id, name) et metadonnees (level, school, tags).
- UI/UX (summary, category, components).
- Cout (action/bonus/reaction, usage).
- Ciblage (type, portee, shape, maxTargets, LOS).
- Resolution (attack/save/check/none/contested).
- Effets par branche (onHit/onMiss/onSaveFail/onSaveSuccess/onCrit/onResolve).
- Hooks (facultatifs, pour interactions avec feats/items/status).

## Template JSON (sort, conforme moteur)

```json
{
  "id": "spell-firebolt",
  "name": "Rayon de feu",
  "level": 0,
  "school": "evocation",
  "summary": "Court resume utilise en UI.",
  "category": "attack",
  "components": { "verbal": true, "somatic": true, "material": false },
  "tags": ["spell", "ranged", "fire"],
  "actionCost": { "actionType": "action", "movementCost": 0 },
  "targeting": {
    "target": "hostile",
    "range": { "min": 0, "max": 36, "shape": "LINE" },
    "maxTargets": 1,
    "requiresLos": true
  },
  "usage": { "perTurn": null, "perEncounter": null, "resource": null },
  "conditions": [],
  "resolution": {
    "kind": "ATTACK_ROLL",
    "bonus": 0,
    "critRange": 20
  },
  "ops": {
    "onHit": [
      { "op": "DealDamage", "target": "primary", "formula": "1d10", "damageType": "FIRE" }
    ],
    "onMiss": [
      { "op": "LogEvent", "message": "Le rayon rate sa cible." }
    ]
  }
}
```

## Champ par champ (explications)

### Identite & metadonnees
- `id`: identifiant unique (slug stable).
- `name`: nom affiche en UI.
- `level`: 0 pour cantrip, 1..9 pour les sorts.
- `school`: ecole (ex: `evocation`, `illusion`).
- `tags`: mots clefs utiles aux conditions/hooks (ex: `fire`, `cold`, `aoe`).

### UI / presentation
- `summary`: texte court affiche (liste/tooltip).
- `category`: type UI (ex: `attack`, `support`, `control`, `utility`).
- `components`: informations roleplay/fiche (verbal/somatique/materiel).
  - Le moteur bloque l'action si un statut d'interdiction est present:
    - Verbal: `INCAPACITATED`, `UNCONSCIOUS`, `PARALYZED`, `PETRIFIED`, `STUNNED`.
    - Somatique/Material: `RESTRAINED`, `GRAPPLED`, `PARALYZED`, `PETRIFIED`, `UNCONSCIOUS`, `STUNNED`, `INCAPACITATED`.
  - Ces IDs sont ceux de `conditionTypes` (taxo).

### Cout & contraintes
- `actionCost.actionType`: `action` | `bonus` | `reaction` | `free`.
- `usage`: limites par tour/combat + ressource (si besoin).
  - `perTurn`, `perEncounter`, `resource`.

### Portee & ciblage
- `targeting.target`: type de cible (`enemy`, `hostile`, `ally`, `self`, `cell`).
- `targeting.range`: `min`, `max`, `shape` (ex: `SPHERE`, `CONE`, `LINE`).
- `targeting.maxTargets`: nombre max de cibles.
- `targeting.requiresLos`: bloque si pas de LOS.

### Resolution
- `resolution.kind`: `ATTACK_ROLL` | `SAVING_THROW` | `ABILITY_CHECK` | `CONTESTED_CHECK` | `NO_ROLL`.
- `resolution.bonus`: bonus d'attaque.
- `resolution.save`: si `SAVING_THROW`, `ability` + `dc`.
- `resolution.check`: si `ABILITY_CHECK`, `ability` + `dc`.

### Effets (branches d'issue)
- `ops.onHit`: executes si l'attaque touche.
- `ops.onMiss`: executes si l'attaque rate.
- `ops.onSaveFail` / `ops.onSaveSuccess`: branches des saves.
- `ops.onCrit`: executes sur critique.
- `ops.onResolve`: executes dans tous les cas.

### Operations (atomiques)
Exemples:
- `DealDamage` (degats + type)
- `ApplyCondition` / `RemoveCondition`
- `CreateZone` / `CreateSurface` / `ApplyAura`
- `SpendResource` / `ConsumeSlot`
- `EmitEvent` / `LogEvent`

### Upcast / scaling
Deux approches compatibles moteur:
- Utiliser `DealDamageScaled` si le moteur/taxonomie l'autorise.
- Utiliser un hook conditionnel avec `SLOT_AVAILABLE`/`HAS_RESOURCE` si besoin.

## Fiche de test (a coller sous le sort)

```md
### Fiche de test - {spellId}

Contexte:
- Version data: {commit/ref}
- Testeur: {nom}
- Date: {YYYY-MM-DD}
- Build: {dev/prod}

Cas de figure:
- Portee min/max
- LOS ok / bloque
- Multi-cibles (si applicable)
- Zone/shape (si applicable)
- Usage par tour/rencontre (si applicable)

Resolution:
- Hit / Miss / Crit
- Save success / fail

Ressources:
- Consommation slot (OK/KO)
- Consommation ressource (si applicable)

Hooks:
- Hook declenche
- Hook non declenche

Resultats:
- Degats / soins corrects
- Conditions appliquees/supprimees
- Zones/auras creees/supprimees
- Log/EmitEvent ok

Approuve:
- Statut: {OK | KO | A REVOIR}
- Commentaire: {notes}
```

## Regles pratiques

- Un sort = une intention claire (eviter trop d'effets dans un seul sort).
- Preferer des operations simples et composables.
- Toujours documenter un cas de test minimal.
