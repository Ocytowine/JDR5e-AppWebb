import {
  cloneJson,
  computeRequestFingerprint,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CampaignRepository,
  type CommitId,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type OperationRecord,
  type RequestId,
  type Result,
  type WriterId
} from "../core";
import {
  SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
  type SocialKnowledgeStateV1
} from "../scene";

export const SOCIAL_ACTOR_REGISTRY_CONTRACT_V1 = "social-actor-registry/1" as const;
export const SOCIAL_ACTOR_MUTATION_COMMAND_V1 = "social-actor-mutation/1" as const;
export const SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1 = "social-local-initiative/1" as const;
export const SOCIAL_ACTOR_REGISTRY_AGGREGATE_TYPE_V1 = "social.actor-registry" as const;

export type SocialConfidenceV1 = "LOW" | "MEDIUM" | "HIGH";
export type SocialInitiativeActKindV1 = "SPEAK" | "MOVE" | "SIGNAL" | "INTERACT_WITH_SCENE";
export type SocialSceneBoundaryKindV1 =
  | "SCENE_ENTRY"
  | "LOCAL_EVENT_COMPLETED"
  | "NARRATIVE_TURN_PROGRESSED"
  | "LOCAL_TIME_BOUNDARY";

export interface DurableSocialBeliefV1 extends JsonObject {
  beliefId: string;
  claim: string;
  confidence: SocialConfidenceV1;
  sourceRefs: string[];
  mayBeFalse: boolean;
}

export interface DurableSocialRelationshipV1 extends JsonObject {
  targetActorId: string;
  trust: number;
  affinity: number;
  fear: number;
  debt: number;
  sourceRefs: string[];
}

export interface DurableSocialReputationV1 extends JsonObject {
  markerId: string;
  scopeRef: string;
  label: string;
  sourceRefs: string[];
}

export interface DurableSocialDebtOrPromiseV1 extends JsonObject {
  recordId: string;
  targetRef: string;
  kind: "DEBT" | "PROMISE";
  text: string;
  sourceRefs: string[];
}

export interface SocialActorConcernV1 extends JsonObject {
  concernId: string;
  status: "ACTIVE" | "RESOLVED" | "CANCELLED";
  privateObjective: string;
  publicActionHint: string;
  actKind: SocialInitiativeActKindV1;
  urgency: number;
  availableFromGameSecond: number;
  expiresAtGameSecond: number | null;
  targetRefs: string[];
  sourceRefs: string[];
  minimumIntervalSeconds: number;
  lastExecutedAtGameSecond: number | null;
  executionCount: number;
}

export interface SocialActorStateV1 extends JsonObject {
  schemaVersion: 1;
  actorId: string;
  knownFactRefs: string[];
  beliefs: DurableSocialBeliefV1[];
  relationships: DurableSocialRelationshipV1[];
  reputationMarkers: DurableSocialReputationV1[];
  debtsAndPromises: DurableSocialDebtOrPromiseV1[];
  concerns: SocialActorConcernV1[];
  visibilityConstraints: string[];
  sourceEventRefs: string[];
  lastInitiativeAtGameSecond: number | null;
  version: number;
}

export interface SocialActorRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SOCIAL_ACTOR_REGISTRY_CONTRACT_V1;
  campaignId: string;
  actors: SocialActorStateV1[];
  version: number;
}

export interface SocialRelationshipDeltaV1 extends JsonObject {
  targetActorId: string;
  trust: number;
  affinity: number;
  fear: number;
  debt: number;
  sourceRefs: string[];
}

export interface SocialActorMutationSetV1 extends JsonObject {
  knownFactRefsAdded: string[];
  beliefsUpserted: DurableSocialBeliefV1[];
  relationshipDeltas: SocialRelationshipDeltaV1[];
  reputationMarkersUpserted: DurableSocialReputationV1[];
  debtsAndPromisesUpserted: DurableSocialDebtOrPromiseV1[];
  concernsUpserted: SocialActorConcernV1[];
  visibilityConstraintsAdded: string[];
}

export interface MutateSocialActorCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SOCIAL_ACTOR_MUTATION_COMMAND_V1;
  clientRequestId: string;
  actorId: string;
  reason: string;
  sourceEventRefs: string[];
  occurredAtGameSecond: number;
  changes: SocialActorMutationSetV1;
}

