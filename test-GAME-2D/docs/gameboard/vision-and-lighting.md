# Vision et lumiere

Sources principales:
- `test-GAME-2D/src/vision.ts`
- `test-GAME-2D/src/lighting.ts`
- `test-GAME-2D/src/render2d/layers/usePixiOverlays.ts`

## Vision
- Chaque `TokenState` a un `VisionProfile` (cone ou cercle).
- `computeVisionEffectForToken` genere les cellules dans le champ.
- Direction du cone via `facing` ou `getFacingForToken`.
- `isCellVisible` et `isTargetVisible` combinent zone de vision, LOS (`hasLineOfSight`) et niveau de lumiere (seuil selon le mode).

## Visibility levels
`computeVisibilityLevelsForToken`:
- Shadowcasting sur la grille pour determiner les zones visibles.
- Filtre la vision en cone si necessaire.
- Retourne une map `Map<string, VisibilityLevel>`.

## Lumiere
`computeLightLevels`:
- Combine `mapLight` (ambient) + `lightSources`.
- Applique un blocage par `closedCells` et `roofOpenCells`.
- Tient compte des obstacles et murs (LOS).

`computeLightTints`:
- Calcule une teinte couleur selon la contribution des sources.

Modes de vision (`LightVisionMode`):
- `normal`: requiert `LIGHT_LEVEL_SHADOW_MIN`.
- `lowlight`: reserve.
- `darkvision`: ignore le niveau de lumiere.

## Overlays
- `usePixiOverlays` dessine fog, grille, zones d'effet.
- `showVisionDebug`, `showLightOverlay`, `showFogSegments` pilotent l'affichage.
- `playerTorchOn` ajoute une source de lumiere locale.

## Niveaux et hauteur
- `mapHeight` + `activeLevel` filtrent les cellules visibles.
- `getHeightAtGrid` est utilise par GameBoard pour restreindre la vision.
