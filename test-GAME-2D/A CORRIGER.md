A corriger :
- une action est décompté que si elle est accomplie jusqu'au bout (meme si l'action rate (jet de touche) elle est considéré comme décompté)
- une somme de déplacement est valable par tour de jeu (actuellemnt, revient à 0 a chaque fin déplacment)
- les ennemie ne savent pas tourné la tête, donc il ont tendance à ne pas voir efficacement la cible. il faut revoir leur faculté.
-il faut forcer l'ia à modifier les ennemie au chargement, qu'il puisse les personliser.

Murs et étages :
 Problemes : 
    - rendu des étage pas trés bien fait
    - Mur non visible : pas assombris sur les faces
    - Quand joueur dans batiment (inclur une détection "en batiment", ou derriere un mur ( donc caché))
A créer :
Les type de sol :
Le générateur dois avoir accès à différents types de sol, ayant leur propriété (déplacement, dégât, impactabilité (s'il peuvent être recouvert, modifiés, détruit)) , eau, terre, herbe, air, lave, roche, carreau, plancher...

Effet de frappe :
 "si touche" "si raté" les lancé, tir, sort (coloration par type). Un visuel qui peut avoir plusieurs aspect modifiable par les actions (forme, épaisseur, couleurs, bruit d'impact "onomatopé”)

Configurateur de PJ:
[Avant la création créer une ui pour configurer le pj, modifier les stats, pouvoir, actions pour pouvoir tester des combinaisons d'actions. Et pouvoir vérifier toutes les stats et template dif d'action (déplacement : marcher, sprint, vol, téléportation zone visible, à travers mur...)]

Un créateur de compagnon:
Création d'une entité spécifique non jouable, qui utilisera les même actions que le PJ (par ia)

Interactions :
Plusieurs groupe a mettre dans une roue.
Une interaction via ia (demande particulière)
Communication : permet au joueur de parler plus ou moins fort (audible par toutes les entités)
Contextuel :si proche de mur, porte, obstacle... (ouvrir, pousser, monter dessus)
[Chaque obstacle possèdent des difficultés pour réaliser l'interaction, et des conditions, exemple : tonneau peut être pousser, athletisme, difficulté 12. Bouge l'objet d'une case a l'opposer du pousseur.]
Revoir interaction : problème de régles de test, lancé de dé non obligatoire, conditionnel suivant l'action

Après la création d'action magique, testé l'interaction sur certains objet. Les faire brûler, déplacer, pousser...

Effet environnemental:
Pluie, chaleur, monter d'eau, pluie de météorite. (Effet visuel, interaction sur sol et entité...)

Type de map :
Ponton, pont de pierre, auberge, port, rempart et douve (defence de fort), bateau, camp.

Les effets :
Brulure, rage, saignement,...
Il faut que leur effets soit pris en compte sur plusieurs aspect déjà "figé" dans les logique. 
Les effets Contextuel : pareil que effet
Mais non indiqué, il sont calculé a chaque actions (deplacement ou attaque) peut donné l'état : caché(dans obscurité), en hauteur, mouillé(pluie ou dans l'eau), tombe (entité au dessus du vide) 
Certains effet serons affiché (par ui specifique)

Donc ... choses : 

Type de sol
Type d'interaction
Type d'attaque 
Type d'effet


prompt : 
on va travailler sur les interactions de test-game-2D. chaque obstacle (et wall/door...) doit proposer plusieurs interaction propre. ont va commencer par la porte (door de test-GAME-2D\src\game\map\walls) en gros, j'aimerais que si le joueur ce place proche (a une case autour de lui, y compris en diagonal) la roue d'interaction s'ouvre (comme la partie action) et propose les intéractions possible (on va intégrer pour commencer, ouvrir, défoncer (celle la va dépendre d'un test de force). la dificulté du test de force sera aussi dans les propriétés de l'obstacle (idem pour les portes, murs...) donc j'aimerai que tu analyse l'existant, et que tu me propose le meilleurs plan de travail.

reponse : 
J’ai regardé le flux actuel et les points d’extension: les portes existent comme WallSegment avec kind: "door" et state (bloquage géré dans runtime.ts), la roue d’action est dans ActionWheelMenu.tsx, et l’entrée “Interagir” ne gère que les escaliers dans GameBoard.tsx. Il n’y a pas de système de skill check implémenté (seulement attack/damage), donc le “test de force” devra être ajouté côté interaction.

Plan proposé

1. Définir un format d’interactions/skill DC dans les types et JSON de murs/obstacles (ex: behavior.interactions.forceDc) dans wallTypes.ts et obstacleTypes.ts, puis compléter wall-stone-door.json (et wall-wood-door.json).
2. Ajouter une détection “porte proche” (distance Chebyshev <= 1 depuis une des cases adjacentes au segment) dans GameBoard.tsx.
3. Déclencher automatiquement une roue d’interaction dédiée (ou une vue “interact” enrichie) avec ancrage écran calculé depuis la position grille (gridToScreenForGrid + viewport).
4. Implémenter les interactions “Ouvrir” et “Défoncer (test de force)” avec update d’état sur wallSegments et logs (et éventuellement HP/AC si tu veux conserver une cohérence avec le modèle).
5. Gérer les cas limites UI (pas le tour joueur, porte déjà ouverte, indestructible, etc.) et tests manuels rapides.
Points d’attention observés

“Interagir” ne fait que les escaliers pour l’instant (GameBoard.tsx), donc il faudra soit créer une roue “interactions” séparée, soit enrichir l’existante.
Aucun skill check n’est implémenté dans actionEngine.ts, donc on devra rouler un d20 + modFOR au niveau du GameBoard (ou créer un petit helper dédié).
Questions rapides pour caler le comportement

L’ouverture auto doit-elle se déclencher dès que le joueur arrive à 1 case, ou uniquement à la fin du déplacement/validation ?
“Défoncer” doit mettre la porte open ou la détruire (HP=0 / retirer le segment) ?
Ça consomme une action/bonus/free, ou c’est purement “interaction” hors coût pour le moment ?
Si tu valides ce plan, je peux enchaîner sur l’implémentation. Suggestions de suite:

Valider le format de propriété “forceDc” pour portes/murs.
Me confirmer le timing d’ouverture auto et l’effet de “défoncer”.
Lancer l’implémentation UI + logique.