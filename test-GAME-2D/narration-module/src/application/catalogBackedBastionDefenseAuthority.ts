import {
  cloneJson,
  computeJsonFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type JsonObject,
  type Result
} from "../core";
import type {
  ResolvedContentPackageV1
} from "../bootstrap/orchestration/types";
import {
  HANDOFF_CONTRACT_VERSION,
  validateTacticalEncounterSeedV1,
  type SourceRefV1,
  type TacticalEncounterSeedV1
} from "../handoff";
import type {
  BastionDefenseHandoffAuthorityV1,
  BastionIncidentCatalogV1,
  BastionIncidentDefinitionV1,
  BastionIncidentPolicyV1
} from "./bastionIncidentAuthority";
import {
  createBastionTacticalConsequenceAuthorityV1,
  createCharacterTacticalConsequenceAuthorityV1,
  type BastionTacticalResolutionDecisionV1,
  type BastionTacticalResolutionPolicyV1
} from "./tacticalConsequenceAuthorities";
import type {
  NarrativeBastionTacticalRuntimeFactoryV1
} from "./NarrativeTurnController";
import type {
  BastionCommittedCauseRoutingPolicyV1
} from "./bastionCommittedCauseRouter";

export const BASTION_DEFENSE_ENCOUNTER_CATALOG_V1 =
  "bastion-defense-encounter-catalog/1" as const;
export const BASTION_DEFENSE_PLAYER_PROJECTION_V1 =
  "bastion-defense-player-projection/1" as const;
export const BASTION_DEFENSE_ACTIVE_PLAYER_SLOT_V1 =
  "$ACTIVE_CAMPAIGN_CHARACTER" as const;

export interface BastionDefenseResolutionDefinitionV1 extends JsonObject {
  schemaVersion: 1;
  endCondition: string;
  resolutionCode: string;
  bastionStatus: "ACTIVE" | "SUSPENDED" | "LOST";
  publicNarrative: string;
}

export interface BastionDefenseEncounterDefinitionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_DEFENSE_ENCOUNTER_CATALOG_V1;
  incidentDefinitionRef: string;
  playerTeamId: string;
  rulesetRef: SourceRefV1;
  objectives: JsonObject[];
  hostileParticipants: JsonObject[];
  teams: JsonObject[];
  tacticalMapRef: SourceRefV1 | null;
  mapGenerationRequest: JsonObject | null;
  entryZones: JsonObject[];
  exitZones: JsonObject[];
  knownTerrain: JsonObject[];
  lightingAndVisibility: JsonObject;
  weatherAndHazards: JsonObject[];
  initialPositions: JsonObject[];
  surpriseState: JsonObject;
  allowedEndConditions: string[];
  resolutions: BastionDefenseResolutionDefinitionV1[];
  sourceRefs: SourceRefV1[];
}

export interface BastionDefenseEncounterCatalogV1 {
  readonly catalogRef: string;
  resolve(incidentDefinitionRef: string):
    | BastionDefenseEncounterDefinitionV1
    | null
    | Promise<BastionDefenseEncounterDefinitionV1 | null>;
}

export interface BastionDefenseEncounterCatalogDocumentV1
  extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_DEFENSE_ENCOUNTER_CATALOG_V1;
  catalogId: string;
  definitions: BastionDefenseEncounterDefinitionV1[];
}

