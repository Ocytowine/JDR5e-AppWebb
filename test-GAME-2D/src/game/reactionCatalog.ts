import type { ReactionDefinition } from "./reactionTypes";

import reactionsIndex from "../data/reactions/index.json";

const REACTION_MODULES = import.meta.glob("../data/reactions/**/*.json", {
  eager: true,
  import: "default"
}) as Record<string, ReactionDefinition>;

function toIndexPath(globPath: string): string {
  return globPath.replace("../data/reactions/", "./");
}

export function loadReactionTypesFromIndex(): ReactionDefinition[] {
  const indexed = Array.isArray((reactionsIndex as any).reactions)
    ? ((reactionsIndex as any).reactions as string[])
    : [];

  const loaded: ReactionDefinition[] = [];
  for (const path of indexed) {
    const globPath = `../data/reactions/${path.replace(/^\.\//, "")}`;
    const mod = REACTION_MODULES[globPath];
    if (mod) {
      loaded.push(mod);
    } else {
      const available = Object.keys(REACTION_MODULES).map(toIndexPath);
      console.warn("[reactions] Type path missing in bundle:", path, {
        availableCount: available.length
      });
    }
  }

  if (loaded.length === 0) {
    console.warn("[reactions] No reaction types loaded from index.json");
  }

  return loaded;
}
