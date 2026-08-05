import { cloneJson, type AggregateRecord, type CampaignId, type JsonObject } from "../core";
import { validateAccessControlRecordV1, type AccessControlRecordV1 } from "./accessControl";
import {
  ACCESS_CONTROL_REGISTRY_AGGREGATE_TYPE_V1,
  accessControlRegistryAggregateIdV1,
  type AccessControlRegistryV1
} from "./accessControlAuthority";
import {
  SOCIAL_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1,
  socialAccessAttemptRegistryAggregateIdV1,
  type SocialAccessAttemptRegistryV1,
  type SocialAccessCheckPolicyV1
} from "./socialAccessAuthority";
import type { SkillCheckOwnerResultV1 } from "./skillCheckOutcomeCommit";
import type { PreparedSkillCheckOutcomeV1, SkillCheckOutcomePolicyV1 } from "./skillCheckOutcomePreparation";

export const SOCIAL_ACCESS_SKILL_CHECK_OUTCOME_CONTRACT_V1 = "social-access-skill-check-outcome/1" as const;

export interface PendingSocialAccessSkillCheckContextV1 extends JsonObject {
  owner: "SOCIAL_ACCESS";
  resolutionRef: string;
  accessControlRef: string;
  playerActorRef: string;
  respondingActorRef: string;
  checkPolicy: SocialAccessCheckPolicyV1;
}

export function buildSocialAccessSkillCheckOutcomePolicyV1(input: {
  context: PendingSocialAccessSkillCheckContextV1;
}): { ok: true; value: SkillCheckOutcomePolicyV1 } | { ok: false; issues: string[] } {
  const { context } = input;
  const policy = context.checkPolicy;
  const issues: string[] = [];
  if (policy.proposal.domain !== "social" || policy.proposal.targetRef !== context.respondingActorRef) issues.push("social proposal context mismatch");
  if (!Number.isInteger(policy.durationSeconds) || policy.durationSeconds < 0) issues.push("social check duration is invalid");
  if (issues.length > 0) return { ok: false, issues };
  const commonPayload = {
    resolutionRef: context.resolutionRef,
    accessControlRef: context.accessControlRef,
    playerActorRef: context.playerActorRef,
    respondingActorRef: context.respondingActorRef
  };
  return { ok: true, value: {
    schemaVersion: 1,
    policyId: `${policy.proposal.checkId}:social-access-policy:1`,
    checkId: policy.proposal.checkId,
    success: {
      ownerDomain: "social",
      effectType: "social.access-check-granted",
      effectPayload: {
        ...commonPayload,
        playerFacingResponse: policy.success.playerFacingResponse,
        requirementRef: policy.success.requirementRef,
        satisfyRequirementRefs: [...policy.success.satisfyRequirementRefs],
        waiveRequirementRefs: [...policy.success.waiveRequirementRefs],
        resultingAccessState: policy.success.resultingAccessState
      },
      publicSummary: policy.success.playerFacingResponse,
      durationSeconds: policy.durationSeconds,
      retryDisposition: "RETRY_FORBIDDEN",
      publicSourceRefs: unique(policy.success.sourceRefs),
      privateSourceRefs: [],
      ruleRefs: unique(policy.ruleRefs)
    },
    failure: {
      ownerDomain: "social",
      effectType: "social.access-check-denied",
      effectPayload: { ...commonPayload, playerFacingResponse: policy.failure.playerFacingResponse },
      publicSummary: policy.failure.playerFacingResponse,
      durationSeconds: policy.durationSeconds,
      retryDisposition: "RETRY_REQUIRES_CONTEXT_CHANGE",
      publicSourceRefs: unique(policy.failure.sourceRefs),
      privateSourceRefs: [],
      ruleRefs: unique(policy.ruleRefs)
    },
    commitAuthority: false
  } };
}

