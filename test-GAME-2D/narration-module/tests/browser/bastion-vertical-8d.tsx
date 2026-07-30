import ReactDOM from "react-dom/client";
import { App } from "../../../src/App";
import creatorReady from "../fixtures/character/valid/creator-ready.json";
import { currentCharacterCatalog } from "../fixtures/character/currentCharacterCatalog";
import {
  BASTION_DEFENSE_ENCOUNTER_CATALOG_V1,
  BASTION_INCIDENT_CATALOG_CONTRACT_V1,
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  BASTION_REGISTRY_CONTRACT_V1,
  CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  NarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  activateCampaignInitialSceneV1,
  bastionRegistryAggregateIdV1,
  createBootstrappedBastionDefensePlayerResolverV1,
  createCatalogBackedBastionTacticalRuntimeFactoryV1,
  loadContentPackageBastionDefenseEncounterCatalogV1,
  type BastionDefenseEncounterCatalogDocumentV1,
  type BastionDefenseEncounterDefinitionV1,
  type BastionRecordV1,
  type CampaignRuntimeBindingsV1
} from "../../src/application";
import {
  CampaignBootstrapServiceV1,
  MVP_RULE_DEFINITIONS_V1,
  MVP_RULE_EXECUTORS_V1,
  createMvpRulesetManifestV1,
  type CampaignBootstrapInputV1,
  type ContentPackageResolverV1,
  type LoreEntityV1,
  type ResolvedContentEntryV1,
  type ResolvedContentPackageV1,
  type ResolvedRulesetV1,
  type RulesetResolverV1,
  type Sha256Fingerprint
} from "../../src/bootstrap";
import {
  IndexedDbCampaignRepository,
  cloneJson,
  computeJsonFingerprint,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CommandId,
  type CommitId,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type WriterId
} from "../../src/core";
import {
  GAME_BOARD_ACTOR_PROJECTION_V1,
  GAME_BOARD_MAP_PROJECTION_V1
} from "../../../src/tactical-integration/gameBoardEncounterAdapter";

const DATABASE_NAME = "jdr5e-bastion-vertical-8d";
const PACKAGE_ID = "content.bastion-vertical-8d";
const DEFENSE_CATALOG_ID = "catalog:bastion-defense-8d";
const campaignId = opaqueId<CampaignId>("campaign-bastion-vertical-8d");
const sourceOperationId =
  opaqueId<OperationId>("world-bastion-vertical-8d-attack");
const sourceEventId =
  opaqueId<EventId>("event-bastion-vertical-8d-attack");
const bastionId = "bastion:old-bridge-inn-8d";
const placeRef = "place:old-bridge-inn";
const runtimeBindings: CampaignRuntimeBindingsV1 = {
  schemaVersion: 1,
  contractVersion: CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  positionAggregateId: opaqueId("aggregate-position-aryn-8d"),
  sceneLifecycleAggregateId: opaqueId("aggregate-scene-lifecycle-8d"),
  scheduleAggregateId: opaqueId("aggregate-schedule-8d"),
  simulationCursorAggregateId: opaqueId("aggregate-simulation-cursor-8d"),
  processAggregateId: opaqueId("aggregate-process-8d"),
  version: 1
};

