import {
  cloneJson,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CommandId,
  type CommitId,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type GameSecond,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type WriterLease
} from "../core";
import type { NarrativeLoreBuildCatalogV1 } from "../context";

export const CAMPAIGN_FACT_REGISTRY_AGGREGATE_TYPE_V1 = "campaign.fact-registry" as const;
export const CAMPAIGN_FACT_REGISTRY_CONTRACT_VERSION_V1 = "campaign-fact-registry/1" as const;
export const NARRATIVE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1 = "campaign.narrative-actor-registry" as const;
export const NARRATIVE_ACTOR_REGISTRY_CONTRACT_VERSION_V1 = "narrative-actor-registry/1" as const;
export const CAMPAIGN_FACT_MUTATION_CONTRACT_VERSION_V1 = "campaign-fact-mutation/1" as const;

export type CampaignFactMutationKindV1 = "ASSERT" | "REPLACE" | "INVALIDATE";
export type CampaignFactStatusV1 = "ACTIVE" | "REPLACED" | "INVALIDATED";

export interface NarrativeActorLightReferenceV1 extends JsonObject {
  schemaVersion: 1;
  identityRef: string;
  displayName: string;
  publicRole: string;
  persistenceDepth: "LIGHT_REFERENCE";
  createdByOperationId: string;
  sourceRefs: string[];
  version: 1;
}

export interface NarrativeActorRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof NARRATIVE_ACTOR_REGISTRY_CONTRACT_VERSION_V1;
  campaignId: string;
  actors: NarrativeActorLightReferenceV1[];
  version: number;
}

export interface CampaignFactRecordV1 extends JsonObject {
  schemaVersion: 1;
  factId: string;
  slotKey: string;
  subjectRef: string;
  predicate: string;
  objectKind: "IDENTITY_REF" | "TEXT";
  objectRef: string | null;
  objectText: string;
  cardinality: "SINGLE";
  validFromGameSecond: number;
  validUntilGameSecond: number | null;
  assertedCampaignRevision: number;
  closedAtCampaignRevision: number | null;
  visibility: "PUBLIC";
  knowledgeLevel: "COMMUN" | "LOCAL";
  status: CampaignFactStatusV1;
  supersedesFactId: string | null;
  sourceRefs: string[];
  ownerDomain: "CAMPAIGN_FACT";
  validatorDomains: string[];
  persistenceDepth: "CAMPAIGN_FACT";
  assertedByOperationId: string;
  version: 1;
}

export interface CampaignFactRegistryV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CAMPAIGN_FACT_REGISTRY_CONTRACT_VERSION_V1;
  campaignId: string;
  facts: CampaignFactRecordV1[];
  version: number;
}

export interface CampaignFactMutationCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof CAMPAIGN_FACT_MUTATION_CONTRACT_VERSION_V1;
  clientRequestId: string;
  mutationKind: CampaignFactMutationKindV1;
  subjectRef: string;
  predicate: string;
  objectText: string | null;
  proposedIdentity: {
    identityRef: string;
    displayName: string;
    publicRole: string;
  } | null;
  expectedCurrentFactId: string | null;
  knowledgeLevel: "COMMUN" | "LOCAL";
  sourceRefs: string[];
  validatorDomains: string[];
}

export type PrepareCampaignFactMutationResultV1 =
  | { ok: true; status: "READY"; nextFacts: CampaignFactRegistryV1; nextActors: NarrativeActorRegistryV1; fact: CampaignFactRecordV1 | null; identity: NarrativeActorLightReferenceV1 | null; eventType: "campaign.fact.asserted" | "campaign.fact.replaced" | "campaign.fact.invalidated" }
  | { ok: true; status: "ALREADY_CURRENT"; nextFacts: CampaignFactRegistryV1; nextActors: NarrativeActorRegistryV1; fact: CampaignFactRecordV1; identity: NarrativeActorLightReferenceV1 | null }
  | { ok: false; issues: string[] };

