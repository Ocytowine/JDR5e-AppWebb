"use strict";

function createNarrationPayloadPipeline(deps = {}) {
  const clampNumber = typeof deps.clampNumber === "function" ? deps.clampNumber : (v) => v;
  const oneLine = typeof deps.oneLine === "function" ? deps.oneLine : (v) => String(v ?? "");
  const normalizeMjOptions =
    typeof deps.normalizeMjOptions === "function" ? deps.normalizeMjOptions : () => [];
  const parseReplyToMjBlocks =
    typeof deps.parseReplyToMjBlocks === "function"
      ? deps.parseReplyToMjBlocks
      : () => ({ directAnswer: "", scene: "", actionResult: "", consequences: "", options: [] });
  const makeMjResponse =
    typeof deps.makeMjResponse === "function"
      ? deps.makeMjResponse
      : (value) => value;
  const buildCanonicalNarrativeContext =
    typeof deps.buildCanonicalNarrativeContext === "function"
      ? deps.buildCanonicalNarrativeContext
      : () => null;

  const PHASE3_GUARD_STATS_MAX_SAMPLES = 20;
  const PHASE3_GUARD_STATS = {
    checkedTurns: 0,
    blockedTurns: 0,
    byGate: {},
    byCode: {},
    recent: []
  };

  const MJ_CONTRACT_STATS_MAX_SAMPLES = 20;
  const MJ_CONTRACT_STATS = {
    total: 0,
    bySource: {},
    recent: [],
    narrativeTurns: 0,
    groundedTurns: 0,
    ungroundedTurns: 0,
    byIntent: {},
    recentGrounding: [],
    canonicalReads: 0,
    noCanonicalReads: 0,
    byIntentCanonicalReads: {},
    recentCanonical: []
  };
  const PHASE8_DEBUG_STATS = {
    totalPayloads: 0,
    withDebugChannel: 0,
    withoutDebugChannel: 0,
    byReason: {},
    recent: []
  };
  const PHASE4_AI_BUDGET_STATS = {
    turnsWithBudget: 0,
    overBudgetTurns: 0,
    blockedTurns: 0,
    totalUsed: 0,
    totalMax: 0,
    primaryUsed: 0,
    primaryMax: 0,
    fallbackUsed: 0,
    fallbackMax: 0,
    totalBlocked: 0,
    primaryBlocked: 0,
    fallbackBlocked: 0,
    recent: []
  };

  function normalizePhase3Gate(value) {
    const gate = String(value ?? "").trim().toLowerCase();
    return gate || "unknown";
  }

  function normalizePhase3Code(value) {
    const code = String(value ?? "").trim().toLowerCase();
    return code || "unknown";
  }

  function normalizeCommitment(value, fallback = "informatif") {
    const allowed = new Set(["declaratif", "volitif", "hypothetique", "informatif"]);
    const raw = String(value ?? "").trim().toLowerCase();
    if (allowed.has(raw)) return raw;
    return fallback;
  }

  function normalizePhase3Violations(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const gate = normalizePhase3Gate(entry.gate);
        const code = normalizePhase3Code(entry.code);
        const message = oneLine(String(entry.message ?? ""), 220);
        const severity =
          String(entry.severity ?? "major").trim().toLowerCase() === "minor" ? "minor" : "major";
        if (!gate || !code || !message) return null;
        return { gate, code, message, severity };
      })
      .filter(Boolean)
      .slice(0, 10);
  }

  function mergePhase3ViolationLists(primary, secondary) {
    const out = [];
    const seen = new Set();
    for (const row of [...normalizePhase3Violations(primary), ...normalizePhase3Violations(secondary)]) {
      const key = `${row.gate}:${row.code}:${row.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    return out.slice(0, 10);
  }

  function isNarrativePayloadForGuards(payload) {
    const intentType = String(payload?.mjContract?.intent?.type ?? payload?.intent?.type ?? "").trim();
    const responseType = String(
      payload?.mjContract?.mjResponse?.responseType ?? payload?.mjResponse?.responseType ?? ""
    ).trim();
    if (!intentType || intentType === "system_command") return false;
    if (responseType === "system" || responseType === "status") return false;
    return true;
  }

  function evaluatePhase3LoreGuardFromPayload(payload) {
    const worldState = payload?.worldState ?? null;
    const canonical = payload?.canonicalContext ?? null;
    const intentType = String(payload?.mjContract?.intent?.type ?? payload?.intent?.type ?? "").trim();
    const travelPendingToId = String(worldState?.travel?.pending?.to?.id ?? "").trim();
    const locationId = String(canonical?.location?.id ?? worldState?.location?.id ?? "").trim();
    const time = worldState?.time ?? canonical?.time ?? {};
    const hour = Number(time?.hour ?? NaN);
    const minute = Number(time?.minute ?? NaN);
    const day = Number(time?.day ?? NaN);
    const activeInterlocutor = String(canonical?.social?.activeInterlocutor ?? "").trim();

    const violations = [];
    if (!locationId) {
      violations.push({
        gate: "geographie",
        code: "missing-canonical-location",
        message: "Aucune position canonique exploitable n'est disponible.",
        severity: "major"
      });
    }
    if (
      !Number.isFinite(hour) ||
      hour < 0 ||
      hour > 23 ||
      !Number.isFinite(minute) ||
      minute < 0 ||
      minute > 59 ||
      !Number.isFinite(day) ||
      day < 1
    ) {
      violations.push({
        gate: "temps",
        code: "invalid-canonical-time",
        message: "Le temps canonique est invalide ou incomplet.",
        severity: "major"
      });
    }
    if (travelPendingToId && locationId && travelPendingToId === locationId) {
      violations.push({
        gate: "geographie",
        code: "travel-loop-same-location",
        message: "Un déplacement est en attente vers la position déjà active.",
        severity: "major"
      });
    }
    if (intentType === "social_action" && !activeInterlocutor) {
      violations.push({
        gate: "politique",
        code: "social-without-interlocutor",
        message: "Action sociale sans interlocuteur actif confirmé.",
        severity: "minor"
      });
    }

    const explicit = payload?.phase3LoreGuard;
    const merged = mergePhase3ViolationLists(violations, explicit?.violations);
    const blocked = Boolean(explicit?.blocked) || merged.some((row) => row.severity === "major");
    return {
      checked: isNarrativePayloadForGuards(payload),
      blocked,
      violations: merged
    };
  }

  function trackPhase3LoreGuard(check, payload) {
    if (!check?.checked) return;
    PHASE3_GUARD_STATS.checkedTurns += 1;
    if (check.blocked) PHASE3_GUARD_STATS.blockedTurns += 1;
    const intentType =
      String(payload?.mjContract?.intent?.type ?? payload?.intent?.type ?? "").trim() || "unknown";
    check.violations.forEach((row) => {
      const gate = normalizePhase3Gate(row.gate);
      const code = normalizePhase3Code(row.code);
      PHASE3_GUARD_STATS.byGate[gate] = Number(PHASE3_GUARD_STATS.byGate[gate] ?? 0) + 1;
      PHASE3_GUARD_STATS.byCode[code] = Number(PHASE3_GUARD_STATS.byCode[code] ?? 0) + 1;
    });
    PHASE3_GUARD_STATS.recent.push({
      at: new Date().toISOString(),
      intentType,
      blocked: Boolean(check.blocked),
      violations: check.violations.slice(0, 6).map((row) => `${row.gate}:${row.code}`)
    });
    if (PHASE3_GUARD_STATS.recent.length > PHASE3_GUARD_STATS_MAX_SAMPLES) {
      PHASE3_GUARD_STATS.recent.shift();
    }
  }

  function buildPhase3GuardStatsPayload() {
    const checkedTurns = Number(PHASE3_GUARD_STATS.checkedTurns ?? 0);
    const blockedTurns = Number(PHASE3_GUARD_STATS.blockedTurns ?? 0);
    const blockRatePct = checkedTurns > 0 ? Number(((blockedTurns / checkedTurns) * 100).toFixed(1)) : 0;
    return {
      checkedTurns,
      blockedTurns,
      passTurns: Math.max(0, checkedTurns - blockedTurns),
      blockRatePct,
      byGate: { ...PHASE3_GUARD_STATS.byGate },
      byCode: { ...PHASE3_GUARD_STATS.byCode },
      recent: PHASE3_GUARD_STATS.recent.slice(-10)
    };
  }

  function normalizeContractSourceLabel(value) {
    const source = String(value ?? "").trim();
    if (!source) return "unknown";
    return source;
  }

  function normalizeToolCallName(entry) {
    if (!entry || typeof entry !== "object") return "";
    return String(entry.name ?? entry.tool ?? entry.id ?? "").trim().toLowerCase();
  }

  function trackMjContractSource(source, payload) {
    const normalizedSource = normalizeContractSourceLabel(source);
    MJ_CONTRACT_STATS.total += 1;
    MJ_CONTRACT_STATS.bySource[normalizedSource] =
      Number(MJ_CONTRACT_STATS.bySource[normalizedSource] ?? 0) + 1;

    const sample = {
      at: new Date().toISOString(),
      source: normalizedSource,
      intentType: String(payload?.intent?.type ?? ""),
      directorMode: String(payload?.director?.mode ?? ""),
      responseType: String(payload?.mjResponse?.responseType ?? ""),
      hasReply: typeof payload?.reply === "string" && payload.reply.trim().length > 0
    };
    MJ_CONTRACT_STATS.recent.push(sample);
    if (MJ_CONTRACT_STATS.recent.length > MJ_CONTRACT_STATS_MAX_SAMPLES) {
      MJ_CONTRACT_STATS.recent.shift();
    }

    const intentType = String(payload?.mjContract?.intent?.type ?? payload?.intent?.type ?? "").trim();
    const responseType = String(
      payload?.mjContract?.mjResponse?.responseType ?? payload?.mjResponse?.responseType ?? ""
    ).trim();
    const isNarrativeTurn =
      Boolean(intentType) &&
      intentType !== "system_command" &&
      responseType !== "system" &&
      responseType !== "status";
    if (!isNarrativeTurn) return;

    MJ_CONTRACT_STATS.narrativeTurns += 1;
    MJ_CONTRACT_STATS.byIntent[intentType] = Number(MJ_CONTRACT_STATS.byIntent[intentType] ?? 0) + 1;

    const toolCalls = Array.isArray(payload?.mjContract?.toolCalls) ? payload.mjContract.toolCalls : [];
    const grounded = toolCalls.length > 0;
    if (grounded) MJ_CONTRACT_STATS.groundedTurns += 1;
    else MJ_CONTRACT_STATS.ungroundedTurns += 1;
    const hasCanonicalRead = toolCalls.some((entry) => normalizeToolCallName(entry) === "get_world_state");
    if (hasCanonicalRead) {
      MJ_CONTRACT_STATS.canonicalReads += 1;
      MJ_CONTRACT_STATS.byIntentCanonicalReads[intentType] =
        Number(MJ_CONTRACT_STATS.byIntentCanonicalReads[intentType] ?? 0) + 1;
    } else {
      MJ_CONTRACT_STATS.noCanonicalReads += 1;
    }

    MJ_CONTRACT_STATS.recentGrounding.push({
      at: new Date().toISOString(),
      intentType,
      responseType: responseType || "narration",
      grounded,
      toolCount: toolCalls.length
    });
    if (MJ_CONTRACT_STATS.recentGrounding.length > MJ_CONTRACT_STATS_MAX_SAMPLES) {
      MJ_CONTRACT_STATS.recentGrounding.shift();
    }
    MJ_CONTRACT_STATS.recentCanonical.push({
      at: new Date().toISOString(),
      intentType,
      responseType: responseType || "narration",
      hasCanonicalRead,
      toolCount: toolCalls.length
    });
    if (MJ_CONTRACT_STATS.recentCanonical.length > MJ_CONTRACT_STATS_MAX_SAMPLES) {
      MJ_CONTRACT_STATS.recentCanonical.shift();
    }
  }

  function buildMjContractStatsPayload() {
    const narrativeTurns = Number(MJ_CONTRACT_STATS.narrativeTurns ?? 0);
    const groundedTurns = Number(MJ_CONTRACT_STATS.groundedTurns ?? 0);
    const groundingRate = narrativeTurns > 0 ? Number(((groundedTurns / narrativeTurns) * 100).toFixed(1)) : 0;
    const canonicalReads = Number(MJ_CONTRACT_STATS.canonicalReads ?? 0);
    const canonicalReadRate =
      narrativeTurns > 0 ? Number(((canonicalReads / narrativeTurns) * 100).toFixed(1)) : 0;
    return {
      total: MJ_CONTRACT_STATS.total,
      bySource: { ...MJ_CONTRACT_STATS.bySource },
      recent: MJ_CONTRACT_STATS.recent.slice(-10),
      grounding: {
        narrativeTurns,
        groundedTurns,
        ungroundedTurns: Number(MJ_CONTRACT_STATS.ungroundedTurns ?? 0),
        groundingRatePct: groundingRate,
        byIntent: { ...MJ_CONTRACT_STATS.byIntent },
        recent: MJ_CONTRACT_STATS.recentGrounding.slice(-10)
      },
      phase2: {
        narrativeTurns,
        canonicalReads,
        noCanonicalReads: Number(MJ_CONTRACT_STATS.noCanonicalReads ?? 0),
        canonicalReadRatePct: canonicalReadRate,
        byIntentCanonicalReads: { ...MJ_CONTRACT_STATS.byIntentCanonicalReads },
        recentCanonical: MJ_CONTRACT_STATS.recentCanonical.slice(-10)
      }
    };
  }

  function normalizeAiCallBudgetStats(input) {
    const safe = input && typeof input === "object" ? input : {};
    return {
      used: Number(safe.used ?? 0),
      max: Number(safe.max ?? 0),
      primaryUsed: Number(safe.primaryUsed ?? 0),
      primaryMax: Number(safe.primaryMax ?? 0),
      fallbackUsed: Number(safe.fallbackUsed ?? 0),
      fallbackMax: Number(safe.fallbackMax ?? 0),
      blocked: Number(safe.blocked ?? 0),
      primaryBlocked: Number(safe.primaryBlocked ?? 0),
      fallbackBlocked: Number(safe.fallbackBlocked ?? 0),
      blockedLabels: Array.isArray(safe.blockedLabels)
        ? safe.blockedLabels.map((x) => String(x ?? "").trim()).filter(Boolean).slice(-8)
        : []
    };
  }

  function trackPhase4AiBudget(payload) {
    const raw = payload?.phase12?.aiCallBudget;
    if (!raw || typeof raw !== "object") return;
    const budget = normalizeAiCallBudgetStats(raw);
    PHASE4_AI_BUDGET_STATS.turnsWithBudget += 1;
    PHASE4_AI_BUDGET_STATS.totalUsed += budget.used;
    PHASE4_AI_BUDGET_STATS.totalMax += budget.max;
    PHASE4_AI_BUDGET_STATS.primaryUsed += budget.primaryUsed;
    PHASE4_AI_BUDGET_STATS.primaryMax += budget.primaryMax;
    PHASE4_AI_BUDGET_STATS.fallbackUsed += budget.fallbackUsed;
    PHASE4_AI_BUDGET_STATS.fallbackMax += budget.fallbackMax;
    PHASE4_AI_BUDGET_STATS.totalBlocked += budget.blocked;
    PHASE4_AI_BUDGET_STATS.primaryBlocked += budget.primaryBlocked;
    PHASE4_AI_BUDGET_STATS.fallbackBlocked += budget.fallbackBlocked;
    if (budget.used > budget.max) PHASE4_AI_BUDGET_STATS.overBudgetTurns += 1;
    if (budget.blocked > 0) PHASE4_AI_BUDGET_STATS.blockedTurns += 1;
    PHASE4_AI_BUDGET_STATS.recent.push({
      at: new Date().toISOString(),
      used: budget.used,
      max: budget.max,
      primaryUsed: budget.primaryUsed,
      primaryMax: budget.primaryMax,
      fallbackUsed: budget.fallbackUsed,
      fallbackMax: budget.fallbackMax,
      blocked: budget.blocked,
      blockedLabels: budget.blockedLabels
    });
    if (PHASE4_AI_BUDGET_STATS.recent.length > 20) PHASE4_AI_BUDGET_STATS.recent.shift();
  }

  function buildPhase4AiBudgetStatsPayload() {
    const turns = Number(PHASE4_AI_BUDGET_STATS.turnsWithBudget ?? 0);
    const blockedTurns = Number(PHASE4_AI_BUDGET_STATS.blockedTurns ?? 0);
    const overBudgetTurns = Number(PHASE4_AI_BUDGET_STATS.overBudgetTurns ?? 0);
    const blockedRatePct = turns > 0 ? Number(((blockedTurns / turns) * 100).toFixed(1)) : 0;
    const overBudgetRatePct = turns > 0 ? Number(((overBudgetTurns / turns) * 100).toFixed(1)) : 0;
    return {
      turnsWithBudget: turns,
      blockedTurns,
      overBudgetTurns,
      blockedRatePct,
      overBudgetRatePct,
      totalUsed: Number(PHASE4_AI_BUDGET_STATS.totalUsed ?? 0),
      totalMax: Number(PHASE4_AI_BUDGET_STATS.totalMax ?? 0),
      primaryUsed: Number(PHASE4_AI_BUDGET_STATS.primaryUsed ?? 0),
      primaryMax: Number(PHASE4_AI_BUDGET_STATS.primaryMax ?? 0),
      fallbackUsed: Number(PHASE4_AI_BUDGET_STATS.fallbackUsed ?? 0),
      fallbackMax: Number(PHASE4_AI_BUDGET_STATS.fallbackMax ?? 0),
      totalBlocked: Number(PHASE4_AI_BUDGET_STATS.totalBlocked ?? 0),
      primaryBlocked: Number(PHASE4_AI_BUDGET_STATS.primaryBlocked ?? 0),
      fallbackBlocked: Number(PHASE4_AI_BUDGET_STATS.fallbackBlocked ?? 0),
      recent: PHASE4_AI_BUDGET_STATS.recent.slice(-10)
    };
  }

  function normalizeMjContract(contract) {
    const safe = contract && typeof contract === "object" ? contract : {};
    const confidenceRaw = Number(safe?.confidence ?? 0.7);
    const confidence = Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw, 0, 1) : 0.7;
    const intent = safe?.intent && typeof safe.intent === "object" ? safe.intent : {};
    const mjResponse = safe?.mjResponse && typeof safe.mjResponse === "object" ? safe.mjResponse : {};
    const worldMutations =
      safe?.worldMutations && typeof safe.worldMutations === "object" ? safe.worldMutations : {};
    const loreGuardReport =
      safe?.loreGuardReport && typeof safe.loreGuardReport === "object" ? safe.loreGuardReport : {};
    const options = normalizeMjOptions(mjResponse.options, 6);
    return {
      schemaVersion: "1.0.0",
      version: "1.0.0",
      confidence,
      intent: {
        type: String(intent?.type ?? "story_action"),
        confidence: Number.isFinite(Number(intent?.confidence))
          ? clampNumber(Number(intent.confidence), 0, 1)
          : confidence,
        commitment: normalizeCommitment(intent?.commitment, "informatif"),
        riskLevel: String(intent?.riskLevel ?? "medium"),
        requiresCheck: Boolean(intent?.requiresCheck),
        reason: String(intent?.reason ?? "")
      },
      mjResponse: {
        responseType: String(mjResponse?.responseType ?? "narration"),
        directAnswer: String(mjResponse?.directAnswer ?? ""),
        scene: String(mjResponse?.scene ?? ""),
        actionResult: String(mjResponse?.actionResult ?? ""),
        consequences: String(mjResponse?.consequences ?? ""),
        options
      },
      toolCalls: Array.isArray(safe?.toolCalls) ? safe.toolCalls.slice(0, 24) : [],
      worldMutations: {
        delta: worldMutations?.delta ?? null,
        stateUpdated: Boolean(worldMutations?.stateUpdated),
        pending: worldMutations?.pending ?? null
      },
      loreGuardReport: {
        blocked: Boolean(loreGuardReport?.blocked),
        violations: Array.isArray(loreGuardReport?.violations)
          ? loreGuardReport.violations.map((x) => String(x ?? "")).filter(Boolean).slice(0, 8)
          : []
      }
    };
  }

  function inferResponseTypeFromPayload(data) {
    const safe = data && typeof data === "object" ? data : {};
    const mjStructuredType = String(safe?.mjStructured?.responseType ?? "").trim();
    if (mjStructuredType) return mjStructuredType;
    const mode = String(safe?.director?.mode ?? "");
    if (mode === "lore") return "status";
    if (mode === "runtime") return "resolution";
    if (mode === "scene_only" || mode === "exploration") return "narration";
    return "narration";
  }

  function extractMjResponseFromPayload(data) {
    const safe = data && typeof data === "object" ? data : {};
    if (safe?.mjResponse && typeof safe.mjResponse === "object") {
      return {
        source: "payload-mj-response",
        responseType: String(safe.mjResponse.responseType ?? inferResponseTypeFromPayload(safe)),
        directAnswer: String(safe.mjResponse.directAnswer ?? ""),
        scene: String(safe.mjResponse.scene ?? ""),
        actionResult: String(safe.mjResponse.actionResult ?? ""),
        consequences: String(safe.mjResponse.consequences ?? ""),
        options: normalizeMjOptions(safe.mjResponse.options, 6)
      };
    }
    if (safe?.mjStructured && typeof safe.mjStructured === "object") {
      return {
        source: "mj-structured",
        responseType: String(safe.mjStructured.responseType ?? "narration"),
        directAnswer: String(safe.mjStructured.directAnswer ?? ""),
        scene: String(safe.mjStructured.scene ?? ""),
        actionResult: String(safe.mjStructured.actionResult ?? ""),
        consequences: String(safe.mjStructured.consequences ?? ""),
        options: normalizeMjOptions(safe.mjStructured.options, 6)
      };
    }
    if (safe?.rpActionResolution && typeof safe.rpActionResolution === "object") {
      const row = safe.rpActionResolution;
      return {
        source: "rp-action-resolution",
        responseType: "resolution",
        directAnswer: "",
        scene: String(row.scene ?? ""),
        actionResult: String(row.actionResult ?? ""),
        consequences: String(row.consequences ?? ""),
        options: normalizeMjOptions(row.options, 6)
      };
    }
    if (safe?.rpActionValidation && typeof safe.rpActionValidation === "object") {
      const row = safe.rpActionValidation;
      return {
        source: "rp-action-validation",
        responseType: "clarification",
        directAnswer: "",
        scene: `Validation serveur: ${row.allowed ? "possible" : "bloquee"}.`,
        actionResult: String(row.reason ?? ""),
        consequences: "",
        options: []
      };
    }
    const parsed = parseReplyToMjBlocks(safe.reply);
    return {
      source: "parsed-reply",
      responseType: inferResponseTypeFromPayload(safe),
      directAnswer: parsed.directAnswer,
      scene: parsed.scene,
      actionResult: parsed.actionResult,
      consequences: parsed.consequences,
      options: parsed.options
    };
  }

  function attachMjContractToPayload(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return data;
    if (data.mjContract) {
      const payload = {
        ...data,
        mjContract: normalizeMjContract(data.mjContract)
      };
      trackMjContractSource(payload?.mjContract?.contractSource, payload);
      return payload;
    }
    if (typeof data.reply !== "string") return data;
    const hasNarrationSignals =
      data.intent || data.director || data.worldState || data.worldDelta || data.mjStructured || data.mjResponse;
    if (!hasNarrationSignals) return data;

    const responseParts = extractMjResponseFromPayload(data);
    const pending = {
      action: data?.worldState?.conversation?.pendingAction ?? null,
      travel: data?.worldState?.travel?.pending ?? data?.worldState?.conversation?.pendingTravel ?? null,
      access: data?.worldState?.conversation?.pendingAccess ?? null
    };
    const hrpToolTrace = Array.isArray(data?.hrpAnalysis?.toolTrace) ? data.hrpAnalysis.toolTrace : [];
    const mjToolTrace = Array.isArray(data?.mjToolTrace) ? data.mjToolTrace : [];
    const toolCalls = [...hrpToolTrace, ...mjToolTrace].slice(0, 24);
    const inferredCommitment = normalizeCommitment(
      data?.intent?.commitment,
      normalizeCommitment(data?.mjStructured?.commitment, "informatif")
    );
    const contract = normalizeMjContract({
      confidence: Number(data?.intent?.confidence ?? data?.mjStructured?.confidence ?? 0.7),
      intent: {
        ...(data?.intent ?? {}),
        commitment: inferredCommitment
      },
      mjResponse: {
        responseType: responseParts.responseType,
        directAnswer: responseParts.directAnswer,
        scene: responseParts.scene,
        actionResult: responseParts.actionResult,
        consequences: responseParts.consequences,
        options: responseParts.options
      },
      toolCalls,
      worldMutations: {
        delta: data?.worldDelta ?? null,
        stateUpdated: Boolean(data?.stateUpdated),
        pending
      },
      loreGuardReport: {
        blocked: Boolean(data?.outcome?.appliedOutcome?.guardBlocked),
        violations: Array.isArray(data?.outcome?.appliedOutcome?.guardViolations)
          ? data.outcome.appliedOutcome.guardViolations
          : []
      }
    });
    const payload = {
      ...data,
      intent:
        data?.intent && typeof data.intent === "object"
          ? { ...data.intent, commitment: inferredCommitment }
          : data?.intent,
      mjResponse: contract.mjResponse,
      mjContract: {
        ...contract,
        contractSource: responseParts.source
      }
    };
    trackMjContractSource(payload?.mjContract?.contractSource, payload);
    return payload;
  }

  function attachCanonicalNarrativeContext(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return data;
    if (data.canonicalContext) return data;
    if (!data.worldState || typeof data.worldState !== "object") return data;
    return {
      ...data,
      canonicalContext: buildCanonicalNarrativeContext({
        worldState: data.worldState,
        contextPack: data.contextPack ?? null,
        characterProfile: data.characterProfile ?? null
      })
    };
  }

  function applyPhase3LoreGuards(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    const check = evaluatePhase3LoreGuardFromPayload(payload);
    trackPhase3LoreGuard(check, payload);
    if (!check.checked) return payload;

    const violationsText = check.violations.map((row) => `${row.gate}:${row.code}`).slice(0, 6);
    const nextContract =
      payload?.mjContract && typeof payload.mjContract === "object"
        ? {
            ...payload.mjContract,
            loreGuardReport: {
              blocked: Boolean(check.blocked),
              violations: violationsText
            }
          }
        : payload?.mjContract;

    if (!check.blocked) {
      return {
        ...payload,
        mjContract: nextContract
      };
    }

    const guardReply = [
      "Le MJ bloque cette avancée pour préserver la cohérence du monde.",
      "Précise un lieu/faction/repère canonique déjà établi pour continuer."
    ].join("\n");

    return {
      ...payload,
      reply: guardReply,
      mjResponse: makeMjResponse({
        responseType: "clarification",
        scene: "Un verrou de cohérence lore stoppe cette formulation.",
        actionResult:
          "Ta demande n'est pas rejetée; elle doit être reformulée avec un ancrage canonique.",
        consequences: "Aucune mutation du monde n'est appliquée.",
        options: [
          "Nommer un lieu déjà connu",
          "Demander où tu te trouves",
          "Reformuler l'action sans ambiguïté"
        ]
      }),
      mjContract: nextContract
    };
  }

  function isDebugSystemCommand(payload) {
    const intentType = String(payload?.intent?.type ?? payload?.mjContract?.intent?.type ?? "").trim();
    const reason = String(payload?.intent?.reason ?? payload?.mjContract?.intent?.reason ?? "").toLowerCase();
    if (intentType !== "system_command") return false;
    return reason.includes("debug");
  }

  function buildDebugChannelPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const debug = {};
    const push = (key, value) => {
      if (value === undefined) return;
      if (value === null) return;
      debug[key] = value;
    };
    push("intent", payload.intent);
    push("director", payload.director);
    push("worldDelta", payload.worldDelta);
    push("worldState", payload.worldState);
    push("outcome", payload.outcome);
    push("canonicalContext", payload.canonicalContext);
    push("mjContract", payload.mjContract);
    push("mjStructured", payload.mjStructured);
    push("mjToolTrace", payload.mjToolTrace);
    push("hrpAnalysis", payload.hrpAnalysis);
    push("contractStats", payload.contractStats);
    push("phase1", payload.phase1);
    push("phase2", payload.phase2);
    push("phase3", payload.phase3);
    push("phase4", payload.phase4);
    push("phase5", payload.phase5);
    push("phase6", payload.phase6);
    push("phase7", payload.phase7);
    push("phase8", payload.phase8);
    push("phase12", payload.phase12);
    push("phase3LoreGuard", payload.phase3LoreGuard);
    push("loreRecordsUsed", payload.loreRecordsUsed);
    push("rpActionValidation", payload.rpActionValidation);
    push("rpActionResolution", payload.rpActionResolution);
    return Object.keys(debug).length > 0 ? debug : null;
  }

  function stripTopLevelDebugFields(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    const {
      intent,
      director,
      worldDelta,
      worldState,
      outcome,
      canonicalContext,
      mjContract,
      mjStructured,
      mjToolTrace,
      hrpAnalysis,
      contractStats,
      phase1,
      phase2,
      phase3,
      phase4,
      phase5,
      phase6,
      phase7,
      phase8,
      phase12,
      phase3LoreGuard,
      loreRecordsUsed,
      rpActionValidation,
      rpActionResolution,
      ...rest
    } = payload;
    return rest;
  }

  function trackPhase8DebugChannel(hasDebug, reason) {
    PHASE8_DEBUG_STATS.totalPayloads += 1;
    if (hasDebug) PHASE8_DEBUG_STATS.withDebugChannel += 1;
    else PHASE8_DEBUG_STATS.withoutDebugChannel += 1;
    const key = String(reason ?? "unknown");
    PHASE8_DEBUG_STATS.byReason[key] = Number(PHASE8_DEBUG_STATS.byReason[key] ?? 0) + 1;
    PHASE8_DEBUG_STATS.recent.push({
      at: new Date().toISOString(),
      hasDebug: Boolean(hasDebug),
      reason: key
    });
    if (PHASE8_DEBUG_STATS.recent.length > 20) PHASE8_DEBUG_STATS.recent.shift();
  }

  function buildPhase8DebugChannelStatsPayload() {
    const total = Number(PHASE8_DEBUG_STATS.totalPayloads ?? 0);
    const withDebug = Number(PHASE8_DEBUG_STATS.withDebugChannel ?? 0);
    const coveragePct = total > 0 ? Number(((withDebug / total) * 100).toFixed(1)) : 0;
    return {
      totalPayloads: total,
      withDebugChannel: withDebug,
      withoutDebugChannel: Number(PHASE8_DEBUG_STATS.withoutDebugChannel ?? 0),
      debugCoveragePct: coveragePct,
      byReason: { ...PHASE8_DEBUG_STATS.byReason },
      recent: PHASE8_DEBUG_STATS.recent.slice(-10)
    };
  }

  function separateDebugChannel(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
    const debugData = buildDebugChannelPayload(payload);
    const debugCommand = isDebugSystemCommand(payload);
    const shouldAttachDebug = debugCommand || Boolean(debugData && payload?.reply && payload?.speaker);
    const clean = stripTopLevelDebugFields(payload);
    if (!shouldAttachDebug || !debugData) {
      trackPhase8DebugChannel(false, debugCommand ? "debug-command-no-data" : "rp-clean");
      return clean;
    }
    trackPhase8DebugChannel(true, debugCommand ? "debug-command" : "narration-with-debug-channel");
    return {
      ...clean,
      debug: debugData
    };
  }

  function sendJson(res, statusCode, data) {
    const withContracts = attachMjContractToPayload(data);
    const withCanonical = attachCanonicalNarrativeContext(withContracts);
    const withGuards = applyPhase3LoreGuards(withCanonical);
    trackPhase4AiBudget(withGuards);
    const payload = separateDebugChannel(withGuards);
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    res.end(body);
    return true;
  }

  return {
    sendJson,
    buildMjContractStatsPayload,
    buildPhase3GuardStatsPayload,
    buildPhase4AiBudgetStatsPayload,
    buildPhase8DebugChannelStatsPayload
  };
}

module.exports = {
  createNarrationPayloadPipeline
};
