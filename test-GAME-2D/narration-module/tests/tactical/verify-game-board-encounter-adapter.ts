import assert from "node:assert/strict";
import {
  HANDOFF_CONTRACT_VERSION,
  type ProcessHandoffV1,
  type TacticalEncounterSeedV1
} from "../../src/handoff";
import type { BastionTacticalSessionV1 } from "../../src/application";
import {
  GAME_BOARD_ACTOR_PROJECTION_V1,
  GAME_BOARD_MAP_PROJECTION_V1,
  createEmbeddedGameBoardActorResolverV1,
  createEmbeddedGameBoardMapResolverV1,
  prepareGameBoardEncounterV1
} from "../../../src/tactical-integration/gameBoardEncounterAdapter";
import {
  buildGameBoardTacticalStateV1
} from "../../../src/tactical-integration/gameBoardTacticalState";
import {
  buildGameBoardTerminalReportV1,
  buildPendingGameBoardTacticalOutcomeV1
} from "../../../src/tactical-integration/gameBoardTacticalOutcome";
import { opaqueId, type CampaignId, type OperationId } from "../../src/core";

const campaignId = opaqueId<CampaignId>("cmp-game-board-adapter-7b");

function playerCharacter() {
  return {
    id: "character:pc-aryn",
    nom: { nomcomplet: "Aryn" },
    niveauGlobal: 1,
    classe: { 0: { classeId: "fighter", niveau: 1 } },
    caracs: {
      force: { FOR: 14 },
      dexterite: { DEX: 12 },
      constitution: { CON: 13 }
    },
    pvActuels: 11,
    actionIds: ["attack"],
    reactionIds: []
  };
}

function session(): BastionTacticalSessionV1 {
  const process: ProcessHandoffV1 = {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId: "process:bastion-defense:adapter-7b",
    campaignId,
    sourceOperationId: opaqueId<OperationId>("bastion-incident:adapter-7b"),
    sourceSceneId: "scene:old-bridge-inn",
    processKind: "TACTICAL_ENCOUNTER",
    status: "ACTIVE",
    createdAtGameSecond: 1_800,
    sourceRefs: [{ kind: "bastion", id: "bastion:old-bridge-inn" }],
    idempotencyKey: "bastion-defense:adapter-7b",
    version: 1,
    integratedOutcomeId: null,
    updatedAtGameSecond: null
  };
  const seed: TacticalEncounterSeedV1 = {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    seedId: "seed:bastion-defense:adapter-7b",
    processId: process.processId,
    campaignId,
    sceneId: process.sourceSceneId,
    locationRef: { kind: "place", id: "place:old-bridge-inn" },
    startedAtGameSecond: 1_800,
    rulesetRef: { kind: "ruleset", id: "rules.jdr5e:2" },
    cause: { eventId: "event:raid" },
    stakes: { placeRef: "place:old-bridge-inn" },
    objectives: [{ teamId: "defenders", objective: "protect_the_bastion" }],
    participants: [{
      actorId: "character:pc-aryn",
      tacticalProjectionRef: "tactical-projection:aryn:rev-4",
      gameBoardProjection: {
        schemaVersion: 1,
        contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
        actorId: "character:pc-aryn",
        teamId: "defenders",
        side: "PLAYER",
        character: playerCharacter()
      }
    }, {
      actorId: "attacker:raider-1",
      tacticalProjectionRef: "tactical-projection:raider-1:rev-2",
      gameBoardProjection: {
        schemaVersion: 1,
        contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
        actorId: "attacker:raider-1",
        teamId: "attackers",
        side: "ENEMY",
        enemyTypeId: "bandit"
      }
    }],
    teams: [
      { teamId: "defenders", actors: ["character:pc-aryn"] },
      { teamId: "attackers", actors: ["attacker:raider-1"] }
    ],
    tacticalMapRef: null,
    mapGenerationRequest: {
      gameBoardProjection: {
        schemaVersion: 1,
        contractVersion: GAME_BOARD_MAP_PROJECTION_V1,
        mapRef: "map-generation:old-bridge-inn-courtyard",
        prompt: "cour d’auberge sous la pluie, murs et charrette",
        grid: { cols: 12, rows: 10 },
        roundDurationSeconds: 6,
        representedEntryZoneIds: ["courtyard"],
        representedExitZoneIds: ["bridge-road"],
        representedTerrainIds: ["inn-walls"],
        representedHazardIds: ["rain"],
        lightingAndVisibility: { light: "night", visibility: "dim" },
        terminalConditions: {
          allEnemiesNeutralized: "all_hostiles_neutralized",
          playerDefeated: "bastion_taken"
        }
      }
    },
    entryZones: [{ zoneId: "courtyard" }],
    exitZones: [{ zoneId: "bridge-road" }],
    knownTerrain: [{ terrainId: "inn-walls", effect: "cover" }],
    lightingAndVisibility: { light: "night", visibility: "dim" },
    weatherAndHazards: [{ hazardId: "rain", severity: "low" }],
    initialPositions: [
      { actorId: "character:pc-aryn", x: 2, y: 5 },
      { actorId: "attacker:raider-1", x: 9, y: 5 }
    ],
    surpriseState: { surprisedActors: [] },
    allowedEndConditions: [
      "all_hostiles_neutralized",
      "attackers_retreat",
      "bastion_taken",
      "surrender"
    ],
    sourceAggregateRefs: [{ kind: "bastion", id: "bastion:old-bridge-inn" }],
    seedFingerprint: "fixture:game-board-adapter-7b",
    version: 1
  };
  return {
    schemaVersion: 1,
    contractVersion: "bastion-tactical-session/1",
    status: "READY_FOR_TACTICAL",
    sourceEventId: "event:bastion-defense-started",
    summary: {
      schemaVersion: 1,
      bastionId: "bastion:old-bridge-inn",
      placeRef: "place:old-bridge-inn",
      placeDisplayName: "L’Auberge du Vieux Pont",
      incidentId: "incident:raid",
      incidentDefinitionRef: "incident-definition:raid",
      incidentDisplayName: "Raid nocturne",
      kind: "TACTICAL_DEFENSE",
      status: "HANDOFF_ACTIVE",
      affectedInstallationDisplayName: null,
      tacticalProcessId: process.processId,
      occurredAtGameSecond: 1_800,
      narrative: "La défense commence."
    },
    process,
    seed,
    checkpoint: null,
    outcome: null
  };
}

