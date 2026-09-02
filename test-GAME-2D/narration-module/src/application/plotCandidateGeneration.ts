import { computeJsonFingerprint, coreError, type CampaignId, type CampaignRepository, type JsonObject, type Result } from "../core";
import type { ContractAiProviderV1 } from "../ai/FakeContractAiProvider";
import { runAiPipelineCallV1 } from "../ai/pipeline";
import type {
  AiCallTelemetryV1,
  AiModelRouteV1,
  AiRetryPolicyV1,
  AiRoleOutputEnvelopeV1,
  CoherenceCriticPayloadV1
} from "../ai/types";
import {
  createPlotV1,
  PLOT_CREATE_COMMAND_V1,
  type CreatePlotResultV1,
  type PlotActorPerspectiveV1,
  type PlotCausalStepV1,
  type PlotClueDetailV1,
  type PlotStateV1
} from "./plotAuthority";
import type { PlayableSceneStateV1 } from "./playableScene";
import { prepareNarrativeRoleContextV1 } from "./narrativeContextManifest";

export const PLOT_CANDIDATE_CONTRACT_V1 = "plot-candidate/1" as const;

export interface PlotGenerationContextV1 extends JsonObject {
  schemaVersion: 1;
  sceneId: string;
  allowedLocationRefs: string[];
  allowedActorRefs: string[];
  allowedSourceRefs: string[];
  publicLoreFacts: Array<{ factRef: string; text: string; sourceRefs: string[] }>;
  worldSignals: Array<{ signalRef: string; summary: string; sourceRefs: string[] }>;
  createdAtGameSecond: number;
  complexity: "SIMPLE" | "STANDARD";
  version: 1;
}

export interface PlotCandidateClueV1 extends JsonObject {
  cluePathId: string;
  revelationId: string;
  independenceKey: string;
  publicSign: string;
  sceneId: string;
  presentation: "OBSERVATION" | "INFERENCE" | "TESTIMONY";
  actorRef: string | null;
  knowledgeChannelRef: string | null;
  sourceRefs: string[];
}

export interface PlotCandidateActorMotivationV1 extends JsonObject {
  motivationId: string;
  actorRef: string;
  motivation: string;
  supportsStepRefs: string[];
  sourceRefs: string[];
}

export interface PlotCandidateV1 extends JsonObject {
  candidateId: string;
  plotId: string;
  summary: string;
  hiddenTruth: { truthId: string; statement: string; groundingRefs: string[] };
  commitments: string[];
  causalTimeline: PlotCausalStepV1[];
  actorMotivations: PlotCandidateActorMotivationV1[];
  actorPerspectives: PlotActorPerspectiveV1[];
  requiredRevelations: Array<{ revelationId: string; label: string; requiredForResolution: boolean }>;
  clues: PlotCandidateClueV1[];
  falseLeads: Array<{ falseLeadId: string; claim: string; refutationCluePathIds: string[] }>;
  futureEvents: Array<{
    plotEventId: string;
    dueAtGameSecond: number;
    causedByRefs: string[];
    locationRef: string;
    privateOutcome: string;
    effects: Array<{
      effectId: string;
      visibility: "IMMEDIATELY_VISIBLE" | "INFERABLE" | "KNOWN_THROUGH_CHANNEL" | "HIDDEN" | "DEFERRED";
      sceneId: string | null;
      publicSign: string | null;
      knowledgeChannelRef: string | null;
      sourceRefs: string[];
    }>;
  }>;
  sourceRefs: string[];
}

export interface PlotCandidateGeneratorConfigV1 {
  provider: ContractAiProviderV1;
  route: AiModelRouteV1 & { role: "scene_creator" };
  coherenceCriticRoute: AiModelRouteV1 & { role: "coherence_critic" };
  retryPolicy: AiRetryPolicyV1 & { role: "scene_creator" };
}

export type PlotCandidateGenerationResultV1 =
  | { ok: true; candidate: PlotCandidateV1; plot: PlotStateV1; telemetry: AiCallTelemetryV1[] }
  | { ok: false; code: "AI_CANDIDATE_REJECTED" | "PLOT_CANDIDATE_INVALID"; issues: string[]; telemetry: AiCallTelemetryV1[] };

