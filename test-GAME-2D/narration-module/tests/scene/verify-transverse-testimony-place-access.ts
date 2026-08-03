import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type CommitId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RepositoryClock,
  type RequestId,
  type Result,
  type WriterId
} from "../../src/core";
import type { DynamicCreationProposalV1 } from "../../src/ai";
import {
  ACCESS_CONTROL_CONTRACT_V1,
  ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1,
  DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1,
  KNOWLEDGE_CLAIM_CONTRACT_V1,
  KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1,
  OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1,
  RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1,
  RECORD_OBJECTIVE_CLAIM_RESOLUTION_COMMAND_V1,
  TESTIMONY_RECORD_CONTRACT_V1,
  UPSERT_ACCESS_CONTROL_COMMAND_V1,
  augmentPlaceCreationCommitWithAccessControlV1,
  buildDynamicPlaceSceneAfterCommitV1,
  buildSceneCreatorEpistemicContextV1,
  decideSceneTransitionV1,
  ensureDynamicPlaceCreationStateV1,
  loadAccessControlRegistryV1,
  loadActorKnowledgeRegistryV1,
  loadClaimResolutionRegistryV1,
  loadTestimonyRegistryV1,
  preparePlaceCreationCommandV1,
  projectActorKnowledgeV1,
  recordAttributedTestimonyV1,
  recordObjectiveClaimResolutionV1,
  routeAccessApproachV1,
  upsertAccessControlV1,
  validatePlaceCreationProposalV1,
  buildPlaceCreationCommitV1,
  type AccessControlOwnerAuthorizationV1,
  type AccessControlOwnerPortV1,
  type AccessControlRecordV1,
  type ActorClaimPerspectiveV1,
  type KnowledgeClaimV1,
  type LoreGuidedSceneCreationBriefV1,
  type ObjectiveClaimResolutionOwnerPortV1,
  type RecordAttributedTestimonyCommandV1,
  type RecordObjectiveClaimResolutionCommandV1,
  type SceneTransitionRequestV1,
  type SceneTransitionTopologyV1,
  type TestimonyRecordV1,
  type UpsertAccessControlCommandV1
} from "../../src/application";

class FixedClock implements RepositoryClock {
  now(): Date { return new Date("2026-08-03T16:00:00.000Z"); }
}

const clock = new FixedClock();
const repository = new MemoryCampaignRepository({ clock });
const campaignId = opaqueId<CampaignId>("cmp-transverse-cour-copistes");
const playerRef = "actor:aryn";
const sourceSceneId = "scene:archives-main-hall";
const sourceBoundaryRef = "poi:cour-des-copistes";

