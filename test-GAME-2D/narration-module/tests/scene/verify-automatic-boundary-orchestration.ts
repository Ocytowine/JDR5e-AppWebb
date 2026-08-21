import assert from "node:assert/strict";
import {
  NarrativeTurnControllerV1,
  type NarrativeAutomaticBoundaryResultV1
} from "../../src/application";
import {
  MemoryCampaignRepository,
  opaqueId,
  type CampaignId
} from "../../src/core";
import type { DisplayPacketV1 } from "../../src/scene";

const campaignId = opaqueId<CampaignId>("campaign:j1-boundary-orchestration");

function packet(name: string): DisplayPacketV1 {
  return {
    schemaVersion: 1,
    contractVersion: "scene-social-ui/1",
    operationId: `operation:${name}`,
    sceneId: "scene:j1-boundary",
    displayBlocks: [],
    rawInputAccess: {
      available: false,
      operationId: `operation:${name}`
    },
    rhythmDiagnostics: null,
    reconstructionRefs: [],
    version: 1
  };
}

function harness(controlDecision: "RETURN_CONTROL" | "INTERRUPT_FOR_PLAYER_DECISION") {
  const controller = new NarrativeTurnControllerV1({
    repository: new MemoryCampaignRepository(),
    campaignId
  });
  const calls: string[] = [];
  const replaceable = controller as unknown as {
    bastionTacticalRuntime: object | null;
    processCommittedBastionCauseBoundary(input: {
      sourceOperationId: string;
      sourceEventId: string;
    }): Promise<unknown>;
    processActiveCausalSceneBoundary(input: { schemaVersion: 1 }): Promise<unknown>;
    processActiveSceneEntrySocialBoundary(input: {
      schemaVersion: 1;
      playerActorId?: string;
    }): Promise<unknown>;
    processActiveLocalTimeSocialBoundary(input: {
      schemaVersion: 1;
      sourceOperationId: string;
      playerActorId?: string;
    }): Promise<unknown>;
  };
  replaceable.bastionTacticalRuntime = {};
  replaceable.processCommittedBastionCauseBoundary = async input => {
    calls.push(`bastion:${input.sourceEventId}`);
    return {
      ok: true,
      value: { projection: { displayPacket: packet("bastion") } }
    };
  };
  replaceable.processActiveCausalSceneBoundary = async () => {
    calls.push("causal");
    return {
      ok: true,
      value: {
        bundle: { controlDecision },
        displayPacket: packet("causal")
      }
    };
  };
  replaceable.processActiveSceneEntrySocialBoundary = async () => {
    calls.push("social:scene-entry");
    return {
      ok: true,
      value: { displayPacket: packet("social-entry") }
    };
  };
  replaceable.processActiveLocalTimeSocialBoundary = async () => {
    calls.push("social:local-time");
    return {
      ok: true,
      value: { displayPacket: packet("social-time") }
    };
  };
  return { controller, calls };
}

async function ok(
  result: Awaited<ReturnType<NarrativeTurnControllerV1["processAutomaticBoundaries"]>>
): Promise<NarrativeAutomaticBoundaryResultV1> {
  if (result.ok === false) throw new Error("automatic boundary should succeed");
  return result.value;
}

