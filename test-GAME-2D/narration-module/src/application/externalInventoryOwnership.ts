import {
  computeRequestFingerprint, opaqueId,
  type AggregateId, type CampaignId, type CampaignRepository, type CommandId,
  type CommitId, type EventId, type IdempotencyKey, type JsonObject,
  type OperationId, type OperationPhase, type OperationRecord,
  type RepositoryClock, type RequestId, type WriterId
} from "../core";

export const EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1 = "inventory.external-ownership";
export const EXTERNAL_INVENTORY_AGGREGATE_ID_V1 = opaqueId<AggregateId>("agg-external-inventory-ownership");

export interface ExternalInventoryItemV1 extends JsonObject {
  instanceId: string;
  itemId: string;
  itemKind: "weapon" | "armor" | "tool" | "object";
  quantity: number;
  equippedSlot: null;
  storedInInstanceId: null;
  primaryWeapon: false;
  accessible: boolean;
}

export interface ExternalInventoryOwnerV1 extends JsonObject {
  schemaVersion: 1;
  ownerRef: string;
  ownerKind: "SCENE" | "NPC";
  sceneId: string;
  displayName: string;
  inventory: ExternalInventoryItemV1[];
  offers: ExternalInventoryOfferV1[];
  acceptsDirectTransfers: boolean;
}

export interface ExternalInventoryOfferV1 extends JsonObject {
  schemaVersion: 1;
  offerRef: string;
  direction: "SELL_TO_PLAYER" | "BUY_FROM_PLAYER";
  itemId: string;
  itemInstanceId: string | null;
  currencyItemId: string;
  priceQuantity: number;
  status: "ACTIVE" | "CLOSED";
}

export interface ExternalInventoryOwnershipV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "external-inventory-ownership/1";
  owners: ExternalInventoryOwnerV1[];
  version: number;
}

export async function ensureExternalInventoryOwnershipV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  owners: Array<{
    ownerRef: string;
    ownerKind: "SCENE" | "NPC";
    sceneId: string;
    displayName: string;
    inventory?: ExternalInventoryItemV1[];
    offers?: ExternalInventoryOfferV1[];
    acceptsDirectTransfers?: boolean;
  }>;
}): Promise<void> {
  const current = await input.repository.getAggregate(input.campaignId, EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, EXTERNAL_INVENTORY_AGGREGATE_ID_V1);
  if (current.ok) return;
  if (current.error.code !== "NOT_FOUND") throw new Error(current.error.messageKey);
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) throw new Error(campaign.error.messageKey);
  const payload: ExternalInventoryOwnershipV1 = {
    schemaVersion: 1,
    contractVersion: "external-inventory-ownership/1",
    owners: input.owners.map(owner => ({
      ...owner,
      schemaVersion: 1,
      inventory: owner.inventory?.map(item => ({ ...item })) ?? [],
      offers: owner.offers?.map(offer => ({ ...offer })) ?? [],
      acceptsDirectTransfers: owner.acceptsDirectTransfers === true
    })),
    version: 1
  };
  const operationId = opaqueId<OperationId>(`external-inventory-bootstrap:${input.campaignId}`);
  const requestPayload = { schemaVersion: 1, ownerRefs: payload.owners.map(owner => owner.ownerRef) };
  const fingerprint = await computeRequestFingerprint("external.inventory.bootstrap", 1, requestPayload);
  const now = input.clock.now().toISOString();
  const operation: OperationRecord = {
    schemaVersion: 1, operationId, campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(`external-inventory-bootstrap:${input.campaignId}`),
    idempotencyKey: opaqueId<IdempotencyKey>(`external-inventory-bootstrap:${input.campaignId}`),
    requestFingerprint: fingerprint, operationKind: "external.inventory.bootstrap",
    requestPayloadSchemaVersion: 1, requestPayload, phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision, commitId: null,
    completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null,
    failure: null, receivedAt: now, updatedAt: now
  };
  const received = await input.repository.receiveOperation(operation);
  if (!received.ok) throw new Error(received.error.messageKey);
  let phase: OperationPhase = received.value.phase;
  if (phase === "COMPLETED") return;
  if (phase === "RECEIVED") {
    const next = await input.repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
    if (!next.ok) throw new Error(next.error.messageKey);
    phase = next.value.phase;
  }
  if (phase === "PREPARING") {
    const next = await input.repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
    if (!next.ok) throw new Error(next.error.messageKey);
    phase = next.value.phase;
  }
  if (phase === "COMMITTED_PENDING_RENDER") {
    const done = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, { initialized: true });
    if (!done.ok) throw new Error(done.error.messageKey);
    return;
  }
  if (phase !== "READY_TO_COMMIT") throw new Error(`external inventory bootstrap cannot resume from ${phase}`);
  const lease = await input.repository.acquireWriterLease(input.campaignId, opaqueId<WriterId>(`${operationId}:writer`), 120_000);
  if (!lease.ok) throw new Error(lease.error.messageKey);
  const commandId = opaqueId<CommandId>(`${operationId}:command`);
  try {
    const committed = await input.repository.commit({
      campaignId: input.campaignId, operationId,
      commitId: opaqueId<CommitId>(`${operationId}:commit`),
      idempotencyKey: operation.idempotencyKey, requestFingerprint: fingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision, writerLease: lease.value,
      acceptedCommands: [{ schemaVersion: 1, contractId: "external-inventory-bootstrap", contractVersion: 1, commandId, campaignId: input.campaignId, operationId, commandType: "external.inventory.bootstrap", target: { aggregateType: EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, aggregateId: EXTERNAL_INVENTORY_AGGREGATE_ID_V1, expectedAggregateRevision: null }, payloadSchemaVersion: 1, payload: requestPayload, acceptedAtGameSecond: 0 }],
      aggregateWrites: [{ aggregateType: EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, aggregateId: EXTERNAL_INVENTORY_AGGREGATE_ID_V1, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload }],
      events: [{ schemaVersion: 1, eventId: opaqueId<EventId>(`${operationId}:event`), campaignId: input.campaignId, operationId, eventType: "external.inventory.initialized", origin: "SYSTEM", causation: { kind: "COMMAND", id: commandId }, aggregateRefs: [{ aggregateType: EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, aggregateId: EXTERNAL_INVENTORY_AGGREGATE_ID_V1, aggregateRevision: 0 }], visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0, payloadSchemaVersion: 1, payload: requestPayload }],
      outboxTasks: []
    });
    if (!committed.ok) throw new Error(committed.error.messageKey);
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, { initialized: true });
  if (!completed.ok) throw new Error(completed.error.messageKey);
}
