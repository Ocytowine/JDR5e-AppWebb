# Roadmap Alignement Memoire Pipeline v2

## But

Cette roadmap organise le refactor du module narration pour aligner le code avec la vision posee dans [spec-Memoires.md](c:\Users\Utilisateur\Desktop\JDR5e-AppWebb\test-GAME-2D\narration-module\docs\01-specs\spec-Memoires.md).

Elle vise 4 objectifs:

1. separer proprement le modele memoire metier de l'implementation temporaire actuelle
2. fiabiliser la projection de verite `contexte local > memoire de partie > wiki`
3. stabiliser le cycle de vie des entites, evenements et connaissances
4. rendre le pipeline plus robuste, testable et evolutif

## Diagnostic de depart

Le code actuel a deja de bons acquis:

1. pipeline en 4 etapes lisible
2. separation IA amont / runtime / IA aval
3. premiere couche de memoire de campagne
4. premier registre d'entites runtime
5. mecanique `stub -> pending_enrichment -> resolved`

Mais plusieurs ecarts restent ouverts:

1. pas de vraie horloge de campagne
2. etats techniques et etats metier encore melanges
3. projection memoire encore trop proche d'un dump debug
4. layering wiki / partie / contexte pas encore encapsule
5. adapter JSON de test trop visible dans les choix de modele
6. archivage et expiration encore insuffisamment gouvernes par la spec

## Principe directeur

Le refactor doit suivre cette logique:

1. definir d'abord le modele metier cible
2. ensuite fixer les interfaces de service
3. ensuite adapter le pipeline
4. ensuite seulement consolider le stockage

Il ne faut pas laisser le `memory-store.json` ou le debug UI dicter l'architecture.

## Schema cible minimal

Ce schema est un appui de roadmap, pas encore la version finale complete.

```ts
type CampaignClock = {
  turn_index: number;
  time_of_day?: string | null;
  calendar_ref?: string | null;
};

type MemoryLifecycleState = "active" | "relevant" | "dormant" | "archived";
type ProfileState = "stub" | "pending_enrichment" | "resolved";

type CampaignMemoryV2 = {
  campaign_id: string;
  clock: CampaignClock;
  world_overrides: Record<string, unknown>;
  events: NarrationEventRecord[];
  relations: RelationRecord[];
  knowledge: {
    player_view: PlayerKnowledgeRecord[];
    truth_view: TruthKnowledgeRecord[];
  };
  entity_registry: {
    actors: Record<string, RuntimeActorRecord>;
    locations: Record<string, RuntimeLocationRecord>;
    objects: Record<string, RuntimeObjectRecord>;
    indexes: EntityRegistryIndexes;
  };
  projection_policies: {
    lore_budget_by_intent: Record<string, { max_entries: number; max_chars: number }>;
    memory_selection: {
      active_weight: number;
      relevant_weight: number;
      dormant_weight: number;
      archived_weight: number;
    };
  };
  meta: {
    created_at_turn: string;
    updated_at_turn: string;
    storage_adapter_version: string;
  };
};

type RuntimeEntityBase = {
  entity_id: string;
  entity_type: "actor" | "location" | "object";
  display_name: string;
  memory_state: MemoryLifecycleState;
  status: "active" | "inactive" | "archived";
  created_at_turn: string;
  updated_at_turn: string;
  last_seen_turn: string | null;
  first_seen_turn_index: number | null;
  last_seen_turn_index: number | null;
  location_id: string | null;
  links: {
    event_ids: string[];
    related_entity_ids: string[];
    faction_ids: string[];
  };
  lifecycle_policy: {
    archive_after_turns?: number | null;
    expire_after_turns?: number | null;
    promote_if_linked_to_event?: boolean;
  };
};

type RuntimeActorRecord = RuntimeEntityBase & {
  entity_type: "actor";
  profile_state: ProfileState;
  pending_enrichment: EntityEnrichmentProposal | null;
  payload: ActorProfilePayload;
};
```

## Architecture cible

Le systeme cible doit etre pense en 5 blocs:

1. `Wiki canonique`
2. `Memoire complete de partie`
3. `Projection memoire de scene`
4. `Runtime d'execution`
5. `Adapter de persistence`

Relation attendue:

