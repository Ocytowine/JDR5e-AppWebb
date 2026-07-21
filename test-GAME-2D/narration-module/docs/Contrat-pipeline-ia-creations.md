# Contrat pipeline IA et créations dynamiques

Statut : `FIGE` — autorise l'implémentation I-05A, sans fournisseur IA réel.

Version du contrat : `ai-pipeline/1`

Ce document résout AF-R10, AF-R11, AF-R15 et AF-C02 pour le premier sous-lot I-05. Il fixe les enveloppes d'appel, les sorties par rôle, les reprises, les incidents, les permissions de création et les preuves attendues avant tout branchement fournisseur.

## 1. Résultat attendu

I-05A doit permettre d'exécuter un tour narratif contre un faux fournisseur contractuel déterministe.

Le module reçoit :

- un `RoleContextPackV1`;
- un rôle IA autorisé;
- une configuration de modèle certifiée pour ce rôle;
- une politique de retry et de circuit;
- une intention ou tâche structurée;
- des permissions de création et de révélation issues du contexte.

Il produit :

- une enveloppe d'appel `AiCallRequestV1`;
- une tentative `AiAttemptRecordV1`;
- une sortie `AiRoleOutputEnvelopeV1` strictement validée;
- un résultat de validation `AiOutputValidationResultV1`;
- des propositions structurées non autoritaires;
- des incidents expurgés si nécessaire.

Une sortie IA ne mute jamais directement la campagne. Elle devient exploitable uniquement après validation par les domaines propriétaires et commit atomique.

## 2. Frontières d'autorité

Le pipeline IA n'est pas une source d'autorité métier.

Sont autoritaires :

- `CampaignRepository`;
- agrégats et événements committés;
- ruleset versionné;
- contenu lore épinglé;
- contrats de contexte I-04;
- validateurs déterministes;
- domaines propriétaires futurs.

Sont non autoritaires :

- prompts;
- réponse brute du fournisseur;
- diagnostics du modèle;
- confiance déclarée;
- prose candidate;
- proposition de création;
- critique IA;
- résumé ou mémoire dérivée.

Le faux fournisseur contractuel est autorisé en I-05A. Un fournisseur réel reste interdit jusqu'à certification spécifique du modèle, du rôle, du contrat, des secrets et des métriques.

## 3. Configuration de rôle et fournisseur

```ts
type AiRoleV1 =
  | "intent_interpreter"
  | "mj_planner"
  | "player_expression_adapter"
  | "npc_performer"
  | "rules_adjudicator"
  | "coherence_critic"
  | "scene_writer"
  | "clarification_writer";

interface AiModelRouteV1 {
  schemaVersion: 1;
  routeId: string;
  role: AiRoleV1;
  providerKind: "FAKE_CONTRACT" | "REMOTE_PROVIDER";
  providerId: string;
  modelId: string;
  modelConfigVersion: string;
  certified: boolean;
  allowedContractVersions: string[];
  inputTokenLimit: number;
  outputTokenLimit: number;
  timeoutMs: number;
  fallbackRouteIds: string[];
}
```

Contraintes :

- `REMOTE_PROVIDER` est interdit en I-05A;
- `certified` doit être `true` pour tout fallback;
- un fallback ne peut servir que le même rôle, les mêmes contrats et des permissions au plus équivalentes;
- aucune clé fournisseur ne peut être stockée dans la campagne, le navigateur, un export ou un diagnostic.

## 4. Enveloppe d'appel

```ts
interface AiCallRequestV1 {
  schemaVersion: 1;
  callId: string;
  operationId: string;
  attemptId: string;
  campaignId: string;
  snapshotId: string;
  packId: string;
  role: AiRoleV1;
  contractVersion: string;
  modelRouteId: string;
  contextFingerprint: `sha256:${string}`;
  idempotencyKey: string;
  input: {
    instructionsRef: string;
    roleContextPack: unknown;
    task: unknown;
  };
  limits: {
    inputTokenBudget: number;
    outputTokenBudget: number;
    timeoutMs: number;
  };
}
```

`instructionsRef` référence une politique versionnée. Les instructions système ne sont pas construites par concaténation de texte joueur, lore ou mémoire.

## 5. Enveloppe de sortie commune

