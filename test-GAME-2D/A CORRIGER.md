A corriger :
- une action est décompté que si elle est accomplie jusqu'au bout (meme si l'action rate (jet de touche) elle est considéré comme décompté)
- une somme de déplacement est valable par tour de jeu (actuellemnt, revient à 0 a chaque fin déplacment)
-il faut forcer l'ia à modifier les ennemie au chargement, qu'il puisse les personliser.

Murs et étages :
 Problemes : 
    - rendu des étage pas trés bien fait
    - Mur non visible : pas assombris sur les faces
    - Quand joueur dans batiment (inclur une détection "en batiment", ou derriere un mur ( donc caché))
A créer :


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