const definition: BastionDefenseEncounterDefinitionV1 = {
  schemaVersion: 1,
  contractVersion: BASTION_DEFENSE_ENCOUNTER_CATALOG_V1,
  incidentDefinitionRef: "incident-definition:bridge-raid-8d",
  playerTeamId: "defenders",
  rulesetRef: { kind: "ruleset", id: "rules.jdr5e:2" },
  objectives: [{
    teamId: "defenders",
    objective: "protect_the_bastion"
  }],
  hostileParticipants: [{
    actorId: "attacker:raider-8d",
    gameBoardProjection: {
      schemaVersion: 1,
      contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
      actorId: "attacker:raider-8d",
      teamId: "attackers",
      side: "ENEMY",
      enemyTypeId: "brute"
    }
  }],
  teams: [{
    teamId: "defenders",
    actors: ["pj-aryn"]
  }, {
    teamId: "attackers",
    actors: ["attacker:raider-8d"]
  }],
  tacticalMapRef: null,
  mapGenerationRequest: {
    gameBoardProjection: {
      schemaVersion: 1,
      contractVersion: GAME_BOARD_MAP_PROJECTION_V1,
      mapRef: "map:bastion-vertical-8d",
      prompt: "cour d’auberge sous la pluie avec murs et charrette",
      grid: { cols: 12, rows: 10 },
      roundDurationSeconds: 6,
      representedEntryZoneIds: ["courtyard"],
      representedExitZoneIds: ["bridge-road"],
      representedTerrainIds: [],
      representedHazardIds: [],
      lightingAndVisibility: {
        light: "night",
        visibility: "dim"
      },
      terminalConditions: {
        allEnemiesNeutralized: "all_hostiles_neutralized",
        playerDefeated: "bastion_overrun"
      }
    }
  },
  entryZones: [{ zoneId: "courtyard" }],
  exitZones: [{ zoneId: "bridge-road" }],
  knownTerrain: [],
  lightingAndVisibility: { light: "night", visibility: "dim" },
  weatherAndHazards: [],
  initialPositions: [{
    actorId: "pj-aryn",
    x: 2,
    y: 4
  }, {
    actorId: "attacker:raider-8d",
    x: 8,
    y: 4
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
      "Les assaillants se replient ; le bastion reste aux mains de ses défenseurs."
  }, {
    schemaVersion: 1,
    endCondition: "bastion_overrun",
    resolutionCode: "BASTION_LOST",
    bastionStatus: "LOST",
    publicNarrative:
      "La défense cède et le bastion tombe aux mains des assaillants."
  }],
  sourceRefs: [{
    kind: "catalog-entry",
    id: "defense:bridge-raid-8d"
  }]
};

function lore(
  entityId: string,
  entityType: LoreEntityV1["entityType"],
  parent?: [string, string]
): LoreEntityV1 {
  const sourcePath = `wiki/${entityType}/${entityId}.md`;
  return {
    schemaVersion: 1,
    entityId,
    entityType,
    displayName: entityId.replaceAll("_", " "),
    attributes: {},
    relations: parent === undefined
      ? []
      : [{
          relation: parent[0],
          targetId: parent[1],
          targetType: null,
          strength: "REQUIRED"
        }],
    searchTerms: [entityId],
    body: `Lore de ${entityId}.`,
    provenance: {
      packageId: PACKAGE_ID,
      packageVersion: 1,
      sourcePath,
      sourceFingerprint: "sha256:pending"
    }
  };
}

