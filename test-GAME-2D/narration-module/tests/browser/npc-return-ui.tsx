import React from "react";
import ReactDOM from "react-dom/client";
import { NarrativeAppSurface } from "../../../src/narration-ui/NarrativeAppSurface";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
  createBrowserPersistentNarrativeTurnControllerV1,
  createDefaultAiIntentInterpreterConfigV1,
  createDefaultNpcPerformerConfigV1,
  LocalNpcPerformerProviderV1,
  PROTOTYPE_INN_BACK_ROOM_SCENE_V1,
  PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";
import type { AiCallRequestV1, AiRoleOutputEnvelopeV1, AiSemanticIntentPayloadV2 } from "../../src/ai/types";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type { NarrativeTurnControllerV1 } from "../../src/application";

declare global {
  interface Window {
    __npcReturnController?: NarrativeTurnControllerV1;
  }
}

const ambientActorId = "reference-inn-rain-001:ambient:copiste";
const commonRoom = {
  ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  ambientPopulation: [{
    schemaVersion: 1 as const,
    actorId: ambientActorId,
    displayName: "Copiste itinérant",
    publicRole: "Copiste de passage",
    visibleActivity: "classe des feuillets près d'une chandelle",
    visibleAppearance: "manteau de voyage sombre, doigts tachés d'encre et étui à parchemins usé",
    demeanor: "méthodique et réservé",
    immediateGoal: "remettre ses notes en ordre avant son départ",
    currentPressure: "la pluie retarde son départ",
    speechStyle: ["phrases précises", "ton mesuré"],
    conversationalHooks: ["voyage", "écriture", "Auberge du Seuil"],
    boundaries: ["ne prétend connaître que ce qu'il a vu ou recopié", "ne s'engage pas durablement"],
    knowledgeRefs: ["reference-scene:reference-inn-rain-001"],
    keywords: ["copiste", "scribe", "voyageur", "homme aux parchemins"],
    version: 1 as const
  }]
};

const intentProvider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const rawInput = (call.input.task as { rawInput: string }).rawInput;
    const enterBackRoom = rawInput.includes("arrière-salle");
    const returnToCommonRoom = rawInput.includes("retourne dans la salle commune");
    const transition = enterBackRoom || returnToCommonRoom;
    const question = rawInput.includes("?");
    const payload: AiSemanticIntentPayloadV2 = {
      rawInputEcho: rawInput,
      intent: {
        kind: transition ? "traverse_visible_boundary" : "address_visible_actor",
        commitment: "committed",
        preconditions: [],
        playerGoal: transition
          ? returnToCommonRoom ? "Revenir dans la salle commune." : "Entrer dans l'arrière-salle."
          : question ? "Obtenir une réponse du copiste." : "Saluer le copiste.",
        actionHint: transition ? "franchir" : "parler",
        domainHint: transition ? "world" : "social",
        scope: transition ? "SCENE_TRANSITION" : "SOCIAL_EXCHANGE",
        targetMention: transition
          ? returnToCommonRoom
            ? { surface: "la porte vers la salle commune", candidateKind: "object", proposedRef: "poi:common-room-door", contextLink: "EXPLICIT" }
            : { surface: "la porte du fond", candidateKind: "object", proposedRef: "poi:back-room-door", contextLink: "EXPLICIT" }
          : { surface: question && rawInput.includes("lui") ? "lui" : "le copiste", candidateKind: "npc", proposedRef: `npc:${ambientActorId}`, contextLink: question && rawInput.includes("lui") ? "RECENT_FOCUS" : "EXPLICIT" },
        perception: null,
        dialogueAct: transition ? null : {
          act: question ? "ASK_QUESTION" : "INITIATE_CONVERSATION",
          contentGoal: question ? rawInput : "Établir un premier contact poli."
        },
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
  const intentBase = createDefaultAiIntentInterpreterConfigV1();
  const performerBase = createDefaultNpcPerformerConfigV1();
  const controller = await createBrowserPersistentNarrativeTurnControllerV1({
    databaseName: "jdr5e-npc-return-ui-j1-quality-v1",
    initialScene: { scene: commonRoom, locationRef: "location:inn-common-room" },
    intentInterpreterConfig: {
      ...intentBase,
      provider: intentProvider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2,
      route: { ...intentBase.route, allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V2] }
    },
    npcPerformerConfig: { ...performerBase, provider: new LocalNpcPerformerProviderV1() },
    mjPlannerConfig: null,
    activeSceneResolver: {
      async resolve({ repository, campaignId }) {
        const lifecycle = await repository.getAggregate(campaignId, "scene.lifecycle", PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1);
        if (!lifecycle.ok) return lifecycle;
        return {
          ok: true as const,
          value: lifecycle.value.payload.activeSceneId === PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId
            ? PROTOTYPE_INN_BACK_ROOM_SCENE_V1
            : commonRoom
        };
      }
    }
  });
  window.__npcReturnController = controller;
  return { controller, openingScene: commonRoom };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <NarrativeAppSurface bootstrapController={bootstrap} />
);
