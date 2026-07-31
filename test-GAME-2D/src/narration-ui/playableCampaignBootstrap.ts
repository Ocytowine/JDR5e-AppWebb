import {
  buildCampaignProjectedPlayableLoreSceneV1,
  createCampaignLoreGuidedDynamicPlaceRuntimeV1,
  createCatalogSceneTransitionRuntimeV1,
  DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1,
  ensureDynamicPlaceCreationStateV1,
  NarrativeTurnControllerV1,
  createCampaignWorldSimulationRuntimeV1,
  createInterpreterCharacterContextResolverV1,
  resolveSceneV1,
  activateCampaignInitialSceneV1,
  CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  type CampaignRuntimeBindingsV1
} from "../../narration-module/src/application";
import {
  CampaignBootstrapServiceV1,
  importLegacyCharacterV1,
  type CampaignBootstrapDiagnosticV1,
  type CampaignBootstrapIdsV1
} from "../../narration-module/src/bootstrap";
import {
  computeJsonFingerprint,
  coreError,
  IndexedDbCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type JsonObject,
  type RepositoryClock
} from "../../narration-module/src/core";
import type { CharacterImportDiagnosticV1 } from "../../narration-module/src/bootstrap";
import type { NarrativeAppSurfaceBootstrapV1 } from "./NarrativeAppSurface";
import {
  buildOpenAiIntentInterpreterConfigV1,
  buildOpenAiMjPlannerConfigV1,
  buildOpenAiNpcPerformerConfigV1,
  buildOpenAiSceneCreatorConfigV2
} from "./openAiNarrativeRuntimeConfig";
import {
  readActiveCharacterSheetV1,
  type ActiveCharacterSheetV1
} from "./activeCharacterSheetAdapter";
import {
  buildInstalledCharacterCatalogV1,
  createInstalledContentPackageResolverV1,
  createInstalledRulesetResolverV1,
  INSTALLED_CONTENT_PACKAGE_ID_V1,
  INSTALLED_CONTENT_PACKAGE_VERSION_V1,
  INSTALLED_RULESET_ID_V1,
  INSTALLED_RULESET_VERSION_V1
} from "./installedCampaignContent";
import { buildArchiveLorePilotV1 } from "./archiveLorePilot";
import {
  createCommittedBastionRestRuntimeV1,
  createCommittedCampaignFeatureReaderV1
} from "./campaignFeatureComposition";
import { currentCharacterProgressionCatalogV1 } from
  "./characterProgressionCatalogAdapter";
import { buildInstalledInterpreterCharacterReferenceCatalogV1 } from
  "./interpreterCharacterContextCatalog";
import {
  createInstalledBastionTacticalRuntimeFactoryV1
} from "./playableCampaignBastionTactical";
import { WORLD_MAP_LAYOUT } from "../../map-module/data/worldMapLayout";
import { createWorldStateFromMapLayout } from
  "../../map-module/world-simulation/mapAdapter";

export const PLAYABLE_CAMPAIGN_DATABASE_NAME_V1 =
  "jdr5e-narration-player-campaigns-v1";
const BOOTSTRAP_ENVELOPES_STORAGE_KEY_V1 =
  "jdr5e_narration_bootstrap_envelopes_v1";
const INITIAL_LOCATION_ID_V1 = "archives_de_lysenthe";
const INITIAL_SCENE_ID_V1 = "wiki-location:archives_de_lysenthe";
const systemClock: RepositoryClock = { now: () => new Date() };

export type PlayableNarrativeModeV1 = "local" | "openai";

export interface PlayableCampaignInspectionV1 {
  sheet: ActiveCharacterSheetV1 | null;
  campaignId: string | null;
  campaignExists: boolean;
  diagnostics: Array<{
    severity: "ERROR" | "WARNING";
    code: string;
    message: string;
  }>;
}

interface StoredBootstrapEnvelopeV1 {
  schemaVersion: 1;
  campaignId: string;
  requestedAt: string;
  ids: CampaignBootstrapIdsV1;
}

