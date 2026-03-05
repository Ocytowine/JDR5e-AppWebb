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
    "scenario-observe-place.jsonl",
  );
  fs.mkdirSync(path.dirname(outputLog), { recursive: true });
  if (fs.existsSync(outputLog)) fs.unlinkSync(outputLog);

  const inputContract: Record<string, unknown> = {
    schema_version: "1.0.0",
    player_input: "j'observe l'entree des archives",
    narrative_context: {
      recent_scene_log: ["Deux gardes filtrent les entrees."],
      current_scene_summary: "Le PJ observe le parvis",
      tone_markers: ["tendu"],
      continuity_hooks: ["gardes nerveux"],
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
    intent_type: "observe",
    intent_confidence: 0.93,
    requires_clarification: false,
    clarification_question: null,
    plan: {
      objective: "Observer les details de l'entree",
      approach: "Observation locale sans deplacement",
      assumptions: [],
      checks_needed: [],
      resources_to_spend: [],
      risks: [],
      fallbacks: [],
      need_clarification: [],
    },
    targets: ["archives_main_door"],
    runtime_actions: [
      {
        action: "queryLore",
        params: { topic_ids: ["archives_entry", "guard_behavior"] },
      },
    ],
    actor_updates: [],
    narrative_output: {
      player_facing_text: "Tu notes la nervosite des gardes et la porte sous surveillance.",
      mj_notes: [],
      hidden_truth_updates: [],
    },
    narrative_constraints: {
      tone: "neutral_immersive",
      must_reflect_runtime_result: true,
    },
  };

  const processor = new TurnProcessor(new TurnTraceLogger(outputLog));
  const trace = processor.processTurn("scenario-observe-0001", inputContract, outputContract, {
    location_id: "archives_forecourt",
    world_flags: ["guards_on_alert"],
    journal: [],
    events: [],
  });

  assertTrue(trace.runtime_actions.length === 1, "expected 1 runtime action");
  assertTrue(trace.runtime_actions[0].action === "queryLore", "expected queryLore action");
  console.log("[PASS] integration test_scenario_observe_place");
  return 0;
}

process.exit(main());

