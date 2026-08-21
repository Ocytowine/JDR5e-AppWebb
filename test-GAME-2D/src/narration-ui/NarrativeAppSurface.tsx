import { useEffect, useMemo, useState } from "react";
import {
  buildReferenceSceneLocalNarrationV1,
  buildCampaignProjectedPlayableLoreSceneV1,
  buildVisiblePopulationNarrationV1,
  applyNarrativePresentationVariationV1,
  createBrowserPersistentNarrativeTurnControllerV1,
  createInterpreterCharacterContextResolverV1,
  createNarrativeRestRuntimeV1,
  createPrototypeNarrativeTurnControllerV1,
  enhanceNarrativeDisplayWithAiV1,
  isImmediateVisibleOrientationResolutionV1,
  PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1,
  DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1,
  ensureDynamicPlaceCreationStateV1,
  createCampaignLoreGuidedDynamicPlaceRuntimeV1,
  createCatalogSceneTransitionRuntimeV1,
  resolveSceneV1,
  narrativeDesignationOfV1,
  narrativeFirstMentionV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type AiNarrativeEnhancementResultV1,
  type AiIntentInterpreterConfigV1,
  type NpcPerformerConfigV1,
  type NarrativeTurnControllerV1,
  type TacticalOutcomeIntegrationResultV1,
  type PendingNarrativeSkillCheckV1,
  type PlayableSceneStateV1,
  type BastionTacticalSessionV1,
  isAccessTacticalSessionSummaryV1,
  type CampaignWorldSimulationRuntimeV1,
  type CampaignWorldSimulationSnapshotV1,
  type CampaignWorldSimulationAdvanceResultV1
} from "../../narration-module/src/application";
import type {
  ProcessCheckpointV1,
  RestProcessStateV1,
  TacticalOutcomeV1
} from "../../narration-module/src/handoff";
import { FakeContractAiProviderV1 } from "../../narration-module/src/ai/FakeContractAiProvider";
import type {
  CampaignId,
  CampaignRepository,
  CoreError,
  JsonObject,
  Result
} from "../../narration-module/src/core";
import type { AiModelRouteV1, AiRetryPolicyV1 } from "../../narration-module/src/ai/types";
import type { AiCallTelemetryV1 } from "../../narration-module/src/ai/types";
import type { NarrativeTurnControllerOutputV1 } from "../../narration-module/src/application";
import type { DisplayPacketV1 } from "../../narration-module/src/scene";
import { SCENE_SOCIAL_UI_CONTRACT_VERSION_V1 } from "../../narration-module/src/scene";
import {
  NarrativeConversationPanel,
  createNarrativeClientRequestId,
  type NarrativeSubmitPayloadV1
} from "../ui/NarrativeConversationPanel";
import {
  buildOpenAiIntentInterpreterConfigV1,
  buildOpenAiMjPlannerConfigV1,
  buildOpenAiNpcPerformerConfigV1,
  buildOpenAiSceneCreatorConfigV2,
  buildOpenAiDestinationPlausibilityArbiterConfigV1
} from "./openAiNarrativeRuntimeConfig";
import { ServerOpenAiEnhancementProviderV1 } from "./serverOpenAiEnhancementClient";
import type {
  CommittedCampaignFeatureAvailabilityV1
} from "./campaignFeatureComposition";
import { buildInstalledInterpreterCharacterReferenceCatalogV1 } from
  "./interpreterCharacterContextCatalog";

export type NarrativeEnhancementMode = "local" | "openai";
let systemErrorSequence = 0;

export interface NarrativeAppSurfaceBootstrapV1 {
  controller: NarrativeTurnControllerV1;
  openingScene: PlayableSceneStateV1;
  worldSimulationRuntime?: CampaignWorldSimulationRuntimeV1;
  readCommittedAvailability?: (
    scene: PlayableSceneStateV1
  ) => Promise<CommittedCampaignFeatureAvailabilityV1>;
}

export interface NarrativeWorldSimulationBridgeV1 {
  restore(): Promise<Result<CampaignWorldSimulationSnapshotV1>>;
  advance(input: {
    clientRequestId: string;
    hours: number;
  }): Promise<Result<CampaignWorldSimulationAdvanceResultV1>>;
}

export interface NarrativeTacticalCheckpointBridgeV1 {
  saveCheckpoint(input: {
    processId: string;
    clientRequestId: string;
    lastAppliedTurnId: string;
    ownerState: JsonObject;
  }): Promise<Result<ProcessCheckpointV1>>;
  recordPendingOutcome(input: {
    clientRequestId: string;
    outcome: TacticalOutcomeV1;
  }): Promise<Result<TacticalOutcomeV1>>;
  integratePendingOutcome(input: {
    processId: string;
    clientRequestId: string;
  }): Promise<Result<TacticalOutcomeIntegrationResultV1>>;
}

