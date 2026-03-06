# ObjectState v1

## But

Ce document specialise le modele generique d'entites runtime pour le cas des objets narratifs.

Un `ObjectState` doit permettre au runtime de gerer:

- objets portés ou visibles
- documents, registres, lettres, cles
- preuves, indices materiels, traces
- objets de scene utilisables
- objets recurrents ou centraux dans un evenement

Le but est d'eviter qu'un objet important n'existe seulement comme une phrase de narration.

## Regle centrale

Un objet narratif doit devenir une entite runtime si:

1. le joueur interagit avec lui
2. il change d'etat
3. il peut revenir plus tard
4. il a une valeur d'information ou de preuve
5. il est lie a un evenement

Sinon, il peut rester un simple detail de decor.

## Cas d'usage v1

### 1. Objet de contact simple

Exemple:

- cle sur une table
- badge de garnison
- registre visible

### 2. Objet d'enquete

Exemple:

- lettre scellee
- document falsifie
- registre brule
- sceau brise

### 3. Objet socialement visible

Exemple:

- arme portee
- uniforme
- insigne
- trousseau de cles

### 4. Objet de consequence

Exemple:

- porte fracturée
- caisse ouverte
- document vole
- preuve detruite

## Structure v1

```json
{
  "entity_id": "obj_register_burned_01",
  "entity_type": "object",
  "subtype": "document",
  "display_name": "Registre partiellement brule",
  "status": "active",
  "scope": "situational",
  "created_at_turn": "turn-004",
  "updated_at_turn": "turn-005",
  "last_seen_turn": "turn-005",
  "location_id": "archives_de_lysenthe",
  "source": {
    "created_by": "runtime",
    "reason": "object_interaction"
  },
  "visibility": {
    "player_known": true,
    "truth_known": true
  },
  "links": {
    "event_ids": ["evt-archives-01"],
    "related_entity_ids": ["npc_archivist_02"],
    "faction_ids": []
  },
  "payload": {
    "object_kind": "document",
    "ownership": {
      "owner_actor_id": null,
      "owner_faction_id": "archives_lysenthe"
    },
    "state": {
      "condition": "damaged",
      "sealed": false,
      "locked": false,
      "hidden": false
    },
    "physical": {
      "visible_description": ["papier epais noirci", "coins carbonises"],
      "size": "small",
      "portable": true
    },
    "narrative": {
      "evidence_value": "high",
      "importance_level": "high",
      "known_contents_summary": "fragments d'entrees commerciales",
      "sensitive": true
    },
    "world": {
      "carried_by": null,
      "stored_at": "salle_des_registres",
      "visibility_state": "visible"
    }
  },
  "lifecycle_policy": {
    "ttl_turns": 20,
    "promote_if_linked_to_event": true,
    "archive_when_inactive": true
  }
}
```

## Champs obligatoires

### Racine

- `entity_id`
- `entity_type = object`
- `subtype`
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

Le `payload` minimal doit contenir:

- `object_kind`
- `state`
- `physical`
- `world`

Si l'objet a une importance narrative:

- ajouter `narrative`

## Sous-objets du payload

### `object_kind`

Nature metier de l'objet.

Valeurs utiles v1:

- `document`
- `key`
- `weapon`
- `badge`
- `container`
- `evidence`
- `trade_good`
- `scene_prop`

### `ownership`

Definit qui controle l'objet.

Champs:

- `owner_actor_id`
- `owner_faction_id`

But:

- savoir si prendre l'objet est anodin ou illegal
- lier un objet a une institution ou a un PNJ

### `state`

Etat courant de l'objet.

Champs utiles v1:

- `condition`: `intact | worn | damaged | broken | destroyed`
- `sealed`: bool
- `locked`: bool
- `hidden`: bool

Extensions futures possibles:

- `opened`
- `forged`
- `bloodied`
- `tampered`

### `physical`

Aspects concrets utiles au runtime et a la narration.

