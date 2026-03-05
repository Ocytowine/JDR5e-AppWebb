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
  const baseOutput = loadJson(path.join(fixtures, "output.valid.v1.json"));

  const outputLog = path.join(
    MODULE_ROOT,
    "tests",
    "integration",
    "artifacts",
    "turn-event-trigger.test.jsonl",
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

  // Invalid: missing origin_trigger_id
  const invalidOutput = JSON.parse(JSON.stringify(baseOutput)) as Record<string, unknown>;
  invalidOutput.runtime_actions = [
    {
      action: "createEvent",
      params: {
        event_id: "evt-001",
        created_at_turn: "it-turn-event-0001",
      },
    },
  ];
  let invalidCaught = false;
  try {
    processor.processTurn("it-turn-event-0001", inputContract, invalidOutput, stateBefore);
  } catch (error) {
    invalidCaught = true;
    assertTrue(error instanceof TurnRuleError, "expected TurnRuleError for invalid event");
    assertTrue(
      (error as TurnRuleError).code === "event_trigger_missing",
      "expected event_trigger_missing code",
    );
  }
  assertTrue(invalidCaught, "expected invalid createEvent to fail");

  // Valid createEvent
  const validOutput = JSON.parse(JSON.stringify(baseOutput)) as Record<string, unknown>;
  validOutput.runtime_actions = [
    {
      action: "createEvent",
      params: {
        event_id: "evt-002",
        origin_trigger_id: "trigger-archives-01",
        created_at_turn: "it-turn-event-0002",
        final: {
          truth: "document_vol + mort_archiviste",
        },
      },
    },
  ];
  validOutput.plan = {
    ...(validOutput.plan as Record<string, unknown>),
    resources_to_spend: [],
  };

  const trace = processor.processTurn(
    "it-turn-event-0002",
    inputContract,
    validOutput,
    stateBefore,
  );
  const events = Array.isArray(trace.state_after.events)
    ? (trace.state_after.events as Array<Record<string, unknown>>)
    : [];
  assertTrue(events.length === 1, "expected one event in state_after");
  assertTrue(events[0].origin_trigger_id === "trigger-archives-01", "origin_trigger_id mismatch");

  console.log("[PASS] integration test_event_trigger_enforced");
  return 0;
}

process.exit(main());

