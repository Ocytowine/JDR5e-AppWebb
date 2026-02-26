# Plan Stabilisation Narration Semantique v2

Objectif: fiabiliser la narration RP sans retomber dans des tunnels a mots-cles, en gardant une logique IA + outils + etat canonique coherent.

## 1) Contrat d'etape narratif (proposal vs confirmed)

Ce que je vais faire (simple):
- Introduire un `narrativeStage` dans le pipeline (`proposal`, `confirmed`, `scene`).
- Injecter ce contrat dans les prompts IA de branche.
- En `proposal`: decrire intention/ambiance/trajectoire probable, sans affirmer l'arrivee.
- En `confirmed`: autoriser l'arrivee et la description du nouveau lieu.

Pourquoi:
- Eviter les contradictions "tu es arrive" alors que `stateUpdated=false`.

Statut controle:
- Partiel.
- Deja fait: `narrativeStage` injecte dans la generation/raffinement IA (`travel_proposal`, `travel_confirmed`, `scene`).
- Reste a faire: couverture complete de toutes les branches et enforcement plus strict sur les sorties fallback.

## 2) Validateur semantique post-generation (coherence texte vs etat)

Ce que je vais faire (simple):
- Ajouter un validateur serveur qui compare la reponse RP a l'etat attendu (pending travel, etat applique ou non).
- Si incoherent: regeneration IA avec feedback de coherence.
- Si echec: fallback RP propre (jamais debug/technique).

Pourquoi:
- Eviter qu'une reponse IA passe alors qu'elle contredit le state machine.

Statut controle:
- Partiel.
- Deja fait: validateur de coherence IA branche dans le pipeline de reponse de branche.
- Reste a faire: boucle de regeneration explicite avant fallback et telemetrie dediee.

## 3) Seuil de confiance pour `detectWorldIntentWithAI`

Ce que je vais faire (simple):
- Activer un seuil de confiance (ex: variable env + valeur par defaut).
- N'accepter `propose_travel` que si confiance suffisante.
- Sinon conserver `none` et laisser la scene locale.

Pourquoi:
- Eviter les faux positifs (ex: "je cherche un vendeur" interprete en deplacement).

Statut controle:
- Fait (initial).
- Deja fait: seuil configurable (`NARRATION_WORLD_INTENT_MIN_CONFIDENCE`) avec neutralisation en dessous du seuil.
- Reste a faire: calibration du seuil en conditions reelles.

## 4) Arbitre semantique "rester sur place" vs "changer de lieu"

Ce que je vais faire (simple):
- Ajouter un petit arbitre IA (classification courte) entre:
  - `stay_and_scan`
  - `move_to_place`
- Lancer cet arbitre avant la branche travel proposal.

Pourquoi:
- Fiabiliser la direction narrative sans dependre de patterns fragiles.

Statut controle:
- Partiel.
- Deja fait: arbitre IA (`stay_and_scan`, `move_to_place`, `social_focus`, `unclear`) branche avant travel proposal.
- Reste a faire: calibration confiance + journal debug de decision.

## 5) Fallback RP contextuel (anti robot)

Ce que je vais faire (simple):
- Remplacer les fallbacks plats par des fallbacks contextuels (lieu, temps, tension, mouvement de foule).
- Garder un ton RP, sans formulations meta/techniques.

Pourquoi:
- Si l'IA renvoie un JSON incomplet, la sortie reste credible et non mecanique.

Statut controle:
- Partiel.
- Deja fait: nettoyage de plusieurs messages techniques + style helper.
- Reste a faire: fallback anti-repetition inter-tour et granularite par stage.

## 6) Verrou de personne grammaticale (tu uniquement en RP)

Ce que je vais faire (simple):
- Forcer le style "tu" dans les prompts RP.
- Ajouter une normalisation legere post-process pour corriger les sorties "vous".

Pourquoi:
- Eviter les oscillations de ton (`tu`/`vous`) qui cassent l'immersion.

Statut controle:
- Partiel.
- Deja fait: contrainte "tutoiement" ajoutee dans les prompts.
- Reste a faire: normalisation post-process pour corriger les sorties `vous`.

## 7) Memoire courte anti-repetition

Ce que je vais faire (simple):
- Conserver 2-3 formulations recentes par session/lieu.
- Interdire/reduire les structures trop proches au tour suivant.

