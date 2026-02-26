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
- Pas fait.

## 2) Validateur semantique post-generation (coherence texte vs etat)

Ce que je vais faire (simple):
- Ajouter un validateur serveur qui compare la reponse RP a l'etat attendu (pending travel, etat applique ou non).
- Si incoherent: regeneration IA avec feedback de coherence.
- Si echec: fallback RP propre (jamais debug/technique).

Pourquoi:
- Eviter qu'une reponse IA passe alors qu'elle contredit le state machine.

Statut controle:
- Pas fait.

## 3) Seuil de confiance pour `detectWorldIntentWithAI`

Ce que je vais faire (simple):
- Activer un seuil de confiance (ex: variable env + valeur par defaut).
- N'accepter `propose_travel` que si confiance suffisante.
- Sinon conserver `none` et laisser la scene locale.

Pourquoi:
- Eviter les faux positifs (ex: "je cherche un vendeur" interprete en deplacement).

Statut controle:
- Pas fait.

## 4) Arbitre semantique "rester sur place" vs "changer de lieu"

Ce que je vais faire (simple):
- Ajouter un petit arbitre IA (classification courte) entre:
  - `stay_and_scan`
  - `move_to_place`
- Lancer cet arbitre avant la branche travel proposal.

Pourquoi:
- Fiabiliser la direction narrative sans dependre de patterns fragiles.

Statut controle:
- Pas fait.

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
- Pas fait.

## 7) Memoire courte anti-repetition

Ce que je vais faire (simple):
- Conserver 2-3 formulations recentes par session/lieu.
- Interdire/reduire les structures trop proches au tour suivant.

Pourquoi:
- Eviter les refrains ("tu quittes... tu arrives...") a repetition.

Statut controle:
- Pas fait.

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
- Pas fait.

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
- Statut: Pas fait
- Livrable: `narrativeStage` transporte dans le pipeline + prompts contraints.

2. Validateur coherence texte/etat
- Statut: Pas fait
- Livrable: garde central + regeneration IA conditionnelle.

3. Seuil de confiance world intent
- Statut: Pas fait
- Livrable: seuil configurable + fallback `none`.

4. Arbitre stay vs move
- Statut: Pas fait
- Livrable: classifieur IA court avant branche travel.

5. Fallback RP contextuel
- Statut: Partiel
- Livrable restant: anti-repetition et fallback par stage.

6. Verrou "tu"
- Statut: Pas fait
- Livrable: contrainte prompt + normalisation sortie.

7. Memoire courte anti-repetition
- Statut: Pas fait
- Livrable: buffer recent + penalisation des structures proches.

8. Options ancrees entites
- Statut: Partiel
- Livrable restant: extraction entites scene + filtrage semantique.

9. Observabilite debug
- Statut: Pas fait
- Livrable: nouveaux champs debug + verification UI.

---

## Etat actuel synthetique

Deja integre:
- Detection world intent IA (sans mots-cles stricts) en place.
- Branches travel propose/confirm passees en IA+outils avec fallback.
- Nettoyage d'une partie des textes techniques hors RP.
- Filtrage initial d'options non ancrees (token-based).

Encore manquant pour stabilisation complete:
- Contrat d'etape strict + validateur coherence etat/texte.
- Arbitrage semantique stay/move + seuils de confiance.
- Anti-repetition robuste + verrou de voix (`tu`) + debug de pilotage.
