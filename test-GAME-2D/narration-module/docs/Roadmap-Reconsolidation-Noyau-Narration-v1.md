# Roadmap Reconsolidation Noyau Narration v1

## Reference

Cette roadmap s'appuie sur :

- [Plan-Refonte-Intention-Situee-Et-Continuite-v1.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Plan-Refonte-Intention-Situee-Et-Continuite-v1.md)
- [Audit-Reconsolidation-Plan-v1.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Audit-Reconsolidation-Plan-v1.md)
- [Scenario-Reference-01-Archives-Et-Scriptorium-v1.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Scenario-Reference-01-Archives-Et-Scriptorium-v1.md)
- [Scenario-Reference-02.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Scenario-Reference-02.md)
- [Cadre-Familles-Outils-Narration-v1.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Cadre-Familles-Outils-Narration-v1.md)

## Document de pilotage actif

Cette roadmap devient la reference principale de pilotage pour la reprise du module narration.

Elle remplace les suivis disperses ou les roadmaps intermediaires anterieures comme document de travail actif.

Note importante :

- l'ancienne roadmap d'implementation precedente n'est plus presente dans le workspace comme reference exploitable,
- on ne maintient donc pas un double suivi,
- cette roadmap sert de point unique pour la reconsolidation du noyau.

## Objectif concret

Reprendre le module narration sur un noyau plus propre, plus lisible et plus extensible.

Le premier objectif concret n'est pas "ajouter une nouvelle mecanique".

Le premier objectif concret est :

- atteindre de facon fiable le comportement attendu du scenario de reference 1,
- sans phrases de moteur visibles,
- sans reinitialisation abusive de scene,
- sans dependre de formulations trop etroites.

Une fois ce socle atteint :

- le scenario 2 servira a ouvrir des branches plus lourdes,
- puis les familles d'outils majeures seront branchees sur un noyau deja clarifie.

## Regle de travail

Cette roadmap doit etre suivie dans l'ordre.

On ne coche pas une etape parce qu'un cas a ete debloque.

On coche une etape seulement si :

- le code est en place,
- le comportement est visible sur test reel,
- et il ne contredit pas la philosophie semantique du plan.

Statuts a utiliser :

- `[ ]` non commence
- `[-]` en cours
- `[x]` termine

## Format obligatoire des prochains comptes rendus

Pour chaque prochaine passe, le compte rendu doit afficher explicitement :

1. la section du plan visee
2. la phase de cette roadmap visee
3. le type de changement :
   - `noyau`
   - `heuristique de secours`
   - `preparation d'outil`
4. le verdict d'alignement :
   - `aligne`
   - `partiel`
   - `hors cible`

But :

- eviter les derives de plan,
- eviter les correctifs non recales,
- garder une lecture constante de l'objectif.

## Principe directeur de la reprise

La reprise du chantier doit separer clairement :

1. ce qui releve du noyau narratif general,
2. ce qui releve de heuristiques temporaires de secours,
3. ce qui relevera plus tard d'une famille d'outil dediee.

Le noyau doit devenir capable de decider, pour chaque tour :

- soit une resolution locale libre,
- soit une bascule vers une famille de mecanique outillee.

## Phase 0 - Figer le cadre avant toute nouvelle refonte

But :

S'assurer que toute la suite se cale sur une reference unique et non sur des correctifs opportunistes.

### Taches

- [x] Declarer explicitement cette roadmap comme document de pilotage principal
- [x] Relier cette roadmap a la roadmap precedente pour eviter les suivis paralleles contradictoires
- [x] Marquer dans les prochains comptes rendus :
  - la section du plan visee
  - la phase de cette roadmap visee
  - le type de changement :
    - noyau
    - heuristique de secours
    - preparation d'outil

### Critere de validation

- [x] Le suivi du chantier n'emploie plus plusieurs axes de pilotage non relies entre eux

### Statut phase

- [x] Termine

## Phase 1 - Cartographier les responsabilites du noyau

But :

Rendre explicite ce qui decide quoi aujourd'hui, pour ensuite simplifier sans casser l'existant utile.

### Taches

- [x] Lister les fonctions qui produisent encore une reponse narrative directe :
  - `buildVisitAdvisoryReply(...)`
  - `buildLocateAdvisoryReply(...)`
  - `buildDirectorNoRuntimeReply(...)`
  - `maybeBuildShopOfferReply(...)`
  - `maybeBuildAnchoredInterlocutorReply(...)`
- [x] Lister les fonctions qui modifient l'interpretation du tour :
  - `classifyNarrationIntent(...)`
  - `extractLocateIntent(...)`
  - `extractVisitIntent(...)`
  - `narrationCommitmentPolicy.js`
- [x] Distinguer ce qui releve :
  - de l'interpretation,
  - de la resolution,
  - du rendu RP,
  - du nettoyage de sortie
- [x] Isoler les heuristiques qui existent seulement pour boucher des trous

### Critere de validation

