# Contrat scène, social et interface conversationnelle

Statut : `FIGE` pour le sous-lot I-06A.

Version : `scene-social-ui/1`.

Date : 2026-07-07.

## Objectif

Ce contrat fixe la frontière entre scène narrative, connaissances sociales, journal d'interaction et affichage conversationnel.

Il empêche quatre erreurs critiques :

- faire du texte affiché une source de vérité;
- mélanger entrée brute, reformulation du personnage, réplique de PNJ et narration MJ;
- perdre l'attribution des locuteurs dans les dialogues multiples;
- rendre une clarification ou une question méta capable de muter le monde ou d'avancer le temps.

## Périmètre autorisé I-06A

I-06A peut produire :

- types TypeScript et validateurs stricts de `SceneDomain`, `SocialKnowledgeDomain`, `InteractionLog`, `RenderPlan` et `DisplayPacket`;
- projections déterministes à partir d'opérations, commits, événements et actes de parole;
- politiques de rythme configurables pour dialogues multiples;
- fixtures couvrant NAR-ACC-002 checkpoint B, NAR-ACC-009 et NAR-ACC-017;
- tests de reconstruction du transcript après perte du cache;
- tests d'accessibilité structurelle sans dépendre d'une couleur seule.

I-06A n'autorise pas encore :

- branchement complet dans React;
- streaming fournisseur;
- routage joueur vers OpenAI depuis l'UI;
- résolution tactique ou repos;
- certification UX finale;
- création d'intrigue complète jouable.

## Autorités

| Donnée | Propriétaire | Statut |
|---|---|---|
| état courant de scène | `SceneDomain` | autoritaire pour continuité locale |
| acteurs présents ou impliqués | `SceneDomain` par références | projection d'acteurs propriétaires |
| relation, réputation, dette, connaissance, croyance | `SocialKnowledgeDomain` | autoritaire pour perspective sociale |
| parole durable du PJ ou PNJ | domaine émetteur + événement committé | autoritaire seulement après commit |
| entrée brute joueur | `OperationRecord.requestPayload` | durable, non autoritaire sur le monde |
| prose visible | résultat technique de l'opération | projection non autoritaire |
| transcript consultable | `InteractionLog` | projection reconstructible |
| cache physique du transcript | adaptateur de stockage | optimisation supprimable |

Une scène peut référencer un lieu, un acteur, un fait ou un fil narratif. Elle ne recopie pas leur état complet et ne peut pas les modifier directement.

## `SceneDomain`

`SceneDomain` possède l'unité de continuité narrative locale.

Un `SceneStateV1` contient au minimum :

- `sceneId`;
- `campaignId`;
- `status` : `ACTIVE`, `SUSPENDED`, `CLOSED`;
- `locationRef`;
- `startedAtGameTime`;
- `lastRelevantGameTime`;
- `participantRefs[]`;
- `establishedStaging[]`;
- `activeThreadRefs[]`;
- `perceptionAnchors[]`;
- `sourceEventRefs[]`;
- `transitionCause`;
- `version`.

`establishedStaging[]` décrit uniquement ce qui a été établi comme perceptible ou comme texture autorisée. Une texture sensorielle non persistante doit être marquée comme telle et ne peut pas devenir plus tard une preuve ou un objet réutilisable sans événement de promotion.

Une transition de scène est valide seulement si elle est causée par :

- changement significatif de lieu;
- avance temporelle significative;
- changement d'acteurs ou d'enjeu;
- handoff système;
- reprise après tactique, repos ou ellipse;
- fermeture explicite d'une séquence.

## `SocialKnowledgeDomain`

`SocialKnowledgeDomain` possède les informations sociales subjectives.

Un `SocialKnowledgeStateV1` contient au minimum :

- `actorId`;
- `knownFactRefs[]`;
- `beliefs[]`;
- `relationshipEdges[]`;
- `reputationMarkers[]`;
- `debtsAndPromises[]`;
- `visibilityConstraints[]`;
- `sourceEventRefs[]`;
- `version`.

Une croyance peut être fausse. Une connaissance peut être incomplète. Ni l'une ni l'autre ne devient une vérité objective sans validation du domaine propriétaire du fait.

Les PNJ ne reçoivent et ne prononcent que des informations compatibles avec leur perspective. Une réplique qui révèle une connaissance non acquise est invalide, même si elle rendrait la scène plus claire.

## Entrée joueur, interprétation et expression validée

Le contrat distingue obligatoirement :

