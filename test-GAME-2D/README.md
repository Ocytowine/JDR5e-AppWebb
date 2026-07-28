# Application JDR5e

Ce dossier contient l'application active React/TypeScript, le serveur local, le
module narration, le plateau tactique et le module de simulation du monde.

## Point de reprise

- [`TASKS.md`](../TASKS.md) : travail immédiat du dépôt.
- [`narration-module/README.md`](narration-module/README.md) : rôle et état du
  module narration.
- [`État et feuille de route narration`](narration-module/docs/Consolidation-fondations-narration.md)
  : source canonique du chantier narration.
- [`Index documentaire narration`](narration-module/docs/README.md) : contrats,
  scénarios, preuves et archives.
- [`world-simulation-corrective-roadmap.md`](map-module/docs/world-simulation-corrective-roadmap.md)
  : chantier actif de simulation du monde.

Les documents de `../docs projet/` sont historiques. Ils doivent être confrontés
au code actuel et à `package.json` avant d'être utilisés.

## Commandes principales

Depuis ce dossier :

```powershell
npm ci
npm run dev
npm run build
npm run validate:content
npm run narration-module:test:contracts
npm run narration-module:test:orchestration
npm run map-module:test:regression
npm run verify:world-simulation
```

`npm run dev` génère les catalogues, reconstruit l'application puis démarre le
serveur qui expose le bundle de `dist`. `npm run dev:ui` lance uniquement Vite.

## Structure

- `src/` : application React, interface, règles et plateau.
- `narration-module/` : contrats, runtime, serveur IA et tests narration.
- `map-module/` : carte, éditeur et simulation du monde.
- `scripts/` : génération et vérifications exécutables.
- `docs/` : documentation transversale et technique.

Ne jamais versionner `.env`, `node_modules/`, `dist`, des secrets ou des journaux
temporaires.