```ts
type AiOutputStatusV1 =
  | "OK"
  | "NEEDS_CLARIFICATION"
  | "CANNOT_COMPLY"
  | "REFUSED"
  | "PARTIAL_UNUSABLE";

interface AiRoleOutputEnvelopeV1<TPayload> {
  schemaVersion: 1;
  contractVersion: string;
  outputId: string;
  callId: string;
  attemptId: string;
  packId: string;
  snapshotId: string;
  role: AiRoleV1;
  status: AiOutputStatusV1;
  payload: TPayload;
  diagnostics: AiOutputDiagnosticV1[];
  supersedesOutputId: string | null;
}

interface AiOutputDiagnosticV1 {
  code: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  message: string;
  sourceRefs: string[];
}
```

Le parseur est strict :

- JSON unique;
- aucun Markdown autour;
- version connue;
- aucun champ inconnu;
- corrélation exacte `callId`, `attemptId`, `packId`, `snapshotId`, `role`;
- tout identifiant référencé doit être résolvable ou explicitement marqué comme proposition.

Une réponse libre ou partiellement parseable est rejetée en entier.

## 6. Payloads par rôle

### 6.1 `intent_interpreter`

```ts
interface IntentInterpreterPayloadV1 {
  intents: PlayerIntentV1[];
  suspendedIntent: SuspendedIntentV1 | null;
}

interface PlayerIntentV1 {
  intentId: string;
  order: number;
  intentType:
    | "speech"
    | "action"
    | "meta_question"
    | "possibility_query"
    | "memory_recall"
    | "correction"
    | "technical_command";
  commitment: "none" | "hypothetical" | "conditional" | "committed";
  targets: string[];
  coreMeaning: string;
  desiredOutcome: string | null;
  requiredDetails: string[];
  openDetails: string[];
  forbiddenInterpretations: string[];
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  expectedTimeEffect: "NO_GAME_TIME" | "DOMAIN_TO_DECIDE";
}
```

Un `possibility_query` ou `meta_question` avec `commitment: "none"` interdit toute commande métier.

### 6.2 `mj_planner`

```ts
interface MjPlannerPayloadV1 {
  sceneBeats: SceneBeatProposalV1[];
  commandProposals: DomainCommandProposalV1[];
  creationProposals: DynamicCreationProposalV1[];
  actorAssignments: ActorAssignmentV1[];
  revealPlan: {
    reveal: string[];
    hint: string[];
    withhold: string[];
  };
  timeAdvanceProposal: TimeAdvanceProposalRefV1 | null;
  playerHandoff: PlayerHandoffProposalV1;
  riskFlags: string[];
  respectedCommitmentRefs: string[];
}
```

Le planificateur ne produit pas de prose finale. Il peut proposer, jamais décider.

### 6.3 `player_expression_adapter`

```ts
interface PlayerExpressionPayloadV1 {
  intentId: string;
  expressionKind: "speech" | "gesture" | "action_staging";
  renderedExpression: string;
  meaningCovered: string[];
  addedMeaning: string[];
  omittedMeaning: string[];
  styleChoices: string[];
  safeToUse: boolean;
}
```

La validation rejette tout ajout d'objectif, consentement, connaissance, certitude, action ou risque absent de l'intention source.

### 6.4 `npc_performer`

Le tour de dialogue fournit un acte sémantique explicite parmi `INITIATE_CONVERSATION`, `ASK_QUESTION`, `MAKE_STATEMENT`, `REQUEST_ACTION` et `OTHER`. Une ouverture de contact n'est donc pas une question implicite et une affirmation du joueur ne doit pas être reformulée comme une demande.

Le paquet du performer sépare les faits publics, les paroles antérieures du joueur et les répliques PNJ réellement disponibles. `priorNpcUtterances` est reconstruit exclusivement depuis les blocs `NPC_SPEECH` des projections finales persistées, avec leur opération source, leur opération de rendu et l'empreinte du paquet affiché. Une parole ainsi rappelée reste attribuée au PNJ et ne devient pas une vérité objective. En l'absence de projection correspondante, le modèle ne peut pas écrire qu'il se répète, que sa réponse ne change pas ou qu'il a déjà fourni une information.

La validation locale limite désormais `knowledgeUsed` et les `speechActs[].sourceRefs` aux faits publics du paquet, à l'intention courante et aux opérations/projections présentes dans `priorNpcUtterances`. Une référence historique inventée est donc rejetée même si l'enveloppe du modèle se déclare sûre. Cette vérification porte sur la provenance structurée et n'ajoute aucune détection lexicale des formulations de dialogue.