async function run(): Promise<void> {
  const noCommit = harness("RETURN_CONTROL");
  const noCommitResult = await ok(await noCommit.controller.processAutomaticBoundaries({
    schemaVersion: 1,
    sourceOperationId: "operation:no-commit",
    sourceKind: "COMMITTED_ACTION",
    commitApplied: false,
    timeAdvanced: false,
    sceneEntry: false,
    causalChange: false
  }));
  assert.deepEqual(noCommit.calls, []);
  assert.deepEqual(noCommitResult.displayPackets, []);
  assert.equal(noCommitResult.trace[0]?.status, "SKIPPED");

  const invalid = await noCommit.controller.processAutomaticBoundaries({
    schemaVersion: 1,
    sourceOperationId: "operation:invalid-no-commit-time",
    sourceKind: "REST_SEGMENT",
    commitApplied: false,
    timeAdvanced: true,
    sceneEntry: false,
    causalChange: false
  });
  assert.equal(invalid.ok, false, "time cannot trigger reactions without a commit");

  const world = harness("RETURN_CONTROL");
  const worldResult = await ok(await world.controller.processAutomaticBoundaries({
    schemaVersion: 1,
    sourceOperationId: "operation:world-advance",
    sourceKind: "WORLD_TIME_ADVANCE",
    commitApplied: true,
    timeAdvanced: true,
    sceneEntry: false,
    causalChange: true,
    bastionCauses: [{
      schemaVersion: 1,
      sourceEventId: "event:world-advance"
    }]
  }));
  assert.deepEqual(world.calls, [
    "bastion:event:world-advance",
    "causal",
    "social:local-time"
  ]);
  assert.deepEqual(
    worldResult.displayPackets.map(entry => entry.operationId),
    ["operation:bastion", "operation:causal", "operation:social-time"]
  );

  const interrupted = harness("INTERRUPT_FOR_PLAYER_DECISION");
  const interruptedResult = await ok(
    await interrupted.controller.processAutomaticBoundaries({
      schemaVersion: 1,
      sourceOperationId: "operation:world-interruption",
      sourceKind: "WORLD_TIME_ADVANCE",
      commitApplied: true,
      timeAdvanced: true,
      sceneEntry: false,
      causalChange: true
    })
  );
  assert.deepEqual(interrupted.calls, ["causal"]);
  assert.equal(interruptedResult.controlDecision, "INTERRUPT_FOR_PLAYER_DECISION");
  assert.equal(interruptedResult.trace.at(-1)?.kind, "SOCIAL_INITIATIVE");
  assert.equal(interruptedResult.trace.at(-1)?.status, "SKIPPED");

  const entry = harness("RETURN_CONTROL");
  await ok(await entry.controller.processAutomaticBoundaries({
    schemaVersion: 1,
    sourceOperationId: "operation:scene-entry",
    sourceKind: "SCENE_TRANSITION",
    commitApplied: true,
    timeAdvanced: true,
    sceneEntry: true,
    causalChange: true
  }));
  assert.deepEqual(entry.calls, ["causal", "social:scene-entry"]);

  const activeRest = harness("RETURN_CONTROL");
  await ok(await activeRest.controller.processAutomaticBoundaries({
    schemaVersion: 1,
    sourceOperationId: "operation:rest-active",
    sourceKind: "REST_SEGMENT",
    commitApplied: true,
    timeAdvanced: true,
    sceneEntry: false,
    causalChange: true,
    allowSocialInitiative: true
  }));
  assert.deepEqual(activeRest.calls, ["causal", "social:local-time"]);

  const finishedRest = harness("RETURN_CONTROL");
  await ok(await finishedRest.controller.processAutomaticBoundaries({
    schemaVersion: 1,
    sourceOperationId: "operation:rest-finished",
    sourceKind: "REST_SEGMENT",
    commitApplied: true,
    timeAdvanced: true,
    sceneEntry: false,
    causalChange: true,
    allowSocialInitiative: false
  }));
  assert.deepEqual(finishedRest.calls, ["causal"]);

  const tactical = harness("RETURN_CONTROL");
  await ok(await tactical.controller.processAutomaticBoundaries({
    schemaVersion: 1,
    sourceOperationId: "operation:tactical-integration",
    sourceKind: "TACTICAL_INTEGRATION",
    commitApplied: true,
    timeAdvanced: true,
    sceneEntry: false,
    causalChange: true
  }));
  assert.deepEqual(tactical.calls, ["causal", "social:local-time"]);

  const activation = harness("RETURN_CONTROL");
  await ok(await activation.controller.processAutomaticBoundaries({
    schemaVersion: 1,
    sourceOperationId: "operation:campaign-activation",
    sourceKind: "CAMPAIGN_ACTIVATION",
    commitApplied: true,
    timeAdvanced: false,
    sceneEntry: true,
    causalChange: true
  }));
  assert.deepEqual(activation.calls, ["causal", "social:scene-entry"]);

  console.log("automatic-boundary-orchestration: all migrated paths verified");
}

void run();
