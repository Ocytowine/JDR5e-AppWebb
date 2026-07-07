# Matrice de preuves I-06I — route serveur OpenAI narrative opt-in

Date : 2026-07-07

Contrats relies :

- [`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md), version `narrative-ai-resolution/1`
- [`Contrat-fournisseur-ia-openai.md`](Contrat-fournisseur-ia-openai.md), version `ai-provider-openai/1`

Statut : `TERMINE`

## Synthese

I-06I ajoute une route serveur opt-in pour utiliser OpenAI sur l'enrichissement narratif, sans exposer la cle au navigateur.

Route :

```text
POST /api/narration/enhance-openai
```

Activation :

```powershell
NARRATION_OPENAI_LIVE=1
OPENAI_API_KEY=...
```

Sans `NARRATION_OPENAI_LIVE=1`, la route repond sans appeler OpenAI.

## Preuves executables

| Exigence | Preuve | Fichiers | Verification |
|---|---|---|---|
| Route serveur dediee | `createNarrativeOpenAiEnhancementApi` expose `/api/narration/enhance-openai` | `server.js`, `narration-module/server/narrativeOpenAiEnhancementRoute.js` | `npm run narration-module:test:narrative-openai-route` |
| Opt-in obligatoire | sans `NARRATION_OPENAI_LIVE=1`, aucun fetch fournisseur n'est appele | `tests/server/verify-narrative-openai-route.js` | `npm run narration-module:test:narrative-openai-route` |
| Cle absente sans reseau | live active sans cle retourne `OPENAI_API_KEY_MISSING` avant fetch | `tests/server/verify-narrative-openai-route.js` | `npm run narration-module:test:narrative-openai-route` |
| Roles bornes | seuls `player_expression_adapter` et `scene_writer` sont acceptes | `narrativeOpenAiEnhancementRoute.js` | `npm run narration-module:test:narrative-openai-route` |
| Structured Outputs Responses | corps OpenAI utilise `text.format` avec `json_schema`, `strict=true`, `store=false` | `narrativeOpenAiEnhancementRoute.js` | `npm run narration-module:test:narrative-openai-route` |
| Correlation stricte | sortie OpenAI rejetee si role, callId, attemptId, packId ou snapshotId divergent | `tests/server/verify-narrative-openai-route.js` | `npm run narration-module:test:narrative-openai-route` |
| UI toujours separee | la surface React n'importe pas `openaiProvider`, ne lit pas la cle et n'appelle pas directement OpenAI | `tests/scene/verify-narrative-app-surface.ts` | `npm run narration-module:test:narrative-app-surface` |

## Limites volontaires

I-06I ne livre pas :

- bascule automatique de la surface React vers OpenAI;
- streaming;
- persistance des incidents en campagne;
- selection fine de modele par role;
- benchmark qualite/cout;
- certification fournisseur finale.

La route est une capacite serveur controlee. Le branchement produit dans l'UI doit rester un sous-lot separe pour conserver un fallback et une UX explicite.

## Commandes executees

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:narrative-openai-route
npm run narration-module:test:openai-provider
npm run narration-module:test:narrative-app-surface
npm run build
```
