import { tokenShapes, type TokenShapeId } from "./tokenShapes";

const PLAYER_COLOR = "#87CEFA"; // bleu ciel
const ENEMY_COLOR = "#FF0000"; // rouge

export type TokenKind = "player" | "enemy";

function getColorForKind(kind: TokenKind): string {
  if (kind === "player") return PLAYER_COLOR;
  return ENEMY_COLOR;
}

export function buildTokenSvg(kind: TokenKind): string {
  const shapeId: TokenShapeId = kind === "player" ? "player" : "enemy";
  const { d, transform } = tokenShapes[shapeId];
  const color = getColorForKind(kind);

  const pathTransform = transform ? ` transform="${transform}"` : "";

  return [
    `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="background:none">`,
    `<g>`,
    `<path d="${d}"${pathTransform} fill="${color}" />`,
    `</g>`,
    `</svg>`
  ].join("");
}

export function buildTokenSvgDataUrl(kind: TokenKind): string {
  const svg = buildTokenSvg(kind);
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}
