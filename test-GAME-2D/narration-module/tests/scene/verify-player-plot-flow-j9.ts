import assert from "node:assert/strict";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  createCatalogPlotCreationRuntimeV1,
  createPrototypeNarrativeTurnControllerV1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV6
} from "../../src/ai/types";
import {
  createPlotCandidateJ5Fixture,
  PLOT_CANDIDATE_J5_CONTEXT
} from "../fixtures/plot-candidate-j5.fixture";

const intentProvider: ContractAiProviderV1 = {
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
          kind: "observe_environment",
          commitment: "committed",
          preconditions: [],
          playerGoal: "Fouiller méthodiquement les archives.",
          actionHint: "effectuer une recherche approfondie",
          domainHint: "scene_resolution",
          scope: "PERCEPTION",
          targetMention: null,
          perception: {
            schemaVersion: 1,
            depth: "SEARCH",
            focus: "les archives",
            soughtInformation: "un signe inhabituel",
            informationKind: "UNCERTAIN_CLUE"
          },
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

const plotProvider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const payload = call.role === "scene_creator"
      ? createPlotCandidateJ5Fixture()
      : { verdict: "PASS", findings: [], correctionConstraints: [] };
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
    };
  }
};

async function main(): Promise<void> {
  const controller = await createPrototypeNarrativeTurnControllerV1({
    intentInterpreterConfig: {
      provider: intentProvider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1,
        routeId: "j9-player-plot-search",
        role: "player_intent_interpreter",
        providerKind: "FAKE_CONTRACT",
        providerId: "j9-local-gate",
        modelId: "deterministic-j9",
        modelConfigVersion: "plot-search-v1",
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
    plotCreationRuntime: createCatalogPlotCreationRuntimeV1({
      generatorConfig: {
        provider: plotProvider,
        route: {
          schemaVersion: 1,
          routeId: "j9-plot-candidate",
          role: "scene_creator",
          providerKind: "FAKE_CONTRACT",
          providerId: "j9-local-gate",
          modelId: "deterministic-j9",
          modelConfigVersion: "plot-candidate-v1",
          certified: true,
          allowedContractVersions: ["plot-candidate/1"],
          inputTokenLimit: 5_000,
          outputTokenLimit: 5_000,
          timeoutMs: 1_000,
          fallbackRouteIds: []
        },
        coherenceCriticRoute: {
          schemaVersion: 1,
          routeId: "j9-plot-critic",
          role: "coherence_critic",
          providerKind: "FAKE_CONTRACT",
          providerId: "j9-local-gate",
          modelId: "deterministic-j9",
          modelConfigVersion: "plot-critic-v1",
          certified: true,
          allowedContractVersions: ["narrative-ai-resolution/1"],
          inputTokenLimit: 1_600,
          outputTokenLimit: 1_600,
          timeoutMs: 1_000,
          fallbackRouteIds: []
        },
        retryPolicy: {
          schemaVersion: 1,
          role: "scene_creator",
          maxTechnicalRetries: 0,
          maxTargetedCorrections: 0,
          maxFullRegenerations: 0,
          allowFallback: false
        }
      },
      resolveContext: () => PLOT_CANDIDATE_J5_CONTEXT
    })
  });

  const search = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j9:plot:search",
    rawInput: "Je fouille attentivement les archives."
  });
  if (!search.ok) throw new Error(
    `${search.error.messageKey} ${JSON.stringify(search.error.details)}`
  );
  const registry = await controller.restorePlotRegistry();
  if (!registry.ok) throw new Error(registry.error.messageKey);
  assert.equal(registry.value.state.plots.length, 1);
  assert.equal(registry.value.state.plots[0]?.plotId, "plot:missing-register");
  assert.equal(registry.value.state.plots[0]?.status, "ACTIVE");
  assert.equal(
    registry.value.state.plots[0]?.hiddenTruth.statement,
    createPlotCandidateJ5Fixture().hiddenTruth.statement
  );

  const replay = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "j9:plot:search",
    rawInput: "Je fouille attentivement les archives."
  });
  if (!replay.ok) throw new Error(replay.error.messageKey);
  const replayedRegistry = await controller.restorePlotRegistry();
  if (!replayedRegistry.ok) throw new Error(replayedRegistry.error.messageKey);
  assert.equal(replayedRegistry.value.state.plots.length, 1);
  console.log("player-plot/J9: search intent -> deterministic proposal -> normal validation/authority -> stable replay verified");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