```text
wiki canonique
    +
memoire de partie
    +
contexte local actif
    ->
verite effective projetee
    ->
runtime + IA
```

## Phases

## Phase 0 - Stabilisation immediate

### Objectif

Supprimer les points de fragilite qui peuvent casser les tests ou polluer tout le refactor.

### Travaux

1. introduire un `turn_index` monotone par campagne
2. ne plus utiliser `turn_id` pour deduire un ordre
3. corriger le merge de `world_state` pour respecter la requete courante
4. reduire les redondances les plus evidentes dans le debug du pipeline

### Livrables

1. `clock.turn_index` dans la memoire de campagne
2. increment au debut ou a la validation d'un tour
3. helper central `getCurrentTurnIndex()`
4. regression tests sur:
   - increment
   - continuity loop
   - meme campagne / plusieurs tours

### Criteres de fin

1. aucun calcul de cycle de vie ne depend plus du UUID du tour
2. le lieu courant du tour est toujours coherent entre input, projection et trace

### Risques

1. casser certains tests qui supposent `turn_id` comme seul identifiant temporel
2. devoir migrer la memoire locale existante

## Phase 1 - Separation modele metier / etats techniques

### Objectif

Distinguer clairement:

1. l'etat memoire d'un element
2. l'etat technique de resolution d'un profil

### Travaux

1. ajouter `memory_state` aux entites
2. conserver `profile_state` pour les profils enrichissables
3. definir les transitions officielles:
   - `active -> relevant -> dormant -> archived`
   - `stub -> pending_enrichment -> resolved`
4. documenter les transitions interdites

### Livrables

1. schema TS clair des deux familles d'etats
2. helper de transition centralise
3. tests unitaires de transition

### Criteres de fin

1. une entite peut etre `resolved` et `dormant` sans ambiguite
2. le pipeline ne confond plus “profil resolu” et “element actif dans la scene”

### Risques

1. dette de compatibilite avec le registre courant

## Phase 2 - Projection memoire centralisee

### Objectif

Transformer la projection memoire en vrai mecanisme metier, pas en sous-produit du debug.

### Travaux

1. definir un `MemoryProjectionService`
2. formaliser la selection de:
   - events
   - relations
   - knowledge.player_view
   - knowledge.truth_view
   - entities
3. faire dependre la projection:
   - du lieu
   - de l'intent
   - des liens avec les evenements
   - du `memory_state`
4. separer:
   - projection IA
   - projection debug

### Livrables

1. contrat `ProjectedSceneMemory`
2. regles de priorite par intent
3. tests de projection sous budget

### Criteres de fin

1. le runtime n'envoie plus la memoire “parce qu'elle est la”
2. la projection est stable, testable, et faible en tokens

### Risques

1. regressions de qualite narrative si la projection devient trop agressive

## Phase 3 - Layering de verite explicite

### Objectif

Encapsuler proprement la hierarchie:

`contexte local > memoire de partie > wiki`

### Travaux

1. introduire un service `TruthResolutionService`
2. separer:
   - lecture wiki
   - lecture memoire de campagne
   - overrides locaux
3. produire une `verite effective` exploitable par scene
4. formaliser les conflits:
   - partie bat wiki
   - local bat partie

### Livrables

1. contrat `EffectiveTruthSnapshot`
2. helpers de merge non ambigus
3. tests de conflit wiki vs campagne vs local

### Criteres de fin

1. plus de merge ad hoc dans `narrationHttpApi.js`
2. tout arbitrage de verite passe par un service central

### Risques

1. devoir refactorer `wikiLoreHelper` et `localLoreHelper`

## Phase 4 - Entity registry aligne spec

### Objectif

Faire du registre d'entites un citoyen de premiere classe de la memoire de partie.

### Travaux

1. relier explicitement `entity_registry` avec:
   - `events`
   - `relations`
   - `world_overrides`
2. definir les regles de promotion:
   - entite de scene
   - entite recurrente
   - entite archivee
3. revoir la resolution de cible:
   - `target_actor_id` prioritaire
   - sinon ambiguity handling
   - sinon creation de stub
4. ajouter une politique claire pour “plusieurs gardes / plusieurs marchands”

### Livrables

1. resolution de cible non floue par defaut
2. strategie d'ambiguite propre
3. tests multi-acteurs meme lieu

### Criteres de fin

