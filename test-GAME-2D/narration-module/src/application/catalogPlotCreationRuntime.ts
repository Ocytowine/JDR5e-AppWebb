import { computeJsonFingerprint, type CampaignId, type CampaignRepository, type OperationRecord, type Result } from "../core";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type { AiCallTelemetryV1, CoherenceCriticPayloadV1 } from "../ai/types";
import type { NarrativeIntentInterpretationV1 } from "./intentClarification";
import {
  createPlotV1,
  loadPlotRegistryV1,
  PLOT_CREATE_COMMAND_V1,
  PLOT_HYPOTHESIS_COMMAND_V1,
  PLOT_RESOLUTION_COMMAND_V1,
  recordPlotHypothesisV1,
  resolvePlotV1,
  type CreatePlotResultV1,
  type RecordPlotHypothesisResultV1,
  type ResolvePlotResultV1
} from "./plotAuthority";
import {
  buildPlotGenerationContextFromSceneV1,
  generatePlotCandidateV1,
  type PlotCandidateGeneratorConfigV1,
  type PlotGenerationContextV1
} from "./plotCandidateGeneration";
import type { PlayableSceneStateV1 } from "./playableScene";
import { prepareNarrativeRoleContextV1 } from "./narrativeContextManifest";

export interface NarrativePlotCreationRuntimeV1 {
  maybeCreateFromSearch(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    interpretation: NarrativeIntentInterpretationV1;
    activeScene: PlayableSceneStateV1;
  }): Promise<Result<{
    creation: CreatePlotResultV1 | null;
    telemetry: AiCallTelemetryV1[];
    skippedReason: "NOT_A_SEARCH" | "ACTIVE_PLOT_EXISTS" | "NO_ACTOR_CONTEXT" | "AI_PROPOSAL_REJECTED" | null;
  }>>;
  recordHypothesisFromTurn(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    playerActorRef: string;
    interpretation: NarrativeIntentInterpretationV1;
  }): Promise<Result<RecordPlotHypothesisResultV1 | null>>;
  resolveConclusionFromTurn(input: {
    repository: CampaignRepository;
    campaignId: CampaignId;
    operation: OperationRecord;
    rawInput: string;
    playerActorRef: string;
    interpretation: NarrativeIntentInterpretationV1;
  }): Promise<Result<{ resolution: ResolvePlotResultV1 | null; telemetry: AiCallTelemetryV1[] }>>;
}

