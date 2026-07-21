# Matrice de recette — conversations PNJ et scène complète NAR-132

Date : 2026-07-21

Statut : `GATE_DETERMINISTE_OK_LIVE_V2_SEMANTIQUE_OK_LATENCE_INSTABLE`

## Objectif

Cette gate confronte NAR-129 à NAR-131 à une séquence continue plutôt qu'à des tours isolés. Elle ne crée ni mémoire sociale longue, ni autonomie PNJ, ni transition de scène effective.

## Parcours automatisé

| Tour | Entrée | Oracle principal |
|---|---|---|
| 1 | saluer la serveuse | `INITIATE_CONVERSATION`, locuteur serveuse |
| 2 | question elliptique avec `lui` et mention de porte | la cible reste la serveuse, pas la porte |
| 3 | seconde question explicite à la serveuse | troisième couple intention-réponse persistable |
| 4 | approche du garde | aucune parole PNJ automatique |
| 5 | saluer le garde | nouvelle mémoire isolée, locuteur garde |
| 6 | question sur sa douleur | cible garde |
| 7 | répétition sémantique | deux couples antérieurs fournis au performer |
| 8 | retour explicite à la serveuse | trois répliques antérieures de la serveuse, aucune du garde |
| 9 | tentative d'entrer dans l'arrière-salle | handoff `world`, aucun commit ni faux changement de scène |
| 10 | reprise avec le garde | conversation immédiatement disponible, aucun `campaign-busy` |

## Résultats

- 10 tours exécutés ;
- 2 PNJ alternés ;
- 1 handoff de transition refusée proprement ;
- reprise après handoff validée ;
- projections finales enregistrées puis reconstruites ;
- couples intention-réponse isolés par acteur ;
- mémoire courte corrigée de cinq entrées globales à cinq entrées par acteur, avec borne globale de dix dans cette scène à deux PNJ ;
- salutation locale corrigée : elle ne devient plus automatiquement une question ;
- résolution locale d'une parole corrigée : un mot appartenant au contenu de la question ne choisit plus la cible avant que la nature « parole » soit établie.

Commande : `npm run narration-module:test:complete-conversations`.

## Limite et gate suivante

Cette recette utilise les fournisseurs contractuels locaux pour prouver déterminisme, persistance, ciblage, isolation et reprise. Elle ne certifie pas la qualité stylistique ou la latence du fournisseur réel.

La recette manuelle [`Recette-manuelle-post-I06ZR.md`](Recette-manuelle-post-I06ZR.md) reste à exécuter en mode OpenAI. Elle doit être prolongée par les dix tours ci-dessus ou par un parcours équivalent, en conservant les diagnostics de temps et les couples visibles.

## Exécution OpenAI live du 2026-07-21

Commande : `npm run narration-module:test:complete-conversations:openai-live`.

- durée totale : 328,8 s pour dix tours ;
- 8 tours entièrement acceptés sur 10 lors du parcours continu ;
- ciblage, changement de PNJ, isolation de la mémoire et répétition cohérente validés sur les tours acceptés ;
- temps d'interprétation observé : 14,2 à 30,0 s ;
- temps performer, critique inclus quand requis : 9,4 à 22,2 s ;
- tours 9 et 10 du premier passage interrompus par la borne effective de 30 s de l'interpréteur ;
- replay ciblé : tour 10 accepté en 41,9 s ; tour 9 rejeté comme `OPENAI_OUTPUT_INCOMPLETE` avec un budget de 1 200 tokens.

Correctifs confirmés pendant la recette : le client HTTP applique désormais réellement le timeout du contrat, le performer n'impose plus une valeur cachée de 1 s, et l'acte de dialogue canonique est stabilisé localement pour ne pas dépendre de la variation du fournisseur.

La gate live reste ouverte. La prochaine action n'est pas d'allonger encore le timeout : il faut réduire le contrat de sortie du `player_intent_interpreter` ou scinder sa projection legacy afin que la tentative de transition du tour 9 tienne dans un budget raisonnable, puis rejouer les dix tours.

## Migration V2 du 2026-07-21

Le contrat compact [`Contrat-intention-semantique-V2.md`](Contrat-intention-semantique-V2.md) retire de la sortie IA les projections runtime, legacy, commit et temps. La recette complète descend à 269,2 s et conserve la cohérence des conversations. Le handoff du tour 9 est obtenu lors de deux replays ciblés, mais un troisième replay atteint encore le timeout de 30 s. La gate sémantique est correcte; la stabilité fournisseur reste à résoudre avant fermeture.
