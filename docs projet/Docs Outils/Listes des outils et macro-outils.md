# Outils

## Outils pour création

## Outils pour aventure

### Macro : (outils utilisant d'autre outil)

iaRuntime : réagit au demande du joueur, génère l'aventure, donne vit au monde, c'est le mj en somme

contextEngine : créé un contexte d'aventure (l'environement direct du personnage, s'appuie sur divers données)

### Sous-Outils

    **Récupérateur de données sauvegardés**

knedgePj : récupère les données connue du personnage (par type)

locationPj : récupère la donnée de localisation

    **Powered by IA**

wikiTag : génère des tags issue du contexte, ou quetes, pour tirer des informations destinées au MJ ou PJ

memoriesAventure : gère la narration passée, et comment elle est stockée

iaPrechoice : propose des choix que le joueur peut suivre ou non

pnjEngine : Sert à faire vivre les pnjs en simulant l'impression qui'ils ont vis à vis du PJ, générer un micro background...

    **Calculateur**

timeAventure : transforme le compteur temps en date, heure, minute, et cycle jour/nuit.

travelAventure : calcul les trajets (itinéraire, temps, ...)

diceEngine : gère les récupération d'info pour diceRoller, les Difficultés les caractéristique requise, et traites les envoies les résultats.

diceRoller : génères les lancées de dés.

timeLaps : fait passer le temps sans impact narratif ou mécanique

    **Aides**

mjRules : règle de narration (comment se comporte le MJ, les pnjs...)

modulEvent : aide création d'événement

### Données serveurs

infoMap : donnée géographique précise, donne des information par case de la carte.

Map1 : cadrillage hexagonal représentant la carte du jeu

### Données joueurs (sauvegarde)

CORE : donnée du monde, le temps, les évenements passé ou à venir, connaissances aquises, relation entre personnage

Personnages : fiche PJ, PNJC, montures, les connaisances

DataBase : données brut issue de récupération (évite des requêtes lourdes).
