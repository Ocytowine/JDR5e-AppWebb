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
    "scenario-unclear-intent.jsonl",
  );
  fs.mkdirSync(path.dirname(outputLog), { recursive: true });
  if (fs.existsSync(outputLog)) fs.unlinkSync(outputLog);

  const inputContract: Record<string, unknown> = {
    schema_version: "1.0.0",
    player_input: "je fais ce qu'il faut",
    narrative_context: {
      recent_scene_log: ["Les gardes te regardent, attendant ton action."],
      current_scene_summary: "Intention ambigue",
      tone_markers: ["retenu"],
      continuity_hooks: ["silence du parvis"],
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
    intent_type: "meta_unclear",
    intent_confidence: 0.4,
    requires_clarification: true,
    clarification_question: "Tu veux observer, parler, ou entrer ?",
    plan: {
      objective: "Lever l'ambiguite d'intention",
      approach: "Demande de precision",
      assumptions: [],
      checks_needed: [],
      resources_to_spend: [],
      risks: [{ risk: "Executer une mauvaise action", severity: "high" }],
      fallbacks: [],
      need_clarification: ["Action prioritaire non definie"],
    },
    targets: [],
    runtime_actions: [],
    actor_updates: [],
    narrative_output: {
      player_facing_text: "Les gardes attendent que tu precises ton action.",
      mj_notes: [],
      hidden_truth_updates: [],
    },
    narrative_constraints: {
      tone: "neutral_immersive",
      must_reflect_runtime_result: true,
    },
  };

  const processor = new TurnProcessor(new TurnTraceLogger(outputLog));
  const trace = processor.processTurn("scenario-unclear-0001", inputContract, outputContract, {
    location_id: "archives_forecourt",
    world_flags: [],
    journal: [],
    events: [],
  });

  assertTrue(trace.runtime_actions.length === 0, "expected no runtime actions");
  console.log("[PASS] integration test_scenario_unclear_intent");
  return 0;
}

process.exit(main());

