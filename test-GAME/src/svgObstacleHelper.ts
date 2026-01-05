import { Assets } from "pixi.js";

const svgModules = import.meta.glob("../model/*.svg", {
  as: "raw",
  eager: true
});

const OBSTACLE_SVG_BY_KEY: Record<string, string> = {};

for (const [path, svg] of Object.entries(svgModules)) {
  const file = path.split("/").pop() ?? "";
  const baseName = file.replace(/\.svg$/i, "");
  if (!baseName) continue;
  OBSTACLE_SVG_BY_KEY[`obstacle:${baseName}`] = svg as string;
}

if (OBSTACLE_SVG_BY_KEY["obstacle:arbre"] && !OBSTACLE_SVG_BY_KEY["obstacle:tree-oak"]) {
  OBSTACLE_SVG_BY_KEY["obstacle:tree-oak"] = OBSTACLE_SVG_BY_KEY["obstacle:arbre"];
}

function svgToDataUrl(svg: string): string {
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}

let obstacleTexturesPreloadPromise: Promise<void> | null = null;

export async function preloadObstacleTextures(): Promise<void> {
  if (obstacleTexturesPreloadPromise) return obstacleTexturesPreloadPromise;

  const assets = Object.entries(OBSTACLE_SVG_BY_KEY).map(([alias, svg]) => ({
    alias,
    src: svgToDataUrl(svg)
  }));

  obstacleTexturesPreloadPromise = (async () => {
    for (const asset of assets) {
      Assets.add(asset);
    }

    await Assets.load(assets.map(asset => asset.alias));
  })();

  return obstacleTexturesPreloadPromise;
}
