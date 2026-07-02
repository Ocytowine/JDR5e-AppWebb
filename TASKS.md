# Suivi du travail

Derniere mise a jour: 2026-07-02

Ce fichier est le tableau de bord court du depot. Les details techniques restent dans les documents lies; une tache ne doit pas etre dupliquee ici avec toute sa specification.

## En cours

- [ ] Auditer les prerequis AF-R03 d'I-01 avant toute implementation IndexedDB.
  References: `test-GAME-2D/narration-module/docs/Audit-final.md` et `test-GAME-2D/narration-module/docs/Plan-implementation-narration.md`. Il reste a figer les stores, index, frontieres transactionnelles, migrations, quotas et tests navigateur; I-01 reste ferme.
- [ ] Consolider la simulation du monde apres l'ajout des objectifs multi-phases, des opportunites de faction et des mobiles non-systeme.
  Reference: `test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md`. Les mobiles exposent maintenant l'objectif, la phase et la cible qu'ils servent.

## Prochaines etapes

- [ ] Produire le contrat physique IndexedDB et la strategie de migration d'I-01, puis decider explicitement de son ouverture.
- [ ] Generer les premiers mobiles non-systeme contextuels, en commencant par les profils marchands, criminels et religieux.
- [ ] Historiser les causes d'action importantes sans surcharger `recentHistory`.
- [ ] Prioriser les cas narratifs 005 a 009 avant leur implementation.
- [ ] Remplacer les scripts de test factices du module narration lorsqu'un nouveau runtime sera introduit.

## Blocages et risques

- Le snapshot narratif dans `test-GAME-2D/docs/Evolution/Avancement.md` date du 2026-02-23 et doit etre revalide avant de servir de planning detaille.
- Les suites unitaires, d'integration et de demonstration narration restent informatives tant que leurs lots ne sont pas ouverts; build et contrats I-00 sont reels.
- `docs projet/Structure app.md` decrit une ancienne cible Nuxt/Vue/Pinia; la reference executable actuelle est `test-GAME-2D/package.json`.

## Termine recemment

- [x] Verification finale d'I-00: 31 controles de parite compiles, 19/19 contrats et build global reussis le 2026-07-02.
- [x] Implementation I-00 de `campaign-core/1`, repository memoire et 19 tests contractuels le 2026-07-02.
- [x] Audit final, contrat `campaign-core/1` fige et autorisation limitee au lot I-00 le 2026-07-02.
- [x] Construction du corpus d'acceptation et de sa matrice de tracabilite P0 le 2026-07-02.
- [x] Formalisation des exigences non fonctionnelles de latence, contexte, qualite, capacite et migration le 2026-07-02.
- [x] Formalisation de la resilience, de la securite, du diagnostic et des politiques de reprise le 2026-07-02.
- [x] Formalisation du modele persistant, de la memoire et du contrat conceptuel du snapshot narratif le 2026-06-30.
- [x] Formalisation du pipeline IA, des arbitrages ouverts et de la securite des sorties le 2026-06-30.
- [x] Formalisation des integrations personnage, inventaire, monde, social, tactique, repos et sauvegarde le 2026-07-02.
- [x] Formalisation de l'horloge causale, du monde hors ecran et des retours tardifs le 2026-07-02.
- [x] Decouplage de l'application et du serveur du runtime narration supprime le 2026-06-29; le build et le demarrage ne dependent plus de `narration-module/`.
- [x] Affectation runtime explicite des mobiles aux phases d'objectif et correction du garde-fou de traces mobiles le 2026-06-22.
- [x] Ajout d'une verification de regression du module carte (`npm run map-module:test:regression`) le 2026-06-22.
- [x] Ajout des sondes longues de simulation et de mobilite le 2026-06-17.
- [x] Ajout des diagnostics de mobiles, causes d'action, objectifs multi-phases et opportunites de faction le 2026-06-17.
- [x] Mise en place de `AGENTS.md`, `TASKS.md` et refonte du guide racine le 2026-06-22.

## Regle de mise a jour

Au debut d'une session, choisir une tache de `En cours` ou ajouter la demande du moment. A la fin, mettre a jour son statut, la date, les blocages et la prochaine action verifiable. Git reste la source de verite pour le detail exact des modifications.
