import { Assets } from "pixi.js";

const pngModules = import.meta.glob("../decor-model/*.png", {
  query: "?url",
  import: "default",
  eager: true
});

const DECOR_PNG_BY_KEY: Record<string, string> = {};

for (const [path, url] of Object.entries(pngModules)) {
  const file = path.split("/").pop() ?? "";
  const baseName = file.replace(/\.png$/i, "");
  if (!baseName) continue;
  DECOR_PNG_BY_KEY[`decor:${baseName}`] = url as string;
}

export function getDecorPngUrl(spriteKey: string | null | undefined): string | null {
  if (!spriteKey) return null;
  const url = DECOR_PNG_BY_KEY[spriteKey];
  return url ?? null;
}

let decorTexturesPreloadPromise: Promise<void> | null = null;
const loadedDecorAliases = new Set<string>();
const pendingDecorAliases = new Set<string>();

export async function preloadDecorTextures(): Promise<void> {
  if (decorTexturesPreloadPromise) return decorTexturesPreloadPromise;

  const assets = Object.entries(DECOR_PNG_BY_KEY).map(([alias, url]) => ({
    alias,
    src: url
  }));

  decorTexturesPreloadPromise = (async () => {
    for (const asset of assets) {
      Assets.add(asset);
    }

    await Assets.load(assets.map(asset => asset.alias));
  })();

  return decorTexturesPreloadPromise;
}

export async function preloadDecorTexturesFor(spriteKeys: string[]): Promise<void> {
  if (!Array.isArray(spriteKeys) || spriteKeys.length === 0) return;

  const assets = new Map<string, { alias: string; src: string }>();
  for (const spriteKey of spriteKeys) {
    if (!spriteKey) continue;
    const url = DECOR_PNG_BY_KEY[spriteKey];
    if (!url) continue;
    if (loadedDecorAliases.has(spriteKey) || pendingDecorAliases.has(spriteKey)) continue;
    assets.set(spriteKey, { alias: spriteKey, src: url });
    pendingDecorAliases.add(spriteKey);
  }

  if (assets.size === 0) return;

  try {
    for (const asset of assets.values()) {
      Assets.add(asset);
    }
    const aliases = [...assets.keys()];
    await Assets.load(aliases);
    for (const alias of aliases) {
      loadedDecorAliases.add(alias);
      pendingDecorAliases.delete(alias);
    }
  } catch (error) {
    for (const alias of assets.keys()) {
      pendingDecorAliases.delete(alias);
    }
    throw error;
  }
}
