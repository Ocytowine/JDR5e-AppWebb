# LocationState v1

## But

Ce document specialise le modele generique d'entites runtime pour le cas des lieux et de leur etat local.

Le wiki reste la source de verite large sur le monde.
`LocationState` sert a gerer ce qui est vrai ici et maintenant dans une scene ou une campagne.

Le runtime doit pouvoir s'appuyer sur ce modele pour:

1. connaitre l'etat local courant d'un lieu
2. savoir ce qui y est visible ou contraignant
3. suivre les changements temporaires ou durables
4. relier un lieu a des evenements
5. archiver ou expirer des etats de scene sans polluer la memoire

## Regle centrale

Un lieu narratif ne doit pas etre limite a une fiche wiki ou a une simple ligne de contexte.

Il faut distinguer:

1. `wiki lore`
   - description stable
   - liens structurels
   - batiments, quartiers, ville, region

2. `location state runtime`
   - etat local courant
   - contraintes actives
   - acteurs visibles
   - tension, securite, acces, perturbations
   - consequences d'evenements

## Cas d'usage v1

### 1. Scene locale vivante

Exemple:

- le port est sous controle accru
- la caserne est en etat d'alerte
- les halles sont en agitation a cause d'un incident

### 2. Etat temporaire

Exemple:

- porte principale fermee
- patrouilles renforcees
- file d'attente inhabituelle
- pluie battante qui degrade la visibilite

### 3. Etat durable

Exemple:

- archives endommagees
- quartier sous couvre-feu
- halles partiellement bloquees

### 4. Support de recherche et de dialogue

Exemple:

- savoir si un garde est plausible ici
- savoir si un marchand peut etre interroge
- savoir si un acces est bloque ou surveille

## Structure v1

```json
{
  "entity_id": "locstate_caserne_centrale_main",
  "entity_type": "location",
  "subtype": "location_state",
  "display_name": "Etat local - Caserne centrale",
  "status": "active",
  "scope": "situational",
  "created_at_turn": "turn-001",
  "updated_at_turn": "turn-005",
  "last_seen_turn": "turn-005",
  "location_id": "caserne_centrale",
  "source": {
    "created_by": "runtime",
    "reason": "scene_activation"
  },
  "visibility": {
    "player_known": true,
    "truth_known": true
  },
  "links": {
    "event_ids": [],
    "related_entity_ids": ["npc_guard_gate_01"],
    "faction_ids": ["garnison_lysenthe"]
  },
  "payload": {
    "location_kind": "batiment",
    "access_level": "restricted",
    "security_level": "high",
    "scene_state": "disciplined",
    "active_constraints": ["filtrage des entrees", "patrouilles frequentes"],
    "active_points_of_interest": ["entree_principale", "bureau de garde"],
    "ambient_markers": ["ordres brefs", "bruit de bottes", "presence militaire"],
    "visible_actors": ["npc_guard_gate_01", "npc_officer_yard_01"],
    "connected_locations": ["quartier_des_remparts", "chateau_tharqual"],
    "temporary_modifiers": [
      {
        "kind": "security_boost",
        "value": 1,
        "reason": "incident_recent"
      }
    ]
  },
  "lifecycle_policy": {
    "ttl_turns": 12,
    "promote_if_linked_to_event": true,
    "archive_when_inactive": true
  }
}
```

## Champs obligatoires

### Racine

- `entity_id`
- `entity_type = location`
- `subtype = location_state`
- `display_name`
- `status`
- `scope`
- `created_at_turn`
- `updated_at_turn`
- `last_seen_turn`
- `location_id`
- `source`
- `visibility`
- `links`
- `payload`
- `lifecycle_policy`

### Payload minimal

Le `payload` minimal doit contenir:

- `location_kind`
- `access_level`
- `security_level`
- `active_constraints`
- `active_points_of_interest`
- `ambient_markers`

## Sous-objets du payload

### `location_kind`

Type local du lieu.

Valeurs utiles v1:

- `batiment`
- `quartier`
- `piece`
- `zone_exterieure`
- `point_de_passage`

### `access_level`

Decrit le niveau d'acces local.

Valeurs utiles v1:

- `public`
- `controlled`
- `restricted`
- `closed`
- `forbidden`

### `security_level`

Etat de surveillance ou de danger institutionnel.

Valeurs utiles v1:

- `low`
- `medium`
- `high`
- `critical`

### `scene_state`

Resume narratif exploitable par le runtime.

Exemples:

- `calm`
- `tense`
- `disciplined`
- `chaotic`
- `locked_down`

### `active_constraints`

Liste des contraintes courantes du lieu.

Exemples:

- "porte verrouillee"
- "garde a l'entree"
- "visibilite reduite"
- "foule dense"

### `active_points_of_interest`

Sous-zones ou elements du lieu utilisables pour la scene.

Exemples:

