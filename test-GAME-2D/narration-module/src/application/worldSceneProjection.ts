import {
  computeJsonFingerprint,
  coreError,
  opaqueId,
  type CampaignId,
  type CampaignRepository,
  type JsonObject,
  type OperationId,
  type RepositoryClock,
  type Result
} from "../core";
import type { DisplayPacketV1 } from "../scene";
import {
  recordNarrativeDirectDisplayProjectionV1,
  type NarrativeRenderProjectionRecordResultV1
} from "./narrativeRenderProjection";
import {
  buildPlotSceneDisplayPacketV1
} from "./plotSceneProjection";
import {
  SCENE_EVENT_BUNDLE_CONTRACT_V1,
  type SceneEventBundleV1
} from "./plotAuthority";

export interface WorldSceneProjectionResultV1 {
  bundle: SceneEventBundleV1;
  displayPacket: (DisplayPacketV1 & JsonObject) | null;
  projection: NarrativeRenderProjectionRecordResultV1 | null;
}

export async function projectAndRecordWorldSceneBundleV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  clock: RepositoryClock;
  idPrefix: string;
  bundle: SceneEventBundleV1;
}): Promise<Result<WorldSceneProjectionResultV1>> {
  if (input.bundle.perceptions.length === 0) {
    return {
      ok: true,
      value: { bundle: input.bundle, displayPacket: null, projection: null }
    };
  }
  const sourceOperationIds = [...new Set(input.bundle.perceptions
    .map(value => value.sourceOperationId)
    .filter((value): value is string => value !== null))];
  if (sourceOperationIds.length === 0) {
    return {
      ok: false,
      error: coreError("VALIDATION_FAILED", "world-scene-projection.source-operation-missing")
    };
  }
  for (const sourceOperationId of sourceOperationIds) {
    const source = await input.repository.getOperation(opaqueId<OperationId>(sourceOperationId));
    if (
      !source.ok
      || source.value.campaignId !== input.campaignId
      || source.value.phase !== "COMPLETED"
      || source.value.commitId === null
    ) {
      return source.ok
        ? {
            ok: false,
            error: coreError("VALIDATION_FAILED", "world-scene-projection.source-operation-not-committed", {
              sourceOperationId
            })
          }
        : source;
    }
  }
  const bundleFingerprint = await computeJsonFingerprint(input.bundle);
  const packetOperationId = [
    "world-scene-bundle",
    normalizeId(input.bundle.sceneId),
    bundleFingerprint.slice("sha256:".length, "sha256:".length + 20)
  ].join(":");
  const displayPacket = buildPlotSceneDisplayPacketV1(packetOperationId, input.bundle);
  const sourceOperationId = sourceOperationIds[sourceOperationIds.length - 1]!;
  const recorded = await recordNarrativeDirectDisplayProjectionV1({
    repository: input.repository,
    campaignId: input.campaignId,
    clock: input.clock,
    idPrefix: input.idPrefix,
    request: {
      schemaVersion: 1,
      clientRequestId: packetOperationId,
      sourceOperationId,
      sourceContractVersion: SCENE_EVENT_BUNDLE_CONTRACT_V1,
      displayPacket,
      statusMessage: input.bundle.controlDecision === "INTERRUPT_FOR_PLAYER_DECISION"
        ? "Signal monde perceptible projeté ; la main revient au joueur."
        : "Signal monde perceptible projeté sans décision supplémentaire.",
      sourceRefs: input.bundle.perceptions.flatMap(value => [
        value.eventRef,
        value.effectRef
      ])
    }
  });
  if (!recorded.ok) return recorded;
  return {
    ok: true,
    value: {
      bundle: input.bundle,
      displayPacket,
      projection: recorded.value
    }
  };
}

function normalizeId(value: string): string {
  const normalized = value.normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return normalized || "scene";
}
