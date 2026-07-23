import {
  computeJsonFingerprint,
  coreError,
  opaqueId,
  type AggregateId,
  type CampaignId,
  type CampaignRepository,
  type CommandId,
  type CommitId,
  type EventId,
  type JsonObject,
  type OperationRecord,
  type Result,
  type WriterId
} from "../core";
import type { SkillCheckProposalV1 } from "./skillCheckProposal";
import { resolveSkillCheckRollV1, type SkillCheckResolutionV1 } from "./skillCheckResolution";

export const DICE_ROLL_RECORD_CONTRACT_VERSION_V1 = "dice-roll-record/1" as const;
export const DICE_ROLL_AGGREGATE_TYPE_V1 = "rules.dice-roll" as const;

export interface D20SourceV1 {
  sourceId: string;
  nextD20(): number;
}

export interface DiceRollRecordV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof DICE_ROLL_RECORD_CONTRACT_VERSION_V1;
  rollId: string;
  checkId: string;
  operationId: string;
  proposalFingerprint: string;
  sourceId: string;
  resolution: SkillCheckResolutionV1;
  generatedAtGameSecond: number;
  version: 1;
}

export interface PersistedDiceRollResultV1 {
  record: DiceRollRecordV1;
  replayed: boolean;
  commitId: string;
}

export class CryptoD20SourceV1 implements D20SourceV1 {
  readonly sourceId = "webcrypto-rejection-sampling-v1";

  nextD20(): number {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi === undefined) throw new Error("Web Crypto unavailable");
    const range = 0x1_0000_0000;
    const limit = Math.floor(range / 20) * 20;
    const buffer = new Uint32Array(1);
    do {
      cryptoApi.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return (buffer[0] % 20) + 1;
  }
}

