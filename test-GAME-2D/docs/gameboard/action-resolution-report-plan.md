# Plan - Rapport de resolution d'action (UI multi-cibles)

## Objectif
Mettre en place une sortie de resolution **structuree** (non basee sur parsing de logs texte) pour afficher proprement:
- jets (attaque, sauvegarde, check),
- degats par type,
- etats appliques/retires,
- detail par cible en cas de multi-cible.

Ce plan respecte l'architecture ActionEngine existante (`ops`, `hooks`, `resolution`, `taxonomy`) et reste data-driven.

## Principes d'architecture
1. Les JSON d'action ne changent pas de logique metier.
2. Le moteur produit un **ActionExecutionReport** runtime en sortie de resolution.
3. L'UI consomme ce rapport pour:
- fenetre contextuelle,
- mini-fenetres/carte par cible,
- logs narratifs derives.
4. Les logs texte restent utiles, mais deviennent une vue secondaire.

## Schema runtime propose

### 1) ActionExecutionReport
- `actionId: string`
- `actorId: string`
- `round?: number`
- `phase?: "player" | "enemies"`
- `targets: TargetResolutionReport[]`
- `phaseTrace?: string[]` (debug optionnel)

### 2) TargetResolutionReport
- `targetId: string`
- `targetKind?: "player" | "enemy" | "obstacle" | "wall" | "cell"`
- `outcome: "hit" | "miss" | "crit" | "saveSuccess" | "saveFail" | "checkSuccess" | "checkFail" | "contestedWin" | "contestedLose"`
- `attackRoll?: { rolls: number[]; kept: number; bonus: number; total: number; crit: boolean; advantageMode?: "normal" | "advantage" | "disadvantage" }`
- `saveRoll?: { ability: string; dc: number; roll: number; modifier: number; total: number; success: boolean }`
- `checkRoll?: { ability: string; dc: number; roll: number; modifier: number; total: number; success: boolean }`
- `damage?: { total: number; byType: Array<{ type: string; amount: number }> }
- `statusesApplied?: Array<{ id: string; durationTurns?: number; sourceId?: string }>`
- `statusesRemoved?: Array<{ id: string }>`
- `ops: AppliedOpReport[]`

### 3) AppliedOpReport
- `op: string`
- `target: "self" | "primary" | "multi" | "world"`
- `branch: "onResolve" | "onHit" | "onMiss" | "onCrit" | "onSaveSuccess" | "onSaveFail" | "hook" | "unknown"`
- `summary: string`
- `payload?: Record<string, unknown>`

## Points d'integration (code)

### A. Engine types
Fichier cible:
- `test-GAME-2D/src/game/engine/core/types.ts`

Actions:
- Ajouter les interfaces `ActionExecutionReport`, `TargetResolutionReport`, `AppliedOpReport`.
- Etendre le resultat d'execution pour transporter le report.

### B. Execution pipeline
Fichier cible:
- `test-GAME-2D/src/game/engine/core/actionExecute.ts`

Actions:
- Initialiser le report en debut d'execution.
- Capturer outcome/rolls par cible au moment `RESOLVE_CHECK`.
- Associer le contexte de branche (`onHit`, `onMiss`, etc.) lors de l'application des ops.

### C. Application des operations
Fichier cible:
- `test-GAME-2D/src/game/engine/core/ops.ts`

Actions:
- Sur `DealDamage` / `DealDamageScaled`: alimenter `damage.byType`.
- Sur `ApplyCondition` / `RemoveCondition`: alimenter `statusesApplied` / `statusesRemoved`.
- Sur autres ops: ajouter un `AppliedOpReport` minimal (resume + payload utile).

### D. Orchestrateur
Fichier cible:
- `test-GAME-2D/src/game/engine/core/actionEngine.ts`

Actions:
- Exposer `report` dans `ActionResolutionResult`.
- Ne pas changer les contrats metier existants (retour backward-compatible).

### E. UI GameBoard
Fichier cible:
- `test-GAME-2D/src/GameBoard.tsx`

Actions:
- Stocker le dernier `ActionExecutionReport`.
- Alimenter:
- la fenetre contextuelle (detail global + par cible),
- les popups/carte par cible (ephemeres),
- les logs derives en francais.

## Design UI recommande

### 1) Fenetre contextuelle (ActionContextWindow)
- Conserver les controles (validation, cible, jets).
- Ajouter section `Resolution`:
- ligne par cible,
- outcome + jet,
- degats type par type,
- etats appliques/retire.

### 2) Cartes cible (ephemeres)
- Apparition pres de chaque token cible.
- Contenu minimal:
- `Jet: ...`
- `Degats: 4 tranchant + 5 feu`
- `Etat: empoisonne (1 tour)`
- Duree courte (2-4s), clic pour voir le detail contextuel.

### 3) Logs
- Garder les logs texte lisibles.
- Les generer depuis le report (source unique de verite), pas via regex sur logs moteur.

## Compatibilite taxonomy/data-driven
1. Le schema JSON d'action n'est pas modifie.
2. Les enums de `taxonomy.json` restent reference d'entree metier.
3. Le report est un artefact runtime interne, sans casser les donnees source.
4. Aucun comportement classe/feature hardcode: tout reste porte par `ops/hooks/conditions`.

## Phasage d'implementation

### Phase 1 - Types + plumbing
- Ajouter types report dans `types.ts`.
- Prolonger les retours moteur jusqu'a `resolveActionUnified`.
- QA: build + execution simple melee.

### Phase 2 - Capture outcome par cible
- Capturer rolls/outcomes multi-cibles.
- QA: attaque mono/multi cibles.

### Phase 3 - Capture ops appliquees
- Injecter `AppliedOpReport` dans `ops.ts`.
- Mapper degats par type + etats.
- QA: sorts save, conditions, multi-damage.

### Phase 4 - UI contextuelle
- Ajouter rendu detail resolution par cible.
- QA: lisibilite et coherence avec logs.

### Phase 5 - Cartes ephemeres par cible
- Affichage local pres tokens.
- QA: stacking, animation, nettoyage fin de tour.

### Phase 6 - Stabilisation
- Ajustements UX, perfs, i18n logs FR.
- Verification regressions (Action Surge, Extra Attack, WM, reactions).

## Cas de test prioritaires
1. Attaque melee simple (hit/miss/crit).
2. Sort a sauvegarde (save success/fail).
3. Sort multi-cibles avec degats heterogenes.
4. Actions avec `ApplyCondition` et retrait de status.
5. Reactions qui modifient outcome ou degats.
6. Weapon mastery + extraDamage (onHit/onCrit/onResolve).

## Risques et garde-fous
1. Risque: duplication de logique UI/log.
- Garde-fou: le report runtime devient source unique.
2. Risque: surcharge visuelle en multi-cibles.
- Garde-fou: detail complet dans contexte, carte ephemere concise.
3. Risque: perf sur gros combats.
- Garde-fou: payload report compact + TTL UI court.

## Definition of done
1. Chaque resolution fournit un report structure non vide (si action resolue).
2. La fenetre contextuelle affiche le detail par cible sans parsing de logs.
3. Les cartes cible affichent jets/degats/etats de facon concise.
4. Les logs FR derivent du report et restent coherents.
5. Build/QA scenarios critiques passes.
