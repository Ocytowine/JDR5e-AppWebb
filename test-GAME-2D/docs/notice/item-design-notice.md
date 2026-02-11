# Notice de conception - Items (ActionEngine)

Ce document sert de reference pour creer des items jouables **et** leurs actions d'utilisation au format pipeline (ActionSpec + hooks). Il s'appuie sur la taxonomie du moteur d'actions.

## Objectif

- Standardiser la structure des items (data + action d'utilisation).
- Eviter les doublons entre description d'item et logique d'execution.
- Garantir un minimum de tests reproductibles pour chaque item interactif.

## Vue d'ensemble

Un item interactif se compose de 2 couches:
- **Item data** (inventaire): fiche descriptive, poids, valeur, tags, proprietes.
- **Item action** (ActionSpec): ce que fait l'item lorsqu'il est utilise.

L'item data **reference** l'action via `links.actionId` (ou un champ equivalent).

## Structure recommandee (item data)

```json
{
  "id": "obj_torche",
  "label": "Torche",
  "type": "object",
  "category": "gear",
  "weight": 0.5,
  "tags": ["torche", "consommable", "material:wood"],
  "description": "Torche simple pour eclairer.",
  "value": { "platinum": 0, "gold": 0, "silver": 0, "copper": 1 },
  "links": {
    "actionId": "torch-toggle"
  }
}
```

## Structure recommandee (item action - ActionSpec)

```json
{
  "id": "torch-toggle",
  "name": "Allumer la torche",
  "summary": "Allume ou eteint la torche du joueur pour eclairer autour de lui.",
  "category": "item",
  "tags": ["item", "torch", "utility", "material:wood"],
  "actionCost": { "actionType": "bonus", "movementCost": 0 },
  "targeting": {
    "target": "self",
    "range": { "min": 0, "max": 0, "shape": "SPHERE" },
    "maxTargets": 1,
    "requiresLos": false
  },
  "usage": {
    "perTurn": null,
    "perEncounter": null,
    "resource": { "name": "torch", "pool": "gear", "min": 1 }
  },
  "conditions": [
    { "type": "RESOURCE_AT_LEAST", "resource": "torch", "pool": "gear", "value": 1 }
  ],
  "resolution": { "kind": "NO_ROLL" },
  "ops": {
    "onResolve": [
      { "op": "ToggleTorch" },
      { "op": "LogEvent", "message": "Torche: etat bascule." }
    ]
  }
}
```

## Champ par champ (item data)

- `id`: identifiant unique (slug stable).
- `label` / `name`: nom affiche en UI (selon schema de l'item).
- `type`: type d'item (ex: `object`, `arme`, `armor`, `munition`).
- `category`: categorie d'inventaire (ex: `gear`, `pack`, `shield`, `projectile`).
- `weight`: poids.
- `value`: prix par devise (platinum/gold/silver/copper).
- `tags`: mots clefs utiles aux filtres et aux regles.
- `links.actionId`: lie l'item a son ActionSpec (si item utilisable).

## Tags materiaux (standard)

Pour standardiser les materiaux, utiliser un **prefixe unique**: `material:<id>`.

Exemples:
- `material:wood`
- `material:metal`
- `material:leather`

### Liste recommande (material:<id>)

- `material:wood` (bois)
- `material:metal` (metal generique)
- `material:iron`
- `material:steel`
- `material:bronze`
- `material:stone`
- `material:leather`
- `material:cloth`
- `material:bone`
- `material:glass`
- `material:crystal`
- `material:ceramic`
- `material:paper`

Regles:
- Utiliser **un seul material principal** par item (sauf cas hybride explicite).
- Pour un item composite, ajouter un second tag si necessaire: `material:wood` + `material:metal`.

## Champ par champ (item action / ActionSpec)

### Identite & meta
- `id`: identifiant unique (slug stable).
- `name`: nom affiche en UI.
- `summary`: description courte.
- `category`: **doit etre** `item` pour les actions d'item.
- `tags`: tags utiles aux conditions/hooks (`item`, type d'item, element, etc.).

### Cout & usage
- `actionCost.actionType`: `action` | `bonus` | `reaction` | `free`.
- `usage`: limites par tour/combat + ressource (ex: charges d'item).

### Ciblage
- `targeting.target`: `enemy` | `hostile` | `ally` | `self` | `cell` | `emptyCell`.
- `targeting.range`: `min`, `max`, `shape` (`SPHERE`, `CONE`, `LINE`, `CUBE`, `CYLINDER`).
- `targeting.maxTargets`: nombre max de cibles.
- `targeting.requiresLos`: bloque si pas de LOS.

### Resolution
- `resolution.kind`: `ATTACK_ROLL` | `SAVING_THROW` | `ABILITY_CHECK` | `CONTESTED_CHECK` | `NO_ROLL`.
- `resolution.save` / `resolution.check` / `resolution.contested`: selon le cas.

### Effets (branches d'issue)
- `ops.onHit`, `ops.onMiss`, `ops.onCrit`.
- `ops.onSaveFail`, `ops.onSaveSuccess`.
- `ops.onResolve` (toujours).

### Hooks (optionnels)

Utiliser des hooks pour les interactions avec traits, passifs, ou modificateurs d'items:
- `when`: phase (taxo).
- `if`: conditions.
- `prompt`: texte optionnel pour choix utilisateur.
- `apply`: operations a executer si conditions remplies.

## Tests minimaux (a coller sous l'item action)

```md
### Fiche de test - {itemActionId}

Contexte:
- Version data: {commit/ref}
- Testeur: {nom}
- Date: {YYYY-MM-DD}
- Build: {dev/prod}

Cas de figure:
- Cible valide / invalide
- Portee min / max
- LOS ok / bloque
- Usage ressource (charges/consommable)

Resolution:
- Hit / Miss / Crit (si applicable)
- Save success / fail (si applicable)

Hooks:
- Hook declenche
- Hook non declenche
- Prompt utilisateur (si applicable)

Resultats:
- Effets corrects (degats, soins, conditions)
- Ressource consommee correctement
- Log/EmitEvent ok

Approuve:
- Statut: {OK | KO | A REVOIR}
- Commentaire: {notes}
```

## Regles pratiques

- Un item utilisable = une intention claire.
- Favoriser `NO_ROLL` pour les interactions simples d'item.
- Les effets conditionnels vont dans les branches ou hooks, pas en logique externe.
- Les enums (targeting, shapes, ops, conditions) doivent suivre la taxonomie.
