import type {
  CombatEvent,
  CombatEventKind,
  CombatSide,
  CombatStateSummary,
  EnemySpeech,
  EnemySpeechRequest,
  EnemySpeechResponse,
  NarrationRequest,
  NarrationResponse
} from "./narrationTypes";

type RoundNarrationBuffer = {
  active: boolean;
  round: number | null;
  stateStart: CombatStateSummary | null;
  events: CombatEvent[];
  enemySpeeches: EnemySpeech[];
  lastSpeechByEnemyThisRound: Map<string, string>;
};

const buffer: RoundNarrationBuffer = {
  active: false,
  round: null,
  stateStart: null,
  events: [],
  enemySpeeches: [],
  lastSpeechByEnemyThisRound: new Map()
};

let eventCounter = 0;
const lastSpeechByEnemyGlobal = new Map<string, string>();

export function beginRoundNarrationBuffer(
  round: number,
  stateStart: CombatStateSummary
): void {
  buffer.active = true;
  buffer.round = round;
  buffer.stateStart = stateStart;
  buffer.events = [];
  buffer.enemySpeeches = [];
  buffer.lastSpeechByEnemyThisRound = new Map();
}

export function isRoundNarrationBufferActive(): boolean {
  return buffer.active;
}

export function recordCombatEvent(input: {
  round: number;
  phase: CombatSide;
  kind: CombatEventKind;
  actorId: string;
  actorKind: "player" | "enemy";
  targetId?: string | null;
  targetKind?: "player" | "enemy" | null;
  summary: string;
  data?: Record<string, unknown>;
}): void {
  if (!buffer.active) return;
  if (buffer.round !== null && input.round !== buffer.round) {
    // Ignore events that belong to a different round buffer.
    return;
  }

  const evt: CombatEvent = {
    id: `evt-${Date.now()}-${eventCounter++}`,
    round: input.round,
    phase: input.phase,
    kind: input.kind,
    actorId: input.actorId,
    actorKind: input.actorKind,
    targetId: input.targetId ?? null,
    targetKind: input.targetKind ?? null,
    summary: input.summary,
    data: input.data ?? {},
    timestamp: Date.now()
  };
  buffer.events.push(evt);
}

export function recordEnemySpeech(enemyId: string, line: string): void {
  if (!buffer.active) return;
  const trimmed = (line ?? "").trim();
  if (!trimmed) return;

  buffer.enemySpeeches.push({ enemyId, line: trimmed });
  buffer.lastSpeechByEnemyThisRound.set(enemyId, trimmed);
  lastSpeechByEnemyGlobal.set(enemyId, trimmed);

  if (buffer.round !== null) {
    recordCombatEvent({
      round: buffer.round,
      phase: "enemies",
      kind: "speech",
      actorId: enemyId,
      actorKind: "enemy",
      summary: `${enemyId} dit: "${trimmed}"`,
      data: { line: trimmed }
    });
  }
}

export function getPriorEnemySpeechesThisRound(): EnemySpeech[] {
  return buffer.enemySpeeches.slice();
}

export function getLastSpeechForEnemy(enemyId: string): string | null {
  return lastSpeechByEnemyGlobal.get(enemyId) ?? null;
}

export function getRecentCombatEvents(limit: number): CombatEvent[] {
  if (!Number.isFinite(limit) || limit <= 0) return buffer.events.slice();
  return buffer.events.slice(-Math.floor(limit));
}

export function buildRoundNarrationRequest(input: {
  focusActorId: string | null;
  stateEnd: CombatStateSummary;
}): NarrationRequest | null {
  if (!buffer.active || !buffer.stateStart || buffer.round === null) return null;

  return {
    language: "fr",
    focusSide: "player",
    focusActorId: input.focusActorId,
    stateStart: buffer.stateStart,
    stateEnd: input.stateEnd,
    events: buffer.events.slice(),
    enemySpeeches: buffer.enemySpeeches.slice()
  };
}

export function clearRoundNarrationBuffer(): void {
  buffer.active = false;
  buffer.round = null;
  buffer.stateStart = null;
  buffer.events = [];
  buffer.enemySpeeches = [];
  buffer.lastSpeechByEnemyThisRound = new Map();
}

export async function requestRoundNarration(
  payload: NarrationRequest
): Promise<NarrationResponse> {
  const response = await fetch("/api/narration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return { summary: "", error: "IA non fonctionnel." };
  }

  const data = (await response.json()) as NarrationResponse;
  if (!data || typeof data.summary !== "string") {
    return { summary: "", error: "IA non fonctionnel." };
  }

  if (data.error && typeof data.error === "string") {
    return { summary: "", error: data.error };
  }

  return { summary: data.summary };
}

export async function requestEnemySpeech(
  payload: EnemySpeechRequest
): Promise<EnemySpeechResponse> {
  const response = await fetch("/api/enemy-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return { line: "" };
  }

  const data = (await response.json()) as EnemySpeechResponse;
  if (!data || typeof data.line !== "string") {
    return { line: "" };
  }

  return { line: data.line };
}
