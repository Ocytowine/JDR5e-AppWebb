# Module narration

Le runtime narratif complet n'est pas encore implémenté. Le lot I-00 fournit uniquement le noyau transactionnel figé `campaign-core/1` : contrats, validation, repository mémoire et tests communs.

## Vérifications

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:contracts
```

Le build global exécute également la vérification TypeScript du noyau :

```powershell
npm run build
```

## Références

- [`docs/Contrat-noyau-campagne.md`](docs/Contrat-noyau-campagne.md) : contrat normatif `FIGE`.
- [`docs/Audit-final.md`](docs/Audit-final.md) : autorisation limitée à I-00.
- [`docs/Plan-implementation-narration.md`](docs/Plan-implementation-narration.md) : ordre et gates des lots suivants.

I-00 ne doit importer ni React, ni IndexedDB, ni serveur, ni fournisseur IA, ni moteur tactique ou carte.
