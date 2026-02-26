# Module narration - État actuel (serveur)

Date: 2026-02-26  
Portée: fonctionnement actuel côté serveur (`test-GAME-2D`), en français.

## Objectif opérationnel
Le module narration pilote les réponses MJ en s'appuyant sur:
- un contrat MJ structuré,
- un contexte canonique unique,
- des lectures outils traçables,
- des garde-fous lore.

Le but est de garder une narration fluide, cohérente, et moins dépendante des règles ad hoc.

## Qui fait quoi

### 1) `server.js` (orchestrateur principal)
Rôle:
- point d'entrée HTTP global de l'application,
- routage des endpoints narration (`/api/narration/...`),
- enchaînement métier narration (intent/director, context pack PJ, runtime tick, travel, etc.).

Important:
- `server.js` reste le "chef d'orchestre" des routes.
- il délègue désormais l'enrichissement/normalisation des payloads narration à un module dédié.

### 1.1) `server/narrationApiRoutes.js` (routes narration hors chat)
Rôle:
- regrouper les endpoints narration "infrastructure/métier" hors chat:
  - `/api/narration-runtime-state`
  - `/api/narration/reset`
  - `/api/narration/tick-ai`
  - `/api/narration/character-context`

Objectif:
- sortir ces routes de `server.js` pour clarifier la frontière narration vs reste de l'app.
- conserver la logique métier inchangée (pas de régression fonctionnelle).

### 1.2) `server/narrationChatHandler.js` (route chat narration)
Rôle:
- porter le handler complet de `/api/narration/chat`,
- concentrer toute la logique de conversation MJ (commands debug, RP/HRP, outils, runtime, travel, garde-fous, rendu).

Objectif:
- sortir le bloc le plus volumineux de `server.js`,
- garder `server.js` sur un rôle de composition/wiring.

### 2) `server/narrationPayloadPipeline.js` (pipeline payload narration)
Rôle:
- injecter/normaliser `mjContract`,
- injecter `canonicalContext`,
- appliquer les garde-fous lore Phase 3,
- alimenter les stats debug Phase 1/2/3,
- centraliser `sendJson` pour les réponses narration.

Exports:
- `sendJson(res, statusCode, data)`
- `buildMjContractStatsPayload()`
- `buildPhase3GuardStatsPayload()`

### 3) `server/mjToolBus.js` (bus outils MJ)
Rôle:
- exécuter les tool calls MJ (`get_world_state`, `query_lore`, `query_player_sheet`, etc.),
- fournir des résultats structurés traçables.

Note:
- `get_world_state` lit en priorité le contexte canonique injecté.
- `session_db_read` / `session_db_write` sont désormais branchés sur une persistance locale réelle (phase 4).

### 3.1) `server/sessionNarrativeDb.js` (phase 4 - mémoire de session)
Rôle:
- gérer une base JSON locale persistante de mémoire de partie:
  - `placesDiscovered`
  - `sessionNpcs`
  - `establishedFacts`
  - `rumors`
  - `debtsPromises`
- exposer des opérations simples:
  - lecture (`read`) avec filtre `entity/query/limit`
  - écriture (`write`) via opérations `upsert/delete`
  - stats (`stats`) pour debug phase 4
- stocker l’état dans:
  - `narration-module/runtime/SessionNarrativeDB.v1.json`

### 4) `server/narrationAiHelpers.js` (aides IA narration)
Rôle:
- classification intent/director par IA,
- génération de réponse MJ structurée,
- raffinement de réponse avec `toolResults`.

### 4.1) `server/narrationIntentMutationEngine.js` (phase 5)
Rôle:
- centraliser la logique `intentions -> mutations` hors `server.js`:
  - calcul des deltas (`computeWorldDelta`, `computeSceneOnlyDelta`)
  - application normalisée des mutations monde (`applyWorldDelta`)
  - mapping des intentions phase 5 (`observe/move/social/investigate/risk_action/system`)
- exposer les stats phase 5 via `buildPhase5MutationStatsPayload()`.

### 4.2) `server/narrationBackgroundTickEngine.js` (phase 6)
Rôle:
- appliquer un tick de fond après les tours narratifs RP (hors commandes système),
- faire progresser quêtes/trames/compagnons/marchandages même sans action runtime explicite du joueur,
- publier des stats de tick via `buildPhase6BackgroundStatsPayload()`.

### 4.3) `server/narrationNaturalRenderer.js` (phase 7)
Rôle:
- rendre les réponses MJ plus naturelles (moins assistant/gabarit),
- éviter les blocs options automatiques systématiques,
- n'afficher des options que quand le contexte narratif le justifie.

### 4.4) séparation debug (phase 8)
Rôle:
- isoler la télémétrie narration dans un canal `debug` dédié côté payload,
- garder le flux RP principal propre (`reply`, `mjResponse`, `speaker`, etc.),
- conserver la capacité de diagnostic complète sans polluer les échanges joueur.

### 5) `narration-module/src/*` (runtime narratif)
Rôle:
- transitions de quêtes/trames/compagnons/marchandage,
- persistance d'état narratif,
- orchestration de tick narratif.

## Flux d'une requête `/api/narration/chat`
1. `server.js` reçoit le message joueur.
2. Le serveur construit/charge:
- état monde narration (`NarrativeWorldState`),
- contexte PJ (`contextPack`),
- état runtime narratif.
3. IA + tool bus préparent/raffinent une réponse MJ.
4. `sendJson` (pipeline) applique:
- contrat MJ,
- contexte canonique,
- garde-fous lore,
- stats debug.
5. Réponse renvoyée au client.

## Commandes debug disponibles
- `/contract-debug`
- `/phase1-debug` (grounding outils)
- `/phase2-debug` (lectures canoniques)
- `/phase3-debug` (garde-fous lore)
- `/phase4-debug` (compteurs mémoire session persistée)
- `/phase5-debug` (mutations monde par intention)
- `/phase6-debug` (tick de fond narratif)
- `/phase7-debug` (naturalité du rendu MJ)
- `/phase8-debug` (séparation canal debug)
- `/context-debug`, `/profile-debug`, `/rules-debug`

## Ce qui est déjà séparé
- Le pipeline de payload narration est extrait de `server.js` dans `server/narrationPayloadPipeline.js`.
- Les responsabilités "contrat/canon/guards/stats" ne sont plus portées directement par `server.js`.
- Les routes narration hors chat sont extraites dans `server/narrationApiRoutes.js`.
- Le handler principal `/api/narration/chat` est extrait dans `server/narrationChatHandler.js`.
- La mémoire de session narrative (phase 4) est persistée et consommable par les outils MJ.
- Le moteur phase 5 (`intentions -> mutations`) est extrait dans `server/narrationIntentMutationEngine.js`.
- Le tick de fond phase 6 est extrait dans `server/narrationBackgroundTickEngine.js`.
- Le rendu naturel phase 7 est extrait dans `server/narrationNaturalRenderer.js`.
- La séparation debug phase 8 est appliquée dans `server/narrationPayloadPipeline.js` (canal `debug`).

## Ce qui reste à extraire (prochaine étape recommandée)
- Optionnel: découper `narrationChatHandler.js` en sous-modules (ex: commandes debug, travel/access, rendu RP, branche HRP) pour améliorer la lisibilité et les tests unitaires.
