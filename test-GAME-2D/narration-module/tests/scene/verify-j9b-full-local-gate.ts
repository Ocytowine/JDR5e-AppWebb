import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  activateCampaignInitialSceneV1,
  CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  createCampaignWorldSimulationRuntimeV1,
  createCatalogMissionRelationRuntimeV1,
  createCatalogPlotCreationRuntimeV1,
  createNarrativeCompanionRecruitmentRuntimeV1,
  ensureExternalInventoryOwnershipV1,
  EXTERNAL_INVENTORY_AGGREGATE_ID_V1,
  EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1,
  NarrativeTurnControllerV1,
  type CampaignRuntimeBindingsV1,
  type CompanionAutonomyPolicyV1
} from "../../src/application";
import {
  CampaignBootstrapServiceV1,
  loadActiveCampaignCharacterProfileV1,
  MemoryCampaignBootstrapRepository,
  type CampaignBootstrapIdsV1,
  type CharacterImportEnvelopeV1,
  type Sha256Fingerprint
} from "../../src/bootstrap";
import {
  computeJsonFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type JsonObject,
  type RepositoryClock
} from "../../src/core";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV6,
  AiSemanticPlayerIntentV6
} from "../../src/ai/types";
import {
  createPlotCandidateJ5Fixture,
  PLOT_CANDIDATE_J5_CONTEXT
} from "../fixtures/plot-candidate-j5.fixture";
import { buildArchiveLorePilotV1 } from
  "../../../src/narration-ui/archiveLorePilot";
import {
  createInstalledContentPackageResolverV1,
  createInstalledRulesetResolverV1,
  INSTALLED_CONTENT_PACKAGE_ID_V1,
  INSTALLED_CONTENT_PACKAGE_VERSION_V1,
  INSTALLED_RULESET_ID_V1,
  INSTALLED_RULESET_VERSION_V1
} from "../../../src/narration-ui/installedCampaignContent";
import { createInstalledInventoryTransactionRuntimeV1 } from
  "../../../src/narration-ui/playableCampaignInventoryCatalog";
import { createInstalledPlayableTravelRuntimeV1 } from
  "../../../src/narration-ui/playableCampaignTravelCatalog";

const campaignId = opaqueId<CampaignId>("cmp-j9b-full-local");
const ids: CampaignBootstrapIdsV1 = {
  campaignId,
  operationId: opaqueId("op-bootstrap-j9b-full"),
  clientRequestId: opaqueId("req-bootstrap-j9b-full"),
  idempotencyKey: opaqueId("idem-bootstrap-j9b-full"),
  commitId: opaqueId("commit-bootstrap-j9b-full"),
  eventId: opaqueId("event-bootstrap-j9b-full"),
  clockAggregateId: opaqueId("agg-clock-j9b-full"),
  characterAggregateId: opaqueId("agg-character-j9b-full"),
  tacticalProjectionAggregateId: opaqueId("agg-tactical-j9b-full"),
  narrativeProjectionAggregateId: opaqueId("agg-narrative-j9b-full"),
  positionAggregateId: opaqueId("agg-position-j9b-full"),
  bootstrapContextAggregateId: opaqueId("agg-bootstrap-context-j9b-full")
};
const runtimeBindings: CampaignRuntimeBindingsV1 = {
  schemaVersion: 1,
  contractVersion: CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  positionAggregateId: ids.positionAggregateId,
  sceneLifecycleAggregateId: opaqueId<AggregateId>("agg-scene-lifecycle-j9b-full"),
  scheduleAggregateId: opaqueId<AggregateId>("agg-schedule-j9b-full"),
  simulationCursorAggregateId: opaqueId<AggregateId>("agg-simulation-cursor-j9b-full"),
  processAggregateId: opaqueId<AggregateId>("agg-process-j9b-full"),
  version: 1
};
const archiveSceneId = "wiki-location:archives_de_lysenthe";
const hallesSceneId = "wiki-location:halles_des_commerces";
const archivistId = `${archiveSceneId}:ambient:1`;
const clerkId = `${archiveSceneId}:ambient:2`;
const clock: RepositoryClock = {
  now: () => new Date("2026-08-24T12:00:00.000Z")
};