export function NarrativeAppSurface(props: {
  bootstrapController?: (
    mode?: NarrativeEnhancementMode
  ) => Promise<NarrativeAppSurfaceBootstrapV1>;
  onTacticalHandoffChange?: (session: BastionTacticalSessionV1 | null) => void;
  onOpenTacticalHandoff?: (session: BastionTacticalSessionV1) => void;
  onTacticalCheckpointBridgeChange?: (
    bridge: NarrativeTacticalCheckpointBridgeV1
  ) => void;
  onWorldSimulationBridgeChange?: (
    bridge: NarrativeWorldSimulationBridgeV1
  ) => void;
} = {}) {
  const [controller, setController] = useState<NarrativeTurnControllerV1 | null>(null);
  const [packetsFromController, setPacketsFromController] = useState<DisplayPacketV1[]>([]);
  const [pending, setPending] = useState(false);
  const [pendingSkillCheck, setPendingSkillCheck] = useState<PendingNarrativeSkillCheckV1 | null>(null);
  const [rollingSkillCheck, setRollingSkillCheck] = useState(false);
  const [activeRestProcess, setActiveRestProcess] = useState<RestProcessStateV1 | null>(null);
  const [activeTacticalSession, setActiveTacticalSession] =
    useState<BastionTacticalSessionV1 | null>(null);
  const [advancingRest, setAdvancingRest] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enhancementMode, setEnhancementMode] = useState<NarrativeEnhancementMode>("local");
  const [openingScene, setOpeningScene] = useState<PlayableSceneStateV1 | null>(null);
  const [currentScene, setCurrentScene] = useState<PlayableSceneStateV1 | null>(null);
  const [committedAvailability, setCommittedAvailability] =
    useState<CommittedCampaignFeatureAvailabilityV1 | null>(null);
  const [readCommittedAvailability, setReadCommittedAvailability] =
    useState<NarrativeAppSurfaceBootstrapV1[
      "readCommittedAvailability"
    ]>(undefined);
  const modeStatus = enhancementMode === "openai"
    ? "Mode OpenAI actif. Un fallback local reste disponible si une sortie distante est inutilisable."
    : "Mode local actif pour l'interprétation et l'enrichissement.";
  const packets = useMemo(
    () => [createWelcomePacket(openingScene ?? REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1), ...packetsFromController],
    [openingScene, packetsFromController]
  );

  useEffect(() => {
    let cancelled = false;
    setController(null);
    setPendingSkillCheck(null);
    setActiveRestProcess(null);
    setActiveTacticalSession(null);
    setCommittedAvailability(null);
    setReadCommittedAvailability(undefined);
    setOpeningScene(null);
    setCurrentScene(null);
    const activateController = async (nextController: NarrativeTurnControllerV1, refreshOpening = false) => {
      const [
        restored,
        restoredPending,
        restoredSkillResults,
        restoredRest,
        restoredTactical,
        activeScene
      ] = await Promise.all([
        nextController.restoreRenderedThread(),
        nextController.restorePendingSkillCheck(),
        nextController.restoreSkillCheckResultPackets(),
        nextController.restoreActiveRest(),
        nextController.restoreActiveBastionTacticalSession(),
        refreshOpening ? nextController.resolveActiveScene() : Promise.resolve(null)
      ]);
      let renderedThread = restored;
      let tacticalSession = restoredTactical;
      let automaticBoundaries = null as Awaited<
        ReturnType<NarrativeTurnControllerV1["processAutomaticBoundaries"]>
      > | null;
      if (
        tacticalSession.ok
        && tacticalSession.value?.status ===
          "COMPLETED_PENDING_INTEGRATION"
      ) {
        const integrated =
          await nextController.integratePendingTacticalOutcome({
            schemaVersion: 1,
            processId: tacticalSession.value.process.processId,
            clientRequestId:
              `restore-integrate:${tacticalSession.value.process.processId}`
          });
        if (integrated.ok) {
          automaticBoundaries =
            await nextController.processAutomaticBoundaries({
              schemaVersion: 1,
              sourceOperationId:
                `tactical-integration:${tacticalSession.value.process.processId}`,
              sourceKind: "TACTICAL_INTEGRATION",
              commitApplied: true,
              timeAdvanced: integrated.value.elapsedGameSeconds > 0,
              sceneEntry: false,
              causalChange: true
            });
          [renderedThread, tacticalSession] = await Promise.all([
            nextController.restoreRenderedThread(),
            nextController.restoreActiveBastionTacticalSession()
          ]);
        } else {
          reportCoreError(
            integrated.error,
            "Intégration de la défense tactique terminée"
          );
        }
      }
      automaticBoundaries ??=
        await nextController.processAutomaticBoundaries({
          schemaVersion: 1,
          sourceOperationId: "campaign-activation:active-scene",
          sourceKind: "CAMPAIGN_ACTIVATION",
          commitApplied: true,
          timeAdvanced: false,
          sceneEntry: true,
          causalChange: true
        });
      if (cancelled) return;
      if (renderedThread.ok) {
        setPacketsFromController(mergeDisplayPacketsV1([
          ...renderedThread.value.displayPackets,
          ...(restoredSkillResults.ok ? restoredSkillResults.value : []),
          ...(automaticBoundaries.ok
            ? automaticBoundaries.value.displayPackets
            : [])
        ]));
      } else {
        reportCoreError(renderedThread.error, "Restauration du fil");
      }
      if (!automaticBoundaries.ok) {
        reportCoreError(
          automaticBoundaries.error,
          "Réactions automatiques à la reprise de la campagne"
        );
      }
      if (restoredPending.ok) setPendingSkillCheck(restoredPending.value);
      else reportCoreError(restoredPending.error, "Restauration du jet en attente");
      if (!restoredSkillResults.ok) reportCoreError(restoredSkillResults.error, "Restauration des résultats de dés");
      if (restoredRest.ok) setActiveRestProcess(restoredRest.value);
      else reportCoreError(restoredRest.error, "Restauration du repos");
      if (tacticalSession.ok) {
        setActiveTacticalSession(tacticalSession.value);
        props.onTacticalHandoffChange?.(tacticalSession.value);
      } else {
        reportCoreError(tacticalSession.error, "Restauration de la défense tactique");
      }
      if (activeScene?.ok) {
        setOpeningScene(activeScene.value);
        setCurrentScene(activeScene.value);
      }
      else if (activeScene !== null) reportCoreError(activeScene.error, "Projection de la scène active");
      setController(nextController);
      props.onTacticalCheckpointBridgeChange?.({
        saveCheckpoint: input => nextController.saveTacticalCheckpoint({
          schemaVersion: 1,
          ...input
        }),
        recordPendingOutcome: input =>
          nextController.recordPendingTacticalOutcome({
            schemaVersion: 1,
            ...input
          }),
        integratePendingOutcome: async input => {
          const integrated = await nextController.integratePendingTacticalOutcome({
            schemaVersion: 1,
            ...input
          });
          if (!integrated.ok) return integrated;
          const boundaries = await nextController.processAutomaticBoundaries({
            schemaVersion: 1,
            sourceOperationId: `tactical-integration:${input.processId}`,
            sourceKind: "TACTICAL_INTEGRATION",
            commitApplied: true,
            timeAdvanced: integrated.value.elapsedGameSeconds > 0,
            sceneEntry: false,
            causalChange: true
          });
          if (!boundaries.ok) {
            reportPostCommitError(
              boundaries.error,
              "Réactions automatiques après la séquence tactique",
              `tactical-integration:${input.processId}`
            );
          }
          const [thread, session] = await Promise.all([
            nextController.restoreRenderedThread(),
            nextController.restoreActiveBastionTacticalSession()
          ]);
          if (!cancelled) {
            if (thread.ok) {
              setPacketsFromController(previous => mergeDisplayPacketsV1([
                ...previous,
                ...thread.value.displayPackets,
                ...(boundaries.ok ? boundaries.value.displayPackets : [])
              ]));
            } else {
              reportPostCommitError(
                thread.error,
                "Restauration du récit après la séquence tactique",
                `tactical-integration:${input.processId}`
              );
            }
            if (session.ok) {
              setActiveTacticalSession(session.value);
              props.onTacticalHandoffChange?.(session.value);
            } else {
              reportPostCommitError(
                session.error,
                "Restauration de l'état tactique intégré",
                `tactical-integration:${input.processId}`
              );
            }
          }
          return integrated;
        }
      });
    };
    if (props.bootstrapController !== undefined) {
      void props.bootstrapController(enhancementMode).then(result => {
        if (!cancelled) {
          setOpeningScene(result.openingScene);
          setCurrentScene(result.openingScene);
          setReadCommittedAvailability(
            () => result.readCommittedAvailability
          );
          if (result.readCommittedAvailability !== undefined) {
            void result.readCommittedAvailability(result.openingScene)
              .then(value => {
                if (!cancelled) setCommittedAvailability(value);
              })
              .catch(error => {
                if (!cancelled) {
                  reportUnexpectedError(
                    error,
                    "Lecture des disponibilités de campagne"
                  );
                }
              });
          }
          if (result.worldSimulationRuntime !== undefined) {
            props.onWorldSimulationBridgeChange?.({
              restore: () =>
                result.worldSimulationRuntime!.ensureInitialized(),
              async advance(input) {
                const advanced =
                  await result.worldSimulationRuntime!.advance(input);
                if (!advanced.ok) return advanced;
                const boundaries = await result.controller
                  .processAutomaticBoundaries({
                    schemaVersion: 1,
                    sourceOperationId: advanced.value.sourceOperationId,
                    sourceKind: "WORLD_TIME_ADVANCE",
                    commitApplied: true,
                    timeAdvanced: true,
                    sceneEntry: false,
                    causalChange: true,
                    bastionCauses: [{
                      schemaVersion: 1,
                      sourceEventId: advanced.value.sourceEventId
                    }]
                  });
                if (!boundaries.ok) return boundaries;
                const tactical = await result.controller
                  .restoreActiveBastionTacticalSession();
                if (!tactical.ok) return tactical;
                if (!cancelled) {
                  setPacketsFromController(previous =>
                    mergeDisplayPacketsV1([
                      ...previous,
                      ...boundaries.value.displayPackets
                    ])
                  );
                  setActiveTacticalSession(tactical.value);
                  props.onTacticalHandoffChange?.(tactical.value);
                }
                return advanced;
              }
            });
          }
        }
        return activateController(result.controller);
      }).catch(error => {
        if (!cancelled) reportUnexpectedError(error, "Initialisation du contrôleur");
      });
      return () => {
        cancelled = true;
      };
    }
    const intentInterpreterConfig = buildIntentInterpreterConfig(enhancementMode);
    const mjPlannerConfig = enhancementMode === "openai"
      ? buildOpenAiMjPlannerConfigV1()
      : undefined;
    const npcPerformerConfig = buildNpcPerformerConfig(enhancementMode);
    void import("./archiveLorePilot").then(module => module.buildArchiveLorePilotV1()).then(async archivePilot => {
      const resolveSceneById = async (repository: CampaignRepository, campaignId: CampaignId, sceneId: string) => {
        const authoredSource = archivePilot.authoredSceneSourceBySceneId.get(sceneId);
        let authoredScene = archivePilot.scenes.find(scene => scene.sceneId === sceneId) ?? null;
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
          sources: [{ sourceKind: "WIKI" as const, resolve: candidate => candidate === sceneId ? authoredScene : null }],
          dynamicCatalog: { repository, campaignId, placeRegistryAggregateId: DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1, topologyAggregateId: DYNAMIC_PLACE_TOPOLOGY_AGGREGATE_ID_V1, factRegistryAggregateId: DYNAMIC_PLACE_FACTS_AGGREGATE_ID_V1 }
        });
      };
      const activeSceneResolver = { async resolve(input: { repository: CampaignRepository; campaignId: CampaignId }) {
        const lifecycle = await input.repository.getAggregate(input.campaignId, "scene.lifecycle", PROTOTYPE_SCENE_LIFECYCLE_AGGREGATE_ID_V1);
        if (!lifecycle.ok) return lifecycle;
        const resolved = await resolveSceneById(input.repository, input.campaignId, String(lifecycle.value.payload.activeSceneId));
        return resolved.ok ? { ok: true as const, value: resolved.value.scene } : resolved;
      } };
      setOpeningScene(archivePilot.scene);
      setCurrentScene(archivePilot.scene);
      const dynamicPlaceRuntime = enhancementMode === "openai" ? createCampaignLoreGuidedDynamicPlaceRuntimeV1({
        resolveLorePacket: sceneId => archivePilot.lorePacketBySceneId.get(sceneId) ?? null,
        resolveLorePacketByAnchor: anchorEntityId => archivePilot.packetByEntityId.get(anchorEntityId) ?? null,
        resolveAuthoredSceneLocationRef: sceneId => archivePilot.locationRefBySceneId.get(sceneId) ?? null,
        knownAuthoredSceneIds: archivePilot.scenes.map(scene => scene.sceneId),
        knownAuthoredPlaces: archivePilot.authoredPlaces,
        generatorConfig: buildOpenAiSceneCreatorConfigV2(),
        destinationArbiterConfig: buildOpenAiDestinationPlausibilityArbiterConfigV1()
      }) : null;
      const sceneTransitionRuntime = createCatalogSceneTransitionRuntimeV1({
        async resolveSource(sceneId, context) {
          const resolved = await resolveSceneById(context.repository, context.campaignId as CampaignId, sceneId);
          return resolved.ok ? { ok: true as const, value: resolved.value.scene } : resolved;
        },
        async resolveDestination(destinationRef, context) {
        const authoredId = destinationRef.startsWith("location:") ? `wiki-location:${destinationRef.slice("location:".length)}` : null;
        if (authoredId !== null && archivePilot.scenes.some(scene => scene.sceneId === authoredId)) {
          return { ok: true as const, value: archivePilot.scenes.find(scene => scene.sceneId === authoredId)! };
        }
        const registry = await context.repository.getAggregate(context.campaignId as CampaignId, "world.place-registry", DYNAMIC_PLACE_REGISTRY_AGGREGATE_ID_V1);
        if (!registry.ok) return registry;
        const place = (registry.value.payload.places as Array<{ placeRef: string; arrivalSceneId: string }>).find(candidate => candidate.placeRef === destinationRef);
        if (!place) return { ok: false as const, error: { code: "NOT_FOUND" as const, category: "INTEGRITY" as const, retry: "NEVER" as const, messageKey: "narrative.scene-catalog.destination-not-found", details: { destinationRef }, incidentId: null } };
        const resolved = await resolveSceneById(context.repository, context.campaignId as CampaignId, place.arrivalSceneId);
        return resolved.ok ? { ok: true as const, value: resolved.value.scene } : resolved;
        }
      });
      const restRuntime = createArchivesRestRuntime();
      const interpreterCharacterContextResolver =
        createInterpreterCharacterContextResolverV1(
          buildInstalledInterpreterCharacterReferenceCatalogV1()
        );
      return createBrowserPersistentNarrativeTurnControllerV1({
        databaseName: "jdr5e-narration-archives-pilot-v4",
        intentInterpreterConfig,
        mjPlannerConfig,
        npcPerformerConfig,
        interpreterCharacterContextResolver,
        sceneTransitionRuntime,
        dynamicPlaceRuntime,
        restRuntime,
        initialScene: {
          scene: archivePilot.scene,
          locationRef: archivePilot.locationRef
        },
        activeSceneResolver,
        initializeRepository: (repository, campaignId, clock) =>
          ensureDynamicPlaceCreationStateV1({
            repository,
            campaignId,
            clock,
            topology: archivePilot.topology
          })
      });
    }).then(controller => activateController(controller, true)).catch(error => {
      void import("./archiveLorePilot").then(module => module.buildArchiveLorePilotV1()).then(archivePilot => {
        setOpeningScene(archivePilot.scene);
        setCurrentScene(archivePilot.scene);
        return createPrototypeNarrativeTurnControllerV1({
          intentInterpreterConfig,
          mjPlannerConfig,
          npcPerformerConfig,
          interpreterCharacterContextResolver:
            createInterpreterCharacterContextResolverV1(
              buildInstalledInterpreterCharacterReferenceCatalogV1()
            ),
          restRuntime: createArchivesRestRuntime(),
          initialScene: {
            scene: archivePilot.scene,
            locationRef: archivePilot.locationRef
          },
          initializeRepository: (repository, campaignId, clock) =>
            ensureDynamicPlaceCreationStateV1({
              repository,
              campaignId,
              clock,
              topology: archivePilot.topology
            }),
          activeSceneResolver: {
            async resolve() {
              return { ok: true as const, value: archivePilot.scene };
            }
          }
        });
      }).then(controller => activateController(controller, true)).catch(fallbackError => {
        if (!cancelled) {
          const primary = error instanceof Error ? error.message : String(error);
          const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          reportUnexpectedError(new Error(`${primary}; fallback mémoire indisponible: ${fallback}`), "Initialisation de la narration");
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [enhancementMode, props.bootstrapController]);

  function handleSubmit(payload: NarrativeSubmitPayloadV1) {
    if (!controller) {
      reportUnexpectedError(new Error("controller unavailable"), "Envoi de l'action");
      return;
    }
    const submittedAt = performance.now();
    setPending(true);
    setErrorMessage(null);
    void controller.submit(payload).then(async result => {
      if (!result.ok) {
        setErrorMessage(narrativeErrorGuidance(result.error).summary);
        setPacketsFromController(previous => [...previous, createRuntimeFailurePacket({
          error: result.error,
          operationId: payload.clientRequestId,
          sceneId: currentScene?.sceneId ?? openingScene?.sceneId ?? "unknown-scene",
          context: "Résolution de l'action",
          rawInput: payload.rawInput
        })]);
        return;
      }
      const controllerFinishedAt = performance.now();
      setPendingSkillCheck(result.value.output.pendingSkillCheck);
      if ("activeRestProcess" in result.value.output) {
        setActiveRestProcess((result.value.output as typeof result.value.output & {
          activeRestProcess: RestProcessStateV1 | null;
        }).activeRestProcess);
      }
      const enhancement = await enhancePrototypePacket(
        result.value.operation.campaignId,
        result.value.output,
        enhancementMode,
        packetsFromController
      );
      const enhancementFinishedAt = performance.now();
      const orchestrationStatus = [
        result.value.output.mjPlannerFailure === null
          ? null
          : `Plan MJ distant indisponible ou rejeté : plan local déterministe utilisé. Motif: ${result.value.output.mjPlannerFailure.issues.join(" | ") || "sortie inutilisable"}.`,
        result.value.output.npcPerformanceFailure === null
          ? null
          : `Réaction PNJ IA indisponible ou rejetée : réaction locale bornée conservée. Motif: ${result.value.output.npcPerformanceFailure.issues.join(" | ") || "sortie inutilisable"}.`
      ].filter((message): message is string => message !== null).join(" ");
      const statusMessage = orchestrationStatus.length === 0
        ? enhancement.status
        : `${orchestrationStatus} ${enhancement.status}`;
      const turnDiagnostics = [
        ...(enhancement.attemptedEnhancement !== null &&
          (enhancement.attemptedEnhancement.incidents.length > 0 || enhancement.attemptedEnhancement.fallbackKind !== "NONE")
          ? [enhancement.status]
          : []),
        ...(isImmediateVisibleOrientationResolutionV1(result.value.output.resolution)
          ? [enhancement.status]
          : [])
      ];
      const packetBeforeProjection = appendNarrativeSystemTrace({
        packet: enhancement.displayPacket,
        output: result.value.output,
        priorPackets: packetsFromController,
        turnDiagnostics,
        enhancementTelemetry: enhancement.finalEnhancement.telemetry ?? [],
        timings: {
          controllerMs: controllerFinishedAt - submittedAt,
          enhancementMs: enhancementFinishedAt - controllerFinishedAt,
          projectionMs: 0,
          totalMs: enhancementFinishedAt - submittedAt
        }
      });
      const recorded = await controller.recordRenderedProjection({
        schemaVersion: 1,
        clientRequestId: result.value.output.clientRequestId,
        sourceOutput: result.value.output,
        mode: enhancementMode,
        finalEnhancement: { ...enhancement.finalEnhancement, displayPacket: packetBeforeProjection },
        attemptedEnhancement: enhancement.attemptedEnhancement,
        statusMessage
      });
      if (!recorded.ok) {
        reportPostCommitError(
          recorded.error,
          "Enregistrement de la narration",
          result.value.output.operationId
        );
        return;
      }
      const projectionFinishedAt = performance.now();
      const enhanced = appendNarrativeSystemTrace({
        packet: enhancement.displayPacket,
        output: result.value.output,
        priorPackets: packetsFromController,
        turnDiagnostics,
        enhancementTelemetry: enhancement.finalEnhancement.telemetry ?? [],
        timings: {
          controllerMs: controllerFinishedAt - submittedAt,
          enhancementMs: enhancementFinishedAt - controllerFinishedAt,
          projectionMs: projectionFinishedAt - enhancementFinishedAt,
          totalMs: projectionFinishedAt - submittedAt
        }
      });
      const automaticBoundaries = result.value.output.sceneArrival === null
        ? null
        : await controller.processAutomaticBoundaries({
            schemaVersion: 1,
            sourceOperationId: result.value.output.operationId,
            sourceKind: "SCENE_TRANSITION",
            commitApplied: !result.value.output.noCommit,
            timeAdvanced: !result.value.output.noGameTime,
            sceneEntry: true,
            causalChange: true
          });
      if (automaticBoundaries !== null && !automaticBoundaries.ok) {
        reportPostCommitError(
          automaticBoundaries.error,
          "Réactions automatiques à l'entrée de scène",
          result.value.output.operationId
        );
      }
      if (result.value.output.sceneArrival !== null) {
        setCurrentScene(result.value.output.sceneArrival.scene);
      }
      const tacticalSession = await controller
        .restoreActiveBastionTacticalSession();
      if (tacticalSession.ok) {
        setActiveTacticalSession(tacticalSession.value);
        props.onTacticalHandoffChange?.(tacticalSession.value);
      } else {
        reportPostCommitError(
          tacticalSession.error,
          "Restauration du handoff tactique",
          result.value.output.operationId
        );
      }
      const availabilityScene =
        result.value.output.sceneArrival?.scene ?? currentScene ?? openingScene;
      if (
        availabilityScene !== null
        && readCommittedAvailability !== undefined
      ) {
        const availability =
          await readCommittedAvailability(availabilityScene);
        setCommittedAvailability(availability);
      }
      setPacketsFromController(prev => mergeDisplayPacketsV1([
        ...prev,
        enhanced,
        ...(automaticBoundaries?.ok
          ? automaticBoundaries.value.displayPackets
          : [])
      ]));
    }).catch(error => {
      reportUnexpectedError(error, "Traitement de l'action", payload.clientRequestId);
    }).finally(() => {
      setPending(false);
    });
  }

  function handleRollSkillCheck(skillCheck: PendingNarrativeSkillCheckV1) {
    if (!controller || rollingSkillCheck) return;
    setRollingSkillCheck(true);
    setPending(true);
    setErrorMessage(null);
    void controller.rollPendingSkillCheck({
      schemaVersion: 1,
      clientRequestId: `nar-ui-roll-${skillCheck.pendingCheckId}`,
      sourceOperationId: skillCheck.sourceOperationId,
      pendingCheckId: skillCheck.pendingCheckId
    }).then(result => {
      if (!result.ok) {
        reportCoreError(result.error, "Lancer du test de compétence", skillCheck.pendingCheckId);
        return;
      }
      setPacketsFromController(previous => previous.some(packet =>
        packet.operationId === result.value.displayPacket.operationId
      ) ? previous : [...previous, result.value.displayPacket]);
      setPendingSkillCheck(null);
    }).catch(error => {
      reportUnexpectedError(error, "Lancer du test de compétence", skillCheck.pendingCheckId);
    }).finally(() => {
      setRollingSkillCheck(false);
      setPending(false);
    });
  }

  function handleAdvanceRest(process: RestProcessStateV1) {
    if (!controller || advancingRest) return;
    setAdvancingRest(true);
    setPending(true);
    setErrorMessage(null);
    const clientRequestId = createNarrativeClientRequestId("nar-ui-rest-segment");
    void controller.advanceRest({
      schemaVersion: 1,
      clientRequestId,
      processId: process.processId
    }).then(async result => {
      if (!result.ok) {
        reportCoreError(result.error, "Avancement du repos", clientRequestId);
        return;
      }
      const output = result.value.output;
      const nextRest = "activeRestProcess" in output
        ? (output as typeof output & { activeRestProcess: RestProcessStateV1 | null }).activeRestProcess
        : null;
      const localProjection: AiNarrativeEnhancementResultV1 = {
        schemaVersion: 1,
        contractVersion: "narrative-ai-resolution/1",
        enhanced: false,
        usedFallback: false,
        fallbackKind: "NONE",
        displayPacket: output.displayPacket,
        incidents: [],
        telemetry: [],
        safetyNotes: ["Projection déterministe du résultat de repos committé."]
      };
      const recorded = await controller.recordRenderedProjection({
        schemaVersion: 1,
        clientRequestId: `${clientRequestId}:render`,
        sourceOutput: output,
        mode: "local",
        finalEnhancement: localProjection,
        attemptedEnhancement: null,
        statusMessage: "Continuation du repos produite depuis le segment committé."
      });
      if (!recorded.ok) {
        reportPostCommitError(
          recorded.error,
          "Enregistrement de la continuation du repos",
          output.operationId
        );
        return;
      }
      const automaticBoundaries = await controller.processAutomaticBoundaries({
        schemaVersion: 1,
        sourceOperationId: output.operationId,
        sourceKind: "REST_SEGMENT",
        commitApplied: !output.noCommit,
        timeAdvanced: !output.noGameTime,
        sceneEntry: false,
        causalChange: true,
        allowSocialInitiative: nextRest !== null
      });
      if (!automaticBoundaries.ok) {
        reportPostCommitError(
          automaticBoundaries.error,
          "Réactions automatiques après le segment de repos",
          output.operationId
        );
      }
      setPacketsFromController(previous => mergeDisplayPacketsV1([
        ...previous,
        output.displayPacket,
        ...(automaticBoundaries.ok
          ? automaticBoundaries.value.displayPackets
          : [])
      ]));
      setActiveRestProcess(nextRest);
      if (
        (currentScene ?? openingScene) !== null
        && readCommittedAvailability !== undefined
      ) {
        setCommittedAvailability(
          await readCommittedAvailability((currentScene ?? openingScene)!)
        );
      }
    }).catch(error => {
      reportUnexpectedError(error, "Avancement du repos", clientRequestId);
    }).finally(() => {
      setAdvancingRest(false);
      setPending(false);
    });
  }

  function reportCoreError(error: CoreError, context: string, operationId = nextSystemErrorOperationId()): void {
    console.error(
      `[Narration] ${context}`,
      `${error.code}:${error.messageKey}`
    );
    const guidance = narrativeErrorGuidance(error);
    setErrorMessage(guidance.summary);
    setPacketsFromController(previous => [...previous, createRuntimeFailurePacket({
      error,
      operationId,
      sceneId: currentScene?.sceneId ?? openingScene?.sceneId ?? "unknown-scene",
      context
    })]);
  }

  function reportPostCommitError(
    error: CoreError,
    context: string,
    sourceOperationId: string
  ): void {
    console.error(
      `[Narration] ${context}`,
      `${error.code}:${error.messageKey}`
    );
    const operationId = nextSystemErrorOperationId();
    setErrorMessage(
      `L'action principale reste confirmée, mais une étape secondaire a échoué : ${context}.`
    );
    setPacketsFromController(previous => [...previous, createRuntimeFailurePacket({
      error,
      operationId,
      sceneId: currentScene?.sceneId ?? openingScene?.sceneId ?? "unknown-scene",
      context,
      sourceOperationId,
      primaryActionCommitted: true
    })]);
  }

  function reportUnexpectedError(error: unknown, context: string, operationId = nextSystemErrorOperationId()): void {
    console.error(`[Narration] ${context}`, error);
    reportCoreError({
      code: "CAMPAIGN_INTEGRITY_FAILURE",
      category: "INTEGRITY",
      retry: "AFTER_REFRESH",
      messageKey: "narrative.ui.unexpected-error",
      details: {},
      incidentId: null
    }, context, operationId);
  }

  return (
    <main
      aria-label="Surface narration"
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "82px 18px 18px",
        background:
          "radial-gradient(circle at 20% 0%, rgba(88,166,255,0.20), transparent 32%), linear-gradient(145deg, #070911, #111522 62%, #070911)"
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 14
        }}
      >
        <section
          aria-label="Statut du module narration"
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(8,10,18,0.72)",
            padding: 14,
            boxShadow: "0 18px 60px rgba(0,0,0,0.30)"
          }}
        >
          <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Narration</h1>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.5 }}>
            Surface dédiée au module narration. Ce prototype affiche des projections typées et remonte la saisie
            libre via le contrôleur applicatif prototype. L'enrichissement IA peut rester local ou passer par la route
            serveur OpenAI opt-in, sans clé navigateur, sans écrire de transcript local et sans dépendre du plateau
            tactique.
          </p>
          <fieldset
            aria-label="Mode IA narrative"
            style={{
              margin: "12px 0 0",
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)"
            }}
          >
            <legend style={{ padding: "0 6px", color: "rgba(255,255,255,0.76)", fontSize: 12 }}>
              IA narrative
            </legend>
            <label style={{ marginRight: 12, fontSize: 13 }}>
              <input
                type="radio"
                name="narrative-ai-mode"
                value="local"
                checked={enhancementMode === "local"}
                onChange={() => setEnhancementMode("local")}
              />{" "}
              Locale
            </label>
            <label style={{ fontSize: 13 }}>
              <input
                type="radio"
                name="narrative-ai-mode"
                value="openai"
                checked={enhancementMode === "openai"}
                onChange={() => setEnhancementMode("openai")}
              />{" "}
              OpenAI
            </label>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.62)", fontSize: 12 }}>
              {modeStatus}
            </p>
          </fieldset>
          {errorMessage && (
            <p role="alert" style={{ margin: "8px 0 0", color: "#ffb4b4", fontSize: 12 }}>
              {errorMessage}
            </p>
          )}
        </section>

        {activeTacticalSession !== null && (
          <section
            aria-label={isAccessTacticalSessionSummaryV1(activeTacticalSession.summary)
              ? "Rencontre tactique en attente"
              : "Défense tactique en attente"}
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255,190,92,0.42)",
              background: "rgba(62,39,12,0.72)",
              padding: 14
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>
              {isAccessTacticalSessionSummaryV1(activeTacticalSession.summary)
                ? "Conflit au seuil"
                : "Défense du bastion"}
            </h2>
            <p style={{ margin: "0 0 10px", color: "rgba(255,255,255,0.82)", fontSize: 13 }}>
              {activeTacticalSession.summary.incidentDisplayName} à{" "}
              {activeTacticalSession.summary.placeDisplayName}.
            </p>
            {activeTacticalSession.status === "READY_FOR_TACTICAL" ? (
              <button
                type="button"
                onClick={() => props.onOpenTacticalHandoff?.(activeTacticalSession)}
                disabled={props.onOpenTacticalHandoff === undefined}
              >
                Ouvrir le plateau tactique
              </button>
            ) : (
              <p role="status" style={{ margin: 0, fontSize: 12 }}>
                Le combat est terminé ; son résultat attend encore l’intégration de campagne.
              </p>
            )}
          </section>
        )}

        {committedAvailability !== null
          && (
            committedAvailability.rest.allowed
            || committedAvailability.progression.length > 0
            || committedAvailability.bastions.length > 0
          ) && (
          <section
            aria-label="Disponibilités de campagne"
            style={{
              borderRadius: 16,
              border: "1px solid rgba(129,196,255,0.28)",
              background: "rgba(18,35,54,0.72)",
              padding: 14
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>
              État de campagne
            </h2>
            {committedAvailability.rest.allowed && (
              <p style={{ margin: "5px 0", fontSize: 13 }}>
                Repos autorisé — {committedAvailability.rest.placeDisplayName}
              </p>
            )}
            {committedAvailability.progression.map(award => (
              <p key={award.awardId} style={{ margin: "5px 0", fontSize: 13 }}>
                Progression en attente
                {award.requiredChoices.length > 0
                  ? ` — choix requis : ${award.requiredChoices.join(", ")}`
                  : ""}
              </p>
            ))}
            {committedAvailability.bastions.map(bastion => (
              <p key={bastion.bastionId} style={{ margin: "5px 0", fontSize: 13 }}>
                Bastion — {bastion.placeDisplayName}
                {bastion.scheduledWorkCount > 0
                  ? ` · ${bastion.scheduledWorkCount} travail en cours`
                  : ""}
                {bastion.activeOccupantCount > 0
                  ? ` · ${bastion.activeOccupantCount} compagnon affecté`
                  : ""}
                {bastion.openIncidentCount > 0
                  ? ` · ${bastion.openIncidentCount} incident actif`
                  : ""}
              </p>
            ))}
          </section>
        )}

        <div
          style={{
            height: activeTacticalSession === null
              ? "calc(100vh - 190px)"
              : "calc(100vh - 310px)",
            minHeight: 420
          }}
        >
          <NarrativeConversationPanel
            packets={packets}
            pending={pending || controller === null}
            title="Fil narratif"
            onSubmit={handleSubmit}
            pendingSkillCheck={pendingSkillCheck}
            rollingSkillCheck={rollingSkillCheck}
            onRollSkillCheck={handleRollSkillCheck}
            activeRestProcess={activeRestProcess}
            advancingRest={advancingRest}
            onAdvanceRest={handleAdvanceRest}
          />
        </div>
      </div>
    </main>
  );
}

