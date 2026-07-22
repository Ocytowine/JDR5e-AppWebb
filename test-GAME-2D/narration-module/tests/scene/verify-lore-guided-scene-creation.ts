import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateDynamicCreationProposalV1, type DynamicCreationValidationPolicyV1 } from "../../src/ai";
import {
  buildDynamicPlaceCreationProposalV1,
  buildLoreGuidedSceneCreationBriefV1,
  buildLoreGuidedSceneCreationBriefFromCampaignV1,
  buildDynamicPlaceSceneAfterCommitV1,
  buildPlaceCreationCommitV1,
  preparePlaceCreationCommandV1,
  validatePlaceCreationProposalV1,
  type CampaignLoreProjectionV1
} from "../../src/application";
import type { SceneTransitionTopologyV1 } from "../../src/application";
import {
  opaqueId,
  validateCommitRequest,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CommitId,
  type CommitRecord,
  type OperationId,
  type WriterId
} from "../../src/core";
import { compileLoreSourceV1, type LoreEntityV1, type LoreFragmentV1 } from "../../src/bootstrap/lore";
import { selectLoreInfluencesV1 } from "../../src/context";
import { assert } from "../contracts/assertions";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const sourcePaths = [
  "wiki/lore/territoire/astryade",
  "wiki/lore/territoire/region/Ylsséa/index",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/index",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/quartiers/quartier_des_archives",
  "wiki/lore/territoire/region/Ylsséa/Lysenthe/batiments/archives_de_lysenthe",
  "wiki/lore/factions/archivistes_de_lysenthe",
  "wiki/lore/populations/especes/humains.md",
  "wiki/lore/populations/especes/elfes.md",
  "wiki/lore/populations/cultures/culture_cotiere_ylssea.md"
] as const;

async function compilePilot(): Promise<{ entities: LoreEntityV1[]; fragments: LoreFragmentV1[] }> {
  const entities: LoreEntityV1[] = [];
  const fragments: LoreFragmentV1[] = [];
  for (const sourcePath of sourcePaths) {
    const result = await compileLoreSourceV1({
      sourcePath,
      sourceText: await readFile(`${repositoryRoot}${sourcePath}`, "utf8")
    }, { packageId: "jdr5e.lore-guided-scene-test", packageVersion: 1 });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    entities.push(result.value.entity);
    fragments.push(...result.value.fragments);
  }
  return { entities, fragments };
}

function projection(overrides: Partial<CampaignLoreProjectionV1> = {}): CampaignLoreProjectionV1 {
  return {
    schemaVersion: 1,
    projectionId: "campaign-projection-archives-status",
    entityId: "archives_de_lysenthe",
    fieldPath: "/resume",
    disposition: "REPLACE",
    replacementText: "Les Archives restent identifiables, mais leur accueil public est temporairement interrompu par l'état courant de la campagne.",
    sourceRefs: ["aggregate:campaign-fact:archives-status:7"],
    campaignRevision: 7,
    version: 1,
    ...overrides
  };
}

