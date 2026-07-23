import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateDynamicCreationProposalV1, type DynamicCreationValidationPolicyV1 } from "../../src/ai";
import {
  buildDynamicPlaceCreationProposalV1,
  buildLoreGuidedSceneCreationBriefV1,
  buildLoreGuidedSceneCreationBriefFromCampaignV1,
  buildSceneCreatorBriefViewV1,
  buildDynamicPlaceSceneAfterCommitV1,
  buildSceneReferentRegistryV1,
  buildSceneArrivalDisplayPacketV1,
  buildSceneActorPromotionV1,
  buildPlaceCreationCommitV1,
  executePlaceCreationRuntimeV1,
  ensureDynamicPlaceCreationStateV1,
  createLoreGuidedDynamicPlacePreparationPortV1,
  generateLoreGuidedPlaceCandidateV1,
  generateLoreGuidedPlaceCandidateV2,
  isUnmappedVisibleCreationBoundaryV1,
  preparePlaceCreationCommandV1,
  resolveSceneV1,
  resolveSceneReferentTextV1,
  resolveNpcSpeakerV1,
  appendSceneActorV1,
  applySceneActorRegistryV1,
  validatePlaceCreationProposalV1,
  type CampaignLoreProjectionV1
} from "../../src/application";
import type { SceneTransitionTopologyV1 } from "../../src/application";
import {
  opaqueId,
  computeRequestFingerprint,
  MemoryCampaignRepository,
  validateCommitRequest,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CommitId,
  type CommitRecord,
  type CommandId,
  type EventId,
  type IdempotencyKey,
  type OperationId,
  type RequestId,
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
  assert.ok(JSON.stringify(buildSceneCreatorBriefViewV1(briefResult.brief)).length < JSON.stringify(briefResult.brief).length);
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
  const generatorConfig = {
    provider: { async generate(request: import("../../src/ai").AiCallRequestV1) { return { schemaVersion: 1, contractVersion: request.contractVersion, outputId: "output-ai-place", callId: request.callId, attemptId: request.attemptId, packId: request.packId, snapshotId: request.snapshotId, role: request.role, status: "OK", payload: candidate, diagnostics: [], supersedesOutputId: null }; } },
    route: { schemaVersion: 1 as const, routeId: "test-scene-creator", role: "scene_creator" as const, providerKind: "FAKE_CONTRACT" as const, providerId: "test", modelId: "test", modelConfigVersion: "1", certified: true, allowedContractVersions: ["lore-guided-place-candidate/1"], inputTokenLimit: 4000, outputTokenLimit: 1500, timeoutMs: 1000, fallbackRouteIds: [] },
    retryPolicy: { schemaVersion: 1 as const, role: "scene_creator" as const, maxTechnicalRetries: 0, maxTargetedCorrections: 0, maxFullRegenerations: 0, allowFallback: false }
  };
  const generated = await generateLoreGuidedPlaceCandidateV1({
    campaignId: "campaign-1",
    operationId: "operation-ai-place-candidate",
    brief: briefResult.brief,
    sourceSceneId: "wiki-location:archives_de_lysenthe",
    sourceBoundaryRef: "poi:archives_de_lysenthe:poi:2",
    allowedParentLocationRefs: ["location:quartier_des_archives"],
    allowedPersistenceDepths: ["LIGHT_REFERENCE", "FULL_ENTITY"],
    requestedDestinationDescription: "une rue secondaire proche des Archives",
    config: generatorConfig
  });
  assert.equal(generated.ok, true, generated.ok ? undefined : generated.issues.join(" | "));
  if (generated.ok) assert.equal(generated.proposal.proposalType, "PLACE");
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
  const boundaryScene = {
    schemaVersion: 1 as const, contractVersion: "playable-scene-state/1" as const, sceneId: "wiki-location:archives_de_lysenthe", locationName: "Archives de Lysenthe",
    perceptibleSituation: ["Archives"], visibleElements: [{ schemaVersion: 1 as const, elementId: "building-description", label: "Bâtiment", description: "Le bâtiment des Archives.", keywords: ["bâtiment"], playerVisible: true as const, version: 1 as const }], presentNpc: [], ambientPopulation: [], perceptionClues: [], currentTension: "Calme", playerKnownFacts: [],
    pointsOfInterest: [
      { schemaVersion: 1 as const, pointId: "external-exit", label: "Place des Archives", visibleDescription: "Une sortie.", keywords: ["sortie"], destinationAliases: ["place des Archives"], version: 1 as const },
      { schemaVersion: 1 as const, pointId: "archive-function", label: "Classement", visibleDescription: "Une fonction du lieu.", keywords: ["classement"], destinationAliases: [], version: 1 as const }
    ],
    localMemoryPolicy: { schemaVersion: 1 as const, maxShortTermNpcMemory: 5, version: 1 as const },
    aiSceneWriterPolicy: { schemaVersion: 1 as const, mayCreate: [], mayReference: [], mustNotCreate: [], noveltyConstraints: [], version: 1 as const }, version: 1 as const
  };
  assert.equal(isUnmappedVisibleCreationBoundaryV1({ semanticKind: "traverse_visible_boundary", requiresClarification: false, targetRef: "poi:external-exit", activeScene: boundaryScene, topology }), true);
  assert.equal(isUnmappedVisibleCreationBoundaryV1({ semanticKind: "traverse_visible_boundary", requiresClarification: false, targetRef: "requested-destination:une-rue-calme-non-loin", activeScene: boundaryScene, topology }), true, "une destination proche explicitement demandée ouvre une création bornée sans faux référent acteur");
  assert.equal(isUnmappedVisibleCreationBoundaryV1({ semanticKind: "traverse_visible_boundary", requiresClarification: false, targetRef: null, activeScene: boundaryScene, topology }), true);
  assert.equal(isUnmappedVisibleCreationBoundaryV1({ semanticKind: "traverse_visible_boundary", requiresClarification: false, targetRef: "element:building-description", activeScene: boundaryScene, topology }), true);
  assert.equal(isUnmappedVisibleCreationBoundaryV1({ semanticKind: "traverse_visible_boundary", requiresClarification: false, targetRef: "poi:archive-function", activeScene: boundaryScene, topology }), false);
  assert.equal(isUnmappedVisibleCreationBoundaryV1({ semanticKind: "traverse_visible_boundary", requiresClarification: false, targetRef: "poi:external-exit", activeScene: boundaryScene, topology: { ...topology, connections: [{ schemaVersion: 1, connectionId: "known", sourceSceneId: boundaryScene.sceneId, boundaryRef: "poi:external-exit", destinationRef: "location:known", scale: "LOCAL", state: "OPEN", sourceRefs: ["lore:test"], version: 1 }] } }), false);
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
    const oneWayGeneratorConfig = {
      ...generatorConfig,
      route: { ...generatorConfig.route, modelConfigVersion: "2", allowedContractVersions: ["lore-guided-place-candidate/2"] },
      provider: {
        async generate(request: import("../../src/ai").AiCallRequestV1) {
          const { connectionIntents: _ignored, ...candidateV2 } = candidate;
          return { schemaVersion: 1 as const, contractVersion: request.contractVersion, outputId: "output-ai-place-v2", callId: request.callId, attemptId: request.attemptId, packId: request.packId, snapshotId: request.snapshotId, role: request.role, status: "OK" as const, payload: candidateV2, diagnostics: [], supersedesOutputId: null };
        }
      }
    };
    const generatedV2 = await generateLoreGuidedPlaceCandidateV2({
      campaignId: "campaign-1", operationId: "operation-ai-place-candidate-v2", brief: briefResult.brief,
      sourceSceneId: "wiki-location:archives_de_lysenthe", sourceBoundaryRef: "poi:archives_de_lysenthe:poi:2",
      allowedParentLocationRefs: ["location:quartier_des_archives"], allowedPersistenceDepths: ["LIGHT_REFERENCE", "FULL_ENTITY"],
      requestedDestinationDescription: "une rue secondaire proche des Archives", config: oneWayGeneratorConfig
    });
    assert.equal(generatedV2.ok, true, generatedV2.ok ? undefined : generatedV2.issues.join(" | "));
    if (generatedV2.ok) {
      assert.equal(Object.hasOwn(generatedV2.candidate, "connectionIntents"), false);
      assert.equal(generatedV2.telemetry[0]?.finishReason, "provider_metrics_missing");
    }
    const productionPreparation = createLoreGuidedDynamicPlacePreparationPortV1({
      contextPort: {
        canCreate: () => true,
        async buildContext() { return { ok: true, value: { brief: briefResult.brief, dynamicCreationPolicy: policy, placeValidationPolicy: placePolicy, topology, sourceSceneId: "wiki-location:archives_de_lysenthe", sourceLocationRef: "location:archives_de_lysenthe", sourceBoundaryRef: "poi:archives_de_lysenthe:poi:2", requestedDestinationDescription: "une rue secondaire proche des Archives", generatorConfig: oneWayGeneratorConfig } }; }
      },
      worldPort: { async prepare() { throw new Error("world preparation is tested by the atomic entry suite"); } }
    });
    const productionCreative = await productionPreparation.prepareCreative({ repository: {} as never, campaign: { campaignId: "campaign-1" } as never, operation: { operationId: "operation-production-preparation" } as never, rawInput: "Je sors vers une rue secondaire.", interpretation: {} as never, domainCommand: null, activeScene: {} as never });
    assert.equal(productionCreative.ok, true, productionCreative.ok ? undefined : productionCreative.error.messageKey);
    if (productionCreative.ok) {
      assert.equal(productionCreative.value.validation.ok, true);
      assert.equal(productionCreative.value.validation.topologyAdditions.length, 2, "V1 publishes only the authoritative entry and return connections");
      assert.equal(productionCreative.value.validation.topologyAdditions.some(connection => connection.sourceSceneId === candidate.arrivalSceneId && connection.destinationRef === "location:archives_de_lysenthe"), true);
      assert.equal(productionCreative.value.aiTelemetry[0]?.role, "scene_creator");
      assert.equal(productionCreative.value.aiTelemetry[0]?.finishReason, "provider_metrics_missing");
    }
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
      assert.equal(sceneResult.scene.presentNpc.length, 0, "aucun rôle de foule n'est pré-promu en PNJ individualisé");
      assert.deepEqual(
        sceneResult.scene.ambientPopulation.map(presence => presence.publicRole),
        ["clerc", "copiste", "garde"],
        "les rôles de population deviennent une foule locale ciblable sans créer d'entités durables"
      );
      assert.ok(sceneResult.scene.ambientPopulation.every(presence => presence.actorId.includes(":ambient:")));
      assert.ok(sceneResult.scene.ambientPopulation.every(presence =>
        presence.demeanor.length > 0 &&
        presence.visibleAppearance.length > 0 &&
        presence.immediateGoal.length > 0 &&
        presence.currentPressure.length > 0 &&
        presence.speechStyle.length > 0 &&
        presence.conversationalHooks.length > 0 &&
        presence.boundaries.length > 0
      ), "chaque présence ambiante reçoit une amorce de personnalité stable");
      const copiste = resolveSceneReferentTextV1(
        buildSceneReferentRegistryV1(sceneResult.scene),
        "je m'approche d'un copiste"
      );
      assert.equal(copiste.status, "RESOLVED", "un rôle ambiant annoncé doit être ciblable au tour suivant");
      if (copiste.status === "RESOLVED") assert.equal(copiste.referent.kind, "npc");
      const ambientSpeaker = resolveNpcSpeakerV1(
        `npc:${sceneResult.scene.ambientPopulation[0]!.actorId}`,
        sceneResult.scene
      );
      assert.equal(ambientSpeaker.displayName, "Clerc");
      assert.equal(ambientSpeaker.displayName === "Garde blessé", false);
      const ambientCopiste = sceneResult.scene.ambientPopulation[1]!;
      const promotion = buildSceneActorPromotionV1({
        scene: sceneResult.scene,
        registry: {
          schemaVersion: 1,
          contractVersion: "scene-actor-registry/1",
          sceneId: sceneResult.scene.sceneId,
          actors: [],
          version: 1
        },
        interpretation: {
          semanticIntent: {
            kind: "address_visible_actor",
            target: { ref: `npc:${ambientCopiste.actorId}` }
          }
        } as never,
        operationId: "operation-address-ambient-copiste"
      });
      assert.ok(promotion !== null, "la première parole ciblée doit préparer une promotion SCENE_ACTOR");
      if (promotion !== null) {
        const registry = appendSceneActorV1({
          schemaVersion: 1,
          contractVersion: "scene-actor-registry/1",
          sceneId: sceneResult.scene.sceneId,
          actors: [],
          version: 1
        }, promotion);
        const promotedScene = applySceneActorRegistryV1(sceneResult.scene, registry);
        assert.equal(promotedScene.ambientPopulation.some(actor => actor.actorId === ambientCopiste.actorId), false);
        assert.equal(promotedScene.presentNpc.some(actor => actor.actorId === ambientCopiste.actorId), true);
        const reconstructedScene = applySceneActorRegistryV1(sceneResult.scene, registry);
        const reconstructedCopiste = reconstructedScene.presentNpc.find(actor => actor.actorId === ambientCopiste.actorId);
        assert.equal(reconstructedCopiste?.displayName, ambientCopiste.displayName, "l'identité survit à une reconstruction sortie-retour");
        assert.equal((reconstructedCopiste as Record<string, unknown> | undefined)?.demeanor, ambientCopiste.demeanor, "l'allure stable survit à une reconstruction");
        assert.deepEqual((reconstructedCopiste as Record<string, unknown> | undefined)?.speechStyle, ambientCopiste.speechStyle, "la voix stable survit à une reconstruction");
      }
      const arrivalPacket = buildSceneArrivalDisplayPacketV1({
        operationId: "operation-arrival-ambient-population",
        rawInput: "je sors vers le passage",
        characterExpression: "Je gagne le passage.",
        durationSeconds: 8,
        arrival: {
          schemaVersion: 1,
          contractVersion: "scene-arrival/1",
          commitId: committed.commitId,
          transitionRequestId: "transition:ambient-population",
          destinationRef: "location:passage_des_copistes",
          previousSceneId: "wiki-location:archives_de_lysenthe",
          enteredAtGameSecond: 128,
          scene: sceneResult.scene,
          authoritySourceRefs: ["lore:test"],
          reconstructionRefs: [`commit:${committed.commitId}`],
          narrationStatus: "READY_AFTER_COMMIT",
          version: 1
        }
      });
      const arrivalNarration = arrivalPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text ?? "";
      assert.ok(/Le lieu est habité/u.test(arrivalNarration));
      assert.equal(arrivalNarration.includes("Présences visibles :"), false, "le fallback d'arrivée ne récite pas un inventaire de PNJ");
      assert.ok(sceneResult.scene.pointsOfInterest.some(point => point.destinationAliases.some(alias => alias.includes("Archives de lysenthe"))));
      assert.ok(sceneResult.scene.pointsOfInterest.some(point => point.label.startsWith("Retour vers ")));
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

    const repository = new MemoryCampaignRepository();
    const runtimeCampaignId = opaqueId<CampaignId>("campaign-place-runtime");
    const runtimeCampaign = {
      schemaVersion: 1 as const,
      campaignId: runtimeCampaignId,
      campaignRevision: 0,
      status: "ACTIVE" as const,
      clockAggregateId: opaqueId<AggregateId>("agg-clock-place-runtime"),
      dependencies: { contentPackageId: "lore.test", contentPackageVersion: 1, rulesetId: "rules.test", rulesetVersion: 1, calendarId: "calendar.test", calendarVersion: 1 },
      writeBlock: null,
      lastCommitId: null,
      createdAt: "2026-07-22T12:00:00.000Z",
      updatedAt: "2026-07-22T12:00:00.000Z"
    };
    assert.equal((await repository.createCampaign(runtimeCampaign, { elapsedGameSeconds: 0, calendarId: "calendar.test", calendarVersion: 1 })).ok, true);
    const seedPayload = { purpose: "initialize-place-creation-aggregates" };
    const seedOperationId = opaqueId<OperationId>("operation-place-runtime-seed");
    const seedIdempotency = opaqueId<IdempotencyKey>("idem-place-runtime-seed");
    const seedFingerprint = await computeRequestFingerprint("world.place-registry.initialize", 1, seedPayload);
    const seedOperation = {
      schemaVersion: 1 as const, operationId: seedOperationId, campaignId: runtimeCampaignId,
      clientRequestId: opaqueId<RequestId>("request-place-runtime-seed"), idempotencyKey: seedIdempotency,
      requestFingerprint: seedFingerprint, operationKind: "world.place-registry.initialize", requestPayloadSchemaVersion: 1,
      requestPayload: seedPayload, phase: "RECEIVED" as const, observedCampaignRevision: 0, commitId: null,
      completionMode: null, resultPayloadSchemaVersion: null, resultPayload: null, failure: null,
      receivedAt: "2026-07-22T12:00:00.000Z", updatedAt: "2026-07-22T12:00:00.000Z"
    };
    assert.equal((await repository.receiveOperation(seedOperation)).ok, true);
    assert.equal((await repository.transitionOperation(seedOperationId, "RECEIVED", "PREPARING")).ok, true);
    assert.equal((await repository.transitionOperation(seedOperationId, "PREPARING", "READY_TO_COMMIT")).ok, true);
    const seedLease = await repository.acquireWriterLease(runtimeCampaignId, opaqueId<WriterId>("writer-place-runtime-seed"), 120_000);
    assert.equal(seedLease.ok, true);
    if (!seedLease.ok) return;
    const runtimePlaceId = opaqueId<AggregateId>("agg-place-registry-runtime");
    const runtimeTopologyId = opaqueId<AggregateId>("agg-scene-topology-runtime");
    const runtimeFactsId = opaqueId<AggregateId>("agg-place-facts-runtime");
    const seedCommandId = opaqueId<CommandId>("command-place-runtime-seed");
    const seedCommit = await repository.commit({
      campaignId: runtimeCampaignId, operationId: seedOperationId, commitId: opaqueId<CommitId>("commit-place-runtime-seed"),
      idempotencyKey: seedIdempotency, requestFingerprint: seedFingerprint, expectedCampaignRevision: 0, writerLease: seedLease.value,
      acceptedCommands: [{ schemaVersion: 1, contractId: "place-registry-bootstrap", contractVersion: 1, commandId: seedCommandId,
        campaignId: runtimeCampaignId, operationId: seedOperationId, commandType: "place.registry.initialize",
        target: { aggregateType: "world.place-registry", aggregateId: runtimePlaceId, expectedAggregateRevision: null },
        payloadSchemaVersion: 1, payload: seedPayload, acceptedAtGameSecond: 0 }],
      aggregateWrites: [
        { aggregateType: "world.place-registry", aggregateId: runtimePlaceId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "world-place-registry/1", places: [], version: 1 } },
        { aggregateType: "world.scene-topology", aggregateId: runtimeTopologyId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "world-scene-topology/1", topology, version: 1 } },
        { aggregateType: "campaign.place-facts", aggregateId: runtimeFactsId, expectedAggregateRevision: null, payloadSchemaVersion: 1, payload: { schemaVersion: 1, contractVersion: "campaign-place-facts/1", facts: [], version: 1 } }
      ],
      events: [{ schemaVersion: 1, eventId: opaqueId<EventId>("event-place-runtime-seed"), campaignId: runtimeCampaignId,
        operationId: seedOperationId, eventType: "world.place-registry.initialized", origin: "SYSTEM", causation: { kind: "COMMAND", id: seedCommandId },
        aggregateRefs: [
          { aggregateType: "world.place-registry", aggregateId: runtimePlaceId, aggregateRevision: 0 },
          { aggregateType: "world.scene-topology", aggregateId: runtimeTopologyId, aggregateRevision: 0 },
          { aggregateType: "campaign.place-facts", aggregateId: runtimeFactsId, aggregateRevision: 0 }
        ], visibility: { scope: "SYSTEM", actorIds: [] }, occurredAtGameSecond: 0, payloadSchemaVersion: 1, payload: seedPayload }],
      outboxTasks: []
    });
    assert.equal(seedCommit.ok, true);
    assert.equal((await repository.releaseWriterLease(seedLease.value)).ok, true);
    assert.equal((await repository.completePresentation(seedOperationId, "COMMITTED_RENDERED", 1, { initialized: true })).ok, true);

    const runtimePayload = { proposalId: proposalResult.proposal.proposalId };
    const runtimeOperationId = opaqueId<OperationId>("operation-place-runtime-create");
    const runtimeFingerprint = await computeRequestFingerprint("narrative.place.create", 1, runtimePayload);
    const runtimeOperation = {
      ...seedOperation,
      operationId: runtimeOperationId,
      clientRequestId: opaqueId<RequestId>("request-place-runtime-create"),
      idempotencyKey: opaqueId<IdempotencyKey>("idem-place-runtime-create"),
      requestFingerprint: runtimeFingerprint,
      operationKind: "narrative.place.create",
      requestPayload: runtimePayload,
      observedCampaignRevision: 1
    };
    assert.equal((await repository.receiveOperation(runtimeOperation)).ok, true);
    const runtimeResult = await executePlaceCreationRuntimeV1({
      repository, campaignId: runtimeCampaignId, operation: runtimeOperation, validation: placeValidation,
      placeRegistryAggregateId: runtimePlaceId, topologyAggregateId: runtimeTopologyId, factRegistryAggregateId: runtimeFactsId,
      commandId: "command-place-runtime-create", commitId: opaqueId<CommitId>("commit-place-runtime-create"), acceptedAtGameSecond: 0
    });
    assert.equal(runtimeResult.ok, true, runtimeResult.ok ? undefined : runtimeResult.error.messageKey);
    if (!runtimeResult.ok) return;
    assert.equal(runtimeResult.value.scene.sceneId, "dynamic-place:passage_des_copistes");
    const catalogResult = await resolveSceneV1({
      sceneId: runtimeResult.value.scene.sceneId,
      sources: [{ sourceKind: "PREPARED", resolve: () => null }],
      dynamicCatalog: { repository, campaignId: runtimeCampaignId, placeRegistryAggregateId: runtimePlaceId, topologyAggregateId: runtimeTopologyId, factRegistryAggregateId: runtimeFactsId }
    });
    assert.equal(catalogResult.ok, true);
    if (catalogResult.ok) assert.equal(catalogResult.value.sourceKind, "DYNAMIC_CAMPAIGN");
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
  const collidingArrival = validatePlaceCreationProposalV1({
    proposal: { ...proposalResult.proposal, proposedProperties: { ...proposalResult.proposal.proposedProperties, arrivalSceneId: "wiki-location:archives_de_lysenthe" } },
    topology,
    policy: placePolicy
  });
  assert.equal(collidingArrival.ok, false);
  if (!collidingArrival.ok) assert.equal(collidingArrival.issues.includes("Arrival scene already exists: wiki-location:archives_de_lysenthe."), true);

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
  for (const [index, failurePoint] of ["AFTER_AGGREGATES", "AFTER_COMMANDS", "AFTER_EVENTS", "AFTER_OUTBOX", "BEFORE_PUBLISH"].entries()) {
    let injectFailure = true;
    const bootstrapRepository = new MemoryCampaignRepository({
      clock: { now: () => new Date("2026-07-22T12:00:00.000Z") },
      failureInjector(point) {
        if (injectFailure && point === failurePoint) throw new Error(`Injected at ${point}`);
      }
    });
    const campaignId = opaqueId<CampaignId>(`campaign-dynamic-bootstrap-failure-${index}`);
    const created = await bootstrapRepository.createCampaign({
      schemaVersion: 1,
      campaignId,
      campaignRevision: 0,
      status: "ACTIVE",
      clockAggregateId: opaqueId<AggregateId>(`agg-clock-dynamic-bootstrap-failure-${index}`),
      dependencies: { contentPackageId: "lore.test", contentPackageVersion: 1, rulesetId: "rules.test", rulesetVersion: 1, calendarId: "calendar.test", calendarVersion: 1 },
      writeBlock: null,
      lastCommitId: null,
      createdAt: "2026-07-22T12:00:00.000Z",
      updatedAt: "2026-07-22T12:00:00.000Z"
    }, { elapsedGameSeconds: 0, calendarId: "calendar.test", calendarVersion: 1 });
    assert.equal(created.ok, true);
    let bootstrapRejected = false;
    try {
      await ensureDynamicPlaceCreationStateV1({
        repository: bootstrapRepository,
        campaignId,
        clock: { now: () => new Date("2026-07-22T12:00:00.000Z") },
        topology
      });
    } catch {
      bootstrapRejected = true;
    }
    assert.equal(bootstrapRejected, true, `${failurePoint} must reject the interrupted bootstrap`);
    for (const [aggregateType, aggregateId] of [
      ["world.place-registry", "agg-dynamic-place-registry"],
      ["world.scene-topology", "agg-dynamic-place-topology"],
      ["campaign.place-facts", "agg-dynamic-place-facts"]
    ] as const) {
      const absent = await bootstrapRepository.getAggregate(campaignId, aggregateType, aggregateId);
      assert.equal(absent.ok, false, `${failurePoint} must not publish ${aggregateType}`);
    }
    injectFailure = false;
    await ensureDynamicPlaceCreationStateV1({
      repository: bootstrapRepository,
      campaignId,
      clock: { now: () => new Date("2026-07-22T12:00:00.000Z") },
      topology
    });
    const operation = await bootstrapRepository.getOperation(opaqueId<OperationId>("dynamic-place-bootstrap"));
    assert.equal(operation.ok, true);
    if (operation.ok) assert.equal(operation.value.phase, "COMPLETED");
  }
  console.log("lore-guided-scene-creation-brief/1: projections, PLACE gate, atomic commit and post-commit playable scene OK");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
