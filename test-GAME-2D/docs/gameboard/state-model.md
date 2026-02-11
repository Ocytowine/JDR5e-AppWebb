# Modele d'etat

Source principale: `test-GAME-2D/src/GameBoard.tsx`.

## Etat de personnage
- `characterConfig`: configuration issue du createur.
- `combatCharacterConfig`: snapshot utilise pendant le combat.
- `activeCharacterConfig`: choix entre les deux (combat ou design).
- `player`: `TokenState` du joueur avec position, PV, profil de vision, etc.
- Derives via `useMemo`: `movementModes`, `defaultMovementProfile`, `playerCombatStats`.

## Etat des entites
- `enemyTypes`: definitions de type (catalogue).
- `enemies`: liste de `TokenState` ennemis et invocations.
- `obstacleTypes`, `obstacles`: definitions et instances d'obstacles.
- `effectTypes`, `effects`: definitions et instances d'effets.
- `statusTypes`, `featureTypes`: catalogues pour statuts/fonctions.
- `wallTypes`, `wallSegments`: definitions et segments de murs.
- `decorations`: decors purement visuels.

## Etat de map
- `mapGrid`: cols/rows logiques.
- `mapTerrain`: terrain par case (floor id).
- `mapHeight`: hauteur par case (niveau).
- `mapLight`: lumiere ambiante par case.
- `playableCells`: masque de cases jouables.
- `roofOpenCells`: ouverture de toit pour l'ambient.
- `mapTheme`, `mapPaletteId`: theme/palette pour rendu.
- `activeLevel`: niveau actif (etages).

## Etat de combat
- `phase`: `player` ou `enemies`.
- `round`: numero de round.
- `turnOrder`: tableau de `TurnEntry` ordonne par initiative.
- `currentTurnIndex`, `turnTick`: curseur de tour.
- `hasRolledInitiative`: garde la premiere initiative.
- `turnActionUsage`, `actionUsageCounts`, `actionUsageByActor`: suivi d'utilisation.
- `reactionQueue`, `reactionUsage`, `reactionCombatUsage`: reactions en file.
- `isResolvingEnemies`: lock durant tour IA.
- `isCombatConfigured`: combat demarre et map chargee.
- `isGameOver`: fin de partie detectee.

## Etat d'actions
- `actionsCatalog`: toutes les actions chargees.
- `actions`: actions visibles du joueur.
- `selectedActionId`, `validatedActionId`: selection/validation.
- `actionContext`, `actionContextOpen`: UI de resolution.
- `selectedTargetIds`, `selectedObstacleTarget`, `selectedWallTarget`: ciblage.
- `targetMode`: selection cible active/inactive.
- `advantageMode`, `attackRoll`, `damageRoll`, `diceLogs`.
- `pendingHazardRoll`, `hazardResolution`: gestion hazards.

## Etat de mouvement
- `interactionMode`: `idle`, `moving`, `inspect-select`, `look-select`, `interact-select`.
- `selectedPath`: chemin choisi par clic.
- `pathLimit`, `basePathLimit`, `movementSpent`.
- `activeMovementModeId`.

## Etat rendu / UI
- Pixi: `pixiContainerRef`, `renderTick`.
- Camera: `boardZoom`, `boardPan`, `isPanningBoard`.
- Overlays debug: `showVisionDebug`, `showLightOverlay`, `showFogSegments`, `showCellIds`, `showGridLines`, etc.
- UI panels: `floatingPanel`, `sheetOpen`, `isNarrationOpen`.
- Logs: `log`, `narrationEntries`, `narrationUnread`.
- FX UI: `hpPopups`, `reactionToast`, `combatToast`.

## Structures derivees (useMemo)
- Maps par id: `enemyTypeById`, `obstacleTypeById`, `effectTypeById`, `wallTypeById`, `weaponTypeById`.
- `weaponActionById`, `actionInfoById`.
- `obstacleBlocking`: sets `movement`, `vision`, `attacks`, `occupied`.
- `wallEdges`: sets pour movement/vision.
- `closedCells`: cellules fermees par les murs.

## Refs (useRef)
- `actionEffectTimersRef`: timers d'effets.
- `enemyMemoryRef`, `teamAlertRef`: memoire IA.
- `narrationPendingRef`: buffer de narration.
- `viewportRef`: projection Pixi (scale + offset).
- `suppressBoardClickUntilRef`: anti double clic.

## Etats transients importants
- `radialMenu`: cellule/token sous la roue d'action.
- `interactionContext`: contexte d'interaction mur/obstacle.
- `effectSpecs`: zones d'effet temporaires pour overlays.

Tous ces etats sont declares dans `test-GAME-2D/src/GameBoard.tsx`.
