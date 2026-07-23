import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { canonicalizeJson, cloneJson, computeJsonFingerprint } from "../../core/canonical-json/canonicalJson";
import type { JsonObject } from "../../core/contracts/types";
import { ruleDefinitionSchema, rulesetManifestSchema } from "./schemas";
import type {
  LoadRuleRegistryOptionsV1,
  RuleDecisionV1,
  RuleDefinitionV1,
  RuleExecutionResultV1,
  RuleExecutorV1,
  RuleRefV1,
  RuleRegistryDiagnosticCodeV1,
  RuleRegistryDiagnosticV1,
  RuleRegistryLoadResultV1,
  RuleSelectionResultV1,
  RulesetManifestV1
} from "./types";

export const MVP_RULE_IDS_V1 = [
  "core.character.ability-modifier",
  "core.character.global-level",
  "core.character.proficiency-bonus",
  "core.character.maximum-hit-points",
  "core.character.armor-class",
  "core.character.passive-perception",
  "core.character.capability-availability",
  "core.check.difficulty-class",
  "core.inventory.containment",
  "core.inventory.equipment-slots",
  "core.inventory.physical-currency",
  "core.transaction.atomicity",
  "core.character.visible-appearance",
  "house.social.observable-appearance",
  "house.action.impossible-before-roll",
  "house.rules.local-authority"
] as const;

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true, strict: true });
const validateManifest: ValidateFunction<RulesetManifestV1> = ajv.compile(rulesetManifestSchema);
const validateDefinition: ValidateFunction<RuleDefinitionV1> = ajv.compile(ruleDefinitionSchema);

