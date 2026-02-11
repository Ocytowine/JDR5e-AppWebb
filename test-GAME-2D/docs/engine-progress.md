# Etat d'avancement de l'engine (pipeline d'actions)

Ce document synthetise l'etat actuel du moteur d'actions, ce qui est supporte, ce qui reste a faire, et une methode detaillee pour terminer l'implementation.

## Portee

- Moteur d'actions: `src/game/engine/*`
- Orchestrateur: `src/game/actionEngine.ts`
- Taxonomie: `src/data/models/taxonomy.json`

## Etat actuel (resume)

Support realise:
- Hooks taxo complets (phases core).
- Caracs documentees aussi pour les ennemis (modele mis a jour).
- Conditions etendues (OUTCOME_IS/IN, ROLL_AT_*, HP_BELOW, HAS_RESOURCE, SLOT_AVAILABLE, etc.).
- Ops etendues (conditions, zones, ressources, des, tags).
- Context de jets: bonus/DC, rerolls, min/max.
- `EmitEvent` branche sur `ActionEngineContext.emitEvent`.
- Contextes avances branches (LOS/area/light/usage/slots) avec usage par acteur.
- Ciblage multi-cibles dans le moteur + UI (selection + validation + execution par cible).
- Ciblage avance (LockTarget/ExpandTargets/FilterTargets/Retarget) implemente.
- Summons basiques (SpawnEntity/DespawnEntity/ControlSummon) dans l'engine.
- Highlight multi-cibles sur la grille.
- Durations multi-tours (start/end/round) + concentration (test CON sur degats + purge des effets lies).
- Auras ancrees suivent la cible (anchorTokenId).
- Zones/auras persistantes: ticks de degats/status (hazard) au debut/fin/round + aura radius/shape (sphere/cone/line/cube).

Limitations connues:
- Summons: pas d'UI/IA dediee (IA minimaliste sans ordres riches).
- Deplacements avances: pathfinding intelligent applique sur MoveForced/Push/Pull/Knockback (reste a couvrir les cas limites fins).
- Usage par acteur: visible en debug, mais pas encore expose au gameplay/UI (hors conditions).
- Concentration: liens zones/surfaces/auras OK (stacking/suppress simple en place).
- Zones/auras: radius + shape via `effectType.aura.radius` et `effectType.aura.shape` (cones/lines simples, pas de shapes avancees).
- Munitions: taxo stabilisee (ammo + ammoType) + catalogue `data/items/armes/munitions` + branchement gameplay (auto-consommation via inventaire selon `ammoType`/`ammoPerShot`, conteneurs `ammo_container`).

## Matrice de support (ops/conditions)

Operations:
- Supportees: DealDamage, DealDamageScaled, Heal, ApplyCondition, RemoveCondition, ExtendCondition, SetConditionStack, StartConcentration, BreakConcentration, CreateZone, RemoveZone, ModifyZone, CreateSurface, RemoveSurface, ApplyAura (log), SpendResource, RestoreResource, SetResource, ConsumeSlot, RestoreSlot, MoveForced, Teleport, SwapPositions, Knockback/Pull/Push, MoveTo, GrantTempHp, ModifyPathLimit, ToggleTorch, SetKillerInstinctTarget, AddDice, ReplaceRoll, Reroll, SetMinimumRoll, SetMaximumRoll, ModifyBonus, ModifyDC, AddTag, RemoveTag, SetFlag, LogEvent, EmitEvent, LockTarget, ExpandTargets, FilterTargets, Retarget, SpawnEntity, DespawnEntity, ControlSummon.
- Partiels/no-op: aucun.

