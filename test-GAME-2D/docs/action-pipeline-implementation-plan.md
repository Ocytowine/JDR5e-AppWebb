# Plan d'implementation (pipeline complet D&D 2024)

Ce plan detaille les correctifs et l'ordre d'integration pour un pipeline complet.

## 1) Stabiliser la taxonomie

1. Creer/valider la taxonomie complete (operations, hooks, conditions, outcomes).
2. Documenter les conventions de JSON (schemas et exemples).
3. Fixer la compatibilite ascendante (adapter de compatibilite).

## 2) Etendre les types

1. Etendre ActionSpec/FeatureSpec/Hook/Operation avec tous les cas D&D 2024.
2. Ajouter ResolutionSpec pour:
   - attack
   - save
   - check
   - contested (fait)
3. Ajouter Outcome enrichi:
   - hit/miss/crit
   - saveSuccess/saveFail
   - checkSuccess/checkFail (fait)
   - contestedWin/contestedLose (fait)

## 3) Transaction et interruption

1. Transaction preview -> commit.
2. Hooks "beforeCommit" et "onInterrupt".
3. Rollback safe si interruption (reaction/contre-sort).

## 4) Executor complet (ops + hooks)

1. Implementer toutes les operations de la taxonomie.
2. Implementer toutes les conditions.
3. Ajouter la gestion des prompts (UI ou auto-policy).
4. Ajouter le moteur de hooks:
   - collectHooks
   - applyHooks
   - phases taxo completes (done)
   - priorities si conflits

## 5) Support des ressources

1. Consommation d'actions/bonus/reactions.
2. Slots de sorts avec niveaux.
3. Ressources classe (ki, rage, etc).
4. Charges d'objets.

## 6) Concentration et durations

1. StartConcentration/BreakConcentration.
2. Timer multi-turn (start/end).
3. Re-evaluation des auras et zones.

## 7) Targets et zones

1. Multi-cibles et selection.
2. AOE shapes (cone/line/rect/circle).
3. Surfaces persistantes.

## 8) Migration progressive

1. Migrer actions simples: melee, ranged, move.
2. Migrer un sort de save (half damage).
3. Migrer une aura ou zone persistante.
4. Migrer une reaction complexe (interrupt).
5. Migrer features (passives + hooks).

## 9) Tests (couverture D&D 2024)

1. Hit/miss/crit + advantage/disadvantage.
2. Save success/fail + half damage.
3. Contest check (grapple, shove).
4. Reaction interrupt (counterspell-like).
5. Concentration break on damage.
6. Aura + zone persistante.
7. Feature "once per turn".
8. Immunities/resistances/vulnerabilities.

## 10) Validation finale

1. Comparer resultats pipeline V2 vs existant (actions migrees).
2. Verifier les logs et event journal.
3. Verifier l'UI (planning action + reactions).

## Livrables

1. Taxonomie complete (docs/action-pipeline-taxonomy.md).
2. Plan d'implementation (ce document).
3. Schémas JSON valides.
4. Tests unitaires + integration.