Champs:

- `visible_description`
- `size`
- `portable`

### `narrative`

Valeur d'usage pour l'intrigue.

Champs:

- `evidence_value`: `none | low | medium | high`
- `importance_level`: `low | medium | high | critical`
- `known_contents_summary`
- `sensitive`

### `world`

Position et circulation de l'objet.

Champs:

- `carried_by`
- `stored_at`
- `visibility_state`

Valeurs utiles pour `visibility_state`:

- `visible`
- `concealed`
- `restricted`
- `lost`

## Quand creer un ObjectState

Le runtime doit creer ou enrichir un `ObjectState` si:

1. le joueur le cible
2. l'objet change de proprietaire ou d'etat
3. il devient preuve, obstacle ou objectif
4. sa disparition ou sa presence a des consequences

## Quand ne pas creer

Ne pas creer un profil complet si:

1. l'objet est seulement cite comme decor sans impact
2. il ne sera ni manipule ni memorise
3. son etat n'a aucune consequence

## Scope et duree de vie

### `ephemeral`

Pour:

- objet de decor local
- accessoire visible sans importance

### `situational`

Pour:

- objet de scene exploitable
- preuve temporaire
- document consulte sur quelques tours
- objet tenu par un PNJ socialement pertinent

### `persistent`

Pour:

- cle durable
- objet de quete
- preuve majeure
- artefact
- objet lie durablement a un event ou au PJ

## Promotion

Promotion recommandee si:

1. l'objet devient preuve
2. il est vole, perdu, detruit ou falsifie
3. il devient centre d'une scene ou d'un event
4. il passe dans l'inventaire durable d'un acteur

Exemple:

- une lettre banale devient preuve de corruption

## Archivage et expiration

### Expiration

L'objet peut expirer de la memoire active si:

- il n'a plus d'importance
- il n'est plus present dans la scene
- aucun event ou acteur important ne le reference

### Archivage

L'objet doit etre archive si:

- il a compte pour une intrigue
- il a change d'etat de facon memorielle
- il a ete detruit, vole ou transmis avec consequence durable

## Lien avec les events

Un objet peut etre:

- `stolen_object`
- `evidence`
- `trigger_item`
- `sealed_record`
- `destroyed_proof`

Le runtime doit pouvoir relier un objet a un ou plusieurs events avec un role explicite.

## Lien avec les acteurs

Un objet peut etre:

- porte par un acteur
- montre par un acteur
- remis a un acteur
- pris a un acteur
- associe au statut ou a l'autorite d'un acteur

Exemples:

- un insigne leggitime un officier
- un trousseau de cles ouvre un acces
- une arme visible change la lecture sociale d'une scene

## Lien avec les lieux

Un objet peut etre:

- pose dans un lieu
- cache dans un lieu
- detruit dans un lieu
- utilise pour modifier l'etat d'un lieu

Exemples:

- cle de porte
- document stocke dans les archives
- caisse ouverte dans les halles

## Commandes runtime concernees a terme

Le schema `ObjectState v1` justifie l'existence future de commandes comme:

- `createObjectState`
- `updateObjectState`
- `transferObject`
- `destroyObject`
- `hideObject`
- `linkObjectToEvent`
- `promoteObjectState`
- `expireObjectState`

## Definition of Done v1

Le schema `ObjectState v1` sera considere pret a implementer si:

1. un objet peut etre cree comme entite runtime
2. il peut avoir un etat, un proprietaire et une position
3. il peut etre relie a un acteur, un lieu et un event
4. il peut etre ephemere, situationnel ou persistant
5. il peut etre promu, archive ou expire
6. la narration peut n'afficher qu'une partie de son profil

## Limites volontaires de v1

Le schema v1 ne couvre pas encore:

- inventaire complet de simulation
- poids, valeur marchande, usure detaillee
- crafting
- empilement ou conteneurs complexes

Ces points pourront venir plus tard.
