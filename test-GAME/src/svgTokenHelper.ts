import gentilSvgSource from "../model/gentil.svg?raw";
import mechantSvgSource from "../model/mechant.svg?raw";

const PLAYER_COLOR = "#87CEFA"; // bleu ciel
const ENEMY_COLOR = "#FF0000"; // rouge

export type TokenKind = "player" | "enemy";

interface ParsedShape {
  d: string;
  transform?: string;
  viewBox: string;
}

function parseSvgPath(source: string): ParsedShape {
  const viewBoxMatch = source.match(/viewBox\s*=\s*"([^"]+)"/i);
  const pathMatch = source.match(/<path[^>]*\sd="([^"]+)"[^>]*>/i);

  if (!viewBoxMatch || !pathMatch) {
    throw new Error("Cannot parse SVG path/viewBox from source.");
  }

  const transformMatch = pathMatch[0].match(/transform="([^"]+)"/i);

  return {
    d: pathMatch[1],
    transform: transformMatch ? transformMatch[1] : undefined,
    viewBox: viewBoxMatch[1]
  };
}

const playerShape = parseSvgPath(gentilSvgSource);
const enemyShape = parseSvgPath(mechantSvgSource);

function getColorForKind(kind: TokenKind): string {
  if (kind === "player") return PLAYER_COLOR;
  return ENEMY_COLOR;
}

export function buildTokenSvg(kind: TokenKind): string {
  const shape = kind === "player" ? playerShape : enemyShape;
  const color = getColorForKind(kind);

  const pathTransform = shape.transform ? ` transform="${shape.transform}"` : "";

  return [
    `<svg viewBox="${shape.viewBox}" xmlns="http://www.w3.org/2000/svg" style="background:none">`,
    `<g>`,
    `<path d="${shape.d}"${pathTransform} fill="${color}" />`,
    `</g>`,
    `</svg>`
  ].join("");
}

export function buildTokenSvgDataUrl(kind: TokenKind): string {
  const svg = buildTokenSvg(kind);
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}
