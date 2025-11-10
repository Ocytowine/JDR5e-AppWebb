

## Exploration

Le groupe découvre un lieu, observe, cherche des indices, résout des énigmes.

Mécaniques : tests de Perception, Investigation, Survie, etc.

Sous-phases :

### Exploration de donjon

Déclenchement de scénario : 
    soit le donjon est déja connue :

    soit le donjon est inconnue : le pj se rapproche d'un batiment grotte, lié à un évenement (voir questGenerator).

### Exploration urbaine

Sans but précis :

exemple de mise en situation :
    contexte : vous venez de sortir de votre taverne habituel, votre mission d'escorte commence demain matin et vous n'avez pas donner d'indication clair qu MJ pour le reste de la journée
    Le MJ : il est 11h00 et il fait beau en cette journée de ... que faite vous ?
    Le PJ : je vais faire un tour en ville, du cotés du port

Contexte : Le Contexte est à créer (si le PJ etait dans un scénario en interieur) ou mis à jour si le scénrio etait déja en exterieur.
l'outil iaPrechoice fournie 4 choix d'activitées (inspiré de vos habitudes et de vos connaissances)
Vérification : iaRuntime dois vérifier qu'il y'ai un port dans le lieu ou ce situe le contexte
Evenement : le MJ peut lancer un Evenement
le MJ peut proposer des times laps

prochaine réponse issue du scénario :

    ex1 le MJ : voulez vous un résumé de la ballade ?
    ex2 le MJ : Lors de votre petite ballade, vous passez non loin d'une embarcation typique de la région, mais ce qui vous intrigue, c'est qu'une de celle ci porte une marque particulière, qui vous rappel étrangement le symbole d'une guilde...
    ex3 iaPrechoice : 1-> allez du coté de la criée 2-> voir les bateaux de peches...

Avec but précis :

exemple de mise en situation :
    contexte : vous venez de sortir de votre taverne habituel, votre mission d'escorte commence demain matin et vous n'avez pas donner d'indication clair qu MJ pour le reste de la journée
    Le MJ : il est 11h00 et il fait beau en cette journée de ... que faite vous ?
    Le PJ : je vais voir mon contact au port, Drax

Contexte : Le Contexte est à créer (si le PJ etait dans un scénario en interieur) ou mis à jour si le scénrio etait déja en exterieur.
Vérification : iaRuntime lance une recherche de l'information emise par le joueur : connais t'il le pnj et sait-il ou ce situe t'il réellement ?
Evenement : le MJ peut lancer un Evenement si non le MJ fait un times laps

c'est la base du scénario, le MJ pourras lancer des test de perception passive au besoin, et le joueur pourras utiliser des compétences particulière toujours sous validation du MJ

Dans toutes les explorations, il faut compter le temps passer et donc les effets liés au temps.

### Exploration sauvage

Mécaniquement, même chose que l'exploration urbaine, sauf qu'il faut ajouter une difficulté lié au repaire visuelle, le PJ peut se perdre. plus l'exploration dure longtemps plus la dificultée augmente.

    Test de survie :
    l'outil diceEngine est appellé des que le PJ veut s'orienter ou allés vers un lieu connue.

Repos long disponible (voir contexte).