export interface SocialActorMutationResultV1 extends JsonObject {
  schemaVersion: 1;
  actor: SocialActorStateV1;
  commitId: string;
  replayed: boolean;
}

export interface SocialLocalInitiativeBoundaryCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1;
  clientRequestId: string;
  sceneId: string;
  boundaryKind: SocialSceneBoundaryKindV1;
  presentActorIds: string[];
  playerActorId: string;
  occurredAtGameSecond: number;
}

export interface SocialLocalInitiativeSignalV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1;
  sceneId: string;
  actorId: string;
  targetRef: string;
  targetsPlayer: boolean;
  actKind: SocialInitiativeActKindV1;
  publicActionHint: string;
  occurredAtGameSecond: number;
  sourceEventRef: string;
}

export interface SocialLocalInitiativeResultV1 extends JsonObject {
  schemaVersion: 1;
  status: "INITIATIVE_COMMITTED" | "CALM";
  boundaryKind: SocialSceneBoundaryKindV1;
  initiative: SocialLocalInitiativeSignalV1 | null;
  commitId: string | null;
  replayed: boolean;
}

interface SocialInitiativeCandidateV1 {
  actorId: string;
  concernId: string;
  targetRef: string;
  actKind: SocialInitiativeActKindV1;
  publicActionHint: string;
  urgency: number;
  availableFromGameSecond: number;
}

