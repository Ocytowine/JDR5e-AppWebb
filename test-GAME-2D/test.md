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
    "Common",
    "nain"
  ],
  "alignement": "Neutral Good",
  "raceId": "human",
  "backgroundId": "veteran-de-guerre",
  "classe": {
    "1": {
      "classeId": "cleric",
      "subclasseId": "peace-domain",
      "niveau": 4
    }
  },
  "xp": 0,
  "dv": 10,
  "maitriseBonus": 2,
  "pvActuels": 27,
  "pvTmp": 0,
  "nivFatigueActuel": 0,
  "nivFatigueMax": 3,
  "actionIds": [
    "melee-strike",
    "dash",
    "second-wind",
    "throw-dagger",
    "torch-toggle"
  ],
  "reactionIds": [
    "opportunity-attack",
    "guard-strike",
    "killer-instinct"
  ],
  "combatStats": {
    "level": 4,
    "mods": {
      "modFOR": 3,
      "modDEX": 2,
      "modCON": 2,
      "modINT": 0,
      "modSAG": 1,
      "modCHA": 0,
      "str": 3,
      "dex": 2,
      "con": 1,
      "int": 1,
      "wis": 1,
      "cha": -1
    },
    "maxHp": 27,
    "armorClass": 16,
    "attackBonus": 5,
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
      "FOR": 16
    },
    "dexterite": {
      "DEX": 14
    },
    "constitution": {
      "CON": 13
    },
    "intelligence": {
      "INT": 12
    },
    "sagesse": {
      "SAG": 12
    },
    "charisme": {
      "CHA": 8
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
    "investigation"
  ],
  "expertises": [],
  "initiative": "modDEX",
  "besoin": [],
  "percPassive": 11,
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
  "savingThrows": [
    "force",
    "constitution"
  ],
  "inspiration": false,
  "traits": [
    "Veteran soldier",
    "Brave"
  ],
  "features": [],
  "compteur": {},
  "ressources": {},
  "etats": [],
  "historique": [],
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
    "ceinture_gauche": "obj_arme_endommagee",
    "ceinture_droite": null,
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
  "armesDefaut": {
    "main_droite": "epee-longue",
    "main_gauche": "dague",
    "mains": null
  },
  "equipmentAuto": [
    "obj_arme_endommagee",
    "obj_insigne_unite",
    "obj_vetements_voyage",
    "obj_bourse",
    "object:obj_piece_or:10",
    "obj_sac_voyage",
    "obj_symbole_sacre"
  ],
  "equipmentManual": [],
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
      "instanceId": "item-mlf8tk1m-xfpkm1-1",
      "equippedSlot": "ceinture_gauche",
      "storedIn": null,
      "isPrimaryWeapon": true
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
      "instanceId": "item-mlf8tk1m-xfpkm1-2",
      "equippedSlot": "bijou_1",
      "storedIn": null,
      "isPrimaryWeapon": false
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
      "instanceId": "item-mlf8tk1m-xfpkm1-3",
      "equippedSlot": "corps",
      "storedIn": null,
      "isPrimaryWeapon": false
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
      "instanceId": "item-mlf8tk1m-xfpkm1-4",
      "equippedSlot": "ceinture_bourse_1",
      "storedIn": null,
      "isPrimaryWeapon": false
    },
    {
      "type": "object",
      "id": "obj_piece_or",
      "qty": 10,
      "source": "auto",
      "equippedSlot": null,
      "storedIn": "ceinture_bourse_1",
      "isPrimaryWeapon": false
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
      "instanceId": "item-mlf8tk1m-xfpkm1-5",
      "equippedSlot": "paquetage",
      "storedIn": null,
      "isPrimaryWeapon": false
    },
    {
      "type": "object",
      "id": "obj_symbole_sacre",
      "qty": 1,
      "source": "auto",
      "origin": {
        "kind": "class",
        "id": "cleric"
      },
      "instanceId": "item-mlf8tk1m-xfpkm1-6",
      "equippedSlot": null,
      "storedIn": null,
      "isPrimaryWeapon": false
    }
  ],
  "Inventaire": {
    "id": "",
    "idUnique": "",
    "quantite": 0,
    "mod": null,
    "conteneur": null
  },
  "capaMax": 120,
  "capaAvantMalus": 60,
  "capaActuel": 0,
  "StatEncombrement": "Not encumbered",
  "calculPvMax": {
    "classe1": {
      "niveauGlobal_1": "10 + modCON",
      "par_niveau_apres_1": "1d10 + modCON"
    },
    "classe2": {
      "par_niveau_apres_1": ""
    }
  },
  "CalculCA": {
    "base": "10 + modDEX",
    "bonusArmure": "+ armor proficiency + shield"
  },
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
  "uiClasse": {
    "ui_template1": "fighter_base",
    "ui_template2": null
  },
  "SpellcastingSpec": {
    "ability": null,
    "spellSaveDc": null,
    "spellAttackMod": null,
    "slots": {},
    "focusId": null,
    "description": null,
    "spellIds": []
  },
  "choiceSelections": {
    "statsBase": {
      "FOR": 15,
      "DEX": 14,
      "CON": 13,
      "INT": 12,
      "SAG": 10,
      "CHA": 8
    },
    "race": {
      "adaptableSkill": "investigation"
    },
    "pendingLocks": {},
    "background": {
      "tools": [
        "outils_jeux"
      ],
      "languages": [
        "nain"
      ],
      "statBonusApplied": true
    },
    "asi": {
      "cleric:4": {
        "type": "asi",
        "stats": {
          "SAG": 2
        }
      }
    },
    "spellcasting": {
      "class:cleric": {
        "grantedSpells": [
          {
            "id": "heroism",
            "instanceId": "spell-mlf8tk1m-xfpkm1-7",
            "origin": {
              "kind": "class",
              "id": "cleric",
              "sourceKey": "class:cleric"
            }
          },
          {
            "id": "sanctuary",
            "instanceId": "spell-mlf8tk1m-xfpkm1-8",
            "origin": {
              "kind": "class",
              "id": "cleric",
              "sourceKey": "class:cleric"
            }
          },
          {
            "id": "aid",
            "instanceId": "spell-mlf8tk1m-xfpkm1-9",
            "origin": {
              "kind": "class",
              "id": "cleric",
              "sourceKey": "class:cleric"
            }
          },
          {
            "id": "warding-bond",
            "instanceId": "spell-mlf8tk1m-xfpkm1-10",
            "origin": {
              "kind": "class",
              "id": "cleric",
              "sourceKey": "class:cleric"
            }
          }
        ],
        "preparedSpells": [
          {
            "id": "minor-ward",
            "instanceId": "spell-mlf8tk1m-xfpkm1-11",
            "origin": {
              "kind": "manual",
              "sourceKey": "class:cleric"
            }
          },
          {
            "id": "sending",
            "instanceId": "spell-mlf8tk1m-xfpkm1-12",
            "origin": {
              "kind": "manual",
              "sourceKey": "class:cleric"
            }
          },
          {
            "id": "beacon-of-hope",
            "instanceId": "spell-mlf8tk1m-xfpkm1-13",
            "origin": {
              "kind": "manual",
              "sourceKey": "class:cleric"
            }
          },
          {
            "id": "aura-of-purity",
            "instanceId": "spell-mlf8tk1m-xfpkm1-14",
            "origin": {
              "kind": "manual",
              "sourceKey": "class:cleric"
            }
          }
        ],
        "focusItemId": "obj_symbole_sacre"
      }
    },
    "sheetValidated": true
  },
  "creationLocks": {
    "backgrounds": true,
    "species": true,
    "equip": true,
    "magic": true,
    "skills": true,
    "masteries": true,
    "stats": true,
    "profile": true
  },
  "niveauGlobal": 4,
  "classLocks": {
    "secondary": false,
    "primary": true
  },
  "classLock": true
}