function key(ref: RuleRefV1): string {
  return `${ref.ruleId}@${ref.ruleVersion}`;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function schemaIssues(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(error => `${error.instancePath || "/"} ${error.message ?? "invalid"}`);
}

function add(
  diagnostics: RuleRegistryDiagnosticV1[],
  code: RuleRegistryDiagnosticCodeV1,
  path: string,
  details: JsonObject = {}
): void {
  diagnostics.push({ code, path, details });
}

export async function computeRuleDefinitionFingerprintV1(
  definition: RuleDefinitionV1
): Promise<`sha256:${string}`> {
  return await computeJsonFingerprint(definition) as `sha256:${string}`;
}

export async function computeRulesetRootFingerprintV1(
  manifest: Omit<RulesetManifestV1, "rootFingerprint">
): Promise<`sha256:${string}`> {
  return await computeJsonFingerprint({
    ...manifest,
    compatibleContentPackages: [...manifest.compatibleContentPackages]
      .sort((left, right) => compare(left.packageId, right.packageId)),
    rules: [...manifest.rules].sort((left, right) => compare(key(left), key(right)))
  }) as `sha256:${string}`;
}

export class RuleRegistryV1 {
  private readonly definitionsByKey: Map<string, RuleDefinitionV1>;
  private readonly executorsById: Map<string, RuleExecutorV1>;

  constructor(
    readonly manifest: RulesetManifestV1,
    definitions: RuleDefinitionV1[],
    executors: RuleExecutorV1[]
  ) {
    this.manifest = cloneJson(manifest);
    this.definitionsByKey = new Map(definitions.map(definition => [key(definition), cloneJson(definition)]));
    this.executorsById = new Map(executors.map(executor => [executor.executorId, executor]));
  }

  getRule(ref: RuleRefV1): RuleDefinitionV1 | null {
    const definition = this.definitionsByKey.get(key(ref));
    return definition ? cloneJson(definition) : null;
  }

  listRules(): RuleDefinitionV1[] {
    return [...this.definitionsByKey.values()]
      .sort((left, right) => compare(key(left), key(right)))
      .map(cloneJson);
  }

  resolveActiveRules(refs: RuleRefV1[]): RuleSelectionResultV1 {
    const selected = new Map<string, RuleDefinitionV1>();
    for (const ref of refs) {
      const definition = this.definitionsByKey.get(key(ref));
      if (!definition) return { ok: false, code: "RULE_NOT_FOUND" };
      if (definition.status !== "ACTIVE") return { ok: false, code: "RULE_NOT_ACTIVE" };
      selected.set(key(definition), definition);
    }
    const overridden = new Set<string>();
    const collectOverrides = (definition: RuleDefinitionV1): void => {
      definition.overrides.forEach(ref => {
        const target = key(ref);
        if (!selected.has(target) || overridden.has(target)) return;
        overridden.add(target);
        const targetDefinition = selected.get(target);
        if (targetDefinition) collectOverrides(targetDefinition);
      });
    };
    selected.forEach(collectOverrides);
    const remaining = [...selected.entries()].filter(([definitionKey]) => !overridden.has(definitionKey));
    const specializes = (left: RuleDefinitionV1, rightKey: string, seen = new Set<string>()): boolean => {
      const leftKey = key(left);
      if (seen.has(leftKey)) return false;
      seen.add(leftKey);
      return left.specializes.some(ref => {
        const target = key(ref);
        if (target === rightKey) return true;
        const targetDefinition = selected.get(target);
        return targetDefinition ? specializes(targetDefinition, rightKey, seen) : false;
      });
    };
    remaining.sort(([, left], [, right]) => {
      if (specializes(left, key(right))) return -1;
      if (specializes(right, key(left))) return 1;
      return compare(key(left), key(right));
    });
    return { ok: true, rules: remaining.map(([, definition]) => cloneJson(definition)) };
  }

  async execute(
    ref: RuleRefV1,
    input: JsonObject,
    contentReferences: string[] = []
  ): Promise<RuleExecutionResultV1> {
    const rule = this.definitionsByKey.get(key(ref));
    if (!rule) return { ok: false, code: "RULE_NOT_FOUND" };
    if (rule.status !== "ACTIVE") return { ok: false, code: "RULE_NOT_ACTIVE" };
    if (rule.execution !== "DETERMINISTIC" || !rule.executorId) {
      return { ok: false, code: "RULE_NOT_DETERMINISTIC" };
    }
    const executor = this.executorsById.get(rule.executorId);
    if (!executor) return { ok: false, code: "RULE_EXECUTION_FAILED" };
    try {
      const output = await executor.execute(cloneJson(input), {
        rule: cloneJson(rule),
        effectiveParameters: cloneJson(rule.parameters),
        contentReferences: [...contentReferences]
      });
      canonicalizeJson(output);
      const decision: RuleDecisionV1 = {
        schemaVersion: 1,
        ruleId: rule.ruleId,
        ruleVersion: rule.ruleVersion,
        executorId: executor.executorId,
        executorContractVersion: executor.contractVersion,
        effectiveParameters: cloneJson(rule.parameters),
        contentReferences: [...new Set(contentReferences)].sort(compare),
        output: cloneJson(output)
      };
      return { ok: true, value: decision };
    } catch {
      return { ok: false, code: "RULE_EXECUTION_FAILED" };
    }
  }
}

function relationCycle(definitions: Map<string, RuleDefinitionV1>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (current: string): string[] | null => {
    if (visiting.has(current)) return [...path, current];
    if (visited.has(current)) return null;
    visiting.add(current);
    path.push(current);
    const definition = definitions.get(current);
    const targets = [...(definition?.overrides ?? []), ...(definition?.specializes ?? [])].map(key).sort(compare);
    for (const target of targets) {
      const cycle = visit(target);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(current);
    visited.add(current);
    return null;
  };
  for (const current of [...definitions.keys()].sort(compare)) {
    const cycle = visit(current);
    if (cycle) return cycle;
  }
  return null;
}

export async function loadRuleRegistryV1(
  options: LoadRuleRegistryOptionsV1
): Promise<RuleRegistryLoadResultV1> {
  const diagnostics: RuleRegistryDiagnosticV1[] = [];
  try {
    canonicalizeJson(options.manifest);
    canonicalizeJson(options.definitions);
  } catch (error) {
    add(diagnostics, "RULESET_SCHEMA_INVALID", "/", {
      issue: error instanceof Error ? error.message : "invalid JSON"
    });
    return { ok: false, diagnostics };
  }
  if (!validateManifest(options.manifest)) {
    add(diagnostics, "RULESET_SCHEMA_INVALID", "/manifest", { issues: schemaIssues(validateManifest.errors) });
  }
  options.definitions.forEach((definition, index) => {
    if (!validateDefinition(definition)) {
      add(diagnostics, "RULESET_SCHEMA_INVALID", `/definitions/${index}`, { issues: schemaIssues(validateDefinition.errors) });
    }
  });
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  options.manifest.compatibleContentPackages.forEach((entry, index) => {
    if (entry.minimumVersion > entry.maximumVersion) {
      add(diagnostics, "RULESET_SCHEMA_INVALID", `/manifest/compatibleContentPackages/${index}`, { issue: "minimum exceeds maximum" });
    }
  });
  const compatible = options.manifest.compatibleContentPackages.some(entry =>
    entry.packageId === options.contentPackageId &&
    options.contentPackageVersion >= entry.minimumVersion &&
    options.contentPackageVersion <= entry.maximumVersion
  );
  if (!compatible) add(diagnostics, "RULESET_CONTENT_INCOMPATIBLE", "/manifest/compatibleContentPackages", {
    packageId: options.contentPackageId,
    packageVersion: options.contentPackageVersion
  });

  const definitions = new Map<string, RuleDefinitionV1>();
  options.definitions.forEach((definition, index) => {
    const definitionKey = key(definition);
    if (definitions.has(definitionKey)) add(diagnostics, "RULESET_DUPLICATE_RULE", `/definitions/${index}`, { rule: definitionKey });
    else definitions.set(definitionKey, definition);
  });
  const manifestRefs = new Map<string, RulesetManifestV1["rules"][number]>();
  options.manifest.rules.forEach((ref, index) => {
    const refKey = key(ref);
    if (manifestRefs.has(refKey)) add(diagnostics, "RULESET_DUPLICATE_RULE", `/manifest/rules/${index}`, { rule: refKey });
    else manifestRefs.set(refKey, ref);
  });

  for (const [refKey, ref] of manifestRefs) {
    const definition = definitions.get(refKey);
    if (!definition) {
      add(diagnostics, "RULESET_RULE_MISSING", "/manifest/rules", { rule: refKey });
      continue;
    }
    const actual = await computeRuleDefinitionFingerprintV1(definition);
    if (actual !== ref.fingerprint) add(diagnostics, "RULESET_FINGERPRINT_MISMATCH", "/manifest/rules", {
      rule: refKey, expected: ref.fingerprint, actual
    });
  }
  for (const definitionKey of definitions.keys()) {
    if (!manifestRefs.has(definitionKey)) add(diagnostics, "RULESET_RULE_MISSING", "/definitions", {
      rule: definitionKey, issue: "definition is absent from manifest"
    });
  }
  const actualRoot = await computeRulesetRootFingerprintV1({
    schemaVersion: options.manifest.schemaVersion,
    rulesetId: options.manifest.rulesetId,
    rulesetVersion: options.manifest.rulesetVersion,
    compatibleContentPackages: options.manifest.compatibleContentPackages,
    rules: options.manifest.rules
  });
  if (actualRoot !== options.manifest.rootFingerprint) add(diagnostics, "RULESET_ROOT_FINGERPRINT_MISMATCH", "/manifest/rootFingerprint", {
    expected: options.manifest.rootFingerprint, actual: actualRoot
  });

  const executors = new Map<string, RuleExecutorV1>();
  options.executors.forEach((executor, index) => {
    if (!executor.executorId || !Number.isInteger(executor.contractVersion) || executor.contractVersion < 1 || executors.has(executor.executorId)) {
      add(diagnostics, "RULESET_SCHEMA_INVALID", `/executors/${index}`, { executorId: executor.executorId });
    } else executors.set(executor.executorId, executor);
  });
  definitions.forEach((definition, definitionKey) => {
    if (definition.execution === "DETERMINISTIC") {
      if (!definition.executorId || !executors.has(definition.executorId)) {
        add(diagnostics, "RULESET_EXECUTOR_MISSING", `/definitions/${definitionKey}/executorId`, {
          rule: definitionKey, executorId: definition.executorId
        });
      }
    } else if (definition.executorId !== null) {
      add(diagnostics, "RULESET_EXECUTOR_FORBIDDEN", `/definitions/${definitionKey}/executorId`, { rule: definitionKey });
    }
    const relations = [
      ...definition.overrides.map(ref => ["overrides", ref] as const),
      ...definition.specializes.map(ref => ["specializes", ref] as const),
      ...definition.incompatibleWith.map(ref => ["incompatibleWith", ref] as const)
    ];
    const seen = new Set<string>();
    relations.forEach(([relation, ref]) => {
      const target = key(ref);
      const relationKey = `${relation}:${target}`;
      if (target === definitionKey || !definitions.has(target) || seen.has(relationKey)) {
        add(diagnostics, "RULESET_RELATION_INVALID", `/definitions/${definitionKey}/${relation}`, {
          rule: definitionKey, target
        });
      }
      seen.add(relationKey);
      if (relation === "incompatibleWith" && definition.status === "ACTIVE" && definitions.get(target)?.status === "ACTIVE") {
        add(diagnostics, "RULESET_CONFLICT", `/definitions/${definitionKey}/incompatibleWith`, {
          left: definitionKey, right: target
        });
      }
    });
  });
  const cycle = relationCycle(definitions);
  if (cycle) add(diagnostics, "RULESET_RELATION_CYCLE", "/definitions", { cycle });

  if (options.requireMvpInventory !== false) {
    MVP_RULE_IDS_V1.forEach(ruleId => {
      if (!definitions.has(`${ruleId}@1`)) add(diagnostics, "RULESET_MVP_RULE_MISSING", "/definitions", { ruleId, ruleVersion: 1 });
    });
  }

  diagnostics.sort((left, right) => compare(left.path, right.path) || compare(left.code, right.code) || compare(canonicalizeJson(left.details), canonicalizeJson(right.details)));
  return diagnostics.length > 0
    ? { ok: false, diagnostics }
    : { ok: true, value: new RuleRegistryV1(options.manifest, options.definitions, options.executors) };
}
