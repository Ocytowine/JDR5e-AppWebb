# Population ambiante et arrivée narrative

La manière de nommer ces présences est définie par
`Contrat-designation-narrative-acteurs-et-lieux.md`. Une présence générée depuis
un rôle probable reçoit une désignation visible stable, jamais ce rôle brut
comme faux nom propre.

## But

Une scène dynamique ne doit ni réciter les rôles de population comme une liste technique, ni promouvoir automatiquement chaque silhouette en PNJ durable. Elle doit paraître habitée, permettre au joueur de cibler une présence et conserver assez de matière structurée pour que `npc_performer` lui donne un caractère cohérent.

## Séparation de l'état de scène

`PlayableSceneStateV1` distingue désormais :

- `ambientPopulation` : présences visibles issues des rôles de population ;
- `presentNpc` : figures déjà individualisées par le contenu ou un futur mécanisme de promotion.

Une présence ambiante possède un identifiant stable dérivé de `arrivalSceneId`. Le registre de référents l'expose comme cible visible pour la parole, l'observation et les signaux non verbaux. Elle ne crée cependant aucune entité de campagne.

Cette règle s'applique aussi aux scènes directement adaptées depuis un lieu du wiki. Un `profil_presence.roles_probables` décrit une distribution locale : il ne prouve ni l'existence d'un PNJ individualisé, ni un nombre exhaustif d'occupants. L'adaptateur retient au plus trois rôles probables pondérés comme présences représentatives dans `ambientPopulation`, laisse `presentNpc` vide en l'absence de figure canonique et signale narrativement que d'autres silhouettes entretiennent le mouvement du lieu.

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

La même construction de présence et la même narration collective sont partagées par les lieux wiki et les lieux dynamiques afin d'éviter deux interprétations concurrentes de la population.

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

## Recette UI sortie-retour

La recette `npc-return-ui` monte la vraie `NarrativeAppSurface` avec une présence
ambiante locale. Elle vérifie :

- trois prises de parole adressées au même acteur ;
- la promotion `SCENE_ACTOR` lors du premier acte committable ;
- une transition vers une autre scène puis le retour ;
- la reconstruction du même nom et du même identifiant ;
- trois intentions antérieures retrouvées par le dernier tour ;
- l'absence de repli vers un locuteur générique `Interlocuteur`.

Commande : `npm run narration-module:test:npc-return-ui`.

## Critères de promotion `CAMPAIGN_NPC`

Une promotion de campagne ne peut pas être déduite du nombre de répliques, d'un
retour dans la scène ou de l'appréciation du modèle. Elle exige :

1. un acteur déjà présent dans `scene.actor-registry` ;
2. une cause durable explicite appartenant à un domaine autoritaire ;
3. une source publique et reconstructible pour cette cause ;
4. une commande volontaire distincte de l'acte de parole ;
5. un identifiant de campagne stable et une opération idempotente.

Les causes admissibles seront limitées à :

- relation suivie confirmée par le domaine social ;
- mission, dette ou engagement durable accepté ;
- déplacement autorisé hors de la scène d'origine ;
- fonction reconnue par l'état du monde ou une faction.

Ne sont jamais suffisants seuls : fréquence des dialogues, attribution d'un nom
par l'IA, détail de personnalité, présence dans la mémoire courte ou préférence
du joueur non encore traduite en commande.

La future commande devra copier uniquement les faits publics et les sources
autorisées du `SCENE_ACTOR`. Elle ne pourra ni transformer ses amorces en faits
cachés, ni supprimer le registre local avant confirmation atomique du nouvel
agrégat de campagne.

## Premier incrément `campaign-npc-promotion-command/1`

Le contrat applicatif et l'état propriétaire `campaign-npc-registry/1` sont
implémentés. La préparation :

- exige un `SceneActorRecordV1` déjà promu ;
- contrôle la correspondance entre cause et domaine autoritaire ;
- refuse les références `secret:`, `private:` et `hidden:` ;
- construit un identifiant `campaign-npc:*` stable depuis l'acteur local ;
- copie uniquement identité, rôle et apparence visibles ;
- laisse les objectifs, pressions et amorces de personnalité hors des faits de
  campagne ;
- produit `commitAuthority: false` et la révision attendue du registre ;
- rejoue en `ALREADY_PROMOTED` sans seconde commande ni doublon.

Commande de vérification :
`npm run narration-module:test:campaign-npc-promotion`.

## Commit atomique et reconstruction

`prepareCampaignNpcPromotionCommitV1` transforme une préparation valide en un
unique `CommitRequest`. Ce commit contient ensemble :

- la commande acceptée `campaign.promote-scene-actor` ;
- l'écriture révisionnée de `campaign.npc-registry` ;
- l'événement joueur visible `campaign.npc.promoted`.

Le repository garantit le rejeu du même commit sans doublon. La préparation
refuse aussi un registre courant dont l'identité ou la révision ne correspond
pas à la commande.

Exemple : si le copiste accepte de recopier un journal perdu, son identité de
campagne et l'événement public lié à cet engagement sont enregistrés ensemble.
Si un autre processus modifie le registre juste avant, la promotion entière est
refusée et doit être recalculée.

`projectCampaignNpcsIntoSceneV1` permet ensuite à un domaine autoritaire de
déclarer ce PNJ présent dans une autre scène. Cette reconstruction restaure son
identité publique, mais pas ses objectifs ou pressions locales, qui n'ont jamais
été promus en faits de campagne.

Commande de vérification :
`npm run narration-module:test:campaign-npc-promotion-commit`.

## Raccord au contrôleur narratif

Le contrôleur expose désormais la commande explicite `promoteSceneActor`. Elle
ne reçoit pas une simple interprétation IA, mais une confirmation
`durable-npc-cause-confirmation/1` produite par le domaine propriétaire.

Le runtime :

1. calcule une opération idempotente depuis la requête cliente ;
2. relit le `scene.actor-registry` au lieu de faire confiance au nom fourni ;
3. vérifie la confirmation et sa cause durable ;
4. relit le registre des PNJ de campagne et sa révision ;
5. prépare puis exécute le commit atomique ;
6. restaure le résultat au rejeu sans second événement.

La recette `npc-return-ui` couvre maintenant aussi ce raccord. Après le retour
et la reprise du dialogue, une confirmation du domaine mission promeut le
copiste. Le même appel rejoué retourne le même PNJ avec `replayed: true`.

Exemple : « le copiste accepte de recopier le journal perdu » ne devient durable
que si le domaine mission fournit `quest:copy-lost-journal` et l'événement
public d'acceptation. Une prose du MJ disant qu'il semble intéressé ne suffit
pas.

## Raccord mission/relation livré

Le domaine mission/relation transforme maintenant une proposition en décision
persistée. Seule une décision `ACCEPTED`, retrouvée dans son registre
propriétaire, émet la confirmation nécessaire à la promotion.

Les décisions `REFUSED`, `CONDITIONAL` et `UNCERTAIN` restent enregistrées sans
promouvoir l'acteur. Une confirmation fabriquée par l'appelant est rejetée.
Voir
[`Contrat-autorite-mission-relation.md`](Contrat-autorite-mission-relation.md).
