# Architecture Memoire Narration v2

## But

Ce document formalise une cible pragmatique pour la memoire du module narration.

Il sert a:

1. decrire clairement le pipeline actuel
2. isoler les responsabilites de chaque couche memoire
3. identifier les limites structurelles actuelles
4. proposer une architecture cible simple a implementer par phases

Ce document ne remplace pas `spec-Memoires.md`.

Il se place entre:

1. la spec metier
2. le code actuel
3. le plan de refactor

## Resume executif

Aujourd'hui, la memoire narration fonctionne deja, mais elle concentre dans un meme store JSON:

1. la verite canonique de monde
2. la verite locale de campagne
3. la continuite joueur
4. le registre runtime d'entites et d'evenements

Le comportement obtenu est acceptable pour une campagne courte, mais la structure actuelle a trois limites majeures:

1. trop d'entrees/sorties disque par tour
2. projection memoire basee sur des scans complets du store
3. accumulation non regulee des resumes et leads automatiques

La cible v2 est la suivante:

1. charger la memoire une seule fois par tour
2. muter en memoire vive pendant tout le tour
3. persister une seule fois en fin de tour
4. projeter a partir de sous-ensembles pre-filtres
5. compacter la memoire joueur au fil de la campagne

## Pipeline actuel

## 1. Debut de tour

Le serveur narration:

1. lit le store pour le debug
2. incremente `turn_index`
3. reevalue certains enrichissements d'entites
4. injecte `location_id` et `map_prompt` dans `wiki.world_state`
5. nettoie les entites expirees via `cleanupExpiredEntities`

Effet:

- la campagne a deja ete mutatee avant le calcul principal du tour
- plusieurs ecritures disque ont deja eu lieu

## 2. Projection pre-tour

Le runtime appelle `memoryService.project(campaignId, localContext)`.

Cette projection:

1. fusionne `wiki < campagne < contexte local`
2. score les entites
3. score les evenements
4. score les connaissances
5. score les relations
6. renvoie un sous-ensemble limite

Effet:

- la narration ne travaille pas sur toute la memoire brute
- mais la projection doit quand meme reparcourir l'ensemble des collections

## 3. Preparation contextuelle

Avant `processTurn`, le code peut deja modifier la memoire:

1. creation de PNJ stub
2. mise a jour d'un acteur parle
3. marquage `seen`
4. synchronisation des acteurs visibles d'une scene

Effet:

- un tour peut contenir plusieurs mutations memoire avant meme l'execution runtime

## 4. Execution runtime

Le runtime construit `stateBefore` a partir de:

1. `effective_world_state`
2. `location_id`
3. `world_flags`
4. `journal`
5. `events`

Puis `processTurn`:

1. valide input/output
2. verifie les regles de coherence
3. execute les actions runtime
4. calcule `state_diff`
5. loggue la trace du tour

## 5. Synchronisation post-runtime

Apres execution:

1. `events` sont resynchronises depuis `stateAfter`
2. `location_id` est reinjecte dans `world_overrides`
3. `pending_clarification` est stocke
4. `active_talk_actor_id` est stocke
5. `hidden_truth_updates` sont pushes dans `knowledge.truth_view`
6. une projection post-tour est recalculee

## 6. Ecriture post-narration

Apres generation du texte joueur:

1. un `summary` automatique peut etre ajoute a `knowledge.player_view`
2. plusieurs `lead` automatiques peuvent etre ajoutes
3. des enrichissements d'entites peuvent etre acceptes et merges

Effet:

- la memoire de continuite grossit a chaque tour
- cette croissance est aujourd'hui peu contrainte

## Couches memoire a distinguer

La memoire actuelle melange plusieurs usages legitimes. La v2 doit les distinguer explicitement.

## 1. Memoire canonique

Contenu:

1. `wiki.world_state`
2. lore stable
3. verites trans-campagnes

Role:

- fournir le socle de verite de base

Contrainte:

- ne doit pas contenir d'etat local de tour

## 2. Memoire de campagne

Contenu:

1. `world_overrides`
2. `events`
3. `relations`
4. `entity_registry`
5. `knowledge.truth_view`

Role:

- porter la verite specifique a une partie

Contrainte:

- doit rester exploitable par le runtime sans fuite de presentation

## 3. Memoire de continuite joueur

Contenu:

1. `knowledge.player_view`
2. resumes automatiques
3. leads
4. notes manuelles
5. hypotheses joueur

Role:

- fournir de la continuite exploitable pour la narration et l'UX

Contrainte:

- doit etre compacte, dedupliquee, et differencier les notes humaines des productions auto

## 4. Memoire de travail de tour

Contenu cible:

1. campagne chargee en RAM
2. verite effective du tour
3. projection pre-tour
4. mutations en cours
5. projection post-tour

Role:

- servir d'espace transactionnel pour un tour complet

Contrainte:

- ne doit pas persister partiellement a chaque petite mutation

## Limites structurelles actuelles

## 1. Read/write complet du store a chaque mutation

Le store JSON:

1. relit le fichier complet
2. normalise la campagne
3. reecrit le fichier complet

Cela arrive pour:

1. `advanceCampaignTurn`
2. `upsertEntity`
3. `markEntitySeen`
4. `setWorldOverride`
5. `appendKnowledgePlayerView`
6. `appendKnowledgeTruthView`
7. plusieurs autres mutations

Impact:

1. cout I/O qui augmente avec la taille du store
2. couplage fort entre logique metier et persistance
3. difficulte a raisonner sur les mutations d'un tour comme un tout coherent

## 2. Projection basee sur scan complet

La projection:

1. recupere tous les acteurs
2. toutes les locations
3. tous les objets
4. tous les evenements
5. toutes les connaissances
6. toutes les relations

Puis elle score et coupe.

Impact:

1. le cout augmente lineairement avec la campagne
2. les index du registre sont sous-utilises
3. le budget de prompt reste stable, mais pas le cout de calcul

## 3. Index reconstruits souvent pour peu d'usage

Le store reconstruit les index:

1. `by_type`
2. `by_memory_state`
3. `by_location_id`
4. `by_event_id`
5. `by_scope`
6. `by_status`

Impact:

1. bonne base pour la suite
2. faible benefice tant que la projection n'en depend pas reellement

## 4. `knowledge.player_view` sans regulation suffisante

Le pipeline pousse:

1. des summaries auto
2. des leads auto
3. des notes potentielles de joueur

Sans mecanisme fort de:

1. deduplication
2. compactage
3. vieillissement
4. budget par lieu
5. budget par type de connaissance

Impact:

1. dilution de l'information utile
2. redondance des prompts de narration
3. memoire qui devient progressivement bruyante

## 5. Cycle de vie memoire incomplet

Le modele distingue deja:

1. `active`
2. `relevant`
3. `dormant`
4. `archived`

Mais en pratique:

1. `active` est tres dominant
2. `archived` est utilise pour la fin de vie
3. `relevant` et `dormant` sont peu exploites dans les transitions automatiques

Impact:

- la memoire manque d'etats intermediaires utiles pour controler la projection

## 6. Confusion entre monde canonique et etat local

Le pipeline met aujourd'hui `location_id` et `map_prompt` dans `wiki.world_state`.

Impact:

1. melange entre canon global et etat de session
2. base fragile si plusieurs campagnes coexistent
3. ambiguite conceptuelle pour les futurs refactors

## Principes de conception v2

## 1. Une memoire brute, plusieurs vues derivees

La source de verite doit rester la memoire brute:

1. wiki
2. campagne
3. continuite joueur

La projection doit etre:

1. derivee
2. jetable
3. recalculable
4. budgetee

## 2. Les mutations d'un tour doivent etre transactionnelles

Un tour doit etre traite comme une unite logique.

Cela implique:

1. charger une fois
2. muter plusieurs fois
3. valider
4. flusher une fois

## 3. La memoire joueur doit etre compacte

Toutes les connaissances joueur n'ont pas la meme valeur.

La v2 doit differencier:

1. fait memoriel durable
2. note manuelle
3. resume temporaire de scene
4. lead opportuniste

Et appliquer des politiques differentes.

## 4. La projection doit dependre d'un budget explicite

Au lieu de projeter "ce qui passe le score", il faut projeter "ce qui rentre dans le budget du tour".

Exemples:

1. 6 connaissances joueur maximum
2. 5 acteurs maximum
3. 4 evenements maximum
4. 3 relations maximum

Ces budgets peuvent varier selon l'intent.

## 5. Le cycle de vie doit etre exploite comme outil de cout

`memory_state` n'est pas seulement une semantique metier.

Il doit servir a:

1. limiter la projection
2. guider le compactage
3. reduire le bruit
4. prioriser les rappels utiles

## Architecture cible

## 1. Store persistant

Responsabilite:

- sauvegarder l'etat durable

Regles:

1. aucune logique de selection metier
2. aucune projection
3. aucune ecriture opportuniste de contexte local ephemere

Contenu:

1. `wiki`
2. `campaigns`

## 2. Session memoire de tour

Nouvel objet cible:

`TurnMemorySession`

Responsabilites:

1. charger `wiki + campaign`
2. exposer des getters/read models de tour
3. accumuler les mutations
4. calculer projection pre-tour et post-tour
5. persister en fin de tour

Interface cible minimale:

```ts
type TurnMemorySession = {
  campaignId: string;
  turnId: string;
  campaign: CampaignMemory;
  wikiWorldState: Record<string, unknown>;
  markDirty(): void;
  project(localContext: Record<string, unknown>): ProjectedMemory;
  buildRuntimeStateBefore(localContext: Record<string, unknown>): Record<string, unknown>;
  flush(): void;
};
```

## 3. Services de mutation

`MemoryService` peut rester le point d'entree metier, mais doit operer sur:

1. une session si elle existe
2. le store direct seulement pour les usages hors tour

Regle:

- en contexte de tour, une mutation ne doit pas provoquer un `saveCampaign()` immediat

## 4. Projecteur memoire

Le projecteur doit avoir deux etapes:

1. preselection via index
2. scoring fin

Pseudo-pipeline:

```text
localContext
  -> prefilter by location / type / memory_state
  -> scoring by recency / target / intent
  -> cut by budget
  -> projected_memory
```

## 5. Compacteur de memoire joueur

Nouveau composant cible:

`PlayerMemoryCompactor`

Responsabilites:

1. dedupliquer les resumes proches
2. fusionner les leads repetitifs
3. proteger les notes manuelles
4. reduire le bruit des productions auto
5. promouvoir certains faits en resumes persistants

## Politique de cycle de vie cible

## Entites

### `active`

Entite:

1. vue ce tour ou tour recent
2. ciblee par l'intent
3. importante pour la scene immediate

Projection:

- priorite maximale

### `relevant`

Entite:

1. pas forcement visible maintenant
2. mais encore pertinente pour la scene ou l'objectif

Projection:

- priorite moyenne

### `dormant`

Entite:

1. connue
2. non utile immediatement
3. recuperable si le contexte l'appelle

Projection:

- faible priorite

### `archived`

Entite:

1. sortie de la boucle active
2. expiree
3. retiree de la projection normale

Projection:

- absente sauf requete speciale

## Connaissances joueur

Politique cible:

1. `player_manual` n'est jamais compacte agressivement
2. `summary` auto est compactable
3. `lead` auto est compactable et expirant
4. `player_hypothesis` reste visible mais peu prioritaire
5. `fact_*` et `met_actor` peuvent devenir des ancres durables

## Budgets de projection cibles

Valeurs de depart proposees:

### `observe`

1. acteurs: 6
2. objets: 8
3. locations: 3
4. evenements: 4
5. relations: 2
6. knowledge player: 6
7. knowledge truth: 6

### `talk`

1. acteurs: 5 dont la cible obligatoire
2. objets: 3
3. locations: 2
4. evenements: 4
5. relations: 5
6. knowledge player: 6
7. knowledge truth: 6

### `move_local`

