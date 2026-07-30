import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type EventDraft,
  type EventId,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  planNextTemporalBatchV1,
  prepareTemporalSegmentCommitV1,
  nextWorldSimulationBoundaryV1,
  scheduledEffectToTaskV1,
  validateWorldSimulationCursorPayloadV1,
  validateWorldSchedulePayloadV1,
  type ScheduledEffectV1,
  type WorldSchedulePayloadV1
} from "../time";
import {
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  bastionRegistryAggregateIdV1,
  loadBastionRegistryV1,
  type BastionInstallationV1,
  type BastionRecordV1,
  type BastionRegistryV1,
  type BastionWorkOrderV1
} from "./bastionAuthority";

export const BASTION_WORK_ORDER_CONTRACT_V1 = "bastion-work-order/1" as const;
export const BASTION_WORK_CATALOG_CONTRACT_V1 = "bastion-work-catalog/1" as const;

export interface BastionWorkPrerequisiteV1 extends JsonObject {
  schemaVersion: 1;
  prerequisiteRef: string;
  quantity: number;
  unit: string;
}

export interface BastionWorkDefinitionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_WORK_CATALOG_CONTRACT_V1;
  workDefinitionRef: string;
  displayName: string;
  durationSeconds: number;
  prerequisites: BastionWorkPrerequisiteV1[];
  effect: {
    schemaVersion: 1;
    kind: "ADD_INSTALLATION";
    installationDefinitionRef: string;
    installationDisplayName: string;
  };
  completionNarrative: string;
}

export interface BastionWorkCatalogV1 {
  readonly catalogRef: string;
  resolve(workDefinitionRef: string):
    | BastionWorkDefinitionV1
    | null
    | Promise<BastionWorkDefinitionV1 | null>;
}

export interface BastionWorkPrerequisiteDecisionV1 extends JsonObject {
  schemaVersion: 1;
  authorized: boolean;
  reasonCode: string;
  proofRefs: string[];
}

export interface BastionWorkPrerequisiteAuthorityV1 {
  readonly authorityRef: string;
  authorize(input: {
    campaign: CampaignRecord;
    bastion: BastionRecordV1;
    workDefinition: BastionWorkDefinitionV1;
  }):
    | BastionWorkPrerequisiteDecisionV1
    | Promise<BastionWorkPrerequisiteDecisionV1>;
}

export interface StartBastionWorkCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_WORK_ORDER_CONTRACT_V1;
  clientRequestId: string;
  bastionId: string;
  workDefinitionRef: string;
}

export interface CompleteBastionWorkCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_WORK_ORDER_CONTRACT_V1;
  clientRequestId: string;
  bastionId: string;
  workOrderId: string;
  requestedThroughGameSecond: number;
}

export interface BastionWorkCompletionSummaryV1 extends JsonObject {
  schemaVersion: 1;
  bastionId: string;
  placeRef: string;
  placeDisplayName: string;
  workOrderId: string;
  workDefinitionRef: string;
  installationId: string;
  installationDefinitionRef: string;
  installationDisplayName: string;
  completedAtGameSecond: number;
  narrative: string;
}

export interface BastionWorkStartResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "BLOCKED_BY_PREREQUISITE" | "SCHEDULED";
  reasonCode: string;
  workOrder: BastionWorkOrderV1 | null;
  commitId: string | null;
  replayed: boolean;
}

export interface BastionWorkCompletionResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "NOT_DUE" | "COMPLETED";
  reasonCode: string;
  workOrder: BastionWorkOrderV1 | null;
  installation: BastionInstallationV1 | null;
  publicSummary: BastionWorkCompletionSummaryV1 | null;
  commitId: string | null;
  replayed: boolean;
}

export function bastionWorkScheduleAggregateIdV1(
  campaignId: string,
  bastionId: string
): AggregateId {
  return opaqueId<AggregateId>(`bastion-work-schedule:${campaignId}:${bastionId}`);
}

