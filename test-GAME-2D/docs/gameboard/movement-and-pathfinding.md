# Mouvement et pathfinding

Sources principales:
- `test-GAME-2D/src/GameBoard.tsx`
- `test-GAME-2D/src/pathfinding.ts`
- `test-GAME-2D/src/game/movementModes.ts`

## Modes de mouvement
- Le personnage a des `movementModes` derives des features.
- Le mode actif definit `speed` (en metres) et contraintes.
- Conversion en cellules via `metersToCells`.

## Budget de mouvement
- `pathLimit` correspond a la distance restante.
- `basePathLimit` = vitesse de base au debut du tour.
- `movementSpent` suit la consommation.

## Construction du chemin
- En mode `moving`, chaque clic ajoute des segments.
- `computePathTowards` trouve un chemin.
- Le chemin est concatene a `selectedPath`.
- Le cout est calcule via `computePathCost`.

## Restrictions prises en compte
- `playableCells` limite la zone jouable.
- `obstacleBlocking.movement` bloque des cases.
- `wallEdges.movement` bloque les passages.
- `mapHeight` et `activeLevel` interdisent le cross-level.
- `floorIds` et `moveCost` ralentissent les mouvements.

## Pathfinding (computePathTowards)
- Heuristique type Dijkstra (cout) avec heap.
- Support 4 ou 8 directions selon `MovementProfile`.
- Verification des diagonales (pas de coin-corner cutting).
- Autorise `allowTargetOccupied` si la cible doit etre atteinte.

## Application du mouvement
- `resolveActionUnified` applique le mouvement via plan d'action.
- Les ennemis utilisent aussi `computePathTowards` en fallback IA.
- Le mouvement peut declencher des reactions `movement.*`.
