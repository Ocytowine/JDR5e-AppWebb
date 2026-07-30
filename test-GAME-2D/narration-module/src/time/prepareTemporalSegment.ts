import { cloneJson, computeJsonFingerprint } from "../core/canonical-json/canonicalJson";
import type {
  AggregateRecord,
  AggregateWrite,
  CampaignClockPayload,
  EventAggregateRef,
  EventDraft,
  JsonObject
} from "../core/contracts/types";
import type { WorldSchedulePayloadV1, WorldSimulationCursorPayloadV1 } from "./persistenceTypes";
import {
  validateProcessStatePayloadV1,
  validateWorldSchedulePayloadV1,
  validateWorldSimulationCursorPayloadV1
} from "./persistenceValidation";
import type { PrepareTemporalSegmentInputV1, PrepareTemporalSegmentResultV1 } from "./segmentTypes";
import type { TemporalDiagnosticV1 } from "./types";

function fail(path: string, issue: string, details: JsonObject = {}): PrepareTemporalSegmentResultV1 {
  return { ok: false, diagnostics: [{ code: "TEMPORAL_SEGMENT_INVALID", path, details: { issue, ...details } }] };
}

function revisionAfter(record: AggregateRecord | null): number {
  return record === null ? 0 : record.aggregateRevision + 1;
}

function asPayload(value: unknown): JsonObject {
  return cloneJson(value) as JsonObject;
}

