# UI Grid Helpers

Objectif: centraliser toute la logique de grille pour alleger `GameBoard.tsx`.

Ce dossier est la base de la migration vers le mode hex.

Reference plan:
- `test-GAME-2D/docs/gameboard/grille hexa/plan de convertion.md`

## Cibles

- Eviter les calculs geometriques disperses dans les composants.
- Fournir une API unique pour square et hex.
- Faciliter tests unitaires et maintenance.

## Structure prevue

- `types.ts`
- `square.ts`
- `hex.ts`
- `adapter.ts`
- `screenMapping.ts`
- `index.ts`

## Regle

Toute nouvelle logique de grille passe par ce dossier, pas directement dans `GameBoard.tsx`.

## Etat (Phase A)

- `createGridAdapter` est en place avec `square` par defaut.
- Les helpers `toScreen`, `toGrid`, `neighbors`, `distance`, `line`, `isInside` existent pour `square` et `hex`.
- Le mode `hex` est implemente techniquement (offset `odd-r`/`even-r`) mais n'est pas encore active en runtime.
- L'integration cote `GameBoard.tsx` est minimale pour limiter le risque de regression.

## Etat (Phase B)

- Le mode `hex` est active pour rendu + input.
- Le rendu de cellules (board + overlays principaux) passe en polygones hex.
- Les systemes gameplay (pathfinding, portees, IA, AOE) restent en logique square pour l'instant.

## Etat (Phase C)

- Le pathfinding suit la projection active (`square` ou `hex`) pour les voisins et l'heuristique.
- Les distances gameplay centrales passent par la metrique de grille active.
- Les formes AOE specifiques (rectangle/ligne/cone details) restent a finaliser en phase D.

## Etat (Phase D)

- Les generateurs AOE (`boardEffects`) sont adaptes au mode `hex` pour `circle`, `cone`, `rectangle`, `line`.
- Les auras runtime utilisent les memes generateurs AOE pour limiter les divergences UI/gameplay.
- Regles v2 en place:
  - `rectangle` = fenetre axiale centree (parallelogramme hex).
  - `line` = rayon axial oriente (6 directions principales).
