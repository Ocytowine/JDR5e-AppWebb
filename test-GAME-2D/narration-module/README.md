# Module narration

Le runtime narratif complet n'est pas encore implémenté. I-00 fournit le noyau transactionnel `campaign-core/1`; I-01 ajoute `IndexedDbCampaignRepository`, les migrations par générations et les tests Chromium de `campaign-storage/1`. I-02 fournit les treize types de `lore-authoring/1`, la compilation du corpus réel, le bootstrap atomique, l'import legacy du personnage, le `RuleRegistry` MVP et le service d'orchestration `campaign.bootstrap`.

## Vérifications

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:contracts
npm run narration-module:test:lore
npm run narration-module:test:character
npm run narration-module:test:rules
npm run narration-module:test:orchestration
npm run narration-module:test:indexeddb
```

Le build global exécute également la vérification TypeScript du noyau :

```powershell
npm run build
```

## Références

- [`docs/Contrat-noyau-campagne.md`](docs/Contrat-noyau-campagne.md) : contrat normatif `FIGE`.
- [`docs/Contrat-persistance-indexeddb.md`](docs/Contrat-persistance-indexeddb.md) : contrat physique `FIGE` implémenté par I-01.
- [`docs/Contrat-bootstrap-campagne.md`](docs/Contrat-bootstrap-campagne.md) : contrat `FIGE` du bootstrap I-02 et état de son implémentation.
- [`docs/Contrat-contenu-lore.md`](docs/Contrat-contenu-lore.md) : contrat `FIGE` des sources, relations, connaissances et fragments lore.
- [`docs/Audit-final.md`](docs/Audit-final.md) : autorisations progressives et blocages par capacité.
- [`docs/Plan-implementation-narration.md`](docs/Plan-implementation-narration.md) : ordre et gates des lots suivants.

IndexedDB reste derrière `CampaignRepository`. I-00 et I-01 ne branchent React, serveur, fournisseur IA, moteur tactique, carte ou domaine narratif. I-02 doit conserver ces frontières et ne peut lire les caches UI directement.
