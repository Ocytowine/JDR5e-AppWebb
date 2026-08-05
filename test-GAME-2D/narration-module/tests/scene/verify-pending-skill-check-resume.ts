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
  NarrativeTurnControllerV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type D20SourceV1,
  type PendingNarrativeSkillCheckV1,
  type SkillCheckProposalV1
} from "../../src/application";

class CountingD20 implements D20SourceV1 {
  readonly sourceId = "test-counting-d20";
  calls = 0;
  constructor(private readonly value: number) {}
  nextD20(): number {
    this.calls += 1;
    return this.value;
  }
}

const scene = {
  ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  sceneId: "scene:resume-perception",
  perceptionClues: [{
    schemaVersion: 1 as const,
    clueId: "clue:checked-dust",
    targetRef: "element:lamp",
    visibility: "CHECKED" as const,
    factKind: "VISIBLE_SIGN" as const,
    playerText: "Une fine poussière claire borde le pied de la lampe.",
    sourceRefs: ["scene:resume-perception", "clue:checked-dust"],
    version: 1 as const
  }, {
    schemaVersion: 1 as const,
    clueId: "clue:hidden-owner",
    targetRef: "element:lamp",
    visibility: "CHECKED" as const,
    factKind: "HIDDEN_FACT" as const,
    playerText: "Le bibliothécaire a déplacé la lampe.",
    sourceRefs: ["secret:lamp-owner"],
    version: 1 as const
  }]
};

const proposal: SkillCheckProposalV1 = {
  schemaVersion: 1,
  contractVersion: "skill-check-proposal/1",
  checkId: "check:resume-lamp",
  domain: "perception",
  goal: "examiner les traces autour de la lampe",
  targetRef: "element:lamp",
  ability: "SAG",
  skillId: "perception",
  characterContext: {
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
  },
  difficulty: {
    status: "RULE_RESOLVED",
    dc: 15,
    band: "MEDIUM",
    ruleRef: "core.check.difficulty-class@1",
    assessment: {
      schemaVersion: 1,
      contractVersion: "difficulty-assessment/1",
      assessmentId: "difficulty:resume-lamp",
      domain: "perception",
      baseBand: "MEDIUM",
      selectedBand: "MEDIUM",
      netShift: 0,
      totalShift: 0,
      publicReasons: [],
      privateFactorCount: 0,
      publicSourceRefs: ["scene:resume-perception"],
      privateSourceRefs: [],
      ruleRefs: ["core.check.difficulty-assessment@1"],
      commitAuthority: false
    }
  },
  passive: { eligible: false, score: null, reason: "Recherche active." },
  advantageSources: [],
  disadvantageSources: [],
  stakes: { success: "Révéler les signes vérifiés.", failure: "Ne rien révéler de plus." },
  retryPolicy: "DOMAIN_TO_DECIDE",
  timeCost: "DOMAIN_TO_DECIDE",
  sourceRefs: ["scene:resume-perception"],
  ruleRefs: ["core.check.difficulty-class@1"],
  commitAuthority: false
};

