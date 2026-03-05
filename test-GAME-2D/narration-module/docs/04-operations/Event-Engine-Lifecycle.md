# Event Engine Lifecycle (Phase 8)

## Objectif

GerER le cycle de vie des evenements et fragments avec regles explicites.

## Etats de cycle de vie

- `actif`
- `pertinent`
- `dormant`
- `archive`

## Transitions autorisees

- `actif -> pertinent|dormant|archive`
- `pertinent -> actif|dormant|archive`
- `dormant -> pertinent|archive`
- `archive -> dormant`

## Fragments

Types supportes:

- `ponctuel`
- `persistant`
- `evolutif`

Regles v1:

- un fragment doit referencer au moins une cle de `event.final` via `final_refs`
- un fragment `evolutif` peut etre patche
- les transitions de statut de fragment suivent la meme matrice que les evenements

## Fichiers

- `src/domain/events/event_types.ts`
- `src/domain/events/event_engine.ts`
- `src/application/use_cases/memory_service.ts`

## Tests

Inclus dans la suite integration:

- `test_event_lifecycle_cycle.ts`
- `test_event_fragments_lifecycle.ts`

