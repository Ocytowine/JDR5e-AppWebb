import {
  MVP_RULE_DEFINITIONS_V1,
  MVP_RULE_EXECUTORS_V1,
  computeRuleDefinitionFingerprintV1,
  computeRulesetRootFingerprintV1,
  createAdjudicationRecordV1,
  createMvpRulesetManifestV1,
  loadRuleRegistryV1,
  type RuleDefinitionV1,
  type RuleExecutorV1,
  type RuleRegistryLoadResultV1,
  type RulesetManifestV1
} from "../../src/bootstrap/index";
import { assert } from "../contracts/assertions";

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function manifestFor(definitions: RuleDefinitionV1[]): Promise<RulesetManifestV1> {
  const rules = await Promise.all(definitions.map(async definition => ({
    ruleId: definition.ruleId,
    ruleVersion: definition.ruleVersion,
    fingerprint: await computeRuleDefinitionFingerprintV1(definition)
  })));
  const base: Omit<RulesetManifestV1, "rootFingerprint"> = {
    schemaVersion: 1,
    rulesetId: "rules.jdr5e",
    rulesetVersion: 1,
    compatibleContentPackages: [{ packageId: "content.jdr5e", minimumVersion: 1, maximumVersion: 2 }],
    rules
  };
  return { ...base, rootFingerprint: await computeRulesetRootFingerprintV1(base) };
}

async function load(
  definitions = clone(MVP_RULE_DEFINITIONS_V1),
  executors: RuleExecutorV1[] = MVP_RULE_EXECUTORS_V1,
  manifest?: RulesetManifestV1
): Promise<RuleRegistryLoadResultV1> {
  return loadRuleRegistryV1({
    contentPackageId: "content.jdr5e",
    contentPackageVersion: 1,
    manifest: manifest ?? await manifestFor(definitions),
    definitions,
    executors
  });
}

function expectDiagnostic(result: RuleRegistryLoadResultV1, code: string): void {
  assert.equal(result.ok, false, `Expected ${code}.`);
  if (!result.ok) assert.ok(result.diagnostics.some(value => value.code === code), `Missing diagnostic ${code}.`);
}

