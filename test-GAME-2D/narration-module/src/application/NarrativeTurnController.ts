import {
  computeRequestFingerprint,
  coreError,
  IndexedDbCampaignRepository,
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CommitRecord,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result
} from "../core";
import type { DisplayPacketV1 } from "../scene";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 } from "../scene";
import {
  createSuspendedIntentRecordV1,
  interpretNarrativeInputV1,
  isAiInterpretationFailureDiagnosticV1,
  upgradeLegacyNarrativeIntentInterpretationV1,
  type NarrativeIntentInterpretationV1,
  type NarrativeIntentTargetV1,
  type SuspendedIntentRecordV1
} from "./intentClarification";
import {
  buildUnavailableAiIntentInterpretationV1,
  interpretNarrativeInputWithAiV1,
  semanticIntentReleasesFocusV1,
  type AiIntentInterpreterConfigV1,
  type LocalReferentHintV1,
  type RecentSemanticTurnV1
} from "./aiIntentInterpretation";
import { REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, type PlayableSceneStateV1 } from "./playableScene";
import {
  createDefaultMjPlannerConfigV1,
  planNarrativeTurnWithMjV1,
  type MjPlannerConfigV1,
  type MjPlanningFailureV1
} from "./mjPlanning";
import {
  applyNpcPerformanceToDisplayPacketV1,
  createDefaultNpcPerformerConfigV1,
  missionDecisionFallbackV1,
  performNpcTurnV1,
  type NpcPerformanceFailureV1,
  type NpcPerformerConfigV1
} from "./npcPerforming";
import type { AiCallTelemetryV1, MjPlannerPayloadV1, NpcPerformerPayloadV1 } from "../ai/types";
import { activateAiCallBudgetV1, closeAiCallBudgetV1 } from "../ai/callBudget";
import { loadActiveCampaignCharacterProfileV1 } from "../bootstrap";
import { captureNpcTestimonyV1 } from "./npcTestimonyCapture";
import type { NpcInformationPerformanceDiagnosticV1 } from "./npcInformationPerformance";
import type { NarrativeNpcInformationRuntimeV1 } from "./npcInformationRuntime";
import {
  resolveNarrativeTurnV1,
  type NarrativeResolutionResultV1
} from "./narrativeResolution";
import type { SkillCheckProposalV1 } from "./skillCheckProposal";
import type { D20SourceV1 } from "./diceRollRecord";
import {
  resumePendingSkillCheckV1,
  type ResumePendingSkillCheckCommandV1,
  type ResumePendingSkillCheckResultV1
} from "./pendingSkillCheckResume";
import type { PendingSocialAccessSkillCheckContextV1 } from "./socialAccessSkillCheckOutcome";
import type { PendingRulesAccessSkillCheckContextV1 } from "./rulesAccessSkillCheckOutcome";
import { adjudicateContextualActionV1 } from "./contextualActionAdjudication";
import {
  recordNarrativeRenderedProjectionV1,
  restoreNarrativeRenderedThreadV1,
  type NarrativeRenderProjectionInputV1,
  type NarrativeRenderProjectionRecordResultV1,
  type RestoredNarrativeThreadV1
} from "./narrativeRenderProjection";
import { createInitialReferenceSceneStateV1, type ReferenceSceneStateV1 } from "./referenceSceneState";
import { applyPersistedSceneActorsV1 } from "./sceneActorRegistry";
import { buildNarrativeDomainCommandV1, type NarrativeDomainCommandV1 } from "./domainCommands";
import { buildOpenSemanticLegacyOwnerAdapterProjectionV1 } from "./openSemanticLegacyOwnerAdapter";
import { applyOpenSemanticFidelityV1 } from "./openSemanticFidelity";
import { shouldUseMjPlannerForNarrativeTurnV1 } from "./narrativeAiRoleStrategy";
import { buildSceneArrivalAfterCommitV1, type SceneArrivalStateV1 } from "./sceneArrival";
import type { DestinationPlausibilityDecisionV1 } from "./destinationPlausibility";
import type { InventoryAccessResolutionResultV1 } from "./inventoryAccessAuthority";
import type { SocialAccessResolutionResultV1 } from "./socialAccessAuthority";
import type { BeginRulesAccessCheckResultV1 } from "./rulesAccessAuthority";
import {
  createPrototypeInnSceneTransitionRuntimeV1,
  ensurePrototypeInnSceneTransitionStateV1,
  resolvePrototypeInnActiveSceneV1
} from "./prototypeSceneTransitionRuntime";
import {
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
  validateCampaignRuntimeBindingsV1,
  type CampaignRuntimeBindingsV1
} from "./campaignRuntimeBindings";
import {
  promoteSceneActorToCampaignNpcV1,
  type PromoteSceneActorCommandV1,
  type PromoteSceneActorResultV1
} from "./campaignNpcPromotionRuntime";
import {
  proposeMissionRelationEngagementV1,
  recordMissionOutcomeV1,
  resolveMissionRelationEngagementV1,
  type MissionRelationEngagementResultV1,
  type ProposeMissionRelationEngagementCommandV1,
  type RecordMissionOutcomeCommandV1,
  type ResolveMissionRelationEngagementCommandV1
} from "./missionRelationAuthority";
import type { NarrativeMissionRelationRuntimeV1 } from "./catalogMissionRelationRuntime";
import type {
  NarrativeCompanionRecruitmentRuntimeV1
} from "./narrativeCompanionRecruitmentRuntime";
import {
  travelInterruptionApproachV1,
  type NarrativeTravelPresentationV1,
  type NarrativeTravelRuntimeV1
} from "./catalogCampaignTravelRuntime";
import {
  changeCompanionPresenceV1,
  companionDirectiveNarrationV1,
  companionPresenceNarrationV1,
  decideCompanionDirectiveV1,
  decideCompanionDirectiveInNarrativeTurnV1,
  hydrateActiveCompanionsV1,
  loadCompanionPartyRegistryV1,
  moveCompanionPartyV1,
  recruitCompanionV1,
  type ChangeCompanionPresenceCommandV1,
  type DecideCompanionDirectiveCommandV1,
  type MoveCompanionPartyCommandV1,
  type CompanionPartyMutationResultV1,
  type RecruitCompanionCommandV1
} from "./companionPartyAuthority";
import type { NarrativePlotCreationRuntimeV1 } from "./catalogPlotCreationRuntime";
import {
  recordCampaignLoreProjectionV1,
  type RecordCampaignLoreProjectionCommandV1,
  type RecordCampaignLoreProjectionResultV1
} from "./campaignLoreProjectionRuntime";
import {
  buildInterpreterRuntimeContextV1,
  routeNarrativeSemanticIntentV2
} from "./runtimeCapabilityRouting";
import {
  createInterpreterCharacterContextResolverV1,
  type InterpreterCharacterContextResolverV1
} from "./interpreterCharacterContext";
import { loadPlayerPublicContextV1 } from "./playerPublicContext";
import {
  projectLocalInteractionFocusV1,
  reconcileLocalInteractionFocusV1,
  validateLocalInteractionFocusV1,
  type LocalInteractionFocusV1
} from "./localInteractionFocus";
import type { RestProcessStateV1, RestSegmentActivityV1 } from "../handoff";
import {
  SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1,
  resolveLocalSocialInitiativeBoundaryV1,
  type SocialSceneBoundaryKindV1
} from "./socialActorAuthority";
import {
  LocalSocialInitiativePerformerV1,
  projectAndRecordSocialInitiativeV1,
  type NarrativeSocialBoundaryResultV1,
  type SocialInitiativePerformerV1
} from "./socialInitiativeProjection";
import {
  PLOT_EVOLUTION_CONTRACT_V1,
  PLOT_SCENE_REVEAL_CONTRACT_V1,
  SCENE_EVENT_BUNDLE_CONTRACT_V1,
  evolveDuePlotsV1,
  loadPlotRegistryV1,
  revealPlotEffectsInSceneV1,
  type SceneEventBundleV1
} from "./plotAuthority";
import {
  buildPlotSceneDisplayPacketV1,
  projectAndRecordPlotSceneRevealV1,
  type PlotSceneBoundaryProjectionResultV1
} from "./plotSceneProjection";
import {
  composeCausalSceneEventBundlesV1,
  loadCommittedWorldSimulationSceneBundleV1
} from "./worldSceneEvents";
import {
  projectAndRecordWorldSceneBundleV1,
  type WorldSceneProjectionResultV1
} from "./worldSceneProjection";
import {
  projectAndRecordCharacterProgressionV1,
  type CharacterProgressionProjectionResultV1
} from "./characterProgressionProjection";
import {
  projectAndRecordBastionEstablishmentV1,
  type BastionProjectionResultV1
} from "./bastionProjection";
import {
  projectAndRecordBastionWorkCompletionV1,
  type BastionWorkProjectionResultV1
} from "./bastionWorkProjection";
import {
  projectAndRecordBastionOccupantActivityV1,
  projectAndRecordBastionOccupantAssignmentV1,
  type BastionOccupantProjectionResultV1
} from "./bastionOccupantProjection";
import type {
  BastionOccupantActivityAuthorityV1,
  BastionOccupantActivityResultV1,
  BastionOccupantActivitySummaryV1,
  BastionOccupantAssignmentSummaryV1,
  BastionOccupantCatalogV1,
  ResolveBastionOccupantActivityCommandV1
} from "./bastionOccupantAuthority";
import { resolveBastionOccupantActivityBoundaryV1 } from "./bastionOccupantAuthority";
import {
  projectAndRecordBastionIncidentV1,
  type BastionIncidentProjectionResultV1
} from "./bastionIncidentProjection";
import {
  handleBastionIncidentV1,
  type BastionDefenseHandoffAuthorityV1,
  type BastionIncidentCatalogV1,
  type BastionIncidentPolicyV1,
  type BastionIncidentResultV1,
  type HandleBastionIncidentCommandV1
} from "./bastionIncidentAuthority";
import {
  routeCommittedBastionCauseV1,
  type BastionCommittedCauseRoutingPolicyV1,
  type BastionCommittedCauseRoutingResultV1
} from "./bastionCommittedCauseRouter";
import {
  restoreActiveBastionTacticalSessionV1,
  type BastionTacticalSessionV1
} from "./bastionTacticalHandoffRuntime";
import {
  saveTacticalCheckpointV1
} from "./tacticalCheckpointRuntime";
import {
  recordPendingTacticalOutcomeV1
} from "./tacticalOutcomeRuntime";
import {
  integratePendingTacticalOutcomeV1,
  type TacticalConsequenceAuthorityV1
} from "./tacticalOutcomeIntegrationRuntime";
import {
  projectAndRecordTacticalOutcomeIntegrationV1
} from "./tacticalOutcomeIntegrationProjection";
import type { TacticalOutcomeV1 } from "../handoff";
import type { StartTacticalAccessHandoffResultV1 } from "./tacticalAccessAuthority";

export interface NarrativeActiveSceneResolverV1 {
  resolve(input: { repository: CampaignRepository; campaignId: CampaignId }): Promise<Result<PlayableSceneStateV1>>;
}

export interface NarrativeSceneTransitionRuntimeV1 {
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{
    commit: CommitRecord;
    arrival: SceneArrivalStateV1;
    displayPacket: DisplayPacketV1 & JsonObject;
    characterExpression: string;
    durationSeconds: number;
    aiTelemetry?: AiCallTelemetryV1[];
  }>>;
}

export interface NarrativeDynamicPlaceRuntimeV1 {
  evaluateDestination?(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{ decision: DestinationPlausibilityDecisionV1; aiTelemetry: AiCallTelemetryV1[] }>>;
  canHandle(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean> | boolean;
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
    destinationDecision?: DestinationPlausibilityDecisionV1;
  }): Promise<Result<Awaited<ReturnType<NarrativeSceneTransitionRuntimeV1["execute"]>> extends Result<infer T> ? T : never>>;
}

export interface NarrativeInventoryAccessRuntimeV1 {
  canHandle?(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean> | boolean;
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{
    commit: CommitRecord;
    resolution: InventoryAccessResolutionResultV1;
    characterExpression: string;
    playerFacingText: string;
    sourceRefs: string[];
  }>>;
}

export interface NarrativeSocialAccessRuntimeV1 {
  canHandle?(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean> | boolean;
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{
    commit: CommitRecord;
    resolution: SocialAccessResolutionResultV1;
    characterExpression: string;
    respondingActorRef: string;
    respondingActorName: string;
    playerFacingText: string;
    sourceRefs: string[];
  }>>;
}

export interface NarrativeRulesAccessRuntimeV1 {
  canHandle?(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean> | boolean;
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{
    commit: CommitRecord;
    resolution: BeginRulesAccessCheckResultV1;
    characterExpression: string;
    playerFacingText: string;
    sourceRefs: string[];
  }>>;
}

export interface NarrativeTacticalAccessRuntimeV1 {
  readonly consequenceAuthorities: readonly TacticalConsequenceAuthorityV1[];
  canHandle?(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean> | boolean;
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<StartTacticalAccessHandoffResultV1 & {
    characterExpression: string;
    playerFacingText: string;
    sourceRefs: string[];
  }>>;
}

export interface NarrativeTurnInputV1 {
  schemaVersion: 1;
  clientRequestId: string;
  rawInput: string;
}

export interface NarrativeTurnControllerOutputV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "narrative-turn-controller/1";
  operationId: string;
  clientRequestId: string;
  noCommit: boolean;
  noGameTime: boolean;
  interpretation: NarrativeIntentInterpretationV1 & JsonObject;
  domainCommand: NarrativeDomainCommandV1 | null;
  mjPlan: (MjPlannerPayloadV1 & JsonObject) | null;
  mjPlannerFailure: (MjPlanningFailureV1 & JsonObject) | null;
  npcPerformance: (NpcPerformerPayloadV1 & JsonObject) | null;
  npcPerformanceFailure: (NpcPerformanceFailureV1 & JsonObject) | null;
  suspendedIntent: (SuspendedIntentRecordV1 & JsonObject) | null;
  pendingSkillCheck: PendingNarrativeSkillCheckV1 | null;
  resolution: NarrativeResolutionResultV1;
  sceneState: ReferenceSceneStateV1;
  sceneArrival: SceneArrivalStateV1 | null;
  activeScene: PlayableSceneStateV1;
  displayPacket: DisplayPacketV1 & JsonObject;
  stageTimings: NarrativeControllerStageTimingsV1 | null;
  aiTelemetry: AiCallTelemetryV1[];
}

export type NarrativeTurnControllerOutputWithInteractionFocusV1 =
  NarrativeTurnControllerOutputV1 & {
    localInteractionFocus: LocalInteractionFocusV1 | null;
    closedLocalInteractionFocus: LocalInteractionFocusV1 | null;
  };

export interface NarrativeWorldSceneLocationResolverV1 {
  resolveLocationRefs(scene: PlayableSceneStateV1): string[] | Promise<string[]>;
}

export interface NarrativeSocialBoundaryInputV1 {
  schemaVersion: 1;
  clientRequestId: string;
  boundaryKind: SocialSceneBoundaryKindV1;
  playerActorId: string;
  occurredAtGameSecond?: number;
}

export interface NarrativeInventoryTransactionRuntimeV1 {
  canHandle(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<boolean> | boolean;
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{
    commit: CommitRecord | null;
    resolution: import("./inventoryTransactionAuthority").InventoryTransactionResultV1 | null;
    outcome: "APPLIED" | "REJECTED";
    characterExpression: string;
    playerFacingText: string;
    sourceRefs: string[];
  }>>;
}

export type NarrativeAutomaticBoundarySourceKindV1 =
  | "WORLD_TIME_ADVANCE"
  | "SCENE_TRANSITION"
  | "REST_SEGMENT"
  | "TACTICAL_INTEGRATION"
  | "CAMPAIGN_ACTIVATION"
  | "COMMITTED_ACTION";

export interface NarrativeAutomaticBastionCauseV1 extends JsonObject {
  schemaVersion: 1;
  sourceEventId: string;
}

export interface NarrativeAutomaticBoundaryInputV1 {
  schemaVersion: 1;
  sourceOperationId: string;
  sourceKind: NarrativeAutomaticBoundarySourceKindV1;
  commitApplied: boolean;
  timeAdvanced: boolean;
  sceneEntry: boolean;
  causalChange: boolean;
  allowSocialInitiative?: boolean;
  playerActorId?: string;
  bastionCauses?: NarrativeAutomaticBastionCauseV1[];
}

export interface NarrativeAutomaticBoundaryTraceStepV1 extends JsonObject {
  schemaVersion: 1;
  kind: "BASTION_CAUSE" | "CAUSAL_SCENE" | "SOCIAL_INITIATIVE";
  status: "EXECUTED" | "NO_VISIBLE_EFFECT" | "SKIPPED";
  reason: string;
  sourceRef: string;
}

export interface NarrativeAutomaticBoundaryResultV1 {
  schemaVersion: 1;
  sourceOperationId: string;
  sourceKind: NarrativeAutomaticBoundarySourceKindV1;
  controlDecision: "RETURN_CONTROL" | "INTERRUPT_FOR_PLAYER_DECISION";
  trace: NarrativeAutomaticBoundaryTraceStepV1[];
  displayPackets: DisplayPacketV1[];
}

export interface PendingNarrativeSkillCheckV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "pending-narrative-skill-check/1";
  pendingCheckId: string;
  sourceOperationId: string;
  sceneId: string;
  status: "AWAITING_SKILL_ROLL";
  proposal: SkillCheckProposalV1;
  ownerContext: { owner: "PERCEPTION" } | PendingSocialAccessSkillCheckContextV1 | PendingRulesAccessSkillCheckContextV1;
  createdAt: string;
  commitAuthority: false;
}

export interface NarrativeControllerStageTimingsV1 extends JsonObject {
  interpretationMs: number;
  planningMs: number;
  resolutionMs: number;
  npcPerformanceMs: number;
  resolvedOutputMs: number;
}

export interface NarrativeTurnControllerResultV1 {
  operation: OperationRecord;
  output: NarrativeTurnControllerOutputV1;
}

/**
 * Port propriétaire du domaine repos. Le contrôleur ne fabrique ni durée,
 * ni sécurité, ni bénéfice : il ne lui transmet qu'une intention structurée.
 */
export interface NarrativeRestRuntimeV1 {
  execute(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    interpretation: NarrativeIntentInterpretationV1;
    domainCommand: NarrativeDomainCommandV1 | null;
    activeScene: PlayableSceneStateV1;
    createdAt: string;
    aiTelemetry: AiCallTelemetryV1[];
  }): Promise<Result<{ output: NarrativeTurnControllerOutputV1; commit: CommitRecord | null }>>;
  advance(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    processId: string;
    clientRequestId: string;
    activity?: RestSegmentActivityV1 | null;
    activeScene: PlayableSceneStateV1;
    createdAt: string;
  }): Promise<Result<NarrativeTurnControllerResultV1>>;
  restoreActive(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
  }): Promise<Result<RestProcessStateV1 | null>>;
}

export interface NarrativeTurnControllerOptions {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock?: RepositoryClock;
  idPrefix?: string;
  intentInterpreterConfig?: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig?: MjPlannerConfigV1 | null;
  npcPerformerConfig?: NpcPerformerConfigV1 | null;
  npcInformationRuntime?: NarrativeNpcInformationRuntimeV1 | null;
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  travelRuntime?: NarrativeTravelRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  inventoryAccessRuntime?: NarrativeInventoryAccessRuntimeV1 | null;
  inventoryTransactionRuntime?: NarrativeInventoryTransactionRuntimeV1 | null;
  missionRelationRuntime?: NarrativeMissionRelationRuntimeV1 | null;
  companionRecruitmentRuntime?: NarrativeCompanionRecruitmentRuntimeV1 | null;
  plotCreationRuntime?: NarrativePlotCreationRuntimeV1 | null;
  socialAccessRuntime?: NarrativeSocialAccessRuntimeV1 | null;
  rulesAccessRuntime?: NarrativeRulesAccessRuntimeV1 | null;
  tacticalAccessRuntime?: NarrativeTacticalAccessRuntimeV1 | null;
  restRuntime?: NarrativeRestRuntimeV1 | null;
  socialInitiativePerformer?: SocialInitiativePerformerV1 | null;
  worldSceneLocationResolver?: NarrativeWorldSceneLocationResolverV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
  interpreterCharacterContextResolver?:
    InterpreterCharacterContextResolverV1 | null;
  tacticalConsequenceAuthorities?: readonly TacticalConsequenceAuthorityV1[];
  bastionTacticalRuntimeFactory?: NarrativeBastionTacticalRuntimeFactoryV1;
  d20Source?: D20SourceV1;
  runtimeBindings?: CampaignRuntimeBindingsV1;
}

export interface NarrativeBastionTacticalRuntimeV1 {
  causeRoutingPolicy: BastionCommittedCauseRoutingPolicyV1;
  incidentCatalog: BastionIncidentCatalogV1;
  incidentPolicy: BastionIncidentPolicyV1;
  defenseAuthority: BastionDefenseHandoffAuthorityV1;
  consequenceAuthorities: readonly TacticalConsequenceAuthorityV1[];
}

export interface NarrativeBastionTacticalRuntimeFactoryV1 {
  create(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
  }): NarrativeBastionTacticalRuntimeV1;
}

const DEFAULT_CAMPAIGN_ID = opaqueId<CampaignId>("cmp-narrative-prototype");
const DEFAULT_CLOCK_ID = opaqueId<AggregateId>("agg-narrative-prototype-clock");
const systemClock: RepositoryClock = { now: () => new Date() };