export interface CampaignFactLoreAnchorValidatorV1 {
  validate(command: CampaignFactMutationCommandV1): string[];
}

export interface CampaignFactInformationReadRequestV1 {
  schemaVersion: 1;
  campaignId: string;
  campaignRevision: number;
  subjectRefs: string[];
  temporalScope: "CURRENT" | "PAST" | "FUTURE" | "UNSPECIFIED";
}

export interface CampaignFactInformationReaderV1 {
  listEffectiveFacts(request: CampaignFactInformationReadRequestV1): Promise<CampaignFactRecordV1[]>;
}

export function createCampaignFactLoreAnchorValidatorV1(catalog: NarrativeLoreBuildCatalogV1): CampaignFactLoreAnchorValidatorV1 {
  const entityIds = new Set(catalog.entities.map(entity => entity.entityId));
  const factRefs = new Set(catalog.facts.map(fact => `lore-fact:${fact.fragmentId}`));
  const fragmentRefs = new Set(catalog.fragments.map(fragment => `lore-fragment:${fragment.fragmentId}`));
  return {
    validate(command) {
      const issues: string[] = [];
      const entityId = command.subjectRef.replace(/^lore-entity:/u, "");
      if (!entityIds.has(entityId)) issues.push(`unknown lore subject ${command.subjectRef}`);
      for (const ref of command.sourceRefs) {
        if (ref.startsWith("lore-fact:") && !factRefs.has(ref)) issues.push(`unknown lore fact source ${ref}`);
        if (ref.startsWith("lore-fragment:") && !fragmentRefs.has(ref)) issues.push(`unknown lore fragment source ${ref}`);
      }
      if (command.mutationKind === "ASSERT" && !command.sourceRefs.some(ref => factRefs.has(ref) || fragmentRefs.has(ref))) {
        issues.push("initial free fact requires at least one existing lore fact or fragment source");
      }
      return issues;
    }
  };
}

