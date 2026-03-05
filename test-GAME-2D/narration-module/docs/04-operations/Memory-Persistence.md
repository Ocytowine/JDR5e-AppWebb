# Memory Persistence and Projection (Phase 7)

## Objectif

Mettre en place une memoire persistante de partie et une projection de verite:

- stockage persistant des campagnes
- separation wiki / memoire de partie
- projection priorisee `local > partie > wiki`

## Fichiers

- `src/adapters/db/memory_store.ts`
- `src/application/use_cases/memory_service.ts`
- `src/domain/memory/memory_types.ts`
- `src/domain/memory/memory_projection.ts`

## Donnees persistantes v1

- `wiki.world_state`
- `campaigns[campaign_id].events`
- `campaigns[campaign_id].relations`
- `campaigns[campaign_id].knowledge.player_view`
- `campaigns[campaign_id].knowledge.truth_view`
- `campaigns[campaign_id].world_overrides`

## Tests

```powershell
npm run narration-module:test:integration --prefix .\test-GAME-2D
```

Les tests memoire inclus:

- `test_memory_persistence.ts`
- `test_memory_projection_priority.ts`

