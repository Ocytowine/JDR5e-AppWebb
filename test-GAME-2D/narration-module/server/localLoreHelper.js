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

function toCompactText(value, maxChars) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function findLocationInRecord(record) {
  if (!record || typeof record !== "object") return "";
  const rec = record;
  const direct = String(rec.location_id ?? rec.location ?? "").trim();
  if (direct) return direct;
  const payload = rec.payload && typeof rec.payload === "object" ? rec.payload : null;
  return payload ? String(payload.location_id ?? payload.location ?? "").trim() : "";
}

function scoreRecord(record, queryTerms, locationId) {
  const raw = JSON.stringify(record ?? {});
  const haystack = normalizeText(raw);
  let score = 0;
  for (const term of queryTerms) {
    if (haystack.includes(term)) score += 2;
  }
  const recLocation = normalizeText(findLocationInRecord(record));
  if (recLocation && recLocation === normalizeText(locationId)) score += 4;
  return score;
}

function createLocalLoreHelper() {
  function selectLocalLore(params) {
    const campaign = params?.campaignMemory ?? {};
    const intentType = String(params?.intentType ?? "").trim().toLowerCase();
    const playerInput = String(params?.playerInput ?? "").trim();
    const locationId = String(params?.locationId ?? "").trim();

    const perIntentLimit =
      intentType === "observe"
        ? 1
        : intentType === "talk"
        ? 2
        : intentType === "ask_info"
        ? 2
        : intentType === "attempt_forbidden"
        ? 3
        : 1;

    const queryTerms = tokenize(playerInput);
    const localCandidates = [];

    const truthView = Array.isArray(campaign?.knowledge?.truth_view)
      ? campaign.knowledge.truth_view
      : [];
    const events = Array.isArray(campaign?.events) ? campaign.events : [];
    const relations = Array.isArray(campaign?.relations) ? campaign.relations : [];
    const worldOverrides =
      campaign?.world_overrides && typeof campaign.world_overrides === "object"
        ? campaign.world_overrides
        : {};

    if (Object.keys(worldOverrides).length > 0) {
      localCandidates.push({
        topic_id: "local:world_overrides",
        type: "local_state",
        source: "campaign.world_overrides",
        payload: worldOverrides,
        score: scoreRecord(worldOverrides, queryTerms, locationId),
      });
    }

    truthView.slice(-10).forEach((item, idx) => {
      localCandidates.push({
        topic_id: `local:truth_view:${idx}`,
        type: "local_truth",
        source: "campaign.knowledge.truth_view",
        payload: item,
        score: scoreRecord(item, queryTerms, locationId),
      });
    });

    events.slice(-10).forEach((item, idx) => {
      const status = String(item?.status ?? "").toLowerCase();
      if (status === "archive") return;
      localCandidates.push({
        topic_id: `local:event:${item?.event_id ?? idx}`,
        type: "local_event",
        source: "campaign.events",
        payload: item,
        score: scoreRecord(item, queryTerms, locationId) + 1,
      });
    });

    relations.slice(-10).forEach((item, idx) => {
      localCandidates.push({
        topic_id: `local:relation:${idx}`,
        type: "local_relation",
        source: "campaign.relations",
        payload: item,
        score: scoreRecord(item, queryTerms, locationId),
      });
    });

    const ranked = localCandidates
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, perIntentLimit);

    const loreDb = {};
    const selected = ranked.map((item) => {
      const compact = {
        topic_id: item.topic_id,
        type: item.type,
        source: item.source,
        snippet: toCompactText(JSON.stringify(item.payload), 240),
      };
      loreDb[item.topic_id] = compact;
      return compact;
    });

    return {
      topic_ids: selected.map((item) => item.topic_id),
      lore_db: loreDb,
      selected_entries: selected,
    };
  }

  return {
    selectLocalLore,
  };
}

module.exports = { createLocalLoreHelper };
