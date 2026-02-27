#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { createNarrationPayloadPipeline } = require("../server/narrationPayloadPipeline");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function main() {
  const root = process.cwd();
  const chatHandlerPath = path.join(root, "server", "narrationChatHandler.js");
  const apiRoutesPath = path.join(root, "server", "narrationApiRoutes.js");
  const chatText = read(chatHandlerPath);
  const apiRoutesText = read(apiRoutesPath);

  if (!chatText.includes("createNarrationAiRoutingController")) {
    fail("Phase8: narrationChatHandler does not use narrationAiRoutingController");
  }
  if (chatText.includes("function recordAiRouting(")) {
    fail("Phase8: inline recordAiRouting still present in narrationChatHandler");
  }
  if (chatText.includes("function callAiWithBudget(")) {
    fail("Phase8: inline callAiWithBudget still present in narrationChatHandler");
  }
  ok("AI routing/budget helper extracted from narrationChatHandler");

  if (apiRoutesText.includes("/api/narration/tick-ai")) {
    fail("Phase8: legacy /api/narration/tick-ai route still exists");
  }
  ok("Legacy narration tick-ai route is removed");

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
  let rawJson = "";
  const fakeRes = {
    __requestStartMs: Date.now() - 150,
    writeHead: () => {},
    end: (body) => {
      rawJson = String(body ?? "");
    }
  };

  pipeline.sendJson(fakeRes, 200, {
    reply: "Test RP",
    speaker: { id: "mj", label: "MJ", kind: "mj" },
    intent: { type: "story_action", commitment: "declaratif", confidence: 0.9 },
    director: { mode: "scene_only", applyRuntime: false },
    worldState: {},
    worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "test" },
    phase12: {
      aiCallBudget: {
        used: 1,
        max: 2,
        primaryUsed: 1,
        primaryMax: 1,
        fallbackUsed: 0,
        fallbackMax: 1,
        blocked: 0,
        primaryBlocked: 0,
        fallbackBlocked: 0
      }
    }
  });
  const payload = JSON.parse(rawJson || "{}");
  if (!payload.debug || typeof payload.debug !== "object") {
    fail("Phase8: debug channel is not attached");
  }
  if (payload.intent || payload.director || payload.worldState || payload.phase12) {
    fail("Phase8: top-level debug fields were not stripped from payload");
  }
  ok("Debug channel is separated from top-level narration payload");

  console.log("[OK] Phase 8 validation passed.");
}

main();

