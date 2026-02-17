# ActionEngine - DnD2024 Generic Gaps And Roadmap

Ce document fixe un cap large pour couvrir les regles DnD 2024 sans multiplier des cas speciaux par feature.

Objectif principal:
- etendre le moteur avec des primitives generiques (conditions, hooks, operations, rule scopes),
- garder les contenus data-driven,
- eviter le couplage UI/feature pour les mecaniques coeur (d20 tests, resources, reactions, turn windows).

## 1) Generic Gaps (etat actuel)

### 1.1 Rule scoping and action semantics

Manques:
- pas de notion native "unarmed-only" vs "weapon attack" exploitable partout.
- pas de typage "improvised weapon proficiency" au niveau moteur.
- la notion "Attack action" (au sens regle, distincte de "une action de categorie attack") n'est pas modelisee explicitement.

Impact:
- difficultes pour des feats comme Tavern Brawler, Grappler, Charger, etc.

Direction:
- ajouter des tags/flags normalises de contexte action:
  - `attack:action`,
  - `attack:unarmed`,
  - `attack:weapon`,
  - `weapon:improvised`,
  - `roll:test_d20`.

### 1.2 d20 intervention hooks (self and incoming)

Manques:
- pas de hook generique "before d20 roll" par acteur/source de regle.
- pas de mode unifie de depense ressource pour obtenir avantage/desavantage sur d20 test.
- les reactionModifiers actuels ne portent pas de `resourceCost`.

Impact:
- Lucky, Silvery Barbs-like patterns, et nombreux rerolls/advantage swaps restent partiellement manuels.

Direction:
- introduire des points d'extension standardises:
  - `beforeD20Roll`,
  - `afterD20RollBeforeResolve`,
  - `beforeIncomingAttackRoll`,
  - `afterIncomingAttackHit`.

### 1.3 Runtime effects coverage

Manques:
- `runtimeEffects` supporte peu d'effets (grant action/move, status, teleport).
- pas d'effets generiques pour forced movement conditionnel (push/pull/knockback) avec quotas.

Impact:
- impossible de declarer proprement des riders "on hit once per turn" sans code ad hoc.

Direction:
- etendre runtimeEffects avec effets parametrables:
  - `pushPrimaryTarget`,
  - `pullPrimaryTarget`,
  - `applyOperation` (proxy securise vers ops whitelistees),
  - compteurs de consommation attaches a une `usageKey`.

### 1.4 Resource lifecycle and rest integration

Manques:
- le moteur de recharge (`short_rest` / `long_rest`) existe, mais l'integration gameplay reste partielle.
- pas de standard uniforme "resourceCost" pour modifiers/hooks/reactions.

Impact:
- ressources de features puissantes parfois deconnectees du meme schema que les actions.

Direction:
- unifier la depense/validation resource dans tous les canaux:
  - action ops,
  - reaction modifiers,
  - d20 intervention hooks,
  - runtime markers/effects.

### 1.5 Turn and round lifecycle hooks

Manques:
- `onTurnStart`, `onTurnEnd`, `onRoundStart`, `onRoundEnd` declares mais non routes.

Impact:
- durees et effets temporels complexes limites ou degrades.

Direction:
- brancher ces phases dans le scheduler de tour pour rendre les regles temporelles 100% data-driven.

## 2) Implementation Plan (engine-first, generic)

## Phase A - Core schema and contracts

1. Etendre `FeatureDefinition.rules` avec blocs normalises:
- `d20Modifiers[]` (self/incoming, advantage/disadvantage/reroll, optional cost).
- `reactionModifiers[]` + `resourceCost`.
- `runtimeEffects[]` enrichi (forced movement + usage limit keys).

2. Etendre le contexte d'execution:
- `ActionExecutionContext` avec `actionKind`, `attackKind`, `weaponKind`, `isUnarmed`, `isImprovised`.
- expose `turnUsage` et `combatUsage` homogeniquement.

3. Ajouter une spec de compatibilite:
- anciens champs gardes en lecture.
- warning centralise si un champ legacy est deprecie.

