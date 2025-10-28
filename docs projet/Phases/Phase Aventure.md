# Phase Aventure

## Présentation UI Générale

### Sidebar et onglet d'aventure

La side barre est constituée de plusieurs boutons :

    - Narration
    - Fiche personnelle
    - Equipement et inventaire
    - boutons modulaire 1 (il prend le noms de la classe 1) (peut avoir un 2eme bouton si multiclassage)
    - Journal
    - Quêtes
    - Compagnon (Optionnel)
    - wiki
Chaque bouton renvoie à l'affichage d'onglet et mécanique décrite plus bas.
l'onglet par défaut est le premier, c'est à dire Narration.

### Narration :###

C'est ici que le joueur intérragit avec le MJ, qu'il interragit avec le monde en somme.
L'ui est simple, c'est un fil de discussion.

**Ui de repère spatio-temporel :**
l'aventure se déroule en temps réelle (dans la plupart du temps sauf cas trés particulier) donc chague action prend du temps.
Donc c'est pourquoi il y'a un affichage "tête haute"(UI : timeAndLocation) de temporalité géré par un outil spécifique(outils : timeAventure) de lieu (outils : travelAventure) et de météo (pas d'outils).

**Gestion de la mémoire :**
Le fil de discussion n'est pas infinie (comme la mémoire humaine) donc en fonction du temps passé les paroles et actes finissent par être résumé ou journalisé grace à un outil narratif en lien avec tous les autres : memoriesAventure. sont fonctionnement simplifier :
mémoire de discussion (au bout de 4 jours (en jeu) le fil de discussion ce résume (dans le fil lui même) puis au bout de 15 jours, ca disparait.)
mémoire journalisé : chaque repos long (sous-phase d'aventure) le journal est écrit (fil de discussion résumé) à chaque jour son entrée.

**Narration générative :**
La narration est l'endroit ou réside l'IA narrative, elle est géré par iaRuntime elle à besoin de donnée pour correctement effectué ca tache, elle renvoie du texte et des commandes. explication simplifiée :
Données d'entrée : informations issues du wiki indexé (contexte, lieu, pnj, race, lore, monstre...). rêgle de narration (mjRules), rêgle du jeu, Outil de contexte (outils : contextEngine (sert à savoir à jaugé un contexte (propice au commerce, repos, combat, voyage...), en suivant le timeAventure et travelAventure)), Données personnages, Quêtes en cours
Données de sortie : texte narratif, Commande et modifieur de commande.
Schéma explicatif :
iaRuntime : MSG: "que fais tu ?" ->
réponse pj : "je traverse la rivière." ->
iaRuntime : appel {"contextEngine" : true, "timeAventure" : 0}; REQ_THROW:DD14/FOR+COMP ->
(explication : l'ia identifie une difficulté donc envoi une commande : REQ_THROW:DD14/FOR+COMP demande un jet de compétence de difficulté 14 lié à la force.
Si le joueur accepte en cliquant sur lancer un dé avec compétence (à choisir) l'outil diceRoller récupère les information necessaire (la commande et les données joueur) et propose de lancer le dé via un bouton. diceRoller envoie le résultat à iaRuntime.)
diceRoller : 15 ->
iaRuntime : ADD_PJ_XP:150 / MSG:"Vous réussisser à traverser la rivière..."

**Choix rapide :**
Des boutons de choix rapide sont prévus (UI : buttonPreChoice): ils sont limités à 5 choix générés par ia et sont guidé par les donnée de personnage (historique, alignement, qualitée et défauts : outil : iaPrechoice) mais il y'a toujours la possibilité de faire ce que l'on veut, en écrivant dans le fil de discussion.

**gestion du temps :**
Si une action entreprise s'étale sur des jours entier le jeu passe en timeLaps (outil : timeLaps) en fonction de l'activité, du contexte, et ressource demandé, la narration ce suspend,mais des péripéthie sont décidé aléatoire et pondéré (contexte pris en conpte) explication :
exemple d'application :
    - le trajet entre 2 villes est calculé, le résultat donne 4 jours. (travelAventure calcul)
    - le trajet passe par 3 zones réputé dangereurse. (on lance 3d6) en fonction des résultat il ce passe quelque-chose ou pas. (travelAventure -> diceRoller)
    - le résultat : il ce passe 2 choses : un combat, une maladie. travelAventure indique à quel moment ces péripétie ce déclare -> timeAventure avance le temps jusqu'a la première péripéthie donc 2 jours.
    - pendant ces 2 jours timelapsé il ne ce passe rien (au niveau du fil de discussion), c'est pourquoi les outis de mémoire ne résume pas, n'y ne compte les période pour journaliser les événements. mais les rations de nourriture sont décompté, les temps de repos sont joué... mais le temps est bien compté.





outils : timeAventure, travelAventure, mjRules, memoriesAventure, iaRuntime, contextEngine, diceRoller, iaPrechoice, timeLaps

Commandes : créer un lexique

UI : timeAndLocation, buttonPreChoice

---

**Fiche Personelle :**

Ici nous affichons toutes les données relative au personnage

---

**Equipement / Inventaire :**

Slots d'équipements, remplacer ou enlever et si arme ou bouclier : définir par défaut
contenant ouvrable en slot(donnée d'encombrance, places en slot)
liste d'inventaire simplifié avec l'endroit ou il est rangé ou équipé
poids : capacité max / limite avant malus / poids actuel porté
Bourse : contenance de toutes les bourses porté, en or, argent, cuivre.

Chaque changement passe par iaRuntime ; fil de discussion. pour validation MJ

---

**UI de classe : optionnel / modulaire :**

Chaque classe possède une UI propre renvoyant des donnée stockée de Personnage et dataBase.
l'id de l'ui est dans la propriété du Personnage : ui_template : "id de l'ui dans le fichier/ui/template"

---

**Journal**

Le Journal repertorie des entrées journalières, les entrées sont génèré via l'outil : memoriesAventure. les entrées sont figé, mais le joueur peut compléter un jour en ajoutant des détail, sur validation de l'ia/Mj.


---

**Quètes**

les quêtes ou intrigue sont présenté ici.

Elles n'apparaisse que si le joueur / personnage montre un interet à suivre une quête

Ici, la quête est écrite du point de vue du personnage, un personnage INT:10 formulera mieux les choses que INT:8

La quête possedent une version coté MJ et une coté PJ voici les détails :
- coté mj :
    Elle dépend d'un outil : questGenerator, qui génère des quêtes avec contexte, gère une profondeur définie, s'adapte au choix et l'approche du joueur. le mj/ia, sais donc les étapes de quête, le types, les lieux clés... ce sont les "données de ciblage" sur lesquelle iaRuntime ce base pour générer la naration quand le joueur tend à se rapprocher d'une quête.
- coté pj :
    la quête est titré (ex : ou ai passé la charette) et décrite par des faits apparant du point de vue du joueur (ex : un marchand ma chargé de retrouver ca charrette, il me donnera 5 pieces d'or si je lui rend.) et chaque fait semblant important, est noté par ia en direct. c'est iaRuntime qui dicte les notes, et active par commande (ex : setDetailQuest1: "j'ai trouvé des traces sur le chemain")
    une structure est à définir, pour une clarté optimale, exemple (a réfléchir):
        - donnée les lieu de départ
        - qui informe, nom du commanditaire, ou le retrouvé
        - récompense
        - piste d'enquete
        - ennemie potentiel
        - risque...
Les quêtes sont sauvegardé dans Core, le template de sauvegarde est quetes.json

outils : questGenerator,
template : (affichage : quest.vue) (données : quetes.json)

---

**Compagnon : optionnel**

---

**Wiki**
