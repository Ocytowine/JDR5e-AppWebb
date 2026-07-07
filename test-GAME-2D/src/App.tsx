import { useState } from "react";
import { GameBoard } from "./GameBoard";
import { NarrativeAppSurface } from "./narration-ui/NarrativeAppSurface";

type AppSurface = "narration" | "tactical";

export function App() {
  const [surface, setSurface] = useState<AppSurface>("narration");

  return (
    <div style={{ minHeight: "100vh", background: "#070911", color: "#fff" }}>
      <nav
        aria-label="Surfaces principales"
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          gap: 8,
          padding: 6,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(6,8,14,0.86)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)"
        }}
      >
        <SurfaceButton active={surface === "narration"} onClick={() => setSurface("narration")}>
          Narration
        </SurfaceButton>
        <SurfaceButton active={surface === "tactical"} onClick={() => setSurface("tactical")}>
          Tactique
        </SurfaceButton>
      </nav>

      {surface === "narration" ? <NarrativeAppSurface /> : <GameBoard />}
    </div>
  );
}

function SurfaceButton(props: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      style={{
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 999,
        padding: "7px 12px",
        background: props.active ? "rgba(88,166,255,0.28)" : "rgba(255,255,255,0.06)",
        color: props.active ? "#fff" : "rgba(255,255,255,0.72)",
        cursor: "pointer",
        fontWeight: 800,
        letterSpacing: 0.2
      }}
    >
      {props.children}
    </button>
  );
}
