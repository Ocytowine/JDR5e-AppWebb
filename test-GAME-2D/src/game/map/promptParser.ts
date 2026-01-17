import type {
  EntrancePlacementSpec,
  EntranceSide,
  EntrancePosition,
  MapSpec,
  MapTheme,
  DungeonPlanSpec,
  DungeonDoorState
} from "./types";

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

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10
};

function extractWordNumber(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    const token = String(m[1] ?? "").trim();
    if (!token) continue;
    const n = NUMBER_WORDS[token];
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function uniqueSides(placements: EntrancePlacementSpec[]): EntranceSide[] {
  const set = new Set<EntranceSide>();
  for (const p of placements) set.add(p.side);
  return Array.from(set);
}

function splitClauses(text: string): string[] {
  return text
    .split(/[.;]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseDoorState(text: string): DungeonDoorState | null {
  if (hasAny(text, [/\bportes? (sont )?fermees?\b/, /\bporte fermee\b/])) return "closed";
  if (hasAny(text, [/\bportes? (sont )?ouvertes?\b/, /\bporte ouverte\b/])) return "open";
  return null;
}

function parseDoorPosition(text: string): EntrancePosition | undefined {
  if (/\b(centre|centree|milieu)\b/.test(text)) return "center";
  if (/\bgauche\b/.test(text)) return "start";
  if (/\bdroite\b/.test(text)) return "end";
  return undefined;
}

function parseSideHint(text: string): EntranceSide | undefined {
  if (/\bnord\b/.test(text)) return "north";
  if (/\bsud\b/.test(text)) return "south";
  if (/\best\b/.test(text)) return "east";
  if (/\bouest\b/.test(text)) return "west";
  return undefined;
}

function extractRoomCount(text: string): number | null {
  const numeric = extractNumber(text, [/\b(\d+)\s*(salles?|pieces?|rooms?)\b/]);
  if (numeric !== null) return numeric;
  const worded = extractWordNumber(text, [/\b([a-z]+)\s*(salles?|pieces?|rooms?)\b/]);
  return worded ?? null;
}

function clampGrid(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function computeExpandedGrid(params: {
  cols: number;
  rows: number;
  roomCount: number;
  style: "split" | "corridor";
  axis?: "vertical" | "horizontal";
  corridorSide?: EntranceSide;
}): { cols: number; rows: number } {
  const baseCols = Math.max(1, params.cols);
  const baseRows = Math.max(1, params.rows);
  const rooms = Math.max(2, Math.floor(params.roomCount));
  const minRoomW = 6;
  const minRoomH = 6;
  const wallGap = rooms - 1;

  if (params.style === "split") {
    const axis = params.axis ?? "vertical";
    if (axis === "vertical") {
      const minCols = minRoomW * rooms + wallGap + 2;
      const minRows = minRoomH + 2;
      return {
        cols: clampGrid(Math.max(baseCols, minCols), baseCols, 70),
        rows: clampGrid(Math.max(baseRows, minRows), baseRows, 50)
      };
    }
    const minCols = minRoomW + 2;
    const minRows = minRoomH * rooms + wallGap + 2;
    return {
      cols: clampGrid(Math.max(baseCols, minCols), baseCols, 70),
      rows: clampGrid(Math.max(baseRows, minRows), baseRows, 50)
    };
  }

  const corridorWidth = 2;
  const side = params.corridorSide ?? "north";
  if (side === "north" || side === "south") {
    const minCols = minRoomW * rooms + wallGap + 2;
    const minRows = minRoomH + corridorWidth + 3;
    return {
      cols: clampGrid(Math.max(baseCols, minCols), baseCols, 70),
      rows: clampGrid(Math.max(baseRows, minRows), baseRows, 50)
    };
  }
  const minCols = minRoomW + corridorWidth + 3;
  const minRows = minRoomH * rooms + wallGap + 2;
  return {
    cols: clampGrid(Math.max(baseCols, minCols), baseCols, 70),
    rows: clampGrid(Math.max(baseRows, minRows), baseRows, 50)
  };
}

function mapPositionToken(
  token: string,
  side: EntranceSide
): "center" | "start" | "end" | null {
  if (!token) return null;
  if (token === "centre" || token === "milieu") return "center";
  if (token === "gauche") return "start";
  if (token === "droite") return "end";
  if (token === "haut") return side === "east" || side === "west" ? "start" : null;
  if (token === "bas") return side === "east" || side === "west" ? "end" : null;
  return null;
}

function extractEntrancePlacements(text: string): EntrancePlacementSpec[] {
  const placements: EntrancePlacementSpec[] = [];
  const doorIntent = /\bportes?\b/.test(text);

  const sideTokenToSide: Record<string, EntranceSide> = {
    nord: "north",
    sud: "south",
    est: "east",
    ouest: "west"
  };

  const addPlacement = (side: EntranceSide, count?: number, position?: "center" | "start" | "end") => {
    placements.push({
      side,
      count: typeof count === "number" && Number.isFinite(count) ? Math.max(1, Math.floor(count)) : undefined,
      position
    });
  };

  const pattern = /\b(\d+)?\s*portes?\s*(?:au|a|sur|du|de la|de l'|cote|cot[eé])?\s*(?:mur|cote|cot[eé])?\s*(nord|sud|est|ouest)\b(?:\s*(?:au|a|du|de la)?\s*(centre|milieu|gauche|droite|haut|bas))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const count = match[1] ? Number(match[1]) : undefined;
    const sideToken = match[2];
    const posToken = match[3];
    const side = sideTokenToSide[sideToken];
    const pos = posToken ? mapPositionToken(posToken, side) : null;
    addPlacement(side, count, pos ?? undefined);
  }

  const patternSwap = /\bportes?\s*(?:au|a|du|de la)?\s*(centre|milieu|gauche|droite|haut|bas)\s*(?:du|de la|de l'|cote|cot[eé]|mur)?\s*(nord|sud|est|ouest)\b/g;
  while ((match = patternSwap.exec(text))) {
    const posToken = match[1];
    const sideToken = match[2];
    const side = sideTokenToSide[sideToken];
    const pos = mapPositionToken(posToken, side);
    addPlacement(side, undefined, pos ?? undefined);
  }

  const cornerPattern = /\bportes?\s*(?:au|a|dans le)?\s*coin\s*(nord|sud)\s*[- ]?(est|ouest)\b/g;
  while ((match = cornerPattern.exec(text))) {
    const sideToken = match[1];
    const posToken = match[2];
    const side = sideTokenToSide[sideToken];
    const pos = posToken === "est" ? "end" : "start";
    addPlacement(side, undefined, pos);
  }

  if (doorIntent) {
    const sideHints: Array<{ side: EntranceSide; token: RegExp }> = [
      { side: "north", token: /\bnord\b/ },
      { side: "south", token: /\bsud\b/ },
      { side: "east", token: /\best\b/ },
      { side: "west", token: /\bouest\b/ }
    ];
    for (const hint of sideHints) {
      if (!hint.token.test(text)) continue;
      if (placements.some(p => p.side === hint.side)) continue;
      addPlacement(hint.side, 1);
    }
  }

  return placements;
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
  const hasTimeToken = hasAny(text, [/\bjour\b/, /\bnuit\b/]);
  const promptWithTime =
    raw.trim().length > 0 && timeOfDay !== "unknown" && !hasTimeToken
      ? `${raw.trim()} (${timeOfDay === "day" ? "jour" : "nuit"})`
      : raw;

  // ---------------------------
  // Layout selection heuristics
  // ---------------------------
  const wantsCircularRoom = hasAny(text, [/\bcircul\w+/]);
  const wantsSquareRoom = hasAny(text, [/\bcarre(?:e|es)?\b/, /\bsquare\b/]);
  const wantsRectRoom = hasAny(text, [/\brectang\w+\b/, /\brectangle\b/]);
  const wantsClearing = hasAny(text, [/\bclairiere\b/]);
  const wantsStreet = hasAny(text, [/\brue\b/]);
  const wantsHouse = hasAny(text, [/\bmaison\b/, /\bmaisons?\b/, /\bbatiment\b/]);
  const wantsBuildingLayout = hasAny(text, [
    /\btoit\b/,
    /\bterrasse\b/,
    /\bbalcon\b/,
    /\bbatiment\b/,
    /\betage\b/,
    /\blevel\b/
  ]);
  const wantsRoofClosed = hasAny(text, [/\bferme\b/, /\bclos\b/, /\bclois?\b/, /\binterieur\b/]);
  const wantsRoofOpen = hasAny(text, [/\bouvert\b/, /\baccessible\b/, /\bterrasse\b/, /\bbalcon\b/]);
  const buildingStyle: "open" | "closed" = wantsRoofClosed ? "closed" : "open";

  const noEntrances = hasAny(text, [
    /\bsans portes?\b/,
    /\bsans ouvertures?\b/,
    /\bentoure de murs?\b/,
    /\bentoure de mur\b/
  ]);

  const entrancePlacements = extractEntrancePlacements(text);
  const entrances =
    extractNumber(text, [/\b(\d+)\s*(acces|acces|entrees|portes)\b/]) ?? null;

  const columns =
    extractNumber(text, [/\b(\d+)\s*(colonnes|piliers)\b/]) ?? null;
  const houseCount =
    extractNumber(text, [/\b(\d+)\s*(maisons?|batiments?)\b/]) ?? null;

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

  const roomCount = extractRoomCount(text);
  const wantsCorridor = hasAny(text, [/\bcouloir\b/, /\bcorridor\b/]);
  const wantsSplitWall = hasAny(text, [
    /\bsepare\w*\b/,
    /\bseparation\b/,
    /\bmur avec porte\b/
  ]);
  const corridorSide = wantsCorridor ? parseSideHint(text) : undefined;
  let splitAxis: "vertical" | "horizontal" | undefined;
  if (hasAny(text, [/\best\b/, /\bouest\b/])) splitAxis = "vertical";
  else if (hasAny(text, [/\bnord\b/, /\bsud\b/])) splitAxis = "horizontal";

  const hasMultiRooms = theme === "dungeon" && roomCount !== null && roomCount >= 2;

  let layoutId: MapSpec["layoutId"] = "generic_scatter";

  if (theme === "dungeon" && (wantsSquareRoom || wantsRectRoom)) layoutId = "dungeon_square_room";
  else if (theme === "dungeon" && wantsCircularRoom) layoutId = "dungeon_circular_room";
  else if (theme === "forest" && wantsClearing) layoutId = "forest_clearing";
  else if (theme === "city" && wantsStreet) layoutId = "city_street";
  else if (theme === "dungeon") layoutId = "dungeon_circular_room"; // défaut donjon = salle
  else if (theme === "forest") layoutId = "forest_clearing";
  else if (theme === "city") layoutId = "city_street";
  if (wantsBuildingLayout && !wantsStreet) layoutId = "building_tiered";

  const spec: MapSpec = {
    prompt: promptWithTime,
    grid: { cols: params.cols, rows: params.rows },
    layoutId,
    theme,
    timeOfDay,
    sizeHint,
    dungeon:
      theme === "dungeon"
        ? {
            borderWalls: true,
            entrances: {
              count: noEntrances ? 0 : (entrances ?? (entrancePlacements.length ? 0 : 2)),
              width: 1,
              placements: entrancePlacements.length ? entrancePlacements : undefined,
              sides: entrancePlacements.length ? uniqueSides(entrancePlacements) : undefined
            },
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
            lighting: isNight ? "night" : "day",
            patterns: undefined
          }
        : undefined
  };

  let dungeonPlan: DungeonPlanSpec | null = null;
  if (hasMultiRooms) {
    const normalizedRooms = Math.max(2, Math.min(6, Math.floor(roomCount ?? 2)));
    const layoutStyle =
      wantsCorridor || normalizedRooms > 2
        ? "corridor"
        : wantsSplitWall
          ? "split"
          : "split";

    const rooms = Array.from({ length: normalizedRooms }, (_, idx) => ({
      id: `room-${idx + 1}`
    }));

    const playerRoomId = rooms[0]?.id ?? "room-1";
    let enemyRoomId: string | undefined;

    const clauses = splitClauses(text);
    for (const clause of clauses) {
      if (!enemyRoomId && /\b(autre|l'autre|seconde|deuxieme)\b/.test(clause)) {
        enemyRoomId = rooms[1]?.id;
      }
    }

    const doorState = parseDoorState(text) ?? "open";
    const doorPosition = parseDoorPosition(text);

    dungeonPlan = {
      roomCount: normalizedRooms,
      layoutStyle,
      splitAxis: layoutStyle === "split" ? (splitAxis ?? "vertical") : undefined,
      corridorSide: layoutStyle === "corridor" ? (corridorSide ?? "north") : undefined,
      doorState,
      doorPosition,
      playerRoomId,
      enemyRoomId,
      rooms
    };

    for (const clause of clauses) {
      const isPlayerClause = /\b(joueur|player|heros)\b/.test(clause);
      const isOtherClause = /\b(autre|l'autre|seconde|deuxieme)\b/.test(clause);
      const targetRoomId = isOtherClause
        ? (enemyRoomId ?? rooms[1]?.id ?? playerRoomId)
        : isPlayerClause
          ? playerRoomId
          : undefined;

      const tableCount =
        extractNumber(clause, [/\b(\d+)\s*table\w*\b/]) ??
        extractWordNumber(clause, [/\b([a-z]+)\s*table\w*\b/]) ??
        (/\btable\w*\b/.test(clause) ? 1 : null);
      const barrelCount =
        extractNumber(clause, [/\b(\d+)\s*(tonneau\w*|baril\w*|barrel\w*)\b/]) ??
        extractWordNumber(clause, [/\b([a-z]+)\s*(tonneau\w*|baril\w*|barrel\w*)\b/]) ??
        (/\b(tonneau\w*|baril\w*|barrel\w*)\b/.test(clause) ? 2 : null);

      const enemyCount =
        extractNumber(clause, [/\b(\d+)\s*ennemis?\b/]) ??
        extractWordNumber(clause, [/\b([a-z]+)\s*ennemis?\b/]);

      if (enemyCount !== null) {
        dungeonPlan.enemyCountOverride = Math.max(1, Math.floor(enemyCount));
        const resolvedRoomId = targetRoomId ?? dungeonPlan.enemyRoomId ?? rooms[1]?.id;
        if (resolvedRoomId) dungeonPlan.enemyRoomId = resolvedRoomId;
      }

      const addContent = (kind: "table" | "barrel", count: number | null) => {
        if (count === null) return;
        const roomId = targetRoomId ?? playerRoomId;
        const room = dungeonPlan?.rooms.find(r => r.id === roomId);
        if (!room) return;
        room.contents = room.contents ?? [];
        room.contents.push({ kind, count });
      };

      addContent("table", tableCount);
      addContent("barrel", barrelCount);

      if (/\bacces exterieur\b/.test(clause) || /\bentree exterieure\b/.test(clause)) {
        const state = parseDoorState(clause) ?? "open";
        const side = parseSideHint(clause);
        dungeonPlan.exteriorAccess = [
          {
            roomId: playerRoomId,
            side,
            position: parseDoorPosition(clause),
            state
          }
        ];
      }
    }

    if (dungeonPlan.enemyCountOverride) {
      notes.push(`enemyCountOverride=${dungeonPlan.enemyCountOverride}`);
    }
    if (dungeonPlan.exteriorAccess?.length) {
      const access = dungeonPlan.exteriorAccess[0];
      if (access) {
        notes.push(`exteriorAccess room=${access.roomId} side=${access.side ?? "auto"} state=${access.state ?? "open"}`);
      }
    }

    const expanded = computeExpandedGrid({
      cols: spec.grid.cols,
      rows: spec.grid.rows,
      roomCount: normalizedRooms,
      style: layoutStyle,
      axis: dungeonPlan.splitAxis,
      corridorSide: dungeonPlan.corridorSide
    });
    if (expanded.cols !== spec.grid.cols || expanded.rows !== spec.grid.rows) {
      notes.push(`gridExpanded=${expanded.cols}x${expanded.rows}`);
    }
    spec.grid = expanded;
    spec.layoutId =
      layoutStyle === "corridor"
        ? "dungeon_corridor_rooms"
        : "dungeon_split_rooms";
    spec.dungeonPlan = dungeonPlan;
    notes.push(`dungeonPlan rooms=${dungeonPlan.roomCount} style=${dungeonPlan.layoutStyle}`);
  }

  if (theme === "dungeon" && wantsCircularRoom) {
    if (spec.dungeon) {
      spec.dungeon.room.radius = Math.max(2, Math.floor(Math.min(params.cols, params.rows) * 0.33));
      if (entrances !== null) spec.dungeon.entrances.count = Math.max(0, entrances);
      if (entrancePlacements.length) {
        spec.dungeon.entrances.placements = entrancePlacements;
        spec.dungeon.entrances.sides = uniqueSides(entrancePlacements);
      }
      if (columns !== null) spec.dungeon.columns = Math.max(0, columns);
      if (lowLight && centerLit) spec.dungeon.lighting = "low";
    }
  }

  if (theme === "dungeon" && (wantsSquareRoom || wantsRectRoom)) {
    if (spec.dungeon) {
      if (entrances !== null) spec.dungeon.entrances.count = Math.max(0, entrances);
      if (entrancePlacements.length) {
        spec.dungeon.entrances.placements = entrancePlacements;
        spec.dungeon.entrances.sides = uniqueSides(entrancePlacements);
      }
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
      if (houseCount !== null) spec.city.patternCount = Math.max(1, houseCount);
    }
  }

  if (theme === "city" && spec.city && wantsStreet && wantsHouse) {
    if (wantsBuildingLayout) {
      spec.city.patterns = [buildingStyle === "closed" ? "house-tiered-closed" : "house-tiered-open"];
    } else {
      spec.city.patterns = ["street-house-front-3x5"];
    }
    notes.push(`cityPatterns=${spec.city.patterns.join(",")}`);
    if (typeof spec.city.patternCount === "number") {
      notes.push(`cityPatternCount=${spec.city.patternCount}`);
    }
  }

  if (theme === "dungeon" && spec.dungeon) {
    if (noEntrances) {
      spec.dungeon.entrances.count = 0;
      spec.dungeon.entrances.placements = undefined;
      spec.dungeon.entrances.sides = undefined;
    } else if (entrancePlacements.length) {
      const placementCount = entrancePlacements.reduce(
        (sum, p) => sum + (p.count ?? 1),
        0
      );
      spec.dungeon.entrances.count = Math.max(
        spec.dungeon.entrances.count,
        placementCount
      );
    }
  }

  if (spec.layoutId === "building_tiered" && wantsBuildingLayout) {
    spec.building = { style: buildingStyle };
  } else {
    spec.building = undefined;
  }
  notes.push(`theme=${theme} layout=${spec.layoutId} time=${timeOfDay}`);
  notes.push(`sizeHint=${sizeHint}`);

  return { spec, notes };
}
