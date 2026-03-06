# Modele d'entites runtime v1

## But

Ce document definit une methode generique pour gerer les entites narratives du module runtime.

Le but n'est pas seulement de gerer des PNJ.
La meme methode doit pouvoir servir pour:

- acteurs sociaux (`pj`, `pnj`, groupe, faction visible)
- lieux (`batiment`, `quartier`, `piece`, `zone locale`)
- objets (`document`, `arme`, `cle`, `cargaison`, `artefact`)
- traces ou elements de scene (`indice`, `rumeur`, `preuve`, `obstacle`)
- futurs types non encore identifies

L'objectif est de conserver une narration coherente, tout en respectant les regles de memoire locale et de duree de vie en jeu.

## Principe central

Une entite importante pour le runtime ne doit pas exister seulement comme texte narratif.

Elle doit pouvoir exister comme objet structure:

1. identifiable
2. consultable
3. lie a la memoire
4. lie aux evenements
5. archivable ou supprimable selon son importance

La narration peut n'en montrer qu'une petite partie.
Le runtime, lui, doit pouvoir conserver un profil plus complet si la scene ou l'evenement l'exige.

## Quand creer une entite runtime

Le runtime ou l'IA amont doivent envisager la creation d'une entite quand au moins une de ces conditions est vraie:

1. Le joueur interagit directement avec elle.
2. Elle devient cible d'une action runtime.
3. Elle porte une information utile pour un tour futur.
4. Elle participe a un evenement.
5. Elle peut revenir dans la scene ou dans la campagne.
6. Son absence empeche le runtime de raisonner proprement sur la suite.

Exemple:

- "je parle au garde de l'entree" peut justifier un profil PNJ.
- "je regarde la grande porte verrouillee" peut justifier un profil de lieu local ou d'objet-scene.
- "je prends le registre brule" peut justifier un profil d'objet.

## Regle de base

Tout ce qui est seulement decoratif ou jetable ne doit pas devenir une entite persistante par defaut.

Le systeme doit privilegier:

1. creation minimale
2. promotion si l'entite devient importante
3. archivage ou expiration si elle cesse d'etre utile

## Structure generique

Chaque entite runtime doit suivre une structure commune.

```json
{
  "entity_id": "npc_guard_gate_01",
  "entity_type": "actor",
  "subtype": "pnj",
  "display_name": "Garde de l'entree",
  "status": "active",
  "scope": "situational",
  "created_at_turn": "turn-001",
  "updated_at_turn": "turn-003",
  "last_seen_turn": "turn-003",
  "location_id": "caserne_centrale",
  "source": {
    "created_by": "runtime|ia_amont|seed_data",
    "reason": "social_interaction"
  },
  "visibility": {
    "player_known": true,
    "truth_known": true
  },
  "links": {
    "event_ids": [],
    "related_entity_ids": [],
    "faction_ids": []
  },
  "payload": {},
  "lifecycle_policy": {
    "ttl_turns": 6,
    "promote_if_linked_to_event": true,
    "archive_when_inactive": true
  }
}
```

## Champs communs obligatoires

- `entity_id`: identifiant stable runtime
- `entity_type`: grande famille (`actor`, `location`, `object`, `scene_element`, etc.)
- `subtype`: precision metier (`pnj`, `pj`, `batiment`, `preuve`, etc.)
- `display_name`: libelle de travail
- `status`: `active`, `dormant`, `archived`, `expired`
- `scope`: `ephemeral`, `situational`, `persistent`
- `created_at_turn`
- `updated_at_turn`
- `last_seen_turn`
- `location_id` si pertinent
- `links`
- `payload`
- `lifecycle_policy`

## Profils specialises par famille

### 1. Acteurs

Un acteur social doit pouvoir porter un profil complet si necessaire.

Champs recommandes dans `payload`:

- `species`
- `physical_traits`
- `clothing`
- `visible_equipment`
- `core_stats`
- `social_traits`
- `role`
- `faction_id`
- `authority_level`
- `temperament`
- `known_name`
- `interaction_state`

Exemple:

```json
{
  "entity_type": "actor",
  "subtype": "pnj",
  "payload": {
    "species": "humain",
    "physical_traits": ["grand", "balafre joue gauche"],
    "clothing": ["uniforme de garnison sombre", "gants de cuir"],
    "visible_equipment": ["hallebarde", "trousseau de cles"],
    "core_stats": {
      "FOR": 13,
      "DEX": 11,
      "CON": 12,
      "INT": 10,
      "SAG": 12,
      "CHA": 10
    },
    "social_traits": ["discipline", "mefiance", "respecte la procedure"],
    "role": "garde d'entree",
    "faction_id": "garnison_lysenthe",
    "authority_level": "bas",
    "temperament": "vigilant"
  }
}
```

### 2. Lieux

Un lieu runtime ne doit pas etre limite a son texte wiki.
Il peut porter un etat local de scene.

Champs recommandes dans `payload`:

- `location_kind`
- `access_level`
- `security_level`
- `connected_locations`
- `active_points_of_interest`
- `active_constraints`
- `ambient_markers`
- `visible_actors`

### 3. Objets

Un objet peut etre important meme si le joueur ne le garde pas longtemps.

Champs recommandes dans `payload`:

- `object_kind`
- `ownership`
- `visibility`
- `state`
- `evidence_value`
- `linked_event_ids`
- `carried_by`
- `stored_at`

### 4. Elements de scene

Certains elements ne sont ni de vrais PNJ ni de vrais objets persistants, mais ils doivent exister un temps.

