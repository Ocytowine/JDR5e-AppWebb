import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  computeRequestFingerprint,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type IdempotencyKey,
  type OperationId,
  type OperationRecord,
  type RequestId
} from "../../src/core";
import {
  assessDifficultyBandV1,
  attachMechanicalCharacterContextV1,
  buildUnresolvedSkillCheckProposalV1,
  loadPinnedNarrativeRuleRegistryV1,
  persistSkillCheckDiceRollV1,
  resolveSkillCheckDifficultyV1,
  selectSkillCheckDifficultyBandV1,
  type D20SourceV1,
  type RelevantMechanicalCharacterContextV1
} from "../../src/application";

class CountingD20Source implements D20SourceV1 {
  readonly sourceId = "test-sequence";
  calls = 0;
  constructor(private readonly values: number[]) {}
  nextD20(): number {
    const value = this.values[this.calls];
    this.calls += 1;
    if (value === undefined) throw new Error("test d20 source exhausted");
    return value;
  }
}

async function run(): Promise<void> {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>("campaign:dice-roll");
  const now = "2026-07-23T14:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("campaign:dice-roll:clock"),
    dependencies: {
      contentPackageId: "content.jdr5e",
      contentPackageVersion: 1,
      rulesetId: "rules.jdr5e",
      rulesetVersion: 2,
      calendarId: "calendar.test",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  });
  assert.equal(created.ok, true);

  const registry = await loadPinnedNarrativeRuleRegistryV1({ repository, campaignId });
  if (!registry.ok || registry.value === null) throw new Error("ruleset V2 required");
  const baseProposal = buildUnresolvedSkillCheckProposalV1({
    checkId: "check:door-search",
    domain: "perception",
    goal: "examiner le mécanisme",
    targetRef: "poi:door",
    ability: "SAG",
    skillId: "perception",
    passiveEligible: false,
    passiveReason: "Recherche active.",
    successStake: "Le mécanisme est compris.",
    failureStake: "Le mécanisme reste indéterminé.",
    sourceRefs: ["scene:test"]
  });
  const selected = selectSkillCheckDifficultyBandV1(
    baseProposal,
    assessDifficultyBandV1({ baseBand: "MEDIUM", factors: [] })
  );
  const character: RelevantMechanicalCharacterContextV1 = {
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
  const enriched = attachMechanicalCharacterContextV1(selected, character);
  const resolved = await resolveSkillCheckDifficultyV1({ proposal: enriched, registry: registry.value });
  if (!resolved.ok) throw new Error("difficulty resolution failed");

  const requestPayload = { checkId: resolved.value.checkId, proposalFingerprint: "derived-by-service" };
  const requestFingerprint = await computeRequestFingerprint("rules.skill-check.roll", 1, requestPayload);
  const operation: OperationRecord = {
    schemaVersion: 1,
    operationId: opaqueId<OperationId>("operation:dice-roll"),
    campaignId,
    clientRequestId: opaqueId<RequestId>("request:dice-roll"),
    idempotencyKey: opaqueId<IdempotencyKey>("idempotency:dice-roll"),
    requestFingerprint,
    operationKind: "rules.skill-check.roll",
    requestPayloadSchemaVersion: 1,
    requestPayload,
    phase: "RECEIVED",
    observedCampaignRevision: 0,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  };
  const received = await repository.receiveOperation(operation);
  if (!received.ok) throw new Error(received.error.messageKey);
  const source = new CountingD20Source([7, 20]);
  const first = await persistSkillCheckDiceRollV1({
    repository,
    campaignId,
    operation: received.value,
    proposal: resolved.value,
    d20Source: source
  });
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("first dice roll failed");
  assert.equal(first.value.replayed, false);
  assert.equal(first.value.record.resolution.dieRoll, 7);
  assert.equal(first.value.record.resolution.total, 12);
  assert.equal(source.calls, 1);

  const replayed = await persistSkillCheckDiceRollV1({
    repository,
    campaignId,
    operation: received.value,
    proposal: resolved.value,
    d20Source: source
  });
  assert.equal(replayed.ok, true);
  if (!replayed.ok) throw new Error("dice roll replay failed");
  assert.equal(replayed.value.replayed, true);
  assert.equal(replayed.value.record.resolution.dieRoll, 7);
  assert.equal(source.calls, 1, "replay must not consume a second d20");

  const conflictingProposal = {
    ...resolved.value,
    stakes: { ...resolved.value.stakes, success: "Une autre conséquence." }
  };
  const conflict = await persistSkillCheckDiceRollV1({
    repository,
    campaignId,
    operation: received.value,
    proposal: conflictingProposal,
    d20Source: source
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(source.calls, 1);

  const events = await repository.listEvents(campaignId, null, 20);
  if (!events.ok) throw new Error(events.error.messageKey);
  assert.equal(events.value.filter(event => event.eventType === "rules.skill-check.rolled").length, 1);
  console.log("dice-roll-record/1: one persisted d20, replay stable, conflict rejected");
}

void run();
