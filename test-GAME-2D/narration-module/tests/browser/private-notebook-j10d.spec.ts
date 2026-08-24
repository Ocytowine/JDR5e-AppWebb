import { expect, test } from "@playwright/test";

const canary = "SECRET-CARNET-J10D-NAVIGATEUR";

test("J10-D conserve le carnet dans sa base privée sans sortie réseau", async ({ page }) => {
  const requestBodies: string[] = [];
  page.on("request", request => requestBodies.push(request.postData() ?? ""));
  await page.goto("/narration-module/tests/browser/private-notebook-j10d.html");
  await page.getByRole("button", { name: "Mon carnet" }).click();
  await expect(page.getByText("Carnet vide.")).toBeVisible();

  await page.getByRole("button", { name: "+ Intercalaire" }).click();
  await page.getByLabel("Titre de l’intercalaire").fill("Intrigue principale");
  await page.getByLabel("Titre de l’intercalaire").blur();
  await page.getByLabel("Notes privées").fill(canary);
  await expect(page.getByText("Notes enregistrées.")).toBeVisible();

  await page.getByRole("button", { name: "+ Intercalaire" }).click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  await page.getByRole("tab", { name: "Notes 2" }).click();
  await page.getByLabel("Titre de l’intercalaire").fill("Hypothèses");
  await page.getByLabel("Titre de l’intercalaire").blur();
  await expect(page.getByRole("tab", { name: "Hypothèses" })).toBeVisible();
  await page.getByRole("button", { name: "Déplacer à gauche" }).click();
  await expect(page.getByText("Ordre enregistré.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Mon carnet" }).click();
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveText("Hypothèses");
  await tabs.nth(1).click();
  await expect(page.getByLabel("Notes privées")).toHaveValue(canary);

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByText("Intercalaire supprimé.")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(1);

  const storage = await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    const databaseName = "jdr5e-player-private-notebook-v1";
    const request = indexedDB.open(databaseName, 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("notebook_documents", "readonly");
    const getAll = transaction.objectStore("notebook_documents").getAll();
    const documents = await new Promise<unknown[]>((resolve, reject) => {
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject(getAll.error);
    });
    database.close();
    return { names: databases.map(value => value.name), serialized: JSON.stringify(documents) };
  });
  expect(storage.names).toContain("jdr5e-player-private-notebook-v1");
  expect(storage.serialized).not.toContain(canary);
  expect(requestBodies.join("\n")).not.toContain(canary);
});
