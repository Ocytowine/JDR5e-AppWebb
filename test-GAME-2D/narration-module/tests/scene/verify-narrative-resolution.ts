import assert from "node:assert/strict";
import {
  MemoryCampaignRepository,
  opaqueId,
  type AggregateId,
  type CampaignClockPayload,
  type CampaignId,
  type CampaignRecord,
  type EventCursor,
  type RepositoryClock
} from "../../src/core";
import { NarrativeTurnControllerV1 } from "../../src/application";

class FixedClock implements RepositoryClock {
  constructor(private readonly instant = new Date("2026-07-07T12:00:00.000Z")) {}
  now(): Date {
    return new Date(this.instant);
  }
}

async function main(): Promise<void> {
  const clock = new FixedClock();
  const repository = new MemoryCampaignRepository({ clock });
  const campaignId = opaqueId<CampaignId>("cmp-resolution-test");
  const clockAggregateId = opaqueId<AggregateId>("agg-resolution-clock");
  const now = clock.now().toISOString();
  const campaign: CampaignRecord = {
    schemaVersion: 1,
    campaignId,
    campaignRevision: 0,
    status: "ACTIVE",
    clockAggregateId,
    dependencies: {
      contentPackageId: "prototype.narration",
      contentPackageVersion: 1,
      rulesetId: "prototype.rules",
      rulesetVersion: 1,
      calendarId: "prototype.calendar",
      calendarVersion: 1
    },
    writeBlock: null,
    lastCommitId: null,
    createdAt: now,
    updatedAt: now
  };
  const created = await repository.createCampaign(campaign, {
    elapsedGameSeconds: 0,
    calendarId: "prototype.calendar",
    calendarVersion: 1
  });
  if (!created.ok) throw new Error(created.error.messageKey);

  const controller = new NarrativeTurnControllerV1({ repository, campaignId, clock, idPrefix: "res" });

  const possibility = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-resolution-possibility",
    rawInput: "Est-ce que je peux voler la bourse du garde ?"
  });
  if (!possibility.ok) throw new Error(possibility.error.messageKey);
  assert.equal(possibility.value.output.resolution.resultKind, "NO_COMMIT_RESPONSE");
  assert.equal(possibility.value.output.noCommit, true);
  assert.equal(possibility.value.operation.commitId, null);
  assert.match(possibility.value.output.displayPacket.displayBlocks.at(-1)?.text ?? "", /Aucune action/);

  const steal = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-resolution-steal",
    rawInput: "Je vole la bourse du garde"
  });
  if (!steal.ok) throw new Error(steal.error.messageKey);
  assert.equal(steal.value.output.resolution.resultKind, "HANDOFF_REQUIRED");
  assert.equal(steal.value.output.resolution.handoff?.target, "INVENTORY");
  assert.equal(steal.value.operation.commitId, null);

  const attack = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-resolution-attack",
    rawInput: "J'attaque le garde"
  });
  if (!attack.ok) throw new Error(attack.error.messageKey);
  assert.equal(attack.value.output.resolution.resultKind, "HANDOFF_REQUIRED");
  assert.equal(attack.value.output.resolution.handoff?.target, "TACTICAL");
  assert.match(attack.value.output.displayPacket.displayBlocks.at(-1)?.text ?? "", /handoff tactique/i);

  const speech = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-resolution-speech",
    rawInput: "Je dis au garde que je cherche les archives"
  });
  if (!speech.ok) throw new Error(speech.error.messageKey);
  assert.equal(speech.value.output.resolution.resultKind, "COMMIT_APPLIED");
  assert.equal(speech.value.output.noCommit, false);
  assert.equal(speech.value.operation.completionMode, "COMMITTED_RENDERED");
  assert.notEqual(speech.value.operation.commitId, null);
  assert.equal(speech.value.output.resolution.characterExpression?.preservedMeaning, true);
  assert.deepEqual(speech.value.output.resolution.characterExpression?.addedCommitments, []);
  assert.match(speech.value.output.resolution.characterExpression?.expressionText ?? "", /archives/);
  assert.match(speech.value.output.displayPacket.displayBlocks.at(-1)?.text ?? "", /Parole enregistrée/);

  const replay = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-resolution-speech",
    rawInput: "Je dis au garde que je cherche les archives"
  });
  if (!replay.ok) throw new Error(replay.error.messageKey);
  assert.deepEqual(replay.value.output, speech.value.output);

  const conflict = await controller.submit({
    schemaVersion: 1,
    clientRequestId: "req-resolution-speech",
    rawInput: "Je mens au garde"
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const clockAggregate = await repository.getAggregate(campaignId, "world.clock", clockAggregateId);
  if (!clockAggregate.ok) throw new Error(clockAggregate.error.messageKey);
  assert.equal((clockAggregate.value.payload as CampaignClockPayload).elapsedGameSeconds, 0);

  const events = await repository.listEvents(campaignId, null as EventCursor | null, 20);
  if (!events.ok) throw new Error(events.error.messageKey);
  assert.equal(events.value.filter(event => event.eventType === "social.speech-act.recorded").length, 1);
  assert.equal(events.value.some(event => event.eventType.includes("combat")), false);

  console.log("narrative-resolution/1: OK");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
