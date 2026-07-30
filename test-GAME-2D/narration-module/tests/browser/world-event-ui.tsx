import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  createBrowserPersistentNarrativeTurnControllerV1
} from "../../src/application";
import {
  computeRequestFingerprint,
  opaqueId,
  type CampaignId,
  type CampaignRepository,
  type AggregateId,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type WriterId
} from "../../src/core";

async function ensureCommittedWorldEvent(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<void> {
  const operationId = opaqueId<OperationId>("browser-world-simulation-boundary-6d");
  const existing = await repository.getOperation(operationId);
  if (existing.ok && existing.value.phase === "COMPLETED") return;
  if (existing.ok) throw new Error("world fixture operation is incomplete");
  if (existing.error.code !== "NOT_FOUND") throw new Error(existing.error.messageKey);
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) throw new Error(campaign.error.messageKey);
  const clock = await repository.getAggregate(campaignId, "world.clock", campaign.value.clockAggregateId);
  if (!clock.ok) throw new Error(clock.error.messageKey);
  const payload = { simulationId: "browser-world-simulation-6d", throughGameSecond: 0 };
  const cursorAggregateId = opaqueId<AggregateId>("agg-browser-world-simulation-cursor-6d");
  const fingerprint = await computeRequestFingerprint("world.simulation.boundary", 1, payload);
  const now = new Date("2026-07-28T22:00:00.000Z").toISOString();
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("browser-world-simulation-boundary-6d"),
    idempotencyKey: opaqueId<IdempotencyKey>("browser-world-simulation-boundary-6d"),
    requestFingerprint: fingerprint,
    operationKind: "world.simulation.boundary",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  const received = await repository.receiveOperation(operation);
  if (!received.ok) throw new Error(received.error.messageKey);
  const preparing = await repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) throw new Error(preparing.error.messageKey);
  const ready = await repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
  if (!ready.ok) throw new Error(ready.error.messageKey);
  const lease = await repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>(`${operationId}:writer`),
    120_000
  );
  if (!lease.ok) throw new Error(lease.error.messageKey);
  try {
    const committed = await repository.commit({
      campaignId,
      operationId,
      commitId: opaqueId<CommitId>(`${operationId}:commit`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: fingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: lease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "world-simulation-adapter-fixture",
        contractVersion: 1,
        commandId: opaqueId<CommandId>(`${operationId}:command`),
        campaignId,
        operationId,
        commandType: "world.simulation.boundary",
        target: {
          aggregateType: "world.simulation-cursor",
          aggregateId: cursorAggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload,
        acceptedAtGameSecond: 0
      }],
      aggregateWrites: [{
        aggregateType: "world.simulation-cursor",
        aggregateId: cursorAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: {
          schemaVersion: 1,
          worldSimulatedThrough: 0,
          tick: 0,
          microTick: 0,
          macroTick: 0,
          secondsPerMicroTick: 3_600,
          microPerMacro: 6
        }
      }],
      events: [{
        schemaVersion: 1,
        eventId: opaqueId<EventId>(`${operationId}:event`),
        campaignId,
        operationId,
        eventType: "world.simulation-boundary.resolved",
        origin: "WORLD_SIMULATION",
        causation: { kind: "COMMAND", id: `${operationId}:command` },
        aggregateRefs: [{
          aggregateType: "world.simulation-cursor",
          aggregateId: cursorAggregateId,
          aggregateRevision: 0
        }],
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: 0,
        payloadSchemaVersion: 1,
        payload: {
          tickOutput: {
            tick: 0,
            scale: "micro",
            events: [{
              id: "private-world-event",
              actor: { kind: "faction", id: "private-faction" },
              payload: { actionId: "private-action" }
            }],
            deltas: [],
            signals: [{
              id: "signal-browser-loud-bells",
              kind: "auditory",
              location: { kind: "district", id: "reference_inn" },
              intensity: 82,
              tags: ["private-action"],
              payload: { actorId: "private-faction", actionId: "private-action" }
            }]
          }
        }
      }],
      outboxTasks: []
    });
    if (!committed.ok) throw new Error(`${committed.error.code}: ${committed.error.messageKey} ${JSON.stringify(committed.error.details)}`);
    const completed = await repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, payload);
    if (!completed.ok) throw new Error(completed.error.messageKey);
  } finally {
    await repository.releaseWriterLease(lease.value);
  }
}

async function bootstrap() {
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: "jdr5e-world-event-ui-6d-v3",
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    worldSceneLocationResolver: {
      resolveLocationRefs: () => ["district:reference_inn"]
    },
    initializeRepository: ensureCommittedWorldEvent
  });
  return { controller, openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
