
# iaRuntime

Le role :

chef d'orchestre : appel des outils, leur donnes les valeurs d'entrées compille et avise.
vérificateur : vérifie les actions faite par le joueur, en suivant un protocole de controle.
Narrateur : un des point de sortie final est la narration, il respecte un ton en tant que narrateur, mais fait vivre les personnages ainsi que le monde.

les entrées :

documents créé par récupérations de personnage / core
index ou catalogue
wiki tagé

les sorties :

Narration
commandes

Cas d'utilisation :

voici les éléments traiter par iaRuntime, qui permette au jeu de traiter les demandes avec de la cohérence.

Demande : Texte émis par le joueur dans le fil de discussion
Contexte : état narratif de l'aventure à ce moment (fil de discussion / )
Personnages : qui est concerné, définir les potentiels (donnée Personnages)
Quêtes : qu'elle quête sont en cours, le joueurs est-il en quete
Wiki : donnée existante du lore, y'a til un lien avec
Lieux  : zone géographique, cohérence naturelle

prennons un exemple et voyons comment iaRuntime orchestre le jeu, pour trouver une solution à une demande.

**le cas de la rivière :**

Demande : "je veux traverser la rivière."
Contexte : calme (le joueur ce promène), 11h, soleil
Personnages : seul, FOR:15, Athlétisme, CapaActuel: 15Kg, percPassive: 14, INT:10
Quêtes : cherchent une charette volé, aucun indice... pas de lien direct
Wiki : la rivière de Valmorin, possedent des histoire à ce sujet, cascade sacré, lié à un dieu...
Lieux : zone de plaine, foret localisé, la rivière n'est pas un fleuve donc elle peut être traversable. la zone n'a pas d'effet particulier

iaRuntime, traite les information récolté de c'est point d'entrée.
traite les données en accossiant l'outil mjRules (définie que faire dans certaine condition, pouvoir de consultation)

elle tire une Analyse à priori :

Le joueur veut traverser une rivière (traversable). Il possedent des capacité suffisante (mais dois faire un test). Il à une perception passive élevé est le contexte ce prete à une analyse pour voir l'endroit le plus accésible. Rien n'indique dans le wiki que des choses négative puissent arriver, au contraire.

Donc iaRuntime envoie une action déduite pour:

    - un appel à un jet de compétence de difficulté 12 avec bonus lié à athlétisme

le Joueur accepte, lance et réussi.

iaRuntime ne réanalyse pas, ce contente d'envoyer une commande pour :

    - un texte narratif : "Vous estimé le meilleur endroit pour traverser et vous vous préparer à traverser... vous arrivez sans encombre... que faite vous ?" (construit en suivant le ton de l'aventure, et s'appuyant sur le contexte...)
    - une avance de temps de 20 minutes (arbitraire)
    - un gain d'xp calcul grace à l'outil dédié (Xp) lié à la difficulté

---

**Le cas de la rivière alternatif :**

Il suffit de changer un petit élément d'entrée pour changer les conclusions, pour changer l'issue de l'histoire.
la demande ne change pas mais si le contexte change cela impactera d'une manière ou d'une autre. voici des exemples par changement unique, conclusion simplifié et par envoie effectué:

Changement de Contexte : poursuivi par une meute loup de nuit -> 
    Analyse à priori: 
        Le joueur veut traverser une rivière (traversable). Il possedent des capacité suffisante (mais dois faire un test). Il à une perception passive élevé est le contexte ce prete à une analyse pour voir l'endroit le plus accésible. Rien n'indique dans le wiki que des choses négative puissent arriver, au contraire.

    Action déduite :
        jet de compétence difficulté 14 (haut profonde)

    Conclusion final:
        vous vous jeter dans l'eau sans réfléchir, la nage est difficile mais vous réussissez... les loups ont abandonnée, mais vous etes au milieux de la nuit, trempez jusqu'au os et seul... que faite vous?

        état trempé (malus)


Changement de Personnages : FOR:10, statEncombrement : Chargé percPassive: 18, INT:16

    Analyse à priori:
        Le joueur veut traverser une rivière (traversable). Il ne possedent pas de capacité suffisante. Il à une perception passive assez élevé est le contexte ce prete à une analyse pour voir l'endroit le plus accésible voir un autre moyen de franchissement. Rien n'indique dans le wiki que des choses négative puissent arriver, au contraire.

    Action déduite :
        Test de perception passive effectué, le lieu ce prete à une solution alternative.
        texte : "vous chercher un moyen sur pour traverser, et votre regarde ce porte sur un arbre mort mais encore sur pied le long de la berge, et un autre détail vous attire, plus loin en amont, vous dicernez une sorte de petite construction en bois, que faite vous"

    Conclusion final:
        aucun
        Dépend de la nouvel demande du joueur.

Changement de quête : si la quête implique de traverser la rivière

Changement de wiki : si une donné existe sur la rivière
Changement de lieu : 
    
