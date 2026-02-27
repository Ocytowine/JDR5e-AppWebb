"use strict";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeToolCallShape(entry) {
  const row = entry && typeof entry === "object" ? entry : {};
  const name = safeText(row.name ?? row.tool ?? row.id).toLowerCase();
  if (!name) return null;
  const args = row.args && typeof row.args === "object" ? row.args : {};
  return { name, args };
}

function createNarrationToolRegistry() {
  const registry = {
    get_world_state: {
      capabilities: ["read"],
      domains: ["world", "state", "core"],
      allowInNonRp: true
    },
    query_lore: {
      capabilities: ["read"],
      domains: ["lore", "world"]
    },
    query_player_sheet: {
      capabilities: ["read"],
      domains: ["character", "rules"]
    },
    query_rules: {
      capabilities: ["read"],
      domains: ["rules"]
    },
    session_db_read: {
      capabilities: ["read"],
      domains: ["session-memory", "world", "core"]
    },
    session_db_write: {
      capabilities: ["write"],
      domains: ["session-memory", "world"]
    },
    quest_trama_tick: {
      capabilities: ["tick", "read"],
      domains: ["runtime", "quest", "world"]
    },
    semantic_intent_probe: {
      capabilities: ["read"],
      domains: ["core", "world", "rules"]
    }
  };

  function getTool(name) {
    const key = safeText(name).toLowerCase();
    return registry[key] ?? null;
  }

  function allowedToolNames() {
    return Object.keys(registry);
  }

  function deriveSemanticIntent({ intentType, directorMode, worldState, message }) {
    const type = safeText(intentType || "story_action");
    const mode = safeText(directorMode || "scene_only");
    const text = safeText(message).toLowerCase();
    const hasPendingTravel =
      Boolean(worldState?.travel?.pending) || Boolean(worldState?.conversation?.pendingTravel);
    const hasPendingAccess = Boolean(worldState?.conversation?.pendingAccess);
    const hasMoveCue = /(je\s+(me\s+)?(dirige|vais|marche|avance|file)\s+vers|deplacement|deplacer|j'y vais)/.test(
      text
    );
    const hasEnterCue = /(j'entre|je rentre|entrer|rentrer|franchir)/.test(text);
    const hasTradeCue = /(prix|vendre|acheter|negocier|marchandage|boutique|echoppe)/.test(text);
    const hasRulesCue = /(regle|jet|dd\b|difficulte|test de)/.test(text);
    const hasLoreCue = /(primaute|archives|lore|histoire|origine|que sais-tu)/.test(text);

    if (type === "system_command") return "system_command";
    if (type === "social_action") return "social_exchange";
    if (type === "lore_question") return "lore_query";
    if (hasRulesCue) return "rules_query";
    if (hasTradeCue) return "trade_action";
    if (hasLoreCue) return "lore_query";
    if (hasMoveCue || hasPendingTravel) return "move_place";
    if (hasEnterCue || hasPendingAccess) return "enter_place";
    if (type === "lore_question") return "lore_query";
    if (type === "free_exploration") return "inspect_local";
    if (text.includes("quete") || text.includes("trame")) return "quest_progress";
    if (mode === "runtime") return "resource_action";
    return "resource_action";
  }

  function deriveIntentPolicy(input = {}) {
    const semanticIntent =
      safeText(input.semanticIntent) ||
      deriveSemanticIntent({
        intentType: input.intentType,
        directorMode: input.directorMode,
        worldState: input.worldState,
        message: input.message
      });
    const base = {
      semanticIntent,
      allowRuntimeMutation: false,
      preferredTools: ["get_world_state", "session_db_read"],
      priorityDomains: intentDomains(semanticIntent)
    };
    if (semanticIntent === "move_place" || semanticIntent === "enter_place") {
      return {
        ...base,
        allowRuntimeMutation: true,
        preferredTools: ["get_world_state", "session_db_read", "query_lore", "semantic_intent_probe"]
      };
    }
    if (semanticIntent === "social_exchange") {
      return {
        ...base,
        preferredTools: ["get_world_state", "session_db_read", "query_player_sheet", "semantic_intent_probe"]
      };
    }
    if (semanticIntent === "lore_query" || semanticIntent === "rules_query") {
      return {
        ...base,
        preferredTools: ["get_world_state", "query_lore", "query_rules", "semantic_intent_probe"]
      };
    }
    if (semanticIntent === "trade_action") {
      return {
        ...base,
        preferredTools: ["get_world_state", "session_db_read", "query_rules", "semantic_intent_probe"]
      };
    }
    if (semanticIntent === "quest_progress") {
      return {
        ...base,
        allowRuntimeMutation: true,
        preferredTools: ["get_world_state", "quest_trama_tick", "session_db_read", "semantic_intent_probe"]
      };
    }
    return base;
  }

  function intentDomains(semanticIntent) {
    const key = safeText(semanticIntent);
    if (key === "move_place") return ["world", "lore", "session-memory", "runtime", "core"];
    if (key === "social_exchange") return ["world", "session-memory", "character", "rules", "core"];
    if (key === "inspect_local") return ["world", "lore", "session-memory", "core"];
    if (key === "lore_query") return ["lore", "world", "rules", "core"];
    if (key === "quest_progress") return ["runtime", "quest", "world", "session-memory", "core"];
    if (key === "system_command") return ["world", "state", "session-memory", "core"];
    return ["world", "rules", "session-memory", "core"];
  }

  function isCallAllowedByContext(call, context = {}) {
    const tool = getTool(call?.name);
    if (!tool) return false;
    if (String(context.conversationMode ?? "rp") !== "rp" && !tool.allowInNonRp) return false;
    if (context.allowWrite !== true && tool.capabilities.includes("write")) return false;
    const policy = deriveIntentPolicy(context);
    const domains = policy.priorityDomains;
    return tool.domains.some((domain) => domains.includes(domain));
  }

  function filterToolCalls(calls, context = {}) {
    const rows = Array.isArray(calls) ? calls : [];
    return rows
      .map((entry) => normalizeToolCallShape(entry))
      .filter(Boolean)
      .filter((call) => isCallAllowedByContext(call, context));
  }

  function mergeToolCalls(aiCalls, priorityCalls, options = {}) {
    const limit = Math.max(1, Math.min(12, Number(options.limit ?? 6) || 6));
    const merged = [];
    const seen = new Set();
    const push = (entry) => {
      const row = normalizeToolCallShape(entry);
      if (!row) return;
      const key = `${row.name}:${JSON.stringify(row.args)}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(row);
    };
    (Array.isArray(priorityCalls) ? priorityCalls : []).forEach(push);
    (Array.isArray(aiCalls) ? aiCalls : []).forEach(push);
    const filtered = filterToolCalls(merged, options.intentContext ?? {});
    return filtered.slice(0, limit);
  }

  function buildPriorityToolCalls({
    message,
    intent,
    directorPlan,
    conversationMode,
    worldState,
    hasCharacterProfile
  }) {
    if (String(conversationMode ?? "rp") !== "rp") return [];
    const intentType = String(intent?.type ?? "story_action");
    const mode = String(directorPlan?.mode ?? "scene_only");
    const requiresCheck = Boolean(intent?.requiresCheck);
    const riskLevel = String(intent?.riskLevel ?? "medium");
    const applyRuntime = Boolean(directorPlan?.applyRuntime);
    const semanticIntent = deriveSemanticIntent({
      intentType,
      directorMode: mode,
      worldState,
      message
    });
    const policy = deriveIntentPolicy({
      semanticIntent,
      intentType,
      directorMode: mode,
      worldState,
      message
    });

    const calls = [{ name: "get_world_state", args: {} }, { name: "semantic_intent_probe", args: {} }];
    const hasPending =
      Boolean(worldState?.conversation?.pendingAction) ||
      Boolean(worldState?.travel?.pending) ||
      Boolean(worldState?.conversation?.pendingTravel) ||
      Boolean(worldState?.conversation?.pendingAccess);
    if (hasPending) calls.push({ name: "session_db_read", args: { scope: "pending" } });
    calls.push({ name: "session_db_read", args: { scope: "scene-memory" } });

    if (hasCharacterProfile && ["system_command", "story_action", "social_action"].includes(intentType)) {
      calls.push({ name: "query_player_sheet", args: { scope: "identity-loadout-rules" } });
    }
    if (["lore", "exploration"].includes(mode) || intentType === "lore_question") {
      calls.push({ name: "query_lore", args: { query: message, limit: 4 } });
    }
    if (requiresCheck || riskLevel === "medium" || riskLevel === "high") {
      calls.push({ name: "query_rules", args: { query: message } });
    }
    if (applyRuntime || ["story_action", "social_action"].includes(intentType)) {
      calls.push({ name: "quest_trama_tick", args: { dryRun: true } });
    }

    return mergeToolCalls([], calls.concat(policy.preferredTools.map((name) => ({ name, args: {} }))), {
      limit: 6,
      intentContext: {
        intentType,
        semanticIntent,
        directorMode: mode,
        conversationMode,
        worldState,
        message
      }
    });
  }

  return {
    allowedToolNames,
    normalizeToolCallShape,
    deriveSemanticIntent,
    deriveIntentPolicy,
    filterToolCalls,
    mergeToolCalls,
    buildPriorityToolCalls
  };
}

module.exports = {
  createNarrationToolRegistry
};
