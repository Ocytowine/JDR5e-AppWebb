# Matrice de preuves I-07B — horloge des handoffs tactique/repos

Date : 2026-07-07

Statut : `LIVRE_DANS_PERIMETRE`

Contrats :

- [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md), version `tactical-rest-handoff/1`;
- [`Contrat-temps-processus.md`](Contrat-temps-processus.md), version `temporal-kernel/1`.

## Périmètre livré

I-07B raccorde l'intégration d'outcomes tactique/repos au kernel temporel I-03.

Ajouts principaux :

- `createHandoffOutcomeTemporalBatchV1` construit un batch `PROCESS_BOUNDARY` stable à partir d'un outcome;
- `prepareTimedHandoffOutcomeIntegrationV1` prépare un commit `time.segment`;
- le commit écrit atomiquement :
  - `world.clock`;
  - `world.schedule`;
  - `world.simulation-cursor` si nécessaire à l'initialisation temporelle;
  - l'agrégat `process.handoff` passé à `INTEGRATED`;
  - les deltas métier portés par l'outcome;
  - l'événement principal de résolution tactique ou de fin/interruption de repos.

L'intégration temporelle utilise `prepareTemporalSegmentCommitV1`; elle ne contourne donc pas l'autorité de `world.clock`.

## Preuves exécutables

Commande :

```powershell
npm run narration-module:test:tactical-rest-handoff
```

Résultat observé :

```text
PASS 01 tactical handoff produces a typed seed without resolving combat
PASS 02 tactical outcome integration is idempotent and does not double consequences
PASS 03 failed integration leaves process completed pending integration
PASS 04 rest starts only from an explicit valid seed and rest_started is committed
PASS 05 interrupted rest emits committed interruption event and grants no long-rest benefit
PASS 06 timed tactical integration advances world clock exactly once
PASS 07 timed interrupted rest advances clock and still grants no unavailable benefit
PASS 7/7 tactical-rest-handoff tests.
```

Vérification TypeScript :

```powershell
npm run narration-module:build
```

Résultat : succès.

## Couverture par exigence

| Exigence I-07B | Preuve | Statut |
|---|---|---|
| L'intégration temporelle passe par le kernel I-03 | `prepareTimedHandoffOutcomeIntegrationV1` appelle `prepareTemporalSegmentCommitV1` | Couvert |
| Outcome tactique avance `world.clock` | test 06 vérifie `elapsedGameSeconds` sur l'agrégat horloge | Couvert |
| Retry tactique ne double ni horloge, ni dégâts, ni événement | test 06 rejoue le même commit et compare le `CommitRecord` | Couvert |
| Repos interrompu avance l'horloge réelle | test 07 vérifie `world.clock` à la durée d'outcome | Couvert |
| Repos interrompu n'accorde pas un bénéfice de repos long | test 07 vérifie `grantedLongRestBenefit: false` | Couvert |
| Signal UI de repos issu d'un événement committé | test 07 vérifie un unique événement `rest_interrupted` | Couvert |
| Pas de couplage au plateau ou à la route IA historique | module limité à `src/handoff`, `src/time` et `src/core` | Couvert |

## Limites assumées

I-07B reste un raccord contractuel et transactionnel.

Il ne livre pas encore :

- segmentation jouable complète du repos;
- checkpoints intermédiaires de repos segment par segment;
- simulation mondiale aux frontières horaires pendant un repos long;
- branchement réel vers `GameBoard.tsx`;
- génération de carte tactique;
- application exhaustive des règles de classe, sorts, fatigue ou progression.

## Décision de clôture

I-07B peut être considéré clos dans son périmètre.

Prochain sous-lot recommandé : I-07C, créer les états/checkpoints propriétaires de repos segmenté et les interruptions déterministes, avant le branchement UI/moteur jouable.
