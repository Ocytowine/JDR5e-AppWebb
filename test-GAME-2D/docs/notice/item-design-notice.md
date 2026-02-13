# Notice de conception - Items (ActionEngine)

Ce document couvre les items non-armes (objets/outils divers) et leurs usages compatibles runtime.

## Objectif

1. Standardiser les objets d'inventaire.
2. Permettre les bonus passifs d'equipement via `grants`.
3. Definir des actions d'item coherentes avec l'ActionEngine.

## 1) Donnee d'inventaire (item)

```json
{
  "id": "obj_torche",
  "label": "Torche",
  "type": "object",
  "category": "gear",
  "harmonisable": false,
  "weight": 0.5,
  "tags": ["torche", "consommable", "wood"],
  "grants": [
    {
      "kind": "bonus",
      "inline": [
        {
          "id": "bonus-torche-vigilance",
          "label": "+1 perception passive",
          "summary": "Exemple de bonus local.",
          "stat": "attackBonus",
          "value": 0,
          "mode": "add",
          "tags": ["equip", "object"],
          "requirements": [],
          "source": { "book": "PHB2024", "page": 0 }
        }
      ]
    }
  ],
  "description": "Torche simple pour eclairer.",
  "value": { "platinum": 0, "gold": 0, "silver": 0, "copper": 1 }
}
```

### Champs importants (item)

1. `type`: `object` (ou autre type d'item du modele).
2. `category`: categorie inventaire (ex: `gear`, `pack`).
3. `tags`: mots-clefs gameplay + materiau (`wood`, `metal`, `leather`, ...).
4. `grants`: passifs/bonus d'equipement.
5. `value`: prix par devise.
6. `harmonisable`:
   - `false`: bonus actifs immediatement a l'equipement.
   - `true`: bonus actifs seulement si l'item est harmonise.

### Compatibilite devise

1. Format recommande en data item:
   - `value.platinum`, `value.gold`, `value.silver`, `value.copper`.
2. Compatibilite runtime legacy conservee:
   - `value.pp`, `value.po`, `value.pa`, `value.pc`.
3. Si les deux formes coexistent, garder une seule source de verite dans les JSON d'items (preferer `platinum/gold/silver/copper`).

## 2) Action d'item (ActionSpec)

```json
{
  "id": "torch-toggle",
  "name": "Allumer la torche",
  "summary": "Allume ou eteint la torche.",
  "category": "item",
  "tags": ["item", "torch", "utility", "wood"],
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

### Champs importants (action)

1. `category` doit etre `item`.
2. `actionCost.actionType`: `action|bonus|reaction|free`.
3. `targeting` conforme taxo (`target`, `range`, `shape`, `requiresLos`).
4. `resolution.kind` conforme (`NO_ROLL`, `ATTACK_ROLL`, etc.).
5. `ops` dans les branches supportees (`onResolve`, `onHit`, `onMiss`, `onCrit`, ...).

## Bonus d'equipement (hybride)

Mode catalogue:

```json
{
  "grants": [
    { "kind": "bonus", "ids": ["bonus-move-1"] }
  ]
}
```

Mode inline:

```json
{
  "grants": [
    {
      "kind": "bonus",
      "inline": [
        {
          "id": "bonus-local-move-1",
          "label": "+1 moveRange",
          "summary": "Actif tant que l'objet est equipe.",
          "stat": "moveRange",
          "value": 1,
          "mode": "add",
          "tags": ["equip", "object"],
          "requirements": [],
          "source": { "book": "PHB2024", "page": 0 }
        }
      ]
    }
  ]
}
```

`requirements` utilise `ConditionExpr[]`.

Tags runtime disponibles:
1. `equip:item:<id>`
2. `equip:type:object`
3. `equip:slot:<slotId>`
4. `equip:objectCategory:<category>`

Harmonisation:
1. Source unique: `character.attunements[instanceId] === true`.
2. `instanceId` est celui de l'item equipe.

## Important sur le lien item/action

1. Les actions d'item sont des `ActionDefinition` dans `src/data/items/*.json`.
2. L'objet d'inventaire (`type: object`) et l'action sont deux donnees distinctes.
3. Le couplage gameplay se fait via les actions disponibles du personnage (pas via un champ `links.actionId` standard sur `object`).

Pour les armes, utiliser la notice dediee:
1. `test-GAME-2D/docs/notice/weapon-design-notice.md`

## Checklist rapide (IA)

1. Item inventaire valide (`type`, `category`, `tags`, `value`, `grants` si besoin).
2. Action d'item valide (`category=item`, `targeting`, `resolution`, `ops`).
3. Si bonus: `kind=bonus` avec `ids` et/ou `inline`.
4. `requirements` bonus en `ConditionExpr[]`.
5. Materiaux en tags simples (`wood`, `metal`, `leather`, ...).