export function loadContentPackageBastionDefenseEncounterCatalogV1(input: {
  campaign: CampaignRecord;
  content: ResolvedContentPackageV1;
  catalogId: string;
}): Result<BastionDefenseEncounterCatalogV1> {
  if (
    input.content.manifest.packageId
      !== input.campaign.dependencies.contentPackageId
    || input.content.manifest.packageVersion
      !== input.campaign.dependencies.contentPackageVersion
  ) {
    return invalid("bastion.defense-catalog.package-mismatch", [
      "content package must match the version pinned by the campaign"
    ]);
  }
  const descriptor = input.content.manifest.entries.find(entry =>
    entry.entryKind === "GAME_CATALOG_ENTRY"
    && entry.entryId === input.catalogId
  );
  const resolved = input.content.entries.find(entry =>
    entry.entryKind === "GAME_CATALOG_ENTRY"
    && entry.entryId === input.catalogId
  );
  if (descriptor === undefined || resolved === undefined) {
    return invalid("bastion.defense-catalog.entry-missing", [
      `catalog ${input.catalogId} is absent from the resolved package`
    ]);
  }
  const document = resolved.payload as
    | BastionDefenseEncounterCatalogDocumentV1
    | null;
  if (
    document === null
    || document.schemaVersion !== 1
    || document.contractVersion !== BASTION_DEFENSE_ENCOUNTER_CATALOG_V1
    || document.catalogId !== input.catalogId
    || !Array.isArray(document.definitions)
  ) {
    return invalid("bastion.defense-catalog.document-invalid", [
      "catalog document contract is invalid"
    ]);
  }
  const issues = document.definitions.flatMap((definition, index) =>
    validateBastionDefenseEncounterDefinitionV1(definition)
      .map(issue => `definitions[${index}]: ${issue}`)
  );
  const refs = document.definitions.map(value => value.incidentDefinitionRef);
  if (new Set(refs).size !== refs.length) {
    issues.push("incidentDefinitionRef entries must be unique");
  }
  if (issues.length > 0) {
    return invalid("bastion.defense-catalog.definitions-invalid", issues);
  }
  const definitions = new Map(
    cloneJson(document.definitions).map(definition => [
      definition.incidentDefinitionRef,
      definition
    ])
  );
  return {
    ok: true,
    value: {
      catalogRef:
        `${input.content.manifest.packageId}@${input.content.manifest.packageVersion}:${input.catalogId}`,
      resolve(incidentDefinitionRef) {
        const definition = definitions.get(incidentDefinitionRef);
        return definition === undefined ? null : cloneJson(definition);
      }
    }
  };
}

export interface BastionDefensePlayerProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_DEFENSE_PLAYER_PROJECTION_V1;
  actorId: string;
  characterId: string;
  teamId: string;
  characterStateAggregateId: string;
  tacticalProjectionAggregateId: string;
  gameBoardProjection: JsonObject;
}

export interface BastionDefensePlayerResolverV1 {
  readonly resolverRef: string;
  resolve(input: {
    campaignId: CampaignId;
    bastionId: string;
    incidentDefinitionRef: string;
    teamId: string;
  }):
    | BastionDefensePlayerProjectionV1
    | null
    | Promise<BastionDefensePlayerProjectionV1 | null>;
}

export function createCatalogBackedBastionTacticalRuntimeFactoryV1(input: {
  causeRoutingPolicy: BastionCommittedCauseRoutingPolicyV1;
  incidentCatalog: BastionIncidentCatalogV1;
  incidentPolicy: BastionIncidentPolicyV1;
  encounterCatalog: BastionDefenseEncounterCatalogV1;
  playerResolver: BastionDefensePlayerResolverV1;
}): NarrativeBastionTacticalRuntimeFactoryV1 {
  return {
    create(context) {
      const resolutionPolicy =
        createCatalogBackedBastionResolutionPolicyV1(
          input.encounterCatalog
        );
      return {
        causeRoutingPolicy: input.causeRoutingPolicy,
        incidentCatalog: input.incidentCatalog,
        incidentPolicy: input.incidentPolicy,
        defenseAuthority: createCatalogBackedBastionDefenseAuthorityV1({
          repository: context.repository,
          campaignId: context.campaignId,
          catalog: input.encounterCatalog,
          playerResolver: input.playerResolver
        }),
        consequenceAuthorities: [
          createCharacterTacticalConsequenceAuthorityV1(),
          createBastionTacticalConsequenceAuthorityV1(resolutionPolicy)
        ]
      };
    }
  };
}

/**
 * Construit une graine complète depuis un catalogue et des projections
 * propriétaires. Aucun incident n'est créé ici : cette autorité n'est appelée
 * qu'après qu'un événement committé a été déclaré éligible par BastionDomain.
 */