function createArchivesRestRuntime() {
  return createNarrativeRestRuntimeV1({
    rules: {
      shortRestDurationSeconds: 3_600,
      longRestDurationSeconds: 28_800,
      segmentSeconds: 3_600
    },
    authorize: ({ scene }) => ({
      allowed: false,
      reason: `Dans ${scene.locationName}, rien ne te permet encore de t’installer assez sûrement pour commencer ce repos.`,
      locationRef: {
        kind: "scene",
        id: scene.sceneId
      },
      safetyProfile: {
        interruptionPercent: 0,
        source: "scene-rest-policy-missing"
      }
    })
  });
}

export function createRuntimeFailurePacket(input: {
  error: CoreError;
  operationId: string;
  sceneId: string;
  context: string;
  rawInput?: string;
  sourceOperationId?: string;
  primaryActionCommitted?: boolean;
}): DisplayPacketV1 {
  const guidance = narrativeErrorGuidance(input.error);
  const incident = input.error.incidentId === null ? "aucun" : input.error.incidentId;
  const validationDetail = safeValidationDetail(input.error);
  const rawInput = input.rawInput?.trim() ?? "";
  const sourceOperationRef = input.sourceOperationId === undefined
    ? null
    : `operation:${input.sourceOperationId}:confirmed`;
  const failureHeading = input.primaryActionCommitted === true
    ? `Action principale confirmée — étape secondaire non exécutée : ${input.context}`
    : `Action non exécutée — ${input.context}`;
  const failureSummary = input.primaryActionCommitted === true
    ? "La mutation principale reste enregistrée. Cette erreur concerne uniquement le traitement secondaire indiqué."
    : guidance.summary;
  return {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: input.operationId,
    sceneId: input.sceneId,
    displayBlocks: [
      ...(rawInput.length === 0 ? [] : [{
        blockId: `${input.operationId}:raw-input`,
        kind: "RAW_INPUT" as const,
        speaker: {
          speakerId: "speaker-player",
          kind: "PLAYER_CHARACTER" as const,
          displayName: "Joueur",
          roleLabel: "Expression joueur",
          ariaLabel: "Expression brute du joueur",
          visualToken: "speaker-player"
        },
        text: rawInput,
        ariaLabel: "Entrée originale du joueur avant l'échec",
        roleLabel: "Expression joueur",
        visualStyleToken: "speaker-player",
        sourceRefs: [`operation:${input.operationId}:raw`],
        isDegradedFallback: false
      }]),
      {
      blockId: `${input.operationId}:runtime-failure`,
      kind: "SYSTEM_NOTICE",
      speaker: { speakerId: "speaker-system", kind: "SYSTEM", displayName: "Système", roleLabel: "Notification système", ariaLabel: "Notification système", visualToken: "speaker-system" },
      text: `${failureHeading}\n${failureSummary}\nAide : ${guidance.action}\nDiagnostic sûr : ${input.error.messageKey}; code=${input.error.code}; catégorie=${input.error.category}; reprise=${input.error.retry}; incident=${incident}.${validationDetail}`,
      ariaLabel: "Notification système: échec runtime diagnostiqué",
      roleLabel: "Notification système",
      visualStyleToken: "speaker-system",
      sourceRefs: [
        `runtime-error:${input.error.messageKey}`,
        ...(sourceOperationRef === null ? [] : [sourceOperationRef])
      ],
      isDegradedFallback: true
    }],
    rawInputAccess: { available: true, operationId: input.operationId },
    rhythmDiagnostics: `runtime failure: ${input.error.messageKey}`,
    reconstructionRefs: [
      `runtime-error:${input.error.messageKey}`,
      ...(sourceOperationRef === null ? [] : [sourceOperationRef])
    ],
    version: 1
  };
}

