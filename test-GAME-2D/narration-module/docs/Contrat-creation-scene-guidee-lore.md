# Contrat de préparation d'une scène guidée par le lore

Statut : `IMPLEMENTE — RUNTIME TRANSACTIONNEL ET CATALOGUE DYNAMIQUE`

Version : `lore-guided-scene-creation-brief/1`

Dernière mise à jour : 2026-07-22

## Objet

Relier `lore-influence-packet/1` au pipeline générique de créations dynamiques sans permettre au lore initial ou à l'IA de modifier directement le monde.

L'adaptateur possède deux responsabilités :

1. superposer des projections de campagne déjà validées sur les influences du lore initial ;
2. convertir une candidate de lieu explicite en `DynamicCreationProposalV1` de type `PLACE`.

L'étape créative reste non committable. Seul le runtime transactionnel, après toutes les validations métier, peut persister la proposition et reconstruire un `PlayableSceneStateV1` depuis les agrégats confirmés.

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

## Portée réelle de la plausibilité d'une destination joueur

Le runtime actif distingue deux situations :

- une sortie visible expose une destination publique encore absente de la
  topologie : le `scene_creator` peut matérialiser cette destination ;
- l'interpréteur propose une destination locale non encore référencée sous la
  forme `requested-destination:*` : le même pipeline créatif peut actuellement
  être ouvert.

Les gates actives prouvent la compatibilité avec les contraintes de lore
transmises, le parent géographique autorisé, la profondeur de persistance, les
doublons, les identités connues, les connexions et le commit atomique. Pour une
destination déjà nommée par une sortie visible ou proposée explicitement par le
joueur, la candidate acceptée doit désormais conserver exactement cette
identité : demander la « Place des Archives » ne peut plus produire un lieu
distinct appelé « Passage de la Place des Archives ». Le passage appartient au
cheminement, pas à l'identité de la destination. Cette fidélité nominale
n'établit toutefois pas à elle seule que le lieu proposé est plausible.

En revanche, la version actuelle ne produit pas encore de décision structurée
et indépendante sur la plausibilité sémantique d'un lieu entièrement proposé
par le joueur. Elle ne classe pas explicitement une demande comme locale,
lointaine, contradictoire avec le lore, ambiguë ou plausible sous condition. Le
`scene_creator` reçoit les contraintes et peut refuser une sortie incompatible,
mais son champ `reason` n'est pas une autorité de plausibilité.

Cette limite est importante : les protections topologiques actives ne doivent
pas être présentées comme une validation complète de la cohérence fictionnelle.
Un futur contrat devra rendre cette décision explicite avant tout appel de
création et choisir entre création locale, clarification, handoff de voyage ou
refus sourcé.

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

La scène reconstruite utilise l'identité stable `arrivalSceneId`, les éléments perceptibles, la tension initiale, les normes locales et les sorties topologiques. Chaque rôle de population rejoint `ambientPopulation` avec un identifiant stable dérivé de `arrivalSceneId`, afin qu'un rôle annoncé au joueur soit immédiatement ciblable sans encombrer `presentNpc`. Cette projection reçoit une amorce locale de personnalité, mais ne crée ni entité de personnage durable, ni fait de campagne supplémentaire. Voir `Contrat-population-ambiante-et-arrivee-narrative.md`.

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
- matérialisation des rôles annoncés en présences locales ciblables, sans promotion en entités durables ;
- rejet d'une projection visant un champ absent ;
- rejet d'une candidate incomplète.

La rue du test reste une candidate contractuelle et n'est pas ajoutée au wiki ou à IndexedDB.

## Limites avant branchement au contrôleur

- aucun adaptateur concret IndexedDB de `CampaignLoreProjectionReaderV1` n'est encore branché ;
- la détection de doublon textuel est exacte après normalisation, sans rapprochement sémantique ;
- les adaptateurs de préparation production doivent encore relier le corpus wiki et le domaine monde du prototype à l'assembleur transactionnel ;
- la candidate IA est couverte par contrat et faux provider, mais sa recette OpenAI live reste à exécuter.

