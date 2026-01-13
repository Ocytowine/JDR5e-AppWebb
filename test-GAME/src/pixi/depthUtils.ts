export type ScreenPoint = { x: number; y: number };

export function maxScreenY(points: ScreenPoint[]): number {
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.y > maxY) {
      maxY = point.y;
    }
  }
  return maxY;
}

export function computeDepthValue(
  screenY: number,
  heightOffset: number,
  bias = 0
): number {
  return screenY - heightOffset + bias;
}

export function computeDepthFromPoints(
  points: ScreenPoint[],
  heightOffset: number,
  bias = 0
): number {
  const maxY = maxScreenY(points);
  const screenY = Number.isFinite(maxY) ? maxY : 0;
  return computeDepthValue(screenY, heightOffset, bias);
}