- [x] Une carte simple des responsabilites existe dans les docs
- [x] On peut dire clairement quelle couche decide :
  - l'acte
  - la cible
  - la suite logique
  - le texte final

### Statut phase

- [x] Termine

## Phase 2 - Definir la structure minimale d'acte situe

But :

Introduire une structure intermediaire unique pour lire un tour a partir :

- du message,
- du contexte,
- des ancres,
- des faits recents.

### Taches

- [x] Definir une structure minimale du type :
  - `actType`
  - `targetKind`
  - `targetRef`
  - `objectRef`
  - `sceneLink`
  - `engagement`
  - `expectedNextStep`
  - `resolutionMode`
- [x] Definir la signification exacte de `sceneLink` :
  - nouveau sujet
  - continuation
  - confirmation
  - selection
  - precision
  - relance
  - refus
- [x] Definir la signification exacte de `resolutionMode` :
  - `local_free`
  - `tool_family`
  - `unclear`
- [x] Decider ce qui peut etre calcule au debut avec l'existant
- [x] Marquer explicitement ce qui reste encore heuristique et provisoire

### Critere de validation

- [x] Le format d'acte situe est defini dans un document et compris sans ambiguite
- [x] Il est assez petit pour etre branche sans refondre tout le handler d'un coup

### Statut phase

- [x] Termine

## Phase 3 - Calculer l'acte situe sans casser l'existant

But :

Faire calculer cette structure dans le pipeline reel, avant les grandes branches de reponse.

### Taches

- [x] Introduire un calcul unique d'acte situe au debut du traitement RP
- [x] Alimenter ce calcul avec :
  - message joueur
  - `sceneFrame`
  - `activeInterlocutor`
  - `activeLocation`
  - `lastSceneFact`
  - `lastPlayerFocus`
  - `lastPresentedItems`
  - proposition en attente si presente
- [x] Reutiliser l'existant comme indices secondaires, pas comme moteur principal
- [x] Conserver temporairement les branches actuelles, mais les faire lire cette nouvelle structure

### Critere de validation

- [x] Chaque tour RP dispose d'un "acte situe" observable en debug
- [x] Le calcul d'acte situe existe sans encore modifier massivement le rendu

### Statut phase

- [x] Termine

## Phase 4 - Ajouter la decision de regime de resolution

But :

Faire trancher le noyau entre :

- resolution locale libre
- bascule vers une famille de mecanique outillee

### Taches

- [x] Ajouter une decision centrale de regime de resolution
- [x] Definir les premiers cas qui restent en `local_free` :
  - observation
  - orientation simple
  - dialogue simple
  - deplacement proche
  - selection d'un element deja presente
- [x] Definir les premiers cas qui pourront plus tard basculer en `tool_family` :
  - voyage
  - repos
  - compagnons
  - perception sociale / statut
- [x] Pour l'instant, laisser ces familles futures en simple marquage, sans encore les implementer
- [x] Eviter qu'une branche libre essaie de simuler une mecanique lourde sans outil

### Critere de validation

- [x] Le noyau sait dire "je resols localement" ou "ce cas releve d'une famille d'outil"
- [x] Cette decision est visible en debug et n'apparait pas en RP

### Statut phase

- [x] Termine

## Phase 5 - Rebrancher les cas deja debloques sur l'acte situe

But :

Arreter les corrections par couloirs separes et faire lire les cas deja traites par la nouvelle couche.

### Taches

- [-] Rebrancher l'observation locale (`que vois-je ?`) sur l'acte situe
- [-] Rebrancher l'orientation locale (`c'est ou ?`) sur l'acte situe
- [-] Rebrancher la confirmation de proposition active (`j'y vais`, `oui`) sur l'acte situe
- [-] Rebrancher la selection d'un element deja presente (`je choisis ...`) sur l'acte situe
- [-] Rebrancher la question sur un interlocuteur etabli (`je lui demande ...`) sur l'acte situe
- [ ] Conserver temporairement les heuristiques existantes comme filets de secours tant que le rebranchement n'est pas stable

### Critere de validation

- [ ] Ces cas passent d'abord par l'acte situe, puis par leur resolution
- [ ] Les anciennes heuristiques ne sont plus la voie principale

### Statut phase

- [-] En cours

## Phase 6 - Generaliser les ancres de scene

But :

Sortir d'un usage des ancres limite au commerce et rendre l'etat de scene utile dans plusieurs contextes.

### Taches

- [-] Stabiliser le schema minimal d'ancres :
  - `activeLocation`
  - `activePoi`
  - `activeInterlocutor`
  - `activeTopic`
  - `lastSceneFact`
  - `lastPlayerFocus`
  - `lastPendingChoice`
  - `lastPresentedItems`
- [-] Introduire une structure plus generale de "faits recents"
- [-] Faire alimenter ces ancres par :
  - observation focalisee
  - interaction PNJ
  - proposition de deplacement
  - choix local
- [ ] Definir une duree de vie simple de la memoire courte
- [ ] Definir un premier comportement d'oubli / compactage

