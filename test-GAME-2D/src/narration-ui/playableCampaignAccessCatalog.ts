import {
  ACCESS_CONTROL_CONTRACT_V1,
  UPSERT_ACCESS_CONTROL_COMMAND_V1,
  assessDifficultyBandV1,
  buildUnresolvedSkillCheckProposalV1,
  createCatalogInventoryAccessRuntimeV1,
  createCatalogRulesAccessRuntimeV1,
  createCatalogSocialAccessRuntimeV1,
  createCatalogTacticalAccessRuntimeV1,
  loadActiveMechanicalCharacterContextV1,
  loadPinnedNarrativeRuleRegistryV1,
  resolveSkillCheckDifficultyV1,
  selectSkillCheckDifficultyBandV1,
  upsertAccessControlV1,
  type AccessControlOwnerPortV1,
  type AccessControlRecordV1,
  type InventoryAccessPolicyPortV1,
  type InventoryCredentialPortV1,
  type NarrativeInventoryAccessRuntimeV1,
  type NarrativeSocialAccessRuntimeV1,
  type NarrativeRulesAccessRuntimeV1,
  type NarrativeTacticalAccessRuntimeV1,
  type RulesAccessAuthorityPortV1,
  type PlayableScenePerceptionClueV1,
  type PlayableSceneStateV1,
  type SocialAccessAuthorityPortV1,
  type UpsertAccessControlCommandV1
} from "../../narration-module/src/application";
import type {
  CampaignId,
  CampaignRepository,
  JsonObject
} from "../../narration-module/src/core";
import {
  cloneJson,
  computeJsonFingerprint,
  coreError
} from "../../narration-module/src/core";
import {
  HANDOFF_CONTRACT_VERSION,
  type TacticalEncounterSeedV1
} from "../../narration-module/src/handoff";
import {
  loadActiveCampaignCharacterProfileV1,
  type CharacterAggregatePayloadV1,
  type TacticalCharacterProjectionV1
} from "../../narration-module/src/bootstrap";
import {
  GAME_BOARD_ACTOR_PROJECTION_V1,
  GAME_BOARD_MAP_PROJECTION_V1
} from "../tactical-integration/gameBoardEncounterAdapter";
import { buildGameBoardPlayerProjectionV1 } from "./playableCampaignBastionTactical";

export const THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1 =
  "access-control:caserne-centrale-chateau-tharqual";
export const THARQUAL_PASSAGE_ORDER_ITEM_ID_V1 =
  "obj_ordre_passage_tharqual";
export const THARQUAL_PASSAGE_SCOPE_REF_V1 =
  "access-scope:caserne-centrale-chateau-tharqual";
export const ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1 =
  "access-control:passage-eboule-torrent-froid";

const SOURCE_SCENE_ID = "wiki-location:caserne_centrale";
const CONNECTION_ID = "lore:caserne_centrale:connection:2";
const BOUNDARY_REF = "poi:caserne_centrale:poi:2";
const DESTINATION_REF = "location:chateau_tharqual";
const ARDHERNE_SOURCE_SCENE_ID = "wiki-location:passage_eboule_du_torrent";
const ARDHERNE_CONNECTION_ID = "lore:passage_eboule_du_torrent:connection:2";
const ARDHERNE_BOUNDARY_REF = "poi:passage_eboule_du_torrent:poi:2";
const ARDHERNE_DESTINATION_REF = "location:hameau_du_torrent_froid";
const RESPONDING_OFFICER_REF =
  "actor:wiki-location:caserne_centrale:ambient:2";
const AUTHORIZATION_REQUIREMENT_REF =
  `${THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1}:requirement:authorization`;
const SOCIAL_REQUIREMENT_REF =
  `${THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1}:requirement:social-permission`;
const LORE_SOURCE_REFS = [
  "lore-entity:caserne_centrale",
  "lore-attribute:caserne_centrale:acces",
  "lore-attribute:caserne_centrale:profil_autorite",
  "lore-attribute:caserne_centrale:lieux_connectes:1",
  "lore-entity:chateau_tharqual",
  "lore-attribute:chateau_tharqual:acces"
];
const ACCESS_POLICY_REF = "access-policy:tharqual-garrison-passage@1";
const SOCIAL_RULE_REF = "rule:tharqual-officer-audience@1";
const FORCE_RULE_REF = "rule:tharqual-garrison-force-barrier@1";
const ARDHERNE_PHYSICAL_REQUIREMENT_REF =
  `${ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1}:requirement:physical-clearance`;
const ARDHERNE_ACCESS_POLICY_REF = "access-policy:ardherne-rockfall-clearance@1";
const ARDHERNE_FORCE_RULE_REF = "rule:ardherne-rockfall-athletics@1";
const ARDHERNE_LORE_SOURCE_REFS = [
  "lore-entity:passage_eboule_du_torrent",
  "lore-attribute:passage_eboule_du_torrent:lieux_connectes:1",
  "lore-fragment:passage_eboule_du_torrent:/body/obstacle_visible",
  "lore-entity:ardherne",
  "lore-attribute:ardherne:risques_naturels"
];
const PERCEPTION_POLICY_REF = "perception-policy:tharqual-garrison-threshold@1";
export const THARQUAL_TACTICAL_ACCESS_POLICY_REF_V1 =
  "tactical-access-policy:tharqual-garrison-threshold@1";

