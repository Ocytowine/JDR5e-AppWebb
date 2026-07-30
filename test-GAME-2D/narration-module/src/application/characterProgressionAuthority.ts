import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type CommitId,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type EventRecord,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import type {
  CharacterAggregatePayloadV1,
  NarrativeCharacterProjectionV1,
  TacticalCharacterProjectionV1
} from "../bootstrap";

export const CHARACTER_PROGRESSION_REGISTRY_CONTRACT_V1 =
  "character-progression-registry/1" as const;
export const CHARACTER_PROGRESSION_AWARD_CONTRACT_V1 =
  "character-progression-award/1" as const;
export const CHARACTER_PROGRESSION_APPLICATION_CONTRACT_V1 =
  "character-progression-application/1" as const;
export const CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1 =
  "character.progression-registry" as const;

export type CharacterProgressionAwardKindV1 = "CLASS_LEVEL";
export type CharacterProgressionAwardStatusV1 =
  | "AVAILABLE"
  | "CHOICE_REQUIRED"
  | "APPLIED"
  | "CANCELLED";
export type CharacterProgressionChoiceKindV1 =
  | "CLASS"
  | "SUBCLASS"
  | "ABILITY_SCORE_OR_FEAT"
  | "FEATURE_OPTION";

export interface CharacterProgressionAwardV1 extends JsonObject {
  schemaVersion: 1;
  awardId: string;
  characterId: string;
  awardKind: CharacterProgressionAwardKindV1;
  status: CharacterProgressionAwardStatusV1;
  sourceOperationId: string;
  sourceEventId: string;
  policyRef: string;
  availableAtGameSecond: number;
  appliedAtGameSecond: number | null;
  requiredChoices: CharacterProgressionChoiceKindV1[];
  version: number;
}

export interface CharacterProgressionRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CHARACTER_PROGRESSION_REGISTRY_CONTRACT_V1;
  campaignId: string;
  awards: CharacterProgressionAwardV1[];
  version: number;
}

export interface EvaluateCharacterProgressionAwardCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CHARACTER_PROGRESSION_AWARD_CONTRACT_V1;
  clientRequestId: string;
  sourceOperationId: string;
  sourceEventId: string;
  characterAggregateId: string;
}

export interface CharacterProgressionEligibilityDecisionV1 extends JsonObject {
  schemaVersion: 1;
  eligible: boolean;
  reasonCode: string;
  awardKind: CharacterProgressionAwardKindV1 | null;
  requiredChoices: CharacterProgressionChoiceKindV1[];
}

export interface CharacterProgressionEligibilityPolicyV1 {
  readonly policyRef: string;
  evaluate(input: {
    campaign: CampaignRecord;
    sourceEvent: EventRecord;
    character: CharacterAggregatePayloadV1;
  }): CharacterProgressionEligibilityDecisionV1
    | Promise<CharacterProgressionEligibilityDecisionV1>;
}

export interface CharacterProgressionPublicNoticeV1 extends JsonObject {
  schemaVersion: 1;
  awardId: string;
  awardKind: CharacterProgressionAwardKindV1;
  status: Extract<CharacterProgressionAwardStatusV1, "AVAILABLE" | "CHOICE_REQUIRED">;
  requiredChoices: CharacterProgressionChoiceKindV1[];
  availableAtGameSecond: number;
}

export interface CharacterProgressionAwardEvaluationResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "INELIGIBLE" | "GRANTED" | "ALREADY_GRANTED";
  reasonCode: string;
  award: CharacterProgressionAwardV1 | null;
  publicNotice: CharacterProgressionPublicNoticeV1 | null;
  commitId: string | null;
  replayed: boolean;
}

export interface CharacterProgressionChoiceResolutionV1 extends JsonObject {
  kind: CharacterProgressionChoiceKindV1;
  selectionRefs: string[];
}

export interface CharacterProgressionApplicationCandidateV1 extends JsonObject {
  characterState: JsonObject;
  tacticalProjection: JsonObject;
  narrativeProjection: JsonObject;
}

export interface ApplyCharacterProgressionCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CHARACTER_PROGRESSION_APPLICATION_CONTRACT_V1;
  clientRequestId: string;
  awardId: string;
  characterAggregateId: string;
  tacticalProjectionAggregateId: string;
  narrativeProjectionAggregateId: string;
  expectedCharacterRevision: number;
  expectedTacticalProjectionRevision: number;
  expectedNarrativeProjectionRevision: number;
  restWindow: CharacterProgressionRestWindowV1;
  choices: CharacterProgressionChoiceResolutionV1[];
  candidate: CharacterProgressionApplicationCandidateV1;
}

export interface CharacterProgressionRestWindowV1 extends JsonObject {
  schemaVersion: 1;
  restSegmentOperationId: string;
  restSegmentEventId: string;
  restProcessId: string;
}

export interface CharacterProgressionPublicSummaryV1 extends JsonObject {
  schemaVersion: 1;
  characterId: string;
  characterDisplayName: string;
  previousGlobalLevel: number;
  newGlobalLevel: number;
  progressionLabel: string;
  grantedLabels: string[];
}

export interface CharacterProgressionCandidateValidationDecisionV1 extends JsonObject {
  schemaVersion: 1;
  valid: boolean;
  reasonCodes: string[];
  ruleDecisionRefs: string[];
  publicSummary: CharacterProgressionPublicSummaryV1 | null;
}

