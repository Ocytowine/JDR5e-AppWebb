import {
  cloneJson,
  opaqueId,
  type AcceptedCommandDraft,
  type AggregateId,
  type AggregateRecord,
  type CampaignId,
  type CommandId,
  type CommitId,
  type CommitRecord,
  type CommitRequest,
  type EventDraft,
  type EventId,
  type IdempotencyKey,
  type JsonObject,
  type OperationId,
  type WriterLease
} from "../core";
import type { DynamicCreationProposalV1 } from "../ai/types";
import {
  PLAYABLE_SCENE_CONTRACT_VERSION_V1,
  validatePlayableSceneV1,
  type PlayableSceneStateV1
} from "./playableScene";
import type { PlaceCreationValidationResultV1 } from "./placeCreationValidation";
import { validateSceneTransitionTopologyV1, type SceneBoundaryConnectionV1, type SceneTransitionTopologyV1 } from "./sceneTransition";
import { buildAmbientScenePresenceV1 } from "./ambientScenePresence";
import { buildNarrativeDesignationV1 } from "./narrativeDesignation";

export const PLACE_CREATION_COMMAND_CONTRACT_V1 = "place-creation-command/1" as const;
export const PLACE_REGISTRY_CONTRACT_V1 = "world-place-registry/1" as const;
export const PLACE_TOPOLOGY_AGGREGATE_CONTRACT_V1 = "world-scene-topology/1" as const;
export const PLACE_FACT_REGISTRY_CONTRACT_V1 = "campaign-place-facts/1" as const;

export interface DynamicPlaceRecordV1 extends JsonObject {
  schemaVersion: 1;
  placeRef: string;
  arrivalSceneId: string;
  displayName: string;
  summary: string;
  initialTension: string;
  parentLocationRef: string;
  perceptibleFeatures: string[];
  populationRoles: string[];
  localNorms: string[];
  persistenceDepth: "LIGHT_REFERENCE" | "FULL_ENTITY";
  loreAnchorEntityId: string | null;
  loreGeographicChain: string[];
  sourceRefs: string[];
  createdByProposalId: string;
  version: 1;
}

export interface PlaceRegistryStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLACE_REGISTRY_CONTRACT_V1;
  places: DynamicPlaceRecordV1[];
  version: number;
}

export interface PlaceTopologyStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLACE_TOPOLOGY_AGGREGATE_CONTRACT_V1;
  topology: SceneTransitionTopologyV1;
  version: number;
}

export interface PlaceFactRecordV1 extends JsonObject {
  schemaVersion: 1;
  placeRef: string;
  narrativeCommitments: string[];
  sourceRefs: string[];
  createdByProposalId: string;
  validFromGameSecond: number;
  version: 1;
}

export interface PlaceFactRegistryStateV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof PLACE_FACT_REGISTRY_CONTRACT_V1;
  facts: PlaceFactRecordV1[];
  version: number;
}

export interface PlaceCreationCommandV1 {
  schemaVersion: 1;
  contractVersion: typeof PLACE_CREATION_COMMAND_CONTRACT_V1;
  commandId: string;
  campaignId: string;
  operationId: string;
  proposal: DynamicCreationProposalV1;
  place: DynamicPlaceRecordV1;
  topologyAdditions: SceneBoundaryConnectionV1[];
  placeRegistryAggregateId: string;
  expectedPlaceRegistryRevision: number;
  topologyAggregateId: string;
  expectedTopologyAggregateRevision: number;
  expectedTopologyVersion: number;
  factRegistryAggregateId: string;
  expectedFactRegistryRevision: number;
  sourceRefs: string[];
  idempotencyKey: string;
  commitAuthority: false;
  version: 1;
}