async function setup(suffix: string, die: number) {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>(`campaign:pending-resume:${suffix}`);
  const now = "2026-07-27T12:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>(`clock:pending-resume:${suffix}`),
    dependencies: {
      contentPackageId: "content.test",
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
  const sourceOperationId = opaqueId<OperationId>(`operation:source-search:${suffix}`);
  const sourcePayload = { rawInput: "J'examine attentivement la lampe." };
  const sourceFingerprint = await computeRequestFingerprint("narrative.turn.input", 1, sourcePayload);
  const sourceOperation: OperationRecord = {
    schemaVersion: 1,
    operationId: sourceOperationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>(`request:source-search:${suffix}`),
    idempotencyKey: opaqueId<IdempotencyKey>(`idempotency:source-search:${suffix}`),
    requestFingerprint: sourceFingerprint,
    operationKind: "narrative.turn.input",
    requestPayloadSchemaVersion: 1,
    requestPayload: sourcePayload,
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
  const received = await repository.receiveOperation(sourceOperation);
  assert.equal(received.ok, true);
  const pending: PendingNarrativeSkillCheckV1 = {
    schemaVersion: 1,
    contractVersion: "pending-narrative-skill-check/1",
    pendingCheckId: `${proposal.checkId}:pending`,
    sourceOperationId,
    sceneId: scene.sceneId,
    status: "AWAITING_SKILL_ROLL",
    proposal,
    ownerContext: { owner: "PERCEPTION" },
    createdAt: now,
    commitAuthority: false
  };
  const completed = await repository.completeWithoutCommit(sourceOperationId, 1, { pendingSkillCheck: pending });
  assert.equal(completed.ok, true);
  const d20 = new CountingD20(die);
  const controller = new NarrativeTurnControllerV1({
    repository,
    campaignId,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    activeSceneResolver: { resolve: async () => ({ ok: true, value: scene }) },
    d20Source: d20
  });
  return { repository, campaignId, controller, d20, pending, sourceOperationId };
}

async function run(): Promise<void> {
  const success = await setup("success", 15);
  const command = {
    schemaVersion: 1 as const,
    clientRequestId: "request:roll-resume-success",
    sourceOperationId: success.sourceOperationId,
    pendingCheckId: success.pending.pendingCheckId
  };
  const first = await success.controller.rollPendingSkillCheck(command);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("first pending roll failed");
  assert.equal(first.value.prepared.outcome, "SUCCESS");
  assert.equal(first.value.prepared.narrativeResume.publicSummary.includes("poussière"), true);
  assert.equal(JSON.stringify(first.value).includes("bibliothécaire"), false);
  assert.equal(first.value.displayPacket.displayBlocks.some(block =>
    block.kind === "GM_NARRATION" && block.text.includes("poussière")
  ), true);
  assert.equal(first.value.displayPacket.displayBlocks.some(block =>
    block.kind === "SYSTEM_NOTICE" && /d20=15.*total=20.*DD=15.*temps=12 s/u.test(block.text)
  ), true);
  assert.equal(success.d20.calls, 1);

  const reloadedController = new NarrativeTurnControllerV1({
    repository: success.repository,
    campaignId: success.campaignId,
    intentInterpreterConfig: null,
    mjPlannerConfig: null,
    npcPerformerConfig: null,
    activeSceneResolver: { resolve: async () => ({ ok: true, value: scene }) },
    d20Source: success.d20
  });
  const replay = await reloadedController.rollPendingSkillCheck(command);
  assert.equal(replay.ok, true);
  if (!replay.ok) throw new Error("replayed pending roll failed");
  assert.equal(replay.value.commit.commitId, first.value.commit.commitId);
  assert.equal(replay.value.replayed, true);
  assert.deepEqual(replay.value.prepared, first.value.prepared);
  assert.deepEqual(replay.value.displayPacket, first.value.displayPacket);
  assert.equal(success.d20.calls, 1, "double click after reload must not consume another d20");
  const restoredPackets = await reloadedController.restoreSkillCheckResultPackets();
  assert.equal(restoredPackets.ok, true);
  if (restoredPackets.ok) assert.deepEqual(restoredPackets.value, [first.value.displayPacket]);
  const restoredPending = await reloadedController.restorePendingSkillCheck();
  assert.equal(restoredPending.ok, true);
  if (restoredPending.ok) assert.equal(restoredPending.value, null);
  const clock = await success.repository.getAggregate(
    success.campaignId,
    "world.clock",
    opaqueId<AggregateId>("clock:pending-resume:success")
  );
  assert.equal(clock.ok, true);
  if (clock.ok) assert.equal(clock.value.payload.elapsedGameSeconds, 12);

  const failure = await setup("failure", 2);
  const failed = await failure.controller.rollPendingSkillCheck({
    schemaVersion: 1,
    clientRequestId: "request:roll-resume-failure",
    sourceOperationId: failure.sourceOperationId,
    pendingCheckId: failure.pending.pendingCheckId
  });
  assert.equal(failed.ok, true);
  if (!failed.ok) throw new Error("failure pending roll failed");
  assert.equal(failed.value.prepared.outcome, "FAILURE");
  assert.equal(failed.value.prepared.consequence.retryDisposition, "RETRY_REQUIRES_CONTEXT_CHANGE");
  assert.deepEqual(failed.value.prepared.consequence.effectPayload.revealedClueRefs, []);

  console.log("pending skill-check resume: success, failure, reload and double-click are deterministic");
}

void run();
