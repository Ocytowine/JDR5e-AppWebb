import { cloneJson, type AggregateRecord, type CampaignId, type JsonObject } from "../core";
import { validateAccessControlRecordV1, type AccessControlRecordV1 } from "./accessControl";
import {
  ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
  accessControlRegistryAggregateIdV1,
  type AccessControlRegistryV1
} from "./accessControlAuthority";
import {
  RULES_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1,
  rulesAccessAttemptRegistryAggregateIdV1,
  type RulesAccessAttemptRegistryV1,
  type RulesAccessCheckPolicyV1
} from "./rulesAccessAuthority";
import type { SkillCheckOwnerResultV1 } from "./skillCheckOutcomeCommit";
import type { PreparedSkillCheckOutcomeV1, SkillCheckOutcomePolicyV1 } from "./skillCheckOutcomePreparation";

export interface PendingRulesAccessSkillCheckContextV1 extends JsonObject {
  owner: "RULES_ACCESS";
  resolutionRef: string;
  accessControlRef: string;
  actorRef: string;
  deviceRef: string;
  checkPolicy: RulesAccessCheckPolicyV1;
}

export function buildRulesAccessSkillCheckOutcomePolicyV1(input: {
  context: PendingRulesAccessSkillCheckContextV1;
}): { ok: true; value: SkillCheckOutcomePolicyV1 } | { ok: false; issues: string[] } {
  const { context } = input;
  const policy = context.checkPolicy;
  const issues: string[] = [];
  if (policy.proposal.domain !== "rules" || policy.proposal.targetRef !== context.deviceRef) issues.push("rules proposal context mismatch");
  if (!Number.isInteger(policy.durationSeconds) || policy.durationSeconds <= 0) issues.push("rules check duration is invalid");
  if (policy.success.consumedItemInstanceIds.length > 0 || policy.failure.consumedItemInstanceIds.length > 0) issues.push("item consumption is not installed for rules access yet");
  if (issues.length > 0) return { ok: false, issues };
  const common = {
    resolutionRef: context.resolutionRef,
    accessControlRef: context.accessControlRef,
    actorRef: context.actorRef,
    deviceRef: context.deviceRef,
    method: policy.method
  };
  return { ok: true, value: {
    schemaVersion: 1,
    policyId: `${policy.proposal.checkId}:rules-access-policy:1`,
    checkId: policy.proposal.checkId,
    success: {
      ownerDomain: "rules",
      effectType: "rules.access-check-succeeded",
      effectPayload: {
        ...common,
        playerFacingText: policy.success.playerFacingText,
        satisfyRequirementRefs: [...policy.success.satisfyRequirementRefs],
        waiveRequirementRefs: [...policy.success.waiveRequirementRefs],
        resultingAccessState: policy.success.resultingAccessState,
        noise: policy.success.noise,
        consumedItemInstanceIds: []
      },
      publicSummary: policy.success.playerFacingText,
      durationSeconds: policy.durationSeconds,
      retryDisposition: "RETRY_FORBIDDEN",
      publicSourceRefs: unique(policy.success.sourceRefs),
      privateSourceRefs: [],
      ruleRefs: unique(policy.ruleRefs)
    },
    failure: {
      ownerDomain: "rules",
      effectType: "rules.access-check-failed",
      effectPayload: {
        ...common,
        playerFacingText: policy.failure.playerFacingText,
        resultingAccessState: policy.failure.resultingAccessState,
        noise: policy.failure.noise,
        consumedItemInstanceIds: []
      },
      publicSummary: policy.failure.playerFacingText,
      durationSeconds: policy.durationSeconds,
      retryDisposition: "RETRY_REQUIRES_CONTEXT_CHANGE",
      publicSourceRefs: unique(policy.failure.sourceRefs),
      privateSourceRefs: [],
      ruleRefs: unique(policy.ruleRefs)
    },
    commitAuthority: false
  } };
}