| Élément | Exemple | Usage |
|---|---|---|
| `rawInput` | `je sais pas` | audit, reprise, consultation |
| `interpretedIntent` | répondre avec ignorance à une question | planification, validation |
| `validatedPlayerExpression` | expression mise en rôle du PJ | affichage principal et acte de parole si commit |
| `playerSpeechAct` | parole durable avec cible, sens, engagement | événement committé si elle compte en jeu |

La reformulation du PJ peut adapter vocabulaire, posture et niveau de langage. Elle ne peut pas ajouter :

- information;
- promesse;
- menace;
- consentement;
- assurance;
- objectif;
- stratégie;
- prise de risque;
- action non demandée.

Si le joueur verrouille une formulation en demandant explicitement de prononcer ces mots, `validatedPlayerExpression.text` doit conserver cette formulation sauf impossibilité validée par règles, langue, état ou connaissance.

## Clarification et question méta

Une clarification pré-exécution produit :

- une opération durable en état suspendu;
- aucune mutation métier;
- aucune avance de temps;
- aucune réaction fictionnelle;
- une question minimale;
- une référence vers l'intention suspendue;
- les dépendances à revalider avant reprise.

Une réponse à clarification ouvre un nouvel échange mais référence l'intention suspendue. Le pipeline reconstruit toujours un nouveau `TurnSnapshot`; il ne réutilise pas un ancien paquet IA.

Une question méta ou une demande de rappel déjà acquise peut être journalisée dans l'opération et affichée. Elle ne produit pas de commit métier, sauf si le joueur transforme explicitement la question en action diégétique.

## Actes de parole

Un `SpeechActRecordV1` contient au minimum :

- `speechActId`;
- `operationId`;
- `sceneId`;
- `speakerRef`;
- `audienceRefs[]`;
- `language`;
- `text`;
- `semanticCommitments[]`;
- `knowledgeUsedRefs[]`;
- `sourceOutputId`;
- `visibility`;
- `eventRef`;
- `version`.

Le texte d'un acte de parole validé est exact. Le rédacteur visible ne le réécrit pas. Il peut seulement ajouter des blocs narratifs séparés autorisés par le `RenderPlan`.

## Locuteurs

Un `SpeakerRefV1` contient au minimum :

- `speakerId`;
- `kind` : `GM`, `PLAYER_CHARACTER`, `NPC`, `SYSTEM`;
- `actorRef` si applicable;
- `displayName`;
- `knownNameStatus` : `KNOWN`, `DESIGNATION`, `UNKNOWN`;
- `roleLabel`;
- `accessibilityLabel`;
- `visualToken`;

L'interface doit afficher au minimum un nom ou une désignation stable et un marqueur de rôle. La couleur peut aider mais ne peut jamais être le seul repère.

Un PNJ inconnu garde une désignation stable jusqu'à révélation validée. Exemple : `garde de la porte` ne devient pas `Marcel` tant qu'un événement de révélation ou connaissance ne le justifie.

## `RenderPlan`

Le `RenderPlanV1` est produit après validation ou commit. Il liste positivement ce qui peut apparaître.

Un `RenderPlanV1` contient :

- `operationId`;
- `sceneId`;
- `sourceRevision`;
- `blocks[]`;
- `rhythmDecision`;
- `fallbackAllowed`;
- `version`.

Chaque bloc contient :

- `blockId`;
- `kind` : `RAW_INPUT`, `PLAYER_EXPRESSION`, `GM_NARRATION`, `NPC_SPEECH`, `SYSTEM_NOTICE`, `CLARIFICATION`;
- `speakerRef`;
- `sourceRefs[]`;
- `groundedIn[]`;
- `textPolicy` : `EXACT`, `AI_NARRATIVE_ALLOWED`, `DETERMINISTIC_ONLY`;
- `visibility`;
- `order`.

Les blocs `PLAYER_EXPRESSION` et `NPC_SPEECH` validés utilisent `EXACT`. Le rédacteur ne peut pas les paraphraser.

Les blocs `GM_NARRATION` peuvent être rédigés par IA uniquement si leurs `groundedIn[]` référencent des résultats, perceptions, textures autorisées ou sources révélables.

## `DisplayPacket`

Le `DisplayPacketV1` est la projection envoyée à l'interface.

Il contient :

- `operationId`;
- `sceneId`;
- `displayBlocks[]`;
- `rawInputAccess`;
- `rhythmDiagnostics` en mode développement;
- `reconstructionRefs`;
- `version`.

Chaque `displayBlock` contient :

- `blockId`;
- `kind`;
- `speaker`;
- `text`;
- `ariaLabel`;
- `roleLabel`;
- `visualStyleToken`;
- `sourceRefs[]`;
- `isDegradedFallback`;

