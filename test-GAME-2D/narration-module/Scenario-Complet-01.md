# Scenario complet 01

## But du document

Ce document montre un exemple concret de fonctionnement du module narration sur un court enchainement.

Il contient:

- un mini scenario sur 3 echanges MJ / joueur
- un exemple de traitement complet d'un echange en contrat d'entree / sortie

L'objectif est de montrer comment la narration visible, la verite systeme et la continuite de scene coexistent.

## Contexte general

Le PJ arrive sur le port de Lysenthe, en fin d'apres-midi.
Les archives maritimes se trouvent un peu en retrait des quais.
Un vol de document a eu lieu dans la journee, et l'archiviste principal a ete retrouve mort.

La scene doit transmettre:

- une ambiance maritime calme mais tendue
- une enquete qui commence
- une separation entre ce que le joueur voit et ce que le systeme sait deja

## Echange 1

### MJ vers joueur

Une brise venue de l'ocean fait onduler les voiles des bateaux a quai, mais le calme de la mer donne au port une immobilite presque irreelle. Plus haut, sur le parvis des archives maritimes, deux gardes filtrent les entrees. L'un d'eux tient sa lance droite contre l'epaule, l'autre observe les passants d'un regard trop nerveux pour une simple garde de routine.

### Joueur vers MJ

Je monte vers les archives et j'observe les gardes avant de parler.

### Effet attendu

- Le PJ se rapproche de la zone d'entree.
- La scene reste calme en surface.
- Le module privilegie une lecture `move_local` + `observe`.
- Aucun reveal majeur n'est fait immediatement.

## Echange 2

### MJ vers joueur

En gravissant les quelques marches de pierre, tu quittes le brouhaha lointain du quai pour une zone plus contenue, presque etouffee. De pres, tu distingues la fatigue sur le visage du garde a gauche et la main crispee de l'autre sur le bois verni de sa lance. Ils te remarquent, echangent un regard bref, puis attendent que tu prennes la parole.

### Joueur vers MJ

Je leur demande ce qui se passe. Pourquoi l'entree est sous surveillance ?

### Effet attendu

- Le module classe l'action comme `talk` / `ask_info`.
- Les gardes livrent une verite partielle.
- Le joueur comprend qu'un evenement grave a eu lieu.
- La tension monte sans divulguer toutes les causes.

## Echange 3

### MJ vers joueur

Le garde le plus age te detaille un instant avant de repondre d'une voix basse. "Les archives sont fermees jusqu'a nouvel ordre. Un document a disparu ce matin... et l'archiviste principal a ete retrouve mort peu apres." L'autre garde balaie le quai du regard avant d'ajouter, plus sec: "Si vous avez vu quelque chose, dites-le. Sinon, ne restez pas dans le passage."

Une odeur d'encre, de corde humide et de sel remonte jusqu'au parvis avec la brise. Derriere la porte close, le silence du batiment parait encore plus lourd que celui de la mer.

### Joueur vers MJ

Je reste calme. Je dis que je peux peut-etre aider, et je demande ou et quand le corps a ete trouve.

### Effet attendu

- Le module classe l'action comme `talk` avec ouverture potentielle d'enquete.
- La scene bascule d'une simple approche vers une accroche de quete.
- La victime devient un point central de la trame, meme absente.
- Les gardes peuvent devenir relais d'information ou obstacle selon la suite.

## Lecture narrative du mini scenario

Sur ces 3 echanges:

- le contexte textuel reste continu: brise, mer calme, tension sur le parvis, silence des archives
- les gardes existent comme acteurs presents
- la victime existe comme acteur lie a la scene, meme absente et morte
- le joueur ne recoit qu'une partie de la verite
- le MJ et le systeme gardent des informations supplementaires pour la suite

Le scenario montre la logique voulue:

- continuité forte cote narration
- faits stables cote systeme
- revelations progressives cote joueur

## Traitement detaille d'un echange

Cette section detaille l'echange 2.

### Echange choisi

#### Etat narratif precedent

- Le PJ est arrive sur le parvis des archives.
- Les gardes ont remarque sa presence.
- Une tension anormale est perceptible.

#### Input joueur

"Je leur demande ce qui se passe. Pourquoi l'entree est sous surveillance ?"

## Contrat d'entree exemple