function safeValidationDetail(error: CoreError): string {
  if (error.messageKey !== "core.validation.failed") return "";
  const issues = error.details.issues;
  if (!Array.isArray(issues)) return "";
  const safeIssues = issues
    .filter((issue): issue is string => typeof issue === "string")
    .map(issue => issue.replaceAll(/[\r\n\t]+/gu, " ").trim().slice(0, 180))
    .filter(Boolean)
    .slice(0, 3);
  return safeIssues.length === 0
    ? ""
    : ` Détail validation : ${safeIssues.join(" | ")}.`;
}

export function narrativeErrorGuidance(error: CoreError): { summary: string; action: string } {
  if (error.code === "IDEMPOTENCY_CONFLICT") {
    return {
      summary: "Cette requête a déjà été utilisée avec un contenu différent.",
      action: "Relancez l'action avec une nouvelle requête, sans réutiliser l'ancien identifiant."
    };
  }
  if (error.code === "STALE_VERSION" || error.code === "STALE_FENCING_TOKEN" || /revision|stale|concurrent/iu.test(error.messageKey)) {
    return {
      summary: "L'état de la campagne a changé pendant l'action ; aucune modification partielle n'a été conservée.",
      action: "Rechargez la scène puis réessayez à partir de l'état actuel."
    };
  }
  if (error.code === "NOT_FOUND" || /not-found|missing/iu.test(error.messageKey)) {
    return {
      summary: "Un élément nécessaire à cette action n'a pas été retrouvé.",
      action: "Vérifiez la cible et l'étape précédente, puis reformulez ou recommencez l'action."
    };
  }
  if (error.category === "PERSISTENCE") {
    return {
      summary: "La sauvegarde de l'action n'a pas pu être confirmée.",
      action: "Évitez de fermer la page, rechargez l'état, puis réessayez une seule fois."
    };
  }
  if (/openai|provider|timeout|fetch/iu.test(error.messageKey)) {
    return {
      summary: "Un service narratif externe n'a pas répondu correctement.",
      action: "Réessayez ou passez en mode local ; aucun fait de campagne n'a été inventé."
    };
  }
  if (error.category === "VALIDATION") {
    return {
      summary: "L'action a été refusée car les informations requises sont absentes ou incohérentes.",
      action: "Vérifiez la cible, les préconditions affichées et reformulez l'intention."
    };
  }
  return {
    summary: "Une erreur technique inattendue a interrompu cette étape.",
    action: "Réessayez une fois. Si le problème persiste, conservez le code diagnostic affiché."
  };
}

