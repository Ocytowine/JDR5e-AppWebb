import type { ReactionDefinition } from "./reactionTypes";

import reactionsIndex from "../../reaction-types/index.json";
import opportunityAttack from "../../reaction-types/opportunity-attack.json";
import guardStrike from "../../reaction-types/guard-strike.json";
import killerInstinct from "../../reaction-types/killer-instinct.json";

const REACTION_TYPE_MODULES: Record<string, ReactionDefinition> = {
  "./opportunity-attack.json": opportunityAttack as ReactionDefinition,
  "./guard-strike.json": guardStrike as ReactionDefinition,
  "./killer-instinct.json": killerInstinct as ReactionDefinition
};

export function loadReactionTypesFromIndex(): ReactionDefinition[] {
  const indexed = Array.isArray((reactionsIndex as any).reactions)
    ? ((reactionsIndex as any).reactions as string[])
    : [];

  const loaded: ReactionDefinition[] = [];
  for (const path of indexed) {
    const mod = REACTION_TYPE_MODULES[path];
    if (mod) {
      loaded.push(mod);
    } else {
      console.warn("[reaction-types] Type path missing in bundle:", path);
    }
  }

  if (loaded.length === 0) {
    console.warn("[reaction-types] No reaction types loaded from index.json");
  }

  return loaded;
}
