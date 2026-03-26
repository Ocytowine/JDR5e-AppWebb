# World Simulation Integration For `map-module`

## But

Ce document reformule le besoin de simulation monde pour l'aligner avec l'architecture deja presente dans `test-GAME-2D/map-module/world-simulation`.

Le runtime monde doit :

- faire evoluer le monde sans IA ;
- rester la source de verite des etats et evenements ;
- s'appuyer sur la carte et ses metadonnees ;
- produire des sorties structurees exploitables par d'autres modules ;
- conserver une coherence de composition raciale entre lieux, factions et rencontres ;
- garantir une coherence spatiale, logistique et causale.

La boucle cible reste :

`Pression -> Decision -> Action -> Evenement -> Consequence -> Diffusion`

## Positionnement Dans Le Module

Le `map-module` contient deja les briques principales :

- `world-simulation/types.ts` : modele runtime ;
- `world-simulation/definitions.ts` : definitions data-driven des pressions et actions ;
- `world-simulation/engine.ts` : pipeline de tick ;
- `world-simulation/mapAdapter.ts` : derivation depuis `worldMapLayout` ;
- `world-simulation/logisticsPlanner.ts` et `travel.ts` : faisabilite logistique et mobilite ;
- `world-simulation/exampleScenario.ts` : MVP de demonstration.

Le bon point d'integration n'est donc pas de reconstruire un second moteur, mais de faire converger les besoins de simulation vers ces fichiers.

## Source De Verite

La carte editee reste la source des donnees structurelles :

- cellules ;
- villes ;
- routes ;
- regions de gouvernance ;
- factions declarees dans `layout.simulation` ;
- objectifs speciaux declares dans `layout.simulation` ;
- acteurs mobiles declares dans `layout.simulation`.

Le runtime `WorldState` devient ensuite la source de verite vivante :

- stats dynamiques ;
- pressions calculees ;
- composition raciale exploitable pour les rencontres ;
- cooldowns ;
- progression d'objectifs ;
- deltas de tick ;
- evenements ;
- rumeurs ;
- opportunites ;
- tensions actives.

Regle importante :

- la carte initialise et contraint le monde ;
- le runtime fait evoluer le monde ;
- les identites de population et de faction doivent rester coherentes avec la geographie ;
- les modules externes ne modifient jamais directement l'etat runtime sans validation.

## Mapping Des Modeles

### Ville

Le besoin initial "ville" correspond a `WorldCity`.

Champs couverts :

- `id`, `name`, `regionId`, `districtIds`, `routeIds`
- `state.order`, `state.commerce`, `state.fear`, `state.corruption`, `state.supply`
- `factionInfluence`
- `structuralPlaces`
- futur champ recommande `populationProfile`
- `recentHistory`
- `activeTensionIds`

Origine :

- derivee depuis `layout.cities` et les cellules proches via `collectCityCells()`.

Extension recommandee :

- ajouter sur les villes un profil de population data-driven ;
- ce profil sert de base de coherence pour les factions presentes, les mobiles locaux et les futures rencontres joueur.

### Quartier

Le besoin initial "quartier" correspond a `WorldDistrict`.

Champs couverts :

- `id`, `name`, `cityId`, `connectionIds`
- `state.danger`, `state.wealth`, `state.surveillance`, `state.agitation`, `state.commerce`
- `factionInfluence`
- `importantPlaces`
- `dominantActivities`
- futur champ recommande `populationProfile`
- `recentHistory`
- `ambientSignals`

Origine :

- derive depuis les cellules de la ville, avec profils `core`, `harbor`, `sanctuary`, `outskirts`.

Extension recommandee :

- permettre un profil racial plus fin au niveau quartier, afin qu'une faction locale ou une rencontre dans le quartier reste coherente avec sa base sociale.

### Route

Le besoin initial "route" correspond a `WorldRoute`.

Champs couverts :

- `id`, `originId`, `destinationId`, `length`, `travelCost`
- `state.security`, `state.traffic`, `state.control`, `state.ambushRisk`
- `mobileActorIds`
- `recentHistory`

Origine :

