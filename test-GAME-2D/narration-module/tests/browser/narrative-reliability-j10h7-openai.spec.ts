import { expect, test, type Request } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PREVIOUS_ROUTE_REQUESTS = Number(process.env.J10H7_PREVIOUS_ROUTE_REQUESTS ?? "0");
const MAX_TOTAL_ROUTE_REQUESTS = Number(process.env.J10H7_MAX_TOTAL_ROUTE_REQUESTS ?? "12");
const MAX_LIVE_CALLS = MAX_TOTAL_ROUTE_REQUESTS - PREVIOUS_ROUTE_REQUESTS;
const REMAINING_ONLY = process.env.J10H7_REMAINING_ONLY === "1";
const character = JSON.parse(readFileSync(resolve(
  "narration-module/tests/fixtures/character/valid/creator-ready.json"
), "utf8"));

type TurnName = "approach_salute" | "pronoun_followup" | "switch_actor" | "owner_transition";

interface LiveCallReceipt {
  turn: TurnName;
  role: string;
  contractVersion: string;
  status: number | null;
  durationMs: number | null;
  modelId: string | null;
  reasoningEffort: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  finishReason: string | null;
}

test("J10-H7: continuité conversationnelle et transition propriétaire OpenAI live", async ({ page }) => {
  test.setTimeout(600_000);
  const calls: LiveCallReceipt[] = [];
  const byRequest = new Map<Request, { receipt: LiveCallReceipt; startedAt: number }>();
  const pageErrors: string[] = [];
  let activeTurn: TurnName = "approach_salute";
  let issuedCalls = 0;

  await page.route("**/api/narration/enhance-openai", async route => {
    issuedCalls += 1;
    if (issuedCalls > MAX_LIVE_CALLS) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as {
      request?: { role?: string; contractVersion?: string };
    } | null;
    if (typeof body?.request?.role !== "string") return;
    const receipt: LiveCallReceipt = {
      turn: activeTurn,
      role: body.request.role,
      contractVersion: body.request.contractVersion ?? "unknown",
      status: null,
      durationMs: null,
      modelId: null,
      reasoningEffort: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      finishReason: null
    };
    calls.push(receipt);
    byRequest.set(request, { receipt, startedAt: Date.now() });
  });
  page.on("response", async response => {
    const tracked = byRequest.get(response.request());
    if (tracked === undefined) return;
    tracked.receipt.status = response.status();
    try {
      const payload = await response.json() as { metrics?: Partial<LiveCallReceipt> };
      const metrics = payload.metrics;
      if (metrics !== undefined) {
        tracked.receipt.modelId = metrics.modelId ?? null;
        tracked.receipt.reasoningEffort = metrics.reasoningEffort ?? null;
        tracked.receipt.inputTokens = metrics.inputTokens ?? null;
        tracked.receipt.outputTokens = metrics.outputTokens ?? null;
        tracked.receipt.totalTokens = metrics.totalTokens ?? null;
        tracked.receipt.finishReason = metrics.finishReason ?? null;
      }
    } catch {
      // Le statut HTTP et le diagnostic UI restent les preuves en cas de corps illisible.
    }
  });
  page.on("requestfinished", request => {
    const tracked = byRequest.get(request);
    if (tracked !== undefined) tracked.receipt.durationMs = Date.now() - tracked.startedAt;
  });
  page.on("pageerror", error => pageErrors.push(error.stack ?? error.message));

  await page.addInitScript(sheet => {
    localStorage.setItem("jdr5e_active_sheet", sheet.id);
    localStorage.setItem("jdr5e_saved_sheets", JSON.stringify([sheet]));
    if (sessionStorage.getItem("j10h7-live-reset") !== "done") {
      indexedDB.deleteDatabase("jdr5e-narration-player-campaigns-v1");
      sessionStorage.setItem("j10h7-live-reset", "done");
    }
  }, {
    id: "sheet-j10h7-openai-live",
    name: "Aryn — J10-H7 live",
    updatedAt: "2026-08-27T08:00:00.000Z",
    character
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  const log = page.getByRole("log");
  await expect(log).toContainText("Archives de Lysenthe", { timeout: 30_000 });
  await page.getByRole("button", { name: "Options techniques" }).click();
  await expect(page.getByText("Interpréteur joueur : OpenAI uniquement")).toBeVisible();

  if (!REMAINING_ONLY) {
    await submitDialogue(
      "approach_salute",
      "Je m'approche du garde et je le salue."
    );

    await page.reload();
    await page.getByRole("button", { name: "Reprendre", exact: true }).click();
    await expect(page.locator('[data-narrative-block-kind="RAW_INPUT"]', {
      hasText: "Je m'approche du garde et je le salue."
    })).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('[data-narrative-block-kind="NPC_SPEECH"]')).toHaveCount(1, { timeout: 30_000 });
    await page.getByRole("button", { name: "Options techniques" }).click();

    await submitDialogue(
      "pronoun_followup",
      "Je lui demande si tout va bien."
    );
  }
  await submitDialogue(
    "switch_actor",
    "Je me tourne vers l'archiviste et je lui demande comment sont classés les actes."
  );

  activeTurn = "owner_transition";
  const narrations = page.locator('[data-narrative-block-kind="GM_NARRATION"]');
  const narrationCount = await narrations.count();
  await submitRaw("Je prends le passage vers la place des archives.");
  await expect(narrations).toHaveCount(narrationCount + 1, { timeout: 150_000 });
  await expect(log).toContainText(/Place des archives/iu, { timeout: 30_000 });
  const transitionDiagnostic = await waitForDiagnostic(
    "Je prends le passage vers la place des archives."
  );
  expect(transitionDiagnostic.resolution.resultKind).toBe("COMMIT_APPLIED");
  expect(transitionDiagnostic.routing.executionPlan).not.toBeNull();
  expect(transitionDiagnostic.presentation.fallbackKind).not.toBe("TECHNICAL_INCIDENT");
  await settleTurn("owner_transition");

  const dialogueTurns: TurnName[] = REMAINING_ONLY
    ? ["switch_actor"]
    : ["approach_salute", "pronoun_followup", "switch_actor"];
  const executedTurns: TurnName[] = [...dialogueTurns, "owner_transition"];
  for (const turn of dialogueTurns) {
    const roles = roleNames(turn);
    expect(roles[0], `${turn}: l'interpréteur doit ouvrir le tour`).toBe("player_intent_interpreter");
    expect(roles, `${turn}: le performer PNJ doit répondre`).toContain("npc_performer");
    expect(roles, `${turn}: le planner V8 ne doit pas être rappelé`).not.toContain("mj_planner");
  }
  for (const turn of executedTurns) {
    const turnCalls = calls.filter(call => call.turn === turn);
    expect(turnCalls.length, `${turn}: au moins un appel`).toBeGreaterThan(0);
    expect(turnCalls.length, `${turn}: plafond transversal`).toBeLessThanOrEqual(3);
    expect(new Set(turnCalls.map(call => call.role)).size, `${turn}: rôles uniques`).toBe(turnCalls.length);
    expect(turnCalls.every(call => call.status === 200), `${turn}: HTTP 200`).toBe(true);
    expect(turnCalls.every(call => call.durationMs !== null && call.durationMs >= 0), `${turn}: latences`).toBe(true);
    expect(turnCalls.every(call => call.modelId !== null), `${turn}: modèles`).toBe(true);
    expect(turnCalls.every(call => call.inputTokens !== null && call.outputTokens !== null), `${turn}: tokens réels`).toBe(true);
    assertCanonicalRoleOrder(turnCalls.map(call => call.role), turn);
  }

  expect(issuedCalls).toBe(calls.length);
  expect(issuedCalls).toBeLessThanOrEqual(MAX_LIVE_CALLS);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  const playerThread = await log.innerText();
  expect(playerThread).not.toMatch(/Intention canonique|capability:|commit=|Décision runtime|tokens=/iu);

  console.log(`[j10h7-openai-live] ${JSON.stringify({
    callBudget: {
      previouslyUsed: PREVIOUS_ROUTE_REQUESTS,
      usedThisRun: issuedCalls,
      totalUsed: PREVIOUS_ROUTE_REQUESTS + issuedCalls,
      maximumTotal: MAX_TOTAL_ROUTE_REQUESTS
    },
    calls,
    totalTokens: calls.reduce((sum, call) => sum + (call.totalTokens ?? 0), 0),
    totalLatencyMs: calls.reduce((sum, call) => sum + (call.durationMs ?? 0), 0)
  })}`);

  async function submitDialogue(turn: TurnName, text: string): Promise<void> {
    activeTurn = turn;
    const speeches = page.locator('[data-narrative-block-kind="NPC_SPEECH"]');
    const previousCount = await speeches.count();
    await submitRaw(text);
    await expect(speeches).toHaveCount(previousCount + 1, { timeout: 150_000 });
    const diagnostic = await waitForDiagnostic(text);
    expect(diagnostic.interpretation.status).toBe("UNDERSTOOD");
    expect(diagnostic.routing.ownerProjectionStatus).toBe("SUPPORTED_BY_CURRENT_RUNTIME");
    expect(diagnostic.resolution.resultKind).toBe("COMMIT_APPLIED");
    expect(diagnostic.failuresByRole).toEqual([]);
    expect(diagnostic.resolution.npcPerformance).not.toBeNull();
    expect(diagnostic.presentation.fallbackKind).not.toBe("TECHNICAL_INCIDENT");
    expect(diagnostic.playerFacingIsolation).toBe("SEPARATE_DEVELOPER_PANEL_ONLY");
    await settleTurn(turn);
    await expect(page.locator('[data-narrative-block-kind="RAW_INPUT"]', { hasText: text })).toHaveCount(1);
  }

  async function submitRaw(text: string): Promise<void> {
    const input = page.getByLabel("Entrée libre du joueur");
    await expect(input).toBeEnabled({ timeout: 30_000 });
    await input.fill(text);
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(input).toBeEnabled({ timeout: 180_000 });
  }

  async function waitForDiagnostic(rawInput: string): Promise<any> {
    const diagnostic = page.getByLabel("Diagnostic technique du dernier échange");
    await expect.poll(async () => {
      try {
        return (JSON.parse(await diagnostic.inputValue()) as { rawInput?: string }).rawInput;
      } catch {
        return null;
      }
    }, { timeout: 30_000 }).toBe(rawInput);
    return JSON.parse(await diagnostic.inputValue());
  }

  async function settleTurn(turn: TurnName): Promise<void> {
    await expect.poll(() => {
      const turnCalls = calls.filter(call => call.turn === turn);
      return turnCalls.length > 0
        && turnCalls.every(call => call.status !== null && call.durationMs !== null && call.modelId !== null);
    }, { timeout: 30_000 }).toBe(true);
  }

  function roleNames(turn: TurnName): string[] {
    return calls.filter(call => call.turn === turn).map(call => call.role);
  }
});

function assertCanonicalRoleOrder(roles: string[], turn: TurnName): void {
  const rank = new Map([
    ["player_intent_interpreter", 1],
    ["mj_planner", 2],
    ["npc_performer", 3],
    ["scene_writer", 3],
    ["scene_creator", 3],
    ["coherence_critic", 4]
  ]);
  const values = roles.map(role => rank.get(role) ?? 99);
  expect(values, `${turn}: ordre canonique`).toEqual([...values].sort((a, b) => a - b));
}
