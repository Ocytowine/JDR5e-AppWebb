import type { CreativeScopeV1, RoleContextPackV1 } from "../context";

export type AiRoleV1 =
  | "intent_interpreter"
  | "player_intent_interpreter"
  | "mj_planner"
  | "player_expression_adapter"
  | "npc_performer"
  | "rules_adjudicator"
  | "coherence_critic"
  | "scene_writer"
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
  kind: string;
  actorIds: string[];
  stopCondition: string;
}

export interface DomainCommandProposalV1 {
  proposalId: string;
  domain: string;
  commandType: string;
  targetRefs: string[];
  payload: Record<string, unknown>;
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
  actorId: string;
  utterances: NpcUtteranceV1[];
  nonVerbalReactions: string[];
  durableCommitments: string[];
  revealedRefs: string[];
  knowledgeUsed: string[];
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
