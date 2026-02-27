"use strict";
const { readAiBudgetConfig } = require("./narrationAiConfig");

function createNarrationBackgroundTickEngine() {
  const PHASE6_STATS_MAX_SAMPLES = 24;
  const PHASE6_BACKGROUND_STATS = {
    turns: 0,
    eligibleTurns: 0,
    appliedTicks: 0,
    skippedTicks: 0,
    skippedByReason: {},
    aiBudget: {
      totalUsed: 0,
      totalBlocked: 0,
      primaryUsed: 0,
      fallbackUsed: 0,
      primaryBlocked: 0,
      fallbackBlocked: 0
    },
    byTransition: {},
    recent: []
  };

  function addSkip(reason) {
    const key = String(reason || "unknown");
    PHASE6_BACKGROUND_STATS.skippedTicks += 1;
    PHASE6_BACKGROUND_STATS.skippedByReason[key] =
      Number(PHASE6_BACKGROUND_STATS.skippedByReason[key] ?? 0) + 1;
    return key;
  }

  function trackRecent(entry) {
    PHASE6_BACKGROUND_STATS.recent.push({
      at: new Date().toISOString(),
      ...entry
    });
    if (PHASE6_BACKGROUND_STATS.recent.length > PHASE6_STATS_MAX_SAMPLES) {
      PHASE6_BACKGROUND_STATS.recent.shift();
    }
  }

  function shouldTick({ conversationMode, intentType, runtimeAlreadyApplied, source }) {
    const mode = String(conversationMode ?? "rp");
    if (mode !== "rp") return { ok: false, reason: "non-rp-mode" };
    const type = String(intentType ?? "story_action");
    if (type === "system_command") return { ok: false, reason: "system-command" };
    if (runtimeAlreadyApplied) return { ok: false, reason: "runtime-already-applied" };
    if (String(source ?? "").startsWith("debug")) return { ok: false, reason: "debug-branch" };
    return { ok: true, reason: "eligible" };
  }

  async function applyBackgroundNarrativeTick(params = {}) {
    PHASE6_BACKGROUND_STATS.turns += 1;
    const gate = shouldTick(params);
    if (!gate.ok) {
      const reason = addSkip(gate.reason);
      trackRecent({
        applied: false,
        reason,
        transitionId: "none",
        intentType: String(params?.intentType ?? "unknown")
      });
      return { applied: false, reason, transitionId: "none", outcome: null };
    }

    PHASE6_BACKGROUND_STATS.eligibleTurns += 1;
    const runtime = params?.runtime;
    const api = params?.api;
    const state = params?.state;
    if (!runtime || !api || !state) {
      const reason = addSkip("runtime-missing");
      trackRecent({
        applied: false,
        reason,
        transitionId: "none",
        intentType: String(params?.intentType ?? "unknown")
      });
      return { applied: false, reason, transitionId: "none", outcome: null };
    }

    try {
      const { aiCallMaxPerTurn, aiPrimaryMaxPerTurn, aiFallbackMaxPerTurn } = readAiBudgetConfig();
      const budget = {
        used: 0,
        primaryUsed: 0,
        fallbackUsed: 0,
        blocked: 0,
        blockedLabels: []
      };
      function consumeBudget(label, kind = "primary") {
        const bucket = kind === "primary" ? "primary" : "fallback";
        const bucketUsed = bucket === "primary" ? budget.primaryUsed : budget.fallbackUsed;
        const bucketMax = bucket === "primary" ? aiPrimaryMaxPerTurn : aiFallbackMaxPerTurn;
        if (bucketUsed >= bucketMax) {
          budget.blocked += 1;
          if (bucket === "primary") PHASE6_BACKGROUND_STATS.aiBudget.primaryBlocked += 1;
          else PHASE6_BACKGROUND_STATS.aiBudget.fallbackBlocked += 1;
          budget.blockedLabels.push(`${bucket}:${String(label ?? "unknown")}`);
          return false;
        }
        if (budget.used >= aiCallMaxPerTurn) {
          budget.blocked += 1;
          if (bucket === "primary") PHASE6_BACKGROUND_STATS.aiBudget.primaryBlocked += 1;
          else PHASE6_BACKGROUND_STATS.aiBudget.fallbackBlocked += 1;
          budget.blockedLabels.push(`total:${String(label ?? "unknown")}`);
          return false;
        }
        budget.used += 1;
        if (bucket === "primary") budget.primaryUsed += 1;
        else budget.fallbackUsed += 1;
        return true;
      }

      if (!consumeBudget("tickNarrationWithAI", "primary")) {
        PHASE6_BACKGROUND_STATS.aiBudget.totalBlocked += 1;
        PHASE6_BACKGROUND_STATS.aiBudget.primaryBlocked += 1;
        const reason = addSkip("ai-budget-exceeded");
        trackRecent({
          applied: false,
          reason,
          transitionId: "none",
          intentType: String(params?.intentType ?? "unknown"),
          aiBudget: {
            used: budget.used,
            max: aiCallMaxPerTurn,
            primaryUsed: budget.primaryUsed,
            primaryMax: aiPrimaryMaxPerTurn,
            fallbackUsed: budget.fallbackUsed,
            fallbackMax: aiFallbackMaxPerTurn,
            blocked: budget.blocked,
            blockedLabels: budget.blockedLabels.slice(-6)
          }
        });
        return { applied: false, reason, transitionId: "none", outcome: null };
      }

      const records = Array.isArray(params?.records) ? params.records : [];
      const safeMessage = String(params?.message ?? "").trim();
      const generator = new runtime.HeuristicMjNarrationGenerator();
      const outcome = await api.tickNarrationWithAI(
        {
          query: `[phase6-background] ${safeMessage || "continuer"}`.trim(),
          records,
          entityHints: {
            quest: Object.keys(state.quests ?? {}),
            trama: Object.keys(state.tramas ?? {}),
            companion: Object.keys(state.companions ?? {}),
            trade: Object.keys(state.trades ?? {})
          },
          minHoursBetweenMajorEvents: 2,
          blockOnGuardFailure: true
        },
        generator
      );

      PHASE6_BACKGROUND_STATS.aiBudget.totalUsed += budget.used;
      PHASE6_BACKGROUND_STATS.aiBudget.primaryUsed += budget.primaryUsed;
      PHASE6_BACKGROUND_STATS.aiBudget.fallbackUsed += budget.fallbackUsed;
      PHASE6_BACKGROUND_STATS.aiBudget.totalBlocked += budget.blocked;

      const transitionId = String(outcome?.appliedOutcome?.result?.transitionId ?? "none");
      PHASE6_BACKGROUND_STATS.appliedTicks += 1;
      PHASE6_BACKGROUND_STATS.byTransition[transitionId] =
        Number(PHASE6_BACKGROUND_STATS.byTransition[transitionId] ?? 0) + 1;
      trackRecent({
        applied: true,
        reason: "applied",
        transitionId,
        intentType: String(params?.intentType ?? "unknown"),
        aiBudget: {
          used: budget.used,
          max: aiCallMaxPerTurn,
          primaryUsed: budget.primaryUsed,
          primaryMax: aiPrimaryMaxPerTurn,
          fallbackUsed: budget.fallbackUsed,
          fallbackMax: aiFallbackMaxPerTurn,
          blocked: budget.blocked,
          blockedLabels: budget.blockedLabels.slice(-6)
        }
      });
      return { applied: true, reason: "applied", transitionId, outcome };
    } catch (err) {
      const reason = addSkip("tick-error");
      trackRecent({
        applied: false,
        reason,
        transitionId: "none",
        intentType: String(params?.intentType ?? "unknown"),
        error: String(err?.message ?? err)
      });
      return {
        applied: false,
        reason,
        transitionId: "none",
        outcome: null,
        error: String(err?.message ?? err)
      };
    }
  }

  function buildPhase6BackgroundStatsPayload() {
    const turns = Number(PHASE6_BACKGROUND_STATS.turns ?? 0);
    const eligibleTurns = Number(PHASE6_BACKGROUND_STATS.eligibleTurns ?? 0);
    const appliedTicks = Number(PHASE6_BACKGROUND_STATS.appliedTicks ?? 0);
    const eligibleRatePct = turns > 0 ? Number(((eligibleTurns / turns) * 100).toFixed(1)) : 0;
    const applyRatePct = eligibleTurns > 0 ? Number(((appliedTicks / eligibleTurns) * 100).toFixed(1)) : 0;
    return {
      turns,
      eligibleTurns,
      appliedTicks,
      skippedTicks: Number(PHASE6_BACKGROUND_STATS.skippedTicks ?? 0),
      eligibleRatePct,
      applyRatePct,
      skippedByReason: { ...PHASE6_BACKGROUND_STATS.skippedByReason },
      aiBudget: { ...PHASE6_BACKGROUND_STATS.aiBudget },
      byTransition: { ...PHASE6_BACKGROUND_STATS.byTransition },
      recent: PHASE6_BACKGROUND_STATS.recent.slice(-12)
    };
  }

  return {
    applyBackgroundNarrativeTick,
    buildPhase6BackgroundStatsPayload
  };
}

module.exports = {
  createNarrationBackgroundTickEngine
};
