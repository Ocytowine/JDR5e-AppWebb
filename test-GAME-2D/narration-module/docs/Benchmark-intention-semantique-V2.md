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

## Gate Luna après clarification du contrat

Trois passages du 2026-07-22 ont obtenu 8/8, 8/8 puis 7/8, soit 23/24 sans retry. Les p95 étaient 4,907 s, 2,883 s et 18,218 s. L'unique écart était la perte de la condition explicite dans « Si la porte paraît sûre, j'essaie de l'entrouvrir » : cible, nature et routage restaient corrects, mais `commitment` devenait `committed`.

Le contrat transporte désormais `preconditions`. L'adaptateur stabilise une proposition `committed` en `conditional` lorsque cette liste est non vide. La prochaine gate doit confirmer trois passages Luna consécutifs à 8/8 avec cette précondition conservée.

La gate suivante obtient 7/8, 7/8 et 8/8, p95 respectifs 2,685 s, 3,436 s et 4,093 s, sans retry. La précondition est correcte 3/3. Les deux seuls écarts viennent de transitions reconnues mais dont l'étiquette `contextLink` empêchait la résolution locale de destination. Le résolveur ne dépend désormais plus de cette étiquette pour `traverse_visible_boundary`; une relation publique unique reste obligatoire.

## Certification finale Luna

La dernière série du 2026-07-22 valide trois passages consécutifs à 8/8, soit 24/24 décisions correctes sans retry.

| Passage | Qualité | p50 | p95/max | Tokens entrée/sortie |
|---|---:|---:|---:|---:|
| 1 | 8/8 | 2,724 s | 3,761 s | 15 674 / 2 329 |
| 2 | 8/8 | 2,207 s | 2,633 s | 15 674 / 2 345 |
| 3 | 8/8 | 2,279 s | 2,846 s | 15 674 / 2 366 |

Décision : `gpt-5.6-luna` avec `reasoning=none` est certifié pour le seul rôle `player_intent_interpreter`. Les modèles de prose et les pipelines ennemis restent indépendants.

## Contrôle après correctifs des scènes dynamiques — 2026-07-23

Trois passages supplémentaires avec `gpt-5.6-luna/none` donnent `7/8`, `8/8`, puis `8/8`, soit 23/24 décisions correctes sans retry.

| Passage | Qualité | p50 | p95/max | Tokens entrée/sortie |
|---|---:|---:|---:|---:|
| 1 | 7/8 | 2,368 s | 3,791 s | 16 234 / 2 374 |
| 2 | 8/8 | 2,400 s | 2,955 s | 16 234 / 2 341 |
| 3 | 8/8 | 2,203 s | 4,080 s | 16 234 / 2 336 |

Agrégat des 24 appels : 23/24, p50 2,368 s, p95 3,832 s, maximum 4,080 s, 48 702 tokens d'entrée, 7 051 tokens de sortie et zéro retry. L'unique écart reconnaît correctement `traverse_visible_boundary` et `UNSUPPORTED_DOMAIN`, mais omet ponctuellement la cible `poi:back-room-door`. Les deux répétitions suivantes conservent cette cible.

Décision : la configuration reste la baseline interactive, mais cette série ne renouvelle pas à elle seule la gate stricte de trois passages consécutifs à 8/8. Aucun changement de modèle n'est justifié par cette mesure.
