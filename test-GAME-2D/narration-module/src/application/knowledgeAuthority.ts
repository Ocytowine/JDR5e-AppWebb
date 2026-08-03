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
  ACTOR_KNOWLEDGE_ACQUISITION_CONTRACT_V1,
  buildHeardKnowledgeAcquisitionsV1,
  validateActorClaimPerspectiveV1,
  validateActorKnowledgeAcquisitionV1,
  validateKnowledgeClaimV1,
  validateTestimonyRecordV1,
  type ActorKnowledgeAcquisitionV1,
  type ActorClaimPerspectiveV1,
  type KnowledgeClaimV1,
  type TestimonyRecordV1
} from "./knowledgeClaims";
import {
  KNOWLEDGE_SUBJECT_REGISTRY_CONTRACT_V1,
  validateKnowledgeSubjectDossierV1,
  type KnowledgeSubjectDossierV1,
  type KnowledgeSubjectRegistryV1
} from "./knowledgeSubjects";

export const TESTIMONY_REGISTRY_CONTRACT_V1 = "testimony-registry/1" as const;
export const ACTOR_KNOWLEDGE_REGISTRY_CONTRACT_V1 = "actor-knowledge-registry/1" as const;
export const ACTOR_PERSPECTIVE_REGISTRY_CONTRACT_V1 = "actor-perspective-registry/1" as const;
export const RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1 = "record-attributed-testimony/1" as const;
export const TESTIMONY_REGISTRY_AGGREGATE_TYPE_V1 = "narrative.testimony-registry" as const;
export const ACTOR_KNOWLEDGE_REGISTRY_AGGREGATE_TYPE_V1 = "actor.knowledge-registry" as const;
export const ACTOR_PERSPECTIVE_REGISTRY_AGGREGATE_TYPE_V1 = "actor.claim-perspective-registry" as const;
export const KNOWLEDGE_SUBJECT_REGISTRY_AGGREGATE_TYPE_V1 = "narrative.knowledge-subject-registry" as const;

export interface TestimonyRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof TESTIMONY_REGISTRY_CONTRACT_V1;
  campaignId: string;
  claims: KnowledgeClaimV1[];
  testimonies: TestimonyRecordV1[];
  version: number;
}

export interface ActorKnowledgeRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof ACTOR_KNOWLEDGE_REGISTRY_CONTRACT_V1;
  campaignId: string;
  actorRef: string;
  acquisitions: ActorKnowledgeAcquisitionV1[];
  version: number;
}

export interface ActorPerspectiveRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof ACTOR_PERSPECTIVE_REGISTRY_CONTRACT_V1;
  campaignId: string;
  actorRef: string;
  perspectives: ActorClaimPerspectiveV1[];
  version: number;
}

export interface RecordAttributedTestimonyCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1;
  clientRequestId: string;
  sourceOperationId: string;
  occurredAtGameSecond: number;
  claims: KnowledgeClaimV1[];
  subjects: KnowledgeSubjectDossierV1[];
  perspectives: ActorClaimPerspectiveV1[];
  testimony: TestimonyRecordV1;
}

export interface RecordAttributedTestimonyResultV1 extends JsonObject {
  schemaVersion: 1;
  testimonyRef: string;
  audienceActorRefs: string[];
  acquiredClaimRefs: string[];
  commitId: string;
  replayed: boolean;
}

export interface ActorKnowledgeProjectionItemV1 extends JsonObject {
  schemaVersion: 1;
  claimRef: string;
  subjectRef: string;
  subjectKind: string;
  subjectLabel: string | null;
  proposition: string;
  status: ActorKnowledgeAcquisitionV1["status"];
  attributedSpeakerRefs: string[];
  channelRefs: string[];
  assertsObjectiveTruth: false;
}

export interface ActorKnowledgeProjectionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: "actor-knowledge-projection/1";
  actorRef: string;
  items: ActorKnowledgeProjectionItemV1[];
  authority: "ACTOR_SCOPED_KNOWLEDGE_ONLY";
  version: 1;
}

export function testimonyRegistryAggregateIdV1(campaignId: CampaignId): AggregateId {
  return opaqueId<AggregateId>(`agg-testimonies:${campaignId}`);
}

