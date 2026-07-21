# Benchmark live de l'intention sémantique V2

## Objet

Le script `npm run narration-module:benchmark:semantic-intent-v2:openai-live` mesure uniquement `player_intent_interpreter`. Il exclut le performer PNJ, le critique, le writer et la persistance. Les huit cas couvrent cible explicite, ellipse, cible descriptive, approche non verbale, question, signal silencieux, condition et transition de scène.

Le rapport `BENCH_RESULTS` expose, par cas, les contrôles sémantiques, la décision runtime, les tentatives, la latence et les tokens fournisseur. Le processus retourne un code non nul dès qu'un invariant attendu échoue.

## Résultats du 2026-07-21

| Configuration | Qualité | p50 | p95/max | Tokens entrée/sortie | Retry |
|---|---:|---:|---:|---:|---:|
| `gpt-4.1-mini` standard | 6/8 | 5,654 s | 7,574 s | 11 546 / 1 827 | 0 |
| `gpt-5.6-luna`, `none` | 5/8 | 2,234 s | 2,571 s | 13 136 / 2 311 | 0 |
| `gpt-5.6-luna`, `low` | 4/8 | 3,254 s | 9,006 s | 11 507 / 2 759 | 0 |
| `gpt-5.6-terra`, `none` | 5/8 | 2,922 s | 10,092 s | 11 507 / 2 001 | 0 |

La baseline reste inchangée : aucun candidat ne la dépasse en qualité. Les résultats ne justifient pas un changement de modèle, même si Luna `none` montre un potentiel de latence important.

Deux ambiguïtés transversales doivent être traitées dans le contrat générique, sans règle lexicale de scène : distinguer l'approche d'un acteur de la manipulation d'un objet, puis représenter clairement une transition via une ouverture visible sans perdre son référent. Une nouvelle comparaison doit être répétée après cette clarification.

## Configuration

Le serveur accepte `NARRATION_OPENAI_INTENT_MODEL` et `NARRATION_OPENAI_INTENT_REASONING_EFFORT`. L'effort autorisé est `none`, `low`, `medium`, `high`, `xhigh` ou `max`; une valeur absente ou invalide n'ajoute aucun paramètre `reasoning`. Ce réglage est limité à l'interpréteur et n'affecte aucun autre rôle.