async function main(): Promise<void> {
  await createCampaign();
  const initialTopology: SceneTransitionTopologyV1 = {
    schemaVersion: 1,
    contractVersion: "scene-transition/1",
    topologyId: "topology:archives-transverse",
    topologyVersion: 1,
    connections: []
  };
  await ensureDynamicPlaceCreationStateV1({ repository, campaignId, clock, topology: initialTopology });

  await recordWitness("dialogue-archiviste", "actor:npc-archiviste", noiseClaim(), "BELIEVED", "QUALIFIED_BELIEF");
  await recordWitness("dialogue-clerc", "actor:npc-clerc", gridClaim(), "KNOWN", "ASSERTION");
  await recordWitness("dialogue-garde", "actor:npc-garde", noGridClaim(), "BELIEVED", "ASSERTION");

  const beforeCreation = expectOk(await loadTestimonyRegistryV1(repository, campaignId));
  assert.equal(beforeCreation.state.testimonies.length, 3);
  assert.equal(beforeCreation.state.testimonies.every(testimony => testimony.assertsObjectiveTruth === false), true);
  const heardBeforeCreation = expectOk(await loadActorKnowledgeRegistryV1(repository, campaignId, playerRef));
  assert.equal(heardBeforeCreation.state.acquisitions.filter(item => item.status === "HEARD").length, 3);

  const epistemic = await buildSceneCreatorEpistemicContextV1({
    repository,
    campaignId,
    brief: creationBrief(),
    audienceActorRef: playerRef
  });
  assert.equal(epistemic.attributedTestimonies.length, 3);
  assert.equal(epistemic.attributedTestimonies.every(testimony => testimony.assertsObjectiveTruth === false), true);
  assert.equal(epistemic.authoritativeTruths.some(item => item.text.includes("peut accueillir")), true);
  assert.equal(epistemic.authoritativeTruths.some(item => item.text.includes("bruit")), false, "les témoignages ne deviennent pas du canon par projection");

  const creation = await materializeControlledPlace(initialTopology);
  assert.equal(creation.commit.aggregateWrites.some(write => write.aggregateType === "world.position"), false);
  assert.equal(creation.commit.aggregateWrites.some(write => write.aggregateType === "scene.lifecycle"), false);
  assert.equal(creation.commit.aggregateWrites.some(write => write.aggregateType === "world.clock"), false);

  const [topologyAggregate, accessAfterCreation, placeAggregate, factAggregate] = await Promise.all([
    repository.getAggregate(campaignId, "world.scene-topology", DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1),
    loadAccessControlRegistryV1(repository, campaignId),
    repository.getAggregate(campaignId, "world.place-registry", DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1),
    repository.getAggregate(campaignId, "campaign.place-facts", DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1)
  ]);
  assert.ok(topologyAggregate.ok && accessAfterCreation.ok && placeAggregate.ok && factAggregate.ok);
  if (!topologyAggregate.ok || !accessAfterCreation.ok || !placeAggregate.ok || !factAggregate.ok) throw new Error("materialized aggregates missing");
  assert.equal(accessAfterCreation.value.aggregate?.updatedByCommitId, creation.commitRecord.commitId);
  assert.equal(placeAggregate.value.updatedByCommitId, creation.commitRecord.commitId);
  const reconstructed = buildDynamicPlaceSceneAfterCommitV1({
    commit: creation.commitRecord,
    placeRef: "location:cour-des-copistes",
    placeRegistryAggregate: placeAggregate.value,
    topologyAggregate: topologyAggregate.value,
    factRegistryAggregate: factAggregate.value
  });
  assert.equal(reconstructed.ok, true, reconstructed.ok ? undefined : reconstructed.issues.join(" | "));

  const topology = (topologyAggregate.value.payload as { topology: SceneTransitionTopologyV1 }).topology;
  const request = transitionRequest();
  const threshold = decideSceneTransitionV1({
    request,
    topology,
    currentSceneVersion: 1,
    accessControls: accessAfterCreation.value.state.controls
  });
  assert.equal(threshold.disposition, "HANDOFF");
  assert.equal(threshold.access?.code, "ACCESS_CONTROLLED");
  assert.equal(JSON.stringify(threshold).includes("mandat interne"), false, "la condition privée reste hors de la perception du joueur");

  const control = accessAfterCreation.value.state.controls[0]!;
  assert.equal(routeAccessApproachV1({ control, requestedDomain: null, actionHint: "Je parle au garde et lui expose ma mission." }).domain, "social");
  assert.equal(routeAccessApproachV1({ control, requestedDomain: null, actionHint: "Je tente de forcer la grille." }).domain, "rules");

  await seedCompletedOperation("access-owner-open", "access.owner-resolution");
  const opened = openControl(control);
  const openCommand: UpsertAccessControlCommandV1 = {
    schemaVersion: 1,
    contractVersion: UPSERT_ACCESS_CONTROL_COMMAND_V1,
    clientRequestId: "open-cour-copistes-after-free-approach",
    sourceOperationId: "access-owner-open",
    occurredAtGameSecond: 0,
    control: opened
  };
  expectOk(await upsertAccessControlV1({ repository, campaignId, command: openCommand, ownerPort: accessOwnerPort(openCommand) }));
  const accessAfterApproach = expectOk(await loadAccessControlRegistryV1(repository, campaignId));
  const ready = decideSceneTransitionV1({ request, topology, currentSceneVersion: 1, accessControls: accessAfterApproach.state.controls });
  assert.equal(ready.code, "READY_FOR_LOCAL_COMMIT");

  await resolveClaim("discovery-noise", noiseClaim(), "CONFIRMED", "world-fact:collector-recent-traces");
  await resolveClaim("discovery-grid", gridClaim(), "CONFIRMED", "world-fact:cour-grid-observed");
  await resolveClaim("discovery-no-grid-refuted", noGridClaim(), "REFUTED", "world-fact:cour-grid-observed");

  // Reprise : toutes les projections sont reconstruites depuis les agrégats,
  // sans conserver un objet de contexte ou une décision transitoire en mémoire.
  const [reloadedTestimonies, reloadedKnowledge, reloadedResolutions, reloadedAccess] = await Promise.all([
    loadTestimonyRegistryV1(repository, campaignId),
    loadActorKnowledgeRegistryV1(repository, campaignId, playerRef),
    loadClaimResolutionRegistryV1(repository, campaignId),
    loadAccessControlRegistryV1(repository, campaignId)
  ]);
  assert.ok(reloadedTestimonies.ok && reloadedKnowledge.ok && reloadedResolutions.ok && reloadedAccess.ok);
  if (!reloadedTestimonies.ok || !reloadedKnowledge.ok || !reloadedResolutions.ok || !reloadedAccess.ok) throw new Error("resume projection failed");
  assert.equal(reloadedTestimonies.value.state.testimonies.length, 3, "les paroles historiques restent intactes");
  assert.equal(reloadedResolutions.value.state.resolutions.length, 3);
  assert.equal(reloadedAccess.value.state.controls[0]?.state, "OPEN");
  const projection = projectActorKnowledgeV1({
    testimonyRegistry: reloadedTestimonies.value.state,
    actorKnowledge: reloadedKnowledge.value.state
  });
  assert.equal(projection.items.find(item => item.claimRef === noiseClaim().claimRef)?.status, "CONFIRMED");
  assert.equal(projection.items.find(item => item.claimRef === gridClaim().claimRef)?.status, "CONFIRMED");
  assert.equal(projection.items.find(item => item.claimRef === noGridClaim().claimRef)?.status, "REFUTED");

  console.log("transverse testimony/place/access: 3 witnesses, atomic controlled materialization, free approach, truth resolution and resume verified.");
}