export async function startBastionWorkV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: StartBastionWorkCommandV1;
  catalog: BastionWorkCatalogV1 | null;
  prerequisiteAuthority: BastionWorkPrerequisiteAuthorityV1 | null;
}): Promise<Result<BastionWorkStartResultV1>> {
  const commandIssues = validateStartCommand(input.command);
  if (commandIssues.length > 0) return invalid("bastion.work-start-command-invalid", commandIssues);
  if (input.catalog === null || !nonEmpty(input.catalog.catalogRef)) {
    return invalid("bastion.work-catalog-required", ["an explicit work catalog is required"]);
  }
  const operationId = opaqueId<OperationId>(`bastion-work-start:${input.command.clientRequestId}`);
  const requestFingerprint = await computeRequestFingerprint("bastion.work-start", 1, input.command);
  const replay = await restoreStartIfCompleted(input.repository, operationId, requestFingerprint);
  if (replay !== null) return replay;

  const definition = await input.catalog.resolve(input.command.workDefinitionRef);
  if (definition === null) {
    return invalid("bastion.work-definition-not-found", ["the selected work is absent from the injected catalog"]);
  }
  const definitionIssues = validateDefinition(definition, input.command.workDefinitionRef);
  if (definitionIssues.length > 0) {
    return invalid("bastion.work-definition-invalid", definitionIssues);
  }
  const [campaign, registry, clock] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    loadBastionRegistryV1(input.repository, input.campaignId),
    loadCampaignClock(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!registry.ok) return registry;
  if (!clock.ok) return clock;
  const bastion = registry.value.state.bastions.find(value => value.bastionId === input.command.bastionId);
  if (bastion === undefined || bastion.status !== "ACTIVE") {
    return invalid("bastion.work-target-unavailable", ["the selected active bastion does not exist"]);
  }
  if (bastion.workOrders.some(order => order.status === "SCHEDULED")) {
    return invalid("bastion.active-work-order-exists", [
      "the minimal vertical permits one active work order per bastion"
    ]);
  }
  if (bastion.installations.some(value =>
    value.installationDefinitionRef === definition.effect.installationDefinitionRef
  )) {
    return invalid("bastion.installation-already-present", ["the catalogued installation is already present"]);
  }

  let proofRefs: string[] = [];
  if (definition.prerequisites.length > 0) {
    if (input.prerequisiteAuthority === null || !nonEmpty(input.prerequisiteAuthority.authorityRef)) {
      return blockedStart({
        repository: input.repository,
        campaignId: input.campaignId,
        operationId,
        requestFingerprint,
        command: input.command,
        reasonCode: "PREREQUISITE_AUTHORITY_UNAVAILABLE"
      });
    }
    const decision = await input.prerequisiteAuthority.authorize({
      campaign: campaign.value,
      bastion: cloneJson(bastion),
      workDefinition: cloneJson(definition)
    });
    const decisionIssues = validatePrerequisiteDecision(decision, true);
    if (decisionIssues.length > 0) {
      return invalid("bastion.prerequisite-decision-invalid", decisionIssues);
    }
    if (!decision.authorized) {
      return blockedStart({
        repository: input.repository,
        campaignId: input.campaignId,
        operationId,
        requestFingerprint,
        command: input.command,
        reasonCode: decision.reasonCode
      });
    }
    proofRefs = [...new Set(decision.proofRefs)].sort();
  }

  const currentGameSecond = Number(clock.value.payload.elapsedGameSeconds);
  if (!nonNegativeInteger(currentGameSecond)) {
    return invalid("bastion.campaign-clock-invalid", ["elapsedGameSeconds must be a non-negative integer"]);
  }
  const workOrderId = `bastion-work-order:${input.command.clientRequestId}`;
  const scheduledEffectId = `bastion-work-effect:${workOrderId}`;
  const dueAtGameSecond = currentGameSecond + definition.durationSeconds;
  const order: BastionWorkOrderV1 = {
    schemaVersion: 1,
    workOrderId,
    workDefinitionRef: definition.workDefinitionRef,
    workDisplayName: definition.displayName,
    catalogRef: input.catalog.catalogRef,
    status: "SCHEDULED",
    scheduledEffectId,
    prerequisiteProofRefs: proofRefs,
    installationDefinitionRef: definition.effect.installationDefinitionRef,
    installationDisplayName: definition.effect.installationDisplayName,
    completionNarrative: definition.completionNarrative,
    startedAtGameSecond: currentGameSecond,
    dueAtGameSecond,
    completedAtGameSecond: null,
    version: 1
  };
  const startedEventId = opaqueId<EventId>(`${operationId}:bastion-work-started`);
  const effect: ScheduledEffectV1 = {
    schemaVersion: 1,
    effectId: scheduledEffectId,
    campaignId: input.campaignId,
    ownerDomain: "BASTION",
    effectType: "BASTION_WORK_COMPLETION",
    dueAtGameSecond,
    boundaryPolicy: "SIMULTANEOUS",
    dependsOnEffectIds: [],
    causedByEventIds: [startedEventId],
    status: "SCHEDULED",
    payloadSchemaVersion: 1,
    payload: {
      bastionId: bastion.bastionId,
      workOrderId,
      workDefinitionRef: definition.workDefinitionRef
    }
  };
  const scheduleAggregateId = bastionWorkScheduleAggregateIdV1(input.campaignId, bastion.bastionId);
  const schedule = await loadOptionalAggregate(
    input.repository,
    input.campaignId,
    "world.schedule",
    scheduleAggregateId
  );
  if (!schedule.ok) return schedule;
  const currentSchedule: Result<WorldSchedulePayloadV1> = schedule.value === null
    ? { ok: true, value: { schemaVersion: 1, effects: [] } }
    : validateSchedule(schedule.value);
  if (!currentSchedule.ok) return currentSchedule;
  const nextSchedule: WorldSchedulePayloadV1 = {
    schemaVersion: 1,
    effects: [...currentSchedule.value.effects, effect]
  };
  const validatedNextSchedule = validateWorldSchedulePayloadV1(nextSchedule);
  if (!validatedNextSchedule.ok) {
    return invalid("bastion.work-schedule-invalid", validatedNextSchedule.diagnostics.map(value => value.path));
  }
  const nextBastion: BastionRecordV1 = {
    ...bastion,
    workOrders: [...bastion.workOrders, order],
    version: bastion.version + 1
  };
  const nextRegistry = replaceBastion(registry.value.state, nextBastion);
  const operation = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    requestFingerprint,
    operationKind: "bastion.work-start",
    payload: input.command
  });
  if (!operation.ok) return operation;
  const committed = await commitWorkStart({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: operation.value,
    registryAggregate: registry.value.aggregate!,
    nextRegistry,
    scheduleAggregate: schedule.value,
    scheduleAggregateId,
    nextSchedule: validatedNextSchedule.value,
    order,
    eventId: startedEventId
  });
  if (!committed.ok) return committed;
  const result: BastionWorkStartResultV1 = {
    schemaVersion: 1,
    status: "SCHEDULED",
    reasonCode: "WORK_ORDER_SCHEDULED",
    workOrder: order,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function completeBastionWorkV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: CompleteBastionWorkCommandV1;
  simulationCursorAggregateId: AggregateId;
}): Promise<Result<BastionWorkCompletionResultV1>> {
  const issues = validateCompletionCommand(input.command);
  if (issues.length > 0) return invalid("bastion.work-completion-command-invalid", issues);
  if (!nonEmpty(input.simulationCursorAggregateId)) {
    return invalid("bastion.temporal-authority-required", ["simulation cursor aggregate id is required"]);
  }
  const operationId = opaqueId<OperationId>(`bastion-work-completion:${input.command.clientRequestId}`);
  const requestFingerprint = await computeRequestFingerprint("bastion.work-completion", 1, input.command);
  const replay = await restoreCompletionIfCompleted(input.repository, operationId, requestFingerprint);
  if (replay !== null) return replay;

  const [campaign, registry, clock] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    loadBastionRegistryV1(input.repository, input.campaignId),
    loadCampaignClock(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!registry.ok) return registry;
  if (!clock.ok) return clock;
  const bastion = registry.value.state.bastions.find(value => value.bastionId === input.command.bastionId);
  const order = bastion?.workOrders.find(value => value.workOrderId === input.command.workOrderId);
  if (bastion === undefined || order === undefined || order.status !== "SCHEDULED") {
    return invalid("bastion.work-order-not-scheduled", ["the selected scheduled work order does not exist"]);
  }
  const currentGameSecond = Number(clock.value.payload.elapsedGameSeconds);
  if (input.command.requestedThroughGameSecond < order.dueAtGameSecond) {
    const operation = await beginOperation({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId,
      clientRequestId: input.command.clientRequestId,
      requestFingerprint,
      operationKind: "bastion.work-completion",
      payload: input.command
    });
    if (!operation.ok) return operation;
    const result: BastionWorkCompletionResultV1 = {
      schemaVersion: 1,
      status: "NOT_DUE",
      reasonCode: "WORK_ORDER_NOT_DUE",
      workOrder: cloneJson(order),
      installation: null,
      publicSummary: null,
      commitId: null,
      replayed: false
    };
    const completed = await input.repository.completeWithoutCommit(operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }
  if (!nonNegativeInteger(currentGameSecond) || currentGameSecond > order.dueAtGameSecond) {
    return invalid("bastion.work-temporal-boundary-invalid", [
      "work completion must be resolved at its due boundary"
    ]);
  }
  const scheduleAggregateId = bastionWorkScheduleAggregateIdV1(input.campaignId, bastion.bastionId);
  const [schedule, cursor] = await Promise.all([
    loadOptionalAggregate(input.repository, input.campaignId, "world.schedule", scheduleAggregateId),
    loadOptionalAggregate(input.repository, input.campaignId, "world.simulation-cursor", input.simulationCursorAggregateId)
  ]);
  if (!schedule.ok) return schedule;
  if (!cursor.ok) return cursor;
  if (schedule.value === null) {
    return invalid("bastion.work-schedule-missing", ["the committed work schedule is missing"]);
  }
  const scheduleState = validateSchedule(schedule.value);
  if (!scheduleState.ok) return scheduleState;
  const simulationCursor = cursor.value === null
    ? {
        schemaVersion: 1 as const,
        worldSimulatedThrough: 0,
        tick: 0,
        microTick: 0,
        macroTick: 0,
        secondsPerMicroTick: 3_600,
        microPerMacro: 6
      }
    : validateWorldSimulationCursorPayloadV1(cursor.value.payload);
  if ("ok" in simulationCursor && !simulationCursor.ok) {
    return temporalInvalid(
      "bastion.world-simulation-cursor-invalid",
      simulationCursor.diagnostics
    );
  }
  const validatedCursor = "ok" in simulationCursor
    ? simulationCursor.value
    : simulationCursor;
  const nextSimulationBoundary = nextWorldSimulationBoundaryV1({
    worldSimulatedThrough: validatedCursor.worldSimulatedThrough,
    requestedTargetGameSecond: order.dueAtGameSecond,
    secondsPerMicroTick: validatedCursor.secondsPerMicroTick
  });
  if (!nextSimulationBoundary.ok) {
    return temporalInvalid(
      "bastion.world-simulation-boundary-invalid",
      nextSimulationBoundary.diagnostics
    );
  }
  if (nextSimulationBoundary.value !== null) {
    return invalid("bastion.world-simulation-boundary-required", [
      `world simulation must resolve campaign second ${nextSimulationBoundary.value} before bastion work completion`
    ]);
  }
  const effect = scheduleState.value.effects.find(value => value.effectId === order.scheduledEffectId);
  if (effect === undefined || effect.status !== "SCHEDULED" || effect.dueAtGameSecond !== order.dueAtGameSecond) {
    return invalid("bastion.work-effect-invalid", ["the scheduled effect does not match the work order"]);
  }
  const task = scheduledEffectToTaskV1(effect, currentGameSecond);
  if (!task.ok) return temporalInvalid("bastion.work-task-invalid", task.diagnostics);
  const batch = await planNextTemporalBatchV1({
    batchId: `${operationId}:batch`,
    currentGameSecond,
    requestedTargetGameSecond: input.command.requestedThroughGameSecond,
    tasks: [task.value]
  });
  if (!batch.ok) return temporalInvalid("bastion.work-batch-invalid", batch.diagnostics);
  if (batch.value === null || batch.value.effectiveAtGameSecond !== order.dueAtGameSecond) {
    return invalid("bastion.work-boundary-not-selected", ["the work due boundary was not selected"]);
  }
  const completedOrder: BastionWorkOrderV1 = {
    ...order,
    status: "COMPLETED",
    completedAtGameSecond: order.dueAtGameSecond,
    version: order.version + 1
  };
  const installation: BastionInstallationV1 = {
    schemaVersion: 1,
    installationId: `bastion-installation:${bastion.bastionId}:${order.installationDefinitionRef}`,
    installationDefinitionRef: order.installationDefinitionRef,
    displayName: order.installationDisplayName,
    status: "ACTIVE",
    sourceWorkOrderId: order.workOrderId,
    installedAtGameSecond: order.dueAtGameSecond,
    version: 1
  };
  const summary: BastionWorkCompletionSummaryV1 = {
    schemaVersion: 1,
    bastionId: bastion.bastionId,
    placeRef: bastion.placeRef,
    placeDisplayName: bastion.placeDisplayName,
    workOrderId: order.workOrderId,
    workDefinitionRef: order.workDefinitionRef,
    installationId: installation.installationId,
    installationDefinitionRef: installation.installationDefinitionRef,
    installationDisplayName: installation.displayName,
    completedAtGameSecond: order.dueAtGameSecond,
    narrative: order.completionNarrative
  };
  const nextBastion: BastionRecordV1 = {
    ...bastion,
    installations: [...bastion.installations, installation],
    workOrders: bastion.workOrders.map(value =>
      value.workOrderId === completedOrder.workOrderId ? completedOrder : value
    ),
    version: bastion.version + 1
  };
  const nextRegistry = replaceBastion(registry.value.state, nextBastion);
  const operation = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    requestFingerprint,
    operationKind: "bastion.work-completion",
    payload: input.command
  });
  if (!operation.ok) return operation;
  const ready = await prepareOperation(input.repository, operation.value);
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const domainCommandId = opaqueId<CommandId>(`${operationId}:command:bastion`);
    const temporal = await prepareTemporalSegmentCommitV1({
      campaign: campaign.value,
      operation: ready.value,
      writerLease: lease.value,
      clockAggregate: clock.value,
      scheduleAggregate: schedule.value,
      scheduleAggregateId,
      simulationCursorAggregate: cursor.value,
      simulationCursorAggregateId: input.simulationCursorAggregateId,
      processAggregate: null,
      processAggregateId: null,
      nextProcess: null,
      batch: batch.value,
      operationBinding: {
        mode: "COMPOSITE_DOMAIN_COMMIT",
        domainCommandId,
        batchFingerprint: batch.value.batchFingerprint
      },
      resolutions: [{
        taskId: effect.effectId,
        outcome: "RESOLVED",
        eventId: opaqueId<EventId>(`${operationId}:bastion-work-completed`),
        eventType: "bastion_work_completed",
        origin: "RULE",
        visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
        payload: summary
      }],
      newEffects: [],
      additionalAggregateWrites: [{
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: bastionRegistryAggregateIdV1(input.campaignId),
        expectedAggregateRevision: registry.value.aggregate!.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: nextRegistry
      }],
      commitId: opaqueId<CommitId>(`${operationId}:commit`),
      commandId: opaqueId<CommandId>(`${operationId}:command:time`)
    });
    if (!temporal.ok) return temporalInvalid("bastion.work-temporal-commit-invalid", temporal.diagnostics);
    const domainCommand: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "bastion-authority",
      contractVersion: 1,
      commandId: domainCommandId,
      campaignId: input.campaignId,
      operationId,
      commandType: "bastion.complete-work",
      target: {
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: bastionRegistryAggregateIdV1(input.campaignId),
        expectedAggregateRevision: registry.value.aggregate!.aggregateRevision
      },
      payloadSchemaVersion: 1,
      payload: {
        bastionId: bastion.bastionId,
        workOrderId: order.workOrderId,
        installationDefinitionRef: installation.installationDefinitionRef
      },
      acceptedAtGameSecond: currentGameSecond
    };
    const committed = await input.repository.commit({
      ...temporal.value,
      acceptedCommands: [...temporal.value.acceptedCommands, domainCommand]
    });
    if (!committed.ok) return committed;
    const result: BastionWorkCompletionResultV1 = {
      schemaVersion: 1,
      status: "COMPLETED",
      reasonCode: "WORK_ORDER_COMPLETED",
      workOrder: completedOrder,
      installation,
      publicSummary: summary,
      commitId: committed.value.commitId,
      replayed: false
    };
    const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function commitWorkStart(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  registryAggregate: AggregateRecord;
  nextRegistry: BastionRegistryV1;
  scheduleAggregate: AggregateRecord | null;
  scheduleAggregateId: AggregateId;
  nextSchedule: WorldSchedulePayloadV1;
  order: BastionWorkOrderV1;
  eventId: EventId;
}): Promise<Result<{ commitId: CommitId }>> {
  const ready = await prepareOperation(input.repository, input.operation);
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const commandId = opaqueId<CommandId>(`${input.operation.operationId}:command`);
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "bastion-authority",
      contractVersion: 1,
      commandId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: "bastion.start-work",
      target: {
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: input.registryAggregate.aggregateId,
        expectedAggregateRevision: input.registryAggregate.aggregateRevision
      },
      payloadSchemaVersion: 1,
      payload: {
        workOrderId: input.order.workOrderId,
        workDefinitionRef: input.order.workDefinitionRef,
        dueAtGameSecond: input.order.dueAtGameSecond,
        prerequisiteProofRefs: input.order.prerequisiteProofRefs
      },
      acceptedAtGameSecond: input.order.startedAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: input.eventId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "bastion_work_started",
      origin: "PLAYER_INTENT",
      causation: { kind: "COMMAND", id: commandId },
      aggregateRefs: [{
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: input.registryAggregate.aggregateId,
        aggregateRevision: input.registryAggregate.aggregateRevision + 1
      }, {
        aggregateType: "world.schedule",
        aggregateId: input.scheduleAggregateId,
        aggregateRevision: input.scheduleAggregate === null
          ? 0
          : input.scheduleAggregate.aggregateRevision + 1
      }],
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: input.order.startedAtGameSecond,
      payloadSchemaVersion: 1,
      payload: {
        bastionId: input.nextRegistry.bastions.find(value =>
          value.workOrders.some(order => order.workOrderId === input.order.workOrderId)
        )!.bastionId,
        workOrderId: input.order.workOrderId,
        workDefinitionRef: input.order.workDefinitionRef,
        dueAtGameSecond: input.order.dueAtGameSecond
      }
    };
    return input.repository.commit({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: input.registryAggregate.aggregateId,
        expectedAggregateRevision: input.registryAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: input.nextRegistry
      }, {
        aggregateType: "world.schedule",
        aggregateId: input.scheduleAggregateId,
        expectedAggregateRevision: input.scheduleAggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextSchedule) as unknown as JsonObject
      }],
      events: [event],
      outboxTasks: []
    });
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function blockedStart(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  requestFingerprint: string;
  command: StartBastionWorkCommandV1;
  reasonCode: string;
}): Promise<Result<BastionWorkStartResultV1>> {
  const operation = await beginOperation({
    ...input,
    clientRequestId: input.command.clientRequestId,
    operationKind: "bastion.work-start",
    payload: input.command
  });
  if (!operation.ok) return operation;
  const result: BastionWorkStartResultV1 = {
    schemaVersion: 1,
    status: "BLOCKED_BY_PREREQUISITE",
    reasonCode: input.reasonCode,
    workOrder: null,
    commitId: null,
    replayed: false
  };
  const completed = await input.repository.completeWithoutCommit(input.operationId, 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

async function beginOperation(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  clientRequestId: string;
  requestFingerprint: string;
  operationKind: string;
  payload: JsonObject;
}): Promise<Result<OperationRecord>> {
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  return input.repository.receiveOperation({
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId(input.operationId),
    requestFingerprint: input.requestFingerprint,
    operationKind: input.operationKind,
    requestPayloadSchemaVersion: 1,
    requestPayload: cloneJson(input.payload),
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
}

async function prepareOperation(
  repository: CampaignRepository,
  operation: OperationRecord
): Promise<Result<OperationRecord>> {
  const preparing = await repository.transitionOperation(operation.operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  return repository.transitionOperation(operation.operationId, "PREPARING", "READY_TO_COMMIT");
}

async function loadCampaignClock(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<AggregateRecord>> {
  const campaign = await repository.getCampaign(campaignId);
  return campaign.ok
    ? repository.getAggregate(campaignId, "world.clock", campaign.value.clockAggregateId)
    : campaign;
}

async function loadOptionalAggregate(
  repository: CampaignRepository,
  campaignId: CampaignId,
  aggregateType: string,
  aggregateId: AggregateId
): Promise<Result<AggregateRecord | null>> {
  const result = await repository.getAggregate(campaignId, aggregateType, aggregateId);
  return !result.ok && result.error.code === "NOT_FOUND"
    ? { ok: true, value: null }
    : result;
}

function validateSchedule(aggregate: AggregateRecord): Result<WorldSchedulePayloadV1> {
  const result = validateWorldSchedulePayloadV1(aggregate.payload);
  return result.ok
    ? { ok: true, value: result.value }
    : temporalInvalid("bastion.work-schedule-invalid", result.diagnostics);
}

function replaceBastion(registry: BastionRegistryV1, bastion: BastionRecordV1): BastionRegistryV1 {
  return {
    ...registry,
    bastions: registry.bastions.map(value => value.bastionId === bastion.bastionId ? bastion : value),
    version: registry.version + 1
  };
}

async function restoreStartIfCompleted(
  repository: CampaignRepository,
  operationId: OperationId,
  requestFingerprint: string
): Promise<Result<BastionWorkStartResultV1> | null> {
  const operation = await repository.getOperation(operationId);
  if (!operation.ok && operation.error.code === "NOT_FOUND") return null;
  if (!operation.ok) return operation;
  if (operation.value.requestFingerprint !== requestFingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "bastion.work-start-request-conflict") };
  }
  if (operation.value.phase !== "COMPLETED") {
    return invalid("bastion.work-start-operation-incomplete", ["operation is not completed"]);
  }
  const result = operation.value.resultPayload as unknown as BastionWorkStartResultV1;
  return { ok: true, value: { ...cloneJson(result), replayed: true } };
}

async function restoreCompletionIfCompleted(
  repository: CampaignRepository,
  operationId: OperationId,
  requestFingerprint: string
): Promise<Result<BastionWorkCompletionResultV1> | null> {
  const operation = await repository.getOperation(operationId);
  if (!operation.ok && operation.error.code === "NOT_FOUND") return null;
  if (!operation.ok) return operation;
  if (operation.value.requestFingerprint !== requestFingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "bastion.work-completion-request-conflict") };
  }
  if (operation.value.phase !== "COMPLETED") {
    return invalid("bastion.work-completion-operation-incomplete", ["operation is not completed"]);
  }
  const result = operation.value.resultPayload as unknown as BastionWorkCompletionResultV1;
  return { ok: true, value: { ...cloneJson(result), replayed: true } };
}

function validateStartCommand(command: StartBastionWorkCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (command.contractVersion !== BASTION_WORK_ORDER_CONTRACT_V1) issues.push("contractVersion is invalid");
  if (!nonEmpty(command.clientRequestId)) issues.push("clientRequestId is required");
  if (!nonEmpty(command.bastionId)) issues.push("bastionId is required");
  if (!nonEmpty(command.workDefinitionRef)) issues.push("workDefinitionRef is required");
  return issues;
}

function validateCompletionCommand(command: CompleteBastionWorkCommandV1): string[] {
  const issues = validateStartCommand({
    schemaVersion: command.schemaVersion,
    contractVersion: command.contractVersion,
    clientRequestId: command.clientRequestId,
    bastionId: command.bastionId,
    workDefinitionRef: command.workOrderId
  });
  if (!nonNegativeInteger(command.requestedThroughGameSecond)) {
    issues.push("requestedThroughGameSecond must be a non-negative integer");
  }
  return issues;
}

function validateDefinition(definition: BastionWorkDefinitionV1, expectedRef: string): string[] {
  const issues: string[] = [];
  if (definition.schemaVersion !== 1 || definition.contractVersion !== BASTION_WORK_CATALOG_CONTRACT_V1) {
    issues.push("catalog contract is invalid");
  }
  if (definition.workDefinitionRef !== expectedRef) issues.push("workDefinitionRef mismatch");
  if (!publicText(definition.displayName, 120)) issues.push("displayName is invalid");
  if (!Number.isInteger(definition.durationSeconds) || definition.durationSeconds < 1) {
    issues.push("durationSeconds must be a positive integer");
  }
  if (!Array.isArray(definition.prerequisites) || definition.prerequisites.some(value =>
    value.schemaVersion !== 1
    || !nonEmpty(value.prerequisiteRef)
    || !Number.isInteger(value.quantity)
    || value.quantity < 1
    || !nonEmpty(value.unit)
  )) issues.push("prerequisites are invalid");
  if (
    definition.effect?.schemaVersion !== 1
    || definition.effect.kind !== "ADD_INSTALLATION"
    || !nonEmpty(definition.effect.installationDefinitionRef)
    || !publicText(definition.effect.installationDisplayName, 120)
  ) issues.push("installation effect is invalid");
  if (!publicText(definition.completionNarrative, 600)) issues.push("completionNarrative is invalid");
  return issues;
}

function validatePrerequisiteDecision(
  decision: BastionWorkPrerequisiteDecisionV1,
  proofsRequired: boolean
): string[] {
  const issues: string[] = [];
  if (decision.schemaVersion !== 1) issues.push("decision schemaVersion must be 1");
  if (typeof decision.authorized !== "boolean") issues.push("authorized must be boolean");
  if (!nonEmpty(decision.reasonCode)) issues.push("reasonCode is required");
  if (!Array.isArray(decision.proofRefs) || decision.proofRefs.some(value => !nonEmpty(value))) {
    issues.push("proofRefs are invalid");
  }
  if (decision.authorized && proofsRequired && decision.proofRefs.length === 0) {
    issues.push("authorized prerequisites require at least one proof");
  }
  if (!decision.authorized && decision.proofRefs.length > 0) {
    issues.push("rejected prerequisites cannot provide proofs");
  }
  return issues;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function publicText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximumLength
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function temporalInvalid(
  messageKey: string,
  diagnostics: Array<{ code: string; path: string }>
): Result<never> {
  return invalid(messageKey, diagnostics.map(value => `${value.code}:${value.path}`));
}

function invalid(messageKey: string, issues: string[]): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