### Critere de validation

- [ ] Le moteur ne repart plus de zero a chaque tour dans une scene stable
- [ ] Les ancres servent a autre chose qu'au seul commerce

### Statut phase

- [-] En cours

## Phase 7 - Assainir les fallbacks et supprimer les doublons

But :

Reduire les grosses branches "attrape-tout" qui masquent la logique de scene.

### Taches

- [ ] Reduire le role de `buildDirectorNoRuntimeReply(...)`
- [ ] Limiter `maybeBuildAnchoredInterlocutorReply(...)` a un vrai filet de securite
- [ ] Extraire ce qui est du rendu RP hors des branches qui devraient surtout resoudre
- [ ] Identifier ce qui doit rester dans le sanitizer et ce qui doit etre corrige a la source
- [ ] Supprimer ou fusionner les formulations redondantes entre :
  - visit
  - locate
  - fallback scene_only
  - fallback social

### Critere de validation

- [ ] Le rendu RP depend moins de gros fallbacks vernis
- [ ] Le sanitizer ne cache plus des problemes structurels majeurs

### Statut phase

- [ ] Non commence

## Phase 8 - Atteindre le scenario de reference 1

But :

Valider que le noyau reconsolide permet enfin de tenir proprement le scenario 1 sur toute sa duree.

### Taches

- [ ] Jouer le scenario 1 complet sur test reel
- [ ] Verifier la tenue sur les 10 tours :
  - observation
  - focalisation
  - question locale
  - deplacement proche
  - introduction du scribe
  - demande d'information
  - precision
  - attente
  - reprise
  - cloture sobre
- [ ] Corriger uniquement ce qui empeche d'atteindre le comportement cible
- [ ] Refuser tout patch local qui n'ameliore que le scenario 1 au prix du reste

### Critere de validation

- [ ] Le scenario 1 est atteint de facon credible sur plusieurs essais
- [ ] Le MJ suit la scene sans phrases techniques visibles
- [ ] Le MJ ne redescrit pas tout a chaque tour
- [ ] Le scribe reste coherent sur toute la scene

### Statut phase

- [ ] Non commence

## Phase 9 - Preparer l'ouverture vers le scenario 2

But :

Une fois le scenario 1 tenu, preparer les regimes de bascule du scenario 2 sans encore tout implementer.

### Taches

- [ ] Verifier que le noyau peut deja reconnaitre les grandes branches de bascule :
  - `event interest`
  - `orientation locale liee au lore`
  - `voyage`
  - `multiPNJs`
  - `test de competence`
  - `tentative d'action`
  - `trames`
- [ ] Distinguer, pour chaque branche :
  - ce qui reste dans le noyau
  - ce qui demandera un outil de famille
- [ ] Choisir la premiere famille d'outil a brancher apres reconsolidation

### Critere de validation

- [ ] Le scenario 2 sert de grille de lecture des prochaines extensions
- [ ] On sait quelles branches seront traitees par le noyau et lesquelles seront outillees

### Statut phase

- [ ] Non commence

## Phase 10 - Ouvrir la premiere famille d'outil hors commerce

But :

Apres reconsolidation, brancher une grande mecanique sur un socle propre.

### Taches

- [ ] Prioriser l'outil `voyage` comme premiere famille hors commerce
- [ ] Definir son contrat minimal :
  - resultat brut
  - faits de scene
  - contraintes
  - debug separe
- [ ] Le brancher via la decision de regime de resolution
- [ ] Verifier qu'il n'introduit pas un nouveau sous-moteur parallele

### Critere de validation

- [ ] Le voyage est gere comme une vraie famille outillee
- [ ] Le noyau reste lisible

### Statut phase

- [ ] Non commence

## Jalons de validation globaux

### Jalon A - Noyau clarifie

Atteint quand :

- [ ] le calcul d'acte situe existe
- [ ] la decision de regime de resolution existe
- [ ] les grandes responsabilites sont lisibles

### Jalon B - Scene continue credible

Atteint quand :

- [ ] le scenario 1 est tenu correctement
- [ ] les fallbacks ne dominent plus le rendu
- [ ] les ancres de scene sont generalisees

### Jalon C - Noyau extensible

Atteint quand :

- [ ] le scenario 2 sert de grille de bascule
- [ ] la premiere famille d'outil hors commerce peut etre branchee sans recreer du code specialise partout

## Resume de pilotage

Ordre strict recommande :

1. Figer le cadre
2. Cartographier les responsabilites
3. Definir l'acte situe
4. Le calculer
5. Ajouter la decision de regime
6. Rebrancher les cas deja debloques
7. Generaliser les ancres
8. Assainir les fallbacks
9. Atteindre le scenario 1
10. Ouvrir ensuite le scenario 2 et la premiere famille d'outil majeure

## Statut global

- Roadmap de reprise propre : active
- A utiliser comme document principal de pilotage pour la reconsolidation du noyau
