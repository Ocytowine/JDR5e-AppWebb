# Time Model Runtime Plan

## Statut

Document de reference actif.

Ce document fige le modele de temps cible pour `test-GAME-2D/map-module`.

Regle de gouvernance :

- ce document devient la source de verite pour les unites de temps ;
- les choix de calibration doivent converger vers ce modele ;
- les modifications de `world-simulation` doivent rester compatibles avec cette definition ;
- si une implementation existante diverge, c'est elle qui doit etre alignee sur ce document, pas l'inverse.

## But

Donner une definition simple, stable et exploitable du temps de simulation.

Le but est de rendre coherents :

- la mobilite ;
- les cooldowns ;
- la fatigue ;
- l'usure territoriale ;
- les objectifs ;
- les traces runtime ;
- la lecture produit dans l'editeur.

## Probleme Actuel

Le runtime dispose deja de :

- `tick`
- `microTick`
- `macroTick`
- `microPerMacro`

Mais la semantique reste encore trop ambiguë :

- `tick` incremente aussi bien sur un tick `micro` que `macro` ;
- `macro` se comporte encore partiellement comme un mode d'execution, et pas seulement comme une frontiere de cycle ;
- la correspondance avec le temps classique n'est pas explicite ;
- la calibration du deplacement reste plus difficile qu'elle ne devrait.

Effet produit :

- le systeme fonctionne ;
- mais il est plus dur a raisonner, a expliquer et a equilibrer.

## Definition Cible

### Unite De Base

`1 microTick = 1 heure`

Le `microTick` est l'unite atomique du monde.

Il porte :

- les deplacements ;
- les actions courtes ;
- les evenements locaux ;
- les embuscades, retards et arrivées ;
- la progression immediate des acteurs.

### Unite De Cycle

`1 macroTick = 6 microTicks = 6 heures`

Le `macroTick` n'est pas une seconde horloge concurrente.

C'est un palier de resolution lente du monde.

Il porte :

- l'usure territoriale ;
- la maintenance logistique ;
- les recalages systemiques ;
- les generations d'objectifs systemiques ;
- les effets lents de stabilisation ou degradation.

### Jour

`1 jour = 24 heures = 4 macroTicks = 24 microTicks`

Cette definition doit devenir la base de lecture produit.

## Invariants

1. Le `microTick` est l'unite de temps fondamentale.
2. Le `macroTick` est un regroupement de `microTicks`.
3. Le monde ne doit plus etre pense comme avançant tantot en micro, tantot en macro de maniere equivalente.
4. Tous les evenements doivent rester localisables sur un `microTick`.
5. Les effets macro doivent etre des traitements de fin de cycle, pas une seconde simulation parallele.
6. La calibration de la mobilite doit se lire en heures.
7. La lecture produit doit pouvoir convertir simplement les ticks en temps classique.

## Mobilite Cible

### Référence Humaine

Reference de base :

- un humain normal franchit `0.5 hex / heure`

Donc :

- `1 microTick` = `0.5 hex`
- `1 macroTick` = `3 hex`
- `1 jour` = `12 hex`

Cette convention doit devenir la reference de calibration.

### Vitesses Recommandees

Socle simple recommande :

- `lent` = `0.25 hex / heure`
- `normal` = `0.5 hex / heure`
- `rapide` = `0.75 hex / heure`
- `tres_rapide` = `1 hex / heure`

Ces paliers servent de lecture produit.

Ils peuvent ensuite etre modules par :

- terrain ;
- fatigue ;
- charge ;
- risque ;
- qualite de route ;
- mode de transport.

## Interpretation Des Couts

Le systeme doit converger vers une lecture horaire.

Principe cible :

- un cout de trajet doit etre interpretable comme une duree effective ;
- la progression par tick doit donc representer une progression horaire.

Le point important n'est pas de renommer partout immediatement.

Le point important est :

- garder une convention unique ;
- ne pas avoir une logique implicite concurrente.

## Répartition Des Systèmes Dans Le Temps

### Systeme Micro

Doivent vivre au niveau `microTick` :

- deplacement des mobiles ;
- recalcul de progression locale ;
- resolution d'actions courtes ;
- fatigue immediate ;
- retards, embuscades, reroutes ;
- evenements de terrain ;
- opportunites locales.

### Systeme Macro

Doivent vivre au niveau `macroTick` :

- usure territoriale ;
- friction commerciale lente ;
- degradation de securite structurelle ;
- generation d'objectifs systemiques ;
- maintenance publique ;
- corrections systemiques de fond.

### Systeme Journalier

Doivent idealement se lire a l'echelle du jour :

