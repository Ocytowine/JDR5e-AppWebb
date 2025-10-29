
# questGenerator

## En bref :

**roles**

Génère des quètes et intrigues, en s'appuyant sur les conséquences d'actions du joueur.
propulsé par ia

**données d'entrées**

-> iaRuntime
-> fil de discussion
-> wiki
-> moduleQuest

**données de sorties**

-> Ecriture sur sauvegarde (Core)
->

---

Qu'est ce qu'une quète dans le jeu ?
    - nous pouvont l'appeler aussi " évenement ", une quete a proprement parlé concerne* le personnage joué
    - c'est une succession d'étape clé prégénérer à l'avance
    - *elle concerne le pj, soit en étant l'acteur, soit en étant le commanditaire, soit la cible
    - si un évenement type quête est généré, il possedent une version joueur (affiché dans l'onglet quètes), et une version mj.
    - un évenement devient une quète, du moment que le PJ en ai conscient.
    - un évènement est considéré en temps que tel du moment que celui ci rempli des conditions.

Explication :

Simplification de processus :

- Pour que questgenerator interviennent il faut que l'iaRuntime fasse appel. donc un entrainement doit être fait en ammont.

- Des que questGenerator ce déclenche, l'ia lis dans le fil de discussion, ce qui déclenche l'évènement, est essaie de répondre au question : Qui, Quoi, Ou, Quand, Comment, Pourquoi ?

Puis l'ia définie une profondeur d'intrigue (aléatoirement) de 1 à 5 (Parametre : STEP) la profondeur définie le nombre d'étape avant la fin de l'évènement.

A c'est réponse immédiate et approfondissement, l'IA essaie de s'appuyer au lore, via recherche intéligente dans le wiki pour densifier un raisonement cohérent.


puis elle détermine les 2 premieres étapes afin de bien axé la narration, et de laisser de la libertée narrative pour le futur.
pour déterminer les étapes l'ia à le chant libre, peut s'appuyer sur le ton de l'aventure (fun, horreur, dragon, féérique...)

Les étapes sont définie dans le fichier Core de la partie, iaRuntime définira si une étape est franchise à ce moment, questGenerator s'appuira sur les données receuilli durant l'avancement de la quète pour généré ou non les prochaines étapes.

Exemple simple d'usage :

    Demande PJ : J'accepte une prime, quelqun recherche une charette volée. je lie l'affiche.

    Le MJ envoie : 
        texte : l'affiche mantionne le nom et ou habite le commanditaire pour les informations, la récompense.
        Commande : NEW_QUEST

questGenerator : identifie Qui, Quoi, Ou, Comment, Pourquoi (QQOQCP)? réponse immédiate :

        Qui : PNJ commanditaire : Ralf Ponnard, marchand nain, pas trés bavard (inventé par IA)
        Quoi : c'est fait voler une charette (info récupéré)
        Ou : à une heure de marche au nord, sur la route (inventé par IA)
        Quand : 4 jours (inventé par IA)
        Comment : 3 bandits armés
        Pourquoi : Marchandise qui avait l'air intéressante

    Il y'a 2 possibilité, soit on fragmente l'intrigue jusqu'a l'objectif définie, soit on propose une suite.
    Donc FRAG ou SUITE

        STEP : densification pour approfondissement : Commande : STEP:2_SUITE

        Donc il faut un lore dense, Afin de rendre crédible une suite d'intrigue, ont cherche un module de quètes classique, concernant un vol. l'ia va donc étauffer la suite en dévellopant un des 6 points QQOQCP.

        Disont que l'ia s'appuie sur le Comment : 3 bandit armés.
        l'ia s'appuie sur des PNJ, et ce pose la question de qui sont ils, ou sont-ils, sont ils seulement 3, appartiennent ils à un camps, guilde... cherchent ils quelquechose ? 

    La suite proposée est : 
    
        l'ia decident que les bandits appartiennent à un camps et chercher des marchandisent pour nourir leur camps en proie à une famine.
        Le camps est définie (8 familles, cabanne en bois, cachée dans la foret à 30 minute de la charette)
        il faut un réalisme aboutie, le fait de mettre des familles poussera le PJ à revoir cest objectif, et aider les bandits ouvre de nouvelle percpective, cela mettra fin à la quètes ou justement, le PJ décidera malgrés tout à reprendre la charette.

        La ou c'est important, les étapes ne sont pas obligatoire pour le PJ, c'est un guide de cohérence pour le MJ. Si le joueur n'agit pas, le monde le fera.

        Le fait d'écrire à l'avance, permet d'éviter des incohérences, mais surtout permet au joueur intéligent, d'utiliser leur esprit logique de déduction. dans l'exemple, si le joueur peut demander au marchand ce qu'il transporté (l'ia sachant déja la finalité, repondra "de la nouriture"), de quoi avait l'air les brigands, il pourra répondre "de pauvre type, pret à tout pour me voler, comme si leur vie en dépender". par recoupage, le joueur pourra ou non déduire beaucoup de chose, et accepter ou non la quète.

        Dans l'idée de gestion d'évenement, c'est l'idée de création organique. dans l'exemple, le joueur décide d'aider le camps de bandit, le commanditaire enverra certainement quelqu'un d'autre récupéré la charette, et pourra intervenir contre le camps, et donc contre vous. Si le joueur aide le camps, il serons peut etre des alliés plus-tard, ou il pourra trouver un compagnon roublard ou rodeur.

        Si le joueurs décide d'abandonner la quète, elle ne sera plus visible, mais les effets serons gardé en mémoire. 

        Donc les étapes sont aux nombre de 2, elle commence par étape 1: ramener la charette (car c'est clairment indiqué sur l'affiche), étape 2 : donc une suite d'intrigue optionnel : La charette etant vitale pour le camp, la ramener condamne le camp, la laissé vous fait perdre la récompense.

    Récapitulons :

    Potentiel Quète détecté -> QQOQCP -> STEP et FRAG ou SUITE-> Ton -> Consolider -> Implanter

    