export function createCatalogPlotCreationRuntimeV1(input: {
  generatorConfig: PlotCandidateGeneratorConfigV1;
  resolveContext?: (request: {
    scene: PlayableSceneStateV1;
    occurredAtGameSecond: number;
  }) => Promise<PlotGenerationContextV1> | PlotGenerationContextV1;
}): NarrativePlotCreationRuntimeV1 {
  return {
    async maybeCreateFromSearch(request) {
      const perception = request.interpretation.semanticIntent.perception;
      if (
        request.interpretation.semanticIntent.kind !== "observe_environment"
        || request.interpretation.semanticIntent.commitment !== "committed"
        || request.interpretation.requiresClarification
        || perception?.depth !== "SEARCH"
      ) return skipped("NOT_A_SEARCH");

      const loaded = await loadPlotRegistryV1(request.repository, request.campaignId);
      if (!loaded.ok) return loaded;
      if (loaded.value.state.plots.some(plot => plot.status === "ACTIVE")) return skipped("ACTIVE_PLOT_EXISTS");
      const actors = [...request.activeScene.presentNpc, ...request.activeScene.ambientPopulation];
      if (actors.length === 0) return skipped("NO_ACTOR_CONTEXT");
      const campaign = await request.repository.getCampaign(request.campaignId);
      if (!campaign.ok) return campaign;
      const clock = await request.repository.getAggregate(request.campaignId, "world.clock", campaign.value.clockAggregateId);
      if (!clock.ok) return clock;
      const occurredAtGameSecond = Number(clock.value.payload.elapsedGameSeconds);
      const context = input.resolveContext === undefined
        ? buildPlotGenerationContextFromSceneV1({
            scene: request.activeScene,
            createdAtGameSecond: occurredAtGameSecond,
            knownLocationRefs: [request.activeScene.sceneId],
            complexity: "SIMPLE"
          })
        : await input.resolveContext({ scene: request.activeScene, occurredAtGameSecond });
      const generated = await generatePlotCandidateV1({
        campaignId: request.campaignId,
        operationId: `${request.operation.operationId}:plot-search`,
        context,
        config: input.generatorConfig
      });
      if (!generated.ok) {
        return {
          ok: true,
          value: {
            creation: null,
            telemetry: generated.telemetry,
            skippedReason: "AI_PROPOSAL_REJECTED"
          }
        };
      }
      const creation = await createPlotV1({
        repository: request.repository,
        campaignId: request.campaignId,
        command: {
          schemaVersion: 1,
          contractVersion: PLOT_CREATE_COMMAND_V1,
          clientRequestId: `${request.operation.clientRequestId}:plot-create`,
          plot: generated.plot
        }
      });
      if (!creation.ok) return creation;
      return {
        ok: true,
        value: { creation: creation.value, telemetry: generated.telemetry, skippedReason: null }
      };
    },
    async recordHypothesisFromTurn(request) {
      const dialogue = request.interpretation.semanticIntent.dialogueAct;
      if (
        request.interpretation.semanticIntent.commitment !== "committed"
        || request.interpretation.requiresClarification
        || dialogue?.act !== "MAKE_STATEMENT"
        || !/\b(?:je\s+(?:pense|crois|suppose|soupconne|imagine)|j\s+en\s+conclus|mon\s+hypothese|ma\s+conclusion|selon\s+moi)\b/iu.test(normalize(request.rawInput))
      ) return { ok: true, value: null };
      const loaded = await loadPlotRegistryV1(request.repository, request.campaignId);
      if (!loaded.ok) return loaded;
      const active = loaded.value.state.plots.filter(plot => plot.status === "ACTIVE");
      if (active.length !== 1) return { ok: true, value: null };
      return recordPlotHypothesisV1({
        repository: request.repository,
        campaignId: request.campaignId,
        command: {
          schemaVersion: 1,
          contractVersion: PLOT_HYPOTHESIS_COMMAND_V1,
          clientRequestId: `${request.operation.clientRequestId}:plot-hypothesis`,
          plotId: active[0]!.plotId,
          hypothesisId: `hypothesis:${request.operation.operationId}`,
          statement: dialogue.contentGoal.trim() || request.rawInput.trim(),
          proposedByActorRef: request.playerActorRef,
          sourceRefs: [`narrative-operation:${request.operation.operationId}`]
        }
      });
    },
    async resolveConclusionFromTurn(request) {
      const dialogue = request.interpretation.semanticIntent.dialogueAct;
      if (
        request.interpretation.semanticIntent.commitment !== "committed"
        || request.interpretation.requiresClarification
        || dialogue?.act !== "MAKE_STATEMENT"
        || !/\b(?:j\s+en\s+conclus|ma\s+conclusion|j\s+ai\s+compris)\b/iu.test(normalize(request.rawInput))
      ) return { ok: true, value: { resolution: null, telemetry: [] } };
      const loaded = await loadPlotRegistryV1(request.repository, request.campaignId);
      if (!loaded.ok) return loaded;
      const active = loaded.value.state.plots.filter(plot => plot.status === "ACTIVE");
      if (active.length !== 1) return { ok: true, value: { resolution: null, telemetry: [] } };
      const plot = active[0]!;
      const hypotheses = Array.isArray(plot.playerHypotheses)
        ? plot.playerHypotheses as Array<{ hypothesisId: string; statement: string }>
        : [];
      const currentHypothesisId = `hypothesis:${request.operation.operationId}`;
      if (!hypotheses.some(value => value.hypothesisId === currentHypothesisId)) {
        return { ok: true, value: { resolution: null, telemetry: [] } };
      }
      const discoveries = Array.isArray(plot.discoveries)
        ? plot.discoveries as Array<{ cluePathId: string; statement: string; sourceRefs: string[] }>
        : [];
      const criticEvidence = {
        schemaVersion: 1,
        authority: "PLOT_RESOLUTION_COHERENCE_ONLY",
        hiddenTruth: plot.hiddenTruth,
        conclusion: dialogue.contentGoal.trim() || request.rawInput.trim(),
        discoveries,
        requiredRevelations: plot.requiredRevelations,
        falseLeads: plot.falseLeads
      };
      const task = { plotResolutionAudit: true, plotId: plot.plotId, context: criticEvidence };
      const snapshotId = `${request.operation.operationId}:snapshot:plot-resolution-critic`;
      const preparedContext = prepareNarrativeRoleContextV1({
        manifestId: `${request.operation.operationId}:context-manifest:plot-resolution-critic`,
        operationId: request.operation.operationId,
        campaignId: request.campaignId,
        snapshot: { snapshotId, campaignRevision: null, sceneId: null, sceneVersion: null },
        role: "coherence_critic",
        profileId: `${request.operation.operationId}:plot-resolution-coherence-review`,
        purpose: "Comparer la conclusion candidate aux preuves et réfutations acquises.",
        taskContextRef: "task.context",
        authority: "PLOT_RESOLUTION_COHERENCE_ONLY",
        projections: [{
          projectionKey: "candidate-output",
          kind: "CANDIDATE_OUTPUT",
          payload: criticEvidence.conclusion,
          ownerId: "application/player-plot-flow",
          sourceRefs: [currentHypothesisId],
          sourceVersion: "plot-player-hypothesis/1",
          required: true
        }, {
          projectionKey: "resolution-evidence",
          kind: "RESOLUTION_EVIDENCE",
          payload: criticEvidence,
          ownerId: "application/plot-authority",
          sourceRefs: [...plot.sourceRefs, ...discoveries.flatMap(discovery => discovery.sourceRefs)],
          sourceVersion: "plot-resolution-evidence/1",
          required: true
        }]
      });
      const roleContextPack = preparedContext.roleContextPack;
      const criticRun = await runAiPipelineCallV1({
        provider: input.generatorConfig.provider,
        route: input.generatorConfig.coherenceCriticRoute,
        retryPolicy: { ...input.generatorConfig.retryPolicy, role: "coherence_critic" },
        request: {
          schemaVersion: 1,
          callId: `${request.operation.operationId}:ai:plot-resolution-critic:call`,
          operationId: request.operation.operationId,
          attemptId: `${request.operation.operationId}:ai:plot-resolution-critic:attempt:1`,
          campaignId: request.campaignId,
          snapshotId,
          packId: `${request.operation.operationId}:pack:plot-resolution-critic`,
          role: "coherence_critic",
          contractVersion: "narrative-ai-resolution/1",
          modelRouteId: input.generatorConfig.coherenceCriticRoute.routeId,
          contextFingerprint: await computeJsonFingerprint({ contextManifest: preparedContext.manifest, task }) as `sha256:${string}`,
          idempotencyKey: `${request.operation.operationId}:plot-resolution-critic`,
          input: { instructionsRef: "coherence-critic/plot-resolution/v1", roleContextPack, task },
          limits: {
            inputTokenBudget: input.generatorConfig.coherenceCriticRoute.inputTokenLimit,
            outputTokenBudget: Math.min(1_600, input.generatorConfig.coherenceCriticRoute.outputTokenLimit),
            timeoutMs: input.generatorConfig.coherenceCriticRoute.timeoutMs
          }
        }
      });
      const verdict = criticRun.acceptedOutput?.payload as CoherenceCriticPayloadV1 | undefined;
      if (verdict?.verdict !== "PASS" || verdict.findings.length > 0) {
        return { ok: true, value: { resolution: null, telemetry: criticRun.telemetry } };
      }
      const falseClaims = plot.falseLeads.map(value => normalizeClaim(value.claim));
      const refutedHypothesisIds = hypotheses
        .filter(value => value.hypothesisId !== currentHypothesisId && falseClaims.some(claim => claimsOverlap(claim, normalizeClaim(value.statement))))
        .map(value => value.hypothesisId);
      const resolved = await resolvePlotV1({
        repository: request.repository,
        campaignId: request.campaignId,
        command: {
          schemaVersion: 1,
          contractVersion: PLOT_RESOLUTION_COMMAND_V1,
          clientRequestId: `${request.operation.clientRequestId}:plot-resolution`,
          plotId: plot.plotId,
          resolutionId: `resolution:${request.operation.operationId}`,
          conclusion: dialogue.contentGoal.trim() || request.rawInput.trim(),
          evidenceCluePathIds: [...new Set(discoveries.map(value => value.cluePathId))],
          resolvedByActorRef: request.playerActorRef,
          supportedHypothesisIds: [currentHypothesisId],
          refutedHypothesisIds,
          sourceRefs: [`narrative-operation:${request.operation.operationId}`, ...discoveries.flatMap(value => value.sourceRefs)]
        }
      });
      return resolved.ok
        ? { ok: true, value: { resolution: resolved.value, telemetry: criticRun.telemetry } }
        : resolved;
    }
  };
}

function skipped(reason: "NOT_A_SEARCH" | "ACTIVE_PLOT_EXISTS" | "NO_ACTOR_CONTEXT"): Result<{
  creation: null;
  telemetry: AiCallTelemetryV1[];
  skippedReason: typeof reason;
}> {
  return { ok: true, value: { creation: null, telemetry: [], skippedReason: reason } };
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’']/gu, " ");
}

function normalizeClaim(value: string): string {
  return normalize(value).replace(/[^a-z0-9\s]/gu, " ").replace(/\s+/gu, " ").trim();
}

function claimsOverlap(left: string, right: string): boolean {
  return left.length > 0 && right.length > 0 && (left.includes(right) || right.includes(left));
}
