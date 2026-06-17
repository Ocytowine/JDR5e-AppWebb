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
- des objectifs opportunistes pour les factions non-systeme ;
- des relations inter-factions qui evoluent selon les actions reussies ;
- une UI de visualisation qui expose pressions, tensions actives, deltas et historique.

## Fichiers

- `types.ts` : modeles de donnees, evenements, actions, objectifs, sorties de tick.
- `definitions.ts` : definitions des pressions et de la bibliotheque d'actions.
- `engine.ts` : pipeline de tick monde et injection controlee de candidats.
- `systemObjectives.ts` : generation et reconciliation des objectifs systeme.
- `factionOpportunities.ts` : generation et reconciliation des objectifs opportunistes des factions non-systeme.
- `situationSummary.ts` : synthese lisible d'une situation locale a partir des pressions, tensions, factions, mobiles et historiques.
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

Les factions non-systeme peuvent exploiter certaines tensions actives. Une faction criminelle proche d'un quartier affecte par une tension `scarcity`, `commercial` ou `criminal` peut recevoir un objectif `faction_generated` d'exploitation de crise, puis agir via `extort`. Une faction marchande peut reagir a une crise de marche ou a une route commerciale exposee. Une faction militaire peut se saisir d'une tension de corridor. Une faction religieuse peut transformer une tension sociale, religieuse ou politique en opportunite d'influence.

Les actions reussies peuvent aussi modifier les relations inter-factions. Une extorsion reussie degrade la confiance et augmente l'hostilite avec les factions civiques, militaires ou marchandes concernees par la zone. A l'inverse, securiser ou reparer une route peut ameliorer la confiance avec les acteurs marchands ou militaires qui dependent du corridor. Ces changements sont historises via `relation_shift`.

Les relations hostiles peuvent maintenant devenir une cause d'action. Quand une faction non-systeme atteint un niveau de rivalite ou de guerre avec une autre faction non-systeme, le runtime peut generer un objectif `faction_generated` marque `relation_generated`. Ces objectifs anti-rival ciblent un quartier pertinent et utilisent les actions deja disponibles selon le profil de la faction : extorsion criminelle, patrouille militaire, sanctification religieuse ou reprise commerciale. Quand une action reussit pour ce type d'objectif, la relation acteur/rival recoit aussi une consequence ciblee `anti_rival_success`.

Les relations de confiance peuvent aussi devenir une cause d'action. Quand deux factions non-systeme partagent un corridor et gardent une confiance elevee avec peu d'hostilite, le runtime peut generer un objectif cooperatif `cooperation_generated` pour stabiliser cette route. Une reussite de `repair_route` ou `secure_route` renforce alors directement la relation via `alliance_support_success`.

Les mobiles ont maintenant une premiere consequence systemique a l'arrivee. Un convoi charge peut ameliorer l'approvisionnement et le commerce d'une ville, une patrouille peut renforcer l'ordre ou la securite, un groupe criminel peut augmenter corruption et risque, et un groupe religieux peut produire un effet social local. L'arrivee fait aussi progresser l'objectif principal porte par le mobile et ecrit un historique `mobile_arrival_effect`.

Les retards et embuscades mobiles produisent aussi des consequences. Un retard augmente le risque d'echec de l'objectif transporte, degrade legerement le corridor ou la destination attendue, et peut creer une tension `mobility_risk`. Une embuscade peut endommager la route, menacer l'approvisionnement de destination et creer une tension criminelle de route. Ces effets sont historises via `mobile_delay_effect` et `mobile_ambush_effect`.

Le runtime peut aussi generer des mobiles autonomes pour les factions qui portent un objectif logistique ou systeme mais n'ont aucun acteur mobile utilisable. La generation reste bornee et ciblee : elle privilegie les objectifs publics, logistiques, de corridor ou de stabilisation, et evite de donner automatiquement un mobile a toutes les opportunites criminelles ou narratives. Ces creations sont historisees via `mobile_generated`.

