import assert from "node:assert/strict";
import {
  computeJsonFingerprint,
  opaqueId,
  type CampaignId
} from "../../src/core";
import {
  prepareSkillCheckOutcomeV1,
  type DiceRollRecordV1,
  type SkillCheckOutcomePolicyV1,
  type SkillCheckProposalV1
} from "../../src/application";
import { validateTimeAdvanceProposalV1 } from "../../src/time";

const proposal: SkillCheckProposalV1 = {
  schemaVersion: 1,
  contractVersion: "skill-check-proposal/1",
  checkId: "check:wet-wall",
  domain: "rules",
  goal: "escalader le mur détrempé",
  targetRef: "scene:wet-wall",
  ability: "FOR",
  skillId: "athletisme",
  characterContext: {
    schemaVersion: 1,
    contractVersion: "mechanical-character-context/1",
    characterId: "character:test",
    ability: "FOR",
    abilityModifier: 3,
    proficiencyBonus: 2,
    skillId: "athletisme",
    proficiencyRank: 1,
    totalModifier: 5,
    passiveScore: null,
    backgroundId: "soldat",
    sourceRefs: ["character:test"]
  },
  difficulty: {
    status: "RULE_RESOLVED",
    dc: 15,
    band: "MEDIUM",
    ruleRef: "core.check.difficulty-class@1",
    assessment: {
      schemaVersion: 1,
      contractVersion: "difficulty-assessment/1",
      assessmentId: "difficulty:wet-wall",
      domain: "rules",
      baseBand: "MEDIUM",
      selectedBand: "MEDIUM",
      netShift: 0,
      totalShift: 0,
      publicReasons: [],
      privateFactorCount: 0,
      publicSourceRefs: ["scene:wet-wall"],
      privateSourceRefs: [],
      ruleRefs: ["core.check.difficulty-assessment@1"],
      commitAuthority: false
    }
  },
  passive: { eligible: false, score: null, reason: "Action volontaire." },
  advantageSources: [],
  disadvantageSources: [],
  stakes: {
    success: "Le personnage atteint la corniche.",
    failure: "Le personnage reste au sol et perd du temps."
  },
  retryPolicy: "DOMAIN_TO_DECIDE",
  timeCost: "DOMAIN_TO_DECIDE",
  sourceRefs: ["scene:wet-wall"],
  ruleRefs: ["core.check.difficulty-class@1"],
  commitAuthority: false
};

const policy: SkillCheckOutcomePolicyV1 = {
  schemaVersion: 1,
  policyId: "policy:wet-wall",
  checkId: proposal.checkId,
  success: {
    ownerDomain: "exploration",
    effectType: "position.reach",
    effectPayload: { destinationRef: "scene:wet-wall:cornice" },
    publicSummary: "Vous atteignez la corniche.",
    durationSeconds: 12,
    retryDisposition: "RETRY_FORBIDDEN",
    publicSourceRefs: ["scene:wet-wall", "rule:climb"],
    privateSourceRefs: [],
    ruleRefs: ["rule.exploration.climb-duration@1"]
  },
  failure: {
    ownerDomain: "exploration",
    effectType: "position.unchanged",
    effectPayload: { positionRef: "scene:wet-wall:ground" },
    publicSummary: "La prise cède et vous restez au sol.",
    durationSeconds: 18,
    retryDisposition: "RETRY_ALLOWED_WITH_ADDITIONAL_TIME",
    publicSourceRefs: ["scene:wet-wall"],
    privateSourceRefs: ["scene:wet-wall:hidden-fragility"],
    ruleRefs: ["rule.exploration.climb-duration@1"]
  },
  commitAuthority: false
};

async function record(outcome: "SUCCESS" | "FAILURE"): Promise<DiceRollRecordV1> {
  return {
    schemaVersion: 1,
    contractVersion: "dice-roll-record/1",
    rollId: `roll:${outcome.toLowerCase()}`,
    checkId: proposal.checkId,
    operationId: `operation:${outcome.toLowerCase()}`,
    proposalFingerprint: await computeJsonFingerprint(proposal),
    sourceId: "test",
    resolution: {
      schemaVersion: 1,
      contractVersion: "skill-check-resolution/1",
      resolutionId: `resolution:${outcome.toLowerCase()}`,
      checkId: proposal.checkId,
      dieRoll: outcome === "SUCCESS" ? 15 : 4,
      abilityModifier: 3,
      proficiencyContribution: 2,
      totalModifier: 5,
      total: outcome === "SUCCESS" ? 20 : 9,
      dc: 15,
      margin: outcome === "SUCCESS" ? 5 : -6,
      outcome,
      naturalResult: "ORDINARY",
      appliedRuleRefs: [...proposal.ruleRefs],
      sourceRefs: [...proposal.sourceRefs],
      commitAuthority: false
    },
    generatedAtGameSecond: 100,
    version: 1
  };
}

async function run(): Promise<void> {
  const campaignId = opaqueId<CampaignId>("campaign:outcome-preparation");
  const success = await prepareSkillCheckOutcomeV1({
    campaignId,
    proposal,
    rollRecord: await record("SUCCESS"),
    policy,
    observedAtGameSecond: 100
  });
  assert.equal(success.ok, true);
  if (!success.ok) throw new Error("success preparation failed");
  assert.equal(success.value.consequence.effectType, "position.reach");
  assert.equal(success.value.timeAdvanceProposal.duration.recommendedSeconds, 12);
  assert.equal(validateTimeAdvanceProposalV1(success.value.timeAdvanceProposal, 100).ok, true);
  assert.equal(success.value.narrativeResume.outcome, "SUCCESS");
  assert.equal(success.value.commitAuthority, false);

  const failure = await prepareSkillCheckOutcomeV1({
    campaignId,
    proposal,
    rollRecord: await record("FAILURE"),
    policy,
    observedAtGameSecond: 100
  });
  assert.equal(failure.ok, true);
  if (!failure.ok) throw new Error("failure preparation failed");
  assert.equal(failure.value.consequence.effectType, "position.unchanged");
  assert.equal(failure.value.timeAdvanceProposal.duration.recommendedSeconds, 18);
  assert.equal(validateTimeAdvanceProposalV1(failure.value.timeAdvanceProposal, 100).ok, true);
  assert.equal(failure.value.consequence.privateSourceRefs.length, 1);
  assert.deepEqual(failure.value.narrativeResume.allowedSourceRefs, ["scene:wet-wall"]);
  assert.equal(JSON.stringify(failure.value.narrativeResume).includes("hidden-fragility"), false);

  const conflictingRecord = await record("SUCCESS");
  conflictingRecord.proposalFingerprint = "sha256:conflict";
  const conflict = await prepareSkillCheckOutcomeV1({
    campaignId,
    proposal,
    rollRecord: conflictingRecord,
    policy,
    observedAtGameSecond: 100
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.code, "PROPOSAL_FINGERPRINT_MISMATCH");

  console.log("skill-check-outcome-preparation/1: persisted verdict selects one bounded branch without commit");
}

void run();
