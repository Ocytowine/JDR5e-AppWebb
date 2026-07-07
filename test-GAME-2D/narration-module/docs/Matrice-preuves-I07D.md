# Matrice de preuves I-07D — placeholder tactique contractuel

Date : 2026-07-07

Statut : `LIVRE_DANS_PERIMETRE`

Contrat : [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md), version `tactical-rest-handoff/1`.

## Périmètre livré

I-07D introduit un placeholder tactique propriétaire, isolé du plateau réel.

Ajouts principaux :

- `resolveTacticalPlaceholderV1`;
- scénarios contrôlés :
  - `VICTORY`;
  - `FLEE`;
  - `CAPTURE`;
  - `SURRENDER`;
  - `TECHNICAL_FAILURE`;
- checkpoints simulés déterministes;
- `TacticalOutcomeV1` typé et validé;
- intégration temporelle possible via les helpers I-07B;
- absence de dépendance à `GameBoard.tsx`, `localStorage` ou `/api/narration`.

Le placeholder ne joue pas un combat. Il fournit un domaine propriétaire minimal capable de produire le même type d'outcome qu'un futur adaptateur tactique réel devra produire.

## Preuves exécutables

Commande :

```powershell
npm run narration-module:test:tactical-rest-handoff
```

Résultat observé :

```text
PASS 11 tactical placeholder produces deterministic typed outcomes
PASS 12 tactical placeholder covers controlled terminal scenarios
PASS 13 tactical placeholder outcome integrates through timed handoff without GameBoard
PASS 13/13 tactical-rest-handoff tests.
```

Vérification TypeScript :

```powershell
npm run narration-module:build
```

Résultat : succès.

## Couverture par exigence

| Exigence I-07D | Preuve | Statut |
|---|---|---|
| Production de `TacticalOutcomeV1` depuis un seed | test 11 valide l'outcome typé | Couvert |
| Déterminisme | test 11 rejoue les mêmes entrées et compare la sortie complète | Couvert |
| Scénarios terminaux contrôlés | test 12 couvre victoire, fuite, capture, reddition et échec technique | Couvert |
| Échec technique sans delta métier caché | test 12 vérifie zéro `domainDeltas` en `TECHNICAL_FAILURE` | Couvert |
| Intégration idempotente | test 13 rejoue le même commit temporel et compare le `CommitRecord` | Couvert |
| Pas de dépendance au plateau réel | test 13 s'exécute sans import `GameBoard.tsx` ni route tactique historique | Couvert |

## Limites assumées

I-07D ne livre pas :

- combat réel;
- IA tactique;
- grille, portée, vision, couverture ou pathfinding;
- génération de carte tactique;
- adaptation du module `GameBoard.tsx`;
- équilibrage de dégâts ou règles complètes de combat.

## Décision de clôture

I-07D peut être considéré clos dans son périmètre.

Prochain sous-lot recommandé : I-07E, adapter progressivement le vrai prototype tactique derrière le contrat `TacticalEncounterSeedV1 -> TacticalOutcomeV1`, sans modifier la narration.