async function run(): Promise<void> {
  const pilot = await compilePilot();
  const selected = selectLoreInfluencesV1({
    creationType: "PLACE",
    anchorEntityId: "archives_de_lysenthe",
    ...pilot,
    allowedKnowledgeLevels: ["COMMUN", "LOCAL"],
    maximumInfluences: 100
  });
  assert.equal(selected.ok, true);
  if (!selected.ok) return;

  const briefResult = await buildLoreGuidedSceneCreationBriefFromCampaignV1({
    briefId: "brief-street-near-archives",
    campaignId: "campaign-1",
    campaignRevision: 7,
    packet: selected.packet,
    projectionReader: {
      async listEffectiveProjections(request) {
        assert.equal(request.campaignId, "campaign-1");
        assert.ok(request.targets.some(target => target.entityId === "archives_de_lysenthe" && target.fieldPath === "/resume"));
        return {
          schemaVersion: 1,
          authority: "CampaignFactDomain",
          campaignId: request.campaignId,
          campaignRevision: request.campaignRevision,
          projections: [projection()],
          sourceRefs: ["aggregate:campaign-fact:archives-status:7"],
          version: 1
        };
      }
    }
  });
  assert.equal(briefResult.ok, true);
  if (!briefResult.ok) return;
  assert.equal(briefResult.brief.nonCommittable, true);
  const overridden = briefResult.brief.strictConstraints.find(influence =>
    influence.entityId === "archives_de_lysenthe" && influence.fieldPath === "/resume"
  );
  assert.ok(overridden);
  assert.equal(overridden.authority, "CAMPAIGN_PROJECTION");
  assert.ok(overridden.effectiveSourceRefs.includes("aggregate:campaign-fact:archives-status:7"));
  assert.ok(briefResult.brief.localGuidance.some(influence => influence.entityId === "quartier_des_archives"));
  assert.ok(briefResult.brief.regionalGuidance.some(influence => influence.entityId === "culture_cotiere_ylssea"));

  const candidate = {
    proposalId: "proposal-passage-copistes",
    requestedDepth: "LIGHT_REFERENCE" as const,
    displayName: "Passage des Copistes",
    summary: "Passage administratif reliant les abords des Archives à une rue du quartier.",
    initialTension: "L'activité reste ordonnée, mais l'accès interrompu aux Archives retient les passants près du passage.",
    perceptibleFeatures: ["pierre claire", "circulation de clercs et de copistes"],
    populationRoles: ["clerc", "copiste", "garde"],
    localNorms: ["demandes formulées avec précision", "accès surveillé près des dépôts"],
    proposedPlaceRef: "location:passage_des_copistes",
    arrivalSceneId: "dynamic-place:passage_des_copistes",
    parentLocationRef: "location:quartier_des_archives",
    connectionIntents: [{
      sourceSceneId: "wiki-location:archives_de_lysenthe",
      boundaryRef: "poi:passage-vers-rue",
      destinationRef: "location:passage_des_copistes",
      scale: "LOCAL" as const,
      sourceRefs: ["world-topology:quartier_des_archives:1"]
    }, {
      sourceSceneId: "dynamic-place:passage_des_copistes",
      boundaryRef: "poi:retour-vers-archives",
      destinationRef: "location:archives_de_lysenthe",
      scale: "LOCAL" as const,
      sourceRefs: ["world-topology:quartier_des_archives:1"]
    }],
    reason: "Créer une référence légère pour une rue non préfabriquée atteinte depuis les Archives.",
    expectedEffects: ["can_be_revisited"],
    narrativeCommitments: ["stable_place_identity"],
    duplicatePolicy: "REJECT_IF_SIMILAR" as const
  };
  const proposalResult = buildDynamicPlaceCreationProposalV1({ brief: briefResult.brief, candidate });
  assert.equal(proposalResult.ok, true);
  if (!proposalResult.ok) return;
  const policy: DynamicCreationValidationPolicyV1 = {
    schemaVersion: 1,
    creativeScope: {
      mayCreate: ["PLACE"],
      mayReference: briefResult.brief.sourceRefs,
      mayProposeCommands: [],
      mayReveal: { reveal: [], hint: [], withhold: [] },
      mustPreserve: briefResult.brief.strictConstraints.map(influence => influence.effectiveText),
      mustNotCreate: ["new rule", "unvalidated durable actor"],
      mustNotModify: ["wiki source"],
      noveltyConstraints: ["respect lore influence packet", "campaign projections override initial lore"]
    },
    knownAnchorIds: ["archives_de_lysenthe"],
    duplicateCandidateIds: [],
    allowActorScopedVisibility: false
  };
  const validation = validateDynamicCreationProposalV1(proposalResult.proposal, policy);
  assert.equal(validation.ok, true);
  if (validation.ok) assert.equal(validation.decision, "PROMOTE_LIGHT_REFERENCE");

  const topology: SceneTransitionTopologyV1 = {
    schemaVersion: 1,
    contractVersion: "scene-transition/1",
    topologyId: "topology-quartier-archives",
    topologyVersion: 1,
    connections: []
  };
  const placePolicy = {
    schemaVersion: 1 as const,
    contractVersion: "place-creation-validation/1" as const,
    allowedPersistenceDepths: ["LIGHT_REFERENCE", "FULL_ENTITY"] as const,
    allowedParentLocationRefs: ["location:quartier_des_archives"],
    knownSourceSceneIds: ["wiki-location:archives_de_lysenthe"],
    knownPlaces: [{
      placeRef: "location:place_des_archives",
      displayName: "Place des Archives",
      aliases: ["grande place"],
      parentLocationRef: "location:quartier_des_archives",
      sourceRefs: ["lore:quartier_des_archives"]
    }],
    maximumConnections: 3,
    version: 1 as const
  };
  const placeValidation = validatePlaceCreationProposalV1({ proposal: proposalResult.proposal, topology, policy: placePolicy });
  assert.equal(placeValidation.ok, true);
  if (placeValidation.ok) {
    assert.equal(placeValidation.commitAuthority, false);
    assert.equal(placeValidation.topologyAdditions[0]?.destinationRef, "location:passage_des_copistes");

    const campaignId = opaqueId<CampaignId>("campaign-1");
    const operationId = opaqueId<OperationId>("operation-place-1");
    const placeRegistry: AggregateRecord = {
      schemaVersion: 1,
      campaignId,
      aggregateType: "world.place-registry",
      aggregateId: opaqueId<AggregateId>("agg-place-registry"),
      aggregateRevision: 2,
      payloadSchemaVersion: 1,
      payload: { schemaVersion: 1, contractVersion: "world-place-registry/1", places: [], version: 2 },
      updatedByCommitId: null
    };
    const topologyAggregate: AggregateRecord = {
      schemaVersion: 1,
      campaignId,
      aggregateType: "world.scene-topology",
      aggregateId: opaqueId<AggregateId>("agg-scene-topology"),
      aggregateRevision: 4,
      payloadSchemaVersion: 1,
      payload: { schemaVersion: 1, contractVersion: "world-scene-topology/1", topology, version: 4 },
      updatedByCommitId: null
    };
    const factRegistry: AggregateRecord = {
      schemaVersion: 1,
      campaignId,
      aggregateType: "campaign.place-facts",
      aggregateId: opaqueId<AggregateId>("agg-place-facts"),
      aggregateRevision: 1,
      payloadSchemaVersion: 1,
      payload: { schemaVersion: 1, contractVersion: "campaign-place-facts/1", facts: [], version: 1 },
      updatedByCommitId: null
    };
    const preparedCommand = preparePlaceCreationCommandV1({
      campaignId,
      operationId,
      commandId: "command-create-passage",
      idempotencyKey: "campaign-1:operation-place-1:create-passage",
      validation: placeValidation,
      placeRegistryAggregate: placeRegistry,
      topologyAggregate,
      factRegistryAggregate: factRegistry
    });
    assert.equal(preparedCommand.ok, true);
    if (!preparedCommand.ok) return;
    const commitId = opaqueId<CommitId>("commit-create-passage");
    const commitBuild = buildPlaceCreationCommitV1({
      command: preparedCommand.command,
      campaignId,
      operationId,
      commitId,
      expectedCampaignRevision: 7,
      requestFingerprint: `sha256:${"1".repeat(64)}`,
      writerLease: {
        campaignId,
        writerId: opaqueId<WriterId>("writer-place-1"),
        fencingToken: 1,
        acquiredAt: "2026-07-22T12:00:00.000Z",
        expiresAt: "2026-07-22T12:02:00.000Z"
      },
      acceptedAtGameSecond: 120,
      placeRegistryAggregate: placeRegistry,
      topologyAggregate,
      factRegistryAggregate: factRegistry
    });
    assert.equal(commitBuild.ok, true, commitBuild.ok ? undefined : commitBuild.issues.join(" | "));
    if (!commitBuild.ok) return;
    assert.equal(validateCommitRequest(commitBuild.commit).valid, true);
    assert.equal(commitBuild.commit.aggregateWrites.length, 3);
    const committed: CommitRecord = {
      schemaVersion: 1,
      commitId,
      campaignId,
      operationId,
      idempotencyKey: commitBuild.commit.idempotencyKey,
      requestFingerprint: commitBuild.commit.requestFingerprint,
      previousCampaignRevision: 7,
      campaignRevision: 8,
      commitSequence: 8,
      commandIds: commitBuild.commit.acceptedCommands.map(command => command.commandId),
      eventIds: commitBuild.commit.events.map(event => event.eventId),
      aggregateWrites: commitBuild.commit.aggregateWrites.map(write => ({
        aggregateType: write.aggregateType,
        aggregateId: write.aggregateId,
        previousRevision: write.expectedAggregateRevision,
        aggregateRevision: (write.expectedAggregateRevision ?? -1) + 1
      })),
      outboxTaskIds: [],
      committedAt: "2026-07-22T12:00:00.000Z"
    };
    const committedAggregates = commitBuild.commit.aggregateWrites.map(write => ({
      schemaVersion: 1 as const,
      campaignId,
      aggregateType: write.aggregateType,
      aggregateId: write.aggregateId,
      aggregateRevision: (write.expectedAggregateRevision ?? -1) + 1,
      payloadSchemaVersion: write.payloadSchemaVersion,
      payload: write.payload,
      updatedByCommitId: commitId
    }));
    const sceneResult = buildDynamicPlaceSceneAfterCommitV1({
      commit: committed,
      placeRef: "location:passage_des_copistes",
      placeRegistryAggregate: committedAggregates.find(aggregate => aggregate.aggregateType === "world.place-registry")!,
      topologyAggregate: committedAggregates.find(aggregate => aggregate.aggregateType === "world.scene-topology")!,
      factRegistryAggregate: committedAggregates.find(aggregate => aggregate.aggregateType === "campaign.place-facts")!
    });
    assert.equal(sceneResult.ok, true, sceneResult.ok ? undefined : sceneResult.issues.join(" | "));
    if (sceneResult.ok) {
      assert.equal(sceneResult.scene.sceneId, "dynamic-place:passage_des_copistes");
      assert.equal(sceneResult.scene.presentNpc.length, 0, "population roles must not materialize NPCs automatically");
      assert.ok(sceneResult.scene.pointsOfInterest.some(point => point.destinationAliases.some(alias => alias.includes("Archives de lysenthe"))));
    }
    const unconfirmedScene = buildDynamicPlaceSceneAfterCommitV1({
      commit: committed,
      placeRef: "location:passage_des_copistes",
      placeRegistryAggregate: { ...committedAggregates.find(aggregate => aggregate.aggregateType === "world.place-registry")!, updatedByCommitId: null },
      topologyAggregate: committedAggregates.find(aggregate => aggregate.aggregateType === "world.scene-topology")!,
      factRegistryAggregate: committedAggregates.find(aggregate => aggregate.aggregateType === "campaign.place-facts")!
    });
    assert.equal(unconfirmedScene.ok, false);
    const staleCommit = buildPlaceCreationCommitV1({
      command: preparedCommand.command,
      campaignId,
      operationId,
      commitId,
      expectedCampaignRevision: 7,
      requestFingerprint: `sha256:${"1".repeat(64)}`,
      writerLease: commitBuild.commit.writerLease,
      acceptedAtGameSecond: 120,
      placeRegistryAggregate: { ...placeRegistry, aggregateRevision: 3 },
      topologyAggregate,
      factRegistryAggregate: factRegistry
    });
    assert.equal(staleCommit.ok, false);
  }
  const duplicateProposal = {
    ...proposalResult.proposal,
    proposedProperties: { ...proposalResult.proposal.proposedProperties, displayName: "Grande Place", proposedPlaceRef: "location:autre_place" }
  };
  const duplicate = validatePlaceCreationProposalV1({ proposal: duplicateProposal, topology, policy: placePolicy });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.code, "PLACE_DUPLICATE_REJECTED");
  const ephemeral = validatePlaceCreationProposalV1({
    proposal: { ...proposalResult.proposal, requestedDepth: "SCENE_EPHEMERAL" },
    topology,
    policy: { ...placePolicy, allowedPersistenceDepths: ["SCENE_EPHEMERAL", "LIGHT_REFERENCE"] }
  });
  assert.equal(ephemeral.ok, false);
  if (!ephemeral.ok) assert.equal(ephemeral.code, "PLACE_PERSISTENCE_REJECTED");

  const invalidProjection = buildLoreGuidedSceneCreationBriefV1({
    briefId: "invalid",
    packet: selected.packet,
    campaignProjections: [projection({ fieldPath: "/unknown" })]
  });
  assert.equal(invalidProjection.ok, false);
  if (!invalidProjection.ok) assert.equal(invalidProjection.code, "CAMPAIGN_PROJECTION_INVALID");
  const invalidCandidate = buildDynamicPlaceCreationProposalV1({
    brief: briefResult.brief,
    candidate: { ...candidate, displayName: "", narrativeCommitments: [] }
  });
  assert.equal(invalidCandidate.ok, false);
  if (!invalidCandidate.ok) assert.equal(invalidCandidate.code, "PLACE_CANDIDATE_INVALID");
  console.log("lore-guided-scene-creation-brief/1: projections, PLACE gate, atomic commit and post-commit playable scene OK");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