Pourquoi:
- Eviter les refrains ("tu quittes... tu arrives...") a repetition.

Statut controle:
- Partiel.
- Deja fait: `SceneFrame` persiste dans l'etat monde (conversation.sceneFrame), avec patch IA pre-generation.
- Deja fait: `ContinuityGuard` IA branche sur les reponses de branche (validation continuite frame/reponse).
- Deja fait: mise a jour du frame via memoire locale extraite (POI/interlocuteur/faits recents).
- Reste a faire: enforcement sur toutes les branches non unifiees + boucle de regeneration avant fallback.

## 8) Options strictement ancrees scene

Ce que je vais faire (simple):
- Renforcer le filtrage d'options via entites mentionnees dans la scene.
- Bloquer les options non ancrees dans le texte/lore/session memory.

Pourquoi:
- Eviter les options fantomes (ex: "echoppe d'armes" jamais decrite).

Statut controle:
- Partiel.
- Deja fait: filtrage token-based dans le renderer.
- Reste a faire: ancrage par extraction d'entites (PNJ/lieux/objets) au lieu des seuls tokens.

## 9) Observabilite debug utile

Ce que je vais faire (simple):
- Ajouter des marqueurs debug:
  - `stageContractViolation`
  - `intentArbitrationDecision`
  - `worldIntentConfidence`
  - `regenerationCount`

Pourquoi:
- Diagnostiquer vite les derives sans polluer le canal RP.

Statut controle:
- Partiel.
- Deja fait: reason internes plus riches sur certaines decisions.
- Reste a faire: champs dedies (`stageContractViolation`, `intentArbitrationDecision`, `worldIntentConfidence`, `regenerationCount`).

## 10) Fin du tronquage RP (texte complet en sortie joueur)

Ce que je vais faire (simple):
- Supprimer les coupes agressives (`oneLine`) sur les blocs RP envoyes au joueur.
- Conserver le clipping uniquement pour logs/debug et protections anti-payload.
- Ajuster le renderer pour privilegier le texte complet RP.

Pourquoi:
- Eviter les reponses coupees en plein milieu qui cassent la narration.

Statut controle:
- Partiel.
- Deja fait: suppression du clipping principal sur les blocs RP (`scene`, `actionResult`, `consequences`) dans le renderer et les assemblages de branche.
- Reste a faire: verification UI complete et revue finale des derniers points de troncature hors canal debug.

## 11) Modele spatial macro/micro (lieu courant vs points locaux visibles)

Ce que je vais faire (simple):
- Introduire une distinction:
  - Macro: `location` (quartier/zone)
  - Micro: `poi` (boutique, etal, entree, atelier dans la zone courante)
- Router semantiquement:
  - cible micro du lieu courant => action locale (pas travel)
  - cible macro externe => travel proposal/confirm.
- Rendre l'estimation de deplacement coherente selon distance relative (micro, adjacent, distant).

Pourquoi:
- Eviter les incoherences du type "4 minutes vers une boutique visible" et les "tu envisages..." sur des actions directes.

Statut controle:
- Partiel.
- Deja fait: debut de memoire locale exploitable (places/npc/facts) + TTL + lecture `scene-memory` contextualisee.
- Deja fait: resolution spatiale semantique IA (`local_poi/current_location/external_place`) pour reduire les faux `travel-proposed`.
- Reste a faire: structuration explicite `location` (macro) + `poi` (micro) dans le world state et routage complet des actions "entrer/parler" vers des actions locales.

## 12) Continuite de scene inter-tour (anti-glissement global)

Ce que je vais faire (simple):
- Introduire un `SceneFrame` canonique par tour:
  - `currentLocation`, `activePoi`, `activeInterlocutor`, `activeTopic`, `recentFacts`.
- Ajouter un `FrameResolver` IA qui produit un patch minimal de contexte avant generation.
- Ajouter un `ContinuityGuard` qui bloque/repare les derives non justifiees entre tours.
- Persister automatiquement `activeInterlocutor` et `activePoi` pendant la conversation locale.
- Ajouter la continuite d'objet/topic en dialogue (ex: "tenue ecole de magie" puis "prix" sur le meme sujet).
- Remplacer les fallbacks generiques quand un frame social/poi est actif.

