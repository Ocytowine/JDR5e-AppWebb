# Suivi du travail

Derniere mise a jour: 2026-07-22

Ce fichier est le tableau de bord court du depot. Les details techniques restent dans les documents lies; une tache ne doit pas etre dupliquee ici avec toute sa specification.

## En cours

- [ ] Faire évoluer `wiki/lore` vers un guide prioritairement narratif pour les créations dynamiques.
  Références: `test-GAME-2D/narration-module/docs/Cadrage-lore-narratif-dynamique.md`, `Contrat-selection-influences-lore.md` et `Contrat-creation-scene-guidee-lore.md`. Le port de projections et la gate `PLACE` sont couverts. `place-creation-command/1` prépare un commit atomique des registres lieu/topologie/faits, puis reconstruit la scène uniquement depuis les agrégats confirmés, sans matérialiser les rôles de population en PNJ. Prochaine étape concrète: brancher le runtime repository avec lease, commit et relecture post-commit, puis intégrer le lieu dynamique au catalogue de scènes du contrôleur, toujours sans appel OpenAI.

- [ ] Ouvrir la transition locale de scène sans créer de seconde topologie narrative.
  Référence: `test-GAME-2D/narration-module/docs/Contrat-transition-locale-scene.md`. Les passages salle commune ↔ arrière-salle sont commités avec 8 secondes chacun et les tours relisent `scene.lifecycle`. Le `scene_writer` reçoit un contexte et un brief génériques depuis la scène active, avec historique filtré et gate factuelle. Le vertical automatisé couvre arrivée, observation, approche de lampe, examen borné des traces et retour à la seconde 16. Prochaine étape concrète: recette UI OpenAI de cette séquence.

- [ ] Traiter l'audit technique post-I-06ZB avant d'ouvrir une nouvelle capacité narrative.
  References: `test-GAME-2D/narration-module/docs/Audit-technique-I06ZB.md`, `test-GAME-2D/narration-module/docs/Revue-technique-post-I06ZB.md`, `test-GAME-2D/narration-module/docs/Suivi-prochains-lots-narration.md`.
  Note: A-01, A-02, A-03, A-04 et A-07 traités le 2026-07-09; I-06ZC à I-06ZR livrés. NAR-129 à NAR-132 sont implémentés. `ai-intent-semantic/2` réduit le parcours live de 328,8 s à 269,2 s. La gate ciblée donne 3/3 handoffs corrects mais refuse la latence p95=18,7 s pour un seuil de 15 s. Prochaine étape concrète: benchmarker le modèle d'interprétation avec les métriques fournisseur désormais visibles, sans changer les modèles de prose.
- [ ] Consolider la simulation du monde apres l'ajout des objectifs multi-phases, des opportunites de faction et des mobiles non-systeme.
  Reference: `test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md`. Les mobiles exposent maintenant l'objectif, la phase et la cible qu'ils servent.

## Prochaines etapes

- [ ] Réaliser la revue de gate post-I-06ZR et décider de la prochaine capacité narrative sans rouvrir les autorités IA fermées.
- [ ] Migrer `wiki/lore/gouvernances/primauté` vers un futur type de gouvernance et retirer alors son exclusion explicite.
- [ ] Préparer après I-06A le branchement UI narratif progressif, sans appel fournisseur direct depuis React tant que les projections ne sont pas validées.
- [ ] Generer les premiers mobiles non-systeme contextuels, en commencant par les profils marchands, criminels et religieux.
- [ ] Historiser les causes d'action importantes sans surcharger `recentHistory`.
- [ ] Prioriser les cas narratifs 005 a 009 avant leur implementation.
- [ ] Etendre la recette narration aux conversations PNJ longues et aux transitions de scene, sans promouvoir une parole attribuee en verite factuelle.

## Blocages et risques