export function createCatalogBackedBastionDefenseAuthorityV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  catalog: BastionDefenseEncounterCatalogV1;
  playerResolver: BastionDefensePlayerResolverV1;
}): BastionDefenseHandoffAuthorityV1 {
  return {
    authorityRef:
      `catalog-backed-bastion-defense/1:${input.catalog.catalogRef}:${input.playerResolver.resolverRef}`,
    async prepare(context) {
      if (context.campaign.campaignId !== input.campaignId) {
        return refused("CAMPAIGN_MISMATCH");
      }
      const definition = await input.catalog.resolve(
        context.incident.incidentDefinitionRef
      );
      if (definition === null) return refused("ENCOUNTER_NOT_CATALOGUED");
      const player = await input.playerResolver.resolve({
        campaignId: input.campaignId,
        bastionId: context.bastion.bastionId,
        incidentDefinitionRef: context.incident.incidentDefinitionRef,
        teamId: definition.playerTeamId
      });
      if (player === null) return refused("PLAYER_PROJECTION_UNAVAILABLE");
      const definitionIssues = validateDefinition(
        definition,
        context.incident
      );
      const playerIssues = validatePlayerProjection(player);
      if (definitionIssues.length > 0 || playerIssues.length > 0) {
        return refused("CATALOG_OR_PLAYER_PROJECTION_INVALID");
      }
      const ownerState = await validatePlayerOwnerState({
        repository: input.repository,
        campaignId: input.campaignId,
        player
      });
      if (!ownerState.ok) return refused(ownerState.error.messageKey);
      const teams = cloneJson(definition.teams).map(team => ({
        ...team,
        actors: Array.isArray(team.actors)
          ? team.actors.map(actorId =>
              actorId === BASTION_DEFENSE_ACTIVE_PLAYER_SLOT_V1
                ? player.actorId
                : actorId
            )
          : team.actors
      }));
      const initialPositions = cloneJson(definition.initialPositions).map(
        position => ({
          ...position,
          actorId:
            position.actorId === BASTION_DEFENSE_ACTIVE_PLAYER_SLOT_V1
              ? player.actorId
              : position.actorId
        })
      );
      const token = (await computeJsonFingerprint({
        campaignId: input.campaignId,
        bastionId: context.bastion.bastionId,
        incidentDefinitionRef: context.incident.incidentDefinitionRef,
        sourceEventId: context.sourceEvent.eventId,
        catalogRef: input.catalog.catalogRef,
        playerResolverRef: input.playerResolver.resolverRef
      })).replace(/^sha256:/u, "").slice(0, 40);
      const processId = `tactical:bastion-defense:${token}`;
      const base = {
        schemaVersion: 1 as const,
        contractVersion: HANDOFF_CONTRACT_VERSION,
        seedId: `seed:bastion-defense:${token}`,
        processId,
        campaignId: input.campaignId,
        sceneId: `bastion-defense:${context.bastion.bastionId}`,
        locationRef: {
          kind: "place",
          id: context.bastion.placeRef
        },
        startedAtGameSecond: context.startedAtGameSecond,
        rulesetRef: cloneJson(definition.rulesetRef),
        cause: {
          eventId: context.sourceEvent.eventId,
          eventType: context.sourceEvent.eventType,
          incidentDefinitionRef: context.incident.incidentDefinitionRef
        },
        stakes: {
          bastionId: context.bastion.bastionId,
          placeRef: context.bastion.placeRef,
          incidentDefinitionRef: context.incident.incidentDefinitionRef
        },
        objectives: cloneJson(definition.objectives),
        participants: [{
          actorId: player.actorId,
          characterId: player.characterId,
          characterStateAggregateRef: player.characterStateAggregateId,
          tacticalProjectionAggregateRef:
            player.tacticalProjectionAggregateId,
          gameBoardProjection: cloneJson(player.gameBoardProjection)
        }, ...cloneJson(definition.hostileParticipants)],
        teams,
        tacticalMapRef: cloneJson(definition.tacticalMapRef),
        mapGenerationRequest: cloneJson(definition.mapGenerationRequest),
        entryZones: cloneJson(definition.entryZones),
        exitZones: cloneJson(definition.exitZones),
        knownTerrain: cloneJson(definition.knownTerrain),
        lightingAndVisibility:
          cloneJson(definition.lightingAndVisibility),
        weatherAndHazards: cloneJson(definition.weatherAndHazards),
        initialPositions,
        surpriseState: cloneJson(definition.surpriseState),
        allowedEndConditions: cloneJson(definition.allowedEndConditions),
        sourceAggregateRefs: uniqueRefs([
          ...definition.sourceRefs,
          {
            kind: "bastion.registry",
            id: context.bastion.bastionId
          },
          {
            kind: "character.state",
            id: player.characterStateAggregateId
          },
          {
            kind: "character.tactical-projection",
            id: player.tacticalProjectionAggregateId
          },
          { kind: "event", id: context.sourceEvent.eventId },
          { kind: "catalog", id: input.catalog.catalogRef }
        ]),
        version: 1 as const
      };
      const seed: TacticalEncounterSeedV1 = {
        ...base,
        seedFingerprint: await computeJsonFingerprint(base)
      };
      const validation = validateTacticalEncounterSeedV1(seed);
      return validation.valid
        ? {
            schemaVersion: 1,
            authorized: true,
            reasonCode: "CATALOGUED_DEFENSE_READY",
            seed
          }
        : refused(`SEED_INVALID:${validation.issues.join("|")}`);
    }
  };
}

