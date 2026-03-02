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

async function main() {
  const port = 5187;
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

    await sendChat(base, { message: "/reset", conversationMode: "rp", characterProfile: profile });
    await sendChat(base, { message: "je me dirige vers une rue marchande", conversationMode: "rp", characterProfile: profile });
    await sendChat(base, { message: "ok j'y vais", conversationMode: "rp", characterProfile: profile });

    const reply = await sendChat(base, {
      message: "je cherche une boutique de vetement",
      conversationMode: "rp",
      characterProfile: profile
    });
    const text = String(reply?.reply ?? "");
    if (/ton action fait bouger la scene/i.test(text)) {
      fail("Scene-only reply still uses the old generic phrase");
    }
    if (/la suite depend de ton prochain geste concret/i.test(text)) {
      fail("Scene-only reply still uses the old generic consequence");
    }
    if (/rep[eè]res r[eé]cents/i.test(text)) {
      fail("Scene-only reply still exposes the old recent markers label");
    }
    if (!/boutique|etal|marchand|devantures/i.test(text)) {
      fail("Scene-only reply should mention a concrete local commercial detail");
    }
    ok("Scene-only fallback reply is more contextual and less robotic");

    console.log("[OK] Scene-only quality validation passed.");
  } finally {
    if (!server.killed) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

