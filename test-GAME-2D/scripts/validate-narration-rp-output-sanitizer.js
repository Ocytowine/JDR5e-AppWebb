#!/usr/bin/env node
"use strict";

const { createNarrationRpOutputSanitizer } = require("../server/narrationRpOutputSanitizer");

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function main() {
  const sanitizer = createNarrationRpOutputSanitizer();

  const payload = sanitizer.sanitizePayload({
    reply:
      "Ton action fait bouger la scene sans provoquer de bascule immediate. Repères récents: Arrivee: Rue marchande. Ancre lore utilisée par quest.detectee.to.acceptee La suite depend de ton prochain geste concret dans la scene.",
    intent: {
      type: "story_action",
      commitment: "declaratif"
    },
    mjResponse: {
      responseType: "narration",
      scene:
        "Ton action fait bouger la scene sans provoquer de bascule immediate. Ancre lore utilisée par quest.detectee.to.acceptee",
      actionResult: "Validation serveur: prix en cours.",
      consequences: "Aucune rupture de continuité n'est appliquée; tu peux poursuivre depuis ce même contexte.",
      options: ["quest.detectee.to.acceptee", "Parler a la vendeuse"]
    }
  });

  const reply = String(payload?.reply ?? "");
  if (/ancre lore/i.test(reply)) fail("Reply still contains meta anchor leak");
  if (/quest\./i.test(reply)) fail("Reply still contains transition id");
  if (/bascule immediate/i.test(reply)) fail("Reply still contains raw meta phrase");
  if (!reply.trim()) fail("Reply should remain non-empty after sanitization");
  ok("Reply meta leaks are removed");

  const scene = String(payload?.mjResponse?.scene ?? "");
  const actionResult = String(payload?.mjResponse?.actionResult ?? "");
  const consequences = String(payload?.mjResponse?.consequences ?? "");
  const options = Array.isArray(payload?.mjResponse?.options) ? payload.mjResponse.options : [];

  if (/ancre lore/i.test(scene) || /quest\./i.test(scene)) fail("mjResponse.scene still contains meta leak");
  if (/validation serveur/i.test(actionResult)) fail("mjResponse.actionResult still contains validation meta label");
  if (/rupture de continuité n'est appliquée/i.test(consequences)) fail("mjResponse.consequences still contains raw continuity meta phrase");
  if (options.some((item) => /quest\./i.test(String(item)))) fail("Options still contain transition ids");
  ok("mjResponse fields are sanitized");

  console.log("[OK] RP output sanitizer validation passed.");
}

main();