- Le snapshot narratif dans `test-GAME-2D/docs/Evolution/Avancement.md` date du 2026-02-23 et doit etre revalide avant de servir de planning detaille.
- La commande unitaire et la demonstration narration restent informatives faute de capacite correspondante; contrats I-00 et integration IndexedDB I-01 sont reels.
- `npm audit --omit=dev` signale une vulnerabilite haute transitive existante dans `@xmldom/xmldom` via PixiJS; elle n'est pas introduite par I-01 et doit etre traitee separement avant livraison publique.
- `docs projet/Structure app.md` decrit une ancienne cible Nuxt/Vue/Pinia; la reference executable actuelle est `test-GAME-2D/package.json`.
- Les jonctions UI avec le createur de personnage et le plateau tactique sont explicitement differees; les projections I-02 restent des contrats testes sans branchement applicatif.
- La parite directe import/plateau reste la reserve documentee d'I-02; elle ne doit pas etre contournee dans I-03.

## Termine recemment

- [x] Premier socle fonctionnel post-consolidation `scene-transition/1`: connexions canoniques indépendantes des alias, distinction transition locale/voyage/passage à résoudre, contrôle de version et destination, sans hardcode de scène ni autorité de commit le 2026-07-22.

- [x] `player_intent_interpreter` V2 certifié sur `gpt-5.6-luna/none` le 2026-07-22: gate finale 24/24, zéro retry, p95 de 2,633 à 3,761 s; mouvements, franchissements, relations de destination et préconditions conservés sans hardcode lexical.

- [x] Observabilité V2 et gate répétée: métriques modèle/tokens/latence/fin/budgets/tailles dans la notification système, contexte V2 réduit, retry technique unique de 15 s et gate live trois répétitions avec seuils p95/max le 2026-07-21.
- [x] Contrat compact `ai-intent-semantic/2`: compréhension IA ouverte conservée, action libre, portée de scène générique, projections runtime/legacy reconstruites localement, V1 compatible et quatre tests adversariaux sans lexique de scène le 2026-07-21.
- [x] Recette OpenAI live NAR-132 instrumentée: configuration partagée avec l'UI, timeout HTTP effectif, suppression du timeout performer caché de 1 s, actes de dialogue stabilisés localement et rapport 8/10 avec latences par rôle le 2026-07-21.
- [x] NAR-132 déterministe: recette de dix tours avec deux PNJ, mémoire intention-réponse isolée par acteur, répétition, changement de cible, handoff de transition et reprise; correction de la priorité parole/référent et du plafond mémoire par PNJ le 2026-07-21.
- [x] NAR-131: registre déclaratif de capacités runtime, routage `HANDLE`/`HANDOFF`/`CLARIFY`, commandes tracées et suppression de `canonicalActionHint` comme décision de domaine le 2026-07-21.
- [x] Détail de latence interne du contrôleur, contexte spatial explicite et contrôle local des contradictions PNJ, avec nettoyage typographique borné de l'expression joueur sans appel OpenAI le 2026-07-21.
- [x] Fidélité des actes de dialogue PNJ: diagnostic `dialogueAct`, planner local déterministe, expression joueur locale fidèle dans la surface OpenAI, `npc_performer` responsable des dialogues avec budget adapté, cadre de réaction validé localement, provenance `allowedSourceRefs`, historique couplé intention-réponse, trace mémoire/latence dans le bloc système, critique conditionnel des risques de continuité, schémas OpenAI stricts vérifiés, fallback dépendant de l'acte et rejets visibles le 2026-07-21.
- [x] Correctif live approche PNJ: une suggestion OpenAI `nonverbal_signal` ciblant un PNJ visible est stabilisee localement en `scene_resolution`, commit local sans temps ni reaction automatique le 2026-07-21.
- [x] Diagnostic live des rejets intention/runtime: valeurs OpenAI proposées et invariants violés désormais visibles pour reproduire les écarts d'approche PNJ le 2026-07-21.
- [x] Gate adversariale NAR-129/NAR-130: fausses presences rejetees par discipline factuelle et references de memoire PNJ limitees aux projections de rendu effectivement fournies le 2026-07-21.
- [x] Documentation de collaboration alignee sur le module narration actif et sur sa compilation par le build global le 2026-07-21.

