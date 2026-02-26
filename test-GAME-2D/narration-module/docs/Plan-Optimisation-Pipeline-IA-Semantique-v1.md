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

## Phase 1 - Contrat unique "Intent + Reponse" (fondation)

### But
Remplacer les passes IA multiples par un contrat unique standard.

### A faire
1. Definir un schema JSON unique de sortie IA:
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

## Roadmap integration (etat)

- [x] Audit problemes cout/latence et incoherences.
- [ ] Phase 1 contrat unique.
- [ ] Phase 2 commitment semantique.
- [ ] Phase 3 arbitrage serveur mutations.
- [ ] Phase 4 budget appels + validations reduites.
- [ ] Phase 5 registre outils extensible.
- [ ] Phase 6 extension taxonomie intentions.
- [ ] Phase 7 observabilite cout/perf.
- [ ] Phase 8 nettoyage obsolescence.

