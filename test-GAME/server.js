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

async function callOpenAiForEnemyDecisions(stateSummary) {
  if (!OPENAI_API_KEY) {
    // Pas de clé : on renvoie un tableau vide, le front fera un fallback local.
    return { decisions: [] };
  }

  const model = process.env.ENEMY_AI_MODEL || "gpt-4.1-mini";

  const systemPrompt =
    "Tu es le controleur tactique des ennemis dans un jeu de combat au tour par tour sur grille. " +
    "On te fournit l'etat du plateau (joueur, ennemis, dimensions, types d'ennemis). " +
    "Tu dois proposer UNE action par ennemi (move, attack ou wait) et rien d'autre. " +
    "Respecte strictement les contraintes suivantes : " +
    "- Utilise uniquement les enemyId fournis dans l'etat. " +
    "- Ne depasse jamais les limites de la grille. " +
    "- Les deplacements ne peuvent pas depasser 3 cases en distance de Manhattan. " +
    "- Une attaque ne peut avoir lieu que si la cible est a distance 1 (Manhattan <= 1). " +
    "- Pour une action move, tu dois fournir targetX et targetY (entiers). " +
    "- Integre le type d'ennemi (aiRole/type) pour prioriser la cible: brute avance vers le joueur, archer prefere garder la distance, assassin cherche le contact rapide. " +
    "Repond UNIQUEMENT avec un JSON valide de la forme { \"decisions\": [ { \"enemyId\": \"...\", \"action\": \"move|attack|wait\", \"targetX\": nombre, \"targetY\": nombre } ] } sans aucun texte autour. " +
    "Exemple: { \"decisions\": [ { \"enemyId\": \"enemy-1\", \"action\": \"move\", \"targetX\": 3, \"targetY\": 2 } ] }";

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

  if (!parsed.decisions || !Array.isArray(parsed.decisions)) {
    throw new Error("Reponse OpenAI invalide: champ decisions manquant.");
  }

  const enemyIds = new Set(
    Array.isArray(stateSummary?.enemies)
      ? stateSummary.enemies.map(e => e.id).filter(Boolean)
      : []
  );
  const validActions = new Set(["move", "attack", "wait"]);
  const sanitized = parsed.decisions.filter(d => {
    if (!d || typeof d !== "object") return false;
    if (!enemyIds.has(d.enemyId)) {
      console.warn("[enemy-ai] Decision ignoree (enemyId inconnu):", d);
      return false;
    }
    const action = typeof d.action === "string" ? d.action.toLowerCase() : "";
    if (!validActions.has(action)) {
      console.warn("[enemy-ai] Decision ignoree (action invalide):", d);
      return false;
    }
    if (action === "move") {
      if (typeof d.targetX !== "number" || typeof d.targetY !== "number") {
        console.warn("[enemy-ai] Decision move ignoree (cible manquante):", d);
        return false;
      }
    }
    return true;
  });

  const logged = sanitized.map(d => ({
    enemyId: d.enemyId,
    action: d.action,
    targetX: d.targetX,
    targetY: d.targetY
  }));
  console.log("[enemy-ai] Decisions IA retenues:", logged);

  return { decisions: sanitized };
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
        result = await callOpenAiForEnemyDecisions(stateSummary);
      } catch (err) {
        console.error("[enemy-ai] Erreur appel OpenAI:", err.message);
        // En cas d'erreur API, on renvoie quand même une forme valide
        result = { decisions: [] };
      }

      if (!result.decisions || result.decisions.length === 0) {
        console.warn("[enemy-ai] Aucune décision IA renvoyée (fallback probable).");
      }

      sendJson(res, 200, result);
    } catch (err) {
      console.error("[enemy-ai] Erreur de traitement:", err.message);
      sendJson(res, 400, { error: "Bad request" });
    }
    return;
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
