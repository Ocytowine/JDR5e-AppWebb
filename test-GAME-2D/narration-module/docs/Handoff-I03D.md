# Reprise de travail — I-03D

Date : 2026-07-06  
Branche observée : `Narration-V4`  
Prochaine capacité : voyage segmenté, interruptions et rencontres contextuelles déterministes.

## Démarrage obligatoire de la prochaine conversation

1. Lire `AGENTS.md`, `README.md` et `TASKS.md`.
2. Exécuter `git status --short --branch`.
3. Ne pas annuler les modifications locales : I-03A, I-03B et I-03C sont présents dans le worktree et aucun commit n'a été créé par Codex.
4. Lire [`Contrat-temps-processus.md`](Contrat-temps-processus.md), puis les scénarios NAR-ACC-007, NAR-ACC-010 et NAR-ACC-020.
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

## Plan d'action I-03D

### 1. Figer le contrat de voyage

Définir `TravelProcessV1`, `TravelPlanV1`, `TravelSegmentV1` et `TravelCheckpointV1` : identité, origine, destination, itinéraire, mode, durée, progression, état, prochaine frontière, versions lues et résultat terminal.

États minimaux recommandés : `PLANNED`, `ACTIVE`, `INTERRUPTED`, `ARRIVED`, `CANCELLED`, `FAILED_WITHOUT_COMMIT`.

### 2. Figer la rencontre déterministe

Définir une graine stable dérivée du processus, du segment, du lieu et des versions. Séparer :

- pression de rencontre calculée;
- décision de déclenchement;
- catégorie structurée (`HOSTILE`, `SOCIAL`, `STRANGE`, `OPPORTUNITY`, `NONE`);
- candidat issu du monde existant;
- future concrétisation créative, explicitement hors I-03D.

Un rejeu du même segment doit produire la même décision et ne jamais créer une seconde rencontre.

### 3. Implémenter le processus pur

- planifier le prochain segment jusqu'à la première échéance, frontière horaire, arrivée ou décision joueur;
- produire les tâches temporelles et le prochain checkpoint sans mutation;
- arrêter le processus lorsqu'une interruption significative survient;
- conserver la progression déjà committée.

### 4. Raccorder au pipeline temporel

- utiliser `planNextTemporalBatchV1`;
- appeler le port monde uniquement pour les heures réellement dues;
- préparer le checkpoint, la position, les événements de voyage et l'horloge dans un même commit;
- reprendre depuis `process.state` sans recalculer un segment committé.

### 5. Prouver les scénarios

- NAR-ACC-007 : temps nul pour méta/clarification, temps exact pour activité vécue;
- NAR-ACC-010 : voyage, pression contextuelle, rencontre stable, observation/évitement possibles;
- NAR-ACC-020 : échéances simultanées, ordre causal, interruption et rejeu sans double effet;
- fermeture/réouverture IndexedDB au milieu d'un voyage;
- panne avant commit sans progression et panne après commit sans rejeu;
- régression `map-module` inchangée.

## Risques connus

- `runWorldHours` force au moins un tick : ne jamais contourner l'adaptateur.
- Le bootstrap applicatif ne fournit pas encore automatiquement le seed `world.state`; les tests I-03 initialisent cet agrégat dans un commit temporel à la seconde zéro.
- Les sorties monde contiennent événements, deltas, signaux, rumeurs et opportunités; I-03D doit les classer sans les narrativiser.
- La jonction avec la position réelle du personnage doit rester un agrégat de campagne, pas une lecture du cache carte.

## Vérifications actuellement vertes

```powershell
npm run narration-module:build
npm run narration-module:test:contracts
npm run narration-module:test:time
npm run narration-module:test:indexeddb
npm run map-module:test:regression
npm run build
```

Derniers résultats : 19 contrats noyau, 7 contrats bootstrap, 5 contrats temporels mémoire/Chromium, 3 groupes de preuves temporelles, suite IndexedDB complète, régression carte et build global réussis.

## Condition de fin d'I-03D

I-03 est clos lorsque le même voyage segmenté peut être interrompu, fermé, rouvert et repris avec les mêmes identités, la même chronologie et la même décision de rencontre, sans seconde horloge ni double effet.
