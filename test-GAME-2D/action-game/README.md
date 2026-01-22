# action-game

Catalogue d'actions JSON partage entre joueurs, ennemis et PNJ.

Objectif
- Un seul catalogue d'actions pour tout le monde.
- Chaque entite (joueur, ennemi, PNJ) declare les actions qu'elle peut utiliser via `actionIds`.
- Le front charge `actions/index.json` et filtre selon la fiche de l'entite.

Structure
- action-model.json: modele a copier pour creer une nouvelle action.
- actions/index.json: liste des actions chargees (chemins relatifs).
- actions/catalog/:
  - combat/: attaques, projectiles, melee.
  - movement/: deplacements, dash, etc.
  - support/: soins, buffs, defausses.
  - items/: bascules et objets (ex: torche).

Regles de standardisation (prototype actuel)
- Le joueur declare `actionIds` dans sa fiche (`src/sampleCharacter.ts`).
- Les ennemis utilisent `enemy-types/*.json` -> `actions`.
- Les actions ciblent `hostile` quand la cible depend du camp (joueur/ennemi).
- Le filtrage principal reste `actionIds` (pas de separation joueur/ennemi dans le catalogue).

Conventions
- `id` et `tags` en minuscule avec tirets.
- Les JSON restent declaratifs (aucun code, pas de logique imperative).
- Les effets/conditions sont resolus par le moteur (`src/game/actionEngine.ts`).
- Variables de formule standardisees:
  - `level`, `modSTR`, `modDEX`, `modCON`, `modINT`, `modWIS`, `modCHA`
  - `attackBonus`, `attackDamage`, `moveRange`, `attackRange`
