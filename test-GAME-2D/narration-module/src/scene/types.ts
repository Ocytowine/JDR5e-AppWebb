export const SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 = "scene-social-ui/1" as const;

export type SceneSocialUiContractVersionV1 = typeof SCENE_SOCIAL_UI_CONTRACT_VERSION_V1;

export type SpeakerKindV1 = "GM" | "PLAYER_CHARACTER" | "NPC" | "SYSTEM";

export interface SpeakerRefV1 {
  schemaVersion: 1;
  speakerId: string;
  kind: SpeakerKindV1;
  actorRef: string | null;
  displayName: string;
  knownNameStatus: "KNOWN" | "DESIGNATION" | "UNKNOWN";
  roleLabel: string;
  accessibilityLabel: string;
  visualToken: string;
}

export interface SceneStateV1 {
  schemaVersion: 1;
  contractVersion: SceneSocialUiContractVersionV1;
  sceneId: string;
  campaignId: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  locationRef: string;
  startedAtGameTime: number;
  lastRelevantGameTime: number;
  participantRefs: string[];
  establishedStaging: SceneStagingEntryV1[];
  activeThreadRefs: string[];
  perceptionAnchors: string[];
  sourceEventRefs: string[];
  transitionCause: "CAMPAIGN_START" | "LOCATION_CHANGE" | "TIME_ADVANCE" | "ACTOR_CHANGE" | "SYSTEM_HANDOFF" | "CONTINUATION" | "EXPLICIT_CLOSE";
  version: number;
}

export interface SceneStagingEntryV1 {
  stagingId: string;
  text: string;
  sourceRefs: string[];
  persistence: "TEXTURE_ONLY" | "PERCEPTIBLE_FACT" | "PROMOTED_REFERENCE";
}

export interface SocialKnowledgeStateV1 {
  schemaVersion: 1;
  contractVersion: SceneSocialUiContractVersionV1;
  actorId: string;
  knownFactRefs: string[];
  beliefs: SocialBeliefV1[];
  relationshipEdges: SocialRelationshipEdgeV1[];
  reputationMarkers: SocialReputationMarkerV1[];
  debtsAndPromises: SocialDebtOrPromiseV1[];
  visibilityConstraints: string[];
  sourceEventRefs: string[];
  version: number;
}

export interface SocialBeliefV1 {
  beliefId: string;
  claim: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  sourceRefs: string[];
  mayBeFalse: boolean;
}

export interface SocialRelationshipEdgeV1 {
  targetActorId: string;
  dimensions: Record<string, number>;
  sourceRefs: string[];
}

export interface SocialReputationMarkerV1 {
  markerId: string;
  scopeRef: string;
  label: string;
  sourceRefs: string[];
}

export interface SocialDebtOrPromiseV1 {
  recordId: string;
  targetRef: string;
  kind: "DEBT" | "PROMISE";
  text: string;
  sourceRefs: string[];
}

export interface PlayerInputRecordV1 {
  schemaVersion: 1;
  operationId: string;
  sceneId: string;
  rawInput: string;
  interpretedIntent: string;
  validatedPlayerExpression: string | null;
  lockedExactWording: boolean;
  noGameTime: boolean;
  sourceRefs: string[];
}

export interface SuspendedClarificationV1 {
  schemaVersion: 1;
  suspendedIntentId: string;
  operationId: string;
  sceneId: string;
  rawInput: string;
  knownInterpretation: string;
  missingField: string;
  question: string;
  initialSnapshotId: string;
  dependencyRefs: string[];
  noGameTime: true;
}

export interface SpeechActRecordV1 {
  schemaVersion: 1;
  speechActId: string;
  operationId: string;
  sceneId: string;
  speakerRef: SpeakerRefV1;
  audienceRefs: string[];
  language: string;
  text: string;
  semanticCommitments: string[];
  knowledgeUsedRefs: string[];
  sourceOutputId: string;
  visibility: "PLAYER_VISIBLE" | "ACTOR_SCOPED" | "SYSTEM_ONLY";
  eventRef: string;
  version: number;
}

