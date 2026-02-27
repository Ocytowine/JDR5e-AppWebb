# Plan Optimisation Pipeline IA Semantique (v1)

## Objectif

Stabiliser le MJ narratif en reduisant fortement les appels IA par message, sans revenir a une logique de mots-cles hardcodes.

Contraintes produit:
- narration fluide et RP, non robotique;
- coherence forte lieu/PNJ/contexte;
- pas de "tunnels" a base de regex fragiles;
- architecture extensible pour les outils pas encore traites.

## Probleme actuel (resume audit)

Sur un seul message RP, le backend peut enchainer plusieurs appels IA successifs (detection, arbitrage, generation, raffinement, validations), parfois avec un second pipeline de branche.

Effets:
- latence elevee;
- cout tokens eleve;
- plus de points de divergence logique;
- maintenance complexe.

## Cible technique

Mode cible par tour RP:
- 1 appel IA principal maximum;
- 1 appel IA de secours uniquement si garde-fou serveur echoue;
- sinon zero appel supplementaire.

Le serveur devient arbitre des mutations sensibles (deplacement, acces, etat runtime), l IA reste forte sur la narration et la detection semantique.

---

## Priorisation et dependances (ajout)

### Priorites execution
- `P0` (fondation obligatoire): Phase 1 -> Phase 2 -> Phase 3 -> Phase 4.
- `P1` (industrialisation): Phase 7 + parties critiques de la Phase 8 (suppression chemins legacy les plus risques).
- `P2` (extension): Phase 5 -> Phase 6, puis reste de la Phase 8.

### Dependances explicites
- Phase 2 depend de la Phase 1 (le `commitment` doit vivre dans le meme contrat unique).
- Phase 3 depend de la Phase 1 (arbitrage serveur base sur `worldIntent` unifie).
- Phase 4 depend des Phases 1 a 3 (budget appels et validations sans pipeline parallele).
- Phase 5 depend de la Phase 1 (registre outils aligne sur schema stable).
- Phase 6 depend de la Phase 2 + Phase 5 (taxonomie + mapping outils).
- Phase 7 demarre des la Phase 1, mais KPI complets stables apres Phase 4.
- Phase 8 doit suivre les migrations effectives pour eviter de casser le run-time.

---

## Contrat JSON versionne (source de verite) (ajout)

Regle projet:
- un seul contrat IA officiel, versionne, utilise partout (chat handler + module narration + routes API);
- toute evolution passe par `schemaVersion` et retrocompat explicite;
- interdiction des schemas paralleles non versionnes en production.

Convention v1 minimale:
- `schemaVersion`: `1.0.0`
- `intentType`
- `commitment`
- `target`
- `socialFocus`
- `worldIntent`
- `toolCalls`
- `mjResponse`

---

## Phase 1 - Contrat unique "Intent + Reponse" (fondation)

### But
Remplacer les passes IA multiples par un contrat unique standard.

### A faire
1. Definir un schema JSON unique de sortie IA:
   - `schemaVersion` (ex: `1.0.0`)
   - `intentType`
   - `commitment` (declaratif, volitif, hypothetique, informatif)
   - `target`
   - `socialFocus`
   - `worldIntent`
   - `toolCalls`
   - `mjResponse` (scene, actionResult, consequences, options)
2. Brancher ce schema comme sortie principale dans le chat handler.
3. Garder un fallback local si JSON invalide.
4. Journaliser taux de parse OK/KO.
5. Interdire les chemins de parsing alternatifs non alignes sur ce schema versionne.

### Critere Done
- une reponse RP standard ne fait plus qu un seul appel IA principal.

---

## Phase 2 - Mode "Commitment" semantique (anti hardcode)

### But
Ne plus dependre de formulations exactes du joueur.

### A faire
1. Introduire la notion `commitment` dans le pipeline:
   - `declaratif`: action directe (ex: je rentre)
   - `volitif`: intention claire (ex: j aimerais rentrer)
   - `hypothetique`: conditionnel/faible engagement
   - `informatif`: question/description