export async function inspectPlayableCampaignV1():
Promise<PlayableCampaignInspectionV1> {
  const active = await readActiveCharacterSheetV1();
  if (!active.ok) return {
    sheet: null,
    campaignId: null,
    campaignExists: false,
    diagnostics: active.diagnostics.map(value => ({
      severity: "ERROR",
      code: value.code,
      message: value.message
    }))
  };
  const imported = await importLegacyCharacterV1(active.value.envelope, {
    rulesetId: INSTALLED_RULESET_ID_V1,
    rulesetVersion: INSTALLED_RULESET_VERSION_V1,
    catalog: buildInstalledCharacterCatalogV1()
  });
  const campaignId = await campaignIdForSheetV1(active.value);
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1
  });
  const existing = await repository.getCampaign(campaignId);
  repository.close();
  const diagnostics = imported.ok
    ? imported.value.diagnostics.map(characterDiagnostic)
    : imported.diagnostics.map(characterDiagnostic);
  if (!existing.ok && existing.error.code !== "NOT_FOUND") {
    diagnostics.push({
      severity: "ERROR",
      code: existing.error.code,
      message: `La campagne ne peut pas être inspectée (${existing.error.messageKey}).`
    });
  }
  return {
    sheet: active.value,
    campaignId,
    campaignExists: existing.ok,
    diagnostics
  };
}

