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
    - étape 8 : Preview

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

### étape 1 : Choix de l'identitée

**Coté UI :**

    - 3 cellules pour le nom, prénom, surnom.

**Coté mécanique :**

    Cette partie complete le template Personnage :

```ts
        nom: {nomcomplet: string; prenom?: string; surnom?: string} // nom du personnage, prénom et surnom optionnel
```

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

### étape 3 : Choix de la classe

Les classes sont un grand pan du modele de progression du joueur, c'est la classe qui dictent la facon de jouer, part le biais des feature unique qui l'accompagne, donne aussi une partie du materiel pour commencer l'aventure

**Coté UI :**

Cette page est composé exclusivement d'une grille (disposition variable suivant la place disponible) de carte, une carte est rectangulaire (même taille que celle des races) la moitié haute est constitué de l'image illustrant la classe, la moitié basse est constituée des informations :

- le nom de la classe
- une description 2 ou 3 phrases (de l'utilisation en aventure et combat)
- Capacité spéciale et description de celle-ci (Ce qu'il c'est faire et que les autre ne savent pas faire) (barbare = rage)

**Coté mécanique :**

Les données sont chargé de la même facon que les races, voici les outils :

- adapteur Github (un adapteur pour toutes les requète de donnée statique)
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

### étape 4 : Choix de l'historique (background)

L'historique forge les compétences du personnages, ca facon de s'exprimer, et le materielle qu'il porte lors de son entrée en scene.

**Coté UI :**

Cette page est composé d'un grille de carte (même régle de disposition que classes) une carte est divisée : la moitié haute est constitué de l'image illustrant l'historique, la moitié basse est constituée des informations :

- le nom de l'historique
- les gains/bonus et pertes/malus liés à l'historique

**Coté mécanique :**

Les données sont chargé de la même facon que les races, voici les outils :

- adapteur Github (un adapteur pour toutes les requète de donnée statique)
- cataloque background (objets fetch à détailler)

les données sujetes a la récupération (catalogue) sont :
    - idBack : Soldat
    - back1 : tu gagne de la force (Force +1)
    - back2 : tu possede une arme de service (épée longue)
    - back3...

**onValidation :**

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

### étape 7 : Choix des équipements

Les classes, background fournissent un pack d'items pour le début d'aventure. l'étape 7 permet de donner le choix au joueur de ce qu'il compte garder ou de ce qu'il veut vendre. donc plusieurs aspect s'on pris en compte ici. le poids, le prix, les types d'items. Un item non gardé et échangé contre ca valeur en pièce, et un item et soit équipé, soit rangé, rien n'est tenu en main (pas pendant la phase création) donc il y'a un systeme de slot.

**Coté UI :**

En entête : choisie ce que tu garde et vend le reste.
suivie du poid des objet gardé (cumulé) et de la capacité de port du personnage (calcul lié au stat de force à détaillé) et l'argent actuel (le personnage ce voit attribué une bourse (rempli d'aprés le background) c'est un item au même titre que les autres)

**Coté mécanique :**
**onValidation :**

### étape 8 : Preview


**Coté UI :**
**Coté mécanique :**
**onValidation :**