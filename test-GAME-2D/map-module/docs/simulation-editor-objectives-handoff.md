# Simulation Editor And Objectives Handoff

## But

Ce document sert de handoff complet pour relancer le chantier sur une autre discussion IA.

Le sujet couvre :

- l'editeur simulation dans `map-module` ;
- le refactor UX des factions, objectifs et mobiles ;
- le comportement runtime des objectifs dans `world-simulation` ;
- la prochaine priorite produit : rendre les objectifs lisibles sur la carte pendant la creation et la modification.

Le bon angle n'est pas de reconstruire un systeme neuf. Le bon angle est :

- conserver le runtime existant ;
- clarifier les workflows d'edition ;
- rendre les objectifs compréhensibles visuellement ;
- puis seulement renforcer la logique runtime d'echec / reussite / phases.

## Contexte

Le module vit dans :

- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`
- `test-GAME-2D/map-module/ui/editor/MapEditorToolbar.tsx`
- `test-GAME-2D/map-module/data/worldMapLayout.ts`
- `test-GAME-2D/map-module/world-simulation/*`

Le document de reference deja present dans le repo est :

- `test-GAME-2D/map-module/docs/world-simulation-integration.md`

## Etat Actuel De L'Editeur

### Volet Simulation

Le volet `Simulation` a deja ete restructure avec 4 onglets principaux :

- `Inspection`
- `Factions`
- `Objectifs`
- `Mobiles`

L'objectif de cette separation est deja en place :

- `Inspection` depend de la case selectionnee ;
- `Factions`, `Objectifs` et `Mobiles` ont leur propre logique d'edition ;
- l'inspection et l'edition ne sont plus le meme flux.

### Factions

Dans `Factions` :

- `Creer` est maintenant un vrai flux de creation ;
- `Modifier` passe par des pastilles cliquables de factions existantes ;
- il n'y a plus de select parasite en creation ;
- une note UX indique deja qu'une faction peut etre nomade.

Important :

- une faction nomade est deja possible dans le systeme actuel ;
- elle n'a pas besoin de `homeCityId` ;
- mais elle doit garder au moins une `homeRegionId` ou des `presenceCells` ;
- sinon le preflight la considere comme faction sans ancrage.

### Objectifs

Dans `Objectifs` :

- `Creer` demande explicitement la faction porteuse ;
- `Modifier` suit un flux `Faction -> Objectif` ;
- un bloc `Cible active` a ete ajoute pour clarifier l'objectif en cours.

Limite actuelle :

- la lecture dans le panneau est correcte ;
- la lecture sur la carte est encore insuffisante ;
- il est difficile de voir immediatement qui est concerne, ou, et quoi.

### Mobiles

Dans `Mobiles` :

- `Creer` est maintenant un vrai wizard de creation ;
- on saisit directement le nom et l'id ;
- on choisit explicitement la faction ;
- `Modifier` suit un flux `Faction -> Mobile` via pastilles.

Les mobiles sans faction ne doivent pas etre remis au centre de l'UX.

## Etat Actuel Du Runtime Objectif

Le runtime existe deja dans :

- `test-GAME-2D/map-module/world-simulation/engine.ts`
- `test-GAME-2D/map-module/world-simulation/definitions.ts`
- `test-GAME-2D/map-module/world-simulation/objectiveReadiness.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`

### Ce Qui Marche Deja

Aujourd'hui, un objectif runtime sert principalement a :

- filtrer les actions autorisees ;
- fournir une cible ;
- fournir une priorite ;
- suivre une progression scalaire `progress` ;
- appliquer `onSuccess` quand `progress >= 100`.

Pipeline reel :

1. le layout est adapte en `WorldState` ;
2. chaque faction ou mobile prend son meilleur objectif non `completed`, non `failed`, non `blocked` ;
3. le moteur genere des actions candidates compatibles ;
4. il garde la meilleure action valide pour l'acteur ;
5. il resout cette action en succes ou echec ;
6. il applique les effets de l'action ;
7. la progression d'objectif augmente si l'action a un effet `objective_progress`.

### Ce Qui Ne Marche Pas Encore Comme Produit Fini

Il y a plusieurs limites importantes :

1. un echec d'action n'entraine pas automatiquement un echec d'objectif ;
2. l'etat `failed` existe dans les types, mais il n'y a pas de logique runtime forte qui l'alimente ;
3. `onSuccess` est branche, mais `onFailure` n'est pas exploite comme mecanique complete ;
4. les `phases` d'objectif sont surtout des donnees editoriales, pas encore une vraie machine d'etat runtime ;
5. la lecture carte d'un objectif en edition reste trop faible.

## Probleme Produit Prioritaire

Le besoin prioritaire maintenant est :

- rendre l'objectif clairement lisible sur la carte pendant la creation ou la modification.

La carte doit repondre immediatement a trois questions :

- `Qui` porte cet objectif ?
- `Quoi` est vise ?
- `Ou` cela se passe ?

Aujourd'hui, ces informations sont partiellement lisibles dans le panneau, mais insuffisamment visibles dans la carte.

## Cible Produit

### Cible UX

Quand un objectif est en cours de creation ou modification :

- la faction porteuse doit etre evidente ;
- la cible principale doit etre evidente ;
- les zones d'operation doivent etre evidentes ;
- la difference entre cible principale et zone d'action doit etre evidente.

### Cible Carte

La carte doit afficher une preview en temps reel du brouillon ou de l'objectif selectionne.

Cette preview doit utiliser 4 couches :

1. `Owner`
- couleur de la faction porteuse ;
- rappel visuel discret mais stable.

2. `Primary target`
- ville, quartier, route, region ou faction ciblee ;
- visuel le plus fort.

3. `Objective zone`
- cellules ou zones `zoneIds` ;
- visuel plus diffus que la cible principale.

4. `Current edit preview`
- preview live pendant la creation ou la modification ;
- mise a jour immediate au changement de faction, cible ou zone.

## Schéma Runtime Recommande

Le runtime cible recommande pour les objectifs est :

1. `planned`
- objectif defini mais pas encore executable.

2. `active`
- objectif en execution normale.

3. `blocked`
- objectif temporairement non executable.

4. `completed`
- progression a 100 ;
- `onSuccess` applique.

5. `failed`
- atteint via logique explicite ;
- `onFailure` applique.

### Règle D'Echec Recommandee

Ajouter sur l'objectif runtime :

- `failureScore`
- `maxFailureScore`
- `fatalFailureConditions`

Interpretation recommandee :

- succes d'action : fait monter `progress` ;
- echec d'action : peut faire monter `failureScore` ;
- si `progress >= 100` : `completed` ;
- si `failureScore >= maxFailureScore` : `failed`.

### Phases Recommandees

Les `phases` ne doivent plus etre seulement editoriales.

Chaque phase devrait porter :

- un sous-objectif ou sous-seuil ;
- une liste d'actions compatibles ;
- une cible locale eventuelle ;
- des prerequis.

Exemple pour `open_route` :

1. reconnaissance
2. securisation
3. escorte
4. maintien

## Plan De Travail Recommande

### Phase 1 - Preview Carte Des Objectifs

But :

- rendre la lecture carte immediate pendant `Objectifs > Creer` et `Objectifs > Modifier`.

Travail attendu :

1. construire un modele derive `objectiveMapPreview` dans `WorldMapEditorScreen.tsx` ;
2. y inclure :
   - faction porteuse ;
   - couleur de faction ;
   - cible principale ;
   - zones ;
   - ancrage ;
   - mode `create|modify` ;
3. brancher ce modele au rendu carte ;
4. surligner :
   - les cellules `zoneIds` ;
   - la route ciblee ;
   - la ville ou region ciblee ;
   - l'ancrage si pertinent ;
5. ajouter un petit resume fixe `Qui / Quoi / Ou` dans le panneau objectif.

Definition of done :

- quand un objectif est en edition, on voit nettement la zone d'action ;
- on distingue la cible principale du reste ;
- le changement de faction ou de cible met a jour la carte en direct.

### Phase 2 - Nettoyage UX Des Objectifs

But :

- fiabiliser le workflow d'edition objectif autour de la preview carte.

Travail attendu :

1. clarifier les libelles `cible principale`, `zone d'action`, `ancrage requis` ;
2. rendre plus explicite l'etat actuel :
   - faction ;
   - objectif ;
   - cible ;
   - nombre de zones ;
3. verifier la coherence du flux `Faction -> Objectif` ;
4. eviter toute dependance implicite restante a une selection de case non voulue.

Definition of done :

- le workflow objectif peut etre utilise sans ambiguite ;
- la cible editee est toujours identifiable.

### Phase 3 - Runtime Objectif V2

But :

- faire des objectifs autre chose qu'un simple filtre d'actions.

Travail attendu :

1. ajouter `failureScore` et `maxFailureScore` ;
2. brancher `onFailure` dans le runtime ;
3. definir des conditions de bascule `failed` ;
4. garder la compatibilite avec les objectifs existants ;
5. tracer les raisons d'echec dans les sorties du tick.

Definition of done :

- un objectif peut echouer de facon lisible et deterministe ;
- les evenements de tick permettent de comprendre pourquoi.

### Phase 4 - Phases D'Objectif Runtime

But :

- transformer `phases` en vraie progression structurante.

Travail attendu :

1. definir la representation runtime minimale d'une phase ;
2. restreindre les actions compatibles par phase ;
3. permettre le passage de phase sur conditions ;
4. exposer la phase active dans l'editeur.

Definition of done :

- la progression ne repose plus uniquement sur un pourcentage global ;
- le comportement d'un objectif change selon son etape.

### Phase 5 - Polish Carte Et Debug

But :

- rendre le systeme praticable sur des layouts plus gros.

Travail attendu :

1. doser les niveaux d'intensite visuelle ;
2. eviter une carte surchargee si plusieurs objectifs existent ;
3. garder seulement l'objectif actif fortement visible ;
4. fournir un mode debug ou lecture systeme si utile.

Definition of done :

- la carte reste lisible ;
- la preview d'objectif apporte de la comprehension au lieu d'ajouter du bruit.

## Fichiers A Relire En Priorite

Pour reprendre le chantier, commencer par :

- `test-GAME-2D/map-module/ui/WorldMapEditorScreen.tsx`
- `test-GAME-2D/map-module/data/worldMapLayout.ts`
- `test-GAME-2D/map-module/world-simulation/engine.ts`
- `test-GAME-2D/map-module/world-simulation/mapAdapter.ts`
- `test-GAME-2D/map-module/world-simulation/objectiveReadiness.ts`
- `test-GAME-2D/map-module/world-simulation/definitions.ts`
- `test-GAME-2D/map-module/docs/world-simulation-integration.md`

## Contraintes A Respecter

1. ne pas casser la compatibilite des layouts existants ;
2. ne pas refaire un moteur alternatif ;
3. garder `world-simulation` comme source de verite runtime ;
4. traiter d'abord la lisibilite editeur / carte avant une refonte profonde du runtime ;
5. faire des lots courts et verifiables ;
6. verifier le build apres chaque lot.

## Verification Minimale Attendue

Apres chaque phase significative :

- lancer `npm run build` dans `test-GAME-2D` ;
- verifier le flux `Objectifs > Creer` ;
- verifier le flux `Objectifs > Modifier` ;
- verifier qu'un objectif selectionne reste lisible sur la carte ;
- verifier que les factions et mobiles existants ne regressent pas.

## Prochaine Action Recommandee

Le prochain chantier a lancer dans une autre discussion IA est :

- `Phase 1 - Preview Carte Des Objectifs`

En pratique :

- construire une preview carte live pour l'objectif en cours d'edition ;
- surligner clairement la cible principale et les zones ;
- utiliser la couleur de la faction porteuse comme accent visuel principal.
