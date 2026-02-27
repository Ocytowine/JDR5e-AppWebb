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

function readIntent(payload) {
  const debug = payload?.debug && typeof payload.debug === "object" ? payload.debug : payload;
  return debug?.intent ?? payload?.intent ?? {};
}

function readWorldDelta(payload) {
  const debug = payload?.debug && typeof payload.debug === "object" ? payload.debug : payload;
  return debug?.worldDelta ?? payload?.worldDelta ?? {};
}

function readWorldState(payload) {
  const debug = payload?.debug && typeof payload.debug === "object" ? payload.debug : payload;
  return debug?.worldState ?? payload?.worldState ?? {};
}

async function main() {
  const port = 5182;
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

    const travelProposal = await sendChat(base, {
      message: "je me dirige vers une rue marchande",
      conversationMode: "rp",
      characterProfile: profile
    });
    const proposalIntent = readIntent(travelProposal);
    const proposalDelta = readWorldDelta(travelProposal);
    const proposalState = readWorldState(travelProposal);
    if (String(proposalIntent.type ?? "") !== "story_action") {
      fail("Travel proposal intent type should be story_action");
    }
    if (String(proposalIntent.semanticIntent ?? "") !== "move_place") {
      fail("Travel proposal semanticIntent should be move_place");
    }
    if (!["declaratif", "volitif"].includes(String(proposalIntent.commitment ?? ""))) {
      fail("Travel proposal commitment should be declaratif/volitif");
    }
    if (String(proposalDelta.reason ?? "") !== "travel-proposed") {
      fail("Travel proposal worldDelta.reason should be travel-proposed");
    }
    const pendingTravelLabel =
      proposalState?.travel?.pending?.to?.label ??
      proposalState?.conversation?.pendingTravel?.placeLabel ??
      "";
    if (!String(pendingTravelLabel).trim()) {
      fail("Travel proposal should create pending travel target");
    }
    ok("Travel proposal semantic routing and pending travel are active");

    const travelConfirm = await sendChat(base, {
      message: "ok j'y vais",
      conversationMode: "rp",
      characterProfile: profile
    });
    const confirmDelta = readWorldDelta(travelConfirm);
    const confirmState = readWorldState(travelConfirm);
    if (String(confirmDelta.reason ?? "") !== "travel-confirmed") {
      fail("Travel confirmation worldDelta.reason should be travel-confirmed");
    }
    const pendingAfterConfirm =
      confirmState?.travel?.pending ??
      confirmState?.conversation?.pendingTravel ??
      null;
    if (pendingAfterConfirm) {
      fail("Travel confirmation should clear pending travel");
    }
    const lastTravelTo = confirmState?.travel?.last?.to?.label ?? "";
    if (!String(lastTravelTo).trim()) {
      fail("Travel confirmation should register travel.last.to.label");
    }
    ok("Travel confirmation applies and clears pending travel");

    const hypothetic = await sendChat(base, {
      message: "j'aimerais rentrer dans la boutique si possible",
      conversationMode: "rp",
      characterProfile: profile
    });
    const hypotheticIntent = readIntent(hypothetic);
    if (String(hypotheticIntent.commitment ?? "") !== "hypothetique") {
      fail("Hypothetical phrasing should map to commitment=hypothetique");
    }
    ok("Hypothetical commitment detection works on volitive/conditional phrasing");

    console.log("[OK] Phase 2 scenario validation passed.");
  } finally {
    if (!server.killed) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

