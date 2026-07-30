import { useEffect, useMemo, useRef, useState } from "react";
import { GameBoard } from "./GameBoard";
import {
  NarrativeAppSurface,
  type NarrativeAppSurfaceBootstrapV1,
  type NarrativeEnhancementMode,
  type NarrativeTacticalCheckpointBridgeV1,
  type NarrativeWorldSimulationBridgeV1
} from "./narration-ui/NarrativeAppSurface";
import {
  WorldMapScreen
} from "../map-module/ui/WorldMapScreen";
import type {
  CampaignWorldSimulationUiPortV1
} from "../map-module/ui/WorldMapSimulationScreen";
import type {
  TickOutput,
  WorldState
} from "../map-module/world-simulation";
import { CampaignGateway } from "./narration-ui/CampaignGateway";
import type { ActiveCharacterSheetV1 } from "./narration-ui/activeCharacterSheetAdapter";
import type { BastionTacticalSessionV1 } from "../narration-module/src/application";
import {
  createEmbeddedGameBoardActorResolverV1,
  createEmbeddedGameBoardMapResolverV1,
  prepareGameBoardEncounterV1,
  type GameBoardEncounterInputV1
} from "./tactical-integration/gameBoardEncounterAdapter";
import {
  readGameBoardTacticalStateV1,
  type GameBoardTacticalStateV1
} from "./tactical-integration/gameBoardTacticalState";
import {
  buildPendingGameBoardTacticalOutcomeV1,
  type GameBoardTerminalReportV1
} from "./tactical-integration/gameBoardTacticalOutcome";

type AppSurface = "narration" | "world" | "tactical";
type NarrativeEntry =
  | { kind: "PILOT" }
  | { kind: "PLAYER"; sheet: ActiveCharacterSheetV1 }
  | { kind: "INJECTED" };

