
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
    - elle "concerne" le pj, soit en étant l'acteur, soit en étant le commanditaire, soit la cible
    - si un évenement type quête est généré, il possedent une version joueur (affiché dans l'onglet quêtes), et une version mj.
    - un évenement devient une quête, du moment que le PJ en ai conscient.
    - un évènement est considéré en temps que tel du moment que celui ci rempli des conditions.

## Explication du processus

Simplification de processus :

1:Détecter -> 2:Etablir -> 3:Moduler -> 4:Tonnaliser/Consolider -> 5:Implanter -> 6:Prolonger(optionnel)

1 : Pour que questgenerator interviennent il faut que l'iaRuntime fasse appel. donc un entrainement doit être fait en ammont.

2 : Des que questGenerator ce déclenche, l'ia lis dans le fil de discussion, ce qui déclenche l'évènement, est essaie de répondre au question : Qui, Quoi, Ou, Quand, Comment, Pourquoi ?

3 : l'ia définie une profondeur d'intrigue (aléatoirement) de 1 à 5 (Parametre : STEP) la profondeur définie le nombre d'étape avant la fin de l'évènement.

4 : l'IA essaie de s'appuyer au lore (via recherche intéligente dans le wiki) pour densifier un raisonement cohérent. Elle détermine les 2 premieres étapes afin de bien axer la narration, et de laisser de la libertée narrative pour le futur. Pour déterminer les étapes l'ia à le chant libre, peut s'appuyer sur le ton de l'aventure (fun, horreur, dragon, féérique...). Pourquoi 2 étape : si le joueur entame une quête longue, et qu'il choisie une méthode alternative, qui est logique, la quête peut suivre une direction parrallele.

5 : Les étapes sont définie dans le fichier Core de la partie, iaRuntime définira si une étape est franchise à ce moment, questGenerator s'appuira sur les données receuilli durant l'avancement de la quête pour généré ou non les prochaines étapes.

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

        Donc il faut un lore dense, Afin de rendre crédible une suite d'intrigue, ont cherche un module de quêtes classique, concernant un vol. l'ia va donc étauffer la suite en dévellopant un des 6 points QQOQCP.

        Disont que l'ia s'appuie sur le Comment : 3 bandit armés.
        l'ia s'appuie sur des PNJ, et ce pose la question de qui sont ils, ou sont-ils, sont ils seulement 3, appartiennent ils à un camps, guilde... cherchent ils quelquechose ? 

    La suite proposée est : 
    
        l'ia decident que les bandits appartiennent à un camps et chercher des marchandisent pour nourir leur camps en proie à une famine.
        Le camps est définie (8 familles, cabanne en bois, cachée dans la foret à 30 minute de la charette)
        il faut un réalisme aboutie, le fait de mettre des familles poussera le PJ à revoir cest objectif, et aider les bandits ouvre de nouvelle percpective, cela mettra fin à la quêtes ou justement, le PJ décidera malgrés tout à reprendre la charette.

        La ou c'est important, les étapes ne sont pas obligatoire pour le PJ, c'est un guide de cohérence pour le MJ. Si le joueur n'agit pas, le monde le fera.

        Le fait d'écrire à l'avance, permet d'éviter des incohérences, mais surtout permet au joueur intéligent, d'utiliser leur esprit logique de déduction. dans l'exemple, si le joueur peut demander au marchand ce qu'il transporté (l'ia sachant déja la finalité, repondra "de la nouriture"), de quoi avait l'air les brigands, il pourra répondre "de pauvre type, pret à tout pour me voler, comme si leur vie en dépender". par recoupage, le joueur pourra ou non déduire beaucoup de chose, et accepter ou non la quête.

        Dans l'idée de gestion d'évenement, c'est l'idée de création organique. dans l'exemple, le joueur décide d'aider le camps de bandit, le commanditaire enverra certainement quelqu'un d'autre récupéré la charette, et pourra intervenir contre le camps, et donc contre vous. Si le joueur aide le camps, il serons peut etre des alliés plus-tard, ou il pourra trouver un compagnon roublard ou rodeur.

        Si le joueurs décide d'abandonner la quête, elle ne sera plus visible, mais les effets serons gardé en mémoire. 

        Donc les étapes sont aux nombre de 2, elle commence par étape 1: ramener la charette (car c'est clairment indiqué sur l'affiche), étape 2 : donc une suite d'intrigue optionnel : La charette etant vitale pour le camp, la ramener condamne le camp, la laissé vous fait perdre la récompense.

## Explication détaillées

    Récapitulons :

    1:Détecter -> 2:Etablir -> 3:Moduler -> 4:Tonnaliser/Consolider -> 5:Implanter -> 6:Prolonger(optionnel)

    Définissons plus précisement les 6 points principaux

---

### Detecter

c'est iaRuntime qui envoie une commande d'ajout d'évenement, elle à normalement décrit narrativement des choses à son sujet, avant de déclencher la demande.

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

Pour établir un évent quel qu'il soit. l'IA s'appuie sur 3 choses :

Qu'est ce qui à déja était dit sur l'évenement. les faits
Existe t'il des informations connue sur le wiki.
Ou ce situe ton.
qu'elle ton es employé pour l'aventure.
établir le climax/vérité

Puis l'ia classe mentalement les informations receuillis en utilisant QQOQCP.
les informations non existante sont inventées pour servir de support à la suite du processus.
reprenons les 3 exemples :

exemple 1 :
"Vous voyager maintenant depuis plus d'une heure, le chant des oiseaux et quelques animaux surpris marque votre progression dans cette foret plutot calme, néanmoins, un bruit différent venant de votre droite, vous sort de votre légere torpeur. Ce bruit ne ce rattache pas à ce que vous avez l'habitude d'entendre, mais n'est pas non plus inquietant, que faite vous ?"

type d'event : Point d'interet
les faits : du bruit provient de la foret

    - Qui : qui fait du bruit ?- un gobelin s'entraine à l'arc seule
    - Quoi : qu'est ce qui fait du bruit ? - les fleches tape les tronc d'arbres
    - Ou : l'origine du bruit ? - 30 metre dans la foret, au pied d'un arbre
    - Quand : l'heure au moment ou ce passe l'action ? - aprés midi ensoleilé, à l'instant
    - Comment : qu'est ce qui fait du bruit ? - arc et fleche de mauvaise qualité
    - Pourquoi : la raison du bruit ou la raison de l'entrainement ?- le gobelin s'entraine pour attaquer des marchand passant sur la route

exemple 2 :
"Vous vous dirigez vers le "Ponet intrépide" à Valmorin, dans le quartier des sabotier. Dans le but d'en apprendre plus sur l'affaire des bouteilles fondante que vous avez entendu plutot au marché."

type d'event : Quête
les faits : une histoire de bouteille qui fondent dans une auberge

    - Qui : qui possedent des infos ?- aubergiste et clients (identitées précises)
    - Quoi : quelle bouteille ? bouteille d'alcool sans etiquettes
    - Ou : quelle auberge, donnée wiki ? auberge connus sur wiki, ancien QG de la fraternité (guilde de bandit de petite envergure...)
    - Quand : combien de temps ca dure, quand cela ce produit il - Le soir rien, le matin des bouteilles sont retrouvés fondue
    - Comment : y'a t'il des gens qui savent - Un client à une piste (identitée précise)
    - Pourquoi : liquide particulier ? - Les bouteilles contiennent un liquide alcoolisé qui sent la rose

exemple 3 :
"Les bandits que vous venez de faire fuir, vous on hurlez qu'ils ce vangerons, au nom de la fraternité..."

type d'event : Trame
Les faits : La fraternité va surement ce venger

    - Qui : qui sont ils ? - la fraternité (donnée wiki existante)
    - Quoi : Avec quoi ils vont se venger ? - 2 assassins vont essayer de tuer le pj
    - Ou : A quelle endroit aura lieu la vengance ? - la ou réside le PJ ou dans les environs
    - Quand : Dans combien de temps ? au bout de 2 jours, il commencerons à te suivre, et au 4eme il essairons de passer a l'acte
    - Comment : comment ils vont faire ? suivant leur mode opératoire, meurtre discret.
    - Pourquoi : la raison de ton attaque, les dégats que tu as causer ? vous avez tuer un bon nombre des leurs, et détruit une planque

### Moduler

De manière aléatoire, l'IA (par le biais de questGenerator) doit donner un niveau de profondeur à l'intrigue, choisie des axe d'approfondissement et décide d'ajouter les étapes en amont ou en avale chronologiquement parlant de l'events.

Les niveau de profondeur :
Choisi aléatoirement de 1 à 5, ce niveau est inscrit dans l'event à la propiétée : step. puis elle choisi

les axes d'approfondissement :
sont liés à l'analyse (partie : établir) lié à la méthode QQOQCP, si l'IA choisie d'approfondir le "Qui ?" elle va ajouter des créature impliquées ou une identification poussée des personne déja impliquées, ou rendre sa localisation difficile... (détaillé dans la partie Consolider)

La chronologie :
Le niveau de profondeur indique le nombre d'étape, il faut définir, si elle arrivent avant ou aprés avoir objectivement fini l'event.
sela ce traduit par une propriété : sequence: {objectif:2 step:5}. si l'objectif est atteint aprés le 1er niveau de l'event, il restera 3 niveau de profondeur pour finir l'event.

Reprenons les exemples :

exemple 1 :
"Vous voyager maintenant depuis plus d'une heure, le chant des oiseaux et quelques animaux surpris marque votre progression dans cette foret plutot calme, néanmoins, un bruit différent venant de votre droite, vous sort de votre légere torpeur. Ce bruit ne ce rattache pas à ce que vous avez l'habitude d'entendre, mais n'est pas non plus inquietant, que faite vous ?"

type d'event : Point d'interet
les faits : du bruit provient de la foret

l'IA décide de sequencer: {objectif:1 step:5} le bruit est évident à trouver, mais 4 niveau d'approfondissement.

exemple 2 :
"Vous vous dirigez vers le "Ponet intrépide" à Valmorin, dans le quartier des sabotier. Dans le but d'en apprendre plus sur l'affaire des bouteilles fondante que vous avez entendu plutot au marché."

type d'event : Quête
les faits : une histoire de bouteille qui fondent dans une auberge

l'IA décide de sequencer: {objectif:1 step:3} intrigue facile à élucider, mais révélera un mistere sur 2 niveaux

exemple 3 :
"Les bandits que vous venez de faire fuir, vous on hurlez qu'ils ce vangerons, au nom de la fraternité..."

type d'event : Trame
Les faits : La fraternité va surement ce venger

l'IA décide de sequencer: {objectif:3 step:3} les bandits vont mener 2 niveau d'approfondissement, juste avant de passer à l'acte

### Tonnaliser et Consolider

A cette étape, le but est de garder un lien avec la base éatblie, diriger le flux narratif de l'event vers quelque chose de concret, cohérent, original.

étape 1 : établir la tonalité : ont récupére le ton utilisé par défaut de l'aventure dans CORE, on mélange avec la base établit de l'event, puis ont peut opérer une variante de tons, rendre l'event plus romantique, horrifique, surnaturel...

étape 2 : ont approfondie : ont approffondie au maximum de 2 étapes (si il y'en à 2 minimum), on applique des approffondissemnts en s'inspirrant de modulEvent ou construie de toute pieces. sur les points du QQOQCP établit. mais toujours en s'appuyant du wiki si possible, c'est le lore à moyenne et grande echelle.

reprennons les exemples :

exemple 1 :
"Vous voyager maintenant depuis plus d'une heure, le chant des oiseaux et quelques animaux surpris marque votre progression dans cette foret plutot calme, néanmoins, un bruit différent venant de votre droite, vous sort de votre légere torpeur. Ce bruit ne ce rattache pas à ce que vous avez l'habitude d'entendre, mais n'est pas non plus inquietant, que faite vous ?"

type d'event : Point d'interet
les faits : du bruit provient de la foret

l'IA décide de sequencer: {objectif:1 step:5} le bruit est évident à trouver, mais 4 niveau d'approfondissement.
donc l'IA approfondie de 2 le pourquoi, puis une deuxieme fois
step 1 : objectif
    - Qui : un gobelin s'entraine à l'arc seule
    - Quoi : les fleches tape les tronc d'arbres
    - Ou : 30 metre dans la foret, au pied d'un arbre
    - Quand : aprés midi ensoleilé, à l'instant
    - Comment : arc et fleche de mauvaise qualité
    - Pourquoi : le gobelin s'entraine pour attaquer des marchand passant sur la route
step 2 : pourquoi : le gobelin doit bcp d'argent à son ancien chef
    - Qui : le chef un gobelin puissant (camps de 8 huttes)
    - Quoi : 200 piece d'or
    - Ou : le camps à 1 jour de marche (estimation via outil travelAventure) charette passe sur la route connue
    - Quand : 4 jours restant pour ammener l'argent, la charette passe demain
    - Comment : il veut attaquer seul une charette remplie de breloque
    - Pourquoi : il à fait bruler l'entrepot de vivre de son camps, le chef s'en prendrais à ca famille, c'est sa seule chance (chef gentil)
step 3 : pourquoi : la famille du gobelin est retenu sans violence
    - Qui : ca femme, 2 enfants (identifier), hutte bruler
    - Quoi : 200 piece d'or
    - Ou : une hutte du camps modeste mais confortable
    - Quand : il serront sacrifier dans 4 jours
    - Comment : de facon libre suivant leurs codes
    - Pourquoi : quand un acte non volontaire vient contre le camps, il doit être dédomagé sous peine de peine capitale, sois à hauteur du préjudice.


exemple 2 :
"Vous vous dirigez vers le "Ponet intrépide" à Valmorin, dans le quartier des sabotier. Dans le but d'en apprendre plus sur l'affaire des bouteilles fondante que vous avez entendu plutot au marché."

type d'event : Quête
les faits : une histoire de bouteille qui fondent dans une auberge

l'IA décide de sequencer: {objectif:1 step:3} intrigue facile à élucider, mais révélera un mistere sur 2 niveaux

    - Qui : qui possedent des infos ?- aubergiste et clients (identitées précises)
    - Quoi : quelle bouteille ? bouteille d'alcool sans etiquettes
    - Ou : quelle auberge, donnée wiki ? auberge connus sur wiki, ancien QG de la fraternité (guilde de bandit de petite envergure...)
    - Quand : combien de temps ca dure, quand cela ce produit il - Le soir rien, le matin des bouteilles sont retrouvés fondue
    - Comment : y'a t'il des gens qui savent - Un client à une piste (identitée précise)
    - Pourquoi : liquide particulier ? - Les bouteilles contiennent un liquide alcoolisé qui sent la rose

exemple 3 :
"Les bandits que vous venez de faire fuir, vous on hurlez qu'ils ce vangerons, au nom de la fraternité..."

type d'event : Trame
Les faits : La fraternité va surement ce venger

l'IA décide de sequencer: {objectif:3 step:3} les bandits vont mener 2 niveau d'approfondissement, juste avant de passer à l'acte

    - Qui : qui sont ils ? - la fraternité (donnée wiki existante)
    - Quoi : Avec quoi ils vont se venger ? - 2 assassins vont essayer de tuer le pj
    - Ou : A quelle endroit aura lieu la vengance ? - la ou réside le PJ ou dans les environs
    - Quand : Dans combien de temps ? au bout de 2 jours, il commencerons à te suivre, et au 4eme il essairons de passer a l'acte
    - Comment : comment ils vont faire ? suivant leur mode opératoire, meurtre discret.
    - Pourquoi : la raison de ton attaque, les dégats que tu as causer ? vous avez tuer un bon nombre des leurs, et détruit une planque

### Implanter

### Prolonger