function nextSystemErrorOperationId(): string {
  systemErrorSequence += 1;
  return `system-error-${Date.now()}-${systemErrorSequence}`;
}

function mergeDisplayPacketsV1(packets: DisplayPacketV1[]): DisplayPacketV1[] {
  const byOperationId = new Map<string, DisplayPacketV1>();
  for (const packet of packets) byOperationId.set(packet.operationId, packet);
  return [...byOperationId.values()];
}

function appendNarrativeSystemTrace(input: {
  packet: DisplayPacketV1;
  output: NarrativeTurnControllerOutputV1;
  priorPackets: DisplayPacketV1[];
  turnDiagnostics?: string[];
  enhancementTelemetry?: AiCallTelemetryV1[];
  timings: { controllerMs: number; enhancementMs: number; projectionMs: number; totalMs: number };
}): DisplayPacketV1 & JsonObject {
  const resolvedRef = input.output.npcPerformance?.actorId
    ?? input.output.interpretation.referentResolution?.resolvedTarget?.ref
    ?? input.output.interpretation.semanticIntent.target?.ref
    ?? null;
  const actorRef = resolvedRef?.startsWith("npc:") ? resolvedRef : null;
  const actorId = actorRef?.replace(/^npc:/u, "") ?? null;
  const actorDisplayName = actorId === null
    ? null
    : (() => {
      const actor = input.output.activeScene.presentNpc.find(npc => npc.actorId === actorId)
        ?? input.output.activeScene.ambientPopulation?.find(presence => presence.actorId === actorId);
      return actor ? narrativeDesignationOfV1(actor)?.playerFacingLabel ?? actor.displayName : undefined;
    })()
      ?? null;
  const rememberedPlayerIntents = actorId === null
    ? []
    : input.output.sceneState.shortTermNpcMemory
      .filter(memory => memory.actorId === actorId)
      .slice(-5)
      .map(memory => memory.playerIntentSummary);
  const rememberedNpcUtterances = actorDisplayName === null
    ? []
    : input.priorPackets
      .flatMap(packet => packet.displayBlocks)
      .filter(block => block.kind === "NPC_SPEECH" && block.speaker.displayName === actorDisplayName)
      .slice(-5)
      .map(block => block.text);
  const priorPlayerIntents = rememberedPlayerIntents.slice(0, Math.max(0, rememberedPlayerIntents.length - 1));
  const pairedHistory = rememberedNpcUtterances.map((utterance, index) =>
    `${priorPlayerIntents.at(-(rememberedNpcUtterances.length - index)) ?? "intention non retrouvée"} → ${utterance}`
  );
  const performerOutcome = input.output.npcPerformance !== null
    ? "accepté"
    : input.output.npcPerformanceFailure !== null
      ? "rejeté, fallback"
      : "non appelé";
  const stages = input.output.stageTimings;
  const measuredStagesMs = stages === null
    ? 0
    : stages.interpretationMs + stages.planningMs + stages.resolutionMs + stages.npcPerformanceMs;
  const controllerOverheadMs = Math.max(0, input.timings.controllerMs - measuredStagesMs);
  const aiTelemetryLines = input.output.aiTelemetry.map(metric =>
    `IA ${metric.role}: modèle=${metric.modelId}; raisonnement=${metric.reasoningEffort ?? "standard"}; latence=${formatDuration(metric.latencyMs)}; tokens=${metric.inputTokens ?? "?"}+${metric.outputTokens ?? "?"}/${metric.totalTokens ?? "?"}; fin=${metric.finishReason ?? "?"}; budgets=${metric.inputTokenBudget}/${metric.outputTokenBudget}; contexte=${metric.contextChars} caractères; schéma=${metric.schemaChars ?? "?"} caractères.`
  );
  const enhancementTelemetryLines = (input.enhancementTelemetry ?? []).map(metric =>
    `IA enrichissement ${metric.role}: modèle=${metric.modelId}; raisonnement=${metric.reasoningEffort ?? "standard"}; latence=${formatDuration(metric.latencyMs)}; tokens=${metric.inputTokens ?? "?"}+${metric.outputTokens ?? "?"}/${metric.totalTokens ?? "?"}; fin=${metric.finishReason ?? "?"}.`
  );
  const traceLines = [
    ...(input.turnDiagnostics ?? []).map(message => `Diagnostic du tour: ${message}`),
    "Trace système et mémoire",
    `Pipeline PNJ: ${performerOutcome}; acteur=${actorRef ?? "aucun"}; acte=${input.output.interpretation.semanticIntent.dialogueAct?.act ?? "aucun"}.`,
    input.output.npcPerformance?.conversationProfile
      ? `Profil conversationnel éphémère: ${input.output.npcPerformance.conversationProfile.continuitySource === "INITIALIZED" ? "initialisé" : "continué"}; révision=${input.output.npcPerformance.conversationProfile.continuityRevision}; durable=non.`
      : "Profil conversationnel éphémère: aucun profil accepté pour ce tour.",
    `Intentions joueur mémorisées (${rememberedPlayerIntents.length}): ${rememberedPlayerIntents.join(" | ") || "aucune"}.`,
    `Répliques PNJ antérieures visibles (${rememberedNpcUtterances.length}): ${rememberedNpcUtterances.join(" | ") || "aucune"}.`,
    `Couples intention → réponse (${pairedHistory.length}): ${pairedHistory.join(" | ") || "aucun"}.`,
    `Sources déclarées par le performer: ${input.output.npcPerformance?.knowledgeUsed.join(", ") || "aucune"}.`,
    ...(aiTelemetryLines.length > 0 ? aiTelemetryLines : ["Métriques IA fournisseur: indisponibles pour cette opération."]),
    ...(enhancementTelemetryLines.length > 0
      ? enhancementTelemetryLines
      : ["Métriques IA d'enrichissement: aucun appel ou métriques indisponibles."]),
    stages === null
      ? "Détail contrôleur: indisponible pour cette ancienne opération."
      : `Détail contrôleur: interprétation=${formatDuration(stages.interpretationMs)}, planification=${formatDuration(stages.planningMs)}, résolution=${formatDuration(stages.resolutionMs)}, performer PNJ=${formatDuration(stages.npcPerformanceMs)}, orchestration/persistance=${formatDuration(controllerOverheadMs)}.`,
    `Temps: contrôleur=${formatDuration(input.timings.controllerMs)}, enrichissement=${formatDuration(input.timings.enhancementMs)}, persistance=${formatDuration(input.timings.projectionMs)}, total avant affichage=${formatDuration(input.timings.totalMs)}.`
  ];
  let appended = false;
  return {
    ...input.packet,
    displayBlocks: input.packet.displayBlocks.map(block => {
      if (appended || block.kind !== "SYSTEM_NOTICE") return block;
      appended = true;
      return { ...block, text: `${block.text}\n\n${traceLines.join("\n")}` };
    })
  } as DisplayPacketV1 & JsonObject;
}

