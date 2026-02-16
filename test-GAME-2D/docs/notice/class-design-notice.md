# Notice de conception - Classes

Ce document sert de reference pour creer des **classes** (data `characters/classes`) en respectant la taxonomie et la logique de progression.

## Objectif

- Standardiser la structure des classes.
- Declarer les gains par niveau via `progression.grants`.
- Garder le format compatible avec le PlayerCharacterCreator.

## Structure recommandee (classe)

```json
{
  "id": "cleric",
  "label": "Clerc",
  "description": "Un guide spirituel capable de soigner et de canaliser la puissance divine.",
  "hitDie": 8,
  "subclassLevel": 1,
  "subclassIds": ["peace-domain"],
  "proficiencies": {
    "weapons": ["simple"],
    "armors": ["legere", "intermediaire", "bouclier"]
  },
  "equipment": ["obj_symbole_sacre"],
  "spellcasting": {
    "ability": "SAG",
    "preparation": "prepared",
    "storage": "memory",
    "focusTypes": ["holy_symbol"],
    "spellFilterTags": ["cleric"],
    "freePreparedFromGrants": true,
    "casterProgression": "full",
    "slotsByLevel": {
      "1": [2, 0, 0, 0, 0, 0, 0, 0, 0]
    }
  },
  "progression": {
    "1": {
      "grants": [{ "kind": "feature", "ids": ["channel-divinity"] }],
      "description": "Incantation divine et lancement de sorts geres ailleurs."
    },
    "4": {
      "grants": [{ "kind": "bonus", "ids": ["asi-or-feat"] }]
    }
  }
}
```

## Champs par champ

- `id`: identifiant unique (slug).
- `label`: nom affiche.
- `description`: description courte.
- `hitDie`: de vie (ex: 6, 8, 10).
- `subclassLevel`: niveau d'acces a la sous-classe.
- `subclassIds`: ids des sous-classes associees.
- `proficiencies`: maitresses de combat (armes/armures/outils).
- `equipment`: ids d'objets de depart (inventaire).
- `spellcasting`: bloc magique si la classe est lanceuse de sorts.
- `progression`: table de gains par niveau (voir ci-dessous).

## Progression (grants)

`progression` mappe un niveau vers une liste de `grants`.
Pour une classe, ce niveau est evalue sur le **niveau de cette classe** (pas `niveauGlobal`).

Exemple:
```json
{
  "progression": {
    "2": {
      "grants": [
        { "kind": "feature", "ids": ["turn-undead"] },
        { "kind": "bonus", "ids": ["asi-or-feat"] }
      ],
      "description": "Nouveaux pouvoirs au niveau 2."
    }
  }
}
```

`grant.kind` doit suivre la taxonomie (`action`, `reaction`, `passif`, `feature`, `spell`, `resource`, `bonus`).

Reference harmonisee:
- `docs/characterCreator/progression-schema.md` (regles communes classe/sous-classe/race/background).

## Regles pratiques

- Garder `progression` explicite meme si vide (placeholder clair).
- Utiliser `grants` pour tout ce qui est debloque en progression.
- Eviter d'ajouter des logiques mecaniques dans le texte: utiliser des features/passifs (un passif = status type).
- Les ids doivent correspondre aux index (`data/actions`, `data/features`, `data/passifs`, `data/spells`, `data/bonus`).

## Tests minimaux

- Classe chargee par le catalogue.
- Gains de niveau visibles dans le creator.
- `subclassIds` resolus.
- `spellcasting` coherent (si present).
- Gains de progression classes presents dans `derived.grants.*` et `progressionHistory`.

## Liens utiles

- Vue d'ensemble navigation: `docs/notice/notice-navigation.md`
- Regles de progression harmonisees: `docs/characterCreator/progression-schema.md`
- Pipeline creator/runtime: `docs/notice/player-character-creator-design-notice.md`
- Sous-classes: `docs/notice/subclass-design-notice.md`
- Sorts (si bloc `spellcasting`): `docs/notice/spell-design-notice.md`
- Features runtime (modifiers/hooks): `docs/notice/feature-modifiers-notice.md`
- Actions data-driven: `docs/ActionEngine/action-creation-notice.md`
- Materiel de depart: `docs/notice/item-design-notice.md`, `docs/notice/weapon-design-notice.md`, `docs/notice/armor-design-notice.md`
