# Generation de map

Sources principales:
- `test-GAME-2D/src/game/map/generation/mapEngine.ts`
- `test-GAME-2D/src/game/map/generation/pipeline.ts`
- `test-GAME-2D/src/GameBoard.tsx`

## Demarrage
`handleStartCombat` appelle `generateBattleMap` avec:
- `prompt` (texte libre)
- `grid` (cols/rows)
- `enemyCount`
- `enemyTypes`, `obstacleTypes`, `wallTypes`

## Resultat `MapDesignResult`
Champs importants:
- `grid`, `playerStart`, `enemySpawns`.
- `playableCells` (masque jouable `x,y`).
- `obstacles`, `wallSegments`, `decorations`.
- `terrain`, `height`, `light`, `roofOpenCells`.
- `theme`, `paletteId`.
- `generationLog` et `summary`.

## Redimensionnement auto
Si `recommendedGrid` est plus grand que la grille actuelle:
- `GameBoard` redemarre la generation jusqu'a 3 fois.
- `pushLog` indique la nouvelle taille.

## Application dans GameBoard
Une fois la map generee:
- `setMapGrid`, `setMapTerrain`, `setMapLight`, `setPlayableCells`.
- `setObstacles`, `setWallSegments`, `setDecorations`.
- `setPlayer` positionne le joueur sur `playerStart`.
- Creation des ennemis avec `createEnemy`.
- `buildEffectsFromObstacles` pour les effets initiaux.

## Prechargement visuel
- `queueMapTexturePreload` charge les sprites tokens/obstacles/decors.
- UI affiche `isTextureLoading` si necessaire.

## Notes
- `mapHeight` est aplati a 0 par defaut (pas d'etage) dans `handleStartCombat`.
- `mapPrompt` permet d'influencer le pipeline sans changer le code.