async function materializeControlledPlace(topology: SceneTransitionTopologyV1) {
  const operation = await beginReadyOperation("materialize-cour-copistes", "world.place.materialize-controlled", {
    requestedPlace: "Cour des Copistes",
    testimonyRefs: ["testimony:dialogue-archiviste", "testimony:dialogue-clerc", "testimony:dialogue-garde"]
  });
  const [placeRegistryAggregate, topologyAggregate, factRegistryAggregate] = await Promise.all([
    repository.getAggregate(campaignId, "world.place-registry", DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1),
    repository.getAggregate(campaignId, "world.scene-topology", DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1),
    repository.getAggregate(campaignId, "campaign.place-facts", DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1)
  ]);
  assert.ok(placeRegistryAggregate.ok && topologyAggregate.ok && factRegistryAggregate.ok);
  if (!placeRegistryAggregate.ok || !topologyAggregate.ok || !factRegistryAggregate.ok) throw new Error("place registries missing");
  const validation = validatePlaceCreationProposalV1({
    proposal: placeProposal(),
    topology,
    policy: {
      schemaVersion: 1,
      contractVersion: "place-creation-validation/1",
      allowedPersistenceDepths: ["LIGHT_REFERENCE", "FULL_ENTITY"],
      allowedParentLocationRefs: ["location:quartier-des-archives"],
      knownSourceSceneIds: [sourceSceneId],
      knownPlaces: [],
      maximumConnections: 3,
      version: 1
    }
  });
  if (!validation.ok) throw new Error(validation.issues.join(" | "));
  const command = preparePlaceCreationCommandV1({
    campaignId,
    operationId: operation.operationId,
    commandId: `${operation.operationId}:command:create-place`,
    idempotencyKey: operation.idempotencyKey,
    validation,
    placeRegistryAggregate: placeRegistryAggregate.value,
    topologyAggregate: topologyAggregate.value,
    factRegistryAggregate: factRegistryAggregate.value
  });
  if (!command.ok) throw new Error(command.issues.join(" | "));
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const lease = expectOk(await repository.acquireWriterLease(campaignId, opaqueId<WriterId>(`${operation.operationId}:writer`), 120_000));
  try {
    const base = buildPlaceCreationCommitV1({
      command: command.command,
      campaignId,
      operationId: operation.operationId,
      commitId: opaqueId<CommitId>(`${operation.operationId}:commit`),
      expectedCampaignRevision: campaign.campaignRevision,
      requestFingerprint: operation.requestFingerprint,
      writerLease: lease,
      acceptedAtGameSecond: 0,
      placeRegistryAggregate: placeRegistryAggregate.value,
      topologyAggregate: topologyAggregate.value,
      factRegistryAggregate: factRegistryAggregate.value
    });
    if (!base.ok) throw new Error(base.issues.join(" | "));
    const accessRegistry = expectOk(await loadAccessControlRegistryV1(repository, campaignId));
    const control = initialControl(validation.topologyAdditions[0]!.connectionId);
    const authorization: AccessControlOwnerAuthorizationV1 = {
      schemaVersion: 1,
      authority: "ACCESS_OWNER_DOMAIN",
      sourceOperationId: operation.operationId,
      accessControlRef: control.accessControlRef,
      connectionId: control.connectionId,
      ownerDomain: control.ownerDomain,
      permittedState: control.state,
      sourceRefs: [...control.sourceRefs]
    };
    const forged = augmentPlaceCreationCommitWithAccessControlV1({
      placeCommit: base.commit,
      placeCommand: command.command,
      accessControl: control,
      accessRegistryAggregate: accessRegistry.aggregate,
      accessRegistryState: accessRegistry.state,
      authorization: { ...authorization, permittedState: "OPEN" },
      occurredAtGameSecond: 0
    });
    assert.equal(forged.ok, false, "une autorisation propriétaire altérée doit être rejetée avant le commit");
    const composite = augmentPlaceCreationCommitWithAccessControlV1({
      placeCommit: base.commit,
      placeCommand: command.command,
      accessControl: control,
      accessRegistryAggregate: accessRegistry.aggregate,
      accessRegistryState: accessRegistry.state,
      authorization,
      occurredAtGameSecond: 0
    });
    if (!composite.ok) throw new Error(composite.issues.join(" | "));
    const committed = expectOk(await repository.commit(composite.commit));
    expectOk(await repository.completePresentation(operation.operationId, "COMMITTED_RENDERED", 1, { materialized: true, traversed: false }));
    return { commit: composite.commit, commitRecord: committed };
  } finally {
    expectOk(await repository.releaseWriterLease(lease));
  }
}

