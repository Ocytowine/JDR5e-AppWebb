export type StateDiff = {
  added: Record<string, unknown>;
  removed: string[];
  changed: Record<string, { before: unknown; after: unknown }>;
};

export function shallowStateDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): StateDiff {
  const beforeKeys = new Set(Object.keys(before));
  const afterKeys = new Set(Object.keys(after));

  const added: Record<string, unknown> = {};
  for (const key of [...afterKeys].sort()) {
    if (!beforeKeys.has(key)) {
      added[key] = after[key];
    }
  }

  const removed = [...beforeKeys].filter((key) => !afterKeys.has(key)).sort();

  const changed: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of [...beforeKeys].filter((k) => afterKeys.has(k)).sort()) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed[key] = { before: before[key], after: after[key] };
    }
  }

  return { added, removed, changed };
}

