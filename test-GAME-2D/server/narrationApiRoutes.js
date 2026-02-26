"use strict";

function createNarrationApiRoutes(deps = {}) {
  const parseJsonBody = deps.parseJsonBody;
  const sendJson = deps.sendJson;
  const loadNarrationRuntimeStateFromDisk = deps.loadNarrationRuntimeStateFromDisk;
  const getNarrationRuntime = deps.getNarrationRuntime;
  const narrationStatePath = deps.narrationStatePath;
  const saveNarrativeWorldState = deps.saveNarrativeWorldState;
  const createInitialNarrativeWorldState = deps.createInitialNarrativeWorldState;
  const buildLoreRecordsForQuery = deps.buildLoreRecordsForQuery;
  const openAiApiKey = deps.openAiApiKey;
  const computeWorldDelta = deps.computeWorldDelta;
  const loadNarrativeWorldState = deps.loadNarrativeWorldState;
  const applyWorldDelta = deps.applyWorldDelta;
  const buildNarrationChatReply = deps.buildNarrationChatReply;
  const sanitizeCharacterProfile = deps.sanitizeCharacterProfile;
  const buildCharacterContextPack = deps.buildCharacterContextPack;

  async function handle(req, res) {
    if (req.method === "GET" && req.url === "/api/narration-runtime-state") {
      try {
        const state = loadNarrationRuntimeStateFromDisk();
        if (!state) {
          sendJson(res, 404, {
            error: "Narrative runtime state not found",
            path: "narration-module/runtime/NarrativeGameState.v1.json"
          });
          return true;
        }
        sendJson(res, 200, state);
        return true;
      } catch (err) {
        console.error("[narration-runtime] Erreur lecture state:", err?.message ?? err);
        sendJson(res, 500, { error: "Narrative runtime read error" });
        return true;
      }
    }

    if (req.method === "POST" && req.url === "/api/narration/reset") {
      try {
        const runtime = getNarrationRuntime();
        const initial = runtime.NarrativeRuntime.createInitialState();
        runtime.StateRepository.save(initial, narrationStatePath);
        saveNarrativeWorldState(createInitialNarrativeWorldState());
        sendJson(res, 200, { ok: true });
        return true;
      } catch (err) {
        console.error("[narration-reset] Erreur:", err?.message ?? err);
        sendJson(res, 500, { ok: false, error: "Reset failed" });
        return true;
      }
    }

    if (req.method === "POST" && req.url === "/api/narration/tick-ai") {
      try {
        const body = await parseJsonBody(req);
        const prompt = String(body?.prompt ?? "").trim();
        if (!prompt) {
          sendJson(res, 400, { error: "prompt manquant" });
          return true;
        }

        const runtime = getNarrationRuntime();
        const api = runtime.GameNarrationAPI.createDefault(narrationStatePath);
        const state = api.getState();
        const records = buildLoreRecordsForQuery(prompt);

        const useOpenAI = Boolean(body?.useOpenAI) && Boolean(openAiApiKey);
        const generator = useOpenAI
          ? new runtime.OpenAIMjNarrationGenerator({
              apiKey: openAiApiKey,
              model: process.env.NARRATION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"
            })
          : new runtime.HeuristicMjNarrationGenerator();

        const outcome = await api.tickNarrationWithAI(
          {
            query: prompt,
            records,
            entityHints: {
              quest: Object.keys(state.quests),
              trama: Object.keys(state.tramas),
              companion: Object.keys(state.companions),
              trade: Object.keys(state.trades)
            },
            minHoursBetweenMajorEvents: 1,
            blockOnGuardFailure: true
          },
          generator
        );
        const intent = { type: "story_action" };
        const worldDelta = computeWorldDelta({ intent, outcome });
        const currentWorld = loadNarrativeWorldState();
        const transitionId = outcome?.appliedOutcome?.result?.transitionId ?? "none";
        const worldState = applyWorldDelta(currentWorld, worldDelta, {
          intentType: intent.type,
          transitionId
        });
        saveNarrativeWorldState(worldState);

        sendJson(res, 200, {
          reply: buildNarrationChatReply(outcome),
          loreRecordsUsed: records.length,
          worldDelta,
          worldState,
          outcome
        });
        return true;
      } catch (err) {
        console.error("[narration-tick-ai] Erreur:", err?.message ?? err);
        sendJson(res, 500, { error: "Tick narration impossible" });
        return true;
      }
    }

    if (req.method === "POST" && req.url === "/api/narration/character-context") {
      try {
        const body = await parseJsonBody(req);
        const worldState = loadNarrativeWorldState();
        const profile = sanitizeCharacterProfile(body?.characterProfile ?? null);
        const pack = buildCharacterContextPack(profile, worldState);
        sendJson(res, 200, {
          ok: Boolean(pack),
          contextPack: pack
        });
        return true;
      } catch (err) {
        console.error("[narration-character-context] Erreur:", err?.message ?? err);
        sendJson(res, 500, { error: "Context pack impossible" });
        return true;
      }
    }

    return false;
  }

  return { handle };
}

module.exports = {
  createNarrationApiRoutes
};
