import { cloneJson, computeJsonFingerprint, opaqueId } from "../core/index";
import type {
  AggregateId,
  OperationId
} from "../core/index";
import type {
  TacticalEncounterSeedV1,
  TacticalOutcomeV1
} from "./types";
import { HANDOFF_CONTRACT_VERSION } from "./types";
import { assertValidHandoff, validateTacticalEncounterSeedV1, validateTacticalOutcomeV1 } from "./validation";

export type TacticalPlaceholderScenarioV1 =
  | "VICTORY"
  | "FLEE"
  | "CAPTURE"
  | "SURRENDER"
  | "TECHNICAL_FAILURE";

export interface TacticalPlaceholderCheckpointV1 {
  schemaVersion: 1;
  contractVersion: typeof HANDOFF_CONTRACT_VERSION;
  checkpointId: string;
  processId: string;
  scenario: TacticalPlaceholderScenarioV1;
  stepIndex: number;
  elapsedGameSeconds: number;
  stateFingerprint: string;
}

export interface TacticalPlaceholderResultV1 {
  schemaVersion: 1;
  seedFingerprint: string;
  scenario: TacticalPlaceholderScenarioV1;
  checkpoints: TacticalPlaceholderCheckpointV1[];
  outcome: TacticalOutcomeV1;
}

export interface ResolveTacticalPlaceholderInputV1 {
  seed: TacticalEncounterSeedV1;
  sourceOperationId: OperationId;
  scenario: TacticalPlaceholderScenarioV1;
  deterministicSeed: string;
}

function id<T extends string>(value: string): T {
  return opaqueId<T>(value);
}

function primaryActorId(seed: TacticalEncounterSeedV1): string {
  const first = seed.participants[0];
  return typeof first?.actorId === "string" && first.actorId.trim().length > 0 ? first.actorId : "actor-primary";
}

function secondaryActorId(seed: TacticalEncounterSeedV1): string {
  const second = seed.participants[1];
  return typeof second?.actorId === "string" && second.actorId.trim().length > 0 ? second.actorId : "actor-opponent";
}

function outcomeStatus(scenario: TacticalPlaceholderScenarioV1): TacticalOutcomeV1["status"] {
  return scenario === "TECHNICAL_FAILURE" ? "FAILED" : "COMPLETED";
}

function endCondition(scenario: TacticalPlaceholderScenarioV1): string {
  if (scenario === "VICTORY") return "all_hostiles_neutralized";
  if (scenario === "FLEE") return "escape";
  if (scenario === "CAPTURE") return "capture";
  if (scenario === "SURRENDER") return "surrender";
  return "technical_failure";
}

function hpDelta(scenario: TacticalPlaceholderScenarioV1): number {
  if (scenario === "VICTORY") return -2;
  if (scenario === "FLEE") return -1;
  if (scenario === "CAPTURE") return -6;
  if (scenario === "SURRENDER") return 0;
  return 0;
}

async function checkpoint(input: {
  seed: TacticalEncounterSeedV1;
  scenario: TacticalPlaceholderScenarioV1;
  stepIndex: number;
  elapsedGameSeconds: number;
  deterministicSeed: string;
}): Promise<TacticalPlaceholderCheckpointV1> {
  const base = {
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId: input.seed.processId,
    seedFingerprint: input.seed.seedFingerprint,
    scenario: input.scenario,
    stepIndex: input.stepIndex,
    elapsedGameSeconds: input.elapsedGameSeconds,
    deterministicSeed: input.deterministicSeed
  };
  const stateFingerprint = await computeJsonFingerprint(base);
  return {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    checkpointId: `chk_tactical_placeholder_${input.seed.processId}_${input.stepIndex}`,
    processId: input.seed.processId,
    scenario: input.scenario,
    stepIndex: input.stepIndex,
    elapsedGameSeconds: input.elapsedGameSeconds,
    stateFingerprint
  };
}

