import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRepository,
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
import { validateAccessControlRecordV1, type AccessControlRecordV1 } from "./accessControl";

export const ACCESS_CONTROL_REGISTRY_CONTRACT_V1 = "access-control-registry/1" as const;
export const UPSERT_ACCESS_CONTROL_COMMAND_V1 = "upsert-access-control/1" as const;
export const ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1 = "world.access-control-registry" as const;

export interface AccessControlRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof ACCESS_CONTROL_REGISTRY_CONTRACT_V1;
  campaignId: string;
  controls: AccessControlRecordV1[];
  version: number;
}

export interface UpsertAccessControlCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof UPSERT_ACCESS_CONTROL_COMMAND_V1;
  clientRequestId: string;
  sourceOperationId: string;
  occurredAtGameSecond: number;
  control: AccessControlRecordV1;
}

export interface AccessControlOwnerAuthorizationV1 extends JsonObject {
  schemaVersion: 1;
  authority: "ACCESS_OWNER_DOMAIN";
  sourceOperationId: string;
  accessControlRef: string;
  connectionId: string;
  ownerDomain: string;
  permittedState: AccessControlRecordV1["state"];
  sourceRefs: string[];
}

export interface AccessControlOwnerPortV1 {
  authorize(input: { campaignId: CampaignId; command: UpsertAccessControlCommandV1 }): Promise<
    | { ok: true; authorization: AccessControlOwnerAuthorizationV1 }
    | { ok: false; issues: string[] }
  >;
}

export interface UpsertAccessControlResultV1 extends JsonObject {
  schemaVersion: 1;
  accessControlRef: string;
  state: AccessControlRecordV1["state"];
  commitId: string;
  replayed: boolean;
}

export function accessControlRegistryAggregateIdV1(campaignId: CampaignId): AggregateId {
  return opaqueId<AggregateId>(`agg-access-controls:${campaignId}`);
}