Exemples:

- une file d'attente
- une barricade improvisee
- une rumeur locale
- une tache de sang recente

Champs recommandes:

- `scene_role`
- `decay_rule`
- `evidence_strength`
- `interaction_modes`

## Scope et duree de vie

La duree de vie est une regle metier centrale.

### Scope `ephemeral`

Pour:

- passant
- figurant
- garde lambda sans consequence
- decor vivant de courte duree

Regles:

- creation rapide
- profil minimal
- expiration rapide
- suppression ou archivage apres quelques tours sans interaction

### Scope `situational`

Pour:

- cible d'une scene en cours
- PNJ avec dialogue ouvert
- objet de quete locale
- lieu temporairement important
- element lie a un evenement actif

Regles:

- conserve tant que la scene ou l'evenement reste pertinent
- promotion possible vers `persistent`

### Scope `persistent`

Pour:

- PNJ recurrent
- personnage cle
- lieu majeur modifie durablement
- objet central
- preuve ou consequence durable

Regles:

- conserve dans la memoire longue
- mis a jour au fil de la campagne
- jamais supprime silencieusement

## Promotion

Une entite peut monter en importance.

Exemples:

- un garde lambda devient temoin cle
- une rumeur devient piste d'enquete
- un objet banal devient preuve

Regles de promotion:

1. `ephemeral -> situational`
   - si interaction directe repetee
   - si lien avec un evenement
   - si utilisation sur plusieurs tours

2. `situational -> persistent`
   - si relation durable avec le PJ
   - si role majeur dans un evenement
   - si consequence durable sur le monde

La promotion doit etre tracee dans l'historique de cycle de vie.

## Archivage et expiration

Il faut distinguer `archived` et `expired`.

### `expired`

L'entite n'a plus d'utilite runtime et peut etre retiree de la memoire active.

Exemples:

- passant oublie
- garde anonyme jamais revu
- element de decor temporaire

### `archived`

L'entite n'est plus active mais doit rester consultable.

Exemples:

- ancien temoin
- objet detruit mais historiquement important
- lieu dont l'etat a change

## Regles de save locale

Le save local ne doit pas devenir une poubelle de profils.

Regles recommandees:

1. Sauver en actif seulement les entites `active` ou `dormant`.
2. Deplacer les entites `archived` dans une section archivee distincte.
3. Purger les `expired` selon une fenetre definie.
4. Recalculer a chaque sauvegarde:
   - `last_seen_turn`
   - `updated_at_turn`
   - eligibilite a l'expiration

Politique simple v1:

- `ephemeral`: expire apres 3 a 6 tours sans interaction
- `situational`: expire seulement si non lie a un event actif et non revu depuis 10 a 20 tours
- `persistent`: jamais expire automatiquement

## Lien avec les evenements

Une entite runtime doit pouvoir etre liee a un ou plusieurs evenements.

Liens typiques:

- `witness_of`
- `involved_in`
- `owner_of`
- `located_at`
- `suspect_of`
- `damaged_by`
- `guards`

Pourquoi c'est important:

1. justifier la persistance d'une entite
2. permettre des rappels coherents
3. faire evoluer une scene dans le temps
4. eviter de recreer plusieurs fois la meme chose

## Role de l'IA et role du runtime

### IA amont

L'IA amont peut:

- detecter qu'une nouvelle entite est necessaire
- proposer un profil structure minimal
- proposer une promotion
- proposer une cible d'interaction

L'IA amont ne doit pas:

- inventer silencieusement un historique durable sans support
- imposer une persistance si le runtime doit l'expirer

### Runtime

Le runtime doit:

- valider la structure
- attribuer un `entity_id`
- stocker selon la politique de cycle de vie
- lier l'entite a la memoire et aux evenements
- archiver ou expirer selon les regles

Le runtime ne doit pas:

- laisser une entite floue vivre indefiniment
- confondre une description narrative avec un objet persistant

## Boucle type

### Cas social

1. L'IA detecte `talk`.
2. Elle propose une cible.
3. Si aucun profil stable n'existe, elle peut demander `createNpcProfile`.
4. Le runtime cree un profil `ephemeral` ou `situational`.
5. Si le PNJ devient important, promotion.
6. Si le PNJ disparait sans impact, expiration.

### Cas objet

1. Le joueur remarque ou prend un objet.
2. Le runtime cree un objet-scene ou objet-persistant selon importance.
3. Si l'objet devient preuve ou cle d'evenement, promotion.

### Cas lieu

1. Une zone locale devient importante.
2. Le runtime cree ou enrichit un etat local du lieu.
3. Si l'etat du lieu change durablement, archivage d'etat precedent ou mise a jour persistante.

## Definition of Done v1

La methode est consideree utilisable si:

1. une entite peut etre creee avec un schema commun
2. elle peut etre classee `ephemeral|situational|persistent`
3. elle peut etre promue
4. elle peut etre archivee ou expiree
5. elle peut etre liee a un evenement
6. elle peut exister en memoire locale sans polluer durablement la sauvegarde
7. la narration peut n'exposer qu'une partie du profil

## Consequence directe pour la suite du module

Avant de complexifier encore la narration sociale, il faudra:

1. definir un registre runtime d'entites
2. definir les politiques de duree de vie
3. definir le schema `actor`
4. definir le schema `location_state`
5. definir le schema `object_state`
6. brancher les liens avec les events

Sans cette couche, les interactions sociales et les scenes recurrentes resteront fragiles et jetables.