## Phase B - d20 pipeline generalization

1. Introduire une pipeline d20 unique:
- collect des modificateurs de toutes sources,
- arbitrage priorite,
- depense resource atomique,
- trace dans logs moteur.

2. Cibler tous types de d20:
- attack roll,
- saving throw,
- ability check,
- contested check.

3. Integrer aux `ExecuteOptions` sans couplage UI:
- UI peut proposer, moteur decide et consomme.

## Phase C - Runtime effects and rider system

1. Etendre `runtimeEffects` pour riders standards:
- forced movement,
- add/remove tags/status,
- ops cibles whitelistees.

2. Ajouter un quota generique:
- `usageKey`,
- `maxPerTurn`,
- `maxPerRound`,
- `maxPerCombat`.

3. Evaluer via meme moteur de conditions que les actions.

## Phase D - Turn lifecycle routing

1. Router `onTurnStart/onTurnEnd/onRoundStart/onRoundEnd`.
2. Brancher expiration/refresh des markers et compteurs sur ces phases.
3. Garantir ordre stable:
- turn start hooks,
- action resolution,
- turn end hooks.

## Phase E - Validation, tests, and migration

1. Créer un pack de tests regles:
- Lucky pattern,
- Tavern Brawler pattern,
- Protection/Interception regressions,
- one-per-turn riders.

2. Ajouter tests de non regression sur:
- perf (nombre de hooks actifs),
- determinisme (rollOverrides),
- ordre des operations.

3. Migrer progressivement features existantes vers nouveaux blocs.

## 3) Acceptance Criteria (generic, not feature-specific)

Le socle est considere pret si:
- une regle "advantage on any d20 with resource cost" se decrit sans code metier.
- une regle "impose disadvantage on incoming attack with optional reaction/resource" se decrit sans code metier.
- une regle "on hit push target once per turn under conditions" se decrit sans code metier.
- une regle "unarmed-only rider" est modelisable via contexte action standard.
- les phases turn/round sont executees et testees.

## 4) Suggested rollout order for current backlog

1. Phase A + B (d20 + resource cost unifies Lucky-like mechanics).
2. Phase C (riders for Tavern Brawler-like effects).
3. Phase D (temporal reliability for broader DnD2024 coverage).
4. Phase E (migration + regression suite).

## 5) Focus next step: melee armed/unarmed without duplication

Scope:
- prioriser un socle melee generique avant implementation des feats d origine.

Implementation axis (codebase current fit):
1. Reutiliser le pipeline existant `pickWeaponForAction` + `applyWeaponOverrideForActor`.
2. Ajouter une resolution de contexte d attaque unique (armed/unarmed/improvised) au meme endroit.
3. Exposer ce contexte via tags normalises (et eventuellement champs runtime internes), pas via actions dupliquees.

Minimal target contract:
1. Une attaque melee sans arme equipee devient explicitement `attack:unarmed`.
2. Une attaque melee avec arme reste `attack:weapon` + tags arme existants.
3. Les armes improvisees sont distinguables (`weapon:improvised`) pour les feats et competences.

Why this order:
1. Evite de casser la logique actuelle de contraintes mains/interaction.
2. Evite le hardcode par feat (Tavern Brawler, Grappler, etc.).
3. Permet de brancher ensuite les riders data-driven sur des filtres stables.

## 6) Regles verrouillees - Roue equipement / inventaire

Regles runtime cibles (UI + couts + contraintes):
1. Objet equipable en main: `weapon`, `object`, `armor` uniquement si `shield`.
2. Conditionnement roue: `Degainer` n'apparait que s'il existe une main libre et au moins un candidat equipable.
3. Couts d'equipement:
   - `slot -> main`: 1 interaction d'equipement.
   - `sac/contenant -> main`: 1 action bonus.
4. Si les 2 mains sont libres: ouverture du choix `main principale` / `main secondaire`.
5. Bouclier: main secondaire uniquement.
6. Arme `two-handed`: incompatible main secondaire.
7. Les changements de main/equipement impactent immediatement les actions suivantes du tour (contraintes et couts).
