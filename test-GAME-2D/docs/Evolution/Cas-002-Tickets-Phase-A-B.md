# Cas 002 — Tickets techniques prêts à coder (Phase A/B)

## Paramètres verrouillés
- Hauteur standard d’étage: `3 m` (surchargeable via patterns).
- Plafond de vol MVP: `30 m`.
- Chute: règle DnD officielle (1d6 / 10 ft, max 20d6), moteur en mètres.

## Convention
- Priorité: `P0` à `P2`
- Effort: `S` / `M` / `L`
- DoD: definition of done

## Phase A — Fondations topologiques

### T201 — Types topologiques de base
- Priorité: `P0`
- Effort: `S`
- Objectif: introduire le socle de données verticales
- Fichiers cibles:
  - `src/types.ts`
  - `src/game/map/generation/types.ts`
- Détails:
  - Ajouter `VerticalLevel`, `VerticalConnector`, `AltitudeState`
  - Ajouter `groundElevationM`/`levelId` aux structures map runtime pertinentes
- DoD:
  - Build TS sans régression
  - Types exportés et documentés

### T202 — Normalisation unité mètre
- Priorité: `P0`
- Effort: `S`
- Objectif: garantir que la hauteur utilise le mètre partout
- Fichiers cibles:
  - `src/game/engine/runtime/units.ts`
  - `src/GameBoard.tsx`
- Détails:
  - Vérifier conversions hauteur/distances
  - Ajouter helpers dédiés (ex: `metersToFallDiceOfficialDnd`)
- DoD:
  - Toute règle altitude/vol/chute passe par helpers unités

### T203 — État runtime altitude des tokens
- Priorité: `P0`
- Effort: `M`
- Objectif: porter une altitude explicite par entité
- Fichiers cibles:
  - `src/types.ts`
  - `src/GameBoard.tsx`
- Détails:
  - Ajouter état altitude (`levelId`, `elevationM`, `flightAltitudeM?`)
  - Fallback propre pour tokens legacy
- DoD:
  - Tokens existants fonctionnent sans données verticales explicites

### T204 — Connecteurs verticaux runtime
- Priorité: `P0`
- Effort: `M`
- Objectif: supporter échelle/escalier/escalade/saut comme transitions data-driven
- Fichiers cibles:
  - `src/game/map/runtime/` (nouveau module `verticalRuntime.ts`)
  - `src/game/map/generation/` (injection map)
- Détails:
  - Indexer connecteurs par cellule/level
  - Exposer lookup `getVerticalTransitionsAt(...)`
- DoD:
  - Transitions récupérables en O(1) amorti

## Phase B — Bâtiments + sous-sols MVP

### T205 — Patterns bâtiment multi-niveaux
- Priorité: `P0`
- Effort: `L`
- Objectif: produire des niveaux de bâtiment à partir des patterns
- Fichiers cibles:
  - `src/game/map/generation/modules/*`
  - `src/game/map/generation/pipeline.ts`
- Détails:
  - Lire hauteur d’étage depuis pattern (`default=3m`)
  - Générer `VerticalLevel` + connecteurs internes
- DoD:
  - Au moins 1 pattern bâtiment multi-niveaux fonctionnel

### T206 — Sous-sol minimal
- Priorité: `P1`
- Effort: `M`
- Objectif: supporter niveau négatif pour zones souterraines
- Fichiers cibles:
  - `src/game/map/generation/modules/*`
  - `src/game/map/generation/pipeline.ts`
- Détails:
  - Générer au moins un niveau `underground`
  - Connecter via escalier/échelle
- DoD:
  - Map test avec accès surface ↔ sous-sol

### T207 — Chute DnD officielle (moteur mètre)
- Priorité: `P0`
- Effort: `S`
- Objectif: appliquer la règle officielle de dégâts de chute
- Fichiers cibles:
  - `src/game/engine/runtime/` (nouveau helper `fallRules.ts`)
  - `src/game/engine/core/actionEngine.ts`
- Détails:
  - `dice = min(20, floor(distanceM / 3.048))`
  - Dégâts contondants + `prone` par défaut
- DoD:
  - Règle testable de façon déterministe (hors RNG)

### T208 — Garde-fou plafond de vol
- Priorité: `P1`
- Effort: `S`
- Objectif: contraindre le vol MVP à 30 m
- Fichiers cibles:
  - `src/game/engine/runtime/movementModes.ts`
  - `src/GameBoard.tsx`
- Détails:
  - Limiter altitude de vol et logs explicites
- DoD:
  - Impossible de dépasser 30 m en runtime MVP

## Ordre conseillé d’exécution
1. `T201`
2. `T202`
3. `T203`
4. `T204`
5. `T207`
6. `T205`
7. `T206`
8. `T208`

## Dépendances transverses
- Cas 001 (sens) dépend de Cas 002 pour la perception verticale.
- Pathfinding, LOS, IA et narration devront consommer les mêmes primitives topologiques.