export class NarrativeTurnControllerV1 {
  private readonly repository: CampaignRepository;
  private readonly campaignId: CampaignId;
  private readonly clock: RepositoryClock;
  private readonly idPrefix: string;
  private readonly intentInterpreterConfig: AiIntentInterpreterConfigV1 | null;
  private readonly mjPlannerConfig: MjPlannerConfigV1 | null;
  private readonly npcPerformerConfig: NpcPerformerConfigV1 | null;
  private readonly npcInformationRuntime: NarrativeNpcInformationRuntimeV1 | null;
  private readonly sceneTransitionRuntime: NarrativeSceneTransitionRuntimeV1 | null;
  private readonly travelRuntime: NarrativeTravelRuntimeV1 | null;
  private readonly dynamicPlaceRuntime: NarrativeDynamicPlaceRuntimeV1 | null;
  private readonly inventoryAccessRuntime: NarrativeInventoryAccessRuntimeV1 | null;
  private readonly inventoryTransactionRuntime: NarrativeInventoryTransactionRuntimeV1 | null;
  private readonly missionRelationRuntime: NarrativeMissionRelationRuntimeV1 | null;
  private readonly companionRecruitmentRuntime:
    NarrativeCompanionRecruitmentRuntimeV1 | null;
  private readonly plotCreationRuntime: NarrativePlotCreationRuntimeV1 | null;
  private readonly socialAccessRuntime: NarrativeSocialAccessRuntimeV1 | null;
  private readonly rulesAccessRuntime: NarrativeRulesAccessRuntimeV1 | null;
  private readonly tacticalAccessRuntime: NarrativeTacticalAccessRuntimeV1 | null;
  private readonly restRuntime: NarrativeRestRuntimeV1 | null;
  private readonly socialInitiativePerformer: SocialInitiativePerformerV1 | null;
  private readonly worldSceneLocationResolver: NarrativeWorldSceneLocationResolverV1 | null;
  private readonly activeSceneResolver: NarrativeActiveSceneResolverV1 | null;
  private readonly interpreterCharacterContextResolver:
    InterpreterCharacterContextResolverV1 | null;
  private readonly tacticalConsequenceAuthorities:
    readonly TacticalConsequenceAuthorityV1[];
  private readonly bastionTacticalRuntime:
    NarrativeBastionTacticalRuntimeV1 | null;
  private readonly d20Source: D20SourceV1 | undefined;
  private readonly runtimeBindings: CampaignRuntimeBindingsV1;
  private recentLocalReferents: LocalReferentHintV1[] = [];
  private recentSemanticTurns: RecentSemanticTurnV1[] = [];
  private localInteractionFocus: LocalInteractionFocusV1 | null = null;

  constructor(options: NarrativeTurnControllerOptions) {
    this.repository = options.repository;
    this.campaignId = options.campaignId;
    this.clock = options.clock ?? systemClock;
    this.idPrefix = options.idPrefix ?? "nar";
    this.intentInterpreterConfig = options.intentInterpreterConfig ?? null;
    this.mjPlannerConfig = options.mjPlannerConfig === undefined
      ? createDefaultMjPlannerConfigV1()
      : options.mjPlannerConfig;
    this.npcPerformerConfig = options.npcPerformerConfig === undefined
      ? createDefaultNpcPerformerConfigV1()
      : options.npcPerformerConfig;
    this.npcInformationRuntime = options.npcInformationRuntime ?? null;
    this.sceneTransitionRuntime = options.sceneTransitionRuntime ?? null;
    this.travelRuntime = options.travelRuntime ?? null;
    this.dynamicPlaceRuntime = options.dynamicPlaceRuntime ?? null;
    this.inventoryAccessRuntime = options.inventoryAccessRuntime ?? null;
    this.inventoryTransactionRuntime = options.inventoryTransactionRuntime ?? null;
    this.missionRelationRuntime = options.missionRelationRuntime ?? null;
    this.companionRecruitmentRuntime =
      options.companionRecruitmentRuntime ?? null;
    this.plotCreationRuntime = options.plotCreationRuntime ?? null;
    this.socialAccessRuntime = options.socialAccessRuntime ?? null;
    this.rulesAccessRuntime = options.rulesAccessRuntime ?? null;
    this.tacticalAccessRuntime = options.tacticalAccessRuntime ?? null;
    this.restRuntime = options.restRuntime ?? null;
    this.socialInitiativePerformer = options.socialInitiativePerformer === undefined
      ? new LocalSocialInitiativePerformerV1()
      : options.socialInitiativePerformer;
    this.worldSceneLocationResolver = options.worldSceneLocationResolver ?? null;
    this.activeSceneResolver = options.activeSceneResolver ?? null;
    this.interpreterCharacterContextResolver =
      options.interpreterCharacterContextResolver === undefined
        ? createInterpreterCharacterContextResolverV1()
        : options.interpreterCharacterContextResolver;
    this.bastionTacticalRuntime =
      options.bastionTacticalRuntimeFactory?.create({
        repository: options.repository,
        campaignId: options.campaignId
      }) ?? null;
    this.tacticalConsequenceAuthorities = [
      ...(options.tacticalConsequenceAuthorities ?? []),
      ...(this.bastionTacticalRuntime?.consequenceAuthorities ?? []),
      ...(this.tacticalAccessRuntime?.consequenceAuthorities ?? [])
    ];
    this.d20Source = options.d20Source;
    this.runtimeBindings =
      options.runtimeBindings ?? PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1;
    const runtimeBindingIssues =
      validateCampaignRuntimeBindingsV1(this.runtimeBindings);
    if (runtimeBindingIssues.length > 0) {
      throw new Error(
        `Invalid campaign runtime bindings: ${runtimeBindingIssues.join("; ")}`
      );
    }
  }

  async resolveActiveScene(): Promise<Result<PlayableSceneStateV1>> {
    return this.activeSceneResolver === null
      ? { ok: true, value: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 }
      : this.activeSceneResolver.resolve({ repository: this.repository, campaignId: this.campaignId });
  }

  async recruitCompanion(command: RecruitCompanionCommandV1) {
    return recruitCompanionV1({ repository: this.repository, campaignId: this.campaignId, command });
  }

  async decideCompanionDirective(command: DecideCompanionDirectiveCommandV1) {
    return decideCompanionDirectiveV1({ repository: this.repository, campaignId: this.campaignId, command });
  }

  async moveCompanionParty(command: MoveCompanionPartyCommandV1) {
    return moveCompanionPartyV1({ repository: this.repository, campaignId: this.campaignId, command });
  }

  async changeCompanionPresence(command: ChangeCompanionPresenceCommandV1) {
    return changeCompanionPresenceV1({ repository: this.repository, campaignId: this.campaignId, command });
  }

  async restoreCompanionParty() {
    return loadCompanionPartyRegistryV1({ repository: this.repository, campaignId: this.campaignId });
  }

