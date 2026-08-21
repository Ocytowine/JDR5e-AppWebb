import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import {
  NarrativeAppSurface,
  type NarrativeWorldSimulationBridgeV1
} from "../../../src/narration-ui/NarrativeAppSurface";
import { createExampleWorldState } from "../../../map-module/world-simulation/exampleScenario";
import {
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  createBrowserPersistentNarrativeTurnControllerV1,
  createCampaignWorldSimulationRuntimeV1,
  type CampaignWorldSimulationRuntimeV1
} from "../../src/application";
import type { JsonObject } from "../../src/core";

async function bootstrap() {
  let worldSimulationRuntime: CampaignWorldSimulationRuntimeV1 | null = null;
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: "jdr5e-world-event-ui-j1-natural-v1",
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    worldSceneLocationResolver: {
      resolveLocationRefs: () => ["district:valecroft-docks"]
    },
    initializeRepository: async (repository, campaignId, clock) => {
      worldSimulationRuntime = createCampaignWorldSimulationRuntimeV1({
        repository,
        campaignId,
        runtimeBindings: PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
        initialWorldState: JSON.parse(JSON.stringify(
          createExampleWorldState()
        )) as JsonObject,
        clock
      });
      const initialized = await worldSimulationRuntime.ensureInitialized();
      if (!initialized.ok) throw new Error(initialized.error.messageKey);
    }
  });
  if (worldSimulationRuntime === null) {
    throw new Error("campaign.world-simulation.runtime-missing");
  }
  return {
    controller,
    openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    worldSimulationRuntime
  };
}

function WorldEventTestSurface() {
  const [worldBridge, setWorldBridge] =
    useState<NarrativeWorldSimulationBridgeV1 | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const advanceWorld = async () => {
    if (worldBridge === null || advancing) return;
    setAdvancing(true);
    setAdvanceError(null);
    const advanced = await worldBridge.advance({
      clientRequestId: "world-event-ui-natural-hour-1",
      hours: 1
    });
    if (!advanced.ok) setAdvanceError(advanced.error.messageKey);
    setAdvancing(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={worldBridge === null || advancing}
        onClick={() => void advanceWorld()}
      >
        {advancing ? "Le monde avance…" : "Faire avancer le monde d’une heure"}
      </button>
      {advanceError !== null && <p role="alert">{advanceError}</p>}
      <NarrativeAppSurface
        bootstrapController={bootstrap}
        onWorldSimulationBridgeChange={bridge => setWorldBridge(bridge)}
      />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <WorldEventTestSurface />
);