const THARQUAL_ACCESS_PERCEPTION_CLUES_V1: PlayableScenePerceptionClueV1[] = [{
  schemaVersion: 1,
  clueId: "tharqual-threshold:visible-control",
  targetRef: BOUNDARY_REF,
  visibility: "IMMEDIATE",
  factKind: "VISIBLE_SIGN",
  playerText:
    "Le passage vers le Château Tharqual est gardé en permanence et son ouverture dépend d'un contrôle formel.",
  sourceRefs: [
    "lore-attribute:caserne_centrale:acces",
    "lore-attribute:caserne_centrale:profil_autorite",
    ACCESS_POLICY_REF,
    PERCEPTION_POLICY_REF
  ],
  version: 1
}, {
  schemaVersion: 1,
  clueId: "tharqual-threshold:no-visible-secondary-opening",
  targetRef: BOUNDARY_REF,
  visibility: "FOCUSED",
  factKind: "VISIBLE_SIGN",
  playerText:
    "Un examen attentif ne montre aucune ouverture secondaire visible contournant ce passage; l'hypothèse d'une porte latérale non gardée n'est pas confirmée.",
  sourceRefs: [
    "lore-attribute:caserne_centrale:lieux_connectes:1",
    "lore-attribute:caserne_centrale:niveau_securite",
    PERCEPTION_POLICY_REF
  ],
  version: 1
}, {
  schemaVersion: 1,
  clueId: "tharqual-threshold:officer-command-signal",
  targetRef: BOUNDARY_REF,
  visibility: "CHECKED",
  factKind: "VISIBLE_SIGN",
  playerText:
    "En suivant les relais de consigne, tu constates que les gardes attendent le signal de l'officier de quart : lui adresser une demande est une approche possible, mais ce constat n'accorde aucune permission.",
  sourceRefs: [
    "lore-attribute:caserne_centrale:profil_autorite",
    SOCIAL_RULE_REF,
    PERCEPTION_POLICY_REF
  ],
  version: 1
}];

export interface InstalledCredentialRecordV1 {
  schemaVersion: 1;
  credentialRef: string;
  itemInstanceId: string;
  itemId: string;
  holderActorRef: string;
  state: "ACTIVE" | "REVOKED";
  scopeRefs: string[];
  sourceRefs: string[];
}

export interface InstalledCredentialRegistryV1 {
  schemaVersion: 1;
  contractVersion: "installed-credential-registry/1";
  records: InstalledCredentialRecordV1[];
}

/**
 * The installed campaign starts without an issued passage order. Issuance is
 * deliberately owned by future quest/world content, never inferred from prose.
 */
export const INSTALLED_CREDENTIAL_REGISTRY_V1: InstalledCredentialRegistryV1 = {
  schemaVersion: 1,
  contractVersion: "installed-credential-registry/1",
  records: []
};

export function buildTharqualBarracksAccessControlV1(): AccessControlRecordV1 {
  return {
    schemaVersion: 1,
    contractVersion: ACCESS_CONTROL_CONTRACT_V1,
    accessControlRef: THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1,
    connectionId: CONNECTION_ID,
    sourceSceneId: SOURCE_SCENE_ID,
    boundaryRef: BOUNDARY_REF,
    destinationRef: DESTINATION_REF,
    state: "CONTROLLED",
    ownerDomain: "tharqual-garrison-access",
    thresholdDescription:
      "Le passage de la Caserne centrale vers le Château Tharqual est gardé et soumis à l'autorité de l'officier de quart.",
    requirements: [{
      schemaVersion: 1,
      requirementRef: AUTHORIZATION_REQUIREMENT_REF,
      kind: "AUTHORIZATION",
      description: "Présenter un ordre de passage actif couvrant ce seuil.",
      status: "ACTIVE",
      visibility: "ACTOR_KNOWN",
      ownerDomain: "inventory",
      sourceRefs: [...LORE_SOURCE_REFS, ACCESS_POLICY_REF],
      version: 1
    }, {
      schemaVersion: 1,
      requirementRef: SOCIAL_REQUIREMENT_REF,
      kind: "SOCIAL_PERMISSION",
      description: "Obtenir de l'officier de quart une autorisation d'audience sous sa responsabilité.",
      status: "ACTIVE",
      visibility: "PUBLIC",
      ownerDomain: "social",
      sourceRefs: [...LORE_SOURCE_REFS, SOCIAL_RULE_REF],
      version: 1
    }],
    approachDomains: ["inventory", "social", "perception", "rules", "tactical"],
    approachesAreNonExhaustive: true,
    sourceRefs: [...LORE_SOURCE_REFS, ACCESS_POLICY_REF],
    version: 1
  };
}

