# Phase Création

## Présentation des fonctionnalitées avant création

### Page Personnage

Aprés l'identité de l'utilisateur confirmé : l'écran Personnage apparait, l'écran personnage comportes :

    - par défaut, 3 slots vident ( bouton rectangle avec symbole plus dedans) qui permet de créer un personnage (une partie de jeu en somme)
    - Chaque slots peut contenir une partie (associer à plusieurs fichiers de sauvegarde : Personnages, DataBase, Core (on  reviendras dessus))
    - Un slot est constituer visuellement de 2 partie répartie par une séparation horizontale, 2/3 de la hauteur en partie haute.
    - Sur chaque slots utilisés (donc associer à une partie) nous retrouvons en partie haute : le nom du personnage, niveau global et classes. et en partie basse un bouton de chargement et un de supression.

Donc sur chaque slot 3 actions sont possiblent :

    - si vide : cliquer sur le bouton lance la phase création
    - si le slot est associé à une partie :
        - Chargement : charge la sauvegarde de la partie
        - Supprimer : supprime la sauvegarde de la partie avec confirmation

## Création

**Explication :**

La partie création se déroule en 9 étapes :

    - étape 1 : Choix de l'identitée
    - étape 2 : Choix de la race
    - étape 3 : Choix de la classe
    - étape 4 : Choix de l'historique (background)
    - étape 5 : Choix des caractéristiques
    - étape 6 : Choix relatif
    - étape 7 : Choix des équipements
    - étape 8 : Choix de vie

**Coté UI :**
La page création à une entête répertoriant les numéros de phase (et nom de phase) qui change de couleur en fonction de l'avancement (gris : non faite, bleu : en cours : vert : validé)

**Coté mécanique :**

Dés le clic sur le slot vide, la sauvegarde s'initialise, chaque Partie créée demande 3 fichiers de sauvegardes :

    - Personnages
    - Database
    - Core

Chacun d'eux à un role distinct :

