import assert from "node:assert/strict";
import { opaqueId, type EventRecord } from "../../src/core";
import {
  SCENE_EVENT_BUNDLE_CONTRACT_V1,
  adaptCommittedWorldSimulationEventsV1,
  composeCausalSceneEventBundlesV1,
  type SceneEventBundleV1
} from "../../src/application";
import { planNextTemporalBatchV1, type TemporalTaskV1 } from "../../src/time";

function worldEvent(): EventRecord {
  return {
    schemaVersion: 1,
    eventId: opaqueId("event-world-simulation-hour-6"),
    campaignId: opaqueId("campaign-world-scene-6d"),
    operationId: opaqueId("operation-world-simulation-hour-6"),
    commitId: opaqueId("commit-world-simulation-hour-6"),
    eventType: "world.simulation-boundary.resolved",
    origin: "WORLD_SIMULATION",
    causation: { kind: "COMMAND", id: "command-world-simulation-hour-6" },
    aggregateRefs: [],
    visibility: { scope: "SYSTEM", actorIds: [] },
    occurredAtGameSecond: 21_600,
    payloadSchemaVersion: 1,
    payload: {
      tickOutput: {
        tick: 6,
        scale: "macro",
        events: [{
          id: "internal-event-patrol",
          actor: { kind: "faction", id: "secret-faction-id" },
          type: "action_resolved",
          payload: { actionId: "infiltrate", objectiveId: "secret-objective" }
        }],
        deltas: [{
          target: { kind: "district", id: "archives_de_lysenthe" },
          key: "surveillance",
          before: 20,
          after: 45
        }],
        signals: [{
          id: "signal-local-bells",
          kind: "auditory",
          location: { kind: "district", id: "archives_de_lysenthe" },
          intensity: 82,
          tags: ["infiltrate", "secret-faction"],
          payload: { actorId: "secret-faction-id", actionId: "infiltrate" }
        }, {
          id: "signal-distant-market",
          kind: "market",
          location: { kind: "district", id: "river_market" },
          intensity: 90,
          tags: ["extort"],
          payload: { actorId: "other-secret-faction", actionId: "extort" }
        }]
      }
    },
    recordedAt: "2026-07-28T21:00:00.000Z",
    commitSequence: 8,
    eventSequence: 0
  };
}

function plotBundle(): SceneEventBundleV1 {
  return {
    schemaVersion: 1,
    contractVersion: SCENE_EVENT_BUNDLE_CONTRACT_V1,
    sceneId: "wiki-location:archives_de_lysenthe",
    throughGameSecond: 21_600,
    perceptions: [{
      effectRef: "plot-effect:register:dust",
      eventRef: "plot-event:register:moved",
      sourceOperationId: null,
      sourceKind: "PLOT",
      effectiveAtGameSecond: 18_000,
      causalOrder: "plot:register:moved:dust",
      presentation: "INFERENCE",
      text: "La poussière de l'étagère est interrompue par une marque récente.",
      sourceRefs: ["plot-event:register:moved", "plot-effect:register:dust"],
      interruptsPlayer: false
    }],
    excludedEffectCount: 1,
    controlDecision: "RETURN_CONTROL",
    version: 1
  };
}

async function main(): Promise<void> {
  const tasks: TemporalTaskV1[] = [{
    schemaVersion: 1,
    taskId: "world-boundary-hour-6",
    taskKind: "WORLD_SIMULATION_BOUNDARY",
    dueAtGameSecond: 21_600,
    boundaryPolicy: "BEFORE_ACTIVITY_COMPLETION",
    dependsOnTaskIds: [],
    payload: { simulatedThrough: 21_600 }
  }, {
    schemaVersion: 1,
    taskId: "rest-or-travel-completion",
    taskKind: "ACTIVITY_COMPLETION",
    dueAtGameSecond: 25_200,
    boundaryPolicy: "SIMULTANEOUS",
    dependsOnTaskIds: [],
    payload: { requestedTargetGameSecond: 25_200 }
  }];
  const temporalBoundary = await planNextTemporalBatchV1({
    batchId: "batch-world-interruption-6d",
    currentGameSecond: 18_000,
    requestedTargetGameSecond: 25_200,
    tasks
  });
  assert.equal(temporalBoundary.ok, true);
  if (temporalBoundary.ok) {
    assert.equal(
      temporalBoundary.value?.effectiveAtGameSecond,
      21_600,
      "l'avance s'arrête exactement à la frontière monde avant la fin d'activité"
    );
    assert.deepEqual(
      temporalBoundary.value?.orderedTasks.map(value => value.taskId),
      ["world-boundary-hour-6"]
    );
  }

  const world = adaptCommittedWorldSimulationEventsV1({
    events: [worldEvent()],
    sceneId: "wiki-location:archives_de_lysenthe",
    sceneLocationRefs: ["district:archives_de_lysenthe"],
    throughGameSecond: 21_600
  });
  assert.equal(world.ok, true);
  if (!world.ok) return;
  assert.equal(world.value.perceptions.length, 1, "seul le signal local est projeté");
  assert.equal(world.value.excludedEffectCount, 1, "le signal distant reste committé mais exclu");
  assert.equal(world.value.controlDecision, "INTERRUPT_FOR_PLAYER_DECISION");
  assert.equal(world.value.perceptions[0]?.sourceKind, "WORLD_SIMULATION");
  assert.equal(world.value.perceptions[0]?.interruptsPlayer, true);
  const publicProjection = JSON.stringify(world.value);
  for (const forbidden of ["secret-faction-id", "secret-objective", "infiltrate", "extort", "surveillance"]) {
    assert.equal(publicProjection.includes(forbidden), false, `${forbidden} ne traverse pas l'adaptateur`);
  }

  const composed = composeCausalSceneEventBundlesV1([world.value, plotBundle()]);
  assert.equal(composed.ok, true);
  if (!composed.ok) return;
  assert.deepEqual(
    composed.value.perceptions.map(value => value.sourceKind),
    ["PLOT", "WORLD_SIMULATION"],
    "l'ordre causal utilise l'instant autoritaire avant l'origine"
  );
  assert.equal(composed.value.controlDecision, "INTERRUPT_FOR_PLAYER_DECISION");
  assert.equal(composed.value.excludedEffectCount, 2);

  const distantScene = adaptCommittedWorldSimulationEventsV1({
    events: [worldEvent()],
    sceneId: "wiki-location:other",
    sceneLocationRefs: ["district:other"],
    throughGameSecond: 21_600
  });
  assert.equal(distantScene.ok, true);
  if (distantScene.ok) {
    assert.equal(distantScene.value.perceptions.length, 0);
    assert.equal(distantScene.value.controlDecision, "RETURN_CONTROL");
  }

  console.log("world-simulation scene adapter + causal SceneEventBundle: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
