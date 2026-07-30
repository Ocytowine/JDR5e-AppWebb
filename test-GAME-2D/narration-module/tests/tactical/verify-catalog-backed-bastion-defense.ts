import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type CommandId,
  type CommitId,
  type EventId,
  type EventRecord,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type WriterId
} from "../../src/core";
import {
  BASTION_DEFENSE_ENCOUNTER_CATALOG_V1,
  BASTION_DEFENSE_ACTIVE_PLAYER_SLOT_V1,
  BASTION_DEFENSE_PLAYER_PROJECTION_V1,
  createBootstrappedBastionDefensePlayerResolverV1,
  createCatalogBackedBastionDefenseAuthorityV1,
  createCatalogBackedBastionResolutionPolicyV1,
  createCatalogBackedBastionTacticalRuntimeFactoryV1,
  loadContentPackageBastionDefenseEncounterCatalogV1,
  type BastionDefenseEncounterDefinitionV1,
  type BastionDefensePlayerProjectionV1,
  type BastionIncidentDefinitionV1,
  type BastionRecordV1
} from "../../src/application";
import {
  ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
  activeCampaignCharacterProfileAggregateIdV1,
  createActiveCampaignCharacterProfileV1,
  type ResolvedContentPackageV1
} from "../../src/bootstrap/orchestration";
import {
  GAME_BOARD_ACTOR_PROJECTION_V1,
  GAME_BOARD_MAP_PROJECTION_V1
} from "../../../src/tactical-integration/gameBoardEncounterAdapter";
import { sampleCharacter } from "../../../src/data/models/sampleCharacter";

const campaignId = opaqueId<CampaignId>("cmp_catalog_defense_8a");
const characterAggregateId =
  opaqueId<AggregateId>("agg_catalog_defense_character");
const tacticalAggregateId =
  opaqueId<AggregateId>("agg_catalog_defense_tactical");
const narrativeAggregateId =
  opaqueId<AggregateId>("agg_catalog_defense_narrative");
const positionAggregateId =
  opaqueId<AggregateId>("agg_catalog_defense_position");
const now = "2026-07-30T09:00:00.000Z";