En mode OpenAI, une réplique `npc_performer` structurellement valide passe ensuite par un `coherence_critic` dédié à la fidélité de `dialogueAct`. Le critique compare la prose à `INITIATE_CONVERSATION`, `ASK_QUESTION`, `MAKE_STATEMENT`, `REQUEST_ACTION` ou `OTHER`. Une question inventée, une réponse hors sujet ou un changement d'acte produit un rejet bloquant; la performance IA n'est pas appliquée et le dialogue déterministe borné reste affiché. Ce contrôle ne donne aucune autorité métier au critique.

Tous les actes de dialogue restent sous la responsabilité du `npc_performer`, y compris `INITIATE_CONVERSATION` et `MAKE_STATEMENT`. Sa sortie contient un `reactionFrame` structuré qui doit recopier l'acte et l'objectif interprétés, puis choisir le mode de réponse canonique correspondant. Un validateur local indépendant vérifie ce cadre et interdit notamment qu'une ouverture de contact ou une déclaration introduise un acte de question. La prose validée structurellement passe ensuite par le critique de cohérence; en cas de rejet, le dialogue déterministe borné reste affiché.

Le fallback de rendu est lui aussi construit depuis le `dialogueAct` par un module partagé; il ne contient aucune hypothèse générique de question. Une salutation rejetée reste donc une salutation, une déclaration reste un accusé de réception et une demande d'action reste une réponse prudente à la demande. Le rejet du performer et son motif sont ajoutés à la notification système afin de distinguer clairement une performance acceptée d'un fallback.

L'échec du `mj_planner` distant ne coupe pas l'orchestration. Son diagnostic est conservé, puis le planner local déterministe reconstruit un plan sans autorité depuis l'intention canonique. L'assignation `npc_performer` reste ainsi disponible et le module d'incarnation peut être appelé indépendamment de la disponibilité du planner distant.

Dans la surface de jeu courante, le `mj_planner` utilise directement son provider local déterministe, y compris lorsque l'interprétation et le performer utilisent OpenAI. Le plan minimal étant entièrement contraint et sans prose créative, un appel distant n'apporte pas de décision supplémentaire. Les critiques disposent de 1 600 tokens de sortie et le performer de 2 000 pour terminer leurs enveloppes structurées.

Les schémas JSON stricts envoyés à OpenAI sont testés récursivement: chaque tableau déclare `items`, chaque objet interdit les propriétés supplémentaires et toutes ses propriétés sont requises. Cette vérification couvre notamment les tableaux volontairement vides du planner et du performer ainsi que le payload fermé des propositions de commande.

Le paquet `npc_performer` publie en outre `knowledgeEnvelope.allowedSourceRefs`. Le schéma OpenAI utilise cette liste comme énumération pour `knowledgeUsed` et `speechActs[].sourceRefs`; le modèle doit recopier une référence canonique exacte et ne peut plus fabriquer des pointeurs comme `task.actorId` ou `task.dialogueAct.contentGoal`.

La surface n'ajoute aucun panneau de diagnostic séparé. Le bloc `SYSTEM_NOTICE` existant reçoit une section `Trace système et mémoire` qui expose l'issue du performer, l'acteur et l'acte, les intentions joueur mémorisées pour ce PNJ, ses répliques antérieures visibles, les couples visibles `intention → réponse`, les sources déclarées et les durées contrôleur, enrichissement, persistance et total avant affichage. Le contrôleur détaille également interprétation, planification, résolution et performer PNJ; le résidu est présenté comme orchestration/persistance.

Le performer reçoit une situation spatiale explicite. Sa prose subit un contrôle local avant le critique distant afin de bloquer les contradictions visibles simples. Lorsque l'adaptateur distant d'expression est désactivé, seules des corrections typographiques locales bornées sont appliquées, sans reformulation sémantique.

Le performer reçoit un `dialogueHistory` qui associe les intentions joueur aux répliques PNJ persistées. Le critique n'est appelé que si un risque local de continuité ou de complexité existe: historique déjà présent, acte `OTHER`, plusieurs répliques ou plusieurs actes de parole. Il accepte une réponse similaire lorsque la question courante est équivalente à une ancienne question, mais rejette les contradictions et les rappels nominaux ou spatiaux mécaniques comme `près du garde`.

Dans la surface de jeu, `useRemoteExpressionAdapter=false`: l'expression locale déjà déclarée fidèle est conservée sans appel au `player_expression_adapter` ni à son critique. Le module distant reste disponible pour les autres consommateurs et ses tests contractuels.

