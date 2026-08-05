import {
  BASTION_INCIDENT_CATALOG_CONTRACT_V1,
  createBootstrappedBastionDefensePlayerResolverV1,
  createCatalogBackedBastionTacticalRuntimeFactoryV1,
  loadContentPackageBastionDefenseEncounterCatalogV1,
  type NarrativeBastionTacticalRuntimeFactoryV1
} from "../../narration-module/src/application";
import type {
  CharacterAggregatePayloadV1,
  ResolvedContentPackageV1,
  TacticalCharacterProjectionV1
} from "../../narration-module/src/bootstrap";
import type {
  CampaignId,
  CampaignRecord,
  CampaignRepository,
  JsonObject
} from "../../narration-module/src/core";
import { GAME_BOARD_ACTOR_PROJECTION_V1 } from
  "../tactical-integration/gameBoardEncounterAdapter";

export const INSTALLED_BASTION_DEFENSE_CATALOG_ID_V1 =
  "catalog:bastion-defense-production-v1";
export const INSTALLED_BASTION_DEFENSE_INCIDENT_REF_V1 =
  "incident-definition:bastion-raid-v1";

/**
 * Compose le vertical de défense sans créer sa cause. Seul un événement monde
 * ou intrigue déjà committé, portant les champs canoniques ci-dessous, peut
 * cibler un bastion actif.
 */
export function createInstalledBastionTacticalRuntimeFactoryV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  campaign: CampaignRecord;
  content: ResolvedContentPackageV1;
}): NarrativeBastionTacticalRuntimeFactoryV1 {
  const campaignResult = input.content.manifest;
  const pinnedCampaign = {
    dependencies: {
      contentPackageId: campaignResult.packageId,
      contentPackageVersion: campaignResult.packageVersion
    }
  };
  const playerResolver = createBootstrappedBastionDefensePlayerResolverV1({
    repository: input.repository,
    adapter: {
      adapterRef: "canonical-campaign-to-game-board/1",
      project({ profile, characterState, tacticalProjection, teamId }) {
        return buildGameBoardPlayerProjectionV1({
          actorId: profile.actorId,
          teamId,
          character:
            characterState as unknown as CharacterAggregatePayloadV1,
          tactical:
            tacticalProjection as unknown as TacticalCharacterProjectionV1
        });
      }
    }
  });
  // Le chargeur exige l'enregistrement de campagne complet uniquement pour
  // confronter les versions épinglées. La factory appelante a déjà relu et
  // validé cette campagne ; on fournit ce record réel via le paramètre caché
  // ci-dessous plutôt qu'une version implicite.
  const campaign = input.campaign;
  if (
    campaign.dependencies.contentPackageId
      !== pinnedCampaign.dependencies.contentPackageId
    || campaign.dependencies.contentPackageVersion
      !== pinnedCampaign.dependencies.contentPackageVersion
  ) {
    throw new Error("campaign.dependencies-installed-version-mismatch");
  }
  const catalog = loadContentPackageBastionDefenseEncounterCatalogV1({
    campaign,
    content: input.content,
    catalogId: INSTALLED_BASTION_DEFENSE_CATALOG_ID_V1
  });
  if (!catalog.ok) throw new Error(catalog.error.messageKey);

  return createCatalogBackedBastionTacticalRuntimeFactoryV1({
    causeRoutingPolicy: {
      policyRef: "committed-bastion-place-cause/1",
      evaluate({ sourceEvent, activeBastions }) {
        const sourceKind = sourceEvent.origin === "WORLD_SIMULATION"
          ? "WORLD_SIMULATION" as const
          : "PLOT" as const;
        const cause = readInstalledBastionDefenseCauseV1(
          sourceEvent.payload
        );
        const target = cause !== null
          ? activeBastions.find(
              bastion => bastion.placeRef === cause.targetPlaceRef
            )
          : undefined;
        return {
          schemaVersion: 1,
          sourceKind,
          disposition: target === undefined ? "IGNORE" : "TARGET",
          reasonCode: target === undefined
            ? "NO_COMMITTED_DEFENSE_TARGET"
            : "COMMITTED_DEFENSE_TARGET",
          bastionId: target?.bastionId ?? null
        };
      }
    },
    incidentCatalog: {
      catalogRef: "installed-bastion-incidents/1",
      resolve(ref) {
        return ref === INSTALLED_BASTION_DEFENSE_INCIDENT_REF_V1
          ? {
              schemaVersion: 1,
              contractVersion:
                BASTION_INCIDENT_CATALOG_CONTRACT_V1,
              incidentDefinitionRef: ref,
              displayName: "Attaque du bastion",
              kind: "TACTICAL_DEFENSE",
              publicNarrative:
                "Des assaillants atteignent le bastion ; sa défense commence et l’issue reste ouverte.",
              effect: {
                schemaVersion: 1,
                kind: "TACTICAL_HANDOFF"
              }
            }
          : null;
      }
    },
    incidentPolicy: {
      policyRef: "committed-bastion-defense-cause/1",
      evaluate({ sourceEvent }) {
        const eligible =
          readInstalledBastionDefenseCauseV1(sourceEvent.payload) !== null;
        return {
          schemaVersion: 1,
          eligible,
          reasonCode: eligible
            ? "COMMITTED_TACTICAL_DEFENSE_CAUSE"
            : "CAUSE_OUTSIDE_TACTICAL_DEFENSE_POLICY",
          incidentDefinitionRef: eligible
            ? INSTALLED_BASTION_DEFENSE_INCIDENT_REF_V1
            : null
        };
      }
    },
    encounterCatalog: catalog.value,
    playerResolver
  });
}