async function sourceFingerprint(
  sourceText: string
): Promise<Sha256Fingerprint> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sourceText)
  );
  return `sha256:${Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

function characterCatalogIds(): string[] {
  const catalog = currentCharacterCatalog();
  return [...new Set([
    ...catalog.races,
    ...catalog.backgrounds,
    ...catalog.languages,
    ...catalog.classes.keys(),
    ...catalog.subclasses.keys(),
    ...catalog.items.keys(),
    ...catalog.actions,
    ...catalog.reactions,
    ...catalog.spells,
    ...catalog.features
  ])].sort();
}

async function contentPackage():
Promise<ResolvedContentPackageV1> {
  const characterCatalog = currentCharacterCatalog();
  const loreEntities = [
    lore("old_bridge_inn", "batiment", ["quartier", "bridge_district"]),
    lore("bridge_district", "quartier", ["ville", "lysenthe"]),
    lore("lysenthe", "ville", ["region", "ylssea"]),
    lore("ylssea", "region", ["territoire", "astryade"]),
    lore("astryade", "royaume")
  ];
  const loreSources = new Map(loreEntities.map(entity => [
    entity.entityId,
    `---\nid: ${entity.entityId}\n---\n${entity.body}`
  ]));
  await Promise.all(loreEntities.map(async entity => {
    entity.provenance.sourceFingerprint = await sourceFingerprint(
      loreSources.get(entity.entityId)!
    );
  }));
  const defenseDocument: BastionDefenseEncounterCatalogDocumentV1 = {
    schemaVersion: 1,
    contractVersion: BASTION_DEFENSE_ENCOUNTER_CATALOG_V1,
    catalogId: DEFENSE_CATALOG_ID,
    definitions: [definition]
  };
  const entries: ResolvedContentEntryV1[] = [
    ...loreEntities.map(entity => ({
      entryKind: "LORE_ENTITY" as const,
      entryId: entity.entityId,
      sourceText: loreSources.get(entity.entityId)!,
      payload: entity
    })),
    ...characterCatalogIds().map(entryId => ({
      entryKind: "GAME_CATALOG_ENTRY" as const,
      entryId,
      sourceText: `catalog:${entryId}`,
      payload: { schemaVersion: 1, entryId }
    })),
    {
      entryKind: "GAME_CATALOG_ENTRY",
      entryId: DEFENSE_CATALOG_ID,
      sourceText: JSON.stringify(defenseDocument),
      payload: defenseDocument
    }
  ];
  const descriptors = await Promise.all(entries.map(async entry => ({
    entryId: entry.entryId,
    entryKind: entry.entryKind,
    entityType: entry.entryKind === "LORE_ENTITY"
      ? loreEntities.find(value => value.entityId === entry.entryId)!
          .entityType
      : entry.entryId === DEFENSE_CATALOG_ID
        ? "bastion-defense-catalog"
        : "game-catalog-entry",
    payloadSchemaVersion: 1,
    sourcePath: entry.entryKind === "LORE_ENTITY"
      ? loreEntities.find(value => value.entityId === entry.entryId)!
          .provenance.sourcePath
      : `catalog/${entry.entryId}.json`,
    sourceFingerprint: await sourceFingerprint(entry.sourceText),
    payloadFingerprint:
      await computeJsonFingerprint(entry.payload) as Sha256Fingerprint,
    references: []
  })));
  descriptors.sort((left, right) =>
    left.entryKind.localeCompare(right.entryKind)
    || left.entityType.localeCompare(right.entityType)
    || left.entryId.localeCompare(right.entryId)
  );
  const base = {
    schemaVersion: 1 as const,
    packageId: PACKAGE_ID,
    packageVersion: 1,
    minimumRuntimeContract: "campaign-bootstrap/2" as const,
    entries: descriptors
  };
  return {
    manifest: {
      ...base,
      rootFingerprint:
        await computeJsonFingerprint(base) as Sha256Fingerprint
    },
    entries,
    loreEntities,
    characterCatalog
  };
}

async function ruleset(): Promise<ResolvedRulesetV1> {
  return {
    manifest: await createMvpRulesetManifestV1(PACKAGE_ID, 1, 1),
    definitions: MVP_RULE_DEFINITIONS_V1,
    executors: MVP_RULE_EXECUTORS_V1
  };
}

async function bootstrapInput(): Promise<CampaignBootstrapInputV1> {
  const character = cloneJson(creatorReady);
  return {
    schemaVersion: 1,
    ids: {
      campaignId,
      operationId: opaqueId("operation-bootstrap-bastion-8d"),
      clientRequestId: opaqueId("request-bootstrap-bastion-8d"),
      idempotencyKey: opaqueId("idempotency-bootstrap-bastion-8d"),
      commitId: opaqueId("commit-bootstrap-bastion-8d"),
      eventId: opaqueId("event-bootstrap-bastion-8d"),
      clockAggregateId: opaqueId("aggregate-clock-bastion-8d"),
      characterAggregateId: opaqueId("aggregate-character-aryn-8d"),
      tacticalProjectionAggregateId:
        opaqueId("aggregate-tactical-aryn-8d"),
      narrativeProjectionAggregateId:
        opaqueId("aggregate-narrative-aryn-8d"),
      positionAggregateId: runtimeBindings.positionAggregateId,
      bootstrapContextAggregateId:
        opaqueId("aggregate-bootstrap-context-8d")
    },
    contentPackageId: PACKAGE_ID,
    contentPackageVersion: 1,
    rulesetId: "rules.jdr5e",
    rulesetVersion: 2,
    calendarId: "calendar.astryade",
    calendarVersion: 1,
    initialLocationId: "old_bridge_inn",
    character: {
      schemaVersion: 1,
      sourceKind: "CHARACTER_CREATOR_LEGACY",
      sourceSchemaVersion: 1,
      sourceFingerprint:
        await computeJsonFingerprint(character) as Sha256Fingerprint,
      character
    },
    requestedAt: "2026-07-30T10:00:00.000Z"
  };
}

async function ensureBootstrap(
  repository: IndexedDbCampaignRepository,
  content: ResolvedContentPackageV1,
  resolvedRuleset: ResolvedRulesetV1
): Promise<void> {
  const existing = await repository.getCampaign(campaignId);
  if (existing.ok) return;
  if (existing.error.code !== "NOT_FOUND") {
    throw new Error(`${existing.error.code}:${existing.error.messageKey}`);
  }
  const service = new CampaignBootstrapServiceV1(
    { resolve: async () => content } as ContentPackageResolverV1,
    { resolve: async () => resolvedRuleset } as RulesetResolverV1,
    repository
  );
  const request = await bootstrapInput();
  const result = await service.bootstrap(request);
  if (!result.ok) {
    throw new Error(result.diagnostics.map(value => value.code).join("|"));
  }
  const presented = await repository.completePresentation(
    request.ids.operationId,
    "COMMITTED_RENDERED",
    1,
    { schemaVersion: 1, status: "BOOTSTRAPPED" }
  );
  if (!presented.ok) {
    throw new Error(
      `${presented.error.code}:${presented.error.messageKey}`
    );
  }
}

function bastion(): BastionRecordV1 {
  return {
    schemaVersion: 1,
    bastionId,
    placeRef,
    placeDisplayName: "Bastion du Vieux Pont",
    ownerRef: "pj-aryn",
    ownerDisplayName: "Aryn",
    status: "ACTIVE",
    sourceOperationId: "operation-bastion-setup-8d",
    sourceEventId: "event-bastion-setup-8d",
    acquisitionPolicyRef: "test-campaign-acquisition:8d",
    placeSourceRefs: [placeRef],
    establishedAtGameSecond: 0,
    installations: [],
    workOrders: [],
    occupantAssignments: [],
    occupantActivities: [],
    incidents: [],
    version: 1
  };
}

async function ensureBastion(
  repository: IndexedDbCampaignRepository
): Promise<void> {
  const aggregateId = bastionRegistryAggregateIdV1(campaignId);
  const existing = await repository.getAggregate(
    campaignId,
    BASTION_REGISTRY_AGGREGATE_TYPE_V1,
    aggregateId
  );
  if (existing.ok) return;
  if (existing.error.code !== "NOT_FOUND") {
    throw new Error(`${existing.error.code}:${existing.error.messageKey}`);
  }
  await commitFixtureOperation({
    repository,
    operationId: opaqueId("operation-bastion-setup-8d"),
    operationKind: "test.bastion-established",
    aggregateType: BASTION_REGISTRY_AGGREGATE_TYPE_V1,
    aggregateId,
    aggregatePayload: {
      schemaVersion: 1,
      contractVersion: BASTION_REGISTRY_CONTRACT_V1,
      campaignId,
      bastions: [bastion()],
      version: 1
    },
    eventId: opaqueId("event-bastion-setup-8d"),
    eventType: "test_bastion_established",
    eventOrigin: "SYSTEM",
    eventVisibility: "SYSTEM",
    eventPayload: {
      bastionId,
      placeRef
    }
  });
}

async function ensureWorldCause(
  repository: IndexedDbCampaignRepository
): Promise<void> {
  const existing = await repository.getOperation(sourceOperationId);
  if (existing.ok) return;
  if (existing.error.code !== "NOT_FOUND") {
    throw new Error(`${existing.error.code}:${existing.error.messageKey}`);
  }
  await commitFixtureOperation({
    repository,
    operationId: sourceOperationId,
    operationKind: "world.bastion-attack",
    aggregateType: "world.event-source",
    aggregateId: opaqueId("aggregate-world-bastion-attack-8d"),
    aggregatePayload: {
      schemaVersion: 1,
      causeKind: "TACTICAL_DEFENSE",
      targetPlaceRef: placeRef
    },
    eventId: sourceEventId,
    eventType: "world_bastion_attack_started",
    eventOrigin: "WORLD_SIMULATION",
    eventVisibility: "MJ_PRIVATE",
    eventPayload: {
      schemaVersion: 1,
      causeKind: "TACTICAL_DEFENSE",
      targetPlaceRef: placeRef,
      privateApproachRoute: "hidden eastern culvert"
    }
  });
}

async function commitFixtureOperation(input: {
  repository: IndexedDbCampaignRepository;
  operationId: OperationId;
  operationKind: string;
  aggregateType: string;
  aggregateId: AggregateId;
  aggregatePayload: JsonObject;
  eventId: EventId;
  eventType: string;
  eventOrigin: "SYSTEM" | "WORLD_SIMULATION";
  eventVisibility: "SYSTEM" | "MJ_PRIVATE";
  eventPayload: JsonObject;
}): Promise<void> {
  const campaign = await input.repository.getCampaign(campaignId);
  if (!campaign.ok) {
    throw new Error(`${campaign.error.code}:${campaign.error.messageKey}`);
  }
  const requestPayload = {
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventId: input.eventId
  };
  const requestFingerprint = await computeRequestFingerprint(
    input.operationKind,
    1,
    requestPayload
  );
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId,
    clientRequestId:
      opaqueId<RequestId>(`${input.operationId}:request`),
    idempotencyKey:
      opaqueId<IdempotencyKey>(`${input.operationId}:idempotency`),
    requestFingerprint,
    operationKind: input.operationKind,
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: "2026-07-30T10:01:00.000Z",
    updatedAt: "2026-07-30T10:01:00.000Z"
  };
  const received = await input.repository.receiveOperation(operation);
  if (!received.ok) {
    throw new Error(`${received.error.code}:${received.error.messageKey}`);
  }
  const preparing = await input.repository.transitionOperation(
    input.operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) {
    throw new Error(`${preparing.error.code}:${preparing.error.messageKey}`);
  }
  const ready = await input.repository.transitionOperation(
    input.operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) {
    throw new Error(`${ready.error.code}:${ready.error.messageKey}`);
  }
  const lease = await input.repository.acquireWriterLease(
    campaignId,
    opaqueId<WriterId>(`${input.operationId}:writer`),
    120_000
  );
  if (!lease.ok) {
    throw new Error(`${lease.error.code}:${lease.error.messageKey}`);
  }
  try {
    const commandId =
      opaqueId<CommandId>(`${input.operationId}:command`);
    const committed = await input.repository.commit({
      campaignId,
      operationId: input.operationId,
      commitId: opaqueId<CommitId>(`${input.operationId}:commit`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: lease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "bastion-vertical-8d-fixture",
        contractVersion: 1,
        commandId,
        campaignId,
        operationId: input.operationId,
        commandType: input.operationKind,
        target: {
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          expectedAggregateRevision: null
        },
        payloadSchemaVersion: 1,
        payload: requestPayload,
        acceptedAtGameSecond: 0
      }],
      aggregateWrites: [{
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: input.aggregatePayload
      }],
      events: [{
        schemaVersion: 1,
        eventId: input.eventId,
        campaignId,
        operationId: input.operationId,
        eventType: input.eventType,
        origin: input.eventOrigin,
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          aggregateRevision: 0
        }],
        visibility: {
          scope: input.eventVisibility,
          actorIds: []
        },
        occurredAtGameSecond: 0,
        payloadSchemaVersion: 1,
        payload: input.eventPayload
      }],
      outboxTasks: []
    });
    if (!committed.ok) {
      throw new Error(
        `${committed.error.code}:${committed.error.messageKey}`
      );
    }
    const completed = await input.repository.completePresentation(
      input.operationId,
      "COMMITTED_RENDERED",
      1,
      { schemaVersion: 1, status: "COMMITTED" }
    );
    if (!completed.ok) {
      throw new Error(
        `${completed.error.code}:${completed.error.messageKey}`
      );
    }
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function buildController(
  repository: IndexedDbCampaignRepository,
  content: ResolvedContentPackageV1
): Promise<NarrativeTurnControllerV1> {
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) {
    throw new Error(`${campaign.error.code}:${campaign.error.messageKey}`);
  }
  const encounterCatalog =
    loadContentPackageBastionDefenseEncounterCatalogV1({
      campaign: campaign.value,
      content,
      catalogId: DEFENSE_CATALOG_ID
    });
  if (!encounterCatalog.ok) {
    throw new Error(
      `${encounterCatalog.error.code}:${encounterCatalog.error.messageKey}`
    );
  }
  const playerResolver =
    createBootstrappedBastionDefensePlayerResolverV1({
      repository,
      adapter: {
        adapterRef: "creator-ready-to-game-board:8d",
        project({ profile, tacticalProjection, teamId }) {
          const character = cloneJson(creatorReady) as JsonObject;
          character.id = profile.actorId;
          character.pvActuels =
            Number(tacticalProjection.currentHitPoints);
          return {
            schemaVersion: 1,
            contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
            actorId: profile.actorId,
            teamId,
            side: "PLAYER",
            character
          };
        }
      }
    });
  const runtimeFactory =
    createCatalogBackedBastionTacticalRuntimeFactoryV1({
      causeRoutingPolicy: {
        policyRef: "world-place-target:8d",
        evaluate({ sourceEvent, activeBastions }) {
          const targetPlaceRef =
            sourceEvent.payload.targetPlaceRef;
          const target = activeBastions.find(value =>
            value.placeRef === targetPlaceRef
          );
          return {
            schemaVersion: 1,
            sourceKind: "WORLD_SIMULATION",
            disposition: target === undefined ? "IGNORE" : "TARGET",
            reasonCode: target === undefined
              ? "NO_ACTIVE_BASTION_AT_PLACE"
              : "ACTIVE_BASTION_AT_PLACE",
            bastionId: target?.bastionId ?? null
          };
        }
      },
      incidentCatalog: {
        catalogRef: "bastion-incident-catalog:8d",
        resolve(ref) {
          return ref === definition.incidentDefinitionRef
            ? {
                schemaVersion: 1,
                contractVersion:
                  BASTION_INCIDENT_CATALOG_CONTRACT_V1,
                incidentDefinitionRef: ref,
                displayName: "Raid du pont",
                kind: "TACTICAL_DEFENSE",
                publicNarrative:
                  "Des assaillants atteignent la cour du bastion ; la défense commence et son issue reste ouverte.",
                effect: {
                  schemaVersion: 1,
                  kind: "TACTICAL_HANDOFF"
                }
              }
            : null;
        }
      },
      incidentPolicy: {
        policyRef: "world-defense-cause:8d",
        evaluate({ sourceEvent }) {
          const eligible =
            sourceEvent.payload.causeKind === "TACTICAL_DEFENSE";
          return {
            schemaVersion: 1,
            eligible,
            reasonCode: eligible
              ? "TACTICAL_DEFENSE_CAUSE"
              : "CAUSE_OUTSIDE_DEFENSE_POLICY",
            incidentDefinitionRef: eligible
              ? definition.incidentDefinitionRef
              : null
          };
        }
      },
      encounterCatalog: encounterCatalog.value,
      playerResolver
    });
  return new NarrativeTurnControllerV1({
    repository,
    campaignId,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    activeSceneResolver: {
      resolve: async () => ({
        ok: true,
        value: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
      })
    },
    worldSceneLocationResolver: {
      resolveLocationRefs: async () => [placeRef]
    },
    runtimeBindings,
    bastionTacticalRuntimeFactory: runtimeFactory
  });
}

async function bootstrapApplication() {
  try {
    return await bootstrapApplicationChecked();
  } catch (error) {
    console.error("[bastion-vertical-8d bootstrap]", error);
    throw error;
  }
}

async function bootstrapApplicationChecked() {
  if (new URL(window.location.href).searchParams.get("reset") === "1") {
    await IndexedDbCampaignRepository.deleteDatabase(DATABASE_NAME);
    window.history.replaceState(
      {},
      "",
      "/narration-module/tests/browser/bastion-vertical-8d.html"
    );
  }
  const repository =
    await IndexedDbCampaignRepository.open({ databaseName: DATABASE_NAME });
  const [content, resolvedRuleset] = await Promise.all([
    contentPackage(),
    ruleset()
  ]);
  await ensureBootstrap(repository, content, resolvedRuleset);
  const activated = await activateCampaignInitialSceneV1({
    repository,
    campaignId,
    runtimeBindings,
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId,
    locationRef: placeRef,
    technicalTimestamp: "2026-07-30T10:00:30.000Z"
  });
  if (!activated.ok) {
    throw new Error(
      `${activated.error.code}:${activated.error.messageKey}`
    );
  }
  await ensureBastion(repository);
  await ensureWorldCause(repository);
  const controller = await buildController(repository, content);
  const routed = await controller.processCommittedBastionCauseBoundary({
    sourceOperationId,
    sourceEventId,
    sceneId: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId
  });
  if (!routed.ok) {
    throw new Error(`${routed.error.code}:${routed.error.messageKey}`);
  }
  window.__prepareBastionVertical8dTerminal = async () => {
    const session = await controller.restoreActiveBastionTacticalSession();
    if (!session.ok || session.value?.checkpoint === null) {
      throw new Error("8D active checkpoint unavailable");
    }
    const ownerState = cloneJson(
      session.value.checkpoint.ownerState
    ) as JsonObject;
    if (!Array.isArray(ownerState.enemies)) {
      throw new Error("8D enemies unavailable");
    }
    ownerState.enemies = ownerState.enemies.map(value => ({
      ...(value as JsonObject),
      hp: 0
    }));
    ownerState.turnBoundaryId = "terminal-preparation-8d";
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const saved = await controller.saveTacticalCheckpoint({
        schemaVersion: 1,
        processId: session.value.process.processId,
        clientRequestId:
          `gate8d-terminal:${session.value.process.processId}`,
        lastAppliedTurnId: "terminal-preparation-8d",
        ownerState
      });
      if (saved.ok) return saved.value.checkpointId;
      if (saved.error.code !== "CAMPAIGN_BUSY") {
        throw new Error(
          `${saved.error.code}:${saved.error.messageKey}:`
          + JSON.stringify(saved.error.details)
        );
      }
      await new Promise(resolve => window.setTimeout(resolve, 25));
    }
    throw new Error("8D checkpoint queue did not become available");
  };
  return {
    controller,
    openingScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App narrativeBootstrapController={bootstrapApplication} />
);

declare global {
  interface Window {
    __prepareBastionVertical8dTerminal?: () => Promise<string>;
  }
}