- Personnages

        détient les propriétés (objet) relative au personnage joué (PJ) par l'utilisateur et par les compagnons non jouable du personnage (PNJC) (les alliés durable)
        Le template du personnage est disponible à utils/personnage.ts
        les valeurs liés aux objets destinées au personnages sont hydraté depuis un repo Github (races, classes, subclasses, background...)
        chaque objet récupère les valeurs durant la création, elles peuvent être bruts, calculées, modifiées durant la création, puis pendant l'aventure, suite à des passage de niveau, le temps qui passe, ajout d'items, combats...
        Le fichier peut contenir, en plus du personnage joué, les compagnons non joué (joué et interprété par l'IA )

- DataBase

    Contient les information brut issues du repo github format Json, en lien direct avec les besoins de la partie personnages sauvegardé, les avoir sauvegardé permet une lecture rapide et complète du fonctionnement d'une feature (exemple : que ce passe t'il au passage d'un niveau si je possede un magicien, ou comment fonctionne un sorts).

    Les fetures ou items ayant besoin des informations pour être affichés (dans l'onglet inventaire ou Sorts) peuvent avoir des modificateurs dans "Personnages".
    Exemple -> le personnage détient une épée particulière, elle peut s'enflammer au contact de gobelin,

    Ce qu il y'a dans "Personnages" ->

```ts
            Inventaire: 
            {
                id: epee_longue (sert de lien personnage / dataBase)
                idUnique: 42518 (généré aléatoirement)
                quantite: 1
                mod:  "addEffectOnHit": {"damage": "1d5", "damage_type": "feu"}
                conteneur: null
            }
```

Ce qu'il y'a dans DataBase ->

 ```json
            {//items : A MODIFIER !
                "id": "epee_longue",
                "name": "Épée longue",
                "type": "arme",
                "subtype" : "martiale",
                "description": "épée de guerre classique",
                "equiped": true,
                "allow_stack": false,
                "harmonisable": false,
                "focalisateur": false,
                "weight": 1.5,
                "value": {
                    "gold": 15,
                    "silver": 0,
                    "copper": 0
                },
                "effectOnHit": {
                    "damage": "1d8",
                    "damage_type": "tranchant"
                },
                    "properties": {
                    "versatile": true,
                    "weapon_mastery": "Push"
                    }
            }
```

- Core :

        Core garde en mémoire la trame historique, le journal d'aventure, les quêtes, les reperes spatio-temporel (date, heur, lieu), les relations.

a travailler !

---

### étape 1 : Choix de l'identitée

**Coté UI :**

    - 3 cellules pour le nom, prénom, surnom.

**Coté mécanique :**

    Cette partie complete le template Personnage :

```ts
        nom: {nomcomplet: string; prenom?: string; surnom?: string} // nom du personnage, prénom et surnom optionnel
```

---

### étape 2 : Choix de la race

La race apporte au joueur les caractérique physique et le dévelloppement ou non de certains sens de son personnage.

**Coté UI :**

Répartition de la page :

- Races : en partie haute

- Ethnie (si diponnible) : centré

- réglage de la taille et de la morphologie : partie basse

Races : Présenté par "famille" avec un template de cards (à précisé) disposé sur une grille horizontale (scrollable horizontale) dont les cards ne change pas de taille en fonction de leur nombre. au clique, la partie Ethnie se "peuple" si la race en possèdent

Ethnie : C'est l'origine d'ou provient le personnage, ou une particularité régionnale
(nain des montagne, Elfe des bois, Orc tribale...)

Réglage de la taille et de la morphologie : Curseur déplacable sur 2 axes

Sexe : Symoble à cliquer, l'ui propose 3 choix, homme, femme, indéfinie. ce choix n'a aucune concéquence.

**Coté mécanique :**

Pour importer les données il faut 4 outils :

- adapteur Github (permet une connexion)
- Un catalogue Race (récupère les information nécessaire à l'affichage)
- Un résolveur de choix (a la séléction, il renvoie les ethnies disponible lié à la race, si aucune, il ne renvoie rien) (une ethnie n'est qu'un modificateur de race, ce n'est pas indépendant de la race)
- un outil pour graphique x;y (converti abcisse, ordonnée en valeur  modificateur taille / modificateur poids)

**onValidation :**

Les données brut sont sous format json, le template Personnage et en ts, les données sont donc hydraté à la validation de la page. voila une liste de base, des objets pouvant être impacté :

coté donnée brute de race :

```json
pas encore modifié
```

coté sauvegarde "Personnages" :

```ts

pas fini
```

c'est trés important d'avoir une écriture définitive, car les prochaines étapes vont modifier ces valeurs de base

---

### étape 3 : Choix de la classe

Les classes sont un grand pan du modele de progression du joueur, c'est la classe qui dictent la facon de jouer, part le biais des feature unique qui l'accompagne, donne aussi une partie du materiel pour commencer l'aventure

**Coté UI :**

Cette page est composé exclusivement d'une grille (disposition variable suivant la place disponible) de carte, une carte est rectangulaire (même taille que celle des races) la moitié haute est constitué de l'image illustrant la classe, la moitié basse est constituée des informations :

- le nom de la classe
- une description 2 ou 3 phrases (de l'utilisation en aventure et combat)
- Capacité spéciale et description de celle-ci (Ce qu'il c'est faire et que les autre ne savent pas faire) (barbare = rage)

**Coté mécanique :**

Les données sont chargé de la même facon que les races, voici les outils :

- adapteur Github (un adapteur pour toutes les requête de donnée statique)
- cataloque Classe (objets à détailler)

les données sujetes a la récupération sont :

    - idClasse : barbare
    - ClasseName : Barbare
    - descriptionCourte : Combatant redoutable...
    - Feat1 : {idFeatName : Rage; FeatNameDescription : Les coups recu et données ne font que prolonger la rage}
    - Feat2 ...

id de classe, description courte, capacitée et description de capacitée.
"détailer les objets Json une fois fabriquée"

**onValidation :**

Une fois validée :

    - Une récupération de classe ciblé s'opère, l'objet StatClasseBase (à créer) est injecté dans sauvegarde/Personnage.
    - L'hydratation s'execute, la sauvegarde/Personnage ce complete.

---

### étape 4 : Choix de l'historique (background)

L'historique forge les compétences du personnages, ca facon de s'exprimer, et le materielle qu'il porte lors de son entrée en scene.

**Coté UI :**

Cette page est composé d'un grille de carte (même régle de disposition que classes) une carte est divisée : la moitié haute est constitué de l'image illustrant l'historique, la moitié basse est constituée des informations :

- le nom de l'historique
- les gains/bonus et pertes/malus liés à l'historique

**Coté mécanique :**

Les données sont chargé de la même facon que les races, voici les outils :

- adapteur Github (un adapteur pour toutes les requête de donnée statique)
- cataloque background (objets fetch à détailler)

les données sujetes a la récupération (catalogue) sont :
    - idBack : Soldat
    - back1 : tu gagne de la force (Force +1)
    - back2 : tu possede une arme de service (épée longue)
    - back3...

**onValidation :**

---

### étape 5 : Choix des caractéristiques

Cette page sert à l'attribution des caracteristiques naturelle relative au personnage par le joueur. L'attibution ce fait en réparticant des points (capital de 27) sur les 5 caractéristiques classique (Force, dextérité, constitution, intéligence, sagesse, charisme)

Elle propose aussi le niveau de départ du personnage ! (de 1 à 3). A ce stade la, aucune incidence

**Coté UI :**

en haut de pages, l'explication de l'importance de bien répartir, les conséquences...
au centre, la gestion de capital ce fait via un tableau. 
En entête nous retrouvons le capital avec "point à répartir =0" car par défaut le capital est déja réparti, mais chaque case correspondant à une caractéristique posséde un + et - pour faire évoluer la valeur.
Dés que le capital est complétement répartie, le bouton validé (passer à l'étape suivante) devient cliquable.

les valeurs de caractéristique sont par défaut à :

Force 15, dextérité 13, constitution 14, intéligence 12, sagesse 10, charisme  8

**Coté mécanique :**

la répartition des point suis la règle : 
les points attribué à une carac par d'une base de 8, et pour passer un niveau de carac supérieur ont ajoute 1 en plus du palier précédant (cumulatif), donc passé au palier 9 coute un point, au 10 coutera 2 point, au 11 coutera 3 points... mathématiquement : C(S)={S−82S−21​si 8≤S≤13si 14≤S≤15​
Il est obligatoire de répartir les 27 points
Il doit être impossible de dépasser 15 points (à la phase création)

Pour réaliser le calcul, un outil sera utilisé : CalculCarac (règle strictement pour la création)

**onValidation :**

la validation entraine une écriture de la sauvegarde Personnage, les objets hydraté sont :

```ts
    force: { FOR: number; modFOR: number },// modFOR = Math.floor((FOR - 10) / 2)
    dexterite: { DEX: number; modDEX: number },// modDEX = Math.floor((DEX - 10) / 2)
    constitution: { CON: number; modCON: number }// modCON = Math.floor((CON - 10) / 2)
    intelligence: { INT: number; modINT: number },// modINT = Math.floor((INT - 10) / 2)
    sagesse: { SAG: number; modSAG: number },// modSAG = Math.floor((SAG - 10) / 2)
    charisme: { CHA: number; modCHA: number }// modCHA = Math.floor((CHA - 10) / 2)
```

---

### étape 6 : Choix relatifs

En fonction des choix précédent réalisé par le Joueur/Utilisateur, la page affichera les choix relatif à certains effets, par exemple le fait de choisir une classe et d'avoir choisi de commencer niveau 3, sous entend qu'il faut des à présent choisir une sous-classe (entre autre)

Ici nous ne traiterons pas les items, seuls les effets de classes, sous-classes, races, background serons traités.

Certains choix validé peuvent entrainner d'autre choix à faire, il est important pour la logique, que le catalogue ce régnénère suite à une validation.

imaginons le cas ou le joueur choisis la classe magicien et le niveau 3, les choix proposerons les sous-classes de magiciens, les sorts offerts (limité au niveau du magicien (parmis tout ceux existant), et en nombre limité), une fois la sous classe choisis, certaine sous classe propose d'autre sort en plus

Cette page est complexe mécaniquement car elle fait appelle à plusieurs outils qui peuvent planter la logique.

**Coté UI :**

Répartie les choix par feature.
Si le choix demande de choisir des sous-classes, alors les sous-classes sont dans un groupes, sur une grille de cartes (model : cardClasse)

Si c'est des sorts ils sont disposé sur une grille de cartes (model : cardSpell)

Si c'est des compétence ou maitrise disposer des boutons simple (non validé : bleu, validé : vert)

Quand une feature est validé (choix effectué) elle est réduite, un bouton permet d'annuler le choix. Quand toute les features sont validées, alors le bouton validé (validation de l'étape) apparait.

**Coté mécanique :**

Dans chaque objet json (Classe, Races, Background) il y'a une charge utile (payload) et dans certain, il y'a des sous-objet qui possedent un type "choice" suivie de plusieurs déterminant, notament les éléments à choisir (leurs id, si il faut filtrer les éléments, sous quelle condition, si il faut récupérer des données (lesquelles)...), le nombre à choisir, comment l'app doit traiter l'élément (est-ce un sorts, un items, une sous-classe...) la syntaxe du fichier json ne change pas quelque-soit la source, pour éviter une adaptation. voici le template contenue dans une charge utile destiné seulement au choix :

```json
    "id": "sorcier_spell_choice_1",//id permettant un suivi de la création
    "type": "choice",
    "payload": {
        "ui_id": "Choix des sorts de niveau 1", //afficher en entête du groupe du choix de la feature
        "description": "Choisissé 2 sorts dans la liste", // sous titre
        "category": "spell", //Les choix sont présenté sous la forme de spell (l'ui devra donc utilisé cardSpell)
        "choose": 2, //l'utilisateur doit choisir 2 éléments
        "auto_from": {// le paramétrage du filtre
          "collection": "spells", //dossier ou chercher
          "filters": { "level": 1 }, // l'élément permetant de filtré, exemple : seulement ce ayant "level" : 1
          "fetch": [true, "spellId", "..." ],//Se qu'il fautrécupérer comme data, pour affichage, et comme balise de récupération
        }
    },
    "onValidation":"spellId" //ce qui va être gardé du choix
```

Chaque niveau que l'utilisateur à décidé d'aquérir doit être pris en compte. Si la classe choisie requiere des choix sur les 3 premiers niveau, il faut les soumettres. (je ne sais pas comment faire en sorte qu'il le fasse réelement)

```json
"conditions": {
    "all": [
    { "classeId":"sorcier", "niveau": 2 }//Le choix est proposé seulement si la classe sorcier atteint le niveau 2
    ]
}

```

cette logique s'applique aussi au passage de niveau (sous-phase : LevelUp)
et potentiellement au repos (sous-phase : repos)

**onValidation :**

Phase 1 : la validation doit entrainer une recherche dans les features catégorisé : features, subclasse nouvellement aquise (si c'est le cas) pour éviter un oublie de choix. (même chose que ce expliqué), les features déja choisie reste replié, c'est simplement une actualisation, sans perte de mémoire. 

Phase 2 : la phase 1 étant résolue, tout les choix sont validé, la validation récupère les ids des choix et les ids des features aquisent grace à eux, exemple :
"sorcier_spell_choice_1" : "boule_de_feu"

---

### étape 7 : Choix des équipements

Les classes, background fournissent un pack d'items pour le début d'aventure. l'étape 7 permet de donner le choix au joueur de ce qu'il compte garder ou de ce qu'il veut vendre. donc plusieurs aspect s'on pris en compte ici. le poids, le prix, les types d'items. Un item non gardé et échangé contre ca valeur en pièce, et un item et soit équipé, soit rangé, rien n'est tenu en main (pas pendant la phase création) donc il y'a un systeme de slot.

**Coté UI :**

En entête : choisie ce que tu garde et vend le reste.
suivie du poids des objets gardés (cumulé) et de la capacité de port du personnage (Formule de capaMax : 7.5 x FOR)l'argent actuel (le personnage ce voit attribué une bourse (rempli d'aprés le background) c'est un item au même titre que les autres)
Grille de carte objet (cardItemCreat)

**Coté mécanique :**

Les objet sont récupéré des features chosie dans les étape d'avant. Si une feature donne des objets.

cardItemCreat : possedent une pastille gardé/vendu (bleu/verte) un bouton garder/vendre. une icone format svg du type d'objet (la couleur change en fonction de la valeur voir document "valeur"). La carte possèdent les informations résumé des éléments de l'item en plus du nom, quantité (si superieur à 1), sous-type, valeur, poids/taille et de la description courte. (les information résumés sont sous la propriété : infoResum : {info1:"",info2:""}).

Capacité de port maximal : capaMax : 7.5 x FOR = valeur en kilogramme
Capacité de port avant Malus : capaAvantMalus: number //Calcul : capaMax / 2
Poids porté : sommes des poid des items gardé (en tenant compte des quantités) (Outil : CalculPoids)
Bourse : Indique la valeur (tout compris) des items vendu + l'argent de base dans la bourse. (outil : CalculBourse)

**onValidation :**

Pour valider, il ne faut pas que la capacité de port maximal soit dépassé.

les itemIds marqué gardé sont récupéré
les itemIds marqué vendu sont réduit à leurs valeurs (propriété : value{}) et sont ajouté à la valeur
la bourse est considéré différament, elle est un contenant. les items vendus, la valeur de ceux ci, sont additionnés à ceux qu'elle contenait de base.

la validation hydrate la sauvegarde personnage au niveau de :

```ts
Inventaire: 
    {
        item1 :{
      id: string, //identifiant de l'item issu de la base de données des items
      idUnique:string, // identifiant unique pour chaque instance de l'item (permet de gérer les items consommables, usables, etc.)
      quantite: number,  // quantité de cet item dans l'inventaire
      mod:{String:string} | null, //modificateurs appliqués à cet item, peut-s'agir de la description visuelle, de bonus de caractéristique, d'une libertée du MJ (en somme appelle la propriété de l'arme, la remplace par une autre valeur).
      conteneur:string | null // spécifie dans quel contenant se trouve l'item (sac, coffre, etc.), null si l'item est porté sur soi
    }
    item2{}
    } // liste des items dans l'inventaire avec leur quantité et un id unique pour chaque instance (permet de gérer les items consommables, usables, etc.)
```

Un outil (EquipAuto) va "ranger" automatiquement les items dans les slots d'équipement et choisir l'arme par défaut. les propriété de sauvegarde impacté sont :

```ts
  materielSlots: {// Slots pour mettres des équipements (items) à disposition direct (aucun malus d'action pour les utiliser)
    Ceinture_gauche: string | null // limité au items étant d'une longueur inferieure à la moitié de la taille du personnage
// création d'un module de filtrage des items en fonction des slots disponibles et des caractéristiques du personnage (taille, force, etc.) pour n'afficher que les items compatibles lors de l'équipement. (liste déroulante filtrée)
    Ceinture_droite: string | null // limité au items étant d'une longueur inferieure à la moitié de la taille du personnage

    Dos_gauche: string | null // limité au items étant d'une longueur inferieure à la taille du personnage

    Dos_droit: string | null // limité au items étant d'une longueur inferieure à la taille du personnage

    Armure: string | null // armure légère, armure lourde, etc. peut être recouverte par un vêtement

    Vetement: string | null // Vêtement, Veste, etc.

    paquetage: string | null // sac à dos, besace, etc.

    accessoire: string | null // Montre, amulette, bague, etc. limite de 5
  }
  armesDefaut:
  {// Systeme permettant de définir les armes par défaut du personnage (ex: arme de mêlée principale, arme de mêlée secondaire, arme à distance), à la condition d'être présent dans les slots d'équipement (materielSlots)
    main_droite: string | null // idUnique de l'arme équipée en main droite //Filtre les armes compatibles via leur propriété (ex: arme légère, arme de jet, etc.)
    main_gauche: string | null // idUnique de l'arme équipée en main gauche //Filtre les armes compatibles via leur propriété (ex: arme légère, arme de jet, etc.)
    mains: string | null // idUnique de l'arme équipée à deux mains //Filtre les armes compatibles via leur propriété (ex: arme à deux mains, etc.)
  } //Ont applique les features des items de armesDefaut (calcul du CA avec bouclier, bonus de dégâts, etc.)
```

---

### étape 8 : Choix de vie

Le preview, ou plutot la prévisualisation et une pages qui résume les capacités, les stats, les items... tout ce qui à était fait. Mais avant de partir dans l'aventure,
Il y'a une chose trés importante à indiquer par le joueur, c'est la partie narrative et descriptive.
Pour compléter c'est éléments, il y'aura une partie dédié au visuel, et d'un autre la partie psychologique

partie visuel, il faut écrire dans plusieurs case, à quoi ressemble notre personnage, couleur de peau, yeux, cheveux, puis la démarche, les vetements ou armure...
(par défaut, c'est case sont déja écrite, mais un générateur IA (à établir) servira des détail plus aboutie en fonction des choix de classe race, background)
répercution :

partie psychologie : en utilisant le background, le joueur va décrire l'histoire du personnage, puis une IA va poser des question pertinente (pour chercher à trouver l'alignement, les qualités et défaut du personnage (sujet à creuser), savoir si l'historique peut faire l'objet d'une quête (voir "Phase Aventure"))


**Coté UI :**

Une présentation classique de la fiche de personnage, avec comme information récoltées:

- nom, prénom, surnom
- race, ethnie
- classe, sous-classe
- niveau global et de classe (en phase création, c'est la même valeur)
- traits (langue,vitesse, taille, poids, traits naturelle (vision...))
- caractéristique (sous forme de tableau, type, valeur et modificateur)
- compétences lié au caractéristique (intimidation...)
- bonus de maitrise
- maitrise technique (armes, armures, outils...)
- Jet de Sauvegarde
- dés de vie
- PV
- CA
- Capacités (feature de classe...)
- Equipement (dans les slots)
- inventaire (le reste, ce qui est rangé)
- infos conditionnel, dépend des classes, races...
- Habileté de mage...
- Sorts appris / connus

puis en bas de cette prévisualisation, il y'a plusieurs boutons :

- confirmer
- revenir au choix de : race, classe, background...

et si le bouton confirmer est cliquer, la fiche est vérrouiller.

la partie "Qui êtes-vous vraiment ?" s'initialyse

avec 2 blocs distinct :
- un pour la description de l'apparence divisé en 2 (un sur le physique et un lié sur l'équipement, visant à décrire tenu et armes)
- un pour écrire l'historique du personnage, sous la forme d'un entretien avec un interlocuteur IA qui orrientera les réponses pour avoir les prérequis nécessaire au départ d'aventure.

**Coté mécanique :**

récupération des éléments choisis, calcul et application des propriétés
rien n'évolue avant la confirmation.
puis

partie "Qui êtes-vous vraiment ?" commence :

- du coté de "description de l'apparence" :

- du coté de "raconter moi tout" :

l'outil : iaStoryPerso s'initialise en chargent la fiche perso (confirmer) et commence par poser des question pertinente pour remplir des cases (virtuelle), notament :
    - origine familial (génère processus de quête/mystere/modificateur social)
    - motivation ou quete personelle (génère processus de quête)
    - faiblesses (peut etre désaventage aléatoire dans un cas si prétent)
    - qualitées (peut etre aventage aléatoire dans un cas si prétent)
    - pourquoi cette historique (sur quoi le mj peut ammener l'histoire, le ton employé,  ce qui ce passe aprés)
au niveau mécanique sela génère plusieurs choses, a définir plutard (mécanique flou encore)

l'outil : iaDetailling s'initialise en chargant la fiche perso, et prérempli des cases réelles notament description physique/physionomie (corps et tête), description comportementale (démarche, allure, regard portée), description vestimentaire/materielle (fonction de personnalisation d'équipement, affecte la description d'un item, et la facon que les pnj le percois techniquement ajoute une sous-propriété à l'item present dans l'inventaire : mod:{String:string} | null, ou string dans ce cas ci est la description courte, ou le nom de l'item (plus de détail dans le doc outil concerné))

Outil à créer :

- iaDetailling :

        permet d'affiner la partie visuel en s'appuyant sur les choix réalisé au niveau de la race, classes, background.
        Mais laisse le joueur modifié à ca guise tout les aspects. Il n'a qu'un rôle de remplissage par défaut.

- iaStoryPerso :
        permet d'aider à approfondir les personnages par des question/réponse.
        Les point d'entrée : background 1/2 importance, fiche personnage 1/2 importance.
        Les point de sortie : des bonus de stats, des malus de stats (voir comment l'intégrer). des quêtes à débloquer (passage de niveau) (générer par IA) (Outil quête à définir) des features généré procéduralement ou IA.

**onValidation :**

La partie "Qui êtes-vous vraiment ?" valider, les données issue des 2 outils finissent soit dans la sauvegarde Personnages, soit dans Core la partie dédié au déroulement de l'aventure (détail dans le doc de chaque outil)

puis la phase Création laisse place à la phase Aventure.
