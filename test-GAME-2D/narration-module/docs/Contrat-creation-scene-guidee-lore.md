# Contrat de préparation d'une scène guidée par le lore

Statut : `IMPLEMENTE — COMMANDE ET COMMIT ATOMIQUE PREPARES`

Version : `lore-guided-scene-creation-brief/1`

Dernière mise à jour : 2026-07-22

## Objet

Relier `lore-influence-packet/1` au pipeline générique de créations dynamiques sans permettre au lore initial ou à l'IA de modifier directement le monde.

L'adaptateur possède deux responsabilités :

1. superposer des projections de campagne déjà validées sur les influences du lore initial ;
2. convertir une candidate de lieu explicite en `DynamicCreationProposalV1` de type `PLACE`.

Il ne construit pas encore de `PlayableSceneStateV1` et ne persiste rien.

## Projection de campagne

`CampaignLoreProjectionV1` désigne le résultat d'un domaine de campagne, pas une sortie IA libre. Elle cible un couple exact `entityId + fieldPath` déjà présent dans le paquet d'influences.

Deux dispositions sont admises :

- `REPLACE` : une valeur courante de campagne remplace le texte initial pour cette création ;
- `WITHHOLD` : l'influence initiale ne doit plus être utilisée dans le brief.

Chaque projection porte :

- un identifiant unique ;
- une révision de campagne ;
- au moins une référence source ;
- une cible sélectionnée existante ;
- un texte de remplacement uniquement avec `REPLACE`.

Le port `CampaignLoreProjectionReaderV1` appartient contractuellement à `CampaignFactDomain`. Sa réponse doit correspondre exactement à la campagne et à la révision demandées. Son enveloppe de provenance doit couvrir toutes les références portées par les projections ; une réponse future, mal attribuée ou insuffisamment sourcée est rejetée.

Deux projections ne peuvent pas viser la même cible dans un brief. L'orchestrateur doit résoudre leur concurrence avant l'appel de l'adaptateur.

## Influence effective

Une influence non remplacée reste `LORE_INITIAL`. Une influence remplacée devient `CAMPAIGN_PROJECTION` et conserve à la fois :

- son texte initial ;
- son texte effectif ;
- la référence du fragment lore ;
- les références de campagne ;
- l'identifiant de projection appliqué.

Une influence masquée disparaît des contraintes et guides transmis, mais ses références de campagne restent dans la provenance globale du brief.

## Brief non committable

`LoreGuidedSceneCreationBriefV1` sépare :

- contraintes strictes de l'ancre ;
- guides locaux ;
- guides régionaux ;
- dimensions non couvertes ;
- références de lore et de campagne ;
- projections appliquées.

`nonCommittable` vaut toujours `true`. Ce brief peut alimenter un générateur ou un faux fournisseur de test, mais ne constitue ni une scène, ni un lieu, ni un événement.

## Candidate de lieu

`LoreGuidedPlaceCandidateV1` contient des propriétés créatives explicites :

- nom affiché ;
- résumé ;
- caractéristiques perceptibles ;
- rôles de population ;
- normes locales ;
- connexions ;
- profondeur de persistance demandée ;
- effets et engagements proposés ;
- politique de doublon.

L'adaptateur vérifie les champs obligatoires et exige au moins un engagement narratif pour `LIGHT_REFERENCE` ou `FULL_ENTITY`. Il ne juge pas encore la qualité littéraire ou la compatibilité topologique de ces valeurs.

## Sortie vers la création dynamique

Une candidate valide devient un `DynamicCreationProposalV1` :

- `proposalType = PLACE` ;
- ancre `LOCATION` obligatoire ;
- références du brief recopiées dans `existingFactRefsUsed` ;
- `SceneDomain` et `WorldDomain` toujours validateurs ;
- `CampaignFactDomain` ajouté pour une création persistante ;
- aucune décision de promotion prise par l'adaptateur.

Le validateur générique `validateDynamicCreationProposalV1` décide ensuite entre rejet, éphémère, référence légère ou entité complète selon la politique fournie.

## Gate topologie, doublon et persistance

`place-creation-validation/1` intervient après la validation générique et avant toute commande. Sa politique est fournie par les domaines propriétaires et contient :

- profondeurs de persistance autorisées ;
- parents géographiques autorisés ;
- scènes sources connues ;
- identités et alias de lieux connus ;
- plafond de connexions.

La candidate porte désormais une référence de lieu canonique, un parent canonique et des intentions de connexion structurées. Une connexion précise sa scène source, son passage canonique, son échelle et ses propres sources.

La gate rejette :

