# Matrice de preuves I-06ZB — Variation contrôlée et continuité locale

Date : 2026-07-09

Statut : `IMPLEMENTE_DANS_PERIMETRE`

## Objectif

Réduire l'effet de répétition mécanique dans les réponses visibles courtes, sans modifier la vérité de scène, l'horloge, les commits métier ou l'autorité IA.

Le lot traite la variation comme une couche de présentation. Elle ne crée pas de nouveaux faits.

## Périmètre livré

- Variation locale déterministe des réponses météo.
- Variation locale déterministe des rappels de perception générale.
- Variation locale déterministe des réponses sur le type de bâtiment.
- Conservation des faits stables : Auberge du Seuil, pluie, garde blessé, serveuse nerveuse, porte du fond.
- Aucune mutation d'état, aucun temps de jeu, aucun résultat social ou tactique.
- Preuve automatique dédiée `scene-controlled-variation/i06zb`.

## Règles appliquées

- Deux opérations distinctes peuvent produire une formulation différente pour la même question.
- Les variantes doivent rester compatibles avec la même scène visible.
- Les variantes ne peuvent pas masquer une absence de donnée en inventant un événement.
- Les questions hors-fiction/règles restent hors narration fictionnelle.
- La continuité PNJ existante reste portée par la mémoire courte déjà introduite en I-06P/I-06O.

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:scene-controlled-variation` | OK |
| `npm run narration-module:test:scene-playable-quality` | OK |
| `npm run narration-module:test:narrative-app-surface` | OK |
| `npm run narration-module:test:narrative-turn-controller` | OK |
| `npm run narration-module:build` | OK |

## Retour manuel du 2026-07-09

Constat : la première implémentation variait par `operationId`, mais deux questions identiques en UI pouvaient retomber sur la même variante. Le comportement était donc techniquement valide mais insuffisant côté produit.

Correction appliquée :

- la surface UI applique maintenant une variante de présentation avant persistance de la projection;
- la variante dépend du nombre de réponses de contexte déjà visibles, pas seulement du hash de l'opération;
- la projection finale trace `presentation-variant:<index>`;
- le test `narrative-app-surface` vérifie que ce branchement UI reste présent.

## Limite volontaire

La variation reste locale et déterministe. Elle utilise seulement un compteur court de réponses de contexte visibles, pas encore un résumé conversationnel complet. Cette limite évite d'ouvrir prématurément un `mj_planner` ou une mémoire narrative longue.

La prochaine amélioration logique serait de transmettre au `scene_writer` un historique visible très court pour varier le style avec OpenAI, tout en conservant les mêmes validations locales.
