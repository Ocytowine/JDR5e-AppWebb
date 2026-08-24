import assert from "node:assert/strict";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  companionTravelPartySnapshotV1,
  createCampaignWorldSimulationRuntimeV1,
  createCatalogCampaignTravelRuntimeV1,
  createCatalogMissionRelationRuntimeV1,
  createCatalogPlotCreationRuntimeV1,
  createNarrativeCompanionRecruitmentRuntimeV1,
  createPrototypeNarrativeTurnControllerV1,
  loadCompanionPartyRegistryV1,
  moveCompanionPartyV1,
  PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
  PROTOTYPE_INN_BACK_ROOM_REF_V1,
  PROTOTYPE_INN_BACK_ROOM_SCENE_V1,
  PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type CompanionAutonomyPolicyV1
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

const actorId = "reference-inn-rain-001:ambient:marel";
const initialScene = {
  ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  ambientPopulation: [{
    schemaVersion: 1 as const,
    actorId,
    displayName: "Marel",
    publicRole: "Clerc voyageur",
    visibleActivity: "compare deux registres annotés",
    visibleAppearance: "une sacoche de cuir remplie de feuillets",
    demeanor: "attentif et prudent",
    immediateGoal: "mettre de l'ordre dans les témoignages recueillis",
    currentPressure: "il refuse de mettre inutilement sa vie en jeu",
    speechStyle: ["phrases posées", "réponses franches"],
    conversationalHooks: ["archives", "registres", "voyage"],
    boundaries: ["évite les risques inconsidérés"],
    knowledgeRefs: ["reference-scene:reference-inn-rain-001"],
    keywords: ["Marel", "clerc", "compagnon"],
    version: 1 as const
  }]
};

const autonomyPolicy: CompanionAutonomyPolicyV1 = {
  schemaVersion: 1,
  policyId: "companion-policy:marel:j9b",
  policyRevision: 1,
  sourceRefs: ["authored-companion:marel:j9b"],
  rules: [{
    schemaVersion: 1,
    category: "FOLLOW",
    disposition: "ACCEPTED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["authored-companion:marel:shared-road"]
  }]
};

const intentProvider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const task = call.input.task as { rawInput: string };
    const isRecruitment = task.rawInput.includes("rejoindre");
    const isTravel = task.rawInput.includes("arrière-salle");
    const intent = isRecruitment ? {
      kind: "address_visible_actor" as const,
      playerGoal: "Demander à Marel de rejoindre durablement le groupe.",
      actionHint: "proposer à Marel de rejoindre le groupe",
      domainHint: "social" as const,
      scope: "SOCIAL_EXCHANGE" as const,
      targetMention: {
        surface: "Marel",
        candidateKind: "npc" as const,
        proposedRef: `npc:${actorId}`,
        contextLink: "EXPLICIT" as const
      },
      perception: null,
      dialogueAct: {
        act: "REQUEST_ACTION" as const,
        contentGoal: "Demander à Marel de rejoindre durablement le groupe."
      },
      companionDirective: {
        schemaVersion: 1 as const,
        category: "FOLLOW" as const,
        requestSummary: "Rejoindre durablement le groupe."
      }
    } : isTravel ? {
      kind: "traverse_visible_boundary" as const,
      playerGoal: "Voyager jusqu'à l'arrière-salle.",
      actionHint: "prendre la route vers l'arrière-salle",
      domainHint: "world" as const,
      scope: "SCENE_TRANSITION" as const,
      targetMention: {
        surface: "l'arrière-salle",
        candidateKind: "place" as const,
        proposedRef: "poi:back-room-door",
        contextLink: "EXPLICIT" as const
      },
      perception: null,
      dialogueAct: null,
      companionDirective: null
    } : {
      kind: "observe_environment" as const,
      playerGoal: "Fouiller méthodiquement les archives.",
      actionHint: "effectuer une recherche approfondie",
      domainHint: "scene_resolution" as const,
      scope: "PERCEPTION" as const,
      targetMention: null,
      perception: {
        schemaVersion: 1 as const,
        depth: "SEARCH" as const,
        focus: "les archives",
        soughtInformation: "un signe inhabituel",
        informationKind: "UNCERTAIN_CLUE" as const
      },
      dialogueAct: null,
      companionDirective: null
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
      payload: {
        rawInputEcho: task.rawInput,
        intent: {
          ...intent,
          commitment: "committed",
          preconditions: [],
          uncertainties: [],
          clarificationPrompt: null,
          confidence: "high",
          composition: {
            orientation: null,
            spatialLeadIn: null,
            communication: intent.dialogueAct === null ? null : {
              mode: "SPEECH",
              act: intent.dialogueAct.act,
              contentGoal: intent.dialogueAct.contentGoal,
              order: 1
            },
            spatialFollowUp: null
          }
        }
      },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV6>;
  }
};

