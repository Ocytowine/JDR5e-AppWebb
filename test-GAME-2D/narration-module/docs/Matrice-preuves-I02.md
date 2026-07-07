# Matrice de preuves I-02

Date de revue : 2026-07-06
Contrats : `campaign-bootstrap/2` et `lore-authoring/1`

## Conclusion

Le périmètre autonome du module narration est vérifié. Treize preuves sur quatorze sont exécutables sans UI, cache React, créateur ou moteur tactique. La seule réserve est la comparaison directe avec la projection du plateau tactique : le bootstrap recalcule et vérifie sa propre projection contre le `RuleRegistry` et les catalogues actuels, mais aucun adaptateur de parité intermodule n'est branché, conformément à la décision de différer cette jonction.

Cette réserve empêche de déclarer la gate littérale entièrement fermée. Elle ne bloque pas les travaux narratifs qui ne consomment ni ne modifient l'état tactique.

## Couverture

| # | Preuve exigée | Statut | Preuve exécutable | Limite |
|---:|---|---|---|---|
| 1 | Paquet déterministe et empreinte stable | COUVERT | `narration-module:test:lore` compile le corpus dans deux ordres et compare les résultats. | Aucune. |
| 2 | Rejets wiki : brut non déclaré, doublon, clé inconnue, référence absente | COUVERT | Suites lore : manifeste d'exclusion exhaustif, doublon d'identité, schémas AJV stricts et référence requise absente. | Aucune. |
| 3 | Archives de Lysenthe avec provenance fichier et champ | COUVERT | Le test du corpus réel retrouve l'entité, son descripteur, leurs empreintes et ses fragments adressés par `fieldPath`. | Aucune. |
| 4 | Fiche prête à jouer sans `localStorage` | COUVERT | `narration-module:test:character` injecte une enveloppe et les catalogues actuels dans `importLegacyCharacterV1`; le domaine ne lit aucun cache UI. | L'adaptateur UI futur reste hors périmètre. |
| 5 | Parité import / plateau tactique | RÉSERVE DIFFÉRÉE | L'import recalcule les valeurs et l'orchestration les vérifie par les exécuteurs versionnés; la régression carte reste verte. | Aucune comparaison directe avec un calculateur tactique propriétaire n'est branchée. |
| 6 | Rejets ciblés de l'import | COUVERT | 16 mutations ciblées plus contrôle des propriétés inconnues. | Aucune. |
| 7 | Ruleset, conflit et citations versionnées | COUVERT | `narration-module:test:rules` vérifie manifeste, empreintes, conflits, exécuteurs et `RuleDecisionV1`. | Aucune. |
| 8 | NAR-ACC-008, impossibilité avant jet et coût | COUVERT AU CHECKPOINT I-02 | L'exécuteur `capability-availability` retourne `available: false` et une raison stable avant tout moteur de jet ou commit. | La transaction d'action appartient à un lot ultérieur. |
| 9 | NAR-ACC-009, apparence et inventaire autoritaires | COUVERT AU CHECKPOINT I-02 | L'exécuteur d'apparence exclut les objets rangés, non équipés ou invisibles; l'import expose séparément les projections. | Le commerce transactionnel complet appartient à un lot ultérieur. |
| 10 | NAR-ACC-021, règle maison et arbitrage non promu | COUVERT AU CHECKPOINT I-02 | Priorité explicite par `overrides`; `AdjudicationRecordV1` déterministe, limité à la campagne et sans mutation du registre. | Le rôle IA `rules_adjudicator` reste hors périmètre. |
| 11 | Bootstrap atomique, idempotent et relisible dans IndexedDB | COUVERT | Contrats partagés et scénario Chromium après fermeture/réouverture. | Aucune. |
| 12 | Panne à chaque frontière sans état partiel | COUVERT | Huit points de panne partagés mémoire/IndexedDB. | Aucune. |
| 13 | Issue inconnue et identités originales | COUVERT | Recherche par clé d'idempotence, opération et commit d'origine. | Aucune. |
| 14 | Build global et régressions I-00/I-01 | COUVERT | Build, contrats noyau/bootstrap, Chromium et régression carte. | À rejouer avant chaque livraison. |

## Décision de périmètre

La réserve 5 ne doit pas être contournée par une copie supplémentaire des formules tactiques. Sa levée demandera soit un calculateur partagé faisant autorité, soit un adaptateur de parité en lecture seule. Cette intervention est volontairement différée avec les jonctions créateur et plateau.

La prochaine capacité narrative peut être préparée à condition de conserver cette réserve visible et de ne pas revendiquer une intégration tactique inexistante.
