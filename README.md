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
npm run narration-module:test:j10h6-certification
npm run narration-module:test:j10h7-openai-live # recette payante, accord explicite requis
npm run map-module:test:regression
npm run verify:world-simulation
```

Les simulations longues sont disponibles avec `npm run verify:world-simulation:long` et `npm run verify:world-simulation:mobility-long`.

## Structure

- `test-GAME-2D/src/` : application React, plateau, regles, donnees et creation de personnage.
- `test-GAME-2D/map-module/` : carte du monde, editeur et simulation systemique.
- `test-GAME-2D/narration-module/` : noyau narratif actif avec persistance
  IndexedDB et cadre sémantique ouvert V8 désormais actif dans l'UI produit,
  conservé fidèlement par le runtime et alimenté par un contexte incarné public
  versionné et borné puis routé par G5 vers des ports propriétaires ordonnés,
  sans texte brut ni commit avant leur prévalidation ; G6 certifie désormais un
  corpus de 24 cas dans le mapper, le contrôleur et Chromium ; G7 raccorde les
  propriétaires installés sans saisie brute et certifie la surface React ; G8
  valide déjà en live le dialogue dépendant du contexte incarné complet et
  laisse ellipse, condition et séquence sous un nouveau budget explicite, scènes
  guidées par le lore, populations
  locales, dialogue borné avec profils conversationnels éphémères par acteur,
  rendu narratif contrôlé et interprétation joueur exclusivement OpenAI côté
  serveur ; une indisponibilité demande une reformulation sans fallback local.
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
  cause. L'exploration locale multi-lieux et le voyage lointain fondé sur les
  routes du monde disposent désormais de preuves J6. Le voyage persiste son
  checkpoint et réunit dans un même commit le temps, la position et les
  provisions préparées par l'inventaire, tout en laissant les rencontres au
  choix narratif du joueur. Le noyau compagnon narratif J7 sait maintenant
  vérifier une cause de recrutement réelle, conserver l'appartenance au groupe,
  respecter les acceptations et refus du PNJ, suivre plusieurs scènes et gérer
  séparation, réunion et départ sans ouvrir le compagnon tactique.
  J7 est fermé : une demande libre au compagnon est interprétée sans mots-clés
  métier, décidée selon sa volonté, formulée naturellement, puis restaurée dans
  le navigateur ; son initiative sociale reste bornée par les règles existantes.
  J8 fixe désormais la frontière future avec le tactique : compagnon autonome
  par défaut, contrôle direct seulement depuis une capacité mécanique réelle,
  et refonte de la carte, du placement et des acteurs différée après la
  certification narrative J9.
  J9-B est fermé par une campagne locale continue issue du bootstrap installé :
  deux PNJ, inventaire personnel et externe, recrutement et refus autonome,
  intrigue créée puis résolue, voyage avec compagnon, reconstruction et rejeux
  stables. J9-C ferme aussi cette verticale dans Chromium et IndexedDB depuis
  une campagne créée par l'interface, avec rechargements et rejeux critiques.
  J9-D ferme enfin la certification OpenAI live ciblée : cinq familles de tours,
  treize appels HTTP 200, rôles ordonnés et budget respecté. J1 à J9 sont donc
  terminés dans leur périmètre narratif.
  J10-A à J10-F raccordent désormais les frontières immersives : voyage et
  compagnons pilotés par la narration, carnet joueur isolé, puis récapitulatif
  public déterministe et inventaire personnel compact en lecture seule. La
  surface masque les diagnostics par défaut et sa gate Chrome réelle ferme le
  parcours continu. J10-G et J10-H sont désormais fermés par leurs recettes
  OpenAI réelles. J10-H0 à H7 fiabilisent la soumission, le
  focus local, la fidélité V8, l'orchestration et les diagnostics, puis
  certifient transversalement tous les propriétaires, Chromium, IndexedDB et
  les migrations, puis certifient approche, continuité pronominale après reload,
  changement d'interlocuteur et transition propriétaire dans Chromium.
  Les causes et catalogues de bastion réellement jouables, l'économie de
  campagne et la mémoire sociale longue restent à construire.
- `test-GAME-2D/scripts/` : generation de catalogues et scripts de verification.
- `test-GAME-2D/docs/` : conception fonctionnelle et technique de l'application.
- `wiki/` : lore et modeles de contenu de l'univers.
- `docs projet/` : documents historiques et idees de conception.

## Collaboration

Avant de modifier le projet, lire [`AGENTS.md`](AGENTS.md), puis [`TASKS.md`](TASKS.md). Les decisions et l'etat de travail doivent rester dans Git; les fichiers generes, journaux temporaires et secrets ne doivent pas etre commits.
