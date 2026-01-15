export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(input: string): number {
  const str = String(input ?? "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickWeighted<T>(
  items: { item: T; weight: number }[],
  rand: () => number
): T | null {
  const total = items.reduce((sum, it) => sum + Math.max(0, it.weight), 0);
  if (total <= 0) return items[0]?.item ?? null;
  let r = rand() * total;
  for (const it of items) {
    const w = Math.max(0, it.weight);
    if (r < w) return it.item;
    r -= w;
  }
  return items[items.length - 1]?.item ?? null;
}

export function randomIntInclusive(rand: () => number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rand() * (hi - lo + 1));
}

