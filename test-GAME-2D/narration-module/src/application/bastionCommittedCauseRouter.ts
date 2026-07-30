import {
  cloneJson,
  computeJsonFingerprint,
  coreError,
  opaqueId,
  type CampaignId,
  type CampaignRecord,
  type CampaignRepository,
  type EventRecord,
  type JsonObject,
  type OperationId,
  type Result
} from "../core";
import {
  loadBastionRegistryV1,
  type BastionRecordV1
} from "./bastionAuthority";
import {
  BASTION_INCIDENT_CONTRACT_V1,
  type HandleBastionIncidentCommandV1
} from "./bastionIncidentAuthority";

export const BASTION_COMMITTED_CAUSE_ROUTER_V1 =
  "bastion-committed-cause-router/1" as const;

export type BastionCommittedCauseSourceKindV1 =
  | "WORLD_SIMULATION"
  | "PLOT";

export interface BastionCommittedCauseRoutingDecisionV1 extends JsonObject {
  schemaVersion: 1;
  sourceKind: BastionCommittedCauseSourceKindV1;
  disposition: "IGNORE" | "TARGET";
  reasonCode: string;
  bastionId: string | null;
}

/**
 * Cette politique connaît le schéma autoritaire de la source. Le routeur ne
 * tente jamais de déduire une cible depuis eventType ou depuis une phrase.
 */
export interface BastionCommittedCauseRoutingPolicyV1 {
  readonly policyRef: string;
  evaluate(input: {
    campaign: CampaignRecord;
    sourceEvent: EventRecord;
    activeBastions: BastionRecordV1[];
  }):
    | BastionCommittedCauseRoutingDecisionV1
    | Promise<BastionCommittedCauseRoutingDecisionV1>;
}

export interface BastionCommittedCauseRoutingResultV1 extends JsonObject {
  schemaVersion: 1;
  contractVersion: typeof BASTION_COMMITTED_CAUSE_ROUTER_V1;
  status: "IGNORED" | "TARGETED";
  reasonCode: string;
  sourceKind: BastionCommittedCauseSourceKindV1 | null;
  sourceOperationId: string;
  sourceEventId: string;
  bastionId: string | null;
  command: HandleBastionIncidentCommandV1 | null;
}

export async function routeCommittedBastionCauseV1(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sourceOperationId: string;
  sourceEventId: string;
  policy: BastionCommittedCauseRoutingPolicyV1 | null;
}): Promise<Result<BastionCommittedCauseRoutingResultV1>> {
  if (
    !nonEmpty(input.sourceOperationId)
    || !nonEmpty(input.sourceEventId)
  ) {
    return invalid("bastion.cause-router.invalid-source", [
      "source operation and event identities are required"
    ]);
  }
  if (input.policy === null || !nonEmpty(input.policy.policyRef)) {
    return invalid("bastion.cause-router.policy-required", [
      "an explicit cause routing policy is required"
    ]);
  }
  const [campaign, registry, source] = await Promise.all([
    input.repository.getCampaign(input.campaignId),
    loadBastionRegistryV1(input.repository, input.campaignId),
    loadCommittedSourceEvent({
      repository: input.repository,
      campaignId: input.campaignId,
      sourceOperationId: input.sourceOperationId,
      sourceEventId: input.sourceEventId
    })
  ]);
  if (!campaign.ok) return campaign;
  if (!registry.ok) return registry;
  if (!source.ok) return source;
  const activeBastions = registry.value.state.bastions
    .filter(value => value.status === "ACTIVE")
    .sort((left, right) => left.bastionId.localeCompare(right.bastionId));
  if (activeBastions.length === 0) {
    return {
      ok: true,
      value: ignored(input, "NO_ACTIVE_BASTION", null)
    };
  }
  const decision = await input.policy.evaluate({
    campaign: cloneJson(campaign.value),
    sourceEvent: cloneJson(source.value),
    activeBastions: cloneJson(activeBastions)
  });
  const issues = validateDecision(decision, source.value);
  if (issues.length > 0) {
    return invalid("bastion.cause-router.invalid-decision", issues);
  }
  if (decision.disposition === "IGNORE") {
    return {
      ok: true,
      value: ignored(input, decision.reasonCode, decision.sourceKind)
    };
  }
  const target = activeBastions.find(
    value => value.bastionId === decision.bastionId
  );
  if (target === undefined) {
    return invalid("bastion.cause-router.target-unavailable", [
      "the policy target is not an active bastion"
    ]);
  }
  const token = (
    await computeJsonFingerprint({
      contractVersion: BASTION_COMMITTED_CAUSE_ROUTER_V1,
      policyRef: input.policy.policyRef,
      campaignId: input.campaignId,
      sourceOperationId: input.sourceOperationId,
      sourceEventId: input.sourceEventId,
      bastionId: target.bastionId
    })
  ).replace(/^sha256:/u, "").slice(0, 40);
  const command: HandleBastionIncidentCommandV1 = {
    schemaVersion: 1,
    contractVersion: BASTION_INCIDENT_CONTRACT_V1,
    clientRequestId: `route-bastion-cause-${token}`,
    bastionId: target.bastionId,
    sourceOperationId: input.sourceOperationId,
    sourceEventId: input.sourceEventId
  };
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      contractVersion: BASTION_COMMITTED_CAUSE_ROUTER_V1,
      status: "TARGETED",
      reasonCode: decision.reasonCode,
      sourceKind: decision.sourceKind,
      sourceOperationId: input.sourceOperationId,
      sourceEventId: input.sourceEventId,
      bastionId: target.bastionId,
      command
    }
  };
}

