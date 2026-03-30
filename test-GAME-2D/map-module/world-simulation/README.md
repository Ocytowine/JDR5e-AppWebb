# World Simulation

Sous-module de simulation du monde rattaché au `map-module` et deja branche aux ecrans d'edition et de simulation.

## Objectif

Fournir un runtime monde :
- sans dépendance à l'IA pour la simulation principale ;
- data-driven pour les pressions et les actions ;
- compatible avec les données de carte existantes ;
- prêt à produire des sorties structurées pour un module narratif séparé.

## Fichiers

- `types.ts` : modèles de données, événements, actions, objectifs, sorties de tick.
- `definitions.ts` : définitions MVP des pressions et de la bibliothèque d'actions.
- `engine.ts` : pipeline de tick monde et injection contrôlée de candidats.
- `mapAdapter.ts` : adaptation depuis `worldMapLayout`, génération d'un `WorldState` et overrides.
- `exampleScenario.ts` : scénario concret avec 1 ville, 2 quartiers, plusieurs factions, 1 route, 1 mobile, plusieurs objectifs spéciaux.
- `currentMapDemo.ts` : démonstration branchée sur la carte actuellement éditée.

## Pipeline MVP

1. avancer l'horloge ;
2. recalculer les pressions ;
3. sélectionner les acteurs actifs ;
4. générer les actions compatibles ;
5. scorer et choisir une action par acteur ;
6. résoudre coûts, effets, progression d'objectifs ;
7. faire progresser les mobiles ;
8. générer événements, signaux, rumeurs, opportunités ;
9. recalculer les pressions après deltas.

## Notes d'intégration

- L'adaptateur carte dérive villes, quartiers, routes et régions à partir des cellules, tags, routes et zones.
- Mode quartier formalise :
  - par defaut, une ville fonctionne en `quartiers derives + overrides` ;
  - si au moins un quartier natif est defini pour une ville, la simulation locale de cette ville bascule en mode `quartiers natifs` ;
  - melanger durablement quartiers natifs et overrides derives pour une meme ville est deconseille et remonte en preflight.
- `createWorldStateFromCurrentMap()` permet de créer un état directement depuis la carte courante.
- `runCurrentMapDemoTicks()` permet de tester 2-3 ticks sur les vraies données du layout sans UI.
- L'injection future d'éléments IA passe par `validateCandidateProposal` puis `injectCandidateProposal`.
- Le runtime reste la source de vérité : les candidats externes ne modifient jamais directement l'état.
