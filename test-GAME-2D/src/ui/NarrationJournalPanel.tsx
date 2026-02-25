import React, { useMemo, useState } from "react";
import type { NarrationJournalView } from "./narrationJournalAdapter";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  debugText?: string;
  debugOpen?: boolean;
  speaker?: { id?: string; label?: string; kind?: string };
};

type NarrationChatPayload = {
  reply?: string;
  error?: string;
  stateUpdated?: boolean;
  intent?: { type?: string; confidence?: number | null };
  director?: { mode?: string; applyRuntime?: boolean };
  worldDelta?: { reputationDelta?: number; localTensionDelta?: number; reason?: string };
  worldState?: { conversation?: { activeInterlocutor?: string | null } };
  speaker?: { id?: string; label?: string; kind?: string };
  outcome?: {
    selectedCommand?: { entityType?: string; entityId?: string };
    appliedOutcome?: { result?: { transitionId?: string } };
    guardBlocked?: boolean;
    guardViolations?: Array<{ gate?: string; code?: string }>;
  };
};

function countMojibakeMarkers(text: string): number {
  return (text.match(/[ÃÂ�]/g) ?? []).length;
}

function normalizeDisplayText(value: string): string {
  const text = String(value ?? "");
  if (!/[ÃÂ�]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(text, char => char.charCodeAt(0));
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!repaired || repaired.includes("\u0000")) return text;
    return countMojibakeMarkers(repaired) < countMojibakeMarkers(text) ? repaired : text;
  } catch {
    return text;
  }
}

function buildDebugSuffix(payload: NarrationChatPayload): string {
  const intentType = payload.intent?.type ?? "n/a";
  const directorMode = payload.director?.mode ?? "n/a";
  const applyRuntime =
    typeof payload.director?.applyRuntime === "boolean"
      ? payload.director.applyRuntime
        ? "yes"
        : "no"
      : "n/a";
  const rep = Number(payload.worldDelta?.reputationDelta ?? 0);
  const tension = Number(payload.worldDelta?.localTensionDelta ?? 0);
  const reason = payload.worldDelta?.reason ?? "n/a";
  const interlocutor = payload.worldState?.conversation?.activeInterlocutor ?? "none";
  const transitionId = payload.outcome?.appliedOutcome?.result?.transitionId ?? "none";
  const selectedType = payload.outcome?.selectedCommand?.entityType ?? "none";
  const selectedId = payload.outcome?.selectedCommand?.entityId ?? "none";
  const guardBlocked = payload.outcome?.guardBlocked ? "yes" : "no";
  const guardReasons =
    Array.isArray(payload.outcome?.guardViolations) && payload.outcome?.guardViolations.length > 0
      ? payload.outcome?.guardViolations.map(item => `${item.gate ?? "gate"}/${item.code ?? "code"}`).join(", ")
      : "none";
  return [
    "",
    "[debug]",
    `intent=${intentType} | director=${directorMode} | applyRuntime=${applyRuntime}`,
    `worldDelta: reputation=${rep >= 0 ? `+${rep}` : rep}, localTension=${tension >= 0 ? `+${tension}` : tension}, reason=${reason}`,
    `interlocutor=${interlocutor}`,
    `transition=${transitionId} | selected=${selectedType}:${selectedId}`,
    `guardBlocked=${guardBlocked} | guardViolations=${guardReasons}`
  ].join("\n");
}

function speakerBadgeStyle(kind?: string): { bg: string; border: string } {
  if (kind === "player") return { bg: "rgba(71,104,171,0.55)", border: "rgba(150,180,240,0.55)" };
  if (kind === "interlocutor") return { bg: "rgba(145,98,40,0.55)", border: "rgba(232,183,116,0.55)" };
  if (kind === "system") return { bg: "rgba(98,104,122,0.5)", border: "rgba(172,180,205,0.55)" };
  return { bg: "rgba(43,97,67,0.55)", border: "rgba(132,220,171,0.55)" };
}