export interface CharacterProgressionCandidateValidatorV1 {
  readonly validatorRef: string;
  validate(input: {
    campaign: CampaignRecord;
    award: CharacterProgressionAwardV1;
    currentCharacter: CharacterAggregatePayloadV1;
    currentTacticalProjection: TacticalCharacterProjectionV1;
    currentNarrativeProjection: NarrativeCharacterProjectionV1;
    choices: CharacterProgressionChoiceResolutionV1[];
    candidate: {
      characterState: CharacterAggregatePayloadV1;
      tacticalProjection: TacticalCharacterProjectionV1;
      narrativeProjection: NarrativeCharacterProjectionV1;
    };
  }): CharacterProgressionCandidateValidationDecisionV1
    | Promise<CharacterProgressionCandidateValidationDecisionV1>;
}

export interface CharacterProgressionApplicationResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "REJECTED" | "APPLIED";
  reasonCodes: string[];
  award: CharacterProgressionAwardV1;
  publicSummary: CharacterProgressionPublicSummaryV1 | null;
  commitId: string | null;
  replayed: boolean;
}

export function characterProgressionRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`character-progression-registry:${campaignId}`);
}

export function createEmptyCharacterProgressionRegistryV1(
  campaignId: string
): CharacterProgressionRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: CHARACTER_PROGRESSION_REGISTRY_CONTRACT_V1,
    campaignId,
    awards: [],
    version: 1
  };
}

export async function loadCharacterProgressionRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{
  aggregate: AggregateRecord | null;
  state: CharacterProgressionRegistryV1;
}>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
    characterProgressionRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok && aggregate.error.code === "NOT_FOUND") {
    return {
      ok: true,
      value: {
        aggregate: null,
        state: createEmptyCharacterProgressionRegistryV1(campaignId)
      }
    };
  }
  if (!aggregate.ok) return aggregate;
  const state = aggregate.value.payload as CharacterProgressionRegistryV1;
  if (
    state.schemaVersion !== 1
    || state.contractVersion !== CHARACTER_PROGRESSION_REGISTRY_CONTRACT_V1
    || state.campaignId !== campaignId
    || !Array.isArray(state.awards)
  ) {
    return invalid("progression.registry-invalid", ["registry payload is invalid"]);
  }
  return { ok: true, value: { aggregate: aggregate.value, state } };
}