export function buildArdherneRockfallAccessControlV1(): AccessControlRecordV1 {
  return {
    schemaVersion: 1,
    contractVersion: ACCESS_CONTROL_CONTRACT_V1,
    accessControlRef: ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1,
    connectionId: ARDHERNE_CONNECTION_ID,
    sourceSceneId: ARDHERNE_SOURCE_SCENE_ID,
    boundaryRef: ARDHERNE_BOUNDARY_REF,
    destinationRef: ARDHERNE_DESTINATION_REF,
    state: "CONTROLLED",
    ownerDomain: "ardherne-road-clearance",
    thresholdDescription:
      "Un tronc lourd et des blocs issus d'un éboulement ferment la route vers le Hameau du Torrent-Froid.",
    requirements: [{
      schemaVersion: 1,
      requirementRef: ARDHERNE_PHYSICAL_REQUIREMENT_REF,
      kind: "PHYSICAL_STATE",
      description: "Dégager suffisamment le tronc et les blocs pour rendre la route praticable.",
      status: "ACTIVE",
      visibility: "PUBLIC",
      ownerDomain: "rules",
      sourceRefs: [...ARDHERNE_LORE_SOURCE_REFS, ARDHERNE_ACCESS_POLICY_REF],
      version: 1
    }],
    approachDomains: ["inventory", "rules", "perception", "world"],
    approachesAreNonExhaustive: true,
    sourceRefs: [...ARDHERNE_LORE_SOURCE_REFS, ARDHERNE_ACCESS_POLICY_REF],
    version: 1
  };
}

/**
 * Enrichit uniquement la scène installée qui porte le seuil réel. Les indices
 * décrivent des faits catalogués et ne modifient jamais le contrôle d'accès.
 */
export function applyInstalledAccessPerceptionCatalogV1(
  scene: PlayableSceneStateV1
): PlayableSceneStateV1 {
  if (
    scene.sceneId !== SOURCE_SCENE_ID
    || !scene.pointsOfInterest.some(point => `poi:${point.pointId}` === BOUNDARY_REF)
  ) return scene;
  const installedIds = new Set(THARQUAL_ACCESS_PERCEPTION_CLUES_V1.map(clue => clue.clueId));
  return {
    ...scene,
    perceptionClues: [
      ...scene.perceptionClues.filter(clue => !installedIds.has(clue.clueId)),
      ...THARQUAL_ACCESS_PERCEPTION_CLUES_V1.map(clue => ({
        ...clue,
        sourceRefs: [...clue.sourceRefs]
      }))
    ]
  };
}

export async function ensureInstalledPlayableAccessControlsV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sourceOperationId: string;
  occurredAtGameSecond: number;
}): Promise<void> {
  const controls = [
    { key: "tharqual", control: buildTharqualBarracksAccessControlV1() },
    { key: "ardherne-rockfall", control: buildArdherneRockfallAccessControlV1() }
  ];
  for (const installed of controls) {
    const command: UpsertAccessControlCommandV1 = {
      schemaVersion: 1,
      contractVersion: UPSERT_ACCESS_CONTROL_COMMAND_V1,
      clientRequestId: `installed-access:${input.campaignId}:${installed.key}:1`,
      sourceOperationId: input.sourceOperationId,
      occurredAtGameSecond: input.occurredAtGameSecond,
      control: installed.control
    };
    const result = await upsertAccessControlV1({
      repository: input.repository,
      campaignId: input.campaignId,
      command,
      ownerPort: installedAccessOwnerPort(command)
    });
    if (!result.ok) throw new Error(result.error.messageKey);
  }
}

