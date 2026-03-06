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
5. expirer les acteurs mineurs sans polluer la sauvegarde

## Regle centrale

Un acteur narratif ne doit pas etre seulement une phrase dans la narration.

S'il devient cible d'une action, source d'information, ou maillon d'un evenement, il doit pouvoir exister comme profil structure.

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

## Structure v1

```json
{
  "entity_id": "npc_guard_gate_01",
  "entity_type": "actor",
  "subtype": "pnj",
  "display_name": "Garde de l'entree",
  "status": "active",
  "scope": "situational",
  "created_at_turn": "turn-001",
  "updated_at_turn": "turn-001",
  "last_seen_turn": "turn-001",
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
    "faction_ids": ["garnison_lysenthe"]
  },
  "payload": {
    "identity": {
      "known_name": null,
      "role": "garde d'entree",
      "species": "humain",
      "gender_presentation": "masculine"
    },
    "appearance": {
      "physical_traits": ["grand", "balafre joue gauche"],
      "clothing": ["uniforme sombre", "manteau de pluie replie"],
      "visible_equipment": ["hallebarde", "clefs de service"],
      "notable_details": ["badge de garnison use"]
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
      "disposition_to_player": "neutral",
      "interaction_state": "available"
    },
    "world": {
      "faction_id": "garnison_lysenthe",
      "duty_state": "on_post",
      "location_precision": "entree_principale"
    }
  },
  "lifecycle_policy": {
    "ttl_turns": 8,
    "promote_if_linked_to_event": true,
    "archive_when_inactive": true
  }
}
```

## Champs obligatoires

### Racine

- `entity_id`
- `entity_type = actor`
- `subtype = pj | pnj`
- `display_name`
- `status`
- `scope`
- `created_at_turn`
- `updated_at_turn`
- `last_seen_turn`
- `source`
- `visibility`
- `links`
- `payload`
- `lifecycle_policy`

### Payload minimal

Pour un `ActorProfile` v1, le payload minimal doit contenir:

- `identity.role`
- `identity.species`
- `appearance.physical_traits`
- `appearance.clothing`
- `appearance.visible_equipment`
- `stats`
- `social.temperament`
- `social.disposition_to_player`
- `social.interaction_state`

## Sous-objets

### `identity`

Contient l'identite fonctionnelle de l'acteur.

Champs:

- `known_name`: nom connu par le joueur ou `null`
- `role`: role visible ou fonction
- `species`
- `gender_presentation` si utile

Regle:

- `known_name` peut etre vide pour un PNJ anonyme
- `display_name` peut rester descriptif tant que le vrai nom n'est pas connu

### `appearance`

Contient ce que le runtime peut mobiliser pour une description physique coherente.

Champs:

- `physical_traits`
- `clothing`
- `visible_equipment`
- `notable_details`

Regle:

- la narration n'est pas obligee d'afficher tout cela
- mais ces champs doivent exister si le profil est cree

### `stats`

Contient les stats de base utiles au raisonnement systeme.

Champs v1:

- `FOR`
- `DEX`
- `CON`
- `INT`
- `SAG`
- `CHA`

Regle:

- pas besoin de toute la fiche combat
- mais le profil doit avoir un noyau de caracteristiques stable

### `social`

Contient l'etat social exploitable par le runtime.

Champs:

- `temperament`
- `social_traits`
- `authority_level`
- `disposition_to_player`
- `interaction_state`

Valeurs utiles v1:

- `disposition_to_player`: `friendly | neutral | wary | hostile`
- `interaction_state`: `available | busy | blocked | fleeing | absent`

### `world`

Contient l'ancrage local et institutionnel.

Champs:

- `faction_id`
- `duty_state`
- `location_precision`
- plus tard `rank`, `chain_of_command`, `jurisdiction`

## Creation

### Quand creer un ActorProfile

Un `ActorProfile` doit etre cree si:

1. l'acteur est cible directe d'une action sociale
2. le runtime doit ouvrir un dialogue
3. l'acteur doit pouvoir revenir sur plusieurs tours
4. l'acteur sert de support a une information ou a un event

### Quand ne pas creer

Ne pas creer un profil complet si:

1. l'acteur n'est qu'un decor de foule sans importance
2. aucune interaction ne le cible
3. aucun rappel futur n'est probable

Dans ce cas, une simple narration ou un element de scene suffit.

## Qui cree le profil

### IA amont

Peut:

