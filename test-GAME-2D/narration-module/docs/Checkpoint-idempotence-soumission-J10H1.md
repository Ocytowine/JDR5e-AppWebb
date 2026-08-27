# Checkpoint J10-H1 — idempotence de soumission

Date : 2026-08-26

Statut : `FERMÉ`

## Résultat

La création du `clientRequestId` appartient désormais à un coordinateur
synchrone situé derrière la surface narrative. Le formulaire transmet seulement
la saisie : deux événements rapprochés rencontrent le même verrou avant qu'un
second identifiant puisse être fabriqué.

Le coordinateur conserve le payload exact dans le stockage de session jusqu'à
la fin du rendu. Un rechargement reprend le même `clientRequestId`. Une erreur
avant la présentation finale rend la soumission rejouable avec cette même
identité ; une terminaison complète retire la reprise et libère le verrou.
Cette comparaison est strictement identitaire et ne constitue aucune
interprétation locale des mots du joueur.

## Preuves

```powershell
npm run narration-module:test:j10h1-submission
npm run build
```

La gate H1 certifie :

- double clic synchrone ;
- soumission clavier répétée ;
- soumission clavier suivie d'un clic ;
- rechargement pendant le vol avec reprise du même identifiant ;
- libération après erreur et rejeu du même identifiant ;
- absence d'augmentation de la dette lexicale ;
- compatibilité des surfaces React et build global.

La recette navigateur exécute cinq tests et ne contacte pas OpenAI.

## Frontière

H1 ne modifie ni le sens produit par V8, ni le routage, ni les propriétaires,
ni le focus conversationnel. À sa fermeture, trois écarts restaient mesurés :
le timeout du planner, l'absence de focus actif persistant et les contradictions
de fidélité entre le cadre V8 et les projections historiques. H2 a depuis fermé
le second.

La prochaine étape est J10-H2 : `local-interaction-focus/1`.
