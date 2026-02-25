// Serveur unique pour test-GAME
// -----------------------------
// - Expose POST /api/enemy-ai (IA ennemis via ChatGPT)
// - Sert le front statique depuis le dossier dist (comme test-LORE)
// - Lit OPENAI_API_KEY via process.env ou .env (clÃ© jamais envoyÃ©e au front)
//
// Workflow conseillÃ© :
//   cd test-GAME
//   npm run build        // gÃ©nÃ¨re dist/
//   npm run dev          // lance ce serveur (node server.js)
//   ouvrir http://localhost:5175

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { createNarrationAiHelpers } = require("./server/narrationAiHelpers");
const { createMjToolBus } = require("./server/mjToolBus");
const { createCharacterContextHelpers } = require("./server/characterContextHelpers");
const { createHrpAiInterpreter } = require("./server/hrpAiInterpreter");
const { createRpActionValidator } = require("./server/rpActionValidator");
const { createRpActionResolver } = require("./server/rpActionResolver");

const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.ENEMY_AI_PORT
  ? Number(process.env.ENEMY_AI_PORT)
  : 5175;

const DIST_DIR = path.join(__dirname, "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");
const NARRATION_MODULE_DIR = path.join(__dirname, "narration-module");
const NARRATION_STATE_PATH = path.join(
  NARRATION_MODULE_DIR,
  "runtime",
  "NarrativeGameState.v1.json"
);
const NARRATION_WORLD_STATE_PATH = path.join(
  NARRATION_MODULE_DIR,
  "runtime",
  "NarrativeWorldState.v1.json"
);
const LORE_DB_PATH = path.join(__dirname, "..", "test-LORE", "data", "lore.db");
const CHARACTERS_DATA_DIR = path.join(__dirname, "src", "data", "characters");
const RACES_INDEX_PATH = path.join(CHARACTERS_DATA_DIR, "races", "index.json");
const BACKGROUNDS_INDEX_PATH = path.join(CHARACTERS_DATA_DIR, "backgrounds", "index.json");
const CLASSES_INDEX_PATH = path.join(CHARACTERS_DATA_DIR, "classes", "index.json");

// ----------------------------------------------------
// Lecture de la clÃ© API OpenAI
// ----------------------------------------------------

function loadOpenAiApiKey() {
  // 1) PrioritÃ© Ã  la variable d'environnement directe
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }

  // 2) Fallback : tenter de lire le fichier .env du projet
  try {
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        // Supporte OPENAI_API_KEY=... ou OPENAI_API_KEY: ...
        const match = trimmed.match(/^OPENAI_API_KEY\s*[:=]\s*(.+)\s*$/);
        if (match) {
          return match[1].trim();
        }
      }
    }
  } catch (err) {
    console.warn("Erreur lors de la lecture du fichier .env:", err);
  }

  return null;
}

const OPENAI_API_KEY = loadOpenAiApiKey();
if (!OPENAI_API_KEY) {
  console.warn(
    "[enemy-ai] Aucun OPENAI_API_KEY trouvÃ©. " +
      "Le serveur rÃ©pondra mais sans appeler l'API OpenAI (fallback local)."
  );
} else {
  console.log("[enemy-ai] ClÃ© OpenAI dÃ©tectÃ©e, appels IA activÃ©s.");
}

// ----------------------------------------------------
// Helpers HTTP
// ----------------------------------------------------

function sendJson(res, statusCode, data) {
  const payload = attachMjContractToPayload(data);
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  res.end(body);
}

function normalizeMjOptionText(option) {
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

function normalizeMjOptions(options, limit = 6) {
  if (!Array.isArray(options)) return [];
  return options
    .map((entry) => normalizeMjOptionText(entry))
    .map((text) => oneLine(text, 140))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeToolCallShape(entry) {
  const row = entry && typeof entry === "object" ? entry : {};
  const name = String(row.name ?? row.tool ?? row.id ?? "").trim().toLowerCase();
  if (!name) return null;
  const args = row.args && typeof row.args === "object" ? row.args : {};
  return { name, args };
}

function mergeToolCalls(aiCalls, priorityCalls, limit = 6) {
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
  return merged.slice(0, limit);
}

function buildPriorityMjToolCalls({
  message,
  intent,
  directorPlan,
  conversationMode,
  worldState,
  hasCharacterProfile
}) {
  if (String(conversationMode ?? "rp") !== "rp") return [];
  const normalizedMessage = normalizeForIntent(message);
  const intentType = String(intent?.type ?? "story_action");
  const mode = String(directorPlan?.mode ?? "scene_only");

  const calls = [{ name: "get_world_state", args: {} }];
  const hasPending =
    Boolean(worldState?.conversation?.pendingAction) ||
    Boolean(worldState?.travel?.pending) ||
    Boolean(worldState?.conversation?.pendingTravel) ||
    Boolean(worldState?.conversation?.pendingAccess);
  if (hasPending) {
    calls.push({ name: "session_db_read", args: { scope: "pending" } });
  }

  if (hasCharacterProfile) {
    const asksSheet =
      /\b(mon|mes|ma)\b/.test(normalizedMessage) ||
      /\bqui\s+suis/.test(normalizedMessage) ||
      /\bcombien\b/.test(normalizedMessage) ||
      /\bcompetence\b/.test(normalizedMessage) ||
      /\barme\b/.test(normalizedMessage) ||
      /\bsort\b/.test(normalizedMessage) ||
      /\bressource\b/.test(normalizedMessage);
    if (asksSheet || intentType === "system_command") {
      calls.push({ name: "query_player_sheet", args: { scope: "identity-loadout-rules" } });
    }
  }

  if (
    mode === "lore" ||
    mode === "exploration" ||
    /\bou\s+suis/.test(normalizedMessage) ||
    /\bou\s+aller/.test(normalizedMessage) ||
    /\bville\b/.test(normalizedMessage) ||
    /\bquartier\b/.test(normalizedMessage) ||
    /\bauberge\b/.test(normalizedMessage) ||
    /\bport\b/.test(normalizedMessage)
  ) {
    calls.push({ name: "query_lore", args: { query: message, limit: 4 } });
  }

  if (
    /\btest\b/.test(normalizedMessage) ||
    /\bjet\b/.test(normalizedMessage) ||
    /\bpossible\b/.test(normalizedMessage) ||
    /\bpeux[- ]?je\b/.test(normalizedMessage)
  ) {
    calls.push({ name: "query_rules", args: { query: message } });
  }

  if (intentType === "story_action" || intentType === "social_action") {
    calls.push({ name: "quest_trama_tick", args: { dryRun: true } });
  }

  calls.push({ name: "session_db_read", args: { scope: "scene-memory" } });
  return mergeToolCalls([], calls, 6);
}

const MJ_CONTRACT_STATS_MAX_SAMPLES = 20;
const MJ_CONTRACT_STATS = {
  total: 0,
  bySource: {},
  recent: [],
  narrativeTurns: 0,
  groundedTurns: 0,
  ungroundedTurns: 0,
  byIntent: {},
  recentGrounding: []
};

function normalizeContractSourceLabel(value) {
  const source = String(value ?? "").trim();
  if (!source) return "unknown";
  return source;
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
  const responseType = String(payload?.mjContract?.mjResponse?.responseType ?? payload?.mjResponse?.responseType ?? "").trim();
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
}

function buildMjContractStatsPayload() {
  const narrativeTurns = Number(MJ_CONTRACT_STATS.narrativeTurns ?? 0);
  const groundedTurns = Number(MJ_CONTRACT_STATS.groundedTurns ?? 0);
  const groundingRate = narrativeTurns > 0 ? Number(((groundedTurns / narrativeTurns) * 100).toFixed(1)) : 0;
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
    }
  };
}