  async processLocalSocialBoundary(
    input: NarrativeSocialBoundaryInputV1
  ): Promise<Result<NarrativeSocialBoundaryResultV1>> {
    if (
      input.schemaVersion !== 1 ||
      !input.clientRequestId.trim() ||
      !input.playerActorId.trim()
    ) {
      return {
        ok: false,
        error: coreError("VALIDATION_FAILED", "narrative.social-boundary.invalid-input")
      };
    }
    const campaign = await this.repository.getCampaign(this.campaignId);
    if (!campaign.ok) return campaign;
    const activeScene = await this.resolveActiveScene();
    if (!activeScene.ok) return activeScene;
    const hydratedScene = await applyPersistedSceneActorsV1({
      repository: this.repository,
      campaignId: this.campaignId,
      scene: activeScene.value
    });
    if (!hydratedScene.ok) return hydratedScene;
    const companionScene = await hydrateActiveCompanionsV1({
      repository: this.repository,
      campaignId: this.campaignId,
      scene: hydratedScene.value
    });
    if (!companionScene.ok) return companionScene;
    const clockAggregate = await this.repository.getAggregate(
      this.campaignId,
      "world.clock",
      campaign.value.clockAggregateId
    );
    if (!clockAggregate.ok) return clockAggregate;
    const occurredAtGameSecond = input.occurredAtGameSecond
      ?? (clockAggregate.value.payload as CampaignClockPayload).elapsedGameSeconds;
    const initiativeResult = await resolveLocalSocialInitiativeBoundaryV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command: {
        schemaVersion: 1,
        contractVersion: SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1,
        clientRequestId: input.clientRequestId,
        sceneId: companionScene.value.sceneId,
        boundaryKind: input.boundaryKind,
        presentActorIds: [...new Set([
          ...companionScene.value.presentNpc.map(actor => actor.actorId),
          ...companionScene.value.ambientPopulation.map(actor => actor.actorId),
          input.playerActorId
        ])],
        playerActorId: input.playerActorId,
        occurredAtGameSecond
      }
    });
    if (!initiativeResult.ok) return initiativeResult;
    if (this.socialInitiativePerformer === null) {
      return {
        ok: true,
        value: {
          initiativeResult: initiativeResult.value,
          performance: null,
          displayPacket: null,
          projection: null
        }
      };
    }
    return projectAndRecordSocialInitiativeV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      clientRequestId: input.clientRequestId,
      sourceOperationId: `social-local-initiative:${input.clientRequestId}`,
      initiativeResult: initiativeResult.value,
      scene: companionScene.value,
      performer: this.socialInitiativePerformer
    });
  }

  async processActiveSceneEntrySocialBoundary(input: {
    schemaVersion: 1;
    playerActorId?: string;
  }): Promise<Result<NarrativeSocialBoundaryResultV1>> {
    const [lifecycle, position] = await Promise.all([
      this.repository.getAggregate(
        this.campaignId,
        "scene.lifecycle",
        this.runtimeBindings.sceneLifecycleAggregateId
      ),
      input.playerActorId === undefined
        ? this.repository.getAggregate(
          this.campaignId,
          "world.position",
          this.runtimeBindings.positionAggregateId
        )
        : Promise.resolve(null)
    ]);
    if (!lifecycle.ok) return lifecycle;
    const activeSceneId = String(lifecycle.value.payload.activeSceneId ?? "");
    if (!activeSceneId.trim()) {
      return {
        ok: false,
        error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.social-boundary.scene-lifecycle-invalid")
      };
    }
    if (position !== null && !position.ok) return position;
    const playerActorId = input.playerActorId
      ?? String(position?.value.payload.characterId ?? "");
    if (!playerActorId.trim()) {
      return {
        ok: false,
        error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.social-boundary.player-position-invalid")
      };
    }
    return this.processLocalSocialBoundary({
      schemaVersion: input.schemaVersion,
      clientRequestId: `social-entry-${normalizeClientRequestId(activeSceneId)}-${lifecycle.value.aggregateRevision}`,
      boundaryKind: "SCENE_ENTRY",
      playerActorId,
      occurredAtGameSecond: Number(
        lifecycle.value.payload.enteredAtGameSecond ?? 0
      )
    });
  }

  async processActiveLocalTimeSocialBoundary(input: {
    schemaVersion: 1;
    sourceOperationId: string;
    playerActorId?: string;
  }): Promise<Result<NarrativeSocialBoundaryResultV1>> {
    if (!input.sourceOperationId.trim()) {
      return {
        ok: false,
        error: coreError("VALIDATION_FAILED", "narrative.social-boundary.source-operation-missing")
      };
    }
    const [lifecycle, position] = await Promise.all([
      this.repository.getAggregate(
        this.campaignId,
        "scene.lifecycle",
        this.runtimeBindings.sceneLifecycleAggregateId
      ),
      input.playerActorId === undefined
        ? this.repository.getAggregate(
          this.campaignId,
          "world.position",
          this.runtimeBindings.positionAggregateId
        )
        : Promise.resolve(null)
    ]);
    if (!lifecycle.ok) return lifecycle;
    const activeSceneId = String(lifecycle.value.payload.activeSceneId ?? "");
    if (!activeSceneId.trim()) {
      return {
        ok: false,
        error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.social-boundary.scene-lifecycle-invalid")
      };
    }
    if (position !== null && !position.ok) return position;
    const playerActorId = input.playerActorId
      ?? String(position?.value.payload.characterId ?? "");
    if (!playerActorId.trim()) {
      return {
        ok: false,
        error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.social-boundary.player-position-invalid")
      };
    }
    return this.processLocalSocialBoundary({
      schemaVersion: input.schemaVersion,
      clientRequestId: normalizeClientRequestId([
        "social-local-time",
        activeSceneId.slice(-24),
        input.sourceOperationId.slice(-56)
      ].join(":")),
      boundaryKind: "LOCAL_TIME_BOUNDARY",
      playerActorId
    });
  }

  async processAutomaticBoundaries(
    input: NarrativeAutomaticBoundaryInputV1
  ): Promise<Result<NarrativeAutomaticBoundaryResultV1>> {
    const causes = input.bastionCauses ?? [];
    if (
      input.schemaVersion !== 1
      || !input.sourceOperationId.trim()
      || causes.some(cause => cause.schemaVersion !== 1 || !cause.sourceEventId.trim())
    ) {
      return {
        ok: false,
        error: coreError(
          "VALIDATION_FAILED",
          "narrative.automatic-boundary.invalid-input"
        )
      };
    }
    const requestsReaction = input.timeAdvanced
      || input.sceneEntry
      || input.causalChange
      || causes.length > 0;
    if (!input.commitApplied && requestsReaction) {
      return {
        ok: false,
        error: coreError(
          "VALIDATION_FAILED",
          "narrative.automatic-boundary.reaction-without-commit"
        )
      };
    }
    if (!input.commitApplied || !requestsReaction) {
      return {
        ok: true,
        value: {
          schemaVersion: 1,
          sourceOperationId: input.sourceOperationId,
          sourceKind: input.sourceKind,
          controlDecision: "RETURN_CONTROL",
          trace: [{
            schemaVersion: 1,
            kind: "CAUSAL_SCENE",
            status: "SKIPPED",
            reason: !input.commitApplied
              ? "Aucun commit : aucune réaction automatique."
              : "Le commit ne fait avancer ni temps, ni scène, ni cause.",
            sourceRef: input.sourceOperationId
          }],
          displayPackets: []
        }
      };
    }

    const trace: NarrativeAutomaticBoundaryTraceStepV1[] = [];
    const displayPackets: DisplayPacketV1[] = [];
    for (const cause of causes) {
      if (this.bastionTacticalRuntime === null) {
        trace.push({
          schemaVersion: 1,
          kind: "BASTION_CAUSE",
          status: "SKIPPED",
          reason: "Aucun système de bastion n’est actif dans cette campagne.",
          sourceRef: cause.sourceEventId
        });
      } else {
        const bastion = await this.processCommittedBastionCauseBoundary({
          sourceOperationId: input.sourceOperationId,
          sourceEventId: cause.sourceEventId
        });
        if (!bastion.ok) return bastion;
        const packet = bastion.value.projection?.displayPacket;
        if (packet !== undefined) displayPackets.push(packet);
        trace.push({
          schemaVersion: 1,
          kind: "BASTION_CAUSE",
          status: packet === undefined ? "NO_VISIBLE_EFFECT" : "EXECUTED",
          reason: packet === undefined
            ? "Cause examinée sans effet visible de bastion."
            : "Cause de bastion examinée et projetée.",
          sourceRef: cause.sourceEventId
        });
      }
    }

    const causal = await this.processActiveCausalSceneBoundary({
      schemaVersion: 1
    });
    if (!causal.ok) return causal;
    if (causal.value.displayPacket !== null) {
      displayPackets.push(causal.value.displayPacket);
    }
    trace.push({
      schemaVersion: 1,
      kind: "CAUSAL_SCENE",
      status: causal.value.displayPacket === null
        ? "NO_VISIBLE_EFFECT"
        : "EXECUTED",
      reason: causal.value.displayPacket === null
        ? "Intrigues et monde examinés sans effet visible."
        : "Intrigues et monde examinés et projetés.",
      sourceRef: input.sourceOperationId
    });

    const mayRunSocial = causal.value.bundle.controlDecision === "RETURN_CONTROL"
      && input.allowSocialInitiative !== false
      && (input.sceneEntry || input.timeAdvanced);
    if (!mayRunSocial) {
      trace.push({
        schemaVersion: 1,
        kind: "SOCIAL_INITIATIVE",
        status: "SKIPPED",
        reason: causal.value.bundle.controlDecision !== "RETURN_CONTROL"
          ? "Le monde demande une décision du joueur."
          : "Aucune frontière sociale demandée.",
        sourceRef: input.sourceOperationId
      });
      return {
        ok: true,
        value: {
          schemaVersion: 1,
          sourceOperationId: input.sourceOperationId,
          sourceKind: input.sourceKind,
          controlDecision: causal.value.bundle.controlDecision,
          trace,
          displayPackets
        }
      };
    }

    const social = input.sceneEntry
      ? await this.processActiveSceneEntrySocialBoundary({
          schemaVersion: 1,
          ...(input.playerActorId === undefined
            ? {}
            : { playerActorId: input.playerActorId })
        })
      : await this.processActiveLocalTimeSocialBoundary({
          schemaVersion: 1,
          sourceOperationId: input.sourceOperationId,
          ...(input.playerActorId === undefined
            ? {}
            : { playerActorId: input.playerActorId })
        });
    if (!social.ok) return social;
    if (social.value.displayPacket !== null) {
      displayPackets.push(social.value.displayPacket);
    }
    trace.push({
      schemaVersion: 1,
      kind: "SOCIAL_INITIATIVE",
      status: social.value.displayPacket === null
        ? "NO_VISIBLE_EFFECT"
        : "EXECUTED",
      reason: social.value.displayPacket === null
        ? "Initiative PNJ examinée sans intervention visible."
        : "Initiative PNJ examinée et projetée.",
      sourceRef: input.sourceOperationId
    });
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        sourceOperationId: input.sourceOperationId,
        sourceKind: input.sourceKind,
        controlDecision: causal.value.bundle.controlDecision,
        trace,
        displayPackets
      }
    };
  }

  async processActivePlotSceneBoundary(input: {
    schemaVersion: 1;
    playerKnowledgeRefs?: string[];
    project?: boolean;
  }): Promise<Result<PlotSceneBoundaryProjectionResultV1>> {
    const campaign = await this.repository.getCampaign(this.campaignId);
    if (!campaign.ok) return campaign;
    const [lifecycle, clock, registryBefore] = await Promise.all([
      this.repository.getAggregate(
        this.campaignId,
        "scene.lifecycle",
        this.runtimeBindings.sceneLifecycleAggregateId
      ),
      this.repository.getAggregate(
        this.campaignId,
        "world.clock",
        campaign.value.clockAggregateId
      ),
      loadPlotRegistryV1(this.repository, this.campaignId)
    ]);
    if (!lifecycle.ok) return lifecycle;
    if (!clock.ok) return clock;
    if (!registryBefore.ok) return registryBefore;
    const activeSceneId = String(lifecycle.value.payload.activeSceneId ?? "");
    if (!activeSceneId.trim()) {
      return {
        ok: false,
        error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.plot-boundary.scene-lifecycle-invalid")
      };
    }
    const registryRevisionBefore = registryBefore.value.aggregate?.aggregateRevision ?? -1;
    const evolution = await evolveDuePlotsV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command: {
        schemaVersion: 1,
        contractVersion: PLOT_EVOLUTION_CONTRACT_V1,
        clientRequestId: `plot-evolve-boundary-${clock.value.aggregateRevision}-${registryRevisionBefore}`
      }
    });
    if (!evolution.ok) return evolution;
    const registryAfter = await loadPlotRegistryV1(this.repository, this.campaignId);
    if (!registryAfter.ok) return registryAfter;
    const reveal = await revealPlotEffectsInSceneV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command: {
        schemaVersion: 1,
        contractVersion: PLOT_SCENE_REVEAL_CONTRACT_V1,
        clientRequestId: [
          "plot-reveal-boundary",
          normalizeClientRequestId(activeSceneId),
          lifecycle.value.aggregateRevision,
          registryAfter.value.aggregate?.aggregateRevision ?? -1
        ].join("-"),
        sceneId: activeSceneId,
        playerKnowledgeRefs: [...new Set(input.playerKnowledgeRefs ?? [])]
      }
    });
    if (!reveal.ok) return reveal;
    if (input.project === false) {
      return {
        ok: true,
        value: {
          evolution: evolution.value,
          reveal: reveal.value,
          displayPacket: null,
          projection: null
        }
      };
    }
    return projectAndRecordPlotSceneRevealV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      evolution: evolution.value,
      reveal: reveal.value
    });
  }

  async processActiveCausalSceneBoundary(input: {
    schemaVersion: 1;
    playerKnowledgeRefs?: string[];
  }): Promise<Result<WorldSceneProjectionResultV1>> {
    const plotBoundary = await this.processActivePlotSceneBoundary({
      schemaVersion: 1,
      playerKnowledgeRefs: input.playerKnowledgeRefs,
      project: false
    });
    if (!plotBoundary.ok) return plotBoundary;
    const [campaign, activeScene, restored] = await Promise.all([
      this.repository.getCampaign(this.campaignId),
      this.resolveActiveScene(),
      this.restoreRenderedThread()
    ]);
    if (!campaign.ok) return campaign;
    if (!activeScene.ok) return activeScene;
    if (!restored.ok) return restored;
    const clock = await this.repository.getAggregate(
      this.campaignId,
      "world.clock",
      campaign.value.clockAggregateId
    );
    if (!clock.ok) return clock;
    const throughGameSecond = (clock.value.payload as CampaignClockPayload).elapsedGameSeconds;
    let worldBundle: SceneEventBundleV1 = {
      schemaVersion: 1 as const,
      contractVersion: SCENE_EVENT_BUNDLE_CONTRACT_V1,
      sceneId: activeScene.value.sceneId,
      throughGameSecond,
      perceptions: [],
      excludedEffectCount: 0,
      controlDecision: "RETURN_CONTROL" as const,
      version: 1 as const
    };
    if (this.worldSceneLocationResolver !== null) {
      const locationRefs = await this.worldSceneLocationResolver.resolveLocationRefs(activeScene.value);
      const loaded = await loadCommittedWorldSimulationSceneBundleV1({
        repository: this.repository,
        campaignId: this.campaignId,
        sceneId: activeScene.value.sceneId,
        sceneLocationRefs: locationRefs,
        throughGameSecond
      });
      if (!loaded.ok) return loaded;
      const alreadyPresented = new Set(restored.value.projections.flatMap(projection =>
        projection.sourceRefs.filter(ref => ref.startsWith("world-signal:"))
      ));
      const perceptions = loaded.value.perceptions.filter(perception =>
        !alreadyPresented.has(perception.effectRef)
      );
      worldBundle = {
        ...loaded.value,
        perceptions,
        excludedEffectCount: loaded.value.excludedEffectCount
          + loaded.value.perceptions.length - perceptions.length,
        controlDecision: perceptions.some(perception => perception.interruptsPlayer)
          ? "INTERRUPT_FOR_PLAYER_DECISION"
          : "RETURN_CONTROL"
      };
    }
    const composed = composeCausalSceneEventBundlesV1([
      plotBoundary.value.reveal.bundle,
      worldBundle
    ]);
    if (!composed.ok) return composed;
    return projectAndRecordWorldSceneBundleV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      bundle: composed.value
    });
  }

  async processActiveWorldSceneBoundary(input: {
    schemaVersion: 1;
  }): Promise<Result<WorldSceneProjectionResultV1 | null>> {
    if (this.worldSceneLocationResolver === null) return { ok: true, value: null };
    const [campaign, activeScene, restored] = await Promise.all([
      this.repository.getCampaign(this.campaignId),
      this.resolveActiveScene(),
      this.restoreRenderedThread()
    ]);
    if (!campaign.ok) return campaign;
    if (!activeScene.ok) return activeScene;
    if (!restored.ok) return restored;
    const clock = await this.repository.getAggregate(
      this.campaignId,
      "world.clock",
      campaign.value.clockAggregateId
    );
    if (!clock.ok) return clock;
    const locationRefs = await this.worldSceneLocationResolver.resolveLocationRefs(activeScene.value);
    const bundle = await loadCommittedWorldSimulationSceneBundleV1({
      repository: this.repository,
      campaignId: this.campaignId,
      sceneId: activeScene.value.sceneId,
      sceneLocationRefs: locationRefs,
      throughGameSecond: (clock.value.payload as CampaignClockPayload).elapsedGameSeconds
    });
    if (!bundle.ok) return bundle;
    const alreadyPresented = new Set(restored.value.projections.flatMap(projection =>
      projection.sourceRefs.filter(ref => ref.startsWith("world-signal:"))
    ));
    const perceptions = bundle.value.perceptions.filter(perception =>
      !alreadyPresented.has(perception.effectRef)
    );
    const pendingBundle = {
      ...bundle.value,
      perceptions,
      excludedEffectCount: bundle.value.excludedEffectCount
        + bundle.value.perceptions.length - perceptions.length,
      controlDecision: perceptions.some(perception => perception.interruptsPlayer)
        ? "INTERRUPT_FOR_PLAYER_DECISION" as const
        : "RETURN_CONTROL" as const
    };
    return projectAndRecordWorldSceneBundleV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      bundle: pendingBundle
    });
  }

  async submit(input: NarrativeTurnInputV1): Promise<Result<NarrativeTurnControllerResultV1>> {
    const validation = validateInput(input);
    if (!validation.ok) return { ok: false, error: coreError("VALIDATION_FAILED", "narrative.turn.invalid-input", { issues: validation.issues }) };

    const campaignResult = await this.repository.getCampaign(this.campaignId);
    if (!campaignResult.ok) return { ok: false, error: campaignResult.error };
    const activeSceneResult = this.activeSceneResolver === null
      ? { ok: true as const, value: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 }
      : await this.activeSceneResolver.resolve({ repository: this.repository, campaignId: this.campaignId });
    if (!activeSceneResult.ok) return activeSceneResult;
    let activeScene = activeSceneResult.value;

    const requestPayload = buildRequestPayload(input);
    const operationKind = "narrative.turn.input";
    const requestPayloadSchemaVersion = 1;
    const requestFingerprint = await computeRequestFingerprint(operationKind, requestPayloadSchemaVersion, requestPayload);
    const now = this.clock.now().toISOString();
    const stableSuffix = normalizeClientRequestId(input.clientRequestId);
    const operation: OperationRecord = {
      schemaVersion: 1,
      operationId: opaqueId<OperationId>(`${this.idPrefix}-op-${stableSuffix}`),
      campaignId: this.campaignId,
      clientRequestId: opaqueId<RequestId>(input.clientRequestId),
      idempotencyKey: opaqueId<IdempotencyKey>(`${this.idPrefix}-idem-${stableSuffix}`),
      requestFingerprint,
      operationKind,
      requestPayloadSchemaVersion,
      requestPayload,
      phase: "RECEIVED",
      observedCampaignRevision: campaignResult.value.campaignRevision,
      commitId: null,
      completionMode: null,
      resultPayloadSchemaVersion: null,
      resultPayload: null,
      failure: null,
      receivedAt: now,
      updatedAt: now
    };

    const received = await this.repository.receiveOperation(operation);
    if (!received.ok) return received;
    if (received.value.phase === "COMPLETED" && received.value.resultPayload !== null) {
      const restoredOutput = upgradeLegacyControllerOutput(received.value.resultPayload as NarrativeTurnControllerOutputV1);
      const plotOutput = await this.completePostTurnPlot({
        operation: received.value,
        output: restoredOutput,
        rawInput: input.rawInput
      });
      if (!plotOutput.ok) return plotOutput;
      const recruitment = await this.completePostTurnRelations({
        operation: received.value,
        output: plotOutput.value,
        rawInput: input.rawInput
      });
      if (!recruitment.ok) return recruitment;
      const presentedOutput = applyPostTurnRelationPresentationV1(
        plotOutput.value,
        recruitment.value
      );
      const travel = await this.completeTravelTurn({
        operation: received.value,
        output: presentedOutput
      });
      if (!travel.ok) return travel;
      this.rememberLocalReferent(travel.value, activeScene);
      this.rememberSemanticTurn(travel.value);
      this.rememberInteractionFocus(travel.value, activeScene);
      return {
        ok: true,
        value: {
          operation: received.value,
          output: travel.value
        }
      };
    }
    if (received.value.phase === "COMMITTED_PENDING_RENDER" && received.value.commitId !== null) {
      const recovered = await recoverCommittedPendingRenderV1({
        repository: this.repository,
        operation: received.value,
        input,
        activeScene
      });
      if (!recovered.ok) return recovered;
      const recoveredWithFocus = this.withProjectedInteractionFocus(
        recovered.value,
        activeScene,
        input.rawInput
      );
      const completed = await this.repository.completePresentation(
        received.value.operationId,
        "COMMITTED_DEGRADED",
        1,
        recoveredWithFocus
      );
      if (!completed.ok) return completed;
      this.rememberLocalReferent(recoveredWithFocus, activeScene);
      this.rememberSemanticTurn(recoveredWithFocus);
      this.rememberInteractionFocus(recoveredWithFocus, activeScene);
      return { ok: true, value: { operation: completed.value, output: recoveredWithFocus } };
    }
    const hydratedSceneResult = await applyPersistedSceneActorsV1({
      repository: this.repository,
      campaignId: this.campaignId,
      scene: activeScene
    });
    if (!hydratedSceneResult.ok) {
      await cancelUncommittedOperationAfterFailure(this.repository, received.value.operationId);
      return hydratedSceneResult;
    }
    const companionSceneResult = await hydrateActiveCompanionsV1({
      repository: this.repository,
      campaignId: this.campaignId,
      scene: hydratedSceneResult.value
    });
    if (!companionSceneResult.ok) {
      await cancelUncommittedOperationAfterFailure(this.repository, received.value.operationId);
      return companionSceneResult;
    }
    activeScene = companionSceneResult.value;
    this.localInteractionFocus = reconcileLocalInteractionFocusV1(
      this.localInteractionFocus,
      activeScene
    );

    activateAiCallBudgetV1(received.value.operationId);

    const output = await buildResolvedOutput({
      repository: this.repository,
      campaignId: this.campaignId,
      operation: received.value,
      input,
      createdAt: this.clock.now().toISOString(),
      intentInterpreterConfig: this.intentInterpreterConfig,
      mjPlannerConfig: this.mjPlannerConfig,
      npcPerformerConfig: this.npcPerformerConfig,
      npcInformationRuntime: this.npcInformationRuntime,
      localReferentHints: this.recentLocalReferents.filter(hint => hint.sceneId === activeScene.sceneId && hint.sceneVersion === activeScene.version),
      recentSemanticTurns: this.recentSemanticTurns,
      localInteractionFocus: this.localInteractionFocus?.status === "ACTIVE"
        ? this.localInteractionFocus
        : null,
      interpreterCharacterContextResolver:
        this.interpreterCharacterContextResolver,
      sceneTransitionRuntime: this.sceneTransitionRuntime,
      travelRuntime: this.travelRuntime,
      dynamicPlaceRuntime: this.dynamicPlaceRuntime,
      inventoryAccessRuntime: this.inventoryAccessRuntime,
      inventoryTransactionRuntime: this.inventoryTransactionRuntime,
      missionRelationRuntime: this.missionRelationRuntime,
      companionRecruitmentRuntime: this.companionRecruitmentRuntime,
      plotCreationRuntime: this.plotCreationRuntime,
      socialAccessRuntime: this.socialAccessRuntime,
      rulesAccessRuntime: this.rulesAccessRuntime,
      tacticalAccessRuntime: this.tacticalAccessRuntime,
      restRuntime: this.restRuntime,
      activeScene
    });
    if (!output.ok) {
      await cancelUncommittedOperationAfterFailure(this.repository, received.value.operationId);
      return output;
    }

    const outputWithFocus = this.withProjectedInteractionFocus(
      output.value.output,
      activeScene,
      input.rawInput
    );
    const completed = output.value.commit === null
      ? await this.repository.completeWithoutCommit(received.value.operationId, 1, outputWithFocus)
      : await this.repository.completePresentation(received.value.operationId, "COMMITTED_RENDERED", 1, outputWithFocus);
    if (!completed.ok) return completed;
    const plotOutput = await this.completePostTurnPlot({
      operation: completed.value,
      output: outputWithFocus,
      rawInput: input.rawInput
    });
    if (!plotOutput.ok) return plotOutput;
    const recruitment = await this.completePostTurnRelations({
      operation: completed.value,
      output: plotOutput.value,
      rawInput: input.rawInput
    });
    if (!recruitment.ok) return recruitment;
    const presentedOutput = applyPostTurnRelationPresentationV1(
      plotOutput.value,
      recruitment.value
    );
    const travel = await this.completeTravelTurn({
      operation: completed.value,
      output: presentedOutput
    });
    if (!travel.ok) return travel;
    this.rememberLocalReferent(travel.value, activeScene);
    this.rememberSemanticTurn(travel.value);
    this.rememberInteractionFocus(travel.value, activeScene);

    return {
      ok: true,
      value: {
        operation: completed.value,
        output: travel.value
      }
    };
  }

  async restorePlotRegistry() {
    return loadPlotRegistryV1(this.repository, this.campaignId);
  }

  private async completePostTurnPlot(input: {
    operation: OperationRecord;
    output: NarrativeTurnControllerOutputV1;
    rawInput: string;
  }): Promise<Result<NarrativeTurnControllerOutputV1>> {
    if (this.plotCreationRuntime === null) {
      return { ok: true, value: input.output };
    }
    const creation = await this.plotCreationRuntime.maybeCreateFromSearch({
      repository: this.repository,
      campaignId: this.campaignId,
      operation: input.operation,
      interpretation: input.output.interpretation,
      activeScene: input.output.activeScene
    });
    if (!creation.ok) return creation;
    let displayPacket = input.output.displayPacket;
    if (creation.value.creation !== null) {
      const evolved = await evolveDuePlotsV1({
        repository: this.repository,
        campaignId: this.campaignId,
        command: {
          schemaVersion: 1,
          contractVersion: PLOT_EVOLUTION_CONTRACT_V1,
          clientRequestId:
            `${input.operation.clientRequestId}:plot-created-evolution`
        }
      });
      if (!evolved.ok) return evolved;
      const revealed = await revealPlotEffectsInSceneV1({
        repository: this.repository,
        campaignId: this.campaignId,
        command: {
          schemaVersion: 1,
          contractVersion: PLOT_SCENE_REVEAL_CONTRACT_V1,
          clientRequestId:
            `${input.operation.clientRequestId}:plot-created-reveal`,
          sceneId: input.output.activeScene.sceneId,
          playerKnowledgeRefs: []
        }
      });
      if (!revealed.ok) return revealed;
      if (revealed.value.status === "REVEALED") {
        const packet = buildPlotSceneDisplayPacketV1(
          revealed.value.operationId,
          revealed.value.bundle
        );
        displayPacket = {
          ...displayPacket,
          displayBlocks: [
            ...displayPacket.displayBlocks,
            ...packet.displayBlocks
          ],
          reconstructionRefs: [...new Set([
            ...displayPacket.reconstructionRefs,
            ...packet.reconstructionRefs
          ])]
        } as DisplayPacketV1 & JsonObject;
      }
    }
    const profile = await loadActiveCampaignCharacterProfileV1({
      repository: this.repository,
      campaignId: this.campaignId
    });
    if (!profile.ok && profile.error.code !== "NOT_FOUND") return profile;
    const playerActorRef = profile.ok
      ? `actor:${profile.value.actorId}`
      : "player-character";
    const hypothesis = await this.plotCreationRuntime.recordHypothesisFromTurn({
      repository: this.repository,
      campaignId: this.campaignId,
      operation: input.operation,
      rawInput: input.rawInput,
      playerActorRef,
      interpretation: input.output.interpretation
    });
    if (!hypothesis.ok) return hypothesis;
    const conclusion = await this.plotCreationRuntime.resolveConclusionFromTurn({
      repository: this.repository,
      campaignId: this.campaignId,
      operation: input.operation,
      rawInput: input.rawInput,
      playerActorRef,
      interpretation: input.output.interpretation
    });
    if (!conclusion.ok) return conclusion;
    if (conclusion.value.resolution !== null) {
      const resolution = conclusion.value.resolution.resolution;
      const template = displayPacket.displayBlocks.find(
        block => block.kind === "GM_NARRATION"
      ) ?? displayPacket.displayBlocks[0];
      if (template !== undefined) {
        const sourceRefs = [...new Set([
          `plot:${conclusion.value.resolution.plotId}`,
          ...resolution.sourceRefs
        ])];
        displayPacket = {
          ...displayPacket,
          displayBlocks: [...displayPacket.displayBlocks, {
            ...template,
            blockId: `${input.operation.operationId}:plot-resolution`,
            kind: "GM_NARRATION",
            text: `Les éléments finissent par s'accorder : ${resolution.conclusion}`,
            sourceRefs,
            isDegradedFallback: false
          }],
          reconstructionRefs: [...new Set([
            ...displayPacket.reconstructionRefs,
            ...sourceRefs
          ])]
        } as DisplayPacketV1 & JsonObject;
      }
    }
    return {
      ok: true,
      value: {
        ...input.output,
        displayPacket,
        aiTelemetry: [
          ...input.output.aiTelemetry,
          ...creation.value.telemetry,
          ...conclusion.value.telemetry
        ]
      }
    };
  }

  private async completePostTurnRelations(input: {
    operation: OperationRecord;
    output: NarrativeTurnControllerOutputV1;
    rawInput: string;
    missionResult?: MissionRelationEngagementResultV1 | null;
  }): Promise<Result<{
    missionResult: MissionRelationEngagementResultV1 | null;
    companionResult: CompanionPartyMutationResultV1 | null;
  }>> {
    if (input.output.resolution?.resolutionId.endsWith(":resolution:companion-directive")) {
      return {
        ok: true,
        value: { missionResult: null, companionResult: null }
      };
    }
    const ownerAdapter = buildOpenSemanticLegacyOwnerAdapterProjectionV1(
      input.output.interpretation
    );
    const ownerInterpretation = ownerAdapter?.interpretation
      ?? input.output.interpretation;
    const ownerInputText = ownerAdapter?.semanticInputText ?? input.rawInput;
    let missionResult = input.missionResult;
    if (missionResult === undefined) {
      if (this.missionRelationRuntime === null) return {
        ok: true,
        value: { missionResult: null, companionResult: null }
      };
      if (
        input.output.interpretation.semanticSource === "OPEN_SEMANTIC_FRAME_V8"
        && ownerAdapter?.capabilityId !== "companion.follow-request"
      ) {
        missionResult = null;
      } else {
      const replayedMission = await this.missionRelationRuntime.proposeFromDialogue({
        repository: this.repository,
        campaignId: this.campaignId,
        operation: input.operation,
        rawInput: ownerInputText,
        interpretation: ownerInterpretation,
        activeScene: input.output.activeScene
      });
      if (!replayedMission.ok) return replayedMission;
      missionResult = replayedMission.value;
      }
    }
    if (
      this.companionRecruitmentRuntime === null
      || ownerInterpretation.semanticIntent.companionDirective?.category
        !== "FOLLOW"
    ) return {
      ok: true,
      value: { missionResult: missionResult ?? null, companionResult: null }
    };
    const profile = await loadActiveCampaignCharacterProfileV1({
      repository: this.repository,
      campaignId: this.campaignId
    });
    if (!profile.ok && profile.error.code !== "NOT_FOUND") return profile;
    const companionResult = await this.companionRecruitmentRuntime.maybeRecruit({
      repository: this.repository,
      campaignId: this.campaignId,
      operation: input.operation,
      interpretation: ownerInterpretation,
      activeScene: input.output.activeScene,
      playerActorRef: profile.ok
        ? `actor:${profile.value.actorId}`
        : "player-character",
      missionResult: missionResult ?? null
    });
    return companionResult.ok
      ? {
          ok: true,
          value: {
            missionResult: missionResult ?? null,
            companionResult: companionResult.value
          }
        }
      : companionResult;
  }

  private async completeTravelTurn(input: {
    operation: OperationRecord;
    output: NarrativeTurnControllerOutputV1;
  }): Promise<Result<NarrativeTurnControllerOutputV1>> {
    if (this.travelRuntime === null) return { ok: true, value: input.output };
    const ownerAdapter = buildOpenSemanticLegacyOwnerAdapterProjectionV1(
      input.output.interpretation
    );
    const ownerInterpretation = ownerAdapter?.interpretation
      ?? input.output.interpretation;
    const normalizedTravelRequest =
      `${input.operation.clientRequestId}:travel-advance`
        .replace(/[^a-zA-Z0-9:_-]+/g, "-");
    for (const operationId of [
      `travel-start:${input.operation.operationId}`,
      `travel-segment:${normalizedTravelRequest}`,
      `travel-interruption:${input.operation.operationId}`
    ]) {
      const child = await this.repository.getOperation(
        opaqueId<OperationId>(operationId)
      );
      if (!child.ok && child.error.code !== "NOT_FOUND") return child;
      if (
        child.ok
        && child.value.phase === "COMPLETED"
        && isTravelPresentationV1(child.value.resultPayload?.presentation)
      ) {
        let replayed = applyTravelPresentationV1(
          input.output,
          child.value.resultPayload.presentation
        );
        if (child.value.resultPayload.presentation.kind === "ARRIVAL") {
          const arrivalScene = await this.resolveActiveScene();
          if (!arrivalScene.ok) return arrivalScene;
          replayed = {
            ...replayed,
            activeScene: arrivalScene.value,
            displayPacket: {
              ...replayed.displayPacket,
              sceneId: arrivalScene.value.sceneId
            } as DisplayPacketV1 & JsonObject
          };
        }
        return { ok: true, value: replayed };
      }
    }
    const active = await this.travelRuntime.restoreActive({
      repository: this.repository,
      campaignId: this.campaignId
    });
    if (!active.ok) return active;
    if (active.value?.status === "INTERRUPTED") {
      if (travelInterruptionApproachV1(ownerInterpretation) === null) {
        return { ok: true, value: input.output };
      }
      const resolved = await this.travelRuntime.respondToInterruption({
        repository: this.repository,
        campaignId: this.campaignId,
        sourceOperation: input.operation,
        interpretation: ownerInterpretation,
        activeScene: input.output.activeScene
      });
      return resolved.ok
        ? {
            ok: true,
            value: applyTravelPresentationV1(
              input.output,
              resolved.value.presentation
            )
          }
        : resolved;
    }
    if (
      active.value !== null
      && ["PLANNED", "ACTIVE"].includes(active.value.status)
      && ownerInterpretation.semanticIntent.kind
        === "traverse_visible_boundary"
      && ownerInterpretation.semanticIntent.commitment === "committed"
      && !ownerInterpretation.requiresClarification
    ) {
      const advanced = await this.travelRuntime.advance({
        repository: this.repository,
        campaignId: this.campaignId,
        clientRequestId: `${input.operation.clientRequestId}:travel-advance`,
        activeScene: input.output.activeScene
      });
      if (!advanced.ok) return advanced;
      let presented = applyTravelPresentationV1(
        input.output,
        advanced.value.presentation
      );
      if (advanced.value.process.status === "ARRIVED") {
        const arrivalScene = await this.resolveActiveScene();
        if (!arrivalScene.ok) return arrivalScene;
        presented = {
          ...presented,
          activeScene: arrivalScene.value,
          displayPacket: {
            ...presented.displayPacket,
            sceneId: arrivalScene.value.sceneId
          } as DisplayPacketV1 & JsonObject
        };
      }
      return { ok: true, value: presented };
    }
    if (active.value !== null) return { ok: true, value: input.output };
    const canHandle = await this.travelRuntime.canHandle({
      repository: this.repository,
      campaignId: this.campaignId,
      interpretation: ownerInterpretation,
      domainCommand: input.output.domainCommand,
      activeScene: input.output.activeScene
    });
    if (!canHandle) return { ok: true, value: input.output };
    const started = await this.travelRuntime.start({
      repository: this.repository,
      campaignId: this.campaignId,
      sourceOperation: input.operation,
      interpretation: ownerInterpretation,
      activeScene: input.output.activeScene
    });
    return started.ok
      ? {
          ok: true,
          value: applyTravelPresentationV1(
            input.output,
            started.value.presentation
          )
        }
      : started;
  }

  async recordRenderedProjection(
    request: NarrativeRenderProjectionInputV1
  ): Promise<Result<NarrativeRenderProjectionRecordResultV1>> {
    const recorded = await recordNarrativeRenderedProjectionV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      request
    });
    if (recorded.ok) {
      closeAiCallBudgetV1(request.sourceOutput.operationId);
      const performanceAwareOutput = request.sourceOutput as NarrativeTurnControllerOutputV1 & {
        npcEffectivePerformance?: (NpcPerformerPayloadV1 & JsonObject) | null;
      };
      const performance = performanceAwareOutput.npcEffectivePerformance ?? request.sourceOutput.npcPerformance;
      if (performance !== null) {
        const profile = await loadActiveCampaignCharacterProfileV1({
          repository: this.repository,
          campaignId: this.campaignId
        });
        if (profile.ok) {
          const campaign = await this.repository.getCampaign(this.campaignId);
          if (!campaign.ok) return campaign;
          const clock = await this.repository.getAggregate(
            this.campaignId,
            "world.clock",
            campaign.value.clockAggregateId
          );
          if (!clock.ok) return clock;
          const displayPacket = recorded.value.projection.displayPacket as unknown as DisplayPacketV1;
          const finalNpcSpeechText = displayPacket.displayBlocks.find(block => block.kind === "NPC_SPEECH")?.text ?? null;
          const captured = await captureNpcTestimonyV1({
            repository: this.repository,
            campaignId: this.campaignId,
            performance,
            finalNpcSpeechText,
            sourceOperationId: recorded.value.operation.operationId,
            sceneRef: `scene:${request.sourceOutput.activeScene.sceneId}`,
            playerActorRef: `actor:${profile.value.actorId}`,
            occurredAtGameSecond: Number((clock.value.payload as CampaignClockPayload).elapsedGameSeconds ?? 0)
          });
          if (!captured.ok) return captured;
        } else if (profile.error.code !== "NOT_FOUND") {
          return profile;
        }
      }
    }
    return recorded;
  }

  async rollPendingSkillCheck(
    command: ResumePendingSkillCheckCommandV1
  ): Promise<Result<ResumePendingSkillCheckResultV1>> {
    const source = await this.repository.getOperation(opaqueId<OperationId>(command.sourceOperationId));
    if (!source.ok) return source;
    const pending = (source.value.resultPayload as {
      pendingSkillCheck?: PendingNarrativeSkillCheckV1 | null;
    } | null)?.pendingSkillCheck ?? null;
    if (pending === null) {
      return { ok: false, error: coreError("VALIDATION_FAILED", "narrative.skill-check.pending-state-missing") };
    }
    const activeScene = this.activeSceneResolver === null
      ? { ok: true as const, value: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 }
      : await this.activeSceneResolver.resolve({ repository: this.repository, campaignId: this.campaignId });
    if (!activeScene.ok) return activeScene;
    return resumePendingSkillCheckV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command,
      pending,
      scene: activeScene.value,
      d20Source: this.d20Source,
      runtimeBindings: this.runtimeBindings
    });
  }

  async projectCharacterProgression(input: {
    schemaVersion: 1;
    applicationOperationId: string;
    sceneId?: string;
  }): Promise<Result<CharacterProgressionProjectionResultV1>> {
    if (input.schemaVersion !== 1 || !input.applicationOperationId.trim()) {
      return {
        ok: false,
        error: coreError("VALIDATION_FAILED", "progression.presentation.invalid-input")
      };
    }
    const activeScene = input.sceneId === undefined
      ? await this.resolveActiveScene()
      : { ok: true as const, value: { sceneId: input.sceneId } };
    if (!activeScene.ok) return activeScene;
    return projectAndRecordCharacterProgressionV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      applicationOperationId: input.applicationOperationId,
      sceneId: activeScene.value.sceneId
    });
  }

  async projectBastionEstablishment(input: {
    schemaVersion: 1;
    establishmentOperationId: string;
    sceneId?: string;
  }): Promise<Result<BastionProjectionResultV1>> {
    if (input.schemaVersion !== 1 || !input.establishmentOperationId.trim()) {
      return {
        ok: false,
        error: coreError("VALIDATION_FAILED", "bastion.presentation.invalid-input")
      };
    }
    const activeScene = input.sceneId === undefined
      ? await this.resolveActiveScene()
      : { ok: true as const, value: { sceneId: input.sceneId } };
    if (!activeScene.ok) return activeScene;
    return projectAndRecordBastionEstablishmentV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      establishmentOperationId: input.establishmentOperationId,
      sceneId: activeScene.value.sceneId
    });
  }

  async projectBastionWorkCompletion(input: {
    schemaVersion: 1;
    completionOperationId: string;
    sceneId?: string;
  }): Promise<Result<BastionWorkProjectionResultV1>> {
    if (input.schemaVersion !== 1 || !input.completionOperationId.trim()) {
      return {
        ok: false,
        error: coreError("VALIDATION_FAILED", "bastion.work-presentation.invalid-input")
      };
    }
    const activeScene = input.sceneId === undefined
      ? await this.resolveActiveScene()
      : { ok: true as const, value: { sceneId: input.sceneId } };
    if (!activeScene.ok) return activeScene;
    return projectAndRecordBastionWorkCompletionV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      completionOperationId: input.completionOperationId,
      sceneId: activeScene.value.sceneId
    });
  }

  async projectBastionOccupantAssignment(input: {
    schemaVersion: 1;
    assignmentOperationId: string;
    sceneId?: string;
  }): Promise<Result<BastionOccupantProjectionResultV1<BastionOccupantAssignmentSummaryV1>>> {
    if (input.schemaVersion !== 1 || !input.assignmentOperationId.trim()) {
      return {
        ok: false,
        error: coreError("VALIDATION_FAILED", "bastion.occupant-presentation.invalid-input")
      };
    }
    const activeScene = input.sceneId === undefined
      ? await this.resolveActiveScene()
      : { ok: true as const, value: { sceneId: input.sceneId } };
    if (!activeScene.ok) return activeScene;
    return projectAndRecordBastionOccupantAssignmentV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      assignmentOperationId: input.assignmentOperationId,
      sceneId: activeScene.value.sceneId
    });
  }

  async projectBastionOccupantActivity(input: {
    schemaVersion: 1;
    activityOperationId: string;
    sceneId?: string;
  }): Promise<Result<BastionOccupantProjectionResultV1<BastionOccupantActivitySummaryV1>>> {
    if (input.schemaVersion !== 1 || !input.activityOperationId.trim()) {
      return {
        ok: false,
        error: coreError("VALIDATION_FAILED", "bastion.occupant-presentation.invalid-input")
      };
    }
    const activeScene = input.sceneId === undefined
      ? await this.resolveActiveScene()
      : { ok: true as const, value: { sceneId: input.sceneId } };
    if (!activeScene.ok) return activeScene;
    return projectAndRecordBastionOccupantActivityV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      activityOperationId: input.activityOperationId,
      sceneId: activeScene.value.sceneId
    });
  }

  async processBastionOccupantBoundary(input: {
    command: ResolveBastionOccupantActivityCommandV1;
    catalog: BastionOccupantCatalogV1 | null;
    authority: BastionOccupantActivityAuthorityV1 | null;
    sceneId?: string;
  }): Promise<Result<{
    activityResult: BastionOccupantActivityResultV1;
    projection: BastionOccupantProjectionResultV1<BastionOccupantActivitySummaryV1> | null;
  }>> {
    const activityResult = await resolveBastionOccupantActivityBoundaryV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command: input.command,
      catalog: input.catalog,
      authority: input.authority
    });
    if (!activityResult.ok) return activityResult;
    if (activityResult.value.status === "CALM") {
      return {
        ok: true,
        value: {
          activityResult: activityResult.value,
          projection: null
        }
      };
    }
    const projected = await this.projectBastionOccupantActivity({
      schemaVersion: 1,
      activityOperationId:
        `bastion-occupant-activity:${input.command.clientRequestId}`,
      ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId })
    });
    if (!projected.ok) return projected;
    return {
      ok: true,
      value: {
        activityResult: activityResult.value,
        projection: projected.value
      }
    };
  }

  async projectBastionIncident(input: {
    schemaVersion: 1;
    incidentOperationId: string;
    sceneId?: string;
  }): Promise<Result<BastionIncidentProjectionResultV1>> {
    if (input.schemaVersion !== 1 || !input.incidentOperationId.trim()) {
      return {
        ok: false,
        error: coreError("VALIDATION_FAILED", "bastion.incident-presentation.invalid-input")
      };
    }
    const activeScene = input.sceneId === undefined
      ? await this.resolveActiveScene()
      : { ok: true as const, value: { sceneId: input.sceneId } };
    if (!activeScene.ok) return activeScene;
    return projectAndRecordBastionIncidentV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      incidentOperationId: input.incidentOperationId,
      sceneId: activeScene.value.sceneId
    });
  }

  async processBastionIncidentBoundary(input: {
    command: HandleBastionIncidentCommandV1;
    catalog?: BastionIncidentCatalogV1 | null;
    policy?: BastionIncidentPolicyV1 | null;
    defenseAuthority?: BastionDefenseHandoffAuthorityV1 | null;
    sceneId?: string;
  }): Promise<Result<{
    incidentResult: BastionIncidentResultV1;
    projection: BastionIncidentProjectionResultV1 | null;
  }>> {
    const incidentResult = await handleBastionIncidentV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command: input.command,
      catalog: input.catalog
        ?? this.bastionTacticalRuntime?.incidentCatalog
        ?? null,
      policy: input.policy
        ?? this.bastionTacticalRuntime?.incidentPolicy
        ?? null,
      defenseAuthority: input.defenseAuthority
        ?? this.bastionTacticalRuntime?.defenseAuthority
        ?? null
    });
    if (!incidentResult.ok) return incidentResult;
    if (incidentResult.value.status === "IGNORED") {
      return {
        ok: true,
        value: { incidentResult: incidentResult.value, projection: null }
      };
    }
    const projected = await this.projectBastionIncident({
      schemaVersion: 1,
      incidentOperationId: `bastion-incident:${input.command.clientRequestId}`,
      ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId })
    });
    if (!projected.ok) return projected;
    return {
      ok: true,
      value: {
        incidentResult: incidentResult.value,
        projection: projected.value
      }
    };
  }

  async processCommittedBastionCauseBoundary(input: {
    sourceOperationId: string;
    sourceEventId: string;
    causeRoutingPolicy?: BastionCommittedCauseRoutingPolicyV1 | null;
    catalog?: BastionIncidentCatalogV1 | null;
    incidentPolicy?: BastionIncidentPolicyV1 | null;
    defenseAuthority?: BastionDefenseHandoffAuthorityV1 | null;
    sceneId?: string;
  }): Promise<Result<{
    routing: BastionCommittedCauseRoutingResultV1;
    incidentResult: BastionIncidentResultV1 | null;
    projection: BastionIncidentProjectionResultV1 | null;
  }>> {
    const routing = await routeCommittedBastionCauseV1({
      repository: this.repository,
      campaignId: this.campaignId,
      sourceOperationId: input.sourceOperationId,
      sourceEventId: input.sourceEventId,
      policy: input.causeRoutingPolicy
        ?? this.bastionTacticalRuntime?.causeRoutingPolicy
        ?? null
    });
    if (!routing.ok) return routing;
    if (
      routing.value.status === "IGNORED"
      || routing.value.command === null
    ) {
      return {
        ok: true,
        value: {
          routing: routing.value,
          incidentResult: null,
          projection: null
        }
      };
    }
    const processed = await this.processBastionIncidentBoundary({
      command: routing.value.command,
      catalog: input.catalog,
      policy: input.incidentPolicy,
      defenseAuthority: input.defenseAuthority,
      ...(input.sceneId === undefined ? {} : { sceneId: input.sceneId })
    });
    if (!processed.ok) return processed;
    return {
      ok: true,
      value: {
        routing: routing.value,
        incidentResult: processed.value.incidentResult,
        projection: processed.value.projection
      }
    };
  }

  async restoreActiveBastionTacticalSession():
    Promise<Result<BastionTacticalSessionV1 | null>> {
    return restoreActiveBastionTacticalSessionV1({
      repository: this.repository,
      campaignId: this.campaignId
    });
  }

  async saveTacticalCheckpoint(command: {
    schemaVersion: 1;
    processId: string;
    clientRequestId: string;
    lastAppliedTurnId: string;
    ownerState: JsonObject;
  }) {
    return saveTacticalCheckpointV1({
      repository: this.repository,
      campaignId: this.campaignId,
      processId: command.processId,
      clientRequestId: command.clientRequestId,
      lastAppliedTurnId: command.lastAppliedTurnId,
      ownerState: command.ownerState,
      technicalTimestamp: this.clock.now().toISOString()
    });
  }

  async recordPendingTacticalOutcome(command: {
    schemaVersion: 1;
    clientRequestId: string;
    outcome: TacticalOutcomeV1;
  }) {
    return recordPendingTacticalOutcomeV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clientRequestId: command.clientRequestId,
      outcome: command.outcome,
      technicalTimestamp: this.clock.now().toISOString()
    });
  }

  async integratePendingTacticalOutcome(command: {
    schemaVersion: 1;
    processId: string;
    clientRequestId: string;
  }) {
    const integrated = await integratePendingTacticalOutcomeV1({
      repository: this.repository,
      campaignId: this.campaignId,
      processId: command.processId,
      clientRequestId: command.clientRequestId,
      authorities: this.tacticalConsequenceAuthorities,
      runtimeBindings: this.runtimeBindings,
      technicalTimestamp: this.clock.now().toISOString()
    });
    if (!integrated.ok) return integrated;
    const scene = await this.resolveActiveScene();
    if (!scene.ok) return scene;
    const projected = await projectAndRecordTacticalOutcomeIntegrationV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      processId: command.processId,
      sceneId: scene.value.sceneId
    });
    return projected.ok ? integrated : projected;
  }

  async advanceRest(command: {
    schemaVersion: 1;
    clientRequestId: string;
    processId: string;
    activity?: RestSegmentActivityV1 | null;
  }): Promise<Result<NarrativeTurnControllerResultV1>> {
    if (this.restRuntime === null) {
      return { ok: false, error: coreError("VALIDATION_FAILED", "narrative.rest.runtime-unavailable") };
    }
    const activeScene = await this.resolveActiveScene();
    if (!activeScene.ok) return activeScene;
    return this.restRuntime.advance({
      repository: this.repository,
      campaignId: this.campaignId,
      processId: command.processId,
      clientRequestId: command.clientRequestId,
      activity: command.activity ?? null,
      activeScene: activeScene.value,
      createdAt: this.clock.now().toISOString()
    });
  }

  async restoreActiveRest(): Promise<Result<RestProcessStateV1 | null>> {
    if (this.restRuntime === null) return { ok: true, value: null };
    return this.restRuntime.restoreActive({
      repository: this.repository,
      campaignId: this.campaignId
    });
  }

  async restoreActiveTravel() {
    return this.travelRuntime === null
      ? { ok: true as const, value: null }
      : this.travelRuntime.restoreActive({
          repository: this.repository,
          campaignId: this.campaignId
        });
  }

  async advanceTravel(command: {
    schemaVersion: 1;
    clientRequestId: string;
  }) {
    if (
      this.travelRuntime === null
      || command.schemaVersion !== 1
      || !command.clientRequestId.trim()
    ) return {
      ok: false as const,
      error: coreError(
        "VALIDATION_FAILED",
        "narrative.travel.advance-unavailable"
      )
    };
    const activeScene = await this.resolveActiveScene();
    if (!activeScene.ok) return activeScene;
    return this.travelRuntime.advance({
      repository: this.repository,
      campaignId: this.campaignId,
      clientRequestId: command.clientRequestId,
      activeScene: activeScene.value
    });
  }

  async promoteSceneActor(
    command: PromoteSceneActorCommandV1
  ): Promise<Result<PromoteSceneActorResultV1>> {
    return promoteSceneActorToCampaignNpcV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command
    });
  }

  async proposeMissionRelationEngagement(
    command: ProposeMissionRelationEngagementCommandV1
  ): Promise<Result<MissionRelationEngagementResultV1>> {
    return proposeMissionRelationEngagementV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command
    });
  }

  async resolveMissionRelationEngagement(
    command: ResolveMissionRelationEngagementCommandV1
  ): Promise<Result<MissionRelationEngagementResultV1>> {
    return resolveMissionRelationEngagementV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command
    });
  }

  async recordMissionOutcome(
    command: RecordMissionOutcomeCommandV1
  ): Promise<Result<MissionRelationEngagementResultV1>> {
    return recordMissionOutcomeV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command
    });
  }

  async recordCampaignLoreProjection(
    command: RecordCampaignLoreProjectionCommandV1
  ): Promise<Result<RecordCampaignLoreProjectionResultV1>> {
    return recordCampaignLoreProjectionV1({
      repository: this.repository,
      campaignId: this.campaignId,
      command
    });
  }

  async restoreRenderedThread(limit = 100): Promise<Result<RestoredNarrativeThreadV1>> {
    const rendered = await restoreNarrativeRenderedThreadV1({
      repository: this.repository,
      campaignId: this.campaignId,
      limit
    });
    if (!rendered.ok) return rendered;
    const restoredContext = await this.restoreRecentInterpreterContext();
    if (!restoredContext.ok) return restoredContext;
    return rendered;
  }

  async restorePendingSkillCheck(): Promise<Result<PendingNarrativeSkillCheckV1 | null>> {
    const [operations, outcomes] = await Promise.all([
      this.repository.listOperations(this.campaignId, "narrative.turn.input", 100),
      this.repository.listOperations(this.campaignId, "rules.skill-check.commit-outcome", 100)
    ]);
    if (!operations.ok) return operations;
    if (!outcomes.ok) return outcomes;
    const completedCheckIds = new Set(outcomes.value
      .filter(operation => operation.phase === "COMPLETED")
      .map(operation => (operation.resultPayload as { checkId?: string } | null)?.checkId)
      .filter((checkId): checkId is string => typeof checkId === "string"));
    const candidates = [...operations.value]
      .filter(operation => operation.phase === "COMPLETED" && operation.resultPayload !== null)
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
    for (const operation of candidates) {
      const pending = (operation.resultPayload as {
        pendingSkillCheck?: PendingNarrativeSkillCheckV1 | null;
      }).pendingSkillCheck ?? null;
      if (pending === null) continue;
      if (!completedCheckIds.has(pending.proposal.checkId)) return { ok: true, value: pending };
    }
    return { ok: true, value: null };
  }

  async restoreSkillCheckResultPackets(limit = 100): Promise<Result<DisplayPacketV1[]>> {
    const operations = await this.repository.listOperations(
      this.campaignId,
      "rules.skill-check.commit-outcome",
      limit
    );
    if (!operations.ok) return operations;
    const packets = operations.value
      .filter(operation => operation.phase === "COMPLETED" && operation.resultPayload !== null)
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))
      .map(operation => (operation.resultPayload as { displayPacket?: DisplayPacketV1 }).displayPacket)
      .filter((packet): packet is DisplayPacketV1 => packet !== undefined);
    return { ok: true, value: packets };
  }

  private rememberLocalReferent(output: NarrativeTurnControllerOutputV1, activeScene: PlayableSceneStateV1): void {
    const target = rememberedTargetFromInterpretationV1(output.interpretation);
    if (target === null || target.ref === null || target.kind === "unknown" || target.kind === "self") return;
    const releasesFocus = semanticIntentReleasesFocusV1(output.interpretation.semanticIntent);
    if (releasesFocus) {
      this.recentLocalReferents = this.recentLocalReferents.filter(entry => entry.target.ref !== target.ref);
      return;
    }
    const hint: LocalReferentHintV1 = {
      schemaVersion: 1,
      sceneId: activeScene.sceneId,
      sceneVersion: activeScene.version,
      target,
      sourceOperationId: output.operationId,
      sourceText: output.interpretation.semanticIntent.playerGoal,
      confidence: output.interpretation.referentResolution?.confidence ?? "medium"
    };
    this.recentLocalReferents = [
      hint,
      ...this.recentLocalReferents.filter(entry => entry.target.ref !== target.ref)
    ].slice(0, 5);
  }

  private rememberSemanticTurn(output: NarrativeTurnControllerOutputV1): void {
    if (output.interpretation.runtimeDecision.status === "AI_INTERPRETATION_FAILED") return;
    const releasesFocus = semanticIntentReleasesFocusV1(output.interpretation.semanticIntent);
    const openFrame = output.interpretation.openSemanticFrame ?? null;
    const turn: RecentSemanticTurnV1 = {
      schemaVersion: 1,
      operationId: output.operationId,
      semanticKind: output.interpretation.semanticIntent.kind,
      playerGoal: openFrame?.overallMeaning ?? output.interpretation.semanticIntent.playerGoal,
      primaryTarget: rememberedTargetFromInterpretationV1(output.interpretation),
      topic: typeof output.interpretation.topic === "string" ? output.interpretation.topic : null,
      commitment: openFrame?.overallCommitment ?? output.interpretation.semanticIntent.commitment,
      ...(openFrame === null ? {} : { understandingStatus: openFrame.understandingStatus }),
      focusDisposition: releasesFocus ? "RELEASE" : "RETAIN"
    };
    this.recentSemanticTurns = [
      turn,
      ...this.recentSemanticTurns.filter(entry => entry.operationId !== turn.operationId)
    ].slice(0, 5);
  }

  private withProjectedInteractionFocus(
    output: NarrativeTurnControllerOutputV1,
    activeScene: PlayableSceneStateV1,
    rawInput: string
  ): NarrativeTurnControllerOutputV1 {
    const faithfulOutput = applyOpenSemanticFidelityV1({ output, rawInput });
    const projection = projectLocalInteractionFocusV1({
      previous: this.localInteractionFocus,
      output: faithfulOutput,
      activeScene
    });
    return {
      ...faithfulOutput,
      localInteractionFocus: projection.current,
      closedLocalInteractionFocus: projection.closed
    };
  }

  private rememberInteractionFocus(
    output: NarrativeTurnControllerOutputV1,
    activeScene: PlayableSceneStateV1
  ): void {
    if (Object.prototype.hasOwnProperty.call(output, "localInteractionFocus")) {
      const persisted = (output as Partial<NarrativeTurnControllerOutputWithInteractionFocusV1>)
        .localInteractionFocus ?? null;
      this.localInteractionFocus = persisted !== null && validateLocalInteractionFocusV1(persisted).length === 0
        ? reconcileLocalInteractionFocusV1(persisted, activeScene)
        : null;
      return;
    }
    this.localInteractionFocus = projectLocalInteractionFocusV1({
      previous: this.localInteractionFocus,
      output,
      activeScene
    }).current;
  }

  private async restoreRecentInterpreterContext(): Promise<Result<null>> {
    const operations = await this.repository.listOperations(
      this.campaignId,
      "narrative.turn.input",
      100
    );
    if (!operations.ok) return operations;
    const outputs = operations.value
      .filter(operation =>
        operation.phase === "COMPLETED"
        && operation.resultPayload !== null
      )
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))
      .slice(-5)
      .map(operation =>
        upgradeLegacyControllerOutput(
          operation.resultPayload as NarrativeTurnControllerOutputV1
        )
      )
      .filter(output =>
        output.contractVersion === "narrative-turn-controller/1"
        && output.activeScene !== undefined
        && output.interpretation !== undefined
      );
    this.recentLocalReferents = [];
    this.recentSemanticTurns = [];
    this.localInteractionFocus = null;
    for (const output of outputs) {
      this.rememberLocalReferent(output, output.activeScene);
      this.rememberSemanticTurn(output);
      this.rememberInteractionFocus(output, output.activeScene);
    }
    return { ok: true, value: null };
  }
}

