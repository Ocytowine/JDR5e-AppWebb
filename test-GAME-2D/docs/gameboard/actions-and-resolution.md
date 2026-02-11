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

## Interaction GameBoard <-> Action Engine
### Cote GameBoard
- Prepare le contexte d'action (actor, player, enemies, grid, blockers, light).
- Valide les cibles avant resolution (handlers locaux + `validateActionTarget`).
- Ouvre les UI `ActionContextWindow` et `ActionWheelMenu`.
- Gere les jets de des et passe les resultats a `resolveActionUnified`.
- Met a jour `player`, `enemies`, `effects`, `logs` selon le resultat.
- Gere les reactions (queue + auto-resolve) declenchees apres une action.

### Cote actionEngine
- Verifie disponibilite et conditions (ressources, etat, phase).
- Applique les operations (move, damage, status, summon, etc.).
- Retourne un snapshot des etats `playerAfter` et `enemiesAfter`.
- Peut emettre des evenements via `emitEvent` (utilise par la narration).

### Points d'accroche (hooks)
- `emitEvent`: enregistre l'historique (narration, analytics).
- `onLog`: trace le detail de resolution.
- `spawnEntity`: invoque un token (summon).
- `onPlayVisualEffect`: declenche un VFX sur le plateau.
- `onModifyPathLimit`: consomme/ajuste le mouvement.

### Flux resume
1. Joueur choisit une action (roue/menu).
2. GameBoard valide la cible et ouvre le contexte.
3. Jets (attaque/degats) -> `resolveActionUnified`.
4. Engine applique le plan, retourne etats.
5. GameBoard setState + reactions + logs + rendu.

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