export function buildPlotGenerationContextFromSceneV1(input: {
  scene: PlayableSceneStateV1;
  createdAtGameSecond: number;
  knownLocationRefs?: string[];
  worldSignals?: PlotGenerationContextV1["worldSignals"];
  complexity?: PlotGenerationContextV1["complexity"];
}): PlotGenerationContextV1 {
  const sceneRef = `scene:${input.scene.sceneId}`;
  const actors = [...input.scene.presentNpc, ...input.scene.ambientPopulation];
  const actorRefs = actors.map(actor => actor.actorId);
  const actorSourceRefs = actorRefs.map(actorId => `actor:${actorId}`);
  const worldSignals = input.worldSignals ?? [];
  const publicLoreFacts = [
    ...input.scene.perceptibleSituation,
    ...input.scene.playerKnownFacts,
    input.scene.currentTension
  ].filter(value => value.trim().length > 0).map((text, index) => ({
    factRef: `scene-fact:${input.scene.sceneId}:${index + 1}`,
    text,
    sourceRefs: [sceneRef]
  }));
  return {
    schemaVersion: 1,
    sceneId: input.scene.sceneId,
    allowedLocationRefs: [...new Set([input.scene.sceneId, ...(input.knownLocationRefs ?? [])])],
    allowedActorRefs: [...new Set(actorRefs)],
    allowedSourceRefs: [...new Set([
      sceneRef,
      ...actorSourceRefs,
      ...worldSignals.flatMap(signal => signal.sourceRefs)
    ])],
    publicLoreFacts,
    worldSignals: worldSignals.map(signal => ({ ...signal, sourceRefs: [...signal.sourceRefs] })),
    createdAtGameSecond: input.createdAtGameSecond,
    complexity: input.complexity ?? "SIMPLE",
    version: 1
  };
}

export async function generatePlotCandidateV1(input: {
  campaignId: string;
  operationId: string;
  context: PlotGenerationContextV1;
  config: PlotCandidateGeneratorConfigV1;
}): Promise<PlotCandidateGenerationResultV1> {
  const context = {
    schemaVersion: 1,
    authority: "PROPOSE_ONLY",
    context: input.context,
    constraints: [
      "Créer une situation, jamais un ordre d'action pour le joueur.",
      "Utiliser uniquement les acteurs, lieux et sources fournis.",
      "Prévoir deux voies indépendantes pour chaque révélation indispensable.",
      "Distinguer vérité, croyance, erreur et mensonge par acteur.",
      "Donner à chaque acteur causal une motivation ancrée qui explique ses actes sans dicter ceux du joueur.",
      "Toute fausse piste doit citer au moins une voie de réfutation.",
      "Ne révéler la vérité cachée dans aucun signe public."
    ]
  };
  const task = { context, requiredOutput: PLOT_CANDIDATE_CONTRACT_V1 };
  const snapshotId = `${input.operationId}:snapshot:plot-candidate`;
  const preparedContext = prepareNarrativeRoleContextV1({
    manifestId: `${input.operationId}:context-manifest:plot-candidate`,
    operationId: input.operationId,
    campaignId: input.campaignId,
    snapshot: { snapshotId, campaignRevision: null, sceneId: null, sceneVersion: null },
    role: "scene_creator",
    profileId: `${input.operationId}:plot-candidate-creation`,
    purpose: "Proposer une intrigue depuis les seuls acteurs, lieux, signaux et sources autorisés.",
    taskContextRef: "task.context",
    authority: "PROPOSE_ONLY",
    projections: [{
      projectionKey: "creation-brief",
      kind: "CREATION_BRIEF",
      payload: context.context,
      ownerId: "application/plot-preparation",
      sourceRefs: input.context.allowedSourceRefs,
      sourceVersion: "plot-generation-context/1",
      required: true
    }, {
      projectionKey: "creation-policy",
      kind: "CREATION_POLICY",
      payload: context.constraints,
      ownerId: "application/plot-authority",
      sourceRefs: input.context.allowedSourceRefs,
      sourceVersion: "plot-creation-policy/1",
      required: true
    }]
  });
  const roleContextPack = preparedContext.roleContextPack;
  const request = {
    schemaVersion: 1 as const,
    callId: `${input.operationId}:ai:plot-candidate:call`,
    operationId: input.operationId,
    attemptId: `${input.operationId}:ai:plot-candidate:attempt:1`,
    campaignId: input.campaignId,
    snapshotId,
    packId: `${input.operationId}:pack:plot-candidate`,
    role: "scene_creator" as const,
    contractVersion: PLOT_CANDIDATE_CONTRACT_V1,
    modelRouteId: input.config.route.routeId,
    contextFingerprint: await computeJsonFingerprint({ contextManifest: preparedContext.manifest, task }) as `sha256:${string}`,
    idempotencyKey: `${input.operationId}:plot-candidate`,
    input: { instructionsRef: "scene-creator/plot-candidate/v1", roleContextPack, task },
    limits: {
      inputTokenBudget: input.config.route.inputTokenLimit,
      outputTokenBudget: Math.min(4_000, input.config.route.outputTokenLimit),
      timeoutMs: input.config.route.timeoutMs
    }
  };
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.route,
    retryPolicy: input.config.retryPolicy,
    request
  });
  if (run.acceptedOutput === null) {
    return { ok: false, code: "AI_CANDIDATE_REJECTED", issues: run.validation.issues, telemetry: run.telemetry };
  }
  const candidate = (run.acceptedOutput as AiRoleOutputEnvelopeV1<PlotCandidateV1>).payload;
  const built = buildPlotFromCandidateV1({ candidate, context: input.context });
  if (!built.ok) return { ok: false, code: "PLOT_CANDIDATE_INVALID", issues: built.issues, telemetry: run.telemetry };
  const critic = await auditPlotCandidateMotivationsV1({ ...input, candidate });
  const telemetry = [...run.telemetry, ...critic.telemetry];
  return critic.accepted
    ? { ok: true, candidate, plot: built.plot, telemetry }
    : { ok: false, code: "PLOT_CANDIDATE_INVALID", issues: critic.issues, telemetry };
}

