# Matrice de preuves I-07A — handoffs tactique/repos

Date : 2026-07-07

Statut : `LIVRE_DANS_PERIMETRE`

Contrat : [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md), version `tactical-rest-handoff/1`.

## Périmètre livré

I-07A livre le socle contractuel isolé des handoffs tactique/repos :

- types persistables `ProcessHandoffV1`, `ProcessCheckpointV1`, `TacticalEncounterSeedV1`, `TacticalOutcomeV1`, `RestSeedV1`, `RestOutcomeV1`;
- validateurs manuels pour seeds, processus et outcomes;
- préparation de commits de démarrage de repos avec événement `rest_started`;
- préparation de commits d'intégration d'outcome;
- intégration idempotente via `CampaignRepository.commit`;
- fixtures déterministes tactique/repos;
- preuves de rollback si l'intégration échoue après la fin du processus propriétaire.

Le code est placé dans `narration-module/src/handoff/`. Il ne dépend pas de `GameBoard.tsx`, de `localStorage` ou de `POST /api/narration`.

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
PASS 5/5 tactical-rest-handoff tests.
```

Vérification TypeScript :

```powershell
npm run narration-module:build
```

Résultat : succès.

## Couverture par exigence

| Exigence I-07A | Preuve | Statut |
|---|---|---|
| Seed tactique typé sans résolution de combat | test 01 valide `TacticalEncounterSeedV1` et vérifie l'absence de sortie de résolution | Couvert |
| Outcome tactique intégré une seule fois | test 02 rejoue le même commit et obtient le même `CommitRecord` | Couvert |
| Pas de double dégâts/ressources au retry | test 02 vérifie un seul événement de résolution et une seule écriture d'agrégat personnage | Couvert |
| Panne après fin de processus avant intégration | test 03 injecte une panne `AFTER_EVENTS`; le processus reste `COMPLETED_PENDING_INTEGRATION` | Couvert |
| Repos seulement sur intention explicite | test 04 rejette un `RestSeedV1` sans `restKind` explicite | Couvert |
| Popup/repos dérivable d'événements committés | tests 04 et 05 vérifient `rest_started` et `rest_interrupted` dans le journal d'événements | Couvert |
| Bénéfice de repos non atteint non accordé | test 05 vérifie `grantedLongRestBenefit: false` pour repos interrompu | Couvert |
| Aucun couplage tactique/UI historique | imports du test et du module limités au noyau campagne et à `src/handoff` | Couvert |

## Limite assumée

I-07A conserve les durées exactes dans les outcomes (`elapsedGameSeconds`) mais n'écrit pas encore l'agrégat `world.clock`.

Raison : l'avance de temps tactique/repos doit être traitée dans un sous-lot dédié avec le kernel temporel I-03, les segments de repos et les conséquences monde. I-07A prouve l'idempotence de l'intégration et la non-duplication des conséquences, pas encore l'orchestration temporelle complète.

## Décision de clôture

I-07A peut être considéré clos dans son périmètre.

Prochain sous-lot recommandé : ouvrir I-07B sur l'avance temporelle et la segmentation de repos/tactique, avant tout branchement réel vers `GameBoard.tsx` ou vers un moteur de repos jouable.
