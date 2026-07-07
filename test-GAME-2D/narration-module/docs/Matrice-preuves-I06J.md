# Matrice de preuves I-06J — bascule UI OpenAI opt-in avec fallback local

Date : 2026-07-07

Contrats relies :

- [`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md), version `narrative-ai-resolution/1`
- [`Contrat-surface-narration-app.md`](Contrat-surface-narration-app.md), version `narrative-app-surface/1`

Statut : `TERMINE`

## Synthese

I-06J ajoute dans la surface narration un choix utilisateur :

```text
IA narrative : Locale / OpenAI
```

Le comportement reste conservateur :

- `Locale` utilise le faux fournisseur contractuel;
- `OpenAI` appelle uniquement la route serveur `/api/narration/enhance-openai`;
- si la route est désactivée, absente, invalide ou si la sortie est refusée, l'UI revient automatiquement au rendu local;
- le statut UI expose la catégorie d'incident expurgée en cas de fallback OpenAI, sans prompt ni secret;
- aucune clé OpenAI, variable d'environnement ou URL OpenAI directe n'existe dans le navigateur.

## Preuves executables

| Exigence | Preuve | Fichiers | Verification |
|---|---|---|---|
| Sélecteur UI visible | rendu statique contient `IA narrative`, `Locale` et `OpenAI` | `src/narration-ui/NarrativeAppSurface.tsx` | `npm run narration-module:test:narrative-app-surface` |
| Mode local par défaut | état initial `local` et statut `Mode local actif` | `src/narration-ui/NarrativeAppSurface.tsx` | `npm run narration-module:test:narrative-app-surface` |
| Appel OpenAI uniquement via serveur | client dédié utilise `/api/narration/enhance-openai` | `src/narration-ui/serverOpenAiEnhancementClient.ts` | `npm run narration-module:test:narrative-app-surface` |
| Pas d'appel OpenAI navigateur | test source interdit `api.openai.com`, `OPENAI_API_KEY` et `openaiProvider` dans le client | `tests/scene/verify-narrative-app-surface.ts` | `npm run narration-module:test:narrative-app-surface` |
| Fallback local | si `enhanceNarrativeDisplayWithAiV1` revient en fallback en mode OpenAI, l'UI relance l'enrichissement local | `src/narration-ui/NarrativeAppSurface.tsx` | `npm run narration-module:build` |
| Diagnostic fallback | le statut OpenAI affiche rôle, catégorie et étape d'incident expurgés | `src/narration-ui/NarrativeAppSurface.tsx` | `npm run narration-module:build` |
| Pas de remplissage atmosphérique | météo/localisation en `NO_COMMIT_RESPONSE` n'appellent pas `scene_writer` et restent sans `GM_NARRATION` inventée | `src/application/aiNarrativeEnhancement.ts`, `tests/scene/verify-ai-narrative-enhancement.ts` | `npm run narration-module:test:ai-narrative-enhancement` |
| Route serveur toujours protégée | route opt-in et validation serveur inchangées | `tests/server/verify-narrative-openai-route.js` | `npm run narration-module:test:narrative-openai-route` |

## Correctif live 2026-07-07

Un test manuel avec route active peut encore tomber en fallback si la sortie du fournisseur ne respecte pas strictement le contrat local. La route serveur contraint désormais OpenAI avec un schéma JSON strict construit par requête :

- `callId`, `attemptId`, `packId`, `snapshotId`, `role` et `contractVersion` doivent correspondre exactement au tour;
- `player_expression_adapter` reçoit un payload borné avec `addedMeaning=[]` et `safeToUse=true`;
- `scene_writer` reçoit un payload borné avec `narrationBlocks[].groundedIn`;
- le prompt système explicite les interdictions : pas de mutation de faits, inventaire, combat, succès, échec, secret ou temps.

Le correctif améliore la compatibilité live sans assouplir la validation locale.

Correctif complémentaire : le schéma Structured Outputs n'utilise plus `const` ni `anyOf` pour les contraintes exactes. Les corrélations passent par `enum` à valeur unique et le nullable par `type: ["string", "null"]`, afin de rester dans un sous-ensemble JSON Schema plus compatible avec la route Responses API stricte.

Correctif de calibration : les premiers tests live ont montré que `scene_writer` produisait une ambiance générique sur des questions méta ou informatives comme la météo et la localisation. L'enrichissement saute désormais `scene_writer` sur `NO_COMMIT_RESPONSE` sans matière fictionnelle autorisée. Cette absence d'appel n'est pas un fallback : l'UI indique qu'aucun enrichissement narratif n'était nécessaire.

## Limites volontaires

I-06J ne livre pas :

- streaming;
- affichage détaillé des incidents IA;
- persistance du choix utilisateur;
- benchmark qualité/coût;
- certification fournisseur;
- usage OpenAI pour les rôles de planification, règles, PNJ ou création.

## Commandes executees

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:narrative-app-surface
npm run narration-module:test:narrative-openai-route
npm run build
```
