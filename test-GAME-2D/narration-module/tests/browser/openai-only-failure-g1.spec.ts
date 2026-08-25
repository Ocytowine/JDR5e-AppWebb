import { expect, test } from "@playwright/test";

test("G1 garde une panne OpenAI sans fallback, domaine ni mutation", async ({ page }) => {
  const roles: string[] = [];
  await page.route("**/api/narration/enhance-openai", async route => {
    const body = route.request().postDataJSON() as { request?: { role?: string } } | null;
    if (body?.request?.role) roles.push(body.request.role);
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "simulated-openai-unavailable" })
    });
  });

  await page.goto("/narration-module/tests/browser/openai-only-failure-g1.html");
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled();
  await input.fill("Je prends la bourse et je pars vers les Halles.");
  await page.getByRole("button", { name: "Envoyer" }).click();

  const log = page.getByRole("log");
  await expect(log).toContainText(/reformuler/iu);
  await expect(log).toContainText(/Rien ne s'est encore produit/iu);
  await expect(log).not.toContainText(/Action locale enregistrée|fallback local/iu);
  await expect(page.getByRole("alert")).toHaveCount(0);

  const counters = await page.evaluate(() => (
    window as unknown as Window & {
      __openAiOnlyG1: { domainCanHandleCalls: number; domainExecuteCalls: number };
    }
  ).__openAiOnlyG1);
  expect(counters).toEqual({ domainCanHandleCalls: 0, domainExecuteCalls: 0 });
  expect(roles).toContain("player_intent_interpreter");
});
