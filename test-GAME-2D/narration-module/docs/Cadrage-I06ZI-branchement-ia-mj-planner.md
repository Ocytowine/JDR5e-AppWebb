# Cadrage I-06ZI - Branchement IA du MJ planner

Date : 2026-07-16

Statut : `IMPLEMENTE_DANS_PERIMETRE`

## Objectif

Brancher `mj_planner` sur la route OpenAI serveur existante, sans ouvrir le MJ complet et sans introduire de fallback narratif.

Le but n'est pas de faire décider l'IA. Le but est de lui faire produire un plan structuré non committable à partir de l'interprétation sémantique déjà validée.

## Décision

La route serveur `/api/narration/enhance-openai` accepte désormais le rôle `mj_planner` avec le contrat `mj-planner/1`.

Le navigateur ne contacte toujours pas OpenAI directement. En mode OpenAI, la surface narrative configure le contrôleur avec :

- `player_intent_interpreter` via le proxy serveur ;
- `mj_planner` via le même proxy serveur ;
- `scene_writer` via le chemin d'enrichissement déjà borné.

Le mode local reste inchangé : si le mode OpenAI n'est pas sélectionné, le planner local contractuel reste utilisé.

## Garde-fous du branchement

Le schéma serveur impose :

- `commandProposals[].commitAuthority=false` ;
- `creationProposals=[]` ;
- `revealPlan.reveal=[]` ;
- `timeAdvanceProposal=null` ;
- `planningBasis` aligné avec `task.interpretation.intentId` et `task.interpretation.runtimeHandling` ;
- `forbiddenOutcomes` contenant les interdictions de commit, succès non validé, temps, secret et fait durable.

Une sortie OpenAI invalide devient une sortie `PARTIAL_UNUSABLE` diagnostiquée par la route puis rejetée par le pipeline. Le contrôleur expose alors `mjPlannerFailure`. Il ne fabrique pas de plan de remplacement.

## Démarche sémantique

Le planner IA reçoit `task.interpretation`, dont :

- `semanticIntent.playerGoal` ;
- `coreMeaning` ;
- `target` et `referentResolution` ;
- `commitment` ;
- `runtimeHandling.status` ;
- `runtimeHandling.requiredDomain`.

Les instructions serveur interdisent de repartir d'un déclenchement lexical brut. Le planner doit raisonner sur le sens structuré transmis par l'interpréteur d'intention.

## Configuration

Variables serveur :

- `NARRATION_OPENAI_LIVE=1` active les appels live ;
- `OPENAI_API_KEY` reste côté serveur ;
- `NARRATION_OPENAI_MJ_PLANNER_MODEL` peut sélectionner un modèle dédié au planner ;
- sinon `NARRATION_OPENAI_MODEL`, puis le modèle par défaut serveur, sont utilisés.

## Hors périmètre

- Exécuter les propositions du planner.
- Produire une réponse PNJ.
- Rédiger une prose visible depuis le planner.
- Ouvrir les domaines inventaire, tactique, repos ou monde.
- Créer des faits durables ou des intrigues.

## Preuves

- `npm run narration-module:test:narrative-openai-route`
- `npm run narration-module:test:ai-intent-interpretation`
- `npm run narration-module:test:narrative-resolution`
- `npm run narration-module:build`
- `npm run build`

Cas couverts :

- requête serveur `mj_planner` acceptée avec contrat `mj-planner/1` ;
- schéma strict contenant `commitAuthority=false` ;
- modèle dédié `NARRATION_OPENAI_MJ_PLANNER_MODEL` utilisé si fourni ;
- rejet local d'un plan IA tentant `commitAuthority=true` ;
- rejet local d'un plan IA révélant un élément dans `revealPlan.reveal`.
