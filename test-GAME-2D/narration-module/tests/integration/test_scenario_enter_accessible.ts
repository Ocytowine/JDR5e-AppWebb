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
    "scenario-enter-accessible.jsonl",
  );
  fs.mkdirSync(path.dirname(outputLog), { recursive: true });
  if (fs.existsSync(outputLog)) fs.unlinkSync(outputLog);

  const inputContract: Record<string, unknown> = {
    schema_version: "1.0.0",
    player_input: "je veux entrer dans les archives",
    narrative_context: {
      recent_scene_log: ["Le PJ est devant les archives ouvertes."],
      current_scene_summary: "Acces autorise",
      tone_markers: ["neutre"],
      continuity_hooks: ["porte principale"],
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
    intent_type: "move_local",
    intent_confidence: 0.95,
    requires_clarification: false,
    clarification_question: null,
    plan: {
      objective: "Entrer dans les archives",
      approach: "Deplacement local puis entree",
      assumptions: ["Acces autorise"],
      checks_needed: [],
      resources_to_spend: [{ type: "time", amount: "1-2min" }],
      risks: [],
      fallbacks: [],
      need_clarification: [],
    },
    targets: ["archives_main_door"],
    runtime_actions: [
      {
        action: "moveLocal",
        params: { destination_id: "archives_main_door", time_cost_min: 1 },
      },
      {
        action: "enterLocation",
        params: { location_id: "archives_interior" },
      },
    ],
    actor_updates: [],
    narrative_output: {
      player_facing_text: "Tu franchis la porte des archives.",
      mj_notes: [],
      hidden_truth_updates: [],
    },
    narrative_constraints: {
      tone: "neutral_immersive",
      must_reflect_runtime_result: true,
    },
  };

  const processor = new TurnProcessor(new TurnTraceLogger(outputLog));
  const trace = processor.processTurn("scenario-enter-0001", inputContract, outputContract, {
    location_id: "archives_forecourt",
    world_flags: [],
    journal: [],
    events: [],
  });

  assertTrue(trace.runtime_actions.length === 2, "expected 2 runtime actions");
  assertTrue(Array.isArray(trace.state_after.world_flags), "state_after.world_flags missing");
  console.log("[PASS] integration test_scenario_enter_accessible");
  return 0;
}

process.exit(main());

