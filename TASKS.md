# Suivi du travail

Derniere mise a jour: 2026-07-08

Ce fichier est le tableau de bord court du depot. Les details techniques restent dans les documents lies; une tache ne doit pas etre dupliquee ici avec toute sa specification.

## En cours

- [ ] Cadrer puis implémenter le branchement OpenAI live serveur pour `player_intent_interpreter`, avec opt-in, schéma strict et fallback conservateur.
  References: `test-GAME-2D/narration-module/docs/Revue-produit-I06X-I06Y.md`, `test-GAME-2D/narration-module/docs/Contrat-interpretation-ia-intention.md`, `test-GAME-2D/narration-module/docs/Suivi-prochains-lots-narration.md`.
- [ ] Consolider la simulation du monde apres l'ajout des objectifs multi-phases, des opportunites de faction et des mobiles non-systeme.
  Reference: `test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md`. Les mobiles exposent maintenant l'objectif, la phase et la cible qu'ils servent.

## Prochaines etapes

- [ ] Migrer `wiki/lore/gouvernances/primauté` vers un futur type de gouvernance et retirer alors son exclusion explicite.
- [ ] Préparer après I-06A le branchement UI narratif progressif, sans appel fournisseur direct depuis React tant que les projections ne sont pas validées.
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

- [x] Revue produit I-06X/I-06Y: traces intention, possibilité, clarification et UX validées; suite retenue OpenAI live serveur pour `player_intent_interpreter` le 2026-07-08.
- [x] Fermeture I-06Y: encarts UX no-commit/clarification, badges possibilité/action non exécutée/parole enregistrée et test `narration-module:test:narrative-react-ui` renforcé le 2026-07-08.
- [x] Fermeture I-06X: rôle `player_intent_interpreter`, contrat `ai-intent-interpretation/1`, robustesse linguistique, fallback conservateur et intégration contrôleur le 2026-07-08.
- [x] Cadrage I-06X: contrat `ai-intent-interpretation/1`, rôle `player_intent_interpreter`, matrice de robustesse linguistique et interdiction d'autorité IA sur les commits le 2026-07-08.
- [x] Cadrage de sortie I-06: prototype narratif clos dans son périmètre sûr, défaut d'interprétation déterministe acté et suite I-06X orientée IA structurée le 2026-07-08.
- [x] Fermeture I-06W: revue UX narration, badges accessibles pour rôles/statuts critiques et test `narration-module:test:narrative-react-ui` renforcé le 2026-07-08.
- [x] Fermeture I-06V: gate `plot-preparation-gate/1`, checklist intrigue et blocage des secrets/indices/résumés d'intrigue prématurés le 2026-07-08.
- [x] Fermeture I-06U: contrat `scene-ephemeral-creation/1`, validation stricte des détails transitoires et rejet des créations durables/secrètes le 2026-07-08.
- [x] Fermeture I-06T: adaptateur `lore-playable-scene-adapter/1`, Archives de Lysenthe en scène jouable et exclusion des secrets le 2026-07-08.
- [x] Fermeture I-06S: contrat `playable-scene-state/1`, fixture Auberge du Seuil, deuxième scène Tour de guet et test `narration-module:test:playable-scene` le 2026-07-08.
- [x] Fermeture I-06R: corrections qualité issues d'I-06Q, classification sociale, localisation contextualisée, PNJ serveuse ciblé et test vertical renforcé le 2026-07-08.
- [x] Fermeture I-06Q: scénario vertical qualité de 12 entrées, mode local et OpenAI-compatible simulé, matrice des écarts I-06R et test `narration-module:test:vertical-quality` le 2026-07-08.
- [x] Fermeture I-06P: mémoire courte PNJ bornée, deuxième réponse non répétitive, pack IA enrichi et writer lease libéré le 2026-07-07.
- [x] Fermeture I-06O: état `scene.state` minimal, mutation atomique sur parole, rendu et paquet IA dépendants de l'état le 2026-07-07.
- [x] Fermeture I-06N: paquet de contexte IA `scene_writer`, fingerprint stable, références autorisées et fallback local ancré le 2026-07-07.
- [x] Fermeture I-06M: scène narrative de référence `reference-inn-rain-001`, blocs concrets MJ/PNJ et garde-fous méta/possibilité le 2026-07-07.
- [x] Fermeture I-07D: placeholder tactique contractuel, scénarios contrôlés, outcomes typés et intégration temporelle idempotente le 2026-07-07.
- [x] Fermeture I-07C: état `rest.process`, progression segmentée, checkpoints, interruptions déterministes et test dédié le 2026-07-07.
- [x] Fermeture I-07B: intégration temporelle des outcomes tactique/repos via `world.clock`, retry idempotent et test dédié le 2026-07-07.
- [x] Fermeture I-07A: types, validateurs, fixtures et intégration idempotente simulée des handoffs tactique/repos avec test dédié le 2026-07-07.
- [x] Matrice de couverture des scénarios NAR-ACC: état couvert/partiel/non ouvert et confirmation que I-07A reste le prochain lot logique le 2026-07-07.
- [x] Audit I-07 tactique/repos: contrat `tactical-rest-handoff/1`, décision `/api/narration` non autoritaire et autorisation I-07A le 2026-07-07.
- [x] Fermeture I-06L: reconstruction du fil visible depuis les projections persistées, lecture `listOperations` et prototype navigateur IndexedDB le 2026-07-07.
- [x] Fermeture I-06K: opération `narrative.render.projection`, persistance du rendu final et incidents IA expurgés sans autorité métier le 2026-07-07.
- [x] Realignement documentaire post-I-06J: README racine/module/docs, audit et plan distinguent surface prototype OpenAI opt-in et runtime complet non livre le 2026-07-07.
- [x] Calibration post-I-06J: `scene_writer` saute les `NO_COMMIT_RESPONSE` méta/informatifs, tests météo/localisation et statut UI sans faux fallback le 2026-07-07.
- [x] Correctif live I-06J: schéma OpenAI strict par requête compatible Responses API, instructions serveur explicites, validation payload par rôle et diagnostic fallback UI le 2026-07-07.
- [x] Fermeture I-06J: bascule UI Locale/OpenAI, client route serveur dédiée, fallback local et test `narration-module:test:narrative-app-surface` le 2026-07-07.
- [x] Fermeture I-06I: route serveur OpenAI narrative opt-in, rôles bornés, clé absente sans réseau et test `narration-module:test:narrative-openai-route` le 2026-07-07.
- [x] Fermeture I-06H: surface narration enrichie par faux fournisseur et OpenAI compatible `ContractAiProviderV1` sans import navigateur le 2026-07-07.
- [x] Fermeture I-06G: enrichissement IA borne, expression PJ, narration MJ ancree, fallback et test `narration-module:test:ai-narrative-enhancement` le 2026-07-07.
- [x] Fermeture I-06F: resolver deterministe, commit speech borne, handoffs inventaire/tactique, idempotence et test `narration-module:test:narrative-resolution` le 2026-07-07.
- [x] Audit I-06F: contrat `narrative-resolution/1` fige et autorisation limitee a la résolution narrative bornée le 2026-07-07.
- [x] Fermeture I-06E: interprétation conservatrice, possibilité sans action, clarification suspendue, reprise et test `narration-module:test:narrative-turn-controller` le 2026-07-07.
- [x] Audit I-06E: contrat `intent-clarification/1` fige et autorisation limitee a l'interprétation conservatrice sans mutation le 2026-07-07.
- [x] Fermeture I-06D: contrôleur narratif prototype, opération durable, `NO_COMMIT_RESPONSE`, idempotence et test `narration-module:test:narrative-turn-controller` le 2026-07-07.
- [x] Audit I-06D: contrat `narrative-turn-controller/1` fige et autorisation limitee au contrôleur prototype sans commit métier le 2026-07-07.
- [x] Fermeture I-06C: shell `App.tsx`, surface narration dédiée, séparation de `GameBoard.tsx` et test `narration-module:test:narrative-app-surface` le 2026-07-07.
- [x] Audit I-06C: contrat `narrative-app-surface/1` fige et autorisation limitee a la surface narration dediee le 2026-07-07.
- [x] Fermeture I-06B: composant React pur, saisie libre callback, rendu accessible et test `narration-module:test:narrative-react-ui` le 2026-07-07.
- [x] Audit I-06B: contrat `narrative-react-ui/1` fige et autorisation limitee aux composants React purs le 2026-07-07.
- [x] Fermeture I-06A: types, validateurs, projections, rythme configurable, transcript reconstructible et test `narration-module:test:scene-social-ui` le 2026-07-07.
- [x] Audit I-06 AF-R16: contrat `scene-social-ui/1` fige et autorisation limitee a I-06A le 2026-07-07.
- [x] Fermeture I-05B: adaptateur OpenAI, tests simulés, smoke live opt-in, regressions et build global reussis le 2026-07-07.
- [x] Audit I-05B fournisseur OpenAI: contrat `ai-provider-openai/1` fige et autorisation limitee a I-05B le 2026-07-07.
- [x] Fermeture I-05A: matrice de preuves, regressions `contracts`, `memory`, `context`, `time`, `indexeddb` et build global reussis le 2026-07-07.
- [x] Socle I-05A: types, validateurs, faux fournisseur, sorties strictes, incidents expurges et créations dynamiques avec scripts `narration-module:test:ai-pipeline` et `narration-module:test:dynamic-creation` le 2026-07-07.
- [x] Audit I-05 AF-R10/AF-R11/AF-R15/AF-C02: contrat `ai-pipeline/1` fige et autorisation limitee a I-05A le 2026-07-07.
- [x] Fermeture I-04: matrice de preuves, regressions `contracts`, `time`, `indexeddb` et build global reussis le 2026-07-07.
- [x] Socle I-04: memoire sourcée, index reconstruisible, snapshot, contexte role, budget, secret et obsolescence avec scripts `narration-module:test:memory` et `narration-module:test:context` le 2026-07-07.
- [x] Audit I-04 AF-R08/AF-R09: contrat `memory-context/1` fige et autorisation limitee a I-04 le 2026-07-07.
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
