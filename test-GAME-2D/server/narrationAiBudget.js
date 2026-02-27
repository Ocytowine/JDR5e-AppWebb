"use strict";

function createAiCallBudgetController(config = {}) {
  const aiCallMaxPerTurn = Number(config.aiCallMaxPerTurn ?? 2) || 2;
  const aiPrimaryMaxPerTurn = Number(config.aiPrimaryMaxPerTurn ?? 1) || 1;
  const aiFallbackMaxPerTurn = Number(config.aiFallbackMaxPerTurn ?? 1) || 1;
  const budget = {
    used: 0,
    primaryUsed: 0,
    fallbackUsed: 0,
    primaryBlocked: 0,
    fallbackBlocked: 0,
    blocked: 0,
    blockedLabels: []
  };

  function tryConsume(label, kind = "fallback", options = {}) {
    const bucket = kind === "primary" ? "primary" : "fallback";
    const bucketUsed = bucket === "primary" ? budget.primaryUsed : budget.fallbackUsed;
    const bucketMax = bucket === "primary" ? aiPrimaryMaxPerTurn : aiFallbackMaxPerTurn;
    const safeLabel = String(label ?? "unknown");
    const totalLabelPrefix = String(options?.totalLabelPrefix ?? "");

    if (bucketUsed >= bucketMax) {
      budget.blocked += 1;
      if (bucket === "primary") budget.primaryBlocked += 1;
      else budget.fallbackBlocked += 1;
      budget.blockedLabels.push(`${bucket}:${safeLabel}`);
      return false;
    }
    if (budget.used >= aiCallMaxPerTurn) {
      budget.blocked += 1;
      if (bucket === "primary") budget.primaryBlocked += 1;
      else budget.fallbackBlocked += 1;
      budget.blockedLabels.push(`${totalLabelPrefix}${safeLabel}`);
      return false;
    }
    budget.used += 1;
    if (bucket === "primary") budget.primaryUsed += 1;
    else budget.fallbackUsed += 1;
    return true;
  }

  function getSnapshot(maxLabels = 8) {
    return {
      used: budget.used,
      max: aiCallMaxPerTurn,
      primaryUsed: budget.primaryUsed,
      primaryMax: aiPrimaryMaxPerTurn,
      fallbackUsed: budget.fallbackUsed,
      fallbackMax: aiFallbackMaxPerTurn,
      primaryBlocked: budget.primaryBlocked,
      fallbackBlocked: budget.fallbackBlocked,
      blocked: budget.blocked,
      blockedLabels: budget.blockedLabels.slice(-Math.max(1, Number(maxLabels) || 8))
    };
  }

  return {
    limits: {
      aiCallMaxPerTurn,
      aiPrimaryMaxPerTurn,
      aiFallbackMaxPerTurn
    },
    budget,
    tryConsume,
    getSnapshot
  };
}

module.exports = {
  createAiCallBudgetController
};