Pourquoi:
- Eviter les glissements de narration:
  - boutique -> etal,
  - vendeuse -> marchand,
  - perte du lieu/focus entre deux messages consecutifs.

Statut controle:
- Partiel.
- Deja fait: `SceneFrame` persiste dans l'etat monde (`conversation.sceneFrame`) avec sanitization au chargement/sauvegarde.
- Deja fait: `FrameResolver` IA branche avant generation (`resolveSceneFramePatchWithAI`) avec patch minimal et seuil de confiance.
- Deja fait: `ContinuityGuard` IA post-generation (`validateSceneFrameContinuityWithAI`) branche dans la generation de reponse.
- Deja fait: enrichissement memoire locale (`placesDiscovered`, `sessionNpcs`, `establishedFacts`) avec scope `scene-memory` et TTL.
- Deja fait: enforcement de continuite sur les branches IA avec regeneration controlee puis fallback ancre `SceneFrame` en dernier recours.
- Deja fait: telemetry debug dediee `phase12` (frameBefore/framePatch/frameAfter, `anchorDriftDetected`, `stageContractViolation`, `regenerationCount`, arbitration/confidence).
- Reste a faire: continuites de topic transactionnel plus strictes sur certains cas de dialogue long.

---

## Integration avec le module actuel

### Points d'integration principaux
- Pipeline chat narratif:
  - `test-GAME-2D/server/narrationChatHandler.js`
- Aides IA / prompts / detection d'intent:
  - `test-GAME-2D/server/narrationAiHelpers.js`
- Rendu naturel/fallback/options:
  - `test-GAME-2D/server/narrationNaturalRenderer.js`
  - `test-GAME-2D/server/narrationStyleHelper.js`
- Orchestration globale:
  - `test-GAME-2D/server.js`
- Canal debug + payload:
  - `test-GAME-2D/server/narrationPayloadPipeline.js`
- UI debug journal (verification only):
  - `test-GAME-2D/src/ui/NarrationJournalPanel.tsx`

### Conflits de fonctionnement possibles
- Conflit "proposal vs confirmed":
  - Si les contrats d'etape ne sont pas appliques partout, une branche peut encore narrer une arrivee sans `applyTravel`.
- Conflit seuil de confiance:
  - Un seuil trop haut peut bloquer des deplacements legitimes.
- Conflit anti-repetition:
  - Si trop agressif, risque de reponses artificiellement variees mais moins precises.
- Conflit filtrage options:
  - Filtre trop strict = plus d'options utiles affichees.
- Conflit perf/latence:
  - Arbitre IA + regeneration peuvent ajouter du temps de reponse.

### Mitigations prevues
- Feature flags / seuils config via env.
- Fallbacks progressifs (degrader proprement sans bloquer).
- Telemetrie debug pour ajustement fin apres tests.

---

## Roadmap integration (fait / pas fait controle)

1. Contrat d'etape narratif
- Statut: Partiel
- Livrable: `narrativeStage` transporte dans le pipeline + prompts contraints.

2. Validateur coherence texte/etat
- Statut: Partiel
- Livrable: garde central + regeneration IA conditionnelle.

3. Seuil de confiance world intent
- Statut: Fait (initial)
- Livrable: seuil configurable + fallback `none`.

4. Arbitre stay vs move
- Statut: Partiel
- Livrable: classifieur IA court avant branche travel.

5. Fallback RP contextuel
- Statut: Partiel
- Livrable restant: anti-repetition et fallback par stage.

6. Verrou "tu"
- Statut: Partiel
- Livrable: contrainte prompt + normalisation sortie.

7. Memoire courte anti-repetition
- Statut: Pas fait
- Livrable: buffer recent + penalisation des structures proches.

8. Options ancrees entites
- Statut: Partiel
- Livrable restant: extraction entites scene + filtrage semantique.

9. Observabilite debug
- Statut: Partiel
- Livrable: nouveaux champs debug + verification UI.

10. Fin du tronquage RP
- Statut: Partiel
- Livrable: suppression clipping RP joueur + clipping reserve debug.

11. Modele spatial macro/micro
- Statut: Partiel
- Livrable: routage semantique local vs deplacement + ETA contextuelle.

