"use strict";

function createNarrationNaturalRenderer(deps = {}) {
  const oneLine = typeof deps.oneLine === "function" ? deps.oneLine : (v) => String(v ?? "");
  const normalizeMjOptions =
    typeof deps.normalizeMjOptions === "function" ? deps.normalizeMjOptions : () => [];
  const styleHelper = deps.styleHelper && typeof deps.styleHelper === "object" ? deps.styleHelper : null;

  const PHASE7_STATS_MAX_SAMPLES = 24;
  const PHASE7_RENDER_STATS = {
    totalReplies: 0,
    repliesWithOptions: 0,
    repliesWithoutOptions: 0,
    optionsSuppressed: 0,
    recent: []
  };

  function shouldShowOptions({ scene, actionResult, consequences, options }) {
    const safeOptions = normalizeMjOptions(options, 4);
    if (!safeOptions.length) return false;
    const context = [scene, actionResult, consequences].map((x) => String(x ?? "")).join(" ").toLowerCase();
    const usefulHints = [
      "chois",
      "clarif",
      "precis",
      "bloqu",
      "plan",
      "approche",
      "controle",
      "propos",
      "que fais",
      "confirmer",
      "reformuler"
    ];
    return usefulHints.some((hint) => context.includes(hint));
  }

  function tokenizeAnchors(text) {
    return String(text ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 5);
  }

  function groundOptionsToContext({ scene, actionResult, consequences, options }) {
    const safeOptions = normalizeMjOptions(options, 4);
    if (!safeOptions.length) return [];
    const contextTokens = new Set(
      tokenizeAnchors([scene, actionResult, consequences].join(" "))
    );
    if (!contextTokens.size) return [];

    const scored = safeOptions
      .map((opt, idx) => {
        const optionTokens = Array.from(new Set(tokenizeAnchors(opt)));
        const score = optionTokens.reduce(
          (acc, token) => acc + (contextTokens.has(token) ? 1 : 0),
          0
        );
        return { opt, idx, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.idx - b.idx);

    return scored.slice(0, 4).map((row) => row.opt);
  }

  function trackRender({ withOptions, optionsSuppressed, reason }) {
    PHASE7_RENDER_STATS.totalReplies += 1;
    if (withOptions) PHASE7_RENDER_STATS.repliesWithOptions += 1;
    else PHASE7_RENDER_STATS.repliesWithoutOptions += 1;
    if (optionsSuppressed) PHASE7_RENDER_STATS.optionsSuppressed += 1;
    PHASE7_RENDER_STATS.recent.push({
      at: new Date().toISOString(),
      withOptions: Boolean(withOptions),
      optionsSuppressed: Boolean(optionsSuppressed),
      reason: String(reason ?? "")
    });
    if (PHASE7_RENDER_STATS.recent.length > PHASE7_STATS_MAX_SAMPLES) {
      PHASE7_RENDER_STATS.recent.shift();
    }
  }

  function buildMjReplyBlocks(payload = {}) {
    const polished =
      styleHelper && typeof styleHelper.polishMjBlocks === "function"
        ? styleHelper.polishMjBlocks({
            scene: payload.scene,
            actionResult: payload.actionResult,
            consequences: payload.consequences
          })
        : payload;
    const scene = oneLine(polished.scene, 260) || "La scene evolue sans rupture visible.";
    const actionResult = oneLine(polished.actionResult, 320) || "Ton action est prise en compte par le MJ.";
    const consequences = oneLine(polished.consequences, 320) || "Aucune consequence majeure immediate.";
    const options = groundOptionsToContext({
      scene,
      actionResult,
      consequences,
      options: payload.options
    });
    const showOptions = shouldShowOptions({ scene, actionResult, consequences, options });

    const lines = [scene, actionResult, consequences];
    if (showOptions) {
      lines.push(`Pistes possibles: ${options.join(" | ")}`);
    }

    trackRender({
      withOptions: showOptions,
      optionsSuppressed: options.length > 0 && !showOptions,
      reason: showOptions ? "options-useful" : options.length > 0 ? "options-suppressed" : "no-options"
    });
    return lines.filter(Boolean).join("\n");
  }

  function buildPhase7RenderStatsPayload() {
    const totalReplies = Number(PHASE7_RENDER_STATS.totalReplies ?? 0);
    const repliesWithOptions = Number(PHASE7_RENDER_STATS.repliesWithOptions ?? 0);
    const optionsRatePct = totalReplies > 0 ? Number(((repliesWithOptions / totalReplies) * 100).toFixed(1)) : 0;
    return {
      totalReplies,
      repliesWithOptions,
      repliesWithoutOptions: Number(PHASE7_RENDER_STATS.repliesWithoutOptions ?? 0),
      optionsSuppressed: Number(PHASE7_RENDER_STATS.optionsSuppressed ?? 0),
      optionsRatePct,
      recent: PHASE7_RENDER_STATS.recent.slice(-12)
    };
  }

  return {
    buildMjReplyBlocks,
    buildPhase7RenderStatsPayload
  };
}

module.exports = {
  createNarrationNaturalRenderer
};
