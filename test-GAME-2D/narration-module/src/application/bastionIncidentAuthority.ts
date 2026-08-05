import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateWrite,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type EventDraft,
  type EventId,
  type EventRecord,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  HANDOFF_CONTRACT_VERSION,
  HANDOFF_PAYLOAD_SCHEMA_VERSION,
  validateTacticalEncounterSeedV1,
  type ProcessHandoffV1,
  type TacticalEncounterSeedV1
} from "../handoff";
import {
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  bastionRegistryAggregateIdV1,
  loadBastionRegistryV1,
  type BastionIncidentV1,
  type BastionInstallationV1,
  type BastionRecordV1,
  type BastionRegistryV1
} from "./bastionAuthority";

export const BASTION_INCIDENT_CONTRACT_V1 = "bastion-incident/1" as const;
export const BASTION_INCIDENT_CATALOG_CONTRACT_V1 =
  "bastion-incident-catalog/1" as const;

export type BastionIncidentKindV1 =
  | "OPPORTUNITY"
  | "INSTALLATION_CONSEQUENCE"
  | "TACTICAL_DEFENSE";

export interface BastionIncidentDefinitionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_INCIDENT_CATALOG_CONTRACT_V1;
  incidentDefinitionRef: string;
  displayName: string;
  kind: BastionIncidentKindV1;
  publicNarrative: string;
  effect:
    | { schemaVersion: 1; kind: "RECORD_ONLY" }
    | {
        schemaVersion: 1;
        kind: "SET_INSTALLATION_STATUS";
        targetInstallationDefinitionRef: string;
        nextStatus: "DAMAGED" | "DISABLED";
      }
    | { schemaVersion: 1; kind: "TACTICAL_HANDOFF" };
}

export interface BastionIncidentCatalogV1 {
  readonly catalogRef: string;
  resolve(incidentDefinitionRef: string):
    | BastionIncidentDefinitionV1
    | null
    | Promise<BastionIncidentDefinitionV1 | null>;
}

export interface BastionIncidentPolicyDecisionV1 extends JsonObject {
  schemaVersion: 1;
  eligible: boolean;
  reasonCode: string;
  incidentDefinitionRef: string | null;
}

export interface BastionIncidentPolicyV1 {
  readonly policyRef: string;
  evaluate(input: {
    campaign: CampaignRecord;
    bastion: BastionRecordV1;
    sourceEvent: EventRecord;
  }): BastionIncidentPolicyDecisionV1 | Promise<BastionIncidentPolicyDecisionV1>;
}

export interface BastionDefenseHandoffPreparationV1 extends JsonObject {
  schemaVersion: 1;
  authorized: boolean;
  reasonCode: string;
  seed: TacticalEncounterSeedV1 | null;
}

export interface BastionDefenseHandoffAuthorityV1 {
  readonly authorityRef: string;
  prepare(input: {
    campaign: CampaignRecord;
    bastion: BastionRecordV1;
    incident: BastionIncidentDefinitionV1;
    sourceEvent: EventRecord;
    startedAtGameSecond: number;
  }):
    | BastionDefenseHandoffPreparationV1
    | Promise<BastionDefenseHandoffPreparationV1>;
}

export interface HandleBastionIncidentCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_INCIDENT_CONTRACT_V1;
  clientRequestId: string;
  bastionId: string;
  sourceOperationId: string;
  sourceEventId: string;
}

export interface BastionIncidentPublicSummaryV1 extends JsonObject {
  schemaVersion: 1;
  bastionId: string;
  placeRef: string;
  placeDisplayName: string;
  incidentId: string;
  incidentDefinitionRef: string;
  incidentDisplayName: string;
  kind: BastionIncidentKindV1;
  status: "OPEN" | "APPLIED" | "HANDOFF_ACTIVE";
  affectedInstallationDisplayName: string | null;
  tacticalProcessId: string | null;
  occurredAtGameSecond: number;
  narrative: string;
}

