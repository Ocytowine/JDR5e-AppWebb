# Matrice de preuves I-05B

Statut : `FERME` — adaptateur fournisseur OpenAI implémenté selon `ai-provider-openai/1`.

Date : 2026-07-07

## Périmètre vérifié

I-05B couvre uniquement l'adaptateur serveur OpenAI, la résolution de clé locale, la construction d'une requête Responses API à schéma strict, le transport simulable, les métriques, l'expurgation et le smoke test live optionnel. Aucun branchement UI, streaming, outil OpenAI ou stockage de prompt brut n'est ajouté.

## Preuves

| # | Exigence | Statut | Preuve exécutable | Limite assumée |
|---|---|---|---|---|
| 1 | Clé côté serveur uniquement | COUVERT | `narration-module:test:openai-provider` vérifie `process.env` et absence de réseau sans clé. | Pas de route UI narrative. |
| 2 | `.env` racine ignoré | COUVERT | `/.env` ajouté à `.gitignore`. | La présence réelle du fichier n'est pas requise par les tests. |
| 3 | Opt-in live explicite | COUVERT | `narration-module:test:openai-provider:live` se désactive sans `NARRATION_OPENAI_LIVE=1`. | Le smoke live n'a pas été exécuté. |
| 4 | Responses API avec schéma strict | COUVERT | Corps d'appel vérifie `text.format.type = json_schema`, `strict = true`, `additionalProperties = false`. | Schéma minimal commun, pas encore schéma spécifique complet par rôle. |
| 5 | Clé absente | COUVERT | Refus avant réseau, incident expurgé. | Aucune. |
| 6 | HTTP 401/403 | COUVERT | Classé `AUTHORITY_VIOLATION`, non retryable, secret expurgé. | HTTP simulé. |
| 7 | HTTP 429 | COUVERT | Classé `TRANSPORT_FAILURE`, retryable. | HTTP simulé. |
| 8 | Sortie fournisseur invalide | COUVERT | Champ inconnu rejeté par les validateurs I-05A. | Aucune. |
| 9 | Sortie fournisseur valide | COUVERT | Réponse OpenAI-shaped parsée, revalidée et métrée. | Pas de qualité narrative mesurée. |
| 10 | Régressions I-00 à I-05A | COUVERT | `contracts`, `memory`, `context`, `time`, `indexeddb`, `ai-pipeline`, `dynamic-creation` passent. | Tests lore/personnage/règles/orchestration non relancés car non modifiés. |
| 11 | Build global | COUVERT | `npm run build` passe. | Aucune. |

## Commandes exécutées

```powershell
npm run narration-module:build
npm run narration-module:test:openai-provider
npm run narration-module:test:openai-provider:live
npm run narration-module:test:ai-pipeline
npm run narration-module:test:dynamic-creation
npm run narration-module:test:memory
npm run narration-module:test:context
npm run narration-module:test:contracts
npm run narration-module:test:time
npm run narration-module:test:indexeddb
npm run build
```

## Réserves assumées après fermeture I-05B

- Le smoke live est opt-in et n'a pas été exécuté dans cette fermeture.
- La certification qualitative, les coûts réels et le calibrage par modèle restent hors I-05B.
- I-06 devra définir l'UI conversationnelle, les logs visibles, le transcript et les opérations de scène avant tout usage joueur.
