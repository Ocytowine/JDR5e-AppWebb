import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type OperationRecord
} from "../../src/core";
import {
  createCatalogMissionRelationRuntimeV1,
  interpretNarrativeInputV1,
  loadMissionRelationRegistryV1,
  loadSocialActorRegistryV1,
  missionDecisionFallbackV1,
  recordMissionOutcomeWithSocialEffectV1,
  resolveMissionRelationEngagementV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";

async function main(): Promise<void> {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>("campaign:mission-dialogue-j4");
  const now = "2026-08-20T12:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("clock:mission-dialogue-j4"),
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
  assert.equal((await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  })).ok, true);

  const rawInput = "Je demande au garde blessé de m'aider à retrouver un document.";
  const baseInterpretation = interpretNarrativeInputV1({ intentId: "intent:j4", rawInput });
  const target = { kind: "npc" as const, ref: "npc:npc-garde-blesse", label: "Garde blessé" };
  const interpretation = {
    ...baseInterpretation,
    target,
    semanticIntent: {
      ...baseInterpretation.semanticIntent,
      kind: "address_visible_actor" as const,
      target,
      commitment: "committed" as const,
      dialogueAct: {
        schemaVersion: 1 as const,
        act: "REQUEST_ACTION" as const,
        contentGoal: rawInput,
        addresseeRef: target.ref
      }
    },
    requiresClarification: false
  };
  const runtime = createCatalogMissionRelationRuntimeV1();
  const operation = {
    operationId: "operation:j4",
    clientRequestId: "request:j4"
  } as unknown as OperationRecord;
  const proposed = await runtime.proposeFromDialogue({
    repository,
    campaignId,
    operation,
    rawInput,
    interpretation,
    activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(proposed.ok, true);
  if (!proposed.ok || proposed.value === null) throw new Error("proposal was not persisted");
  assert.equal(proposed.value.engagement.status, "PROPOSED");
  assert.equal(proposed.value.ownerConfirmation, null);

  const replay = await runtime.proposeFromDialogue({
    repository,
    campaignId,
    operation,
    rawInput,
    interpretation,
    activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(replay.ok, true);
  if (!replay.ok || replay.value === null) throw new Error("proposal replay failed");
  assert.equal(replay.value.replayed, true);
  const registry = await loadMissionRelationRegistryV1(repository, campaignId);
  assert.equal(registry.ok, true);
  if (registry.ok) assert.equal(registry.value.state.engagements.length, 1);

  const acceptedRuntime = createCatalogMissionRelationRuntimeV1({
    decisionPolicy: {
      decide: () => ({ disposition: "ACCEPTED", conditions: [], publicSourceRefs: ["policy:test"] })
    }
  });
  const acceptedOperation = {
    operationId: "operation:j4:accepted",
    clientRequestId: "request:j4:accepted"
  } as unknown as OperationRecord;
  const accepted = await acceptedRuntime.proposeFromDialogue({
    repository,
    campaignId,
    operation: acceptedOperation,
    rawInput,
    interpretation,
    activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(accepted.ok, true);
  if (!accepted.ok || accepted.value === null) throw new Error("accepted mission missing");
  assert.equal(accepted.value.engagement.status, "ACCEPTED");
  const outcome = await recordMissionOutcomeWithSocialEffectV1({
    repository,
    campaignId,
    playerActorId: "player:j4",
    occurredAtGameSecond: 0,
    command: {
      schemaVersion: 1,
      contractVersion: "mission-outcome-command/1",
      clientRequestId: "request:j4:success",
      engagementId: accepted.value.engagement.engagementId,
      outcome: "SUCCESS",
      publicSummary: "Le document a été retrouvé et remis au garde.",
      publicSourceRefs: ["event:document-returned"],
      relationshipEffects: [{ axis: "trust", delta: 2 }]
    }
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) throw new Error("mission outcome failed");
  assert.equal(outcome.value.mission.engagement.missionOutcome?.outcome, "SUCCESS");
  const social = await loadSocialActorRegistryV1(repository, campaignId);
  assert.equal(social.ok, true);
  if (social.ok) {
    const relationship = social.value.state.actors
      .find(actor => actor.actorId === "npc-garde-blesse")?.relationships
      .find(edge => edge.targetActorId === "player:j4");
    assert.equal(relationship?.trust, 2);
    assert.equal(relationship?.affinity, 0);
  }

  for (const missionOutcome of ["FAILURE", "ABANDONED"] as const) {
    const outcomeOperation = {
      operationId: `operation:j4:${missionOutcome.toLowerCase()}`,
      clientRequestId: `request:j4:${missionOutcome.toLowerCase()}:proposal`
    } as unknown as OperationRecord;
    const mission = await acceptedRuntime.proposeFromDialogue({
      repository,
      campaignId,
      operation: outcomeOperation,
      rawInput,
      interpretation,
      activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
    });
    assert.equal(mission.ok, true);
    if (!mission.ok || mission.value === null) throw new Error(`${missionOutcome} mission missing`);
    const recorded = await recordMissionOutcomeWithSocialEffectV1({
      repository,
      campaignId,
      playerActorId: "player:j4",
      occurredAtGameSecond: 0,
      command: {
        schemaVersion: 1,
        contractVersion: "mission-outcome-command/1",
        clientRequestId: `request:j4:${missionOutcome.toLowerCase()}:outcome`,
        engagementId: mission.value.engagement.engagementId,
        outcome: missionOutcome,
        publicSummary: missionOutcome === "FAILURE"
          ? "Le document n'a pas pu être retrouvé."
          : "Le personnage renonce à rechercher le document.",
        publicSourceRefs: [`event:${missionOutcome.toLowerCase()}`],
        relationshipEffects: []
      }
    });
    assert.equal(recorded.ok, true);
    if (recorded.ok) assert.equal(recorded.value.mission.engagement.missionOutcome?.outcome, missionOutcome);
  }

  const conditionalRuntime = createCatalogMissionRelationRuntimeV1({
    decisionPolicy: {
      decide: () => ({ disposition: "CONDITIONAL", conditions: ["Reviens avec une preuve."], publicSourceRefs: ["policy:test"] })
    }
  });
  const conditional = await conditionalRuntime.proposeFromDialogue({
    repository,
    campaignId,
    operation: {
      operationId: "operation:j4:conditional",
      clientRequestId: "request:j4:conditional"
    } as unknown as OperationRecord,
    rawInput,
    interpretation,
    activeScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
  });
  assert.equal(conditional.ok, true);
  if (!conditional.ok || conditional.value === null) throw new Error("conditional mission missing");
  assert.equal(conditional.value.engagement.status, "CONDITIONAL");
  const reconsidered = await resolveMissionRelationEngagementV1({
    repository,
    campaignId,
    command: {
      schemaVersion: 1,
      contractVersion: "mission-relation-resolution-command/1",
      clientRequestId: "request:j4:conditional:accepted",
      engagementId: conditional.value.engagement.engagementId,
      resolution: {
        schemaVersion: 1,
        authority: "QUEST",
        evidenceKind: "QUEST_RESOLUTION",
        disposition: "ACCEPTED",
        conditions: [],
        publicSourceRefs: ["event:proof-returned"],
        authorityOperationId: "operation:j4:proof-returned",
        version: 1
      }
    }
  });
  assert.equal(reconsidered.ok, true);
  if (reconsidered.ok) assert.equal(reconsidered.value.engagement.status, "ACCEPTED");

  for (const disposition of ["ACCEPTED", "REFUSED", "CONDITIONAL", "UNCERTAIN"] as const) {
    const conditions = disposition === "CONDITIONAL" ? ["Reviens avec une preuve."] : [];
    const text = missionDecisionFallbackV1({ disposition, conditions }, "Réponse ordinaire.");
    assert.doesNotMatch(text, /ACCEPTED|REFUSED|CONDITIONAL|UNCERTAIN|commit|registre/iu);
    if (disposition === "CONDITIONAL") assert.match(text, /preuve/iu);
  }

  console.log("mission-dialogue-j4: natural decisions, reconsideration, all outcomes, relationship axis and replay verified");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