export async function createPlayableCampaignControllerV1(
  sheet: ActiveCharacterSheetV1,
  mode: PlayableNarrativeModeV1
): Promise<NarrativeAppSurfaceBootstrapV1> {
  const clock = systemClock;
  const campaignId = await campaignIdForSheetV1(sheet);
  const repository = await IndexedDbCampaignRepository.open({
    databaseName: PLAYABLE_CAMPAIGN_DATABASE_NAME_V1,
    clock
  });
  const runtimeBindings = runtimeBindingsForCampaignV1(campaignId);
  try {
    const existing = await repository.getCampaign(campaignId);
    const isNewCampaign = !existing.ok && existing.error.code === "NOT_FOUND";
    if (!existing.ok) {
      if (existing.error.code !== "NOT_FOUND") {
        throw new Error(existing.error.messageKey);
      }
      await bootstrapNewCampaignV1({
        repository,
        campaignId,
        sheet,
        clock
      });
    } else if (
      existing.value.dependencies.contentPackageId
        !== INSTALLED_CONTENT_PACKAGE_ID_V1
      || existing.value.dependencies.contentPackageVersion
        !== INSTALLED_CONTENT_PACKAGE_VERSION_V1
      || existing.value.dependencies.rulesetId !== INSTALLED_RULESET_ID_V1
      || existing.value.dependencies.rulesetVersion
        !== INSTALLED_RULESET_VERSION_V1
    ) {
      throw new Error("campaign.dependencies-installed-version-mismatch");
    }

    const archivePilot = await buildArchiveLorePilotV1();
    const worldSimulationRuntime = createCampaignWorldSimulationRuntimeV1({
      repository,
      campaignId,
      runtimeBindings,
      initialWorldState:
        JSON.parse(JSON.stringify(
          createWorldStateFromMapLayout(WORLD_MAP_LAYOUT)
        )) as JsonObject,
      clock
    });
    if (isNewCampaign) {
      const initialized = await worldSimulationRuntime.ensureInitialized();
      if (!initialized.ok) throw new Error(initialized.error.messageKey);
    }
    const activation = await activateCampaignInitialSceneV1({
      repository,
      campaignId,
      runtimeBindings,
      sceneId: INITIAL_SCENE_ID_V1,
      locationRef: `location:${INITIAL_LOCATION_ID_V1}`,
      technicalTimestamp: clock.now().toISOString()
    });
    if (!activation.ok) throw new Error(activation.error.messageKey);
    await ensureDynamicPlaceCreationStateV1({
      repository,
      campaignId,
      clock,
      topology: archivePilot.topology
    });

    const resolveSceneById = async (sceneId: string) => {
      const authoredSource =
        archivePilot.authoredSceneSourceBySceneId.get(sceneId);
      let authoredScene =
        archivePilot.scenes.find(scene => scene.sceneId === sceneId) ?? null;
      if (authoredSource !== undefined) {
        const campaign = await repository.getCampaign(campaignId);
        if (!campaign.ok) return campaign;
        const projected = await buildCampaignProjectedPlayableLoreSceneV1({
          repository,
          campaignId,
          campaignRevision: campaign.value.campaignRevision,
          entity: authoredSource.entity,
          fragments: authoredSource.fragments,
          packet: authoredSource.packet,
          sceneId
        });
        if (!projected.ok) return projected;
        authoredScene = projected.value.scene;
      }
      return resolveSceneV1({
        sceneId,
        sources: [{
          sourceKind: "WIKI" as const,
          resolve: candidate => candidate === sceneId ? authoredScene : null
        }],
        dynamicCatalog: {
          repository,
          campaignId,
          placeRegistryAggregateId: DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1,
          topologyAggregateId: DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1,
          factRegistryAggregateId: DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1
        }
      });
    };
    const activeSceneResolver = {
      async resolve() {
        const lifecycle = await repository.getAggregate(
          campaignId,
          "scene.lifecycle",
          runtimeBindings.sceneLifecycleAggregateId
        );
        if (!lifecycle.ok) return lifecycle;
        const resolved = await resolveSceneById(
          String(lifecycle.value.payload.activeSceneId)
        );
        return resolved.ok
          ? { ok: true as const, value: resolved.value.scene }
          : resolved;
      }
    };
    const sceneTransitionRuntime = createCatalogSceneTransitionRuntimeV1({
      runtimeBindings,
      async resolveSource(sceneId) {
        const resolved = await resolveSceneById(sceneId);
        return resolved.ok
          ? { ok: true as const, value: resolved.value.scene }
          : resolved;
      },
      async resolveDestination(destinationRef) {
        const authoredId = destinationRef.startsWith("location:")
          ? `wiki-location:${destinationRef.slice("location:".length)}`
          : null;
        if (
          authoredId !== null
          && archivePilot.scenes.some(scene => scene.sceneId === authoredId)
        ) {
          return {
            ok: true as const,
            value: archivePilot.scenes.find(
              scene => scene.sceneId === authoredId
            )!
          };
        }
        const registry = await repository.getAggregate(
          campaignId,
          "world.place-registry",
          DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1
        );
        if (!registry.ok) return registry;
        const places =
          registry.value.payload.places as Array<{
            placeRef: string;
            arrivalSceneId: string;
          }>;
        const place = places.find(
          candidate => candidate.placeRef === destinationRef
        );
        if (!place) return {
          ok: false as const,
          error: coreError(
            "NOT_FOUND",
            "narrative.scene-catalog.destination-not-found",
            { destinationRef }
          )
        };
        const resolved = await resolveSceneById(place.arrivalSceneId);
        return resolved.ok
          ? { ok: true as const, value: resolved.value.scene }
          : resolved;
      }
    });
    // Charge le catalogue réellement issu du créateur au niveau de la
    // composition. Il sera consommé par la commande de progression quand un
    // award committé et ses choix seront présentés.
    currentCharacterProgressionCatalogV1();
    const availabilityReader = createCommittedCampaignFeatureReaderV1({
      repository,
      campaignId,
      async resolveSceneLocationRef(scene) {
        const authored =
          archivePilot.locationRefBySceneId.get(scene.sceneId);
        if (authored !== undefined) return authored;
        const registry = await repository.getAggregate(
          campaignId,
          "world.place-registry",
          DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1
        );
        if (!registry.ok) return null;
        const places = registry.value.payload.places as Array<{
          placeRef: string;
          arrivalSceneId: string;
        }>;
        return places.find(
          place => place.arrivalSceneId === scene.sceneId
        )?.placeRef ?? null;
      }
    });
    const [campaign, installedContent] = await Promise.all([
      repository.getCampaign(campaignId),
      createInstalledContentPackageResolverV1().resolve(
        INSTALLED_CONTENT_PACKAGE_ID_V1,
        INSTALLED_CONTENT_PACKAGE_VERSION_V1
      )
    ]);
    if (!campaign.ok) throw new Error(campaign.error.messageKey);
    if (installedContent === null) {
      throw new Error("campaign.installed-content-package-missing");
    }
    const bastionTacticalRuntimeFactory =
      createInstalledBastionTacticalRuntimeFactoryV1({
        repository,
        campaignId,
        campaign: campaign.value,
        content: installedContent
      });
    const controller = new NarrativeTurnControllerV1({
      repository,
      campaignId,
      clock,
      idPrefix: `nar:${campaignId}`,
      runtimeBindings,
      intentInterpreterConfig:
        mode === "openai" ? buildOpenAiIntentInterpreterConfigV1() : null,
      mjPlannerConfig:
        mode === "openai" ? buildOpenAiMjPlannerConfigV1() : undefined,
      npcPerformerConfig:
        mode === "openai" ? buildOpenAiNpcPerformerConfigV1() : null,
      interpreterCharacterContextResolver:
        createInterpreterCharacterContextResolverV1(
          buildInstalledInterpreterCharacterReferenceCatalogV1()
        ),
      sceneTransitionRuntime,
      dynamicPlaceRuntime: mode === "openai"
        ? createCampaignLoreGuidedDynamicPlaceRuntimeV1({
            runtimeBindings,
            resolveLorePacket: sceneId =>
              archivePilot.lorePacketBySceneId.get(sceneId) ?? null,
            resolveAuthoredSceneLocationRef: sceneId =>
              archivePilot.locationRefBySceneId.get(sceneId) ?? null,
            knownAuthoredSceneIds:
              archivePilot.scenes.map(scene => scene.sceneId),
            knownAuthoredPlaces: archivePilot.authoredPlaces,
            generatorConfig: buildOpenAiSceneCreatorConfigV2()
          })
        : null,
      restRuntime: createCommittedBastionRestRuntimeV1({
        availabilityReader
      }),
      worldSceneLocationResolver: {
        async resolveLocationRefs(scene) {
          const authored =
            archivePilot.authoredSceneSourceBySceneId.get(scene.sceneId);
          if (authored === undefined) {
            const locationRef =
              archivePilot.locationRefBySceneId.get(scene.sceneId);
            return locationRef === undefined
              ? []
              : [locationRef, `place:${locationRef.slice("location:".length)}`];
          }
          const entityTypeById = new Map(
            archivePilot.entities.map(entity =>
              [entity.entityId, entity.entityType] as const
            )
          );
          const ids = [
            authored.entity.entityId,
            ...authored.packet.geographicChain
          ];
          return [...new Set(ids.flatMap(entityId => {
            const refKind = worldSimulationRefKindV1(
              entityTypeById.get(entityId)
            );
            return [
              `location:${entityId}`,
              ...(refKind === null ? [] : [`${refKind}:${entityId}`])
            ];
          }))];
        }
      },
      bastionTacticalRuntimeFactory,
      activeSceneResolver
    });
    const opening = await controller.resolveActiveScene();
    if (!opening.ok) throw new Error(opening.error.messageKey);
    return {
      controller,
      openingScene: opening.value,
      worldSimulationRuntime,
      readCommittedAvailability: scene =>
        availabilityReader.read(scene)
    };
  } catch (error) {
    repository.close();
    throw error;
  }
}