export async function resolveTacticalPlaceholderV1(
  input: ResolveTacticalPlaceholderInputV1
): Promise<TacticalPlaceholderResultV1> {
  assertValidHandoff(validateTacticalEncounterSeedV1(input.seed), input.seed);
  if (!input.deterministicSeed.trim()) throw new Error("deterministicSeed is required.");
  const actorId = primaryActorId(input.seed);
  const opponentId = secondaryActorId(input.seed);
  const elapsedGameSeconds = input.scenario === "TECHNICAL_FAILURE" ? 0 : 60;
  const checkpoints = [
    await checkpoint({ seed: input.seed, scenario: input.scenario, stepIndex: 0, elapsedGameSeconds: 0, deterministicSeed: input.deterministicSeed }),
    await checkpoint({ seed: input.seed, scenario: input.scenario, stepIndex: 1, elapsedGameSeconds, deterministicSeed: input.deterministicSeed })
  ];
  const delta = hpDelta(input.scenario);
  const terminal = endCondition(input.scenario);
  const outcomeBase = {
    schemaVersion: 1 as const,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processKind: "TACTICAL_ENCOUNTER" as const,
    outcomeId: `outcome_tactical_placeholder_${input.seed.processId}_${input.scenario.toLowerCase()}`,
    processId: input.seed.processId,
    campaignId: input.seed.campaignId,
    sourceOperationId: input.sourceOperationId,
    status: outcomeStatus(input.scenario),
    elapsedGameSeconds,
    domainDeltas: input.scenario === "TECHNICAL_FAILURE" ? [] : [{
      deltaId: `delta_tactical_placeholder_${input.seed.processId}_${actorId}`,
      aggregateType: "character.state",
      aggregateId: id<AggregateId>(`agg_character_${actorId}`),
      expectedAggregateRevision: null,
      payloadSchemaVersion: 1,
      payload: {
        characterId: actorId,
        hpDelta: delta,
        tacticalEndCondition: terminal,
        source: "tactical-placeholder"
      },
      summary: `Placeholder tactical consequence for ${terminal}.`
    }],
    eventDrafts: [{
      eventType: input.scenario === "TECHNICAL_FAILURE" ? "tactical_encounter_failed" : "tactical_encounter_resolved",
      origin: "PROCESS" as const,
      visibility: "PLAYER_VISIBLE" as const,
      occurredAtGameSecond: 0,
      payloadSchemaVersion: 1,
      payload: {
        processId: input.seed.processId,
        scenario: input.scenario,
        endCondition: terminal,
        placeholder: true
      }
    }],
    narrativeProjection: {
      continuationPrompt: `placeholder tactical continuation: ${terminal}`,
      placeholder: true
    },
    uiNotifications: [{
      kind: "tactical_placeholder_finished",
      scenario: input.scenario,
      endCondition: terminal
    }],
    memoryCandidates: [{
      memoryType: "tactical-placeholder",
      actorId,
      opponentId,
      endCondition: terminal
    }],
    sourceRefs: [
      { kind: "tactical.seed", id: input.seed.seedId },
      { kind: "process.handoff", id: input.seed.processId }
    ],
    finalStateFingerprint: await computeJsonFingerprint({
      seedFingerprint: input.seed.seedFingerprint,
      scenario: input.scenario,
      checkpointFingerprint: checkpoints[1].stateFingerprint,
      endCondition: terminal
    }),
    integrationIdempotencyKey: `idem_tactical_placeholder_${input.seed.processId}_${input.scenario.toLowerCase()}`,
    version: 1 as const,
    turnJournal: input.scenario === "TECHNICAL_FAILURE" ? [] : [{
      turn: 1,
      actorId,
      opponentId,
      placeholder: true,
      declaredScenario: input.scenario
    }],
    finalParticipantStates: [{
      actorId,
      hpDelta: delta,
      state: input.scenario === "CAPTURE" ? "captured" : input.scenario === "TECHNICAL_FAILURE" ? "unknown" : "active"
    }, {
      actorId: opponentId,
      hpDelta: null,
      state: input.scenario === "VICTORY" ? "neutralized" : "active"
    }],
    casualtiesAndConditions: input.scenario === "CAPTURE"
      ? [{ actorId, condition: "captured" }]
      : input.scenario === "TECHNICAL_FAILURE"
        ? []
        : [{ actorId, condition: delta < 0 ? "wounded_placeholder" : "none" }],
    resourceChanges: input.scenario === "TECHNICAL_FAILURE" ? [] : [{ actorId, hpDelta: delta }],
    finalPositions: cloneJson(input.seed.initialPositions),
    endCondition: terminal,
    placeDamage: [],
    engagedSpeechAndKnowledge: input.scenario === "SURRENDER"
      ? [{ actorId, knowledge: "surrender_was_declared" }]
      : [],
    availableLoot: input.scenario === "VICTORY" ? [{ objectId: "placeholder_loot", transfer: "not_automatic" }] : [],
    consequenceCandidates: input.scenario === "TECHNICAL_FAILURE"
      ? [{ kind: "technical", value: "placeholder_failed_without_campaign_delta" }]
      : [{ kind: "narrative", value: `tactical_${terminal}` }],
    checkpointRefs: checkpoints.map(value => ({ kind: "process.checkpoint", id: value.checkpointId }))
  };
  const outcome = outcomeBase satisfies TacticalOutcomeV1;
  assertValidHandoff(validateTacticalOutcomeV1(outcome), outcome);
  return {
    schemaVersion: 1,
    seedFingerprint: input.seed.seedFingerprint,
    scenario: input.scenario,
    checkpoints,
    outcome
  };
}
