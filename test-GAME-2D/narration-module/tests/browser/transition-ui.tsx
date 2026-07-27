import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
  createDefaultAiIntentInterpreterConfigV1,
  createPrototypeNarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV2
} from "../../src/ai/types";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";

const provider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const rawInput = (call.input.task as { rawInput: string }).rawInput;
    const returning = rawInput.includes("salle commune");
    const observing = rawInput.includes("Que vois-je");
    const approachingLamp = rawInput.includes("m'approche de la lampe");
    const examiningTraces = rawInput.includes("J'examine les traces");
    const perception = observing || examiningTraces;
    const targetMention = observing
      ? null
      : approachingLamp
        ? { surface: "la lampe basse", candidateKind: "object" as const, proposedRef: "element:low-lamp", contextLink: "EXPLICIT" as const }
      : examiningTraces
        ? { surface: "les traces humides", candidateKind: "object" as const, proposedRef: "element:wet-traces", contextLink: "EXPLICIT" as const }
      : returning
        ? { surface: "la porte vers la salle commune", candidateKind: "object" as const, proposedRef: "poi:common-room-door", contextLink: "EXPLICIT" as const }
        : { surface: "la porte du fond", candidateKind: "object" as const, proposedRef: "poi:back-room-door", contextLink: "EXPLICIT" as const };
    const payload: AiSemanticIntentPayloadV2 = {
      rawInputEcho: rawInput,
      intent: {
        kind: perception ? "observe_environment" : approachingLamp ? "move_near_visible_actor" : "traverse_visible_boundary",
        commitment: "committed",
        preconditions: [],
        playerGoal: observing
          ? "Observer la scène actuelle."
          : approachingLamp
            ? "Se placer près de la lampe basse."
            : examiningTraces
              ? "Examiner attentivement les traces humides."
              : returning
                ? "Revenir dans la salle commune."
                : "Entrer dans l'arrière-salle.",
        actionHint: perception ? "observer" : approachingLamp ? "approcher" : "franchir",
        domainHint: perception ? "perception" : approachingLamp ? "scene_resolution" : "world",
        scope: perception ? "PERCEPTION" : approachingLamp ? "LOCAL_INTERACTION" : "SCENE_TRANSITION",
        targetMention,
        perception: perception
          ? {
            schemaVersion: 1,
            depth: examiningTraces ? "FOCUSED" : "GLANCE",
            focus: examiningTraces ? "traces humides" : "scène actuelle",
            soughtInformation: "éléments visibles"
          }
          : null,
        dialogueAct: null,
        uncertainties: [],
        clarificationPrompt: null,
        confidence: "high"
      }
    };
    return {
      schemaVersion: 1,
      contractVersion: call.contractVersion,
      outputId: `output:${call.attemptId}`,
      callId: call.callId,
      attemptId: call.attemptId,
      packId: call.packId,
      snapshotId: call.snapshotId,
      role: call.role,
      status: "OK",
      payload,
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV2>;
  }
};

async function bootstrap() {
  const base = createDefaultAiIntentInterpreterConfigV1();
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: {
      ...base,
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
      route: { ...base.route, allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2] }
    },
    mjPlannerConfig: null,
    npcPerformerConfig: null
  });
  return { controller, openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1 };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
