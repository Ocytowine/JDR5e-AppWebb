import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createNarrativeClientRequestId,
  NarrativeConversationPanel
} from "../../../src/ui/NarrativeConversationPanel";
import { narrativePanelFixture } from "../../../src/ui/NarrativeConversationPanel.test-fixture";

const html = renderToStaticMarkup(
  React.createElement(NarrativeConversationPanel, {
    packets: [narrativePanelFixture],
    pending: false,
    title: "Narration de campagne",
    onSubmit: () => undefined
  })
);

assert.match(html, /Narration de campagne/, "titre rendu");
assert.match(html, /Aryn/, "locuteur joueur rendu");
assert.match(html, /Personnage joueur/, "rôle joueur rendu");
assert.match(html, /garde de la porte/, "PNJ rendu avec désignation stable");
assert.match(html, /PNJ/, "rôle PNJ rendu");
assert.match(html, /Maître du jeu/, "MJ rendu");
assert.match(html, /role="log"/, "fil rendu comme log accessible");
assert.match(html, /aria-label="Saisie narrative libre"/, "saisie libre accessible");
assert.match(html, /data-narrative-block-kind="PLAYER_EXPRESSION"/, "type de bloc rendu hors couleur");
assert.match(html, /data-narrative-speaker-kind="NPC"/, "type de locuteur rendu hors couleur");

const requestId = createNarrativeClientRequestId("test");
assert.match(requestId, /^test-/, "clientRequestId préfixé");
assert.notEqual(requestId, createNarrativeClientRequestId("test"), "clientRequestId variable");

const source = readFileSync(
  resolve("src/ui/NarrativeConversationPanel.tsx"),
  "utf8"
);

for (const forbidden of [
  "fetch(",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "/api/narration",
  "/api/enemy-ai",
  "/api/enemy-speech",
  "openaiProvider",
  "process.env"
]) {
  assert.equal(source.includes(forbidden), false, `forbidden browser-side effect found: ${forbidden}`);
}

console.log("narrative-react-ui/1: OK");
