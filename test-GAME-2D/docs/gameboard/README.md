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
- Moteur d'actions: `test-GAME-2D/src/game/engine/core/actionEngine.ts`.
- Vision: `test-GAME-2D/src/vision.ts`.
- Lumiere: `test-GAME-2D/src/lighting.ts`.
- Map: `test-GAME-2D/src/game/map/generation/mapEngine.ts` + pipeline `test-GAME-2D/src/game/map/generation/*` + runtime `test-GAME-2D/src/game/map/runtime/*`.

## Index rapide (probleme -> fichiers)
- LOS/vision: `test-GAME-2D/src/vision.ts`, `test-GAME-2D/src/lineOfSight.ts`, `test-GAME-2D/src/render2d/layers/usePixiOverlays.ts`.
- Lumiere/tints: `test-GAME-2D/src/lighting.ts`, `test-GAME-2D/src/render2d/layers/usePixiOverlays.ts`.
- Pathfinding: `test-GAME-2D/src/pathfinding.ts`, `test-GAME-2D/src/game/engine/core/actionEngine.ts`.
- Actions et resolution: `test-GAME-2D/src/game/engine/core/actionEngine.ts`, `test-GAME-2D/src/game/engine/core/*`, `test-GAME-2D/src/game/engine/rules/*`, `test-GAME-2D/src/game/engine/runtime/*`, `test-GAME-2D/src/GameBoard.tsx`.
- Reactions: `test-GAME-2D/src/GameBoard.tsx`, `test-GAME-2D/src/game/reactionTypes.ts`.
- Initiative/tours: `test-GAME-2D/src/GameBoard.tsx` (fonctions `rollInitialInitiativeIfNeeded`, `advanceTurn`).
- Overlays/FX: `test-GAME-2D/src/render2d/layers/usePixiOverlays.ts`, `test-GAME-2D/src/render2d/layers/usePixiEffects.ts`.
- Generation map: `test-GAME-2D/src/game/map/generation/mapEngine.ts`, `test-GAME-2D/src/game/map/generation/*`, `test-GAME-2D/src/game/map/runtime/*`.

## Flux d'evenements (clic -> action -> rendu)
1. Clic plateau -> `handleBoardClick` (conversion screen->grid).
2. Validation de cible/mode (target/inspect/interact/move).
3. Ouverture du contexte d'action (`ActionContextWindow`) si besoin.
4. Validation + resolution via `resolveActionUnified` (action engine).
5. Mise a jour des etats (`player`, `enemies`, `effects`, logs).
6. Reactions eventuelles (queue ou auto-resolve).
7. Hooks Pixi re-rendent les couches (tokens/overlays/effects).

## Points d'extension (ou ajouter quoi)
- Nouvelle action: JSON + `loadActionTypesFromIndex` + `actionEngine` si nouveaux ops.
- Nouvelle reaction: JSON + validation `checkReactionConditions`.
- Nouvel overlay: nouveau hook dans `test-GAME-2D/src/render2d/layers/*`.
- Nouveau type d'effet: `effectCatalog` + rendu `usePixiEffects`.
- Nouveau mode interaction: etendre `BoardInteractionMode` + handler dans `GameBoard`.

## Glossaire rapide
- Token: entite de combat (joueur, ennemi, invocation). Type `TokenState`.
- Map grid: grille logique cols/rows, distincte du zoom/pan du canvas.
- Action: action definie via JSON, resolue par l'action engine.
- Reaction: action declenchee par un evenement (vision, movement, etc.).
- Effect: zone/FX sur la grille (aura, hazard, zone d'effet, etc.).

## Notes d'implementation
- Les documents citent des fonctions et structures, mais ne remplacent pas la lecture du code.
- Les references de fichiers sont indiquees entre backticks.


