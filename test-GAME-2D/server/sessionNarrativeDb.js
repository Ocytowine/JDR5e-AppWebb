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
  return seed ? `${entity}:${seed}` : `${entity}:${suffix}`;
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function worldToGameMinute(worldState) {
  const time = worldState && typeof worldState === "object" ? worldState.time : null;
  if (!time || typeof time !== "object") return null;
  const day = Math.max(1, Math.floor(toFiniteNumber(time.day, 1)));
  const hour = Math.max(0, Math.min(23, Math.floor(toFiniteNumber(time.hour, 0))));
  const minute = Math.max(0, Math.min(59, Math.floor(toFiniteNumber(time.minute, 0))));
  return ((day - 1) * 24 + hour) * 60 + minute;
}

function sanitizeEntry(entity, entry) {
  const row = entry && typeof entry === "object" ? entry : {};
  const id = safeText(row.id);
  const label = safeText(row.label || row.name || row.title);
  const text = safeText(row.text || row.summary || row.description || row.note);
  const nowIso = new Date().toISOString();
  const data = row.data && typeof row.data === "object" ? { ...row.data } : {};
  const ttlDaysRaw = Number(row.ttlDays ?? data.ttlDays);
  const ttlDays = Number.isFinite(ttlDaysRaw) ? Math.max(1, Math.min(90, Math.floor(ttlDaysRaw))) : null;
  const expiresAtValue = safeText(row.expiresAt || data.expiresAt);
  const expiresAt =
    expiresAtValue ||
    (ttlDays ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString() : "");
  return {
    id: id || makeId(entity, label || text),
    label,
    text,
    tags: normalizeTags(row.tags),
    source: safeText(row.source || row.origin),
    status: safeText(row.status),
    createdAt: safeText(row.createdAt) || nowIso,
    updatedAt: nowIso,
    ttlDays: ttlDays ?? undefined,
    expiresAt: expiresAt || undefined,
    data
  };
}

function isEntryExpired(entry) {
  const iso = safeText(entry?.expiresAt || entry?.data?.expiresAt);
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  return ts <= Date.now();
}

