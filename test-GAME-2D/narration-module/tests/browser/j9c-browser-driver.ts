import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  createCatalogMissionRelationRuntimeV1,
  createNarrativeCompanionRecruitmentRuntimeV1,
  EXTERNAL_INVENTORY_AGGREGATE_ID_V1,
  EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1,
  type CompanionAutonomyPolicyV1,
  type NarrativeTurnControllerV1,
  type PlotCandidateV1,
  type PlotGenerationContextV1
} from "../../src/application";
import { loadActiveCampaignCharacterProfileV1 } from "../../src/bootstrap";
import {
  IndexedDbCampaignRepository,
  opaqueId,
  type CampaignId
} from "../../src/core";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV6,
  AiSemanticPlayerIntentV6
} from "../../src/ai/types";
import { createPlotCandidateJ5Fixture } from
  "../fixtures/plot-candidate-j5.fixture";
import {
  PLAYABLE_CAMPAIGN_DATABASE_NAME_V1,
  createPlayableCampaignControllerV1,
  type PlayableCampaignControllerOptionsV1
} from "../../../src/narration-ui/playableCampaignBootstrap";
import { readActiveCharacterSheetV1 } from
  "../../../src/narration-ui/activeCharacterSheetAdapter";

const archiveSceneId = "wiki-location:archives_de_lysenthe";
const hallesSceneId = "wiki-location:halles_des_commerces";
const archivistId = `${archiveSceneId}:ambient:1`;

const autonomyPolicy: CompanionAutonomyPolicyV1 = {
  schemaVersion: 1,
  policyId: "companion-policy:archivist:j9c",
  policyRevision: 1,
  sourceRefs: ["authored-companion:archivist:j9c"],
  rules: [{
    schemaVersion: 1,
    category: "FOLLOW",
    disposition: "ACCEPTED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["authored-companion:archivist:shared-road"]
  }, {
    schemaVersion: 1,
    category: "PERSONAL_RISK",
    disposition: "REFUSED",
    adaptation: null,
    conditions: [],
    sourceRefs: ["authored-companion:archivist:no-reckless-danger"]
  }]
};

export const J9C_REQUESTS = {
  recruitment: [
    "j9c:recruitment",
    "Je demande à l'archiviste de rejoindre durablement mon groupe."
  ],
  refusal: [
    "j9c:companion:refusal",
    "Je demande à l'archiviste de traverser seul une zone dangereuse."
  ],
  search: [
    "j9c:plot-search",
    "Je fouille attentivement les archives."
  ],
  hypothesis: [
    "j9c:plot:false-hypothesis",
    "Je pense que le registre a simplement été mal rangé."
  ],
  travel: [
    "j9c:travel-departure",
    "Je pars vers les Halles des commerces."
  ],
  conclusion: [
    "j9c:plot:conclusion",
    "J'en conclus que l'archiviste a déplacé le registre pour le protéger d'une saisie."
  ]
} as const;

