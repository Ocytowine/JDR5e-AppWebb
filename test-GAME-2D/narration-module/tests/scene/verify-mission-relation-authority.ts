import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord
} from "../../src/core";
import {
  loadMissionRelationRegistryV1,
  proposeMissionRelationEngagementV1,
  resolveMissionRelationEngagementV1,
  verifyDurableNpcCauseConfirmationV1,
  type MissionRelationDispositionV1
} from "../../src/application";

async function main(): Promise<void> {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>("campaign:mission-relation");
  const now = "2026-07-28T12:00:00.000Z";
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("clock:mission-relation"),
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

  const acceptedProposal = await propose("accepted", "MISSION");
  assert.equal(acceptedProposal.ok, true);
  const acceptedReplay = await propose("accepted", "MISSION");
  assert.equal(acceptedReplay.ok, true);
  if (acceptedReplay.ok) assert.equal(acceptedReplay.value.replayed, true);
  const accepted = await resolve("accepted", "ACCEPTED", "QUEST", []);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) throw new Error("accepted resolution failed");
  assert.ok(accepted.value.ownerConfirmation);
  assert.equal(accepted.value.ownerConfirmation?.cause.causeKind, "ONGOING_COMMITMENT");
  assert.equal(accepted.value.ownerConfirmation?.cause.authority, "QUEST");
  const acceptedResolutionReplay = await resolve("accepted", "ACCEPTED", "QUEST", []);
  assert.equal(acceptedResolutionReplay.ok, true);
  if (acceptedResolutionReplay.ok) assert.equal(acceptedResolutionReplay.value.replayed, true);
  const conflictingAcceptedResolution = await resolveMissionRelationEngagementV1({
    repository,
    campaignId,
    command: {
      ...resolutionCommand("accepted", "ACCEPTED", "QUEST", []),
      resolution: {
        ...resolutionCommand("accepted", "ACCEPTED", "QUEST", []).resolution,
        publicSourceRefs: ["event:accepted:conflicting"]
      }
    }
  });
  assert.equal(conflictingAcceptedResolution.ok, false);
  if (!conflictingAcceptedResolution.ok) {
    assert.equal(conflictingAcceptedResolution.error.code, "IDEMPOTENCY_CONFLICT");
  }

  const verified = await verifyDurableNpcCauseConfirmationV1({
    repository,
    campaignId,
    sceneId: "scene:inn",
    sceneActorId: "scene:inn:ambient:copiste",
    confirmation: accepted.value.ownerConfirmation!
  });
  assert.equal(verified.ok, true, "an accepted persisted owner decision must be verifiable");
  const forged = await verifyDurableNpcCauseConfirmationV1({
    repository,
    campaignId,
    sceneId: "scene:inn",
    sceneActorId: "scene:inn:ambient:copiste",
    confirmation: {
      ...accepted.value.ownerConfirmation!,
      cause: { ...accepted.value.ownerConfirmation!.cause, durableRef: "quest:forged" }
    }
  });
  assert.equal(forged.ok, false, "a caller cannot alter a persisted confirmation");

  await propose("refused", "MISSION");
  const refused = await resolve("refused", "REFUSED", "QUEST", []);
  assert.equal(refused.ok, true);
  if (refused.ok) assert.equal(refused.value.ownerConfirmation, null);

  await propose("conditional", "RELATION");
  const conditional = await resolve("conditional", "CONDITIONAL", "SOCIAL", ["Obtenir d'abord l'accord de la guilde."]);
  assert.equal(conditional.ok, true);
  if (conditional.ok) assert.equal(conditional.value.ownerConfirmation, null);

  await propose("accepted-relation", "RELATION");
  const acceptedRelation = await resolve("accepted-relation", "ACCEPTED", "SOCIAL", []);
  assert.equal(acceptedRelation.ok, true);
  if (acceptedRelation.ok) {
    assert.equal(acceptedRelation.value.ownerConfirmation?.cause.causeKind, "RELATION_CONFIRMED");
    assert.equal(acceptedRelation.value.ownerConfirmation?.cause.authority, "SOCIAL");
  }

  await propose("uncertain", "RELATION");
  const uncertain = await resolve("uncertain", "UNCERTAIN", "SOCIAL", []);
  assert.equal(uncertain.ok, true);
  if (uncertain.ok) assert.equal(uncertain.value.ownerConfirmation, null);

  await propose("wrong-authority", "RELATION");
  const wrongAuthority = await resolve("wrong-authority", "ACCEPTED", "QUEST", []);
  assert.equal(wrongAuthority.ok, false, "quest authority cannot confirm a social relation");

  const invalidConditional = await resolveMissionRelationEngagementV1({
    repository,
    campaignId,
    command: resolutionCommand("accepted", "CONDITIONAL", "QUEST", [])
  });
  assert.equal(invalidConditional.ok, false, "a conditional decision requires explicit conditions");

  const loaded = await loadMissionRelationRegistryV1(repository, campaignId);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) throw new Error("mission relation registry failed to load");
  assert.deepEqual(
    Object.fromEntries(loaded.value.state.engagements.map(entry => [entry.engagementId, entry.status])),
    {
      "engagement:accepted": "ACCEPTED",
      "engagement:refused": "REFUSED",
      "engagement:conditional": "CONDITIONAL",
      "engagement:accepted-relation": "ACCEPTED",
      "engagement:uncertain": "UNCERTAIN",
      "engagement:wrong-authority": "PROPOSED"
    }
  );
  const events = await repository.listEvents(campaignId, null, 50);
  assert.equal(events.ok, true);
  if (events.ok) {
    assert.equal(events.value.filter(event => event.eventType === "mission-relation.accepted").length, 2);
    assert.equal(events.value.filter(event => event.eventType === "mission-relation.refused").length, 1);
  }

  console.log("mission-relation-authority/1: proposal, accepted/refused/conditional/uncertain decisions, ownership and replay OK");

  async function propose(id: string, kind: "MISSION" | "RELATION") {
    return proposeMissionRelationEngagementV1({
      repository,
      campaignId,
      command: {
        schemaVersion: 1,
        contractVersion: "mission-relation-proposal-command/1",
        clientRequestId: `proposal-${id}`,
        engagementId: `engagement:${id}`,
        engagementKind: kind,
        sceneId: "scene:inn",
        sceneActorId: "scene:inn:ambient:copiste",
        durableRef: `${kind === "MISSION" ? "quest" : "relation"}:${id}`,
        summary: `Proposition ${id}`,
        proposedBy: "PLAYER",
        publicSourceRefs: [`dialogue:${id}:proposal`]
      }
    });
  }

  async function resolve(
    id: string,
    disposition: MissionRelationDispositionV1,
    authority: "QUEST" | "SOCIAL",
    conditions: string[]
  ) {
    return resolveMissionRelationEngagementV1({
      repository,
      campaignId,
      command: resolutionCommand(id, disposition, authority, conditions)
    });
  }
}

function resolutionCommand(
  id: string,
  disposition: MissionRelationDispositionV1,
  authority: "QUEST" | "SOCIAL",
  conditions: string[]
) {
  return {
    schemaVersion: 1 as const,
    contractVersion: "mission-relation-resolution-command/1" as const,
    clientRequestId: `resolution-${id}-${disposition.toLowerCase()}`,
    engagementId: `engagement:${id}`,
    resolution: {
      schemaVersion: 1 as const,
      disposition,
      authority,
      evidenceKind: authority === "QUEST" ? "QUEST_RESOLUTION" as const : "SOCIAL_RESOLUTION" as const,
      authorityOperationId: `${authority.toLowerCase()}-resolution:${id}`,
      publicSourceRefs: [`event:${id}:${disposition.toLowerCase()}`],
      conditions,
      version: 1 as const
    }
  };
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
