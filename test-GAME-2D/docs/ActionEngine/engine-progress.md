# ActionEngine - Reference complete (fonctions, hooks, ops)

Ce document decrit l'etat reel de l'ActionEngine tel qu'implante dans le code, avec un detail textuel des fonctions, hooks et points d'extension.

Portee principale:
- `src/game/engine/core/actionAdapter.ts`
- `src/game/engine/core/actionCompile.ts`
- `src/game/engine/core/actionExecute.ts`
- `src/game/engine/rules/conditionEval.ts`
- `src/game/engine/core/formulas.ts`
- `src/game/engine/core/hooks.ts`
- `src/game/engine/core/ops.ts`
- `src/game/engine/core/transaction.ts`
- `src/game/engine/core/types.ts`
- orchestrateur: `src/game/engine/core/actionEngine.ts`

## Mise a jour recente (critiques + harmonisation)

Corrections integrees:
1. Le pipeline UI n'enveloppe plus la formule de degats avec des parentheses lors d'un bonus plat additionnel.
2. Le contexte de critique (`isCrit`, `critRule`) est propage a toutes les operations `DealDamage`/`DealDamageScaled` d'une meme resolution.
3. Les degats additionnels d'arme (`extraDamage`) beneficient donc du critique `double-dice` comme le degat principal.
4. Le pipeline ActionEngine accepte des contraintes d'equipement centralisees via `ActionEngineContext.getActionConstraintIssues` (meme source de verite Creator + ingame).
5. Les contraintes de manipulation d'equipement en main sont verrouillees en runtime: sortie depuis slot = 1 interaction (modifiable par feat pour les armes), sortie depuis sac/contenant = 1 action bonus, avec candidats filtrables (armes, boucliers, objets).
6. Le runtime supporte des overrides de cout d'action data-driven via `feature.rules.modifiers` (`actionCostOverride`, priorites, limites par tour, scaling par action principale deja prise).
7. Le socle Guerrier applique maintenant:
   - Extra Attack (5/11/20) par conversion conditionnelle de cout `action -> free` avec quotas,
   - War Magic / Improved War Magic par conversion conditionnelle `action -> bonus`,
   - Action Surge, Tactical Shift et Arcane Charge via `feature.rules.runtimeEffects` (pas de branche par feature).
