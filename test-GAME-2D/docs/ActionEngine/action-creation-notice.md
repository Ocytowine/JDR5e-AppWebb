# Notice de creation d'action (template + explications)

Ce document sert de reference pour creer une action au format pipeline. Il explique chaque champ, propose un template JSON, et fournit une fiche de test standard.

## Objectif

- Decrire clairement la cible, la resolution et les effets d'une action.
- Eviter les doublons de logique (tout passe par les hooks et operations).
- Garantir un minimum de tests reproductibles.

## Structure generale (vue d'ensemble)

Une action pipeline est composee de:
- Identite et cout (action/bonus/reaction/free).
- Ciblage (type, portee, formes, nombre de cibles, LOS).
- Resolution (attack/save/check/none/contested).
- Branches d'issue (onHit/onMiss/onSaveFail/onSaveSuccess/onCrit).
- Hooks (optionnels, pour feats/status/items/traits).
- Operations atomiques (DealDamage, ApplyCondition, etc.).

## Template JSON (base)

```json
{
  "id": "my-action-id",
  "name": "Nom de l'action",
  "category": "attack",
  "tags": ["melee", "basic"],
  "actionCost": { "actionType": "action" },
  "targeting": {
    "target": "hostile",
    "range": { "min": 0, "max": 1.5, "shape": "SPHERE" },
    "maxTargets": 1,
    "requiresLineOfSight": true
  },
  "resolution": {
    "kind": "ATTACK_ROLL",
    "bonus": 5,
    "critRange": 20
  },
  "effects": {
    "onHit": [
      { "op": "DealDamage", "target": "primary", "formula": "1d6 + modFOR", "damageType": "slashing" }
    ],
    "onMiss": [
      { "op": "LogEvent", "message": "Attaque ratee." }
    ]
  },
  "reactionWindows": ["pre", "post"]
}
```

## Champ par champ (explications)

### Identite
- `id`: identifiant unique (slug stable). Utilise pour lier actions, logs, analytics.
- `name`: nom affiche en UI.
- `category`: typage de haut niveau (ex: `attack`, `support`, `move`). Sert a l'UI et aux choix IA.
- `tags`: mots clefs libres (ex: `melee`, `ranged`, `spell`, `fire`, `area`). Utilises dans les conditions et hooks.
Note: `AOE` n'est pas lu par l'engine; preferer `area` si besoin descriptif.

### Cout d'action
- `actionCost.actionType`: `action` | `bonus` | `reaction` | `free`.
- `actionCost.cost`: optionnel si action consomme plus d'une action (rare).

### Ciblage
- `targeting.target`: type de cible (ex: `enemy`, `hostile`, `ally`, `self`, `cell`).
- `targeting.range`: `min`, `max`, `shape` (ex: `SPHERE`, `LINE`, `CONE`, `CUBE`).
- `targeting.maxTargets`: nombre maximum de cibles.
- `targeting.requiresLineOfSight`: bloque si pas de LOS.
- `targeting.area`: optionnel pour zones persistantes.

### Resolution
- `resolution.kind`: `ATTACK_ROLL` | `SAVING_THROW` | `ABILITY_CHECK` | `CONTESTED_CHECK` | `NO_ROLL`.
- `resolution.bonus`: bonus au jet (attaque ou check).
- `resolution.critRange`: plage de critique (attaque).
- `resolution.save`: si `SAVING_THROW`, contient `ability` + `dc`.
- `resolution.check`: si `ABILITY_CHECK`, contient `ability` + `dc`.
- `resolution.contested`: si `CONTESTED_CHECK`, contient `actorAbility`, `targetAbility`, `tieWinner`.

### Effets (branches d'issue)
- `effects.onHit`: operations executees si l'attaque touche.
- `effects.onMiss`: operations executees si l'attaque rate.
- `effects.onCrit`: operations executees sur critique.
- `effects.onSaveFail` / `effects.onSaveSuccess`: branches des saves.
- `effects.onResolve`: operations executees quel que soit le resultat.

### Operations (atomiques)
Exemples courants:
- `DealDamage`: degats (formule + type).
- `Heal`: soin (formule).
- `ApplyCondition` / `RemoveCondition`.
- `CreateZone` / `CreateSurface` / `ApplyAura`.
- `SpendResource` / `ConsumeSlot`.
- `MoveForced` / `Teleport` / `Push` / `Pull`.
- `EmitEvent` / `LogEvent`.

Chaque operation doit etre autonome, sans logique implicite.

### Conditions (si vous en avez besoin)
Utilisez les conditions dans:
- `conditions` pour filtrer l'action.
- `hooks` (if/when) pour des comportements conditionnels.
Exemples:
- `HAS_LINE_OF_SIGHT`
- `OUTCOME_IS` / `OUTCOME_IN`
- `HAS_RESOURCE`
- `SLOT_AVAILABLE`
- `TARGET_IN_AREA`

### Hooks
Utiles pour feats, status, objets, ou traits passifs.
- `when`: phase (ex: `onOutcome`, `beforeApply`).
- `if`: conditions.
- `prompt`: texte optionnel pour choix utilisateur.
- `apply`: operations a executer si les conditions sont remplies.

### Fenetres de reaction
- `reactionWindows`: `pre` | `post` (ou les deux).
Permet a l'engine d'ouvrir une reaction avant ou apres la resolution.

## Fiche de test (a coller sous l'action)

```md
### Fiche de test - {actionId}

Contexte:
- Version data: {commit/ref}
- Testeur: {nom}
- Date: {YYYY-MM-DD}
- Build: {dev/prod}

Cas de figure:
- Cible valide / invalide
- Portee min / max
- LOS ok / bloque
- Multi-cibles (si applicable)
- Zone/shape (si applicable)
- Reactions pre/post (si applicable)

Resolution:
- Hit / Miss / Crit
- Save success / fail
- Contested win / lose (si applicable)

Ressources:
- SpendResource / ConsumeSlot (valeurs correctes)
- Munition auto (si applicable)
- Usage turn/round/combat (si applicable)

Hooks:
- Hook declenche
- Hook non declenche (condition fausse)
- Prompt utilisateur (si applicable)

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

- Une action = une intention claire (eviter d'empiler trop d'effets).
- Les effets conditionnels vont dans les branches, pas en logique externe.
- Preferer des operations courtes et composables.
- Toujours documenter un cas de test minimal.
