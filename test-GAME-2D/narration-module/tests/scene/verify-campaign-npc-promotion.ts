import assert from "node:assert/strict";
import {
  createEmptyCampaignNpcRegistryV1,
  prepareCampaignNpcPromotionV1,
  type CampaignNpcPromotionCauseV1,
  type SceneActorRecordV1
} from "../../src/application";

const actor: SceneActorRecordV1 = {
  schemaVersion: 1,
  sceneId: "scene:inn",
  actorId: "scene:inn:ambient:copiste",
  displayName: "Copiste itinérant",
  publicRole: "Copiste de passage",
  visibleActivity: "classe ses feuillets",
  visibleAppearance: "doigts tachés d'encre",
  demeanor: "réservé",
  immediateGoal: "finir son classement",
  currentPressure: "la pluie retarde son départ",
  speechStyle: ["précis"],
  conversationalHooks: ["voyage"],
  boundaries: ["aucun engagement implicite"],
  knowledgeRefs: ["scene:inn"],
  keywords: ["copiste"],
  promotedByOperationId: "operation:first-speech",
  version: 1
};
const cause: CampaignNpcPromotionCauseV1 = {
  schemaVersion: 1,
  causeKind: "ONGOING_COMMITMENT",
  authority: "QUEST",
  durableRef: "quest:copy-lost-journal",
  publicSourceRefs: ["quest:copy-lost-journal", "event:commitment-accepted"],
  version: 1
};
const base = {
  campaignId: "campaign:test",
  operationId: "operation:promote-copiste",
  commandId: "command:promote-copiste",
  idempotencyKey: "idem:promote-copiste",
  sceneActor: actor,
  cause,
  registry: createEmptyCampaignNpcRegistryV1("campaign:test"),
  registryRevision: null
};

const prepared = prepareCampaignNpcPromotionV1(base);
assert.equal(prepared.ok, true);
if (!prepared.ok) throw new Error("promotion preparation rejected");
assert.equal(prepared.status, "READY");
if (prepared.status !== "READY") throw new Error("promotion should be ready");
assert.equal(prepared.command.commitAuthority, false);
assert.equal(prepared.npc.campaignNpcId, "campaign-npc:scene:inn:ambient:copiste");
assert.equal(prepared.npc.sourceRefs.includes("event:commitment-accepted"), true);
assert.equal(JSON.stringify(prepared.npc).includes(actor.immediateGoal), false, "local personality seed must not become a campaign fact");

const replay = prepareCampaignNpcPromotionV1({ ...base, registry: prepared.nextRegistry, registryRevision: 0 });
assert.equal(replay.ok, true);
if (!replay.ok) throw new Error("promotion replay rejected");
assert.equal(replay.status, "ALREADY_PROMOTED");
assert.equal(replay.command, null);
assert.equal(replay.nextRegistry.npcs.length, 1);

for (const invalidCause of [{
  ...cause,
  authority: "FACTION" as const
}, {
  ...cause,
  publicSourceRefs: ["secret:private-debt"]
}, {
  ...cause,
  durableRef: ""
}]) {
  const rejected = prepareCampaignNpcPromotionV1({ ...base, cause: invalidCause });
  assert.equal(rejected.ok, false);
}

const notSceneActor = prepareCampaignNpcPromotionV1({
  ...base,
  sceneActor: { ...actor, promotedByOperationId: "" }
});
assert.equal(notSceneActor.ok, false);

console.log("campaign-npc-promotion-command/1: authority, public sources and idempotence OK");