async function main() {
  const repository = new MemoryCampaignRepository();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("agg_catalog_defense_clock"),
    dependencies: {
      contentPackageId: "content.test",
      contentPackageVersion: 1,
      rulesetId: "rules.test",
      rulesetVersion: 1,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  assert.equal((await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  })).ok, true);
  await commitCharacterOwners(repository, campaign);
  const currentCampaign = await repository.getCampaign(campaignId);
  assert.equal(currentCampaign.ok, true);
  if (!currentCampaign.ok) return;

  const definition = encounterDefinition();
  const loadedCatalog =
    loadContentPackageBastionDefenseEncounterCatalogV1({
      campaign: currentCampaign.value,
      content: contentPackage(definition),
      catalogId: "catalog:bastion-defense"
    });
  assert.equal(
    loadedCatalog.ok,
    true,
    loadedCatalog.ok ? undefined : loadedCatalog.error.messageKey
  );
  if (!loadedCatalog.ok) return;
  const catalog = loadedCatalog.value;
  assert.equal(
    await catalog.resolve(definition.incidentDefinitionRef) !== null,
    true
  );
  const wrongVersion = contentPackage(definition);
  wrongVersion.manifest.packageVersion = 2;
  const packageMismatch =
    loadContentPackageBastionDefenseEncounterCatalogV1({
      campaign: currentCampaign.value,
      content: wrongVersion,
      catalogId: "catalog:bastion-defense"
    });
  assert.equal(packageMismatch.ok, false);

  const player = playerProjection();
  const playerResolver =
    createBootstrappedBastionDefensePlayerResolverV1({
      repository,
      adapter: {
        adapterRef: "game-board-player:test-v1",
        project({ profile, tacticalProjection, teamId }) {
          const projection = structuredClone(player.gameBoardProjection);
          projection.actorId = profile.actorId;
          projection.teamId = teamId;
          (
            projection.character as { pvActuels: number }
          ).pvActuels = Number(tacticalProjection.currentHitPoints);
          return projection;
        }
      }
    });
  const resolvedPlayer = await playerResolver.resolve({
    campaignId,
    bastionId: "bastion:test",
    incidentDefinitionRef: definition.incidentDefinitionRef,
    teamId: definition.playerTeamId
  });
  assert.notEqual(resolvedPlayer, null);
  assert.equal(resolvedPlayer?.characterId, "character:aryn");
  assert.equal(resolvedPlayer?.teamId, "defenders");
  const runtime = createCatalogBackedBastionTacticalRuntimeFactoryV1({
    causeRoutingPolicy: {
      policyRef: "cause-routing:test-v1",
      evaluate() {
        return {
          schemaVersion: 1,
          sourceKind: "WORLD_SIMULATION",
          disposition: "IGNORE",
          reasonCode: "TEST_ONLY",
          bastionId: null
        };
      }
    },
    incidentCatalog: {
      catalogRef: "catalog:bastion-incidents:test-v1",
      resolve(ref) {
        return ref === definition.incidentDefinitionRef
          ? incidentDefinition()
          : null;
      }
    },
    incidentPolicy: {
      policyRef: "policy:bastion-incidents:test-v1",
      evaluate() {
        return {
          schemaVersion: 1,
          eligible: true,
          reasonCode: "CATALOGUED_WORLD_CAUSE",
          incidentDefinitionRef: definition.incidentDefinitionRef
        };
      }
    },
    encounterCatalog: catalog,
    playerResolver
  }).create({ repository, campaignId });
  assert.equal(runtime.consequenceAuthorities.length, 2);
  assert.equal(
    runtime.defenseAuthority.authorityRef.includes(catalog.catalogRef),
    true
  );
  const authority = createCatalogBackedBastionDefenseAuthorityV1({
    repository,
    campaignId,
    catalog,
    playerResolver
  });
  const sourceEvent = committedWorldEvent();
  const prepared = await authority.prepare({
    campaign: currentCampaign.value,
    bastion: bastion(),
    incident: incidentDefinition(),
    sourceEvent,
    startedAtGameSecond: 3_600
  });
  assert.equal(
    prepared.authorized,
    true,
    prepared.reasonCode
  );
  assert.notEqual(prepared.seed, null);
  if (prepared.seed === null) return;
  assert.equal(
    prepared.seed.participants[0]?.characterStateAggregateRef,
    characterAggregateId
  );
  assert.equal(
    prepared.seed.participants[0]?.tacticalProjectionAggregateRef,
    tacticalAggregateId
  );
  assert.equal(
    JSON.stringify(prepared.seed).includes("hiddenAttackPlan"),
    false,
    "private source payload must not leak into the tactical seed"
  );
  const replay = await authority.prepare({
    campaign: currentCampaign.value,
    bastion: bastion(),
    incident: incidentDefinition(),
    sourceEvent,
    startedAtGameSecond: 3_600
  });
  assert.equal(replay.seed?.seedFingerprint, prepared.seed.seedFingerprint);
  assert.equal(replay.seed?.processId, prepared.seed.processId);

  const resolutionPolicy =
    createCatalogBackedBastionResolutionPolicyV1(catalog);
  const defended = await resolutionPolicy.resolve({
    bastionId: "bastion:test",
    incidentId: "incident:test",
    incidentDefinitionRef: definition.incidentDefinitionRef,
    processId: prepared.seed.processId,
    endCondition: "all_hostiles_neutralized",
    outcomeId: "outcome:test"
  });
  assert.equal(defended.ok, true);
  if (!defended.ok) return;
  assert.equal(defended.value.resolutionCode, "BASTION_DEFENDED");
  assert.equal(defended.value.bastionStatus, "ACTIVE");
  const catalogMismatch = await resolutionPolicy.resolve({
    bastionId: "bastion:test",
    incidentId: "incident:test",
    incidentDefinitionRef: definition.incidentDefinitionRef,
    processId: prepared.seed.processId,
    endCondition: "invented_victory",
    outcomeId: "outcome:test"
  });
  assert.equal(catalogMismatch.ok, false);
  if (!catalogMismatch.ok) {
    assert.equal(
      catalogMismatch.error.messageKey,
      "bastion.defense.terminal-resolution-missing"
    );
  }

  const staleProjection = structuredClone(player);
  (
    staleProjection.gameBoardProjection.character as {
      pvActuels: number;
    }
  ).pvActuels = 9;
  const refused = await createCatalogBackedBastionDefenseAuthorityV1({
    repository,
    campaignId,
    catalog,
    playerResolver: {
      resolverRef: "resolver:stale-character:test-v1",
      resolve() {
        return staleProjection;
      }
    }
  }).prepare({
    campaign: currentCampaign.value,
    bastion: bastion(),
    incident: incidentDefinition(),
    sourceEvent,
    startedAtGameSecond: 3_600
  });
  assert.equal(refused.authorized, false);
  assert.equal(
    refused.reasonCode,
    "bastion.defense.player-owner-state-mismatch"
  );

  console.log(
    "catalog-backed bastion defense authority and resolution policy 8A: OK"
  );
}

