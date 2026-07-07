# Reprise de travail — I-04 audit AF-R08/AF-R09

Date : 2026-07-07
Branche observée : `Narration-V4`
Dernière capacité livrée : voyage segmenté, interruptions et rencontres contextuelles déterministes.
Prochaine capacité : mémoire, snapshot et contextes, audit contractuel uniquement avant implémentation.

## Démarrage obligatoire de la prochaine conversation

1. Lire `AGENTS.md`, `README.md` et `TASKS.md`.
2. Exécuter `git status --short --branch`.
3. Ne pas annuler les modifications locales : I-03A, I-03B, I-03C et I-03D sont présents dans le worktree et aucun commit n'a été créé par Codex.
4. Lire [`Matrice-preuves-I03.md`](Matrice-preuves-I03.md), puis [`Memoire-et-rappel.md`](Memoire-et-rappel.md), [`Snapshot-et-contextes.md`](Snapshot-et-contextes.md) et les scénarios NAR-ACC-004, NAR-ACC-005, NAR-ACC-015 et la partie perspective de NAR-ACC-006.
5. Exécuter les commandes npm depuis `test-GAME-2D/`.

## État livré

### I-03A — Noyau temporel

- propositions d'avance exactes, estimées, par processus ou hors temps;
- échéances versionnées et conversion en tâches;
- sélection de la première seconde exigible;
- ordre topologique stable avec politiques de frontière;
- cycles, dépendances absentes et insertions rétroactives refusés;
- prochaine frontière monde dérivée de `CampaignClock`.

### I-03B — Persistance et checkpoints

- agrégats `world.schedule`, `world.simulation-cursor` et `process.state`;
- validateurs stricts, empreinte du checkpoint et arithmétique du curseur;
- `prepareTemporalSegmentCommitV1` prépare horloge, échéancier, processus, événements et commande dans une seule `CommitRequest`;
- rejeu idempotent, fermeture/réouverture IndexedDB et panne injectée sans état partiel.

### I-03C — Adaptateur monde

- `WorldSimulationPortV1` et `MapModuleWorldSimulationAdapterV1`;
- appel de `runWorldHours` uniquement avec un entier positif d'heures;
- simulation sur copie, sans mutation du snapshot source;
- vérification croisée de l'empreinte du snapshot, des ticks et du curseur;
- publication atomique de `world.state`, `world.simulation-cursor`, `world.clock` et du `TickOutput`;
- moteur réel vérifié pour 1 h et 6 h en mémoire et dans Chromium.

### I-03D — Voyage segmenté

- types `TravelPlanV1`, `TravelSegmentV1`, `TravelCheckpointV1` et `TravelProcessStateV1`;
- calcul de pression de rencontre et décision déterministe par empreinte de graine;
- temps nul explicite pour clarification ou échange méta;
- arrêt d'un segment à la frontière monde, à une interruption, à une rencontre ou à l'arrivée;
- transformation d'un voyage suspendu en `process.state` avec `pendingDecision`;
- sélection déterministe d'un candidat structuré depuis signaux monde, lore ou archétypes autorisés;
- commit atomique horloge, checkpoint, position et événement en mémoire et Chromium;
- preuves exécutables pour NAR-ACC-007, NAR-ACC-010 et NAR-ACC-020 au niveau pur et persistant.

## Fichiers clés

- `narration-module/src/time/types.ts` : contrats du noyau temporel.
- `narration-module/src/time/temporalKernel.ts` : validation et ordonnancement.
- `narration-module/src/time/persistenceTypes.ts` : payloads persistants.
- `narration-module/src/time/persistenceValidation.ts` : validateurs et empreintes.
- `narration-module/src/time/prepareTemporalSegment.ts` : préparation du commit atomique.
- `narration-module/src/time/worldSimulationTypes.ts` : port monde.
- `narration-module/src/time/MapModuleWorldSimulationAdapter.ts` : adaptateur du moteur existant.
- `narration-module/tests/time/` : preuves noyau, persistance et moteur réel.
- `narration-module/tests/browser/indexeddb-browser.ts` : exécution des contrats temporels dans Chromium.

## Invariants à préserver

- `world.clock.elapsedGameSeconds` reste l'unique horloge autoritaire.
- `tick`, `microTick`, `macroTick` et `worldSimulatedThrough` sont des curseurs dérivés.
- Aucun appel à `runWorldHours` avec zéro, une fraction ou une durée UI brute.
- Le moteur monde travaille sur une copie et ne publie rien avant le commit.
- Une narration au futur ne crée pas une échéance.
- Une reprise réutilise batch, opération, clé d'idempotence, tirages et checkpoint.
- Aucun résultat IA ne décide d'un trajet, d'une durée, d'une rencontre ou d'une mutation monde dans I-03D.
- Ne pas brancher UI, créateur de personnage, tactique ou repos dans ce lot.
- La réserve I-02 de parité directe import/plateau reste visible et hors d'I-03.

## Plan d'action suivant

### 1. Auditer AF-R08 — Mémoire

Définir unités de mémoire, sources autoritaires, index reconstruisible, quotas, niveaux de secret, obsolescence et rappel paraphrasé. Aucun moteur de recherche ou appel IA ne doit être codé avant gel du contrat.

### 2. Auditer AF-R09 — Snapshot et contextes

Définir `TurnSnapshot`, `RoleContextPack`, budgets, traces de sélection, dépendances, exclusions et règles de non-fuite. Les données I-03 deviennent des sources possibles, pas un contexte brut envoyé tel quel.

### 3. Produire le contrat I-04

Le contrat doit préciser les types, validateurs, fixtures, tests et limites. Il doit aussi dire explicitement ce qui reste hors lot : fournisseur IA réel, UI finale, mémoire sémantique avancée si elle n'est pas nécessaire au MVP, et certification de capacité longue.

## Risques connus

- `runWorldHours` force au moins un tick : ne jamais contourner l'adaptateur.
- Le bootstrap applicatif ne fournit pas encore automatiquement le seed `world.state`; les tests I-03 initialisent cet agrégat dans un commit temporel à la seconde zéro.
- Les sorties monde contiennent événements, deltas, signaux, rumeurs et opportunités; I-04 doit les utiliser comme sources, sans les envoyer brutes et sans révéler de secret.
- La mémoire ne doit pas devenir une deuxième vérité : elle rappelle ou indexe des sources committées, elle ne remplace jamais événements et agrégats propriétaires.

## Vérifications actuellement vertes

```powershell
npm run narration-module:build
npm run narration-module:test:contracts
npm run narration-module:test:time
npm run narration-module:test:indexeddb
npm run map-module:test:regression
npm run build
```

Derniers résultats : 19 contrats noyau, 7 contrats bootstrap, 6 contrats temporels mémoire/Chromium, 4 groupes de preuves temporelles, suite IndexedDB complète et build global réussis.

## Condition de fin du prochain audit

I-04 ne pourra être ouvert en implémentation que lorsque AF-R08 et AF-R09 auront un contrat figé, des fixtures prévues et une gate exécutable claire.
