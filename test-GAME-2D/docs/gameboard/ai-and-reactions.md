# IA ennemie et reactions

Sources principales:
- `test-GAME-2D/src/GameBoard.tsx`
- `test-GAME-2D/src/game/engine/core/actionEngine.ts`
- `test-GAME-2D/src/narrationClient.ts`

## IA ennemie (runSingleEnemyTurnV2)
Flux principal:
1. Active le lock `isResolvingEnemies`.
2. Applique les statuts de debut de tour.
3. Construit un resume via `buildEnemyAiSummary`.
4. Demande des intents via `requestEnemyAiIntents`.
5. Tente de resoudre l'intent avec `resolveActionUnified`.
6. Si echec ou aucun intent: fallback local.
7. Met a jour la memoire (lastSeen, lastFailed, lastEffective).
8. Enregistre les evenements de combat.
9. Update speech via `requestEnemySpeech`.

## Fallback IA local
- Attaque si joueur visible et action valide.
- Sinon, mouvement vers la derniere position connue.
- Retraite si trop proche selon le profil.
- Choix des actions via `scoreActionForEnemy`.

## Memoire et alertes
- `enemyMemoryRef`: lastSeen, lastFailedReason, lastEffectiveActionId.
- `teamAlertRef`: alerte partagee par equipe ennemie.
- `fuzzAlertPosition` ajoute un flou de position.

## Reactions
- Catalogue: `loadReactionTypesFromIndex`.
- Chaque reaction a un `trigger.event` (ex: `movement.enter_reach`).
- Conditions verifiees via `checkReactionConditions`.
- Deux modes principaux. Mode instant: `applyInstantReactionEffects` (ex: killer instinct). Mode standard: ouverture du context ou auto-resolve.

## Queue de reactions
- `reactionQueue` stocke les reactions en attente.
- `startNextReactionFromQueue` lance la prochaine si le contexte est libre.
- En tour ennemi, un `pause` est demande pour laisser la reaction se resoudre.

## Types d'evenements supportes
- `visibility.first_seen`
- `movement.enter_reach`
- `movement.leave_reach`

## Journalisation
- `pushLog` detaille les intents et resultats.
- `aiLastState`, `aiLastDecisions`, `aiLastIntents` exposent le debug.


