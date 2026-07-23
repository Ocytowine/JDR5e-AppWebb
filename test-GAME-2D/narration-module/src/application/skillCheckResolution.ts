import type { JsonObject } from "../core";
import type { SkillCheckProposalV1 } from "./skillCheckProposal";

export const SKILL_CHECK_RESOLUTION_CONTRACT_VERSION_V1 = "skill-check-resolution/1" as const;

export interface SkillCheckResolutionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SKILL_CHECK_RESOLUTION_CONTRACT_VERSION_V1;
  resolutionId: string;
  checkId: string;
  dieRoll: number;
  abilityModifier: number;
  proficiencyContribution: number;
  totalModifier: number;
  total: number;
  dc: number;
  margin: number;
  outcome: "SUCCESS" | "FAILURE";
  naturalResult: "NATURAL_1" | "NATURAL_20" | "ORDINARY";
  appliedRuleRefs: string[];
  sourceRefs: string[];
  commitAuthority: false;
}

export function resolveSkillCheckRollV1(input: {
  resolutionId: string;
  proposal: SkillCheckProposalV1;
  dieRoll: number;
}): { ok: true; value: SkillCheckResolutionV1 } | { ok: false; code: string } {
  const proposal = input.proposal;
  if (proposal.difficulty.status !== "RULE_RESOLVED" || proposal.difficulty.dc === null) {
    return { ok: false, code: "DIFFICULTY_NOT_RESOLVED" };
  }
  if (proposal.characterContext === null) return { ok: false, code: "CHARACTER_CONTEXT_MISSING" };
  if (!Number.isInteger(input.dieRoll) || input.dieRoll < 1 || input.dieRoll > 20) {
    return { ok: false, code: "D20_OUT_OF_RANGE" };
  }
  if (proposal.advantageSources.length > 0 || proposal.disadvantageSources.length > 0) {
    return { ok: false, code: "ADVANTAGE_POLICY_NOT_OPEN" };
  }
  const character = proposal.characterContext;
  const proficiencyContribution = character.proficiencyBonus * character.proficiencyRank;
  const total = input.dieRoll + character.totalModifier;
  const margin = total - proposal.difficulty.dc;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: SKILL_CHECK_RESOLUTION_CONTRACT_VERSION_V1,
      resolutionId: input.resolutionId,
      checkId: proposal.checkId,
      dieRoll: input.dieRoll,
      abilityModifier: character.abilityModifier,
      proficiencyContribution,
      totalModifier: character.totalModifier,
      total,
      dc: proposal.difficulty.dc,
      margin,
      outcome: margin >= 0 ? "SUCCESS" : "FAILURE",
      naturalResult: input.dieRoll === 1 ? "NATURAL_1" : input.dieRoll === 20 ? "NATURAL_20" : "ORDINARY",
      appliedRuleRefs: [...proposal.ruleRefs],
      sourceRefs: [...proposal.sourceRefs],
      commitAuthority: false
    }
  };
}