function rememberedTargetFromInterpretationV1(
  interpretation: NarrativeIntentInterpretationV1
): NarrativeIntentTargetV1 | null {
  const projectedTarget = interpretation.referentResolution?.resolvedTarget
    ?? interpretation.semanticIntent.target;
  if (projectedTarget !== null) return projectedTarget;
  const frame = interpretation.openSemanticFrame;
  if (frame === null || frame === undefined || frame.understandingStatus !== "UNDERSTOOD") return null;
  const mentionedTargets = frame.components.flatMap(component => component.mentionedTargets)
    .filter((target): target is typeof target & { proposedRef: string } => target.proposedRef !== null);
  const targetRefs = [...new Set(mentionedTargets.map(target => target.proposedRef))];
  if (targetRefs.length !== 1) return null;
  const ref = targetRefs[0]!;
  const label = mentionedTargets.find(target => target.proposedRef === ref)?.surface ?? null;
  const kind: NarrativeIntentTargetV1["kind"] = ref.startsWith("npc:")
    ? "npc"
    : ref.startsWith("poi:") || ref.startsWith("element:") || ref.startsWith("item:")
      ? "object"
      : ref.startsWith("location:") || ref.startsWith("wiki-location:")
        ? "place"
        : ref.startsWith("actor:") || ref.startsWith("player-character:")
          ? "self"
          : "unknown";
  return { kind, ref, label };
}

