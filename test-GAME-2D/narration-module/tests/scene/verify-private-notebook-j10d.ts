import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7,
  interpretNarrativeInputWithAiV1,
  REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1
} from "../../src/application";
import type { ContractAiProviderV1 } from "../../src/ai/FakeContractAiProvider";
import type { AiCallRequestV1 } from "../../src/ai/types";
import {
  MemoryPlayerPrivateNotebookRepositoryV1,
  PLAYER_PRIVATE_NOTEBOOK_TEXT_LIMIT_V1,
  PlayerPrivateNotebookErrorV1,
  PlayerPrivateNotebookServiceV1,
  type PlayerPrivateNotebookScopeV1
} from "../../../src/narration-ui/playerPrivateNotebook";

const canary = "SECRET-CARNET-J10D-NE-JAMAIS-EXPOSER";
const scope: PlayerPrivateNotebookScopeV1 = {
  campaignId: "campaign:notebook-j10d",
  characterRef: "character:one"
};

async function main(): Promise<void> {
  const repository = new MemoryPlayerPrivateNotebookRepositoryV1();
  let id = 0;
  const service = new PlayerPrivateNotebookServiceV1(
    repository,
    () => new Date("2026-08-24T12:00:00.000Z"),
    () => `tab:${++id}`
  );

  let document = await service.read(scope);
  assert.equal(document.revision, 0);
  assert.deepEqual(document.tabs, []);
  document = await service.createTab({ scope, expectedRevision: 0, title: "Intrigue principale" });
  document = await service.updateTabText({
    scope,
    expectedRevision: document.revision,
    tabId: document.tabs[0]!.tabId,
    text: canary
  });
  document = await service.createTab({ scope, expectedRevision: document.revision, title: "Piste parallèle" });
  document = await service.renameTab({
    scope,
    expectedRevision: document.revision,
    tabId: document.tabs[1]!.tabId,
    title: "Hypothèses"
  });
  document = await service.reorderTab({
    scope,
    expectedRevision: document.revision,
    tabId: document.tabs[1]!.tabId,
    toIndex: 0
  });
  assert.deepEqual(document.tabs.map(tab => tab.title), ["Hypothèses", "Intrigue principale"]);
  document = await service.deleteTab({
    scope,
    expectedRevision: document.revision,
    tabId: document.tabs[0]!.tabId
  });
  assert.equal(document.tabs[0]?.text, canary);
  assert.equal((await service.read(scope)).tabs[0]?.text, canary);
  assert.deepEqual(
    (await service.read({ ...scope, characterRef: "character:two" })).tabs,
    [],
    "une autre portée personnage ne doit pas lire le carnet"
  );

  const staleRevision = document.revision;
  document = await service.renameTab({
    scope,
    expectedRevision: document.revision,
    tabId: document.tabs[0]!.tabId,
    title: "Révision récente"
  });
  await assert.rejects(
    () => service.updateTabText({
      scope,
      expectedRevision: staleRevision,
      tabId: document.tabs[0]!.tabId,
      text: "écriture obsolète"
    }),
    (error: unknown) => error instanceof PlayerPrivateNotebookErrorV1 && error.code === "STALE_REVISION"
  );
  await assert.rejects(
    () => service.updateTabText({
      scope,
      expectedRevision: document.revision,
      tabId: document.tabs[0]!.tabId,
      text: "x".repeat(PLAYER_PRIVATE_NOTEBOOK_TEXT_LIMIT_V1 + 1)
    }),
    (error: unknown) => error instanceof PlayerPrivateNotebookErrorV1 && error.code === "INVALID_TAB"
  );

  let capturedRequest: AiCallRequestV1 | null = null;
  const provider: ContractAiProviderV1 = {
    async generate(request) {
      capturedRequest = request;
      return {};
    }
  };
  await interpretNarrativeInputWithAiV1({
    campaignId: scope.campaignId,
    operationId: "operation:notebook-egress",
    intentId: "intent:notebook-egress",
    rawInput: "Je regarde autour de moi.",
    playableScene: REFERENCE_INN_RAIN_PLAYABLE_SCENE_V1,
    config: {
      provider,
      contractVersion: AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7,
      route: {
        schemaVersion: 1,
        routeId: "notebook-egress-audit",
        role: "player_intent_interpreter",
        providerKind: "FAKE_CONTRACT",
        providerId: "notebook-egress-audit",
        modelId: "audit",
        modelConfigVersion: "v7",
        certified: true,
        allowedContractVersions: [AI_INTENT_INTERPRETATION_CONTRACT_VERSION_V7],
        inputTokenLimit: 2_000,
        outputTokenLimit: 1_000,
        timeoutMs: 1_000,
        fallbackRouteIds: []
      },
      retryPolicy: {
        schemaVersion: 1,
        role: "player_intent_interpreter",
        maxTechnicalRetries: 0,
        maxTargetedCorrections: 0,
        maxFullRegenerations: 0,
        allowFallback: false
      }
    }
  });
  assert.ok(capturedRequest !== null);
  assert.equal(JSON.stringify(capturedRequest).includes(canary), false);

  const forbiddenPattern = /player-private-notebook|jdr5e-player-private-notebook|PlayerPrivateNotebook/iu;
  for (const file of await sourceFiles(resolve("narration-module/src"))) {
    assert.equal(forbiddenPattern.test(await readFile(file, "utf8")), false, `${file} ne doit pas dépendre du carnet privé`);
  }
  assert.equal(
    forbiddenPattern.test(await readFile(resolve("narration-module/server/narrativeOpenAiEnhancementRoute.js"), "utf8")),
    false,
    "la route IA serveur ne doit connaître aucun contrat du carnet"
  );
  assert.equal(JSON.stringify(document).includes(canary), true, "le canari doit rester dans le seul document privé");
  console.log("private-notebook/J10-D: operations, scopes, stale revision, limits and AI/campaign boundary verified");
}

async function sourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx|js)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