export function actorKnowledgeRegistryAggregateIdV1(campaignId: CampaignId, actorRef: string): AggregateId {
  return opaqueId<AggregateId>(`agg-knowledge:${campaignId}:${actorRef}`);
}

export function actorPerspectiveRegistryAggregateIdV1(campaignId: CampaignId, actorRef: string): AggregateId {
  return opaqueId<AggregateId>(`agg-perspectives:${campaignId}:${actorRef}`);
}

export function knowledgeSubjectRegistryAggregateIdV1(campaignId: CampaignId): AggregateId {
  return opaqueId<AggregateId>(`agg-knowledge-subjects:${campaignId}`);
}

export async function loadKnowledgeSubjectRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: KnowledgeSubjectRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    KNOWLEDGE_SUBJECT_REGISTRY_AGGREGATE_TYPE_V1,
    knowledgeSubjectRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: emptyKnowledgeSubjectRegistry(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<KnowledgeSubjectRegistryV1>;
  if (
    state.schemaVersion !== 1 ||
    state.contractVersion !== KNOWLEDGE_SUBJECT_REGISTRY_CONTRACT_V1 ||
    state.campaignId !== campaignId ||
    !Array.isArray(state.subjects) ||
    state.subjects.some(subject => validateKnowledgeSubjectDossierV1(subject).length > 0)
  ) return invalid("knowledge.subject-registry-invalid", ["knowledge subject registry payload is invalid"]);
  return { ok: true, value: { aggregate: aggregate.value, state: state as KnowledgeSubjectRegistryV1 } };
}

