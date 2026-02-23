# Cas 001 — Tickets techniques prêts à coder (Phase A/B)

## Convention
- Priorité: `P0` à `P2`
- Effort: `S` / `M` / `L`
- DoD: definition of done

## Phase A — Fondations

### T001 — Étendre les types de perception
- Priorité: `P0`
- Effort: `S`
- Objectif: ajouter `senseProfile` sans casser `visionProfile`
- Fichiers cibles:
  - `src/types.ts`
  - `src/game/enemyTypes.ts`
- Détails:
  - Ajouter interfaces `SenseProfile`, `SightSense`, `HearingSense`, `SmellSense`
  - Ajouter `senseProfile?: SenseProfile` dans `TokenState`, `Personnage`, `EnemyTypeDefinition`
- DoD:
  - Build TS passe
  - Aucune régression sur création des tokens existants

### T002 — Créer les types runtime perception
- Priorité: `P0`
- Effort: `S`
- Objectif: poser les contrats de calcul
- Fichiers cibles:
  - `src/game/engine/runtime/perception/types.ts`
- Détails:
  - Ajouter `NoiseEvent`, `SmellTrace`, `PerceptionReport`
  - Ajouter `PerceptionContext` (grille, murs, lumière, niveaux)
- DoD:
  - Types exportés et importables sans warning

### T003 — Service de perception (squelette)
- Priorité: `P0`
- Effort: `M`
- Objectif: centraliser l’appel des canaux de perception
- Fichiers cibles:
  - `src/game/engine/runtime/perception/service.ts`
- Détails:
  - Créer `computePerceptionReport(observer, ctx)`
  - Brancher une version initiale: vision existante + stubs ouïe/odorat
- DoD:
  - Retourne un `PerceptionReport` valide
  - Sans effet de bord hors calcul

### T004 — Utilitaires verticalité (`zLevel`)
- Priorité: `P1`
- Effort: `S`
- Objectif: standardiser la verticalité pour perception
- Fichiers cibles:
  - `src/game/engine/runtime/perception/levels.ts`
- Détails:
  - Helpers `getLevelDistance(a,b)` et fallback niveau 0
  - Prévoir extensibilité N niveaux
- DoD:
  - Fonctions testables isolément

## Phase B — Ouïe MVP

### T005 — Émettre des événements de bruit
- Priorité: `P0`
- Effort: `M`
- Objectif: produire `NoiseEvent` depuis actions clés
- Fichiers cibles (à confirmer exacts):
  - `src/game/engine/core/actionEngine.ts`
  - `src/GameBoard.tsx` (hook runtime si nécessaire)
- Détails:
  - Définir mapping intensité par type d’événement (move, melee, ranged, spell)
  - Pousser les événements dans un buffer de tour
- DoD:
  - Les événements de base sont capturés pendant un tour complet

### T006 — Calcul détection ouïe
- Priorité: `P0`
- Effort: `M`
- Objectif: transformer `NoiseEvent` en perceptions utiles
- Fichiers cibles:
  - `src/game/engine/runtime/perception/hearing.ts`
- Détails:
  - Score = intensité - distance - atténuation murs - atténuation verticale
  - Matériaux: atténuation unique en V1
  - Seuil de détection via `senseProfile.hearing.minSignalToDetect`
- DoD:
  - Retourne une liste de signaux entendus triés par confiance

### T007 — UI joueur minimale ouïe
- Priorité: `P1`
- Effort: `M`
- Objectif: afficher zone + texte descriptif
- Fichiers cibles (à confirmer):
  - `src/render2d/layers/usePixiOverlays.ts`
  - `src/GameBoard.tsx`
- Détails:
  - Ajouter mode d’affichage `Ouïe`
  - Afficher zone approximative (rayon simple)
  - Afficher phrase courte contextualisée
- DoD:
  - Joueur peut activer/désactiver la couche ouïe
  - Affichage lisible sans surcharge

### T008 — Brancher données ouïe vers IA MJ
- Priorité: `P0`
- Effort: `M`
- Objectif: enrichir le payload narration/speech
- Fichiers cibles:
  - `src/narrationTypes.ts`
  - `src/narrationClient.ts`
  - `src/GameBoard.tsx`
- Détails:
  - Ajouter bloc perception sensorielle compact
  - Limiter la taille (top 3 signaux max)
- DoD:
  - Endpoint reçoit un payload stable et borné

## Ordre conseillé d’exécution
1. `T001`
2. `T002`
3. `T003`
4. `T005`
5. `T006`
6. `T008`
7. `T007`
8. `T004` (si verticalité non déjà couverte)

## Notes de cadrage validées
- Thermique: atténuation identique tous matériaux (V1)
- Odorat: sans vent (V1)
- Verticalité: en attente de valeur cible; proposition par défaut 3 niveaux
