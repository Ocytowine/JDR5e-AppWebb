# GameBoard - Documentation de fonctionnement

Objectif: expliquer le fonctionnement complet de `GameBoard` (logique, rendu, interactions, combat, IA) afin de faciliter l'evolution et la maintenance.

Cette documentation decrit le flux principal a partir des sources suivantes:
- `test-GAME-2D/src/GameBoard.tsx`
- `test-GAME-2D/src/render2d/*`
- `test-GAME-2D/src/game/*` (action engine, map, IA, vision, lighting)

## Guide de lecture
1. `test-GAME-2D/docs/gameboard/architecture.md`
2. `test-GAME-2D/docs/gameboard/state-model.md`
3. `test-GAME-2D/docs/gameboard/rendering-pipeline.md`
4. `test-GAME-2D/docs/gameboard/input-and-interactions.md`
5. `test-GAME-2D/docs/gameboard/combat-loop.md`
6. `test-GAME-2D/docs/gameboard/actions-and-resolution.md`
7. `test-GAME-2D/docs/gameboard/movement-and-pathfinding.md`
8. `test-GAME-2D/docs/gameboard/vision-and-lighting.md`
9. `test-GAME-2D/docs/gameboard/ai-and-reactions.md`
10. `test-GAME-2D/docs/gameboard/map-generation.md`

## Points d'entree du systeme
- UI racine: `test-GAME-2D/src/main.tsx` rend `<GameBoard />`.
- Composant principal: `test-GAME-2D/src/GameBoard.tsx`.
- Rendu Pixi: `test-GAME-2D/src/render2d/board/usePixiBoard.ts` et couches `test-GAME-2D/src/render2d/layers/*`.
- Moteur d'actions: `test-GAME-2D/src/game/actionEngine.ts`.
- Vision: `test-GAME-2D/src/vision.ts`.
- Lumiere: `test-GAME-2D/src/lighting.ts`.
- Map: `test-GAME-2D/src/game/mapEngine.ts` + pipeline `test-GAME-2D/src/game/map/*`.

## Glossaire rapide
- Token: entite de combat (joueur, ennemi, invocation). Type `TokenState`.
- Map grid: grille logique cols/rows, distincte du zoom/pan du canvas.
- Action: action definie via JSON, resolue par l'action engine.
- Reaction: action declenchee par un evenement (vision, movement, etc.).
- Effect: zone/FX sur la grille (aura, hazard, zone d'effet, etc.).

## Notes d'implementation
- Les documents citent des fonctions et structures, mais ne remplacent pas la lecture du code.
- Les references de fichiers sont indiquees entre backticks.
