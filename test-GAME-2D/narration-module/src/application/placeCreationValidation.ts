import type { DynamicCreationProposalV1, CreationPersistenceDepthV1 } from "../ai/types";
import { validateSceneTransitionTopologyV1, type SceneBoundaryConnectionV1, type SceneTransitionTopologyV1 } from "./sceneTransition";

export const PLACE_CREATION_VALIDATION_CONTRACT_V1 = "place-creation-validation/1" as const;

export interface KnownPlaceIdentityV1 {
  placeRef: string;
  displayName: string;
  aliases: string[];
  parentLocationRef: string;
  sourceRefs: string[];
}

export interface PlaceCreationValidationPolicyV1 {
  schemaVersion: 1;
  contractVersion: typeof PLACE_CREATION_VALIDATION_CONTRACT_V1;
  allowedPersistenceDepths: ReadonlyArray<Extract<CreationPersistenceDepthV1, "SCENE_EPHEMERAL" | "LIGHT_REFERENCE" | "FULL_ENTITY">>;
  allowedParentLocationRefs: string[];
  knownSourceSceneIds: string[];
  knownPlaces: KnownPlaceIdentityV1[];
  maximumConnections: number;
  version: 1;
}

export type PlaceCreationValidationResultV1 =
  | {
    ok: true;
    decision: "READY_FOR_PLACE_COMMAND";
    proposal: DynamicCreationProposalV1;
    topologyAdditions: SceneBoundaryConnectionV1[];
    validatingDomains: ["WorldDomain", "SceneDomain", "CampaignFactDomain"];
    commitAuthority: false;
  }
  | {
    ok: false;
    code:
      | "PLACE_PROPOSAL_INVALID"
      | "PLACE_TOPOLOGY_INVALID"
      | "PLACE_DUPLICATE_REJECTED"
      | "PLACE_PERSISTENCE_REJECTED";
    issues: string[];
  };

interface ProposedPlaceProperties {
  displayName: string;
  proposedPlaceRef: string;
  arrivalSceneId: string;
  parentLocationRef: string;
  connectionIntents: Array<{
    sourceSceneId: string;
    boundaryRef: string;
    destinationRef: string;
    scale: "LOCAL" | "TRAVEL";
    sourceRefs: string[];
  }>;
}

