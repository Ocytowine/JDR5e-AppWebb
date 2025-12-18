// Serveur unique pour test-GAME
// -----------------------------
// - Expose POST /api/enemy-ai (IA ennemis via ChatGPT)
// - Sert le front statique depuis le dossier dist (comme test-LORE)
// - Lit OPENAI_API_KEY via process.env ou .env (clé jamais envoyée au front)
//
// Workflow conseillé :
//   cd test-GAME
//   npm run build        // génère dist/
//   npm run dev          // lance ce serveur (node server.js)
//   ouvrir http://localhost:5175

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT
  ? Number(process.env.PORT)
  : process.env.ENEMY_AI_PORT
  ? Number(process.env.ENEMY_AI_PORT)
  : 5175;

const DIST_DIR = path.join(__dirname, "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");

// ----------------------------------------------------
// Lecture de la clé API OpenAI
// ----------------------------------------------------

function loadOpenAiApiKey() {
  // 1) Priorité à la variable d'environnement directe
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
    "[enemy-ai] Aucun OPENAI_API_KEY trouvé. " +
      "Le serveur répondra mais sans appeler l'API OpenAI (fallback local)."
  );
} else {
  console.log("[enemy-ai] Clé OpenAI détectée, appels IA activés.");
}

// ----------------------------------------------------
// Helpers HTTP
// ----------------------------------------------------

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  });
  res.end(body);
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
// Appel à l'API OpenAI (Chat Completions JSON)
// ----------------------------------------------------

async function callOpenAiForEnemyIntents(stateSummary) {
  if (!OPENAI_API_KEY) {
    // Pas de clé : on renvoie un tableau vide, le front fera un fallback local.
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
    "- Pour une action de deplacement (ex: enemy-move), renvoie target.kind='cell' avec x,y entiers dans la grille. " +
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
    throw new Error("Réponse OpenAI sans contenu message.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error("Impossible de parser la réponse OpenAI en JSON.");
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
    throw new Error("Réponse OpenAI sans contenu message.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Impossible de parser la réponse OpenAI en JSON.");
  }
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
        // En cas d'erreur API, on renvoie quand même une forme valide
        result = { intents: [] };
      }

      if (!result.intents || result.intents.length === 0) {
        console.warn("[enemy-ai] Aucune décision IA renvoyée (fallback probable).");
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
        "Priorite: mentionne toujours les coups qui touchent et font baisser les PV de manière roleplay (player_attack/enemy_attack avec damage > 0, ou baisse de PV entre stateStart et stateEnd), en citant l'auteur et la nature de l'attaque. " +
        "Si une attaque rate (isHit=false), tu peux le resumer brièvement si tu as la place. " +
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

  // À partir d'ici : route "front" -> servir les fichiers de dist/
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
      const filePath = path.join(DIST_DIR, safePath);

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

  // Méthode non gérée
  sendNotFound(res);
});

server.listen(PORT, () => {
  console.log(`[test-GAME] Serveur en écoute sur http://localhost:${PORT}`);
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
