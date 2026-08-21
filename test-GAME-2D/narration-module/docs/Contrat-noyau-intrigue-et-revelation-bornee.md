# Contrat du noyau d'intrigue et de la révélation bornée

Statut : `LIVRE`
Sous-lot : `6D`
Contrats cibles : `plot-registry/1`, `plot-evolution/1`,
`scene-event-bundle/1`, `plot-hypothesis/1`, `plot-resolution/1`

## Objectif

Faire évoluer une intrigue prévalidée lorsque le temps diégétique ou un
événement autoritaire rend une étape exigible, sans choisir sa vérité après
coup et sans envoyer son graphe privé au rédacteur.

Le module narration ne remplace ni l'horloge, ni `world-simulation`. Il possède
uniquement la cohérence et les engagements de l'intrigue.

## Trois écritures distinctes

1. La création committe la vérité privée, les engagements, les voies d'indice
   et la chronologie avant leur mise en scène.
2. L'évolution résout uniquement les étapes déjà planifiées et exigibles selon
   l'horloge autoritaire.
3. La révélation committe séparément le fait qu'un signe a été présenté ou
   qu'une information a été acquise par un canal autorisé.
4. La résolution exige les voies indépendantes déjà découvertes et la
   réfutation des fausses pistes avant de fermer l'intrigue.

Un texte narratif, une sortie IA ou le simple passage du temps réel ne produit
aucune de ces écritures.

## Solvabilité minimale

Chaque révélation indispensable possède au moins deux voies indépendantes.
Deux voies portant la même clé de dépendance ne comptent que pour une.

Une fausse piste éventuelle doit référencer une voie de réfutation existante.
La vérité centrale et les engagements sont immuables dans le premier vertical :
une correction exige plus tard un contrat de réparation tracée, jamais un
remplacement silencieux.

Une hypothèse du joueur est conservée sans autorité sur la vérité. La résolution
peut ensuite la marquer comme soutenue ou réfutée, mais seulement après une
décision sémantique contrôlée et la vérification locale des preuves découvertes.

## Évolution hors écran

Une étape planifiée porte :

- un instant `dueAtGameSecond` ;
- des causes committées ;
- un lieu ;
- un résultat privé ;
- zéro ou plusieurs effets classifiés.

L'horloge ne crée pas l'étape : elle la rend seulement exigible. Une étape
distante peut être résolue et committée sans aucune narration.

## Frontière de révélation

Chaque effet appartient à une catégorie :

- `IMMEDIATELY_VISIBLE` : signe directement observable dans la scène ;
- `INFERABLE` : signe observable, conclusion laissée ouverte ;
- `KNOWN_THROUGH_CHANNEL` : montrable seulement si le personnage possède la
  référence de canal requise ;
- `HIDDEN` : jamais transmis à la projection ;
- `DEFERRED` : pertinent mais volontairement reporté.

Le `SceneEventBundle` public ne contient ni vérité centrale, ni résultat privé,
ni effet caché, ni référence privée. Pour une inférence, il transporte le signe
et la modalité `INFERENCE`, pas la conclusion secrète.

## Raccord à la simulation mondiale

La simulation mondiale reste seule propriétaire de ses décisions, événements
et deltas. Le raccord narration lit uniquement les événements
`WORLD_SIMULATION` déjà committés. Il ne relance pas le moteur et ne déduit
aucune nouvelle conséquence.

Seuls les signaux dont la localisation correspond aux références autoritaires
de la scène peuvent devenir des perceptions. L'adaptateur conserve leur
identité, leur type, leur intensité et leur instant causal. Il exclut les
événements internes, deltas, acteurs, actions, objectifs, tags et payloads.

Le résolveur reliant une scène narrative aux références du monde est injecté :
aucune correspondance de lieu n'est devinée ou codée dans le noyau.

## Bundle causal et restitution de la main

Les perceptions d'intrigue et du monde sont dédupliquées puis ordonnées par
temps diégétique et ordre causal dans un unique `SceneEventBundle`. La
projection vérifie que chaque opération source est committée avant affichage.

Une échéance mondiale reste une frontière de l'avance temporelle existante.
Lorsqu'un signal local exige une décision, le bundle porte
`INTERRUPT_FOR_PLAYER_DECISION`, la scène est rendue, aucune continuation
automatique n'est lancée et la saisie joueur reste disponible.

## Vertical de preuve

Fixture de preuve :

- la vérité privée établit qui a déplacé un registre et où ;
- une étape planifiée est résolue pendant une absence vécue en jeu ;
- son résultat privé reste dans l'agrégat et l'événement `MJ_PRIVATE` ;
- au retour, seule une rupture visible dans la poussière de l'étagère entre
  dans le bundle ;
- un second événement distant reste committé mais absent du bundle ;
- rejeu et temps réel ne doublent aucune conséquence.

## Hors périmètre de 6D

- génération IA d'un graphe complet ;
- correction/retcon d'une vérité déjà committée ;
- résolution simultanée de plusieurs intrigues partageant une preuve ;
- génération d'une prose riche par `scene_writer` à partir des seuls signes
  sûrs ;
- catalogue de correspondances scène/monde propre à chaque campagne.

Ces extensions ne changent pas la frontière d'autorité livrée. La gate 6V doit
maintenant certifier le parcours transverse avant l'ouverture de 6E.

## État d'implémentation

Sous-lot livré :

- agrégat privé `narrative.plot-registry` ;
- création atomique et idempotente ;
- validation des deux voies indépendantes et des réfutations ;
- évolution déterministe des étapes exigibles depuis `CampaignClock` ;
- événements d'évolution `MJ_PRIVATE` sans résultat secret recopié ;
- composition `scene-event-bundle/1` filtrée par scène et canal de
  connaissance ;
- révélation `PLAYER_VISIBLE` committée séparément ;
- projection narrative persistée et restauration sans répétition ;
- adaptation des seuls signaux perceptibles d'événements
  `WORLD_SIMULATION` committés, sans leurs événements, deltas ou données
  privées ;
- composition intrigue/monde dans un bundle causal commun ;
- arrêt sur frontière temporelle, signal d'interruption et restitution de la
  saisie au joueur ;
- tests `narration-module:test:plot-authority` et
  `narration-module:test:plot-evolution-ui` ;
- tests `narration-module:test:world-scene-events` et
  `narration-module:test:world-event-ui`, couvrant ordre causal, absence de
  fuite, interruption, rendu et rechargement.