2. Regle serveur:
   - declaratif/volitif + cible resolue => execution directe (ou blocage RP explique)
   - hypothetique => clarification/proposition
3. Supprimer les dependances de detection basees sur mots specifiques quand une version semantique existe.

### Critere Done
- "je rentre" et "j aimerais rentrer" convergent vers le meme acte si contexte compatible.

---

## Phase 3 - Arbitration serveur des mutations critiques

### But
Empêcher les incoherences de monde meme si le texte IA derape.

### A faire
1. Centraliser dans le serveur:
   - changement de lieu;
   - acces bloque/autorise;
   - interlocuteur actif;
   - transitions runtime.
2. L IA propose (`worldIntent`), le serveur valide/applique.
3. Si refus, generer une explication RP (pas meta/debug).

### Critere Done
- plus de "tu envisages..." quand l action est clairement executee.

---

## Phase 4 - Reduction des validations IA redondantes

### But
Conserver la qualite sans multiplier les appels.

### A faire
1. Remplacer certaines validations IA par checks deterministes serveurs:
   - coherence lieu courant;
   - continuité interlocuteur;
   - contradiction de stage (travel proposed vs confirmed).
2. Garder une seule validation IA de secours uniquement sur cas ambigus.
3. Introduire budget par tour:
   - `NARRATION_AI_MAX_CALLS_PER_TURN=2` (principal + secours)
   - coupe-circuit si depassement.

### Critere Done
- appels IA bornes par tour; pas de cascade.

---

## Phase 5 - Strategie outils extensible (non traitee completement aujourd hui)

### But
Pouvoir ajouter des outils sans re-coder le coeur narratif.

### A faire
1. Definir un registre outil declaratif:
   - nom outil
   - capacites (read/write/tick)
   - domaines (lore, rules, local-memory, quest, combat, etc.)
   - preconditions (quand l outil est pertinent)
   - schema args/retour
2. Mapper `intentType + commitment + contexte` -> familles d outils candidates.
3. Laisser l IA proposer `toolCalls`, mais filtrer serveur par registre (allowlist).
4. Ajouter un mecanisme "tool adapters" pour les nouveaux outils sans toucher le pipeline central.

### Critere Done
- ajout d un nouvel outil = enregistrement dans le registre + adapter minimal.

---

## Phase 6 - Evolution detection intention vers couverture complete outils

### But
Etendre la detection au-dela des cas deplacement/social/exploration.

### A faire
1. Etendre taxonomie d intentions:
   - `enter_place`, `move_place`, `inspect_local`, `social_exchange`, `trade_action`,
     `lore_query`, `rules_query`, `resource_action`, `quest_progress`, `system_command`, etc.
2. Associer pour chaque intent:
   - contraintes de coherence;
   - mutation autorisee ou non;
   - outils prioritaires.
3. Ajouter tests de paraphrases FR variées par intent (sans mots imposes).

### Critere Done
- couverture intentionnelle augmentee sans explosion de hardcode.

---

## Phase 7 - Observabilite et cout

### But
Piloter la stabilite et le cout en continu.

### A faire
1. Ajouter metriques par message:
   - nb appels IA;
   - latence totale;
   - tokens entree/sortie (si dispo);
   - appels outils executes;
   - reason fallback.
2. Exposer en mode details UI (debug) sans polluer le RP.
3. Ajouter alertes de regression:
   - appels IA > budget;
   - latence > seuil;
   - mismatch lieu/interlocuteur.

### Critere Done
- visibilite claire cout/qualite par tour.

---

## Phase 8 - Nettoyage obsolescence

### But
Supprimer les chemins legacy qui perturbent comportement et maintenance.

### A faire
1. Retirer fallback runtime vers fichiers demo en production locale.
2. Eviter les doubles chemins de lecture et sources concurrentes d etat.
3. Diminuer la taille du chat handler via extraction modules:
   - intent router
   - tool orchestration
   - response composer
   - runtime gatekeeper

### Critere Done
- code plus lisible, moins de side effects historiques.

---

## Plan de tests (obligatoire)

