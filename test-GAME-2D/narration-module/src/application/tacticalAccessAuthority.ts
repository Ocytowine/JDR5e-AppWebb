import {
  cloneJson,
  coreError,
  opaqueId,
  type AcceptedCommandDraft,
  type CampaignId,
  type CampaignRepository,
  type CommitId,
  type CommitRecord,
  type EventDraft,
  type EventId,
  type JsonObject,
  type OperationRecord,
  type Result,
  type WriterId
} from "../core";
import {
  HANDOFF_CONTRACT_VERSION,
  HANDOFF_PAYLOAD_SCHEMA_VERSION,
  validateTacticalEncounterSeedV1,
  type ProcessHandoffV1,
  type TacticalEncounterSeedV1
} from "../handoff";
import { validateAccessControlRecordV1, type AccessControlRecordV1 } from "./accessControl";
import {
  ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
  accessControlRegistryAggregateIdV1,
  loadAccessControlRegistryV1,
  type AccessControlRegistryV1
} from "./accessControlAuthority";
import {
  tacticalHandoffAggregateIdV1,
  tacticalSeedAggregateIdV1
} from "./bastionIncidentAuthority";
import type {
  TacticalConsequenceAuthorityV1,
  TacticalConsequenceValidationV1
} from "./tacticalOutcomeIntegrationRuntime";

export const TACTICAL_ACCESS_HANDOFF_CONTRACT_V1 =
  "tactical-access-handoff/1" as const;

export interface AccessTacticalSessionSummaryV1 extends JsonObject {
  schemaVersion: 1;
  ownerDomain: "access";
  accessControlRef: string;
  boundaryRef: string;
  destinationRef: string;
  placeRef: string;
  placeDisplayName: string;
  incidentId: string;
  incidentDefinitionRef: string;
  incidentDisplayName: string;
  kind: "TACTICAL_ACCESS";
  status: "HANDOFF_ACTIVE";
  tacticalProcessId: string;
  occurredAtGameSecond: number;
  narrative: string;
  resolutionPolicyRef: string;
}

export interface StartTacticalAccessHandoffResultV1 {
  commit: CommitRecord;
  process: ProcessHandoffV1;
  seed: TacticalEncounterSeedV1;
  summary: AccessTacticalSessionSummaryV1;
}