- [x] Consolidation NAR-130A: actes de dialogue structurés, connaissances PNJ bornées, interdiction du faux historique quand aucune réplique antérieure n'est disponible et repli performer visible le 2026-07-20.
- [x] Consolidation NAR-130B: mémoire des répliques PNJ reconstruite depuis les projections finales réellement affichées, isolée par acteur et transmise comme parole attribuée sans promotion factuelle le 2026-07-20.

- [x] Fondation NAR-129: `narrative-render-plan/1`, affirmations positives sourcées, perspective explicite et texture `TURN_ONLY` non mémorisable, non mécanique et non réutilisable le 2026-07-20.
- [x] Correctifs transversaux de recette NAR-128: retrait du veto lexical sur `coreMeaning`, perception structurée des points d'intérêt, domaine `open/force` stabilisé, cible globale `unknown` normalisée et dialogues PNJ de repli sans faux faits ni faux historique le 2026-07-20.
- [x] Frontière de prose NAR-127: contrôle sémantique indépendant des reformulations PJ, conservation du texte original en cas d'ajout, réplique déterministe de la serveuse limitée aux faits publics et diagnostics legacy/commit clarifiés le 2026-07-20.
- [x] Correctif statut fallback: distinction structurée entre `TECHNICAL_INCIDENT` et `RENDER_AUTHORITY_REJECTION`; un rejet normal du critique conserve le rendu perceptif autorisé sans afficher « OpenAI indisponible » ni relancer tout le pipeline local le 2026-07-20.
- [x] Correctif enveloppe critique: le schéma OpenAI impose désormais `status=OK` pour toute sortie structurée exploitable, tandis que `payload.verdict=REJECT` porte le refus narratif; suppression de la contradiction schéma/validateur qui produisait `OPENAI_INVALID_ENVELOPE` le 2026-07-20.
- [x] Fiabilisation du démarrage narration: `npm run dev` reconstruit désormais `dist` avant `server.js`, afin qu'un redémarrage ne continue plus à servir un ancien bundle client; le cas avait masqué le correctif SHA-256 du `player_expression_adapter` le 2026-07-20.
- [x] Correctif transport post-NAR-126: `player_expression_adapter` utilise désormais l'empreinte SHA-256 réelle de son contexte borné au lieu d'une ancienne valeur symbolique refusée en HTTP 400; régression ciblée et builds narration OK le 2026-07-20.
- [x] Résolution perceptive minimale `perception-resolution/1`: profondeur sémantique IA `GLANCE`/`FOCUSED`/`SEARCH`, indices de scène à visibilité contrôlée, résultat automatique ou vérification requise sans commit, RenderAuthority alimentée par les seuls indices révélés et test vertical dédié le 2026-07-20.
- [x] Correctif de rendu post-recette: frontière structurée `OBSERVATION_RESULT`/`ACTION_STAGING_ONLY`/`CONFIRMED_OUTCOME`/`NPC_REACTION`, critique IA sémantique non autoritaire, fallback prudent sur résultat inventé, observation ciblée publique et suppression du doublon MJ après parole PNJ le 2026-07-20.
- [x] Correctif live de continuité post-I-06ZR: retrait du second interprète lexical serveur, historique sémantique borné pour les ellipses, aides legacy non autoritaires, détails de validation visibles et première réplique PNJ non répétitive; smoke OpenAI des quatre tours OK le 2026-07-20.
- [x] Préparation de la recette fonctionnelle manuelle post-I-06ZR: sept scénarios séquencés, frontières de réinitialisation IndexedDB, format de collecte des blocs visibles et critères de gate le 2026-07-20.
- [x] Diagnostic fournisseur post-I-06ZR: les enveloppes IA non `OK` propagent maintenant leur code et message expurgé dans les `Issue:` visibles, au lieu de masquer la cause derrière le seul statut générique; test pipeline ajouté le 2026-07-17.
- [x] Correctif badge diagnostic: une projection legacy `intent:meta_question` ne force plus le bandeau UI « Contexte » quand le corps porte `AI_INTERPRETATION_FAILED`; le bandeau indique explicitement « Interprétation IA refusée » le 2026-07-17.
- [x] Correctif troncature OpenAI: budget `player_intent_interpreter` relevé de 700 à 1600 tokens (plafond serveur 2000) et statut Responses API `incomplete` diagnostiqué explicitement; la sortie JSON structurée ne doit plus être coupée sur une intention simple le 2026-07-17.
- [x] Correctif projection observation: narration IA unique en remplacement du texte déterministe et avant la notification, expression joueur fidèle, statut « Observation exécutée - sans mutation durable », badges UI limités aux blocs système; régressions ajoutées le 2026-07-17.
- [x] Correctif rendu post-I-06ZR: `AI_INTERPRETATION_FAILED` ne se déguise plus en question de contexte malgré sa projection legacy; aucun faux bloc MJ n'est produit et les causes `Issue:` du rejet IA/mapping sont visibles dans la notification système. Cas « Je regarde la serveuse. », régressions ciblées et build narration OK le 2026-07-17.