Conditions:
- Supportees: toutes celles listees dans `action.conditions.types` (incluant extensions).
- Dependantes du contexte: HAS_LINE_OF_SIGHT, SAME_LEVEL, TARGET_IN_AREA, IS_IN_LIGHT, IS_REACTION_AVAILABLE, IS_CONCENTRATING, IS_SURPRISED, ONCE_PER_*.
Note: aucune condition de la taxo courante n'est non prise en compte dans l'engine (pas d'ecarts detectes).

Resolution/Outcomes:
- Resolution types: ATTACK_ROLL / SAVING_THROW / ABILITY_CHECK / NO_ROLL / CONTESTED_CHECK ok.
- Outcomes taxo CHECK_SUCCESS / CHECK_FAIL / CONTESTED_WIN / CONTESTED_LOSE exposes (mapping OK).

## Gaps prioritaires

1. Summons/Entities: ownership gameplay complet (controle joueur/IA, initiative/turns coherents, UI).
2. Deplacements avances: pathfinding intelligent + cas limites (coins/diagonales).
3. Concentration/durations sur plusieurs tours (zones/auras + cas particuliers).

## Methode detaillee pour finir

### Etape 1 --- Stabiliser les contextes

Objectif: alimenter `ConditionEvalContext` avec des donnees fiables.

Actions:
1. Ajouter un builder de contexte d'evaluation dans `actionEngine.ts`.
2. Injecter:
   - lineOfSight (via `isTargetVisible`)
   - sameLevel (via `areOnSameBaseLevel`)
   - targetInArea (si action = AOE)
   - inLight (via `lightLevels` + `resolveLightVisionMode` si dispo)
   - usage (turn/round/combat) depuis GameBoard
   - reactionAvailable / concentrating / surprised (si stockes par actor)
3. Normaliser les cles (ex: `usage.turn[actionId]`).

Definition attendue:
- `ConditionEvalContext.usage.turn` = map usage par action/feature.
- `ConditionEvalContext.reactionAvailable` = bool.
- `ConditionEvalContext.concentrating` = bool.
- `ConditionEvalContext.inLight` = bool.

Statut: FAIT (inclut usage par acteur + slots). Debug UI disponible dans FX.

### Etape 2 --- Ciblage multi-cibles

Statut: FAIT (selection UI + execution par cible).

Reste:
- Rien (ciblage avance disponible via ops).

### Etape 3 --- Summons/Entities

Objectif: gerer les entites invoquees.

Actions:
1. Definir un type `SummonInstance` dans le state combat.
2. Implementer:
   - SpawnEntity: cree un token d'entite.
   - ControlSummon: assigne ownership + ordre.
   - DespawnEntity: retire l'entite.
3. Ajouter une collection dediee dans le state (`summons: TokenState[]`).
4. Etendre `pickTarget` et `validateActionTarget` pour integrer les summons.

Statut: Partiel (ops engine OK, IA basique pour summons joueurs, pas d'UI).

### Etape 4 --- Deplacements physiques

Objectif: rendre Push/Pull/Knockback surs.

Actions:
1. Utiliser `computePathTowards` avec contraintes (obstacles, playableCells).
2. Appliquer un clamp + verification collision.
3. Ajouter un parametre `blocked` dans les ops pour stopper si bloque.

Statut: Partiel (MoveForced + Push/Pull/Knockback pathfind, cas limites a regler).

### Etape 5 --- Durations & concentration

Objectif: durees multi-tours et concentration.

Actions:
1. Stocker une table `durations` (par token + status).
2. Decrementer au `onTurnEnd` / `onRoundEnd`.
3. `StartConcentration` cree un lien; `BreakConcentration` supprime les statuses lies.
4. Ajouter un hook `onInterrupt` lors de degats recus (test de concentration).

Statut: FAIT (tick start/end/round + test CON sur degats + purge des statuses lies; zones/auras liees a la concentration).

## Tests recommandes

1. Attack roll + AddDice + ModifyBonus + Reroll.
2. Save success/fail + DealDamageScaled.
3. Multi-targets + FilterTargets.
4. Summon -> control -> despawn.
5. Push/Pull avec obstacles.
6. Concentration break sur degats.

## Next Steps (court terme)

1. Summons: ownership gameplay complet (controle joueur/IA, initiative/turns coherents, UI).
2. Deplacements avances avec pathfinding intelligent complet.
3. Durations & concentration (zones/auras + cas limites).