async function run(): Promise<void> {
  const manifest = await createMvpRulesetManifestV1("content.jdr5e", 1, 2);
  const loaded = await load(clone(MVP_RULE_DEFINITIONS_V1), MVP_RULE_EXECUTORS_V1, manifest);
  assert.equal(loaded.ok, true, loaded.ok ? undefined : loaded.diagnostics.map(value => value.code).join(", "));
  if (!loaded.ok) return;
  assert.equal(loaded.value.listRules().length, 15);
  console.log("PASS [rule-registry] strict MVP inventory loads with verified fingerprints");

  const ability = await loaded.value.execute(
    { ruleId: "core.character.ability-modifier", ruleVersion: 1 },
    { score: 16 },
    ["race:human", "class:fighter"]
  );
  assert.equal(ability.ok, true);
  if (ability.ok) {
    assert.deepEqual(ability.value.output, { modifier: 3 });
    assert.equal(ability.value.executorId, "character.compute-ability-modifier");
    assert.equal(ability.value.executorContractVersion, 1);
    assert.deepEqual(ability.value.contentReferences, ["class:fighter", "race:human"]);
  }
  const impossibleInput = await loaded.value.execute(
    { ruleId: "core.character.ability-modifier", ruleVersion: 1 },
    { score: 31 }
  );
  assert.deepEqual(impossibleInput, { ok: false, code: "RULE_EXECUTION_FAILED" });
  const adjudicationRequired = await loaded.value.execute(
    { ruleId: "house.social.observable-appearance", ruleVersion: 1 },
    {}
  );
  assert.deepEqual(adjudicationRequired, { ok: false, code: "RULE_NOT_DETERMINISTIC" });
  console.log("PASS [rule-registry] deterministic decision cites rule, executor and content");

  const unavailable = await loaded.value.execute(
    { ruleId: "core.character.capability-availability", ruleVersion: 1 },
    { declared: true, prepared: true, resourceAvailable: false, prerequisitesMet: true }
  );
  assert.equal(unavailable.ok, true);
  if (unavailable.ok) {
    assert.deepEqual(unavailable.value.output, { available: false, reasons: ["RESOURCE_UNAVAILABLE"] });
    assert.equal(unavailable.value.ruleVersion, 1);
  }
  console.log("PASS [rule-registry] NAR-ACC-008 refuses an impossible capability before any roll or cost");

  const appearance = await loaded.value.execute(
    { ruleId: "core.character.visible-appearance", ruleVersion: 1 },
    {
      physicalDescription: "Une guerrière en cotte de mailles.",
      clothingState: "DUSTY",
      items: [
        { instanceId: "armor", itemId: "cotte_mailles", equipped: true, visible: true },
        { instanceId: "purse", itemId: "obj_bourse", equipped: true, visible: false },
        { instanceId: "coin", itemId: "obj_piece_or", equipped: false, visible: true }
      ]
    }
  );
  assert.equal(appearance.ok, true);
  if (appearance.ok) {
    assert.deepEqual(appearance.value.output.visibleEquipment, [{ instanceId: "armor", itemId: "cotte_mailles" }]);
    assert.equal(appearance.value.output.clothingState, "DUSTY");
  }
  console.log("PASS [rule-registry] NAR-ACC-009 exposes only authoritative visible equipment");

  const reversedBase = {
    schemaVersion: manifest.schemaVersion,
    rulesetId: manifest.rulesetId,
    rulesetVersion: manifest.rulesetVersion,
    compatibleContentPackages: [...manifest.compatibleContentPackages].reverse(),
    rules: [...manifest.rules].reverse()
  } as const;
  assert.equal(await computeRulesetRootFingerprintV1(reversedBase), manifest.rootFingerprint);
  console.log("PASS [rule-registry] root fingerprint is enumeration-order independent");

  const orderedDefinitions = clone(MVP_RULE_DEFINITIONS_V1);
  const house = orderedDefinitions.find(value => value.ruleId === "house.social.observable-appearance")!;
  house.overrides = [{ ruleId: "core.character.ability-modifier", ruleVersion: 1 }];
  const ordered = await load(orderedDefinitions);
  assert.equal(ordered.ok, true);
  if (ordered.ok) {
    const selection = ordered.value.resolveActiveRules([
      { ruleId: "core.character.ability-modifier", ruleVersion: 1 },
      { ruleId: "house.social.observable-appearance", ruleVersion: 1 }
    ]);
    assert.equal(selection.ok, true);
    if (selection.ok) assert.deepEqual(selection.rules.map(value => value.ruleId), ["house.social.observable-appearance"]);
  }
  console.log("PASS [rule-registry] explicit overrides resolve without numeric priority");

  const beforeAdjudication = loaded.value.listRules();
  const adjudicationInput = {
    adjudicationId: "adj-lysenthe-001",
    campaignId: "campaign-lysenthe",
    status: "ACCEPTED" as const,
    question: "Une tenue poussiéreuse influence-t-elle cet accueil ?",
    assumptions: ["La tenue est observable", "Aucun bonus mécanique de Charisme"],
    citedRules: [{ ruleId: "house.social.observable-appearance", ruleVersion: 1 }],
    relevantState: { clothingState: "DUSTY", charismaModifier: 0 },
    ruling: { influence: "CONTEXTUAL_DISADVANTAGE" },
    scope: { sceneId: "scene-archives-entry" },
    acceptedAtGameSecond: 0,
    supersedesAdjudicationId: null
  };
  const adjudication = await createAdjudicationRecordV1(adjudicationInput);
  const repeatedAdjudication = await createAdjudicationRecordV1({
    ...adjudicationInput,
    assumptions: [...adjudicationInput.assumptions].reverse(),
    citedRules: [...adjudicationInput.citedRules].reverse()
  });
  assert.equal(adjudication.caseFingerprint, repeatedAdjudication.caseFingerprint);
  assert.deepEqual(loaded.value.listRules(), beforeAdjudication, "An adjudication must not promote or mutate a ruleset rule.");
  assert.equal(adjudication.citedRules[0].ruleVersion, 1);
  let duplicateCitationRejected = false;
  try {
    await createAdjudicationRecordV1({
      ...adjudicationInput,
      citedRules: [...adjudicationInput.citedRules, ...adjudicationInput.citedRules]
    });
  } catch {
    duplicateCitationRejected = true;
  }
  assert.equal(duplicateCitationRejected, true);
  console.log("PASS [rule-registry] NAR-ACC-021 records a campaign adjudication without promoting a rule");

  const incompatible = await loadRuleRegistryV1({
    contentPackageId: "content.other",
    contentPackageVersion: 1,
    manifest,
    definitions: clone(MVP_RULE_DEFINITIONS_V1),
    executors: MVP_RULE_EXECUTORS_V1
  });
  expectDiagnostic(incompatible, "RULESET_CONTENT_INCOMPATIBLE");

  const tampered = clone(MVP_RULE_DEFINITIONS_V1);
  tampered[0].normativeText += " Altération.";
  expectDiagnostic(await load(tampered, MVP_RULE_EXECUTORS_V1, manifest), "RULESET_FINGERPRINT_MISMATCH");

  const badRoot = clone(manifest);
  badRoot.rootFingerprint = `sha256:${"0".repeat(64)}`;
  expectDiagnostic(await load(clone(MVP_RULE_DEFINITIONS_V1), MVP_RULE_EXECUTORS_V1, badRoot), "RULESET_ROOT_FINGERPRINT_MISMATCH");

  const missingRule = clone(MVP_RULE_DEFINITIONS_V1).slice(1);
  expectDiagnostic(await load(missingRule), "RULESET_MVP_RULE_MISSING");

  expectDiagnostic(await load(clone(MVP_RULE_DEFINITIONS_V1), MVP_RULE_EXECUTORS_V1.slice(1)), "RULESET_EXECUTOR_MISSING");

  const forbiddenExecutor = clone(MVP_RULE_DEFINITIONS_V1);
  forbiddenExecutor.find(value => value.ruleId === "core.transaction.atomicity")!.executorId = "forbidden.executor";
  expectDiagnostic(await load(forbiddenExecutor), "RULESET_EXECUTOR_FORBIDDEN");

  const missingRelation = clone(MVP_RULE_DEFINITIONS_V1);
  missingRelation[0].overrides = [{ ruleId: "missing.rule", ruleVersion: 1 }];
  expectDiagnostic(await load(missingRelation), "RULESET_RELATION_INVALID");

  const cyclic = clone(MVP_RULE_DEFINITIONS_V1);
  cyclic[0].overrides = [{ ruleId: cyclic[1].ruleId, ruleVersion: 1 }];
  cyclic[1].overrides = [{ ruleId: cyclic[0].ruleId, ruleVersion: 1 }];
  expectDiagnostic(await load(cyclic), "RULESET_RELATION_CYCLE");

  const conflicting = clone(MVP_RULE_DEFINITIONS_V1);
  conflicting[0].incompatibleWith = [{ ruleId: conflicting[1].ruleId, ruleVersion: 1 }];
  expectDiagnostic(await load(conflicting), "RULESET_CONFLICT");

  const malformed = clone(MVP_RULE_DEFINITIONS_V1) as Array<RuleDefinitionV1 & { unexpected?: boolean }>;
  malformed[0].unexpected = true;
  expectDiagnostic(await load(malformed), "RULESET_SCHEMA_INVALID");
  console.log("PASS [rule-registry] incompatible content, tampering, missing executors, invalid graph and conflicts are rejected");
  console.log("PASS [rule-registry] 11 executable rules, 3 invariants/descriptions and 1 adjudication rule.");
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
