# Matrice de preuves I-06R — corrections qualité issues du scénario vertical

Date : 2026-07-08
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06R corrige uniquement les défauts mesurés par I-06Q, sans ouvrir de nouveau moteur de scène, de PNJ ou de mémoire sociale générique.

## Corrections livrées

| Défaut I-06Q | Correction I-06R |
|---|---|
| `Est-ce que je peux parler au garde ?` était classé `meta_question`. | Les questions de possibilité sociale sont classées `possibility_query`, sans parole exécutée ni commit. |
| `Où sommes-nous exactement ?` restait une réponse hors fiction trop pauvre. | La scène répond avec une localisation contextualisée dans l'Auberge du Seuil, sans commit et sans temps de jeu. |
| Une parole à la serveuse réutilisait la logique du garde. | Le rendu cible maintenant `Serveuse nerveuse` et la mémoire courte enregistre le PNJ ciblé. |
| Le test vertical documentait les écarts mais ne les verrouillait pas. | `narration-module:test:vertical-quality` vérifie désormais les comportements corrigés. |

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:vertical-quality` | Vérifie la classification sociale, la localisation contextualisée et la réponse/mémoire de la serveuse. |
| `npm run narration-module:test:narrative-turn-controller` | Confirme que le contrôleur et la mémoire courte du garde restent stables. |
| `npm run narration-module:test:ai-narrative-enhancement` | Confirme que l'enrichissement IA borné reste compatible avec les nouveaux blocs. |
| `npm run narration-module:test:narrative-app-surface` | Confirme que la surface app reste séparée et stable. |
| `npm run narration-module:build` | Valide le typage du module narration. |

## Limites assumées

- La distinction PNJ reste codée pour la scène de référence, pas généralisée.
- La localisation contextualisée reste une réponse sûre de scène, pas un système de navigation.
- Le live OpenAI reste opt-in manuel; le test automatique utilise toujours un mode OpenAI-compatible simulé.
- I-06S reste fermé : aucun contrat `playable-scene-state/1` générique n'est introduit.

## Décision

I-06R est clos dans son périmètre. La prochaine étape autorisée est I-06S : généralisation légère de scène, à condition de rester minimale et pilotée par le comportement validé en I-06Q/I-06R.
