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
  upgradeLegacyNarrativeIntentInterpretationV1,
  type NarrativeIntentInterpretationV1,
  type SuspendedIntentRecordV1
} from "./intentClarification";
import {
  createDefaultAiIntentInterpreterConfigV1,
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
  performNpcTurnV1,
  type NpcPerformanceFailureV1,
  type NpcPerformerConfigV1
} from "./npcPerforming";
import type { AiCallTelemetryV1, MjPlannerPayloadV1, NpcPerformerPayloadV1 } from "../ai/types";
import {
  resolveNarrativeTurnV1,
  type NarrativeResolutionResultV1
} from "./narrativeResolution";
import type { SkillCheckProposalV1 } from "./skillCheckProposal";
import type { D20SourceV1 } from "./diceRollRecord";
import {
  resumePendingPerceptionSkillCheckV1,
  type ResumePendingSkillCheckCommandV1,
  type ResumePendingSkillCheckResultV1
} from "./pendingSkillCheckResume";
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
import type { SceneArrivalStateV1 } from "./sceneArrival";
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
  resolveMissionRelationEngagementV1,
  type MissionRelationEngagementResultV1,
  type ProposeMissionRelationEngagementCommandV1,
  type ResolveMissionRelationEngagementCommandV1
} from "./missionRelationAuthority";
import {
  recordCampaignLoreProjectionV1,
  type RecordCampaignLoreProjectionCommandV1,
  type RecordCampaignLoreProjectionResultV1
} from "./campaignLoreProjectionRuntime";
import { routeNarrativeSemanticIntentV2 } from "./runtimeCapabilityRouting";
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
  }): Promise<Result<Awaited<ReturnType<NarrativeSceneTransitionRuntimeV1["execute"]>> extends Result<infer T> ? T : never>>;
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

