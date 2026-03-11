# Compatibilité fiche personnage

````json
{
  "id": "pj-1",
  "nom": {
    "nomcomplet": "Test Hero",
    "prenom": "Aryn",
    "surnom": "the Blue"
  },
  "age": 25,
  "sexe": "H",
  "taille": 175,
  "poids": 70,
  "langues": [
    "commun"
  ],
  "alignement": "Neutral Good",
  "raceId": "human",
  "backgroundId": "veteran-de-guerre",
  "classe": {
    "1": {
      "classeId": "fighter",
      "subclasseId": "eldritch-knight",
      "niveau": 4
    }
  },
  "niveauGlobal": 4,
  "xp": 0,
  "dv": 10,
  "maitriseBonus": 2,
  "pvActuels": 36,
  "pvTmp": 0,
  "nivFatigueActuel": 0,
  "nivFatigueMax": 3,
  "actionIds": [
    "melee-strike",
    "dash"
  ],
  "reactionIds": [],
  "combatStats": {
    "level": 4,
    "mods": {
      "modFOR": 2,
      "modDEX": 3,
      "modCON": 2,
      "modINT": 1,
      "modSAG": 0,
      "modCHA": -1
    },
    "maxHp": 36,
    "armorClass": 13,
    "attackBonus": 4,
    "maxAttacksPerTurn": 1,
    "actionsPerTurn": 1,
    "bonusActionsPerTurn": 1,
    "actionRules": {
      "forbidSecondAttack": true
    },
    "resources": {}
  },
  "caracs": {
    "force": {
      "FOR": 14,
      "modFOR": 2
    },
    "dexterite": {
      "DEX": 17,
      "modDEX": 3
    },
    "constitution": {
      "CON": 14,
      "modCON": 2
    },
    "intelligence": {
      "INT": 12,
      "modINT": 1
    },
    "sagesse": {
      "SAG": 10,
      "modSAG": 0
    },
    "charisme": {
      "CHA": 8,
      "modCHA": -1
    }
  },
  "movementModes": {
    "walk": 6
  },
  "visionProfile": {
    "shape": "cone",
    "range": 100,
    "apertureDeg": 180,
    "lightVision": "normal"
  },
  "appearance": {
    "spriteKey": "character",
    "tokenScale": 100
  },
  "competences": [
    "athletisme",
    "intimidation",
    "nature"
  ],
  "expertises": [],
  "initiative": "modDEX",
  "besoin": [],
  "percPassive": 10,
  "proficiencies": {
    "weapons": [
      "simple",
      "martiale"
    ],
    "armors": [
      "legere",
      "intermediaire",
      "lourde",
      "bouclier"
    ],
    "tools": [
      "outils_vehicules",
      "outils_jeux"
    ]
  },
  "weaponMasteries": [
    "coup-double",
    "enchainement",
    "ouverture"
  ],
  "savingThrows": [
    "force",
    "constitution"
  ],
  "inspiration": false,
  "notes": "",
  "argent": {
    "cuivre": 0,
    "argent": 0,
    "or": 10,
    "platine": 0
  },
  "materielSlots": {
    "corps": "obj_vetements_voyage",
    "tete": null,
    "gants": null,
    "bottes": null,
    "ceinture_gauche": "obj_petit_couteau",
    "ceinture_droite": "obj_petit_couteau",
    "dos_gauche": null,
    "dos_droit": null,
    "anneau_1": null,
    "anneau_2": null,
    "collier": null,
    "bijou_1": "obj_insigne_unite",
    "bijou_2": null,
    "paquetage": "obj_sac_voyage",
    "ceinture_bourse_1": "obj_bourse",
    "ceinture_bourse_2": null
  },
  "inventoryItems": [
    {
      "type": "weapon",
      "id": "obj_arme_endommagee",
      "qty": 1,
      "source": "auto",
      "origin": {
        "kind": "background",
        "id": "veteran-de-guerre"
      },
      "instanceId": "item-mlrvxsmd-jdcyhn-1",
      "equippedSlot": null,
      "storedIn": "paquetage",
      "isPrimaryWeapon": false,
      "isSecondaryHand": false
    },
    {
      "type": "object",
      "id": "obj_insigne_unite",
      "qty": 1,
      "source": "auto",
      "origin": {
        "kind": "background",
        "id": "veteran-de-guerre"
      },
      "instanceId": "item-mlrvxsmd-jdcyhn-2",
      "equippedSlot": "bijou_1",
      "storedIn": null,
      "isPrimaryWeapon": false,
      "isSecondaryHand": false
    },
    {
      "type": "object",
      "id": "obj_vetements_voyage",
      "qty": 1,
      "source": "auto",
      "origin": {
        "kind": "background",
        "id": "veteran-de-guerre"
      },
      "instanceId": "item-mlrvxsmd-jdcyhn-3",
      "equippedSlot": "corps",
      "storedIn": null,
      "isPrimaryWeapon": false,
      "isSecondaryHand": false
    },
    {
      "type": "object",
      "id": "obj_bourse",
      "qty": 1,
      "source": "auto",
      "origin": {
        "kind": "background",
        "id": "veteran-de-guerre"
      },
      "instanceId": "item-mlrvxsmd-jdcyhn-4",
      "equippedSlot": "ceinture_bourse_1",
      "storedIn": null,
      "isPrimaryWeapon": false,
      "isSecondaryHand": false,
      "contenu": [
        "item-mlrvxsmd-jdcyhn-5"
      ]
    },
    {
      "type": "object",
      "id": "obj_piece_or",
      "qty": 10,
      "source": "auto",
      "origin": {
        "kind": "background",
        "id": "veteran-de-guerre"
      },
      "instanceId": "item-mlrvxsmd-jdcyhn-5",
      "equippedSlot": null,
      "storedIn": "ceinture_bourse_1",
      "isPrimaryWeapon": false,
      "isSecondaryHand": false
    },
    {
      "type": "object",
      "id": "obj_sac_voyage",
      "qty": 1,
      "source": "auto",
      "origin": {
        "kind": "background",
        "id": "veteran-de-guerre"
      },
      "instanceId": "item-mlrvxsmd-jdcyhn-6",
      "equippedSlot": "paquetage",
      "storedIn": null,
      "isPrimaryWeapon": false,
      "isSecondaryHand": false,
      "contenu": [
        "item-mlrvxsmd-jdcyhn-1"
      ]
    },
    {
      "type": "weapon",
      "id": "obj_petit_couteau",
      "qty": 1,
      "source": "manual",
      "origin": {
        "kind": "manual"
      },
      "instanceId": "item-mlrvxsmd-jdcyhn-9",
      "equippedSlot": "ceinture_gauche",
      "storedIn": null,
      "isPrimaryWeapon": true,
      "isSecondaryHand": false
    },
    {
      "type": "weapon",
      "id": "obj_petit_couteau",
      "qty": 1,
      "source": "manual",
      "origin": {
        "kind": "manual"
      },
      "instanceId": "item-mlrvxsmd-jdcyhn-10",
      "equippedSlot": "ceinture_droite",
      "storedIn": null,
      "isPrimaryWeapon": false,
      "isSecondaryHand": true
    }
  ],
  "descriptionPersonnage": {
    "bio": "Test hero for the mini-game.",
    "physique": "Athletic human in light armor, posture calme et vigilante.",
    "personnalite": "Calm and determined.",
    "objectifs": "Explore the test dungeon.",
    "relations": "",
    "defauts": "Too reckless."
  },
  "profileDetails": {
    "visage": "Traits marques, regard concentre",
    "cheveux": "Cheveux bruns courts",
    "yeux": "Yeux verts",
    "silhouette": "Silhouette athletique"
  },
  "choiceSelections": {
    "statsBase": {
      "FOR": 13,
      "DEX": 15,
      "CON": 14,
      "INT": 12,
      "SAG": 10,
      "CHA": 8
    },
    "race": {
      "adaptableSkill": "nature"
    },
    "pendingLocks": {},
    "background": {
      "tools": [
        "outils_jeux"
      ],
      "languages": [
        "commun"
      ],
      "statBonusApplied": true
    },
    "classFeatures": {
      "class:fighter:fighting-style:style": {
        "selected": [
          "two-weapon-fighting"
        ]
      },
      "class:fighter:weapon-mastery:masteries": {
        "selected": [
          "coup-double",
          "enchainement",
          "ouverture"
        ]
      }
    },
    "asi": {
      "fighter:4": {
        "type": "asi",
        "stats": {
          "DEX": 2
        }
      }
    },
    "spellcasting": {
      "subclass:eldritch-knight": {
        "knownSpells": [
          {
            "id": "rayon-de-feu",
            "instanceId": "spell-mlrvxsmd-jdcyhn-7",
            "origin": {
              "kind": "manual",
              "sourceKey": "subclass:eldritch-knight"
            }
          },
          {
            "id": "minor-ward",
            "instanceId": "spell-mlrvxsmd-jdcyhn-8",
            "origin": {
              "kind": "manual",
              "sourceKey": "subclass:eldritch-knight"
            }
          }
        ]
      }
    },
    "sheetValidated": true
  },
  "creationLocks": {
    "species": true,
    "backgrounds": true,
    "profile": true,
    "stats": true,
    "magic": true,
    "equip": true,
    "skills": true,
    "masteries": true
  },
  "classLocks": {
    "primary": true,
    "secondary": false
  },
  "progressionHistory": [
    {
      "source": "race:human",
      "level": 1,
      "type": "choice",
      "payload": {
        "kind": "skill",
        "id": "nature"
      }
    },
    {
      "source": "background:veteran-de-guerre",
      "level": 1,
      "type": "choice",
      "payload": {
        "kind": "tool",
        "id": "outils_jeux"
      }
    },
    {
      "source": "background:veteran-de-guerre",
      "level": 1,
      "type": "choice",
      "payload": {
        "kind": "language",
        "id": "commun"
      }
    },
    {
      "source": "class:fighter",
      "level": 1,
      "type": "choice",
      "payload": {
        "kind": "class-feature-option",
        "featureId": "fighting-style",
        "choiceKey": "style",
        "optionId": "two-weapon-fighting"
      }
    },
    {
      "source": "class:fighter",
      "level": 1,
      "type": "choice",
      "payload": {
        "kind": "class-feature-option",
        "featureId": "weapon-mastery",
        "choiceKey": "masteries",
        "optionId": "coup-double"
      }
    },
    {
      "source": "class:fighter",
      "level": 1,
      "type": "choice",
      "payload": {
        "kind": "class-feature-option",
        "featureId": "weapon-mastery",
        "choiceKey": "masteries",
        "optionId": "enchainement"
      }
    },
    {
      "source": "class:fighter",
      "level": 1,
      "type": "choice",
      "payload": {
        "kind": "class-feature-option",
        "featureId": "weapon-mastery",
        "choiceKey": "masteries",
        "optionId": "ouverture"
      }
    },
    {
      "source": "class:fighter",
      "level": 4,
      "type": "asi",
      "payload": {
        "stats": {
          "DEX": 2
        }
      }
    },
    {
      "source": "class:fighter",
      "level": 1,
      "type": "grant",
      "payload": {
        "source": "class:fighter",
        "level": 1,
        "kind": "feature",
        "ids": [
          "fighting-style"
        ]
      }
    },
    {
      "source": "class:fighter",
      "level": 1,
      "type": "grant",
      "payload": {
        "source": "class:fighter",
        "level": 1,
        "kind": "feature",
        "ids": [
          "second-wind-feature"
        ]
      }
    },
    {
      "source": "class:fighter",
      "level": 1,
      "type": "grant",
      "payload": {
        "source": "class:fighter",
        "level": 1,
        "kind": "action",
        "ids": [
          "second-wind"
        ]
      }
    },
    {
      "source": "class:fighter",
      "level": 1,
      "type": "grant",
      "payload": {
        "source": "class:fighter",
        "level": 1,
        "kind": "feature",
        "ids": [
          "weapon-mastery"
        ]
      }
    },
    {
      "source": "class:fighter",
      "level": 2,
      "type": "grant",
      "payload": {
        "source": "class:fighter",
        "level": 2,
        "kind": "feature",
        "ids": [
          "action-surge"
        ]
      }
    },
    {
      "source": "class:fighter",
      "level": 2,
      "type": "grant",
      "payload": {
        "source": "class:fighter",
        "level": 2,
        "kind": "feature",
        "ids": [
          "tactical-mind"
        ]
      }
    },
    {
      "source": "class:fighter",
      "level": 4,
      "type": "grant",
      "payload": {
        "source": "class:fighter",
        "level": 4,
        "kind": "bonus",
        "ids": [
          "asi-or-feat"
        ]
      }
    },
    {
      "source": "subclass:eldritch-knight",
      "level": 3,
      "type": "grant",
      "payload": {
        "source": "subclass:eldritch-knight",
        "level": 3,
        "kind": "feature",
        "ids": [
          "eldritch-knight-spellcasting"
        ]
      }
    },
    {
      "source": "spellcasting",
      "level": 4,
      "type": "spell-slots",
      "payload": {
        "totalCasterLevel": 1,
        "slots": {
          "1": {
            "max": 2,
            "remaining": 2,
            "sources": [
              "caster-total"
            ]
          }
        },
        "slotJustifications": [
          {
            "source": "subclass:eldritch-knight",
            "classLevel": 4,
            "casterProgression": "third",
            "slotsByLevel": [
              2,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0
            ]
          }
        ]
      }
    }
  ],
  "spellcastingState": {
    "totalCasterLevel": 1,
    "slots": {
      "1": {
        "max": 2,
        "remaining": 2,
        "sources": [
          "caster-total"
        ]
      }
    },
    "sources": {
      "subclass:eldritch-knight": {
        "ability": "INT",
        "preparation": "known",
        "storage": "memory",
        "casterProgression": "third",
        "classLevel": 4,
        "focusInstanceId": null,
        "preparedSpellIds": [],
        "knownSpellIds": [
          "rayon-de-feu",
          "minor-ward"
        ],
        "grantedSpellIds": []
      }
    },
    "spellGrants": {
      "subclass:eldritch-knight": [
        {
          "entryId": "subclass:eldritch-knight:rayon-de-feu",
          "spellId": "rayon-de-feu",
          "sourceType": "manual",
          "sourceId": "eldritch-knight",
          "sourceKey": "subclass:eldritch-knight",
          "grantedAtLevel": 4,
          "usage": {
            "type": "at-will",
            "consumesSlot": false
          },
          "prepared": false,
          "alwaysPrepared": false,
          "tags": [
            "known"
          ]
        },
        {
          "entryId": "subclass:eldritch-knight:minor-ward",
          "spellId": "minor-ward",
          "sourceType": "manual",
          "sourceId": "eldritch-knight",
          "sourceKey": "subclass:eldritch-knight",
          "grantedAtLevel": 4,
          "usage": {
            "type": "slot",
            "consumesSlot": true
          },
          "prepared": false,
          "alwaysPrepared": false,
          "tags": [
            "known"
          ]
        }
      ]
    },
    "slotJustifications": [
      {
        "source": "subclass:eldritch-knight",
        "classLevel": 4,
        "casterProgression": "third",
        "slotsByLevel": [
          2,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      }
    ]
  },
  "derived": {
    "grants": {
      "traits": [
        "adaptable"
      ],
      "features": [
        "freres-et-soeurs-d-armes",
        "fighting-style-two-weapon-fighting",
        "fighting-style",
        "second-wind-feature",
        "weapon-mastery",
        "action-surge",
        "tactical-mind",
        "eldritch-knight-spellcasting"
      ],
      "feats": [],
      "skills": [
        "athletisme",
        "intimidation",
        "nature"
      ],
      "weaponMasteries": [
        "coup-double",
        "enchainement",
        "ouverture"
      ],
      "tools": [
        "outils_vehicules",
        "outils_jeux"
      ],
      "languages": [
        "commun"
      ],
      "spells": [],
      "actions": [
        "second-wind"
      ],
      "reactions": [],
      "resources": [],
      "passifs": []
    }
  }
}