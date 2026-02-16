# Notice de conception - Races

Ce document sert de reference pour creer des **races** (data `characters/races`) compatibles avec le creator.

## Objectif

- Standardiser la structure des races.
- Declarer les traits, vision, taille, vitesse.
- Aligner les gains sur le schema de progression.

## Structure recommandee (race)

```json
{
  "id": "elf",
  "label": "Elfe",
  "description": "Grace et perception affutee, l'elfe a une affinite naturelle avec la magie.",
  "size": "medium",
  "speed": 6,
  "vision": { "mode": "darkvision", "range": 60 },
  "traits": [
    {
      "id": "keen_senses",
      "label": "Sens aiguises",
      "description": "Avantage sur les tests de Perception basee sur la vue ou l'ouie."
    }
  ],
  "grants": [{ "kind": "trait", "ids": ["keen_senses"] }],
  "progression": {
    "5": {
      "grants": [{ "kind": "feature", "ids": ["fey-step"] }]
    }
  }
}
```

## Champs par champ

- `id`: identifiant unique.
- `label`: nom affiche.
- `description`: description courte.
- `size`: taille (`tiny|small|medium|large|huge|gargantuan` selon taxo).
- `speed`: vitesse en metres.
- `vision`: mode + portee.
- `traits`: traits RP/mecaniques.
- `grants`: gains de base.
- `progression`: gains par niveau (optionnel), appliques selon le **niveau global** du personnage.

## Regle de niveau (important)

Pour les races:
- `progression` est evaluee avec `niveauGlobal` (et non un niveau de classe).
- Les grants de race en progression sont projetes dans `derived` et `progressionHistory` comme les classes.

Exemple de gain progressif data-driven:

```json
{
  "progression": {
    "3": {
      "grants": [
        { "kind": "feature", "ids": ["fey-step"] }
      ]
    },
    "5": {
      "grants": [
        { "kind": "bonus", "ids": ["stat:DEX:+1"] }
      ]
    }
  }
}
```

## Regles pratiques

- Garder les gains de base dans `grants`.
- Utiliser `progression` si la race evolue avec le niveau.
- Les `traits` doivent avoir un id stable.

## Tests minimaux

- Race chargee dans le creator.
- Traits affiches et pris en compte.
- Vision/vitesse coherent.
- Progression race visible dans Sheet (bloc Espece) au niveau global.
- Grants de progression race presentes dans `derived.grants.*`.

## Liens utiles

- Vue d'ensemble navigation: `docs/notice/notice-navigation.md`
- Regles de progression harmonisees: `docs/characterCreator/progression-schema.md`
- Pipeline creator/runtime: `docs/notice/player-character-creator-design-notice.md`
- Backgrounds (meme logique niveau global): `docs/notice/background-design-notice.md`
- Checklist finale: `docs/notice/content-author-checklist.md`