- `entree_principale`
- `comptoir`
- `cour_interieure`
- `salle_des_registres`

### `ambient_markers`

Marqueurs sensoriels et d'ambiance.

Exemples:

- sons
- odeurs
- flux
- signes visuels

Ces marqueurs servent a aider l'IA aval a rester coherente sans devoir reconsulter tout le wiki.

### `visible_actors`

Liste des `actor_id` visibles ou plausiblement mobilisables dans la scene.

But:

- aider la resolution de cible sociale
- eviter de recreer plusieurs fois les memes PNJ

### `connected_locations`

Lieux directement pertinents pour cette scene.

But:

- aider le `move_local`
- aider la recherche d'informations locales

### `temporary_modifiers`

Modificateurs temporaires lies a la situation.

Exemples:

- securite augmentee
- acces degrade
- visibilite reduite
- tension sociale accrue

## Difference avec le wiki

Le wiki dit ce qu'est le lieu de facon generale.

Le `LocationState` dit:

- dans quel etat le lieu se trouve maintenant
- ce qui y est actuellement visible
- ce qui y est actuellement bloque ou ouvert
- ce qui a change a cause de la campagne

Exemple:

- wiki: "La caserne centrale est un centre militaire tres restreint."
- runtime: "Aujourd'hui, controle renforce suite a un incident sur les quais."

## Creation

### Quand creer un LocationState

Le runtime doit creer ou enrichir un `LocationState` si:

1. le lieu devient scene active
2. un evenement modifie le lieu
3. une interaction depend d'un etat local
4. le lieu doit garder des consequences temporaires ou durables

### Quand ne pas creer

Ne pas creer un `LocationState` complet si:

1. seule une consultation wiki generale suffit
2. aucune action locale n'en depend
3. aucune consequence locale n'est a suivre

## Scope et duree de vie

### `ephemeral`

Pour:

- etat de foule tres temporaire
- meteo locale ponctuelle
- detail de scene qui n'a pas vocation a durer

### `situational`

Pour:

- scene actuellement joue
- lieu sous effet d'un incident
- etat local utile a plusieurs tours proches

### `persistent`

Pour:

- changement durable du lieu
- lieu majeur modifie par l'intrigue
- consequences stables de campagne

## Promotion

Un `LocationState` peut etre promu si:

1. un incident local devient un changement durable
2. le lieu est au coeur d'un evenement important
3. le lieu porte des consequences persistantes pour la campagne

Exemple:

- des archives simplement surveillees deviennent durablement fermees apres un drame

## Archivage et expiration

### Expiration

Le `LocationState` peut expirer si:

- il ne contient qu'un etat local temporaire
- aucun event actif ne le reference
- la scene est terminee

### Archivage

Le `LocationState` doit etre archive si:

- il marque un changement important du lieu
- il constitue un historique utile
- il est relie a un event notable

## Lien avec les events

Un lieu peut etre:

- origine d'un evenement
- theatre d'un evenement
- zone impactee
- zone de consequence

Exemples de roles:

- `event_origin`
- `event_scene`
- `event_aftermath`
- `restricted_zone`

## Lien avec les acteurs

Le `LocationState` doit servir de point d'ancrage pour:

- savoir qui est visible ici
- savoir qui est plausible ici
- savoir si une cible sociale peut etre resolue localement

Regle importante:

- la scene ne doit pas recreer un garde si le `LocationState` expose deja un `visible_actor`

## PJ et perception du lieu

Le lieu peut avoir une verite systeme plus riche que ce que le joueur sait.

Il faut donc distinguer:

- contraintes visibles
- contraintes cachees
- points d'interet visibles
- points d'interet caches

En v1, cette distinction peut rester simple via:

- `visibility.player_known`
- logique de ce qui est envoye ou non a l'IA aval

## Commandes runtime concernees a terme

Le schema `LocationState v1` justifie l'existence future de commandes comme:

- `createLocationState`
- `updateLocationState`
- `promoteLocationState`
- `expireLocationState`
- `linkLocationToEvent`
- `setVisibleActors`
- `setAccessLevel`
- `setSecurityLevel`

## Definition of Done v1

Le schema `LocationState v1` sera considere pret a implementer si:

1. un lieu peut avoir un etat local distinct du wiki
2. cet etat peut porter contraintes, ambiance et points d'interet
3. cet etat peut exposer les acteurs visibles
4. cet etat peut etre lie a un event
5. cet etat peut etre ephemere, situationnel ou persistant
6. cet etat peut expirer ou etre archive
7. le runtime peut s'en servir pour `talk`, `observe`, `move_local`, `ask_info`

## Limites volontaires de v1

Le schema v1 ne couvre pas encore:

- simulation complete des foules
- propagation systemique des etats entre tous les lieux
- topologie detaillee de chaque piece
- gestion fine de ligne de vue ou d'acoustique

Ces points pourront venir plus tard.
