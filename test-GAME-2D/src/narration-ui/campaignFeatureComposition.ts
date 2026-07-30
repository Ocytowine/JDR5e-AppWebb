import {
  createNarrativeRestRuntimeV1,
  loadBastionRegistryV1,
  loadCharacterProgressionRegistryV1,
  type PlayableSceneStateV1
} from "../../narration-module/src/application";
import type {
  CampaignId,
  CampaignRepository
} from "../../narration-module/src/core";

export interface CommittedCampaignFeatureAvailabilityV1 {
  progression: Array<{
    awardId: string;
    status: "AVAILABLE" | "CHOICE_REQUIRED";
    requiredChoices: string[];
  }>;
  bastions: Array<{
    bastionId: string;
    placeDisplayName: string;
    scheduledWorkCount: number;
    activeOccupantCount: number;
    openIncidentCount: number;
    defenseInProgress: boolean;
  }>;
  rest: {
    allowed: boolean;
    placeRef: string | null;
    placeDisplayName: string | null;
    reason: string;
  };
}

export interface CommittedCampaignFeatureReaderV1 {
  read(
    scene: PlayableSceneStateV1
  ): Promise<CommittedCampaignFeatureAvailabilityV1>;
}

type SceneLocationResolverV1 =
  (scene: PlayableSceneStateV1) => string | null | Promise<string | null>;

/**
 * Composition applicative en lecture seule. Elle ne crée aucun award, bastion,
 * travail ou incident : une carte UI ne peut provenir que des registres
 * persistés par leurs autorités respectives.
 */
export function createCommittedCampaignFeatureReaderV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  resolveSceneLocationRef: SceneLocationResolverV1;
}): CommittedCampaignFeatureReaderV1 {
  return {
    async read(scene) {
      const [progression, bastions, locationRef] = await Promise.all([
        loadCharacterProgressionRegistryV1(
          input.repository,
          input.campaignId
        ),
        loadBastionRegistryV1(input.repository, input.campaignId),
        input.resolveSceneLocationRef(scene)
      ]);
      if (!progression.ok) {
        throw new Error(progression.error.messageKey);
      }
      if (!bastions.ok) {
        throw new Error(bastions.error.messageKey);
      }
      const activeBastions = bastions.value.state.bastions.filter(
        bastion => bastion.status === "ACTIVE"
      );
      const localBastion = locationRef === null
        ? null
        : activeBastions.find(bastion => bastion.placeRef === locationRef)
          ?? null;
      const defenseInProgress = localBastion?.incidents.some(
        incident => incident.status === "HANDOFF_ACTIVE"
      ) ?? false;
      const rest = localBastion === null
        ? {
            allowed: false,
            placeRef: null,
            placeDisplayName: null,
            reason:
              "Aucun lieu de repos autorisé n’est enregistré ici."
          }
        : defenseInProgress
          ? {
              allowed: false,
              placeRef: localBastion.placeRef,
              placeDisplayName: localBastion.placeDisplayName,
              reason:
                "La défense en cours empêche de commencer un repos."
            }
          : {
              allowed: true,
              placeRef: localBastion.placeRef,
              placeDisplayName: localBastion.placeDisplayName,
              reason:
                `Un repos peut être commencé à ${localBastion.placeDisplayName}.`
            };
      return {
        progression: progression.value.state.awards
          .filter(award =>
            award.status === "AVAILABLE"
            || award.status === "CHOICE_REQUIRED"
          )
          .map(award => ({
            awardId: award.awardId,
            status: award.status as "AVAILABLE" | "CHOICE_REQUIRED",
            requiredChoices: [...award.requiredChoices]
          })),
        bastions: activeBastions.map(bastion => ({
          bastionId: bastion.bastionId,
          placeDisplayName: bastion.placeDisplayName,
          scheduledWorkCount: bastion.workOrders.filter(
            work => work.status === "SCHEDULED"
          ).length,
          activeOccupantCount: bastion.occupantAssignments.filter(
            assignment => assignment.status === "ACTIVE"
          ).length,
          openIncidentCount: bastion.incidents.filter(
            incident =>
              incident.status === "OPEN"
              || incident.status === "HANDOFF_ACTIVE"
          ).length,
          defenseInProgress: bastion.incidents.some(
            incident => incident.status === "HANDOFF_ACTIVE"
          )
        })),
        rest
      };
    }
  };
}

export function createCommittedBastionRestRuntimeV1(input: {
  availabilityReader: CommittedCampaignFeatureReaderV1;
}) {
  return createNarrativeRestRuntimeV1({
    rules: {
      shortRestDurationSeconds: 3_600,
      longRestDurationSeconds: 28_800,
      segmentSeconds: 3_600
    },
    authorize: async ({ scene }) => {
      const availability = await input.availabilityReader.read(scene);
      return {
        allowed: availability.rest.allowed,
        reason: availability.rest.allowed
          ? availability.rest.reason
          : `Le repos ne commence pas. ${availability.rest.reason}`,
        locationRef: {
          kind: availability.rest.placeRef === null
            ? "scene"
            : "place",
          id: availability.rest.placeRef ?? scene.sceneId
        },
        safetyProfile: {
          interruptionPercent: 0,
          source: "committed-active-bastion-policy"
        }
      };
    }
  });
}
