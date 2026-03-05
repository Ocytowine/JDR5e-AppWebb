# Specification du module narration v1

## But

Le module narration sert a piloter un MJ assiste par IA.
Son role n'est pas de "tout raconter", mais de transformer une intention joueur en:

- interpretation exploitable
- decisions mecaniques verifiables
- reponse narrative coherente avec l'etat du monde

L'objectif principal est d'eviter une narration flottante ou contradictoire en ancrant la reponse IA dans un runtime et dans des donnees de jeu structurees.

## Responsabilites du module

Le module couvre cinq axes:

- Contexte: comprendre la situation locale, temporelle et scenaristique.
- Intention: identifier ce que le joueur veut reellement faire.
- Arbitrage: determiner si l'action est libre, contrainte, impossible, ou soumise a test.
- Continuite: mettre a jour le monde sans casser la coherence.
- Memoire: conserver ce qui doit survivre dans le temps de jeu.

## Principe general

Le module suit une boucle en plusieurs etapes:

1. Le joueur exprime une intention.
2. Le systeme rassemble le contexte utile.
3. L'IA classe l'intention et propose une ou plusieurs actions runtime.
4. Le runtime execute les actions valides.
5. Le monde est mis a jour.
6. L'IA produit la reponse narrative a partir du resultat reel des actions.

Le point critique est le suivant: l'IA propose, mais le runtime valide et applique.
La narration finale doit s'appuyer sur des effets de jeu reels, pas sur une simple improvisation textuelle.

## Architecture logique

Le module peut etre pense en trois couches.

### 1. Interpretation

Cette couche recoit:

- le texte du joueur
- le contexte local
- les informations scenario utiles
- les contraintes de sortie attendues

Elle produit:

- un type d'intention
- des cibles probables
- un niveau de certitude
- un besoin eventuel de clarification

### 2. Arbitrage mecanique

Cette couche decide ce que l'action implique dans le systeme:

- action immediate
- deplacement local
- observation
- dialogue
- test de competence
- action interdite ou risquee
- declenchement d'evenement
- refus pour impossibilite contextuelle

Elle convertit l'intention en commandes runtime strictes.

### 3. Restitution narrative

Cette couche genere la reponse visible par le joueur a partir:

- du resultat d'execution
- des changements d'etat
- du contexte mis a jour
- des contraintes de ton et de mise en scene

## Contrat d'entree

Le module ne doit pas recevoir un contexte uniquement plat ou purement technique.
Il doit recevoir un contexte hybride:

- une base structuree pour les verifications et l'execution
- une memoire narrative textuelle pour conserver l'atmosphere, les images et la continuite de scene

Le point important est le suivant: `weather = clear` ne remplace jamais une phrase comme "une brise venue de l'ocean fait onduler les voiles".
La structure decrit des faits.
Le texte conserve la texture du recit.

Le module devrait donc recevoir un objet de ce type:

```json
{
  "player_input": "je veux entrer dans les archives",
  "narrative_context": {
    "recent_scene_log": [
      "Une brise venue de l'ocean fait onduler les voiles des bateaux a quai.",
      "Le calme de la mer rend la scene presque figee, comme un tableau."
    ],
    "current_scene_summary": "Le personnage se trouve sur le port, dans une ambiance calme et lumineuse, a proximite des archives.",
    "tone_markers": [
      "calme",
      "contemplatif",
      "maritime"
    ],
    "continuity_hooks": [
      "brise marine",
      "voiles visibles",
      "mer calme"
    ]
  },
  "world_state": {
    "location_id": "archives_forecourt",
    "location_label": "Parvis des archives",
    "time_of_day": "afternoon",
    "weather": "clear",
    "nearby_entities": [
      "archives_main_door",
      "archives_guard"
    ],
    "active_quests": [],
    "world_flags": [
      "archives_open_daytime"
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
          "physical_overview": "Garde en uniforme, posture stricte, main proche de la lance."
        },
        "visibility_layers": {
          "player_visible": {
            "known_facts": [
              "Le garde surveille l'entree."
            ]
          },
          "mj_visible": {
            "known_facts": [
              "Le garde a reconnu le PJ comme etranger au quartier."
            ]
          },
          "system_truth": {
            "flags": [
              "entry_denial_if_suspicious"
            ]
          }
        },
        "knowledge_scope": [
          "controls_entry"
        ],
        "relationship_to_scene": [
          "witness_potential",
          "security"
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
            "known_facts": [
              "La victime est l'archiviste principal."
            ]
          },
          "mj_visible": {
            "known_facts": [
              "La victime enquêtait deja sur une disparition de document."
            ]
          },
          "system_truth": {
            "flags": [
              "death_confirmed",
              "investigation_anchor"
            ]
          }
        },
        "relationship_to_scene": [
          "crime_victim",
          "quest_anchor"
        ],
        "known_facts": [
          "Derniere personne liee au document disparu."
        ]
      },
      {
        "actor_id": "witness_02",
        "role": "witness",
        "display_name": "Debardeur du port",
        "presence": "off_site",
        "location_relation": "not_present",
        "status": "alive",
        "visibility_layers": {
          "player_visible": {
            "known_facts": [
              "Un debardeur aurait vu quelque chose."
            ]
          },
          "mj_visible": {
            "known_facts": [
              "Le temoin est nerveux et cache une partie de ce qu'il sait."
            ]
          },
          "system_truth": {
            "flags": [
              "witness_has_partial_truth"
            ]
          }
        },
        "relationship_to_scene": [
          "saw_departure",
          "investigation_lead"
        ],
        "known_facts": [
          "A vu une silhouette quitter la zone avant l'alerte."
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

### Role des blocs d'entree

- `player_input`: l'intention immediate exprimee par le joueur.
- `narrative_context.recent_scene_log`: les derniers segments narratifs quasi bruts, conserves pour maintenir les enchainements, les motifs sensoriels et la voix du MJ.
- `narrative_context.current_scene_summary`: un resume compact de l'etat narratif de la scene pour eviter de relire tout l'historique.
- `narrative_context.tone_markers`: les marqueurs d'ambiance que la narration suivante doit respecter.
- `narrative_context.continuity_hooks`: les elements evocateurs a reprendre si la scene continue.
- `world_state`: les faits utilisables par le runtime et les validations mecaniques.
- `actors.player`: la projection minimaliste du PJ, utile a la narration et a l'arbitrage.
- `actors.scene_entities`: les acteurs presents localement dans la scene, ou immediatement accessibles.
- `actors.linked_entities`: les acteurs non presents mais directement lies a l'evenement, a l'enquete, a la quete ou a la causalite immediate.
- `visibility_layers`: pour chaque acteur pertinent, la separation entre ce que le joueur peut percevoir, ce que le MJ peut exploiter, et ce que le systeme tient pour vrai.

Ce modele assume explicitement qu'une scene peut s'appuyer sur plusieurs tours de texte narratif.
Le contexte peut etre plus lourd, mais cette lourdeur est justifiee si l'objectif est une continuite forte.

Le bloc `actors` ne doit donc pas etre limite au PJ.
Il doit contenir tous les acteurs utiles a la verite de scene:

- ceux qui sont presents et visibles
- ceux qui influencent directement la scene sans etre presents
- ceux qui doivent exister comme points d'ancrage narratifs pour la suite

Chaque acteur important peut aussi porter trois niveaux de lecture:

- `player_visible`: ce qui peut nourrir la narration visible cote joueur
- `mj_visible`: ce que le MJ peut utiliser pour guider la scene, l'improvisation et les sous-entendus
- `system_truth`: les faits, flags et causalites qui doivent rester stables meme s'ils ne sont pas reveles

Dans une scene de crime, cela inclut typiquement:

- le PJ
- les gardes sur place
- les temoins immediats
- la victime, meme absente ou morte
- tout PNJ directement rattache a la cause ou a la consequence immediate

Le champ `player.visible_state.physical_overview` et ses details permettent a l'IA de conserver une coherence descriptive d'une scene a l'autre, notamment dans les interactions sociales et les reactions de PNJ.

## Regle de constitution du contrat d'entree

Le contrat d'entree ne doit pas etre un espace de speculation scenario.
Il ne doit contenir que ce qui existe deja au temps T.

Sa constitution repose sur deux sources principales:

- l'heritage du tour precedent
- la projection courante du PJ

Formule cible:

`contrat_entree(T) = projection_PJ(T) + heritage_sortie(T-1)`

Cela signifie concretement:

- le PJ est relu a chaque tour depuis sa fiche, sous forme d'extrait minimal utile
- le reste du contrat provient uniquement de ce qui a deja ete etabli, revele, persiste ou cree explicitement auparavant

Un element ne doit pas apparaitre dans le contrat d'entree juste parce qu'il serait plausible, interessant, ou narrativement utile.
Il doit avoir une origine traçable.

Origines valides d'un element de contrat:

- un texte narratif deja emis
- une mise a jour de verite systeme deja appliquee
- une consequence persistante d'une action runtime
- un evenement explicitement genere lors d'un tour precedent
- un fait directement issu de la fiche PJ

Origines invalides:

- "ce serait une bonne idee pour la scene"
- "le lieu pourrait cacher quelque chose"
- "ce PNJ serait pratique maintenant"
- "le mystere serait plus interessant si..."

En pratique, si une scene commence par "Le PJ arrive sur le port de Lysenthe", alors le contrat d'entree peut contenir:

- le port
- l'ambiance visible
- les entites visibles ou deja connues
- les elements du PJ

Mais il ne doit pas contenir automatiquement:

- un vol
- une victime
- une quete cachee
- un temoignage hors champ
- un interest fact non encore cree

Ces elements n'existent pas encore tant qu'un mecanisme explicite ne les a pas fait naitre.

### Heritage de sortie vers entree

Le contrat de sortie precedent doit alimenter l'entree suivante de facon stricte.

Ce qui doit etre herite de `sortie(T-1)` vers `entree(T)`:

- `narrative_output.player_facing_text`, compresse dans `narrative_context.recent_scene_log`
- `narrative_output.mj_notes`, si elles doivent rester actives dans la continuite immediate
- `narrative_output.hidden_truth_updates`, si elles changent reellement la verite persistante
- `actor_updates`, si elles modifient la connaissance, le statut, ou les flags d'un acteur
- les effets des `runtime_actions`, une fois valides et appliques

Ce qui ne doit pas etre herite tel quel:

- les hypotheses
- les variantes non choisies
- les intentions refusees
- les idees de mise en scene non executees

Cette regle force une causalite simple:

- rien n'apparait sans creation
- rien ne persiste sans trace
- rien ne devient "vrai" sans avoir ete produit par une sortie ou un etat deja etabli

## Contrat de sortie

La sortie de la couche IA ne devrait pas etre un texte libre seul.
Elle devrait renvoyer un objet interpretable par le runtime.

```json
{
  "intent_type": "move_local",
  "intent_confidence": 0.94,
  "requires_clarification": false,
  "clarification_question": null,
  "targets": [
    "archives_main_door"
  ],
  "runtime_actions": [
    {
      "action": "moveLocal",
      "params": {
        "destination_id": "archives_main_door",
        "time_cost_min": 1
      }
    },
    {
      "action": "enterLocation",
      "params": {
        "location_id": "archives_interior"
      }
    }
  ],
  "actor_updates": [
    {
      "actor_id": "guard_archives_01",
      "visibility_updates": {
        "player_visible": {
          "add_facts": [
            "Le garde bloque l'acces et demande une raison valable d'entrer."
          ]
        },
        "mj_visible": {
          "add_facts": [
            "Le garde se crispe davantage si le PJ insiste."
          ]
        },
        "system_truth": {
          "set_flags": [
            "guard_suspicion_raised"
          ]
        }
      }
    }
  ],
  "narrative_output": {
    "player_facing_text": "Le garde se decale d'un demi-pas devant la porte et leve la main pour t'arreter.",
    "mj_notes": [
      "Insister sans justification augmente la suspicion.",
      "Le temoin hors scene peut etre mentionne comme prochaine piste."
    ],
    "hidden_truth_updates": [
      "La vigilance des gardes autour des archives augmente."
    ]
  },
  "narrative_constraints": {
    "tone": "neutral_immersive",
    "must_reflect_runtime_result": true
  }
}
```

### Lecture de la sortie

La sortie doit permettre trois usages simultanes:

- raconter ce que le joueur percoit maintenant
- conserver ce que le MJ doit savoir pour la suite immediate
- mettre a jour la verite systeme sans tout reveler

Cela implique une separation explicite:

- `narrative_output.player_facing_text`: le texte visible par le joueur
- `narrative_output.mj_notes`: les notes de pilotage pour la narration et la continuite
- `narrative_output.hidden_truth_updates`: les consequences vraies mais non necessairement revelees
- `actor_updates.visibility_updates`: les modifications de connaissance ou d'etat, acteur par acteur

Ainsi, une meme scene peut:

- montrer une reaction visible
- enrichir la memoire du MJ
- preparer une consequence future

Sans confondre ce qui est dit, ce qui est su, et ce qui est vrai.

## Types d'intentions minimaux

Pour une v1, une liste fermee suffit.

- `move_local`: se deplacer vers un lieu proche ou evident.
- `observe`: regarder, examiner, inspecter.
- `interact`: manipuler un objet ou l'environnement.
- `talk`: parler a un PNJ ou interpeller quelqu'un.
- `ask_info`: demander une information sans action physique.
- `attempt_forbidden`: tenter une action interdite, hostile ou illegale.
- `use_ability`: utiliser une competence, un sort, un outil ou une feature.
- `meta_unclear`: intention trop vague, hors contexte, ou interpretable de plusieurs facons.

Cette liste doit rester simple au debut. Une taxonomie trop fine trop tot complique inutilement le debogage.

## Commandes runtime minimales

Chaque commande doit avoir un nom stable et des parametres explicites.

- `moveLocal(destination_id, time_cost_min)`
- `enterLocation(location_id)`
- `advanceTime(minutes)`
- `requestCheck(skill_id, difficulty, reason)`
- `startDialogue(target_id)`
- `startCombat(target_ids, trigger_reason)`
- `addJournalEntry(entry_type, payload)`
- `queryLore(topic_ids)`
- `createNpcProfile(role_hint, context)`
- `setFlag(flag_id, value)`
- `rejectAction(reason_code)`

Important: une commande runtime ne doit pas etre une phrase. Elle doit etre deterministe, testable et journalisable.

## Regles d'arbitrage

Quelques regles simples peuvent cadrer la v1:

- Si l'intention concerne un lieu proche et accessible, produire un `moveLocal` puis eventuellement `enterLocation`.
- Si l'intention vise une observation, produire soit `queryLore`, soit une simple lecture de contexte, sans inventer d'information absente.
- Si l'action est risquee ou contestee, produire `requestCheck` avant tout resultat narratif affirmatif.
- Si l'action est clairement impossible selon l'etat du monde, produire `rejectAction`.
- Si l'intention est hors contexte ou ambigue, ne pas improviser: demander une precision.
- Si l'action a un cout temporel, le temps doit etre modifie par une commande explicite.

## Gestion du contexte

Le contexte ne doit pas etre reduit a quelques champs descriptifs.
Il faut distinguer plusieurs couches complementaires:

- Contexte narratif brut: texte recent du MJ, descriptions, images, formulations marquantes.
- Contexte local structure: lieu, personnages proches, objets, acces, ambiance factuelle.
- Contexte global: etat du monde, grandes trames, factions, calendrier.
- Contexte social: reputations, relations, dettes, conflits.
- Contexte narratif: quetes, enjeux actifs, dernier evenement significatif.
- Contexte mecanique: stats, ressources, conditions, cooldowns.

Le point cle est que la continuite forte repose sur deux formes de contexte:

- la verite structuree de la scene
- la trace textuelle des scenes precedentes

Le module ne doit pas envoyer tout l'historique brut sans filtre.
Il doit conserver:

- quelques tours narratifs recents presque tels quels
- un resume de scene stable
- des points d'ancrage textuels a reutiliser

Ainsi, la narration suivante peut prolonger une ambiance deja posee, sans perdre la fiabilite mecanique.

## Memoire in-game

La memoire doit etre separee en niveaux.

### Memoire courte

Ce qui vient de se passer et doit influencer les 1 a 5 prochaines reponses:

- derniere action
- dernier resultat
- dernier interlocuteur
- dernier changement d'etat
- derniers fragments narratifs visibles

### Memoire de scene

Ce qui doit rester vrai tant que la scene en cours n'est pas close:

- position des acteurs
- tension sociale
- objet visible ou manipule
- garde en alerte
- ambiance textuelle dominante
- motifs sensoriels deja etablis
- images ou formulations a prolonger

### Memoire persistante

Ce qui doit survivre a long terme:

- reputation
- consequence de quete
- relation aux PNJ
- flags de lore
- historique journalise

Une erreur classique serait de melanger souvenir narratif et verite systeme.
Il faut donc distinguer au minimum:

- une memoire narrative recente, partiellement textuelle
- une memoire de scene, hybride
- une memoire persistante, majoritairement structuree

La memoire persistante doit rester structuree, pas seulement resumee en texte.
En revanche, la memoire de scene peut et doit conserver du texte, si ce texte porte l'atmosphere et la continuite.

## Separation entre verite systeme et perception

Point important: le monde ne "voit" pas toute la fiche du personnage.

Il faut distinguer:

- verite systeme: caracteristiques, competences, features, ressources, etats reels
- perception externe: apparence, comportement, attitude, reputation, signes visibles

Cette separation permet:

- des interactions sociales plus credibles
- des malentendus narratifs utiles
- des reactions PNJ basees sur ce qu'ils savent reellement

## Cas de test initiaux

### Cas 1: entrer dans un lieu accessible

Entree:

- joueur: "je veux entrer dans les archives"
- contexte: le personnage est devant les archives, l'acces est ouvert

Attendu:

- intention `move_local`
- commandes `moveLocal` puis `enterLocation`
- avancee du temps si necessaire
- narration de transition coherente

### Cas 2: observer un lieu

Entree:

- joueur: "j'observe l'entree des archives"

Attendu:

- intention `observe`
- pas de deplacement automatique si non necessaire
- restitution basee sur le contexte present et les donnees disponibles

### Cas 3: tentative interdite

Entree:

- joueur: "je veux voler un document"

Attendu:

- intention `attempt_forbidden`
- `requestCheck` ou `rejectAction` selon le contexte
- consequences sociales ou de securite si l'action est lancee

### Cas 4: intention floue

Entree:

- joueur: "je fais ce qu'il faut"

Attendu:

- `requires_clarification = true`
- aucune action irreversible executee

## Risques a eviter

- Laisser l'IA executer des effets de jeu sans validation runtime.
- Encoder trop de logique en langage naturel au lieu de contrats formels.
- Charger un contexte trop large et perdre la priorite locale.
- Confondre memoire narrative resumee et etat persistant du jeu.
- Produire une belle narration qui contredit la realite systeme.

## Version cible pour un prototype

Pour un premier prototype robuste, il suffit de:

1. Definir un schema d'entree stable.
2. Definir 6 a 8 types d'intentions.
3. Definir 8 a 12 commandes runtime.
4. Forcer une sortie structuree.
5. Tester le pipeline sur quelques scenes simples.

Tant que ces cinq points ne sont pas verrouilles, il vaut mieux eviter d'ajouter trop de subtilites narratives ou de sous-cas rares.

## Conclusion

Le module narration doit etre concu comme un orchestrateur entre intention, regles et mise en scene.
L'IA doit aider a interpreter et a raconter, mais le systeme doit rester maitre:

- de la verite
- des consequences
- du temps
- de la continuite

Cette separation est la cle pour obtenir une narration plus fiable, plus testable et plus immersive.
