#!/usr/bin/env node
"use strict";

const { createNarrationPayloadPipeline } = require("../server/narrationPayloadPipeline");

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function createPipeline() {
  return createNarrationPayloadPipeline({
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
}

function pushTurn(pipeline, params) {
  const now = Date.now();
  const fakeRes = {
    __requestStartMs: now - Number(params.latencyMs ?? 0),
    writeHead: () => {},
    end: () => {}
  };
  pipeline.sendJson(fakeRes, 200, {
    reply: "ok",
    speaker: { id: "mj", label: "MJ", kind: "mj" },
    intent: { type: "story_action", commitment: "declaratif", confidence: 0.86 },
    director: { mode: "scene_only", applyRuntime: false },
    worldState: {},
    phase12: {
      aiCallBudget: {
        used: Number(params.aiUsed ?? 0),
        max: 2,
        primaryUsed: Number(params.primaryUsed ?? 0),
        primaryMax: 1,
        fallbackUsed: Number(params.fallbackUsed ?? 0),
        fallbackMax: 1,
        blocked: Number(params.blocked ?? 0),
        primaryBlocked: 0,
        fallbackBlocked: Number(params.blocked ?? 0)
      }
    }
  });
}

function main() {
  process.env.NARRATION_PHASE7_TARGET_AVG_AI_CALLS = "1.4";
  process.env.NARRATION_PHASE7_TARGET_P95_MS = "1000";
  process.env.NARRATION_PHASE7_TARGET_BLOCKED_RATE_PCT = "10";

  const pipeline = createPipeline();
  pushTurn(pipeline, { latencyMs: 350, aiUsed: 1, primaryUsed: 1, fallbackUsed: 0, blocked: 0 });
  pushTurn(pipeline, { latencyMs: 1200, aiUsed: 2, primaryUsed: 1, fallbackUsed: 1, blocked: 1 });
  pushTurn(pipeline, { latencyMs: 900, aiUsed: 2, primaryUsed: 1, fallbackUsed: 1, blocked: 0 });

  const stats = pipeline.buildPhase7PerformanceStatsPayload();
  if (Number(stats.turns ?? 0) < 3) fail("Phase7 perf turns should be >= 3");
  if (Number(stats.turnsWithLatency ?? 0) < 3) fail("Phase7 perf turnsWithLatency should be >= 3");
  if (Number(stats.avgAiCallsPerTurn ?? 0) <= 1.4) fail("avgAiCallsPerTurn should exceed target in scenario");
  if (Number(stats.latency?.p95LatencyMs ?? 0) <= 1000) fail("p95 latency should exceed target in scenario");
  if (Number(stats.blockedRatePct ?? 0) <= 10) fail("blockedRatePct should exceed target in scenario");
  if (!stats.alerts?.avgAiCallsExceeded) fail("avgAiCallsExceeded alert should be true");
  if (!stats.alerts?.p95LatencyExceeded) fail("p95LatencyExceeded alert should be true");
  if (!stats.alerts?.blockedRateExceeded) fail("blockedRateExceeded alert should be true");
  ok("Phase7 performance stats and alerts are computed");

  console.log("[OK] Phase 7 validation passed.");
}

main();