- derive depuis `layout.paths` de type `road`.

### Region

Le document initial parlait de regions ; le runtime les represente deja via `WorldRegion`.

Champs couverts :

- `id`, `name`, `cityIds`, `mainRouteIds`
- `state.stability`, `state.politicalControl`, `state.production`, `state.circulation`, `state.externalThreat`
- `tags`

Origine :

- derive depuis `layout.governanceRegions`.

### Faction

Le besoin initial "faction" correspond a `WorldFaction`.

Champs couverts :

- `id`, `name`, `type`, `tags`
- `influenceZoneIds`
- `state.resources`, `state.power`, `state.influence`, `state.cohesion`, `state.aggressiveness`, `state.discretion`
- `ressourcesTransport`
- futur champ recommande `populationProfile`
- `objectives`
- `relations`
- `cooldowns`
- `recentHistory`

Origine :

- derive depuis `layout.simulation.factions`.

Ecart actuel a assumer :

- la notion fine de zones `controlees / influencees / interet / evitees` n'est pas encore un type distinct ; elle est aujourd'hui approchee via `influenceZoneIds`, les tags, la cible des objectifs et la logistique.
- la composition raciale des factions n'est pas encore un champ runtime explicite.

Extension recommandee :

- ajouter aux factions un `populationProfile` ou `raceProfile` du meme type que les villes ;
- derivation par defaut depuis la ville, la region ou les cellules de presence de la faction ;
- possibilite d'override manuel dans `layout.simulation.factions` pour les factions atypiques ;
- utiliser ce profil comme garde-fou de coherence pour les rencontres et l'identite visible de la faction.

### Objectif Special

Le besoin initial "objectif special" correspond a `SpecialObjective`.

Champs couverts :

- `id`, `category`, `owner`, `target`
- `priority`, `state`, `progress`
- `zoneIds`
- `obstacles`
- `compatibleActionIds`
- `onSuccess`, `onFailure`
- `tags`

Origine :

- derive depuis `layout.simulation.specialObjectives`, ou infere depuis `objectiveHints` des factions.

Ecart actuel :

- le besoin de phases explicites n'est pas encore modele par un tableau `phases`. Aujourd'hui la progression est scalarisee via `progress` et `obstacles`.

### Acteur Mobile

Le besoin initial "acteur mobile" correspond a `MobileActor`.

Champs couverts :

- `id`, `typeEntity`, `position`, `destination`, `itinerary`
- `speed`, `routeProgress`
- `state.security`, `state.fatigue`, `state.resources`, `state.cargo`, `state.headcount`
- `objectives`
- `simulationLevel`
- `cooldowns`

Origine :

- derive depuis `layout.simulation.mobileActors`.

Extension recommandee :

- un acteur mobile peut heriter du profil racial de sa faction ou porter un override propre ;
- cela permet de garder une coherence de rencontre quand le joueur croise un groupe rattache a une faction donnee.

### Action Monde

Le besoin initial "action monde" correspond a `WorldActionDefinition`.

Champs couverts :

- `id`, `label`
- `preconditions`
- `costs`
- `risks`
- `successEffects`, `failureEffects`
- `cooldown`
- `compatibleObjectives`
- `diffusion`
- `eventType`

Origine :

- bibliotheque data-driven dans `definitions.ts`.

### Evenement

Le besoin initial "evenement" correspond a `WorldEvent`.

Champs couverts :

- `id`, `type`, `tick`
- `actor`, `target`, `objectiveId`
- `success`
- `deltas`
- `tags`
- `payload`

## Pipeline De Tick

Le pipeline cible du document initial est deja present dans `runWorldTick()` avec cette traduction :

1. avancer l'horloge ;
2. decrementer les cooldowns ;
3. synchroniser la presence mobile sur les routes ;
4. recalculer les pressions avant action ;
5. construire les plans logistiques des factions ;
6. choisir le mode de transport adapte par objectif ;
7. calculer ou recalculer les cases et routes a emprunter jusqu'a la cible ;
8. selectionner les acteurs actifs ;
9. generer les actions candidates compatibles ;
10. scorer et choisir une action par acteur ;
11. appliquer couts et effets ;
12. generer evenements, signaux et rumeurs ;
13. faire avancer les mobiles ;
14. recalculer les pressions apres deltas ;
15. produire le `TickOutput`.