export function buildPlotFromCandidateV1(input: {
  candidate: PlotCandidateV1;
  context: PlotGenerationContextV1;
}): { ok: true; plot: PlotStateV1 } | { ok: false; issues: string[] } {
  const issues = validatePlotCandidateV1(input.candidate, input.context);
  if (issues.length > 0) return { ok: false, issues };
  const candidate = input.candidate;
  const proposalRef = `plot-proposal:${candidate.candidateId}`;
  const clueDetails: PlotClueDetailV1[] = candidate.clues.map(clue => ({
    cluePathId: clue.cluePathId,
    effectId: `${candidate.plotId}:effect:${clue.cluePathId}`,
    publicSign: clue.publicSign,
    sceneId: clue.sceneId,
    presentation: clue.presentation,
    actorRef: clue.actorRef,
    knowledgeChannelRef: clue.knowledgeChannelRef,
    sourceRefs: [...clue.sourceRefs]
  }));
  const clueEvents = candidate.clues.map(clue => ({
    plotEventId: `${candidate.plotId}:clue:${clue.cluePathId}`,
    status: "SCHEDULED" as const,
    dueAtGameSecond: input.context.createdAtGameSecond,
    resolvedAtGameSecond: null,
    causedByRefs: [proposalRef, ...clue.sourceRefs],
    locationRef: clue.sceneId,
    privateOutcome: `La voie d'indice ${clue.cluePathId} devient accessible.`,
    effects: [{
      effectId: `${candidate.plotId}:effect:${clue.cluePathId}`,
      visibility: clue.presentation === "OBSERVATION"
        ? "IMMEDIATELY_VISIBLE" as const
        : clue.presentation === "INFERENCE"
          ? "INFERABLE" as const
          : "KNOWN_THROUGH_CHANNEL" as const,
      sceneId: clue.sceneId,
      publicSign: clue.publicSign,
      knowledgeChannelRef: clue.presentation === "TESTIMONY" ? clue.knowledgeChannelRef : null,
      sourceRefs: [...clue.sourceRefs],
      presentedAtGameSecond: null
    }]
  }));
  return {
    ok: true,
    plot: {
      schemaVersion: 1,
      plotId: candidate.plotId,
      status: "ACTIVE",
      hiddenTruth: {
        truthId: candidate.hiddenTruth.truthId,
        statement: candidate.hiddenTruth.statement,
        sourceRefs: [proposalRef, ...candidate.hiddenTruth.groundingRefs]
      },
      commitments: [...candidate.commitments],
      causalTimeline: candidate.causalTimeline.map(step => ({ ...step })),
      actorMotivations: candidate.actorMotivations.map(motivation => ({ ...motivation })),
      actorPerspectives: candidate.actorPerspectives.map(perspective => ({ ...perspective })),
      clueDetails,
      requiredRevelations: candidate.requiredRevelations.map(value => ({ ...value })),
      cluePaths: candidate.clues.map(clue => ({
        cluePathId: clue.cluePathId,
        revelationId: clue.revelationId,
        independenceKey: clue.independenceKey,
        status: "AVAILABLE" as const,
        sourceRefs: [...clue.sourceRefs]
      })),
      falseLeads: candidate.falseLeads.map(value => ({ ...value })),
      scheduledEvents: [
        ...clueEvents,
        ...candidate.futureEvents.map(event => ({
          ...event,
          status: "SCHEDULED" as const,
          resolvedAtGameSecond: null,
          effects: event.effects.map(effect => ({ ...effect, presentedAtGameSecond: null }))
        }))
      ],
      sourceRefs: [proposalRef, ...candidate.sourceRefs],
      createdAtGameSecond: input.context.createdAtGameSecond,
      version: 1
    }
  };
}

