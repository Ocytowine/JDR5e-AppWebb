const fs = require("fs");
const path = require("path");
const { parseFrontMatter } = require("./wikiFrontMatterParser");

function buildSnippet(text, maxChars = 260) {
  const raw = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, maxChars - 3).trim()}...`;
}

function createMapModuleApi({ projectRoot, sendJson }) {
  const wikiLoreRoot = path.resolve(projectRoot, "..", "wiki", "lore");
  let cachedDocs = null;
  let cachedMtime = 0;

  function computeTreeMtime(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    let maxMtime = 0;
    const stack = [dirPath];
    while (stack.length > 0) {
      const current = stack.pop();
      let stat = null;
      try {
        stat = fs.statSync(current);
      } catch {
        continue;
      }
      maxMtime = Math.max(maxMtime, Number(stat.mtimeMs || 0));
      if (!stat.isDirectory()) continue;
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        stack.push(path.join(current, entry.name));
      }
    }
    return maxMtime;
  }

  function rebuildIndex() {
    const docsById = {};
    if (!fs.existsSync(wikiLoreRoot)) {
      cachedDocs = docsById;
      cachedMtime = 0;
      return docsById;
    }

    const stack = [wikiLoreRoot];
    while (stack.length > 0) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;

        let raw = "";
        try {
          raw = fs.readFileSync(fullPath, "utf-8");
        } catch {
          continue;
        }

        const parsed = parseFrontMatter(raw);
        const entityId = String(parsed.frontMatter.id ?? path.basename(fullPath)).trim();
        if (!entityId) continue;

        docsById[entityId] = {
          id: entityId,
          type: String(parsed.frontMatter.type ?? "").trim(),
          name: String(parsed.frontMatter.nom ?? entityId).trim(),
          relativePath: path.relative(wikiLoreRoot, fullPath).replace(/\\/g, "/"),
          frontMatter: parsed.frontMatter,
          snippet: buildSnippet(parsed.body),
          body: parsed.body
        };
      }
    }

    cachedDocs = docsById;
    cachedMtime = computeTreeMtime(wikiLoreRoot);
    return docsById;
  }

  function getDocsById() {
    const currentMtime = computeTreeMtime(wikiLoreRoot);
    if (!cachedDocs || currentMtime !== cachedMtime) {
      return rebuildIndex();
    }
    return cachedDocs;
  }

  async function tryHandle(req, res) {
    if (req.method !== "GET") return false;
    if (!req.url || !req.url.startsWith("/api/map-module/wiki-entries")) return false;

    const url = new URL(req.url, "http://localhost");
    const types = url.searchParams
      .get("types")
      ?.split(",")
      .map(item => item.trim().toLowerCase())
      .filter(Boolean) ?? [];
    const all = url.searchParams.get("all") === "1";
    const ids = url.searchParams
      .get("ids")
      ?.split(",")
      .map(item => item.trim())
      .filter(Boolean) ?? [];

    const docsById = getDocsById();
    let entries = all || ids.length === 0
      ? Object.values(docsById)
      : ids
        .map(id => docsById[id] ?? null)
        .filter(Boolean);

    if (types.length > 0) {
      entries = entries.filter(entry => types.includes(String(entry.type ?? "").trim().toLowerCase()));
    }

    return sendJson(res, 200, {
      root: wikiLoreRoot,
      count: entries.length,
      entries
    });
  }

  return { tryHandle };
}

module.exports = { createMapModuleApi };
