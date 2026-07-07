import { computeJsonFingerprint } from "../core/canonical-json/canonicalJson";
import type { JsonObject } from "../core/contracts/types";
import { runWorldHours } from "../../../map-module/world-simulation/engine";
import type { WorldState } from "../../../map-module/world-simulation/types";
import { validateWorldSimulationCursorPayloadV1 } from "./persistenceValidation";
import type { TemporalResultV1 } from "./types";
import type {
  WorldSimulationPortV1,
  WorldSimulationRequestV1,
  WorldSimulationResultV1
} from "./worldSimulationTypes";

function jsonSnapshot(value: unknown): JsonObject {
  const text = JSON.stringify(value);
  if (text === undefined) throw new TypeError("WorldState is not JSON serializable.");
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("WorldState must serialize to an object.");
  }
  return parsed as JsonObject;
}

function invalid(path: string, issue: string): TemporalResultV1<never> {
  return { ok: false, diagnostics: [{ code: "WORLD_SIMULATION_INVALID", path, details: { issue } }] };
}

export class MapModuleWorldSimulationAdapterV1 implements WorldSimulationPortV1 {
  async simulate(request: WorldSimulationRequestV1): Promise<TemporalResultV1<WorldSimulationResultV1>> {
    if (
      request.schemaVersion !== 1 || !request.simulationId.trim() ||
      !Number.isInteger(request.currentGameSecond) || request.currentGameSecond < 0 ||
      !Number.isInteger(request.targetGameSecond) || request.targetGameSecond <= request.currentGameSecond ||
      !Number.isInteger(request.hoursToProcess) || request.hoursToProcess <= 0 ||
      request.targetGameSecond - request.currentGameSecond !== request.hoursToProcess * 3_600
    ) return invalid("/", "simulation requires a positive exact number of whole hours");
    const cursor = validateWorldSimulationCursorPayloadV1(request.cursor);
    if (!cursor.ok) return cursor;
    if (
      cursor.value.worldSimulatedThrough !== request.currentGameSecond ||
      cursor.value.secondsPerMicroTick !== 3_600 ||
      cursor.value.microPerMacro !== 6
    ) return invalid("/cursor", "cursor must match the current CampaignClock boundary");
    let source: JsonObject;
    try {
      source = jsonSnapshot(request.worldState);
      const actualFingerprint = await computeJsonFingerprint(source);
      if (actualFingerprint !== request.worldStateFingerprint) {
        return invalid("/worldStateFingerprint", "world state fingerprint mismatch");
      }
    } catch (error) {
      return invalid("/worldState", error instanceof Error ? error.message : "invalid world state");
    }
    const state = structuredClone(source) as unknown as WorldState;
    if (
      state.clock.tick !== cursor.value.tick || state.clock.microTick !== cursor.value.microTick ||
      state.clock.macroTick !== cursor.value.macroTick || state.clock.minutesPerMicroTick !== 60 ||
      state.clock.microPerMacro !== cursor.value.microPerMacro
    ) return invalid("/worldState/clock", "map-module clock does not match the derived cursor");
    try {
      const output = runWorldHours(state, request.hoursToProcess);
      const expectedTick = cursor.value.tick + request.hoursToProcess;
      const nextCursor = {
        schemaVersion: 1 as const,
        worldSimulatedThrough: request.targetGameSecond,
        tick: state.clock.tick,
        microTick: state.clock.microTick,
        macroTick: state.clock.macroTick,
        secondsPerMicroTick: cursor.value.secondsPerMicroTick,
        microPerMacro: cursor.value.microPerMacro
      };
      const validatedCursor = validateWorldSimulationCursorPayloadV1(nextCursor);
      if (!validatedCursor.ok || state.clock.tick !== expectedTick) {
        return invalid("/result/cursor", "map-module advanced by an unexpected number of ticks");
      }
      const nextWorldState = jsonSnapshot(state);
      const tickOutput = jsonSnapshot(output);
      const base = {
        schemaVersion: 1 as const,
        simulationId: request.simulationId,
        previousWorldSimulatedThrough: cursor.value.worldSimulatedThrough,
        worldSimulatedThrough: request.targetGameSecond,
        hoursProcessed: request.hoursToProcess,
        previousWorldStateFingerprint: request.worldStateFingerprint,
        worldStateFingerprint: await computeJsonFingerprint(nextWorldState) as `sha256:${string}`,
        cursor: validatedCursor.value,
        worldState: nextWorldState,
        tickOutput
      };
      return {
        ok: true,
        value: {
          ...base,
          resultFingerprint: await computeJsonFingerprint(base) as `sha256:${string}`
        }
      };
    } catch (error) {
      return {
        ok: false,
        diagnostics: [{
          code: "WORLD_SIMULATION_FAILED",
          path: "/simulation",
          details: { issue: error instanceof Error ? error.message : "map-module simulation failed" }
        }]
      };
    }
  }
}
