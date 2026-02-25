"use strict";

function createNarrationAiHelpers(params) {
  const callOpenAiJson = params?.callOpenAiJson;
  const normalizeForIntent = params?.normalizeForIntent;
  const clampNumber = params?.clampNumber;
  const aiEnabled = Boolean(params?.aiEnabled);
  const resolveModel =
    typeof params?.resolveModel === "function"
      ? params.resolveModel
      : () => "gpt-4.1-mini";
  const warn = typeof params?.warn === "function" ? params.warn : () => {};

  function normalizeOptionText(option) {
    if (typeof option === "string") return option.trim();
    if (typeof option === "number" || typeof option === "boolean") return String(option).trim();
    if (!option || typeof option !== "object") return "";
    const preferredKeys = ["label", "text", "title", "name", "value", "option", "prompt"];
    for (const key of preferredKeys) {
      const value = option[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    if (typeof option.action === "string" && option.action.trim()) {
      const target = typeof option.target === "string" ? option.target.trim() : "";
      return target ? `${option.action.trim()} ${target}`.trim() : option.action.trim();
    }
    return "";
  }

  function normalizeOptions(options, limit = 4) {
    if (!Array.isArray(options)) return [];
    return options
      .map((entry) => normalizeOptionText(entry))
      .map((text) => String(text ?? "").trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  function sanitizeToolCall(entry) {
    const row = entry && typeof entry === "object" ? entry : {};
    const name = String(row.name ?? row.tool ?? row.id ?? "").trim().toLowerCase();
    if (!name) return null;
    const args = row.args && typeof row.args === "object" ? row.args : {};
    return { name, args };
  }

  function sanitizeIntentCandidate(candidate) {
    const allowedType = new Set([
      "lore_question",
      "free_exploration",
      "story_action",
      "social_action",
      "system_command"
    ]);
    const allowedRisk = new Set(["none", "low", "medium", "high"]);

    const type = String(candidate?.type ?? candidate?.intentType ?? "story_action");
    const riskLevel = String(candidate?.riskLevel ?? "medium");
    const confidenceRaw = Number(candidate?.confidence ?? 0.6);

    return {
      type: allowedType.has(type) ? type : "story_action",
      confidence: Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw, 0, 1) : 0.6,
      requiresCheck: Boolean(
        candidate?.requiresCheck ?? (type === "story_action" || type === "social_action")
      ),
      riskLevel: allowedRisk.has(riskLevel) ? riskLevel : "medium",
      reason: String(candidate?.reason ?? "ai-director")
    };
  }

  function sanitizeDirectorCandidate(candidate, intentType) {
    const allowedModes = new Set(["lore", "exploration", "runtime", "scene_only"]);
    const modeRaw = String(candidate?.mode ?? candidate?.directorMode ?? "");
    const mode = allowedModes.has(modeRaw)
      ? modeRaw
      : intentType === "lore_question"
      ? "lore"
      : intentType === "free_exploration"
      ? "exploration"
      : "runtime";
    const applyRuntime =
      typeof candidate?.applyRuntime === "boolean" ? candidate.applyRuntime : mode === "runtime";
    return {
      mode,
      applyRuntime,
      source: "ai"
    };
  }

  async function classifyNarrationWithAI(message, records, worldState) {
    if (!aiEnabled) return null;
    try {
      const model = resolveModel();

      const systemPrompt =
        "Tu es un directeur narratif pour un JDR. " +
        "Retourne UNIQUEMENT un JSON valide avec les clés: " +
        "intentType, confidence, requiresCheck, riskLevel, reason, directorMode, applyRuntime. " +
        "intentType ∈ {lore_question, free_exploration, story_action, social_action, system_command}. " +
        "directorMode ∈ {lore, exploration, runtime, scene_only}. " +
        "Décide si applyRuntime doit être true seulement quand une progression d'état runtime est pertinente. " +
        "Ne force pas une transition pour une simple salutation ou une exploration vague.";

      const userPayload = {
        message,
        loreHints: Array.isArray(records) ? records.slice(0, 3).map((r) => r.title) : [],
        world: {
          reputation: Number(worldState?.metrics?.reputation ?? 0),
          localTension: Number(worldState?.metrics?.localTension ?? 0)
        }
      };

      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });

      const intent = sanitizeIntentCandidate(parsed);
      const director = sanitizeDirectorCandidate(parsed, intent.type);
      return { intent, director };
    } catch (err) {
      warn("[narration-director-ai] fallback heuristique:", err?.message ?? err);
      return null;
    }
  }

  function shouldApplyRuntimeForIntent(message, intent) {
    const type = intent?.type ?? "story_action";
    if (type !== "story_action" && type !== "social_action") return false;
    const normalized = normalizeForIntent(message);
    if (!normalized) return false;

    const strongNarrativeTriggers = [
      /\baccepte(r)?\b/,
      /\btermine(r)?\b/,
      /\brecrute(r)?\b/,
      /\bnegocie(r)?\b/,
      /\bmarchande(r)?\b/,
      /\bquete\b/,
      /\btrame\b/,
      /\bcompagnon\b/,
      /\bmarchandage\b/,
      /\bmission\b/,
      /\bcontrat\b/
    ];

    return strongNarrativeTriggers.some((pattern) => pattern.test(normalized));
  }

  function buildNarrativeDirectorPlan(intent) {
    const type = intent?.type ?? "story_action";
    if (type === "lore_question") {
      return { mode: "lore", applyRuntime: false, source: "heuristic" };
    }
    if (type === "free_exploration") {
      return { mode: "exploration", applyRuntime: false, source: "heuristic" };
    }
    return { mode: "runtime", applyRuntime: true, source: "heuristic" };
  }

  function sanitizeMjStructuredReply(candidate) {
    const safe = candidate && typeof candidate === "object" ? candidate : {};
    const responseType = String(safe.responseType ?? "narration").trim() || "narration";
    const directAnswer = String(safe.directAnswer ?? "").trim();
    const scene = String(safe.scene ?? "").trim();
    const actionResult = String(safe.actionResult ?? "").trim();
    const consequences = String(safe.consequences ?? "").trim();
    const options = normalizeOptions(safe.options, 4);
    const toolCalls = Array.isArray(safe.toolCalls)
      ? safe.toolCalls.map((entry) => sanitizeToolCall(entry)).filter(Boolean).slice(0, 6)
      : [];
    const worldIntent =
      safe.worldIntent && typeof safe.worldIntent === "object"
        ? {
            type: String(safe.worldIntent.type ?? "none").trim() || "none",
            reason: String(safe.worldIntent.reason ?? "").trim(),
            targetLabel: String(safe.worldIntent.targetLabel ?? "").trim(),
            targetId: String(safe.worldIntent.targetId ?? "").trim()
          }
        : { type: "none", reason: "", targetLabel: "", targetId: "" };
    const bypassExistingMechanics = Boolean(safe.bypassExistingMechanics);
    const confidence = Number(safe.confidence ?? 0.7);
    return {
      responseType,
      directAnswer,
      scene,
      actionResult,
      consequences,
      options,
      toolCalls,
      worldIntent,
      bypassExistingMechanics,
      confidence: Number.isFinite(confidence) ? clampNumber(confidence, 0, 1) : 0.7
    };
  }

  async function generateMjStructuredReply({
    message,
    records,
    worldState,
    contextPack,
    activeInterlocutor,
    conversationMode,
    pending
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu es le MJ principal d'un JDR narratif. " +
        "Tu reponds en restant coherent avec le monde courant (lieu, temps, etat), sans reciter tout le lore. " +
        "Retourne UNIQUEMENT un JSON valide avec les champs: " +
        "responseType, confidence, directAnswer, scene, actionResult, consequences, options, toolCalls, worldIntent, bypassExistingMechanics. " +
        "responseType dans {status, narration, clarification, resolution}. " +
        "toolCalls est un tableau d'objets {name,args}. Outils autorises: get_world_state, query_lore, query_player_sheet, query_rules, session_db_read, session_db_write, quest_trama_tick. " +
        "worldIntent.type dans {none, propose_travel, confirm_travel, access_attempt, runtime_progress}. " +
        "Tu peux renseigner worldIntent.targetLabel quand le joueur evoque une destination (meme formulation imparfaite). " +
        "bypassExistingMechanics=true seulement si la demande est une reponse MJ immediate de contexte/etat local sans action systeme lourde. " +
        "Priorite: reponse utile, concise, en francais, style MJ.";

      const userPayload = {
        playerMessage: String(message ?? ""),
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null,
          metrics: worldState?.metrics ?? null,
          startContext: worldState?.startContext ?? null,
          travel: worldState?.travel ?? null
        },
        pending: pending ?? null,
        activeInterlocutor: activeInterlocutor ?? null,
        loreHints: Array.isArray(records)
          ? records.slice(0, 5).map((row) => ({
              id: row?.id,
              title: row?.title,
              summary: row?.summary,
              type: row?.type
            }))
          : [],
        playerContext: contextPack
          ? {
              identity: contextPack?.identity ?? null,
              skills: contextPack?.rules?.skills ?? [],
              classSummary: contextPack?.progression?.resolvedClasses ?? []
            }
          : null
      };

      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeMjStructuredReply(parsed);
    } catch (err) {
      warn("[mj-structured-reply] fallback existant:", err?.message ?? err);
      return null;
    }
  }

  async function refineMjStructuredReplyWithTools({
    message,
    initialStructured,
    toolResults,
    worldState,
    contextPack,
    activeInterlocutor,
    conversationMode
  }) {
    const base = sanitizeMjStructuredReply(initialStructured);
    const safeToolResults = Array.isArray(toolResults) ? toolResults.slice(0, 8) : [];
    if (!safeToolResults.length) return base;
    if (!aiEnabled || typeof callOpenAiJson !== "function") {
      return {
        ...base,
        actionResult:
          base.actionResult ||
          "Le MJ confirme son evaluation en s'appuyant sur les donnees verifiees.",
        toolCalls: Array.isArray(base.toolCalls) ? base.toolCalls : []
      };
    }
    if (String(conversationMode ?? "rp") !== "rp") return base;

    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu es le MJ principal d'un JDR narratif. " +
        "Tu dois ajuster une reponse MJ existante en tenant compte des resultats d'outils serveur. " +
        "Retourne UNIQUEMENT un JSON valide avec les champs: " +
        "responseType, confidence, directAnswer, scene, actionResult, consequences, options, toolCalls, worldIntent, bypassExistingMechanics. " +
        "Contrainte: reste coherent avec les resultats outils; n'invente pas un fait contredit par ces resultats. " +
        "Conserve la fluidite RP et une formulation concise en francais.";

      const userPayload = {
        playerMessage: String(message ?? ""),
        existingReply: base,
        toolResults: safeToolResults,
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null,
          metrics: worldState?.metrics ?? null
        },
        activeInterlocutor: activeInterlocutor ?? null,
        playerContext: contextPack
          ? {
              identity: contextPack?.identity ?? null,
              skills: contextPack?.rules?.skills ?? [],
              classSummary: contextPack?.progression?.resolvedClasses ?? []
            }
          : null
      };

      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });

      const refined = sanitizeMjStructuredReply(parsed);
      return {
        ...refined,
        toolCalls:
          refined.toolCalls.length > 0 ? refined.toolCalls : Array.isArray(base.toolCalls) ? base.toolCalls : []
      };
    } catch (err) {
      warn("[mj-structured-refine-tools] fallback base:", err?.message ?? err);
      return base;
    }
  }

  return {
    classifyNarrationWithAI,
    shouldApplyRuntimeForIntent,
    buildNarrativeDirectorPlan,
    generateMjStructuredReply,
    refineMjStructuredReplyWithTools
  };
}

module.exports = {
  createNarrationAiHelpers
};