export type RenderBlockKindV1 =
  | "RAW_INPUT"
  | "PLAYER_EXPRESSION"
  | "GM_NARRATION"
  | "NPC_SPEECH"
  | "SYSTEM_NOTICE"
  | "CLARIFICATION";

export type TextPolicyV1 = "EXACT" | "AI_NARRATIVE_ALLOWED" | "DETERMINISTIC_ONLY";

export interface RenderPlanBlockV1 {
  blockId: string;
  kind: RenderBlockKindV1;
  speakerRef: SpeakerRefV1;
  sourceRefs: string[];
  groundedIn: string[];
  textPolicy: TextPolicyV1;
  visibility: "PLAYER_VISIBLE" | "ACTOR_SCOPED" | "SYSTEM_ONLY";
  order: number;
  text: string;
}

export interface ConversationRhythmPolicyV1 {
  schemaVersion: 1;
  maxAutomaticNpcTurns: number;
  maxNarrativeBlocksBeforePlayer: number;
  handoffOnDirectQuestionToPlayer: boolean;
  allowNpcInterruption: boolean;
  allowPlayerAsObserver: boolean;
  descriptionDensity: "LOW" | "MEDIUM" | "HIGH";
  diagnosticsEnabled: boolean;
}

export interface RhythmDecisionV1 {
  reason: "CONTINUE_AUTOMATICALLY" | "ASK_PLAYER" | "CLARIFY" | "SYSTEM_HANDOFF" | "RHYTHM_LIMIT";
  diagnostic: string;
}

export interface RenderPlanV1 {
  schemaVersion: 1;
  contractVersion: SceneSocialUiContractVersionV1;
  operationId: string;
  sceneId: string;
  sourceRevision: number;
  blocks: RenderPlanBlockV1[];
  rhythmDecision: RhythmDecisionV1;
  fallbackAllowed: boolean;
  version: number;
}

export interface DisplaySpeakerV1 {
  speakerId: string;
  kind: SpeakerKindV1;
  displayName: string;
  roleLabel: string;
  ariaLabel: string;
  visualToken: string;
}

export interface DisplayBlockV1 {
  blockId: string;
  kind: RenderBlockKindV1;
  speaker: DisplaySpeakerV1;
  text: string;
  ariaLabel: string;
  roleLabel: string;
  visualStyleToken: string;
  sourceRefs: string[];
  isDegradedFallback: boolean;
}

export interface DisplayPacketV1 {
  schemaVersion: 1;
  contractVersion: SceneSocialUiContractVersionV1;
  operationId: string;
  sceneId: string;
  displayBlocks: DisplayBlockV1[];
  rawInputAccess: {
    available: boolean;
    operationId: string;
  };
  rhythmDiagnostics: string | null;
  reconstructionRefs: string[];
  version: number;
}

export interface InteractionLogEntryV1 {
  schemaVersion: 1;
  contractVersion: SceneSocialUiContractVersionV1;
  entryId: string;
  campaignId: string;
  operationId: string;
  sceneId: string;
  gameTime: number;
  recordedAt: string;
  kind: RenderBlockKindV1;
  speakerRef: SpeakerRefV1;
  text: string;
  sourceRefs: string[];
  commitId: string | null;
  eventRefs: string[];
  visibility: "PLAYER_VISIBLE" | "ACTOR_SCOPED" | "SYSTEM_ONLY";
  version: number;
}

export interface InteractionLogSourceV1 {
  campaignId: string;
  operationId: string;
  sceneId: string;
  gameTime: number;
  recordedAt: string;
  commitId: string | null;
  eventRefs: string[];
  renderPlan: RenderPlanV1;
}

export interface SceneValidationResultV1 {
  ok: boolean;
  issues: string[];
}
