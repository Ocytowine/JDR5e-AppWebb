# Pipeline de rendu (Pixi)

Sources principales:
- `test-GAME-2D/src/render2d/board/usePixiBoard.ts`
- `test-GAME-2D/src/render2d/layers/*`
- `test-GAME-2D/src/GameBoard.tsx`

## Initialisation Pixi
`usePixiBoard` cree un `Application` Pixi et installe un arbre de couches.
Ordre de construction du stage:
1. `gridLayer` (fond + terrain de base)
2. `terrainNaturalLayer`
3. `terrainFxLayer`
4. `terrainLabelLayer`
5. `pathLayer`
6. `labelLayer`
7. `staticDepthLayer`
8. `dynamicDepthLayer`
9. `speechLayer`

Le redimensionnement est gere par `ResizeObserver` et `window.resize`.
La camera applique un scale (`zoom`) et un offset (`pan`) sur le root.

## Zoom, pan, viewport
- Calcules dans `usePixiBoard` via `baseScale * zoom`.
- `viewportRef` contient `scale`, `offsetX`, `offsetY`.
- `GameBoard` utilise `viewportRef` pour convertir les clicks (screen -> grid).

## Rendu du terrain de base
`usePixiBoard` dessine une grille de tuiles avec:
- Couleur de sol via `getFloorMaterial`.
- Mix de terrain via `terrainMix`.
- Mise en cache texture (`cacheAsTexture = true`).

## Couches Pixi (render2d)
- `usePixiNaturalTiling`: textures de terrain naturelles.
- `usePixiObstacles`: obstacles, couches et sprites.
- `usePixiTokens`: tokens joueur/ennemis.
- `usePixiWalls`: murs et segments.
- `usePixiDecorations`: decors (SVG/PNG).
- `usePixiEffects`: effets (auras, hazards, FX).
- `usePixiSpeechBubbles`: bulles de dialogue.
- `usePixiOverlays`: vision, fog, grille, selection, zones d'effet.
- `usePixiTerrainFx`: vent, bump, effets surface.
- `usePixiGridLabels`: labels debug.

## Gestion du framerate
`GameBoard` ajuste `maxFps` en fonction de l'activite:
- Mode idle (pas d'action, pas de path, pas de drag): FPS reduit.
- Mode actif: FPS plus eleve.

`usePixiBoard` peut desactiver l'animation (render manuel via `renderTick`).

## Overlay vision / fog / light
`usePixiOverlays` compose plusieurs calques:
- `pathLayer`: trajets et zones.
- `fogLayer`: brouillard/fog-of-war.
- `lightLayer`: tints de lumiere et halo.

## Prechargement des textures
`GameBoard` precharge les sprites tokens/obstacles/decors:
- `preloadTokenPngTexturesFor`
- `preloadObstaclePngTexturesFor`
- `preloadDecorTexturesFor`
Cela alimente l'UI de chargement (`isTextureLoading`, `textureLoadingHint`).

## Notes
- Le rendu ne modifie pas l'etat de combat.
- Toute logique (actions, IA, ressources) reste dans `GameBoard`.