export async function evaluateAndGrantCharacterProgressionAwardV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: EvaluateCharacterProgressionAwardCommandV1;
  policy: CharacterProgressionEligibilityPolicyV1 | null;
}): Promise<Result<CharacterProgressionAwardEvaluationResultV1>> {
  const issues = validateCommand(input.command);
  if (issues.length > 0) return invalid("progression.award-command-invalid", issues);
  if (input.policy === null || !nonEmpty(input.policy.policyRef)) {
    return invalid("progression.policy-required", ["an explicit progression policy is required"]);
  }
  const operationId = opaqueId<OperationId>(
    `character-progression-award:${input.command.clientRequestId}`
  );
  const requestFingerprint = await computeRequestFingerprint(
    "character.progression.evaluate-award",
    1,
    input.command
  );
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== requestFingerprint) {
    return {
      ok: false,
      error: coreError(
        "IDEMPOTENCY_CONFLICT",
        "progression.award-request-conflict"
      )
    };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") {
    return restoreResult(existing.value);
  }
  if (existing.ok) {
    return invalid("progression.award-operation-incomplete", [
      "operation already exists and is not completed"
    ]);
  }
  if (existing.error.code !== "NOT_FOUND") return existing;

  const [campaign, character, sourceOperation, registry] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    input.repository.getAggregate(
      input.campaignId,
      "character.state",
      opaqueId<AggregateId>(input.command.characterAggregateId)
    ),
    input.repository.getOperation(opaqueId<OperationId>(input.command.sourceOperationId)),
    loadCharacterProgressionRegistryV1(input.repository, input.campaignId)
  ]);
  if (!campaign.ok) return campaign;
  if (!character.ok) return character;
  if (!sourceOperation.ok) return sourceOperation;
  if (!registry.ok) return registry;
  if (
    sourceOperation.value.campaignId !== input.campaignId
    || sourceOperation.value.commitId === null
  ) {
    return invalid("progression.source-operation-not-committed", [
      "source operation must belong to the campaign and be committed"
    ]);
  }
  const sourceEvent = await findCommittedSourceEvent({
    repository: input.repository,
    campaignId: input.campaignId,
    sourceOperationId: sourceOperation.value.operationId,
    sourceEventId: input.command.sourceEventId,
    sourceCommitId: sourceOperation.value.commitId
  });
  if (!sourceEvent.ok) return sourceEvent;
  if (sourceEvent.value === null) {
    return invalid("progression.source-event-not-committed", [
      "source event must belong to the committed source operation"
    ]);
  }
  const characterState = character.value.payload as unknown as CharacterAggregatePayloadV1;
  if (
    characterState.schemaVersion !== 1
    || !nonEmpty(characterState.characterId)
    || !Number.isInteger(characterState.globalLevel)
  ) {
    return invalid("progression.character-state-invalid", [
      "character.state payload is invalid"
    ]);
  }

  const alreadyGranted = registry.value.state.awards.find(award =>
    award.sourceEventId === sourceEvent.value!.eventId
    && award.characterId === characterState.characterId
    && award.status !== "CANCELLED"
  );
  if (alreadyGranted !== undefined) {
    const started = await beginOperation({
      repository: input.repository,
      campaignId: input.campaignId,
      operationId,
      clientRequestId: input.command.clientRequestId,
      requestFingerprint,
      operationKind: "character.progression.evaluate-award",
      payload: cloneJson(input.command)
    });
    if (!started.ok) return started;
    const result = resultForAward("ALREADY_GRANTED", "SOURCE_ALREADY_GRANTED", alreadyGranted, null);
    const completed = await input.repository.completeWithoutCommit(operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }

  const decision = await input.policy.evaluate({
    campaign: campaign.value,
    sourceEvent: sourceEvent.value,
    character: cloneJson(characterState)
  });
  const decisionIssues = validateDecision(decision);
  if (decisionIssues.length > 0) {
    return invalid("progression.policy-decision-invalid", decisionIssues);
  }
  const started = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    requestFingerprint,
    operationKind: "character.progression.evaluate-award",
    payload: cloneJson(input.command)
  });
  if (!started.ok) return started;
  if (!decision.eligible || decision.awardKind === null) {
    const result: CharacterProgressionAwardEvaluationResultV1 = {
      schemaVersion: 1,
      status: "INELIGIBLE",
      reasonCode: decision.reasonCode,
      award: null,
      publicNotice: null,
      commitId: null,
      replayed: false
    };
    const completed = await input.repository.completeWithoutCommit(operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }
  const award: CharacterProgressionAwardV1 = {
    schemaVersion: 1,
    awardId: `progression-award:${sourceEvent.value.eventId}:${characterState.characterId}`,
    characterId: characterState.characterId,
    awardKind: decision.awardKind,
    status: decision.requiredChoices.length > 0 ? "CHOICE_REQUIRED" : "AVAILABLE",
    sourceOperationId: sourceOperation.value.operationId,
    sourceEventId: sourceEvent.value.eventId,
    policyRef: input.policy.policyRef,
    availableAtGameSecond: sourceEvent.value.occurredAtGameSecond,
    appliedAtGameSecond: null,
    requiredChoices: [...new Set(decision.requiredChoices)].sort(),
    version: 1
  };
  const nextRegistry: CharacterProgressionRegistryV1 = {
    ...registry.value.state,
    awards: [...registry.value.state.awards, award]
      .sort((left, right) => left.awardId.localeCompare(right.awardId)),
    version: registry.value.state.version + 1
  };
  const committed = await commitAward({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: registry.value.aggregate,
    nextRegistry,
    award
  });
  if (!committed.ok) return committed;
  const result = resultForAward("GRANTED", decision.reasonCode, award, committed.value.commitId);
  const completed = await input.repository.completePresentation(
    operationId,
    "COMMITTED_RENDERED",
    1,
    result
  );
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function applyCharacterProgressionV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: ApplyCharacterProgressionCommandV1;
  validator: CharacterProgressionCandidateValidatorV1 | null;
}): Promise<Result<CharacterProgressionApplicationResultV1>> {
  const issues = validateApplicationCommand(input.command);
  if (issues.length > 0) return invalid("progression.application-command-invalid", issues);
  if (input.validator === null || !nonEmpty(input.validator.validatorRef)) {
    return invalid("progression.validator-required", [
      "an explicit character/ruleset validator is required"
    ]);
  }
  const operationId = opaqueId<OperationId>(
    `character-progression-application:${input.command.clientRequestId}`
  );
  const requestFingerprint = await computeRequestFingerprint(
    "character.progression.apply",
    1,
    input.command
  );
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== requestFingerprint) {
    return {
      ok: false,
      error: coreError(
        "IDEMPOTENCY_CONFLICT",
        "progression.application-request-conflict"
      )
    };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") {
    return restoreApplicationResult(existing.value);
  }
  if (existing.ok) {
    return invalid("progression.application-operation-incomplete", [
      "operation already exists and is not completed"
    ]);
  }
  if (existing.error.code !== "NOT_FOUND") return existing;

  const [campaign, registry, character, tactical, narrative] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    loadCharacterProgressionRegistryV1(input.repository, input.campaignId),
    input.repository.getAggregate(
      input.campaignId,
      "character.state",
      opaqueId<AggregateId>(input.command.characterAggregateId)
    ),
    input.repository.getAggregate(
      input.campaignId,
      "character.tactical-projection",
      opaqueId<AggregateId>(input.command.tacticalProjectionAggregateId)
    ),
    input.repository.getAggregate(
      input.campaignId,
      "character.narrative-projection",
      opaqueId<AggregateId>(input.command.narrativeProjectionAggregateId)
    )
  ]);
  if (!campaign.ok) return campaign;
  if (!registry.ok) return registry;
  if (!character.ok) return character;
  if (!tactical.ok) return tactical;
  if (!narrative.ok) return narrative;
  const clock = await input.repository.getAggregate(
    input.campaignId,
    "world.clock",
    campaign.value.clockAggregateId
  );
  if (!clock.ok) return clock;
  const appliedAtGameSecond = Number(clock.value.payload.elapsedGameSeconds);
  if (!Number.isInteger(appliedAtGameSecond) || appliedAtGameSecond < 0) {
    return invalid("progression.campaign-clock-invalid", [
      "campaign clock elapsedGameSeconds is invalid"
    ]);
  }

  const award = registry.value.state.awards.find(value =>
    value.awardId === input.command.awardId
  );
  if (award === undefined) {
    return invalid("progression.award-not-found", ["progression award does not exist"]);
  }
  if (!["AVAILABLE", "CHOICE_REQUIRED"].includes(award.status)) {
    return invalid("progression.award-not-applicable", [
      `progression award status is ${award.status}`
    ]);
  }
  const restWindow = await validateCommittedProgressionRestWindow({
    repository: input.repository,
    campaignId: input.campaignId,
    award,
    proof: input.command.restWindow
  });
  if (!restWindow.ok) return restWindow;
  const revisionIssues = [
    [character.value.aggregateRevision, input.command.expectedCharacterRevision, "character.state"],
    [tactical.value.aggregateRevision, input.command.expectedTacticalProjectionRevision, "character.tactical-projection"],
    [narrative.value.aggregateRevision, input.command.expectedNarrativeProjectionRevision, "character.narrative-projection"]
  ].flatMap(([actual, expected, label]) =>
    actual === expected ? [] : [`${label} revision mismatch`]
  );
  if (revisionIssues.length > 0) {
    return invalid("progression.application-stale-projection", revisionIssues);
  }

  const currentCharacter =
    character.value.payload as unknown as CharacterAggregatePayloadV1;
  const currentTactical =
    tactical.value.payload as unknown as TacticalCharacterProjectionV1;
  const currentNarrative =
    narrative.value.payload as unknown as NarrativeCharacterProjectionV1;
  const candidate = {
    characterState:
      input.command.candidate.characterState as unknown as CharacterAggregatePayloadV1,
    tacticalProjection:
      input.command.candidate.tacticalProjection as unknown as TacticalCharacterProjectionV1,
    narrativeProjection:
      input.command.candidate.narrativeProjection as unknown as NarrativeCharacterProjectionV1
  };
  const candidateIssues = validateCandidateBoundary({
    campaign: campaign.value,
    award,
    currentCharacter,
    currentTactical,
    currentNarrative,
    choices: input.command.choices,
    candidate
  });
  if (candidateIssues.length > 0) {
    return invalid("progression.application-candidate-invalid", candidateIssues);
  }

  const validation = await input.validator.validate({
    campaign: campaign.value,
    award: cloneJson(award),
    currentCharacter: cloneJson(currentCharacter),
    currentTacticalProjection: cloneJson(currentTactical),
    currentNarrativeProjection: cloneJson(currentNarrative),
    choices: cloneJson(input.command.choices),
    candidate: cloneJson(candidate)
  });
  const validationIssues = validateApplicationDecision(
    validation,
    currentCharacter,
    candidate.characterState
  );
  if (validationIssues.length > 0) {
    return invalid("progression.validator-decision-invalid", validationIssues);
  }
  const started = await beginOperation({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    requestFingerprint,
    operationKind: "character.progression.apply",
    payload: cloneJson(input.command)
  });
  if (!started.ok) return started;
  if (!validation.valid || validation.publicSummary === null) {
    const result: CharacterProgressionApplicationResultV1 = {
      schemaVersion: 1,
      status: "REJECTED",
      reasonCodes: [...validation.reasonCodes],
      award,
      publicSummary: null,
      commitId: null,
      replayed: false
    };
    const completed = await input.repository.completeWithoutCommit(operationId, 1, result);
    return completed.ok ? { ok: true, value: result } : completed;
  }

  const appliedAward: CharacterProgressionAwardV1 = {
    ...award,
    status: "APPLIED",
    appliedAtGameSecond,
    version: award.version + 1
  };
  const nextRegistry: CharacterProgressionRegistryV1 = {
    ...registry.value.state,
    awards: registry.value.state.awards.map(value =>
      value.awardId === award.awardId ? appliedAward : value
    ),
    version: registry.value.state.version + 1
  };
  const committed = await commitApplication({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    registryAggregate: registry.value.aggregate,
    nextRegistry,
    characterAggregate: character.value,
    tacticalAggregate: tactical.value,
    narrativeAggregate: narrative.value,
    candidate,
    choices: input.command.choices,
    restWindow: input.command.restWindow,
    appliedAward,
    validatorRef: input.validator.validatorRef,
    ruleDecisionRefs: validation.ruleDecisionRefs,
    publicSummary: validation.publicSummary,
    appliedAtGameSecond
  });
  if (!committed.ok) return committed;
  const result: CharacterProgressionApplicationResultV1 = {
    schemaVersion: 1,
    status: "APPLIED",
    reasonCodes: [...validation.reasonCodes],
    award: appliedAward,
    publicSummary: validation.publicSummary,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(
    operationId,
    "COMMITTED_RENDERED",
    1,
    result
  );
  return completed.ok ? { ok: true, value: result } : completed;
}