function worldSimulationRefKindV1(entityType: string | undefined):
"city" | "district" | "region" | "place" | null {
  switch (entityType) {
    case "ville": return "city";
    case "quartier": return "district";
    case "region": return "region";
    case "batiment":
    case "lieu": return "place";
    default: return null;
  }
}

async function bootstrapNewCampaignV1(input: {
  repository: IndexedDbCampaignRepository;
  campaignId: CampaignId;
  sheet: ActiveCharacterSheetV1;
  clock: RepositoryClock;
}): Promise<void> {
  const envelope = readOrCreateBootstrapEnvelopeV1(
    input.campaignId,
    input.sheet,
    input.clock
  );
  const service = new CampaignBootstrapServiceV1(
    createInstalledContentPackageResolverV1(),
    createInstalledRulesetResolverV1(),
    input.repository
  );
  const result = await service.bootstrap({
    schemaVersion: 1,
    ids: envelope.ids,
    contentPackageId: INSTALLED_CONTENT_PACKAGE_ID_V1,
    contentPackageVersion: INSTALLED_CONTENT_PACKAGE_VERSION_V1,
    rulesetId: INSTALLED_RULESET_ID_V1,
    rulesetVersion: INSTALLED_RULESET_VERSION_V1,
    calendarId: "calendar.astryade",
    calendarVersion: 1,
    initialLocationId: INITIAL_LOCATION_ID_V1,
    character: input.sheet.envelope,
    requestedAt: envelope.requestedAt
  });
  if (!result.ok) {
    throw new PlayableCampaignBootstrapErrorV1(result.diagnostics);
  }
  const presented = await input.repository.completePresentation(
    envelope.ids.operationId,
    "COMMITTED_RENDERED",
    1,
    { schemaVersion: 1, status: "BOOTSTRAPPED" }
  );
  if (!presented.ok) throw new Error(presented.error.messageKey);
}

function readOrCreateBootstrapEnvelopeV1(
  campaignId: CampaignId,
  sheet: ActiveCharacterSheetV1,
  clock: RepositoryClock
): StoredBootstrapEnvelopeV1 {
  const storage = window.localStorage;
  let records: Record<string, StoredBootstrapEnvelopeV1> = {};
  const raw = storage.getItem(BOOTSTRAP_ENVELOPES_STORAGE_KEY_V1);
  if (raw !== null) {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      records = parsed as Record<string, StoredBootstrapEnvelopeV1>;
    }
  }
  const existing = records[campaignId];
  if (
    existing?.schemaVersion === 1
    && existing.campaignId === campaignId
  ) return existing;
  const token = campaignId.replace(/^cmp-player-/, "");
  const ids = bootstrapIdsV1(campaignId, sheet, token);
  const created: StoredBootstrapEnvelopeV1 = {
    schemaVersion: 1,
    campaignId,
    requestedAt: clock.now().toISOString(),
    ids
  };
  records[campaignId] = created;
  storage.setItem(
    BOOTSTRAP_ENVELOPES_STORAGE_KEY_V1,
    JSON.stringify(records)
  );
  return created;
}

