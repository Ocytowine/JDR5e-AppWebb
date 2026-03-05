# Runtime Command Registry (Phase 6)

## Objectif

Remplacer le runtime stub permissif par un registre de commandes:

- preconditions explicites
- effets deterministes
- codes d'erreur standardises

## Fichiers

- `src/adapters/runtime/command_registry.ts`
- `src/adapters/runtime/runtime_types.ts`
- `src/adapters/runtime/runtime_stub.ts` (orchestration d'execution)

## Codes d'erreur runtime

- `invalid_action`
- `unknown_command`
- `invalid_params`

## Commandes actuellement implementees

- `moveLocal`
- `enterLocation`
- `advanceTime`
- `requestCheck`
- `startDialogue`
- `startCombat`
- `addJournalEntry`
- `queryLore`
- `createNpcProfile`
- `setFlag`
- `rejectAction`
- `createEvent`
- `addEventFragment`
- `transitionEventLifecycle`
- `transitionFragmentLifecycle`
- `patchEvolutiveFragment`

## Tests

```powershell
npm run narration-module:test:unit --prefix .\test-GAME-2D
```

## Regle de contribution

Toute nouvelle commande runtime doit fournir:

- un handler dans `command_registry.ts`
- validation de params explicite
- un test unitaire dans `tests/unit`