function placeProposal(): DynamicCreationProposalV1 {
  return {
    schemaVersion: 1,
    proposalId: "proposal:cour-des-copistes",
    proposalType: "PLACE",
    requestedDepth: "FULL_ENTITY",
    reason: "Matérialiser une cour locale plausible sans transformer les témoignages en preuves.",
    anchors: [{ kind: "LOCATION", id: "archives", required: true }],
    proposedProperties: {
      displayName: "Cour des Copistes",
      proposedPlaceRef: "location:cour-des-copistes",
      arrivalSceneId: "scene:cour-des-copistes",
      parentLocationRef: "location:quartier-des-archives",
      summary: "Une cour administrative bordée de guichets de copie.",
      initialTension: "Un garde surveille une grille au fond de la cour.",
      perceptibleFeatures: ["Une grille gardée ferme un passage bas.", "Des copistes circulent entre les guichets."],
      populationRoles: ["copiste", "garde"],
      localNorms: ["Les accès de service sont contrôlés."],
      loreAnchorEntityId: "archives",
      loreGeographicChain: ["lysenthe", "quartier-des-archives"],
      connectionIntents: [{
        sourceSceneId,
        boundaryRef: sourceBoundaryRef,
        destinationRef: "location:cour-des-copistes",
        scale: "LOCAL",
        sourceRefs: ["lore:archives-cour-possible"]
      }, {
        sourceSceneId: "scene:cour-des-copistes",
        boundaryRef: "poi:retour-archives",
        destinationRef: "location:archives",
        scale: "LOCAL",
        sourceRefs: ["lore:archives-cour-possible"]
      }]
    },
    existingFactRefsUsed: ["lore:archives-cour-possible"],
    relationsToExisting: ["location:archives"],
    expectedEffects: ["controlled_threshold_materialized"],
    visibility: "SYSTEM_ONLY",
    narrativeCommitments: ["La cour existe.", "Une grille gardée est visible, sans confirmer encore ce qui se trouve derrière."],
    validatingDomains: ["WorldDomain", "SceneDomain", "CampaignFactDomain", "AccessDomain"],
    duplicatePolicy: "REJECT_IF_SIMILAR"
  };
}

