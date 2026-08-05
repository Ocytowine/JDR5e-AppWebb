import assert from "node:assert/strict";
import { opaqueId, type CampaignId } from "../../src/core";
import {
  ACCESS_CONTROL_CONTRACT_V1,
  buildRulesAccessSkillCheckOutcomePolicyV1,
  buildRulesAccessSkillCheckOwnerResultV1,
  buildUnresolvedSkillCheckProposalV1,
  type AccessControlRegistryV1,
  type PreparedSkillCheckOutcomeV1,
  type RulesAccessAttemptRegistryV1,
  type RulesAccessCheckPolicyV1
} from "../../src/application";

const campaignId = opaqueId<CampaignId>("campaign:rules-access-outcome");
const accessControlRef = "access-control:test-force";
const deviceRef = "poi:test-force:gate";
const proposal = buildUnresolvedSkillCheckProposalV1({
  checkId: "rules-check:test-force",
  domain: "rules",
  goal: "forcer le passage",
  targetRef: deviceRef,
  ability: "FOR",
  skillId: "athletics",
  passiveEligible: false,
  passiveReason: "action active",
  successStake: "ouvrir bruyamment",
  failureStake: "rester fermé et produire du bruit",
  sourceRefs: ["rule:test-force@1"]
});
const checkPolicy: RulesAccessCheckPolicyV1 = {
  schemaVersion: 1,
  proposal,
  method: "FORCE",
  deviceRef,
  requiredItemIds: [],
  durationSeconds: 6,
  success: {
    playerFacingText: "Le passage cède avec fracas.",
    satisfyRequirementRefs: [],
    waiveRequirementRefs: ["requirement:test-force"],
    resultingAccessState: "OPEN",
    noise: "LOUD",
    consumedItemInstanceIds: [],
    sourceRefs: ["rule:test-force@1"]
  },
  failure: {
    playerFacingText: "Le passage résiste et le choc est entendu.",
    resultingAccessState: "CONTROLLED",
    noise: "LOUD",
    consumedItemInstanceIds: [],
    sourceRefs: ["rule:test-force@1"]
  },
  ruleRefs: ["rule:test-force@1"]
};
const context = {
  owner: "RULES_ACCESS" as const,
  resolutionRef: "rules-resolution:test-force",
  accessControlRef,
  actorRef: "actor:hero",
  deviceRef,
  checkPolicy
};
const policy = buildRulesAccessSkillCheckOutcomePolicyV1({ context });
assert.equal(policy.ok, true);
if (!policy.ok) throw new Error("rules access policy failed");
assert.equal(policy.value.failure.effectPayload.noise, "LOUD");

const accessRegistry: AccessControlRegistryV1 = {
  schemaVersion: 1,
  contractVersion: "access-control-registry/1",
  campaignId,
  controls: [{
    schemaVersion: 1,
    contractVersion: ACCESS_CONTROL_CONTRACT_V1,
    accessControlRef,
    connectionId: "connection:test-force",
    sourceSceneId: "scene:test-force",
    boundaryRef: deviceRef,
    destinationRef: "location:test-force",
    state: "CONTROLLED",
    ownerDomain: "test-access",
    thresholdDescription: "Passage résistant.",
    requirements: [{
      schemaVersion: 1,
      requirementRef: "requirement:test-force",
      kind: "AUTHORIZATION",
      description: "Passage contrôlé.",
      status: "ACTIVE",
      visibility: "PUBLIC",
      ownerDomain: "inventory",
      sourceRefs: ["rule:test-force@1"],
      version: 1
    }],
    approachDomains: ["rules"],
    approachesAreNonExhaustive: true,
    sourceRefs: ["rule:test-force@1"],
    version: 1
  }],
  version: 1
};
const attemptRegistry: RulesAccessAttemptRegistryV1 = {
  schemaVersion: 1,
  contractVersion: "rules-access-attempt-registry/1",
  campaignId,
  attempts: [{
    schemaVersion: 1,
    resolutionRef: context.resolutionRef,
    accessControlRef,
    actorRef: context.actorRef,
    deviceRef,
    method: "FORCE",
    toolItemInstanceId: null,
    checkId: proposal.checkId,
    checkResolution: null,
    occurredAtGameSecond: 10,
    sourceRefs: ["rule:test-force@1"]
  }],
  version: 1
};
const prepared: PreparedSkillCheckOutcomeV1 = {
  schemaVersion: 1,
  contractVersion: "skill-check-outcome-preparation/1",
  preparationId: "preparation:test-force-failure",
  checkId: proposal.checkId,
  rollId: "rules-check:test-force:roll:1",
  outcome: "FAILURE",
  consequence: {
    status: "PREPARED_NOT_COMMITTED",
    ownerDomain: policy.value.failure.ownerDomain,
    effectType: policy.value.failure.effectType,
    effectPayload: policy.value.failure.effectPayload,
    retryDisposition: policy.value.failure.retryDisposition,
    publicSourceRefs: policy.value.failure.publicSourceRefs,
    privateSourceRefs: [],
    ruleRefs: policy.value.failure.ruleRefs
  },
  timeAdvanceProposal: {
    schemaVersion: 1,
    proposalId: "time:test-force-failure",
    campaignId,
    requesterDomain: "rules",
    category: "FIXED_RULE",
    observedAtGameSecond: 10,
    duration: { recommendedSeconds: 6, minimumSeconds: 6, maximumSeconds: 6 },
    source: { kind: "RULE", id: "rule:test-force@1", version: 1 },
    cause: { kind: "EVENT", id: "event:test-force" },
    processId: null,
    interruptible: false,
    dependencies: []
  },
  narrativeResume: {
    publicSummary: policy.value.failure.publicSummary,
    durationSeconds: 6,
    outcome: "FAILURE",
    allowedSourceRefs: policy.value.failure.publicSourceRefs,
    forbiddenChanges: ["OUTCOME", "DURATION", "EFFECT", "RETRY_DISPOSITION"],
    commitAuthority: false
  },
  commitAuthority: false
};
const failure = buildRulesAccessSkillCheckOwnerResultV1({
  campaignId,
  prepared,
  context,
  accessRegistryAggregate: null,
  accessRegistry,
  attemptRegistryAggregate: null,
  attemptRegistry
});
assert.equal(failure.ok, true);
if (!failure.ok) throw new Error("rules access failure result failed");
assert.equal(failure.value.additionalTargets.length, 0);
const next = failure.value.nextPayload as unknown as RulesAccessAttemptRegistryV1;
assert.equal(next.attempts[0].checkResolution?.outcome, "FAILURE");
assert.equal(next.attempts[0].checkResolution?.noise, "LOUD");
assert.equal(next.attempts[0].checkResolution?.resultingAccessState, "CONTROLLED");
assert.equal(accessRegistry.controls[0].state, "CONTROLLED");

console.log("rules-access-outcome/1: failure persists time-bound loud consequence without opening access");