function readInstalledBastionDefenseCauseV1(
  payload: JsonObject
): { targetPlaceRef: string } | null {
  const candidates: JsonObject[] = [payload];
  const tickOutput = asJsonObjectV1(payload.tickOutput);
  if (tickOutput !== null && Array.isArray(tickOutput.events)) {
    for (const event of tickOutput.events) {
      const record = asJsonObjectV1(event);
      const eventPayload =
        record === null ? null : asJsonObjectV1(record.payload);
      if (eventPayload !== null) candidates.push(eventPayload);
    }
  }
  const eligible = candidates.filter(candidate =>
    candidate.causeKind === "BASTION_TACTICAL_DEFENSE"
    && candidate.incidentDefinitionRef
      === INSTALLED_BASTION_DEFENSE_INCIDENT_REF_V1
    && typeof candidate.targetPlaceRef === "string"
    && candidate.targetPlaceRef.trim() !== ""
  );
  if (eligible.length !== 1) return null;
  return { targetPlaceRef: String(eligible[0]!.targetPlaceRef) };
}

function asJsonObjectV1(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

export function buildGameBoardPlayerProjectionV1(input: {
  actorId: string;
  teamId: string;
  character: CharacterAggregatePayloadV1;
  tactical: TacticalCharacterProjectionV1;
}): JsonObject {
  const score = input.character.abilityScores;
  const modifiers = input.tactical.abilityModifiers;
  return {
    schemaVersion: 1,
    contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
    actorId: input.actorId,
    teamId: input.teamId,
    side: "PLAYER",
    character: {
      id: input.actorId,
      nom: { nomcomplet: input.character.name },
      niveauGlobal: input.character.globalLevel,
      classe: Object.fromEntries(input.character.classes.map(
        (entry, index) => [String(index), {
          classeId: entry.classId,
          subclasseId: entry.subclassId,
          niveau: entry.level
        }]
      )),
      CA: input.tactical.armorClass,
      caracs: {
        force: { FOR: score.FOR, modFOR: modifiers.FOR },
        dexterite: { DEX: score.DEX, modDEX: modifiers.DEX },
        constitution: { CON: score.CON, modCON: modifiers.CON },
        intelligence: { INT: score.INT, modINT: modifiers.INT },
        sagesse: { SAG: score.SAG, modSAG: modifiers.SAG },
        charisme: { CHA: score.CHA, modCHA: modifiers.CHA }
      },
      pvActuels: input.tactical.currentHitPoints,
      pvMax: input.tactical.maximumHitPoints,
      actionIds: [...input.tactical.actionIds],
      reactionIds: [...input.tactical.reactionIds],
      movementModes: input.tactical.movementModes,
      appearance: input.tactical.appearance,
      combatStats: {
        level: input.tactical.level,
        mods: {
          modFOR: modifiers.FOR,
          modDEX: modifiers.DEX,
          modCON: modifiers.CON,
          modINT: modifiers.INT,
          modSAG: modifiers.SAG,
          modCHA: modifiers.CHA
        },
        maxHp: input.tactical.maximumHitPoints,
        armorClass: input.tactical.armorClass,
        attackBonus: input.tactical.proficiencyBonus,
        maxAttacksPerTurn: 1,
        actionsPerTurn: 1,
        bonusActionsPerTurn: 1,
        resources: input.tactical.resources
      }
    }
  };
}