export function createInstalledPlayableAccessRuntimesV1(input: {
  repository: CampaignRepository;
  credentialRegistry?: InstalledCredentialRegistryV1;
}): {
  inventoryAccessRuntime: NarrativeInventoryAccessRuntimeV1;
  socialAccessRuntime: NarrativeSocialAccessRuntimeV1;
  rulesAccessRuntime: NarrativeRulesAccessRuntimeV1;
  tacticalAccessRuntime: NarrativeTacticalAccessRuntimeV1;
} {
  const credentialRegistry =
    input.credentialRegistry ?? INSTALLED_CREDENTIAL_REGISTRY_V1;
  return {
    inventoryAccessRuntime: createCatalogInventoryAccessRuntimeV1({
      itemResolver: {
        async resolve(request) {
          const normalized = normalize(request.rawInput);
          if (request.control.accessControlRef === ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1) {
            if (!/\b(epee|épée|lame)\b/u.test(normalized)) {
              return { ok: false, issues: ["aucun objet d'inventaire reconnu n'est nommé"] };
            }
            const item = request.character.inventory.find(candidate =>
              candidate.itemId === "epee-longue"
            );
            return item === undefined
              ? { ok: false, issues: ["l'épée longue nommée est absente de character.state"] }
              : {
                  ok: true,
                  itemInstanceId: item.instanceId,
                  playerFacingLabel: "L'épée longue"
                };
          }
          if (request.control.accessControlRef !== THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1) {
            return { ok: false, issues: ["unsupported installed access control"] };
          }
          const names = [
            "ordre de passage",
            "ordre tharqual",
            "laissez passer tharqual",
            "autorisation de la garnison"
          ];
          if (!names.some(name => normalized.includes(normalize(name)))) {
            return { ok: false, issues: ["no accepted item alias was named"] };
          }
          const item = request.character.inventory.find(candidate =>
            candidate.itemId === THARQUAL_PASSAGE_ORDER_ITEM_ID_V1
          );
          return item === undefined
            ? { ok: false, issues: ["the named passage order is absent from character.state"] }
            : {
                ok: true,
                itemInstanceId: item.instanceId,
                playerFacingLabel: "L'ordre de passage Tharqual"
              };
        }
      },
      policyPort: installedInventoryPolicyPort(),
      credentialPort: installedCredentialPort(credentialRegistry)
    }),
    socialAccessRuntime: createCatalogSocialAccessRuntimeV1({
      targetResolver: {
        async resolve(request) {
          if (request.control.accessControlRef !== THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1) {
            return { ok: false, issues: ["unsupported installed access control"] };
          }
          const officer = request.activeScene.ambientPopulation.find(actor =>
            `actor:${actor.actorId}` === RESPONDING_OFFICER_REF
          );
          return officer === undefined
            ? { ok: false, issues: ["authorized duty officer is absent from the active scene"] }
            : {
                ok: true,
                actorRef: RESPONDING_OFFICER_REF,
                displayName: officer.displayName
              };
        }
      },
      authorityPort: installedSocialAuthorityPort(input.repository)
    }),
    rulesAccessRuntime: createCatalogRulesAccessRuntimeV1({
      methodResolver: {
        async resolve(request) {
          const normalized = normalize(request.rawInput);
          if (/\b(crochete|crocheter|crochetage)\b/u.test(normalized)) {
            return { ok: false, issues: [
              "aucune définition concrète d'outils de voleur n'est installée dans le catalogue de campagne"
            ] };
          }
          if (!/\b(force|forcer|enfonce|enfoncer|degage|degager|souleve|soulever|deplace|deplacer)\b/u.test(normalized)) {
            return { ok: false, issues: ["méthode mécanique non reconnue par la politique installée"] };
          }
          return { ok: true, method: "FORCE", toolItemInstanceId: null };
        }
      },
      authorityPort: installedRulesAuthorityPort(input.repository)
    }),
    tacticalAccessRuntime: createCatalogTacticalAccessRuntimeV1({
      seedFactory: installedTacticalAccessSeedFactory(),
      resolutionPolicy: {
        policyRef: THARQUAL_TACTICAL_ACCESS_POLICY_REF_V1,
        resolve(request) {
          if (request.accessControlRef !== THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1) {
            return tacticalFailure("tactical-access.policy-control-mismatch");
          }
          if (request.endCondition === "all_hostiles_neutralized") {
            return { ok: true, value: {
              schemaVersion: 1,
              resolutionCode: "GUARDS_NEUTRALIZED_ACCESS_OPEN",
              resultingAccessState: "OPEN",
              waiveRequirementRefs: [
                AUTHORIZATION_REQUIREMENT_REF,
                SOCIAL_REQUIREMENT_REF
              ],
              publicNarrative:
                "Les gardes ne tiennent plus le seuil. Le passage vers le Chateau Tharqual est ouvert par l'issue tactique validee."
            } };
          }
          if (request.endCondition === "player_defeated") {
            return { ok: true, value: {
              schemaVersion: 1,
              resolutionCode: "PLAYER_DEFEATED_ACCESS_CONTROLLED",
              resultingAccessState: "CONTROLLED",
              waiveRequirementRefs: [],
              publicNarrative:
                "Les gardes conservent le seuil. Le passage vers le Chateau Tharqual reste controle."
            } };
          }
          return tacticalFailure("tactical-access.terminal-condition-unsupported");
        }
      }
    })
  };
}

