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
import { validateAccessControlRecordV1, type AccessControlRecordV1 } from "./accessControl";
import {
  ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
  type AccessControlOwnerAuthorizationV1,
  type AccessControlRegistryV1
} from "./accessControlAuthority";
import type { PlaceCreationCommandV1 } from "./placeCreationCommit";

export const CONTROLLED_PLACE_MATERIALIZATION_CONTRACT_V1 = "controlled-place-materialization/1" as const;

/**
 * Adds an owner-authorized access control to a prepared place-creation commit.
 * It deliberately adds no time, position or scene-lifecycle write: materializing
 * a controlled destination never implies that the character crossed its threshold.
 */
export function augmentPlaceCreationCommitWithAccessControlV1(input: {
  placeCommit: CommitRequest;
  placeCommand: PlaceCreationCommandV1;
  accessControl: AccessControlRecordV1;
  accessRegistryAggregate: AggregateRecord | null;
  accessRegistryState: AccessControlRegistryV1;
  authorization: AccessControlOwnerAuthorizationV1;
  occurredAtGameSecond: number;
}): { ok: true; commit: CommitRequest } | { ok: false; issues: string[] } {
  const issues = validateAccessControlRecordV1(input.accessControl);
  if (input.placeCommit.campaignId !== input.placeCommand.campaignId || input.placeCommit.operationId !== input.placeCommand.operationId) {
    issues.push("place command and commit identities do not match");
  }
  if (!Number.isInteger(input.occurredAtGameSecond) || input.occurredAtGameSecond < 0) issues.push("occurredAtGameSecond is invalid");
  const connection = input.placeCommand.topologyAdditions.find(candidate => candidate.connectionId === input.accessControl.connectionId);
  if (connection === undefined) issues.push("access control must target a connection created by the same place command");
  else if (
    connection.sourceSceneId !== input.accessControl.sourceSceneId ||
    connection.boundaryRef !== input.accessControl.boundaryRef ||
    connection.destinationRef !== input.accessControl.destinationRef
  ) issues.push("access control does not match the created connection");
  if (input.accessControl.version !== 1) issues.push("a materialized access control must start at version 1");
  if (input.accessRegistryState.campaignId !== input.placeCommit.campaignId) issues.push("access registry campaign mismatch");
  if (input.accessRegistryAggregate !== null && input.accessRegistryAggregate.payload !== input.accessRegistryState) {
    const persisted = input.accessRegistryAggregate.payload as Partial<AccessControlRegistryV1>;
    if (persisted.version !== input.accessRegistryState.version) issues.push("access registry state is stale");
  }
  if (input.accessRegistryState.controls.some(control => control.accessControlRef === input.accessControl.accessControlRef || control.connectionId === input.accessControl.connectionId)) {
    issues.push("access control identity or connection already exists");
  }
  issues.push(...validateAuthorization(input.accessControl, input.placeCommand.operationId, input.authorization));
  if (input.placeCommit.aggregateWrites.some(write => write.aggregateType === ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1)) {
    issues.push("place commit already writes the access-control registry");
  }
  if (issues.length > 0) return { ok: false, issues };

  const aggregateId = input.accessRegistryAggregate?.aggregateId
    ?? opaqueId<AggregateId>(`agg-access-controls:${input.placeCommit.campaignId}`);
  const expectedRevision = input.accessRegistryAggregate?.aggregateRevision ?? null;
  const nextRegistry: AccessControlRegistryV1 = {
    ...cloneJson(input.accessRegistryState),
    controls: [...input.accessRegistryState.controls.map(cloneJson), cloneJson(input.accessControl)]
      .sort((left, right) => left.accessControlRef.localeCompare(right.accessControlRef)),
    version: input.accessRegistryState.version + 1
  };
  const commandId = opaqueId<CommandId>(`${input.placeCommit.operationId}:command:materialize-access-control`);
  const acceptedCommand: AcceptedCommandDraft = {
    schemaVersion: 1,
    contractId: "controlled-place-materialization",
    contractVersion: 1,
    commandId,
    campaignId: input.placeCommit.campaignId,
    operationId: input.placeCommit.operationId,
    commandType: "access.control.materialize-with-place",
    target: {
      aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId,
      expectedAggregateRevision: expectedRevision
    },
    payloadSchemaVersion: 1,
    payload: {
      accessControlRef: input.accessControl.accessControlRef,
      connectionId: input.accessControl.connectionId,
      ownerDomain: input.accessControl.ownerDomain,
      state: input.accessControl.state,
      noTraversal: true
    },
    acceptedAtGameSecond: input.occurredAtGameSecond
  };
  const event: EventDraft = {
    schemaVersion: 1,
    eventId: opaqueId<EventId>(`${input.placeCommit.operationId}:event:access-control-materialized`),
    campaignId: input.placeCommit.campaignId,
    operationId: input.placeCommit.operationId,
    eventType: "access.control.materialized-with-place",
    origin: "SYSTEM",
    causation: { kind: "COMMAND", id: commandId },
    aggregateRefs: [{
      aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId,
      aggregateRevision: expectedRevision === null ? 0 : expectedRevision + 1
    }],
    visibility: { scope: "SYSTEM", actorIds: [] },
    occurredAtGameSecond: input.occurredAtGameSecond,
    payloadSchemaVersion: 1,
    payload: {
      accessControlRef: input.accessControl.accessControlRef,
      connectionId: input.accessControl.connectionId,
      sourceOperationId: input.authorization.sourceOperationId,
      noTraversal: true
    }
  };
  return {
    ok: true,
    commit: {
      ...input.placeCommit,
      acceptedCommands: [...input.placeCommit.acceptedCommands, acceptedCommand],
      aggregateWrites: [...input.placeCommit.aggregateWrites, {
        aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
        aggregateId,
        expectedAggregateRevision: expectedRevision,
        payloadSchemaVersion: 1,
        payload: cloneJson(nextRegistry)
      }],
      events: [...input.placeCommit.events, event]
    }
  };
}

function validateAuthorization(
  control: AccessControlRecordV1,
  sourceOperationId: string,
  authorization: AccessControlOwnerAuthorizationV1
): string[] {
  const issues: string[] = [];
  if (authorization.schemaVersion !== 1 || authorization.authority !== "ACCESS_OWNER_DOMAIN") issues.push("access owner authorization contract is invalid");
  for (const [field, actual, expected] of [
    ["sourceOperationId", authorization.sourceOperationId, sourceOperationId],
    ["accessControlRef", authorization.accessControlRef, control.accessControlRef],
    ["connectionId", authorization.connectionId, control.connectionId],
    ["ownerDomain", authorization.ownerDomain, control.ownerDomain],
    ["permittedState", authorization.permittedState, control.state]
  ] as const) if (actual !== expected) issues.push(`${field} does not match access owner authorization`);
  if ([...authorization.sourceRefs].sort().join("\u0000") !== [...control.sourceRefs].sort().join("\u0000")) issues.push("sourceRefs do not match access owner authorization");
  return issues;
}
