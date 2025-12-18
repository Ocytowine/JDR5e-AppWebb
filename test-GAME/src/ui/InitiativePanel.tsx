import React from "react";
import type { TurnEntry } from "../game/turnTypes";
import type { TokenState } from "../types";
import { buildTokenSvgDataUrl } from "../svgTokenHelper";
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
            {props.activeEntry.kind === "player" ? "Joueur" : props.activeEntry.id}
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
          const tokenSvg = buildTokenSvgDataUrl(isPlayer ? "player" : "enemy");
          const tokenState =
            entry.kind === "player"
              ? props.player
              : props.enemies.find(e => e.id === entry.id) || null;
          const isDead = tokenState ? isTokenDead(tokenState) : false;
          const token = isPlayer
            ? { svg: tokenSvg, label: "PJ" }
            : { svg: tokenSvg, label: entry.id };

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
              <img
                src={token.svg}
                alt={token.label}
                style={{
                  width: 32,
                  height: 32,
                  objectFit: "contain",
                  filter: isDead
                    ? "grayscale(1)"
                    : isPlayer
                      ? "none"
                      : "grayscale(0.2)"
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  marginTop: 2,
                  color: isDead ? "#777a8a" : "#d0d6e0",
                  whiteSpace: "nowrap",
                  textDecoration: isDead ? "line-through" : "none"
                }}
              >
                {token.label}
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