function initialControl(connectionId: string): AccessControlRecordV1 {
  return {
    schemaVersion: 1,
    contractVersion: ACCESS_CONTROL_CONTRACT_V1,
    accessControlRef: "access-control:cour-des-copistes-grid",
    connectionId,
    sourceSceneId,
    boundaryRef: sourceBoundaryRef,
    destinationRef: "location:cour-des-copistes",
    state: "CONTROLLED",
    ownerDomain: "AccessDomain",
    thresholdDescription: "Un garde surveille la grille de la Cour des Copistes.",
    requirements: [{
      schemaVersion: 1,
      requirementRef: "access-requirement:guard-permission",
      kind: "SOCIAL_PERMISSION",
      description: "Le garde doit autoriser le passage.",
      status: "ACTIVE",
      visibility: "PUBLIC",
      ownerDomain: "social",
      sourceRefs: ["world-fact:cour-grid-guard"],
      version: 1
    }, {
      schemaVersion: 1,
      requirementRef: "access-requirement:internal-mandate",
      kind: "AUTHORIZATION",
      description: "Un mandat interne du Collegium satisfait le contrôle.",
      status: "ACTIVE",
      visibility: "SYSTEM_PRIVATE",
      ownerDomain: "inventory",
      sourceRefs: ["rule:collegium-internal-mandate"],
      version: 1
    }],
    approachDomains: ["social", "inventory", "perception"],
    approachesAreNonExhaustive: true,
    sourceRefs: ["world-fact:cour-grid-guard", "rule:collegium-internal-mandate"],
    version: 1
  };
}

function openControl(control: AccessControlRecordV1): AccessControlRecordV1 {
  return {
    ...control,
    state: "OPEN",
    requirements: control.requirements.map(requirement => ({ ...requirement, status: "SATISFIED" })),
    version: 2
  };
}

async function recordWitness(
  operationId: string,
  speakerActorRef: string,
  claim: KnowledgeClaimV1,
  stance: ActorClaimPerspectiveV1["stance"],
  publicDelivery: "ASSERTION" | "QUALIFIED_BELIEF" | "UNCERTAINTY"
): Promise<void> {
  await seedCompletedOperation(operationId, "narrative.render.projection");
  const perspectiveRef = `actor-perspective:${operationId}`;
  const testimony: TestimonyRecordV1 = {
    schemaVersion: 1,
    contractVersion: TESTIMONY_RECORD_CONTRACT_V1,
    testimonyRef: `testimony:${operationId}`,
    operationRef: `operation:${operationId}`,
    sceneRef: `scene:${sourceSceneId}`,
    speakerActorRef,
    audienceActorRefs: [playerRef],
    utteranceRef: `utterance:${operationId}`,
    claims: [{ claimRef: claim.claimRef, privatePerspectiveRef: perspectiveRef, publicDelivery }],
    sourceRefs: [`operation:${operationId}`, `render-projection:${operationId}`],
    authority: "ATTRIBUTED_SPEECH_ONLY",
    assertsObjectiveTruth: false,
    version: 1
  };
  const command: RecordAttributedTestimonyCommandV1 = {
    schemaVersion: 1,
    contractVersion: RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1,
    clientRequestId: `record-${operationId}`,
    sourceOperationId: operationId,
    occurredAtGameSecond: 0,
    claims: [claim],
    subjects: [{
      schemaVersion: 1,
      contractVersion: KNOWLEDGE_SUBJECT_DOSSIER_CONTRACT_V1,
      subject: claim.subject,
      identityStatus: "HYPOTHETICAL",
      aliases: ["Cour des Copistes"],
      sourceRefs: ["subject-dossier:cour-des-copistes"],
      assertsExistence: false,
      version: 1
    }],
    perspectives: [{
      schemaVersion: 1,
      contractVersion: ACTOR_CLAIM_PERSPECTIVE_CONTRACT_V1,
      perspectiveRef,
      actorRef: speakerActorRef,
      claimRef: claim.claimRef,
      stance,
      confidence: stance === "KNOWN" ? "HIGH" : "MEDIUM",
      supportRefs: [`render-projection:${operationId}`],
      mayBeFalse: stance !== "KNOWN",
      privateTruthRef: null,
      deceptionCauseRef: null,
      visibility: "PRIVATE_TO_ACTOR_DOMAIN",
      version: 1
    }],
    testimony
  };
  expectOk(await recordAttributedTestimonyV1({ repository, campaignId, command }));
}