function installedTacticalAccessSeedFactory() {
  return {
    async prepare(input: {
      repository: CampaignRepository;
      campaignId: CampaignId;
      control: AccessControlRecordV1;
      activeScene: PlayableSceneStateV1;
      occurredAtGameSecond: number;
    }) {
      if (
        input.control.accessControlRef !== THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1
        || input.activeScene.sceneId !== SOURCE_SCENE_ID
      ) return tacticalFailure("tactical-access.installed-threshold-mismatch");
      const profile = await loadActiveCampaignCharacterProfileV1({
        repository: input.repository,
        campaignId: input.campaignId
      });
      if (!profile.ok) return profile;
      const [character, tactical] = await Promise.all([
        input.repository.getAggregate(
          input.campaignId,
          "character.state",
          profile.value.characterStateAggregateId
        ),
        input.repository.getAggregate(
          input.campaignId,
          "character.tactical-projection",
          profile.value.tacticalProjectionAggregateId
        )
      ]);
      if (!character.ok) return character;
      if (!tactical.ok) return tactical;
      const playerTeamId = "tharqual-intruder";
      const guardTeamId = "tharqual-garrison";
      const guardActorId = "guard:caserne-centrale:threshold-2";
      const token = (await computeJsonFingerprint({
        campaignId: input.campaignId,
        accessControlRef: input.control.accessControlRef,
        sourceOperationSeed: input.occurredAtGameSecond,
        characterId: profile.value.characterId
      })).replace(/^sha256:/u, "").slice(0, 40);
      const processId = `tactical:access:${token}`;
      const playerProjection = buildGameBoardPlayerProjectionV1({
        actorId: profile.value.actorId,
        teamId: playerTeamId,
        character: character.value.payload as unknown as CharacterAggregatePayloadV1,
        tactical: tactical.value.payload as unknown as TacticalCharacterProjectionV1
      });
      const lightingAndVisibility = { light: "daylight", visibility: "clear" };
      const base = {
        schemaVersion: 1 as const,
        contractVersion: HANDOFF_CONTRACT_VERSION,
        seedId: `seed:tactical-access:${token}`,
        processId,
        campaignId: input.campaignId,
        sceneId: input.activeScene.sceneId,
        locationRef: { kind: "access-boundary", id: BOUNDARY_REF },
        startedAtGameSecond: input.occurredAtGameSecond,
        rulesetRef: { kind: "ruleset", id: "rules.jdr5e:2" },
        cause: {
          kind: "PLAYER_HOSTILE_ACCESS_APPROACH",
          accessControlRef: input.control.accessControlRef
        },
        stakes: {
          accessControlRef: input.control.accessControlRef,
          destinationRef: input.control.destinationRef,
          resolutionPolicyRef: THARQUAL_TACTICAL_ACCESS_POLICY_REF_V1
        },
        objectives: [{
          teamId: playerTeamId,
          objective: "neutralize_threshold_guards"
        }, {
          teamId: guardTeamId,
          objective: "hold_controlled_threshold"
        }],
        participants: [{
          actorId: profile.value.actorId,
          characterId: profile.value.characterId,
          characterStateAggregateRef: profile.value.characterStateAggregateId,
          tacticalProjectionAggregateRef: profile.value.tacticalProjectionAggregateId,
          gameBoardProjection: cloneJson(playerProjection)
        } as JsonObject, {
          actorId: guardActorId,
          gameBoardProjection: {
            schemaVersion: 1,
            contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
            actorId: guardActorId,
            teamId: guardTeamId,
            side: "ENEMY",
            enemyTypeId: "brute"
          }
        } as JsonObject],
        teams: [{
          teamId: playerTeamId,
          actors: [profile.value.actorId]
        }, {
          teamId: guardTeamId,
          actors: [guardActorId]
        }],
        tacticalMapRef: null,
        mapGenerationRequest: {
          gameBoardProjection: {
            schemaVersion: 1,
            contractVersion: GAME_BOARD_MAP_PROJECTION_V1,
            mapRef: "map:tharqual-barracks-threshold-v1",
            prompt: "passage militaire garde entre la caserne centrale et le Chateau Tharqual",
            grid: { cols: 12, rows: 10 },
            roundDurationSeconds: 6,
            representedEntryZoneIds: ["barracks-side"],
            representedExitZoneIds: ["castle-side"],
            representedTerrainIds: [],
            representedHazardIds: [],
            lightingAndVisibility,
            terminalConditions: {
              allEnemiesNeutralized: "all_hostiles_neutralized",
              playerDefeated: "player_defeated"
            }
          }
        },
        entryZones: [{ zoneId: "barracks-side" }],
        exitZones: [{ zoneId: "castle-side" }],
        knownTerrain: [],
        lightingAndVisibility,
        weatherAndHazards: [],
        initialPositions: [{
          actorId: profile.value.actorId,
          x: 2,
          y: 5
        }, {
          actorId: guardActorId,
          x: 9,
          y: 5
        }],
        surpriseState: { surprisedActors: [] },
        allowedEndConditions: [
          "all_hostiles_neutralized",
          "player_defeated"
        ],
        sourceAggregateRefs: [{
          kind: "access.control",
          id: input.control.accessControlRef
        }, {
          kind: "character.state",
          id: profile.value.characterStateAggregateId
        }, {
          kind: "character.tactical-projection",
          id: profile.value.tacticalProjectionAggregateId
        }, {
          kind: "rule",
          id: THARQUAL_TACTICAL_ACCESS_POLICY_REF_V1
        }],
        version: 1 as const
      };
      const seed: TacticalEncounterSeedV1 = {
        ...base,
        seedFingerprint: await computeJsonFingerprint(base as unknown as JsonObject)
      };
      return { ok: true as const, value: {
        seed,
        placeDisplayName: "Caserne centrale de Tharqual",
        incidentDisplayName: "Affrontement au passage du Chateau",
        narrative:
          "Les gardes prennent position. Le conflit doit etre joue sur le plateau tactique avant que l'acces puisse changer.",
        resolutionPolicyRef: THARQUAL_TACTICAL_ACCESS_POLICY_REF_V1
      } };
    }
  };
}

function tacticalFailure<T>(messageKey: string) {
  return {
    ok: false as const,
    error: coreError("VALIDATION_FAILED", messageKey)
  };
}

