
# questGenerator

## En bref

**roles :**

Génère des évenements, en s'appuyant sur les conséquences d'actions du joueur ou de choix narratif.
propulsé par IA

**données d'entrées :**

-> iaRuntime -> commande
-> Contexte -> contextEngine
-> wiki -> wikiTag
-> aide -> modulEvent

**données de sorties :**

-> Ecriture sur sauvegarde (Core)
->

---

## Cycle d'apparition de ce processus

Si on reprend la trame général de la narration :

Filtre d'entrée -> Appel à l'ia -> Filtre de sortie

    Filtre d'entrée :
        Reçoit la réponse JSON de l’IA

        Identifie les commandes à exécuter

        Appelle les bons modules (combat, narration, IA secondaire, gestion du monde, etc.) ! ICI !

        Attend leurs résultats

        Les renvoie à l’IA (si besoin pour synthèse)

        Rassemble tout dans la réponse finale

## Une Quête, c'est quoi ?

Qu'est ce qu'une quête dans le jeu ?
    - nous pouvont l'appeler aussi " évenement ", une quete a proprement parlé "concerne" le personnage joué
    - c'est une succession d'étape clé prégénérer à l'avance
    - l'evenement "concerne" le pj, soit en étant l'acteur, soit en étant le commanditaire, soit la cible
    - si un évenement type quête est généré, il possedent une version joueur (affiché dans l'onglet quêtes), et une version mj.
    - un évenement devient une quête, du moment que le PJ en est conscient.
    - un évènement est considéré en temps que tel du moment que celui ci rempli des conditions.

## Outil à intégrer au processus



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

### Fragmenter

Le fragmentage permet de créer des zones d'intrigues entre le point de départ et le point final.
le fragmentage est choisis par ia défini arbitrairement en fonction du scénrio, en générale une intrigue comporte 3 fragment, que nous noterons A, B, C...
le fragmentage est une zones géographique plus ou moins grande, si l'intrigue ce joue à huit clos, la zones peut être une pièces. Si c'est une aventure principale, peut être une ville.
C'est à partir du point de départ que la narration va guider le joueur. Le joueur peut trouver l'idée d'un fragment par déduction, ou par le simple fait d'enquéter, poser des questions...

### Tonnaliser/Consolider

Point de départ + final + nombre de fragment définit. il n'y a plus qu'a définir le ton de chacun d'eux, définir un fil conducteur ou inter-connecteur. une foix fait, il faut définir géographiquement ou ce situe les fragments, et définir les impératifs.

### Implanter

Fin de processus créatif : il faut sauvegarder l'ensemble des données dans CORE, qui sera relus à chaque interaction a l'évenement.
la sauvegarde doit contenir des métas infos en plus des élément concrets sité avant. Notament la date de départ, date de fin si il y'a, les données adresses, données Donjons.

Structure hypotétique :

event : {
    id: "nomme l'evenement",
    ton: "enquete horifique",
    dateDebut: [format_date],
    zoneInfluence: [10km]
    depart :{ lieu: [adresse, nom de lieu], eventType: QUETE, },
    fragA...
    fragB...
    fragC...
    final...
    }

### Jouer

En jouant, des éléments importants peuvent être ajoutés aux fragments actuelement actif ou d'autres à découvrir ou déja terminer (terminer sous entend que le joueur à eu suffisamant d'éléments pour comprendre le fil conducteur ou une inter-connection)

### Prolonger(optionnel)

le prolongement s'applique à une suite aprés le final, sans pour autant créé un nouvel evenement. Le boss qui fuit, pour être achever (prolongement), à la différence du boss qui fuit sans que le joueur puissent le retrouver (nouvel evenement).

### Exemple complets

exemple 1 :

    avant déclenchement : "Vous voyager maintenant depuis plus d'une heure, le chant des oiseaux et quelques animaux surpris marque votre progression dans cette foret plutot calme, néanmoins, un bruit différent venant de votre droite, vous sort de votre légere torpeur. Ce bruit ne ce rattache pas à ce que vous avez l'habitude d'entendre, mais n'est pas non plus inquietant, que faite vous ?"

Détection :
    iaRuntime appel donc une création d'évenement : par le biais de la commande : ADD_EVENT_INTEREST:"bruit dans la foret" (exemple)
    il detecte quelque chose pouvant avoir un intéret pour le joueur.