function encounterDefinition(): BastionDefenseEncounterDefinitionV1 {
  return {
    schemaVersion: 1,
    contractVersion: BASTION_DEFENSE_ENCOUNTER_CATALOG_V1,
    incidentDefinitionRef: "incident-definition:catalogued-raid",
    playerTeamId: "defenders",
    rulesetRef: { kind: "ruleset", id: "rules.jdr5e:2" },
    objectives: [{
      teamId: "defenders",
      objective: "protect_the_bastion"
    }],
    hostileParticipants: [{
      actorId: "attacker:raider-1",
      tacticalProjectionRef: "enemy:bandit",
      gameBoardProjection: {
        schemaVersion: 1,
        contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
        actorId: "attacker:raider-1",
        teamId: "attackers",
        side: "ENEMY",
        enemyTypeId: "bandit"
      }
    }],
    teams: [{
      teamId: "defenders",
      actors: [BASTION_DEFENSE_ACTIVE_PLAYER_SLOT_V1]
    }, {
      teamId: "attackers",
      actors: ["attacker:raider-1"]
    }],
    tacticalMapRef: null,
    mapGenerationRequest: {
      gameBoardProjection: {
        schemaVersion: 1,
        contractVersion: GAME_BOARD_MAP_PROJECTION_V1,
        mapRef: "map:bastion-courtyard",
        prompt: "cour fortifiée battue par la pluie",
        grid: { cols: 12, rows: 10 },
        roundDurationSeconds: 6,
        representedEntryZoneIds: ["courtyard"],
        representedExitZoneIds: ["road"],
        representedTerrainIds: ["walls"],
        representedHazardIds: ["rain"],
        lightingAndVisibility: { light: "night", visibility: "dim" },
        terminalConditions: {
          allEnemiesNeutralized: "all_hostiles_neutralized",
          playerDefeated: "bastion_overrun"
        }
      }
    },
    entryZones: [{ zoneId: "courtyard" }],
    exitZones: [{ zoneId: "road" }],
    knownTerrain: [{ terrainId: "walls", effect: "cover" }],
    lightingAndVisibility: { light: "night", visibility: "dim" },
    weatherAndHazards: [{ hazardId: "rain", severity: "low" }],
    initialPositions: [{
      actorId: BASTION_DEFENSE_ACTIVE_PLAYER_SLOT_V1,
      x: 2,
      y: 5
    }, {
      actorId: "attacker:raider-1",
      x: 9,
      y: 5
    }],
    surpriseState: { surprisedActors: [] },
    allowedEndConditions: [
      "all_hostiles_neutralized",
      "bastion_overrun"
    ],
    resolutions: [{
      schemaVersion: 1,
      endCondition: "all_hostiles_neutralized",
      resolutionCode: "BASTION_DEFENDED",
      bastionStatus: "ACTIVE",
      publicNarrative:
        "Les assaillants rompent le combat ; le bastion demeure aux mains de ses défenseurs."
    }, {
      schemaVersion: 1,
      endCondition: "bastion_overrun",
      resolutionCode: "BASTION_LOST",
      bastionStatus: "LOST",
      publicNarrative:
        "La défense cède et le bastion tombe aux mains des assaillants."
    }],
    sourceRefs: [{ kind: "catalog-entry", id: "defense:catalogued-raid" }]
  };
}

