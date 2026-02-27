#!/usr/bin/env node
"use strict";

const { createAiCallBudgetController } = require("../server/narrationAiBudget");
const { createNarrationPayloadPipeline } = require("../server/narrationPayloadPipeline");

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function simulateTurn(sequence) {
  const budget = createAiCallBudgetController({
    aiCallMaxPerTurn: 2,
    aiPrimaryMaxPerTurn: 1,
    aiFallbackMaxPerTurn: 1
  });
  const routing = {
    attempted: 0,
    executed: 0,
    skipped: 0,
    byLabel: {},
    recent: []
  };
  sequence.forEach((step) => {
    const label = String(step.label ?? "unknown");
    const kind = step.kind === "primary" ? "primary" : "fallback";
    routing.attempted += 1;
    routing.byLabel[label] = routing.byLabel[label] || { attempted: 0, executed: 0, skipped: 0 };
    routing.byLabel[label].attempted += 1;
    const accepted = budget.tryConsume(label, kind, { totalLabelPrefix: "total:" });
    if (accepted) {
      routing.executed += 1;
      routing.byLabel[label].executed += 1;
      routing.recent.push({ label, status: "executed", reason: kind });
    } else {
      routing.skipped += 1;
      routing.byLabel[label].skipped += 1;
      routing.recent.push({ label, status: "skipped", reason: "budget-blocked" });
    }
  });
  const snapshot = budget.getSnapshot();
  return { routing, budget: snapshot };
}

function main() {
  const scenarios = [
    {
      name: "travel-turn",
      sequence: [
        { label: "classify-intent", kind: "primary" },
        { label: "generate-mj-structured-main", kind: "fallback" },
        { label: "refine-mj-structured-main", kind: "fallback" }
      ]
    },
    {
      name: "social-turn",
      sequence: [
        { label: "resolve-scene-frame-patch", kind: "fallback" },
        { label: "detect-world-intent", kind: "primary" },
        { label: "arbitrate-scene-intent", kind: "primary" }
      ]
    },
    {
      name: "lore-turn",
      sequence: [
        { label: "generate-mj-structured-branch", kind: "fallback" },
        { label: "validate-scene-frame-continuity", kind: "fallback" },
        { label: "classify-intent", kind: "primary" }
      ]
    }
  ];

  const turns = scenarios.map((row) => ({ name: row.name, ...simulateTurn(row.sequence) }));

  turns.forEach((turn) => {
    if (Number(turn.budget.used ?? 0) > 2) fail(`${turn.name}: used > 2`);
    if (Number(turn.budget.primaryUsed ?? 0) > 1) fail(`${turn.name}: primaryUsed > 1`);
    if (Number(turn.budget.fallbackUsed ?? 0) > 1) fail(`${turn.name}: fallbackUsed > 1`);
    if (Number(turn.routing.executed ?? 0) > 2) fail(`${turn.name}: routing.executed > 2`);
  });
  ok("Per-turn budget respected on RP scenarios (<=2 total, <=1 primary, <=1 fallback)");

  const pipeline = createNarrationPayloadPipeline({
    clampNumber: (v, min, max) => Math.max(min, Math.min(max, Number(v))),
    oneLine: (v) => String(v ?? ""),
    normalizeMjOptions: (v) => (Array.isArray(v) ? v : []),
    parseReplyToMjBlocks: () => ({
      directAnswer: "",
      scene: "",
      actionResult: "",
      consequences: "",
      options: []
    }),
    makeMjResponse: (x) => x,
    buildCanonicalNarrativeContext: () => null
  });

  const fakeRes = {
    writeHead: () => {},
    end: () => {}
  };
  turns.forEach((turn) => {
    pipeline.sendJson(fakeRes, 200, {
      reply: "ok",
      speaker: { label: "MJ", kind: "mj" },
      intent: { type: "story_action", commitment: "declaratif", confidence: 0.9 },
      director: { mode: "scene_only", applyRuntime: false },
      worldState: {},
      phase12: {
        aiCallBudget: turn.budget,
        aiRouting: turn.routing
      }
    });
  });

  const budgetStats = pipeline.buildPhase4AiBudgetStatsPayload();
  const routingStats = pipeline.buildPhase4AiRoutingStatsPayload();
  if (Number(budgetStats.turnsWithBudget ?? 0) < turns.length) {
    fail("Pipeline did not aggregate all budget turns");
  }
  if (Number(routingStats.turnsWithRouting ?? 0) < turns.length) {
    fail("Pipeline did not aggregate all routing turns");
  }
  if (Number(routingStats.attempted ?? 0) <= Number(routingStats.executed ?? 0)) {
    fail("Expected attempted > executed due budget gating in scenarios");
  }
  ok("Pipeline aggregates routing/budget on multi-turn scenarios");

  console.log("[OK] Phase 4 scenario validation passed.");
}

main();

