# Matrice de preuves I-07C — repos segmenté propriétaire

Date : 2026-07-07

Statut : `LIVRE_DANS_PERIMETRE`

Contrats :

- [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md), version `tactical-rest-handoff/1`;
- [`Contrat-temps-processus.md`](Contrat-temps-processus.md), version `temporal-kernel/1`.

## Périmètre livré

I-07C introduit un état propriétaire de repos segmenté, séparé du handoff narratif.

Ajouts principaux :

- `RestProcessStateV1` persistable en agrégat `rest.process`;
- création d'un état de repos depuis `RestSeedV1`;
- progression d'un repos par segment déterministe;
- checkpoint/fingerprint recalculé à chaque segment;
- consommation initiale de fournitures;
- bénéfices accordés uniquement quand la durée cible est atteinte;
- interruption déterministe à graine stable;
- commit temporel atomique via `prepareTemporalSegmentCommitV1`.

Le handoff reste la frontière narration/domaine. Le repos segmenté devient un état propriétaire que le futur moteur de repos pourra reprendre.

## Preuves exécutables

Commande :

```powershell
npm run narration-module:test:tactical-rest-handoff
```

Résultat observé :

```text
PASS 08 segmented rest commits checkpoint and clock for one segment
PASS 09 segmented rest completes only when target duration is reached
PASS 10 segmented rest interruption is deterministic and grants no long rest benefit
PASS 10/10 tactical-rest-handoff tests.
```

Vérification TypeScript :

```powershell
npm run narration-module:build
```

Résultat : succès.

## Couverture par exigence

| Exigence I-07C | Preuve | Statut |
|---|---|---|
| État propriétaire de repos | `RestProcessStateV1` et agrégat `rest.process` | Couvert |
| Segment committé avec horloge | test 08 vérifie `world.clock` à 3 600 s et `rest.process` à 3 600 s | Couvert |
| Retry sans double segment | helper de test rejoue le même `CommitRequest` et compare le `CommitRecord` | Couvert |
| Bénéfice non accordé avant durée cible | test 08 vérifie zéro bénéfice après un segment incomplet | Couvert |
| Bénéfice accordé à la fin | test 09 vérifie `rest_completed` et un bénéfice acquis à 7 200 s | Couvert |
| Interruption déterministe | test 10 prépare deux fois le même segment avec même graine et obtient la même sortie | Couvert |
| Interruption sans bénéfice long | test 10 vérifie `INTERRUPTED`, zéro bénéfice acquis et bénéfice restant | Couvert |
| Signaux UI dérivés d'événements committés | événements `rest_segment_completed`, `rest_completed`, `rest_interrupted` | Couvert |

## Limites assumées

I-07C ne livre pas encore :

- UI de repos jouable;
- questions interactives pendant le repos;
- application exhaustive des règles de classe, sorts, dés de vie, fatigue ou activités;
- simulation mondiale aux frontières horaires longues;
- intégration inventaire/personnage réelle au-delà des payloads contractuels;
- placeholder tactique.

## Décision de clôture

I-07C peut être considéré clos dans son périmètre.

Prochain sous-lot recommandé : I-07D, placeholder tactique contractuel derrière `TacticalEncounterSeedV1`/`TacticalOutcomeV1`, sans dépendre de `GameBoard.tsx`.