async function cancelUncommittedOperationAfterFailure(repository: CampaignRepository, operationId: OperationId): Promise<void> {
  const current = await repository.getOperation(operationId);
  if (!current.ok || !["RECEIVED", "PREPARING", "SUSPENDED", "READY_TO_COMMIT"].includes(current.value.phase)) return;
  await repository.transitionOperation(operationId, current.value.phase as "RECEIVED" | "PREPARING" | "SUSPENDED" | "READY_TO_COMMIT", "CANCELLED");
}

function upgradeLegacyControllerOutput(output: NarrativeTurnControllerOutputV1): NarrativeTurnControllerOutputV1 {
  const interpretation = upgradeLegacyNarrativeIntentInterpretationV1(output.interpretation);
  if (interpretation === null) return output;
  const domainCommand = output.domainCommand ?? buildNarrativeDomainCommandV1(interpretation);
  const resolutionInterpretation = upgradeLegacyNarrativeIntentInterpretationV1(output.resolution?.interpretation) ?? interpretation;
  const knownInterpretation = output.suspendedIntent === null
    ? null
    : upgradeLegacyNarrativeIntentInterpretationV1(output.suspendedIntent.knownInterpretation);
  return {
    ...output,
    sceneArrival: output.sceneArrival ?? null,
    activeScene: output.activeScene ?? REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    stageTimings: output.stageTimings ?? null,
    aiTelemetry: Array.isArray(output.aiTelemetry) ? output.aiTelemetry : [],
    interpretation: interpretation as NarrativeIntentInterpretationV1 & JsonObject,
    domainCommand,
    resolution: {
      ...output.resolution,
      interpretation: resolutionInterpretation as NarrativeIntentInterpretationV1 & JsonObject,
      domainCommand: output.resolution.domainCommand ?? domainCommand
    },
    suspendedIntent: output.suspendedIntent === null || knownInterpretation === null
      ? output.suspendedIntent
      : {
        ...output.suspendedIntent,
        knownInterpretation: knownInterpretation as NarrativeIntentInterpretationV1 & JsonObject
    },
    pendingSkillCheck: output.pendingSkillCheck ?? null,
    ...(Object.prototype.hasOwnProperty.call(output, "activeRestProcess")
      ? {
          activeRestProcess: (output as NarrativeTurnControllerOutputV1 & {
            activeRestProcess?: RestProcessStateV1 | null;
          }).activeRestProcess ?? null
        }
      : {})
  };
}

export async function createPrototypeNarrativeTurnControllerV1(options: {
  clock?: RepositoryClock;
  intentInterpreterConfig?: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig?: MjPlannerConfigV1 | null;
  npcPerformerConfig?: NpcPerformerConfigV1 | null;
  npcInformationRuntimeFactory?: (input: { repository: CampaignRepository; campaignId: CampaignId }) => NarrativeNpcInformationRuntimeV1;
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  travelRuntime?: NarrativeTravelRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  inventoryAccessRuntime?: NarrativeInventoryAccessRuntimeV1 | null;
  inventoryTransactionRuntime?: NarrativeInventoryTransactionRuntimeV1 | null;
  missionRelationRuntime?: NarrativeMissionRelationRuntimeV1 | null;
  companionRecruitmentRuntime?: NarrativeCompanionRecruitmentRuntimeV1 | null;
  plotCreationRuntime?: NarrativePlotCreationRuntimeV1 | null;
  socialAccessRuntime?: NarrativeSocialAccessRuntimeV1 | null;
  rulesAccessRuntime?: NarrativeRulesAccessRuntimeV1 | null;
  tacticalAccessRuntime?: NarrativeTacticalAccessRuntimeV1 | null;
  restRuntime?: NarrativeRestRuntimeV1 | null;
  worldSceneLocationResolver?: NarrativeWorldSceneLocationResolverV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
  interpreterCharacterContextResolver?:
    InterpreterCharacterContextResolverV1 | null;
  tacticalConsequenceAuthorities?: readonly TacticalConsequenceAuthorityV1[];
  bastionTacticalRuntimeFactory?: NarrativeBastionTacticalRuntimeFactoryV1;
  initialScene?: { scene: PlayableSceneStateV1; locationRef: string };
  initializeRepository?: (repository: CampaignRepository, campaignId: CampaignId, clock: RepositoryClock) => Promise<void>;
} = {}): Promise<NarrativeTurnControllerV1> {
  const clock = options.clock ?? systemClock;
  const repository = new MemoryCampaignRepository({ clock });
  await ensurePrototypeCampaign(repository, clock);
  await ensurePrototypeInnSceneTransitionStateV1(repository, DEFAULT_CAMPAIGN_ID, clock, options.initialScene);
  await options.initializeRepository?.(repository, DEFAULT_CAMPAIGN_ID, clock);
  return new NarrativeTurnControllerV1({
    repository,
    campaignId: DEFAULT_CAMPAIGN_ID,
    clock,
    intentInterpreterConfig: options.intentInterpreterConfig,
    mjPlannerConfig: options.mjPlannerConfig,
    npcPerformerConfig: options.npcPerformerConfig,
    npcInformationRuntime: options.npcInformationRuntimeFactory?.({ repository, campaignId: DEFAULT_CAMPAIGN_ID }) ?? null,
    sceneTransitionRuntime: options.sceneTransitionRuntime === undefined
      ? createPrototypeInnSceneTransitionRuntimeV1()
      : options.sceneTransitionRuntime,
    travelRuntime: options.travelRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    inventoryAccessRuntime: options.inventoryAccessRuntime,
    inventoryTransactionRuntime: options.inventoryTransactionRuntime,
    missionRelationRuntime: options.missionRelationRuntime,
    companionRecruitmentRuntime: options.companionRecruitmentRuntime,
    plotCreationRuntime: options.plotCreationRuntime,
    socialAccessRuntime: options.socialAccessRuntime,
    rulesAccessRuntime: options.rulesAccessRuntime,
    tacticalAccessRuntime: options.tacticalAccessRuntime,
    restRuntime: options.restRuntime,
    worldSceneLocationResolver: options.worldSceneLocationResolver,
    activeSceneResolver: options.activeSceneResolver === undefined
      ? { resolve: resolvePrototypeInnActiveSceneV1 }
      : options.activeSceneResolver,
    interpreterCharacterContextResolver:
      options.interpreterCharacterContextResolver,
    tacticalConsequenceAuthorities: options.tacticalConsequenceAuthorities,
    bastionTacticalRuntimeFactory: options.bastionTacticalRuntimeFactory
  });
}

export async function createBrowserPersistentNarrativeTurnControllerV1(options: {
  clock?: RepositoryClock;
  databaseName?: string;
  intentInterpreterConfig?: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig?: MjPlannerConfigV1 | null;
  npcPerformerConfig?: NpcPerformerConfigV1 | null;
  npcInformationRuntimeFactory?: (input: { repository: CampaignRepository; campaignId: CampaignId }) => NarrativeNpcInformationRuntimeV1;
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  travelRuntime?: NarrativeTravelRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  inventoryAccessRuntime?: NarrativeInventoryAccessRuntimeV1 | null;
  inventoryTransactionRuntime?: NarrativeInventoryTransactionRuntimeV1 | null;
  missionRelationRuntime?: NarrativeMissionRelationRuntimeV1 | null;
  companionRecruitmentRuntime?: NarrativeCompanionRecruitmentRuntimeV1 | null;
  plotCreationRuntime?: NarrativePlotCreationRuntimeV1 | null;
  socialAccessRuntime?: NarrativeSocialAccessRuntimeV1 | null;
  rulesAccessRuntime?: NarrativeRulesAccessRuntimeV1 | null;
  tacticalAccessRuntime?: NarrativeTacticalAccessRuntimeV1 | null;
  restRuntime?: NarrativeRestRuntimeV1 | null;
  worldSceneLocationResolver?: NarrativeWorldSceneLocationResolverV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
  interpreterCharacterContextResolver?:
    InterpreterCharacterContextResolverV1 | null;
  tacticalConsequenceAuthorities?: readonly TacticalConsequenceAuthorityV1[];
  bastionTacticalRuntimeFactory?: NarrativeBastionTacticalRuntimeFactoryV1;
  initialScene?: { scene: PlayableSceneStateV1; locationRef: string };
  initializeRepository?: (repository: CampaignRepository, campaignId: CampaignId, clock: RepositoryClock) => Promise<void>;
} = {}): Promise<NarrativeTurnControllerV1> {
  const clock = options.clock ?? systemClock;
  if (!globalThis.indexedDB) return createPrototypeNarrativeTurnControllerV1({
    clock,
    intentInterpreterConfig: options.intentInterpreterConfig,
    mjPlannerConfig: options.mjPlannerConfig,
    npcPerformerConfig: options.npcPerformerConfig,
    npcInformationRuntimeFactory: options.npcInformationRuntimeFactory,
    sceneTransitionRuntime: options.sceneTransitionRuntime,
    travelRuntime: options.travelRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    inventoryAccessRuntime: options.inventoryAccessRuntime,
    inventoryTransactionRuntime: options.inventoryTransactionRuntime,
    missionRelationRuntime: options.missionRelationRuntime,
    companionRecruitmentRuntime: options.companionRecruitmentRuntime,
    plotCreationRuntime: options.plotCreationRuntime,
    socialAccessRuntime: options.socialAccessRuntime,
    rulesAccessRuntime: options.rulesAccessRuntime,
    tacticalAccessRuntime: options.tacticalAccessRuntime,
    restRuntime: options.restRuntime,
    worldSceneLocationResolver: options.worldSceneLocationResolver,
    activeSceneResolver: options.activeSceneResolver,
    interpreterCharacterContextResolver:
      options.interpreterCharacterContextResolver,
    initialScene: options.initialScene,
    initializeRepository: options.initializeRepository,
    tacticalConsequenceAuthorities: options.tacticalConsequenceAuthorities,
    bastionTacticalRuntimeFactory: options.bastionTacticalRuntimeFactory
  });
  const repository = await IndexedDbCampaignRepository.open({
    clock,
    databaseName: options.databaseName ?? "jdr5e-narration-prototype"
  });
  await ensurePrototypeCampaign(repository, clock);
  await ensurePrototypeInnSceneTransitionStateV1(repository, DEFAULT_CAMPAIGN_ID, clock, options.initialScene);
  await options.initializeRepository?.(repository, DEFAULT_CAMPAIGN_ID, clock);
  return new NarrativeTurnControllerV1({
    repository,
    campaignId: DEFAULT_CAMPAIGN_ID,
    clock,
    intentInterpreterConfig: options.intentInterpreterConfig,
    mjPlannerConfig: options.mjPlannerConfig,
    npcPerformerConfig: options.npcPerformerConfig,
    npcInformationRuntime: options.npcInformationRuntimeFactory?.({ repository, campaignId: DEFAULT_CAMPAIGN_ID }) ?? null,
    sceneTransitionRuntime: options.sceneTransitionRuntime === undefined
      ? createPrototypeInnSceneTransitionRuntimeV1()
      : options.sceneTransitionRuntime,
    travelRuntime: options.travelRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    inventoryAccessRuntime: options.inventoryAccessRuntime,
    inventoryTransactionRuntime: options.inventoryTransactionRuntime,
    missionRelationRuntime: options.missionRelationRuntime,
    companionRecruitmentRuntime: options.companionRecruitmentRuntime,
    plotCreationRuntime: options.plotCreationRuntime,
    socialAccessRuntime: options.socialAccessRuntime,
    rulesAccessRuntime: options.rulesAccessRuntime,
    tacticalAccessRuntime: options.tacticalAccessRuntime,
    restRuntime: options.restRuntime,
    worldSceneLocationResolver: options.worldSceneLocationResolver,
    activeSceneResolver: options.activeSceneResolver === undefined
      ? { resolve: resolvePrototypeInnActiveSceneV1 }
      : options.activeSceneResolver,
    interpreterCharacterContextResolver:
      options.interpreterCharacterContextResolver,
    tacticalConsequenceAuthorities: options.tacticalConsequenceAuthorities,
    bastionTacticalRuntimeFactory: options.bastionTacticalRuntimeFactory
  });
}

async function ensurePrototypeCampaign(
  repository: CampaignRepository,
  clock: RepositoryClock
): Promise<void> {
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId: DEFAULT_CAMPAIGN_ID,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: DEFAULT_CLOCK_ID,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const initialClock: CampaignClockPayload = {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  };
  const created = await repository.createCampaign(campaign, initialClock);
  if (!created.ok) {
    const existing = await repository.getCampaign(campaign.campaignId);
    if (!existing.ok) {
      throw new Error(`Failed to create prototype narrative campaign: ${created.error.messageKey}`);
    }
  }
}