function formatDuration(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(2)} s` : `${Math.max(0, Math.round(value))} ms`;
}

function createWelcomePacket(scene: PlayableSceneStateV1): DisplayPacketV1 {
  return createPlayableSceneOpeningPacket(scene);
}

function createPlayableSceneOpeningPacket(scene: PlayableSceneStateV1 = REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1): DisplayPacketV1 {
  const visiblePopulation = buildVisiblePopulationNarrationV1(scene);
  const visiblePoints = scene.pointsOfInterest
    .map(point => `${point.label} : ${point.visibleDescription}`)
    .join(" ");
  const openingText = [
    `Tu te trouves à ${narrativeFirstMentionV1(narrativeDesignationOfV1(scene, "locationDesignation"), scene.locationName)}.`,
    scene.perceptibleSituation.join(" "),
    visiblePopulation,
    visiblePoints,
    `Tension actuelle : ${scene.currentTension}`,
    "Aucune action n'est encore engagée : la scène est ouverte et attend ta première intention."
  ].filter(Boolean).join(" ");
  return {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: "scene-opening-reference-inn-rain-001",
    sceneId: scene.sceneId,
    displayBlocks: [{
      blockId: "scene-opening-reference-inn-rain-001-gm",
      kind: "GM_NARRATION",
      speaker: {
        speakerId: "speaker-gm",
        kind: "GM",
        displayName: "MJ",
        roleLabel: "Maitre du jeu",
        ariaLabel: "Maitre du jeu",
        visualToken: "speaker-gm"
      },
      text: openingText,
      ariaLabel: "Maitre du jeu: GM_NARRATION",
      roleLabel: "Maitre du jeu",
      visualStyleToken: "speaker-gm",
      sourceRefs: [`playable-scene:${scene.sceneId}`, `reference-scene:${scene.sceneId}`],
      isDegradedFallback: false
    }],
    rawInputAccess: {
      available: false,
      operationId: "scene-opening-reference-inn-rain-001"
    },
    rhythmDiagnostics: "scene-opening:playable-scene-state/1",
    reconstructionRefs: [`playable-scene:${scene.sceneId}`],
    version: 1
  };
}

function createLegacyPrototypeWelcomePacket(): DisplayPacketV1 {
  return {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId: "prototype-welcome",
    sceneId: "prototype-narration-surface",
    displayBlocks: [
      {
        blockId: "prototype-welcome-gm",
        kind: "GM_NARRATION",
        speaker: {
          speakerId: "speaker-gm",
          kind: "GM",
          displayName: "MJ",
          roleLabel: "Maître du jeu",
          ariaLabel: "Maître du jeu",
          visualToken: "speaker-gm"
        },
        text: "La surface narration est prête. Le prochain lot branchera cette UI à un contrôleur de campagne réel.",
        ariaLabel: "Maître du jeu: GM_NARRATION",
        roleLabel: "Maître du jeu",
        visualStyleToken: "speaker-gm",
        sourceRefs: ["prototype:surface"],
        isDegradedFallback: false
      },
      {
        blockId: "prototype-welcome-system",
        kind: "SYSTEM_NOTICE",
        speaker: {
          speakerId: "speaker-system",
          kind: "SYSTEM",
          displayName: "Système",
          roleLabel: "Notification système",
          ariaLabel: "Notification système",
          visualToken: "speaker-system"
        },
        text: "Mode prototype : la saisie passe par le contrôleur narratif, la résolution bornée et un enrichissement IA fictif sans autorité métier.",
        ariaLabel: "Notification système: SYSTEM_NOTICE",
        roleLabel: "Notification système",
        visualStyleToken: "speaker-system",
        sourceRefs: ["prototype:surface"],
        isDegradedFallback: false
      }
    ],
    rawInputAccess: {
      available: true,
      operationId: "prototype-welcome"
    },
    rhythmDiagnostics: "prototype",
    reconstructionRefs: ["prototype:surface"],
    version: 1
  };
}

async function enhancePrototypePacket(
  campaignId: CampaignId,
  output: NarrativeTurnControllerOutputV1,
  mode: NarrativeEnhancementMode,
  priorPackets: DisplayPacketV1[] = []
): Promise<{
  displayPacket: DisplayPacketV1;
  status: string;
  finalEnhancement: AiNarrativeEnhancementResultV1;
  attemptedEnhancement: AiNarrativeEnhancementResultV1 | null;
}> {
  if (output.sceneArrival !== null && output.activeScene.sceneId !== output.sceneArrival.scene.sceneId) {
    const finalEnhancement: AiNarrativeEnhancementResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-ai-resolution/1",
      enhanced: false,
      usedFallback: false,
      fallbackKind: "NONE",
      displayPacket: output.displayPacket,
      incidents: [],
      safetyNotes: ["Arrivée reconstruite après commit, mais la scène active ne correspond pas à la destination; writer refusé."]
    };
    return {
      displayPacket: output.displayPacket,
      status: "Transition confirmée, mais enrichissement refusé car la scène active ne correspond pas à la destination.",
      finalEnhancement,
      attemptedEnhancement: null
    };
  }
  if (output.suspendedIntent !== null || output.resolution.resultKind === "CLARIFICATION_REQUIRED") {
    const finalEnhancement: AiNarrativeEnhancementResultV1 = {
      schemaVersion: 1,
      contractVersion: "narrative-ai-resolution/1",
      enhanced: false,
      usedFallback: false,
      fallbackKind: "NONE",
      displayPacket: output.displayPacket,
      incidents: [],
      safetyNotes: ["Clarification déterministe conservée sans scene_writer afin de ne pas répéter la scène."]
    };
    return {
      displayPacket: output.displayPacket,
      status: "Clarification demandée sans réécriture de la scène.",
      finalEnhancement,
      attemptedEnhancement: null
    };
  }
  const operationId = output.operationId;
  const localProvider = new FakeContractAiProviderV1([
    [`${operationId}:ai:expression:attempt:1`, {
      schemaVersion: 1,
      contractVersion: "narrative-ai-resolution/1",
      outputId: `output:${operationId}:expression`,
      callId: `${operationId}:ai:expression:call`,
      attemptId: `${operationId}:ai:expression:attempt:1`,
      packId: `${operationId}:pack:expression`,
      snapshotId: `${operationId}:snapshot:display`,
      role: "player_expression_adapter",
      status: "OK",
      payload: {
        intentId: output.interpretation.intentId,
        expressionKind: output.interpretation.intentType === "speech" ? "speech" : "action_staging",
        renderedExpression: buildPrototypeExpression(output),
        meaningCovered: [output.interpretation.coreMeaning],
        addedMeaning: [],
        omittedMeaning: [],
        styleChoices: ["prototype", "registre narratif sobre"],
        safeToUse: true
      },
      diagnostics: [],
      supersedesOutputId: null
    }],
    [`${operationId}:ai:scene-writer:attempt:1`, {
      schemaVersion: 1,
      contractVersion: "narrative-ai-resolution/1",
      outputId: `output:${operationId}:scene-writer`,
      callId: `${operationId}:ai:scene-writer:call`,
      attemptId: `${operationId}:ai:scene-writer:attempt:1`,
      packId: `${operationId}:pack:scene-writer`,
      snapshotId: `${operationId}:snapshot:display`,
      role: "scene_writer",
      status: "OK",
      payload: {
        narrationBlocks: [{
          slotId: "prototype-atmosphere",
          blockKind: "MJ_NARRATION",
          content: buildPrototypeNarration(output),
          groundedIn: [`resolution:${output.resolution.resolutionId}`],
          usesCreativeTexture: true,
          factDiscipline: {
            addedUnsupportedFacts: [],
            usesOnlyProvidedVisibleEntities: true,
            noNewEvents: true,
            noHiddenPresence: true,
            notes: ["Fixture locale fondée sur la scène active du contrôleur."]
          }
        }]
      },
      diagnostics: [],
      supersedesOutputId: null
    }]
  ]);
  const provider = mode === "openai"
    ? new ServerOpenAiEnhancementProviderV1()
    : localProvider;
  const enhanced = await enhanceNarrativeDisplayWithAiV1({
    campaignId,
    operationId,
    displayPacket: output.displayPacket,
    priorDisplayPackets: priorPackets,
    resolution: output.resolution,
    mjPlan: output.mjPlan,
    sceneState: output.sceneState,
    activeScene: output.activeScene,
    config: {
      provider,
      expressionRoute: prototypeExpressionRoute,
      sceneWriterRoute: mode === "openai"
        ? prototypeOpenAiSceneWriterRoute
        : prototypeSceneWriterRoute,
      coherenceCriticRoute: mode === "openai" ? prototypeCoherenceCriticRoute : undefined,
      useRemoteExpressionAdapter: false,
      retryPolicy: prototypeRetryPolicy
    }
  });
  if (mode === "openai" && enhanced.fallbackKind === "TECHNICAL_INCIDENT") {
    const fallback = await enhanceNarrativeDisplayWithAiV1({
      campaignId,
      operationId,
      displayPacket: output.displayPacket,
      priorDisplayPackets: priorPackets,
      resolution: output.resolution,
      mjPlan: output.mjPlan,
      sceneState: output.sceneState,
      activeScene: output.activeScene,
      config: {
        provider: localProvider,
        expressionRoute: prototypeExpressionRoute,
        sceneWriterRoute: prototypeSceneWriterRoute,
        retryPolicy: prototypeRetryPolicy
      }
    });
    const variedFallback = applyNarrativePresentationVariationV1({
      schemaVersion: 1,
      displayPacket: fallback.displayPacket,
      output,
      priorPackets
    }).displayPacket;
    return {
      displayPacket: variedFallback,
      status: `OpenAI indisponible ou sortie refusée (${summarizeOpenAiFallback(enhanced)}) : fallback local utilisé.`,
      finalEnhancement: { ...fallback, displayPacket: variedFallback },
      attemptedEnhancement: enhanced
    };
  }
  if (mode === "openai" && enhanced.fallbackKind === "RENDER_AUTHORITY_REJECTION") {
    const varied = applyNarrativePresentationVariationV1({
      schemaVersion: 1,
      displayPacket: enhanced.displayPacket,
      output,
      priorPackets
    }).displayPacket;
    return {
      displayPacket: varied,
      status: "Texte IA candidat rejeté par la frontière d'autorité : rendu déterministe autorisé conservé.",
      finalEnhancement: { ...enhanced, displayPacket: varied },
      attemptedEnhancement: null
    };
  }
  if (!enhanced.enhanced && !enhanced.usedFallback) {
    const varied = applyNarrativePresentationVariationV1({
      schemaVersion: 1,
      displayPacket: enhanced.displayPacket,
      output,
      priorPackets
    }).displayPacket;
    const sceneWriterRejectedNote = enhanced.safetyNotes.find(note =>
      /Scene writer appelé, mais aucun bloc MJ utilisable/u.test(note)
    );
    const hasLocalNarration = varied.displayBlocks.some(block =>
      block.kind === "GM_NARRATION" || block.kind === "NPC_SPEECH"
    );
    return {
      displayPacket: varied,
      status: sceneWriterRejectedNote
        ? `OpenAI appelé, mais aucune narration utilisable n'a passé les garde-fous (${summarizeSceneWriterRejectedNote(sceneWriterRejectedNote)}) : narration locale conservée.`
        : isImmediateVisibleOrientationResolutionV1(output.resolution)
          ? "Scene writer non appelé: orientation immédiate vers une présence déjà visible; narration déterministe conservée."
        : hasLocalNarration
        ? mode === "openai"
          ? "Narration de scène locale utilisée; OpenAI non appelé car aucun enrichissement supplémentaire n'était nécessaire."
          : "Narration de scène locale utilisée."
        : mode === "openai"
          ? "OpenAI non appelé : aucune matière narrative autorisée pour cette réponse."
          : "Mode local : aucune matière narrative autorisée pour cette réponse.",
      finalEnhancement: { ...enhanced, displayPacket: varied },
      attemptedEnhancement: null
    };
  }
  const varied = applyNarrativePresentationVariationV1({
    schemaVersion: 1,
    displayPacket: enhanced.displayPacket,
    output,
    priorPackets
  }).displayPacket;
  return {
    displayPacket: varied,
    status: mode === "openai" ? "OpenAI serveur utilisé pour l'enrichissement." : "Mode local utilisé pour l'enrichissement.",
    finalEnhancement: { ...enhanced, displayPacket: varied },
    attemptedEnhancement: null
  };
}

