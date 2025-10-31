
# questGenerator

## En bref

**roles :**

Génère des évenements, en s'appuyant sur les conséquences d'actions du joueur ou de choix narratif.
propulsé par IA

**données d'entrées :**

-> iaRuntime (via commande)
-> fil de discussion
-> wiki
-> modulEvent

**données de sorties :**

-> Ecriture sur sauvegarde (Core)
->

---

## Une Quête, c'est quoi ?

Qu'est ce qu'une quête dans le jeu ?
    - nous pouvont l'appeler aussi " évenement ", une quete a proprement parlé "concerne" le personnage joué
    - c'est une succession d'étape clé prégénérer à l'avance
    - l'evenement "concerne" le pj, soit en étant l'acteur, soit en étant le commanditaire, soit la cible
    - si un évenement type quête est généré, il possedent une version joueur (affiché dans l'onglet quêtes), et une version mj.
    - un évenement devient une quête, du moment que le PJ en ai conscient.
    - un évènement est considéré en temps que tel du moment que celui ci rempli des conditions.

## Explication du processus

Simplification de processus :

1:Détecter -> 2:Etablir -> 3:Fragmenter -> 4:Tonnaliser/Consolider -> 5:Implanter -> 6:Jouer -> 7:Prolonger(optionnel)

### Detecter

c'est le job d'iaRuntime qui envoie une commande d'ajout d'évenement, elle à normalement décrit narrativement des choses à son sujet, avant de déclencher la demande.
elle doit pouvoir savoir si l'évenement détecter est rattacher, ou rattachable à un autre !

exemple 1 :
    avant déclenchement : "Vous voyager maintenant depuis plus d'une heure, le chant des oiseaux et quelques animaux surpris marque votre progression dans cette foret plutot calme, néanmoins, un bruit différent venant de votre droite, vous sort de votre légere torpeur. Ce bruit ne ce rattache pas à ce que vous avez l'habitude d'entendre, mais n'est pas non plus inquietant, que faite vous ?"

    iaRuntime appel donc une création d'évenement : par le biais de la commande : ADD_EVENT_INTEREST:"bruit dans la foret" (exemple)
    il detecte quelque chose pouvant avoir un intéret pour le joueur.

exemple 2 :
    avant déclenchement : "Vous vous dirigez vers le "Ponet intrépide" à Valmorin, dans le quartier des sabotier. Dans le but d'en apprendre plus sur l'affaire des bouteilles fondante que vous avez entendu plutot au marché."

    iaRuntime appel une transformation d'évenement type "Point d'interet" à "quête" (voir type d'évenement dans : Module évenement) MOD_EVENT:TYPE_OF(bouteilles fondantes)TO:QUEST. 
    il detecte un changement d'implication du joueur, passant d'un "bruit de couloir" à quelque chose qui lui tient à coeur.

exemple 3 :
    avant déclenchement : "Les bandits que vous venez de faire fuir, vous on hurlez qu'ils ce vangerons, au nom de la fraternité..."

    iaRuntime appel une création d'evenement : ADD_EVENT_TRAME:"Vengance fraternelle"
    il detecte que quelque chose ce trame contre le joueur.

les exemples traite des 3 types d'évenement detectable, et la possibilité de transformer un event :

une narration / action -> quête ou point d'interet ou trame.
un point d'interet -> quete ou trame.
une trame -> point d'interet ou quete
une quete -> trame

voici les commandes attendu par questGenerator :

ADD_EVENT:(nom de l'event) le nom de l'event reste figé quoi qu'il ce passe, même pour une transformation
MOD_EVENT:(nom de l'event)... permet de modifier un event déja enregistré
...TYPE_OF(nom de l'event)TO:TYPE modife le type de l'event en un autre type.
TYPE : QUEST, INTEREST, TRAME les différents type d'event : quête, point d'intéret, trame

### Etablir

2 sous-phases obligatoire d'établissement :

établir le point de départ : les faits

    Pour établir les faits d'un évent quel qu'il soit. l'IA s'appuie sur 3 choses :

    QUOI : Qu'est ce qui à déja était dit sur l'évenement. les faits réelles du point de vue du joueur. méthode QQOQCP
    DONNEES :Existe t'il des informations connue sur le wiki qui ce rattache au fait étoffé (prévision du fait complété).méthode mots-clées
    SITUATIONS : Ou ce situe ton, tonnalité de l'aventure, état du groupe de joueur. métode fetch

    Puis l'ia classe mentalement les informations receuillis en utilisant QQOQCP.
    les informations non existante sont inventées pour servir de support à la suite du processus.

établir le point final : le climax et la vérité

    Ce qu'il ce passe vraiment : appliquer la méthode QQOQCP, appuyer des données, et une situation précise
    l'ia répond au question de la méthode QQOQCP en etoffant les informations (voir modulEvent). comparre les informations au wiki (en testant des mots-clées) pour avoir de la cohérence en tout point. Puis vérifie la cohérence géographique (via l'outil : travelAventure)

à la fin de cette étape, le début et la fin de l'intrigue sont définie

reprenons les 3 exemples : 

### Fragmenter

Le fragmentage permet de créer des zones d'intrigues entre le point de départ et le point final.
le fragmentage et choisis par ia défini arbitrairement en fonction du scénrio, en générale une intrigue comporte 3 fragment, que nous noterons A, B, C...
ce sont des zones géographique plus ou moins grande, si l'intrigue ce joue à huit clos, les zones peuvent être des pièces. Si c'est une aventure principale, peut-être une ville.
C'est à partir du point de départ que la narration va guider le joueur. Le joueur peut trouver l'idée d'un fragment par déduction, ou par le simple fait d'enquéter, poser des question