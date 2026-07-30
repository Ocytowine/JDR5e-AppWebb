import { expect, test } from "@playwright/test";

test("8D certifie la cause, le combat et la reprise narrative", async ({
  page
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => {
    pageErrors.push(error.stack ?? error.message);
  });
  await page.route("**/api/enemy-ai", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "disabled in deterministic 8D gate" })
  }));
  await page.route("**/api/enemy-speech", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ line: "" })
  }));
  await page.goto(
    "/narration-module/tests/browser/bastion-vertical-8d.html?reset=1"
  );

  await expect(page.getByText(
    /Des assaillants atteignent la cour du bastion.*défense commence/iu
  )).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByRole("region", {
    name: "Défense tactique en attente"
  })).toContainText("Raid du pont");
  await expect(page.getByRole("log")).not.toContainText(
    "privateApproachRoute"
  );

  await page.getByRole("button", {
    name: "Ouvrir le plateau tactique"
  }).click();
  const board = page.locator(
    '[data-tactical-ready="true"][data-tactical-process-id]'
  );
  await expect(board).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText("Préparation du combat")).toHaveCount(0);
  await expect(board).toHaveAttribute(
    "data-tactical-checkpoint-id",
    /round-1:/,
    { timeout: 10_000 }
  );

  await page.reload();
  await page.getByRole("button", {
    name: /Tactique · défense en attente/
  }).click();
  await expect(page.locator(
    '[data-tactical-ready="true"][data-tactical-restored-checkpoint-id]'
  )).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole("button", { name: "Narration" }).click();
  await expect(page.getByLabel("Entrée libre du joueur")).toBeEnabled();

  await page.evaluate(async () => {
    if (window.__prepareBastionVertical8dTerminal === undefined) {
      throw new Error("8D terminal checkpoint helper unavailable");
    }
    await window.__prepareBastionVertical8dTerminal();
  });
  await page.reload();
  await page.getByRole("button", {
    name: /Tactique · défense en attente/
  }).click();

  await expect(page.getByText(
    /Les assaillants se replient.*bastion reste aux mains de ses défenseurs/iu
  )).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByRole("region", {
    name: "Défense tactique en attente"
  })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText(
    /Les assaillants se replient.*bastion reste aux mains de ses défenseurs/iu
  )).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByRole("log")).not.toContainText(
    "privateApproachRoute"
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

declare global {
  interface Window {
    __prepareBastionVertical8dTerminal?: () => Promise<string>;
  }
}