1. “un garde” et “un autre garde” ne fusionnent plus par accident
2. la creation d'entite devient deterministe et justifiable

### Risques

1. plus de clarifications demandees au joueur sur les cas vagues

## Phase 5 - Politique archive / expiration

### Objectif

Aligner le cycle de vie avec la spec memoire:

1. projection selective
2. archivage avant suppression
3. expiration reservee a des cas faibles et explicites

### Travaux

1. remplacer la logique actuelle “expiration si TTL elapsed” par une policy en deux etapes:
   - passage `dormant`
   - passage `archived`
2. reserver `expired` ou suppression a des entites ephemeres sans liens
3. brancher le cleanup a des moments clairs:
   - fin de tour
   - chargement campagne
   - maintenance explicite

### Livrables

1. `LifecyclePolicyService`
2. tests d'archivage
3. tests de non-perte d'information liee a un event

### Criteres de fin

1. un element important ne disparait pas juste parce qu'il est ancien
2. la memoire complete continue de croitre sans surcharger la projection

### Risques

1. inflation memoire si les policies sont trop prudentes

## Phase 6 - Adapter de persistence decouple

### Objectif

Faire du stockage une implementation interchangeable, pas une contrainte du modele.

### Travaux

1. definir une interface de repository de campagne
2. isoler l'adapter JSON actuel
3. rendre possible ensuite:
   - sqlite locale
   - indexed storage
   - autre backend local
4. ajouter ecriture atomique et recovery minimal sur l'adapter JSON de test

### Livrables

1. interface `CampaignMemoryRepository`
2. adapter `JsonCampaignMemoryRepository`
3. migration progressive de `JsonMemoryStore`

### Criteres de fin

1. le modele memoire ne depend plus du format JSON
2. changer d'adapter ne change pas les regles metier

### Risques

1. refactor transversal sur le service memoire

## Phase 7 - Nettoyage pipeline / debug

### Objectif

Redonner au pipeline un contrat lisible et stable.

### Travaux

1. definir les champs autorises par etape
2. dedoubler clairement:
   - donnees metier
   - donnees debug
3. supprimer les doublons top-level / `trace` / `ai_handoff`
4. centraliser les extracteurs UI de debug

### Livrables

1. contrat `ProcessTurnDebugEnvelope`
2. UI debug plus simple
3. payloads plus petits et moins ambigus

### Criteres de fin

1. une information n'a qu'une seule source de verite dans le debug
2. l'UI narration ne contient plus de logique metier implicite

### Risques

1. casser les outils de test visuels existants

## Phase 8 - Validation metier par type d'entite

### Objectif

Etendre proprement la logique aujourd'hui appliquee aux acteurs vers:

1. lieux
2. objets
3. plus tard, factions ou groupes

### Travaux

1. appliquer le flow `stub -> pending -> resolved` a `LocationState`
2. appliquer ensuite a `ObjectState`
3. definir les validations lore-aware par type
4. lier les entites a des evenements quand utile

### Livrables

1. enrichissement differe des lieux
2. enrichissement differe des objets
3. tests d'integration multi-types

### Criteres de fin

1. la methode devient transversale, pas seulement sociale

### Risques

1. explosion de complexite si on etend avant d'avoir stabilise les phases 0 a 6

## Priorite recommandee

Ordre concret d'execution:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8

## Quick wins

Avant le gros refactor, trois gains rapides sont possibles:

1. ajouter `turn_index`
2. corriger le merge `world_state`
3. securiser l'ecriture de l'adapter JSON de test

Ces trois points reduisent deja le risque global sans engager toute la migration.

## Definition of Done globale

La roadmap sera consideree comme terminee quand:

1. le modele memoire suit la spec plutot que l'adapter courant
2. le pipeline repose sur une projection memoire selectionnee, pas sur des dumps
3. les entites ont un cycle de vie metier coherent
4. l'archivage prime sur la suppression
5. le stockage devient interchangeable
6. la verite effective est resolue de facon explicite et testee

## Recommandation pratique

La meilleure suite n'est pas de tout lancer d'un coup.

Je recommande:

1. Phase 0 + Phase 1 ensemble
2. puis Phase 2 + Phase 3
3. puis seulement le refactor de persistence Phase 6

Cela permet de stabiliser le modele avant de changer l'infrastructure.
