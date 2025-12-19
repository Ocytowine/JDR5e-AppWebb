import type { MapSpec, MapTheme } from "./types";

function norm(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parsePromptToSpec(params: {
  prompt: string;
  cols: number;
  rows: number;
}): { spec: MapSpec; notes: string[] } {
  const raw = String(params.prompt ?? "");
  const text = norm(raw);
  const notes: string[] = [];

  const isDungeon = hasAny(text, [
    /\bdonjon\b/,
    /\bdongon\b/, // tolère la faute fréquente
    /\bdungeon\b/,
    /\bcatacombe\b/,
    /\bcouloir\b/,
    /\bsalle\b/
  ]);

  const isForest = hasAny(text, [
    /\bforet\b/,
    /\bbois\b/,
    /\barbres?\b/,
    /\bclairiere\b/
  ]);

  const isCity = hasAny(text, [
    /\bville\b/,
    /\brue\b/,
    /\bmaisons?\b/,
    /\bquartier\b/
  ]);

  let theme: MapTheme = "generic";
  if (isDungeon) theme = "dungeon";
  else if (isForest) theme = "forest";
  else if (isCity) theme = "city";

  const isDay = hasAny(text, [/\bil fait jour\b/, /\bjour\b/]);
  const isNight = hasAny(text, [/\bnuit\b/, /\bobscur\b/, /\bsombre\b/]);
  const timeOfDay = isDay ? "day" : isNight ? "night" : "unknown";

  // ---------------------------
  // Layout selection heuristics
  // ---------------------------
  const wantsCircularRoom = hasAny(text, [/\bcircul\w+/]);
  const wantsSquareRoom = hasAny(text, [/\bcarre(?:e|es)?\b/, /\bsquare\b/]);
  const wantsRectRoom = hasAny(text, [/\brectang\w+\b/, /\brectangle\b/]);
  const wantsClearing = hasAny(text, [/\bclairiere\b/]);
  const wantsStreet = hasAny(text, [/\brue\b/]);

  const entrances =
    extractNumber(text, [/\b(\d+)\s*(acces|acces|entrees|portes)\b/]) ?? null;

  const columns =
    extractNumber(text, [/\b(\d+)\s*(colonnes|piliers)\b/]) ?? null;

  const hasAltar = hasAny(text, [/\bautel\b/, /\bhotel\b/]); // tolère la faute fréquente

  const lowLight = hasAny(text, [
    /\bfaiblement eclaire\b/,
    /\bpeu eclaire\b/,
    /\bfaible lumiere\b/
  ]);

  const centerLit = hasAny(text, [
    /\bau centre\b/,
    /\bcentre\b/,
    /\bcentral\b/
  ]);

  const doorsClosed = hasAny(text, [/\bportes? (sont )?fermees?\b/, /\bfermee\b/]);

  const sizeHint = hasAny(text, [/\bimmense\b/, /\bvaste\b/, /\bspacieu\w+\b/, /\bgrande\b/, /\bgrand\b/])
    ? "large"
    : hasAny(text, [/\bpetit\b/, /\bpetite\b/, /\bexigu\w+\b/, /\betroit\w+\b/])
      ? "small"
      : "medium";

  let layoutId: MapSpec["layoutId"] = "generic_scatter";

  if (theme === "dungeon" && (wantsSquareRoom || wantsRectRoom)) layoutId = "dungeon_square_room";
  else if (theme === "dungeon" && wantsCircularRoom) layoutId = "dungeon_circular_room";
  else if (theme === "forest" && wantsClearing) layoutId = "forest_clearing";
  else if (theme === "city" && wantsStreet) layoutId = "city_street";
  else if (theme === "dungeon") layoutId = "dungeon_circular_room"; // défaut donjon = salle
  else if (theme === "forest") layoutId = "forest_clearing";
  else if (theme === "city") layoutId = "city_street";

  const spec: MapSpec = {
    prompt: raw,
    grid: { cols: params.cols, rows: params.rows },
    layoutId,
    theme,
    timeOfDay,
    sizeHint,
    dungeon:
      theme === "dungeon"
        ? {
            borderWalls: true,
            entrances: { count: entrances ?? 2, width: 1 },
            room: {
              shape: wantsCircularRoom ? "circle" : "rectangle"
            },
            columns: columns ?? 0,
            hasAltar,
            lighting: lowLight && !isDay ? "low" : "normal"
          }
        : undefined,
    forest:
      theme === "forest"
        ? {
            radius: Math.max(2, Math.floor(Math.min(params.cols, params.rows) * 0.28)),
            treesOnRing: "sparse",
            lighting: isNight ? "night" : "day"
          }
        : undefined,
    city:
      theme === "city"
        ? {
            direction: "horizontal",
            streetWidth: 2,
            buildingDepth: 2,
            doors: doorsClosed ? "closed" : "closed",
            lighting: isNight ? "night" : "day"
          }
        : undefined
  };

  if (theme === "dungeon" && wantsCircularRoom) {
    if (spec.dungeon) {
      spec.dungeon.room.radius = Math.max(2, Math.floor(Math.min(params.cols, params.rows) * 0.33));
      if (entrances !== null) spec.dungeon.entrances.count = Math.max(1, entrances);
      if (columns !== null) spec.dungeon.columns = Math.max(0, columns);
      if (lowLight && centerLit) spec.dungeon.lighting = "low";
    }
  }

  if (theme === "dungeon" && (wantsSquareRoom || wantsRectRoom)) {
    if (spec.dungeon) {
      if (entrances !== null) spec.dungeon.entrances.count = Math.max(1, entrances);
      if (columns !== null) spec.dungeon.columns = Math.max(0, columns);
      if (lowLight && centerLit) spec.dungeon.lighting = "low";
    }
  }

  if (theme === "forest" && wantsClearing) {
    if (spec.forest) {
      spec.forest.treesOnRing = hasAny(text, [/\bparseme\b/, /\bparsem\w+/]) ? "sparse" : "dense";
      spec.forest.radius = Math.max(2, Math.floor(Math.min(params.cols, params.rows) * 0.30));
    }
  }

  if (theme === "city" && wantsStreet) {
    if (spec.city) {
      spec.city.direction = hasAny(text, [/\bverticale?\b/]) ? "vertical" : "horizontal";
      spec.city.streetWidth = Math.max(1, extractNumber(text, [/\b(\d+)\s*cases?\b/]) ?? 2);
    }
  }

  notes.push(`theme=${theme} layout=${layoutId} time=${timeOfDay}`);
  notes.push(`sizeHint=${sizeHint}`);

  return { spec, notes };
}
