# Matrice de preuves I-06ZM — Planner sémantique et décision runtime locale

Date : 2026-07-17

Statut : `TERMINE_DANS_PERIMETRE`

## Objectif

Faire consommer au `mj_planner` l'objectif porté par `semanticIntent` et retirer à la suggestion IA `runtimeHandling` l'autorité de déclarer un domaine disponible.

## Décision

`runtimeHandling` reste la suggestion structurée de l'interpréteur IA. Le nouveau `runtimeDecision` est calculé localement depuis l'intention sémantique, l'engagement, le domaine demandé et le registre des capacités actuellement ouvertes.

Le registre I-06ZM ouvre uniquement :

- `scene_resolution` pour les tentatives locales bornées;
- `social` uniquement pour une parole adressée sans résultat social mécanique;
- `perception` uniquement sans commit ni temps de jeu;
- les intentions sans engagement comme réponses no-commit.

Inventaire, tactique, repos et monde restent fermés. Leur domaine peut être suggéré par l'IA, mais leur disponibilité est décidée localement.

## Preuves

| Exigence | Preuve |
|---|---|
| planner fondé sur le sens canonique | `planningBasis.semanticGoal` reprend `semanticIntent.playerGoal` |
| indépendance de `coreMeaning` | test avec `playerGoal` et `coreMeaning` volontairement différents |
| décision runtime locale | `NarrativeRuntimeDecisionV1.source = LOCAL_CAPABILITY_REGISTRY` |
| suggestion IA non autoritaire | inventaire annoncé `SUPPORTED` par la fixture IA mais fermé localement |
| divergence traçable | `aiSuggestionMatched=false` et diagnostic affichant suggestion puis décision |
| resolver aligné | handoff calculé depuis `runtimeDecision`, pas `runtimeHandling` |
| planner aligné | statut et domaine du plan issus de `runtimeDecision` |
| lecture legacy | la restauration recalcule `runtimeDecision` si elle manque |

## Vérifications exécutées

```text
npm run narration-module:test:ai-intent-interpretation  OK
npm run narration-module:test:narrative-resolution       OK
npm run narration-module:test:narrative-turn-controller  OK
npm run narration-module:test:ai-pipeline                 OK
npm run narration-module:test:narrative-openai-route      OK
npm run narration-module:test:vertical-quality            OK
npm run narration-module:build                            OK
npm run build                                             OK
```

## Limites conservées

Le domaine demandé provient encore de la suggestion structurée de l'interpréteur. I-06ZM décide seulement si ce domaine est disponible et avec quelle politique de commit. I-06ZN introduira les commandes typées qui permettront au routeur de dériver le domaine depuis une proposition de commande validée.

`action`, les heuristiques lexicales et les références de fixture restent inchangées hors des ajustements strictement nécessaires à I-06ZM.

## Gate de sortie

I-06ZM est terminé dans son périmètre. La prochaine étape autorisée est I-06ZN : séparer formellement intention, décision de routage et commande de domaine typée.
