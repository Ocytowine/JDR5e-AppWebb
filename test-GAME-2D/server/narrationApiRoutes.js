"use strict";

function createNarrationApiRoutes(deps = {}) {
  const parseJsonBody = deps.parseJsonBody;
  const sendJson = deps.sendJson;
  const loadNarrationRuntimeStateFromDisk = deps.loadNarrationRuntimeStateFromDisk;
  const getNarrationRuntime = deps.getNarrationRuntime;
  const narrationStatePath = deps.narrationStatePath;
  const saveNarrativeWorldState = deps.saveNarrativeWorldState;
  const createInitialNarrativeWorldState = deps.createInitialNarrativeWorldState;
  const sanitizeCharacterProfile = deps.sanitizeCharacterProfile;
  const buildCharacterContextPack = deps.buildCharacterContextPack;

  async function handle(req, res) {
    if (req.method === "GET" && req.url === "/api/narration-runtime-state") {
      try {
        const state = loadNarrationRuntimeStateFromDisk();
        if (!state) {
          sendJson(res, 404, {
            error: "Narrative runtime state not found",
            path: narrationStatePath
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
