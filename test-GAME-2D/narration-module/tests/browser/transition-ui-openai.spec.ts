import { expect, test } from "@playwright/test";

test("transition locale complète avec enrichissement OpenAI", async ({ page }) => {
  test.setTimeout(360_000);
  const openAiRoles = new Set<string>();
  const openAiStatuses: number[] = [];
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as { request?: { role?: string } } | null;
    if (body?.request?.role) openAiRoles.add(body.request.role);
  });
  page.on("response", response => {
    if (response.url().includes("/api/narration/enhance-openai")) openAiStatuses.push(response.status());
  });
  await page.goto("/narration-module/tests/browser/transition-ui.html");
  await page.getByRole("radio", { name: "OpenAI" }).check();

  const input = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });
  const log = page.getByRole("log");

  await expect(input).toBeEnabled();
  await input.fill("Je franchis la porte du fond et entre dans l'arrière-salle.");
  await send.click();
  await expect(log).toContainText("Arrière-salle de l'Auberge du Seuil", { timeout: 45_000 });

  await input.fill("Que vois-je ici ?");
  await send.click();
  await expect(log).toContainText("lampe basse", { timeout: 45_000 });

  await input.fill("Je m'approche de la lampe basse.");
  await send.click();
  await expect(log).toContainText("Action locale enregistrée", { timeout: 45_000 });

  await input.fill("J'examine les traces humides.");
  await send.click();
  await expect(log).toContainText("plusieurs marques irrégulières", { timeout: 45_000 });
  await expect(log).not.toContainText("L'origine exacte des traces n'est pas directement perceptible.");

  await input.fill("Je repasse par la porte vers la salle commune.");
  await send.click();
  await expect(log).toContainText("Destination=location:inn-common-room", { timeout: 45_000 });
  await expect(log).not.toContainText("fallback local utilisé");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(openAiRoles).toContain("scene_writer");
  expect(openAiRoles).toContain("coherence_critic");
  expect(openAiStatuses.length).toBeGreaterThanOrEqual(5);
  expect(openAiStatuses.every(status => status === 200)).toBe(true);
});
