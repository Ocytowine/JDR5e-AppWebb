const fs = require("fs");
const path = require("path");
const { parseFrontMatter } = require("./wikiFrontMatterParser");

function sanitizeLayoutSource(value) {
  if (!value || typeof value !== "object") return null;
  const candidate = value;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.backgroundImageKey !== "string" ||
    !candidate.grid ||
    !candidate.defaultLayers ||
    !Array.isArray(candidate.governanceTerritories ?? []) ||
    !Array.isArray(candidate.governanceRegions ?? []) ||
    !Array.isArray(candidate.governances ?? []) ||
    !Array.isArray(candidate.geographicZones ?? []) ||
    !Array.isArray(candidate.cities) ||
    !Array.isArray(candidate.paths) ||
    !Array.isArray(candidate.cliffSegments ?? []) ||
    !Array.isArray(candidate.cells) ||
    !Array.isArray(candidate.editorPresets?.customGeographies ?? []) ||
    !Array.isArray(candidate.editorPresets?.customTags ?? [])
  ) {
    return null;
  }
  return candidate;
}

function buildSnippet(text, maxChars = 260) {
  const raw = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, maxChars - 3).trim()}...`;
}

function getCellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function getOddRNeighbors(cell) {
  const isOddRow = Math.abs(cell.y % 2) === 1;
  const deltas = isOddRow
    ? [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      ]
    : [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: -1, y: -1 },
        { x: 0, y: -1 },
        { x: -1, y: 1 },
        { x: 0, y: 1 }
      ];
  return deltas.map(delta => ({ x: cell.x + delta.x, y: cell.y + delta.y }));
}

function areNeighborCells(first, second) {
  const secondKey = getCellKey(second);
  return getOddRNeighbors(first).some(candidate => getCellKey(candidate) === secondKey);
}

function hasCliffBetweenCells(source, first, second) {
  const firstKey = getCellKey(first);
  const secondKey = getCellKey(second);
  return (source.cliffSegments ?? []).some(segment => {
    const aKey = getCellKey(segment.a);
    const bKey = getCellKey(segment.b);
    return (aKey === firstKey && bKey === secondKey) || (aKey === secondKey && bKey === firstKey);
  });
}

function validateLayoutPathRules(source) {
  const cellsByKey = new Map((source.cells ?? []).map(cell => [getCellKey(cell.cell), cell]));
  const issues = [];

  function isLand(cell) {
    return cellsByKey.get(getCellKey(cell))?.surface === "land";
  }

  function isOcean(cell) {
    return cellsByKey.get(getCellKey(cell))?.surface === "ocean";
  }

  (source.paths ?? []).forEach(pathEntry => {
    if (!Array.isArray(pathEntry.cells) || pathEntry.cells.length === 0) return;
    pathEntry.cells.forEach((cell, index) => {
      const label = pathEntry.label || pathEntry.id || "trace";
      if (pathEntry.kind === "road" && !isLand(cell)) {
        issues.push(`La route ${label} passe sur une case non terrestre (${cell.x},${cell.y}).`);
      }
      if (pathEntry.kind === "river") {
        const isLast = index === pathEntry.cells.length - 1;
        if (index === 0 && !isLand(cell)) {
          issues.push(`Le cours d'eau ${label} doit commencer sur terre.`);
        } else if (!isLast && !isLand(cell)) {
          issues.push(`Le cours d'eau ${label} doit rester sur terre avant son embouchure.`);
        } else if (isLast && !isOcean(cell)) {
          issues.push(`Le cours d'eau ${label} doit se terminer en mer.`);
        }
      }
      if (index === 0) return;
      const previous = pathEntry.cells[index - 1];
      if (!areNeighborCells(previous, cell)) {
        issues.push(`Le trace ${label} saute des cases entre (${previous.x},${previous.y}) et (${cell.x},${cell.y}).`);
      }
      if (pathEntry.kind === "road" && hasCliffBetweenCells(source, previous, cell)) {
        issues.push(`La route ${label} traverse une falaise entre (${previous.x},${previous.y}) et (${cell.x},${cell.y}).`);
      }
    });
  });

  return issues;
}

