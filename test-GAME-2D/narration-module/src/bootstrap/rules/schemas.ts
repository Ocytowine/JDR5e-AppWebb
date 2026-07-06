const id = { type: "string", pattern: "^[a-z][a-z0-9._:-]{2,127}$" } as const;
const positiveInteger = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER } as const;
const nonEmptyText = { type: "string", minLength: 1, maxLength: 32_768, pattern: ".*\\S.*" } as const;
const fingerprint = { type: "string", pattern: "^sha256:[0-9a-f]{64}$" } as const;
const scenarioId = { type: "string", pattern: "^[A-Z][A-Z0-9-]{2,127}$" } as const;
const jsonObject = { type: "object", additionalProperties: true } as const;

export const ruleRefSchema = {
  type: "object", additionalProperties: false, required: ["ruleId", "ruleVersion"],
  properties: { ruleId: id, ruleVersion: positiveInteger }
} as const;

export const ruleManifestRefSchema = {
  type: "object", additionalProperties: false, required: ["ruleId", "ruleVersion", "fingerprint"],
  properties: { ruleId: id, ruleVersion: positiveInteger, fingerprint }
} as const;

export const ruleExampleSchema = {
  type: "object", additionalProperties: false, required: ["title", "input", "expected"],
  properties: { title: nonEmptyText, input: jsonObject, expected: jsonObject }
} as const;

export const ruleDefinitionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion", "ruleId", "ruleVersion", "title", "normativeText", "kind", "ownerDomain",
    "status", "execution", "executorId", "parameters", "scope", "overrides", "specializes",
    "incompatibleWith", "examples", "acceptanceScenarioIds"
  ],
  properties: {
    schemaVersion: { type: "integer", const: 1 }, ruleId: id, ruleVersion: positiveInteger,
    title: nonEmptyText, normativeText: nonEmptyText,
    kind: { type: "string", enum: ["SYSTEM_INVARIANT", "GENERAL", "HOUSE", "CONTENT_SPECIFIC", "CAMPAIGN_OPTION"] },
    ownerDomain: id,
    status: { type: "string", enum: ["ACTIVE", "DEPRECATED", "REPLACED"] },
    execution: { type: "string", enum: ["DETERMINISTIC", "ADJUDICATION_REQUIRED", "DESCRIPTIVE"] },
    executorId: { anyOf: [id, { type: "null" }] },
    parameters: jsonObject, scope: jsonObject,
    overrides: { type: "array", items: ruleRefSchema, maxItems: 256 },
    specializes: { type: "array", items: ruleRefSchema, maxItems: 256 },
    incompatibleWith: { type: "array", items: ruleRefSchema, maxItems: 256 },
    examples: { type: "array", items: ruleExampleSchema, maxItems: 256 },
    acceptanceScenarioIds: { type: "array", items: scenarioId, maxItems: 256 }
  }
} as const;

export const rulesetManifestSchema = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "rulesetId", "rulesetVersion", "compatibleContentPackages", "rules", "rootFingerprint"],
  properties: {
    schemaVersion: { type: "integer", const: 1 }, rulesetId: id, rulesetVersion: positiveInteger,
    compatibleContentPackages: {
      type: "array", maxItems: 256, items: {
        type: "object", additionalProperties: false,
        required: ["packageId", "minimumVersion", "maximumVersion"],
        properties: { packageId: id, minimumVersion: positiveInteger, maximumVersion: positiveInteger }
      }
    },
    rules: { type: "array", items: ruleManifestRefSchema, maxItems: 1_024 },
    rootFingerprint: fingerprint
  }
} as const;