Un paquet d'affichage est invalide si deux locuteurs humains ou PNJ peuvent être confondus par texte et métadonnées hors couleur.

## `InteractionLog`

`InteractionLog` est reconstruit depuis :

- opérations reçues;
- résultats techniques d'opération;
- commits;
- événements;
- actes de parole;
- outbox de projection.

Un `InteractionLogEntryV1` contient :

- `entryId`;
- `campaignId`;
- `operationId`;
- `sceneId`;
- `gameTime`;
- `recordedAt`;
- `kind`;
- `speakerRef`;
- `text`;
- `sourceRefs[]`;
- `commitId`;
- `eventRefs[]`;
- `visibility`;
- `version`.

Le cache physique peut paginer, condenser ou archiver. Sa perte impose reconstruction ou affichage dégradé depuis les sources. Elle ne supprime jamais l'entrée brute, les actes de parole ou les résultats committés.

Le transcript ne doit pas être envoyé intégralement au modèle IA par défaut. La mémoire et le snapshot sélectionnent des capsules sourcées et budgétées.

## Dialogues multiples et rythme

Une `ConversationRhythmPolicyV1` contient :

- `maxAutomaticNpcTurns`;
- `maxNarrativeBlocksBeforePlayer`;
- `handoffOnDirectQuestionToPlayer`;
- `allowNpcInterruption`;
- `allowPlayerAsObserver`;
- `descriptionDensity`;
- `diagnosticsEnabled`;

Ces paramètres règlent uniquement le rythme et la présentation. Ils ne changent ni vérité, ni règles, ni issue mécanique.

La main revient au joueur quand :

- un PNJ attend une réponse directe;
- une nouvelle décision significative apparaît;
- une interruption change les options;
- le budget de rythme est atteint;
- une clarification est nécessaire;
- un handoff système commence.

Le silence du joueur ne vaut jamais autorisation de poursuivre indéfiniment.

## Apparence visible et commerce

Pour NAR-ACC-009, l'interface et la narration utilisent seulement les projections autoritaires :

- équipement porté;
- objet tenu;
- contenant accessible;
- monnaie physique accessible;
- état visible de tenue ou propreté si disponible;
- facteurs sociaux bornés produits par le domaine propriétaire.

Le contenu d'un sac fermé n'est pas décrit comme visible. Un objet possédé mais inaccessible ne peut pas être utilisé instantanément par la narration.

L'apparence peut influencer une scène sociale via un facteur contextuel. Elle ne modifie pas la caractéristique de Charisme.

## Rendu dégradé

Si la rédaction IA échoue après commit, un rendu déterministe utilise seulement :

- expression PJ validée;
- répliques exactes validées;
- résultats perceptibles;
- temps écoulé;
- notifications nécessaires;
- labels de locuteurs.

Ce rendu ne crée aucune texture, transition, objet, présence ou possibilité nouvelle. Il est marqué `isDegradedFallback` dans le paquet d'affichage et dans le diagnostic.

## Validation obligatoire

Avant affichage, le système vérifie :

1. contrat et version;
2. références existantes;
3. ordre stable des blocs;
4. identité et droits de connaissance des locuteurs;
5. absence de réécriture des blocs exacts;
6. absence de fait, objet, possibilité ou conséquence non autorisés;
7. absence de secret ou pensée privée non révélée;
8. distinction accessible des locuteurs;
9. reconstructibilité depuis sources durables;
10. absence d'avance temporelle pour méta ou clarification.

## Preuves minimales de sortie I-06A

La fermeture d'I-06A exige au minimum :

- validation stricte des types de scène, social, render plan, display packet et interaction log;
- fixture NAR-ACC-017 : entrée brute maladroite, expression PJ fidèle, deux PNJ distincts, attribution accessible;
- fixture NAR-ACC-002 checkpoint B : rencontre PNJ, second PNJ, résolution sociale et intrigue perceptible sans menu direct;
- fixture NAR-ACC-009 : apparence visible et inventaire projetés sans inventer de visibilité;
- perte simulée du cache transcript puis reconstruction depuis opérations, événements et actes de parole;
- clarification sans mutation et sans temps;
- rendu dégradé post-commit sans nouvelle vérité;
- régressions I-00 à I-05B maintenues.

## Décision

`scene-social-ui/1` résout AF-R16 au niveau contractuel pour I-06A.

Le prochain travail autorisé est limité au socle exécutable de scène, social, transcript et affichage typé. L'intégration React complète doit rester derrière ces preuves.
