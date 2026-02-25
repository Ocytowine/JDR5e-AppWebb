"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = process.env.HRP_EVAL_BASE_URL || "http://localhost:5175";
const CHAT_ENDPOINT = "/api/narration/chat";

const fixturePath = path.join(__dirname, "fixtures", "hrp-eval-character.json");
const characterProfile = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const scenarios = [
  {
    id: "weapons",
    prompt: "quelles armes je possède ?",
    expectedAny: ["obj_petit_couteau", "obj_arme_endommagee", "couteau", "arme endommagee"],
    expectedAll: [],
    wrongHints: ["arc long", "epee longue", "hache bataille"],
    allowClarification: false
  },
  {
    id: "gold",
    prompt: "combien d'or j'ai ?",
    expectedAny: ["10", "or: 10", "or 10", "10 or"],
    expectedAll: [],
    wrongHints: ["20", "100", "aucun or", "0 or"],
    allowClarification: false
  },
  {
    id: "athletisme_bonus",
    prompt: "quel est mon bonus d'athletisme ?",
    expectedAny: ["+4", "4"],
    expectedAll: [],
    wrongHints: ["+2", "+6", "-"],
    allowClarification: false
  },
  {
    id: "minor_ward",
    prompt: "puis-je lancer minor-ward ?",
    expectedAny: ["minor-ward", "oui", "slot", "niveau 1", "remaining"],
    expectedAll: [],
    wrongHints: ["inconnu", "impossible", "aucun sort connu"],
    allowClarification: false
  }
];

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsAny(text, values) {
  const source = normalize(text);
  return values.some((value) => source.includes(normalize(value)));
}

function containsAll(text, values) {
  const source = normalize(text);
  return values.every((value) => source.includes(normalize(value)));
}

async function callChat(baseUrl, prompt) {
  const response = await fetch(`${baseUrl}${CHAT_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: prompt,
      conversationMode: "hrp",
      characterProfile
    })
  });
  const raw = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { error: `invalid-json:${raw.slice(0, 220)}` };
  }
  return {
    ok: response.ok,
    status: response.status,
    payload
  };
}

function scoreScenario(scenario, output) {
  const reply = String(output?.payload?.reply ?? output?.payload?.error ?? "");
  const analysis = output?.payload?.hrpAnalysis ?? null;
  const clarified = /clarifier|preciser/i.test(reply) || Boolean(analysis?.needsClarification);
  const hasExpectedAny = scenario.expectedAny.length ? containsAny(reply, scenario.expectedAny) : true;
  const hasExpectedAll = scenario.expectedAll.length ? containsAll(reply, scenario.expectedAll) : true;
  const hasWrongHint = scenario.wrongHints.length ? containsAny(reply, scenario.wrongHints) : false;
  const factual = output.ok && hasExpectedAny && hasExpectedAll && !hasWrongHint;
  const usefulClarification = clarified && scenario.allowClarification;
  const hallucination = hasWrongHint || (!hasExpectedAny && !clarified);
  return {
    id: scenario.id,
    prompt: scenario.prompt,
    factual,
    clarified,
    usefulClarification,
    hallucination,
    confidence: Number(analysis?.confidence ?? 0),
    evidenceValid: analysis?.evidenceValid === true,
    reply
  };
}

async function main() {
  const baseUrl = DEFAULT_BASE_URL;
  const results = [];
  for (const scenario of scenarios) {
    const output = await callChat(baseUrl, scenario.prompt);
    results.push(scoreScenario(scenario, output));
  }

  const total = results.length;
  const factualCount = results.filter((r) => r.factual).length;
  const clarifiedCount = results.filter((r) => r.clarified).length;
  const usefulClarCount = results.filter((r) => r.usefulClarification).length;
  const hallucinationCount = results.filter((r) => r.hallucination).length;

  const report = {
    baseUrl,
    total,
    metrics: {
      factualAccuracy: Number((factualCount / total).toFixed(3)),
      clarificationRate: Number((clarifiedCount / total).toFixed(3)),
      usefulClarificationRate: clarifiedCount > 0 ? Number((usefulClarCount / clarifiedCount).toFixed(3)) : 0,
      hallucinationRate: Number((hallucinationCount / total).toFixed(3))
    },
    results
  };

  const outDir = path.join(__dirname, "..", "docs", "Evolution");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:]/g, "-");
  const outPath = path.join(outDir, `HRP-Eval-Report-${stamp}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`HRP eval report: ${outPath}`);
  console.log(JSON.stringify(report.metrics, null, 2));
}

main().catch((err) => {
  console.error("[eval-hrp-prompts] failed:", err?.message ?? err);
  process.exitCode = 1;
});