1. Jeux de paraphrases FR:
   - "je rentre", "j aimerais rentrer", "je vais entrer", "si possible j entre".
2. Cas travel local vs changement de zone.
3. Cas social avec/without interlocuteur explicite.
4. Cas lore/rules HRP et RP.
5. Cas echec de validation serveur avec reponse RP propre.
6. Non-regression: pas de fallback `*.main.auto`.

## KPI cible

- moyenne appels IA RP: <= 1.4 / message
- p95 latence narration: -35% vs baseline
- erreurs de contexte (lieu/interlocuteur): -60%
- taux fallback parser JSON: < 3%

## Risques et mitigation

1. Risque: reponse moins riche apres reduction appels.
   - Mitigation: prompt principal mieux structure + secours qualite.
2. Risque: sur-contrainte serveur qui rigidifie.
   - Mitigation: regles sur actes/mutations, pas sur mots.
3. Risque: extension outils devient complexe.
   - Mitigation: registre declaratif + adapters.

## Etat avancement implementation (MAJ 2026-02-27)

### Synthese
- Phase 1: en cours (socle contrat versionne pose, convergence serveur/module engagee).
- Phase 2: en cours (commitment transporte + premiers gates serveur actifs).
- Phase 3: partiel (arbitrage commitment applique, arbitrage mutations critiques incomplet).
- Phase 4: en cours (budget appels IA actif chat + background, 1 principal + 1 secours parametres).
- Phases 5-6-7-8: non demarrees completement (quelques briques de stats deja presentes).

### Travaux effectivement realises (code)
- Contrat IA versionne cote module narration:
  - `test-GAME-2D/narration-module/src/types.ts`
  - `test-GAME-2D/narration-module/src/MjNarrationGenerator.ts`
  - `test-GAME-2D/narration-module/src/GameNarrationAPI.ts`
- Convergence serveur sur `schemaVersion` + `commitment`:
  - `test-GAME-2D/server/narrationAiHelpers.js`
  - `test-GAME-2D/server/narrationPayloadPipeline.js`
- Gates `commitment` dans le chat handler:
  - `hypothetique` => clarification/proposition, pas de runtime.
  - `informatif` => scene_only/lore style, pas de runtime.
  - fichier: `test-GAME-2D/server/narrationChatHandler.js`
- Budget IA par tour (chat):
  - `NARRATION_AI_MAX_CALLS_PER_TURN` (defaut 2)
  - `NARRATION_AI_MAX_PRIMARY_CALLS_PER_TURN` (defaut 1)
  - `NARRATION_AI_MAX_FALLBACK_CALLS_PER_TURN` (defaut 1)
  - exposition debug `phase12.aiCallBudget`
  - fichier: `test-GAME-2D/server/narrationChatHandler.js`
- Budget IA aligne sur background tick:
  - coupe-circuit budget avant tick IA
  - stats `aiBudget` dans payload phase6
  - fichier: `test-GAME-2D/server/narrationBackgroundTickEngine.js`
- Raffinement suivi budget `primary/fallback` (chat + background):
  - ajout compteurs de blocage par bucket (`primaryBlocked`, `fallbackBlocked`)
  - exposition dans le debug chat (`phase12.aiCallBudget`)
  - exposition dans les stats background (`phase6.aiBudget`)
  - fichiers:
    - `test-GAME-2D/server/narrationChatHandler.js`
    - `test-GAME-2D/server/narrationBackgroundTickEngine.js`
- Observabilite budget IA agregee dans le pipeline payload:
  - collecte par payload de `phase12.aiCallBudget`
  - agregation session: turns, blockedRate, overBudgetRate, usage total/primary/fallback
  - exposition dans `/phase4-debug` (bloc `phase4.aiBudget`)
  - fichiers:
    - `test-GAME-2D/server/narrationPayloadPipeline.js`
    - `test-GAME-2D/server/narrationChatHandler.js`
    - `test-GAME-2D/server.js`
