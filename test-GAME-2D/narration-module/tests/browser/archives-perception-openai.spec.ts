import { expect, test } from "@playwright/test";

test("observation générale des Archives: prose continue et parcours OpenAI court", async ({ page }) => {
  test.setTimeout(120_000);
  const roles: string[] = [];
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string } } | null;
    if (body?.request?.role) roles.push(body.request.role);
  });

  await page.goto("/");
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
