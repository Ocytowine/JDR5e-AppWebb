import fs from "node:fs";
import path from "node:path";

import { TurnProcessor } from "../../src/application/orchestrators/turn_processor";
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

  const outputLog = path.join(
    MODULE_ROOT,
    "tests",
    "integration",
    "artifacts",
    "turn-trace.test.jsonl",
  );
  fs.mkdirSync(path.dirname(outputLog), { recursive: true });
  if (fs.existsSync(outputLog)) {
    fs.unlinkSync(outputLog);
  }

  const processor = new TurnProcessor(new TurnTraceLogger(outputLog));
  const stateBefore: Record<string, unknown> = {
    location_id: "archives_forecourt",
    world_flags: ["archives_closed"],
    journal: [],
  };

  const trace = processor.processTurn(
    "it-turn-0001",
    inputContract,
    outputContract,
    stateBefore,
  );

  assertTrue(trace.turn_id === "it-turn-0001", "turn_id mismatch");
  assertTrue("plan" in trace, "trace missing plan");
  assertTrue("runtime_actions" in trace, "trace missing runtime_actions");
  assertTrue("state_before" in trace && "state_after" in trace, "trace missing states");
  assertTrue("state_diff" in trace, "trace missing state_diff");

  const lines = fs
    .readFileSync(outputLog, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  assertTrue(lines.length === 1, "expected exactly one log line");

  const logObj = JSON.parse(lines[0]) as Record<string, unknown>;
  const required = [
    "turn_id",
    "input_contract",
    "plan",
    "runtime_actions",
    "state_before",
    "state_after",
    "output_contract",
  ];
  for (const key of required) {
    assertTrue(key in logObj, `log missing key: ${key}`);
  }

  console.log("[PASS] integration test_turn_trace");
  return 0;
}

process.exit(main());

