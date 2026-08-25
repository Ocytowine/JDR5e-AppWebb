import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import { buildOpenAiIntentInterpreterConfigV1 } from
  "../../../src/narration-ui/openAiNarrativeRuntimeConfig";
import {
  createPrototypeNarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type NarrativeInventoryAccessRuntimeV1
} from "../../src/application";

declare global {
  interface Window {
    __openAiOnlyG1: { domainCanHandleCalls: number; domainExecuteCalls: number };
  }
}

window.__openAiOnlyG1 = { domainCanHandleCalls: 0, domainExecuteCalls: 0 };

const forbiddenDomainRuntime: NarrativeInventoryAccessRuntimeV1 = {
  canHandle() {
    window.__openAiOnlyG1.domainCanHandleCalls += 1;
    return true;
  },
  async execute() {
    window.__openAiOnlyG1.domainExecuteCalls += 1;
    throw new Error("G1: un domaine ne doit jamais être appelé après une panne d'interprétation.");
  }
};

async function bootstrap() {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: buildOpenAiIntentInterpreterConfigV1(),
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    inventoryAccessRuntime: forbiddenDomainRuntime
  });
  return { controller, openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
