import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";

export const PLOT_REGISTRY_CONTRACT_V1 = "plot-registry/1" as const;
export const PLOT_CREATE_COMMAND_V1 = "plot-create/1" as const;
export const PLOT_EVOLUTION_CONTRACT_V1 = "plot-evolution/1" as const;
export const PLOT_SCENE_REVEAL_CONTRACT_V1 = "plot-scene-reveal/1" as const;
export const PLOT_HYPOTHESIS_COMMAND_V1 = "plot-hypothesis/1" as const;
export const PLOT_RESOLUTION_COMMAND_V1 = "plot-resolution/1" as const;
export const SCENE_EVENT_BUNDLE_CONTRACT_V1 = "scene-event-bundle/1" as const;
export const PLOT_REGISTRY_AGGREGATE_TYPE_V1 = "narrative.plot-registry" as const;

export type PlotEffectVisibilityV1 =
  | "IMMEDIATELY_VISIBLE"
  | "INFERABLE"
  | "KNOWN_THROUGH_CHANNEL"
  | "HIDDEN"
  | "DEFERRED";

export interface PlotHiddenTruthV1 extends JsonObject {
  truthId: string;
  statement: string;
  sourceRefs: string[];
}

export interface PlotCluePathV1 extends JsonObject {
  cluePathId: string;
  revelationId: string;
  independenceKey: string;
  status: "AVAILABLE" | "CLOSED";
  sourceRefs: string[];
}

export interface PlotRequiredRevelationV1 extends JsonObject {
  revelationId: string;
  label: string;
  requiredForResolution: boolean;
}

export interface PlotFalseLeadV1 extends JsonObject {
  falseLeadId: string;
  claim: string;
  refutationCluePathIds: string[];
}

export interface PlotCausalStepV1 extends JsonObject {
  stepId: string;
  causedByRefs: string[];
  actorRefs: string[];
  locationRef: string;
  privateOutcome: string;
  occurredAtGameSecond: number;
}

export interface PlotActorPerspectiveV1 extends JsonObject {
  perspectiveId: string;
  actorRef: string;
  claim: string;
  epistemicStatus: "KNOWS_TRUE" | "BELIEVES_TRUE" | "BELIEVES_FALSE" | "KNOWS_FALSE" | "LYING";
  truthRelation: "SUPPORTS" | "CONTRADICTS" | "PARTIAL" | "UNRELATED";
  sourceRefs: string[];
}

export interface PlotClueDetailV1 extends JsonObject {
  cluePathId: string;
  effectId: string;
  publicSign: string;
  sceneId: string;
  presentation: "OBSERVATION" | "INFERENCE" | "TESTIMONY";
  actorRef: string | null;
  knowledgeChannelRef: string | null;
  sourceRefs: string[];
}

export interface PlotDiscoveryV1 extends JsonObject {
  discoveryId: string;
  cluePathId: string;
  presentation: "OBSERVATION" | "INFERENCE" | "TESTIMONY";
  statement: string;
  sourceRefs: string[];
  discoveredAtGameSecond: number;
}

export interface PlotPlayerHypothesisV1 extends JsonObject {
  hypothesisId: string;
  statement: string;
  proposedByActorRef: string;
  status: "UNCONFIRMED" | "SUPPORTED" | "REFUTED";
  sourceRefs: string[];
  recordedAtGameSecond: number;
}

export interface PlotResolutionV1 extends JsonObject {
  resolutionId: string;
  conclusion: string;
  evidenceCluePathIds: string[];
  resolvedByActorRef: string;
  sourceRefs: string[];
  resolvedAtGameSecond: number;
}

export interface PlotScheduledEffectV1 extends JsonObject {
  effectId: string;
  visibility: PlotEffectVisibilityV1;
  sceneId: string | null;
  publicSign: string | null;
  knowledgeChannelRef: string | null;
  sourceRefs: string[];
  presentedAtGameSecond: number | null;
}

export interface PlotScheduledEventV1 extends JsonObject {
  plotEventId: string;
  status: "SCHEDULED" | "RESOLVED" | "CANCELLED";
  dueAtGameSecond: number;
  resolvedAtGameSecond: number | null;
  causedByRefs: string[];
  locationRef: string;
  privateOutcome: string;
  effects: PlotScheduledEffectV1[];
}

export interface PlotStateV1 extends JsonObject {
  schemaVersion: 1;
  plotId: string;
  status: "ACTIVE" | "RESOLVED" | "CANCELLED";
  hiddenTruth: PlotHiddenTruthV1;
  commitments: string[];
  requiredRevelations: PlotRequiredRevelationV1[];
  cluePaths: PlotCluePathV1[];
  falseLeads: PlotFalseLeadV1[];
  scheduledEvents: PlotScheduledEventV1[];
  sourceRefs: string[];
  createdAtGameSecond: number;
  version: number;
}

