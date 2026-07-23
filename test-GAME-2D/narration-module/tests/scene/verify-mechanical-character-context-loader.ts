import assert from "node:assert/strict";
import type { AggregateId, CampaignId, CampaignRepository } from "../../src/core";
import { loadActiveMechanicalCharacterContextV1 } from "../../src/application";

const tacticalPayload = {
  schemaVersion: 1,
  characterId: "character:aryn",
  level: 4,
  abilityModifiers: { FOR: 1, DEX: 2, CON: 1, INT: 0, SAG: 3, CHA: 0 },
  proficiencyBonus: 2,
  currentHitPoints: 24,
  maximumHitPoints: 24,
  temporaryHitPoints: 0,
  armorClass: 14,
  passivePerception: 17,
  movementModes: {},
  vision: {},
  actionIds: [],
  reactionIds: [],
  spellIds: [],
  resources: {},
  equippedItemInstanceIds: [],
  appearance: {}
};
const narrativePayload = {
  schemaVersion: 1,
  characterId: "character:aryn",
  name: "Aryn",
  raceId: "humain",
  backgroundId: "garde",
  languages: ["commun"],
  observable: {},
  knownToPlayer: {},
  privateMechanical: {
    abilityScores: {},
    skills: ["perception"],
    expertise: [],
    featureIds: []
  }
};

function repository(withBootstrap: boolean): CampaignRepository {
  return {
    async listEvents() {
      return {
        ok: true,
        value: withBootstrap
          ? [{
            eventType: "campaign.bootstrapped",
            aggregateRefs: [
              { aggregateType: "character.tactical-projection", aggregateId: "aggregate:tactical", aggregateRevision: 0 },
              { aggregateType: "character.narrative-projection", aggregateId: "aggregate:narrative", aggregateRevision: 0 }
            ]
          }]
          : []
      };
    },
    async getAggregate(_campaignId: CampaignId, aggregateType: string, aggregateId: AggregateId) {
      const payload = aggregateType === "character.tactical-projection" ? tacticalPayload : narrativePayload;
      return {
        ok: true,
        value: {
          schemaVersion: 1,
          campaignId: "campaign:test",
          aggregateType,
          aggregateId,
          aggregateRevision: 0,
          payloadSchemaVersion: 1,
          payload,
          updatedByCommitId: "commit:bootstrap"
        }
      };
    }
  } as unknown as CampaignRepository;
}

async function run(): Promise<void> {
  const loaded = await loadActiveMechanicalCharacterContextV1({
    repository: repository(true),
    campaignId: "campaign:test" as never,
    ability: "SAG",
    skillId: "perception",
    passiveKind: "PERCEPTION"
  });
  assert.equal(loaded.ok, true);
  if (loaded.ok) {
    assert.equal(loaded.value?.characterId, "character:aryn");
    assert.equal(loaded.value?.proficiencyRank, 1);
    assert.equal(loaded.value?.totalModifier, 5);
    assert.equal(loaded.value?.passiveScore, 17);
    assert.equal(loaded.value?.backgroundId, "garde");
  }

  const absent = await loadActiveMechanicalCharacterContextV1({
    repository: repository(false),
    campaignId: "campaign:prototype" as never,
    ability: "SAG",
    skillId: "perception",
    passiveKind: "PERCEPTION"
  });
  assert.deepEqual(absent, { ok: true, value: null });
  console.log("mechanical-character-context-loader: bootstrap projections loaded; prototype absence tolerated");
}

void run();
