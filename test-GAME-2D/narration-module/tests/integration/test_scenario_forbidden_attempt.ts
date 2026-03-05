import fs from "node:fs";
import path from "node:path";

import { TurnProcessor } from "../../src/application/orchestrators/turn_processor";
import { TurnTraceLogger } from "../../src/infrastructure/logging/turn_trace_logger";

const MODULE_ROOT = path.resolve(__dirname, "../../..");

function assertTrue(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): number {
  const outputLog = path.join(
    MODULE_ROOT,
    "tests",
    "integration",
    "artifacts",
    "scenario-forbidden-attempt.jsonl",
  );
  fs.mkdirSync(path.dirname(outputLog), { recursive: true });
  if (fs.existsSync(outputLog)) fs.unlinkSync(outputLog);

  const inputContract: Record<string, unknown> = {
    schema_version: "1.0.0",
    player_input: "je veux voler un document",
    narrative_context: {
      recent_scene_log: ["Les archives sont sous surveillance."],
      current_scene_summary: "Tentative illegale potentielle",
      tone_markers: ["tendu"],
      continuity_hooks: ["garde vigilant"],
    },
    world_state: { location_id: "archives_forecourt" },
    actors: { player: { character_id: "pj-1" } },
    response_contract: {
      require_structured_output: true,
      must_preserve_continuity: true,
    },
  };

  const outputContract: Record<string, unknown> = {
    schema_version: "1.0.0",
    intent_type: "attempt_forbidden",
    intent_confidence: 0.92,
    requires_clarification: false,
    clarification_question: null,
    plan: {
      objective: "Tenter un vol de document",
      approach: "Action risquee avec detection possible",
      assumptions: [],
      checks_needed: [{ type: "skill_check", skill: "stealth", reason: "eviter detection" }],
      resources_to_spend: [],
      risks: [{ risk: "Detection par les gardes", severity: "high" }],
      fallbacks: ["Abandonner l'action"],
      need_clarification: [],
    },
    targets: ["archives_document_room"],
    runtime_actions: [
      {
        action: "requestCheck",
        params: { skill_id: "stealth", difficulty: 15, reason: "vol document" },
      },
    ],
    actor_updates: [],
    narrative_output: {
      player_facing_text: "Tu te prepares a agir discretement, sous l'oeil des gardes.",
      mj_notes: [],
      hidden_truth_updates: [],
    },
    narrative_constraints: {
      tone: "neutral_immersive",
      must_reflect_runtime_result: true,
    },
  };

  const processor = new TurnProcessor(new TurnTraceLogger(outputLog));
  const trace = processor.processTurn("scenario-forbidden-0001", inputContract, outputContract, {
    location_id: "archives_forecourt",
    world_flags: ["guards_on_alert"],
    journal: [],
    events: [],
  });

  assertTrue(trace.runtime_actions.length === 1, "expected 1 runtime action");
  assertTrue(trace.runtime_actions[0].action === "requestCheck", "expected requestCheck action");
  console.log("[PASS] integration test_scenario_forbidden_attempt");
  return 0;
}

process.exit(main());

