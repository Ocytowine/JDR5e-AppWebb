# Plan Optimisation Pipeline IA Semantique (v1)

Date de mise a jour: 2026-03-02
Statut: document recale sur le code reel (pas sur l intention initiale)

## Objectif produit

Construire un MJ narratif fluide, coherent lore, non rigidifie par mots-cles, pilote par IA + outils, avec un serveur qui arbitre les mutations critiques.

## Source de verite auditee

Ce plan est aligne sur les fichiers suivants:
- `test-GAME-2D/server.js`
- `test-GAME-2D/server/narrationChatHandler.js`
- `test-GAME-2D/server/narrationAiHelpers.js`
- `test-GAME-2D/server/narrationPayloadPipeline.js`
- `test-GAME-2D/server/narrationToolRegistry.js`
- `test-GAME-2D/server/mjToolBus.js`
- `test-GAME-2D/server/narrationApiRoutes.js`
- `test-GAME-2D/server/narrationBackgroundTickEngine.js`
- `test-GAME-2D/server/narrationNaturalRenderer.js`
- `test-GAME-2D/server/narrationDebugCommands.js`
- `test-GAME-2D/server/narrationSystemCommands.js`
- `test-GAME-2D/src/ui/NarrationJournalPanel.tsx`
- `test-GAME-2D/scripts/validate-narration-phase56.js`
- `test-GAME-2D/package.json`

## Contrat IA/serveur reel (etat actuel)

Le payload normalise transporte un `mjContract` structure:
- `schemaVersion: "1.0.0"`
- `version: "1.0.0"` (retrocompat)
- `confidence`
- `intent`:
  - `type`
  - `confidence`
  - `commitment` (`declaratif|volitif|hypothetique|informatif`)
  - `riskLevel`
  - `requiresCheck`
  - `reason`
- `mjResponse`:
  - `responseType`
  - `directAnswer`
  - `scene`
  - `actionResult`
  - `consequences`
  - `options`
- `toolCalls`
- `worldMutations`
- `loreGuardReport`

Le classifieur et les schemas IA supportent aussi `semanticIntent`.

## Cible technique (rappel)

Par tour RP:
- 1 appel IA principal max
- 1 appel IA de secours max
- zero appel supplementaire hors ambiguite utile

## Etat reel par phase

### Phase 1 - Contrat unique "Intent + Reponse"
Statut: close fonctionnellement

Ce qui est code:
- normalisation `schemaVersion` + contrat serveur dans:
  - `test-GAME-2D/server/narrationPayloadPipeline.js`
- alignement cote IA (generation/sanitize/refine) dans:
  - `test-GAME-2D/server/narrationAiHelpers.js`
- convergence module narration:
  - `test-GAME-2D/narration-module/src/types.ts`
  - `test-GAME-2D/narration-module/src/MjNarrationGenerator.ts`
  - `test-GAME-2D/narration-module/src/GameNarrationAPI.ts`

Validation:
- `npm run validate:phase1`

### Phase 2 - Commitment semantique
Statut: close fonctionnellement

Ce qui est code:
- gates commitment (`hypothetique/informatif`) + routage `declaratif/volitif`:
  - `test-GAME-2D/server/narrationChatHandler.js`
  - `test-GAME-2D/server/narrationCommitmentPolicy.js`
- classifieur IA et fallback serveur alignes sur `commitment`:
  - `test-GAME-2D/server/narrationAiHelpers.js`
  - `test-GAME-2D/server.js`

Validation:
- `npm run validate:phase2`

### Phase 3 - Arbitrage serveur des mutations critiques
Statut: close fonctionnellement

Ce qui est code:
- helper central `applyCriticalMutation` et recablage massif:
  - `test-GAME-2D/server/narrationIntentMutationEngine.js`
  - `test-GAME-2D/server/narrationChatHandler.js`
  - `test-GAME-2D/server.js`
- suppression fallback runtime final implicite `tickNarrationWithAI` en fin de handler.
- observabilite des mutations critiques:
  - stats dediees `buildPhase3CriticalMutationStatsPayload()` (total calls, byField, bySource, recent)
  - exposees dans `/phase3-debug` (`phase3.criticalMutations`)
  - fichiers:
    - `test-GAME-2D/server/narrationIntentMutationEngine.js`
    - `test-GAME-2D/server/narrationDebugCommands.js`
    - `test-GAME-2D/server/narrationChatHandler.js`
    - `test-GAME-2D/server.js`
- validation dediee phase 3:
  - `test-GAME-2D/scripts/validate-narration-phase3.js`
  - script npm:
    - `test-GAME-2D/package.json` -> `npm run validate:phase3`

Validation:
- `npm run validate:phase3`

### Phase 4 - Reduction validations IA + budget appels
Statut: close fonctionnellement

Ce qui est code:
- budget IA par tour (`total/primary/fallback`) + controleur dedie:
  - `test-GAME-2D/server/narrationAiConfig.js`
  - `test-GAME-2D/server/narrationAiBudget.js`
  - `test-GAME-2D/server/narrationChatHandler.js`
- gating des appels IA auxiliaires par budget/incertitude:
  - `test-GAME-2D/server/narrationChatHandler.js`
- timeout/retry OpenAI:
  - `test-GAME-2D/server.js`
- suivi budget expose en debug:
  - `test-GAME-2D/server/narrationPayloadPipeline.js`