Les mobiles runtime sans objectif actif et sans trajet sont retires automatiquement au cycle macro suivant. Cette retraite libere le plafond de generation et evite qu'une ancienne patrouille ou un ancien convoi termine bloque la creation d'un nouveau mobile. Elle est historisee cote faction via `mobile_retired`.

Quand aucun itineraire de route n'existe, un mobile peut utiliser une progression abstraite hors-route. Ce trajet est plus lent, plus fatigant, et conserve les couts lies au terrain, a la charge et aux effectifs. Les plans logistiques indiquent ce cas via `trajet_hors_route`. Les `paths.kind === "river"` sont convertis en corridors runtime fluviaux utilisables par les mobiles en mode `bateau`/`river`; les modes terrestres les ignorent comme routes praticables. Les villes et regions maritimes peuvent aussi produire des corridors runtime `maritime:*` utilisables en mode `bateau`/`sea`. Pour les modes `river`/`sea` ou le transport `bateau`, une navigation abstraite reste possible si le depart ou l'arrivee expose un acces eau/maritime ; sinon le mobile est bloque et l'objectif porte prend de l'echec.

Les mobiles provoquent aussi des reactions locales. A l'arrivee, les factions presentes dans le lieu cible peuvent reagir au proprietaire et au profil du mobile : convoi, patrouille, groupe religieux ou groupe criminel. Ces reactions peuvent modifier les relations entre factions, ajuster legerement l'etat du lieu, et sont historisees via `mobile_local_reaction`.

Les mobiles peuvent enfin interagir entre eux sur une meme route. Une rencontre entre allies ou patrouilles peut renforcer la securite et les relations ; une rencontre entre rivaux, criminels ou forces de securite peut creer de la friction, augmenter le risque de route ou produire une tension `mobility_risk`. Ces reactions sont historisees via `mobile_encounter`. Les mobiles stationnaires sans destination ni itineraire ne declenchent pas de rencontre, afin d'eviter une fausse activite.

## Visualisation

Le mode simulation expose :

- un panneau `Calibration` avec fenetres 10/30 avancees pour lire activite, tensions, actions opportunistes, objectifs et relations ;
- les causes d'action selectionnees : maintenance systeme, besoin logistique, crise, rivalite, cooperation, tension locale ou acteur mobile ;
- les mobiles generes automatiquement dans la calibration ;
- les arrivees, retards et embuscades mobiles avec effets systemiques dans la calibration ;
- les reactions locales et rencontres mobiles via l'historique des entites concernees ;
- les compteurs d'objectifs relationnels, relations hostiles, effets `anti_rival_success` et effets cooperatifs dans la calibration ;
- les pressions dominantes ;
- les tensions actives avec severite, source, cible, age et tags ;
- les marqueurs spatiaux des tensions sur la carte en modes `Pressions` et `Tout` ;
- les mobiles runtime generes sur la carte en modes `Mobilite` et `Tout`, avec un marqueur distinct des mobiles editoriaux ;
- les deltas d'usure territoriale et de conversion ;
- les objectifs `relation_generated` avec origine, cible relationnelle, niveau `rival/war/ally` et effet attendu ;
- les transitions de phase d'objectif dans la trace runtime : progression, completion, activation, blocage ou echec ;
- le journal relationnel recent d'une faction avec les derniers `relation_shift` ;
- une synthese `Situation locale` pour lire tendance, risque, factions impliquees, mobiles concernes et suites probables ;
- une fiche `Mobile suivi` capable d'inspecter les mobiles editoriaux et les mobiles runtime generes : origine, proprietaire, objectif porte, destination, plan logistique, dernier mouvement et historique utile ;
- la memoire recente d'une entite inspectee.

Lecture rapide du panneau `Calibration` :