export async function persistSkillCheckDiceRollV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  proposal: SkillCheckProposalV1;
  d20Source: D20SourceV1;
  occurredAtGameSecond?: number;
}): Promise<Result<PersistedDiceRollResultV1>> {
  if (input.operation.campaignId !== input.campaignId) {
    return { ok: false, error: coreError("VALIDATION_FAILED", "dice-roll.operation-campaign-mismatch", {}) };
  }
  const aggregateId = diceRollAggregateId(input.proposal.checkId);
  const proposalFingerprint = await computeJsonFingerprint(input.proposal);
  const existing = await readDiceRoll(input.repository, input.campaignId, aggregateId);
  if (!existing.ok) return existing;
  if (existing.value !== null) {
    return replay(existing.value, proposalFingerprint);
  }
  if (!["RECEIVED", "PREPARING", "READY_TO_COMMIT", "COMMITTED_PENDING_RENDER"].includes(input.operation.phase)) {
    return {
      ok: false,
      error: coreError("INVALID_TRANSITION", "dice-roll.operation-phase-invalid", { phase: input.operation.phase })
    };
  }

  let operation = input.operation;
  if (operation.phase === "RECEIVED") {
    const preparing = await input.repository.transitionOperation(operation.operationId, "RECEIVED", "PREPARING");
    if (!preparing.ok) return preparing;
    operation = preparing.value;
  }
  if (operation.phase === "PREPARING") {
    const ready = await input.repository.transitionOperation(operation.operationId, "PREPARING", "READY_TO_COMMIT");
    if (!ready.ok) return ready;
    operation = ready.value;
  }
  if (operation.phase === "COMMITTED_PENDING_RENDER") {
    const afterCommit = await readDiceRoll(input.repository, input.campaignId, aggregateId);
    if (!afterCommit.ok) return afterCommit;
    if (afterCommit.value === null) {
      return { ok: false, error: coreError("PERSISTENCE_FAILURE", "dice-roll.commit-without-record", {}) };
    }
    const completed = await input.repository.completePresentation(
      operation.operationId,
      "COMMITTED_RENDERED",
      1,
      { rollId: afterCommit.value.rollId, checkId: afterCommit.value.checkId }
    );
    if (!completed.ok) return completed;
    return replay(afterCommit.value, proposalFingerprint);
  }

  const dieRoll = input.d20Source.nextD20();
  const resolution = resolveSkillCheckRollV1({
    resolutionId: `${operation.operationId}:skill-check-resolution:1`,
    proposal: input.proposal,
    dieRoll
  });
  if (!resolution.ok) {
    return { ok: false, error: coreError("VALIDATION_FAILED", "dice-roll.skill-check-invalid", { code: resolution.code }) };
  }
  const record: DiceRollRecordV1 = {
    schemaVersion: 1,
    contractVersion: DICE_ROLL_RECORD_CONTRACT_VERSION_V1,
    rollId: `${input.proposal.checkId}:roll:1`,
    checkId: input.proposal.checkId,
    operationId: operation.operationId,
    proposalFingerprint,
    sourceId: input.d20Source.sourceId,
    resolution: resolution.value,
    generatedAtGameSecond: input.occurredAtGameSecond ?? 0,
    version: 1
  };
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${operation.operationId}:dice-roll-writer`),
    120_000
  );
  if (!lease.ok) return lease;
  const commandId = opaqueId<CommandId>(`${operation.operationId}:dice-roll-command`);
  const commitId = opaqueId<CommitId>(`${operation.operationId}:dice-roll-commit`);
  const eventId = opaqueId<EventId>(`${operation.operationId}:dice-roll-event`);
  let committed;
  try {
    committed = await input.repository.commit({
      campaignId: input.campaignId,
      operationId: operation.operationId,
      commitId,
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: operation.requestFingerprint,
      expectedCampaignRevision: campaign.value.campaignRevision,
      writerLease: lease.value,
      acceptedCommands: [{
        schemaVersion: 1,
        contractId: "rules.dice-roll-record",
        contractVersion: 1,
        commandId,
        campaignId: input.campaignId,
        operationId: operation.operationId,
        commandType: "rules.skill-check.roll",
        target: { aggregateType: DICE_ROLL_AGGREGATE_TYPE_V1, aggregateId, expectedAggregateRevision: null },
        payloadSchemaVersion: 1,
        payload: { checkId: input.proposal.checkId, proposalFingerprint },
        acceptedAtGameSecond: record.generatedAtGameSecond
      }],
      aggregateWrites: [{
        aggregateType: DICE_ROLL_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: 1,
        payload: record
      }],
      events: [{
        schemaVersion: 1,
        eventId,
        campaignId: input.campaignId,
        operationId: operation.operationId,
        eventType: "rules.skill-check.rolled",
        origin: "SYSTEM",
        causation: { kind: "COMMAND", id: commandId },
        aggregateRefs: [{ aggregateType: DICE_ROLL_AGGREGATE_TYPE_V1, aggregateId, aggregateRevision: 0 }],
        visibility: { scope: "SYSTEM", actorIds: [] },
        occurredAtGameSecond: record.generatedAtGameSecond,
        payloadSchemaVersion: 1,
        payload: {
          rollId: record.rollId,
          checkId: record.checkId,
          proposalFingerprint,
          outcome: record.resolution.outcome
        }
      }],
      outboxTasks: []
    });
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
  if (!committed.ok) {
    const concurrent = await readDiceRoll(input.repository, input.campaignId, aggregateId);
    if (concurrent.ok && concurrent.value !== null) return replay(concurrent.value, proposalFingerprint);
    return committed;
  }
  const completed = await input.repository.completePresentation(
    operation.operationId,
    "COMMITTED_RENDERED",
    1,
    { rollId: record.rollId, checkId: record.checkId, outcome: record.resolution.outcome }
  );
  if (!completed.ok) return completed;
  return { ok: true, value: { record, replayed: false, commitId: committed.value.commitId } };
}

function diceRollAggregateId(checkId: string): AggregateId {
  return opaqueId<AggregateId>(`dice-roll:${checkId}`);
}

async function readDiceRoll(
  repository: CampaignRepository,
  campaignId: CampaignId,
  aggregateId: AggregateId
): Promise<Result<DiceRollRecordV1 | null>> {
  const aggregate = await repository.getAggregate(campaignId, DICE_ROLL_AGGREGATE_TYPE_V1, aggregateId);
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND" ? { ok: true, value: null } : aggregate;
  }
  const payload = aggregate.value.payload as Partial<DiceRollRecordV1>;
  if (
    payload.schemaVersion !== 1 ||
    payload.contractVersion !== DICE_ROLL_RECORD_CONTRACT_VERSION_V1 ||
    typeof payload.rollId !== "string" ||
    typeof payload.checkId !== "string" ||
    typeof payload.proposalFingerprint !== "string" ||
    payload.resolution === undefined
  ) {
    return { ok: false, error: coreError("VALIDATION_FAILED", "dice-roll.record-invalid", {}) };
  }
  return { ok: true, value: payload as DiceRollRecordV1 };
}

function replay(
  record: DiceRollRecordV1,
  proposalFingerprint: string
): Result<PersistedDiceRollResultV1> {
  if (record.proposalFingerprint !== proposalFingerprint) {
    return {
      ok: false,
      error: coreError("IDEMPOTENCY_CONFLICT", "dice-roll.proposal-conflict", {
        checkId: record.checkId
      })
    };
  }
  return {
    ok: true,
    value: {
      record,
      replayed: true,
      commitId: `${record.operationId}:dice-roll-commit`
    }
  };
}
