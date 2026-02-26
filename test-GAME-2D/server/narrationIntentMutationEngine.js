"use strict";

function createNarrationIntentMutationEngine(deps = {}) {
  const clampNumber = typeof deps.clampNumber === "function" ? deps.clampNumber : (v) => v;
  const normalizeWorldTime =
    typeof deps.normalizeWorldTime === "function"
      ? deps.normalizeWorldTime
      : (v) => v || { day: 1, hour: 0, minute: 0, label: "inconnu" };
  const worldTimeLabel =
    typeof deps.worldTimeLabel === "function" ? deps.worldTimeLabel : () => "inconnu";
  const createInitialNarrativeWorldState =
    typeof deps.createInitialNarrativeWorldState === "function"
      ? deps.createInitialNarrativeWorldState
      : () => ({});
  const sanitizePendingAction =
    typeof deps.sanitizePendingAction === "function" ? deps.sanitizePendingAction : (v) => v;
  const sanitizePendingTravel =
    typeof deps.sanitizePendingTravel === "function" ? deps.sanitizePendingTravel : (v) => v;
  const sanitizePendingAccess =
    typeof deps.sanitizePendingAccess === "function" ? deps.sanitizePendingAccess : (v) => v;
  const sanitizeRpRuntime =
    typeof deps.sanitizeRpRuntime === "function" ? deps.sanitizeRpRuntime : (v) => v || {};
  const sanitizeWorldLocation =
    typeof deps.sanitizeWorldLocation === "function" ? deps.sanitizeWorldLocation : (v) => v || {};
  const sanitizeTravelState =
    typeof deps.sanitizeTravelState === "function" ? deps.sanitizeTravelState : (v) => v || {};
  const sanitizeSessionPlaces =
    typeof deps.sanitizeSessionPlaces === "function" ? deps.sanitizeSessionPlaces : (v) => v || [];

  const PHASE5_STATS_MAX_SAMPLES = 24;
  const PHASE5_MUTATION_STATS = {
    turns: 0,
    mutatedTurns: 0,
    noMutationTurns: 0,
    byIntent: {},
    byMutationKind: {
      time: 0,
      position: 0,
      reputation: 0,
      tension: 0,
      narrativeFlags: 0
    },
    recent: []
  };

  function minutesForIntent(intentType) {
    if (intentType === "system_command") return 0;
    if (intentType === "lore_question") return 2;
    if (intentType === "free_exploration") return 12;
    if (intentType === "social_action") return 8;
    return 10;
  }

  function advanceWorldTime(currentTime, metadata) {
    const base = normalizeWorldTime(currentTime);
    const intentType = String(metadata?.intentType ?? "story_action");
    const delta = minutesForIntent(intentType);
    if (delta <= 0) return base;

    let totalMinutes = base.hour * 60 + base.minute + delta;
    let day = base.day;
    while (totalMinutes >= 24 * 60) {
      totalMinutes -= 24 * 60;
      day += 1;
    }
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return {
      day,
      hour,
      minute,
      label: worldTimeLabel(hour)
    };
  }

  function mapPhase5Intent({ intentType, transitionId, reason }) {
    const type = String(intentType ?? "story_action");
    const transition = String(transitionId ?? "none").toLowerCase();
    const why = String(reason ?? "").toLowerCase();

    if (type === "system_command") return "system";
    if (type === "social_action") return "social";
    if (type === "lore_question") return "observe";
    if (type === "free_exploration") return "investigate";
    if (transition.startsWith("travel.") || why.includes("travel") || why.includes("move")) return "move";
    if (why.includes("combat") || why.includes("guard-blocked") || why.includes("risk")) return "risk_action";
    return "risk_action";
  }

  function computeWorldDelta({ intent, outcome }) {
    const type = String(intent?.type ?? "story_action");
    if (type === "lore_question" || type === "free_exploration" || type === "system_command") {
      return {
        reputationDelta: 0,
        localTensionDelta: 0,
        reason: "no-impact-intent"
      };
    }

    const transitionId = outcome?.appliedOutcome?.result?.transitionId ?? "none";
    const guardBlocked = Boolean(outcome?.guardBlocked);

    if (guardBlocked) {
      return {
        reputationDelta: type === "social_action" ? -1 : 0,
        localTensionDelta: 1,
        reason: "guard-blocked"
      };
    }

    if (transitionId === "none") {
      return {
        reputationDelta: 0,
        localTensionDelta: 1,
        reason: "no-transition"
      };
    }

    if (type === "social_action") {
      return {
        reputationDelta: 1,
        localTensionDelta: 0,
        reason: "social-progress"
      };
    }

    return {
      reputationDelta: 0,
      localTensionDelta: 1,
      reason: "story-progress"
    };
  }

  function computeSceneOnlyDelta(intent) {
    const type = String(intent?.type ?? "story_action");
    const riskLevel = String(intent?.riskLevel ?? "");
    if (type === "story_action" && riskLevel === "high") {
      return { reputationDelta: 0, localTensionDelta: 2, reason: "scene-only-combat-pressure" };
    }
    return { reputationDelta: 0, localTensionDelta: 0, reason: "scene-only-no-runtime-trigger" };
  }

  function trackPhase5Mutation(safeBefore, nextState, delta, metadata) {
    const before = safeBefore && typeof safeBefore === "object" ? safeBefore : {};
    const after = nextState && typeof nextState === "object" ? nextState : {};
    const intentKind = mapPhase5Intent({
      intentType: metadata?.intentType,
      transitionId: metadata?.transitionId,
      reason: delta?.reason
    });

    const beforeTime = normalizeWorldTime(before?.time);
    const afterTime = normalizeWorldTime(after?.time);
    const beforeLocation = sanitizeWorldLocation(before?.location);
    const afterLocation = sanitizeWorldLocation(after?.location);
    const beforeConversation = before?.conversation && typeof before.conversation === "object" ? before.conversation : {};
    const afterConversation = after?.conversation && typeof after.conversation === "object" ? after.conversation : {};

    const changedTime =
      beforeTime.day !== afterTime.day ||
      beforeTime.hour !== afterTime.hour ||
      beforeTime.minute !== afterTime.minute;
    const changedPosition =
      String(beforeLocation?.id ?? "") !== String(afterLocation?.id ?? "") ||
      String(beforeLocation?.label ?? "") !== String(afterLocation?.label ?? "");
    const changedReputation =
      Number(before?.metrics?.reputation ?? 0) !== Number(after?.metrics?.reputation ?? 0);
    const changedTension =
      Number(before?.metrics?.localTension ?? 0) !== Number(after?.metrics?.localTension ?? 0);
    const changedNarrativeFlags =
      JSON.stringify({
        pendingAction: sanitizePendingAction(beforeConversation?.pendingAction),
        pendingTravel: sanitizePendingTravel(beforeConversation?.pendingTravel),
        pendingAccess: sanitizePendingAccess(beforeConversation?.pendingAccess)
      }) !==
      JSON.stringify({
        pendingAction: sanitizePendingAction(afterConversation?.pendingAction),
        pendingTravel: sanitizePendingTravel(afterConversation?.pendingTravel),
        pendingAccess: sanitizePendingAccess(afterConversation?.pendingAccess)
      });

    const changedAny =
      changedTime || changedPosition || changedReputation || changedTension || changedNarrativeFlags;

    PHASE5_MUTATION_STATS.turns += 1;
    PHASE5_MUTATION_STATS.byIntent[intentKind] =
      Number(PHASE5_MUTATION_STATS.byIntent[intentKind] ?? 0) + 1;
    if (changedAny) PHASE5_MUTATION_STATS.mutatedTurns += 1;
    else PHASE5_MUTATION_STATS.noMutationTurns += 1;
    if (changedTime) PHASE5_MUTATION_STATS.byMutationKind.time += 1;
    if (changedPosition) PHASE5_MUTATION_STATS.byMutationKind.position += 1;
    if (changedReputation) PHASE5_MUTATION_STATS.byMutationKind.reputation += 1;
    if (changedTension) PHASE5_MUTATION_STATS.byMutationKind.tension += 1;
    if (changedNarrativeFlags) PHASE5_MUTATION_STATS.byMutationKind.narrativeFlags += 1;

    PHASE5_MUTATION_STATS.recent.push({
      at: new Date().toISOString(),
      intentKind,
      intentType: String(metadata?.intentType ?? "unknown"),
      transitionId: String(metadata?.transitionId ?? "none"),
      reason: String(delta?.reason ?? "unspecified"),
      changedAny,
      changed: {
        time: changedTime,
        position: changedPosition,
        reputation: changedReputation,
        tension: changedTension,
        narrativeFlags: changedNarrativeFlags
      }
    });
    if (PHASE5_MUTATION_STATS.recent.length > PHASE5_STATS_MAX_SAMPLES) {
      PHASE5_MUTATION_STATS.recent.shift();
    }
  }

  function applyWorldDelta(worldState, delta, metadata) {
    const safe =
      worldState && typeof worldState === "object"
        ? worldState
        : createInitialNarrativeWorldState();

    const next = {
      ...safe,
      updatedAt: new Date().toISOString(),
      metrics: {
        reputation: clampNumber(
          Number(safe?.metrics?.reputation ?? 0) + Number(delta?.reputationDelta ?? 0),
          -100,
          100
        ),
        localTension: clampNumber(
          Number(safe?.metrics?.localTension ?? 0) + Number(delta?.localTensionDelta ?? 0),
          0,
          100
        )
      },
      startContext: {
        delivered: Boolean(safe?.startContext?.delivered),
        locationId: String(safe?.startContext?.locationId ?? "lysenthe.archives.parvis"),
        locationLabel: String(safe?.startContext?.locationLabel ?? "Parvis des Archives, Lysenthe"),
        city: String(safe?.startContext?.city ?? "Lysenthe"),
        territory: String(safe?.startContext?.territory ?? "Astryade"),
        region: String(safe?.startContext?.region ?? "Ylssea"),
        characterSnapshot:
          safe?.startContext?.characterSnapshot && typeof safe.startContext.characterSnapshot === "object"
            ? safe.startContext.characterSnapshot
            : null
      },
      conversation: {
        activeInterlocutor:
          safe?.conversation?.activeInterlocutor == null
            ? null
            : String(safe.conversation.activeInterlocutor),
        pendingAction: sanitizePendingAction(safe?.conversation?.pendingAction),
        pendingTravel: sanitizePendingTravel(safe?.conversation?.pendingTravel),
        pendingAccess: sanitizePendingAccess(safe?.conversation?.pendingAccess)
      },
      rpRuntime: sanitizeRpRuntime(safe?.rpRuntime),
      location: sanitizeWorldLocation(safe?.location),
      travel: sanitizeTravelState(safe?.travel),
      sessionPlaces: sanitizeSessionPlaces(safe?.sessionPlaces),
      time: advanceWorldTime(normalizeWorldTime(safe?.time), metadata),
      history: Array.isArray(safe?.history) ? [...safe.history] : []
    };

    next.history.push({
      at: next.updatedAt,
      reputationDelta: Number(delta?.reputationDelta ?? 0),
      localTensionDelta: Number(delta?.localTensionDelta ?? 0),
      reason: String(delta?.reason ?? "unspecified"),
      intentType: String(metadata?.intentType ?? "unknown"),
      transitionId: String(metadata?.transitionId ?? "none")
    });
    next.history = next.history.slice(-120);
    trackPhase5Mutation(safe, next, delta, metadata);
    return next;
  }

  function buildPhase5MutationStatsPayload() {
    const turns = Number(PHASE5_MUTATION_STATS.turns ?? 0);
    const mutatedTurns = Number(PHASE5_MUTATION_STATS.mutatedTurns ?? 0);
    const mutationRatePct = turns > 0 ? Number(((mutatedTurns / turns) * 100).toFixed(1)) : 0;
    return {
      turns,
      mutatedTurns,
      noMutationTurns: Number(PHASE5_MUTATION_STATS.noMutationTurns ?? 0),
      mutationRatePct,
      byIntent: { ...PHASE5_MUTATION_STATS.byIntent },
      byMutationKind: { ...PHASE5_MUTATION_STATS.byMutationKind },
      recent: PHASE5_MUTATION_STATS.recent.slice(-12)
    };
  }

  return {
    minutesForIntent,
    advanceWorldTime,
    mapPhase5Intent,
    computeWorldDelta,
    computeSceneOnlyDelta,
    applyWorldDelta,
    buildPhase5MutationStatsPayload
  };
}

module.exports = {
  createNarrationIntentMutationEngine
};
