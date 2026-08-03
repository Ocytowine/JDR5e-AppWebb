import type { JsonObject } from "../core";
import type { AccessControlRecordV1 } from "./accessControl";
import { findSceneReferentByRefV1, type SceneReferentRegistryV1 } from "./sceneReferentRegistry";
import {
  decideSceneTransitionV1,
  type SceneTransitionDecisionV1,
  type SceneTransitionRequestV1,
  type SceneTransitionTopologyV1
} from "./sceneTransition";

export const SCENE_TRANSITION_WORLD_COMMAND_VERSION_V1 = "world-scene-transition-command/1" as const;

export interface SceneTransitionWorldCommandV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof SCENE_TRANSITION_WORLD_COMMAND_VERSION_V1;
  commandId: string;
  requestId: string;
  operationId: string;
  campaignId: string;
  intentId: string;
  domain: "world";
  commandType: "PREPARE_LOCAL_SCENE_TRANSITION";
  actorRef: string;
  sourceSceneId: string;
  expectedSceneVersion: number;
  boundaryRef: string;
  connectionId: string;
  destinationRef: string;
  expectedTopologyVersion: number;
  expectedConnectionVersion: number;
  sourceRefs: string[];
  idempotencyKey: string;
  commitPolicy: "DOMAIN_VALIDATED";
  timePolicy: "WORLD_VALIDATED";
  commitAuthority: false;
  source: "SCENE_TRANSITION_ADAPTER";
}

export interface PreparedSceneTransitionWorldRequestV1 {
  schemaVersion: 1;
  decision: SceneTransitionDecisionV1;
  command: SceneTransitionWorldCommandV1 | null;
}

export function prepareSceneTransitionWorldRequestV1(input: {
  request: SceneTransitionRequestV1;
  registry: SceneReferentRegistryV1;
  topology: SceneTransitionTopologyV1;
  currentSceneVersion: number;
  accessControls?: AccessControlRecordV1[];
}): PreparedSceneTransitionWorldRequestV1 {
  const preliminaryDecision = decideSceneTransitionV1({
    request: input.request,
    topology: input.topology,
    currentSceneVersion: input.currentSceneVersion,
    accessControls: input.accessControls
  });
  if (["INVALID_REQUEST", "INVALID_TOPOLOGY", "STALE_SCENE_VERSION"].includes(preliminaryDecision.code)) {
    return { schemaVersion: 1, decision: preliminaryDecision, command: null };
  }
  if (input.registry.sceneId !== input.request.sourceSceneId || input.registry.sceneVersion !== input.request.sourceSceneVersion) {
    return rejected("STALE_SCENE_VERSION", "Le registre visible ne correspond pas à la scène source versionnée.");
  }
  const boundary = findSceneReferentByRefV1(input.registry, input.request.boundaryRef);
  if (boundary === null || !boundary.visible || !boundary.present || !boundary.interactionCapabilities.includes("manipulate")) {
    return rejected("CONNECTION_NOT_FOUND", "Le passage demandé n'est pas un référent visible et manipulable de la scène source.");
  }
  const decision = preliminaryDecision;
  if (decision.code !== "READY_FOR_LOCAL_COMMIT" || decision.connectionId === null || decision.destinationRef === null) {
    return { schemaVersion: 1, decision, command: null };
  }
  const connection = input.topology.connections.find(entry => entry.connectionId === decision.connectionId)!;
  return {
    schemaVersion: 1,
    decision,
    command: {
      schemaVersion: 1,
      contractVersion: SCENE_TRANSITION_WORLD_COMMAND_VERSION_V1,
      commandId: `${input.request.requestId}:world-command:1`,
      requestId: input.request.requestId,
      operationId: input.request.operationId,
      campaignId: input.request.campaignId,
      intentId: input.request.intentId,
      domain: "world",
      commandType: "PREPARE_LOCAL_SCENE_TRANSITION",
      actorRef: input.request.actorRef,
      sourceSceneId: input.request.sourceSceneId,
      expectedSceneVersion: input.request.sourceSceneVersion,
      boundaryRef: input.request.boundaryRef,
      connectionId: connection.connectionId,
      destinationRef: connection.destinationRef,
      expectedTopologyVersion: input.topology.topologyVersion,
      expectedConnectionVersion: connection.version,
      sourceRefs: [...connection.sourceRefs],
      idempotencyKey: input.request.idempotencyKey,
      commitPolicy: "DOMAIN_VALIDATED",
      timePolicy: "WORLD_VALIDATED",
      commitAuthority: false,
      source: "SCENE_TRANSITION_ADAPTER"
    }
  };
}

export function validateSceneTransitionWorldCommandV1(
  command: SceneTransitionWorldCommandV1
): { ok: true } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  if (command.contractVersion !== SCENE_TRANSITION_WORLD_COMMAND_VERSION_V1) issues.push("contractVersion mismatch");
  for (const field of ["commandId", "requestId", "operationId", "campaignId", "intentId", "actorRef", "sourceSceneId", "boundaryRef", "connectionId", "destinationRef", "idempotencyKey"] as const) {
    if (!command[field].trim()) issues.push(`${field} is required`);
  }
  if (!Number.isInteger(command.expectedSceneVersion) || command.expectedSceneVersion < 1) issues.push("expectedSceneVersion must be a positive integer");
  if (!Number.isInteger(command.expectedTopologyVersion) || command.expectedTopologyVersion < 1) issues.push("expectedTopologyVersion must be a positive integer");
  if (!Number.isInteger(command.expectedConnectionVersion) || command.expectedConnectionVersion < 1) issues.push("expectedConnectionVersion must be a positive integer");
  if (command.sourceRefs.length === 0 || command.sourceRefs.some(ref => !ref.trim())) issues.push("sourceRefs are required");
  if (command.commitAuthority !== false) issues.push("commitAuthority must be false");
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function rejected(code: "STALE_SCENE_VERSION" | "CONNECTION_NOT_FOUND", reason: string): PreparedSceneTransitionWorldRequestV1 {
  return {
    schemaVersion: 1,
    decision: {
      schemaVersion: 1,
      contractVersion: "scene-transition/1",
      disposition: "REJECT",
      code,
      connectionId: null,
      destinationRef: null,
      requiredDomain: "world",
      access: null,
      commitAuthority: false,
      reason
    },
    command: null
  };
}