async function loadCommittedSourceEvent(input: {
  repository: CampaignRepository;
  campaignId: CampaignId;
  sourceOperationId: string;
  sourceEventId: string;
}): Promise<Result<EventRecord>> {
  const operation = await input.repository.getOperation(
    opaqueId<OperationId>(input.sourceOperationId)
  );
  if (
    !operation.ok
    || operation.value.campaignId !== input.campaignId
    || operation.value.commitId === null
    || !["COMMITTED_PENDING_RENDER", "COMPLETED"].includes(
      operation.value.phase
    )
  ) {
    return invalid("bastion.cause-router.source-not-committed", [
      "source operation must be committed in this campaign"
    ]);
  }
  let cursor: {
    commitSequence: number;
    eventSequence: number;
  } | null = null;
  while (true) {
    const page = await input.repository.listEvents(
      input.campaignId,
      cursor,
      1_024
    );
    if (!page.ok) return page;
    const found = page.value.find(event =>
      event.eventId === input.sourceEventId
      && event.operationId === operation.value.operationId
      && event.commitId === operation.value.commitId
    );
    if (found !== undefined) return { ok: true, value: found };
    const last = page.value.at(-1);
    if (last === undefined || page.value.length < 1_024) {
      return invalid("bastion.cause-router.source-not-committed", [
        "source event is absent from the committed source operation"
      ]);
    }
    cursor = {
      commitSequence: last.commitSequence,
      eventSequence: last.eventSequence
    };
  }
}

function validateDecision(
  decision: BastionCommittedCauseRoutingDecisionV1,
  source: EventRecord
): string[] {
  const issues: string[] = [];
  if (decision.schemaVersion !== 1) issues.push("schemaVersion must be 1");
  if (!["WORLD_SIMULATION", "PLOT"].includes(decision.sourceKind)) {
    issues.push("sourceKind is invalid");
  }
  if (!["IGNORE", "TARGET"].includes(decision.disposition)) {
    issues.push("disposition is invalid");
  }
  if (!nonEmpty(decision.reasonCode)) issues.push("reasonCode is required");
  if (
    decision.disposition === "TARGET"
    && !nonEmpty(decision.bastionId)
  ) {
    issues.push("a targeted decision requires bastionId");
  }
  if (
    decision.disposition === "IGNORE"
    && decision.bastionId !== null
  ) {
    issues.push("an ignored decision cannot select a bastion");
  }
  if (
    decision.sourceKind === "WORLD_SIMULATION"
    && source.origin !== "WORLD_SIMULATION"
  ) {
    issues.push("world cause must originate from WORLD_SIMULATION");
  }
  if (
    decision.sourceKind === "PLOT"
    && (
      source.origin !== "SCHEDULED_EFFECT"
      || !source.eventType.startsWith("plot.")
    )
  ) {
    issues.push("plot cause must be a scheduled plot event");
  }
  return issues;
}

function ignored(
  input: {
    sourceOperationId: string;
    sourceEventId: string;
  },
  reasonCode: string,
  sourceKind: BastionCommittedCauseSourceKindV1 | null
): BastionCommittedCauseRoutingResultV1 {
  return {
    schemaVersion: 1,
    contractVersion: BASTION_COMMITTED_CAUSE_ROUTER_V1,
    status: "IGNORED",
    reasonCode,
    sourceKind,
    sourceOperationId: input.sourceOperationId,
    sourceEventId: input.sourceEventId,
    bastionId: null,
    command: null
  };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0;
}

function invalid(messageKey: string, issues: string[]): Result<never> {
  return {
    ok: false,
    error: coreError("VALIDATION_FAILED", messageKey, { issues })
  };
}
