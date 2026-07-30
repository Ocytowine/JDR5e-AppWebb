import {
  opaqueId,
  type AggregateId,
  type JsonObject,
  type RepositoryClock,
  type Result
} from "../../src/core";
import {
  MemoryCampaignBootstrapRepository
} from "../../src/bootstrap";
import {
  CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  createCampaignWorldSimulationRuntimeV1,
  type CampaignRuntimeBindingsV1
} from "../../src/application";
import {
  createExampleWorldState
} from "../../../map-module/world-simulation/exampleScenario";
import {
  campaignBootstrapFixture
} from "../contracts/verify-campaign-bootstrap";
import { assert } from "../contracts/assertions";

class FixedClock implements RepositoryClock {
  now(): Date {
    return new Date("2026-07-30T10:00:00.000Z");
  }
}

function ok<T>(result: Result<T>): T {
  if (!result.ok) {
    assert.fail(
      `${result.error.code}: ${result.error.messageKey} `
      + JSON.stringify(result.error.details)
    );
  }
  return result.value;
}

function aggregateId(value: string): AggregateId {
  return opaqueId<AggregateId>(value);
}

async function run(): Promise<void> {
  const clock = new FixedClock();
  const repository =
    new MemoryCampaignBootstrapRepository({ clock });
  const bootstrapRequest =
    await campaignBootstrapFixture(clock, "campaign_world_runtime");
  const bootstrapped =
    ok(await repository.bootstrapCampaign(bootstrapRequest));
  ok(await repository.completePresentation(
    bootstrapped.operation.operationId,
    "COMMITTED_RENDERED",
    1,
    { ready: true }
  ));
  const bindings: CampaignRuntimeBindingsV1 = {
    schemaVersion: 1,
    contractVersion: CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
    positionAggregateId: aggregateId("agg-world-test-position"),
    sceneLifecycleAggregateId: aggregateId("agg-world-test-scene"),
    scheduleAggregateId: aggregateId("agg-world-test-schedule"),
    simulationCursorAggregateId: aggregateId("agg-world-test-cursor"),
    processAggregateId: aggregateId("agg-world-test-process"),
    version: 1
  };
  const runtime = createCampaignWorldSimulationRuntimeV1({
    repository,
    campaignId: bootstrapped.campaign.campaignId,
    runtimeBindings: bindings,
    initialWorldState:
      JSON.parse(JSON.stringify(createExampleWorldState())) as JsonObject,
    clock
  });

  const initialized = ok(await runtime.ensureInitialized());
  assert.equal(initialized.elapsedGameSeconds, 0);
  assert.equal(initialized.worldSimulatedThrough, 0);

  const advanced = ok(await runtime.advance({
    clientRequestId: "campaign-world-runtime-advance-1h",
    hours: 1
  }));
  assert.equal(advanced.replayed, false);
  assert.equal(advanced.snapshot.elapsedGameSeconds, 3_600);
  assert.equal(advanced.snapshot.worldSimulatedThrough, 3_600);
  assert.equal(
    Number((advanced.snapshot.worldState.clock as JsonObject).tick),
    1
  );
  assert.equal(
    Number((advanced.snapshot.lastTickOutput as JsonObject).tick),
    1
  );

  const restored = ok(await runtime.restore());
  assert.equal(restored.elapsedGameSeconds, 3_600);
  assert.equal(restored.worldSimulatedThrough, 3_600);

  const replay = ok(await runtime.advance({
    clientRequestId: "campaign-world-runtime-advance-1h",
    hours: 1
  }));
  assert.equal(replay.replayed, true);
  assert.equal(replay.sourceEventId, advanced.sourceEventId);
  const events = ok(await repository.listEvents(
    bootstrapped.campaign.campaignId,
    null,
    100
  ));
  assert.equal(
    events.filter(event =>
      event.origin === "WORLD_SIMULATION"
      && event.eventType === "world.simulation-boundary.resolved"
    ).length,
    1
  );

  console.log(
    "PASS [campaign-world-simulation-runtime] init, atomic advance, restore and replay"
  );
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
