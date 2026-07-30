import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { GameBoard } from "../../../src/GameBoard";
import { sampleCharacter } from "../../../src/data/models/sampleCharacter";
import {
  GAME_BOARD_ENCOUNTER_INPUT_V1,
  GAME_BOARD_MAP_PROJECTION_V1,
  type GameBoardEncounterInputV1
} from "../../../src/tactical-integration/gameBoardEncounterAdapter";
import type {
  GameBoardTacticalStateV1
} from "../../../src/tactical-integration/gameBoardTacticalState";
import type {
  GameBoardTerminalReportV1
} from "../../../src/tactical-integration/gameBoardTacticalOutcome";
import {
  HANDOFF_CONTRACT_VERSION,
  type ProcessHandoffV1,
  type TacticalEncounterSeedV1
} from "../../src/handoff";
import {
  BASTION_TACTICAL_SESSION_CONTRACT_V1,
  type BastionTacticalSessionV1
} from "../../src/application";
import {
  opaqueId,
  type CampaignId,
  type OperationId
} from "../../src/core";

const campaignId = opaqueId<CampaignId>("cmp-game-board-browser-7b");
const process: ProcessHandoffV1 = {
  schemaVersion: 1,
  contractVersion: HANDOFF_CONTRACT_VERSION,
  processId: "process:game-board-browser-7b",
  campaignId,
  sourceOperationId: opaqueId<OperationId>("bastion-incident:browser-7b"),
  sourceSceneId: "scene:old-bridge-inn",
  processKind: "TACTICAL_ENCOUNTER",
  status: "ACTIVE",
  createdAtGameSecond: 1_800,
  sourceRefs: [{ kind: "bastion", id: "bastion:old-bridge-inn" }],
  idempotencyKey: "game-board-browser-7b",
  version: 1,
  integratedOutcomeId: null,
  updatedAtGameSecond: null
};
const seed: TacticalEncounterSeedV1 = {
  schemaVersion: 1,
  contractVersion: HANDOFF_CONTRACT_VERSION,
  seedId: "seed:game-board-browser-7b",
  processId: process.processId,
  campaignId,
  sceneId: process.sourceSceneId,
  locationRef: { kind: "place", id: "place:old-bridge-inn" },
  startedAtGameSecond: 1_800,
  rulesetRef: { kind: "ruleset", id: "rules.jdr5e:2" },
  cause: { eventId: "event:night-raid" },
  stakes: { placeRef: "place:old-bridge-inn" },
  objectives: [{ teamId: "defenders", objective: "protect_the_bastion" }],
  participants: [
    { actorId: "character:pc-aryn" },
    { actorId: "attacker:raider-1" }
  ],
  teams: [
    { teamId: "defenders", actors: ["character:pc-aryn"] },
    { teamId: "attackers", actors: ["attacker:raider-1"] }
  ],
  tacticalMapRef: null,
  mapGenerationRequest: { mapRef: "map-generation:inn-courtyard" },
  entryZones: [{ zoneId: "courtyard" }],
  exitZones: [{ zoneId: "bridge-road" }],
  knownTerrain: [],
  lightingAndVisibility: { light: "night" },
  weatherAndHazards: [],
  initialPositions: [
    { actorId: "character:pc-aryn", x: 2, y: 4 },
    { actorId: "attacker:raider-1", x: 8, y: 4 }
  ],
  surpriseState: { surprisedActors: [] },
  allowedEndConditions: [
    "all_hostiles_neutralized",
    "attackers_retreat",
    "bastion_taken"
  ],
  sourceAggregateRefs: [{ kind: "bastion", id: "bastion:old-bridge-inn" }],
  seedFingerprint: "fixture:game-board-browser-7b",
  version: 1
};
const session: BastionTacticalSessionV1 = {
  schemaVersion: 1,
  contractVersion: BASTION_TACTICAL_SESSION_CONTRACT_V1,
  status: "READY_FOR_TACTICAL",
  sourceEventId: "event:bastion-defense-started",
  summary: {
    schemaVersion: 1,
    bastionId: "bastion:old-bridge-inn",
    placeRef: "place:old-bridge-inn",
    placeDisplayName: "L’Auberge du Vieux Pont",
    incidentId: "incident:night-raid",
    incidentDefinitionRef: "incident-definition:night-raid",
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
const character = structuredClone(sampleCharacter);
character.id = "character:pc-aryn";
character.nom = { ...character.nom, nomcomplet: "Aryn" };
const encounter: GameBoardEncounterInputV1 = {
  schemaVersion: 1,
  contractVersion: GAME_BOARD_ENCOUNTER_INPUT_V1,
  processId: process.processId,
  seedId: seed.seedId,
  seedFingerprint: seed.seedFingerprint,
  sourceSceneId: seed.sceneId,
  locationRef: seed.locationRef.id,
  player: {
    actorId: character.id,
    character,
    position: { x: 2, y: 4 }
  },
  enemies: [{
    actorId: "attacker:raider-1",
    enemyTypeId: "brute",
    position: { x: 8, y: 4 }
  }],
  map: {
    schemaVersion: 1,
    contractVersion: GAME_BOARD_MAP_PROJECTION_V1,
    mapRef: "map-generation:inn-courtyard",
    prompt: "cour d’auberge sous la pluie avec murs et charrette",
    grid: { cols: 12, rows: 10 },
    roundDurationSeconds: 6,
    representedEntryZoneIds: ["courtyard"],
    representedExitZoneIds: ["bridge-road"],
    representedTerrainIds: [],
    representedHazardIds: [],
    lightingAndVisibility: { light: "night" },
    terminalConditions: {
      allEnemiesNeutralized: "all_hostiles_neutralized",
      playerDefeated: "bastion_taken"
    }
  },
  roundDurationSeconds: 6,
  terminalConditions: {
    allEnemiesNeutralized: "all_hostiles_neutralized",
    playerDefeated: "bastion_taken"
  },
  allowedEndConditions: [...seed.allowedEndConditions]
};

const CHECKPOINT_KEY = "fixture:game-board-checkpoint-7c-a";

function Fixture() {
  const [checkpoint, setCheckpoint] = useState<GameBoardTacticalStateV1 | null>(
    () => {
      const stored = window.sessionStorage.getItem(CHECKPOINT_KEY);
      return stored === null
        ? null
        : JSON.parse(stored) as GameBoardTacticalStateV1;
    }
  );
  const [terminalReport, setTerminalReport] =
    useState<GameBoardTerminalReportV1 | null>(null);
  return (
    <>
      <GameBoard
        tacticalSession={session}
        tacticalEncounter={encounter}
        tacticalPreparationError={null}
        tacticalCheckpoint={checkpoint}
        onTacticalCheckpoint={async state => {
          window.sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify(state));
          setCheckpoint(state);
          return {
            checkpointId: `checkpoint:fixture:${state.turnBoundaryId}`
          };
        }}
        onTacticalOutcome={async report => {
          setTerminalReport(report);
        }}
      />
      {terminalReport !== null && (
        <output
          data-terminal-report={terminalReport.endCondition}
          style={{ display: "none" }}
        />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Fixture />);
