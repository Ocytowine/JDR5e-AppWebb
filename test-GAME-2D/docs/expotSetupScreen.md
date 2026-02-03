# Export Combat Setup Screen

This document describes the JSON schema of the data produced by `CombatSetupScreen` and consumed
by `GameBoard.tsx` as the `characterConfig` (player configuration).

The schema focuses on fields that are read or written by the configurator and used in gameplay.
Fields not listed are allowed but ignored by the configurator.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CombatSetupCharacterConfig",
  "type": "object",
  "required": ["id", "nom", "caracs", "classe"],
  "properties": {
    "id": { "type": "string" },
    "nom": {
      "type": "object",
      "required": ["nomcomplet"],
      "properties": {
        "nomcomplet": { "type": "string" },
        "prenom": { "type": "string" },
        "surnom": { "type": "string" }
      },
      "additionalProperties": true
    },
    "raceId": { "type": "string" },
    "backgroundId": { "type": "string" },
    "niveauGlobal": { "type": "number" },
    "classLock": { "type": "boolean" },
    "creationLocks": {
      "type": "object",
      "additionalProperties": { "type": "boolean" }
    },
    "choiceSelections": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "pendingLocks": {
          "type": "object",
          "additionalProperties": { "type": "boolean" }
        },
        "statsBase": {
          "type": "object",
          "properties": {
            "FOR": { "type": "number" },
            "DEX": { "type": "number" },
            "CON": { "type": "number" },
            "INT": { "type": "number" },
            "SAG": { "type": "number" },
            "CHA": { "type": "number" }
          },
          "additionalProperties": true
        },
        "race": {
          "type": "object",
          "additionalProperties": true
        },
        "background": {
          "type": "object",
          "additionalProperties": true
        }
      }
    },
    "classe": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["classeId", "niveau"],
        "properties": {
          "classeId": { "type": "string" },
          "subclasseId": { "type": ["string", "null"] },
          "niveau": { "type": "number" }
        },
        "additionalProperties": true
      }
    },
    "combatStats": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "level": { "type": "number" },
        "mods": {
          "type": "object",
          "properties": {
            "str": { "type": "number" },
            "dex": { "type": "number" },
            "con": { "type": "number" },
            "int": { "type": "number" },
            "wis": { "type": "number" },
            "cha": { "type": "number" }
          },
          "additionalProperties": true
        }
      }
    },
    "caracs": {
      "type": "object",
      "required": ["force", "dexterite", "constitution"],
      "properties": {
        "force": { "type": "object", "properties": { "FOR": { "type": "number" } } },
        "dexterite": { "type": "object", "properties": { "DEX": { "type": "number" } } },
        "constitution": { "type": "object", "properties": { "CON": { "type": "number" } } },
        "intelligence": { "type": "object", "properties": { "INT": { "type": "number" } } },
        "sagesse": { "type": "object", "properties": { "SAG": { "type": "number" } } },
        "charisme": { "type": "object", "properties": { "CHA": { "type": "number" } } }
      },
      "additionalProperties": true
    },
    "competences": {
      "type": "array",
      "items": { "type": "string" }
    },
    "expertises": {
      "type": "array",
      "items": { "type": "string" }
    },
    "proficiencies": {
      "type": "object",
      "properties": {
        "weapons": { "type": "array", "items": { "type": "string" } },
        "armors": { "type": "array", "items": { "type": "string" } },
        "tools": { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": true
    },
    "langues": {
      "oneOf": [
        { "type": "string" },
        { "type": "array", "items": { "type": "string" } }
      ]
    },
    "descriptionPersonnage": {
      "type": "object",
      "properties": {
        "physique": { "type": "string" }
      },
      "additionalProperties": true
    },
    "profileDetails": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "equipmentAuto": { "type": "array", "items": { "type": "string" } },
    "equipmentManual": { "type": "array", "items": { "type": "string" } },
    "inventoryItems": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type"],
        "properties": {
          "id": { "type": "string" },
          "type": { "enum": ["object", "armor", "tool", "weapon"] },
          "qty": { "type": "number" },
          "source": { "enum": ["auto", "manual"] },
          "equippedSlot": { "type": ["string", "null"] },
          "storedIn": { "type": ["string", "null"] },
          "isPrimaryWeapon": { "type": "boolean" }
        },
        "additionalProperties": true
      }
    },
    "materielSlots": {
      "type": "object",
      "properties": {
        "corps": { "type": ["string", "null"] },
        "tete": { "type": ["string", "null"] },
        "gants": { "type": ["string", "null"] },
        "bottes": { "type": ["string", "null"] },
        "ceinture_gauche": { "type": ["string", "null"] },
        "ceinture_droite": { "type": ["string", "null"] },
        "dos_gauche": { "type": ["string", "null"] },
        "dos_droit": { "type": ["string", "null"] },
        "anneau_1": { "type": ["string", "null"] },
        "anneau_2": { "type": ["string", "null"] },
        "collier": { "type": ["string", "null"] },
        "bijou_1": { "type": ["string", "null"] },
        "bijou_2": { "type": ["string", "null"] },
        "paquetage": { "type": ["string", "null"] }
      },
      "additionalProperties": true
    },
    "armesDefaut": {
      "type": "object",
      "properties": {
        "main_droite": { "type": ["string", "null"] },
        "main_gauche": { "type": ["string", "null"] },
        "mains": { "type": ["string", "null"] }
      },
      "additionalProperties": true
    },
    "appearance": { "type": "object", "additionalProperties": true },
    "visionProfile": { "type": "object", "additionalProperties": true },
    "actionIds": { "type": "array", "items": { "type": "string" } },
    "reactionIds": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": true
}
```

Notes:
- `statsBase` is the point-buy base (8-15) before bonuses are applied.
- In normal mode, the configurator enforces 27 points using the 5e point-buy costs.
- Bonuses from race/background/classes are applied on top of base stats and are stored in `caracs`.
