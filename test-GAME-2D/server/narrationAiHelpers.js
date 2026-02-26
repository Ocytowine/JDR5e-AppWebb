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

  function stageDirective(stage) {
    const key = String(stage ?? "scene").trim().toLowerCase();
    if (key === "travel_proposal") {
      return (
        "Etape narrative: proposition de deplacement (non confirmee). " +
        "Tu peux decrire l'intention, l'ambiance et ce qui attend potentiellement le joueur, " +
        "mais tu ne dois pas presenter le deplacement comme deja accompli."
      );
    }
    if (key === "travel_confirmed") {
      return (
        "Etape narrative: deplacement confirme. " +
        "Tu peux decrire l'arrivee, le nouveau lieu et ses details immediats de scene."
      );
    }
    return "Etape narrative: scene locale en cours.";
  }

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
    const requiresCheck = Boolean(intent?.requiresCheck);
    const riskLevel = String(intent?.riskLevel ?? "medium");
    if (requiresCheck) return true;
    if (riskLevel === "high" || riskLevel === "medium") return true;
    return true;
  }

  function sanitizeWorldIntentHint(candidate) {
    const allowed = new Set(["none", "propose_travel", "confirm_travel", "access_attempt", "runtime_progress"]);
    const typeRaw = String(candidate?.type ?? candidate?.worldIntentType ?? "none").trim();
    const targetLabel = String(candidate?.targetLabel ?? "").trim();
    const reason = String(candidate?.reason ?? "ai-world-intent").trim();
    const confidenceRaw = Number(candidate?.confidence ?? 0.68);
    return {
      type: allowed.has(typeRaw) ? typeRaw : "none",
      targetLabel,
      reason,
      confidence: Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw, 0, 1) : 0.68
    };
  }

  function sanitizeSceneArbitration(candidate) {
    const allowed = new Set(["stay_and_scan", "move_to_place", "social_focus", "unclear"]);
    const modeRaw = String(candidate?.mode ?? candidate?.decision ?? "unclear").trim();
    const targetLabel = String(candidate?.targetLabel ?? "").trim();
    const confidenceRaw = Number(candidate?.confidence ?? 0.64);
    const reason = String(candidate?.reason ?? "scene-arbitration").trim();
    return {
      mode: allowed.has(modeRaw) ? modeRaw : "unclear",
      targetLabel,
      confidence: Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw, 0, 1) : 0.64,
      reason
    };
  }

  function sanitizeLocalMemoryCandidates(candidate) {
    const safe = candidate && typeof candidate === "object" ? candidate : {};
    const places = Array.isArray(safe.places) ? safe.places : [];
    const npcs = Array.isArray(safe.npcs) ? safe.npcs : [];
    const facts = Array.isArray(safe.facts) ? safe.facts : [];
    const toText = (v) => String(v ?? "").trim();
    const toTags = (v) =>
      Array.isArray(v)
        ? v.map((x) => toText(x)).filter(Boolean).slice(0, 8)
        : [];
    const toConfidence = (v, fallback = 0.62) => {
      const n = Number(v);
      return Number.isFinite(n) ? clampNumber(n, 0, 1) : fallback;
    };
    const toTtl = (v, fallback = 5) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(1, Math.min(30, Math.floor(n)));
    };
    return {
      places: places
        .map((row) => ({
          label: toText(row?.label ?? row?.name),
          summary: toText(row?.summary ?? row?.text),
          tags: toTags(row?.tags),
          visibility: toText(row?.visibility || "visible"),
          confidence: toConfidence(row?.confidence, 0.64),
          ttlDays: toTtl(row?.ttlDays, 7)
        }))
        .filter((row) => row.label),
      npcs: npcs
        .map((row) => ({
          name: toText(row?.name ?? row?.label),
          role: toText(row?.role),
          traits: toTags(row?.traits),
          voiceHints: toTags(row?.voiceHints),
          confidence: toConfidence(row?.confidence, 0.6),
          ttlDays: toTtl(row?.ttlDays, 5)
        }))
        .filter((row) => row.name),
      facts: facts
        .map((row) => ({
          subject: toText(row?.subject ?? row?.subjectId),
          statement: toText(row?.statement ?? row?.text),
          evidence: toTags(row?.evidence),
          confidence: toConfidence(row?.confidence, 0.58),
          ttlDays: toTtl(row?.ttlDays, 3)
        }))
        .filter((row) => row.statement)
    };
  }

  function sanitizeSpatialTargetResolution(candidate) {
    const allowed = new Set(["local_poi", "current_location", "external_place", "unclear"]);
    const relationRaw = String(candidate?.relation ?? candidate?.mode ?? "unclear").trim();
    const targetLabel = String(candidate?.targetLabel ?? "").trim();
    const reason = String(candidate?.reason ?? "spatial-resolution").trim();
    const confidenceRaw = Number(candidate?.confidence ?? 0.66);
    return {
      relation: allowed.has(relationRaw) ? relationRaw : "unclear",
      targetLabel,
      reason,
      confidence: Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw, 0, 1) : 0.66
    };
  }

  function sanitizePendingGateDecision(candidate) {
    const allowed = new Set(["confirm_pending", "cancel_pending", "defer_pending", "unclear"]);
    const actionRaw = String(candidate?.action ?? candidate?.decision ?? "unclear").trim();
    const reason = String(candidate?.reason ?? "pending-gate").trim();
    const confidenceRaw = Number(candidate?.confidence ?? 0.66);
    return {
      action: allowed.has(actionRaw) ? actionRaw : "unclear",
      reason,
      confidence: Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw, 0, 1) : 0.66
    };
  }

  function sanitizeRuntimeEligibility(candidate) {
    const eligibleRaw = candidate?.eligible;
    const eligible = typeof eligibleRaw === "boolean" ? eligibleRaw : true;
    const reason = String(candidate?.reason ?? "runtime-eligibility").trim();
    const confidenceRaw = Number(candidate?.confidence ?? 0.62);
    const suggestedMode = String(candidate?.suggestedMode ?? "").trim();
    return {
      eligible,
      reason,
      confidence: Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw, 0, 1) : 0.62,
      suggestedMode
    };
  }

  function sanitizeSceneFramePatch(candidate) {
    const safe = candidate && typeof candidate === "object" ? candidate : {};
    const toText = (v) => String(v ?? "").trim();
    const recentFacts = Array.isArray(safe.recentFacts)
      ? safe.recentFacts.map((x) => toText(x)).filter(Boolean).slice(0, 4)
      : [];
    const confidenceRaw = Number(safe.confidence ?? 0.64);
    return {
      activePoiLabel: toText(safe.activePoiLabel ?? safe.poiLabel),
      activeInterlocutorLabel: toText(
        safe.activeInterlocutorLabel ?? safe.interlocutorLabel ?? safe.activeSpeaker
      ),
      activeTopic: toText(safe.activeTopic ?? safe.topic),
      recentFacts,
      confidence: Number.isFinite(confidenceRaw) ? clampNumber(confidenceRaw, 0, 1) : 0.64,
      reason: toText(safe.reason ?? "scene-frame-patch")
    };
  }

  function sanitizeSceneContinuityValidation(candidate) {
    const safe = candidate && typeof candidate === "object" ? candidate : {};
    return {
      valid: safe?.valid === false ? false : true,
      reason: String(safe?.reason ?? "scene-frame-continuity").trim(),
      severity: String(safe?.severity ?? "medium").trim()
    };
  }

  function sanitizeNpcMicroProfile(candidate) {
    const safe = candidate && typeof candidate === "object" ? candidate : {};
    const toText = (v) => String(v ?? "").trim();
    const toList = (v, limit = 8) =>
      Array.isArray(v)
        ? v.map((x) => toText(x)).filter(Boolean).slice(0, limit)
        : [];
    const toAbility = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return 10;
      return Math.max(3, Math.min(20, Math.round(n)));
    };
    const statsRaw = safe.dndStats && typeof safe.dndStats === "object" ? safe.dndStats : {};
    const skills = toList(safe.skills, 10);
    return {
      name: toText(safe.name),
      species: toText(safe.species),
      ageBand: toText(safe.ageBand),
      physicalTraits: toList(safe.physicalTraits, 6),
      qualities: toList(safe.qualities, 6),
      flaws: toList(safe.flaws, 6),
      dndStats: {
        STR: toAbility(statsRaw.STR),
        DEX: toAbility(statsRaw.DEX),
        CON: toAbility(statsRaw.CON),
        INT: toAbility(statsRaw.INT),
        WIS: toAbility(statsRaw.WIS),
        CHA: toAbility(statsRaw.CHA)
      },
      skills,
      voiceStyle: toText(safe.voiceStyle),
      confidence: Number.isFinite(Number(safe.confidence))
        ? clampNumber(Number(safe.confidence), 0, 1)
        : 0.62
    };
  }

  function sanitizePoiMicroProfile(candidate) {
    const safe = candidate && typeof candidate === "object" ? candidate : {};
    const toText = (v) => String(v ?? "").trim();
    const toList = (v, limit = 8) =>
      Array.isArray(v)
        ? v.map((x) => toText(x)).filter(Boolean).slice(0, limit)
        : [];
    return {
      label: toText(safe.label ?? safe.name),
      type: toText(safe.type),
      atmosphere: toText(safe.atmosphere),
      offerKinds: toList(safe.offerKinds, 8),
      ownerName: toText(safe.ownerName),
      tags: toList(safe.tags, 8),
      confidence: Number.isFinite(Number(safe.confidence))
        ? clampNumber(Number(safe.confidence), 0, 1)
        : 0.6
    };
  }

  function sanitizeEntityMicroProfiles(candidate) {
    const safe = candidate && typeof candidate === "object" ? candidate : {};
    const npcs = Array.isArray(safe.npcs) ? safe.npcs : [];
    const pois = Array.isArray(safe.pois) ? safe.pois : [];
    return {
      npcs: npcs
        .map((x) => sanitizeNpcMicroProfile(x))
        .filter((row) => row.name)
        .slice(0, 6),
      pois: pois
        .map((x) => sanitizePoiMicroProfile(x))
        .filter((row) => row.label)
        .slice(0, 8)
    };
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
    canonicalContext,
    contextPack,
    activeInterlocutor,
    conversationMode,
    pending,
    narrativeStage
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
        "Si un interlocuteur est actif et que la scene est sociale, rends le PNJ vivant: une attitude concrete et, au besoin, une courte replique plausible. " +
        "N'ecris jamais le raisonnement interne du MJ ni des formulations meta (ex: 'rien n'impose', 'sans forcer la scene', 'indices exploitables'). " +
        `${stageDirective(narrativeStage)} ` +
        "N'introduis pas de revelation majeure (rune cachee, secret ancien, quete implicite, destin exceptionnel) sans evidence explicite du lore/outils. " +
        "Pour une exploration libre, privilegie des observations plausibles et locales avant toute escalation. " +
        "Adresse le joueur en tutoiement (tu), pas en vouvoiement (vous). " +
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
        canonicalContext: canonicalContext ?? null,
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

  async function detectWorldIntentWithAI({ message, worldState, records, conversationMode }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu es un detecteur d'intention monde pour un JDR. " +
        "Retourne UNIQUEMENT un JSON valide avec: type, targetLabel, reason, confidence. " +
        "type ∈ {none, propose_travel, confirm_travel, access_attempt, runtime_progress}. " +
        "Regle critique: detecte l'intention de deplacement de maniere semantique, meme sans mot-cle explicite. " +
        "Exemples de deplacement declaratif: 'je marche vers...', 'je file en direction de...', 'je m'avance vers...' => propose_travel. " +
        "N'invente pas de destination absente: targetLabel peut etre vide si inconnu.";
      const userPayload = {
        playerMessage: String(message ?? ""),
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null,
          travel: worldState?.travel ?? null,
          pendingTravel: worldState?.conversation?.pendingTravel ?? null
        },
        loreHints: Array.isArray(records)
          ? records.slice(0, 6).map((row) => ({ title: row?.title, type: row?.type }))
          : []
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeWorldIntentHint(parsed);
    } catch (err) {
      warn("[world-intent-ai] fallback none:", err?.message ?? err);
      return null;
    }
  }

  async function arbitrateSceneIntentWithAI({
    message,
    worldState,
    records,
    conversationMode,
    worldIntentHint
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu arbitres l'intention scene d'un joueur de JDR. " +
        "Retourne UNIQUEMENT un JSON valide avec: mode, targetLabel, confidence, reason. " +
        "mode ∈ {stay_and_scan, move_to_place, social_focus, unclear}. " +
        "Interpretation semantique stricte: " +
        "stay_and_scan = observer/chercher/interagir dans la zone actuelle; " +
        "move_to_place = intention de changer de lieu; " +
        "social_focus = priorite au dialogue/negociation locale. " +
        "N'invente pas une destination; targetLabel peut rester vide si incertain.";
      const userPayload = {
        playerMessage: String(message ?? ""),
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null,
          pendingTravel: worldState?.conversation?.pendingTravel ?? null
        },
        worldIntentHint: worldIntentHint ?? null,
        loreHints: Array.isArray(records)
          ? records.slice(0, 6).map((row) => ({ title: row?.title, type: row?.type }))
          : []
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeSceneArbitration(parsed);
    } catch (err) {
      warn("[scene-arbitration-ai] fallback null:", err?.message ?? err);
      return null;
    }
  }

  async function validateNarrativeStateConsistency({
    narrativeStage,
    text,
    stateUpdatedExpected,
    worldBefore,
    worldAfter,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return { valid: true, reason: "ai-disabled" };
    if (String(conversationMode ?? "rp") !== "rp") return { valid: true, reason: "non-rp" };
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu valides la coherence entre narration RP et etat serveur. " +
        "Retourne UNIQUEMENT un JSON valide: {valid:boolean, reason:string, severity:string}. " +
        "severity ∈ {low, medium, high}. " +
        "Regle critique: en etape de proposition de deplacement, la narration ne doit pas presenter le deplacement comme deja accompli.";
      const userPayload = {
        narrativeStage: String(narrativeStage ?? "scene"),
        stateUpdatedExpected: Boolean(stateUpdatedExpected),
        text: String(text ?? ""),
        worldBefore: worldBefore ?? null,
        worldAfter: worldAfter ?? null
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return {
        valid: parsed?.valid === false ? false : true,
        reason: String(parsed?.reason ?? "consistency-check"),
        severity: String(parsed?.severity ?? "medium")
      };
    } catch (err) {
      warn("[narrative-consistency-ai] fallback valid:", err?.message ?? err);
      return { valid: true, reason: "validator-fallback" };
    }
  }

  async function extractLocalMemoryCandidatesWithAI({
    reply,
    worldState,
    records,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    const text = String(reply ?? "").trim();
    if (!text) return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu extrais une memoire locale reutilisable pour une partie de JDR. " +
        "Retourne UNIQUEMENT un JSON valide avec les tableaux: places, npcs, facts. " +
        "Chaque element doit contenir des infos concises, utiles en RP, avec confidence (0..1) et ttlDays. " +
        "N'invente pas d'elements majeurs absents du texte. " +
        "Favorise la coherence locale (lieu courant, details concrets, acteurs presents).";
      const userPayload = {
        reply: text,
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null
        },
        loreHints: Array.isArray(records)
          ? records.slice(0, 4).map((r) => ({ title: r?.title, type: r?.type }))
          : []
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeLocalMemoryCandidates(parsed);
    } catch (err) {
      warn("[local-memory-ai] fallback null:", err?.message ?? err);
      return null;
    }
  }

  async function resolveSpatialTargetWithAI({
    message,
    targetLabel,
    worldState,
    sceneMemoryRows,
    records,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu resols la relation spatiale d'une cible narrative dans un JDR. " +
        "Retourne UNIQUEMENT un JSON valide avec: relation, targetLabel, confidence, reason. " +
        "relation ∈ {local_poi, current_location, external_place, unclear}. " +
        "Semantique attendue: " +
        "local_poi = sous-lieu/point d'interet a l'interieur de la zone actuelle, " +
        "current_location = le joueur parle du lieu ou il se trouve deja, " +
        "external_place = lieu distinct qui implique un changement de zone. " +
        "Base-toi sur le contexte monde + memoire locale + indices lore. N'invente pas.";
      const userPayload = {
        playerMessage: String(message ?? ""),
        targetLabel: String(targetLabel ?? ""),
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null
        },
        sceneMemory: Array.isArray(sceneMemoryRows)
          ? sceneMemoryRows.slice(0, 10).map((row) => ({
              entity: row?.entity,
              label: row?.label,
              text: row?.text,
              tags: row?.tags,
              data: row?.data
            }))
          : [],
        loreHints: Array.isArray(records)
          ? records.slice(0, 6).map((r) => ({ title: r?.title, type: r?.type, summary: r?.summary }))
          : []
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeSpatialTargetResolution(parsed);
    } catch (err) {
      warn("[spatial-target-ai] fallback null:", err?.message ?? err);
      return null;
    }
  }

  async function arbitratePendingTravelWithAI({
    message,
    worldState,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    const pendingTravel = worldState?.travel?.pending ?? worldState?.conversation?.pendingTravel ?? null;
    if (!pendingTravel) return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu arbitres l'intention d'un joueur quand un deplacement est deja en attente. " +
        "Retourne UNIQUEMENT un JSON valide avec: action, confidence, reason. " +
        "action ∈ {confirm_pending, cancel_pending, defer_pending, unclear}. " +
        "confirm_pending = le joueur confirme partir maintenant; " +
        "cancel_pending = le joueur annule/renonce/retourne en arriere; " +
        "defer_pending = il parle d'autre chose sans confirmer ni annuler.";
      const userPayload = {
        playerMessage: String(message ?? ""),
        pendingTravel,
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null
        }
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizePendingGateDecision(parsed);
    } catch (err) {
      warn("[pending-travel-ai] fallback null:", err?.message ?? err);
      return null;
    }
  }

  async function assessRuntimeEligibilityWithAI({
    message,
    intent,
    directorPlan,
    worldState,
    records,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu determines si une progression runtime est pertinente maintenant dans un JDR. " +
        "Retourne UNIQUEMENT un JSON valide avec: eligible, confidence, reason, suggestedMode. " +
        "eligible=true seulement si la phrase demande une progression d'etat (quete/trama/negociation/evenement) plausible. " +
        "Si c'est une action locale de scene, un deplacement simple, une observation ou une clarification, retourne eligible=false.";
      const userPayload = {
        playerMessage: String(message ?? ""),
        intent: intent ?? null,
        director: directorPlan ?? null,
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null,
          pendingTravel: worldState?.travel?.pending ?? worldState?.conversation?.pendingTravel ?? null,
          pendingAccess: worldState?.conversation?.pendingAccess ?? null
        },
        loreHints: Array.isArray(records)
          ? records.slice(0, 4).map((r) => ({ title: r?.title, type: r?.type }))
          : []
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeRuntimeEligibility(parsed);
    } catch (err) {
      warn("[runtime-eligibility-ai] fallback null:", err?.message ?? err);
      return null;
    }
  }

  async function resolveSceneFramePatchWithAI({
    message,
    worldState,
    sceneFrame,
    records,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu proposes une mise a jour minimale du frame de scene d'un JDR. " +
        "Retourne UNIQUEMENT un JSON valide avec: activePoiLabel, activeInterlocutorLabel, activeTopic, recentFacts, confidence, reason. " +
        "Ne change pas le frame sans besoin. Favorise la continuite entre le tour precedent et le message joueur.";
      const userPayload = {
        playerMessage: String(message ?? ""),
        currentFrame: sceneFrame ?? null,
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null
        },
        loreHints: Array.isArray(records)
          ? records.slice(0, 5).map((r) => ({ title: r?.title, type: r?.type }))
          : []
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeSceneFramePatch(parsed);
    } catch (err) {
      warn("[scene-frame-patch-ai] fallback null:", err?.message ?? err);
      return null;
    }
  }

  async function generateEntityMicroProfilesWithAI({
    reply,
    worldState,
    sceneFrame,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    const text = String(reply ?? "").trim();
    if (!text) return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu derives des micro-profils d'entites pour un JDR a partir d'une scene RP. " +
        "Retourne UNIQUEMENT un JSON valide avec: npcs, pois. " +
        "npcs[]: {name,species,ageBand,physicalTraits,qualities,flaws,dndStats,skills,voiceStyle,confidence}. " +
        "pois[]: {label,type,atmosphere,offerKinds,ownerName,tags,confidence}. " +
        "Contraintes: rester local, plausible, sans revelation majeure ni destin exceptionnel. " +
        "Si une info est inconnue, rester sobre (ne pas sur-inventer).";
      const userPayload = {
        reply: text,
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null
        },
        sceneFrame: sceneFrame ?? null
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeEntityMicroProfiles(parsed);
    } catch (err) {
      warn("[entity-micro-profiles-ai] fallback null:", err?.message ?? err);
      return null;
    }
  }

  async function summarizeConversationWindowWithAI({
    windowKey,
    turns,
    worldState,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return null;
    if (String(conversationMode ?? "rp") !== "rp") return null;
    const rows = Array.isArray(turns) ? turns : [];
    if (!rows.length) return null;
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu compacts un fil RP pour memoire long terme JDR. " +
        "Retourne UNIQUEMENT un JSON valide avec: summary, keyFacts, openThreads, confidence. " +
        "summary: 3-6 phrases factuelles, sans style meta. " +
        "keyFacts/openThreads: listes courtes d'ancrages utiles. " +
        "Ne reinvente pas, ne cree pas de quete non demandee.";
      const userPayload = {
        windowKey: String(windowKey ?? ""),
        turns: rows.slice(-80).map((row) => ({
          at: String(row?.at ?? ""),
          user: String(row?.user ?? ""),
          mj: String(row?.mj ?? ""),
          locationLabel: String(row?.locationLabel ?? ""),
          intentType: String(row?.intentType ?? "")
        })),
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null
        }
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      const summary = String(parsed?.summary ?? "").trim();
      if (!summary) return null;
      const keyFacts = Array.isArray(parsed?.keyFacts)
        ? parsed.keyFacts.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 8)
        : [];
      const openThreads = Array.isArray(parsed?.openThreads)
        ? parsed.openThreads.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 6)
        : [];
      const confidence = Number.isFinite(Number(parsed?.confidence))
        ? clampNumber(Number(parsed.confidence), 0, 1)
        : 0.64;
      return { summary, keyFacts, openThreads, confidence };
    } catch (err) {
      warn("[conversation-summary-ai] fallback null:", err?.message ?? err);
      return null;
    }
  }

  async function validateSceneFrameContinuityWithAI({
    reply,
    sceneFrame,
    worldState,
    conversationMode
  }) {
    if (!aiEnabled || typeof callOpenAiJson !== "function") return { valid: true, reason: "ai-disabled" };
    if (String(conversationMode ?? "rp") !== "rp") return { valid: true, reason: "non-rp" };
    const text = String(reply ?? "").trim();
    if (!text) return { valid: true, reason: "empty" };
    try {
      const model = resolveModel();
      const systemPrompt =
        "Tu valides la continuite d'une reponse MJ par rapport au frame de scene actif. " +
        "Retourne UNIQUEMENT un JSON valide: {valid:boolean, reason:string, severity:string}. " +
        "Valid=false si la reponse glisse sans justification sur le lieu, le point d'interet, l'interlocuteur ou le sujet actif.";
      const userPayload = {
        reply: text,
        frame: sceneFrame ?? null,
        world: {
          location: worldState?.location ?? null,
          time: worldState?.time ?? null
        }
      };
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload
      });
      return sanitizeSceneContinuityValidation(parsed);
    } catch (err) {
      warn("[scene-frame-continuity-ai] fallback valid:", err?.message ?? err);
      return { valid: true, reason: "validator-fallback" };
    }
  }

  async function refineMjStructuredReplyWithTools({
    message,
    initialStructured,
    toolResults,
    worldState,
    canonicalContext,
    contextPack,
    activeInterlocutor,
    conversationMode,
    narrativeStage
  }) {
    const base = sanitizeMjStructuredReply(initialStructured);
    const safeToolResults = Array.isArray(toolResults) ? toolResults.slice(0, 8) : [];
    if (!safeToolResults.length) return base;
    if (!aiEnabled || typeof callOpenAiJson !== "function") {
      return {
        ...base,
        actionResult:
          base.actionResult ||
          "Les elements verifies confirment le rythme de la scene et ce qui t'entoure.",
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
        "Si un interlocuteur est actif en scene sociale, garde une voix PNJ concrete et differenciee. " +
        "Interdit: formulations meta, traces de debug, ou raisonnement interne du MJ dans la reponse RP. " +
        `${stageDirective(narrativeStage)} ` +
        "N'augmente pas artificiellement l'importance narrative: evite de creer une quete/revelation sans preuve outil/lore. " +
        "Adresse le joueur en tutoiement (tu), pas en vouvoiement (vous). " +
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
        canonicalContext: canonicalContext ?? null,
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
    detectWorldIntentWithAI,
    arbitrateSceneIntentWithAI,
    validateNarrativeStateConsistency,
    extractLocalMemoryCandidatesWithAI,
    generateEntityMicroProfilesWithAI,
    summarizeConversationWindowWithAI,
    resolveSpatialTargetWithAI,
    arbitratePendingTravelWithAI,
    assessRuntimeEligibilityWithAI,
    resolveSceneFramePatchWithAI,
    validateSceneFrameContinuityWithAI,
    shouldApplyRuntimeForIntent,
    buildNarrativeDirectorPlan,
    generateMjStructuredReply,
    refineMjStructuredReplyWithTools
  };
}

module.exports = {
  createNarrationAiHelpers
};