async function resolveClaim(sourceOperationId: string, claim: KnowledgeClaimV1, resolution: "CONFIRMED" | "REFUTED", factRef: string): Promise<void> {
  await seedCompletedOperation(sourceOperationId, "world.discovery");
  const command: RecordObjectiveClaimResolutionCommandV1 = {
    schemaVersion: 1,
    contractVersion: RECORD_OBJECTIVE_CLAIM_RESOLUTION_COMMAND_V1,
    clientRequestId: `resolve-${claim.claimRef}-${resolution.toLowerCase()}`,
    sourceOperationId,
    occurredAtGameSecond: 0,
    resolution: {
      schemaVersion: 1,
      contractVersion: OBJECTIVE_CLAIM_RESOLUTION_CONTRACT_V1,
      resolutionRef: `claim-resolution:${claim.claimRef.replace(/^claim:/u, "")}:${resolution.toLowerCase()}`,
      claimRef: claim.claimRef,
      resolution,
      ownerDomain: "WorldDomain",
      factRefs: [factRef],
      visibility: "PLAYER_VISIBLE",
      version: 1
    },
    recipientActorRefs: [playerRef]
  };
  const ownerPort: ObjectiveClaimResolutionOwnerPortV1 = {
    async authorize() {
      return { ok: true, authorization: {
        schemaVersion: 1,
        authority: "CLAIM_OWNER_DOMAIN",
        sourceOperationId,
        ownerDomain: "WorldDomain",
        resolutionRef: command.resolution.resolutionRef,
        claimRef: claim.claimRef,
        resolution,
        factRefs: [factRef],
        visibility: "PLAYER_VISIBLE",
        permittedActorRefs: [playerRef]
      } };
    }
  };
  expectOk(await recordObjectiveClaimResolutionV1({ repository, campaignId, command, ownerPort }));
}

function noiseClaim(): KnowledgeClaimV1 { return claim("claim:cour-copistes:noise", "Du bruit a été entendu sous la Cour des Copistes."); }
function gridClaim(): KnowledgeClaimV1 { return claim("claim:cour-copistes:grid-exists", "Une grille existe au fond de la Cour des Copistes."); }
function noGridClaim(): KnowledgeClaimV1 { return claim("claim:cour-copistes:no-grid", "Il n'existe aucune grille dans la Cour des Copistes."); }
function claim(claimRef: string, proposition: string): KnowledgeClaimV1 {
  return {
    schemaVersion: 1,
    contractVersion: KNOWLEDGE_CLAIM_CONTRACT_V1,
    claimRef,
    subject: { schemaVersion: 1, subjectRef: "place-hypothesis:cour-des-copistes", subjectKind: "PLACE", publicLabel: "Cour des Copistes" },
    proposition,
    sourceRefs: ["subject-dossier:cour-des-copistes"],
    version: 1
  };
}

function transitionRequest(): SceneTransitionRequestV1 {
  return {
    schemaVersion: 1,
    contractVersion: "scene-transition/1",
    requestId: "transition:cour-des-copistes",
    operationId: "attempt-enter-cour",
    campaignId,
    actorRef: playerRef,
    sourceSceneId,
    sourceSceneVersion: 1,
    boundaryRef: sourceBoundaryRef,
    expectedDestinationRef: "location:cour-des-copistes",
    intentId: "intent:enter-cour",
    idempotencyKey: "attempt-enter-cour:key"
  };
}