export function App(props: {
  narrativeBootstrapController?:
    (
      mode?: NarrativeEnhancementMode
    ) => Promise<NarrativeAppSurfaceBootstrapV1>;
} = {}) {
  const [narrativeEntry, setNarrativeEntry] = useState<NarrativeEntry | null>(
    props.narrativeBootstrapController === undefined
      ? null
      : { kind: "INJECTED" }
  );
  const [surface, setSurface] = useState<AppSurface>("narration");
  const [tacticalSession, setTacticalSession] =
    useState<BastionTacticalSessionV1 | null>(null);
  const [tacticalEncounter, setTacticalEncounter] =
    useState<GameBoardEncounterInputV1 | null>(null);
  const [tacticalPreparationError, setTacticalPreparationError] =
    useState<string | null>(null);
  const [tacticalCheckpoint, setTacticalCheckpoint] =
    useState<GameBoardTacticalStateV1 | null>(null);
  const [tacticalCheckpointBridge, setTacticalCheckpointBridge] =
    useState<NarrativeTacticalCheckpointBridgeV1 | null>(null);
  const [worldSimulationBridge, setWorldSimulationBridge] =
    useState<NarrativeWorldSimulationBridgeV1 | null>(null);
  const tacticalCheckpointQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const worldSimulationPort = useMemo<
    CampaignWorldSimulationUiPortV1 | undefined
  >(() => {
    if (worldSimulationBridge === null) return undefined;
    return {
      async restore() {
        const restored = await worldSimulationBridge.restore();
        if (!restored.ok) throw new Error(restored.error.messageKey);
        return {
          worldState: restored.value.worldState as unknown as WorldState,
          elapsedGameSeconds: restored.value.elapsedGameSeconds,
          worldSimulatedThrough: restored.value.worldSimulatedThrough
        };
      },
      async advance(input) {
        const advanced = await worldSimulationBridge.advance(input);
        if (!advanced.ok) throw new Error(advanced.error.messageKey);
        if (advanced.value.snapshot.lastTickOutput === null) {
          throw new Error("campaign.world-simulation.tick-output-missing");
        }
        return {
          worldState:
            advanced.value.snapshot.worldState as unknown as WorldState,
          tickOutput:
            advanced.value.snapshot.lastTickOutput as unknown as TickOutput,
          elapsedGameSeconds:
            advanced.value.snapshot.elapsedGameSeconds,
          worldSimulatedThrough:
            advanced.value.snapshot.worldSimulatedThrough
        };
      }
    };
  }, [worldSimulationBridge]);
  const activeNarrativeBootstrap = useMemo(() => {
    if (narrativeEntry?.kind === "INJECTED") {
      return props.narrativeBootstrapController;
    }
    if (narrativeEntry?.kind === "PLAYER") {
      return (mode: NarrativeEnhancementMode = "local") =>
        import("./narration-ui/playableCampaignBootstrap").then(module =>
          module.createPlayableCampaignControllerV1(
            narrativeEntry.sheet,
            mode
          ));
    }
    return undefined;
  }, [narrativeEntry, props.narrativeBootstrapController]);

  useEffect(() => {
    let cancelled = false;
    if (tacticalSession === null) {
      setTacticalEncounter(null);
      setTacticalCheckpoint(null);
      setTacticalPreparationError(null);
      return () => {
        cancelled = true;
      };
    }
    void prepareGameBoardEncounterV1({
      session: tacticalSession,
      actorResolver: createEmbeddedGameBoardActorResolverV1(),
      mapResolver: createEmbeddedGameBoardMapResolverV1()
    }).then(result => {
      if (cancelled) return;
      if (result.ok) {
        const restoredCheckpoint = tacticalSession.checkpoint === null
          ? { ok: true as const, value: null }
          : readGameBoardTacticalStateV1({
              value: tacticalSession.checkpoint.ownerState,
              processId: result.value.processId,
              seedId: result.value.seedId,
              seedFingerprint: result.value.seedFingerprint
            });
        if (!restoredCheckpoint.ok) {
          setTacticalEncounter(null);
          setTacticalCheckpoint(null);
          setTacticalPreparationError(restoredCheckpoint.error.messageKey);
          return;
        }
        setTacticalEncounter(result.value);
        setTacticalCheckpoint(restoredCheckpoint.value);
        setTacticalPreparationError(null);
      } else {
        setTacticalEncounter(null);
        setTacticalCheckpoint(null);
        setTacticalPreparationError(result.error.messageKey);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tacticalSession]);

  if (narrativeEntry === null) {
    return (
      <CampaignGateway
        onOpenPlayerCampaign={sheet =>
          setNarrativeEntry({ kind: "PLAYER", sheet })}
        onOpenArchivesPilot={() => setNarrativeEntry({ kind: "PILOT" })}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070911", color: "#fff" }}>
      <nav
        aria-label="Surfaces principales"
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          gap: 8,
          padding: 6,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(6,8,14,0.86)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)"
        }}
      >
        <SurfaceButton active={surface === "narration"} onClick={() => setSurface("narration")}>
          Narration
        </SurfaceButton>
        {narrativeEntry.kind === "PLAYER" && worldSimulationPort !== undefined && (
          <SurfaceButton active={surface === "world"} onClick={() => setSurface("world")}>
            Monde
          </SurfaceButton>
        )}
        <SurfaceButton active={surface === "tactical"} onClick={() => setSurface("tactical")}>
          {tacticalSession === null ? "Tactique" : "Tactique · défense en attente"}
        </SurfaceButton>
        {narrativeEntry.kind !== "INJECTED" && (
          <SurfaceButton
            active={false}
            onClick={() => {
              setTacticalSession(null);
              setWorldSimulationBridge(null);
              setSurface("narration");
              setNarrativeEntry(null);
            }}
          >
            Campagnes
          </SurfaceButton>
        )}
      </nav>

      {surface === "narration" ? (
        <NarrativeAppSurface
          bootstrapController={activeNarrativeBootstrap}
          onTacticalHandoffChange={setTacticalSession}
          onTacticalCheckpointBridgeChange={setTacticalCheckpointBridge}
          onWorldSimulationBridgeChange={setWorldSimulationBridge}
          onOpenTacticalHandoff={session => {
            setTacticalSession(session);
            setSurface("tactical");
          }}
        />
      ) : surface === "world" ? (
        <div style={{ padding: "76px 16px 16px" }}>
          <WorldMapScreen
            onBack={() => setSurface("narration")}
            backLabel="Retour narration"
            campaignSimulationPort={worldSimulationPort}
          />
        </div>
      ) : (
        <GameBoard
          tacticalSession={tacticalSession}
          tacticalEncounter={tacticalEncounter}
          tacticalPreparationError={tacticalPreparationError}
          tacticalCheckpoint={tacticalCheckpoint}
          onTacticalCheckpoint={state => {
            const queued = tacticalCheckpointQueueRef.current.then(async () => {
              if (tacticalCheckpointBridge === null) {
                throw new Error("tactical.checkpoint-bridge-unavailable");
              }
              const saved = await tacticalCheckpointBridge.saveCheckpoint({
                processId: state.processId,
                clientRequestId: `game-board:${state.processId}:${state.turnBoundaryId}`,
                lastAppliedTurnId: state.turnBoundaryId,
                ownerState: state
              });
              if (!saved.ok) {
                console.error(
                  "[tactical-checkpoint]",
                  JSON.stringify(saved.error)
                );
                throw new Error(saved.error.messageKey);
              }
              setTacticalCheckpoint(state);
              return { checkpointId: saved.value.checkpointId };
            });
            tacticalCheckpointQueueRef.current = queued.catch(() => undefined);
            return queued;
          }}
          onTacticalOutcome={async (report: GameBoardTerminalReportV1) => {
            if (
              tacticalCheckpointBridge === null
              || tacticalSession === null
              || tacticalEncounter === null
            ) throw new Error("tactical.outcome-bridge-unavailable");
            const outcome = await buildPendingGameBoardTacticalOutcomeV1({
              session: tacticalSession,
              encounter: tacticalEncounter,
              report
            });
            if (!outcome.ok) throw new Error(outcome.error.messageKey);
            const recorded =
              await tacticalCheckpointBridge.recordPendingOutcome({
                clientRequestId: `game-board-outcome:${report.processId}`,
                outcome: outcome.value
              });
            if (!recorded.ok) {
              console.error(
                "[tactical-outcome]",
                JSON.stringify(recorded.error)
              );
              throw new Error(recorded.error.messageKey);
            }
            const integrated =
              await tacticalCheckpointBridge.integratePendingOutcome({
                processId: report.processId,
                clientRequestId: `game-board-integrate:${report.processId}`
              });
            if (!integrated.ok) {
              console.error(
                "[tactical-integration]",
                JSON.stringify(integrated.error)
              );
              throw new Error(integrated.error.messageKey);
            }
            setTacticalSession(null);
            setSurface("narration");
          }}
        />
      )}
    </div>
  );
}

function SurfaceButton(props: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 999,
        padding: "7px 12px",
        background: props.active ? "rgba(88,166,255,0.28)" : "rgba(255,255,255,0.06)",
        color: props.active ? "#fff" : "rgba(255,255,255,0.72)",
        cursor: "pointer",
        fontWeight: 800,
        letterSpacing: 0.2
      }}
    >
      {props.children}
    </button>
  );
}
