# Contrat de transition locale de scène

Date : 2026-07-22

Statut : `IMPLEMENTE_RUNTIME_ORCHESTRE_NON_ACTIVE_UI`

Version : `scene-transition/1`

## Objectif

Ouvrir la première capacité métier post-consolidation : valider une transition entre une scène source et une destination canonique sans donner à la narration, à l'IA ou aux alias visibles l'autorité sur la géographie.

Ce socle ne committe encore aucun déplacement et ne construit pas la scène d'arrivée. L'adaptateur produit désormais une commande préparatoire `world-scene-transition-command/1` uniquement pour une connexion locale ouverte et validée.

## Autorités

- L'interpréteur fournit l'intention et les références candidates.
- Le registre de référents prouve que le passage visé est perceptible dans la scène.
- Une topologie issue du lore ou du monde fournit la connexion canonique.
- Le domaine `world` reste seul propriétaire de la position et du déplacement.
- Le futur préparateur temporel coordonnera position, temps et cycle de scène dans un commit atomique.
- Le `scene_writer` ne décrira l'arrivée qu'après confirmation du commit.

Les `destinationAliases` de `PlayableScenePointOfInterestV1` restent des aides publiques de résolution. Ils ne deviennent jamais des identifiants de destination.

## Décision structurée

`decideSceneTransitionV1` compare une `SceneTransitionRequestV1` à une `SceneTransitionTopologyV1` versionnée et retourne :

| Décision | Signification |
|---|---|
| `READY_FOR_LOCAL_COMMIT` | connexion locale ouverte, prête pour une future préparation atomique |
| `TRAVEL_HANDOFF_REQUIRED` | connexion entre ancres, à transmettre au `TravelProcess` |
| `BOUNDARY_STATE_REQUIRES_RESOLUTION` | passage bloqué ou inconnu, à résoudre avant déplacement |
| `DESTINATION_MISMATCH` | destination interprétée contradictoire avec la topologie |
| `CONNECTION_NOT_FOUND` | aucune connexion autoritaire |
| `AMBIGUOUS_CONNECTION` | plusieurs connexions concurrentes, clarification nécessaire |
| `STALE_SCENE_VERSION` | la scène a changé depuis l'intention |

Toutes les décisions portent `commitAuthority=false` et `requiredDomain=world`.

## Adaptateur lore et commande monde

`buildSceneTransitionTopologyFromLoreLocationV1` projette les relations `lieux_connectes` d'un lieu compilé en connexions canoniques :

- les références et versions proviennent de l'entité lore compilée ;
- l'état runtime reste `UNKNOWN`, car le lore ne sait pas si un passage est actuellement ouvert ;
- une connexion `external:*` est classée `TRAVEL` ;
- l'association au point d'intérêt utilise son identifiant déterministe, jamais son libellé ou sa position courante dans un tableau.

`prepareSceneTransitionWorldRequestV1` vérifie ensuite que le passage est un référent canonique, visible, présent et manipulable. Une décision locale `READY` produit `SceneTransitionWorldCommandV1` avec les versions attendues de scène, topologie et connexion, la provenance et la clé d'idempotence.

La commande porte `commitPolicy=DOMAIN_VALIDATED`, `timePolicy=WORLD_VALIDATED` et `commitAuthority=false`. Elle demande au domaine propriétaire de préparer le changement ; elle n'affirme pas qu'il a eu lieu.

## Résultat monde et composition atomique

Le domaine monde retourne un `WorldPreparedSceneTransitionV1`. Ce résultat confirme :

- la commande et la requête sources ;
- la destination canonique ;
- l'identité de la scène d'arrivée ;
- la durée validée et la seconde effective ;
- la révision attendue de `world.position` ;
- le payload de position produit par le propriétaire ;
- les sources d'autorité utilisées.

Le résultat doit déclarer `worldAuthority=true` et son `nextPositionPayload.canonicalLocationRef` doit correspondre exactement à la destination confirmée.

`augmentTemporalCommitWithSceneTransitionV1` ne crée pas une seconde avance temporelle. Il exige un `CommitRequest` déjà préparé par le noyau temporel I-03 et vérifie que son écriture `world.clock` atteint exactement la seconde effective. Il ajoute au même commit :

