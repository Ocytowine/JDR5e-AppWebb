# Population ambiante et arrivée narrative

## But

Une scène dynamique ne doit ni réciter les rôles de population comme une liste technique, ni promouvoir automatiquement chaque silhouette en PNJ durable. Elle doit paraître habitée, permettre au joueur de cibler une présence et conserver assez de matière structurée pour que `npc_performer` lui donne un caractère cohérent.

## Séparation de l'état de scène

`PlayableSceneStateV1` distingue désormais :

- `ambientPopulation` : présences visibles issues des rôles de population ;
- `presentNpc` : figures déjà individualisées par le contenu ou un futur mécanisme de promotion.

Une présence ambiante possède un identifiant stable dérivé de `arrivalSceneId`. Le registre de référents l'expose comme cible visible pour la parole, l'observation et les signaux non verbaux. Elle ne crée cependant aucune entité de campagne.

Chaque amorce locale contient :

- rôle, activité et apparence visibles ;
- allure ;
- objectif immédiat ;
- pression courante ;
- style de parole ;
- sujets de conversation possibles ;
- limites d'interprétation ;
- références de connaissance autorisées.

Ces champs guident `npc_performer`. Ils ne sont pas récités au joueur et ne constituent ni un secret ni un engagement durable.

## Arrivée post-commit

Le pipeline d'arrivée est :

1. validation de la création ou de la transition ;
2. commit monde ;
3. reconstruction autoritaire de la scène destination ;
4. rendu déterministe de secours ;
5. appel facultatif de `scene_writer` avec la scène destination active ;
6. contrôle de discipline factuelle ;
7. projection visible.

Le writer est refusé si `activeScene.sceneId` ne correspond pas à la scène reconstruite par `sceneArrival`. Il ne reçoit pas l'ancienne scène comme source active.

`ambientPopulation` doit être racontée comme une foule en mouvement. Le writer ne doit jamais produire une rubrique « Présences visibles » suivie d'un inventaire. `presentNpc` peut être mis au premier plan sans biographie ou action inventée.

## Fallback local

Sans writer utilisable, le rendu local :

- sélectionne au plus trois activités ambiantes ;
- les relie dans une phrase ;
- signale le reste du mouvement collectif sans énumération exhaustive ;
- conserve les passages, la tension et les faits de scène.

## Frontières d'autorité

- aucune présence ambiante n'est un PNJ durable ;
- aucune personnalité locale ne crée un fait caché ;
- aucune réponse ne peut dépasser `knowledgeRefs` et les sources du tour ;
- le performer ne décide ni succès social, ni mutation, ni temps ;
- la promotion `SCENE_ACTOR` est une opération runtime explicite, déclenchée uniquement par une parole réellement adressée à une présence ambiante ;
- la future promotion `CAMPAIGN_NPC` restera une opération distincte et plus exigeante.

## Promotion en acteur de scène

La première parole committable adressée à une présence ambiante écrit un registre
`scene.actor-registry`, propre à la scène, dans le même commit atomique que l'acte
de parole. Le registre conserve l'identifiant, le rôle public et toute l'amorce de
personnalité. Il ne crée pas d'entité de campagne.

Lors de chaque résolution de scène, le runtime :

1. relit le registre de la scène active ;
2. retire les acteurs promus de `ambientPopulation` ;
3. les projette dans `presentNpc` avec le même identifiant ;
4. expose leur caractère au `npc_performer`.

La mémoire courte existante reste indexée par cet identifiant stable. Une sortie
puis un retour reconstruisent donc la même figure et permettent de rattacher les
échanges précédents au bon interlocuteur.

## Suite

Le prochain lot définira les critères de promotion volontaire d'un `SCENE_ACTOR`
en `CAMPAIGN_NPC` : implication durable, relation suivie, déplacement hors de sa
scène d'origine ou rôle reconnu par le monde. Une recette UI sortie-retour avec
dialogue long devra précéder cette extension.