function semanticIntent(rawInput: string): AiSemanticPlayerIntentV6 {
  const normalized = rawInput.toLowerCase();
  const base = {
    commitment: "committed" as const,
    preconditions: [],
    uncertainties: [],
    clarificationPrompt: null,
    confidence: "high" as const
  };
  if (normalized.includes("halles")) return {
    ...base,
    kind: "traverse_visible_boundary",
    playerGoal: "Voyager jusqu'aux Halles des commerces.",
    actionHint: "prendre la route vers les Halles",
    domainHint: "world",
    scope: "SCENE_TRANSITION",
    targetMention: {
      surface: "les Halles des commerces",
      candidateKind: "place",
      proposedRef: "location:halles_des_commerces",
      contextLink: "EXPLICIT"
    },
    perception: null,
    dialogueAct: null,
    companionDirective: null,
    composition: emptyComposition()
  };
  if (normalized.includes("fouille")) return {
    ...base,
    kind: "observe_environment",
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
    companionDirective: null,
    composition: emptyComposition()
  };
  const recruitment = normalized.includes("rejoindre");
  const risk = normalized.includes("danger");
  const statement = normalized.includes("je pense")
    || normalized.includes("j'en conclus");
  const act = recruitment || risk ? "REQUEST_ACTION" as const
    : statement ? "MAKE_STATEMENT" as const
      : "INITIATE_CONVERSATION" as const;
  return {
    ...base,
    kind: "address_visible_actor",
    playerGoal: rawInput,
    actionHint: rawInput,
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: {
      surface: "l'archiviste",
      candidateKind: "npc",
      proposedRef: `npc:${archivistId}`,
      contextLink: "EXPLICIT"
    },
    perception: null,
    dialogueAct: { act, contentGoal: rawInput },
    companionDirective: recruitment ? {
      schemaVersion: 1,
      category: "FOLLOW",
      requestSummary: "Rejoindre durablement le groupe."
    } : risk ? {
      schemaVersion: 1,
      category: "PERSONAL_RISK",
      requestSummary: "Traverser seul une zone manifestement dangereuse."
    } : null,
    composition: {
      ...emptyComposition(),
      communication: { mode: "SPEECH", act, contentGoal: rawInput, order: 1 }
    }
  };
}

function emptyComposition() {
  return {
    orientation: null,
    spatialLeadIn: null,
    communication: null,
    spatialFollowUp: null
  } as const;
}

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
        intent: semanticIntent(task.rawInput)
      },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV6>;
  }
};

