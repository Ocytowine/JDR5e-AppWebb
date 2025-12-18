import type { EnemyTypeDefinition } from "./enemyTypes";
import type { GridPosition } from "../types";
import type { ObstacleInstance, ObstacleTypeDefinition } from "./obstacleTypes";

export interface MapDesignRequest {
  prompt: string;
  grid: { cols: number; rows: number };
  enemyCount: number;
  enemyTypes: EnemyTypeDefinition[];
  obstacleTypes: ObstacleTypeDefinition[];
}

export interface MapDesignResult {
  summary: string;
  playerStart: GridPosition;
  enemySpawns: { enemyType: EnemyTypeDefinition; position: GridPosition }[];
  obstacles: ObstacleInstance[];
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(input: string): number {
  const str = String(input ?? "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickWeighted<T>(
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

function chooseEnemyType(enemyTypes: EnemyTypeDefinition[], rand: () => number) {
  if (enemyTypes.length === 0) return null;
  return enemyTypes[Math.floor(rand() * enemyTypes.length)] ?? enemyTypes[0];
}

function findObstacleType(
  obstacleTypes: ObstacleTypeDefinition[],
  typeId: string
): ObstacleTypeDefinition | null {
  return obstacleTypes.find(t => t.id === typeId) ?? null;
}

function ensureInside(
  pos: GridPosition,
  cols: number,
  rows: number
): GridPosition {
  return {
    x: clamp(pos.x, 0, cols - 1),
    y: clamp(pos.y, 0, rows - 1)
  };
}

function addObstacleCell(
  obstacles: ObstacleInstance[],
  occupied: Set<string>,
  type: ObstacleTypeDefinition | null,
  x: number,
  y: number,
  nextId: () => string
) {
  if (!type) return;
  const colsKey = key(x, y);
  if (occupied.has(colsKey)) return;
  const variantId = type.variants?.[0]?.id ?? "base";
  const maxHp = Math.max(1, Number(type.durability?.maxHp ?? 1));
  obstacles.push({
    id: nextId(),
    typeId: type.id,
    variantId,
    x,
    y,
    rotation: 0,
    hp: maxHp,
    maxHp
  });
  occupied.add(colsKey);
}

function carveRectWalls(params: {
  rect: { x1: number; y1: number; x2: number; y2: number };
  door?: GridPosition | null;
  wallType: ObstacleTypeDefinition | null;
  obstacles: ObstacleInstance[];
  occupied: Set<string>;
  nextId: () => string;
}) {
  const { rect, door, wallType, obstacles, occupied, nextId } = params;
  for (let x = rect.x1; x <= rect.x2; x++) {
    const top = { x, y: rect.y1 };
    const bottom = { x, y: rect.y2 };
    if (!door || !(door.x === top.x && door.y === top.y)) {
      addObstacleCell(obstacles, occupied, wallType, top.x, top.y, nextId);
    }
    if (!door || !(door.x === bottom.x && door.y === bottom.y)) {
      addObstacleCell(obstacles, occupied, wallType, bottom.x, bottom.y, nextId);
    }
  }
  for (let y = rect.y1; y <= rect.y2; y++) {
    const left = { x: rect.x1, y };
    const right = { x: rect.x2, y };
    if (!door || !(door.x === left.x && door.y === left.y)) {
      addObstacleCell(obstacles, occupied, wallType, left.x, left.y, nextId);
    }
    if (!door || !(door.x === right.x && door.y === right.y)) {
      addObstacleCell(obstacles, occupied, wallType, right.x, right.y, nextId);
    }
  }
}

export function generateBattleMap(request: MapDesignRequest): MapDesignResult {
  const cols = Math.max(1, request.grid.cols);
  const rows = Math.max(1, request.grid.rows);
  const prompt = String(request.prompt ?? "").trim();
  const normalized = prompt.toLowerCase();
  const rand = mulberry32(hashStringToSeed(prompt || "default"));

  const obstacles: ObstacleInstance[] = [];
  const occupied = new Set<string>();
  let obstacleSeq = 1;
  const nextId = () => `obs-${obstacleSeq++}`;

  const wallType =
    findObstacleType(request.obstacleTypes, "wall-stone") ??
    request.obstacleTypes.find(t => t.category === "wall") ??
    request.obstacleTypes[0] ??
    null;

  const treeType =
    findObstacleType(request.obstacleTypes, "tree-oak") ??
    request.obstacleTypes.find(t => (t.tags ?? []).includes("tree")) ??
    null;

  const pillarType =
    findObstacleType(request.obstacleTypes, "pillar-stone") ??
    request.obstacleTypes.find(t => (t.tags ?? []).includes("pillar")) ??
    null;

  const barrelType =
    findObstacleType(request.obstacleTypes, "barrel-wood") ??
    request.obstacleTypes.find(t => (t.tags ?? []).includes("barrel")) ??
    null;

  const wantsDungeon =
    /donjon|dungeon|salle|couloir|corridor|porte|ruine|catacombe/.test(
      normalized
    );
  const wantsForest =
    /foret|forêt|bois|arbres|arbre|clairiere|clairière/.test(normalized);

  const playerStart = ensureInside({ x: 1, y: Math.floor(rows / 2) }, cols, rows);

  if (wantsDungeon && wallType) {
    const room = {
      x1: clamp(Math.floor(cols * 0.55), 0, cols - 1),
      y1: clamp(1, 0, rows - 1),
      x2: clamp(cols - 2, 0, cols - 1),
      y2: clamp(rows - 2, 0, rows - 1)
    };
    const door = ensureInside(
      { x: room.x1, y: clamp(Math.floor(rows / 2), room.y1, room.y2) },
      cols,
      rows
    );

    carveRectWalls({ rect: room, door, wallType, obstacles, occupied, nextId });

    // A few props inside the room.
    const props: { type: ObstacleTypeDefinition | null; weight: number }[] = [
      { type: pillarType, weight: 3 },
      { type: barrelType, weight: 2 }
    ];
    const chosenProp = pickWeighted(
      props.filter(p => Boolean(p.type)).map(p => ({ item: p.type as ObstacleTypeDefinition, weight: p.weight })),
      rand
    );

    if (chosenProp) {
      const attempts = 20;
      for (let i = 0; i < attempts; i++) {
        const x = clamp(room.x1 + 1 + Math.floor(rand() * Math.max(1, room.x2 - room.x1 - 1)), 0, cols - 1);
        const y = clamp(room.y1 + 1 + Math.floor(rand() * Math.max(1, room.y2 - room.y1 - 1)), 0, rows - 1);
        if (x === door.x && y === door.y) continue;
        if (occupied.has(key(x, y))) continue;
        addObstacleCell(obstacles, occupied, chosenProp, x, y, nextId);
        if (rand() < 0.5 && barrelType && chosenProp.id !== barrelType.id) {
          // Add a second small prop sometimes.
          const nx = clamp(x + (rand() < 0.5 ? 1 : -1), 0, cols - 1);
          const ny = clamp(y + (rand() < 0.5 ? 1 : -1), 0, rows - 1);
          addObstacleCell(obstacles, occupied, barrelType, nx, ny, nextId);
        }
        break;
      }
    }
  } else if (wantsForest && treeType) {
    // Scatter trees but keep a simple corridor from player to far right.
    const corridorY = playerStart.y;
    const treeCount = clamp(Math.floor((cols * rows) / 8), 3, 12);
    for (let i = 0; i < treeCount; i++) {
      const x = Math.floor(rand() * cols);
      const y = Math.floor(rand() * rows);
      if (y === corridorY && x <= cols - 2) continue;
      if (x === playerStart.x && y === playerStart.y) continue;
      addObstacleCell(obstacles, occupied, treeType, x, y, nextId);
    }
  } else {
    // Default: light scatter of props (keeps gameplay readable).
    const prop = barrelType ?? pillarType ?? wallType;
    const count = clamp(Math.floor((cols * rows) / 18), 1, 6);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * cols);
      const y = Math.floor(rand() * rows);
      if (x === playerStart.x && y === playerStart.y) continue;
      addObstacleCell(obstacles, occupied, prop, x, y, nextId);
    }
  }

  // Enemy spawns: pick empty cells far from player (simple heuristic).
  const enemySpawns: { enemyType: EnemyTypeDefinition; position: GridPosition }[] = [];
  const enemyCount = clamp(request.enemyCount, 1, 20);

  const scoreCell = (x: number, y: number) =>
    Math.abs(x - playerStart.x) + Math.abs(y - playerStart.y) + rand() * 0.25;

  const candidates: GridPosition[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (occupied.has(key(x, y))) continue;
      if (x === playerStart.x && y === playerStart.y) continue;
      candidates.push({ x, y });
    }
  }
  candidates.sort((a, b) => scoreCell(b.x, b.y) - scoreCell(a.x, a.y));

  for (let i = 0; i < enemyCount; i++) {
    const enemyType = chooseEnemyType(request.enemyTypes, rand);
    if (!enemyType) break;

    const pos = candidates.find(c => !enemySpawns.some(e => e.position.x === c.x && e.position.y === c.y));
    if (!pos) break;

    enemySpawns.push({ enemyType, position: pos });
  }

  const summaryParts: string[] = [];
  if (prompt) summaryParts.push(`Prompt: ${prompt}`);
  summaryParts.push(
    wantsDungeon
      ? "Layout: donjon (salle + murs)."
      : wantsForest
        ? "Layout: foret (arbres disperses)."
        : "Layout: basique (props disperses)."
  );
  summaryParts.push(`Obstacles: ${obstacles.length}. Ennemis: ${enemySpawns.length}.`);

  return {
    summary: summaryParts.join(" "),
    playerStart,
    enemySpawns,
    obstacles
  };
}

