import type { FeatureDefinition } from "./featureTypes";

import featuresIndex from "../data/features/index.json";

const FEATURE_MODULES = import.meta.glob("../data/features/**/*.json", {
  eager: true,
  import: "default"
}) as Record<string, FeatureDefinition>;

function toIndexPath(globPath: string): string {
  return globPath.replace("../data/features/", "./");
}

export function loadFeatureTypesFromIndex(): FeatureDefinition[] {
  const indexed = Array.isArray((featuresIndex as any).features)
    ? ((featuresIndex as any).features as string[])
    : [];

  const loaded: FeatureDefinition[] = [];
  for (const path of indexed) {
    const globPath = `../data/features/${path.replace(/^\.\//, "")}`;
    const mod = FEATURE_MODULES[globPath];
    if (mod) {
      loaded.push(mod);
    } else {
      const available = Object.keys(FEATURE_MODULES).map(toIndexPath);
      console.warn("[features] Type path missing in bundle:", path, {
        availableCount: available.length
      });
    }
  }

  if (loaded.length === 0) {
    console.warn("[features] No features loaded from index.json");
  }

  return loaded;
}