export async function generateAndCreatePlotV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: string;
  clientRequestId: string;
  context: PlotGenerationContextV1;
  config: PlotCandidateGeneratorConfigV1;
}): Promise<Result<{ creation: CreatePlotResultV1; candidate: PlotCandidateV1; telemetry: AiCallTelemetryV1[] }>> {
  const generated = await generatePlotCandidateV1(input);
  if (!generated.ok) {
    return { ok: false, error: coreError("VALIDATION_FAILED", generated.code, { issues: generated.issues }) };
  }
  const creation = await createPlotV1({
    repository: input.repository,
    campaignId: input.campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: PLOT_CREATE_COMMAND_V1,
      clientRequestId: input.clientRequestId,
      plot: generated.plot
    }
  });
  return creation.ok
    ? { ok: true, value: { creation: creation.value, candidate: generated.candidate, telemetry: generated.telemetry } }
    : creation;
}

export function validatePlotCandidateV1(candidate: PlotCandidateV1, context: PlotGenerationContextV1): string[] {
  const issues: string[] = [];
  const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
  const uniqueStrings = (values: unknown): values is string[] => Array.isArray(values)
    && values.length > 0 && values.every(nonEmpty) && new Set(values).size === values.length;
  if (!candidate || !nonEmpty(candidate.candidateId) || !nonEmpty(candidate.plotId) || !nonEmpty(candidate.summary)) issues.push("candidate identities and summary are required");
  if (!nonEmpty(candidate.hiddenTruth?.truthId) || !nonEmpty(candidate.hiddenTruth?.statement)) issues.push("hidden truth is required");
  if (!uniqueStrings(candidate.commitments)) issues.push("narrative commitments are required and must be unique");
  const allowedSources = new Set(context.allowedSourceRefs);
  const referencesAllowed = (refs: unknown) => uniqueStrings(refs) && refs.every(ref => allowedSources.has(ref));
  if (!referencesAllowed(candidate.sourceRefs) || !referencesAllowed(candidate.hiddenTruth?.groundingRefs)) issues.push("candidate grounding must use supplied public sources");
  const allowedActors = new Set(context.allowedActorRefs);
  const allowedLocations = new Set([context.sceneId, ...context.allowedLocationRefs]);
  const stepRefs = new Set<string>();
  const causalActors = new Set<string>();
  for (const step of candidate.causalTimeline ?? []) {
    if (!nonEmpty(step.stepId) || stepRefs.has(step.stepId)) issues.push(`causal step ${String(step.stepId)} is missing or duplicated`);
    const knownCauses = new Set([...context.allowedSourceRefs, ...stepRefs]);
    if (!uniqueStrings(step.causedByRefs) || step.causedByRefs.some(ref => !knownCauses.has(ref))) issues.push(`causal step ${step.stepId} has an unknown or circular cause`);
    if (!Array.isArray(step.actorRefs) || step.actorRefs.some(ref => !allowedActors.has(ref))) issues.push(`causal step ${step.stepId} uses an unknown actor`);
    if (!allowedLocations.has(step.locationRef)) issues.push(`causal step ${step.stepId} uses an unknown location`);
    if (!nonEmpty(step.privateOutcome) || !Number.isInteger(step.occurredAtGameSecond) || step.occurredAtGameSecond > context.createdAtGameSecond) issues.push(`causal step ${step.stepId} has an invalid outcome or time`);
    stepRefs.add(step.stepId);
    for (const actorRef of step.actorRefs) causalActors.add(actorRef);
  }
  if ((candidate.causalTimeline?.length ?? 0) === 0) issues.push("causal timeline is required");
  const motivatedActors = new Set<string>();
  const motivationIds = new Set<string>();
  for (const motivation of candidate.actorMotivations ?? []) {
    if (!nonEmpty(motivation.motivationId) || motivationIds.has(motivation.motivationId)) issues.push("actor motivation ids must be present and unique");
    if (!allowedActors.has(motivation.actorRef)) issues.push(`motivation ${motivation.motivationId} uses an unknown actor`);
    if (!nonEmpty(motivation.motivation)) issues.push(`motivation ${motivation.motivationId} is empty`);
    if (!uniqueStrings(motivation.supportsStepRefs) || motivation.supportsStepRefs.some(ref => !stepRefs.has(ref))) issues.push(`motivation ${motivation.motivationId} uses an unknown causal step`);
    if (motivation.supportsStepRefs.some(ref => !candidate.causalTimeline.some(step => step.stepId === ref && step.actorRefs.includes(motivation.actorRef)))) issues.push(`motivation ${motivation.motivationId} does not support an action by its actor`);
    if (!referencesAllowed(motivation.sourceRefs)) issues.push(`motivation ${motivation.motivationId} uses unsupported sources`);
    motivationIds.add(motivation.motivationId);
    motivatedActors.add(motivation.actorRef);
  }
  for (const actorRef of causalActors) if (!motivatedActors.has(actorRef)) issues.push(`causal actor ${actorRef} has no motivation`);
  const perspectiveIds = new Set<string>();
  for (const perspective of candidate.actorPerspectives ?? []) {
    if (!nonEmpty(perspective.perspectiveId) || perspectiveIds.has(perspective.perspectiveId)) issues.push("actor perspective ids must be present and unique");
    if (!allowedActors.has(perspective.actorRef)) issues.push(`perspective ${perspective.perspectiveId} uses an unknown actor`);
    if (!nonEmpty(perspective.claim) || !["KNOWS_TRUE", "BELIEVES_TRUE", "BELIEVES_FALSE", "KNOWS_FALSE", "LYING"].includes(perspective.epistemicStatus)) issues.push(`perspective ${perspective.perspectiveId} is invalid`);
    if (!["SUPPORTS", "CONTRADICTS", "PARTIAL", "UNRELATED"].includes(perspective.truthRelation) || !referencesAllowed(perspective.sourceRefs)) issues.push(`perspective ${perspective.perspectiveId} has invalid grounding`);
    perspectiveIds.add(perspective.perspectiveId);
  }
  if ((candidate.actorPerspectives?.length ?? 0) === 0) issues.push("at least one actor perspective is required");
  const clueIds = new Set<string>();
  for (const clue of candidate.clues ?? []) {
    if (!nonEmpty(clue.cluePathId) || clueIds.has(clue.cluePathId)) issues.push("clue ids must be present and unique");
    if (!nonEmpty(clue.revelationId) || !nonEmpty(clue.independenceKey) || !nonEmpty(clue.publicSign)) issues.push(`clue ${clue.cluePathId} is incomplete`);
    if (!allowedLocations.has(clue.sceneId)) issues.push(`clue ${clue.cluePathId} uses an unknown scene`);
    if (clue.actorRef !== null && !allowedActors.has(clue.actorRef)) issues.push(`clue ${clue.cluePathId} uses an unknown actor`);
    if (clue.presentation === "TESTIMONY" && (!nonEmpty(clue.knowledgeChannelRef) || clue.actorRef === null)) issues.push(`testimony ${clue.cluePathId} requires an actor and knowledge channel`);
    if (clue.presentation !== "TESTIMONY" && clue.knowledgeChannelRef !== null) issues.push(`clue ${clue.cluePathId} has an unexpected knowledge channel`);
    if (!referencesAllowed(clue.sourceRefs)) issues.push(`clue ${clue.cluePathId} uses unsupported sources`);
    if (normalize(clue.publicSign).includes(normalize(candidate.hiddenTruth?.statement ?? ""))) issues.push(`clue ${clue.cluePathId} reveals the hidden truth`);
    clueIds.add(clue.cluePathId);
  }
  for (const revelation of candidate.requiredRevelations ?? []) {
    const paths = candidate.clues.filter(clue => clue.revelationId === revelation.revelationId);
    if (!nonEmpty(revelation.revelationId) || !nonEmpty(revelation.label)) issues.push("required revelation is invalid");
    if (revelation.requiredForResolution && new Set(paths.map(path => path.independenceKey)).size < 2) issues.push(`revelation ${revelation.revelationId} requires two independent paths`);
  }
  if ((candidate.requiredRevelations?.length ?? 0) === 0) issues.push("at least one required revelation is required");
  for (const falseLead of candidate.falseLeads ?? []) {
    if (!nonEmpty(falseLead.falseLeadId) || !nonEmpty(falseLead.claim) || !uniqueStrings(falseLead.refutationCluePathIds) || falseLead.refutationCluePathIds.some(ref => !clueIds.has(ref))) issues.push(`false lead ${String(falseLead.falseLeadId)} has no valid refutation`);
  }
  if ((candidate.falseLeads?.length ?? 0) === 0) issues.push("at least one refutable false lead is required");
  for (const event of candidate.futureEvents ?? []) {
    if (!nonEmpty(event.plotEventId) || !Number.isInteger(event.dueAtGameSecond) || event.dueAtGameSecond < context.createdAtGameSecond) issues.push(`future event ${String(event.plotEventId)} has invalid identity or time`);
    const knownEventCauses = new Set([...context.allowedSourceRefs, ...stepRefs]);
    if (!allowedLocations.has(event.locationRef) || !nonEmpty(event.privateOutcome) || !uniqueStrings(event.causedByRefs) || event.causedByRefs.some(ref => !knownEventCauses.has(ref))) issues.push(`future event ${event.plotEventId} has invalid cause, location or outcome`);
    for (const effect of event.effects ?? []) {
      const visible = !["HIDDEN", "DEFERRED"].includes(effect.visibility);
      if (!nonEmpty(effect.effectId) || visible !== nonEmpty(effect.publicSign) || effect.sceneId !== null && !allowedLocations.has(effect.sceneId)) issues.push(`future effect ${String(effect.effectId)} is invalid`);
      if (effect.visibility === "KNOWN_THROUGH_CHANNEL" ? !nonEmpty(effect.knowledgeChannelRef) : effect.knowledgeChannelRef !== null) issues.push(`future effect ${effect.effectId} has an invalid channel`);
      if (!referencesAllowed(effect.sourceRefs)) issues.push(`future effect ${effect.effectId} uses unsupported sources`);
      if (effect.publicSign !== null && normalize(effect.publicSign).includes(normalize(candidate.hiddenTruth?.statement ?? ""))) issues.push(`future effect ${effect.effectId} reveals the hidden truth`);
    }
  }
  return [...new Set(issues)];
}

