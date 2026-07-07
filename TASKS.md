# Suivi du travail

Derniere mise a jour: 2026-07-06

Ce fichier est le tableau de bord court du depot. Les details techniques restent dans les documents lies; une tache ne doit pas etre dupliquee ici avec toute sa specification.

## En cours

- [ ] Auditer I-04: AF-R08 memoire et AF-R09 snapshot/contextes avant toute implementation.
  References: `test-GAME-2D/narration-module/docs/Matrice-preuves-I03.md`, `test-GAME-2D/narration-module/docs/Memoire-et-rappel.md`, `test-GAME-2D/narration-module/docs/Snapshot-et-contextes.md`. Objectif: figer les unites de memoire, budgets de contexte, secrets, provenance, reconstruction d'index et gate de tests.
- [ ] Consolider la simulation du monde apres l'ajout des objectifs multi-phases, des opportunites de faction et des mobiles non-systeme.
  Reference: `test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md`. Les mobiles exposent maintenant l'objectif, la phase et la cible qu'ils servent.

## Prochaines etapes

- [ ] Migrer `wiki/lore/gouvernances/primauté` vers un futur type de gouvernance et retirer alors son exclusion explicite.
- [ ] Produire le contrat I-04 memoire/snapshot avec schemas, fixtures et preuves NAR-ACC-004/005/015 plus perspective NAR-ACC-006.
- [ ] Generer les premiers mobiles non-systeme contextuels, en commencant par les profils marchands, criminels et religieux.
- [ ] Historiser les causes d'action importantes sans surcharger `recentHistory`.
- [ ] Prioriser les cas narratifs 005 a 009 avant leur implementation.
- [ ] Remplacer les scripts de test factices du module narration lorsqu'un nouveau runtime sera introduit.

## Blocages et risques

- Le snapshot narratif dans `test-GAME-2D/docs/Evolution/Avancement.md` date du 2026-02-23 et doit etre revalide avant de servir de planning detaille.
- La commande unitaire et la demonstration narration restent informatives faute de capacite correspondante; contrats I-00 et integration IndexedDB I-01 sont reels.
- `npm audit --omit=dev` signale une vulnerabilite haute transitive existante dans `@xmldom/xmldom` via PixiJS; elle n'est pas introduite par I-01 et doit etre traitee separement avant livraison publique.
- `docs projet/Structure app.md` decrit une ancienne cible Nuxt/Vue/Pinia; la reference executable actuelle est `test-GAME-2D/package.json`.
- Les jonctions UI avec le createur de personnage et le plateau tactique sont explicitement differees; les projections I-02 restent des contrats testes sans branchement applicatif.
- La parite directe import/plateau reste la reserve documentee d'I-02; elle ne doit pas etre contournee dans I-03.

## Termine recemment

- [x] Revue de gate I-03: matrice de preuves, fermeture d'I-03 et autorisation limitee a l'audit I-04 AF-R08/AF-R09 le 2026-07-07.
- [x] Candidats I-03D: selection deterministe d'un candidat de rencontre depuis signaux monde/lore/archétypes sans creation IA le 2026-07-07.
- [x] Raccord I-03D: commit atomique voyage avec horloge, checkpoint `process.state`, `world.position`, evenement, rejeu idempotent et Chromium le 2026-07-07.
- [x] Socle I-03D: types `TravelProcessV1`, graine de rencontre stable, checkpoint `process.state`, temps nul meta et 4 preuves voyage le 2026-07-07.
- [x] I-03C: adaptateur monde sur copie, sorties empreintees et commit atomique du tick en memoire et Chromium le 2026-07-06.
- [x] I-03B: agregats temporels, checkpoints empreintes et commits atomiques verifies en memoire et Chromium le 2026-07-06.
- [x] I-03A: contrat `temporal-kernel/1`, propositions d'avance, echeances, ordre causal et frontieres horaires deterministes le 2026-07-06.
- [x] Revue de gate I-02: 13 preuves sur 14, checkpoints NAR-ACC-008/009/021 explicites et reserve tactique isolee le 2026-07-06.
- [x] Service `campaign.bootstrap`, validation paquet/ruleset/provenance, chaîne des Archives, projections par règles et 8 rejets atomiques le 2026-07-06.
- [x] `RuleRegistry` strict, manifeste de 15 regles, 11 executeurs purs, conflits, surcharges et citations le 2026-07-06.
- [x] Fixture issue de `buildCharacterSave`, import legacy, projections tactique/narrative et 16 rejets cibles le 2026-07-06.
- [x] Bootstrap atomique IndexedDB, 7 contrats partages dans Chromium et relecture apres reouverture le 2026-07-06.
- [x] Port `CampaignBootstrapRepository`, adaptateur memoire et 7 contrats couvrant 8 points de panne atomiques le 2026-07-06.
- [x] Migration de 25 sources geographiques et organisationnelles, 13 templates V1 et exclusion versionnee de `gouvernances/primauté` le 2026-07-06.
- [x] Schemas et compilation `lore-authoring/1` etendus aux 13 types, avec test du corpus reel le 2026-07-06.
- [x] Compilation YAML stricte et deterministe des cinq nouveaux types en entites, relations, fragments et manifeste le 2026-07-06.
- [x] Types, schemas AJV stricts, 14 controles de parite et 10 fixtures de `lore-authoring/1` le 2026-07-06.
- [x] Correction de l'atomicite par `campaign-bootstrap/2`, gel de `lore-authoring/1` et premiers templates espece/culture/PNJ/histoire le 2026-07-06.
- [x] Audit AF-R04 a AF-R07, contrat `campaign-bootstrap/1` fige et autorisation limitee a I-02 le 2026-07-03.
- [x] Implementation I-01: IndexedDB, migrations par generations, 19 contrats communs et 15 tests Chrome le 2026-07-03.
- [x] Audit AF-R03, contrat `campaign-storage/1` fige et autorisation limitee a I-01 le 2026-07-03.
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
