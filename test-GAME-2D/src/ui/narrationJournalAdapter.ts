import type { NarrativeRuntimeState } from "../narrationRuntimeState";

export type JournalBannerKey = "quests" | "intrigues" | "world";

export interface JournalItem {
  id: string;
  entityType: "quest" | "trama" | "companion" | "trade";
  entityId: string;
  title: string;
  state: string;
  urgency: number;
  deadlineLabel: string;
  highlights: string[];
  details: {
    facts: string[];
    hypotheses: string[];
  };
}

export interface JournalSection {
  key: JournalBannerKey;
  label: string;
  items: JournalItem[];
}

export interface NarrationJournalView {
  sections: JournalSection[];
  highlights: Array<{
    id: string;
    message: string;
    level: "info" | "warning" | "critical";
  }>;
}

function timeLabel(day: number, hour: number): string {
  if (day > 0) return `J+${day}`;
  return `H+${hour}`;
}

function buildUrgency(state: string): number {
  const normalized = state.toLowerCase();
  if (normalized.includes("clôturée") || normalized.includes("terminée") || normalized.includes("transaction conclue")) {
    return 1;
  }
  if (normalized.includes("rupture") || normalized.includes("départ durable") || normalized.includes("refus")) {
    return 3;
  }
  if (normalized.includes("active") || normalized.includes("acceptée") || normalized.includes("négociation")) {
    return 2;
  }
  return 1;
}

function latestFactFor(state: NarrativeRuntimeState, entityType: JournalItem["entityType"], entityId: string): string | null {
  const found = state.history.find((entry) => entry.entityType === entityType && entry.entityId === entityId);
  if (!found) return null;
  return `${found.trigger} -> ${found.toState}`;
}

function buildItem(
  state: NarrativeRuntimeState,
  entityType: JournalItem["entityType"],
  entityId: string,
  currentState: string
): JournalItem {
  const urgency = buildUrgency(currentState);
  const latestFact = latestFactFor(state, entityType, entityId);
  const highlights: string[] = [];
  if (urgency >= 3) highlights.push("Urgence élevée");
  if (latestFact) highlights.push("Changement d'état récent");

  return {
    id: `${entityType}:${entityId}`,
    entityType,
    entityId,
    title: entityId,
    state: currentState,
    urgency,
    deadlineLabel: timeLabel(state.clock.day, state.clock.hour),
    highlights,
    details: {
      facts: [
        `État actuel: ${currentState}`,
        latestFact ? `Dernière transition: ${latestFact}` : "Dernière transition: inconnue"
      ],
      hypotheses: [
        urgency >= 3
          ? "Une action immédiate est recommandée pour limiter les conséquences."
          : "Situation stable à surveiller."
      ]
    }
  };
}

function sortItems(items: JournalItem[]): JournalItem[] {
  return [...items].sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    return a.title.localeCompare(b.title, "fr");
  });
}

export function buildNarrationJournal(state: NarrativeRuntimeState): NarrationJournalView {
  const quests = Object.entries(state.quests).map(([id, value]) => buildItem(state, "quest", id, value));
  const tramas = Object.entries(state.tramas).map(([id, value]) => buildItem(state, "trama", id, value));
  const companions = Object.entries(state.companions).map(([id, value]) => buildItem(state, "companion", id, value));
  const trades = Object.entries(state.trades).map(([id, value]) => buildItem(state, "trade", id, value));

  const sections: JournalSection[] = [
    { key: "quests", label: "Quêtes acceptées", items: sortItems(quests) },
    { key: "intrigues", label: "Intrigues", items: sortItems([...companions, ...trades]) },
    { key: "world", label: "Trames monde", items: sortItems(tramas) }
  ];

  const highlights: NarrationJournalView["highlights"] = [];
  for (const section of sections) {
    for (const item of section.items.slice(0, 3)) {
      if (item.urgency >= 3) {
        highlights.push({
          id: `hl:${item.id}`,
          message: `${section.label}: ${item.title} (${item.state})`,
          level: "critical"
        });
      } else if (item.highlights.includes("Changement d'état récent")) {
        highlights.push({
          id: `hl:${item.id}`,
          message: `${section.label}: changement détecté sur ${item.title}`,
          level: "info"
        });
      }
    }
  }

  return { sections, highlights };
}