export async function startTacticalAccessHandoffV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  operation: OperationRecord;
  control: AccessControlRecordV1;
  seed: TacticalEncounterSeedV1;
  placeDisplayName: string;
  incidentDisplayName: string;
  narrative: string;
  resolutionPolicyRef: string;
}): Promise<Result<StartTacticalAccessHandoffResultV1>> {
  const seedValidation = validateTacticalEncounterSeedV1(input.seed);
  const issues = [
    ...validateAccessControlRecordV1(input.control),
    ...seedValidation.issues
  ];
  if (
    input.operation.phase !== "RECEIVED"
    || input.operation.campaignId !== input.campaignId
  ) issues.push("a received narrative operation from the same campaign is required");
  if (
    input.control.state !== "CONTROLLED"
    || !input.control.approachDomains.includes("tactical")
  ) issues.push("the controlled threshold must explicitly accept the tactical domain");
  if (
    input.seed.campaignId !== input.campaignId
    || input.seed.sceneId !== input.control.sourceSceneId
    || input.seed.locationRef.id !== input.control.boundaryRef
  ) issues.push("the tactical seed must bind the current campaign, scene and threshold");
  if (
    !input.placeDisplayName.trim()
    || !input.incidentDisplayName.trim()
    || !input.narrative.trim()
    || !input.resolutionPolicyRef.trim()
  ) issues.push("the installed tactical access presentation and policy are required");
  if (issues.length > 0) return invalid("tactical-access.handoff-invalid", issues);

  const loaded = await loadAccessControlRegistryV1(
    input.repository,
    input.campaignId
  );
  if (!loaded.ok) return loaded;
  const current = loaded.value.state.controls.find(
    control => control.accessControlRef === input.control.accessControlRef
  );
  if (current === undefined || current.state !== "CONTROLLED") {
    return invalid("tactical-access.control-not-controlled", [
      input.control.accessControlRef
    ]);
  }
  const process: ProcessHandoffV1 = {
    schemaVersion: 1,
    contractVersion: HANDOFF_CONTRACT_VERSION,
    processId: input.seed.processId,
    campaignId: input.campaignId,
    sourceOperationId: input.operation.operationId,
    sourceSceneId: input.seed.sceneId,
    processKind: "TACTICAL_ENCOUNTER",
    status: "ACTIVE",
    createdAtGameSecond: input.seed.startedAtGameSecond,
    sourceRefs: [
      ...cloneJson(input.seed.sourceAggregateRefs),
      { kind: "access.control", id: input.control.accessControlRef }
    ],
    idempotencyKey: `tactical-access:${input.operation.idempotencyKey}`,
    version: 1,
    integratedOutcomeId: null,
    updatedAtGameSecond: null
  };
  const summary: AccessTacticalSessionSummaryV1 = {
    schemaVersion: 1,
    ownerDomain: "access",
    accessControlRef: input.control.accessControlRef,
    boundaryRef: input.control.boundaryRef,
    destinationRef: input.control.destinationRef,
    placeRef: input.control.boundaryRef,
    placeDisplayName: input.placeDisplayName,
    incidentId: `access-conflict:${input.seed.processId}`,
    incidentDefinitionRef: input.resolutionPolicyRef,
    incidentDisplayName: input.incidentDisplayName,
    kind: "TACTICAL_ACCESS",
    status: "HANDOFF_ACTIVE",
    tacticalProcessId: input.seed.processId,
    occurredAtGameSecond: input.seed.startedAtGameSecond,
    narrative: input.narrative,
    resolutionPolicyRef: input.resolutionPolicyRef
  };

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
    opaqueId<WriterId>(`${input.operation.operationId}:tactical-access-writer`),
    120_000
  );
  if (!lease.ok) return lease;
  try {
    const processAggregateId = tacticalHandoffAggregateIdV1(process.processId);
    const seedAggregateId = tacticalSeedAggregateIdV1(process.processId);
    const command: AcceptedCommandDraft = {
      schemaVersion: 1,
      contractId: "tactical-access-handoff",
      contractVersion: 1,
      commandId: opaqueId(`${input.operation.operationId}:tactical-access-command`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commandType: "access.start-tactical-handoff",
      target: {
        aggregateType: "process.handoff",
        aggregateId: processAggregateId,
        expectedAggregateRevision: null
      },
      payloadSchemaVersion: 1,
      payload: {
        accessControlRef: input.control.accessControlRef,
        processId: process.processId,
        seedId: input.seed.seedId,
        resolutionPolicyRef: input.resolutionPolicyRef
      },
      acceptedAtGameSecond: input.seed.startedAtGameSecond
    };
    const event: EventDraft = {
      schemaVersion: 1,
      eventId: opaqueId<EventId>(`${input.operation.operationId}:tactical-access-event`),
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      eventType: "access_tactical_handoff_started",
      origin: "PLAYER_INTENT",
      causation: { kind: "COMMAND", id: command.commandId },
      aggregateRefs: [{
        aggregateType: "process.handoff",
        aggregateId: processAggregateId,
        aggregateRevision: 0
      }, {
        aggregateType: "tactical.encounter-seed",
        aggregateId: seedAggregateId,
        aggregateRevision: 0
      }],
      visibility: { scope: "PLAYER_VISIBLE", actorIds: [] },
      occurredAtGameSecond: input.seed.startedAtGameSecond,
      payloadSchemaVersion: 1,
      payload: cloneJson(summary)
    };
    const committed = await input.repository.commit({
      campaignId: input.campaignId,
      operationId: input.operation.operationId,
      commitId: opaqueId<CommitId>(`${input.operation.operationId}:commit`),
      idempotencyKey: input.operation.idempotencyKey,
      requestFingerprint: input.operation.requestFingerprint,
      expectedCampaignRevision: input.operation.observedCampaignRevision,
      writerLease: lease.value,
      acceptedCommands: [command],
      aggregateWrites: [{
        aggregateType: "process.handoff",
        aggregateId: processAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
        payload: process
      }, {
        aggregateType: "tactical.encounter-seed",
        aggregateId: seedAggregateId,
        expectedAggregateRevision: null,
        payloadSchemaVersion: HANDOFF_PAYLOAD_SCHEMA_VERSION,
        payload: input.seed
      }],
      events: [event],
      outboxTasks: []
    });
    if (!committed.ok) return committed;
    const commit = await input.repository.getCommit(committed.value.commitId);
    return commit.ok
      ? { ok: true, value: { commit: commit.value, process, seed: input.seed, summary } }
      : commit;
  } finally {
    await input.repository.releaseWriterLease(lease.value);
  }
}

export interface TacticalAccessResolutionDecisionV1 extends JsonObject {
  schemaVersion: 1;
  resolutionCode: string;
  resultingAccessState: "OPEN" | "CONTROLLED" | "BLOCKED";
  waiveRequirementRefs: string[];
  publicNarrative: string;
}

export interface TacticalAccessResolutionPolicyV1 {
  readonly policyRef: string;
  resolve(input: {
    accessControlRef: string;
    processId: string;
    outcomeId: string;
    endCondition: string;
  }): Result<TacticalAccessResolutionDecisionV1>
    | Promise<Result<TacticalAccessResolutionDecisionV1>>;
}