export function preparePlaceCreationCommandV1(input: {
  campaignId: string;
  operationId: string;
  commandId: string;
  idempotencyKey: string;
  validation: Extract<PlaceCreationValidationResultV1, { ok: true }>;
  placeRegistryAggregate: AggregateRecord;
  topologyAggregate: AggregateRecord;
  factRegistryAggregate: AggregateRecord;
}): { ok: true; command: PlaceCreationCommandV1 } | { ok: false; issues: string[] } {
  const issues = validateAggregateContracts(input.placeRegistryAggregate, input.topologyAggregate, input.factRegistryAggregate);
  if ([input.placeRegistryAggregate, input.topologyAggregate, input.factRegistryAggregate].some(aggregate => aggregate.campaignId !== input.campaignId)) issues.push("aggregate campaign mismatch");
  const placeState = input.placeRegistryAggregate.payload as PlaceRegistryStateV1;
  const topologyState = input.topologyAggregate.payload as PlaceTopologyStateV1;
  const factState = input.factRegistryAggregate.payload as PlaceFactRegistryStateV1;
  if (placeState.places.some(place => place.placeRef === proposedString(input.validation.proposal, "proposedPlaceRef"))) issues.push("place already exists in registry");
  if (factState.facts.some(fact => fact.placeRef === proposedString(input.validation.proposal, "proposedPlaceRef"))) issues.push("place fact already exists");
  if (!input.campaignId.trim() || !input.operationId.trim() || !input.commandId.trim() || !input.idempotencyKey.trim()) issues.push("command identities are required");
  if (issues.length > 0) return { ok: false, issues };

  const properties = input.validation.proposal.proposedProperties;
  const place: DynamicPlaceRecordV1 = {
    schemaVersion: 1,
    placeRef: proposedString(input.validation.proposal, "proposedPlaceRef"),
    arrivalSceneId: proposedString(input.validation.proposal, "arrivalSceneId"),
    displayName: proposedString(input.validation.proposal, "displayName"),
    summary: proposedString(input.validation.proposal, "summary"),
    initialTension: proposedString(input.validation.proposal, "initialTension"),
    parentLocationRef: proposedString(input.validation.proposal, "parentLocationRef"),
    perceptibleFeatures: stringArray(properties.perceptibleFeatures),
    populationRoles: stringArray(properties.populationRoles),
    localNorms: stringArray(properties.localNorms),
    persistenceDepth: input.validation.proposal.requestedDepth as "LIGHT_REFERENCE" | "FULL_ENTITY",
    loreAnchorEntityId: optionalString(properties.loreAnchorEntityId),
    loreGeographicChain: stringArray(properties.loreGeographicChain),
    sourceRefs: unique(input.validation.proposal.existingFactRefsUsed),
    createdByProposalId: input.validation.proposal.proposalId,
    version: 1
  };
  return {
    ok: true,
    command: {
      schemaVersion: 1,
      contractVersion: PLACE_CREATION_COMMAND_CONTRACT_V1,
      commandId: input.commandId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      proposal: cloneJson(input.validation.proposal),
      place,
      topologyAdditions: input.validation.topologyAdditions.map(cloneJson),
      placeRegistryAggregateId: input.placeRegistryAggregate.aggregateId,
      expectedPlaceRegistryRevision: input.placeRegistryAggregate.aggregateRevision,
      topologyAggregateId: input.topologyAggregate.aggregateId,
      expectedTopologyAggregateRevision: input.topologyAggregate.aggregateRevision,
      expectedTopologyVersion: topologyState.topology.topologyVersion,
      factRegistryAggregateId: input.factRegistryAggregate.aggregateId,
      expectedFactRegistryRevision: input.factRegistryAggregate.aggregateRevision,
      sourceRefs: unique([
        ...input.validation.proposal.existingFactRefsUsed,
        ...input.validation.topologyAdditions.flatMap(connection => connection.sourceRefs)
      ]),
      idempotencyKey: input.idempotencyKey,
      commitAuthority: false,
      version: 1
    }
  };
}

