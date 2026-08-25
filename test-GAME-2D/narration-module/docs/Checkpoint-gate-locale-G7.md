# Checkpoint — gate locale G7

Date : 2026-08-25

Statut : `FERMÉ`

## Résultat

La configuration produit demande désormais `ai-intent-semantic/8`. Le
contrôleur conserve le cadre OpenAI V8 comme source sémantique publique et
projette uniquement une composante déjà routée par G5 vers les ports V1 encore
installés.

Le pont `open-semantic-legacy-owner-adapter/1` :

- ne reçoit ni ne relit la saisie brute du joueur ;
- transmet au propriétaire le `meaning` de la composante OpenAI ;
- conserve le couple exact `capabilityId`/domaine et les références publiques ;
- possède une autorité interne dédiée, validée séparément de la projection V8
  publique et des anciennes intentions lexicales ;
- ne s'ouvre que pour une unique étape `ROUTABLE`, comprise, suffisamment
  confiante et sans étape bloquante ;
- laisse toute composition multi-opérations sans coordinateur natif en attente,
  sans appel propriétaire, commit ni temps.

La phrase originale reste disponible uniquement pour la présentation
`RAW_INPUT`. Le planificateur, l'interprète PNJ et les propriétaires reçoivent
la projection sémantique lorsqu'un adaptateur V8 existe. Une demande adressée à
un PNJ ordinaire ne court-circuite plus le planificateur comme si sa cible était
un compagnon actif.

Une correction postérieure issue de la recette UI G8 aligne aussi les
références des acteurs visibles sur le registre de scène et publie séparément
l'approche d'un acteur, l'interaction avec un objet et le signal non verbal.
La régression rejoue exactement « je m'approche du clerc » avec un clerc ambiant
et vérifie la cible, `move_near_visible_actor`, le commit local et la narration
MJ. La projection joueur masque la notice technique par sa provenance typée,
tandis qu'une narration finale OpenAI acceptée demeure le rendu visible.

## Preuves locales

- `npm run narration-module:test:open-semantic-ui-g7` : adaptateur pur,
  contrôleur, configuration produit V8 et vraie surface React dans Chrome ;
- `npm run narration-module:test:open-semantic-corpus-g6` : 24 cas, passages
  contrôleur et Chromium toujours verts après activation des propriétaires ;
- gates G0 à G5, autorité d'intention, routage runtime, résolution, contrôleur,
  React, voyage J10-B et compagnons J10-C : vertes ;
- `npm run narration-module:test:player-public-context` : réponse publique et
  mémoire contextuelle de nouveau vertes avec fixture explicitement injectée ;
- `npm run build` et `git diff --check` : verts.

Aucun appel OpenAI live n'a été lancé et aucune dépense distante n'a été
engagée. Le fournisseur simulé répond par correspondance exacte de fixture et
n'appartient pas au chemin produit.

## Limite conservée

G7 n'implémente pas encore le coordinateur natif capable d'exécuter plusieurs
composantes ordonnées ou simultanées sur plusieurs domaines. Leur sens reste
conservé intégralement, mais leur exécution est suspendue en sécurité. Cette
limite doit être mesurée dans la recette live avant d'ouvrir un lot d'exécution
multi-opérations distinct.

## Suite

G8 est la prochaine étape. Elle reste conditionnée à un nouvel accord explicite
du propriétaire du projet, car elle déclenche une recette OpenAI live et donc
une dépense distante.