function contentPackage(
  definition: BastionDefenseEncounterDefinitionV1
): ResolvedContentPackageV1 {
  const document = {
    schemaVersion: 1 as const,
    contractVersion: BASTION_DEFENSE_ENCOUNTER_CATALOG_V1,
    catalogId: "catalog:bastion-defense",
    definitions: [definition]
  };
  const fingerprint = `sha256:${"0".repeat(64)}` as const;
  return {
    manifest: {
      schemaVersion: 1,
      packageId: "content.test",
      packageVersion: 1,
      minimumRuntimeContract: "campaign-bootstrap/2",
      entries: [{
        entryId: "catalog:bastion-defense",
        entryKind: "GAME_CATALOG_ENTRY",
        entityType: "bastion-defense-catalog",
        payloadSchemaVersion: 1,
        sourcePath: "catalogs/bastion-defense.json",
        sourceFingerprint: fingerprint,
        payloadFingerprint: fingerprint,
        references: []
      }],
      rootFingerprint: fingerprint
    },
    entries: [{
      entryKind: "GAME_CATALOG_ENTRY",
      entryId: "catalog:bastion-defense",
      sourceText: JSON.stringify(document),
      payload: document
    }],
    loreEntities: [],
    characterCatalog: {
      races: new Set(),
      backgrounds: new Set(),
      languages: new Set(),
      classes: new Map(),
      subclasses: new Map(),
      items: new Map(),
      actions: new Set(),
      reactions: new Set(),
      spells: new Set(),
      features: new Set()
    }
  };
}

function playerProjection(): BastionDefensePlayerProjectionV1 {
  const character = structuredClone(sampleCharacter);
  character.id = "character:aryn";
  character.pvActuels = 12;
  return {
    schemaVersion: 1,
    contractVersion: BASTION_DEFENSE_PLAYER_PROJECTION_V1,
    actorId: "character:aryn",
    characterId: "character:aryn",
    teamId: "defenders",
    characterStateAggregateId: characterAggregateId,
    tacticalProjectionAggregateId: tacticalAggregateId,
    gameBoardProjection: {
      schemaVersion: 1,
      contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
      actorId: "character:aryn",
      teamId: "defenders",
      side: "PLAYER",
      character
    }
  };
}

function incidentDefinition(): BastionIncidentDefinitionV1 {
  return {
    schemaVersion: 1,
    contractVersion: "bastion-incident-catalog/1",
    incidentDefinitionRef: "incident-definition:catalogued-raid",
    displayName: "Raid catalogué",
    kind: "TACTICAL_DEFENSE",
    publicNarrative:
      "Des assaillants approchent ; l’issue dépend encore du combat.",
    effect: { schemaVersion: 1, kind: "TACTICAL_HANDOFF" }
  };
}

function bastion(): BastionRecordV1 {
  return {
    schemaVersion: 1,
    bastionId: "bastion:test",
    placeRef: "place:test",
    placeDisplayName: "Bastion de test",
    ownerRef: "character:aryn",
    ownerDisplayName: "Aryn",
    status: "ACTIVE",
    sourceOperationId: "operation:bastion",
    sourceEventId: "event:bastion",
    acquisitionPolicyRef: "policy:bastion",
    placeSourceRefs: ["place:test"],
    establishedAtGameSecond: 0,
    installations: [],
    workOrders: [],
    occupantAssignments: [],
    occupantActivities: [],
    incidents: [],
    version: 1
  };
}

function committedWorldEvent(): EventRecord {
  return {
    schemaVersion: 1,
    eventId: opaqueId("event:catalogued-raid"),
    campaignId,
    operationId: opaqueId("operation:catalogued-raid"),
    eventType: "world_bastion_raid_started",
    origin: "WORLD_SIMULATION",
    causation: { kind: "OPERATION", id: "operation:catalogued-raid" },
    aggregateRefs: [],
    visibility: { scope: "MJ_PRIVATE", actorIds: [] },
    occurredAtGameSecond: 3_600,
    payloadSchemaVersion: 1,
    payload: {
      hiddenAttackPlan: "must-not-leak",
      targetBastionId: "bastion:test"
    },
    commitId: opaqueId<CommitId>("commit:catalogued-raid"),
    recordedAt: now,
    commitSequence: 2,
    eventSequence: 0
  };
}

