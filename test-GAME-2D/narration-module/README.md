# Module narration

Le runtime narratif complet n'est pas encore implémenté. I-00 fournit le noyau transactionnel `campaign-core/1`; I-01 ajoute la persistance IndexedDB; I-02 fournit le bootstrap contenu/personnage/règles. I-03 livre l'horloge, l'échéancier, les checkpoints de processus, l'adaptateur monde sur copie et le voyage segmenté avec rencontre déterministe, position et événement committés atomiquement.

## Vérifications

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:build
npm run narration-module:test:contracts
npm run narration-module:test:lore
npm run narration-module:test:character
npm run narration-module:test:rules
npm run narration-module:test:orchestration
npm run narration-module:test:time
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
- [`docs/Contrat-temps-processus.md`](docs/Contrat-temps-processus.md) : contrat I-03, horloge unique, échéances et sous-lots d'intégration monde.
- [`docs/Audit-final.md`](docs/Audit-final.md) : autorisations progressives et blocages par capacité.
- [`docs/Plan-implementation-narration.md`](docs/Plan-implementation-narration.md) : ordre et gates des lots suivants.

IndexedDB reste derrière `CampaignRepository`. I-00 et I-01 ne branchent React, serveur, fournisseur IA, moteur tactique, carte ou domaine narratif. I-02 doit conserver ces frontières et ne peut lire les caches UI directement.
