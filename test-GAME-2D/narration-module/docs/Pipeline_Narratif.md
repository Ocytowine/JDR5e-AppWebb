# Pipeline Narratif pour le module de narration

## Phase de pipeline :

le joueur interagie avec l'ia (MJ) en écrivant une intention dans le chat.
Le joueur peut plus ou moins préciser son intention, c'est pourquoi le jeu doit fournir un contexte riche et structuré pour que l'ia puisse comprendre et interpréter correctement la volonté du joueur.
Pour cela, 

l'ia qui ferra vivre le MJ doit s'appuyer sur un runtime scene qui lui enverra des contrats. un tour de jeu ce décompose en 3 phase minimum :

### Phase 1 : 
la demande du joueur est envoyer avec le contexte* et avec le contrat + prompt de la phase 1. (test-GAME-2D\narration-module\docs\contrat_entree.md)
l'ia recoie l'ensemble, remplit le contrat et le renvoie complété.

### Phase 2 :
le runtime scene va récupérer l'ensemble et va traiter les informations en actionnant des fonctions utiles au jeu, avancer le temps, mémoriser des données, compter des ressources... puis fournir un contrat pour la prochaine phases. le runtime peut avoir besoin d'un double passage ia (un avant l'aspect narratif, pour créer du contenu...) (sous systeme à prévoir)

### Phase 3 :
 l'ia recoie le contexte* de départ, la volonté d'intention du joueur accepté ou non, puis ce qu'on attend de l'ia pour l'aspect narratif. et pour créer le contexte suivant*.
    le contexte suivant : le runtime va fournir à l'ia le contexte de la scène suivante, qui peut être différent du contexte de départ, en fonction de la volonté du joueur et des actions entreprises. le runtime peut aussi fournir des informations complémentaires sur le contexte, comme des éléments de décor, des personnages présents, des objets... pour que l'ia puisse créer une narration riche et cohérente avec le contexte.

## Le contexte :
contexte de "scene" local, elle provient de la situation géographique du personnage, lieu (wiki lieu) , du temps (heure), météo (si exterieur). le contexte peut contenir des pnj actif (reconnaisable et inetractif) ou simplement  inactif (simplement évoqué). le contexte est envoyé brut à l'ia, un paragraphe de description simple. complété par des infos déja appelé par la création de scene si elle était déja créé au tour précédent.
contexte monde, ....
les infos complémentaire sont lié à la scene ou au contexte monde, sont ...

## Résolution runtime scene :
en fonction du contrat d'entrée. le runtime li les étapes à résoudre, puis peut faire appel à des fonctions de résolution de jet, de combat, de création d'entité, d'inventaire, de gestion de ressource... ou simplement faire avancer le temps. le runtime peut aussi faire appel à un double passage ia pour créer du contenu ou faire des choix narratif (voir sous-systeme). 

### Sous systeme :
    un sous systeme peut résoudre des cas complexe, comme la création de savoire non présent dans la DB wiki. dans le cas ou le personnage demande une informations sur un sujet non présent dans la base de donnée, le runtime peut faire appel à un sous système de création de savoir pour que l'ia puisse inventer une réponse cohérente avec le contexte et les éléments déjà présent dans la base de donnée. ce savoir permet d'alimenter une base de donnée local à la partie.

## Runtime monde :
Le runtime monde :

avance le temps

fait agir factions, PNJ, tensions, lieux

produit des effets locaux et globaux
