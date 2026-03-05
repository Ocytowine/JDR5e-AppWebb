import fs from "node:fs";
import path from "node:path";

import {
  TurnProcessor,
  TurnRuleError,
} from "../../src/application/orchestrators/turn_processor";
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

  outputContract.plan = {
    ...(outputContract.plan as Record<string, unknown>),
    checks_needed: [{ type: "skill_check", skill: "perception" }],
  };
  outputContract.runtime_actions = [
    {
      action: "startDialogue",
      params: { target_id: "guard_archives_01" },
    },
  ];

  const outputLog = path.join(
    MODULE_ROOT,
    "tests",
    "integration",
    "artifacts",
    "turn-plan-mismatch.test.jsonl",
  );
  fs.mkdirSync(path.dirname(outputLog), { recursive: true });
  if (fs.existsSync(outputLog)) {
    fs.unlinkSync(outputLog);
  }

  const processor = new TurnProcessor(new TurnTraceLogger(outputLog));
  const stateBefore: Record<string, unknown> = {
    location_id: "archives_forecourt",
    world_flags: [],
    journal: [],
    events: [],
  };

  let caught = false;
  try {
    processor.processTurn("it-turn-plan-0001", inputContract, outputContract, stateBefore);
  } catch (error) {
    caught = true;
    assertTrue(error instanceof TurnRuleError, "expected TurnRuleError");
    assertTrue((error as TurnRuleError).code === "plan_mismatch", "expected plan_mismatch code");
  }
  assertTrue(caught, "expected plan mismatch error");

  console.log("[PASS] integration test_plan_mismatch");
  return 0;
}

process.exit(main());

