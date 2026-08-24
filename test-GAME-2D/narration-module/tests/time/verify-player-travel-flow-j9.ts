import assert from "node:assert/strict";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  createCampaignWorldSimulationRuntimeV1,
  createCatalogCampaignTravelRuntimeV1,
  createPrototypeNarrativeTurnControllerV1,
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
  PROTOTYPE_INN_BACK_ROOM_REF_V1,
  PROTOTYPE_INN_BACK_ROOM_SCENE_V1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV6
} from "../../src/ai/types";

const provider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const task = call.input.task as { rawInput: string };
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
      payload: {
        rawInputEcho: task.rawInput,
        intent: {
          kind: "traverse_visible_boundary",
          commitment: "committed",
          preconditions: [],
          playerGoal: "Voyager jusqu'à l'arrière-salle.",
          actionHint: "prendre la route vers l'arrière-salle",
          domainHint: "world",
          scope: "SCENE_TRANSITION",
          targetMention: {
            surface: "l'arrière-salle",
            candidateKind: "place",
            proposedRef: "poi:back-room-door",
            contextLink: "EXPLICIT"
          },
          perception: null,
          dialogueAct: null,
          uncertainties: [],
          clarificationPrompt: null,
          confidence: "high",
          composition: {
            orientation: null,
            spatialLeadIn: null,
            communication: null,
            spatialFollowUp: null
          },
          companionDirective: null
        }
      },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV6>;
  }
};

async function main(): Promise<void> {
  const travelRuntime = createCatalogCampaignTravelRuntimeV1({
    runtimeBindings: PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
    destinationAliases: {
      "poi:back-room-door": "inn-back-room",
      [PROTOTYPE_INN_BACK_ROOM_REF_V1]: "inn-back-room"
    },
    catalog: {
      schemaVersion: 1,
      catalogId: "travel:j9:prototype",
      catalogVersion: 1,
      anchors: [{
        schemaVersion: 1,
        locationId: "inn-common-room",
        status: "AVAILABLE",
        sourceRefs: ["prototype-content:inn/1"]
      }, {
        schemaVersion: 1,
        locationId: "inn-back-room",
        status: "AVAILABLE",
        sourceRefs: ["prototype-content:inn-back-room/1"]
      }],
      routes: [{
        schemaVersion: 1,
        routeId: "travel:j9:common-to-back",
        fromLocationId: "inn-common-room",
        toLocationId: "inn-back-room",
        direction: "BIDIRECTIONAL",
        status: "OPEN",
        distanceUnits: 1,
        estimatedSecondsByMode: { WALK: 900 },
        dangerLevel: 0,
        environmentTags: ["prototype-route"],
        sourceRefs: ["prototype-content:inn/1"]
      }]
    },
    resolveArrival(destinationLocationId) {
      return destinationLocationId === "inn-back-room"
        ? {
            sceneId: PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId,
            locationRef: PROTOTYPE_INN_BACK_ROOM_REF_V1
          }
        : null;
    }
  });
  const controller = await createPrototypeNarrativeTurnControllerV1({
    travelRuntime,
    intentInterpreterConfig: {
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1,
        routeId: "j9-player-travel",
        role: "player_intent_interpreter",
        providerKind: "FAKE_CONTRACT",
        providerId: "j9-local-gate",
        modelId: "deterministic-j9",
        modelConfigVersion: "travel-v1",
        certified: true,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6],
        inputTokenLimit: 2_000,
        outputTokenLimit: 1_000,
        timeoutMs: 1_000,
        fallbackRouteIds: []
      },
      retryPolicy: {
        schemaVersion: 1,
        role: "player_intent_interpreter",
        maxTechnicalRetries: 0,
        maxTargetedCorrections: 0,
        maxFullRegenerations: 0,
        allowFallback: false
      }
    },
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    interpreterCharacterContextResolver: null,
    async initializeRepository(repository, campaignId) {
      const world = createCampaignWorldSimulationRuntimeV1({
        repository,
        campaignId,
        runtimeBindings: PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
        initialWorldState: { schemaVersion: 1, fixture: "j9-travel" }
      });
      const initialized = await world.ensureInitialized();
      if (!initialized.ok) throw new Error(initialized.error.messageKey);
    }
  });

  const departure = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j9:travel:depart",
    rawInput: "Je pars vers l'arrière-salle."
  });
  if (!departure.ok) throw new Error(
    `${departure.error.messageKey} ${JSON.stringify(departure.error.details)}`
  );
  const active = await controller.restoreActiveTravel();
  if (!active.ok) throw new Error(active.error.messageKey);
  assert.equal(active.value?.status, "PLANNED");
  assert.equal(active.value?.plan.destinationLocationId, "inn-back-room");

  const arrival = await controller.advanceTravel({
    schemaVersion: 1,
    clientRequestId: "j9:travel:segment:1"
  });
  if (!arrival.ok) throw new Error(
    `${arrival.error.messageKey} ${JSON.stringify(arrival.error.details)}`
  );
  assert.equal(arrival.value.process.status, "ARRIVED");
  assert.equal(arrival.value.stopReason, "ARRIVAL");
  assert.equal(arrival.value.process.checkpoint.elapsedTravelSeconds, 900);
  assert.equal(arrival.value.arrivalSceneId, PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId);
  const restoredScene = await controller.resolveActiveScene();
  if (!restoredScene.ok) throw new Error(restoredScene.error.messageKey);
  assert.equal(restoredScene.value.sceneId, PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId);
  const noActiveTravel = await controller.restoreActiveTravel();
  if (!noActiveTravel.ok) throw new Error(noActiveTravel.error.messageKey);
  assert.equal(noActiveTravel.value, null);

  const replay = await controller.advanceTravel({
    schemaVersion: 1,
    clientRequestId: "j9:travel:segment:1"
  });
  if (!replay.ok) throw new Error(replay.error.messageKey);
  assert.equal(replay.value.replayed, true);
  assert.equal(replay.value.commitId, arrival.value.commitId);
  console.log("player-travel/J9: intent -> persistent start -> atomic time/position/checkpoint/scene arrival -> replay verified");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
