# Suivi du travail

Derniere mise a jour: 2026-06-22

Ce fichier est le tableau de bord court du depot. Les details techniques restent dans les documents lies; une tache ne doit pas etre dupliquee ici avec toute sa specification.

## En cours

- [ ] Consolider la simulation du monde apres l'ajout des objectifs multi-phases, des opportunites de faction et des mobiles non-systeme.
  Reference: `test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md`. Les mobiles exposent maintenant l'objectif, la phase et la cible qu'ils servent.
- [ ] Definir le contrat de sortie actionnable du MJ IA.
  Reference: `test-GAME-2D/docs/Evolution/Avancement.md`.
- [ ] Definir le noyau de memoire narrative a court et long terme.
  Reference: `test-GAME-2D/docs/Evolution/Avancement.md`.
- [ ] Definir le passage narration vers tactique, puis le retour des consequences vers la narration.
  Reference: `test-GAME-2D/docs/Evolution/Avancement.md`.

## Prochaines etapes

- [ ] Generer les premiers mobiles non-systeme contextuels, en commencant par les profils marchands, criminels et religieux.
- [ ] Historiser les causes d'action importantes sans surcharger `recentHistory`.
- [ ] Prioriser les cas narratifs 005 a 009 avant leur implementation.
- [ ] Remplacer les scripts de test factices du module narration lorsqu'un nouveau runtime sera introduit.

## Blocages et risques

- Le snapshot narratif dans `test-GAME-2D/docs/Evolution/Avancement.md` date du 2026-02-23 et doit etre revalide avant de servir de planning detaille.
- Les hooks et la CI du module narration executent actuellement des commandes qui ne lancent aucune suite de tests reelle, car le runtime historique a ete retire.
- `docs projet/Structure app.md` decrit une ancienne cible Nuxt/Vue/Pinia; la reference executable actuelle est `test-GAME-2D/package.json`.

## Termine recemment

- [x] Affectation runtime explicite des mobiles aux phases d'objectif et correction du garde-fou de traces mobiles le 2026-06-22.
- [x] Ajout d'une verification de regression du module carte (`npm run map-module:test:regression`) le 2026-06-22.
- [x] Ajout des sondes longues de simulation et de mobilite le 2026-06-17.
- [x] Ajout des diagnostics de mobiles, causes d'action, objectifs multi-phases et opportunites de faction le 2026-06-17.
- [x] Mise en place de `AGENTS.md`, `TASKS.md` et refonte du guide racine le 2026-06-22.

## Regle de mise a jour

Au debut d'une session, choisir une tache de `En cours` ou ajouter la demande du moment. A la fin, mettre a jour son statut, la date, les blocages et la prochaine action verifiable. Git reste la source de verite pour le detail exact des modifications.
