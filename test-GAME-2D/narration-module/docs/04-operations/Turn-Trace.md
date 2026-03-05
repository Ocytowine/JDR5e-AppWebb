# Turn Trace (Phase 2)

## Objectif

Tracer chaque tour en JSONL avec les champs minimaux:

- `turn_id`
- `input_contract`
- `plan`
- `runtime_actions`
- `state_before`
- `state_after`
- `state_diff`
- `output_contract`

## Demo

```powershell
npm run narration-module:demo:trace --prefix .\test-GAME-2D
```

Sortie:

- fichier `logs/turn-trace.jsonl`

## Test d'integration

```powershell
npm run narration-module:test:integration --prefix .\test-GAME-2D
```

Le test verifie:

- presence des champs de trace obligatoires
- creation d'un log line par tour
- coherence minimale du pipeline de tour
- scenarios canon v1:
  - entrer dans un lieu accessible
  - observer un lieu
  - tentative interdite
  - intention floue (clarification)

## Enforcement Phase 3

Regles appliquees dans l'orchestrateur:

- blocage des actions irreversibles si clarification requise (`clarification_irreversible_blocked`)
- controle de coherence `plan -> runtime_actions` (`plan_mismatch`)
- obligation des metadonnees trigger pour `createEvent` (`event_trigger_missing`, `event_created_turn_missing`, `event_created_turn_mismatch`)
