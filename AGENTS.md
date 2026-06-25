# Instructions de collaboration

Ce fichier s'applique a l'ensemble du depot. Un fichier `AGENTS.md` place dans un sous-dossier peut ajouter ou preciser des regles pour ce sous-dossier.

## Demarrage d'une session

1. Lire `README.md` et `TASKS.md`.
2. Executer `git status --short --branch` avant toute modification.
3. Identifier la documentation du module concerne avant de changer son contrat ou son architecture.
4. Ne pas supposer que les documents historiques de `docs projet/` decrivent encore la pile actuelle; verifier dans le code et `package.json`.

## Regles de travail

- Respecter l'architecture et les conventions existantes; limiter chaque changement au besoin traite.
- Ne jamais annuler une modification locale existante sans demande explicite.
- Ne pas modifier manuellement les fichiers generes lorsqu'un script de generation existe.
- Ne jamais versionner `.env`, des secrets, `node_modules/`, `dist/` ou des journaux temporaires.
- Ajouter ou adapter les verifications en fonction du risque du changement.
- Mettre a jour la documentation proche du code lorsqu'un comportement, une commande ou un contrat change.
- Tenir `TASKS.md` a jour: deplacer les elements termines, noter les blocages et indiquer la prochaine etape concrete.
- Conserver `TASKS.md` synthetique; les analyses et plans longs appartiennent dans les dossiers `docs/` concernes.
- Utiliser Git pour conserver l'historique, mais ne creer un commit que sur demande explicite.

## Architecture

- `test-GAME-2D/src/`: application principale React/TypeScript et plateau tactique.
- `test-GAME-2D/map-module/`: carte, editeur et moteur de simulation du monde.
- `test-GAME-2D/narration-module/`: integration narration/lore; le runtime historique a ete retire et les scripts de test actuels sont des marqueurs sans suite active.
- `test-GAME-2D/scripts/`: generateurs et verifications executables.
- `wiki/`: source de lore.
- `test-GAME-2D/docs/` et `test-GAME-2D/map-module/docs/`: specifications et feuilles de route actives.
- `docs projet/`: conception ancienne ou exploratoire, a confronter au code actuel.

## Commandes utiles

Executer les commandes npm depuis `test-GAME-2D/`.

| Commande | Usage |
|---|---|
| `npm ci` | Installer exactement les dependances verrouillees |
| `npm run dev` | Generer les catalogues et demarrer le serveur |
| `npm run dev:ui` | Demarrer uniquement Vite |
| `npm run build` | Generer, verifier TypeScript et construire l'application |
| `npm run validate:content` | Valider le contenu JSON |
| `npm run normalize:content` | Normaliser le contenu; verifier le diff ensuite |
| `npm run map-module:test:regression` | Executer la regression du module carte |
| `npm run verify:world-simulation` | Verifier un cycle de simulation |
| `npm run verify:world-simulation:long` | Executer la simulation longue |
| `npm run verify:world-simulation:mobility-long` | Verifier les mobilites sur la duree |
| `npm run setup:hooks` | Installer les hooks Git du depot |

## Definition de termine

- Le comportement demande est implemente sans changement hors perimetre.
- Les commandes de verification pertinentes passent, ou leur impossibilite est documentee.
- `README.md`, la documentation du module et `TASKS.md` sont ajustes si necessaire.
- `git diff` a ete relu et `git status` ne contient aucun fichier accidentel.
