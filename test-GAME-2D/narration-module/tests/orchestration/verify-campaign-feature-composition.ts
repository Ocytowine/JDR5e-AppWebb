import assert from "node:assert/strict";
import {
  BASTION_REGISTRY_AGGREGATE_TYPE_V1,
  BASTION_REGISTRY_CONTRACT_V1,
  CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
  CHARACTER_PROGRESSION_REGISTRY_CONTRACT_V1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";
import {
  coreError,
  opaqueId,
  type CampaignId,
  type CampaignRepository
} from "../../src/core";
import {
  createCommittedCampaignFeatureReaderV1
} from "../../../src/narration-ui/campaignFeatureComposition";

const campaignId =
  opaqueId<CampaignId>("campaign-composition-9d");
const scene = {
  ...REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
  sceneId: "scene:bastion-du-pont",
  locationName: "Bastion du pont"
};

function repositoryWith(payloads: Map<string, unknown>): CampaignRepository {
  return {
    async getAggregate(
      _campaignId: CampaignId,
      aggregateType: string
    ) {
      const payload = payloads.get(aggregateType);
      return payload === undefined
        ? {
            ok: false as const,
            error: coreError(
              "NOT_FOUND",
              "test.aggregate-not-found",
              { aggregateType }
            )
          }
        : {
            ok: true as const,
            value: { payload }
          };
    }
  } as unknown as CampaignRepository;
}

async function run(): Promise<void> {
  const emptyReader = createCommittedCampaignFeatureReaderV1({
    repository: repositoryWith(new Map()),
    campaignId,
    resolveSceneLocationRef: () => "place:bastion-du-pont"
  });
  const empty = await emptyReader.read(scene);
  assert.deepEqual(empty.progression, []);
  assert.deepEqual(empty.bastions, []);
  assert.equal(
    empty.rest.allowed,
    false,
    "une scène seule ne doit pas fabriquer un droit au repos"
  );

  const repository = repositoryWith(new Map([
    [
      CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
      {
        schemaVersion: 1,
        contractVersion: CHARACTER_PROGRESSION_REGISTRY_CONTRACT_V1,
        campaignId,
        awards: [{
          schemaVersion: 1,
          awardId: "award:level-2",
          characterId: "character:active",
          awardKind: "CLASS_LEVEL",
          status: "CHOICE_REQUIRED",
          sourceOperationId: "operation:milestone",
          sourceEventId: "event:milestone",
          policyRef: "policy:milestone",
          availableAtGameSecond: 100,
          appliedAtGameSecond: null,
          requiredChoices: ["SUBCLASS"],
          version: 1
        }],
        version: 1
      }
    ],
    [
      BASTION_REGISTRY_AGGREGATE_TYPE_V1,
      {
        schemaVersion: 1,
        contractVersion: BASTION_REGISTRY_CONTRACT_V1,
        campaignId,
        bastions: [{
          schemaVersion: 1,
          bastionId: "bastion:pont",
          placeRef: "place:bastion-du-pont",
          placeDisplayName: "Bastion du pont",
          ownerRef: "character:active",
          ownerDisplayName: "Aryn",
          status: "ACTIVE",
          sourceOperationId: "operation:acquisition",
          sourceEventId: "event:acquisition",
          acquisitionPolicyRef: "policy:property",
          placeSourceRefs: ["place:bastion-du-pont"],
          establishedAtGameSecond: 50,
          installations: [],
          workOrders: [{
            schemaVersion: 1,
            workOrderId: "work:forge",
            status: "SCHEDULED"
          }],
          occupantAssignments: [{
            schemaVersion: 1,
            assignmentId: "assignment:guard",
            status: "ACTIVE"
          }],
          occupantActivities: [],
          incidents: [],
          version: 1
        }],
        version: 1
      }
    ]
  ]));
  const reader = createCommittedCampaignFeatureReaderV1({
    repository,
    campaignId,
    resolveSceneLocationRef: () => "place:bastion-du-pont"
  });
  const availability = await reader.read(scene);
  assert.equal(availability.progression.length, 1);
  assert.deepEqual(
    availability.progression[0]?.requiredChoices,
    ["SUBCLASS"]
  );
  assert.equal(availability.bastions.length, 1);
  assert.equal(availability.bastions[0]?.scheduledWorkCount, 1);
  assert.equal(availability.bastions[0]?.activeOccupantCount, 1);
  assert.equal(
    availability.rest.allowed,
    true,
    "un bastion actif committé au lieu courant autorise le repos"
  );

  const defendedPayload = (
    repository as unknown as {
      getAggregate(
        campaignId: string,
        aggregateType: string
      ): Promise<{ ok: true; value: { payload: any } }>;
    }
  );
  const bastionAggregate =
    await defendedPayload.getAggregate(
      campaignId,
      BASTION_REGISTRY_AGGREGATE_TYPE_V1
    );
  bastionAggregate.value.payload.bastions[0].incidents.push({
    schemaVersion: 1,
    incidentId: "incident:defense",
    status: "HANDOFF_ACTIVE"
  });
  const defended = await reader.read(scene);
  assert.equal(defended.rest.allowed, false);
  assert.equal(defended.bastions[0]?.defenseInProgress, true);

  console.log(
    "Lot 9D: disponibilités committées, refus sans état et repos de bastion vérifiés."
  );
}

void run();
