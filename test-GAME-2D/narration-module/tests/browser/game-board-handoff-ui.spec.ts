import { expect, test } from "@playwright/test";

test("la graine initialise, restaure et termine GameBoard sans configuration libre", async ({ page }) => {
  await page.route("**/api/enemy-ai", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "disabled in deterministic UI fixture" })
  }));
  await page.route("**/api/enemy-speech", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ line: "" })
  }));
  await page.goto("/narration-module/tests/browser/game-board-handoff-ui.html");

  const board = page.locator(
    '[data-tactical-process-id="process:game-board-browser-7b"][data-tactical-ready="true"]'
  );
  await expect(board).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByLabel("Contexte tactique de campagne")).toContainText(
    "La carte, les participants et leurs positions viennent de la graine committée"
  );
  await expect(page.getByText("Préparation du combat")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await expect(board).toHaveAttribute(
    "data-tactical-checkpoint-id",
    /round-1:/,
    { timeout: 10_000 }
  );
  const checkpointId = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem(
      "fixture:game-board-checkpoint-7c-a"
    );
    return raw === null ? null : JSON.parse(raw).turnBoundaryId as string;
  });
  expect(checkpointId).not.toBeNull();
  await page.reload();
  const restoredBoard = page.locator(
    '[data-tactical-process-id="process:game-board-browser-7b"][data-tactical-ready="true"]'
  );
  await expect(restoredBoard).toHaveAttribute(
    "data-tactical-restored-checkpoint-id",
    /round-1:/
  );
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.evaluate(() => {
    const key = "fixture:game-board-checkpoint-7c-a";
    const checkpoint = JSON.parse(window.sessionStorage.getItem(key)!);
    checkpoint.enemies = checkpoint.enemies.map((enemy: { hp: number }) => ({
      ...enemy,
      hp: 0
    }));
    checkpoint.turnBoundaryId = "fixture:terminal-preparation";
    window.sessionStorage.setItem(key, JSON.stringify(checkpoint));
  });
  await page.reload();
  const terminalBoard = page.locator(
    '[data-tactical-process-id="process:game-board-browser-7b"][data-tactical-ready="true"]'
  );
  await expect(terminalBoard).toHaveAttribute(
    "data-tactical-end-condition",
    "all_hostiles_neutralized",
    { timeout: 10_000 }
  );
  await expect(
    page.locator('[data-terminal-report="all_hostiles_neutralized"]')
  ).toHaveCount(1, { timeout: 10_000 });
});