Ajout recommande dans ce pipeline :

- avant le scoring final, verifier que l'identite de la faction et des mobiles affectes reste coherente avec leur `populationProfile`, leur zone et leur type de mission ;
- lors de la generation des sorties, exposer les informations utiles a une future couche de rencontre sans narrativiser le tick.

Le `TickOutput` est deja conforme au besoin de sorties exploitables :

- `events`
- `deltas`
- `signals`
- `rumors`
- `opportunities`
- `trace`

## Systeme De Pressions

Le moteur est deja data-driven via `PRESSURE_DEFINITIONS`.

Pressions actuellement supportees dans les definitions MVP :

- `criminal`
- `social`
- `commercial`
- `military`
- `political`

Le besoin initial "religieuse" est prevu dans le type `PressureType`, mais pas encore defini dans `definitions.ts`.

Structure :

- une pression cible un type d'entite : `city`, `district`, `route`, `region` ;
- chaque definition combine des termes ponderes ;
- un terme peut provenir d'un `state`, d'une influence de faction, d'une charge de route ou d'une presence mobile ;
- le resultat est normalise puis borne.

Exemple deja aligne avec le besoin :

- `district.danger` eleve ;
- `district.surveillance` faible ;
- influence criminelle forte ;
- donc `criminal pressure` haute.

## Systeme D'Objectifs

Le runtime gere deja :

- priorite ;
- cible ;
- compatibilite d'action ;
- progression dans le temps ;
- completion ;
- succes ou echec via consequences.

Pour integrer proprement le besoin multi-phase sans casser l'existant, la prochaine extension recommandee est :

- garder `progress` comme valeur globale ;
- ajouter optionnellement `phases: string[]` ;
- ajouter `currentPhaseIndex` ;
- faire porter certaines `preconditions` sur la phase courante.

Ainsi, l'architecture existante reste compatible avec le MVP et evolue sans refonte.

Impact des trajets sur les objectifs :

- un objectif ne doit pas seulement etre "compatible" ; il doit etre atteignable ;
- la cible d'execution peut differer de la cible logique ;
- le choix du mode de transport et du chemin fait partie de la faisabilite de l'objectif, pas d'une couche optionnelle annexe.

## Systeme D'Actions

Le score demande initialement etait :

`priorite objectif + urgence + opportunite + compatibilite zone + faisabilite - cout - risque`

Le moteur actuel implemente deja une premiere version de ce calcul :

- `basePriority`
- pression de la cible
- bonus de compatibilite objectif
- contribution de la priorite d'objectif
- bonus ou malus logistique

Cela couvre deja :

- priorite objectif ;
- opportunite par pression ;
- faisabilite logistique ;
- compatibilite avec l'objectif.

Le document doit maintenant considerer explicitement que la faisabilite comprend :

- le mode de transport selectionne ;
- l'existence d'un itineraire reel ;
- les cases et routes empruntees ;
- le risque du trajet ;
- le cout logistique de projection vers la cible.

Ce qui reste a enrichir plus tard si necessaire :

- cout et risque comme penalites explicites dans le score avant resolution ;
- compatibilite de zone plus fine ;
- urgence derivee des tensions et du vieillissement d'objectif.

## Coherence Spatiale Et Logistique

La coherence attendue par le document initial est deja partiellement ancree dans le sous-module.

### Zones

Etat actuel :

- villes, routes et regions existent comme referentiels spatiaux ;
- les factions ont des `influenceZoneIds` ;
- les objectifs portent des `zoneIds` ;
- les cibles d'action contraignent deja les choix.

Evolution conseillee pour coller au besoin initial :

- ajouter sur `WorldFaction` une structure optionnelle `zones: { controlledIds, influencedIds, interestIds, avoidedIds }` ;
- la nourrir depuis `layout.simulation` plutot que coder des regles en dur ;
- utiliser cette structure dans le scoring d'action.