export async function loadTestimonyRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId
): Promise<Result<{ aggregate: AggregateRecord | null; state: TestimonyRegistryV1 }>> {
  const aggregate = await repository.getAggregate(
    campaignId,
    TESTIMONY_REGISTRY_AGGREGATE_TYPE_V1,
    testimonyRegistryAggregateIdV1(campaignId)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: emptyTestimonyRegistry(campaignId) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<TestimonyRegistryV1>;
  if (
    state.schemaVersion !== 1 ||
    state.contractVersion !== TESTIMONY_REGISTRY_CONTRACT_V1 ||
    state.campaignId !== campaignId ||
    !Array.isArray(state.claims) ||
    state.claims.some(claim => !validateKnowledgeClaimV1(claim).ok) ||
    !Array.isArray(state.testimonies) ||
    state.testimonies.some(testimony => !validateTestimonyRecordV1(testimony).ok)
  ) return invalid("knowledge.testimony-registry-invalid", ["testimony registry payload is invalid"]);
  return { ok: true, value: { aggregate: aggregate.value, state: state as TestimonyRegistryV1 } };
}

export async function loadActorKnowledgeRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId,
  actorRef: string
): Promise<Result<{ aggregate: AggregateRecord | null; state: ActorKnowledgeRegistryV1 }>> {
  const refIssues: string[] = [];
  if (!canonicalRef(actorRef)) refIssues.push("actorRef must be a canonical ref");
  if (refIssues.length > 0) return invalid("knowledge.actor-ref-invalid", refIssues);
  const aggregate = await repository.getAggregate(
    campaignId,
    ACTOR_KNOWLEDGE_REGISTRY_AGGREGATE_TYPE_V1,
    actorKnowledgeRegistryAggregateIdV1(campaignId, actorRef)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: emptyActorKnowledgeRegistry(campaignId, actorRef) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<ActorKnowledgeRegistryV1>;
  if (
    state.schemaVersion !== 1 ||
    state.contractVersion !== ACTOR_KNOWLEDGE_REGISTRY_CONTRACT_V1 ||
    state.campaignId !== campaignId ||
    state.actorRef !== actorRef ||
    !Array.isArray(state.acquisitions) ||
    state.acquisitions.some(acquisition =>
      acquisition.actorRef !== actorRef || !validateActorKnowledgeAcquisitionV1(acquisition).ok
    )
  ) return invalid("knowledge.actor-registry-invalid", ["actor knowledge registry payload is invalid"]);
  return { ok: true, value: { aggregate: aggregate.value, state: state as ActorKnowledgeRegistryV1 } };
}

export async function loadActorPerspectiveRegistryV1(
  repository: CampaignRepository,
  campaignId: CampaignId,
  actorRef: string
): Promise<Result<{ aggregate: AggregateRecord | null; state: ActorPerspectiveRegistryV1 }>> {
  if (!canonicalRef(actorRef)) return invalid("knowledge.actor-ref-invalid", ["actorRef must be a canonical ref"]);
  const aggregate = await repository.getAggregate(
    campaignId,
    ACTOR_PERSPECTIVE_REGISTRY_AGGREGATE_TYPE_V1,
    actorPerspectiveRegistryAggregateIdV1(campaignId, actorRef)
  );
  if (!aggregate.ok) {
    return aggregate.error.code === "NOT_FOUND"
      ? { ok: true, value: { aggregate: null, state: emptyActorPerspectiveRegistry(campaignId, actorRef) } }
      : aggregate;
  }
  const state = aggregate.value.payload as Partial<ActorPerspectiveRegistryV1>;
  if (
    state.schemaVersion !== 1 ||
    state.contractVersion !== ACTOR_PERSPECTIVE_REGISTRY_CONTRACT_V1 ||
    state.campaignId !== campaignId ||
    state.actorRef !== actorRef ||
    !Array.isArray(state.perspectives) ||
    state.perspectives.some(perspective => !validateActorClaimPerspectiveV1(perspective).ok)
  ) return invalid("knowledge.actor-perspective-registry-invalid", ["actor perspective registry payload is invalid"]);
  return { ok: true, value: { aggregate: aggregate.value, state: state as ActorPerspectiveRegistryV1 } };
}

export async function recordAttributedTestimonyV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  command: RecordAttributedTestimonyCommandV1;
}): Promise<Result<RecordAttributedTestimonyResultV1>> {
  const issues = validateRecordCommand(input.command);
  if (issues.length > 0) return invalid("knowledge.testimony-command-invalid", issues);
  const operationId = opaqueId<OperationId>(`record-testimony:${input.command.clientRequestId}`);
  const requestFingerprint = await computeRequestFingerprint("knowledge.testimony.record", 1, input.command);
  const existing = await input.repository.getOperation(operationId);
  if (existing.ok && existing.value.requestFingerprint !== requestFingerprint) {
    return { ok: false, error: coreError("IDEMPOTENCY_CONFLICT", "knowledge.testimony-request-conflict") };
  }
  if (existing.ok && existing.value.phase === "COMPLETED") return restoreResult(existing.value);
  if (existing.ok) return invalid("knowledge.testimony-operation-incomplete", ["operation already exists and is not completed"]);
  if (existing.error.code !== "NOT_FOUND") return existing;

  const sourceOperation = await input.repository.getOperation(
    opaqueId<OperationId>(input.command.sourceOperationId)
  );
  if (!sourceOperation.ok) return sourceOperation;
  if (
    sourceOperation.value.campaignId !== input.campaignId ||
    sourceOperation.value.phase !== "COMPLETED" ||
    input.command.testimony.operationRef !== `operation:${input.command.sourceOperationId}`
  ) return invalid("knowledge.testimony-source-operation-invalid", ["a completed source operation from the same campaign is required"]);

  const testimonyLoaded = await loadTestimonyRegistryV1(input.repository, input.campaignId);
  if (!testimonyLoaded.ok) return testimonyLoaded;
  const subjectLoaded = await loadKnowledgeSubjectRegistryV1(input.repository, input.campaignId);
  if (!subjectLoaded.ok) return subjectLoaded;
  const perspectiveLoaded = await loadActorPerspectiveRegistryV1(
    input.repository,
    input.campaignId,
    input.command.testimony.speakerActorRef
  );
  if (!perspectiveLoaded.ok) return perspectiveLoaded;
  const audienceRefs = [...new Set(input.command.testimony.audienceActorRefs)].sort();
  const actorLoaded = await Promise.all(audienceRefs.map(actorRef =>
    loadActorKnowledgeRegistryV1(input.repository, input.campaignId, actorRef)
  ));
  const actorFailure = actorLoaded.find(result => !result.ok);
  if (actorFailure !== undefined && !actorFailure.ok) return actorFailure;

  const mergedTestimony = mergeTestimonyRegistry(testimonyLoaded.value.state, input.command);
  if (!mergedTestimony.ok) return mergedTestimony;
  const mergedSubjects = mergeSubjectRegistry(subjectLoaded.value.state, input.command);
  if (!mergedSubjects.ok) return mergedSubjects;
  const mergedPerspectives = mergePerspectiveRegistry(perspectiveLoaded.value.state, input.command);
  if (!mergedPerspectives.ok) return mergedPerspectives;
  const nextActorStates: Array<{
    actorRef: string;
    aggregate: AggregateRecord | null;
    state: ActorKnowledgeRegistryV1;
  }> = [];
  for (const [index, actorRef] of audienceRefs.entries()) {
    const heard = buildHeardKnowledgeAcquisitionsV1({ actorRef, testimony: input.command.testimony });
    if (!heard.ok) return invalid("knowledge.testimony-acquisition-invalid", heard.issues);
    const loaded = actorLoaded[index];
    if (loaded === undefined || !loaded.ok) return invalid("knowledge.actor-registry-missing", [actorRef]);
    nextActorStates.push({
      actorRef,
      aggregate: loaded.value.aggregate,
      state: mergeActorKnowledge(loaded.value.state, heard.acquisitions)
    });
  }

  const started = await beginKnowledgeOperation(input.repository, input.campaignId, operationId, input.command);
  if (!started.ok) return started;
  const committed = await commitKnowledge(
    input,
    started.value,
    testimonyLoaded.value,
    mergedTestimony.value,
    subjectLoaded.value,
    mergedSubjects.value,
    perspectiveLoaded.value,
    mergedPerspectives.value,
    nextActorStates
  );
  if (!committed.ok) return committed;
  const result: RecordAttributedTestimonyResultV1 = {
    schemaVersion: 1,
    testimonyRef: input.command.testimony.testimonyRef,
    audienceActorRefs: audienceRefs,
    acquiredClaimRefs: input.command.testimony.claims.map(link => link.claimRef),
    commitId: committed.value.commitId,
    replayed: false
  };
  const completed = await input.repository.completePresentation(operationId, "COMMITTED_RENDERED", 1, result);
  return completed.ok ? { ok: true, value: result } : completed;
}