- consommation ou maintenance lourde ;
- bilan de stabilite ;
- relecture des fronts principaux ;
- reinitialisations journalieres futures si necessaire.

Le jour n'a pas besoin d'etre un type runtime separe dans l'immédiat.

Il suffit qu'il soit derivable simplement :

- `4 macroTicks`
- ou `24 microTicks`

## Modèle Runtime Recommandé

### Horloge

Le contrat mental cible est :

- `microTick` avance toujours d'une heure ;
- `macroTick` incremente quand un cycle de 6 microTicks est complete ;
- `tick` global ne doit plus etre interprete comme une unite metier autonome.

### API Cible

Direction recommandee :

1. `advanceMicroTick(state)`
- avance le monde d'une heure

2. `shouldRunMacroStep(state)`
- detecte la fin d'un cycle de 6 heures

3. `runMacroStep(state)`
- applique les effets lents

4. `runSimulationStep(state)`
- execute toujours le micro ;
- puis declenche le macro si la frontiere de cycle est atteinte.

Le moteur peut conserver `runWorldTick()` transitoirement, mais la cible conceptuelle doit converger vers ce modele.

## Lecture Produit Recommandee

Le produit doit pouvoir afficher simplement :

- `heure courante`
- `cycle 6h courant`
- `jour courant`

Exemples de presentation :

- `Heure 13`
- `Cycle 3 / 4`
- `Jour 5`

Ou, si l'on veut rester plus technique :

- `Micro 13`
- `Macro 2`
- `Jour 1`

Mais le plus important est de garder une traduction lisible en temps classique.

## Impacts Attendus

### Sur La Mobilite

Effets positifs attendus :

- vitesse plus facile a calibrer ;
- arrivees plus faciles a prevoir ;
- fatigue plus naturelle a doser ;
- meilleure lisibilite du temps de trajet.

### Sur Les Cooldowns

Effets positifs attendus :

- un cooldown peut enfin se lire comme une duree ;
- exemple :
  - `1` = 1 heure ;
  - `6` = 6 heures ;
  - `24` = 1 jour.

### Sur Les Objectifs

Effets positifs attendus :

- meilleure lecture du rythme de progression ;
- meilleure lecture des blocages ;
- possibilite de raisonner plus proprement sur des delais.

### Sur L'UI

Effets positifs attendus :

- explications plus simples ;
- traces plus lisibles ;
- meilleur lien entre carte, runtime et temps vecu.

## Roadmap Recommandee

### Phase 1 - Gel De La Definition

Statut cible : `immediate`

Travail :

- valider la convention horaire ;
- faire de ce document la reference ;
- eviter toute divergence supplementaire.

Definition of done :

- le temps cible est fige.

### Phase 2 - Audit Du Code

Travail :

- relire `types.ts`, `engine.ts`, `travel.ts`, `mapAdapter.ts` ;
- reperer les endroits ou `micro`, `macro` et `tick` sont encore ambigus ;
- lister les mecanismes qui doivent rester micro et ceux qui doivent devenir macro.

Definition of done :

- une liste claire des points a aligner existe.

### Phase 3 - Alignement De L'Horloge

Travail :

- consolider la semantique de l'horloge ;
- clarifier le role de `tick` ;
- faire converger le moteur vers une logique "micro de base, macro de cycle".

Definition of done :

- la progression du temps est compréhensible et stable.

### Phase 4 - Calibration Mobilite

Travail :

- aligner les vitesses sur la reference horaire ;
- verifier la cohérence avec le terrain et les routes ;
- etablir un tableau de vitesse produit simple.

Definition of done :

- un humain normal se lit correctement comme `0.5 hex / heure`.

### Phase 5 - Exposition UI

Travail :

- exposer l'heure, le cycle 6h et le jour dans les traces ou panneaux utiles ;
- rendre les cooldowns et durees lisibles en heures.

Definition of done :

- l'utilisateur peut lire le temps sans devoir interpréter la technique du moteur.

## Fichiers A Relire En Priorite

- `test-GAME-2D/map-module/world-simulation/types.ts`
- `test-GAME-2D/map-module/world-simulation/engine.ts`
- `test-GAME-2D/map-module/world-simulation/travel.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`
- `test-GAME-2D/map-module/ui/WorldMapSimulationScreen.tsx`
- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`

## Decision Gelee

La convention gelee par ce document est :

- `1 microTick = 1 heure`
- `1 macroTick = 6 heures`
- `1 jour = 4 macroTicks = 24 heures`
- `vitesse humaine standard = 0.5 hex / heure`

Tout futur travail sur la simulation doit partir de cette base.
