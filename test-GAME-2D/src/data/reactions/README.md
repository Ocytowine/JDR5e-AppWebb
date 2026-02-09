# Types de reaction

Ce dossier contient les definitions JSON des reactions et le modele partage.

## Evenements de declenchement
- movement.leave_reach
- movement.enter_reach
- visibility.first_seen

## Tests de conditions
- ACTOR_ALIVE: le reacteur doit etre vivant.
- TARGET_ALIVE: la cible doit etre vivante.
- REACTION_AVAILABLE: reaction pas encore utilisee ce tour.
- REACTION_UNUSED_COMBAT: reaction pas encore utilisee dans ce combat.
- DISTANCE_MAX: distance a la cible <= max.
- TARGET_FIRST_SEEN: cible vue pour la premiere fois dans ce combat.
- TARGET_IS_CLOSEST_VISIBLE: cible la plus proche parmi les nouvelles visibles.
- TARGET_VISIBLE: la cible doit etre visible par le reacteur.

## Effets instantanes
- set_killer_instinct_target: marque la cible et donne l'avantage jusqu'a sa mort.

## Messages UI optionnels
- uiMessage: texte affiche si la reaction ennemie touche le joueur.
- uiMessageMiss: texte affiche si la reaction ennemie rate le joueur.

## Notes
- Mettre a jour ce README quand on ajoute un nouveau type de condition ou d'effet.
- Les declencheurs de mouvement sont detectes sur les deplacements joueur et ennemis.
- visibility.first_seen est evalue cote joueur quand un ennemi devient visible.

