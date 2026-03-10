import { PlayerKnowledgeRecord } from "./memory_types";

const AUTO_SUMMARY_LIMIT_PER_LOCATION = 2;
const AUTO_LEAD_LIMIT_PER_LOCATION = 3;

function safeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeLooseText(value: unknown): string {
  return safeString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recordLocationKey(record: PlayerKnowledgeRecord): string {
  return safeString(record.location_id).toLowerCase() || "__global__";
}

function shouldCompact(record: PlayerKnowledgeRecord): boolean {
  if (record.source !== "auto_narration") return false;
  return record.knowledge_kind === "summary" || record.knowledge_kind === "lead";
}

function dedupeKey(record: PlayerKnowledgeRecord): string {
  return [
    record.source,
    record.knowledge_kind,
    recordLocationKey(record),
    normalizeLooseText(record.text),
  ].join("|");
}

function sortByRecencyDescending(records: PlayerKnowledgeRecord[]): PlayerKnowledgeRecord[] {
  return [...records].sort((left, right) => {
    const leftTurn = safeString(left.turn_id);
    const rightTurn = safeString(right.turn_id);
    if (leftTurn && rightTurn && leftTurn !== rightTurn) {
      return rightTurn.localeCompare(leftTurn);
    }
    return safeString(right.text).localeCompare(safeString(left.text));
  });
}

function limitAutoEntriesByLocation(
  records: PlayerKnowledgeRecord[],
  knowledgeKind: "summary" | "lead",
  limit: number,
): PlayerKnowledgeRecord[] {
  const counts = new Map<string, number>();
  const kept: PlayerKnowledgeRecord[] = [];

  for (const record of records) {
    if (!(record.source === "auto_narration" && record.knowledge_kind === knowledgeKind)) {
      kept.push(record);
      continue;
    }

    const locationKey = recordLocationKey(record);
    const current = counts.get(locationKey) ?? 0;
    if (current >= limit) {
      continue;
    }
    counts.set(locationKey, current + 1);
    kept.push(record);
  }

  return kept;
}

export function compactPlayerKnowledgeView(entries: PlayerKnowledgeRecord[]): PlayerKnowledgeRecord[] {
  const dedupedNewestFirst: PlayerKnowledgeRecord[] = [];
  const seenKeys = new Set<string>();

  for (const record of sortByRecencyDescending(entries)) {
    if (!shouldCompact(record)) {
      dedupedNewestFirst.push(record);
      continue;
    }
    const key = dedupeKey(record);
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    dedupedNewestFirst.push(record);
  }

  const limitedSummaries = limitAutoEntriesByLocation(
    dedupedNewestFirst,
    "summary",
    AUTO_SUMMARY_LIMIT_PER_LOCATION,
  );
  const limitedLeads = limitAutoEntriesByLocation(
    limitedSummaries,
    "lead",
    AUTO_LEAD_LIMIT_PER_LOCATION,
  );

  return limitedLeads.reverse();
}