function isEntryExpiredInGame(entry, worldState) {
  const nowGameMin = worldToGameMinute(worldState);
  if (nowGameMin == null) return false;
  const expiresAtGameMin = toFiniteNumber(entry?.data?.expiresAtGameMin, NaN);
  if (!Number.isFinite(expiresAtGameMin)) return false;
  return nowGameMin >= expiresAtGameMin;
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
      .filter((row) => !isEntryExpired(row))
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

  function findStableMatchIndex(rows, item) {
    const label = safeText(item?.label).toLowerCase();
    const locationId = safeText(item?.data?.locationId || item?.data?.parentLocationId).toLowerCase();
    if (!label) return -1;
    return rows.findIndex((row) => {
      const rowLabel = safeText(row?.label).toLowerCase();
      if (!rowLabel || rowLabel !== label) return false;
      const rowLocationId = safeText(row?.data?.locationId || row?.data?.parentLocationId).toLowerCase();
      if (locationId && rowLocationId && rowLocationId !== locationId) return false;
      return true;
    });
  }

  function applyGameMemoryPolicy(entity, previousRow, incomingRow, worldState) {
    const nowGameMin = worldToGameMinute(worldState);
    if (nowGameMin == null) return incomingRow;
    const prevData = previousRow?.data && typeof previousRow.data === "object" ? previousRow.data : {};
    const nextData = incomingRow?.data && typeof incomingRow.data === "object" ? { ...incomingRow.data } : {};
    const interactionWeight = Math.max(
      0,
      Math.min(
        1.2,
        toFiniteNumber(nextData.interactionWeight, toFiniteNumber(prevData.interactionWeight, 0.08))
      )
    );
    const previousInterest = Math.max(0, Math.min(3, toFiniteNumber(prevData.interestScore, 0.12)));
    const lastSeenAtGameMin = toFiniteNumber(prevData.lastSeenAtGameMin, nowGameMin);
    const elapsedHours = Math.max(0, (nowGameMin - lastSeenAtGameMin) / 60);
    const decay = Math.min(0.45, elapsedHours * 0.012);
    let interestScore = Math.max(0, Math.min(3, previousInterest - decay + interactionWeight));
    const baseTtlHours =
      Math.max(
        24,
        Math.min(
          24 * 60,
          Math.floor(
            toFiniteNumber(
              nextData.ttlGameHours,
              toFiniteNumber(prevData.ttlGameHours, entity === "sessionNpcs" ? 24 * 7 : 24 * 5)
            )
          )
        )
      ) || 24;
    const extensionFactor = 1 + Math.min(2.2, interestScore * 0.9);
    const nextTtlHours = Math.max(24, Math.floor(baseTtlHours * extensionFactor));
    const previousExpires = toFiniteNumber(prevData.expiresAtGameMin, nowGameMin + nextTtlHours * 60);
    const nextExpires = Math.max(previousExpires, nowGameMin + nextTtlHours * 60);
    nextData.interestScore = Number(interestScore.toFixed(3));
    nextData.interactionWeight = interactionWeight;
    nextData.interactionCount = Math.max(0, Math.floor(toFiniteNumber(prevData.interactionCount, 0))) + 1;
    nextData.lastSeenAtGameMin = nowGameMin;
    nextData.ttlGameHours = nextTtlHours;
    nextData.expiresAtGameMin = nextExpires;
    if (!nextData.createdAtGameMin) {
      nextData.createdAtGameMin = toFiniteNumber(prevData.createdAtGameMin, nowGameMin);
    }
    return {
      ...incomingRow,
      data: nextData
    };
  }

  function decayEntityRow(row, worldState) {
    const nowGameMin = worldToGameMinute(worldState);
    if (nowGameMin == null) return row;
    const safeRow = row && typeof row === "object" ? row : null;
    if (!safeRow) return row;
    const data = safeRow.data && typeof safeRow.data === "object" ? { ...safeRow.data } : {};
    const lastSeenAtGameMin = toFiniteNumber(data.lastSeenAtGameMin, nowGameMin);
    const elapsedHours = Math.max(0, (nowGameMin - lastSeenAtGameMin) / 60);
    if (elapsedHours <= 0) return safeRow;
    const currentInterest = Math.max(0, Math.min(3, toFiniteNumber(data.interestScore, 0.12)));
    const nextInterest = Math.max(0, currentInterest - Math.min(0.55, elapsedHours * 0.01));
    data.interestScore = Number(nextInterest.toFixed(3));
    return {
      ...safeRow,
      data
    };
  }

  function upsert(state, entity, item) {
    const safeEntity = normalizeEntity(entity);
    if (!safeEntity) return { ok: false, reason: "invalid-entity" };
    const rows = state.entities[safeEntity];
    const normalized = sanitizeEntry(safeEntity, item);
    const hasExplicitId = safeText(item?.id);
    const index = hasExplicitId
      ? rows.findIndex((row) => row.id === normalized.id)
      : findStableMatchIndex(rows, normalized);
    if (index >= 0) {
      const mergedData = {
        ...(rows[index]?.data && typeof rows[index].data === "object" ? rows[index].data : {}),
        ...(normalized?.data && typeof normalized.data === "object" ? normalized.data : {})
      };
      const merged = {
        ...rows[index],
        ...normalized,
        data: mergedData,
        createdAt: rows[index].createdAt || normalized.createdAt,
        updatedAt: new Date().toISOString()
      };
      rows[index] = {
        ...applyGameMemoryPolicy(
          safeEntity,
          rows[index],
          merged,
          item?.worldState ?? null
        )
      };
    } else {
      rows.push(applyGameMemoryPolicy(safeEntity, null, normalized, item?.worldState ?? null));
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
    const worldState = args?.worldState && typeof args.worldState === "object" ? args.worldState : null;
    ENTITY_KEYS.forEach((key) => {
      const rows = Array.isArray(state.entities[key]) ? state.entities[key] : [];
      state.entities[key] = rows
        .map((row) => decayEntityRow(row, worldState))
        .filter((row) => !isEntryExpired(row) && !isEntryExpiredInGame(row, worldState));
    });
    const applied = [];
    operations.forEach((entry) => {
      const action = safeText(entry.action || entry.op || "upsert").toLowerCase();
      if (action === "delete") {
        applied.push(remove(state, entry.entity, entry.id));
        return;
      }
      const nextItem = entry.item ?? entry.payload ?? entry;
      if (nextItem && typeof nextItem === "object" && !Array.isArray(nextItem)) {
        nextItem.worldState = worldState;
      }
      applied.push(upsert(state, entry.entity, nextItem));
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

  function scopeRows(state, entityKey, args) {
    const worldState = args?.worldState && typeof args.worldState === "object" ? args.worldState : null;
    const rows = Array.isArray(state?.entities?.[entityKey]) ? state.entities[entityKey] : [];
    const freshRows = rows.filter((row) => !isEntryExpired(row) && !isEntryExpiredInGame(row, worldState));
    const scope = safeText(args?.scope).toLowerCase();
    if (scope !== "scene-memory") return freshRows;
    const locationId = safeText(worldState?.location?.id);
    const locationLabel = safeText(worldState?.location?.label).toLowerCase();
    if (!locationId && !locationLabel) return freshRows.slice(0, 20);
    return freshRows.filter((row) => {
      const rowLocationId = safeText(row?.data?.locationId || row?.data?.parentLocationId);
      const rowLocationLabel = safeText(row?.data?.locationLabel).toLowerCase();
      if (locationId && rowLocationId && rowLocationId === locationId) return true;
      if (locationLabel && rowLocationLabel && rowLocationLabel.includes(locationLabel)) return true;
      return false;
    });
  }

  function read(input) {
    const args = input && typeof input === "object" ? input : {};
    const state = parseState(load());
    const entity = normalizeEntity(args.entity);
    const query = safeText(args.query || args.term);
    const limit = Math.max(1, Math.min(50, Number(args.limit ?? 10) || 10));

    if (entity) {
      const scoped = scopeRows(state, entity, args);
      const rows = scoped.filter((row) => matchesQuery(row, query));
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
      const scoped = scopeRows(state, key, args);
      const matches = scoped.filter((row) => matchesQuery(row, query));
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
