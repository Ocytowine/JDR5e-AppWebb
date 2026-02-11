# Notice de conception - Armures (items)

Ce document sert de reference pour creer des armures au format data item, avec variantes de proprietes typiques (legeres, intermediaires, lourdes, boucliers).

## Objectif

- Standardiser la structure des armures.
- Formaliser les variantes selon la categorie d'armure.
- Garantir la compatibilite avec ActionEngine (tags et materiaux coherents).

## Structure recommandee (armure)

```json
{
  "id": "cuir",
  "label": "Armure de cuir",
  "type": "armor",
  "armorCategory": "light",
  "baseAC": 11,
  "dexCap": null,
  "weight": 5,
  "tags": ["armure", "legere", "material:leather"],
  "description": "Armure legere en cuir.",
  "category": "armor_body",
  "value": { "platinum": 0, "gold": 10.0, "silver": 0, "copper": 0 }
}
```

## Champs par champ

- `id`: identifiant unique (slug).
- `label`: nom affiche.
- `type`: `armor`.
- `armorCategory`: `light` | `medium` | `heavy` | `shield`.
- `baseAC`: bonus de CA de base.
- `dexCap`: plafond du bonus Dex (null si pas de plafond).
- `weight`: poids.
- `tags`: tags gameplay + `material:<id>`.
- `description`: texte court.
- `category`: `armor_body` | `shield` (selon l'item).
- `value`: prix par devise.

## Variantes (patterns)

### 1) Armure legere

```json
{
  "armorCategory": "light",
  "baseAC": 11,
  "dexCap": null,
  "tags": ["armure", "legere", "material:leather"]
}
```

### 2) Armure intermediaire

```json
{
  "armorCategory": "medium",
  "baseAC": 13,
  "dexCap": 2,
  "tags": ["armure", "intermediaire", "material:metal"]
}
```

### 3) Armure lourde

```json
{
  "armorCategory": "heavy",
  "baseAC": 16,
  "dexCap": 0,
  "tags": ["armure", "lourde", "material:metal"]
}
```

### 4) Bouclier

```json
{
  "armorCategory": "shield",
  "baseAC": 2,
  "dexCap": null,
  "category": "shield",
  "tags": ["armure", "bouclier", "material:wood"]
}
```

## Regles pratiques

- `baseAC` = contribution de l'armure a la CA (regle locale).
- `dexCap` = plafond du bonus Dex si applicable.
- Ajouter `material:<id>` (ex: `material:metal`, `material:leather`).
