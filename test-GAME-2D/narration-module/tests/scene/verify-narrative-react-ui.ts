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
assert.match(html, /data-narrative-ux-badge="Expression validée"/, "badge expression joueur rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="PNJ"/, "badge PNJ rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="Sans commit"/, "badge sans commit rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="Action non/, "badge action non executee rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="Possibilit/, "badge possibilite rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="Contexte"/, "badge contexte rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="Parole enregistr/, "badge parole enregistree rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="Aucun temps"/, "badge aucun temps rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="Clarification"/, "badge clarification rendu hors couleur");
assert.match(html, /data-narrative-ux-badge="IA"/, "badge IA rendu depuis sourceRefs");
assert.match(html, /data-narrative-ux-badge="Fallback"/, "badge fallback rendu hors couleur");
assert.match(html, /Indicateurs UX:/, "badges décrits par aria-label");

const pendingCheckHtml = renderToStaticMarkup(
  React.createElement(NarrativeConversationPanel, {
    packets: [narrativePanelFixture],
    pending: false,
    pendingSkillCheck: {
      pendingCheckId: "check:test:pending",
      proposal: {
        goal: "Examiner les traces près de la lampe",
        ability: "SAG",
        skillId: "perception",
        characterContext: { totalModifier: 5 },
        difficulty: { status: "RULE_RESOLVED", dc: 15 },
        stakes: {
          success: "Révéler les indices vérifiés.",
          failure: "Ne rien révéler de plus."
        }
      }
    } as never,
    onSubmit: () => undefined,
    onRollSkillCheck: () => undefined
  })
);
assert.match(pendingCheckHtml, /Test de compétence en attente/, "carte de jet accessible");
assert.match(pendingCheckHtml, /Examiner les traces/, "objectif du test affiché");
assert.match(pendingCheckHtml, /modificateur \+5/, "modificateur affiché");
assert.match(pendingCheckHtml, /DD 15/, "difficulté affichée");
assert.match(pendingCheckHtml, /Lancer le dé/, "commande explicite de lancer affichée");
assert.match(pendingCheckHtml, /textarea[^>]*disabled/u, "nouvelle intention bloquée pendant le jet");

assert.match(html, /data-narrative-ux-notice="possibility-no-commit"/, "encart possibilite sans commit rendu");
assert.match(html, /data-narrative-ux-notice="context-no-commit"/, "encart contexte sans commit rendu");
assert.match(html, /data-narrative-ux-notice="clarification-no-commit"/, "encart clarification sans commit rendu");
assert.match(html, /data-narrative-ux-notice="bounded-speech-commit"/, "encart parole enregistree rendu");
assert.match(html, /aucune action exécutée/, "notice explicite sans action exécutée");
assert.match(html, /question de contexte sans action/, "notice explicite contexte sans action");
assert.doesNotMatch(
  html,
  /block-system-context[\s\S]*data-narrative-ux-badge="Action non/u,
  "une question de contexte ne doit pas afficher le badge action non executee"
);
assert.match(html, /scène et le temps restent suspendus/, "notice explicite temps suspendu");
assert.match(html, /sans succès social automatique/, "notice explicite effet social borné");

const requestId = createNarrativeClientRequestId("test");
assert.match(requestId, /^test-/, "clientRequestId préfixé");
assert.notEqual(requestId, createNarrativeClientRequestId("test"), "clientRequestId variable");

const source = readFileSync(
  resolve("src/ui/NarrativeConversationPanel.tsx"),
  "utf8"
);
assert.equal(source.includes("rÃ"), false, "source UI ne doit pas contenir de texte UTF-8 corrompu");
assert.equal(source.includes("aucun résultat"), true, "motif no-commit doit couvrir 'aucun résultat' avec encodage correct");

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