/**
 * Interprète une condition terminale exclusivement depuis le même catalogue
 * qui a préparé la rencontre.
 */
export function createCatalogBackedBastionResolutionPolicyV1(
  catalog: BastionDefenseEncounterCatalogV1
): BastionTacticalResolutionPolicyV1 {
  return {
    policyRef: `catalog-backed-bastion-resolution/1:${catalog.catalogRef}`,
    async resolve(input) {
      const definition = await catalog.resolve(input.incidentDefinitionRef);
      const resolution = definition?.resolutions.find(
        value => value.endCondition === input.endCondition
      );
      if (
        definition === null
        || resolution === undefined
        || !definition.allowedEndConditions.includes(input.endCondition)
      ) {
        return {
          ok: false,
          error: coreError(
            "VALIDATION_FAILED",
            "bastion.defense.terminal-resolution-missing",
            {
              incidentDefinitionRef: input.incidentDefinitionRef,
              endCondition: input.endCondition
            }
          )
        };
      }
      return {
        ok: true,
        value: cloneJson(
          resolution
        ) as BastionTacticalResolutionDecisionV1
      };
    }
  };
}

async function validatePlayerOwnerState(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  player: BastionDefensePlayerProjectionV1;
}): Promise<Result<void>> {
  const [character, tactical] = await Promise.all([
    input.repository.getAggregate(
      input.campaignId,
      "character.state",
      opaqueId<AggregateId>(input.player.characterStateAggregateId)
    ),
    input.repository.getAggregate(
      input.campaignId,
      "character.tactical-projection",
      opaqueId<AggregateId>(input.player.tacticalProjectionAggregateId)
    )
  ]);
  if (!character.ok) return character;
  if (!tactical.ok) return tactical;
  const projectedCharacter = input.player.gameBoardProjection.character;
  const projectedHp = projectedCharacter !== null
    && typeof projectedCharacter === "object"
    && !Array.isArray(projectedCharacter)
    ? Number(projectedCharacter.pvActuels)
    : Number.NaN;
  if (
    character.value.payload.characterId !== input.player.characterId
    || tactical.value.payload.characterId !== input.player.characterId
    || character.value.payload.currentHitPoints
      !== tactical.value.payload.currentHitPoints
    || projectedHp !== tactical.value.payload.currentHitPoints
  ) {
    return {
      ok: false,
      error: coreError(
        "CAMPAIGN_INTEGRITY_FAILURE",
        "bastion.defense.player-owner-state-mismatch"
      )
    };
  }
  return { ok: true, value: undefined };
}