export interface PendingNarrativeSkillCheckV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "pending-narrative-skill-check/1";
  pendingCheckId: string;
  sourceOperationId: string;
  sceneId: string;
  status: "AWAITING_SKILL_ROLL";
  proposal: SkillCheckProposalV1;
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
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  restRuntime?: NarrativeRestRuntimeV1 | null;
  socialInitiativePerformer?: SocialInitiativePerformerV1 | null;
  worldSceneLocationResolver?: NarrativeWorldSceneLocationResolverV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
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
  private readonly sceneTransitionRuntime: NarrativeSceneTransitionRuntimeV1 | null;
  private readonly dynamicPlaceRuntime: NarrativeDynamicPlaceRuntimeV1 | null;
  private readonly restRuntime: NarrativeRestRuntimeV1 | null;
  private readonly socialInitiativePerformer: SocialInitiativePerformerV1 | null;
  private readonly worldSceneLocationResolver: NarrativeWorldSceneLocationResolverV1 | null;
  private readonly activeSceneResolver: NarrativeActiveSceneResolverV1 | null;
  private readonly tacticalConsequenceAuthorities:
    readonly TacticalConsequenceAuthorityV1[];
  private readonly bastionTacticalRuntime:
    NarrativeBastionTacticalRuntimeV1 | null;
  private readonly d20Source: D20SourceV1 | undefined;
  private readonly runtimeBindings: CampaignRuntimeBindingsV1;
  private recentLocalReferents: LocalReferentHintV1[] = [];
  private recentSemanticTurns: RecentSemanticTurnV1[] = [];

  constructor(options: NarrativeTurnControllerOptions) {
    this.repository = options.repository;
    this.campaignId = options.campaignId;
    this.clock = options.clock ?? systemClock;
    this.idPrefix = options.idPrefix ?? "nar";
    this.intentInterpreterConfig = options.intentInterpreterConfig === undefined
      ? createDefaultAiIntentInterpreterConfigV1()
      : options.intentInterpreterConfig;
    this.mjPlannerConfig = options.mjPlannerConfig === undefined
      ? createDefaultMjPlannerConfigV1()
      : options.mjPlannerConfig;
    this.npcPerformerConfig = options.npcPerformerConfig === undefined
      ? createDefaultNpcPerformerConfigV1()
      : options.npcPerformerConfig;
    this.sceneTransitionRuntime = options.sceneTransitionRuntime ?? null;
    this.dynamicPlaceRuntime = options.dynamicPlaceRuntime ?? null;
    this.restRuntime = options.restRuntime ?? null;
    this.socialInitiativePerformer = options.socialInitiativePerformer === undefined
      ? new LocalSocialInitiativePerformerV1()
      : options.socialInitiativePerformer;
    this.worldSceneLocationResolver = options.worldSceneLocationResolver ?? null;
    this.activeSceneResolver = options.activeSceneResolver ?? null;
    this.bastionTacticalRuntime =
      options.bastionTacticalRuntimeFactory?.create({
        repository: options.repository,
        campaignId: options.campaignId
      }) ?? null;
    this.tacticalConsequenceAuthorities =
      options.tacticalConsequenceAuthorities
      ?? this.bastionTacticalRuntime?.consequenceAuthorities
      ?? [];
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
        sceneId: hydratedScene.value.sceneId,
        boundaryKind: input.boundaryKind,
        presentActorIds: [...new Set([
          ...hydratedScene.value.presentNpc.map(actor => actor.actorId),
          ...hydratedScene.value.ambientPopulation.map(actor => actor.actorId),
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
      scene: hydratedScene.value,
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
      this.rememberLocalReferent(restoredOutput, activeScene);
      this.rememberSemanticTurn(restoredOutput);
      return {
        ok: true,
        value: {
          operation: received.value,
          output: restoredOutput
        }
      };
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
    activeScene = hydratedSceneResult.value;

    const output = await buildResolvedOutput({
      repository: this.repository,
      campaignId: this.campaignId,
      operation: received.value,
      input,
      createdAt: this.clock.now().toISOString(),
      intentInterpreterConfig: this.intentInterpreterConfig,
      mjPlannerConfig: this.mjPlannerConfig,
      npcPerformerConfig: this.npcPerformerConfig,
      localReferentHints: this.recentLocalReferents.filter(hint => hint.sceneId === activeScene.sceneId && hint.sceneVersion === activeScene.version),
      recentSemanticTurns: this.recentSemanticTurns,
      sceneTransitionRuntime: this.sceneTransitionRuntime,
      dynamicPlaceRuntime: this.dynamicPlaceRuntime,
      restRuntime: this.restRuntime,
      activeScene
    });
    if (!output.ok) {
      await cancelUncommittedOperationAfterFailure(this.repository, received.value.operationId);
      return output;
    }

    const completed = output.value.commit === null
      ? await this.repository.completeWithoutCommit(received.value.operationId, 1, output.value.output)
      : await this.repository.completePresentation(received.value.operationId, "COMMITTED_RENDERED", 1, output.value.output);
    if (!completed.ok) return completed;
    this.rememberLocalReferent(output.value.output, activeScene);
    this.rememberSemanticTurn(output.value.output);

    return {
      ok: true,
      value: {
        operation: completed.value,
        output: output.value.output
      }
    };
  }

  async recordRenderedProjection(
    request: NarrativeRenderProjectionInputV1
  ): Promise<Result<NarrativeRenderProjectionRecordResultV1>> {
    return recordNarrativeRenderedProjectionV1({
      repository: this.repository,
      campaignId: this.campaignId,
      clock: this.clock,
      idPrefix: this.idPrefix,
      request
    });
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
    return resumePendingPerceptionSkillCheckV1({
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
    return restoreNarrativeRenderedThreadV1({
      repository: this.repository,
      campaignId: this.campaignId,
      limit
    });
  }

  async restorePendingSkillCheck(): Promise<Result<PendingNarrativeSkillCheckV1 | null>> {
    const operations = await this.repository.listOperations(this.campaignId, "narrative.turn.input", 100);
    if (!operations.ok) return operations;
    const candidates = [...operations.value]
      .filter(operation => operation.phase === "COMPLETED" && operation.resultPayload !== null)
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
    for (const operation of candidates) {
      const pending = (operation.resultPayload as {
        pendingSkillCheck?: PendingNarrativeSkillCheckV1 | null;
      }).pendingSkillCheck ?? null;
      if (pending === null) continue;
      const outcome = await this.repository.getAggregate(
        this.campaignId,
        "perception.check-outcome",
        opaqueId<AggregateId>(`perception-outcome:${pending.proposal.checkId}`)
      );
      if (!outcome.ok && outcome.error.code === "NOT_FOUND") return { ok: true, value: pending };
      if (!outcome.ok) return outcome;
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
    const target = output.interpretation.referentResolution?.resolvedTarget ?? output.interpretation.semanticIntent.target ?? null;
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
    const turn: RecentSemanticTurnV1 = {
      schemaVersion: 1,
      operationId: output.operationId,
      semanticKind: output.interpretation.semanticIntent.kind,
      playerGoal: output.interpretation.semanticIntent.playerGoal,
      primaryTarget: output.interpretation.referentResolution?.resolvedTarget ?? output.interpretation.semanticIntent.target,
      topic: typeof output.interpretation.topic === "string" ? output.interpretation.topic : null,
      commitment: output.interpretation.semanticIntent.commitment,
      focusDisposition: releasesFocus ? "RELEASE" : "RETAIN"
    };
    this.recentSemanticTurns = [
      turn,
      ...this.recentSemanticTurns.filter(entry => entry.operationId !== turn.operationId)
    ].slice(0, 5);
  }
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
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  restRuntime?: NarrativeRestRuntimeV1 | null;
  worldSceneLocationResolver?: NarrativeWorldSceneLocationResolverV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
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
    sceneTransitionRuntime: options.sceneTransitionRuntime === undefined
      ? createPrototypeInnSceneTransitionRuntimeV1()
      : options.sceneTransitionRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    restRuntime: options.restRuntime,
    worldSceneLocationResolver: options.worldSceneLocationResolver,
    activeSceneResolver: options.activeSceneResolver === undefined
      ? { resolve: resolvePrototypeInnActiveSceneV1 }
      : options.activeSceneResolver,
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
  sceneTransitionRuntime?: NarrativeSceneTransitionRuntimeV1 | null;
  dynamicPlaceRuntime?: NarrativeDynamicPlaceRuntimeV1 | null;
  restRuntime?: NarrativeRestRuntimeV1 | null;
  worldSceneLocationResolver?: NarrativeWorldSceneLocationResolverV1 | null;
  activeSceneResolver?: NarrativeActiveSceneResolverV1 | null;
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
    sceneTransitionRuntime: options.sceneTransitionRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    restRuntime: options.restRuntime,
    worldSceneLocationResolver: options.worldSceneLocationResolver,
    activeSceneResolver: options.activeSceneResolver,
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
    sceneTransitionRuntime: options.sceneTransitionRuntime === undefined
      ? createPrototypeInnSceneTransitionRuntimeV1()
      : options.sceneTransitionRuntime,
    dynamicPlaceRuntime: options.dynamicPlaceRuntime,
    restRuntime: options.restRuntime,
    worldSceneLocationResolver: options.worldSceneLocationResolver,
    activeSceneResolver: options.activeSceneResolver === undefined
      ? { resolve: resolvePrototypeInnActiveSceneV1 }
      : options.activeSceneResolver,
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

async function buildResolvedOutput(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  input: NarrativeTurnInputV1;
  createdAt: string;
  intentInterpreterConfig: AiIntentInterpreterConfigV1 | null;
  mjPlannerConfig: MjPlannerConfigV1 | null;
  npcPerformerConfig: NpcPerformerConfigV1 | null;
  localReferentHints?: LocalReferentHintV1[];
  recentSemanticTurns?: RecentSemanticTurnV1[];
  sceneTransitionRuntime: NarrativeSceneTransitionRuntimeV1 | null;
  dynamicPlaceRuntime: NarrativeDynamicPlaceRuntimeV1 | null;
  restRuntime: NarrativeRestRuntimeV1 | null;
  activeScene: PlayableSceneStateV1;
}): Promise<Result<{ output: NarrativeTurnControllerOutputV1; commit: unknown | null }>> {
  const resolvedOutputStartedAt = Date.now();
  const intentId = `${input.operation.operationId}:intent:1`;
  const interpretationStartedAt = Date.now();
  const interpretationResult = input.intentInterpreterConfig === null
    ? null
    : await interpretNarrativeInputWithAiV1({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      intentId,
      rawInput: input.input.rawInput,
      config: input.intentInterpreterConfig,
      localReferentHints: input.localReferentHints ?? [],
      recentSemanticTurns: input.recentSemanticTurns ?? [],
      playableScene: input.activeScene
    });
  const interpretation = interpretationResult === null
    ? interpretNarrativeInputV1({
      intentId,
      rawInput: input.input.rawInput
    }) as NarrativeIntentInterpretationV1 & JsonObject
    : interpretationResult.interpretation as NarrativeIntentInterpretationV1 & JsonObject;
  const interpretationMs = Date.now() - interpretationStartedAt;
  const planningStartedAt = Date.now();
  const planning = input.mjPlannerConfig === null
    ? null
    : await planNarrativeTurnWithMjV1({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      rawInput: input.input.rawInput,
      interpretation,
      domainCommand: buildNarrativeDomainCommandV1(interpretation),
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
  const domainCommand = buildNarrativeDomainCommandV1(interpretation);
  const resolutionStartedAt = Date.now();
  const runtimeRoute = routeNarrativeSemanticIntentV2({
    semanticIntent: interpretation.semanticIntent,
    runtimeSuggestion: interpretation.runtimeHandling ?? null,
    availability: { rest: input.restRuntime !== null }
  });
  if (runtimeRoute.capabilityId === "rest.process" && input.restRuntime !== null) {
    return input.restRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: input.input.rawInput,
      interpretation,
      domainCommand,
      activeScene: input.activeScene,
      createdAt: input.createdAt,
      aiTelemetry: interpretationResult?.telemetry ?? []
    });
  }
  if (
    input.dynamicPlaceRuntime !== null &&
    await input.dynamicPlaceRuntime.canHandle({ repository: input.repository, campaignId: input.campaignId, interpretation, domainCommand, activeScene: input.activeScene })
  ) {
    const creation = await input.dynamicPlaceRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: input.input.rawInput,
      interpretation,
      domainCommand,
      activeScene: input.activeScene
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
      change: creation.value,
      safetyNote: "Lieu dynamique créé par la capacité dédiée et rendu après commit confirmé."
    });
  }
  if (
    input.sceneTransitionRuntime !== null &&
    domainCommand !== null &&
    interpretation.semanticIntent.kind === "traverse_visible_boundary" &&
    interpretation.runtimeDecision.requiredDomain === "world"
  ) {
    const transition = await input.sceneTransitionRuntime.execute({
      repository: input.repository,
      campaignId: input.campaignId,
      operation: input.operation,
      rawInput: input.input.rawInput,
      interpretation,
      domainCommand
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
          aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(transition.value.aiTelemetry ?? [])]
        }
      }
    };
  }
  const resolution = await resolveNarrativeTurnV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: input.operation,
    rawInput: input.input.rawInput,
    interpretation,
    domainCommand,
    suspendedIntent,
    playableScene: input.activeScene
  });
  if (!resolution.ok) return resolution;
  const resolutionMs = Date.now() - resolutionStartedAt;
  const npcPerformanceStartedAt = Date.now();
  const npcPerformance = input.npcPerformerConfig === null
    ? null
    : await performNpcTurnV1({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      rawInput: input.input.rawInput,
      interpretation,
      mjPlan: planning?.plan ?? null,
      resolution: resolution.value.result,
      sceneState: resolution.value.sceneState,
      activeScene: resolution.value.playableScene,
      config: input.npcPerformerConfig
    });
  const npcPerformanceMs = Date.now() - npcPerformanceStartedAt;
  const displayPacket = applyNpcPerformanceToDisplayPacketV1({
    displayPacket: resolution.value.displayPacket,
    performance: npcPerformance?.performance ?? null,
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
        npcPerformanceFailure: npcPerformance?.performanceFailure as (NpcPerformanceFailureV1 & JsonObject) | null ?? null,
        suspendedIntent,
        pendingSkillCheck: buildPendingNarrativeSkillCheckV1({
          operationId: input.operation.operationId,
          sceneId: resolution.value.playableScene.sceneId,
          createdAt: input.createdAt,
          perception: resolution.value.result.perception
        }),
        resolution: resolution.value.result,
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
        aiTelemetry: [...(interpretationResult?.telemetry ?? []), ...(npcPerformance?.telemetry ?? [])]
      }
    }
  };
}

function buildSceneChangeControllerResult(input: {
  input: Parameters<typeof buildResolvedOutput>[0];
  interpretation: NarrativeIntentInterpretationV1 & JsonObject;
  domainCommand: NarrativeDomainCommandV1 | null;
  planning: { plan: (MjPlannerPayloadV1 & JsonObject) | null; planningFailure: MjPlanningFailureV1 | null } | null;
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
        aiTelemetry: [...(input.interpretationResult?.telemetry ?? []), ...(input.change.aiTelemetry ?? [])]
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
