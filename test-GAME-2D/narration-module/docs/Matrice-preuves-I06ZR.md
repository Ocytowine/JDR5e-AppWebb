# Matrice de preuves I-06ZR

Date : 2026-07-17

| Exigence | Preuve |
|---|---|
| Autorité champ par champ | [`Matrice-autorite-intention-I06ZR.md`](Matrice-autorite-intention-I06ZR.md) |
| Contradictions contrôlées | six fixtures : action, cible legacy, cible résolue, engagement, famille et runtime |
| Aucune commande contradictoire | chaque fixture exige `buildNarrativeDomainCommandV1(...) === null` |
| Resolver protégé | validation canonique exécutée avant chargement de scène et préparation d'effet |
| `coreMeaning` sans autorité | texte legacy trompeur accepté, mais commande parole/cible/domaine suivent `semanticIntent` |
| Planner et performer canoniques | branche parole et cible fondées sur `semanticIntent.kind/target` |
| Mémoire et mutations canoniques | résumé, cible et nature de mutation fondés sur `semanticIntent` |
| Panne IA sans faux succès | validations IA produisent diagnostic sans fallback narratif ni commande |
| Échec sans verrou résiduel | régression forcée : opération `RECEIVED` annulée puis tour suivant accepté sans `CAMPAIGN_BUSY` |
| Legacy borné | consommateurs, justification et conditions de retrait inventoriés dans la matrice d'autorité |

## Vérifications

- `npm run narration-module:test:intent-authority`
- `npm run narration-module:test:semantic-invariance`
- `npm run narration-module:test:ai-intent-interpretation`
- `npm run narration-module:test:narrative-resolution`
- `npm run narration-module:test:narrative-turn-controller`
- `npm run narration-module:test:ai-narrative-enhancement`
- `npm run narration-module:test:ai-pipeline`
- `npm run narration-module:test:vertical-quality`
- `npm run narration-module:build`
- `npm run build`