export function validatePlaceCreationProposalV1(input: {
  proposal: DynamicCreationProposalV1;
  topology: SceneTransitionTopologyV1;
  policy: PlaceCreationValidationPolicyV1;
}): PlaceCreationValidationResultV1 {
  const issues: string[] = [];
  if (input.proposal.proposalType !== "PLACE") issues.push("proposalType must be PLACE.");
  if (input.policy.contractVersion !== PLACE_CREATION_VALIDATION_CONTRACT_V1) issues.push("place-creation-validation/1 policy required.");
  const topologyValidation = validateSceneTransitionTopologyV1(input.topology);
  if (!topologyValidation.ok) return { ok: false, code: "PLACE_TOPOLOGY_INVALID", issues: topologyValidation.issues };
  if (
    input.proposal.requestedDepth === "ARCHIVE" ||
    !input.policy.allowedPersistenceDepths.includes(input.proposal.requestedDepth)
  ) {
    return { ok: false, code: "PLACE_PERSISTENCE_REJECTED", issues: [`Persistence depth ${input.proposal.requestedDepth} is not allowed.`] };
  }
  const properties = parseProperties(input.proposal.proposedProperties);
  if (properties === null) return { ok: false, code: "PLACE_PROPOSAL_INVALID", issues: ["Structured place properties are missing or invalid."] };
  if (!input.policy.allowedParentLocationRefs.includes(properties.parentLocationRef)) {
    issues.push(`Parent location ${properties.parentLocationRef} is not allowed.`);
  }
  if (
    input.policy.knownPlaces.some(place => place.placeRef === properties.proposedPlaceRef) ||
    input.topology.connections.some(connection => connection.destinationRef === properties.proposedPlaceRef)
  ) {
    return { ok: false, code: "PLACE_DUPLICATE_REJECTED", issues: [`Place ref already exists: ${properties.proposedPlaceRef}.`] };
  }
  const normalizedName = normalize(properties.displayName);
  const similar = input.policy.knownPlaces.filter(place =>
    place.parentLocationRef === properties.parentLocationRef &&
    [place.displayName, ...place.aliases].some(value => normalize(value) === normalizedName)
  );
  if (similar.length > 0) {
    return { ok: false, code: "PLACE_DUPLICATE_REJECTED", issues: [`Similar place exists: ${similar.map(place => place.placeRef).join(", ")}.`] };
  }
  if (properties.connectionIntents.length < 1 || properties.connectionIntents.length > input.policy.maximumConnections) {
    issues.push(`connectionIntents must contain between 1 and ${input.policy.maximumConnections} entries.`);
  }
  if (input.proposal.requestedDepth === "SCENE_EPHEMERAL") {
    return { ok: false, code: "PLACE_PERSISTENCE_REJECTED", issues: ["A topological destination cannot remain SCENE_EPHEMERAL."] };
  }
  const topologyAdditions: SceneBoundaryConnectionV1[] = [];
  for (const [index, connection] of properties.connectionIntents.entries()) {
    if (!input.policy.knownSourceSceneIds.includes(connection.sourceSceneId) && connection.sourceSceneId !== properties.arrivalSceneId) {
      issues.push(`Unknown source scene: ${connection.sourceSceneId}.`);
    }
    const conflict = input.topology.connections.find(existing =>
      existing.sourceSceneId === connection.sourceSceneId && existing.boundaryRef === connection.boundaryRef
    );
    if (conflict) issues.push(`Boundary already has a destination: ${connection.sourceSceneId}/${connection.boundaryRef}.`);
    topologyAdditions.push({
      schemaVersion: 1,
      connectionId: `${input.proposal.proposalId}:connection:${index + 1}`,
      sourceSceneId: connection.sourceSceneId,
      boundaryRef: connection.boundaryRef,
      destinationRef: connection.destinationRef,
      scale: connection.scale,
      state: "OPEN",
      sourceRefs: unique([...connection.sourceRefs, ...input.proposal.existingFactRefsUsed]),
      version: 1
    });
  }
  const hasIncoming = topologyAdditions.some(connection => connection.destinationRef === properties.proposedPlaceRef);
  const hasOutgoing = topologyAdditions.some(connection => connection.sourceSceneId === properties.arrivalSceneId);
  if (!hasIncoming || !hasOutgoing) issues.push("A persistent place requires at least one incoming and one outgoing connection.");
  if (new Set(topologyAdditions.map(connection => `${connection.sourceSceneId}\u0000${connection.boundaryRef}`)).size !== topologyAdditions.length) {
    issues.push("Proposed connections must use distinct source boundaries.");
  }
  if (issues.length > 0) return { ok: false, code: "PLACE_TOPOLOGY_INVALID", issues };
  const candidateTopology = {
    ...input.topology,
    connections: [...input.topology.connections, ...topologyAdditions]
  };
  const candidateValidation = validateSceneTransitionTopologyV1(candidateTopology);
  if (!candidateValidation.ok) return { ok: false, code: "PLACE_TOPOLOGY_INVALID", issues: candidateValidation.issues };
  return {
    ok: true,
    decision: "READY_FOR_PLACE_COMMAND",
    proposal: structuredClone(input.proposal),
    topologyAdditions,
    validatingDomains: ["WorldDomain", "SceneDomain", "CampaignFactDomain"],
    commitAuthority: false
  };
}

function parseProperties(value: Record<string, unknown>): ProposedPlaceProperties | null {
  if (
    typeof value.displayName !== "string" || !value.displayName.trim() ||
    typeof value.proposedPlaceRef !== "string" || !isCanonicalRef(value.proposedPlaceRef) ||
    typeof value.arrivalSceneId !== "string" || !value.arrivalSceneId.trim() ||
    typeof value.parentLocationRef !== "string" || !isCanonicalRef(value.parentLocationRef) ||
    !Array.isArray(value.connectionIntents)
  ) return null;
  const connectionIntents: ProposedPlaceProperties["connectionIntents"] = [];
  for (const entry of value.connectionIntents) {
    if (!isRecord(entry) || typeof entry.sourceSceneId !== "string" || !entry.sourceSceneId.trim() ||
      typeof entry.boundaryRef !== "string" || !isCanonicalRef(entry.boundaryRef) ||
      typeof entry.destinationRef !== "string" || !isCanonicalRef(entry.destinationRef) ||
      (entry.scale !== "LOCAL" && entry.scale !== "TRAVEL") || !Array.isArray(entry.sourceRefs) ||
      !entry.sourceRefs.every(sourceRef => typeof sourceRef === "string" && sourceRef.trim())) return null;
    connectionIntents.push({
      sourceSceneId: entry.sourceSceneId,
      boundaryRef: entry.boundaryRef,
      destinationRef: entry.destinationRef,
      scale: entry.scale,
      sourceRefs: entry.sourceRefs as string[]
    });
  }
  return {
    displayName: value.displayName,
    proposedPlaceRef: value.proposedPlaceRef,
    arrivalSceneId: value.arrivalSceneId,
    parentLocationRef: value.parentLocationRef,
    connectionIntents
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalRef(value: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(value);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/gu, " ");
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
