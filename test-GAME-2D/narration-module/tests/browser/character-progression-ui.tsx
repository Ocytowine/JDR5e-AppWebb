import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  CHARACTER_PROGRESSION_APPLICATION_CONTRACT_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  createBrowserPersistentNarrativeTurnControllerV1,
  type CharacterProgressionApplicationResultV1,
  type CharacterProgressionPublicSummaryV1
} from "../../src/application";
import {
  computeRequestFingerprint,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type CommitId,
  type EventDraft,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type WriterId
} from "../../src/core";

const applicationOperationId =
  opaqueId<OperationId>("character-progression-application:browser-6e-c");
const applicationCommitId =
  opaqueId<CommitId>("character-progression-application:browser-6e-c:commit");
const characterAggregateId = opaqueId<AggregateId>("character:browser-aryn");
const summary: CharacterProgressionPublicSummaryV1 = {
  schemaVersion: 1,
  characterId: "pc-aryn",
  characterDisplayName: "Aryn",
  previousGlobalLevel: 1,
  newGlobalLevel: 2,
  progressionLabel: "guerrier de niveau 2",
  grantedLabels: ["Fougue"]
};

async function ensureCommittedProgression(
  repository: CampaignRepository,
  campaignId: CampaignId,
  clock: RepositoryClock
): Promise<void> {
  const existing = await repository.getOperation(applicationOperationId);
  if (existing.ok) return;
  if (existing.error.code !== "NOT_FOUND") {
    throw new Error(`${existing.error.code}: ${existing.error.messageKey}`);
  }
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) throw new Error(`${campaign.error.code}: ${campaign.error.messageKey}`);
  const clockAggregate = await repository.getAggregate(
    campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!clockAggregate.ok) {
    throw new Error(`${clockAggregate.error.code}: ${clockAggregate.error.messageKey}`);
  }
  const occurredAtGameSecond = Number(clockAggregate.value.payload.elapsedGameSeconds);
  const requestPayload = {
    schemaVersion: 1,
    contractVersion: CHARACTER_PROGRESSION_APPLICATION_CONTRACT_V1,
    awardId: "award-browser-6e-c",
    choices: [{ kind: "CLASS", selectionRefs: ["class:fighter"] }]
  };
  const requestFingerprint = await computeRequestFingerprint(
    "character.progression.apply",
    1,
    requestPayload
  );
  const now = clock.now().toISOString();
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: applicationOperationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("browser-6e-c"),
    idempotencyKey: opaqueId<IdempotencyKey>("browser-6e-c"),
    requestFingerprint,
    operationKind: "character.progression.apply",
    requestPayloadSchemaVersion: 1,
    requestPayload,
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
  if (!received.ok) throw new Error(`${received.error.code}: ${received.error.messageKey}`);
  const preparing = await repository.transitionOperation(
    applicationOperationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) throw new Error(`${preparing.error.code}: ${preparing.error.messageKey}`);
  const ready = await repository.transitionOperation(
    applicationOperationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) throw new Error(`${ready.error.code}: ${ready.error.messageKey}`);
  const lease = await repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>("writer-browser-6e-c"),
    120_000
  );
  if (!lease.ok) throw new Error(`${lease.error.code}: ${lease.error.messageKey}`);
  try {
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "character-progression-authority",
      contractVersion: 1,
      commandId: opaqueId(`${applicationOperationId}:command`),
      campaignId,
      operationId: applicationOperationId,
      commandType: "character.progression.apply",
      target: {
        aggregateType: "character.state",
        aggregateId: characterAggregateId,
        expectedAggregateRevision: null
      },
      payloadSchemaVersion: 1,
      payload: {
        awardId: "award-browser-6e-c",
        characterId: "pc-aryn",
        validatorRef: "character-ruleset-validator:browser-6e-c"
      },
      acceptedAtGameSecond: occurredAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${applicationOperationId}:level-changed`),
      campaignId,
      operationId: applicationOperationId,
      eventType: "player_level_changed",
      origin: "RULE",
      causation: { kind: "COMMAND", id: command.commandId },
      aggregateRefs: [{
        aggregateType: "character.state",
        aggregateId: characterAggregateId,
        aggregateRevision: 0
      }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: summary
    };
    const committed = await repository.commit({
      campaignId,
      operationId: applicationOperationId,
      commitId: applicationCommitId,
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: "character.state",
        aggregateId: characterAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: {
          schemaVersion: 1,
          characterId: "pc-aryn",
          name: "Aryn",
          globalLevel: 2,
          privateFeatureRefs: ["action-surge"]
        }
      }],
      events: [event],
      outboxTasks: []
    });
    if (!committed.ok) {
      throw new Error(`${committed.error.code}: ${committed.error.messageKey}`);
    }
    const result: CharacterProgressionApplicationResultV1 = {
      schemaVersion: 1,
      status: "APPLIED",
      reasonCodes: ["RULESET_VALIDATED"],
      award: {
        schemaVersion: 1,
        awardId: "award-browser-6e-c",
        characterId: "pc-aryn",
        awardKind: "CLASS_LEVEL",
        status: "APPLIED",
        sourceOperationId: "mission-browser-6e-c",
        sourceEventId: "mission-browser-6e-c:completed",
        policyRef: "progression-policy:browser-6e-c",
        availableAtGameSecond: occurredAtGameSecond,
        appliedAtGameSecond: occurredAtGameSecond,
        requiredChoices: ["CLASS"],
        version: 2
      },
      publicSummary: summary,
      commitId: applicationCommitId,
      replayed: false
    };
    const completed = await repository.completePresentation(
      applicationOperationId,
      "COMMITTED_RENDERED",
      1,
      result
    );
    if (!completed.ok) throw new Error(`${completed.error.code}: ${completed.error.messageKey}`);
  } finally {
    await repository.releaseWriterLease(lease.value);
  }
}

async function bootstrap() {
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: "jdr5e-character-progression-ui-6e-c",
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    initializeRepository: ensureCommittedProgression
  });
  const projected = await controller.projectCharacterProgression({
    schemaVersion: 1,
    applicationOperationId,
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId
  });
  if (!projected.ok) {
    throw new Error(`${projected.error.code}: ${projected.error.messageKey}`);
  }
  return {
    controller,
    openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
