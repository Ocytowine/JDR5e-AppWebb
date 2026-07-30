import { opaqueId, type AggregateId, type JsonObject } from "../core";

export const CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1 =
  "campaign-runtime-bindings/1" as const;

export interface CampaignRuntimeBindingsV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1;
  positionAggregateId: AggregateId;
  sceneLifecycleAggregateId: AggregateId;
  scheduleAggregateId: AggregateId;
  simulationCursorAggregateId: AggregateId;
  processAggregateId: AggregateId;
  version: 1;
}

export const PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1:
CampaignRuntimeBindingsV1 = {
  schemaVersion: 1,
  contractVersion: CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1,
  positionAggregateId:
    opaqueId<AggregateId>("agg-prototype-world-position-player"),
  sceneLifecycleAggregateId:
    opaqueId<AggregateId>("agg-prototype-scene-lifecycle"),
  scheduleAggregateId:
    opaqueId<AggregateId>("agg-prototype-world-schedule"),
  simulationCursorAggregateId:
    opaqueId<AggregateId>("agg-prototype-world-simulation-cursor"),
  processAggregateId:
    opaqueId<AggregateId>("agg-prototype-process-state"),
  version: 1
};

export function validateCampaignRuntimeBindingsV1(
  value: CampaignRuntimeBindingsV1
): string[] {
  const issues: string[] = [];
  if (
    value.schemaVersion !== 1
    || value.contractVersion !== CAMPAIGN_RUNTIME_BINDINGS_CONTRACT_V1
    || value.version !== 1
  ) issues.push("runtime bindings contract is invalid");
  const ids = [
    value.positionAggregateId,
    value.sceneLifecycleAggregateId,
    value.scheduleAggregateId,
    value.simulationCursorAggregateId,
    value.processAggregateId
  ];
  if (ids.some(id => typeof id !== "string" || id.trim() !== id || id.length < 3)) {
    issues.push("runtime binding identities are invalid");
  }
  if (new Set(ids).size !== ids.length) {
    issues.push("runtime binding identities must be unique");
  }
  return issues;
}
