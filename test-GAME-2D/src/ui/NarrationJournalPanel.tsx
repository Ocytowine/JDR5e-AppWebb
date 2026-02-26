import React, { useMemo, useState } from "react";
import type { NarrationJournalView } from "./narrationJournalAdapter";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  debugText?: string;
  debugOpen?: boolean;
  continuityHint?: string;
  speaker?: { id?: string; label?: string; kind?: string };
};

type NarrationChatPayload = {
  reply?: string;
  error?: string;
  stateUpdated?: boolean;
  debug?: {
    intent?: { type?: string; confidence?: number | null };
    director?: { mode?: string; applyRuntime?: boolean };
    worldDelta?: { reputationDelta?: number; localTensionDelta?: number; reason?: string };
    worldState?: { conversation?: { activeInterlocutor?: string | null } };
    outcome?: {
      selectedCommand?: { entityType?: string; entityId?: string };
      appliedOutcome?: { result?: { transitionId?: string } };
      guardBlocked?: boolean;
      guardViolations?: Array<{ gate?: string; code?: string }>;
    };
    [key: string]: unknown;
  };
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
  const source = payload.debug && typeof payload.debug === "object" ? payload.debug : payload;
  const intent = source.intent as NarrationChatPayload["intent"] | undefined;
  const director = source.director as NarrationChatPayload["director"] | undefined;
  const intentType = intent?.type ?? "n/a";
  const directorMode = director?.mode ?? "n/a";
  const applyRuntime =
    typeof director?.applyRuntime === "boolean"
      ? Boolean(director.applyRuntime)
        ? "yes"
        : "no"
      : "n/a";
  const worldDelta = source.worldDelta as NarrationChatPayload["worldDelta"] | undefined;
  const worldState = source.worldState as NarrationChatPayload["worldState"] | undefined;
  const outcome = source.outcome as NarrationChatPayload["outcome"] | undefined;
  const rep = Number(worldDelta?.reputationDelta ?? 0);
  const tension = Number(worldDelta?.localTensionDelta ?? 0);
  const reason = worldDelta?.reason ?? "n/a";
  const interlocutor = worldState?.conversation?.activeInterlocutor ?? "none";
  const transitionId = outcome?.appliedOutcome?.result?.transitionId ?? "none";
  const selectedType = outcome?.selectedCommand?.entityType ?? "none";
  const selectedId = outcome?.selectedCommand?.entityId ?? "none";
  const guardBlocked = outcome?.guardBlocked ? "yes" : "no";
  const guardReasons =
    Array.isArray(outcome?.guardViolations) && outcome?.guardViolations.length > 0
      ? outcome?.guardViolations.map(item => `${item.gate ?? "gate"}/${item.code ?? "code"}`).join(", ")
      : "none";
  const hasSignal =
    intentType !== "n/a" ||
    directorMode !== "n/a" ||
    transitionId !== "none" ||
    guardReasons !== "none" ||
    rep !== 0 ||
    tension !== 0;
  const mjStructured = (source as Record<string, unknown>).mjStructured as
    | { toolCalls?: Array<{ name?: string; tool?: string; id?: string }> }
    | undefined;
  const plannedTools = Array.isArray(mjStructured?.toolCalls)
    ? mjStructured.toolCalls
        .map(row => String(row?.name ?? row?.tool ?? row?.id ?? "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const phase12 = (source as Record<string, unknown>).phase12 as
    | {
        worldIntentConfidence?: number | null;
        intentArbitrationDecision?: { mode?: string; confidence?: number | null } | null;
        stageContractViolation?: boolean;
        anchorDriftDetected?: boolean;
        regenerationCount?: number;
        memoryWindow?: {
          compacted?: boolean;
          compactReason?: string;
          compactedCount?: number;
          activeWindowKey?: string;
          activeTurns?: number;
          summaryCount?: number;
        } | null;
      }
    | undefined;
  const toolTrace = (source as Record<string, unknown>).mjToolTrace as Array<{
    tool?: string;
    summary?: string;
    data?: {
      query?: string;
      matches?: Array<{ title?: string }>;
      total?: number;
      rows?: Array<{ entity?: string; label?: string; id?: string }>;
      applied?: Array<{ entity?: string; id?: string; ok?: boolean; summary?: string }>;
    };
  }> | undefined;
  const toolTraceRows = Array.isArray(toolTrace) ? toolTrace : [];
  const queryLoreOps = toolTraceRows
    .filter(row => String(row?.tool ?? "").toLowerCase() === "query_lore")
    .map(row => {
      const query = String(row?.data?.query ?? "").trim();
      const titles = Array.isArray(row?.data?.matches)
        ? row.data.matches
            .map(match => String(match?.title ?? "").trim())
            .filter(Boolean)
            .slice(0, 2)
        : [];
      return `${query || "?"}${titles.length ? ` -> ${titles.join(" ; ")}` : ""}`;
    })
    .slice(0, 4);
  const sessionDbReads = toolTraceRows
    .filter(row => String(row?.tool ?? "").toLowerCase() === "session_db_read")
    .map(row => {
      const total = Number(row?.data?.total ?? 0);
      const entities = Array.isArray(row?.data?.rows)
        ? Array.from(
            new Set(
              row.data.rows
                .map(entry => String(entry?.entity ?? "").trim())
                .filter(Boolean)
            )
          ).slice(0, 3)
        : [];
      const entityText = entities.length ? ` entities=${entities.join(",")}` : "";
      return `${total} row(s)${entityText}`;
    })
    .slice(0, 4);
  const dbOps = Array.isArray(toolTrace)
    ? toolTrace
        .filter(row => String(row?.tool ?? "").toLowerCase() === "session_db_write")
        .flatMap(row =>
          Array.isArray(row?.data?.applied)
            ? row.data.applied.map(item => `${item.entity ?? "entity"}:${item.id ?? "id"}:${item.ok ? "ok" : "ko"}`)
            : []
        )
        .slice(0, 6)
    : [];
  const hasDebugSignal = hasSignal || plannedTools.length > 0 || toolTraceRows.length > 0;
  if (!hasDebugSignal) return "";
  const toolActivityLine =
    plannedTools.length === 0 && toolTraceRows.length === 0
      ? "toolActivity: none (aucun appel outil sur ce tour)"
      : `toolActivity: planned=${plannedTools.length} | executed=${toolTraceRows.length}`;
  const arbitrationText = phase12?.intentArbitrationDecision
    ? `${phase12.intentArbitrationDecision.mode ?? "n/a"} (${phase12.intentArbitrationDecision.confidence ?? "n/a"})`
    : "n/a";
  const memoryText = phase12?.memoryWindow
    ? `window=${phase12.memoryWindow.activeWindowKey ?? "n/a"} | turns=${phase12.memoryWindow.activeTurns ?? 0} | summaries=${phase12.memoryWindow.summaryCount ?? 0} | compacted=${phase12.memoryWindow.compacted ? "yes" : "no"}:${phase12.memoryWindow.compactReason ?? "none"}`
    : "window=n/a";
  return [
    "",
    "[debug]",
    `intent=${intentType} | director=${directorMode} | applyRuntime=${applyRuntime}`,
    `worldDelta: reputation=${rep >= 0 ? `+${rep}` : rep}, localTension=${tension >= 0 ? `+${tension}` : tension}, reason=${reason}`,
    `interlocutor=${interlocutor}`,
    `transition=${transitionId} | selected=${selectedType}:${selectedId}`,
    `guardBlocked=${guardBlocked} | guardViolations=${guardReasons}`,
    `phase12: arbitration=${arbitrationText} | worldIntentConfidence=${phase12?.worldIntentConfidence ?? "n/a"} | drift=${phase12?.anchorDriftDetected ? "yes" : "no"} | stageViolation=${phase12?.stageContractViolation ? "yes" : "no"} | regen=${phase12?.regenerationCount ?? 0}`,
    `memory: ${memoryText}`,
    `aiToolsPlanned: ${plannedTools.length ? plannedTools.join(", ") : "none"}`,
    `loreReads(query_lore): ${queryLoreOps.length ? queryLoreOps.join(" | ") : "none"}`,
    `localDbReads(session_db_read): ${sessionDbReads.length ? sessionDbReads.join(" | ") : "none"}`,
    `dbWriteOps: ${dbOps.length ? dbOps.join(" | ") : "none"}`,
    toolActivityLine
  ].join("\n");
}

function buildContinuityHint(payload: NarrationChatPayload): string {
  const source = payload.debug && typeof payload.debug === "object" ? payload.debug : payload;
  const worldState = source.worldState as
    | {
        location?: { label?: string };
        conversation?: { activeInterlocutor?: string | null };
      }
    | undefined;
  const phase12 = (source as Record<string, unknown>).phase12 as
    | {
        memoryWindow?: {
          activeWindowKey?: string;
          activeTurns?: number;
          summaryCount?: number;
        } | null;
      }
    | undefined;
  const location = String(worldState?.location?.label ?? "").trim();
  const interlocutor = String(worldState?.conversation?.activeInterlocutor ?? "").trim();
  const turns = Number(phase12?.memoryWindow?.activeTurns ?? 0);
  const summaries = Number(phase12?.memoryWindow?.summaryCount ?? 0);
  const parts: string[] = [];
  if (location) parts.push(`Lieu: ${location}`);
  if (interlocutor) parts.push(`Interlocuteur: ${interlocutor}`);
  if (turns > 0 || summaries > 0) parts.push(`Memoire: ${turns} tours, ${summaries} resume(s)`);
  return parts.join(" | ");
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
        "Chat narratif prêt. Tape un prompt ou /state, /reset, /profile-debug, /context-debug, /rules-debug, /phase1-debug ... /phase8-debug. Interlocuteur: /interlocutor <nom>, /clear-interlocutor.",
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
      const continuityHint = normalizeDisplayText(buildContinuityHint(payload));
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: normalizeDisplayText(reply),
          debugText,
          debugOpen: false,
          continuityHint,
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
              {message.role === "assistant" && message.continuityHint && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    lineHeight: 1.3,
                    color: "#c8d9f8",
                    background: "rgba(32,46,74,0.35)",
                    border: "1px solid rgba(140,170,220,0.35)",
                    borderRadius: 6,
                    padding: "4px 6px"
                  }}
                >
                  Continuité: {message.continuityHint}
                </div>
              )}
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