1. acteurs: 3
2. objets: 3
3. locations: 5
4. evenements: 3
5. relations: 2
6. knowledge player: 4
7. knowledge truth: 4

Ces budgets doivent vivre dans une configuration explicite, pas dans des nombres disperses.

## Plan de migration

## Phase 1. Session memoire de tour

Objectif:

- supprimer la plupart des read/write repetes pendant un tour

Travail:

1. ajouter `TurnMemorySession`
2. charger campagne et wiki une seule fois par `process-turn`
3. faire operer `MemoryService` sur la session
4. flusher en fin de tour

Critere de succes:

- un tour standard ne reecrit plus le store a chaque mutation intermediaire

## Phase 2. Projection prefiltragee

Objectif:

- reduire le cout de projection

Travail:

1. exploiter `by_location_id`
2. exploiter `by_memory_state`
3. exploiter `by_type`
4. ne scorer qu'un sous-ensemble candidat
5. centraliser les budgets par intent

Critere de succes:

- le cout de projection croit plus lentement que la memoire brute

## Phase 3. Compactage joueur

Objectif:

- empecher `knowledge.player_view` de devenir bruyante

Travail:

1. dedup des summaries auto
2. expiration des leads obsoletes
3. budget par lieu
4. consolidation des faits repetes

Critere de succes:

- la memoire joueur reste lisible sur campagne longue

## Phase 4. Clarification des frontieres de verite

Objectif:

- retirer les donnees de session du `wiki.world_state`

Travail:

1. deplacer `location_id` et `map_prompt`
2. reserver `wiki` au canon
3. utiliser `world_overrides` ou `localContext` pour le reste

Critere de succes:

- plus de confusion entre canon global et etat local

## Invariants a preserver

Pendant le refactor, il faut conserver:

1. la priorite `local > campagne > wiki`
2. la compatibilite du `memory-store.json`
3. les tests d'integration memoire existants
4. le debug `projected_memory`
5. la possibilite de reconstituer un tour depuis la trace

## Anti-objectifs

La v2 ne cherche pas immediatement a:

1. migrer vers une vraie base de donnees
2. introduire un moteur vectoriel
3. remplacer toute la projection heuristique
4. transformer la memoire en systeme generique complet

Le bon niveau d'ambition est:

- rendre la memoire actuelle stable, lisible, et scalable pour une campagne moyenne

## Decision guide

Si une evolution future concerne la memoire, on peut la juger avec ces questions:

1. la donnee est-elle canonique, de campagne, joueur, ou de travail de tour ?
2. cette donnee doit-elle etre persistante ou jetable ?
3. cette ecriture doit-elle arriver immediatement ou en fin de tour ?
4. cette information doit-elle vivre dans la memoire brute ou dans une projection ?
5. cette entree ajoute-t-elle de la continuite utile ou seulement du bruit ?

Si la reponse n'est pas claire, l'evolution ne doit pas etre implementee avant clarification.

## Fichiers concernes par la future implementation

Base actuelle:

1. `src/adapters/db/memory_store.ts`
2. `src/application/use_cases/memory_service.ts`
3. `src/domain/memory/memory_projection.ts`
4. `src/domain/memory/truth_resolution.ts`
5. `server/narrationHttpApi.js`

Extensions probables:

1. `src/application/use_cases/turn_memory_session.ts`
2. `src/domain/memory/player_memory_compactor.ts`
3. eventuellement un module de config de budgets de projection

## Conclusion

Le probleme principal du module narration n'est pas l'absence de memoire.

Le probleme principal est que la memoire actuelle fait deja beaucoup de choses utiles, mais sans frontieres assez nettes entre:

1. persistance
2. projection
3. continuite joueur
4. travail transactionnel de tour

La v2 propose donc une evolution sobre:

1. une session memoire de tour
2. une projection budgetee et prefiltragee
3. une memoire joueur compacte
4. une frontiere claire entre canon et etat local

Cette cible est suffisamment petite pour etre mise en place sans rewriter tout le module, et suffisamment structurante pour eviter que `memory-store.json` devienne le centre implicite de l'architecture.
