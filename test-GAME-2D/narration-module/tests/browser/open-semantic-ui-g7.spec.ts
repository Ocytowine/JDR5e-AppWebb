import { expect, test } from "@playwright/test";

const rawInput = "Je tends ma fiole à la serveuse pour qu'elle la garde.";
const semanticMeaning = "Le personnage tente de remettre sa fiole à la serveuse.";

test("l'UI produit V8 et ne remet jamais la saisie brute au propriétaire V1", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/narration/enhance-openai", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: "simulated-scene-writer-unavailable" })
  }));
  await page.goto("/narration-module/tests/browser/open-semantic-ui-g7.html");
  const input = page.getByLabel("Entrée libre du joueur");
  await expect(input).toBeEnabled();
  await input.fill(rawInput);
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log").locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: rawInput })).toHaveCount(1, { timeout: 30_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Options techniques" }).click();
  await expect(page.getByLabel("Diagnostic technique du dernier échange")).toContainText('"operationId"');
  await expect(page.getByRole("log")).not.toContainText(/Intention canonique|Décision runtime locale|Éligibilité NAR-/iu);
  const capture = await page.evaluate(() => (
    window as Window & { __g7OwnerCapture?: unknown }
  ).__g7OwnerCapture ?? null);
  expect(capture).toEqual({
    rawInput: semanticMeaning,
    semanticSource: "OPEN_SEMANTIC_OWNER_ADAPTER_V1",
    capabilityId: "inventory.mutation"
  });
  expect(pageErrors).toEqual([]);
});
