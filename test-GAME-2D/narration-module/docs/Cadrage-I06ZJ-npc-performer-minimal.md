# Cadrage I-06ZJ - NPC performer minimal

Date : 2026-07-16

Statut : `IMPLEMENTE_DANS_PERIMETRE`

## Objectif

Ajouter le premier `npc_performer` borné après le `mj_planner`.

Le rôle répond à une limite directe du planner : celui-ci peut dire qu'une réaction PNJ est attendue, mais il ne doit pas jouer le PNJ lui-même. `npc_performer` prend donc une assignation d'acteur et produit une réaction visible courte, structurée et validée.

## Décision

Le contrat minimal actif est `npc-performer/1`.

Le contrôleur appelle `npc_performer` uniquement si :

- le `mjPlan` contient une assignation `role=npc_performer` avec `actorId`;
- l'intention est une parole ou interaction sociale bornée;
- la résolution a déjà appliqué le commit borné de parole joueur;
- aucune clarification ou handoff bloquant n'est en cours.

La sortie acceptée peut remplacer le bloc `NPC_SPEECH` local du paquet visible. Elle ne crée pas de commit supplémentaire.

## Garde-fous

Le validateur impose :

- `durableCommitments=[]`;
- `revealedRefs=[]`;
- `safetyConstraints.noMechanicalSuccess=true`;
- `safetyConstraints.noSecretReveal=true`;
- `safetyConstraints.noDurableCommitment=true`;
- `safetyConstraints.noStateMutation=true`;
- speech acts limités à `assertion`, `question` ou `refusal`;
- bases épistémiques limitées à `known`, `believed` ou `uncertain`.

Le PNJ ne peut donc pas accorder un succès social, révéler un secret, promettre durablement, modifier l'état ou déclencher du temps de jeu.

## Démarche sémantique

`npc_performer` ne décide pas depuis des mots-clés joueur. Il reçoit :

- l'interprétation structurée;
- le plan MJ;
- la résolution bornée;
- l'état de scène visible;
- l'acteur assigné.

La version locale de test produit une réaction déterministe pour prouver le contrat et la continuité courte. La logique IA serveur du rôle reste fermée dans ce lot.

## Diagnostic visible

Les blocs `Notification système` ne doivent pas masquer les écarts entre interprétation, résolution et rendu.

Chaque notification de résolution expose maintenant :

- l'intention structurée et l'action canonique éventuelle;
- la cible résolue;
- le statut runtime et le domaine requis;
- la raison métier du commit, du no-commit ou du handoff;
- l'effet réellement appliqué ou l'absence d'effet.

Ce diagnostic reste un affichage technique de test. Il ne donne aucune autorité métier à l'IA et ne remplace pas les validations.

## Hors périmètre

- Pas de route OpenAI serveur `npc_performer`.
- Pas de moteur social mécanique.
- Pas de mémoire sociale longue.
- Pas de secret, promesse durable, changement d'état ou conséquence.
- Pas d'automatisation multi-tours de PNJ.

## Preuves

- `npm run narration-module:test:ai-pipeline`
- `npm run narration-module:test:narrative-turn-controller`
- `npm run narration-module:test:ai-intent-interpretation`
- `npm run narration-module:test:narrative-resolution`
- `npm run narration-module:build`
- `npm run build`

Cas couverts :

- parole au garde : `mj_planner` assigne `npc_performer`, réaction PNJ visible remplacée par `npcPerformance`;
- deuxième parole au garde : continuité courte conservée;
- approche seule du garde : action locale bornée enregistrée, pas de `npc_performer`, pas de bloc `NPC_SPEECH`, pas de "Parole enregistrée";
- approche reformulée du garde : `je me dirige vers le garde` reste un positionnement local committable même si le résumé IA ne conserve pas le mot-clé exact;
- approche seule de la serveuse puis pronom : `je m'approche de la serveuse` committe une action locale bornée, puis `je lui demande ce qui ne va pas` résout `lui` vers la serveuse et déclenche `npc_performer`;
- approche par descripteur visible : `je m'avance vers la femme` résout la serveuse comme unique PNJ féminin visible, puis `je lui demande comment elle va` conserve cette cible dans le rendu et le `npc_performer`;
- sortie `npc_performer` avec `revealedRefs` rejetée;
- sortie `npc_performer` avec `durableCommitments` rejetée.
