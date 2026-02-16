# Notice de conception - Armures (ActionEngine)

Ce document decrit le format d'armure compatible avec le runtime actuel.

## Objectif

1. Produire des armures lues correctement par le calcul de CA.
2. Permettre des bonus passifs d'equipement via `grants`.
3. Eviter les champs non supportes ou ambigus.

## Structure recommandee

```json
{
  "id": "cuir",
  "label": "Armure de cuir",
  "type": "armor",
  "armorCategory": "light",
  "baseAC": 11,
  "dexCap": null,
  "harmonisable": false,
  "weight": 5,
  "tags": ["armure", "legere", "leather"],
  "grants": [
    {
      "kind": "bonus",
      "inline": [
        {
          "id": "bonus-cuir-mobilite",
          "label": "+1 moveRange",
          "summary": "Actif tant que l'armure est equipee.",
          "stat": "moveRange",
          "value": 1,
          "mode": "add",
          "tags": ["equip", "armor"],
          "requirements": [],
          "source": { "book": "PHB2024", "page": 0 }
        }
      ]
    }
  ],
  "description": "Armure legere en cuir.",
  "category": "armor_body",
  "value": { "platinum": 0, "gold": 10.0, "silver": 0, "copper": 0 }
}
```

## Champs importants

1. `type` doit etre `armor`.
2. `armorCategory` doit etre `light|medium|heavy|shield`.
3. `baseAC` est la contribution principale de l'armure.
4. `dexCap`:
   - `null` = pas de plafond dex.
   - nombre = plafond du mod DEX applique a la CA.
5. `category` recommande:
   - `armor_body` pour armure portée,
   - `shield` pour bouclier.
6. `grants` supporte le mode hybride bonus (`ids` et/ou `inline`).
7. `harmonisable`:
   - `false`: bonus actifs immediatement a l'equipement.
   - `true`: bonus actifs seulement si l'item est harmonise.

## Comportement runtime reel

1. La CA est calculee depuis l'equipement:
   - armures: `baseAC + dex applique`,
   - bouclier: bonus additionnel.
2. Les bonus d'equipement (`grants.kind = "bonus"`) sont appliques sur `CombatStats`.
3. Les `requirements` des bonus sont evalues via `ConditionExpr[]`.

Tags runtime utiles pour requirements:
1. `equip:item:<id>`
2. `equip:type:armor`
3. `equip:slot:<slotId>`
4. `equip:armorCategory:light|medium|heavy|shield`

Harmonisation:
1. Source unique: `character.attunements[instanceId] === true`.
2. `instanceId` est celui de l'item equipe.

## Variantes

### Armure legere

```json
{
  "armorCategory": "light",
  "baseAC": 11,
  "dexCap": null,
  "tags": ["armure", "legere", "leather"]
}
```

### Armure intermediaire

```json
{
  "armorCategory": "medium",
  "baseAC": 13,
  "dexCap": 2,
  "tags": ["armure", "intermediaire", "metal"]
}
```

### Armure lourde

```json
{
  "armorCategory": "heavy",
  "baseAC": 16,
  "dexCap": 0,
  "tags": ["armure", "lourde", "metal"]
}
```

### Bouclier

```json
{
  "armorCategory": "shield",
  "baseAC": 2,
  "dexCap": null,
  "category": "shield",
  "tags": ["armure", "bouclier", "wood"]
}
```

## Grants bonus (hybride)

Bonus catalogue:

```json
{
  "grants": [{ "kind": "bonus", "ids": ["bonus-ac-1"] }]
}
```

Bonus inline conditionnel:

```json
{
  "grants": [
    {
      "kind": "bonus",
      "inline": [
        {
          "id": "bonus-avec-bouclier",
          "label": "+1 CA",
          "summary": "Actif si bouclier equipe.",
          "stat": "armorClass",
          "value": 1,
          "mode": "add",
          "tags": ["equip", "armor"],
          "requirements": [
            { "type": "ACTOR_HAS_TAG", "tag": "equip:armorCategory:shield" }
          ],
          "source": { "book": "PHB2024", "page": 0 }
        }
      ]
    }
  ]
}
```

## Regles pratiques

1. Utiliser des `tags` materiaux simples (`metal`, `leather`, `wood`).
2. Eviter les effets actifs ici; reserver-les aux `actions`.
3. Pour les bonus, suivre `test-GAME-2D/docs/notice/bonus-design-notice.md`.

## Liens utiles

1. Vue d'ensemble navigation: `docs/notice/notice-navigation.md`
2. Bonus equipement: `docs/notice/bonus-design-notice.md`
3. Armes: `docs/notice/weapon-design-notice.md`
4. Objets equipement: `docs/notice/item-design-notice.md`
5. Pipeline equipement runtime: `docs/ActionEngine/equipment-passives-and-multidamage-plan.md`