function createMapModuleApi({ projectRoot, sendJson, parseJsonBody }) {
  const wikiLoreRoot = path.resolve(projectRoot, "..", "wiki", "lore");
  const mapDataRoot = path.resolve(projectRoot, "map-module", "data");
  const mapLayoutPath = path.resolve(mapDataRoot, "worldMapLayout.json");
  const mapLayoutsDir = path.resolve(mapDataRoot, "layouts");
  let cachedDocs = null;
  let cachedMtime = 0;

  function sanitizeLayoutKey(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw || raw === "default") return "default";
    const normalized = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return normalized || "default";
  }

  function ensureLayoutsDirectory() {
    if (!fs.existsSync(mapLayoutsDir)) {
      fs.mkdirSync(mapLayoutsDir, { recursive: true });
    }
  }

  function resolveLayoutPath(layoutKey) {
    const key = sanitizeLayoutKey(layoutKey);
    if (key === "default") {
      return { key, path: mapLayoutPath, isDefault: true };
    }
    ensureLayoutsDirectory();
    return {
      key,
      path: path.resolve(mapLayoutsDir, `${key}.json`),
      isDefault: false
    };
  }

  function listAvailableLayouts() {
    const descriptors = [];

    function pushDescriptor(layoutPath, key, isDefault) {
      try {
        const raw = fs.readFileSync(layoutPath, "utf-8");
        const parsed = JSON.parse(raw);
        const source = sanitizeLayoutSource(parsed);
        if (!source) return;
        descriptors.push({
          key,
          title: source.title,
          id: source.id,
          path: layoutPath,
          isDefault
        });
      } catch {
        // Ignore invalid files in the list and keep the API resilient.
      }
    }

    if (fs.existsSync(mapLayoutPath)) {
      pushDescriptor(mapLayoutPath, "default", true);
    }

    ensureLayoutsDirectory();
    let files = [];
    try {
      files = fs.readdirSync(mapLayoutsDir, { withFileTypes: true });
    } catch {
      files = [];
    }
    files
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach(entry => {
        const key = entry.name.replace(/\.json$/i, "");
        pushDescriptor(path.join(mapLayoutsDir, entry.name), key, false);
      });

    return descriptors;
  }

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

  function readLayoutSource(layoutKey) {
    const target = resolveLayoutPath(layoutKey);
    const raw = fs.readFileSync(target.path, "utf-8");
    const parsed = JSON.parse(raw);
    const source = sanitizeLayoutSource(parsed);
    if (!source) {
      throw new Error(`Structure layout invalide pour ${target.key}.`);
    }
    return { source, path: target.path, key: target.key, isDefault: target.isDefault };
  }

  function writeLayoutSource(source, layoutKey) {
    const target = resolveLayoutPath(layoutKey);
    if (!target.isDefault) {
      ensureLayoutsDirectory();
    }
    const normalized = `${JSON.stringify(source, null, 2)}\n`;
    const tempPath = `${target.path}.tmp`;
    fs.writeFileSync(tempPath, normalized, "utf-8");
    fs.renameSync(tempPath, target.path);
    return readLayoutSource(target.key);
  }

  function duplicateLayout(sourceKey, targetKey) {
    const source = readLayoutSource(sourceKey);
    const target = resolveLayoutPath(targetKey);
    if (target.isDefault) {
      throw new Error("La duplication vers le layout par defaut est interdite.");
    }
    if (fs.existsSync(target.path)) {
      throw new Error(`Le layout ${target.key} existe deja.`);
    }
    const normalized = `${JSON.stringify(source.source, null, 2)}\n`;
    fs.writeFileSync(target.path, normalized, "utf-8");
    return readLayoutSource(target.key);
  }

  function renameLayout(sourceKey, targetKey) {
    const source = resolveLayoutPath(sourceKey);
    const target = resolveLayoutPath(targetKey);
    if (source.isDefault) {
      throw new Error("Le layout par defaut ne peut pas etre renomme.");
    }
    if (target.isDefault) {
      throw new Error("Le layout par defaut ne peut pas etre ecrase.");
    }
    if (!fs.existsSync(source.path)) {
      throw new Error(`Layout source introuvable: ${source.key}.`);
    }
    if (fs.existsSync(target.path)) {
      throw new Error(`Le layout ${target.key} existe deja.`);
    }
    fs.renameSync(source.path, target.path);
    return readLayoutSource(target.key);
  }

  function deleteLayout(layoutKey) {
    const target = resolveLayoutPath(layoutKey);
    if (target.isDefault) {
      throw new Error("Le layout par defaut ne peut pas etre supprime.");
    }
    if (!fs.existsSync(target.path)) {
      throw new Error(`Layout introuvable: ${target.key}.`);
    }
    fs.unlinkSync(target.path);
    return { key: target.key, path: target.path };
  }

  async function tryHandle(req, res) {
    if (!req.url) return false;

    if (req.method === "GET" && req.url.startsWith("/api/map-module/wiki-entries")) {
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

    if (req.method === "GET" && req.url.startsWith("/api/map-module/layouts")) {
      try {
        return sendJson(res, 200, {
          layouts: listAvailableLayouts()
        });
      } catch (error) {
        return sendJson(res, 500, {
          error: error instanceof Error ? error.message : "Liste layouts impossible."
        });
      }
    }

    if (req.method === "GET" && req.url.startsWith("/api/map-module/layout")) {
      try {
        const url = new URL(req.url, "http://localhost");
        const layoutKey = url.searchParams.get("key") ?? "default";
        const result = readLayoutSource(layoutKey);
        return sendJson(res, 200, {
          key: result.key,
          path: result.path,
          isDefault: result.isDefault,
          source: result.source
        });
      } catch (error) {
        return sendJson(res, 500, {
          error: error instanceof Error ? error.message : "Lecture layout impossible."
        });
      }
    }

    if (req.method === "PUT" && req.url.startsWith("/api/map-module/layout")) {
      try {
        const url = new URL(req.url, "http://localhost");
        const layoutKey = url.searchParams.get("key") ?? "default";
        const body = await parseJsonBody(req);
        const source = sanitizeLayoutSource(body?.source ?? body);
        if (!source) {
          return sendJson(res, 400, { error: "Structure layout invalide." });
        }
        const pathIssues = validateLayoutPathRules(source);
        if (pathIssues.length > 0) {
          return sendJson(res, 400, { error: pathIssues[0] });
        }
        const result = writeLayoutSource(source, layoutKey);
        return sendJson(res, 200, {
          key: result.key,
          path: result.path,
          isDefault: result.isDefault,
          source: result.source
        });
      } catch (error) {
        return sendJson(res, 500, {
          error: error instanceof Error ? error.message : "Ecriture layout impossible."
        });
      }
    }

    if (req.method === "POST" && req.url.startsWith("/api/map-module/layout/duplicate")) {
      try {
        const body = await parseJsonBody(req);
        const sourceKey = body?.sourceKey ?? "default";
        const targetKey = body?.targetKey ?? "";
        const result = duplicateLayout(sourceKey, targetKey);
        return sendJson(res, 200, {
          key: result.key,
          path: result.path,
          isDefault: result.isDefault,
          source: result.source
        });
      } catch (error) {
        return sendJson(res, 500, {
          error: error instanceof Error ? error.message : "Duplication layout impossible."
        });
      }
    }

    if (req.method === "POST" && req.url.startsWith("/api/map-module/layout/rename")) {
      try {
        const body = await parseJsonBody(req);
        const sourceKey = body?.sourceKey ?? "";
        const targetKey = body?.targetKey ?? "";
        const result = renameLayout(sourceKey, targetKey);
        return sendJson(res, 200, {
          key: result.key,
          path: result.path,
          isDefault: result.isDefault,
          source: result.source
        });
      } catch (error) {
        return sendJson(res, 500, {
          error: error instanceof Error ? error.message : "Renommage layout impossible."
        });
      }
    }

    if (req.method === "DELETE" && req.url.startsWith("/api/map-module/layout")) {
      try {
        const url = new URL(req.url, "http://localhost");
        const layoutKey = url.searchParams.get("key") ?? "";
        const result = deleteLayout(layoutKey);
        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 500, {
          error: error instanceof Error ? error.message : "Suppression layout impossible."
        });
      }
    }

    return false;
  }

  return { tryHandle };
}

module.exports = { createMapModuleApi };
