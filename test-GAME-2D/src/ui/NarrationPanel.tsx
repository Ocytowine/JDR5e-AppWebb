import React, { useEffect, useMemo, useState } from "react";

export type NarrationEntry = {
  id: string;
  round: number;
  text: string;
};

export function NarrationPanel(props: {
  entries: NarrationEntry[];
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
          gap: 2,
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 4
        }}
      >
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
    </div>
  );
}