- [x] Correctif post-I-06ZR: diagnostic `AI_INTERPRETATION_FAILED` distingué d'une intention de jeu, validation canonique finale avant resolver et annulation des opérations `RECEIVED` après échec pré-commit; `narrative.intent-authority.contradiction` puis `core.operation.campaign-busy` ne doivent plus s'enchaîner, régressions et build OK le 2026-07-17.
- [x] Fermeture I-06ZR: matrice d'autorité canonique, six contradictions rejetées sans commande, validation avant resolver et replis legacy retirés des consommateurs métier; adaptateurs historiques restants bornés le 2026-07-17.
- [x] Fermeture I-06ZQ: contrat d'empreinte système, sept familles de cinq formulations, trois scènes et 105 convergences déterministes; procédure live séparée avec seuils et taxonomie le 2026-07-17.
- [x] Fermeture I-06ZP: registre générique construit depuis `PlayableSceneStateV1`, vues par rôle, canonicalisation sans tables de fixture, ambiguïté explicite, mémoire récente liée à scène/version et preuves sur trois scènes le 2026-07-17.
- [x] Fermeture I-06ZO: décisions de domaine, commit, positionnement et mutations retirées des lectures de `rawInput`/`coreMeaning`; usages lexicaux restants classés avec conditions de retrait, tests ciblés et builds OK le 2026-07-17.

