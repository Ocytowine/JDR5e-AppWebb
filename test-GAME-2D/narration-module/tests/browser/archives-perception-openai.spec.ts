import { expect, test, type Request } from "@playwright/test";

test("observation générale des Archives: prose continue et parcours OpenAI court", async ({ page }) => {
  test.setTimeout(120_000);
  const roles: string[] = [];
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string } } | null;
    if (body?.request?.role) roles.push(body.request.role);
  });

  await openArchivesPilot(page);
  await page.getByRole("radio", { name: "OpenAI" }).check();
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill("est ce que je vois des gens autour de moi ?");
  await page.getByRole("button", { name: "Envoyer" }).click();

  const narrations = page.locator('[data-narrative-block-kind="GM_NARRATION"]');
  await expect(narrations).toHaveCount(2, { timeout: 45_000 });
  const narration = narrations.last();
  const text = await narration.textContent() ?? "";
  expect(text).toMatch(/archiviste|clerc|garde/iu);
  expect((text.match(/À proximité/giu) ?? []).length).toBeLessThanOrEqual(1);
  expect(text).not.toMatch(/figure se détache\s*:\s*(Archiviste|Clerc|Garde)/iu);
  expect(text).not.toMatch(/fonction_principale|rumeurs/iu);

  const system = page.locator('[data-narrative-block-kind="SYSTEM_NOTICE"]').last();
  await expect(system).toContainText("IA enrichissement scene_writer", { timeout: 45_000 });
  console.log(`[archives-live] narration=${text.replace(/\s+/gu, " ").trim()}`);
  console.log(`[archives-live] telemetry=${(await system.textContent() ?? "").split(/\r?\n/gu).find(line => line.includes("IA enrichissement"))?.trim() ?? "indisponible"}`);
  expect(roles.filter(role => role === "scene_writer")).toHaveLength(1);
  expect(roles).not.toContain("coherence_critic");
});

test("intention composée aux Archives: l'approche puis la salutation atteint le PNJ", async ({ page }) => {
  test.setTimeout(240_000);
  const roles: string[] = [];
  const pendingCalls = new Map<Request, { role: string; startedAt: number }>();
  const roleDurations = new Map<string, number[]>();
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string; contractVersion?: string } } | null;
    if (!body?.request?.role) return;
    const role = `${body.request.role}:${body.request.contractVersion ?? "unknown"}`;
    roles.push(role);
    pendingCalls.set(request, { role, startedAt: Date.now() });
  });
  page.on("requestfinished", request => {
    const pending = pendingCalls.get(request);
    if (!pending) return;
    const values = roleDurations.get(pending.role) ?? [];
    values.push(Date.now() - pending.startedAt);
    roleDurations.set(pending.role, values);
    pendingCalls.delete(request);
  });

  await openArchivesPilot(page);
  await page.getByRole("radio", { name: "OpenAI" }).check();
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill("je m'avance vers l'archiviste, puis je le salue");
  await page.getByRole("button", { name: "Envoyer" }).click();

  const npcSpeech = page.locator('[data-narrative-block-kind="NPC_SPEECH"]');
  await expect(npcSpeech).toHaveCount(1, { timeout: 90_000 });
  await expect(npcSpeech.first()).not.toBeEmpty();
  const approach = page.locator('[data-narrative-block-kind="GM_NARRATION"]').last();
  await expect(approach).toContainText(/rapproches/iu);
  const system = page.locator('[data-narrative-block-kind="SYSTEM_NOTICE"]').last();
  await expect(system).toContainText("Intention canonique: address_visible_actor", { timeout: 30_000 });
  await expect(system).toContainText("1:APPROACH_TARGET → 2:SPEECH");
  expect(roles).toContain("player_intent_interpreter:ai-intent-semantic/7");
  expect(roles.some(role => role.startsWith("npc_performer:"))).toBe(true);

  await input.fill("je le remercie puis je m'écarte pour le laisser travailler");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(npcSpeech).toHaveCount(2, { timeout: 90_000 });
  const departure = page.locator('[data-narrative-block-kind="GM_NARRATION"]').last();
  await expect(departure).toContainText(/écartes/iu);
  const finalSystem = page.locator('[data-narrative-block-kind="SYSTEM_NOTICE"]').last();
  await expect(finalSystem).toContainText("1:SPEECH → 2:REPOSITION_AWAY");
  const renderedKinds = await page.locator("[data-narrative-block-kind]").evaluateAll(elements =>
    elements.map(element => element.getAttribute("data-narrative-block-kind"))
  );
  expect(renderedKinds.lastIndexOf("NPC_SPEECH")).toBeLessThan(renderedKinds.lastIndexOf("GM_NARRATION"));

  const systemNotices = page.locator('[data-narrative-block-kind="SYSTEM_NOTICE"]');
  const clarifications = page.locator('[data-narrative-block-kind="CLARIFICATION"]');
  await expect(input).toBeEnabled({ timeout: 30_000 });
  const clarificationsBefore = await clarifications.count();
  const interpreterCallsBeforeClarification = roles.filter(role => role.startsWith("player_intent_interpreter:")).length;
  await input.fill("je lui demande si je peux passer");
  const submitButton = page.getByRole("button", { name: "Envoyer" });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
  await expect.poll(
    () => roles.filter(role => role.startsWith("player_intent_interpreter:")).length,
    { timeout: 30_000 }
  ).toBe(interpreterCallsBeforeClarification + 1);
  await expect(clarifications).toHaveCount(clarificationsBefore + 1, { timeout: 90_000 });
  await expect(clarifications.last()).toContainText("Clarification");
  await expect(npcSpeech).toHaveCount(2);
  await expect(input).toBeEnabled({ timeout: 30_000 });

  const noticesBeforeExplicitTarget = await systemNotices.count();
  await input.fill("je demande clairement à l'archiviste s'il peut m'aider");
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
  await expect(npcSpeech).toHaveCount(3, { timeout: 90_000 });
  await expect(systemNotices).toHaveCount(noticesBeforeExplicitTarget + 1);
  await expect(npcSpeech.last()).not.toBeEmpty();
  const restoredSystem = systemNotices.last();
  await expect(restoredSystem).toContainText("Intention canonique: address_visible_actor");
  await expect(restoredSystem).not.toContainText("Clarification requise");

  console.log(`[archives-live-composed] npc=${(await npcSpeech.first().textContent() ?? "").replace(/\s+/gu, " ").trim()}`);
  console.log(`[archives-live-composed] roles=${roles.join(",")}`);
  console.log(`[archives-live-composed] role-durations=${JSON.stringify(
    Object.fromEntries([...roleDurations].map(([role, values]) => [
      role,
      {
        calls: values.length,
        minMs: Math.min(...values),
        maxMs: Math.max(...values),
        averageMs: Math.round(values.reduce((total, value) => total + value, 0) / values.length)
      }
    ]))
  )}`);
});

