# Cadrage I-06ZH - MJ planner minimal

Date : 2026-07-16

Statut : `IMPLEMENTE_DANS_PERIMETRE`

## Objectif

Introduire un premier `mj_planner` sans ouvrir le MJ complet.

Le rôle doit transformer une intention déjà interprétée en plan structuré de protocole :

- quel mouvement de scène est envisagé ;
- quel domaine propriétaire serait nécessaire ;
- quels rôles IA pourraient intervenir ensuite ;
- quand rendre la main au joueur ;
- quels résultats restent explicitement interdits.

Le plan n'est ni une prose visible, ni une résolution, ni une mutation.

## Décision

Le contrat minimal actif est `mj-planner/1`.

Le planner reçoit l'interprétation structurée du joueur, dont `runtimeHandling`, et produit :

- `planningBasis` : intention source, but sémantique, statut runtime et domaine requis ;
- `sceneBeats[]` : mouvements immédiats bornés (`ACTOR_REACTION_EXPECTED`, `LOCAL_ACTION_ATTEMPT`, `DOMAIN_BLOCKED`, etc.) ;
- `commandProposals[]` : propositions adressées aux domaines, toujours `commitAuthority=false` ;
- `actorAssignments[]` : rôles qui pourraient être appelés ensuite, sans exécution automatique ;
- `revealPlan` : aucune révélation directe dans ce lot ;
- `timeAdvanceProposal=null` dans ce lot ;
- `playerHandoff` : point d'arrêt ou restitution au joueur ;
- `forbiddenOutcomes[]` : succès non validé, commit direct, secret, temps ou fait durable.

## Garde-fous

- Le planner ne commite rien.
- Le planner n'affiche aucun texte au joueur.
- Le planner ne crée aucune intrigue dynamique.
- Le planner ne crée aucune entité persistante.
- Le planner ne révèle aucun secret.
- Le planner ne résout ni inventaire, ni tactique, ni repos, ni monde.
- Le planner ne remplace pas `scene_writer`, `npc_performer`, `rules_adjudicator` ou les domaines propriétaires.

## Démarche sémantique

Le planner local de test construit son plan depuis `NarrativeIntentInterpretationV1` et `runtimeHandling`, pas depuis une compréhension lexicale du texte brut.

Les heuristiques lexicales restantes appartiennent aux ceintures legacy du resolver ou aux fixtures locales existantes. Elles ne doivent pas devenir le moteur de planification.

## Preuves

- `npm run narration-module:test:ai-intent-interpretation`
- `npm run narration-module:test:narrative-resolution`
- `npm run narration-module:test:ai-pipeline`
- `npm run narration-module:build`

Cas couverts :

- parole adressée au garde : plan `ACTOR_REACTION_EXPECTED`, assignment `npc_performer`, aucune autorité de commit ;
- action locale sur porte visible : plan `LOCAL_ACTION_ATTEMPT`, succès narré non validé interdit ;
- intention d'inventaire non ouverte : plan `DOMAIN_BLOCKED`, domaine requis conservé, aucune création.

## Suite logique

Le prochain élargissement possible n'est pas encore le MJ complet.

Options cohérentes :

- brancher le planner à la route OpenAI serveur après schéma strict ;
- ajouter un validateur de cohérence du plan contre les domaines ouverts ;
- ouvrir un mini `npc_performer` borné pour réactions PNJ non mécaniques ;
- ouvrir un premier domaine propriétaire minimal si le blocage produit devient plus fort que la planification.
