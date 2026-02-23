# Cas 004 — Tickets techniques prêts à coder (Phase A/B)

## Objectif
Permettre un compagnon PNJC allié, issu d’une sauvegarde Character Creator, piloté IA, avec lien joueur et directives de communication reliées aux sens.

## Convention
- Priorité: `P0` à `P2`
- Effort: `S` / `M` / `L`
- DoD: definition of done

## Paramètres MVP verrouillés
- Curseur lien: `0..100`.
- Directives de communication MVP: `5` (`target_priority`, `cover`, `stealth`, `fallback`, `hold`).
- Anti-spam communication: `1` directive explicite par tour joueur (par compagnon).

## Phase A — Compagnon jouable en bataille (piloté IA)

### T401 — Flag sauvegarde compagnon
- Priorité: `P0`
- Effort: `S`
- Objectif: marquer une sauvegarde Character Creator comme compagnon potentiel
- Fichiers cibles:
  - `src/PlayerCharacterCreator/*`
  - `src/data/models/*` (si schéma de sauvegarde)
- Détails:
  - Ajouter `isCompanionCandidate` ou équivalent
  - Persister ce statut dans la sauvegarde
- DoD:
  - Une sauvegarde peut être identifiée comme compagnon sans casser les sauvegardes existantes

### T402 — Import compagnon en setup combat
- Priorité: `P0`
- Effort: `M`
- Objectif: injecter une sauvegarde compagnon dans la bataille
- Fichiers cibles:
  - `src/GameBoard.tsx`
  - `src/PlayerCharacterCreator/CombatSetupScreen.tsx`
- Détails:
  - Sélecteur de compagnon en mode test
  - Spawn en faction alliée
- DoD:
  - Compagnon présent en combat au démarrage

### T403 — Profil compagnon runtime
- Priorité: `P0`
- Effort: `M`
- Objectif: ajouter `companionProfile` (motivations, persona tactique, lien)
- Fichiers cibles:
  - `src/game/actors/types.ts` (ou `src/types.ts` selon migration Cas 003)
  - `src/GameBoard.tsx`
- Détails:
  - Structurer `motivations`, `tacticalPersona`, `bondScore`
  - Initialisation depuis sauvegarde (fallbacks)
- DoD:
  - Profil accessible en runtime IA

### T404 — Boucle IA compagnon basique
- Priorité: `P0`
- Effort: `M`
- Objectif: faire agir le compagnon automatiquement côté allié
- Fichiers cibles:
  - `src/GameBoard.tsx`
  - `src/game/engine/runtime/*` (si extraction logique)
- Détails:
  - Tour compagnon intégré à l’ordre d’initiative
  - Comportement de base: suivre/protéger/attaquer selon contexte simple
- DoD:
  - Compagnon agit de manière stable sur plusieurs rounds

### T405 — Journal d’événements compagnon
- Priorité: `P1`
- Effort: `S`
- Objectif: rendre lisibles les décisions IA compagnon
- Fichiers cibles:
  - `src/narrationClient.ts`
  - `src/narrationTypes.ts`
  - `src/GameBoard.tsx`
- Détails:
  - Logs: ordre reçu, ordre accepté/refusé, action exécutée
- DoD:
  - Débogage compagnon possible sans inspection profonde du code

## Phase B — Lien et comportement relationnel

### T406 — Curseur lien joueur-compagnon
- Priorité: `P0`
- Effort: `S`
- Objectif: exposer le niveau de lien en UI
- Fichiers cibles:
  - `src/PlayerCharacterCreator/*` ou UI setup combat
  - `src/ui/*` (si panneau dédié)
- Détails:
  - Curseur + valeur affichée
  - Persistance de la valeur
- DoD:
  - Valeur modifiable avant combat et lue en runtime

### T407 — Modèle de décision IA influencé par lien
- Priorité: `P0`
- Effort: `M`
- Objectif: pondérer obéissance/protection/risque selon lien
- Fichiers cibles:
  - `src/GameBoard.tsx`
  - `src/game/engine/runtime/*`
- Détails:
  - Heuristiques minimales:
    - lien haut => protège/coopère davantage
    - lien bas => autonomie plus marquée, obéissance plus faible
- DoD:
  - Variation de comportement observable à lien faible vs élevé

### T408 — Sous-menu “Communiquer” dans la roue d’action
- Priorité: `P0`
- Effort: `M`
- Objectif: permettre de donner des directives au compagnon
- Fichiers cibles:
  - `src/ui/ActionWheelMenu.tsx`
  - `src/GameBoard.tsx`
- Détails:
  - Ajouter commandes MVP
  - Associer chaque commande à un `CompanionDirective`
- DoD:
  - Joueur peut envoyer une directive pendant son tour

### T409 — Communication sonore branchée perception
- Priorité: `P0`
- Effort: `M`
- Objectif: chaque communication émet un signal bruit (`NoiseEvent`)
- Fichiers cibles:
  - `src/game/engine/runtime/perception/*` (Cas 001)
  - `src/GameBoard.tsx`
- Détails:
  - Intensité de bruit configurable par type de directive
  - Détection par autres créatures selon leurs sens
- DoD:
  - Une communication peut être détectée en conditions favorables

### T410 — Réponses compagnon (accept/refus/adaptation)
- Priorité: `P1`
- Effort: `M`
- Objectif: expliciter la liberté IA compagnon
- Fichiers cibles:
  - `src/narrationClient.ts`
  - `src/narrationTypes.ts`
  - `src/GameBoard.tsx`
- Détails:
  - Retour court: “j’exécute”, “je refuse”, “je propose X”
  - Raison contextualisée (danger, motivation, lien)
- DoD:
  - Feedback joueur clair à chaque directive majeure

## Ordre conseillé d’exécution
1. `T401`
2. `T402`
3. `T403`
4. `T404`
5. `T406`
6. `T407`
7. `T408`
8. `T409`
9. `T405`
10. `T410`

## Dépendances explicites
- Cas 003 (`ActorSheet`) recommandé pour éviter duplication de modèle compagnon.
- Cas 001 requis pour `T409` (bruit/perception).
- Narration IA utilisée pour feedback des ordres (`T410`).

## Critères Go/No-Go MVP
- Go A: un compagnon issu d’une sauvegarde agit en bataille comme allié IA.
- Go B: le lien modifie concrètement son comportement.
- Go C: le joueur peut communiquer une directive depuis la roue, avec impact sonore détectable.
