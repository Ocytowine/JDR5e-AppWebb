# Interactions utilisateur

Source principale: `test-GAME-2D/src/GameBoard.tsx`.

## Modes d'interaction
Etat `interactionMode`:
- `idle`: clic ouvre la roue d'action.
- `moving`: clic ajoute des cases au chemin.
- `inspect-select`: clic inspecte une case/entite.
- `look-select`: clic oriente le personnage.
- `interact-select`: clic cherche des interactions sur mur/obstacle.

## Clic plateau (flux principal)
`handleBoardClick`:
1. Convertit l'ecran vers la grille via `viewportRef` + `screenToGridForGrid`.
2. Verifie limites de map, `playableCells`, `activeLevel`.
3. Si `targetMode === selecting`: selectionne une cible (token, obstacle, mur).
4. Si `interactionMode === inspect-select`: inspection, reveal et log.
5. Si `interactionMode === interact-select`: ouvre roue d'interaction.
6. Si `interactionMode === look-select`: ajuste le facing.
7. Sinon: ouvre la roue d'action (`ActionWheelMenu`).
8. En mode `moving`: calcule un chemin via `computePathTowards`.

## Selection de cibles
- `targetMode` active la selection pour une action validee.
- Selection de tokens, obstacles et murs.
- Verification de portee, LOS, conditions via `validate*TargetForAction`.
- Support multi-cibles via `maxTargets`.

## Interactions objets/murs
- Detection via `findWallSegmentAtCell` et `findObstacleAtCell`.
- Verification des conditions avec `getInteractionAvailability`.
- Ouverture d'un menu radial (`interactionMenuItems`).
- Execution via `handleExecuteInteraction`.

## Roue d'action
`ActionWheelMenu` affiche:
- Actions du joueur.
- Deplacements et interactions.
- Acces aux modes inspect/look/interact.

## Fenetres contextuelles
- `ActionContextWindow`: resolution d'action (attaque/degats, cibles, ressources).
- `InteractionContextWindow`: confirmation d'interaction mur/obstacle.
- `CharacterSheetWindow`: feuille perso.

## Zoom et pan
- Zoom: boutons +, -, reset (UI en haut a droite).
- Zoom souris: wheel handler (dans `GameBoard`).
- Pan: click droit + drag (`isPanningBoard`, `panDragRef`).
- Les conversions screen->grid passent par `viewportRef`.

## Anti double clic
`supressBoardClickUntilRef` bloque les clics pendant certaines phases.

## Raccourcis clavier
- Escape: ferme menus contextuels, annule selection ou mode.

## Logs et feedbacks
- `log` pour messages immediats.
- `speechBubbles` et `narrationEntries` pour narration.
- `hpPopups`, `reactionToast`, `combatToast` pour feedbacks visuels.
