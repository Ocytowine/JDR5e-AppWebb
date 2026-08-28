import { expect, test } from "@playwright/test";

test("campaign-core, bootstrap and temporal contracts pass against real Chromium IndexedDB", async ({ page }) => {
  page.on("console", message => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on("pageerror", error => console.error(`[browser:error] ${error.stack ?? error.message}`));
  await page.goto("/narration-module/tests/browser/indexeddb.html");
  const result = await page.evaluate(() => window.indexedDbContractRun);
  const failures = [...result.contracts.failures, ...result.bootstrap.failures, ...result.temporal.failures, ...result.specific.failures];
  expect(failures, failures.map(failure => `${failure.name}\n${failure.message}`).join("\n\n")).toEqual([]);
  expect(result.contracts.passed).toBe(20);
  expect(result.bootstrap.passed).toBe(7);
  expect(result.temporal.passed).toBe(6);
  expect(result.specific.passed).toBe(18);
});

test("the Archives lore pilot bundles and compiles its real wiki sources", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/narration-ui/archiveLorePilot.ts";
    const module = await import(/* @vite-ignore */ modulePath);
    const applicationPath = "/narration-module/src/application/index.ts";
    const application = await import(/* @vite-ignore */ applicationPath);
    const pilot = await module.buildArchiveLorePilotV1();
    const briefResult = application.buildLoreGuidedSceneCreationBriefV1({ briefId: "browser-size-audit", packet: pilot.influencePacket, campaignProjections: [] });
    if (!briefResult.ok) throw new Error(briefResult.issues.join(" | "));
    const compact = application.buildSceneCreatorBriefViewV1(briefResult.brief);
    return {
      sceneId: pilot.scene.sceneId,
      locationName: pilot.scene.locationName,
      entityCount: pilot.entities.length,
      fragmentCount: pilot.fragments.length,
      influenceCount: pilot.influencePacket.influences.length,
      fullBriefChars: JSON.stringify(briefResult.brief).length,
      compactBriefChars: JSON.stringify(compact).length
    };
  });
  console.log(`[archive-lore-size] ${JSON.stringify(result)}`);
  expect(result.sceneId).toBe("wiki-location:archives_de_lysenthe");
  expect(result.locationName).toBe("Archives de Lysenthe");
  expect(result.entityCount).toBeGreaterThan(0);
  expect(result.compactBriefChars).toBeLessThan(result.fullBriefChars);
});
