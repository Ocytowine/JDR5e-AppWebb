# Cadrage I-06ZK - Branchement IA du NPC performer

Date : 2026-07-16

Statut : `IMPLEMENTE_DANS_PERIMETRE`

## Objectif

Brancher `npc_performer` sur la route OpenAI serveur existante, après validation du contrat local `npc-performer/1`.

Le rôle doit produire une réaction courte du PNJ visible assigné par `mj_planner`, sans devenir un moteur social, sans révéler de secret et sans créer de conséquence durable.

## Décision

La route serveur `/api/narration/enhance-openai` accepte désormais le rôle `npc_performer` avec le contrat `npc-performer/1`.

En mode OpenAI, la surface narrative configure le contrôleur avec :

- `player_intent_interpreter` via le proxy serveur ;
- `mj_planner` via le proxy serveur ;
- `npc_performer` via le proxy serveur ;
- `scene_writer` via le chemin d'enrichissement visible existant.

Le navigateur ne contacte toujours pas OpenAI directement.

## Garde-fous du branchement

Le schéma serveur impose :

- `durableCommitments=[]` ;
- `revealedRefs=[]` ;
- `safetyConstraints.noMechanicalSuccess=true` ;
- `safetyConstraints.noSecretReveal=true` ;
- `safetyConstraints.noDurableCommitment=true` ;
- `safetyConstraints.noStateMutation=true` ;
- `speechActs[].type` limité à `assertion`, `question`, `refusal` ;
- `speechActs[].epistemicBasis` limité à `known`, `believed`, `uncertain` ;
- `actorId` identique à `task.actorId`.

Une sortie invalide devient un diagnostic rejeté par le pipeline et exposé via `npcPerformanceFailure`. Aucune réplique IA de remplacement n'est inventée.

## Démarche sémantique

`npc_performer` reçoit :

- l'intention structurée ;
- le plan MJ ;
- la résolution bornée ;
- l'état de scène visible ;
- l'acteur assigné.

Il ne reclassifie pas l'intention joueur. Il ne décide pas si une action a réussi. Il joue uniquement le PNJ assigné dans les limites déjà validées.

## Configuration

Variables serveur :

- `NARRATION_OPENAI_LIVE=1` active les appels live ;
- `OPENAI_API_KEY` reste côté serveur ;
- `NARRATION_OPENAI_NPC_PERFORMER_MODEL` peut sélectionner un modèle dédié au performer PNJ ;
- sinon `NARRATION_OPENAI_MODEL`, puis le modèle par défaut serveur, sont utilisés.

## Hors périmètre

- Pas de moteur social mécanique.
- Pas de jets sociaux.
- Pas de mémoire sociale longue.
- Pas de promesse durable.
- Pas de secret ou indice caché révélé.
- Pas d'automatisation multi-tours de PNJ.

## Preuves

- `npm run narration-module:test:narrative-openai-route`
- `npm run narration-module:test:narrative-app-surface`
- `npm run narration-module:test:ai-pipeline`
- `npm run narration-module:build`
- `npm run build`

Cas couverts :

- requête serveur `npc_performer` acceptée avec contrat `npc-performer/1` ;
- schéma strict contenant `durableCommitments.maxItems=0` ;
- modèle dédié `NARRATION_OPENAI_NPC_PERFORMER_MODEL` utilisé si fourni ;
- rejet d'une révélation dans `revealedRefs` ;
- rejet d'un engagement durable dans `durableCommitments` ;
- rejet d'un speech act interdit comme `reveal`.
