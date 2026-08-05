import type { CreativeScopeV1, RoleContextPackV1 } from "../context";
import type { JsonObject } from "../core";

export type AiRoleV1 =
  | "intent_interpreter"
  | "player_intent_interpreter"
  | "mj_planner"
  | "player_expression_adapter"
  | "npc_performer"
  | "rules_adjudicator"
  | "coherence_critic"
  | "scene_writer"
  | "scene_creator"
  | "destination_arbiter"
  | "clarification_writer";

export interface AiModelRouteV1 {
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

export interface AiCallRequestV1 {
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
    roleContextPack: RoleContextPackV1 | unknown;
    task: unknown;
  };
  limits: {
    inputTokenBudget: number;
    outputTokenBudget: number;
    timeoutMs: number;
  };
}

export type AiOutputStatusV1 =
  | "OK"
  | "NEEDS_CLARIFICATION"
  | "CANNOT_COMPLY"
  | "REFUSED"
  | "PARTIAL_UNUSABLE";

export interface AiOutputDiagnosticV1 {
  code: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  message: string;
  sourceRefs: string[];
}

export interface AiRoleOutputEnvelopeV1<TPayload = unknown> {
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

export interface IntentInterpreterPayloadV1 {
  intents: PlayerIntentV1[];
  suspendedIntent: SuspendedIntentV1 | null;
}

export interface AiIntentInterpretationPayloadV1 {
  rawInputEcho: string;
  intents: AiStructuredPlayerIntentV1[];
}

export interface AiSemanticIntentPayloadV2 {
  rawInputEcho: string;
  intent: AiSemanticPlayerIntentV2;
}

export interface AiSemanticIntentPayloadV3 {
  rawInputEcho: string;
  intent: AiSemanticPlayerIntentV3;
}

export interface AiSemanticIntentPayloadV4 {
  rawInputEcho: string;
  intent: AiSemanticPlayerIntentV4;
}

export interface AiSemanticIntentPayloadV5 {
  rawInputEcho: string;
  intent: AiSemanticPlayerIntentV5;
}

export interface AiSemanticPlayerIntentV2 {
  kind: AiStructuredSemanticIntentV1["kind"];
  commitment: AiStructuredSemanticIntentV1["commitment"];
  preconditions: string[];
  playerGoal: string;
  actionHint: string | null;
  domainHint: "scene_resolution" | "social" | "perception" | "inventory" | "rules" | "tactical" | "rest" | "world" | null;
  scope: "LOCAL_INTERACTION" | "SCENE_TRANSITION" | "SOCIAL_EXCHANGE" | "PERCEPTION" | "META" | "UNKNOWN";
  targetMention: {
    surface: string;
    candidateKind: "npc" | "place" | "object" | "self" | "unknown";
    proposedRef: string | null;
    contextLink: "EXPLICIT" | "RECENT_FOCUS" | "SCENE_DESCRIPTION" | "NONE";
  } | null;
  perception: AiStructuredSemanticIntentV1["perception"];
  dialogueAct: {
    act: "INITIATE_CONVERSATION" | "ASK_QUESTION" | "MAKE_STATEMENT" | "REQUEST_ACTION" | "OTHER";
    contentGoal: string;
  } | null;
  uncertainties: string[];
  clarificationPrompt: string | null;
  confidence: "low" | "medium" | "high";
}

export interface AiSemanticPlayerIntentV3 extends AiSemanticPlayerIntentV2 {
  composition: AiSemanticIntentCompositionV1;
}

export interface AiSemanticPlayerIntentV4 extends Omit<AiSemanticPlayerIntentV3, "composition" | "perception"> {
  composition: AiSemanticIntentCompositionV2;
  perception: ({
    schemaVersion: 1;
    depth: "GLANCE" | "FOCUSED" | "SEARCH";
    focus: string;
    soughtInformation: string | null;
    informationKind: "PRESENCE" | "VISIBLE_TRAIT" | "UNCERTAIN_CLUE";
  }) | null;
}

export interface AiSemanticPlayerIntentV5 extends Omit<AiSemanticPlayerIntentV4, "composition"> {
  composition: AiSemanticIntentCompositionV3;
}

export interface AiSemanticIntentCompositionV1 {
  spatialLeadIn: {
    kind: "APPROACH_TARGET";
    playerGoal: string;
    order: number;
  } | null;
  communication: {
    mode: "SPEECH" | "NONVERBAL";
    act: "INITIATE_CONVERSATION" | "ASK_QUESTION" | "MAKE_STATEMENT" | "REQUEST_ACTION" | "OTHER" | null;
    contentGoal: string;
    order: number;
  } | null;
}

export interface AiSemanticIntentCompositionV2 extends AiSemanticIntentCompositionV1 {
  orientation: {
    kind: "LOCATE_VISIBLE_TARGET";
    playerGoal: string;
    order: number;
  } | null;
}

export interface AiSemanticIntentCompositionV3 extends AiSemanticIntentCompositionV2 {
  spatialFollowUp: {
    kind: "REPOSITION_AWAY";
    playerGoal: string;
    order: number;
  } | null;
}

export interface AiStructuredPlayerIntentV1 {
  intentId: string;
  order: number;
  intentType:
    | "meta_question"
    | "possibility_query"
    | "memory_recall"
    | "speech"
    | "action"
    | "mixed"
    | "unclear_commitment";
  commitment: "none" | "hypothetical" | "conditional" | "committed" | "unclear";
  target: {
    kind: "npc" | "place" | "object" | "self" | "unknown";
    ref: string | null;
    label: string | null;
  } | null;
  action: string | null;
  semanticIntent: AiStructuredSemanticIntentV1;
  runtimeHandling: AiIntentRuntimeHandlingV1;
  referentResolution?: {
    schemaVersion: 1;
    usedPreviousContext: boolean;
    source: "current_input" | "recent_visible_focus" | "visible_scene" | "none";
    resolvedTarget: {
      kind: "npc" | "place" | "object" | "self" | "unknown";
      ref: string | null;
      label: string | null;
    } | null;
    evidence: string[];
    ambiguity: "none" | "multiple_candidates" | "incompatible_action" | "insufficient_context" | "unknown";
    confidence: "low" | "medium" | "high";
  } | null;
  topic: string | null;
  coreMeaning: string;
  playerImposedDetails: string[];
  openDetails: string[];
  forbiddenInterpretations: string[];
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  riskFlags: string[];
  expectedTimeEffect: "NO_GAME_TIME" | "DOMAIN_TO_DECIDE";
  confidence: "low" | "medium" | "high";
}

export interface AiStructuredSemanticIntentV1 {
  schemaVersion: 1;
  kind:
    | "address_visible_actor"
    | "move_near_visible_actor"
    | "manipulate_visible_object"
    | "traverse_visible_boundary"
    | "observe_environment"
    | "nonverbal_signal"
    | "hypothetical_action"
    | "context_question"
    | "meta_request"
    | "unclear_intent";
  playerGoal: string;
  target: {
    kind: "npc" | "place" | "object" | "self" | "unknown";
    ref: string | null;
    label: string | null;
  } | null;
  commitment: "none" | "hypothetical" | "conditional" | "committed" | "unclear";
  preconditions?: string[];
  evidenceFromInput: string[];
  uncertainties: string[];
  forbiddenInterpretations: string[];
  confidence: "low" | "medium" | "high";
  perception: {
    schemaVersion: 1;
    depth: "GLANCE" | "FOCUSED" | "SEARCH";
    focus: string;
    soughtInformation: string | null;
    informationKind?: "PRESENCE" | "VISIBLE_TRAIT" | "UNCERTAIN_CLUE";
  } | null;
  dialogueAct?: {
    schemaVersion: 1;
    act: "INITIATE_CONVERSATION" | "ASK_QUESTION" | "MAKE_STATEMENT" | "REQUEST_ACTION" | "OTHER";
    contentGoal: string;
    addresseeRef: string | null;
  } | null;
  restPlan?: {
    schemaVersion: 1;
    restKind: "SHORT_REST" | "LONG_REST" | null;
  } | null;
  composition?: {
    schemaVersion: 1;
    orderedComponents: Array<{
      order: number;
      kind: "LOCATE_VISIBLE_TARGET" | "APPROACH_TARGET" | "SPEECH" | "NONVERBAL_SIGNAL" | "REPOSITION_AWAY";
      playerGoal: string;
    }>;
  };
}

export interface AiIntentRuntimeHandlingV1 {
  schemaVersion: 1;
  status: "SUPPORTED_BY_CURRENT_RUNTIME" | "UNSUPPORTED_DOMAIN" | "NEEDS_CLARIFICATION" | "AI_INTERPRETATION_FAILED";
  reason: string;
  requiredDomain: "scene_resolution" | "social" | "perception" | "inventory" | "rules" | "tactical" | "rest" | "world" | null;
  canonicalActionHint: string | null;
  noCommit: boolean;
  noGameTime: boolean;
}

export interface SuspendedIntentV1 {
  suspendedIntentId: string;
  reason: string;
  minimalClarification: string;
}

export interface PlayerIntentV1 {
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

export interface SceneBeatProposalV1 {
  beatId: string;
  kind: "CONTEXT_RESPONSE" | "LOCAL_ACTION_ATTEMPT" | "ACTOR_REACTION_EXPECTED" | "DOMAIN_BLOCKED" | "CLARIFICATION";
  actorIds: string[];
  stopCondition: string;
}

export interface DomainCommandProposalV1 {
  proposalId: string;
  domain: "scene_resolution" | "social" | "perception" | "inventory" | "rules" | "tactical" | "rest" | "world";
  commandType: string;
  targetRefs: string[];
  payload: Record<string, unknown>;
  commitAuthority: false;
}

export interface ActorAssignmentV1 {
  role: AiRoleV1;
  actorId: string | null;
  reason: string;
}

export interface TimeAdvanceProposalRefV1 {
  proposalId: string;
  category: "NO_GAME_TIME" | "DOMAIN_TO_DECIDE" | "OPEN_ESTIMATE";
}

export interface PlayerHandoffProposalV1 {
  handoffKind: "ASK_PLAYER" | "CONTINUE_AUTOMATICALLY" | "CLARIFY" | "END_TURN";
  reason: string;
}

export interface MjPlannerPayloadV1 {
  schemaVersion: 1;
  planId: string;
  planningBasis: {
    intentId: string;
    semanticGoal: string;
    runtimeStatus: AiIntentRuntimeHandlingV1["status"];
    requiredDomain: AiIntentRuntimeHandlingV1["requiredDomain"];
  };
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
  forbiddenOutcomes: string[];
}

export interface PlayerExpressionPayloadV1 {
  intentId: string;
  expressionKind: "speech" | "gesture" | "action_staging";
  renderedExpression: string;
  meaningCovered: string[];
  addedMeaning: string[];
  omittedMeaning: string[];
  styleChoices: string[];
  safeToUse: boolean;
}

export interface NpcPerformerPayloadV1 {
  schemaVersion: 1;
  performanceId: string;
  actorId: string;
  reactionFrame: NpcDialogueReactionFrameV1;
  conversationProfile: NpcEphemeralConversationProfileV1;
  utterances: NpcUtteranceV1[];
  knowledgeClaims?: NpcKnowledgeClaimCandidateV1[];
  nonVerbalReactions: string[];
  durableCommitments: string[];
  revealedRefs: string[];
  knowledgeUsed: string[];
  safetyConstraints: {
    noMechanicalSuccess: true;
    noSecretReveal: true;
    noDurableCommitment: true;
    noStateMutation: true;
  };
}

export interface NpcKnowledgeClaimCandidateV1 {
  utteranceId: string;
  speechActIndex: number;
  subject: {
    mode: "KNOWN_REF" | "HYPOTHETICAL_MENTION" | "UNRESOLVED";
    ref: string | null;
    kind: "PLACE" | "ACTOR" | "EVENT" | "HISTORY" | "PLOT" | "OBJECT" | "OTHER";
    label: string | null;
  };
}

export interface NpcEphemeralConversationProfileV1 {
  schemaVersion: 1;
  profileId: string;
  actorId: string;
  lifecycle: "EPHEMERAL_DIALOGUE";
  continuityRevision: number;
  continuitySource: "INITIALIZED" | "CONTINUED";
  perspectiveSummary: string;
  currentConcerns: string[];
  subjectiveOpinions: NpcSubjectiveOpinionV1[];
  conversationHooks: string[];
  boundaries: string[];
  speechStyle: string[];
  relationshipTone: "NEUTRAL" | "WARM" | "GUARDED" | "CURIOUS" | "COMPASSIONATE" | "IRRITATED";
  durable: false;
}

export interface NpcSubjectiveOpinionV1 {
  topic: string;
  stance: string;
}

export interface NpcDialogueReactionFrameV1 {
  schemaVersion: 1;
  sourceDialogueAct: "INITIATE_CONVERSATION" | "ASK_QUESTION" | "MAKE_STATEMENT" | "REQUEST_ACTION" | "OTHER";
  responseMode: "ACKNOWLEDGE_CONTACT" | "ANSWER_QUESTION" | "ACKNOWLEDGE_STATEMENT" | "RESPOND_TO_REQUEST" | "CAUTIOUS_RESPONSE";
  addressedContentGoal: string;
}

export interface NpcUtteranceV1 {
  utteranceId: string;
  text: string;
  audience: string[];
  speechActs: SpeechActV1[];
}

export interface SpeechActV1 {
  type: "assertion" | "question" | "promise" | "threat" | "order" | "refusal" | "intentional_lie" | "reveal";
  content: string;
  epistemicBasis: "known" | "believed" | "deduced" | "uncertain" | "fabricated_for_lie";
  sourceRefs: string[];
}

export interface RulesAdjudicatorPayloadV1 {
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

export interface CoherenceCriticPayloadV1 {
  verdict: "PASS" | "REVISE" | "REJECT";
  findings: CriticFindingV1[];
  correctionConstraints: string[];
}

export interface CriticFindingV1 {
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

export interface SceneWriterPayloadV1 {
  narrationBlocks: NarrativeBlockCandidateV1[];
}

export interface NarrativeBlockCandidateV1 {
  slotId: string;
  blockKind: "MJ_NARRATION" | "SYSTEM_NOTICE";
  content: string;
  groundedIn: string[];
  usesCreativeTexture: boolean;
  factDiscipline?: NarrativeBlockFactDisciplineV1;
}

export interface NarrativeBlockFactDisciplineV1 {
  addedUnsupportedFacts: string[];
  usesOnlyProvidedVisibleEntities: boolean;
  noNewEvents: boolean;
  noHiddenPresence: boolean;
  notes: string[];
}

export interface ClarificationWriterPayloadV1 {
  suspendedIntentId: string;
  question: string;
  allowedAnswersHint: string[];
  noGameTime: true;
}

export type DynamicCreationTypeV1 =
  | "NPC"
  | "LOCAL_EVENT"
  | "WORLD_EVENT"
  | "PLACE"
  | "ITEM"
  | "PLOT_THREAD"
  | "CAMPAIGN_FACT";

export type CreationPersistenceDepthV1 =
  | "SCENE_EPHEMERAL"
  | "LIGHT_REFERENCE"
  | "FULL_ENTITY"
  | "ARCHIVE";

export interface DynamicCreationProposalV1 {
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

export interface CreationAnchorV1 {
  kind: "ACTOR" | "LOCATION" | "ITEM" | "FACTION" | "PLOT" | "TIME" | "RULE";
  id: string;
  required: boolean;
}

export type AiFailureCategoryV1 =
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

export interface AiRetryPolicyV1 {
  schemaVersion: 1;
  role: AiRoleV1;
  maxTechnicalRetries: number;
  maxTargetedCorrections: number;
  maxFullRegenerations: number;
  allowFallback: boolean;
}

export interface AiAttemptRecordV1 {
  schemaVersion: 1;
  attemptId: string;
  callId: string;
  role: AiRoleV1;
  attemptKind: "INITIAL" | "TECHNICAL_RETRY" | "TARGETED_CORRECTION" | "FULL_REGENERATION";
  status: "ACCEPTED" | "REJECTED" | "IGNORED_LATE";
  failureCategory: AiFailureCategoryV1 | null;
}

export type AiCircuitStateV1 = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface AiCircuitBreakerPolicyV1 {
  schemaVersion: 1;
  failureThreshold: number;
  halfOpenProbeLimit: number;
}

export interface AiCircuitBreakerSnapshotV1 {
  schemaVersion: 1;
  role: AiRoleV1;
  routeId: string;
  state: AiCircuitStateV1;
  consecutiveFailures: number;
  halfOpenProbesUsed: number;
}

export interface AiOutputValidationResultV1 {
  schemaVersion: 1;
  outputId: string | null;
  accepted: boolean;
  failureCategory: AiFailureCategoryV1 | null;
  issues: string[];
}

export interface AiIncidentRecordV1 {
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

export interface AiProviderMetricsV1 {
  schemaVersion: 1;
  providerId: "openai";
  modelId: string;
  role: AiRoleV1;
  operationId: string;
  callId: string;
  attemptId: string;
  startedAt: string;
  endedAt: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostMinorUnits: number | null;
  finishReason: string | null;
}

export interface AiCallTelemetryV1 extends JsonObject {
  schemaVersion: 1;
  providerId: string;
  modelId: string;
  reasoningEffort: string | null;
  role: AiRoleV1;
  attemptId: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  finishReason: string | null;
  inputTokenBudget: number;
  outputTokenBudget: number;
  contextChars: number;
  schemaChars: number | null;
}

export interface DynamicCreationValidationPolicyV1 {
  schemaVersion: 1;
  creativeScope: CreativeScopeV1;
  knownAnchorIds: string[];
  duplicateCandidateIds: string[];
  allowActorScopedVisibility: boolean;
}

export type DynamicCreationValidationResultV1 =
  | {
    ok: true;
    decision: "ACCEPT_EPHEMERAL" | "PROMOTE_LIGHT_REFERENCE" | "PROMOTE_FULL_ENTITY" | "ARCHIVE";
    proposal: DynamicCreationProposalV1;
  }
  | {
    ok: false;
    code:
      | "CREATION_VALIDATION_FAILED"
      | "CREATION_PERMISSION_DENIED"
      | "CREATION_ANCHOR_MISSING"
      | "CREATION_DUPLICATE_REJECTED"
      | "CREATION_SECRET_RISK";
    issues: string[];
  };