export function NarrationJournalPanel(props: {
  journal: NarrationJournalView | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  characterProfile?: {
    id?: string;
    name?: string;
    raceId?: string;
    race?: string;
    backgroundId?: string;
    classe?: Record<string, { classeId?: string; subclasseId?: string | null; niveau?: number }>;
    classLabel?: string;
    subclassLabel?: string;
    argent?: Record<string, unknown>;
    maitriseBonus?: number;
    caracs?: Record<string, unknown>;
    expertises?: string[];
    actionIds?: string[];
    reactionIds?: string[];
    proficiencies?: Record<string, unknown>;
    weaponMasteries?: string[];
    materielSlots?: Record<string, unknown>;
    inventoryItems?: Array<Record<string, unknown>>;
    spellcastingState?: Record<string, unknown>;
    derived?: Record<string, unknown>;
    appearance?: Record<string, unknown> | null;
    skills?: string[];
    goals?: string[];
    sourceSheetId?: string;
    sourceTag?: string;
  };
}): React.JSX.Element {
  const [conversationMode, setConversationMode] = useState<"rp" | "hrp">("rp");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [input, setInput] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showAllDebug, setShowAllDebug] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "system-0",
      role: "system",
      text:
        "Chat narratif prêt. Tape un prompt ou /state, /reset, /profile-debug, /context-debug, /rules-debug. Interlocuteur: /interlocutor <nom>, /clear-interlocutor.",
      speaker: { id: "system", label: "Système", kind: "system" }
    }
  ]);

  const allItems = useMemo(
    () => (props.journal ? props.journal.sections.flatMap(section => section.items) : []),
    [props.journal]
  );
  const selected = allItems.find(item => item.id === selectedItemId) ?? null;

  const sendChatMessage = async (): Promise<void> => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInput("");
    setMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text,
        speaker: { id: "player", label: "Vous", kind: "player" }
      }
    ]);

    try {
      const response = await fetch("/api/narration/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationMode,
          characterProfile: props.characterProfile ?? null
        })
      });
      const raw = await response.text();
      let payload: NarrationChatPayload = {};
      try {
        payload = JSON.parse(raw) as NarrationChatPayload;
      } catch {
        payload = { error: `Réponse API invalide (${response.status}): ${raw.slice(0, 160)}` };
      }

      const reply = !response.ok
        ? `Erreur API (${response.status}): ${payload.error ?? payload.reply ?? "échec"}`
        : payload.error
          ? `Erreur: ${payload.error}`
          : payload.reply ?? "Réponse vide.";
      const debugText = normalizeDisplayText(buildDebugSuffix(payload));
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: normalizeDisplayText(reply),
          debugText,
          debugOpen: false,
          speaker: payload.speaker ?? { id: "mj", label: "MJ", kind: "mj" }
        }
      ]);
      if (payload.stateUpdated) props.onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: normalizeDisplayText(`Erreur réseau: ${message}`),
          speaker: { id: "system", label: "Système", kind: "system" }
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#eef3ff" }}>Module Narratif</div>
          <div style={{ fontSize: 11, color: "#aeb7c9" }}>
            Quêtes, intrigues et trames monde depuis le runtime narratif.
          </div>
        </div>
        <button
          type="button"
          onClick={props.onRefresh}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #3a4560",
            background: "#161c2b",
            color: "#d7e4ff",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700
          }}
        >
          Rafraîchir
        </button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setConversationMode("rp")}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #3a4560",
            background: conversationMode === "rp" ? "rgba(60,91,156,0.85)" : "#131a2a",
            color: "#d7e4ff",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700
          }}
        >
          RP
        </button>
        <button
          type="button"
          onClick={() => setConversationMode("hrp")}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #3a4560",
            background: conversationMode === "hrp" ? "rgba(60,91,156,0.85)" : "#131a2a",
            color: "#d7e4ff",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700
          }}
        >
          Hors RP
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setShowAllDebug(value => !value)}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #3a4560",
            background: showAllDebug ? "rgba(60,91,156,0.85)" : "#131a2a",
            color: "#d7e4ff",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700
          }}
        >
          Détails: {showAllDebug ? "ON" : "OFF"}
        </button>
      </div>

      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          background: "rgba(8,10,18,0.64)",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        <div
          style={{
            maxHeight: 180,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            paddingRight: 3
          }}
        >
          {messages.map(message => (
            <div
              key={message.id}
              style={{
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                whiteSpace: "pre-wrap",
                fontSize: 12,
                lineHeight: 1.35,
                borderRadius: 8,
                padding: "6px 8px",
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  message.role === "user"
                    ? "rgba(71, 104, 171, 0.48)"
                    : message.role === "assistant"
                      ? "rgba(31, 58, 41, 0.52)"
                      : "rgba(90, 96, 114, 0.34)",
                color: "#edf2ff"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#f4f7ff",
                    background: speakerBadgeStyle(message.speaker?.kind).bg,
                    border: `1px solid ${speakerBadgeStyle(message.speaker?.kind).border}`
                  }}
                >
                  {(message.speaker?.label ?? message.role ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span style={{ fontSize: 10, color: "#cfd9ef", fontWeight: 700 }}>
                  {message.speaker?.label ?? (message.role === "user" ? "Vous" : "MJ")}
                </span>
              </div>
              <div>{message.text}</div>
              {message.role === "assistant" && message.debugText && (
                <div style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMessages(prev =>
                        prev.map(item =>
                          item.id === message.id
                            ? { ...item, debugOpen: !item.debugOpen }
                            : item
                        )
                      );
                    }}
                    style={{
                      padding: "2px 6px",
                      borderRadius: 5,
                      border: "1px solid rgba(255,255,255,0.24)",
                      background: "rgba(255,255,255,0.08)",
                      color: "#d7e4ff",
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: 700
                    }}
                  >
                    {showAllDebug || message.debugOpen ? "Masquer détails" : "Voir détails"}
                  </button>
                  {(showAllDebug || message.debugOpen) && (
                    <pre
                      style={{
                        margin: "6px 0 0",
                        whiteSpace: "pre-wrap",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                        fontSize: 10,
                        lineHeight: 1.35,
                        color: "#cfe0ff",
                        background: "rgba(8,12,20,0.55)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 6,
                        padding: "6px 7px"
                      }}
                    >
                      {message.debugText}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendChatMessage();
              }
            }}
            placeholder="Décris ce que tu veux narrer... (ou /state, /reset)"
            style={{
              flex: 1,
              borderRadius: 6,
              border: "1px solid #3b4560",
              background: "#11182a",
              color: "#e8f0ff",
              padding: "8px 10px",
              fontSize: 12
            }}
          />
          <button
            type="button"
            onClick={() => {
              void sendChatMessage();
            }}
            disabled={isSending || !input.trim()}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #4560a1",
              background: isSending ? "rgba(80,90,120,0.45)" : "rgba(63, 98, 175, 0.85)",
              color: "#f4f7ff",
              cursor: isSending ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            Envoyer
          </button>
        </div>
      </div>

      {props.loading && (
        <div style={{ fontSize: 12, color: "#c7d0e5", padding: "4px 0" }}>Chargement du journal narratif...</div>
      )}
      {props.error && (
        <div
          style={{
            fontSize: 12,
            color: "#ffd4d4",
            border: "1px solid rgba(255,122,122,0.45)",
            borderRadius: 8,
            padding: "8px 10px",
            background: "rgba(96, 22, 22, 0.35)"
          }}
        >
          {props.error}
        </div>
      )}

      {props.journal && (
        <>
          {props.journal.highlights.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {props.journal.highlights.slice(0, 6).map(highlight => (
                <div
                  key={highlight.id}
                  style={{
                    fontSize: 11,
                    lineHeight: 1.3,
                    borderRadius: 8,
                    padding: "5px 8px",
                    border: "1px solid rgba(255,255,255,0.16)",
                    background:
                      highlight.level === "critical"
                        ? "rgba(132, 36, 36, 0.45)"
                        : highlight.level === "warning"
                          ? "rgba(129, 89, 27, 0.45)"
                          : "rgba(28, 73, 125, 0.38)",
                    color: "#eef2ff"
                  }}
                >
                  {highlight.message}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {props.journal.sections.map(section => (
              <div
                key={section.key}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  background: "rgba(10,12,20,0.55)",
                  minHeight: 220,
                  display: "flex",
                  flexDirection: "column"
                }}
              >
                <div
                  style={{
                    padding: "8px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.10)",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#dce7ff"
                  }}
                >
                  {section.label} ({section.items.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: 6 }}>
                  {section.items.length === 0 && (
                    <div style={{ fontSize: 11, color: "#97a3bf", padding: "6px 4px" }}>Aucune entrée</div>
                  )}
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedItemId(current => (current === item.id ? null : item.id))}
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 6,
                        padding: "6px 7px",
                        cursor: "pointer",
                        background: selectedItemId === item.id ? "rgba(92,122,182,0.28)" : "rgba(255,255,255,0.04)",
                        color: "#edf2ff",
                        textAlign: "left",
                        fontSize: 11
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{item.title}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, color: "#b8c5dd" }}>
                        <span>{item.state}</span>
                        <span>{item.deadlineLabel}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 8,
                background: "rgba(12, 15, 24, 0.72)",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 6
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#e6eeff" }}>{selected.title}</div>
              <div style={{ fontSize: 12, color: "#b3bfd6" }}>État: {selected.state}</div>
              <div style={{ fontSize: 12, color: "#b3bfd6" }}>Faits</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {selected.details.facts.map((fact, idx) => (
                  <li key={`fact-${idx}`} style={{ color: "#eef2ff", fontSize: 12, marginBottom: 3 }}>
                    {fact}
                  </li>
                ))}
              </ul>
              <div style={{ fontSize: 12, color: "#b3bfd6" }}>Hypothèses PJ</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {selected.details.hypotheses.map((hypothesis, idx) => (
                  <li key={`hyp-${idx}`} style={{ color: "#eef2ff", fontSize: 12, marginBottom: 3 }}>
                    {hypothesis}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