export interface PlotRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLOT_REGISTRY_CONTRACT_V1;
  campaignId: string;
  plots: PlotStateV1[];
  version: number;
}

export interface CreatePlotCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLOT_CREATE_COMMAND_V1;
  clientRequestId: string;
  plot: PlotStateV1;
}

export interface CreatePlotResultV1 extends JsonObject {
  schemaVersion: 1;
  plotId: string;
  commitId: string;
  replayed: boolean;
}

export interface EvolveDuePlotsCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLOT_EVOLUTION_CONTRACT_V1;
  clientRequestId: string;
}

export interface PlotEvolutionResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "EVOLVED" | "NOTHING_DUE";
  occurredAtGameSecond: number;
  resolvedEventRefs: string[];
  commitId: string | null;
  replayed: boolean;
}

export interface RevealPlotSceneCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLOT_SCENE_REVEAL_CONTRACT_V1;
  clientRequestId: string;
  sceneId: string;
  playerKnowledgeRefs: string[];
}

export interface RecordPlotHypothesisCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLOT_HYPOTHESIS_COMMAND_V1;
  clientRequestId: string;
  plotId: string;
  hypothesisId: string;
  statement: string;
  proposedByActorRef: string;
  sourceRefs: string[];
}

export interface RecordPlotHypothesisResultV1 extends JsonObject {
  schemaVersion: 1;
  plotId: string;
  hypothesis: PlotPlayerHypothesisV1;
  commitId: string;
  replayed: boolean;
}

export interface ResolvePlotCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLOT_RESOLUTION_COMMAND_V1;
  clientRequestId: string;
  plotId: string;
  resolutionId: string;
  conclusion: string;
  evidenceCluePathIds: string[];
  resolvedByActorRef: string;
  supportedHypothesisIds: string[];
  refutedHypothesisIds: string[];
  sourceRefs: string[];
}

export interface ResolvePlotResultV1 extends JsonObject {
  schemaVersion: 1;
  plotId: string;
  resolution: PlotResolutionV1;
  commitId: string;
  replayed: boolean;
}

export interface PlotSceneRevealResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "REVEALED" | "CLEAR";
  bundle: SceneEventBundleV1;
  commitId: string | null;
  operationId: string;
  replayed: boolean;
}

export interface SceneEventPerceptionV1 extends JsonObject {
  effectRef: string;
  eventRef: string;
  sourceOperationId: string | null;
  sourceKind: "PLOT" | "WORLD_SIMULATION";
  effectiveAtGameSecond: number;
  causalOrder: string;
  presentation: "OBSERVATION" | "INFERENCE" | "KNOWLEDGE";
  text: string;
  sourceRefs: string[];
  interruptsPlayer: boolean;
}

export interface SceneEventBundleV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_EVENT_BUNDLE_CONTRACT_V1;
  sceneId: string;
  throughGameSecond: number;
  perceptions: SceneEventPerceptionV1[];
  excludedEffectCount: number;
  controlDecision: "RETURN_CONTROL" | "INTERRUPT_FOR_PLAYER_DECISION";
  version: 1;
}

