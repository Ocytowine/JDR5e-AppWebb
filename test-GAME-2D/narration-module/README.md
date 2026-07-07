# Module narration

Le runtime narratif complet n'est pas encore branché à l'UI. I-00 fournit le noyau transactionnel `campaign-core/1`; I-01 ajoute la persistance IndexedDB; I-02 fournit le bootstrap contenu/personnage/règles. I-03 livre l'horloge, l'échéancier, les checkpoints de processus, l'adaptateur monde sur copie et le voyage segmenté. I-04 livre mémoire, snapshot et contextes déterministes. I-05 livre le pipeline IA contractuel, les créations dynamiques et l'adaptateur OpenAI serveur. I-06 livre progressivement scène, social, UI, contrôleur de tour, interprétation conservatrice et contrat de résolution narrative bornée.

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
npm run narration-module:test:memory
npm run narration-module:test:context
npm run narration-module:test:ai-pipeline
npm run narration-module:test:dynamic-creation
npm run narration-module:test:openai-provider
npm run narration-module:test:scene-social-ui
npm run narration-module:test:narrative-react-ui
npm run narration-module:test:narrative-app-surface
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:narrative-resolution
npm run narration-module:test:ai-narrative-enhancement
npm run narration-module:test:narrative-openai-route
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
- [`docs/Contrat-memoire-snapshot.md`](docs/Contrat-memoire-snapshot.md) : contrat I-04, mémoire, snapshot, contextes, budget et obsolescence.
- [`docs/Contrat-pipeline-ia-creations.md`](docs/Contrat-pipeline-ia-creations.md) : contrat I-05A, faux fournisseur, rôles IA, sorties, retries, incidents et créations dynamiques.
- [`docs/Contrat-fournisseur-ia-openai.md`](docs/Contrat-fournisseur-ia-openai.md) : contrat I-05B, OpenAI côté serveur, clé et tests simulés.
- [`docs/Contrat-scene-social-ui.md`](docs/Contrat-scene-social-ui.md) : contrat I-06A, scène, social, transcript et affichage typé.
- [`docs/Contrat-interface-narrative-react.md`](docs/Contrat-interface-narrative-react.md) : contrat I-06B, interface React pure et saisie libre.
- [`docs/Contrat-surface-narration-app.md`](docs/Contrat-surface-narration-app.md) : contrat I-06C, surface narration applicative dédiée.
- [`docs/Contrat-controleur-tour-narratif.md`](docs/Contrat-controleur-tour-narratif.md) : contrat I-06D, contrôleur prototype sans commit métier.
- [`docs/Contrat-interpretation-clarification.md`](docs/Contrat-interpretation-clarification.md) : contrat I-06E, interprétation conservatrice et clarification.
- [`docs/Contrat-resolution-narrative.md`](docs/Contrat-resolution-narrative.md) : contrat I-06F, résolution bornée, reformulation PJ, commit validé et handoffs.
- [`docs/Matrice-preuves-I06F.md`](docs/Matrice-preuves-I06F.md) : preuves I-06F, cas de frontière et commandes de vérification.
- [`docs/Contrat-resolution-ia-bornee.md`](docs/Contrat-resolution-ia-bornee.md) : contrat I-06G, enrichissement IA de l'expression et de la narration sans autorité métier.
- [`docs/Matrice-preuves-I06G.md`](docs/Matrice-preuves-I06G.md) : preuves I-06G, sorties IA acceptées/rejetées et fallback.
- [`docs/Matrice-preuves-I06H.md`](docs/Matrice-preuves-I06H.md) : preuves I-06H, branchement UI enrichi et fournisseur OpenAI contrôlé.
- [`docs/Matrice-preuves-I06I.md`](docs/Matrice-preuves-I06I.md) : preuves I-06I, route serveur OpenAI opt-in pour l'enrichissement narratif.
- [`docs/Matrice-preuves-I06J.md`](docs/Matrice-preuves-I06J.md) : preuves I-06J, bascule UI OpenAI opt-in et fallback local.
- [`docs/Audit-final.md`](docs/Audit-final.md) : autorisations progressives et blocages par capacité.
- [`docs/Plan-implementation-narration.md`](docs/Plan-implementation-narration.md) : ordre et gates des lots suivants.

IndexedDB reste derrière `CampaignRepository`. Le fournisseur OpenAI reste côté serveur. Les projections I-06A ne doivent pas être remplacées par un cache UI autoritaire.