```json
{
  "player_input": "Je leur demande ce qui se passe. Pourquoi l'entree est sous surveillance ?",
  "narrative_context": {
    "recent_scene_log": [
      "Une brise venue de l'ocean fait onduler les voiles des bateaux a quai, mais le calme de la mer donne au port une immobilite presque irreelle.",
      "Sur le parvis des archives maritimes, deux gardes filtrent les entrees.",
      "En s'approchant, le PJ remarque la fatigue de l'un et la nervosite de l'autre."
    ],
    "current_scene_summary": "Le PJ se tient devant les archives maritimes, face a deux gardes en alerte dans une ambiance calme mais tendue.",
    "tone_markers": [
      "calme",
      "tendu",
      "maritime",
      "retenu"
    ],
    "continuity_hooks": [
      "brise marine",
      "mer calme",
      "gardes nerveux",
      "porte des archives close"
    ]
  },
  "world_state": {
    "location_id": "archives_forecourt",
    "location_label": "Parvis des archives maritimes",
    "time_of_day": "late_afternoon",
    "weather": "clear",
    "nearby_entities": [
      "guard_archives_01",
      "guard_archives_02",
      "archives_main_door"
    ],
    "active_quests": [],
    "world_flags": [
      "archives_closed",
      "crime_scene_active",
      "guards_on_alert"
    ]
  },
  "actors": {
    "player": {
      "character_id": "pj-1",
      "identity": {
        "full_name": "Aryn Test Hero",
        "first_name": "Aryn",
        "nickname": "the Blue"
      },
      "build_summary": {
        "race_id": "human",
        "background_id": "veteran-de-guerre",
        "classes": [
          {
            "slot": 1,
            "class_id": "fighter",
            "subclass_id": "champion",
            "level": 1
          }
        ],
        "global_level": 1
      },
      "visible_state": {
        "physical_overview": "Athletic human in light armor, posture calme et vigilante.",
        "physical_details": {
          "face": "Traits marques, regard concentre",
          "hair": "Cheveux bruns courts",
          "eyes": "Yeux verts",
          "silhouette": "Silhouette athletique"
        },
        "visible_equipment": [
          "light_armor",
          "longsword",
          "dagger"
        ],
        "reputation_tags": [
          "unknown_here"
        ]
      },
      "mechanical_state": {
        "hp": 12,
        "max_hp": 12,
        "armor_class": 16,
        "combat_level": 1,
        "resources": {},
        "statuses": []
      },
      "capabilities": {
        "skill_ids": [
          "perception"
        ],
        "expertise_ids": [],
        "proficiencies": {
          "weapons": [
            "simple",
            "martiale"
          ],
          "armors": [],
          "tools": []
        }
      }
    },
    "scene_entities": [
      {
        "actor_id": "guard_archives_01",
        "role": "local_npc",
        "display_name": "Garde des archives",
        "presence": "on_site",
        "location_relation": "nearby",
        "visible_state": {
          "physical_overview": "Garde age, uniforme bien tenu, voix posee."
        },
        "visibility_layers": {
          "player_visible": {
            "known_facts": [
              "Le garde controle l'entree."
            ]
          },
          "mj_visible": {
            "known_facts": [
              "Le garde est plus enclin a parler que son collegue."
            ]
          },
          "system_truth": {
            "flags": [
              "primary_talk_contact"
            ]
          }
        },
        "relationship_to_scene": [
          "security",
          "first_witness"
        ]
      },
      {
        "actor_id": "guard_archives_02",
        "role": "local_npc",
        "display_name": "Second garde",
        "presence": "on_site",
        "location_relation": "nearby",
        "visible_state": {
          "physical_overview": "Garde plus jeune, crispation visible, regard mobile."
        },
        "visibility_layers": {
          "player_visible": {
            "known_facts": [
              "Le second garde semble nerveux."
            ]
          },
          "mj_visible": {
            "known_facts": [
              "Le second garde craint qu'on lui reproche un manquement."
            ]
          },
          "system_truth": {
            "flags": [
              "stress_high"
            ]
          }
        },
        "relationship_to_scene": [
          "security",
          "possible_pressure_point"
        ]
      }
    ],
    "linked_entities": [
      {
        "actor_id": "victim_01",
        "role": "victim",
        "display_name": "Archiviste principal",
        "presence": "off_site_or_unavailable",
        "location_relation": "not_present",
        "status": "dead",
        "visibility_layers": {
          "player_visible": {
            "known_facts": []
          },
          "mj_visible": {
            "known_facts": [
              "La mort est deja connue des gardes."
            ]
          },
          "system_truth": {
            "flags": [
              "death_confirmed",
              "crime_anchor"
            ]
          }
        },
        "relationship_to_scene": [
          "crime_victim",
          "quest_anchor"
        ],
        "known_facts": [
          "Retrouve mort apres la disparition d'un document."
        ]
      },
      {
        "actor_id": "witness_02",
        "role": "witness",
        "display_name": "Debardeur du quai est",
        "presence": "off_site",
        "location_relation": "not_present",
        "status": "alive",
        "visibility_layers": {
          "player_visible": {
            "known_facts": []
          },
          "mj_visible": {
            "known_facts": [
              "Un temoin existe mais n'a pas encore ete mentionne au PJ."
            ]
          },
          "system_truth": {
            "flags": [
              "lead_available"
            ]
          }
        },
        "relationship_to_scene": [
          "investigation_lead"
        ],
        "known_facts": [
          "A vu une silhouette quitter la zone peu avant l'alerte."
        ]
      }
    ]
  },
  "response_contract": {
    "require_structured_output": true,
    "must_preserve_continuity": true
  }
}
```

