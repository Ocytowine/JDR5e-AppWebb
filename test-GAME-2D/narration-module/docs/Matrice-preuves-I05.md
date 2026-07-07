# Matrice de preuves I-05A

Statut : `FERME` — socle pipeline IA contractuel implémenté selon `ai-pipeline/1`.

Date : 2026-07-07

## Périmètre vérifié

I-05A couvre uniquement types, validateurs, ports, faux fournisseur déterministe, correction bornée, incidents expurgés et validation de créations dynamiques. Aucun fournisseur IA réel, aucune clé, aucune UI conversationnelle et aucune promotion d'intrigue jouable complète ne sont branchés.

## Preuves

| # | Exigence | Statut | Preuve exécutable | Limite assumée |
|---|---|---|---|---|
| 1 | Route IA sans fournisseur réel | COUVERT | `narration-module:test:ai-pipeline` rejette `REMOTE_PROVIDER` en I-05A. | La certification d'un fournisseur réel est reportée à I-05B. |
| 2 | Enveloppe stricte de sortie | COUVERT | Sortie avec champ inconnu rejetée avant correction. | Validation manuelle stricte, sans AJV dédié pour ce lot. |
| 3 | NAR-ACC-001 question hypothétique | COUVERT | `possibility_query` + `commitment:none` interdit mutation et temps de jeu. | Pas encore connecté à une UI de conversation. |
| 4 | NAR-ACC-014 échec avant commit | COUVERT | Sorties invalides épuisent correction/régénération sans sortie acceptée. | Le repository n'est pas invoqué dans I-05A. |
| 5 | NAR-ACC-014 rendu post-commit | COUVERT | Fallback déterministe lit faits validés sans rejouer le métier. | Rendu minimal, non qualitatif. |
| 6 | Incidents expurgés | COUVERT | Réponse brute fournisseur et champs sensibles sont remplacés par `[REDACTED]`. | Pas de stockage physique d'incident. |
| 7 | Circuit/fallback non certifié | COUVERT | Route distante bloquée, fallback non utilisé et `AiCircuitBreakerV1` ouvre/sonde/ferme par rôle et route. | Pas de fournisseur réel. |
| 8 | NAR-ACC-003 promotion PNJ | COUVERT | Figurant éphémère puis référence légère selon profondeur demandée et engagements. | Pas encore d'agrégat `NarrativeActorDomain`. |
| 9 | NAR-ACC-016 doublon | COUVERT | `CREATE_DISTINCT` rejeté si candidat doublon existe; `ENRICH` accepté explicitement. | Similarité avancée textuelle/sémantique reportée. |
| 10 | NAR-ACC-019 injection/secret | COUVERT | Proposition contenant prompt, clé ou pollution prototype rejetée. | Assainissement UI futur hors lot. |
| 11 | Perspective NAR-ACC-006 | COUVERT AU CONTRAT | Intrigue `PLOT_THREAD` exige `CoherenceCritic` et garde les secrets dans `withhold`. | Le graphe d'intrigue jouable reste hors I-05A. |
| 12 | Non-régression I-00 à I-04 | COUVERT | `narration-module:test:contracts`, `narration-module:test:memory`, `narration-module:test:context`, `narration-module:test:time`, `narration-module:test:indexeddb` passent. | Les tests lore/personnage/règles/orchestration n'ont pas été relancés car I-05A ne modifie pas ces domaines. |
| 13 | Build global | COUVERT | `npm run build` passe. | Aucune. |

## Commandes exécutées

```powershell
npm run narration-module:build
npm run narration-module:test:ai-pipeline
npm run narration-module:test:dynamic-creation
npm run narration-module:test:contracts
npm run narration-module:test:memory
npm run narration-module:test:context
npm run narration-module:test:time
npm run narration-module:test:indexeddb
npm run build
```

## Réserves assumées après fermeture I-05A

- Le faux fournisseur ne certifie aucune qualité de prose ni performance d'un modèle réel.
- Le branchement d'un fournisseur distant nécessite un futur audit I-05B.
- Les domaines propriétaires de scène, acteurs, intrigue, inventaire, tactique et repos restent hors lot.
