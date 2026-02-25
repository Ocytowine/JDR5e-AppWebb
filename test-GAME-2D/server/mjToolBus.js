"use strict";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeToolCall(entry) {
  const row = entry && typeof entry === "object" ? entry : {};
  const name = safeText(row.name || row.tool || row.id).toLowerCase();
  const args = row.args && typeof row.args === "object" ? row.args : {};
  if (!name) return null;
  return { name, args };
}

function buildResult(name, ok, summary, data) {
  return {
    tool: name,
    ok: Boolean(ok),
    summary: safeText(summary),
    data: data ?? null
  };
}

function createMjToolBus(params = {}) {
  const queryLore = typeof params.queryLore === "function" ? params.queryLore : () => [];

  function executeOne(call, context) {
    const name = call.name;
    const args = call.args ?? {};
    const worldState = context?.worldState ?? null;
    const contextPack = context?.contextPack ?? null;
    const runtimeState = context?.runtimeState ?? null;

    if (name === "get_world_state") {
      return buildResult(name, true, "Etat monde lu.", {
        location: worldState?.location ?? null,
        time: worldState?.time ?? null,
        metrics: worldState?.metrics ?? null,
        pending: context?.pending ?? null
      });
    }

    if (name === "query_lore") {
      const query = safeText(args.query || args.term || args.topic || context?.message || "");
      const limit = Math.max(1, Math.min(5, Number(args.limit ?? 3) || 3));
      const rows = queryLore(query, limit);
      return buildResult(name, true, `Lore consulté (${rows.length}).`, {
        query,
        matches: rows.map((row) => ({
          id: safeText(row?.id),
          title: safeText(row?.title),
          type: safeText(row?.type),
          summary: safeText(row?.summary).slice(0, 220)
        }))
      });
    }

    if (name === "query_player_sheet") {
      return buildResult(name, true, "Fiche PJ consultée.", {
        identity: contextPack?.identity ?? null,
        progression: contextPack?.progression ?? null,
        loadout: contextPack?.loadout ?? null,
        rules: contextPack?.rules ?? null,
        resources: contextPack?.resources ?? null
      });
    }

    if (name === "query_rules") {
      return buildResult(name, true, "Référentiel de règles consulté.", {
        rules: contextPack?.rules ?? null
      });
    }

    if (name === "session_db_read") {
      return buildResult(name, true, "Session DB lue.", {
        sessionPlaces: Array.isArray(worldState?.sessionPlaces) ? worldState.sessionPlaces.slice(0, 8) : [],
        activeInterlocutor: worldState?.conversation?.activeInterlocutor ?? null
      });
    }

    if (name === "session_db_write") {
      return buildResult(name, true, "Session DB write simulé (phase 1).", {
        accepted: true,
        note: "Ecriture persistante sera activée en phase 4."
      });
    }

    if (name === "quest_trama_tick") {
      return buildResult(name, true, "Etat runtime lu (tick non appliqué).", {
        quests: Object.keys(runtimeState?.quests ?? {}).length,
        tramas: Object.keys(runtimeState?.tramas ?? {}).length,
        companions: Object.keys(runtimeState?.companions ?? {}).length,
        trades: Object.keys(runtimeState?.trades ?? {}).length
      });
    }

    return buildResult(name, false, "Outil inconnu.", { requested: name });
  }

  function executeToolCalls(toolCalls, context) {
    const rows = Array.isArray(toolCalls) ? toolCalls : [];
    return rows
      .map((entry) => normalizeToolCall(entry))
      .filter(Boolean)
      .slice(0, 6)
      .map((call) => executeOne(call, context));
  }

  return {
    executeToolCalls
  };
}

module.exports = {
  createMjToolBus
};