function installedRulesAuthorityPort(
  repository: CampaignRepository
): RulesAccessAuthorityPortV1 {
  return {
    async authorize(input) {
      if (input.control.accessControlRef === ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1) {
        if (
          input.command.deviceRef !== ARDHERNE_BOUNDARY_REF
          || input.command.method !== "FORCE"
          || input.command.toolItemInstanceId !== null
        ) return { ok: false, issues: ["dispositif, méthode ou outil incompatible avec l'éboulement d'Ardherne"] };
        const [context, registry] = await Promise.all([
          loadActiveMechanicalCharacterContextV1({
            repository,
            campaignId: input.campaignId,
            ability: "FOR",
            skillId: "athletics"
          }),
          loadPinnedNarrativeRuleRegistryV1({ repository, campaignId: input.campaignId })
        ]);
        if (!context.ok) return { ok: false, issues: [context.error.messageKey] };
        if (!registry.ok) return { ok: false, issues: [registry.error.messageKey] };
        if (context.value === null || registry.value === null) {
          return { ok: false, issues: ["pinned character or ruleset context is unavailable"] };
        }
        const token = input.command.sourceOperationId.slice(-28);
        const checkId = `rules-check:ardherne-rockfall:${token}`;
        const proposal = selectSkillCheckDifficultyBandV1(
          buildUnresolvedSkillCheckProposalV1({
            checkId,
            domain: "rules",
            goal: "Dégager le tronc et les blocs qui ferment la route du Torrent-Froid.",
            targetRef: ARDHERNE_BOUNDARY_REF,
            ability: "FOR",
            skillId: "athletics",
            characterContext: context.value,
            passiveEligible: false,
            passiveReason: "Le dégagement de l'obstacle exige un effort physique actif.",
            successStake: "L'obstacle est déplacé et la route devient praticable.",
            failureStake: "L'obstacle résiste et la route reste fermée.",
            sourceRefs: [...ARDHERNE_LORE_SOURCE_REFS, ARDHERNE_ACCESS_POLICY_REF, ARDHERNE_FORCE_RULE_REF]
          }),
          assessDifficultyBandV1({
            baseBand: "MEDIUM",
            factors: [{
              factorId: "ardherne.rockfall-heavy-obstacle",
              shift: 0,
              publicReason: "Le tronc lourd et les blocs demandent un effort soutenu.",
              sourceRef: "lore-fragment:passage_eboule_du_torrent:/body/obstacle_visible",
              visibility: "PLAYER_VISIBLE"
            }]
          })
        );
        const resolved = await resolveSkillCheckDifficultyV1({ proposal, registry: registry.value });
        if (!resolved.ok) return { ok: false, issues: [resolved.code] };
        return { ok: true, authorization: {
          schemaVersion: 1,
          authority: "RULES_ACCESS_DOMAIN",
          resolutionRef: `rules-access-resolution:${token}:ardherne-rockfall`,
          accessControlRef: input.control.accessControlRef,
          actorRef: input.command.actorRef,
          deviceRef: ARDHERNE_BOUNDARY_REF,
          method: "FORCE",
          toolItemInstanceId: null,
          checkPolicy: {
            schemaVersion: 1,
            proposal: resolved.value,
            method: "FORCE",
            deviceRef: ARDHERNE_BOUNDARY_REF,
            requiredItemIds: [],
            durationSeconds: 60,
            success: {
              playerFacingText: "Après un effort soutenu, le tronc roule assez loin et les blocs sont écartés. La route vers le Hameau du Torrent-Froid est ouverte.",
              satisfyRequirementRefs: [ARDHERNE_PHYSICAL_REQUIREMENT_REF],
              waiveRequirementRefs: [],
              resultingAccessState: "OPEN",
              noise: "AUDIBLE",
              consumedItemInstanceIds: [],
              sourceRefs: [...ARDHERNE_LORE_SOURCE_REFS, ARDHERNE_ACCESS_POLICY_REF, ARDHERNE_FORCE_RULE_REF]
            },
            failure: {
              playerFacingText: "Le tronc bouge à peine puis se cale contre les blocs. La route reste obstruée.",
              resultingAccessState: "CONTROLLED",
              noise: "AUDIBLE",
              consumedItemInstanceIds: [],
              sourceRefs: [...ARDHERNE_LORE_SOURCE_REFS, ARDHERNE_ACCESS_POLICY_REF, ARDHERNE_FORCE_RULE_REF]
            },
            ruleRefs: [ARDHERNE_FORCE_RULE_REF, "core.check.difficulty-class@1"]
          },
          sourceRefs: [...ARDHERNE_LORE_SOURCE_REFS, ARDHERNE_ACCESS_POLICY_REF, ARDHERNE_FORCE_RULE_REF]
        } };
      }
      if (
        input.control.accessControlRef !== THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1
        || input.command.deviceRef !== BOUNDARY_REF
        || input.command.method !== "FORCE"
        || input.command.toolItemInstanceId !== null
      ) return { ok: false, issues: ["dispositif, méthode ou outil incompatible avec la politique installée"] };
      const [context, registry] = await Promise.all([
        loadActiveMechanicalCharacterContextV1({
          repository,
          campaignId: input.campaignId,
          ability: "FOR",
          skillId: "athletics"
        }),
        loadPinnedNarrativeRuleRegistryV1({ repository, campaignId: input.campaignId })
      ]);
      if (!context.ok) return { ok: false, issues: [context.error.messageKey] };
      if (!registry.ok) return { ok: false, issues: [registry.error.messageKey] };
      if (context.value === null || registry.value === null) return { ok: false, issues: ["pinned character or ruleset context is unavailable"] };
      const token = input.command.sourceOperationId.slice(-28);
      const checkId = `rules-check:tharqual-force:${token}`;
      const proposal = selectSkillCheckDifficultyBandV1(
        buildUnresolvedSkillCheckProposalV1({
          checkId,
          domain: "rules",
          goal: "Forcer physiquement le dispositif gardé du passage vers le Château Tharqual.",
          targetRef: BOUNDARY_REF,
          ability: "FOR",
          skillId: "athletics",
          characterContext: context.value,
          passiveEligible: false,
          passiveReason: "Une contrainte physique active exige un test.",
          successStake: "Le dispositif cède bruyamment et le passage devient physiquement ouvert.",
          failureStake: "Le dispositif résiste, le passage reste contrôlé et le bruit est entendu.",
          sourceRefs: [...LORE_SOURCE_REFS, ACCESS_POLICY_REF, FORCE_RULE_REF]
        }),
        assessDifficultyBandV1({
          baseBand: "HARD",
          factors: [{
            factorId: "tharqual.high-security-barrier",
            shift: 0,
            publicReason: "Le passage appartient à un site militaire de haute sécurité.",
            sourceRef: "lore-attribute:caserne_centrale:niveau_securite",
            visibility: "PLAYER_VISIBLE"
          }]
        })
      );
      const resolved = await resolveSkillCheckDifficultyV1({ proposal, registry: registry.value });
      if (!resolved.ok) return { ok: false, issues: [resolved.code] };
      return { ok: true, authorization: {
        schemaVersion: 1,
        authority: "RULES_ACCESS_DOMAIN",
        resolutionRef: `rules-access-resolution:${token}:force`,
        accessControlRef: input.control.accessControlRef,
        actorRef: input.command.actorRef,
        deviceRef: BOUNDARY_REF,
        method: "FORCE",
        toolItemInstanceId: null,
        checkPolicy: {
          schemaVersion: 1,
          proposal: resolved.value,
          method: "FORCE",
          deviceRef: BOUNDARY_REF,
          requiredItemIds: [],
          durationSeconds: 6,
          success: {
            playerFacingText: "Le dispositif cède dans un fracas métallique. Le passage est physiquement ouvert, mais le bruit porte dans la caserne.",
            satisfyRequirementRefs: [],
            waiveRequirementRefs: [AUTHORIZATION_REQUIREMENT_REF, SOCIAL_REQUIREMENT_REF],
            resultingAccessState: "OPEN",
            noise: "LOUD",
            consumedItemInstanceIds: [],
            sourceRefs: [...LORE_SOURCE_REFS, ACCESS_POLICY_REF, FORCE_RULE_REF]
          },
          failure: {
            playerFacingText: "Le dispositif résiste. Le passage reste contrôlé et le choc métallique est entendu dans la caserne.",
            resultingAccessState: "CONTROLLED",
            noise: "LOUD",
            consumedItemInstanceIds: [],
            sourceRefs: [...LORE_SOURCE_REFS, ACCESS_POLICY_REF, FORCE_RULE_REF]
          },
          ruleRefs: [FORCE_RULE_REF, "core.check.difficulty-class@1"]
        },
        sourceRefs: [...LORE_SOURCE_REFS, ACCESS_POLICY_REF, FORCE_RULE_REF]
      } };
    }
  };
}

