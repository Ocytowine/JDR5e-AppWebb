import assert from "node:assert/strict";
import generatedNarrativeLoreCatalog from "../../../src/narration-ui/generated/narrativeLoreCatalog.generated.json";
import type { AiCallRequestV1 } from "../../src/ai";
import {
  MemoryCampaignRepository,
  copyMemoryState,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type MemoryState,
  type Result
} from "../../src/core";
import type { NarrativeLoreBuildCatalogV1 } from "../../src/context";
import {
  activeCampaignFactV1,
  buildPlayableSceneFromLoreLocationV1,
  createCampaignMissingInformationFactCreationRuntimeV1,
  createCampaignNpcInformationRuntimeV1,
  loadCampaignFactRegistryV1,
  loadNarrativeActorRegistryV1,
  type MissingInformationFactGeneratorConfigV1
} from "../../src/application";

const catalog = generatedNarrativeLoreCatalog as unknown as NarrativeLoreBuildCatalogV1;

async function main(): Promise<void> {
  let repository = new ReloadableMemoryRepository();
  const campaignId = await createCampaign(repository, "main");
  const provider = new MissingValueProvider("Maëlys Varne");
  let runtime = createRuntime(repository, campaignId, provider);
  const scene = archiveScene();
  const [guard, archivist] = [
    scene.ambientPopulation.find(actor => /garde/iu.test(actor.publicRole)),
    scene.ambientPopulation.find(actor => /archiviste/iu.test(actor.publicRole))
  ];
  assert.ok(guard && archivist);

  const first = await runtime.resolve({ operationId: "operation:j10j3:first", actorId: guard.actorId, need: opaqueNeed("A-91"), activeScene: scene });
  assert.equal(first.creation?.status, "CREATED");
  assert.ok(first.creation?.commitId);
  assert.equal(first.performerProjection.answerCoverage.status, "COMPLETE");
  assert.equal(first.resolution.creation.status, "EXECUTED");
  assert.ok(first.resolution.creation.proposalRefs.includes("lore-property:astryade:identite_dirigeant"));
  assert.ok(first.performerProjection.authorizedFacts.some(fact => fact.value === "Maëlys Varne"));
  assert.equal(first.performerProjection.performerMayCreateFacts, false);

  const second = await runtime.resolve({ operationId: "operation:j10j3:second", actorId: archivist.actorId, need: opaqueNeed("B-42"), activeScene: scene });
  assert.equal(second.creation, null, "the second NPC reads the durable fact instead of generating another value");
  assert.ok(second.performerProjection.authorizedFacts.some(fact => fact.value === "Maëlys Varne"));
  assert.equal(provider.calls, 1, "one generated proposal serves both NPCs");

  repository = repository.reload();
  runtime = createRuntime(repository, campaignId, provider);
  const afterReload = await runtime.resolve({ operationId: "operation:j10j3:reload", actorId: guard.actorId, need: opaqueNeed("C-07"), activeScene: scene });
  assert.ok(afterReload.performerProjection.authorizedFacts.some(fact => fact.value === "Maëlys Varne"));
  assert.equal(provider.calls, 1, "reload must not regenerate an existing value");
  const facts = expectOk(await loadCampaignFactRegistryV1(repository, campaignId));
  const actors = expectOk(await loadNarrativeActorRegistryV1(repository, campaignId));
  assert.equal(activeCampaignFactV1(facts.state, "lore-entity:astryade", "/identite_dirigeant")?.objectText, "Maëlys Varne");
  assert.equal(actors.state.actors.length, 1);
  assert.equal(actors.state.actors[0]?.publicRole, "Primarque d'Astryade");

  const concurrentRepository = new ReloadableMemoryRepository();
  const concurrentCampaignId = await createCampaign(concurrentRepository, "concurrent");
  const concurrentProvider = new MissingValueProvider("Néris Solane");
  const concurrentRuntime = createRuntime(concurrentRepository, concurrentCampaignId, concurrentProvider);
  const simultaneous = await Promise.all([
    concurrentRuntime.resolve({ operationId: "operation:j10j3:concurrent-a", actorId: guard.actorId, need: opaqueNeed("D-11"), activeScene: scene }),
    concurrentRuntime.resolve({ operationId: "operation:j10j3:concurrent-b", actorId: archivist.actorId, need: opaqueNeed("E-63"), activeScene: scene })
  ]);
  assert.ok(simultaneous.some(result => result.creation?.status === "CREATED"));
  const retried = await concurrentRuntime.resolve({ operationId: "operation:j10j3:concurrent-retry", actorId: archivist.actorId, need: opaqueNeed("F-25"), activeScene: scene });
  assert.ok(retried.performerProjection.authorizedFacts.some(fact => fact.value === "Néris Solane"));
  const concurrentFacts = expectOk(await loadCampaignFactRegistryV1(concurrentRepository, concurrentCampaignId));
  const concurrentActors = expectOk(await loadNarrativeActorRegistryV1(concurrentRepository, concurrentCampaignId));
  assert.equal(concurrentFacts.state.facts.filter(fact => fact.status === "ACTIVE" && fact.predicate === "/identite_dirigeant").length, 1);
  assert.equal(concurrentActors.state.actors.length, 1);

  const invalidProvider = new MissingValueProvider("Valeur refusée", { escapeProperty: true });
  const invalidRepository = new ReloadableMemoryRepository();
  const invalidCampaignId = await createCampaign(invalidRepository, "invalid");
  const invalid = await createRuntime(invalidRepository, invalidCampaignId, invalidProvider).resolve({
    operationId: "operation:j10j3:invalid",
    actorId: guard.actorId,
    need: opaqueNeed("G-88"),
    activeScene: scene
  });
  assert.equal(invalid.creation?.status, "FAILED");
  assert.equal(invalid.performerProjection.answerCoverage.status, "PARTIAL");
  assert.equal(expectOk(await loadCampaignFactRegistryV1(invalidRepository, invalidCampaignId)).state.facts.length, 0);

  console.log("missing-information-fact-creation/J10-J3: OK (owner-authored policy, proposal-only AI, atomic fact+identity, two NPCs, concurrency, reload, invalid proposal refusal)");
}

