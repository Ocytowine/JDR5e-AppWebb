# ActorProfile v1

## But

Ce document specialise le modele generique d'entites runtime pour le cas des acteurs narratifs.

Un `ActorProfile` doit servir pour:

- le PJ cote narration
- les PNJ sociaux
- les gardes, marchands, temoins, officiers, passants
- plus tard, des groupes ou factions visibles si necessaire

Le runtime doit pouvoir s'appuyer sur ce profil pour:

1. ouvrir un dialogue
2. juger si une interaction sociale est plausible
3. memoriser une cible recurrente
4. relier un acteur a un evenement
5. conserver une coherence locale de langue, faction et culture
6. archiver les acteurs mineurs sans polluer la sauvegarde

## Regle centrale

Un acteur narratif ne doit pas etre seulement une phrase dans la narration.

S'il devient cible d'une action, source d'information, ou maillon d'un evenement, il doit pouvoir exister comme profil structure.

Le profil ne doit pas seulement decrire "qui il est".
Il doit aussi expliquer:

- d'ou il vient dans le monde
- a quelle logique locale il obeit
- comment il parle et comprend
- pourquoi il est plausible ici

## Cas d'usage v1

### 1. Contact social local

Exemple:

- "je parle au garde de l'entree"
- "je m'adresse au greffier"
- "je questionne la marchande"

### 2. Source d'information

Exemple:

- un temoin d'incident
- un officier connaissant la procedure
- un archiviste sachant ou trouver un registre

### 3. Acteur lie a un evenement

Exemple:

- suspect
- temoin
- victime
- relais
- complice

### 4. Acteur recurrent

Exemple:

- le meme garde recroise plus tard
- un informateur
- un officier de quartier

## Principe de structure

Un `ActorProfile` v1 complet doit etre pense en 3 couches:

1. `identite jouable`
2. `coherence locale`
3. `etat runtime`

Le runtime doit pouvoir creer:

- un `stub` minimal et prudent
- puis un profil `resolved` plus riche

sans perdre l'ancrage local du lieu, de la faction et de la langue.

## Structure v1 complete

```json
{
  "entity_id": "npc_guard_gate_01",
  "entity_type": "actor",
  "subtype": "pnj",
  "display_name": "Garde de l'entree",
  "memory_state": "active",
  "status": "active",
  "scope": "situational",
  "created_at_turn": "turn-001",
  "updated_at_turn": "turn-003",
  "last_seen_turn": "turn-003",
  "first_seen_turn_index": 1,
  "last_seen_turn_index": 3,
  "location_id": "caserne_centrale",
  "source": {
    "created_by": "runtime",
    "reason": "social_interaction"
  },
  "visibility": {
    "player_known": true,
    "truth_known": true
  },
  "links": {
    "event_ids": [],
    "related_entity_ids": [],
    "faction_ids": ["garnison_de_lysenthe"]
  },
  "payload": {
    "profile_state": "resolved",
    "pending_enrichment": null,
    "identity": {
      "known_name": null,
      "role": "garde",
      "species": "humain",
      "gender_presentation": "masculine",
      "age_band": "adulte"
    },
    "culture": {
      "origin_region": "ylssea",
      "culture_tags": ["urbain", "garnison"],
      "faction_id": "garnison_de_lysenthe",
      "authority_context": "formal"
    },
    "language_profile": {
      "native_languages": ["commun"],
      "known_languages": ["commun"],
      "preferred_language": "commun",
      "literacy": "functional",
      "source": "generation_profile:lysenthe>quartier_des_remparts>caserne_centrale"
    },
    "appearance": {
      "physical_traits": ["epaules larges", "visage ferme"],
      "clothing": ["gambison sombre", "surcot bleu gris"],
      "visible_equipment": ["lance courte", "trousseau de clefs"],
      "notable_details": ["boucle d'etain en forme de herse"]
    },
    "stats": {
      "FOR": 13,
      "DEX": 11,
      "CON": 12,
      "INT": 10,
      "SAG": 12,
      "CHA": 10
    },
    "social": {
      "temperament": "vigilant",
      "social_traits": ["discipline", "mefiance", "respecte la procedure"],
      "authority_level": "low",
      "social_rank": "institutional_respectable",
      "disposition_to_player": "neutral",
      "interaction_state": "available",
      "hospitality_style": "guarded"
    },
    "world": {
      "faction_id": "garnison_de_lysenthe",
      "duty_state": "on_post",
      "location_precision": "entree_principale",
      "access_scope": "restricted_zone"
    },
    "interaction": {
      "last_interaction_summary": "Le garde a refuse l'entree sans autorisation ecrite.",
      "player_language_compatibility": "full",
      "known_to_player_as": "un garde de la caserne",
      "contact_count": 2,
      "familiarity_level": "seen_once",
      "last_interaction_outcome": "polite_refusal",
      "active_topic_ids": ["archives_access"],
      "taboo_topic_ids": ["internal_orders"],
      "unresolved_hooks": ["bring_authorization"]
    },
    "generation_context": {
      "generation_profile_source": [
        "lysenthe",
        "quartier_des_remparts",
        "caserne_centrale"
      ],
      "role_plausibility": "likely",
      "generated_from_presence_profile": true
    }
  },
  "lifecycle_policy": {
    "ttl_turns": 8,
    "promote_if_linked_to_event": true,
    "archive_when_inactive": true
  },
  "lifecycle_history": []
}
```