function installedInventoryPolicyPort(): InventoryAccessPolicyPortV1 {
  return {
    async authorize(input) {
      if (input.control.accessControlRef === ARDHERNE_ROCKFALL_ACCESS_CONTROL_REF_V1) {
        return {
          ok: false,
          issues: [
            "une épée ordinaire n'est pas un outil autorisé pour dégager sans risque le tronc et les blocs"
          ]
        };
      }
      if (input.control.accessControlRef !== THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1) {
        return { ok: false, issues: ["unsupported installed access control"] };
      }
      return { ok: true, authorization: {
        schemaVersion: 1,
        authority: "INVENTORY_ACCESS_POLICY",
        policyRef: ACCESS_POLICY_REF,
        accessControlRef: input.control.accessControlRef,
        requirementRef: AUTHORIZATION_REQUIREMENT_REF,
        acceptedItemIds: [THARQUAL_PASSAGE_ORDER_ITEM_ID_V1],
        accessibility: "OWNED_INVENTORY",
        credentialMode: "ACTIVE_PROOF_REQUIRED",
        credentialScopeRef: THARQUAL_PASSAGE_SCOPE_REF_V1,
        usePolicy: "RETAIN",
        satisfyRequirementRefs: [AUTHORIZATION_REQUIREMENT_REF],
        waiveRequirementRefs: [SOCIAL_REQUIREMENT_REF],
        resultingAccessState: "OPEN",
        sourceRefs: [...LORE_SOURCE_REFS, ACCESS_POLICY_REF]
      } };
    }
  };
}

function installedCredentialPort(
  registry: InstalledCredentialRegistryV1
): InventoryCredentialPortV1 {
  return {
    async verify(input) {
      const record = registry.records.find(candidate =>
        candidate.itemInstanceId === input.item.instanceId
        && candidate.itemId === input.item.itemId
        && candidate.holderActorRef === input.command.actorRef
      );
      if (record === undefined) {
        return { ok: false, issues: ["credential is not registered"] };
      }
      if (record.state !== "ACTIVE") {
        return { ok: false, issues: ["credential is revoked"] };
      }
      if (!record.scopeRefs.includes(THARQUAL_PASSAGE_SCOPE_REF_V1)) {
        return { ok: false, issues: ["credential does not cover this threshold"] };
      }
      return { ok: true, proof: {
        schemaVersion: 1,
        authority: "INVENTORY_CREDENTIAL_DOMAIN",
        proofRef: `credential-proof:${record.credentialRef}`,
        itemInstanceId: record.itemInstanceId,
        itemId: record.itemId,
        holderActorRef: record.holderActorRef,
        state: "ACTIVE",
        validAtGameSecond: input.command.occurredAtGameSecond,
        scopeRefs: [...record.scopeRefs],
        sourceRefs: [...record.sourceRefs, ACCESS_POLICY_REF]
      } };
    }
  };
}

