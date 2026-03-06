# Registre des entites du monde runtime v1

## Vocabulaire

Dans la suite, on utilise:

- `entite du monde runtime` comme terme principal
- `entity` comme alias technique si necessaire dans le code

Une entite du monde runtime est simplement une chose importante que le runtime doit pouvoir:

1. identifier
2. stocker
3. retrouver
4. mettre a jour
5. archiver ou expirer

Exemples:

- un PJ
- un PNJ
- un lieu local
- un objet important
- une preuve
- un element de scene qui doit durer un peu

## But du registre

Le registre sert a centraliser les entites du monde runtime.

Il evite:

- de recreer plusieurs fois le meme PNJ
- de perdre les changements locaux d'un lieu
- de laisser un objet important exister seulement dans du texte
- de polluer la memoire avec des elements jamais nettoyes

Le registre doit etre la couche qui permet au runtime de savoir:

- qui existe
- quoi existe
- ou cela existe
- dans quel etat
- pour combien de temps
- avec quels liens vers des evenements ou d'autres entites

## Ce que le registre ne doit pas etre

Le registre n'est pas:

- le wiki lore
- un moteur de narration
- un inventaire complet de simulation
- une base fourre-tout sans regles de cycle de vie

Le registre complete le wiki et la memoire de campagne.

## Position dans l'architecture

Le flux vise est:

1. IA amont analyse l'intention
2. runtime decide s'il a besoin d'une entite du monde
3. runtime consulte ou cree dans le registre
4. runtime execute
5. runtime met a jour memoire, events et registre
6. IA aval raconte a partir du resultat

## Types d'entites v1

Le registre v1 doit pouvoir contenir au minimum:

1. `actor`
2. `location`
3. `object`

Et plus precisement:

1. `actor/pj`
2. `actor/pnj`
3. `location/location_state`
4. `object/document`
5. `object/key`
6. `object/evidence`

## Structure generale du registre

Le registre peut etre vu comme une collection de fiches runtime.

Exemple de structure logique:

```json
{
  "actors": {
    "npc_guard_gate_01": {},
    "pj_1_narrative": {}
  },
  "locations": {
    "locstate_caserne_centrale_main": {}
  },
  "objects": {
    "obj_register_burned_01": {}
  },
  "indexes": {
    "by_location_id": {
      "caserne_centrale": [
        "npc_guard_gate_01",
        "locstate_caserne_centrale_main"
      ]
    },
    "by_event_id": {
      "evt-archives-01": [
        "obj_register_burned_01"
      ]
    }
  }
}
```

## Fonctions attendues v1

Le registre doit pouvoir offrir au minimum:

1. `getById`
2. `upsert`
3. `findByLocation`
4. `findByType`
5. `findLinkedToEvent`
6. `markSeen`
7. `promoteScope`
8. `archiveEntity`
9. `expireEntity`
10. `cleanupExpired`

## Identifiants

Chaque entite doit avoir un identifiant stable runtime.

Regles simples v1:

- prefixe par type
- lisible
- stable tant que l'entite existe

Exemples:

- `npc_guard_gate_01`
- `pj_1_narrative`
- `locstate_caserne_centrale_main`
- `obj_register_burned_01`

## Index minimaux

Pour rester maintenable, le registre v1 ne doit pas multiplier les index inutilement.

Index utiles:

1. `by_id`
2. `by_type`
3. `by_location_id`
4. `by_event_id`
5. `by_scope`
6. `by_status`

Ces index servent a:

- retrouver vite les acteurs visibles dans une scene
- retrouver les objets lies a un event
- nettoyer les entites expirables

## Regles de creation

### Acteur

Creer si:

- action sociale ciblee
- besoin d'un interlocuteur
- besoin d'un temoin, suspect, garde, source

### Lieu

Creer ou enrichir si:

- une scene locale depend d'un etat de lieu
- un event modifie le lieu
- la scene doit savoir qui est visible et ce qui est contraint

### Objet

Creer si:

- objet vise, pris, cache, montre, vole, detruit
- objet a valeur de preuve ou de consequence

## Regles de mise a jour

Chaque fois qu'une entite est touchee par un tour:

1. mettre a jour `updated_at_turn`
2. mettre a jour `last_seen_turn` si vue ou mobilisee
3. ajuster les liens
4. verifier si promotion necessaire
5. verifier si cycle de vie doit changer

## Regles de promotion

Le registre doit permettre de promouvoir une entite:

- `ephemeral -> situational`
- `situational -> persistent`

Promotion si:

1. l'entite revient sur plusieurs tours
2. elle est liee a un event actif
3. elle devient importante pour le PJ ou la campagne

## Regles d'archivage et d'expiration

Le registre doit distinguer:

- `active`
- `dormant`
- `archived`
- `expired`

### `expired`

Entite retiree de la memoire active car sans utilite restante.

### `archived`

Entite non active mais encore importante comme trace historique.

## Regles de nettoyage

Le registre doit pouvoir faire un nettoyage automatique simple.

Politique v1:

1. parcourir les entites `active` ou `dormant`
2. verifier `scope`
3. comparer `last_seen_turn` avec `ttl_turns`
4. expirer si aucun lien bloquant n'existe
5. archiver si historique important

Liens bloquants typiques:

- `event_ids` non vides sur un event encore actif
- relation importante avec le PJ
- objet cle de quete

## Lien avec la memoire locale

Le registre doit vivre dans la memoire locale de campagne.

Mais il ne doit pas etre melange indistinctement avec:

- `knowledge_player_view`
- `knowledge_truth_view`
- `world_overrides`
- `events`

Il faut une section dediee.

Exemple:

```json
{
  "campaigns": {
    "campaign_id": {
      "entity_registry": {
        "actors": {},
        "locations": {},
        "objects": {},
        "indexes": {}
      }
    }
  }
}
```

## Lien avec les events

Le registre n'est pas l'event engine.

Mais il doit pouvoir repondre a des questions comme:

- quels acteurs sont lies a cet event ?
- quels objets sont des preuves de cet event ?
- quel lieu porte encore les consequences de cet event ?

## Lien avec la narration

La narration ne doit pas afficher toute la fiche.

Le registre sert a garder une verite exploitable.
L'IA aval pioche ensuite seulement ce qui est utile pour:

- decrire
- faire parler
- rappeler
- faire reagir

## Cas concret

### Tour 1

Input joueur:

- "je vais parler au garde de l'entree"

Traitement:

1. IA amont detecte `talk`
2. runtime ne trouve pas encore d'acteur stable
3. runtime cree `npc_guard_gate_01`
4. runtime ouvre le dialogue
5. registre associe l'acteur a `caserne_centrale`

### Tour 5

Input joueur:

- "je reparle au garde de tout a l'heure"

Traitement:

1. runtime retrouve `npc_guard_gate_01`
2. ne recree rien
3. met a jour `last_seen_turn`
4. peut promouvoir si l'acteur devient recurrent

## Definition of Done v1

Le registre sera considere pret a coder si:

1. il definit clairement ce qu'est une entite du monde runtime
2. il accepte `actor`, `location`, `object`
3. il gere `active|dormant|archived|expired`
4. il gere `ephemeral|situational|persistent`
5. il peut retrouver une entite par `id`, `location`, `event`
6. il peut promouvoir, archiver, expirer
7. il peut vivre proprement dans la memoire locale de campagne

## Suite logique

Une fois ce registre pose, la priorite code doit etre:

1. structure de stockage dans la memoire locale
2. helpers `get/upsert/find`
3. creation d'un `ActorProfile` automatique pour `talk`
4. marquage `last_seen_turn` et `ttl`
5. cleanup simple
