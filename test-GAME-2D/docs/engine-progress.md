# Etat d'avancement de l'engine (pipeline d'actions)

Ce document synthétise l'état actuel du moteur d'actions, ce qui est supporté, ce qui reste à faire, et une méthode détaillée pour terminer l'implémentation.

## Portée

- Moteur d'actions: `src/game/engine/*`
- Orchestrateur: `src/game/actionEngine.ts`
- Taxonomie: `src/data/models/taxonomy.json`

## Etat actuel (résumé)

Support réalisé:
- Hooks taxo complets (phases core + alias legacy).
- Conditions étendues (OUTCOME_IS/IN, ROLL_AT_*, HP_BELOW, HAS_RESOURCE, SLOT_AVAILABLE, etc.).
- Ops étendues (conditions, zones, ressources, dés, tags).
- Context de jets: bonus/DC, rerolls, min/max.
- `EmitEvent` branché sur `ActionEngineContext.emitEvent`.
- Ciblage multi-cibles dans le moteur + UI (sélection + validation + exécution par cible).
- Highlight multi-cibles sur la grille.

Limitations connues:
- Ciblage avancé (LockTarget/ExpandTargets/FilterTargets/Retarget) non implémenté.
- Summons/Entities (Spawn/Despawn/ControlSummon) non implémenté.
- Conditions dépendant du contexte avancé (IS_IN_LIGHT, TARGET_IN_AREA, HAS_LINE_OF_SIGHT) actives seulement si les flags sont fournis dans le contexte.
- Déplacements avancés (Push/Pull/Knockback/Teleport) sans collision/pathfinding.

## Matrice de support (ops/conditions)

Operations:
- Supportées: DealDamage, DealDamageScaled, Heal, ApplyCondition, RemoveCondition, ExtendCondition, SetConditionStack, StartConcentration, BreakConcentration, CreateZone, RemoveZone, ModifyZone, CreateSurface, RemoveSurface, ApplyAura (log), SpendResource, RestoreResource, SetResource, ConsumeSlot, RestoreSlot, MoveForced, Teleport, SwapPositions, Knockback/Pull/Push, MoveTo, GrantTempHp, ModifyPathLimit, ToggleTorch, SetKillerInstinctTarget, AddDice, ReplaceRoll, Reroll, SetMinimumRoll, SetMaximumRoll, ModifyBonus, ModifyDC, AddTag, RemoveTag, SetFlag, LogEvent, EmitEvent.
- Partiels/no-op: LockTarget, ExpandTargets, FilterTargets, Retarget, SpawnEntity, DespawnEntity, ControlSummon.

Conditions:
- Supportées: toutes celles listées dans `action.conditions.types` (incluant extensions).
- Dépendant du contexte: HAS_LINE_OF_SIGHT, SAME_LEVEL, TARGET_IN_AREA, IS_IN_LIGHT, IS_REACTION_AVAILABLE, IS_CONCENTRATING, IS_SURPRISED, ONCE_PER_*.

## Gaps prioritaires

1. Summons/Entities (spawn, ownership, despawn).
2. Contextes avancés (LOS/area/light/usage/slots).
3. Déplacements avec pathfinding/collision.
4. Concentration/durations sur plusieurs tours.

## Methode detaillee pour finir

### Etape 1 — Stabiliser les contextes

Objectif: alimenter `ConditionEvalContext` avec des données fiables.

Actions:
1. Ajouter un builder de contexte d'évaluation dans `actionEngine.ts`.
2. Injecter:
   - lineOfSight (via `isTargetVisible`)
   - sameLevel (via `areOnSameBaseLevel`)
   - targetInArea (si action = AOE)
   - inLight (via `lightLevels` + `resolveLightVisionMode` si dispo)
   - usage (turn/round/combat) depuis GameBoard
   - reactionAvailable / concentrating / surprised (si stockés par actor)
3. Normaliser les clés (ex: `usage.turn[actionId]`).

Definition attendue:
- `ConditionEvalContext.usage.turn` = map usage par action/feature.
- `ConditionEvalContext.reactionAvailable` = bool.
- `ConditionEvalContext.concentrating` = bool.
- `ConditionEvalContext.inLight` = bool.

### Etape 2 — Ciblage multi-cibles

Statut: FAIT (sélection UI + exécution par cible).

Reste:
1. Implémenter les ops de ciblage (LockTarget/ExpandTargets/FilterTargets/Retarget).
2. Ajouter des helpers pour:
   - Récupérer toutes les cibles possibles
   - Appliquer des contraintes (range/LOS/ally/hostile)

### Etape 3 — Summons/Entities

Objectif: gérer les entités invoquées.

Actions:
1. Définir un type `SummonInstance` dans le state combat.
2. Implémenter:
   - SpawnEntity: crée un token d'entité.
   - ControlSummon: assigne ownership + ordre.
   - DespawnEntity: retire l'entité.
3. Ajouter une collection dédiée dans le state (`summons: TokenState[]`).
4. Etendre `pickTarget` et `validateActionTarget` pour intégrer les summons.

### Etape 4 — Déplacements physiques

Objectif: rendre Push/Pull/Knockback sûrs.

Actions:
1. Utiliser `computePathTowards` avec contraintes (obstacles, playableCells).
2. Appliquer un clamp + vérification collision.
3. Ajouter un paramètre `blocked` dans les ops pour stopper si bloqué.

### Etape 5 — Durations & concentration

Objectif: durées multi-tours et concentration.

Actions:
1. Stocker une table `durations` (par token + status).
2. Décrémenter au `onTurnEnd` / `onRoundEnd`.
3. `StartConcentration` crée un lien; `BreakConcentration` supprime les statuses liés.
4. Ajouter un hook `onInterrupt` lors de dégâts reçus (test de concentration).

## Tests recommandés

1. Attack roll + AddDice + ModifyBonus + Reroll.
2. Save success/fail + DealDamageScaled.
3. Multi-targets + FilterTargets.
4. Summon -> control -> despawn.
5. Push/Pull avec obstacles.
6. Concentration break sur dégâts.

## Next Steps (court terme)

1. Renseigner `ConditionEvalContext` dans `actionEngine.ts` (LOS/usage/light).
2. Implémenter les ops de ciblage (LockTarget/ExpandTargets/FilterTargets/Retarget).
3. Summons basique (spawn/despawn).
