import React from "react";
import type { TurnEntry } from "../game/turnTypes";
import type { TokenState } from "../types";
import { isTokenDead } from "../game/combatUtils";

export function InitiativePanel(props: {
  round: number;
  timelineEntries: TurnEntry[];
  activeEntry: TurnEntry | null;
  player: TokenState;
  enemies: TokenState[];
}): React.JSX.Element {
  return (
    <div
      style={{
        marginBottom: 8,
        padding: "6px 10px",
        background: "#111322",
        borderRadius: 8,
        border: "1px solid #333",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        maxWidth: "100%"
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
        <span style={{ fontSize: 12, color: "#b0b8c4" }}>
          Ordre d&apos;initiative (round {props.round})
        </span>
        {props.activeEntry && (
          <span style={{ fontSize: 11, color: "#f1c40f" }}>
            Tour actuel :{" "}
            {props.activeEntry.kind === "player"
              ? "Joueur"
              : props.activeEntry.kind === "summon"
              ? `Summon (${props.activeEntry.id})`
              : props.activeEntry.id}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          overflowX: "auto",
          paddingBottom: 2
        }}
      >
        {props.timelineEntries.map(entry => {
          const isActive =
            props.activeEntry &&
            entry.id === props.activeEntry.id &&
            entry.kind === props.activeEntry.kind;
          const isPlayer = entry.kind === "player";
          const isSummon = entry.kind === "summon";
          const tokenState =
            entry.kind === "player"
              ? props.player
              : props.enemies.find(e => e.id === entry.id) || null;
          const isDead = tokenState ? isTokenDead(tokenState) : false;
          const token = isPlayer
            ? { label: "PJ", color: "#7dc4ff" }
            : isSummon
            ? {
                label: `SUM`,
                color: entry.ownerType === "player" ? "#7dc4ff" : "#ff6b6b"
              }
            : { label: entry.id, color: "#ff6b6b" };

          return (
            <div
              key={`${entry.kind}-${entry.id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: 4,
                borderRadius: 6,
                border: isActive ? "2px solid #f1c40f" : "1px solid #333",
                background: isDead ? "#111118" : isActive ? "#1b1b30" : "#101020",
                minWidth: 48
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: isDead ? "#2b2b38" : token.color,
                  border: "1px solid rgba(255,255,255,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#0b0b12",
                  textTransform: "uppercase",
                  filter: isDead ? "grayscale(1)" : "none"
                }}
              >
                {token.label.slice(0, 2)}
              </div>
              <span
                style={{
                  fontSize: 10,
                  marginTop: 2,
                  color: isDead ? "#777a8a" : "#d0d6e0",
                  whiteSpace: "nowrap",
                  textDecoration: isDead ? "line-through" : "none"
                }}
              >
                {isSummon ? `${token.label} ${entry.id}` : token.label}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: "#9aa0b5"
                }}
              >
                Init {entry.initiative}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