12. Continuite de scene inter-tour
- Statut: Partiel
- Livrable: `SceneFrame` + `FrameResolver` + `ContinuityGuard` + persistance POI/PNJ/topic + debug continuite.

13. Memoire conversationnelle fenetree (tour -> resume)
- Statut: Partiel
- Livrable: fenetre courte (jour RP / long-rest), compactage IA, purge du fil brut ancien, conservation des resumes.

14. Minimalisme narratif contextuel
- Statut: Partiel
- Livrable: reduction des descriptions decor/meteo redondantes; decrire seulement en cas de changement notable.

15. Observabilite detaillee UI (raisonnement outille + DB)
- Statut: Partiel
- Livrable: mode detail montrant decisions semantiques, operations DB read/write, etat memoire (sans polluer la narration RP).

---

## Etat actuel synthetique

Deja integre:
- Detection world intent IA (sans mots-cles stricts) en place.
- Branches travel propose/confirm passees en IA+outils avec fallback.
- Nettoyage d'une partie des textes techniques hors RP.
- Filtrage initial d'options non ancrees (token-based).
- Contrat d'etape narratif (partiel) dans prompts de generation/raffinement.
- Validateur de coherence texte/etat (partiel) branche dans les reponses de branche.
- Arbitre semantique stay/move (partiel) avant travel proposal.
- Seuil de confiance world intent (initial) actif.

Encore manquant pour stabilisation complete:
- Enforcement complet des contrats d'etape sur toutes branches et fallback.
- Suppression du tronquage RP cote joueur.
- Modele spatial macro/micro complet + ETA coherent avec visibilite/proximite.
- Continuite de scene inter-tour (lieu/poi/pnj/topic) sans glissement.
- Anti-repetition robuste + verrou post-process de voix (`tu`) + debug de pilotage.

---

## Plan detaille correctif continuite (12)

1) SceneFrame canonique
- Construire/maintenir un frame de scene courant dans l'etat de session:
  - location macro,
  - poi actif,
  - interlocuteur actif,
  - topic actif,
  - faits recents.

2) FrameResolver IA (patch minimal)
- Avant generation MJ, demander a l'IA une mise a jour minimale du frame.
- Interdire les sauts de contexte non motives.

3) ContinuityGuard post-generation
- Comparer reponse MJ vs frame actif.
- Si derive non justifiee:
  - regeneration contrainte,
  - puis fallback ancre frame si besoin.

4) Persistance sociale/POI
- Si interaction sociale: interlocuteur actif obligatoire jusqu'a cloture semantique.
- Si POI visible/actif: priorite POI local sur deplacement externe.

5) Continuite du topic transactionnel
- Conserver l'objet/focus discute (ex: tenue mage).
- Les tours suivants s'ancrent dessus sauf changement explicite.

6) Fallback dialogue-aware
- En frame social/poi actif, bannir les formulations generiques de decor.
- Utiliser des fallback de dialogue relies au frame.

7) Observabilite continuite
- Ajouter debug:
  - `frameBefore`,
  - `framePatch`,
  - `frameAfter`,
  - `continuityGuard`,
  - `anchorDriftDetected`.

---

## Plan detaille memoire et observabilite (13-15)

1) Fenetre memoire active
- Introduire `conversation.memory` dans le world state:
  - `windowMode` (`day` / `long_rest`),
  - `activeWindowKey`,
  - `turns` (fil brut recent),
  - `summaries` (memoire compacte),
  - `maxTurns` / `keepTurns`.

2) Compactage IA
- Quand fenetre change ou capacite depassee:
  - resumer les tours anciens via IA,
  - stocker un resume canonique (+ faits / fils ouverts),
  - purger le fil brut ancien.

3) Memoire locale a interet dynamique
- Pour PNJ/POI:
  - `interestScore`, `interactionCount`, `ttlGameHours`, `expiresAtGameMin`.
- Renforcement par interactions repetees; decay avec le temps in-game.

4) Minimalisme narratif
- Supprimer les lignes decoratives par defaut.
- N'afficher decor/meteo/ambiance que si changement de lieu/etat notable.

5) UI mode detail
- Ajouter dans details:
  - decisions semantiques (`phase12`),
  - compactage memoire (fenetre active, resumes, compactage),
  - operations DB write/read issues des traces outils.
