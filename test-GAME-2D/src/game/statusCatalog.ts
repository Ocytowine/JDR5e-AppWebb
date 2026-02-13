import type { StatusDefinition } from "./statusTypes";

import statusIndex from "../data/passifs/index.json";
import burning from "../data/passifs/burning.json";
import frightened from "../data/passifs/frightened.json";
import incapacitated from "../data/passifs/incapacitated.json";
import killerMark from "../data/passifs/killer-mark.json";
import prone from "../data/passifs/prone.json";

const STATUS_TYPE_MODULES: Record<string, StatusDefinition> = {
  "./burning.json": burning as StatusDefinition,
  "./frightened.json": frightened as StatusDefinition,
  "./incapacitated.json": incapacitated as StatusDefinition,
  "./killer-mark.json": killerMark as StatusDefinition,
  "./prone.json": prone as StatusDefinition
};

export function loadStatusTypesFromIndex(): StatusDefinition[] {
  const indexed = Array.isArray((statusIndex as any).types)
    ? ((statusIndex as any).types as string[])
    : [];

  const loaded: StatusDefinition[] = [];
  for (const path of indexed) {
    const mod = STATUS_TYPE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[passifs] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[passifs] No status types loaded from index.json");
  }

  return loaded;
}