export function projectActorKnowledgeV1(input: {
  testimonyRegistry: TestimonyRegistryV1;
  actorKnowledge: ActorKnowledgeRegistryV1;
}): ActorKnowledgeProjectionV1 {
  const claims = new Map(input.testimonyRegistry.claims.map(claim => [claim.claimRef, claim]));
  const testimoniesByRef = new Map(input.testimonyRegistry.testimonies.map(testimony => [testimony.testimonyRef, testimony]));
  const grouped = new Map<string, ActorKnowledgeProjectionItemV1>();
  for (const acquisition of input.actorKnowledge.acquisitions) {
    const claim = claims.get(acquisition.claimRef);
    if (claim === undefined) continue;
    const testimony = testimoniesByRef.get(acquisition.channelRef);
    const current = grouped.get(claim.claimRef);
    const nextStatus = strongerStatus(current?.status ?? null, acquisition.status);
    grouped.set(claim.claimRef, {
      schemaVersion: 1,
      claimRef: claim.claimRef,
      subjectRef: claim.subject.subjectRef,
      subjectKind: claim.subject.subjectKind,
      subjectLabel: claim.subject.publicLabel,
      proposition: claim.proposition,
      status: nextStatus,
      attributedSpeakerRefs: [...new Set([
        ...(current?.attributedSpeakerRefs ?? []),
        ...(testimony === undefined ? [] : [testimony.speakerActorRef])
      ])].sort(),
      channelRefs: [...new Set([...(current?.channelRefs ?? []), acquisition.channelRef])].sort(),
      assertsObjectiveTruth: false
    });
  }
  return {
    schemaVersion: 1,
    contractVersion: "actor-knowledge-projection/1",
    actorRef: input.actorKnowledge.actorRef,
    items: [...grouped.values()].sort((left, right) => left.claimRef.localeCompare(right.claimRef)),
    authority: "ACTOR_SCOPED_KNOWLEDGE_ONLY",
    version: 1
  };
}