export function buildSocialAccessSkillCheckOwnerResultV1(input: {
  campaignId: CampaignId;
  prepared: PreparedSkillCheckOutcomeV1;
  context: PendingSocialAccessSkillCheckContextV1;
  accessRegistryAggregate: AggregateRecord | null;
  accessRegistry: AccessControlRegistryV1;
  attemptRegistryAggregate: AggregateRecord | null;
  attemptRegistry: SocialAccessAttemptRegistryV1;
}): { ok: true; value: SkillCheckOwnerResultV1; additionalCurrentAggregates: AggregateRecord[] } | { ok: false; issues: string[] } {
  const { prepared, context } = input;
  const issues: string[] = [];
  if (prepared.consequence.ownerDomain !== "social") issues.push("prepared owner domain must be social");
  const expectedEffect = prepared.outcome === "SUCCESS" ? "social.access-check-granted" : "social.access-check-denied";
  if (prepared.consequence.effectType !== expectedEffect) issues.push("prepared social effect does not match outcome");
  const attemptIndex = input.attemptRegistry.attempts.findIndex(attempt => attempt.resolutionRef === context.resolutionRef);
  const attempt = attemptIndex < 0 ? null : input.attemptRegistry.attempts[attemptIndex];
  if (attempt === null || attempt.outcome !== "CHECK_REQUIRED" || attempt.checkProposalRef !== prepared.checkId) issues.push("pending social attempt is missing or mismatched");
  if (attempt?.checkResolution != null) issues.push("social attempt check is already resolved");
  const effectiveSecond = prepared.timeAdvanceProposal.observedAtGameSecond + prepared.narrativeResume.durationSeconds;
  const decision = prepared.outcome === "SUCCESS" ? "GRANTED" as const : "DENIED" as const;
  const nextAttempts = input.attemptRegistry.attempts.map((entry, index) => index !== attemptIndex ? cloneJson(entry) : {
    ...cloneJson(entry),
    checkResolution: {
      checkId: prepared.checkId,
      rollId: prepared.rollId,
      outcome: decision,
      playerFacingResponse: prepared.narrativeResume.publicSummary,
      resolvedAtGameSecond: effectiveSecond,
      sourceRefs: [...prepared.narrativeResume.allowedSourceRefs]
    }
  });
  const nextAttemptRegistry: SocialAccessAttemptRegistryV1 = {
    ...cloneJson(input.attemptRegistry),
    attempts: nextAttempts,
    version: input.attemptRegistry.version + 1
  };

  let nextAccessRegistry: AccessControlRegistryV1 | null = null;
  if (prepared.outcome === "SUCCESS") {
    const controlIndex = input.accessRegistry.controls.findIndex(control => control.accessControlRef === context.accessControlRef);
    const control = controlIndex < 0 ? null : input.accessRegistry.controls[controlIndex];
    if (control === null || control.state !== "CONTROLLED") issues.push("controlled social access target is missing");
    if (control !== null) {
      const effect = prepared.consequence.effectPayload;
      const satisfy = new Set(stringArray(effect.satisfyRequirementRefs));
      const waive = new Set(stringArray(effect.waiveRequirementRefs));
      const nextControl: AccessControlRecordV1 = {
        ...cloneJson(control),
        state: effect.resultingAccessState === "OPEN" ? "OPEN" : "CONTROLLED",
        requirements: control.requirements.map(requirement => satisfy.has(requirement.requirementRef)
          ? { ...cloneJson(requirement), status: "SATISFIED" as const }
          : waive.has(requirement.requirementRef)
            ? { ...cloneJson(requirement), status: "WAIVED" as const }
            : cloneJson(requirement)),
        version: control.version + 1
      };
      const controlIssues = validateAccessControlRecordV1(nextControl);
      if (nextControl.state === "OPEN" && nextControl.requirements.some(requirement => requirement.status === "ACTIVE")) controlIssues.push("social success leaves active requirements on an open control");
      issues.push(...controlIssues);
      nextAccessRegistry = {
        ...cloneJson(input.accessRegistry),
        controls: input.accessRegistry.controls.map((entry, index) => index === controlIndex ? nextControl : cloneJson(entry)),
        version: input.accessRegistry.version + 1
      };
    }
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
    commandId: `${prepared.rollId}:social-access-owner-command`,
    checkId: prepared.checkId,
    rollId: prepared.rollId,
    ownerDomain: "social",
    effectType: prepared.consequence.effectType,
    target: {
      aggregateType: SOCIAL_ACCESS_ATTEMPT_REGISTRY_AGGREGATE_TYPE_V1,
      aggregateId: socialAccessAttemptRegistryAggregateIdV1(input.campaignId),
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
