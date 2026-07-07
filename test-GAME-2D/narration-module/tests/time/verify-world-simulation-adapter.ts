import { computeJsonFingerprint, type JsonObject } from "../../src/core/index";
import { MapModuleWorldSimulationAdapterV1 } from "../../src/time";
import { createExampleWorldState } from "../../../map-module/world-simulation/exampleScenario";
import { assert } from "../contracts/assertions";

function snapshot(): JsonObject {
  return JSON.parse(JSON.stringify(createExampleWorldState())) as JsonObject;
}

function cursor() {
  return {
    schemaVersion: 1 as const,
    worldSimulatedThrough: 0,
    tick: 0,
    microTick: 0,
    macroTick: 0,
    secondsPerMicroTick: 3_600,
    microPerMacro: 6
  };
}

async function simulate(hours: number) {
  const worldState = snapshot();
  const worldStateFingerprint = await computeJsonFingerprint(worldState) as `sha256:${string}`;
  const adapter = new MapModuleWorldSimulationAdapterV1();
  const result = await adapter.simulate({
    schemaVersion: 1,
    simulationId: `simulation-${hours}h`,
    currentGameSecond: 0,
    targetGameSecond: hours * 3_600,
    hoursToProcess: hours,
    cursor: cursor(),
    worldStateFingerprint,
    worldState
  });
  return { result, source: worldState, sourceFingerprint: worldStateFingerprint };
}

async function run(): Promise<void> {
  const oneHour = await simulate(1);
  assert.equal(oneHour.result.ok, true);
  if (oneHour.result.ok) {
    assert.equal(oneHour.result.value.cursor.tick, 1);
    assert.equal(oneHour.result.value.cursor.microTick, 1);
    assert.equal(oneHour.result.value.cursor.macroTick, 0);
    assert.equal(oneHour.result.value.worldSimulatedThrough, 3_600);
    assert.ok(/^sha256:[0-9a-f]{64}$/.test(oneHour.result.value.resultFingerprint));
  }
  assert.equal(await computeJsonFingerprint(oneHour.source), oneHour.sourceFingerprint, "The adapter must not mutate its input snapshot.");
  console.log("PASS [world-simulation-adapter] one CampaignClock hour produces one derived microtick on a copy");

  const sixHours = await simulate(6);
  const repeated = await simulate(6);
  assert.deepEqual(sixHours.result, repeated.result);
  assert.equal(sixHours.result.ok, true);
  if (sixHours.result.ok) {
    assert.equal(sixHours.result.value.cursor.tick, 6);
    assert.equal(sixHours.result.value.cursor.microTick, 0);
    assert.equal(sixHours.result.value.cursor.macroTick, 1);
    assert.equal(sixHours.result.value.tickOutput.tick, 6);
  }
  console.log("PASS [world-simulation-adapter] six hours produce one macro boundary deterministically");

  const state = snapshot();
  const fingerprint = await computeJsonFingerprint(state) as `sha256:${string}`;
  const adapter = new MapModuleWorldSimulationAdapterV1();
  const zero = await adapter.simulate({
    schemaVersion: 1,
    simulationId: "simulation-zero",
    currentGameSecond: 0,
    targetGameSecond: 0,
    hoursToProcess: 0,
    cursor: cursor(),
    worldStateFingerprint: fingerprint,
    worldState: state
  });
  assert.equal(zero.ok, false);
  const tampered = await adapter.simulate({
    schemaVersion: 1,
    simulationId: "simulation-tampered",
    currentGameSecond: 0,
    targetGameSecond: 3_600,
    hoursToProcess: 1,
    cursor: cursor(),
    worldStateFingerprint: `sha256:${"0".repeat(64)}`,
    worldState: state
  });
  assert.equal(tampered.ok, false);
  console.log("PASS [world-simulation-adapter] zero duration and snapshot mismatch are rejected before simulation");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
