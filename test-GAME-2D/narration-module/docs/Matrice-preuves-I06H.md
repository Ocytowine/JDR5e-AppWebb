# Matrice de preuves I-06H — branchement enrichissement UI et fournisseur OpenAI controle

Date : 2026-07-07

Contrats relies :

- [`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md), version `narrative-ai-resolution/1`
- [`Contrat-fournisseur-ia-openai.md`](Contrat-fournisseur-ia-openai.md), version `ai-provider-openai/1`

Statut : `TERMINE`

## Synthese

I-06H branche l'enrichissement IA sur la surface narration prototype et rend le fournisseur OpenAI compatible avec le meme port que le faux fournisseur contractuel.

Le lot conserve deux frontieres :

- l'UI navigateur utilise uniquement `FakeContractAiProviderV1`;
- OpenAI reste cote serveur/tests via `OpenAiContractAiProviderV1`.

## Preuves executables

| Exigence | Preuve | Fichiers | Verification |
|---|---|---|---|
| UI enrichie sans fournisseur reel navigateur | `NarrativeAppSurface` appelle `enhanceNarrativeDisplayWithAiV1` avec `FakeContractAiProviderV1` | `src/narration-ui/NarrativeAppSurface.tsx` | `npm run narration-module:test:narrative-app-surface` |
| Pas de dependance tactique dans la surface narration | Test source contre `GameBoard`, routes tactiques, stockage local et `openaiProvider` | `tests/scene/verify-narrative-app-surface.ts` | `npm run narration-module:test:narrative-app-surface` |
| OpenAI compatible port IA contractuel | `OpenAiContractAiProviderV1` implemente `ContractAiProviderV1` | `src/ai/openaiProvider.ts` | `npm run narration-module:test:openai-provider` |
| Structured Outputs Responses conserve | Corps OpenAI utilise `text.format` `json_schema` strict | `src/ai/openaiProvider.ts`, test OpenAI | `npm run narration-module:test:openai-provider` |
| Cle absente sans reseau | Appel OpenAI refuse avant fetch si cle manquante | `tests/ai/verify-openai-provider.ts` | `npm run narration-module:test:openai-provider` |
| Diagnostics expurges | 401/403 et erreurs fournisseur ne fuient pas la cle | `tests/ai/verify-openai-provider.ts` | `npm run narration-module:test:openai-provider` |
| Build navigateur sans OpenAI serveur | L'UI n'importe pas l'index IA complet ni `openaiProvider` | imports directs dans `NarrativeAppSurface.tsx` | `npm run build` |

## Limites volontaires

I-06H ne livre pas :

- appel OpenAI live depuis l'UI;
- route HTTP narrative de production;
- streaming;
- selection de modele par role;
- benchmark qualite/cout;
- persistance des incidents IA en campagne;
- certification qualitative.

Le live OpenAI reste opt-in par les mecanismes I-05B.

## Commandes executees

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:narrative-app-surface
npm run narration-module:test:ai-narrative-enhancement
npm run narration-module:test:openai-provider
npm run build
```