export function plotRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-plot-registry:${campaignId}`);
}

export function createEmptyPlotRegistryV1(campaignId: string): PlotRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: PLOT_REGISTRY_CONTRACT_V1,
    campaignId,
    plots: [],
    version: 1
  };
}

export async function loadPlotRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: PlotRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    PLOT_REGISTRY_AGGREGATE_TYPE_V1,
    plotRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: createEmptyPlotRegistryV1(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<PlotRegistryV1>;
  return state.contractVersion === PLOT_REGISTRY_CONTRACT_V1
    && state.campaignId === campaignId
    && Array.isArray(state.plots)
    ? { ok: true, value: { aggregate: aggregate.value, state: state as PlotRegistryV1 } }
    : invalid("plot.registry-invalid", ["plot registry payload is invalid"]);
}

export async function createPlotV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: CreatePlotCommandV1;
}): Promise<Result<CreatePlotResultV1>> {
  const issues = validatePlot(input.command);
  if (issues.length > 0) return invalid("plot.create-invalid", issues);
  const operationId = opaqueId<OperationId>(`plot-create:${input.command.clientRequestId}`);
  const existing = await restoreOrConflict<CreatePlotResultV1>({
    repository: input.repository,
    operationId,
    operationKind: "plot.create",
    payload: input.command
  });
  if (existing !== null) return existing;
  const loaded = await loadPlotRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  if (loaded.value.state.plots.some(plot => plot.plotId === input.command.plot.plotId)) {
    return invalid("plot.create-duplicate", [`plot ${input.command.plot.plotId} already exists`]);
  }
  const next: PlotRegistryV1 = {
    ...loaded.value.state,
    plots: [...loaded.value.state.plots, cloneJson(input.command.plot) as PlotStateV1]
      .sort((left, right) => left.plotId.localeCompare(right.plotId)),
    version: loaded.value.state.version + 1
  };
  const started = await beginOperation(input.repository, input.campaignId, operationId, input.command.clientRequestId, "plot.create", input.command);
  if (!started.ok) return started;
  const committed = await commitPlotRegistry({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry: next,
    commandType: "plot.create",
    commandPayload: {
      plotId: input.command.plot.plotId,
      truthId: input.command.plot.hiddenTruth.truthId,
      scheduledEventCount: input.command.plot.scheduledEvents.length
    },
    occurredAtGameSecond: input.command.plot.createdAtGameSecond,
    events: [{
      eventId: opaqueId<EventId>(`${operationId}:private-created`),
      eventType: "plot.created",
      origin: "RULE",
      visibility: { scope: "MJ_PRIVATE", actorIds: [] },
      causation: { kind: "COMMAND", id: `${operationId}:command` },
      payload: {
        plotId: input.command.plot.plotId,
        truthRef: `plot-truth:${input.command.plot.hiddenTruth.truthId}`,
        commitmentCount: input.command.plot.commitments.length,
        cluePathCount: input.command.plot.cluePaths.length
      }
    }]
  });
  if (!committed.ok) return committed;
  const result: CreatePlotResultV1 = {
    schemaVersion: 1,
    plotId: input.command.plot.plotId,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function evolveDuePlotsV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: EvolveDuePlotsCommandV1;
}): Promise<Result<PlotEvolutionResultV1>> {
  if (
    input.command.schemaVersion !== 1
    || input.command.contractVersion !== PLOT_EVOLUTION_CONTRACT_V1
    || !nonEmpty(input.command.clientRequestId)
  ) return invalid("plot.evolution-invalid", ["invalid evolution command"]);
  const operationId = opaqueId<OperationId>(`plot-evolve:${input.command.clientRequestId}`);
  const existing = await restoreOrConflict<PlotEvolutionResultV1>({
    repository: input.repository,
    operationId,
    operationKind: "plot.evolve-due",
    payload: input.command
  });
  if (existing !== null) return existing;
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const clock = await input.repository.getAggregate(
    input.campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!clock.ok) return clock;
  const now = (clock.value.payload as CampaignClockPayload).elapsedGameSeconds;
  const loaded = await loadPlotRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const due = loaded.value.state.plots.flatMap(plot => plot.status !== "ACTIVE"
    ? []
    : plot.scheduledEvents
      .filter(event => event.status === "SCHEDULED" && event.dueAtGameSecond <= now)
      .map(event => ({ plotId: plot.plotId, event })))
    .sort((left, right) =>
      left.event.dueAtGameSecond - right.event.dueAtGameSecond
      || left.plotId.localeCompare(right.plotId)
      || left.event.plotEventId.localeCompare(right.event.plotEventId)
    );
  const started = await beginOperation(
    input.repository,
    input.campaignId,
    operationId,
    input.command.clientRequestId,
    "plot.evolve-due",
    input.command,
    due.length > 0
  );
  if (!started.ok) return started;
  if (due.length === 0) {
    const result: PlotEvolutionResultV1 = {
      schemaVersion: 1,
      status: "NOTHING_DUE",
      occurredAtGameSecond: now,
      resolvedEventRefs: [],
      commitId: null,
      replayed: false
    };
    const completed = await input.repository.completeWithoutCommit(operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }
  const dueKeys = new Set(due.map(value => `${value.plotId}:${value.event.plotEventId}`));
  const next: PlotRegistryV1 = {
    ...loaded.value.state,
    plots: loaded.value.state.plots.map(plot => ({
      ...plot,
      scheduledEvents: plot.scheduledEvents.map(event =>
        dueKeys.has(`${plot.plotId}:${event.plotEventId}`)
          ? { ...event, status: "RESOLVED" as const, resolvedAtGameSecond: now }
          : event
      ),
      version: due.some(value => value.plotId === plot.plotId) ? plot.version + 1 : plot.version
    })),
    version: loaded.value.state.version + 1
  };
  const committed = await commitPlotRegistry({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry: next,
    commandType: "plot.evolve-due",
    commandPayload: {
      throughGameSecond: now,
      resolvedEventRefs: due.map(value => `plot-event:${value.plotId}:${value.event.plotEventId}`)
    },
    occurredAtGameSecond: now,
    events: due.map(({ plotId, event }) => ({
      eventId: opaqueId<EventId>(`${operationId}:${normalizeId(plotId)}:${normalizeId(event.plotEventId)}`),
      eventType: "plot.scheduled-event.resolved",
      origin: "SCHEDULED_EFFECT",
      visibility: { scope: "MJ_PRIVATE", actorIds: [] },
      causation: { kind: "COMMAND", id: `${operationId}:command` },
      payload: {
        plotId,
        plotEventId: event.plotEventId,
        locationRef: event.locationRef,
        effectCount: event.effects.length,
        causedByRefs: [...event.causedByRefs]
      }
    }))
  });
  if (!committed.ok) return committed;
  const result: PlotEvolutionResultV1 = {
    schemaVersion: 1,
    status: "EVOLVED",
    occurredAtGameSecond: now,
    resolvedEventRefs: due.map(value => `plot-event:${value.plotId}:${value.event.plotEventId}`),
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export function composeSceneEventBundleV1(input: {
  registry: PlotRegistryV1;
  sceneId: string;
  throughGameSecond: number;
  playerKnowledgeRefs: string[];
}): SceneEventBundleV1 {
  const knowledge = new Set(input.playerKnowledgeRefs);
  const perceptions: SceneEventPerceptionV1[] = [];
  let excludedEffectCount = 0;
  for (const plot of input.registry.plots) {
    for (const event of plot.scheduledEvents) {
      if (event.status !== "RESOLVED" || event.resolvedAtGameSecond === null || event.resolvedAtGameSecond > input.throughGameSecond) continue;
      for (const effect of event.effects) {
        const inScene = effect.sceneId === input.sceneId;
        const knownThroughChannel = effect.visibility === "KNOWN_THROUGH_CHANNEL"
          && effect.knowledgeChannelRef !== null
          && knowledge.has(effect.knowledgeChannelRef);
        if (
          effect.publicSign === null
          || effect.visibility === "HIDDEN"
          || effect.visibility === "DEFERRED"
          || (!inScene && !knownThroughChannel)
          || (effect.visibility === "KNOWN_THROUGH_CHANNEL" && !knownThroughChannel)
        ) {
          excludedEffectCount += 1;
          continue;
        }
        perceptions.push({
          effectRef: `plot-effect:${plot.plotId}:${event.plotEventId}:${effect.effectId}`,
          eventRef: `plot-event:${plot.plotId}:${event.plotEventId}`,
          sourceOperationId: null,
          sourceKind: "PLOT",
          effectiveAtGameSecond: event.resolvedAtGameSecond,
          causalOrder: `plot:${plot.plotId}:${event.plotEventId}:${effect.effectId}`,
          presentation: effect.visibility === "INFERABLE"
            ? "INFERENCE"
            : effect.visibility === "KNOWN_THROUGH_CHANNEL"
              ? "KNOWLEDGE"
              : "OBSERVATION",
          text: effect.publicSign,
          sourceRefs: [
            `plot-event:${plot.plotId}:${event.plotEventId}`,
            `plot-effect:${plot.plotId}:${event.plotEventId}:${effect.effectId}`
          ],
          interruptsPlayer: false
        });
      }
    }
  }
  perceptions.sort((left, right) => left.effectRef.localeCompare(right.effectRef));
  return {
    schemaVersion: 1,
    contractVersion: SCENE_EVENT_BUNDLE_CONTRACT_V1,
    sceneId: input.sceneId,
    throughGameSecond: input.throughGameSecond,
    perceptions,
    excludedEffectCount,
    controlDecision: "RETURN_CONTROL",
    version: 1
  };
}

export async function revealPlotEffectsInSceneV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: RevealPlotSceneCommandV1;
}): Promise<Result<PlotSceneRevealResultV1>> {
  if (
    input.command.schemaVersion !== 1
    || input.command.contractVersion !== PLOT_SCENE_REVEAL_CONTRACT_V1
    || !nonEmpty(input.command.clientRequestId)
    || !nonEmpty(input.command.sceneId)
    || !Array.isArray(input.command.playerKnowledgeRefs)
    || input.command.playerKnowledgeRefs.some(ref => !nonEmpty(ref))
  ) return invalid("plot.scene-reveal-invalid", ["invalid scene reveal command"]);
  const operationId = opaqueId<OperationId>(`plot-scene-reveal:${input.command.clientRequestId}`);
  const existing = await restoreOrConflict<PlotSceneRevealResultV1>({
    repository: input.repository,
    operationId,
    operationKind: "plot.scene-reveal",
    payload: input.command
  });
  if (existing !== null) return existing;
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const clock = await input.repository.getAggregate(
    input.campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!clock.ok) return clock;
  const now = (clock.value.payload as CampaignClockPayload).elapsedGameSeconds;
  const loaded = await loadPlotRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const unpresentedRegistry: PlotRegistryV1 = {
    ...loaded.value.state,
    plots: loaded.value.state.plots.map(plot => ({
      ...plot,
      scheduledEvents: plot.scheduledEvents.map(event => ({
        ...event,
        effects: event.effects.filter(effect => effect.presentedAtGameSecond === null)
      }))
    }))
  };
  const composedBundle = composeSceneEventBundleV1({
    registry: unpresentedRegistry,
    sceneId: input.command.sceneId,
    throughGameSecond: now,
    playerKnowledgeRefs: input.command.playerKnowledgeRefs
  });
  const bundle: SceneEventBundleV1 = {
    ...composedBundle,
    perceptions: composedBundle.perceptions.map(perception => ({
      ...perception,
      sourceOperationId: operationId
    }))
  };
  const started = await beginOperation(
    input.repository,
    input.campaignId,
    operationId,
    input.command.clientRequestId,
    "plot.scene-reveal",
    input.command,
    bundle.perceptions.length > 0
  );
  if (!started.ok) return started;
  if (bundle.perceptions.length === 0) {
    const clear: PlotSceneRevealResultV1 = {
      schemaVersion: 1,
      status: "CLEAR",
      bundle,
      commitId: null,
      operationId,
      replayed: false
    };
    const completed = await input.repository.completeWithoutCommit(operationId, 1, clear);
    return completed.ok ? { ok: true, value: clear } : completed;
  }
  const revealed = new Set(bundle.perceptions.map(perception => perception.effectRef));
  const next: PlotRegistryV1 = {
    ...loaded.value.state,
    plots: loaded.value.state.plots.map(plot => {
      let changed = false;
      const discoveries = readPlotDiscoveriesV1(plot);
      const clueDetails = readPlotClueDetailsV1(plot);
      const scheduledEvents = plot.scheduledEvents.map(event => ({
        ...event,
        effects: event.effects.map(effect => {
          const effectRef = `plot-effect:${plot.plotId}:${event.plotEventId}:${effect.effectId}`;
          if (!revealed.has(effectRef)) return effect;
          changed = true;
          const clue = clueDetails.find(value => value.effectId === effect.effectId);
          if (clue !== undefined && !discoveries.some(value => value.cluePathId === clue.cluePathId)) {
            discoveries.push({
              discoveryId: `plot-discovery:${plot.plotId}:${clue.cluePathId}`,
              cluePathId: clue.cluePathId,
              presentation: clue.presentation,
              statement: clue.publicSign,
              sourceRefs: [effectRef, ...clue.sourceRefs],
              discoveredAtGameSecond: now
            });
          }
          return { ...effect, presentedAtGameSecond: now };
        })
      }));
      return changed ? { ...plot, scheduledEvents, discoveries, version: plot.version + 1 } : plot;
    }),
    version: loaded.value.state.version + 1
  };
  const committed = await commitPlotRegistry({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry: next,
    commandType: "plot.scene-reveal",
    commandPayload: {
      sceneId: input.command.sceneId,
      effectRefs: bundle.perceptions.map(value => value.effectRef)
    },
    occurredAtGameSecond: now,
    events: [{
      eventId: opaqueId<EventId>(`${operationId}:event`),
      eventType: "plot.scene-effects.revealed",
      origin: "RULE",
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      causation: { kind: "COMMAND", id: `${operationId}:command` },
      payload: {
        sceneId: input.command.sceneId,
        perceptions: cloneJson(bundle.perceptions)
      }
    }]
  });
  if (!committed.ok) return committed;
  const result: PlotSceneRevealResultV1 = {
    schemaVersion: 1,
    status: "REVEALED",
    bundle,
    commitId: committed.value.commitId,
    operationId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function recordPlotHypothesisV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: RecordPlotHypothesisCommandV1;
}): Promise<Result<RecordPlotHypothesisResultV1>> {
  if (
    input.command.schemaVersion !== 1
    || input.command.contractVersion !== PLOT_HYPOTHESIS_COMMAND_V1
    || ![input.command.clientRequestId, input.command.plotId, input.command.hypothesisId, input.command.statement, input.command.proposedByActorRef]
      .every(nonEmpty)
    || !validRefs(input.command.sourceRefs)
  ) return invalid("plot.hypothesis-invalid", ["invalid plot hypothesis command"]);
  const operationId = opaqueId<OperationId>(`plot-hypothesis:${input.command.clientRequestId}`);
  const existing = await restoreOrConflict<RecordPlotHypothesisResultV1>({
    repository: input.repository,
    operationId,
    operationKind: "plot.hypothesis",
    payload: input.command
  });
  if (existing !== null) return existing;
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const clock = await input.repository.getAggregate(input.campaignId, "world.clock", campaign.value.clockAggregateId);
  if (!clock.ok) return clock;
  const now = (clock.value.payload as CampaignClockPayload).elapsedGameSeconds;
  const loaded = await loadPlotRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const plotIndex = loaded.value.state.plots.findIndex(plot => plot.plotId === input.command.plotId && plot.status === "ACTIVE");
  if (plotIndex < 0) return invalid("plot.hypothesis-plot-not-active", ["hypothesis requires an active plot"]);
  const current = loaded.value.state.plots[plotIndex]!;
  const hypotheses = readPlotHypothesesV1(current);
  if (hypotheses.some(value => value.hypothesisId === input.command.hypothesisId)) {
    return invalid("plot.hypothesis-duplicate", ["hypothesis id already exists"]);
  }
  const hypothesis: PlotPlayerHypothesisV1 = {
    hypothesisId: input.command.hypothesisId,
    statement: input.command.statement.trim(),
    proposedByActorRef: input.command.proposedByActorRef,
    status: "UNCONFIRMED",
    sourceRefs: [...new Set(input.command.sourceRefs)],
    recordedAtGameSecond: now
  };
  const plots = [...loaded.value.state.plots];
  plots[plotIndex] = { ...current, playerHypotheses: [...hypotheses, hypothesis], version: current.version + 1 };
  const started = await beginOperation(
    input.repository,
    input.campaignId,
    operationId,
    input.command.clientRequestId,
    "plot.hypothesis",
    input.command
  );
  if (!started.ok) return started;
  const committed = await commitPlotRegistry({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry: { ...loaded.value.state, plots, version: loaded.value.state.version + 1 },
    commandType: "plot.hypothesis",
    commandPayload: { plotId: current.plotId, hypothesisId: hypothesis.hypothesisId },
    occurredAtGameSecond: now,
    events: [{
      eventId: opaqueId<EventId>(`${operationId}:event`),
      eventType: "plot.player-hypothesis.recorded",
      origin: "PLAYER_INTENT",
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      causation: { kind: "COMMAND", id: `${operationId}:command` },
      payload: {
        plotId: current.plotId,
        hypothesisId: hypothesis.hypothesisId,
        statement: hypothesis.statement,
        status: hypothesis.status,
        sourceRefs: hypothesis.sourceRefs
      }
    }]
  });
  if (!committed.ok) return committed;
  const result: RecordPlotHypothesisResultV1 = {
    schemaVersion: 1,
    plotId: current.plotId,
    hypothesis,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function resolvePlotV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ResolvePlotCommandV1;
}): Promise<Result<ResolvePlotResultV1>> {
  const command = input.command;
  if (
    command.schemaVersion !== 1
    || command.contractVersion !== PLOT_RESOLUTION_COMMAND_V1
    || ![command.clientRequestId, command.plotId, command.resolutionId, command.conclusion, command.resolvedByActorRef].every(nonEmpty)
    || !validRefs(command.evidenceCluePathIds)
    || !validRefs(command.sourceRefs)
    || !Array.isArray(command.supportedHypothesisIds)
    || !Array.isArray(command.refutedHypothesisIds)
  ) return invalid("plot.resolution-invalid", ["invalid plot resolution command"]);
  const operationId = opaqueId<OperationId>(`plot-resolution:${command.clientRequestId}`);
  const existing = await restoreOrConflict<ResolvePlotResultV1>({
    repository: input.repository,
    operationId,
    operationKind: "plot.resolution",
    payload: command
  });
  if (existing !== null) return existing;
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const clock = await input.repository.getAggregate(input.campaignId, "world.clock", campaign.value.clockAggregateId);
  if (!clock.ok) return clock;
  const now = (clock.value.payload as CampaignClockPayload).elapsedGameSeconds;
  const loaded = await loadPlotRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const plotIndex = loaded.value.state.plots.findIndex(plot => plot.plotId === command.plotId && plot.status === "ACTIVE");
  if (plotIndex < 0) return invalid("plot.resolution-plot-not-active", ["resolution requires an active plot"]);
  const current = loaded.value.state.plots[plotIndex]!;
  const discoveries = readPlotDiscoveriesV1(current);
  const discoveredPaths = new Set(discoveries.map(discovery => discovery.cluePathId));
  if (command.evidenceCluePathIds.some(ref => !discoveredPaths.has(ref))) {
    return invalid("plot.resolution-evidence-not-discovered", ["resolution evidence must already be discovered"]);
  }
  for (const revelation of current.requiredRevelations.filter(value => value.requiredForResolution)) {
    const independent = new Set(current.cluePaths
      .filter(path => path.revelationId === revelation.revelationId && command.evidenceCluePathIds.includes(path.cluePathId))
      .map(path => path.independenceKey));
    if (independent.size < 2) return invalid("plot.resolution-insufficient-evidence", [`revelation ${revelation.revelationId} requires two independent discovered paths`]);
  }
  for (const falseLead of current.falseLeads) {
    if (!falseLead.refutationCluePathIds.some(ref => command.evidenceCluePathIds.includes(ref))) {
      return invalid("plot.resolution-false-lead-not-refuted", [`false lead ${falseLead.falseLeadId} still lacks discovered refutation evidence`]);
    }
  }
  const hypotheses = readPlotHypothesesV1(current);
  const knownHypothesisIds = new Set(hypotheses.map(value => value.hypothesisId));
  const classified = [...command.supportedHypothesisIds, ...command.refutedHypothesisIds];
  if (new Set(classified).size !== classified.length || classified.some(id => !knownHypothesisIds.has(id))) {
    return invalid("plot.resolution-hypothesis-invalid", ["resolution hypothesis classification is invalid"]);
  }
  const supported = new Set(command.supportedHypothesisIds);
  const refuted = new Set(command.refutedHypothesisIds);
  const resolution: PlotResolutionV1 = {
    resolutionId: command.resolutionId,
    conclusion: command.conclusion.trim(),
    evidenceCluePathIds: [...new Set(command.evidenceCluePathIds)],
    resolvedByActorRef: command.resolvedByActorRef,
    sourceRefs: [...new Set(command.sourceRefs)],
    resolvedAtGameSecond: now
  };
  const plots = [...loaded.value.state.plots];
  plots[plotIndex] = {
    ...current,
    status: "RESOLVED",
    resolution,
    playerHypotheses: hypotheses.map(hypothesis => supported.has(hypothesis.hypothesisId)
      ? { ...hypothesis, status: "SUPPORTED" as const }
      : refuted.has(hypothesis.hypothesisId)
        ? { ...hypothesis, status: "REFUTED" as const }
        : hypothesis),
    version: current.version + 1
  };
  const started = await beginOperation(input.repository, input.campaignId, operationId, command.clientRequestId, "plot.resolution", command);
  if (!started.ok) return started;
  const committed = await commitPlotRegistry({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry: { ...loaded.value.state, plots, version: loaded.value.state.version + 1 },
    commandType: "plot.resolution",
    commandPayload: { plotId: current.plotId, resolutionId: resolution.resolutionId },
    occurredAtGameSecond: now,
    events: [{
      eventId: opaqueId<EventId>(`${operationId}:event`),
      eventType: "plot.resolved",
      origin: "PLAYER_INTENT",
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      causation: { kind: "COMMAND", id: `${operationId}:command` },
      payload: {
        plotId: current.plotId,
        resolutionId: resolution.resolutionId,
        conclusion: resolution.conclusion,
        evidenceCluePathIds: resolution.evidenceCluePathIds,
        sourceRefs: resolution.sourceRefs
      }
    }]
  });
  if (!committed.ok) return committed;
  const result: ResolvePlotResultV1 = { schemaVersion: 1, plotId: current.plotId, resolution, commitId: committed.value.commitId, replayed: false };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

function readPlotDiscoveriesV1(plot: PlotStateV1): PlotDiscoveryV1[] {
  const value = plot.discoveries;
  return Array.isArray(value)
    ? value.filter(entry => entry !== null && typeof entry === "object").map(entry => cloneJson(entry) as PlotDiscoveryV1)
    : [];
}

function readPlotClueDetailsV1(plot: PlotStateV1): PlotClueDetailV1[] {
  const value = plot.clueDetails;
  return Array.isArray(value)
    ? value.filter(entry => entry !== null && typeof entry === "object").map(entry => entry as PlotClueDetailV1)
    : [];
}

function readPlotHypothesesV1(plot: PlotStateV1): PlotPlayerHypothesisV1[] {
  const value = plot.playerHypotheses;
  return Array.isArray(value)
    ? value.filter(entry => entry !== null && typeof entry === "object").map(entry => cloneJson(entry) as PlotPlayerHypothesisV1)
    : [];
}

function validatePlot(command: CreatePlotCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== PLOT_CREATE_COMMAND_V1) issues.push("plot create contract mismatch");
  if (!nonEmpty(command.clientRequestId)) issues.push("clientRequestId is required");
  const plot = command.plot;
  if (!plot || plot.schemaVersion !== 1 || !nonEmpty(plot.plotId)) return [...issues, "plot is required"];
  if (!["ACTIVE", "RESOLVED", "CANCELLED"].includes(plot.status)) issues.push("plot status is invalid");
  if (!nonEmpty(plot.hiddenTruth?.truthId) || !nonEmpty(plot.hiddenTruth?.statement) || !validRefs(plot.hiddenTruth?.sourceRefs)) issues.push("hidden truth is invalid");
  if (!validRefs(plot.commitments) || !validRefs(plot.sourceRefs)) issues.push("commitments and plot sources are required");
  if (!gameSecond(plot.createdAtGameSecond)) issues.push("createdAtGameSecond is invalid");
  const pathIds = new Set(plot.cluePaths.map(path => path.cluePathId));
  for (const revelation of plot.requiredRevelations) {
    const independent = new Set(plot.cluePaths
      .filter(path => path.revelationId === revelation.revelationId && path.status === "AVAILABLE")
      .map(path => path.independenceKey));
    if (revelation.requiredForResolution && independent.size < 2) {
      issues.push(`revelation ${revelation.revelationId} requires two independent clue paths`);
    }
  }
  for (const falseLead of plot.falseLeads) {
    if (!nonEmpty(falseLead.falseLeadId) || !nonEmpty(falseLead.claim) || falseLead.refutationCluePathIds.length === 0 || falseLead.refutationCluePathIds.some(id => !pathIds.has(id))) {
      issues.push(`false lead ${falseLead.falseLeadId || "<missing>"} has no valid refutation path`);
    }
  }
  for (const event of plot.scheduledEvents) {
    if (
      !nonEmpty(event.plotEventId)
      || event.status !== "SCHEDULED"
      || !gameSecond(event.dueAtGameSecond)
      || event.dueAtGameSecond < plot.createdAtGameSecond
      || event.resolvedAtGameSecond !== null
      || !validRefs(event.causedByRefs)
      || !nonEmpty(event.locationRef)
      || !nonEmpty(event.privateOutcome)
    ) issues.push(`scheduled event ${event.plotEventId || "<missing>"} is invalid`);
    for (const effect of event.effects) {
      const visible = effect.visibility !== "HIDDEN" && effect.visibility !== "DEFERRED";
      if (
        !nonEmpty(effect.effectId)
        || !["IMMEDIATELY_VISIBLE", "INFERABLE", "KNOWN_THROUGH_CHANNEL", "HIDDEN", "DEFERRED"].includes(effect.visibility)
        || (visible && !nonEmpty(effect.publicSign))
        || (!visible && effect.publicSign !== null)
        || (effect.visibility === "KNOWN_THROUGH_CHANNEL" && !nonEmpty(effect.knowledgeChannelRef))
        || (effect.visibility !== "KNOWN_THROUGH_CHANNEL" && effect.knowledgeChannelRef !== null)
        || (effect.presentedAtGameSecond !== null && !gameSecond(effect.presentedAtGameSecond))
        || !validRefs(effect.sourceRefs)
      ) issues.push(`effect ${effect.effectId || "<missing>"} is invalid`);
      if (
        effect.publicSign !== null
        && normalizeText(effect.publicSign).includes(normalizeText(plot.hiddenTruth.statement))
      ) issues.push(`effect ${effect.effectId} leaks the hidden truth`);
    }
  }
  return issues;
}

async function restoreOrConflict<T extends JsonObject>(input: {
  repository: CampaignRepository;
  operationId: OperationId;
  operationKind: string;
  payload: JsonObject;
}): Promise<Result<T> | null> {
  const fingerprint = await computeRequestFingerprint(input.operationKind, 1, input.payload);
  const existing = await input.repository.getOperation(input.operationId);
  if (!existing.ok) return existing.error.code === "NOT_FOUND" ? null : existing;
  if (existing.value.requestFingerprint !== fingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "plot.operation-request-conflict") };
  }
  if (existing.value.phase !== "COMPLETED" || existing.value.resultPayload === null) {
    return invalid("plot.operation-incomplete", ["operation already exists and is incomplete"]);
  }
  return { ok: true, value: { ...(existing.value.resultPayload as T), replayed: true } };
}

async function beginOperation(
  repository: CampaignRepository,
  campaignId: CampaignId,
  operationId: OperationId,
  clientRequestId: string,
  operationKind: string,
  payload: JsonObject,
  readyToCommit = true
): Promise<Result<OperationRecord>> {
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  const received = await repository.receiveOperation({
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>(clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(operationId),
    requestFingerprint: await computeRequestFingerprint(operationKind, 1, payload),
    operationKind,
    requestPayloadSchemaVersion: 1,
    requestPayload: cloneJson(payload),
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  });
  if (!received.ok || !readyToCommit) return received;
  const preparing = await repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  return preparing.ok
    ? repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT")
    : preparing;
}

async function commitPlotRegistry(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  currentAggregate: AggregateRecord | null;
  nextRegistry: PlotRegistryV1;
  commandType: string;
  commandPayload: JsonObject;
  occurredAtGameSecond: number;
  events: Array<{
    eventId: EventId;
    eventType: string;
    origin: EventDraft["origin"];
    visibility: EventDraft["visibility"];
    causation: EventDraft["causation"];
    payload: JsonObject;
  }>;
}): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const aggregateId = plotRegistryAggregateIdV1(input.campaignId);
    const nextRevision = input.currentAggregate === null ? 0 : input.currentAggregate.aggregateRevision + 1;
    const commandId = opaqueId<CommandId>(`${input.operation.operationId}:command`);
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "plot-authority",
      contractVersion: 1,
      commandId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: input.commandType,
      target: {
        aggregateType: PLOT_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: input.commandPayload,
      acceptedAtGameSecond: input.occurredAtGameSecond
    };
    const events: EventDraft[] = input.events.map(event => ({
      schemaVersion: 1,
      eventId: event.eventId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: event.eventType,
      origin: event.origin,
      causation: event.causation.kind === "COMMAND"
        ? { kind: "COMMAND", id: commandId }
        : event.causation,
      aggregateRefs: [{
        aggregateType: PLOT_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        aggregateRevision: nextRevision
      }],
      visibility: event.visibility,
      occurredAtGameSecond: input.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: event.payload
    }));
    const request: CommitRequest = {
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: PLOT_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextRegistry)
      }],
      events,
      outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validRefs(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmpty);
}

function gameSecond(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function normalizeText(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr").replace(/\s+/gu, " ").trim();
}

function normalizeId(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/[^a-zA-Z0-9_-]+/gu, "-");
}