8. `resolveActionUnified` expose maintenant `outcomeRoll` et `outcomeTotal` pour permettre des reactions runtime post-outcome (ex: Tactical Mind).
9. `ExecuteOptions.rollOverrides` accepte aussi `abilityCheck` et `savingThrow` pour rejouer un outcome de facon deterministe.
10. `SAVING_THROW` applique des modificateurs de jet issus des `runtimeMarkers` portes par la cible (adv/disadv, filtres de tags d'action, source actor), avec consommation optionnelle au declenchement.

Fichiers touches:
1. `src/GameBoard.tsx` (concatenation formule sans parentheses)
2. `src/game/engine/core/types.ts` (ajout `ExecuteOptions.damageContext`)
3. `src/game/engine/core/actionExecute.ts` (contextualisation outcome -> ops)
4. `src/game/engine/core/ops.ts` (application du contexte de critique sur `DealDamage*`)
5. `src/game/engine/core/actionEngine.ts` (gate disponibilite via contraintes d'equipement runtime)
6. `src/game/engine/rules/equipmentHands.ts` (policies features -> equip constraints)
7. `src/data/characters/features/fighter/*.json` (regles data-driven Guerrier)

## 1) Pipeline global

Sequence runtime:
1. `actionDefinitionToActionSpec` adapte une `ActionDefinition` vers le format moteur.
2. `compileActionPlan` construit un `ActionPlan` (action + actor + cible + hooks + fenetres de reaction).
3. `executePlan` execute la pipeline moteur:
   - initialisation transaction
   - hooks de phases
   - fenetre reaction pre
   - resolution outcome (attaque/sauvegarde/check/oppose)
   - application effets (ops)
   - fenetre reaction post
   - hooks commit
4. `resolveActionUnified` (orchestrateur) branche le moteur au contexte jeu (LOS, pathfinding, ressources, slots, callbacks UI, entites invoquees).

## 2) API publique utile

### `src/game/engine/core/actionEngine.ts`

Fonctions exportees:
- `validateActionTarget(action, ctx, target)`: valide legalite cible selon type de ciblage, portee, LOS, niveau, conditions.
- `computeAvailabilityForActor(action, ctx)`: verifie disponibilite "sans cible" (conditions globales, ressources, contrainte loading arme).
- `resolveActionUnified(action, ctx, target, opts)`: point d'entree principal, execute une action et retourne l'etat final (`playerAfter`, `enemiesAfter`, outcome, logs).

Types exportes:
- `ActionEngineContext`: contexte complet (phase, actor/player/enemies, blockers, lumiere, map/grid, callbacks runtime, ressources/slots/usage, hooks UI).
- `ActionTarget`: cible normalisee (`token`, `tokens`, `cell`, `none`).
- `ActionResolutionResult`: resultat unifie de resolution.

## 3) Types moteur (schema d'execution)

### `src/game/engine/core/types.ts`

Elements cle:
- `OutcomeKey`: `hit`, `miss`, `crit`, `saveSuccess`, `saveFail`, `checkSuccess`, `checkFail`, `contestedWin`, `contestedLose`.
- `ResolutionSpec`: type de resolution (`ATTACK_ROLL`, `SAVING_THROW`, `ABILITY_CHECK`, `CONTESTED_CHECK`, `NO_ROLL`) + params.
- `Hook`: phase `when` + conditions `if` + prompt optionnel + liste `apply` (ops).
- `Operation`: union des operations supportees par le moteur (degats, soins, conditions, ressources, deplacement, ciblage, summon, tags, flags, VFX, events...).
- `ActionSpec`: format moteur d'une action.
- `ActionPlan`: plan compile execute.
- `EngineState`: snapshot mutable moteur (round/phase, actor/player/enemies/effects, targeting, concentrationLink, rollContext).
- `ExecuteOptions`: callbacks d'integration (resources/slots, movement, reactions, summon, logs, events, visual, overrides de jets).

## 4) Hooks: phases, alias, support reel

### Phases canoniques executees
- `onIntentBuild`
- `onOptionsResolve`
- `onValidate`
- `onTargeting`
- `preResolution`
- `onResolve`
- `onOutcome`
- `beforeApply`
- `afterApply`
- `postResolution`
- `beforeCommit`
- `afterCommit`

### Alias acceptes (normalisation)
- `pre_resolution`, `PRE_RESOLUTION_WINDOW` -> `preResolution`
- `on_outcome`, `ON_OUTCOME` -> `onOutcome`
- `on_apply`, `APPLY_TARGET_EFFECTS`, `APPLY_WORLD_EFFECTS` -> `afterApply`
- `post_resolution`, `POST_RESOLUTION_WINDOW` -> `postResolution`
- `COMMIT` -> `beforeCommit`

### Phases declarees mais non executees par `executePlan`
- `onTurnStart`
- `onTurnEnd`
- `onRoundStart`
- `onRoundEnd`
- `onInterrupt`
- `onCounter`

## 5) Fonctions detaillees - `engine/*`

### `actionAdapter.ts`

- `mapResolution(action)`: convertit la resolution d'une action en `ResolutionSpec`, normalise `kind` et ability save/check, fallback `ATTACK_ROLL` (si `action.attack`) puis `NO_ROLL`.
- `normalizeTargeting(action)`: passe-through du ciblage.
- `mapEffects(action)`: mappe `ops` vers `ConditionalEffects`.
- `actionDefinitionToActionSpec(action)`: adaptation complete vers `ActionSpec` (id/name/summary/targeting/resolution/effects/reactionWindows/hooks/tags).

### `actionCompile.ts`

- `compileActionPlan({ action, actor, target })`: assemble le plan d'execution final (hooks/fenetres inclus).

### `transaction.ts`

- `beginTransaction(state)`: clone defensif de l'etat (`actor`, `player`, `enemies`, `effects`, `targeting`, `targetingConfig`) + init logs.
- `logTransaction(tx, message, onLog?)`: push log transaction + callback externe.

### `formulas.ts`

- `getLevelFromContext(ctx)`: recupere niveau depuis actor ou sampleCharacter.
- `getProficiencyBonus(level)`: calcule bonus de maitrise selon paliers.
- `resolveNumberVar(varName, ctx)`: resolve variables de formule (`attackBonus`, `moveRange`, `level`, `proficiencyBonus`, `modFOR/DEX/...`).
- `resolveFormula(formula, ctx)`: remplace tokens alpha-numeriques par valeurs numeriques resolues.

### `hooks.ts`

- `shouldApplyHook(hook, ctx, opts)`: evalue `hook.if` via `evaluateAllConditions`.
- `resolvePromptDecision(hook, opts)`: decide `accept/reject` (promptHandler prioritaire, sinon defaultDecision, sinon `reject`).

### `conditionEval.ts`

Fonctions utilitaires:
- `compare(cmp, left, right)`: comparateurs `EQ/NE/LT/LTE/GT/GTE/IN/NIN`.
- `getTags(token)`: tags token + combatStats.tags.
- `getStatuses(token)`: statuses token.
- `getResourceAmountFallback(token, name)`: lecture resource locale token.
- `outcomeHasFlag(outcome, flag)`: mapping des flags outcome.
- `getCreatureType`, `getCreatureTags`, `getSize`: lecture metadonnees creature.
- `canMove(token, move)`: verifie mode de deplacement.
- `getDamageDefenses(token)`: lit resist/immun/vulnerable.
- `getValue(token, key, values?)`: extraction valeur numerique custom.
- `getUsageCount(usage, scope, key)`: lecture compteurs d'usage.
- `isHpBelow({ token, value, mode })`: check HP absolu ou pourcentage.

Fonctions principales:
- `evaluateConditionExpr(condition, ctx)`: evalue une condition unitaire ou composee.
- `evaluateAllConditions(conditions, ctx)`: applique AND global sur la liste.

Condition types supportes en evaluation:
- Logiques: `AND`, `OR`, `NOT`
- Phase/outcome/roll: `PHASE_IS`, `OUTCOME_IS`, `OUTCOME_IN`, `OUTCOME_HAS`, `ROLL_AT_LEAST`, `ROLL_AT_MOST`
- Vie/distance: `TARGET_ALIVE`, `TARGET_HP_BELOW`, `ACTOR_HP_BELOW`, `DISTANCE_MAX`, `DISTANCE_WITHIN`, `DISTANCE_BETWEEN`, `STAT_BELOW_PERCENT`
- Perception/contexte: `HAS_LINE_OF_SIGHT`, `SAME_LEVEL`, `TARGET_IN_AREA`, `IS_IN_LIGHT`
- Usage/etat tour: `ONCE_PER_TURN`, `ONCE_PER_ROUND`, `ONCE_PER_COMBAT`, `NOT_USED_THIS_TURN`, `IS_REACTION_AVAILABLE`, `IS_CONCENTRATING`, `IS_SURPRISED`
- Ressources/slots: `RESOURCE_AT_LEAST`, `RESOURCE_AT_MOST`, `HAS_RESOURCE`, `SLOT_AVAILABLE`, `ACTOR_HAS_RESOURCE`, `TARGET_HAS_RESOURCE`
- Tags/conditions/status: `ACTOR_HAS_TAG`, `TARGET_HAS_TAG`, `ACTOR_HAS_CONDITION`, `TARGET_HAS_CONDITION`, `ACTOR_CONDITION_STACKS`, `TARGET_CONDITION_STACKS`
- Creature/type/size/move: `ACTOR_CREATURE_TYPE_IS`, `TARGET_CREATURE_TYPE_IS`, `ACTOR_CREATURE_HAS_TAG`, `TARGET_CREATURE_HAS_TAG`, `ACTOR_SIZE_IS`, `TARGET_SIZE_IS`, `ACTOR_CAN_MOVE`, `TARGET_CAN_MOVE`
- Defenses: `ACTOR_DAMAGE_IMMUNE`, `TARGET_DAMAGE_IMMUNE`, `ACTOR_DAMAGE_RESIST`, `TARGET_DAMAGE_RESIST`, `ACTOR_DAMAGE_VULNERABLE`, `TARGET_DAMAGE_VULNERABLE`
- Valeurs custom: `ACTOR_VALUE`, `TARGET_VALUE`

### `ops.ts`

Helpers de ciblage/concentration:
- `pickTarget(state, selector, explicitTarget)`
- `ensureDefenseArray(token, mode)`
- `moveTokenByDelta(token, dx, dy)`
- `resolveTokenById(state, tokenRef)`
- `getConcentrationSourceId(token)`
- `linkStatusToConcentration(state, status)`
- `shouldLinkEffectToConcentration(state, effectTypeId)`
- `linkEffectToConcentration(state, effect)`
- `removeConcentrationLinkedStatuses(state, sourceId)`
- `removeConcentrationLinkedEffects(state, sourceId)`
- `breakConcentration({ state, tx, token, opts, reason })`
- `maybeCheckConcentrationOnDamage({ state, tx, targetToken, damage, opts })`
- `ensureTargetingState(state, explicitTarget)`
- `getTokenTags(token)`
- `getPotentialTargets(state)`
- `directionFromTo(from, to)`

Fonction principale:
- `applyOperation({ op, tx, state, explicitTarget, opts })`: applique une operation moteur.

Operations appliquees et comportement:
- `LogEvent`, `EmitEvent`
- `SpendResource`, `RestoreResource`, `SetResource`
- `ConsumeSlot`, `RestoreSlot`
- `CreateZone`, `RemoveZone`, `ModifyZone`
- `CreateSurface`, `RemoveSurface`
- `ApplyAura`
- `DealDamage`, `DealDamageScaled` (temp HP inclus, concentration check)
- `ApplyDamageTypeMod`
- `Heal`
- `ApplyCondition`, `RemoveCondition`, `ExtendCondition`, `SetConditionStack`
- `StartConcentration`, `BreakConcentration`
- `GrantTempHp`
- `MoveForced`, `Teleport`, `SwapPositions`, `Knockback`, `Push`, `Pull`, `MoveTo`
- `AddDice`, `ReplaceRoll`, `Reroll`, `SetMinimumRoll`, `SetMaximumRoll`, `ModifyBonus`, `ModifyDC`
- `LockTarget`, `ExpandTargets`, `FilterTargets`, `Retarget`
- `SpawnEntity`, `DespawnEntity`, `ControlSummon`
- `AddTag`, `RemoveTag`, `SetFlag`
- `ModifyPathLimit`, `ToggleTorch`, `SetKillerInstinctTarget`, `PlayVisualEffect`

### `actionExecute.ts`

Normalisation et hooks:
- `normalizeHookWhen(when)`: mappe alias vers phase canonique.
- `applyHooks({ hooks, phase, state, target, outcome, explicitTarget, tx, opts })`: evalue conditions/prompt puis execute les ops des hooks.

Resolution des jets:
- `resolveOutcome({ plan, state, advantageMode, rollOverrides, target })`:
  - `ATTACK_ROLL`: jet attaque, crit, comparaison AC, impact `rollContext`.
  - `SAVING_THROW`: jet 1d20 + mod cible vs DD (DD fixe ou `dcFormula`).
  - `ABILITY_CHECK`: jet 1d20 + mod actor vs DC.
  - `CONTESTED_CHECK`: deux jets opposes, tieWinner.
  - fallback `NO_ROLL` -> outcome neutre.

Helpers Weapon Mastery:
- `getTokenTags`, `addTokenTag`, `removeTokenTag`, `removeTokenTagsByPrefix`
- `resolveWeaponMasteryAdvantage`, `consumeWeaponMasteryAdvantage`
- `extractAbilityModToken`, `abilityModFromToken`, `stripAbilityMod`
- `getMasteryTriggerFromTags`, `getProficiencyBonus`, `getHostileTargets`
- `applyWeaponMasteryEffects`: applique effets mastery data-driven (`ouverture`, `sape`, `poussee`, `ralentissement`, `ecorchure`, `renversement`, `enchainement`, `coup-double`).

Effets outcome:
- `collectOperations(effects, outcome)`: construit la liste d'ops a appliquer selon branche (`onResolve`, `onHit`, `onMiss`, `onCrit`, `onSaveSuccess`, `onSaveFail`).

Execution complete:
- `executePlan({ plan, state, opts, advantageMode })`:
  - initialise targeting state/config
  - execute hooks pre-resolution
  - gere reaction window `pre`
  - resolve outcomes (mono ou multi-cibles)
  - logs de resolution
  - hooks `onResolve` / `onOutcome`
  - effets Weapon Mastery
  - hooks apply/post
  - reaction window `post`
  - hooks commit
  - retourne `{ ok, logs, state, interrupted?, outcome }`

## 6) Internes importants - `actionEngine.ts`

## 7) Note d integration melee (analyse avant implementation)

Objectif de cette note:
- preparer l ajout de la logique "attaque melee armee/non armee" sans dupliquer les branches existantes.

Constats code (points uniques deja en place):
1. Selection d arme centralisee: `src/GameBoard.tsx` via `pickWeaponForAction`.
2. Override d action arme centralise: `src/GameBoard.tsx` via `applyWeaponOverrideForActor` -> `buildWeaponOverrideAction`.
3. Contraintes mains/bouclier/deux armes centralisees:
- `src/game/engine/rules/equipmentHands.ts` (`getHandUsageState`, `getEquipmentConstraintIssues`)
- `src/game/engine/rules/weaponPairingRules.ts` (`getDualWieldConstraintIssues`)
4. Cout de manipulation d arme centralise: `resolveWeaponHandlingCost` dans `src/GameBoard.tsx`.
5. Reutilisation large de ce pipeline (joueur, ennemis, reactions, preview UI), donc c est le bon point d extension.

Conclusion architecture:
- ne pas creer de "nouvelle branche melee" ailleurs,
- ne pas dupliquer des actions "armee" et "non armee" par contenu,
- enrichir le contexte/tags de l action a partir du pipeline unique existant.

Direction recommandee:
1. Introduire un helper unique de contexte d attaque (ex: `resolveAttackContextForActor`) calcule avant override final:
- `attackKind`: `weapon` | `unarmed`
- `weaponKind`: `martial` | `simple` | `improvised` | `none`
- `isImprovised`
- `isUnarmed`
2. Injecter les tags derives sur l action finale (ex: `attack:weapon`, `attack:unarmed`, `weapon:improvised`) sans changer les JSON de base.
3. Faire dependre feats/riders de ces tags/flags plutot que d id d action.

Safeguards anti regression:
1. Si `pickWeaponForAction` ne trouve pas d arme, conserver le fallback action actuel (base attack) et le qualifier `attack:unarmed`.
2. Ne jamais court-circuiter `getEquipmentConstraintIssuesForActor` ni `resolveWeaponHandlingCost`.
3. Garder `applyWeaponOverrideForActor` comme point unique d assemblage final.

Helpers de validation/deplacement:
- `areOnSameBaseLevel`, `getLightAtToken`, `isInLight`
- `isCellAllowed`
- `updateTokenPosition`
- `getTokensForPath`
- `applyForcedMove`
- `applyTeleport`
- `applyDisplace`
- `applySwapPositions`
- `resolveTokenInState`
- `getTokenSide`, `isHostileTarget`, `isAllyTarget`
- `validateTokenTarget`

Helpers advantage/WM:
- `parseWeaponTagNumber`
- `getAbilityScoreForActor`
- `mergeAdvantageMode`
- `extractMasteryId`
- `getMasteryTrigger`
- `buildWeaponMasteryTriggerTags`

Points fonctionnels:
- Validation cible gere LOS et line-of-effect (vision + trajectoire).
- Disponibilite prend en compte conditions globales + ressources + `weapon:loading`.
- Resolution unifiee branche callbacks deplacement/summon/ressources/slots/events/UI.
- Penalites de maniment (ex arme lourde sans score mini) converties en disadvantage score.

## 7) Etat d'implementation (resume fiable)

Couverture actuelle:
- Pipeline execution complet (adapter -> compile -> execute -> ops).
- Multi-cibles via `ActionTarget.kind = "tokens"` + targeting ops.
- Hooks conditionnels avec prompt optionnel.
- Roll context complet (`bonusDelta`, `dcDelta`, `replaceRoll`, `reroll`, `minRoll`, `maxRoll`).
- Concentration liee aux statuses/effects + break sur degats.
- Zones/surfaces/auras persistantes.
- Gestion resources/slots/summons/ciblage dynamique.
- Weapon Mastery data-driven active dans l'execution moteur.

Limitations actuelles explicites:
- Phases hooks `onTurnStart`, `onTurnEnd`, `onRoundStart`, `onRoundEnd`, `onInterrupt`, `onCounter` non routees dans `executePlan`.
- Certaines operations de movement/summon dependent fortement des callbacks fournis par l'orchestrateur (comportement degrade sans callbacks).
- `ReactionWindow` est un point d'interruption binaire (`continue|interrupt`), pas un mini-plan de contre-action nativement execute dans le moteur.

## 8) Recommandations de suite

1. Router les hooks de cycle (`onTurnStart/onTurnEnd/onRoundStart/onRoundEnd`) dans le scheduler de tour.
2. Introduire un mode reaction avance (contre-action executee dans la fenetre pre/post).
3. Consolider la doc de contrat callback (`ExecuteOptions`) avec exemples de fallback et garanties.
4. Voir roadmap generique DnD2024: `docs/ActionEngine/dnd2024-generic-gaps-and-roadmap.md`.

## 9) Tableau technique IA (fonctions)

Lecture:
- `Entree`: parametres principaux.
- `Sortie`: valeur retour.
- `Side effects`: mutations et dependances externes.

### `src/game/engine/core/actionAdapter.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `mapResolution` | `ActionDefinition` | `ResolutionSpec \| undefined` | Aucun |
| `normalizeTargeting` | `ActionDefinition` | `TargetingSpec \| undefined` | Aucun |
| `mapEffects` | `ActionDefinition` | `ConditionalEffects \| undefined` | Aucun |
| `actionDefinitionToActionSpec` | `ActionDefinition` | `ActionSpec` | Aucun |

### `src/game/engine/core/actionCompile.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `compileActionPlan` | `{ action, actor, target }` | `ActionPlan` | Aucun |

### `src/game/engine/core/transaction.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `beginTransaction` | `EngineState` | `Transaction` (clone mutable + logs) | Copie profonde partielle de state |
| `logTransaction` | `tx, message, onLog?` | `void` | Push log + callback `onLog` |

### `src/game/engine/core/formulas.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `getLevelFromContext` | `FormulaContext` | `number` | Aucun |
| `getProficiencyBonus` | `level` | `number` | Aucun |
| `resolveNumberVar` | `varName, ctx` | `number \| null` | Aucun |
| `resolveFormula` | `formula, ctx` | `string` formule resolue | Aucun |

### `src/game/engine/core/hooks.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `shouldApplyHook` | `hook, hookContext, ExecuteOptions` | `boolean` | Lit conditions via `conditionEval` |
| `resolvePromptDecision` | `hook, ExecuteOptions` | `"accept" \| "reject"` | Peut appeler `promptHandler` |

### `src/game/engine/rules/conditionEval.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `compare` | `cmp, left, right` | `boolean` | Aucun |
| `getTags` | `TokenState` | `string[]` | Aucun |
| `getStatuses` | `TokenState` | `status[]` | Aucun |
| `getResourceAmountFallback` | `token, name` | `number` | Aucun |
| `outcomeHasFlag` | `Outcome?, flag` | `boolean` | Aucun |
| `getCreatureType` | `TokenState` | `string \| null` | Aucun |
| `getCreatureTags` | `TokenState` | `string[]` | Aucun |
| `getSize` | `TokenState` | `string \| null` | Aucun |
| `canMove` | `token, move` | `boolean` | Aucun |
| `getDamageDefenses` | `token` | `defenses \| null` | Aucun |
| `getValue` | `token, key, values?` | `number \| null` | Aucun |
| `getUsageCount` | `usage, scope, key` | `number` | Aucun |
| `isHpBelow` | `{ token, value, mode }` | `boolean` | Aucun |
| `evaluateConditionExpr` | `ConditionExpr, ConditionEvalContext` | `boolean` | Aucun |
| `evaluateAllConditions` | `ConditionExpr[]?, ctx` | `boolean` | Aucun |

### `src/game/engine/core/ops.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `pickTarget` | `state, selector, explicitTarget` | token \| `null` | Aucun |
| `ensureDefenseArray` | `token, mode` | `string[]` | Initialise structures `defenses` |
| `moveTokenByDelta` | `token, dx, dy` | `void` | Mutations `token.x/y` |
| `resolveTokenById` | `state, tokenRef` | token \| `null` | Aucun |
| `getConcentrationSourceId` | `token` | `string \| null` | Aucun |
| `linkStatusToConcentration` | `state, status` | status enrichi | Aucun |
| `shouldLinkEffectToConcentration` | `state, effectTypeId` | `boolean` | Aucun |
| `linkEffectToConcentration` | `state, effect` | effect enrichi | Aucun |
| `removeConcentrationLinkedStatuses` | `state, sourceId` | `number` retires | Mutations statuses tokens |
| `removeConcentrationLinkedEffects` | `state, sourceId` | `number` retires | Mutation `state.effects` |
| `breakConcentration` | `{ state, tx, token, opts, reason }` | `void` | Reset concentration + purge liens + logs |
| `maybeCheckConcentrationOnDamage` | `{ state, tx, targetToken, damage, opts }` | `void` | Jet CON + possible rupture concentration |
| `ensureTargetingState` | `state, explicitTarget` | `{ targets, locked }` | Initialise/mute `state.targeting` |
| `getTokenTags` | `token` | `string[]` | Aucun |
| `getPotentialTargets` | `state` | tokens[] | Aucun |
| `directionFromTo` | `from, to` | vecteur normalise | Aucun |
| `applyOperation` | `{ op, tx, state, explicitTarget, opts }` | `void` | Coeur mutate engine state, ressources, effets, logs, callbacks externes |

### `src/game/engine/core/actionExecute.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `normalizeHookWhen` | `when` | `HookPhase \| null` | Aucun |
| `applyHooks` | `{ hooks, phase, state, target, outcome, explicitTarget, tx, opts }` | `void` | Execute ops de hooks, peut muter state |
| `resolveOutcome` | `{ plan, state, advantageMode, rollOverrides, target }` | `{ outcome, target }` | Consomme rollContext logique |
| `getTokenTags` | `token` | `string[]` | Aucun |
| `addTokenTag` | `token, tag` | `void` | Mutation tags token |
| `removeTokenTag` | `token, tag` | `void` | Mutation tags token |
| `removeTokenTagsByPrefix` | `token, prefix` | `void` | Mutation tags token |
| `resolveWeaponMasteryAdvantage` | `{ base, actor, target }` | `AdvantageMode` | Lit tags WM |
| `consumeWeaponMasteryAdvantage` | `{ actor, target, advantageUsed }` | `void` | Nettoie tags WM consommables |
| `extractAbilityModToken` | `formula?` | mod token \| `null` | Aucun |
| `abilityModFromToken` | `actor, modToken` | `number` | Aucun |
| `stripAbilityMod` | `formula, modToken` | `string` | Aucun |
| `getMasteryTriggerFromTags` | `tags, masteryId` | trigger WM | Aucun |
| `getProficiencyBonus` | `actor` | `number` | Aucun |
| `getHostileTargets` | `state, actor` | tokens[] | Aucun |
| `applyWeaponMasteryEffects` | `{ plan, state, tx, target, outcome, opts }` | `void` | Applique effets WM (ops, tags, logs) |
| `collectOperations` | `effects, outcome` | `Operation[]` | Aucun |
| `executePlan` | `{ plan, state, opts, advantageMode }` | `{ ok, logs, state, interrupted?, outcome }` | Pipeline complete execution/mutations |

### `src/game/engine/core/actionEngine.ts`

| Fonction | Entree | Sortie | Side effects |
|---|---|---|---|
| `areOnSameBaseLevel` | `ctx, a, b` | `boolean` | Aucun |
| `getLightAtToken` | `ctx, token` | `number \| null` | Aucun |
| `isInLight` | `ctx, token` | `boolean \| null` | Aucun |
| `isCellAllowed` | `{ ctx, state, x, y, excludeIds? }` | `boolean` | Aucun |
| `updateTokenPosition` | `{ state, token, x, y }` | `void` | Mutation state local player/enemies |
| `getTokensForPath` | `ctx, state` | `TokenState[]` | Aucun |
| `applyForcedMove` | `{ ctx, state, token, to }` | `void` | Mutation position token |
| `applyTeleport` | `{ ctx, state, token, to }` | `void` | Mutation position token |
| `applyDisplace` | `{ ctx, state, token, direction, distance }` | `void` | Mutation position token |
| `applySwapPositions` | `{ ctx, state, a, b }` | `void` | Swap positions si legal |
| `resolveTokenInState` | `state, id` | token \| `null` | Aucun |
| `getTokenSide` | `token` | `TokenType` | Aucun |
| `isHostileTarget` | `actor, targetToken` | `boolean` | Aucun |
| `isAllyTarget` | `actor, targetToken` | `boolean` | Aucun |
| `validateTokenTarget` | `action, ctx, targetToken` | `{ ok, reason? }` | Aucun |
| `validateActionTarget` | `action, ctx, target` | `{ ok, reason? }` | Aucun |
| `computeAvailabilityForActor` | `action, ctx` | `ActionAvailability` | Aucun |
| `parseWeaponTagNumber` | `tags, prefix` | `number \| null` | Aucun |
| `getAbilityScoreForActor` | `{ actor, ability, sampleCharacter? }` | `number` | Aucun |
| `mergeAdvantageMode` | `base, scoreDelta` | `AdvantageMode` | Aucun |
| `resolveActionUnified` | `action, ctx, target, opts?` | `ActionResolutionResult` | Orchestration complete, appelle moteur + callbacks integration |
| `extractMasteryId` | `ActionDefinition` | `string \| null` | Aucun |
| `getMasteryTrigger` | `ActionDefinition` | trigger WM | Aucun |
| `buildWeaponMasteryTriggerTags` | `{ activeMasteryIds, masteryActions }` | `string[]` | Aucun |


