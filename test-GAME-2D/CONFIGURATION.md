# Configuration du projet test-GAME-2D

## Environnement

- **Bac à sable** : environnement Vite par défaut (déjà configuré, aucune action requise)
- **Framework UI** : React 18 + PixiJS 8
- **Langage** : TypeScript

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Génère les catalogues, build le module narration, démarre le serveur |
| `npm run dev:ui` | Démarre uniquement Vite (interface seule) |
| `npm run build` | Build complet pour la production |
| `npm run gen:action-catalog` | Génère le catalogue des actions |
| `npm run gen:class-catalog` | Génère le catalogue des classes |
| `npm run gen:materiel-catalog` | Génère le catalogue du matériel |
| `npm run validate:content` | Valide le contenu JSON |
| `npm run normalize:content` | Normalise les fichiers de contenu |
| `npm run setup:hooks` | Configure les hooks Git |

## Module narration

Le runtime du module narration a été retiré. Il fonctionne en mode **lore-only** : aucune étape de build supplémentaire n'est requise.

## Notes

- Les catalogues sont régénérés automatiquement à chaque lancement de `dev` ou `build`.
- La validation du contenu repose sur **AJV** (schémas JSON).