```ts
interface NpcPerformerPayloadV1 {
  actorId: string;
  utterances: NpcUtteranceV1[];
  nonVerbalReactions: string[];
  durableCommitments: string[];
  revealedRefs: string[];
  knowledgeUsed: string[];
}

interface NpcUtteranceV1 {
  utteranceId: string;
  text: string;
  audience: string[];
  speechActs: SpeechActV1[];
}

interface SpeechActV1 {
  type: "assertion" | "question" | "promise" | "threat" | "order" | "refusal" | "intentional_lie" | "reveal";
  content: string;
  epistemicBasis: "known" | "believed" | "deduced" | "uncertain" | "fabricated_for_lie";
  sourceRefs: string[];
}
```

Le fait qu'un PNJ prononce une phrase peut être committé. Le contenu de cette phrase ne devient pas automatiquement vérité objective.

### 6.5 `rules_adjudicator`

```ts
interface RulesAdjudicatorPayloadV1 {
  domain: string;
  question: string;
  factsConsidered: string[];
  appliedRuleRefs: string[];
  precedentRefs: string[];
  adjudicationKind: "DIRECT_RULE" | "RULE_INTERPRETATION" | "OPEN_ESTIMATE" | "AD_HOC_RULING";
  recommendation: Record<string, unknown>;
  plausibleRange: Record<string, unknown> | null;
  factorsIncreasing: string[];
  factorsReducing: string[];
  scope: "SINGLE_CASE" | "CAMPAIGN_PRECEDENT_CANDIDATE";
}
```

Un arbitrage ad hoc ne modifie jamais le ruleset. Il peut seulement produire un précédent de campagne après acceptation par le domaine propriétaire.

### 6.6 `coherence_critic`

```ts
interface CoherenceCriticPayloadV1 {
  verdict: "PASS" | "REVISE" | "REJECT";
  findings: CriticFindingV1[];
  correctionConstraints: string[];
}

interface CriticFindingV1 {
  findingId: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  category:
    | "AUTHORITY"
    | "PLAYER_AGENCY"
    | "SECRET_LEAK"
    | "PERSPECTIVE"
    | "PLOT_COHERENCE"
    | "RULE_CONFLICT"
    | "DUPLICATE"
    | "UNSUPPORTED_CREATION";
  affectedRefs: string[];
  explanation: string;
}
```

Le critique ne corrige pas lui-même. `REVISE` renvoie au rôle responsable; `REJECT` abandonne la proposition ou reprend depuis le dernier point sûr.

### 6.7 `scene_writer`

```ts
interface SceneWriterPayloadV1 {
  narrationBlocks: NarrativeBlockCandidateV1[];
}

interface NarrativeBlockCandidateV1 {
  slotId: string;
  blockKind: "MJ_NARRATION" | "SYSTEM_NOTICE";
  content: string;
  groundedIn: string[];
  usesCreativeTexture: boolean;
}
```

Le rédacteur ne reformule pas les dialogues validés. Il remplit uniquement les slots narratifs autorisés par le `RenderPlan`.

### 6.8 `clarification_writer`

```ts
interface ClarificationWriterPayloadV1 {
  suspendedIntentId: string;
  question: string;
  allowedAnswersHint: string[];
  noGameTime: true;
}
```

La clarification ne fait pas avancer le monde et ne crée aucune réaction fictionnelle.

## 7. Propositions de création dynamique

```ts
type DynamicCreationTypeV1 =
  | "NPC"
  | "LOCAL_EVENT"
  | "WORLD_EVENT"
  | "PLACE"
  | "ITEM"
  | "PLOT_THREAD"
  | "CAMPAIGN_FACT";

type CreationPersistenceDepthV1 =
  | "SCENE_EPHEMERAL"
  | "LIGHT_REFERENCE"
  | "FULL_ENTITY"
  | "ARCHIVE";

interface DynamicCreationProposalV1 {
  schemaVersion: 1;
  proposalId: string;
  proposalType: DynamicCreationTypeV1;
  requestedDepth: CreationPersistenceDepthV1;
  reason: string;
  anchors: CreationAnchorV1[];
  proposedProperties: Record<string, unknown>;
  existingFactRefsUsed: string[];
  relationsToExisting: string[];
  expectedEffects: string[];
  visibility: "SYSTEM_ONLY" | "PLAYER_VISIBLE" | "ACTOR_SCOPED";
  narrativeCommitments: string[];
  validatingDomains: string[];
  duplicatePolicy: "REUSE" | "ENRICH" | "CREATE_DISTINCT" | "POSSIBLE_SAME_AS" | "REJECT_IF_SIMILAR";
}

interface CreationAnchorV1 {
  kind: "ACTOR" | "LOCATION" | "ITEM" | "FACTION" | "PLOT" | "TIME" | "RULE";
  id: string;
  required: boolean;
}
```

