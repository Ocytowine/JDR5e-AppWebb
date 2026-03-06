# Explication Pipeline Narration Actuel

## But du document

Ce document explique, en francais simple, ce que fait actuellement le pipeline narration.

Il decrit:

1. le role de chaque etape
2. comment le contexte est construit
3. ce qui releve de l'IA
4. ce qui releve du runtime
5. ce qui est aujourd'hui deja en place

Ce document parle du pipeline **actuel**, pas de la cible theorique complete.

## Vue d'ensemble

Le pipeline narration fonctionne aujourd'hui en 4 etapes:

1. `step_1_app_to_runtime_request`
2. `step_2_runtime_received_packet`
3. `step_3_runtime_to_llm_request`
4. `step_4_app_final_response`

On peut le lire comme ceci:

```text
App / UI
  -> envoie un tour
IA amont
  -> comprend l'intention
Runtime
  -> verifie, resout, execute, projette
IA aval
  -> raconte le resultat
App / UI
  -> affiche le texte final + debug
```

## Etape 1 - Envoi app

### Role

L'etape 1 correspond a ce que l'application envoie au serveur narration.

### Ce qu'elle contient

En general:

1. `campaign_id`
2. `character_id`
3. `player_input`
4. `location_id`
5. `narration_context`
6. `narration_goal`
7. `narration_constraints`
8. optionnellement:
   - `intent_hint`
   - `target_actor_id`
   - `destination_id`

### Ce que cette etape ne doit pas faire

Cette etape ne doit pas decider seule de la verite narrative.

Elle sert a fournir:

1. le besoin du joueur
2. le contexte de scene
3. les aides de test UI

Elle ne doit pas imposer l'intent metier comme verite centrale.

## Etape 2 - Paquet recu / intention interpretee

### Role

L'etape 2 est la sortie de l'IA amont.

Son role est de transformer l'input joueur en un paquet structure exploitable par le runtime.

### Ce qu'elle produit

En general:

1. `intent_type`
2. `intent_confidence`
3. `requires_clarification`
4. `clarification_question`
5. `target_actor_hint`
6. `target_actor_id` si deja resolu ou fourni
7. `destination_id` si utile
8. `notes`
9. `world_anchor`

### Raison d'etre

Cette etape sert a separer:

1. l'interpretation du texte joueur
2. l'execution runtime

En clair:

- l'IA dit ce que le joueur veut faire
- le runtime dit si c'est faisable et comment

## Etape 3 - Runtime vers IA aval

### Role

L'etape 3 est le coeur technique du pipeline.

Le runtime prend l'intention interpretee et fabrique:

1. un plan
2. des actions runtime
3. une projection memoire
4. un sous-ensemble lore utile
5. un resultat exploitable par l'IA aval

### Ce que le runtime fait avant de generer cette etape

Avant de construire `ai_handoff`, le runtime fait plusieurs choses.

#### 1. Horloge de campagne

Le tour de campagne avance avec un `turn_index` monotone.

Cela sert a:

1. stabiliser la temporalite
2. suivre la recence
3. supporter le cycle de vie des entites

#### 2. Verite effective

Le runtime construit une verite effective a partir de:

1. `wiki` canonique
2. `memoire de partie`
3. `contexte local`

La priorite actuelle est:

`wiki < memoire de partie < contexte local`

#### 3. Projection memoire

Le runtime ne renvoie plus toute la memoire brute.

Il projette un sous-ensemble utile selon:

1. le `location_id`
2. l'intent courant
3. la cible sociale si presente
4. l'etat memoire des entites
5. la recence

### Ce que contient l'etape 3

L'etape 3 contient principalement `ai_handoff`.

Dedans, on trouve:

1. `intent_packet`
2. `input_contract`
3. `output_contract`
4. `runtime_result`

### `input_contract`

C'est l'entree normalisee du tour pour le runtime / narration.

On y retrouve:

1. le texte joueur
2. le contexte recent
3. l'etat du monde utile
4. les acteurs connus utiles
5. le contrat de reponse

### `output_contract`

C'est le resultat decisionnel du runtime.

On y retrouve:

1. les `targets`
2. le `plan`
3. les `runtime_actions`
4. les contraintes de narration

Exemples de `runtime_actions`:

1. `advanceTime`
2. `queryLore`
3. `startDialogue`
4. plus tard d'autres actions metier

### `runtime_result`

