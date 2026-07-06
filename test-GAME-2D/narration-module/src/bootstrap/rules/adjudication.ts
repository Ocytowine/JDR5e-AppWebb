import { cloneJson, computeJsonFingerprint } from "../../core/canonical-json/canonicalJson";
import type { AdjudicationRecordV1, CreateAdjudicationRecordInputV1, RuleRefV1 } from "./types";

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${label} must not be empty.`);
  return normalized;
}

function normalizedRules(rules: RuleRefV1[]): RuleRefV1[] {
  const normalized = rules.map(rule => ({
    ruleId: requiredText(rule.ruleId, "ruleId"),
    ruleVersion: rule.ruleVersion
  })).sort((left, right) => left.ruleId.localeCompare(right.ruleId) || left.ruleVersion - right.ruleVersion);
  if (normalized.some(rule => !Number.isInteger(rule.ruleVersion) || rule.ruleVersion < 1)) {
    throw new TypeError("ruleVersion must be a positive integer.");
  }
  if (new Set(normalized.map(rule => `${rule.ruleId}\u0000${rule.ruleVersion}`)).size !== normalized.length) {
    throw new TypeError("citedRules must be unique.");
  }
  return normalized;
}

export async function createAdjudicationRecordV1(
  input: CreateAdjudicationRecordInputV1
): Promise<AdjudicationRecordV1> {
  const adjudicationId = requiredText(input.adjudicationId, "adjudicationId");
  const campaignId = requiredText(input.campaignId, "campaignId");
  const question = requiredText(input.question, "question");
  const assumptions = [...new Set(input.assumptions.map(value => requiredText(value, "assumption")))].sort();
  const citedRules = normalizedRules(input.citedRules);
  if (!["ACCEPTED", "REJECTED", "SUPERSEDED"].includes(input.status)) {
    throw new TypeError("Unsupported adjudication status.");
  }
  if (input.acceptedAtGameSecond !== null && (!Number.isInteger(input.acceptedAtGameSecond) || input.acceptedAtGameSecond < 0)) {
    throw new TypeError("acceptedAtGameSecond must be null or a non-negative integer.");
  }
  if (input.status === "ACCEPTED" && input.acceptedAtGameSecond === null) {
    throw new TypeError("An accepted adjudication requires acceptedAtGameSecond.");
  }
  const relevantState = cloneJson(input.relevantState);
  const caseFingerprint = await computeJsonFingerprint({
    schemaVersion: 1,
    question,
    assumptions,
    citedRules,
    relevantState
  }) as `sha256:${string}`;
  return {
    schemaVersion: 1,
    adjudicationId,
    campaignId,
    caseFingerprint,
    status: input.status,
    question,
    assumptions,
    citedRules,
    ruling: cloneJson(input.ruling),
    scope: cloneJson(input.scope),
    acceptedAtGameSecond: input.acceptedAtGameSecond,
    supersedesAdjudicationId: input.supersedesAdjudicationId === null
      ? null
      : requiredText(input.supersedesAdjudicationId, "supersedesAdjudicationId")
  };
}
