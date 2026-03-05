import fs from "node:fs";
import path from "node:path";

import { TurnProcessor } from "../../src/application/orchestrators/turn_processor";
import { TurnTraceLogger } from "../../src/infrastructure/logging/turn_trace_logger";

const MODULE_ROOT = path.resolve(__dirname, "../../..");

function loadJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

function main(): number {
  const fixtures = path.join(MODULE_ROOT, "tests", "contracts", "fixtures");
  const inputContract = loadJson(path.join(fixtures, "input.valid.v1.json"));
  const outputContract = loadJson(path.join(fixtures, "output.valid.v1.json"));

  const stateBefore: Record<string, unknown> = {
    location_id: "archives_forecourt",
    world_flags: ["archives_closed"],
    journal: [],
  };

  const logFile = path.join(MODULE_ROOT, "logs", "turn-trace.jsonl");
  const logger = new TurnTraceLogger(logFile);
  const processor = new TurnProcessor(logger);
  const trace = processor.processTurn("turn-0001", inputContract, outputContract, stateBefore);

  console.log(`[PASS] turn processed: ${trace.turn_id}`);
  console.log(`[PASS] log file: ${logFile}`);
  return 0;
}

process.exit(main());

