# Editor To Simulation Implementation Plan

## But

Transformer la roadmap en plan d'implementation concret, avec :

- ordre de travail ;
- lots developpement ;
- dependances ;
- impact code ;
- definition de fini ;
- risques a surveiller.

Le principe reste :

1. fiabiliser l'edition ;
2. rendre les donnees pilotables ;
3. seulement ensuite enrichir la simulation.

## Strategie

Ordre recommande :

1. preflight et validation ;
2. edition guidee des trajets ;
3. profils de population / races ;
4. quartiers pilotables ;
5. enrichissement factions et objectifs ;
6. inspection simulation avancee.

Pourquoi cet ordre :

- il reduit le risque de produire des donnees invalides ;
- il debloque rapidement la personnalisation avant simulation ;
- il evite d'ajouter des modeles que l'UI ne sait pas encore saisir.

## Vue D'Ensemble Des Lots

### Lot 1. Preflight Simulation

Objectif :

- detecter les incoherences avant lancement.

Code cible :

- nouveau module `test-GAME-2D/map-module/world-simulation/preflight.ts`
- types de resultat dans `test-GAME-2D/map-module/world-simulation/types.ts` ou module dedie
- panneau UI dans `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`

Contenu :

- verification des ids references ;
- verification des liens faction <-> objectif <-> mobile ;
- verification des positions et destinations mobiles ;
- verification des itineraires ;
- verification des routes inexistantes ;
- verification des objectifs sans actions compatibles ;
- verification des factions sans ancrage utile ;
- verification des cibles introuvables.

Definition de fini :

- l'editeur peut afficher une liste claire d'erreurs et warnings ;
- un layout incoherent est explicite avant simulation ;
- les references cassees ne demandent plus lecture manuelle du JSON.

Risque :

- vouloir faire trop de validation metier trop tot.

Approche :

- commencer par une validation structurelle simple ;
- ajouter ensuite les regles de coherence plus riches.

### Lot 2. Edition Guidee Des Positions Et Trajets

Objectif :

- remplacer les saisies fragiles par des interactions guidees.

Code cible :

- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`
- `test-GAME-2D/map-module/ui/editor/mapEditorReducer.ts`
- `test-GAME-2D/map-module/ui/editor/mapEditorLayoutUtils.ts`
- eventuellement petit helper UI dedie aux references simulation

Contenu :

- selecteurs guides pour `positionId`, `destinationId`, `targetId` ;
- support visible de `positionCell` et `destinationCell` ;
- picker carte pour fixer une position cellule ;
- picker de routes pour `itineraryRouteIds` ;
- bouton "calculer itineraire" ;
- bouton "vider itineraire" ;
- affichage de l'itineraire sur la carte.

Definition de fini :

- on ne tape plus a la main les ids critiques les plus sensibles ;
- un mobile peut etre positionne et route depuis l'UI ;
- l'itineraire peut etre lu visuellement.

Risque :

- disperser l'effort dans une grosse refonte UX.

Approche :

- d'abord les selecteurs guides ;
- ensuite le rendu visuel de l'itineraire ;
- enfin l'auto-calcul.

### Lot 3. Planner Logistique Minimal

Objectif :

- exposer dans l'editeur ce que le runtime sait deja calculer.

Code cible :

- `test-GAME-2D/map-module/world-simulation/logisticsPlanner.ts`
- nouveau helper de lecture dans `test-GAME-2D/map-module/world-simulation`
- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`

Contenu :

- panneau "logistique" par faction ou objectif ;
- affichage du mode recommande ;
- affichage des routes retenues ;
- affichage du cout estime ;
- affichage du risque ;
- affichage des raisons de blocage.

Definition de fini :

- avant de lancer la simu, on peut deja voir si un objectif est projetable ;
- les blocages majeurs sont visibles sans lancer plusieurs ticks.

Risque :

- coupler trop fort l'editeur au runtime.

Approche :

- reutiliser les structures `LogisticsPlanTrace` existantes ;
- ne pas dupliquer le calcul.

### Lot 4. PopulationProfile / Races

Objectif :

- ajouter la coherence de population dans les donnees editables.

Code cible :

