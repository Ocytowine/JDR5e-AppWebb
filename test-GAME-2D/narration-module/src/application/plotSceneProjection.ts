import type {
  CampaignId,
  CampaignRepository,
  JsonObject,
  RepositoryClock,
  Result
} from "../core";
import {
  buildDisplayPacketFromRenderPlanV1,
  SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  validateRenderPlanV1,
  type DisplayPacketV1,
  type RenderPlanV1
} from "../scene";
import {
  recordNarrativeDirectDisplayProjectionV1,
  type NarrativeRenderProjectionRecordResultV1
} from "./narrativeRenderProjection";
import {
  SCENE_EVENT_BUNDLE_CONTRACT_V1,
  type PlotEvolutionResultV1,
  type PlotSceneRevealResultV1,
  type SceneEventBundleV1
} from "./plotAuthority";

export interface PlotSceneBoundaryProjectionResultV1 {
  evolution: PlotEvolutionResultV1;
  reveal: PlotSceneRevealResultV1;
  displayPacket: (DisplayPacketV1 & JsonObject) | null;
  projection: NarrativeRenderProjectionRecordResultV1 | null;
}

export async function projectAndRecordPlotSceneRevealV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  evolution: PlotEvolutionResultV1;
  reveal: PlotSceneRevealResultV1;
}): Promise<Result<PlotSceneBoundaryProjectionResultV1>> {
  if (input.reveal.status === "CLEAR" || input.reveal.bundle.perceptions.length === 0) {
    return {
      ok: true,
      value: {
        evolution: input.evolution,
        reveal: input.reveal,
        displayPacket: null,
        projection: null
      }
    };
  }
  const displayPacket = buildPlotSceneDisplayPacketV1(
    input.reveal.operationId,
    input.reveal.bundle
  );
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: input.reveal.operationId,
      sourceOperationId: input.reveal.operationId,
      sourceContractVersion: SCENE_EVENT_BUNDLE_CONTRACT_V1,
      displayPacket,
      statusMessage: "Effets perceptibles d'intrigue projetés depuis une révélation committée.",
      sourceRefs: input.reveal.bundle.perceptions.flatMap(value => [
        value.eventRef,
        value.effectRef
      ])
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      evolution: input.evolution,
      reveal: input.reveal,
      displayPacket,
      projection: recorded.value
    }
  };
}

export function buildPlotSceneDisplayPacketV1(
  operationId: string,
  bundle: SceneEventBundleV1
): DisplayPacketV1 & JsonObject {
  const plan: RenderPlanV1 = {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    operationId,
    sceneId: bundle.sceneId,
    sourceRevision: 1,
    blocks: bundle.perceptions.map((perception, index) => ({
      blockId: `${operationId}:plot-perception:${index}`,
      kind: "GM_NARRATION" as const,
      speakerRef: {
        schemaVersion: 1 as const,
        kind: "GM" as const,
        speakerId: "speaker-gm",
        actorRef: null,
        displayName: "MJ",
        knownNameStatus: "KNOWN" as const,
        roleLabel: "Narration",
        accessibilityLabel: "Maître du jeu",
        visualToken: "speaker-gm"
      },
      sourceRefs: [...perception.sourceRefs],
      groundedIn: [perception.eventRef, perception.effectRef],
      textPolicy: "DETERMINISTIC_ONLY" as const,
      visibility: "PLAYER_VISIBLE" as const,
      order: index,
      text: perception.text
    })),
    rhythmDecision: {
      reason: "ASK_PLAYER",
      diagnostic: "committed plot perceptions rendered; control returns to player"
    },
    fallbackAllowed: false,
    version: 1
  };
  const validation = validateRenderPlanV1(plan);
  if (!validation.ok) throw new Error(`Invalid plot scene render plan: ${validation.issues.join("; ")}`);
  return buildDisplayPacketFromRenderPlanV1({
    renderPlan: plan,
    rawInputAvailable: false,
    diagnosticsEnabled: false
  }) as DisplayPacketV1 & JsonObject;
}
