import fs from "node:fs";
import path from "node:path";

import {
  validateInputContract,
  validateOutputContract,
} from "../../src/application/use_cases/contract_validation";
import {
  validateInputSchema,
  validateOutputSchema,
} from "../../src/application/use_cases/schema_validation";

const MODULE_ROOT = path.resolve(__dirname, "../../..");
const FIXTURES = path.join(MODULE_ROOT, "tests", "contracts", "fixtures");

function loadJson(name: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8")) as Record<
    string,
    unknown
  >;
}

function runCase(
  name: string,
  shouldPass: boolean,
  validator: (payload: Record<string, unknown>) => void,
): [boolean, string] {
  const payload = loadJson(name);
  try {
    validator(payload);
  } catch (error) {
    if (shouldPass) {
      return [false, `[FAIL] ${name} -> ${(error as Error).message}`];
    }
    return [true, `[PASS] ${name} (expected failure): ${(error as Error).message}`];
  }
  if (shouldPass) {
    return [true, `[PASS] ${name}`];
  }
  return [false, `[FAIL] ${name} should have failed`];
}

function validateInput(payload: Record<string, unknown>): void {
  validateInputSchema(payload);
  validateInputContract(payload);
}

function validateOutput(payload: Record<string, unknown>): void {
  validateOutputSchema(payload);
  validateOutputContract(payload);
}

function main(): number {
  const results: Array<[boolean, string]> = [];
  results.push(runCase("input.valid.v1.json", true, validateInput));
  results.push(runCase("output.valid.v1.json", true, validateOutput));
  results.push(
    runCase(
      "output.invalid.clarification_has_actions.v1.json",
      false,
      validateOutput,
    ),
  );
  results.push(
    runCase("output.invalid.leaks_truth_view.v1.json", false, validateOutput),
  );

  let allOk = true;
  for (const [ok, line] of results) {
    console.log(line);
    allOk = allOk && ok;
  }
  if (allOk) {
    console.log("[PASS] contract test suite");
    return 0;
  }
  console.log("[FAIL] contract test suite");
  return 1;
}

process.exit(main());
