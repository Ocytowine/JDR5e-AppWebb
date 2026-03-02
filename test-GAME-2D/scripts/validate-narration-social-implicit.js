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

function readDebug(payload) {
  return payload?.debug && typeof payload.debug === "object" ? payload.debug : payload;
}

async function main() {
  const port = 5186;
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

    const greet = await sendChat(base, {
      message: "je rentre dans la boutique et je salue la vendeuse",
      conversationMode: "rp",
      characterProfile: profile
    });
    const greetDebug = readDebug(greet);
    const greetIntent = greetDebug?.intent ?? {};
    const greetWorldState = greetDebug?.worldState ?? {};
    const greetInterlocutor = String(greetWorldState?.conversation?.activeInterlocutor ?? "").trim();
    if (String(greetIntent.type ?? "") !== "social_action") {
      fail("Greeting turn should be promoted to social_action");
    }
    if (!greetInterlocutor) {
      fail("Greeting turn should resolve an active interlocutor");
    }
    ok("Greeting turn resolves an implicit interlocutor");

    const prices = await sendChat(base, {
      message: "je demande les prix pour une tenue d'ecole de magie",
      conversationMode: "rp",
      characterProfile: profile
    });
    const pricesDebug = readDebug(prices);
    const pricesWorldState = pricesDebug?.worldState ?? {};
    const pricesInterlocutor = String(pricesWorldState?.conversation?.activeInterlocutor ?? "").trim();
    if (!pricesInterlocutor) {
      fail("Price question should keep the active interlocutor");
    }
    if (pricesInterlocutor !== greetInterlocutor) {
      fail("Price question should preserve the same interlocutor");
    }
    ok("Interlocutor continuity is preserved on the next social turn");

    console.log("[OK] Social implicit interlocutor validation passed.");
  } finally {
    if (!server.killed) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

