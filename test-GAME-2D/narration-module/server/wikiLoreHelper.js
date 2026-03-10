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
  const lines = frontRaw.split(/\r?\n/);

  function leadingSpaces(value) {
    const match = String(value ?? "").match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  function stripInlineComment(value) {
    const raw = String(value ?? "");
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      const previous = i > 0 ? raw[i - 1] : "";
      if (char === "'" && !inDouble && previous !== "\\") {
        inSingle = !inSingle;
        continue;
      }
      if (char === "\"" && !inSingle && previous !== "\\") {
        inDouble = !inDouble;
        continue;
      }
      if (char === "#" && !inSingle && !inDouble) {
        const before = i === 0 ? "" : raw[i - 1];
        if (!before || /\s/.test(before)) {
          return raw.slice(0, i).trimEnd();
        }
      }
    }
    return raw.trim();
  }

  function splitInlineCollection(value) {
    const raw = String(value ?? "").trim();
    const items = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      const previous = i > 0 ? raw[i - 1] : "";
      if (char === "'" && !inDouble && previous !== "\\") {
        inSingle = !inSingle;
        current += char;
        continue;
      }
      if (char === "\"" && !inSingle && previous !== "\\") {
        inDouble = !inDouble;
        current += char;
        continue;
      }
      if (char === "," && !inSingle && !inDouble) {
        items.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }

    if (current.trim()) items.push(current.trim());
    return items;
  }

  function parseScalar(value) {
    const stripped = stripInlineComment(value);
    if (!stripped) return "";

    if (
      (stripped.startsWith("\"") && stripped.endsWith("\"")) ||
      (stripped.startsWith("'") && stripped.endsWith("'"))
    ) {
      return stripped.slice(1, -1);
    }

    if (stripped === "[]") return [];
    if (stripped === "{}") return {};
    if (stripped === "true") return true;
    if (stripped === "false") return false;
    if (stripped === "null") return null;
    if (/^-?\d+(\.\d+)?$/.test(stripped)) return Number(stripped);

    if (stripped.startsWith("[") && stripped.endsWith("]")) {
      const inner = stripped.slice(1, -1).trim();
      if (!inner) return [];
      return splitInlineCollection(inner).map((item) => parseScalar(item));
    }

    return stripped;
  }

  function findNextSignificantLine(startIndex) {
    for (let i = startIndex; i < lines.length; i += 1) {
      const rawLine = lines[i];
      if (!rawLine || !rawLine.trim()) continue;
      return { index: i, line: rawLine };
    }
    return null;
  }

  function parseObject(indentLevel, startIndex) {
    const result = {};
    let index = startIndex;

    while (index < lines.length) {
      const rawLine = lines[index];
      if (!rawLine || !rawLine.trim()) {
        index += 1;
        continue;
      }
      const indent = leadingSpaces(rawLine);
      if (indent < indentLevel) break;
      if (indent > indentLevel) {
        index += 1;
        continue;
      }
      const trimmed = rawLine.trim();
      if (trimmed.startsWith("- ")) break;
      const keyVal = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!keyVal) {
        index += 1;
        continue;
      }
      const key = keyVal[1].trim();
      const rest = keyVal[2];
      if (rest && rest.trim()) {
        result[key] = parseScalar(rest);
        index += 1;
        continue;
      }

      const next = findNextSignificantLine(index + 1);
      if (!next || leadingSpaces(next.line) <= indentLevel) {
        result[key] = [];
        index += 1;
        continue;
      }
      const nextIndent = leadingSpaces(next.line);
      const nextTrimmed = next.line.trim();
      if (nextTrimmed.startsWith("- ")) {
        const parsedArray = parseArray(nextIndent, next.index);
        result[key] = parsedArray.value;
        index = parsedArray.nextIndex;
        continue;
      }
      const parsedObject = parseObject(nextIndent, next.index);
      result[key] = parsedObject.value;
      index = parsedObject.nextIndex;
    }

    return { value: result, nextIndex: index };
  }

  function parseArray(indentLevel, startIndex) {
    const result = [];
    let index = startIndex;

    while (index < lines.length) {
      const rawLine = lines[index];
      if (!rawLine || !rawLine.trim()) {
        index += 1;
        continue;
      }
      const indent = leadingSpaces(rawLine);
      if (indent < indentLevel) break;
      if (indent > indentLevel) {
        index += 1;
        continue;
      }
      const trimmed = rawLine.trim();
      if (!trimmed.startsWith("- ")) break;
      const content = trimmed.slice(2).trim();

      if (!content) {
        result.push("");
        index += 1;
        continue;
      }

      const inlineKeyVal = content.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (!inlineKeyVal) {
        result.push(parseScalar(content));
        index += 1;
        continue;
      }

      const item = {
        [inlineKeyVal[1].trim()]: parseScalar(inlineKeyVal[2])
      };
      index += 1;

      while (index < lines.length) {
        const continuationLine = lines[index];
        if (!continuationLine || !continuationLine.trim()) {
          index += 1;
          continue;
        }
        const continuationIndent = leadingSpaces(continuationLine);
        if (continuationIndent <= indentLevel) break;
        const continuationTrimmed = continuationLine.trim();
        const continuationMatch = continuationTrimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
        if (!continuationMatch) {
          index += 1;
          continue;
        }
        const continuationKey = continuationMatch[1].trim();
        const continuationRest = continuationMatch[2];
        if (continuationRest && continuationRest.trim()) {
          item[continuationKey] = parseScalar(continuationRest);
          index += 1;
          continue;
        }

        const next = findNextSignificantLine(index + 1);
        if (!next || leadingSpaces(next.line) <= continuationIndent) {
          item[continuationKey] = [];
          index += 1;
          continue;
        }
        if (next.line.trim().startsWith("- ")) {
          const nestedArray = parseArray(leadingSpaces(next.line), next.index);
          item[continuationKey] = nestedArray.value;
          index = nestedArray.nextIndex;
          continue;
        }
        const nestedObject = parseObject(leadingSpaces(next.line), next.index);
        item[continuationKey] = nestedObject.value;
        index = nestedObject.nextIndex;
      }

      result.push(item);
    }

    return { value: result, nextIndex: index };
  }

  return { frontMatter: parseObject(0, 0).value, body };
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
  const synonymsPath = path.resolve(
    projectRoot,
    "narration-module",
    "runtime-data",
    "lore-keyword-synonyms.json"
  );
  let cachedIndex = null;
  let cachedMtime = 0;
  let cachedSynonyms = null;
  let cachedSynonymsMtime = 0;
  const INTENT_BUDGETS = {
    observe: { maxTopics: 2, maxTotalChars: 700, maxSnippetChars: 180 },
    talk: { maxTopics: 2, maxTotalChars: 900, maxSnippetChars: 220 },
    move_local: { maxTopics: 2, maxTotalChars: 700, maxSnippetChars: 180 },
    ask_info: { maxTopics: 3, maxTotalChars: 1100, maxSnippetChars: 240 },
    attempt_forbidden: { maxTopics: 4, maxTotalChars: 1400, maxSnippetChars: 260 },
    meta_unclear: { maxTopics: 1, maxTotalChars: 400, maxSnippetChars: 160 },
    default: { maxTopics: 2, maxTotalChars: 800, maxSnippetChars: 200 },
  };
  const PRIORITY_FACT_FIELDS = [
    "type_gouvernance",
    "siege_pouvoir",
    "autorite_locale",
    "proprietaire_principal",
    "proprietaire_faction",
    "acces",
    "importance_strategique",
    "niveau_securite",
    "type_batiment",
    "fonction_principale",
    "villes_principales",
    "batiments_importants",
    "quartiers",
    "lieux_connectes",
    "liaisons",
    "quartier",
    "common_languages",
    "trade_languages",
    "rare_languages",
    "script_languages",
  ];

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
    const byKeyword = {};
    const docs = [];

    if (!fs.existsSync(wikiLoreRoot)) {
      cachedIndex = { byTopicId, byEntityId, byKeyword, docs };
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
          keywords_normalized: keywords
            .map((item) => normalizeText(item))
            .filter(Boolean),
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
        for (const keyword of doc.keywords_normalized) {
          const keywordTokens = tokenize(keyword);
          for (const token of keywordTokens) {
            if (!byKeyword[token]) byKeyword[token] = [];
            byKeyword[token].push(doc);
          }
        }
      }
    }

    cachedIndex = { byTopicId, byEntityId, byKeyword, docs };
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

  function getSynonymsMap() {
    let mtime = 0;
    try {
      if (fs.existsSync(synonymsPath)) {
        mtime = Number(fs.statSync(synonymsPath).mtimeMs || 0);
      }
    } catch {
      mtime = 0;
    }
    if (cachedSynonyms && mtime === cachedSynonymsMtime) {
      return cachedSynonyms;
    }

    const map = {};
    if (!fs.existsSync(synonymsPath)) {
      cachedSynonyms = map;
      cachedSynonymsMtime = mtime;
      return cachedSynonyms;
    }

    try {
      const raw = fs.readFileSync(synonymsPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        cachedSynonyms = map;
        cachedSynonymsMtime = mtime;
        return cachedSynonyms;
      }
      for (const [keyRaw, valuesRaw] of Object.entries(parsed)) {
        const key = normalizeText(keyRaw);
        if (!key) continue;
        const values = Array.isArray(valuesRaw) ? valuesRaw : [];
        const normalizedValues = values
          .map((item) => normalizeText(item))
          .filter(Boolean);
        map[key] = [...new Set(normalizedValues)];
      }
    } catch {
      cachedSynonyms = {};
      cachedSynonymsMtime = mtime;
      return cachedSynonyms;
    }

    cachedSynonyms = map;
    cachedSynonymsMtime = mtime;
    return cachedSynonyms;
  }

  function normalizeEntityId(value) {
    return normalizeText(String(value ?? "").trim());
  }

  function asStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  function collectLinkedEntityIds(doc) {
    if (!doc || !doc.front_matter || typeof doc.front_matter !== "object") return [];
    const fm = doc.front_matter;
    const ids = new Set();
    const directSingleFields = [
      "ville",
      "region",
      "territoire",
      "siege_pouvoir",
      "capitale",
      "proprietaire_principal",
      "proprietaire_faction",
      "autorite_locale",
    ];
    const directArrayFields = [
      "lieux_connectes",
      "quartiers",
      "batiments_importants",
      "villes_principales",
      "liaisons",
      "lieux_remarquables",
      "factions_presentes",
      "factions_actives",
      "religions_principales",
    ];

    for (const key of directSingleFields) {
      const value = String(fm[key] ?? "").trim();
      if (!value) continue;
      ids.add(value);
    }
    for (const key of directArrayFields) {
      for (const value of asStringArray(fm[key])) {
        ids.add(value);
      }
    }
    return [...ids];
  }

  function collectExpansionDocs(index, anchors, maxDepth, maxNodes) {
    const queue = [];
    const seenEntityIds = new Set();
    const docs = [];

    function enqueueDoc(doc, depth) {
      if (!doc || depth > maxDepth) return;
      const key = normalizeEntityId(doc.entity_id);
      if (!key || seenEntityIds.has(key)) return;
      seenEntityIds.add(key);
      queue.push({ doc, depth });
    }

    for (const anchor of anchors) {
      enqueueDoc(anchor, 0);
    }

    while (queue.length > 0 && docs.length < maxNodes) {
      const current = queue.shift();
      const doc = current.doc;
      const depth = current.depth;
      docs.push(doc);
      if (depth >= maxDepth) continue;
      const linkedIds = collectLinkedEntityIds(doc);
      for (const linkedIdRaw of linkedIds) {
        const linkedDoc = index.byEntityId[normalizeEntityId(linkedIdRaw)];
        enqueueDoc(linkedDoc, depth + 1);
      }
    }

    return docs;
  }

  function localityScore(doc, anchorDoc) {
    if (!doc || !anchorDoc) return 0;
    const cityDoc = normalizeText(doc.front_matter?.ville);
    const cityAnchor = normalizeText(anchorDoc.front_matter?.ville);
    const regionDoc = normalizeText(doc.front_matter?.region);
    const regionAnchor = normalizeText(anchorDoc.front_matter?.region);
    if (cityDoc && cityAnchor && cityDoc === cityAnchor) return 3;
    if (regionDoc && regionAnchor && regionDoc === regionAnchor) return 1;
    return 0;
  }

  function compactSnippet(value, maxChars) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
  }

  function toCompactEntry(entry, maxSnippetChars) {
    const frontMatter =
      entry && typeof entry.front_matter === "object" && entry.front_matter !== null
        ? entry.front_matter
        : {};
    const keyFacts = {};
    for (const field of PRIORITY_FACT_FIELDS) {
      const value = frontMatter[field];
      if (typeof value === "undefined" || value === null) continue;
      if (Array.isArray(value)) {
        const compactValues = value
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
          .slice(0, 6);
        if (compactValues.length > 0) keyFacts[field] = compactValues;
        continue;
      }
      if (value && typeof value === "object") {
        keyFacts[field] = value;
        continue;
      }
      const compactValue = String(value).trim();
      if (compactValue) keyFacts[field] = compactValue;
    }

    return {
      topic_id: entry.topic_id,
      entity_id: entry.entity_id,
      type: entry.type,
      name: entry.name,
      relative_path: entry.relative_path,
      snippet: compactSnippet(entry.snippet, maxSnippetChars),
      key_facts: keyFacts,
    };
  }

  function selectLore(params) {
    const index = getIndex();
    const synonymsMap = getSynonymsMap();
    const intentType = String(params.intentType ?? "").trim();
    const locationId = String(params.locationId ?? "").trim();
    const destinationId = String(params.destinationId ?? "").trim();
    const playerInput = String(params.playerInput ?? "").trim();
    const budget =
      INTENT_BUDGETS[normalizeText(intentType)] ?? INTENT_BUDGETS.default;
    const limit = Number.isFinite(Number(params.limit))
      ? Number(params.limit)
      : budget.maxTopics;
    const maxTotalChars = Number.isFinite(Number(params.maxTotalChars))
      ? Number(params.maxTotalChars)
      : budget.maxTotalChars;
    const maxSnippetChars = Number.isFinite(Number(params.maxSnippetChars))
      ? Number(params.maxSnippetChars)
      : budget.maxSnippetChars;

    const baseQueryTerms = new Set([
      ...tokenize(playerInput),
    ]);
    const queryTerms = new Set([...baseQueryTerms]);
    for (const term of baseQueryTerms) {
      const synonyms = Array.isArray(synonymsMap[term]) ? synonymsMap[term] : [];
      for (const synonym of synonyms) {
        queryTerms.add(synonym);
      }
    }
    const picked = [];
    const seenTopicIds = new Set();
    let charBudgetUsed = 0;
    const locationDoc = locationId ? index.byEntityId[normalizeText(locationId)] : null;
    const destinationDoc = destinationId ? index.byEntityId[normalizeText(destinationId)] : null;

    function tryAddDoc(doc) {
      if (!doc || seenTopicIds.has(doc.topic_id)) return;
      if (picked.length >= Math.max(1, limit)) return;
      const compact = toCompactEntry(doc, maxSnippetChars);
      const estimatedSize = String(compact.name ?? "").length + String(compact.snippet ?? "").length;
      if (picked.length > 0 && charBudgetUsed + estimatedSize > Math.max(120, maxTotalChars)) {
        return;
      }
      picked.push(doc);
      seenTopicIds.add(doc.topic_id);
      charBudgetUsed += estimatedSize;
    }

    if (locationId) {
      tryAddDoc(locationDoc);
    }
    if (destinationId) {
      tryAddDoc(destinationDoc);
    }

    const expansionDocs = collectExpansionDocs(
      index,
      [locationDoc, destinationDoc].filter(Boolean),
      ["ask_info", "talk"].includes(normalizeText(intentType)) ? 2 : 1,
      ["ask_info", "talk"].includes(normalizeText(intentType)) ? 18 : 10
    );
    for (const expansionDoc of expansionDocs) {
      if (picked.length >= Math.max(1, limit)) break;
      tryAddDoc(expansionDoc);
    }

    const keywordCandidates = [];
    for (const term of queryTerms) {
      const docsByKeyword = Array.isArray(index.byKeyword[term]) ? index.byKeyword[term] : [];
      for (const doc of docsByKeyword) {
        const score = 2 + localityScore(doc, locationDoc);
        keywordCandidates.push({ doc, score });
      }
    }
    keywordCandidates.sort((a, b) => b.score - a.score);
    for (const item of keywordCandidates) {
      if (picked.length >= Math.max(1, limit)) break;
      const docType = normalizeText(item.doc.type);
      if (docType === "meta" && normalizeText(intentType) !== "meta_unclear") {
        continue;
      }
      tryAddDoc(item.doc);
    }

    const topicIds = picked.map((doc) => doc.topic_id);
    const loreDb = {};
    for (const topicId of topicIds) {
      loreDb[topicId] = toCompactEntry(index.byTopicId[topicId], maxSnippetChars);
    }

    return {
      topic_ids: topicIds,
      lore_db: loreDb,
      selected_entries: topicIds.map((topicId) =>
        toCompactEntry(index.byTopicId[topicId], maxSnippetChars)
      ),
    };
  }

  return {
    selectLore,
    getIndex,
  };
}

module.exports = { createWikiLoreHelper };
