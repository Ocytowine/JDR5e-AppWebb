"use strict";

function createNarrationAiRoutingController({ conversationMode, aiBudget }) {
  const routingStats = {
    attempted: 0,
    executed: 0,
    skipped: 0,
    byLabel: {}
  };
  const routingRecent = [];

  function record(label, status, reason = "") {
    const safeLabel = String(label ?? "unknown");
    const safeStatus = String(status ?? "unknown");
    const safeReason = String(reason ?? "").trim();
    routingStats.byLabel[safeLabel] = routingStats.byLabel[safeLabel] || {
      attempted: 0,
      executed: 0,
      skipped: 0
    };
    routingStats.attempted += 1;
    routingStats.byLabel[safeLabel].attempted += 1;
    if (safeStatus === "executed") {
      routingStats.executed += 1;
      routingStats.byLabel[safeLabel].executed += 1;
    } else {
      routingStats.skipped += 1;
      routingStats.byLabel[safeLabel].skipped += 1;
    }
    routingRecent.push({
      at: new Date().toISOString(),
      label: safeLabel,
      status: safeStatus,
      reason: safeReason
    });
    if (routingRecent.length > 32) routingRecent.shift();
  }

  async function callWithBudget(label, fn, fallback = null, kind = "fallback") {
    if (conversationMode !== "rp") {
      record(label, "skipped", "non-rp");
      return fallback;
    }
    if (typeof fn !== "function") {
      record(label, "skipped", "invalid-fn");
      return fallback;
    }
    if (!aiBudget.tryConsume(label, kind, { totalLabelPrefix: "" })) {
      record(label, "skipped", "budget-blocked");
      return fallback;
    }
    record(label, "executed", kind);
    return fn();
  }

  function hasBudgetFor(kind = "fallback") {
    const snapshot = aiBudget.getSnapshot(1);
    if (String(kind) === "primary") {
      return (
        Number(snapshot.used ?? 0) < Number(snapshot.max ?? 0) &&
        Number(snapshot.primaryUsed ?? 0) < Number(snapshot.primaryMax ?? 0)
      );
    }
    return (
      Number(snapshot.used ?? 0) < Number(snapshot.max ?? 0) &&
      Number(snapshot.fallbackUsed ?? 0) < Number(snapshot.fallbackMax ?? 0)
    );
  }

  function getRoutingPayload(limit = 16) {
    return {
      ...routingStats,
      byLabel: { ...routingStats.byLabel },
      recent: routingRecent.slice(-Math.max(1, Number(limit) || 1))
    };
  }

  return {
    record,
    callWithBudget,
    hasBudgetFor,
    getRoutingPayload
  };
}

module.exports = {
  createNarrationAiRoutingController
};

