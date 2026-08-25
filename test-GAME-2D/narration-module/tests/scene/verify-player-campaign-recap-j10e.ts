import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildPlayerPublicContextV1,
  composePlayerCampaignRecapV1,
  projectPlayerChronicleSummaryV1,
  projectPlayerCompanionSummaryV1,
  projectPlayerEngagementSummaryV1,
  projectPlayerInventorySummaryV1,
  projectPlayerPlotSummaryV1,
  projectPlayerTravelSummaryV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  type CompanionPartyRegistryV1,
  type InterpreterCharacterContextV1,
  type MissionRelationRegistryV1,
  type PlotRegistryV1
} from "../../src/application";
import type { CharacterAggregatePayloadV1 } from "../../src/bootstrap";

const privateCanaries = [
  "SECRET-VERITE-J10E",
  "SECRET-PRESSION-SOCIALE-J10E",
  "SECRET-AUTONOMIE-J10E",
  "SECRET-INVENTAIRE-MARCHAND-J10E",
  "SECRET-CARNET-J10E"
];

async function main(): Promise<void> {
  const context = buildPlayerPublicContextV1({
    activeScene: { ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1, playerKnownFacts: ["Une porte a été forcée."] },
    characterContext: {
      schemaVersion: 1,
      contractVersion: "interpreter-character-context/1",
      character: { ref: "character:elwen", label: "Elwen" },
      references: [],
      deliberatelyExcluded: [],
      authority: "READ_ONLY",
      noCommit: true,
      noGameTime: true,
      sourceVersions: {}
    } as unknown as InterpreterCharacterContextV1,
    acquiredKnowledge: [
      { schemaVersion: 1, claimRef: "claim:heard", subjectRef: "place:archives", subjectKind: "PLACE", subjectLabel: "Archives", proposition: "Un témoin a entendu une cloche.", status: "HEARD", attributedSpeakerRefs: ["npc:witness"], channelRefs: ["testimony:1"], assertsObjectiveTruth: false },
      { schemaVersion: 1, claimRef: "claim:confirmed", subjectRef: "place:archives", subjectKind: "PLACE", subjectLabel: "Archives", proposition: "La serrure appartient aux Archives.", status: "CONFIRMED", attributedSpeakerRefs: [], channelRefs: ["evidence:1"], assertsObjectiveTruth: false },
      { schemaVersion: 1, claimRef: "claim:refuted", subjectRef: "place:archives", subjectKind: "PLACE", subjectLabel: "Archives", proposition: "La fenêtre était ouverte.", status: "REFUTED", attributedSpeakerRefs: [], channelRefs: ["evidence:2"], assertsObjectiveTruth: false }
    ]
  });

  const companions = projectPlayerCompanionSummaryV1({
    registry: {
      members: [{ actorId: "lyra", status: "ACTIVE", currentSceneId: context.location.sceneId, autonomyPolicy: { sourceRefs: [privateCanaries[2]] } }],
      directives: [{ requestSummary: privateCanaries[2] }]
    } as unknown as CompanionPartyRegistryV1,
    actorLabels: new Map([["lyra", "Lyra"]]),
    sceneLabels: new Map([[context.location.sceneId, context.location.label]])
  });
  const engagements = projectPlayerEngagementSummaryV1({
    engagements: [{
      engagementKind: "MISSION", summary: "Retrouver le registre disparu", status: "ACCEPTED",
      resolution: { conditions: ["Revenir avant la fermeture"] }, missionOutcome: null,
      privatePressure: privateCanaries[1]
    }]
  } as unknown as MissionRelationRegistryV1);
  const plots = projectPlayerPlotSummaryV1({
    plots: [{
      status: "ACTIVE",
      hiddenTruth: { truthId: "truth:1", statement: privateCanaries[0], sourceRefs: [] },
      scheduledEvents: [{ privateOutcome: privateCanaries[0] }],
      falseLeads: [{ claim: privateCanaries[0] }],
      discoveries: [{ statement: "De la cire bleue marque le bureau.", presentation: "OBSERVATION" }],
      playerHypotheses: [{ statement: "Le sceau vient peut-être du port.", status: "UNCONFIRMED" }]
    }]
  } as unknown as PlotRegistryV1);
  const inventory = projectPlayerInventorySummaryV1({
    character: {
      inventory: [
        { instanceId: "owned:sword", itemId: "weapon:sword", itemKind: "weapon", quantity: 1, equippedSlot: "main", storedInInstanceId: null, primaryWeapon: true },
        { instanceId: "owned:rope", itemId: "object:rope", itemKind: "object", quantity: 2, equippedSlot: null, storedInInstanceId: null, primaryWeapon: false }
      ],
      merchantInventory: privateCanaries[3],
      notebook: privateCanaries[4]
    } as unknown as CharacterAggregatePayloadV1,
    itemLabels: new Map([["weapon:sword", "Épée"], ["object:rope", "Corde"]])
  });
  const chronicle = projectPlayerChronicleSummaryV1([]);
  const travel = projectPlayerTravelSummaryV1({ context, activeTravel: null });
  const recap = composePlayerCampaignRecapV1({ context, elapsedGameSeconds: 7_200, travel, companions, engagements, plots, inventory, chronicle });
  const rebuilt = composePlayerCampaignRecapV1({ context, elapsedGameSeconds: 7_200, travel, companions, engagements, plots, inventory, chronicle });

  assert.deepEqual(rebuilt, recap, "la reconstruction locale doit être déterministe");
  assert.equal(recap.noCommit, true);
  assert.equal(recap.noGameTime, true);
  assert.equal(recap.inventory.readOnly, true);
  assert.deepEqual(recap.knownFacts.map(fact => fact.status), ["SCENE_PUBLIC", "CONFIRMED", "HEARD", "REFUTED"]);
  assert.deepEqual(recap.inventory.items.map(item => item.label), ["Épée", "Corde"]);
  assert.equal(recap.investigation[0]?.expressedHypotheses[0]?.status, "UNCONFIRMED");
  const serialized = JSON.stringify(recap);
  for (const canary of privateCanaries) assert.equal(serialized.includes(canary), false, `${canary} ne doit jamais atteindre le résumé`);

  const source = await readFile(resolve("narration-module/src/application/playerCampaignRecap.ts"), "utf8");
  const composerSource = source.slice(source.indexOf("export function composePlayerCampaignRecapV1"), source.indexOf("function humanize"));
  assert.equal(/loadPlotRegistry|loadMissionRelationRegistry|loadCompanionPartyRegistry|repository\.|commit\(/u.test(composerSource), false, "le composeur ne doit lire aucune autorité privée ni muter la campagne");
  assert.equal(/playerPrivateNotebook|private-notebook/iu.test(source), false, "la projection ne doit pas dépendre du carnet privé");
  console.log("player-campaign-recap/J10-E: public boundaries, statuses, inventory and deterministic rebuild verified");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