export function buildRulesAccessSkillCheckOwnerResultV1(input: {
  campaignId: CampaignId;
  prepared: PreparedSkillCheckOutcomeV1;
  context: PendingRulesAccessSkillCheckContextV1;
  accessRegistryAggregate: AggregateRecord | null;
  accessRegistry: AccessControlRegistryV1;
  attemptRegistryAggregate: AggregateRecord | null;
  attemptRegistry: RulesAccessAttemptRegistryV1;
}): { ok: true; value: SkillCheckOwnerResultV1; additionalCurrentAggregates: AggregateRecord[] } | { ok: false; issues: string[] } {
  const { prepared, context } = input;
  const issues: string[] = [];
  if (prepared.consequence.ownerDomain !== "rules") issues.push("prepared owner domain must be rules");
  const expectedEffect = prepared.outcome === "SUCCESS" ? "rules.access-check-succeeded" : "rules.access-check-failed";
  if (prepared.consequence.effectType !== expectedEffect) issues.push("prepared rules effect does not match outcome");
  const attemptIndex = input.attemptRegistry.attempts.findIndex(attempt => attempt.resolutionRef === context.resolutionRef);
  const attempt = attemptIndex < 0 ? null : input.attemptRegistry.attempts[attemptIndex];
  if (attempt === null || attempt.checkId !== prepared.checkId || attempt.checkResolution !== null) issues.push("pending rules attempt is missing, mismatched or already resolved");
  const effect = prepared.consequence.effectPayload;
  if (effect.accessControlRef !== context.accessControlRef || effect.actorRef !== context.actorRef || effect.deviceRef !== context.deviceRef) issues.push("rules outcome context mismatch");
  const resultingState = prepared.outcome === "SUCCESS"
    ? effect.resultingAccessState === "OPEN" ? "OPEN" as const : "CONTROLLED" as const
    : effect.resultingAccessState === "BLOCKED" ? "BLOCKED" as const : "CONTROLLED" as const;
  const noise = effect.noise === "LOUD" ? "LOUD" as const : effect.noise === "AUDIBLE" ? "AUDIBLE" as const : "NONE" as const;
  const effectiveSecond = prepared.timeAdvanceProposal.observedAtGameSecond + prepared.narrativeResume.durationSeconds;
  const nextAttemptRegistry: RulesAccessAttemptRegistryV1 = {
    ...cloneJson(input.attemptRegistry),
    attempts: input.attemptRegistry.attempts.map((entry, index) => index !== attemptIndex ? cloneJson(entry) : {
      ...cloneJson(entry),
      checkResolution: {
        rollId: prepared.rollId,
        outcome: prepared.outcome,
        resultingAccessState: resultingState,
        noise,
        consumedItemInstanceIds: [],
        playerFacingText: prepared.narrativeResume.publicSummary,
        resolvedAtGameSecond: effectiveSecond,
        sourceRefs: [...prepared.narrativeResume.allowedSourceRefs]
      }
    }),
    version: input.attemptRegistry.version + 1
  };

  const controlIndex = input.accessRegistry.controls.findIndex(control => control.accessControlRef === context.accessControlRef);
  const control = controlIndex < 0 ? null : input.accessRegistry.controls[controlIndex];
  if (control === null || control.state !== "CONTROLLED") issues.push("controlled rules access target is missing");
  let nextAccessRegistry: AccessControlRegistryV1 | null = null;
  if (control !== null && resultingState !== "CONTROLLED") {
    const satisfy = new Set(stringArray(effect.satisfyRequirementRefs));
    const waive = new Set(stringArray(effect.waiveRequirementRefs));
    const nextControl: AccessControlRecordV1 = {
      ...cloneJson(control),
      state: resultingState,
      requirements: control.requirements.map(requirement => satisfy.has(requirement.requirementRef)
        ? { ...cloneJson(requirement), status: "SATISFIED" as const }
        : waive.has(requirement.requirementRef)
          ? { ...cloneJson(requirement), status: "WAIVED" as const }
          : cloneJson(requirement)),
      version: control.version + 1
    };
    const controlIssues = validateAccessControlRecordV1(nextControl);
    if (nextControl.state === "OPEN" && nextControl.requirements.some(requirement => requirement.status === "ACTIVE")) controlIssues.push("rules success leaves active requirements on an open control");
    issues.push(...controlIssues);
    nextAccessRegistry = {
      ...cloneJson(input.accessRegistry),
      controls: input.accessRegistry.controls.map((entry, index) => index === controlIndex ? nextControl : cloneJson(entry)),
      version: input.accessRegistry.version + 1
    };
  }
  if (issues.length > 0) return { ok: false, issues };
  const additionalTargets = nextAccessRegistry === null ? [] : [{
    aggregateType: ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
    aggregateId: accessControlRegistryAggregateIdV1(input.campaignId),
    expectedAggregateRevision: input.accessRegistryAggregate?.aggregateRevision ?? null,
    nextPayload: nextAccessRegistry
  }];
  return { ok: true, value: {
    schemaVersion: 1,
    contractVersion: "skill-check-outcome-commit/1",
    commandId: `${prepared.rollId}:rules-access-owner-command`,
    checkId: prepared.checkId,
    rollId: prepared.rollId,
    ownerDomain: "rules",
    effectType: prepared.consequence.effectType,
    target: {
      aggregateType: RULES_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: rulesAccessAttemptRegistryAggregateIdV1(input.campaignId),
      expectedAggregateRevision: input.attemptRegistryAggregate?.aggregateRevision ?? null
    },
    nextPayload: nextAttemptRegistry,
    additionalTargets,
    publicSourceRefs: [...prepared.narrativeResume.allowedSourceRefs],
    ownerAuthority: true
  }, additionalCurrentAggregates: input.accessRegistryAggregate === null ? [] : [input.accessRegistryAggregate] };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