- `test-GAME-2D/map-module/data/worldMapLayout.ts`
- `test-GAME-2D/map-module/ui/editor/mapEditorReducer.ts`
- `test-GAME-2D/map-module/ui/editor/mapEditorLayoutUtils.ts`
- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`
- `test-GAME-2D/map-module/world-simulation/types.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`

Contenu :

- definir un type partage `PopulationProfile` ;
- ajouter ce type aux villes ;
- ajouter ce type aux factions ;
- ajouter ce type aux mobiles en override optionnel ;
- heritages simples si non defini ;
- edition UI des groupes et poids ;
- validation de coherence de base.

Definition de fini :

- une ville et une faction peuvent porter un profil de population lisible ;
- un mobile peut heriter de sa faction ;
- ces donnees sont serialisees dans le layout.

Risque :

- surmodeliser trop tot.

Approche :

- commencer petit :
- `dominantGroupId`
- liste de groupes avec `groupId` et `weight`

### Lot 5. Quartiers Pilotables

Objectif :

- sortir du tout-derive sans tout casser.

Code cible :

- `test-GAME-2D/map-module/data/worldMapLayout.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`
- UI edition a definir dans `WorldMapEditorScreen.tsx`

Option recommandee :

- introduire des overrides de quartiers derives plutot que des quartiers manuels complets dans un premier temps.

Contenu :

- id de quartier derive ou override ;
- nom override ;
- activites dominantes override ;
- lieux importants override ;
- profil de population override ;
- tags ou ancrages locaux override.

Definition de fini :

- on peut personnaliser une ville sans reecrire tout le maillage runtime ;
- le `mapAdapter` applique les overrides proprement.

Risque :

- conflit entre derive et manuel.

Approche :

- les overrides ne remplacent que les champs explicitement definis.

### Lot 6. Zones De Faction

Objectif :

- permettre une coherence spatiale plus fine.

Code cible :

- `test-GAME-2D/map-module/data/worldMapLayout.ts`
- `test-GAME-2D/map-module/world-simulation/types.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`
- UI edition dans `WorldMapEditorScreen.tsx`

Contenu :

- `controlledZoneIds`
- `influencedZoneIds`
- `interestZoneIds`
- `avoidedZoneIds`

Definition de fini :

- une faction peut expliciter ou elle agit et ou elle n'agit pas ;
- ces zones sont visibles dans l'editeur.

Risque :

- confusion avec zones geo et politiques.

Approche :

- reutiliser les ids existants de villes, regions, routes, quartiers ou zones ;
- documenter clairement la semantique.

### Lot 7. Objectifs Riches

Objectif :

- donner plus de profondeur aux objectifs sans complexifier trop vite le moteur.

Code cible :

- `test-GAME-2D/map-module/data/worldMapLayout.ts`
- `test-GAME-2D/map-module/world-simulation/types.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`
- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`

Contenu :

- `phases`
- `currentPhaseIndex`
- consequences simples `onSuccess` / `onFailure`
- ancrage requis optionnel

Definition de fini :

- un objectif peut etre saisi avec plusieurs phases ;
- ses consequences minimales sont configurables depuis l'editeur.

Risque :

- faire grossir trop vite l'UI.

Approche :

- commencer par des listes simples et presets.

### Lot 8. Inspection Simulation Dans L'Editeur

Objectif :

- rapprocher edition et comprehension runtime.

Code cible :

- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`
- eventuellement composants UI simulation reutilisables

Contenu :

- lecture des pressions attendues ;
- lecture du plan logistique courant ;
- lecture des references d'entites liees ;
- vue synthese d'une faction ;
- vue synthese d'un objectif ;
- vue synthese d'un mobile.

Definition de fini :

- l'utilisateur peut relire ses donnees avant simulation sans ouvrir le JSON brut.

## Sequencement Recommande

### Sprint 1

- Lot 1 Preflight Simulation
- debut Lot 2 sur selecteurs guides

Livrable :

- l'editeur sait dire "ce layout est incoherent" ;
- les references majeures ne sont plus de simples champs texte libres.

### Sprint 2

- fin Lot 2
- Lot 3 Planner Logistique Minimal

Livrable :

- edition fiable des mobiles et trajets ;
- vue pre-simulation de la projection logistique.

### Sprint 3

- Lot 4 PopulationProfile / Races

Livrable :

- villes et factions ont des profils de population editables ;
- les mobiles peuvent heriter de ce profil.

### Sprint 4

- Lot 5 Quartiers Pilotables
- Lot 6 Zones De Faction

Livrable :

- personnalisation locale plus fine ;
- coherences spatiales de faction explicites.

### Sprint 5

- Lot 7 Objectifs Riches
- Lot 8 Inspection Simulation

Livrable :

- scenarios plus riches ;
- meilleure lisibilite avant lancement.

## Taches Techniques Initiales

Si on commence tout de suite, les premieres taches concretes a ouvrir sont :

1. creer un type `SimulationPreflightIssue`
2. creer `runSimulationPreflight(layout)`
3. afficher un panneau "Preflight" dans l'editeur
4. remplacer les champs `targetId`, `positionId`, `destinationId` par des selecteurs guides
5. exposer `positionCell` pour les mobiles de type `cell`
6. ajouter un bouton "auto-itineraire"
7. afficher l'itineraire du mobile selectionne sur la carte

## Definition De Fini Globale

Le chantier "edition avant simulation" sera considere sain quand :

- un utilisateur peut preparer une carte de simulation sans toucher au JSON brut ;
- les references critiques sont guidees par l'UI ;
- les incoherences principales sont detectees avant lancement ;
- les trajets et blocages sont visibles ;
- les profils de population sont configurables ;
- les donnees locales importantes ne sont plus seulement derivees de facon opaque.

## Ce Que Je Recommande De Faire Maintenant

Premier lot a implementer :

1. `Preflight Simulation`
2. `Selecteurs guides pour refs`
3. `Support clair des positions cellule`

C'est le meilleur point de depart parce que :

- il nettoie les donnees avant toute extension ;
- il prepare directement les lots trajets et races ;
- il a un bon ratio impact / complexite.
