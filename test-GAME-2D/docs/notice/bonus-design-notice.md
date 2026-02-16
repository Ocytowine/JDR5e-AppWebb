# Notice de conception - Bonus (grants)

Ce document decrit le format des **bonus** references par `grants` (items/equipements, features, etc.), en mode **hybride** (catalogue + inline).

## Objectif

- Standardiser les bonus d'equipement.
- Garder une reference claire a la taxonomie.
- Faciliter l'assemblage des passifs dans l'engine.
- Permettre les bonus uniques sans surcharger le catalogue.

## Structure recommandee (bonus)

```json
{
  "id": "bonus-dex-1",
  "label": "+1 DEX",
  "summary": "Augmente le modificateur de DEX de 1.",
  "stat": "modDEX",
  "value": 1,
  "mode": "add",
  "tags": ["equip", "stat"],
  "requirements": [],
  "source": { "book": "PHB2024", "page": 0 }
}
```

## Champs par champ

- `id`: identifiant unique.
- `label`: nom affiche.
- `summary`: description courte.
- `stat`: stat cible (voir taxonomie `bonus.stat`).
- `value`: valeur appliquee.
- `mode`: mode d'application (`add`, `set`, `max`).
- `tags`: tags libres utiles aux filtres.
- `requirements`: prerequis (optionnels).
- `source`: source (optionnel).

## Usage via grants (mode hybride)

Un bonus peut etre reference de 2 facons:
1. via `ids` (catalogue bonus reutilisable),
2. via `inline` (bonus defini directement dans l'item).

### A) Bonus catalogue (`ids`)

```json
{
  "grants": [
    { "kind": "bonus", "ids": ["bonus-dex-1"] }
  ]
}
```

### B) Bonus inline

```json
{
  "grants": [
    {
      "kind": "bonus",
      "inline": [
        {
          "id": "bonus-local-dex-1",
          "label": "+1 DEX (local)",
          "summary": "Bonus propre a cet item.",
          "stat": "modDEX",
          "value": 1,
          "mode": "add",
          "tags": ["equip", "stat"],
          "requirements": [],
          "source": { "book": "PHB2024", "page": 0 }
        }
      ]
    }
  ]
}
```

Regle:
1. pour `kind = "bonus"`, fournir au moins `ids` ou `inline`.

## Requirements

`requirements` suit le meme langage que les conditions ActionEngine (`ConditionExpr[]`).

Exemple conditionnel (bonus actif seulement avec bouclier equipe):

```json
{
  "requirements": [
    { "type": "ACTOR_HAS_TAG", "tag": "equip:armorCategory:shield" }
  ]
}
```

## Regles pratiques

- Preferer des bonus atomiques (un seul effet par bonus).
- Eviter les effets complexes (utiliser `passif`/`feature` si besoin).
- Garder les `stat` dans la liste de la taxonomie.
- Utiliser `inline` pour les bonus uniques, `ids` pour les bonus reutilises.

## Liens utiles

- Vue d'ensemble navigation: `docs/notice/notice-navigation.md`
- Armes: `docs/notice/weapon-design-notice.md`
- Armures: `docs/notice/armor-design-notice.md`
- Objets equipement: `docs/notice/item-design-notice.md`
- Features runtime (si bonus portes par feature): `docs/notice/feature-modifiers-notice.md`
