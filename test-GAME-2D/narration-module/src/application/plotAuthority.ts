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
      const scheduledEvents = plot.scheduledEvents.map(event => ({
        ...event,
        effects: event.effects.map(effect => {
          const effectRef = `plot-effect:${plot.plotId}:${event.plotEventId}:${effect.effectId}`;
          if (!revealed.has(effectRef)) return effect;
          changed = true;
          return { ...effect, presentedAtGameSecond: now };
        })
      }));
      return changed ? { ...plot, scheduledEvents, version: plot.version + 1 } : plot;
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
