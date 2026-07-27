import {
  cloneJson,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CommandId,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type JsonObject
} from "../core";
import type { PreparedSkillCheckOutcomeV1 } from "./skillCheckOutcomePreparation";

export const SKILL_CHECK_OUTCOME_COMMIT_CONTRACT_VERSION_V1 =
  "skill-check-outcome-commit/1" as const;

export interface SkillCheckOwnerResultV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SKILL_CHECK_OUTCOME_COMMIT_CONTRACT_VERSION_V1;
  commandId: string;
  checkId: string;
  rollId: string;
  ownerDomain: string;
  effectType: string;
  target: {
    aggregateType: string;
    aggregateId: string;
    expectedAggregateRevision: number | null;
  };
  nextPayload: JsonObject;
  publicSourceRefs: string[];
  ownerAuthority: true;
}

export function augmentTemporalCommitWithSkillCheckOutcomeV1(input: {
  temporalCommit: CommitRequest;
  prepared: PreparedSkillCheckOutcomeV1;
  ownerResult: SkillCheckOwnerResultV1;
  currentTargetAggregate: AggregateRecord | null;
}): { ok: true; value: CommitRequest } | { ok: false; issues: string[] } {
  const { temporalCommit, prepared, ownerResult, currentTargetAggregate } = input;
  const issues: string[] = [];
  if (ownerResult.contractVersion !== SKILL_CHECK_OUTCOME_COMMIT_CONTRACT_VERSION_V1) issues.push("contractVersion mismatch");
  if (ownerResult.checkId !== prepared.checkId) issues.push("checkId mismatch");
  if (ownerResult.rollId !== prepared.rollId) issues.push("rollId mismatch");
  if (ownerResult.ownerDomain !== prepared.consequence.ownerDomain) issues.push("ownerDomain mismatch");
  if (ownerResult.effectType !== prepared.consequence.effectType) issues.push("effectType mismatch");
  if (ownerResult.ownerAuthority !== true) issues.push("ownerAuthority must be true");
  if (!ownerResult.commandId.trim()) issues.push("commandId is required");
  if (!ownerResult.target.aggregateType.trim() || !ownerResult.target.aggregateId.trim()) issues.push("target identity is required");
  if (ownerResult.publicSourceRefs.some(ref => !ref.trim())) issues.push("publicSourceRefs cannot contain empty refs");
  const allowedRefs = new Set(prepared.narrativeResume.allowedSourceRefs);
  if (ownerResult.publicSourceRefs.some(ref => !allowedRefs.has(ref))) issues.push("owner result exposes an unprepared public source");

  const temporalCommand = temporalCommit.acceptedCommands.find(command => command.commandType === "time.resolve-segment");
  if (
    temporalCommand?.payload.operationBindingMode !== "COMPOSITE_DOMAIN_COMMIT" ||
    temporalCommand.payload.domainCommandId !== ownerResult.commandId
  ) {
    issues.push("temporal commit is not bound to owner command");
  }
  const expectedGameSecond =
    prepared.timeAdvanceProposal.observedAtGameSecond + prepared.narrativeResume.durationSeconds;
  const clockWrite = temporalCommit.aggregateWrites.find(write => write.aggregateType === "world.clock");
  if (clockWrite?.payload.elapsedGameSeconds !== expectedGameSecond) {
    issues.push("temporal commit does not reach prepared effective time");
  }
  const targetKey = `${ownerResult.target.aggregateType}:${ownerResult.target.aggregateId}`;
  if (temporalCommit.aggregateWrites.some(write => `${write.aggregateType}:${write.aggregateId}` === targetKey)) {
    issues.push("target aggregate is already written by temporal commit");
  }
  if (currentTargetAggregate === null) {
    if (ownerResult.target.expectedAggregateRevision !== null) issues.push("new target requires null expected revision");
  } else if (
    currentTargetAggregate.campaignId !== temporalCommit.campaignId ||
    currentTargetAggregate.aggregateType !== ownerResult.target.aggregateType ||
    currentTargetAggregate.aggregateId !== ownerResult.target.aggregateId ||
    currentTargetAggregate.aggregateRevision !== ownerResult.target.expectedAggregateRevision
  ) {
    issues.push("current target aggregate mismatch");
  }
  if (issues.length > 0) return { ok: false, issues };

  const aggregateId = opaqueId<AggregateId>(ownerResult.target.aggregateId);
  const nextRevision = ownerResult.target.expectedAggregateRevision === null
    ? 0
    : ownerResult.target.expectedAggregateRevision + 1;
  const acceptedCommand: AcceptedCommandDraft = {
    schemaVersion: 1,
    contractId: "rules.skill-check-outcome",
    contractVersion: 1,
    commandId: opaqueId<CommandId>(ownerResult.commandId),
    campaignId: temporalCommit.campaignId,
    operationId: temporalCommit.operationId,
    commandType: `${ownerResult.ownerDomain}.apply-skill-check-outcome`,
    target: {
      aggregateType: ownerResult.target.aggregateType,
      aggregateId,
      expectedAggregateRevision: ownerResult.target.expectedAggregateRevision
    },
    payloadSchemaVersion: 1,
    payload: {
      checkId: prepared.checkId,
      rollId: prepared.rollId,
      outcome: prepared.outcome,
      effectType: ownerResult.effectType
    },
    acceptedAtGameSecond: prepared.timeAdvanceProposal.observedAtGameSecond
  };
  const event: EventDraft = {
    schemaVersion: 1,
    eventId: opaqueId<EventId>(`${temporalCommit.operationId}:event:skill-check-outcome`),
    campaignId: temporalCommit.campaignId,
    operationId: temporalCommit.operationId,
    eventType: "rules.skill-check.outcome-committed",
    origin: "PLAYER_INTENT",
    causation: { kind: "COMMAND", id: acceptedCommand.commandId },
    aggregateRefs: [{
      aggregateType: ownerResult.target.aggregateType,
      aggregateId,
      aggregateRevision: nextRevision
    }],
    visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
    occurredAtGameSecond: expectedGameSecond,
    payloadSchemaVersion: 1,
    payload: {
      checkId: prepared.checkId,
      rollId: prepared.rollId,
      outcome: prepared.outcome,
      effectType: ownerResult.effectType,
      publicSummary: prepared.narrativeResume.publicSummary,
      durationSeconds: prepared.narrativeResume.durationSeconds,
      sourceRefs: [...ownerResult.publicSourceRefs]
    }
  };
  return {
    ok: true,
    value: {
      ...cloneJson(temporalCommit),
      acceptedCommands: [...temporalCommit.acceptedCommands.map(cloneJson), acceptedCommand],
      aggregateWrites: [...temporalCommit.aggregateWrites.map(cloneJson), {
        aggregateType: ownerResult.target.aggregateType,
        aggregateId,
        expectedAggregateRevision: ownerResult.target.expectedAggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(ownerResult.nextPayload)
      }],
      events: [...temporalCommit.events.map(cloneJson), event]
    }
  };
}
