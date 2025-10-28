
# memoriesAventure

Sert à générer un résumés de discussion, en tenant compte du temps en jeu, des actions, des rencontres, des lieux, des objectifs du joueurs....

cette outils dépend de l'ia.
Elle produit 2 type de données :
- La mémoire de discussion
- La mémoire journalisée

## La mémoire de discussion

C'est un résumé inscrit dans la discussion qui permet de limiter l'antériorité du fil de discussion : elle se génère à partir du 7ème jour d'aventure et reprend les 14 jours anterieur, en somme elle résume un total de 14 jours, décalé du jours actuel de 7 jours.

    exemple : nous somme le jour 30 de l'aventure, si le joueur veux remonter le fil de discussion, il ne pourra le faire que jusqu'a arriver au jour 23 (30-7), a partir de la, c'est un texte narratif qui résume ce qui c'est passé du jour 22 au jour 8 (22-14). si l'utilisateur veux avoir plus de détail, il consulte l'onglet Journal.

Cette mémoire s'actualise des que le temps de jeu dépasse 24h00 aprés le précédent jour.

ouil en lien : timeAventure : qui calcul le temps passé (l'iaRuntime envoie une donnée de temps par action, et timeAventure ce charge de l'adittionner) et envoie l'information à memoriesAventure pour déclencher ou non un résumé

cette mémoire fonctionne grace au données journalisées. elle extrait les jour 

## La mémoire journalisée

   Fonctionnement générale :

- Elle extrait toutes les entrées du fil de discussion (et combat) du jour J

- Elle essaie de répondre aux questions simple:
    - Qui ?
    - Quand ?
    - Ou ?
    - Quoi ?
    - Comment ?
    - Pourquoi ?
    Et ça pour toutes les actions (avec de l'importance, sur lesquelle ont s'attarde) du joueur et autre personnage important, mais du point de vue du joueur ! (la gestion des intrigues/quêtes et géré ailleurs)

-  Elle génère un texte qui doit ressembler à la facon d'écrire du personnage ou de s'exprimer si le personnage ne c'est pas écrire.

-  Le texte est écrit dans la sauvegarde Core sous la forme de :

```ts
    Journal : {J1:"résumé"; J2:"..."}
```

## Cas : Activité longue / timeLaps

En cas d'une activité longue, le jeu passe en timelaps. 
elle empèche la mémoire de surchargé inutilement le journal en créent une multitude d'entrée vide
