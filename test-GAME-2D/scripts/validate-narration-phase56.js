"use strict";

const assert = require("assert");
const { createNarrationToolRegistry } = require("../server/narrationToolRegistry");
const { createMjToolBus } = require("../server/mjToolBus");

function run() {
  const registry = createNarrationToolRegistry();

  const commonContext = {
    intentType: "story_action",
    directorMode: "runtime",
    conversationMode: "rp",
    worldState: {
      location: { id: "lysenthe.rue-marchande", label: "Rue marchande" },
      conversation: { activeInterlocutor: "Vendeuse", pendingAccess: null, pendingTravel: null },
      travel: { pending: null }
    }
  };

  const semanticCases = [
    {
      label: "travel",
      message: "je me dirige vers la rue marchande",
      expected: "move_place"
    },
    {
      label: "social",
      message: "je salue la vendeuse",
      expected: "social_exchange",
      context: { intentType: "social_action", directorMode: "scene_only" }
    },
    {
      label: "trade",
      message: "je demande le prix de la tunique",
      expected: "trade_action"
    },
    {
      label: "rules",
      message: "quelle regle de jet je dois utiliser pour negocier ?",
      expected: "rules_query"
    },
    {
      label: "lore",
      message: "que sais-tu sur la Primaute ?",
      expected: "lore_query",
      context: { intentType: "lore_question", directorMode: "lore" }
    }
  ];

  semanticCases.forEach((row) => {
    const intent = registry.deriveSemanticIntent({
      ...commonContext,
      ...(row.context || {}),
      message: row.message
    });
    assert.strictEqual(intent, row.expected, `semanticIntent mismatch for ${row.label}`);
  });

  const policy = registry.deriveIntentPolicy({
    ...commonContext,
    message: "je me dirige vers la rue marchande",
    semanticIntent: "move_place"
  });
  assert.strictEqual(policy.allowRuntimeMutation, true, "move_place should allow runtime mutation");
  assert(
    Array.isArray(policy.preferredTools) && policy.preferredTools.includes("semantic_intent_probe"),
    "move_place policy should include semantic_intent_probe"
  );

  const merged = registry.mergeToolCalls(
    [
      { name: "unknown_tool", args: {} },
      { name: "session_db_write", args: { data: "x" } },
      { name: "query_lore", args: { query: "Primaute" } }
    ],
    [{ name: "get_world_state", args: {} }],
    {
      limit: 8,
      intentContext: {
        ...commonContext,
        semanticIntent: "lore_query",
        message: "que sais-tu sur la Primaute ?",
        allowWrite: false
      }
    }
  );
  const mergedNames = merged.map((row) => row.name);
  assert(mergedNames.includes("get_world_state"), "get_world_state should be present");
  assert(mergedNames.includes("query_lore"), "query_lore should be present");
  assert(!mergedNames.includes("unknown_tool"), "unknown_tool must be filtered");
  assert(!mergedNames.includes("session_db_write"), "session_db_write must be blocked when allowWrite=false");

  const bus = createMjToolBus({
    toolAdapters: {
      semantic_intent_probe: ({ context }) => ({
        ok: true,
        summary: "probe",
        data: { semanticIntent: context?.semanticIntent ?? "none" }
      })
    }
  });
  const trace = bus.executeToolCalls(
    [{ name: "semantic_intent_probe", args: {} }],
    { semanticIntent: "trade_action" }
  );
  assert(Array.isArray(trace) && trace.length === 1, "adapter trace should contain one entry");
  assert.strictEqual(trace[0].ok, true, "adapter tool should execute");
  assert.strictEqual(
    String(trace[0]?.data?.semanticIntent ?? ""),
    "trade_action",
    "adapter should return semantic intent"
  );

  console.log("[OK] Phase 5/6 validation passed.");
}

run();

