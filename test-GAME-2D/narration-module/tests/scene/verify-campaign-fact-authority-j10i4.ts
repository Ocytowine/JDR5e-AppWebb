import assert from "node:assert/strict";
import generatedNarrativeLoreCatalog from "../../../src/narration-ui/generated/narrativeLoreCatalog.generated.json";
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
import {
  CAMPAIGN_FACT_MUTATION_CONTRACT_VERSION_V1,
  activeCampaignFactV1,
  createCampaignBackedTargetedInformationReaderV1,
  createCampaignFactInformationReaderV1,
  createCampaignFactLoreAnchorValidatorV1,
  loadCampaignFactRegistryV1,
  loadNarrativeActorRegistryV1,
  mutateCampaignFactV1,
  type CampaignFactMutationCommandV1,
  type CampaignFactMutationResultV1
} from "../../src/application";
import type { NarrativeLoreBuildCatalogV1 } from "../../src/context";

async function main(): Promise<void> {
  let repository = new ReloadableMemoryRepository();
  const campaignId = await createCampaign(repository, "lysenthe");
  const anchorValidator = createCampaignFactLoreAnchorValidatorV1(generatedNarrativeLoreCatalog as unknown as NarrativeLoreBuildCatalogV1);
  const asserted = expectOk(await mutateCampaignFactV1({ repository, campaignId, command: tharqueCommand("guard-request"), anchorValidator }));
  assert.equal(asserted.outcome, "ASSERTED");
  assert.equal(asserted.identity?.displayName, "Aveline de Sorne");
  assert.ok(asserted.commitId, "identity and fact require a durable commit");

  const replay = expectOk(await mutateCampaignFactV1({ repository, campaignId, command: tharqueCommand("guard-request"), anchorValidator }));
  assert.equal(replay.replayed, true);
  assert.equal(replay.fact?.factId, asserted.fact?.factId);

  const archivist = expectOk(await mutateCampaignFactV1({ repository, campaignId, command: tharqueCommand("archivist-request"), anchorValidator }));
  assert.equal(archivist.outcome, "ALREADY_CURRENT");
  assert.equal(archivist.fact?.factId, asserted.fact?.factId, "two NPC demands reuse one fact");
  assert.equal(archivist.identity?.identityRef, asserted.identity?.identityRef, "two NPC demands reuse one identity");
  const invalidPublicReuse = await mutateCampaignFactV1({ repository, campaignId, command: { ...tharqueCommand("invalid-public-reuse"), sourceRefs: ["secret:tharque-name"] }, anchorValidator });
  assert.equal(invalidPublicReuse.ok, false, "reuse still validates the public source boundary");
  const unknownLoreAnchor = await mutateCampaignFactV1({ repository, campaignId, command: { ...tharqueCommand("unknown-lore-anchor"), subjectRef: "lore-entity:ville_inventee" }, anchorValidator });
  assert.equal(unknownLoreAnchor.ok, false, "unknown wiki subjects are rejected before persistence");

  repository = repository.reload();
  const factsAfterReload = expectOk(await loadCampaignFactRegistryV1(repository, campaignId));
  const actorsAfterReload = expectOk(await loadNarrativeActorRegistryV1(repository, campaignId));
  assert.equal(activeCampaignFactV1(factsAfterReload.state, "lore-entity:lysenthe", "/current_ruler_personal_identity")?.objectText, "Aveline de Sorne");
  assert.equal(actorsAfterReload.state.actors.length, 1, "light identity is reconstructible from its aggregate");
  const lookup = await createCampaignBackedTargetedInformationReaderV1({
    catalog: generatedNarrativeLoreCatalog as unknown as NarrativeLoreBuildCatalogV1,
    repository,
    campaignId
  }).lookup({
    schemaVersion: 1,
    lookupId: "j10i4-reloaded-targeted-lookup",
    campaignId,
    campaignRevision: 1,
    anchorEntityId: "archives_de_lysenthe",
    need: {
      schemaVersion: 1,
      contractVersion: "information-need/1",
      subjectMention: "la ville",
      proposedSubjectRef: "location:lysenthe",
      requestedDimension: "nom personnel du dirigeant actuel",
      temporalScope: "CURRENT",
      requestedAnswerShape: "IDENTITY",
      sourceComponentId: "component:j10i4-reload"
    },
    knowledgeRefs: [],
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"]
  });
  const reloadedCandidate = lookup.candidates.find(candidate => candidate.authority === "CAMPAIGN_FACT");
  assert.equal(reloadedCandidate?.value, "Aveline de Sorne", "targeted lookup consumes the persisted free fact after reload");
  assert.equal(reloadedCandidate?.subjectRef, "lore-entity:lysenthe");

  const contradiction = await mutateCampaignFactV1({
    repository,
    campaignId,
    anchorValidator,
    command: { ...tharqueCommand("contradiction"), proposedIdentity: { identityRef: "narrative-actor:false-tharque", displayName: "Un autre nom", publicRole: "Tharque de Lysenthe" } }
  });
  assert.equal(contradiction.ok, false, "ASSERT refuses a contradictory SINGLE value");

  const replacement = expectOk(await mutateCampaignFactV1({
    repository,
    campaignId,
    anchorValidator,
    occurredAtGameSecond: 0,
    command: {
      ...tharqueCommand("replace-tharque"),
      mutationKind: "REPLACE",
      expectedCurrentFactId: asserted.fact!.factId,
      proposedIdentity: { identityRef: "narrative-actor:tharque-beren", displayName: "Béren d'Orme", publicRole: "Tharque de Lysenthe" },
      sourceRefs: ["campaign-event:succession-confirmed"]
    }
  }));
  assert.equal(replacement.outcome, "REPLACED");
  assert.equal(replacement.fact?.supersedesFactId, asserted.fact?.factId);

  const invalidated = expectOk(await mutateCampaignFactV1({
    repository,
    campaignId,
    anchorValidator,
    occurredAtGameSecond: 0,
    command: {
      ...tharqueCommand("invalidate-tharque"),
      mutationKind: "INVALIDATE",
      objectText: null,
      proposedIdentity: null,
      expectedCurrentFactId: replacement.fact!.factId,
      sourceRefs: ["campaign-event:office-vacant"]
    }
  }));
  assert.equal(invalidated.outcome, "INVALIDATED");
  const historicalReader = createCampaignFactInformationReaderV1({ repository, campaignId });
  const historicalAtRevisionOne = await historicalReader.listEffectiveFacts({ schemaVersion: 1, campaignId, campaignRevision: 1, subjectRefs: ["lore-entity:lysenthe"], temporalScope: "CURRENT" });
  const historicalAtRevisionTwo = await historicalReader.listEffectiveFacts({ schemaVersion: 1, campaignId, campaignRevision: 2, subjectRefs: ["lore-entity:lysenthe"], temporalScope: "CURRENT" });
  const historicalAtRevisionThree = await historicalReader.listEffectiveFacts({ schemaVersion: 1, campaignId, campaignRevision: 3, subjectRefs: ["lore-entity:lysenthe"], temporalScope: "CURRENT" });
  assert.equal(historicalAtRevisionOne[0]?.objectText, "Aveline de Sorne", "revision one must not see its future replacement");
  assert.equal(historicalAtRevisionTwo[0]?.objectText, "Béren d'Orme", "revision two sees the replacement");
  assert.equal(historicalAtRevisionThree.length, 0, "revision three sees the explicit invalidation");
  const lifecycleEvents = expectOk(await repository.listEvents(campaignId, null, 20));
  assert.deepEqual(lifecycleEvents.map(event => event.eventType), ["campaign.fact.asserted", "campaign.fact.replaced", "campaign.fact.invalidated"]);

  const concurrentRepository = new ReloadableMemoryRepository();
  const concurrentCampaignId = await createCampaign(concurrentRepository, "concurrent");
  const commands = [tharqueCommand("concurrent-guard"), tharqueCommand("concurrent-archivist")];
  const concurrent = await Promise.all(commands.map(command => mutateCampaignFactV1({ repository: concurrentRepository, campaignId: concurrentCampaignId, command, anchorValidator })));
  assert.equal(concurrent.filter(result => result.ok).length, 1, "writer lease serializes concurrent creation");
  assert.equal(concurrent.filter(result => !result.ok && result.error.code === "CAMPAIGN_BUSY").length, 1);
  const retryIndex = concurrent.findIndex(result => !result.ok);
  const retried = expectOk(await mutateCampaignFactV1({ repository: concurrentRepository, campaignId: concurrentCampaignId, command: commands[retryIndex]!, anchorValidator }));
  assert.equal(retried.outcome, "ALREADY_CURRENT");
  const concurrentFacts = expectOk(await loadCampaignFactRegistryV1(concurrentRepository, concurrentCampaignId));
  const concurrentActors = expectOk(await loadNarrativeActorRegistryV1(concurrentRepository, concurrentCampaignId));
  assert.equal(concurrentFacts.state.facts.filter(fact => fact.status === "ACTIVE").length, 1);
  assert.equal(concurrentActors.state.actors.length, 1, "concurrent requests cannot duplicate the light identity");

  console.log("PASS [J10-I4] atomic free fact + light identity, lifecycle, replay, reload and concurrent no-duplicate gate");
}