test("orientation aux Archives: un archiviste déjà visible ne demande aucun jet", async ({ page }) => {
  test.setTimeout(120_000);
  const roles: string[] = [];
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string; contractVersion?: string } } | null;
    if (body?.request?.role) roles.push(`${body.request.role}:${body.request.contractVersion ?? "unknown"}`);
  });

  await openArchivesPilot(page);
  await page.getByRole("radio", { name: "OpenAI" }).check();
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill("je cherche un archiviste, pour continuer mes recherches");
  await page.getByRole("button", { name: "Envoyer" }).click();

  const narrations = page.locator('[data-narrative-block-kind="GM_NARRATION"]');
  await expect(narrations).toHaveCount(2, { timeout: 60_000 });
  const narrativeText = await narrations.last().textContent() ?? "";
  expect(narrativeText).toMatch(/archiviste/iu);
  expect(narrativeText).not.toMatch(/vérification perceptive|ne peut pas être établi|jet/iu);
  await expect(page.getByText("Jet requis", { exact: true })).toHaveCount(0);
  const system = page.locator('[data-narrative-block-kind="SYSTEM_NOTICE"]').last();
  await expect(system).toContainText("Arbitrage contextuel: AUTOMATIC_SUCCESS", { timeout: 30_000 });
  await expect(system).toContainText("Perception: profondeur=GLANCE, information=PRESENCE");
  await expect(system).toContainText("Scene writer non appelé: orientation immédiate vers une présence déjà visible");
  expect(roles).toContain("player_intent_interpreter:ai-intent-semantic/7");
  expect(roles.some(role => role.startsWith("scene_writer:"))).toBe(false);
  expect(roles.some(role => role.startsWith("coherence_critic:"))).toBe(false);
  console.log(`[archives-live-orientation] narration=${narrativeText.replace(/\s+/gu, " ").trim()}`);
  console.log(`[archives-live-orientation] roles=${roles.join(",")}`);
});

test("référence pronominale sans focus: clarification sûre sans panne IA", async ({ page }) => {
  test.setTimeout(90_000);
  const roles: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string; contractVersion?: string } } | null;
    if (body?.request?.role) roles.push(`${body.request.role}:${body.request.contractVersion ?? "unknown"}`);
  });
  page.on("pageerror", error => pageErrors.push(error.message));

  await openArchivesPilot(page);
  await page.getByRole("radio", { name: "OpenAI" }).check();
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill("je lui demande si je peux passer");
  await page.getByRole("button", { name: "Envoyer" }).click();

  const clarification = page.locator('[data-narrative-block-kind="CLARIFICATION"]').last();
  await expect(clarification).toContainText("Clarification", { timeout: 60_000 });
  await expect(clarification).not.toContainText("Interprétation IA refusée");
  await expect(page.locator('[data-narrative-block-kind="NPC_SPEECH"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(roles).toContain("player_intent_interpreter:ai-intent-semantic/7");
  expect(roles.some(role => role.startsWith("npc_performer:"))).toBe(false);
  console.log(`[archives-live-no-focus] roles=${roles.join(",")}`);
});

async function openArchivesPilot(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le pilote" }).click();
  await expect(page.getByRole("radio", { name: "OpenAI" })).toBeVisible();
}
