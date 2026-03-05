import fs from "node:fs";
import path from "node:path";

import { TurnProcessor } from "../../src/application/orchestrators/turn_processor";
import { SchemaValidationError } from "../../src/application/use_cases/schema_validation";
import { TurnTraceLogger } from "../../src/infrastructure/logging/turn_trace_logger";

const MODULE_ROOT = path.resolve(__dirname, "../../..");

function loadJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

function assertTrue(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): number {
  const fixtures = path.join(MODULE_ROOT, "tests", "contracts", "fixtures");
  const inputContract = loadJson(path.join(fixtures, "input.valid.v1.json"));
  const outputContract = loadJson(path.join(fixtures, "output.valid.v1.json"));

  // Strict-schema check: additional root property is forbidden by input schema.
  inputContract.unexpected_root_key = "must_fail";

  const outputLog = path.join(
    MODULE_ROOT,
    "tests",
    "integration",
    "artifacts",
    "schema-validation-enforced.test.jsonl",
  );
  fs.mkdirSync(path.dirname(outputLog), { recursive: true });
  if (fs.existsSync(outputLog)) fs.unlinkSync(outputLog);

  const processor = new TurnProcessor(new TurnTraceLogger(outputLog));
  let caught = false;
  try {
    processor.processTurn("it-turn-schema-0001", inputContract, outputContract, {
      location_id: "archives_forecourt",
      world_flags: [],
      journal: [],
      events: [],
    });
  } catch (error) {
    caught = true;
    assertTrue(error instanceof SchemaValidationError, "expected SchemaValidationError");
    assertTrue(
      (error as SchemaValidationError).code === "schema_validation_failed_input",
      "expected schema_validation_failed_input",
    );
  }
  assertTrue(caught, "expected strict schema validation to reject payload");

  console.log("[PASS] integration test_schema_validation_enforced");
  return 0;
}

process.exit(main());