- l'écriture versionnée `world.position` ;
- l'écriture versionnée `scene.lifecycle` ;
- la commande monde acceptée ;
- l'événement joueur `world.scene-transition.completed`.

Le cycle `scene-lifecycle/1` conserve la scène active, sa destination, la scène précédente, l'instant d'entrée et la requête causale. La scène d'arrivée n'est pas encore mise en scène dans ce lot.

La composition est pure : elle ne modifie ni le commit temporel ni les agrégats sources. Une incohérence de version, de temps, de destination ou d'identité retourne un rejet sans écriture partielle. Le rejeu des mêmes entrées produit le même `CommitRequest` et conserve la clé d'idempotence du tour ; l'idempotence et l'atomicité physique sont ensuite garanties par `CampaignRepository.commit` déjà éprouvé par I-00/I-01/I-03.

## Reconstruction de la scène d'arrivée

`buildSceneArrivalAfterCommitV1` accepte une `PlayableSceneStateV1` reconstruite depuis le lore ou le monde et la confronte à l'état réellement committé.

La reconstruction exige :

- `world.position` et `scene.lifecycle` issus du même commit confirmé ;
- les révisions exactes des deux agrégats présentes dans `CommitRecord.aggregateWrites` ;
- une destination identique dans la position et le cycle de scène ;
- une identité de scène identique entre le cycle et la scène candidate ;
- une scène précédente distincte ;
- un instant d'entrée et une requête de transition causale ;
- au moins une source d'autorité lore ou monde.

La sortie `scene-arrival/1` porte `narrationStatus=READY_AFTER_COMMIT`, les références de reconstruction et une copie de la nouvelle scène jouable. Elle ne reprend pas la mise en scène de la scène précédente. Une continuation après combat ou repos devra suivre la même règle en reconstruisant depuis l'outcome réel.

Ce constructeur ne rédige aucune narration. Il établit uniquement la matière post-commit que le futur plan de rendu pourra transmettre au `scene_writer`.

## Plan de rendu d'arrivée

`buildSceneArrivalRenderPlanV1` transforme exclusivement un `scene-arrival/1` marqué `READY_AFTER_COMMIT` en plan `scene-social-ui/1` :

1. entrée joueur exacte ;
2. expression personnage exacte ;
3. narration MJ déterministe mais `AI_NARRATIVE_ALLOWED`, fondée sur les sources lore/monde et les agrégats committés ;
4. notification système déterministe avec destination, scène, durée et commit.

Le rythme rend ensuite la main au joueur avec `ASK_PLAYER`. Le fallback déterministe décrit seulement la situation, les présences et points d'intérêt de la nouvelle scène. Une future reformulation IA ne pourra utiliser que les mêmes sources.

## Port du contrôleur

`NarrativeTurnControllerV1` accepte maintenant un `NarrativeSceneTransitionRuntimeV1` injecté. Il l'appelle uniquement lorsque :

- l'intention canonique est `traverse_visible_boundary` ;
- une commande de domaine existe ;
- le registre runtime a sélectionné le domaine `world`.

Le runtime injecté doit retourner un commit confirmé, un `scene-arrival/1`, le paquet d'affichage post-commit, l'expression fidèle et la durée. Le contrôleur publie alors un résultat `COMMIT_APPLIED`, `noGameTime=false`, sans `npc_performer` automatique et sans repasser par le fallback `HANDOFF_REQUIRED`.

Sans runtime injecté, le comportement sûr existant reste inchangé : le domaine monde demeure fermé et la transition produit un handoff sans commit. Les constructions directes du contrôleur restent dans ce mode. Les fabriques du prototype mémoire et IndexedDB activent en revanche le port de l'auberge pour permettre la recette UI.

Le contenu testable demeure hors du runtime générique : `prototypeInnSceneTransitionContent.ts` déclare la topologie, la durée et la scène destination ; `prototypeSceneTransitionRuntime.ts` adapte ce contenu aux projections campagne et temps. Une scène jouable peut légitimement ne contenir aucun PNJ visible.