const autonomyPolicy: CompanionAutonomyPolicyV1 = {
  schemaVersion: 1,
  policyId: "companion-policy:archivist:j9b-full",
  policyRevision: 1,
  sourceRefs: ["authored-companion:archivist:j9b-full"],
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

function intentFor(rawInput: string): AiSemanticPlayerIntentV6 {
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
  if (/déséquipe|équipe|retire|range|donne|reçois/u.test(normalized)) return {
    ...base,
    kind: "manipulate_visible_object",
    playerGoal: rawInput,
    actionHint: rawInput,
    domainHint: "inventory",
    scope: "LOCAL_INTERACTION",
    targetMention: normalized.includes("donne") || normalized.includes("reçois")
      ? {
          surface: "l'archiviste",
          candidateKind: "npc",
          proposedRef: `npc:${archivistId}`,
          contextLink: "EXPLICIT"
        }
      : {
          surface: normalized.includes("épée") ? "mon épée longue" : "mes pièces d'or",
          candidateKind: "object",
          proposedRef: normalized.includes("déséquipe")
            ? "character-equipped-item:item-epee"
            : normalized.includes("épée")
              ? "character-inventory-item:item-epee"
              : "character-inventory-item:item-or",
          contextLink: "EXPLICIT"
        },
    perception: null,
    dialogueAct: null,
    companionDirective: null,
    composition: emptyComposition()
  };
  const isClerk = normalized.includes("clerc");
  const isRecruitment = normalized.includes("rejoindre");
  const isRisk = normalized.includes("danger");
  const isStatement = normalized.includes("je pense")
    || normalized.includes("j'en conclus")
    || normalized.includes("ma conclusion")
    || normalized.includes("j'ai compris");
  const actorId = isClerk ? clerkId : archivistId;
  const act = isRecruitment || isRisk ? "REQUEST_ACTION" as const
    : isStatement ? "MAKE_STATEMENT" as const
      : "INITIATE_CONVERSATION" as const;
  return {
    ...base,
    kind: "address_visible_actor",
    playerGoal: rawInput,
    actionHint: rawInput,
    domainHint: "social",
    scope: "SOCIAL_EXCHANGE",
    targetMention: {
      surface: isClerk ? "le clerc" : "l'archiviste",
      candidateKind: "npc",
      proposedRef: `npc:${actorId}`,
      contextLink: "EXPLICIT"
    },
    perception: null,
    dialogueAct: { act, contentGoal: rawInput },
    companionDirective: isRecruitment ? {
      schemaVersion: 1,
      category: "FOLLOW",
      requestSummary: "Rejoindre durablement le groupe."
    } : isRisk ? {
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
      payload: { rawInputEcho: task.rawInput, intent: intentFor(task.rawInput) },
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
  const repository = new MemoryCampaignBootstrapRepository({ clock });
  const legacyCharacter = JSON.parse(await readFile(resolve(
    "narration-module/tests/fixtures/character/valid/creator-ready.json"
  ), "utf8")) as JsonObject;
  const envelope: CharacterImportEnvelopeV1 = {
    schemaVersion: 1,
    sourceKind: "CHARACTER_CREATOR_LEGACY",
    sourceSchemaVersion: 1,
    sourceFingerprint: await computeJsonFingerprint(legacyCharacter) as Sha256Fingerprint,
    character: legacyCharacter
  };
  const bootstrap = new CampaignBootstrapServiceV1(
    createInstalledContentPackageResolverV1(),
    createInstalledRulesetResolverV1(),
    repository
  );
  const bootstrapped = await bootstrap.bootstrap({
    schemaVersion: 1,
    ids,
    contentPackageId: INSTALLED_CONTENT_PACKAGE_ID_V1,
    contentPackageVersion: INSTALLED_CONTENT_PACKAGE_VERSION_V1,
    rulesetId: INSTALLED_RULESET_ID_V1,
    rulesetVersion: INSTALLED_RULESET_VERSION_V1,
    calendarId: "calendar.astryade",
    calendarVersion: 1,
    initialLocationId: "archives_de_lysenthe",
    character: envelope,
    requestedAt: clock.now().toISOString()
  });
  if (!bootstrapped.ok) throw new Error(
    bootstrapped.diagnostics.map(value => value.code).join(", ")
  );
  const bootstrapPresentation = await repository.completePresentation(
    ids.operationId,
    "COMMITTED_RENDERED",
    1,
    { schemaVersion: 1, status: "BOOTSTRAPPED" }
  );
  if (!bootstrapPresentation.ok) throw new Error(bootstrapPresentation.error.messageKey);

  const archivePilot = await buildArchiveLorePilotV1();
  const activation = await activateCampaignInitialSceneV1({
    repository,
    campaignId,
    runtimeBindings,
    sceneId: archiveSceneId,
    locationRef: "location:archives_de_lysenthe",
    technicalTimestamp: clock.now().toISOString()
  });
  if (!activation.ok) throw new Error(activation.error.messageKey);
  const world = createCampaignWorldSimulationRuntimeV1({
    repository,
    campaignId,
    runtimeBindings,
    initialWorldState: { schemaVersion: 1, fixture: "j9b-full-local" },
    clock
  });
  const initialized = await world.ensureInitialized();
  if (!initialized.ok) throw new Error(initialized.error.messageKey);
  await ensureExternalInventoryOwnershipV1({
    repository,
    campaignId,
    clock,
    owners: archivePilot.scenes.flatMap(scene => [{
      ownerRef: `scene:${scene.sceneId}`,
      ownerKind: "SCENE" as const,
      sceneId: scene.sceneId,
      displayName: scene.locationName
    }, ...[...scene.presentNpc, ...scene.ambientPopulation].map(actor => ({
      ownerRef: `npc:${actor.actorId}`,
      ownerKind: "NPC" as const,
      sceneId: scene.sceneId,
      displayName: actor.displayName,
      acceptsDirectTransfers: true
    }))])
  });

  const controllerOptions = {
    repository,
    campaignId,
    clock,
    runtimeBindings,
    idPrefix: "j9b-full",
    activeSceneResolver: {
      async resolve() {
        const lifecycle = await repository.getAggregate(
          campaignId,
          "scene.lifecycle",
          runtimeBindings.sceneLifecycleAggregateId
        );
        if (!lifecycle.ok) return lifecycle;
        const scene = archivePilot.scenes.find(candidate =>
          candidate.sceneId === lifecycle.value.payload.activeSceneId
        );
        return scene === undefined
          ? { ok: false as const, error: coreError("VALIDATION_FAILED", "j9b.scene-missing") }
          : { ok: true as const, value: scene };
      }
    },
    intentInterpreterConfig: {
      provider: intentProvider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1 as const,
        routeId: "j9b-full-intent",
        role: "player_intent_interpreter" as const,
        providerKind: "FAKE_CONTRACT" as const,
        providerId: "j9-local-gate",
        modelId: "deterministic-j9",
        modelConfigVersion: "full-local-v1",
        certified: true,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6],
        inputTokenLimit: 2_000,
        outputTokenLimit: 1_000,
        timeoutMs: 1_000,
        fallbackRouteIds: []
      },
      retryPolicy: {
        schemaVersion: 1 as const,
        role: "player_intent_interpreter" as const,
        maxTechnicalRetries: 0,
        maxTargetedCorrections: 0,
        maxFullRegenerations: 0,
        allowFallback: false
      }
    },
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    inventoryTransactionRuntime: createInstalledInventoryTransactionRuntimeV1(),
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
      policy: { resolve: ({ actor }: { actor: { actorId: string } }) =>
        actor.actorId === archivistId ? autonomyPolicy : null }
    }),
    plotCreationRuntime: createCatalogPlotCreationRuntimeV1({
      generatorConfig: {
        provider: plotProvider,
        route: {
          schemaVersion: 1 as const,
          routeId: "j9b-full-plot",
          role: "scene_creator" as const,
          providerKind: "FAKE_CONTRACT" as const,
          providerId: "j9-local-gate",
          modelId: "deterministic-j9",
          modelConfigVersion: "full-plot-v1",
          certified: true,
          allowedContractVersions: ["plot-candidate/1"],
          inputTokenLimit: 5_000,
          outputTokenLimit: 5_000,
          timeoutMs: 1_000,
          fallbackRouteIds: []
        },
        coherenceCriticRoute: {
          schemaVersion: 1 as const,
          routeId: "j9b-full-plot-critic",
          role: "coherence_critic" as const,
          providerKind: "FAKE_CONTRACT" as const,
          providerId: "j9-local-gate",
          modelId: "deterministic-j9",
          modelConfigVersion: "full-critic-v1",
          certified: true,
          allowedContractVersions: ["narrative-ai-resolution/1"],
          inputTokenLimit: 1_600,
          outputTokenLimit: 1_600,
          timeoutMs: 1_000,
          fallbackRouteIds: []
        },
        retryPolicy: {
          schemaVersion: 1 as const,
          role: "scene_creator" as const,
          maxTechnicalRetries: 0,
          maxTargetedCorrections: 0,
          maxFullRegenerations: 0,
          allowFallback: false
        }
      },
      resolveContext: () => PLOT_CANDIDATE_J5_CONTEXT
    }),
    travelRuntime: createInstalledPlayableTravelRuntimeV1(runtimeBindings, {
      narrativeInterruption: false
    })
  } satisfies ConstructorParameters<typeof NarrativeTurnControllerV1>[0];
  const controller = new NarrativeTurnControllerV1(controllerOptions);

  const archivistDialogue = await submit(controller, "j9b:dialogue:archivist", "Je parle à l'archiviste.");
  const clerkDialogue = await submit(controller, "j9b:dialogue:clerk", "Je parle au clerc.");
  assert.equal(archivistDialogue.output.interpretation.referentResolution?.resolvedTarget?.ref, `npc:${archivistId}`);
  assert.equal(clerkDialogue.output.interpretation.referentResolution?.resolvedTarget?.ref, `npc:${clerkId}`);

  const inventoryRequests = [
    ["j9b:inventory:unequip", "Je déséquipe mon épée longue."],
    ["j9b:inventory:equip", "J'équipe mon épée longue dans ma main droite."],
    ["j9b:inventory:retrieve", "Je retire mes pièces d'or de ma bourse."],
    ["j9b:inventory:give", "Je donne mes pièces d'or à l'archiviste."],
    ["j9b:inventory:receive", "Je reçois mes pièces d'or de l'archiviste."],
    ["j9b:inventory:store", "Je range mes pièces d'or dans ma bourse."]
  ] as const;
  for (const [requestId, rawInput] of inventoryRequests) {
    const result = await submit(controller, requestId, rawInput);
    assert.equal(
      result.output.resolution.resultKind,
      "COMMIT_APPLIED",
      `${rawInput}: ${JSON.stringify(result.output.interpretation)}`
    );
  }

  const recruitmentRequest = [
    "j9b:recruitment",
    "Je demande à l'archiviste de rejoindre durablement mon groupe."
  ] as const;
  await submit(controller, ...recruitmentRequest);
  const refusalRequest = [
    "j9b:companion:refusal",
    "Je demande à l'archiviste de traverser seul une zone dangereuse."
  ] as const;
  await submit(controller, ...refusalRequest);
  const party = await controller.restoreCompanionParty();
  if (!party.ok || party.value.state === null) throw new Error("companion party missing");
  assert.equal(party.value.state.members[0]?.actorId, archivistId);
  assert.equal(party.value.state.directives.at(-1)?.disposition, "REFUSED");

  const plotRequest = ["j9b:plot-search", "Je fouille attentivement les archives."] as const;
  await submit(controller, ...plotRequest);
  const testimony = await controller.processActivePlotSceneBoundary({
    schemaVersion: 1,
    playerKnowledgeRefs: ["knowledge:clerc-testimony"]
  });
  if (!testimony.ok) throw new Error(testimony.error.messageKey);
  await submit(
    controller,
    "j9b:plot:false-hypothesis",
    "Je pense que le registre a simplement été mal rangé."
  );
  const plots = await controller.restorePlotRegistry();
  if (!plots.ok) throw new Error(plots.error.messageKey);
  assert.equal(plots.value.state.plots[0]?.plotId, "plot:missing-register");
  assert.equal(
    (plots.value.state.plots[0]?.discoveries as unknown[] | undefined)?.length,
    2
  );

  const travelRequest = ["j9b:travel-departure", "Je pars vers les Halles des commerces."] as const;
  const departure = await submit(controller, ...travelRequest);
  const activeTravel = await controller.restoreActiveTravel();
  if (!activeTravel.ok || activeTravel.value === null) throw new Error(
    `active travel missing: ${JSON.stringify(departure.output.interpretation)}`
  );
  assert.equal(activeTravel.value.plan.party?.memberActorIds.includes(archivistId), true);
  const arrival = await controller.advanceTravel({ schemaVersion: 1, clientRequestId: "j9b:travel-segment:1" });
  if (!arrival.ok) throw new Error(`${arrival.error.messageKey} ${JSON.stringify(arrival.error.details)}`);
  assert.equal(arrival.value.process.status, "ARRIVED");
  assert.equal(arrival.value.arrivalSceneId, hallesSceneId);
  const conclusionRequest = [
    "j9b:plot:conclusion",
    "J'en conclus que l'archiviste a déplacé le registre pour le protéger d'une saisie."
  ] as const;
  await submit(controller, ...conclusionRequest);

  const resumed = new NarrativeTurnControllerV1(controllerOptions);
  const [resumedScene, resumedParty, resumedPlots, profile] = await Promise.all([
    resumed.resolveActiveScene(),
    resumed.restoreCompanionParty(),
    resumed.restorePlotRegistry(),
    loadActiveCampaignCharacterProfileV1({ repository, campaignId })
  ]);
  if (!resumedScene.ok || !resumedParty.ok || !resumedPlots.ok || !profile.ok) {
    throw new Error("global resume failed");
  }
  assert.equal(resumedScene.value.sceneId, hallesSceneId);
  assert.equal(resumedParty.value.state?.currentSceneId, hallesSceneId);
  assert.equal(resumedParty.value.state?.members.length, 1);
  assert.equal(resumedPlots.value.state.plots.length, 1);
  assert.equal(resumedPlots.value.state.plots[0]?.status, "RESOLVED");
  assert.equal(resumedPlots.value.state.plots[0]?.scheduledEvents[0]?.status, "RESOLVED");
  const hypotheses = (resumedPlots.value.state.plots[0]?.playerHypotheses
    ?? []) as unknown as Array<{ status: string }>;
  assert.equal(hypotheses.some(value => value.status === "REFUTED"), true);
  assert.equal(hypotheses.some(value => value.status === "SUPPORTED"), true);
  const [character, external] = await Promise.all([
    repository.getAggregate(campaignId, "character.state", profile.value.characterStateAggregateId),
    repository.getAggregate(campaignId, EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, EXTERNAL_INVENTORY_AGGREGATE_ID_V1)
  ]);
  if (!character.ok || !external.ok) throw new Error("inventory projections missing");
  const inventory = character.value.payload.inventory as Array<{
    instanceId: string;
    equippedSlot: string | null;
    storedInInstanceId: string | null;
  }>;
  assert.equal(inventory.find(item => item.instanceId === "item-epee")?.equippedSlot, "main_droite");
  assert.equal(inventory.find(item => item.instanceId === "item-or")?.storedInInstanceId, "item-bourse");
  const archivistInventory = (external.value.payload.owners as Array<{
    ownerRef: string;
    inventory: Array<{ instanceId: string }>;
  }>).find(owner => owner.ownerRef === `npc:${archivistId}`)?.inventory ?? [];
  assert.deepEqual(archivistInventory, []);
  const characterRevisionBeforeReplay = character.value.aggregateRevision;
  const externalRevisionBeforeReplay = external.value.aggregateRevision;

  await submit(resumed, ...recruitmentRequest);
  await submit(resumed, ...refusalRequest);
  await submit(resumed, ...plotRequest);
  await submit(resumed, ...conclusionRequest);
  await submit(resumed, ...inventoryRequests[1]);
  await submit(resumed, ...inventoryRequests[3]);
  await submit(resumed, ...travelRequest);
  const replayedArrival = await resumed.advanceTravel({
    schemaVersion: 1,
    clientRequestId: "j9b:travel-segment:1"
  });
  if (!replayedArrival.ok) throw new Error(replayedArrival.error.messageKey);
  assert.equal(replayedArrival.value.replayed, true);
  const finalParty = await resumed.restoreCompanionParty();
  const finalPlots = await resumed.restorePlotRegistry();
  if (!finalParty.ok || !finalPlots.ok) throw new Error("final projections missing");
  assert.equal(finalParty.value.state?.members.length, 1);
  assert.equal(finalParty.value.state?.directives.length, 1);
  assert.equal(finalPlots.value.state.plots.length, 1);
  const [replayedCharacter, replayedExternal] = await Promise.all([
    repository.getAggregate(campaignId, "character.state", profile.value.characterStateAggregateId),
    repository.getAggregate(campaignId, EXTERNAL_INVENTORY_AGGREGATE_TYPE_V1, EXTERNAL_INVENTORY_AGGREGATE_ID_V1)
  ]);
  if (!replayedCharacter.ok || !replayedExternal.ok) throw new Error("replayed inventory missing");
  assert.equal(replayedCharacter.value.aggregateRevision, characterRevisionBeforeReplay);
  assert.equal(replayedExternal.value.aggregateRevision, externalRevisionBeforeReplay);
  console.log("J9-B/full-local: bootstrap -> 2 NPC -> personal/external inventory -> J4/J7 accept+refuse -> J5 -> J6 -> global resume/replay verified");
}

async function submit(
  controller: NarrativeTurnControllerV1,
  clientRequestId: string,
  rawInput: string
) {
  const result = await controller.submit({ schemaVersion: 1, clientRequestId, rawInput });
  if (!result.ok) throw new Error(`${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  return result.value;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
