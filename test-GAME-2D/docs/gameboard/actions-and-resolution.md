# Actions et resolution

Sources principales:
- `test-GAME-2D/src/GameBoard.tsx`
- `test-GAME-2D/src/game/actionEngine.ts`
- `test-GAME-2D/src/game/actionPlan.ts`
- `test-GAME-2D/src/dice/roller.ts`

## Chargement des actions
- Catalogue complet via `loadActionTypesFromIndex`.
- Actions visibles du joueur filtrees par `actionIds` du perso et les spells.
- Les mouvements (`moveTypes`) sont charges depuis `src/data/moves/*`.

## Selection et validation
- `selectedActionId` = action active dans la roue.
- `validatedActionId` = action confirmee dans le contexte.
- `targetMode=selecting` force la selection de cible.
- Validation cible via `validateEnemyTargetForAction`, `validateObstacleTargetForAction`, etc.

## Disponibilite
`computeActionAvailability` (GameBoard) et `computeAvailabilityForActor` (actionEngine):
- Conditions `ActionDefinition.conditions`.
- Ressources (slots, munitions, pools).
- Usages par tour/encounter/combat.

## Resolution principale
`resolveActionUnified`:
- Convertit `ActionDefinition` en plan d'action.
- Execute le plan via `executePlan`.
- Applique les effets sur l'etat (player/enemies).
- Peut emettre des evenements de combat.

## Jets de des
- `rollAttack` et `rollDamage` (dans `dice/roller.ts`).
- Le contexte permet advantage/disadvantage.
- `ActionContextWindow` pilote les jets.
- `handleAutoResolveRolls` execute attaque + degats.

## Hazards et zones
- `PendingHazardRoll` pour effets de type hazard.
- `resolveHazardRoll` et `applyHazardRoll` declenchent une resolution.
- Les hazards peuvent appliquer des degats ou des statuts.

## Ressources et munitions
- `resolveAmmoUsageForAction` detecte le type d'ammo.
- `getInventoryResourceCount` lit les stocks.
- `spendPlayerResource` decremente les ressources.

## VFX d'action
- `onPlayVisualEffect` passe a l'action engine.
- `GameBoard` convertit l'effet en sprite dans `effects`.
- Gestion du timing via `actionEffectTimersRef`.

## Logs et feedback
- `pushLog` pour traces de resolution.
- `diceLogs` pour les jets.
- `combatToast` pour feedback de hit/miss.