C'est le resultat brut utile pour l'IA aval.

On y retrouve aujourd'hui:

1. `runtime_actions`
2. `state_diff`
3. `truth_snapshot`
4. `projected_memory`
5. `selected_lore`
6. `selected_local_lore`
7. `entity_enrichment_requests`
8. `entity_profile_updates`

### Resolution sociale actuelle

Quand l'intent est `talk`, le runtime fait maintenant:

1. recherche d'abord dans les `visible_actors` du lieu courant
2. sinon regarde `target_actor_id` si deja connu
3. sinon regarde le registre global d'acteurs
4. sinon cree un `stub`
5. s'il y a ambiguite, demande une clarification

### LocationState runtime actuel

Le lieu courant peut maintenant avoir un etat runtime minimal:

1. `visible_actors`
2. `connected_locations`
3. `active_points_of_interest`

Cet etat est encore simple, mais il sert deja d'ancrage local.

## Etape 4 - Recu app / narration finale

### Role

L'etape 4 est la sortie de l'IA aval.

Le runtime ne raconte pas la scene lui-meme.
Il passe la main a l'IA aval pour transformer le resultat technique en texte joueur.

### Ce qu'elle produit

En general:

1. `player_text`
2. `mj_notes`
3. `next_turn_hints`
4. optionnellement:
   - `entity_enrichment_proposals`
   - `proposal_update_decisions`
   - `profile_update_decisions`

### Raison d'etre

Cette etape sert a:

1. raconter
2. garder une sortie lisible pour le joueur
3. proposer des enrichissements de profils ou d'autres entites

## Construction actuelle du contexte

Quand on dit “construire le contexte”, il faut distinguer 3 choses:

### 1. Contexte d'entree UI

Il vient de l'application:

1. texte joueur
2. lieu courant
3. contexte scene
4. objectif
5. contraintes

### 2. Contexte metier runtime

Le runtime enrichit ensuite avec:

1. verite effective
2. projection memoire
3. lore ciblee wiki
4. lore locale de campagne
5. etat des entites du lieu

### 3. Contexte de narration finale

L'IA aval recupere le resultat du runtime:

1. actions effectuees
2. consequences
3. lore utile
4. entites concernees
5. demandes d'enrichissement

Donc le contexte final n'est pas juste “un prompt texte”.

C'est le resultat de:

1. l'entree joueur
2. la verite resolue
3. la memoire projetee
4. l'execution runtime

## Role de l'IA et role du runtime

## IA amont

Role:

1. comprendre l'intention
2. proposer une cible probable
3. demander une clarification si necessaire

Elle ne doit pas executer le monde.

## Runtime

Role:

1. resoudre la verite utile
2. projeter la memoire
3. resoudre les cibles
4. arbitrer les actions
5. executer les commandes
6. mettre a jour l'etat et la memoire

Le runtime est l'autorite systeme.

## IA aval

Role:

1. raconter le resultat
2. produire un texte joueur coherent
3. ajouter des notes MJ utiles
4. proposer des enrichissements differes si besoin

Elle ne doit pas contredire le runtime.

## Ce qui est deja bien en place

Aujourd'hui, le pipeline sait deja faire:

1. classifier un intent en amont
2. separer interpretation et execution
3. projeter la memoire de maniere plus selective
4. resoudre une verite effective locale
5. gerer des acteurs runtime avec:
   - `stub`
   - `pending_enrichment`
   - `resolved`
6. resoudre un interlocuteur social avec priorite scene -> registre -> creation
7. faire une narration finale separee

## Ce qui reste encore imparfait

Le pipeline actuel est deja exploitable, mais il reste des limites:

1. `LocationState` est encore minimal
2. la validation lore-aware des enrichissements peut etre renforcee
3. le debug reste plus riche que strictement necessaire
4. le stockage actuel est encore un adapter temporaire

## Resume simple

En une phrase:

1. l'app envoie un tour
2. l'IA amont comprend ce que veut faire le joueur
3. le runtime construit la verite, la memoire projetee et execute
4. l'IA aval raconte le resultat

Et pour construire le contexte, le systeme combine maintenant:

1. le lieu courant
2. la memoire de partie
3. le wiki
4. les entites visibles de la scene
5. l'intent du tour

Le pipeline est donc deja plus qu'un simple prompt narration.
Il devient un moteur de contexte, d'arbitrage et de narration.