async function main() {
  const source = session();
  const prepared = await prepareGameBoardEncounterV1({
    session: source,
    actorResolver: createEmbeddedGameBoardActorResolverV1(),
    mapResolver: createEmbeddedGameBoardMapResolverV1()
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.value.player.actorId, "character:pc-aryn");
  assert.equal(prepared.value.player.character.nom.nomcomplet, "Aryn");
  assert.deepEqual(prepared.value.player.position, { x: 2, y: 5 });
  assert.deepEqual(prepared.value.enemies, [{
    actorId: "attacker:raider-1",
    enemyTypeId: "bandit",
    position: { x: 9, y: 5 }
  }]);
  assert.deepEqual(prepared.value.map.grid, { cols: 12, rows: 10 });
  assert.equal(prepared.value.roundDurationSeconds, 6);
  assert.equal(
    (source.seed.participants[0]!.gameBoardProjection as {
      character: { nom: { nomcomplet: string } };
    }).character.nom.nomcomplet,
    "Aryn",
    "adapter must not mutate the committed seed"
  );

  const terminalState = buildGameBoardTacticalStateV1({
    processId: prepared.value.processId,
    seedId: prepared.value.seedId,
    seedFingerprint: prepared.value.seedFingerprint,
    turnBoundaryId: "terminal:round-2:all_hostiles_neutralized",
    round: 2,
    phase: "player",
    player: {
      id: prepared.value.player.actorId,
      type: "player",
      x: 4,
      y: 5,
      hp: 7,
      maxHp: 11
    },
    enemies: [{
      id: prepared.value.enemies[0]!.actorId,
      type: "enemy",
      x: 8,
      y: 5,
      hp: 0,
      maxHp: 9
    }],
    turnOrder: [{ id: prepared.value.player.actorId, type: "player" }],
    currentTurnIndex: 0,
    playerResources: { second_wind: 0 },
    map: {
      grid: { cols: 12, rows: 10 },
      theme: "generic",
      paletteId: null,
      obstacles: [],
      wallSegments: [],
      playableCells: ["4,5", "8,5"],
      terrain: [],
      height: [],
      light: [],
      roofOpenCells: [],
      decorations: [],
      effects: [],
      activeLevel: 0
    },
    journal: [{
      id: "event:attack-1",
      round: 2,
      phase: "player",
      kind: "damage",
      actorId: prepared.value.player.actorId,
      actorKind: "player",
      targetId: prepared.value.enemies[0]!.actorId,
      targetKind: "enemy",
      summary: "L’assaillant est neutralisé.",
      data: { damage: 9 },
      timestamp: 1
    }]
  });
  const terminalReport = buildGameBoardTerminalReportV1({
    encounter: prepared.value,
    state: terminalState,
    endCondition: "all_hostiles_neutralized",
    checkpointId: "checkpoint:terminal"
  });
  assert.equal(terminalReport.ok, true);
  if (!terminalReport.ok) return;
  const pendingOutcome = await buildPendingGameBoardTacticalOutcomeV1({
    session: source,
    encounter: prepared.value,
    report: terminalReport.value
  });
  assert.equal(pendingOutcome.ok, true);
  if (!pendingOutcome.ok) return;
  assert.equal(pendingOutcome.value.endCondition, "all_hostiles_neutralized");
  assert.equal(pendingOutcome.value.domainDeltas.length, 0);
  assert.equal(pendingOutcome.value.finalParticipantStates.length, 2);
  assert.equal(pendingOutcome.value.resourceChanges[0]?.delta, -4);
  assert.deepEqual(
    pendingOutcome.value.consequenceCandidates.map(value => value.ownerDomain),
    ["character", "bastion"]
  );

  const withoutResolver = await prepareGameBoardEncounterV1({
    session: source,
    actorResolver: null,
    mapResolver: createEmbeddedGameBoardMapResolverV1()
  });
  assert.equal(withoutResolver.ok, false);

  const missingProjection = session();
  delete missingProjection.seed.participants[1]!.gameBoardProjection;
  const missing = await prepareGameBoardEncounterV1({
    session: missingProjection,
    actorResolver: createEmbeddedGameBoardActorResolverV1(),
    mapResolver: createEmbeddedGameBoardMapResolverV1()
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.error.messageKey, "game-board.actor-projection-missing");
  }

  const companionNotYetSupported = session();
  companionNotYetSupported.seed.participants.push({
    actorId: "companion:mira",
    tacticalProjectionRef: "tactical-projection:mira",
    gameBoardProjection: {
      schemaVersion: 1,
      contractVersion: GAME_BOARD_ACTOR_PROJECTION_V1,
      actorId: "companion:mira",
      teamId: "defenders",
      side: "PLAYER",
      character: { ...playerCharacter(), id: "companion:mira" }
    }
  });
  companionNotYetSupported.seed.initialPositions.push({
    actorId: "companion:mira",
    x: 3,
    y: 5
  });
  (companionNotYetSupported.seed.teams[0]!.actors as string[]).push(
    "companion:mira"
  );
  const companion = await prepareGameBoardEncounterV1({
    session: companionNotYetSupported,
    actorResolver: createEmbeddedGameBoardActorResolverV1(),
    mapResolver: createEmbeddedGameBoardMapResolverV1()
  });
  assert.equal(companion.ok, false);
  if (!companion.ok) {
    assert.equal(
      companion.error.messageKey,
      "game-board.single-player-projection-required"
    );
  }

  const outsideMap = session();
  outsideMap.seed.initialPositions[1] = {
    actorId: "attacker:raider-1",
    x: 99,
    y: 5
  };
  const outside = await prepareGameBoardEncounterV1({
    session: outsideMap,
    actorResolver: createEmbeddedGameBoardActorResolverV1(),
    mapResolver: createEmbeddedGameBoardMapResolverV1()
  });
  assert.equal(outside.ok, false);
  if (!outside.ok) {
    assert.equal(
      outside.error.messageKey,
      "game-board.initial-position-out-of-bounds"
    );
  }

  const overlappingActors = session();
  overlappingActors.seed.initialPositions[1] = {
    actorId: "attacker:raider-1",
    x: 2,
    y: 5
  };
  const overlapping = await prepareGameBoardEncounterV1({
    session: overlappingActors,
    actorResolver: createEmbeddedGameBoardActorResolverV1(),
    mapResolver: createEmbeddedGameBoardMapResolverV1()
  });
  assert.equal(overlapping.ok, false);
  if (!overlapping.ok) {
    assert.equal(
      overlapping.error.messageKey,
      "game-board.initial-position-occupied"
    );
  }

  const missingHazard = session();
  const mapProjection = (
    missingHazard.seed.mapGenerationRequest as {
      gameBoardProjection: { representedHazardIds: string[] };
    }
  ).gameBoardProjection;
  mapProjection.representedHazardIds = [];
  const incompleteEnvironment = await prepareGameBoardEncounterV1({
    session: missingHazard,
    actorResolver: createEmbeddedGameBoardActorResolverV1(),
    mapResolver: createEmbeddedGameBoardMapResolverV1()
  });
  assert.equal(incompleteEnvironment.ok, false);
  if (!incompleteEnvironment.ok) {
    assert.equal(
      incompleteEnvironment.error.messageKey,
      "game-board.environment-projection-incomplete"
    );
  }

  const unsupportedSurprise = session();
  unsupportedSurprise.seed.surpriseState = {
    surprisedActors: ["attacker:raider-1"]
  };
  const surprise = await prepareGameBoardEncounterV1({
    session: unsupportedSurprise,
    actorResolver: createEmbeddedGameBoardActorResolverV1(),
    mapResolver: createEmbeddedGameBoardMapResolverV1()
  });
  assert.equal(surprise.ok, false);
  if (!surprise.ok) {
    assert.equal(
      surprise.error.messageKey,
      "game-board.environment-projection-incomplete"
    );
  }

  console.log("game-board encounter adapter 7B: OK");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
