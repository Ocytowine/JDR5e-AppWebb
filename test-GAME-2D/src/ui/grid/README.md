# UI Grid Helpers

Objectif: centraliser toute la logique de grille pour alleger `GameBoard.tsx`.

Ce dossier est la base de la migration vers le mode hex.

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