export function buildPlaceCreationCommitV1(input: {
  command: PlaceCreationCommandV1;
  campaignId: CampaignId;
  operationId: OperationId;
  commitId: CommitId;
  expectedCampaignRevision: number;
  requestFingerprint: string;
  writerLease: WriterLease;
  acceptedAtGameSecond: number;
  placeRegistryAggregate: AggregateRecord;
  topologyAggregate: AggregateRecord;
  factRegistryAggregate: AggregateRecord;
}): { ok: true; commit: CommitRequest } | { ok: false; issues: string[] } {
  const issues = validateAggregateContracts(input.placeRegistryAggregate, input.topologyAggregate, input.factRegistryAggregate);
  if ([input.placeRegistryAggregate, input.topologyAggregate, input.factRegistryAggregate].some(aggregate => aggregate.campaignId !== input.campaignId)) issues.push("aggregate campaign mismatch");
  if (input.command.contractVersion !== PLACE_CREATION_COMMAND_CONTRACT_V1) issues.push("command contract mismatch");
  if (input.command.campaignId !== input.campaignId || input.command.operationId !== input.operationId) issues.push("command identity mismatch");
  if (input.command.placeRegistryAggregateId !== input.placeRegistryAggregate.aggregateId || input.command.expectedPlaceRegistryRevision !== input.placeRegistryAggregate.aggregateRevision) issues.push("place registry revision mismatch");
  if (input.command.topologyAggregateId !== input.topologyAggregate.aggregateId || input.command.expectedTopologyAggregateRevision !== input.topologyAggregate.aggregateRevision) issues.push("topology aggregate revision mismatch");
  if (input.command.factRegistryAggregateId !== input.factRegistryAggregate.aggregateId || input.command.expectedFactRegistryRevision !== input.factRegistryAggregate.aggregateRevision) issues.push("fact registry revision mismatch");
  const placeState = input.placeRegistryAggregate.payload as PlaceRegistryStateV1;
  const topologyState = input.topologyAggregate.payload as PlaceTopologyStateV1;
  const factState = input.factRegistryAggregate.payload as PlaceFactRegistryStateV1;
  if (topologyState.topology.topologyVersion !== input.command.expectedTopologyVersion) issues.push("topology version mismatch");
  if (placeState.places.some(place => place.placeRef === input.command.place.placeRef)) issues.push("place already exists");
  if (factState.facts.some(fact => fact.placeRef === input.command.place.placeRef)) issues.push("place fact already exists");
  if (input.command.topologyAdditions.some(addition => topologyState.topology.connections.some(existing => existing.connectionId === addition.connectionId || (existing.sourceSceneId === addition.sourceSceneId && existing.boundaryRef === addition.boundaryRef)))) issues.push("topology addition conflicts with current topology");
  if (issues.length > 0) return { ok: false, issues };

  const nextPlaceState: PlaceRegistryStateV1 = { ...cloneJson(placeState), places: [...placeState.places.map(cloneJson), cloneJson(input.command.place)], version: placeState.version + 1 };
  const nextTopologyState: PlaceTopologyStateV1 = {
    ...cloneJson(topologyState),
    topology: {
      ...cloneJson(topologyState.topology),
      topologyVersion: topologyState.topology.topologyVersion + 1,
      connections: [...topologyState.topology.connections.map(cloneJson), ...input.command.topologyAdditions.map(cloneJson)]
    },
    version: topologyState.version + 1
  };
  const fact: PlaceFactRecordV1 = {
    schemaVersion: 1,
    placeRef: input.command.place.placeRef,
    narrativeCommitments: [...input.command.proposal.narrativeCommitments],
    sourceRefs: [...input.command.sourceRefs],
    createdByProposalId: input.command.proposal.proposalId,
    validFromGameSecond: input.acceptedAtGameSecond,
    version: 1
  };
  const nextFactState: PlaceFactRegistryStateV1 = { ...cloneJson(factState), facts: [...factState.facts.map(cloneJson), fact], version: factState.version + 1 };
  const commandDraft: AcceptedCommandDraft = {
    schemaVersion: 1,
    contractId: "place-creation-command",
    contractVersion: 1,
    commandId: opaqueId<CommandId>(input.command.commandId),
    campaignId: input.campaignId,
    operationId: input.operationId,
    commandType: "world.place.create",
    target: { aggregateType: "world.place-registry", aggregateId: input.placeRegistryAggregate.aggregateId, expectedAggregateRevision: input.placeRegistryAggregate.aggregateRevision },
    payloadSchemaVersion: 1,
    payload: cloneJson(input.command as unknown as JsonObject),
    acceptedAtGameSecond: input.acceptedAtGameSecond
  };
  const event: EventDraft = {
    schemaVersion: 1,
    eventId: opaqueId<EventId>(`${input.operationId}:event:place-created`),
    campaignId: input.campaignId,
    operationId: input.operationId,
    eventType: "world.place.created",
    origin: "AI_PROPOSAL",
    causation: { kind: "COMMAND", id: input.command.commandId },
    aggregateRefs: [
      { aggregateType: "world.place-registry", aggregateId: input.placeRegistryAggregate.aggregateId, aggregateRevision: input.placeRegistryAggregate.aggregateRevision + 1 },
      { aggregateType: "world.scene-topology", aggregateId: input.topologyAggregate.aggregateId, aggregateRevision: input.topologyAggregate.aggregateRevision + 1 },
      { aggregateType: "campaign.place-facts", aggregateId: input.factRegistryAggregate.aggregateId, aggregateRevision: input.factRegistryAggregate.aggregateRevision + 1 }
    ],
    visibility: { scope: "SYSTEM", actorIds: [] },
    occurredAtGameSecond: input.acceptedAtGameSecond,
    payloadSchemaVersion: 1,
    payload: { placeRef: input.command.place.placeRef, arrivalSceneId: input.command.place.arrivalSceneId, persistenceDepth: input.command.place.persistenceDepth, sourceRefs: [...input.command.sourceRefs] }
  };
  return {
    ok: true,
    commit: {
      campaignId: input.campaignId,
      operationId: input.operationId,
      commitId: input.commitId,
      idempotencyKey: opaqueId<IdempotencyKey>(input.command.idempotencyKey),
      requestFingerprint: input.requestFingerprint,
      expectedCampaignRevision: input.expectedCampaignRevision,
      writerLease: input.writerLease,
      acceptedCommands: [commandDraft],
      aggregateWrites: [
        { aggregateType: "world.place-registry", aggregateId: input.placeRegistryAggregate.aggregateId, expectedAggregateRevision: input.placeRegistryAggregate.aggregateRevision, payloadSchemaVersion: 1, payload: nextPlaceState },
        { aggregateType: "world.scene-topology", aggregateId: input.topologyAggregate.aggregateId, expectedAggregateRevision: input.topologyAggregate.aggregateRevision, payloadSchemaVersion: 1, payload: nextTopologyState },
        { aggregateType: "campaign.place-facts", aggregateId: input.factRegistryAggregate.aggregateId, expectedAggregateRevision: input.factRegistryAggregate.aggregateRevision, payloadSchemaVersion: 1, payload: nextFactState }
      ],
      events: [event],
      outboxTasks: []
    }
  };
}

