"use strict";

const fs = require("fs");
const path = require("path");

const ENTITY_KEYS = ["placesDiscovered", "sessionNpcs", "establishedFacts", "rumors", "debtsPromises"];

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeEntity(value) {
  const key = safeText(value);
  return ENTITY_KEYS.includes(key) ? key : "";
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => safeText(entry))
    .filter(Boolean)
    .slice(0, 12);
}

function makeId(entity, baseText) {
  const seed = safeText(baseText).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return seed ? `${entity}:${seed}:${suffix}` : `${entity}:${suffix}`;
}

function sanitizeEntry(entity, entry) {
  const row = entry && typeof entry === "object" ? entry : {};
  const id = safeText(row.id);
  const label = safeText(row.label || row.name || row.title);
  const text = safeText(row.text || row.summary || row.description || row.note);
  const nowIso = new Date().toISOString();
  return {
    id: id || makeId(entity, label || text),
    label,
    text,
    tags: normalizeTags(row.tags),
    source: safeText(row.source || row.origin),
    status: safeText(row.status),
    createdAt: safeText(row.createdAt) || nowIso,
    updatedAt: nowIso,
    data: row.data && typeof row.data === "object" ? row.data : {}
  };
}

function createEmptyState() {
  return {
    version: "1.0.0",
    updatedAt: new Date().toISOString(),
    entities: {
      placesDiscovered: [],
      sessionNpcs: [],
      establishedFacts: [],
      rumors: [],
      debtsPromises: []
    },
    history: []
  };
}

function parseState(raw) {
  const candidate = raw && typeof raw === "object" ? raw : {};
  const state = createEmptyState();
  state.version = safeText(candidate.version) || "1.0.0";
  state.updatedAt = safeText(candidate.updatedAt) || new Date().toISOString();
  const entities = candidate.entities && typeof candidate.entities === "object" ? candidate.entities : {};
  ENTITY_KEYS.forEach((key) => {
    const rows = Array.isArray(entities[key]) ? entities[key] : [];
    state.entities[key] = rows
      .map((row) => sanitizeEntry(key, row))
      .slice(0, 800);
  });
  state.history = Array.isArray(candidate.history) ? candidate.history.slice(-120) : [];
  return state;
}

function createSessionNarrativeDb(params = {}) {
  const dbPath = safeText(params.path);
  const logWarn = typeof params.warn === "function" ? params.warn : () => {};
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      if (!dbPath || !fs.existsSync(dbPath)) {
        cache = createEmptyState();
        return cache;
      }
      const raw = fs.readFileSync(dbPath, "utf8");
      cache = parseState(JSON.parse(raw));
      return cache;
    } catch (err) {
      logWarn("[session-db] lecture impossible:", err?.message ?? err);
      cache = createEmptyState();
      return cache;
    }
  }

  function save(state) {
    const next = parseState(state);
    next.updatedAt = new Date().toISOString();
    cache = next;
    try {
      if (dbPath) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(dbPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      }
    } catch (err) {
      logWarn("[session-db] sauvegarde impossible:", err?.message ?? err);
    }
    return next;
  }

  function recordHistory(state, row) {
    const next = state;
    const entry = row && typeof row === "object" ? row : {};
    next.history.push({
      at: new Date().toISOString(),
      action: safeText(entry.action) || "upsert",
      entity: normalizeEntity(entry.entity) || "unknown",
      id: safeText(entry.id),
      summary: safeText(entry.summary).slice(0, 220)
    });
    if (next.history.length > 120) next.history.shift();
  }

  function upsert(state, entity, item) {
    const safeEntity = normalizeEntity(entity);
    if (!safeEntity) return { ok: false, reason: "invalid-entity" };
    const rows = state.entities[safeEntity];
    const normalized = sanitizeEntry(safeEntity, item);
    const index = rows.findIndex((row) => row.id === normalized.id);
    if (index >= 0) {
      rows[index] = {
        ...rows[index],
        ...normalized,
        createdAt: rows[index].createdAt || normalized.createdAt,
        updatedAt: new Date().toISOString()
      };
    } else {
      rows.push(normalized);
    }
    recordHistory(state, {
      action: "upsert",
      entity: safeEntity,
      id: normalized.id,
      summary: normalized.label || normalized.text || normalized.id
    });
    return { ok: true, entity: safeEntity, id: normalized.id };
  }

  function remove(state, entity, id) {
    const safeEntity = normalizeEntity(entity);
    const targetId = safeText(id);
    if (!safeEntity || !targetId) return { ok: false, reason: "invalid-delete-params" };
    const rows = state.entities[safeEntity];
    const index = rows.findIndex((row) => row.id === targetId);
    if (index < 0) return { ok: false, reason: "not-found" };
    rows.splice(index, 1);
    recordHistory(state, {
      action: "delete",
      entity: safeEntity,
      id: targetId,
      summary: targetId
    });
    return { ok: true, entity: safeEntity, id: targetId };
  }

  function write(input) {
    const args = input && typeof input === "object" ? input : {};
    const operationsRaw = Array.isArray(args.operations) ? args.operations : [args];
    const operations = operationsRaw
      .map((entry) => (entry && typeof entry === "object" ? entry : null))
      .filter(Boolean)
      .slice(0, 20);

    const state = parseState(load());
    const applied = [];
    operations.forEach((entry) => {
      const action = safeText(entry.action || entry.op || "upsert").toLowerCase();
      if (action === "delete") {
        applied.push(remove(state, entry.entity, entry.id));
        return;
      }
      applied.push(upsert(state, entry.entity, entry.item ?? entry.payload ?? entry));
    });
    save(state);

    return {
      ok: applied.some((row) => row.ok),
      applied,
      counts: stats().counts
    };
  }

  function matchesQuery(entry, query) {
    const term = safeText(query).toLowerCase();
    if (!term) return true;
    const hay = [
      safeText(entry.id),
      safeText(entry.label),
      safeText(entry.text),
      safeText(entry.source),
      safeText(entry.status),
      JSON.stringify(entry.data ?? {})
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(term);
  }

  function read(input) {
    const args = input && typeof input === "object" ? input : {};
    const state = parseState(load());
    const entity = normalizeEntity(args.entity);
    const query = safeText(args.query || args.term);
    const limit = Math.max(1, Math.min(50, Number(args.limit ?? 10) || 10));

    if (entity) {
      const rows = state.entities[entity].filter((row) => matchesQuery(row, query));
      return {
        ok: true,
        source: "session-db",
        entity,
        total: rows.length,
        rows: rows.slice(0, limit),
        counts: stats().counts
      };
    }

    const summaryRows = [];
    ENTITY_KEYS.forEach((key) => {
      const matches = state.entities[key].filter((row) => matchesQuery(row, query));
      matches.slice(0, Math.max(1, Math.min(4, limit))).forEach((row) => {
        summaryRows.push({ entity: key, ...row });
      });
    });
    return {
      ok: true,
      source: "session-db",
      entity: "all",
      total: summaryRows.length,
      rows: summaryRows.slice(0, limit),
      counts: stats().counts
    };
  }

  function stats() {
    const state = parseState(load());
    const counts = {};
    ENTITY_KEYS.forEach((key) => {
      counts[key] = Array.isArray(state.entities[key]) ? state.entities[key].length : 0;
    });
    return {
      version: state.version,
      updatedAt: state.updatedAt,
      counts,
      recent: Array.isArray(state.history) ? state.history.slice(-10) : []
    };
  }

  return {
    read,
    write,
    stats,
    reset: () => save(createEmptyState())
  };
}

module.exports = {
  createSessionNarrativeDb
};
