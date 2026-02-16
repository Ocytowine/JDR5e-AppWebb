# Schema de progression (Classes / Sous-classes / Especes / Backgrounds)

Ce document propose un **schema de progression commun** pour les JSON de classe, sous-classe, espece et background.
Il est concu pour rester compatible avec les chargeurs actuels (`classCatalog.ts`, `raceCatalog.ts`)
tout en ajoutant des **gains par niveau** (features, actions, reactions, passifs, ressources, etc.).

Objectif : rendre le passage de niveau effectif en jeu, sans logique hardcodee dans le moteur.

## Etat actuel (important)

- **Fonctionnel**: Clerc (classe + sous-classe `peace-domain`) utilise `progression` + `grants` et est bien pris en compte par le PlayerCharacterCreator.
- **Fonctionnel**: Guerrier + `eldritch-knight` disposent d'une progression declaree (voir `docs/characterCreator/classes/guerrier.md`).
- **Partiel**: les races utilisent surtout des `grants` simples (traits), avec peu de cas `progression` multi-niveaux.

Ce document decrit la **cible** et le schema commun vise, mais l'implementation actuelle est **partielle**.

---

## Concept de base

Chaque JSON de definition (`class.json`, `subclass.json`, `race.json`, `background.json`) peut inclure :
- `progression` : une table niveau -> gains
- `features` : catalogue local optionnel (ou reference vers `src/data/features`)
- `grants` declaratifs qui peuvent pointer vers `src/data/actions`, `src/data/reactions`,
  `src/data/passifs` et `src/data/features`.

## Regle d evaluation des niveaux (harmonisee)

- `class:*` -> progression evaluee sur le niveau de la classe concernee.
- `subclass:*` -> progression evaluee sur le niveau de sa classe parente.
- `race:*` -> progression evaluee sur `niveauGlobal`.
- `background:*` -> progression evaluee sur `niveauGlobal`.

Cette regle est appliquee dans le creator pour:
- `derived.grants.*`
- `progressionHistory`
- recap de progression affichee dans la Sheet.

---

## Schema JSON partage (brouillon)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ProgressionDefinition",
  "type": "object",
  "properties": {
    "progression": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "grants": {
            "type": "array",
            "items": { "$ref": "#/definitions/grant" }
          },
          "notes": { "type": "string" }
        },
        "additionalProperties": false
      }
    }
  },
  "definitions": {
    "grant": {
      "type": "object",
      "required": ["kind", "ids"],
      "properties": {
        "kind": {
          "type": "string",
          "enum": ["action", "reaction", "passif", "feature", "spell", "resource", "bonus"]
        },
        "ids": {
          "type": "array",
          "items": { "type": "string" }
        },
        "source": { "type": "string" },
        "meta": { "type": "object", "additionalProperties": true }
      },
      "additionalProperties": false
    }
  }
}
```

---

## Correspondance avec les donnees actuelles

### Actions
Utiliser `src/data/actions/index.json` et les ids d action existants.

```json
{ "kind": "action", "ids": ["dash", "melee-strike"] }
```

### Reactions
Utiliser `src/data/reactions/index.json`.

```json
{ "kind": "reaction", "ids": ["opportunity-attack"] }
```

### Passifs (Status types)
Utiliser `src/data/passifs/index.json` (un `passif` = un **status type** cote engine).

```json
{ "kind": "passif", "ids": ["burning"] }
```

### Features (nouveau)
Utiliser `src/data/features`. Ces elements sont declaratifs et decrivent des regles, des triggers ou des effets passifs.

```json
{ "kind": "feature", "ids": ["peace-bond"] }
```

### Sorts (si on souhaite tracer les sorts toujours prepares)
```json
{ "kind": "spell", "ids": ["heroism", "sanctuary"] }
```

### Ressources
Ex : Channel Divinity. Necessite un support moteur, mais on le declare ici.

```json
{
  "kind": "resource",
  "ids": ["channel-divinity"],
  "meta": { "max": 1, "recharge": "short_rest" }
}
```

---

## Exemple : progression de sous-classe (Domaine de la Paix)

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
    "2": {
      "grants": [
        { "kind": "feature", "ids": ["balm-of-peace"] }
      ]
    },
    "3": {
      "grants": [
        { "kind": "spell", "ids": ["aid", "warding-bond"] }
      ]
    },
    "6": {
      "grants": [
        { "kind": "feature", "ids": ["protective-bond"] }
      ]
    },
    "17": {
      "grants": [
        { "kind": "feature", "ids": ["expansive-bond"] }
      ]
    }
  }
}
```

---

## Exemple : progression d espece (evolutive, niveau global)

```json
{
  "id": "elf",
  "label": "Elfe",
  "description": "Grace ancestrale et sens affines.",
  "progression": {
    "3": {
      "grants": [
        { "kind": "passif", "ids": ["keen-senses"] }
      ]
    },
    "5": {
      "grants": [
        { "kind": "feature", "ids": ["fey-step"] }
      ]
    }
  }
}
```

---

## Etape suivante (integration)

Ce schema peut etre consomme par :
- `CombatSetupScreen.tsx` (afficher les gains par niveau)
- `GameBoard.tsx` ou un nouveau resolveur de progression (appliquer les gains au changement de niveau)

Suggestion minimaliste :
1. Ajouter une etape `resolveProgressionGrants(characterConfig)` dans `GameBoard.tsx`.
2. Fusionner `actionIds`, `reactionIds`, `passifs` et champs de ressources a partir des sources de progression.

Aucun changement de code n est applique ici.

## Liens utiles

- Navigation notices: `docs/notice/notice-navigation.md`
- Pipeline creator/runtime: `docs/notice/player-character-creator-design-notice.md`
- Checklist auteur: `docs/notice/content-author-checklist.md`