export function socialActorRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-social-actors:${campaignId}`);
}

export function createEmptySocialActorRegistryV1(campaignId: string): SocialActorRegistryV1 {
  return {
    schemaVersion: 1,
    contractVersion: SOCIAL_ACTOR_REGISTRY_CONTRACT_V1,
    campaignId,
    actors: [],
    version: 1
  };
}

export async function loadSocialActorRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: SocialActorRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    SOCIAL_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
    socialActorRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: createEmptySocialActorRegistryV1(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<SocialActorRegistryV1>;
  if (
    state.contractVersion !== SOCIAL_ACTOR_REGISTRY_CONTRACT_V1 ||
    state.campaignId !== campaignId ||
    !Array.isArray(state.actors)
  ) {
    return invalid("social.actor-registry-invalid", ["registry payload is invalid"]);
  }
  return { ok: true, value: { aggregate: aggregate.value, state: state as SocialActorRegistryV1 } };
}

export async function mutateSocialActorStateV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: MutateSocialActorCommandV1;
}): Promise<Result<SocialActorMutationResultV1>> {
  const issues = validateMutationCommand(input.command);
  if (issues.length > 0) return invalid("social.actor-mutation-invalid", issues);
  const operationId = opaqueId<OperationId>(`social-actor-mutation:${input.command.clientRequestId}`);
  const requestFingerprint = await computeRequestFingerprint(
    "social.actor.mutate",
    1,
    input.command
  );
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== requestFingerprint) {
    return {
      ok: false,
      error: coreError("IDEMPOTENCY_CONFLICT", "social.actor-mutation-request-conflict")
    };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") {
    return restoreMutationResult(existing.value);
  }
  if (existing.ok) return invalid("social.actor-mutation-incomplete", ["operation already exists and is not completed"]);
  if (existing.error.code !== "NOT_FOUND") return existing;

  const loaded = await loadSocialActorRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const nextActor = applySocialMutationV1(
    loaded.value.state.actors.find(actor => actor.actorId === input.command.actorId) ??
      createEmptySocialActorStateV1(input.command.actorId),
    input.command
  );
  if (!nextActor.ok) return nextActor;
  const actors = loaded.value.state.actors.filter(actor => actor.actorId !== input.command.actorId);
  const nextRegistry: SocialActorRegistryV1 = {
    ...loaded.value.state,
    actors: [...actors, nextActor.value].sort((left, right) => left.actorId.localeCompare(right.actorId)),
    version: loaded.value.state.version + 1
  };
  const started = await beginSocialOperationV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    operationKind: "social.actor.mutate",
    payload: cloneJson(input.command)
  });
  if (!started.ok) return started;
  const committed = await commitSocialRegistryV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry,
    commandType: "social.actor.mutate",
    commandPayload: {
      actorId: input.command.actorId,
      reason: input.command.reason,
      sourceEventRefs: [...input.command.sourceEventRefs]
    },
    eventType: "social.actor-state.updated",
    eventVisibility: { scope: "ACTOR_SCOPED", actorIds: [input.command.actorId] },
    eventPayload: {
      actorId: input.command.actorId,
      knownFactCountAdded: input.command.changes.knownFactRefsAdded.length,
      beliefCountUpserted: input.command.changes.beliefsUpserted.length,
      relationshipCountChanged: input.command.changes.relationshipDeltas.length,
      concernCountUpserted: input.command.changes.concernsUpserted.length
    },
    occurredAtGameSecond: input.command.occurredAtGameSecond
  });
  if (!committed.ok) return committed;
  const result: SocialActorMutationResultV1 = {
    schemaVersion: 1,
    actor: nextActor.value,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export async function resolveLocalSocialInitiativeBoundaryV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: SocialLocalInitiativeBoundaryCommandV1;
}): Promise<Result<SocialLocalInitiativeResultV1>> {
  const issues = validateBoundaryCommand(input.command);
  if (issues.length > 0) return invalid("social.local-initiative-boundary-invalid", issues);
  const operationId = opaqueId<OperationId>(`social-local-initiative:${input.command.clientRequestId}`);
  const boundaryIdentity = localInitiativeBoundaryIdentityV1(input.command);
  const requestFingerprint = await computeRequestFingerprint(
    "social.local-initiative.boundary",
    1,
    boundaryIdentity
  );
  const existing = await input.repository.getOperation(operationId);
  const persistedBoundaryFingerprint = existing.ok
    && existing.value.operationKind === "social.local-initiative.boundary"
    ? await computeRequestFingerprint(
        "social.local-initiative.boundary",
        1,
        localInitiativeBoundaryIdentityV1(
          existing.value.requestPayload as unknown as SocialLocalInitiativeBoundaryCommandV1
        )
      )
    : null;
  if (
    existing.ok
    && existing.value.requestFingerprint !== requestFingerprint
    && persistedBoundaryFingerprint !== requestFingerprint
  ) {
    return {
      ok: false,
      error: coreError("IDEMPOTENCY_CONFLICT", "social.local-initiative-request-conflict")
    };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") return restoreInitiativeResult(existing.value);
  if (existing.ok) return invalid("social.local-initiative-incomplete", ["operation already exists and is not completed"]);
  if (existing.error.code !== "NOT_FOUND") return existing;

  const loaded = await loadSocialActorRegistryV1(input.repository, input.campaignId);
  if (!loaded.ok) return loaded;
  const selected = selectLocalSocialInitiativeV1({
    registry: loaded.value.state,
    presentActorIds: input.command.presentActorIds,
    occurredAtGameSecond: input.command.occurredAtGameSecond
  });
  const started = await beginSocialOperationV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operationId,
    clientRequestId: input.command.clientRequestId,
    operationKind: "social.local-initiative.boundary",
    payload: cloneJson(input.command),
    readyToCommit: selected !== null
  });
  if (!started.ok) return started;
  if (selected === null) {
    const calm: SocialLocalInitiativeResultV1 = {
      schemaVersion: 1,
      status: "CALM",
      boundaryKind: input.command.boundaryKind,
      initiative: null,
      commitId: null,
      replayed: false
    };
    const completed = await input.repository.completeWithoutCommit(operationId, 1, calm);
    return completed.ok ? { ok: true, value: calm } : completed;
  }

  const nextRegistry = markInitiativeExecutedV1(
    loaded.value.state,
    selected,
    input.command.occurredAtGameSecond
  );
  const eventId = opaqueId<EventId>(`${operationId}:event`);
  const signal: SocialLocalInitiativeSignalV1 = {
    schemaVersion: 1,
    contractVersion: SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1,
    sceneId: input.command.sceneId,
    actorId: selected.actorId,
    targetRef: selected.targetRef,
    targetsPlayer: selected.targetRef === `actor:${input.command.playerActorId}`,
    actKind: selected.actKind,
    publicActionHint: selected.publicActionHint,
    occurredAtGameSecond: input.command.occurredAtGameSecond,
    sourceEventRef: `event:${eventId}`
  };
  const committed = await commitSocialRegistryV1({
    repository: input.repository,
    campaignId: input.campaignId,
    operation: started.value,
    currentAggregate: loaded.value.aggregate,
    nextRegistry,
    commandType: "social.local-initiative.execute",
    commandPayload: {
      actorId: selected.actorId,
      concernId: selected.concernId,
      targetRef: selected.targetRef,
      boundaryKind: input.command.boundaryKind
    },
    eventId,
    eventType: "social.local-initiative.executed",
    eventVisibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
    eventPayload: {
      sceneId: input.command.sceneId,
      actorId: selected.actorId,
      targetRef: selected.targetRef,
      actKind: selected.actKind,
      publicActionHint: selected.publicActionHint
    },
    occurredAtGameSecond: input.command.occurredAtGameSecond
  });
  if (!committed.ok) return committed;
  const result: SocialLocalInitiativeResultV1 = {
    schemaVersion: 1,
    status: "INITIATIVE_COMMITTED",
    boundaryKind: input.command.boundaryKind,
    initiative: signal,
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

function localInitiativeBoundaryIdentityV1(
  command: SocialLocalInitiativeBoundaryCommandV1
): JsonObject {
  return {
    schemaVersion: command.schemaVersion,
    contractVersion: command.contractVersion,
    clientRequestId: command.clientRequestId,
    sceneId: command.sceneId,
    boundaryKind: command.boundaryKind,
    playerActorId: command.playerActorId,
    occurredAtGameSecond: command.occurredAtGameSecond
  };
}

export function selectLocalSocialInitiativeV1(input: {
  registry: SocialActorRegistryV1;
  presentActorIds: string[];
  occurredAtGameSecond: number;
}): SocialInitiativeCandidateV1 | null {
  const present = new Set(input.presentActorIds);
  const candidates: SocialInitiativeCandidateV1[] = [];
  for (const actor of input.registry.actors) {
    if (!present.has(actor.actorId)) continue;
    for (const concern of actor.concerns) {
      if (
        concern.status !== "ACTIVE" ||
        concern.availableFromGameSecond > input.occurredAtGameSecond ||
        (concern.expiresAtGameSecond !== null && concern.expiresAtGameSecond < input.occurredAtGameSecond) ||
        (actor.lastInitiativeAtGameSecond !== null &&
          actor.lastInitiativeAtGameSecond + concern.minimumIntervalSeconds > input.occurredAtGameSecond)
      ) continue;
      for (const targetRef of [...concern.targetRefs].sort()) {
        const targetActorId = targetRef.startsWith("actor:") ? targetRef.slice("actor:".length) : null;
        if (targetActorId !== null && !present.has(targetActorId)) continue;
        candidates.push({
          actorId: actor.actorId,
          concernId: concern.concernId,
          targetRef,
          actKind: concern.actKind,
          publicActionHint: concern.publicActionHint,
          urgency: concern.urgency,
          availableFromGameSecond: concern.availableFromGameSecond
        });
      }
    }
  }
  candidates.sort((left, right) =>
    right.urgency - left.urgency ||
    left.availableFromGameSecond - right.availableFromGameSecond ||
    left.actorId.localeCompare(right.actorId) ||
    left.concernId.localeCompare(right.concernId) ||
    left.targetRef.localeCompare(right.targetRef)
  );
  return candidates[0] ?? null;
}

export function projectSocialKnowledgeStateV1(actor: SocialActorStateV1): SocialKnowledgeStateV1 {
  return {
    schemaVersion: 1,
    contractVersion: SCENE_SOCIAL_UI_CONTRACT_VERSION_V1,
    actorId: actor.actorId,
    knownFactRefs: [...actor.knownFactRefs],
    beliefs: actor.beliefs.map(belief => ({
      beliefId: belief.beliefId,
      claim: belief.claim,
      confidence: belief.confidence,
      sourceRefs: [...belief.sourceRefs],
      mayBeFalse: belief.mayBeFalse
    })),
    relationshipEdges: actor.relationships.map(relationship => ({
      targetActorId: relationship.targetActorId,
      dimensions: {
        trust: relationship.trust,
        affinity: relationship.affinity,
        fear: relationship.fear,
        debt: relationship.debt
      },
      sourceRefs: [...relationship.sourceRefs]
    })),
    reputationMarkers: cloneJson(actor.reputationMarkers),
    debtsAndPromises: cloneJson(actor.debtsAndPromises),
    visibilityConstraints: [...actor.visibilityConstraints],
    sourceEventRefs: [...actor.sourceEventRefs],
    version: actor.version
  };
}

function createEmptySocialActorStateV1(actorId: string): SocialActorStateV1 {
  return {
    schemaVersion: 1,
    actorId,
    knownFactRefs: [],
    beliefs: [],
    relationships: [],
    reputationMarkers: [],
    debtsAndPromises: [],
    concerns: [],
    visibilityConstraints: [],
    sourceEventRefs: [],
    lastInitiativeAtGameSecond: null,
    version: 1
  };
}

function applySocialMutationV1(
  current: SocialActorStateV1,
  command: MutateSocialActorCommandV1
): Result<SocialActorStateV1> {
  const relationships = current.relationships.map(value => cloneJson(value) as DurableSocialRelationshipV1);
  for (const delta of command.changes.relationshipDeltas) {
    const index = relationships.findIndex(value => value.targetActorId === delta.targetActorId);
    const previous = index < 0
      ? { targetActorId: delta.targetActorId, trust: 0, affinity: 0, fear: 0, debt: 0, sourceRefs: [] }
      : relationships[index]!;
    const next: DurableSocialRelationshipV1 = {
      targetActorId: previous.targetActorId,
      trust: previous.trust + delta.trust,
      affinity: previous.affinity + delta.affinity,
      fear: previous.fear + delta.fear,
      debt: previous.debt + delta.debt,
      sourceRefs: unique([...previous.sourceRefs, ...delta.sourceRefs])
    };
    if ([next.trust, next.affinity, next.fear, next.debt].some(value => value < -100 || value > 100)) {
      return invalid("social.relationship-out-of-range", [`relationship ${delta.targetActorId} exceeds [-100, 100]`]);
    }
    if (index < 0) relationships.push(next);
    else relationships[index] = next;
  }
  return {
    ok: true,
    value: {
      ...current,
      knownFactRefs: unique([...current.knownFactRefs, ...command.changes.knownFactRefsAdded]),
      beliefs: upsertBy(current.beliefs, command.changes.beliefsUpserted, value => value.beliefId),
      relationships: relationships.sort((left, right) => left.targetActorId.localeCompare(right.targetActorId)),
      reputationMarkers: upsertBy(
        current.reputationMarkers,
        command.changes.reputationMarkersUpserted,
        value => value.markerId
      ),
      debtsAndPromises: upsertBy(
        current.debtsAndPromises,
        command.changes.debtsAndPromisesUpserted,
        value => value.recordId
      ),
      concerns: upsertBy(current.concerns, command.changes.concernsUpserted, value => value.concernId),
      visibilityConstraints: unique([
        ...current.visibilityConstraints,
        ...command.changes.visibilityConstraintsAdded
      ]),
      sourceEventRefs: unique([...current.sourceEventRefs, ...command.sourceEventRefs]),
      version: current.version + 1
    }
  };
}

function markInitiativeExecutedV1(
  registry: SocialActorRegistryV1,
  candidate: SocialInitiativeCandidateV1,
  occurredAtGameSecond: number
): SocialActorRegistryV1 {
  return {
    ...registry,
    actors: registry.actors.map(actor => actor.actorId !== candidate.actorId
      ? actor
      : {
          ...actor,
          lastInitiativeAtGameSecond: occurredAtGameSecond,
          concerns: actor.concerns.map(concern => concern.concernId !== candidate.concernId
            ? concern
            : {
                ...concern,
                lastExecutedAtGameSecond: occurredAtGameSecond,
                executionCount: concern.executionCount + 1
              }),
          version: actor.version + 1
        }),
    version: registry.version + 1
  };
}

async function beginSocialOperationV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operationId: OperationId;
  clientRequestId: string;
  operationKind: string;
  payload: JsonObject;
  readyToCommit?: boolean;
}): Promise<Result<OperationRecord>> {
  const fingerprint = await computeRequestFingerprint(input.operationKind, 1, input.payload);
  const campaign = await input.repository.getCampaign(input.campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  const received = await input.repository.receiveOperation({
    schemaVersion: 1,
    operationId: input.operationId,
    campaignId: input.campaignId,
    clientRequestId: opaqueId<RequestId>(input.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(input.operationId),
    requestFingerprint: fingerprint,
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
  if (!received.ok) return received;
  if (input.readyToCommit === false) return received;
  const preparing = await input.repository.transitionOperation(input.operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  return input.repository.transitionOperation(input.operationId, "PREPARING", "READY_TO_COMMIT");
}

async function commitSocialRegistryV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  currentAggregate: AggregateRecord | null;
  nextRegistry: SocialActorRegistryV1;
  commandType: string;
  commandPayload: JsonObject;
  eventId?: EventId;
  eventType: string;
  eventVisibility: EventDraft["visibility"];
  eventPayload: JsonObject;
  occurredAtGameSecond: number;
}): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${input.operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const aggregateId = socialActorRegistryAggregateIdV1(input.campaignId);
    const nextRevision = input.currentAggregate === null ? 0 : input.currentAggregate.aggregateRevision + 1;
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "social-actor-authority",
      contractVersion: 1,
      commandId: opaqueId(`${input.operation.operationId}:command`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: input.commandType,
      target: {
        aggregateType: SOCIAL_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: input.commandPayload,
      acceptedAtGameSecond: input.occurredAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: input.eventId ?? opaqueId<EventId>(`${input.operation.operationId}:event`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: input.eventType,
      origin: "RULE",
      causation: { kind: "COMMAND", id: command.commandId },
      aggregateRefs: [{
        aggregateType: SOCIAL_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        aggregateRevision: nextRevision
      }],
      visibility: input.eventVisibility,
      occurredAtGameSecond: input.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: input.eventPayload
    };
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
        aggregateType: SOCIAL_ACTOR_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: input.currentAggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(input.nextRegistry)
      }],
      events: [event],
      outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function validateMutationCommand(command: MutateSocialActorCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== SOCIAL_ACTOR_MUTATION_COMMAND_V1) {
    issues.push("mutation contract mismatch");
  }
  if (![command.clientRequestId, command.actorId, command.reason].every(nonEmpty)) {
    issues.push("clientRequestId, actorId and reason are required");
  }
  if (!isGameSecond(command.occurredAtGameSecond)) issues.push("occurredAtGameSecond is invalid");
  if (!validRefs(command.sourceEventRefs, true)) issues.push("sourceEventRefs are required");
  if (command.changes === null || typeof command.changes !== "object") {
    issues.push("changes are required");
    return issues;
  }
  for (const key of [
    "knownFactRefsAdded",
    "beliefsUpserted",
    "relationshipDeltas",
    "reputationMarkersUpserted",
    "debtsAndPromisesUpserted",
    "concernsUpserted",
    "visibilityConstraintsAdded"
  ] as const) {
    if (!Array.isArray(command.changes[key])) issues.push(`${key} must be an array`);
  }
  if (issues.length > 0) return issues;
  if (!validRefs(command.changes.knownFactRefsAdded, false)) issues.push("known fact refs are invalid");
  for (const belief of command.changes.beliefsUpserted) {
    if (
      !nonEmpty(belief.beliefId) ||
      !nonEmpty(belief.claim) ||
      !["LOW", "MEDIUM", "HIGH"].includes(belief.confidence) ||
      typeof belief.mayBeFalse !== "boolean" ||
      !validRefs(belief.sourceRefs, true)
    ) {
      issues.push("belief is invalid");
    }
  }
  for (const delta of command.changes.relationshipDeltas) {
    if (
      !nonEmpty(delta.targetActorId) ||
      ![delta.trust, delta.affinity, delta.fear, delta.debt].every(validDelta) ||
      !validRefs(delta.sourceRefs, true)
    ) issues.push("relationship delta is invalid");
  }
  for (const concern of command.changes.concernsUpserted) {
    if (!validateConcern(concern)) issues.push(`concern ${concern.concernId || "<missing>"} is invalid`);
  }
  for (const marker of command.changes.reputationMarkersUpserted) {
    if (
      !nonEmpty(marker.markerId) ||
      !nonEmpty(marker.scopeRef) ||
      !nonEmpty(marker.label) ||
      !validRefs(marker.sourceRefs, true)
    ) issues.push("reputation marker is invalid");
  }
  for (const record of command.changes.debtsAndPromisesUpserted) {
    if (
      !nonEmpty(record.recordId) ||
      !nonEmpty(record.targetRef) ||
      !["DEBT", "PROMISE"].includes(record.kind) ||
      !nonEmpty(record.text) ||
      !validRefs(record.sourceRefs, true)
    ) issues.push("debt or promise is invalid");
  }
  if (!validRefs(command.changes.visibilityConstraintsAdded, false)) {
    issues.push("visibility constraints are invalid");
  }
  return issues;
}

function validateConcern(concern: SocialActorConcernV1): boolean {
  return nonEmpty(concern.concernId) &&
    ["ACTIVE", "RESOLVED", "CANCELLED"].includes(concern.status) &&
    nonEmpty(concern.privateObjective) &&
    nonEmpty(concern.publicActionHint) &&
    ["SPEAK", "MOVE", "SIGNAL", "INTERACT_WITH_SCENE"].includes(concern.actKind) &&
    Number.isInteger(concern.urgency) &&
    concern.urgency >= 0 &&
    concern.urgency <= 100 &&
    isGameSecond(concern.availableFromGameSecond) &&
    (concern.expiresAtGameSecond === null || isGameSecond(concern.expiresAtGameSecond)) &&
    (concern.expiresAtGameSecond === null || concern.expiresAtGameSecond >= concern.availableFromGameSecond) &&
    validRefs(concern.targetRefs, true) &&
    concern.targetRefs.every(ref => /^(?:actor|location|object):[^\s]+$/u.test(ref)) &&
    validRefs(concern.sourceRefs, true) &&
    isGameSecond(concern.minimumIntervalSeconds) &&
    (concern.lastExecutedAtGameSecond === null || isGameSecond(concern.lastExecutedAtGameSecond)) &&
    Number.isInteger(concern.executionCount) &&
    concern.executionCount >= 0;
}

function validateBoundaryCommand(command: SocialLocalInitiativeBoundaryCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== SOCIAL_LOCAL_INITIATIVE_CONTRACT_V1) {
    issues.push("boundary contract mismatch");
  }
  if (![command.clientRequestId, command.sceneId, command.playerActorId].every(nonEmpty)) {
    issues.push("boundary identities are required");
  }
  if (!["SCENE_ENTRY", "LOCAL_EVENT_COMPLETED", "NARRATIVE_TURN_PROGRESSED", "LOCAL_TIME_BOUNDARY"].includes(command.boundaryKind)) {
    issues.push("boundary kind is invalid");
  }
  if (!Array.isArray(command.presentActorIds) || command.presentActorIds.some(actorId => !nonEmpty(actorId))) {
    issues.push("present actor ids are invalid");
  }
  if (!isGameSecond(command.occurredAtGameSecond)) issues.push("occurredAtGameSecond is invalid");
  return issues;
}

function restoreMutationResult(operation: OperationRecord): Result<SocialActorMutationResultV1> {
  const result = operation.resultPayload as SocialActorMutationResultV1 | null;
  return result?.schemaVersion === 1 && result.actor !== undefined
    ? { ok: true, value: { ...result, replayed: true } }
    : { ok: false, error: coreError("PERSISTENCE_FAILURE", "social.actor-mutation-result-missing") };
}

function restoreInitiativeResult(operation: OperationRecord): Result<SocialLocalInitiativeResultV1> {
  const result = operation.resultPayload as SocialLocalInitiativeResultV1 | null;
  return result?.schemaVersion === 1 && (result.status === "CALM" || result.initiative !== null)
    ? { ok: true, value: { ...result, replayed: true } }
    : { ok: false, error: coreError("PERSISTENCE_FAILURE", "social.local-initiative-result-missing") };
}

function upsertBy<T>(current: T[], updates: T[], key: (value: T) => string): T[] {
  const values = new Map(current.map(value => [key(value), cloneJson(value as JsonObject) as T]));
  for (const update of updates) values.set(key(update), cloneJson(update as JsonObject) as T);
  return [...values.values()].sort((left, right) => key(left).localeCompare(key(right)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function validRefs(value: unknown, requireOne: boolean): value is string[] {
  return Array.isArray(value) &&
    (!requireOne || value.length > 0) &&
    value.every(ref => nonEmpty(ref));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validDelta(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= -100 && Number(value) <= 100;
}

function isGameSecond(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
