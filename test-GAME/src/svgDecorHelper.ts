import { Assets } from "pixi.js";

const pngModules = import.meta.glob("../decor-model/*.png", {
  as: "url",
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
