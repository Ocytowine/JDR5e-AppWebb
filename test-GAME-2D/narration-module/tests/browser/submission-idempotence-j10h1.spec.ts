import { expect, test, type Page } from "@playwright/test";

const rawInput = "Je salue le garde blessé.";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/narration/enhance-openai", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: "simulated-scene-writer-unavailable" })
  }));
  await page.goto("/narration-module/tests/browser/submission-idempotence-j10h1.html");
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();
  await page.evaluate(() => window.sessionStorage.setItem("j10h1-browser-hold", "1"));
  await page.getByLabel("Entrée libre du joueur").fill(rawInput);
});

for (const gesture of ["double clic", "Entrée répétée", "Entrée puis clic"] as const) {
  test(`${gesture} ne lance qu'une soumission`, async ({ page }) => {
    await submitGesture(page, gesture);
    await expect.poll(() => submittedIds(page)).toHaveLength(1);
    await page.evaluate(() => (
      window as Window & { __j10h1Release?: () => void }
    ).__j10h1Release?.());
    await expect(page.getByRole("log").locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: rawInput }))
      .toHaveCount(1, { timeout: 30_000 });
    await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled({ timeout: 30_000 });
    expect(await submittedIds(page)).toHaveLength(1);
  });
}

test("un rechargement pendant le vol reprend le même identifiant", async ({ page }) => {
  await page.locator('form[aria-label="Saisie narrative libre"]').evaluate(form => {
    (form as HTMLFormElement).requestSubmit();
  });
  await expect.poll(() => submittedIds(page)).toHaveLength(1);
  const firstId = (await submittedIds(page))[0];
  await page.evaluate(() => window.sessionStorage.setItem("j10h1-browser-hold", "0"));
  await page.reload();
  await expect.poll(() => submittedIds(page), { timeout: 30_000 }).toHaveLength(2);
  expect(await submittedIds(page)).toEqual([firstId, firstId]);
  await expect(page.getByRole("log").locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: rawInput }))
    .toHaveCount(1, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => (
    window.sessionStorage.getItem("jdr5e_narrative_pending_submission_v1")
  ))).toBeNull();
});

test("une erreur libère le verrou et la reprise conserve l'identifiant", async ({ page }) => {
  await page.evaluate(() => {
    window.sessionStorage.setItem("j10h1-browser-hold", "0");
    window.sessionStorage.setItem("j10h1-browser-fail-next", "1");
  });
  await page.locator('form[aria-label="Saisie narrative libre"]').evaluate(form => {
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled({ timeout: 30_000 });
  const failedId = (await submittedIds(page))[0];
  await page.getByLabel("Entrée libre du joueur").fill(rawInput);
  await page.locator('form[aria-label="Saisie narrative libre"]').evaluate(form => {
    (form as HTMLFormElement).requestSubmit();
  });
  await expect.poll(() => submittedIds(page), { timeout: 30_000 }).toHaveLength(2);
  expect(await submittedIds(page)).toEqual([failedId, failedId]);
  await expect.poll(() => page.evaluate(() => (
    window.sessionStorage.getItem("jdr5e_narrative_pending_submission_v1")
  ))).toBeNull();
});

async function submitGesture(
  page: Page,
  gesture: "double clic" | "Entrée répétée" | "Entrée puis clic"
): Promise<void> {
  await page.locator('form[aria-label="Saisie narrative libre"]').evaluate((form, selectedGesture) => {
    const narrativeForm = form as HTMLFormElement;
    const button = narrativeForm.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (selectedGesture === "double clic") {
      button.click();
      button.click();
      return;
    }
    narrativeForm.requestSubmit();
    if (selectedGesture === "Entrée répétée") narrativeForm.requestSubmit();
    else button.click();
  }, gesture);
}

async function submittedIds(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(
    window.sessionStorage.getItem("j10h1-browser-call-ids") ?? "[]"
  ) as string[]);
}
