#!/usr/bin/env node
"use strict";

const { createNarrationShopOfferTool } = require("../server/narrationShopOfferTool");
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
  const tool = createNarrationShopOfferTool();
  const direct = tool.getOffer(
    { query: "je cherche une tenue pour l'ecole de magie", limit: 3 },
    { worldState: { location: { label: "Rue marchande" } } }
  );
  if (!direct.ok) fail("Direct tool should return an offer");
  if (!Array.isArray(direct.items) || direct.items.length === 0) fail("Direct tool should return items");
  if (!direct.items.some((item) => Array.isArray(item?.tags) && item.tags.includes("academique"))) {
    fail("Direct tool should surface at least one academique item for school query");
  }
  ok("Direct shop offer tool returns contextual items");

  const port = 5188;
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

    await sendChat(base, {
      message: "je cherche un marchand de vetement",
      conversationMode: "rp",
      characterProfile: profile
    });

    const reply = await sendChat(base, {
      message: "je cherche une tenue pour l'ecole de magie",
      conversationMode: "rp",
      characterProfile: profile
    });
    const text = String(reply?.reply ?? "");
    if (!/Tunique d'etude sobre|Robe d'apprenti|Cape de laine sombre/i.test(text)) {
      fail("Narration should expose at least one concrete shop item");
    }
    if (!/\bpo\b|\bpa\b/i.test(text)) {
      fail("Narration should expose a concrete price");
    }
    if (/Je traite ton message comme informatif|Aucune mutation runtime n'est appliquee/i.test(text)) {
      fail("Narration should not leak the generic informative commitment fallback");
    }
    const debug = reply?.debug && typeof reply.debug === "object" ? reply.debug : {};
    const toolTrace = Array.isArray(debug?.mjToolTrace) ? debug.mjToolTrace : [];
    if (!toolTrace.some((row) => String(row?.tool ?? "").toLowerCase() === "session_shop_offer")) {
      fail("Tool trace should include session_shop_offer");
    }
    ok("Scene-only trade narration uses the shop offer tool");

    console.log("[OK] Shop offer tool validation passed.");
  } finally {
    if (!server.killed) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
