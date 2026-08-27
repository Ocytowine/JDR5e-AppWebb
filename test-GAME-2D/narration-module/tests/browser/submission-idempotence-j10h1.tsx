import React from "react";
import ReactDOM from "react-dom/client";
import {
  createPrototypeNarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  createConversationSemanticConfigH0,
  dialogueFixtureH0
} from "../fixtures/conversation-semantic-fixtures-h0";

const RAW_INPUT = "Je salue le garde blessé.";
const CALL_IDS_KEY = "j10h1-browser-call-ids";
const HOLD_KEY = "j10h1-browser-hold";
const FAIL_NEXT_KEY = "j10h1-browser-fail-next";

declare global {
  interface Window {
    __j10h1Release?: () => void;
  }
}

async function bootstrap() {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: createConversationSemanticConfigH0([
      dialogueFixtureH0({
        fixtureId: "browser-guard-greeting",
        rawInput: RAW_INPUT,
        meaning: "Le personnage salue le garde blessé visible.",
        targetRef: "npc:npc-garde-blesse",
        targetSurface: "le garde blessé"
      })
    ]),
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    sceneTransitionRuntime: null,
    interpreterCharacterContextResolver: null
  });
  const submit = controller.submit.bind(controller);
  controller.submit = async input => {
    const callIds = JSON.parse(window.sessionStorage.getItem(CALL_IDS_KEY) ?? "[]") as string[];
    callIds.push(input.clientRequestId);
    window.sessionStorage.setItem(CALL_IDS_KEY, JSON.stringify(callIds));
    if (window.sessionStorage.getItem(FAIL_NEXT_KEY) === "1") {
      window.sessionStorage.removeItem(FAIL_NEXT_KEY);
      throw new Error("simulated-submit-failure-before-result");
    }
    if (window.sessionStorage.getItem(HOLD_KEY) === "1") {
      await new Promise<void>(resolve => {
        window.__j10h1Release = resolve;
      });
    }
    return submit(input);
  };
  return { controller, openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><NarrativeAppSurface bootstrapController={bootstrap} /></React.StrictMode>
);
