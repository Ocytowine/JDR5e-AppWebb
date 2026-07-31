# Contrat de gate réaliste sémantique V5

Date : 2026-07-28

Statut : `IMPLEMENTE_GATE_LIVE_VALIDEE`

## Objectif

Prouver qu'un parcours de joueur conserve son sens et ses autorités entre
plusieurs tours. Les tests unitaires V3, V4 et V5 restent nécessaires, mais ils
ne détectent pas seuls une perte de focus, une cible recyclée après un
éloignement ou une transition qui réutilise l'ancienne scène.

Cette gate ne définit pas une nouvelle version du contrat d'intention. Elle
assemble les contrats existants dans un scénario transversal.

## Parcours déterministe

La gate de référence enchaîne :

1. observation générale de la scène ;
2. approche d'un PNJ suivie d'une question ;
3. question de suivi avec un référent récent ;
4. parole suivie d'un éloignement ;
5. nouvelle parole pronominale après libération du focus ;
6. changement explicite d'interlocuteur ;
7. franchissement d'une frontière visible ;
8. observation de la scène destination.

Une preuve complémentaire recrée ensuite le contrôleur sur le même repository,
restaure le fil et soumet une reprise pronominale du dernier focus encore
valide.

## Oracles

- Une observation générale ne demande ni cible artificielle ni parole PNJ.
- L'approche est rendue avant la réponse du PNJ.
- Un référent `RECENT_FOCUS` ne résout que vers un focus encore conservé.
- Un `proposedRef` fourni par l'IA ne peut pas recréer un `RECENT_FOCUS` libéré ;
  il doit correspondre à un focus local encore valide.
- `REPOSITION_AWAY` rend l'éloignement après la réponse et libère le focus.
- Une référence pronominale après cette libération produit une clarification,
  sans parole ni commit compensatoire.
- Une intention structurée à confiance faible conserve son sens partiel et
  devient une clarification locale ; elle n'est pas reclassée en panne IA.
- Une cible explicite valide remplace l'ancien interlocuteur.
- Une transition utilise le référent de frontière validé, avance le temps une
  seule fois et publie la scène destination.
- Le tour suivant est interprété et rendu depuis la nouvelle scène.
- Le fil restauré reconstruit aussi le contexte sémantique récent ; le focus ne
  dépend pas uniquement de la mémoire JavaScript de l'ancien contrôleur.
- Le paquet expose les capacités publiques raccordées sans permettre à
  l'interpréteur d'en décider l'autorisation ou le résultat.
- Le paquet expose seulement les références personnage autorisées ; un alias
  partagé non précisé devient une clarification locale sans commit ni temps.
- Les blocs MJ ne contiennent ni clés techniques ni noms de composantes.
- Chaque sortie expose les durées contrôleur par étape ; la recette OpenAI
  complète ces mesures avec la télémétrie fournisseur par rôle.

## Indépendance aux formulations

Les fixtures déterministes représentent la sortie structurée attendue du modèle.
Elles ne permettent aucun routage lexical local. La recette OpenAI emploie des
phrases naturelles et accepte une prose variable tant que l'empreinte
fonctionnelle reste la même.

Changer une formulation ne doit pas changer :

- la famille sémantique ;
- la cible résolue ;
- l'ordre des composantes ;
- la disposition de commit et de temps ;
- la scène active après transition.

## Critères de sortie du lot 1

- gate déterministe transversale verte ;
- corpus OpenAI couvrant au minimum observation, composition, focus,
  interlocuteur et transition ;
- métriques séparées pour interpréteur, performer, writer et critic lorsqu'ils
  sont appelés ;
- aucun fallback silencieux ni révélation non autorisée ;
- régressions ciblées et build global verts.

## Validation du 2026-07-28

- `npm run narration-module:test:semantic-v5-realistic-gate` valide huit tours,
  la clarification à confiance faible, le rejet d'un focus recréé par
  `proposedRef`, le changement d'interlocuteur et la transition.
- `npm run narration-module:test:ai-intent-interpretation` recrée un contrôleur
  et prouve la restauration du contexte sémantique avant une reprise
  pronominale.
- La recette Archives composée valide quatre interprétations, trois performances
  PNJ, une clarification sans performer et une reprise explicite.
- Mesures réseau observées : interpréteur moyenne 3,05 s, performer moyenne
  12,8 s, critique conditionnel 4,3 s.
- La recette pronominale isolée confirme qu'une référence sans focus produit un
  bloc `CLARIFICATION`, sans panne IA ni appel PNJ.
- `npm run narration-module:test:transition-ui:openai-live` valide l'entrée,
  l'observation, l'approche de la lampe, l'examen borné des traces et le retour en
  2,5 minutes, sans fallback.
- Les régressions contrôleur, conversations, perception, résolution, route
  OpenAI, surface React et transition locale passent.
- `npm run build` passe.