- `Actif` indique que le monde produit encore evenements, actions, opportunites ou relations ;
- `Phase calme` indique une fenetre avec tensions faibles et soulagement recent, donc peu d'opportunisme necessaire ;
- `Stagne` indique une fenetre sans action ou evenement notable ;
- `Trop institutionnel` indique que des tensions significatives existent sans reaction opportuniste ni mouvement relationnel ;
- `A surveiller` indique une accumulation de tensions fortes, trop nombreuses, ou un epuisement systeme ;
- le diagnostic sous chaque fenetre signale les crises absorbees, les objectifs opportunistes dormants, les relations actives et les risques de ressources.

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
- creation et execution d'un objectif opportuniste criminel ;
- creation et execution d'un objectif opportuniste marchand ;
- creation d'un objectif opportuniste militaire sur route ;
- variation de relations apres extorsion et securisation de route ;
- creation d'un objectif anti-rival depuis une relation hostile ;
- consequence relationnelle ciblee apres reussite d'un objectif anti-rival ;
- creation d'un objectif cooperatif depuis une relation de confiance ;
- effet systemique d'un mobile qui arrive a destination ;
- reaction locale faction/lieu apres arrivee d'un mobile ;
- rencontre entre deux mobiles rivaux sur une route ;
- effet systemique d'un mobile retarde ou pris dans une embuscade ;
- generation autonome d'un mobile pour une faction systeme sans acteur mobile ;
- production de deltas systemiques ;
- generation et assignation d'un objectif systeme `reopen_market`.

Garde-fou long-run :

```bash
npm run verify:world-simulation:long
```

Il execute 30 macro-cycles sur `simulation_sandbox.json` et echoue si le monde retombe dans un symptome de stagnation :

- plus assez d'evenements, deltas ou actions selectionnees ;
- les derniers macro-cycles ne produisent plus d'activite ;
- le nombre de tensions actives explose ;
- une tension forte reste bloquee trop longtemps ;
- les objectifs systeme ne se renouvellent pas assez ;
- toutes les factions systeme sont a court de ressources ;
- les traces de tensions soulagees disparaissent ;
- aucune action opportuniste de faction non-systeme n'est observee ;
- les familles opportunistes criminelle, marchande et militaire ne sont pas observees ;
- aucun objectif genere par relation hostile n'est observe ;
- aucune consequence relationnelle ciblee `anti_rival_success` n'est observee ;
- les objectifs cooperatifs de corridor ne sont plus generes dans la verification courte ;
- les relations inter-factions ne produisent plus assez de traces `relation_shift`.

Garde-fou long-run dedie aux mobiles :

```bash
npm run verify:world-simulation:mobility-long
```

Il execute 120 ticks horaires et echoue si la derniere fenetre retombe dans un blocage de mobilite : mobiles assignes mais aucun progres, arrivee ou reorientation, acteurs coinces en fatigue haute, saturation des actions par des mobiles sans mission claire, ou mobile runtime obsolete bloque sur une route.

Sonde longue detaillee :

```bash
npx tsx scripts/analyze-sandbox-simulation.ts
```

Elle execute 20 macro-cycles sur `simulation_sandbox.json` et imprime un JSON complet avec evenements, deltas, actions selectionnees, objectifs systeme, factions systeme et tensions par snapshot.

## Notes d'integration

- L'adaptateur carte derive villes, quartiers, routes et regions a partir des cellules, tags, routes et zones.
- La feuille de suivi des prochaines corrections est dans `map-module/docs/world-simulation-corrective-roadmap.md`.
- Mode quartier formalise :
  - par defaut, une ville fonctionne en `quartiers derives + overrides` ;
  - si au moins un quartier natif est defini pour une ville, la simulation locale de cette ville bascule en mode `quartiers natifs` ;
  - melanger durablement quartiers natifs et overrides derives pour une meme ville est deconseille et remonte en preflight.
- `createWorldStateFromCurrentMap()` permet de creer un etat directement depuis la carte courante.
- `runCurrentMapDemoTicks()` permet de tester quelques ticks sur les vraies donnees du layout sans UI.
- L'injection future d'elements externes passe par `validateCandidateProposal` puis `injectCandidateProposal`.
- Le runtime reste la source de verite : les candidats externes ne modifient jamais directement l'etat.
