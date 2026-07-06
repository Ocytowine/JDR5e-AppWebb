import type { JsonObject } from "../../core/contracts/types";

export type RuleKindV1 = "SYSTEM_INVARIANT" | "GENERAL" | "HOUSE" | "CONTENT_SPECIFIC" | "CAMPAIGN_OPTION";
export type RuleStatusV1 = "ACTIVE" | "DEPRECATED" | "REPLACED";
export type RuleExecutionV1 = "DETERMINISTIC" | "ADJUDICATION_REQUIRED" | "DESCRIPTIVE";

export interface RuleRefV1 {
  ruleId: string;
  ruleVersion: number;
}

export interface RuleManifestRefV1 extends RuleRefV1 {
  fingerprint: `sha256:${string}`;
}

export interface RuleExampleV1 {
  title: string;
  input: JsonObject;
  expected: JsonObject;
}

export interface RuleDefinitionV1 {
  schemaVersion: 1;
  ruleId: string;
  ruleVersion: number;
  title: string;
  normativeText: string;
  kind: RuleKindV1;
  ownerDomain: string;
  status: RuleStatusV1;
  execution: RuleExecutionV1;
  executorId: string | null;
  parameters: JsonObject;
  scope: JsonObject;
  overrides: RuleRefV1[];
  specializes: RuleRefV1[];
  incompatibleWith: RuleRefV1[];
  examples: RuleExampleV1[];
  acceptanceScenarioIds: string[];
}

export interface RulesetManifestV1 {
  schemaVersion: 1;
  rulesetId: string;
  rulesetVersion: number;
  compatibleContentPackages: Array<{
    packageId: string;
    minimumVersion: number;
    maximumVersion: number;
  }>;
  rules: RuleManifestRefV1[];
  rootFingerprint: `sha256:${string}`;
}

export interface RuleExecutorContextV1 {
  rule: RuleDefinitionV1;
  effectiveParameters: JsonObject;
  contentReferences: string[];
}

export interface RuleExecutorV1 {
  executorId: string;
  contractVersion: number;
  execute(input: JsonObject, context: RuleExecutorContextV1): JsonObject | Promise<JsonObject>;
}

export interface RuleDecisionV1 {
  schemaVersion: 1;
  ruleId: string;
  ruleVersion: number;
  executorId: string;
  executorContractVersion: number;
  effectiveParameters: JsonObject;
  contentReferences: string[];
  output: JsonObject;
}

export type RuleRegistryDiagnosticCodeV1 =
  | "RULESET_SCHEMA_INVALID"
  | "RULESET_CONTENT_INCOMPATIBLE"
  | "RULESET_DUPLICATE_RULE"
  | "RULESET_RULE_MISSING"
  | "RULESET_FINGERPRINT_MISMATCH"
  | "RULESET_ROOT_FINGERPRINT_MISMATCH"
  | "RULESET_EXECUTOR_MISSING"
  | "RULESET_EXECUTOR_FORBIDDEN"
  | "RULESET_RELATION_INVALID"
  | "RULESET_RELATION_CYCLE"
  | "RULESET_CONFLICT"
  | "RULESET_MVP_RULE_MISSING";

export interface RuleRegistryDiagnosticV1 {
  code: RuleRegistryDiagnosticCodeV1;
  path: string;
  details: JsonObject;
}

export type RuleRegistryLoadResultV1 =
  | { ok: true; value: import("./RuleRegistry").RuleRegistryV1 }
  | { ok: false; diagnostics: RuleRegistryDiagnosticV1[] };

export interface LoadRuleRegistryOptionsV1 {
  contentPackageId: string;
  contentPackageVersion: number;
  manifest: RulesetManifestV1;
  definitions: RuleDefinitionV1[];
  executors: RuleExecutorV1[];
  requireMvpInventory?: boolean;
}

export type RuleExecutionResultV1 =
  | { ok: true; value: RuleDecisionV1 }
  | { ok: false; code: "RULE_NOT_FOUND" | "RULE_NOT_ACTIVE" | "RULE_NOT_DETERMINISTIC" | "RULE_EXECUTION_FAILED" };

export type RuleSelectionResultV1 =
  | { ok: true; rules: RuleDefinitionV1[] }
  | { ok: false; code: "RULE_NOT_FOUND" | "RULE_NOT_ACTIVE" };

export interface AdjudicationRecordV1 {
  schemaVersion: 1;
  adjudicationId: string;
  campaignId: string;
  caseFingerprint: `sha256:${string}`;
  status: "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  question: string;
  assumptions: string[];
  citedRules: RuleRefV1[];
  ruling: JsonObject;
  scope: JsonObject;
  acceptedAtGameSecond: number | null;
  supersedesAdjudicationId: string | null;
}

export interface CreateAdjudicationRecordInputV1 {
  adjudicationId: string;
  campaignId: string;
  status: AdjudicationRecordV1["status"];
  question: string;
  assumptions: string[];
  citedRules: RuleRefV1[];
  relevantState: JsonObject;
  ruling: JsonObject;
  scope: JsonObject;
  acceptedAtGameSecond: number | null;
  supersedesAdjudicationId: string | null;
}