function summarizeSceneWriterRejectedNote(note: string): string {
  const match = note.match(/garde-fous de rendu: (?<reasons>.+)\.$/u);
  return match?.groups?.reasons ?? "motif non détaillé";
}

function summarizeOpenAiFallback(enhancement: Awaited<ReturnType<typeof enhanceNarrativeDisplayWithAiV1>>): string {
  const incident = enhancement.incidents[0];
  if (!incident) return "aucun diagnostic serveur";
  const role = incident.role ?? "role inconnu";
  const outputDiagnostics = Array.isArray(incident.safeDetails.outputDiagnostics)
    ? incident.safeDetails.outputDiagnostics.filter((entry): entry is string => typeof entry === "string")
    : [];
  const outputDiagnosticMessages = Array.isArray(incident.safeDetails.outputDiagnosticMessages)
    ? incident.safeDetails.outputDiagnosticMessages.filter((entry): entry is string => typeof entry === "string")
    : [];
  const suffix = outputDiagnostics.length > 0 ? `/${outputDiagnostics.join("+")}` : "";
  const message = outputDiagnosticMessages.length > 0 ? ` - ${outputDiagnosticMessages.join(" | ")}` : "";
  return `${role}/${incident.category}/${incident.stage}${suffix}${message}`;
}

function buildPrototypeExpression(output: NarrativeTurnControllerOutputV1): string {
  const expression = output.resolution.characterExpression?.expressionText;
  if (expression) return expression;
  return output.interpretation.coreMeaning;
}

