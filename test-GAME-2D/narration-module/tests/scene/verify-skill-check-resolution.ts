import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord
} from "../../src/core";
import {
  assessDifficultyBandV1,
  attachMechanicalCharacterContextV1,
  buildActionAdjudicationDiagnosticLinesV1,
  buildUnresolvedSkillCheckProposalV1,
  loadPinnedNarrativeRuleRegistryV1,
  resolveSkillCheckDifficultyV1,
  resolveSkillCheckRollV1,
  selectSkillCheckDifficultyBandV1,
  type RelevantMechanicalCharacterContextV1
} from "../../src/application";

async function createCampaign(
  repository: MemoryCampaignRepository,
  campaignId: CampaignId,
  rulesetId: string,
  rulesetVersion: number
): Promise<void> {
  const now = "2026-07-23T12:00:00.000Z";
  const record: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>(`${campaignId}:clock`),
    dependencies: {
      contentPackageId: "content.jdr5e",
      contentPackageVersion: 1,
      rulesetId,
      rulesetVersion,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(record, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  });
  assert.equal(created.ok, true);
}

async function run(): Promise<void> {
  const repository = new MemoryCampaignRepository();
  const v2CampaignId = opaqueId<CampaignId>("campaign:rules-v2");
  const prototypeCampaignId = opaqueId<CampaignId>("campaign:prototype-rules");
  await createCampaign(repository, v2CampaignId, "rules.jdr5e", 2);
  await createCampaign(repository, prototypeCampaignId, "prototype.rules", 1);

  const pinned = await loadPinnedNarrativeRuleRegistryV1({ repository, campaignId: v2CampaignId });
  assert.equal(pinned.ok, true);
  if (!pinned.ok || pinned.value === null) throw new Error("V2 registry expected");
  const unsupported = await loadPinnedNarrativeRuleRegistryV1({ repository, campaignId: prototypeCampaignId });
  assert.deepEqual(unsupported, { ok: true, value: null });

  const unresolved = buildUnresolvedSkillCheckProposalV1({
    checkId: "check:search",
    domain: "perception",
    goal: "retrouver une piste",
    targetRef: "scene:test",
    ability: "SAG",
    skillId: "perception",
    passiveEligible: false,
    passiveReason: "Recherche active.",
    successStake: "La piste est retrouvée.",
    failureStake: "La piste reste introuvable.",
    sourceRefs: ["scene:test"]
  });
  const selected = selectSkillCheckDifficultyBandV1(
    unresolved,
    assessDifficultyBandV1({ baseBand: "MEDIUM", factors: [] })
  );
  const context: RelevantMechanicalCharacterContextV1 = {
    schemaVersion: 1,
    contractVersion: "mechanical-character-context/1",
    characterId: "character:test",
    ability: "SAG",
    abilityModifier: 3,
    proficiencyBonus: 2,
    skillId: "perception",
    proficiencyRank: 1,
    totalModifier: 5,
    passiveScore: 15,
    backgroundId: "eclaireur",
    sourceRefs: ["character:test"]
  };
  const enriched = attachMechanicalCharacterContextV1(selected, context);
  const difficulty = await resolveSkillCheckDifficultyV1({ proposal: enriched, registry: pinned.value });
  assert.equal(difficulty.ok, true);
  if (!difficulty.ok) throw new Error("difficulty resolution failed");
  assert.equal(difficulty.value.difficulty.dc, 15);
  assert.equal(difficulty.value.difficulty.ruleRef, "core.check.difficulty-class@1");
  const systemLines = buildActionAdjudicationDiagnosticLinesV1({
    schemaVersion: 1,
    contractVersion: "contextual-action-adjudication/1",
    disposition: "CHECK_REQUIRED",
    resolutionScope: "OBSERVATION_RESULT",
    reason: "Recherche incertaine.",
    targetRef: "scene:test",
    sourceRefs: ["scene:test"],
    ruleRefs: [],
    checkProposal: difficulty.value,
    commitAuthority: false
  });
  assert.equal(systemLines.some(line => /MEDIUM, DD 15/u.test(line)), true);
  assert.equal(systemLines.some(line => /core\.check\.difficulty-class@1/u.test(line)), true);

  const success = resolveSkillCheckRollV1({
    resolutionId: "roll:success",
    proposal: difficulty.value,
    dieRoll: 10
  });
  assert.equal(success.ok, true);
  if (success.ok) {
    assert.equal(success.value.total, 15);
    assert.equal(success.value.margin, 0);
    assert.equal(success.value.outcome, "SUCCESS");
    assert.equal(success.value.commitAuthority, false);
  }
  const failure = resolveSkillCheckRollV1({
    resolutionId: "roll:failure",
    proposal: difficulty.value,
    dieRoll: 9
  });
  assert.equal(failure.ok, true);
  if (failure.ok) assert.equal(failure.value.outcome, "FAILURE");

  const impossibleNaturalRule = {
    ...difficulty.value,
    difficulty: { ...difficulty.value.difficulty, dc: 30, band: "NEARLY_IMPOSSIBLE" as const }
  };
  const naturalTwenty = resolveSkillCheckRollV1({
    resolutionId: "roll:natural-20",
    proposal: impossibleNaturalRule,
    dieRoll: 20
  });
  assert.equal(naturalTwenty.ok, true);
  if (naturalTwenty.ok) {
    assert.equal(naturalTwenty.value.naturalResult, "NATURAL_20");
    assert.equal(naturalTwenty.value.outcome, "FAILURE");
  }
  assert.deepEqual(resolveSkillCheckRollV1({
    resolutionId: "roll:invalid",
    proposal: difficulty.value,
    dieRoll: 21
  }), { ok: false, code: "D20_OUT_OF_RANGE" });

  console.log("skill-check-resolution/1: pinned V2 DC and deterministic supplied d20 passed");
}

void run();
