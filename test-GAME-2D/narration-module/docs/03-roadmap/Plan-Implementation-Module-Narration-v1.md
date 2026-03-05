# Plan d'implementation module narration v1 (bout en bout)

## Objectif

Construire une v1 executable du module narration avec:

- contrat d'entree et de sortie valides
- regle `plan -> command` enforcee
- runtime deterministic
- memoire persistante exploitable
- moteur d'evenements avec declencheurs traces
- tests d'integration sur scenarios narratifs

## Cadre de livraison (2 semaines)

- Duree: 10 jours ouvres
- Cible: prototype v1 testable de bout en bout
- Priorite: fiabilite systeme avant richesse narrative

## Definition of Done globale

- un tour complet fonctionne: input joueur -> interpretation -> plan -> runtime -> memoire -> sortie narrative
- aucune action irreversible si `requires_clarification = true` ou `plan.need_clarification` non vide
- toute action runtime est journalisee avec etat avant/apres
- les evenements ne naissent que via un declencheur explicite
- la separation `player_view` / `truth_view` est respectee
- la suite de tests minimale passe

## Semaine 1

### Jour 1 - Schemas et contrats

- Definir `schema_version` pour tous les contrats
- Ecrire les schemas JSON: `input_contract`, `output_contract`, `plan`, `runtime_action`, `actor_updates`, `memory_units`
- Ajouter validation stricte des payloads

Livrables:

- dossier `schemas/` versionne
- validateurs utilitaires

Critere d'acceptation:

- un payload invalide est rejete avec erreurs explicites

### Jour 2 - Regles d'arbitrage minimales

- Implementer classifieur d'intention v1 (liste fermee)
- Implementer regles de conversion `intent -> plan`
- Implementer regles de conversion `plan -> runtime_actions`

Livrables:

- module `arbitration/` testable

Critere d'acceptation:

- intents ambigus basculent en clarification

### Jour 3 - Enforcement plan avant commande

- Regle dure: si clarification requise, aucune action irreversible
- Controle `plan_mismatch`
- Codes d'erreur normalises

Livrables:

- middleware de verification pre-runtime

Critere d'acceptation:

- une commande incompatible est rejetee systematiquement

### Jour 4 - Runtime command bus

- Definir le registre de commandes minimales
- Implementer preconditions, effets, cout temporel, logs
- Retour standardise de resultat d'execution

Livrables:

- module `runtime/commands`
- journal d'execution

Critere d'acceptation:

- commandes deterministes et replayables

### Jour 5 - Memoire v1 (stockage + projection)

- Modele de stockage: `events`, `relations`, `knowledge`, `world_overrides`
- Fusion hierarchique: `local > partie > wiki`
- Projection memoire pour l'entree de tour

Livrables:

- module `memory/`
- API de lecture/ecriture

Critere d'acceptation:

- la projection reste concise et contextuelle

## Semaine 2

### Jour 6 - Moteur d'evenements et declencheurs

- Creer le registre de declencheurs
- Interdire creation d'evenement sans trigger trace
- Implementer cycle de vie `actif/pertinent/dormant/archive`

Livrables:

- module `events/engine`

Critere d'acceptation:

- chaque evenement a `origin_trigger_id` et `created_at_turn`

### Jour 7 - Fragments et revelations

- Implementer fragments `ponctuel/persistant/evolutif`
- Regles de revelation partielles compatibles avec la verite fixe
- Lien fragments <-> event final

Livrables:

- sous-module `events/fragments`

Critere d'acceptation:

- pas de contradiction entre fragments joues et final d'evenement

### Jour 8 - Generation de sortie narrative robuste

- Construire le pipeline de sortie structuree final
- Integrer `player_facing_text`, `mj_notes`, `hidden_truth_updates`
- Garantir coherence avec resultat runtime reel

Livrables:

- module `narration/output_builder`

Critere d'acceptation:

- aucune phrase n'affirme un effet non valide par runtime

### Jour 9 - Tests d'integration

- Ecrire tests sur cas standards: entree lieu, observation, interdit, ambigu
- Ecrire tests sur scenario enquete (port/archives)
- Ajouter tests de non-regression

Livrables:

- suite `tests/integration`

Critere d'acceptation:

- pipeline complet vert sur tous les cas v1

### Jour 10 - Observabilite et hardening

- Ajouter logs tour par tour + diff d'etat
- Ajouter metriques latence/erreurs/clarifications
- Corriger points critiques ouverts

Livrables:

- tableau de bord de logs minimal
- checklist de release v1

Critere d'acceptation:

- diagnostic rapide possible sur une incoherence en moins de 5 minutes

## Backlog technique immediat apres v1

- scoring de projection memoire plus fin
- extension taxonomie d'intentions
- meilleur ranking des fragments selon importance narrative/systemique
- outils MJ de correction manuelle securisee
- tests de charge multi-tours

## Risques et parades

- Risque: sur-complexification trop tot
- Parade: geler le scope v1 et deferer les subtilites

- Risque: fuite entre texte libre et verite systeme
- Parade: imposer mises a jour verite via structures valides + verification runtime

- Risque: contexte trop lourd et cout token excessif
- Parade: projection memoire contrainte avec budget max

- Risque: divergence comportement IA
- Parade: prompts stables + parsing strict + retries limites

## Checklist de demarrage dev

- choisir stack validation schema (AJV/Zod/Pydantic)
- choisir stockage memoire (SQLite ou Postgres)
- fixer format de logs d'audit
- nommer les IDs stables (`event_id`, `fragment_id`, `turn_id`, `trigger_id`)
- definir 4 scenarios de reference pour tests automatiques

