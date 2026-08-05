import type { JsonObject } from "../core";
import type {
  AbilityIdV1,
  NarrativeCharacterProjectionV1,
  TacticalCharacterProjectionV1
} from "../bootstrap/character/types";
import type { RuleRegistryV1 } from "../bootstrap/rules/RuleRegistry";
import type { DifficultyAssessmentV1 } from "./difficultyAssessment";

export const SKILL_CHECK_PROPOSAL_CONTRACT_VERSION_V1 = "skill-check-proposal/1" as const;
export const MECHANICAL_CHARACTER_CONTEXT_CONTRACT_VERSION_V1 = "mechanical-character-context/1" as const;

export type SkillProficiencyRankV1 = 0 | 1 | 2;

export interface RelevantMechanicalCharacterContextV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof MECHANICAL_CHARACTER_CONTEXT_CONTRACT_VERSION_V1;
  characterId: string;
  ability: AbilityIdV1;
  abilityModifier: number;
  proficiencyBonus: number;
  skillId: string | null;
  proficiencyRank: SkillProficiencyRankV1;
  totalModifier: number;
  passiveScore: number | null;
  backgroundId: string;
  sourceRefs: string[];
}

export interface SkillCheckProposalV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SKILL_CHECK_PROPOSAL_CONTRACT_VERSION_V1;
  checkId: string;
  domain: "perception" | "social" | "rules";
  goal: string;
  targetRef: string | null;
  ability: AbilityIdV1;
  skillId: string | null;
  characterContext: RelevantMechanicalCharacterContextV1 | null;
  difficulty: {
    status: "REQUIRES_ADJUDICATION" | "BAND_SELECTED" | "RULE_RESOLVED";
    dc: number | null;
    band: "VERY_EASY" | "EASY" | "MEDIUM" | "HARD" | "VERY_HARD" | "NEARLY_IMPOSSIBLE" | null;
    ruleRef: string | null;
    assessment: DifficultyAssessmentV1 | null;
  };
  passive: {
    eligible: boolean;
    score: number | null;
    reason: string;
  };
  advantageSources: string[];
  disadvantageSources: string[];
  stakes: {
    success: string;
    failure: string;
  };
  retryPolicy: "DOMAIN_TO_DECIDE";
  timeCost: "DOMAIN_TO_DECIDE";
  sourceRefs: string[];
  ruleRefs: string[];
  commitAuthority: false;
}

export function projectRelevantMechanicalCharacterContextV1(input: {
  tactical: TacticalCharacterProjectionV1;
  narrative: NarrativeCharacterProjectionV1;
  ability: AbilityIdV1;
  skillId: string | null;
  passiveScore?: number | null;
}): RelevantMechanicalCharacterContextV1 {
  if (input.tactical.characterId !== input.narrative.characterId) {
    throw new Error("character projection ids must match");
  }
  const skills = stringArray(input.narrative.privateMechanical.skills);
  const expertise = stringArray(input.narrative.privateMechanical.expertise);
  const skillId = input.skillId?.trim().toLowerCase() || null;
  const proficiencyRank: SkillProficiencyRankV1 = skillId !== null && expertise.includes(skillId)
    ? 2
    : skillId !== null && skills.includes(skillId)
      ? 1
      : 0;
  const abilityModifier = input.tactical.abilityModifiers[input.ability];
  const totalModifier = abilityModifier + input.tactical.proficiencyBonus * proficiencyRank;
  return {
    schemaVersion: 1,
    contractVersion: MECHANICAL_CHARACTER_CONTEXT_CONTRACT_VERSION_V1,
    characterId: input.tactical.characterId,
    ability: input.ability,
    abilityModifier,
    proficiencyBonus: input.tactical.proficiencyBonus,
    skillId,
    proficiencyRank,
    totalModifier,
    passiveScore: input.passiveScore === undefined ? null : input.passiveScore,
    backgroundId: input.narrative.backgroundId,
    sourceRefs: [
      `character.tactical-projection:${input.tactical.characterId}`,
      `character.narrative-projection:${input.narrative.characterId}`
    ]
  };
}

export function buildUnresolvedSkillCheckProposalV1(input: {
  checkId: string;
  domain: SkillCheckProposalV1["domain"];
  goal: string;
  targetRef: string | null;
  ability: AbilityIdV1;
  skillId: string | null;
  characterContext?: RelevantMechanicalCharacterContextV1 | null;
  passiveEligible: boolean;
  passiveReason: string;
  successStake: string;
  failureStake: string;
  sourceRefs: string[];
}): SkillCheckProposalV1 {
  const characterContext = input.characterContext ?? null;
  return {
    schemaVersion: 1,
    contractVersion: SKILL_CHECK_PROPOSAL_CONTRACT_VERSION_V1,
    checkId: input.checkId,
    domain: input.domain,
    goal: input.goal,
    targetRef: input.targetRef,
    ability: input.ability,
    skillId: input.skillId,
    characterContext,
    difficulty: {
      status: "REQUIRES_ADJUDICATION",
      dc: null,
      band: null,
      ruleRef: null,
      assessment: null
    },
    passive: {
      eligible: input.passiveEligible,
      score: input.passiveEligible ? characterContext?.passiveScore ?? null : null,
      reason: input.passiveReason
    },
    advantageSources: [],
    disadvantageSources: [],
    stakes: {
      success: input.successStake,
      failure: input.failureStake
    },
    retryPolicy: "DOMAIN_TO_DECIDE",
    timeCost: "DOMAIN_TO_DECIDE",
    sourceRefs: [...new Set(input.sourceRefs)],
    ruleRefs: [],
    commitAuthority: false
  };
}