const plotProvider: ContractAiProviderV1 = {
  async generate(call: AiCallRequestV1): Promise<unknown> {
    const payload = call.role === "scene_creator"
      ? candidateForContext((call.input.roleContextPack as {
          context: PlotGenerationContextV1;
        }).context)
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

function candidateForContext(context: PlotGenerationContextV1): PlotCandidateV1 {
  const candidate = structuredClone(createPlotCandidateJ5Fixture());
  const sourceRef = context.allowedSourceRefs[0]!;
  const firstActor = context.allowedActorRefs[0]!;
  const secondActor = context.allowedActorRefs[1] ?? firstActor;
  candidate.sourceRefs = [sourceRef];
  candidate.hiddenTruth.groundingRefs = [sourceRef];
  candidate.causalTimeline = candidate.causalTimeline.map((step, index) => ({
    ...step,
    actorRefs: [index === 0 ? firstActor : secondActor],
    locationRef: context.sceneId,
    occurredAtGameSecond: context.createdAtGameSecond,
    causedByRefs: index === 0 ? [sourceRef] : [candidate.causalTimeline[0]!.stepId]
  }));
  candidate.actorMotivations = candidate.actorMotivations.map((value, index) => ({
    ...value,
    actorRef: index === 0 ? firstActor : secondActor,
    sourceRefs: [sourceRef]
  }));
  candidate.actorPerspectives = candidate.actorPerspectives.map((value, index) => ({
    ...value,
    actorRef: index === 0 ? firstActor : secondActor,
    sourceRefs: [sourceRef]
  }));
  candidate.clues = candidate.clues.map((clue, index) => ({
    ...clue,
    sceneId: context.sceneId,
    actorRef: index === 0 ? null : secondActor,
    sourceRefs: [sourceRef]
  }));
  candidate.futureEvents = candidate.futureEvents.map(event => ({
    ...event,
    dueAtGameSecond: context.createdAtGameSecond + 60,
    locationRef: context.sceneId,
    effects: event.effects.map(effect => ({
      ...effect,
      sceneId: context.sceneId,
      sourceRefs: [sourceRef]
    }))
  }));
  return candidate;
}

function controllerOptions(): PlayableCampaignControllerOptionsV1 {
  return {
    narrativeTravelInterruption: false,
    intentInterpreterConfig: {
      provider: intentProvider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1,
        routeId: "j9c-browser-intent",
        role: "player_intent_interpreter",
        providerKind: "FAKE_CONTRACT",
        providerId: "j9c-browser",
        modelId: "deterministic-j9c",
        modelConfigVersion: "j9c-v1",
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
    missionRelationRuntime: createCatalogMissionRelationRuntimeV1({
      decisionPolicy: {
        decide: () => ({
          disposition: "ACCEPTED",
          conditions: [],
          publicSourceRefs: ["social-policy:archivist-mutual-choice"]
        })
      }
    }),
    companionRecruitmentRuntime: createNarrativeCompanionRecruitmentRuntimeV1({
      policy: { resolve: ({ actor }) =>
        actor.actorId === archivistId ? autonomyPolicy : null }
    }),
    plotGeneratorConfig: {
      provider: plotProvider,
      route: {
        schemaVersion: 1,
        routeId: "j9c-browser-plot",
        role: "scene_creator",
        providerKind: "FAKE_CONTRACT",
        providerId: "j9c-browser",
        modelId: "deterministic-j9c",
        modelConfigVersion: "j9c-plot-v1",
        certified: true,
        allowedContractVersions: ["plot-candidate/1"],
        inputTokenLimit: 5_000,
        outputTokenLimit: 5_000,
        timeoutMs: 1_000,
        fallbackRouteIds: []
      },
      coherenceCriticRoute: {
        schemaVersion: 1,
        routeId: "j9c-browser-plot-critic",
        role: "coherence_critic",
        providerKind: "FAKE_CONTRACT",
        providerId: "j9c-browser",
        modelId: "deterministic-j9c",
        modelConfigVersion: "j9c-critic-v1",
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
    }
  };
}

export async function runJ9cBrowserVertical(): Promise<J9cBrowserState> {
  const controller = await openController();
  await submit(controller, J9C_REQUESTS.recruitment);
  await submit(controller, J9C_REQUESTS.refusal);
  await submit(controller, J9C_REQUESTS.search);
  const testimony = await controller.processActivePlotSceneBoundary({
    schemaVersion: 1,
    playerKnowledgeRefs: ["knowledge:clerc-testimony"]
  });
  if (!testimony.ok) throw new Error(testimony.error.messageKey);
  await submit(controller, J9C_REQUESTS.hypothesis);
  await submit(controller, J9C_REQUESTS.travel);
  const arrival = await controller.advanceTravel({
    schemaVersion: 1,
    clientRequestId: "j9c:travel-segment:1"
  });
  if (!arrival.ok) throw new Error(arrival.error.messageKey);
  await submit(controller, J9C_REQUESTS.conclusion);
  return inspectJ9cBrowserState();
}

export async function replayJ9cBrowserCriticalRequests(): Promise<J9cBrowserState> {
  const controller = await openController();
  await submit(controller, J9C_REQUESTS.recruitment);
  await submit(controller, J9C_REQUESTS.refusal);
  await submit(controller, J9C_REQUESTS.travel);
  const replayed = await controller.advanceTravel({
    schemaVersion: 1,
    clientRequestId: "j9c:travel-segment:1"
  });
  if (!replayed.ok || !replayed.value.replayed) {
    throw new Error(replayed.ok ? "travel replay missing" : replayed.error.messageKey);
  }
  return inspectJ9cBrowserState();
}

async function openController(): Promise<NarrativeTurnControllerV1> {
  const sheet = await readActiveCharacterSheetV1();
  if (!sheet.ok) throw new Error(sheet.diagnostics.map(value => value.code).join("|"));
  return (await createPlayableCampaignControllerV1(
    sheet.value,
    "local",
    controllerOptions()
  )).controller;
}

async function submit(
  controller: NarrativeTurnControllerV1,
  request: readonly [string, string]
): Promise<void> {
  const result = await controller.submit({
    schemaVersion: 1,
    clientRequestId: request[0],
    rawInput: request[1]
  });
  if (!result.ok) throw new Error(
    `${request[0]} ${result.error.messageKey} ${JSON.stringify(result.error.details)}`
  );
}

export interface J9cBrowserState {
  activeSceneId: string;
  elapsedGameSeconds: number;
  companionCount: number;
  companionSceneId: string | null;
  directiveDispositions: string[];
  plotStatus: string | null;
  discoveryCount: number;
  hypothesisStatuses: string[];
  characterRevision: number;
  externalRevision: number;
  goldContainer: string | null;
  archivistInventoryCount: number;
  narrativeTurnCount: number;
}

export async function inspectJ9cBrowserState(): Promise<J9cBrowserState> {
  const campaignId = readCampaignId();
  const controller = await openController();
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  try {
    const [scene, party, plots, profile, campaign, operations] = await Promise.all([
      controller.resolveActiveScene(),
      controller.restoreCompanionParty(),
      controller.restorePlotRegistry(),
      loadActiveCampaignCharacterProfileV1({ repository, campaignId }),
      repository.getCampaign(campaignId),
      repository.listOperations(campaignId, "narrative.turn.input", 100)
    ]);
    if (!scene.ok || !party.ok || !plots.ok || !profile.ok || !campaign.ok || !operations.ok) {
      throw new Error("j9c inspection prerequisites missing");
    }
    const [character, external, worldClock] = await Promise.all([
      repository.getAggregate(campaignId, "character.state", profile.value.characterStateAggregateId),
      repository.getAggregate(campaignId, EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, EXTERNAL_INVENTORY_AGGREGATE_ID_V1),
      repository.getAggregate(campaignId, "world.clock", campaign.value.clockAggregateId)
    ]);
    if (!character.ok || !external.ok || !worldClock.ok) {
      throw new Error("j9c inspection aggregates missing");
    }
    const inventory = character.value.payload.inventory as Array<{
      instanceId: string;
      storedInInstanceId: string | null;
    }>;
    const archivistInventory = (external.value.payload.owners as Array<{
      ownerRef: string;
      inventory: unknown[];
    }>).find(owner => owner.ownerRef === `npc:${archivistId}`)?.inventory ?? [];
    const plot = plots.value.state.plots[0] ?? null;
    const hypotheses = (plot?.playerHypotheses ?? []) as unknown as
      Array<{ status: string }>;
    return {
      activeSceneId: scene.value.sceneId,
      elapsedGameSeconds: Number(worldClock.value.payload.elapsedGameSeconds),
      companionCount: party.value.state?.members.length ?? 0,
      companionSceneId: party.value.state?.currentSceneId ?? null,
      directiveDispositions:
        party.value.state?.directives.map(value => value.disposition) ?? [],
      plotStatus: plot?.status ?? null,
      discoveryCount:
        (plot?.discoveries as unknown[] | undefined)?.length ?? 0,
      hypothesisStatuses: hypotheses.map(value => value.status).sort(),
      characterRevision: character.value.aggregateRevision,
      externalRevision: external.value.aggregateRevision,
      goldContainer: inventory.find(value => value.instanceId === "item-or")
        ?.storedInInstanceId ?? null,
      archivistInventoryCount: archivistInventory.length,
      narrativeTurnCount: operations.value.length
    };
  } finally {
    repository.close();
  }
}

function readCampaignId(): CampaignId {
  const raw = localStorage.getItem("jdr5e_narration_bootstrap_envelopes_v1");
  if (raw === null) throw new Error("j9c bootstrap envelope missing");
  const records = JSON.parse(raw) as Record<string, { campaignId?: unknown }>;
  const campaignId = Object.values(records)[0]?.campaignId;
  if (typeof campaignId !== "string") throw new Error("j9c campaign id missing");
  return opaqueId<CampaignId>(campaignId);
}
