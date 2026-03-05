# Definition of Done globale - Roadmap et methode

## But du document

Definir une facon rigoureuse de realiser la DoD globale du module narration:

- avec des criteres mesurables
- avec des preuves de conformite
- avec une roadmap executable

Ce document sert de reference d'execution, pas de vision produit.

## Perimetre

La DoD cible couvre:

- boucle complete d'un tour de jeu
- regle `plan -> command`
- runtime journalise et deterministic
- creation d'evenements par declencheur trace
- separation `player_view` / `truth_view`
- non-regression via tests

## Methode (comment faire correctement)

## 1) Transformer la DoD en criteres testables

Chaque item DoD doit etre reformule en condition binaire `PASS/FAIL`.

Exemples:

- "Aucune action irreversible si clarification" devient:  
  `Si requires_clarification = true OU plan.need_clarification non vide ALORS runtime_actions doit etre vide`.
- "Separation player/truth respectee" devient:  
  `Aucun champ truth_view ne doit sortir dans les payloads joueur`.

## 2) Associer une preuve obligatoire a chaque critere

Types de preuve acceptes:

- test unitaire
- test d'integration
- validation schema
- log d'audit runtime

Regle:

- un critere sans preuve est considere non termine

## 3) Imposer des gates CI

Gates minimales:

- validation schemas JSON
- tests unitaires arbitrage/runtime
- tests integration scenarios canon
- verification de format de sortie structuree

Regle:

- merge/release refuse si une gate echoue

## 4) Utiliser une matrice DoD

Format recommande:

- `Critere DoD`
- `Test(s) associe(s)`
- `Preuve attendue`
- `Gate CI`
- `Statut`

Cette matrice devient la source de verite d'avancement.

## 5) Revue release basee sur preuves

Avant release:

- review DoD ligne par ligne
- statut `PASS/FAIL`
- lien vers preuve (test/log)

Pas de validation "a l'impression".

## Roadmap d'execution

## Phase 1 - Cadrage DoD (J1)

Objectif:

- finaliser les criteres binaire pour chaque item DoD

Livrables:

- matrice DoD v1
- liste des preuves attendues

Sortie attendue:

- 100% des criteres DoD ont une definition testable

## Phase 2 - Instrumentation minimale (J2-J3)

Objectif:

- rendre le systeme observable et validable

Travaux:

- tracer `turn_id`, input, plan, runtime_actions, state_before, state_after, output
- ajouter validation schema entree/sortie

Sortie attendue:

- logs auditables disponibles pour tous les tours testes

## Phase 3 - Enforcement regles critiques (J4-J5)

Objectif:

- appliquer les regles de securite logique

Travaux:

- bloquer actions irreversibles en mode clarification
- implementer `plan_mismatch`
- interdire creation d'evenement sans trigger trace

Sortie attendue:

- les tests critiques d'enforcement passent

## Phase 4 - Tests de bout en bout (J6-J7)

Objectif:

- valider la boucle complete avec scenarios canon

Scenarios minimaux:

- entrer dans un lieu accessible
- observer un lieu
- tentative interdite
- intention floue (clarification)

Sortie attendue:

- suite integration verte sur 4 scenarios

## Phase 5 - Stabilisation et gate release (J8-J10)

Objectif:

- verrouiller la qualite avant v1

Travaux:

- corriger ecarts detectes
- activer gates CI bloquantes
- review DoD finale avec preuves

Sortie attendue:

- tous les criteres DoD en `PASS`

## Matrice DoD initiale (proposee)

## Critere 1 - Tour complet execute

- Condition PASS: un tour complet va de l'input a la sortie narrative avec mises a jour memoire
- Preuve: test integration `turn_pipeline_happy_path`
- Gate: integration tests

## Critere 2 - Clarification bloque les actions irreversibles

- Condition PASS: `runtime_actions = []` quand clarification requise
- Preuve: test integration `clarification_no_irreversible_actions`
- Gate: integration tests

## Critere 3 - Runtime journalise avant/apres

- Condition PASS: chaque action runtime possede `state_before` et `state_after`
- Preuve: test + echantillon de logs
- Gate: unit + integration

## Critere 4 - Evenements traces par declencheur

- Condition PASS: tout evenement cree possede `origin_trigger_id` + `created_at_turn`
- Preuve: test integration `event_creation_requires_trigger`
- Gate: integration tests

## Critere 5 - Separation player/truth

- Condition PASS: `truth_view` absent des sorties joueur
- Preuve: test de contrat sortie joueur
- Gate: contract tests

## Critere 6 - Suite minimale de tests verte

- Condition PASS: 4 scenarios canon verts, 0 test critique rouge
- Preuve: rapport CI
- Gate: CI globale

## Rituels de pilotage

- Daily court: avancement par critere DoD (pas par ressenti)
- Fin de phase: mise a jour de la matrice DoD
- Fin de sprint: review PASS/FAIL avec preuves liees

## Anti-patterns a eviter

- valider "a la main" sans test
- ajouter de la subtilite narrative avant de verrouiller les regles
- laisser des champs libres non schemas sur les contrats critiques
- confondre notes joueur et verite systeme

## Resultat attendu

Une v1 qui n'est pas seulement "convaincante en demo", mais:

- reproductible
- testable
- debuggable
- stable en continuite narrative et systemique
