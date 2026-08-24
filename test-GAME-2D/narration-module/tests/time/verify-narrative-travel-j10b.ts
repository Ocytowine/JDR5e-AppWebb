import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
  activateCampaignInitialSceneV1,
  CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  createCampaignWorldSimulationRuntimeV1,
  NarrativeTurnControllerV1,
  type CampaignRuntimeBindingsV1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type {
  AiCallRequestV1,
  AiRoleOutputEnvelopeV1,
  AiSemanticIntentPayloadV6,
  AiSemanticPlayerIntentV6
} from "../../src/ai/types";
import {
  CampaignBootstrapServiceV1,
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
import { createInstalledPlayableTravelRuntimeV1 } from
  "../../../src/narration-ui/playableCampaignTravelCatalog";

const campaignId = opaqueId<CampaignId>("cmp-j10b-narrative-travel");
const ids: CampaignBootstrapIdsV1 = {
  campaignId,
  operationId: opaqueId("op-bootstrap-j10b"),
  clientRequestId: opaqueId("req-bootstrap-j10b"),
  idempotencyKey: opaqueId("idem-bootstrap-j10b"),
  commitId: opaqueId("commit-bootstrap-j10b"),
  eventId: opaqueId("event-bootstrap-j10b"),
  clockAggregateId: opaqueId("agg-clock-j10b"),
  characterAggregateId: opaqueId("agg-character-j10b"),
  tacticalProjectionAggregateId: opaqueId("agg-tactical-j10b"),
  narrativeProjectionAggregateId: opaqueId("agg-narrative-j10b"),
  positionAggregateId: opaqueId("agg-position-j10b"),
  bootstrapContextAggregateId: opaqueId("agg-bootstrap-context-j10b")
};
const runtimeBindings: CampaignRuntimeBindingsV1 = {
  schemaVersion: 1,
  contractVersion: CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  positionAggregateId: ids.positionAggregateId,
  sceneLifecycleAggregateId: opaqueId<AggregateId>("agg-scene-lifecycle-j10b"),
  scheduleAggregateId: opaqueId<AggregateId>("agg-schedule-j10b"),
  simulationCursorAggregateId: opaqueId<AggregateId>("agg-simulation-cursor-j10b"),
  processAggregateId: opaqueId<AggregateId>("agg-process-j10b"),
  version: 1
};
const clock: RepositoryClock = {
  now: () => new Date("2026-08-24T14:00:00.000Z")
};

function intentFor(rawInput: string): AiSemanticPlayerIntentV6 {
  const observes = rawInput.toLowerCase().includes("observe");
  const base = {
    commitment: "committed" as const,
    preconditions: [],
    uncertainties: [],
    clarificationPrompt: null,
    confidence: "high" as const,
    companionDirective: null,
    composition: {
      orientation: null,
      spatialLeadIn: null,
      communication: null,
      spatialFollowUp: null
    }
  };
  if (observes) return {
    ...base,
    kind: "observe_environment",
    playerGoal: "Observer le cortÃ¨ge avant d'agir.",
    actionHint: "observer attentivement le cortÃ¨ge",
    domainHint: "scene_resolution",
    scope: "PERCEPTION",
    targetMention: null,
    perception: {
      schemaVersion: 1,
      depth: "FOCUSED",
      focus: "le cortÃ¨ge qui coupe la rue",
      soughtInformation: "un passage praticable",
      informationKind: "VISIBLE_TRAIT"
    },
    dialogueAct: null
  };
  return {
    ...base,
    kind: "traverse_visible_boundary",
    playerGoal: "Prendre ou reprendre la route vers les Halles.",
    actionHint: "poursuivre le trajet vers les Halles",
    domainHint: "world",
    scope: "SCENE_TRANSITION",
    targetMention: {
      surface: "les Halles des commerces",
      candidateKind: "place",
      proposedRef: "location:halles_des_commerces",
      contextLink: "EXPLICIT"
    },
    perception: null,
    dialogueAct: null
  };
}

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
      payload: { rawInputEcho: task.rawInput, intent: intentFor(task.rawInput) },
      diagnostics: [],
      supersedesOutputId: null
    } satisfies AiRoleOutputEnvelopeV1<AiSemanticIntentPayloadV6>;
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
  const activated = await activateCampaignInitialSceneV1({
    repository,
    campaignId,
    runtimeBindings,
    sceneId: "wiki-location:archives_de_lysenthe",
    locationRef: "location:archives_de_lysenthe",
    technicalTimestamp: clock.now().toISOString()
  });
  if (!activated.ok) throw new Error(activated.error.messageKey);
  const world = createCampaignWorldSimulationRuntimeV1({
    repository,
    campaignId,
    runtimeBindings,
    initialWorldState: { schemaVersion: 1, fixture: "j10b-narrative-travel" },
    clock
  });
  const initialized = await world.ensureInitialized();
  if (!initialized.ok) throw new Error(initialized.error.messageKey);

  const options = {
    repository,
    campaignId,
    clock,
    runtimeBindings,
    idPrefix: "j10b-travel",
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
          ? { ok: false as const, error: coreError("VALIDATION_FAILED", "j10b.scene-missing") }
          : { ok: true as const, value: scene };
      }
    },
    intentInterpreterConfig: {
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V6,
      route: {
        schemaVersion: 1 as const,
        routeId: "j10b-travel-intent",
        role: "player_intent_interpreter" as const,
        providerKind: "FAKE_CONTRACT" as const,
        providerId: "j10b-local",
        modelId: "deterministic-j10b",
        modelConfigVersion: "narrative-travel-v1",
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
    interpreterCharacterContextResolver: null,
    travelRuntime: createInstalledPlayableTravelRuntimeV1(runtimeBindings)
  } satisfies ConstructorParameters<typeof NarrativeTurnControllerV1>[0];
  const controller = new NarrativeTurnControllerV1(options);

  const departure = await submit(
    controller,
    "j10b:departure",
    "Nous partons vers les Halles des commerces."
  );
  assert.match(lastNarration(departure), /prenez la route/u);

  const interruption = await submit(
    controller,
    "j10b:continue:1",
    "Nous reprenons la route vers les Halles."
  );
  assert.match(lastNarration(interruption), /cortÃ¨ge compact/u);
  const suspended = await controller.restoreActiveTravel();
  if (!suspended.ok || suspended.value === null) throw new Error("suspended travel missing");
  assert.equal(suspended.value.status, "INTERRUPTED");
  assert.equal(suspended.value.checkpoint.elapsedTravelSeconds, 900);
  const clockAfterInterruption = await elapsedGameSeconds(repository);

  const resumed = new NarrativeTurnControllerV1(options);
  const restored = await resumed.restoreActiveTravel();
  if (!restored.ok || restored.value === null) throw new Error("restored interruption missing");
  assert.equal(restored.value.checkpoint.checkpointId, suspended.value.checkpoint.checkpointId);
  const replayedInterruption = await submit(
    resumed,
    "j10b:continue:1",
    "Nous reprenons la route vers les Halles."
  );
  assert.equal(lastNarration(replayedInterruption), lastNarration(interruption));
  assert.equal(await elapsedGameSeconds(repository), clockAfterInterruption);
  const stillSuspended = await resumed.restoreActiveTravel();
  if (!stillSuspended.ok || stillSuspended.value === null) {
    throw new Error("replayed interruption changed the active travel");
  }
  assert.equal(stillSuspended.value.status, "INTERRUPTED");
  assert.doesNotMatch(
    JSON.stringify(replayedInterruption.displayPacket),
    /seedFingerprint|threshold|worldPressure|"roll"/u
  );

  const response = await submit(
    resumed,
    "j10b:interruption:observe",
    "J'observe attentivement le cortÃ¨ge et cherche un passage."
  );
  assert.match(lastNarration(response), /reprendre la route/u);
  assert.equal(await elapsedGameSeconds(repository), clockAfterInterruption);
  const active = await resumed.restoreActiveTravel();
  if (!active.ok || active.value === null) throw new Error("resolved travel missing");
  assert.equal(active.value.status, "ACTIVE");

  await submit(
    resumed,
    "j10b:interruption:observe",
    "J'observe attentivement le cortÃ¨ge et cherche un passage."
  );
  assert.equal(await elapsedGameSeconds(repository), clockAfterInterruption);

  const arrival = await submit(
    resumed,
    "j10b:continue:2",
    "Nous poursuivons la route jusqu'aux Halles."
  );
  assert.match(lastNarration(arrival), /atteignez les Halles/u);
  assert.equal(arrival.activeScene.sceneId, "wiki-location:halles_des_commerces");
  assert.equal(arrival.displayPacket.sceneId, "wiki-location:halles_des_commerces");
  const elapsedAtArrival = await elapsedGameSeconds(repository);
  assert.equal(elapsedAtArrival - clockAfterInterruption, 900);
  const scene = await resumed.resolveActiveScene();
  if (!scene.ok) throw new Error(scene.error.messageKey);
  assert.equal(scene.value.sceneId, "wiki-location:halles_des_commerces");
  const noTravel = await resumed.restoreActiveTravel();
  if (!noTravel.ok) throw new Error(noTravel.error.messageKey);
  assert.equal(noTravel.value, null);

  const replayedArrival = await submit(
    resumed,
    "j10b:continue:2",
    "Nous poursuivons la route jusqu'aux Halles."
  );
  assert.equal(
    replayedArrival.activeScene.sceneId,
    "wiki-location:halles_des_commerces"
  );
  assert.equal(await elapsedGameSeconds(repository), elapsedAtArrival);
  console.log(
    "J10-B/travel: free departure -> interruption -> reload -> free response -> resume -> arrival -> idempotent replay verified"
  );
}

async function submit(
  controller: NarrativeTurnControllerV1,
  clientRequestId: string,
  rawInput: string
) {
  const result = await controller.submit({ schemaVersion: 1, clientRequestId, rawInput });
  if (!result.ok) throw new Error(
    `${result.error.messageKey} ${JSON.stringify(result.error.details)}`
  );
  return result.value.output;
}

function lastNarration(output: Awaited<ReturnType<typeof submit>>): string {
  return output.displayPacket.displayBlocks
    .filter(block => block.kind === "GM_NARRATION")
    .at(-1)?.text ?? "";
}

async function elapsedGameSeconds(
  repository: MemoryCampaignBootstrapRepository
): Promise<number> {
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) throw new Error(campaign.error.messageKey);
  const aggregate = await repository.getAggregate(
    campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!aggregate.ok) throw new Error(aggregate.error.messageKey);
  return Number(aggregate.value.payload.elapsedGameSeconds);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
