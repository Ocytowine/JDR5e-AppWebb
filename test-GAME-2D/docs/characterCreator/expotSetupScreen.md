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
          "description": "Base point-buy interne UI (non source de verite). Optionnel a l'export.",
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
          "description": "Modificateurs derives de caracs (optionnel, peut etre recalculé).",
          "properties": {
            "modFOR": { "type": "number" },
            "modDEX": { "type": "number" },
            "modCON": { "type": "number" },
            "modINT": { "type": "number" },
            "modSAG": { "type": "number" },
            "modCHA": { "type": "number" }
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
    "derived": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "grants": {
          "type": "object",
          "additionalProperties": {
            "type": "array",
            "items": { "type": "string" }
          },
          "properties": {
            "traits": { "type": "array", "items": { "type": "string" } },
            "features": { "type": "array", "items": { "type": "string" } },
            "feats": { "type": "array", "items": { "type": "string" } },
            "skills": { "type": "array", "items": { "type": "string" } },
            "weaponMasteries": { "type": "array", "items": { "type": "string" } },
            "tools": { "type": "array", "items": { "type": "string" } },
            "languages": { "type": "array", "items": { "type": "string" } },
            "spells": { "type": "array", "items": { "type": "string" } },
            "actions": { "type": "array", "items": { "type": "string" } },
            "reactions": { "type": "array", "items": { "type": "string" } },
            "resources": { "type": "array", "items": { "type": "string" } },
            "passifs": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    },
    "spellcastingState": {
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "totalCasterLevel": { "type": "number" },
        "slots": { "type": "object", "additionalProperties": true },
        "sources": {
          "type": "object",
          "additionalProperties": {
            "type": "object",
            "additionalProperties": true,
            "properties": {
              "focusInstanceId": { "type": "string" },
              "slots": { "type": "object", "additionalProperties": true },
              "preparedSpellIds": { "type": "array", "items": { "type": "string" } },
              "knownSpellIds": { "type": "array", "items": { "type": "string" } },
              "grantedSpellIds": { "type": "array", "items": { "type": "string" } }
            }
          }
        },
        "spellGrants": {
          "type": "object",
          "description": "Canonique pour tracer la provenance et l'usage de chaque sort par source.",
          "additionalProperties": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["entryId", "spellId", "sourceType"],
              "additionalProperties": true,
              "properties": {
                "entryId": { "type": "string" },
                "spellId": { "type": "string" },
                "sourceType": { "type": "string" },
                "sourceId": { "type": "string" },
                "sourceKey": { "type": "string" },
                "sourceInstanceId": { "type": "string" },
                "grantedAtLevel": { "type": "number" },
                "prepared": { "type": "boolean" },
                "alwaysPrepared": { "type": "boolean" },
                "countsAgainstPreparation": { "type": "boolean" },
                "tags": { "type": "array", "items": { "type": "string" } },
                "usage": {
                  "type": "object",
                  "additionalProperties": true,
                  "properties": {
                    "type": { "type": "string" },
                    "consumesSlot": { "type": "boolean" },
                    "maxUses": { "type": "number" },
                    "remainingUses": { "type": "number" },
                    "resetOn": { "type": "string" },
                    "fixedSlotLevel": { "type": "number" },
                    "poolId": { "type": "string" }
                  }
                }
              }
            }
          }
        },
        "slotJustifications": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": true
          }
        }
      }
    },
    "progressionHistory": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["source", "level", "type", "payload"],
        "properties": {
          "source": { "type": "string" },
          "level": { "type": "number" },
          "type": { "type": "string" },
          "payload": { "type": "object", "additionalProperties": true }
        },
        "additionalProperties": true
      }
    },
    "actionIds": { "type": "array", "items": { "type": "string" } },
    "reactionIds": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": true
}
```

Notes:
- `caracs` est la source de verite pour les attributs.
- `combatStats.mods` est derive de `caracs` (optionnel a l'export).
- `statsBase` est un cache UI (point-buy 8-15) et ne doit pas etre traite comme source de verite.
- In normal mode, the configurator enforces 27 points using the 5e point-buy costs.
- Bonuses from race/background/classes are applied on top of base stats and are stored in `caracs`.
- `derived` et `progressionHistory` sont utilises par `GameBoard.tsx` pour projeter les actions/reactions/ressources runtime.
- `spellcastingState.spellGrants` est la source canonique de provenance des sorts (classe, sous-classe, objet, etc.).
- Compatibilite legacy: `sources[*].preparedSpellIds`, `knownSpellIds`, `grantedSpellIds` restent supportes pour les saves existantes.

Liens:
- `docs/notice/player-character-creator-design-notice.md`
- `docs/characterCreator/progression-schema.md`
- `docs/notice/content-author-checklist.md`