async function campaignIdForSheetV1(
  sheet: ActiveCharacterSheetV1
): Promise<CampaignId> {
  const fingerprint = await computeJsonFingerprint({
    schemaVersion: 1,
    sheetId: sheet.sheetId,
    sheetUpdatedAt: sheet.updatedAt,
    sourceFingerprint: sheet.sourceFingerprint,
    contentPackageId: INSTALLED_CONTENT_PACKAGE_ID_V1,
    contentPackageVersion: INSTALLED_CONTENT_PACKAGE_VERSION_V1,
    rulesetId: INSTALLED_RULESET_ID_V1,
    rulesetVersion: INSTALLED_RULESET_VERSION_V1
  } satisfies JsonObject);
  return opaqueId<CampaignId>(
    `cmp-player-${fingerprint.replace(/^sha256:/, "").slice(0, 32)}`
  );
}

function bootstrapIdsV1(
  campaignId: CampaignId,
  sheet: ActiveCharacterSheetV1,
  token: string
): CampaignBootstrapIdsV1 {
  const characterToken =
    sheet.sourceFingerprint.replace(/^sha256:/, "").slice(0, 16);
  return {
    campaignId,
    operationId: opaqueId(`op-bootstrap-${token}`),
    clientRequestId: opaqueId(`req-bootstrap-${token}`),
    idempotencyKey: opaqueId(`idem-bootstrap-${token}`),
    commitId: opaqueId(`commit-bootstrap-${token}`),
    eventId: opaqueId(`event-bootstrap-${token}`),
    clockAggregateId: opaqueId(`agg-clock-${token}`),
    characterAggregateId:
      opaqueId(`agg-character-${characterToken}`),
    tacticalProjectionAggregateId:
      opaqueId(`agg-tactical-${characterToken}`),
    narrativeProjectionAggregateId:
      opaqueId(`agg-narrative-${characterToken}`),
    positionAggregateId: opaqueId(`agg-position-${token}`),
    bootstrapContextAggregateId:
      opaqueId(`agg-bootstrap-context-${token}`)
  };
}

function runtimeBindingsForCampaignV1(
  campaignId: CampaignId
): CampaignRuntimeBindingsV1 {
  const token = campaignId.replace(/^cmp-player-/, "");
  return {
    schemaVersion: 1,
    contractVersion: CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
    positionAggregateId: opaqueId<AggregateId>(`agg-position-${token}`),
    sceneLifecycleAggregateId:
      opaqueId<AggregateId>(`agg-scene-lifecycle-${token}`),
    scheduleAggregateId: opaqueId<AggregateId>(`agg-schedule-${token}`),
    simulationCursorAggregateId:
      opaqueId<AggregateId>(`agg-simulation-cursor-${token}`),
    processAggregateId: opaqueId<AggregateId>(`agg-process-${token}`),
    version: 1
  };
}

function characterDiagnostic(
  value: CharacterImportDiagnosticV1
): PlayableCampaignInspectionV1["diagnostics"][number] {
  if (value.code === "CHARACTER_EQUIPMENT_SLOT_MISMATCH") {
    const slot =
      typeof value.details.slot === "string" ? value.details.slot : "inconnu";
    const itemId =
      typeof value.details.itemId === "string" ? value.details.itemId : "inconnu";
    return {
      severity: value.severity,
      code: value.code,
      message:
        `L’objet « ${itemId} » indique l’emplacement « ${slot} », `
        + "mais cet emplacement référence un autre objet dans la fiche."
    };
  }
  return {
    severity: value.severity,
    code: value.code,
    message: `${value.code} — ${value.path}`
  };
}

export class PlayableCampaignBootstrapErrorV1 extends Error {
  constructor(readonly diagnostics: CampaignBootstrapDiagnosticV1[]) {
    super(diagnostics.map(value => `${value.code} (${value.path})`).join(", "));
    this.name = "PlayableCampaignBootstrapErrorV1";
  }
}
