import type {
  CombatEvent,
  CombatEventKind,
  CombatSide,
  CombatStateSummary,
  NarrationRequest,
  NarrationResponse
} from "./narrationTypes";

let currentTurnEvents: CombatEvent[] = [];
let eventCounter = 0;

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
  currentTurnEvents.push(evt);
}

export function flushTurnEvents(): CombatEvent[] {
  const out = currentTurnEvents;
  currentTurnEvents = [];
  return out;
}

function buildLocalNarration(
  focusSide: CombatSide,
  state: CombatStateSummary,
  events: CombatEvent[]
): NarrationResponse {
  if (!events.length) {
    return {
      summary:
        focusSide === "player"
          ? "Le heros observe le champ de bataille, en quete d'une action decisive."
          : "Les ennemis se tiennent prudemment, indecis quant a leur prochaine action."
    };
  }

  const attackEvents = events.filter(
    e => e.kind === "player_attack" || e.kind === "enemy_attack"
  );
  const deaths = events.filter(e => e.kind === "death");

  const parts: string[] = [];

  if (attackEvents.length) {
    const lastAttack = attackEvents[attackEvents.length - 1];
    if (lastAttack.actorKind === "player") {
      parts.push(
        "Le heros frappe avec determination, frappant son adversaire au coeur de la melee."
      );
    } else {
      parts.push(
        "Les ennemis redoublent de violence, tentant de submerger le heros sous leurs assauts."
      );
    }
  } else {
    if (focusSide === "player") {
      parts.push(
        "Le heros se repositionne prudemment, jaugeant la situation."
      );
    } else {
      parts.push(
        "Les ennemis se deplacent et murmurent entre eux, cherchant une ouverture."
      );
    }
  }

  if (deaths.length) {
    parts.push(
      deaths.length === 1
        ? "Une silhouette s'effondre sur le champ de bataille, laissant un silence pesant derriere elle."
        : "Plusieurs corps tombent au sol, marquant un tournant sanglant dans l'affrontement."
    );
  }

  const summary = parts.join(" ");

  let playerPerspective: string | undefined;
  if (focusSide === "player") {
    const player = state.actors.find(a => a.kind === "player");
    if (player) {
      playerPerspective =
        "Le heros, essouffle mais resolu, cherche a reprendre l'avantage dans ce combat incertain.";
    }
  }

  return {
    summary,
    playerPerspective
  };
}

export async function requestTurnNarration(
  focusSide: CombatSide,
  state: CombatStateSummary
): Promise<NarrationResponse> {
  const events = flushTurnEvents();

  const payload: NarrationRequest = {
    focusSide,
    focusActorId:
      focusSide === "player"
        ? state.actors.find(a => a.kind === "player")?.id ?? null
        : null,
    state,
    events
  };

  if (!events.length) {
    return buildLocalNarration(focusSide, state, events);
  }

  try {
    const response = await fetch("/api/narration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as NarrationResponse;

    if (!data || typeof data.summary !== "string") {
      throw new Error("Reponse narration invalide");
    }

    return data;
  } catch {
    return buildLocalNarration(focusSide, state, events);
  }
}
