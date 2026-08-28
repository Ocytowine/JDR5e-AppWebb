import assert from "node:assert/strict";
import generatedNarrativeLoreCatalog from "../../../src/narration-ui/generated/narrativeLoreCatalog.generated.json";
import type { ContractAiProviderV1 } from "../../src/ai";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result
} from "../../src/core";
import type { NarrativeLoreBuildCatalogV1 } from "../../src/context";
import {
  buildPlayableSceneFromLoreLocationV1,
  captureNpcTestimonyV1,
  createCampaignNpcInformationRuntimeV1,
  createDefaultNpcPerformerConfigV1,
  createInitialReferenceSceneStateV1,
  loadClaimResolutionRegistryV1,
  loadTestimonyRegistryV1,
  performNpcTurnV1,
  validateNpcPerformanceAgainstInformationProjectionV1
} from "../../src/application";

async function main(): Promise<void> {
  const repository = new MemoryCampaignRepository();
  const campaignId = await createCampaign(repository);
  const catalog = generatedNarrativeLoreCatalog as unknown as NarrativeLoreBuildCatalogV1;
  const archive = catalog.entities.find(entity => entity.entityId === "archives_de_lysenthe");
  assert.ok(archive);
  const scene = buildPlayableSceneFromLoreLocationV1({ entity: archive, fragments: catalog.fragments }).scene;
  const guard = scene.ambientPopulation.find(actor => /garde/iu.test(actor.publicRole));
  assert.ok(guard, "the archive scene must expose its local guard");
  const actorId = `npc:${guard.actorId}`;
  const need = {
    schemaVersion: 1 as const,
    contractVersion: "information-need/1" as const,
    subjectMention: "la ville",
    proposedSubjectRef: "location:lysenthe",
    requestedDimension: "personne ou autorité qui dirige actuellement la ville",
    temporalScope: "CURRENT" as const,
    requestedAnswerShape: "IDENTITY" as const,
    sourceComponentId: "component:j10i6"
  };
  const runtime = createCampaignNpcInformationRuntimeV1({
    catalog,
    repository,
    campaignId,
    anchorEntityIdForScene: () => "archives_de_lysenthe",
    localityRefsForScene: () => ["lore-entity:archives_de_lysenthe", "lore-entity:lysenthe"]
  });
  const information = await runtime.resolve({
    operationId: "operation:j10i6",
    actorId,
    need,
    activeScene: scene
  });
  assert.equal(information.performerProjection.decision, "ANSWER_DIRECTLY");
  assert.ok(information.performerProjection.authorizedFacts.some(fact => /Tharque regent de Lysenthe/iu.test(fact.value)));
  assert.equal(information.diagnostic.privateValuesIncluded, false);
  assert.equal(information.diagnostic.status, "RESOLVED");

  const failingProvider: ContractAiProviderV1 = {
    async generate() {
      return { status: "FAILED", reason: "simulated performer outage after factual resolution" };
    }
  };
  const baseConfig = createDefaultNpcPerformerConfigV1();
  const performed = await performNpcTurnV1({
    repository,
    campaignId,
    operationId: "operation:j10i6",
    rawInput: "Savez-vous qui dirige la ville ?",
    interpretation: interpretation(actorId) as never,
    mjPlan: null,
    resolution: { resultKind: "COMMIT_APPLIED" } as never,
    sceneState: createInitialReferenceSceneStateV1(),
    activeScene: scene,
    config: { ...baseConfig, provider: failingProvider },
    assignedActorId: actorId,
    informationDisclosure: information.performerProjection
  });
  assert.equal(performed.calledPerformer, true);
  assert.equal(performed.performance, null);
  assert.ok(performed.performanceFailure);
  const fallback = performed.fallbackPerformance;
  assert.ok(fallback, "a performer outage must keep a grounded local answer");
  assert.match(fallback.utterances[0]?.text ?? "", /Tharque regent de Lysenthe/iu);
  assert.deepEqual(validateNpcPerformanceAgainstInformationProjectionV1({
    projection: information.performerProjection,
    performance: fallback
  }), []);
  assert.doesNotMatch(JSON.stringify(fallback), /(?:secret|private|hidden):/iu);

  await seedCompletedRenderOperation(repository, campaignId, "operation:j10i6-rendered");
  const captured = expectOk(await captureNpcTestimonyV1({
    repository,
    campaignId,
    performance: fallback,
    finalNpcSpeechText: fallback.utterances[0]?.text ?? null,
    sourceOperationId: "operation:j10i6-rendered",
    sceneRef: `scene:${scene.sceneId}`,
    playerActorRef: "actor:player-j10i6",
    occurredAtGameSecond: 0
  }));
  assert.equal(captured.status, "RECORDED");
  const testimonies = expectOk(await loadTestimonyRegistryV1(repository, campaignId));
  assert.equal(testimonies.state.testimonies[0]?.assertsObjectiveTruth, false);
  const objectiveResolutions = expectOk(await loadClaimResolutionRegistryV1(repository, campaignId));
  assert.equal(objectiveResolutions.state.resolutions.length, 0, "attributed NPC speech must not create objective truth");

  console.log("npc-information-performance/J10-I6: OK (campaign/lore pipeline, authorized performer packet, grounded outage fallback, attributed testimony, safe diagnostic)");
}

