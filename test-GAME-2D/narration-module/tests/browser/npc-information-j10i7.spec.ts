import { expect, test } from "@playwright/test";

const rawInput = "Savez-vous qui dirige la ville ?";

test("la vraie UI répond depuis le lore, diagnostique I7 et restaure le fil IndexedDB", async ({ page }) => {
  const pageErrors: string[] = [];
  const roles: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/narration/enhance-openai", async route => {
    const body = route.request().postDataJSON() as { request?: Record<string, unknown> } | null;
    const request = body?.request;
    const role = typeof request?.role === "string" ? request.role : "unknown";
    roles.push(role);
    if (request === undefined) {
      await route.fulfill({ status: 400, body: "missing request" });
      return;
    }
    if (role !== "player_intent_interpreter") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: `simulated-${role}-unavailable` })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ output: semanticEnvelope(request) })
    });
  });
  await page.goto("/narration-module/tests/browser/npc-information-j10i7.html");
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(rawInput);
  await page.getByRole("button", { name: "Envoyer" }).click();
  const log = page.getByRole("log");
  await expect(log.locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: rawInput })).toHaveCount(1, { timeout: 30_000 });
  await expect(log.locator('[data-narrative-block-kind="NPC_SPEECH"]')).toContainText(/Tharque regent de Lysenthe/iu, { timeout: 30_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Options techniques" }).click();
  const diagnostic = page.getByLabel("Diagnostic technique du dernier échange");
  await expect(diagnostic).toContainText('"information"');
  await expect(diagnostic).toContainText('"status": "RESOLVED"');
  await expect(diagnostic).toContainText('"decision": "ANSWER_DIRECTLY"');
  await expect(diagnostic).not.toContainText(/(?:secret|private|hidden):/iu);
  await page.reload();
  await expect(page.getByRole("log").locator('[data-narrative-block-kind="NPC_SPEECH"]')).toContainText(/Tharque regent de Lysenthe/iu, { timeout: 30_000 });
  await expect(page.getByRole("log").locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: rawInput })).toHaveCount(1);
  expect(roles[0]).toBe("player_intent_interpreter");
  expect(roles).toContain("npc_performer");
  expect(pageErrors).toEqual([]);
});