## Prochaine étape

Fournir les adaptateurs de préparation du prototype, puis tester le parcours OpenAI live complet vers un lieu absent de la topologie.

## Branchement runtime transactionnel

Le contrat est désormais exécuté par `placeCreationRuntime.ts` après validation de la proposition. Ce runtime ne crée ni prose ni lore : il relit les registres courants, acquiert un lease d'écriture, prépare le commit atomique lieu/topologie/faits, l'applique une seule fois, puis relit les trois agrégats avant de reconstruire la scène jouable. Une erreur de persistance dont l'issue est inconnue est réconciliée par la clé d'idempotence avant toute nouvelle tentative.

`sceneCatalog.ts` fournit ensuite une façade de lecture unique. Elle consulte les sources préparées, les scènes wiki, puis les lieux dynamiques de campagne. Elle ne possède aucune base parallèle : une scène dynamique est reconstruite depuis les agrégats confirmés du repository et leur commit commun le plus récent.

## Génération de candidate et contrôleur

`scene_creator` est un rôle IA séparé. Le contrat actif `lore-guided-place-candidate/2` reçoit le brief borné, la scène source et la destination demandée, puis produit uniquement une `LoreGuidedPlaceCandidateV2` créative, sans connexion. Son schéma serveur est strict et son résultat repasse obligatoirement par `buildDynamicPlaceCreationProposalV2`; il n'a ni autorité topologique, ni autorité de validation métier, ni autorité de commit. `lore-guided-place-candidate/1` reste accepté comme contrat de compatibilité et conserve son validateur dédié.

Le contrôleur expose `NarrativeDynamicPlaceRuntimeV1`. Sa méthode `canHandle` reçoit l'intention structurée, la commande de domaine et la scène active : la détection appartient donc au domaine monde, sans analyse lexicale ajoutée au contrôleur. La suite Chromium confirme également qu'un lieu dynamique committé dans IndexedDB est reconstruit par le catalogue sans stockage parallèle ni PNJ implicite.

`dynamicPlaceEntryRuntime.ts` fournit l'assembleur transactionnel de cette capacité. Il fusionne le commit de création avec le segment temporel préparé par le domaine monde, puis ajoute position et cycle de scène. Horloge, lieu, topologie, faits, position et scène active sont ainsi publiés dans un seul commit. Après écriture, les cinq agrégats métier concernés sont relus et la narration d'arrivée n'est construite que si la création et l'entrée portent le même `commitId` confirmé.

Les `requestId` et `commandId` de cette transition sont dérivés d'une empreinte
déterministe de l'`operationId`. Ils restent ainsi sous la limite des identifiants
du noyau, quelle que soit la longueur valide de l'opération source. La causalité
continue de relier explicitement commande et événement ; elle ne dépend pas de
la concaténation de leurs libellés. Il ne faut donc ni concaténer sans borne
l'identifiant d'opération, ni relâcher le schéma commun pour ce seul runtime.

La préparation est divisée en deux phases. `prepareCreative` exécute la sélection du lore, l'éventuel appel IA et les gates sans lease d'écriture. `prepareWorldCommit` relit et prépare les artefacts monde/temps sous lease juste avant le commit. Une latence fournisseur ne peut donc pas immobiliser inutilement l'écrivain de campagne.

`loreGuidedDynamicPlacePreparation.ts` fournit l'adaptateur de production entre ces deux phases. Le port de contexte doit livrer un brief de lore, les politiques génériques et `PLACE`, la topologie courante et la configuration du générateur. L'adaptateur appelle alors `scene_creator`, valide la proposition générique, valide le lieu et transmet uniquement le résultat accepté au port monde. Le port monde reste seul responsable du segment temporel, de la position et du cycle de scène.

Cette injection est intentionnelle : une scène sans ancrage géographique fiable, comme l'actuelle fixture isolée de l'Auberge du Seuil, ne reçoit pas artificiellement une ville ou une rue codée en dur. La capacité devient active dès que l'assemblage applicatif fournit un contexte de lore réel pour la scène source.
