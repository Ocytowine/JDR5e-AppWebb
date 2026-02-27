# Plan Correctif Qualite RP Post E2E (v1)

Date: 2026-03-02
Perimetre: module narration (serveur + rendu MJ)
Contrainte: rester semantique (pas de hardcode par mots-cles), pas de narration meta.

## 1) Constat (preuves issues du test)

### A. Reponses generiques en boucle
- Meme reponse sur 3 tours consecutifs:
  - "Ton action fait bouger la scene..."
  - "La suite depend de ton prochain geste..."
- Contexte: apres arrivee en rue marchande, actions explicites commerce/social.

### B. Fuite de contenu interne dans le texte RP
- Sortie visible joueur:
  - "Ancre lore utilisée par quest.detectee.to.acceptee"
- Ce texte est interne (raisonnement/pipeline), pas narratif.

### C. Interactions sociales non resolues
- Tour "je rentre dans la boutique et je salue la vendeuse":
  - `interlocutor=none` en debug.
- Tour "je demande les prix":
  - aucun interlocuteur actif, aucun commerce concret.

### D. Pipeline inactif sur tours critiques
- Sur les tours "boutique/salut/prix":
  - `aiBudget: used=0`
  - `aiRouting: attempted=0`
- Donc aucun enrichissement semantique ni outil utile n'est declenche.

## 2) Causes probables dans le code (zones a corriger)

1. Fallback scene_only trop dominant
- Indices:
  - `scene-only-no-runtime-trigger` emet tres souvent.
  - points observes:
    - `test-GAME-2D/server/narrationChatHandler.js` (branches fin de handler ~3014, ~3087)
    - `test-GAME-2D/server/narrationIntentMutationEngine.js` (`scene-only-no-runtime-trigger`)

2. Templating RP contaminé par meta pipeline
- Indices:
  - texte "Ancre lore..." injecte dans reponse MJ.
  - probable source: composition fallback scene/memoire/anchors dans le handler.

3. Resolution sociale insuffisante quand l'entite est implicite
- Indices:
  - action sociale explicite, mais pas d'`activeInterlocutor`.
  - hotspots:
    - extraction interlocuteur: `extractInterlocutorFromMessage` (`server.js`)
    - decisions sociales: `narrationChatHandler.js` (zone social turn, `requiresInterlocutorInRp`)

4. Gating IA/outils trop strict sur scene_only
- Indices:
  - `used=0` / `attempted=0` alors que la scene demande une resolution locale (trouver un vendeur/prix).
  - besoin: "micro-orchestration locale" minimale sans surcout.

## 3) Objectif correctif (DoD produit)

1. Aucune phrase meta/pipeline en sortie MJ RP.
2. Sur action sociale/commerciale explicite:
- soit resolution directe credible (PNJ present + reponse),
- soit blocage RP justifie diegetiquement.
3. Continuite sociale maintenue:
- interlocuteur cree/associe puis reutilise sur les tours suivants.
4. Plus de boucle generique identique > 2 tours sur un meme contexte.
5. Budget IA respecte (pas de depassement), mais un minimum de traitement utile est autorise sur tours sociaux critiques.

## 4) Plan d'implementation precise

### Etape 1 - Pare-feu anti-meta (priorite P0)
Actions:
1. Ajouter un filtre final "RP output sanitizer" avant `sendJson` pour supprimer:
- IDs de transition (`quest.*`, `trade.*`, `*.main.auto`),
- labels techniques (`ancre lore`, `runtime`, `phase`, `guard`, `pipeline`),
- formulations internes ("sans bascule immediate", "prochain geste concret" si recyclees telles quelles).
2. Si filtre detecte une fuite:
- regenera localement une version neutre et diegetique.

Fichiers cibles:
- `test-GAME-2D/server/narrationChatHandler.js`
- (optionnel) utilitaire dedie `test-GAME-2D/server/narrationRpOutputSanitizer.js`

Critere:
- zero occurrence de termes meta dans sorties MJ sur scenario commerce/social.

