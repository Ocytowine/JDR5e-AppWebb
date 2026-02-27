#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function main() {
  const root = path.resolve(__dirname, "..");
  const chatHandlerPath = path.join(root, "server", "narrationChatHandler.js");
  const systemCommandsPath = path.join(root, "server", "narrationSystemCommands.js");
  const debugCommandsPath = path.join(root, "server", "narrationDebugCommands.js");
  const mutationEnginePath = path.join(root, "server", "narrationIntentMutationEngine.js");

  const chatText = read(chatHandlerPath);
  const systemText = read(systemCommandsPath);
  const debugText = read(debugCommandsPath);
  const mutationText = read(mutationEnginePath);

  const forbiddenDirectAssignments = [
    /world(?:State|Snapshot)\.conversation\.activeInterlocutor\s*=/g,
    /world(?:State|Snapshot)\.conversation\.pendingAction\s*=/g,
    /world(?:State|Snapshot)\.conversation\.pendingTravel\s*=/g,
    /world(?:State|Snapshot)\.conversation\.pendingAccess\s*=/g,
    /world(?:State|Snapshot)\.travel\.pending\s*=/g
  ];

  const combined = `${chatText}\n${systemText}\n${debugText}`;
  const violations = [];
  forbiddenDirectAssignments.forEach((pattern) => {
    const found = combined.match(pattern);
    if (found && found.length > 0) {
      violations.push(`${pattern} -> ${found.length}`);
    }
  });
  if (violations.length > 0) {
    fail(`Direct sensitive mutation assignment detected (must use applyCriticalMutation): ${violations.join(" | ")}`);
  }
  ok("No direct sensitive assignment on conversation/travel pending fields");

  const criticalCallCount =
    (chatText.match(/applyCriticalMutation\(/g) || []).length +
    (systemText.match(/applyCriticalMutation\(/g) || []).length;
  if (criticalCallCount < 20) {
    fail(`Unexpectedly low applyCriticalMutation usage (${criticalCallCount})`);
  }
  ok(`applyCriticalMutation usage detected (${criticalCallCount})`);

  if (!mutationText.includes("buildPhase3CriticalMutationStatsPayload")) {
    fail("Mutation engine missing buildPhase3CriticalMutationStatsPayload");
  }
  ok("Mutation engine exposes phase3 critical mutation stats payload");

  if (!debugText.includes("criticalMutations")) {
    fail("Phase3 debug payload missing criticalMutations block");
  }
  ok("Phase3 debug payload exposes critical mutation stats");

  console.log("[OK] Phase 3 validation passed.");
}

main();

