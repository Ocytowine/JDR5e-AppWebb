import {
  cloneJson,
  type CampaignId,
  type CampaignRepository,
  type JsonObject
} from "../core";
import {
  loadActiveCampaignCharacterProfileV1,
  type ActiveCampaignCharacterProfileV1
} from "../bootstrap/orchestration";
import {
  BASTION_DEFENSE_PLAYER_PROJECTION_V1,
  type BastionDefensePlayerProjectionV1,
  type BastionDefensePlayerResolverV1
} from "./catalogBackedBastionDefenseAuthority";

export const CAMPAIGN_GAME_BOARD_PLAYER_ADAPTER_V1 =
  "campaign-game-board-player-adapter/1" as const;

/**
 * Frontière volontaire entre le modèle canonique de campagne et le modèle
 * d'affichage tactique. L'adaptateur appartient à l'application qui connaît
 * réellement le format de la fiche personnage et celui de GameBoard.
 */
export interface CampaignGameBoardPlayerAdapterV1 {
  readonly adapterRef: string;
  project(input: {
    campaignId: CampaignId;
    profile: ActiveCampaignCharacterProfileV1;
    characterState: JsonObject;
    tacticalProjection: JsonObject;
    teamId: string;
  }): JsonObject | null | Promise<JsonObject | null>;
}

/**
 * Résout le personnage actif enregistré au bootstrap. Aucun personnage
 * d'exemple et aucun profil implicite ne sont utilisés en cas d'absence.
 */
export function createBootstrappedBastionDefensePlayerResolverV1(input: {
  repository: CampaignRepository;
  adapter: CampaignGameBoardPlayerAdapterV1;
}): BastionDefensePlayerResolverV1 {
  return {
    resolverRef:
      `bootstrapped-bastion-defense-player/1:${input.adapter.adapterRef}`,
    async resolve(context) {
      const profileResult = await loadActiveCampaignCharacterProfileV1({
        repository: input.repository,
        campaignId: context.campaignId
      });
      if (!profileResult.ok) return null;
      const profile = profileResult.value;
      const [characterState, tacticalProjection] = await Promise.all([
        input.repository.getAggregate(
          context.campaignId,
          "character.state",
          profile.characterStateAggregateId
        ),
        input.repository.getAggregate(
          context.campaignId,
          "character.tactical-projection",
          profile.tacticalProjectionAggregateId
        )
      ]);
      if (!characterState.ok || !tacticalProjection.ok) return null;
      if (
        characterState.value.payload.characterId !== profile.characterId
        || tacticalProjection.value.payload.characterId
          !== profile.characterId
      ) return null;
      const gameBoardProjection = await input.adapter.project({
        campaignId: context.campaignId,
        profile: cloneJson(profile),
        characterState: cloneJson(characterState.value.payload),
        tacticalProjection: cloneJson(tacticalProjection.value.payload),
        teamId: context.teamId
      });
      if (
        gameBoardProjection === null
        || typeof gameBoardProjection !== "object"
        || Array.isArray(gameBoardProjection)
      ) return null;
      const projection: BastionDefensePlayerProjectionV1 = {
        schemaVersion: 1,
        contractVersion: BASTION_DEFENSE_PLAYER_PROJECTION_V1,
        actorId: profile.actorId,
        characterId: profile.characterId,
        teamId: context.teamId,
        characterStateAggregateId: profile.characterStateAggregateId,
        tacticalProjectionAggregateId:
          profile.tacticalProjectionAggregateId,
        gameBoardProjection: cloneJson(gameBoardProjection)
      };
      return projection;
    }
  };
}