- [x] Socle I-06ZF: contrat unique `ai-intent-interpretation/1` enrichi par `semanticIntent` et `runtimeHandling`, diagnostic explicite sans fallback narratif sur sortie IA invalide, cas naturel "poignée/mécanisme" couvert, validations TS/serveur renforcées et tests `ai-intent-interpretation`, `narrative-openai-route`, `build` OK le 2026-07-16.
- [x] Verrou runtime I-06ZG: `runtimeHandling` propagé jusqu'à `NarrativeIntentInterpretationV1`, resolver priorisant `UNSUPPORTED_DOMAIN`/`NEEDS_CLARIFICATION` avant heuristiques legacy, handoff inventory prouvé sans mot-clé lexical évident et test `narration-module:test:ai-intent-interpretation` OK le 2026-07-16.
- [x] MJ planner minimal I-06ZH: contrat `mj-planner/1`, provider local, validation stricte `commitAuthority=false`, appel contrôleur sur intentions engagées/domaines fermés, sortie technique `mjPlan` sans prose ni commit et tests `ai-intent-interpretation`, `narrative-resolution`, `ai-pipeline`, `narration-module:build` OK le 2026-07-16.
- [x] Branchement IA MJ planner I-06ZI: route OpenAI serveur autorisant `mj_planner` sous contrat `mj-planner/1`, schéma strict non committable, modèle optionnel `NARRATION_OPENAI_MJ_PLANNER_MODEL`, configuration UI OpenAI du planner et tests `narrative-openai-route`, `ai-intent-interpretation`, `narrative-resolution`, `narration-module:build`, `build` OK le 2026-07-16.
- [x] NPC performer minimal I-06ZJ: contrat `npc-performer/1`, provider local borné, validation sans révélation ni engagement durable, appel depuis assignation `mj_planner`, remplacement contrôlé de `NPC_SPEECH` et tests `ai-pipeline`, `narrative-turn-controller`, `ai-intent-interpretation` OK le 2026-07-16.
- [x] Correctif intention approche seule: `Je m'approche du garde` devient une action locale bornée enregistrée, ne déclenche plus `speech`, `npc_performer` ou `Parole enregistrée`; validation serveur OpenAI renforcée et tests `ai-intent-interpretation`, `narrative-openai-route`, `narrative-turn-controller` OK le 2026-07-16.
- [x] Branchement IA NPC performer I-06ZK: route OpenAI serveur autorisant `npc_performer` sous contrat `npc-performer/1`, schéma strict sans secret ni engagement durable, modèle optionnel `NARRATION_OPENAI_NPC_PERFORMER_MODEL`, configuration UI OpenAI du performer et tests `narrative-openai-route`, `narrative-app-surface`, `ai-pipeline` OK le 2026-07-16.
- [x] Correctif continuité approche PNJ: une approche locale d'un PNJ visible alimente le référent récent; `je m'approche de la serveuse` committe une action locale, puis `je lui demande ce qui ne va pas` reste une parole ciblée vers la serveuse avec `npc_performer`, et non une question de contexte. Tests `ai-intent-interpretation`, `narrative-openai-route`, `narrative-turn-controller`, `narrative-resolution`, `ai-pipeline`, `narration-module:build`, `build` OK le 2026-07-16.
- [x] Correctif approche PNJ reformulée: `je me dirige vers le garde` est traité comme positionnement local committable via `runtimeHandling` sémantique, sans dépendre d'un mot-clé conservé dans `coreMeaning`; tests `ai-intent-interpretation` et `narrative-resolution` OK le 2026-07-16.
- [x] Correctif référent visible générique: `je m'avance vers la femme` résout le PNJ féminin visible unique, committe le positionnement local, puis `je lui demande comment elle va` cible et affiche la serveuse; le rendu `NPC_SPEECH` suit désormais la cible structurée plutôt que le texte brut. Tests `ai-intent-interpretation`, `narrative-turn-controller`, `narrative-resolution` OK le 2026-07-16.
- [x] Diagnostic système narratif: les blocs `Notification système` exposent désormais intention, cible résolue, runtime, raison et effet métier, afin de repérer les écarts interprétation/résolution/rendu sans se contenter de `Sans commit`. Tests `narrative-resolution`, `narrative-turn-controller`, `ai-intent-interpretation`, `narrative-react-ui`, `narrative-app-surface` OK le 2026-07-16.
- [x] Correctif référent visible masculin: `je me dirige vers l'homme blessé` n'est plus classé sur `self` à cause du réflexif `me`, résout le garde blessé, committe le positionnement local et conserve la cible pour `je lui demande ce qu'il a`; test `ai-intent-interpretation` OK le 2026-07-16.
- [x] Correctif canonisation refs PNJ IA: une sortie IA avec `ref=npc-serveuse-nerveuse` est normalisée en `npc:npc-serveuse-nerveuse`; le planner, `npc_performer` et le rendu prennent le référent résolu canonique afin que `j'appel la serveuse` puis `je lui demande...` conserve la serveuse et ne retombe plus sur le garde. Tests `ai-intent-interpretation`, `narrative-turn-controller`, `narrative-resolution`, `narrative-openai-route`, `ai-pipeline`, `narration-module:build` OK le 2026-07-16.
- [x] Relecture chaîne conversationnelle PNJ: `rememberLocalReferent`, `referenceSceneState`, `mjPlanning`, `referenceScene` et `npcPerforming` priorisent maintenant `referentResolution.resolvedTarget` avant les reconstructions textuelles; la mémoire courte et le rendu restent alignés avec la cible structurée. Tests `ai-intent-interpretation`, `narrative-turn-controller`, `narrative-resolution`, `vertical-quality`, `narrative-openai-route`, `ai-pipeline`, `narrative-react-ui`, `narration-module:build`, `build` OK le 2026-07-16.
- [x] Verrou cohérence runtime/action IA: une approche PNJ `action=act` avec domaine autre que `scene_resolution` est rejetée, et une parole avec action mécanique comme `force` est rejetée; le diagnostic affichera donc un rejet IA plutôt qu'un faux no-commit narré comme exécuté. Tests `ai-intent-interpretation`, `narrative-openai-route`, `narrative-turn-controller`, `narrative-resolution`, `vertical-quality`, `ai-pipeline`, `narration-module:build` OK le 2026-07-16.
- [x] Fermeture I-06ZE: resolution IA/fake des referents locaux recents via `referentResolution`, validation visible/compatible, commit local borne `LOCAL_SCENE_ACTION_RECORDED` sans revelation ni temps, tests `ai-intent-interpretation`, `narrative-resolution`, `narrative-turn-controller`, `narrative-openai-route` et `narration-module:build` OK le 2026-07-15.
- [x] Durcissement post-I-06ZE: clarification sans contexte, rejet/clarification des referents ambigus ou incompatibles pour `open`/`force`, actions IA contraintes aux categories canoniques du contrat, validation serveur OpenAI renforcee et tests ciblés OK le 2026-07-15.
- [x] Implementation I-06ZD: fil initial remplace par une amorce de scene jouable issue de `PlayableSceneStateV1`, anciens messages prototype retires du rendu initial, test `narration-module:test:narrative-app-surface` OK le 2026-07-10.
- [x] Smoke UI I-06ZD valide: premiere impression OK, plus de message tronque observe; prochain sujet identifie = resolution bornee d'action sur point d'interet visible le 2026-07-10.
- [x] Cadrage I-06ZE: resolution IA des referents locaux recents, code limite a validation visible/unique/compatible et interdiction explicite du hard code metier le 2026-07-10.
- [x] Validation I-06ZC: certification live courte du `scene_writer`, 12 cas OK sur 12, 0 `A_CORRIGER`, 0 `BLOQUANT`, suite I-06ZD retenue le 2026-07-10.
- [x] Revue technique post-I-06ZB: comportement live `scene_writer` jugé exploitable, écarts restants classés et suite I-06ZC/I-06ZD/I-06ZE cadrée sans ouvrir `mj_planner` le 2026-07-09.
- [x] Fermeture I-06Z: route OpenAI serveur étendue à `player_intent_interpreter`, schéma strict `ai-intent-interpretation/1`, fallback conservateur et mode UI OpenAI appliqué à l'interprétation le 2026-07-08.
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
- [x] Decouplage de l'ancien runtime narration le 2026-06-29. Note historique: depuis la reprise I-00 a I-07, le nouveau module narration est de nouveau compile par le build global et utilise par la surface applicative.
- [x] Affectation runtime explicite des mobiles aux phases d'objectif et correction du garde-fou de traces mobiles le 2026-06-22.
- [x] Ajout d'une verification de regression du module carte (`npm run map-module:test:regression`) le 2026-06-22.
- [x] Ajout des sondes longues de simulation et de mobilite le 2026-06-17.
- [x] Ajout des diagnostics de mobiles, causes d'action, objectifs multi-phases et opportunites de faction le 2026-06-17.
- [x] Mise en place de `AGENTS.md`, `TASKS.md` et refonte du guide racine le 2026-06-22.

## Regle de mise a jour

Au debut d'une session, choisir une tache de `En cours` ou ajouter la demande du moment. A la fin, mettre a jour son statut, la date, les blocages et la prochaine action verifiable. Git reste la source de verite pour le detail exact des modifications.