async function findCommittedSourceEvent(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sourceOperationId: OperationId;
  sourceEventId: string;
  sourceCommitId: CommitId;
}): Promise<Result<EventRecord | null>> {
  let cursor: { commitSequence: number; eventSequence: number } | null = null;
  while (true) {
    const page = await input.repository.listEvents(input.campaignId, cursor, 1_024);
    if (!page.ok) return page;
    const found = page.value.find(event =>
      event.eventId === input.sourceEventId
      && event.operationId === input.sourceOperationId
      && event.commitId === input.sourceCommitId
    );
    if (found !== undefined) return { ok: true, value: found };
    const last = page.value.at(-1);
    if (last === undefined || page.value.length < 1_024) {
      return { ok: true, value: null };
    }
    cursor = {
      commitSequence: last.commitSequence,
      eventSequence: last.eventSequence
    };
  }
}

function resultForAward(
  status: "GRANTED" | "ALREADY_GRANTED",
  reasonCode: string,
  award: CharacterProgressionAwardV1,
  commitId: CommitId | null
): CharacterProgressionAwardEvaluationResultV1 {
  return {
    schemaVersion: 1,
    status,
    reasonCode,
    award,
    publicNotice: {
      schemaVersion: 1,
      awardId: award.awardId,
      awardKind: award.awardKind,
      status: award.status === "CHOICE_REQUIRED" ? "CHOICE_REQUIRED" : "AVAILABLE",
      requiredChoices: [...award.requiredChoices],
      availableAtGameSecond: award.availableAtGameSecond
    },
    commitId,
    replayed: false
  };
}