- une destination déjà connue par son identifiant ;
- un nom ou alias identique dans le même parent ;
- une destination déjà présente dans la topologie ;
- un parent ou une scène source non autorisé ;
- un passage déjà affecté ;
- des connexions ambiguës ou non sourcées ;
- un lieu topologique demandé comme `SCENE_EPHEMERAL` ;
- une profondeur interdite par la politique.

Une acceptation produit uniquement `READY_FOR_PLACE_COMMAND`, des additions topologiques proposées et `commitAuthority=false`. Les validateurs déclarés sont `WorldDomain`, `SceneDomain` et `CampaignFactDomain`.

## Commande `PLACE`

`place-creation-command/1` est préparée uniquement depuis une gate `READY_FOR_PLACE_COMMAND`. Elle épingle :

- campagne, opération et idempotence ;
- proposition dynamique complète ;
- identité et scène d'arrivée du lieu ;
- additions topologiques ;
- identifiants et révisions attendues des trois agrégats ;
- version attendue de la topologie ;
- références de provenance.

La commande conserve `commitAuthority=false`. Sa préparation refuse un lieu ou un fait déjà présent et vérifie que les trois agrégats appartiennent à la campagne demandée.

## Commit atomique

`buildPlaceCreationCommitV1` prépare un unique `CommitRequest` comprenant trois écritures versionnées :

| Agrégat | Propriétaire | Contenu ajouté |
|---|---|---|
| `world.place-registry` | `WorldDomain` | identité, parent, description et profondeur du lieu |
| `world.scene-topology` | `WorldDomain` / `SceneDomain` | connexions entrantes et sortantes validées |
| `campaign.place-facts` | `CampaignFactDomain` | engagements narratifs et provenance de campagne |

Le commit est refusé si une révision, une version topologique, une campagne ou une identité diffère de la commande préparée. Les payloads des trois agrégats et la topologie sont revalidés au moment de la préparation du commit. Aucun état source n'est muté en mémoire.

L'événement `world.place.created` reste `SYSTEM` : la création de l'entité ne constitue pas à elle seule une narration affichée ou un déplacement du joueur.

## Reconstruction post-commit

`buildDynamicPlaceSceneAfterCommitV1` exige que les trois agrégats :

- portent `updatedByCommitId` égal au commit confirmé ;
- apparaissent avec leur révision exacte dans `CommitRecord` ;
- contiennent le lieu, son fait et sa topologie committés.

La scène reconstruite utilise l'identité stable `arrivalSceneId`, les éléments perceptibles, la tension initiale, les normes locales et les sorties topologiques. Les rôles de population ne deviennent jamais automatiquement des PNJ présents.

Le `scene_writer` peut référencer les sources committées, mais ne peut ajouter un nouveau fait durable, un PNJ durable ou une connexion topologique.

## Preuve actuelle

`narration-module:test:lore-guided-scene` couvre :

- sélection réelle du corpus des Archives ;
- remplacement d'un fait initial par une projection de campagne sourcée ;
- maintien des guides du quartier et de la culture régionale ;
- production d'une candidate « Passage des Copistes » ;
- conversion vers `PLACE` ;
- validation en `PROMOTE_LIGHT_REFERENCE` ;
- lecture des projections via un port attribué à `CampaignFactDomain` ;
- préparation d'une connexion topologique vers `location:passage_des_copistes` ;
- rejet d'un doublon de nom dans le même quartier ;
- rejet d'une destination topologique éphémère ;
- préparation de `place-creation-command/1` avec révisions attendues ;
- préparation d'un `CommitRequest` à trois écritures, validé par le noyau ;
- rejet d'une révision d'agrégat obsolète ;
- reconstruction de `PlayableSceneStateV1` après commit confirmé ;
- refus de reconstruire depuis un agrégat non confirmé ;
- absence de matérialisation automatique des rôles de population en PNJ ;
- rejet d'une projection visant un champ absent ;
- rejet d'une candidate incomplète.

La rue du test reste une candidate contractuelle et n'est pas ajoutée au wiki ou à IndexedDB.

## Limites avant branchement jouable

- aucun adaptateur concret IndexedDB de `CampaignLoreProjectionReaderV1` n'est encore branché ;
- la détection de doublon textuel est exacte après normalisation, sans rapprochement sémantique ;
- aucune IA n'est appelée pour produire la candidate ;
- aucun runtime applicatif n'acquiert encore le lease et n'exécute le `CommitRequest` dans le repository ;
- la nouvelle scène n'est pas encore enregistrée dans un catalogue de scènes actives ni atteinte par le contrôleur joueur.

## Prochaine étape

Brancher un runtime applicatif qui relit les trois agrégats, acquiert le lease, prépare puis exécute ce commit dans le repository, et ne publie la scène reconstruite qu'après confirmation. Le branchement OpenAI vient après cette gate.