export function buildDynamicPlaceSceneAfterCommitV1(input: {
  commit: CommitRecord;
  placeRef: string;
  placeRegistryAggregate: AggregateRecord;
  topologyAggregate: AggregateRecord;
  factRegistryAggregate: AggregateRecord;
}): { ok: true; scene: PlayableSceneStateV1 } | { ok: false; issues: string[] } {
  const issues = validateAggregateContracts(input.placeRegistryAggregate, input.topologyAggregate, input.factRegistryAggregate);
  for (const aggregate of [input.placeRegistryAggregate, input.topologyAggregate, input.factRegistryAggregate]) {
    if (aggregate.updatedByCommitId !== input.commit.commitId) issues.push(`${aggregate.aggregateType} is not confirmed by commit`);
    if (!input.commit.aggregateWrites.some(write => write.aggregateType === aggregate.aggregateType && write.aggregateId === aggregate.aggregateId && write.aggregateRevision === aggregate.aggregateRevision)) issues.push(`${aggregate.aggregateType} revision is absent from commit`);
  }
  const place = (input.placeRegistryAggregate.payload as PlaceRegistryStateV1).places.find(candidate => candidate.placeRef === input.placeRef);
  const fact = (input.factRegistryAggregate.payload as PlaceFactRegistryStateV1).facts.find(candidate => candidate.placeRef === input.placeRef);
  const topology = (input.topologyAggregate.payload as PlaceTopologyStateV1).topology;
  if (!place) issues.push("committed place not found");
  if (!fact) issues.push("committed place fact not found");
  if (issues.length > 0 || !place || !fact) return { ok: false, issues };
  const outgoing = topology.connections.filter(connection => connection.sourceSceneId === place.arrivalSceneId);
  const scene: PlayableSceneStateV1 = {
    schemaVersion: 1,
    contractVersion: PLAYABLE_SCENE_CONTRACT_VERSION_V1,
    sceneId: place.arrivalSceneId,
    locationName: place.displayName,
    locationDesignation: buildNarrativeDesignationV1({
      subjectRef: `place:${place.arrivalSceneId}`,
      subjectKind: "PLACE",
      knowledgeStatus: "DESIGNATION",
      playerFacingLabel: place.displayName,
      firstMention: place.displayName,
      subsequentMention: `ce lieu`,
      sourceRefs: fact.sourceRefs
    }),
    perceptibleSituation: [place.summary, ...place.perceptibleFeatures],
    visibleElements: place.perceptibleFeatures.map((feature, index) => ({ schemaVersion: 1, elementId: `${place.arrivalSceneId}:feature:${index + 1}`, label: feature, description: feature, keywords: [feature], playerVisible: true, version: 1 })),
    presentNpc: [],
    ambientPopulation: place.populationRoles.map((role, index) => buildAmbientScenePresenceV1({
      sceneId: place.arrivalSceneId,
      role,
      index,
      currentPressure: place.initialTension,
      contextLabel: place.displayName,
      localNorms: place.localNorms,
      knowledgeRefs: fact.sourceRefs
    })),
    pointsOfInterest: outgoing.map(connection => ({
      schemaVersion: 1,
      pointId: connection.boundaryRef.slice(connection.boundaryRef.indexOf(":") + 1),
      label: connection.boundaryRef === "poi:return-to-source"
        ? `Retour vers ${humanize(connection.destinationRef)}`
        : humanize(connection.boundaryRef),
      visibleDescription: `Passage vers ${humanize(connection.destinationRef)}.`,
      keywords: [connection.boundaryRef, connection.destinationRef],
      destinationAliases: [humanize(connection.destinationRef)],
      version: 1
    })),
    perceptionClues: [],
    currentTension: place.initialTension,
    playerKnownFacts: [`Le lieu est rattaché à ${place.parentLocationRef}.`, ...place.localNorms],
    localMemoryPolicy: { schemaVersion: 1, maxShortTermNpcMemory: 5, version: 1 },
    aiSceneWriterPolicy: {
      schemaVersion: 1,
      mayCreate: [],
      mayReference: [...fact.sourceRefs],
      mustNotCreate: ["nouveau fait durable", "PNJ durable", "connexion topologique"],
      noveltyConstraints: ["respecter la scène dynamique committée", "ne pas promouvoir les présences ambiantes en PNJ durables"],
      version: 1
    },
    version: 1
  };
  const validation = validatePlayableSceneV1(scene);
  return validation.ok ? { ok: true, scene } : { ok: false, issues: validation.issues };
}