- suivi de routage IA agrege (attempted/executed/skipped + byLabel):
  - `test-GAME-2D/server/narrationPayloadPipeline.js`
  - expose dans `/phase4-debug` via:
    - `test-GAME-2D/server/narrationDebugCommands.js`
    - `test-GAME-2D/server.js`
    - `test-GAME-2D/server/narrationChatHandler.js`
- validation dediee phase 4:
  - `test-GAME-2D/scripts/validate-narration-phase4.js`
  - `test-GAME-2D/scripts/validate-narration-phase4-scenarios.js`
  - script npm:
    - `test-GAME-2D/package.json` -> `npm run validate:phase4`
    - `test-GAME-2D/package.json` -> `npm run validate:phase4:scenarios`

Validation:
- `npm run validate:phase4`
- `npm run validate:phase4:scenarios`

### Phase 5 - Strategie outils extensible
Statut: close fonctionnellement

Ce qui est code:
- registre outils declaratif + filtrage allowlist contextuel:
  - `test-GAME-2D/server/narrationToolRegistry.js`
  - `test-GAME-2D/server.js`
  - `test-GAME-2D/server/narrationAiHelpers.js`
  - `test-GAME-2D/server/narrationChatHandler.js`
- adapters outils dans le bus:
  - `test-GAME-2D/server/mjToolBus.js`

Validation:
- `npm run validate:phase56` (script `test-GAME-2D/scripts/validate-narration-phase56.js`)

### Phase 6 - Extension taxonomie intentions
Statut: close fonctionnellement

Ce qui est code:
- derivee `semanticIntent` et mapping domaines/outils:
  - `test-GAME-2D/server/narrationToolRegistry.js`
- `semanticIntent` cote IA + fallback heuristique:
  - `test-GAME-2D/server/narrationAiHelpers.js`
  - `test-GAME-2D/server.js`
  - `test-GAME-2D/server/narrationChatHandler.js`

Validation:
- `npm run validate:phase56`

### Phase 7 - Observabilite cout/perf
Statut: close fonctionnellement

Ce qui est code:
- stats budget IA aggregatees:
  - `test-GAME-2D/server/narrationPayloadPipeline.js`
- trace de routage IA (`phase12.aiRouting`):
  - `test-GAME-2D/server/narrationChatHandler.js`
- rendu debug UI des infos clefs (`aiCallBudget`, `aiRouting`, tool traces):
  - `test-GAME-2D/src/ui/NarrationJournalPanel.tsx`
- telemetrie perf par tour narratif:
  - latence requete (`phase12.requestLatencyMs`)
  - agregats p50/p95/max
  - moyennes appels IA / fallback
  - alertes regression (seuils via env)
  - `test-GAME-2D/server/narrationPayloadPipeline.js`
- exposition debug phase7 enrichie:
  - `test-GAME-2D/server/narrationDebugCommands.js`

Validation:
- `npm run validate:phase7`

### Phase 8 - Nettoyage obsolescence
Statut: close fonctionnellement

Ce qui est code:
- fallback demo runtime desactive par defaut (opt-in explicite):
  - `test-GAME-2D/server.js`
- fallback transitions example en opt-in explicite:
  - `test-GAME-2D/server.js`
  - `test-GAME-2D/narration-module/src/TransitionRepository.ts`
- source runtime client unifiee API (fallback statique retire):
  - `test-GAME-2D/src/narrationRuntimeState.ts`
- endpoint legacy retire:
  - suppression `POST /api/narration/tick-ai` dans `test-GAME-2D/server/narrationApiRoutes.js`
- extraction progressive du chat handler:
  - `test-GAME-2D/server/narrationDebugCommands.js`
  - `test-GAME-2D/server/narrationSystemCommands.js`
  - `test-GAME-2D/server/narrationAiRoutingController.js`

Validation:
- `npm run validate:phase8`

## Ce qui ne va pas encore (franc)

1. Le coeur reste structurellement lourd, meme si la phase 8 est close fonctionnellement.
2. Le coeur reste lourd:
   - `server.js` ~4015 lignes
   - `narrationChatHandler.js` ~3167 lignes
3. Les validations auto ferment fonctionnellement 1/2/3/4/5/6/7/8, mais une fermeture industrielle (refactor plus profond) reste souhaitable.

## Checks disponibles (verifies)

- Build:
  - `npm run build`
- Validation phase 1:
  - `npm run validate:phase1`
- Validation phase 2:
  - `npm run validate:phase2`
- Validation phase 3:
  - `npm run validate:phase3`
- Validation phase 4:
  - `npm run validate:phase4`
  - `npm run validate:phase4:scenarios`
- Validation phase 5/6:
  - `npm run validate:phase56`
- Validation phase 7:
  - `npm run validate:phase7`
- Validation phase 8:
  - `npm run validate:phase8`

## Roadmap execution (mise a jour)

- [x] Phase 1 close fonctionnellement
- [x] Phase 2 close fonctionnellement
- [x] Phase 3 close fonctionnellement
- [x] Phase 4 close fonctionnellement
- [x] Phase 5 close fonctionnellement
- [x] Phase 6 close fonctionnellement
- [x] Phase 7 close fonctionnellement
- [x] Phase 8 close fonctionnellement

## Prochaines actions recommandees (ordre strict)

1. Stabilisation industrielle:
   - poursuivre la decomposition du handler (intent router/tool orchestration/response composer/runtime gatekeeper).
2. Durcir la CI narration:
   - faire tourner `validate:phase1/2/3/4/56/7/8` sur chaque PR.