## Champs obligatoires

### Racine

- `entity_id`
- `entity_type = actor`
- `subtype = pj | pnj`
- `display_name`
- `memory_state = active | relevant | dormant | archived`
- `status`
- `scope`
- `created_at_turn`
- `updated_at_turn`
- `last_seen_turn`
- `first_seen_turn_index`
- `last_seen_turn_index`
- `source`
- `visibility`
- `links`
- `payload`
- `lifecycle_policy`

### Payload minimal

Pour un `ActorProfile` v1, le payload minimal doit contenir:

- `profile_state = stub | pending_enrichment | resolved`
- `identity.role`
- `identity.species`
- `language_profile.known_languages`
- `language_profile.preferred_language`
- `appearance.clothing`
- `appearance.visible_equipment`
- `social.temperament`
- `social.disposition_to_player`
- `social.interaction_state`
- `world.location_precision`

### Payload complet recommande

Un profil `resolved` doit idealement contenir en plus:

- `culture`
- `interaction`
- `generation_context`

## Sous-objets

### `identity`

Contient l'identite fonctionnelle de l'acteur.

Champs:

- `known_name`
- `role`
- `species`
- `gender_presentation`
- `age_band`

Regles:

- `known_name` peut etre vide pour un PNJ anonyme
- `display_name` peut rester descriptif tant que le vrai nom n'est pas connu
- `role` doit decrire la fonction visible ou sociale, pas un meta-role systeme

### `culture`

Contient l'ancrage culturel et institutionnel.

Champs:

- `origin_region`
- `culture_tags`
- `faction_id`
- `authority_context`

Regles:

- sert a maintenir la coherence locale
- ne doit pas devenir une encyclopedie
- doit suffire a savoir si l'acteur vient du lieu, d'une institution locale, ou d'une logique exterieure

### `language_profile`

Contient le profil de langue du PNJ.

Champs:

- `native_languages`
- `known_languages`
- `preferred_language`
- `literacy`
- `source`

Valeurs utiles v1:

- `literacy = none | functional | educated | scholarly`

Regles:

- `preferred_language` est la langue que le PNJ utilise naturellement
- `known_languages` sert au runtime pour calculer la compatibilite d'echange
- ce bloc est indispensable pour `talk`

### `appearance`

Contient ce que le runtime peut mobiliser pour une description physique coherente.

Champs:

- `physical_traits`
- `clothing`
- `visible_equipment`
- `notable_details`

Regles:

- la narration n'est pas obligee d'afficher tout cela
- mais ces champs doivent exister si le profil est cree
- les `notable_details` servent a la reconnaissance en scene

### `stats`

Contient les stats de base utiles au raisonnement systeme.

Champs v1:

- `FOR`
- `DEX`
- `CON`
- `INT`
- `SAG`
- `CHA`

Regles:

- pas besoin de toute la fiche combat
- mais le profil doit avoir un noyau de caracteristiques stable

### `social`

Contient l'etat social exploitable par le runtime.

Champs:

- `temperament`
- `social_traits`
- `authority_level`
- `social_rank`
- `disposition_to_player`
- `interaction_state`
- `hospitality_style`

Valeurs utiles v1:

- `authority_level = unknown | none | low | medium | high | elite`
- `social_rank = unknown | low_common | working_common | respected_craft | institutional_respectable | local_notable | elite`
- `disposition_to_player = friendly | neutral | wary | hostile`
- `interaction_state = available | busy | blocked | fleeing | absent`

Regles:

- ce bloc sert a juger la reaction probable d'un PNJ
- il ne doit pas etre confondu avec la faction ou le grade
- `authority_level` = pouvoir reel ou institutionnel
- `social_rank` = statut social percu, prestige ou poids symbolique local

### `world`

Contient l'ancrage local et institutionnel.

Champs:

- `faction_id`
- `duty_state`
- `location_precision`
- `access_scope`

Valeurs utiles v1:

- `duty_state = unknown | on_post | on_patrol | off_duty | active_service`

Regles:

- `world` decrit le contexte objectif de l'acteur dans le monde
- il ne doit pas contenir de narration libre

### `interaction`

Contient l'etat relationnel immediate utile au runtime.

Champs:

- `last_interaction_summary`
- `player_language_compatibility`
- `known_to_player_as`
- `contact_count`
- `familiarity_level`
- `last_interaction_outcome`
- `active_topic_ids`
- `taboo_topic_ids`
- `unresolved_hooks`

Valeurs utiles v1:

- `player_language_compatibility = full | limited | none | unknown`
- `familiarity_level = unknown | seen_once | known | recurrent`
- `last_interaction_outcome = brief_contact | polite_refusal | partial_help | useful_answer | withheld_sensitive_info | hostile_warning | trust_opened`

Regles:

- ce bloc sert a mieux tenir les tours successifs
- il est autorise a rester tres court
- il ne doit pas contenir de transcript complet
- `last_interaction_summary` doit rester une synthese breve
- les tableaux doivent rester compacts et centres sur la continuite immediate

### `generation_context`

Contient la trace de generation.

Champs:

- `generation_profile_source`
- `role_plausibility`
- `generated_from_presence_profile`

Valeurs utiles v1:

- `role_plausibility = likely | rare | out_of_profile`

Regles:

- ce bloc sert au debug et a la coherence
- il ne doit pas etre expose tel quel au joueur

## Creation

### Quand creer un ActorProfile

Un `ActorProfile` doit etre cree si:

1. l'acteur est cible directe d'une action sociale
2. le runtime doit ouvrir un dialogue
3. l'acteur doit pouvoir revenir sur plusieurs tours
4. l'acteur sert de support a une information ou a un event
5. la coherence locale depend de son existence comme entite stable

### Quand ne pas creer

Ne pas creer un profil complet si:

1. l'acteur est purement decoratif
2. aucune interaction runtime n'en depend
3. il n'est ni cible, ni source, ni obstacle
4. il ne doit pas revenir

Dans ce cas:

- decor de scene simple
- ou `pnj_lambda` non promu

## Stub minimal

Le runtime doit pouvoir creer un `stub` prudent avant enrichissement.

Exemple:

```json
{
  "payload": {
    "profile_state": "stub",
    "identity": {
      "known_name": null,
      "role": "garde",
      "species": "humain",
      "gender_presentation": "unknown"
    },
    "language_profile": {
      "native_languages": ["commun"],
      "known_languages": ["commun"],
      "preferred_language": "commun",
      "literacy": "functional",
      "source": "generation_profile:lysenthe>quartier_des_remparts>caserne_centrale"
    },
    "appearance": {
      "physical_traits": [],
      "clothing": [],
      "visible_equipment": [],
      "notable_details": []
    },
    "social": {
      "temperament": "neutral",
      "social_traits": [],
      "authority_level": "low",
      "social_rank": "working_common",
      "disposition_to_player": "neutral",
      "interaction_state": "available",
      "hospitality_style": "guarded"
    },
    "world": {
      "faction_id": "garnison_de_lysenthe",
      "duty_state": "on_post",
      "location_precision": "caserne_centrale",
      "access_scope": "restricted_zone"
    },
    "generation_context": {
      "generation_profile_source": [
        "lysenthe",
        "quartier_des_remparts",
        "caserne_centrale"
      ],
      "role_plausibility": "likely",
      "generated_from_presence_profile": true
    },
    "interaction": {
      "last_interaction_summary": null,
      "player_language_compatibility": "unknown",
      "known_to_player_as": "un garde",
      "contact_count": 1,
      "familiarity_level": "seen_once",
      "last_interaction_outcome": "brief_contact",
      "active_topic_ids": [],
      "taboo_topic_ids": [],
      "unresolved_hooks": []
    }
  }
}
```

## Resolution et coherence locale

Le runtime ne doit pas raisonner en mode script pur.

Il doit suivre cette logique:

