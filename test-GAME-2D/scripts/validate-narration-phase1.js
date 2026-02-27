#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

async function sendChat(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/api/narration/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

function extractContract(payload) {
  const debug = payload?.debug && typeof payload.debug === "object" ? payload.debug : payload;
  return debug?.mjContract ?? payload?.mjContract ?? null;
}

function validateContract(contract, label) {
  if (!contract || typeof contract !== "object") fail(`${label}: mjContract missing`);
  if (String(contract.schemaVersion ?? "") !== "1.0.0") fail(`${label}: schemaVersion != 1.0.0`);
  if (String(contract.version ?? "") !== "1.0.0") fail(`${label}: version != 1.0.0`);
  const intent = contract.intent && typeof contract.intent === "object" ? contract.intent : null;
  if (!intent) fail(`${label}: contract.intent missing`);
  if (!String(intent.type ?? "").trim()) fail(`${label}: contract.intent.type missing`);
  if (!["declaratif", "volitif", "hypothetique", "informatif"].includes(String(intent.commitment ?? ""))) {
    fail(`${label}: invalid intent.commitment`);
  }
  const mjResponse = contract.mjResponse && typeof contract.mjResponse === "object" ? contract.mjResponse : null;
  if (!mjResponse) fail(`${label}: contract.mjResponse missing`);
  if (!String(mjResponse.responseType ?? "").trim()) fail(`${label}: contract.mjResponse.responseType missing`);
}

async function main() {
  const port = 5184;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await sleep(2500);
    const base = `http://localhost:${port}`;
    const profile = {
      id: "pj-gardefou",
      name: "Gardefou",
      race: "Elfe",
      classLabel: "Clerc",
      skills: ["discretion", "escamotage"]
    };

    await sendChat(base, {
      message: "/reset",
      conversationMode: "rp",
      characterProfile: profile
    });

    const narrativeTurn = await sendChat(base, {
      message: "je me dirige vers une rue marchande",
      conversationMode: "rp",
      characterProfile: profile
    });
    validateContract(extractContract(narrativeTurn), "narrative-turn");
    ok("Narrative turn contains a valid mjContract schema 1.0.0");

    const socialTurn = await sendChat(base, {
      message: "je cherche une boutique de vetement",
      conversationMode: "rp",
      characterProfile: profile
    });
    validateContract(extractContract(socialTurn), "social-turn");
    ok("Second turn preserves the same mjContract schema");

    const phase1Debug = await sendChat(base, {
      message: "/phase1-debug",
      conversationMode: "rp",
      characterProfile: profile
    });
    const phase1 = phase1Debug?.debug?.phase1 ?? phase1Debug?.phase1 ?? null;
    if (!phase1 || !phase1.dod) fail("Phase1 debug payload missing DoD block");
    if (typeof phase1.dod.groundingRatePct !== "number") fail("Phase1 debug missing groundingRatePct");
    ok("Phase1 debug exposes contract grounding metrics");

    console.log("[OK] Phase 1 validation passed.");
  } finally {
    if (!server.killed) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