export async function loadAccessControlRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: AccessControlRegistryV1 }>> {
  const aggregate = await repository.getAggregate(campaignId, ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1, accessControlRegistryAggregateIdV1(campaignId));
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: emptyRegistry(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<AccessControlRegistryV1>;
  if (
    state.schemaVersion !== 1 ||
    state.contractVersion !== ACCESS_CONTROL_REGISTRY_CONTRACT_V1 ||
    state.campaignId !== campaignId ||
    !Array.isArray(state.controls) ||
    state.controls.some(control => validateAccessControlRecordV1(control).length > 0)
  ) return invalid("access.registry-invalid", ["access control registry payload is invalid"]);
  return { ok: true, value: { aggregate: aggregate.value, state: state as AccessControlRegistryV1 } };
}

export async function upsertAccessControlV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: UpsertAccessControlCommandV1;
  ownerPort: AccessControlOwnerPortV1;
}): Promise<Result<UpsertAccessControlResultV1>> {
  const issues = validateCommand(input.command);
  if (issues.length > 0) return invalid("access.command-invalid", issues);
  const operationId = opaqueId<OperationId>(`upsert-access-control:${input.command.clientRequestId}`);
  const fingerprint = await computeRequestFingerprint("access.control.upsert", 1, input.command);
  const existingOperation = await input.repository.getOperation(operationId);
  if (existingOperation.ok && existingOperation.value.requestFingerprint !== fingerprint) return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "access.request-conflict") };
  if (existingOperation.ok && existingOperation.value.phase === "COMPLETED") return restore(existingOperation.value);
  if (existingOperation.ok) return invalid("access.operation-incomplete", ["operation already exists and is incomplete"]);
  if (existingOperation.error.code !== "NOT_FOUND") return existingOperation;

  const sourceOperation = await input.repository.getOperation(opaqueId<OperationId>(input.command.sourceOperationId));
  if (!sourceOperation.ok) return sourceOperation;
  if (sourceOperation.value.campaignId !== input.campaignId || sourceOperation.value.phase !== "COMPLETED") return invalid("access.source-operation-invalid", ["completed owner-domain source operation required"]);
  const authorized = await input.ownerPort.authorize({ campaignId: input.campaignId, command: input.command });
  if (!authorized.ok) return invalid("access.owner-rejected", authorized.issues);
  const authorizationIssues = validateAuthorization(input.command, authorized.authorization);
  if (authorizationIssues.length > 0) return invalid("access.owner-authorization-invalid", authorizationIssues);

  const loaded = await loadAccessControlRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const merged = mergeControl(loaded.value.state, input.command.control);
  if (!merged.ok) return merged;
  const started = await beginOperation(input.repository, input.campaignId, operationId, input.command, fingerprint);
  if (!started.ok) return started;
  const committed = await commitControl(input, started.value, loaded.value, merged.value);
  if (!committed.ok) return committed;
  const result: UpsertAccessControlResultV1 = {
    schemaVersion: 1,
    accessControlRef: input.command.control.accessControlRef,
    state: input.command.control.state,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

function emptyRegistry(campaignId: CampaignId): AccessControlRegistryV1 {
  return { schemaVersion: 1, contractVersion: ACCESS_CONTROL_REGISTRY_CONTRACT_V1, campaignId, controls: [], version: 1 };
}

function mergeControl(current: AccessControlRegistryV1, control: AccessControlRecordV1): Result<AccessControlRegistryV1> {
  const controls = new Map(current.controls.map(entry => [entry.accessControlRef, entry]));
  const prior = controls.get(control.accessControlRef);
  if (prior !== undefined) {
    if (
      prior.connectionId !== control.connectionId ||
      prior.sourceSceneId !== control.sourceSceneId ||
      prior.boundaryRef !== control.boundaryRef ||
      prior.destinationRef !== control.destinationRef ||
      prior.ownerDomain !== control.ownerDomain
    ) return invalid("access.identity-conflict", [control.accessControlRef]);
    if (control.version !== prior.version + 1) return invalid("access.version-conflict", [`expected version ${prior.version + 1}`]);
  } else if (control.version !== 1) return invalid("access.version-conflict", ["new access control must start at version 1"]);
  const conflictingConnection = current.controls.find(entry => entry.connectionId === control.connectionId && entry.accessControlRef !== control.accessControlRef);
  if (conflictingConnection !== undefined) return invalid("access.connection-conflict", [control.connectionId]);
  controls.set(control.accessControlRef, cloneJson(control));
  return { ok: true, value: { ...current, controls: [...controls.values()].sort((a, b) => a.accessControlRef.localeCompare(b.accessControlRef)), version: current.version + 1 } };
}

async function beginOperation(
  repository: CampaignRepository,
  campaignId: CampaignId,
  operationId: OperationId,
  command: UpsertAccessControlCommandV1,
  requestFingerprint: string
): Promise<Result<OperationRecord>> {
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  const received = await repository.receiveOperation({
    schemaVersion: 1, operationId, campaignId,
    clientRequestId: opaqueId<RequestId>(command.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(operationId),
    requestFingerprint, operationKind: "access.control.upsert", requestPayloadSchemaVersion: 1,
    requestPayload: cloneJson(command), phase: "RECEIVED", observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null, completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null,
    receivedAt: now, updatedAt: now
  });
  if (!received.ok) return received;
  const preparing = await repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  return repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
}

async function commitControl(
  input: { repository: CampaignRepository; campaignId: CampaignId; command: UpsertAccessControlCommandV1 },
  operation: OperationRecord,
  current: { aggregate: AggregateRecord | null; state: AccessControlRegistryV1 },
  next: AccessControlRegistryV1
): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(input.campaignId, opaqueId<WriterId>(`${operation.operationId}:writer`), 120_000);
  if (!lease.ok) return lease;
  try {
    const aggregateId = accessControlRegistryAggregateIdV1(input.campaignId);
    const acceptedCommand: AcceptedCommandDraft = {
      schemaVersion: 1, contractId: "access-control-authority", contractVersion: 1,
      commandId: opaqueId(`${operation.operationId}:command`), campaignId: input.campaignId, operationId: operation.operationId,
      commandType: "access.control.upsert",
      target: { aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1, aggregateId, expectedAggregateRevision: current.aggregate?.aggregateRevision ?? null },
      payloadSchemaVersion: 1,
      payload: { accessControlRef: input.command.control.accessControlRef, connectionId: input.command.control.connectionId, state: input.command.control.state, ownerDomain: input.command.control.ownerDomain },
      acceptedAtGameSecond: input.command.occurredAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1, eventId: opaqueId<EventId>(`${operation.operationId}:event`), campaignId: input.campaignId,
      operationId: operation.operationId, eventType: "access.control.updated", origin: "SYSTEM",
      causation: { kind: "OPERATION", id: operation.operationId },
      aggregateRefs: [{ aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1, aggregateId, aggregateRevision: current.aggregate === null ? 0 : current.aggregate.aggregateRevision + 1 }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] }, occurredAtGameSecond: input.command.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: { accessControlRef: input.command.control.accessControlRef, connectionId: input.command.control.connectionId, state: input.command.control.state, sourceOperationId: input.command.sourceOperationId }
    };
    const request: CommitRequest = {
      campaignId: input.campaignId, operationId: operation.operationId,
      commitId: opaqueId<CommitId>(`${operation.operationId}:commit`), idempotencyKey: operation.idempotencyKey,
      requestFingerprint: operation.requestFingerprint, expectedCampaignRevision: operation.observedCampaignRevision,
      writerLease: lease.value, acceptedCommands: [acceptedCommand],
      aggregateWrites: [{ aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1, aggregateId, expectedAggregateRevision: current.aggregate?.aggregateRevision ?? null, payloadSchemaVersion: 1, payload: cloneJson(next) }],
      events: [event], outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function validateCommand(command: UpsertAccessControlCommandV1): string[] {
  const issues = validateAccessControlRecordV1(command.control);
  if (command.schemaVersion !== 1 || command.contractVersion !== UPSERT_ACCESS_CONTROL_COMMAND_V1) issues.push("upsert access control contract mismatch");
  if (!command.clientRequestId.trim() || !command.sourceOperationId.trim()) issues.push("clientRequestId and sourceOperationId are required");
  if (!Number.isInteger(command.occurredAtGameSecond) || command.occurredAtGameSecond < 0) issues.push("occurredAtGameSecond is invalid");
  return issues;
}

function validateAuthorization(command: UpsertAccessControlCommandV1, authorization: AccessControlOwnerAuthorizationV1): string[] {
  const issues: string[] = [];
  if (authorization.schemaVersion !== 1 || authorization.authority !== "ACCESS_OWNER_DOMAIN") issues.push("owner authorization contract invalid");
  for (const [field, actual, expected] of [
    ["sourceOperationId", authorization.sourceOperationId, command.sourceOperationId],
    ["accessControlRef", authorization.accessControlRef, command.control.accessControlRef],
    ["connectionId", authorization.connectionId, command.control.connectionId],
    ["ownerDomain", authorization.ownerDomain, command.control.ownerDomain],
    ["permittedState", authorization.permittedState, command.control.state]
  ] as const) if (actual !== expected) issues.push(`${field} does not match owner authorization`);
  if ([...authorization.sourceRefs].sort().join("\u0000") !== [...command.control.sourceRefs].sort().join("\u0000")) issues.push("sourceRefs do not match owner authorization");
  return issues;
}

function restore(operation: OperationRecord): Result<UpsertAccessControlResultV1> {
  const result = operation.resultPayload as Partial<UpsertAccessControlResultV1> | null;
  if (result?.schemaVersion !== 1 || typeof result.accessControlRef !== "string" || typeof result.state !== "string" || typeof result.commitId !== "string") return invalid("access.result-invalid", ["completed result invalid"]);
  return { ok: true, value: { ...result, replayed: true } as UpsertAccessControlResultV1 };
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