1. l'IA choisit ou suggere un role
2. le runtime verifie la plausibilite de ce role dans le lieu
3. le lieu exact prime
4. sinon le quartier sert de fallback
5. sinon la ville sert de fallback

Le lieu ne doit pas dicter "pres de la caserne = garde obligatoire".

Il doit seulement fournir:

- des roles probables
- des roles rares mais plausibles
- des poids d'espece
- des langues usuelles
- un style d'autorite

Ensuite:

- `likely` = accepte naturellement
- `rare` = accepte avec reserve legere
- `out_of_profile` = clarification ou correction

## Langues et interaction sociale

Pour `talk`, le runtime doit comparer:

- les langues du PJ
- `language_profile` du PNJ

Puis produire un etat de compatibilite:

- `full`
- `limited`
- `none`
- `unknown`

Cette compatibilite ne doit pas seulement exister dans le debug.
Elle doit pouvoir influencer:

- la narration
- la fluidite de l'echange
- les malentendus
- la posture sociale

## Continuite conversationnelle compacte

Le runtime ne doit pas stocker un historique complet de dialogue par defaut.

Pour les tours `talk`, il doit privilegier une memoire conversationnelle compacte via `interaction`.

Cette memoire doit suffire a:

- eviter de rejouer une premiere rencontre
- conserver un ton social coherent
- rouvrir un sujet deja entame
- garder trace d'un refus, d'une aide partielle, ou d'une promesse implicite

Regles pratiques:

- `last_interaction_summary` = 1 phrase courte
- `contact_count` = compteur simple de contacts significatifs
- `active_topic_ids` = max 3
- `taboo_topic_ids` = max 3
- `unresolved_hooks` = max 3

Le but n'est pas de script-er l'IA.
Le but est de lui donner assez de structure pour continuer logiquement sans figer la scene.

## Mise a jour apres un tour `talk`

Apres un tour `talk`, le runtime ou l'IA aval doit idealement produire un patch compact sur `interaction`.

Mise a jour recommandee:

- `last_interaction_summary`
- `player_language_compatibility` si re-evaluee
- `contact_count`
- `familiarity_level`
- `last_interaction_outcome`
- ouverture/fermeture de 1 a 3 `topic_ids`
- ajout eventuel d'un `unresolved_hook`

Exemples de resultat:

- refus poli -> `polite_refusal`
- aide partielle -> `partial_help`
- information utile -> `useful_answer`
- sujet sensible esquive -> `withheld_sensitive_info`
- escalation sociale -> `hostile_warning`

Cette mise a jour doit rester plus proche d'un etat narratif compact que d'un log conversationnel.

## Promotion, archivage, expiration

Le cycle de vie memoire ne doit pas etre confondu avec l'etat d'enrichissement du profil.

Etats d'enrichissement:

- `stub`
- `pending_enrichment`
- `resolved`

Etats memoire:

- `active`
- `relevant`
- `dormant`
- `archived`

Exemple correct:

- un garde peut etre `resolved`
- mais `dormant` si on ne le recroise plus

## Liens avec les evenements

Un `ActorProfile` doit pouvoir etre relie a:

- `event_ids`
- autres acteurs
- factions
- lieux

Cas typiques:

- garde ayant bloque un acces
- archiviste detenant une information critique
- courtier vu sur plusieurs cargaisons suspectes

## Regles de generation

### Ce que le runtime peut generer directement

- role
- espece probable
- faction locale
- langue probable
- niveau d'autorite
- duty_state
- premiers marqueurs de tenue ou d'equipement

### Ce que l'IA peut enrichir ensuite

- details physiques
- formulation plus fine du temperament
- details distinctifs
- maniere de parler
- relation plus precise au PJ
- resumee tres courte de la derniere interaction
- sujets actifs ou tabous, si la scene les justifie

### Ce qui ne doit pas etre invente librement

- une langue non soutenue par le lieu ou la faction
- une espece hors cadre local sans justification
- un grade sans logique de faction
- un role hors `presence_profile` sans reserve runtime

## DoD

`ActorProfile v1` est considere pret si:

1. un PNJ `talk` peut exister comme entite stable
2. le profil distingue `profile_state` et `memory_state`
3. le profil contient un `language_profile`
4. le profil contient un `culture` ou equivalent d'ancrage local
5. le profil contient une `generation_context`
6. le runtime peut calculer une compatibilite linguistique
7. le profil peut etre cree minimal puis enrichi
8. le profil peut etre relie a une faction locale
9. le profil reste exploitable sans envoyer toute la fiche au LLM