export interface BastionIncidentResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "IGNORED" | "RECORDED" | "CONSEQUENCE_APPLIED" | "HANDOFF_CREATED";
  reasonCode: string;
  incident: BastionIncidentV1 | null;
  publicSummary: BastionIncidentPublicSummaryV1 | null;
  tacticalSeed: TacticalEncounterSeedV1 | null;
  commitId: string | null;
  replayed: boolean;
}

export function tacticalHandoffAggregateIdV1(processId: string): AggregateId {
  return opaqueId<AggregateId>(`agg_handoff_${processId}`);
}

export function tacticalSeedAggregateIdV1(processId: string): AggregateId {
  return opaqueId<AggregateId>(`agg_tactical_seed_${processId}`);
}

/** @deprecated Compatibilite avec les appels du vertical bastion. */
export const bastionTacticalHandoffAggregateIdV1 = tacticalHandoffAggregateIdV1;
/** @deprecated Compatibilite avec les appels du vertical bastion. */
export const bastionTacticalSeedAggregateIdV1 = tacticalSeedAggregateIdV1;

export async function handleBastionIncidentV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: HandleBastionIncidentCommandV1;
  catalog: BastionIncidentCatalogV1 | null;
  policy: BastionIncidentPolicyV1 | null;
  defenseAuthority: BastionDefenseHandoffAuthorityV1 | null;
}): Promise<Result<BastionIncidentResultV1>> {
  const issues = validateCommand(input.command);
  if (issues.length > 0) return invalid("bastion.incident-command-invalid", issues);
  if (input.catalog === null || !nonEmpty(input.catalog.catalogRef)) {
    return invalid("bastion.incident-catalog-required", ["an explicit incident catalog is required"]);
  }
  if (input.policy === null || !nonEmpty(input.policy.policyRef)) {
    return invalid("bastion.incident-policy-required", ["an explicit incident policy is required"]);
  }
  const operationId = opaqueId<OperationId>(`bastion-incident:${input.command.clientRequestId}`);
  const fingerprint = await computeRequestFingerprint("bastion.handle-incident", 1, input.command);
  const replay = await restoreIfCompleted(input.repository, operationId, fingerprint);
  if (replay !== null) return replay;
  const [campaign, registry, clock] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    loadBastionRegistryV1(input.repository, input.campaignId),
    loadCampaignClock(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!registry.ok) return registry;
  if (!clock.ok) return clock;
  const bastion = registry.value.state.bastions.find(value =>
    value.bastionId === input.command.bastionId && value.status === "ACTIVE"
  );
  if (bastion === undefined) {
    return invalid("bastion.incident-target-unavailable", ["the selected active bastion does not exist"]);
  }
  const source = await findCommittedSourceEvent({
    repository: input.repository,
    campaignId: input.campaignId,
    sourceOperationId: input.command.sourceOperationId,
    sourceEventId: input.command.sourceEventId
  });
  if (!source.ok) return source;
  const decision = await input.policy.evaluate({
    campaign: campaign.value,
    bastion: cloneJson(bastion),
    sourceEvent: cloneJson(source.value)
  });
  const decisionIssues = validateDecision(decision);
  if (decisionIssues.length > 0) return invalid("bastion.incident-policy-decision-invalid", decisionIssues);
  if (!decision.eligible || decision.incidentDefinitionRef === null) {
    const started = await beginOperation({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId,
      clientRequestId: input.command.clientRequestId,
      fingerprint,
      payload: input.command
    });
    if (!started.ok) return started;
    const ignored: BastionIncidentResultV1 = {
      schemaVersion: 1,
      status: "IGNORED",
      reasonCode: decision.reasonCode,
      incident: null,
      publicSummary: null,
      tacticalSeed: null,
      commitId: null,
      replayed: false
    };
    const completed = await input.repository.completeWithoutCommit(operationId, 1, ignored);
    return completed.ok ? { ok: true, value: ignored } : completed;
  }
  const definition = await input.catalog.resolve(decision.incidentDefinitionRef);
  if (definition === null) {
    return invalid("bastion.incident-definition-not-found", [
      "the policy-selected incident is absent from the injected catalog"
    ]);
  }
  const definitionIssues = validateDefinition(definition, decision.incidentDefinitionRef);
  if (definitionIssues.length > 0) {
    return invalid("bastion.incident-definition-invalid", definitionIssues);
  }
  if (bastion.incidents.some(value =>
    value.sourceEventId === source.value.eventId
    || value.incidentId === `bastion-incident:${input.command.clientRequestId}`
  )) {
    return invalid("bastion.incident-already-handled", ["the source event was already handled"]);
  }
  const occurredAtGameSecond = Number(clock.value.payload.elapsedGameSeconds);
  if (
    !nonNegativeInteger(occurredAtGameSecond)
    || occurredAtGameSecond < source.value.occurredAtGameSecond
  ) {
    return invalid("bastion.incident-clock-invalid", ["campaign clock precedes the source event"]);
  }

  let affectedInstallation: BastionInstallationV1 | null = null;
  let nextInstallations = bastion.installations;
  let tacticalSeed: TacticalEncounterSeedV1 | null = null;
  let tacticalProcess: ProcessHandoffV1 | null = null;
  let incidentStatus: BastionIncidentV1["status"];
  let resultStatus: BastionIncidentResultV1["status"];
  if (definition.kind === "OPPORTUNITY") {
    incidentStatus = "OPEN";
    resultStatus = "RECORDED";
  } else if (definition.kind === "INSTALLATION_CONSEQUENCE") {
    const effect = definition.effect;
    if (effect.kind !== "SET_INSTALLATION_STATUS") {
      return invalid("bastion.incident-effect-mismatch", ["installation consequence requires an installation effect"]);
    }
    affectedInstallation = bastion.installations.find(value =>
      value.installationDefinitionRef === effect.targetInstallationDefinitionRef
    ) ?? null;
    if (affectedInstallation === null) {
      return invalid("bastion.incident-installation-not-found", [
        "the catalogued consequence targets an installation absent from the bastion"
      ]);
    }
    const nextInstallation: BastionInstallationV1 = {
      ...affectedInstallation,
      status: effect.nextStatus,
      version: affectedInstallation.version + 1
    };
    affectedInstallation = nextInstallation;
    nextInstallations = bastion.installations.map(value =>
      value.installationId === nextInstallation.installationId ? nextInstallation : value
    );
    incidentStatus = "APPLIED";
    resultStatus = "CONSEQUENCE_APPLIED";
  } else {
    if (definition.effect.kind !== "TACTICAL_HANDOFF") {
      return invalid("bastion.incident-effect-mismatch", ["tactical defense requires a tactical handoff effect"]);
    }
    if (input.defenseAuthority === null || !nonEmpty(input.defenseAuthority.authorityRef)) {
      return invalid("bastion.defense-authority-required", [
        "a tactical defense authority is required; narration cannot resolve the attack"
      ]);
    }
    const prepared = await input.defenseAuthority.prepare({
      campaign: campaign.value,
      bastion: cloneJson(bastion),
      incident: cloneJson(definition),
      sourceEvent: cloneJson(source.value),
      startedAtGameSecond: occurredAtGameSecond
    });
    if (
      prepared.schemaVersion !== 1
      || typeof prepared.authorized !== "boolean"
      || !nonEmpty(prepared.reasonCode)
    ) return invalid("bastion.defense-preparation-invalid", ["defense preparation envelope is invalid"]);
    if (!prepared.authorized || prepared.seed === null) {
      return invalid("bastion.defense-preparation-refused", [
        "the tactical owner did not authorize a complete defense seed"
      ]);
    }
    const seedValidation = validateTacticalEncounterSeedV1(prepared.seed);
    if (!seedValidation.valid) {
      return invalid("bastion.defense-seed-invalid", seedValidation.issues);
    }
    if (
      prepared.seed.campaignId !== input.campaignId
      || prepared.seed.startedAtGameSecond !== occurredAtGameSecond
      || prepared.seed.locationRef.id !== bastion.placeRef
    ) {
      return invalid("bastion.defense-seed-mismatch", [
        "tactical seed must target the current campaign, clock and bastion place"
      ]);
    }
    tacticalSeed = cloneJson(prepared.seed);
    tacticalProcess = {
      schemaVersion: 1,
      contractVersion: HANDOFF_CONTRACT_VERSION,
      processId: tacticalSeed.processId,
      campaignId: input.campaignId,
      sourceOperationId: operationId,
      sourceSceneId: tacticalSeed.sceneId,
      processKind: "TACTICAL_ENCOUNTER",
      status: "ACTIVE",
      createdAtGameSecond: occurredAtGameSecond,
      sourceRefs: uniqueSourceRefs([
        ...tacticalSeed.sourceAggregateRefs,
        { kind: "bastion", id: bastion.bastionId },
        { kind: "event", id: source.value.eventId }
      ]),
      idempotencyKey: `bastion-defense:${input.command.clientRequestId}`,
      version: 1,
      integratedOutcomeId: null,
      updatedAtGameSecond: null
    };
    incidentStatus = "HANDOFF_ACTIVE";
    resultStatus = "HANDOFF_CREATED";
  }
  const incident: BastionIncidentV1 = {
    schemaVersion: 1,
    incidentId: `bastion-incident:${input.command.clientRequestId}`,
    incidentDefinitionRef: definition.incidentDefinitionRef,
    incidentDisplayName: definition.displayName,
    kind: definition.kind,
    status: incidentStatus,
    sourceOperationId: source.value.operationId,
    sourceEventId: source.value.eventId,
    policyRef: input.policy.policyRef,
    catalogRef: input.catalog.catalogRef,
    affectedInstallationId: affectedInstallation?.installationId ?? null,
    tacticalProcessId: tacticalProcess?.processId ?? null,
    occurredAtGameSecond,
    publicNarrative: definition.publicNarrative,
    version: 1
  };
  const summary: BastionIncidentPublicSummaryV1 = {
    schemaVersion: 1,
    bastionId: bastion.bastionId,
    placeRef: bastion.placeRef,
    placeDisplayName: bastion.placeDisplayName,
    incidentId: incident.incidentId,
    incidentDefinitionRef: incident.incidentDefinitionRef,
    incidentDisplayName: incident.incidentDisplayName,
    kind: incident.kind,
    status: incident.status,
    affectedInstallationDisplayName: affectedInstallation?.displayName ?? null,
    tacticalProcessId: incident.tacticalProcessId,
    occurredAtGameSecond,
    narrative: incident.publicNarrative
  };
  const nextBastion: BastionRecordV1 = {
    ...bastion,
    installations: nextInstallations,
    incidents: [...bastion.incidents, incident],
    version: bastion.version + 1
  };
  const operation = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    fingerprint,
    payload: input.command
  });
  if (!operation.ok) return operation;
  const committed = await commitIncident({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: operation.value,
    registryAggregate: registry.value.aggregate!,
    nextRegistry: replaceBastion(registry.value.state, nextBastion),
    incident,
    summary,
    tacticalProcess,
    tacticalSeed
  });
  if (!committed.ok) return committed;
  const result: BastionIncidentResultV1 = {
    schemaVersion: 1,
    status: resultStatus,
    reasonCode: decision.reasonCode,
    incident,
    publicSummary: summary,
    tacticalSeed,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(
    operationId,
    "COMMITTED_RENDERED",
    1,
    result
  );
  return completed.ok ? { ok: true, value: result } : completed;
}

