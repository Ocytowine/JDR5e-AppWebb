# Notice de conception - Backgrounds

Ce document sert de reference pour creer des **backgrounds** (data `characters/backgrounds`) compatibles avec le creator.

## Objectif

- Standardiser la structure des backgrounds.
- Declarer les bonus et traits accordes.
- Garder la compatibilite avec les ecrans de creation.

## Structure recommandee (background)

```json
{
  "id": "apprenti-academique",
  "label": "Apprenti Academique",
  "description": "Formation savante, bibliotheques et traditions letrees.",
  "skills": ["arcana", "history"],
  "tools": [],
  "languages": ["commun"],
  "equipment": ["obj_plume_encre", "obj_grimoire"],
  "traits": {
    "personality": [
      "Je suis curieux et analyse chaque detail."
    ],
    "ideal": [
      "La connaissance est un pouvoir."
    ],
    "bond": [
      "Mon maitre m'a confie un grimoire ancien."
    ],
    "flaw": [
      "Je suis parfois trop theorique."
    ]
  },
  "grants": [
    { "kind": "bonus", "ids": ["asi-or-feat"] }
  ]
}
```

## Champs par champ

- `id`: identifiant unique.
- `label`: nom affiche.
- `description`: description courte.
- `skills`: competences de base.
- `tools`: outils maitrises.
- `languages`: langues connues.
- `equipment`: ids d'objets de depart.
- `traits`: tables de roleplay (personality/ideal/bond/flaw).
- `grants`: gains (bonus, traits, etc.) selon la taxonomie.
- `progression`: gains par niveau (optionnel), appliques selon le **niveau global** du personnage.

## Regle de niveau (important)

Pour les backgrounds:
- `progression` est evaluee avec `niveauGlobal` (pas un niveau de classe).
- Les gains sont integres dans `derived` et `progressionHistory` au meme titre que classe/sous-classe.

Exemple:

```json
{
  "progression": {
    "4": {
      "grants": [
        { "kind": "feature", "ids": ["field-contact-network"] }
      ]
    },
    "8": {
      "grants": [
        { "kind": "bonus", "ids": ["stat:INT:+1"] }
      ]
    }
  }
}
```

## Regles pratiques

- Garder des ids stables.
- Utiliser `grants` pour les bonus de stats ou dons.
- Le RP reste descriptif, la mecanique passe par `grants`.

## Tests minimaux

- Background charge dans le creator.
- Bonus bien pris en compte dans le calcul de stats.
- Inventaire initial correct.
- Progression background visible dans Sheet (bloc Historique) au niveau global.
- Grants de progression background visibles dans `derived.grants.*`.

## Liens utiles

- Vue d'ensemble navigation: `docs/notice/notice-navigation.md`
- Regles de progression harmonisees: `docs/characterCreator/progression-schema.md`
- Pipeline creator/runtime: `docs/notice/player-character-creator-design-notice.md`
- Races (meme logique niveau global): `docs/notice/race-design-notice.md`
- Materiel de depart: `docs/notice/item-design-notice.md`, `docs/notice/weapon-design-notice.md`, `docs/notice/armor-design-notice.md`
- Checklist finale: `docs/notice/content-author-checklist.md`
