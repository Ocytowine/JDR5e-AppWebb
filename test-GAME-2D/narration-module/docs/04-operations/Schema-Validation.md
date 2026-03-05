# Schema Validation (Phase 9)

## Objectif

Valider strictement les contrats `input` et `output` via JSON Schema (Ajv) au runtime.

## Implementation

- `src/application/use_cases/schema_validation.ts`
- schemas:
  - `schemas/input/input-contract.v1.schema.json`
  - `schemas/output/output-contract.v1.schema.json`

## Erreurs

- `schema_validation_failed_input`
- `schema_validation_failed_output`

## Point de controle

La validation schema est executee dans `TurnProcessor` avant les regles metier custom.

## Test de preuve

- `tests/integration/test_schema_validation_enforced.ts`