export function selectSkillCheckDifficultyBandV1(
  proposal: SkillCheckProposalV1,
  assessment: DifficultyAssessmentV1
): SkillCheckProposalV1 {
  return {
    ...proposal,
    difficulty: {
      status: "BAND_SELECTED",
      dc: null,
      band: assessment.selectedBand,
      ruleRef: null,
      assessment
    },
    sourceRefs: [...new Set([...proposal.sourceRefs, ...assessment.publicSourceRefs])],
    ruleRefs: [...new Set([...proposal.ruleRefs, ...assessment.ruleRefs])]
  };
}

export function attachMechanicalCharacterContextV1(
  proposal: SkillCheckProposalV1,
  characterContext: RelevantMechanicalCharacterContextV1
): SkillCheckProposalV1 {
  if (proposal.ability !== characterContext.ability || proposal.skillId !== characterContext.skillId) {
    throw new Error("mechanical character context does not match proposed ability and skill");
  }
  return {
    ...proposal,
    characterContext,
    passive: {
      ...proposal.passive,
      score: proposal.passive.eligible ? characterContext.passiveScore : null
    },
    sourceRefs: [...new Set([...proposal.sourceRefs, ...characterContext.sourceRefs])]
  };
}

export async function resolveSkillCheckDifficultyV1(input: {
  proposal: SkillCheckProposalV1;
  registry: RuleRegistryV1;
}): Promise<{ ok: true; value: SkillCheckProposalV1 } | { ok: false; code: string }> {
  if (input.proposal.difficulty.status !== "BAND_SELECTED" || input.proposal.difficulty.band === null) {
    return { ok: false, code: "DIFFICULTY_BAND_NOT_SELECTED" };
  }
  const decision = await input.registry.execute(
    { ruleId: "core.check.difficulty-class", ruleVersion: 1 },
    { band: input.proposal.difficulty.band },
    input.proposal.sourceRefs
  );
  if (!decision.ok) return { ok: false, code: decision.code };
  const dc = decision.value.output.dc;
  if (typeof dc !== "number" || !Number.isInteger(dc)) return { ok: false, code: "INVALID_DIFFICULTY_OUTPUT" };
  const value: SkillCheckProposalV1 = {
    ...input.proposal,
    difficulty: {
      status: "RULE_RESOLVED",
      dc,
      band: input.proposal.difficulty.band,
      ruleRef: `${decision.value.ruleId}@${decision.value.ruleVersion}`,
      assessment: input.proposal.difficulty.assessment
    },
    ruleRefs: [...new Set([...input.proposal.ruleRefs, `${decision.value.ruleId}@${decision.value.ruleVersion}`])]
  };
  const validation = validateSkillCheckProposalV1(value);
  return validation.ok ? { ok: true, value } : { ok: false, code: "INVALID_SKILL_CHECK_PROPOSAL" };
}

export function validateSkillCheckProposalV1(proposal: SkillCheckProposalV1): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (!proposal.checkId.trim()) issues.push("checkId is required");
  if (!proposal.goal.trim()) issues.push("goal is required");
  if (!proposal.stakes.success.trim() || !proposal.stakes.failure.trim()) issues.push("success and failure stakes are required");
  if (proposal.commitAuthority !== false) issues.push("commitAuthority must be false");
  if (proposal.difficulty.status === "REQUIRES_ADJUDICATION") {
    if (proposal.difficulty.dc !== null || proposal.difficulty.band !== null || proposal.difficulty.ruleRef !== null || proposal.difficulty.assessment !== null) {
      issues.push("unresolved difficulty cannot contain dc, band, ruleRef or assessment");
    }
  } else if (proposal.difficulty.status === "BAND_SELECTED") {
    if (proposal.difficulty.dc !== null || proposal.difficulty.band === null || proposal.difficulty.ruleRef !== null || proposal.difficulty.assessment === null) {
      issues.push("selected difficulty requires band and assessment but no dc or ruleRef");
    }
  } else if (
    proposal.difficulty.dc === null ||
    proposal.difficulty.band === null ||
    proposal.difficulty.ruleRef === null ||
    proposal.difficulty.assessment === null
  ) {
    issues.push("resolved difficulty requires dc, band and ruleRef");
  }
  if (proposal.passive.eligible === false && proposal.passive.score !== null) {
    issues.push("ineligible passive resolution cannot expose a score");
  }
  if (
    proposal.characterContext !== null &&
    (proposal.characterContext.ability !== proposal.ability || proposal.characterContext.skillId !== proposal.skillId)
  ) {
    issues.push("character context must match proposed ability and skill");
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").map(entry => entry.trim().toLowerCase())
    : [];
}