## Runtime orchestré

`createNarrativeSceneTransitionRuntimeV1` fournit l'implémentation concrète du port contrôleur. Il orchestre dans cet ordre :

1. passage de l'opération `RECEIVED` à `PREPARING`, puis `READY_TO_COMMIT` ;
2. lecture de la campagne courante ;
3. acquisition d'un lease d'écriture ;
4. appel du `SceneTransitionRuntimePreparationPortV1` propriétaire ;
5. composition atomique avec le commit temporel ;
6. vérification que le lease du commit est exactement celui acquis ;
7. `CampaignRepository.commit` ;
8. relecture de `world.position` et `scene.lifecycle` ;
9. construction de `scene-arrival/1` ;
10. construction du paquet d'affichage post-commit ;
11. libération du lease, succès ou échec.

Le port de préparation reste la seule dépendance métier à fournir. Il doit résoudre la connexion depuis la topologie de campagne, produire le résultat monde, préparer le temps via I-03 et fournir la scène destination issue du lore ou du monde. Le runtime générique ne contient aucun lieu, passage, durée ou texte spécifique.

Une transition locale utilise le mode temporel explicite `COMPOSITE_DOMAIN_COMMIT` : le batch I-03 cite l'identifiant de la commande monde, puis l'augmentation atomique refuse le commit si cette liaison ne correspond pas à la commande de transition effectivement ajoutée. Les opérations temporelles autonomes conservent l'exigence historique `time.segment` et son fingerprint dans la requête.

Une reconstruction impossible après commit est traitée comme une erreur d'intégrité de campagne, jamais comme une invitation à inventer une narration compensatoire.

## Invariants

- aucune recherche par mot-clé ou texte joueur dans le décideur ;
- aucune connexion créée depuis un alias de destination ;
- scène source, passage et destination utilisent des références canoniques ;
- topologie et scène sont versionnées ;
- une destination contradictoire est rejetée, jamais corrigée silencieusement ;
- un passage non ouvert ne produit aucun déplacement ;
- une connexion `TRAVEL` réutilise I-03D au lieu d'implémenter un second voyage ;
- une décision `READY` autorise seulement la préparation par le propriétaire, pas le commit.

## Preuve

Commandes : `npm run narration-module:test:scene-transition`, `npm run narration-module:test:lore-playable-scene`, `npm run narration-module:test:transition-ui` et, avec la configuration serveur opt-in, `npm run narration-module:test:transition-ui:openai-live`.

La matrice couvre transition locale, passage bloqué, voyage, destination contradictoire, version périmée, connexion absente et connexion ambiguë avec des identifiants génériques sans dépendance à la scène de l'auberge. Elle vérifie aussi la composition atomique avec le temps, la validation du `CommitRequest`, le rejeu identique, le rejet sans mutation d'une révision de position périmée et la reconstruction post-commit sans restauration de l'ancienne mise en scène.

## Prochaine étape

Les recettes navigateur locale et OpenAI live montent la vraie `NarrativeAppSurface` avec un contrôleur injecté. Elles vérifient l'arrivée, l'observation, l'approche de la lampe, l'examen des traces puis le retour dans la salle commune. La recette live contrôle directement les appels `scene_writer` et `coherence_critic`, leurs réponses HTTP 200 et l'absence de fallback local. Le passage validé le 2026-07-27 dure environ 2,9 minutes.

La frontière de présentation impose qu'une arrivée post-commit conserve sa narration d'arrivée et ne soit pas réécrite avec le contexte générique de la scène précédente. Le vertical prouve les deux transitions, la seconde arrivée à la seconde 16, le changement de registre actif et la révélation perceptive bornée sans origine inventée. `activeSceneNarrative.ts` exclut l'historique d'autres `sceneId` et rejette toute sortie qui déclare des faits, événements ou présences non fournis.

Prochaine étape : intégrer cette gate live dans une campagne de stabilité répétée et mesurer séparément la latence de `scene_writer` et de `coherence_critic`, sans l'ajouter aux tests ordinaires qui doivent rester sans coût fournisseur.