function validateAggregateContracts(place: AggregateRecord, topology: AggregateRecord, facts: AggregateRecord): string[] {
  const issues: string[] = [];
  if (place.aggregateType !== "world.place-registry" || place.payload.contractVersion !== PLACE_REGISTRY_CONTRACT_V1) issues.push("world.place-registry aggregate required");
  if (!Array.isArray(place.payload.places) || !Number.isInteger(place.payload.version)) issues.push("world.place-registry payload invalid");
  if (topology.aggregateType !== "world.scene-topology" || topology.payload.contractVersion !== PLACE_TOPOLOGY_AGGREGATE_CONTRACT_V1) issues.push("world.scene-topology aggregate required");
  if (!isRecord(topology.payload.topology) || !Number.isInteger(topology.payload.version)) {
    issues.push("world.scene-topology payload invalid");
  } else {
    const validation = validateSceneTransitionTopologyV1(topology.payload.topology as unknown as SceneTransitionTopologyV1);
    if (!validation.ok) issues.push(...validation.issues.map(issue => `world.scene-topology: ${issue}`));
  }
  if (facts.aggregateType !== "campaign.place-facts" || facts.payload.contractVersion !== PLACE_FACT_REGISTRY_CONTRACT_V1) issues.push("campaign.place-facts aggregate required");
  if (!Array.isArray(facts.payload.facts) || !Number.isInteger(facts.payload.version)) issues.push("campaign.place-facts payload invalid");
  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function proposedString(proposal: DynamicCreationProposalV1, key: string): string {
  const value = proposal.proposedProperties[key];
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").map(entry => entry.trim()).filter(Boolean) : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function humanize(ref: string): string {
  const value = ref.slice(ref.indexOf(":") + 1).replaceAll("_", " ").replaceAll("-", " ");
  return value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