test("la vraie UI crée l'identité publique dans le commit du tour et la relit après réouverture", async ({ page }) => {
  const rulerInput = "Qui est le roi ?";
  const roles: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/narration/enhance-openai", async route => {
    const body = route.request().postDataJSON() as { request?: Record<string, unknown> } | null;
    const request = body?.request;
    const role = typeof request?.role === "string" ? request.role : "unknown";
    roles.push(role);
    if (request === undefined) {
      await route.fulfill({ status: 400, body: "missing request" });
      return;
    }
    if (role === "player_intent_interpreter") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ output: rulerSemanticEnvelope(request, rulerInput) })
      });
      return;
    }
    if (role === "scene_creator") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ output: missingIdentityEnvelope(request) })
      });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: `simulated-${role}-unavailable` })
    });
  });
  await page.goto("/narration-module/tests/browser/npc-information-j10i7.html");
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(rulerInput);
  await page.getByRole("button", { name: "Envoyer" }).click();
  const log = page.getByRole("log");
  await expect(log.locator('[data-narrative-block-kind="NPC_SPEECH"]')).toContainText(/Maëlys Varne/iu, { timeout: 30_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  expect(roles.filter(role => role === "scene_creator")).toHaveLength(1);

  await page.reload();
  const reopenedInput = page.getByLabel("Entrée libre du joueur");
  await expect(page.getByRole("log").locator('[data-narrative-block-kind="NPC_SPEECH"]')).toContainText(/Maëlys Varne/iu, { timeout: 30_000 });
  await expect(reopenedInput).toBeEnabled({ timeout: 30_000 });
  await reopenedInput.fill(rulerInput);
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log").locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: rulerInput })).toHaveCount(2, { timeout: 30_000 });
  await expect(reopenedInput).toBeEnabled({ timeout: 30_000 });
  expect(roles.filter(role => role === "scene_creator")).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

function semanticEnvelope(request: Record<string, unknown>) {
  const componentId = "j10i7:browser:ruler";
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion,
    outputId: `output:${String(request.attemptId)}`,
    callId: request.callId,
    attemptId: request.attemptId,
    packId: request.packId,
    snapshotId: request.snapshotId,
    role: request.role,
    status: "OK",
    payload: {
      rawInputEcho: rawInput,
      semanticFrame: {
        schemaVersion: 1,
        understandingStatus: "UNDERSTOOD",
        overallMeaning: "Le personnage demande au garde quelle autorité dirige actuellement Lysenthe.",
        overallCommitment: "committed",
        globalConditions: [],
        components: [{
          componentId,
          order: 1,
          meaning: "Demander au garde quelle autorité dirige actuellement Lysenthe.",
          commitment: "committed",
          conditions: [],
          negated: false,
          quoted: false,
          relationToPrevious: "NONE",
          alternativeGroupId: null,
          dependsOnComponentIds: [],
          simultaneousWithComponentIds: [],
          supersedesComponentIds: [],
          mentionedTargets: [{
            surface: "le garde",
            proposedRef: "npc:wiki-location:archives_de_lysenthe:ambient:3"
          }],
          suggestedDomain: "social",
          suggestedAction: "Demander qui dirige la ville.",
          suggestedCapabilityId: "scene.visible-dialogue",
          dialogueAct: {
            act: "ASK_QUESTION",
            contentGoal: "Connaître l'autorité qui dirige actuellement Lysenthe."
          },
          informationNeed: {
            schemaVersion: 1,
            contractVersion: "information-need/2",
            subjectMention: "la ville",
            proposedSubjectRef: "lore-entity:lysenthe",
            proposedScopeRefs: ["lore-entity:lysenthe"],
            proposedPropertyRefs: [
              "lore-property:lysenthe:type_gouvernance",
              "lore-property:lysenthe:siege_pouvoir",
              "lore-property:chateau_tharqual:proprietaire_principal"
            ],
            proposedRelationRefs: ["lore-edge:lysenthe:siege_pouvoir:chateau_tharqual"],
            completionPropertyRefs: [
              "lore-property:lysenthe:type_gouvernance",
              "lore-property:lysenthe:siege_pouvoir",
              "lore-property:chateau_tharqual:proprietaire_principal"
            ],
            requestedDimension: "personne ou autorité qui dirige actuellement la ville",
            temporalScope: "CURRENT",
            requestedAnswerShape: "IDENTITY",
            sourceComponentId: componentId
          }
        }],
        ambiguities: [],
        clarificationQuestion: null,
        confidence: "high"
      }
    },
    diagnostics: [],
    supersedesOutputId: null
  };
}

function rulerSemanticEnvelope(request: Record<string, unknown>, input: string) {
  const componentId = "j10j3:browser:ruler";
  const envelope = semanticEnvelope(request);
  envelope.payload.rawInputEcho = input;
  envelope.payload.semanticFrame.overallMeaning = "Le personnage demande au garde l'identité de la personne qui dirige actuellement Astryade.";
  envelope.payload.semanticFrame.components[0] = {
    ...envelope.payload.semanticFrame.components[0],
    componentId,
    meaning: "Demander au garde l'identité de la personne qui dirige actuellement Astryade.",
    suggestedAction: "Demander l'identité de l'autorité actuelle.",
    dialogueAct: {
      act: "ASK_QUESTION",
      contentGoal: "Connaître l'identité publique de la personne qui dirige actuellement Astryade."
    },
    informationNeed: {
      schemaVersion: 1,
      contractVersion: "information-need/2",
      subjectMention: "le roi",
      proposedSubjectRef: "lore-entity:astryade",
      proposedScopeRefs: ["lore-entity:astryade"],
      proposedPropertyRefs: [
        "lore-property:astryade:titre_dirigeant",
        "lore-property:astryade:identite_dirigeant"
      ],
      proposedRelationRefs: [],
      completionPropertyRefs: [
        "lore-property:astryade:titre_dirigeant",
        "lore-property:astryade:identite_dirigeant"
      ],
      requestedDimension: "identité publique de la personne qui dirige actuellement le territoire",
      temporalScope: "CURRENT",
      requestedAnswerShape: "IDENTITY",
      sourceComponentId: componentId
    }
  };
  return envelope;
}

function missingIdentityEnvelope(request: Record<string, unknown>) {
  const context = request.input as { roleContextPack?: { target?: { propertyRef?: string; valueKind?: string } } } | undefined;
  const target = context?.roleContextPack?.target;
  return {
    schemaVersion: 1,
    contractVersion: request.contractVersion,
    outputId: `output:${String(request.attemptId)}`,
    callId: request.callId,
    attemptId: request.attemptId,
    packId: request.packId,
    snapshotId: request.snapshotId,
    role: request.role,
    status: "OK",
    payload: {
      proposalId: `proposal:${String(request.operationId)}`,
      propertyRef: target?.propertyRef,
      valueKind: target?.valueKind,
      generatedValue: "Maëlys Varne",
      authority: "PROPOSE_ONLY_NO_COMMIT"
    },
    diagnostics: [],
    supersedesOutputId: null
  };
}
