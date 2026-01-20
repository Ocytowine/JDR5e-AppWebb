import { Assets, SCALE_MODES } from "pixi.js";

const pngModules = import.meta.glob("../obstacle-types/Sprite/*.png", {
  query: "?url",
  import: "default",
  eager: true
});

const OBSTACLE_PNG_BY_KEY: Record<string, string> = {};

for (const [path, url] of Object.entries(pngModules)) {
  const file = path.split("/").pop() ?? "";
  const baseName = file.replace(/\.png$/i, "");
  if (!baseName) continue;
  OBSTACLE_PNG_BY_KEY[`obstacle:${baseName}`] = url as string;
}

export function getObstaclePngUrl(spriteKey: string | null | undefined): string | null {
  if (!spriteKey) return null;
  const url = OBSTACLE_PNG_BY_KEY[spriteKey];
  return url ?? null;
}

let obstaclePngPreloadPromise: Promise<void> | null = null;

export async function preloadObstaclePngTextures(): Promise<void> {
  if (obstaclePngPreloadPromise) return obstaclePngPreloadPromise;

  const assets = Object.entries(OBSTACLE_PNG_BY_KEY).map(([alias, url]) => ({
    alias,
    src: url,
    data: {
      autoGenerateMipmaps: true,
      scaleMode: SCALE_MODES.LINEAR,
      mipmapFilter: SCALE_MODES.LINEAR,
      maxAnisotropy: 4
    }
  }));

  obstaclePngPreloadPromise = (async () => {
    for (const asset of assets) {
      Assets.add(asset);
    }
    await Assets.load(assets.map(asset => asset.alias));
  })();

  return obstaclePngPreloadPromise;
}
