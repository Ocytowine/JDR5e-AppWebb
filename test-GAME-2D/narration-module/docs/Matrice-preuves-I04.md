# Matrice de preuves I-04

Statut : `FERME` — socle mémoire/snapshot/contexte implémenté selon `memory-context/1`.

Date : 2026-07-07

## Périmètre vérifié

I-04 couvre uniquement les types, validateurs, ports, repository mémoire déterministe, builders snapshot/contexte et tests contractuels. Aucun fournisseur IA réel, aucune UI narrative, aucun embedding distant et aucune création dynamique ne sont branchés.

## Preuves

| # | Exigence | Statut | Preuve exécutable | Limite assumée |
|---|---|---|---|---|
| 1 | Mémoire sourcée, sans vérité parallèle | COUVERT | `narration-module:test:memory` valide `MemoryUnitV1`, sources obligatoires et reconstruction d'index. | Les sources réelles de campagne ne sont pas encore alimentées automatiquement. |
| 2 | Index reconstruisible | COUVERT | `InMemoryMemoryRepositoryV1.rebuildIndexes` reconstruit 3 canaux cache depuis les unités mémoire. | Pas encore d'index sémantique distant. |
| 3 | Rappel par déclencheurs forts/faibles | COUVERT | NAR-ACC-004 dans `verify-memory-recall.ts` retrouve les Archives par lieu et texte. | La paraphrase est lexicale/structurée, pas vectorielle. |
| 4 | Retour à un lieu après ellipse | COUVERT | NAR-ACC-005 place l'état courant des Archives avant le souvenir passé. | Pas encore connecté au runtime de scène. |
| 5 | Exclusion des voisins inutiles | COUVERT | Le souvenir de marché non lié n'entre pas dans la capsule Archives. | Le scoring avancé restera à améliorer avant IA réelle. |
| 6 | Secret joueur interdit, vérité système disponible | COUVERT | NAR-ACC-006 vérifie `PLAYER_CHARACTER` sans secret et `SYSTEM_MJ` avec secret ciblé. | La révélation progressive reste hors lot. |
| 7 | Snapshot immuable et empreinté | COUVERT | `narration-module:test:context` construit un `TurnSnapshotV1` et rejoue le même résultat. | Le snapshot lit des fixtures, pas encore `CampaignRepository`. |
| 8 | Paquet de contexte déterministe | COUVERT | Deux builds identiques produisent le même `RoleContextPackV1` et la même trace. | Pas de fournisseur IA consommateur. |
| 9 | Budget strict et ordre de réduction | COUVERT | NAR-ACC-015 exclut les blocs optionnels trop coûteux et échoue si le socle obligatoire dépasse. | Les estimations restent approximatives. |
| 10 | Paquet joueur refusant les secrets | COUVERT | `CONTEXT_VISIBILITY_DENIED` sur bloc obligatoire `SYSTEM_ONLY`. | Les secrets appris dynamiquement dépendront d'un futur domaine révélation. |
| 11 | Obsolescence | COUVERT | `CURRENT`, `REPROJECT_REQUIRED`, `REVALIDATE_REQUIRED`, `STALE` testés. | La comparaison se fait sur dépendances déclarées. |
| 12 | Non-régression I-00 à I-03 | COUVERT | `narration-module:test:contracts`, `narration-module:test:time`, `narration-module:test:indexeddb` passent. | Les tests lore/personnage/règles/orchestration n'ont pas été relancés car I-04 ne modifie pas ces domaines. |
| 13 | Build global | COUVERT | `npm run build` passe. | Aucune. |

## Commandes exécutées

```powershell
npm run narration-module:build
npm run narration-module:test:memory
npm run narration-module:test:context
npm run narration-module:test:contracts
npm run narration-module:test:time
npm run narration-module:test:indexeddb
npm run build
```

## Réserves assumées après fermeture I-04

- Décider au lot suivant si le repository mémoire reste mémoire pure pour le prototype ou obtient un adaptateur IndexedDB dédié.
- Brancher les sources réelles de campagne et les consommateurs IA uniquement après contrat I-05.
- Remplacer le scoring lexical/structuré par une recherche plus riche seulement si les preuves de coût, secret et reproductibilité sont conservées.