function validateDefinition(
  value: BastionDefenseEncounterDefinitionV1,
  incident: BastionIncidentDefinitionV1
): string[] {
  const issues: string[] = [];
  if (
    value.schemaVersion !== 1
    || value.contractVersion !== BASTION_DEFENSE_ENCOUNTER_CATALOG_V1
    || value.incidentDefinitionRef !== incident.incidentDefinitionRef
  ) issues.push("encounter definition identity is invalid");
  if (
    !nonEmpty(value.rulesetRef?.kind)
    || !nonEmpty(value.rulesetRef?.id)
  ) issues.push("rulesetRef is required");
  if (!nonEmpty(value.playerTeamId)) issues.push("playerTeamId is required");
  for (const key of [
    "objectives",
    "hostileParticipants",
    "teams",
    "entryZones",
    "exitZones",
    "knownTerrain",
    "weatherAndHazards",
    "initialPositions",
    "allowedEndConditions",
    "resolutions",
    "sourceRefs"
  ] as const) {
    if (!Array.isArray(value[key])) issues.push(`${key} must be an array`);
  }
  if (
    value.allowedEndConditions.length === 0
    || new Set(value.allowedEndConditions).size
      !== value.allowedEndConditions.length
    || value.allowedEndConditions.some(item => !nonEmpty(item))
  ) issues.push("allowedEndConditions must contain unique identifiers");
  if (
    value.resolutions.length !== value.allowedEndConditions.length
    || value.resolutions.some(resolution =>
      resolution.schemaVersion !== 1
      || !value.allowedEndConditions.includes(resolution.endCondition)
      || !nonEmpty(resolution.resolutionCode)
      || !["ACTIVE", "SUSPENDED", "LOST"].includes(resolution.bastionStatus)
      || !publicText(resolution.publicNarrative, 500)
    )
  ) issues.push("every terminal condition requires one valid resolution");
  if (
    new Set(value.resolutions.map(item => item.endCondition)).size
      !== value.resolutions.length
  ) issues.push("terminal resolutions must be unique");
  return issues;
}

export function validateBastionDefenseEncounterDefinitionV1(
  value: BastionDefenseEncounterDefinitionV1
): string[] {
  const syntheticIncident: BastionIncidentDefinitionV1 = {
    schemaVersion: 1,
    contractVersion: "bastion-incident-catalog/1",
    incidentDefinitionRef: value.incidentDefinitionRef,
    displayName: value.incidentDefinitionRef,
    kind: "TACTICAL_DEFENSE",
    publicNarrative: "Validation cataloguée.",
    effect: { schemaVersion: 1, kind: "TACTICAL_HANDOFF" }
  };
  return validateDefinition(value, syntheticIncident);
}

function validatePlayerProjection(
  value: BastionDefensePlayerProjectionV1
): string[] {
  const issues: string[] = [];
  if (
    value.schemaVersion !== 1
    || value.contractVersion !== BASTION_DEFENSE_PLAYER_PROJECTION_V1
  ) issues.push("player projection contract is invalid");
  for (const key of [
    "actorId",
    "characterId",
    "teamId",
    "characterStateAggregateId",
    "tacticalProjectionAggregateId"
  ] as const) {
    if (!nonEmpty(value[key])) issues.push(`${key} is required`);
  }
  if (
    value.gameBoardProjection === null
    || typeof value.gameBoardProjection !== "object"
    || Array.isArray(value.gameBoardProjection)
  ) issues.push("gameBoardProjection is required");
  return issues;
}

function uniqueRefs(refs: SourceRefV1[]): SourceRefV1[] {
  return [...new Map(
    refs.map(ref => [`${ref.kind}:${ref.id}`, cloneJson(ref)])
  ).values()].sort((left, right) =>
    `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`)
  );
}

function refused(reasonCode: string) {
  return {
    schemaVersion: 1 as const,
    authorized: false,
    reasonCode,
    seed: null
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0;
}

function publicText(value: unknown, maximumLength: number): value is string {
  return nonEmpty(value)
    && value.length <= maximumLength
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}

function invalid(messageKey: string, issues: string[]): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