- Reduction validations IA redondantes (deterministe d'abord):
  - checks deterministes locaux ajoutes dans `buildAiNarrativeReplyForBranch`:
    - coherence stage (`travel_proposal` ne doit pas narrer une arrivee confirmee)
    - continuite scene (detection de hard switch explicite non annonce)
  - fallback validateurs IA rendu optionnel via:
    - `NARRATION_USE_AI_VALIDATORS=1` (sinon mode deterministe prioritaire)
  - fichier:
    - `test-GAME-2D/server/narrationChatHandler.js`
- Reduction appels IA pre-pipeline (feature flags par defaut OFF):
  - classification IA optionnelle: `NARRATION_USE_AI_CLASSIFIER=1`
  - patch IA du scene frame optionnel: `NARRATION_USE_AI_SCENE_FRAME_PATCH=1`
  - arbitration monde IA optionnelle: `NARRATION_USE_AI_WORLD_ARBITRATION=1`
  - par defaut (`0`), flux heuristique/local prioritaire pour diminuer les appels IA hors generation principale
  - exposition de ces flags dans le debug `phase12.aiFeatureFlags`
  - correction budget: quand le classifier IA est OFF, aucun appel/budget `primary` n est consomme
  - fichier:
    - `test-GAME-2D/server/narrationChatHandler.js`
- Raffinement IA optionnel (feature flag OFF par defaut):
  - `NARRATION_USE_AI_REFINE=1` active `refineMjStructuredReplyWithTools`
  - par defaut (`0`), le draft IA est utilise directement (main + lore + branches)
  - impact: reduction directe du nombre d appels IA par tour
  - exposition dans debug `phase12.aiFeatureFlags.useAiRefine`
  - fichier:
    - `test-GAME-2D/server/narrationChatHandler.js`
- Bloc `mjStructured` principal optionnel (feature flag OFF par defaut):
  - `NARRATION_USE_AI_STRUCTURED_MAIN=1` active le bloc principal `generate/refine` avant runtime
  - par defaut (`0`), ce bloc est saute pour eviter le cumul d appels IA dans le meme tour
  - impact: reduction forte des doubles appels `structured + runtime`
  - exposition dans debug `phase12.aiFeatureFlags.useAiStructuredMain`
  - fichier:
    - `test-GAME-2D/server/narrationChatHandler.js`
- Bloc `mjStructured` branch/lore optionnel (feature flags OFF par defaut):
  - `NARRATION_USE_AI_STRUCTURED_BRANCH=1` active la generation structuree dans `buildAiNarrativeReplyForBranch`
  - `NARRATION_USE_AI_STRUCTURED_LORE=1` active la generation structuree dans le flux lore
  - par defaut (`0`), fallback local/compose est prioritaire
  - impact: reduction supplementaire des appels IA hors runtime principal
  - exposition dans debug `phase12.aiFeatureFlags` (`useAiStructuredBranch`, `useAiStructuredLore`)
  - fichier:
    - `test-GAME-2D/server/narrationChatHandler.js`
- Appels IA complementaires rendus optionnels (feature flags OFF par defaut):
  - `NARRATION_USE_AI_LOCAL_MEMORY=1` (extraction memoire locale + resume IA de fenetres)
  - `NARRATION_USE_AI_PENDING_TRAVEL_ARBITRATION=1` (arbitrage IA pending-travel)
  - `NARRATION_USE_AI_RUNTIME_ELIGIBILITY=1` (eligibilite runtime IA)
  - par defaut (`0`), fallback heuristique/local pour ces etapes
  - exposition dans debug `phase12.aiFeatureFlags`
  - fichier:
    - `test-GAME-2D/server/narrationChatHandler.js`
- Convergence contrat serveur vers `schemaVersion` (phase 1):
  - ajout explicite `schemaVersion: "1.0.0"` dans le contrat normalise payload serveur
  - conservation de `version` pour retrocompat
  - fichier:
    - `test-GAME-2D/server/narrationPayloadPipeline.js`
- Nettoyage legacy runtime state (phase 8):
  - chargement runtime: fallback auto vers fichiers demo desactive par defaut
  - fallback demo possible uniquement en opt-in:
    - `NARRATION_ALLOW_DEMO_STATE_FALLBACK=1`
  - objectif: eviter les sources concurrentes d etat en prod locale
  - fichier:
    - `test-GAME-2D/server.js`
- Nettoyage legacy transitions runtime (phase 8):
  - creation d un fichier runtime primaire:
    - `test-GAME-2D/narration-module/runtime/Transitions-v1-runtime.v1.json`
  - `TransitionRepository` charge desormais ce fichier par defaut
  - fallback vers `Transitions-v1-runtime.example.json` uniquement en opt-in:
    - `NARRATION_ALLOW_EXAMPLE_TRANSITIONS_FALLBACK=1`
  - fichier:
    - `test-GAME-2D/narration-module/src/TransitionRepository.ts`
- Alignement build lore records transitions (phase 8):
  - `buildLoreRecordsFromTransitions()` lit maintenant `Transitions-v1-runtime.v1.json` en priorite
  - fallback example uniquement si `NARRATION_ALLOW_EXAMPLE_TRANSITIONS_FALLBACK=1`
  - fichier:
    - `test-GAME-2D/server.js`
- Trace explicite des fallbacks legacy (phase 8):
  - warning one-shot si fallback demo state est active (`NARRATION_ALLOW_DEMO_STATE_FALLBACK=1`)
  - warning one-shot si fallback example transitions est active (`NARRATION_ALLOW_EXAMPLE_TRANSITIONS_FALLBACK=1`)
  - warning one-shot si un fichier fallback est effectivement utilise
  - objectif: visibilite immediate en logs quand le run-time n est pas strictement sur les sources `.v1`
  - fichier:
    - `test-GAME-2D/server.js`
- Modularisation config IA partagee (phase 8):
  - extraction des budgets IA et feature flags dans un module central:
    - `test-GAME-2D/server/narrationAiConfig.js`
  - recablage des consommateurs principaux:
    - `test-GAME-2D/server/narrationChatHandler.js`
    - `test-GAME-2D/server/narrationBackgroundTickEngine.js`
  - objectif: supprimer la duplication de parsing env et preparer l extraction progressive du chat handler
- Extraction du controleur de budget IA par tour (phase 8):
  - nouveau module dedie:
    - `test-GAME-2D/server/narrationAiBudget.js`
  - `narrationChatHandler` utilise desormais ce controleur pour:
    - consommation budget `primary/fallback`
    - snapshot debug `phase12.aiCallBudget`
  - objectif: isoler la logique de budget pour simplifier le handler et faciliter la reutilisation
- Extraction policy `commitment` (phase 8):
  - nouveau module de politique de decision:
    - `test-GAME-2D/server/narrationCommitmentPolicy.js`
  - `narrationChatHandler` delegue maintenant:
    - normalisation `commitment`
    - gates `hypothetique` / `informatif`
    - forçage runtime `declaratif/volitif`
    - gate de clarification cible si eligibilite semantique refuse
  - objectif: sortir la logique de decision du handler sans changer le comportement RP
- Regle `declaratif/volitif` renforcee (phase 2):
  - en RP, `declaratif/volitif` sur action force la voie runtime (meme si director n etait pas runtime)
  - si eligibilite semantique refuse (cible non resolue), reponse clarification RP dediee (pas de mutation)
  - objectif: converger vers "action executee si cible resolue, sinon blocage RP explique"
  - fichier:
    - `test-GAME-2D/server/narrationChatHandler.js`

### Ecart principal restant vs cible
- La cible "1 appel IA principal max + 1 secours seulement si echec guard serveur" n'est pas encore completement garantie sur tous les chemins; le budget existe, mais les routes d'appel doivent encore etre simplifiees pour converger vers un flux unique.

### Journal etapes (execution continue)
1. 2026-02-27: contrat IA versionne pose cote module + debut convergence serveur.
2. 2026-02-27: `commitment` transporte et gates `hypothetique/informatif` actives dans le chat handler.
3. 2026-02-27: budget IA par tour active cote chat puis aligne cote background.
4. 2026-02-27: suivi budget affine avec detail blocages `primary/fallback` (chat + background).
5. 2026-02-27: agregation des stats budget IA dans payload pipeline + affichage `phase4-debug`.
6. 2026-02-27: validations de branche passees en mode deterministe prioritaire + fallback IA optionnel.
7. 2026-02-27: appels IA de pre-arbitrage rendus optionnels (flags OFF par defaut) pour reduire le cout/latence.
8. 2026-02-27: correction consommation budget inutile quand `NARRATION_USE_AI_CLASSIFIER=0`.
9. 2026-02-27: raffinement IA rendu optionnel via `NARRATION_USE_AI_REFINE` (OFF par defaut).
10. 2026-02-27: bloc `mjStructured` principal rendu optionnel via `NARRATION_USE_AI_STRUCTURED_MAIN` (OFF par defaut).
11. 2026-02-27: routage `declaratif/volitif` renforce + clarification cible quand la resolution semantique echoue.
12. 2026-02-27: `mjStructured` branch/lore rendu optionnel (`NARRATION_USE_AI_STRUCTURED_BRANCH`, `NARRATION_USE_AI_STRUCTURED_LORE`).
13. 2026-02-27: appels IA complementaires (local-memory, pending-travel-arbitration, runtime-eligibility) rendus optionnels OFF par defaut.
14. 2026-02-27: contrat payload serveur aligne avec `schemaVersion` (retrocompat `version` maintenue).
15. 2026-02-27: fallback runtime vers fichiers demo desactive par defaut (opt-in explicite).
16. 2026-02-27: transitions runtime basees sur fichier primaire `.v1` + fallback example en opt-in.
17. 2026-02-27: lecture des lore records transitions alignee sur runtime `.v1` (fallback example opt-in).
18. 2026-02-27: warnings one-shot ajoutes pour fallback legacy demo/example (activation + usage effectif).
19. 2026-02-27: extraction config IA partagee (budgets + feature flags) hors chat handler/background.
20. 2026-02-27: extraction du controleur budget IA par tour hors chat handler (`narrationAiBudget.js`).
21. 2026-02-27: extraction de la policy commitment hors chat handler (`narrationCommitmentPolicy.js`).

### Methode de suivi (engagement)
- A chaque etape de code livree, ce document est mis a jour dans le meme lot.
- Le suivi minimum par etape:
  - phase impactee;
  - fichiers modifies;
  - ce qui est termine;
  - ce qui reste;
  - prochaine etape immediate.
- La section `Roadmap integration (etat)` est ajustee a chaque progression significative.

## Roadmap integration (etat)

- [x] Audit problemes cout/latence et incoherences.
- [ ] Phase 1 contrat unique (en cours avance: schemaVersion/commitment converges sur une grande partie du flux).
- [ ] Phase 2 commitment semantique (en cours avance: gates `hypothetique/informatif` + routage `declaratif/volitif` renforces).
- [ ] Phase 3 arbitrage serveur mutations (partiel: arbitrages commitment en place, centralisation mutations critiques encore incomplete).
- [ ] Phase 4 budget appels + validations reduites (en cours avance: budget `primary/fallback` actif chat+background, validateurs deterministes prioritaires).
- [ ] Phase 5 registre outils extensible.
- [ ] Phase 6 extension taxonomie intentions.
- [ ] Phase 7 observabilite cout/perf (partiel avance: stats budget agreges payload/chat/background + debug phase4/phase12).
- [ ] Phase 8 nettoyage obsolescence (en cours: fallback demo/example passe en opt-in explicite + modularisation config/budget + policy commitment).

---

## Matrice implementation (Phase -> Fichiers)

### Phase 1 - Contrat unique "Intent + Reponse"
- `test-GAME-2D/server/narrationAiHelpers.js`
  - unifier sortie IA sur contrat versionne (generation + refine).
- `test-GAME-2D/server/narrationChatHandler.js`
  - consommer le contrat unique dans le flux principal RP.
- `test-GAME-2D/server/narrationPayloadPipeline.js`
  - normalisation/telemetrie du contrat unique.
- `test-GAME-2D/narration-module/src/types.ts`
  - typer le contrat versionne cote module.
- `test-GAME-2D/narration-module/src/MjNarrationGenerator.ts`
  - aligner la sortie IA avec le contrat (plus seulement `selectedIndex/reason`).
- `test-GAME-2D/narration-module/src/GameNarrationAPI.ts`
  - brancher le contrat comme point d'entree unique.

### Phase 2 - Commitment semantique
- `test-GAME-2D/server/narrationAiHelpers.js`
  - enrichir extraction semantique `commitment`.
- `test-GAME-2D/server/narrationChatHandler.js`
  - appliquer regles `declaratif/volitif/hypothetique/informatif`.
- `test-GAME-2D/narration-module/src/types.ts`
  - typer enum `commitment`.
- `test-GAME-2D/narration-module/src/GameNarrationAPI.ts`
  - converger execution selon `commitment` + cible resolue.

### Phase 3 - Arbitrage serveur mutations critiques
- `test-GAME-2D/server/narrationChatHandler.js`
  - deleguer toutes mutations sensibles au serveur.
- `test-GAME-2D/server/narrationIntentMutationEngine.js`
  - centraliser decisions de mutation monde.
- `test-GAME-2D/server/narrationPayloadPipeline.js`
  - bloquer/rendre explicite les mutations refusees.
- `test-GAME-2D/narration-module/src/CoherenceGates.ts`
  - ajouter guards lieu/interlocuteur/stage.
- `test-GAME-2D/narration-module/src/NarrativeRuntimeService.ts`
  - enforcement des guards avant persistence.

### Phase 4 - Budget appels IA + validations reduites
- `test-GAME-2D/server/narrationChatHandler.js`
  - compteur par tour + coupe-circuit budget.
- `test-GAME-2D/server/narrationAiHelpers.js`
  - retirer validations IA redondantes remplacees par checks serveur.
- `test-GAME-2D/server/narrationPayloadPipeline.js`
  - exposer depassements budget et raisons fallback.
- `test-GAME-2D/server/narrationBackgroundTickEngine.js`
  - aligner budget/appels sur tick background.

### Phase 5 - Registre outils extensible
- `test-GAME-2D/server/mjToolBus.js`
  - brancher allowlist/filtrage par registre.
- `test-GAME-2D/server/narrationAiHelpers.js`
  - mapper `intentType + commitment + contexte` -> familles outils.
- `test-GAME-2D/server/narrationChatHandler.js`
  - executer uniquement outils valides par registre.
- `test-GAME-2D/narration-module/src/types.ts`
  - typer `toolCalls` (args/retour/capacites).

### Phase 6 - Extension taxonomie intentions
- `test-GAME-2D/server/narrationAiHelpers.js`
  - etendre taxonomie intentions.
- `test-GAME-2D/server/narrationChatHandler.js`
  - router intents et contraintes associees.
- `test-GAME-2D/server/narrationIntentMutationEngine.js`
  - ajuster mappings de mutation par intent.
- `test-GAME-2D/narration-module/src/types.ts`
  - types d'intents et contraintes.

### Phase 7 - Observabilite cout/perf
- `test-GAME-2D/server/narrationPayloadPipeline.js`
  - metriques par message (appels, fallback, grounding).
- `test-GAME-2D/server/narrationBackgroundTickEngine.js`
  - stats tick/background.
- `test-GAME-2D/server/narrationApiRoutes.js`
  - exposition stats debug/API.
- `test-GAME-2D/src/ui/NarrationJournalPanel.tsx`
  - affichage debug (sans polluer RP).

### Phase 8 - Nettoyage obsolescence
- `test-GAME-2D/server.js`
  - retirer fallback runtime vers fichiers demo.
- `test-GAME-2D/narration-module/src/TransitionRepository.ts`
  - supprimer default runtime base sur example en prod.
- `test-GAME-2D/server/narrationChatHandler.js`
  - extractions modules (`intent router`, `tool orchestration`, `response composer`, `runtime gatekeeper`).
- `test-GAME-2D/server/narrationApiRoutes.js`
  - supprimer chemins concurrents de lecture etat.
