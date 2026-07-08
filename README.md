# JDR5e-AppWebb

Jeu de role solo sur navigateur. Le projet combine un univers documente dans un wiki, une simulation du monde et un plateau tactique 2D.

## Etat du projet

Le developpement actif se trouve dans `test-GAME-2D/`. La pile actuelle est React 18, TypeScript, Vite 6, PixiJS 8 et un serveur Node.js local.

Le suivi synthetique du travail est dans [`TASKS.md`](TASKS.md). Les plans techniques detailles restent dans `test-GAME-2D/docs/` et `test-GAME-2D/map-module/docs/`.

## Prerequis

- Node.js 20 (version utilisee par la CI)
- npm
- Git

## Installation

```powershell
cd test-GAME-2D
npm ci
npm run setup:hooks
```

La configuration locale facultative se place dans `test-GAME-2D/.env`. Ce fichier est ignore par Git et ne doit pas contenir de secret versionne.

## Utilisation

Depuis `test-GAME-2D/` :

```powershell
npm run dev
```

Cette commande regenere les catalogues puis demarre le serveur applicatif. Pour lancer uniquement l'interface Vite :

```powershell
npm run dev:ui
```

## Verification

```powershell
npm run build
npm run validate:content
npm run narration-module:test:contracts
npm run narration-module:test:lore
npm run narration-module:test:character
npm run narration-module:test:rules
npm run narration-module:test:orchestration
npm run narration-module:test:time
npm run narration-module:test:vertical-quality
npm run narration-module:test:playable-scene
npm run narration-module:test:lore-playable-scene
npm run narration-module:test:scene-ephemeral-creation
npm run narration-module:test:plot-preparation
npm run narration-module:test:indexeddb
npm run map-module:test:regression
npm run verify:world-simulation
```

Les simulations longues sont disponibles avec `npm run verify:world-simulation:long` et `npm run verify:world-simulation:mobility-long`.

## Structure

- `test-GAME-2D/src/` : application React, plateau, regles, donnees et creation de personnage.
- `test-GAME-2D/map-module/` : carte du monde, editeur et simulation systemique.
- `test-GAME-2D/narration-module/` : noyau narratif progressif I-00 a I-06Y et socle différé I-07A a I-07D, avec persistance IndexedDB, contexte, pipeline IA contractuel, surface narration prototype, OpenAI opt-in cote serveur, projections de rendu durables, reconstruction du fil visible, scène narrative de référence, paquet IA de scène, état de scène minimal, mémoire courte PNJ, scénario vertical qualité, corrections qualité ciblées, contrat de scène jouable minimal, intégration wiki minimale de lieux, créations éphémères contrôlées de scène, gate de préparation intrigue, badges UX narration, interprétation IA structurée de l'intention joueur, encarts UX no-commit/clarification, handoffs tactique/repos typés, avance temporelle atomique, repos segmenté déterministe et placeholder tactique contractuel. Le MJ complet de campagne, les handoffs jouables et le lecteur UX d'historique complet restent en cours de construction.
- `test-GAME-2D/scripts/` : generation de catalogues et scripts de verification.
- `test-GAME-2D/docs/` : conception fonctionnelle et technique de l'application.
- `wiki/` : lore et modeles de contenu de l'univers.
- `docs projet/` : documents historiques et idees de conception.

## Collaboration

Avant de modifier le projet, lire [`AGENTS.md`](AGENTS.md), puis [`TASKS.md`](TASKS.md). Les decisions et l'etat de travail doivent rester dans Git; les fichiers generes, journaux temporaires et secrets ne doivent pas etre commits.
