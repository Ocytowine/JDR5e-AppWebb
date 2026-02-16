# Notice de conception - Sous-classes

Ce document sert de reference pour creer des **sous-classes** (data `characters/classes/*/*.json`) compatibles avec la progression.

## Objectif

- Standardiser la structure des sous-classes.
- Declarer les gains par niveau via `progression.grants`.
- Garder la cohesion avec la classe parente.

## Structure recommandee (sous-classe)

```json
{
  "id": "peace-domain",
  "classId": "cleric",
  "label": "Domaine de la Paix",
  "description": "Lien divin entre allies, soutien defensif et magie de protection.",
  "progression": {
    "1": {
      "grants": [
        { "kind": "feature", "ids": ["peace-bond"] },
        { "kind": "spell", "ids": ["heroism", "sanctuary"] }
      ]
    },
    "6": {
      "grants": [{ "kind": "feature", "ids": ["protective-bond"] }]
    }
  }
}
```

## Champs par champ

- `id`: identifiant unique (slug).
- `classId`: id de la classe parente.
- `label`: nom affiche.
- `description`: description courte.
- `progression`: table de gains par niveau (grants).
- `spellcasting`: optionnel si la sous-classe apporte sa propre magie.

## Progression (grants)

Pour une sous-classe, la progression est evaluee sur le **niveau de la classe parente**.

Exemple:
```json
{
  "progression": {
    "3": {
      "grants": [
        { "kind": "spell", "ids": ["aid"] }
      ]
    }
  }
}
```

`grant.kind` doit suivre la taxonomie (`action`, `reaction`, `passif`, `feature`, `spell`, `resource`, `bonus`).
Note: un `passif` correspond a un status type cote engine.

Reference harmonisee:
- `docs/characterCreator/progression-schema.md` (regles communes classe/sous-classe/race/background).

## Regles pratiques

- Toujours lier `classId`.
- Eviter de dupliquer les gains deja declares dans la classe.
- Les sorts fixes peuvent etre declares en `grants` si `freePreparedFromGrants` est active.
- Garder les niveaux en string (ex: `"3"`, `"6"`).

## Tests minimaux

- Sous-classe resolue par son `classId`.
- Gains visibles dans le creator.
- Interactions avec `spellcasting` correctes si present.
- Gains de progression sous-classe presents dans `derived.grants.*` et `progressionHistory`.

## Liens utiles

- Vue d'ensemble navigation: `docs/notice/notice-navigation.md`
- Classe parente: `docs/notice/class-design-notice.md`
- Regles de progression harmonisees: `docs/characterCreator/progression-schema.md`
- Pipeline creator/runtime: `docs/notice/player-character-creator-design-notice.md`
- Sorts: `docs/notice/spell-design-notice.md`
- Features runtime (modifiers/hooks): `docs/notice/feature-modifiers-notice.md`
- Actions data-driven: `docs/ActionEngine/action-creation-notice.md`
