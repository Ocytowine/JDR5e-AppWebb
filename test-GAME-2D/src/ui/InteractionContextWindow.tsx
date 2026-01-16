import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { InteractionSpec } from "../game/interactions";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function costLabel(cost?: InteractionSpec["cost"]): string {
  if (cost === "action") return "Action";
  if (cost === "bonus") return "Bonus";
  return "Libre";
}

export function InteractionContextWindow(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  interaction: InteractionSpec | null;
  availability: { ok: boolean; reason?: string } | null;
  forceMod: number;
  onExecute: () => void;
  onClose: () => void;
}): React.ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 16, top: 16 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const hasUserMovedRef = useRef<boolean>(false);

  useLayoutEffect(() => {
    if (!props.open) return;
    if (hasUserMovedRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const desiredLeft = props.anchorX + 18;
    const desiredTop = props.anchorY + 18;
    const left = clamp(desiredLeft, 8, Math.max(8, parentRect.width - rect.width - 8));
    const top = clamp(desiredTop, 8, Math.max(8, parentRect.height - rect.height - 8));
    setPos({ left, top });
  }, [props.anchorX, props.anchorY, props.open, props.interaction?.id]);

  useEffect(() => {
    if (!props.open) return;
    hasUserMovedRef.current = false;
  }, [props.open, props.interaction?.id]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => {
      const el = containerRef.current;
      const drag = dragRef.current;
      if (!el || !drag) return;
      const parent = el.parentElement;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      const nextLeft = drag.startLeft + dx;
      const nextTop = drag.startTop + dy;
      const left = clamp(nextLeft, 8, Math.max(8, parentRect.width - rect.width - 8));
      const top = clamp(nextTop, 8, Math.max(8, parentRect.height - rect.height - 8));
      hasUserMovedRef.current = true;
      setPos({ left, top });
    };

    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
    };
  }, [isDragging]);

  if (!props.open || !props.interaction) return null;
  const availability = props.availability;
  const isBlocked = availability ? !availability.ok : false;

  return (
    <div
      ref={containerRef}
      onMouseDown={event => event.stopPropagation()}
      style={{
        position: "absolute",
        left: pos.left,
        top: pos.top,
        zIndex: 65,
        width: 300,
        maxWidth: "min(90vw, 360px)",
        background: "rgba(10, 10, 16, 0.92)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "flex-start"
        }}
      >
        <div
          onPointerDown={event => {
            if (event.button !== 0) return;
            const el = containerRef.current;
            if (!el) return;
            event.preventDefault();
            event.stopPropagation();
            dragRef.current = {
              startClientX: event.clientX,
              startClientY: event.clientY,
              startLeft: pos.left,
              startTop: pos.top
            };
            setIsDragging(true);
          }}
          style={{
            minWidth: 0,
            flex: "1 1 auto",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none"
          }}
          title="Glisser pour deplacer"
        >
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>
            {props.interaction.label}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 6,
                background: "#2c3e50",
                color: "#fff",
                fontWeight: 800
              }}
            >
              {costLabel(props.interaction.cost)}
            </span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 6,
                background: isBlocked ? "rgba(231,76,60,0.25)" : "rgba(46,204,113,0.18)",
                border: `1px solid ${isBlocked ? "rgba(231,76,60,0.55)" : "rgba(46,204,113,0.45)"}`,
                color: isBlocked ? "#ffb2aa" : "#bdf6d2",
                fontWeight: 800
              }}
            >
              {availability ? (availability.ok ? "Disponible" : "Bloquee") : "Etat inconnu"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={props.onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer",
            fontWeight: 900,
            flex: "0 0 auto"
          }}
          title="Fermer"
        >
          -
        </button>
      </div>

      {props.interaction.forceDc !== undefined && (
        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.82)" }}>
          Test de force: d20 + {props.forceMod} vs DD {props.interaction.forceDc}.
        </div>
      )}

      {availability && !availability.ok && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#ffb2aa" }}>
          {availability.reason || "Interaction indisponible."}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={props.onExecute}
          disabled={Boolean(availability && !availability.ok)}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: availability?.ok ? "#2ecc71" : "rgba(90, 90, 100, 0.55)",
            color: availability?.ok ? "#0b0b12" : "rgba(255,255,255,0.75)",
            cursor: availability?.ok ? "pointer" : "not-allowed",
            fontSize: 12,
            fontWeight: 900
          }}
        >
          Executer
        </button>
      </div>
    </div>
  );
}