async function beginOperation(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  clientRequestId: string;
  requestFingerprint: string;
  operationKind: string;
  payload: JsonObject;
}): Promise<Result<OperationRecord>> {
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  const received = await input.repository.receiveOperation({
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(input.operationId),
    requestFingerprint: input.requestFingerprint,
    operationKind: input.operationKind,
    requestPayloadSchemaVersion: 1,
    requestPayload: input.payload,
    phase: "RECEIVED",
    observedCampaignRevision: campaign.value.campaignRevision,
    commitId: null,
    completionMode: null,
    resultPayloadSchemaVersion: null,
    resultPayload: null,
    failure: null,
    receivedAt: now,
    updatedAt: now
  });
  return received;
}

async function commitAward(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  currentAggregate: AggregateRecord | null;
  nextRegistry: CharacterProgressionRegistryV1;
  award: CharacterProgressionAwardV1;
}): Promise<Result<{ commitId: CommitId }>> {
  const preparing = await input.repository.transitionOperation(
    input.operation.operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(
    input.operation.operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const aggregateId = characterProgressionRegistryAggregateIdV1(input.campaignId);
    const nextRevision = input.currentAggregate === null
      ? 0
      : input.currentAggregate.aggregateRevision + 1;
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "character-progression-authority",
      contractVersion: 1,
      commandId: opaqueId(`${input.operation.operationId}:command`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: "character.progression.grant-award",
      target: {
        aggregateType: CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: {
        awardId: input.award.awardId,
        characterId: input.award.characterId,
        awardKind: input.award.awardKind,
        sourceEventId: input.award.sourceEventId,
        policyRef: input.award.policyRef
      },
      acceptedAtGameSecond: input.award.availableAtGameSecond
    };
    const publicNotice = resultForAward("GRANTED", "GRANTED", input.award, null).publicNotice!;
    const events: EventDraft[] = [{
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:granted`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "progression_award_granted",
      origin: "RULE",
      causation: { kind: "EVENT", id: input.award.sourceEventId },
      aggregateRefs: [{
        aggregateType: CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        aggregateRevision: nextRevision
      }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.award.availableAtGameSecond,
      payloadSchemaVersion: 1,
      payload: publicNotice
    }];
    if (input.award.status === "CHOICE_REQUIRED") {
      events.push({
        ...events[0]!,
        eventId: opaqueId<EventId>(`${input.operation.operationId}:choice-required`),
        eventType: "progression_choice_required",
        causation: { kind: "EVENT", id: `${input.operation.operationId}:granted` }
      });
    }
    const request: CommitRequest = {
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextRegistry)
      }],
      events,
      outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok
      ? { ok: true, value: { commitId: committed.value.commitId } }
      : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

async function commitApplication(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  registryAggregate: AggregateRecord | null;
  nextRegistry: CharacterProgressionRegistryV1;
  characterAggregate: AggregateRecord;
  tacticalAggregate: AggregateRecord;
  narrativeAggregate: AggregateRecord;
  candidate: {
    characterState: CharacterAggregatePayloadV1;
    tacticalProjection: TacticalCharacterProjectionV1;
    narrativeProjection: NarrativeCharacterProjectionV1;
  };
  choices: CharacterProgressionChoiceResolutionV1[];
  restWindow: CharacterProgressionRestWindowV1;
  appliedAward: CharacterProgressionAwardV1;
  validatorRef: string;
  ruleDecisionRefs: string[];
  publicSummary: CharacterProgressionPublicSummaryV1;
  appliedAtGameSecond: number;
}): Promise<Result<{ commitId: CommitId }>> {
  const preparing = await input.repository.transitionOperation(
    input.operation.operationId,
    "RECEIVED",
    "PREPARING"
  );
  if (!preparing.ok) return preparing;
  const ready = await input.repository.transitionOperation(
    input.operation.operationId,
    "PREPARING",
    "READY_TO_COMMIT"
  );
  if (!ready.ok) return ready;
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const registryAggregateId = characterProgressionRegistryAggregateIdV1(input.campaignId);
    const registryRevision = input.registryAggregate === null
      ? 0
      : input.registryAggregate.aggregateRevision + 1;
    const characterRevision = input.characterAggregate.aggregateRevision + 1;
    const tacticalRevision = input.tacticalAggregate.aggregateRevision + 1;
    const narrativeRevision = input.narrativeAggregate.aggregateRevision + 1;
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "character-progression-authority",
      contractVersion: 1,
      commandId: opaqueId(`${input.operation.operationId}:command`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: "character.progression.apply",
      target: {
        aggregateType: CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: registryAggregateId,
        expectedAggregateRevision: input.registryAggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: {
        awardId: input.appliedAward.awardId,
        characterId: input.appliedAward.characterId,
        validatorRef: input.validatorRef,
        ruleDecisionRefs: [...input.ruleDecisionRefs],
        choices: cloneJson(input.choices),
        restWindow: cloneJson(input.restWindow)
      },
      acceptedAtGameSecond: input.appliedAtGameSecond
    };
    const aggregateRefs = [{
      aggregateType: CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: registryAggregateId,
      aggregateRevision: registryRevision
    }, {
      aggregateType: "character.state",
      aggregateId: input.characterAggregate.aggregateId,
      aggregateRevision: characterRevision
    }, {
      aggregateType: "character.tactical-projection",
      aggregateId: input.tacticalAggregate.aggregateId,
      aggregateRevision: tacticalRevision
    }, {
      aggregateType: "character.narrative-projection",
      aggregateId: input.narrativeAggregate.aggregateId,
      aggregateRevision: narrativeRevision
    }];
    const events: EventDraft[] = [{
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:applied`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "progression_award_applied",
      origin: "RULE",
      causation: { kind: "COMMAND", id: command.commandId },
      aggregateRefs,
      visibility: { scope: "SYSTEM", actorIds: [] },
      occurredAtGameSecond: input.appliedAtGameSecond,
      payloadSchemaVersion: 1,
      payload: {
        awardId: input.appliedAward.awardId,
        characterId: input.appliedAward.characterId,
        validatorRef: input.validatorRef,
        ruleDecisionRefs: [...input.ruleDecisionRefs]
      }
    }, {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:level-changed`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "player_level_changed",
      origin: "RULE",
      causation: { kind: "EVENT", id: `${input.operation.operationId}:applied` },
      aggregateRefs,
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.appliedAtGameSecond,
      payloadSchemaVersion: 1,
      payload: cloneJson(input.publicSummary)
    }];
    const request: CommitRequest = {
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: CHARACTER_PROGRESSION_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: registryAggregateId,
        expectedAggregateRevision: input.registryAggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextRegistry)
      }, {
        aggregateType: "character.state",
        aggregateId: input.characterAggregate.aggregateId,
        expectedAggregateRevision: input.characterAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.candidate.characterState) as unknown as JsonObject
      }, {
        aggregateType: "character.tactical-projection",
        aggregateId: input.tacticalAggregate.aggregateId,
        expectedAggregateRevision: input.tacticalAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.candidate.tacticalProjection) as unknown as JsonObject
      }, {
        aggregateType: "character.narrative-projection",
        aggregateId: input.narrativeAggregate.aggregateId,
        expectedAggregateRevision: input.narrativeAggregate.aggregateRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.candidate.narrativeProjection) as unknown as JsonObject
      }],
      events,
      outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok
      ? { ok: true, value: { commitId: committed.value.commitId } }
      : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function restoreResult(
  operation: OperationRecord
): Result<CharacterProgressionAwardEvaluationResultV1> {
  const result = operation.resultPayload as CharacterProgressionAwardEvaluationResultV1 | null;
  return result?.schemaVersion === 1
    ? { ok: true, value: { ...result, replayed: true } }
    : {
        ok: false,
        error: coreError("PERSISTENCE_FAILURE", "progression.award-result-missing")
      };
}

function restoreApplicationResult(
  operation: OperationRecord
): Result<CharacterProgressionApplicationResultV1> {
  const result = operation.resultPayload as CharacterProgressionApplicationResultV1 | null;
  return result?.schemaVersion === 1
    ? { ok: true, value: { ...result, replayed: true } }
    : {
        ok: false,
        error: coreError("PERSISTENCE_FAILURE", "progression.application-result-missing")
      };
}

function validateCommand(command: EvaluateCharacterProgressionAwardCommandV1): string[] {
  const issues: string[] = [];
  if (
    command.schemaVersion !== 1
    || command.contractVersion !== CHARACTER_PROGRESSION_AWARD_CONTRACT_V1
  ) {
    issues.push("award contract mismatch");
  }
  for (const value of [
    command.clientRequestId,
    command.sourceOperationId,
    command.sourceEventId,
    command.characterAggregateId
  ]) {
    if (!nonEmpty(value)) issues.push("award identities are required");
  }
  return issues;
}

function validateDecision(decision: CharacterProgressionEligibilityDecisionV1): string[] {
  const issues: string[] = [];
  if (decision.schemaVersion !== 1 || typeof decision.eligible !== "boolean") {
    issues.push("policy decision envelope is invalid");
  }
  if (!nonEmpty(decision.reasonCode)) issues.push("policy reasonCode is required");
  if (decision.eligible && decision.awardKind !== "CLASS_LEVEL") {
    issues.push("eligible decision requires a supported award kind");
  }
  if (!decision.eligible && decision.awardKind !== null) {
    issues.push("ineligible decision cannot expose an award kind");
  }
  if (
    !Array.isArray(decision.requiredChoices)
    || decision.requiredChoices.some(value =>
      !["CLASS", "SUBCLASS", "ABILITY_SCORE_OR_FEAT", "FEATURE_OPTION"].includes(value)
    )
  ) {
    issues.push("required choices are invalid");
  }
  return issues;
}

async function validateCommittedProgressionRestWindow(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  award: CharacterProgressionAwardV1;
  proof: CharacterProgressionRestWindowV1;
}): Promise<Result<EventRecord>> {
  const operation = await input.repository.getOperation(
    opaqueId<OperationId>(input.proof.restSegmentOperationId)
  );
  if (!operation.ok) {
    return operation.error.code === "NOT_FOUND"
      ? invalid("progression.application-rest-window-invalid", [
          "rest segment operation does not exist"
        ])
      : operation;
  }
  if (
    operation.value.campaignId !== input.campaignId
    || operation.value.operationKind !== "time.segment"
    || operation.value.phase !== "COMPLETED"
    || operation.value.commitId === null
  ) {
    return invalid("progression.application-rest-window-invalid", [
      "rest segment operation must be completed and committed"
    ]);
  }
  const event = await findCommittedSourceEvent({
    repository: input.repository,
    campaignId: input.campaignId,
    sourceOperationId: operation.value.operationId,
    sourceEventId: input.proof.restSegmentEventId,
    sourceCommitId: operation.value.commitId
  });
  if (!event.ok) return event;
  if (event.value === null) {
    return invalid("progression.application-rest-window-invalid", [
      "rest segment event is not part of the referenced commit"
    ]);
  }
  const restResult = isJsonObject(event.value.payload.result)
    ? event.value.payload.result
    : null;
  const activity = restResult !== null && isJsonObject(restResult.activity)
    ? restResult.activity
    : null;
  const issues: string[] = [];
  if (!["rest_segment_completed", "rest_completed_pending_benefits"].includes(
    event.value.eventType
  )) {
    issues.push("rest progression segment must have completed without interruption");
  }
  if (
    restResult === null
    || !["SHORT_REST", "LONG_REST"].includes(String(restResult.restKind))
  ) {
    issues.push("progression requires a short or long rest");
  }
  if (restResult?.processId !== input.proof.restProcessId) {
    issues.push("rest process identity does not match the proof");
  }
  if (
    activity === null
    || activity.schemaVersion !== 1
    || activity.activityKind !== "CHARACTER_PROGRESSION"
    || activity.characterId !== input.award.characterId
    || activity.progressionAwardId !== input.award.awardId
  ) {
    issues.push("rest segment was not dedicated to this character progression award");
  }
  if (event.value.occurredAtGameSecond < input.award.availableAtGameSecond) {
    issues.push("rest progression segment predates the progression award");
  }
  return issues.length > 0
    ? invalid("progression.application-rest-window-invalid", issues)
    : { ok: true, value: event.value };
}

function validateApplicationCommand(command: ApplyCharacterProgressionCommandV1): string[] {
  const issues: string[] = [];
  if (
    command.schemaVersion !== 1
    || command.contractVersion !== CHARACTER_PROGRESSION_APPLICATION_CONTRACT_V1
  ) {
    issues.push("application contract mismatch");
  }
  for (const value of [
    command.clientRequestId,
    command.awardId,
    command.characterAggregateId,
    command.tacticalProjectionAggregateId,
    command.narrativeProjectionAggregateId
  ]) {
    if (!nonEmpty(value)) issues.push("application identities are required");
  }
  for (const revision of [
    command.expectedCharacterRevision,
    command.expectedTacticalProjectionRevision,
    command.expectedNarrativeProjectionRevision
  ]) {
    if (!Number.isInteger(revision) || revision < 0) {
      issues.push("expected revisions must be non-negative integers");
    }
  }
  if (!Array.isArray(command.choices)) issues.push("choices must be an array");
  if (
    !isJsonObject(command.restWindow)
    || command.restWindow.schemaVersion !== 1
    || !nonEmpty(command.restWindow.restSegmentOperationId)
    || !nonEmpty(command.restWindow.restSegmentEventId)
    || !nonEmpty(command.restWindow.restProcessId)
  ) {
    issues.push("a committed rest progression window is required");
  }
  if (
    command.candidate === null
    || typeof command.candidate !== "object"
    || !isJsonObject(command.candidate.characterState)
    || !isJsonObject(command.candidate.tacticalProjection)
    || !isJsonObject(command.candidate.narrativeProjection)
  ) {
    issues.push("a complete application candidate is required");
  }
  return issues;
}

function validateCandidateBoundary(input: {
  campaign: CampaignRecord;
  award: CharacterProgressionAwardV1;
  currentCharacter: CharacterAggregatePayloadV1;
  currentTactical: TacticalCharacterProjectionV1;
  currentNarrative: NarrativeCharacterProjectionV1;
  choices: CharacterProgressionChoiceResolutionV1[];
  candidate: {
    characterState: CharacterAggregatePayloadV1;
    tacticalProjection: TacticalCharacterProjectionV1;
    narrativeProjection: NarrativeCharacterProjectionV1;
  };
}): string[] {
  const issues: string[] = [];
  const current = input.currentCharacter;
  const next = input.candidate.characterState;
  if (
    current.schemaVersion !== 1
    || input.currentTactical.schemaVersion !== 1
    || input.currentNarrative.schemaVersion !== 1
  ) {
    issues.push("current character projections are invalid");
  }
  if (
    next.schemaVersion !== 1
    || input.candidate.tacticalProjection.schemaVersion !== 1
    || input.candidate.narrativeProjection.schemaVersion !== 1
  ) {
    issues.push("candidate character projections are invalid");
  }
  const identities = [
    current.characterId,
    input.currentTactical.characterId,
    input.currentNarrative.characterId,
    next.characterId,
    input.candidate.tacticalProjection.characterId,
    input.candidate.narrativeProjection.characterId,
    input.award.characterId
  ];
  if (identities.some(value => value !== current.characterId)) {
    issues.push("character identity must remain stable across every projection");
  }
  if (
    next.rulesetId !== input.campaign.dependencies.rulesetId
    || next.rulesetVersion !== input.campaign.dependencies.rulesetVersion
  ) {
    issues.push("candidate must use the campaign ruleset");
  }
  if (
    input.award.awardKind === "CLASS_LEVEL"
    && next.globalLevel !== current.globalLevel + 1
  ) {
    issues.push("class-level award must increase global level exactly once");
  }
  if (
    !Number.isInteger(next.globalLevel)
    || next.globalLevel < 1
    || next.globalLevel > 20
    || !Array.isArray(next.classes)
    || next.classes.length === 0
    || next.classes.some(value =>
      !nonEmpty(value.classId)
      || !Number.isInteger(value.level)
      || value.level < 1
      || value.level > 20
    )
    || next.classes.reduce((sum, value) => sum + value.level, 0) !== next.globalLevel
  ) {
    issues.push("candidate class levels and global level are inconsistent");
  }
  const nextClassLevels = new Map(next.classes?.map(value => [value.classId, value.level]) ?? []);
  if (current.classes.some(value =>
    (nextClassLevels.get(value.classId) ?? 0) < value.level
  )) {
    issues.push("an existing class level cannot decrease during progression");
  }
  if (input.candidate.tacticalProjection.level !== next.globalLevel) {
    issues.push("tactical projection level must match candidate global level");
  }
  const choiceKinds = input.choices.map(value => value.kind);
  if (new Set(choiceKinds).size !== choiceKinds.length) {
    issues.push("each choice kind may be resolved only once");
  }
  if (input.choices.some(value =>
    !["CLASS", "SUBCLASS", "ABILITY_SCORE_OR_FEAT", "FEATURE_OPTION"].includes(value.kind)
    || !Array.isArray(value.selectionRefs)
    || value.selectionRefs.length === 0
    || value.selectionRefs.some(ref => !nonEmpty(ref))
  )) {
    issues.push("choice resolutions are invalid");
  }
  for (const required of input.award.requiredChoices) {
    if (!choiceKinds.includes(required)) {
      issues.push(`required choice ${required} is unresolved`);
    }
  }
  return issues;
}

function validateApplicationDecision(
  decision: CharacterProgressionCandidateValidationDecisionV1,
  current: CharacterAggregatePayloadV1,
  next: CharacterAggregatePayloadV1
): string[] {
  const issues: string[] = [];
  if (
    decision.schemaVersion !== 1
    || typeof decision.valid !== "boolean"
    || !Array.isArray(decision.reasonCodes)
    || decision.reasonCodes.some(value => !nonEmpty(value))
    || !Array.isArray(decision.ruleDecisionRefs)
    || decision.ruleDecisionRefs.some(value => !nonEmpty(value))
  ) {
    issues.push("validator decision envelope is invalid");
  }
  if (decision.valid && decision.publicSummary === null) {
    issues.push("valid decision requires a public summary");
  }
  if (!decision.valid && decision.publicSummary !== null) {
    issues.push("rejected decision cannot expose a public summary");
  }
  const summary = decision.publicSummary;
  if (summary !== null && (
    summary.schemaVersion !== 1
    || summary.characterId !== current.characterId
    || summary.characterDisplayName !== next.name
    || !boundedPublicText(summary.characterDisplayName, 80)
    || summary.previousGlobalLevel !== current.globalLevel
    || summary.newGlobalLevel !== next.globalLevel
    || !boundedPublicText(summary.progressionLabel, 120)
    || !Array.isArray(summary.grantedLabels)
    || summary.grantedLabels.length > 20
    || summary.grantedLabels.some(value => !boundedPublicText(value, 120))
  )) {
    issues.push("public progression summary is inconsistent");
  }
  return issues;
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function boundedPublicText(value: unknown, maximumLength: number): value is string {
  return nonEmpty(value)
    && value.trim() === value
    && value.length <= maximumLength
    && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