function emptyTestimonyRegistry(campaignId: CampaignId): TestimonyRegistryV1 {
  return { schemaVersion: 1, contractVersion: TESTIMONY_REGISTRY_CONTRACT_V1, campaignId, claims: [], testimonies: [], version: 1 };
}

function emptyKnowledgeSubjectRegistry(campaignId: CampaignId): KnowledgeSubjectRegistryV1 {
  return { schemaVersion: 1, contractVersion: KNOWLEDGE_SUBJECT_REGISTRY_CONTRACT_V1, campaignId, subjects: [], version: 1 };
}

function emptyActorKnowledgeRegistry(campaignId: CampaignId, actorRef: string): ActorKnowledgeRegistryV1 {
  return { schemaVersion: 1, contractVersion: ACTOR_KNOWLEDGE_REGISTRY_CONTRACT_V1, campaignId, actorRef, acquisitions: [], version: 1 };
}

function emptyActorPerspectiveRegistry(campaignId: CampaignId, actorRef: string): ActorPerspectiveRegistryV1 {
  return { schemaVersion: 1, contractVersion: ACTOR_PERSPECTIVE_REGISTRY_CONTRACT_V1, campaignId, actorRef, perspectives: [], version: 1 };
}

function mergeTestimonyRegistry(
  current: TestimonyRegistryV1,
  command: RecordAttributedTestimonyCommandV1
): Result<TestimonyRegistryV1> {
  const claims = new Map(current.claims.map(claim => [claim.claimRef, claim]));
  for (const claim of command.claims) {
    const prior = claims.get(claim.claimRef);
    if (prior !== undefined && !jsonEquivalent(prior, claim)) {
      return invalid("knowledge.claim-identity-conflict", [claim.claimRef]);
    }
    claims.set(claim.claimRef, cloneJson(claim));
  }
  for (const link of command.testimony.claims) {
    if (!claims.has(link.claimRef)) return invalid("knowledge.testimony-claim-missing", [link.claimRef]);
  }
  const testimonies = new Map(current.testimonies.map(testimony => [testimony.testimonyRef, testimony]));
  const priorTestimony = testimonies.get(command.testimony.testimonyRef);
  if (priorTestimony !== undefined && !jsonEquivalent(priorTestimony, command.testimony)) {
    return invalid("knowledge.testimony-identity-conflict", [command.testimony.testimonyRef]);
  }
  testimonies.set(command.testimony.testimonyRef, cloneJson(command.testimony));
  return {
    ok: true,
    value: {
      ...current,
      claims: [...claims.values()].sort((left, right) => left.claimRef.localeCompare(right.claimRef)),
      testimonies: [...testimonies.values()].sort((left, right) => left.testimonyRef.localeCompare(right.testimonyRef)),
      version: current.version + 1
    }
  };
}

function mergeSubjectRegistry(
  current: KnowledgeSubjectRegistryV1,
  command: RecordAttributedTestimonyCommandV1
): Result<KnowledgeSubjectRegistryV1> {
  const subjects = new Map(current.subjects.map(dossier => [dossier.subject.subjectRef, dossier]));
  for (const dossier of command.subjects) {
    const prior = subjects.get(dossier.subject.subjectRef);
    if (prior !== undefined && !jsonEquivalent(prior, dossier)) {
      return invalid("knowledge.subject-identity-conflict", [dossier.subject.subjectRef]);
    }
    subjects.set(dossier.subject.subjectRef, cloneJson(dossier));
  }
  for (const claim of command.claims) {
    const dossier = subjects.get(claim.subject.subjectRef);
    if (dossier === undefined || !jsonEquivalent(dossier.subject, claim.subject)) {
      return invalid("knowledge.claim-subject-missing", [claim.subject.subjectRef]);
    }
  }
  return {
    ok: true,
    value: {
      ...current,
      subjects: [...subjects.values()].sort((left, right) => left.subject.subjectRef.localeCompare(right.subject.subjectRef)),
      version: current.version + 1
    }
  };
}

