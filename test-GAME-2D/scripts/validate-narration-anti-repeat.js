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

function makePayload() {
  return {
    reply:
      "Sur Rue marchande, tu prends le temps de regarder les devantures et les etals sans te presser. Parmi le va-et-vient ordinaire, plusieurs commerces peuvent retenir ton attention selon ce que tu cherches. Il te suffit de t'approcher d'une boutique ou d'un etal pour faire naitre un echange plus concret.",
    intent: { type: "story_action", commitment: "declaratif" },
    worldState: {
      location: { label: "Rue marchande" },
      conversation: {
        sceneFrame: {
          activePoiLabel: "",
          activeInterlocutorLabel: ""
        }
      }
    },
    mjResponse: {
      responseType: "narration",
      scene: "Sur Rue marchande, tu prends le temps de regarder les devantures et les etals sans te presser.",
      actionResult: "Parmi le va-et-vient ordinaire, plusieurs commerces peuvent retenir ton attention selon ce que tu cherches.",
      consequences: "Il te suffit de t'approcher d'une boutique ou d'un etal pour faire naitre un echange plus concret.",
      options: ["S'approcher d'une boutique", "Observer les etals"]
    }
  };
}

function main() {
  const sanitizer = createNarrationRpOutputSanitizer();
  const first = sanitizer.sanitizePayload(makePayload());
  const second = sanitizer.sanitizePayload(makePayload());

  const firstReply = String(first?.reply ?? "").trim();
  const secondReply = String(second?.reply ?? "").trim();
  if (!firstReply || !secondReply) fail("Replies should remain non-empty");
  if (firstReply === secondReply) {
    fail("Second identical narrative reply should be varied");
  }
  if (!/Autour de|reste attentif/i.test(secondReply)) {
    fail("Second reply should switch to a variation template");
  }
  ok("Anti-repeat variation is applied on repeated replies");

  console.log("[OK] Anti-repeat validation passed.");
}

main();

