import { Assets, SCALE_MODES } from "pixi.js";

type TokenSpriteEntry = { url: string; index: number; name: string };

const pngModules = import.meta.glob("../action-game/model/*.png", {
  query: "?url",
  import: "default",
  eager: true
});

const TOKEN_PNG_BY_BASE: Record<string, TokenSpriteEntry[]> = {};

for (const [path, url] of Object.entries(pngModules)) {
  const file = path.split("/").pop() ?? "";
  const baseName = file.replace(/\.png$/i, "");
  if (!baseName) continue;
  const match = baseName.match(/^(.*?)-(\d+)$/);
  const baseKey = match ? match[1] : baseName;
  const index = match ? Number.parseInt(match[2], 10) : 1;
  if (!TOKEN_PNG_BY_BASE[baseKey]) {
    TOKEN_PNG_BY_BASE[baseKey] = [];
  }
  TOKEN_PNG_BY_BASE[baseKey].push({ url: url as string, index, name: baseName });
}

for (const key of Object.keys(TOKEN_PNG_BY_BASE)) {
  TOKEN_PNG_BY_BASE[key].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return a.name.localeCompare(b.name);
  });
}

function hashString01(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function getTokenSpriteUrl(
  spriteKey: string | null | undefined,
  seed?: string | null,
  variants?: number[] | null
): string | null {
  if (!spriteKey) return null;
  const entries = TOKEN_PNG_BY_BASE[spriteKey];
  if (!entries || entries.length === 0) return null;
  const allowed =
    Array.isArray(variants) && variants.length > 0
      ? entries.filter(entry => variants.includes(entry.index))
      : entries;
  if (allowed.length === 0) return null;
  if (allowed.length === 1) return allowed[0]?.url ?? null;
  const t = seed ? hashString01(`${spriteKey}:${seed}`) : Math.random();
  const index = Math.max(0, Math.min(allowed.length - 1, Math.floor(t * allowed.length)));
  return allowed[index]?.url ?? null;
}

let tokenPngPreloadPromise: Promise<void> | null = null;

export async function preloadTokenPngTextures(): Promise<void> {
  if (tokenPngPreloadPromise) return tokenPngPreloadPromise;

  const assets = Object.values(TOKEN_PNG_BY_BASE).flatMap(list =>
    list.map(entry => ({
      alias: entry.url,
      src: entry.url,
      data: {
        autoGenerateMipmaps: true,
        scaleMode: SCALE_MODES.LINEAR,
        mipmapFilter: SCALE_MODES.LINEAR,
        maxAnisotropy: 4
      }
    }))
  );

  tokenPngPreloadPromise = (async () => {
    for (const asset of assets) {
      Assets.add(asset);
    }
    await Assets.load(assets.map(asset => asset.alias));
  })();

  return tokenPngPreloadPromise;
}