Impact race et rencontre :

- une faction rencontree dans une zone doit pouvoir exposer un profil racial coherent avec cette zone ou avec son exception declaree ;
- une faction minoritaire ou exogene doit etre marquee explicitement dans les donnees plutot que "devinee" au runtime.

### Logistique

Etat actuel :

- `logisticsPlanner.ts` genere des plans ;
- la distance et les trajets passent par `travel.ts` ;
- le mode de transport est deja compare entre `pied`, `cheval` et `bateau` ;
- l'itineraire est deja calcule via `findShortestRouteItinerary()` ;
- le cout de traversee depend deja des cases/routes via `getRouteTraversalCost()` ;
- les ressources de transport des factions sont reinitialisees puis allouees a chaque tick ;
- un objectif non faisable degrade deja le score.

Clarification a graver dans la spec :

- le trajet n'est pas juste une animation apres decision ;
- il fait partie de la decision ;
- le moteur doit choisir un mode de transport, un itineraire et un cout de projection avant de considerer une action comme realiste.

### Ancrages

Le besoin initial "point d'ancrage local ou preparation" n'est pas encore un type runtime explicite.

Integration recommandee :

- reutiliser d'abord `importantPlaces`, `structuralPlaces` et les tags de lieux ;
- ajouter ensuite un type data-driven `ActionAnchor` si des actions critiques l'exigent ;
- faire qu'une action importante soit soit autorisee par presence d'ancrage, soit bloquee jusqu'a progression d'un objectif preparatoire.

### Ressources

Le runtime applique deja des couts sur :

- `resources`
- `fatigue`
- `cargo`
- `security`

La contrainte initiale `agents / argent / discretion` peut etre couverte sans refonte en normalisant les stats de faction et mobile autour de :

- `resources`
- `power` ou `headcount`
- `discretion`

La prise en charge du transport doit aussi etre consideree comme une ressource de coherence :

- chevaux disponibles ;
- bateaux disponibles ;
- effectifs projetables ;
- budget disponible ;
- poids transporte ;
- vitesse attendue par mission.

## Coherence Des Races

Le systeme doit maintenant expliciter la coherence raciale entre carte, factions et rencontres.

Objectif :

- si le joueur rencontre une faction, sa composition raciale doit etre credible par rapport au monde ;
- une faction locale doit refleter en general la population de sa base ;
- une exception doit etre declaree dans les donnees, pas inventee au moment de la rencontre.

Modele recommande commun :

```ts
type PopulationProfile = {
  dominantGroupId?: string;
  groups: Array<{
    groupId: string;
    weight: number;
    role?: "dominant" | "minority" | "elite" | "servitor" | "outsider";
  }>;
  notes?: string[];
};
```

Usage recommande :

- `WorldCity.populationProfile`
- `WorldDistrict.populationProfile`
- `WorldFaction.populationProfile`
- optionnellement `MobileActor.populationProfile`

Regles de coherence :

- une faction herite par defaut du profil de sa zone d'origine ;
- une faction specialisee peut redefinir ce profil explicitement ;
- un acteur mobile herite de sa faction sauf override ;
- les futures rencontres du joueur doivent tirer leur composition depuis ce profil, pas depuis une logique aleatoire globale ;
- la simulation ne fait pas de narration raciale, elle ne produit que des compositions structurees.

Source des donnees :

- villes et quartiers : population de reference ;
- factions : override ou specialisation ;
- mobiles : heritage de faction ;
- eventuellement cellules ou regions si un niveau plus fin est requis plus tard.

## Acteurs Mobiles

Le besoin initial est directement aligne avec le comportement de `advanceMobileActors()` :

- deplacement sur graphe ;
- progression sur route ;
- arrivee en zone ;
- reroutage ;
- delais ;
- impact du danger, de la fatigue, de la charge et de la securite.

Cela garantit deja une coherence spatiale minimale : un mobile n'agit pas "teleporte", il suit un itineraire ou reste bloque.

Le document doit desormais considerer la mobilite comme une chaine complete :