async function commitCharacterOwners(
  repository: MemoryCampaignRepository,
  campaign: CampaignRecord
) {
  const operationId = opaqueId<OperationId>("operation:character-owners");
  const payload = { characterId: "character:aryn" };
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>("request:character-owners"),
    idempotencyKey: opaqueId<IdempotencyKey>("idem:character-owners"),
    requestFingerprint: await computeRequestFingerprint(
      "campaign.character-owners",
      1,
      payload
    ),
    operationKind: "campaign.character-owners",
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
  assert.equal((await repository.receiveOperation(operation)).ok, true);
  assert.equal((await repository.transitionOperation(
    operationId,
    "RECEIVED",
    "PREPARING"
  )).ok, true);
  assert.equal((await repository.transitionOperation(
    operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  )).ok, true);
  const lease = await repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>("writer:character-owners"),
    30_000
  );
  assert.equal(lease.ok, true);
  if (!lease.ok) return;
  const committed = await repository.commit({
    campaignId,
    operationId,
    commitId: opaqueId<CommitId>("commit:character-owners"),
    idempotencyKey: operation.idempotencyKey,
    requestFingerprint: operation.requestFingerprint,
    expectedCampaignRevision: 0,
    writerLease: lease.value,
    acceptedCommands: [{
      schemaVersion: 1,
      contractId: "campaign-character-owner-fixture",
      contractVersion: 1,
      commandId: opaqueId<CommandId>("command:character-owners"),
      campaignId,
      operationId,
      commandType: "campaign.character-owners",
      target: {
        aggregateType: "character.state",
        aggregateId: characterAggregateId,
        expectedAggregateRevision: null
      },
      payloadSchemaVersion: 1,
      payload,
      acceptedAtGameSecond: 0
    }],
    aggregateWrites: [{
      aggregateType: "character.state",
      aggregateId: characterAggregateId,
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        characterId: "character:aryn",
        currentHitPoints: 12
      }
    }, {
      aggregateType: "character.tactical-projection",
      aggregateId: tacticalAggregateId,
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: {
        schemaVersion: 1,
        characterId: "character:aryn",
        currentHitPoints: 12,
        maximumHitPoints: 12
      }
    }, {
      aggregateType:
        ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
      aggregateId: activeCampaignCharacterProfileAggregateIdV1(campaignId),
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: createActiveCampaignCharacterProfileV1({
        campaignId,
        characterId: "character:aryn",
        characterStateAggregateId: characterAggregateId,
        tacticalProjectionAggregateId: tacticalAggregateId,
        narrativeProjectionAggregateId: narrativeAggregateId,
        positionAggregateId,
        contentPackageId: campaign.dependencies.contentPackageId,
        contentPackageVersion:
          campaign.dependencies.contentPackageVersion,
        rulesetId: campaign.dependencies.rulesetId,
        rulesetVersion: campaign.dependencies.rulesetVersion,
        sourceFingerprint: `sha256:${"1".repeat(64)}`
      })
    }],
    events: [{
      schemaVersion: 1,
      eventId: opaqueId<EventId>("event:character-owners"),
      campaignId,
      operationId,
      eventType: "campaign_character_owners_committed",
      origin: "SYSTEM",
      causation: {
        kind: "COMMAND",
        id: "command:character-owners"
      },
      aggregateRefs: [{
        aggregateType: "character.state",
        aggregateId: characterAggregateId,
        aggregateRevision: 0
      }, {
        aggregateType: "character.tactical-projection",
        aggregateId: tacticalAggregateId,
        aggregateRevision: 0
      }, {
        aggregateType:
          ACTIVE_CAMPAIGN_CHARACTER_PROFILE_AGGREGATE_TYPE_V1,
        aggregateId:
          activeCampaignCharacterProfileAggregateIdV1(campaignId),
        aggregateRevision: 0
      }],
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: 0,
      payloadSchemaVersion: 1,
      payload
    }],
    outboxTasks: []
  });
  assert.equal(
    committed.ok,
    true,
    committed.ok
      ? undefined
      : `${committed.error.code}:${committed.error.messageKey}`
  );
  assert.equal((await repository.releaseWriterLease(lease.value)).ok, true);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
