# JDR5e-AppWebb

Jeu de role solo sur navigateur. Le projet combine un univers documente dans un wiki, une simulation du monde et un plateau tactique 2D.

## Etat du projet

Le developpement actif se trouve dans `test-GAME-2D/`. La pile actuelle est React 18, TypeScript, Vite 6, PixiJS 8 et un serveur Node.js local.

Le suivi synthetique du travail est dans [`TASKS.md`](TASKS.md). Pour la
narration, l'état courant, les principes et la feuille de route sont réunis dans
[`Consolidation-fondations-narration.md`](test-GAME-2D/narration-module/docs/Consolidation-fondations-narration.md).
L'[index documentaire du module](test-GAME-2D/narration-module/docs/README.md)
sépare les contrats actifs des preuves et archives historiques.

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

`npm run dev` reconstruit l'application avant de lancer le serveur, car `server.js` sert le contenu de `dist`. Après une modification du code client, un simple redémarrage sans build laisserait sinon l'ancien bundle actif.

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
npm run narration-module:test:living-world-gate
npm run narration-module:test:indexeddb
npm run map-module:test:regression
npm run verify:world-simulation
```

Les simulations longues sont disponibles avec `npm run verify:world-simulation:long` et `npm run verify:world-simulation:mobility-long`.

## Structure

- `test-GAME-2D/src/` : application React, plateau, regles, donnees et creation de personnage.
- `test-GAME-2D/map-module/` : carte du monde, editeur et simulation systemique.
- `test-GAME-2D/narration-module/` : noyau narratif actif avec persistance
  IndexedDB, intention sémantique V5, scènes guidées par le lore, populations
  locales, dialogue borné avec profils conversationnels éphémères par acteur,
  rendu narratif contrôlé et OpenAI opt-in côté serveur.
  Le premier état social durable et le premier vertical d'intrigue privée
  évoluant hors écran sont actifs. Les signaux perceptibles committés par la
  simulation mondiale peuvent rejoindre le même flux causal sans exposer ses
  décisions privées. La progression personnage peut désormais être ouverte,
  validée, appliquée atomiquement puis restaurée dans le fil narratif sans
  duplication. Une acquisition committée peut également établir le premier
  registre de bastion. Un travail issu d'un catalogue injecté peut désormais
  être planifié, achevé par l'horloge puis projeté sans coût ou aménagement
  implicite. Un PNJ persistant peut également accepter une affectation
  cataloguée et initier une première activité locale sans saisie joueur, tout
  en conservant son état privé dans l'autorité sociale. Un événement committé
  peut désormais ouvrir une occasion, appliquer une conséquence locale ou
  démarrer une défense par handoff tactique sans en inventer l'issue. Le
  build principal sait restaurer cette défense, valider ses projections puis
  initialiser `GameBoard` depuis sa graine persistée sans configuration libre.
  Un checkpoint de frontière de tour permet désormais de restaurer la rencontre
  sans régénérer sa carte ni son initiative. Le résultat terminal peut être
  persisté avant toute conséquence, puis validé par ses propriétaires et
  intégré atomiquement avec le temps avant une reprise narrative restaurable.
  Un constructeur catalogué peut désormais alimenter ce vertical depuis les
  agrégats personnage d'une campagne sans recopier le payload privé de la
  cause.
  Les causes et catalogues de bastion réellement jouables, l'économie de
  campagne et la mémoire sociale longue restent à construire.
- `test-GAME-2D/scripts/` : generation de catalogues et scripts de verification.
- `test-GAME-2D/docs/` : conception fonctionnelle et technique de l'application.
- `wiki/` : lore et modeles de contenu de l'univers.
- `docs projet/` : documents historiques et idees de conception.

## Collaboration

Avant de modifier le projet, lire [`AGENTS.md`](AGENTS.md), puis [`TASKS.md`](TASKS.md). Les decisions et l'etat de travail doivent rester dans Git; les fichiers generes, journaux temporaires et secrets ne doivent pas etre commits.