function mergeActorKnowledge(
  current: ActorKnowledgeRegistryV1,
  acquisitions: ActorKnowledgeAcquisitionV1[]
): ActorKnowledgeRegistryV1 {
  const merged = new Map(current.acquisitions.map(acquisition => [acquisition.acquisitionRef, acquisition]));
  acquisitions.forEach(acquisition => merged.set(acquisition.acquisitionRef, cloneJson(acquisition)));
  return {
    ...current,
    acquisitions: [...merged.values()].sort((left, right) => left.acquisitionRef.localeCompare(right.acquisitionRef)),
    version: current.version + 1
  };
}

function mergePerspectiveRegistry(
  current: ActorPerspectiveRegistryV1,
  command: RecordAttributedTestimonyCommandV1
): Result<ActorPerspectiveRegistryV1> {
  if (command.perspectives.some(perspective => perspective.actorRef !== current.actorRef)) {
    return invalid("knowledge.perspective-owner-mismatch", ["every perspective must belong to the testimony speaker"]);
  }
  const merged = new Map(current.perspectives.map(perspective => [perspective.perspectiveRef, perspective]));
  for (const perspective of command.perspectives) {
    const prior = merged.get(perspective.perspectiveRef);
    if (prior !== undefined && !jsonEquivalent(prior, perspective)) {
      return invalid("knowledge.perspective-identity-conflict", [perspective.perspectiveRef]);
    }
    merged.set(perspective.perspectiveRef, cloneJson(perspective));
  }
  for (const link of command.testimony.claims) {
    const perspective = merged.get(link.privatePerspectiveRef);
    if (perspective === undefined || perspective.claimRef !== link.claimRef) {
      return invalid("knowledge.testimony-perspective-missing", [link.privatePerspectiveRef]);
    }
  }
  return {
    ok: true,
    value: {
      ...current,
      perspectives: [...merged.values()].sort((left, right) => left.perspectiveRef.localeCompare(right.perspectiveRef)),
      version: current.version + 1
    }
  };
}

