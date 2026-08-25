import React from "react";
import ReactDOM from "react-dom/client";
import {
  createPrototypeNarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type NarrativeInventoryTransactionRuntimeV1
} from "../../src/application";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import { OPEN_SEMANTIC_CORPUS_G6 } from "../fixtures/open-semantic-corpus-g6";
import { createSimulatedOpenAiSemanticConfigG6 } from "../fixtures/simulated-openai-semantic-provider-g6";

const corpusCase = OPEN_SEMANTIC_CORPUS_G6.find(entry => entry.caseId === "inventory-transfer");
if (corpusCase === undefined) throw new Error("Missing inventory-transfer fixture.");

declare global {
  interface Window {
    __g7OwnerCapture?: { rawInput: string; semanticSource: string | null; capabilityId: unknown };
  }
}

const owner: NarrativeInventoryTransactionRuntimeV1 = {
  canHandle(input) {
    window.__g7OwnerCapture = {
      rawInput: input.rawInput,
      semanticSource: input.interpretation.semanticSource ?? null,
      capabilityId: input.domainCommand?.payload.capabilityId ?? null
    };
    return false;
  },
  async execute() {
    throw new Error("The rejecting G7 owner must not execute.");
  }
};

async function bootstrap() {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createSimulatedOpenAiSemanticConfigG6([corpusCase]),
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    sceneTransitionRuntime: null,
    interpreterCharacterContextResolver: null,
    inventoryTransactionRuntime: owner
  });
  return { controller, openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><NarrativeAppSurface bootstrapController={bootstrap} /></React.StrictMode>
);