export async function prepareTemporalSegmentCommitV1(
  input: PrepareTemporalSegmentInputV1
): Promise<PrepareTemporalSegmentResultV1> {
  const { campaign, operation, batch } = input;
  if (operation.campaignId !== campaign.campaignId || operation.phase !== "READY_TO_COMMIT" ||
      operation.observedCampaignRevision !== campaign.campaignRevision ||
      input.writerLease.campaignId !== campaign.campaignId) {
    return fail("/operation", "operation, campaign and writer lease are not aligned");
  }
  const compositeBinding = input.operationBinding;
  if (compositeBinding === undefined) {
    if (operation.operationKind !== "time.segment" || operation.requestPayload.batchFingerprint !== batch.batchFingerprint) {
      return fail("/operation/requestPayload", "time.segment operation must cite the batch fingerprint");
    }
  } else if (
    operation.operationKind === "time.segment" ||
    compositeBinding.batchFingerprint !== batch.batchFingerprint ||
    !compositeBinding.domainCommandId.trim()
  ) {
    return fail("/operationBinding", "composite domain commit must cite its domain command and exact batch fingerprint");
  }
  if (input.clockAggregate.campaignId !== campaign.campaignId ||
      input.clockAggregate.aggregateType !== "world.clock" ||
      input.clockAggregate.aggregateId !== campaign.clockAggregateId ||
      input.clockAggregate.payloadSchemaVersion !== 1) {
    return fail("/clockAggregate", "invalid authoritative clock aggregate");
  }
  const clock = input.clockAggregate.payload as CampaignClockPayload;
  if (clock.elapsedGameSeconds !== batch.currentGameSecond ||
      batch.effectiveAtGameSecond < batch.currentGameSecond ||
      batch.effectiveAtGameSecond > batch.requestedTargetGameSecond) {
    return fail("/batch", "batch window does not start from the authoritative clock");
  }
  const simulationTasks = batch.orderedTasks.filter(task => task.taskKind === "WORLD_SIMULATION_BOUNDARY");
  if (simulationTasks.length > 1 || (simulationTasks.length === 1 && !input.simulationResult)) {
    return {
      ok: false,
      diagnostics: [{
        code: "TEMPORAL_SIMULATION_ADAPTER_REQUIRED",
        path: "/batch/orderedTasks",
        details: { issue: "world simulation tasks require exactly one I-03C adapter result" }
      }]
    };
  }
  if (simulationTasks.length === 0 && input.simulationResult) {
    return fail("/simulationResult", "simulation result has no matching batch task");
  }
  const taskIds = batch.orderedTasks.map(task => task.taskId);
  const resolutionIds = input.resolutions.map(value => value.taskId);
  if (new Set(taskIds).size !== taskIds.length || new Set(resolutionIds).size !== resolutionIds.length ||
      [...taskIds].sort().join("|") !== [...resolutionIds].sort().join("|") ||
      new Set(input.resolutions.map(value => value.eventId)).size !== input.resolutions.length) {
    return fail("/resolutions", "every batch task requires exactly one resolution and unique event");
  }

  let schedule: WorldSchedulePayloadV1 = { schemaVersion: 1, effects: [] };
  if (input.scheduleAggregate) {
    if (input.scheduleAggregate.campaignId !== campaign.campaignId ||
        input.scheduleAggregate.aggregateType !== "world.schedule" ||
        input.scheduleAggregate.aggregateId !== input.scheduleAggregateId ||
        input.scheduleAggregate.payloadSchemaVersion !== 1) return fail("/scheduleAggregate", "invalid schedule aggregate identity");
    const validation = validateWorldSchedulePayloadV1(input.scheduleAggregate.payload);
    if (!validation.ok) return { ok: false, diagnostics: validation.diagnostics };
    schedule = validation.value;
  }
  const effects = new Map(schedule.effects.map(effect => [effect.effectId, cloneJson(effect)]));
  const exigibleEffectIds = [...effects.values()]
    .filter(effect => effect.status === "SCHEDULED" && effect.dueAtGameSecond <= batch.effectiveAtGameSecond)
    .map(effect => effect.effectId)
    .sort();
  const scheduledTaskIds = batch.orderedTasks
    .filter(task => task.taskKind === "SCHEDULED_EFFECT")
    .map(task => task.taskId)
    .sort();
  if (exigibleEffectIds.join("|") !== scheduledTaskIds.join("|")) {
    return fail("/batch/orderedTasks", "batch must resolve every scheduled effect due through its effective instant", {
      exigibleEffectIds,
      scheduledTaskIds
    });
  }
  for (const resolution of input.resolutions) {
    const task = batch.orderedTasks.find(value => value.taskId === resolution.taskId)!;
    if (task.taskKind !== "SCHEDULED_EFFECT") continue;
    const effect = effects.get(task.taskId);
    if (!effect || effect.status !== "SCHEDULED" || effect.dueAtGameSecond !== batch.effectiveAtGameSecond) {
      return fail("/resolutions", "scheduled task does not match an exigible effect", { taskId: task.taskId });
    }
    effect.status = resolution.outcome;
  }
  for (const effect of input.newEffects) {
    if (effects.has(effect.effectId) || effect.campaignId !== campaign.campaignId ||
        effect.status !== "SCHEDULED" || effect.dueAtGameSecond < batch.effectiveAtGameSecond) {
      return fail("/newEffects", "new effects must be unique, local, scheduled and non-retroactive", { effectId: effect.effectId });
    }
    effects.set(effect.effectId, cloneJson(effect));
  }
  const nextScheduleResult = validateWorldSchedulePayloadV1({ schemaVersion: 1, effects: [...effects.values()] });
  if (!nextScheduleResult.ok) return { ok: false, diagnostics: nextScheduleResult.diagnostics };

  let cursorWrite: AggregateWrite | null = null;
  let worldStateWrite: AggregateWrite | null = null;
  const worldStateAggregate = input.worldStateAggregate ?? null;
  const worldStateAggregateId = input.worldStateAggregateId ?? null;
  if (input.simulationCursorAggregate) {
    if (input.simulationCursorAggregate.campaignId !== campaign.campaignId ||
        input.simulationCursorAggregate.aggregateType !== "world.simulation-cursor" ||
        input.simulationCursorAggregate.aggregateId !== input.simulationCursorAggregateId ||
        input.simulationCursorAggregate.payloadSchemaVersion !== 1) return fail("/simulationCursorAggregate", "invalid simulation cursor identity");
    const cursor = validateWorldSimulationCursorPayloadV1(input.simulationCursorAggregate.payload);
    if (!cursor.ok) return { ok: false, diagnostics: cursor.diagnostics };
    if (cursor.value.worldSimulatedThrough > clock.elapsedGameSeconds) {
      return fail("/simulationCursorAggregate", "simulation cursor cannot be ahead of CampaignClock");
    }
    if (input.simulationResult) {
      if (!worldStateAggregate || worldStateAggregateId === null ||
          worldStateAggregate.campaignId !== campaign.campaignId ||
          worldStateAggregate.aggregateType !== "world.state" ||
          worldStateAggregate.aggregateId !== worldStateAggregateId || worldStateAggregate.payloadSchemaVersion !== 1) {
        return fail("/worldStateAggregate", "simulation requires the current world.state aggregate");
      }
      const result = input.simulationResult;
      const resultBase = {
        schemaVersion: result.schemaVersion,
        simulationId: result.simulationId,
        previousWorldSimulatedThrough: result.previousWorldSimulatedThrough,
        worldSimulatedThrough: result.worldSimulatedThrough,
        hoursProcessed: result.hoursProcessed,
        previousWorldStateFingerprint: result.previousWorldStateFingerprint,
        worldStateFingerprint: result.worldStateFingerprint,
        cursor: result.cursor,
        worldState: result.worldState,
        tickOutput: result.tickOutput
      };
      const [storedFingerprint, nextFingerprint, resultFingerprint] = await Promise.all([
        computeJsonFingerprint(worldStateAggregate.payload),
        computeJsonFingerprint(result.worldState),
        computeJsonFingerprint(resultBase)
      ]);
      const declaredSimulationThrough =
        Number(simulationTasks[0]?.payload.worldSimulatedThrough);
      const expectedSimulationThrough =
        Number.isInteger(declaredSimulationThrough)
          ? declaredSimulationThrough
          : batch.effectiveAtGameSecond;
      const expectedHours =
        (expectedSimulationThrough - cursor.value.worldSimulatedThrough)
        / cursor.value.secondsPerMicroTick;
      const nextCursor = validateWorldSimulationCursorPayloadV1(result.cursor);
      const simulationResolution = input.resolutions.find(value => value.taskId === simulationTasks[0].taskId);
      if (result.schemaVersion !== 1 || !result.simulationId.trim() || !nextCursor.ok ||
          simulationResolution?.origin !== "WORLD_SIMULATION" || result.tickOutput.tick !== result.cursor.tick ||
          !Number.isInteger(expectedHours) || expectedHours <= 0 ||
          result.previousWorldSimulatedThrough !== cursor.value.worldSimulatedThrough ||
          expectedSimulationThrough > batch.effectiveAtGameSecond
          || result.worldSimulatedThrough !== expectedSimulationThrough
          || result.hoursProcessed !== expectedHours ||
          result.cursor.worldSimulatedThrough !== result.worldSimulatedThrough ||
          result.previousWorldStateFingerprint !== storedFingerprint ||
          result.worldStateFingerprint !== nextFingerprint || result.resultFingerprint !== resultFingerprint) {
        return fail("/simulationResult", "simulation result fingerprints, cursor or elapsed hours are inconsistent");
      }
      cursorWrite = {
        aggregateType: "world.simulation-cursor",
        aggregateId: input.simulationCursorAggregateId,
        expectedAggregateRevision: input.simulationCursorAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: asPayload(nextCursor.value)
      };
      worldStateWrite = {
        aggregateType: "world.state",
        aggregateId: worldStateAggregateId,
        expectedAggregateRevision: worldStateAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(result.worldState)
      };
    }
  } else {
    if (clock.elapsedGameSeconds !== 0) return fail("/simulationCursorAggregate", "cursor can only be initialized at campaign second zero");
    const initialCursor: WorldSimulationCursorPayloadV1 = {
      schemaVersion: 1,
      worldSimulatedThrough: 0,
      tick: 0,
      microTick: 0,
      macroTick: 0,
      secondsPerMicroTick: 3_600,
      microPerMacro: 6
    };
    cursorWrite = {
      aggregateType: "world.simulation-cursor",
      aggregateId: input.simulationCursorAggregateId,
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: asPayload(initialCursor)
    };
    if (input.initialWorldState !== undefined && input.initialWorldState !== null) {
      if (worldStateAggregateId === null || worldStateAggregate !== null) {
        return fail("/initialWorldState", "initial world state requires a new aggregate identity");
      }
      worldStateWrite = {
        aggregateType: "world.state",
        aggregateId: worldStateAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.initialWorldState)
      };
    }
  }

  let processWrite: AggregateWrite | null = null;
  if (input.nextProcess !== null) {
    if (input.processAggregateId === null) return fail("/processAggregateId", "process aggregate id is required");
    const process = await validateProcessStatePayloadV1(input.nextProcess);
    if (!process.ok) return { ok: false, diagnostics: process.diagnostics };
    if (process.value.expectedCampaignRevision !== campaign.campaignRevision + 1) {
      return fail("/nextProcess/expectedCampaignRevision", "checkpoint must cite the resulting campaign revision");
    }
    if (input.processAggregate) {
      if (input.processAggregate.campaignId !== campaign.campaignId || input.processAggregate.aggregateType !== "process.state" ||
          input.processAggregate.aggregateId !== input.processAggregateId || input.processAggregate.payloadSchemaVersion !== 1) {
        return fail("/processAggregate", "invalid process aggregate identity");
      }
      const previous = await validateProcessStatePayloadV1(input.processAggregate.payload);
      if (!previous.ok) return { ok: false, diagnostics: previous.diagnostics };
      if (previous.value.processId !== process.value.processId ||
          process.value.checkpointRevision !== previous.value.checkpointRevision + 1) {
        return fail("/nextProcess", "process checkpoint identity or revision is stale");
      }
    } else if (process.value.checkpointRevision !== 0) {
      return fail("/nextProcess/checkpointRevision", "new process must start at checkpoint revision zero");
    }
    processWrite = {
      aggregateType: "process.state",
      aggregateId: input.processAggregateId,
      expectedAggregateRevision: input.processAggregate?.aggregateRevision ?? null,
      payloadSchemaVersion: 1,
      payload: asPayload(process.value)
    };
  } else if (input.processAggregate !== null) {
    return fail("/nextProcess", "an existing process cannot disappear without a terminal checkpoint");
  }

  const writes: AggregateWrite[] = [{
    aggregateType: "world.clock",
    aggregateId: campaign.clockAggregateId,
    expectedAggregateRevision: input.clockAggregate.aggregateRevision,
    payloadSchemaVersion: 1,
    payload: {
      elapsedGameSeconds: batch.effectiveAtGameSecond,
      calendarId: clock.calendarId,
      calendarVersion: clock.calendarVersion
    }
  }, {
    aggregateType: "world.schedule",
    aggregateId: input.scheduleAggregateId,
    expectedAggregateRevision: input.scheduleAggregate?.aggregateRevision ?? null,
    payloadSchemaVersion: 1,
    payload: asPayload(nextScheduleResult.value)
  }];
  if (cursorWrite) writes.push(cursorWrite);
  if (worldStateWrite) writes.push(worldStateWrite);
  if (processWrite) writes.push(processWrite);
  input.additionalAggregateWrites?.forEach(write => writes.push(cloneJson(write)));
  const aggregateRefs: EventAggregateRef[] = writes.map(write => ({
    aggregateType: write.aggregateType,
    aggregateId: write.aggregateId,
    aggregateRevision: write.expectedAggregateRevision === null ? 0 : write.expectedAggregateRevision + 1
  }));
  const events: EventDraft[] = input.resolutions.map(resolution => ({
    schemaVersion: 1,
    eventId: resolution.eventId,
    campaignId: campaign.campaignId,
    operationId: operation.operationId,
    eventType: resolution.eventType,
    origin: resolution.origin,
    causation: { kind: "COMMAND", id: input.commandId },
    aggregateRefs,
    visibility: cloneJson(resolution.visibility),
    occurredAtGameSecond:
      input.simulationResult
      && simulationTasks[0]?.taskId === resolution.taskId
        ? input.simulationResult.worldSimulatedThrough
        : batch.effectiveAtGameSecond,
    payloadSchemaVersion: 1,
    payload: {
      taskId: resolution.taskId,
      outcome: resolution.outcome,
      batchFingerprint: batch.batchFingerprint,
      result: cloneJson(resolution.payload),
      ...(input.simulationResult && simulationTasks[0]?.taskId === resolution.taskId
        ? {
            simulationId: input.simulationResult.simulationId,
            simulationResultFingerprint: input.simulationResult.resultFingerprint,
            tickOutput: cloneJson(input.simulationResult.tickOutput)
          }
        : {})
    }
  }));
  return {
    ok: true,
    value: {
      campaignId: campaign.campaignId,
      operationId: operation.operationId,
      commitId: input.commitId,
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: operation.requestFingerprint,
      expectedCampaignRevision: campaign.campaignRevision,
      writerLease: cloneJson(input.writerLease),
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "temporal-kernel",
        contractVersion: 1,
        commandId: input.commandId,
        campaignId: campaign.campaignId,
        operationId: operation.operationId,
        commandType: "time.resolve-segment",
        target: {
          aggregateType: "world.clock",
          aggregateId: campaign.clockAggregateId,
          expectedAggregateRevision: input.clockAggregate.aggregateRevision
        },
        payloadSchemaVersion: 1,
        payload: {
          batchFingerprint: batch.batchFingerprint,
          taskIds,
          ...(compositeBinding === undefined
            ? {}
            : { operationBindingMode: compositeBinding.mode, domainCommandId: compositeBinding.domainCommandId })
        },
        acceptedAtGameSecond: batch.currentGameSecond
      }],
      aggregateWrites: writes,
      events,
      outboxTasks: []
    }
  };
}