## Sortie attendue exemple

```json
{
  "intent_type": "ask_info",
  "intent_confidence": 0.96,
  "requires_clarification": false,
  "clarification_question": null,
  "targets": [
    "guard_archives_01",
    "guard_archives_02"
  ],
  "runtime_actions": [
    {
      "action": "startDialogue",
      "params": {
        "target_id": "guard_archives_01"
      }
    },
    {
      "action": "setFlag",
      "params": {
        "flag_id": "player_involved_in_archives_incident",
        "value": true
      }
    },
    {
      "action": "addJournalEntry",
      "params": {
        "entry_type": "lead",
        "payload": {
          "topic": "archives_incident",
          "summary": "Le PJ interroge les gardes au sujet de la fermeture des archives."
        }
      }
    }
  ],
  "actor_updates": [
    {
      "actor_id": "guard_archives_01",
      "visibility_updates": {
        "player_visible": {
          "add_facts": [
            "Le garde accepte de repondre avec prudence."
          ]
        },
        "mj_visible": {
          "add_facts": [
            "Le garde choisit de reveler une version partielle des faits."
          ]
        },
        "system_truth": {
          "set_flags": [
            "guard_01_dialogue_open"
          ]
        }
      }
    },
    {
      "actor_id": "victim_01",
      "visibility_updates": {
        "player_visible": {
          "add_facts": [
            "Un archiviste a ete retrouve mort."
          ]
        },
        "mj_visible": {
          "add_facts": [
            "La victime devient officiellement un sujet connu du PJ."
          ]
        },
        "system_truth": {
          "set_flags": [
            "victim_identity_revealed_partially"
          ]
        }
      }
    }
  ],
  "narrative_output": {
    "player_facing_text": "Le garde le plus age te regarde un instant, puis repond d'une voix basse. \"Les archives sont fermees jusqu'a nouvel ordre. Un incident grave a eu lieu ce matin.\" Son collegue, plus nerveux, serre davantage sa lance sans te quitter des yeux.",
    "mj_notes": [
      "Ne pas reveler tout de suite le detail du document vole si le PJ n'insiste pas.",
      "La mort de l'archiviste peut etre devoilee maintenant ou au tour suivant selon le ton voulu.",
      "Le second garde doit rester un indicateur de tension."
    ],
    "hidden_truth_updates": [
      "Le vol du document et la mort de l'archiviste sont lies.",
      "Un temoin hors scene peut devenir la prochaine piste."
    ]
  },
  "narrative_constraints": {
    "tone": "neutral_immersive",
    "must_reflect_runtime_result": true
  }
}
```

## Pourquoi cette sortie est bonne

Cette sortie respecte les trois couches:

- cote joueur: une reponse immersive, sobre, partielle
- cote MJ: des notes pour doser la revelation
- cote systeme: des flags, une entree de journal, une ouverture de dialogue

Elle conserve aussi la continuite:

- le ton reste calme et tendu
- les gardes restent differencies
- la victime entre dans la narration sans apparaitre physiquement

Enfin, elle prepare la suite:

- le PJ est maintenant engage dans l'incident
- la scene peut mener a une enquete
- un futur echange peut reveler le corps, le document vole ou le temoin absent

## Resume

Ce scenario complet montre le principe du module:

- le MJ raconte une scene avec continuité
- le joueur agit librement
- le contrat d'entree assemble texte, etat du monde et acteurs pertinents
- la sortie separe ce qui est raconte, ce qui est retenu par le MJ, et ce que le systeme enregistre comme verite

Ce type de document peut servir de base pour ecrire des cas de test narratifs.
