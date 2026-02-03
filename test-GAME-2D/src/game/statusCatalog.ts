import type { StatusDefinition } from "./statusTypes";

import statusIndex from "../../action-game/passifs/index.json";
import burning from "../../action-game/passifs/burning.json";
import killerMark from "../../action-game/passifs/killer-mark.json";

const STATUS_TYPE_MODULES: Record<string, StatusDefinition> = {
  "./burning.json": burning as StatusDefinition,
  "./killer-mark.json": killerMark as StatusDefinition
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