async function auditPlotCandidateMotivationsV1(input: {
  campaignId: string;
  operationId: string;
  context: PlotGenerationContextV1;
  candidate: PlotCandidateV1;
  config: PlotCandidateGeneratorConfigV1;
}): Promise<{ accepted: boolean; issues: string[]; telemetry: AiCallTelemetryV1[] }> {
  const criticEvidence = {
    schemaVersion: 1,
    authority: "PLOT_MOTIVATION_COHERENCE_ONLY",
    hiddenTruth: input.candidate.hiddenTruth,
    causalTimeline: input.candidate.causalTimeline,
    actorMotivations: input.candidate.actorMotivations,
    actorPerspectives: input.candidate.actorPerspectives,
    commitments: input.candidate.commitments
  };
  const task = { plotCandidateMotivationAudit: true, candidateId: input.candidate.candidateId, context: criticEvidence };
  const snapshotId = `${input.operationId}:snapshot:plot-motivation-critic`;
  const preparedContext = prepareNarrativeRoleContextV1({
    manifestId: `${input.operationId}:context-manifest:plot-motivation-critic`,
    operationId: input.operationId,
    campaignId: input.campaignId,
    snapshot: { snapshotId, campaignRevision: null, sceneId: null, sceneVersion: null },
    role: "coherence_critic",
    profileId: `${input.operationId}:plot-motivation-coherence-review`,
    purpose: "Comparer les motivations candidates aux étapes et perspectives attribuées.",
    taskContextRef: "task.context",
    authority: "PLOT_MOTIVATION_COHERENCE_ONLY",
    projections: [{
      projectionKey: "candidate-output",
      kind: "CANDIDATE_OUTPUT",
      payload: criticEvidence,
      ownerId: "application/plot-candidate-generation",
      sourceRefs: input.candidate.sourceRefs,
      sourceVersion: "plot-candidate/1",
      required: true
    }, {
      projectionKey: "coherence-invariants",
      kind: "COHERENCE_INVARIANTS",
      payload: { audit: "actor motivation causal coherence" },
      ownerId: "application/plot-authority",
      sourceRefs: [input.candidate.candidateId],
      sourceVersion: "plot-motivation-coherence/1",
      required: true
    }]
  });
  const roleContextPack = preparedContext.roleContextPack;
  const run = await runAiPipelineCallV1({
    provider: input.config.provider,
    route: input.config.coherenceCriticRoute,
    retryPolicy: { ...input.config.retryPolicy, role: "coherence_critic" },
    request: {
      schemaVersion: 1,
      callId: `${input.operationId}:ai:plot-motivation-critic:call`,
      operationId: input.operationId,
      attemptId: `${input.operationId}:ai:plot-motivation-critic:attempt:1`,
      campaignId: input.campaignId,
      snapshotId,
      packId: `${input.operationId}:pack:plot-motivation-critic`,
      role: "coherence_critic",
      contractVersion: "narrative-ai-resolution/1",
      modelRouteId: input.config.coherenceCriticRoute.routeId,
      contextFingerprint: await computeJsonFingerprint({ contextManifest: preparedContext.manifest, task }) as `sha256:${string}`,
      idempotencyKey: `${input.operationId}:plot-motivation-critic`,
      input: { instructionsRef: "coherence-critic/plot-motivation/v1", roleContextPack, task },
      limits: {
        inputTokenBudget: input.config.coherenceCriticRoute.inputTokenLimit,
        outputTokenBudget: Math.min(1_600, input.config.coherenceCriticRoute.outputTokenLimit),
        timeoutMs: input.config.coherenceCriticRoute.timeoutMs
      }
    }
  });
  const payload = run.acceptedOutput?.payload as CoherenceCriticPayloadV1 | undefined;
  const accepted = payload?.verdict === "PASS" && payload.findings.length === 0;
  return {
    accepted,
    issues: accepted ? [] : ["plot actor motivations failed semantic coherence audit", ...(payload?.findings.map(finding => finding.explanation) ?? run.validation.issues)],
    telemetry: run.telemetry
  };
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/gu, " ").trim();
}