async function commitIncident(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  registryAggregate: AggregateRecord;
  nextRegistry: BastionRegistryV1;
  incident: BastionIncidentV1;
  summary: BastionIncidentPublicSummaryV1;
  tacticalProcess: ProcessHandoffV1 | null;
  tacticalSeed: TacticalEncounterSeedV1 | null;
}): Promise<Result<{ commitId: CommitId }>> {
  const preparing = await input.repository.transitionOperation(
    input.operation.operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(
    input.operation.operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const commandId = opaqueId<CommandId>(`${input.operation.operationId}:command`);
    const acceptedCommand: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "bastion-authority",
      contractVersion: 1,
      commandId,
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: input.tacticalProcess === null
        ? "bastion.apply-incident"
        : "bastion.start-defense-handoff",
      target: {
        aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: input.registryAggregate.aggregateId,
        expectedAggregateRevision: input.registryAggregate.aggregateRevision
      },
      payloadSchemaVersion: 1,
      payload: {
        incidentId: input.incident.incidentId,
        incidentDefinitionRef: input.incident.incidentDefinitionRef,
        sourceEventId: input.incident.sourceEventId,
        tacticalProcessId: input.incident.tacticalProcessId
      },
      acceptedAtGameSecond: input.incident.occurredAtGameSecond
    };
    const aggregateWrites: AggregateWrite[] = [{
      aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: bastionRegistryAggregateIdV1(input.campaignId),
      expectedAggregateRevision: input.registryAggregate.aggregateRevision,
      payloadSchemaVersion: 1,
      payload: input.nextRegistry
    }];
    if (input.tacticalProcess !== null && input.tacticalSeed !== null) {
      aggregateWrites.push({
        aggregateType: "process.handoff",
        aggregateId: bastionTacticalHandoffAggregateIdV1(input.tacticalProcess.processId),
        expectedAggregateRevision: null,
        payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
        payload: input.tacticalProcess
      }, {
        aggregateType: "tactical.encounter-seed",
        aggregateId: bastionTacticalSeedAggregateIdV1(input.tacticalProcess.processId),
        expectedAggregateRevision: null,
        payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
        payload: input.tacticalSeed
      });
    }
    const aggregateRefs = aggregateWrites.map(write => ({
      aggregateType: write.aggregateType,
      aggregateId: write.aggregateId,
      aggregateRevision: write.expectedAggregateRevision === null
        ? 0
        : write.expectedAggregateRevision + 1
    }));
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:event`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: input.tacticalProcess === null
        ? "bastion_incident_handled"
        : "bastion_defense_handoff_started",
      origin: "RULE",
      causation: { kind: "COMMAND", id: commandId },
      aggregateRefs,
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.incident.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: input.summary
    };
    return input.repository.commit({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [acceptedCommand],
      aggregateWrites,
      events: [event],
      outboxTasks: []
    });
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function findCommittedSourceEvent(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sourceOperationId: string;
  sourceEventId: string;
}): Promise<Result<EventRecord>> {
  const operation = await input.repository.getOperation(
    opaqueId<OperationId>(input.sourceOperationId)
  );
  if (
    !operation.ok
    || operation.value.campaignId !== input.campaignId
    || operation.value.commitId === null
    || !["COMMITTED_PENDING_RENDER", "COMPLETED"].includes(operation.value.phase)
  ) return invalid("bastion.incident-source-operation-not-committed", [
    "source operation must be committed in this campaign"
  ]);
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await input.repository.listEvents(input.campaignId, cursor, 1_024);
    if (!page.ok) return page;
    const found = page.value.find(event =>
      event.eventId === input.sourceEventId
      && event.operationId === operation.value.operationId
      && event.commitId === operation.value.commitId
    );
    if (found !== undefined) return { ok: true, value: found };
    const last = page.value.at(-1);
    if (last === undefined || page.value.length < 1_024) {
      return invalid("bastion.incident-source-event-not-committed", [
        "source event is absent from the committed source operation"
      ]);
    }
    cursor = { commitSequence: last.commitSequence, eventSequence: last.eventSequence };
  }
}

async function beginOperation(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  clientRequestId: string;
  fingerprint: string;
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
    requestFingerprint: input.fingerprint,
    operationKind: "bastion.handle-incident",
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

async function loadCampaignClock(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<AggregateRecord>> {
  const campaign = await repository.getCampaign(campaignId);
  return campaign.ok
    ? repository.getAggregate(campaignId, "world.clock", campaign.value.clockAggregateId)
    : campaign;
}

async function restoreIfCompleted(
  repository: CampaignRepository,
  operationId: OperationId,
  fingerprint: string
): Promise<Result<BastionIncidentResultV1> | null> {
  const operation = await repository.getOperation(operationId);
  if (!operation.ok && operation.error.code === "NOT_FOUND") return null;
  if (!operation.ok) return operation;
  if (operation.value.requestFingerprint !== fingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "bastion.incident-request-conflict") };
  }
  if (operation.value.phase !== "COMPLETED") {
    return invalid("bastion.incident-operation-incomplete", ["operation is not completed"]);
  }
  const result = operation.value.resultPayload as unknown as BastionIncidentResultV1;
  return { ok: true, value: { ...cloneJson(result), replayed: true } };
}

function replaceBastion(registry: BastionRegistryV1, bastion: BastionRecordV1): BastionRegistryV1 {
  return {
    ...registry,
    bastions: registry.bastions.map(value => value.bastionId === bastion.bastionId ? bastion : value),
    version: registry.version + 1
  };
}

function validateCommand(command: HandleBastionIncidentCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (command.contractVersion !== BASTION_INCIDENT_CONTRACT_V1) {
    issues.push("contractVersion is invalid");
  }
  [
    command.clientRequestId,
    command.bastionId,
    command.sourceOperationId,
    command.sourceEventId
  ].forEach(value => { if (!nonEmpty(value)) issues.push("command identities are required"); });
  return issues;
}

function validateDecision(decision: BastionIncidentPolicyDecisionV1): string[] {
  const issues: string[] = [];
  if (decision.schemaVersion !== 1) issues.push("decision schemaVersion must be 1");
  if (typeof decision.eligible !== "boolean") issues.push("eligible must be boolean");
  if (!nonEmpty(decision.reasonCode)) issues.push("reasonCode is required");
  if (decision.eligible && !nonEmpty(decision.incidentDefinitionRef)) {
    issues.push("eligible decision requires incidentDefinitionRef");
  }
  if (!decision.eligible && decision.incidentDefinitionRef !== null) {
    issues.push("ineligible decision cannot select an incident");
  }
  return issues;
}

function validateDefinition(
  definition: BastionIncidentDefinitionV1,
  expectedRef: string
): string[] {
  const issues: string[] = [];
  if (
    definition.schemaVersion !== 1
    || definition.contractVersion !== BASTION_INCIDENT_CATALOG_CONTRACT_V1
  ) issues.push("definition contract is invalid");
  if (definition.incidentDefinitionRef !== expectedRef) issues.push("incidentDefinitionRef mismatch");
  if (!publicText(definition.displayName, 120)) issues.push("displayName is invalid");
  if (!publicText(definition.publicNarrative, 600)) issues.push("publicNarrative is invalid");
  if (!["OPPORTUNITY", "INSTALLATION_CONSEQUENCE", "TACTICAL_DEFENSE"].includes(definition.kind)) {
    issues.push("incident kind is invalid");
  }
  const expectedEffect = definition.kind === "OPPORTUNITY"
    ? "RECORD_ONLY"
    : definition.kind === "INSTALLATION_CONSEQUENCE"
      ? "SET_INSTALLATION_STATUS"
      : "TACTICAL_HANDOFF";
  if (definition.effect?.schemaVersion !== 1 || definition.effect.kind !== expectedEffect) {
    issues.push("incident effect does not match its kind");
  }
  if (
    definition.effect?.kind === "SET_INSTALLATION_STATUS"
    && (
      !nonEmpty(definition.effect.targetInstallationDefinitionRef)
      || !["DAMAGED", "DISABLED"].includes(definition.effect.nextStatus)
    )
  ) issues.push("installation consequence effect is invalid");
  return issues;
}

function uniqueSourceRefs(
  refs: Array<{ kind: string; id: string }>
): Array<{ kind: string; id: string }> {
  const byKey = new Map<string, { kind: string; id: string }>();
  refs.forEach(ref => byKey.set(`${ref.kind}\u0000${ref.id}`, cloneJson(ref)));
  return [...byKey.values()].sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id)
  );
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

function invalid(messageKey: string, issues: string[] = []): Result<never> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
