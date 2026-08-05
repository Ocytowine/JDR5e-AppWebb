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

export interface SkillCheckOwnerTargetV1 extends JsonObject {
  aggregateType: string;
  aggregateId: string;
  expectedAggregateRevision: number | null;
  nextPayload: JsonObject;
}

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
  additionalTargets: SkillCheckOwnerTargetV1[];
  publicSourceRefs: string[];
  ownerAuthority: true;
}

export function augmentTemporalCommitWithSkillCheckOutcomeV1(input: {
  temporalCommit: CommitRequest;
  prepared: PreparedSkillCheckOutcomeV1;
  ownerResult: SkillCheckOwnerResultV1;
  currentTargetAggregate: AggregateRecord | null;
  currentAdditionalTargetAggregates?: AggregateRecord[];
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
  const targets = [{ ...ownerResult.target, nextPayload: ownerResult.nextPayload }, ...ownerResult.additionalTargets];
  const targetKeys = targets.map(target => `${target.aggregateType}:${target.aggregateId}`);
  if (new Set(targetKeys).size !== targetKeys.length) issues.push("owner targets must be unique");
  if (targets.some(target => !target.aggregateType.trim() || !target.aggregateId.trim())) issues.push("additional target identity is required");
  if (temporalCommit.aggregateWrites.some(write => targetKeys.includes(`${write.aggregateType}:${write.aggregateId}`))) issues.push("owner target is already written by temporal commit");
  const primary = targets[0];
  if (currentTargetAggregate === null) {
    if (primary.expectedAggregateRevision !== null) issues.push("new target requires null expected revision");
  } else if (
    currentTargetAggregate.campaignId !== temporalCommit.campaignId ||
    currentTargetAggregate.aggregateType !== primary.aggregateType ||
    currentTargetAggregate.aggregateId !== primary.aggregateId ||
    currentTargetAggregate.aggregateRevision !== primary.expectedAggregateRevision
  ) issues.push("current target aggregate mismatch");
  const currentAdditional = new Map((input.currentAdditionalTargetAggregates ?? []).map(aggregate => [
    `${aggregate.aggregateType}:${aggregate.aggregateId}`,
    aggregate
  ]));
  for (const target of targets.slice(1)) {
    const current = currentAdditional.get(`${target.aggregateType}:${target.aggregateId}`) ?? null;
    if (current === null ? target.expectedAggregateRevision !== null : (
      current.campaignId !== temporalCommit.campaignId ||
      current.aggregateRevision !== target.expectedAggregateRevision
    )) issues.push("current additional target aggregate mismatch");
  }
  if (issues.length > 0) return { ok: false, issues };

  const aggregateId = opaqueId<AggregateId>(ownerResult.target.aggregateId);
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
    aggregateRefs: targets.map(target => ({
      aggregateType: target.aggregateType,
      aggregateId: opaqueId<AggregateId>(target.aggregateId),
      aggregateRevision: target.expectedAggregateRevision === null ? 0 : target.expectedAggregateRevision + 1
    })),
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
      aggregateWrites: [...temporalCommit.aggregateWrites.map(cloneJson), ...targets.map(target => ({
        aggregateType: target.aggregateType,
        aggregateId: opaqueId<AggregateId>(target.aggregateId),
        expectedAggregateRevision: target.expectedAggregateRevision,
        payloadSchemaVersion: 1 as const,
        payload: cloneJson(target.nextPayload)
      }))],
      events: [...temporalCommit.events.map(cloneJson), event]
    }
  };
}
