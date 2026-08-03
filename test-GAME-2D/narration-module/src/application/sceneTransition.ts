import type { JsonObject } from "../core";
import { decideAccessTraversalV1, type AccessControlRecordV1, type AccessTraversalDecisionV1 } from "./accessControl";

export const SCENE_TRANSITION_CONTRACT_VERSION_V1 = "scene-transition/1" as const;

export type SceneTransitionScaleV1 = "LOCAL" | "TRAVEL";
export type SceneBoundaryStateV1 = "OPEN" | "BLOCKED" | "UNKNOWN";

export interface SceneBoundaryConnectionV1 extends JsonObject {
  schemaVersion: 1;
  connectionId: string;
  sourceSceneId: string;
  boundaryRef: string;
  destinationRef: string;
  scale: SceneTransitionScaleV1;
  state: SceneBoundaryStateV1;
  sourceRefs: string[];
  version: number;
}

export interface SceneTransitionTopologyV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_TRANSITION_CONTRACT_VERSION_V1;
  topologyId: string;
  topologyVersion: number;
  connections: SceneBoundaryConnectionV1[];
}

export interface SceneTransitionRequestV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_TRANSITION_CONTRACT_VERSION_V1;
  requestId: string;
  operationId: string;
  campaignId: string;
  actorRef: string;
  sourceSceneId: string;
  sourceSceneVersion: number;
  boundaryRef: string;
  expectedDestinationRef: string | null;
  intentId: string;
  idempotencyKey: string;
}

export type SceneTransitionDecisionCodeV1 =
  | "READY_FOR_LOCAL_COMMIT"
  | "TRAVEL_HANDOFF_REQUIRED"
  | "BOUNDARY_STATE_REQUIRES_RESOLUTION"
  | "DESTINATION_MISMATCH"
  | "CONNECTION_NOT_FOUND"
  | "AMBIGUOUS_CONNECTION"
  | "STALE_SCENE_VERSION"
  | "INVALID_REQUEST"
  | "INVALID_TOPOLOGY";

export interface SceneTransitionDecisionV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_TRANSITION_CONTRACT_VERSION_V1;
  disposition: "READY" | "HANDOFF" | "CLARIFY" | "REJECT";
  code: SceneTransitionDecisionCodeV1;
  connectionId: string | null;
  destinationRef: string | null;
  requiredDomain: "world";
  access: AccessTraversalDecisionV1 | null;
  commitAuthority: false;
  reason: string;
}

