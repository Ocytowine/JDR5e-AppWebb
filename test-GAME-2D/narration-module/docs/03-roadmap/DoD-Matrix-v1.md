# DoD Matrix v1

## Scope

Phase 1 (J1): criteres DoD convertis en regles testables + preuves associees.

## Matrix

| DoD ID | Critere | Regle PASS/FAIL | Preuve requise | Gate |
|---|---|---|---|---|
| DOD-01 | Tour complet execute | Le pipeline retourne un output structure complet depuis un input valide | Test integration `turn_pipeline_happy_path` | `tests/integration` |
| DOD-02 | Clarification bloque l'irreversible | Si `requires_clarification=true` ou `plan.need_clarification` non vide, alors `runtime_actions=[]` | Test contract `output_clarification_rule` | `tests/contracts` |
| DOD-03 | Runtime journalise | Chaque action runtime porte un etat avant/apres | Test integration + logs echantillons | `tests/integration` |
| DOD-04 | Trigger obligatoire pour evenement | Tout nouvel evenement a `origin_trigger_id` et `created_at_turn` | Test integration `event_trigger_enforced` | `tests/integration` |
| DOD-05 | Separation player/truth | Aucune donnee `truth_view` dans la sortie joueur | Test contract `player_output_no_truth_view` | `tests/contracts` |
| DOD-06 | Suite minimale verte | 4 scenarios canon verts, 0 test critique rouge | Rapport CI | `ci` |

## Phase 1 Status

- DOD-02: ready (schema + contract tests)
- DOD-05: ready (contract tests)
- DOD-01: ready (turn trace integration test)
- DOD-03: ready (state_before/state_after + trace log)
- DOD-04: ready (event trigger enforcement integration test)
- DOD-06: ready (4 scenarios canon branches en integration + gate CI dedie)
