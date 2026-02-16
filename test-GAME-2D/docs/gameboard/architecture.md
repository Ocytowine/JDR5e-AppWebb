# Architecture de GameBoard

## Vue d'ensemble
`GameBoard` est un composant React monolithique qui orchestre:
- Le chargement de catalogues (actions, ennemis, obstacles, effets, etc.).
- La generation de la battlemap.
- La gestion de l'etat de combat (initiative, tours, ressources, reactions).
- Le rendu Pixi (fond, tokens, overlays, FX).
- Les interactions utilisateur (clics, menus radiaux, selection de cibles).
- L'IA ennemie et la narration.

## Modules principaux
- Composant racine: `test-GAME-2D/src/GameBoard.tsx`.
- Rendu Pixi et couches: `test-GAME-2D/src/render2d/board/usePixiBoard.ts` + `test-GAME-2D/src/render2d/layers/*`.
- Core combat/action: `test-GAME-2D/src/game/engine/core/actionEngine.ts`.
- Plan d'actions: `test-GAME-2D/src/game/engine/core/actionPlan.ts`.
- Vision: `test-GAME-2D/src/vision.ts`.
- Lumiere: `test-GAME-2D/src/lighting.ts`.
- Map generation: `test-GAME-2D/src/game/map/generation/mapEngine.ts`.
- Pathfinding: `test-GAME-2D/src/pathfinding.ts`.

## Separation des responsabilites
- `GameBoard` assemble la logique et declenche les moteurs (actions, IA, map). Il garde la quasi totalite de l'etat local.
- `render2d` rend l'etat du plateau via Pixi, sans logique de combat.
- `actionEngine` applique les actions et retourne des etats derives.
- `vision` et `lighting` fournissent des utilitaires de calcul.

## Flux d'execution global
1. Montant du composant: chargement des catalogues (actions, ennemis, items, etc.).
2. Lancement du combat via `handleStartCombat`.
3. Generation de map via `generateBattleMap`.
4. Initialisation du plateau (obstacles, murs, terrain, tokens, FX).
5. Rendu Pixi (board + couches).
6. Boucle de combat: initiative -> tours -> resolution actions -> reactions.
7. Mise a jour du rendu et des overlays a chaque changement d'etat.

## Donnees d'entree externes
- JSON de catalogues (actions, ennemis, obst., etc.) dans `test-GAME-2D/src/data/*`.
- Donnees de personnage du createur via `sampleCharacter` ou `localStorage`.
- Resultat de generation de map (pipeline interne).
- IA et narration via `narrationClient`.

## Points d'extension
- Nouveaux types de catalogues ou d'actions: ajouter dans `test-GAME-2D/src/game/*` et charger dans `GameBoard`.
- Nouveaux overlays/FX: ajouter couche Pixi dans `test-GAME-2D/src/render2d/layers/*`.
- Nouveaux modes d'interaction: etendre `BoardInteractionMode` et les handlers dans `GameBoard`.