function installedSocialAuthorityPort(
  repository: CampaignRepository
): SocialAccessAuthorityPortV1 {
  return {
    async resolve(input) {
      if (
        input.control.accessControlRef !== THARQUAL_BARRACKS_ACCESS_CONTROL_REF_V1
        || input.command.targetActorRef !== RESPONDING_OFFICER_REF
      ) return { ok: false, issues: ["threshold or responding officer mismatch"] };
      const [context, registry] = await Promise.all([
        loadActiveMechanicalCharacterContextV1({
          repository,
          campaignId: input.campaignId,
          ability: "CHA",
          skillId: "persuasion"
        }),
        loadPinnedNarrativeRuleRegistryV1({
          repository,
          campaignId: input.campaignId
        })
      ]);
      if (!context.ok) return { ok: false, issues: [context.error.messageKey] };
      if (!registry.ok) return { ok: false, issues: [registry.error.messageKey] };
      if (context.value === null || registry.value === null) {
        return { ok: false, issues: ["pinned character or ruleset context is unavailable"] };
      }
      const resolutionRef =
        `social-access-resolution:${input.command.sourceOperationId}:tharqual`;
      const operationToken = input.command.sourceOperationId.slice(-36);
      const checkId = `social-check:tharqual:${operationToken}`;
      const proposal = selectSkillCheckDifficultyBandV1(
        buildUnresolvedSkillCheckProposalV1({
          checkId,
          domain: "social",
          goal: "Obtenir de l'officier de quart une audience au Château Tharqual sous sa responsabilité.",
          targetRef: RESPONDING_OFFICER_REF,
          ability: "CHA",
          skillId: "persuasion",
          characterContext: context.value,
          passiveEligible: false,
          passiveReason: "Une permission exceptionnelle exige un échange actif.",
          successStake: "L'officier accorde cette audience et lève le contrôle pour ce passage.",
          failureStake: "L'officier maintient le contrôle sans aggraver la situation.",
          sourceRefs: [...LORE_SOURCE_REFS, SOCIAL_RULE_REF]
        }),
        assessDifficultyBandV1({
          baseBand: "HARD",
          factors: [{
            factorId: "tharqual.very-restricted-access",
            shift: 0,
            publicReason: "Le Château et la Caserne appliquent un contrôle formel et très restreint.",
            sourceRef: "lore-attribute:caserne_centrale:acces",
            visibility: "PLAYER_VISIBLE"
          }]
        })
      );
      const resolved = await resolveSkillCheckDifficultyV1({
        proposal,
        registry: registry.value
      });
      if (!resolved.ok) return { ok: false, issues: [resolved.code] };
      return { ok: true, authorization: {
        schemaVersion: 1,
        authority: "SOCIAL_ACCESS_DOMAIN",
        resolutionRef,
        accessControlRef: input.control.accessControlRef,
        respondingActorRef: RESPONDING_OFFICER_REF,
        outcome: "CHECK_REQUIRED",
        requirementRef: null,
        satisfyRequirementRefs: [],
        waiveRequirementRefs: [],
        resultingAccessState: "CONTROLLED",
        playerFacingResponse:
          "L'officier de quart écoute ta demande, mais cette audience exceptionnelle doit être justifiée.",
        conditionRef: null,
        checkProposalRef: checkId,
        checkPolicy: {
          schemaVersion: 1,
          proposal: resolved.value,
          durationSeconds: 60,
          success: {
            playerFacingResponse:
              "L'officier accepte de répondre de cette audience et ordonne au garde de lever le passage.",
            requirementRef: SOCIAL_REQUIREMENT_REF,
            satisfyRequirementRefs: [SOCIAL_REQUIREMENT_REF],
            waiveRequirementRefs: [AUTHORIZATION_REQUIREMENT_REF],
            resultingAccessState: "OPEN",
            sourceRefs: [...LORE_SOURCE_REFS, SOCIAL_RULE_REF]
          },
          failure: {
            playerFacingResponse:
              "L'officier refuse d'engager sa responsabilité : le passage reste contrôlé.",
            sourceRefs: [...LORE_SOURCE_REFS, SOCIAL_RULE_REF]
          },
          ruleRefs: [SOCIAL_RULE_REF, "core.check.difficulty-class@1"]
        },
        sourceRefs: [...LORE_SOURCE_REFS, SOCIAL_RULE_REF]
      } };
    }
  };
}

function installedAccessOwnerPort(
  command: UpsertAccessControlCommandV1
): AccessControlOwnerPortV1 {
  return {
    async authorize() {
      return { ok: true, authorization: {
        schemaVersion: 1,
        authority: "ACCESS_OWNER_DOMAIN",
        sourceOperationId: command.sourceOperationId,
        accessControlRef: command.control.accessControlRef,
        connectionId: command.control.connectionId,
        ownerDomain: command.control.ownerDomain,
        permittedState: command.control.state,
        sourceRefs: [...command.control.sourceRefs]
      } };
    }
  };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
}