Validation obligatoire avant promotion :

1. permission de création dans `CreativeScopeV1`;
2. ancres existantes et accessibles;
3. compatibilité lore, temps, géographie et règles;
4. anti-doublon exact, structuré et textuel;
5. profondeur proportionnée;
6. absence de fuite de secret;
7. engagements d'intrigue cohérents et solvables.

Créer une identité persistante pour contourner une contradiction est interdit.

## 8. Validation, correction et retries

```ts
type AiFailureCategoryV1 =
  | "TRANSPORT_FAILURE"
  | "INVALID_ENVELOPE"
  | "SCHEMA_VIOLATION"
  | "REFERENCE_VIOLATION"
  | "AUTHORITY_VIOLATION"
  | "SEMANTIC_CONFLICT"
  | "STALE_CONTEXT"
  | "PROVIDER_REFUSAL"
  | "SECURITY_VIOLATION"
  | "BUDGET_EXCEEDED";

interface AiRetryPolicyV1 {
  schemaVersion: 1;
  role: AiRoleV1;
  maxTechnicalRetries: number;
  maxTargetedCorrections: number;
  maxFullRegenerations: number;
  allowFallback: boolean;
}
```

Séquence de référence :

1. sortie initiale;
2. une correction ciblée;
3. une régénération complète;
4. suspension, abandon ou rendu déterministe post-commit selon l'étape.

Les reprises techniques utilisent un compteur séparé. Une réponse tardive est diagnostiquée et ignorée.

## 9. Incident expurgé

```ts
interface AiIncidentRecordV1 {
  schemaVersion: 1;
  incidentId: string;
  campaignId: string;
  operationId: string;
  callId: string | null;
  attemptIds: string[];
  role: AiRoleV1 | null;
  category: AiFailureCategoryV1;
  severity: "INFO" | "WARNING" | "BLOCKING" | "INTEGRITY";
  stage:
    | "CONTEXT_BUILD"
    | "PROVIDER_CALL"
    | "OUTPUT_PARSE"
    | "OUTPUT_VALIDATE"
    | "DOMAIN_VALIDATE"
    | "PRE_COMMIT"
    | "POST_COMMIT_RENDER";
  commitState: "NO_COMMIT" | "COMMIT_CONFIRMED" | "COMMIT_UNKNOWN";
  redacted: boolean;
  redactedFields: string[];
  safeDetails: Record<string, unknown>;
  outcome: "RECOVERED" | "DEGRADED" | "SUSPENDED" | "ABANDONED" | "READ_ONLY";
}
```

Les incidents ne contiennent jamais clé fournisseur, prompt complet, réponse brute complète, secret MJ ou contenu privé non nécessaire.

## 10. Preuves exigées pour fermer I-05A

- NAR-ACC-001 : question hypothétique face au garde classée sans commande, sans temps, sans réaction du garde;
- NAR-ACC-014 : sortie invalide avant commit sans mutation, puis panne de rédaction après commit avec rendu déterministe;
- NAR-ACC-019 : injection dans entrée/lore/mémoire traitée comme donnée, secret et prompt absents du diagnostic joueur;
- NAR-ACC-016 : proposition de doublon rejetée ou convertie en `REUSE`/`ENRICH` traçable;
- NAR-ACC-003 : création PNJ éphémère puis promotion légère ou complète uniquement après validation;
- perspective de NAR-ACC-006 : critique obligatoire sur intrigue ou secret, sans fuite dans paquet joueur;
- circuit ouvert par rôle et absence de fallback non certifié;
- sorties invalides strictement rejetées, correction bornée et régénération complète couvertes par fixtures;
- build global et suites I-00 à I-04 restent verts.

## 11. Hors périmètre I-05A

- fournisseur IA réel;
- stockage de clés ou configuration secrète;
- UI conversationnelle;
- promotion complète d'intrigue jouable dans une scène;
- branchement tactique ou repos;
- certification qualité prose avec modèle réel;
- benchmark financier définitif;
- génération sémantique distante.

Ces exclusions n'empêchent pas de prévoir les ports. Elles empêchent I-05A de devenir prématurément le runtime IA complet.