function parseReplyToMjBlocks(reply) {
  const text = String(reply ?? "").trim();
  if (!text) {
    return {
      directAnswer: "",
      scene: "",
      actionResult: "",
      consequences: "",
      options: []
    };
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const optionLine = lines.find((line) => /^tu peux maintenant:/i.test(line));
  const options = optionLine
    ? optionLine
        .replace(/^tu peux maintenant:\s*/i, "")
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const withoutOptionLine = lines.filter((line) => line !== optionLine);
  const scene = withoutOptionLine[0] ?? "";
  const actionResult = withoutOptionLine[1] ?? "";
  const consequences = withoutOptionLine[2] ?? "";
  const directAnswer =
    withoutOptionLine.length <= 2
      ? withoutOptionLine[0] ?? ""
      : "";
  return {
    directAnswer,
    scene,
    actionResult,
    consequences,
    options
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
    version: "1.0.0",
    confidence,
    intent: {
      type: String(intent?.type ?? "story_action"),
      confidence: Number.isFinite(Number(intent?.confidence))
        ? clampNumber(Number(intent.confidence), 0, 1)
        : confidence,
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
    travel:
      data?.worldState?.travel?.pending ??
      data?.worldState?.conversation?.pendingTravel ??
      null,
    access: data?.worldState?.conversation?.pendingAccess ?? null
  };
  const hrpToolTrace = Array.isArray(data?.hrpAnalysis?.toolTrace) ? data.hrpAnalysis.toolTrace : [];
  const mjToolTrace = Array.isArray(data?.mjToolTrace) ? data.mjToolTrace : [];
  const toolCalls = [...hrpToolTrace, ...mjToolTrace].slice(0, 24);
  const contract = normalizeMjContract({
    confidence: Number(data?.intent?.confidence ?? data?.mjStructured?.confidence ?? 0.7),
    intent: data?.intent ?? {},
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
    mjResponse: contract.mjResponse,
    mjContract: {
      ...contract,
      contractSource: responseParts.source
    }
  };
  trackMjContractSource(payload?.mjContract?.contractSource, payload);
  return payload;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString("utf8");
      if (body.length > 1_000_000) {
        reject(new Error("Payload trop volumineux"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        const json = JSON.parse(body);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ----------------------------------------------------
// Appel Ã  l'API OpenAI (Chat Completions JSON)
// ----------------------------------------------------

async function callOpenAiForEnemyIntents(stateSummary) {
  if (!OPENAI_API_KEY) {
    // Pas de clÃ© : on renvoie un tableau vide, le front fera un fallback local.
    return { intents: [] };
  }

  const model = process.env.ENEMY_AI_MODEL || "gpt-4.1-mini";

  const systemPrompt =
    "Tu es le controleur tactique des ennemis dans un jeu de combat au tour par tour sur grille. " +
    "On te fournit l'etat du plateau (joueur, ennemis, dimensions, actions disponibles). " +
    "Tu dois proposer UNE action par ennemi via un intent, et rien d'autre. " +
    "Chaque ennemi a une liste actionIds (les IDs d'actions qu'il a le droit d'utiliser). " +
    "Respecte strictement les contraintes suivantes : " +
    "- Utilise uniquement les enemyId fournis dans l'etat. " +
    "- Utilise uniquement des actionId presentes dans actionsCatalog ET dans enemy.actionIds. " +
    "- Pour une action de deplacement (ex: move), renvoie target.kind='cell' avec x,y entiers dans la grille. " +
    "- Pour une attaque ciblant le joueur, renvoie target.kind='token' avec tokenId = player.id. " +
    "- Integre aiRole pour le comportement: brute/assassin cherchent le contact, archer garde une distance et tire si possible. " +
    "Repond UNIQUEMENT avec un JSON valide de la forme { \"intents\": [ { \"enemyId\": \"...\", \"actionId\": \"...\", \"target\": { \"kind\": \"token\", \"tokenId\": \"...\" } } ] } sans aucun texte autour.";

  const userContent = JSON.stringify(stateSummary);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Erreur OpenAI ${response.status} ${response.statusText}: ${text}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("RÃ©ponse OpenAI sans contenu message.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error("Impossible de parser la rÃ©ponse OpenAI en JSON.");
  }

  if (!parsed.intents || !Array.isArray(parsed.intents)) {
    throw new Error("Reponse OpenAI invalide: champ intents manquant.");
  }

  const enemyIds = new Set(
    Array.isArray(stateSummary?.enemies)
      ? stateSummary.enemies.map(e => e.id).filter(Boolean)
      : []
  );
  const actionIdsByEnemy = new Map();
  if (Array.isArray(stateSummary?.enemies)) {
    for (const e of stateSummary.enemies) {
      if (!e || typeof e !== "object") continue;
      if (typeof e.id !== "string") continue;
      if (Array.isArray(e.actionIds)) {
        actionIdsByEnemy.set(
          e.id,
          new Set(e.actionIds.filter(x => typeof x === "string"))
        );
      } else {
        actionIdsByEnemy.set(e.id, new Set());
      }
    }
  }

  const catalog = new Set(
    Array.isArray(stateSummary?.actionsCatalog)
      ? stateSummary.actionsCatalog.map(a => a.id).filter(Boolean)
      : []
  );

  const playerId = stateSummary?.player?.id;

  const sanitized = parsed.intents.filter(i => {
    if (!i || typeof i !== "object") return false;
    if (!enemyIds.has(i.enemyId)) return false;
    if (typeof i.actionId !== "string" || !i.actionId.trim()) return false;
    if (!catalog.has(i.actionId)) return false;

    const allowed = actionIdsByEnemy.get(i.enemyId);
    if (allowed && allowed.size > 0 && !allowed.has(i.actionId)) return false;

    const target = i.target;
    if (!target || typeof target !== "object") return true;
    if (target.kind === "cell") {
      return typeof target.x === "number" && typeof target.y === "number";
    }
    if (target.kind === "token") {
      if (typeof target.tokenId !== "string") return false;
      if (typeof playerId === "string" && target.tokenId !== playerId) return false;
      return true;
    }
    if (target.kind === "none") return true;
    return false;
  });

  const logged = sanitized.map(i => ({
    enemyId: i.enemyId,
    actionId: i.actionId,
    target: i.target
  }));
  console.log("[enemy-ai] Intents IA retenus:", logged);

  return { intents: sanitized };
}

async function callOpenAiJson({ model, systemPrompt, userPayload }) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquante");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Erreur OpenAI ${response.status} ${response.statusText}: ${text}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("RÃ©ponse OpenAI sans contenu message.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Impossible de parser la rÃ©ponse OpenAI en JSON.");
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function worldTimeLabel(hour) {
  if (hour < 6) return "nuit";
  if (hour < 11) return "matin";
  if (hour < 14) return "midi";
  if (hour < 17) return "milieu d'apr\u00e8s-midi";
  if (hour < 20) return "fin d'apr\u00e8s-midi";
  if (hour < 23) return "soiree";
  return "nuit";
}

function normalizeWorldTime(time) {
  const dayRaw = Number(time?.day ?? 1);
  const hourRaw = Number(time?.hour ?? 15);
  const minuteRaw = Number(time?.minute ?? 0);
  const day = Number.isFinite(dayRaw) ? Math.max(1, Math.floor(dayRaw)) : 1;
  const hour = Number.isFinite(hourRaw) ? clampNumber(Math.floor(hourRaw), 0, 23) : 15;
  const minute = Number.isFinite(minuteRaw) ? clampNumber(Math.floor(minuteRaw), 0, 59) : 0;
  return {
    day,
    hour,
    minute,
    label: worldTimeLabel(hour)
  };
}

function sanitizePendingAction(value) {
  if (!value || typeof value !== "object") return null;
  const proposal =
    value?.proposal && typeof value.proposal === "object"
      ? {
          actionType: String(value.proposal.actionType ?? ""),
          targetId: String(value.proposal.targetId ?? ""),
          justification: String(value.proposal.justification ?? "")
        }
      : null;
  const serverEvidence =
    value?.serverEvidence && typeof value.serverEvidence === "object"
      ? value.serverEvidence
      : {};
  const normalized = {
    isActionQuery: Boolean(value.isActionQuery),
    actionType: String(value.actionType ?? "generic_action"),
    targetId: String(value.targetId ?? ""),
    targetLabel: String(value.targetLabel ?? ""),
    allowed: Boolean(value.allowed),
    reason: String(value.reason ?? ""),
    proposal,
    serverEvidence,
    createdAt: String(value.createdAt ?? new Date().toISOString())
  };
  return normalized;
}

function sanitizePendingTravel(value) {
  if (!value || typeof value !== "object") return null;
  const placeId = String(value.placeId ?? "").trim();
  const placeLabel = String(value.placeLabel ?? "").trim();
  if (!placeLabel) return null;
  const sourceLoreIds = Array.isArray(value.sourceLoreIds)
    ? value.sourceLoreIds
        .map((entry) => String(entry ?? "").trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  return {
    placeId: placeId || `session:${normalizeForIntent(placeLabel).replace(/[^a-z0-9]+/g, "-")}`,
    placeLabel,
    question: String(value.question ?? "").trim(),
    sourceLoreIds,
    createdAt: String(value.createdAt ?? new Date().toISOString())
  };
}

function sanitizePendingAccess(value) {
  if (!value || typeof value !== "object") return null;
  const placeId = String(value.placeId ?? "").trim();
  const placeLabel = String(value.placeLabel ?? "").trim();
  if (!placeLabel) return null;
  const accessRaw = String(value.access ?? "public").trim().toLowerCase();
  const access = accessRaw === "sealed" || accessRaw === "restricted" ? accessRaw : "public";
  const riskFlags = Array.isArray(value.riskFlags)
    ? value.riskFlags
        .map((risk) => String(risk ?? "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  return {
    placeId: placeId || `session:${slugifyText(placeLabel) || "lieu"}`,
    placeLabel,
    access,
    riskFlags,
    reason: String(value.reason ?? "access-gate").trim(),
    prompt: String(value.prompt ?? "").trim(),
    createdAt: String(value.createdAt ?? new Date().toISOString())
  };
}

function sanitizeWorldLocation(value) {
  if (!value || typeof value !== "object") {
    return { id: "archives.parvis", label: "Parvis des Archives" };
  }
  const id = String(value.id ?? "").trim() || "archives.parvis";
  const label = String(value.label ?? "").trim() || "Parvis des Archives";
  return { id, label };
}

function sanitizeSessionPlaces(value) {
  const allowedAccess = new Set(["public", "restricted", "sealed"]);
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const id = String(entry.id ?? "").trim();
      const label = String(entry.label ?? "").trim();
      if (!id || !label) return null;
      const tags = Array.isArray(entry.tags)
        ? entry.tags
            .map((tag) => String(tag ?? "").trim())
            .filter(Boolean)
            .slice(0, 12)
        : [];
      const riskFlags = Array.isArray(entry.riskFlags)
        ? entry.riskFlags
            .map((risk) => String(risk ?? "").trim())
            .filter(Boolean)
            .slice(0, 12)
        : [];
      const sources = Array.isArray(entry.sources)
        ? entry.sources
            .map((source) => String(source ?? "").trim())
            .filter(Boolean)
            .slice(0, 12)
        : [];
      const accessRaw = String(entry.access ?? "public").trim().toLowerCase();
      const access = allowedAccess.has(accessRaw) ? accessRaw : "public";
      return {
        id,
        label,
        city: String(entry.city ?? "").trim(),
        access,
        tags,
        riskFlags,
        sources,
        summary: String(entry.summary ?? "").trim(),
        createdAt: String(entry.createdAt ?? new Date().toISOString()),
        updatedAt: String(entry.updatedAt ?? entry.createdAt ?? new Date().toISOString())
      };
    })
    .filter(Boolean)
    .slice(-80);
}

function sanitizeTravelState(value) {
  const safe = value && typeof value === "object" ? value : {};
  const pendingRaw = safe.pending && typeof safe.pending === "object" ? safe.pending : null;
  const lastRaw = safe.last && typeof safe.last === "object" ? safe.last : null;
  const pending = pendingRaw
    ? {
        from: sanitizeWorldLocation(pendingRaw.from),
        to: sanitizeWorldLocation(pendingRaw.to),
        durationMin: Math.max(1, Math.floor(Number(pendingRaw.durationMin) || 3)),
        reason: String(pendingRaw.reason ?? "travel-proposed"),
        startedAt: String(pendingRaw.startedAt ?? new Date().toISOString())
      }
    : null;
  const last = lastRaw
    ? {
        from: sanitizeWorldLocation(lastRaw.from),
        to: sanitizeWorldLocation(lastRaw.to),
        durationMin: Math.max(1, Math.floor(Number(lastRaw.durationMin) || 3)),
        appliedAt: String(lastRaw.appliedAt ?? new Date().toISOString()),
        reason: String(lastRaw.reason ?? "travel-applied")
      }
    : null;
  return { pending, last };
}

function sanitizeRpRuntime(value) {
  const safe = value && typeof value === "object" ? value : {};
  const rawSlots = safe?.spellSlots && typeof safe.spellSlots === "object" ? safe.spellSlots : {};
  const spellSlots = {};
  Object.entries(rawSlots).forEach(([level, entry]) => {
    const max = Number(entry?.max ?? 0);
    const remaining = Number(entry?.remaining ?? 0);
    if (!Number.isFinite(max) && !Number.isFinite(remaining)) return;
    spellSlots[String(level)] = {
      max: Number.isFinite(max) ? max : 0,
      remaining: Number.isFinite(remaining) ? remaining : 0
    };
  });
  const lastResolution =
    safe?.lastResolution && typeof safe.lastResolution === "object"
      ? {
          at: String(safe.lastResolution.at ?? ""),
          actionType: String(safe.lastResolution.actionType ?? ""),
          targetId: String(safe.lastResolution.targetId ?? ""),
          success: Boolean(safe.lastResolution.success),
          summary: String(safe.lastResolution.summary ?? "")
        }
      : null;
  return {
    spellSlots,
    lastResolution
  };
}

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

function createInitialNarrativeWorldState() {
  return {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    metrics: {
      reputation: 0,
      localTension: 0
    },
    startContext: {
      delivered: false,
      locationId: "lysenthe.archives.parvis",
      locationLabel: "Parvis des Archives, Lysenthe",
      city: "Lysenthe",
      territory: "Astryade",
      region: "Ylssea",
      characterSnapshot: null
    },
    conversation: {
      activeInterlocutor: null,
      pendingAction: null,
      pendingTravel: null,
      pendingAccess: null
    },
    rpRuntime: {
      spellSlots: {},
      lastResolution: null
    },
    location: {
      id: "lysenthe.archives.parvis",
      label: "Parvis des Archives, Lysenthe"
    },
    travel: {
      pending: null,
      last: null
    },
    sessionPlaces: [],
    time: {
      day: 1,
      hour: 15,
      minute: 0,
      label: "milieu d'apr\u00e8s-midi"
    },
    history: []
  };
}

function loadNarrativeWorldState() {
  try {
    if (!fs.existsSync(NARRATION_WORLD_STATE_PATH)) {
      return createInitialNarrativeWorldState();
    }
    const raw = fs.readFileSync(NARRATION_WORLD_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return createInitialNarrativeWorldState();
    }
    const reputation = Number(parsed?.metrics?.reputation ?? 0);
    const localTension = Number(parsed?.metrics?.localTension ?? 0);
    return {
      version: "1.0.0",
      updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
      metrics: {
        reputation: Number.isFinite(reputation) ? reputation : 0,
        localTension: Number.isFinite(localTension) ? localTension : 0
      },
      startContext: {
        delivered: Boolean(parsed?.startContext?.delivered),
        locationId: String(parsed?.startContext?.locationId ?? "lysenthe.archives.parvis"),
        locationLabel: String(parsed?.startContext?.locationLabel ?? "Parvis des Archives, Lysenthe"),
        city: String(parsed?.startContext?.city ?? "Lysenthe"),
        territory: String(parsed?.startContext?.territory ?? "Astryade"),
        region: String(parsed?.startContext?.region ?? "Ylssea"),
        characterSnapshot:
          parsed?.startContext?.characterSnapshot && typeof parsed.startContext.characterSnapshot === "object"
            ? parsed.startContext.characterSnapshot
            : null
      },
      conversation: {
        activeInterlocutor:
          parsed?.conversation?.activeInterlocutor == null
            ? null
            : String(parsed.conversation.activeInterlocutor),
        pendingAction: sanitizePendingAction(parsed?.conversation?.pendingAction),
        pendingTravel: sanitizePendingTravel(parsed?.conversation?.pendingTravel),
        pendingAccess: sanitizePendingAccess(parsed?.conversation?.pendingAccess)
      },
      rpRuntime: sanitizeRpRuntime(parsed?.rpRuntime),
      location: sanitizeWorldLocation(parsed?.location),
      travel: sanitizeTravelState(parsed?.travel),
      sessionPlaces: sanitizeSessionPlaces(parsed?.sessionPlaces),
      time: normalizeWorldTime(parsed?.time),
      history: Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch (err) {
    console.warn("[narration-world] lecture etat monde impossible:", err?.message ?? err);
    return createInitialNarrativeWorldState();
  }
}

function saveNarrativeWorldState(state) {
  try {
    fs.mkdirSync(path.dirname(NARRATION_WORLD_STATE_PATH), { recursive: true });
    fs.writeFileSync(
      NARRATION_WORLD_STATE_PATH,
      `${JSON.stringify(state, null, 2)}\n`,
      "utf8"
    );
  } catch (err) {
    console.warn("[narration-world] sauvegarde etat monde impossible:", err?.message ?? err);
  }
}

function loadIndexedDataFiles(indexPath) {
  try {
    if (!fs.existsSync(indexPath)) return [];
    const raw = fs.readFileSync(indexPath, "utf8");
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.types) ? parsed.types : [];
    const baseDir = path.dirname(indexPath);
    return entries
      .map((entryPath) => path.resolve(baseDir, String(entryPath)))
      .filter((resolvedPath) => fs.existsSync(resolvedPath))
      .map((resolvedPath) => {
        try {
          const content = fs.readFileSync(resolvedPath, "utf8");
          const json = JSON.parse(content);
          return json && typeof json === "object" ? json : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function loadItemDataCatalog() {
  if (itemDataCatalogCache) return itemDataCatalogCache;
  const byId = new Map();
  const rootDir = path.join(__dirname, "src", "data", "items");
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir || !fs.existsSync(currentDir)) continue;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (!entry.isFile()) return;
      if (!entry.name.toLowerCase().endsWith(".json")) return;
      if (entry.name.toLowerCase() === "index.json") return;
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        const id = String(parsed?.id ?? "").trim();
        if (!id) return;
        const label = String(parsed?.label ?? parsed?.name ?? id).trim() || id;
        const description = String(
          parsed?.description ?? parsed?.descriptionCourte ?? parsed?.descriptionLongue ?? ""
        ).trim();
        byId.set(id, {
          id,
          label,
          description,
          type: String(parsed?.type ?? "").trim()
        });
      } catch {
        // ignore malformed item files
      }
    });
  }

  itemDataCatalogCache = byId;
  return itemDataCatalogCache;
}

function resolveItemDataById(itemId) {
  const id = String(itemId ?? "").trim();
  if (!id) return null;
  const catalog = loadItemDataCatalog();
  return catalog.get(id) ?? null;
}

function buildCharacterDataCatalog() {
  const races = new Map();
  const backgrounds = new Map();
  const classes = new Map();
  const subclasses = new Map();

  loadIndexedDataFiles(RACES_INDEX_PATH).forEach((entry) => {
    const id = String(entry?.id ?? "").trim();
    if (id) races.set(id, entry);
  });

  loadIndexedDataFiles(BACKGROUNDS_INDEX_PATH).forEach((entry) => {
    const id = String(entry?.id ?? "").trim();
    if (id) backgrounds.set(id, entry);
  });

  loadIndexedDataFiles(CLASSES_INDEX_PATH).forEach((entry) => {
    const id = String(entry?.id ?? "").trim();
    if (!id) return;
    if (String(entry?.classId ?? "").trim()) {
      subclasses.set(id, entry);
      return;
    }
    classes.set(id, entry);
  });

  return { races, backgrounds, classes, subclasses };
}

function getCharacterDataCatalog() {
  if (characterDataCatalogCache) return characterDataCatalogCache;
  characterDataCatalogCache = buildCharacterDataCatalog();
  return characterDataCatalogCache;
}

function resolveCharacterDataByIds(profile) {
  if (!profile || typeof profile !== "object") {
    return {
      race: null,
      background: null,
      classes: []
    };
  }

  const catalog = getCharacterDataCatalog();
  const raceId = String(profile?.raceId ?? "").trim();
  const backgroundId = String(profile?.backgroundId ?? "").trim();
  const classEntries = Array.isArray(profile?.classEntries) ? profile.classEntries : [];

  const classes = classEntries.map((entry) => {
    const classeId = String(entry?.classeId ?? "").trim();
    const subclasseId = String(entry?.subclasseId ?? "").trim();
    const classDef = classeId ? catalog.classes.get(classeId) ?? null : null;
    const subclassDef = subclasseId ? catalog.subclasses.get(subclasseId) ?? null : null;
    return {
      slot: String(entry?.slot ?? ""),
      level: Number(entry?.niveau ?? 0) || 0,
      classeId,
      subclasseId,
      classLabel: String(classDef?.label ?? ""),
      classDescription: String(classDef?.description ?? ""),
      subclassLabel: String(subclassDef?.label ?? ""),
      subclassDescription: String(subclassDef?.description ?? "")
    };
  });

  const raceDef = raceId ? catalog.races.get(raceId) ?? null : null;
  const backgroundDef = backgroundId ? catalog.backgrounds.get(backgroundId) ?? null : null;

  return {
    race: raceDef
      ? {
          id: raceId,
          label: String(raceDef?.label ?? ""),
          description: String(raceDef?.description ?? "")
        }
      : null,
    background: backgroundDef
      ? {
          id: backgroundId,
          label: String(backgroundDef?.label ?? ""),
          description: String(backgroundDef?.description ?? "")
        }
      : null,
    classes
  };
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

function applyWorldDelta(worldState, delta, metadata) {
  const safe = worldState && typeof worldState === "object"
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

  return next;
}

function sanitizeCharacterProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const p = profile;
  const toSafeString = (value, fallback = "") => {
    if (typeof value === "string") return value.trim() || fallback;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value === "object") {
      const obj = value;
      const candidates = [obj.label, obj.name, obj.value, obj.id]
        .filter((x) => typeof x === "string" || typeof x === "number")
        .map((x) => String(x).trim())
        .filter(Boolean);
      if (candidates.length) return candidates[0];
      return fallback;
    }
    return fallback;
  };
  const toStringArray = (value) =>
    Array.isArray(value) ? value.map((x) => String(x)).filter(Boolean).slice(0, 24) : [];
  const toIdArray = (value, max = 64) =>
    Array.isArray(value)
      ? Array.from(
          new Set(
            value
              .map((x) => String(x).trim())
              .filter(Boolean)
              .slice(0, max)
          )
        )
      : [];
  const toPlainRecord = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  const toInventoryItems = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .slice(0, 240)
      .map((item) => {
        const safe = item && typeof item === "object" ? item : {};
        return {
          type: toSafeString(safe.type, ""),
          id: toSafeString(safe.id, ""),
          qty: Number.isFinite(Number(safe.qty)) ? Number(safe.qty) : 0,
          source: toSafeString(safe.source, ""),
          instanceId: toSafeString(safe.instanceId, ""),
          equippedSlot: toSafeString(safe.equippedSlot, ""),
          storedIn: toSafeString(safe.storedIn, ""),
          isPrimaryWeapon: Boolean(safe.isPrimaryWeapon),
          isSecondaryHand: Boolean(safe.isSecondaryHand),
          displayName: toSafeString(
            safe.displayName ?? safe.customName ?? safe.name ?? safe.label,
            ""
          ),
          description: toSafeString(
            safe.description ?? safe.descriptionCourte ?? safe.descriptionLongue,
            ""
          ),
          customProperties:
            safe.customProperties && typeof safe.customProperties === "object"
              ? safe.customProperties
              : {},
          properties:
            safe.properties && typeof safe.properties === "object"
              ? safe.properties
              : {}
        };
      })
      .filter((item) => item.id);
  };
  const toClassEntries = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((entry, index) => {
          const safeEntry = entry && typeof entry === "object" ? entry : {};
          const classeId = toSafeString(safeEntry?.classeId ?? safeEntry?.classId, "");
          const subclasseId = toSafeString(
            safeEntry?.subclasseId ?? safeEntry?.subclassId,
            ""
          );
          const niveau = Number(safeEntry?.niveau ?? safeEntry?.level ?? 0);
          if (!classeId && !subclasseId) return null;
          return {
            slot: String(safeEntry?.slot ?? index + 1),
            classeId,
            subclasseId,
            niveau: Number.isFinite(niveau) ? niveau : 0
          };
        })
        .filter(Boolean)
        .slice(0, 3);
    }
    if (!value || typeof value !== "object") return [];
    return Object.entries(value)
      .map(([slot, entry]) => {
        const safeEntry = entry && typeof entry === "object" ? entry : {};
        const classeId = toSafeString(safeEntry?.classeId ?? safeEntry?.classId, "");
        const subclasseId = toSafeString(
          safeEntry?.subclasseId ?? safeEntry?.subclassId,
          ""
        );
        const niveau = Number(safeEntry?.niveau ?? safeEntry?.level ?? 0);
        if (!classeId && !subclasseId) return null;
        return {
          slot: String(slot),
          classeId,
          subclasseId,
          niveau: Number.isFinite(niveau) ? niveau : 0
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  };
  const toMoney = (value) => {
    if (!value || typeof value !== "object") return {};
    const keys = ["or", "argent", "cuivre", "platine", "gold", "silver", "copper", "platinum", "po", "pa", "pc", "pp"];
    const out = {};
    keys.forEach((key) => {
      const raw = Number(value?.[key]);
      if (Number.isFinite(raw)) out[key] = raw;
    });
    return out;
  };
  const toCaracs = (value) => {
    if (!value || typeof value !== "object") return {};
    const map = {
      FOR: "force",
      DEX: "dexterite",
      CON: "constitution",
      INT: "intelligence",
      SAG: "sagesse",
      CHA: "charisme"
    };
    const out = {};
    Object.entries(map).forEach(([ability, key]) => {
      const normalizedSource = value?.[ability];
      if (normalizedSource && typeof normalizedSource === "object") {
        const scoreRaw = Number(normalizedSource?.score);
        const modRaw = Number(normalizedSource?.mod);
        out[ability] = {
          score: Number.isFinite(scoreRaw) ? scoreRaw : null,
          mod: Number.isFinite(modRaw) ? modRaw : null
        };
        return;
      }
      const source = value?.[key];
      if (!source || typeof source !== "object") return;
      const scoreRaw = Number(source?.[ability] ?? source?.score);
      const modToken = `mod${ability}`;
      const modRaw = Number(source?.[modToken] ?? source?.mod);
      out[ability] = {
        score: Number.isFinite(scoreRaw) ? scoreRaw : null,
        mod: Number.isFinite(modRaw) ? modRaw : null
      };
    });
    return out;
  };
  const nameFromNomObject =
    p?.nom && typeof p.nom === "object" ? toSafeString(p.nom?.nomcomplet ?? p.nom?.prenom, "") : "";
  const classEntries = toClassEntries(p?.classe ?? p?.classEntries);
  return {
    id: toSafeString(p.id, "player-1"),
    name: toSafeString(p.name, nameFromNomObject || "Aventurier"),
    raceId: toSafeString(p.raceId, ""),
    backgroundId: toSafeString(p.backgroundId, ""),
    classEntries,
    race: toSafeString(p.race, "Inconnue"),
    classLabel: toSafeString(p.classLabel ?? p.class, "Sans classe"),
    subclassLabel: p.subclassLabel ? toSafeString(p.subclassLabel, "") : "",
    money: toMoney(p.argent ?? p.money),
    proficiencyBonus: Number(p?.maitriseBonus ?? 0) || 0,
    caracs: toCaracs(p?.caracs),
    appearance: p.appearance && typeof p.appearance === "object" ? p.appearance : null,
    skills: toStringArray(Array.isArray(p.skills) ? p.skills : p.competences),
    expertises: toStringArray(p.expertises),
    goals: toStringArray(p.goals),
    actionIds: toIdArray(p.actionIds),
    reactionIds: toIdArray(p.reactionIds),
    weaponMasteries: toIdArray(p.weaponMasteries),
    proficiencies: toPlainRecord(p.proficiencies),
    materielSlots: toPlainRecord(p.materielSlots),
    inventoryItems: toInventoryItems(p.inventoryItems),
    spellcastingState: toPlainRecord(p.spellcastingState),
    derived: toPlainRecord(p.derived),
    sourceSheetId: toSafeString(p.sourceSheetId, ""),
    sourceTag: toSafeString(p.sourceTag, "")
  };
}

function sanitizeConversationMode(value) {
  const mode = String(value ?? "rp").trim().toLowerCase();
  return mode === "hrp" ? "hrp" : "rp";
}

function toTitleCase(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractInterlocutorFromMessage(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return null;

  const directPatterns = [
    /\bje\s+parle\s+a(?:u|ux| la| l')\s+([a-z0-9\- ]{2,40})/,
    /\bje\s+m[' ]adresse\s+a(?:u|ux| la| l')\s+([a-z0-9\- ]{2,40})/,
    /\bje\s+discute\s+avec\s+([a-z0-9\- ]{2,40})/,
    /\bje\s+demande\s+a(?:u|ux| la| l')\s+([a-z0-9\- ]{2,40})/,
    /\bje\s+negocie\s+avec\s+([a-z0-9\- ]{2,40})/,
    /\bje\s+parle\s+avec\s+([a-z0-9\- ]{2,40})/
  ];

  for (const pattern of directPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const raw = String(match[1] ?? "")
      .replace(/\b(dans|sur|de|du|des|pour|et)\b.*$/g, "")
      .trim();
    if (!raw) continue;
    return toTitleCase(raw);
  }

  if (/\bgarde\b/.test(normalized)) return "Garde";
  if (/\barchiviste\b/.test(normalized)) return "Archiviste";
  if (/\bmarchand\b/.test(normalized)) return "Marchand";
  if (/\bfaction\b/.test(normalized)) return "Faction locale";

  return null;
}

function sanitizeInterlocutorLabel(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 48);
  return text ? toTitleCase(text) : "";
}

function buildSpeakerPayload({ conversationMode, intentType, activeInterlocutor, forceSystem = false }) {
  if (forceSystem) {
    return { id: "system", label: "Système", kind: "system" };
  }
  if (conversationMode === "hrp") {
    return { id: "hrp", label: "Hors RP", kind: "system" };
  }
  if (intentType === "social_action" && activeInterlocutor) {
    return {
      id: `interlocutor:${String(activeInterlocutor).toLowerCase().replace(/\s+/g, "-")}`,
      label: String(activeInterlocutor),
      kind: "interlocutor"
    };
  }
  return { id: "mj", label: "MJ", kind: "mj" };
}

function getSkillSnapshot(profile) {
  const safe = sanitizeCharacterProfile(profile);
  if (!safe) return [];
  return Array.isArray(safe.skills) ? safe.skills.slice(0, 8) : [];
}

function buildHrpReply(message, characterProfile, worldState) {
  const safe = sanitizeCharacterProfile(characterProfile) ?? worldState?.startContext?.characterSnapshot ?? null;
  const resolved = resolveCharacterDataByIds(safe);
  const resolvedRace = resolved?.race?.label ? String(resolved.race.label) : "";
  const resolvedMainClass = resolved?.classes?.[0]?.classLabel
    ? String(resolved.classes[0].classLabel)
    : "";
  const resolvedSubclass = resolved?.classes?.[0]?.subclassLabel
    ? String(resolved.classes[0].subclassLabel)
    : "";
  const normalized = normalizeForIntent(message);
  const isIdentity =
    isSelfIdentityQuestion(message) ||
    /\bma\s+fiche\b/.test(normalized) ||
    /\bmon\s+personnage\b/.test(normalized);

  if (isIdentity && safe) {
    const skills = getSkillSnapshot(safe);
    const raceLabel = safe.race && safe.race !== "Inconnue" ? safe.race : resolvedRace || "Inconnue";
    const classLabel =
      safe.classLabel && safe.classLabel !== "Sans classe"
        ? safe.classLabel
        : resolvedMainClass || "Sans classe";
    const subclassLabel = safe.subclassLabel || resolvedSubclass;
    return [
      `Tu es ${safe.name}, ${raceLabel}, ${classLabel}${subclassLabel ? ` (${subclassLabel})` : ""}.`,
      `Compétences: ${skills.length ? skills.join(", ") : "aucune compétence marquée"}.`
    ].join("\n");
  }

  return [
    "Mode Hors RP actif.",
    "Je peux répondre sur ta fiche, les règles et l'état système.",
    "Exemple: \"qui suis-je ?\", \"mes compétences\", \"/state\", \"/profile-debug\", \"/context-debug\", \"/rules-debug\", \"/contract-debug\", \"/phase1-debug\"."
  ].join("\n");
}

function buildCharacterProfileDiagnostics(characterProfile, worldState) {
  const incoming = sanitizeCharacterProfile(characterProfile);
  const snapshot = sanitizeCharacterProfile(worldState?.startContext?.characterSnapshot ?? null);
  const active = incoming ?? snapshot;
  if (!active) {
    return [
      "Diagnostic fiche PJ",
      "- Aucune fiche active detectee.",
      "- Verifie que le personnage est bien cree et transmis au chat."
    ].join("\n");
  }

  const missing = [];
  if (!active.name || active.name === "Aventurier") missing.push("nom");
  if (!active.race || active.race === "Inconnue") missing.push("race");
  if (!active.classLabel || active.classLabel === "Sans classe") missing.push("classe");
  if (!Array.isArray(active.skills) || active.skills.length === 0) missing.push("competences");
  if (!active.appearance) missing.push("apparence");

  const source = incoming ? "payload chat courant" : "snapshot monde";
  const resolved = resolveCharacterDataByIds(active);
  const resolvedClass = resolved?.classes?.[0] ?? null;
  const moneyEntries = Object.entries(active.money ?? {});
  return [
    "Diagnostic fiche PJ",
    `- Source lue: ${source}`,
    `- Source fiche: ${active.sourceTag || "n/a"}${active.sourceSheetId ? ` (sheetId=${active.sourceSheetId})` : ""}`,
    `- Identite: ${active.name} | ${active.race} | ${active.classLabel}${active.subclassLabel ? ` (${active.subclassLabel})` : ""}`,
    `- IDs: raceId=${active.raceId || "n/a"} | backgroundId=${active.backgroundId || "n/a"} | classeId=${resolvedClass?.classeId || "n/a"} | subclasseId=${resolvedClass?.subclasseId || "n/a"}`,
    `- Resolution src/data: race=${resolved?.race?.label || "introuvable"} | background=${resolved?.background?.label || "introuvable"} | classe=${resolvedClass?.classLabel || "introuvable"} | sous-classe=${resolvedClass?.subclassLabel || "introuvable"}`,
    `- Competences: ${active.skills.length ? active.skills.slice(0, 10).join(", ") : "aucune"}`,
    `- Argent: ${moneyEntries.length ? moneyEntries.map(([k, v]) => `${k}=${v}`).join(", ") : "non renseigne"}`,
    `- Apparence: ${active.appearance ? "ok" : "absente"}`,
    `- Champs a completer: ${missing.length ? missing.join(", ") : "aucun"}`
  ].join("\n");
}

function buildCharacterRulesDiagnostics(characterProfile, worldState) {
  const incoming = sanitizeCharacterProfile(characterProfile);
  const snapshot = sanitizeCharacterProfile(worldState?.startContext?.characterSnapshot ?? null);
  const active = incoming ?? snapshot;
  if (!active) {
    return [
      "Diagnostic regles PJ",
      "- Aucune fiche active detectee.",
      "- Lance /profile-debug pour verifier la source."
    ].join("\n");
  }

  const rules = buildRuleSnapshot(active);
  if (!rules) {
    return [
      "Diagnostic regles PJ",
      "- Impossible de construire un snapshot regles avec les donnees actuelles."
    ].join("\n");
  }

  const topSkills = [...rules.skills]
    .filter((row) => row.proficient || row.expertise)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    .slice(0, 10)
    .map((row) => `${row.label}:${signedValue(row.total)}${row.expertise ? "(expertise)" : ""}`)
    .join(", ");

  return [
    "Diagnostic regles PJ",
    `- Maitrise: ${signedValue(rules.proficiencyBonus)}`,
    `- Mods: FOR ${signedValue(rules.abilities.FOR)} | DEX ${signedValue(rules.abilities.DEX)} | CON ${signedValue(rules.abilities.CON)} | INT ${signedValue(rules.abilities.INT)} | SAG ${signedValue(rules.abilities.SAG)} | CHA ${signedValue(rules.abilities.CHA)}`,
    `- Competences maitrisees: ${topSkills || "aucune"}`
  ].join("\n");
}

function requiresInterlocutorInRp(intent, message, activeInterlocutor) {
  if (intent?.type !== "social_action") return false;
  if (activeInterlocutor) return false;
  if (extractInterlocutorFromMessage(message)) return false;
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  return /\bje\s+parle\b|\bje\s+discute\b|\bje\s+demande\b|\bje\s+negocie\b|\bje\s+persuade\b/.test(normalized);
}

function buildRpNeedInterlocutorReply(records) {
  const hints = Array.isArray(records)
    ? records
        .slice(0, 3)
        .map((record) => String(record?.title ?? "").trim())
        .filter(Boolean)
    : [];
  const options = [
    "Dire a qui tu t'adresses (ex: au garde, a l'archiviste)",
    "Observer la foule pour choisir un interlocuteur",
    "Changer d'action"
  ];
  if (hints.length > 0) {
    options[1] = `Observer un profil local (${hints.join(" / ")})`;
  }
  return buildMjReplyBlocks({
    scene: "Le parvis des Archives bruisse d'activite.",
    actionResult: "Tu sembles vouloir parler, mais aucun interlocuteur n'est encore etabli.",
    consequences: "Aucune action sociale n'est resolue pour l'instant.",
    options
  });
}

function buildNpcVoiceLine(activeInterlocutor) {
  const label = String(activeInterlocutor ?? "").trim();
  const normalized = normalizeForIntent(label);
  if (!normalized) return "";
  if (/\bgarde\b/.test(normalized)) {
    return `"Le garde ajuste sa hallebarde et te jauge: 'Parle net. Nom, motif, et pas d'embrouille sur le parvis.'"`;
  }
  if (/\barchiviste\b/.test(normalized)) {
    return `"L'archiviste baisse la voix: 'Chaque mot laisse une trace ici. Pose ta question avec precision.'"`;
  }
  if (/\bmarchand\b/.test(normalized)) {
    return `"Le marchand sourit a demi: 'Tout se negocie, mais pas gratuitement. Qu'as-tu a offrir ?'"`;
  }
  if (/\bfaction\b/.test(normalized)) {
    return `"Un emissaire de la faction t'observe: 'Nous ecoutons. Choisis bien tes mots.'"`;
  }
  return `"${label} te repond avec prudence, en attendant de voir ou tu veux en venir."`;
}

function addInterlocutorNote(reply, activeInterlocutor, intentType) {
  if (!activeInterlocutor || intentType !== "social_action") return reply;
  const note = `Interlocuteur actif: ${activeInterlocutor}.`;
  const voice = buildNpcVoiceLine(activeInterlocutor);
  return voice ? `${voice}\n${note}\n${reply}` : `${note}\n${reply}`;
}

function buildPlayerProfileInput(characterProfile) {
  const safe = sanitizeCharacterProfile(characterProfile);
  if (!safe) return undefined;
  const resolved = resolveCharacterDataByIds(safe);
  return {
    id: safe.id,
    tags: [safe.race, safe.classLabel, resolved?.race?.label, resolved?.classes?.[0]?.classLabel]
      .filter(Boolean),
    backgroundTags: [
      safe.subclassLabel,
      resolved?.classes?.[0]?.subclassLabel,
      resolved?.background?.label
    ].filter(Boolean),
    currentGoals: safe.goals
  };
}

function formatCharacterVisual(characterProfile) {
  const safe = sanitizeCharacterProfile(characterProfile);
  if (!safe) return "Silhouette encore indeterminee.";
  const appearance = safe.appearance && typeof safe.appearance === "object" ? safe.appearance : {};
  const hints = [
    safe.race,
    safe.classLabel,
    String(appearance?.bodyType ?? ""),
    String(appearance?.hairColor ?? ""),
    String(appearance?.eyeColor ?? "")
  ]
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 4);
  return hints.length ? hints.join(", ") : `${safe.race}, ${safe.classLabel}`;
}

function buildLockedStartContextText(characterProfile, worldState = null) {
  const safe = sanitizeCharacterProfile(characterProfile);
  const startCtx = worldState?.startContext && typeof worldState.startContext === "object"
    ? worldState.startContext
    : {};
  const city = String(startCtx?.city ?? "Lysenthe");
  const territory = String(startCtx?.territory ?? "Astryade");
  const region = String(startCtx?.region ?? "Ylssea");
  const locationLabel = String(startCtx?.locationLabel ?? "Parvis des Archives, Lysenthe");
  const resolved = resolveCharacterDataByIds(safe);
  const classResolved = resolved?.classes?.[0] ?? null;
  const name = safe?.name ?? "Aventurier";
  const visual = formatCharacterVisual(safe);
  const raceLabel = safe?.race && safe.race !== "Inconnue" ? safe.race : resolved?.race?.label || "Inconnue";
  const classLabel =
    safe?.classLabel && safe.classLabel !== "Sans classe"
      ? safe.classLabel
      : classResolved?.classLabel || "Sans classe";
  const subclassLabel = safe?.subclassLabel || classResolved?.subclassLabel || "";
  const skills = Array.isArray(safe?.skills) && safe.skills.length
    ? safe.skills.slice(0, 8).join(", ")
    : "Aucune competence marquee";

  return [
    "Contexte de depart verrouille:",
    `Tu te trouves a ${locationLabel}, un batiment immense servant de coffre-fort de la verite sur la Primaute.`,
    `Ville de depart: ${city} | Territoire: ${territory} | Region: ${region}.`,
    "Temps initial: milieu d'apr\u00e8s-midi.",
    "Tu viens de t'inscrire dans les registres. Tu es libre de tes choix.",
    `Personnage actif: ${name} (${visual}).`,
    `Identite canonique: ${raceLabel}, ${classLabel}${subclassLabel ? ` (${subclassLabel})` : ""}.`,
    `Competences referencees pour le roleplay et les futurs tests: ${skills}.`
  ].join("\n");
}

function injectLockedStartContextReply(reply, worldState, characterProfile) {
  const safe = worldState && typeof worldState === "object" ? worldState : createInitialNarrativeWorldState();
  if (safe?.startContext?.delivered) {
    return { reply, worldState: safe, injected: false };
  }

  const snapshot = sanitizeCharacterProfile(characterProfile) ?? safe?.startContext?.characterSnapshot ?? null;
  const intro = buildLockedStartContextText(snapshot, safe);
  const next = {
    ...safe,
    updatedAt: new Date().toISOString(),
    startContext: {
      ...(safe.startContext ?? {}),
      delivered: true,
      characterSnapshot: snapshot
    }
  };
  return {
    reply: `${intro}\n\n${reply}`,
    worldState: next,
    injected: true
  };
}

function loadNarrationRuntimeStateFromDisk() {
  const candidates = [
    path.join(__dirname, "narration-module", "runtime", "NarrativeGameState.v1.json"),
    path.join(__dirname, "narration-module", "runtime", "NarrativeGameState.domain-coverage-demo.json"),
    path.join(__dirname, "narration-module", "runtime", "NarrativeGameState.ai-pipeline-demo.json"),
    path.join(__dirname, "narration-module", "runtime", "NarrativeGameState.memory-demo.json")
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") continue;
      return parsed;
    } catch (err) {
      console.warn("[narration-runtime] Fichier invalide:", filePath, err?.message ?? err);
    }
  }

  return null;
}

let narrationRuntimeCache = null;
let loreDbCache = null;
let loreSearchCache = null;
let characterDataCatalogCache = null;
let itemDataCatalogCache = null;

function ensureNarrationRuntimeBundle() {
  const indexJsPath = path.join(NARRATION_MODULE_DIR, ".tmp", "index.js");
  execSync(
    "npx tsc src/index.ts --target ES2020 --module commonjs --esModuleInterop --skipLibCheck --outDir .tmp",
    { cwd: NARRATION_MODULE_DIR, stdio: "pipe" }
  );
  return indexJsPath;
}

function getNarrationRuntime() {
  if (narrationRuntimeCache) return narrationRuntimeCache;
  const indexJsPath = ensureNarrationRuntimeBundle();
  delete require.cache[indexJsPath];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  narrationRuntimeCache = require(indexJsPath);
  return narrationRuntimeCache;
}

function getWikiTagSearch() {
  if (loreSearchCache) return loreSearchCache;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(path.join(__dirname, "..", "test-LORE", "wikiTag.js"));
    if (typeof mod?.wikiTagSearch === "function") {
      loreSearchCache = mod.wikiTagSearch;
      return loreSearchCache;
    }
  } catch (err) {
    console.warn("[lore-db] wikiTagSearch indisponible:", err?.message ?? err);
  }
  return null;
}

function getLoreDb() {
  if (loreDbCache) return loreDbCache;
  if (!fs.existsSync(LORE_DB_PATH)) return null;

  let BetterSqlite3 = null;
  try {
    // eslint-disable-next-line global-require
    BetterSqlite3 = require("better-sqlite3");
  } catch {
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      BetterSqlite3 = require(path.join(
        __dirname,
        "..",
        "test-LORE",
        "node_modules",
        "better-sqlite3"
      ));
    } catch (err) {
      console.warn("[lore-db] better-sqlite3 indisponible:", err?.message ?? err);
      return null;
    }
  }

  try {
    loreDbCache = new BetterSqlite3(LORE_DB_PATH, { readonly: true });
    return loreDbCache;
  } catch (err) {
    console.warn("[lore-db] ouverture DB impossible:", err?.message ?? err);
    return null;
  }
}

function inferLoreTypeFromRow(row) {
  const haystack = `${row?.tags ?? ""} ${row?.title ?? ""}`.toLowerCase();
  if (haystack.includes("faction") || haystack.includes("guilde") || haystack.includes("ordre")) {
    return "faction";
  }
  if (haystack.includes("histoire") || haystack.includes("myth") || haystack.includes("chronique")) {
    return "histoire";
  }
  if (haystack.includes("acteur") || haystack.includes("pnj") || haystack.includes("personnage")) {
    return "acteur";
  }
  return "lieu";
}

function buildLoreRecordsFromDb(query, limit = 8) {
  const db = getLoreDb();
  const wikiTagSearch = getWikiTagSearch();
  if (!db || !wikiTagSearch) return [];

  try {
    const rows = db
      .prepare("SELECT id, title, tags, summary, body FROM lore_entries ORDER BY created_at DESC")
      .all();
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const matches = wikiTagSearch(query, rows, limit);
    if (!Array.isArray(matches) || matches.length === 0) return [];
    return matches.map((row) => ({
      id: `db:${row.id}`,
      type: inferLoreTypeFromRow(row),
      title: String(row.title ?? `Lore ${row.id}`),
      tags: String(row.tags ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      summary: String(row.summary ?? ""),
      body: String(row.body ?? "")
    }));
  } catch (err) {
    console.warn("[lore-db] lecture/recherche impossible:", err?.message ?? err);
    return [];
  }
}

function buildLoreRecordsFromTransitions() {
  const transitionsPath = path.join(
    NARRATION_MODULE_DIR,
    "runtime",
    "Transitions-v1-runtime.example.json"
  );
  if (!fs.existsSync(transitionsPath)) return [];
  try {
    const raw = fs.readFileSync(transitionsPath, "utf8");
    const parsed = JSON.parse(raw);
    const transitions = Array.isArray(parsed?.transitions) ? parsed.transitions : [];
    const recordsById = new Map();
    for (const transition of transitions) {
      const anchors = Array.isArray(transition?.loreAnchors) ? transition.loreAnchors : [];
      for (const anchor of anchors) {
        const id = String(anchor?.id ?? "").trim();
        const type = String(anchor?.type ?? "").trim();
        if (!id || !type) continue;
        if (!recordsById.has(id)) {
          recordsById.set(id, {
            id,
            type,
            title: String(anchor?.label ?? id),
            summary: `Ancre lore utilisÃ©e par ${transition.id}`,
            tags: [String(transition?.entityType ?? ""), String(transition?.toState ?? "")]
          });
        }
      }
    }
    return Array.from(recordsById.values());
  } catch {
    return [];
  }
}

function mergeLoreRecords(primary, fallback) {
  const out = [];
  const seen = new Set();
  for (const row of [...primary, ...fallback]) {
    const key = String(row?.id ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function buildLoreRecordsForQuery(query) {
  const fromDb = buildLoreRecordsFromDb(query, 8);
  const fromTransitions = buildLoreRecordsFromTransitions();
  return mergeLoreRecords(fromDb, fromTransitions);
}

function normalizeForIntent(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isLoreQuestionIntent(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  if (/^\s*(bonjour|salut|yo|coucou|hello|hey)\b/.test(normalized)) return false;
  const patterns = [
    /\bconnais\s*tu\b/,
    /\bqui\s+est\b/,
    /\bqu\s*est\s*ce\s+que\b/,
    /\bquest\s*ce\s+que\b/,
    /\bou\s+se\s+trouve\b/,
    /\bou\s+est\b/,
    /\bparle\s*(moi)?\s*de\b/,
    /\braconte\s*(moi)?\s*sur\b/,
    /\bque\s+sais\s*tu\b/,
    /\ben\s+sais\s*tu\b/,
    /\bque\s+peux\s*tu\s+me\s+dire\b/,
    /\binfo(s)?\b/,
    /\blore\b/,
    /\bhistoire\s+de\b/,
    /\borigine\s+de\b/,
    /\bcapitale\s+de\b/,
    /\bfaction\b/,
    /\bregion\b/,
    /\bville\b/
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function isFreeExplorationIntent(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  const patterns = [
    /\bje\s+veux\s+me\s+balader\b/,
    /\bje\s+me\s+balade\b/,
    /\bje\s+me\s+promene\b/,
    /\bje\s+marche\b/,
    /\bj\s+explore\b/,
    /\bje\s+regarde\s+autour\b/,
    /\bje\s+visite\b/,
    /\bje\s+deambule\b/,
    /\bje\s+me\s+rends\b/
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function isSocialActionIntent(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  const patterns = [
    /\bje\s+parle\b/,
    /\bje\s+discute\b/,
    /\bje\s+demande\b/,
    /\bje\s+negocie\b/,
    /\bje\s+persuade\b/,
    /\bje\s+convaincs\b/,
    /\bje\s+menace\b/,
    /\bje\s+questionne\b/,
    /\bje\s+marchande\b/
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function isStoryActionIntent(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  const patterns = [
    /\bj\s+accepte\b/,
    /\bje\s+refuse\b/,
    /\bje\s+suis\b/,
    /\bje\s+prends\b/,
    /\bje\s+tente\b/,
    /\bj\s+attaque\b/,
    /\bje\s+fouille\b/,
    /\bje\s+vole\b/,
    /\bje\s+crochete\b/,
    /\bje\s+declenche\b/,
    /\bje\s+decline\b/
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function isCombatActionIntent(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  const patterns = [
    /\bj\s*attaque\b/,
    /\bje\s*frappe\b/,
    /\bje\s*tire\b/,
    /\bje\s*me\s*bats\b/,
    /\bje\s*menace\b/
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function isExplicitLoreLookup(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  const patterns = [
    /\bconnais\s*tu\b/,
    /\bqui\s+est\b/,
    /\bparle\s*(moi)?\s*de\b/,
    /\bque\s+sais\s*tu\b/,
    /\ben\s+sais\s*tu\b/,
    /\blore\b/,
    /\bhistoire\s+de\b/,
    /\borigine\s+de\b/,
    /\bcapitale\s+de\b/,
    /\bfaction\b/,
    /\bregion\b/
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function isLocalNpcInteractionIntent(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  const actionPatterns = [
    /\bje\s+cherche\b/,
    /\bje\s+veux\s+trouver\b/,
    /\bje\s+veux\s+parler\b/,
    /\bje\s+parle\b/,
    /\bje\s+demande\b/,
    /\bje\s+vais\s+voir\b/,
    /\bje\s+regarde\b/
  ];
  const actorPatterns = [
    /\bgerant(e)?\b/,
    /\baubergiste\b/,
    /\btavernier(e)?\b/,
    /\bpatron(ne)?\b/,
    /\bserveur(se)?\b/,
    /\bmarchand(e)?\b/,
    /\bgarde\b/,
    /\bclient(e)?\b/,
    /\bpnj\b/
  ];
  return actionPatterns.some((pattern) => pattern.test(normalized)) &&
    actorPatterns.some((pattern) => pattern.test(normalized));
}

function shouldForceSceneLocalRouting({ message, conversationMode, worldState }) {
  if (String(conversationMode ?? "rp") !== "rp") return false;
  const normalized = normalizeForIntent(message);
  if (!normalized || normalized.startsWith("/")) return false;
  if (isExplicitLoreLookup(normalized)) return false;
  if (!isLocalNpcInteractionIntent(normalized)) return false;

  const locationLabel = String(worldState?.location?.label ?? "").trim();
  const activeInterlocutor = String(worldState?.conversation?.activeInterlocutor ?? "").trim();
  const inGroundedScene = Boolean(locationLabel) || Boolean(activeInterlocutor);
  return inGroundedScene;
}

function classifyNarrationIntent(message) {
  const text = String(message ?? "").trim();
  if (!text) {
    return {
      type: "story_action",
      confidence: 0.2,
      requiresCheck: true,
      riskLevel: "medium",
      reason: "empty-fallback"
    };
  }

  if (text.startsWith("/")) {
    return {
      type: "system_command",
      confidence: 1,
      requiresCheck: false,
      riskLevel: "none",
      reason: "slash-command"
    };
  }

  if (isLoreQuestionIntent(text)) {
    return {
      type: "lore_question",
      confidence: 0.95,
      requiresCheck: false,
      riskLevel: "none",
      reason: "lore-pattern"
    };
  }

  if (isSocialActionIntent(text)) {
    return {
      type: "social_action",
      confidence: 0.8,
      requiresCheck: true,
      riskLevel: "medium",
      reason: "social-pattern"
    };
  }

  if (isFreeExplorationIntent(text)) {
    return {
      type: "free_exploration",
      confidence: 0.85,
      requiresCheck: false,
      riskLevel: "low",
      reason: "exploration-pattern"
    };
  }

  if (isStoryActionIntent(text)) {
    return {
      type: "story_action",
      confidence: 0.75,
      requiresCheck: true,
      riskLevel: "high",
      reason: "action-pattern"
    };
  }

  return {
    type: "story_action",
    confidence: 0.55,
    requiresCheck: true,
    riskLevel: "medium",
    reason: "default-fallback"
  };
}

const narrationAiHelpers = createNarrationAiHelpers({
  callOpenAiJson,
  normalizeForIntent,
  clampNumber,
  aiEnabled: Boolean(OPENAI_API_KEY),
  resolveModel: () =>
    process.env.NARRATION_DIRECTOR_MODEL ||
    process.env.NARRATION_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini",
  warn: (...args) => console.warn(...args)
});

const shouldApplyRuntimeForIntent = (message, intent) =>
  narrationAiHelpers.shouldApplyRuntimeForIntent(message, intent);

const classifyNarrationWithAI = (message, records, worldState) =>
  narrationAiHelpers.classifyNarrationWithAI(message, records, worldState);

const buildNarrativeDirectorPlan = (intent) =>
  narrationAiHelpers.buildNarrativeDirectorPlan(intent);

const generateMjStructuredReply = (payload) =>
  narrationAiHelpers.generateMjStructuredReply(payload);

const refineMjStructuredReplyWithTools = (payload) =>
  narrationAiHelpers.refineMjStructuredReplyWithTools(payload);

function oneLine(value, maxLen = 220) {
  const clean = repairPotentialMojibake(String(value ?? "")).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length <= maxLen ? clean : `${clean.slice(0, maxLen - 3)}...`;
}

function countMojibakeMarkers(text) {
  return (String(text ?? "").match(/[ÃÂ�]/g) ?? []).length;
}

function repairPotentialMojibake(value) {
  const text = String(value ?? "");
  if (!text) return "";
  if (!/[ÃÂ�]/.test(text)) return text;
  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    if (!repaired || repaired.includes("\u0000")) return text;
    return countMojibakeMarkers(repaired) < countMojibakeMarkers(text) ? repaired : text;
  } catch {
    return text;
  }
}

function isTechnicalLoreRecord(record) {
  const title = String(record?.title ?? "").toLowerCase().trim();
  const summary = String(record?.summary ?? "").toLowerCase().trim();
  const technicalTitle =
    title.startsWith("quete.") ||
    title.startsWith("quest.") ||
    title.startsWith("trama.") ||
    title.startsWith("trade.") ||
    title.startsWith("companion.");
  const technicalSummary =
    summary.includes("ancre lore utilisee par") ||
    summary.includes("ancre lore utilisée par") ||
    summary.includes("ancre lore utilis");
  return technicalTitle || technicalSummary;
}

function playerFacingLoreRecords(records, max = 4) {
  if (!Array.isArray(records)) return [];
  return records.filter((record) => !isTechnicalLoreRecord(record)).slice(0, max);
}

function formatFrenchList(values) {
  const list = values.map((x) => String(x).trim()).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} et ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}`;
}

function buildMjReplyBlocks({ scene, actionResult, consequences, options }) {
  const normalizedOptions = normalizeMjOptions(options, 4);

  const safeOptions = normalizedOptions.length
    ? normalizedOptions
    : [
        "Examiner un detail precis de la scene",
        "Interagir avec un PNJ",
        "Tenter une action engagee"
      ];

  return [
    oneLine(scene, 260) || "La scene evolue sans rupture visible.",
    oneLine(actionResult, 320) || "Ton action est prise en compte par le MJ.",
    oneLine(consequences, 320) || "Aucune consequence majeure immediate.",
    `Tu peux maintenant: ${safeOptions.join(" | ")}`
  ].join("\n");
}

function buildMjReplyFromStructured(structured) {
  const safe = structured && typeof structured === "object" ? structured : {};
  const directAnswer = oneLine(String(safe.directAnswer ?? ""), 220);
  const scene = oneLine(String(safe.scene ?? ""), 260) || "La scene evolue sans rupture visible.";
  const actionResult = oneLine(String(safe.actionResult ?? ""), 320) || "Le MJ maintient la scene et la coherence du contexte.";
  const consequences = oneLine(String(safe.consequences ?? ""), 320) || "Aucune consequence majeure immediate.";
  const options = normalizeMjOptions(safe.options, 4);
  const blocks = buildMjReplyBlocks({ scene, actionResult, consequences, options });
  return directAnswer ? `${directAnswer}\n${blocks}` : blocks;
}

function makeMjResponse({
  responseType = "narration",
  directAnswer = "",
  scene = "",
  actionResult = "",
  consequences = "",
  options = []
}) {
  return {
    responseType: String(responseType || "narration"),
    directAnswer: String(directAnswer ?? ""),
    scene: String(scene ?? ""),
    actionResult: String(actionResult ?? ""),
    consequences: String(consequences ?? ""),
    options: normalizeMjOptions(options, 6)
  };
}

function isSelfIdentityQuestion(message) {
  const normalized = normalizeForIntent(message);
  return (
    /\bqui\s+suis\s*je\b/.test(normalized) ||
    /\bqui\s+je\s+suis\b/.test(normalized) ||
    /\bquel\s+est\s+mon\s+nom\b/.test(normalized) ||
    /\bparle\s*(moi)?\s*de\s*moi\b/.test(normalized)
  );
}

function buildLoreOnlyReply(message, records, characterProfile = null) {
  const safeProfile = sanitizeCharacterProfile(characterProfile);
  if (isSelfIdentityQuestion(message) && safeProfile) {
    const skillText =
      Array.isArray(safeProfile.skills) && safeProfile.skills.length
        ? safeProfile.skills.slice(0, 4).join(", ")
        : "aucune competence marquee";
    return buildMjReplyBlocks({
      scene: "Tu consultes les registres des Archives a ton sujet.",
      actionResult: `Tu es ${safeProfile.name}, ${safeProfile.race}, ${safeProfile.classLabel}.`,
      consequences: `Base roleplay activee. Competences de reference: ${skillText}.`,
      options: [
        "Demander ce que les Archives savent sur ta faction",
        "Demander ton objectif immediat",
        "Passer a une action en jeu"
      ]
    });
  }

  const top = Array.isArray(records) ? records.slice(0, 3) : [];
  if (!top.length) {
    return buildMjReplyBlocks({
      scene: "Tu cherches des informations dans les memoires du monde.",
      actionResult: `Aucune entree lore claire n'a ete trouvee pour "${message}".`,
      consequences: "Le monde ne change pas, mais la recherche reste ouverte.",
      options: [
        "Donner un nom de lieu ou de faction plus precis",
        "Demander un resume historique cible",
        "Basculer vers une action en jeu"
      ]
    });
  }

  const best = top[0];
  const title = oneLine(best?.title ?? "Entree sans titre", 90);
  const summary = oneLine(best?.summary ?? best?.body ?? "", 170);

  return buildMjReplyBlocks({
    scene: "Tu fais appel a des fragments de lore lies a ta question.",
    actionResult: summary
      ? `${title}: ${summary}`
      : `Information principale identifiee: ${title}.`,
    consequences: `Aucune transition systeme n'est appliquee. ${top.length > 1 ? `${top.length - 1} autre(s) source(s) restent consultables.` : "Contexte memorise pour la suite."}`,
    options: [
      "Approfondir ce point en detail",
      "Demander comment ce lore influence ta situation",
      "Passer a une action dans le monde"
    ]
  });
}

function buildExplorationReply(message, records) {
  const top = playerFacingLoreRecords(records, 4);
  if (!top.length) {
    return [
      "Tu explores les environs, mais l'atmosphere reste calme.",
      `Ton deplacement (${oneLine(message, 80)}) ne declenche aucun evenement majeur.`
    ].join("\n");
  }

  const nearbyPlaces = top
    .filter((record) => String(record?.type ?? "").toLowerCase() === "lieu")
    .map((record) => oneLine(record?.title ?? "", 60))
    .filter(Boolean);
  const nearbyEntities = top
    .map((record) => oneLine(record?.title ?? "", 60))
    .filter(Boolean)
    .slice(0, 4);

  const bestContextRecord =
    top.find((record) => String(record?.type ?? "").toLowerCase() === "lieu") ?? top[0];
  const contextHint = oneLine(bestContextRecord?.summary ?? bestContextRecord?.body ?? "", 140);
  const placesLabel = formatFrenchList(nearbyPlaces.slice(0, 3));
  const entitiesLabel = formatFrenchList(nearbyEntities.slice(0, 3));
  const contextualSummary =
    isTechnicalLoreRecord(bestContextRecord) || /ancre lore/i.test(contextHint)
      ? "Le quartier s'anime autour de toi: etales, passants, rumeurs et regards attentifs."
      : contextHint;

  const scene = placesLabel
    ? `En regardant autour de toi, tu reperes surtout ${placesLabel}.`
    : entitiesLabel
      ? `En regardant autour de toi, tu reperes des figures locales: ${entitiesLabel}.`
      : "En regardant autour de toi, tu identifies quelques points d'interet locaux.";
  const detail =
    contextualSummary ||
    "Tu reperes des elements utiles du quartier, sans declencher d'evenement immediat.";
  return [scene, detail].join("\n");
}

function slugifyText(value) {
  return normalizeForIntent(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeDestinationCandidate(value) {
  const raw = String(value ?? "")
    .replace(/\b(si|s'il)\s+.*$/i, "")
    .replace(/\b(stp|svp|merci|maintenant|ici)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const withoutDeterminer = raw.replace(/^(le|la|les|un|une|des)\s+/i, "").trim();
  return withoutDeterminer || raw;
}

function isGenericPlaceLabel(label) {
  const normalized = normalizeForIntent(label);
  if (!normalized) return true;
  const generic = new Set([
    "quartier",
    "ville",
    "zone",
    "lieu",
    "endroit",
    "secteur",
    "coin",
    "port",
    "centre",
    "ici",
    "la bas",
    "par la",
    "ce lieu"
  ]);
  return generic.has(normalized);
}

function inferPlaceFromMessage(message, records) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return "";
  if (/\bport\b/.test(normalized)) {
    const portRecord = playerFacingLoreRecords(records, 8).find((entry) => {
      const title = normalizeForIntent(entry?.title ?? "");
      const summary = normalizeForIntent(entry?.summary ?? entry?.body ?? "");
      return /\bport\b/.test(title) || /\bport\b/.test(summary);
    });
    if (portRecord?.title) return oneLine(String(portRecord.title), 72);
  }
  const patterns = [
    /\b(?:visiter|visite|voir|explorer|aller(?:\s+vers)?|me\s+rendre(?:\s+vers)?|acceder|entrer(?:\s+dans)?|passer\s+par)\s+(?:aux|au|a la|a l'|dans|vers|sur|en)?\s*([a-z0-9' -]{3,72})/,
    /\b(?:du|de la|de l'|des)\s+([a-z0-9' -]{3,72})/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const candidate = normalizeDestinationCandidate(String(match[1] ?? ""));
    if (candidate.length >= 3 && !isGenericPlaceLabel(candidate)) return toTitleCase(candidate);
  }
  const firstPlace = playerFacingLoreRecords(records, 4)
    .find((entry) => String(entry?.type ?? "").toLowerCase() === "lieu");
  if (firstPlace?.title) return oneLine(String(firstPlace.title), 72);
  return "";
}

function extractVisitIntent(message, records) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return null;
  const referencesMove =
    /\b(visiter|visite|aller|rendre|acceder|entrer|explorer|deplacer|m approcher|me rapprocher)\b/.test(normalized);
  if (!referencesMove) return null;
  const isQuestion =
    message.includes("?") ||
    /\b(puis je|je peux|est ce que je peux|possible|peut on|est ce possible)\b/.test(normalized) ||
    /\b(j aimerais|j aimerai|je veux|je voudrais|j aimerais bien)\b/.test(normalized);
  if (!isQuestion) return null;
  const placeLabel = inferPlaceFromMessage(message, records);
  return {
    type: "visit_question",
    placeLabel: placeLabel || "ce lieu"
  };
}

function isTravelConfirmation(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  const yes = /\b(oui|ok|d accord|ca marche|allons y|j y vais|je veux y aller|je confirme|go)\b/.test(
    normalized
  );
  const move = /\b(y aller|aller|me rendre|deplacer|on y va|j y vais)\b/.test(normalized);
  return yes || move;
}

function formatWorldTimeShort(time) {
  const safe = normalizeWorldTime(time);
  return `J${safe.day} ${String(safe.hour).padStart(2, "0")}:${String(safe.minute).padStart(2, "0")} (${safe.label})`;
}

function advanceWorldTimeByMinutes(currentTime, minutes) {
  const base = normalizeWorldTime(currentTime);
  const delta = Math.max(0, Math.floor(Number(minutes) || 0));
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

function estimateTravelMinutes(fromLocation, toLocation, intentType = "story_action") {
  const fromId = String(fromLocation?.id ?? "").trim();
  const toId = String(toLocation?.id ?? "").trim();
  if (!fromId || !toId) return 3;
  if (fromId === toId) return 1;
  if (intentType === "free_exploration") return 4;
  return 3;
}

function applyTravel(worldState, travelSpec) {
  const safe = worldState && typeof worldState === "object" ? worldState : createInitialNarrativeWorldState();
  const from = sanitizeWorldLocation(travelSpec?.from ?? safe?.location);
  const to = sanitizeWorldLocation(travelSpec?.to ?? safe?.location);
  const durationMin = Math.max(1, Math.floor(Number(travelSpec?.durationMin) || 3));
  const reason = String(travelSpec?.reason ?? "travel-applied");
  return {
    ...safe,
    time: advanceWorldTimeByMinutes(safe?.time, durationMin),
    location: to,
    travel: {
      pending: null,
      last: {
        from,
        to,
        durationMin,
        appliedAt: new Date().toISOString(),
        reason
      }
    }
  };
}

function derivePlaceMetadataFromRecords(placeLabel, records) {
  const labelNormalized = normalizeForIntent(placeLabel);
  const candidates = playerFacingLoreRecords(records, 8).filter((record) => {
    const title = normalizeForIntent(record?.title ?? "");
    if (!title) return false;
    return title.includes(labelNormalized) || labelNormalized.includes(title);
  });
  const top = candidates[0] ?? null;
  const textBlob = normalizeForIntent(
    [
      top?.summary ?? "",
      top?.body ?? "",
      ...candidates.map((entry) => entry?.summary ?? "")
    ].join(" ")
  );

  const tags = new Set();
  candidates.forEach((entry) => {
    const t = String(entry?.type ?? "").trim().toLowerCase();
    if (t) tags.add(t);
  });
  if (/\barchive|bibliothe|registre|savoir|memoire\b/.test(textBlob)) tags.add("savoir");
  if (/\bmarche|etale|commerce|negoc|marchand\b/.test(textBlob)) tags.add("commerce");
  if (/\bgarde|milice|patrouille|controle\b/.test(textBlob)) tags.add("securite");
  if (/\bfaction|culte|ordre|primaut|guilde\b/.test(textBlob)) tags.add("faction");

  const riskFlags = new Set();
  if (/\bgarde|patrouille|controle|milice\b/.test(textBlob)) riskFlags.add("guarded");
  if (/\bmagie|rune|scelle|scellee|protection\b/.test(textBlob)) riskFlags.add("arcane-ward");
  if (/\bfoule|dense|agite|emeute\b/.test(textBlob)) riskFlags.add("crowded");

  let access = "public";
  if (/\bscelle|scellee|interdit total|impenetrable\b/.test(textBlob)) access = "sealed";
  else if (/\brestreint|reserve|controle|autorisation\b/.test(textBlob)) access = "restricted";

  const sources = candidates
    .map((entry) => String(entry?.id ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    summary: oneLine(String(top?.summary ?? top?.body ?? ""), 220),
    city: "",
    access,
    tags: Array.from(tags).slice(0, 8),
    riskFlags: Array.from(riskFlags).slice(0, 8),
    sources
  };
}

function upsertSessionPlace(sessionPlaces, placePatch) {
  const list = sanitizeSessionPlaces(sessionPlaces);
  const patch = placePatch && typeof placePatch === "object" ? placePatch : {};
  const patchId = String(patch.id ?? "").trim();
  const patchLabel = String(patch.label ?? "").trim();
  if (!patchId || !patchLabel) return list;
  const index = list.findIndex((entry) => entry.id === patchId || normalizeForIntent(entry.label) === normalizeForIntent(patchLabel));
  const now = new Date().toISOString();
  const incoming = sanitizeSessionPlaces([
    {
      id: patchId,
      label: patchLabel,
      city: String(patch.city ?? "").trim(),
      access: String(patch.access ?? "public"),
      tags: Array.isArray(patch.tags) ? patch.tags : [],
      riskFlags: Array.isArray(patch.riskFlags) ? patch.riskFlags : [],
      sources: Array.isArray(patch.sources) ? patch.sources : [],
      summary: String(patch.summary ?? "").trim(),
      createdAt: String(patch.createdAt ?? now),
      updatedAt: now
    }
  ])[0];
  if (!incoming) return list;
  if (index < 0) return [...list, incoming].slice(-80);
  const base = list[index];
  const merged = {
    ...base,
    ...incoming,
    summary: incoming.summary || base.summary || "",
    city: incoming.city || base.city || "",
    tags: Array.from(new Set([...(base.tags ?? []), ...(incoming.tags ?? [])])).slice(0, 12),
    riskFlags: Array.from(new Set([...(base.riskFlags ?? []), ...(incoming.riskFlags ?? [])])).slice(0, 12),
    sources: Array.from(new Set([...(base.sources ?? []), ...(incoming.sources ?? [])])).slice(0, 12),
    access:
      incoming.access === "sealed" || base.access === "sealed"
        ? "sealed"
        : incoming.access === "restricted" || base.access === "restricted"
          ? "restricted"
          : "public",
    createdAt: base.createdAt || incoming.createdAt,
    updatedAt: now
  };
  const next = [...list];
  next[index] = merged;
  return next.slice(-80);
}

function resolveOrCreateSessionPlace(placeLabel, records, worldState) {
  const label = String(placeLabel ?? "").trim() || "Lieu sans nom";
  const slug = slugifyText(label) || "lieu";
  const existing = sanitizeSessionPlaces(worldState?.sessionPlaces).find(
    (entry) => normalizeForIntent(entry.label) === normalizeForIntent(label)
  );
  if (existing) {
    return {
      id: existing.id,
      label: existing.label,
      city: existing.city || "",
      access: existing.access || "public",
      tags: Array.isArray(existing.tags) ? existing.tags : [],
      riskFlags: Array.isArray(existing.riskFlags) ? existing.riskFlags : [],
      sources: Array.isArray(existing.sources) ? existing.sources : [],
      summary: existing.summary || ""
    };
  }
  const byLore = playerFacingLoreRecords(records, 6).find((record) => {
    const title = normalizeForIntent(record?.title ?? "");
    return title && (title.includes(normalizeForIntent(label)) || normalizeForIntent(label).includes(title));
  });
  const metadata = derivePlaceMetadataFromRecords(label, records);
  if (byLore) {
    return {
      id: String(byLore.id ?? `lore:${slug}`),
      label: oneLine(String(byLore.title ?? label), 80),
      city: "",
      access: metadata.access,
      tags: metadata.tags,
      riskFlags: metadata.riskFlags,
      sources: metadata.sources.length ? metadata.sources : [String(byLore.id ?? "")].filter(Boolean),
      summary: oneLine(String(byLore.summary ?? byLore.body ?? ""), 220)
    };
  }
  return {
    id: `session:${slug}`,
    label: toTitleCase(label),
    city: metadata.city || "",
    access: metadata.access || "public",
    tags: metadata.tags,
    riskFlags: metadata.riskFlags,
    sources: metadata.sources,
    summary: metadata.summary || ""
  };
}

function buildVisitAdvisoryReply(place, records, worldState) {
  const placeLabel = oneLine(String(place?.label ?? "ce lieu"), 80);
  const recordHint = playerFacingLoreRecords(records, 4).find(
    (entry) => normalizeForIntent(entry?.title ?? "") === normalizeForIntent(placeLabel)
  );
  const hint = oneLine(String(recordHint?.summary ?? place?.summary ?? ""), 150);
  const access = String(place?.access ?? "public");
  const riskFlags = Array.isArray(place?.riskFlags) ? place.riskFlags : [];
  const accessHint =
    access === "sealed"
      ? "Acces scelle: entree interdite sans moyen exceptionnel."
      : access === "restricted"
        ? "Acces restreint: controle probable a l'entree."
        : "Acces public probable, avec controles ponctuels.";
  const riskHint = riskFlags.length ? `Risques detectes: ${riskFlags.slice(0, 3).join(", ")}.` : "";
  const advisory = hint
    ? `Tu peux t'y rendre. D'apres les infos locales: ${hint}`
    : "Tu peux t'y rendre, mais l'acces peut etre partiel selon les zones et les gardes.";
  return [
    `Tu peux te rendre vers ${placeLabel}.`,
    `${advisory} ${accessHint}`.trim(),
    `${riskHint} Si tu veux, je lance le deplacement maintenant.`.trim()
  ].join("\n");
}

function describeTimeAtmosphere(worldState) {
  const label = String(worldState?.time?.label ?? "");
  if (label.includes("nuit")) return "La lumiere baisse, les ombres allongent les angles et les voix portent plus loin.";
  if (label.includes("matin")) return "L'air est net, les rues s'ouvrent progressivement avec les premiers allers-retours.";
  if (label.includes("midi")) return "Le rythme est dense, les allées sont traversées par un flux constant.";
  if (label.includes("fin d'apres-midi") || label.includes("fin d'après-midi")) {
    return "La foule commence a se tasser, mais les points centraux restent animés.";
  }
  return "La lumiere de milieu d'apres-midi souligne les details du lieu et les mouvements de foule.";
}

function describeTensionAtmosphere(worldState) {
  const tension = Number(worldState?.metrics?.localTension ?? 0);
  if (tension >= 70) return "L'atmosphere est tendue: regards lourds, patrouilles visibles, reactions rapides.";
  if (tension >= 40) return "Une nervosite diffuse circule dans le quartier, sans basculer en crise ouverte.";
  if (tension >= 20) return "Le climat reste vigilant, avec des controles discrets.";
  return "Le climat local reste relativement stable.";
}

function describeAccessAndRisks(place) {
  const access = String(place?.access ?? "public");
  const riskFlags = Array.isArray(place?.riskFlags) ? place.riskFlags : [];
  const constraints = [];
  if (access === "sealed") constraints.push("zones scellees inaccessibles sans moyen exceptionnel");
  if (access === "restricted") constraints.push("acces controle sur certaines sections");
  if (riskFlags.includes("guarded")) constraints.push("presence de gardes");
  if (riskFlags.includes("arcane-ward")) constraints.push("protections arcaniques detectables");
  if (riskFlags.includes("crowded")) constraints.push("forte densite de foule");
  return constraints.length
    ? `Contraintes en place: ${constraints.slice(0, 3).join(", ")}.`
    : "Aucune contrainte majeure n'est visible immediatement.";
}

function buildArrivalVisualCue(place, records) {
  const tags = Array.isArray(place?.tags) ? place.tags.map((tag) => normalizeForIntent(tag)) : [];
  const top = playerFacingLoreRecords(records, 4)[0];
  const loreHint = oneLine(String(top?.summary ?? ""), 120);
  if (tags.includes("savoir")) {
    return "Des facades massives, des inscriptions anciennes et des files silencieuses structurent l'entree.";
  }
  if (tags.includes("commerce")) {
    return "Etals, appels de vendeurs et circulation serree composent une scene vivante et bruyante.";
  }
  if (tags.includes("securite")) {
    return "Postes de controle, lignes de vue degagees et rondes reglees donnent le ton du secteur.";
  }
  return loreHint || "Le decor se precise: architecture locale, circulation, micro-scenes entre habitants.";
}

function buildArrivalPlaceReply(place, records, worldState) {
  const placeLabel = oneLine(String(place?.label ?? "ce lieu"), 80);
  const contextRecords = playerFacingLoreRecords(records, 5).filter((entry) => {
    const title = normalizeForIntent(entry?.title ?? "");
    return title && (title.includes(normalizeForIntent(placeLabel)) || normalizeForIntent(placeLabel).includes(title));
  });
  const top = contextRecords[0] ?? null;
  const sceneHint = oneLine(String(top?.summary ?? place?.summary ?? ""), 180);
  const others = contextRecords
    .slice(1, 4)
    .map((entry) => oneLine(String(entry?.title ?? ""), 40))
    .filter(Boolean);
  const visualCue = buildArrivalVisualCue(place, records);
  const timeAtmosphere = describeTimeAtmosphere(worldState);
  const tensionAtmosphere = describeTensionAtmosphere(worldState);
  const constraints = describeAccessAndRisks(place);
  const activeInterlocutor =
    worldState?.conversation?.activeInterlocutor == null
      ? ""
      : String(worldState.conversation.activeInterlocutor);
  const interlocutorHook = activeInterlocutor
    ? `Ton interlocuteur actif reste ${activeInterlocutor}.`
    : "Aucun interlocuteur n'est actif pour l'instant.";
  return buildMjReplyBlocks({
    scene: `Apres 3 minutes de marche, tu arrives a ${placeLabel}.`,
    actionResult: [visualCue, sceneHint, timeAtmosphere].filter(Boolean).join(" "),
    consequences: `${constraints} ${tensionAtmosphere} ${interlocutorHook} Position mise a jour: ${placeLabel}. Horloge monde: ${formatWorldTimeShort(worldState?.time)}.`.trim(),
    options: [
      "Examiner un detail du lieu",
      others.length ? `Interagir avec ${others[0]}` : "Interagir avec une presence locale",
      "Declencher une action narrative dans ce lieu"
    ]
  });
}

function getCurrentSessionPlace(worldState) {
  const current = sanitizeWorldLocation(worldState?.location);
  const places = sanitizeSessionPlaces(worldState?.sessionPlaces);
  const found = places.find((entry) => entry.id === current.id) ?? null;
  if (found) return found;
  return {
    id: current.id,
    label: current.label,
    access: "public",
    tags: [],
    riskFlags: [],
    sources: [],
    summary: ""
  };
}

function isAccessProgressionIntent(message) {
  const text = normalizeForIntent(message);
  if (!text) return false;
  return (
    /\b(entrer|acceder|franchir|passer|forcer|ouvrir|aller plus loin|zone|section|salle reservee|partie reservee|interdite)\b/.test(
      text
    ) ||
    /\b(je veux entrer|je vais entrer|laisse moi entrer)\b/.test(text)
  );
}

function inferAccessApproach(message, rpContextPack) {
  const text = normalizeForIntent(message);
  const approaches = new Set();
  if (/\b(parler|negocier|persuad|demander|autorisation|laissez[- ]passer|registre)\b/.test(text)) {
    approaches.add("social");
  }
  if (/\b(discret|furtif|infiltr|cache|silenc|detour|toit|ruelle)\b/.test(text)) {
    approaches.add("infiltration");
  }
  if (/\b(sort|rune|magie|illusion|enchant|arcane)\b/.test(text)) {
    approaches.add("arcane");
  }
  if (/\b(force|forcer|casser|enfoncer|brutal)\b/.test(text)) {
    approaches.add("force");
  }
  if (/\b(creatif|autre idee|improvis|ruse|plan)\b/.test(text)) {
    approaches.add("creative");
  }

  const skills = Array.isArray(rpContextPack?.rules?.skills) ? rpContextPack.rules.skills : [];
  const skillSignals = skills
    .map((skill) => String(skill ?? ""))
    .filter(Boolean)
    .filter((skill) => text.includes(normalizeForIntent(skill)))
    .slice(0, 3);
  if (skillSignals.length) approaches.add("skill-driven");

  return {
    approaches: Array.from(approaches),
    skillSignals
  };
}

function buildAccessChallengeReply(place, message, rpContextPack, worldState) {
  const placeLabel = oneLine(String(place?.label ?? "cette zone"), 80);
  const access = String(place?.access ?? "public");
  const riskFlags = Array.isArray(place?.riskFlags) ? place.riskFlags : [];
  const analysis = inferAccessApproach(message, rpContextPack);
  const constraint =
    access === "sealed"
      ? "La zone semble scellee: acces exceptionnel requis."
      : access === "restricted"
        ? "La zone est restreinte: justification ou methode solide necessaire."
        : "La zone est globalement accessible, avec quelques controles.";
  const risks = riskFlags.length ? `Risques visibles: ${riskFlags.slice(0, 3).join(", ")}.` : "";
  const leverage =
    analysis.skillSignals.length > 0
      ? `Leviers detectes dans ta formulation: ${analysis.skillSignals.join(", ")}.`
      : "Tu peux proposer n'importe quelle approche credible, meme non standard.";

  return buildMjReplyBlocks({
    scene: `Tu arrives a un point de controle vers ${placeLabel}.`,
    actionResult: `${constraint} ${risks}`.trim(),
    consequences: `${leverage} Decris ton plan et je l'arbitre sans te limiter a un schema fixe.`.trim(),
    options: [
      "Proposer une approche creative libre",
      "Demander une autorisation ou un appui local",
      "Tenter un passage discret ou indirect"
    ]
  });
}

function resolveAccessAttempt(message, pendingAccess, rpContextPack, worldState) {
  const text = normalizeForIntent(message);
  const access = String(pendingAccess?.access ?? "restricted");
  const risks = Array.isArray(pendingAccess?.riskFlags) ? pendingAccess.riskFlags : [];
  const analysis = inferAccessApproach(message, rpContextPack);
  const hasMethod = analysis.approaches.length > 0 || text.split(/\s+/).length >= 8;
  const localTension = Number(worldState?.metrics?.localTension ?? 0);

  let difficulty = access === "sealed" ? 4 : access === "restricted" ? 2 : 1;
  if (risks.includes("guarded")) difficulty += 1;
  if (risks.includes("arcane-ward")) difficulty += 1;
  if (localTension >= 60) difficulty += 1;

  let score = 1;
  if (hasMethod) score += 1;
  score += Math.min(3, analysis.approaches.length);
  score += Math.min(2, analysis.skillSignals.length);
  if (/\b(plan|etape|d abord|ensuite|pendant)\b/.test(text)) score += 1;
  if (/\baide|allie|contact|registre|autorisation\b/.test(text)) score += 1;
  if (/\bimprovise|creatif|ruse\b/.test(text)) score += 1;
  if (localTension >= 75) score -= 1;

  const success = score >= difficulty + 2;
  const partial = !success && score >= difficulty;

  const placeLabel = oneLine(String(pendingAccess?.placeLabel ?? "la zone"), 80);
  if (success) {
    return {
      success: true,
      worldDelta: { reputationDelta: 1, localTensionDelta: 0, reason: "access-success" },
      reply: buildMjReplyBlocks({
        scene: `Ton plan fonctionne et tu franchis le controle vers ${placeLabel}.`,
        actionResult: "Passage accorde sans escalade majeure. Ta methode est jugee credible dans ce contexte.",
        consequences: "Acces valide. Ton initiative est retenue positivement par le contexte local.",
        options: [
          "Observer immediatement l'interieur",
          "Approcher un PNJ present",
          "Continuer vers un objectif precis"
        ]
      })
    };
  }

  if (partial) {
    return {
      success: true,
      worldDelta: { reputationDelta: 0, localTensionDelta: 1, reason: "access-partial" },
      reply: buildMjReplyBlocks({
        scene: `Tu obtiens un passage partiel vers ${placeLabel}.`,
        actionResult: "Le controle passe, mais sous conditions: zone limitee, surveillance accrue ou delai court.",
        consequences: "Tu avances, mais la tension locale augmente legerement.",
        options: [
          "Respecter les conditions et progresser",
          "Renforcer ta couverture narrative",
          "Changer de cible a l'interieur"
        ]
      })
    };
  }

  return {
    success: false,
    worldDelta: { reputationDelta: -1, localTensionDelta: 2, reason: "access-blocked" },
    reply: buildMjReplyBlocks({
      scene: `Ton approche ne suffit pas pour franchir ${placeLabel} dans ces conditions.`,
      actionResult: "Le controle se durcit. Ce n'est pas un non definitif, mais il faut une autre methode.",
      consequences: "Refus temporaire et vigilance accrue autour de toi.",
      options: [
        "Proposer une nouvelle approche creative",
        "Chercher un soutien local ou un justificatif",
        "Reporter et revenir avec de meilleurs leviers"
      ]
    })
  };
}

const RULE_SKILL_ABILITY_MAP = {
  athletisme: "FOR",
  acrobaties: "DEX",
  escamotage: "DEX",
  discretion: "DEX",
  arcanes: "INT",
  histoire: "INT",
  investigation: "INT",
  nature: "INT",
  religion: "INT",
  intuition: "SAG",
  medecine: "SAG",
  perception: "SAG",
  survie: "SAG",
  dressage: "SAG",
  intimidation: "CHA",
  persuasion: "CHA",
  tromperie: "CHA",
  representation: "CHA"
};

const RULE_SKILL_LABELS = {
  athletisme: "Athletisme",
  acrobaties: "Acrobaties",
  escamotage: "Escamotage",
  discretion: "Discretion",
  arcanes: "Arcanes",
  histoire: "Histoire",
  investigation: "Investigation",
  nature: "Nature",
  religion: "Religion",
  intuition: "Intuition",
  medecine: "Medecine",
  perception: "Perception",
  survie: "Survie",
  dressage: "Dressage",
  intimidation: "Intimidation",
  persuasion: "Persuasion",
  tromperie: "Tromperie",
  representation: "Representation"
};

function signedValue(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "+0";
  return numeric >= 0 ? `+${numeric}` : String(numeric);
}

function computeAbilityModFromScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.floor((numeric - 10) / 2);
}

function getAbilityModFromProfile(profile, ability) {
  const safeAbility = String(ability ?? "").toUpperCase();
  const source = profile?.caracs?.[safeAbility];
  if (source && Number.isFinite(Number(source.mod))) {
    return Number(source.mod);
  }
  if (source && Number.isFinite(Number(source.score))) {
    return computeAbilityModFromScore(Number(source.score));
  }
  return 0;
}

function resolveProficiencyBonus(profile) {
  const provided = Number(profile?.proficiencyBonus ?? 0);
  if (Number.isFinite(provided) && provided > 0) return provided;
  const level = Number(profile?.classEntries?.[0]?.niveau ?? 0);
  if (!Number.isFinite(level) || level <= 0) return 2;
  if (level <= 4) return 2;
  if (level <= 8) return 3;
  if (level <= 12) return 4;
  if (level <= 16) return 5;
  return 6;
}

const characterContextHelpers = createCharacterContextHelpers({
  sanitizeCharacterProfile,
  resolveCharacterDataByIds,
  resolveProficiencyBonus,
  getAbilityModFromProfile,
  resolveItemDataById
});

const buildCharacterContextPack = (characterProfile, worldState) =>
  characterContextHelpers.buildCharacterContextPack(characterProfile, worldState);

const buildCharacterContextDiagnostics = (characterProfile, worldState) =>
  characterContextHelpers.buildCharacterContextDiagnostics(characterProfile, worldState);

const mjToolBus = createMjToolBus({
  queryLore: (query, limit = 3) =>
    buildLoreRecordsForQuery(String(query ?? ""))
      .slice(0, Math.max(1, Math.min(8, Number(limit) || 3)))
});

const hrpAiInterpreter = createHrpAiInterpreter({
  callOpenAiJson,
  aiEnabled: Boolean(OPENAI_API_KEY),
  resolveModel: () =>
    process.env.HRP_INTERPRETER_MODEL ||
    process.env.NARRATION_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini",
  warn: (...args) => console.warn(...args)
});

const rpActionValidator = createRpActionValidator({
  callOpenAiJson,
  aiEnabled: Boolean(OPENAI_API_KEY),
  normalizeForIntent,
  resolveModel: () =>
    process.env.RP_ACTION_VALIDATOR_MODEL ||
    process.env.NARRATION_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini",
  warn: (...args) => console.warn(...args)
});

const rpActionResolver = createRpActionResolver({
  normalizeForIntent
});

function buildRuleSnapshot(profile) {
  const safe = sanitizeCharacterProfile(profile);
  if (!safe) return null;
  const proficiencyBonus = resolveProficiencyBonus(safe);
  const expertiseSet = new Set(
    (Array.isArray(safe.expertises) ? safe.expertises : [])
      .map((skill) => normalizeForIntent(skill))
      .filter(Boolean)
  );
  const profSet = new Set(
    (Array.isArray(safe.skills) ? safe.skills : [])
      .map((skill) => normalizeForIntent(skill))
      .filter(Boolean)
  );
  const skillRows = Object.entries(RULE_SKILL_ABILITY_MAP).map(([skillId, ability]) => {
    const isProficient = profSet.has(skillId) || expertiseSet.has(skillId);
    const isExpertise = expertiseSet.has(skillId);
    const abilityMod = getAbilityModFromProfile(safe, ability);
    const profPart = isExpertise ? proficiencyBonus * 2 : isProficient ? proficiencyBonus : 0;
    return {
      skillId,
      label: RULE_SKILL_LABELS[skillId] ?? skillId,
      ability,
      abilityMod,
      proficient: isProficient,
      expertise: isExpertise,
      total: abilityMod + profPart
    };
  });
  return {
    proficiencyBonus,
    abilities: {
      FOR: getAbilityModFromProfile(safe, "FOR"),
      DEX: getAbilityModFromProfile(safe, "DEX"),
      CON: getAbilityModFromProfile(safe, "CON"),
      INT: getAbilityModFromProfile(safe, "INT"),
      SAG: getAbilityModFromProfile(safe, "SAG"),
      CHA: getAbilityModFromProfile(safe, "CHA")
    },
    skills: skillRows
  };
}

function detectSkillIdInMessage(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return null;
  const entries = Object.entries(RULE_SKILL_LABELS);
  for (const [skillId, label] of entries) {
    if (normalized.includes(skillId) || normalized.includes(normalizeForIntent(label))) {
      return skillId;
    }
  }
  return null;
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function isRpSheetQuestion(message) {
  const normalized = normalizeForIntent(message);
  if (!normalized) return false;
  const patterns = [
    /\bqui\s+suis\s*je\b/,
    /\bmon\s+personnage\b/,
    /\bma\s+fiche\b/,
    /\bmes\s+competences\b/,
    /\bj[ ']?ai\s+combien\s+d[' ]argent\b/,
    /\bcombien\s+d[' ]argent\b/,
    /\bma\s+bourse\b/,
    /\bmes\s+pieces\b/,
    /\bmes\s+stats\b/,
    /\bcaracteristiques\b/,
    /\bmaitrise\b/,
    /\bbonus\s+de\s+competence\b/,
    /\bjet\s+de\b/,
    /\btest\s+de\b/,
    /\blancer?\s+un\s+jet\b/
  ];
  return patterns.some((pattern) => pattern.test(normalized));
}

function buildRpSheetAwareReply(message, characterProfile, worldState) {
  const safe = sanitizeCharacterProfile(characterProfile) ?? worldState?.startContext?.characterSnapshot ?? null;
  const resolved = resolveCharacterDataByIds(safe);
  const rules = buildRuleSnapshot(safe);
  if (!safe) {
    return buildMjReplyBlocks({
      scene: "Tu cherches tes reperes dans les registres des Archives.",
      actionResult: "Aucune fiche claire n'est rattachee a ton personnage pour l'instant.",
      consequences: "Le MJ ne peut pas confirmer tes details de personnage tant que la fiche n'est pas chargee.",
      options: ["Verifier la creation du personnage", "Relancer /profile-debug", "Revenir a la scene RP"]
    });
  }

  const normalized = normalizeForIntent(message);
  const skills = Array.isArray(safe.skills) && safe.skills.length
    ? safe.skills.slice(0, 6).join(", ")
    : "aucune competence marquee";
  const classResolved = resolved?.classes?.[0] ?? null;
  const raceLabel = safe.race && safe.race !== "Inconnue" ? safe.race : resolved?.race?.label || "Inconnue";
  const classLabel =
    safe.classLabel && safe.classLabel !== "Sans classe"
      ? safe.classLabel
      : classResolved?.classLabel || "Sans classe";
  const subclassLabel = safe.subclassLabel || classResolved?.subclassLabel || "";
  const asksStats = /\bmes?\s+stats\b|\bcaracteristiques\b|\battributs\b|\bmodificateurs\b/.test(normalized);
  const asksSkillsDetail = /\bmes\s+competences\b|\bbonus\s+de\s+competence\b|\bmaitrise\b/.test(normalized);
  const asksSkillTest = /\bjet\s+de\b|\btest\s+de\b|\blance?\s+un\s+jet\b|\bfaire\s+un\s+jet\b/.test(normalized);
  const requestedSkillId = detectSkillIdInMessage(message);
  const asksMoney = /\bargent\b|\bbourse\b|\bpieces\b/.test(normalized);
  if (asksMoney) {
    const moneyEntries = Object.entries(safe.money ?? {})
      .filter(([, value]) => Number.isFinite(Number(value)))
      .map(([key, value]) => `${key}: ${Number(value)}`);
    const knownMoney = moneyEntries.length ? moneyEntries.join(", ") : null;
    return buildMjReplyBlocks({
      scene: "Tu glisses la main vers ta bourse en restant dans l'action.",
      actionResult: knownMoney
        ? `Tu estimes tes moyens immediats: ${knownMoney}.`
        : "Je n'ai pas encore de montant fiable relie a tes pieces dans ce module.",
      consequences: knownMoney
        ? "Le MJ peut s'appuyer sur cet etat, mais il faut encore unifier les regles de depense."
        : "La scene continue, mais la comptabilite d'argent reste a brancher sur les regles de jeu.",
      options: ["Continuer la discussion RP", "Demander un prix a un marchand", "Passer en Hors RP pour un diagnostic fiche"]
    });
  }

  if (asksSkillTest && requestedSkillId && rules) {
    const row = rules.skills.find((skill) => skill.skillId === requestedSkillId) ?? null;
    if (row) {
      const die = rollD20();
      const total = die + row.total;
      const critText = die === 20 ? " (20 naturel)" : die === 1 ? " (1 naturel)" : "";
      return buildMjReplyBlocks({
        scene: "Tu executes un veritable test de competence, en situation.",
        actionResult: `Jet ${row.label} (${row.ability}) : d20=${die}${critText} + bonus ${signedValue(row.total)} => total ${total}.`,
        consequences: "Le resultat est disponible pour arbitrer la suite RP; l'automatisation complete des seuils arrive ensuite.",
        options: ["Demander la difficulte de l'action", "Tenter une autre approche", "Continuer la scene"]
      });
    }
  }

  if (asksStats && rules) {
    const mods = rules.abilities;
    return buildMjReplyBlocks({
      scene: "Tu fais un point rapide sur tes capacites avant d'agir.",
      actionResult: `Mods: FOR ${signedValue(mods.FOR)} | DEX ${signedValue(mods.DEX)} | CON ${signedValue(mods.CON)} | INT ${signedValue(mods.INT)} | SAG ${signedValue(mods.SAG)} | CHA ${signedValue(mods.CHA)}. Maitrise ${signedValue(rules.proficiencyBonus)}.`,
      consequences: "Ces valeurs servent directement aux futurs tests de competences et jets de resolution.",
      options: ["Demander tes bonus de competences", "Lancer un test (ex: test de perception)", "Revenir a l'action RP"]
    });
  }

  if ((asksSkillsDetail || (requestedSkillId && !asksSkillTest)) && rules) {
    const ordered = [...rules.skills]
      .filter((row) => row.proficient || row.expertise)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
      .slice(0, 8);
    const summary = ordered.length
      ? ordered
          .map((row) => `${row.label} ${signedValue(row.total)}${row.expertise ? " (expertise)" : ""}`)
          .join(" | ")
      : "Aucune competence maitrisee n'est marquee sur la fiche.";
    return buildMjReplyBlocks({
      scene: "Tu te concentres sur tes competences applicables a la scene.",
      actionResult: summary,
      consequences: "Le MJ utilisera ces bonus pour les prochains tests annonces en RP.",
      options: ["Tester une competence precise", "Demander tes stats", "Continuer l'echange RP"]
    });
  }

  if (isSelfIdentityQuestion(message) || /\bmon\s+personnage\b|\bma\s+fiche\b/.test(normalized)) {
    return buildMjReplyBlocks({
      scene: "Tu consultes rapidement ce que les Archives retiennent de toi.",
      actionResult: `Tu es ${safe.name}, ${raceLabel}, ${classLabel}${subclassLabel ? ` (${subclassLabel})` : ""}.`,
      consequences: "Ces elements servent de base aux interactions RP et aux futurs tests.",
      options: ["Demander tes competences", "Questionner un PNJ sur ta reputation", "Poursuivre l'exploration"]
    });
  }

  return buildMjReplyBlocks({
    scene: "Tu fais le point avant d'agir.",
    actionResult: `Competences retenues: ${skills}.`,
    consequences: "Le MJ garde ces reperes pour cadrer tes prochaines actions.",
    options: ["Lancer une action en jeu", "Parler a un PNJ", "Passer en Hors RP pour le detail technique"]
  });
}

function buildTransitionNarrative(outcome, intentType) {
  const selected = outcome?.selectedCommand;
  const transitionId = String(outcome?.appliedOutcome?.result?.transitionId ?? "none");
  const hasTransition = transitionId !== "none";
  if (!hasTransition) {
    return oneLine(
      outcome?.aiReason ||
      outcome?.decisionReason ||
      "Le monde ne bascule pas encore, mais ta decision reste prise en compte.",
      280
    );
  }

  const entityType = String(selected?.entityType ?? "").toLowerCase();
  if (entityType === "trade") {
    return "La negociation avance nettement: l'autre partie repond a ton approche et la discussion prend forme.";
  }
  if (entityType === "quest") {
    return "Une piste concrete s'ouvre devant toi, avec un objectif plus clair a poursuivre.";
  }
  if (entityType === "trama") {
    return "La tension de fond monte d'un cran, comme si un fil plus vaste venait de se tendre.";
  }
  if (entityType === "companion") {
    return "Le lien avec ce personnage evolue, ce qui peut changer ton soutien pour la suite.";
  }
  if (intentType === "social_action") {
    return "Ton echange produit un effet reel sur la situation sociale immediate.";
  }
  return "Ta decision modifie concretement la situation et ouvre la prochaine etape.";
}

function buildDirectorNoRuntimeReply(message, intentType, records) {
  const top = Array.isArray(records) ? records.slice(0, 1) : [];
  const contextual = top.length > 0
    ? oneLine(top[0]?.summary ?? top[0]?.body ?? "", 160)
    : "";
  const social = intentType === "social_action";

  return buildMjReplyBlocks({
    scene: social
      ? "Tu engages une interaction sociale dans un contexte encore mouvant."
      : "Tu poses une action qui ouvre une situation, sans resolution immediate du moteur de transition.",
    actionResult: contextual
      ? `Le contexte local reagit: ${contextual}`
      : "Aucune transition canonique immediate ne s'applique, mais la scene evolue narrativement.",
    consequences: social
      ? "Ta posture sociale est observee, sans consequence mecanique definitive a ce stade."
      : "La tension locale peut evoluer selon tes prochaines decisions.",
    options: social
      ? ["Preciser ton objectif social", "Nommer la faction cible", "Passer a une action concrete"]
      : ["Decrire une action plus precise", "Interagir avec un PNJ", "Changer d'approche"]
  });
}

function buildRpActionValidationReply(assessment) {
  const safe = assessment && typeof assessment === "object" ? assessment : {};
  const actionType = String(safe.actionType ?? "generic_action");
  const target = String(safe.targetLabel ?? safe.targetId ?? "").trim();
  const labelByType = {
    cast_spell: "lancer un sort",
    use_weapon: "utiliser une arme",
    skill_check: "faire un test de competence",
    generic_action: "agir en scene"
  };
  const actionLabel = labelByType[actionType] || "agir en scene";
  const targetLabel = target ? ` (${target})` : "";
  const validation = safe.allowed ? "possible" : "bloquee pour l'instant";
  const reason = oneLine(safe.reason, 220) || "Evaluation en cours.";
  const proposal = safe.allowed ? oneLine(safe?.proposal?.justification, 180) : "";
  return buildMjReplyBlocks({
    scene: `Tu evalues la faisabilite immediate de ton intention: ${actionLabel}${targetLabel}.`,
    actionResult: `Validation serveur: ${validation}. ${reason}`,
    consequences: proposal
      ? `Lecture MJ: ${proposal}`
      : "Le MJ garde le contexte et peut lancer la resolution RP juste apres confirmation.",
    options: safe.allowed
      ? [
          "Confirmer l'action maintenant",
          "Preciser la cible ou la maniere",
          "Changer de tactique"
        ]
      : [
          "Reformuler l'action avec une cible precise",
          "Verifier ta fiche en Hors RP",
          "Tenter une autre approche RP"
        ]
  });
}

function hasRemainingSpellSlotsForRp(worldState, contextPack) {
  const runtimeSlots =
    worldState?.rpRuntime?.spellSlots && typeof worldState.rpRuntime.spellSlots === "object"
      ? worldState.rpRuntime.spellSlots
      : null;
  const runtimeLevels = runtimeSlots ? Object.values(runtimeSlots) : [];
  if (runtimeLevels.length > 0) {
    return runtimeLevels.some((row) => Number(row?.remaining ?? 0) > 0);
  }
  const packSlots = Array.isArray(contextPack?.magic?.slots) ? contextPack.magic.slots : [];
  return packSlots.some((row) => Number(row?.remaining ?? 0) > 0);
}

function buildNarrationChatReply(outcome, intentType = "story_action") {
  const transitionId = outcome?.appliedOutcome?.result?.transitionId ?? "none";
  const guardBlocked = Boolean(outcome?.guardBlocked);
  const hasTransition = transitionId !== "none";

  const scene = hasTransition
    ? "La scene reagit directement a ton action."
    : "La scene reste ouverte, sans bascule immediate.";

  const actionResult = buildTransitionNarrative(outcome, intentType);

  const guardInfo = guardBlocked
    ? "Un verrou narratif freine encore cette resolution."
    : "La situation reste coherente avec tes actions precedentes.";

  const consequences = hasTransition
    ? `${guardInfo} Le monde narratif avance d'un cran sur cet axe.`
    : `${guardInfo} Le monde reste stable, mais le contexte est conserve pour la suite.`;

  const options = intentType === "social_action"
    ? [
        "Reformuler ta demande de maniere plus convaincante",
        "Chercher un levier social (nom, dette, reputation)",
        "Changer d'approche et agir sur le terrain"
      ]
    : [
        "Preciser ton objectif immediat",
        "Interagir avec un PNJ ou une faction",
        "Continuer l'exploration locale"
      ];

  return buildMjReplyBlocks({
    scene,
    actionResult,
    consequences,
    options
  });
}

// ----------------------------------------------------
// Serveur HTTP : API + fichiers statiques (dist/)
// ----------------------------------------------------

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    });
    res.end();
    return;
  }

  // API ennemis
  if (req.method === "POST" && req.url === "/api/enemy-ai") {
    try {
      const body = await parseJsonBody(req);
      const stateSummary = body && typeof body === "object" ? body : {};

      let result;
      try {
        result = await callOpenAiForEnemyIntents(stateSummary);
      } catch (err) {
        console.error("[enemy-ai] Erreur appel OpenAI:", err.message);
        // En cas d'erreur API, on renvoie quand mÃªme une forme valide
        result = { intents: [] };
      }

      if (!result.intents || result.intents.length === 0) {
        console.warn("[enemy-ai] Aucune dÃ©cision IA renvoyÃ©e (fallback probable).");
      }

      sendJson(res, 200, result);
    } catch (err) {
      console.error("[enemy-ai] Erreur de traitement:", err.message);
      sendJson(res, 400, { error: "Bad request" });
    }
    return;
  }

  // API narration (recap "MJ" apres la phase ennemie, point de vue joueur)
  if (req.method === "POST" && req.url === "/api/narration") {
    try {
      const body = await parseJsonBody(req);

      if (!OPENAI_API_KEY) {
        return sendJson(res, 200, { summary: "", error: "IA non fonctionnel." });
      }

      const model = process.env.NARRATION_MODEL || "gpt-4.1-mini";

      const systemPrompt =
        "Tu es un maitre du jeu (Donjons & Dragons) et un auteur d'heroic-fantasy. " +
        "Ta mission: ecrire un recap narratif en FRANCAIS, au POINT DE VUE DU JOUEUR (1ere personne: je). " +
        "Le recap resume la sequence complete: action(s) du joueur puis reponses des ennemis. " +
        "Contraintes: 2 a 6 phrases, ton immersif, pas de listes, pas de meta-commentaires, pas de mention d'IA. " +
        "Priorite: mentionne toujours les coups qui touchent et font baisser les PV de maniÃ¨re roleplay (player_attack/enemy_attack avec damage > 0, ou baisse de PV entre stateStart et stateEnd), en citant l'auteur et la nature de l'attaque. " +
        "Si une attaque rate (isHit=false), tu peux le resumer briÃ¨vement si tu as la place. " +
        "Base-toi uniquement sur les evenements et l'etat fournis. " +
        "Repond STRICTEMENT en JSON: { \"summary\": \"...\" }.";

      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload: body
      });

      if (!parsed || typeof parsed.summary !== "string") {
        return sendJson(res, 200, { summary: "", error: "IA non fonctionnel." });
      }

      return sendJson(res, 200, { summary: parsed.summary });
    } catch (err) {
      console.error("[narration] Erreur:", err.message);
      return sendJson(res, 200, { summary: "", error: "IA non fonctionnel." });
    }
  }

  // API runtime narration (journal module narratif)
  if (req.method === "GET" && req.url === "/api/narration-runtime-state") {
    try {
      const state = loadNarrationRuntimeStateFromDisk();
      if (!state) {
        return sendJson(res, 404, {
          error: "Narrative runtime state not found",
          path: "narration-module/runtime/NarrativeGameState.v1.json"
        });
      }
      return sendJson(res, 200, state);
    } catch (err) {
      console.error("[narration-runtime] Erreur lecture state:", err?.message ?? err);
      return sendJson(res, 500, { error: "Narrative runtime read error" });
    }
  }

  // API reset runtime narration
  if (req.method === "POST" && req.url === "/api/narration/reset") {
    try {
      const runtime = getNarrationRuntime();
      const initial = runtime.NarrativeRuntime.createInitialState();
      runtime.StateRepository.save(initial, NARRATION_STATE_PATH);
      saveNarrativeWorldState(createInitialNarrativeWorldState());
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      console.error("[narration-reset] Erreur:", err?.message ?? err);
      return sendJson(res, 500, { ok: false, error: "Reset failed" });
    }
  }

  // API tick narration IA (module narratif complet)
  if (req.method === "POST" && req.url === "/api/narration/tick-ai") {
    try {
      const body = await parseJsonBody(req);
      const prompt = String(body?.prompt ?? "").trim();
      if (!prompt) {
        return sendJson(res, 400, { error: "prompt manquant" });
      }

      const runtime = getNarrationRuntime();
      const api = runtime.GameNarrationAPI.createDefault(NARRATION_STATE_PATH);
      const state = api.getState();
      const records = buildLoreRecordsForQuery(prompt);

      const useOpenAI = Boolean(body?.useOpenAI) && Boolean(OPENAI_API_KEY);
      const generator = useOpenAI
        ? new runtime.OpenAIMjNarrationGenerator({
            apiKey: OPENAI_API_KEY,
            model: process.env.NARRATION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"
          })
        : new runtime.HeuristicMjNarrationGenerator();

      const outcome = await api.tickNarrationWithAI(
        {
          query: prompt,
          records,
          entityHints: {
            quest: Object.keys(state.quests),
            trama: Object.keys(state.tramas),
            companion: Object.keys(state.companions),
            trade: Object.keys(state.trades)
          },
          minHoursBetweenMajorEvents: 1,
          blockOnGuardFailure: true
        },
        generator
      );
      const intent = {
        type: "story_action"
      };
      const worldDelta = computeWorldDelta({ intent, outcome });
      const currentWorld = loadNarrativeWorldState();
      const transitionId = outcome?.appliedOutcome?.result?.transitionId ?? "none";
      const worldState = applyWorldDelta(currentWorld, worldDelta, {
        intentType: intent.type,
        transitionId
      });
      saveNarrativeWorldState(worldState);

      return sendJson(res, 200, {
        reply: buildNarrationChatReply(outcome),
        loreRecordsUsed: records.length,
        worldDelta,
        worldState,
        outcome
      });
    } catch (err) {
      console.error("[narration-tick-ai] Erreur:", err?.message ?? err);
      return sendJson(res, 500, { error: "Tick narration impossible" });
    }
  }

  // API debug context pack personnage (HRP tooling)
  if (req.method === "POST" && req.url === "/api/narration/character-context") {
    try {
      const body = await parseJsonBody(req);
      const worldState = loadNarrativeWorldState();
      const profile = sanitizeCharacterProfile(body?.characterProfile ?? null);
      const pack = buildCharacterContextPack(profile, worldState);
      return sendJson(res, 200, {
        ok: Boolean(pack),
        contextPack: pack
      });
    } catch (err) {
      console.error("[narration-character-context] Erreur:", err?.message ?? err);
      return sendJson(res, 500, { error: "Context pack impossible" });
    }
  }

  // API chat narration (style chat classique)
  if (req.method === "POST" && req.url === "/api/narration/chat") {
    try {
      const body = await parseJsonBody(req);
      const message = String(body?.message ?? "").trim();
      const characterProfile = sanitizeCharacterProfile(body?.characterProfile ?? null);
      const conversationMode = sanitizeConversationMode(body?.conversationMode);
      if (!message) {
        return sendJson(res, 400, { error: "message manquant" });
      }
      const heuristicIntent = classifyNarrationIntent(message);
      let intent = heuristicIntent;
      let directorPlan = buildNarrativeDirectorPlan(intent);

      if (message.toLowerCase() === "/reset") {
        const runtime = getNarrationRuntime();
        const initial = runtime.NarrativeRuntime.createInitialState();
        runtime.StateRepository.save(initial, NARRATION_STATE_PATH);
        saveNarrativeWorldState(createInitialNarrativeWorldState());
        return sendJson(res, 200, {
          reply: "État narratif réinitialisé.",
          mjResponse: makeMjResponse({
            responseType: "system",
            directAnswer: "État narratif réinitialisé."
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent,
          director: directorPlan,
          stateUpdated: true
        });
      }

      if (message.toLowerCase() === "/state") {
        const state = loadNarrationRuntimeStateFromDisk();
        if (!state) {
          return sendJson(res, 200, {
            reply: "Aucun état narratif trouvé.",
            mjResponse: makeMjResponse({
              responseType: "status",
              directAnswer: "Aucun état narratif trouvé."
            }),
            speaker: buildSpeakerPayload({ conversationMode, forceSystem: true })
          });
        }
        const summary = [
          `Quêtes: ${Object.keys(state.quests ?? {}).length}`,
          `Trames: ${Object.keys(state.tramas ?? {}).length}`,
          `Compagnons: ${Object.keys(state.companions ?? {}).length}`,
          `Marchandages: ${Object.keys(state.trades ?? {}).length}`,
          `Historique: ${Array.isArray(state.history) ? state.history.length : 0}`
        ].join(" | ");
        const worldState = loadNarrativeWorldState();
          const worldSummary = [
          `Reputation: ${worldState.metrics?.reputation ?? 0}`,
          `TensionLocale: ${worldState.metrics?.localTension ?? 0}`,
          `Temps: J${worldState?.time?.day ?? 1} ${String(worldState?.time?.hour ?? 15).padStart(2, "0")}:${String(worldState?.time?.minute ?? 0).padStart(2, "0")} (${worldState?.time?.label ?? "inconnu"})`,
          `Lieu: ${worldState?.location?.label ?? worldState?.startContext?.locationLabel ?? "inconnu"}`,
          `ContexteDepart: ${worldState?.startContext?.delivered ? "actif" : "en attente"}`,
          `PJ: ${worldState?.startContext?.characterSnapshot?.name ?? "inconnu"}`,
          `Interlocuteur: ${worldState?.conversation?.activeInterlocutor ?? "aucun"}`,
          `DeplacementEnAttente: ${worldState?.travel?.pending?.to?.label ?? worldState?.conversation?.pendingTravel?.placeLabel ?? "non"}`,
          `AccesEnAttente: ${worldState?.conversation?.pendingAccess?.placeLabel ?? "non"}`,
          `LieuxSession: ${Array.isArray(worldState?.sessionPlaces) ? worldState.sessionPlaces.length : 0}`,
          `DernierDeplacement: ${
            worldState?.travel?.last
              ? `${worldState.travel.last.from?.label ?? "?"} -> ${worldState.travel.last.to?.label ?? "?"} (${worldState.travel.last.durationMin ?? 0} min)`
              : "aucun"
          }`
        ].join(" | ");
        return sendJson(res, 200, {
          reply: `${summary}\n${worldSummary}`,
          mjResponse: makeMjResponse({
            responseType: "status",
            directAnswer: `${summary}\n${worldSummary}`
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent,
          director: directorPlan,
          worldState
        });
      }

      if (message.toLowerCase() === "/profile-debug") {
        const worldState = loadNarrativeWorldState();
        const profileDiag = buildCharacterProfileDiagnostics(characterProfile, worldState);
        return sendJson(res, 200, {
          reply: profileDiag,
          mjResponse: makeMjResponse({
            responseType: "status",
            directAnswer: profileDiag
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent: { ...intent, type: "system_command", reason: "profile-debug" },
          director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
          worldState,
          stateUpdated: false
        });
      }

      if (message.toLowerCase() === "/context-debug") {
        const worldState = loadNarrativeWorldState();
        const contextDiag = buildCharacterContextDiagnostics(characterProfile, worldState);
        return sendJson(res, 200, {
          reply: contextDiag,
          mjResponse: makeMjResponse({
            responseType: "status",
            directAnswer: contextDiag
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent: { ...intent, type: "system_command", reason: "context-debug" },
          director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
          worldState,
          stateUpdated: false
        });
      }

      if (message.toLowerCase() === "/rules-debug") {
        const worldState = loadNarrativeWorldState();
        const rulesDiag = buildCharacterRulesDiagnostics(characterProfile, worldState);
        return sendJson(res, 200, {
          reply: rulesDiag,
          mjResponse: makeMjResponse({
            responseType: "status",
            directAnswer: rulesDiag
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent: { ...intent, type: "system_command", reason: "rules-debug" },
          director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
          worldState,
          stateUpdated: false
        });
      }

      if (message.toLowerCase() === "/contract-debug") {
        const worldState = loadNarrativeWorldState();
        const stats = buildMjContractStatsPayload();
        const sourceParts = Object.entries(stats.bySource)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .map(([source, count]) => `${source}: ${count}`)
          .join(" | ");
        const summary = `Contrats MJ observes: ${stats.total} | Sources: ${sourceParts || "aucune"}`;
        return sendJson(res, 200, {
          reply: summary,
          mjResponse: makeMjResponse({
            responseType: "status",
            directAnswer: summary
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent: { ...intent, type: "system_command", reason: "contract-debug" },
          director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
          worldState,
          contractStats: stats,
          stateUpdated: false
        });
      }

      if (message.toLowerCase() === "/phase1-debug") {
        const worldState = loadNarrativeWorldState();
        const stats = buildMjContractStatsPayload();
        const sourceParts = Object.entries(stats.bySource)
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .map(([source, count]) => `${source}: ${count}`)
          .join(" | ");
        const grounding = stats.grounding ?? {};
        const summary = [
          `Phase1 DoD (tool-grounding)`,
          `NarrativeTurns: ${grounding.narrativeTurns ?? 0}`,
          `GroundedTurns: ${grounding.groundedTurns ?? 0}`,
          `UngroundedTurns: ${grounding.ungroundedTurns ?? 0}`,
          `GroundingRate: ${grounding.groundingRatePct ?? 0}%`,
          `ContractSources: ${sourceParts || "aucune"}`
        ].join(" | ");
        return sendJson(res, 200, {
          reply: summary,
          mjResponse: makeMjResponse({
            responseType: "status",
            directAnswer: summary
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent: { ...intent, type: "system_command", reason: "phase1-debug" },
          director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "tool" },
          worldState,
          phase1: {
            dod: {
              toolGroundingVisible: true,
              narrativeTurns: grounding.narrativeTurns ?? 0,
              groundedTurns: grounding.groundedTurns ?? 0,
              ungroundedTurns: grounding.ungroundedTurns ?? 0,
              groundingRatePct: grounding.groundingRatePct ?? 0
            },
            byIntent: grounding.byIntent ?? {},
            recentGrounding: Array.isArray(grounding.recent) ? grounding.recent : []
          },
          stateUpdated: false
        });
      }

      if (message.toLowerCase().startsWith("/interlocutor")) {
        const raw = message.replace(/^\/interlocutor/i, "").trim();
        const nextInterlocutor = sanitizeInterlocutorLabel(raw);
        if (!nextInterlocutor) {
          return sendJson(res, 200, {
            reply:
              "Commande invalide. Utilise: /interlocutor <nom> (ex: /interlocutor garde).",
            mjResponse: makeMjResponse({
              responseType: "system",
              directAnswer: "Commande invalide. Utilise: /interlocutor <nom> (ex: /interlocutor garde)."
            }),
            speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
            intent,
            director: directorPlan,
            stateUpdated: false
          });
        }
        const worldState = loadNarrativeWorldState();
        worldState.conversation = {
          ...(worldState.conversation ?? {}),
          activeInterlocutor: nextInterlocutor
        };
        saveNarrativeWorldState(worldState);
        return sendJson(res, 200, {
          reply: `Interlocuteur actif défini sur: ${nextInterlocutor}.`,
          mjResponse: makeMjResponse({
            responseType: "system",
            directAnswer: `Interlocuteur actif défini sur: ${nextInterlocutor}.`
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent: { ...intent, type: "system_command", reason: "set-interlocutor" },
          director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "policy" },
          worldState,
          stateUpdated: false
        });
      }

      if (message.toLowerCase() === "/clear-interlocutor") {
        const worldState = loadNarrativeWorldState();
        worldState.conversation = {
          ...(worldState.conversation ?? {}),
          activeInterlocutor: null
        };
        saveNarrativeWorldState(worldState);
        return sendJson(res, 200, {
          reply: "Interlocuteur actif effacé.",
          mjResponse: makeMjResponse({
            responseType: "system",
            directAnswer: "Interlocuteur actif effacé."
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent: { ...intent, type: "system_command", reason: "clear-interlocutor" },
          director: { ...directorPlan, mode: "hrp", applyRuntime: false, source: "policy" },
          worldState,
          stateUpdated: false
        });
      }

      const runtime = getNarrationRuntime();
      const api = runtime.GameNarrationAPI.createDefault(NARRATION_STATE_PATH);
      const state = api.getState();
      const records = buildLoreRecordsForQuery(message);
      const worldSnapshot = loadNarrativeWorldState();
      worldSnapshot.conversation = {
        ...(worldSnapshot.conversation ?? {}),
        activeInterlocutor:
          worldSnapshot?.conversation?.activeInterlocutor == null
            ? null
            : String(worldSnapshot.conversation.activeInterlocutor),
        pendingAction: sanitizePendingAction(worldSnapshot?.conversation?.pendingAction),
        pendingTravel: sanitizePendingTravel(worldSnapshot?.conversation?.pendingTravel),
        pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess)
      };
      if (conversationMode === "rp") {
        const detectedInterlocutor = extractInterlocutorFromMessage(message);
        if (detectedInterlocutor) {
          worldSnapshot.conversation.activeInterlocutor = detectedInterlocutor;
        }
      }
      if (characterProfile) {
        worldSnapshot.startContext = {
          ...(worldSnapshot.startContext ?? {}),
          characterSnapshot: characterProfile,
          delivered: Boolean(worldSnapshot?.startContext?.delivered)
        };
      }

      const rpContextPack =
        conversationMode === "rp" ? buildCharacterContextPack(characterProfile, worldSnapshot) : null;

      if (
        conversationMode === "rp" &&
        rpContextPack &&
        worldSnapshot?.conversation?.pendingAction &&
        rpActionResolver.isConfirmationMessage(message)
      ) {
        const resolution = rpActionResolver.resolvePendingAction(
          message,
          worldSnapshot.conversation.pendingAction,
          rpContextPack,
          worldSnapshot
        );
        if (resolution) {
          const worldDelta = resolution.success
            ? { reputationDelta: 0, localTensionDelta: 1, reason: "rp-action-resolved" }
            : { reputationDelta: 0, localTensionDelta: 0, reason: "rp-action-failed" };
          const worldState = applyWorldDelta(worldSnapshot, worldDelta, {
            intentType: "story_action",
            transitionId: `rp:${resolution.actionType}`
          });
          worldState.rpRuntime = {
            ...(worldState.rpRuntime ?? {}),
            ...(resolution.nextRuntime ?? {}),
            lastResolution: {
              at: new Date().toISOString(),
              actionType: String(resolution.actionType ?? "generic_action"),
              targetId: String(resolution.targetId ?? ""),
              success: Boolean(resolution.success),
              summary: oneLine(String(resolution.actionResult ?? ""), 160)
            }
          };
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: null
          };
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          saveNarrativeWorldState(worldState);
          return sendJson(res, 200, {
            reply: buildMjReplyBlocks({
              scene: resolution.scene,
              actionResult: resolution.actionResult,
              consequences: resolution.consequences,
              options: resolution.options
            }),
            mjResponse: makeMjResponse({
              responseType: "resolution",
              scene: resolution.scene,
              actionResult: resolution.actionResult,
              consequences: resolution.consequences,
              options: resolution.options
            }),
            speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
            intent: {
              type: "story_action",
              confidence: 0.9,
              reason: `rp-action-resolve:${resolution.actionType}`
            },
            director: { mode: "scene_only", applyRuntime: false, source: "resolver" },
            rpActionResolution: resolution,
            worldDelta,
            worldState,
            stateUpdated: true
          });
        }
      }

      if (
        conversationMode === "rp" &&
        (worldSnapshot?.conversation?.pendingTravel || worldSnapshot?.travel?.pending) &&
        isTravelConfirmation(message)
      ) {
        const pendingTravelLegacy = sanitizePendingTravel(worldSnapshot?.conversation?.pendingTravel);
        const pendingTravelCanonical = sanitizeTravelState(worldSnapshot?.travel).pending;
        const pendingTravel = pendingTravelCanonical
          ? {
              placeId: pendingTravelCanonical.to.id,
              placeLabel: pendingTravelCanonical.to.label,
              durationMin: pendingTravelCanonical.durationMin
            }
          : pendingTravelLegacy
            ? { placeId: pendingTravelLegacy.placeId, placeLabel: pendingTravelLegacy.placeLabel, durationMin: 3 }
            : null;
        if (pendingTravel && pendingTravel.placeLabel) {
          const currentWorld = loadNarrativeWorldState();
          let worldState = applyWorldDelta(
            currentWorld,
            { reputationDelta: 0, localTensionDelta: 0, reason: "travel-confirmed" },
            { intentType: "system_command", transitionId: "travel.confirmed" }
          );
          const place = {
            id: pendingTravel.placeId,
            label: pendingTravel.placeLabel
          };
          const fromLocation = sanitizeWorldLocation(worldState?.location);
          const durationMin = Math.max(1, Math.floor(Number(pendingTravel.durationMin) || 3));
          worldState = applyTravel(worldState, {
            from: fromLocation,
            to: { id: place.id, label: place.label },
            durationMin,
            reason: "travel-confirmed"
          });
          const arrivalRecords = buildLoreRecordsForQuery(place.label);
          const arrivalMetadata = derivePlaceMetadataFromRecords(place.label, arrivalRecords);
          worldState.sessionPlaces = upsertSessionPlace(worldState?.sessionPlaces, {
            id: place.id,
            label: place.label,
            city: "",
            access: arrivalMetadata.access,
            tags: arrivalMetadata.tags,
            riskFlags: arrivalMetadata.riskFlags,
            sources: arrivalMetadata.sources,
            summary: arrivalMetadata.summary
          });
          const resolvedArrivalPlace =
            sanitizeSessionPlaces(worldState?.sessionPlaces).find((entry) => entry.id === place.id) ?? {
              ...place,
              access: arrivalMetadata.access,
              riskFlags: arrivalMetadata.riskFlags,
              tags: arrivalMetadata.tags,
              summary: arrivalMetadata.summary
            };
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: null,
            pendingTravel: null,
            pendingAccess: null
          };
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          const injected = injectLockedStartContextReply(
            buildArrivalPlaceReply(resolvedArrivalPlace, arrivalRecords, worldState),
            worldState,
            characterProfile
          );
          const arrivalReplyParts = parseReplyToMjBlocks(injected.reply);
          saveNarrativeWorldState(injected.worldState);
          return sendJson(res, 200, {
            reply: injected.reply,
            mjResponse: makeMjResponse({
              responseType: "narration",
              scene: arrivalReplyParts.scene,
              actionResult: arrivalReplyParts.actionResult,
              consequences: arrivalReplyParts.consequences,
              options: arrivalReplyParts.options
            }),
            speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
            intent: { type: "story_action", confidence: 0.9, reason: "travel-confirmed" },
            director: { mode: "scene_only", applyRuntime: false, source: "travel-flow" },
            worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-confirmed" },
            worldState: injected.worldState,
            stateUpdated: true
          });
        }
      }

      if (conversationMode === "rp") {
        const visitIntent = extractVisitIntent(message, records);
        if (visitIntent) {
          const currentWorld = loadNarrativeWorldState();
          const worldState = applyWorldDelta(
            currentWorld,
            { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed" },
            { intentType: "system_command", transitionId: "travel.proposed" }
          );
          const place = resolveOrCreateSessionPlace(visitIntent.placeLabel, records, worldState);
          const fromLocation = sanitizeWorldLocation(worldState?.location);
          const toLocation = { id: place.id, label: place.label };
          const durationMin = estimateTravelMinutes(fromLocation, toLocation, "free_exploration");
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: null,
            pendingTravel: sanitizePendingTravel({
              placeId: place.id,
              placeLabel: place.label,
              question: oneLine(message, 140),
              sourceLoreIds: records.slice(0, 3).map((entry) => String(entry?.id ?? "")).filter(Boolean),
              createdAt: new Date().toISOString()
            }),
            pendingAccess: null
          };
          worldState.travel = sanitizeTravelState({
            ...(worldState.travel ?? {}),
            pending: {
              from: fromLocation,
              to: toLocation,
              durationMin,
              reason: "travel-proposed",
              startedAt: new Date().toISOString()
            }
          });
          worldState.sessionPlaces = upsertSessionPlace(worldState?.sessionPlaces, {
            id: place.id,
            label: place.label,
            city: place.city ?? "",
            access: place.access ?? "public",
            tags: Array.isArray(place.tags) ? place.tags : [],
            riskFlags: Array.isArray(place.riskFlags) ? place.riskFlags : [],
            sources: Array.isArray(place.sources) ? place.sources : [],
            summary: place.summary ?? ""
          });
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          const injected = injectLockedStartContextReply(
            buildVisitAdvisoryReply(place, records, worldState),
            worldState,
            characterProfile
          );
          const advisoryParts = parseReplyToMjBlocks(injected.reply);
          saveNarrativeWorldState(injected.worldState);
          return sendJson(res, 200, {
            reply: injected.reply,
            mjResponse: makeMjResponse({
              responseType: "clarification",
              scene: advisoryParts.scene,
              actionResult: advisoryParts.actionResult,
              consequences: advisoryParts.consequences,
              options: advisoryParts.options
            }),
            speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
            intent: { type: "story_action", confidence: 0.86, reason: "travel-proposed" },
            director: { mode: "scene_only", applyRuntime: false, source: "travel-flow" },
            worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed" },
            worldState: injected.worldState,
            stateUpdated: false
          });
        }
      }

      if (
        conversationMode === "rp" &&
        worldSnapshot?.conversation?.pendingAccess &&
        (rpActionResolver.isConfirmationMessage(message) || isAccessProgressionIntent(message))
      ) {
        const pendingAccess = sanitizePendingAccess(worldSnapshot.conversation.pendingAccess);
        if (pendingAccess) {
          const currentWorld = loadNarrativeWorldState();
          const accessOutcome = resolveAccessAttempt(message, pendingAccess, rpContextPack, currentWorld);
          const worldState = applyWorldDelta(
            currentWorld,
            accessOutcome.worldDelta,
            { intentType: "story_action", transitionId: accessOutcome.success ? "access.resolved" : "access.blocked" }
          );
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: null,
            pendingTravel: null,
            pendingAccess: accessOutcome.success
              ? null
              : sanitizePendingAccess({
                  ...pendingAccess,
                  prompt: oneLine(message, 140),
                  createdAt: new Date().toISOString()
                })
          };
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          const injected = injectLockedStartContextReply(accessOutcome.reply, worldState, characterProfile);
          const accessParts = parseReplyToMjBlocks(injected.reply);
          saveNarrativeWorldState(injected.worldState);
          return sendJson(res, 200, {
            reply: injected.reply,
            mjResponse: makeMjResponse({
              responseType: "resolution",
              scene: accessParts.scene,
              actionResult: accessParts.actionResult,
              consequences: accessParts.consequences,
              options: accessParts.options
            }),
            speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
            intent: { type: "story_action", confidence: 0.87, reason: "access-resolution" },
            director: { mode: "scene_only", applyRuntime: false, source: "access-loop" },
            worldDelta: accessOutcome.worldDelta,
            worldState: injected.worldState,
            stateUpdated: true
          });
        }
      }

      if (conversationMode === "rp") {
        const currentPlace = getCurrentSessionPlace(worldSnapshot);
        const requiresGate = currentPlace?.access === "restricted" || currentPlace?.access === "sealed";
        if (requiresGate && isAccessProgressionIntent(message)) {
          const currentWorld = loadNarrativeWorldState();
          const worldState = applyWorldDelta(
            currentWorld,
            { reputationDelta: 0, localTensionDelta: 0, reason: "access-gate-proposed" },
            { intentType: "story_action", transitionId: "access.proposed" }
          );
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: null,
            pendingTravel: null,
            pendingAccess: sanitizePendingAccess({
              placeId: currentPlace.id,
              placeLabel: currentPlace.label,
              access: currentPlace.access,
              riskFlags: currentPlace.riskFlags,
              prompt: oneLine(message, 140),
              reason: "access-gate",
              createdAt: new Date().toISOString()
            })
          };
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          const injected = injectLockedStartContextReply(
            buildAccessChallengeReply(currentPlace, message, rpContextPack, worldState),
            worldState,
            characterProfile
          );
          const accessChallengeParts = parseReplyToMjBlocks(injected.reply);
          saveNarrativeWorldState(injected.worldState);
          return sendJson(res, 200, {
            reply: injected.reply,
            mjResponse: makeMjResponse({
              responseType: "clarification",
              scene: accessChallengeParts.scene,
              actionResult: accessChallengeParts.actionResult,
              consequences: accessChallengeParts.consequences,
              options: accessChallengeParts.options
            }),
            speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
            intent: { type: "story_action", confidence: 0.83, reason: "access-gate-proposed" },
            director: { mode: "scene_only", applyRuntime: false, source: "access-loop" },
            worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "access-gate-proposed" },
            worldState: injected.worldState,
            stateUpdated: false
          });
        }
      }

      if (conversationMode === "rp") {
        const mjStructuredDraft = await generateMjStructuredReply({
          message,
          records,
          worldState: worldSnapshot,
          contextPack: rpContextPack,
          activeInterlocutor: worldSnapshot?.conversation?.activeInterlocutor ?? null,
          conversationMode,
          pending: {
            action: worldSnapshot?.conversation?.pendingAction ?? null,
            travel: worldSnapshot?.travel?.pending ?? worldSnapshot?.conversation?.pendingTravel ?? null,
            access: worldSnapshot?.conversation?.pendingAccess ?? null
          }
        });
        const priorityToolCalls = buildPriorityMjToolCalls({
          message,
          intent,
          directorPlan,
          conversationMode,
          worldState: worldSnapshot,
          hasCharacterProfile: Boolean(rpContextPack)
        });
        const plannedToolCalls = mergeToolCalls(
          Array.isArray(mjStructuredDraft?.toolCalls) ? mjStructuredDraft.toolCalls : [],
          priorityToolCalls,
          6
        );
        const mjToolTrace = mjToolBus.executeToolCalls(plannedToolCalls, {
          message,
          records,
          worldState: worldSnapshot,
          contextPack: rpContextPack,
          runtimeState: state,
          pending: {
            action: worldSnapshot?.conversation?.pendingAction ?? null,
            travel: worldSnapshot?.travel?.pending ?? worldSnapshot?.conversation?.pendingTravel ?? null,
            access: worldSnapshot?.conversation?.pendingAccess ?? null
          }
        });
        const mjStructured = await refineMjStructuredReplyWithTools({
          message,
          initialStructured: mjStructuredDraft,
          toolResults: mjToolTrace,
          worldState: worldSnapshot,
          contextPack: rpContextPack,
          activeInterlocutor: worldSnapshot?.conversation?.activeInterlocutor ?? null,
          conversationMode
        });
        const worldIntentType = String(mjStructured?.worldIntent?.type ?? "none");
        if (worldIntentType === "propose_travel") {
          const targetFromAi = String(mjStructured?.worldIntent?.targetLabel ?? "").trim();
          const aiTargetLabel = targetFromAi || inferPlaceFromMessage(message, records) || "ce lieu";
          const currentWorld = loadNarrativeWorldState();
          const worldState = applyWorldDelta(
            currentWorld,
            { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed-ai" },
            { intentType: "system_command", transitionId: "travel.proposed.ai" }
          );
          const place = resolveOrCreateSessionPlace(aiTargetLabel, records, worldState);
          const fromLocation = sanitizeWorldLocation(worldState?.location);
          const toLocation = { id: place.id, label: place.label };
          const durationMin = estimateTravelMinutes(fromLocation, toLocation, "free_exploration");
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: null,
            pendingTravel: sanitizePendingTravel({
              placeId: place.id,
              placeLabel: place.label,
              question: oneLine(message, 140),
              sourceLoreIds: records.slice(0, 3).map((entry) => String(entry?.id ?? "")).filter(Boolean),
              createdAt: new Date().toISOString()
            }),
            pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess)
          };
          worldState.travel = sanitizeTravelState({
            ...(worldState.travel ?? {}),
            pending: {
              from: fromLocation,
              to: toLocation,
              durationMin,
              reason: "travel-proposed-ai",
              startedAt: new Date().toISOString()
            }
          });
          worldState.sessionPlaces = upsertSessionPlace(worldState?.sessionPlaces, {
            id: place.id,
            label: place.label,
            city: place.city ?? "",
            access: place.access ?? "public",
            tags: Array.isArray(place.tags) ? place.tags : [],
            riskFlags: Array.isArray(place.riskFlags) ? place.riskFlags : [],
            sources: Array.isArray(place.sources) ? place.sources : [],
            summary: place.summary ?? ""
          });
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          const advisory = mjStructured?.directAnswer
            ? `${oneLine(mjStructured.directAnswer, 220)}\n${buildVisitAdvisoryReply(place, records, worldState)}`
            : buildVisitAdvisoryReply(place, records, worldState);
          const injected = injectLockedStartContextReply(advisory, worldState, characterProfile);
          const aiTravelParts = parseReplyToMjBlocks(injected.reply);
          saveNarrativeWorldState(injected.worldState);
          return sendJson(res, 200, {
            reply: injected.reply,
            mjResponse: makeMjResponse({
              responseType: "clarification",
              directAnswer: oneLine(String(mjStructured?.directAnswer ?? ""), 220),
              scene: aiTravelParts.scene,
              actionResult: aiTravelParts.actionResult,
              consequences: aiTravelParts.consequences,
              options: aiTravelParts.options
            }),
            speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
            intent: {
              type: "story_action",
              confidence: Number(mjStructured?.confidence ?? 0.82),
              reason: "ai-worldintent-propose-travel"
            },
            director: { mode: "scene_only", applyRuntime: false, source: "ai-mj-structured" },
            worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "travel-proposed-ai" },
            worldState: injected.worldState,
            mjStructured,
            mjToolTrace,
            stateUpdated: false
          });
        }
        const shouldShortCircuit =
          Boolean(mjStructured) &&
          Boolean(mjStructured.bypassExistingMechanics) &&
          String(mjStructured?.worldIntent?.type ?? "none") === "none";
        if (shouldShortCircuit) {
          const currentWorld = loadNarrativeWorldState();
          const worldState = applyWorldDelta(
            currentWorld,
            { reputationDelta: 0, localTensionDelta: 0, reason: "mj-structured-scene" },
            { intentType: "lore_question", transitionId: "none" }
          );
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: sanitizePendingAction(worldSnapshot?.conversation?.pendingAction),
            pendingTravel: sanitizePendingTravel(worldSnapshot?.conversation?.pendingTravel),
            pendingAccess: sanitizePendingAccess(worldSnapshot?.conversation?.pendingAccess)
          };
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          const injected = injectLockedStartContextReply(
            buildMjReplyFromStructured(mjStructured),
            worldState,
            characterProfile
          );
          saveNarrativeWorldState(injected.worldState);
          return sendJson(res, 200, {
            reply: injected.reply,
            mjResponse: makeMjResponse({
              responseType: String(mjStructured?.responseType ?? "narration"),
              directAnswer: String(mjStructured?.directAnswer ?? ""),
              scene: String(mjStructured?.scene ?? ""),
              actionResult: String(mjStructured?.actionResult ?? ""),
              consequences: String(mjStructured?.consequences ?? ""),
              options: normalizeMjOptions(mjStructured?.options, 6)
            }),
            speaker: buildSpeakerPayload({
              conversationMode,
              intentType: "story_action",
              activeInterlocutor: worldSnapshot?.conversation?.activeInterlocutor ?? null
            }),
            intent: {
              type: "story_action",
              confidence: Number(mjStructured?.confidence ?? 0.72),
              reason: "mj-structured-shortcircuit"
            },
            director: { mode: "scene_only", applyRuntime: false, source: "ai-mj-structured" },
            worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "mj-structured-scene" },
            worldState: injected.worldState,
            mjStructured,
            mjToolTrace,
            stateUpdated: false
          });
        }
      }

      if (conversationMode === "hrp") {
        const contextPack = buildCharacterContextPack(characterProfile, worldSnapshot);
        const hrpAiResult = await hrpAiInterpreter.analyzeHrpQuery(message, contextPack);
        const hrpConfidenceThreshold = Number(process.env.HRP_AI_MIN_CONFIDENCE ?? 0.32);
        const hasAnswer = Boolean(String(hrpAiResult?.answer ?? "").trim());
        const toolTraceCount = Array.isArray(hrpAiResult?.toolTrace) ? hrpAiResult.toolTrace.length : 0;
        const evidenceCoverage = Number(hrpAiResult?.evidenceCoverage ?? 0);
        const aiConfidence = Number(hrpAiResult?.confidence ?? 0);
        const aiUsable =
          Boolean(hrpAiResult) &&
          hasAnswer &&
          (aiConfidence >= hrpConfidenceThreshold ||
            Boolean(hrpAiResult?.evidenceValid) ||
            evidenceCoverage >= 0.34 ||
            toolTraceCount > 0);
        const shouldClarify =
          Boolean(hrpAiResult) &&
          !aiUsable &&
          !hasAnswer &&
          aiConfidence < 0.45 &&
          evidenceCoverage < 0.2 &&
          toolTraceCount === 0 &&
          Boolean(hrpAiResult?.needsClarification);
        const clarification = hrpAiResult?.clarificationQuestion
          ? String(hrpAiResult.clarificationQuestion)
          : "Peux-tu préciser le champ visé (équipement, sorts, ressources, progression) ?";
        const hrpReply = aiUsable
          ? hrpAiResult.needsClarification && hrpAiResult.clarificationQuestion
            ? `${hrpAiResult.answer}\n${hrpAiResult.clarificationQuestion}`
            : hrpAiResult.answer
          : shouldClarify
          ? [
              "Je préfère clarifier pour éviter une réponse inexacte.",
              clarification
            ].join("\n")
          : hasAnswer
          ? String(hrpAiResult.answer)
          : buildHrpReply(message, characterProfile, worldSnapshot);
        const worldDelta = {
          reputationDelta: 0,
          localTensionDelta: 0,
          reason: "hrp-no-impact"
        };
        saveNarrativeWorldState(worldSnapshot);
        return sendJson(res, 200, {
          reply: hrpReply,
          mjResponse: makeMjResponse({
            responseType: "status",
            directAnswer: hrpReply
          }),
          speaker: buildSpeakerPayload({ conversationMode, forceSystem: true }),
          intent: {
            type: "system_command",
            confidence: Number(hrpAiResult?.confidence ?? 1),
            reason: hrpAiResult
              ? aiUsable
                ? `hrp-ai:${hrpAiResult.intent}`
                : `hrp-ai-fallback:${hrpAiResult.reason ?? "untrusted"}`
              : "hrp-mode"
          },
          director: {
            mode: "hrp",
            applyRuntime: false,
            source: hrpAiResult ? (aiUsable ? "ai" : "policy") : "policy"
          },
          hrpAnalysis: hrpAiResult
            ? {
                intent: hrpAiResult.intent,
                confidence: hrpAiResult.confidence,
                needsClarification: hrpAiResult.needsClarification,
                evidence: hrpAiResult.evidence,
                evidenceValid: hrpAiResult.evidenceValid,
                evidenceCoverage: hrpAiResult.evidenceCoverage,
                validEvidence: hrpAiResult.validEvidence,
                invalidEvidence: hrpAiResult.invalidEvidence,
                reason: hrpAiResult.reason,
                planner: hrpAiResult.planner ?? null,
                toolTrace: hrpAiResult.toolTrace ?? []
              }
            : null,
          worldDelta,
          worldState: worldSnapshot,
          stateUpdated: false
        });
      }

      if (conversationMode === "rp" && isRpSheetQuestion(message)) {
        const worldState = applyWorldDelta(
          loadNarrativeWorldState(),
          { reputationDelta: 0, localTensionDelta: 0, reason: "rp-sheet-query" },
          { intentType: "lore_question", transitionId: "none" }
        );
        if (characterProfile) {
          worldState.startContext = {
            ...(worldState.startContext ?? {}),
            characterSnapshot: characterProfile
          };
        }
        worldState.conversation = {
          ...(worldState.conversation ?? {}),
          activeInterlocutor:
            worldSnapshot?.conversation?.activeInterlocutor == null
              ? null
              : String(worldSnapshot.conversation.activeInterlocutor)
        };
        saveNarrativeWorldState(worldState);
        return sendJson(res, 200, {
          reply: buildRpSheetAwareReply(message, characterProfile, worldState),
          mjResponse: makeMjResponse({
            responseType: "status",
            directAnswer: buildRpSheetAwareReply(message, characterProfile, worldState)
          }),
          speaker: buildSpeakerPayload({ conversationMode, intentType: "lore_question" }),
          intent: { type: "lore_question", confidence: 0.85, reason: "rp-sheet-query" },
          director: { mode: "scene_only", applyRuntime: false, source: "policy" },
          worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "rp-sheet-query" },
          worldState,
          stateUpdated: false
        });
      }

      if (conversationMode === "rp") {
        let rpActionAssessment = await rpActionValidator.assess(message, rpContextPack);
        if (rpActionAssessment?.isActionQuery && rpActionAssessment.actionType === "cast_spell") {
          const slotAvailable = hasRemainingSpellSlotsForRp(worldSnapshot, rpContextPack);
          if (!slotAvailable) {
            rpActionAssessment = {
              ...rpActionAssessment,
              allowed: false,
              reason: "Plus aucun emplacement de sort disponible pour le moment.",
              serverEvidence: {
                ...(rpActionAssessment.serverEvidence ?? {}),
                hasSlot: false
              }
            };
          }
        }
        if (rpActionAssessment?.isActionQuery) {
          const currentWorld = loadNarrativeWorldState();
          const worldState = applyWorldDelta(
            currentWorld,
            { reputationDelta: 0, localTensionDelta: 0, reason: "rp-action-validation" },
            { intentType: "story_action", transitionId: "none" }
          );
          if (characterProfile) {
            worldState.startContext = {
              ...(worldState.startContext ?? {}),
              characterSnapshot: characterProfile
            };
          }
          worldState.conversation = {
            ...(worldState.conversation ?? {}),
            activeInterlocutor:
              worldSnapshot?.conversation?.activeInterlocutor == null
                ? null
                : String(worldSnapshot.conversation.activeInterlocutor),
            pendingAction: sanitizePendingAction({
              ...rpActionAssessment,
              createdAt: new Date().toISOString()
            })
          };
          saveNarrativeWorldState(worldState);
          return sendJson(res, 200, {
            reply: buildRpActionValidationReply(rpActionAssessment),
            mjResponse: makeMjResponse({
              responseType: "clarification",
              scene: `Validation serveur: ${rpActionAssessment.allowed ? "possible" : "bloquee"}.`,
              actionResult: String(rpActionAssessment.reason ?? ""),
              consequences: "",
              options: []
            }),
            speaker: buildSpeakerPayload({ conversationMode, intentType: "story_action" }),
            intent: {
              type: "story_action",
              confidence: 0.84,
              reason: `rp-action-validation:${rpActionAssessment.actionType}`
            },
            director: { mode: "scene_only", applyRuntime: false, source: "validator" },
            rpActionValidation: rpActionAssessment,
            worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "rp-action-validation" },
            worldState,
            stateUpdated: false
          });
        }
      }

      const aiDecision = await classifyNarrationWithAI(message, records, worldSnapshot);
      if (aiDecision) {
        intent = aiDecision.intent;
        directorPlan = aiDecision.director;
      }
      if (shouldForceSceneLocalRouting({ message, conversationMode, worldState: worldSnapshot })) {
        intent = {
          type: "social_action",
          confidence: Math.max(Number(intent?.confidence ?? 0.6), 0.82),
          requiresCheck: true,
          riskLevel: "medium",
          reason: "policy-local-scene-routing"
        };
        directorPlan = {
          mode: "scene_only",
          applyRuntime: false,
          source: "policy-local-scene-routing"
        };
      }
      const loreQuestion = directorPlan.mode === "lore";
      const freeExploration = directorPlan.mode === "exploration";
      const activeInterlocutor =
        worldSnapshot?.conversation?.activeInterlocutor == null
          ? null
          : String(worldSnapshot.conversation.activeInterlocutor);

      if (loreQuestion) {
        const currentWorld = loadNarrativeWorldState();
        const worldState = applyWorldDelta(
          currentWorld,
          { reputationDelta: 0, localTensionDelta: 0, reason: "no-impact-intent" },
          { intentType: intent.type, transitionId: "none" }
        );
        if (characterProfile) {
          worldState.startContext = {
            ...(worldState.startContext ?? {}),
            characterSnapshot: characterProfile
          };
        }
        worldState.conversation = {
          ...(worldState.conversation ?? {}),
          activeInterlocutor: activeInterlocutor
        };
        const worldDelta = {
          reputationDelta: 0,
          localTensionDelta: 0,
          reason: "no-impact-intent"
        };
        const injected = injectLockedStartContextReply(
          addInterlocutorNote(buildLoreOnlyReply(message, records, characterProfile), activeInterlocutor, intent.type),
          worldState,
          characterProfile
        );
        const loreParts = parseReplyToMjBlocks(injected.reply);
        saveNarrativeWorldState(injected.worldState);
        return sendJson(res, 200, {
          reply: injected.reply,
          mjResponse: makeMjResponse({
            responseType: "status",
            scene: loreParts.scene,
            actionResult: loreParts.actionResult,
            consequences: loreParts.consequences,
            options: loreParts.options
          }),
          speaker: buildSpeakerPayload({
            conversationMode,
            intentType: intent.type,
            activeInterlocutor
          }),
          loreRecordsUsed: records.length,
          intent,
          director: directorPlan,
          worldDelta,
          worldState: injected.worldState,
          loreOnly: true,
          stateUpdated: false
        });
      }

      if (freeExploration) {
        const currentWorld = loadNarrativeWorldState();
        const worldState = applyWorldDelta(
          currentWorld,
          { reputationDelta: 0, localTensionDelta: 0, reason: "no-impact-intent" },
          { intentType: intent.type, transitionId: "none" }
        );
        if (characterProfile) {
          worldState.startContext = {
            ...(worldState.startContext ?? {}),
            characterSnapshot: characterProfile
          };
        }
        worldState.conversation = {
          ...(worldState.conversation ?? {}),
          activeInterlocutor: activeInterlocutor
        };
        const worldDelta = {
          reputationDelta: 0,
          localTensionDelta: 0,
          reason: "no-impact-intent"
        };
        const injected = injectLockedStartContextReply(buildExplorationReply(message, records), worldState, characterProfile);
        const explorationParts = parseReplyToMjBlocks(injected.reply);
        saveNarrativeWorldState(injected.worldState);
        return sendJson(res, 200, {
          reply: injected.reply,
          mjResponse: makeMjResponse({
            responseType: "narration",
            scene: explorationParts.scene,
            actionResult: explorationParts.actionResult,
            consequences: explorationParts.consequences,
            options: explorationParts.options
          }),
          speaker: buildSpeakerPayload({
            conversationMode,
            intentType: intent.type,
            activeInterlocutor
          }),
          loreRecordsUsed: records.length,
          intent,
          director: directorPlan,
          worldDelta,
          worldState: injected.worldState,
          explorationOnly: true,
          stateUpdated: false
        });
      }

      const runtimeAllowedByDirector = Boolean(directorPlan.applyRuntime);
      const heuristicRuntimeGate =
        directorPlan.source === "heuristic" ? shouldApplyRuntimeForIntent(message, intent) : true;
      if (requiresInterlocutorInRp(intent, message, activeInterlocutor)) {
        const currentWorld = loadNarrativeWorldState();
        currentWorld.conversation = {
          ...(currentWorld.conversation ?? {}),
          activeInterlocutor: null
        };
        saveNarrativeWorldState(currentWorld);
        return sendJson(res, 200, {
          reply: buildRpNeedInterlocutorReply(records),
          speaker: buildSpeakerPayload({ conversationMode, intentType: "social_action" }),
          loreRecordsUsed: records.length,
          intent,
          director: { ...directorPlan, mode: "scene_only", applyRuntime: false },
          worldDelta: { reputationDelta: 0, localTensionDelta: 0, reason: "missing-interlocutor" },
          worldState: currentWorld,
          stateUpdated: false
        });
      }

      if (!runtimeAllowedByDirector || !heuristicRuntimeGate) {
        const currentWorld = loadNarrativeWorldState();
        const worldDelta = isCombatActionIntent(message)
          ? { reputationDelta: 0, localTensionDelta: 2, reason: "scene-only-combat-pressure" }
          : { reputationDelta: 0, localTensionDelta: 0, reason: "scene-only-no-runtime-trigger" };
        const worldState = applyWorldDelta(currentWorld, worldDelta, {
          intentType: intent.type,
          transitionId: "none"
        });
        if (characterProfile) {
          worldState.startContext = {
            ...(worldState.startContext ?? {}),
            characterSnapshot: characterProfile
          };
        }
        worldState.conversation = {
          ...(worldState.conversation ?? {}),
          activeInterlocutor: activeInterlocutor
        };
        const injected = injectLockedStartContextReply(
          addInterlocutorNote(buildDirectorNoRuntimeReply(message, intent.type, records), activeInterlocutor, intent.type),
          worldState,
          characterProfile
        );
        const sceneOnlyParts = parseReplyToMjBlocks(injected.reply);
        saveNarrativeWorldState(injected.worldState);

        return sendJson(res, 200, {
          reply: injected.reply,
          mjResponse: makeMjResponse({
            responseType: "narration",
            scene: sceneOnlyParts.scene,
            actionResult: sceneOnlyParts.actionResult,
            consequences: sceneOnlyParts.consequences,
            options: sceneOnlyParts.options
          }),
          speaker: buildSpeakerPayload({
            conversationMode,
            intentType: intent.type,
            activeInterlocutor
          }),
          loreRecordsUsed: records.length,
          intent,
          director: { ...directorPlan, mode: "scene_only", applyRuntime: false },
          worldDelta,
          worldState: injected.worldState,
          stateUpdated: true
        });
      }

      const generator = OPENAI_API_KEY
        ? new runtime.OpenAIMjNarrationGenerator({
            apiKey: OPENAI_API_KEY,
            model: process.env.NARRATION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"
          })
        : new runtime.HeuristicMjNarrationGenerator();

      const outcome = await api.tickNarrationWithAI(
        {
          query: message,
          records,
          playerProfile: buildPlayerProfileInput(characterProfile),
          entityHints: {
            quest: Object.keys(state.quests),
            trama: Object.keys(state.tramas),
            companion: Object.keys(state.companions),
            trade: Object.keys(state.trades)
          },
          minHoursBetweenMajorEvents: 1,
          blockOnGuardFailure: true
        },
        generator
      );
      const worldDelta = computeWorldDelta({ intent, outcome });
      const currentWorld = loadNarrativeWorldState();
      const transitionId = outcome?.appliedOutcome?.result?.transitionId ?? "none";
      const worldState = applyWorldDelta(currentWorld, worldDelta, {
        intentType: intent.type,
        transitionId
      });
      if (characterProfile) {
        worldState.startContext = {
          ...(worldState.startContext ?? {}),
          characterSnapshot: characterProfile
        };
      }
      worldState.conversation = {
        ...(worldState.conversation ?? {}),
        activeInterlocutor: activeInterlocutor
      };
      const injected = injectLockedStartContextReply(
        addInterlocutorNote(buildNarrationChatReply(outcome, intent.type), activeInterlocutor, intent.type),
        worldState,
        characterProfile
      );
      const runtimeParts = parseReplyToMjBlocks(injected.reply);
      saveNarrativeWorldState(injected.worldState);

      return sendJson(res, 200, {
        reply: injected.reply,
        mjResponse: makeMjResponse({
          responseType: "resolution",
          scene: runtimeParts.scene,
          actionResult: runtimeParts.actionResult,
          consequences: runtimeParts.consequences,
          options: runtimeParts.options
        }),
        speaker: buildSpeakerPayload({
          conversationMode,
          intentType: intent.type,
          activeInterlocutor
        }),
        loreRecordsUsed: records.length,
        intent,
        director: directorPlan,
        worldDelta,
        worldState: injected.worldState,
        outcome,
        stateUpdated: true
      });
    } catch (err) {
      console.error("[narration-chat] Erreur:", err?.message ?? err);
      return sendJson(res, 500, { error: "Chat narration impossible" });
    }
  }

  // API bulles ennemies (1-2 lignes, generees a chaque tour d'ennemi)
  if (req.method === "POST" && req.url === "/api/enemy-speech") {
    try {
      const body = await parseJsonBody(req);

      if (!OPENAI_API_KEY) {
        return sendJson(res, 200, { line: "" });
      }

      const model = process.env.ENEMY_SPEECH_MODEL || "gpt-4.1-mini";

      const systemPrompt =
        "Tu ecris une bulle de dialogue d'ennemi dans un combat heroic-fantasy. " +
        "FRANCAIS uniquement. " +
        "Contraintes: 1 ou 2 lignes maximum (au plus un saut de ligne). " +
        "C'est une phrase prononcee a voix haute (pas de narration), adapte le style au speechProfile/role/perception. " +
        "L'ennemi peut parler meme s'il ne voit pas le joueur. " +
        "Il peut aussi choisir de rester silencieux pour rester discret: dans ce cas, renvoie { \"line\": \"\" }. " +
        "Tu peux reagir aux priorSpeechesThisRound (dans l'ordre), mais ne simule pas de reponse immediate hors tour. " +
        "Interdit: meta-jeu, references modernes, mentions d'IA. " +
        "Repond STRICTEMENT en JSON: { \"line\": \"...\" }.";

      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload: body
      });

      if (!parsed || typeof parsed.line !== "string") {
        return sendJson(res, 200, { line: "" });
      }

      // Sanitize: max 2 lines
      const raw = parsed.line;
      const lines = String(raw).split(/\r?\n/).slice(0, 2);
      const line = lines.join("\n").trim();

      return sendJson(res, 200, { line });
    } catch (err) {
      console.error("[enemy-speech] Erreur:", err.message);
      return sendJson(res, 200, { line: "" });
    }
  }

  // Ã€ partir d'ici : route "front" -> servir les fichiers de dist/
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      let pathname = url.pathname;

      // Cas racine : index.html
      if (pathname === "/" || pathname === "") {
        return serveFile(INDEX_HTML, "text/html; charset=utf-8", res);
      }

      // Fichiers statiques sous dist (JS, CSS, assets...)
      const safePath = pathname.replace(/^\//, "");
      let decodedPath = safePath;
      try {
        decodedPath = decodeURIComponent(safePath);
      } catch (err) {
        console.warn("[server] URL decode failed for:", safePath);
      }
      const filePath = path.join(DIST_DIR, decodedPath);

      // Protection simple contre les sorties de dossier
      if (!filePath.startsWith(DIST_DIR)) {
        return sendNotFound(res);
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = getContentType(ext);
        return serveFile(filePath, contentType, res);
      }

      // Fallback SPA : renvoyer index.html pour les routes inconnues
      if (fs.existsSync(INDEX_HTML)) {
        return serveFile(INDEX_HTML, "text/html; charset=utf-8", res);
      }

      return sendNotFound(res);
    } catch (err) {
      console.error("[server] Erreur lors de la gestion statique:", err);
      return sendNotFound(res);
    }
  }

  // MÃ©thode non gÃ©rÃ©e
  if (typeof req.url === "string" && req.url.startsWith("/api/")) {
    return sendApiNotFound(res);
  }
  sendNotFound(res);
});

server.listen(PORT, () => {
  console.log(`[test-GAME] Serveur en Ã©coute sur http://localhost:${PORT}`);
});

// ----------------------------------------------------
// Helpers pour les fichiers statiques
// ----------------------------------------------------

function getContentType(ext) {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function serveFile(filePath, contentType, res) {
  try {
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      "Content-Type": contentType
    });
    stream.pipe(res);
  } catch (err) {
    console.error("[server] Erreur lecture fichier:", err);
    sendNotFound(res);
  }
}

function sendNotFound(res) {
  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end("Not found");
}

function sendApiNotFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

