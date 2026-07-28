import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord
} from "../../src/core";
import {
  buildCampaignProjectedPlayableLoreSceneV1,
  buildLoreGuidedSceneCreationBriefFromCampaignV1,
  createCampaignLoreProjectionReaderV1,
  readEffectiveCampaignLoreProjectionsV1,
  recordCampaignLoreProjectionV1
} from "../../src/application";
import { buildArchiveLorePilotV1 } from "../../../src/narration-ui/archiveLorePilot";

async function main(): Promise<void> {
  const repository = new MemoryCampaignRepository();
  const campaignId = opaqueId<CampaignId>("campaign:lore-projection");
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId: opaqueId<AggregateId>("clock:lore-projection"),
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
    createdAt: "2026-07-28T12:00:00.000Z",
    updatedAt: "2026-07-28T12:00:00.000Z"
  };
  assert.equal((await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "calendar.test",
    calendarVersion: 1
  })).ok, true);
  const pilot = await buildArchiveLorePilotV1();
  const source = pilot.authoredSceneSourceBySceneId.get("wiki-location:archives_de_lysenthe");
  assert.ok(source);
  const initialCatalog = JSON.stringify(source);
  const target = source.packet.influences.find(influence =>
    influence.entityId === "archives_de_lysenthe" && influence.fieldPath === "/resume"
  );
  assert.ok(target, "the fixture must expose the authored summary influence");

  const empty = await readAt(0);
  assert.deepEqual(empty.projections, []);

  const replacementText = "Les Archives restent identifiables, mais leur accueil public est suspendu par un événement validé de campagne.";
  const replacement = await recordCampaignLoreProjectionV1({
    repository,
    campaignId,
    command: command("replace", "projection:archives:closed", "REPLACE", replacementText)
  });
  assert.equal(replacement.ok, true);
  if (!replacement.ok) throw new Error("replacement commit failed");
  assert.equal(replacement.value.projection.campaignRevision, 1);
  const replay = await recordCampaignLoreProjectionV1({
    repository,
    campaignId,
    command: command("replace", "projection:archives:closed", "REPLACE", replacementText)
  });
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.value.replayed, true);
  const conflict = await recordCampaignLoreProjectionV1({
    repository,
    campaignId,
    command: command("replace", "projection:archives:closed", "REPLACE", `${replacementText} Conflit.`)
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const revisionOne = await readAt(1);
  assert.equal(revisionOne.projections[0]?.replacementText, replacementText);
  const brief = await buildLoreGuidedSceneCreationBriefFromCampaignV1({
    briefId: "brief:archives:revision-1",
    campaignId,
    campaignRevision: 1,
    packet: source.packet,
    projectionReader: createCampaignLoreProjectionReaderV1({ repository, campaignId })
  });
  assert.equal(brief.ok, true);
  if (brief.ok) {
    const effective = brief.brief.strictConstraints.find(influence =>
      influence.entityId === "archives_de_lysenthe" && influence.fieldPath === "/resume"
    );
    assert.equal(effective?.effectiveText, replacementText);
    assert.equal(effective?.authority, "CAMPAIGN_PROJECTION");
    assert.ok(effective?.effectiveSourceRefs.includes("event:archives:replace"));
  }
  const projectedScene = await buildCampaignProjectedPlayableLoreSceneV1({
    repository,
    campaignId,
    campaignRevision: 1,
    entity: source.entity,
    fragments: source.fragments,
    packet: source.packet
  });
  assert.equal(projectedScene.ok, true);
  if (projectedScene.ok) assert.equal(projectedScene.value.scene.perceptibleSituation[0], replacementText);

  const withheld = await recordCampaignLoreProjectionV1({
    repository,
    campaignId,
    command: command("withhold", "projection:archives:summary-withheld", "WITHHOLD", null)
  });
  assert.equal(withheld.ok, true);
  const historical = await readAt(1);
  assert.equal(historical.projections[0]?.disposition, "REPLACE");
  const current = await readAt(2);
  assert.equal(current.projections[0]?.disposition, "WITHHOLD");
  const currentBrief = await buildLoreGuidedSceneCreationBriefFromCampaignV1({
    briefId: "brief:archives:revision-2",
    campaignId,
    campaignRevision: 2,
    packet: source.packet,
    projectionReader: createCampaignLoreProjectionReaderV1({ repository, campaignId })
  });
  assert.equal(currentBrief.ok, true);
  if (currentBrief.ok) {
    assert.ok(!currentBrief.brief.strictConstraints.some(influence =>
      influence.entityId === "archives_de_lysenthe" && influence.fieldPath === "/resume"
    ));
  }

  const privateSource = await recordCampaignLoreProjectionV1({
    repository,
    campaignId,
    command: {
      ...command("private", "projection:archives:private", "REPLACE", "Texte interdit."),
      publicSourceRefs: ["secret:archives"]
    }
  });
  assert.equal(privateSource.ok, false);
  assert.equal(JSON.stringify(source), initialCatalog, "campaign projections must not mutate the build catalog");
  console.log("campaign-lore-projection/1: priority, provenance, withholding, history, replay and immutability OK");

  async function readAt(campaignRevision: number) {
    return readEffectiveCampaignLoreProjectionsV1({
      repository,
      campaignId,
      request: {
        schemaVersion: 1,
        campaignId,
        campaignRevision,
        targets: [{ entityId: "archives_de_lysenthe", fieldPath: "/resume" }]
      }
    });
  }

  function command(
    suffix: string,
    projectionId: string,
    disposition: "REPLACE" | "WITHHOLD",
    replacementText: string | null
  ) {
    return {
      schemaVersion: 1 as const,
      contractVersion: "campaign-lore-projection-command/1" as const,
      clientRequestId: `campaign-lore-${suffix}`,
      projectionId,
      entityId: "archives_de_lysenthe",
      fieldPath: "/resume",
      disposition,
      replacementText,
      publicSourceRefs: [`event:archives:${suffix}`]
    };
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