function tharqueCommand(clientRequestId: string): CampaignFactMutationCommandV1 {
  return {
    schemaVersion: 1,
    contractVersion: CAMPAIGN_FACT_MUTATION_CONTRACT_VERSION_V1,
    clientRequestId,
    mutationKind: "ASSERT",
    subjectRef: "lore-entity:lysenthe",
    predicate: "/current_ruler_personal_identity",
    objectText: null,
    proposedIdentity: { identityRef: "narrative-actor:tharque-aveline", displayName: "Aveline de Sorne", publicRole: "Tharque de Lysenthe" },
    expectedCurrentFactId: null,
    knowledgeLevel: "LOCAL",
    sourceRefs: ["lore-fact:fact.lysenthe.type_gouvernance", "lore-fact:fact.lysenthe.siege_pouvoir"],
    validatorDomains: ["WORLD", "FACTION"]
  };
}

async function createCampaign(repository: MemoryCampaignRepository, suffix: string): Promise<CampaignId> {
  const campaignId = opaqueId<CampaignId>(`campaign:j10i4:${suffix}`);
  const now = "2026-08-28T12:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>(`clock:j10i4:${suffix}`),
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
    return ReloadableMemoryRepository.fromState(this.state);
  }

  private static fromState(state: MemoryState): ReloadableMemoryRepository {
    const repository = new ReloadableMemoryRepository();
    repository.state = copyMemoryState(state);
    return repository;
  }
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  return result.value;
}

void main();
