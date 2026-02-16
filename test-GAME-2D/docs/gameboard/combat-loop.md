# Boucle de combat

Sources principales:
- `test-GAME-2D/src/GameBoard.tsx`
- `test-GAME-2D/src/game/engine/runtime/turnTypes.ts`
- `test-GAME-2D/src/game/engine/core/actionEngine.ts`

## Demarrage du combat
- `handleStartCombat` demarre la configuration.
- Generation de map via `generateBattleMap`.
- Placement joueur/ennemis + obstacles/murs + effets.
- Initialisation des compteurs (`round`, `turnOrder`, `actionUsage`, etc.).

## Initiative
- `rollInitialInitiativeIfNeeded` declenche le jet.
- Le joueur lance `d20 + modDEX`.
- Chaque ennemi a une initiative d20.
- Les invocations peuvent s'intercaler (selon `summonTurnTiming`).
- `turnOrder` est trie par initiative, puis `currentTurnIndex` = 0.

## Tour actif
`useEffect` sur `turnOrder/currentTurnIndex`:
- Si `player`: set `phase=player`, reset usages, mouvement, rolls.
- Si `summon` cote joueur: run `runSingleSummonTurn`.
- Si `enemy`: set `phase=enemies`, run `runSingleEnemyTurnV2`.

## Avancement de tour
`advanceTurn`:
- Applique fins de tour et fins de round.
- Incremente `currentTurnIndex`.
- Incremente `round` quand la boucle revient a 0.

## Fin de tour joueur
`handleEndPlayerTurn`:
- Log de fin de tour.
- Enregistre un `combatEvent`.
- Passe au tour suivant via `advanceTurn`.

## Effets de statut
- `applyStartOfTurnStatuses` et `applyEndOfTurnDurations` gerent les status.
- `applyEndOfRoundDurations` nettoie certains effets.
- La logique est declenchee par `advanceTurn` et les hooks de tour.

## Fin de partie
- `isGameOver` passe a `true` si le joueur n'a plus de PV et aucun allie vivant.
- Le rendu affiche `GameOverOverlay`.

## Narration
- `beginRoundNarrationBuffer` au debut du tour joueur.
- `recordCombatEvent` pendant les actions.
- `requestRoundNarration` en fin de tour ennemi si buffer actif.


