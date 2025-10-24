# Phase Création

## Présentation des fonctionnalités avant création

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

    - Phase 1 : Choix de l'identitée
    - Phase 2 : Choix de la race
    - Phase 3 : Choix de la classe
    - Phase 4 : Choix de l'historique (background)
    - Phase 5 : Choix des caractéristiques
    - Phase 6 : Choix relatif
    - Phase 7 : Choix des équipements
    - Phase 8 : Preview

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

### Phase 1 : Choix de l'identitée

**Coté UI :**

    - 3 cellules pour le nom, prénom, surnom.

**Coté mécanique :**

    Cette partie complete le template Personnage :

```ts
        nom: {nomcomplet: string; prenom?: string; surnom?: string} // nom du personnage, prénom et surnom optionnel
```

### Phase 2 : Choix de la race

**Coté UI :**

Répartition de la page :

    Races : en partie haute

    Ethnie (si diponnible) : centré

    réglage de la taille et de la morphologie : partie basse

Races : Présenté par "famille" avec un template de cards (à précisé) disposé sur une grille horizontale (scrollable horizontale) dont les cards ne change pas de taille en fonction de leur nombre. au clique, la partie Ethnie se "peuple" si la race en possèdent

Ethnie : C'est l'origine d'ou provient le personnage, ou une particularité régionnale
(nain des montagne, Elfe des bois, Orc tribale...)

Réglage de la taille et de la morphologie : Curseur déplacable sur 2 axes

Sexe : Symoble à cliquer, l'ui propose 3 choix, homme, femme, indéfinie. ce choix n'a aucune concéquence.

**Coté mécanique :**

Pour importer les données il faut un :

- adapteur Github (permet une connexion)
- Un catalogue Race (récupère les information nécessaire à l'affichage)
- Un résolveur de choix (a la séléction, il renvoie les ethnies disponible lié à la race, si aucune, il ne renvoie rien) (une ethnie n'est qu'un modificateur de race, ce n'est pas indépendant de la race)
- un outil pour graphique (converti abcisse, ordonnée en valeur  modificateur taille / modificateur poids)

Les données brut sont sous format json, le template Personnage et en ts, les données sont donc hydraté à la validation de la page. voila une liste de base, des objets pouvant être impacté :

coté donnée brute de race :

```json
pas encore modifié
```
