# Module narration

Le runtime narratif complet n'est pas encore implémenté. I-00 fournit le noyau transactionnel `campaign-core/1`; I-01 ajoute `IndexedDbCampaignRepository`, les migrations par générations et les tests Chromium de `campaign-storage/1`. Le contrat `campaign-bootstrap/1` est figé et autorise désormais l'implémentation d'I-02.

## Vérifications

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:contracts
npm run narration-module:test:indexeddb
```

Le build global exécute également la vérification TypeScript du noyau :

```powershell
npm run build
```

## Références

- [`docs/Contrat-noyau-campagne.md`](docs/Contrat-noyau-campagne.md) : contrat normatif `FIGE`.
- [`docs/Contrat-persistance-indexeddb.md`](docs/Contrat-persistance-indexeddb.md) : contrat physique `FIGE` implémenté par I-01.
- [`docs/Contrat-bootstrap-campagne.md`](docs/Contrat-bootstrap-campagne.md) : contrat `FIGE` du bootstrap I-02, pas encore implémenté.
- [`docs/Audit-final.md`](docs/Audit-final.md) : autorisations progressives et blocages par capacité.
- [`docs/Plan-implementation-narration.md`](docs/Plan-implementation-narration.md) : ordre et gates des lots suivants.

IndexedDB reste derrière `CampaignRepository`. I-00 et I-01 ne branchent React, serveur, fournisseur IA, moteur tactique, carte ou domaine narratif. I-02 doit conserver ces frontières et ne peut lire les caches UI directement.