Etablir :
    Point de départ :
        QUOI :
            les faits relatés: bruit inconnue provenant de la foret.
            les faits complétés :
                - Qui : qui fait du bruit ?- un gobelin s'entraine à l'arc seule (identitée définie : Zark de Ghoradir)
                - Quoi : qu'est ce qui fait du bruit ? - les fleches tape les tronc d'arbres
                - Ou : l'origine du bruit ? - 30 metre dans la foret, au pied d'un arbre
                - Quand : l'heure au moment ou ce passe l'action ? - aprés midi ensoleilé, à l'instant
                - Comment : qu'est ce qui fait du bruit ? - fleche de mauvaise qualitée qui ce plante sur des tronc creux
                - Pourquoi : la raison du bruit ou la raison de l'entrainement ?- le gobelin s'entraine pour attaquer des marchand passant sur la route

        DONNEES : aucune données trouvé en cherchant : bruit inconnue / foret / marchand

        SITUATIONS :
            le Lieu ou ce trouve le PJ (info dans CORE) renvoie : Plaine parsemmé de foret classique, bas niveau. (issue de la lecture : donnée de carte)
            Tonalité (info dans CORE) : aventure medieval/fatastique classique.
            Donnée de Personnages récupéré : PJ: santé maxi...

    Point final :
    s'articule autour de la raison du "pourquoi ?"
        POURQUOI : le gobelin doit bcp d'argent à son ancien chef
            - Qui : le chef, un gobelin puissant (identitée définie...) (camps de 8 huttes, estime les ennemies si besoin)
            - Quoi : 200 piece d'or
            - Ou : le camps est à 1 jour de marche (estimation via outil travelAventure) charette passe sur la route connue
            - Quand : 4 jours restant pour ammener l'argent, la charette passe demain (evenement définit dans le temps)
            - Comment : il veut attaquer seul une charette remplie de breloque
            - Pourquoi : il à fait bruler l'entrepot de vivre de son camps, le chef s'en prendrais à sa famille, c'est sa seule chance (chef gentil)
        DONNEES : gobelin / camps de gobelin - donne - code des gobelin (trouve le fonctionnement des camps de gobelin, hiérarchie, coutume...)

fragmenter :

l'evenement ouvre plusieurs possibilitée de fin, pour fragmenté intéligament avant le point final ont peut donner plusieurs fin à l'évenement du point de vue du joueur voici des cas simple de fin :

    le pj peut tuer Zark
    le pj peut aider Zark à mieux utiliser son arc
    le pj peut demander pourquoi Zark fait cela, Zark réponds:
        Zark a besoin de 200 po :
            PJ donne 200 po
            PJ demande pourquoi :
                Zark -> rembourser son chef
                Zark ment -> fausse piste

        Zark veut attaquer un marchand pour voler ses marchandise :
            PJ aide
            PJ capture Zark pour emprisonement / le tue
            il demande pourquoi :
                Zark -> rembourser son chef
                Zark ment -> fausse piste
                
    Zark -> rembourser son chef :
        PJ va demander au chef si il peut rallonger le délai
        PJ menace le chef
        PJ négocie...

En réfléchissent ainsi ont peut identifier plusieurs fragment évident :
    Embuscade du marchand (route)
    Camps de Zark (négociation)
    Hutte du chef (si combat final)
    Boutique du marchand (si vole par infiltration...)

L'ia définit 2 fragment intéressant et évident pour passer à l'étape d'aprés, le camps de Zark et l'ambuscade (variante :si le PJ et roublard : boutique du marchand)

Tonnaliser/Consolider :

point de départ et final ok, il faut définir les 2 fragments

fragment A, l'embuscade / fragment B, le camp.

fragA : id: l'embuscade
    Ou : sur la route (adresse) bordé d'un
    Qui : marchand (identité complexe (nom prénoms, race, classe, équipement)), escorte (identitée simple,classae,équipement)
    Quoi : transporte des meubles de luxe d'une valeur de 300 po
    Quand : date de passage définit (evenement définit dans le temps)

fragB : le camps
    Ou : (adresse au hasard à une distance de 20km) description du camps
    Qui : chef (identitée complexe), famille de zark (identitée simple), gobelin diverse...
    Quoi : Activité diverse de camps gobelin classique (Wiki)

Implanter :

```js
event : {
    id: "Le bruit dans la foret",
    toneTags: "classique",
    links: null,
    status: "active",
    dateDebut: [format_date],
    eventType: ["INTEREST", "PNJ_RESCUE", "EVENT_MINEUR"],
    pjkndge: "sur la route de Landry j'ai entendu des bruits provenant de la foret, comme des impacts",
    depart :{
        lieu: [[x:24;y:11], "foret de Landry"],
        Qui : "un gobelin s'entraine à l'arc seule (identitée définie : Zark de Ghoradir)",
        Quoi : "du bruit dans la foret"
        Ou : "dans la foret, au pied d'un arbre",
        Quand : "aprés midi ensoleilé, à l'instant",
        Comment : "fleche de mauvaise qualitée qui ce plante sur des tronc creux",
        Pourquoi : "le gobelin s'entraine pour attaquer des marchand passant sur la route"
    },
    fragA :{
        id: "L'embuscade"
        lieu: [[x:24;y:11], "route de Landry"],
        Ou : "route bordée d'une foret...",
        Qui : "marchand (identité complexe (nom prénoms, race, classe, équipement)), escorte (identitée simple,classae,équipement)",
        Quoi : "transporte des meubles de luxe d'une valeur de 300 po",
        Quand : "date de passage définit (evenement définit dans le temps)"
    },
    fragB :{
        id: "le camp"
        lieu: [[x:25;y:42], "Camps de Zark"],
        Ou : "description du camps",
        Qui : "chef (identitée complexe), famille de zark (identitée simple), gobelin diverse...",
        Quoi : "Activité diverse de camps gobelin classique (Wiki)"
    },
    final :{
        lieu: [[x:25;y:14], "Camps de Zark"],
        Qui : "le chef, un gobelin puissant (identitée définie...) (camps de 8 huttes, estime les ennemies si besoin)",
        Quoi : "200 piece d'or",
        Quand : "4 jours restant pour ammener l'argent",
        Comment : "il veut attaquer seul une charette remplie de breloque",
        Pourquoi : "il à fait bruler l'entrepot de vivre de son camps, le chef s'en prendrais à sa famille, c'est sa seule chance (chef gentil)",
    }
    ```