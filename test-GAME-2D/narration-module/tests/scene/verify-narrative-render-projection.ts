import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type RepositoryClock
} from "../../src/core";
import type { AiIncidentRecordV1 } from "../../src/ai/types";
import {
  NARRATIVE_RENDER_PROJECTION_CONTRACT_VERSION_V1,
  NarrativeTurnControllerV1,
  type AiNarrativeEnhancementResultV1
} from "../../src/application";

class FixedClock implements RepositoryClock {
  constructor(private readonly instant = new Date("2026-07-07T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.instant);
  }
}

async function main(): Promise<void> {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-render-projection-test");
  const clockAggregateId = opaqueId<AggregateId>("agg-render-projection-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    clock,
    idPrefix: "test"
  });
  const turn = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-render-projection-1",
    rawInput: "je dis bonjour au garde"
  });
  if (!turn.ok) throw new Error(turn.error.messageKey);

  const incident = aiIncident(turn.value.output.operationId);
  const enhancement: AiNarrativeEnhancementResultV1 = {
    schemaVersion: 1,
    contractVersion: "narrative-ai-resolution/1",
    enhanced: false,
    usedFallback: true,
    fallbackKind: "TECHNICAL_INCIDENT",
    displayPacket: turn.value.output.displayPacket,
    incidents: [incident],
    safetyNotes: ["Fallback déterministe conservé."]
  };
  const recorded = await controller.recordRenderedProjection({
    schemaVersion: 1,
    clientRequestId: turn.value.output.clientRequestId,
    sourceOutput: turn.value.output,
    mode: "openai",
    finalEnhancement: enhancement,
    attemptedEnhancement: enhancement,
    statusMessage: "OpenAI indisponible ou sortie refusée : fallback local utilisé."
  });
  if (!recorded.ok) throw new Error(recorded.error.messageKey);

  assert.equal(recorded.value.operation.operationKind, "narrative.render.projection");
  assert.equal(recorded.value.operation.completionMode, "NO_COMMIT_RESPONSE");
  assert.equal(recorded.value.operation.commitId, null);
  assert.equal(recorded.value.projection.contractVersion, NARRATIVE_RENDER_PROJECTION_CONTRACT_VERSION_V1);
  assert.equal(recorded.value.projection.authority, "PRESENTATION_ONLY");
  assert.equal(recorded.value.projection.noGameTime, true);
  assert.equal(recorded.value.projection.sourceOperationId, turn.value.output.operationId);
  assert.equal(recorded.value.projection.ai.finalUsedFallback, true);
  assert.equal(recorded.value.projection.ai.fallbackAttempted, true);
  assert.deepEqual(recorded.value.projection.ai.incidentIds, [incident.incidentId]);
  assert.equal(recorded.value.projection.incidents[0]?.safeDetails.rawProviderOutput, "[REDACTED]");
  assert.equal(JSON.stringify(recorded.value.projection).includes("sk-"), false, "projection persistée expurgée");

  const restored = await controller.restoreRenderedThread();
  if (!restored.ok) throw new Error(restored.error.messageKey);
  assert.equal(restored.value.contractVersion, "narrative-rendered-thread/1");
  assert.deepEqual(restored.value.restoredFromOperationIds, [recorded.value.operation.operationId]);
  assert.equal(restored.value.displayPackets.length, 1);
  assert.equal(restored.value.displayPackets[0]?.operationId, turn.value.output.operationId);
  assert.equal(restored.value.projections[0]?.displayPacketFingerprint, recorded.value.projection.displayPacketFingerprint);
  assert.deepEqual(restored.value.skippedOperationIds, []);

  const sourceAfterRecord = await repository.getOperation(turn.value.operation.operationId);
  if (!sourceAfterRecord.ok) throw new Error(sourceAfterRecord.error.messageKey);
  assert.equal(sourceAfterRecord.value.operationKind, "narrative.turn.input");
  assert.equal(sourceAfterRecord.value.resultPayloadSchemaVersion, 1);
  assert.equal(
    sourceAfterRecord.value.resultPayload?.contractVersion,
    "narrative-turn-controller/1",
    "l'opération métier source n'est pas remplacée par la projection de rendu"
  );

  const replay = await controller.recordRenderedProjection({
    schemaVersion: 1,
    clientRequestId: turn.value.output.clientRequestId,
    sourceOutput: turn.value.output,
    mode: "openai",
    finalEnhancement: enhancement,
    attemptedEnhancement: enhancement,
    statusMessage: "OpenAI indisponible ou sortie refusée : fallback local utilisé."
  });
  if (!replay.ok) throw new Error(replay.error.messageKey);
  assert.equal(replay.value.operation.operationId, recorded.value.operation.operationId);
  assert.deepEqual(replay.value.projection, recorded.value.projection);

  const badDisplayEnhancement: AiNarrativeEnhancementResultV1 = {
    ...enhancement,
    displayPacket: {
      ...enhancement.displayPacket,
      operationId: "another-operation"
    } as typeof enhancement.displayPacket
  };
  const rejected = await controller.recordRenderedProjection({
    schemaVersion: 1,
    clientRequestId: "req-render-projection-2",
    sourceOutput: turn.value.output,
    mode: "local",
    finalEnhancement: badDisplayEnhancement,
    attemptedEnhancement: null,
    statusMessage: "Mode local utilisé pour l'enrichissement."
  });
  assert.equal(rejected.ok, false, "projection désancrée rejetée");
  if (!rejected.ok) assert.equal(rejected.error.code, "VALIDATION_FAILED");

  console.log("narrative-render-projection/1: OK");
}

function aiIncident(operationId: string): AiIncidentRecordV1 {
  return {
    schemaVersion: 1,
    incidentId: `incident:${operationId}:scene-writer`,
    campaignId: "cmp-render-projection-test",
    operationId,
    callId: `${operationId}:ai:scene-writer:call`,
    attemptIds: [`${operationId}:ai:scene-writer:attempt:1`],
    role: "scene_writer",
    category: "SCHEMA_VIOLATION",
    severity: "WARNING",
    stage: "OUTPUT_VALIDATE",
    commitState: "NO_COMMIT",
    redacted: true,
    redactedFields: ["rawProviderOutput", "apiKey"],
    safeDetails: {
      outputDiagnostics: ["SCHEMA_VIOLATION"],
      rawProviderOutput: "[REDACTED]",
      apiKey: "[REDACTED]"
    },
    outcome: "DEGRADED"
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