async function beginKnowledgeOperation(
  repository: CampaignRepository,
  campaignId: CampaignId,
  operationId: OperationId,
  command: RecordAttributedTestimonyCommandV1
): Promise<Result<OperationRecord>> {
  const campaign = await repository.getCampaign(campaignId);
  if (!campaign.ok) return campaign;
  const now = new Date().toISOString();
  const received = await repository.receiveOperation({
    schemaVersion: 1,
    operationId,
    campaignId,
    clientRequestId: opaqueId<RequestId>(command.clientRequestId),
    idempotencyKey: opaqueId<IdempotencyKey>(operationId),
    requestFingerprint: await computeRequestFingerprint("knowledge.testimony.record", 1, command),
    operationKind: "knowledge.testimony.record",
    requestPayloadSchemaVersion: 1,
    requestPayload: cloneJson(command),
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
  const preparing = await repository.transitionOperation(operationId, "RECEIVED", "PREPARING");
  if (!preparing.ok) return preparing;
  return repository.transitionOperation(operationId, "PREPARING", "READY_TO_COMMIT");
}

async function commitKnowledge(
  input: { repository: CampaignRepository; campaignId: CampaignId; command: RecordAttributedTestimonyCommandV1 },
  operation: OperationRecord,
  currentTestimony: { aggregate: AggregateRecord | null; state: TestimonyRegistryV1 },
  nextTestimony: TestimonyRegistryV1,
  currentSubjects: { aggregate: AggregateRecord | null; state: KnowledgeSubjectRegistryV1 },
  nextSubjects: KnowledgeSubjectRegistryV1,
  currentPerspectives: { aggregate: AggregateRecord | null; state: ActorPerspectiveRegistryV1 },
  nextPerspectives: ActorPerspectiveRegistryV1,
  nextActors: Array<{ actorRef: string; aggregate: AggregateRecord | null; state: ActorKnowledgeRegistryV1 }>
): Promise<Result<{ commitId: CommitId }>> {
  const lease = await input.repository.acquireWriterLease(
    input.campaignId,
    opaqueId<WriterId>(`${operation.operationId}:writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const testimonyAggregateId = testimonyRegistryAggregateIdV1(input.campaignId);
    const perspectiveAggregateId = actorPerspectiveRegistryAggregateIdV1(
      input.campaignId,
      input.command.testimony.speakerActorRef
    );
    const subjectAggregateId = knowledgeSubjectRegistryAggregateIdV1(input.campaignId);
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "knowledge-authority",
      contractVersion: 1,
      commandId: opaqueId(`${operation.operationId}:command`),
      campaignId: input.campaignId,
      operationId: operation.operationId,
      commandType: "knowledge.testimony.record",
      target: {
        aggregateType: TESTIMONY_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: testimonyAggregateId,
        expectedAggregateRevision: currentTestimony.aggregate?.aggregateRevision ?? null
      },
      payloadSchemaVersion: 1,
      payload: {
        testimonyRef: input.command.testimony.testimonyRef,
        speakerActorRef: input.command.testimony.speakerActorRef,
        audienceActorRefs: [...input.command.testimony.audienceActorRefs],
        sourceOperationId: input.command.sourceOperationId
      },
      acceptedAtGameSecond: input.command.occurredAtGameSecond
    };
    const aggregateRefs = [{
      aggregateType: TESTIMONY_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: testimonyAggregateId,
      aggregateRevision: currentTestimony.aggregate === null ? 0 : currentTestimony.aggregate.aggregateRevision + 1
    }, {
      aggregateType: KNOWLEDGE_SUBJECT_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: subjectAggregateId,
      aggregateRevision: currentSubjects.aggregate === null ? 0 : currentSubjects.aggregate.aggregateRevision + 1
    }, {
      aggregateType: ACTOR_PERSPECTIVE_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: perspectiveAggregateId,
      aggregateRevision: currentPerspectives.aggregate === null ? 0 : currentPerspectives.aggregate.aggregateRevision + 1
    }, ...nextActors.map(actor => ({
      aggregateType: ACTOR_KNOWLEDGE_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: actorKnowledgeRegistryAggregateIdV1(input.campaignId, actor.actorRef),
      aggregateRevision: actor.aggregate === null ? 0 : actor.aggregate.aggregateRevision + 1
    }))];
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${operation.operationId}:event`),
      campaignId: input.campaignId,
      operationId: operation.operationId,
      eventType: "knowledge.testimony.recorded",
      origin: "SYSTEM",
      causation: { kind: "OPERATION", id: operation.operationId },
      aggregateRefs,
      visibility: {
        scope: "ACTOR_SCOPED",
        actorIds: input.command.testimony.audienceActorRefs.map(actorIdFromRef)
      },
      occurredAtGameSecond: input.command.occurredAtGameSecond,
      payloadSchemaVersion: 1,
      payload: {
        testimonyRef: input.command.testimony.testimonyRef,
        speakerActorRef: input.command.testimony.speakerActorRef,
        audienceCount: input.command.testimony.audienceActorRefs.length,
        claimCount: input.command.testimony.claims.length,
        acquisitionStatus: "HEARD",
        assertsObjectiveTruth: false
      }
    };
    const request: CommitRequest = {
      campaignId: input.campaignId,
      operationId: operation.operationId,
      commitId: opaqueId<CommitId>(`${operation.operationId}:commit`),
      idempotencyKey: operation.idempotencyKey,
      requestFingerprint: operation.requestFingerprint,
      expectedCampaignRevision: operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: TESTIMONY_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: testimonyAggregateId,
        expectedAggregateRevision: currentTestimony.aggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(nextTestimony)
      }, {
        aggregateType: KNOWLEDGE_SUBJECT_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: subjectAggregateId,
        expectedAggregateRevision: currentSubjects.aggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(nextSubjects)
      }, {
        aggregateType: ACTOR_PERSPECTIVE_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: perspectiveAggregateId,
        expectedAggregateRevision: currentPerspectives.aggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(nextPerspectives)
      }, ...nextActors.map(actor => ({
        aggregateType: ACTOR_KNOWLEDGE_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId: actorKnowledgeRegistryAggregateIdV1(input.campaignId, actor.actorRef),
        expectedAggregateRevision: actor.aggregate?.aggregateRevision ?? null,
        payloadSchemaVersion: 1,
        payload: cloneJson(actor.state)
      }))],
      events: [event],
      outboxTasks: []
    };
    const committed = await input.repository.commit(request);
    return committed.ok ? { ok: true, value: { commitId: committed.value.commitId } } : committed;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

function validateRecordCommand(command: RecordAttributedTestimonyCommandV1): string[] {
  const issues: string[] = [];
  if (command.schemaVersion !== 1 || command.contractVersion !== RECORD_ATTRIBUTED_TESTIMONY_COMMAND_V1) issues.push("record testimony contract mismatch");
  if (!command.clientRequestId.trim() || !command.sourceOperationId.trim()) issues.push("clientRequestId and sourceOperationId are required");
  if (!Number.isInteger(command.occurredAtGameSecond) || command.occurredAtGameSecond < 0) issues.push("occurredAtGameSecond is invalid");
  if (!Array.isArray(command.claims) || command.claims.length === 0) issues.push("claims are required");
  else command.claims.forEach((claim, index) => {
    const validation = validateKnowledgeClaimV1(claim);
    if (!validation.ok) validation.issues.forEach(issue => issues.push(`claims[${index}]: ${issue}`));
  });
  if (!Array.isArray(command.subjects) || command.subjects.length === 0) issues.push("subjects are required");
  else command.subjects.forEach((subject, index) => validateKnowledgeSubjectDossierV1(subject)
    .forEach(issue => issues.push(`subjects[${index}]: ${issue}`)));
  if (!Array.isArray(command.perspectives) || command.perspectives.length === 0) issues.push("perspectives are required");
  else command.perspectives.forEach((perspective, index) => {
    const validation = validateActorClaimPerspectiveV1(perspective);
    if (!validation.ok) validation.issues.forEach(issue => issues.push(`perspectives[${index}]: ${issue}`));
  });
  const testimonyValidation = validateTestimonyRecordV1(command.testimony);
  if (!testimonyValidation.ok) testimonyValidation.issues.forEach(issue => issues.push(`testimony: ${issue}`));
  if (new Set(command.claims.map(claim => claim.claimRef)).size !== command.claims.length) issues.push("claims must not contain duplicate claimRef values");
  if (new Set(command.perspectives.map(perspective => perspective.perspectiveRef)).size !== command.perspectives.length) issues.push("perspectives must not contain duplicate perspectiveRef values");
  return issues;
}

function restoreResult(operation: OperationRecord): Result<RecordAttributedTestimonyResultV1> {
  const result = operation.resultPayload as Partial<RecordAttributedTestimonyResultV1> | null;
  if (
    result?.schemaVersion !== 1 ||
    typeof result.testimonyRef !== "string" ||
    !Array.isArray(result.audienceActorRefs) ||
    !Array.isArray(result.acquiredClaimRefs) ||
    typeof result.commitId !== "string"
  ) return invalid("knowledge.testimony-result-invalid", ["completed operation result is invalid"]);
  return { ok: true, value: { ...result, replayed: true } as RecordAttributedTestimonyResultV1 };
}

function strongerStatus(
  current: ActorKnowledgeAcquisitionV1["status"] | null,
  candidate: ActorKnowledgeAcquisitionV1["status"]
): ActorKnowledgeAcquisitionV1["status"] {
  if (current === null) return candidate;
  const rank: Record<ActorKnowledgeAcquisitionV1["status"], number> = { HEARD: 0, OBSERVED: 1, CONFIRMED: 2, REFUTED: 2 };
  return rank[candidate] > rank[current] ? candidate : current;
}

function canonicalRef(value: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(value);
}

function actorIdFromRef(actorRef: string): string {
  return actorRef.startsWith("actor:") ? actorRef.slice("actor:".length) : actorRef;
}

function jsonEquivalent(left: JsonObject, right: JsonObject): boolean {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]));
  }
  return value;
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return { ok: false, error: coreError("VALIDATION_FAILED", messageKey, { issues }) };
}
