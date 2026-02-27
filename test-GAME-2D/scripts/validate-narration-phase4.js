#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { createAiCallBudgetController } = require("../server/narrationAiBudget");

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function main() {
  const root = path.resolve(__dirname, "..");
  const chatHandlerPath = path.join(root, "server", "narrationChatHandler.js");
  const payloadPipelinePath = path.join(root, "server", "narrationPayloadPipeline.js");
  const chatText = readUtf8(chatHandlerPath);
  const pipelineText = readUtf8(payloadPipelinePath);

  const aiFns = [
    "classifyNarrationWithAI",
    "detectWorldIntentWithAI",
    "arbitrateSceneIntentWithAI",
    "generateMjStructuredReply",
    "refineMjStructuredReplyWithTools",
    "extractLocalMemoryCandidatesWithAI",
    "generateEntityMicroProfilesWithAI",
    "summarizeConversationWindowWithAI",
    "resolveSpatialTargetWithAI",
    "arbitratePendingTravelWithAI",
    "assessRuntimeEligibilityWithAI",
    "resolveSceneFramePatchWithAI",
    "validateSceneFrameContinuityWithAI",
    "validateNarrativeStateConsistency"
  ];

  const directAwaitViolations = [];
  aiFns.forEach((fnName) => {
    const directAwait = new RegExp(`await\\s+${fnName}\\s*\\(`, "g");
    if (directAwait.test(chatText)) {
      directAwaitViolations.push(fnName);
    }
  });
  if (directAwaitViolations.length > 0) {
    fail(
      `Direct await AI calls detected in narrationChatHandler (must route through callAiWithBudget): ${directAwaitViolations.join(
        ", "
      )}`
    );
  }
  ok("No direct await on AI helpers in narrationChatHandler");

  const callAiWithBudgetCount = (chatText.match(/callAiWithBudget\(/g) || []).length;
  if (callAiWithBudgetCount < 8) {
    fail(`Unexpectedly low callAiWithBudget usage (${callAiWithBudgetCount})`);
  }
  ok(`callAiWithBudget usage detected (${callAiWithBudgetCount})`);

  const budget = createAiCallBudgetController({
    aiCallMaxPerTurn: 2,
    aiPrimaryMaxPerTurn: 1,
    aiFallbackMaxPerTurn: 1
  });
  if (!budget.tryConsume("primary-1", "primary")) fail("Primary budget should accept first call");
  if (budget.tryConsume("primary-2", "primary")) fail("Primary budget should block second primary call");
  if (!budget.tryConsume("fallback-1", "fallback")) fail("Fallback budget should accept first fallback call");
  if (budget.tryConsume("fallback-2", "fallback")) fail("Fallback budget should block second fallback call");
  const snap = budget.getSnapshot();
  if (snap.used !== 2 || snap.primaryUsed !== 1 || snap.fallbackUsed !== 1) {
    fail(`Budget snapshot mismatch: used=${snap.used} primary=${snap.primaryUsed} fallback=${snap.fallbackUsed}`);
  }
  ok("AI budget controller limits validated (2 total / 1 primary / 1 fallback)");

  if (!pipelineText.includes("buildPhase4AiRoutingStatsPayload")) {
    fail("Payload pipeline missing buildPhase4AiRoutingStatsPayload");
  }
  ok("Payload pipeline exposes phase4 AI routing stats");

  console.log("[OK] Phase 4 validation passed.");
}

main();