const plotProvider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
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
      payload: call.role === "scene_creator"
        ? createPlotCandidateJ5Fixture()
        : { verdict: "PASS", findings: [], correctionConstraints: [] },
      diagnostics: [],
      supersedesOutputId: null
    };
  }
};

async function main(): Promise<void> {
  const travelRuntime = createCatalogCampaignTravelRuntimeV1({
    runtimeBindings: PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
    destinationAliases: { "poi:back-room-door": "inn-back-room" },
    catalog: {
      schemaVersion: 1,
      catalogId: "travel:j9b:continuous",
      catalogVersion: 1,
      anchors: [
        { schemaVersion: 1, locationId: "inn-common-room", status: "AVAILABLE", sourceRefs: ["prototype-content:inn/1"] },
        { schemaVersion: 1, locationId: "inn-back-room", status: "AVAILABLE", sourceRefs: ["prototype-content:inn-back-room/1"] }
      ],
      routes: [{
        schemaVersion: 1,
        routeId: "travel:j9b:common-to-back",
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
    async resolveParty(request) {
      const party = await loadCompanionPartyRegistryV1({
        repository: request.repository,
        campaignId: request.campaignId
      });
      if (!party.ok) return party;
      assert.notEqual(party.value.state, null);
      return { ok: true, value: companionTravelPartySnapshotV1(party.value.state!) };
    },
    resolveArrival(destinationLocationId) {
      return destinationLocationId === "inn-back-room"
        ? { sceneId: PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId, locationRef: PROTOTYPE_INN_BACK_ROOM_REF_V1 }
        : null;
    },
    async onArrival(request) {
      const party = await loadCompanionPartyRegistryV1({
        repository: request.repository,
        campaignId: request.campaignId
      });
      if (!party.ok || party.value.state === null) return party;
      if (party.value.state.currentSceneId === request.destinationSceneId) {
        return { ok: true, value: null };
      }
      return moveCompanionPartyV1({
        repository: request.repository,
        campaignId: request.campaignId,
        command: {
          schemaVersion: 1,
          clientRequestId: `travel-arrival:${request.process.processId}`,
          fromSceneId: party.value.state.currentSceneId,
          toSceneId: request.destinationSceneId,
          sourceWorldEventRef: `commit:${request.commitId}`,
          occurredAtGameSecond: request.occurredAtGameSecond
        }
      });
    }
  });
  const controller = await createPrototypeNarrativeTurnControllerV1({
    initialScene: { scene: initialScene, locationRef: "location:inn-common-room" },
    activeSceneResolver: {
      async resolve({ repository, campaignId }) {
        const lifecycle = await repository.getAggregate(
          campaignId,
          "scene.lifecycle",
          PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1
        );
        if (!lifecycle.ok) return lifecycle;
        return {
          ok: true,
          value: lifecycle.value.payload.activeSceneId
            === PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId
            ? PROTOTYPE_INN_BACK_ROOM_SCENE_V1
            : initialScene
        };
      }
    },
    intentInterpreterConfig: {
      provider: intentProvider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1,
        routeId: "j9b-continuous-intent",
        role: "player_intent_interpreter",
        providerKind: "FAKE_CONTRACT",
        providerId: "j9-local-gate",
        modelId: "deterministic-j9",
        modelConfigVersion: "continuous-v1",
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
    missionRelationRuntime: createCatalogMissionRelationRuntimeV1({
      decisionPolicy: {
        decide: () => ({
          disposition: "ACCEPTED",
          conditions: [],
          publicSourceRefs: ["social-policy:marel-mutual-choice"]
        })
      }
    }),
    companionRecruitmentRuntime: createNarrativeCompanionRecruitmentRuntimeV1({
      policy: { resolve: ({ actor }) => actor.actorId === actorId ? autonomyPolicy : null }
    }),
    plotCreationRuntime: createCatalogPlotCreationRuntimeV1({
      generatorConfig: {
        provider: plotProvider,
        route: {
          schemaVersion: 1,
          routeId: "j9b-plot-candidate",
          role: "scene_creator",
          providerKind: "FAKE_CONTRACT",
          providerId: "j9-local-gate",
          modelId: "deterministic-j9",
          modelConfigVersion: "continuous-plot-v1",
          certified: true,
          allowedContractVersions: ["plot-candidate/1"],
          inputTokenLimit: 5_000,
          outputTokenLimit: 5_000,
          timeoutMs: 1_000,
          fallbackRouteIds: []
        },
        coherenceCriticRoute: {
          schemaVersion: 1,
          routeId: "j9b-plot-critic",
          role: "coherence_critic",
          providerKind: "FAKE_CONTRACT",
          providerId: "j9-local-gate",
          modelId: "deterministic-j9",
          modelConfigVersion: "continuous-critic-v1",
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
    }),
    travelRuntime,
    async initializeRepository(repository, campaignId) {
      const world = createCampaignWorldSimulationRuntimeV1({
        repository,
        campaignId,
        runtimeBindings: PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1,
        initialWorldState: { schemaVersion: 1, fixture: "j9b-continuous" }
      });
      const initialized = await world.ensureInitialized();
      if (!initialized.ok) throw new Error(initialized.error.messageKey);
    }
  });

  const recruitmentRequest = {
    schemaVersion: 1 as const,
    clientRequestId: "j9b:recruitment",
    rawInput: "Je demande à Marel de rejoindre durablement mon groupe."
  };
  const recruitment = await controller.submit(recruitmentRequest);
  if (!recruitment.ok) throw new Error(recruitment.error.messageKey);
  const recruitedParty = await controller.restoreCompanionParty();
  if (!recruitedParty.ok || recruitedParty.value.state === null) throw new Error("companion party missing");
  assert.deepEqual(recruitedParty.value.state.members.map(member => member.actorId), [actorId]);

  const searchRequest = {
    schemaVersion: 1 as const,
    clientRequestId: "j9b:plot-search",
    rawInput: "Je fouille attentivement les archives."
  };
  const search = await controller.submit(searchRequest);
  if (!search.ok) throw new Error(search.error.messageKey);
  const plots = await controller.restorePlotRegistry();
  if (!plots.ok) throw new Error(plots.error.messageKey);
  assert.equal(plots.value.state.plots[0]?.plotId, "plot:missing-register");

  const departureRequest = {
    schemaVersion: 1 as const,
    clientRequestId: "j9b:travel-departure",
    rawInput: "Je pars vers l'arrière-salle."
  };
  const departure = await controller.submit(departureRequest);
  if (!departure.ok) throw new Error(departure.error.messageKey);
  const activeTravel = await controller.restoreActiveTravel();
  if (!activeTravel.ok || activeTravel.value === null) throw new Error("active travel missing");
  assert.equal(activeTravel.value.plan.party!.memberActorIds.includes(actorId), true);

  const arrival = await controller.advanceTravel({
    schemaVersion: 1,
    clientRequestId: "j9b:travel-segment:1"
  });
  if (!arrival.ok) throw new Error(arrival.error.messageKey);
  assert.equal(arrival.value.process.status, "ARRIVED");
  const arrivedParty = await controller.restoreCompanionParty();
  if (!arrivedParty.ok || arrivedParty.value.state === null) throw new Error("arrived party missing");
  assert.equal(arrivedParty.value.state.currentSceneId, PROTOTYPE_INN_BACK_ROOM_SCENE_V1.sceneId);

  const replayedRecruitment = await controller.submit(recruitmentRequest);
  const replayedSearch = await controller.submit(searchRequest);
  const replayedDeparture = await controller.submit(departureRequest);
  const replayedArrival = await controller.advanceTravel({
    schemaVersion: 1,
    clientRequestId: "j9b:travel-segment:1"
  });
  if (!replayedRecruitment.ok) throw new Error(`recruitment replay: ${replayedRecruitment.error.messageKey}`);
  if (!replayedSearch.ok) throw new Error(`search replay: ${replayedSearch.error.messageKey}`);
  if (!replayedDeparture.ok) throw new Error(`departure replay: ${replayedDeparture.error.messageKey}`);
  assert.equal(replayedArrival.ok && replayedArrival.value.replayed, true);
  const replayedParty = await controller.restoreCompanionParty();
  const replayedPlots = await controller.restorePlotRegistry();
  if (!replayedParty.ok || !replayedPlots.ok) throw new Error("replay projections missing");
  assert.equal(replayedParty.value.state?.members.length, 1);
  assert.equal(replayedPlots.value.state.plots.length, 1);
  console.log("J9-B/continuous: J4->J7 recruitment -> J5 plot -> J6 party travel/arrival -> stable replay verified");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