export function createTacticalAccessConsequenceAuthorityV1(
  policy: TacticalAccessResolutionPolicyV1
): TacticalConsequenceAuthorityV1 {
  return {
    ownerDomain: "access",
    authorityRef: `tactical-access-consequence-authority/1:${policy.policyRef}`,
    async validate(input) {
      const candidateId = field(input.candidate, "candidateId");
      const accessControlRef = field(input.candidate, "accessControlRef");
      const processId = field(input.candidate, "processId");
      const endCondition = field(input.candidate, "endCondition");
      const resolutionPolicyRef = field(
        input.candidate,
        "resolutionPolicyRef"
      );
      if (
        candidateId === null
        || accessControlRef === null
        || processId !== input.process.processId
        || endCondition !== input.outcome.endCondition
        || resolutionPolicyRef !== policy.policyRef
      ) return invalid("tactical-access.candidate-invalid", [
        "the access candidate does not match the committed process and outcome"
      ]);
      const registry = await loadAccessControlRegistryV1(
        input.repository,
        input.campaignId
      );
      if (!registry.ok) return registry;
      if (registry.value.aggregate === null) {
        return invalid("tactical-access.registry-missing", [
          "access registry must exist before tactical integration"
        ]);
      }
      const index = registry.value.state.controls.findIndex(
        control => control.accessControlRef === accessControlRef
      );
      const control = registry.value.state.controls[index];
      if (
        control === undefined
        || control.state !== "CONTROLLED"
        || !control.approachDomains.includes("tactical")
      ) return invalid("tactical-access.owner-state-mismatch", [
        "the threshold is no longer controlled by the tactical access handoff"
      ]);
      const resolved = await policy.resolve({
        accessControlRef,
        processId,
        outcomeId: input.outcome.outcomeId,
        endCondition
      });
      if (!resolved.ok) return resolved;
      const decision = resolved.value;
      const known = new Set(control.requirements.map(value => value.requirementRef));
      if (
        decision.schemaVersion !== 1
        || !decision.resolutionCode.trim()
        || !decision.publicNarrative.trim()
        || decision.waiveRequirementRefs.some(ref => !known.has(ref))
        || (decision.resultingAccessState === "OPEN"
          && control.requirements.some(requirement =>
            requirement.status === "ACTIVE"
            && !decision.waiveRequirementRefs.includes(requirement.requirementRef)
          ))
      ) return invalid("tactical-access.decision-invalid", [
        "the tactical access resolution is incomplete or inconsistent"
      ]);
      const nextControl: AccessControlRecordV1 = {
        ...cloneJson(control),
        state: decision.resultingAccessState,
        requirements: control.requirements.map(requirement =>
          decision.waiveRequirementRefs.includes(requirement.requirementRef)
            ? { ...cloneJson(requirement), status: "WAIVED" as const }
            : cloneJson(requirement)
        ),
        sourceRefs: [...new Set([
          ...control.sourceRefs,
          policy.policyRef,
          `tactical-outcome:${input.outcome.outcomeId}`
        ])],
        version: control.version + 1
      };
      const recordIssues = validateAccessControlRecordV1(nextControl);
      if (recordIssues.length > 0) {
        return invalid("tactical-access.next-control-invalid", recordIssues);
      }
      const nextRegistry: AccessControlRegistryV1 = {
        ...cloneJson(registry.value.state),
        controls: registry.value.state.controls.map((value, candidateIndex) =>
          candidateIndex === index ? nextControl : cloneJson(value)
        ),
        version: registry.value.state.version + 1
      };
      const validation: TacticalConsequenceValidationV1 = {
        schemaVersion: 1,
        authorityRef: `tactical-access-consequence-authority/1:${policy.policyRef}`,
        candidateId,
        ownerDomain: "access",
        resolutionCode: decision.resolutionCode,
        publicNarrative: decision.publicNarrative,
        deltas: [{
          deltaId: `${candidateId}:registry`,
          aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
          aggregateId: accessControlRegistryAggregateIdV1(input.campaignId),
          expectedAggregateRevision: registry.value.aggregate.aggregateRevision,
          payloadSchemaVersion: registry.value.aggregate.payloadSchemaVersion,
          payload: cloneJson(nextRegistry),
          summary: `Acces ${accessControlRef}: ${decision.resolutionCode}`
        }]
      };
      return { ok: true, value: validation };
    }
  };
}

function field(value: JsonObject, key: string): string | null {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate
    : null;
}

function invalid<T>(messageKey: string, issues: string[]): Result<T> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
