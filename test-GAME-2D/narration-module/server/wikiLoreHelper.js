const fs = require("fs");
const path = require("path");

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function parseFrontMatter(raw) {
  const text = String(raw ?? "");
  if (!text.startsWith("---")) {
    return { frontMatter: {}, body: text.trim() };
  }
  const endMarker = "\n---";
  const endIdx = text.indexOf(endMarker, 3);
  if (endIdx < 0) {
    return { frontMatter: {}, body: text.trim() };
  }

  const frontRaw = text.slice(3, endIdx).trim();
  const body = text.slice(endIdx + endMarker.length).trim();
  const frontMatter = {};
  let currentListKey = "";

  for (const rawLine of frontRaw.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && currentListKey) {
      if (!Array.isArray(frontMatter[currentListKey])) {
        frontMatter[currentListKey] = [];
      }
      frontMatter[currentListKey].push(listMatch[1].trim());
      continue;
    }

    const keyVal = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!keyVal) continue;
    const key = keyVal[1].trim();
    const value = keyVal[2].trim();
    currentListKey = "";

    if (!value) {
      frontMatter[key] = [];
      currentListKey = key;
      continue;
    }

    frontMatter[key] = value;
  }

  return { frontMatter, body };
}

function buildSnippet(entry) {
  const body = String(entry.body ?? "").trim();
  if (body.length === 0) return "";
  return body.length > 320 ? `${body.slice(0, 320).trim()}...` : body;
}

function fileLooksLikeLore(filePath) {
  const normalized = normalizeText(filePath);
  return normalized.includes(`${path.sep}wiki${path.sep}lore${path.sep}`);
}

function createWikiLoreHelper(projectRoot) {
  const wikiLoreRoot = path.resolve(projectRoot, "..", "wiki", "lore");
  let cachedIndex = null;
  let cachedMtime = 0;

  function computeTreeMtime(dirPath) {
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
      const currentMtime = Number(stat.mtimeMs || 0);
      if (currentMtime > maxMtime) maxMtime = currentMtime;
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
    const byTopicId = {};
    const byEntityId = {};
    const docs = [];

    if (!fs.existsSync(wikiLoreRoot)) {
      cachedIndex = { byTopicId, byEntityId, docs };
      cachedMtime = 0;
      return cachedIndex;
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
        if (!fileLooksLikeLore(fullPath)) continue;

        let raw = "";
        try {
          raw = fs.readFileSync(fullPath, "utf-8");
        } catch {
          continue;
        }
        const parsed = parseFrontMatter(raw);
        const relativePath = path.relative(wikiLoreRoot, fullPath).replace(/\\/g, "/");
        const slug = relativePath.replace(/\.[a-z0-9]+$/i, "");
        const type = String(parsed.frontMatter.type ?? "").trim();
        const entityId = String(parsed.frontMatter.id ?? path.basename(slug)).trim();
        const name = String(parsed.frontMatter.nom ?? entityId).trim();
        const keywords = Array.isArray(parsed.frontMatter.mots_cles)
          ? parsed.frontMatter.mots_cles
          : [];
        const baseText = [
          slug,
          type,
          entityId,
          name,
          keywords.join(" "),
          parsed.body,
        ].join(" ");
        const terms = new Set(tokenize(baseText));
        const topicId = `wiki:${type || "entry"}:${entityId || slug}`;
        const doc = {
          topic_id: topicId,
          entity_id: entityId,
          type,
          name,
          relative_path: relativePath,
          front_matter: parsed.frontMatter,
          body: parsed.body,
          snippet: buildSnippet(parsed),
          terms,
        };

        docs.push(doc);
        byTopicId[topicId] = {
          topic_id: topicId,
          entity_id: entityId,
          type,
          name,
          relative_path: relativePath,
          snippet: doc.snippet,
          front_matter: parsed.frontMatter,
        };
        if (entityId) {
          byEntityId[normalizeText(entityId)] = doc;
        }
      }
    }

    cachedIndex = { byTopicId, byEntityId, docs };
    cachedMtime = computeTreeMtime(wikiLoreRoot);
    return cachedIndex;
  }

  function getIndex() {
    if (!fs.existsSync(wikiLoreRoot)) {
      return rebuildIndex();
    }
    const treeMtime = computeTreeMtime(wikiLoreRoot);
    if (!cachedIndex || treeMtime > cachedMtime) {
      return rebuildIndex();
    }
    return cachedIndex;
  }

  function scoreDoc(doc, queryTerms, locationId, destinationId) {
    let score = 0;
    for (const term of queryTerms) {
      if (doc.terms.has(term)) score += 2;
      if (normalizeText(doc.entity_id) === term) score += 6;
      if (normalizeText(doc.name).includes(term)) score += 3;
    }

    const normalizedPath = normalizeText(doc.relative_path);
    const normalizedLocation = normalizeText(locationId);
    const normalizedDestination = normalizeText(destinationId);
    if (normalizedLocation && normalizeText(doc.entity_id) === normalizedLocation) score += 12;
    if (normalizedDestination && normalizeText(doc.entity_id) === normalizedDestination) score += 15;
    if (normalizedLocation && normalizedPath.includes(normalizedLocation)) score += 4;
    if (normalizedDestination && normalizedPath.includes(normalizedDestination)) score += 5;
    return score;
  }

  function selectLore(params) {
    const index = getIndex();
    const intentType = String(params.intentType ?? "").trim();
    const locationId = String(params.locationId ?? "").trim();
    const destinationId = String(params.destinationId ?? "").trim();
    const playerInput = String(params.playerInput ?? "").trim();
    const limit = Number.isFinite(Number(params.limit)) ? Number(params.limit) : 5;

    const queryTerms = new Set([
      ...tokenize(intentType),
      ...tokenize(playerInput),
      ...tokenize(locationId),
      ...tokenize(destinationId),
    ]);
    const ranked = index.docs
      .map((doc) => ({
        doc,
        score: scoreDoc(doc, queryTerms, locationId, destinationId),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, limit));

    const picked = ranked.map((item) => item.doc);

    if (picked.length === 0 && locationId) {
      const locationDoc = index.byEntityId[normalizeText(locationId)];
      if (locationDoc) picked.push(locationDoc);
    }
    if (picked.length === 0 && destinationId) {
      const destinationDoc = index.byEntityId[normalizeText(destinationId)];
      if (destinationDoc) picked.push(destinationDoc);
    }

    const topicIds = picked.map((doc) => doc.topic_id);
    const loreDb = {};
    for (const topicId of topicIds) {
      loreDb[topicId] = index.byTopicId[topicId];
    }

    return {
      topic_ids: topicIds,
      lore_db: loreDb,
      selected_entries: topicIds.map((topicId) => index.byTopicId[topicId]),
    };
  }

  return {
    selectLore,
    getIndex,
  };
}

module.exports = { createWikiLoreHelper };