function creationBrief(): LoreGuidedSceneCreationBriefV1 {
  const influence = {
    schemaVersion: 1 as const,
    sourceRef: "lore:archives-cour-possible",
    entityId: "archives",
    entityType: "batiment" as const,
    fragmentId: "fragment:archives-cour",
    fieldPath: "/localites",
    knowledgeLevel: "LOCAL" as const,
    degree: "STRICT_CANON" as const,
    dimension: "ENVIRONMENT" as const,
    reason: "Possibilité géographique locale.",
    text: "Le complexe des Archives peut accueillir des cours administratives secondaires.",
    initialText: "Le complexe des Archives peut accueillir des cours administratives secondaires.",
    effectiveText: "Le complexe des Archives peut accueillir des cours administratives secondaires.",
    authority: "LORE_INITIAL" as const,
    campaignProjectionId: null,
    effectiveSourceRefs: ["lore:archives-cour-possible"],
    version: 1 as const
  };
  return {
    schemaVersion: 1,
    contractVersion: "lore-guided-scene-creation-brief/1",
    briefId: "brief:cour-des-copistes-transverse",
    creationType: "PLACE",
    anchorEntityId: "archives",
    geographicChain: ["lysenthe", "quartier-des-archives"],
    strictConstraints: [influence],
    localGuidance: [],
    regionalGuidance: [],
    unresolvedDimensions: [],
    sourceRefs: ["lore:archives-cour-possible"],
    appliedCampaignProjectionIds: [],
    nonCommittable: true,
    version: 1
  };
}

function accessOwnerPort(command: UpsertAccessControlCommandV1): AccessControlOwnerPortV1 {
  return {
    async authorize() {
      return { ok: true, authorization: {
        schemaVersion: 1,
        authority: "ACCESS_OWNER_DOMAIN",
        sourceOperationId: command.sourceOperationId,
        accessControlRef: command.control.accessControlRef,
        connectionId: command.control.connectionId,
        ownerDomain: command.control.ownerDomain,
        permittedState: command.control.state,
        sourceRefs: [...command.control.sourceRefs]
      } };
    }
  };
}

async function createCampaign(): Promise<void> {
  const instant = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("agg-transverse-clock"),
    dependencies: { contentPackageId: "content.transverse", contentPackageVersion: 1, rulesetId: "rules.transverse", rulesetVersion: 1, calendarId: "calendar.transverse", calendarVersion: 1 },
    writeBlock: null,
    lastCommitId: null,
    createdAt: instant,
    updatedAt: instant
  };
  expectOk(await repository.createCampaign(campaign, { elapsedGameSeconds: 0, calendarId: "calendar.transverse", calendarVersion: 1 }));
}

async function seedCompletedOperation(operationId: string, kind: string): Promise<void> {
  const operation = await beginOperation(operationId, kind, { schemaVersion: 1, accepted: true });
  expectOk(await repository.completeWithoutCommit(operation.operationId, 1, { schemaVersion: 1, accepted: true }));
}

async function beginReadyOperation(operationId: string, kind: string, payload: JsonObject): Promise<OperationRecord> {
  const received = await beginOperation(operationId, kind, payload);
  const preparing = expectOk(await repository.transitionOperation(received.operationId, "RECEIVED", "PREPARING"));
  return expectOk(await repository.transitionOperation(preparing.operationId, "PREPARING", "READY_TO_COMMIT"));
}

async function beginOperation(operationId: string, kind: string, payload: JsonObject): Promise<OperationRecord> {
  const campaign = expectOk(await repository.getCampaign(campaignId));
  const now = clock.now().toISOString();
  return expectOk(await repository.receiveOperation({
    schemaVersion: 1,
    operationId: opaqueId<OperationId>(operationId),
    campaignId,
    clientRequestId: opaqueId<RequestId>(`${operationId}:request`),
    idempotencyKey: opaqueId<IdempotencyKey>(`${operationId}:key`),
    requestFingerprint: await computeRequestFingerprint(kind, 1, payload),
    operationKind: kind,
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
  }));
}

function expectOk<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.messageKey} ${JSON.stringify(result.error.details)}`);
  return result.value;
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
