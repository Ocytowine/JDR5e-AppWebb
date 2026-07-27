import { computeJsonFingerprint, type CampaignId, type JsonObject } from "../core";
import type { TimeAdvanceProposalV1 } from "../time";
import type { DiceRollRecordV1 } from "./diceRollRecord";
import type { SkillCheckProposalV1 } from "./skillCheckProposal";

export const SKILL_CHECK_OUTCOME_PREPARATION_CONTRACT_VERSION_V1 =
  "skill-check-outcome-preparation/1" as const;

export type SkillCheckRetryDispositionV1 =
  | "RETRY_FORBIDDEN"
  | "RETRY_REQUIRES_CONTEXT_CHANGE"
  | "RETRY_ALLOWED_WITH_ADDITIONAL_TIME";

export interface SkillCheckOutcomeBranchV1 extends JsonObject {
  ownerDomain: string;
  effectType: string;
  effectPayload: JsonObject;
  publicSummary: string;
  durationSeconds: number;
  retryDisposition: SkillCheckRetryDispositionV1;
  publicSourceRefs: string[];
  privateSourceRefs: string[];
  ruleRefs: string[];
}

export interface SkillCheckOutcomePolicyV1 extends JsonObject {
  schemaVersion: 1;
  policyId: string;
  checkId: string;
  success: SkillCheckOutcomeBranchV1;
  failure: SkillCheckOutcomeBranchV1;
  commitAuthority: false;
}

export interface PreparedSkillCheckOutcomeV1 {
  schemaVersion: 1;
  contractVersion: typeof SKILL_CHECK_OUTCOME_PREPARATION_CONTRACT_VERSION_V1;
  preparationId: string;
  checkId: string;
  rollId: string;
  outcome: "SUCCESS" | "FAILURE";
  consequence: {
    status: "PREPARED_NOT_COMMITTED";
    ownerDomain: string;
    effectType: string;
    effectPayload: JsonObject;
    retryDisposition: SkillCheckRetryDispositionV1;
    publicSourceRefs: string[];
    privateSourceRefs: string[];
    ruleRefs: string[];
  };
  timeAdvanceProposal: TimeAdvanceProposalV1;
  narrativeResume: {
    publicSummary: string;
    durationSeconds: number;
    outcome: "SUCCESS" | "FAILURE";
    allowedSourceRefs: string[];
    forbiddenChanges: string[];
    commitAuthority: false;
  };
  commitAuthority: false;
}

export async function prepareSkillCheckOutcomeV1(input: {
  campaignId: CampaignId;
  proposal: SkillCheckProposalV1;
  rollRecord: DiceRollRecordV1;
  policy: SkillCheckOutcomePolicyV1;
  observedAtGameSecond: number;
}): Promise<
  { ok: true; value: PreparedSkillCheckOutcomeV1 }
  | { ok: false; code: string; issues: string[] }
> {
  const issues = validateInput(input);
  if (issues.length > 0) return { ok: false, code: "INVALID_OUTCOME_PREPARATION_INPUT", issues };

  const fingerprint = await computeJsonFingerprint(input.proposal);
  if (fingerprint !== input.rollRecord.proposalFingerprint) {
    return { ok: false, code: "PROPOSAL_FINGERPRINT_MISMATCH", issues: ["persisted roll does not match proposal"] };
  }

  const outcome = input.rollRecord.resolution.outcome;
  const branch = outcome === "SUCCESS" ? input.policy.success : input.policy.failure;
  const durationSeconds = branch.durationSeconds;
  const timeAdvanceProposal: TimeAdvanceProposalV1 = {
    schemaVersion: 1,
    proposalId: `${input.rollRecord.rollId}:time`,
    campaignId: input.campaignId,
    requesterDomain: branch.ownerDomain,
    category: durationSeconds === 0 ? "NO_GAME_TIME" : "FIXED_RULE",
    observedAtGameSecond: input.observedAtGameSecond,
    duration: {
      recommendedSeconds: durationSeconds,
      minimumSeconds: durationSeconds,
      maximumSeconds: durationSeconds
    },
    source: durationSeconds === 0
      ? { kind: "NONE", id: null, version: null }
      : { kind: "RULE", id: branch.ruleRefs[0] ?? null, version: 1 },
    cause: { kind: "EVENT", id: `${input.rollRecord.operationId}:dice-roll-event` },
    processId: null,
    interruptible: false,
    dependencies: []
  };

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: SKILL_CHECK_OUTCOME_PREPARATION_CONTRACT_VERSION_V1,
      preparationId: `${input.rollRecord.rollId}:outcome-preparation:1`,
      checkId: input.proposal.checkId,
      rollId: input.rollRecord.rollId,
      outcome,
      consequence: {
        status: "PREPARED_NOT_COMMITTED",
        ownerDomain: branch.ownerDomain,
        effectType: branch.effectType,
        effectPayload: branch.effectPayload,
        retryDisposition: branch.retryDisposition,
        publicSourceRefs: unique(branch.publicSourceRefs),
        privateSourceRefs: unique(branch.privateSourceRefs),
        ruleRefs: unique(branch.ruleRefs)
      },
      timeAdvanceProposal,
      narrativeResume: {
        publicSummary: branch.publicSummary.trim(),
        durationSeconds,
        outcome,
        allowedSourceRefs: unique(branch.publicSourceRefs),
        forbiddenChanges: ["OUTCOME", "DURATION", "EFFECT", "RETRY_DISPOSITION"],
        commitAuthority: false
      },
      commitAuthority: false
    }
  };
}

function validateInput(input: {
  proposal: SkillCheckProposalV1;
  rollRecord: DiceRollRecordV1;
  policy: SkillCheckOutcomePolicyV1;
  observedAtGameSecond: number;
}): string[] {
  const issues: string[] = [];
  if (input.rollRecord.checkId !== input.proposal.checkId) issues.push("roll checkId mismatch");
  if (input.rollRecord.resolution.checkId !== input.proposal.checkId) issues.push("resolution checkId mismatch");
  if (input.policy.checkId !== input.proposal.checkId) issues.push("policy checkId mismatch");
  if (input.policy.commitAuthority !== false) issues.push("policy commitAuthority must be false");
  if (!Number.isInteger(input.observedAtGameSecond) || input.observedAtGameSecond < 0) {
    issues.push("observedAtGameSecond must be a non-negative integer");
  }
  for (const [name, branch] of [["success", input.policy.success], ["failure", input.policy.failure]] as const) {
    if (!branch.ownerDomain.trim()) issues.push(`${name}.ownerDomain is required`);
    if (!branch.effectType.trim()) issues.push(`${name}.effectType is required`);
    if (!branch.publicSummary.trim()) issues.push(`${name}.publicSummary is required`);
    if (!Number.isInteger(branch.durationSeconds) || branch.durationSeconds < 0) {
      issues.push(`${name}.durationSeconds must be a non-negative integer`);
    }
    if (branch.durationSeconds > 0 && branch.ruleRefs.length === 0) {
      issues.push(`${name}.ruleRefs is required for positive duration`);
    }
  }
  return issues;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