export function buildNoCommitOutput(
  operation: OperationRecord,
  input: NarrativeTurnInputV1,
  createdAt = new Date().toISOString()
): NarrativeTurnControllerOutputV1 {
  const interpretation = interpretNarrativeInputV1({
    intentId: `${operation.operationId}:intent:1`,
    rawInput: input.rawInput
  }) as NarrativeIntentInterpretationV1 & JsonObject;
  const suspendedIntent = interpretation.requiresClarification
    ? createSuspendedIntentRecordV1({
      suspendedIntentId: `${operation.operationId}:suspended:1`,
      operationId: operation.operationId,
      rawInput: input.rawInput,
      interpretation,
      createdAt
    }) as SuspendedIntentRecordV1 & JsonObject
    : null;
  const responseBlock = buildResponseBlock(operation.operationId, interpretation, suspendedIntent);
  const displayPacket: DisplayPacketV1 & JsonObject = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: operation.operationId,
    sceneId: "prototype-narration-surface",
    displayBlocks: [
      {
        blockId: `${operation.operationId}:raw`,
        kind: "RAW_INPUT",
        speaker: {
          speakerId: "speaker-player",
          kind: "PLAYER_CHARACTER",
          displayName: "Joueur",
          roleLabel: "Entrée joueur",
          ariaLabel: "Entrée libre du joueur",
          visualToken: "speaker-player"
        },
        text: input.rawInput,
        ariaLabel: "Entrée libre du joueur: RAW_INPUT",
        roleLabel: "Entrée joueur",
        visualStyleToken: "speaker-player",
        sourceRefs: [`operation:${operation.operationId}:raw`],
        isDegradedFallback: false
      },
      {
        blockId: `${operation.operationId}:notice`,
        kind: responseBlock.kind,
        speaker: {
          speakerId: "speaker-system",
          kind: "SYSTEM",
          displayName: "Système",
          roleLabel: "Notification système",
          ariaLabel: "Notification système",
          visualToken: "speaker-system"
        },
        text: responseBlock.text,
        ariaLabel: responseBlock.ariaLabel,
        roleLabel: "Notification système",
        visualStyleToken: "speaker-system",
        sourceRefs: [`operation:${operation.operationId}:raw`],
        isDegradedFallback: false
      }
    ],
    rawInputAccess: {
      available: true,
      operationId: operation.operationId
    },
    rhythmDiagnostics: "no-commit-prototype",
    reconstructionRefs: [`operation:${operation.operationId}:raw`],
    version: 1
  };

  return {
    schemaVersion: 1,
    contractVersion: "narrative-turn-controller/1",
    operationId: operation.operationId,
    clientRequestId: input.clientRequestId,
    noCommit: true,
    noGameTime: true,
    interpretation,
    domainCommand: buildNarrativeDomainCommandV1(interpretation),
    mjPlan: null,
    mjPlannerFailure: null,
    npcPerformance: null,
    npcPerformanceFailure: null,
    suspendedIntent,
    pendingSkillCheck: null,
    resolution: {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${operation.operationId}:legacy-resolution:1`,
      operationId: operation.operationId,
      resultKind: "NO_COMMIT_RESPONSE",
      interpretation,
      domainCommand: buildNarrativeDomainCommandV1(interpretation),
      characterExpression: null,
      preparedEffects: [],
      handoff: null,
      commitId: null,
      noGameTime: true,
      safetyNotes: ["Sortie legacy conservée pour compatibilité de test."],
      actionAdjudication: null,
      perception: null
    },
    sceneState: createInitialReferenceSceneStateV1(),
    sceneArrival: null,
    activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    displayPacket,
    stageTimings: null,
    aiTelemetry: []
  };
}

function applyPostTurnRelationPresentationV1(
  output: NarrativeTurnControllerOutputV1,
  postTurn: {
    missionResult: MissionRelationEngagementResultV1 | null;
    companionResult: CompanionPartyMutationResultV1 | null;
  }
): NarrativeTurnControllerOutputV1 {
  let displayPacket = output.displayPacket;
  const mission = postTurn.missionResult;
  if (mission !== null) {
    let replacedSpeech = false;
    const refs = [
      `mission-relation:${mission.engagement.engagementId}`,
      `commit:${mission.commitId}`
    ];
    displayPacket = {
      ...displayPacket,
      displayBlocks: displayPacket.displayBlocks.map(block => {
        if (replacedSpeech || block.kind !== "NPC_SPEECH") return block;
        replacedSpeech = true;
        return {
          ...block,
          text: missionDecisionFallbackV1({
            disposition: mission.engagement.status,
            conditions: mission.engagement.resolution?.conditions ?? []
          }, block.text),
          sourceRefs: [...new Set([...block.sourceRefs, ...refs])],
          isDegradedFallback: true
        };
      }),
      reconstructionRefs: [...new Set([
        ...displayPacket.reconstructionRefs,
        ...refs
      ])]
    } as DisplayPacketV1 & JsonObject;
  }
  const member = postTurn.companionResult?.member ?? null;
  if (member !== null) {
    const template = displayPacket.displayBlocks.find(
      block => block.kind === "GM_NARRATION"
    ) ?? displayPacket.displayBlocks[0];
    if (template !== undefined) {
      const refs = [
        `companion:${member.campaignNpcId}`,
        `mission-relation:${member.recruitmentEngagementId}`,
        `commit:${postTurn.companionResult!.commitId}`
      ];
      displayPacket = {
        ...displayPacket,
        displayBlocks: [...displayPacket.displayBlocks, {
          ...template,
          blockId: `${output.operationId}:companion-recruited`,
          kind: "GM_NARRATION",
          text: "Le PNJ accepte de rejoindre le groupe. Il reste autonome et agira selon ses propres limites.",
          sourceRefs: refs,
          isDegradedFallback: false
        }],
        reconstructionRefs: [...new Set([
          ...displayPacket.reconstructionRefs,
          ...refs
        ])]
      } as DisplayPacketV1 & JsonObject;
    }
  }
  return { ...output, displayPacket };
}

function applyTravelPresentationV1(
  output: NarrativeTurnControllerOutputV1,
  presentation: NarrativeTravelPresentationV1
): NarrativeTurnControllerOutputV1 {
  const template = output.displayPacket.displayBlocks.find(
    block => block.kind === "GM_NARRATION"
  ) ?? output.displayPacket.displayBlocks[0];
  if (template === undefined) return output;
  const displayPacket = {
    ...output.displayPacket,
    displayBlocks: [
      ...output.displayPacket.displayBlocks,
      {
        ...template,
        blockId: `${output.operationId}:travel:${presentation.kind.toLowerCase()}`,
        kind: "GM_NARRATION" as const,
        text: presentation.playerFacingText,
        ariaLabel: "Suite narrative du voyage",
        roleLabel: "Maitre du jeu",
        visualStyleToken: "speaker-gm",
        sourceRefs: presentation.sourceRefs,
        isDegradedFallback: false
      }
    ],
    reconstructionRefs: [...new Set([
      ...output.displayPacket.reconstructionRefs,
      ...presentation.sourceRefs
    ])]
  } as DisplayPacketV1 & JsonObject;
  return {
    ...output,
    noCommit: false,
    noGameTime: ["DEPARTURE", "INTERRUPTION_RESOLVED"]
      .includes(presentation.kind),
    displayPacket
  };
}

function isTravelPresentationV1(
  value: unknown
): value is NarrativeTravelPresentationV1 {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<NarrativeTravelPresentationV1>;
  return candidate.schemaVersion === 1
    && [
      "DEPARTURE",
      "PROGRESS",
      "INTERRUPTION",
      "INTERRUPTION_RESOLVED",
      "ARRIVAL"
    ].includes(String(candidate.kind ?? ""))
    && typeof candidate.playerFacingText === "string"
    && Array.isArray(candidate.sourceRefs);
}

async function buildResolvedOutput(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  input: NarrativeTurnInputV1;
  createdAt: string;
  intentInterpreterConfig: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig: MjPlannerConfigV1 | null;
  npcPerformerConfig: NpcPerformerConfigV1 | null;
  npcInformationRuntime: NarrativeNpcInformationRuntimeV1 | null;
  localReferentHints?: LocalReferentHintV1[];
  recentSemanticTurns?: RecentSemanticTurnV1[];
  localInteractionFocus?: LocalInteractionFocusV1 | null;
  interpreterCharacterContextResolver:
    InterpreterCharacterContextResolverV1 | null;
  sceneTransitionRuntime: NarrativeSceneTransitionRuntimeV1 | null;
  travelRuntime: NarrativeTravelRuntimeV1 | null;
  dynamicPlaceRuntime: NarrativeDynamicPlaceRuntimeV1 | null;
  inventoryAccessRuntime: NarrativeInventoryAccessRuntimeV1 | null;
  inventoryTransactionRuntime: NarrativeInventoryTransactionRuntimeV1 | null;
  missionRelationRuntime: NarrativeMissionRelationRuntimeV1 | null;
  companionRecruitmentRuntime: NarrativeCompanionRecruitmentRuntimeV1 | null;
  plotCreationRuntime: NarrativePlotCreationRuntimeV1 | null;
  socialAccessRuntime: NarrativeSocialAccessRuntimeV1 | null;
  rulesAccessRuntime: NarrativeRulesAccessRuntimeV1 | null;
  tacticalAccessRuntime: NarrativeTacticalAccessRuntimeV1 | null;
  restRuntime: NarrativeRestRuntimeV1 | null;
  activeScene: PlayableSceneStateV1;
}): Promise<Result<{
  output: NarrativeTurnControllerOutputV1;
  commit: unknown | null;
  companionRecruitmentMission?: MissionRelationEngagementResultV1 | null;
}>> {
  const resolvedOutputStartedAt = Date.now();
  const intentId = `${input.operation.operationId}:intent:1`;
  const interpretationStartedAt = Date.now();
  const characterContextResult =
    input.intentInterpreterConfig === null
    || input.interpreterCharacterContextResolver === null
      ? { ok: true as const, value: null }
      : await input.interpreterCharacterContextResolver.resolve({
          repository: input.repository,
          campaignId: input.campaignId
        });
  if (!characterContextResult.ok) return characterContextResult;
  const playerPublicContextResult = characterContextResult.value === null
    ? { ok: true as const, value: null }
    : await loadPlayerPublicContextV1({
        repository: input.repository,
        campaignId: input.campaignId,
        activeScene: input.activeScene,
        characterContext: characterContextResult.value
      });
  if (!playerPublicContextResult.ok) return playerPublicContextResult;
  const companionPartyResult = await loadCompanionPartyRegistryV1({
    repository: input.repository,
    campaignId: input.campaignId
  });
  if (!companionPartyResult.ok) return companionPartyResult;
  const activeCompanionRefs = companionPartyResult.value.state?.members
    .filter(member => member.status === "ACTIVE" && member.currentSceneId === input.activeScene.sceneId)
    .map(member => `npc:${member.actorId}`) ?? [];
  const activeTravelResult = input.travelRuntime === null
    ? { ok: true as const, value: null }
    : await input.travelRuntime.restoreActive({
        repository: input.repository,
        campaignId: input.campaignId
      });
  if (!activeTravelResult.ok) return activeTravelResult;
  const activeTravelContext = activeTravelResult.value === null
    ? null
    : {
        status: activeTravelResult.value.status as
          "PLANNED" | "ACTIVE" | "INTERRUPTED",
        destinationLocationId:
          activeTravelResult.value.plan.destinationLocationId,
        awaitingPlayerDecision:
          activeTravelResult.value.status === "INTERRUPTED"
      };
  const interpretationResult = input.intentInterpreterConfig === null
    ? buildUnavailableAiIntentInterpretationV1({
        intentId,
        rawInput: input.input.rawInput
      })
    : await interpretNarrativeInputWithAiV1({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      intentId,
      rawInput: input.input.rawInput,
      config: input.intentInterpreterConfig,
      localReferentHints: input.localReferentHints ?? [],
      recentSemanticTurns: input.recentSemanticTurns ?? [],
      localInteractionFocus: input.localInteractionFocus ?? null,
      runtimeContext: buildInterpreterRuntimeContextV1({
        sceneTransition: input.sceneTransitionRuntime !== null,
        dynamicPlace: input.dynamicPlaceRuntime !== null,
        rest: input.restRuntime !== null,
        inventoryAccess: input.inventoryAccessRuntime !== null,
        inventoryMutation: input.inventoryTransactionRuntime !== null,
        tacticalAccess: input.tacticalAccessRuntime !== null,
        travel: input.travelRuntime !== null,
        companionRequests: input.companionRecruitmentRuntime !== null,
        activeTravel: activeTravelContext
      }),
      characterContext: characterContextResult.value,
      playerPublicContext: playerPublicContextResult.value,
      playableScene: input.activeScene,
      activeCompanionRefs
    });
  const interpretation = interpretationResult.interpretation as
    NarrativeIntentInterpretationV1 & JsonObject;
  const openSemanticOwnerAdapter =
    buildOpenSemanticLegacyOwnerAdapterProjectionV1(interpretation);
  const ownerInterpretation = openSemanticOwnerAdapter?.interpretation
    ?? interpretation;
  const ownerInputText = openSemanticOwnerAdapter?.semanticInputText
    ?? input.input.rawInput;
  const legacyOwnerInvocationAllowed = interpretation.semanticSource !== "OPEN_SEMANTIC_FRAME_V8"
    || openSemanticOwnerAdapter !== null;
  const interpretationMs = Date.now() - interpretationStartedAt;
  if (isAiInterpretationFailureDiagnosticV1(interpretation)) {
    const suspendedIntent = createSuspendedIntentRecordV1({
      suspendedIntentId: `${input.operation.operationId}:suspended:interpreter`,
      operationId: input.operation.operationId,
      rawInput: input.input.rawInput,
      interpretation,
      createdAt: input.createdAt,
      missingField: "meaning",
      question: interpretation.clarificationQuestion
        ?? "Peux-tu reformuler ton intention ?"
    }) as SuspendedIntentRecordV1 & JsonObject;
    const resolutionStartedAt = Date.now();
    const resolution = await resolveNarrativeTurnV1({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: input.input.rawInput,
      interpretation,
      domainCommand: null,
      suspendedIntent,
      playableScene: input.activeScene,
      playerPublicContext: playerPublicContextResult.value
    });
    if (!resolution.ok) return resolution;
    return {
      ok: true,
      value: {
        commit: null,
        output: {
          schemaVersion: 1,
          contractVersion: "narrative-turn-controller/1",
          operationId: input.operation.operationId,
          clientRequestId: input.input.clientRequestId,
          noCommit: true,
          noGameTime: true,
          interpretation,
          domainCommand: null,
          mjPlan: null,
          mjPlannerFailure: null,
          npcPerformance: null,
          npcPerformanceFailure: null,
          suspendedIntent,
          pendingSkillCheck: null,
          resolution: resolution.value.result,
          sceneState: resolution.value.sceneState,
          sceneArrival: null,
          activeScene: resolution.value.playableScene,
          displayPacket: resolution.value.displayPacket,
          stageTimings: {
            interpretationMs,
            planningMs: 0,
            resolutionMs: Date.now() - resolutionStartedAt,
            npcPerformanceMs: 0,
            resolvedOutputMs: Date.now() - resolvedOutputStartedAt
          },
          aiTelemetry: interpretationResult.telemetry
        }
      }
    };
  }
  const domainCommand = openSemanticOwnerAdapter?.domainCommand
    ?? buildNarrativeDomainCommandV1(interpretation);
  const dynamicPlaceCanHandle = legacyOwnerInvocationAllowed && input.dynamicPlaceRuntime !== null && await input.dynamicPlaceRuntime.canHandle({
    repository: input.repository,
    campaignId: input.campaignId,
    interpretation: ownerInterpretation,
    domainCommand,
    activeScene: input.activeScene
  });
  const travelCanHandle = legacyOwnerInvocationAllowed && input.travelRuntime !== null
    && await input.travelRuntime.canHandle({
      repository: input.repository,
      campaignId: input.campaignId,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene
    });
  const inventoryAccessCanHandle = legacyOwnerInvocationAllowed && input.inventoryAccessRuntime !== null && (
    input.inventoryAccessRuntime.canHandle === undefined
      ? ownerInterpretation.runtimeDecision.requiredDomain === "inventory"
      : await input.inventoryAccessRuntime.canHandle({
          repository: input.repository,
          campaignId: input.campaignId,
          rawInput: ownerInputText,
          interpretation: ownerInterpretation,
          domainCommand,
          activeScene: input.activeScene
        })
  );
  const inventoryTransactionCanHandle = legacyOwnerInvocationAllowed && input.inventoryTransactionRuntime !== null &&
    await input.inventoryTransactionRuntime.canHandle({
      repository: input.repository,
      campaignId: input.campaignId,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene
    });
  const socialAccessCanHandle = legacyOwnerInvocationAllowed && input.socialAccessRuntime !== null && (
    input.socialAccessRuntime.canHandle === undefined
      ? ownerInterpretation.runtimeDecision.requiredDomain === "social"
      : await input.socialAccessRuntime.canHandle({
          repository: input.repository,
          campaignId: input.campaignId,
          rawInput: ownerInputText,
          interpretation: ownerInterpretation,
          domainCommand,
          activeScene: input.activeScene
        })
  );
  const rulesAccessCanHandle = legacyOwnerInvocationAllowed && input.rulesAccessRuntime !== null && (
    input.rulesAccessRuntime.canHandle === undefined
      ? ownerInterpretation.runtimeDecision.requiredDomain === "rules"
      : await input.rulesAccessRuntime.canHandle({
          repository: input.repository,
          campaignId: input.campaignId,
          rawInput: ownerInputText,
          interpretation: ownerInterpretation,
          domainCommand,
          activeScene: input.activeScene
        })
  );
  const tacticalAccessCanHandle = legacyOwnerInvocationAllowed && input.tacticalAccessRuntime !== null && (
    input.tacticalAccessRuntime.canHandle === undefined
      ? ownerInterpretation.runtimeDecision.requiredDomain === "tactical"
      : await input.tacticalAccessRuntime.canHandle({
          repository: input.repository,
          campaignId: input.campaignId,
          rawInput: ownerInputText,
          interpretation: ownerInterpretation,
          domainCommand,
          activeScene: input.activeScene
        })
  );
  const planningCompanionDirective = ownerInterpretation.semanticIntent.companionDirective ?? null;
  const planningCompanionTargetRef = ownerInterpretation.semanticIntent.target?.ref ?? null;
  const companionOwnerCanHandle = planningCompanionDirective !== null && (
    (
      planningCompanionDirective.category === "FOLLOW"
      && input.companionRecruitmentRuntime !== null
    )
    || (
      planningCompanionTargetRef !== null
      && activeCompanionRefs.some(actorRef => actorRef === planningCompanionTargetRef)
    )
  );
  const planningStartedAt = Date.now();
  // V8 contient déjà son plan d'exécution G5. Le rejouer dans mj_planner
  // consommerait un rôle sans autorité et empêcherait, sur les dialogues, le
  // couple performer + critique de rester sous trois appels distants.
  const planning = input.mjPlannerConfig === null || !shouldUseMjPlannerForNarrativeTurnV1(interpretation) || dynamicPlaceCanHandle || travelCanHandle || inventoryAccessCanHandle || inventoryTransactionCanHandle || socialAccessCanHandle || rulesAccessCanHandle || tacticalAccessCanHandle || companionOwnerCanHandle
    ? null
    : await planNarrativeTurnWithMjV1({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene,
      config: input.mjPlannerConfig
    });
  const planningMs = Date.now() - planningStartedAt;
  const suspendedIntent = interpretation.requiresClarification
    ? createSuspendedIntentRecordV1({
      suspendedIntentId: `${input.operation.operationId}:suspended:1`,
      operationId: input.operation.operationId,
      rawInput: input.input.rawInput,
      interpretation,
      createdAt: input.createdAt
    }) as SuspendedIntentRecordV1 & JsonObject
    : null;
  const resolutionStartedAt = Date.now();
  const runtimeRoute = routeNarrativeSemanticIntentV2({
    semanticIntent: ownerInterpretation.semanticIntent,
    runtimeSuggestion: ownerInterpretation.runtimeHandling ?? null,
    availability: {
      rest: input.restRuntime !== null,
      inventoryMutation: input.inventoryTransactionRuntime !== null
    }
  });
  const companionDirective = ownerInterpretation.semanticIntent.companionDirective ?? null;
  const targetActorId = normalizeCompanionTargetActorIdV1(
    ownerInterpretation.semanticIntent.target?.ref ?? null
  );
  const activeCompanion = companionDirective === null || targetActorId === null
    ? null
    : companionPartyResult.value.state?.members.find(member =>
      (
        member.status === "ACTIVE"
        || (
          member.status === "SEPARATED"
          && companionDirective.presenceIntent === "REJOIN"
        )
      )
      && member.currentSceneId === input.activeScene.sceneId
      && member.actorId === targetActorId
    ) ?? null;
  if (
    companionDirective !== null
    && activeCompanion !== null
    && ownerInterpretation.semanticIntent.dialogueAct?.act === "REQUEST_ACTION"
    && ["committed", "conditional"].includes(ownerInterpretation.semanticIntent.commitment)
  ) {
    const campaign = await input.repository.getCampaign(input.campaignId);
    if (!campaign.ok) return campaign;
    const clock = await input.repository.getAggregate(
      input.campaignId,
      "world.clock",
      campaign.value.clockAggregateId
    );
    if (!clock.ok) return clock;
    const decided = await decideCompanionDirectiveInNarrativeTurnV1({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      command: {
        schemaVersion: 1,
        clientRequestId: input.input.clientRequestId,
        directiveId: `${input.operation.operationId}:companion-directive`,
        campaignNpcId: activeCompanion.campaignNpcId,
        category: companionDirective.category,
        requestSummary: companionDirective.requestSummary,
        presenceAction: companionDirective.presenceIntent === undefined
          || companionDirective.presenceIntent === "UNCHANGED"
          ? null
          : companionDirective.presenceIntent,
        occurredAtGameSecond: Number(
          (clock.value.payload as CampaignClockPayload).elapsedGameSeconds ?? 0
        )
      }
    });
    if (!decided.ok) return decided;
    const directive = decided.value.directive;
    if (directive === null) {
      return {
        ok: false,
        error: coreError("PERSISTENCE_FAILURE", "companion.directive-result-missing")
      };
    }
    const actor = [...input.activeScene.presentNpc, ...input.activeScene.ambientPopulation]
      .find(candidate => candidate.actorId === activeCompanion.actorId);
    const companionName = actor?.displayName ?? "Ton compagnon";
    const presenceAction = companionDirective.presenceIntent === undefined
      || companionDirective.presenceIntent === "UNCHANGED"
      ? null
      : companionDirective.presenceIntent;
    const presenceChanged = presenceAction !== null
      && ["ACCEPTED", "ADAPTED"].includes(directive.disposition)
      && decided.value.member !== null
      && (
        (presenceAction === "SEPARATE" && decided.value.member.status === "SEPARATED")
        || (presenceAction === "REJOIN" && decided.value.member.status === "ACTIVE")
        || (presenceAction === "LEAVE" && decided.value.member.status === "LEFT")
      );
    const committedDecision = decided.value;
    const sourceRefs = [...new Set([
      `commit:${committedDecision.commitId}`,
      `companion:${activeCompanion.campaignNpcId}`,
      ...directive.sourceRefs
    ])];
    const resolution: NarrativeResolutionResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${input.operation.operationId}:resolution:companion-directive`,
      operationId: input.operation.operationId,
      resultKind: "COMMIT_APPLIED",
      interpretation,
      domainCommand,
      characterExpression: {
        schemaVersion: 1,
        rawPlayerText: input.input.rawInput,
        interpretedIntentId: interpretation.intentId,
        expressionText: input.input.rawInput.trim(),
        fidelity: "RAW_EQUIVALENT",
        addedCommitments: [],
        preservedMeaning: true
      },
      preparedEffects: [],
      handoff: null,
      commitId: committedDecision.commitId,
      noGameTime: true,
      safetyNotes: [
        "Le compagnon décide selon sa politique d'autonomie persistée; aucune réussite d'action n'est appliquée par cette réponse."
      ],
      actionAdjudication: null,
      perception: null
    };
    const companionSceneState = createInitialReferenceSceneStateV1();
    const companionPerformance = input.npcPerformerConfig === null
      ? null
      : await performNpcTurnV1({
          repository: input.repository,
          campaignId: input.campaignId,
          operationId: input.operation.operationId,
          rawInput: input.input.rawInput,
          interpretation,
          mjPlan: null,
          resolution,
          sceneState: companionSceneState,
          activeScene: input.activeScene,
          config: input.npcPerformerConfig,
          assignedActorId: `npc:${activeCompanion.actorId}`,
          ownerCompanionDecision: { companionName, directive }
        });
    const fallbackDisplayPacket: DisplayPacketV1 & JsonObject = {
      schemaVersion: 1,
      contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
      operationId: input.operation.operationId,
      sceneId: input.activeScene.sceneId,
      displayBlocks: [{
        blockId: `${input.operation.operationId}:raw`,
        kind: "RAW_INPUT",
        speaker: { speakerId: "speaker-player", kind: "PLAYER_CHARACTER", displayName: "Joueur", roleLabel: "Entrée joueur", ariaLabel: "Entrée libre du joueur", visualToken: "speaker-player" },
        text: input.input.rawInput,
        ariaLabel: "Entrée originale du joueur",
        roleLabel: "Entrée joueur",
        visualStyleToken: "speaker-player",
        sourceRefs: [`operation:${input.operation.operationId}:raw`],
        isDegradedFallback: false
      }, {
        blockId: `${input.operation.operationId}:companion-response`,
        kind: "NPC_SPEECH",
        speaker: { speakerId: `npc:${activeCompanion.actorId}`, kind: "NPC", displayName: companionName, roleLabel: "Compagnon", ariaLabel: companionName, visualToken: "speaker-npc" },
        text: presenceAction !== null && presenceChanged
          ? companionPresenceNarrationV1({ companionName, action: presenceAction })
          : companionDirectiveNarrationV1({ companionName, directive }),
        ariaLabel: `Réponse de ${companionName}`,
        roleLabel: "Réponse du compagnon",
        visualStyleToken: "speaker-npc",
        sourceRefs,
        isDegradedFallback: false
      }],
      rawInputAccess: { available: true, operationId: input.operation.operationId },
      rhythmDiagnostics: "companion-directive:resolved",
      reconstructionRefs: sourceRefs,
      version: 1
    };
    const displayPacket = applyNpcPerformanceToDisplayPacketV1({
      displayPacket: fallbackDisplayPacket,
      performance: companionPerformance?.performance ?? companionPerformance?.fallbackPerformance ?? null,
      performanceFailure: companionPerformance?.performanceFailure as (NpcPerformanceFailureV1 & JsonObject) | null ?? null,
      activeScene: input.activeScene
    });
    return { ok: true, value: { commit: committedDecision, output: {
      schemaVersion: 1,
      contractVersion: "narrative-turn-controller/1",
      operationId: input.operation.operationId,
      clientRequestId: input.input.clientRequestId,
      noCommit: false,
      noGameTime: true,
      interpretation,
      domainCommand,
      mjPlan: planning?.plan ?? null,
      mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
      npcPerformance: companionPerformance?.performance ?? null,
      npcPerformanceFailure: companionPerformance?.performanceFailure as (NpcPerformanceFailureV1 & JsonObject) | null ?? null,
      suspendedIntent: null,
      pendingSkillCheck: null,
      resolution,
      sceneState: companionSceneState,
      sceneArrival: null,
      activeScene: input.activeScene,
      displayPacket,
      stageTimings: {
        interpretationMs,
        planningMs,
        resolutionMs: Date.now() - resolutionStartedAt,
        npcPerformanceMs: 0,
        resolvedOutputMs: Date.now() - resolvedOutputStartedAt
      },
      aiTelemetry: [
        ...(interpretationResult?.telemetry ?? []),
        ...(planning?.telemetry ?? []),
        ...(companionPerformance?.telemetry ?? [])
      ]
    } } };
  }
  if (runtimeRoute.capabilityId === "rest.process" && input.restRuntime !== null) {
    const restResult = await input.restRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene,
      createdAt: input.createdAt,
      aiTelemetry: [
        ...(interpretationResult?.telemetry ?? []),
        ...(planning?.telemetry ?? [])
      ]
    });
    if (!restResult.ok || openSemanticOwnerAdapter === null) return restResult;
    return {
      ok: true,
      value: {
        ...restResult.value,
        output: {
          ...restResult.value.output,
          interpretation,
          resolution: {
            ...restResult.value.output.resolution,
            interpretation
          }
        }
      }
    };
  }
  if (
    input.tacticalAccessRuntime !== null
    && tacticalAccessCanHandle
    && ownerInterpretation.semanticIntent.commitment === "committed"
  ) {
    const tactical = await input.tacticalAccessRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene
    });
    if (!tactical.ok) return tactical;
    const resolution: NarrativeResolutionResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${input.operation.operationId}:resolution:tactical-access`,
      operationId: input.operation.operationId,
      resultKind: "COMMIT_APPLIED",
      interpretation,
      domainCommand,
      characterExpression: {
        schemaVersion: 1,
        rawPlayerText: input.input.rawInput,
        interpretedIntentId: interpretation.intentId,
        expressionText: tactical.value.characterExpression,
        fidelity: "RAW_EQUIVALENT",
        addedCommitments: [],
        preservedMeaning: true
      },
      preparedEffects: [],
      handoff: null,
      commitId: tactical.value.commit.commitId,
      noGameTime: true,
      safetyNotes: [
        "Le conflit est seulement amorce ici ; seul le resultat terminal valide du plateau peut modifier l'acces."
      ],
      actionAdjudication: null,
      perception: null
    };
    const sourceRefs = [...new Set([
      `commit:${tactical.value.commit.commitId}`,
      ...tactical.value.sourceRefs
    ])];
    const displayPacket: DisplayPacketV1 & JsonObject = {
      schemaVersion: 1,
      contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
      operationId: input.operation.operationId,
      sceneId: input.activeScene.sceneId,
      displayBlocks: [{
        blockId: `${input.operation.operationId}:tactical-access`,
        kind: "SYSTEM_NOTICE",
        speaker: {
          speakerId: "speaker-system",
          kind: "SYSTEM",
          displayName: "Systeme",
          roleLabel: "Handoff tactique",
          ariaLabel: "Handoff tactique",
          visualToken: "speaker-system"
        },
        text: tactical.value.playerFacingText,
        ariaLabel: "Affrontement tactique requis pour resoudre l'acces",
        roleLabel: "Acces tactique",
        visualStyleToken: "speaker-system",
        sourceRefs,
        isDegradedFallback: false
      }],
      rawInputAccess: {
        available: true,
        operationId: input.operation.operationId
      },
      rhythmDiagnostics: `tactical-access:${tactical.value.process.processId}`,
      reconstructionRefs: sourceRefs,
      version: 1
    };
    return {
      ok: true,
      value: {
        commit: tactical.value.commit,
        output: {
          schemaVersion: 1,
          contractVersion: "narrative-turn-controller/1",
          operationId: input.operation.operationId,
          clientRequestId: input.input.clientRequestId,
          noCommit: false,
          noGameTime: true,
          interpretation,
          domainCommand,
          mjPlan: planning?.plan ?? null,
          mjPlannerFailure: planning?.planningFailure as
            (MjPlanningFailureV1 & JsonObject) | null ?? null,
          npcPerformance: null,
          npcPerformanceFailure: null,
          suspendedIntent: null,
          pendingSkillCheck: null,
          resolution,
          sceneState: createInitialReferenceSceneStateV1(),
          sceneArrival: null,
          activeScene: input.activeScene,
          displayPacket,
          stageTimings: {
            interpretationMs,
            planningMs,
            resolutionMs: Date.now() - resolutionStartedAt,
            npcPerformanceMs: 0,
            resolvedOutputMs: Date.now() - resolvedOutputStartedAt
          },
          aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(planning?.telemetry ?? [])]
        }
      }
    };
  }
  if (
    input.rulesAccessRuntime !== null && rulesAccessCanHandle &&
    ownerInterpretation.semanticIntent.commitment === "committed"
  ) {
    const rules = await input.rulesAccessRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene
    });
    if (!rules.ok) return rules;
    const resolution: NarrativeResolutionResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${input.operation.operationId}:resolution:rules-access`,
      operationId: input.operation.operationId,
      resultKind: "COMMIT_APPLIED",
      interpretation,
      domainCommand,
      characterExpression: { schemaVersion: 1, rawPlayerText: input.input.rawInput, interpretedIntentId: interpretation.intentId, expressionText: rules.value.characterExpression, fidelity: "RAW_EQUIVALENT", addedCommitments: [], preservedMeaning: true },
      preparedEffects: [],
      handoff: null,
      commitId: rules.value.commit.commitId,
      noGameTime: true,
      safetyNotes: ["La tentative mécanique est persistée ; seul RULES_ACCESS_DOMAIN peut appliquer le résultat du jet."],
      actionAdjudication: null,
      perception: null
    };
    const sourceRefs = [...new Set([`commit:${rules.value.commit.commitId}`, ...rules.value.sourceRefs])];
    const displayPacket: DisplayPacketV1 & JsonObject = {
      schemaVersion: 1,
      contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
      operationId: input.operation.operationId,
      sceneId: input.activeScene.sceneId,
      displayBlocks: [{
        blockId: `${input.operation.operationId}:rules-access`,
        kind: "SYSTEM_NOTICE",
        speaker: { speakerId: "speaker-system", kind: "SYSTEM", displayName: "Système", roleLabel: "Règles et accès", ariaLabel: "Règles et accès", visualToken: "speaker-system" },
        text: rules.value.playerFacingText,
        ariaLabel: "Tentative mécanique d'accès en attente de test",
        roleLabel: "Règles et accès",
        visualStyleToken: "speaker-system",
        sourceRefs,
        isDegradedFallback: false
      }],
      rawInputAccess: { available: true, operationId: input.operation.operationId },
      rhythmDiagnostics: `rules-access:${rules.value.resolution.method}:check-required`,
      reconstructionRefs: sourceRefs,
      version: 1
    };
    const policy = rules.value.resolution.checkPolicy;
    return { ok: true, value: { commit: rules.value.commit, output: {
      schemaVersion: 1,
      contractVersion: "narrative-turn-controller/1",
      operationId: input.operation.operationId,
      clientRequestId: input.input.clientRequestId,
      noCommit: false,
      noGameTime: true,
      interpretation,
      domainCommand,
      mjPlan: planning?.plan ?? null,
      mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
      npcPerformance: null,
      npcPerformanceFailure: null,
      suspendedIntent: null,
      pendingSkillCheck: {
        schemaVersion: 1,
        contractVersion: "pending-narrative-skill-check/1",
        pendingCheckId: `${policy.proposal.checkId}:pending`,
        sourceOperationId: input.operation.operationId,
        sceneId: input.activeScene.sceneId,
        status: "AWAITING_SKILL_ROLL",
        proposal: policy.proposal,
        ownerContext: {
          owner: "RULES_ACCESS",
          resolutionRef: rules.value.resolution.resolutionRef,
          accessControlRef: rules.value.resolution.accessControlRef,
          actorRef: rules.value.resolution.actorRef,
          deviceRef: rules.value.resolution.deviceRef,
          checkPolicy: policy
        },
        createdAt: input.createdAt,
        commitAuthority: false
      },
      resolution,
      sceneState: createInitialReferenceSceneStateV1(),
      sceneArrival: null,
      activeScene: input.activeScene,
      displayPacket,
      stageTimings: { interpretationMs, planningMs, resolutionMs: Date.now() - resolutionStartedAt, npcPerformanceMs: 0, resolvedOutputMs: Date.now() - resolvedOutputStartedAt },
      aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(planning?.telemetry ?? [])]
    } } };
  }
  if (
    input.socialAccessRuntime !== null && socialAccessCanHandle &&
    ownerInterpretation.semanticIntent.commitment === "committed"
  ) {
    const social = await input.socialAccessRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene
    });
    if (!social.ok) return social;
    const socialResolution: NarrativeResolutionResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${input.operation.operationId}:resolution:social-access`,
      operationId: input.operation.operationId,
      resultKind: "COMMIT_APPLIED",
      interpretation,
      domainCommand,
      characterExpression: { schemaVersion: 1, rawPlayerText: input.input.rawInput, interpretedIntentId: interpretation.intentId, expressionText: social.value.characterExpression, fidelity: "RAW_EQUIVALENT", addedCommitments: [], preservedMeaning: true },
      preparedEffects: [],
      handoff: null,
      commitId: social.value.commit.commitId,
      noGameTime: true,
      safetyNotes: ["La parole est conservée comme tentative ; seul SOCIAL_ACCESS_DOMAIN peut accorder l'accès."],
      actionAdjudication: null,
      perception: null
    };
    const sourceRefs = [...new Set([`commit:${social.value.commit.commitId}`, ...social.value.sourceRefs])];
    const displayPacket: DisplayPacketV1 & JsonObject = {
      schemaVersion: 1,
      contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
      operationId: input.operation.operationId,
      sceneId: input.activeScene.sceneId,
      displayBlocks: [{
        blockId: `${input.operation.operationId}:social-access-response`,
        kind: "NPC_SPEECH",
        speaker: { speakerId: social.value.respondingActorRef, kind: "NPC", displayName: social.value.respondingActorName, roleLabel: "Interlocuteur", ariaLabel: social.value.respondingActorName, visualToken: "speaker-npc" },
        text: social.value.playerFacingText,
        ariaLabel: `Réponse de ${social.value.respondingActorName}`,
        roleLabel: "Réponse sociale d'accès",
        visualStyleToken: "speaker-npc",
        sourceRefs,
        isDegradedFallback: false
      }],
      rawInputAccess: { available: true, operationId: input.operation.operationId },
      rhythmDiagnostics: `social-access:${social.value.resolution.outcome}`,
      reconstructionRefs: sourceRefs,
      version: 1
    };
    return { ok: true, value: { commit: social.value.commit, output: {
      schemaVersion: 1, contractVersion: "narrative-turn-controller/1", operationId: input.operation.operationId, clientRequestId: input.input.clientRequestId,
      noCommit: false, noGameTime: true, interpretation, domainCommand, mjPlan: planning?.plan ?? null,
      mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
      npcPerformance: null, npcPerformanceFailure: null, suspendedIntent: null,
      pendingSkillCheck: social.value.resolution.outcome === "CHECK_REQUIRED" && social.value.resolution.checkPolicy !== null
        ? {
            schemaVersion: 1,
            contractVersion: "pending-narrative-skill-check/1",
            pendingCheckId: `${social.value.resolution.checkPolicy.proposal.checkId}:pending`,
            sourceOperationId: input.operation.operationId,
            sceneId: input.activeScene.sceneId,
            status: "AWAITING_SKILL_ROLL",
            proposal: social.value.resolution.checkPolicy.proposal,
            ownerContext: {
              owner: "SOCIAL_ACCESS",
              resolutionRef: social.value.resolution.resolutionRef,
              accessControlRef: social.value.resolution.accessControlRef,
              playerActorRef: social.value.resolution.playerActorRef,
              respondingActorRef: social.value.resolution.respondingActorRef,
              checkPolicy: social.value.resolution.checkPolicy
            },
            createdAt: input.createdAt,
            commitAuthority: false
          }
        : null,
      resolution: socialResolution, sceneState: createInitialReferenceSceneStateV1(), sceneArrival: null, activeScene: input.activeScene, displayPacket,
      stageTimings: { interpretationMs, planningMs, resolutionMs: Date.now() - resolutionStartedAt, npcPerformanceMs: 0, resolvedOutputMs: Date.now() - resolvedOutputStartedAt },
      aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(planning?.telemetry ?? [])]
    } } };
  }
  if (
    input.inventoryTransactionRuntime !== null && inventoryTransactionCanHandle &&
    ownerInterpretation.semanticIntent.commitment === "committed"
  ) {
    const inventory = await input.inventoryTransactionRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene
    });
    if (!inventory.ok) return inventory;
    const applied = inventory.value.outcome === "APPLIED" && inventory.value.commit !== null && inventory.value.resolution !== null;
    const inventoryResolution: NarrativeResolutionResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${input.operation.operationId}:resolution:inventory-transaction`,
      operationId: input.operation.operationId,
      resultKind: applied ? "COMMIT_APPLIED" : "NO_COMMIT_RESPONSE",
      interpretation,
      domainCommand,
      characterExpression: {
        schemaVersion: 1,
        rawPlayerText: input.input.rawInput,
        interpretedIntentId: interpretation.intentId,
        expressionText: inventory.value.characterExpression,
        fidelity: "STYLE_NORMALIZED",
        addedCommitments: [],
        preservedMeaning: true
      },
      preparedEffects: [],
      handoff: null,
      commitId: inventory.value.commit?.commitId ?? null,
      noGameTime: true,
      safetyNotes: ["Transaction décidée depuis les exemplaires, contenants et emplacements autoritaires de l'inventaire."],
      actionAdjudication: null,
      perception: null
    };
    const sourceRefs = [...new Set([
      ...(inventory.value.commit === null ? [] : [`commit:${inventory.value.commit.commitId}`]),
      ...inventory.value.sourceRefs
    ])];
    const displayPacket: DisplayPacketV1 & JsonObject = {
      schemaVersion: 1,
      contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
      operationId: input.operation.operationId,
      sceneId: input.activeScene.sceneId,
      displayBlocks: [{
        blockId: `${input.operation.operationId}:raw`,
        kind: "RAW_INPUT",
        speaker: { speakerId: "speaker-player", kind: "PLAYER_CHARACTER", displayName: "Joueur", roleLabel: "Entrée joueur", ariaLabel: "Entrée libre du joueur", visualToken: "speaker-player" },
        text: input.input.rawInput,
        ariaLabel: "Entrée originale du joueur",
        roleLabel: "Entrée joueur",
        visualStyleToken: "speaker-player",
        sourceRefs: [`operation:${input.operation.operationId}:raw`],
        isDegradedFallback: false
      }, {
        blockId: `${input.operation.operationId}:inventory-transaction`,
        kind: "SYSTEM_NOTICE",
        speaker: { speakerId: "speaker-system", kind: "SYSTEM", displayName: "Système", roleLabel: "Inventaire", ariaLabel: "Inventaire", visualToken: "speaker-system" },
        text: inventory.value.playerFacingText,
        ariaLabel: "Transaction d'inventaire validée",
        roleLabel: "Inventaire",
        visualStyleToken: "speaker-system",
        sourceRefs,
        isDegradedFallback: false
      }],
      rawInputAccess: { available: true, operationId: input.operation.operationId },
      rhythmDiagnostics: `inventory-transaction:${inventory.value.resolution?.action ?? "REJECTED"}`,
      reconstructionRefs: sourceRefs,
      version: 1
    };
    return { ok: true, value: { commit: inventory.value.commit, output: {
      schemaVersion: 1,
      contractVersion: "narrative-turn-controller/1",
      operationId: input.operation.operationId,
      clientRequestId: input.input.clientRequestId,
      noCommit: !applied,
      noGameTime: true,
      interpretation,
      domainCommand,
      mjPlan: planning?.plan ?? null,
      mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
      npcPerformance: null,
      npcPerformanceFailure: null,
      suspendedIntent: null,
      pendingSkillCheck: null,
      resolution: inventoryResolution,
      sceneState: createInitialReferenceSceneStateV1(),
      sceneArrival: null,
      activeScene: input.activeScene,
      displayPacket,
      stageTimings: { interpretationMs, planningMs, resolutionMs: Date.now() - resolutionStartedAt, npcPerformanceMs: 0, resolvedOutputMs: Date.now() - resolvedOutputStartedAt },
      aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(planning?.telemetry ?? [])]
    } } };
  }

  if (
    input.inventoryAccessRuntime !== null && inventoryAccessCanHandle &&
    ownerInterpretation.semanticIntent.commitment === "committed"
  ) {
    const inventory = await input.inventoryAccessRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene
    });
    if (!inventory.ok) return inventory;
    const inventoryResolution: NarrativeResolutionResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${input.operation.operationId}:resolution:inventory-access`,
      operationId: input.operation.operationId,
      resultKind: "COMMIT_APPLIED",
      interpretation,
      domainCommand,
      characterExpression: {
        schemaVersion: 1,
        rawPlayerText: input.input.rawInput,
        interpretedIntentId: interpretation.intentId,
        expressionText: inventory.value.characterExpression,
        fidelity: "STYLE_NORMALIZED",
        addedCommitments: [],
        preservedMeaning: true
      },
      preparedEffects: [],
      handoff: null,
      commitId: inventory.value.commit.commitId,
      noGameTime: true,
      safetyNotes: ["Accès résolu depuis une instance d'inventaire autoritaire ; aucune possession n'est déduite de la prose."],
      actionAdjudication: null,
      perception: null
    };
    const sourceRefs = [...new Set([`commit:${inventory.value.commit.commitId}`, ...inventory.value.sourceRefs])];
    const displayPacket: DisplayPacketV1 & JsonObject = {
      schemaVersion: 1,
      contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
      operationId: input.operation.operationId,
      sceneId: input.activeScene.sceneId,
      displayBlocks: [{
        blockId: `${input.operation.operationId}:inventory-access`,
        kind: "SYSTEM_NOTICE",
        speaker: { speakerId: "speaker-system", kind: "SYSTEM", displayName: "Système", roleLabel: "Inventaire et accès", ariaLabel: "Inventaire et accès", visualToken: "speaker-system" },
        text: inventory.value.playerFacingText,
        ariaLabel: "Résolution autoritaire d'un accès par inventaire",
        roleLabel: "Inventaire et accès",
        visualStyleToken: "speaker-system",
        sourceRefs,
        isDegradedFallback: false
      }],
      rawInputAccess: { available: true, operationId: input.operation.operationId },
      rhythmDiagnostics: `inventory-access:${inventory.value.resolution.resultingAccessState}`,
      reconstructionRefs: sourceRefs,
      version: 1
    };
    return { ok: true, value: { commit: inventory.value.commit, output: {
      schemaVersion: 1,
      contractVersion: "narrative-turn-controller/1",
      operationId: input.operation.operationId,
      clientRequestId: input.input.clientRequestId,
      noCommit: false,
      noGameTime: true,
      interpretation,
      domainCommand,
      mjPlan: planning?.plan ?? null,
      mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
      npcPerformance: null,
      npcPerformanceFailure: null,
      suspendedIntent: null,
      pendingSkillCheck: null,
      resolution: inventoryResolution,
      sceneState: createInitialReferenceSceneStateV1(),
      sceneArrival: null,
      activeScene: input.activeScene,
      displayPacket,
      stageTimings: { interpretationMs, planningMs, resolutionMs: Date.now() - resolutionStartedAt, npcPerformanceMs: 0, resolvedOutputMs: Date.now() - resolvedOutputStartedAt },
      aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(planning?.telemetry ?? [])]
    } } };
  }
  if (
    input.dynamicPlaceRuntime !== null &&
    dynamicPlaceCanHandle
  ) {
    const destinationEvaluation = input.dynamicPlaceRuntime.evaluateDestination === undefined
      ? null
      : await input.dynamicPlaceRuntime.evaluateDestination({
          repository: input.repository,
          campaignId: input.campaignId,
          operation: input.operation,
          rawInput: ownerInputText,
          interpretation: ownerInterpretation,
          domainCommand,
          activeScene: input.activeScene
        });
    if (destinationEvaluation !== null && !destinationEvaluation.ok) return destinationEvaluation;
    if (destinationEvaluation !== null && destinationEvaluation.value.decision.outcome !== "CREATE_LOCAL") {
      return buildDestinationDecisionControllerResult({
        input,
        interpretation,
        domainCommand,
        planning,
        interpretationResult,
        interpretationMs,
        planningMs,
        resolutionStartedAt,
        resolvedOutputStartedAt,
        decision: destinationEvaluation.value.decision,
        aiTelemetry: destinationEvaluation.value.aiTelemetry
      });
    }
    if (destinationEvaluation?.value.decision.accessHint !== null && destinationEvaluation?.value.decision.accessHint !== undefined) {
      return buildDestinationDecisionControllerResult({
        input,
        interpretation,
        domainCommand,
        planning,
        interpretationResult,
        interpretationMs,
        planningMs,
        resolutionStartedAt,
        resolvedOutputStartedAt,
        decision: {
          ...destinationEvaluation.value.decision,
          reason: "Le lieu paraît plausible, mais son contrôle d'accès doit être établi par le domaine propriétaire avant toute création suivie d'une entrée."
        },
        aiTelemetry: destinationEvaluation.value.aiTelemetry
      });
    }
    const creation = await input.dynamicPlaceRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene,
      destinationDecision: destinationEvaluation?.value.decision
    });
    if (!creation.ok) return creation;
    return buildSceneChangeControllerResult({
      input,
      interpretation,
      domainCommand,
      planning,
      interpretationResult,
      interpretationMs,
      planningMs,
      resolutionStartedAt,
      resolvedOutputStartedAt,
      change: {
        ...creation.value,
        aiTelemetry: [...(destinationEvaluation?.value.aiTelemetry ?? []), ...(creation.value.aiTelemetry ?? [])]
      },
      safetyNote: "Lieu dynamique créé par la capacité dédiée et rendu après commit confirmé."
    });
  }
  if (
    input.sceneTransitionRuntime !== null &&
    !travelCanHandle &&
    domainCommand !== null &&
    ownerInterpretation.semanticIntent.kind === "traverse_visible_boundary" &&
    ownerInterpretation.runtimeDecision.requiredDomain === "world"
  ) {
    const transition = await input.sceneTransitionRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      domainCommand,
      activeScene: input.activeScene
    });
    if (!transition.ok) return transition;
    const transitionResolution: NarrativeResolutionResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-resolution/1",
      resolutionId: `${input.operation.operationId}:resolution:scene-transition`,
      operationId: input.operation.operationId,
      resultKind: "COMMIT_APPLIED",
      interpretation,
      domainCommand,
      characterExpression: {
        schemaVersion: 1,
        rawPlayerText: input.input.rawInput,
        interpretedIntentId: interpretation.intentId,
        expressionText: transition.value.characterExpression,
        fidelity: "STYLE_NORMALIZED",
        addedCommitments: [],
        preservedMeaning: true
      },
      preparedEffects: [],
      handoff: null,
      commitId: transition.value.commit.commitId,
      noGameTime: false,
      safetyNotes: ["Transition de scène résolue par le domaine monde et rendue après commit confirmé."],
      actionAdjudication: adjudicateContextualActionV1({ interpretation, scene: input.activeScene }),
      perception: null
    };
    return {
      ok: true,
      value: {
        commit: transition.value.commit,
        output: {
          schemaVersion: 1,
          contractVersion: "narrative-turn-controller/1",
          operationId: input.operation.operationId,
          clientRequestId: input.input.clientRequestId,
          noCommit: false,
          noGameTime: false,
          interpretation,
          domainCommand,
          mjPlan: planning?.plan ?? null,
          mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
          npcPerformance: null,
          npcPerformanceFailure: null,
          suspendedIntent: null,
          pendingSkillCheck: null,
          resolution: transitionResolution,
          sceneState: createInitialReferenceSceneStateV1(),
          sceneArrival: transition.value.arrival,
          activeScene: transition.value.arrival.scene,
          displayPacket: transition.value.displayPacket,
          stageTimings: {
            interpretationMs,
            planningMs,
            resolutionMs: Date.now() - resolutionStartedAt,
            npcPerformanceMs: 0,
            resolvedOutputMs: Date.now() - resolvedOutputStartedAt
          },
          aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(planning?.telemetry ?? []), ...(transition.value.aiTelemetry ?? [])]
        }
      }
    };
  }
  const assignedNpcActorId = openSemanticOwnerAdapter?.capabilityId === "scene.visible-dialogue"
    && ownerInterpretation.semanticIntent.target?.kind === "npc"
    && ownerInterpretation.semanticIntent.target.ref !== null
      ? ownerInterpretation.semanticIntent.target.ref
      : null;
  const informationNeed = interpretation.openSemanticFrame?.components
    .map(component => component.informationNeed ?? null)
    .find(need => need !== null) ?? null;
  let npcInformationTurn = null as Awaited<ReturnType<NarrativeNpcInformationRuntimeV1["resolve"]>> | null;
  let npcInformationDiagnostic: NpcInformationPerformanceDiagnosticV1 | null = null;
  if (input.npcInformationRuntime !== null && assignedNpcActorId !== null && informationNeed !== null) {
    try {
      npcInformationTurn = await input.npcInformationRuntime.resolve({
        operationId: input.operation.operationId,
        actorId: assignedNpcActorId,
        need: informationNeed,
        activeScene: input.activeScene
      });
      npcInformationDiagnostic = npcInformationTurn.diagnostic;
    } catch {
      npcInformationDiagnostic = {
        schemaVersion: 1,
        contractVersion: "npc-information-performance-diagnostic/1",
        status: "FAILED",
        failureStage: "LOOKUP_KNOWLEDGE_DISCLOSURE",
        failureReason: "npc-information.owner-resolution-unavailable",
        lookup: { candidateCount: 0, missingDimensions: [informationNeed.requestedDimension], authorities: [] },
        knowledge: { knownCandidateCount: 0, unknownCandidateCount: 0, bases: [] },
        disclosure: {
          decision: "ACTOR_DOES_NOT_KNOW",
          causeCode: "NO_RESOLVED_INFORMATION",
          authorizedFactCount: 0,
          withheldCandidateCount: 0,
          alternativeActorRefs: []
        },
        privateValuesIncluded: false
      };
    }
  }
  const resolution = await resolveNarrativeTurnV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: input.operation,
    rawInput: ownerInputText,
    interpretation: ownerInterpretation,
    domainCommand,
    suspendedIntent,
    playableScene: input.activeScene,
    playerPublicContext: playerPublicContextResult.value,
    campaignFactCommitPreparation: npcInformationTurn?.creation?.commitPreparation ?? null
  });
  if (!resolution.ok) return resolution;
  const canonicalResolutionResult = resolution.value.result;
  const canonicalResolutionDisplay = openSemanticOwnerAdapter === null
    ? resolution.value.displayPacket
    : restoreOriginalPlayerInputV1(
        resolution.value.displayPacket,
        input.input.rawInput
      );
  const resolutionMs = Date.now() - resolutionStartedAt;
  // Une relation J4 ouvre ses propres opérations autoritaires. Elle est donc
  // finalisée par submit() après la fermeture du tour narratif principal.
  const npcPerformanceStartedAt = Date.now();
  const npcPerformance = input.npcPerformerConfig === null || npcInformationDiagnostic?.status === "FAILED"
    ? null
    : await performNpcTurnV1({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      rawInput: ownerInputText,
      interpretation: ownerInterpretation,
      mjPlan: planning?.plan ?? null,
      resolution: canonicalResolutionResult,
      sceneState: resolution.value.sceneState,
      activeScene: resolution.value.playableScene,
      config: input.npcPerformerConfig,
      ...(assignedNpcActorId !== null
        ? { assignedActorId: assignedNpcActorId }
        : {}),
      missionRelationEngagement: null,
      informationDisclosure: npcInformationTurn?.performerProjection ?? null
    });
  const npcPerformanceMs = Date.now() - npcPerformanceStartedAt;
  let displayPacket = applyNpcPerformanceToDisplayPacketV1({
    displayPacket: canonicalResolutionDisplay,
    performance: npcPerformance?.performance ?? npcPerformance?.fallbackPerformance ?? null,
    performanceFailure: npcPerformance?.performanceFailure as (NpcPerformanceFailureV1 & JsonObject) | null ?? null,
    activeScene: resolution.value.playableScene
  });

  return {
    ok: true,
    value: {
      commit: resolution.value.commit,
      output: {
        schemaVersion: 1,
        contractVersion: "narrative-turn-controller/1",
        operationId: input.operation.operationId,
        clientRequestId: input.input.clientRequestId,
        noCommit: resolution.value.commit === null,
        noGameTime: resolution.value.result.noGameTime,
        interpretation,
        domainCommand,
        mjPlan: planning?.plan ?? null,
        mjPlannerFailure: planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
        npcPerformance: npcPerformance?.performance ?? null,
        npcEffectivePerformance: npcPerformance?.performance ?? npcPerformance?.fallbackPerformance ?? null,
        npcPerformanceFailure: npcPerformance?.performanceFailure as (NpcPerformanceFailureV1 & JsonObject) | null ?? null,
        npcInformationDiagnostic,
        suspendedIntent,
        pendingSkillCheck: buildPendingNarrativeSkillCheckV1({
          operationId: input.operation.operationId,
          sceneId: resolution.value.playableScene.sceneId,
          createdAt: input.createdAt,
          perception: canonicalResolutionResult.perception
        }),
        resolution: canonicalResolutionResult,
        sceneState: resolution.value.sceneState,
        sceneArrival: null,
        activeScene: resolution.value.playableScene,
        displayPacket,
        stageTimings: {
          interpretationMs,
          planningMs,
          resolutionMs,
          npcPerformanceMs,
          resolvedOutputMs: Date.now() - resolvedOutputStartedAt
        },
        aiTelemetry: [
          ...(interpretationResult?.telemetry ?? []),
          ...(planning?.telemetry ?? []),
          ...(npcPerformance?.telemetry ?? [])
        ]
      }
    }
  };
}

function normalizeCompanionTargetActorIdV1(targetRef: string | null): string | null {
  if (targetRef === null || !targetRef.trim()) return null;
  return targetRef.replace(/^(?:npc|actor):/u, "");
}

function restoreOriginalPlayerInputV1(
  packet: DisplayPacketV1 & JsonObject,
  rawInput: string
): DisplayPacketV1 & JsonObject {
  return {
    ...packet,
    displayBlocks: packet.displayBlocks.map(block =>
      block.kind === "RAW_INPUT" ? { ...block, text: rawInput } : block
    )
  } as DisplayPacketV1 & JsonObject;
}

function buildDestinationDecisionControllerResult(input: {
  input: Parameters<typeof buildResolvedOutput>[0];
  interpretation: NarrativeIntentInterpretationV1 & JsonObject;
  domainCommand: NarrativeDomainCommandV1 | null;
  planning: { plan: (MjPlannerPayloadV1 & JsonObject) | null; planningFailure: MjPlanningFailureV1 | null; telemetry: AiCallTelemetryV1[] } | null;
  interpretationResult: { telemetry: AiCallTelemetryV1[] } | null;
  interpretationMs: number;
  planningMs: number;
  resolutionStartedAt: number;
  resolvedOutputStartedAt: number;
  decision: DestinationPlausibilityDecisionV1;
  aiTelemetry: AiCallTelemetryV1[];
}): Result<{ output: NarrativeTurnControllerOutputV1; commit: null }> {
  const operationId = input.input.operation.operationId;
  const clarify = input.decision.outcome === "CLARIFY";
  const suspendedIntent = clarify
    ? createSuspendedIntentRecordV1({
        suspendedIntentId: `${operationId}:suspended:destination`,
        operationId,
        rawInput: input.input.input.rawInput,
        interpretation: input.interpretation,
        createdAt: input.input.createdAt,
        missingField: "destination",
        question: input.decision.reason
      }) as SuspendedIntentRecordV1 & JsonObject
    : null;
  const handoff = input.decision.outcome === "TRAVEL_REQUIRED" || input.decision.outcome === "USE_KNOWN_DESTINATION"
    ? { target: "WORLD" as const, reason: input.decision.reason, blockedCommit: true as const }
    : null;
  const resolution: NarrativeResolutionResultV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-resolution/1",
    resolutionId: `${operationId}:resolution:destination-decision`,
    operationId,
    resultKind: clarify ? "CLARIFICATION_REQUIRED" : handoff === null ? "NO_COMMIT_RESPONSE" : "HANDOFF_REQUIRED",
    interpretation: input.interpretation,
    domainCommand: input.domainCommand,
    characterExpression: null,
    preparedEffects: [],
    handoff,
    commitId: null,
    noGameTime: true,
    safetyNotes: [`Destination ${input.decision.outcome}; aucune création ni dépense de temps.`],
    actionAdjudication: null,
    perception: null
  };
  const sourceRefs = input.decision.sourceRefs.length > 0
    ? input.decision.sourceRefs
    : [`operation:${operationId}:destination-decision`];
  const displayPacket: DisplayPacketV1 & JsonObject = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId,
    sceneId: input.input.activeScene.sceneId,
    displayBlocks: [{
      blockId: `${operationId}:destination-decision`,
      kind: clarify ? "CLARIFICATION" : "SYSTEM_NOTICE",
      speaker: {
        speakerId: "speaker-gm",
        kind: "GM",
        displayName: "MJ",
        roleLabel: "Décision de destination",
        ariaLabel: "Décision de destination",
        visualToken: "speaker-gm"
      },
      text: input.decision.reason,
      ariaLabel: `Décision de destination: ${input.decision.outcome}`,
      roleLabel: "Décision de destination",
      visualStyleToken: "speaker-gm",
      sourceRefs,
      isDegradedFallback: false
    }],
    rawInputAccess: { available: true, operationId },
    rhythmDiagnostics: `destination-decision:${input.decision.code}`,
    reconstructionRefs: sourceRefs,
    version: 1
  };
  return {
    ok: true,
    value: {
      commit: null,
      output: {
        schemaVersion: 1,
        contractVersion: "narrative-turn-controller/1",
        operationId,
        clientRequestId: input.input.input.clientRequestId,
        noCommit: true,
        noGameTime: true,
        interpretation: input.interpretation,
        domainCommand: input.domainCommand,
        mjPlan: input.planning?.plan ?? null,
        mjPlannerFailure: input.planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
        npcPerformance: null,
        npcPerformanceFailure: null,
        suspendedIntent,
        pendingSkillCheck: null,
        resolution,
        sceneState: createInitialReferenceSceneStateV1(),
        sceneArrival: null,
        activeScene: input.input.activeScene,
        displayPacket,
        stageTimings: {
          interpretationMs: input.interpretationMs,
          planningMs: input.planningMs,
          resolutionMs: Date.now() - input.resolutionStartedAt,
          npcPerformanceMs: 0,
          resolvedOutputMs: Date.now() - input.resolvedOutputStartedAt
        },
        aiTelemetry: [...(input.interpretationResult?.telemetry ?? []), ...(input.planning?.telemetry ?? []), ...input.aiTelemetry]
      }
    }
  };
}

async function recoverCommittedPendingRenderV1(input: {
  repository: CampaignRepository;
  operation: OperationRecord;
  input: NarrativeTurnInputV1;
  activeScene: PlayableSceneStateV1;
}): Promise<Result<NarrativeTurnControllerOutputV1>> {
  if (input.operation.commitId === null) {
    return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.recovery.commit-id-missing") };
  }
  const commit = await input.repository.getCommit(input.operation.commitId);
  if (!commit.ok) return commit;
  const positionWrite = commit.value.aggregateWrites.find(write => write.aggregateType === "world.position");
  const lifecycleWrite = commit.value.aggregateWrites.find(write => write.aggregateType === "scene.lifecycle");
  if (positionWrite === undefined || lifecycleWrite === undefined) {
    return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.recovery.arrival-writes-missing", { commitId: commit.value.commitId }) };
  }
  const [position, lifecycle] = await Promise.all([
    input.repository.getAggregate(commit.value.campaignId, "world.position", positionWrite.aggregateId),
    input.repository.getAggregate(commit.value.campaignId, "scene.lifecycle", lifecycleWrite.aggregateId)
  ]);
  if (!position.ok) return position;
  if (!lifecycle.ok) return lifecycle;
  const authoritySourceRefs = input.activeScene.aiSceneWriterPolicy.mayReference.length > 0
    ? input.activeScene.aiSceneWriterPolicy.mayReference
    : [`commit:${commit.value.commitId}`];
  const arrival = buildSceneArrivalAfterCommitV1({
    commit: commit.value,
    positionAggregate: position.value,
    sceneLifecycleAggregate: lifecycle.value,
    destinationScene: input.activeScene,
    authoritySourceRefs
  });
  if (!arrival.ok) {
    return { ok: false, error: coreError("CAMPAIGN_INTEGRITY_FAILURE", "narrative.recovery.arrival-invalid", { commitId: commit.value.commitId, issues: arrival.issues }) };
  }
  const interpretation = interpretNarrativeInputV1({
    intentId: `${input.operation.operationId}:intent:recovered`,
    rawInput: input.input.rawInput
  }) as NarrativeIntentInterpretationV1 & JsonObject;
  const domainCommand = buildNarrativeDomainCommandV1(interpretation);
  const resolution: NarrativeResolutionResultV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-resolution/1",
    resolutionId: `${input.operation.operationId}:resolution:recovered-presentation`,
    operationId: input.operation.operationId,
    resultKind: "COMMIT_APPLIED",
    interpretation,
    domainCommand,
    characterExpression: null,
    preparedEffects: [],
    handoff: null,
    commitId: commit.value.commitId,
    noGameTime: false,
    safetyNotes: ["Le commit avait déjà réussi; seule une présentation sobre a été reconstruite."],
    actionAdjudication: null,
    perception: null
  };
  const sourceRefs = arrival.value.reconstructionRefs;
  const displayPacket: DisplayPacketV1 & JsonObject = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operation.operationId,
    sceneId: input.activeScene.sceneId,
    displayBlocks: [{
      blockId: `${input.operation.operationId}:recovered-arrival`,
      kind: "GM_NARRATION",
      speaker: {
        speakerId: "speaker-gm",
        kind: "GM",
        displayName: "MJ",
        roleLabel: "Maître du jeu",
        ariaLabel: "Maître du jeu",
        visualToken: "speaker-gm"
      },
      text: `La transition déjà validée est restaurée. Tu te trouves désormais à ${input.activeScene.locationName}.`,
      ariaLabel: "Arrivée restaurée après commit",
      roleLabel: "Arrivée restaurée",
      visualStyleToken: "speaker-gm",
      sourceRefs,
      isDegradedFallback: true
    }],
    rawInputAccess: { available: true, operationId: input.operation.operationId },
    rhythmDiagnostics: "committed-pending-render-recovered",
    reconstructionRefs: sourceRefs,
    version: 1
  };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: "narrative-turn-controller/1",
      operationId: input.operation.operationId,
      clientRequestId: input.input.clientRequestId,
      noCommit: false,
      noGameTime: false,
      interpretation,
      domainCommand,
      mjPlan: null,
      mjPlannerFailure: null,
      npcPerformance: null,
      npcPerformanceFailure: null,
      suspendedIntent: null,
      pendingSkillCheck: null,
      resolution,
      sceneState: createInitialReferenceSceneStateV1(),
      sceneArrival: arrival.value,
      activeScene: input.activeScene,
      displayPacket,
      stageTimings: { interpretationMs: 0, planningMs: 0, resolutionMs: 0, npcPerformanceMs: 0, resolvedOutputMs: 0 },
      aiTelemetry: []
    }
  };
}

function buildSceneChangeControllerResult(input: {
  input: Parameters<typeof buildResolvedOutput>[0];
  interpretation: NarrativeIntentInterpretationV1 & JsonObject;
  domainCommand: NarrativeDomainCommandV1 | null;
  planning: { plan: (MjPlannerPayloadV1 & JsonObject) | null; planningFailure: MjPlanningFailureV1 | null; telemetry: AiCallTelemetryV1[] } | null;
  interpretationResult: { telemetry: AiCallTelemetryV1[] } | null;
  interpretationMs: number;
  planningMs: number;
  resolutionStartedAt: number;
  resolvedOutputStartedAt: number;
  change: {
    commit: CommitRecord;
    arrival: SceneArrivalStateV1;
    displayPacket: DisplayPacketV1 & JsonObject;
    characterExpression: string;
    durationSeconds: number;
    aiTelemetry?: AiCallTelemetryV1[];
  };
  safetyNote: string;
}): Result<{ output: NarrativeTurnControllerOutputV1; commit: unknown | null }> {
  const resolution: NarrativeResolutionResultV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-resolution/1",
    resolutionId: `${input.input.operation.operationId}:resolution:scene-change`,
    operationId: input.input.operation.operationId,
    resultKind: "COMMIT_APPLIED",
    interpretation: input.interpretation,
    domainCommand: input.domainCommand,
    characterExpression: {
      schemaVersion: 1,
      rawPlayerText: input.input.input.rawInput,
      interpretedIntentId: input.interpretation.intentId,
      expressionText: input.change.characterExpression,
      fidelity: "STYLE_NORMALIZED",
      addedCommitments: [],
      preservedMeaning: true
    },
    preparedEffects: [],
    handoff: null,
    commitId: input.change.commit.commitId,
    noGameTime: input.change.durationSeconds === 0,
    safetyNotes: [input.safetyNote],
    actionAdjudication: adjudicateContextualActionV1({ interpretation: input.interpretation, scene: input.input.activeScene }),
    perception: null
  };
  return {
    ok: true,
    value: {
      commit: input.change.commit,
      output: {
        schemaVersion: 1,
        contractVersion: "narrative-turn-controller/1",
        operationId: input.input.operation.operationId,
        clientRequestId: input.input.input.clientRequestId,
        noCommit: false,
        noGameTime: input.change.durationSeconds === 0,
        interpretation: input.interpretation,
        domainCommand: input.domainCommand,
        mjPlan: input.planning?.plan ?? null,
        mjPlannerFailure: input.planning?.planningFailure as (MjPlanningFailureV1 & JsonObject) | null ?? null,
        npcPerformance: null,
        npcPerformanceFailure: null,
        suspendedIntent: null,
        pendingSkillCheck: null,
        resolution,
        sceneState: createInitialReferenceSceneStateV1(),
        sceneArrival: input.change.arrival,
        activeScene: input.change.arrival.scene,
        displayPacket: input.change.displayPacket,
        stageTimings: {
          interpretationMs: input.interpretationMs,
          planningMs: input.planningMs,
          resolutionMs: Date.now() - input.resolutionStartedAt,
          npcPerformanceMs: 0,
          resolvedOutputMs: Date.now() - input.resolvedOutputStartedAt
        },
        aiTelemetry: [...(input.interpretationResult?.telemetry ?? []), ...(input.planning?.telemetry ?? []), ...(input.change.aiTelemetry ?? [])]
      }
    }
  };
}

function buildRequestPayload(input: NarrativeTurnInputV1): JsonObject {
  return {
    schemaVersion: 1,
    rawInput: input.rawInput,
    clientRequestId: input.clientRequestId,
    noGameTime: true,
    prototypeOnly: true
  };
}

export function buildPendingNarrativeSkillCheckV1(input: {
  operationId: string;
  sceneId: string;
  createdAt: string;
  perception: NarrativeResolutionResultV1["perception"];
}): PendingNarrativeSkillCheckV1 | null {
  const perception = input.perception;
  if (perception?.status !== "CHECK_REQUIRED" || perception.checkProposal === null) return null;
  return {
    schemaVersion: 1,
    contractVersion: "pending-narrative-skill-check/1",
    pendingCheckId: `${perception.checkProposal.checkId}:pending`,
    sourceOperationId: input.operationId,
    sceneId: input.sceneId,
    status: "AWAITING_SKILL_ROLL",
    proposal: perception.checkProposal,
    ownerContext: { owner: "PERCEPTION" },
    createdAt: input.createdAt,
    commitAuthority: false
  };
}

function validateInput(input: NarrativeTurnInputV1): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (input.schemaVersion !== 1) issues.push("schemaVersion must be 1.");
  if (!/^[a-z][a-z0-9._:-]{2,127}$/u.test(input.clientRequestId)) {
    issues.push("clientRequestId must be a core-compatible opaque id.");
  }
  if (typeof input.rawInput !== "string" || input.rawInput.trim().length === 0) {
    issues.push("rawInput must be a non-empty string.");
  }
  if (input.rawInput.length > 10_000) issues.push("rawInput exceeds prototype limit.");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function normalizeClientRequestId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.:-]/gu, "-").slice(0, 96);
}

function buildResponseBlock(
  operationId: string,
  interpretation: NarrativeIntentInterpretationV1,
  suspendedIntent: SuspendedIntentRecordV1 | null
): { kind: "SYSTEM_NOTICE" | "CLARIFICATION"; text: string; ariaLabel: string } {
  if (suspendedIntent) {
    return {
      kind: "CLARIFICATION",
      text: suspendedIntent.question,
      ariaLabel: `Clarification pour ${operationId}: CLARIFICATION`
    };
  }
  if (interpretation.intentType === "meta_question") {
    return {
      kind: "SYSTEM_NOTICE",
      text: "Question méta reçue. Aucun temps de jeu, commit métier ou appel IA n'a été déclenché.",
      ariaLabel: `Notification méta pour ${operationId}: SYSTEM_NOTICE`
    };
  }
  if (interpretation.intentType === "possibility_query") {
    return {
      kind: "SYSTEM_NOTICE",
      text: "Question de possibilité reçue. L'action évoquée n'a pas été exécutée.",
      ariaLabel: `Notification possibilité pour ${operationId}: SYSTEM_NOTICE`
    };
  }
  return {
    kind: "SYSTEM_NOTICE",
    text: `Intention détectée (${interpretation.intentType}), mais la résolution réelle est hors périmètre I-06E. Aucun temps de jeu ni commit métier n'a été déclenché.`,
    ariaLabel: `Notification limite I-06E pour ${operationId}: SYSTEM_NOTICE`
  };
}