function createRuntime(repository: ReloadableMemoryRepository, campaignId: CampaignId, provider: MissingValueProvider) {
  const creation = createCampaignMissingInformationFactCreationRuntimeV1({
    catalog,
    repository,
    campaignId,
    generatorConfig: generatorConfig(provider)
  });
  return createCampaignNpcInformationRuntimeV1({
    catalog,
    repository,
    campaignId,
    missingInformationFactCreationRuntime: creation,
    anchorEntityIdForScene: () => "archives_de_lysenthe",
    localityRefsForScene: () => ["lore-entity:archives_de_lysenthe", "lore-entity:lysenthe", "lore-entity:astryade"]
  });
}

function opaqueNeed(marker: string) {
  return {
    schemaVersion: 1 as const,
    contractVersion: "information-need/2" as const,
    subjectMention: marker,
    proposedSubjectRef: "lore-entity:astryade",
    proposedScopeRefs: ["lore-entity:astryade"],
    proposedPropertyRefs: ["lore-property:astryade:titre_dirigeant", "lore-property:astryade:identite_dirigeant"],
    proposedRelationRefs: [],
    completionPropertyRefs: ["lore-property:astryade:titre_dirigeant", "lore-property:astryade:identite_dirigeant"],
    requestedDimension: `${marker}-dimension`,
    temporalScope: "CURRENT" as const,
    requestedAnswerShape: "IDENTITY" as const,
    sourceComponentId: `component:${marker}`
  };
}

function archiveScene() {
  const archive = catalog.entities.find(entity => entity.entityId === "archives_de_lysenthe");
  assert.ok(archive);
  return buildPlayableSceneFromLoreLocationV1({ entity: archive, fragments: catalog.fragments }).scene;
}

class MissingValueProvider {
  calls = 0;
  constructor(private readonly value: string, private readonly options: { escapeProperty?: boolean } = {}) {}
  async generate(request: AiCallRequestV1): Promise<unknown> {
    this.calls += 1;
    const target = request.input.roleContextPack as { target: { propertyRef: string; valueKind: "TEXT" | "IDENTITY" } };
    return {
      schemaVersion: 1,
      contractVersion: request.contractVersion,
      outputId: `output:${request.attemptId}`,
      callId: request.callId,
      attemptId: request.attemptId,
      packId: request.packId,
      snapshotId: request.snapshotId,
      role: request.role,
      status: "OK",
      payload: {
        proposalId: `proposal:${request.operationId}`,
        propertyRef: this.options.escapeProperty ? "lore-property:escape:forbidden" : target.target.propertyRef,
        valueKind: target.target.valueKind,
        generatedValue: this.value,
        authority: "PROPOSE_ONLY_NO_COMMIT"
      },
      diagnostics: [],
      supersedesOutputId: null
    };
  }
}

function generatorConfig(provider: MissingValueProvider): MissingInformationFactGeneratorConfigV1 {
  return {
    provider,
    route: {
      schemaVersion: 1, routeId: "test:j10j3", role: "scene_creator", providerKind: "FAKE_CONTRACT", providerId: "fake",
      modelId: "fake", modelConfigVersion: "j10j3", certified: true,
      allowedContractVersions: ["missing-information-fact-proposal/1"], inputTokenLimit: 2_000, outputTokenLimit: 600, timeoutMs: 5_000, fallbackRouteIds: []
    },
    retryPolicy: { schemaVersion: 1, role: "scene_creator", maxTechnicalRetries: 0, maxTargetedCorrections: 0, maxFullRegenerations: 0, allowFallback: false }
  };
}

async function createCampaign(repository: MemoryCampaignRepository, suffix: string): Promise<CampaignId> {
  const campaignId = opaqueId<CampaignId>(`campaign:j10j3:${suffix}`);
  const now = "2026-08-31T12:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>(`clock:j10j3:${suffix}`),
    dependencies: { contentPackageId: "content.jdr5e", contentPackageVersion: 1, rulesetId: "rules.jdr5e", rulesetVersion: 2, calendarId: "calendar.test", calendarVersion: 1 },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  expectOk(await repository.createCampaign(campaign, { elapsedGameSeconds: 0, calendarId: "calendar.test", calendarVersion: 1 }));
  return campaignId;
}

class ReloadableMemoryRepository extends MemoryCampaignRepository {
  reload(): ReloadableMemoryRepository {
    const repository = new ReloadableMemoryRepository();
    repository.state = copyMemoryState(this.state);
    return repository;
  }
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKey}`);
  return result.value;
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