export function validateSceneTransitionTopologyV1(
  topology: SceneTransitionTopologyV1
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (topology.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (topology.contractVersion !== SCENE_TRANSITION_CONTRACT_VERSION_V1) issues.push("contractVersion mismatch");
  if (!topology.topologyId.trim()) issues.push("topologyId is required");
  if (!Number.isInteger(topology.topologyVersion) || topology.topologyVersion < 1) issues.push("topologyVersion must be a positive integer");
  const ids = topology.connections.map(connection => connection.connectionId);
  if (new Set(ids).size !== ids.length) issues.push("connectionId values must be unique");
  for (const connection of topology.connections) {
    if (connection.schemaVersion !== 1) issues.push(`${connection.connectionId || "connection"}: schemaVersion must be 1`);
    if (!connection.connectionId.trim()) issues.push("connectionId is required");
    if (!connection.sourceSceneId.trim()) issues.push(`${connection.connectionId}: sourceSceneId is required`);
    if (!isCanonicalRef(connection.boundaryRef)) issues.push(`${connection.connectionId}: boundaryRef must be canonical`);
    if (!isCanonicalRef(connection.destinationRef)) issues.push(`${connection.connectionId}: destinationRef must be canonical`);
    if (connection.sourceRefs.length === 0 || connection.sourceRefs.some(ref => !ref.trim())) issues.push(`${connection.connectionId}: sourceRefs are required`);
    if (!Number.isInteger(connection.version) || connection.version < 1) issues.push(`${connection.connectionId}: version must be a positive integer`);
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function validateSceneTransitionRequestV1(
  request: SceneTransitionRequestV1
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (request.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (request.contractVersion !== SCENE_TRANSITION_CONTRACT_VERSION_V1) issues.push("contractVersion mismatch");
  for (const field of ["requestId", "operationId", "campaignId", "actorRef", "sourceSceneId", "boundaryRef", "intentId", "idempotencyKey"] as const) {
    if (!request[field].trim()) issues.push(`${field} is required`);
  }
  if (!Number.isInteger(request.sourceSceneVersion) || request.sourceSceneVersion < 1) issues.push("sourceSceneVersion must be a positive integer");
  if (!isCanonicalRef(request.actorRef)) issues.push("actorRef must be canonical");
  if (!isCanonicalRef(request.boundaryRef)) issues.push("boundaryRef must be canonical");
  if (request.expectedDestinationRef !== null && !isCanonicalRef(request.expectedDestinationRef)) issues.push("expectedDestinationRef must be null or canonical");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export function decideSceneTransitionV1(input: {
  request: SceneTransitionRequestV1;
  topology: SceneTransitionTopologyV1;
  currentSceneVersion: number;
  accessControls?: AccessControlRecordV1[];
}): SceneTransitionDecisionV1 {
  const requestValidation = validateSceneTransitionRequestV1(input.request);
  if (!requestValidation.ok) return decision("REJECT", "INVALID_REQUEST", null, null, requestValidation.issues.join(" | "));
  const topologyValidation = validateSceneTransitionTopologyV1(input.topology);
  if (!topologyValidation.ok) return decision("REJECT", "INVALID_TOPOLOGY", null, null, topologyValidation.issues.join(" | "));
  if (input.request.sourceSceneVersion !== input.currentSceneVersion) {
    return decision("REJECT", "STALE_SCENE_VERSION", null, null, "La scène source a changé; la transition doit être reconstruite depuis l'état courant.");
  }
  const matches = input.topology.connections.filter(connection =>
    connection.sourceSceneId === input.request.sourceSceneId && connection.boundaryRef === input.request.boundaryRef
  );
  if (matches.length === 0) return decision("REJECT", "CONNECTION_NOT_FOUND", null, null, "Aucune connexion autoritaire ne correspond au passage demandé.");
  if (matches.length > 1) return decision("CLARIFY", "AMBIGUOUS_CONNECTION", null, null, "Plusieurs destinations autoritaires correspondent au même passage.");
  const connection = matches[0]!;
  if (input.request.expectedDestinationRef !== null && input.request.expectedDestinationRef !== connection.destinationRef) {
    return decision("REJECT", "DESTINATION_MISMATCH", connection.connectionId, connection.destinationRef, "La destination interprétée ne correspond pas à la topologie autoritaire.");
  }
  if (connection.state !== "OPEN") {
    return decision("HANDOFF", "BOUNDARY_STATE_REQUIRES_RESOLUTION", connection.connectionId, connection.destinationRef, "L'état du passage doit être résolu par son domaine propriétaire avant tout déplacement.");
  }
  const access = decideAccessTraversalV1({
    connectionId: connection.connectionId,
    control: input.accessControls?.find(control => control.connectionId === connection.connectionId) ?? null
  });
  if (access.disposition === "HANDOFF") {
    return decision(
      "HANDOFF",
      "BOUNDARY_STATE_REQUIRES_RESOLUTION",
      connection.connectionId,
      connection.destinationRef,
      access.reason,
      access
    );
  }
  if (connection.scale === "TRAVEL") {
    return decision("HANDOFF", "TRAVEL_HANDOFF_REQUIRED", connection.connectionId, connection.destinationRef, "La connexion exige un TravelProcess validé.");
  }
  return decision("READY", "READY_FOR_LOCAL_COMMIT", connection.connectionId, connection.destinationRef, "La transition locale est validée pour préparation atomique; aucun commit n'est effectué par cette décision.");
}

function decision(
  disposition: SceneTransitionDecisionV1["disposition"],
  code: SceneTransitionDecisionCodeV1,
  connectionId: string | null,
  destinationRef: string | null,
  reason: string,
  access: AccessTraversalDecisionV1 | null = null
): SceneTransitionDecisionV1 {
  return { schemaVersion: 1, contractVersion: SCENE_TRANSITION_CONTRACT_VERSION_V1, disposition, code, connectionId, destinationRef, requiredDomain: "world", access, commitAuthority: false, reason };
}

function isCanonicalRef(value: string): boolean {
  return /^[a-z][a-z0-9_-]*:.+/u.test(value);
}
