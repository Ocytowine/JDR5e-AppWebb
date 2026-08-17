# Contrat J1 — contexte public du joueur

Statut : `ACTIF — PREMIÈRE TRANCHE J1`

Version : `player-public-context/1`

## But

Réunir, dans une seule vue en lecture seule, les informations que le jeu peut
montrer au joueur sans révéler de donnée privée.

Cette vue doit permettre au MJ de comprendre correctement des questions comme :

- « Où suis-je ? » ;
- « Qui est présent ? » ;
- « Qu'est-ce que je sais ? ».

Le joueur formule toujours sa volonté par écrit, en langage naturel. Cette vue
ne décide aucune action et ne fait pas avancer le temps.

## Sources autorisées

La vue est reconstruite à chaque tour depuis :

- la scène active déjà vérifiée, pour le lieu et les personnes visibles ;
- la projection publique du personnage, pour son identité et son équipement
  visible ;
- le registre de connaissances du personnage, pour ce qu'il a entendu,
  observé, confirmé ou réfuté ;
- les faits que la scène marque explicitement comme connus du joueur.

Elle ne devient jamais une nouvelle sauvegarde ni une nouvelle autorité.

## Contenu V1

`PlayerPublicContextV1` contient :

- le personnage actif et son identité d'acteur ;
- le lieu et la scène actifs ;
- les PNJ et présences ambiantes actuellement visibles ;
- les références d'équipement visibles déjà autorisées pour l'interpréteur ;
- les faits publics de la scène ;
- les connaissances acquises par le personnage, avec leur statut et leurs
  sources attribuées ;
- les versions des sources utilisées.

Les listes sont bornées, triées et déterministes. Le même état produit donc la
même vue et la même réponse.

## Informations interdites

La vue exclut :

- les secrets du MJ et les faits cachés de l'intrigue ;
- les pensées, objectifs, pressions et intentions privées des PNJ ;
- la vérité privée permettant de savoir qu'un PNJ ment ou se trompe ;
- la fiche mécanique complète, les ressources privées et l'inventaire caché ;
- toute information entendue par un autre acteur mais pas par le personnage ;
- toute décision de réussite, d'échec, de déplacement ou de dépense.

Une rumeur reste présentée comme une information entendue. Une réfutation reste
une connaissance du personnage et ne réécrit pas le témoignage historique.

## Réponses déterministes

Le constructeur fournit trois réponses de lecture :

- `LOCATION` nomme seulement le lieu actif ;
- `PRESENT_ACTORS` énumère les personnes visibles et leur état visible ;
- `KNOWN_FACTS` restitue les faits connus et distingue ce qui a été entendu,
  observé, confirmé ou réfuté.

Le choix du type de question appartient à l'interprétation sémantique. Le
constructeur de réponse ne cherche pas à deviner la volonté du joueur et
n'appelle aucun modèle IA.

## Empreinte et reprise

La vue exacte fait partie de l'empreinte du contexte envoyé à
`player_intent_interpreter`. Un changement de lieu, de présence, d'équipement
visible ou de connaissance change donc l'empreinte.

La vue est reconstruite après rechargement depuis les mêmes sources. Elle n'est
pas restaurée depuis le texte affiché ni depuis la mémoire courte de la
conversation.

## Première gate

La première vérification doit prouver :

- la réunion correcte de la scène, du personnage et de ses connaissances ;
- l'exclusion de données privées sentinelles ;
- l'attribution des rumeurs ;
- les réponses stables aux trois questions de lecture ;
- la présence de la vue dans l'empreinte de l'interpréteur ;
- une reconstruction identique après rechargement.

Cette tranche n'ouvre aucune commande d'inventaire, aucune nouvelle mécanique
de connaissance et aucune action de jeu.