- choix du mode de transport selon objectif et ressources ;
- choix des cases et routes a emprunter ;
- estimation du cout, du temps et du risque ;
- affectation d'un mobile ;
- progression ou blocage tick par tick ;
- recalcul d'itineraire en cas de danger ou d'evolution du monde.

## Sorties Exploitables

Le runtime doit rester non narratif. Les sorties doivent etre techniques et structurees.

Les sorties deja prevues sont suffisantes pour un autre module :

- `WorldEvent[]` pour le fait brut ;
- `StateDelta[]` pour les changements observables ;
- `PerceptibleSignal[]` pour les effets visibles ;
- `Rumor[]` pour la diffusion indirecte ;
- `Opportunity[]` pour les accroches emergentes ;
- `TickTrace` pour l'analyse et le debug.

Sorties a renforcer pour les prochaines corrections :

- trace logistique complete par objectif ;
- mode de transport retenu ;
- routeIds ou cases empruntees ;
- motifs de blocage de trajet ;
- profil racial utile a une future couche de rencontre.

## MVP Dans Le `map-module`

Le besoin MVP demande :

- 1 ville
- 2 quartiers
- 2 factions
- 1 route
- 1 acteur mobile
- 1 objectif special
- 2 a 3 ticks

Ce MVP existe deja en pratique dans `world-simulation/exampleScenario.ts`.

Pour un MVP branche sur la vraie carte :

- utiliser `createWorldStateFromCurrentMap()` ;
- completer `layout.simulation.factions` ;
- completer `layout.simulation.specialObjectives` ;
- completer `layout.simulation.mobileActors` ;
- ajouter les profils raciaux sur villes et factions ;
- verifier que les plans logistiques exposent bien mode, itineraire et raisons de blocage ;
- executer `runWorldTick(state, "micro" | "macro")` sur 2 a 3 ticks.

## Recommandations D'Integration

### A Court Terme

- conserver `world-simulation` comme runtime unique ;
- utiliser `mapAdapter.ts` comme seule porte d'entree depuis la carte ;
- documenter les champs minimaux a fournir dans `layout.simulation` ;
- ajouter un type partage `PopulationProfile` pour villes, quartiers, factions et mobiles ;
- faire heriter par defaut les factions du profil racial de leur zone d'origine ;
- ajouter une pression `religious` dans `definitions.ts` si necessaire ;
- exposer clairement dans la trace le mode de transport, l'itineraire choisi et les blocages ;
- exposer un ecran ou panneau de test qui affiche `TickOutput.trace`.

### A Moyen Terme

- ajouter des zones de faction explicites ;
- ajouter des phases d'objectif optionnelles ;
- ajouter des ancrages d'action locaux ;
- enrichir le score d'action avec risque, cout et urgence explicites ;
- ajouter la coherence raciale dans les seeds, les overrides et les sorties de rencontre ;
- descendre du niveau `routeIds` vers un niveau plus fin `cellPath` si la simulation doit raisonner a l'hex pres ;
- persister certaines sorties de runtime dans l'UI simulation.

### A Eviter

- dupliquer les modeles entre `map-module` et `world-simulation` ;
- coder les comportements de faction en dur hors definitions ;
- deviner la race d'une faction au moment de la rencontre sans source de donnees ;
- traiter le trajet comme un simple effet visuel sans impact sur la decision ;
- laisser un module externe ecrire directement dans `WorldState` sans validation ;
- melanger narration et simulation dans le meme tick.

## Conclusion

Le besoin exprime dans le document initial s'integre bien au `map-module`, car la base technique existe deja. La bonne approche n'est pas de re-partir de zero, mais de formaliser que :

- le layout carte fournit la structure ;
- `mapAdapter.ts` transforme cette structure en seed runtime ;
- `engine.ts` fait vivre le monde par ticks ;
- les races doivent etre gerees comme une donnee structurelle de coherence, pas comme un ajout narratif tardif ;
- le trajet doit etre traite comme une composante de decision complete, pas comme un detail post-action ;
- les definitions de pressions et d'actions restent data-driven ;
- les futures extensions doivent enrichir les modeles existants plutot que les remplacer.
