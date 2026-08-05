import { expect, test, type Page, type Request } from "@playwright/test";

type TurnName = "clarification" | "action" | "dialogue" | "observation" | "transition";

interface OpenAiCallRecord {
  turn: TurnName;
  role: string;
  contractVersion: string;
  startedAt: number;
  durationMs: number | null;
  status: number | null;
}

test("gate OpenAI: rôles uniques et ordonnés sur les cinq familles de tours", async ({ page }) => {
  test.setTimeout(420_000);
  const calls: OpenAiCallRecord[] = [];
  const byRequest = new Map<Request, OpenAiCallRecord>();
  let activeTurn: TurnName = "clarification";
  page.on("request", request => {
    if (!request.url().includes("/api/narration/enhance-openai")) return;
    const body = request.postDataJSON() as {
      request?: { role?: string; contractVersion?: string };
    } | null;
    if (typeof body?.request?.role !== "string") return;
    const record: OpenAiCallRecord = {
      turn: activeTurn,
      role: body.request.role,
      contractVersion: body.request.contractVersion ?? "unknown",
      startedAt: Date.now(),
      durationMs: null,
      status: null
    };
    calls.push(record);
    byRequest.set(request, record);
  });
  page.on("response", response => {
    const record = byRequest.get(response.request());
    if (record !== undefined) record.status = response.status();
  });
  page.on("requestfinished", request => {
    const record = byRequest.get(request);
    if (record !== undefined) record.durationMs = Date.now() - record.startedAt;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le pilote" }).click();
  await page.getByRole("radio", { name: "OpenAI" }).check();
  const input = page.getByLabel("Entrée libre du joueur");
  const send = page.getByRole("button", { name: "Envoyer" });
  await expect(input).toBeEnabled({ timeout: 30_000 });

  const clarifications = page.locator('[data-narrative-block-kind="CLARIFICATION"]');
  const clarificationCount = await clarifications.count();
  activeTurn = "clarification";
  await submit(input, send, "je lui demande si je peux passer");
  await expect(clarifications).toHaveCount(clarificationCount + 1, { timeout: 90_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await settleCalls(calls, "clarification");

  const notices = page.locator('[data-narrative-block-kind="SYSTEM_NOTICE"]');
  const actionNoticeCount = await notices.count();
  activeTurn = "action";
  await submit(input, send, "je m'avance vers l'archiviste");
  await expect(notices).toHaveCount(actionNoticeCount + 1, { timeout: 90_000 });
  await expect(notices.last()).toContainText(
    /Intention canonique: (move_near_visible_actor|nonverbal_signal)/u
  );
  await expect(notices.last()).toContainText(
    "aucun effet caché, temps de jeu ou domaine propriétaire"
  );
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await settleCalls(calls, "action");

  const npcSpeech = page.locator('[data-narrative-block-kind="NPC_SPEECH"]');
  const npcCount = await npcSpeech.count();
  activeTurn = "dialogue";
  await submit(input, send, "je demande clairement à l'archiviste s'il peut m'aider");
  await expect(npcSpeech).toHaveCount(npcCount + 1, { timeout: 90_000 });
  await expect(npcSpeech.last()).not.toBeEmpty();
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await settleCalls(calls, "dialogue");

  const narrations = page.locator('[data-narrative-block-kind="GM_NARRATION"]');
  const observationNarrationCount = await narrations.count();
  activeTurn = "observation";
  await submit(input, send, "est ce que je vois des gens autour de moi ?");
  await expect(narrations).toHaveCount(observationNarrationCount + 1, { timeout: 90_000 });
  await expect(narrations.last()).toContainText(/archiviste|clerc|garde/iu);
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await settleCalls(calls, "observation");

  const transitionNarrationCount = await narrations.count();
  activeTurn = "transition";
  await submit(input, send, "je vais vers Quartier des archives");
  await expect(narrations).toHaveCount(transitionNarrationCount + 1, { timeout: 120_000 });
  await expect(narrations.last()).toContainText(/Quartier des Archives/iu);
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await settleCalls(calls, "transition");

  for (const turn of ["clarification", "action", "dialogue", "observation", "transition"] as const) {
    const turnCalls = calls.filter(call => call.turn === turn);
    const roles = turnCalls.map(call => call.role);
    expect(turnCalls.length, `${turn}: three billed calls maximum`).toBeLessThanOrEqual(3);
    expect(new Set(roles).size, `${turn}: every useful role is called once`).toBe(roles.length);
    expect(turnCalls.every(call => call.status === 200), `${turn}: every OpenAI response succeeds`).toBe(true);
    assertCanonicalRoleOrder(turn, roles);
  }

  expect(roleNames(calls, "clarification")).toEqual(["player_intent_interpreter"]);
  expect(roleNames(calls, "dialogue")).toEqual([
    "player_intent_interpreter",
    "mj_planner",
    "npc_performer"
  ]);
  assertPlannerThenOptionalWriter(roleNames(calls, "action"));
  assertPlannerThenOptionalWriter(roleNames(calls, "observation"));
  assertPlannerThenOptionalWriter(roleNames(calls, "transition"));
  await expect(page.getByRole("alert")).toHaveCount(0);

  console.log(`[pipeline-openai-live] ${JSON.stringify(calls.map(call => ({
    turn: call.turn,
    role: `${call.role}:${call.contractVersion}`,
    status: call.status,
    durationMs: call.durationMs
  })))}`);
});

async function submit(
  input: ReturnType<Page["getByLabel"]>,
  send: ReturnType<Page["getByRole"]>,
  text: string
) {
  await input.fill(text);
  await expect(send).toBeEnabled();
  await send.click();
}

async function settleCalls(calls: OpenAiCallRecord[], turn: TurnName) {
  await expect.poll(() => {
    const turnCalls = calls.filter(call => call.turn === turn);
    return turnCalls.length > 0 && turnCalls.every(call => call.status !== null && call.durationMs !== null);
  }, { timeout: 30_000 }).toBe(true);
}

function roleNames(calls: OpenAiCallRecord[], turn: TurnName): string[] {
  return calls.filter(call => call.turn === turn).map(call => call.role);
}

function assertCanonicalRoleOrder(turn: TurnName, roles: string[]) {
  const rank = new Map([
    ["player_intent_interpreter", 1],
    ["mj_planner", 2],
    ["npc_performer", 3],
    ["scene_writer", 3],
    ["scene_creator", 3],
    ["coherence_critic", 4]
  ]);
  const values = roles.map(role => rank.get(role) ?? 99);
  expect(values, `${turn}: canonical role order`).toEqual([...values].sort((a, b) => a - b));
}

function assertPlannerThenOptionalWriter(roles: string[]) {
  expect([
    ["player_intent_interpreter", "mj_planner"],
    ["player_intent_interpreter", "mj_planner", "scene_writer"]
  ]).toContainEqual(roles);
}
