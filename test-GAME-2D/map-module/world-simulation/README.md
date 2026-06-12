# World Simulation

Sous-module de simulation du monde rattache au `map-module`, branche aux ecrans d'edition et de visualisation.

## Objectif

Fournir un runtime de monde autonome :

- sans dependance a l'IA pour la simulation principale ;
- sans dependance a une position joueur ;
- data-driven pour les pressions, les actions et les objectifs ;
- compatible avec les donnees de carte existantes ;
- pret a fournir des sorties structurees a d'autres modules plus tard.

Le role actuel du module est de faire vivre villes, factions, routes, tensions et historiques en continu.

## Position actuelle

Le runtime maintient maintenant :

- des pressions calculees sur villes, quartiers, routes et regions ;
- des tensions persistantes referencees par les entites via `activeTensionIds` ;
- une memoire locale via `recentHistory` ;
- des objectifs systeme generes par les besoins du monde ;
- des factions systeme capables de reagir aux pressions et tensions ;
- une UI de visualisation qui expose pressions, tensions actives, deltas et historique.

## Fichiers

- `types.ts` : modeles de donnees, evenements, actions, objectifs, sorties de tick.
- `definitions.ts` : definitions des pressions et de la bibliotheque d'actions.
- `engine.ts` : pipeline de tick monde et injection controlee de candidats.
- `systemObjectives.ts` : generation et reconciliation des objectifs systeme.
- `mapAdapter.ts` : adaptation depuis `worldMapLayout`, generation d'un `WorldState` et overrides.
- `exampleScenario.ts` : scenario concret de verification.
- `currentMapDemo.ts` : demonstration branchee sur la carte actuellement editee.

## Pipeline

1. Avancer l'horloge.
2. Synchroniser la presence mobile.
3. Appliquer l'usure territoriale.
4. Recalculer les pressions.
5. Reconciler les objectifs systeme sur macro tick.
6. Selectionner les acteurs actifs.
7. Generer, scorer et resoudre les actions.
8. Faire progresser les mobiles.
9. Faire evoluer les tensions actives sur macro tick.
10. Recalculer les pressions apres effets.
11. Diffuser evenements, signaux, rumeurs, opportunites et historique.

## Cycle autonome

Sur les `macro ticks`, le moteur :

1. reconcilie les objectifs systeme selon l'etat du monde ;
2. resout les actions des factions et mobiles ;
3. fait evoluer les tensions actives ;
4. applique les effets secondaires des tensions fortes ;
5. nettoie les tensions resolues ;
6. ecrit les evenements et deltas dans `recentHistory`.

Une tension n'est donc plus seulement une sortie ponctuelle : elle devient un phenomene actif qui peut monter, baisser, affecter les stats et provoquer une reponse des factions systeme.

Les actions systeme reussies peuvent aussi soulager les tensions qu'elles traitent. Par exemple, `reopen_market` reduit progressivement les tensions `scarcity` et `commercial` sur le quartier et sa ville, tout en pouvant creer une contre-tension criminelle de visibilite du marche. Le cycle vise donc :

`probleme actif -> reponse systeme -> soulagement partiel -> contre-effet ou residualite -> nouveau besoin`

Les factions systeme sont volontairement disciplinees : elles n'agissent que si elles ont un objectif actif. Cela evite qu'une garde, une autorite civique ou un bureau logistique vide ses ressources sur des actions opportunistes avant de traiter le besoin systemique qui vient d'etre genere.

## Visualisation

Le mode simulation expose :

- les pressions dominantes ;
- les tensions actives avec severite, source, cible, age et tags ;
- les marqueurs spatiaux des tensions sur la carte en modes `Pressions` et `Tout` ;
- les deltas d'usure territoriale et de conversion ;
- la memoire recente d'une entite inspectee.

## Verification

Commande cible :

```bash
npm run verify:world-simulation
```

Elle verifie la boucle minimale :

- injection d'une tension de penurie ;
- indexation sur l'entite cible ;
- ecriture dans l'historique ;
- consolidation d'une tension equivalente ;
- soulagement par une action systeme ;
- reponse civique a une tension politique locale ;
- production de deltas systemiques ;
- generation et assignation d'un objectif systeme `reopen_market`.

Sonde longue optionnelle :

```bash
npx tsx scripts/analyze-sandbox-simulation.ts
```

Elle execute 20 macro-cycles sur `simulation_sandbox.json` et resume evenements, deltas, actions selectionnees, objectifs systeme et tensions finales.

## Notes d'integration

- L'adaptateur carte derive villes, quartiers, routes et regions a partir des cellules, tags, routes et zones.
- Mode quartier formalise :
  - par defaut, une ville fonctionne en `quartiers derives + overrides` ;
  - si au moins un quartier natif est defini pour une ville, la simulation locale de cette ville bascule en mode `quartiers natifs` ;
  - melanger durablement quartiers natifs et overrides derives pour une meme ville est deconseille et remonte en preflight.
- `createWorldStateFromCurrentMap()` permet de creer un etat directement depuis la carte courante.
- `runCurrentMapDemoTicks()` permet de tester quelques ticks sur les vraies donnees du layout sans UI.
- L'injection future d'elements externes passe par `validateCandidateProposal` puis `injectCandidateProposal`.
- Le runtime reste la source de verite : les candidats externes ne modifient jamais directement l'etat.