### Etape 2 - Desengorger le fallback scene_only (P0)
Actions:
1. Introduire une policy "scene-only vivant":
- si intention semantique = social/trade/inspect_local et lieu public actif,
- produire une micro-scene concrete (1 detail vivant + 1 ouverture d'action), sans quete forcee.
2. Empêcher la repetition brute:
- memoriser hash des 2 dernieres sorties MJ,
- si repetition trop proche, forcer variation de formulation + element contextuel neuf.

Fichiers cibles:
- `test-GAME-2D/server/narrationChatHandler.js`
- `test-GAME-2D/server/narrationNaturalRenderer.js`

Critere:
- pas de triplet de reponse quasi identique sur 3 tours consecutifs.

### Etape 3 - Resolution sociale implicite robuste (P0)
Actions:
1. Quand message implique interaction humaine locale (saluer, demander prix, parler au marchand/vendeuse):
- tenter resolution d'un interlocuteur local depuis:
  - sceneFrame actif,
  - lieux session DB,
  - micro-profiles recentes.
2. Si aucun interlocuteur resolu:
- en creer un minimal coherent (profil micro), puis lier `activeInterlocutor`.
3. Conserver l'interlocuteur tant que le joueur reste dans la meme scene.

Fichiers cibles:
- `test-GAME-2D/server/narrationChatHandler.js`
- `test-GAME-2D/server/sessionNarrativeDb.js` (si besoin d'upsert helper)
- `test-GAME-2D/server/narrationStyleHelper.js`

Critere:
- sur "je salue la vendeuse" puis "je demande les prix", `interlocutor != none`.

### Etape 4 - Micro-orchestration semantique a cout borne (P1)
Actions:
1. Autoriser 1 tentative utile en scene_only social/trade:
- soit routeur semantique local,
- soit 1 appel IA fallback (si budget disponible) pour desambiguation courte.
2. Ne pas depasser le budget global phase4.
3. Tracer explicitement la raison si non declenche.

Fichiers cibles:
- `test-GAME-2D/server/narrationChatHandler.js`
- `test-GAME-2D/server/narrationAiRoutingController.js`

Critere:
- sur tours sociaux critiques, `attempted >= 1` ou raison de skip explicite et pertinente.

### Etape 5 - Tests de non-regression ciblés (P0)
Ajouter scripts:
1. `validate-narration-rp-quality-social.js`
- verifie:
  - absence de meta leaks,
  - interlocuteur active,
  - progression commerce coherente.
2. `validate-narration-no-repeat-sceneonly.js`
- verifie:
  - pas de duplication quasi identique 3 tours.

Package scripts:
- `validate:rp-quality`

## 5) Scenarios d'acceptation (manuel + auto)

### Scenario A - Commerce complet
1. "je me dirige vers une rue marchande"
2. "ok j'y vais"
3. "je cherche une boutique de vetement"
4. "je rentre dans la boutique et je salue la vendeuse"
5. "je demande les prix pour une tenue d'ecole de magie"

Attendus:
- aucune phrase meta.
- interlocuteur actif a partir de 4.
- reponse prix concrete a 5.

### Scenario B - Scene calme sans quete forcee
1. "je regarde autour de moi tranquillement"
2. "je marche un peu entre les etals"
3. "je continue d'observer les passants"

Attendus:
- narration vivante mais ordinaire.
- pas de runes/quetes forcees.
- variation stylistique.

## 6) Risques et garde-fous

Risque 1: trop filtrer et appauvrir le texte.
- Garde-fou: filtrer uniquement motifs techniques explicites, conserver le contenu diegetique.

Risque 2: creation automatique de PNJ incoherente.
- Garde-fou: creation minimale + liaison au lieu courant + TTL memoire.

Risque 3: hausse latence.
- Garde-fou: micro-orchestration limitee a 1 tentative utile, budget conserve.

## 7) Ordre d'execution recommande

1. Etape 1 (anti-meta)
2. Etape 3 (interlocuteur implicite)
3. Etape 2 (desengorger scene_only)
4. Etape 4 (micro-orchestration budgetee)
5. Etape 5 (tests)

## 8) Statut de ce plan

- Redige: oui
- Implante: non
- Valide: non