function buildPrototypeNarration(output: NarrativeTurnControllerOutputV1): string {
  if (output.sceneArrival !== null) {
    return output.displayPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text
      ?? output.activeScene.perceptibleSituation.join(" ");
  }
  if (output.activeScene.sceneId !== REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1.sceneId) {
    return output.displayPacket.displayBlocks.find(block => block.kind === "GM_NARRATION")?.text
      ?? output.activeScene.perceptibleSituation.join(" ");
  }
  return buildReferenceSceneLocalNarrationV1({
    rawInput: output.displayPacket.displayBlocks.find(block => block.kind === "RAW_INPUT")?.text ?? "",
    interpretation: output.interpretation,
    resolution: output.resolution
  });
}

const prototypeExpressionRoute: AiModelRouteV1 = {
  schemaVersion: 1,
  routeId: "prototype-ui-expression",
  role: "player_expression_adapter",
  providerKind: "FAKE_CONTRACT",
  providerId: "fake",
  modelId: "fake-ui-expression",
  modelConfigVersion: "i06h",
  certified: true,
  allowedContractVersions: ["narrative-ai-resolution/1"],
  inputTokenLimit: 2_000,
  outputTokenLimit: 1_000,
  timeoutMs: 1_000,
  fallbackRouteIds: []
};

const prototypeSceneWriterRoute: AiModelRouteV1 = {
  schemaVersion: 1,
  routeId: "prototype-ui-scene-writer",
  role: "scene_writer",
  providerKind: "FAKE_CONTRACT",
  providerId: "fake",
  modelId: "fake-ui-scene-writer",
  modelConfigVersion: "i06h",
  certified: true,
  allowedContractVersions: ["narrative-ai-resolution/1"],
  inputTokenLimit: 2_000,
  outputTokenLimit: 1_500,
  timeoutMs: 30_000,
  fallbackRouteIds: []
};

const prototypeOpenAiSceneWriterRoute: AiModelRouteV1 = {
  ...prototypeSceneWriterRoute,
  routeId: "prototype-ui-openai-scene-writer",
  providerId: "server-openai-route",
  modelId: "server-selected-openai-model",
  modelConfigVersion: "narrative-openai-route/1"
};

const prototypeCoherenceCriticRoute: AiModelRouteV1 = {
  schemaVersion: 1,
  routeId: "prototype-ui-openai-coherence-critic",
  role: "coherence_critic",
  providerKind: "FAKE_CONTRACT",
  providerId: "server-openai-route",
  modelId: "server-selected-openai-model",
  modelConfigVersion: "render-authority-v1",
  certified: true,
  allowedContractVersions: ["narrative-ai-resolution/1"],
  inputTokenLimit: 2_000,
  outputTokenLimit: 1_600,
  timeoutMs: 30_000,
  fallbackRouteIds: []
};

const prototypeRetryPolicy: AiRetryPolicyV1 = {
  schemaVersion: 1,
  role: "scene_writer",
  maxTechnicalRetries: 0,
  maxTargetedCorrections: 0,
  maxFullRegenerations: 0,
  allowFallback: false
};

function buildIntentInterpreterConfig(mode: NarrativeEnhancementMode): AiIntentInterpreterConfigV1 | undefined {
  if (mode !== "openai") return undefined;
  return buildOpenAiIntentInterpreterConfigV1();
}

function buildNpcPerformerConfig(mode: NarrativeEnhancementMode): NpcPerformerConfigV1 | undefined {
  if (mode !== "openai") return undefined;
  return buildOpenAiNpcPerformerConfigV1();
}