function interpretation(actorId: string): object {
  return {
    schemaVersion: 1,
    intentId: "intent:j10i6",
    intentType: "speech",
    commitment: "committed",
    coreMeaning: "Demander au garde qui dirige la ville.",
    requiresClarification: false,
    semanticIntent: {
      schemaVersion: 1,
      kind: "address_visible_actor",
      playerGoal: "obtenir l'identité de l'autorité qui dirige la ville",
      target: { kind: "npc", ref: actorId, label: "le garde" },
      commitment: "committed",
      evidenceFromInput: ["qui dirige la ville"],
      uncertainties: [],
      forbiddenInterpretations: [],
      confidence: "high",
      perception: null,
      dialogueAct: {
        schemaVersion: 1,
        act: "ASK_QUESTION",
        contentGoal: "savoir qui dirige la ville",
        questionForm: "OPEN",
        expectedResponse: "INFORMATION"
      }
    },
    runtimeDecision: { status: "READY", reason: "test", requiredDomain: "scene" }
  };
}

async function createCampaign(repository: MemoryCampaignRepository): Promise<CampaignId> {
  const campaignId = opaqueId<CampaignId>("campaign:j10i6");
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("clock:j10i6"),
    dependencies: {
      contentPackageId: "content.jdr5e",
      contentPackageVersion: 1,
      rulesetId: "rules.jdr5e",
      rulesetVersion: 2,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: "2026-08-28T12:00:00.000Z",
    updatedAt: "2026-08-28T12:00:00.000Z"
  };
  expectOk(await repository.createCampaign(campaign, { elapsedGameSeconds: 0, calendarId: "calendar.test", calendarVersion: 1 }));
  return campaignId;
}

async function seedCompletedRenderOperation(repository: MemoryCampaignRepository, campaignId: CampaignId, operationId: string): Promise<void> {
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const payload = { schemaVersion: 1, purpose: "accepted grounded NPC fallback" } as const;
  const now = "2026-08-28T12:00:00.000Z";
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: opaqueId<OperationId>(operationId),
    campaignId,
    clientRequestId: opaqueId<RequestId>(`${operationId}:request`),
    idempotencyKey: opaqueId<IdempotencyKey>(`${operationId}:idempotency`),
    requestFingerprint: await computeRequestFingerprint("narrative.render.projection", 1, payload),
    operationKind: "narrative.render.projection",
    requestPayloadSchemaVersion: 1,
    requestPayload: payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  expectOk(await repository.receiveOperation(operation));
  expectOk(await repository.completeWithoutCommit(operation.operationId, 1, { schemaVersion: 1, acceptedNpcUtterance: true }));
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKey}`);
  return result.value;
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
