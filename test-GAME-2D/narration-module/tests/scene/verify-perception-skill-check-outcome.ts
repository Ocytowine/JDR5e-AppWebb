import assert from "node:assert/strict";
import { opaqueId, type CampaignId } from "../../src/core";
import {
  buildPerceptionSkillCheckOutcomePolicyV1,
  buildPerceptionSkillCheckOwnerResultV1,
  buildPendingNarrativeSkillCheckV1,
  buildUnresolvedSkillCheckProposalV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type PreparedSkillCheckOutcomeV1,
  type SkillCheckOutcomeBranchV1
} from "../../src/application";

const scene = {
  ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  sceneId: "scene:lamp-traces",
  perceptionClues: [{
    schemaVersion: 1 as const,
    clueId: "clue:checked-dust",
    targetRef: "element:lamp",
    visibility: "CHECKED" as const,
    factKind: "VISIBLE_SIGN" as const,
    playerText: "Une fine poussière claire borde le pied de la lampe.",
    sourceRefs: ["scene:lamp-traces", "clue:checked-dust"],
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

const proposal = buildUnresolvedSkillCheckProposalV1({
  checkId: "check:lamp-traces",
  domain: "perception",
  goal: "examiner les traces autour de la lampe",
  targetRef: "element:lamp",
  ability: "SAG",
  skillId: "perception",
  passiveEligible: false,
  passiveReason: "Recherche active.",
  successStake: "Révéler les signes visibles vérifiés.",
  failureStake: "Ne rien révéler de plus.",
  sourceRefs: ["scene:lamp-traces"]
});

function prepared(
  outcome: "SUCCESS" | "FAILURE",
  branch: SkillCheckOutcomeBranchV1
): PreparedSkillCheckOutcomeV1 {
  return {
    schemaVersion: 1,
    contractVersion: "skill-check-outcome-preparation/1",
    preparationId: `preparation:${outcome.toLowerCase()}`,
    checkId: proposal.checkId,
    rollId: `roll:${outcome.toLowerCase()}`,
    outcome,
    consequence: {
      status: "PREPARED_NOT_COMMITTED",
      ownerDomain: branch.ownerDomain,
      effectType: branch.effectType,
      effectPayload: branch.effectPayload,
      retryDisposition: branch.retryDisposition,
      publicSourceRefs: branch.publicSourceRefs,
      privateSourceRefs: branch.privateSourceRefs,
      ruleRefs: branch.ruleRefs
    },
    timeAdvanceProposal: {
      schemaVersion: 1,
      proposalId: `time:${outcome.toLowerCase()}`,
      campaignId: opaqueId<CampaignId>("campaign:perception"),
      requesterDomain: "perception",
      category: "FIXED_RULE",
      observedAtGameSecond: 40,
      duration: {
        recommendedSeconds: branch.durationSeconds,
        minimumSeconds: branch.durationSeconds,
        maximumSeconds: branch.durationSeconds
      },
      source: { kind: "RULE", id: branch.ruleRefs[0], version: 1 },
      cause: { kind: "EVENT", id: `event:${outcome.toLowerCase()}` },
      processId: null,
      interruptible: false,
      dependencies: []
    },
    narrativeResume: {
      publicSummary: branch.publicSummary,
      durationSeconds: branch.durationSeconds,
      outcome,
      allowedSourceRefs: branch.publicSourceRefs,
      forbiddenChanges: ["OUTCOME", "DURATION", "EFFECT", "RETRY_DISPOSITION"],
      commitAuthority: false
    },
    commitAuthority: false
  };
}

function run(): void {
  const pending = buildPendingNarrativeSkillCheckV1({
    operationId: "operation:lamp-search",
    sceneId: scene.sceneId,
    createdAt: "2026-07-27T12:00:00.000Z",
    perception: {
      schemaVersion: 1,
      contractVersion: "perception-resolution/1",
      status: "CHECK_REQUIRED",
      depth: "SEARCH",
      targetRef: proposal.targetRef,
      focus: proposal.goal,
      revealedClueRefs: [],
      revealedTexts: [],
      withheldClueRefs: ["clue:checked-dust", "clue:hidden-owner"],
      checkProposal: proposal,
      sourceRefs: ["scene:lamp-traces"]
    }
  });
  assert.equal(pending?.status, "AWAITING_SKILL_ROLL");
  assert.equal(pending?.proposal.checkId, proposal.checkId);
  assert.equal(pending?.commitAuthority, false);

  const policy = buildPerceptionSkillCheckOutcomePolicyV1({ proposal, scene, durationSeconds: 12 });
  assert.equal(policy.ok, true);
  if (!policy.ok) throw new Error("perception policy failed");
  assert.deepEqual(policy.value.success.effectPayload.revealedClueRefs, ["clue:checked-dust"]);
  assert.equal(JSON.stringify(policy.value.success.publicSummary).includes("bibliothécaire"), false);
  assert.deepEqual(policy.value.success.privateSourceRefs, ["secret:lamp-owner"]);

  const success = buildPerceptionSkillCheckOwnerResultV1({
    prepared: prepared("SUCCESS", policy.value.success),
    scene,
    currentAggregate: null
  });
  assert.equal(success.ok, true);
  if (!success.ok) throw new Error("success owner result failed");
  assert.deepEqual(success.value.nextPayload.revealedClueRefs, ["clue:checked-dust"]);
  assert.equal(JSON.stringify(success.value).includes("secret:lamp-owner"), false);
  assert.equal(JSON.stringify(success.value).includes("bibliothécaire"), false);

  const failure = buildPerceptionSkillCheckOwnerResultV1({
    prepared: prepared("FAILURE", policy.value.failure),
    scene,
    currentAggregate: null
  });
  assert.equal(failure.ok, true);
  if (!failure.ok) throw new Error("failure owner result failed");
  assert.deepEqual(failure.value.nextPayload.revealedClueRefs, []);
  assert.equal(failure.value.nextPayload.retryDisposition, "RETRY_REQUIRES_CONTEXT_CHANGE");

  const corrupted = prepared("FAILURE", policy.value.failure);
  corrupted.consequence.effectPayload = {
    ...corrupted.consequence.effectPayload,
    revealedClueRefs: ["clue:hidden-owner"],
    revealedTexts: ["Le bibliothécaire a déplacé la lampe."]
  };
  const rejected = buildPerceptionSkillCheckOwnerResultV1({
    prepared: corrupted,
    scene,
    currentAggregate: null
  });
  assert.equal(rejected.ok, false);

  console.log("perception-skill-check-outcome/1: checked visible clue only; failure and secrets remain sealed");
}

run();