- detecter le besoin d'un acteur
- proposer un profil minimal structure
- proposer le `scope`
- proposer si l'acteur semble anonyme ou recurrent

### Runtime

Doit:

- valider les champs
- attribuer ou confirmer `entity_id`
- stocker le profil
- regler `scope`, `status`, `ttl`
- lier l'acteur a la memoire et aux events

## Resolution de cible

Le runtime doit distinguer:

- `target_actor_hint`: texte libre de l'IA amont
- `target_actor_id`: identifiant runtime stable

Procedure v1:

1. si `target_actor_id` existe, l'utiliser
2. sinon chercher un acteur compatible deja connu dans la scene
3. sinon creer un nouvel `ActorProfile`
4. stocker l'ID cree pour les tours suivants

Exemple:

- hint: "garde de l'entree"
- aucun acteur existant ne correspond
- le runtime cree `npc_guard_gate_01`
- les prochains tours doivent reutiliser cet ID

## Scope et duree de vie recommandes

### `ephemeral`

Pour:

- passant
- garde anonyme
- temoin mineur

Profil:

- minimal
- expiration rapide

Regle v1:

- `ttl_turns` de 3 a 6

### `situational`

Pour:

- acteur d'une scene en cours
- cible de dialogue
- source d'information exploitee
- garde deja interactionne

Regle v1:

- `ttl_turns` de 8 a 20
- promotion si lie a un event ou revu plusieurs fois

### `persistent`

Pour:

- PNJ recurrent
- acteur important dans un event
- relation durable avec le PJ

Regle v1:

- pas d'expiration automatique

## Promotion

Promotion recommandee si:

1. l'acteur est revu sur plusieurs tours
2. il est lie a un `event_id`
3. il devient source cle, suspect, victime ou allié
4. sa relation avec le PJ change de facon durable

Le runtime doit garder un historique minimal de promotion:

```json
{
  "lifecycle_history": [
    {
      "from": "ephemeral",
      "to": "situational",
      "turn_id": "turn-004",
      "reason": "dialogue_repeated"
    }
  ]
}
```

## Archivage et expiration

### Expiration

L'acteur peut disparaitre de la memoire active si:

- aucun event ne le reference
- il n'a pas ete revu depuis sa fenetre TTL
- il ne porte pas de relation importante

### Archivage

L'acteur doit etre archive et non supprime si:

- il a ete lie a un event important
- il a eu une relation durable avec le PJ
- il a modifie la scene ou l'intrigue

## Lien avec les events

Un `ActorProfile` doit pouvoir etre relie a un event avec un role explicite.

Roles types:

- `witness`
- `suspect`
- `victim`
- `guard`
- `owner`
- `messenger`
- `informant`

Exemple:

```json
{
  "links": {
    "event_ids": ["evt-archives-01"],
    "related_entity_ids": ["obj-ledger-burned-01"],
    "faction_ids": ["garnison_lysenthe"]
  },
  "event_roles": [
    {
      "event_id": "evt-archives-01",
      "role": "witness"
    }
  ]
}
```

## PJ narratif

Le PJ doit aussi exister comme `ActorProfile`, mais sa source n'est pas l'IA.

Source principale:

- sauvegarde personnage active

Le runtime doit produire une projection narrative du PJ a partir de la fiche existante:

- espece
- apparence
- equipement visible
- stats
- competences ou traits saillants

Regle:

- le PJ narratif doit etre derive de la fiche active
- pas regenere arbitrairement par l'IA

## Commandes runtime concernees a terme

Le schema `ActorProfile` justifie l'existence future de commandes comme:

- `createNpcProfile`
- `promoteActorProfile`
- `updateActorProfile`
- `expireActorProfile`
- `linkActorToEvent`
- `setDialogueTarget`

## Definition of Done v1

Le schema `ActorProfile v1` sera considere pret a implementer si:

1. le runtime peut creer un profil complet minimal
2. le profil a un `entity_id` stable
3. il peut etre cible par un dialogue
4. il peut etre relie a un event
5. il respecte `ephemeral|situational|persistent`
6. il peut expirer ou etre archive
7. le PJ peut etre projete dans ce meme modele sans perdre sa source de verite

## Limites volontaires de v1

Le schema v1 ne couvre pas encore:

- inventaire detaille complet
- blessures detaillees
- arbre de relation complexe
- historique complet de dialogues
- planification autonome du PNJ

Ces points pourront venir plus tard.
