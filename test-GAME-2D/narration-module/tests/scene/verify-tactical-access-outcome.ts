import assert from "node:assert/strict";
import {
  ACCESS_CONTROL_CONTRACT_V1,
  ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
  ACCESS_CONTROL_REGISTRY_CONTRACT_V1,
  accessControlRegistryAggregateIdV1,
  createTacticalAccessConsequenceAuthorityV1,
  type AccessControlRegistryV1
} from "../../src/application";
import {
  coreError,
  opaqueId,
  type CampaignId,
  type CampaignRepository
} from "../../src/core";
import type {
  ProcessHandoffV1,
  TacticalOutcomeV1
} from "../../src/handoff";

const campaignId = opaqueId<CampaignId>("campaign:tactical-access-outcome");
const accessControlRef = "access-control:test-tactical-threshold";
const requirementRef = `${accessControlRef}:requirement:guard-control`;
const registry: AccessControlRegistryV1 = {
  schemaVersion: 1,
  contractVersion: ACCESS_CONTROL_REGISTRY_CONTRACT_V1,
  campaignId,
  controls: [{
    schemaVersion: 1,
    contractVersion: ACCESS_CONTROL_CONTRACT_V1,
    accessControlRef,
    connectionId: "connection:test-tactical-threshold",
    sourceSceneId: "scene:test-tactical-threshold",
    boundaryRef: "poi:test-tactical-threshold",
    destinationRef: "location:test-behind-threshold",
    state: "CONTROLLED",
    ownerDomain: "test-access-owner",
    thresholdDescription: "Un garde tient le seuil de test.",
    requirements: [{
      schemaVersion: 1,
      requirementRef,
      kind: "OTHER",
      description: "Le garde conserve le controle.",
      status: "ACTIVE",
      visibility: "PUBLIC",
      ownerDomain: "test-access-owner",
      sourceRefs: ["rule:test-tactical-access@1"],
      version: 1
    }],
    approachDomains: ["tactical"],
    approachesAreNonExhaustive: true,
    sourceRefs: ["rule:test-tactical-access@1"],
    version: 1
  }],
  version: 1
};
const repository = {
  async getAggregate(
    requestedCampaignId: CampaignId,
    aggregateType: string,
    aggregateId: string
  ) {
    assert.equal(requestedCampaignId, campaignId);
    assert.equal(aggregateType, ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1);
    assert.equal(aggregateId, accessControlRegistryAggregateIdV1(campaignId));
    return { ok: true as const, value: {
      schemaVersion: 1,
      campaignId,
      aggregateType,
      aggregateId,
      aggregateRevision: 4,
      payloadSchemaVersion: 1,
      payload: registry,
      commitSequence: 4,
      updatedAt: "2026-08-04T18:00:00.000Z"
    } };
  }
} as unknown as CampaignRepository;
const process = {
  processId: "tactical:access:test-outcome",
  campaignId
} as unknown as ProcessHandoffV1;
const outcome = {
  outcomeId: "outcome:tactical-access-test",
  processId: process.processId,
  campaignId,
  endCondition: "player_defeated"
} as unknown as TacticalOutcomeV1;
const policyRef = "tactical-access-policy:test@1";
const authority = createTacticalAccessConsequenceAuthorityV1({
  policyRef,
  resolve(input) {
    if (input.endCondition !== "player_defeated") {
      return {
        ok: false,
        error: coreError(
          "VALIDATION_FAILED",
          "test.unsupported-end-condition"
        )
      };
    }
    return { ok: true, value: {
      schemaVersion: 1,
      resolutionCode: "PLAYER_DEFEATED_ACCESS_CONTROLLED",
      resultingAccessState: "CONTROLLED",
      waiveRequirementRefs: [],
      publicNarrative: "Le garde conserve le controle du seuil."
    } };
  }
});

async function main(): Promise<void> {
  const validated = await authority.validate({
    repository,
    campaignId,
    process,
    outcome,
    candidate: {
      candidateId: "candidate:access:test",
      ownerDomain: "access",
      accessControlRef,
      processId: process.processId,
      endCondition: outcome.endCondition,
      resolutionPolicyRef: policyRef
    },
    integratedAtGameSecond: 12
  });
  if (!validated.ok) throw new Error(validated.error.messageKey);
  assert.equal(validated.ok, true);
  assert.equal(
    validated.value.resolutionCode,
    "PLAYER_DEFEATED_ACCESS_CONTROLLED"
  );
  assert.equal(validated.value.deltas.length, 1);
  const next = validated.value.deltas[0]!.payload as unknown as
    AccessControlRegistryV1;
  assert.equal(next.controls[0]!.state, "CONTROLLED");
  assert.equal(next.controls[0]!.requirements[0]!.status, "ACTIVE");
  assert.equal(registry.controls[0]!.state, "CONTROLLED");
  console.log(
    "tactical-access-outcome/1: defeat keeps the threshold controlled through its owner authority"
  );
}

void main();