export function campaignFactRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-campaign-facts:${campaignId}`);
}

export function narrativeActorRegistryAggregateIdV1(campaignId: string): AggregateId {
  return opaqueId<AggregateId>(`agg-narrative-actors:${campaignId}`);
}

export function campaignFactSlotKeyV1(subjectRef: string, predicate: string): string {
  return `${subjectRef.trim()}::${predicate.trim()}`;
}

export function createEmptyCampaignFactRegistryV1(campaignId: string): CampaignFactRegistryV1 {
  return { schemaVersion: 1, contractVersion: CAMPAIGN_FACT_REGISTRY_CONTRACT_VERSION_V1, campaignId, facts: [], version: 1 };
}

export function createEmptyNarrativeActorRegistryV1(campaignId: string): NarrativeActorRegistryV1 {
  return { schemaVersion: 1, contractVersion: NARRATIVE_ACTOR_REGISTRY_CONTRACT_VERSION_V1, campaignId, actors: [], version: 1 };
}

export function activeCampaignFactV1(registry: CampaignFactRegistryV1, subjectRef: string, predicate: string): CampaignFactRecordV1 | null {
  const slotKey = campaignFactSlotKeyV1(subjectRef, predicate);
  return registry.facts.find(fact => fact.slotKey === slotKey && fact.status === "ACTIVE") ?? null;
}

export function prepareCampaignFactMutationV1(input: {
  campaignId: string;
  operationId: string;
  occurredAtGameSecond: number;
  resultingCampaignRevision: number;
  command: CampaignFactMutationCommandV1;
  facts: CampaignFactRegistryV1;
  actors: NarrativeActorRegistryV1;
}): PrepareCampaignFactMutationResultV1 {
  const issues = validateMutationInput(input);
  if (issues.length > 0) return { ok: false, issues };
  const { command } = input;
  const slotKey = campaignFactSlotKeyV1(command.subjectRef, command.predicate);
  const current = activeCampaignFactV1(input.facts, command.subjectRef, command.predicate);
  const proposedObjectRef = command.proposedIdentity?.identityRef ?? null;
  const proposedObjectText = command.proposedIdentity?.displayName ?? command.objectText ?? "";

  if (command.mutationKind === "ASSERT" && current !== null) {
    if (current.objectRef !== proposedObjectRef || current.objectText !== proposedObjectText) {
      return { ok: false, issues: ["a different active value already occupies this SINGLE fact slot"] };
    }
    const identity = current.objectRef === null ? null : input.actors.actors.find(actor => actor.identityRef === current.objectRef) ?? null;
    return { ok: true, status: "ALREADY_CURRENT", nextFacts: input.facts, nextActors: input.actors, fact: current, identity };
  }
  if (command.mutationKind !== "ASSERT" && current === null) return { ok: false, issues: ["the requested fact slot has no active fact"] };
  if (command.mutationKind !== "ASSERT" && command.expectedCurrentFactId !== current?.factId) {
    return { ok: false, issues: ["expected current fact does not match the active fact"] };
  }

  let nextActors = input.actors;
  let identity: NarrativeActorLightReferenceV1 | null = null;
  if (command.mutationKind !== "INVALIDATE" && command.proposedIdentity !== null) {
    const existingIdentity = input.actors.actors.find(actor => actor.identityRef === command.proposedIdentity!.identityRef);
    if (existingIdentity && (existingIdentity.displayName !== command.proposedIdentity.displayName || existingIdentity.publicRole !== command.proposedIdentity.publicRole)) {
      return { ok: false, issues: ["identity reference conflicts with an existing light identity"] };
    }
    identity = existingIdentity ?? {
      schemaVersion: 1,
      identityRef: command.proposedIdentity.identityRef,
      displayName: command.proposedIdentity.displayName,
      publicRole: command.proposedIdentity.publicRole,
      persistenceDepth: "LIGHT_REFERENCE",
      createdByOperationId: input.operationId,
      sourceRefs: unique(command.sourceRefs),
      version: 1
    };
    if (!existingIdentity) nextActors = { ...input.actors, actors: [...input.actors.actors, identity], version: input.actors.version + 1 };
  }

  const closedFacts = current === null ? input.facts.facts : input.facts.facts.map(fact => fact.factId === current.factId
    ? { ...fact, status: command.mutationKind === "REPLACE" ? "REPLACED" as const : "INVALIDATED" as const, validUntilGameSecond: input.occurredAtGameSecond, closedAtCampaignRevision: input.resultingCampaignRevision }
    : fact);
  const fact = command.mutationKind === "INVALIDATE" ? null : {
    schemaVersion: 1 as const,
    factId: `campaign-fact:${slotKey}:${input.operationId}`,
    slotKey,
    subjectRef: command.subjectRef,
    predicate: command.predicate,
    objectKind: command.proposedIdentity === null ? "TEXT" as const : "IDENTITY_REF" as const,
    objectRef: proposedObjectRef,
    objectText: proposedObjectText,
    cardinality: "SINGLE" as const,
    validFromGameSecond: input.occurredAtGameSecond,
    validUntilGameSecond: null,
    assertedCampaignRevision: input.resultingCampaignRevision,
    closedAtCampaignRevision: null,
    visibility: "PUBLIC" as const,
    knowledgeLevel: command.knowledgeLevel,
    status: "ACTIVE" as const,
    supersedesFactId: current?.factId ?? null,
    sourceRefs: unique(command.sourceRefs),
    ownerDomain: "CAMPAIGN_FACT" as const,
    validatorDomains: unique(command.validatorDomains),
    persistenceDepth: "CAMPAIGN_FACT" as const,
    assertedByOperationId: input.operationId,
    version: 1 as const
  };
  const nextFacts = {
    ...input.facts,
    facts: fact === null ? closedFacts : [...closedFacts, fact],
    version: input.facts.version + 1
  };
  return {
    ok: true,
    status: "READY",
    nextFacts,
    nextActors,
    fact,
    identity,
    eventType: command.mutationKind === "ASSERT" ? "campaign.fact.asserted" : command.mutationKind === "REPLACE" ? "campaign.fact.replaced" : "campaign.fact.invalidated"
  };
}

export function prepareCampaignFactMutationCommitV1(input: {
  campaignId: string;
  operationId: OperationId;
  idempotencyKey: IdempotencyKey;
  requestFingerprint: string;
  expectedCampaignRevision: number;
  factAggregate: AggregateRecord | null;
  actorAggregate: AggregateRecord | null;
  prepared: Extract<PrepareCampaignFactMutationResultV1, { ok: true; status: "READY" }>;
  command: CampaignFactMutationCommandV1;
  writerLease: WriterLease;
  commitId: CommitId;
  occurredAtGameSecond: GameSecond;
}): { ok: true; value: CommitRequest } | { ok: false; issues: string[] } {
  const factRevision = input.factAggregate?.aggregateRevision ?? null;
  const actorRevision = input.actorAggregate?.aggregateRevision ?? null;
  const factAggregateId = campaignFactRegistryAggregateIdV1(input.campaignId);
  const actorAggregateId = narrativeActorRegistryAggregateIdV1(input.campaignId);
  const actorChanged = input.actorAggregate === null
    ? input.prepared.nextActors.actors.length > 0
    : JSON.stringify(input.actorAggregate.payload) !== JSON.stringify(input.prepared.nextActors);
  const issues: string[] = [];
  if (!input.requestFingerprint.trim()) issues.push("request fingerprint is required");
  if (input.prepared.nextFacts.facts.filter(fact => fact.status === "ACTIVE" && fact.slotKey === campaignFactSlotKeyV1(input.command.subjectRef, input.command.predicate)).length > 1) issues.push("SINGLE fact cardinality violated");
  if (new Set(input.prepared.nextActors.actors.map(actor => actor.identityRef)).size !== input.prepared.nextActors.actors.length) issues.push("duplicate narrative identity");
  if (issues.length > 0) return { ok: false, issues };

  const typedCampaignId = opaqueId<CampaignId>(input.campaignId);
  const factCommandId = opaqueId<CommandId>(`${input.operationId}:command:fact`);
  const acceptedCommands: AcceptedCommandDraft[] = [{
    schemaVersion: 1,
    contractId: "campaign.fact-mutation",
    contractVersion: 1,
    commandId: factCommandId,
    campaignId: typedCampaignId,
    operationId: input.operationId,
    commandType: `campaign.fact.${input.command.mutationKind.toLowerCase()}`,
    target: { aggregateType: CAMPAIGN_FACT_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: factAggregateId, expectedAggregateRevision: factRevision },
    payloadSchemaVersion: 1,
    payload: { subjectRef: input.command.subjectRef, predicate: input.command.predicate, factId: input.prepared.fact?.factId ?? input.command.expectedCurrentFactId },
    acceptedAtGameSecond: input.occurredAtGameSecond
  }];
  const event: EventDraft = {
    schemaVersion: 1,
    eventId: opaqueId<EventId>(`${input.operationId}:event:${input.prepared.eventType}`),
    campaignId: typedCampaignId,
    operationId: input.operationId,
    eventType: input.prepared.eventType,
    origin: "AI_PROPOSAL",
    causation: { kind: "COMMAND", id: factCommandId },
    aggregateRefs: [
      { aggregateType: CAMPAIGN_FACT_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: factAggregateId, aggregateRevision: (factRevision ?? -1) + 1 },
      ...(actorChanged ? [{ aggregateType: NARRATIVE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: actorAggregateId, aggregateRevision: (actorRevision ?? -1) + 1 }] : [])
    ],
    visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
    occurredAtGameSecond: input.occurredAtGameSecond,
    payloadSchemaVersion: 1,
    payload: { subjectRef: input.command.subjectRef, predicate: input.command.predicate, factId: input.prepared.fact?.factId ?? null, objectRef: input.prepared.fact?.objectRef ?? null, objectText: input.prepared.fact?.objectText ?? null, replacedFactId: input.command.expectedCurrentFactId }
  };
  return { ok: true, value: {
    campaignId: typedCampaignId,
    operationId: input.operationId,
    commitId: input.commitId,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: input.requestFingerprint,
    expectedCampaignRevision: input.expectedCampaignRevision,
    writerLease: input.writerLease,
    acceptedCommands,
    aggregateWrites: [
      { aggregateType: CAMPAIGN_FACT_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: factAggregateId, expectedAggregateRevision: factRevision, payloadSchemaVersion: 1, payload: cloneJson(input.prepared.nextFacts) },
      ...(actorChanged ? [{ aggregateType: NARRATIVE_ACTOR_REGISTRY_AGGREGATE_TYPE_V1, aggregateId: actorAggregateId, expectedAggregateRevision: actorRevision, payloadSchemaVersion: 1, payload: cloneJson(input.prepared.nextActors) }] : [])
    ],
    events: [event],
    outboxTasks: []
  } };
}

function validateMutationInput(input: Parameters<typeof prepareCampaignFactMutationV1>[0]): string[] {
  const { command } = input;
  const issues: string[] = [];
  if (command.contractVersion !== CAMPAIGN_FACT_MUTATION_CONTRACT_VERSION_V1) issues.push("fact mutation contract mismatch");
  if (![input.campaignId, input.operationId, command.clientRequestId, command.subjectRef, command.predicate].every(value => value.trim())) issues.push("mutation identities and fact slot are required");
  if (!Number.isInteger(input.resultingCampaignRevision) || input.resultingCampaignRevision <= 0) issues.push("resulting campaign revision must be positive");
  if (input.facts.contractVersion !== CAMPAIGN_FACT_REGISTRY_CONTRACT_VERSION_V1 || input.facts.campaignId !== input.campaignId) issues.push("campaign fact registry mismatch");
  if (input.actors.contractVersion !== NARRATIVE_ACTOR_REGISTRY_CONTRACT_VERSION_V1 || input.actors.campaignId !== input.campaignId) issues.push("narrative actor registry mismatch");
  if (command.sourceRefs.length === 0 || command.sourceRefs.some(ref => !ref.trim() || /^(?:secret|private|hidden):/iu.test(ref))) issues.push("public reconstructible source references are required");
  if (!/^lore-entity:[a-z0-9_:-]+$/u.test(command.subjectRef)) issues.push("subjectRef must use a canonical lore-entity reference");
  if (!/^\/[a-z0-9_/-]+$/u.test(command.predicate)) issues.push("predicate must use an absolute canonical field path");
  if (!["COMMUN", "LOCAL"].includes(command.knowledgeLevel)) issues.push("public fact knowledge level must be COMMUN or LOCAL");
  if (command.mutationKind !== "INVALIDATE" && command.proposedIdentity === null && !command.objectText?.trim()) issues.push("an identity or text value is required");
  if (command.mutationKind === "INVALIDATE" && (command.proposedIdentity !== null || command.objectText !== null)) issues.push("invalidation cannot assert a replacement value");
  if (command.proposedIdentity && ![command.proposedIdentity.identityRef, command.proposedIdentity.displayName, command.proposedIdentity.publicRole].every(value => value.trim())) issues.push("complete light identity is required");
  if (input.facts.facts.some((fact, index, all) => fact.status === "ACTIVE" && all.findIndex(candidate => candidate.status === "ACTIVE" && candidate.slotKey === fact.slotKey) !== index)) issues.push("fact registry already violates SINGLE cardinality");
  return issues;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
