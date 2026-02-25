import React, { useEffect, useMemo, useState } from "react";
import type { JournalSection, NarrationJournalView } from "./narrationJournalAdapter";

export type NarrationEntry = {
  id: string;
  round: number;
  text: string;
};

export function NarrationPanel(props: {
  entries: NarrationEntry[];
  journal?: NarrationJournalView | null;
}): React.JSX.Element {
  const rounds = useMemo(() => {
    const seen = new Map<number, NarrationEntry[]>();
    const ordered: number[] = [];
    for (const entry of props.entries) {
      if (!seen.has(entry.round)) {
        seen.set(entry.round, []);
        ordered.push(entry.round);
      }
      seen.get(entry.round)?.push(entry);
    }
    return ordered.map(round => ({
      round,
      entries: seen.get(round) ?? []
    }));
  }, [props.entries]);

  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(() => new Set());
  const [selectedJournalItemId, setSelectedJournalItemId] = useState<string | null>(null);

  useEffect(() => {
    const latest = props.entries[0]?.round;
    if (latest == null) return;
    setExpandedRounds(prev => {
      if (prev.has(latest)) return prev;
      const next = new Set(prev);
      next.add(latest);
      return next;
    });
  }, [props.entries]);

  return (
    <div
      style={{
        padding: "10px 12px",
        background:
          "linear-gradient(180deg, rgba(38, 28, 16, 0.92), rgba(16, 12, 8, 0.92))",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 16px 50px rgba(0,0,0,0.45)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxWidth: "100%",
        height: 240,
        fontFamily:
          "\"Iowan Old Style\", \"Palatino Linotype\", Palatino, Garamond, \"Times New Roman\", serif"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4
        }}
      >
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", fontWeight: 700 }}>
          Chronique
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
          Tours {rounds.length}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 4
        }}
      >
        {props.journal && (
          <JournalBlock
            journal={props.journal}
            selectedItemId={selectedJournalItemId}
            onSelectItem={setSelectedJournalItemId}
          />
        )}
        {props.entries.length === 0 && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
            En attente d'actions pour raconter le tour...
          </span>
        )}
        {rounds.map(group => {
          const isExpanded = expandedRounds.has(group.round);
          return (
            <div
              key={group.round}
              style={{
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(8,8,12,0.55)",
                overflow: "hidden"
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedRounds(prev => {
                    const next = new Set(prev);
                    if (next.has(group.round)) {
                      next.delete(group.round);
                    } else {
                      next.add(group.round);
                    }
                    return next;
                  })
                }
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 10px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255,255,255,0.9)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 0.3
                }}
              >
                <span>Tour {group.round}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                  {isExpanded ? "replier" : "deplier"} ({group.entries.length})
                </span>
              </button>
              {isExpanded && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "6px 10px 10px",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.88)",
                    maxHeight: 220,
                    overflowY: "auto",
                    paddingRight: 6
                  }}
                >
                  {group.entries.map(entry => (
                    <div
                      key={entry.id}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(20,14,10,0.7)",
                        maxHeight: 140,
                        overflowY: "auto",
                        lineHeight: 1.35,
                        whiteSpace: "pre-wrap"
                      }}
                    >
                      {entry.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {props.journal && selectedJournalItemId && (
        <JournalModal
          journal={props.journal}
          itemId={selectedJournalItemId}
          onClose={() => setSelectedJournalItemId(null)}
        />
      )}
    </div>
  );
}

function JournalBlock(props: {
  journal: NarrationJournalView;
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,241,209,0.85)", letterSpacing: 0.4 }}>
        Journal narratif
      </div>
      {props.journal.highlights.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {props.journal.highlights.slice(0, 4).map(highlight => (
            <div
              key={highlight.id}
              style={{
                fontSize: 11,
                lineHeight: 1.25,
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  highlight.level === "critical"
                    ? "rgba(143, 31, 26, 0.62)"
                    : highlight.level === "warning"
                      ? "rgba(149, 102, 16, 0.62)"
                      : "rgba(24, 72, 122, 0.55)",
                color: "rgba(255,255,255,0.92)"
              }}
            >
              {highlight.message}
            </div>
          ))}
        </div>
      )}
      {props.journal.sections.map(section => (
        <JournalSectionView
          key={section.key}
          section={section}
          selectedItemId={props.selectedItemId}
          onSelectItem={props.onSelectItem}
        />
      ))}
    </div>
  );
}

function JournalSectionView(props: {
  section: JournalSection;
  selectedItemId: string | null;
  onSelectItem: (itemId: string | null) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(8,8,12,0.52)",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.35,
          color: "rgba(255,255,255,0.86)",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        {props.section.label} ({props.section.items.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {props.section.items.length === 0 && (
          <div style={{ padding: "7px 10px", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Aucune entrée.</div>
        )}
        {props.section.items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => props.onSelectItem(props.selectedItemId === item.id ? null : item.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              alignItems: "center",
              gap: 8,
              border: "none",
              textAlign: "left",
              cursor: "pointer",
              padding: "6px 10px",
              background: props.selectedItemId === item.id ? "rgba(255,255,255,0.12)" : "transparent",
              color: "rgba(255,255,255,0.9)"
            }}
          >
            <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.title}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.66)" }}>{item.deadlineLabel}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: item.urgency >= 3 ? "rgba(255,198,187,0.95)" : "rgba(223,239,255,0.9)"
              }}
            >
              {item.state}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function JournalModal(props: {
  journal: NarrationJournalView;
  itemId: string;
  onClose: () => void;
}): React.JSX.Element | null {
  const item = props.journal.sections.flatMap(section => section.items).find(entry => entry.id === props.itemId) ?? null;
  if (!item) return null;

  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(17, 12, 7, 0.95)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,240,218,0.95)" }}>{item.title}</div>
        <button
          type="button"
          onClick={props.onClose}
          style={{
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.9)",
            borderRadius: 6,
            fontSize: 10,
            padding: "2px 7px",
            cursor: "pointer"
          }}
        >
          fermer
        </button>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Faits</div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
        {item.details.facts.map((fact, index) => (
          <li key={`fact-${item.id}-${index}`} style={{ fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
            {fact}
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Hypothèses PJ</div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
        {item.details.hypotheses.map((hypothesis, index) => (
          <li key={`hyp-${item.id}-${index}`} style={{ fontSize: 11, color: "rgba(255,255,255,0.9)" }}>
            {hypothesis}
          </li>
        ))}
      </ul>
    </div>
  );
}
